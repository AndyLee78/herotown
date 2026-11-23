import { ageMultiplier, bandForAge, classById, classList, maxAge, names, progression, traits } from './data'
import { normalizeGear } from './gear'
import { isGenes, type Genes } from './genes'
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
  family?: string
  parents?: [string, string]
  spouseId?: string
  widowedAt?: number
  expecting?: { dueAt: number; child: Hero }
  genes?: Genes
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
    ...familyFields(draft),
  }
}

// Family fields are only written when set, so older heroes stay unchanged.
function familyFields(draft: HeroDraft): Partial<Hero> {
  const fields: Partial<Hero> = {}
  if (typeof draft.family === 'string') {
    fields.family = draft.family
  }
  if (Array.isArray(draft.parents) && draft.parents.length === 2) {
    fields.parents = [draft.parents[0], draft.parents[1]]
  }
  if (typeof draft.spouseId === 'string') {
    fields.spouseId = draft.spouseId
  }
  if (typeof draft.widowedAt === 'number') {
    fields.widowedAt = draft.widowedAt
  }
  if (draft.expecting && typeof draft.expecting.dueAt === 'number' && draft.expecting.child) {
    fields.expecting = { dueAt: draft.expecting.dueAt, child: createHero(draft.expecting.child) }
  }
  if (isGenes(draft.genes)) {
    fields.genes = { ...draft.genes }
  }
  return fields
}

export function normalizeHero(hero: Hero): Hero {
  return createHero(hero)
}

// Too young to fight: lists leave children out until they come of age.
export function isChild(hero: Hero): boolean {
  return !bandForAge(clampAge(hero.age)).canDeploy
}

export function canDeploy(hero: Hero | number): boolean {
  if (typeof hero === 'number') {
    return bandForAge(clampAge(hero)).canDeploy
  }
  return hero.condition !== 'dead' && hero.expecting == null && bandForAge(clampAge(hero.age)).canDeploy
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

// `forced` sets the class (the inn sending what the village lacks); the
// draws stay the same so other visitors from the seed are unchanged.
export function generateHero(rng: Rng, id: string, potentialBonus = 0, femaleChance = 0.5, forced?: ClassId): Hero {
  const drawn: Gender = rng.next() < 1 - femaleChance ? 'male' : 'female'
  const gender: Gender = forced && classById(forced).femaleOnly ? 'female' : drawn
  const pool = classList.filter((klass) => gender === 'female' || !klass.femaleOnly)
  const picked = rng.pick(pool).id
  const classId = forced ?? picked
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

export function generateVisitors(
  seed: number,
  count = progression.visitorCount,
  potentialBonus = 0,
  femaleChance = 0.5,
  forced: ClassId[] = [],
): Hero[] {
  const rng = createRng(seed)
  return Array.from({ length: count }, (_, index) => generateHero(rng, `${seed}-${index}`, potentialBonus, femaleChance, forced[index]))
}

function clampAge(age: number): number {
  return Math.max(0, Math.min(maxAge, Math.round(age)))
}

function clampTraining(training: number): number {
  return Math.max(0, Math.min(progression.maxTraining, Math.round(training)))
}
