import { endgameRules } from './data'
import type { DungeonVariant } from './dungeon'
import type { GameState } from './game'
import { localDateKey } from './game'
import { freshVault, type VaultKey } from './trials'
import { archBonus } from './monuments'
import { prosperityBonus } from './prosperity'

// The share the arch and prosperity add to gold and fame brought home (Docs/endgame.md 4d).
export function rewardBonus(state: GameState): number {
  return archBonus(state) + prosperityBonus(state)
}

// The weekly raid (Docs/endgame.md 4c): one great boss a week with a deep
// pool of health. Every party sent wears it down and the damage stays; the
// party that brings it down wins the spoils. A new boss comes each Monday.

export type RaidBoss = (typeof endgameRules.raid.bosses)[number]
// `tier` 1-3: after the boss falls it can be fought again, harder, the same week (Docs/endgame.md 4d).
export type Raid = { week: string; bossId: string; hp: number | null; max: number | null; killed: boolean; tier: number }

const DAY = 86_400_000

// The Monday that starts this week, as a local date key.
export function raidWeek(now: number): string {
  const date = new Date(now)
  const back = (date.getDay() + 6) % 7
  return localDateKey(new Date(date.getFullYear(), date.getMonth(), date.getDate() - back, 12).getTime())
}

export function raidBoss(week: string): RaidBoss {
  const [year, month, day] = week.split('-').map(Number)
  const weeks = Math.floor(new Date(year!, month! - 1, day!, 12).getTime() / (7 * DAY))
  const bosses = endgameRules.raid.bosses
  return bosses[((weeks % bosses.length) + bosses.length) % bosses.length]!
}

// This week's raid, fresh if the week has turned.
export function currentRaid(state: GameState, now: number): Raid {
  const week = raidWeek(now)
  if (state.raid && state.raid.week === week) {
    return state.raid
  }
  return { week, bossId: raidBoss(week).id, hp: null, max: null, killed: false, tier: 1 }
}

// Each boss brought down makes the next week's stronger, so the raid keeps
// pace with a growing party (Docs/endgame.md 4c).
export function raidGrowth(state: GameState): number {
  return 1 + endgameRules.raid.growthPerKill * (state.raidKills ?? 0)
}

// Minions first, then the boss with a guard, at this week's strength.
export function raidVariant(state: GameState, now: number): DungeonVariant & { raid: NonNullable<DungeonVariant['raid']> } {
  const raid = currentRaid(state, now)
  const boss = endgameRules.raid.bosses.find((entry) => entry.id === raid.bossId)!
  const grow = raidGrowth(state) * (endgameRules.raid.tiers[(raid.tier ?? 1) - 1]?.grow ?? 1)
  return {
    floors: [
      { monsters: [...boss.minions], scale: boss.scale * 0.6 * grow },
      { monsters: [boss.boss, boss.minions[0]!], scale: boss.scale * grow },
    ],
    raid: { hpScale: boss.hpScale * grow, hp: raid.hp },
  }
}

// A party's damage lands when it comes home, on whatever is left by then,
// so parties sent together each count. A raid from last week is over.
export function settleRaid(state: GameState, week: string, start: number | null, left: number | undefined, max: number | undefined, returnAt?: number): GameState {
  const raid = state.raid
  // A party home after the week turned finds its raid over (review 1650b75).
  if (!raid || raid.week !== week || raid.killed || left == null || max == null || (returnAt != null && raidWeek(returnAt) !== week)) {
    return state
  }
  const damage = Math.max(0, (start ?? max) - left)
  const hp = Math.max(0, (raid.hp ?? max) - damage)
  if (hp > 0) {
    return { ...state, raid: { ...raid, hp, max } }
  }
  const boss = endgameRules.raid.bosses.find((entry) => entry.id === raid.bossId)!
  const tiers = endgameRules.raid.tiers
  const tier = raid.tier ?? 1
  const vault = { ...(state.vault ?? freshVault()) }
  vault[boss.spoil as VaultKey] += tiers[tier - 1]?.spoils ?? endgameRules.raid.spoils
  // The next tier opens at once the same week; after the last the raid is done.
  const next = tier < tiers.length ? { ...raid, hp: null, max: null, killed: false, tier: tier + 1 } : { ...raid, hp: 0, max, killed: true }
  return {
    ...state,
    vault,
    fame: state.fame + Math.round(endgameRules.raid.fame * (1 + rewardBonus(state))),
    raid: next,
    raidKills: (state.raidKills ?? 0) + 1,
  }
}
