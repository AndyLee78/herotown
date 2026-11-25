import { describe, expect, it } from 'vitest'
import { smithRules, villageRules } from './data'
import { freshState, migrate, reduce, townLevel, type GameState } from './game'
import { forgeGear, gearMods } from './gear'
import { gearValue } from './market'

// Docs/endgame.md, stage 4a: town levels 8-10, late building levels, heroic
// and legendary gear.

const now = 1_700_000_000_000
const plenty = { wood: 999, stone: 999, iron: 999, bone: 999, herb: 999, crystal: 999 }

function town(fame: number, extra: Partial<GameState> = {}): GameState {
  const base = freshState(5, now)
  return { ...base, fame, gold: 99_999, materials: plenty, ...extra }
}

describe('town levels 8-10', () => {
  it('reach level 10 with more fame and raise the building cap', () => {
    expect(townLevel(villageRules.levels[7]!.fame).level).toBe(8)
    expect(townLevel(10_000).level).toBe(10)
    expect(townLevel(10_000).maxBuildingLevel).toBe(6)
  })
})

describe('late building levels', () => {
  it('wait for their town level and take the late materials', () => {
    const house4 = (fame: number) => town(fame, { buildings: { ...freshState(5, now).buildings, house: 4 } })
    expect(reduce(house4(400), { type: 'build', id: 'house', now }).notice).toBe('maxLevel')
    const level5 = villageRules.buildings.find((building) => building.id === 'house')!.levels.find((entry) => entry.level === 5) as { bone?: number }
    const started = reduce(house4(villageRules.levels[7]!.fame), { type: 'build', id: 'house', now })
    expect(started.construction?.id).toBe('house')
    expect(started.materials.bone).toBe(plenty.bone - (level5.bone ?? 0))
    const poor = { ...house4(villageRules.levels[7]!.fame), materials: { ...plenty, bone: 0 } }
    expect(reduce(poor, { type: 'build', id: 'house', now }).notice).toBe('resources')
  })

  it('keep a gated level locked below its town level even under the cap', () => {
    // Smith level 5 needs town level 10 though town 8 allows building level 5.
    const state = town(villageRules.levels[7]!.fame, { buildings: { ...freshState(5, now).buildings, smith: 4 } })
    expect(reduce(state, { type: 'build', id: 'smith', now }).notice).toBe('locked')
  })
})

describe('heroic and legendary gear', () => {
  it('is made at smith levels 4 and 5 and beats rare gear', () => {
    const epic = smithRules.recipes.find((recipe) => recipe.id === 'epic.blade')!
    const legend = smithRules.recipes.find((recipe) => recipe.id === 'legend.blade')!
    const rare = smithRules.recipes.find((recipe) => recipe.id === 'flame.blade')!
    expect(gearMods(forgeGear(legend, 'l')).attack).toBeGreaterThan(gearMods(forgeGear(epic, 'e')).attack)
    expect(gearMods(forgeGear(epic, 'e')).attack).toBeGreaterThan(gearMods(forgeGear(rare, 'r')).attack)
    expect(forgeGear(legend, 'l', 'guard').option).toBe('guard')
    const smith3 = town(2000, { buildings: { ...freshState(5, now).buildings, smith: 3 } })
    expect(reduce(smith3, { type: 'craft', recipeId: 'epic.blade', now }).notice).toBe('locked')
    const smith4 = town(2000, { buildings: { ...freshState(5, now).buildings, smith: 4 } })
    const crafting = reduce(smith4, { type: 'craft', recipeId: 'epic.blade', now })
    expect(crafting.smith?.recipeId).toBe('epic.blade')
    expect(crafting.materials.crystal).toBe(plenty.crystal - (epic as { crystal?: number }).crystal!)
    expect(gearValue(forgeGear(epic, 'e'))).toBeGreaterThan(gearValue(forgeGear(rare, 'r')))
  })

  it('keeps its grade in a save', () => {
    const legend = smithRules.recipes.find((recipe) => recipe.id === 'legend.mail')!
    const saved = JSON.parse(JSON.stringify({ ...town(0), stash: [forgeGear(legend, 'lm', 'power')] })) as Record<string, unknown>
    expect(migrate(saved, now).stash[0]?.grade).toBe('legend')
  })
})
