import { describe, expect, it } from 'vitest'
import { fountainRules, retirementRules } from './data'
import { chargeFountain, fountainLevel, fountainNextAt, fountainWishes, freshFountain, jackpotChance } from './fountain'
import { freshState, migrate, reduce, type GameState } from './game'
import { createHero } from './hero'

const now = 1_700_000_000_000
const level1 = fountainLevel(1)

function town(extra: Partial<GameState> = {}): GameState {
  return { ...freshState(4, now), ...extra }
}

describe('lucky fountain', () => {
  it('starts in the square with one wish ready', () => {
    const state = town()
    expect(state.buildings.fountain).toBe(1)
    expect(fountainWishes(state, now)).toBe(fountainRules.startWishes)
  })

  it('pays a little gold per wish and refuses when none is ready', () => {
    const state = town()
    const wished = reduce(state, { type: 'wish', now })
    expect(wished.gold - state.gold).toBe(wished.fountain.last?.jackpot ? level1.gold * level1.jackpotMultiplier : level1.gold)
    expect(wished.fountain.made).toBe(1)
    expect(reduce(wished, { type: 'wish', now }).notice).toBe('noWish')
    expect(reduce(wished, { type: 'wish', now }).gold).toBe(wished.gold)
  })

  it('refills one wish per interval up to the cap, keeping progress on the next', () => {
    const empty = { ...freshFountain(now), wishes: 0 }
    const partway = chargeFountain(empty, 1, now + level1.intervalMs * 2.5)
    expect(partway.wishes).toBe(2)
    expect(partway.chargedAt).toBe(now + level1.intervalMs * 2)
    const full = chargeFountain(empty, 1, now + level1.intervalMs * 100)
    expect(full.wishes).toBe(level1.cap)
    const state = town({ fountain: partway })
    expect(fountainNextAt(state, now + level1.intervalMs * 2.5)).toBe(now + level1.intervalMs * 3)
    expect(fountainNextAt(town({ fountain: full }), now + level1.intervalMs * 100)).toBeNull()
  })

  it('fills while the game is closed, but only to the cap', () => {
    const state = reduce(town({ fountain: { ...freshFountain(now), wishes: 0 } }), { type: 'catchUp', now: now + 3 * 60 * 60 * 1000 })
    expect(state.fountain.wishes).toBe(level1.cap)
  })

  it('starts the next wish filling when one is spent from a full fountain', () => {
    const full = town({ fountain: { ...freshFountain(now - level1.intervalMs * 50), wishes: level1.cap } })
    const at = now + 1234
    const wished = reduce(full, { type: 'wish', now: at })
    expect(wished.fountain.wishes).toBe(level1.cap - 1)
    expect(fountainNextAt(wished, at)).toBe(at + level1.intervalMs)
  })

  it('pays bigger wishes when upgraded', () => {
    const levels = fountainRules.levels
    for (let index = 1; index < levels.length; index += 1) {
      const lower = levels[index - 1]!
      const higher = levels[index]!
      const expected = (rule: typeof lower) => (rule.gold * (1 + rule.jackpotChance * (rule.jackpotMultiplier - 1))) / rule.intervalMs
      expect(expected(higher)).toBeGreaterThan(expected(lower))
      expect(higher.cap).toBeGreaterThanOrEqual(lower.cap)
    }
  })

  it('hits a jackpot about as often as the rules say, and remembers the last one', () => {
    let state = town({ gold: 0 })
    let jackpots = 0
    const tries = 3000
    for (let index = 0; index < tries; index += 1) {
      state = reduce({ ...state, fountain: { ...state.fountain, wishes: 1 } }, { type: 'wish', now })
      if (state.fountain.last?.jackpot) jackpots += 1
    }
    expect(jackpots / tries).toBeGreaterThan(level1.jackpotChance * 0.5)
    expect(jackpots / tries).toBeLessThan(level1.jackpotChance * 1.8)
    expect(state.fountain.lastJackpot?.gold).toBe(level1.gold * level1.jackpotMultiplier)
  })

  it('adds the keeper bonus to the jackpot chance when a retiree runs the fountain', () => {
    const keeper = createHero({ id: 'r', name: 'r', gender: 'male', classId: 'warrior', age: 55, potentials: { str: 9, agi: 9, vit: 9, int: 9, wil: 9, wis: 9 } })
    const state = town({ retirees: [{ hero: keeper, retiredYear: 1, building: 'fountain' }] })
    expect(jackpotChance(state)).toBeCloseTo(level1.jackpotChance + retirementRules.bonus.fountain)
  })

  it('gives older saves a fountain at level 1 with a fresh charge', () => {
    const old = { ...town(), version: 9 } as Record<string, unknown>
    delete old.fountain
    const buildings = { ...(old.buildings as Record<string, number>) }
    delete buildings.fountain
    old.buildings = buildings
    const loaded = migrate(JSON.parse(JSON.stringify(old)), now)
    expect(loaded.buildings.fountain).toBe(1)
    expect(loaded.fountain.wishes).toBe(fountainRules.startWishes)
  })
})
