import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DEFAULT_TACTICS, runDungeon } from './dungeon'
import { ageUp, canDeploy, createHero, generateVisitors, statRange, train, withAge } from './hero'

describe('hero generation', () => {
  it('repeats the same visitors for the same seed', () => {
    expect(generateVisitors(42, 5)).toEqual(generateVisitors(42, 5))
    expect(generateVisitors(42, 5)).not.toEqual(generateVisitors(7, 5))
    const visitors = generateVisitors(42, 5)
    expect(visitors).toHaveLength(5)
    expect(visitors.some((hero) => hero.gender === 'male' && hero.classId === 'dancer')).toBe(false)
  })

  it('raises physical stats into the prime years and mental stats later', () => {
    const base = {
      id: 'curve',
      name: 'Curve',
      gender: 'female' as const,
      classId: 'warrior' as const,
      potentials: { str: 20, agi: 10, vit: 10, int: 10, wil: 10, wis: 16 },
    }
    const apprentice = createHero({ ...base, age: 17 })
    const prime = withAge(apprentice, 28)
    const mature = withAge(apprentice, 35)

    expect(canDeploy(13)).toBe(false)
    expect(canDeploy(14)).toBe(true)
    expect(prime.stats.str).toBeGreaterThan(apprentice.stats.str)
    expect(mature.stats.str).toBeLessThan(prime.stats.str)
    expect(mature.stats.wis).toBeGreaterThan(prime.stats.wis)
  })

  it('recalculates stats when a hero ages or trains', () => {
    const hero = createHero({
      id: 'grow',
      name: 'Grow',
      gender: 'male',
      classId: 'mage',
      age: 16,
      potentials: { str: 8, agi: 8, vit: 8, int: 12, wil: 8, wis: 8 },
    })
    expect(ageUp(hero).age).toBe(17)
    expect(ageUp(hero).stats.int).toBeGreaterThanOrEqual(hero.stats.int)
    expect(train(hero).training).toBe(1)
    expect(train(hero).stats.int).toBe(hero.stats.int + 1)
  })

  it('refuses to deploy a child', () => {
    const child = createHero({
      id: 'child',
      name: 'Child',
      gender: 'female',
      classId: 'cleric',
      age: 8,
      potentials: { str: 10, agi: 10, vit: 10, int: 10, wil: 10, wis: 10 },
    })
    expect(runDungeon([{ hero: child, row: 'front' }], 'hill_cave', DEFAULT_TACTICS, 1)).toEqual({
      ok: false,
      error: 'underage',
    })
    expect(statRange(16)).toEqual({ min: 12, max: 20 })
  })
})

describe('core boundary', () => {
  it('does not import React, the DOM, UI, or locales', () => {
    const sources = sourceFiles(join(process.cwd(), 'src', 'core'))
    expect(sources.length).toBeGreaterThan(0)
    for (const file of sources) {
      const text = readFileSync(file, 'utf8')
      expect(text, file).not.toMatch(/from ['"]react/)
      expect(text, file).not.toMatch(/from ['"][^'"]*locales/)
      expect(text, file).not.toMatch(/from ['"][^'"]*\/ui/)
      expect(text, file).not.toMatch(/\b(document|window)\b/)
    }
  })
})

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) {
      return sourceFiles(path)
    }
    return name.endsWith('.ts') && !name.endsWith('.test.ts') ? [path] : []
  })
}
