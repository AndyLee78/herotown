import { alchemyRules, magicRules, marketRules, retirementRules, smithRules } from './data'
import type { GameState, MaterialName } from './game'
import { forgeGear } from './gear'
import { seasonKey } from './nest'
import { createRng } from './rng'
import { lighthouseOffers } from './monuments'
import type { Gear, PotionId } from './types'

// The market (Docs/market.md): materials bought and sold at prices that move
// with trade, a seasonal deal, selling spare gear and potions, and a wandering
// merchant who stays a few hours with a handful of offers.

export const MARKET_MATERIALS: MaterialName[] = ['wood', 'stone', 'iron', 'bone', 'herb', 'crystal']

export type MerchantOffer =
  | { id: string; kind: 'material'; material: MaterialName; amount: number; price: number; sold: boolean }
  | { id: string; kind: 'gear'; gear: Gear; price: number; sold: boolean }
  | { id: string; kind: 'potion'; potionId: PotionId; count: number; price: number; sold: boolean }

export type Merchant = { arriveAt: number; leaveAt: number; offers: MerchantOffer[] }

export type Market = {
  // How far each price has been pushed by trade: +0.3 is 30% dearer.
  pressure: Partial<Record<MaterialName, number>>
  pressureAt: number
  merchant: Merchant | null
  nextMerchantAt: number
  merchantNonce: number
}

export function freshMarket(now: number): Market {
  return { pressure: {}, pressureAt: now, merchant: null, nextMerchantAt: now + marketRules.merchant.everyMs, merchantNonce: 0 }
}

function level(state: GameState): number {
  return Math.min(marketRules.sellRatio.length, state.buildings.market) - 1
}

// Pressure eases back toward zero as time passes.
export function pressureOf(state: GameState, material: MaterialName): number {
  const market = state.market
  const hours = Math.max(0, state.lastTickAt - market.pressureAt) / 3_600_000
  return (market.pressure[material] ?? 0) * Math.pow(marketRules.pressureKeptPerHour, hours)
}

function settled(state: GameState): Market {
  const pressure: Market['pressure'] = {}
  for (const material of MARKET_MATERIALS) {
    const value = pressureOf(state, material)
    if (Math.abs(value) > 0.0005) {
      pressure[material] = value
    }
  }
  return { ...state.market, pressure, pressureAt: state.lastTickAt }
}

// This season's deal: one material sold cheap, another wanted dearly. Never the same one.
export function seasonDeal(state: GameState): { cheap: MaterialName; wanted: MaterialName } {
  const key = seasonKey(state.calendar)
  let hash = state.seed
  for (const char of key) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  }
  const rng = createRng(hash)
  const cheap = MARKET_MATERIALS[Math.floor(rng.next() * MARKET_MATERIALS.length)]!
  const others = MARKET_MATERIALS.filter((material) => material !== cheap)
  const wanted = others[Math.floor(rng.next() * others.length)]!
  return { cheap, wanted }
}

function sellRatio(state: GameState): number {
  const kept = (state.retirees ?? []).some((retiree) => retiree.building === 'market')
  return marketRules.sellRatio[level(state)]! * (1 + (kept ? retirementRules.bonus.market : 0))
}

// Gold for `amount` units, unit by unit as the price moves.
export function buyQuote(state: GameState, material: MaterialName, amount: number): number {
  const deal = seasonDeal(state).cheap === material ? 1 - marketRules.deal.discount : 1
  let pressure = pressureOf(state, material)
  let total = 0
  for (let unit = 0; unit < amount; unit += 1) {
    total += marketRules.basePrice[material] * (1 + pressure) * deal
    pressure = Math.min(marketRules.pressureMax, pressure + marketRules.pressurePerUnit)
  }
  return Math.ceil(total)
}

export function sellQuote(state: GameState, material: MaterialName, amount: number): number {
  const demand = seasonDeal(state).wanted === material ? 1 + marketRules.deal.demand : 1
  // Never near what buying pays, however the bonuses stack (review bb1c2cf).
  const ratio = Math.min(marketRules.sellCap, sellRatio(state) * demand)
  let pressure = pressureOf(state, material)
  let total = 0
  for (let unit = 0; unit < amount; unit += 1) {
    // Each unit sold drops the price first, the mirror of buying, which pays
    // and then raises it: buying units and selling them straight back walks
    // the same prices, so it always loses (review bb1c2cf).
    pressure = Math.max(marketRules.pressureMin, pressure - marketRules.pressurePerUnit)
    total += marketRules.basePrice[material] * ratio * (1 + pressure)
  }
  return Math.floor(total)
}

function shifted(state: GameState, material: MaterialName, units: number): Market {
  const market = settled(state)
  const now = market.pressure[material] ?? 0
  const next = Math.max(marketRules.pressureMin, Math.min(marketRules.pressureMax, now + units * marketRules.pressurePerUnit))
  return { ...market, pressure: { ...market.pressure, [material]: next } }
}

// amount > 0 buys, amount < 0 sells.
export function trade(state: GameState, material: MaterialName, amount: number): GameState {
  if (state.buildings.market < 1) {
    return { ...state, notice: 'noMarket' }
  }
  const units = Number.isFinite(amount) ? Math.min(marketRules.maxTrade, Math.abs(Math.trunc(amount))) : 0
  if (units === 0 || !MARKET_MATERIALS.includes(material)) {
    return { ...state, notice: 'missing' }
  }
  if (amount > 0) {
    const cost = buyQuote(state, material, units)
    if (state.gold < cost) {
      return { ...state, notice: 'poor' }
    }
    return {
      ...state,
      notice: null,
      gold: state.gold - cost,
      materials: { ...state.materials, [material]: state.materials[material] + units },
      market: shifted(state, material, units),
    }
  }
  if (state.materials[material] < units) {
    return { ...state, notice: 'noMaterial' }
  }
  return {
    ...state,
    notice: null,
    gold: state.gold + sellQuote(state, material, units),
    materials: { ...state.materials, [material]: state.materials[material] - units },
    market: shifted(state, material, -units),
  }
}

function recipeValue(recipeId: string): number {
  const price = marketRules.basePrice
  const smith = smithRules.recipes.find((recipe) => recipe.id === recipeId)
  if (smith) {
    const late = smith as { bone?: number; crystal?: number }
    return smith.gold + smith.wood * price.wood + smith.stone * price.stone + smith.iron * price.iron + (late.bone ?? 0) * price.bone + (late.crystal ?? 0) * price.crystal
  }
  // Trinkets are 'trinket.<id>' (magic.ts).
  const trinket = magicRules.trinkets.find((entry) => `trinket.${entry.id}` === recipeId)
  return trinket ? trinket.gold + trinket.crystal * price.crystal : 0
}

// What a spare piece of gear fetches: part of what it took to make, more when enhanced.
export function gearValue(gear: Gear): number {
  return Math.floor(recipeValue(gear.recipeId) * marketRules.gearSellRatio * (1 + gear.enhance * marketRules.enhanceSellBonus))
}

// What one bottle takes to brew: a batch makes several (review bb1c2cf).
function bottleCost(potionId: string): number {
  const recipe = alchemyRules.potions.find((entry) => entry.id === potionId)
  if (!recipe) {
    return 0
  }
  const price = marketRules.basePrice
  return (recipe.gold + recipe.herb * price.herb + recipe.bone * price.bone) / alchemyRules.batch
}

export function potionValue(potionId: PotionId): number {
  return Math.floor(bottleCost(potionId) * marketRules.potionSellRatio)
}

export function sellGear(state: GameState, gearId: string): GameState {
  if (state.buildings.market < 1) {
    return { ...state, notice: 'noMarket' }
  }
  // Only spare gear in the stash; what heroes wear stays on them.
  const gear = state.stash.find((item) => item.id === gearId)
  if (!gear || gearValue(gear) <= 0) {
    return { ...state, notice: 'missing' }
  }
  return { ...state, notice: null, gold: state.gold + gearValue(gear), stash: state.stash.filter((item) => item.id !== gearId) }
}

export function sellPotion(state: GameState, potionId: PotionId, count: number): GameState {
  if (state.buildings.market < 1) {
    return { ...state, notice: 'noMarket' }
  }
  const have = state.potions[potionId] ?? 0
  const units = Number.isFinite(count) ? Math.min(have, Math.max(0, Math.trunc(count))) : 0
  if (units === 0) {
    return { ...state, notice: 'missing' }
  }
  return { ...state, notice: null, gold: state.gold + potionValue(potionId) * units, potions: { ...state.potions, [potionId]: have - units } }
}

export function merchantHere(state: GameState): Merchant | null {
  const merchant = state.market.merchant
  return merchant && merchant.arriveAt <= state.lastTickAt && state.lastTickAt < merchant.leaveAt ? merchant : null
}

export function buyOffer(state: GameState, offerId: string): GameState {
  const merchant = merchantHere(state)
  if (state.buildings.market < 1 || !merchant) {
    return { ...state, notice: 'noMerchant' }
  }
  const offer = merchant.offers.find((entry) => entry.id === offerId)
  if (!offer || offer.sold) {
    return { ...state, notice: 'soldOut' }
  }
  if (state.gold < offer.price) {
    return { ...state, notice: 'poor' }
  }
  const market = { ...state.market, merchant: { ...merchant, offers: merchant.offers.map((entry) => (entry.id === offerId ? { ...entry, sold: true } : entry)) } }
  const paid = { ...state, notice: null, gold: state.gold - offer.price, market }
  if (offer.kind === 'material') {
    return { ...paid, materials: { ...paid.materials, [offer.material]: paid.materials[offer.material] + offer.amount } }
  }
  if (offer.kind === 'gear') {
    return { ...paid, stash: [...paid.stash, offer.gear] }
  }
  return { ...paid, potions: { ...paid.potions, [offer.potionId]: (paid.potions[offer.potionId] ?? 0) + offer.count } }
}

// The merchant comes every so often and stays a few hours (longer with a
// bigger market). Arrivals missed while away are skipped, not stacked.
export function updateMerchant(state: GameState, now: number): GameState {
  if (state.buildings.market < 1) {
    // No visits before the market opens: the clock waits, and the first
    // merchant comes as it opens (review bb1c2cf).
    return state.market.nextMerchantAt === now ? state : { ...state, market: { ...state.market, merchant: null, nextMerchantAt: now } }
  }
  let market = state.market
  if (market.merchant && market.merchant.leaveAt <= now) {
    market = { ...market, merchant: null }
  }
  if (!market.merchant && market.nextMerchantAt <= now) {
    const every = marketRules.merchant.everyMs
    // The latest arrival that should have happened by now.
    const arriveAt = market.nextMerchantAt + Math.floor((now - market.nextMerchantAt) / every) * every
    const leaveAt = arriveAt + marketRules.merchant.stayMs[level(state)]!
    const nonce = market.merchantNonce + 1
    market = {
      ...market,
      merchantNonce: nonce,
      nextMerchantAt: arriveAt + every,
      merchant: leaveAt > now ? { arriveAt, leaveAt, offers: stockFor(state, nonce) } : null,
    }
  }
  return market === state.market ? state : { ...state, market }
}

function stockFor(state: GameState, nonce: number): MerchantOffer[] {
  const rng = createRng(state.seed + nonce * 7919 + 13)
  const rules = marketRules.merchant
  // The lighthouse brings the merchant with more wares (Docs/endgame.md 4d).
  const count = rules.offers[level(state)]! + lighthouseOffers(state)
  const pick = <T,>(list: readonly T[]): T => list[Math.floor(rng.next() * list.length)]!
  // Gear one step beyond what the smith can make yet, or the best it can.
  const smithLevel = state.buildings.smith
  // Heroic and legendary gear is made only from the vault, never sold for gold (review c89e043).
  const reachable = smithRules.recipes.filter((recipe) => recipe.smithLevel <= Math.max(1, smithLevel + 1) && recipe.smithLevel < 99 && recipe.grade !== 'epic' && recipe.grade !== 'legend')
  const gearPool = reachable.filter((recipe) => recipe.smithLevel === Math.max(...reachable.map((entry) => entry.smithLevel)))
  // Every offer is a different thing: no two of the same blade or bundle.
  type Pick = { kind: 'gear'; recipe: (typeof gearPool)[number] } | { kind: 'potion'; potionId: PotionId } | { kind: 'material'; material: MaterialName }
  let pool: Pick[] = [
    ...gearPool.map((recipe) => ({ kind: 'gear' as const, recipe })),
    ...alchemyRules.potions.map((potion) => ({ kind: 'potion' as const, potionId: potion.id as PotionId })),
    ...(rules.materials as MaterialName[]).map((material) => ({ kind: 'material' as const, material })),
  ]
  const offers: MerchantOffer[] = []
  for (let index = 0; index < count && pool.length > 0; index += 1) {
    const id = `m${nonce}-${index}`
    // The first is always gear and the second materials, when there are any.
    const wanted = index === 0 ? 'gear' : index === 1 ? 'material' : null
    const choices = wanted && pool.some((entry) => entry.kind === wanted) ? pool.filter((entry) => entry.kind === wanted) : pool
    const choice = pick(choices)
    pool = pool.filter((entry) => entry !== choice)
    if (choice.kind === 'gear') {
      const gear = forgeGear(choice.recipe, `${state.seed}-m${nonce}-${index}`, rng.int(2 ** 31))
      offers.push({ id, kind: 'gear', gear, price: Math.ceil(recipeValue(choice.recipe.id) * rules.markup), sold: false })
    } else if (choice.kind === 'potion') {
      const unit = bottleCost(choice.potionId)
      offers.push({ id, kind: 'potion', potionId: choice.potionId, count: rules.potionCount, price: Math.ceil(unit * rules.potionCount * rules.markup), sold: false })
    } else {
      const material = choice.material
      offers.push({ id, kind: 'material', material, amount: rules.bundle, price: Math.ceil(marketRules.basePrice[material] * rules.bundle * rules.markup), sold: false })
    }
  }
  return offers
}
