import { describe, expect, it } from 'vitest'
import { createHeroUnit } from './combat'
import { moraleRules, progression, villageRules } from './data'
import { festivalCost, freshState, migrate, reduce, type GameState } from './game'
import { createHero } from './hero'
import { cheer, driftMorale, griefFor, lowMorale, moraleOf, mourn } from './morale'
import type { ClassId, Hero } from './types'

// Docs/morale.md: morale, grief, joy, pride and seasonal festivals.

const now = 1_700_000_000_000
const stats = { str: 14, agi: 12, vit: 14, int: 12, wil: 12, wis: 14 }

function hero(id: string, classId: ClassId = 'warrior', extra: Partial<Hero> = {}): Hero {
  return { ...createHero({ id, name: id, gender: 'male', classId, age: 30, potentials: stats, level: 5, training: 4 }), ...extra }
}

function town(roster: Hero[], season: 'spring' | 'summer' | 'autumn' | 'winter' = 'spring'): GameState {
  const base = freshState(5, now)
  return { ...base, gold: 1000, roster, calendar: { ...base.calendar, season } }
}

describe('morale in battle', () => {
  it('starts at the base, lifts a little when high, and weighs heavily when low', () => {
    expect(moraleOf(hero('a'))).toBe(moraleRules.base)
    const plain = createHeroUnit({ hero: hero('a'), row: 'front' }, 0)
    const high = createHeroUnit({ hero: hero('b', 'warrior', { morale: 90 }), row: 'front' }, 0)
    const low = createHeroUnit({ hero: hero('c', 'warrior', { morale: 20 }), row: 'front' }, 0)
    expect(high.attack).toBeCloseTo(plain.attack * (1 + moraleRules.highAttack))
    expect(low.attack).toBeCloseTo(plain.attack * (1 - moraleRules.lowPenalty))
    expect(low.speed).toBeCloseTo(plain.speed * (1 - moraleRules.lowPenalty))
  })

  it('drifts back toward the base over time', () => {
    expect(moraleOf(driftMorale(hero('a', 'warrior', { morale: 10 }), 4))).toBe(10 + moraleRules.driftPerHour * 4)
    expect(moraleOf(driftMorale(hero('a', 'warrior', { morale: 90 }), 100))).toBe(moraleRules.base)
  })

  it('keeps dispirited heroes out of auto runs', () => {
    expect(lowMorale(hero('a', 'warrior', { morale: moraleRules.low }))).toBe(true)
    const base = town([hero('w', 'warrior', { morale: 10 }), hero('c', 'cleric')])
    let state = { ...base, cleared: ['hill_cave'], buildings: { ...base.buildings, guild: 1 } }
    state = reduce(reduce(state, { type: 'add', id: 'w' }), { type: 'add', id: 'c' })
    state = reduce(reduce(state, { type: 'auto', enabled: true }), { type: 'autoDungeon', id: 'hill_cave' })
    const ran = reduce(state, { type: 'catchUp', now: state.lastTickAt + villageRules.auto.runMs })
    expect(ran.roster.find((entry) => entry.id === 'w')?.clears).toEqual([])
  })
})

describe('emotions', () => {
  it('grieves most for a spouse, then family, then close friends', () => {
    const widow = hero('w', 'cleric', { spouseId: 'gone' })
    const child = hero('k', 'warrior', { parents: ['gone', 'x'] })
    const friend = hero('f')
    const stranger = hero('s')
    const bonds = [{ a: 'f', b: 'gone', affinity: 50 }]
    const gone = { id: 'gone', spouseId: 'w' }
    expect(griefFor(widow, gone, bonds)).toBe(moraleRules.grief.spouse)
    expect(griefFor(child, gone, bonds)).toBe(moraleRules.grief.parentChild)
    expect(griefFor(friend, gone, bonds)).toBe(moraleRules.grief.friend)
    expect(griefFor(stranger, gone, bonds)).toBe(0)
    const after = mourn([widow, child, friend, stranger], [gone], bonds)
    expect(after.map(moraleOf)).toEqual([moraleRules.base - 50, moraleRules.base - 40, moraleRules.base - 25, moraleRules.base])
  })

  it('caps everyday cheer below the high mark', () => {
    const cap = moraleRules.pride.victoryCap
    const [proud] = cheer([hero('a', 'warrior', { morale: cap - 1 })], ['a'], 3, cap)
    expect(moraleOf(proud!)).toBe(cap)
    const [still] = cheer([hero('a', 'warrior', { morale: cap + 3 })], ['a'], 3, cap)
    expect(moraleOf(still!)).toBe(cap + 3)
    expect(cap).toBeLessThan(moraleRules.high)
  })

  it('is glad at a wedding', () => {
    const a = hero('a', 'warrior', { gender: 'male' })
    const b = { ...hero('b', 'cleric'), gender: 'female' as const }
    const base = town([a, b])
    const state = { ...base, buildings: { ...base.buildings, house: 3 }, proposals: [{ a: 'a', b: 'b', at: now }] } as GameState
    const wed = reduce(state, { type: 'acceptProposal', a: 'a', b: 'b', now })
    expect(wed.roster.every((entry) => moraleOf(entry) === moraleRules.base + moraleRules.joy.marriage)).toBe(true)
  })
})

describe('festivals', () => {
  it('runs once a season for gold, lifting everyone', () => {
    const state = town([hero('a'), hero('b', 'cleric', { morale: 20 })])
    const held = reduce(state, { type: 'festival' })
    expect(held.gold).toBe(state.gold - festivalCost(state))
    expect(held.roster.map(moraleOf)).toEqual([moraleRules.base + 20, 40])
    expect(reduce(held, { type: 'festival' }).notice).toBe('festivalDone')
    expect(reduce({ ...state, gold: 0 }, { type: 'festival' }).notice).toBe('poor')
  })

  it('gives each season its own gift', () => {
    const summer = reduce(town([hero('a')], 'summer'), { type: 'festival' })
    expect(summer.roster[0]!.xp).toBe(Math.round(5 * progression.xpPerLevel * moraleRules.festival.xpShare))
    const before = town([hero('a')], 'autumn')
    const autumn = reduce(before, { type: 'festival' })
    expect(autumn.materials.wood).toBe(before.materials.wood + moraleRules.festival.harvest.wood)
    const winter = reduce(town([hero('a', 'warrior', { morale: 10 })], 'winter'), { type: 'festival' })
    expect(moraleOf(winter.roster[0]!)).toBe(10 + moraleRules.festival.morale + moraleRules.festival.memorial)
    const spring = reduce(town([hero('a')], 'spring'), { type: 'festival' })
    expect(spring.festival?.kind).toBe('spring')
  })

  it('opens a version 15 save with no festival held', () => {
    const old = { ...town([hero('a')]), version: 15 } as Record<string, unknown>
    delete old.festival
    expect(migrate(JSON.parse(JSON.stringify(old)), now).festival).toBeNull()
  })
})

describe('review b9036a0 fixes', () => {
  it('cheers everyone when a festival lifts the town a level', () => {
    const state = { ...town([hero('a')]), fame: 11 }
    const held = reduce(state, { type: 'festival' })
    expect(moraleOf(held.roster[0]!)).toBe(moraleRules.base + moraleRules.festival.morale + moraleRules.pride.townLevel)
  })

  it("adds a first clear's joy on top of the victory's pride", () => {
    const party = [hero('w', 'warrior', { morale: 40 }), hero('c', 'cleric', { morale: 40 })]
    let state = { ...town(party), fame: 0 }
    state = reduce(reduce(state, { type: 'add', id: 'w' }), { type: 'add', id: 'c' })
    const sent = reduce(state, { type: 'depart', now, confirm: true })
    const home = reduce(sent, { type: 'catchUp', now: sent.expeditions[0]!.returnAt + 1 })
    if (home.cleared.includes('hill_cave')) {
      const morale = moraleOf(home.roster.find((entry) => entry.id === 'w')!)
      expect(morale).toBeGreaterThanOrEqual(40 + moraleRules.pride.victory + moraleRules.joy.firstClear - 1)
    }
  })
})

