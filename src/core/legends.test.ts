import { describe, expect, it } from 'vitest'
import { createHeroUnit } from './combat'
import { familyRules, legendsRules, moraleRules, smithRules } from './data'
import { legendBonus } from './family'
import { freshState, migrate, reduce, type GameState, type Grave } from './game'
import { forgeGear } from './gear'
import { createHero } from './hero'
import { blessing, livingLegends, shrineMorale, shrineSlots } from './legends'
import { driftMorale, moraleOf } from './morale'
import type { Hero } from './types'

// Docs/legends.md: the hall of fame.

const now = 1_700_000_000_000
const stats = { str: 12, agi: 12, vit: 12, int: 12, wil: 12, wis: 12 }
const blade = smithRules.recipes.find((recipe) => recipe.id === 'fine.blade')!

function hero(id: string, extra: Partial<Hero> = {}): Hero {
  return { ...createHero({ id, name: id, gender: 'male', classId: 'warrior', age: 30, potentials: stats, personality: 'timid' }), ...extra }
}

const legend: Grave = { id: 'old', name: 'Old', classId: 'warrior', level: 15, clears: [], legend: true, family: 'Stone', parents: ['x', 'y'] }

function town(hall: number, extra: Partial<GameState> = {}): GameState {
  const base = freshState(5, now)
  return { ...base, roster: [hero('kid', { parents: ['old', 'm'], family: 'Stone' }), hero('other')], graveyard: [legend], buildings: { ...base.buildings, legends: hall }, ...extra }
}

describe('family bonus', () => {
  it('counts for more with the hall built, and counts retired legends too', () => {
    expect(legendBonus(town(0), 'Stone')).toBe(familyRules.legendPotential)
    expect(legendBonus(town(2), 'Stone')).toBe(legendsRules.legendPotential[1])
    const veteran = hero('vet', { level: 20, family: 'Stone', age: 60 })
    const withRetiree = town(1, { retirees: [{ hero: veteran, retiredYear: 1, building: null }] })
    expect(livingLegends(withRetiree).map((entry) => entry.id)).toEqual(['vet'])
    expect(legendBonus(withRetiree, 'Stone')).toBe(2 * legendsRules.legendPotential[0]!)
    expect(livingLegends({ ...withRetiree, buildings: { ...withRetiree.buildings, legends: 0 } })).toEqual([])
  })
})

describe('ancestral blessing', () => {
  it('lifts the attack of a legend’s descendant only', () => {
    const state = town(1)
    const [kid, other] = state.roster
    expect(blessing(state, kid!)).toBe(legendsRules.blessing[0])
    expect(blessing(state, other!)).toBe(0)
    expect(blessing(town(0), kid!)).toBe(0)
    const plain = createHeroUnit({ hero: kid!, row: 'front' }, 0)
    const blessed = createHeroUnit({ hero: kid!, row: 'front', blessing: blessing(state, kid!) }, 0)
    expect(blessed.attack).toBeCloseTo(plain.attack * (1 + legendsRules.blessing[0]!))
  })
})

describe('heirlooms on display', () => {
  const heirloom = { ...forgeGear(blade, 'h1'), heirloom: { ownerId: 'old', ownerName: 'Old', generations: 1 } }

  it('takes heirlooms from the stash, gives fame once, and lifts settled spirits', () => {
    let state = town(1, { stash: [heirloom, forgeGear(blade, 'plain')] })
    expect(reduce(town(0, { stash: [heirloom] }), { type: 'enshrine', gearId: 'h1' }).notice).toBe('noLegends')
    expect(reduce(state, { type: 'enshrine', gearId: 'plain' }).notice).toBe('missing')
    state = reduce(state, { type: 'enshrine', gearId: 'h1' })
    expect(state.shrine?.gear.map((gear) => gear.id)).toEqual(['h1'])
    expect(state.fame).toBe(town(1).fame + legendsRules.shrineFame)
    expect(shrineMorale(state)).toBe(legendsRules.shrineMorale)
    const settled = driftMorale(hero('a', { morale: 10 }), 1000, moraleRules.base + shrineMorale(state))
    expect(moraleOf(settled)).toBe(moraleRules.base + legendsRules.shrineMorale)
    state = reduce(state, { type: 'unshrine', gearId: 'h1' })
    expect(state.stash.some((gear) => gear.id === 'h1')).toBe(true)
    const again = reduce(state, { type: 'enshrine', gearId: 'h1' })
    expect(again.fame).toBe(state.fame)
  })

  it('has room for a few by hall level', () => {
    const many = Array.from({ length: 3 }, (_, index) => ({ ...heirloom, id: `h${index}` }))
    let state = town(1, { stash: many })
    expect(shrineSlots(state)).toBe(legendsRules.shrineSlots[0])
    state = reduce(reduce(state, { type: 'enshrine', gearId: 'h0' }), { type: 'enshrine', gearId: 'h1' })
    expect(reduce(state, { type: 'enshrine', gearId: 'h2' }).notice).toBe('shrineFull')
  })

  it('opens a version 21 save with nothing on display', () => {
    const old = JSON.parse(JSON.stringify({ ...town(0), version: 21 })) as Record<string, unknown>
    delete old.shrine
    expect(migrate(old, now).shrine).toBeNull()
  })
})

describe('review 4c3aec1 fixes', () => {
  it('loads only heirlooms, each once, and sends extras past the room to the stash', () => {
    const relic = (id: string) => ({ ...forgeGear(blade, id), heirloom: { ownerId: 'old', ownerName: 'Old', generations: 1 } })
    const saved = { ...town(1), shrine: { gear: [relic('a'), relic('a'), forgeGear(blade, 'plain'), relic('b'), relic('c')], honoured: [] } }
    const opened = migrate(JSON.parse(JSON.stringify(saved)), now)
    expect(opened.shrine?.gear.map((gear) => gear.id)).toEqual(['a', 'b'])
    expect(opened.stash.map((gear) => gear.id)).toContain('c')
    expect(shrineMorale(opened)).toBe(2 * legendsRules.shrineMorale)
  })

  it('lifts no spirits without the hall', () => {
    const relic = { ...forgeGear(blade, 'r'), heirloom: { ownerId: 'old', ownerName: 'Old', generations: 1 } }
    expect(shrineMorale({ ...town(0), shrine: { gear: [relic], honoured: [] } })).toBe(0)
  })
})
