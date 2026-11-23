import { bandForAge, ageBands, classById, dungeonById, familyRules, maxAge, names, timeRules, traits, villageRules } from './data'
import { genesFor, inheritGenes } from './genes'
import { createHero } from './hero'
import { createRng, type Rng } from './rng'
import type { GameState, Grave } from './game'
import { STAT_KEYS, type Bond, type BondStage, type Gender, type Hero, type Proposal, type Stats, type TraitId } from './types'

// Stage 2 families (Docs/generations.md): affinity between heroes, proposals
// the player approves, pregnancies, and children who inherit from both parents.

export type FamilyEvents = {
  births: string[]
  proposals: number
  deaths: string[]
}

export type FamilyView = {
  spouse: Hero | null
  parents: Hero[]
  children: Hero[]
}

export type Population = {
  bands: Record<string, Record<Gender, number>>
  married: number
  single: number
  expecting: number
  beds: { used: number; total: number }
}

// ---------- lookups ----------

export function residents(state: GameState): Hero[] {
  return [...state.roster, ...(state.retirees ?? []).map((retiree) => retiree.hero)]
}

function heroById(state: GameState, id: string): Hero | undefined {
  return residents(state).find((hero) => hero.id === id)
}

function pair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a]
}

function bondFor(bonds: Bond[], a: string, b: string): Bond | undefined {
  const [first, second] = pair(a, b)
  return bonds.find((bond) => bond.a === first && bond.b === second)
}

export function bondOf(state: GameState, a: string, b: string): number {
  return bondFor(state.bonds ?? [], a, b)?.affinity ?? 0
}

function mourning(): number {
  return familyRules.mourningSeasons * timeRules.seasonMs
}

export function isSingle(hero: Hero, now: number): boolean {
  return hero.spouseId == null && (hero.widowedAt == null || now - hero.widowedAt >= mourning())
}

// Parents and children, and children who share a parent.
export function isKin(a: Hero, b: Hero): boolean {
  if (a.parents?.includes(b.id) || b.parents?.includes(a.id)) {
    return true
  }
  return a.parents != null && b.parents != null && a.parents.some((id) => b.parents?.includes(id))
}

// Whether two heroes could become lovers: living adults of opposite genders,
// both free, and not close family.
export function canCourt(a: Hero, b: Hero, now: number): boolean {
  return (
    a.id !== b.id &&
    a.gender !== b.gender &&
    a.condition !== 'dead' &&
    b.condition !== 'dead' &&
    a.age >= familyRules.loverMinAge &&
    b.age >= familyRules.loverMinAge &&
    isSingle(a, now) &&
    isSingle(b, now) &&
    !isKin(a, b)
  )
}

// Beds in use, counting babies on the way (an expecting retiree's baby too).
export function bedsTaken(state: GameState): number {
  return state.roster.length + residents(state).filter((hero) => hero.expecting).length
}

export function bondStage(state: GameState, a: string, b: string): BondStage {
  const first = heroById(state, a)
  const second = heroById(state, b)
  if (first && second && first.spouseId === b && second.spouseId === a) {
    return 'spouse'
  }
  const affinity = bondOf(state, a, b)
  if (first && second && affinity >= familyRules.loverAt && canCourt(first, second, state.lastTickAt)) {
    return 'lover'
  }
  return affinity >= familyRules.friendAt ? 'friend' : 'stranger'
}

// The heroes someone is closest to, highest affinity first.
export function topBonds(state: GameState, id: string, count: number): { id: string; affinity: number; stage: BondStage }[] {
  return (state.bonds ?? [])
    .filter((bond) => bond.a === id || bond.b === id)
    .map((bond) => (bond.a === id ? bond.b : bond.a))
    .filter((other) => heroById(state, other))
    .map((other) => ({ id: other, affinity: bondOf(state, id, other), stage: bondStage(state, id, other) }))
    .sort((x, y) => y.affinity - x.affinity)
    .slice(0, count)
}

export function familyOf(state: GameState, id: string): FamilyView {
  const hero = heroById(state, id)
  const all = residents(state)
  return {
    spouse: hero?.spouseId ? (all.find((entry) => entry.id === hero.spouseId) ?? null) : null,
    parents: hero?.parents ? all.filter((entry) => hero.parents?.includes(entry.id)) : [],
    children: all.filter((entry) => entry.parents?.includes(id)),
  }
}

export function coupleCount(state: GameState): number {
  return residents(state).filter((hero) => hero.spouseId != null && hero.gender === 'female').length
}

// Free homes for newly-weds: house level × couples per level, minus couples.
export function housingFree(state: GameState): number {
  return Math.max(0, state.buildings.house * familyRules.couplesPerHouseLevel - coupleCount(state))
}

export function population(state: GameState): Population {
  const bands: Population['bands'] = {}
  for (const band of ageBands) {
    bands[band.id] = { male: 0, female: 0 }
  }
  const all = residents(state)
  for (const hero of all) {
    const band = bands[bandForAge(hero.age).id]
    if (band) {
      band[hero.gender] += 1
    }
  }
  const married = all.filter((hero) => hero.spouseId != null).length
  return {
    bands,
    married,
    single: all.length - married,
    expecting: all.filter((hero) => hero.expecting).length,
    beds: { used: state.roster.length, total: state.buildings.house * villageRules.house.bedsPerLevel },
  }
}

// Each hero's bonus from friends and lovers in the same party.
export function partyBonus(state: GameState, ids: string[]): Record<string, number> {
  const bonus: Record<string, number> = {}
  for (const id of ids) {
    let total = 0
    for (const other of ids) {
      if (other === id) {
        continue
      }
      const stage = bondStage(state, id, other)
      total += stage === 'spouse' || stage === 'lover' ? familyRules.loverBonus : stage === 'friend' ? familyRules.friendBonus : 0
    }
    bonus[id] = Math.min(familyRules.maxBonus, total)
  }
  return bonus
}

// Village girls and boys arrive more often when the town is lopsided (GDD 6.4).
export function femaleChance(state: GameState): number {
  const adults = state.roster.filter((hero) => hero.age >= familyRules.adultAge)
  if (adults.length === 0) {
    return 0.5
  }
  const women = adults.filter((hero) => hero.gender === 'female').length / adults.length
  if (women > familyRules.visitorBalanceAt) {
    return 1 - familyRules.visitorBalanceChance
  }
  if (1 - women > familyRules.visitorBalanceAt) {
    return familyRules.visitorBalanceChance
  }
  return 0.5
}

// Children age faster until they can go out (Docs/generations.md 3).
export function nextAge(age: number): number {
  return age < familyRules.adultAge ? Math.min(familyRules.adultAge, age + familyRules.childYearsPerYear) : age + 1
}

export function wageCount(state: GameState): number {
  return state.roster.filter((hero) => hero.age >= familyRules.adultAge).length
}

// ---------- changes ----------

function addAffinity(bonds: Bond[], a: string, b: string, amount: number): Bond[] {
  const [first, second] = pair(a, b)
  const found = bonds.find((bond) => bond.a === first && bond.b === second)
  if (!found) {
    return amount > 0 ? [...bonds, { a: first, b: second, affinity: Math.min(100, amount) }] : bonds
  }
  return bonds.map((bond) => (bond === found ? { ...bond, affinity: clamp(bond.affinity + amount, 0, 100) } : bond))
}

// Heroes who came home from the same expedition grow closer.
export function bondParty(state: GameState, ids: string[], victory: boolean): GameState {
  const present = ids.filter((id) => state.roster.some((hero) => hero.id === id))
  const amount = familyRules.affinityPerTrip + (victory ? familyRules.affinityWinBonus : 0)
  let bonds = state.bonds ?? []
  for (let i = 0; i < present.length; i += 1) {
    for (let j = i + 1; j < present.length; j += 1) {
      bonds = addAffinity(bonds, present[i] as string, present[j] as string, amount)
    }
  }
  return { ...state, bonds }
}

function familyRng(state: GameState): Rng {
  return createRng(state.seed + 7_000_003 + state.familyNonce * 7919)
}

// Everything that happens to families when a season turns.
export function turnSeason(state: GameState, now: number, events: FamilyEvents): GameState {
  const rng = familyRng(state)
  let next: GameState = { ...state, familyNonce: state.familyNonce + 1 }
  next = growTogether(next)
  next = raiseProposals(next, rng, now, events)
  next = conceive(next, rng, now)
  return next
}

function growTogether(state: GameState): GameState {
  const amount = familyRules.affinityPerSeason + state.buildings.house * familyRules.affinityPerHouseLevel
  let bonds = state.bonds
  const ids = state.roster.filter((hero) => hero.age >= familyRules.adultAge).map((hero) => hero.id)
  for (let i = 0; i < ids.length; i += 1) {
    for (let j = i + 1; j < ids.length; j += 1) {
      bonds = addAffinity(bonds, ids[i] as string, ids[j] as string, amount)
    }
  }
  return { ...state, bonds }
}

function raiseProposals(state: GameState, rng: Rng, now: number, events: FamilyEvents): GameState {
  const proposals = [...state.proposals]
  const taken = new Set(proposals.flatMap((proposal) => [proposal.a, proposal.b]))
  const ordered = [...state.bonds].sort((x, y) => y.affinity - x.affinity || (x.a + x.b).localeCompare(y.a + y.b))
  for (const bond of ordered) {
    if (bond.affinity < familyRules.proposeAt || (bond.cooldownUntil ?? 0) > now || taken.has(bond.a) || taken.has(bond.b)) {
      continue
    }
    const a = heroById(state, bond.a)
    const b = heroById(state, bond.b)
    if (!a || !b || !canCourt(a, b, now) || rng.next() >= familyRules.proposeChance) {
      continue
    }
    proposals.push({ a: bond.a, b: bond.b, at: now })
    taken.add(bond.a)
    taken.add(bond.b)
    events.proposals += 1
  }
  return { ...state, proposals }
}

function conceive(state: GameState, rng: Rng, now: number): GameState {
  const away = new Set(state.expeditions.flatMap((expedition) => expedition.heroIds))
  const beds = state.buildings.house * villageRules.house.bedsPerLevel
  let taken = bedsTaken(state)
  let nonce = state.familyNonce
  const roster = state.roster.map((mother) => {
    if (mother.gender !== 'female' || !mother.spouseId || mother.expecting || mother.condition === 'dead' || away.has(mother.id)) {
      return mother
    }
    const father = state.roster.find((hero) => hero.id === mother.spouseId)
    if (!father || father.condition === 'dead' || away.has(father.id)) {
      return mother
    }
    if (mother.age > familyRules.maxMotherAge || father.age > familyRules.maxFatherAge) {
      return mother
    }
    const children = residents(state).filter((hero) => hero.parents?.includes(mother.id) && hero.parents.includes(father.id)).length
    if (children >= familyRules.maxChildren || taken >= beds) {
      return mother
    }
    if (rng.next() >= familyRules.birthChance) {
      return mother
    }
    nonce += 1
    taken += 1
    const child = makeChild(rng, `${state.seed}-c${nonce}`, mother, father, legendBonus(state, father.family ?? father.name))
    return { ...mother, expecting: { dueAt: now + timeRules.seasonMs, child } }
  })
  return { ...state, roster, familyNonce: nonce }
}

// Children whose time has come join the village.
export function deliverBirths(state: GameState, now: number, events: FamilyEvents): GameState {
  const born: Hero[] = []
  const deliver = (hero: Hero): Hero => {
    if (!hero.expecting || hero.expecting.dueAt > now) {
      return hero
    }
    born.push(hero.expecting.child)
    events.births.push(hero.expecting.child.name)
    return createHero({ ...hero, expecting: undefined })
  }
  const roster = state.roster.map(deliver)
  const retirees = state.retirees.map((retiree) => ({ ...retiree, hero: deliver(retiree.hero) }))
  if (born.length === 0) {
    return state
  }
  return { ...state, roster: [...roster, ...born], retirees }
}

export function makeChild(rng: Rng, id: string, mother: Hero, father: Hero, bonus = 0): Hero {
  const gender: Gender = rng.next() < 0.5 ? 'male' : 'female'
  const genius = rng.next() < familyRules.geniusChance
  let classId = rng.next() < 0.5 ? mother.classId : father.classId
  if (classById(classId).femaleOnly && gender === 'male') {
    classId = father.classId
  }
  if (classById(classId).femaleOnly && gender === 'male') {
    classId = 'bard'
  }
  const potentials = {} as Stats
  for (const key of STAT_KEYS) {
    const average = (mother.potentials[key] + father.potentials[key]) / 2
    const drift = 1 + (rng.next() * 2 - 1) * familyRules.statSpread
    potentials[key] = Math.max(1, Math.round(average * drift * (genius ? familyRules.geniusScale : 1)))
  }
  const spread = (rng.next() * 2 - 1) * familyRules.potentialSpread
  const potential = clamp(Math.round((mother.potential + father.potential) / 2 + spread + (genius ? familyRules.geniusPotential : 0) + bonus), 0, 100)
  // A trait both parents share is rolled once, not twice.
  const traitIds: TraitId[] = []
  for (const trait of new Set([...mother.traitIds, ...father.traitIds])) {
    if (rng.next() < familyRules.traitInherit) {
      traitIds.push(trait)
    }
  }
  if (rng.next() < familyRules.traitMutation) {
    const fresh = traits.map((trait) => trait.id).filter((trait) => !traitIds.includes(trait))
    if (fresh.length > 0) {
      traitIds.push(rng.pick(fresh))
    }
  }
  const genes = inheritGenes(rng, gender, genesFor(mother), genesFor(father))
  return createHero({
    id,
    name: rng.pick(names[gender]),
    gender,
    classId,
    age: 0,
    potentials,
    potential,
    traitIds: traitIds.slice(0, familyRules.maxTraits),
    family: father.family ?? father.name,
    parents: [mother.id, father.id],
    genes,
  })
}

export function acceptProposal(state: GameState, a: string, b: string, now: number): GameState {
  const proposal = findProposal(state.proposals, a, b)
  if (!proposal) {
    return { ...state, notice: 'missing' }
  }
  const first = heroById(state, proposal.a)
  const second = heroById(state, proposal.b)
  // A hero waiting to be revived keeps the proposal open but cannot wed yet.
  if (first?.condition === 'dead' || second?.condition === 'dead') {
    return { ...state, notice: 'dead' }
  }
  if (!first || !second || !canCourt(first, second, now)) {
    return { ...state, notice: 'missing', proposals: dropProposal(state.proposals, proposal) }
  }
  if (housingFree(state) <= 0) {
    return { ...state, notice: 'noHouse' }
  }
  const wed = (hero: Hero): Hero =>
    hero.id === first.id ? { ...hero, spouseId: second.id, widowedAt: undefined } : hero.id === second.id ? { ...hero, spouseId: first.id, widowedAt: undefined } : hero
  return {
    ...state,
    notice: null,
    roster: state.roster.map(wed),
    retirees: state.retirees.map((retiree) => ({ ...retiree, hero: wed(retiree.hero) })),
    proposals: state.proposals.filter((entry) => ![entry.a, entry.b].some((id) => id === first.id || id === second.id)),
  }
}

export function declineProposal(state: GameState, a: string, b: string, now: number): GameState {
  const proposal = findProposal(state.proposals, a, b)
  if (!proposal) {
    return { ...state, notice: 'missing' }
  }
  const bonds = addAffinity(state.bonds, proposal.a, proposal.b, -familyRules.declineAffinity).map((bond) =>
    bond.a === proposal.a && bond.b === proposal.b ? { ...bond, cooldownUntil: now + familyRules.declineCooldownSeasons * timeRules.seasonMs } : bond,
  )
  return { ...state, notice: null, bonds, proposals: dropProposal(state.proposals, proposal) }
}

function findProposal(proposals: Proposal[], a: string, b: string): Proposal | undefined {
  const [first, second] = pair(a, b)
  return proposals.find((proposal) => proposal.a === first && proposal.b === second)
}

function dropProposal(proposals: Proposal[], drop: Proposal): Proposal[] {
  return proposals.filter((proposal) => proposal !== drop)
}

// Clears bonds, proposals and marriages that point at heroes who left town.
export function tidyFamily(state: GameState, now: number): GameState {
  const ids = new Set(residents(state).map((hero) => hero.id))
  const bonds = state.bonds ?? []
  const proposals = state.proposals ?? []
  const keepBonds = bonds.filter((bond) => ids.has(bond.a) && ids.has(bond.b))
  const keepProposals = proposals.filter((proposal) => ids.has(proposal.a) && ids.has(proposal.b))
  const lost = (hero: Hero) => hero.spouseId != null && !ids.has(hero.spouseId)
  const widowed = residents(state).some(lost)
  if (keepBonds.length === bonds.length && keepProposals.length === proposals.length && !widowed) {
    return state
  }
  const widow = (hero: Hero): Hero => (lost(hero) ? { ...hero, spouseId: undefined, widowedAt: now } : hero)
  return {
    ...state,
    bonds: keepBonds,
    proposals: keepProposals,
    roster: widowed ? state.roster.map(widow) : state.roster,
    retirees: widowed ? state.retirees.map((retiree) => ({ ...retiree, hero: widow(retiree.hero) })) : state.retirees,
  }
}

// ---------- old age, graves and the hall of fame ----------

// Whether a hero who leaves for the graveyard is remembered as a legend.
export function isLegend(hero: Hero): boolean {
  return hero.level >= familyRules.legendLevel || hero.clears.some((id) => dungeonById(id).tier >= familyRules.legendTier)
}

export function graveFor(hero: Hero, cause: 'battle' | 'oldAge', year?: number): Grave {
  const grave: Grave = {
    id: hero.id,
    name: hero.name,
    classId: hero.classId,
    level: hero.level,
    clears: [...hero.clears],
    cause,
    age: hero.age,
    gender: hero.gender,
    genes: genesFor(hero),
  }
  if (year != null) grave.year = year
  if (hero.family != null) grave.family = hero.family
  if (hero.parents) grave.parents = [hero.parents[0], hero.parents[1]]
  if (hero.spouseId != null) grave.spouseId = hero.spouseId
  if (isLegend(hero)) grave.legend = true
  return grave
}

// Chance that a hero of this age passes away when the year turns.
export function oldAgeChance(age: number): number {
  if (age >= maxAge) {
    return 1
  }
  return age < familyRules.oldAgeFrom ? 0 : Math.min(1, (age - familyRules.oldAgeFrom + 1) * familyRules.oldAgeChancePerYear)
}

// Run when a year turns: the old at home (not on an expedition) may pass away.
export function passAway(state: GameState, events: FamilyEvents): GameState {
  const rng = createRng(state.seed + 9_100_019 + state.calendar.year * 7907)
  const away = new Set(state.expeditions.flatMap((expedition) => expedition.heroIds))
  const graves: Grave[] = []
  const dies = (hero: Hero) => {
    const chance = oldAgeChance(hero.age)
    if (chance <= 0 || away.has(hero.id) || rng.next() >= chance) {
      return false
    }
    graves.push(graveFor(hero, 'oldAge', state.calendar.year))
    events.deaths.push(hero.name)
    return true
  }
  const roster = state.roster.filter((hero) => !dies(hero))
  const retirees = state.retirees.filter((retiree) => !dies(retiree.hero))
  if (graves.length === 0) {
    return state
  }
  // Leaving the roster also takes them out of saved parties.
  const gone = new Set(graves.map((grave) => grave.id))
  const presets = state.presets.map((preset) => ({ ...preset, slots: preset.slots.filter((slot) => !gone.has(slot.id)) }))
  const auto = { ...state.auto, party: state.auto.party.filter((slot) => !gone.has(slot.id)) }
  return { ...state, roster, retirees, presets, auto, graveyard: [...state.graveyard, ...graves] }
}

export function hallOfFame(state: GameState): Grave[] {
  return state.graveyard.filter((grave) => grave.legend).reverse()
}

export function familyLegends(state: GameState, family: string): Grave[] {
  return state.graveyard.filter((grave) => grave.legend && (grave.family ?? grave.name) === family)
}

// Potential a newborn of this family gets from its legends.
export function legendBonus(state: GameState, family: string): number {
  return Math.min(familyRules.legendPotentialMax, familyLegends(state, family).length * familyRules.legendPotential)
}

export type Ancestor = { id: string; name: string; gender?: Gender; living: boolean; hero?: Hero; grave?: Grave; generation: number }

// Parents, grandparents and so on, living or in the graveyard (nearest first).
export function ancestorsOf(state: GameState, id: string, depth = 3): Ancestor[] {
  const living = residents(state)
  const find = (key: string): { parents?: [string, string]; ancestor: Ancestor | null } => {
    const hero = living.find((entry) => entry.id === key)
    if (hero) {
      return { parents: hero.parents, ancestor: { id: hero.id, name: hero.name, gender: hero.gender, living: true, hero, generation: 0 } }
    }
    const grave = state.graveyard.find((entry) => entry.id === key)
    if (grave) {
      return { parents: grave.parents, ancestor: { id: grave.id, name: grave.name, gender: grave.gender, living: false, grave, generation: 0 } }
    }
    return { ancestor: null }
  }
  const result: Ancestor[] = []
  let frontier: string[] = [...(find(id).parents ?? [])]
  for (let generation = 1; generation <= depth && frontier.length > 0; generation += 1) {
    const next: string[] = []
    for (const key of frontier) {
      const found = find(key)
      if (found.ancestor) {
        result.push({ ...found.ancestor, generation })
      }
      next.push(...(found.parents ?? []))
    }
    frontier = next
  }
  return result
}

export function readBonds(value: unknown): Bond[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value.filter(
    (bond): bond is Bond => bond != null && typeof bond.a === 'string' && typeof bond.b === 'string' && typeof bond.affinity === 'number',
  )
}

export function readProposals(value: unknown): Proposal[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value.filter(
    (proposal): proposal is Proposal =>
      proposal != null && typeof proposal.a === 'string' && typeof proposal.b === 'string' && typeof proposal.at === 'number',
  )
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
