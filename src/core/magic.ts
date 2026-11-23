import { magicRules, retirementRules, trinketById } from './data'
import type { GameState } from './game'
import type { Gear, Hero, TrinketId } from './types'

// The magic workshop and its trinkets (Docs/depth.md 3b). A trinket is gear
// in the shared stash with slot 'trinket'; a hero wears up to two.

export type MagicJob = {
  trinketId: TrinketId
  finishAt: number
}

export const TRINKET_IDS: TrinketId[] = ['alert', 'trapSense', 'poisonWard', 'steady', 'calm']

export function trinketRecipe(id: TrinketId): string {
  return `trinket.${id}`
}

export function trinketOf(item: Gear): TrinketId | null {
  if (item.slot !== 'trinket') {
    return null
  }
  const id = item.recipeId.replace(/^trinket\./, '') as TrinketId
  return TRINKET_IDS.includes(id) ? id : null
}

// What a hero's trinkets do; the same trinket twice counts once.
export function heroTrinkets(hero: Hero): Set<TrinketId> {
  const worn = new Set<TrinketId>()
  for (const item of hero.gear) {
    const id = trinketOf(item)
    if (id) {
      worn.add(id)
    }
  }
  return worn
}

export function enchantTime(state: GameState, trinketId: TrinketId): number {
  const trinket = trinketById(trinketId)
  const kept = (state.retirees ?? []).some((retiree) => retiree.building === 'magic')
  const speed = magicRules.speedByLevel[Math.max(0, Math.min(magicRules.speedByLevel.length, state.buildings.magic) - 1)] ?? 1
  return Math.round((trinket?.ms ?? 0) * speed * (1 - (kept ? retirementRules.bonus.magic : 0)))
}

export function startEnchant(state: GameState, trinketId: TrinketId, now: number): GameState {
  const trinket = trinketById(trinketId)
  if (state.buildings.magic < 1) {
    return { ...state, notice: 'noMagic' }
  }
  if (state.magic) {
    return { ...state, notice: 'magicBusy' }
  }
  if (!trinket) {
    return { ...state, notice: 'recipe' }
  }
  if (state.buildings.magic < trinket.magicLevel) {
    return { ...state, notice: 'locked' }
  }
  if (state.gold < trinket.gold || state.materials.crystal < trinket.crystal) {
    return { ...state, notice: 'resources' }
  }
  return {
    ...state,
    notice: null,
    gold: state.gold - trinket.gold,
    materials: { ...state.materials, crystal: state.materials.crystal - trinket.crystal },
    magic: { trinketId, finishAt: now + enchantTime(state, trinketId) },
  }
}

export function finishEnchant(state: GameState, now: number, made: string[]): GameState {
  if (!state.magic || state.magic.finishAt > now) {
    return state
  }
  const craftNonce = state.craftNonce + 1
  const id = state.magic.trinketId
  made.push(trinketRecipe(id))
  const item: Gear = { id: `${state.seed}-t${craftNonce}`, recipeId: trinketRecipe(id), slot: 'trinket', grade: 'common', enhance: 0 }
  return { ...state, magic: null, craftNonce, stash: [...state.stash, item] }
}

export function readMagicJob(value: unknown): MagicJob | null {
  if (value == null || typeof value !== 'object') {
    return null
  }
  const job = value as MagicJob
  return TRINKET_IDS.includes(job.trinketId) && typeof job.finishAt === 'number' ? { trinketId: job.trinketId, finishAt: job.finishAt } : null
}
