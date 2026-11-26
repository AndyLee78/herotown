import { describe, expect, it } from 'vitest'
import { ageLook, gearAuraOf, gearStyleKey, gearStyleOf, hairColor, lookFor, lookKey, mixHex } from './look'

const hero = { id: '4-0', classId: 'warrior' as const, gender: 'male' as const, age: 24 }

describe('hero look', () => {
  it('gives the same hero the same look', () => {
    expect(lookFor(hero)).toEqual(lookFor(hero))
  })

  it('keeps colours when the hero ages', () => {
    const young = lookFor(hero)
    const old = lookFor({ ...hero, age: 44 })
    expect(old.skin).toBe(young.skin)
    expect(old.hair).toBe(young.hair)
    expect(old.eye).toBe(young.eye)
    expect(lookKey(old)).not.toBe(lookKey(young))
  })

  it('gives different heroes varied looks', () => {
    const keys = new Set(Array.from({ length: 40 }, (_, index) => lookKey(lookFor({ ...hero, id: `h-${index}` }))))
    expect(keys.size).toBeGreaterThan(20)
  })

  it('keeps the looks heroes had before genes moved into the core', () => {
    expect(lookFor({ id: '4-0', classId: 'mage', gender: 'male', age: 55 })).toMatchObject({ skin: '#7b4c30', hair: '#7b4a2a', eye: '#2a2522', style: 'bald', beard: false })
    expect(lookFor({ id: '1-v3', classId: 'mage', gender: 'female', age: 24 })).toMatchObject({ skin: '#d49d6e', hair: '#b0722f', eye: '#3c6fa8', style: 'ponytail', beard: false })
  })

  it('draws a child from stored genes', () => {
    const genes = { skin: '#123456', hair: '#654321', eye: '#3c6fa8', style: 1, beard: false, height: 1, balding: false }
    expect(lookFor({ ...hero, genes })).toMatchObject({ skin: '#123456', hair: '#654321', style: 'spiky' })
  })

  it('never gives a woman a beard', () => {
    for (let index = 0; index < 40; index += 1) {
      expect(lookFor({ ...hero, id: `f-${index}`, gender: 'female' }).beard).toBe(false)
    }
  })
})

describe('gear aura', () => {
  it('picks the highest epic or legend grade', () => {
    expect(gearAuraOf([])).toBeNull()
    expect(gearAuraOf([{ grade: 'rare' }])).toBeNull()
    expect(gearAuraOf([{ grade: 'epic' }, { grade: 'fine' }])).toBe('epic')
    expect(gearAuraOf([{ grade: 'epic' }, { grade: 'legend' }])).toBe('legend')
  })
})

describe('gear style', () => {
  it('reads worn weapon and armour types', () => {
    expect(gearStyleOf([])).toEqual({ aura: null })
    expect(
      gearStyleOf([
        { grade: 'fine', slot: 'weapon', type: 'axe' },
        { grade: 'epic', slot: 'armor', type: 'plate' },
      ]),
    ).toEqual({ aura: 'epic', weapon: 'axe', armor: 'plate' })
    expect(gearStyleKey({ aura: 'epic', weapon: 'axe', armor: 'plate' })).toBe('epic|axe|plate')
  })

  it('ignores unknown types so class defaults stay', () => {
    expect(gearStyleOf([{ grade: 'common', slot: 'weapon' }])).toEqual({ aura: null })
  })
})

describe('age look', () => {
  it('grows children and greys elders', () => {
    expect(ageLook(10).scale).toBeLessThan(ageLook(25).scale)
    expect(ageLook(10).head).toBeGreaterThan(ageLook(25).head)
    expect(ageLook(30).gray).toBe(0)
    expect(ageLook(60).gray).toBeGreaterThan(0.5)
    expect(ageLook(40).stoop).toBe(0)
    expect(ageLook(66).stoop).toBeGreaterThan(0)
  })

  it('blends hair toward grey with age', () => {
    const look = lookFor(hero)
    expect(hairColor(look)).toBe(look.hair)
    expect(hairColor({ ...look, age: 60 })).not.toBe(look.hair)
  })

  it('mixes colours', () => {
    expect(mixHex('#000000', '#ffffff', 0)).toBe('#000000')
    expect(mixHex('#000000', '#ffffff', 1)).toBe('#ffffff')
    expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080')
  })
})
