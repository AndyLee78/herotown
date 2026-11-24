import { dungeons, guildRules, villageRules } from './data'
import type { GameState, MaterialName } from './game'
import { seasonKey } from './nest'
import { createRng } from './rng'

// The guild (Docs/guild.md): a seasonal board of well-paid contracts, then
// repeatable ones; levels also set parties, auto parties and appraisal.

export type ContractKind = 'clear' | 'deliver'

export type Contract = {
  id: string
  kind: ContractKind
  dungeonId?: string
  material?: MaterialName
  need: number
  progress: number
  gold: number
  fame: number
  done: boolean
}

export type GuildBoard = {
  season: string
  seasonal: Contract[]
  repeat: Contract | null
  // Contracts finished over all time: the guild's record.
  record: number
  repeatNonce: number
}

export function guildLevel(level: number) {
  return guildRules.levels[Math.max(0, Math.min(guildRules.levels.length - 1, level))]!
}

export function expeditionSlotsFor(level: number): number {
  return guildLevel(level).expeditions
}

export function emptyBoard(): GuildBoard {
  return { season: '', seasonal: [], repeat: null, record: 0, repeatNonce: 0 }
}

// Dungeons worth a contract: the cleared ones, the highest tiers first.
function contractDungeons(state: GameState): string[] {
  const cleared = dungeons.filter((dungeon) => state.cleared.includes(dungeon.id))
  const top = Math.max(0, ...cleared.map((dungeon) => dungeon.tier))
  return cleared.filter((dungeon) => dungeon.tier >= top - 1).map((dungeon) => dungeon.id)
}

// Materials the village can win from what it has cleared.
function contractMaterials(state: GameState): MaterialName[] {
  const found = new Set<MaterialName>()
  for (const id of state.cleared) {
    const drop = villageRules.drops[id as keyof typeof villageRules.drops] as { material: string } | undefined
    if (drop) {
      found.add(drop.material as MaterialName)
    }
  }
  return [...found]
}

function makeContract(state: GameState, id: string, seed: number, share: number, fame: boolean): Contract | null {
  const rng = createRng(seed)
  const places = contractDungeons(state)
  const materials = contractMaterials(state)
  if (!places.length) {
    return null
  }
  const deliver = materials.length > 0 && rng.next() < guildRules.deliverChance
  if (deliver) {
    const material = materials[Math.floor(rng.next() * materials.length)]!
    const need = guildRules.deliverAmount[material] ?? 10
    const value = guildRules.materialValue[material] ?? 2
    return { id, kind: 'deliver', material, need, progress: 0, gold: Math.round(need * value * guildRules.deliverGold * share), fame: fame ? guildRules.fame : 0, done: false }
  }
  const dungeonId = places[Math.floor(rng.next() * places.length)]!
  const dungeon = dungeons.find((entry) => entry.id === dungeonId)!
  const need = guildRules.clearCount[0]! + Math.floor(rng.next() * (guildRules.clearCount[1]! - guildRules.clearCount[0]! + 1))
  return {
    id,
    kind: 'clear',
    dungeonId,
    need,
    progress: 0,
    gold: Math.round(dungeon.gold * need * guildRules.clearGold * share),
    fame: fame ? guildRules.fame + dungeon.tier * guildRules.famePerTier : 0,
    done: false,
  }
}

// A fresh seasonal board when the season (or the guild) changes.
export function ensureBoard(state: GameState): GameState {
  if (state.buildings.guild < 1) {
    return state
  }
  const board = state.guild ?? emptyBoard()
  const key = seasonKey(state.calendar)
  if (board.season === key) {
    return state
  }
  const count = guildLevel(state.buildings.guild).contracts
  const base = state.seed * 13 + state.calendar.year * 977 + key.length * 31 + ['spring', 'summer', 'autumn', 'winter'].indexOf(state.calendar.season) * 101
  const seasonal = Array.from({ length: count }, (_, index) => makeContract(state, `${key}-s${index + 1}`, base + index * 7919, 1, true)).filter((entry): entry is Contract => entry != null)
  return { ...state, guild: { ...board, season: key, seasonal, repeat: null } }
}

function nextRepeat(state: GameState, board: GuildBoard): GuildBoard {
  if (board.seasonal.some((contract) => !contract.done)) {
    return board
  }
  const nonce = board.repeatNonce + 1
  const repeat = makeContract(state, `r${nonce}`, state.seed * 17 + nonce * 6151, guildRules.repeatShare, false)
  return { ...board, repeat, repeatNonce: nonce }
}

function finish(state: GameState, contract: Contract): GameState {
  return { ...state, gold: state.gold + contract.gold, fame: state.fame + contract.fame }
}

// Applies progress to every open contract that matches, paying any that finish.
function advanceContracts(state: GameState, matches: (contract: Contract) => number): GameState {
  const board = state.guild
  if (!board || state.buildings.guild < 1) {
    return state
  }
  let next = state
  let record = board.record
  const step = (contract: Contract): Contract => {
    if (contract.done) {
      return contract
    }
    const gained = matches(contract)
    if (gained <= 0) {
      return contract
    }
    const progress = Math.min(contract.need, contract.progress + gained)
    const done = progress >= contract.need
    if (done) {
      next = finish(next, contract)
      record += 1
    }
    return { ...contract, progress, done }
  }
  const seasonal = board.seasonal.map(step)
  let repeat = board.repeat ? step(board.repeat) : null
  let updated: GuildBoard = { ...board, seasonal, repeat, record }
  // A finished repeat contract makes way for the next one at once.
  if (repeat?.done) {
    repeat = null
    updated = { ...updated, repeat: null }
  }
  if (!updated.repeat) {
    updated = nextRepeat(next, updated)
  }
  return { ...next, guild: updated }
}

export function progressClear(state: GameState, dungeonId: string): GameState {
  return advanceContracts(state, (contract) => (contract.kind === 'clear' && contract.dungeonId === dungeonId ? 1 : 0))
}

export function deliver(state: GameState, contractId: string): GameState {
  const board = state.guild
  const contract = board ? [...board.seasonal, ...(board.repeat ? [board.repeat] : [])].find((entry) => entry.id === contractId) : undefined
  if (!contract || contract.kind !== 'deliver' || contract.done || !contract.material) {
    return { ...state, notice: 'missing' }
  }
  const owed = contract.need - contract.progress
  if (state.materials[contract.material] < owed) {
    return { ...state, notice: 'resources' }
  }
  const paid = { ...state, notice: null, materials: { ...state.materials, [contract.material]: state.materials[contract.material] - owed } }
  return advanceContracts(paid, (entry) => (entry.id === contractId ? owed : 0))
}

export function readBoard(value: unknown): GuildBoard | null {
  if (value == null || typeof value !== 'object') {
    return null
  }
  const board = value as GuildBoard
  if (typeof board.season !== 'string' || !Array.isArray(board.seasonal)) {
    return null
  }
  return { season: board.season, seasonal: board.seasonal, repeat: board.repeat ?? null, record: typeof board.record === 'number' ? board.record : 0, repeatNonce: typeof board.repeatNonce === 'number' ? board.repeatNonce : 0 }
}
