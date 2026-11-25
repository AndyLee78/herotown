import { statueXp } from './monuments'
import { automationRules, progression, retirementRules, trainingRules } from './data'
import { gainXp } from './dungeon'
import type { GameState } from './game'
import { canDeploy, isChild } from './hero'
import { normalizeLearned, starterSkill } from './skills'
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

// Auto training (Docs/automation.md): drills finish one by one in time
// order, and each freed slot goes to the hero furthest behind.
export function runDrills(state: GameState, from: number, until: number, busy: (state: GameState) => Set<string>, reservedFor: (state: GameState) => Set<string>): GameState {
  if (!state.automation?.drill) {
    return finishDrills(state, until)
  }
  let next = fillDrills(finishDrills(state, from), from, busy, reservedFor)
  for (let guard = 0; guard < 200; guard += 1) {
    const due = next.drills.filter((drill) => drill.finishAt <= until).sort((a, b) => a.finishAt - b.finishAt)[0]
    if (!due) {
      break
    }
    next = finishDrills(next, due.finishAt)
    next = fillDrills(next, due.finishAt, busy, reservedFor)
  }
  return next
}

function fillDrills(state: GameState, at: number, busy: (state: GameState) => Set<string>, reservedFor: (state: GameState) => Set<string>): GameState {
  let next = state
  const target = partyLevel(state)
  // Heroes in the selected party and in the parties auto runs use stay free to go out.
  const reserved = reservedFor(state)
  while (next.drills.length < next.buildings.training) {
    const away = busy(next)
    const pick = next.roster
      .filter((hero) => !reserved.has(hero.id) && !away.has(hero.id) && !isChild(hero) && canDeploy(hero) && hero.condition !== 'injured' && hero.condition !== 'critical')
      .filter((hero) => target - hero.level >= automationRules.drillGap && next.gold >= drillGold(hero))
      .sort((a, b) => a.level - b.level || a.id.localeCompare(b.id))[0]
    if (!pick) {
      break
    }
    const started = startDrill(next, pick.id, at, away)
    if (started.notice) {
      break
    }
    next = started
  }
  return next
}

export function finishDrills(state: GameState, until: number): GameState {
  // A hero who left the roster (old age, dismissal) frees the slot at once (review 8e25753).
  const present = new Set(state.roster.filter((hero) => hero.condition !== 'dead').map((hero) => hero.id))
  const kept = state.drills.filter((drill) => present.has(drill.heroId))
  if (kept.length !== state.drills.length) {
    state = { ...state, drills: kept }
  }
  const done = state.drills.filter((drill) => drill.finishAt <= until)
  if (!done.length) {
    return state
  }
  const gains = new Map(done.map((drill) => [drill.heroId, drill.xp]))
  return {
    ...state,
    drills: state.drills.filter((drill) => drill.finishAt > until),
    roster: state.roster.map((hero) => (gains.has(hero.id) && hero.condition !== 'dead' ? gainXp(hero, Math.round(gains.get(hero.id)! * (1 + statueXp(state)))) : hero)),
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
      // The points follow the level, so a pick kept from an older save below
      // Lv3 does not turn into a free early pick (review 8e25753).
      entry.id === heroId ? { ...entry, ...normalizeLearned(entry.classId, entry.learned.filter((id) => id !== skillId), entry.level) } : entry,
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
