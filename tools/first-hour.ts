// Plays the first hours like a simple player would, to catch dead ends in
// the early flow. Run: npx tsx tools/first-hour.ts [minutes] [seed,seed,...] [--fountain=off|ready|5min|compare]
import { dungeons, potionById, progression, villageRules } from '../src/core/data'
import { fountainWishes } from '../src/core/fountain'
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
const marshId = 'venom_marsh'
const marshSupplies = { antidote: 4, heal: 2 } as const
const workshop = villageRules.buildings.find(({ id }) => id === 'alchemy')!
const workshopCost = workshop.levels.find(({ level }) => level === 1)!

type Training = { dungeon: string; targetLevel: number }

function pickDungeon(state: GameState, training: Training | undefined): string {
  if (state.gold < progression.hireCost && !hasLivingRole(state, 'cleric')) {
    return difficultyOrder.find((dungeon) => state.cleared.includes(dungeon.id))?.id ?? 'hill_cave'
  }
  if (training) return training.dungeon
  const level = averageLevel(selectedHeroes(state)) ?? 1
  return [...difficultyOrder].reverse().find((dungeon) => dungeonUnlocked(state, dungeon.id) && dungeon.recommendedLevel <= level)?.id ?? 'hill_cave'
}

const fountainModes = ['off', 'ready', '5min'] as const
type FountainMode = typeof fountainModes[number]
type Income = { fountain: number; expedition: number; guide: number; jackpots: number }
const checkpoints = [60, 180]

function simulate(minutes: number, seed: number, fountain: FountainMode, keepFountainAtLevelOne = false) {
  const firstClear: Record<string, number> = {}
  const start = 1_700_000_000_000
  let state = freshState(seed, start)
  let now = start
  let nextFountainCheck = start
  const income: Income = { fountain: 0, expedition: 0, guide: 0, jackpots: 0 }
  let marshTrips = 0
  const incomeAt: Record<number, Income> = {}
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
    if (fountain !== 'off' && now >= nextFountainCheck) {
      while (fountainWishes(state, now) > 0) {
        state = reduce(state, { type: 'wish', now })
        const wish = state.fountain.last!
        income.fountain += wish.gold
        if (wish.jackpot) income.jackpots += 1
      }
      if (fountain === '5min') nextFountainCheck += 5 * 60_000
    }
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
      const goldBefore = state.gold
      state = reduce(state, { type: 'claimGuide' })
      income.guide += state.gold - goldBefore
    }
    const prepareMarsh = dungeonUnlocked(state, marshId)
    const needsWorkshop = prepareMarsh && state.buildings.alchemy === 0 && townLevel(state.fame).level >= workshop.unlockLevel
    // Reserve money and materials for the workshop once the route to the marsh is open.
    if (!state.construction) {
      const options = villageRules.buildings
        .filter(({ id }) => needsWorkshop ? id === 'alchemy' : id !== 'alchemy')
        .filter((building) => building.id !== 'fountain' || (fountain !== 'off' && !keepFountainAtLevelOne))
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
    const nextPotion = (['antidote', 'heal'] as const).find((id) => (state.potions[id] ?? 0) < marshSupplies[id])
    if (prepareMarsh && state.buildings.alchemy > 0 && nextPotion && !state.alchemy && state.expeditions.length === 0) {
      state = reduce(state, { type: 'brew', potionId: nextPotion, now })
      if (state.alchemy) note(`brew ${nextPotion}`)
    }
    // Send the party out whenever it is home.
    const selected = selectedHeroes(state)
    if (training && (averageLevel(selected) ?? 0) >= training.targetLevel) {
      note(`training complete at ${training.dungeon}`)
      training = undefined
    }
    if (state.expeditions.length === 0 && selected.length > 0 && !selected.some(isHurt)) {
      let dungeon: string | undefined = pickDungeon(state, training)
      if (dungeon === marshId && (state.buildings.alchemy === 0 || nextPotion)) {
        const recipe = nextPotion ? potionById(nextPotion) : undefined
        if (state.buildings.alchemy === 0) {
          if (state.construction?.id === 'alchemy') dungeon = undefined
          else if (state.materials.wood < workshopCost.wood) dungeon = 'hill_cave'
          else if (state.materials.stone < workshopCost.stone) dungeon = 'moss_path'
          else if (state.materials.iron < workshopCost.iron) dungeon = 'abandoned_mine'
          else dungeon = state.cleared[0] ?? 'hill_cave'
        } else if (state.alchemy) {
          dungeon = undefined
        } else if (recipe && state.materials.herb < recipe.herb) {
          dungeon = 'moss_path'
        } else {
          dungeon = state.cleared[0] ?? 'hill_cave'
        }
      }
      if (dungeon) {
        for (const [potionId, count] of Object.entries(marshSupplies) as [keyof typeof marshSupplies, number][]) {
          const wanted = dungeon === marshId ? count : 0
          if ((presetById(state, state.presetId)?.supplies?.[potionId] ?? 0) !== wanted) {
            state = reduce(state, { type: 'supplies', potionId, count: wanted })
          }
        }
        state = reduce(state, { type: 'dungeon', id: dungeon })
        const sent = reduce(state, { type: 'depart', presetId: state.presetId, confirm: true, now })
        if (sent.expeditions.length > state.expeditions.length) {
          state = sent
          if (dungeon === marshId) {
            marshTrips += 1
            note(`marsh departure · supplies ${JSON.stringify(sent.expeditions.at(-1)?.supplies)}`)
          }
        } else if (sent.notice && !log[log.length - 1]?.endsWith(sent.notice)) {
          note(`cannot depart: ${sent.notice}`)
        }
      }
    }
    recordGold()
    const clearedBefore = state.cleared.length
    const lastReturn = state.history[0]?.finishedAt
    // Five seconds divides every fountain interval, so all modes use the same clock.
    now = Math.min(now + 5_000, start + minutes * 60_000)
    state = reduce(state, { type: 'catchUp', now })
    recordGold()
    const report = state.history[0]
    if (report && report.finishedAt !== lastReturn) {
      income.expedition += report.gained?.gold ?? 0
      const dungeonId = report.dungeonId ?? state.dungeonId
      for (const id of state.cleared.slice(clearedBefore)) firstClear[id] = ((report.finishedAt ?? now) - start) / 60_000
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
    const elapsedMinutes = (now - start) / 60_000
    if (checkpoints.includes(elapsedMinutes) || elapsedMinutes === minutes) incomeAt[elapsedMinutes] = { ...income }
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
  return { firstClear, incomeAt, seed, state, log, wins, marshTrips, maxLosingStreak, maxLowGoldMs, partyLevel: averageLevel(party), ready: party.filter((hero) => !isHurt(hero)).length, partySize: party.length }
}

function median(sorted: number[]): number {
  return (sorted[Math.floor((sorted.length - 1) / 2)]! + sorted[Math.floor(sorted.length / 2)]!) / 2
}

function summarize(values: number[]): string {
  if (values.length === 0) return 'n/a'
  const sorted = [...values].sort((a, b) => a - b)
  return `median ${median(sorted).toFixed(2)}, min ${sorted[0]!.toFixed(2)}, max ${sorted.at(-1)!.toFixed(2)}`
}

const args = process.argv.slice(2)
const fountainArg = args.find((arg) => arg.startsWith('--fountain='))?.slice('--fountain='.length) ?? 'ready'
const [minutesArg, seedsArg] = args.filter((arg) => !arg.startsWith('--fountain='))
const compare = fountainArg === 'compare'
const fountain = fountainModes.find((mode) => mode === fountainArg)
const minutes = Number(minutesArg ?? (compare ? 180 : 60))
const defaultSeeds = compare ? Array.from({ length: 20 }, (_, index) => index + 1).join(',') : '11'
const seedArgs = (seedsArg ?? defaultSeeds).split(',').map((seed) => seed.trim())
const seeds = seedArgs.map(Number)
if ((!compare && !fountain) || !Number.isFinite(minutes) || minutes <= 0 || (compare && minutes < 180) || seedArgs.some((seed, index) => !/^\d+$/.test(seed) || !Number.isSafeInteger(seeds[index]))) {
  throw new Error('Usage: npx tsx tools/first-hour.ts [positive minutes (compare: at least 180)] [seed,seed,...] [--fountain=off|ready|5min|compare]')
}

type Simulation = ReturnType<typeof simulate>

function incomeSummary(mode: string, at: number, results: Simulation[]) {
  const samples = results.map(({ incomeAt }) => incomeAt[at]!)
  const mid = (values: number[]) => values.length ? Number(median(values.sort((a, b) => a - b)).toFixed(1)) : '—'
  const gross = ({ fountain, expedition, guide }: Income) => fountain + expedition + guide
  return {
    mode, minutes: at, 'gross gold': mid(samples.map(gross)),
    'fountain gold': mid(samples.map((sample) => sample.fountain)),
    'expedition gold': mid(samples.map((sample) => sample.expedition)),
    'fountain % of gross': mid(samples.filter((sample) => gross(sample) > 0).map((sample) => 100 * sample.fountain / gross(sample))),
    'fountain % of expedition': mid(samples.filter((sample) => sample.expedition > 0).map((sample) => 100 * sample.fountain / sample.expedition)),
    jackpots: mid(samples.map((sample) => sample.jackpots)),
  }
}

const order = ['hill_cave', 'moss_path', 'abandoned_mine', 'deep_shaft', 'barrow', 'sunken_crypt', marshId, 'bandit_fort']
function firstClearSummary(results: Simulation[], at: number) {
  return Object.fromEntries(order.map((id) => {
    const times = results.flatMap((result) => {
      const time = result.firstClear[id]
      return time != null && time <= at ? [time] : []
    }).sort((a, b) => a - b)
    return [id, `${times.length ? median(times).toFixed(1) : '—'} (${times.length}/${results.length})`]
  }))
}

if (compare) {
  const runs = fountainModes.map((mode) => ({ mode, results: seeds.map((seed) => simulate(minutes, seed, mode)) }))
  console.log('Per-seed medians. Gross gold includes wishes, expeditions and guide rewards, excluding starting gold.')
  console.log('Off never taps or upgrades the fountain; the guide remains at its wish step.')
  console.table(runs.flatMap(({ mode, results }) => checkpoints.map((at) => incomeSummary(mode, at, results))))
  console.log('First clear in minutes among successful seeds (cleared/total at each cutoff)')
  console.table(runs.flatMap(({ mode, results }) => checkpoints.map((at) => ({ mode, minutes: at, ...firstClearSummary(results, at) }))))
  console.log('Level 1 control for the design target (fountain/expedition income)')
  console.table([incomeSummary('ready, Lv1 only', 60, seeds.map((seed) => simulate(60, seed, 'ready', true)))])
} else {
  const results = seeds.map((seed) => simulate(minutes, seed, fountain!))
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

  console.log('first clear (minutes): ' + Object.entries(firstClearSummary(results, minutes)).map(([id, value]) => `${id} ${value}`).join(' · '))
  console.log(`workshop built: ${results.filter(({ state }) => state.buildings.alchemy > 0).length}/${results.length} · marsh trips: ${results.reduce((sum, result) => sum + result.marshTrips, 0)}`)
  console.table([incomeSummary(fountain!, minutes, results)])
}
