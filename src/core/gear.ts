import { smithRules } from './data'
import { createRng, type Rng } from './rng'
import type { ArmorType, ClassId, Gear, GearElement, GearGrade, GearOption, GearOptionId, GearSlot, GearType, Hero, SkillEffect, WeaponType } from './types'

export type SmithRecipe = (typeof smithRules.recipes)[number]

export function recipeById(id: string): SmithRecipe | undefined {
  return smithRules.recipes.find((recipe) => recipe.id === id)
}

export function craftableRecipes(): SmithRecipe[] {
  // Every recipe but the starter blade (smithLevel 99).
  return smithRules.recipes.filter((recipe) => recipe.smithLevel < 99)
}

export function normalizeGear(item: Partial<Gear> | undefined, classId: ClassId): Gear {
  const slot: GearSlot = item?.slot === 'armor' || item?.slot === 'trinket' ? item.slot : 'weapon'
  const grade: GearGrade = item?.grade === 'fine' || item?.grade === 'rare' || item?.grade === 'epic' || item?.grade === 'legend' ? item.grade : 'common'
  const element: GearElement | undefined = item?.element === 'flame' || item?.element === 'silver' ? item.element : undefined
  const type = readType(item?.type, slot)
  const options = readOptions(item, slot)
  return {
    id: item?.id || `${classId}.${slot}`,
    recipeId: item?.recipeId || 'starter',
    slot,
    grade,
    element,
    ...(type ? { type } : {}),
    ...(options.length ? { options } : {}),
    // Heroic and legendary gear goes up to +10 (Docs/endgame.md 4d).
    // Whole steps only (review 1eeb27b).
    enhance: Math.max(0, Math.min(grade === 'epic' || grade === 'legend' ? smithRules.lateEnhance.max : smithRules.enhanceMax, Math.floor(Number.isFinite(item?.enhance) ? item!.enhance! : 0))),
    ...(readHeirloom(item?.heirloom) ? { heirloom: readHeirloom(item?.heirloom)! } : {}),
  }
}

function readHeirloom(value: unknown): Gear['heirloom'] | null {
  if (value == null || typeof value !== 'object') {
    return null
  }
  const record = value as NonNullable<Gear['heirloom']>
  if (typeof record.ownerId !== 'string' || typeof record.ownerName !== 'string' || typeof record.generations !== 'number') {
    return null
  }
  return {
    ownerId: record.ownerId,
    ownerName: record.ownerName,
    generations: Math.max(1, Math.min(3, Math.round(record.generations))),
    ...(typeof record.family === 'string' ? { family: record.family } : {}),
    ...(Array.isArray(record.comforted) ? { comforted: record.comforted.filter((id): id is string => typeof id === 'string') } : {}),
  }
}

export function heroGearMods(hero: Hero): { attack: number; defense: number } {
  let attack = 0
  let defense = 0
  for (const item of hero.gear) {
    const mods = gearMods(item)
    attack += mods.attack
    defense += mods.defense
  }
  return { attack, defense }
}

export function gearMods(item: Gear): { attack: number; defense: number } {
  const recipe = recipeById(item.recipeId)
  if (!recipe) {
    return { attack: 0, defense: 0 }
  }
  const scale = 1 + item.enhance * smithRules.enhanceBonus
  let attack = recipe.attack * scale
  let defense = recipe.defense * scale
  // Flat options do not grow with enhancing.
  for (const option of item.options ?? []) {
    if (option.id === 'power') {
      attack += option.value
    }
    if (option.id === 'guard') {
      defense += option.value
    }
  }
  return { attack, defense }
}

// Rolls the grade's options when the piece is made (Docs/identity.md 5b);
// a seed keeps the same piece for the same moment. Without a seed the piece
// has no options.
export function forgeGear(recipe: SmithRecipe, id: string, seed?: number, type?: GearType): Gear {
  const element = recipe.element === 'flame' || recipe.element === 'silver' ? recipe.element : undefined
  const slot: GearSlot = recipe.slot === 'armor' ? 'armor' : 'weapon'
  const grade: GearGrade = recipe.grade === 'fine' || recipe.grade === 'rare' || recipe.grade === 'epic' || recipe.grade === 'legend' ? recipe.grade : 'common'
  const rng = createRng(seed ?? 0)
  const options: GearOption[] = []
  for (let index = 0; seed != null && index < smithRules.optionCount[grade]; index += 1) {
    const rolled = rollOption(slot, grade, options.map((option) => option.id), rng)
    if (rolled) {
      options.push(rolled)
    }
  }
  const kind = readType(type, slot)
  return {
    id,
    recipeId: recipe.id,
    slot,
    grade,
    element,
    ...(kind ? { type: kind } : {}),
    ...(options.length ? { options } : {}),
    enhance: 0,
  }
}

type OptionDef = (typeof smithRules.optionPool)[number]

function optionDef(id: string): OptionDef | undefined {
  return smithRules.optionPool.find((entry) => entry.id === id)
}

// One option for this slot that the piece does not have yet.
export function rollOption(slot: GearSlot, grade: GearGrade, taken: GearOptionId[], rng: Rng): GearOption | null {
  const pool = smithRules.optionPool.filter((entry) => (slot === 'armor' ? entry.armor : slot === 'weapon' ? entry.weapon : false) && !taken.includes(entry.id as GearOptionId))
  if (pool.length === 0) {
    return null
  }
  const def = rng.pick(pool)!
  return { id: def.id as GearOptionId, value: optionValue(def, grade, rng.next()) }
}

function optionValue(def: OptionDef, grade: GearGrade, roll: number): number {
  const raw = (def.min + (def.max - def.min) * roll) * smithRules.optionScale[grade]
  // Flat attack and defence are whole numbers; percentages keep three places.
  return def.min >= 1 ? Math.round(raw) : Math.round(raw * 1000) / 1000
}

// The highest value an option can roll on this grade, for screens.
export function optionRange(id: GearOptionId, grade: GearGrade): { min: number; max: number } | null {
  const def = optionDef(id)
  return def ? { min: optionValue(def, grade, 0), max: optionValue(def, grade, 1) } : null
}

const WEAPON_TYPES = smithRules.weaponTypes.map((entry) => entry.id) as WeaponType[]
const ARMOR_TYPES = smithRules.armorTypes.map((entry) => entry.id) as ArmorType[]

export function weaponTypes(classId?: ClassId): WeaponType[] {
  return classId ? smithRules.weaponTypes.filter((entry) => (entry.classes as string[]).includes(classId)).map((entry) => entry.id as WeaponType) : WEAPON_TYPES
}

export function armorTypes(): ArmorType[] {
  return ARMOR_TYPES
}

function readType(value: unknown, slot: GearSlot): GearType | undefined {
  if (slot === 'weapon' && WEAPON_TYPES.includes(value as WeaponType)) {
    return value as WeaponType
  }
  if (slot === 'armor' && ARMOR_TYPES.includes(value as ArmorType)) {
    return value as ArmorType
  }
  return undefined
}

// Options from a save. The old single option (power/guard) becomes the same
// flat option at its old value (Docs/identity.md 5b).
function readOptions(item: Partial<Gear> | undefined, slot: GearSlot): GearOption[] {
  if (slot === 'trinket') {
    return []
  }
  const legacy = (item as { option?: unknown } | undefined)?.option
  if (!Array.isArray(item?.options)) {
    if (legacy === 'power') {
      return [{ id: 'power', value: smithRules.optionPower }]
    }
    if (legacy === 'guard') {
      return [{ id: 'guard', value: smithRules.optionGuard }]
    }
    return []
  }
  const options: GearOption[] = []
  for (const entry of item.options) {
    const def = entry && typeof entry === 'object' ? optionDef(entry.id) : undefined
    if (!def || options.some((option) => option.id === def.id) || !Number.isFinite(entry.value) || options.length >= 3) {
      continue
    }
    // Clamped to what the best grade could roll.
    const top = optionValue(def, 'legend', 1)
    options.push({ id: def.id as GearOptionId, value: Math.max(0, Math.min(top, entry.value)) })
  }
  return options
}

// Whether this hero's class can wield it; armour, trinkets and untyped weapons fit anyone.
export function canWield(classId: ClassId, item: Gear): boolean {
  if (item.slot !== 'weapon' || !item.type) {
    return true
  }
  return weaponTypes(classId).includes(item.type as WeaponType)
}

// What the piece's type and percentage options add to the hero's totals
// (flat attack and defence go through gearMods).
export function gearEffect(item: Gear): SkillEffect {
  const effect: Record<string, number> = {}
  const typed = item.type ? [...smithRules.weaponTypes, ...smithRules.armorTypes].find((entry) => entry.id === item.type) : undefined
  for (const [key, value] of Object.entries(typed?.effect ?? {})) {
    effect[key] = (effect[key] ?? 0) + (value as number)
  }
  for (const option of item.options ?? []) {
    if (option.id === 'power' || option.id === 'guard') {
      continue
    }
    const key = option.id === 'xp' ? 'xpGain' : option.id
    effect[key] = (effect[key] ?? 0) + option.value
  }
  return effect as SkillEffect
}

// A smith order is a recipe id, with "@type" when a type was chosen
// (Docs/identity.md 5b), so queued orders keep their type.
export function splitOrder(order: string): { recipeId: string; type?: GearType } {
  const [recipeId = '', type] = order.split('@')
  const recipe = recipeById(recipeId)
  const slot: GearSlot = recipe?.slot === 'armor' ? 'armor' : 'weapon'
  const kind = readType(type, slot)
  return kind ? { recipeId, type: kind } : { recipeId }
}

export function orderId(recipeId: string, type?: GearType): string {
  return type ? `${recipeId}@${type}` : recipeId
}

// Rerolls one option of a piece: a new option the piece does not have, at a new value.
export function rerollOption(item: Gear, index: number, seed: number): Gear | null {
  const options = item.options ?? []
  if (index < 0 || index >= options.length) {
    return null
  }
  const others = options.filter((_, at) => at !== index).map((option) => option.id)
  const rolled = rollOption(item.slot, item.grade, others, createRng(seed))
  return rolled ? { ...item, options: options.map((option, at) => (at === index ? rolled : option)) } : null
}
