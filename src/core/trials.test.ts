import { describe, expect, it } from 'vitest'
import { endgameRules, specialDungeons, villageRules } from './data'
import { freshState, migrate, reduce, type GameState } from './game'
import { createHero } from './hero'
import { abyssFloors, abyssShards, settleSpecial, specialBlock, todayElement, trialsLeft } from './trials'
import type { Hero } from './types'

// Docs/endgame.md 4a: weekday trials and the endless abyss.

// 2026-11-23 was a Monday (flame); local noon keeps the date steady.
const monday = new Date(2026, 10, 23, 12).getTime()
const sunday = new Date(2026, 10, 29, 12).getTime()
const stats = { str: 40, agi: 30, vit: 40, int: 30, wil: 30, wis: 30 }

function hero(id: string, classId: 'warrior' | 'cleric' | 'archer' | 'mage', row: 'front' | 'back'): { hero: Hero; row: 'front' | 'back' } {
  return { hero: createHero({ id, name: id, gender: 'male', classId, age: 25, potentials: stats, level: 20, personality: 'timid' }), row }
}

function town(level: number, extra: Partial<GameState> = {}): GameState {
  const base = freshState(5, monday)
  const fame = villageRules.levels.find((entry) => entry.level === level)!.fame
  const party = [hero('w', 'warrior', 'front'), hero('c', 'cleric', 'back'), hero('a', 'archer', 'back'), hero('m', 'mage', 'back')]
  return {
    ...base,
    fame,
    gold: 5000,
    lastTickAt: monday,
    roster: party.map((member) => member.hero),
    buildings: { ...base.buildings, guild: 2 },
    presets: base.presets.map((preset, index) => (index === 0 ? { ...preset, slots: party.map((member) => ({ id: member.hero.id, row: member.row })) } : preset)),
    ...extra,
  }
}

describe('weekday trials', () => {
  it('follow the weekday, with Sunday open to any essence', () => {
    expect(todayElement(monday)).toBe('flame')
    expect(todayElement(sunday)).toBe('choice')
    const state = town(6)
    expect(specialBlock(state, 'trial_flame_1', monday)).toBeNull()
    expect(specialBlock(state, 'trial_frost_1', monday)).toBe('trialDay')
    expect(specialBlock(state, 'trial_frost_1', sunday)).toBeNull()
    expect(specialBlock(town(5), 'trial_flame_1', monday)).toBe('lockedDungeon')
  })

  it('spend one of three attempts a day as the party sets out, and refill the next day', () => {
    let state = { ...town(6), dungeonId: 'trial_flame_1' }
    state = reduce(state, { type: 'depart', presetId: 'p1', confirm: true, now: monday })
    expect(state.expeditions).toHaveLength(1)
    expect(trialsLeft(state, monday)).toBe(endgameRules.weekday.attemptsPerDay - 1)
    expect(trialsLeft(state, monday + 86_400_000)).toBe(endgameRules.weekday.attemptsPerDay)
    const used = { ...state, expeditions: [], trials: { date: state.trials!.date, used: endgameRules.weekday.attemptsPerDay } }
    expect(reduce(used, { type: 'depart', presetId: 'p1', confirm: true, now: monday }).notice).toBe('trialsUsed')
  })

  it('give essence by difficulty on a win and stay off the regular ladder', () => {
    const state = town(6)
    const won = settleSpecial(state, 'trial_light_3', 3, true)
    expect(won.vault.light).toBe(endgameRules.weekday.essence[2])
    expect(settleSpecial(state, 'trial_light_3', 2, false).vault.light).toBe(0)
    expect(specialDungeons.every((dungeon) => !state.cleared.includes(dungeon.id))).toBe(true)
  })

  it('cannot be picked for auto runs', () => {
    expect(reduce(town(6), { type: 'autoDungeon', id: 'trial_flame_1' }).notice).toBe('autoLocked')
  })
})

describe('the abyss', () => {
  it('lays out the same floors every time, a boss every fifth, stronger as it goes', () => {
    const floors = abyssFloors(0)
    expect(floors).toHaveLength(endgameRules.abyss.floorsPerRun)
    expect(abyssFloors(0)).toEqual(floors)
    expect(endgameRules.abyss.bosses).toContain(floors[4]!.monsters[0])
    expect(abyssFloors(5)[0]!.scale!).toBeGreaterThan(floors[4]!.scale!)
  })

  it('pays more for new floors, sets a checkpoint after five, and gives fame every tenth', () => {
    let state = town(7)
    state = settleSpecial(state, 'abyss', 5, true, 0)
    expect(state.abyss).toEqual({ best: 5, checkpoint: 5 })
    const shards = Array.from({ length: 5 }, (_, index) => abyssShards(index + 1, 0)).reduce((sum, value) => sum + value, 0)
    expect(state.vault.abyss).toBe(shards)
    const fame = state.fame
    state = settleSpecial(state, 'abyss', 5, true, 5)
    expect(state.abyss.best).toBe(10)
    expect(state.fame).toBe(fame + endgameRules.abyss.fame)
    // A run that falls short keeps the checkpoint where it was.
    state = settleSpecial(state, 'abyss', 3, false, 10)
    expect(state.abyss).toEqual({ best: 13, checkpoint: 10 })
    expect(abyssShards(3, 13)).toBe(endgameRules.abyss.shardsRepeat)
  })

  it('sends a party down from the checkpoint and remembers where it started', () => {
    const state = { ...town(7), dungeonId: 'abyss', abyss: { best: 12, checkpoint: 10 } }
    const out = reduce(state, { type: 'depart', presetId: 'p1', confirm: true, now: monday })
    expect(out.expeditions[0]?.abyssFrom).toBe(10)
    expect(reduce({ ...state, fame: 0 }, { type: 'depart', presetId: 'p1', confirm: true, now: monday }).notice).toBe('lockedDungeon')
  })
})

describe('saves', () => {
  it('opens a version 22 save with an empty vault and a fresh abyss', () => {
    const old = JSON.parse(JSON.stringify({ ...town(1), version: 22 })) as Record<string, unknown>
    delete old.vault
    delete old.trials
    delete old.abyss
    const opened = migrate(old, monday)
    expect(opened.vault).toEqual({ flame: 0, frost: 0, light: 0, abyss: 0, scale: 0, crown: 0, core: 0, valor: 0 })
    expect(opened.abyss).toEqual({ best: 0, checkpoint: 0 })
    expect(opened.trials).toBeNull()
  })
})

describe('review b80777c fixes', () => {
  it('does not refill attempts when the clock goes back a day', () => {
    const state = { ...town(6), trials: { date: '2026-11-24', used: 1 } }
    expect(trialsLeft(state, monday)).toBe(0)
  })

  it('keeps whole vault amounts and checkpoints on whole runs', () => {
    const old = JSON.parse(JSON.stringify({ ...town(1), vault: { flame: 1.5, frost: -2, light: 3, abyss: 7 }, abyss: { best: 12, checkpoint: 3 } })) as Record<string, unknown>
    const opened = migrate(old, monday)
    expect(opened.vault).toEqual({ flame: 1, frost: 0, light: 3, abyss: 7, scale: 0, crown: 0, core: 0, valor: 0 })
    expect(opened.abyss).toEqual({ best: 12, checkpoint: 0 })
  })

  it('records the essence a trial brought home', () => {
    let state = { ...town(6), dungeonId: 'trial_flame_1' }
    state = reduce(state, { type: 'depart', presetId: 'p1', confirm: true, now: monday })
    const home = reduce(state, { type: 'catchUp', now: state.expeditions[0]!.returnAt + 1000 })
    const record = home.history[0]!
    if (record.victory) {
      expect(record.gained?.vault?.flame).toBe(endgameRules.weekday.essence[0])
    } else {
      expect(record.gained?.vault).toBeUndefined()
    }
  })
})
