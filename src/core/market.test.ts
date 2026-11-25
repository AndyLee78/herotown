import { describe, expect, it } from 'vitest'
import { marketRules, smithRules } from './data'
import { freshState, migrate, reduce, type GameState } from './game'
import { forgeGear } from './gear'
import { buyQuote, gearValue, merchantHere, potionValue, pressureOf, seasonDeal, sellQuote, updateMerchant } from './market'

// Docs/market.md: trading materials, selling spares, the wandering merchant.

const now = 1_700_000_000_000

function town(extra: Partial<GameState> = {}, market = 1): GameState {
  const base = freshState(5, now)
  return { ...base, gold: 5000, materials: { ...base.materials, wood: 200, crystal: 50 }, buildings: { ...base.buildings, market }, ...extra }
}

describe('material trade', () => {
  it('needs a market', () => {
    expect(reduce(town({}, 0), { type: 'trade', material: 'wood', amount: 5 }).notice).toBe('noMarket')
  })

  it('buys and sells, and the price moves with each unit', () => {
    const state = town()
    const bought = reduce(state, { type: 'trade', material: 'iron', amount: 20 })
    expect(bought.materials.iron).toBe(state.materials.iron + 20)
    expect(bought.gold).toBe(state.gold - buyQuote(state, 'iron', 20))
    expect(pressureOf(bought, 'iron')).toBeCloseTo(20 * marketRules.pressurePerUnit)
    expect(buyQuote(bought, 'iron', 1)).toBeGreaterThanOrEqual(buyQuote(state, 'iron', 1))
    const sold = reduce(state, { type: 'trade', material: 'wood', amount: -50 })
    expect(sold.materials.wood).toBe(150)
    expect(sold.gold).toBe(state.gold + sellQuote(state, 'wood', 50))
    expect(reduce(state, { type: 'trade', material: 'herb', amount: -1 }).notice).toBe('noMaterial')
  })

  it('never pays more for selling than buying the same units costs', () => {
    const state = town()
    for (const material of ['wood', 'stone', 'iron', 'bone', 'herb', 'crystal'] as const) {
      const bought = reduce(state, { type: 'trade', material, amount: 30 })
      expect(sellQuote(bought, material, 30)).toBeLessThan(buyQuote(state, material, 30))
    }
  })

  it('lets prices ease back over time', () => {
    const pushed = reduce(town(), { type: 'trade', material: 'iron', amount: 50 })
    const later = { ...pushed, lastTickAt: pushed.lastTickAt + 10 * 3_600_000 }
    expect(pressureOf(later, 'iron')).toBeLessThan(pressureOf(pushed, 'iron') / 10)
  })

  it('has a seasonal deal on two different materials', () => {
    const deal = seasonDeal(town())
    expect(deal.cheap).not.toBe(deal.wanted)
    const state = town()
    expect(buyQuote(state, deal.cheap, 10)).toBeLessThan(Math.ceil(marketRules.basePrice[deal.cheap] * 10 * 1.1))
  })
})

describe('selling spares', () => {
  it('sells stash gear but not what heroes wear, and potions', () => {
    const blade = forgeGear(smithRules.recipes.find((recipe) => recipe.id === 'fine.blade')!, 'g1')
    const state = town({ stash: [blade], potions: { heal: 3 } })
    const sold = reduce(state, { type: 'sellGear', gearId: 'g1' })
    expect(sold.stash).toHaveLength(0)
    expect(sold.gold).toBe(state.gold + gearValue(blade))
    expect(gearValue({ ...blade, enhance: 2 })).toBeGreaterThan(gearValue(blade))
    expect(reduce(state, { type: 'sellGear', gearId: 'nope' }).notice).toBe('missing')
    const potions = reduce(state, { type: 'sellPotion', potionId: 'heal', count: 2 })
    expect(potions.potions.heal).toBe(1)
    expect(potions.gold).toBe(state.gold + 2 * potionValue('heal'))
  })
})

describe('the wandering merchant', () => {
  it('arrives on time, stays a while with offers, and leaves', () => {
    const state = town()
    const arrived = updateMerchant({ ...state, lastTickAt: state.market.nextMerchantAt }, state.market.nextMerchantAt)
    const merchant = merchantHere(arrived)!
    expect(merchant.offers).toHaveLength(marketRules.merchant.offers[0]!)
    expect(merchant.leaveAt - merchant.arriveAt).toBe(marketRules.merchant.stayMs[0])
    const offer = merchant.offers[0]!
    const bought = reduce(arrived, { type: 'buyOffer', offerId: offer.id })
    expect(bought.gold).toBe(arrived.gold - offer.price)
    expect(reduce(bought, { type: 'buyOffer', offerId: offer.id }).notice).toBe('soldOut')
    const gone = updateMerchant({ ...bought, lastTickAt: merchant.leaveAt }, merchant.leaveAt)
    expect(merchantHere(gone)).toBeNull()
    expect(reduce(gone, { type: 'buyOffer', offerId: offer.id }).notice).toBe('noMerchant')
  })

  it('comes through the catch-up and skips visits missed while away', () => {
    const state = town()
    const back = reduce(state, { type: 'catchUp', now: state.market.nextMerchantAt + 3 * marketRules.merchant.everyMs + 1000 })
    expect(merchantHere(back)).not.toBeNull()
    expect(back.market.merchantNonce).toBe(1)
  })
})

describe('saves', () => {
  it('opens a version 19 save with a fresh market', () => {
    const old = { ...town({}, 0), version: 19 } as Record<string, unknown>
    delete old.market
    const opened = migrate(JSON.parse(JSON.stringify(old)), now)
    expect(opened.market.merchant).toBeNull()
    expect(opened.buildings.market).toBe(0)
  })
})
