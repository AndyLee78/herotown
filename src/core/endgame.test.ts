import { describe, expect, it } from 'vitest'
import { endgameRules, smithRules, villageRules } from './data'
import { freshState, migrate, reduce, townLevel, townLevelOf, type GameState } from './game'
import { forgeGear, gearMods } from './gear'
import { gearValue, updateMerchant } from './market'

// Docs/endgame.md, stage 4a: town levels 8-10, late building levels, heroic
// and legendary gear.

const now = 1_700_000_000_000
const plenty = { wood: 999, stone: 999, iron: 999, bone: 999, herb: 999, crystal: 999 }

// Promoted all the way and rich in the vault, so these tests see only the
// fame and building rules; promotion has its own tests below (Docs/endgame.md 4b).
function town(fame: number, extra: Partial<GameState> = {}): GameState {
  const base = freshState(5, now)
  return { ...base, fame, gold: 99_999, materials: plenty, promoted: 10, vault: { flame: 999, frost: 999, light: 999, abyss: 999, scale: 999, crown: 999, core: 999, valor: 999, token: 999 }, ...extra }
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
    // A level waiting for a higher town says so before the cap (review c89e043).
    expect(reduce(house4(400), { type: 'build', id: 'house', now }).notice).toBe('locked')
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

describe('promotion to town levels 8-10 (4b)', () => {
  const fame8 = villageRules.levels.find((entry) => entry.level === 8)!.fame
  const rule8 = endgameRules.promotions.find((entry) => entry.level === 8)!

  it('stops at level 7 on fame alone until the ritual is done', () => {
    const state = town(fame8, { promoted: 7 })
    expect(townLevelOf(state).level).toBe(7)
    expect(townLevel(fame8).level).toBe(8)
  })

  it('needs fame, a deed in the abyss and an offering, then takes the offering', () => {
    const ready = town(fame8, { promoted: 7, abyss: { best: rule8.abyssBest, checkpoint: rule8.abyssBest } })
    expect(reduce({ ...ready, fame: fame8 - 1 }, { type: 'promote' }).notice).toBe('promoteFame')
    expect(reduce({ ...ready, abyss: { best: rule8.abyssBest - 1, checkpoint: 5 } }, { type: 'promote' }).notice).toBe('promoteDeed')
    expect(reduce({ ...ready, vault: { flame: 0, frost: 0, light: 0, abyss: 0, scale: 0, crown: 0, core: 0, valor: 0, token: 0 } }, { type: 'promote' }).notice).toBe('promoteOffering')
    const promoted = reduce(ready, { type: 'promote' })
    expect(promoted.promoted).toBe(8)
    expect(townLevelOf(promoted).level).toBe(8)
    expect(promoted.vault.abyss).toBe(999 - rule8.offering.abyss)
    // Heroes take pride in the town rising.
    expect(promoted.roster.every((hero) => (hero.morale ?? 60) >= (ready.roster.find((entry) => entry.id === hero.id)?.morale ?? 60))).toBe(true)
  })

  it('stops after level 10', () => {
    expect(reduce(town(99_999, { promoted: 10 }), { type: 'promote' }).notice).toBe('promoteMax')
  })

  it('takes essences and shards for late building levels and legendary gear', () => {
    const house4 = town(fame8, { buildings: { ...freshState(5, now).buildings, house: 4 } })
    const started = reduce(house4, { type: 'build', id: 'house', now })
    const level5 = villageRules.buildings.find((building) => building.id === 'house')!.levels.find((entry) => entry.level === 5) as { flame?: number; abyss?: number }
    expect(started.vault.flame).toBe(999 - (level5.flame ?? 0))
    expect(started.vault.abyss).toBe(999 - (level5.abyss ?? 0))
    expect(reduce({ ...house4, vault: { flame: 0, frost: 0, light: 0, abyss: 0, scale: 0, crown: 0, core: 0, valor: 0, token: 0 } }, { type: 'build', id: 'house', now }).notice).toBe('resources')
  })

  it('opens a version 23 save at promotion step 7', () => {
    const old = JSON.parse(JSON.stringify({ ...town(fame8), version: 23 })) as Record<string, unknown>
    delete old.promoted
    expect(migrate(old, now).promoted).toBe(7)
  })
})

describe('review c89e043 fixes', () => {
  const legendMail = smithRules.recipes.find((recipe) => recipe.id === 'legend.mail')! as { flame?: number; frost?: number; light?: number; abyss?: number; bone?: number; crystal?: number }

  it('takes the vault cost for a queued order and gives it all back when cancelled', () => {
    const busy = town(2000, { buildings: { ...freshState(5, now).buildings, smith: 5 }, smith: { kind: 'craft', recipeId: 'fine.blade', gear: null, finishAt: now + 1000 } })
    const queued = reduce(busy, { type: 'craft', recipeId: 'legend.mail', now })
    expect(queued.automation.queues.smith).toEqual(['legend.mail'])
    expect(queued.vault.frost).toBe(999 - (legendMail.frost ?? 0))
    expect(queued.vault.abyss).toBe(999 - (legendMail.abyss ?? 0))
    const cancelled = reduce(queued, { type: 'dequeue', building: 'smith', index: 0 })
    expect(cancelled.vault).toEqual(busy.vault)
    expect(cancelled.materials).toEqual(busy.materials)
  })

  it('keeps the enhance chance at smith levels 4 and 5', () => {
    expect(smithRules.successByLevel[5]).toBeGreaterThanOrEqual(smithRules.successByLevel[3]!)
  })

  it('never sells heroic or legendary gear at the market', () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const base = freshState(seed, now)
      const state = updateMerchant({ ...base, buildings: { ...base.buildings, market: 3, smith: 4 }, market: { ...base.market, nextMerchantAt: now } }, now + 1)
      expect(state.market.merchant!.offers.every((offer) => offer.kind !== 'gear' || (offer.gear.grade !== 'epic' && offer.gear.grade !== 'legend'))).toBe(true)
    }
  })
})
