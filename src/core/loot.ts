import { dungeonById, endgameRules, lootRules, smithRules } from './data'
import { recordLoot, type Codex } from './codex'
import { forgeGear, recipeById, weaponTypes, armorTypes } from './gear'
import { createRng, type Rng } from './rng'
import type { Gear, GearGrade, GearSlot, GearType } from './types'

// Dungeon drops, boss and raid uniques, sets and the valour exchange
// (Docs/identity.md 5c).

export type UniqueDef = (typeof lootRules.uniques)[number]
// A find keeps a copy of the piece, so the list still reads after it is sold,
// and the trip it came home with (review 2c287d8).
export type LootEntry = { gearId: string; source: string; at: number; gear?: Gear; trip?: string }
export type LootTag = { at: number; trip?: string }

export function uniqueById(id: string | undefined): UniqueDef | undefined {
  return id ? lootRules.uniques.find((entry) => entry.id === id) : undefined
}

// A unique piece: the base recipe's attack and defence, its fixed effect, no options.
export function uniqueGear(def: UniqueDef, id: string): Gear {
  const slot = def.slot as GearSlot
  const base = 'base' in def && def.base ? def.base : undefined
  return {
    id,
    recipeId: base ?? `unique.${def.id}`,
    slot,
    grade: def.grade as GearGrade,
    unique: def.id,
    enhance: 0,
  }
}

function weighted<T extends string>(table: Partial<Record<T, number>>, roll: number): T | null {
  let left = roll
  const entries = Object.entries(table) as Array<[T, number]>
  for (const [key, weight] of entries) {
    left -= weight
    if (left < 0) {
      return key
    }
  }
  return entries.at(-1)?.[0] ?? null
}

// One piece of the dungeon's tier, or null when nothing fits.
export function rollDrop(tier: number, id: string, rng: Rng): Gear | null {
  const table = lootRules.grades[String(Math.max(1, Math.min(7, tier))) as keyof typeof lootRules.grades] as Partial<Record<GearGrade, number>>
  const grade = weighted(table, rng.next())
  if (!grade) {
    return null
  }
  const recipes = smithRules.recipes.filter((recipe) => recipe.grade === grade && recipe.smithLevel < 99)
  const slots = (['weapon', 'armor'] as const).filter((slot) => recipes.some((recipe) => recipe.slot === slot))
  const slot = slots.length === 2 ? (rng.next() < 0.5 ? 'weapon' : 'armor') : slots[0]
  const pool = recipes.filter((recipe) => recipe.slot === slot)
  if (!slot || pool.length === 0) {
    return null
  }
  const recipe = rng.pick(pool)!
  const types: GearType[] = slot === 'weapon' ? weaponTypes() : armorTypes()
  const type = rng.next() < lootRules.untypedChance ? undefined : rng.pick(types)
  return forgeGear(recipe, id, rng.int(2 ** 31), type)
}

function remember(loot: LootEntry[] | undefined, found: Gear[], source: string, tag: LootTag): LootEntry[] {
  return [...(loot ?? []), ...found.map((gear) => ({ gearId: gear.id, source, at: tag.at, gear, ...(tag.trip ? { trip: tag.trip } : {}) }))].slice(-lootRules.recent)
}

type LootState = { seed: number; craftNonce: number; stash: Gear[]; loot?: LootEntry[]; lastTickAt: number; codex?: Codex }

// What a won regular dungeon leaves: a sure piece on the first clear, then a
// chance; and a small chance at the boss's unique. Auto runs find far less
// and no uniques (5c measurement).
export function dungeonLoot<S extends LootState>(state: S, dungeonId: string, first: boolean, auto: boolean, luck: number, tag: LootTag = { at: state.lastTickAt }, elites = 0): S {
  const dungeon = dungeonById(dungeonId)
  if (dungeon.special) {
    return state
  }
  const craftNonce = state.craftNonce + 1
  const rng = createRng(state.seed + craftNonce * 100003 + 29)
  const scale = (auto ? lootRules.autoDropScale : 1) * (1 + luck)
  const uniqueScale = (auto ? lootRules.autoUniqueScale : 1) * (1 + luck)
  const found: Gear[] = []
  const regularChance = lootRules.dropChance * scale
  const dropRoll = first ? 0 : rng.next()
  const rollRegular = () => rollDrop(dungeon.tier, `${state.seed}-d${craftNonce}`, rng)
  if (first || dropRoll < regularChance) {
    const piece = rollRegular()
    if (piece) {
      found.push(piece)
    }
  }
  const unique = lootRules.uniques.find((entry) => 'dungeon' in entry && entry.dungeon === dungeonId)
  if (unique && rng.next() < lootRules.uniqueChance * uniqueScale) {
    found.push(uniqueGear(unique, `${state.seed}-u${craftNonce}`))
  }
  // Roll bonus-only gear after the unique check to preserve the unique's seeded outcome.
  const bonus = Math.min(lootRules.eliteDropBonusCap, Math.max(0, elites) * lootRules.eliteDropBonus)
  if (!first && !auto && dropRoll >= regularChance && dropRoll < regularChance * (1 + bonus)) {
    const piece = rollRegular()
    if (piece) found.unshift(piece)
  }
  if (found.length === 0) {
    return { ...state, craftNonce }
  }
  return recordLoot({ ...state, craftNonce, stash: [...state.stash, ...found], loot: remember(state.loot, found, dungeonId, tag) }, found)
}

// A raid boss brought down may leave one of its two uniques; later tiers more often.
export function raidLoot<S extends LootState>(state: S, bossId: string, tier: number, tag: LootTag = { at: state.lastTickAt }): S {
  const pieces = lootRules.uniques.filter((entry) => 'raid' in entry && entry.raid === bossId)
  const chance = lootRules.raidUniqueChance[Math.max(0, Math.min(lootRules.raidUniqueChance.length - 1, tier - 1))] ?? 0
  const craftNonce = state.craftNonce + 1
  const rng = createRng(state.seed + craftNonce * 100003 + 31)
  if (pieces.length === 0 || rng.next() >= chance) {
    return { ...state, craftNonce }
  }
  const piece = uniqueGear(rng.pick(pieces)!, `${state.seed}-r${craftNonce}`)
  return recordLoot({ ...state, craftNonce, stash: [...state.stash, piece], loot: remember(state.loot, [piece], `raid.${bossId}`, tag) }, [piece])
}

// Where a unique can be traded for: its dungeon cleared, or a raid unique's spoils in hand.
export function exchangeCost(def: UniqueDef): Record<string, number> {
  return def.cost as unknown as Record<string, number>
}

export function canExchange(def: UniqueDef, cleared: string[]): boolean {
  return !('dungeon' in def) || cleared.includes(def.dungeon as string)
}

export function raidBossIds(): string[] {
  return endgameRules.raid.bosses.map((boss) => boss.id)
}

// Whether the id names a unique weapon or armour whose base recipe exists.
export function validUnique(id: unknown, slot: GearSlot): string | undefined {
  const def = typeof id === 'string' ? uniqueById(id) : undefined
  if (!def || def.slot !== slot) {
    return undefined
  }
  if ('base' in def && def.base && !recipeById(def.base)) {
    return undefined
  }
  return def.id
}
