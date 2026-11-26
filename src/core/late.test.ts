import { describe, expect, it } from 'vitest'
import { endgameRules, smithRules, villageRules } from './data'
import { enhanceCostFor, enhanceLimit, freshState, migrate, reduce, type GameState } from './game'
import { forgeGear, recipeById } from './gear'
import { eventDungeonId, eventRunsLeft, eventShop, settleEvent } from './events'
import { archBonus, lighthousePotential, monumentCost, statueXp, wallsCut } from './monuments'
import { nextRankFame, prosperityBonus, rankOffering } from './prosperity'
import { rewardBonus } from './raid'

// Docs/endgame.md 4d: seasonal events, monuments, late enhancement, options,
// raid tiers and prosperity.

const now = 1_700_000_000_000
const rich = { flame: 999, frost: 999, light: 999, abyss: 999, scale: 99, crown: 99, core: 99, valor: 999, token: 999 }
const plenty = { wood: 9999, stone: 9999, iron: 9999, bone: 9999, herb: 9999, crystal: 9999 }

function town(level: number, extra: Partial<GameState> = {}): GameState {
  const base = freshState(5, now)
  return { ...base, fame: villageRules.levels.find((entry) => entry.level === level)!.fame, promoted: Math.max(7, level), gold: 99_999, materials: plenty, vault: rich, ...extra }
}

describe('seasonal events', () => {
  it('open the season’s own dungeon a few times a season and pay tokens', () => {
    const state = { ...town(6), dungeonId: 'event_summer' }
    expect(eventDungeonId(state)).toBe('event_spring')
    expect(reduce(state, { type: 'depart', presetId: 'p1', confirm: true, now }).notice).not.toBeNull()
    expect(eventRunsLeft(state)).toBe(endgameRules.event.attemptsPerSeason)
    expect(settleEvent(state, true).vault.token).toBe(rich.token + endgameRules.event.tokens)
    expect(settleEvent(state, false)).toBe(state)
  })

  it('sell the season’s wares for tokens, each a few times', () => {
    const state = town(6)
    const item = eventShop(state)[0]!
    let next = state
    for (let bought = 0; bought < item.stock; bought += 1) {
      next = reduce(next, { type: 'buyEvent', itemId: item.id })
    }
    expect(next.vault.token).toBe(rich.token - item.cost * item.stock)
    expect(reduce(next, { type: 'buyEvent', itemId: item.id }).notice).toBe('soldOut')
    expect(reduce({ ...state, vault: { ...rich, token: 0 } }, { type: 'buyEvent', itemId: item.id }).notice).toBe('poor')
  })
})

describe('monuments', () => {
  it('rise in three stages from town level 9 and pay their stage cost', () => {
    expect(reduce(town(8), { type: 'raiseMonument', id: 'statue' }).notice).toBe('locked')
    let state = town(9)
    state = reduce(state, { type: 'raiseMonument', id: 'statue' })
    expect(state.monuments.statue).toBe(1)
    expect(state.vault.valor).toBe(rich.valor - (monumentCost('statue', 1)!.valor ?? 0))
    state = reduce(reduce(state, { type: 'raiseMonument', id: 'statue' }), { type: 'raiseMonument', id: 'statue' })
    expect(state.monuments.statue).toBe(3)
    expect(reduce(state, { type: 'raiseMonument', id: 'statue' }).notice).toBe('maxLevel')
  })

  it('give their boons by stage', () => {
    const state = town(9, { monuments: { statue: 2, lighthouse: 1, walls: 3, arch: 1 }, prosperity: 2 })
    expect(statueXp(state)).toBe(0.1)
    expect(lighthousePotential(state)).toBe(5)
    expect(wallsCut(state)).toBe(0.25)
    expect(archBonus(state)).toBe(0.1)
    expect(rewardBonus(state)).toBeCloseTo(0.1 + 2 * endgameRules.prosperity.bonusPerRank)
  })
})

describe('late enhancement and options', () => {
  it('takes heroic and legendary gear past +3 to +10, at a growing cost', () => {
    const legend = forgeGear(recipeById('legend.blade')!, 'l')
    const rare = forgeGear(recipeById('flame.blade')!, 'r')
    expect(enhanceLimit(legend)).toBe(smithRules.lateEnhance.max)
    expect(enhanceLimit(rare)).toBe(smithRules.enhanceMax)
    const at3 = { ...legend, enhance: 3 }
    const at5 = { ...legend, enhance: 5 }
    expect(enhanceCostFor(at5).flame).toBeGreaterThan(enhanceCostFor(at3).flame!)
    const state = town(10, { buildings: { ...freshState(5, now).buildings, smith: 5 }, stash: [at3] })
    const started = reduce(state, { type: 'enhance', gearId: 'l', now })
    expect(started.smith?.kind).toBe('enhance')
    expect(started.vault.flame).toBe(rich.flame - enhanceCostFor(at3).flame!)
    expect(migrate(JSON.parse(JSON.stringify({ ...state, stash: [{ ...legend, enhance: 9 }] })), now).stash[0]?.enhance).toBe(9)
  })

  it('lets valour reroll one option of a stored piece', () => {
    const rare = forgeGear(recipeById('flame.blade')!, 'r', 3)
    const plain = forgeGear(recipeById('fine.blade')!, 'f')
    const state = town(9, { stash: [rare, plain] })
    const set = reduce(state, { type: 'reroll', gearId: 'r', index: 0 })
    expect(set.stash[0]?.options).toHaveLength(2)
    expect(set.stash[0]?.options?.[1]).toEqual(rare.options?.[1])
    expect(set.stash[0]?.options?.[0]?.id).not.toBe(rare.options?.[1]?.id)
    expect(set.vault.valor).toBe(rich.valor - smithRules.optionValor)
    expect(reduce(state, { type: 'reroll', gearId: 'f', index: 0 }).notice).toBe('missing')
    expect(reduce(state, { type: 'reroll', gearId: 'r', index: 2 }).notice).toBe('missing')
  })
})

describe('prosperity', () => {
  it('rises past town level 10 with fame and a growing offering, adding to rewards', () => {
    expect(reduce(town(9), { type: 'prosper' }).notice).toBe('locked')
    const top = town(10)
    expect(reduce(top, { type: 'prosper' }).notice).toBe('promoteFame')
    const ready = { ...top, fame: nextRankFame(top) }
    const risen = reduce(ready, { type: 'prosper' })
    expect(risen.prosperity).toBe(1)
    expect(risen.vault.flame).toBe(rich.flame - (rankOffering(1).flame ?? 0))
    expect(prosperityBonus(risen)).toBe(endgameRules.prosperity.bonusPerRank)
    expect(nextRankFame(risen)).toBeGreaterThan(nextRankFame(top))
  })

  it('opens a version 25 save with no events, monuments or prosperity', () => {
    const old = JSON.parse(JSON.stringify({ ...town(1), version: 25 })) as Record<string, unknown>
    delete old.event
    delete old.monuments
    delete old.prosperity
    const opened = migrate(old, now)
    expect(opened.event).toBeNull()
    expect(opened.monuments).toEqual({})
    expect(opened.prosperity).toBe(0)
    expect(opened.vault.token).toBe(rich.token)
  })
})
