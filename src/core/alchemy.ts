import { alchemyRules, potionById, retirementRules } from './data'
import type { GameState } from './game'
import type { PotionId, Supplies } from './types'

// The alchemy workshop and the village potion stock (Docs/depth.md 3a).
// Potions are brewed in batches, kept in the village, carried on an
// expedition and returned if unused.

export type AlchemyJob = {
  potionId: PotionId
  finishAt: number
}

export const POTION_IDS: PotionId[] = ['heal', 'antidote', 'tonic', 'clarity']

export function brewTime(state: GameState, potionId: PotionId): number {
  const potion = potionById(potionId)
  const kept = (state.retirees ?? []).some((retiree) => retiree.building === 'alchemy')
  // A bigger workshop brews faster (Docs/depth.md 3a), and a retiree keeper faster still.
  const speed = alchemyRules.speedByLevel[Math.max(0, Math.min(alchemyRules.speedByLevel.length, state.buildings.alchemy) - 1)] ?? 1
  return Math.round((potion?.ms ?? 0) * speed * (1 - (kept ? retirementRules.bonus.alchemy : 0)))
}

export function startBrew(state: GameState, potionId: PotionId, now: number): GameState {
  const potion = potionById(potionId)
  if (state.buildings.alchemy < 1) {
    return { ...state, notice: 'noAlchemy' }
  }
  if (state.alchemy) {
    return { ...state, notice: 'alchemyBusy' }
  }
  if (!potion) {
    return { ...state, notice: 'recipe' }
  }
  if (state.buildings.alchemy < potion.alchemyLevel) {
    return { ...state, notice: 'locked' }
  }
  if (state.gold < potion.gold || state.materials.herb < potion.herb || state.materials.bone < potion.bone) {
    return { ...state, notice: 'resources' }
  }
  return {
    ...state,
    notice: null,
    gold: state.gold - potion.gold,
    materials: { ...state.materials, herb: state.materials.herb - potion.herb, bone: state.materials.bone - potion.bone },
    alchemy: { potionId, finishAt: now + brewTime(state, potionId) },
  }
}

export function finishBrew(state: GameState, now: number, brewed: string[]): GameState {
  if (!state.alchemy || state.alchemy.finishAt > now) {
    return state
  }
  const id = state.alchemy.potionId
  brewed.push(id)
  return { ...state, alchemy: null, potions: addSupplies(state.potions, { [id]: alchemyRules.batch }) }
}

// What a party asks to carry, cut to the stock and the per-trip limit.
export function takeSupplies(stock: Supplies, wanted: Supplies = {}): { stock: Supplies; taken: Supplies } {
  let room = alchemyRules.potionsPerTrip
  const taken: Supplies = {}
  const left: Supplies = { ...stock }
  for (const id of POTION_IDS) {
    const count = Math.max(0, Math.min(wanted[id] ?? 0, left[id] ?? 0, room))
    if (count > 0) {
      taken[id] = count
      left[id] = (left[id] ?? 0) - count
      room -= count
    }
  }
  return { stock: left, taken }
}

// Unused potions go back to the stock.
export function returnSupplies(stock: Supplies, taken: Supplies = {}, used: Supplies = {}): Supplies {
  const back: Supplies = {}
  for (const id of POTION_IDS) {
    const left = (taken[id] ?? 0) - (used[id] ?? 0)
    if (left > 0) {
      back[id] = left
    }
  }
  return addSupplies(stock, back)
}

export function addSupplies(stock: Supplies, more: Supplies): Supplies {
  const next: Supplies = { ...stock }
  for (const id of POTION_IDS) {
    if (more[id]) {
      next[id] = (next[id] ?? 0) + (more[id] ?? 0)
    }
  }
  return next
}

export function readSupplies(value: unknown): Supplies {
  const supplies: Supplies = {}
  if (value == null || typeof value !== 'object') {
    return supplies
  }
  for (const id of POTION_IDS) {
    const count = (value as Record<string, unknown>)[id]
    if (typeof count === 'number' && Number.isFinite(count) && count > 0) {
      supplies[id] = Math.floor(count)
    }
  }
  return supplies
}

export function readAlchemyJob(value: unknown): AlchemyJob | null {
  if (value == null || typeof value !== 'object') {
    return null
  }
  const job = value as AlchemyJob
  return POTION_IDS.includes(job.potionId) && typeof job.finishAt === 'number' ? { potionId: job.potionId, finishAt: job.finishAt } : null
}
