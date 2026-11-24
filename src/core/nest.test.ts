import { describe, expect, it } from 'vitest'
import { createHeroUnit, simulateFloor } from './combat'
import { dungeonById, nestRules, villageRules } from './data'
import { DEFAULT_TACTICS, runDungeon } from './dungeon'
import { busyHeroIds, dungeonUnlocked, freshState, migrate, reduce, type GameState } from './game'
import { createHero } from './hero'
import { timeRules } from './data'
import { AFFIX_IDS, nestRevealed, nestSeason, seasonKey } from './nest'
import { createRng } from './rng'
import type { ClassId, LogEntry, PartyMember } from './types'

// Docs/depth.md 3d: seasonal affixes, scouting and guild intel.

const now = 1_700_000_000_000
const stats = { str: 14, agi: 12, vit: 14, int: 12, wil: 12, wis: 14 }

function member(id: string, classId: ClassId, row: 'front' | 'back' = 'front', level = 20): PartyMember {
  return { row, hero: createHero({ id, name: id, gender: 'male', classId, age: 25, potentials: stats, level, training: level - 1 }) }
}

function town(extra: Partial<GameState> = {}): GameState {
  const base = freshState(5, now)
  const rogue = member('r', 'rogue').hero
  const mage = member('m', 'mage').hero
  const cleared = ['hill_cave', 'abandoned_mine', 'barrow', 'sunken_crypt', 'venom_marsh', 'bandit_fort', 'haunted_citadel']
  return { ...base, roster: [rogue, mage], gold: 500, cleared, buildings: { ...base.buildings, guild: 1 }, ...extra }
}

describe('nest seasons', () => {
  it('draws two different affixes and a lineup per floor, the same all season', () => {
    const spring = { year: 2, season: 'spring' as const, intoSeasonMs: 0 }
    const a = nestSeason(9, spring)
    const b = nestSeason(9, { ...spring, intoSeasonMs: 5000 })
    expect(a).toEqual(b)
    expect(new Set(a.affixes).size).toBe(nestRules.affixesPerSeason)
    expect(a.affixes.every((id) => AFFIX_IDS.includes(id))).toBe(true)
    expect(a.floors).toHaveLength(nestRules.floors.length)
    const seasons = ['spring', 'summer', 'autumn', 'winter'] as const
    const draws = new Set([1, 2, 3].flatMap((year) => seasons.map((season) => nestSeason(9, { year, season, intoSeasonMs: 0 }).affixes.join('+'))))
    expect(draws.size).toBeGreaterThan(4)
  })

  it('opens after the citadel and gives crystals', () => {
    const base = freshState(5, now)
    const before = ['hill_cave', 'abandoned_mine', 'barrow', 'sunken_crypt', 'venom_marsh', 'bandit_fort']
    expect(dungeonUnlocked({ ...base, cleared: before }, 'dragon_nest')).toBe(false)
    expect(dungeonUnlocked({ ...base, cleared: [...before, 'haunted_citadel'] }, 'dragon_nest')).toBe(true)
    expect(dungeonById('dragon_nest').tier).toBe(7)
    expect((villageRules.drops as Record<string, { material: string }>).dragon_nest?.material).toBe('crystal')
  })
})

describe('scouting and intel', () => {
  it('sends a rogue out for a while, then reveals the season', () => {
    const state = town()
    expect(nestRevealed(state)).toBe(false)
    expect(reduce(state, { type: 'scout', heroId: 'm', now }).notice).toBe('scoutHero')
    const out = reduce(state, { type: 'scout', heroId: 'r', now })
    expect(out.notice).toBeNull()
    expect(busyHeroIds(out).has('r')).toBe(true)
    expect(reduce(out, { type: 'scout', heroId: 'r', now }).notice).toBe('busyHero')
    const back = reduce(out, { type: 'catchUp', now: now + nestRules.scoutMs + 1 })
    expect(back.scout).toBeNull()
    expect(nestRevealed(back)).toBe(true)
    expect(busyHeroIds(back).has('r')).toBe(false)
  })

  it('sells intel at the guild, and hides it again when the season turns', () => {
    const state = town()
    expect(reduce({ ...state, buildings: { ...state.buildings, guild: 0 } }, { type: 'buyIntel' }).notice).toBe('noGuild')
    const bought = reduce(state, { type: 'buyIntel' })
    expect(bought.gold).toBe(state.gold - nestRules.intelGold)
    expect(nestRevealed(bought)).toBe(true)
    expect(reduce(bought, { type: 'buyIntel' }).notice).toBe('nestKnown')
    const nextSeason = { ...bought, calendar: { ...bought.calendar, season: bought.calendar.season === 'winter' ? ('spring' as const) : ('winter' as const) } }
    expect(nestRevealed(nextSeason)).toBe(false)
    expect(seasonKey(nextSeason.calendar)).not.toBe(bought.nestSeen)
  })

  it('opens a version 12 save with nothing revealed and nobody scouting', () => {
    const old = { ...town(), version: 12 } as Record<string, unknown>
    delete old.nestSeen
    delete old.scout
    const loaded = migrate(JSON.parse(JSON.stringify(old)), now)
    expect(loaded.nestSeen).toBeNull()
    expect(loaded.scout).toBeNull()
  })
})

describe('affixes in battle', () => {
  const fight = (affixes: Parameters<typeof simulateFloor>[10], monsters = ['drake', 'wyvern', 'kobold_mystic']) => {
    const heroes = [member('w', 'warrior'), member('c', 'cleric', 'back')].map((entry, index) => createHeroUnit(entry, index))
    const log: LogEntry[] = []
    simulateFloor(heroes, monsters, DEFAULT_TACTICS, createRng(1), log, 1, undefined, 1, undefined, 0, affixes)
    return log
  }

  it('lets one weak enemy ambush and one fast back-row enemy silence', () => {
    const ambush = fight(['ambush']).filter((entry) => entry.key === 'log.ambush')
    expect(ambush).toHaveLength(1)
    expect(String(ambush[0]?.params.actorId)).toBe('kobold_mystic-3')
    const silence = fight(['silence'])
    const silencers = new Set(silence.filter((entry) => entry.key === 'log.silence').map((entry) => entry.params.targetId))
    expect(silencers.size).toBeLessThanOrEqual(2)
  })

  it('poisons with venom and gives the boss a charged blast', () => {
    expect(fight(['venom']).some((entry) => entry.key === 'log.dot')).toBe(true)
    expect(fight(['charged'], ['elder_dragon']).some((entry) => entry.key === 'log.charge')).toBe(true)
    expect(fight([], ['elder_dragon']).some((entry) => entry.key === 'log.charge')).toBe(false)
  })

  it('adds traps, drops the rest between floors, and names the affixes in the report', () => {
    const party = [member('w', 'warrior'), member('a', 'archer', 'back'), member('c', 'cleric', 'back')]
    const result = runDungeon(party, 'dragon_nest', DEFAULT_TACTICS, 3, {}, { affixes: ['traps', 'noRest'] })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.report.affixes).toEqual(['traps', 'noRest'])
    expect(result.report.traps).toBeDefined()
    const plain = runDungeon(party, 'barrow', DEFAULT_TACTICS, 3)
    expect(plain.ok && plain.report.affixes).toBeUndefined()
  })

  it('sends a party into this season and reveals it when they come home', () => {
    const cleared = ['hill_cave', 'abandoned_mine', 'barrow', 'sunken_crypt', 'venom_marsh', 'bandit_fort', 'haunted_citadel']
    let state = town({ cleared, dungeonId: 'dragon_nest' })
    state = reduce(state, { type: 'add', id: 'r' })
    state = reduce(state, { type: 'add', id: 'm' })
    const sent = reduce(state, { type: 'depart', now, confirm: true })
    const trip = sent.expeditions[0]
    expect(trip?.report.affixes).toEqual(nestSeason(sent.seed, sent.calendar).affixes)
    const home = reduce(sent, { type: 'catchUp', now: trip!.returnAt + 1 })
    expect(nestRevealed(home)).toBe(true)
  })
})

describe('review f47daff fixes', () => {
  it('sells no intel and sends no scout while the nest is locked', () => {
    const locked = town({ cleared: ['hill_cave'] })
    expect(reduce(locked, { type: 'buyIntel' }).notice).toBe('lockedDungeon')
    expect(reduce(locked, { type: 'scout', heroId: 'r', now }).notice).toBe('lockedDungeon')
  })

  it('reveals only the season a trip went into', () => {
    let state = town({ dungeonId: 'dragon_nest' })
    state = { ...state, calendar: { ...state.calendar, intoSeasonMs: timeRules.seasonMs - 1000 } }
    state = reduce(reduce(state, { type: 'add', id: 'r' }), { type: 'add', id: 'm' })
    const sent = reduce(state, { type: 'depart', now, confirm: true })
    expect(sent.expeditions[0]?.nestKey).toBe(seasonKey(state.calendar))
    const home = reduce(sent, { type: 'catchUp', now: sent.expeditions[0]!.returnAt + 1 })
    expect(seasonKey(home.calendar)).not.toBe(seasonKey(state.calendar))
    expect(nestRevealed(home)).toBe(false)
  })

  it('reports on the new season when a scout is due right at the turn, and on nothing if the scout is gone', () => {
    const base = town()
    // Five seconds before the season turns (the offline cap would swallow a whole season).
    const late = { ...base, calendar: { ...base.calendar, intoSeasonMs: timeRules.seasonMs - 5000 } }
    const left = 5000
    const due = { ...late, scout: { heroId: 'r', finishAt: now + left } }
    const turned = reduce(due, { type: 'catchUp', now: now + left + 1 })
    expect(turned.scout).toBeNull()
    expect(turned.nestSeen).toBe(seasonKey(turned.calendar))
    const lost = reduce({ ...late, roster: late.roster.filter((hero) => hero.id !== 'r'), scout: { heroId: 'r', finishAt: now + 1000 } }, { type: 'catchUp', now: now + 2000 })
    expect(lost.scout).toBeNull()
    expect(nestRevealed(lost)).toBe(false)
  })
})

