import { classById, trainingRules } from './data'
import type { ClassId, Hero, SkillEffect } from './types'

// Learned skills (Docs/skills.md): the first skill of a class is innate;
// a hero picks two of the other three, at the levels in trainingRules.

export function starterSkill(classId: ClassId): string {
  return classById(classId).skills[0]?.id ?? ''
}

export function skillPicks(level: number): number {
  return trainingRules.pickLevels.filter((at) => level >= at).length
}

export function maxExtraSkills(): number {
  return trainingRules.pickLevels.length
}

// Keeps the innate skill and the first valid picks, in the order learned.
export function normalizeLearned(classId: ClassId, learned: string[] | undefined, level: number): { learned: string[]; skillPoints: number } {
  const skills = classById(classId).skills.map((skill) => skill.id)
  const starter = starterSkill(classId)
  const extras: string[] = []
  for (const id of learned ?? []) {
    if (id !== starter && skills.includes(id) && !extras.includes(id) && extras.length < maxExtraSkills()) {
      extras.push(id)
    }
  }
  return { learned: [starter, ...extras], skillPoints: Math.max(0, skillPicks(level) - extras.length) }
}

export type SkillTotals = Required<Pick<SkillEffect, 'attack' | 'guard' | 'speed' | 'heal' | 'threat' | 'bleed' | 'weaken' | 'regen' | 'partyGuard' | 'partyAttack'>> & {
  volleyEvery: number
  cleanse: boolean
}

export function heroSkillEffects(hero: Hero): SkillTotals {
  const totals: SkillTotals = { attack: 0, guard: 0, speed: 0, heal: 0, threat: 0, bleed: 0, weaken: 0, regen: 0, partyGuard: 0, partyAttack: 0, volleyEvery: 0, cleanse: false }
  for (const skill of classById(hero.classId).skills) {
    const effect = skill.effect
    if (!effect || !hero.learned.includes(skill.id)) {
      continue
    }
    for (const key of ['attack', 'guard', 'speed', 'heal', 'threat', 'bleed', 'weaken', 'regen', 'partyGuard', 'partyAttack'] as const) {
      totals[key] += effect[key] ?? 0
    }
    if (effect.volleyEvery) {
      totals.volleyEvery = effect.volleyEvery
    }
    if (effect.cleanse) {
      totals.cleanse = true
    }
  }
  return totals
}
