import { describe, expect, it } from 'vitest'
import { createHeroUnit } from './combat'
import { classById, lootRules } from './data'
import { freshState, migrate, reduce, type GameState } from './game'
import { gearEffect, gearMods, normalizeGear, recipeById } from './gear'
import { createHero } from './hero'
import { dungeonLoot, raidLoot, rollDrop, uniqueById, uniqueGear } from './loot'
import { gearValue } from './market'
import { createRng } from './rng'
import { heroSkillEffects } from './skills'
import type { ClassId, Gear, Hero } from './types'

// Docs/identity.md 5c: dungeon drops, boss and raid uniques, sets, exchange.

const now = 1_700_000_000_000
const stats = { str: 16, agi: 14, vit: 16, int: 14, wil: 14, wis: 16 }
const rich = { flame: 999, frost: 999, light: 999, abyss: 999, scale: 99, crown: 99, core: 99, valor: 999, token: 999 }

function hero(id: string, classId: ClassId, gear: Gear[] = []): Hero {
  const starter = classById(classId).skills[0]!.id
  return { ...createHero({ id, name: id, gender: 'female', classId, age: 25, potentials: stats, level: 20, training: 19, learned: [starter], personality: 'loner' }), gear }
}

function unique(id: string, gearId = id): Gear {
  return uniqueGear(uniqueById(id)!, gearId)
}

function village(extra: Partial<GameState> = {}): GameState {
  return { ...freshState(5, now), vault: rich, ...extra }
}

describe('dungeon drops', () => {
  it('rolls the tier’s grades only, rare pieces as weapons', () => {
    for (let seed = 1; seed <= 200; seed += 1) {
      const low = rollDrop(1, 'a', createRng(seed))!
      expect(low.grade).toBe('common')
      const high = rollDrop(7, 'b', createRng(seed))!
      expect(['epic', 'legend']).toContain(high.grade)
      const mid = rollDrop(3, 'c', createRng(seed))!
      expect(['fine', 'rare']).toContain(mid.grade)
      if (mid.grade === 'rare') {
        expect(mid.slot).toBe('weapon')
      }
      expect(mid.options?.length ?? 0).toBe({ fine: 1, rare: 2 }[mid.grade as 'fine' | 'rare'])
    }
  })

  it('gives a sure piece on a first clear and none in special dungeons', () => {
    for (let seed = 1; seed <= 30; seed += 1) {
      const state = { ...village(), seed }
      const first = dungeonLoot(state, 'barrow', true, false, 0)
      expect(first.stash.length).toBeGreaterThanOrEqual(1)
      expect(first.loot.at(-1)?.source).toBe('barrow')
      expect(dungeonLoot(state, 'trial_flame_1', true, false, 0).stash).toHaveLength(0)
    }
  })

  it('drops about one in ten on repeats by hand, half that on auto runs', () => {
    let hand = 0
    let auto = 0
    let state = village()
    for (let run = 0; run < 2000; run += 1) {
      const handed = dungeonLoot(state, 'hill_cave', false, false, 0)
      hand += handed.stash.length - state.stash.length
      const autoed = dungeonLoot(state, 'hill_cave', false, true, 0)
      auto += autoed.stash.length - state.stash.length
      state = { ...state, craftNonce: handed.craftNonce }
    }
    expect(hand / 2000).toBeGreaterThan(0.07)
    expect(hand / 2000).toBeLessThan(0.13)
    expect(auto / 2000).toBeGreaterThan(0.03)
    expect(auto / 2000).toBeLessThan(0.07)
  })

  it('keeps only the last finds in the list', () => {
    let state = village()
    for (let run = 0; run < 30; run += 1) {
      state = dungeonLoot(state, 'hill_cave', true, false, 0)
    }
    expect(state.loot).toHaveLength(lootRules.recent)
    expect(reduce(state, { type: 'seenLoot' }).loot).toEqual([])
  })

  it('finds the dungeon boss’s unique now and then', () => {
    let found = 0
    let state = village()
    for (let run = 0; run < 3000; run += 1) {
      const next = dungeonLoot(state, 'dragon_nest', false, false, 0)
      found += next.stash.filter((item) => item.unique === 'dragonbane').length
      state = { ...state, craftNonce: next.craftNonce }
    }
    expect(found / 3000).toBeGreaterThan(0.02)
    expect(found / 3000).toBeLessThan(0.06)
  })

  it('drops on a real first clear', () => {
    const start = freshState(8, now)
    const tank = createHero({ id: 'tank', name: 'Tank', gender: 'male', classId: 'warrior', age: 28, potentials: { str: 18, agi: 12, vit: 18, int: 6, wil: 8, wis: 6 }, gear: [] })
    const healer = createHero({ id: 'heal', name: 'Heal', gender: 'female', classId: 'cleric', age: 28, potentials: { str: 6, agi: 8, vit: 12, int: 8, wil: 12, wis: 18 }, gear: [] })
    const ready = { ...start, roster: [tank, healer], presets: start.presets.map((preset, index) => (index === 0 ? { ...preset, slots: [{ id: 'tank', row: 'front' as const }, { id: 'heal', row: 'back' as const }] } : preset)) }
    const sent = reduce(ready, { type: 'depart' })
    const back = reduce(sent, { type: 'catchUp', now: Math.max(sent.lastTickAt + 1, ...sent.expeditions.map((expedition) => expedition.returnAt)) })
    expect(back.history[0]?.victory).toBe(true)
    expect(back.loot.length).toBeGreaterThanOrEqual(1)
    expect(back.stash.some((item) => item.id === back.loot[0]!.gearId)).toBe(true)
  })
})

describe('uniques', () => {
  it('take the base recipe’s numbers and a fixed effect, with no type or options', () => {
    const bane = unique('dragonbane')
    expect(gearMods(bane)).toEqual(gearMods({ ...bane, unique: undefined }))
    expect(gearMods(bane).attack).toBe(recipeById('legend.blade')!.attack)
    expect(gearEffect(bane)).toMatchObject({ bossDamage: 0.1 })
    const eye = unique('wyrmeye')
    expect(gearMods(eye)).toEqual({ attack: 0, defense: 0 })
    expect(eye.slot).toBe('trinket')
    const saved = normalizeGear({ ...bane, type: 'axe', options: [{ id: 'crit', value: 0.05 }] }, 'warrior')
    expect(saved.unique).toBe('dragonbane')
    expect(saved.type).toBeUndefined()
    expect(saved.options).toBeUndefined()
    expect(normalizeGear({ ...bane, unique: 'nope' }, 'warrior').unique).toBeUndefined()
    expect(normalizeGear({ ...bane, unique: 'wyrmeye' }, 'warrior').unique).toBeUndefined()
  })

  it('fit any class and fetch their own price', () => {
    const rogue = hero('r', 'rogue')
    const state = village({ roster: [rogue], stash: [unique('dragonbane')] })
    expect(reduce(state, { type: 'equip', heroId: 'r', gearId: 'dragonbane' }).notice).toBeNull()
    expect(gearValue(unique('dragonbane'))).toBeGreaterThan(gearValue(unique('gravecleaver')))
  })

  it('come from raid bosses more often at later tiers', () => {
    const rate = (tier: number) => {
      let found = 0
      let state = village()
      for (let run = 0; run < 1000; run += 1) {
        const next = raidLoot(state, 'lich', tier)
        const piece = next.stash.at(-1)
        if (next.stash.length > state.stash.length) {
          found += 1
          expect(['lichshroud', 'lichscepter']).toContain(piece?.unique)
        }
        state = { ...state, craftNonce: next.craftNonce }
      }
      return found / 1000
    }
    expect(rate(1)).toBeLessThan(rate(3))
    expect(rate(1)).toBeGreaterThan(0.18)
    expect(rate(3)).toBeLessThan(0.68)
  })

  it('can be bought with valour once the dungeon is cleared, raid ones with spoils', () => {
    const locked = reduce(village(), { type: 'exchange', uniqueId: 'dragonbane' })
    expect(locked.notice).toBe('locked')
    const open = village({ cleared: ['dragon_nest'] })
    const bought = reduce(open, { type: 'exchange', uniqueId: 'dragonbane' })
    expect(bought.stash.at(-1)?.unique).toBe('dragonbane')
    expect(bought.vault.valor).toBe(rich.valor - 100)
    const raid = reduce(village(), { type: 'exchange', uniqueId: 'wyrmscale' })
    expect(raid.vault.scale).toBe(rich.scale - 8)
    expect(reduce(village({ vault: { ...rich, scale: 3 } }), { type: 'exchange', uniqueId: 'wyrmscale' }).notice).toBe('resources')
    expect(reduce(village(), { type: 'exchange', uniqueId: 'nope' }).notice).toBe('missing')
  })
})

describe('sets', () => {
  it('add the two- and three-piece bonuses, each unique counted once', () => {
    const none = heroSkillEffects(hero('a', 'warrior'))
    const two = heroSkillEffects(hero('a', 'warrior', [unique('dragonbane'), unique('wyrmscale')]))
    const three = heroSkillEffects(hero('a', 'warrior', [unique('dragonbane'), unique('wyrmscale'), unique('wyrmeye')]))
    const twice = heroSkillEffects(hero('a', 'warrior', [unique('dragonbane'), unique('dragonbane', 'd2')]))
    expect(two.blastGuard - none.blastGuard).toBeCloseTo(0.15 + 0.1)
    expect(three.bossDamage - none.bossDamage).toBeCloseTo(0.1 + 0.15)
    expect(twice.blastGuard).toBe(none.blastGuard)
    const keeper = heroSkillEffects(hero('k', 'cleric', [unique('gravecleaver'), unique('lichshroud'), unique('cryptcrown')]))
    expect(keeper.undying).toBe(true)
    expect(createHeroUnit({ hero: hero('k', 'cleric', [unique('gravecleaver'), unique('lichshroud'), unique('cryptcrown')]), row: 'front' }, 0).undying).toBe(true)
  })
})

describe('the save', () => {
  it('keeps uniques and the find list', () => {
    const state = village({ stash: [unique('titanbell')], loot: [{ gearId: 'titanbell', source: 'raid.titan', at: now }] })
    const loaded = migrate(JSON.parse(JSON.stringify(state)), now)
    expect(loaded.stash[0]).toEqual(unique('titanbell'))
    expect(loaded.loot).toEqual(state.loot)
    const old = JSON.parse(JSON.stringify({ ...state, version: 28 }))
    delete old.loot
    expect(migrate(old, now).loot).toEqual([])
  })
})
