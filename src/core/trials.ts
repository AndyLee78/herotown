import { dungeonById, endgameRules } from './data'
import type { GameState } from './game'
import { localDateKey, townLevelOf } from './game'
import { hashString } from './genes'
import { createRng } from './rng'
import type { DungeonFloor, Essence } from './types'

// Late-game rewards (Docs/endgame.md 4a): weekday trials give essences, the
// endless abyss gives abyss shards. Both go into the vault, which later stages
// add raid spoils, valour and event tokens to.

// Raid spoils (dragon scale, lich crown, titan core) and valour from invasions came with 4c.
export type VaultKey = Essence | 'abyss' | 'scale' | 'crown' | 'core' | 'valor' | 'token'
export type Vault = Record<VaultKey, number>
export type Trials = { date: string; used: number }
export type Abyss = { best: number; checkpoint: number }

export const ESSENCES: Essence[] = ['flame', 'frost', 'light']

export function freshVault(): Vault {
  return { flame: 0, frost: 0, light: 0, abyss: 0, scale: 0, crown: 0, core: 0, valor: 0, token: 0 }
}

// Which essence today's trial gives; on Sundays the player picks.
export function todayElement(now: number): Essence | 'choice' {
  return endgameRules.weekday.schedule[new Date(now).getDay()] as Essence | 'choice'
}

export function trialsLeft(state: GameState, now: number): number {
  const today = localDateKey(now)
  // Setting the clock back to an earlier day does not refill it (review b80777c).
  if (state.trials && today < state.trials.date) {
    return 0
  }
  const used = state.trials && state.trials.date === today ? state.trials.used : 0
  return Math.max(0, endgameRules.weekday.attemptsPerDay - used)
}

// Why a special dungeon cannot be entered now, or null when it can.
export function specialBlock(state: GameState, dungeonId: string, now: number): 'lockedDungeon' | 'trialDay' | 'trialsUsed' | null {
  const dungeon = dungeonById(dungeonId)
  if (dungeon.special === 'weekday') {
    if (townLevelOf(state).level < endgameRules.weekday.unlockTown) {
      return 'lockedDungeon'
    }
    const today = todayElement(now)
    if (today !== 'choice' && today !== dungeon.element) {
      return 'trialDay'
    }
    return trialsLeft(state, now) < 1 ? 'trialsUsed' : null
  }
  if (dungeon.special === 'endless') {
    return townLevelOf(state).level < endgameRules.abyss.unlockTown ? 'lockedDungeon' : null
  }
  return null
}

// A weekday trial spends one of today's attempts as the party sets out.
export function spendTrial(state: GameState, now: number): GameState {
  const date = localDateKey(now)
  const used = state.trials && state.trials.date === date ? state.trials.used + 1 : 1
  return { ...state, trials: { date, used } }
}

// The abyss floors below the checkpoint: the same floor always has the same
// monsters, a boss every fifth floor, and each floor a little stronger.
export function abyssFloors(from: number): DungeonFloor[] {
  const rules = endgameRules.abyss
  return Array.from({ length: rules.floorsPerRun }, (_, index) => {
    const floor = from + index + 1
    const rng = createRng(hashString(`abyss:${floor}`))
    const band = [...rules.bands].reverse().find((entry) => floor >= entry.from) ?? rules.bands[0]!
    const count = 2 + (floor % 3 === 0 ? 1 : 0)
    const monsters = Array.from({ length: count }, () => rng.pick(band.monsters))
    if (floor % 5 === 0) {
      monsters[0] = rules.bosses[Math.floor(floor / 5 - 1) % rules.bosses.length]!
    }
    // Each floor is a share stronger than the one above: the abyss always has a bottom for a party.
    return { monsters, scale: rules.baseScale * Math.pow(rules.scaleGrowth, floor - 1) }
  })
}

export function abyssShards(floor: number, best: number): number {
  const rules = endgameRules.abyss
  return floor > best ? rules.shardsFirst + Math.floor(floor / 5) * rules.shardsPerFive : rules.shardsRepeat
}

// Rewards when a trial or an abyss run comes home.
export function settleSpecial(state: GameState, dungeonId: string, floorsCleared: number, victory: boolean, abyssFrom?: number): GameState {
  const dungeon = dungeonById(dungeonId)
  const vault = { ...(state.vault ?? freshVault()) }
  if (dungeon.special === 'weekday') {
    if (!victory || !dungeon.element) {
      return state
    }
    vault[dungeon.element] += endgameRules.weekday.essence[(dungeon.difficulty ?? 1) - 1] ?? 0
    return { ...state, vault }
  }
  if (dungeon.special !== 'endless') {
    return state
  }
  const abyss = state.abyss ?? { best: 0, checkpoint: 0 }
  const from = abyssFrom ?? abyss.checkpoint
  let fame = state.fame
  for (let floor = from + 1; floor <= from + floorsCleared; floor += 1) {
    vault.abyss += abyssShards(floor, abyss.best)
    if (floor > abyss.best && floor % endgameRules.abyss.fameEvery === 0) {
      fame += endgameRules.abyss.fame
    }
  }
  const reached = from + floorsCleared
  const checkpoint = floorsCleared >= endgameRules.abyss.floorsPerRun ? Math.max(abyss.checkpoint, reached) : abyss.checkpoint
  return { ...state, vault, fame, abyss: { best: Math.max(abyss.best, reached), checkpoint } }
}
