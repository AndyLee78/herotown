import { legendsRules, retirementRules } from './data'
import { ancestorsOf, isLegend } from './family'
import type { GameState } from './game'
import type { Gear, Hero } from './types'

// The hall of fame (Docs/legends.md): legends of the past and retired legends
// still in town, a blessing on their descendants, and heirlooms on display.

export type Shrine = { gear: Gear[]; honoured: string[] }

function level(state: GameState): number {
  return Math.min(legendsRules.shrineSlots.length, state.buildings.legends ?? 0)
}

// Retired heroes who already count as legends; they join the hall with it built.
export function livingLegends(state: GameState): Hero[] {
  return level(state) < 1 ? [] : (state.retirees ?? []).map((retiree) => retiree.hero).filter(isLegend)
}

export function isLegendId(state: GameState, id: string): boolean {
  return state.graveyard.some((grave) => grave.id === id && grave.legend) || livingLegends(state).some((hero) => hero.id === id)
}

// The share added to attack for a hero with a legend among their forebears.
export function blessing(state: GameState, hero: Hero): number {
  const lvl = level(state)
  if (lvl < 1 || !ancestorsOf(state, hero.id, 3).some((ancestor) => isLegendId(state, ancestor.id))) {
    return 0
  }
  const kept = (state.retirees ?? []).some((retiree) => retiree.building === 'legends')
  return legendsRules.blessing[lvl - 1]! + (kept ? retirementRules.bonus.legends : 0)
}

export function shrineSlots(state: GameState): number {
  const lvl = level(state)
  return lvl < 1 ? 0 : legendsRules.shrineSlots[lvl - 1]!
}

// Each heirloom on display raises the level spirits settle back to.
export function shrineMorale(state: GameState): number {
  return (state.shrine?.gear.length ?? 0) * legendsRules.shrineMorale
}

export function enshrine(state: GameState, gearId: string): GameState {
  if (level(state) < 1) {
    return { ...state, notice: 'noLegends' }
  }
  const item = state.stash.find((gear) => gear.id === gearId)
  if (!item || !item.heirloom) {
    return { ...state, notice: 'missing' }
  }
  const shrine = state.shrine ?? { gear: [], honoured: [] }
  if (shrine.gear.length >= shrineSlots(state)) {
    return { ...state, notice: 'shrineFull' }
  }
  // Fame for honouring a piece comes once, however often it goes back on display.
  const first = !shrine.honoured.includes(item.id)
  return {
    ...state,
    notice: null,
    fame: state.fame + (first ? legendsRules.shrineFame : 0),
    stash: state.stash.filter((gear) => gear.id !== gearId),
    shrine: { gear: [...shrine.gear, item], honoured: first ? [...shrine.honoured, item.id] : shrine.honoured },
  }
}

export function unshrine(state: GameState, gearId: string): GameState {
  const shrine = state.shrine
  const item = shrine?.gear.find((gear) => gear.id === gearId)
  if (!shrine || !item) {
    return { ...state, notice: 'missing' }
  }
  return { ...state, notice: null, stash: [...state.stash, item], shrine: { ...shrine, gear: shrine.gear.filter((gear) => gear.id !== gearId) } }
}
