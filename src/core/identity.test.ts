import { describe, expect, it } from 'vitest'
import { applyAuras, createHeroUnit, simulateFloor, type BattleUnit } from './combat'
import { classById, combatRules, giftRules, personalityRules, progression } from './data'
import { DEFAULT_TACTICS, gainXp, runDungeon, tripFatigue } from './dungeon'
import { inheritGift } from './family'
import { freshState, migrate, reduce, type GameState } from './game'
import { createHero, generateVisitors, rollGift } from './hero'
import { createRng } from './rng'
import { canLearn, heroSkillEffects, masteries } from './skills'
import type { ClassId, GiftId, Hero, LogEntry, PersonalityId } from './types'

// Docs/identity.md 5a: skill branches, masteries, personality fit, conditions,
// inborn gifts, and monsters with kinds and traits.

const now = 1_700_000_000_000
const stats = { str: 16, agi: 14, vit: 16, int: 14, wil: 14, wis: 16 }

function hero(id: string, classId: ClassId, level = 25, learned: string[] = [], extra: Partial<Hero> = {}): Hero {
  const starter = classById(classId).skills[0]!.id
  return createHero({ id, name: id, gender: 'female', classId, age: 25, potentials: stats, level, training: level - 1, learned: [starter, ...learned], personality: 'loner', ...extra })
}

function unit(entry: Hero, index = 0, row: 'front' | 'back' = 'front'): BattleUnit {
  return createHeroUnit({ hero: entry, row }, index)
}

function keys(heroes: BattleUnit[], monsters: string[], seed = 1, scale = 1): LogEntry[] {
  const log: LogEntry[] = []
  simulateFloor(heroes, monsters, DEFAULT_TACTICS, createRng(seed), log, 1, undefined, scale)
  return log
}

function seen(make: () => BattleUnit[], monsters: string[], key: string, scale = 1): boolean {
  for (let seed = 1; seed <= 12; seed += 1) {
    if (keys(make(), monsters, seed, scale).some((entry) => entry.key === key)) {
      return true
    }
  }
  return false
}

describe('skill branches', () => {
  it('has ten skills a class: the innate one and three branches of three', () => {
    for (const id of ['warrior', 'rogue', 'archer', 'mage', 'cleric', 'bard', 'dancer'] as ClassId[]) {
      const klass = classById(id)
      expect(klass.skills).toHaveLength(10)
      expect(klass.branches).toHaveLength(3)
    }
  })

  it('learns a branch step by step', () => {
    const fresh = hero('w', 'warrior', 25)
    expect(canLearn(fresh, 'warrior.wall')).toBe(false)
    expect(canLearn(fresh, 'warrior.guard')).toBe(true)
    let state: GameState = { ...freshState(5, now), roster: [fresh] }
    expect(reduce(state, { type: 'learn', id: 'w', skillId: 'warrior.wall' }).notice).toBe('skill')
    state = reduce(state, { type: 'learn', id: 'w', skillId: 'warrior.guard' })
    state = reduce(state, { type: 'learn', id: 'w', skillId: 'warrior.wall' })
    expect(state.roster[0]?.learned).toContain('warrior.wall')
  })

  it('adds a mastery when a branch is complete', () => {
    const part = hero('w', 'warrior', 25, ['warrior.guard', 'warrior.wall'])
    const full = hero('w', 'warrior', 25, ['warrior.guard', 'warrior.wall', 'warrior.counter'])
    expect(masteries(part)).toEqual([])
    expect(masteries(full)).toEqual(['warrior.bulwark'])
    expect(heroSkillEffects(full).partyGuard).toBeCloseTo(0.03)
    expect(heroSkillEffects(full).counter).toBeCloseTo(0.2)
    expect(unit(full).maxHp).toBeGreaterThan(unit(hero('p', 'warrior', 25)).maxHp)
  })

  it('makes a branch that suits the personality stronger', () => {
    const fury = (personality: PersonalityId) => heroSkillEffects(hero('w', 'warrior', 25, ['warrior.slam', 'warrior.fury'], { personality })).attack
    // Hot-headed suits berserk, and fury has its own hot-headed bonus on top.
    expect(fury('hotheaded')).toBeCloseTo((0.08 + 0.04) * personalityRules.affinityScale)
    expect(fury('gentle')).toBeCloseTo(0.08)
  })

  it('adds a conditional bonus when the party or morale fits', () => {
    const saga = hero('b', 'bard', 25, ['bard.anthem', 'bard.drum', 'bard.saga'], { personality: 'loner' })
    expect(heroSkillEffects({ ...saga, morale: 40 }).partyAttack).toBeCloseTo(0.02)
    expect(heroSkillEffects({ ...saga, morale: 80 }).partyAttack).toBeCloseTo(0.05)
    expect(heroSkillEffects({ ...saga, morale: 80 }, { bonded: true }).partyAttack).toBeCloseTo(0.06)
    const stand = hero('w', 'warrior', 25, ['warrior.taunt', 'warrior.cow', 'warrior.laststand'], { personality: 'loner' })
    expect(heroSkillEffects(stand, { allies: ['warrior', 'cleric'] }).lastStand).toBeCloseTo(0.2)
    expect(heroSkillEffects(stand, { allies: ['warrior'] }).lastStand).toBeCloseTo(0.15)
  })
})

describe('gifts', () => {
  it('come to a few visitors, on their own stream', () => {
    const visitors = Array.from({ length: 40 }, (_, index) => generateVisitors(1000 + index, 5)).flat()
    const gifted = visitors.filter((entry) => entry.gift).length
    expect(gifted).toBeGreaterThan(0)
    expect(gifted).toBeLessThan(visitors.length * 0.2)
    // A gift never changes the visitor's other draws.
    const lifted = generateVisitors(77, 5, 0, 0.5, [], 1)
    const plain = generateVisitors(77, 5)
    expect(lifted.map((entry) => [entry.name, entry.classId])).toEqual(plain.map((entry) => [entry.name, entry.classId]))
    expect(lifted.every((entry) => entry.gift)).toBe(true)
  })

  it('pass down often, and the hero’s blood lifts potentials', () => {
    const mother = { ...hero('m', 'cleric'), gift: 'undying' as GiftId }
    const father = hero('f', 'warrior')
    const children = Array.from({ length: 200 }, (_, index) => inheritGift(`kid-${index}`, mother, father))
    const share = children.filter((gift) => gift === 'undying').length / children.length
    expect(share).toBeGreaterThan(giftRules.inherit - 0.1)
    expect(share).toBeLessThan(giftRules.inherit + 0.15)
    expect(rollGift('x', 0)).toBeUndefined()
  })

  it('make a late bloomer learn faster past the middle levels', () => {
    const late = hero('l', 'archer', 16, [], { gift: 'lateBloomer' })
    const plain = hero('p', 'archer', 16)
    expect(gainXp(late, 100).xp).toBeGreaterThan(gainXp(plain, 100).xp)
  })

  it('stay as they were in an older save', () => {
    const state = { ...freshState(5, now), version: 26, roster: [hero('a', 'mage', 8), { ...hero('b', 'mage', 8), gift: 'marksman' as GiftId }] }
    const opened = migrate(JSON.parse(JSON.stringify(state)), now)
    expect(opened.roster[0]?.gift).toBeUndefined()
    expect(opened.roster[1]?.gift).toBe('marksman')
  })
})

describe('new effects in battle', () => {
  it('strikes critically and drains life', () => {
    const make = () => [unit(hero('w', 'warrior', 25, ['warrior.slam', 'warrior.fury', 'warrior.thirst']))]
    expect(seen(() => {
      const units = make()
      units[0]!.crit = 0.5
      return units
    }, ['boar', 'boar'], 'log.crit')).toBe(true)
    expect(make()[0]!.lifesteal).toBeCloseTo(0.08)
  })

  it('lets evasive monsters slip single blows but not sweeps', () => {
    const single = () => [unit(hero('r', 'rogue', 25))]
    expect(seen(single, ['bat', 'bat'], 'log.miss')).toBe(true)
    const sweeper = () => [unit(hero('m', 'mage', 25), 0, 'back'), unit(hero('w', 'warrior', 25), 1)]
    const mageMissed = (seed: number) => keys(sweeper(), ['bat', 'bat'], seed).some((entry) => entry.key === 'log.miss' && entry.params.actorId === 'm')
    expect([1, 2, 3, 4, 5].some(mageMissed)).toBe(false)
  })

  it('keeps bleeding off the bloodless and burning off the fireproof', () => {
    const rogue = unit(hero('r', 'rogue', 25, ['rogue.bleed']))
    keys([rogue], ['skeleton'])
    const mage = unit(hero('m', 'mage', 25, ['mage.burst', 'mage.flame']), 0, 'back')
    const log = keys([mage, unit(hero('w', 'warrior', 25), 1)], ['drake'], 1, 0.5)
    expect(log.some((entry) => entry.key === 'log.burn' && String(entry.params.actorId).startsWith('drake'))).toBe(false)
    const wolfLog = keys([unit(hero('m2', 'mage', 25, ['mage.burst', 'mage.flame']), 0, 'back'), unit(hero('w2', 'warrior', 25), 1)], ['boar', 'boar'], 1, 3)
    expect(wolfLog.some((entry) => entry.key === 'log.burn')).toBe(true)
  })

  it('lets menders heal their side and thorns bite back', () => {
    expect(seen(() => [unit(hero('w', 'warrior', 25)), unit(hero('a', 'archer', 25), 1, 'back')], ['ghoul', 'necromancer'], 'log.heal')).toBe(true)
    expect(seen(() => [unit(hero('w', 'warrior', 25))], ['venom_toad'], 'log.thorns', 0.5)).toBe(true)
  })

  it('makes deep bosses furious in a long fight and steady against stuns', () => {
    const tank = () => {
      const units = [unit(hero('w', 'warrior', 25, ['warrior.guard', 'warrior.wall', 'warrior.counter']))]
      units[0]!.attack = 1
      units[0]!.maxHp = units[0]!.hp = 99_999
      return units
    }
    expect(seen(tank, ['barrow_lord'], 'log.enrage')).toBe(true)
    expect(seen(tank, ['cave_boss'], 'log.enrage')).toBe(false)
    // Stuns per blow landed.
    const fights = (monster: string) => {
      let stunned = 0
      let blows = 0
      for (let seed = 1; seed <= 20; seed += 1) {
        const units = tank()
        units[0]!.paralyzeOnHit = 0.1
        const log = keys(units, [monster], seed)
        stunned += log.filter((entry) => entry.key === 'log.paralyze').length
        blows += log.filter((entry) => entry.key === 'log.attack' && entry.params.actorId === 'w').length
      }
      return stunned / blows
    }
    expect(fights('barrow_lord')).toBeLessThan(fights('ghoul') * 0.6)
  })

  it('shields, revives, holds on and stands the party back up', () => {
    const cleric = hero('c', 'cleric', 25, ['cleric.heal', 'cleric.renew', 'cleric.miracle', 'cleric.purify', 'cleric.consecrate', 'cleric.aegis'])
    const units = [unit(hero('w', 'warrior', 25)), unit(cleric, 1, 'back')]
    applyAuras(units)
    expect(units[0]!.shieldShare).toBeGreaterThan(0)
    const log = keys(units, ['brigand', 'brigand'], 1, 2)
    expect(log.some((entry) => Number(entry.params.absorbed ?? 0) > 0), 'absorbed').toBe(true)
    const frail = () => {
      const pair = [unit(hero('w', 'warrior', 1)), unit(cleric, 1, 'back')]
      // Already down as the floor starts: the saint lifts them on the first tick.
      pair[0]!.hp = 0
      return pair
    }
    expect(seen(frail, ['mine_boss'], 'log.revive'), 'revive').toBe(true)
    expect(seen(() => [unit(hero('u', 'warrior', 1, [], { gift: 'undying' }))], ['mine_boss'], 'log.undying'), 'undying').toBe(true)
    expect(seen(() => [unit(hero('g', 'warrior', 1, [], { gift: 'guardian' }))], ['mine_boss'], 'log.guardian')).toBe(true)
  })

  it('turns some deep monsters into elites', () => {
    let elites = 0
    for (let seed = 1; seed <= 30; seed += 1) {
      const floors: Parameters<typeof simulateFloor>[6] = []
      simulateFloor([unit(hero('w', 'warrior', 25))], ['wolf', 'wolf', 'wolf'], DEFAULT_TACTICS, createRng(seed), [], 1, floors, 1, undefined, 0, [], undefined, 0.5)
      elites += floors[0]!.filter((entry) => entry.elite).length
    }
    expect(elites).toBeGreaterThan(20)
    expect(elites).toBeLessThan(70)
  })
})

describe('the road home', () => {
  it('tires a party with solace less, and an iron body less again', () => {
    const solace = hero('b', 'bard', 25, ['bard.hymn', 'bard.lullaby', 'bard.solace'])
    const iron = hero('w', 'warrior', 25, [], { gift: 'ironBody' })
    const plain = hero('p', 'warrior', 25)
    const fatigue = (party: Hero[], id: string) => {
      const result = runDungeon(party.map((entry, index) => ({ hero: entry, row: index === 0 ? 'front' as const : 'back' as const })), 'hill_cave', DEFAULT_TACTICS, 3)
      return result.ok ? result.report.conditions.find((entry) => entry.id === id)!.fatigue : -1
    }
    const base = tripFatigue(1)
    expect(fatigue([plain], 'p')).toBe(base)
    expect(fatigue([plain, solace], 'p')).toBe(Math.round(base * 0.9))
    expect(fatigue([iron], 'w')).toBe(Math.round(base * 0.75))
  })

  it('brings a lucky party a little more gold', () => {
    const run = (gift?: GiftId) => {
      const result = runDungeon([{ hero: hero('w', 'warrior', 25, [], gift ? { gift } : {}), row: 'front' }], 'hill_cave', DEFAULT_TACTICS, 3)
      return result.ok ? result.report.gold : 0
    }
    expect(run('lucky')).toBeGreaterThan(run())
  })

  it('keeps the elite chance to the deeper dungeons', () => {
    expect(combatRules.eliteTier).toBeGreaterThanOrEqual(4)
    expect(progression.xpPerLevel).toBeGreaterThan(0)
  })
})

describe('review 318455b', () => {
  it('stands the party up once, however many guardian angels it carries', () => {
    let saves = 0
    for (let seed = 1; seed <= 12; seed += 1) {
      const pair = [unit(hero('g1', 'warrior', 1, [], { gift: 'guardian' })), unit(hero('g2', 'warrior', 1, [], { gift: 'guardian' }), 1)]
      const count = keys(pair, ['mine_boss'], seed).filter((entry) => entry.key === 'log.guardian').length
      expect(count).toBeLessThanOrEqual(1)
      saves += count
    }
    expect(saves).toBeGreaterThan(0)
  })

  it('keeps no more picks than the level has earned', () => {
    const branch = ['warrior.guard', 'warrior.wall', 'warrior.counter', 'warrior.slam', 'warrior.fury', 'warrior.thirst']
    expect(hero('a', 'warrior', 1, branch).learned).toHaveLength(1)
    expect(hero('b', 'warrior', 7, branch).learned).toEqual([classById('warrior').skills[0]!.id, 'warrior.guard', 'warrior.wall'])
    expect(hero('c', 'warrior', 25, branch).learned).toHaveLength(7)
  })

  it('carries the lucky share to the materials', () => {
    const result = runDungeon([{ hero: hero('w', 'warrior', 25, [], { gift: 'lucky' }), row: 'front' }], 'hill_cave', DEFAULT_TACTICS, 3)
    expect(result.ok && result.report.luck).toBeGreaterThan(0)
  })
})
