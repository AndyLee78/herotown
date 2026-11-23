import { smithRules } from './data'
import type { ClassId, Gear, GearElement, GearGrade, GearOption, GearSlot, Hero } from './types'

export type SmithRecipe = (typeof smithRules.recipes)[number]

export function recipeById(id: string): SmithRecipe | undefined {
  return smithRules.recipes.find((recipe) => recipe.id === id)
}

export function craftableRecipes(): SmithRecipe[] {
  return smithRules.recipes.filter((recipe) => recipe.smithLevel <= 3)
}

export function normalizeGear(item: Partial<Gear> | undefined, classId: ClassId): Gear {
  const slot: GearSlot = item?.slot === 'armor' || item?.slot === 'trinket' ? item.slot : 'weapon'
  const grade: GearGrade = item?.grade === 'fine' || item?.grade === 'rare' ? item.grade : 'common'
  const element: GearElement | undefined = item?.element === 'flame' || item?.element === 'silver' ? item.element : undefined
  const option: GearOption | undefined = item?.option === 'power' || item?.option === 'guard' ? item.option : undefined
  return {
    id: item?.id || `${classId}.${slot}`,
    recipeId: item?.recipeId || 'starter',
    slot,
    grade,
    element,
    option,
    enhance: Math.max(0, Math.min(smithRules.enhanceMax, item?.enhance ?? 0)),
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
  if (item.option === 'power') {
    attack += smithRules.optionPower
  }
  if (item.option === 'guard') {
    defense += smithRules.optionGuard
  }
  return { attack, defense }
}

export function forgeGear(recipe: SmithRecipe, id: string, option?: GearOption): Gear {
  const element = recipe.element === 'flame' || recipe.element === 'silver' ? recipe.element : undefined
  return {
    id,
    recipeId: recipe.id,
    slot: recipe.slot === 'armor' ? 'armor' : 'weapon',
    grade: recipe.grade === 'fine' || recipe.grade === 'rare' ? recipe.grade : 'common',
    element,
    option: recipe.grade === 'rare' ? option : undefined,
    enhance: 0,
  }
}
