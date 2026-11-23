import guideFile from '../data/guide.json'
import { dungeons, villageRules } from './data'
import type { BuildingId, GameState, MaterialName } from './game'

// The first-play guide: a short chain of goals that walks a new player
// through hiring, the first expedition, building and auto runs. Each goal
// pays a small reward when the player claims it.

export type GuideGoal =
  | { type: 'roster'; target: number }
  | { type: 'cleared'; dungeon: string }
  | { type: 'build' }
  | { type: 'auto' }
  | { type: 'building'; building: BuildingId; target: number }

export type GuideReward = Partial<Record<'gold' | MaterialName, number>>

export type GuideStep = {
  id: string
  goal: GuideGoal
  screen: 'inn' | 'battle' | 'town'
  reward: GuideReward
}

export type GuideStatus = {
  index: number
  total: number
  step: GuideStep | null
  current: number
  target: number
  done: boolean
}

export const guideSteps = guideFile.steps as GuideStep[]

const REWARD_KEYS = new Set(['gold', 'wood', 'stone', 'iron', 'bone'])
const BUILDING_IDS = new Set(villageRules.buildings.map((building) => building.id))
const DUNGEON_IDS = new Set(dungeons.map((dungeon) => dungeon.id))
for (const step of guideSteps) {
  for (const [key, amount] of Object.entries(step.reward)) {
    if (!REWARD_KEYS.has(key) || !Number.isInteger(amount) || (amount ?? 0) <= 0) {
      throw new Error(`Guide step ${step.id} has a bad reward ${key}`)
    }
  }
  if (step.goal.type === 'cleared' && !DUNGEON_IDS.has(step.goal.dungeon)) {
    throw new Error(`Guide step ${step.id} names a missing dungeon`)
  }
  if (step.goal.type === 'building' && !BUILDING_IDS.has(step.goal.building)) {
    throw new Error(`Guide step ${step.id} names a missing building`)
  }
}

function progress(state: GameState, goal: GuideGoal): { current: number; target: number } {
  switch (goal.type) {
    case 'roster':
      return { current: Math.min(state.roster.length, goal.target), target: goal.target }
    case 'cleared':
      return { current: state.cleared.includes(goal.dungeon) ? 1 : 0, target: 1 }
    case 'build': {
      // Any construction counts: one under way, or any building above where it started.
      const built = state.construction != null || villageRules.buildings.some((building) => state.buildings[building.id as BuildingId] > building.startLevel)
      return { current: built ? 1 : 0, target: 1 }
    }
    case 'auto':
      return { current: state.auto.enabled ? 1 : 0, target: 1 }
    case 'building':
      return { current: Math.min(state.buildings[goal.building], goal.target), target: goal.target }
  }
}

export function guideStatus(state: GameState): GuideStatus {
  const index = Math.max(0, Math.min(state.guideStep, guideSteps.length))
  const step = guideSteps[index] ?? null
  if (!step) {
    return { index, total: guideSteps.length, step: null, current: 0, target: 0, done: false }
  }
  const { current, target } = progress(state, step.goal)
  return { index, total: guideSteps.length, step, current, target, done: current >= target }
}

// Pays the current step's reward and moves to the next one. Does nothing
// if the goal is not met yet.
export function claimGuide(state: GameState): GameState {
  const status = guideStatus(state)
  if (!status.step || !status.done) {
    return state
  }
  const reward = status.step.reward
  return {
    ...state,
    notice: null,
    guideStep: status.index + 1,
    gold: state.gold + (reward.gold ?? 0),
    materials: {
      wood: state.materials.wood + (reward.wood ?? 0),
      stone: state.materials.stone + (reward.stone ?? 0),
      iron: state.materials.iron + (reward.iron ?? 0),
      bone: state.materials.bone + (reward.bone ?? 0),
    },
  }
}
