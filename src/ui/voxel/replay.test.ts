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

  it('folds crit, counter, absorbed and the new 5a logs into steps', () => {
    const fake: DungeonReport = {
      ...report('hill_cave', [['warrior', 'front']]),
      log: [
        { tick: 0, key: 'log.floor', params: { floor: 1 } },
        { tick: 1, key: 'log.miss', params: { actorId: 'e1', targetId: 'h0' } },
        { tick: 2, key: 'log.crit', params: { actorId: 'h0' } },
        { tick: 2, key: 'log.attack', params: { actorId: 'h0', targetId: 'e1', amount: 40, absorbed: 5 } },
        { tick: 3, key: 'log.counter', params: { actorId: 'h0' } },
        { tick: 3, key: 'log.attack', params: { actorId: 'h0', targetId: 'e1', amount: 12 } },
        { tick: 4, key: 'log.thorns', params: { actorId: 'e1', targetId: 'h0', amount: 3 } },
        { tick: 5, key: 'log.burn', params: { actorId: 'e1', amount: 4 } },
        { tick: 6, key: 'log.twin', params: { actorId: 'h0' } },
        { tick: 7, key: 'log.enrage', params: { actorId: 'e1' } },
        { tick: 8, key: 'log.purge', params: { actorId: 'e1' } },
        { tick: 9, key: 'log.undying', params: { actorId: 'h0' } },
        { tick: 10, key: 'log.revive', params: { actorId: 'h0', targetId: 'h1' } },
        { tick: 11, key: 'log.guardian', params: { actorId: 'h0' } },
        { tick: 12, key: 'log.victory', params: {} },
      ],
      floors: [
        [
          { id: 'h0', refId: 'warrior', side: 'hero', row: 'front', reach: 'melee', hp: 100, maxHp: 100, boss: false },
          { id: 'e1', refId: 'brigand', side: 'enemy', row: 'front', reach: 'melee', hp: 80, maxHp: 80, boss: false, elite: true },
        ],
      ],
      victory: true,
    }
    const steps = buildSteps(fake)
    expect(steps.some((step) => step.type === 'miss')).toBe(true)
    const critHit = steps.find((step) => step.type === 'attack' && step.hits.some((hit) => hit.crit))
    expect(critHit?.type === 'attack' && critHit.hits[0]?.absorbed).toBe(5)
    expect(steps.some((step) => step.type === 'attack' && step.counter)).toBe(true)
    expect(steps.some((step) => step.type === 'thorns')).toBe(true)
    expect(steps.some((step) => step.type === 'burn')).toBe(true)
    expect(steps.some((step) => step.type === 'twin')).toBe(true)
    expect(steps.some((step) => step.type === 'enrage')).toBe(true)
    expect(steps.some((step) => step.type === 'purge')).toBe(true)
    expect(steps.some((step) => step.type === 'undying')).toBe(true)
    expect(steps.some((step) => step.type === 'revive')).toBe(true)
    expect(steps.some((step) => step.type === 'guardian')).toBe(true)
    expect(steps.find((step) => step.type === 'floor')?.units.some((unit) => unit.elite)).toBe(true)
  })
})
