import { describe, expect, it } from 'vitest'
import { brewTime } from './alchemy'
import { alchemyRules, potionById } from './data'
import { recipeById } from './gear'
import { freshState, migrate, reduce, type GameState } from './game'
import { createHero } from './hero'
import type { ClassId, Hero } from './types'

// Docs/automation.md: workshop queues, standing potion stock, auto care and auto training.

const now = 1_700_000_000_000
const stats = { str: 14, agi: 12, vit: 14, int: 12, wil: 12, wis: 14 }

function hero(id: string, classId: ClassId = 'warrior', level = 6, extra: Partial<Hero> = {}): Hero {
  return { ...createHero({ id, name: id, gender: 'male', classId, age: 26, potentials: stats, level, training: level - 1 }), ...extra }
}

function town(extra: Partial<GameState> = {}): GameState {
  const base = freshState(5, now)
  return {
    ...base,
    gold: 2000,
    materials: { wood: 500, stone: 500, iron: 500, bone: 100, herb: 100, crystal: 100 },
    buildings: { ...base.buildings, smith: 2, alchemy: 2, magic: 1, temple: 1, training: 1 },
    ...extra,
  }
}

describe('workshop queues', () => {
  it('queues paid orders up to the building level and runs them back to back while away', () => {
    let state = town()
    state = reduce(state, { type: 'brew', potionId: 'antidote', now })
    const afterFirst = state.gold
    state = reduce(state, { type: 'brew', potionId: 'heal', now })
    state = reduce(state, { type: 'brew', potionId: 'antidote', now })
    expect(state.automation.queues.alchemy).toEqual(['heal', 'antidote'])
    expect(state.gold).toBe(afterFirst - potionById('heal')!.gold - potionById('antidote')!.gold)
    expect(reduce(state, { type: 'brew', potionId: 'heal', now }).notice).toBe('queueFull')
    const total = brewTime(state, 'antidote') * 2 + brewTime(state, 'heal')
    const later = reduce(state, { type: 'catchUp', now: now + total + 1000 })
    expect(later.alchemy).toBeNull()
    expect(later.automation.queues.alchemy).toEqual([])
    expect(later.potions.antidote).toBe(2 * alchemyRules.batch)
    expect(later.potions.heal).toBe(alchemyRules.batch)
  })

  it('refunds an order taken off the queue', () => {
    let state = reduce(town(), { type: 'craft', recipeId: 'iron.blade', now })
    const before = state
    state = reduce(state, { type: 'craft', recipeId: 'iron.mail', now })
    const back = reduce(state, { type: 'dequeue', building: 'smith', index: 0 })
    expect(back.automation.queues.smith).toEqual([])
    expect(back.gold).toBe(before.gold)
    expect(back.materials).toEqual(before.materials)
    expect(recipeById('iron.mail')).toBeDefined()
  })
})

describe('standing potion stock', () => {
  it('brews whatever has fallen below its standing count, again and again while away', () => {
    let state = reduce(town(), { type: 'potionTarget', potionId: 'antidote', count: 4 })
    const later = reduce(state, { type: 'catchUp', now: now + brewTime(state, 'antidote') * 3 })
    expect(later.potions.antidote ?? 0).toBeGreaterThanOrEqual(4)
    state = reduce(later, { type: 'catchUp', now: now + brewTime(state, 'antidote') * 6 })
    expect(state.potions.antidote).toBeLessThanOrEqual(4 + alchemyRules.batch)
  })
})

describe('auto care and auto training', () => {
  it('treats the wounded at home by itself, unless turned off', () => {
    const state = town({ roster: [hero('w', 'warrior', 6, { condition: 'injured' })] })
    expect(reduce(state, { type: 'catchUp', now: now + 1000 }).roster[0]?.treatAt).toBeDefined()
    const off = reduce(state, { type: 'automation', care: false })
    expect(reduce(off, { type: 'catchUp', now: now + 1000 }).roster[0]?.treatAt).toBeUndefined()
  })

  it('sends the hero furthest behind to training, but not the selected party', () => {
    const veterans = ['a', 'b', 'c', 'd', 'e'].map((id) => hero(id, 'warrior', 10))
    let state = town({ roster: [...veterans, hero('low', 'archer', 3), hero('mid', 'mage', 7), hero('kept', 'cleric', 2)] })
    state = reduce(state, { type: 'add', id: 'kept' })
    state = reduce(state, { type: 'automation', drill: true })
    const ticked = reduce(state, { type: 'catchUp', now: now + 1000 })
    expect(ticked.drills.map((drill) => drill.heroId)).toEqual(['low'])
  })

  it('opens a version 16 save with care on, training off and empty queues', () => {
    const old = { ...town(), version: 16 } as Record<string, unknown>
    delete old.automation
    const loaded = migrate(JSON.parse(JSON.stringify(old)), now)
    expect(loaded.automation).toEqual({ care: true, drill: false, potions: {}, queues: { smith: [], alchemy: [], magic: [] } })
  })
})

describe('review a6be730 fixes', () => {
  it('runs work before an upgrade at the old level, however the time is split', () => {
    let state = town({ buildings: { ...town().buildings, alchemy: 1 } })
    state = reduce(state, { type: 'brew', potionId: 'heal', now })
    state = reduce(state, { type: 'brew', potionId: 'heal', now })
    const firstDone = state.alchemy!.finishAt
    const upgraded = { ...state, construction: { id: 'alchemy' as const, finishAt: firstDone + 1000 } }
    const end = firstDone + brewTime(state, 'heal') + 5000
    const once = reduce(upgraded, { type: 'catchUp', now: end })
    const split = reduce(reduce(upgraded, { type: 'catchUp', now: firstDone + 500 }), { type: 'catchUp', now: end })
    expect(once.potions.heal).toBe(split.potions.heal)
    expect(once.potions.heal).toBe(2 * alchemyRules.batch)
  })

  it('treats a hero already home from the start of the catch-up', () => {
    const state = town({ roster: [hero('w', 'warrior', 6, { condition: 'injured' })] })
    const later = reduce(state, { type: 'catchUp', now: now + 3 * 60_000 + 1000 })
    expect(later.roster[0]?.condition).toBe('fatigued')
  })

  it('leaves the second auto party alone when training', () => {
    const base = town({ buildings: { ...town().buildings, guild: 3 }, cleared: ['hill_cave'] })
    const veterans = ['a', 'b', 'c', 'd', 'e'].map((id) => hero(id, 'warrior', 10))
    let state = { ...base, roster: [...veterans, hero('low', 'archer', 2)] }
    state = reduce(state, { type: 'add', id: 'a' })
    state = reduce(state, { type: 'add', id: 'low', presetId: 'p2' })
    state = reduce(reduce(state, { type: 'auto', enabled: true }), { type: 'automation', drill: true })
    const ticked = reduce(state, { type: 'catchUp', now: now + 1000 })
    expect(ticked.drills.some((drill) => drill.heroId === 'low')).toBe(false)
  })

  it('waits for a scout to come home before training them', () => {
    const veterans = ['a', 'b', 'c', 'd', 'e'].map((id) => hero(id, 'warrior', 10))
    let state = town({ roster: [...veterans, hero('r', 'rogue', 3)], scout: { heroId: 'r', finishAt: now + 60_000 } })
    state = reduce(state, { type: 'automation', drill: true })
    const back = reduce(state, { type: 'catchUp', now: now + 120_000 })
    expect(back.scout).toBeNull()
    const drill = back.drills.find((entry) => entry.heroId === 'r')
    expect(drill == null || drill.finishAt >= now + 120_000).toBe(true)
  })
})

