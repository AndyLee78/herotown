import { describe, expect, it } from 'vitest'
import { createHeroUnit } from './combat'
import { moraleRules, smithRules, tavernRules, timeRules } from './data'
import { bondOf } from './family'
import { freshState, migrate, reduce, type GameState } from './game'
import { forgeGear } from './gear'
import { bequeathed, heirloomBonus, heirloomMods, isHeir } from './heirloom'
import { createHero } from './hero'
import { moraleOf } from './morale'
import { affinityScale } from './personality'
import { festivalScale, gatherLeft, gatherPreview } from './tavern'
import type { Hero, PersonalityId } from './types'

// Docs/tavern.md: rounds at the tavern, mingling, festivals, heirlooms.

const now = 1_700_000_000_000
const stats = { str: 12, agi: 12, vit: 12, int: 12, wil: 12, wis: 12 }
const blade = smithRules.recipes.find((recipe) => recipe.id === 'fine.blade')!

function hero(id: string, personality: PersonalityId = 'timid', extra: Partial<Hero> = {}): Hero {
  return { ...createHero({ id, name: id, gender: 'male', classId: 'warrior', age: 30, potentials: stats, personality }), ...extra }
}

function town(roster: Hero[], tavern = 1, extra: Partial<GameState> = {}): GameState {
  const base = freshState(5, now)
  return { ...base, gold: 1000, roster, buildings: { ...base.buildings, tavern }, ...extra }
}

describe('rounds at the tavern', () => {
  it('needs a tavern, two or three heroes, and gold', () => {
    const state = town([hero('a'), hero('b'), hero('c'), hero('d')])
    expect(reduce({ ...state, buildings: { ...state.buildings, tavern: 0 } }, { type: 'gather', heroIds: ['a', 'b'] }).notice).toBe('noTavern')
    expect(reduce(state, { type: 'gather', heroIds: ['a'] }).notice).toBe('gatherSize')
    expect(reduce(state, { type: 'gather', heroIds: ['a', 'b', 'c', 'd'] }).notice).toBe('gatherSize')
    expect(reduce({ ...state, gold: 0 }, { type: 'gather', heroIds: ['a', 'b'] }).notice).toBe('poor')
  })

  it('brings the group closer by how well they match, cheers them and tires them a little', () => {
    const state = town([hero('a', 'social'), hero('b', 'gentle'), hero('c', 'hotheaded'), hero('d', 'hotheaded')])
    let next = reduce(state, { type: 'gather', heroIds: ['a', 'b'] })
    next = reduce(next, { type: 'gather', heroIds: ['c', 'd'] })
    expect(bondOf(next, 'a', 'b')).toBeCloseTo(tavernRules.affinity * affinityScale(state.roster[0]!, state.roster[1]!))
    expect(bondOf(next, 'a', 'b')).toBeGreaterThan(bondOf(next, 'c', 'd'))
    expect(next.gold).toBe(state.gold - 2 * tavernRules.cost)
    expect(moraleOf(next.roster[0]!)).toBeGreaterThan(moraleRules.base)
    expect(next.roster[0]!.fatigue).toBe(tavernRules.fatigue)
    expect(gatherPreview(state, ['a', 'b'])[0]!.affinity).toBeCloseTo(bondOf(next, 'a', 'b'))
  })

  it('allows a few rounds a season and refills when the season turns', () => {
    let state = town([hero('a'), hero('b')])
    for (let round = 0; round < tavernRules.sessionsPerSeason[0]!; round += 1) {
      state = reduce(state, { type: 'gather', heroIds: ['a', 'b'] })
    }
    expect(gatherLeft(state)).toBe(0)
    expect(reduce(state, { type: 'gather', heroIds: ['a', 'b'] }).notice).toBe('tavernFull')
    const turned = { ...state, calendar: { ...state.calendar, season: 'summer' as const } }
    expect(gatherLeft(turned)).toBe(tavernRules.sessionsPerSeason[0])
  })

  it('keeps away heroes who are out', () => {
    const state = town([hero('a'), hero('b')], 1, { drills: [{ heroId: 'b', finishAt: now + 1000, xp: 1 }] })
    expect(reduce(state, { type: 'gather', heroIds: ['a', 'b'] }).notice).toBe('busyHero')
  })
})

describe('mingling and festivals', () => {
  it('adds affinity each season by tavern level', () => {
    const plain = town([hero('a'), hero('b')], 0)
    const late = (state: GameState) => ({ ...state, calendar: { ...state.calendar, intoSeasonMs: timeRules.seasonMs - 1000 } })
    const without = reduce(late(plain), { type: 'catchUp', now: now + 2000 })
    const withTavern = reduce(late({ ...plain, buildings: { ...plain.buildings, tavern: 3 } }), { type: 'catchUp', now: now + 2000 })
    expect(bondOf(withTavern, 'a', 'b') - bondOf(without, 'a', 'b')).toBeCloseTo(3 * tavernRules.minglePerLevel)
  })

  it('makes the festival bigger', () => {
    const held = reduce(town([hero('a', 'timid')], 2), { type: 'festival' })
    expect(festivalScale(town([], 2))).toBe(tavernRules.festivalScale[1])
    expect(moraleOf(held.roster[0]!)).toBeCloseTo(moraleRules.base + moraleRules.festival.morale * tavernRules.festivalScale[1]!)
  })
})

describe('heirlooms', () => {
  function family(): GameState {
    const grandpa = hero('g', 'timid', { family: 'Stone' })
    const father = hero('f', 'timid', { parents: ['g', 'gm'] })
    const son = hero('s', 'timid', { parents: ['f', 'm'] })
    const stranger = hero('x')
    return town([father, son, stranger], 0, { retirees: [{ hero: { ...grandpa, gear: [...grandpa.gear, forgeGear(blade, 'old')] }, retiredYear: 1, building: null }] })
  }

  it('knows descendants up to three generations', () => {
    const state = family()
    expect(isHeir(state, 's', 'g')).toBe(true)
    expect(isHeir(state, 'f', 'g')).toBe(true)
    expect(isHeir(state, 'x', 'g')).toBe(false)
  })

  it('lets a retiree hand gear to a descendant, who wears it stronger', () => {
    const state = family()
    expect(reduce(state, { type: 'bequeath', retireeId: 'g', gearId: 'old', toId: 'x' }).notice).toBe('notHeir')
    const given = reduce(state, { type: 'bequeath', retireeId: 'g', gearId: 'old', toId: 's' })
    const son = given.roster.find((entry) => entry.id === 's')!
    const item = son.gear.find((entry) => entry.id === 'old')!
    expect(item.heirloom).toMatchObject({ ownerId: 'g', generations: 1, family: 'Stone' })
    expect(given.retirees[0]!.hero.gear.some((entry) => entry.id === 'old')).toBe(false)
    expect(heirloomBonus(given, son, item)).toBe(tavernRules.heirloom.bonus[0])
    const mods = heirloomMods(given, son)
    const plain = createHeroUnit({ hero: son, row: 'front' }, 0)
    const boosted = createHeroUnit({ hero: son, row: 'front', heirloom: mods }, 0)
    expect(boosted.attack).toBeGreaterThan(plain.attack)
  })

  it('grows a generation each time it passes down the line', () => {
    const state = family()
    const first = bequeathed(state, state.retirees[0]!.hero, [forgeGear(blade, 'b')])[0]!
    const father = state.roster.find((entry) => entry.id === 'f')!
    const second = bequeathed(state, father, [first])[0]!
    expect(second.heirloom).toMatchObject({ ownerId: 'f', generations: 2 })
    const stranger = state.roster.find((entry) => entry.id === 'x')!
    expect(bequeathed(state, stranger, [second])[0]!.heirloom).toMatchObject({ ownerId: 'x', generations: 1 })
    expect(bequeathed(state, father, [{ ...forgeGear(blade, 'c'), recipeId: 'starter' }])).toHaveLength(0)
  })

  it('comes home to the stash when its owner falls for good, and comforts the heir once', () => {
    const state = family()
    const father = state.roster.find((entry) => entry.id === 'f')!
    const heirloom = bequeathed(state, father, [forgeGear(blade, 'h')])[0]!
    const mourning = { ...state, roster: state.roster.filter((entry) => entry.id !== 'f').map((entry) => (entry.id === 's' ? { ...entry, morale: 30 } : entry)), graveyard: [{ id: 'f', name: 'f', classId: 'warrior' as const, level: 1, clears: [], parents: ['g', 'gm'] as [string, string] }], stash: [heirloom] }
    const worn = reduce(mourning, { type: 'equip', heroId: 's', gearId: 'h' })
    const son = worn.roster.find((entry) => entry.id === 's')!
    expect(moraleOf(son)).toBeCloseTo(30 + tavernRules.heirloom.comfort * 1)
    expect(son.gear.find((entry) => entry.id === 'h')!.heirloom?.comforted).toEqual(['s'])
  })

  it('opens a version 20 save with no tavern rounds and keeps heirloom marks', () => {
    const state = family()
    const old = JSON.parse(JSON.stringify({ ...state, version: 20, stash: bequeathed(state, state.retirees[0]!.hero, [forgeGear(blade, 'k')]) })) as Record<string, unknown>
    delete old.tavern
    const opened = migrate(old, now)
    expect(opened.tavern).toBeNull()
    expect(opened.stash[0]?.heirloom?.ownerId).toBe('g')
  })
})

describe('review 161d1d1 fixes', () => {
  function line(): GameState {
    const grandpa = hero('g', 'timid', { family: 'Stone' })
    const son = hero('s', 'timid', { parents: ['g', 'gm'] })
    return town([son], 0, { retirees: [{ hero: grandpa, retiredYear: 1, building: null }] })
  }

  it('keeps the trinket slot limit when handing a trinket down', () => {
    const charm = (id: string) => ({ id, recipeId: 'trinket.alert', slot: 'trinket' as const, grade: 'common' as const, enhance: 0 })
    const base = line()
    const state = {
      ...base,
      roster: base.roster.map((entry) => ({ ...entry, gear: [...entry.gear, charm('c1'), charm('c2')] })),
      retirees: base.retirees.map((entry) => ({ ...entry, hero: { ...entry.hero, gear: [...entry.hero.gear, charm('old')] } })),
    }
    const given = reduce(state, { type: 'bequeath', retireeId: 'g', gearId: 'old', toId: 's' })
    const trinkets = given.roster[0]!.gear.filter((gear) => gear.slot === 'trinket')
    expect(trinkets.map((gear) => gear.id)).toEqual(['c2', 'old'])
    expect(given.stash.map((gear) => gear.id)).toEqual(['c1'])
  })

  it('does not hand gear to a fallen heir', () => {
    const base = line()
    const state = {
      ...base,
      roster: base.roster.map((entry) => ({ ...entry, condition: 'dead' as const })),
      retirees: base.retirees.map((entry) => ({ ...entry, hero: { ...entry.hero, gear: [...entry.hero.gear, forgeGear(blade, 'old')] } })),
    }
    expect(reduce(state, { type: 'bequeath', retireeId: 'g', gearId: 'old', toId: 's' }).notice).toBe('busyHero')
  })

  it('remembers who a piece already comforted when it passes on', () => {
    const state = line()
    const once = { ...forgeGear(blade, 'h'), heirloom: { ownerId: 'g', ownerName: 'g', generations: 1, comforted: ['s'] } }
    const son = state.roster[0]!
    expect(bequeathed(state, son, [once])[0]!.heirloom?.comforted).toEqual(['s'])
  })

  it('stamps two rounds between ticks differently', () => {
    let state = town([hero('a'), hero('b')], 2)
    state = reduce(state, { type: 'gather', heroIds: ['a', 'b'] })
    const first = state.tavern!.last!.at
    state = reduce(state, { type: 'gather', heroIds: ['a', 'b'] })
    expect(state.tavern!.last!.at).toBeGreaterThan(first)
  })
})
