import { describe, expect, it } from 'vitest'
import { createHeroUnit, simulateFloor } from './combat'
import { classById, combatRules, dungeonById, monsterById, villageRules } from './data'
import { DEFAULT_TACTICS, defeatReason, runDungeon } from './dungeon'
import { dungeonUnlocked, freshState } from './game'
import { createHero } from './hero'
import { createRng } from './rng'
import type { ClassId, LogEntry, PartyMember, Tactics } from './types'

// Docs/depth.md 3c: charged blasts, breaking or bracing, and boss phases.

const stats = { str: 14, agi: 12, vit: 14, int: 12, wil: 12, wis: 14 }

function member(id: string, classId: ClassId, row: 'front' | 'back' = 'front', level = 16): PartyMember {
  return { row, hero: createHero({ id, name: id, gender: 'male', classId, age: 25, potentials: stats, level, training: level - 1 }) }
}

function fight(lineup: PartyMember[], tactics: Tactics = DEFAULT_TACTICS, scale = 1) {
  const heroes = lineup.map((entry, index) => createHeroUnit(entry, index))
  const log: LogEntry[] = []
  simulateFloor(heroes, ['citadel_lord'], tactics, createRng(3), log, 3, undefined, scale)
  return { heroes, log, keys: log.map((entry) => entry.key) }
}

describe('charged blasts', () => {
  it('gives the break to warriors, rogues and archers only', () => {
    expect(['warrior', 'rogue', 'archer'].every((id) => classById(id as ClassId).interrupt)).toBe(true)
    expect(['mage', 'cleric', 'bard', 'dancer'].some((id) => classById(id as ClassId).interrupt)).toBe(false)
  })

  it('warns, then blasts the whole party a fixed number of ticks later', () => {
    const { log } = fight([member('c', 'cleric', 'back'), member('m', 'mage', 'back')])
    const charge = log.find((entry) => entry.key === 'log.charge')
    const blast = log.find((entry) => entry.key === 'log.blast')
    expect(charge).toBeDefined()
    expect(blast!.tick - charge!.tick).toBe(combatRules.chargeTicks)
    expect(log.some((entry) => entry.key === 'log.interrupt')).toBe(false)
  })

  it('lets a breaker who acts in the window cancel the blast', () => {
    let broke = false
    for (let seed = 1; seed <= 10 && !broke; seed += 1) {
      const heroes = [member('r', 'rogue'), member('a', 'archer', 'back'), member('c', 'cleric', 'back')].map((entry, index) => createHeroUnit(entry, index))
      const log: LogEntry[] = []
      simulateFloor(heroes, ['citadel_lord'], DEFAULT_TACTICS, createRng(seed), log, 3)
      const at = log.findIndex((entry) => entry.key === 'log.interrupt')
      if (at < 0) continue
      broke = true
      const charge = [...log.slice(0, at)].reverse().find((entry) => entry.key === 'log.charge')!
      const blastedRightAfter = log.some((entry) => entry.key === 'log.blast' && entry.tick === charge.tick + combatRules.chargeTicks)
      expect(blastedRightAfter).toBe(false)
    }
    expect(broke).toBe(true)
  })

  it('braces the whole party at the warning and takes less of the blast', () => {
    const lineup = [member('c', 'cleric', 'back'), member('m', 'mage', 'back')]
    const open = fight(lineup, { ...DEFAULT_TACTICS, blast: 'interrupt' })
    const braced = fight(lineup, { ...DEFAULT_TACTICS, blast: 'brace' })
    expect(braced.keys.filter((key) => key === 'log.brace').length).toBeGreaterThanOrEqual(2)
    const firstBlast = (log: LogEntry[]) => log.filter((entry) => entry.key === 'log.attack' && entry.tick === log.find((e) => e.key === 'log.blast')!.tick)
    const hit = (log: LogEntry[]) => firstBlast(log).reduce((sum, entry) => sum + Number(entry.params.amount), 0)
    expect(hit(braced.log)).toBeLessThan(hit(open.log))
  })
})

describe('boss phases', () => {
  it('summons help at 70% and speeds up its blasts at 35%', () => {
    const lord = monsterById('citadel_lord')
    expect(lord.phases?.[0]).toMatchObject({ at: 0.7 })
    expect(lord.phases?.[1]?.blastEvery).toBeLessThan(lord.phases?.[0]?.blastEvery ?? 99)
    const { log } = fight([member('w', 'warrior'), member('r', 'rogue'), member('a', 'archer', 'back'), member('m', 'mage', 'back'), member('c', 'cleric', 'back')], DEFAULT_TACTICS, 4.5)
    const phases = log.filter((entry) => entry.key === 'log.phase').map((entry) => entry.params.phase)
    expect(phases).toEqual([2, 3])
    const summon = log.find((entry) => entry.key === 'log.summon')
    expect(String(summon?.params.refs).split(',')).toEqual(['grave_knight', 'bone_archer'])
    // Summoned units get fresh ids and join the fight like any other enemy.
    const ids = String(summon?.params.units).split(',')
    expect(new Set(ids).size).toBe(2)
    expect(log.some((entry) => entry.key === 'log.attack' && (ids.includes(String(entry.params.actorId)) || ids.includes(String(entry.params.targetId))))).toBe(true)
  })
})

describe('the haunted citadel', () => {
  it('names an unbroken blast in the defeat report', () => {
    const toll = { poisonShare: 0, stunned: 0, muted: 0 }
    expect(defeatReason('wipe', 6, true, true, 16, 16, { ...toll, blastShare: combatRules.blastedShare })).toBe('blasted')
    expect(defeatReason('wipe', 6, true, true, 16, 16, { ...toll, ambushShare: 1, blastShare: 1 })).toBe('ambushed')
  })

  it('opens after the fortress and gives bones and crystals', () => {
    const base = freshState(5, 0)
    const before = ['hill_cave', 'abandoned_mine', 'barrow', 'sunken_crypt', 'venom_marsh']
    expect(dungeonUnlocked({ ...base, cleared: before }, 'haunted_citadel')).toBe(false)
    expect(dungeonUnlocked({ ...base, cleared: [...before, 'bandit_fort'] }, 'haunted_citadel')).toBe(true)
    expect(dungeonById('haunted_citadel').tier).toBe(6)
    const drop = (villageRules.drops as Record<string, { material: string; crystal?: number }>).haunted_citadel
    expect(drop).toMatchObject({ material: 'bone' })
    expect(drop?.crystal).toBeGreaterThan(0)
    expect(villageRules.levels.find((level) => level.level === 6)).toBeDefined()
  })

  it('leaves older dungeons without blasts or phases', () => {
    const party = [member('w', 'warrior', 'front', 8), member('c', 'cleric', 'back', 8)]
    const result = runDungeon(party, 'barrow', DEFAULT_TACTICS, 4)
    expect(result.ok && result.report.log.some((entry) => ['log.charge', 'log.phase', 'log.brace'].includes(entry.key))).toBe(false)
  })
})
