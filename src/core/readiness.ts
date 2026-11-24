import { lifeRules, moraleRules } from './data'
import type { GameState } from './game'
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
  // When treatment or rest from an injury ends, if it is under way.
  recoverAt: number | null
  fatigue: number
  fatigueLevel: 'fresh' | 'tired' | 'exhausted'
  morale: number
  moraleLevel: 'low' | 'normal' | 'high'
  // Preset ids (p1, p2, …) with this hero in a slot, plus 'auto' for the auto-run party.
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
  if ((state.auto.party ?? []).some((slot) => slot.id === heroId)) {
    parties.push('auto')
  }
  return parties
}

export function readiness(state: GameState, hero: Hero): HeroReadiness {
  const { tiredAt, exhaustedAt } = lifeRules.fatigue
  const morale = moraleOf(hero)
  return {
    busy: heroBusy(state, hero.id),
    condition: hero.condition,
    recoverAt: hero.recoverAt ?? null,
    fatigue: hero.fatigue,
    fatigueLevel: hero.fatigue >= exhaustedAt ? 'exhausted' : hero.fatigue >= tiredAt ? 'tired' : 'fresh',
    morale,
    moraleLevel: morale <= moraleRules.low ? 'low' : morale >= moraleRules.high ? 'high' : 'normal',
    parties: partiesOf(state, hero.id),
  }
}
