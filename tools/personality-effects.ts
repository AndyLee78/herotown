// Run: npx tsx tools/personality-effects.ts
import { DEFAULT_TACTICS, runDungeon } from '../src/core/dungeon'
import { familyRules, moraleRules, personalityRules, timeRules, villageRules } from '../src/core/data'
import { partyBonus } from '../src/core/family'
import { freshState, reduce, type GameState } from '../src/core/game'
import { createHero, generateHero } from '../src/core/hero'
import { lowMorale, moraleOf } from '../src/core/morale'
import { afterTrip, affinityScale, PERSONALITY_IDS } from '../src/core/personality'
import { createRng } from '../src/core/rng'
import type { ClassId, Gender, Hero, PersonalityId } from '../src/core/types'
import { starterParties } from './curve'

const hour = 3_600_000
const start = 1_700_000_000_000
const seeds = Array.from({ length: 40 }, (_, index) => index + 1)
const cave = 'hill_cave'

function hero(seed: number, id: string, classId: ClassId, gender: Gender, personality: PersonalityId): Hero {
  return createHero({ ...generateHero(createRng(seed), id, 0, 0.5, classId), age: 28, gender, personality, level: 16, training: 15 })
}

function fixture(seed: number, roster: Hero[], partyIds = roster.map(({ id }) => id)): GameState {
  const base = freshState(seed, start)
  const town = { ...base, roster, gold: 10_000, cleared: [cave], buildings: { ...base.buildings, house: 2, guild: 1 } }
  return partyIds.reduce((state, id) => reduce(state, { type: 'add', id }), town)
}

function advance(state: GameState, target: number): GameState {
  while (state.lastTickAt < target) {
    state = reduce(state, { type: 'catchUp', now: Math.min(target, state.lastTickAt + timeRules.maxOfflineMs) })
  }
  return state
}

function send(state: GameState): GameState {
  const sent = reduce(state, { type: 'depart', presetId: state.presetId, confirm: true, now: state.lastTickAt })
  if (!sent.expeditions[0]) throw new Error(`Could not start trial trip: ${sent.notice}`)
  return sent
}

function returnHome(state: GameState): GameState {
  return advance(state, state.expeditions[0]!.returnAt)
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted.length ? +((sorted[Math.floor((sorted.length - 1) / 2)]! + sorted[Math.floor(sorted.length / 2)]!) / 2).toFixed(2) : '—'
}

function firstMarriage(seed: number, personalities: [PersonalityId, PersonalityId]) {
  let state = fixture(seed, [hero(seed, 'a', 'warrior', 'male', personalities[0]), hero(seed, 'b', 'cleric', 'female', personalities[1])])
  for (let season = 0; season < 12; season += 1) {
    for (const offset of [2, 6, 10, 14, 18]) {
      state = advance(state, start + season * timeRules.seasonMs + offset * hour)
      state = returnHome(send(state))
    }
    state = advance(state, start + (season + 1) * timeRules.seasonMs)
    const proposal = state.proposals[0]
    if (proposal) {
      state = reduce(state, { type: 'acceptProposal', a: proposal.a, b: proposal.b, now: state.lastTickAt })
      if (state.roster[0]?.spouseId) return (state.lastTickAt - start) / hour
    }
  }
  return undefined
}

function anxiety(personality: PersonalityId) {
  const member = hero(5, 'a', 'warrior', 'male', personality)
  let state = fixture(5, [member])
  let below = 0
  let autoBlocked = 0
  let firstLow: number | undefined
  const values = []
  for (let loss = 1; loss <= 6; loss += 1) {
    state = advance(state, state.lastTickAt + villageRules.auto.runMs)
    state = afterTrip(state, [member.id], false)
    const next = state.roster[0]!
    if (lowMorale(next)) {
      below += 1
      firstLow ??= loss
    }
    const trial = { ...state, auto: { ...state.auto, enabled: true } }
    const ran = advance(trial, state.lastTickAt + villageRules.auto.runMs)
    if ((ran.auto.nonce ?? 0) === (trial.auto.nonce ?? 0)) autoBlocked += 1
    values.push(+moraleOf(next).toFixed(1))
  }
  return { personality, 'morale after losses 1–6': values.join(' / '), firstLow: firstLow ?? '—', 'low checkpoints': below, 'auto exclusions / 6': autoBlocked }
}

function resentment(seed: number, existingFriends: boolean, rotate: boolean) {
  const roster = [hero(seed, 'a', 'warrior', 'male', 'social'), hero(seed, 'b', 'cleric', 'female', 'gentle'), hero(seed, 'c', 'archer', 'male', 'ambitious')]
  let state = fixture(seed, roster, ['a', 'b'])
  if (existingFriends) state = { ...state, bonds: [{ a: 'a', b: 'c', affinity: familyRules.friendAt + 5 }] }
  let incidents = 0
  let moraleLost = 0
  const initial = moraleOf(roster[2]!)
  for (let trip = 0; trip < 30; trip += 1) {
    state = advance(state, start + trip * hour / 3)
    if (rotate && trip % 3 === 2) state = reduce(state, { type: 'add', id: 'c' })
    const before = state.roster.find(({ id }) => id === 'c')!
    const sent = send(state)
    const after = sent.roster.find(({ id }) => id === 'c')!
    // Count threshold resets as incidents even when morale is already zero.
    const fired = (before.benched ?? 0) === personalityRules.resentment.benchedTrips - 1 && after.benched == null
    if (fired) incidents += 1
    moraleLost += moraleOf(before) - moraleOf(after)
    state = returnHome(sent)
    if (rotate && trip % 3 === 2) state = reduce(state, { type: 'remove', id: 'c' })
  }
  return { incidents, moraleLost, finalDelta: moraleOf(state.roster.find(({ id }) => id === 'c')!) - initial }
}

const distributions = [
  { name: 'compatible', a: 'social', b: 'gentle' },
  { name: 'clashing', a: 'hotheaded', b: 'timid' },
] as const
console.log('Marriage with five cave trips per season, auto-accepting the first proposal. Forty paired seeds, up to 12 seasons.')
console.table(distributions.map(({ name, a, b }) => {
  const times = seeds.map((seed) => firstMarriage(seed, [a, b]))
  const married = times.filter((value): value is number => value != null)
  return { name, affinity: +affinityScale(hero(1, 'a', 'warrior', 'male', a), hero(1, 'b', 'cleric', 'female', b)).toFixed(3), wed: married.length, 'median hours': median(married), times }
}).map(({ times, ...row }, index, rows) => {
  const remaining = rows[0]!.times.flatMap((fast, i) => fast != null && times[i] != null ? [times[i]! - fast] : [])
  return { ...row, 'paired delay vs compatible': index > 0 ? median(remaining) : 0 }
}))

console.log(`Anxiety: six injected defeat settlements, ${villageRules.auto.runMs / 60_000}m apart, no injuries. Each checkpoint probes a real auto catch-up.`)
console.table(PERSONALITY_IDS.map(anxiety))

console.log('Resentment: one main party, 30 manual cave trips at 20-minute intervals, 40 seeds per case.')
console.table([
  { name: 'new acquaintance', friends: false, rotate: false, proposed: false },
  { name: 'friend left home', friends: true, rotate: false, proposed: false },
  { name: 'friend rotates every third', friends: true, rotate: true, proposed: false },
  { name: 'friend left home, proposed 5/8', friends: true, rotate: false, proposed: true },
].map(({ name, friends, rotate, proposed }) => {
  const rules = personalityRules.resentment
  const original = { ...rules }
  let samples: ReturnType<typeof resentment>[]
  try {
    if (proposed) Object.assign(rules, { benchedTrips: 5, loss: 8 })
    samples = seeds.map((seed) => resentment(seed, friends, rotate))
  } finally {
    Object.assign(rules, original)
  }
  return {
    name,
    'median incidents / 30': median(samples.map(({ incidents }) => incidents)),
    'departures with incident %': +(100 * samples.reduce((sum, row) => sum + row.incidents, 0) / (seeds.length * 30)).toFixed(2),
    'median morale lost at departure': median(samples.map(({ moraleLost }) => moraleLost)),
    'median final morale change': median(samples.map(({ finalDelta }) => finalDelta)),
  }
}))

const parties = starterParties(40)
const setups = [{ name: 'neutral', personality: 'loner' }, { name: '+5%', personality: 'social' }, { name: '−6%', personality: 'ambitious' }] as const
console.log('Combat: 40 party samples × 10 identical battle seeds per condition, with only party fit changed.')
console.table([
  { dungeon: 'abandoned_mine', level: 3 },
  { dungeon: 'abandoned_mine', level: 4 },
  { dungeon: 'barrow', level: 6 },
  { dungeon: 'sunken_crypt', level: 8 },
].map(({ dungeon, level }) => {
  const rates = setups.map(({ name, personality }) => {
    let wins = 0
    for (const [index, baseParty] of parties.entries()) {
      const party = baseParty.map(({ hero, row }) => ({ hero: createHero({ ...hero, level, training: level - 1, morale: moraleRules.base, personality }), row }))
      const state = fixture(1, party.map(({ hero }) => hero))
      const bonuses = partyBonus(state, party.map(({ hero }) => hero.id))
      for (let attempt = 1; attempt <= 10; attempt += 1) {
        const result = runDungeon(party.map((member) => ({ ...member, bonus: bonuses[member.hero.id] })), dungeon, DEFAULT_TACTICS, index * 10 + attempt)
        if (result.ok && result.report.victory) wins += 1
      }
    }
    return [name, 100 * wins / (parties.length * 10)] as const
  })
  const baseline = rates[0]![1]
  return { dungeon, level, ...Object.fromEntries(rates), '+5 Δ pp': +(rates[1]![1] - baseline).toFixed(2), '−6 Δ pp': +(rates[2]![1] - baseline).toFixed(2) }
}))
