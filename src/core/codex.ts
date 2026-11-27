import rules from '../data/codex.json'
import { classList, dungeons, giftRules, lootRules, monsters, specialDungeons, villageRules } from './data'
import type { GameState } from './game'
import type { DungeonReport, Gear } from './types'

export const codexEntries: Record<'monsters' | 'elites' | 'uniques' | 'sets' | 'gifts' | 'classes', string[]> = {
  monsters: monsters.map(({ id }) => id),
  elites: monsters.filter(({ boss }) => !boss).map(({ id }) => id),
  uniques: lootRules.uniques.map(({ id }) => id),
  sets: lootRules.sets.map(({ id }) => id),
  gifts: giftRules.gifts.map(({ id }) => id),
  classes: classList.map(({ id }) => id),
}
export const codexDungeons = [...dungeons, ...specialDungeons].map(({ id }) => id)
export type Codex = Record<keyof typeof codexEntries, string[]>
export const achievementRules = rules.achievements

export function readCodex(value: unknown): Codex {
  const source = value && typeof value === 'object' ? value as Partial<Codex> : {}
  return Object.fromEntries(Object.entries(codexEntries).map(([key, ids]) => {
    const items = source[key as keyof Codex]
    return [key, Array.isArray(items) ? [...new Set(items.filter((id) => ids.includes(id)))] : []]
  })) as Codex
}

export function readAchievements(value: unknown): string[] {
  return Array.isArray(value) ? [...new Set(value.filter((id) => achievementRules.some((rule) => rule.id === id)))] : []
}

function add(codex: Codex, key: keyof Codex, id: string | undefined): Codex {
  return id && codexEntries[key].includes(id) && !codex[key].includes(id)
    ? { ...codex, [key]: [...codex[key], id] } : codex
}

export function recordEncounter(codex: Codex, report: DungeonReport): Codex {
  for (const floor of report.floors ?? []) for (const unit of floor) {
    if (unit.side !== 'enemy') continue
    codex = add(codex, 'monsters', unit.refId)
    if (unit.elite) codex = add(codex, 'elites', unit.refId)
  }
  for (const entry of report.log ?? []) if (entry.key === 'log.summon' && typeof entry.params.refs === 'string') {
    for (const ref of entry.params.refs.split(',')) codex = add(codex, 'monsters', ref)
  }
  return codex
}

function recordGear(codex: Codex, gear: readonly Gear[]) {
  for (const item of gear) codex = add(codex, 'uniques', item.unique)
  return codex
}

export function recordLoot<T extends { codex?: Codex }>(state: T, gear: readonly Gear[]): T {
  if (!state.codex) return state
  const codex = recordGear(state.codex, gear)
  return codex === state.codex ? state : { ...state, codex }
}

export function recordCollection(state: GameState): GameState {
  let codex = recordGear(state.codex, state.stash)
  for (const hero of [...state.roster, ...state.retirees.map(({ hero }) => hero)]) {
    codex = add(add(codex, 'classes', hero.classId), 'gifts', hero.gift)
    codex = recordGear(codex, hero.gear)
    const equipped = new Set(hero.gear.map(({ unique }) => unique))
    for (const set of lootRules.sets) {
      if (lootRules.uniques.filter(({ id, set: group }) => group === set.id && equipped.has(id)).length >= 3) {
        codex = add(codex, 'sets', set.id)
      }
    }
  }
  for (const grave of state.graveyard) codex = add(add(codex, 'classes', grave.classId), 'gifts', grave.gift)
  return codex === state.codex ? state : { ...state, codex }
}

export function recordDungeonClear(state: GameState, id: string): GameState {
  return codexDungeons.includes(id) && !state.cleared.includes(id) ? { ...state, cleared: [...state.cleared, id] } : state
}

export function restoreCollection(state: GameState): GameState {
  let next = recordLoot(recordCollection(state), [
    ...(state.shrine?.gear ?? []),
    ...state.loot.flatMap(({ gear }) => gear ? [gear] : []),
  ])
  for (const report of state.history.slice().reverse()) {
    next = { ...next, codex: recordEncounter(next.codex, report) }
    if (report.victory && report.dungeonId) next = recordDungeonClear(next, report.dungeonId)
  }
  if (state.raidKills > 0) next = recordDungeonClear(next, 'raid')
  if (state.invasion?.wins) next = recordDungeonClear(next, 'invasion')
  return next
}

function generations(people: (GameState['graveyard'][number] | GameState['roster'][number])[]) {
  const ids = new Map(people.map((hero) => [hero.id, hero]))
  return people.some(({ id, parents }) => parents?.some((parent) => parent !== id && ids.get(parent)?.parents?.some((ancestor) => ancestor !== id && ancestor !== parent)))
    ? 3 : people.some(({ parents }) => parents?.length) ? 2 : people.length ? 1 : 0
}

export function achievementProgress(state: GameState, townLevel: number) {
  const people = [...state.roster, ...state.retirees.map(({ hero }) => hero), ...state.graveyard]
  const counts: Record<string, number> = {
    ...Object.fromEntries(Object.entries(state.codex).map(([key, value]) => [key, value.length])),
    clears: new Set(state.cleared).size,
    raids: state.raidKills,
    abyss: state.abyss.best,
    town: townLevel,
    heroes: state.roster.filter(({ condition }) => condition !== 'dead').length + state.retirees.length,
    buildings: Math.min(...villageRules.buildings.map(({ id }) => state.buildings[id as keyof GameState['buildings']])),
    marriage: Number(people.some((hero) => hero.spouseId || ('widowedAt' in hero && hero.widowedAt != null))),
    birth: Number(people.some(({ parents }) => parents?.length)),
    generations: generations(people),
    legends: state.graveyard.filter(({ legend }) => legend).length,
  }
  return achievementRules.map((rule) => {
    const current = counts[rule.kind] ?? 0
    const target = typeof rule.target === 'number' ? rule.target : rule.kind === 'clears' ? codexDungeons.length : codexEntries[rule.kind as keyof Codex].length
    const claimed = state.achievements.includes(rule.id)
    return { ...rule, current, target, claimed, ready: !claimed && current >= target }
  })
}

export function claimAchievement(state: GameState, id: string, townLevel: number): GameState {
  const entry = achievementProgress(state, townLevel).find((rule) => rule.id === id)
  if (!entry || entry.claimed) return { ...state, notice: 'missing' }
  if (!entry.ready) return { ...state, notice: 'locked' }
  const { gold = 0, fame = 0, ...spoils } = entry.reward
  const vault = { ...state.vault }
  for (const [key, quantity] of Object.entries(spoils)) {
    vault[key as keyof typeof vault] += quantity ?? 0
  }
  return { ...state, notice: null, gold: state.gold + gold, fame: state.fame + fame, vault, achievements: [...state.achievements, id] }
}
