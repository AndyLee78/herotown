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
    expect(events.at(-1)).toEqual({ kind: 'expedition', at: sent.expeditions[0]!.returnAt, refId: sent.expeditions[0]!.id })
  })

  it('waits until a bed is freed when the inn is full and uses next Monday at local midnight', () => {
    const base = freshState(4, now)
    const state = { ...base, fame: 100_000, promoted: 10 }
    expect(upcomingEvents(state)).toEqual([
      { kind: 'visitor', at: Math.min(...state.visitors.map(({ arrivedAt }) => arrivedAt ?? now)) + visitorStay(state.buildings.inn), refId: '1' },
      { kind: 'raid', at: new Date(2026, 10, 30).getTime(), refId: '2026-11-30' },
    ])
    expect(upcomingEvents({ ...state, lastTickAt: new Date(2026, 10, 30).getTime(), visitors: [], nextVisitorAt: now })).toEqual([
      { kind: 'raid', at: new Date(2026, 11, 7).getTime(), refId: '2026-12-07' },
    ])
  })
})
