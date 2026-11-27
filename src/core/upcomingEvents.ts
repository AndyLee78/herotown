import { dungeonUnlocked, visitorCap, visitorStay, type GameState } from './game'
import { raidWeek } from './raid'

export type UpcomingEvent = {
  kind: 'expedition' | 'build' | 'workshop' | 'visitor' | 'raid'
  at: number
  refId: string
}

export function upcomingEvents(state: GameState): UpcomingEvent[] {
  const events: UpcomingEvent[] = state.expeditions.map(({ id, returnAt }) => ({ kind: 'expedition', at: returnAt, refId: id }))
  if (state.construction) events.push({ kind: 'build', at: state.construction.finishAt, refId: state.construction.id })
  for (const workshop of ['smith', 'alchemy', 'magic'] as const) {
    const job = state[workshop]
    if (job) events.push({ kind: 'workshop', at: job.finishAt, refId: workshop })
  }
  const cap = visitorCap(state.buildings.inn)
  if (cap > 0) {
    const stay = visitorStay(state.buildings.inn)
    const departures = state.visitors.map(({ arrivedAt }) => (arrivedAt ?? state.lastTickAt) + stay).sort((a, b) => a - b)
    const at = state.visitors.length < cap
      ? Math.min(state.nextVisitorAt, departures[0] ?? Infinity)
      : departures[state.visitors.length - cap]!
    events.push({ kind: 'visitor', at, refId: String(state.visitorNonce + 1) })
  }
  if (dungeonUnlocked(state, 'raid')) {
    const date = new Date(state.lastTickAt)
    const days = ((8 - date.getDay()) % 7) || 7
    const at = new Date(date.getFullYear(), date.getMonth(), date.getDate() + days).getTime()
    events.push({ kind: 'raid', at, refId: raidWeek(at) })
  }
  return events.filter(({ at }) => Number.isFinite(at) && at > state.lastTickAt).sort((a, b) => a.at - b.at)
}
