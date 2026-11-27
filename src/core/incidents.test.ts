import { describe, expect, it } from 'vitest'
import { timeRules } from './data'
import { bondOf } from './family'
import { exportSave, freshState, importSave, migrate, reduce, type GameState } from './game'
import { advanceIncident, applyIncidentEffects, incidentChoices, incidentDefinitions, nextIncidentTime } from './incidents'
import { createRng } from './rng'

const now = 1_800_000_000_000
const season = timeRules.seasonMs
function waiting(id: string, actors: string[] = [], patch: Partial<GameState> = {}): GameState {
  return {
    ...freshState(4, now), ...patch,
    incident: { id, actors, at: now, expiresAt: now + season },
    incidentNonce: 1, nextIncidentAt: now + season / 2,
  }
}

describe('village incidents', () => {
  it('schedules one or two per season if answered promptly, across multiple seeds', () => {
    for (let seed = 1; seed <= 12; seed += 1) {
      const base = freshState(seed, now)
      let state = { ...base, gold: 200, fame: 90, nextIncidentAt: nextIncidentTime(seed, 0, now) }
      const days = [0, 0, 0, 0]
      for (let attempt = 0; attempt < 24 && state.nextIncidentAt < now + 4 * season; attempt += 1) {
        const at = state.nextIncidentAt
        state = advanceIncident({ ...state, lastTickAt: at }, at)
        if (!state.incident) continue
        expect(state.recentIncidents).toHaveLength(new Set(state.recentIncidents).size)
        days[Math.floor((at - now) / season)]! += 1
        const choice = incidentChoices(state).find(({ reason }) => !reason)!
        state = reduce(state, { type: 'resolveIncident', choice: choice.id })
      }
      expect(days.every((count) => count >= 1 && count <= 2)).toBe(true)
    }
  })

  it('holds a single pending incident and reports it or its expiry after catch-up', () => {
    const state = { ...freshState(1, now), nextIncidentAt: now + 10 }
    const back = reduce(state, { type: 'catchUp', now: now + timeRules.reportAfterMs })
    expect(back.incident?.at).toBe(now + 10)
    expect(back.absence?.incidents?.pending).toBe(back.incident?.id)
    expect(advanceIncident(back, back.incident!.expiresAt - 1)).toBe(back)
    const elapsed = reduce({ ...back, lastTickAt: back.incident!.expiresAt - timeRules.reportAfterMs }, { type: 'catchUp', now: back.incident!.expiresAt })
    expect(elapsed.incident).toBeNull()
    expect(elapsed.incidentLog.at(-1)).toMatchObject({ choice: 'ignore', id: back.incident!.id })
    expect(elapsed.absence?.incidents?.ignored).toEqual([back.incident?.id])
    expect(elapsed.incidentNonce).toBe(back.incidentNonce)
  })

  it('enforces prerequisites, shuffled candidates and the recent limit', () => {
    const state = { ...freshState(1, now), roster: [], gold: 0, nextIncidentAt: now, recentIncidents: ['oldTraveler', 'rainyDay', 'wolf', 'festivalIdea'] }
    const next = advanceIncident(state, now)
    expect(next.incident).toBeNull()
    expect(next.nextIncidentAt).toBeGreaterThan(now)
    expect(incidentDefinitions).toHaveLength(12)
    expect(reduce(waiting('rainyDay'), { type: 'resolveIncident', choice: 'treat' }).notice).toBe('locked')
    expect(reduce(waiting('oldTraveler', [], { gold: 9 }), { type: 'resolveIncident', choice: 'host' }).notice).toBe('poor')
  })

  it('closes with a logged no-op when an actor or a prerequisite goes away', () => {
    const state = waiting('ancientCoin', ['gone'])
    const result = reduce(state, { type: 'resolveIncident', choice: 'vault' })
    expect(result.gold).toBe(state.gold)
    expect(result.incident).toBeNull()
    expect(result.incidentLog.at(-1)).toMatchObject({ id: 'ancientCoin', choice: 'changed' })
    const poor = waiting('merchantDeal', [], { gold: 59 })
    expect(reduce(poor, { type: 'resolveIncident', choice: 'buy' }).incidentLog.at(-1)?.choice).toBe('changed')
  })

  it('applies every effect kind and limits resources and fatigue', () => {
    const base = freshState(4, now)
    const [a, b] = base.visitors
    const before = { ...base, roster: [a!, b!], visitors: [] }
    const effects = applyIncidentEffects(before, [a!.id, b!.id], [
      { kind: 'gold', amount: -1000 }, { kind: 'fame', amount: 3 },
      { kind: 'materials', resource: 'iron', amount: 7 }, { kind: 'vault', resource: 'valor', amount: 2 },
      { kind: 'morale', amount: 10, target: 'first' }, { kind: 'affinity', amount: 9 },
      { kind: 'fatigue', amount: 120, target: 'second' }, { kind: 'xp', amount: 10, target: 'home' },
      { kind: 'visitor', amount: 1 }, { kind: 'gear', amount: 1 }, { kind: 'nothing', amount: 0 },
    ], createRng(3), now)
    expect(effects.state).toMatchObject({ gold: 0, fame: 3, materials: { iron: before.materials.iron + 7 }, vault: { valor: 2 } })
    expect(bondOf(effects.state, a!.id, b!.id)).toBe(9)
    expect(effects.state.roster[1]?.fatigue).toBe(100)
    expect(effects.state.roster.every(({ xp }) => xp === 10)).toBe(true)
    expect(effects.state.stash).toHaveLength(1)
    expect(effects.state.visitors).toHaveLength(1)
    expect(new Set(effects.changes.map(({ kind }) => kind)).size).toBe(10)
    expect(before.gold).toBeGreaterThan(0)
  })

  it('rolls repeatably and sanitizes or restores save fields', () => {
    const start = waiting('merchantDeal')
    const action = { type: 'resolveIncident' as const, choice: 'buy' }
    const resolved = reduce(start, action)
    expect(reduce(start, action)).toEqual(resolved)
    expect(resolved.gold).toBe(start.gold - 40)
    expect(resolved.incidentLog[0]?.branch).toBeDefined()
    expect(importSave(exportSave(start), now).incident).toEqual(start.incident)
    expect(importSave(exportSave(resolved), now).incidentLog).toEqual(resolved.incidentLog)
    const invalid = migrate({ version: 30, incident: { id: 'missing' }, nextIncidentAt: -1, recentIncidents: ['missing'], incidentLog: [null] }, now)
    expect(invalid).toMatchObject({ incident: null, incidentNonce: 0, nextIncidentAt: now + season / 2, incidentLog: [], recentIncidents: [] })
  })
})
