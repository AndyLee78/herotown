import { nestRules } from './data'
import type { Calendar, GameState } from './game'
import { canDeploy } from './hero'
import { createRng } from './rng'
import type { AffixId, DungeonFloor } from './types'

// The dragon's nest (Docs/depth.md 3d): each season it draws two affixes
// and a lineup per floor. Scouting or buying guild intel reveals them for
// the season; a party that goes in sees them for itself.

export const AFFIX_IDS: AffixId[] = ['venom', 'traps', 'ambush', 'charged', 'silence', 'paralyze', 'swift', 'noRest']
const SEASON_ORDER = ['spring', 'summer', 'autumn', 'winter'] as const

export type NestSeason = {
  key: string
  affixes: AffixId[]
  floors: DungeonFloor[]
}

export type ScoutJob = { heroId: string; finishAt: number }

export function seasonKey(calendar: Calendar): string {
  return `${calendar.year}-${calendar.season}`
}

export function nestSeason(seed: number, calendar: Calendar): NestSeason {
  const rng = createRng(seed * 31 + calendar.year * 1009 + SEASON_ORDER.indexOf(calendar.season) * 97 + 7)
  const pool = [...AFFIX_IDS]
  const affixes: AffixId[] = []
  while (affixes.length < nestRules.affixesPerSeason && pool.length) {
    affixes.push(pool.splice(Math.floor(rng.next() * pool.length), 1)[0]!)
  }
  const floors = nestRules.floors.map((options) => ({ monsters: [...options[Math.floor(rng.next() * options.length)]!] }))
  return { key: seasonKey(calendar), affixes, floors }
}

export function nestRevealed(state: GameState): boolean {
  return state.nestSeen === seasonKey(state.calendar)
}

export function isNest(dungeonId: string): boolean {
  return dungeonId === nestRules.dungeonId
}

// A rogue slips out alone to look; no fight, no cost but their time.
export function startScout(state: GameState, heroId: string, now: number, busy: Set<string>): GameState {
  const hero = state.roster.find((entry) => entry.id === heroId)
  if (!hero || hero.classId !== 'rogue' || !canDeploy(hero) || hero.condition === 'injured' || hero.condition === 'critical') {
    return { ...state, notice: 'scoutHero' }
  }
  if (busy.has(heroId)) {
    return { ...state, notice: 'busyHero' }
  }
  if (state.scout) {
    return { ...state, notice: 'scoutBusy' }
  }
  if (nestRevealed(state)) {
    return { ...state, notice: 'nestKnown' }
  }
  return { ...state, notice: null, scout: { heroId, finishAt: now + nestRules.scoutMs } }
}

export function finishScout(state: GameState, until: number, seasonEnds = false): GameState {
  // A scout due exactly as the season turns reports on the new season (review f47daff).
  if (!state.scout || state.scout.finishAt > until || (seasonEnds && state.scout.finishAt === until)) {
    return state
  }
  const scout = state.roster.find((hero) => hero.id === state.scout?.heroId)
  if (!scout || scout.condition === 'dead') {
    return { ...state, scout: null }
  }
  return { ...state, scout: null, nestSeen: seasonKey(state.calendar) }
}

export function buyIntel(state: GameState): GameState {
  if (state.buildings.guild < 1) {
    return { ...state, notice: 'noGuild' }
  }
  if (nestRevealed(state)) {
    return { ...state, notice: 'nestKnown' }
  }
  if (state.gold < nestRules.intelGold) {
    return { ...state, notice: 'resources' }
  }
  return { ...state, notice: null, gold: state.gold - nestRules.intelGold, nestSeen: seasonKey(state.calendar) }
}

export function readScout(value: unknown): ScoutJob | null {
  if (value == null || typeof value !== 'object') {
    return null
  }
  const job = value as ScoutJob
  return typeof job.heroId === 'string' && typeof job.finishAt === 'number' ? { heroId: job.heroId, finishAt: job.finishAt } : null
}
