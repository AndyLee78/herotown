import { describe, expect, it } from 'vitest'
import { endgameRules, villageRules } from './data'
import { freshState, migrate, reduce, type GameState } from './game'
import { createHero } from './hero'
import { resolveInvasion, warned } from './invasion'
import { currentRaid, raidBoss, raidWeek, settleRaid } from './raid'
import type { Hero } from './types'

// Docs/endgame.md 4c: the weekly raid and town invasions.

const monday = new Date(2026, 10, 23, 12).getTime()
const stats = { str: 40, agi: 30, vit: 40, int: 30, wil: 30, wis: 30 }

function hero(id: string, classId: 'warrior' | 'cleric' | 'archer' | 'mage', level = 20): Hero {
  return createHero({ id, name: id, gender: 'male', classId, age: 25, potentials: stats, level, personality: 'timid' })
}

function town(level: number, extra: Partial<GameState> = {}): GameState {
  const base = freshState(5, monday)
  const roster = [hero('w', 'warrior'), hero('c', 'cleric'), hero('a', 'archer'), hero('m', 'mage')]
  return {
    ...base,
    fame: villageRules.levels.find((entry) => entry.level === level)!.fame,
    promoted: Math.max(7, level),
    gold: 5000,
    lastTickAt: monday,
    roster,
    buildings: { ...base.buildings, guild: 3 },
    presets: base.presets.map((preset, index) => (index === 0 ? { ...preset, slots: [{ id: 'w', row: 'front' as const }, { id: 'c', row: 'back' as const }, { id: 'a', row: 'back' as const }, { id: 'm', row: 'back' as const }] } : preset)),
    ...extra,
  }
}

describe('the weekly raid', () => {
  it('starts each Monday with the next boss in turn', () => {
    expect(raidWeek(monday)).toBe('2026-11-23')
    expect(raidWeek(monday + 6 * 86_400_000)).toBe('2026-11-23')
    expect(raidWeek(monday + 7 * 86_400_000)).toBe('2026-11-30')
    expect(raidBoss('2026-11-23').id).not.toBe(raidBoss('2026-11-30').id)
  })

  it('opens at town level 8 and keeps the damage each party does', () => {
    const locked = { ...town(7), dungeonId: 'raid' }
    expect(reduce(locked, { type: 'depart', presetId: 'p1', confirm: true, now: monday }).notice).toBe('lockedDungeon')
    let state: GameState = { ...town(8), dungeonId: 'raid' }
    state = reduce(state, { type: 'depart', presetId: 'p1', confirm: true, now: monday })
    const trip = state.expeditions[0]!
    expect(trip.raid?.week).toBe('2026-11-23')
    expect(trip.raid!.max).toBeGreaterThan(0)
    state = reduce(state, { type: 'catchUp', now: trip.returnAt + 1000 })
    const raid = state.raid!
    expect(raid.hp).not.toBeNull()
    expect(raid.hp!).toBeLessThanOrEqual(raid.max!)
    expect(raid.max! - raid.hp!).toBe(trip.raid!.max! - trip.raid!.left!)
  })

  it('gives the spoils and a kill when the pool runs out, then waits for next week', () => {
    const week = raidWeek(monday)
    const boss = raidBoss(week)
    // The first tier opens the next, harder one the same week (Docs/endgame.md 4d).
    const first = settleRaid({ ...town(8), raid: { week, bossId: boss.id, hp: 100, max: 10_000, killed: false, tier: 1 } }, week, 150, 0, 10_000)
    expect(first.raid).toMatchObject({ killed: false, tier: 2, hp: null })
    expect(first.vault[boss.spoil as 'scale']).toBe(endgameRules.raid.tiers[0]!.spoils)
    const state = { ...town(8), raid: { week, bossId: boss.id, hp: 100, max: 10_000, killed: false, tier: endgameRules.raid.tiers.length } }
    const killed = settleRaid(state, week, 150, 0, 10_000)
    expect(killed.raid?.killed).toBe(true)
    expect(killed.raidKills).toBe(1)
    expect(killed.vault[boss.spoil as 'scale']).toBe(endgameRules.raid.tiers[endgameRules.raid.tiers.length - 1]!.spoils)
    expect(killed.fame).toBe(state.fame + endgameRules.raid.fame)
    expect(reduce({ ...killed, dungeonId: 'raid' }, { type: 'depart', presetId: 'p1', confirm: true, now: monday }).notice).toBe('raidDone')
    expect(currentRaid(killed, monday + 7 * 86_400_000).killed).toBe(false)
    // Damage from last week's raid does not land on this week's.
    expect(settleRaid(killed, '2026-11-16', 100, 0, 10_000)).toBe(killed)
  })
})

describe('town invasions', () => {
  it('are scheduled once the town reaches level 9 and warned of six hours ahead', () => {
    expect(reduce(town(8), { type: 'catchUp', now: monday + 1000 }).invasion).toBeNull()
    const scheduled = reduce(town(9), { type: 'catchUp', now: monday + 1000 })
    const nextAt = scheduled.invasion!.nextAt
    expect(nextAt).toBe(monday + 1000 + endgameRules.invasion.everyMs)
    expect(warned(scheduled, nextAt - endgameRules.invasion.warnMs - 1)).toBe(false)
    expect(warned(scheduled, nextAt - endgameRules.invasion.warnMs)).toBe(true)
    expect(reduce(scheduled, { type: 'defend', presetIds: ['p1', 'p1', 'nope', 'p2', 'p3'] }).invasion?.defenders).toEqual(['p1', 'p2', 'p3'])
  })

  it('pays valour for holding and nobody dies defending', () => {
    const state = { ...town(9), invasion: { nextAt: monday, defenders: ['p1'], count: 0, wins: 0 } }
    const held = resolveInvasion(state, (current) => current)
    expect(held.invasion?.count).toBe(1)
    expect(held.invasion?.nextAt).toBe(monday + endgameRules.invasion.everyMs)
    if (held.invasion?.last?.won) {
      expect(held.invasion.wins).toBe(1)
      expect(held.vault.valor).toBe(endgameRules.invasion.valor)
    }
    const fought = reduce({ ...state, invasion: { ...state.invasion, nextAt: monday + 500 } }, { type: 'catchUp', now: monday + 1000 })
    expect(fought.roster.every((entry) => entry.condition !== 'dead')).toBe(true)
  })

  it('costs gold, materials and spirits when the line breaks', () => {
    const weak = { ...town(9), roster: [hero('w', 'warrior', 1)], invasion: { nextAt: monday, defenders: ['p1'], count: 30, wins: 0 } }
    const broken = resolveInvasion(weak, (current) => current)
    expect(broken.invasion?.last?.won).toBe(false)
    expect(broken.gold).toBe(weak.gold - Math.floor(weak.gold * endgameRules.invasion.loss))
    expect(broken.roster[0]!.morale ?? 60).toBeLessThan(60)
  })

  it('makes level 9 wait for a raid kill and level 10 for an invasion held', () => {
    const fame9 = villageRules.levels.find((entry) => entry.level === 9)!.fame
    const rich = { flame: 999, frost: 999, light: 999, abyss: 999, scale: 0, crown: 0, core: 0, valor: 0, token: 0 }
    const ready = { ...town(8), fame: fame9, promoted: 8, vault: rich, abyss: { best: 50, checkpoint: 50 } }
    expect(reduce(ready, { type: 'promote' }).notice).toBe('promoteDeed')
    expect(reduce({ ...ready, raidKills: 1 }, { type: 'promote' }).promoted).toBe(9)
  })

  it('opens a version 24 save with no raid or invasion', () => {
    const old = JSON.parse(JSON.stringify({ ...town(1), version: 24 })) as Record<string, unknown>
    delete old.raid
    delete old.raidKills
    delete old.invasion
    const opened = migrate(old, monday)
    expect(opened.raid).toBeNull()
    expect(opened.raidKills).toBe(0)
    expect(opened.invasion).toBeNull()
  })
})

describe('review 1650b75 fixes', () => {
  it('lets a party home after the week turned touch neither raid', () => {
    const week = raidWeek(monday)
    const state = { ...town(8), raid: { week, bossId: raidBoss(week).id, hp: 1, max: 10_000, killed: false, tier: 1 } }
    expect(settleRaid(state, week, 1, 0, 10_000, monday + 7 * 86_400_000)).toBe(state)
    expect(settleRaid(state, week, 1, 0, 10_000, monday + 86_400_000).raidKills).toBe(1)
  })

  it('lets each hero defend only once, however many presets hold them', () => {
    const base = town(9)
    const presets = base.presets.map((preset) => ({ ...preset, slots: [{ id: 'w', row: 'front' as const }] }))
    const state = { ...base, presets, invasion: { nextAt: monday, defenders: ['p1', 'p2', 'p3'], count: 30, wins: 0 } }
    const settled: string[][] = []
    resolveInvasion(state, (current, _report, heroIds) => {
      settled.push(heroIds)
      return current
    })
    expect(settled).toEqual([['w']])
  })

  it('lets a party home just before an invasion defend', () => {
    let state: GameState = { ...town(9), dungeonId: 'hill_cave' }
    state = reduce(state, { type: 'depart', presetId: 'p1', confirm: true, now: monday })
    const back = state.expeditions[0]!.returnAt
    state = { ...state, invasion: { nextAt: back + 1000, defenders: ['p1'], count: 0, wins: 0 } }
    const after = reduce(state, { type: 'catchUp', now: back + 60_000 })
    expect(after.invasion?.last?.waves).toBeGreaterThan(0)
  })

  it('takes queued orders that never paid spoils off a version 24 save and refunds them', () => {
    const base = town(10)
    const saved = JSON.parse(JSON.stringify({ ...base, version: 24, automation: { ...base.automation, queues: { ...base.automation.queues, smith: ['legend.blade', 'fine.blade'] } } })) as Record<string, unknown>
    const opened = migrate(saved, monday)
    expect(opened.automation.queues.smith).toEqual(['fine.blade'])
    expect(opened.vault.scale).toBe(0)
    expect(opened.gold).toBeGreaterThan(base.gold)
  })
})
