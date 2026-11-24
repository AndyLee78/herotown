import { progression, retirementRules, trainingRules } from './data'
import { gainXp } from './dungeon'
import type { GameState } from './game'
import { canDeploy, isChild } from './hero'
import { starterSkill } from './skills'
import type { Hero } from './types'

// The training ground (Docs/skills.md): heroes behind the party catch up,
// and learned skills can be swapped.

export type Drill = { heroId: string; finishAt: number; xp: number }

// The level the village fights at: the average of its five best heroes.
export function partyLevel(state: GameState): number {
  const levels = state.roster.filter((hero) => !isChild(hero) && hero.condition !== 'dead').map((hero) => hero.level).sort((a, b) => b - a).slice(0, 5)
  return levels.length ? levels.reduce((sum, level) => sum + level, 0) / levels.length : 1
}

export function drillXp(state: GameState, hero: Hero): number {
  const gap = partyLevel(state) - hero.level
  const share = trainingRules.shares.find((entry) => gap >= entry.gap)?.share ?? 0
  return Math.round(hero.level * progression.xpPerLevel * share)
}

export function drillGold(hero: Hero): number {
  return trainingRules.goldBase + trainingRules.goldPerLevel * hero.level
}

export function drillTime(state: GameState): number {
  const level = Math.max(1, Math.min(trainingRules.sessionMs.length, state.buildings.training))
  const kept = (state.retirees ?? []).some((retiree) => retiree.building === 'training')
  return Math.round((trainingRules.sessionMs[level - 1] ?? 0) * (1 - (kept ? retirementRules.bonus.training : 0)))
}

export function startDrill(state: GameState, heroId: string, now: number, busy: Set<string>): GameState {
  if (state.buildings.training < 1) {
    return { ...state, notice: 'noTraining' }
  }
  const hero = state.roster.find((entry) => entry.id === heroId)
  if (!hero || isChild(hero) || !canDeploy(hero) || hero.condition === 'injured' || hero.condition === 'critical') {
    return { ...state, notice: 'drillHero' }
  }
  if (busy.has(heroId)) {
    return { ...state, notice: 'busyHero' }
  }
  if (state.drills.length >= state.buildings.training) {
    return { ...state, notice: 'trainingFull' }
  }
  const gold = drillGold(hero)
  if (state.gold < gold) {
    return { ...state, notice: 'resources' }
  }
  return { ...state, notice: null, gold: state.gold - gold, drills: [...state.drills, { heroId, finishAt: now + drillTime(state), xp: drillXp(state, hero) }] }
}

export function finishDrills(state: GameState, until: number): GameState {
  const done = state.drills.filter((drill) => drill.finishAt <= until)
  if (!done.length) {
    return state
  }
  const gains = new Map(done.map((drill) => [drill.heroId, drill.xp]))
  return {
    ...state,
    drills: state.drills.filter((drill) => drill.finishAt > until),
    roster: state.roster.map((hero) => (gains.has(hero.id) && hero.condition !== 'dead' ? gainXp(hero, gains.get(hero.id)!) : hero)),
  }
}

// Forgetting a learned skill gives its point back (Docs/skills.md).
export function forgetSkill(state: GameState, heroId: string, skillId: string): GameState {
  if (state.buildings.training < 1) {
    return { ...state, notice: 'noTraining' }
  }
  const hero = state.roster.find((entry) => entry.id === heroId)
  if (!hero || skillId === starterSkill(hero.classId) || !hero.learned.includes(skillId)) {
    return { ...state, notice: 'skill' }
  }
  if (state.gold < trainingRules.forgetGold) {
    return { ...state, notice: 'resources' }
  }
  return {
    ...state,
    notice: null,
    gold: state.gold - trainingRules.forgetGold,
    roster: state.roster.map((entry) =>
      entry.id === heroId ? { ...entry, learned: entry.learned.filter((id) => id !== skillId), skillPoints: entry.skillPoints + 1 } : entry,
    ),
  }
}

export function readDrills(value: unknown): Drill[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value.flatMap((entry) => {
    const drill = entry as Drill
    return entry != null && typeof drill.heroId === 'string' && typeof drill.finishAt === 'number' && typeof drill.xp === 'number' ? [{ heroId: drill.heroId, finishAt: drill.finishAt, xp: drill.xp }] : []
  })
}
