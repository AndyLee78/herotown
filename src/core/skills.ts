import { classById, giftRules, personalityRules, trainingRules } from './data'
import type { ClassId, GiftId, Hero, PersonalityId, SkillDef, SkillEffect } from './types'

// Learned skills (Docs/skills.md, Docs/identity.md 5a): the first skill of a
// class is innate; the other nine sit in three branches of three, learned in
// order, one pick at each level in trainingRules.pickLevels.

export function starterSkill(classId: ClassId): string {
  return classById(classId).skills[0]?.id ?? ''
}

export function skillPicks(level: number): number {
  return trainingRules.pickLevels.filter((at) => level >= at).length
}

export function maxExtraSkills(): number {
  return trainingRules.pickLevels.length
}

function skillDef(classId: ClassId, id: string): SkillDef | undefined {
  return classById(classId).skills.find((skill) => skill.id === id)
}

// The step before this one in its branch, or null for a branch's first step.
export function skillPrerequisite(classId: ClassId, id: string): string | null {
  const skill = skillDef(classId, id)
  if (!skill || skill.branch == null || (skill.tier ?? 1) <= 1) {
    return null
  }
  return classById(classId).skills.find((entry) => entry.branch === skill.branch && entry.tier === (skill.tier ?? 1) - 1)?.id ?? null
}

// Whether a hero may learn this skill now, points aside.
export function canLearn(hero: Hero, id: string): boolean {
  const skill = skillDef(hero.classId, id)
  if (!skill || skill.branch == null || hero.learned.includes(id)) {
    return false
  }
  const before = skillPrerequisite(hero.classId, id)
  return before == null || hero.learned.includes(before)
}

// Only the last learned step of a branch can be forgotten.
export function canForget(hero: Hero, id: string): boolean {
  if (id === starterSkill(hero.classId) || !hero.learned.includes(id)) {
    return false
  }
  return !hero.learned.some((other) => skillPrerequisite(hero.classId, other) === id)
}

// Keeps the innate skill and the first valid picks, in the order learned; a
// step whose earlier step is missing is dropped.
export function normalizeLearned(classId: ClassId, learned: string[] | undefined, level: number): { learned: string[]; skillPoints: number } {
  const skills = classById(classId).skills.map((skill) => skill.id)
  const starter = starterSkill(classId)
  const extras: string[] = []
  // No more picks than the level has earned; old saves (picks at Lv3 and 7)
  // never had more than that (review 318455b).
  const cap = Math.min(maxExtraSkills(), skillPicks(level))
  for (const id of learned ?? []) {
    if (id === starter || !skills.includes(id) || extras.includes(id) || extras.length >= cap) {
      continue
    }
    const before = skillPrerequisite(classId, id)
    if (before == null || extras.includes(before)) {
      extras.push(id)
    }
  }
  return { learned: [starter, ...extras], skillPoints: Math.max(0, skillPicks(level) - extras.length) }
}

// Branches whose three steps are all learned.
export function masteries(hero: Hero): string[] {
  const klass = classById(hero.classId)
  return klass.branches.filter((_, index) => klass.skills.filter((skill) => skill.branch === index).every((skill) => hero.learned.includes(skill.id))).map((branch) => branch.id)
}

// Branches that suit the hero's personality get stronger (Docs/identity.md 5a).
export function suitedBranches(personality: PersonalityId | undefined): string[] {
  return personality ? personalityRules.affinity[personality] ?? [] : []
}

const NUMBER_KEYS = [
  'attack', 'guard', 'speed', 'heal', 'threat', 'bleed', 'weaken', 'regen', 'partyGuard', 'partyAttack',
  'hp', 'crit', 'critDamage', 'pierce', 'lifesteal', 'execute', 'bossDamage', 'counter', 'dodge', 'stun', 'slow', 'burn',
  'shield', 'firstStrike', 'lastStand', 'revive', 'partySpeed', 'partyCrit', 'enemyMiss', 'holy', 'partyHoly', 'aoePower',
  'weakenPower', 'burnPower', 'partyFirstStrike', 'fatigueCut', 'selfFatigueCut', 'healTaken', 'dotGuard', 'twinStrike', 'lucky', 'trapGuard',
] as const
const FLAG_KEYS = ['cleanse', 'steadfast', 'alert', 'farsight', 'undying', 'vanguard', 'guardian'] as const

type NumberKey = (typeof NUMBER_KEYS)[number]
type FlagKey = (typeof FLAG_KEYS)[number]
export type SkillTotals = Record<NumberKey, number> & Record<FlagKey, boolean> & { volleyEvery: number }

// Who the hero sets out with, for skills with a condition.
export type SkillContext = { allies?: ClassId[]; bonded?: boolean }

function emptyTotals(): SkillTotals {
  const totals = { volleyEvery: 0 } as SkillTotals
  for (const key of NUMBER_KEYS) {
    totals[key] = 0
  }
  for (const key of FLAG_KEYS) {
    totals[key] = false
  }
  return totals
}

function addEffect(totals: SkillTotals, effect: SkillEffect | undefined, scale = 1) {
  if (!effect) {
    return
  }
  for (const key of NUMBER_KEYS) {
    const value = effect[key]
    if (value) {
      // Threat and flat damage keep whole numbers.
      totals[key] += key === 'threat' || key === 'bleed' || key === 'burn' ? Math.round(value * scale) : value * scale
    }
  }
  // The shortest volley wins.
  if (effect.volleyEvery) {
    totals.volleyEvery = totals.volleyEvery ? Math.min(totals.volleyEvery, effect.volleyEvery) : effect.volleyEvery
  }
  for (const key of FLAG_KEYS) {
    if (effect[key]) {
      totals[key] = true
    }
  }
}

function holds(when: NonNullable<SkillDef['when']>, hero: Hero, context: SkillContext): boolean {
  const morale = hero.morale ?? 50
  return (
    (when.personality == null || when.personality === hero.personality) &&
    (when.moraleAbove == null || morale >= when.moraleAbove) &&
    (when.moraleBelow == null || morale < when.moraleBelow) &&
    (when.withClass == null || (context.allies ?? []).includes(when.withClass)) &&
    (when.bonded == null || when.bonded === (context.bonded ?? false))
  )
}

export function giftEffect(gift: GiftId | undefined): SkillEffect | undefined {
  return gift ? giftRules.gifts.find((entry) => entry.id === gift)?.effect : undefined
}

export function heroSkillEffects(hero: Hero, context: SkillContext = {}): SkillTotals {
  const totals = emptyTotals()
  const klass = classById(hero.classId)
  const suited = new Set(suitedBranches(hero.personality))
  const mastered = new Set(masteries(hero))
  const scaleFor = (branch: number | undefined) => (branch != null && suited.has(klass.branches[branch]?.id ?? '') ? personalityRules.affinityScale : 1)
  for (const skill of klass.skills) {
    if (!hero.learned.includes(skill.id)) {
      continue
    }
    const scale = scaleFor(skill.branch)
    addEffect(totals, skill.effect, scale)
    if (skill.when && holds(skill.when, hero, context)) {
      addEffect(totals, skill.when.bonus, scale)
    }
  }
  klass.branches.forEach((branch, index) => {
    if (mastered.has(branch.id)) {
      addEffect(totals, branch.mastery, scaleFor(index))
    }
  })
  addEffect(totals, giftEffect(hero.gift))
  return totals
}
