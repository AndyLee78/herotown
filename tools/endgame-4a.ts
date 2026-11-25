// Run: npx tsx tools/endgame-4a.ts
import { classById, endgameRules, lifeRules, specialDungeons, villageRules } from '../src/core/data'
import { DEFAULT_TACTICS, runDungeon } from '../src/core/dungeon'
import { freshState, presetById, reduce, type GameState } from '../src/core/game'
import { forgeGear, recipeById } from '../src/core/gear'
import { canDeploy, createHero } from '../src/core/hero'
import { ESSENCES, todayElement, trialsLeft } from '../src/core/trials'
import type { PartyMember } from '../src/core/types'
import { starterParties } from './curve'
import { villageCheckpoint } from './village-balance'

const hour = 3_600_000
const day = 24 * hour
const start = new Date(2026, 10, 22, 0).getTime() // Sunday, in the game's local calendar.
const townFame = (level: number) => villageRules.levels.find((entry) => entry.level === level)!.fame
const samples = starterParties(20)
const trials = specialDungeons.filter(({ special }) => special === 'weekday')
const grades = ['starter', 'fine', 'rare'] as const
type Grade = typeof grades[number]

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted.length ? Number(((sorted[Math.floor((sorted.length - 1) / 2)]! + sorted[Math.floor(sorted.length / 2)]!) / 2).toFixed(2)) : 0
}

function withLevel(members: PartyMember[], level: number, grade: Grade = 'starter'): PartyMember[] {
  return members.map(({ hero, row }) => ({
    row,
    hero: createHero({
      ...hero,
      level,
      training: level - 1,
      ...(grade === 'starter' ? {} : { gear: [
        forgeGear(recipeById(grade === 'rare' ? 'flame.blade' : 'fine.blade')!, `${hero.id}-blade`),
        forgeGear(recipeById('fine.mail')!, `${hero.id}-mail`),
      ] }),
    }),
  }))
}

console.log('Weekday trials: 20 starter parties × 5 paired battle seeds per level and dungeon; no consumables.')
console.table([10, 12, 14, 15, 16, 18, 20].map((level) => ({
  level,
  ...Object.fromEntries(trials.map(({ id }) => {
    let wins = 0
    for (const [index, members] of samples.entries()) {
      const party = withLevel(members, level)
      for (let attempt = 1; attempt <= 5; attempt += 1) {
        const result = runDungeon(party, id, DEFAULT_TACTICS, index * 5 + attempt)
        if (result.ok && result.report.victory) wins += 1
      }
    }
    return [id.replace('trial_', ''), wins]
  })),
})))

function send(state: GameState, id: string, now: number): GameState {
  const chosen = reduce(state, { type: 'dungeon', id })
  return reduce(chosen, { type: 'depart', presetId: chosen.presetId, confirm: true, now })
}

const sampled = Array.from({ length: 20 }, (_, index) => villageCheckpoint(index + 1, endgameRules.weekday.unlockTown))
  .flatMap((state) => state ? [state] : [])
const averageLevels = sampled.map((state) => {
  const ids = new Set(presetById(state, state.presetId)?.slots.map(({ id }) => id))
  const party = state.roster.filter((hero) => ids.has(hero.id) && canDeploy(hero))
  return party.reduce((sum, hero) => sum + hero.level, 0) / Math.max(1, party.length)
})
console.log(`Actual Lv6 unlock snapshots: ${sampled.length}/20, average party level median ${median(averageLevels)}.`)
console.table(trials.map(({ id }) => {
  let attempted = 0
  let won = 0
  for (let state of sampled) {
    const lastReturn = Math.max(state.lastTickAt, ...state.expeditions.map(({ returnAt }) => returnAt))
    if (lastReturn > state.lastTickAt) state = reduce(state, { type: 'catchUp', now: lastReturn })
    // Sunday makes every element testable from the same unlock snapshot.
    const sent = send({ ...state, trials: null }, id, start)
    const expedition = sent.expeditions.at(-1)
    if (!sent.notice && expedition) {
      attempted += 1
      if (expedition.report.victory) won += 1
    }
  }
  return { id, attempted, wins: won, 'win %': attempted ? Number((100 * won / attempted).toFixed(2)) : '—' }
}))

function startingParty(seed: number, level: number, grade: Grade): GameState {
  const root = freshState(seed, start)
  const party = withLevel(samples[(seed - 1) % samples.length]!, level, grade)
  const state = { ...root, roster: party.map(({ hero }) => hero), fame: townFame(endgameRules.abyss.unlockTown) }
  return party.reduce((next, { hero }) => reduce(next, { type: 'add', id: hero.id }), state)
}

function dayLoop(state: GameState, date: number, difficulty?: number) {
  let abyssRuns = 0
  let weekdayAttempts = 0
  let weekdayWins = 0
  for (let now = date; now < date + 16 * hour; now += hour / 2) {
    state = reduce(state, { type: 'catchUp', now })
    if (state.expeditions.length > 0) continue
    const preset = new Set(presetById(state, state.presetId)?.slots.map(({ id }) => id))
    const members = state.roster.filter((hero) => preset.has(hero.id) && canDeploy(hero))
    const ready = members.length >= 3 && members.some(({ classId }) => classById(classId).role === 'healer')
      && members.some(({ classId }) => classById(classId).role === 'tank')
      && members.every((hero) => hero.condition !== 'injured' && hero.condition !== 'critical' && hero.fatigue < lifeRules.fatigue.tiredAt)
    if (!ready) continue
    const element = todayElement(now)
    const trial = difficulty != null && trialsLeft(state, now) > 0
    const id = trial ? `trial_${element === 'choice' ? 'flame' : element}_${difficulty}` : 'abyss'
    const sent = send(state, id, now)
    const expedition = sent.expeditions.at(-1)
    if (!sent.notice && expedition) {
      if (trial) { weekdayAttempts += 1; if (expedition.report.victory) weekdayWins += 1 }
      else abyssRuns += 1
      state = sent
    }
  }
  state = reduce(state, { type: 'catchUp', now: date + 16 * hour })
  return { state, abyssRuns, weekdayAttempts, weekdayWins }
}

console.log('Abyss: 16-hour day, checks every 30 minutes, fresh trial party and no consumables; stat growth and injuries persist.')
const abyssSetups = [
  { level: 12, grade: 'starter' }, { level: 15, grade: 'starter' }, { level: 15, grade: 'fine' },
  { level: 18, grade: 'starter' }, { level: 18, grade: 'fine' }, { level: 22, grade: 'rare' },
] as const
console.table(abyssSetups.map(({ level, grade }) => {
  const runs = samples.map((_, index) => dayLoop(startingParty(index + 1, level, grade), start))
  const checkpoint = runs.map(({ state }) => state.abyss.checkpoint)
  return {
    level, grade, runs: median(runs.map(({ abyssRuns }) => abyssRuns)), checkpoint: median(checkpoint),
    'checkpoint min/max': `${Math.min(...checkpoint)}/${Math.max(...checkpoint)}`,
    best: median(runs.map(({ state }) => state.abyss.best)),
    shards: median(runs.map(({ state }) => state.vault.abyss)),
    fame: median(runs.map(({ state }) => state.fame - townFame(endgameRules.abyss.unlockTown))),
  }
}))

console.log('Weekly income: seven 16-hour days, trials use the first three available departures each day, then abyss. No consumables or replacement recruits.')
console.table([1, 2, 3].map((difficulty) => {
  const weeks = samples.map((_, index) => {
    let state = startingParty(index + 1, 18, 'fine')
    let attempts = 0
    let wins = 0
    let firstDay = state.vault
    for (let i = 0; i < 7; i += 1) {
      const result = dayLoop(state, start + i * day, difficulty)
      state = result.state
      attempts += result.weekdayAttempts
      wins += result.weekdayWins
      if (i === 0) firstDay = state.vault
    }
    return { state, attempts, wins, firstDay }
  })
  const total = (vault: GameState['vault']) => ESSENCES.reduce((sum, element) => sum + vault[element], 0)
  return {
    difficulty, 'attempts/week': median(weeks.map(({ attempts }) => attempts)), 'wins/week': median(weeks.map(({ wins }) => wins)),
    'essence day 1': median(weeks.map(({ firstDay }) => total(firstDay))),
    'essence/week': median(weeks.map(({ state }) => total(state.vault))),
    'essence/day avg': median(weeks.map(({ state }) => total(state.vault) / 7)),
    'flame/frost/light week': ESSENCES.map((element) => median(weeks.map(({ state }) => state.vault[element]))).join('/'),
    'shards day 1': median(weeks.map(({ firstDay }) => firstDay.abyss)),
    'shards/week': median(weeks.map(({ state }) => state.vault.abyss)),
    'shards/day avg': median(weeks.map(({ state }) => state.vault.abyss / 7)),
  }
}))
