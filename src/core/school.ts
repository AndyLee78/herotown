import { classById, retirementRules, schoolRules } from './data'
import type { GameState } from './game'
import { createHero, isChild } from './hero'
import type { ClassId, Hero, StatKey } from './types'

// The school (Docs/school.md): children study a stat, grow their potential
// and may choose a career they take at their coming of age.

export type Schooling = { focus?: StatKey; career?: ClassId; seasons: number; carry: number }

export function schoolSeats(state: GameState): number {
  return state.buildings.school * schoolRules.seatsPerLevel
}

export function tuition(state: GameState): number {
  const kept = (state.retirees ?? []).some((retiree) => retiree.building === 'school')
  return Math.round(schoolRules.tuition * (1 - (kept ? retirementRules.bonus.school : 0)))
}

export function pupils(state: GameState): Hero[] {
  return state.roster.filter((hero) => hero.school != null)
}

export function enroll(state: GameState, heroId: string, focus: StatKey | null, career: ClassId | null): GameState {
  if (state.buildings.school < 1) {
    return { ...state, notice: 'noSchool' }
  }
  const child = state.roster.find((hero) => hero.id === heroId)
  if (!child || !isChild(child) || child.condition === 'dead') {
    return { ...state, notice: 'missing' }
  }
  if (child.age < schoolRules.minAge) {
    return { ...state, notice: 'tooYoung' }
  }
  if (career && classById(career).femaleOnly && child.gender !== 'female') {
    return { ...state, notice: 'career' }
  }
  const already = child.school != null
  if (!already && pupils(state).length >= schoolSeats(state)) {
    return { ...state, notice: 'schoolFull' }
  }
  // Changing the plan keeps the seasons already studied; a new focus starts
  // its fraction afresh (review 62e7837).
  const carry = child.school && child.school.focus === (focus ?? undefined) ? child.school.carry : 0
  const school: Schooling = { seasons: child.school?.seasons ?? 0, carry, ...(focus ? { focus } : {}), ...(career ? { career } : {}) }
  return { ...state, notice: null, roster: state.roster.map((hero) => (hero.id === heroId ? { ...hero, school } : hero)) }
}

export function unenroll(state: GameState, heroId: string): GameState {
  return { ...state, notice: null, roster: state.roster.map((hero) => (hero.id === heroId && hero.school ? { ...hero, school: undefined } : hero)) }
}

// A season of lessons for every pupil whose tuition the village can pay.
export function teachSeason(state: GameState, only?: Set<string>): GameState {
  if (state.buildings.school < 1) {
    return state
  }
  const level = Math.min(schoolRules.potentialPerSeason.length, state.buildings.school) - 1
  const fee = tuition(state)
  let gold = state.gold
  const roster = state.roster.map((hero) => {
    if (!hero.school || gold < fee || (only && !only.has(hero.id))) {
      return hero
    }
    gold -= fee
    const school = { ...hero.school, seasons: hero.school.seasons + 1, carry: hero.school.carry }
    // Up to 100, never below what the child already has.
    const potential = Math.max(hero.potential, Math.min(100, hero.potential + schoolRules.potentialPerSeason[level]!))
    const potentials = { ...hero.potentials }
    if (school.focus) {
      school.carry += schoolRules.focusPerSeason[level]!
      const whole = Math.floor(school.carry)
      potentials[school.focus] += whole
      school.carry -= whole
    }
    return { ...createHero({ ...hero, potential, potentials }), school }
  })
  return { ...state, gold, roster }
}

// At the coming of age a pupil leaves school, taking up the chosen career
// after enough seasons of study.
export function graduate(hero: Hero): Hero {
  if (!hero.school) {
    return hero
  }
  const career = hero.school.career
  const switched = career && career !== hero.classId && hero.school.seasons >= schoolRules.careerSeasons
  // The gear stays: weapons and armour are not tied to a class (review 62e7837).
  const next = switched ? createHero({ ...hero, classId: career }) : hero
  return { ...next, school: undefined }
}
