import { endgameRules, potionById, smithRules } from './data'
import type { GameState } from './game'
import { townLevelOf } from './game'
import { forgeGear } from './gear'
import { seasonKey } from './nest'
import { freshVault, type VaultKey } from './trials'
import type { PotionId } from './types'

// Seasonal events (Docs/endgame.md 4d): each game season opens its own
// dungeon, a few runs a season, paying event tokens. The season's shop
// trades tokens for essences, shards, materials and rare finds; tokens keep
// across seasons, the shop's stock does not.

export type EventState = { season: string; used: number; bought: Record<string, number> }
export type ShopItem = { id: string; cost: number; stock: number; vault?: Partial<Record<VaultKey, number>>; materials?: Partial<GameState['materials']>; potions?: Partial<Record<PotionId, number>>; gear?: string; gold?: number }

function current(state: GameState): EventState {
  const season = seasonKey(state.calendar)
  return state.event && state.event.season === season ? state.event : { season, used: 0, bought: {} }
}

export function eventDungeonId(state: GameState): string {
  return `event_${state.calendar.season}`
}

export function eventRunsLeft(state: GameState): number {
  return Math.max(0, endgameRules.event.attemptsPerSeason - current(state).used)
}

export function eventShop(state: GameState): (ShopItem & { left: number })[] {
  const bought = current(state).bought
  return (endgameRules.event.shop[state.calendar.season] as ShopItem[]).map((item) => ({ ...item, left: item.stock - (bought[item.id] ?? 0) }))
}

// Why the event dungeon cannot be entered now, or null.
export function eventBlock(state: GameState, dungeonId: string): 'lockedDungeon' | 'eventSeason' | 'eventUsed' | null {
  if (townLevelOf(state).level < endgameRules.event.unlockTown) {
    return 'lockedDungeon'
  }
  if (dungeonId !== eventDungeonId(state)) {
    return 'eventSeason'
  }
  return eventRunsLeft(state) < 1 ? 'eventUsed' : null
}

export function spendEvent(state: GameState): GameState {
  const event = current(state)
  return { ...state, event: { ...event, used: event.used + 1 } }
}

export function settleEvent(state: GameState, victory: boolean): GameState {
  if (!victory) {
    return state
  }
  const vault = { ...(state.vault ?? freshVault()) }
  vault.token += endgameRules.event.tokens
  return { ...state, vault }
}

export function buyEvent(state: GameState, itemId: string): GameState {
  if (townLevelOf(state).level < endgameRules.event.unlockTown) {
    return { ...state, notice: 'lockedDungeon' }
  }
  const item = eventShop(state).find((entry) => entry.id === itemId)
  if (!item) {
    return { ...state, notice: 'missing' }
  }
  if (item.left < 1) {
    return { ...state, notice: 'soldOut' }
  }
  if ((state.vault?.token ?? 0) < item.cost) {
    return { ...state, notice: 'poor' }
  }
  const event = current(state)
  const vault = { ...state.vault, token: state.vault.token - item.cost }
  for (const [key, amount] of Object.entries((item as { vault?: Partial<Record<VaultKey, number>> }).vault ?? {})) {
    vault[key as VaultKey] += amount ?? 0
  }
  const materials = { ...state.materials }
  for (const [key, amount] of Object.entries((item as { materials?: Partial<GameState['materials']> }).materials ?? {})) {
    materials[key as keyof typeof materials] += amount ?? 0
  }
  const potions = { ...state.potions }
  for (const [key, amount] of Object.entries((item as { potions?: Partial<Record<PotionId, number>> }).potions ?? {})) {
    if (potionById(key)) {
      potions[key as PotionId] = (potions[key as PotionId] ?? 0) + (amount ?? 0)
    }
  }
  const gearId = (item as { gear?: string }).gear
  const recipe = gearId ? smithRules.recipes.find((entry) => entry.id === gearId) : undefined
  const stash = recipe ? [...state.stash, forgeGear(recipe, `${state.seed}-ev${event.season}-${item.id}-${event.bought[item.id] ?? 0}`, 'power')] : state.stash
  return {
    ...state,
    notice: null,
    gold: state.gold + ((item as { gold?: number }).gold ?? 0),
    vault,
    materials,
    potions,
    stash,
    event: { ...event, bought: { ...event.bought, [item.id]: (event.bought[item.id] ?? 0) + 1 } },
  }
}
