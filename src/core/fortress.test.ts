import { describe, expect, it } from 'vitest'
import { createHeroUnit, simulateFloor, springTrap } from './combat'
import { combatRules, dungeonById, magicRules, villageRules } from './data'
import { DEFAULT_TACTICS, defeatReason, runDungeon } from './dungeon'
import { dungeonUnlocked, freshState, migrate, reduce, type GameState } from './game'
import { createHero } from './hero'
import { enchantTime, heroTrinkets } from './magic'
import { createRng, type Rng } from './rng'
import type { ClassId, Gear, LogEntry, PartyMember, TrinketId } from './types'

// Docs/depth.md 3b: traps, ambushes, trinkets and the magic workshop.

const now = 1_700_000_000_000
const stats = { str: 14, agi: 12, vit: 14, int: 12, wil: 12, wis: 14 }

function trinket(id: TrinketId, n = 1): Gear {
  return { id: `t-${id}-${n}`, recipeId: `trinket.${id}`, slot: 'trinket', grade: 'common', enhance: 0 }
}

function member(id: string, classId: ClassId, row: 'front' | 'back' = 'front', wear: TrinketId[] = [], level = 14): PartyMember {
  const hero = createHero({ id, name: id, gender: 'male', classId, age: 25, potentials: stats, level, training: level - 1 })
  return { row, hero: { ...hero, gear: [...hero.gear, ...wear.map((t) => trinket(t))] } }
}

// Draws always succeed: every trap goes off and every disarm works.
const lucky: Rng = { next: () => 0, int: (min: number) => min, pick: <T>(items: readonly T[]) => items[0] as T } as Rng

describe('traps', () => {
  it('hurts everyone without knocking anyone out when nobody can disarm it', () => {
    const heroes = [createHeroUnit(member('w', 'warrior'), 0), createHeroUnit(member('c', 'cleric', 'back'), 1)]
    heroes[1]!.hp = 3
    heroes[0]!.gauge = 80
    const log: LogEntry[] = []
    expect(springTrap(heroes, 1, lucky, log)).toBe('sprung')
    expect(heroes[0]!.hp).toBe(heroes[0]!.maxHp - Math.round(heroes[0]!.maxHp * magicRules.trapDamage))
    expect(heroes[1]!.hp).toBe(1)
    expect(heroes[0]!.gauge).toBe(0)
    expect(heroes[0]!.trapTaken).toBeGreaterThan(0)
    expect(log.map((entry) => entry.key)).toContain('log.trap')
  })

  it('is disarmed by a rogue, or by a trap sense ring at a lower chance', () => {
    const rogue = createHeroUnit(member('r', 'rogue'), 0)
    const ringed = createHeroUnit(member('c', 'cleric', 'back', ['trapSense']), 1)
    expect(rogue.disarm).toBe(magicRules.disarm)
    expect(ringed.disarm).toBe(magicRules.senseDisarm)
    expect(createHeroUnit(member('w', 'warrior'), 0).disarm).toBe(0)
    const log: LogEntry[] = []
    expect(springTrap([ringed, rogue], 1, lucky, log)).toBe('disarmed')
    expect(log[0]).toMatchObject({ key: 'log.disarm', params: { actorId: 'r' } })
    expect(rogue.hp).toBe(rogue.maxHp)
  })

  it('pays a little gold for each disarmed trap and counts traps in the report', () => {
    const withRogue = [member('w', 'warrior'), member('r', 'rogue'), member('a', 'archer', 'back'), member('m', 'mage', 'back'), member('c', 'cleric', 'back')]
    let seen = false
    for (let seed = 1; seed <= 10 && !seen; seed += 1) {
      const result = runDungeon(withRogue, 'bandit_fort', DEFAULT_TACTICS, seed)
      if (!result.ok || !result.report.victory || !result.report.traps || result.report.traps.disarmed === 0) continue
      seen = true
      const fort = dungeonById('bandit_fort')
      const bonus = result.report.traps.disarmed * Math.round(fort.gold * magicRules.disarmGold)
      expect([fort.gold, Math.round(fort.gold * 1.25)]).toContain(result.report.gold - bonus)
    }
    expect(seen).toBe(true)
  })

  it('leaves dungeons without traps as they were: no trap report, no extra draws', () => {
    const lineup = [member('w', 'warrior'), member('c', 'cleric', 'back')]
    const result = runDungeon(lineup, 'abandoned_mine', DEFAULT_TACTICS, 7)
    expect(result.ok && result.report.traps).toBeUndefined()
    const log: LogEntry[] = []
    const heroes = lineup.map((entry, index) => createHeroUnit(entry, index))
    expect(springTrap(heroes, 0, createRng(1), log)).toBe('none')
    expect(log).toEqual([])
  })
})

describe('ambushes', () => {
  it('lets an ambusher strike the back row first with extra force', () => {
    const tank = createHeroUnit(member('w', 'warrior'), 0)
    const healer = createHeroUnit(member('c', 'cleric', 'back'), 1)
    tank.threat = 999
    const log: LogEntry[] = []
    simulateFloor([tank, healer], ['cutthroat'], DEFAULT_TACTICS, createRng(1), log, 1, undefined, 3.8)
    const first = log.find((entry) => entry.params.actorId === 'cutthroat-1')
    expect(first).toMatchObject({ key: 'log.ambush', params: { targetId: 'c' } })
    expect(healer.ambushTaken).toBeGreaterThan(0)
  })

  it('is spotted by a hero wearing a watchful charm', () => {
    const tank = createHeroUnit(member('w', 'warrior', 'front', ['alert']), 0)
    const healer = createHeroUnit(member('c', 'cleric', 'back'), 1)
    const log: LogEntry[] = []
    simulateFloor([tank, healer], ['cutthroat'], DEFAULT_TACTICS, createRng(1), log, 1, undefined, 3.8)
    expect(log.some((entry) => entry.key === 'log.alert')).toBe(true)
    expect(log.some((entry) => entry.key === 'log.ambush')).toBe(false)
    expect(healer.ambushTaken).toBe(0)
  })
})

describe('trinket wards', () => {
  it('halves poison and status chances, and the same trinket twice counts once', () => {
    const warded = createHeroUnit(member('w', 'warrior', 'front', ['poisonWard', 'steady']), 0)
    expect(warded.poisonWard).toBe(magicRules.ward)
    expect(warded.steady).toBe(magicRules.ward)
    expect(warded.calm).toBe(1)
    const doubled = member('c', 'cleric', 'back', ['calm', 'calm'])
    expect([...heroTrinkets(doubled.hero)]).toEqual(['calm'])
    expect(createHeroUnit(doubled, 0).calm).toBe(magicRules.ward)
  })

  it('takes half the poison damage per tick', () => {
    const plain = createHeroUnit(member('a', 'warrior'), 0)
    const warded = createHeroUnit(member('b', 'warrior', 'front', ['poisonWard']), 0)
    for (const unit of [plain, warded]) {
      unit.dot = 20
      unit.gauge = combatRules.gaugeThreshold
    }
    const logA: LogEntry[] = []
    const logB: LogEntry[] = []
    simulateFloor([plain], ['wolf'], DEFAULT_TACTICS, createRng(1), logA, 1)
    simulateFloor([warded], ['wolf'], DEFAULT_TACTICS, createRng(1), logB, 1)
    const dot = (log: LogEntry[]) => log.find((entry) => entry.key === 'log.dot')?.params.amount
    expect(dot(logA)).toBe(20)
    expect(dot(logB)).toBe(10)
  })
})

describe('defeat reasons for the fortress', () => {
  it('names traps, then ambushes, after the status reasons', () => {
    const toll = { poisonShare: 0, stunned: 0, muted: 0 }
    expect(defeatReason('wipe', 5, true, true, 14, 14, { ...toll, trapShare: combatRules.trappedShare })).toBe('trapped')
    expect(defeatReason('wipe', 5, true, true, 14, 14, { ...toll, ambushShare: combatRules.ambushedShare })).toBe('ambushed')
    expect(defeatReason('wipe', 5, true, true, 14, 14, { ...toll, poisonShare: 1, trapShare: 1 })).toBe('poisoned')
    expect(defeatReason('wipe', 5, true, true, 14, 14, toll)).toBe('wiped')
  })
})

describe('trinkets and the magic workshop', () => {
  function ready(): GameState {
    const base = freshState(5, now)
    return { ...base, gold: 500, buildings: { ...base.buildings, magic: 1 }, materials: { ...base.materials, crystal: 20 } }
  }

  it('makes a trinket into the stash after its time', () => {
    const state = ready()
    const started = reduce(state, { type: 'enchant', trinketId: 'alert', now })
    expect(started.notice).toBeNull()
    expect(started.materials.crystal).toBe(20 - 4)
    expect(reduce(started, { type: 'enchant', trinketId: 'trapSense', now }).notice).toBe('magicBusy')
    const done = reduce(started, { type: 'catchUp', now: now + enchantTime(state, 'alert') + 1 })
    expect(done.magic).toBeNull()
    expect(done.stash.at(-1)).toMatchObject({ slot: 'trinket', recipeId: 'trinket.alert' })
  })

  it('needs the workshop, its level, and crystals', () => {
    const base = freshState(5, now)
    expect(reduce(base, { type: 'enchant', trinketId: 'alert', now }).notice).toBe('noMagic')
    expect(reduce(ready(), { type: 'enchant', trinketId: 'calm', now }).notice).toBe('locked')
    expect(reduce({ ...ready(), materials: { ...ready().materials, crystal: 0 } }, { type: 'enchant', trinketId: 'alert', now }).notice).toBe('resources')
    const faster = { ...ready(), buildings: { ...ready().buildings, magic: 3 } }
    expect(enchantTime(faster, 'alert')).toBeLessThan(enchantTime(ready(), 'alert'))
  })

  it('wears two trinkets, swaps out the oldest for a third, and takes one off by id', () => {
    const base = ready()
    const hero = base.roster[0] ?? base.visitors[0]!
    let state: GameState = { ...base, roster: [hero], stash: [trinket('alert', 1), trinket('trapSense', 2), trinket('calm', 3)] }
    state = reduce(state, { type: 'equip', heroId: hero.id, gearId: 't-alert-1' })
    state = reduce(state, { type: 'equip', heroId: hero.id, gearId: 't-trapSense-2' })
    const worn = () => state.roster[0]!.gear.filter((gear) => gear.slot === 'trinket').map((gear) => gear.id)
    expect(worn()).toEqual(['t-alert-1', 't-trapSense-2'])
    expect(state.roster[0]!.gear.some((gear) => gear.slot === 'weapon')).toBe(true)
    state = reduce(state, { type: 'equip', heroId: hero.id, gearId: 't-calm-3' })
    expect(worn()).toEqual(['t-trapSense-2', 't-calm-3'])
    expect(state.stash.map((gear) => gear.id)).toEqual(['t-alert-1'])
    state = reduce(state, { type: 'unequip', heroId: hero.id, slot: 'trinket', gearId: 't-calm-3' })
    expect(worn()).toEqual(['t-trapSense-2'])
  })

  it('locks the gear of a hero who is away, and never enhances a trinket (review 1f690a1)', () => {
    const base = ready()
    const hero = base.roster[0] ?? base.visitors[0]!
    const worn = { ...hero, gear: [...hero.gear, trinket('alert', 1)] }
    const away = { ...base, roster: [worn], stash: [trinket('calm', 2)], expeditions: [{ heroIds: [hero.id] }] } as unknown as GameState
    expect(reduce(away, { type: 'unequip', heroId: hero.id, slot: 'trinket', gearId: 't-alert-1' }).notice).toBe('busyHero')
    expect(reduce(away, { type: 'equip', heroId: hero.id, gearId: 't-calm-2' }).notice).toBe('busyHero')
    const smithy = { ...base, buildings: { ...base.buildings, smith: 1 }, materials: { ...base.materials, iron: 50 }, stash: [trinket('alert', 3)] }
    const tried = reduce(smithy, { type: 'enhance', gearId: 't-alert-3', now })
    expect(tried.notice).toBe('recipe')
    expect(tried.smith).toBeNull()
    expect(tried.gold).toBe(smithy.gold)
  })

  it('opens the fortress after the marsh, drops crystals, and opens the workshop at town level 5', () => {
    const base = freshState(5, now)
    const tier3 = ['hill_cave', 'abandoned_mine', 'barrow', 'sunken_crypt']
    expect(dungeonUnlocked({ ...base, cleared: tier3 }, 'bandit_fort')).toBe(false)
    expect(dungeonUnlocked({ ...base, cleared: [...tier3, 'venom_marsh'] }, 'bandit_fort')).toBe(true)
    const drops = villageRules.drops as Record<string, { material: string; crystal?: number }>
    expect(drops.bandit_fort?.material).toBe('crystal')
    expect(drops.sunken_crypt?.crystal).toBeGreaterThan(0)
    expect(villageRules.buildings.find((building) => building.id === 'magic')?.unlockLevel).toBe(5)
    expect(villageRules.levels.find((level) => level.level === 5)).toBeDefined()
  })

  it('opens a version 11 save with no workshop job and no crystals, keeping worn trinkets', () => {
    const old = { ...freshState(5, now), version: 11 } as Record<string, unknown>
    delete old.magic
    old.materials = { wood: 1, stone: 2, iron: 3, bone: 4, herb: 5 }
    old.stash = [trinket('alert')]
    const loaded = migrate(JSON.parse(JSON.stringify(old)), now)
    expect(loaded.magic).toBeNull()
    expect(loaded.materials.crystal).toBe(0)
    expect(loaded.buildings.magic).toBe(0)
    expect(loaded.stash[0]).toMatchObject({ slot: 'trinket', recipeId: 'trinket.alert' })
  })
})
