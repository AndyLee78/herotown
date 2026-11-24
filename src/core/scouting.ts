import { scoutingRules } from './data'
import type { GameState } from './game'
import { createHero, deriveStats } from './hero'
import { seasonKey } from './nest'
import type { Rng } from './rng'
import type { Hero, Stats } from './types'

// Interviews and scouting (Docs/scouting.md): a visitor's potential and
// traits stay hidden until an interview; rare prodigies hide behind
// ordinary stats; promising visitors ask for a bigger village.

export type Interviews = { season: string; used: number }

// What the village knows about a visitor: 0 nothing, 1 potential and
// traits, 2 also the stats at their prime.
export function knowledge(hero: Hero): number {
  return hero.interviewed ?? 0
}

export function freeInterviews(state: GameState): number {
  return Math.max(1, state.buildings.inn * scoutingRules.freePerInnLevel)
}

export function interviewsLeft(state: GameState): number {
  const used = state.interviews?.season === seasonKey(state.calendar) ? state.interviews.used : 0
  return Math.max(0, freeInterviews(state) - used)
}

export function interview(state: GameState, id: string): GameState {
  const visitor = state.visitors.find((hero) => hero.id === id)
  if (!visitor) {
    return { ...state, notice: 'missing' }
  }
  // Each interview goes one step deeper; the second step needs a big inn (review 8e1fa30).
  const most = state.buildings.inn >= scoutingRules.deepInnLevel ? 2 : 1
  if (knowledge(visitor) >= most) {
    return { ...state, notice: 'interviewed' }
  }
  const depth = knowledge(visitor) + 1
  const season = seasonKey(state.calendar)
  const used = state.interviews?.season === season ? state.interviews.used : 0
  const free = used < freeInterviews(state)
  if (!free && state.gold < scoutingRules.interviewGold) {
    return { ...state, notice: 'poor' }
  }
  return {
    ...state,
    notice: null,
    gold: free ? state.gold : state.gold - scoutingRules.interviewGold,
    // Only free interviews count against the allowance (review 8e1fa30).
    interviews: { season, used: free ? used + 1 : used },
    visitors: state.visitors.map((hero) => (hero.id === id ? { ...hero, interviewed: depth } : hero)),
  }
}

// The stats a hero will have at their prime, from what they could become.
export function peakStats(hero: Hero): Stats {
  return deriveStats(scoutingRules.primeAge, hero.training, hero.potentials)
}

// A newly arrived visitor may be a prodigy. Hiring terms were tried and
// dropped: anyone can be hired (Docs/scouting.md, 2026-11-24).
// It draws on its own random stream, so ordinary arrivals stay as they were.
export function arrive(hero: Hero, rng: Rng, townLevel: number): Hero {
  let next = hero
  if (rng.next() < scoutingRules.prodigyChance + scoutingRules.prodigyPerTownLevel * townLevel) {
    // Up to 100, but never below what the visitor already had (review 8e1fa30).
    const potential = Math.max(hero.potential, Math.min(100, hero.potential + scoutingRules.prodigyBoost))
    const lift = (0.75 + potential / 200) / (0.75 + hero.potential / 200)
    const potentials = Object.fromEntries(Object.entries(hero.potentials).map(([key, value]) => [key, Math.max(1, Math.round(value * lift))])) as Stats
    const age = scoutingRules.prodigyAge[0]! + Math.floor(rng.next() * (scoutingRules.prodigyAge[1]! - scoutingRules.prodigyAge[0]! + 1))
    next = { ...createHero({ ...hero, potential, potentials, age }), arrivedAt: hero.arrivedAt, prodigy: true }
  }
  return next
}
