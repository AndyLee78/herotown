import { lifeRules, moraleRules } from './data'
import { presetById, type GameState } from './game'
import { guildLevel } from './guild'
import { moraleOf } from './morale'
import type { Condition, Hero } from './types'

// What the battle-prep screen shows about a hero (Docs/house.md, "전투 준비"):
// why they are out, how worn they are, and which parties they belong to.

export type HeroBusy =
  | { kind: 'expedition'; until: number; dungeonId: string; presetId: string }
  | { kind: 'scout'; until: number }
  | { kind: 'drill'; until: number }

export type HeroReadiness = {
  busy: HeroBusy | null
  condition: Condition
  // When the wound heals on its own, and when treatment at the temple ends.
  recoverAt: number | null
  treatAt: number | null
  fatigue: number
  fatigueLevel: 'fresh' | 'tired' | 'exhausted'
  morale: number
  moraleLevel: 'low' | 'normal' | 'high'
  // Preset ids (p1, p2, …) with this hero in a slot, plus 'auto' when auto
  // runs are on and would take this hero.
  parties: string[]
}

export function heroBusy(state: GameState, heroId: string): HeroBusy | null {
  const trip = state.expeditions.find((expedition) => expedition.heroIds.includes(heroId))
  if (trip) {
    return { kind: 'expedition', until: trip.returnAt, dungeonId: trip.dungeonId, presetId: trip.presetId }
  }
  if (state.scout?.heroId === heroId) {
    return { kind: 'scout', until: state.scout.finishAt }
  }
  const drill = (state.drills ?? []).find((entry) => entry.heroId === heroId)
  return drill ? { kind: 'drill', until: drill.finishAt } : null
}

export function partiesOf(state: GameState, heroId: string): string[] {
  const parties = state.presets.filter((preset) => preset.slots.some((slot) => slot.id === heroId)).map((preset) => preset.id)
  if (autoLineups(state).some((slots) => slots.some((slot) => slot.id === heroId))) {
    parties.push('auto')
  }
  return parties
}

// The lineups auto runs send, as the game picks them: the selected preset
// first (the fixed policy's own party in its place), then as many other
// presets as the guild allows (review b1261a7).
function autoLineups(state: GameState): { id: string }[][] {
  const count = guildLevel(state.buildings.guild).autoParties
  if (!state.auto.enabled || count < 1) {
    return []
  }
  const order = [state.presetId, ...state.presets.map((preset) => preset.id).filter((id) => id !== state.presetId)]
  return order
    .map((id) => (state.auto.policy === 'fixed' && id === state.presetId ? state.auto.party : (presetById(state, id)?.slots ?? [])))
    .filter((slots) => slots.length > 0)
    .slice(0, count)
}

export function readiness(state: GameState, hero: Hero): HeroReadiness {
  const { tiredAt, exhaustedAt } = lifeRules.fatigue
  const morale = moraleOf(hero)
  return {
    busy: heroBusy(state, hero.id),
    condition: hero.condition,
    recoverAt: hero.recoverAt ?? null,
    treatAt: hero.treatAt ?? null,
    fatigue: hero.fatigue,
    fatigueLevel: hero.fatigue >= exhaustedAt ? 'exhausted' : hero.fatigue >= tiredAt ? 'tired' : 'fresh',
    morale,
    moraleLevel: morale <= moraleRules.low ? 'low' : morale >= moraleRules.high ? 'high' : 'normal',
    parties: partiesOf(state, hero.id),
  }
}
