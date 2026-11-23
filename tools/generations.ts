import { dungeons, familyRules, lifeRules, timeRules, villageRules } from '../src/core/data'
import { bedsTaken, coupleCount, hallOfFame, housingFree, legendBonus, population, residents } from '../src/core/family'
import { busyHeroIds, dungeonUnlocked, freshState, presetById, reduce, townLevel, type BuildingId, type GameState } from '../src/core/game'
import { guideStatus } from '../src/core/guide'
import { canDeploy } from '../src/core/hero'
import { STAT_KEYS, type Hero } from '../src/core/types'

const years = Number(process.argv[2] ?? 60)
const seed = Number(process.argv[3] ?? 11)
if (!Number.isSafeInteger(years) || years < 1 || !Number.isSafeInteger(seed) || seed < 0) {
  throw new Error('Usage: npm run sim:generations -- [positive years] [nonnegative seed]')
}
const start = 1_700_000_000_000
const yearMs = timeRules.seasonMs * timeRules.seasons.length
const stepMs = 15 * 60_000
const expeditionInterval = 2 * 60 * 60_000
const roleOrder = ['warrior', 'cleric', 'rogue', 'archer', 'mage', 'bard', 'dancer']

let state = freshState(seed, start)
let now = start
let nextDeparture = start
let firstMarriage: number | undefined
let firstChildDeparture: number | undefined
let firstThirdGenerationBirth: number | undefined
let childrenWithLegendBonus = 0
let peakBedOverflow = 0
const ancestry = new Map<string, { hero: Hero; generation: number }>()
const births = new Set<string>()
let confirmedGeniuses = 0
let ambiguousGeniuses = 0
const sentChildren = new Set<string>()
const conceptionBonuses = new Map<string, number>()

function matchesInheritance(child: Hero, mother: Hero, father: Hero, bonus: number, genius: boolean): boolean {
  const scale = genius ? familyRules.geniusScale : 1
  const potential = (mother.potential + father.potential) / 2 + bonus + (genius ? familyRules.geniusPotential : 0)
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

function recordConceptions(before: GameState): void {
  if (before.familyNonce === state.familyNonce) return
  // At a season turn, battle graves already exist when conception runs; new old-age graves do not.
  const existingGraves = before.graveyard.length
  const conceptionState = {
    ...state,
    graveyard: state.graveyard.filter((grave, index) => index < existingGraves || grave.cause !== 'oldAge'),
  }
  for (const { expecting } of residents(state)) {
    const child = expecting?.child
    if (child?.family && !conceptionBonuses.has(child.id)) {
      conceptionBonuses.set(child.id, legendBonus(conceptionState, child.family))
    }
  }
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
    if (generation === 3) firstThirdGenerationBirth ??= now
    const bonus = conceptionBonuses.get(hero.id) ?? 0
    if (bonus > 0) childrenWithLegendBonus += 1

    // Genius is a transient roll in the core. Infer it only when the inherited values distinguish the ranges.
    if (!mother || !father) {
      ambiguousGeniuses += 1
    } else if (matchesInheritance(hero, mother.hero, father.hero, bonus, true)) {
      if (matchesInheritance(hero, mother.hero, father.hero, bonus, false)) ambiguousGeniuses += 1
      else confirmedGeniuses += 1
    }
  }
  const { beds } = population(state)
  peakBedOverflow = Math.max(peakBedOverflow, beds.used - beds.total)
}

function neededHouseUpgrade() {
  const needsHouse = bedsTaken(state) >= population(state).beds.total - 1
    || (state.proposals.length > 0 && housingFree(state) === 0)
  if (!needsHouse || state.buildings.house >= townLevel(state.fame).maxBuildingLevel) return undefined
  return villageRules.buildings.find(({ id }) => id === 'house')?.levels.find(({ level }) => level === state.buildings.house + 1)
}

function manageVillage(): void {
  const away = busyHeroIds(state)
  for (const hero of state.roster) {
    if (hero.age > 50 && hero.condition !== 'dead' && !away.has(hero.id)) {
      state = reduce(state, { type: 'retire', id: hero.id })
    }
  }

  for (const proposal of state.proposals) {
    if (housingFree(state) === 0) break
    const before = coupleCount(state)
    state = reduce(state, { type: 'acceptProposal', a: proposal.a, b: proposal.b, now })
    if (coupleCount(state) > before) firstMarriage ??= now
  }

  const visitors = [...state.visitors].sort((a, b) => roleOrder.indexOf(a.classId) - roleOrder.indexOf(b.classId))
  for (const visitor of visitors) {
    const beds = population(state).beds
    const activeAdults = state.roster.filter((hero) => hero.condition !== 'dead' && hero.age >= familyRules.adultAge).length
    // Start with a fighting party and keep space for pregnancies and newborns.
    if (activeAdults >= 5 || bedsTaken(state) + 1 >= beds.total) break
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
  if (neededHouseUpgrade()) {
    // Save building materials and gold for the house while it is needed.
    state = reduce(state, { type: 'build', id: 'house', now })
    return
  }
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
  const fitting = dungeons.filter((entry) => entry.recommendedLevel <= level && dungeonUnlocked(state, entry.id))
    .sort((a, b) => a.recommendedLevel - b.recommendedLevel)
  const house = state.construction ? undefined : neededHouseUpgrade()
  const supplyTrip = house && fitting.find(({ id }) => {
    const drop = villageRules.drops[id as keyof typeof villageRules.drops]
    const material = drop?.material as keyof typeof state.materials | undefined
    return (material != null && material !== 'bone' && state.materials[material] < house[material])
      || (drop && 'iron' in drop && state.materials.iron < house.iron)
      || (state.gold < house.gold && state.cleared.includes(id))
  })
  const dungeon = supplyTrip?.id ?? fitting.at(-1)?.id ?? 'hill_cave'
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

function yearlyRow(year: number, previousGraves: number) {
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
  const deaths = state.graveyard.slice(previousGraves)
  const families = new Set(people.flatMap((hero) => hero.family ? [hero.family] : []))
  const averagePotential = (heroes: Hero[]) => heroes.length
    ? (heroes.reduce((sum, hero) => sum + hero.potential, 0) / heroes.length).toFixed(1)
    : '—'
  return {
    year, children: childCount, adults: male + female - childCount - elderCount, elders: elderCount, male, female,
    couples: coupleCount(state), births: births.size, geniuses: ambiguousGeniuses ? `${confirmedGeniuses}–${confirmedGeniuses + ambiguousGeniuses}` : String(confirmedGeniuses),
    'old-age deaths': deaths.filter((grave) => grave.cause === 'oldAge').length,
    'battle deaths': deaths.filter((grave) => grave.cause === 'battle').length,
    legends: hallOfFame(state).length, families: families.size,
    'gen 1': cohort(1).length, 'gen 2': cohort(2).length, 'gen 3': cohort(3).length, 'gen 4': cohort(4).length,
    'gen 1 potential': averagePotential(cohort(1)),
    'gen 2 potential': averagePotential(cohort(2)), beds: `${census.beds.used}/${census.beds.total}`,
  }
}

const rows = []
for (let year = 1; year <= years; year += 1) {
  const yearEnd = start + year * yearMs
  const previousGraves = state.graveyard.length
  while (now < yearEnd) {
    manageVillage()
    observe()
    depart()
    const seasonEnd = now + timeRules.seasonMs - state.calendar.intoSeasonMs
    const nextBirth = Math.min(...residents(state).map((hero) => hero.expecting?.dueAt ?? Infinity))
    now = Math.min(now + stepMs, yearEnd, seasonEnd, nextBirth, state.expeditions[0]?.returnAt ?? Infinity)
    const before = state
    state = reduce(state, { type: 'catchUp', now })
    recordConceptions(before)
    observe()
  }
  rows.push(yearlyRow(year, previousGraves))
}
console.log(`Seed ${seed} · ${years} years`)
console.table(rows)
const timing = (event: number | undefined) => event == null ? 'not reached' : ((event - start) / timeRules.seasonMs).toFixed(2)
console.log('Births and geniuses are cumulative. Death columns count permanent burials within the year.')
console.log('Genius ranges indicate ambiguous inherited values. Potential averages are for current residents.')
console.log(`First marriage (days): ${timing(firstMarriage)}`)
console.log(`First child expedition (days): ${timing(firstChildDeparture)}`)
console.log(`First third-generation birth (days): ${timing(firstThirdGenerationBirth)}`)
console.log(`Children with a family legend bonus: ${childrenWithLegendBonus}`)
console.log(`Total graves (old age / battle): ${state.graveyard.filter((grave) => grave.cause === 'oldAge').length} / ${state.graveyard.filter((grave) => grave.cause === 'battle').length}`)
console.log(`Peak bed overflow: ${peakBedOverflow}`)
