import { describe, expect, it } from 'vitest'
import { scoutingRules, villageRules } from './data'
import { freshState, migrate, reduce, type GameState } from './game'
import { createHero } from './hero'
import { createRng } from './rng'
import { arrive, freeInterviews, interviewsLeft, knowledge, peakStats } from './scouting'
import type { Hero } from './types'

// Docs/scouting.md: interviews, prodigies and hiring terms.

const now = 1_700_000_000_000
const stats = { str: 12, agi: 12, vit: 12, int: 12, wil: 12, wis: 12 }

function visitor(id: string, extra: Partial<Hero> = {}): Hero {
  return { ...createHero({ id, name: id, gender: 'male', classId: 'archer', age: 17, potentials: stats, potential: 60 }), arrivedAt: now, ...extra }
}

function town(extra: Partial<GameState> = {}): GameState {
  return { ...freshState(5, now), gold: 500, visitors: [visitor('v1'), visitor('v2'), visitor('v3')], ...extra }
}

describe('interviews', () => {
  it('reveal a visitor, free up to the inn level each season, then for gold', () => {
    let state = town()
    expect(knowledge(state.visitors[0]!)).toBe(0)
    expect(interviewsLeft(state)).toBe(freeInterviews(state))
    state = reduce(state, { type: 'interview', id: 'v1' })
    expect(knowledge(state.visitors[0]!)).toBe(1)
    expect(state.gold).toBe(500)
    expect(reduce(state, { type: 'interview', id: 'v1' }).notice).toBe('interviewed')
    for (let i = 1; i < freeInterviews(state); i += 1) state = reduce(state, { type: 'interview', id: `v${i + 1}` })
    expect(interviewsLeft(state)).toBe(0)
    const paid = reduce(state, { type: 'interview', id: 'v3' })
    expect(paid.gold).toBe(state.gold - scoutingRules.interviewGold)
    const nextSeason = { ...state, calendar: { ...state.calendar, season: state.calendar.season === 'winter' ? ('spring' as const) : ('winter' as const) } }
    expect(interviewsLeft(nextSeason)).toBe(freeInterviews(state))
  })

  it('goes deeper at a big inn, showing the stats at the prime', () => {
    const base = town()
    const once = reduce({ ...base, buildings: { ...base.buildings, inn: scoutingRules.deepInnLevel } }, { type: 'interview', id: 'v1' })
    expect(knowledge(once.visitors[0]!)).toBe(1)
    const state = reduce(once, { type: 'interview', id: 'v1' })
    expect(knowledge(state.visitors[0]!)).toBe(2)
    const young = state.visitors[0]!
    expect(peakStats(young).str).toBeGreaterThan(young.stats.str)
  })
})

describe('prodigies and terms', () => {
  it('makes some arrivals young prodigies on a separate random stream', () => {
    const plain = visitor('p')
    let found: Hero | null = null
    for (let seed = 1; seed < 500 && !found; seed += 1) {
      const made = arrive(plain, createRng(seed), 1)
      if (made.prodigy) found = made
    }
    expect(found).not.toBeNull()
    expect(found!.potential).toBe(Math.min(100, plain.potential + scoutingRules.prodigyBoost))
    expect(found!.age).toBeGreaterThanOrEqual(scoutingRules.prodigyAge[0]!)
    expect(found!.age).toBeLessThanOrEqual(scoutingRules.prodigyAge[1]!)
    expect(found!.potentials.str).toBeGreaterThan(plain.potentials.str)
  })

  it('sets terms for promising visitors and refuses to join a small village', () => {
    const promising = arrive(visitor('g', { potential: 75 }), createRng(1_000_003), 0)
    const expected = scoutingRules.terms.find((term) => promising.potential >= term.potential)?.townLevel
    expect(promising.terms).toBe(expected)
    const state = { ...town(), visitors: [promising] }
    expect(reduce(state, { type: 'hire', id: 'g' }).notice).toBe('hireTown')
    const fame = villageRules.levels.find((level) => level.level === expected)!.fame
    expect(reduce({ ...state, fame }, { type: 'hire', id: 'g' }).roster.some((hero) => hero.id === 'g')).toBe(true)
  })

  it('lets the first visitors join without terms', () => {
    expect(freshState(5, now).visitors.every((hero) => hero.terms == null && !hero.prodigy)).toBe(true)
  })
})

describe('saves', () => {
  it('keeps visitors of a version 17 save known and starts with no interviews used', () => {
    const old = { ...town(), version: 17 } as Record<string, unknown>
    delete old.interviews
    const loaded = migrate(JSON.parse(JSON.stringify(old)), now)
    expect(loaded.interviews).toBeNull()
    expect(loaded.visitors.every((hero) => knowledge(hero) === 1)).toBe(true)
  })
})

describe('review 8e1fa30 fixes', () => {
  it('counts only free interviews, so a bigger inn opens more at once', () => {
    let state = town()
    state = reduce(state, { type: 'interview', id: 'v1' })
    state = reduce(state, { type: 'interview', id: 'v2' })
    expect(state.gold).toBe(500 - scoutingRules.interviewGold)
    const bigger = { ...state, buildings: { ...state.buildings, inn: state.buildings.inn + 1 } }
    expect(interviewsLeft(bigger)).toBe(1)
    expect(reduce(bigger, { type: 'interview', id: 'v3' }).gold).toBe(bigger.gold)
  })

  it('never lowers the potential of a visitor already past 100', () => {
    let found: Hero | null = null
    for (let seed = 1; seed < 500 && !found; seed += 1) {
      const made = arrive(visitor('x', { potential: 110 }), createRng(seed), 1)
      if (made.prodigy) found = made
    }
    expect(found?.potential).toBe(110)
  })

  it('keeps the visitors of a version 1 save known', () => {
    const old = { ...town(), version: 1 } as Record<string, unknown>
    const loaded = migrate(JSON.parse(JSON.stringify(old)), now)
    expect(loaded.visitors.length).toBeGreaterThan(0)
    expect(loaded.visitors.every((hero) => knowledge(hero) >= 1)).toBe(true)
  })
})

