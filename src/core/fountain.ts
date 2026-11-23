import { fountainRules, retirementRules } from './data'
import { createRng } from './rng'
import type { GameState } from './game'

// The lucky fountain in the square (Docs/fountain.md). A wish refills every
// interval up to a cap, offline too; each tap spends one for a little gold,
// and now and then a jackpot.

export type FountainState = {
  // Wishes stored as of chargedAt.
  wishes: number
  // When the wish in progress started filling.
  chargedAt: number
  nonce: number
  made: number
  last: { gold: number; jackpot: boolean; at: number } | null
  lastJackpot: { gold: number; year: number; season: string } | null
}

export type FountainLevel = (typeof fountainRules.levels)[number]

export function fountainLevel(level: number): FountainLevel {
  const levels = fountainRules.levels
  return levels[Math.max(0, Math.min(levels.length - 1, level - 1))] as FountainLevel
}

export function freshFountain(now: number): FountainState {
  return { wishes: fountainRules.startWishes, chargedAt: now, nonce: 0, made: 0, last: null, lastJackpot: null }
}

// Brings the stored wishes up to `now`, keeping progress on the next one.
export function chargeFountain(fountain: FountainState, level: number, now: number): FountainState {
  const rule = fountainLevel(level)
  // Time never runs backwards for the fountain: an earlier clock fills nothing
  // and moves nothing, so the same stretch can never be charged twice.
  if (now < fountain.chargedAt) {
    return fountain
  }
  if (fountain.wishes >= rule.cap) {
    return fountain.chargedAt === now ? fountain : { ...fountain, wishes: rule.cap, chargedAt: now }
  }
  const gained = Math.floor((now - fountain.chargedAt) / rule.intervalMs)
  if (gained <= 0) {
    return fountain
  }
  const wishes = Math.min(rule.cap, fountain.wishes + gained)
  return { ...fountain, wishes, chargedAt: wishes >= rule.cap ? now : fountain.chargedAt + gained * rule.intervalMs }
}

// An upgrade finishing at `at`: fill at the old level until then, then carry
// the wish in progress over as the same share of the new interval, so the
// new level never counts time spent at the old one.
export function upgradeFountain(fountain: FountainState, from: number, to: number, at: number): FountainState {
  const charged = chargeFountain(fountain, from, at)
  const before = fountainLevel(from)
  const after = fountainLevel(to)
  if (charged.wishes >= before.cap) {
    // Full at the old cap: the new slots start filling now.
    return { ...charged, chargedAt: at }
  }
  const share = Math.min(1, Math.max(0, (at - charged.chargedAt) / before.intervalMs))
  return { ...charged, chargedAt: at - share * after.intervalMs }
}

export function fountainWishes(state: GameState, now: number): number {
  return chargeFountain(state.fountain, state.buildings.fountain, now).wishes
}

// When the next wish arrives, or null when the fountain is full.
export function fountainNextAt(state: GameState, now: number): number | null {
  const level = state.buildings.fountain
  const charged = chargeFountain(state.fountain, level, now)
  const rule = fountainLevel(level)
  return charged.wishes >= rule.cap ? null : charged.chargedAt + rule.intervalMs
}

export function jackpotChance(state: GameState): number {
  const kept = (state.retirees ?? []).some((retiree) => retiree.building === 'fountain')
  return fountainLevel(state.buildings.fountain).jackpotChance + (kept ? retirementRules.bonus.fountain : 0)
}

export function makeWish(state: GameState, requested: number): GameState {
  const now = Math.max(requested, state.fountain.chargedAt)
  const level = state.buildings.fountain
  const charged = chargeFountain(state.fountain, level, now)
  if (charged.wishes < 1) {
    return { ...state, fountain: charged, notice: 'noWish' }
  }
  const rule = fountainLevel(level)
  const rng = createRng(state.seed + 31_337 + charged.nonce * 7919)
  const jackpot = rng.next() < jackpotChance(state)
  const gold = rule.gold * (jackpot ? rule.jackpotMultiplier : 1)
  // Spending a wish from a full fountain starts the next one filling now.
  const chargedAt = charged.wishes >= rule.cap ? now : charged.chargedAt
  return {
    ...state,
    notice: null,
    gold: state.gold + gold,
    fountain: {
      ...charged,
      wishes: charged.wishes - 1,
      chargedAt,
      nonce: charged.nonce + 1,
      made: charged.made + 1,
      last: { gold, jackpot, at: now },
      lastJackpot: jackpot ? { gold, year: state.calendar.year, season: state.calendar.season } : charged.lastJackpot,
    },
  }
}

export function readFountain(value: unknown, now: number): FountainState {
  const base = freshFountain(now)
  if (value == null || typeof value !== 'object') {
    return base
  }
  const record = value as Partial<FountainState>
  const number = (entry: unknown, fallback: number) => (typeof entry === 'number' && Number.isFinite(entry) ? entry : fallback)
  return {
    wishes: Math.max(0, Math.floor(number(record.wishes, base.wishes))),
    chargedAt: number(record.chargedAt, now),
    nonce: Math.max(0, Math.floor(number(record.nonce, 0))),
    made: Math.max(0, Math.floor(number(record.made, 0))),
    last: record.last && typeof record.last.gold === 'number' ? record.last : null,
    lastJackpot: record.lastJackpot && typeof record.lastJackpot.gold === 'number' ? record.lastJackpot : null,
  }
}
