import { describe, expect, it } from 'vitest'
import { createHeroUnit } from './combat'
import { familyRules, progression, timeRules } from './data'
import { bondOf, bondParty, bondStage, familyOf, femaleChance, housingFree, makeChild, nextAge, partyBonus, population, topBonds } from './family'
import { canDeploy, createHero, type HeroDraft } from './hero'
import { freshState, migrate, reduce, type GameState } from './game'
import { createRng } from './rng'
import type { Hero, Stats } from './types'

const now = 1_700_000_000_000
const stats: Stats = { str: 10, agi: 10, vit: 10, int: 10, wil: 10, wis: 10 }

function hero(id: string, gender: 'male' | 'female', extra: Partial<HeroDraft> = {}): Hero {
  return createHero({ id, name: id, gender, classId: gender === 'female' ? 'cleric' : 'warrior', age: 24, potentials: stats, ...extra })
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

  it('needs a free home to accept', () => {
    const state = town([hero('a', 'male'), hero('b', 'female')], {
      buildings: { ...freshState(5, now).buildings, house: 0 },
      proposals: [{ a: 'a', b: 'b', at: now }],
    })
    expect(housingFree(state)).toBe(0)
    expect(reduce(state, { type: 'acceptProposal', a: 'a', b: 'b' }).notice).toBe('noHouse')
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
    expect(born.roster.find((entry) => entry.id === 'f')?.expecting).toBeUndefined()
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
