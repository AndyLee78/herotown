import { describe, expect, it } from 'vitest'
import { createHeroUnit } from './combat'
import { familyRules, maxAge, progression, timeRules, villageRules } from './data'
import { isLegend, ancestorsOf, bedsTaken, bondOf, bondParty, bondStage, canCourt, familyLegends, familyOf, graveFor, hallOfFame, legendBonus, oldAgeChance, passAway, femaleChance, makeChild, nextAge, partyBonus, population, topBonds } from './family'
import { canDeploy, createHero, isChild, type HeroDraft } from './hero'
import { freshState, migrate, reduce, type GameState } from './game'
import { createRng } from './rng'
import type { Hero, Stats } from './types'

const now = 1_700_000_000_000
const stats: Stats = { str: 10, agi: 10, vit: 10, int: 10, wil: 10, wis: 10 }

function hero(id: string, gender: 'male' | 'female', extra: Partial<HeroDraft> = {}): Hero {
  // Timid heroes have no personality match or clash with each other, so bond
  // numbers read as written (Docs/personality.md).
  return createHero({ id, name: id, gender, classId: gender === 'female' ? 'cleric' : 'warrior', age: 24, potentials: stats, personality: 'timid', ...extra })
}

function town(roster: Hero[], extra: Partial<GameState> = {}): GameState {
  return { ...freshState(5, now), roster, buildings: { ...freshState(5, now).buildings, house: 2 }, ...extra }
}

// Moves time forward a season at a time, half a season per catch-up so the
// offline cap never swallows time.
function passSeasons(state: GameState, seasons: number): GameState {
  let next = state
  for (let step = 0; step < seasons * 2; step += 1) {
    next = reduce(next, { type: 'catchUp', now: next.lastTickAt + timeRules.seasonMs / 2 })
  }
  return next
}

function couple(): GameState {
  const husband = hero('m', 'male', { spouseId: 'f' })
  const wife = hero('f', 'female', { spouseId: 'm' })
  return town([husband, wife], { bonds: [{ a: 'f', b: 'm', affinity: 100 }] })
}

describe('bonds', () => {
  it('brings heroes closer when they come home from the same expedition', () => {
    const state = town([hero('a', 'male'), hero('b', 'female'), hero('c', 'male')])
    const after = bondParty(state, ['a', 'b'], true)
    expect(bondOf(after, 'a', 'b')).toBe(familyRules.affinityPerTrip + familyRules.affinityWinBonus)
    expect(bondOf(after, 'b', 'a')).toBe(bondOf(after, 'a', 'b'))
    expect(bondOf(after, 'a', 'c')).toBe(0)
  })

  it('grows affinity between adults living together each season', () => {
    const state = passSeasons(town([hero('a', 'male'), hero('b', 'female'), hero('kid', 'male', { age: 5 })]), 1)
    expect(bondOf(state, 'a', 'b')).toBeGreaterThan(0)
    expect(bondOf(state, 'a', 'kid')).toBe(0)
  })

  it('names stages: friends, lovers only between free adults of opposite genders, spouses', () => {
    const state = town([hero('a', 'male'), hero('b', 'female'), hero('c', 'male'), hero('young', 'female', { age: 16 })], {
      bonds: [
        { a: 'a', b: 'b', affinity: 75 },
        { a: 'a', b: 'c', affinity: 90 },
        { a: 'a', b: 'young', affinity: 90 },
      ],
    })
    expect(bondStage(state, 'a', 'b')).toBe('lover')
    expect(bondStage(state, 'a', 'c')).toBe('friend')
    expect(bondStage(state, 'a', 'young')).toBe('friend')
    expect(bondStage(couple(), 'm', 'f')).toBe('spouse')
    expect(topBonds(state, 'a', 2).map((bond) => bond.id)).toEqual(['c', 'young'])
  })

  it('gives friends and lovers a capped bonus side by side, and it raises attack', () => {
    const state = town([hero('a', 'male'), hero('b', 'female'), hero('c', 'male')], {
      bonds: [
        { a: 'a', b: 'b', affinity: 75 },
        { a: 'a', b: 'c', affinity: 45 },
      ],
    })
    const bonus = partyBonus(state, ['a', 'b', 'c'])
    expect(bonus.a).toBeCloseTo(familyRules.loverBonus + familyRules.friendBonus)
    expect(bonus.b).toBeCloseTo(familyRules.loverBonus)
    expect(bonus.c).toBeCloseTo(familyRules.friendBonus)
    const plain = createHeroUnit({ hero: state.roster[0]!, row: 'front' }, 0)
    const boosted = createHeroUnit({ hero: state.roster[0]!, row: 'front', bonus: bonus.a }, 0)
    expect(boosted.attack).toBeCloseTo(plain.attack * (1 + (bonus.a ?? 0)))
  })
})

describe('proposals and marriage', () => {
  it('raises a proposal for close lovers and marries them when the player accepts', () => {
    const start = town([hero('a', 'male'), hero('b', 'female')], { bonds: [{ a: 'a', b: 'b', affinity: 95 }] })
    let state = start
    for (let season = 0; season < 12 && state.proposals.length === 0; season += 1) {
      state = passSeasons(state, 1)
    }
    expect(state.proposals).toHaveLength(1)
    const wed = reduce(state, { type: 'acceptProposal', a: 'b', b: 'a' })
    expect(wed.proposals).toEqual([])
    expect(wed.roster.find((entry) => entry.id === 'a')?.spouseId).toBe('b')
    expect(wed.roster.find((entry) => entry.id === 'b')?.spouseId).toBe('a')
    expect(bondStage(wed, 'a', 'b')).toBe('spouse')
  })

  it('allows a third couple in an existing save without adding to its bed use', () => {
    const state = town([
      hero('a', 'male'), hero('b', 'female'),
      hero('c', 'male', { spouseId: 'd' }), hero('d', 'female', { spouseId: 'c' }),
      hero('e', 'male', { spouseId: 'f' }), hero('f', 'female', { spouseId: 'e' }),
    ], {
      buildings: { ...freshState(5, now).buildings, house: 1 },
      proposals: [{ a: 'a', b: 'b', at: now }],
    })
    const loaded = migrate(JSON.parse(JSON.stringify(state)), now)
    const wed = reduce(loaded, { type: 'acceptProposal', a: 'a', b: 'b' })
    expect(wed.notice).toBeNull()
    expect(familyOf(wed, 'a').spouse?.id).toBe('b')
    expect(bedsTaken(wed)).toBe(bedsTaken(loaded))
  })

  it('permits marriage at full occupancy and still prevents conception without a free bed', () => {
    const state = town([
      hero('a', 'male'), hero('b', 'female'), hero('c', 'male'), hero('d', 'female'), hero('e', 'male'),
    ], {
      buildings: { ...freshState(5, now).buildings, house: 1 },
      proposals: [{ a: 'a', b: 'b', at: now }],
    })
    const wed = reduce(state, { type: 'acceptProposal', a: 'a', b: 'b' })
    expect(wed.notice).toBeNull()
    expect(bedsTaken(wed)).toBe(5)
    expect(familyOf(wed, 'a').spouse?.id).toBe('b')
    expect(passSeasons(wed, 8).roster.some(({ expecting }) => expecting)).toBe(false)
  })

  it('cools a pair down when the player refuses', () => {
    const state = town([hero('a', 'male'), hero('b', 'female')], {
      bonds: [{ a: 'a', b: 'b', affinity: 90 }],
      proposals: [{ a: 'a', b: 'b', at: now }],
    })
    const refused = reduce(state, { type: 'declineProposal', a: 'a', b: 'b', now })
    expect(refused.proposals).toEqual([])
    expect(bondOf(refused, 'a', 'b')).toBe(90 - familyRules.declineAffinity)
    expect(refused.bonds[0]?.cooldownUntil).toBe(now + familyRules.declineCooldownSeasons * timeRules.seasonMs)
  })

  it('widows a spouse who loses their partner, and lets them court again after mourning', () => {
    const state = reduce(couple(), { type: 'dismiss', id: 'm' })
    const widow = state.roster.find((entry) => entry.id === 'f')!
    expect(widow.spouseId).toBeUndefined()
    expect(widow.widowedAt).toBe(state.lastTickAt)
    expect(state.bonds).toEqual([])
  })
})

describe('children', () => {
  it('conceives, keeps the mother home, and gives birth a season later', () => {
    let state = couple()
    for (let season = 0; season < 20 && !state.roster.some((entry) => entry.expecting); season += 1) {
      state = passSeasons(state, 1)
    }
    const mother = state.roster.find((entry) => entry.id === 'f')!
    expect(mother.expecting).toBeDefined()
    expect(canDeploy(mother)).toBe(false)
    const born = passSeasons(state, 1)
    const child = born.roster.find((entry) => entry.parents?.includes('f'))
    expect(child).toBeDefined()
    expect(child?.age).toBe(0)
    expect(child?.family).toBe('m')
    expect(child?.genes).toBeDefined()
    // The mother may already expect again at the same season turn, but not the same child.
    expect(born.roster.find((entry) => entry.id === 'f')?.expecting?.child.id).not.toBe(child?.id)
    expect(familyOf(born, 'f').children.map((entry) => entry.id)).toEqual([child?.id])
    expect(familyOf(born, child!.id).parents.map((entry) => entry.id).sort()).toEqual(['f', 'm'])
  })

  it('does not conceive when the mother is too old or the beds are full', () => {
    const old = { ...couple(), roster: couple().roster.map((entry) => (entry.id === 'f' ? { ...entry, age: familyRules.maxMotherAge + 1 } : entry)) }
    expect(passSeasons(old, 8).roster.some((entry) => entry.expecting)).toBe(false)
    const cramped = { ...couple(), buildings: { ...couple().buildings, house: 0 } }
    expect(passSeasons(cramped, 8).roster.some((entry) => entry.expecting)).toBe(false)
  })

  it('grows children faster until they are old enough to go out, and charges no wages for them', () => {
    expect(nextAge(0)).toBe(familyRules.childYearsPerYear)
    expect(nextAge(familyRules.adultAge - 1)).toBe(familyRules.adultAge)
    expect(nextAge(familyRules.adultAge)).toBe(familyRules.adultAge + 1)
    const state = town([hero('kid', 'male', { age: 2 })], { gold: 100 })
    const later = passSeasons(state, 4)
    expect(later.roster[0]?.age).toBe(2 + familyRules.childYearsPerYear)
    expect(later.gold).toBe(100)
    expect(progression.wage).toBeGreaterThan(0)
  })

  it('inherits stats near the parents, traits from them, and never a dancer son', () => {
    const mother = hero('f', 'female', { classId: 'dancer', potentials: { ...stats, agi: 30 }, potential: 80, traitIds: ['tough'] })
    const father = hero('m', 'male', { potentials: { ...stats, str: 30 }, potential: 40, traitIds: ['coward'] })
    for (let seed = 0; seed < 60; seed += 1) {
      const child = makeChild(createRng(seed), `c${seed}`, mother, father)
      const genius = child.potentials.agi > 20 * 1.1 + 1
      const scale = genius ? familyRules.geniusScale : 1
      expect(child.potentials.agi).toBeGreaterThanOrEqual(Math.floor(20 * 0.9 * scale))
      expect(child.potentials.agi).toBeLessThanOrEqual(Math.ceil(20 * 1.1 * scale))
      if (child.gender === 'male') {
        expect(child.classId).toBe('warrior')
      }
      expect(child.traitIds.length).toBeLessThanOrEqual(familyRules.maxTraits)
      expect(child.potential).toBeGreaterThanOrEqual(60 - familyRules.potentialSpread - 1)
      expect(child.parents).toEqual(['f', 'm'])
    }
  })
})

describe('village balance and saves', () => {
  it('sends more of the missing gender when the village is lopsided', () => {
    expect(femaleChance(town([hero('a', 'male'), hero('b', 'male'), hero('c', 'male'), hero('d', 'female')]))).toBe(familyRules.visitorBalanceChance)
    expect(femaleChance(town([hero('a', 'male'), hero('b', 'female')]))).toBe(0.5)
  })

  it('counts the village by age band and gender', () => {
    const counts = population(couple())
    expect(counts.bands.prime?.male).toBe(0)
    expect(counts.bands.rising?.male).toBe(1)
    expect(counts.married).toBe(2)
    expect(counts.beds.used).toBe(2)
  })

  it('opens an older save with empty family records and keeps family fields on heroes', () => {
    const saved = { ...couple(), version: 7 } as Record<string, unknown>
    delete saved.bonds
    delete saved.proposals
    delete saved.familyNonce
    const loaded = migrate(JSON.parse(JSON.stringify(saved)), now)
    expect(loaded.bonds).toEqual([])
    expect(loaded.proposals).toEqual([])
    expect(loaded.roster.find((entry) => entry.id === 'f')?.spouseId).toBe('m')
  })
})

describe('review 443bde5 fixes', () => {
  it('never lets parents, children or siblings court', () => {
    const father = hero('m', 'male')
    const daughter = hero('d', 'female', { parents: ['f', 'm'] })
    const brother = hero('s', 'male', { parents: ['f', 'm'] })
    const halfBrother = hero('h', 'male', { parents: ['x', 'm'] })
    const stranger = hero('o', 'male')
    expect(canCourt(daughter, father, now)).toBe(false)
    expect(canCourt(daughter, brother, now)).toBe(false)
    expect(canCourt(daughter, halfBrother, now)).toBe(false)
    expect(canCourt(daughter, stranger, now)).toBe(true)
    const state = town([father, daughter, brother], {
      bonds: [
        { a: 'd', b: 'm', affinity: 100 },
        { a: 'd', b: 's', affinity: 100 },
      ],
    })
    expect(passSeasons(state, 6).proposals).toEqual([])
  })

  it('keeps a proposal open but refuses to wed a hero waiting to be revived', () => {
    const state = town([hero('a', 'male', { condition: 'dead', deaths: 1 }), hero('b', 'female')], {
      proposals: [{ a: 'a', b: 'b', at: now }],
    })
    const tried = reduce(state, { type: 'acceptProposal', a: 'a', b: 'b' })
    expect(tried.notice).toBe('dead')
    expect(tried.proposals).toHaveLength(1)
    expect(tried.roster.every((entry) => entry.spouseId == null)).toBe(true)
  })

  it('saves a bed for a baby on the way, so hiring cannot overfill the houses', () => {
    const child = hero('baby', 'male', { age: 0 })
    const mother = hero('f', 'female', { spouseId: 'm', expecting: { dueAt: now + 1000, child } })
    const state = town([hero('m', 'male', { spouseId: 'f' }), mother, hero('x', 'male'), hero('y', 'female')], {
      buildings: { ...freshState(5, now).buildings, house: 1 },
      gold: 1000,
    })
    const visitor = state.visitors[0]!
    expect(reduce(state, { type: 'hire', id: visitor.id, now }).notice).toBe('beds')
  })

  it('rolls family events at the season turn, the same in one catch-up or two', () => {
    const toTurn = 2 * 60 * 60 * 1000
    let checked = 0
    for (let seed = 1; seed < 80 && checked === 0; seed += 1) {
      const start = { ...couple(), seed, calendar: { ...couple().calendar, intoSeasonMs: timeRules.seasonMs - toTurn } }
      const end = now + toTurn + 60 * 60 * 1000
      const once = reduce(start, { type: 'catchUp', now: end })
      const mother = once.roster.find((entry) => entry.id === 'f')
      if (!mother?.expecting) {
        continue
      }
      checked += 1
      expect(mother.expecting.dueAt).toBe(now + toTurn + timeRules.seasonMs)
      const half = reduce(start, { type: 'catchUp', now: now + toTurn - 1000 })
      const twice = reduce(half, { type: 'catchUp', now: end })
      expect(twice.roster.find((entry) => entry.id === 'f')?.expecting?.dueAt).toBe(mother.expecting.dueAt)
      expect(twice.bonds).toEqual(once.bonds)
      expect(twice.familyNonce).toBe(once.familyNonce)
    }
    expect(checked).toBe(1)
  })

  it('rolls a trait both parents share only once', () => {
    const mother = hero('f', 'female', { traitIds: ['tough'] })
    const father = hero('m', 'male', { traitIds: ['tough'] })
    let tough = 0
    const runs = 2000
    for (let seed = 0; seed < runs; seed += 1) {
      if (makeChild(createRng(seed), `c${seed}`, mother, father).traitIds.includes('tough')) {
        tough += 1
      }
    }
    expect(tough / runs).toBeGreaterThan(familyRules.traitInherit - 0.05)
    expect(tough / runs).toBeLessThan(familyRules.traitInherit + 0.07)
  })
})

describe('stage 2b: old age, graves and legends', () => {
  const noEvents = () => ({ births: [], proposals: 0, deaths: [] as string[] })

  it('raises the chance of passing away each year after 60, and is certain at the oldest age', () => {
    expect(oldAgeChance(familyRules.oldAgeFrom - 1)).toBe(0)
    expect(oldAgeChance(61)).toBeCloseTo(2 * familyRules.oldAgeChancePerYear)
    expect(oldAgeChance(70)).toBeGreaterThan(oldAgeChance(65))
    expect(oldAgeChance(maxAge)).toBe(1)
  })

  it('takes the oldest to the graveyard with their family record, widows the spouse and frees their post', () => {
    const elder = hero('m', 'male', { age: maxAge, spouseId: 'f', family: 'Aldon', level: 13 })
    const wife = hero('f', 'female', { age: 60, spouseId: 'm' })
    const retired = hero('r', 'male', { age: maxAge })
    const state = town([elder, wife], {
      retirees: [{ hero: retired, retiredYear: 1, building: 'inn' }],
      presets: freshState(5, now).presets.map((preset) => ({ ...preset, slots: [{ id: 'm', row: 'front' as const }] })),
    })
    const events = noEvents()
    const after = reduce(passAway(state, events), { type: 'catchUp', now: now + 1 })
    expect(events.deaths.sort()).toEqual(['m', 'r'])
    expect(after.roster.map((entry) => entry.id)).toEqual(['f'])
    expect(after.retirees).toEqual([])
    expect(after.presets.every((preset) => preset.slots.length === 0)).toBe(true)
    expect(after.roster[0]?.spouseId).toBeUndefined()
    expect(after.roster[0]?.widowedAt).toBeDefined()
    const grave = after.graveyard.find((entry) => entry.id === 'm')
    expect(grave).toMatchObject({ cause: 'oldAge', age: maxAge, family: 'Aldon', spouseId: 'f', gender: 'male', legend: true })
    expect(hallOfFame(after).map((entry) => entry.id)).toEqual(['m'])
  })

  it('lets an elder on an expedition come home before old age can take them', () => {
    const elder = hero('m', 'male', { age: maxAge })
    const state = town([elder], { expeditions: [{ heroIds: ['m'] } as GameState['expeditions'][number]] })
    expect(passAway(state, noEvents()).roster).toHaveLength(1)
  })

  it('gives newborns of a family with legends extra potential, up to a cap', () => {
    const legend = graveFor(hero('g', 'male', { family: 'Aldon', level: familyRules.legendLevel }), 'oldAge', 3)
    const plain = graveFor(hero('p', 'male', { family: 'Aldon', level: 1 }), 'battle', 3)
    const state = town([], { graveyard: [legend, plain] })
    expect(familyLegends(state, 'Aldon').map((grave) => grave.id)).toEqual(['g'])
    expect(legendBonus(state, 'Aldon')).toBe(familyRules.legendPotential)
    const many = town([], { graveyard: Array.from({ length: 9 }, (_, index) => ({ ...legend, id: `g${index}` })) })
    expect(legendBonus(many, 'Aldon')).toBe(familyRules.legendPotentialMax)
    const mother = hero('f', 'female', { potential: 50 })
    const father = hero('m', 'male', { potential: 50, family: 'Aldon' })
    const without = makeChild(createRng(4), 'c', mother, father)
    const withBonus = makeChild(createRng(4), 'c', mother, father, 10)
    expect(withBonus.potential).toBe(Math.min(100, without.potential + 10))
  })

  it('finds parents and grandparents among the living and the graves', () => {
    const grandpa = graveFor(hero('gp', 'male'), 'oldAge', 2)
    const dad = hero('d', 'male', { age: 40, parents: ['gm', 'gp'] })
    const kid = hero('k', 'female', { age: 10, parents: ['mm', 'd'] })
    const found = ancestorsOf(town([dad, kid], { graveyard: [grandpa] }), 'k')
    expect(found.map((entry) => [entry.id, entry.generation, entry.living])).toEqual([
      ['d', 1, true],
      ['gp', 2, false],
    ])
  })

  // Levels 5 and 6 came with the endgame (Docs/endgame.md).
  it('builds houses up to level 6', () => {
    const house = villageRules.buildings.find((building) => building.id === 'house')
    expect(house?.levels.map((level) => level.level)).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('opens a version 8 save whose graves have no family record', () => {
    const saved = { ...couple(), version: 8, graveyard: [{ id: 'old', name: 'Old', classId: 'warrior', level: 3, clears: [] }] }
    const loaded = migrate(JSON.parse(JSON.stringify(saved)), now)
    expect(loaded.graveyard[0]).toMatchObject({ id: 'old', level: 3 })
    expect(hallOfFame(loaded)).toEqual([])
  })
})

describe('review f7fdf88 fixes', () => {
  // Winter, two seconds before the year turns.
  const lateWinter = (state: GameState): GameState => ({ ...state, calendar: { year: 1, season: 'winter', intoSeasonMs: timeRules.seasonMs - 2000 } })
  const yearTurn = now + 2000

  it('buries a hero who died on an expedition home before new year with that year and age, however time is caught up', () => {
    const fallen = hero('m', 'male', { age: 50, deaths: 1 })
    const report = { victory: false, defeatReason: 'wiped' as const, ticks: 1, floorsCleared: 0, gold: 0, xp: 0, units: [], log: [], conditions: [{ id: 'm', condition: 'dead' as const, fatigue: 0 }] }
    const expedition = { id: 'e1', presetId: 'p1', dungeonId: 'abandoned_mine', heroIds: ['m'], seed: 1, report, departAt: now - 9000, battleAt: now - 5000, battleEndAt: now - 3000, returnAt: yearTurn - 1000 }
    const start = lateWinter(town([fallen, hero('f', 'female')], { expeditions: [expedition] }))
    const once = reduce(start, { type: 'catchUp', now: now + 60_000 })
    const split = reduce(reduce(start, { type: 'catchUp', now: yearTurn - 500 }), { type: 'catchUp', now: now + 60_000 })
    for (const state of [once, split]) {
      expect(state.graveyard.find((grave) => grave.id === 'm')).toMatchObject({ cause: 'battle', year: 1, age: 50 })
    }
  })

  it('starts mourning when the spouse passed away, even when the catch-up hits the offline cap', () => {
    const elder = hero('m', 'male', { age: maxAge - 1, spouseId: 'f' })
    const wife = hero('f', 'female', { age: 50, spouseId: 'm' })
    const start = lateWinter(town([elder, wife]))
    const after = reduce(start, { type: 'catchUp', now: now + 24 * 60 * 60 * 1000 })
    expect(after.graveyard.some((grave) => grave.id === 'm' && grave.cause === 'oldAge')).toBe(true)
    expect(after.roster.find((entry) => entry.id === 'f')?.widowedAt).toBe(yearTurn)
  })

  it('leaves a hero fallen in battle to be revived rather than taken by old age', () => {
    const fallen = hero('m', 'male', { age: maxAge - 1, condition: 'dead', deaths: 1 })
    const after = reduce(lateWinter(town([fallen])), { type: 'catchUp', now: now + 60_000 })
    expect(after.roster.map((entry) => entry.id)).toEqual(['m'])
    expect(after.graveyard).toEqual([])
  })

  it('ignores clears of dungeons that are no longer in the data when judging legends', () => {
    expect(isLegend(hero('m', 'male', { level: 1, clears: ['retired_dungeon'] }))).toBe(false)
    expect(isLegend(hero('m', 'male', { level: 1, clears: ['retired_dungeon', 'barrow'] }))).toBe(true)
  })
})

describe('children in the hero lists', () => {
  const lateWinter = (state: GameState): GameState => ({ ...state, calendar: { year: 1, season: 'winter', intoSeasonMs: timeRules.seasonMs - 2000 } })

  it('keeps a child out of parties and welcomes them once they come of age', () => {
    const child = hero('kid', 'female', { age: familyRules.adultAge - 1 })
    const grown = hero('adult', 'male', { age: 30 })
    expect(isChild(child)).toBe(true)
    expect(isChild(grown)).toBe(false)
    const state = lateWinter(town([child, grown]))
    expect(reduce(state, { type: 'add', id: 'kid' }).presets[0]?.slots.some((slot) => slot.id === 'kid')).toBe(false)
    const next = reduce(state, { type: 'catchUp', now: now + 3000 })
    expect(next.roster.find((entry) => entry.id === 'kid')?.age).toBe(familyRules.adultAge)
    expect(next.comingOfAge).toEqual(['kid'])
    expect(reduce(next, { type: 'add', id: 'kid' }).presets[0]?.slots.some((slot) => slot.id === 'kid')).toBe(true)
    expect(reduce(next, { type: 'seenAdults' }).comingOfAge).toEqual([])
  })

  it('opens an older save with nobody waiting for a welcome', () => {
    const old = { ...town([hero('a', 'male')]), version: 12 } as Record<string, unknown>
    delete old.comingOfAge
    expect(migrate(JSON.parse(JSON.stringify(old)), now).comingOfAge).toEqual([])
  })
})

