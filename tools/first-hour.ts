// Plays the first hours like a simple player would, to catch dead ends in
// the early flow. Run: npx tsx tools/first-hour.ts [minutes] [seed,seed,...]
import { dungeons, progression, villageRules } from '../src/core/data'
import { busyHeroIds, dungeonUnlocked, freshState, presetById, reduce, townLevel, type BuildingId, type GameState } from '../src/core/game'
import { guideStatus } from '../src/core/guide'
import { canDeploy } from '../src/core/hero'
import type { ClassId, Hero } from '../src/core/types'

const isHurt = (hero: Hero) => hero.condition === 'injured' || hero.condition === 'critical'
const essentialRoles = ['warrior', 'cleric'] as const
const hireOrder: ClassId[] = [...essentialRoles, 'rogue', 'archer', 'mage', 'bard', 'dancer']

function hasLivingRole(state: GameState, role: ClassId): boolean {
  return state.roster.some((hero) => hero.classId === role && hero.condition !== 'dead')
}

function fillParty(state: GameState): GameState {
  for (const role of essentialRoles) {
    const current = selectedHeroes(state)
    const recruit = state.roster.find((hero) => hero.classId === role && canDeploy(hero))
    if (!recruit || current.some((hero) => hero.classId === role)) continue
    const slots = presetById(state, state.presetId)?.slots ?? []
    if (slots.length >= 5) {
      const replace = slots.find((slot) => !current.some((hero) => hero.id === slot.id))
        ?? [...current].reverse().find((hero) => !essentialRoles.some((essential) => essential === hero.classId))
      if (replace) state = reduce(state, { type: 'remove', id: replace.id })
    }
    state = reduce(state, { type: 'add', id: recruit.id })
  }
  for (const hero of state.roster.filter(canDeploy)) {
    state = reduce(state, { type: 'add', id: hero.id })
  }
  return state
}

function selectedHeroes(s: GameState): Hero[] {
  const slots = presetById(s, s.presetId)?.slots ?? []
  return s.roster.filter((hero) => slots.some((slot) => slot.id === hero.id) && canDeploy(hero))
}

function averageLevel(heroes: Hero[]): number | undefined {
  return heroes.length ? heroes.reduce((sum, hero) => sum + hero.level, 0) / heroes.length : undefined
}

// The hardest open dungeon the party is levelled for.
const difficultyOrder = [...dungeons].sort((a, b) => a.recommendedLevel - b.recommendedLevel || a.tier - b.tier)
const difficulty = new Map(difficultyOrder.map((dungeon, index) => [dungeon.id, index]))

type Training = { dungeon: string; targetLevel: number }

function pickDungeon(state: GameState, training: Training | undefined): string {
  if (state.gold < progression.hireCost && !hasLivingRole(state, 'cleric')) {
    return difficultyOrder.find((dungeon) => state.cleared.includes(dungeon.id))?.id ?? 'hill_cave'
  }
  if (training) return training.dungeon
  const level = averageLevel(selectedHeroes(state)) ?? 1
  return [...difficultyOrder].reverse().find((dungeon) => dungeonUnlocked(state, dungeon.id) && dungeon.recommendedLevel <= level)?.id ?? 'hill_cave'
}

function simulate(minutes: number, seed: number) {
  const start = 1_700_000_000_000
  let state = freshState(seed, start)
  let now = start
  const log: string[] = []
  const note = (text: string) => log.push(`${String(Math.round((now - start) / 60_000)).padStart(3)}m  ${text}`)

  let lastTown = 1
  let lastLevel = 1
  let training: Training | undefined
  let lastLostDungeon: string | undefined
  let sameDungeonLosses = 0
  let losingStreak = 0
  let maxLosingStreak = 0
  let lowGoldSince: number | undefined
  let maxLowGoldMs = 0
  const recentWins: string[] = []
  function recordGold() {
    if (lowGoldSince != null) maxLowGoldMs = Math.max(maxLowGoldMs, now - lowGoldSince)
    lowGoldSince = state.gold < progression.hireCost ? lowGoldSince ?? now : undefined
  }
  while (now - start < minutes * 60_000) {
    const missing = essentialRoles.filter((role) => !hasLivingRole(state, role))
    const wanted = [...state.visitors].sort((a, b) =>
      Number(missing.some((role) => role === b.classId)) - Number(missing.some((role) => role === a.classId))
      || hireOrder.indexOf(a.classId) - hireOrder.indexOf(b.classId),
    )
    for (const visitor of wanted) {
      const fillsGap = essentialRoles.some((role) => visitor.classId === role && !hasLivingRole(state, role))
      if (state.roster.length >= 5 && !fillsGap) continue
      const before = state.roster.length
      state = reduce(state, { type: 'hire', id: visitor.id, now })
      if (state.roster.length > before) note(`hire ${visitor.classId} (gold ${state.gold})`)
    }
    if (state.expeditions.length === 0) state = fillParty(state)
    // Treat anyone hurt.
    for (const hero of state.roster) {
      if (isHurt(hero) && hero.treatAt == null && !busyHeroIds(state).has(hero.id)) {
        state = reduce(state, { type: 'treat', id: hero.id, now })
      }
    }
    // Revive the fallen when we can.
    for (const hero of state.roster) {
      if (hero.condition === 'dead' && hero.resurrectAt == null) {
        const revived = reduce(state, { type: 'revive', id: hero.id, now })
        if (!revived.notice) { state = revived; note('revive ' + hero.classId) }
      }
    }
    // Claim guide rewards.
    while (guideStatus(state).done) {
      note(`guide: ${guideStatus(state).step?.id}`)
      state = reduce(state, { type: 'claimGuide' })
    }
    // Build the cheapest thing we can afford.
    if (!state.construction) {
      const options = villageRules.buildings
        .map((building) => ({ id: building.id as BuildingId, cost: building.levels.find((entry) => entry.level === state.buildings[building.id as BuildingId] + 1) }))
        .filter((entry) => entry.cost)
        .sort((a, b) => (a.cost?.gold ?? 0) - (b.cost?.gold ?? 0))
      for (const option of options) {
        const tried = reduce(state, { type: 'build', id: option.id, now })
        if (tried.construction) {
          state = tried
          note(`build ${option.id} → lv${state.buildings[option.id] + 1}`)
          break
        }
      }
    }
    // Send the party out whenever it is home.
    const selected = selectedHeroes(state)
    if (training && (averageLevel(selected) ?? 0) >= training.targetLevel) {
      note(`training complete at ${training.dungeon}`)
      training = undefined
    }
    if (state.expeditions.length === 0 && selected.length > 0 && !selected.some(isHurt)) {
      const dungeon = pickDungeon(state, training)
      state = reduce(state, { type: 'dungeon', id: dungeon })
      const sent = reduce(state, { type: 'depart', presetId: state.presetId, confirm: true, now })
      if (sent.expeditions.length > state.expeditions.length) {
        state = sent
      } else if (sent.notice && !log[log.length - 1]?.endsWith(sent.notice)) {
        note(`cannot depart: ${sent.notice}`)
      }
    }
    recordGold()
    const lastReturn = state.history[0]?.finishedAt
    now = Math.min(now + 15_000, start + minutes * 60_000)
    state = reduce(state, { type: 'catchUp', now })
    recordGold()
    const report = state.history[0]
    if (report && report.finishedAt !== lastReturn) {
      const dungeonId = report.dungeonId ?? state.dungeonId
      if (report.victory) {
        recentWins.unshift(dungeonId)
        losingStreak = 0
        lastLostDungeon = undefined
        sameDungeonLosses = 0
      } else {
        note(`LOST ${dungeonId} (${report.defeatReason})`)
        losingStreak += 1
        maxLosingStreak = Math.max(maxLosingStreak, losingStreak)
        sameDungeonLosses = lastLostDungeon === dungeonId ? sameDungeonLosses + 1 : 1
        lastLostDungeon = dungeonId
        if (sameDungeonLosses === 2 && !training) {
          const lostRank = difficulty.get(dungeonId) ?? 0
          const fallback = recentWins.find((id) => (difficulty.get(id) ?? Infinity) < lostRank) ?? 'hill_cave'
          const targetLevel = (averageLevel(selectedHeroes(state)) ?? 1) + 1
          training = { dungeon: fallback, targetLevel }
          note(`train at ${fallback} until party Lv ${targetLevel.toFixed(2)}`)
        }
      }
    }
    const level = townLevel(state.fame).level
    if (level > lastTown) {
      note(`town level ${level}`)
      lastTown = level
    }
    const avg = Math.floor(averageLevel(selectedHeroes(state)) ?? 0)
    if (avg > lastLevel) {
      note(`party level ${avg} · next dungeon ${pickDungeon(state, training)} · gold ${state.gold}`)
      lastLevel = avg
    }
  }
  const wins = state.history.filter((report) => report.victory).length
  const party = selectedHeroes(state)
  return { seed, state, log, wins, maxLosingStreak, maxLowGoldMs, partyLevel: averageLevel(party), ready: party.filter((hero) => !isHurt(hero)).length, partySize: party.length }
}

function summarize(values: number[]): string {
  if (values.length === 0) return 'n/a'
  const sorted = [...values].sort((a, b) => a - b)
  const lower = sorted[Math.floor((sorted.length - 1) / 2)]!
  const upper = sorted[Math.floor(sorted.length / 2)]!
  return `median ${((lower + upper) / 2).toFixed(2)}, min ${sorted[0]!.toFixed(2)}, max ${sorted.at(-1)!.toFixed(2)}`
}

const minutes = Number(process.argv[2] ?? 60)
const seedArgs = (process.argv[3] ?? '11').split(',').map((seed) => seed.trim())
const seeds = seedArgs.map(Number)
if (!Number.isFinite(minutes) || minutes <= 0 || seedArgs.some((seed, index) => !/^\d+$/.test(seed) || !Number.isSafeInteger(seeds[index]))) {
  throw new Error('Usage: npx tsx tools/first-hour.ts [positive minutes] [seed,seed,...]')
}
const results = seeds.map((seed) => simulate(minutes, seed))
const displayLevel = (level: number | undefined) => level?.toFixed(1) ?? 'n/a'
if (results.length === 1) {
  const { state, log, wins, partyLevel, ready, partySize, maxLosingStreak } = results[0]!
  console.log(log.join('\n'))
  console.log(`\nafter ${minutes}m: gold ${state.gold}, party Lv ${displayLevel(partyLevel)} (${ready}/${partySize} ready), cleared ${state.cleared.join(', ')}, buildings ${JSON.stringify(state.buildings)}`)
  console.log(`last ${state.history.length} trips: ${wins} wins`)
  console.log(`max losing streak: ${maxLosingStreak}`)
} else {
  for (const { seed, state, wins, partyLevel, ready, partySize, maxLosingStreak, maxLowGoldMs } of results) {
    console.log(`seed ${seed}: party Lv ${displayLevel(partyLevel)} (${ready}/${partySize} ready) · cleared ${state.cleared.length} · recent wins ${wins}/${state.history.length} · max losing streak ${maxLosingStreak} · low gold ${(maxLowGoldMs / 60_000).toFixed(2)}m`)
  }
  const levels = results.flatMap(({ partyLevel }) => partyLevel == null ? [] : [partyLevel])
  console.log(`party Lv: ${summarize(levels)} (${levels.length}/${results.length} seeds)`)
  console.log(`cleared dungeons: ${summarize(results.map(({ state }) => state.cleared.length))}`)
  console.log(`recent wins: ${summarize(results.map((result) => result.wins))}`)
  console.log(`max losing streak: ${summarize(results.map((result) => result.maxLosingStreak))}`)
}
console.log(`seeds below hire cost for over 30m: ${results.filter((result) => result.maxLowGoldMs > 30 * 60_000).length}/${results.length}`)
