import data from '../data/incidents.json'
import { classById, familyRules, progression, timeRules } from './data'
import { gainXp } from './dungeon'
import { addAffinity, bondOf, canCourt, femaleChance } from './family'
import { busyHeroIds, townLevelOf, visitorCap, type BuildingId, type GameState, type MaterialName } from './game'
import { generateHero, isChild } from './hero'
import { rollDrop } from './loot'
import { moraleOf } from './morale'
import { seasonKey } from './nest'
import { feel, partyFit, type Emotion } from './personality'
import { createRng, type Rng } from './rng'
import { arrive } from './scouting'
import type { Hero } from './types'

type EffectKind = 'gold' | 'materials' | 'vault' | 'fame' | 'morale' | 'affinity' | 'fatigue' | 'xp' | 'visitor' | 'gear' | 'nothing'
export type IncidentEffect = { kind: EffectKind; amount: number; resource?: string; target?: 'first' | 'second' | 'actors' | 'family' | 'town' | 'home'; emotion?: Emotion }
type Requirements = { gold?: number; fame?: number; building?: BuildingId; level?: number; noFestival?: boolean; adultsAtHome?: boolean }
type Choice = { id: string; cost?: Partial<Record<'gold' | MaterialName, number>>; requires?: Requirements; actorCount?: number; effects: IncidentEffect[]; outcomes?: { chance: number; effects: IncidentEffect[] }[] }
type Definition = { id: string; weight: number; actors: string; requires?: Requirements; choices: Choice[]; ignore: IncidentEffect[] }
export const incidentDefinitions = data.incidents as Definition[]

export type Incident = { id: string; actors: string[]; at: number; expiresAt: number }
export type IncidentChange = { kind: EffectKind; amount: number; refId?: string }
export type IncidentLog = { id: string; choice: string; at: number; branch?: number; changes?: IncidentChange[] }

export function nextIncidentTime(seed: number, nonce: number, from: number): number {
  const rng = createRng(seed + nonce * data.seedStride + 1)
  return from + Math.round(timeRules.seasonMs * (data.minSeasonShare + rng.next() * (data.maxSeasonShare - data.minSeasonShare)))
}

function livingAdults(state: GameState) {
  return state.roster.filter((hero) => hero.condition !== 'dead' && !isChild(hero))
}

function hasAdultsAtHome(state: GameState) {
  const away = new Set(state.expeditions.flatMap(({ heroIds }) => heroIds))
  return livingAdults(state).filter(({ id }) => !away.has(id)).length >= data.minAdults
}

function meets(state: GameState, rules?: Requirements) {
  return !rules || (state.gold >= (rules.gold ?? 0) && state.fame >= (rules.fame ?? 0)
    && (!rules.building || state.buildings[rules.building] >= (rules.level ?? 1))
    && (!rules.adultsAtHome || hasAdultsAtHome(state))
    && (!rules.noFestival || state.festival?.season !== seasonKey(state.calendar)))
}

function actorGroups(state: GameState, rule: string, now: number): string[][] {
  if (rule === 'none') return [[]]
  const busy = busyHeroIds(state)
  const present = state.roster.filter(({ id, condition }) => condition !== 'dead' && !busy.has(id))
  const adults = present.filter((hero) => !isChild(hero))
  const children = present.filter(isChild)
  if (rule === 'child') return children.map(({ id }) => [id])
  if (rule === 'childHelper') return children.flatMap((child) => {
    const helpers = adults.filter((hero) => !child.parents?.includes(hero.id))
    return helpers.length ? helpers.map((hero) => [child.id, hero.id]) : [[child.id]]
  })
  if (rule === 'tank') {
    const tanks = adults.filter(({ classId }) => classById(classId).role === 'tank')
    return tanks.length ? tanks.map(({ id }) => [id]) : [[]]
  }
  if (rule === 'bereaved') return adults.filter((hero) => state.graveyard.some((grave) =>
    (grave.diedAt != null ? now - grave.diedAt >= 0 && now - grave.diedAt < 4 * timeRules.seasonMs
      : grave.year != null && state.calendar.year - grave.year >= 0 && state.calendar.year - grave.year <= 1)
    && (grave.friends?.includes(hero.id) || grave.spouseId === hero.id || grave.parents?.includes(hero.id) || hero.parents?.includes(grave.id)),
  )).map(({ id }) => [id])

  return adults.flatMap((first, index) => adults.slice(index + 1).filter((second) =>
    rule === 'clash' ? partyFit(first, [second]) < 0
      : rule === 'sameClass' ? first.classId === second.classId
        : rule === 'friends' && canCourt(first, second, now) && bondOf(state, first.id, second.id) >= familyRules.friendAt,
  ).map((second) => [first.id, second.id]))
}

export function incidentChoices(state: GameState) {
  const incident = state.incident
  const definition = incidentDefinitions.find(({ id }) => id === incident?.id)
  if (!definition || !incident) return []
  const valid = incidentValid(state, definition, incident, state.lastTickAt)
  return definition.choices.map((choice) => ({ ...choice, reason: !valid ? 'changed' as const : choiceReason(state, incident, choice) }))
}

function choiceReason(state: GameState, incident: Incident, choice: Choice) {
  if (state.gold < (choice.cost?.gold ?? 0)) return 'poor' as const
  if (!meets(state, choice.requires) || incident.actors.length < (choice.actorCount ?? 0)
    || Object.entries(choice.cost ?? {}).some(([key, amount]) => key !== 'gold' && state.materials[key as MaterialName] < amount)) return 'locked' as const
  return null
}

function incidentValid(state: GameState, definition: Definition, incident: Incident, now: number) {
  const busy = busyHeroIds(state)
  if (!meets(state, definition.requires) || incident.actors.some((id) =>
    busy.has(id) || !state.roster.some((hero) => hero.id === id && hero.condition !== 'dead'))) return false
  if (!incident.actors.length && definition.actors === 'tank') return true
  return actorGroups(state, definition.actors, now).some((group) => incident.actors.every((id, i) => id === group[i])
    && (group.length === incident.actors.length || (definition.actors === 'childHelper' && incident.actors.length === 1)))
}

export function applyIncidentEffects(state: GameState, actors: string[], effects: readonly IncidentEffect[], rng: Rng, now: number) {
  let next = state
  const changes: IncidentChange[] = []
  const record = (kind: EffectKind, amount: number, refId?: string) => {
    if (amount) changes.push({ kind, amount, ...(refId ? { refId } : {}) })
  }
  for (const { kind, amount, resource, target, emotion } of effects) {
    if (kind === 'nothing') continue
    if (kind === 'gold' || kind === 'fame') {
      const value = Math.max(0, next[kind] + amount)
      record(kind, value - next[kind])
      next = { ...next, [kind]: value }
    } else if (kind === 'materials' || kind === 'vault') {
      const bucket = next[kind] as Record<string, number>
      if (!resource || !Object.hasOwn(bucket, resource)) continue
      const value = Math.max(0, bucket[resource]! + amount)
      record(kind, value - bucket[resource]!, resource)
      next = { ...next, [kind]: { ...bucket, [resource]: value } }
    } else if (kind === 'affinity') {
      const [a, b] = actors
      if (!a || !b) continue
      const before = bondOf(next, a, b)
      next = { ...next, bonds: addAffinity(next.bonds, a, b, amount) }
      record(kind, bondOf(next, a, b) - before)
    } else if (kind === 'visitor') {
      if (next.visitors.length >= visitorCap(next.buildings.inn)) continue
      const visitorNonce = next.visitorNonce + 1
      const level = townLevelOf(next)
      const hero = generateHero(rng, `${next.seed}-v${visitorNonce}`, level.visitorPotential, femaleChance(next))
      next = { ...next, visitorNonce, visitors: [...next.visitors, { ...arrive(hero, rng, level.level), arrivedAt: now }] }
      record(kind, 1, hero.name)
    } else if (kind === 'gear') {
      const craftNonce = next.craftNonce + 1
      const gear = rollDrop(Math.min(data.gearMaxTier, townLevelOf(next).level), `${next.seed}-i${craftNonce}`, rng)
      if (!gear) continue
      next = { ...next, craftNonce, stash: [...next.stash, gear] }
      record(kind, 1, gear.recipeId)
    } else {
      const busy = target === 'home' ? busyHeroIds(next) : null
      const child = target === 'family' ? next.roster.find(({ id }) => id === actors[0]) : undefined
      const ids = target === 'first' ? [actors[0]] : target === 'second' ? [actors[1]]
        : target === 'family' ? [actors[0], ...(child?.parents ?? [])] : actors
      next = { ...next, roster: next.roster.map((hero) => {
        if (hero.condition === 'dead' || busy?.has(hero.id) || (target !== 'town' && target !== 'home' && !ids.includes(hero.id))) return hero
        let changed: Hero
        if (kind === 'morale') {
          changed = feel(hero, emotion ?? 'joy', amount)
          record(kind, moraleOf(changed) - moraleOf(hero), hero.name)
        } else if (kind === 'fatigue') {
          changed = { ...hero, fatigue: Math.max(0, Math.min(100, hero.fatigue + amount)) }
          record(kind, changed.fatigue - hero.fatigue, hero.name)
        } else {
          changed = gainXp(hero, amount, { gear: false })
          const total = (person: Hero) => person.xp + progression.xpPerLevel * person.level * (person.level - 1) / 2
          record(kind, total(changed) - total(hero), hero.name)
        }
        return changed
      }) }
    }
  }
  return { state: next, changes }
}

function closeIncident(state: GameState, incident: Incident, result: IncidentLog) {
  return {
    ...state, notice: null, incident: null,
    nextIncidentAt: state.nextIncidentAt > result.at ? state.nextIncidentAt : nextIncidentTime(state.seed, state.incidentNonce, result.at),
    incidentLog: [...state.incidentLog, { ...result, id: incident.id }].slice(-data.logSize),
  }
}

export function resolveIncident(state: GameState, choiceId: string): GameState {
  const incident = state.incident
  const definition = incidentDefinitions.find(({ id }) => id === incident?.id)
  const choice = definition?.choices.find(({ id }) => id === choiceId)
  if (!incident || !definition || !choice) return { ...state, notice: 'missing' }
  const at = state.lastTickAt
  if (at >= incident.expiresAt) return expireIncident(state, incident)
  if (!incidentValid(state, definition, incident, at)) {
    return closeIncident(state, incident, { id: incident.id, choice: 'changed', at })
  }
  const reason = choiceReason(state, incident, choice)
  if (reason) return { ...state, notice: reason }
  const rng = createRng(state.seed + state.incidentNonce * data.seedStride + 3)
  let branch: number | undefined
  if (choice.outcomes?.length) {
    let roll = rng.next()
    const index = choice.outcomes.findIndex(({ chance }) => (roll -= chance) < 0)
    branch = index < 0 ? choice.outcomes.length - 1 : index
  }
  const payment: IncidentEffect[] = Object.entries(choice.cost ?? {}).map(([resource, amount]) =>
    ({ kind: resource === 'gold' ? 'gold' : 'materials', resource, amount: -amount }))
  const applied = applyIncidentEffects(state, incident.actors, [...payment, ...choice.effects, ...(branch == null ? [] : choice.outcomes![branch]!.effects)], rng, at)
  return closeIncident(applied.state, incident, { id: incident.id, choice: choice.id, at, branch, changes: applied.changes })
}

function expireIncident(state: GameState, incident: Incident): GameState {
  const definition = incidentDefinitions.find(({ id }) => id === incident.id)!
  const at = incident.expiresAt
  const applied = incidentValid(state, definition, incident, at)
    ? applyIncidentEffects(state, incident.actors, definition.ignore, createRng(state.seed + state.incidentNonce * data.seedStride + 5), at)
    : { state, changes: [] }
  return { ...closeIncident(applied.state, incident, { id: incident.id, choice: 'ignore', at, changes: applied.changes }), notice: state.notice }
}

export function advanceIncident(state: GameState, now: number): GameState {
  if (state.incident) return now >= state.incident.expiresAt ? expireIncident(state, state.incident) : state
  if (now < state.nextIncidentAt) return state
  const available = livingAdults(state).length < data.minAdults ? [] : incidentDefinitions.flatMap((definition) => {
    if (state.recentIncidents.includes(definition.id) || !meets(state, definition.requires)) return []
    const groups = actorGroups(state, definition.actors, now)
    return groups.length ? [{ definition, groups }] : []
  })
  if (!available.length) return { ...state, nextIncidentAt: now + timeRules.seasonMs * data.retrySeasonShare }
  const incidentNonce = state.incidentNonce + 1
  const rng = createRng(state.seed + incidentNonce * data.seedStride)
  let roll = rng.next() * available.reduce((sum, { definition }) => sum + definition.weight, 0)
  const selected = available.find(({ definition }) => (roll -= definition.weight) < 0) ?? available.at(-1)!
  const id = selected.definition.id
  const at = state.nextIncidentAt
  const incident = { id, actors: rng.pick(selected.groups)!, at, expiresAt: at + data.durationSeasons * timeRules.seasonMs }
  const next = {
    ...state, incidentNonce, incident, recentIncidents: [...state.recentIncidents, id].slice(-data.recent),
    nextIncidentAt: nextIncidentTime(state.seed, incidentNonce, at),
  }
  return now >= incident.expiresAt ? expireIncident(next, incident) : next
}

export function readIncidentState(record: Record<string, unknown>, now: number) {
  const validIds = new Set(incidentDefinitions.map(({ id }) => id))
  const timestamp = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0
  const incident = record.incident as Partial<Incident> | null | undefined
  const valid = incident && typeof incident.id === 'string' && validIds.has(incident.id) && timestamp(incident.at)
    && timestamp(incident.expiresAt) && incident.expiresAt > incident.at && Array.isArray(incident.actors)
    && incident.actors.every((id) => typeof id === 'string' && id.length > 0) && new Set(incident.actors).size === incident.actors.length
  const log = Array.isArray(record.incidentLog) ? record.incidentLog.flatMap((item) => {
    if (!item || typeof item !== 'object' || !timestamp(item.at)) return []
    const definition = incidentDefinitions.find(({ id }) => id === item.id)
    const choice = definition?.choices.find(({ id }) => id === item.choice)
    if (!definition || (!choice && item.choice !== 'ignore' && item.choice !== 'changed')) return []
    const branch = Number.isInteger(item.branch) && item.branch >= 0 && item.branch < (choice?.outcomes?.length ?? 0) ? item.branch as number : undefined
    const kinds = new Set(['gold', 'materials', 'vault', 'fame', 'morale', 'affinity', 'fatigue', 'xp', 'visitor', 'gear', 'nothing'])
    const changes = Array.isArray(item.changes) ? item.changes.filter((change: Partial<IncidentChange> | null) =>
      change && change.kind && kinds.has(change.kind) && typeof change.amount === 'number'
      && Number.isFinite(change.amount) && (change.refId == null || typeof change.refId === 'string')) as IncidentChange[] : undefined
    return [{ id: definition.id, choice: item.choice as string, at: item.at, branch, changes }]
  }).slice(-data.logSize) : []
  return {
    incident: valid ? incident as Incident : null,
    incidentNonce: timestamp(record.incidentNonce) && Number.isSafeInteger(record.incidentNonce) ? record.incidentNonce : 0,
    nextIncidentAt: timestamp(record.nextIncidentAt) ? record.nextIncidentAt : now + data.minSeasonShare * timeRules.seasonMs,
    recentIncidents: Array.isArray(record.recentIncidents) ? [...new Set(record.recentIncidents.filter((id): id is string => validIds.has(id)))].slice(-data.recent) : [],
    incidentLog: log,
  }
}
