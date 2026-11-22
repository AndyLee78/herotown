import { ageMultiplier, bandForAge, classById, classList, maxAge, names, progression, traits } from './data'
import { normalizeGear } from './gear'
import { createRng, type Rng } from './rng'
import {
  STAT_KEYS,
  type ClassId,
  type Condition,
  type Gear,
  type Gender,
  type Hero,
  type Stats,
  type TraitId,
} from './types'

export type HeroDraft = {
  id: string
  name: string
  gender: Gender
  classId: ClassId
  age: number
  training?: number
  potentials: Stats
  potential?: number
  traitIds?: TraitId[]
  level?: number
  xp?: number
  fatigue?: number
  condition?: Condition
  skillPoints?: number
  learned?: string[]
  gear?: Array<Partial<Gear>>
  clears?: string[]
  deaths?: number
  arrivedAt?: number
  resurrectAt?: number
  treatAt?: number
  recoverAt?: number
}

export function deriveStats(age: number, training: number, potentials: Stats): Stats {
  const bonus = training * progression.trainingBonus
  const stats = {} as Stats
  for (const key of STAT_KEYS) {
    stats[key] = Math.max(1, Math.round(potentials[key] * ageMultiplier(age, key) + bonus))
  }
  return stats
}

export function createHero(draft: HeroDraft): Hero {
  const age = clampAge(draft.age)
  const training = clampTraining(draft.training ?? 0)
  const potentials = { ...draft.potentials }
  const firstSkill = classById(draft.classId).skills[0]?.id ?? ''
  return {
    id: draft.id,
    name: draft.name,
    gender: draft.gender,
    classId: draft.classId,
    age,
    training,
    potentials,
    stats: deriveStats(age, training, potentials),
    potential: draft.potential ?? 50,
    traitIds: [...(draft.traitIds ?? [])],
    level: draft.level ?? 1,
    xp: draft.xp ?? 0,
    skillPoints: draft.skillPoints ?? 0,
    learned: [...(draft.learned ?? [firstSkill])],
    gear: draft.gear ? draft.gear.map((item) => normalizeGear(item, draft.classId)) : [normalizeGear(undefined, draft.classId)],
    clears: [...(draft.clears ?? [])],
    deaths: draft.deaths ?? 0,
    fatigue: draft.fatigue ?? 0,
    condition: draft.condition ?? 'healthy',
    arrivedAt: draft.arrivedAt,
    resurrectAt: draft.resurrectAt,
    treatAt: draft.treatAt,
    recoverAt: draft.recoverAt,
  }
}

export function normalizeHero(hero: Hero): Hero {
  return createHero(hero)
}

export function canDeploy(hero: Hero | number): boolean {
  if (typeof hero === 'number') {
    return bandForAge(clampAge(hero)).canDeploy
  }
  return hero.condition !== 'dead' && bandForAge(clampAge(hero.age)).canDeploy
}

export function withAge(hero: Hero, age: number): Hero {
  return createHero({ ...hero, age })
}

export function ageUp(hero: Hero): Hero {
  return withAge(hero, hero.age + 1)
}

export function train(hero: Hero): Hero {
  return createHero({ ...hero, training: hero.training + 1 })
}

export function statRange(value: number): { min: number; max: number } {
  const spread = Math.max(2, Math.round(value * 0.25))
  return { min: Math.max(1, value - spread), max: value + spread }
}

export function potentialBand(potential: number): 'low' | 'mid' | 'high' {
  if (potential < 45) {
    return 'low'
  }
  if (potential < 70) {
    return 'mid'
  }
  return 'high'
}

export function hireCost(): number {
  return progression.hireCost
}

export function grantXp(hero: Hero, amount: number): Hero {
  let xp = hero.xp + amount
  let level = hero.level
  while (xp >= level * progression.xpPerLevel) {
    xp -= level * progression.xpPerLevel
    level += 1
  }
  return { ...hero, xp, level }
}

export function restHero(hero: Hero, bonus = 0): Hero {
  if (hero.condition === 'dead') {
    return hero
  }
  const fatigue = Math.max(0, hero.fatigue - progression.restFatigue - bonus)
  if (hero.condition === 'fatigued' && fatigue === 0) {
    return { ...hero, fatigue, condition: 'healthy' }
  }
  return { ...hero, fatigue }
}

export function generateHero(rng: Rng, id: string, potentialBonus = 0): Hero {
  const gender: Gender = rng.next() < 0.5 ? 'male' : 'female'
  const pool = classList.filter((klass) => gender === 'female' || !klass.femaleOnly)
  const classId = rng.pick(pool).id
  const classDef = classById(classId)
  const span = progression.visitorAgeMax - progression.visitorAgeMin
  const age = progression.visitorAgeMin + rng.int(span)
  const potential = 30 + potentialBonus + rng.int(60)
  const scale = 0.75 + potential / 200
  const potentials = {} as Stats
  for (const key of STAT_KEYS) {
    potentials[key] = Math.max(1, Math.round(classDef.potentialBias[key] * scale) + rng.int(progression.potentialSpread))
  }
  const traitIds = [rng.pick(traits).id]
  return createHero({
    id,
    name: rng.pick(names[gender]),
    gender,
    classId,
    age,
    potentials,
    potential,
    traitIds,
  })
}

export function generateVisitors(seed: number, count = progression.visitorCount, potentialBonus = 0): Hero[] {
  const rng = createRng(seed)
  return Array.from({ length: count }, (_, index) => generateHero(rng, `${seed}-${index}`, potentialBonus))
}

function clampAge(age: number): number {
  return Math.max(0, Math.min(maxAge, Math.round(age)))
}

function clampTraining(training: number): number {
  return Math.max(0, Math.min(progression.maxTraining, Math.round(training)))
}
