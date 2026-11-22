import { describe, expect, it } from 'vitest'
import { DEFAULT_TACTICS, createHero, runDungeon, type ClassId, type DungeonReport, type PartyMember, type Row } from '../../core'
import { buildSteps, canReplay } from './replay'

function party(classes: [ClassId, Row][]): PartyMember[] {
  return classes.map(([classId, row], index) => ({
    row,
    hero: createHero({
      id: `h${index}`,
      name: `H${index}`,
      gender: classId === 'dancer' ? 'female' : 'male',
      classId,
      age: 26,
      potentials: { str: 14, agi: 14, vit: 14, int: 14, wil: 14, wis: 14 },
    }),
  }))
}

function report(dungeonId: string, classes: [ClassId, Row][]): DungeonReport {
  const result = runDungeon(party(classes), dungeonId, DEFAULT_TACTICS, 5)
  if (!result.ok) {
    throw new Error(result.error)
  }
  return result.report
}

const standard: [ClassId, Row][] = [
  ['warrior', 'front'],
  ['rogue', 'front'],
  ['archer', 'back'],
  ['mage', 'back'],
  ['cleric', 'back'],
]

describe('battle replay steps', () => {
  it('starts each floor with its units and refers only to units on that floor', () => {
    const cave = report('hill_cave', standard)
    expect(canReplay(cave)).toBe(true)
    const steps = buildSteps(cave)
    expect(steps[0]?.type).toBe('floor')
    let ids = new Set<string>()
    for (const step of steps) {
      if (step.type === 'floor') {
        ids = new Set(step.units.map((unit) => unit.id))
        expect(step.units.filter((unit) => unit.side === 'hero')).toHaveLength(5)
        continue
      }
      if (step.type === 'attack') {
        expect(ids.has(step.actorId)).toBe(true)
        for (const hit of step.hits) expect(ids.has(hit.targetId)).toBe(true)
      }
      for (const id of step.downs) expect(ids.has(id)).toBe(true)
    }
    expect(steps.filter((step) => step.type === 'floor')).toHaveLength(cave.floors?.length ?? 0)
    expect(steps[steps.length - 1]).toMatchObject({ type: 'end', victory: cave.victory })
  })

  it('groups an area attack into one step', () => {
    const cave = report('hill_cave', [['mage', 'back']])
    const area = buildSteps(cave).filter((step) => step.type === 'attack' && step.hits.length > 1)
    expect(area.length).toBeGreaterThan(0)
  })

  it('matches the damage in the log', () => {
    const cave = report('hill_cave', standard)
    const logged = cave.log.filter((entry) => entry.key === 'log.attack').reduce((sum, entry) => sum + Number(entry.params.amount), 0)
    const stepped = buildSteps(cave).reduce((sum, step) => sum + (step.type === 'attack' ? step.hits.reduce((total, hit) => total + hit.amount, 0) : 0), 0)
    expect(stepped).toBe(logged)
  })

  it('refuses old reports without replay data', () => {
    const cave = report('hill_cave', standard)
    expect(canReplay({ ...cave, floors: undefined })).toBe(false)
  })
})
