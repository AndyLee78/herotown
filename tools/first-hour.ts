// Plays the first hours like a simple player would, to catch dead ends in
// the early flow. Run: npx vite-node tools/first-hour.ts [minutes]
import { dungeons, villageRules } from '../src/core/data'
import { busyHeroIds, dungeonUnlocked, freshState, presetById, reduce, townLevel, type BuildingId, type GameState } from '../src/core/game'
import { guideStatus } from '../src/core/guide'
import { canDeploy } from '../src/core/hero'
import type { Hero } from '../src/core/types'

const minutes = Number(process.argv[2] ?? 60)
const start = 1_700_000_000_000
let state: GameState = freshState(11, start)
let now = start
const log: string[] = []
const note = (text: string) => log.push(`${String(Math.round((now - start) / 60_000)).padStart(3)}m  ${text}`)

const isHurt = (hero: Hero) => hero.condition === 'injured' || hero.condition === 'critical'

function selectedHeroes(s: GameState): Hero[] {
  const slots = presetById(s, s.presetId)?.slots ?? []
  return s.roster.filter((hero) => slots.some((slot) => slot.id === hero.id) && canDeploy(hero))
}

function averageLevel(s: GameState): number {
  const candidates = selectedHeroes(s).filter((hero) => !isHurt(hero))
  return candidates.reduce((sum, hero) => sum + hero.level, 0) / Math.max(1, candidates.length)
}

// The hardest open dungeon the party is levelled for.
function pickDungeon(s: GameState): string {
  // After a loss, drop back one level of difficulty for the next trip.
  const lost = s.history[0] && !s.history[0].victory ? 1 : 0
  const level = averageLevel(s) - lost
  const fitting = dungeons.filter((dungeon) => dungeonUnlocked(s, dungeon.id) && dungeon.recommendedLevel <= level)
  return [...fitting].sort((a, b) => b.recommendedLevel - a.recommendedLevel)[0]?.id ?? 'hill_cave'
}

let lastTown = 1
let lastLevel = 1
while (now - start < minutes * 60_000) {
  // Hire up to five while gold allows: a tank and a healer first, then damage.
  const priority = ['warrior', 'cleric', 'rogue', 'archer', 'mage', 'bard', 'dancer']
  const has = (classId: string) => state.roster.some((hero) => hero.classId === classId)
  const wanted = [...state.visitors].sort((a, b) => priority.indexOf(a.classId) - priority.indexOf(b.classId))
  for (const visitor of wanted) {
    if (state.roster.length >= 3 && !has('warrior') && visitor.classId !== 'warrior') continue
    if (state.roster.length >= 5) break
    const before = state.roster.length
    state = reduce(state, { type: 'hire', id: visitor.id, now })
    if (state.roster.length > before) note(`hire ${visitor.classId} (gold ${state.gold})`)
  }
  // Keep the selected preset full of free heroes.
  for (const hero of state.roster) {
    state = reduce(state, { type: 'add', id: hero.id, presetId: state.presetId })
  }
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
  if (state.expeditions.length === 0 && selected.length > 0 && !selected.some(isHurt)) {
    const dungeon = pickDungeon(state)
    state = reduce(state, { type: 'dungeon', id: dungeon })
    const sent = reduce(state, { type: 'depart', presetId: state.presetId, confirm: true, now })
    if (sent.expeditions.length > state.expeditions.length) {
      state = sent
    } else if (sent.notice && !log[log.length - 1]?.endsWith(sent.notice)) {
      note(`cannot depart: ${sent.notice}`)
    }
  }
  const lastReturn = state.history[0]?.finishedAt
  now += 15_000
  state = reduce(state, { type: 'catchUp', now })
  const report = state.history[0]
  if (report && report.finishedAt !== lastReturn && !report.victory) note(`LOST ${report.dungeonId} (${report.defeatReason})`)
  const level = townLevel(state.fame).level
  if (level > lastTown) {
    note(`town level ${level}`)
    lastTown = level
  }
  const avg = Math.floor(averageLevel(state))
  if (avg > lastLevel) {
    note(`party level ${avg} · next dungeon ${pickDungeon(state)} · gold ${state.gold}`)
    lastLevel = avg
  }
}
console.log(log.join('\n'))
console.log(`\nafter ${minutes}m: gold ${state.gold}, party Lv ${averageLevel(state).toFixed(1)}, cleared ${state.cleared.join(', ')}, buildings ${JSON.stringify(state.buildings)}`)
const wins = state.history.filter((report) => report.victory).length
console.log(`last ${state.history.length} trips: ${wins} wins`)
