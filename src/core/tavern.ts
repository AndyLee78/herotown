import { retirementRules, tavernRules } from './data'
import type { GameState } from './game'
import { isChild } from './hero'
import { seasonKey } from './nest'
import { affinityScale, feel } from './personality'
import type { Bond, Hero } from './types'

// The tavern (Docs/tavern.md): drinks the player sets up, a little more
// mingling every season, and a bigger festival out front.

// `last` is the latest round, for the village scene to show (Docs/tavern.md).
export type TavernState = { season: string; used: number; last?: { heroIds: string[]; at: number } }

function level(state: GameState): number {
  return Math.min(tavernRules.sessionsPerSeason.length, state.buildings.tavern)
}

export function gatherLeft(state: GameState): number {
  const lvl = level(state)
  if (lvl < 1) {
    return 0
  }
  const used = state.tavern && state.tavern.season === seasonKey(state.calendar) ? state.tavern.used : 0
  return Math.max(0, tavernRules.sessionsPerSeason[lvl - 1]! - used)
}

// What each pair would gain from a round together.
export function gatherPreview(state: GameState, heroIds: string[]): { a: string; b: string; affinity: number }[] {
  const heroes = heroIds.map((id) => state.roster.find((hero) => hero.id === id)).filter((hero): hero is Hero => hero != null)
  const kept = (state.retirees ?? []).some((retiree) => retiree.building === 'tavern')
  const base = tavernRules.affinity * (1 + (kept ? retirementRules.bonus.tavern : 0))
  const pairs: { a: string; b: string; affinity: number }[] = []
  for (let i = 0; i < heroes.length; i += 1) {
    for (let j = i + 1; j < heroes.length; j += 1) {
      pairs.push({ a: heroes[i]!.id, b: heroes[j]!.id, affinity: base * affinityScale(heroes[i]!, heroes[j]!) })
    }
  }
  return pairs
}

function raise(bonds: Bond[], a: string, b: string, amount: number): Bond[] {
  const [first, second] = a < b ? [a, b] : [b, a]
  const found = bonds.find((bond) => bond.a === first && bond.b === second)
  if (!found) {
    return [...bonds, { a: first, b: second, affinity: Math.min(100, amount) }]
  }
  return bonds.map((bond) => (bond === found ? { ...bond, affinity: Math.min(100, bond.affinity + amount) } : bond))
}

export function gather(state: GameState, heroIds: string[], busy: Set<string>): GameState {
  if (level(state) < 1) {
    return { ...state, notice: 'noTavern' }
  }
  const ids = [...new Set(heroIds)]
  if (ids.length < tavernRules.minPeople || ids.length > tavernRules.maxPeople) {
    return { ...state, notice: 'gatherSize' }
  }
  const heroes = ids.map((id) => state.roster.find((hero) => hero.id === id))
  if (heroes.some((hero) => !hero || isChild(hero) || hero.condition === 'dead')) {
    return { ...state, notice: 'missing' }
  }
  if (ids.some((id) => busy.has(id))) {
    return { ...state, notice: 'busyHero' }
  }
  if (gatherLeft(state) < 1) {
    return { ...state, notice: 'tavernFull' }
  }
  if (state.gold < tavernRules.cost) {
    return { ...state, notice: 'poor' }
  }
  let bonds = state.bonds ?? []
  for (const pair of gatherPreview(state, ids)) {
    bonds = raise(bonds, pair.a, pair.b, pair.affinity)
  }
  const together = new Set(ids)
  const roster = state.roster.map((hero) =>
    together.has(hero.id) ? { ...feel(hero, 'joy', tavernRules.joy), fatigue: Math.min(100, hero.fatigue + tavernRules.fatigue) } : hero,
  )
  const season = seasonKey(state.calendar)
  const used = state.tavern && state.tavern.season === season ? state.tavern.used + 1 : 1
  // Two rounds between ticks still get different stamps, so the scene sees both (review 161d1d1).
  const at = Math.max(state.lastTickAt, (state.tavern?.last?.at ?? 0) + 1)
  return { ...state, notice: null, gold: state.gold - tavernRules.cost, bonds, roster, tavern: { season, used, last: { heroIds: ids, at } } }
}

// Extra affinity each season for neighbours who mingle at the tavern.
export function mingle(state: GameState): number {
  return level(state) * tavernRules.minglePerLevel
}

// How much bigger a festival is with the tavern hosting it.
export function festivalScale(state: GameState): number {
  const lvl = level(state)
  return lvl < 1 ? 1 : tavernRules.festivalScale[lvl - 1]!
}
