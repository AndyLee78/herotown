import { describe, expect, it } from 'vitest'
import { freshState, type GameState } from './game'
import { createHero } from './hero'
import { readiness } from './readiness'
import { houseRooms } from './rooms'
import type { Hero } from './types'

// Docs/house.md: rooms on the house screen, and the battle-prep status.

const now = 1_700_000_000_000
const stats = { str: 12, agi: 12, vit: 12, int: 12, wil: 12, wis: 12 }

function person(id: string, gender: 'male' | 'female', age: number, extra: Partial<Hero> = {}): Hero {
  return { ...createHero({ id, name: id, gender, classId: 'warrior', age, potentials: stats, potential: 50 }), ...extra }
}

function town(roster: Hero[], house = 1): GameState {
  const base = freshState(5, now)
  return { ...base, roster, buildings: { ...base.buildings, house } }
}

describe('house rooms', () => {
  it('puts a couple and their children in a family room and pairs the rest', () => {
    const state = town([
      person('wife', 'female', 30, { spouseId: 'man', expecting: { dueAt: now + 1, child: person('baby', 'female', 0) } }),
      person('man', 'male', 31, { spouseId: 'wife' }),
      person('kid', 'male', 6, { parents: ['wife', 'man'] }),
      person('a', 'female', 20),
      person('b', 'male', 22),
    ])
    const view = houseRooms(state)
    const family = view.rooms.find((room) => room.kind === 'family')!
    expect(family.members.map((hero) => hero.id)).toEqual(['wife', 'man', 'kid'])
    expect(family.expecting).toBe(true)
    expect(family.beds).toBe(4)
    const shared = view.rooms.filter((room) => room.kind === 'shared')
    expect(shared[0]?.members.map((hero) => hero.id)).toEqual(['a', 'b'])
    expect(view.used).toBe(6)
    expect(view.beds).toBe(5)
    expect(view.overflow).toBe(1)
    expect(view.emptyCoupleHomes).toBe(1)
  })

  it('fills spare beds into the last shared room, then empty rooms', () => {
    const view = houseRooms(town([person('a', 'female', 20), person('b', 'female', 21), person('c', 'male', 20)], 2))
    const shared = view.rooms.filter((room) => room.kind === 'shared')
    expect(shared.map((room) => [room.members.length, room.empty])).toEqual([[2, 0], [1, 1], [0, 2], [0, 2], [0, 2]])
    expect(view.free).toBe(7)
    expect(shared.reduce((sum, room) => sum + room.empty, 0)).toBe(view.free)
  })

  it('keeps a lone parent with their children', () => {
    const view = houseRooms(town([person('mum', 'female', 30), person('kid', 'female', 7, { parents: ['mum', 'gone'] })]))
    expect(view.rooms[0]?.kind).toBe('parent')
    expect(view.rooms[0]?.members.map((hero) => hero.id)).toEqual(['mum', 'kid'])
  })
})

describe('readiness', () => {
  it('names the parties a hero is in and how worn they are', () => {
    const base = town([person('a', 'male', 20, { fatigue: 60, morale: 20 })])
    const state = {
      ...base,
      presets: base.presets.map((preset) => (preset.id === 'p2' ? { ...preset, slots: [{ id: 'a', row: 'front' as const }] } : preset)),
      auto: { ...base.auto, party: [{ id: 'a', row: 'front' as const }] },
      drills: [{ heroId: 'a', finishAt: now + 5000, xp: 10 }],
    }
    const status = readiness(state, state.roster[0]!)
    expect(status.parties).toEqual(['p2', 'auto'])
    expect(status.fatigueLevel).toBe('tired')
    expect(status.moraleLevel).toBe('low')
    expect(status.busy).toEqual({ kind: 'drill', until: now + 5000 })
  })
})
