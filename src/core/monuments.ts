import { endgameRules } from './data'
import type { GameState } from './game'
import { townLevelOf } from './game'
import { freshVault, type VaultKey } from './trials'

// Monuments (Docs/endgame.md 4d): great works raised in three stages from the
// late resources, each a lasting boon for the whole town.
//   statue      heroes learn faster (experience from trips and drills)
//   lighthouse  stronger visitors and more wares from the merchant
//   walls       invaders weaker and less taken when the line breaks
//   arch        more fame and gold from dungeons and raids

export type MonumentId = 'statue' | 'lighthouse' | 'walls' | 'arch'
type Stage = Partial<Record<VaultKey | 'gold' | 'wood' | 'stone' | 'iron' | 'bone' | 'herb' | 'crystal', number>>

export function monumentStage(state: GameState, id: MonumentId): number {
  return state.monuments?.[id] ?? 0
}

function effect(state: GameState, id: MonumentId): number {
  const stage = monumentStage(state, id)
  const def = endgameRules.monuments.list.find((entry) => entry.id === id)
  return stage > 0 && def ? def.effect[stage - 1] ?? 0 : 0
}

export const statueXp = (state: GameState) => effect(state, 'statue')
export const lighthousePotential = (state: GameState) => effect(state, 'lighthouse')
export const lighthouseOffers = (state: GameState) => monumentStage(state, 'lighthouse') > 0 ? Math.ceil(monumentStage(state, 'lighthouse') / 2) : 0
export const wallsCut = (state: GameState) => effect(state, 'walls')
export const archBonus = (state: GameState) => effect(state, 'arch')

export function monumentCost(id: MonumentId, stage: number): Stage | null {
  const def = endgameRules.monuments.list.find((entry) => entry.id === id)
  return (def?.stages[stage - 1] as Stage | undefined) ?? null
}

export function raiseMonument(state: GameState, id: MonumentId): GameState {
  if (townLevelOf(state).level < endgameRules.monuments.unlockTown) {
    return { ...state, notice: 'locked' }
  }
  const stage = monumentStage(state, id) + 1
  const cost = monumentCost(id, stage)
  if (!cost) {
    return { ...state, notice: 'maxLevel' }
  }
  const vault = { ...(state.vault ?? freshVault()) }
  const materials = { ...state.materials }
  const short =
    state.gold < (cost.gold ?? 0) ||
    (Object.keys(materials) as (keyof typeof materials)[]).some((key) => materials[key] < (cost[key] ?? 0)) ||
    (Object.keys(vault) as VaultKey[]).some((key) => vault[key] < (cost[key] ?? 0))
  if (short) {
    return { ...state, notice: 'resources' }
  }
  for (const key of Object.keys(materials) as (keyof typeof materials)[]) {
    materials[key] -= cost[key] ?? 0
  }
  for (const key of Object.keys(vault) as VaultKey[]) {
    vault[key] -= cost[key] ?? 0
  }
  return { ...state, notice: null, gold: state.gold - (cost.gold ?? 0), materials, vault, monuments: { ...state.monuments, [id]: stage } }
}
