import { describe, expect, it } from 'vitest'
import { createHeroUnit, simulateFloor } from './combat'
import { dungeonById, dungeons, progression } from './data'
import { DEFAULT_TACTICS, defeatReason, runDungeon } from './dungeon'
import { createHero } from './hero'
import { winRate } from '../../tools/curve'
import { createRng } from './rng'
import type { ClassId, Hero, PartyMember, Row, Stats, Tactics } from './types'

const adult: Record<ClassId, Stats> = {
  warrior: { str: 15, agi: 10, vit: 15, int: 4, wil: 8, wis: 4 },
  rogue: { str: 8, agi: 16, vit: 8, int: 5, wil: 6, wis: 5 },
  archer: { str: 7, agi: 15, vit: 8, int: 6, wil: 7, wis: 6 },
  mage: { str: 4, agi: 9, vit: 7, int: 16, wil: 8, wis: 9 },
  cleric: { str: 5, agi: 8, vit: 10, int: 7, wil: 11, wis: 16 },
  bard: { str: 5, agi: 10, vit: 9, int: 8, wil: 14, wis: 8 },
  dancer: { str: 5, agi: 15, vit: 8, int: 6, wil: 12, wis: 7 },
}

function made(classId: ClassId, row: Row, index: number): PartyMember {
  return { hero: hero(classId, index), row }
}

function hero(classId: ClassId, index: number, potentials = adult[classId]): Hero {
  return createHero({
    id: `${classId}-${index}`,
    name: `${classId}-${index}`,
    gender: classId === 'dancer' ? 'female' : 'male',
    classId,
    age: 28,
    potentials,
  })
}

const standard: PartyMember[] = [
  made('warrior', 'front', 1),
  made('rogue', 'front', 1),
  made('archer', 'back', 1),
  made('bard', 'back', 1),
  made('cleric', 'back', 1),
]

describe('dungeon battles', () => {
  it('repeats the log for the same seed and input', () => {
    const first = runDungeon(standard, 'abandoned_mine', DEFAULT_TACTICS, 7)
    const second = runDungeon(standard, 'abandoned_mine', DEFAULT_TACTICS, 7)
    expect(first).toEqual(second)
  })

  it('keeps melee enemies off the back row while the front row stands', () => {
    const tank = createHeroUnit(
      {
        hero: hero('warrior', 1, { str: 18, agi: 8, vit: 30, int: 4, wil: 8, wis: 4 }),
        row: 'front',
      },
      0,
    )
    const back = createHeroUnit(
      {
        hero: hero('mage', 1, { str: 4, agi: 8, vit: 4, int: 8, wil: 6, wis: 6 }),
        row: 'back',
      },
      1,
    )
    const log: Parameters<typeof simulateFloor>[4] = []
    simulateFloor([tank, back], ['wolf', 'wolf'], { ...DEFAULT_TACTICS, healBelow: 0 }, createRng(1), log, 1)
    expect(back.taken).toBe(0)
    expect(tank.taken).toBeGreaterThan(0)
  })

  it('changes the mine when the healer stops healing', () => {
    const careful: Tactics = { ...DEFAULT_TACTICS, healBelow: 80 }
    const reckless: Tactics = { ...DEFAULT_TACTICS, healBelow: 0 }
    const healed = runDungeon(standard, 'abandoned_mine', careful, 3)
    const ignored = runDungeon(standard, 'abandoned_mine', reckless, 3)
    expect(healed.ok && ignored.ok).toBe(true)
    if (healed.ok && ignored.ok) {
      const healedCleric = healed.report.units.find((unit) => unit.id === 'cleric-1')
      const ignoredCleric = ignored.report.units.find((unit) => unit.id === 'cleric-1')
      expect(healedCleric?.healed ?? 0).toBeGreaterThan(ignoredCleric?.healed ?? 0)
    }
  })

  it('wins the mine with a standard party at the recommended level', () => {
    const level = dungeonById('abandoned_mine').recommendedLevel
    const party = standard.map((member) => ({ ...member, hero: createHero({ ...member.hero, level, training: (level - 1) * progression.trainingPerLevel }) }))
    const result = runDungeon(party, 'abandoned_mine', DEFAULT_TACTICS, 3)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.report.victory).toBe(true)
      expect(result.report.defeatReason).toBeNull()
    }
  })

  it('calls a wipe or a timeout too weak only while the party is below the recommended level', () => {
    expect(defeatReason('wipe', 2, true, true, 1, 4)).toBe('tooWeak')
    expect(defeatReason('timeout', 2, true, true, 1, 4)).toBe('tooWeak')
    expect(defeatReason('wipe', 2, true, true, 4, 4)).toBe('wiped')
    expect(defeatReason('timeout', 1, true, true, 4, 4)).toBe('outmatched')
    expect(defeatReason('wipe', 2, false, true, 1, 4)).toBe('noTank')
    expect(defeatReason('wipe', 2, true, false, 1, 4)).toBe('noHealer')
    expect(defeatReason('retreat', 2, true, true, 1, 4)).toBe('retreated')
  })

  it('asks for higher levels deeper in, and ordinary visitors win at the recommended level', () => {
    const sorted = [...dungeons].sort((a, b) => a.tier - b.tier || a.recommendedLevel - b.recommendedLevel)
    for (let index = 1; index < sorted.length; index += 1) {
      expect(sorted[index]!.recommendedLevel).toBeGreaterThanOrEqual(sorted[index - 1]!.recommendedLevel)
    }
    for (const dungeon of dungeons) {
      expect(winRate(dungeon.id, dungeon.recommendedLevel, 12), dungeon.id).toBeGreaterThanOrEqual(0.5)
      if (dungeon.recommendedLevel >= 4) {
        expect(winRate(dungeon.id, dungeon.recommendedLevel - 3, 12), dungeon.id).toBeLessThan(0.5)
      }
    }
  })
})
