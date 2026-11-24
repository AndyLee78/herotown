import { describe, expect, it } from 'vitest'
import { expeditionRules } from './data'
import { heroPower } from './dungeon'
import { busyHeroIds, dungeonUnlocked, freshState, migrate, reduce, type GameState } from './game'

const now = 1_700_000_000_000

// Hires every visitor into the first preset.
function hiredParty(seed = 7): GameState {
  let state = freshState(seed, now)
  for (const visitor of [...state.visitors]) {
    state = reduce(state, { type: 'hire', id: visitor.id, now })
  }
  for (const hero of state.roster) {
    state = reduce(state, { type: 'add', id: hero.id })
  }
  return state
}

describe('timed expeditions', () => {
  it('leaves, fights and settles only when the party comes home', () => {
    const ready = hiredParty()
    const out = reduce(ready, { type: 'depart', now })
    const trip = out.expeditions[0]
    expect(trip).toBeDefined()
    if (!trip) return
    expect(trip.battleAt).toBe(now + expeditionRules.travelMs)
    expect(trip.battleEndAt).toBe(trip.battleAt + trip.report.ticks * expeditionRules.msPerTick)
    expect(trip.returnAt).toBe(trip.battleEndAt + expeditionRules.returnMs)
    expect(out.gold).toBe(ready.gold)
    expect(out.cleared).toEqual([])

    const midway = reduce(out, { type: 'catchUp', now: trip.returnAt - 1 })
    expect(midway.expeditions).toHaveLength(1)
    expect(midway.cleared).toEqual([])

    const back = reduce(midway, { type: 'catchUp', now: trip.returnAt })
    expect(back.expeditions).toHaveLength(0)
    expect(back.cleared).toEqual(['hill_cave'])
    expect(back.gold).toBeGreaterThan(ready.gold)
    const record = back.history[0]
    expect(record?.victory).toBe(true)
    expect(record?.finishedAt).toBe(trip.returnAt)
    expect(record?.gained?.gold).toBe(back.gold - ready.gold)
    expect(record?.gained?.materials.wood).toBeGreaterThan(0)
  })

  it('settles a trip that ended while the player was away', () => {
    const out = reduce(hiredParty(), { type: 'depart', now })
    const later = reduce(out, { type: 'catchUp', now: now + 3_600_000 })
    expect(later.expeditions).toHaveLength(0)
    expect(later.absence?.returned).toEqual([{ dungeonId: 'hill_cave', victory: true }])
  })

  it('keeps heroes on a trip out of other trips, auto runs and dismissal', () => {
    const out = reduce(hiredParty(), { type: 'depart', now })
    const busy = busyHeroIds(out)
    expect(busy.size).toBe(5)
    expect(reduce(out, { type: 'depart', now }).notice).toBe('busyHero')
    const someone = [...busy][0] ?? ''
    expect(reduce(out, { type: 'dismiss', id: someone }).notice).toBe('busyHero')
  })

  it('limits trips at once to the guild slots', () => {
    const ready = hiredParty()
    const [a, b] = ready.roster
    if (!a || !b) throw new Error('expected heroes')
    let state = reduce(ready, { type: 'remove', id: b.id })
    state = reduce(state, { type: 'add', id: b.id, presetId: 'p2' })
    state = reduce(state, { type: 'depart', now })
    expect(state.expeditions).toHaveLength(1)
    expect(reduce(state, { type: 'depart', presetId: 'p2', now }).notice).toBe('slotsFull')
    const guild = { ...state, buildings: { ...state.buildings, guild: 2 } }
    expect(reduce(guild, { type: 'depart', presetId: 'p2', now }).expeditions).toHaveLength(2)
  })

  it('keeps the history to the newest entries', () => {
    let state = hiredParty()
    for (let index = 0; index < expeditionRules.history + 2; index += 1) {
      state = reduce(state, { type: 'depart', now: state.lastTickAt })
      const trip = state.expeditions[0]
      if (!trip) throw new Error('expected a trip')
      state = reduce(state, { type: 'catchUp', now: trip.returnAt })
      state = { ...state, roster: state.roster.map((hero) => ({ ...hero, fatigue: 0, condition: 'healthy' as const })) }
    }
    expect(state.history).toHaveLength(expeditionRules.history)
    expect(state.history[0]?.finishedAt).toBeGreaterThan(state.history[1]?.finishedAt ?? 0)
  })
})

describe('presets and unlocks', () => {
  it('edits presets separately and keeps tactics per preset', () => {
    const ready = hiredParty()
    const hero = ready.roster[0]
    if (!hero) throw new Error('expected a hero')
    const second = reduce(ready, { type: 'add', id: hero.id, presetId: 'p2' })
    expect(second.presets[1]?.slots).toEqual([{ id: hero.id, row: 'front' }])
    const tuned = reduce(second, { type: 'tactics', presetId: 'p2', tactics: { target: 'boss', healBelow: 50, retreatBelow: 10 } })
    expect(tuned.presets[1]?.tactics.target).toBe('boss')
    expect(tuned.presets[0]?.tactics.target).toBe('lowestHp')
    expect(reduce(tuned, { type: 'preset', id: 'p2' }).presetId).toBe('p2')
    expect(reduce(tuned, { type: 'preset', id: 'nope' }).presetId).toBe('p1')
  })

  it('opens each tier after a dungeon of the tier below is cleared', () => {
    const start = freshState(1, now)
    expect(dungeonUnlocked(start, 'hill_cave')).toBe(true)
    expect(dungeonUnlocked(start, 'abandoned_mine')).toBe(false)
    expect(dungeonUnlocked({ ...start, cleared: ['moss_path'] }, 'abandoned_mine')).toBe(true)
    expect(dungeonUnlocked({ ...start, cleared: ['moss_path'] }, 'barrow')).toBe(false)
    expect(reduce({ ...hiredParty(), dungeonId: 'barrow' }, { type: 'depart', now }).notice).toBe('lockedDungeon')
  })

  it('moves an old save party and report into the first preset and the history', () => {
    const ready = hiredParty()
    const slots = ready.presets[0]?.slots ?? []
    const old = { ...ready, version: 5, party: slots, tactics: { target: 'boss', healBelow: 40, retreatBelow: 0 }, report: { victory: true } } as Record<string, unknown>
    delete old.presets
    delete old.history
    delete old.expeditions
    const moved = migrate(old, now)
    expect(moved.presets[0]?.slots).toEqual(slots)
    expect(moved.presets[0]?.tactics.target).toBe('boss')
    expect(moved.presets).toHaveLength(expeditionRules.presets)
    expect(moved.history).toHaveLength(1)
    expect(moved.expeditions).toEqual([])
  })

  it('rates a tired hero lower than a rested one', () => {
    const hero = hiredParty().roster[0]
    if (!hero) throw new Error('expected a hero')
    expect(heroPower(hero)).toBeGreaterThan(0)
    expect(heroPower({ ...hero, fatigue: 90 })).toBeLessThan(heroPower(hero))
  })
})
