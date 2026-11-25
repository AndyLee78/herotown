import { endgameRules, villageRules } from './data'
import type { GameState } from './game'
import { townLevelOf } from './game'
import { freshVault, type VaultKey } from './trials'

// Prosperity (Docs/endgame.md 4d): past town level 10 the town keeps rising
// in ranks. Each rank needs more fame and an offering that grows with it, and
// adds a little to the gold and fame every trip and raid brings home.

const top = () => villageRules.levels[villageRules.levels.length - 1]!

export function prosperityRank(state: GameState): number {
  return state.prosperity ?? 0
}

// Fame the next rank needs.
export function nextRankFame(state: GameState): number {
  return top().fame + endgameRules.prosperity.fameStep * (prosperityRank(state) + 1)
}

export function rankOffering(rank: number): Partial<Record<VaultKey, number>> {
  const per = endgameRules.prosperity.offeringPerRank as Partial<Record<VaultKey, number>>
  return Object.fromEntries(Object.entries(per).map(([key, amount]) => [key, (amount ?? 0) * rank]))
}

// The share prosperity adds to gold and fame brought home.
export function prosperityBonus(state: GameState): number {
  return prosperityRank(state) * endgameRules.prosperity.bonusPerRank
}

export function prosper(state: GameState): GameState {
  if (townLevelOf(state).level < top().level) {
    return { ...state, notice: 'locked' }
  }
  const rank = prosperityRank(state) + 1
  if (rank > endgameRules.prosperity.maxRank) {
    return { ...state, notice: 'promoteMax' }
  }
  if (state.fame < nextRankFame(state)) {
    return { ...state, notice: 'promoteFame' }
  }
  const offering = rankOffering(rank)
  const vault = { ...(state.vault ?? freshVault()) }
  if ((Object.keys(vault) as VaultKey[]).some((key) => vault[key] < (offering[key] ?? 0))) {
    return { ...state, notice: 'promoteOffering' }
  }
  for (const key of Object.keys(vault) as VaultKey[]) {
    vault[key] -= offering[key] ?? 0
  }
  return { ...state, notice: null, vault, prosperity: rank }
}
