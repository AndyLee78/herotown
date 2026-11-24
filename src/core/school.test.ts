import { describe, expect, it } from 'vitest'
import { familyRules, schoolRules, timeRules } from './data'
import { freshState, migrate, reduce, type GameState } from './game'
import { createHero } from './hero'
import { graduate, schoolSeats, teachSeason, tuition } from './school'
import type { Hero } from './types'

// Docs/school.md: enrolment, lessons each season, careers at coming of age.

const now = 1_700_000_000_000
const stats = { str: 12, agi: 12, vit: 12, int: 12, wil: 12, wis: 12 }

function child(id: string, age: number, gender: 'male' | 'female' = 'male'): Hero {
  return createHero({ id, name: id, gender, classId: 'warrior', age, potentials: stats, potential: 50, parents: ['m', 'f'] })
}

function town(roster: Hero[], school = 1): GameState {
  const base = freshState(5, now)
  return { ...base, gold: 1000, roster, buildings: { ...base.buildings, school } }
}

describe('enrolment', () => {
  it('takes children from age 5, up to two seats per school level', () => {
    const state = town([child('a', 6), child('b', 7), child('c', 8), child('baby', 2)])
    expect(reduce({ ...state, buildings: { ...state.buildings, school: 0 } }, { type: 'enroll', heroId: 'a', focus: null, career: null }).notice).toBe('noSchool')
    expect(reduce(state, { type: 'enroll', heroId: 'baby', focus: null, career: null }).notice).toBe('tooYoung')
    let next = reduce(state, { type: 'enroll', heroId: 'a', focus: 'str', career: 'rogue' })
    next = reduce(next, { type: 'enroll', heroId: 'b', focus: null, career: null })
    expect(schoolSeats(next)).toBe(schoolRules.seatsPerLevel)
    expect(reduce(next, { type: 'enroll', heroId: 'c', focus: null, career: null }).notice).toBe('schoolFull')
    expect(reduce(next, { type: 'enroll', heroId: 'a', focus: 'agi', career: null }).roster[0]?.school?.focus).toBe('agi')
    expect(reduce(next, { type: 'unenroll', heroId: 'a' }).roster[0]?.school).toBeUndefined()
  })

  it('lets only girls choose the dancer career', () => {
    const state = town([child('boy', 6), child('girl', 6, 'female')])
    expect(reduce(state, { type: 'enroll', heroId: 'boy', focus: null, career: 'dancer' }).notice).toBe('career')
    expect(reduce(state, { type: 'enroll', heroId: 'girl', focus: null, career: 'dancer' }).notice).toBeNull()
  })
})

describe('lessons', () => {
  it('charge tuition each season and grow potential and the focused stat', () => {
    let state = reduce(town([child('a', 6)]), { type: 'enroll', heroId: 'a', focus: 'str', career: null })
    state = teachSeason(teachSeason(state))
    const pupil = state.roster[0]!
    expect(state.gold).toBe(1000 - 2 * tuition(state))
    expect(pupil.potential).toBe(50 + 2 * schoolRules.potentialPerSeason[0]!)
    expect(pupil.potentials.str).toBe(12 + 1)
    expect(pupil.school?.seasons).toBe(2)
  })

  it('skips a season it cannot pay for', () => {
    const state = { ...reduce(town([child('a', 6)]), { type: 'enroll', heroId: 'a', focus: 'str', career: null }), gold: 0 }
    const after = teachSeason(state)
    expect(after.roster[0]?.potential).toBe(50)
    expect(after.roster[0]?.school?.seasons).toBe(0)
  })

  it('teaches as seasons turn in the catch-up', () => {
    const base = reduce(town([child('a', 6)]), { type: 'enroll', heroId: 'a', focus: null, career: null })
    const late = { ...base, calendar: { ...base.calendar, intoSeasonMs: timeRules.seasonMs - 1000 } }
    expect(reduce(late, { type: 'catchUp', now: now + 2000 }).roster[0]?.school?.seasons).toBe(1)
  })
})

describe('coming of age', () => {
  it('takes the chosen career after enough seasons, and leaves school either way', () => {
    const studied = { ...child('a', familyRules.adultAge), school: { career: 'rogue' as const, seasons: schoolRules.careerSeasons, carry: 0 } }
    const graduated = graduate(studied)
    expect(graduated.classId).toBe('rogue')
    expect(graduated.school).toBeUndefined()
    const brief = graduate({ ...studied, school: { career: 'rogue' as const, seasons: 1, carry: 0 } })
    expect(brief.classId).toBe('warrior')
  })

  it('graduates a pupil who comes of age as the year turns', () => {
    const pupil = { ...child('a', familyRules.adultAge - 1), school: { career: 'archer' as const, seasons: 5, carry: 0 } }
    const base = town([pupil])
    const late = { ...base, calendar: { year: 1, season: 'winter' as const, intoSeasonMs: timeRules.seasonMs - 1000 } }
    const grown = reduce(late, { type: 'catchUp', now: now + 2000 }).roster[0]!
    expect(grown.classId).toBe('archer')
    expect(grown.school).toBeUndefined()
  })

  it('opens a version 18 save with nobody at school', () => {
    const old = { ...town([child('a', 6)]), version: 18 } as Record<string, unknown>
    expect(migrate(JSON.parse(JSON.stringify(old)), now).roster[0]?.school).toBeUndefined()
  })
})
