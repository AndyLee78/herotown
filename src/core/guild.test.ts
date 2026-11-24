import { describe, expect, it } from 'vitest'
import { guildRules, timeRules, villageRules } from './data'
import { expeditionSlots, freshState, migrate, reduce, type GameState } from './game'
import { ensureBoard, guildLevel, progressClear, type Contract } from './guild'
import { createHero, statRange } from './hero'
import { guideSteps } from './guide'
import { seasonKey } from './nest'
import type { ClassId, Hero } from './types'

// Docs/guild.md: contract board, guild record, parties, auto runs and appraisal.

const now = 1_700_000_000_000
const stats = { str: 14, agi: 12, vit: 14, int: 12, wil: 12, wis: 14 }

function hero(id: string, classId: ClassId, level = 6): Hero {
  return createHero({ id, name: id, gender: 'male', classId, age: 25, potentials: stats, level, training: level - 1 })
}

function town(guild = 1, extra: Partial<GameState> = {}): GameState {
  const base = freshState(5, now)
  return ensureBoard({ ...base, gold: 500, cleared: ['hill_cave', 'moss_path', 'abandoned_mine'], buildings: { ...base.buildings, guild }, ...extra })
}

describe('guild levels', () => {
  it('adds a party at level 1, auto parties later, and narrows appraisal', () => {
    expect([0, 1, 2, 3, 4].map(expeditionSlots)).toEqual(guildRules.levels.map((level) => level.expeditions))
    expect(expeditionSlots(1)).toBeGreaterThan(expeditionSlots(0))
    expect(guildLevel(0).autoParties).toBe(0)
    expect(guildLevel(3).autoParties).toBe(2)
    expect(statRange(20, guildLevel(0).appraisal).max - statRange(20, guildLevel(0).appraisal).min).toBeGreaterThan(statRange(20, guildLevel(2).appraisal).max - statRange(20, guildLevel(2).appraisal).min)
    expect(statRange(20, guildLevel(3).appraisal)).toEqual({ min: 20, max: 20 })
  })

  it('needs the guild for auto runs', () => {
    expect(reduce(town(0), { type: 'auto', enabled: true }).notice).toBe('noGuild')
    expect(reduce(town(1), { type: 'auto', enabled: true }).auto.enabled).toBe(true)
  })

  it('needs a record of finished contracts to grow', () => {
    const state = { ...town(1, { fame: 200 }), materials: { wood: 999, stone: 999, iron: 999, bone: 0, herb: 0, crystal: 0 } }
    expect(reduce(state, { type: 'build', id: 'guild', now }).notice).toBe('guildRecord')
    const proven = { ...state, guild: { ...state.guild!, record: guildLevel(2).record } }
    expect(reduce(proven, { type: 'build', id: 'guild', now }).construction?.id).toBe('guild')
    expect(villageRules.buildings.find((building) => building.id === 'guild')?.levels).toHaveLength(4)
  })
})

describe('the contract board', () => {
  it("puts up the season's contracts, as many as the guild level allows", () => {
    const one = town(1)
    expect(one.guild?.season).toBe(seasonKey(one.calendar))
    expect(one.guild?.seasonal).toHaveLength(guildLevel(1).contracts)
    expect(town(0).guild).toBeNull()
    expect(ensureBoard(one)).toBe(one)
  })

  it('pays a clear contract when its dungeon is cleared enough times', () => {
    let state = town(1)
    const contract: Contract = { id: 'c1', kind: 'clear', dungeonId: 'moss_path', need: 2, progress: 0, gold: 50, fame: 6, done: false }
    state = { ...state, guild: { ...state.guild!, seasonal: [contract] } }
    state = progressClear(state, 'moss_path')
    expect(state.guild?.seasonal[0]?.progress).toBe(1)
    const gold = state.gold
    state = progressClear(state, 'moss_path')
    expect(state.guild?.seasonal[0]?.done).toBe(true)
    expect(state.gold).toBe(gold + 50)
    expect(state.guild?.record).toBe(1)
    // With the season's contracts done, a repeatable one goes up.
    expect(state.guild?.repeat).not.toBeNull()
  })

  it('takes a delivery and puts up the next repeat at once', () => {
    let state = town(1)
    const deliver: Contract = { id: 'r9', kind: 'deliver', material: 'wood', need: 10, progress: 0, gold: 12, fame: 0, done: false }
    state = { ...state, materials: { ...state.materials, wood: 30 }, guild: { ...state.guild!, seasonal: [], repeat: deliver } }
    expect(reduce({ ...state, materials: { ...state.materials, wood: 5 } }, { type: 'deliver', contractId: 'r9' }).notice).toBe('resources')
    const paid = reduce(state, { type: 'deliver', contractId: 'r9' })
    expect(paid.materials.wood).toBe(20)
    expect(paid.gold).toBe(state.gold + 12)
    expect(paid.guild?.repeat?.id).not.toBe('r9')
    expect(paid.guild?.record).toBe(1)
  })

  it('replaces the board when the season turns', () => {
    const state = town(1)
    const next = ensureBoard({ ...state, calendar: { ...state.calendar, season: state.calendar.season === 'winter' ? 'spring' : 'winter' } })
    expect(next.guild?.season).not.toBe(state.guild?.season)
    expect(next.guild?.record).toBe(state.guild?.record)
  })

  it('opens a version 14 save with no board until the guild has one', () => {
    const old = { ...town(1), version: 14 } as Record<string, unknown>
    delete old.guild
    const loaded = migrate(JSON.parse(JSON.stringify(old)), now)
    expect(loaded.guild).toBeNull()
    expect(reduce(loaded, { type: 'catchUp', now: now + 1000 }).guild?.seasonal.length).toBe(guildLevel(1).contracts)
  })
})

describe('auto parties', () => {
  it('sends a second preset alongside the first at guild level 3', () => {
    let state = town(3)
    const heroes = ['w1', 'c1', 'w2', 'c2'].map((id) => hero(id, id.startsWith('w') ? 'warrior' : 'cleric'))
    state = { ...state, roster: heroes }
    state = reduce(state, { type: 'add', id: 'w1' })
    state = reduce(state, { type: 'add', id: 'c1' })
    state = reduce(state, { type: 'add', id: 'w2', presetId: 'p2' })
    state = reduce(state, { type: 'add', id: 'c2', presetId: 'p2' })
    state = reduce(state, { type: 'auto', enabled: true })
    state = reduce(state, { type: 'autoDungeon', id: 'hill_cave' })
    const ran = reduce(state, { type: 'catchUp', now: state.lastTickAt + villageRules.auto.runMs })
    expect(ran.roster.filter((entry) => entry.clears.includes('hill_cave')).map((entry) => entry.id).sort()).toEqual(['c1', 'c2', 'w1', 'w2'])
  })
})

describe('review 1208be3 fixes', () => {
  function autoTown(guild = 1): GameState {
    let state = town(guild)
    state = { ...state, roster: [hero('w', 'warrior'), hero('c', 'cleric')] }
    state = reduce(state, { type: 'add', id: 'w' })
    state = reduce(state, { type: 'add', id: 'c' })
    state = reduce(state, { type: 'auto', enabled: true })
    return reduce(state, { type: 'autoDungeon', id: 'hill_cave' })
  }

  it('settles auto runs against the board of the season they ran in', () => {
    const base = autoTown()
    const old: Contract = { id: 'old', kind: 'clear', dungeonId: 'hill_cave', need: 1, progress: 0, gold: 999, fame: 0, done: false }
    // One minute of spring left; the auto run lands in summer.
    const late = { ...base, calendar: { ...base.calendar, intoSeasonMs: timeRules.seasonMs - 60_000 }, guild: { ...base.guild!, seasonal: [old] } }
    const after = reduce(late, { type: 'catchUp', now: late.lastTickAt + villageRules.auto.runMs + 1000 })
    expect(after.guild?.season).not.toBe(late.guild?.season)
    expect(after.gold - late.gold).toBeLessThan(999)
  })

  it('waits to put up a board until something is cleared', () => {
    const empty = ensureBoard({ ...town(1), cleared: [], guild: null })
    expect(empty.guild?.season ?? '').toBe('')
    const later = ensureBoard({ ...empty, cleared: ['hill_cave'] })
    expect(later.guild?.seasonal.length).toBe(guildLevel(1).contracts)
    expect(later.guild?.repeat).toBeNull()
  })

  it('gives the second auto place to the next whole party that shares no hero', () => {
    let state = town(3)
    state = { ...state, roster: ['w1', 'c1', 'w3', 'c3'].map((id) => hero(id, id.startsWith('w') ? 'warrior' : 'cleric')) }
    for (const [id, presetId] of [['w1', 'p1'], ['c1', 'p1'], ['w1', 'p2'], ['c1', 'p2'], ['w3', 'p3'], ['c3', 'p3']] as const) {
      state = reduce(state, { type: 'add', id, presetId })
    }
    state = reduce(reduce(state, { type: 'auto', enabled: true }), { type: 'autoDungeon', id: 'hill_cave' })
    const ran = reduce(state, { type: 'catchUp', now: state.lastTickAt + villageRules.auto.runMs })
    expect(ran.roster.filter((entry) => entry.clears.includes('hill_cave')).map((entry) => entry.id).sort()).toEqual(['c1', 'c3', 'w1', 'w3'])
  })

  it('runs auto the same whether time comes in one piece or minute by minute', () => {
    const start = autoTown()
    const once = reduce(start, { type: 'catchUp', now: start.lastTickAt + villageRules.auto.runMs })
    let ticked = start
    for (let minute = 1; minute <= villageRules.auto.runMs / 60_000; minute += 1) {
      ticked = reduce(ticked, { type: 'catchUp', now: start.lastTickAt + minute * 60_000 })
    }
    expect(ticked.auto.nonce).toBe(once.auto.nonce)
    expect(ticked.roster.find((entry) => entry.id === 'w')?.clears).toEqual(once.roster.find((entry) => entry.id === 'w')?.clears)
    const twice = reduce(once, { type: 'catchUp', now: once.lastTickAt + villageRules.auto.runMs })
    expect(twice.auto.nonce).toBe((once.auto.nonce ?? 0) + 1)
  })

  it('moves a version 14 player past the swapped guild and auto steps with the guild reward', () => {
    const guildAt = guideSteps.findIndex((step) => step.id === 'guild')
    const old = { ...town(0), version: 14, guideStep: guildAt + 1 } as Record<string, unknown>
    const loaded = migrate(JSON.parse(JSON.stringify(old)), now)
    expect(loaded.guideStep).toBe(guildAt + 2)
    expect(loaded.materials.iron).toBe((old.materials as { iron: number }).iron + ((guideSteps[guildAt]?.reward as { iron?: number }).iron ?? 0))
    const early = migrate(JSON.parse(JSON.stringify({ ...old, guideStep: guildAt })), now)
    expect(early.guideStep).toBe(guildAt)
  })
})

