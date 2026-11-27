import { describe, expect, it } from 'vitest'
import { autoFormation } from './formation'
import { freshState, reduce } from './game'
import { createHero } from './hero'
import type { Hero } from './types'

function hero(id: string, classId: Hero['classId'], level: number, extra: Partial<Hero> = {}) {
  return createHero({
    id, name: id, classId, level, age: 24, gender: 'female',
    potentials: { str: 12, agi: 12, vit: 12, int: 12, wil: 12, wis: 12 },
    ...extra,
  })
}

describe('automatic party formation', () => {
  it('fills the preferred roles and uses level, then fatigue, within each role', () => {
    const roster = [
      hero('tired', 'warrior', 13, { fatigue: 40 }),
      hero('tank', 'warrior', 13, { fatigue: 5 }),
      hero('rogue', 'rogue', 12),
      hero('archer', 'archer', 14),
      hero('mage', 'mage', 11),
      hero('support', 'bard', 8),
      hero('healer', 'cleric', 7),
    ]
    const expected = [
      { id: 'tank', row: 'front' }, { id: 'archer', row: 'back' },
      { id: 'rogue', row: 'front' }, { id: 'support', row: 'back' }, { id: 'healer', row: 'back' },
    ]
    expect(autoFormation(roster, new Set(), 'venom_marsh')).toEqual(expected)
    expect(autoFormation(roster, new Set(), 'venom_marsh')).toEqual(expected)
    expect(roster.map(({ id }) => id)).toEqual(['tired', 'tank', 'rogue', 'archer', 'mage', 'support', 'healer'])
  })

  it('fills missing roles with the highest levels and caps both rows', () => {
    const roster = [
      hero('healer', 'cleric', 13), hero('rogue-a', 'rogue', 12), hero('rogue-b', 'rogue', 11),
      hero('rogue-c', 'rogue', 10), hero('mage', 'mage', 9), hero('archer', 'archer', 8),
    ]
    const slots = autoFormation(roster, new Set())
    expect(slots).toHaveLength(5)
    expect(slots.filter(({ row }) => row === 'front').map(({ id }) => id)).toEqual(['rogue-a', 'rogue-b'])
    expect(slots.filter(({ row }) => row === 'back').map(({ id }) => id)).toEqual(['healer', 'rogue-c', 'mage'])

    const ranged = autoFormation([
      hero('archer', 'archer', 12), hero('mage', 'mage', 11), hero('bard', 'bard', 10),
      hero('healer', 'cleric', 9), hero('extra', 'mage', 8),
    ], new Set())
    expect(ranged.filter(({ row }) => row === 'front').map(({ id }) => id)).toEqual(['archer', 'mage'])
  })

  it('excludes away, dead, critical and underage heroes and keeps a short party', () => {
    const roster = [
      hero('away', 'warrior', 20),
      hero('dead', 'rogue', 20, { condition: 'dead' }),
      hero('critical', 'cleric', 20, { condition: 'critical' }),
      hero('child', 'bard', 20, { age: 5 }),
      hero('tank', 'warrior', 3),
      hero('injured', 'cleric', 2, { condition: 'injured' }),
    ]
    expect(autoFormation(roster, new Set(['away']))).toEqual([{ id: 'tank', row: 'front' }, { id: 'injured', row: 'back' }])
    expect(autoFormation(roster.slice(0, 4), new Set(['away']))).toEqual([])
  })

  it('fills only the requested preset and leaves the active expedition and auto party intact', () => {
    const start = freshState(1, 0)
    const roster = [hero('away', 'warrior', 20), hero('mage', 'mage', 10), hero('healer', 'cleric', 9)]
    const original = reduce({ ...start, roster }, { type: 'add', id: 'away' })
    const sent = reduce(original, { type: 'depart' })
    expect(sent.expeditions[0]?.heroIds).toEqual(['away'])
    const presetId = sent.presets[1]!.id
    const result = reduce(sent, { type: 'autoFill', presetId })
    expect(result.presets[1]).toEqual({ ...sent.presets[1], slots: [{ id: 'mage', row: 'back' }, { id: 'healer', row: 'back' }] })
    expect(result.presets[0]).toBe(sent.presets[0])
    expect(result.auto).toBe(sent.auto)
    expect(result.expeditions).toBe(sent.expeditions)
  })
})
