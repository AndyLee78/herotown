import { describe, expect, it } from 'vitest'
import { createHeroUnit } from './combat'
import { classById, smithRules } from './data'
import { gainXp } from './dungeon'
import { exportSave, freshState, importSave, migrate, reduce, SAVE_VERSION, type GameState } from './game'
import { canWield, forgeGear, gearEffect, normalizeGear, optionRange, recipeById, splitOrder, weaponTypes } from './gear'
import { createHero } from './hero'
import { heroSkillEffects } from './skills'
import type { ClassId, Gear, GearGrade, Hero } from './types'

// Docs/identity.md 5b: weapon and armour types, rolled options, rerolls.

const now = 1_700_000_000_000
const stats = { str: 16, agi: 14, vit: 16, int: 14, wil: 14, wis: 16 }
const plenty = { wood: 9999, stone: 9999, iron: 9999, bone: 9999, herb: 9999, crystal: 9999 }

function hero(id: string, classId: ClassId, gear: Gear[] = []): Hero {
  const starter = classById(classId).skills[0]!.id
  return { ...createHero({ id, name: id, gender: 'female', classId, age: 25, potentials: stats, level: 10, training: 9, learned: [starter], personality: 'loner' }), gear }
}

function smithy(extra: Partial<GameState> = {}): GameState {
  const base = freshState(5, now)
  return { ...base, gold: 99_999, materials: plenty, buildings: { ...base.buildings, smith: 5 }, ...extra }
}

function recipe(id: string) {
  return recipeById(id)!
}

describe('rolled options', () => {
  const grades: Array<[string, GearGrade, number]> = [
    ['iron.blade', 'common', 0],
    ['fine.mail', 'fine', 1],
    ['flame.blade', 'rare', 2],
    ['epic.mail', 'epic', 3],
    ['legend.blade', 'legend', 3],
  ]

  it('rolls as many options as the grade allows, each once, in range and for the slot', () => {
    for (const [id, grade, count] of grades) {
      for (let seed = 1; seed <= 40; seed += 1) {
        const piece = forgeGear(recipe(id), 'x', seed)
        const options = piece.options ?? []
        expect(options).toHaveLength(count)
        expect(new Set(options.map((option) => option.id)).size).toBe(count)
        for (const option of options) {
          const def = smithRules.optionPool.find((entry) => entry.id === option.id)!
          expect(piece.slot === 'weapon' ? def.weapon : def.armor).toBe(true)
          const range = optionRange(option.id, grade)!
          expect(option.value).toBeGreaterThanOrEqual(range.min)
          expect(option.value).toBeLessThanOrEqual(range.max)
        }
      }
    }
  })

  it('is the same piece for the same seed, and has no options without one', () => {
    expect(forgeGear(recipe('epic.mail'), 'a', 9)).toEqual(forgeGear(recipe('epic.mail'), 'a', 9))
    expect(forgeGear(recipe('epic.mail'), 'a').options).toBeUndefined()
  })

  it('reads the old single option as the same flat option', () => {
    const old = { id: 'o', recipeId: 'flame.blade', slot: 'weapon', grade: 'rare', enhance: 0, option: 'guard' } as unknown as Gear
    expect(normalizeGear(old, 'warrior').options).toEqual([{ id: 'guard', value: smithRules.optionGuard }])
    expect((normalizeGear(old, 'warrior') as { option?: unknown }).option).toBeUndefined()
  })

  it('drops unknown or repeated options and clamps values from a save', () => {
    const odd = { id: 'o', recipeId: 'epic.mail', slot: 'armor', grade: 'epic', enhance: 0, options: [{ id: 'hp', value: 9 }, { id: 'hp', value: 0.04 }, { id: 'nope', value: 1 }] } as unknown as Gear
    const read = normalizeGear(odd, 'warrior')
    expect(read.options).toEqual([{ id: 'hp', value: optionRange('hp', 'legend')!.max }])
  })

  it('adds flat options to attack and defence and the rest to the hero totals', () => {
    const blade: Gear = { id: 'b', recipeId: 'iron.blade', slot: 'weapon', grade: 'common', enhance: 0, options: [{ id: 'power', value: 4 }, { id: 'crit', value: 0.03 }, { id: 'xp', value: 0.05 }] }
    const mail: Gear = { id: 'm', recipeId: 'iron.mail', slot: 'armor', grade: 'common', enhance: 0, options: [{ id: 'hp', value: 0.05 }, { id: 'blastGuard', value: 0.08 }, { id: 'lucky', value: 0.04 }] }
    const bare = hero('a', 'warrior', [{ ...blade, options: [] }, { ...mail, options: [] }])
    const geared = hero('a', 'warrior', [blade, mail])
    const effects = heroSkillEffects(geared)
    expect(effects.crit - heroSkillEffects(bare).crit).toBeCloseTo(0.03)
    expect(effects.xpGain).toBeCloseTo(0.05)
    expect(effects.lucky).toBeCloseTo(0.04)
    const plain = createHeroUnit({ hero: bare, row: 'front' }, 0)
    const strong = createHeroUnit({ hero: geared, row: 'front' }, 0)
    expect(strong.attack).toBeGreaterThan(plain.attack)
    expect(strong.maxHp).toBeGreaterThan(plain.maxHp)
    expect(strong.blastGuard).toBeCloseTo(0.08)
  })

  it('caps blast guard and adds experience from gear', () => {
    const walls: Gear[] = [{ id: 'm', recipeId: 'iron.mail', slot: 'armor', grade: 'common', enhance: 0, options: [{ id: 'blastGuard', value: 0.16 }] }, { id: 't', recipeId: 'iron.mail', slot: 'armor', grade: 'common', enhance: 0, type: 'plate', options: [{ id: 'blastGuard', value: 0.16 }] }]
    const many = hero('a', 'warrior', [...walls, ...walls, ...walls, ...walls])
    expect(createHeroUnit({ hero: many, row: 'front' }, 0).blastGuard).toBe(smithRules.blastGuardCap)
    const scholar = hero('s', 'mage', [{ id: 'w', recipeId: 'iron.blade', slot: 'weapon', grade: 'common', enhance: 0, options: [{ id: 'xp', value: 0.1 }] }])
    const plain = hero('s', 'mage')
    expect(gainXp(scholar, 100).xp - gainXp(plain, 100).xp).toBe(10)
  })
})

describe('weapon and armour types', () => {
  it('gives every class at least two weapon types', () => {
    for (const klass of ['warrior', 'rogue', 'archer', 'mage', 'cleric', 'bard', 'dancer'] as ClassId[]) {
      expect(weaponTypes(klass).length).toBeGreaterThanOrEqual(2)
    }
  })

  it('adds the type’s effect', () => {
    const axe = forgeGear(recipe('iron.blade'), 'x', undefined, 'axe')
    expect(gearEffect(axe)).toMatchObject({ attack: 0.15, speed: -0.05 })
    const robe = forgeGear(recipe('iron.mail'), 'r', undefined, 'robe')
    expect(gearEffect(robe)).toMatchObject({ heal: 0.08, aoePower: 0.08 })
    // Untyped pieces stay as they were.
    expect(gearEffect(forgeGear(recipe('iron.blade'), 'p'))).toEqual({})
    // A weapon type never sticks to armour.
    expect(forgeGear(recipe('iron.mail'), 'q', undefined, 'axe').type).toBeUndefined()
  })

  it('lets only the right classes wield a weapon type; armour and untyped weapons fit anyone', () => {
    const axe = forgeGear(recipe('iron.blade'), 'x', undefined, 'axe')
    expect(canWield('warrior', axe)).toBe(true)
    expect(canWield('rogue', axe)).toBe(false)
    expect(canWield('rogue', forgeGear(recipe('iron.blade'), 'p'))).toBe(true)
    expect(canWield('mage', forgeGear(recipe('iron.mail'), 'm', undefined, 'plate'))).toBe(true)
    const state = smithy({ roster: [hero('r', 'rogue'), hero('w', 'warrior')], stash: [axe] })
    expect(reduce(state, { type: 'equip', heroId: 'r', gearId: 'x' }).notice).toBe('wrongClass')
    expect(reduce(state, { type: 'equip', heroId: 'w', gearId: 'x' }).roster[1]!.gear.some((item) => item.id === 'x')).toBe(true)
  })
})

describe('crafting with a type', () => {
  it('makes the chosen type and rolls options when the smith finishes', () => {
    const started = reduce(smithy(), { type: 'craft', recipeId: 'flame.blade', gearType: 'crossbow', now })
    expect(started.smith?.gearType).toBe('crossbow')
    const done = reduce(started, { type: 'catchUp', now: now + recipe('flame.blade').ms })
    const piece = done.stash.at(-1)!
    expect(piece.type).toBe('crossbow')
    expect(piece.options).toHaveLength(2)
  })

  it('refuses a type that does not fit the recipe', () => {
    expect(reduce(smithy(), { type: 'craft', recipeId: 'iron.mail', gearType: 'axe', now }).notice).toBe('recipe')
    expect(reduce(smithy(), { type: 'craft', recipeId: 'iron.blade', gearType: 'plate', now }).notice).toBe('recipe')
  })

  it('keeps the type on a queued order and refunds it whole', () => {
    const busy = reduce(smithy(), { type: 'craft', recipeId: 'iron.blade', now })
    const queued = reduce(busy, { type: 'craft', recipeId: 'iron.mail', gearType: 'leather', now })
    expect(queued.automation.queues.smith).toEqual(['iron.mail@leather'])
    expect(splitOrder('iron.mail@leather')).toEqual({ recipeId: 'iron.mail', type: 'leather' })
    expect(queued.gold).toBe(busy.gold - recipe('iron.mail').gold)
    const cancelled = reduce(queued, { type: 'dequeue', building: 'smith', index: 0 })
    expect(cancelled.gold).toBe(busy.gold)
    const both = reduce(queued, { type: 'catchUp', now: now + recipe('iron.blade').ms + recipe('iron.mail').ms })
    expect(both.stash.some((item) => item.recipeId === 'iron.mail' && item.type === 'leather')).toBe(true)
  })
})

describe('the save', () => {
  it('keeps types and options through export and import', () => {
    const piece = forgeGear(recipe('epic.mail'), 'e', 4, 'plate')
    const state = smithy({ stash: [piece] })
    const loaded = importSave(exportSave(state), now)
    expect(loaded.version).toBe(SAVE_VERSION)
    expect(SAVE_VERSION).toBe(28)
    expect(loaded.stash[0]).toEqual(piece)
    expect(migrate(JSON.parse(JSON.stringify(state)), now).stash[0]).toEqual(piece)
  })
})
