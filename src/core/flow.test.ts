import { describe, expect, it } from 'vitest'
import { dungeonById, lifeRules, progression } from './data'
import { applyReport, DEFAULT_TACTICS, runDungeon } from './dungeon'
import { freshState, migrate, reduce, type GameState } from './game'
import { createHero } from './hero'

const now = 1_700_000_000_000

function hireAll(seed: number): GameState {
  let state = freshState(seed, now)
  for (const visitor of [...state.visitors]) {
    state = reduce(state, { type: 'hire', id: visitor.id, now })
  }
  for (const hero of state.roster) {
    state = reduce(state, { type: 'add', id: hero.id })
  }
  return state
}

describe('early game flow', () => {
  it('starts with a temple, so the first injuries can be treated', () => {
    expect(freshState(1, now).buildings.temple).toBe(1)
  })

  it('cures an injured or critical hero to merely tired with one treatment', () => {
    const state = hireAll(3)
    const hero = state.roster[0]!
    const hurt = { ...state, roster: [{ ...hero, condition: 'critical' as const }] }
    const treating = reduce(hurt, { type: 'treat', id: hero.id, now })
    const done = reduce(treating, { type: 'catchUp', now: now + lifeRules.treatMs })
    expect(done.roster[0]?.condition).toBe('fatigued')
  })

  it('finishes the full treatment when an ad is used on a critically injured hero', () => {
    const state = hireAll(3)
    const hero = state.roster[0]!
    const hurt = { ...state, roster: [{ ...hero, condition: 'critical' as const, recoverAt: now + lifeRules.injury.recoverMs }] }
    const treating = reduce(hurt, { type: 'treat', id: hero.id, now })
    expect(treating.roster[0]?.treatAt).toBe(now + lifeRules.treatMs)
    const done = reduce(treating, { type: 'adReward', placement: 'temple', now })
    expect(done.roster[0]).toMatchObject({ condition: 'fatigued', treatAt: undefined, recoverAt: undefined })
  })

  it('leaves without a fallen hero instead of refusing to depart', () => {
    const state = hireAll(3)
    const fallen = state.roster[0]!
    const withDead = { ...state, roster: state.roster.map((hero) => (hero.id === fallen.id ? { ...hero, condition: 'dead' as const, deaths: 1 } : hero)) }
    const out = reduce(withDead, { type: 'depart', now, confirm: true })
    expect(out.expeditions).toHaveLength(1)
    expect(out.expeditions[0]?.heroIds).not.toContain(fallen.id)
  })

  it('never kills a hero in a tier 1 dungeon', () => {
    const state = hireAll(3)
    const trip = reduce(state, { type: 'depart', now, confirm: true }).expeditions[0]!
    const lethal = { ...trip, report: { ...trip.report, conditions: trip.report.conditions.map((entry) => ({ ...entry, condition: 'dead' as const })) } }
    const out = { ...state, expeditions: [lethal] }
    const back = reduce(out, { type: 'catchUp', now: lethal.returnAt })
    expect(back.graveyard).toHaveLength(0)
    expect(back.roster.every((hero) => hero.condition === 'critical')).toBe(true)
  })

  it('rests heroes on the road too, pauses wounds while away, and makes returned heroes available to auto runs', () => {
    const state = hireAll(3)
    const staying = state.roster[0]!
    const ready = reduce({
      ...state,
      roster: state.roster.map((hero) => ({ ...hero, fatigue: 100 })),
      cleared: ['hill_cave'],
      buildings: { ...state.buildings, guild: 1 },
    }, { type: 'remove', id: staying.id })
    const sent = reduce(ready, { type: 'depart', now, confirm: true })
    const trip = sent.expeditions[0]!
    const lethal = {
      ...trip,
      report: { ...trip.report, conditions: trip.report.conditions.map((entry) => ({ ...entry, condition: 'dead' as const, fatigue: 0 })) },
    }
    const out = { ...sent, expeditions: [lethal] }
    const action = { type: 'catchUp' as const, now: trip.returnAt + 2 * lifeRules.injury.recoverMs }
    const back = reduce(out, action)
    const rate = lifeRules.fatigue.recoverPerHour / 3_600_000
    expect(trip.heroIds).not.toContain(staying.id)
    expect(back.roster.find((hero) => hero.id === staying.id)?.fatigue).toBe(0)
    // Fatigue falls during the trip as well (Docs/fatigue.md).
    const onRoad = reduce(out, { type: 'catchUp', now: trip.returnAt - 1 })
    for (const id of trip.heroIds) {
      expect(onRoad.roster.find((entry) => entry.id === id)?.fatigue).toBeCloseTo(Math.max(0, 100 - (trip.returnAt - 1 - now) * rate))
      const hero = back.roster.find((entry) => entry.id === id)
      expect(hero?.recoverAt).toBeUndefined()
      expect(['fatigued', 'healthy']).toContain(hero?.condition)
    }
    const auto = reduce({ ...out, auto: { ...out.auto, enabled: true } }, action)
    expect(auto.absence?.autoRuns).toBeGreaterThan(0)
  })

  it('puts melee heroes in the front row and others in the back', () => {
    let state = freshState(5, now)
    const make = (id: string, classId: 'warrior' | 'mage' | 'cleric') =>
      createHero({ id, name: id, gender: 'male', classId, age: 25, potentials: { str: 10, agi: 10, vit: 10, int: 10, wil: 10, wis: 10 } })
    state = { ...state, roster: [make('m', 'mage'), make('c', 'cleric'), make('w', 'warrior')] }
    for (const id of ['m', 'c', 'w']) {
      state = reduce(state, { type: 'add', id })
    }
    const rows = Object.fromEntries((state.presets[0]?.slots ?? []).map((slot) => [slot.id, slot.row]))
    expect(rows).toEqual({ m: 'back', c: 'back', w: 'front' })
  })

  it('grows every stat when a hero levels up', () => {
    const hero = createHero({ id: 'h', name: 'h', gender: 'male', classId: 'warrior', age: 25, potentials: { str: 10, agi: 10, vit: 10, int: 10, wil: 10, wis: 10 } })
    const result = runDungeon([{ hero, row: 'front' }], 'hill_cave', DEFAULT_TACTICS, 1)
    if (!result.ok) throw new Error(result.error)
    const report = { ...result.report, xp: progression.xpPerLevel }
    const grown = applyReport(hero, report)
    expect(grown.level).toBe(2)
    expect(grown.training).toBe(hero.training + progression.trainingPerLevel)
    expect(grown.stats.str).toBeGreaterThan(hero.stats.str)
  })

  it('pays some experience for floors cleared even in defeat', () => {
    const stats = { str: 10, agi: 10, vit: 10, int: 10, wil: 10, wis: 10 }
    const party = (['warrior', 'rogue', 'archer', 'mage', 'cleric'] as const).map((classId, index) => ({
      row: (index < 2 ? 'front' : 'back') as 'front' | 'back',
      hero: createHero({ id: classId, name: classId, gender: 'male', classId, age: 25, potentials: stats }),
    }))
    for (let seed = 1; seed <= 60; seed += 1) {
      const result = runDungeon(party, 'abandoned_mine', DEFAULT_TACTICS, seed)
      if (result.ok && !result.report.victory && result.report.floorsCleared > 0) {
        const dungeon = dungeonById('abandoned_mine')
        expect(result.report.xp).toBe(Math.round((dungeon.xp * progression.defeatXpShare * result.report.floorsCleared) / dungeon.floors.length))
        return
      }
    }
    throw new Error('expected a defeat after clearing a floor')
  })
})

describe('older saves', () => {
  it('gets the temple that new games start with', () => {
    const old = { ...freshState(1, now), version: 6 } as Record<string, unknown>
    old.buildings = { hall: 1, inn: 1, house: 1, guild: 0, smith: 0, temple: 0 }
    expect(migrate(old, now).buildings.temple).toBe(1)
  })
})

describe('early game safety nets', () => {
  it('always offers a tank and a healer among the first visitors', () => {
    for (let seed = 1; seed <= 30; seed += 1) {
      const classes = freshState(seed, now).visitors.map((hero) => hero.classId)
      expect(classes).toContain('warrior')
      expect(classes).toContain('cleric')
    }
  })

  it('sends a healer to the inn when the village has none', () => {
    const state = hireAll(5)
    const noHealer = {
      ...state,
      roster: state.roster.filter((hero) => hero.classId !== 'cleric'),
      visitors: [],
      nextVisitorAt: now,
    }
    const later = reduce(noHealer, { type: 'catchUp', now: now + 1000 })
    expect(later.visitors[0]?.classId).toBe('cleric')
  })

  it('brings home a little gold from a loss, for the floors that were cleared', () => {
    const party = hireAll(3).roster.slice(0, 1).map((hero) => ({ hero, row: 'front' as const }))
    for (let seed = 1; seed <= 40; seed += 1) {
      const result = runDungeon(party, 'barrow', DEFAULT_TACTICS, seed)
      if (!result.ok || result.report.victory) continue
      const dungeon = dungeonById('barrow')
      const expected = Math.round((dungeon.gold * progression.defeatGoldShare * result.report.floorsCleared) / dungeon.floors.length)
      expect(result.report.gold).toBe(expected)
    }
  })
})
