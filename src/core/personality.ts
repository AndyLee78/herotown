import { familyRules, lifeRules, personalityRules } from './data'
import type { GameState } from './game'
import { hashString } from './genes'
import { isChild, personalityFor } from './hero'
import { shiftMorale } from './morale'
import { createRng } from './rng'
import type { Hero, PersonalityId } from './types'

// Personalities (Docs/personality.md): every hero has one. It sets how strongly
// they feel each emotion, who they get on with, how they fight beside others,
// and children usually take after a parent.
//
// The personality is drawn from the hero's id on its own random stream, so
// adding it changed no visitor, child or battle that was rolled before.

export type Emotion = 'grief' | 'joy' | 'pride' | 'anxiety' | 'resentment'

export const PERSONALITY_IDS = personalityRules.ids as PersonalityId[]

export { personalityFor }

export function personalityOf(hero: Pick<Hero, 'id' | 'personality'>): PersonalityId {
  return hero.personality ?? personalityFor(hero.id)
}

// A child takes after one parent most of the time.
export function inheritPersonality(id: string, mother: Hero, father: Hero): PersonalityId {
  const rng = createRng(hashString(`inherit:${id}`))
  if (rng.next() < personalityRules.inherit) {
    return rng.next() < 0.5 ? personalityOf(mother) : personalityOf(father)
  }
  return personalityFor(id)
}

export function emotionScale(hero: Hero, emotion: Emotion): number {
  return personalityRules.emotion[personalityOf(hero)][emotion]
}

// A morale change felt through the hero's personality.
export function feel(hero: Hero, emotion: Emotion, amount: number): Hero {
  return shiftMorale(hero, amount * emotionScale(hero, emotion))
}

function pair(a: PersonalityId, b: PersonalityId): { affinity: number; party: number } | null {
  return personalityRules.pairs.find((entry) => (entry.a === a && entry.b === b) || (entry.a === b && entry.b === a)) ?? null
}

// How fast two heroes grow close: each one's warmth, then how well they match.
export function affinityScale(a: Hero, b: Hero): number {
  const first = personalityOf(a)
  const second = personalityOf(b)
  const warmth = (personalityRules.bondGrowth[first] + personalityRules.bondGrowth[second]) / 2
  return warmth * (pair(first, second)?.affinity ?? 1)
}

// What fighting beside the rest of the party does for this hero.
export function partyFit(hero: Hero, others: Hero[]): number {
  return others.reduce((sum, other) => sum + (other.id === hero.id ? 0 : (pair(personalityOf(hero), personalityOf(other))?.party ?? 0)), 0)
}

// After a trip: a run of defeats breeds anxiety, a win clears it, and a
// family member brought home in a critical state worries their kin.
export function afterTrip(state: GameState, heroIds: string[], victory: boolean): GameState {
  const party = new Set(heroIds)
  const rules = personalityRules.anxiety
  const critical = state.roster.filter((hero) => party.has(hero.id) && hero.condition === 'critical')
  const roster = state.roster.map((hero) => {
    let next = hero
    if (party.has(hero.id)) {
      const losses = victory ? 0 : (hero.losses ?? 0) + 1
      next = { ...next, losses: losses > 0 ? losses : undefined }
      if (losses >= rules.lossStreak) {
        next = feel(next, 'anxiety', -rules.loss)
      }
      // Going out with the party ends the wait at home.
      next = { ...next, benched: undefined }
    }
    const kin = critical.some((other) => other.id !== hero.id && (hero.spouseId === other.id || other.spouseId === hero.id || hero.parents?.includes(other.id) || other.parents?.includes(hero.id)))
    return kin ? feel(next, 'anxiety', -rules.familyCritical) : next
  })
  return { ...state, roster }
}

// A party sets out by hand: fit heroes left at home while their friends go
// count it, and after a few such trips in a row they feel left out.
export function benchAtDeparture(state: GameState, heroIds: string[], busy: Set<string>): GameState {
  const going = new Set(heroIds)
  const rules = personalityRules.resentment
  const friendOf = (id: string) =>
    (state.bonds ?? []).some((bond) => bond.affinity >= familyRules.friendAt && ((bond.a === id && going.has(bond.b)) || (bond.b === id && going.has(bond.a))))
  const roster = state.roster.map((hero) => {
    if (going.has(hero.id) || busy.has(hero.id) || isChild(hero) || hero.condition !== 'healthy' || hero.fatigue >= lifeRules.fatigue.tiredAt || hero.expecting || !friendOf(hero.id)) {
      return hero
    }
    const benched = (hero.benched ?? 0) + 1
    if (benched >= rules.benchedTrips) {
      return { ...feel(hero, 'resentment', -rules.loss), benched: undefined }
    }
    return { ...hero, benched }
  })
  return { ...state, roster }
}
