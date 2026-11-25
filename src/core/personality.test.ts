import { describe, expect, it } from 'vitest'
import { familyRules, moraleRules, personalityRules } from './data'
import { bondOf, bondParty, partyBonus } from './family'
import { createHeroUnit } from './combat'
import { freshState, migrate, reduce, type GameState } from './game'
import { createHero } from './hero'
import { moraleOf } from './morale'
import { afterTrip, affinityScale, benchAtDeparture, emotionScale, feel, inheritPersonality, PERSONALITY_IDS, personalityFor } from './personality'
import type { Hero, PersonalityId } from './types'

// Docs/personality.md: personalities, the new emotions, matches and clashes.

const now = 1_700_000_000_000
const stats = { str: 12, agi: 12, vit: 12, int: 12, wil: 12, wis: 12 }

function hero(id: string, personality: PersonalityId, extra: Partial<Hero> = {}): Hero {
  return { ...createHero({ id, name: id, gender: 'male', classId: 'warrior', age: 25, potentials: stats, personality }), ...extra }
}

function town(roster: Hero[], extra: Partial<GameState> = {}): GameState {
  return { ...freshState(5, now), roster, ...extra }
}

describe('personalities', () => {
  it('gives every hero one, steady for the same id and spread across all six', () => {
    expect(personalityFor('abc')).toBe(personalityFor('abc'))
    const seen = new Set(Array.from({ length: 200 }, (_, index) => personalityFor(`h${index}`)))
    expect(seen.size).toBe(PERSONALITY_IDS.length)
    expect(createHero({ id: 'x', name: 'x', gender: 'male', classId: 'warrior', age: 20, potentials: stats }).personality).toBe(personalityFor('x'))
  })

  it('passes to children most of the time', () => {
    const mother = hero('m', 'gentle')
    const father = hero('f', 'gentle')
    const kids = Array.from({ length: 200 }, (_, index) => inheritPersonality(`kid${index}`, mother, father))
    const gentle = kids.filter((id) => id === 'gentle').length / kids.length
    expect(gentle).toBeGreaterThan(personalityRules.inherit)
    expect(gentle).toBeLessThan(1)
  })

  it('makes the same event felt more or less strongly', () => {
    const ambitious = feel(hero('a', 'ambitious'), 'pride', 10)
    const gentle = feel(hero('g', 'gentle'), 'pride', 10)
    expect(moraleOf(ambitious)).toBeGreaterThan(moraleOf(gentle))
    expect(moraleOf(ambitious)).toBeCloseTo(moraleRules.base + 10 * emotionScale(ambitious, 'pride'))
  })

  it('lets matching personalities grow close faster than clashing ones', () => {
    expect(affinityScale(hero('a', 'social'), hero('b', 'social'))).toBeGreaterThan(affinityScale(hero('c', 'hotheaded'), hero('d', 'timid')))
    const state = town([hero('a', 'social'), hero('b', 'gentle'), hero('c', 'hotheaded'), hero('d', 'hotheaded')])
    const after = bondParty(bondParty(state, ['a', 'b'], true), ['c', 'd'], true)
    expect(bondOf(after, 'a', 'b')).toBeGreaterThan(bondOf(after, 'c', 'd'))
  })

  it('lifts or drags a party by how its members get on', () => {
    const calm = partyBonus(town([hero('a', 'social'), hero('b', 'gentle')]), ['a', 'b'])
    const clash = partyBonus(town([hero('c', 'hotheaded'), hero('d', 'timid')]), ['c', 'd'])
    expect(calm.a).toBeGreaterThan(0)
    expect(clash.c).toBeLessThan(0)
    expect(clash.c).toBeGreaterThanOrEqual(personalityRules.partyMin)
  })
})

describe('anxiety', () => {
  it('builds after defeats in a row and clears with a win', () => {
    let state = town([hero('a', 'timid')])
    state = afterTrip(state, ['a'], false)
    expect(moraleOf(state.roster[0]!)).toBe(moraleRules.base)
    state = afterTrip(state, ['a'], false)
    expect(moraleOf(state.roster[0]!)).toBeCloseTo(moraleRules.base - personalityRules.anxiety.loss * personalityRules.emotion.timid.anxiety)
    state = afterTrip(state, ['a'], true)
    expect(state.roster[0]!.losses).toBeUndefined()
  })

  it('worries a family member brought home critical', () => {
    const state = town([hero('w', 'gentle', { spouseId: 'h' }), hero('h', 'timid', { spouseId: 'w', condition: 'critical' }), hero('x', 'gentle')])
    const after = afterTrip(state, ['h'], true)
    expect(moraleOf(after.roster[0]!)).toBeLessThan(moraleRules.base)
    expect(moraleOf(after.roster[2]!)).toBe(moraleRules.base)
  })
})

describe('feeling left out', () => {
  it('stings after friends leave without them a few times in a row', () => {
    const bonds = [{ a: 'f', b: 's', affinity: familyRules.friendAt + 5 }]
    let state = town([hero('f', 'social'), hero('s', 'social'), hero('stranger', 'social')], { bonds })
    for (let trip = 1; trip < personalityRules.resentment.benchedTrips; trip += 1) {
      state = benchAtDeparture(state, ['f'], new Set())
    }
    expect(state.roster[1]!.benched).toBe(personalityRules.resentment.benchedTrips - 1)
    state = benchAtDeparture(state, ['f'], new Set())
    expect(moraleOf(state.roster[1]!)).toBeLessThan(moraleRules.base)
    expect(state.roster[1]!.benched).toBeUndefined()
    expect(moraleOf(state.roster[2]!)).toBe(moraleRules.base)
  })

  it('does not count heroes who are busy, tired or hurt', () => {
    const bonds = [{ a: 'f', b: 's', affinity: familyRules.friendAt + 5 }]
    const state = town([hero('f', 'social'), hero('s', 'social', { fatigue: 80 })], { bonds })
    expect(benchAtDeparture(state, ['f'], new Set()).roster[1]!.benched).toBeUndefined()
  })
})

describe('saves', () => {
  it('gives heroes from an older save the personality their id draws', () => {
    const old = JSON.parse(JSON.stringify(town([hero('a', 'social')]))) as Record<string, unknown>
    delete ((old.roster as Record<string, unknown>[])[0] as Record<string, unknown>).personality
    expect(migrate(old, now).roster[0]?.personality).toBe(personalityFor('a'))
  })
})

describe('review 49c92da fixes', () => {
  it('comforts at the winter memorial whoever was low before the festival', () => {
    const base = town([hero('s', 'social', { morale: 59 }), hero('l', 'loner', { morale: 63 })])
    const state = { ...base, gold: 1000, calendar: { ...base.calendar, season: 'winter' as const } }
    const held = reduce(state, { type: 'festival' })
    const [social, loner] = held.roster
    expect(moraleOf(social!)).toBeCloseTo(Math.min(100, 59 + (moraleRules.festival.morale + moraleRules.festival.memorial) * personalityRules.emotion.social.joy))
    expect(moraleOf(loner!)).toBeCloseTo(63 + moraleRules.festival.morale * personalityRules.emotion.loner.joy)
  })

  it('lets a personality clash touch attack but not healing', () => {
    const cleric = createHero({ id: 'c', name: 'c', gender: 'female', classId: 'cleric', age: 25, potentials: stats, personality: 'timid' })
    const plain = createHeroUnit({ hero: cleric, row: 'back' }, 0)
    const clash = createHeroUnit({ hero: cleric, row: 'back', bonus: personalityRules.partyMin, healBonus: 0 }, 0)
    expect(clash.attack).toBeCloseTo(plain.attack * (1 + personalityRules.partyMin))
    expect(clash.heal).toBeCloseTo(plain.heal)
  })

  it('worries retired kin too', () => {
    const state = town([hero('h', 'timid', { spouseId: 'w', condition: 'critical' })], {
      retirees: [{ hero: hero('w', 'timid', { spouseId: 'h', age: 60 }), retiredYear: 1, building: null }],
    })
    expect(moraleOf(afterTrip(state, ['h'], true).retirees[0]!.hero)).toBeLessThan(moraleRules.base)
  })

  it('counts a lightly tired hero as able to go', () => {
    const bonds = [{ a: 'f', b: 's', affinity: familyRules.friendAt + 5 }]
    const state = town([hero('f', 'social'), hero('s', 'social', { condition: 'fatigued', fatigue: 20 })], { bonds })
    expect(benchAtDeparture(state, ['f'], new Set()).roster[1]!.benched).toBe(1)
  })
})
