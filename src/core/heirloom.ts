import { magicRules, tavernRules } from './data'
import type { GameState } from './game'
import { canWield, gearMods } from './gear'
import { feel } from './personality'
import type { Gear, Hero } from './types'

// Heirlooms (Docs/tavern.md): gear left behind by a hero who passed away, or
// handed down by a retiree, is stronger in a descendant's hands, grows with
// each generation, and comforts a grieving heir.

export type Heirloom = { ownerId: string; ownerName: string; family?: string; generations: number; comforted?: string[] }

// Parents, grandparents and great-grandparents, living or buried.
function ancestorIds(state: GameState, heroId: string): Set<string> {
  const people = [...state.roster, ...(state.retirees ?? []).map((retiree) => retiree.hero)]
  const parentsOf = (id: string): string[] =>
    people.find((hero) => hero.id === id)?.parents ?? state.graveyard.find((grave) => grave.id === id)?.parents ?? []
  const found = new Set<string>()
  let frontier = parentsOf(heroId)
  for (let depth = 0; depth < 3 && frontier.length > 0; depth += 1) {
    frontier.forEach((id) => found.add(id))
    frontier = frontier.flatMap(parentsOf)
  }
  return found
}

export function isHeir(state: GameState, heroId: string, ownerId: string): boolean {
  return ancestorIds(state, heroId).has(ownerId)
}

// The share an heirloom adds to its own attack and defense for this wearer.
export function heirloomBonus(state: GameState, hero: Hero, item: Gear): number {
  const heirloom = item.heirloom
  if (!heirloom || !isHeir(state, hero.id, heirloom.ownerId)) {
    return 0
  }
  const steps = tavernRules.heirloom.bonus
  return steps[Math.min(steps.length, heirloom.generations) - 1] ?? 0
}

// Extra attack and defense from everything a hero wears that came down the family.
export function heirloomMods(state: GameState, hero: Hero): { attack: number; defense: number } {
  let attack = 0
  let defense = 0
  for (const item of hero.gear) {
    const share = heirloomBonus(state, hero, item)
    if (share > 0) {
      const mods = gearMods(item)
      attack += mods.attack * share
      defense += mods.defense * share
    }
  }
  return { attack, defense }
}

// Marks what a hero leaves behind. Passing down the line adds a generation;
// anyone else starts a new one with themselves as its owner.
export function bequeathed(state: GameState, owner: Hero, items: Gear[]): Gear[] {
  return items
    .filter((item) => item.recipeId !== 'starter')
    .map((item) => {
      const line = item.heirloom && isHeir(state, owner.id, item.heirloom.ownerId)
      const generations = line ? Math.min(tavernRules.heirloom.maxGenerations, item.heirloom!.generations + 1) : 1
      // Whoever was already comforted by this piece is not comforted again (review 161d1d1).
      const comforted = item.heirloom?.comforted
      const heirloom: Heirloom = { ownerId: owner.id, ownerName: owner.name, generations, ...(owner.family ? { family: owner.family } : {}), ...(comforted?.length ? { comforted } : {}) }
      return { ...item, heirloom }
    })
}

// A retiree hands a piece of their gear to a descendant (worn at once) or
// leaves it in the stash.
export function bequeath(state: GameState, retireeId: string, gearId: string, toId: string | null, busy: Set<string>): GameState {
  const retiree = (state.retirees ?? []).find((entry) => entry.hero.id === retireeId)
  const item = retiree?.hero.gear.find((gear) => gear.id === gearId)
  if (!retiree || !item || item.recipeId === 'starter') {
    return { ...state, notice: 'missing' }
  }
  const heir = toId ? state.roster.find((hero) => hero.id === toId) : null
  if (toId && (!heir || !isHeir(state, toId, retireeId))) {
    return { ...state, notice: 'notHeir' }
  }
  if (heir && (busy.has(heir.id) || heir.condition === 'dead')) {
    return { ...state, notice: 'busyHero' }
  }
  const [gift] = bequeathed(state, retiree.hero, [item])
  const retirees = state.retirees.map((entry) => (entry === retiree ? { ...entry, hero: { ...entry.hero, gear: entry.hero.gear.filter((gear) => gear.id !== gearId) } } : entry))
  // A weapon the heir's class cannot wield goes to storage (Docs/identity.md 5b).
  if (!heir || !canWield(heir.classId, gift!)) {
    return { ...state, notice: null, retirees, stash: [...state.stash, gift!] }
  }
  // Worn at once; whatever it replaces goes to the stash.
  // The same slot rules as equipping: one weapon, one armour, and the oldest
  // trinket comes off when both trinket slots are taken (review 161d1d1).
  const same = heir.gear.filter((gear) => gear.slot === gift!.slot)
  const room = gift!.slot === 'trinket' ? magicRules.trinketSlots : 1
  const off = same.length >= room ? same.slice(0, same.length - room + 1) : []
  const roster = state.roster.map((hero) => (hero.id === heir.id ? { ...hero, gear: [...hero.gear.filter((gear) => !off.includes(gear)), gift!] } : hero))
  return { ...state, notice: null, retirees, roster, stash: [...state.stash, ...off] }
}

// The first time an heir wears what a departed forebear left, it lifts their spirits.
export function comfortHeir(state: GameState, heroId: string, item: Gear): { hero: (hero: Hero) => Hero; item: Gear } {
  const heirloom = item.heirloom
  const gone = heirloom && state.graveyard.some((grave) => grave.id === heirloom.ownerId)
  if (!heirloom || !gone || heirloom.comforted?.includes(heroId) || !isHeir(state, heroId, heirloom.ownerId)) {
    return { hero: (hero) => hero, item }
  }
  return {
    hero: (hero) => feel(hero, 'joy', tavernRules.heirloom.comfort),
    item: { ...item, heirloom: { ...heirloom, comforted: [...(heirloom.comforted ?? []), heroId] } },
  }
}
