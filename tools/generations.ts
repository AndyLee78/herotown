import { dungeons, familyRules, lifeRules, timeRules, villageRules } from '../src/core/data'
import { coupleCount, housingFree, population, residents } from '../src/core/family'
import { dungeonUnlocked, freshState, presetById, reduce, type BuildingId } from '../src/core/game'
import { guideStatus } from '../src/core/guide'
import { canDeploy } from '../src/core/hero'
import { STAT_KEYS, type Hero } from '../src/core/types'

const years = Number(process.argv[2] ?? 20)
if (!Number.isSafeInteger(years) || years < 1) {
  throw new Error('Usage: npm run sim:generations -- [positive years]')
}
const start = 1_700_000_000_000
const yearMs = timeRules.seasonMs * timeRules.seasons.length
const stepMs = 15 * 60_000
const expeditionInterval = 2 * 60 * 60_000
const roleOrder = ['warrior', 'cleric', 'rogue', 'archer', 'mage', 'bard', 'dancer']

let state = freshState(11, start)
let now = start
let nextDeparture = start
let firstMarriage: number | undefined
let firstChildDeparture: number | undefined
let peakBedOverflow = 0
const ancestry = new Map<string, { hero: Hero; generation: number }>()
const births = new Set<string>()
let confirmedGeniuses = 0
let ambiguousGeniuses = 0
const sentChildren = new Set<string>()

function matchesInheritance(child: Hero, mother: Hero, father: Hero, genius: boolean): boolean {
  const scale = genius ? familyRules.geniusScale : 1
  const potential = (mother.potential + father.potential) / 2 + (genius ? familyRules.geniusPotential : 0)
  const boundPotential = (value: number) => Math.min(100, Math.max(0, Math.round(value)))
  return (
    child.potential >= boundPotential(potential - familyRules.potentialSpread) &&
    child.potential <= boundPotential(potential + familyRules.potentialSpread) &&
    STAT_KEYS.every((key) => {
      const average = (mother.potentials[key] + father.potentials[key]) / 2
      const low = Math.max(1, Math.round(average * (1 - familyRules.statSpread) * scale))
      const high = Math.max(1, Math.round(average * (1 + familyRules.statSpread) * scale))
      return child.potentials[key] >= low && child.potentials[key] <= high
    })
  )
}

function observe(): void {
  for (const hero of residents(state)) {
    if (ancestry.has(hero.id)) continue
    if (!hero.parents) {
      ancestry.set(hero.id, { hero, generation: 1 })
      continue
    }
    const mother = ancestry.get(hero.parents[0])
    const father = ancestry.get(hero.parents[1])
    const generation = 1 + Math.max(mother?.generation ?? 1, father?.generation ?? 1)
    ancestry.set(hero.id, { hero, generation })
    births.add(hero.id)

    // Genius is a transient roll in the core. Infer it only when the inherited values distinguish the ranges.
    if (!mother || !father) {
      ambiguousGeniuses += 1
    } else if (matchesInheritance(hero, mother.hero, father.hero, true)) {
      if (matchesInheritance(hero, mother.hero, father.hero, false)) ambiguousGeniuses += 1
      else confirmedGeniuses += 1
    }
  }
  const { beds } = population(state)
  peakBedOverflow = Math.max(peakBedOverflow, beds.used - beds.total)
}

function manageVillage(): void {
  for (const proposal of state.proposals) {
    if (housingFree(state) === 0) break
    const before = coupleCount(state)
    state = reduce(state, { type: 'acceptProposal', a: proposal.a, b: proposal.b, now })
    if (coupleCount(state) > before) firstMarriage ??= now
  }

  const visitors = [...state.visitors].sort((a, b) => roleOrder.indexOf(a.classId) - roleOrder.indexOf(b.classId))
  for (const visitor of visitors) {
    const census = population(state)
    const founders = state.roster.filter((hero) => !hero.parents).length
    // Start with a fighting party and keep space for pregnancies and newborns.
    if (founders >= 5 || census.beds.used + census.expecting + 1 >= census.beds.total) break
    state = reduce(state, { type: 'hire', id: visitor.id, now })
  }

  if (state.expeditions.length === 0) {
    for (const hero of state.roster) {
      if (hero.condition === 'dead' && hero.resurrectAt == null) {
        state = reduce(state, { type: 'revive', id: hero.id, now })
      } else if ((hero.condition === 'injured' || hero.condition === 'critical') && hero.treatAt == null) {
        state = reduce(state, { type: 'treat', id: hero.id, now })
      }
    }
  }
  while (guideStatus(state).done) state = reduce(state, { type: 'claimGuide' })

  if (state.construction) return
  const options = villageRules.buildings
    .map((building) => ({ id: building.id as BuildingId, cost: building.levels.find((level) => level.level === state.buildings[building.id as BuildingId] + 1) }))
    .sort((a, b) => (a.cost?.gold ?? Infinity) - (b.cost?.gold ?? Infinity))
  for (const { id, cost } of options) {
    if (!cost) continue
    const tried = reduce(state, { type: 'build', id, now })
    if (tried.construction) {
      state = tried
      break
    }
  }
}

function depart(): void {
  if (state.expeditions.length > 0 || now < nextDeparture) return
  const ready = state.roster.filter((hero) =>
    canDeploy(hero) && (hero.condition === 'healthy' || hero.condition === 'fatigued') && hero.fatigue < lifeRules.fatigue.tiredAt,
  )
  if (ready.length < 3) return

  // Give each homegrown apprentice a first trip while keeping experienced heroes in the party.
  const apprentice = ready.find((hero) => hero.parents && !sentChildren.has(hero.id))
  const veterans = ready.filter((hero) => hero !== apprentice).sort((a, b) => b.level - a.level)
  const party = apprentice ? [...veterans.slice(0, 4), apprentice] : veterans.slice(0, 5)
  for (const slot of presetById(state, state.presetId)?.slots ?? []) {
    state = reduce(state, { type: 'remove', id: slot.id })
  }
  for (const hero of party) state = reduce(state, { type: 'add', id: hero.id })

  const average = party.reduce((sum, hero) => sum + hero.level, 0) / party.length
  const level = average - (state.history[0]?.victory === false ? 1 : 0)
  const dungeon = dungeons
    .filter((entry) => entry.recommendedLevel <= level && dungeonUnlocked(state, entry.id))
    .sort((a, b) => b.recommendedLevel - a.recommendedLevel)[0]?.id ?? 'hill_cave'
  state = reduce(state, { type: 'dungeon', id: dungeon })
  state = reduce(state, { type: 'depart', now, confirm: true })
  const trip = state.expeditions[0]
  if (!trip) return
  nextDeparture = now + expeditionInterval
  for (const id of trip.heroIds) {
    if (!births.has(id)) continue
    sentChildren.add(id)
    firstChildDeparture ??= trip.departAt
  }
}

function yearlyRow(year: number) {
  const census = population(state)
  const people = residents(state)
  const totals = Object.values(census.bands)
  const children = census.bands.child
  const elders = census.bands.elder
  const male = totals.reduce((sum, band) => sum + band.male, 0)
  const female = totals.reduce((sum, band) => sum + band.female, 0)
  const childCount = children.male + children.female
  const elderCount = elders.male + elders.female
  const cohort = (generation: number) => people.filter((hero) => ancestry.get(hero.id)?.generation === generation)
  const averagePotential = (heroes: Hero[]) => heroes.length
    ? (heroes.reduce((sum, hero) => sum + hero.potential, 0) / heroes.length).toFixed(1)
    : '—'
  return {
    year, children: childCount, adults: male + female - childCount - elderCount, elders: elderCount, male, female,
    couples: coupleCount(state), births: births.size, geniuses: ambiguousGeniuses ? `${confirmedGeniuses}–${confirmedGeniuses + ambiguousGeniuses}` : String(confirmedGeniuses),
    'gen 2': cohort(2).length, 'gen 3': cohort(3).length, 'gen 1 potential': averagePotential(cohort(1)),
    'gen 2 potential': averagePotential(cohort(2)), beds: `${census.beds.used}/${census.beds.total}`,
  }
}

const rows = []
for (let year = 1; year <= years; year += 1) {
  const yearEnd = start + year * yearMs
  while (now < yearEnd) {
    manageVillage()
    observe()
    depart()
    const seasonEnd = now + timeRules.seasonMs - state.calendar.intoSeasonMs
    now = Math.min(now + stepMs, yearEnd, seasonEnd, state.expeditions[0]?.returnAt ?? Infinity)
    state = reduce(state, { type: 'catchUp', now })
    observe()
  }
  rows.push(yearlyRow(year))
}
console.table(rows)
const timing = (event: number | undefined) => event == null ? 'not reached' : ((event - start) / timeRules.seasonMs).toFixed(2)
console.log('Geniuses are cumulative; ranges indicate ambiguous inherited values. Potential averages are for current residents.')
console.log(`First marriage (days): ${timing(firstMarriage)}`)
console.log(`First child expedition (days): ${timing(firstChildDeparture)}`)
console.log(`Peak bed overflow: ${peakBedOverflow}`)
