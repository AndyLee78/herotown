import { describe, expect, it } from 'vitest'
import { applyAuras, createHeroUnit, simulateFloor } from './combat'
import { classById, progression, trainingRules } from './data'
import { drillTime, drillXp, partyLevel } from './drill'
import { DEFAULT_TACTICS, runDungeon } from './dungeon'
import { busyHeroIds, freshState, migrate, reduce, type GameState } from './game'
import { createHero } from './hero'
import { createRng } from './rng'
import { heroSkillEffects, normalizeLearned, skillPicks } from './skills'
import type { ClassId, Hero, LogEntry } from './types'

// Docs/skills.md: learned skills add effects; the training ground catches heroes up.

const now = 1_700_000_000_000
const stats = { str: 14, agi: 12, vit: 14, int: 12, wil: 12, wis: 14 }
const ids = (classId: ClassId) => classById(classId).skills.map((skill) => skill.id)

function hero(id: string, classId: ClassId, level = 8, learned?: string[]): Hero {
  return createHero({ id, name: id, gender: 'male', classId, age: 25, potentials: stats, level, training: level - 1, learned })
}

describe('learning skills', () => {
  it('opens one pick at Lv3 and another at Lv7, and keeps two of the three', () => {
    expect([1, 3, 6, 7, 20].map(skillPicks)).toEqual([0, 1, 1, 2, 2])
    const [starter, a, b, c] = ids('warrior')
    expect(hero('w', 'warrior', 2).skillPoints).toBe(0)
    expect(hero('w', 'warrior', 3).skillPoints).toBe(1)
    // An older save that learned all three keeps the first two it learned.
    const old = normalizeLearned('warrior', [starter!, c!, a!, b!], 10)
    expect(old).toEqual({ learned: [starter, c, a], skillPoints: 0 })
  })

  it('learns with a point and refuses a third pick', () => {
    const [, a, b, c] = ids('rogue')
    const base = freshState(5, now)
    let state: GameState = { ...base, roster: [hero('r', 'rogue', 7)] }
    state = reduce(state, { type: 'learn', id: 'r', skillId: a! })
    state = reduce(state, { type: 'learn', id: 'r', skillId: b! })
    expect(state.roster[0]?.learned).toEqual([ids('rogue')[0], a, b])
    expect(reduce(state, { type: 'learn', id: 'r', skillId: c! }).notice).toBe('skill')
  })
})

describe('skill effects in battle', () => {
  it('adds nothing for a hero with only the innate skill', () => {
    const plain = createHeroUnit({ hero: hero('w', 'warrior'), row: 'front' }, 0)
    expect(plain.guard).toBe(0)
    expect(plain.volleyEvery).toBe(0)
    expect(heroSkillEffects(hero('w', 'warrior')).attack).toBe(0)
  })

  it('guards, sweeps and weakens when learned', () => {
    const [, taunt, guard, slam] = ids('warrior')
    const warrior = createHeroUnit({ hero: hero('w', 'warrior', 8, [ids('warrior')[0]!, guard!, slam!]), row: 'front' }, 0)
    expect(warrior.guard).toBeGreaterThan(0)
    expect(warrior.volleyEvery).toBeGreaterThan(0)
    expect(taunt).toBeDefined()
    const log: LogEntry[] = []
    simulateFloor([warrior], ['wolf', 'wolf', 'boar'], DEFAULT_TACTICS, createRng(2), log, 1)
    expect(log.some((entry) => entry.key === 'log.volley')).toBe(true)
    const [, , poison] = ids('rogue')
    const rogue = createHeroUnit({ hero: hero('r', 'rogue', 8, [ids('rogue')[0]!, poison!]), row: 'front' }, 0)
    expect(rogue.weaken).toBeGreaterThan(0)
  })

  it('lets purify halve poison and hymn heal everyone a little', () => {
    const [, , , purify] = ids('cleric')
    const cleric = createHeroUnit({ hero: hero('c', 'cleric', 8, [ids('cleric')[0]!, purify!]), row: 'back' }, 1)
    const tank = createHeroUnit({ hero: hero('w', 'warrior'), row: 'front' }, 0)
    tank.hp = Math.round(tank.maxHp * 0.3)
    tank.dot = 12
    const log: LogEntry[] = []
    simulateFloor([tank, cleric], ['slime'], DEFAULT_TACTICS, createRng(1), log, 1)
    expect(log.some((entry) => entry.key === 'log.cleanse')).toBe(true)
    const [, , hymn] = ids('bard')
    const bard = createHeroUnit({ hero: hero('b', 'bard', 8, [ids('bard')[0]!, hymn!]), row: 'back' }, 0)
    expect(bard.regen).toBeGreaterThan(0)
  })

  it('applies party-wide skills when the party sets out, up to a cap', () => {
    const [, , ward] = ids('mage')
    const units = [hero('m1', 'mage', 8, [ids('mage')[0]!, ward!]), hero('m2', 'mage', 8, [ids('mage')[0]!, ward!]), hero('m3', 'mage', 8, [ids('mage')[0]!, ward!]), hero('w', 'warrior')].map((entry, index) =>
      createHeroUnit({ hero: entry, row: 'back' }, index),
    )
    applyAuras(units)
    expect(units[3]!.guard).toBeCloseTo(trainingRules.partyAuraCap.guard)
    // runDungeon applies the same auras to the party it builds.
    const party = [{ hero: hero('m', 'mage', 8, [ids('mage')[0]!, ward!]), row: 'back' as const }, { hero: hero('w', 'warrior'), row: 'front' as const }]
    expect(runDungeon(party, 'hill_cave', DEFAULT_TACTICS, 1).ok).toBe(true)
  })
})

describe('the training ground', () => {
  function town(): GameState {
    const base = freshState(5, now)
    const veterans = ['a', 'b', 'c', 'd', 'e'].map((id) => hero(id, 'warrior', 10))
    return { ...base, gold: 500, buildings: { ...base.buildings, training: 1 }, roster: [...veterans, hero('new', 'archer', 4)] }
  }

  it('catches a hero behind the party up, and gives a caught-up hero little', () => {
    const state = town()
    expect(partyLevel(state)).toBe(10)
    const behind = drillXp(state, state.roster.find((entry) => entry.id === 'new')!)
    const even = drillXp(state, state.roster[0]!)
    expect(behind).toBe(4 * progression.xpPerLevel)
    expect(even).toBeLessThan(10 * progression.xpPerLevel * 0.5)
  })

  it('trains one hero per building level, keeps them busy, and levels them on finishing', () => {
    let state = town()
    expect(reduce({ ...state, buildings: { ...state.buildings, training: 0 } }, { type: 'drill', heroId: 'new', now }).notice).toBe('noTraining')
    state = reduce(state, { type: 'drill', heroId: 'new', now })
    expect(state.notice).toBeNull()
    expect(busyHeroIds(state).has('new')).toBe(true)
    expect(reduce(state, { type: 'drill', heroId: 'a', now }).notice).toBe('trainingFull')
    const done = reduce(state, { type: 'catchUp', now: now + drillTime(state) + 1 })
    expect(done.drills).toEqual([])
    expect(done.roster.find((entry) => entry.id === 'new')!.level).toBe(5)
  })

  it('forgets a learned skill for gold and gives the point back', () => {
    const [starter, a, b] = ids('warrior')
    const state = { ...town(), roster: [hero('w', 'warrior', 8, [starter!, a!, b!])] }
    expect(state.roster[0]!.skillPoints).toBe(0)
    const forgot = reduce(state, { type: 'forget', heroId: 'w', skillId: a! })
    expect(forgot.gold).toBe(state.gold - trainingRules.forgetGold)
    expect(forgot.roster[0]).toMatchObject({ learned: [starter, b], skillPoints: 1 })
    expect(reduce(state, { type: 'forget', heroId: 'w', skillId: starter! }).notice).toBe('skill')
  })

  it('opens a version 13 save with nobody training', () => {
    const old = { ...town(), version: 13 } as Record<string, unknown>
    delete old.drills
    expect(migrate(JSON.parse(JSON.stringify(old)), now).drills).toEqual([])
  })
})
