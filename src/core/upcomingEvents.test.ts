import { describe, expect, it } from 'vitest'
import { freshState, reduce, visitorStay } from './game'
import { upcomingEvents } from './upcomingEvents'

describe('upcoming events', () => {
  const now = new Date(2026, 10, 29, 23, 30).getTime()
  it('lists jobs and returns in time order with stable keys', () => {
    const base = freshState(4, now)
    const sent = reduce(reduce({ ...base, roster: [base.visitors[0]!] }, { type: 'add', id: base.visitors[0]!.id }), { type: 'depart' })
    const events = upcomingEvents({
      ...sent, visitors: [], nextVisitorAt: now + 5_000,
      construction: { id: 'hall', finishAt: now + 6_000 },
      smith: { kind: 'craft', recipeId: 'iron.blade', gear: null, finishAt: now + 3_000 },
      alchemy: { potionId: 'heal', finishAt: now + 2_000 },
      magic: { trinketId: 'alert', finishAt: now + 4_000 },
    })
    expect(events.slice(0, 5).map(({ kind, refId }) => [kind, refId])).toEqual([
      ['workshop', 'alchemy'], ['workshop', 'smith'], ['workshop', 'magic'], ['visitor', '1'], ['build', 'hall'],
    ])
    expect(events.at(-2)).toEqual({ kind: 'expedition', at: sent.expeditions[0]!.returnAt, refId: sent.expeditions[0]!.id })
  })

  it('waits until a bed is freed when the inn is full and uses next Monday at local midnight', () => {
    const base = freshState(4, now)
    const state = { ...base, fame: 100_000, promoted: 10 }
    expect(upcomingEvents(state)).toEqual([
      { kind: 'visitor', at: Math.min(...state.visitors.map(({ arrivedAt }) => arrivedAt ?? now)) + visitorStay(state.buildings.inn), refId: '1' },
      { kind: 'raid', at: new Date(2026, 10, 30).getTime(), refId: '2026-11-30' },
      { kind: 'incident', at: state.nextIncidentAt, refId: '1' },
    ])
    expect(upcomingEvents({ ...state, lastTickAt: new Date(2026, 10, 30).getTime(), visitors: [], nextVisitorAt: now, nextIncidentAt: now })).toEqual([
      { kind: 'raid', at: new Date(2026, 11, 7).getTime(), refId: '2026-12-07' },
    ])
  })

  it('schedules the next incident only while there is no pending choice', () => {
    const state = { ...freshState(4, now), incidentNonce: 3, nextIncidentAt: now + 500 }
    expect(upcomingEvents(state)[0]).toEqual({ kind: 'incident', at: now + 500, refId: '4' })
    const waiting = { ...state, incident: { id: 'rainyDay', actors: [], at: now, expiresAt: now + 1_000 } }
    expect(upcomingEvents(waiting).some(({ kind }) => kind === 'incident')).toBe(false)
  })
})
