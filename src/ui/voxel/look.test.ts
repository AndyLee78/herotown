import { describe, expect, it } from 'vitest'
import { ageLook, hairColor, lookFor, lookKey, mixHex } from './look'

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

  it('never gives a woman a beard', () => {
    for (let index = 0; index < 40; index += 1) {
      expect(lookFor({ ...hero, id: `f-${index}`, gender: 'female' }).beard).toBe(false)
    }
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
