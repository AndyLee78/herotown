import { moraleRules, personalityRules } from './data'
import type { Bond, Hero, PersonalityId } from './types'

// How strongly a hero feels an emotion (Docs/personality.md). Kept here, not in
// personality.ts, so morale has no import cycle.
function scale(hero: Hero, emotion: 'grief' | 'joy' | 'pride'): number {
  const id = hero.personality as PersonalityId | undefined
  return id ? personalityRules.emotion[id][emotion] : 1
}

// Morale and emotions (Docs/morale.md). Pure helpers over heroes; the game
// decides when they run.

export function moraleOf(hero: Hero): number {
  return hero.morale ?? moraleRules.base
}

export function shiftMorale(hero: Hero, amount: number): Hero {
  if (amount === 0 || hero.condition === 'dead') {
    return hero
  }
  return { ...hero, morale: Math.max(0, Math.min(100, moraleOf(hero) + amount)) }
}

// Morale drifts back toward its base as time passes.
export function driftMorale(hero: Hero, hours: number): Hero {
  const morale = moraleOf(hero)
  const gap = moraleRules.base - morale
  if (gap === 0 || hours <= 0) {
    return hero
  }
  const step = Math.min(Math.abs(gap), moraleRules.driftPerHour * hours)
  return { ...hero, morale: morale + Math.sign(gap) * step }
}

export function lowMorale(hero: Hero): boolean {
  return moraleOf(hero) <= moraleRules.low
}

// What morale does in battle: a small lift when high, a heavy weight when low.
export function moraleScale(hero: Hero): { attack: number; speed: number } {
  const morale = moraleOf(hero)
  if (morale >= moraleRules.high) {
    return { attack: 1 + moraleRules.highAttack, speed: 1 }
  }
  if (morale <= moraleRules.low) {
    return { attack: 1 - moraleRules.lowPenalty, speed: 1 - moraleRules.lowPenalty }
  }
  return { attack: 1, speed: 1 }
}

// Raises the named heroes' morale; a cap keeps everyday wins from carrying it past the high mark.
export function cheer(heroes: Hero[], ids: Iterable<string>, amount: number, cap = 100, emotion: 'joy' | 'pride' = 'joy'): Hero[] {
  const set = new Set(ids)
  if (!set.size) {
    return heroes
  }
  return heroes.map((hero) => {
    if (!set.has(hero.id)) {
      return hero
    }
    const raised = shiftMorale(hero, Math.max(0, Math.min(amount * scale(hero, emotion), cap - moraleOf(hero))))
    return raised
  })
}

type Departed = { id: string; spouseId?: string; parents?: [string, string] }

// Grief for someone who left for good: spouse, parents and children, then close friends.
export function griefFor(hero: Hero, departed: Departed, bonds: Bond[]): number {
  if (hero.id === departed.id) {
    return 0
  }
  if (hero.spouseId === departed.id || departed.spouseId === hero.id) {
    return moraleRules.grief.spouse
  }
  if (departed.parents?.includes(hero.id) || hero.parents?.includes(departed.id)) {
    return moraleRules.grief.parentChild
  }
  const [a, b] = hero.id < departed.id ? [hero.id, departed.id] : [departed.id, hero.id]
  const bond = bonds.find((entry) => entry.a === a && entry.b === b)
  return bond && bond.affinity >= moraleRules.grief.friendAffinity ? moraleRules.grief.friend : 0
}

export function mourn(heroes: Hero[], departed: Departed[], bonds: Bond[]): Hero[] {
  if (!departed.length) {
    return heroes
  }
  return heroes.map((hero) => {
    // The deepest loss counts; several at once do not stack past it.
    const loss = Math.max(0, ...departed.map((gone) => griefFor(hero, gone, bonds)))
    return loss > 0 ? shiftMorale(hero, -loss * scale(hero, 'grief')) : hero
  })
}
