import data from '../data/titles.json'
import type { GameState } from './game'
import type { DeedKey, DungeonReport, SkillEffect, TitleHistory, TitleId, TitleRecord } from './types'

export const titleRules = data as { id: TitleId; deed: DeedKey; threshold: number; effect: SkillEffect }[]
export const validTitle = (id: unknown): id is TitleId => titleRules.some(rule => rule.id === id)
const count = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0

export function readTitles(raw: TitleHistory): TitleHistory {
  const deeds = Object.fromEntries(titleRules.flatMap(({ deed }) => count(raw.deeds?.[deed]) ? [[deed, raw.deeds![deed]]] : []))
  const titles = Array.isArray(raw.titles) ? [...new Set(raw.titles.filter(validTitle))].slice(0, 3) : []
  const titleDates = Object.fromEntries(titles.flatMap(id => count(raw.titleDates?.[id]) ? [[id, raw.titleDates![id]]] : []))
  return { ...(Object.keys(deeds).length ? { deeds } : {}), ...(titles.length ? { titles, titleDates } : {}) }
}

export function readTitleLog(raw: unknown): TitleRecord[] {
  return Array.isArray(raw) ? raw.filter(row => row && typeof row.heroId === 'string' && validTitle(row.title) && count(row.at)).slice(-20) : []
}

export function recordTripTitles(state: GameState, report: DungeonReport, ids: string[], at: number, abyssFrom?: number, raidKill = false): GameState {
  const participants = new Set(ids)
  const gains: TitleRecord[] = []
  const fallen = new Set<string>()
  const undead = new Map<string, number>()
  const elites = new Map<string, number>()
  const bosses = new Set<string>()
  const dragons = new Set<string>()
  let floor = 0
  for (const { key, params } of report.log) {
    if (key === 'log.floor') floor = Number(params.floor) - 1
    if (key === 'log.undying' || key === 'log.down') fallen.add(String(params.actorId))
    if (key !== 'log.down') continue
    const killer = String(params.killerId)
    if (params.kind === 'undead' || params.kind === 'spirit') undead.set(killer, (undead.get(killer) ?? 0) + 1)
    if (params.elite) elites.set(killer, (elites.get(killer) ?? 0) + 1)
    if (params.boss) {
      for (const unit of report.floors?.[floor] ?? []) {
        if (unit.side !== 'hero' || unit.hp <= 0) continue
        bosses.add(unit.id)
        if (params.kind === 'dragon') dragons.add(unit.id)
      }
    }
  }
  function update<T extends TitleHistory & { id: string }>(hero: T, survived: boolean): T {
    if (!participants.has(hero.id)) return hero
    const id = hero.id
    const deeds = { ...hero.deeds }
    const delta = { wins: Number(report.victory), losses: Number(!report.victory && survived), bossKills: Number(bosses.has(id)),
      dragonKills: Number(dragons.has(id)), undeadKills: undead.get(id), eliteKills: elites.get(id), raidKills: Number(raidKill),
      downed: Number(survived && fallen.has(id)), healed: report.units.find(unit => unit.id === id)?.healed }
    for (const rule of titleRules) {
      if (rule.deed === 'abyssBest') continue
      const n = delta[rule.deed]
      if (n) deeds[rule.deed] = (deeds[rule.deed] ?? 0) + n
    }
    if (abyssFrom != null) deeds.abyssBest = Math.max(deeds.abyssBest ?? 0, abyssFrom + report.floorsCleared)
    const titles = [...(hero.titles ?? [])]
    const titleDates = { ...hero.titleDates }
    for (const rule of titleRules) {
      if (titles.length >= 3) break
      if (titles.includes(rule.id) || (deeds[rule.deed] ?? 0) < rule.threshold) continue
      titles.push(rule.id)
      titleDates[rule.id] = at
      gains.push({ heroId: id, title: rule.id, at })
    }
    return { ...hero, deeds, ...(titles.length ? { titles, titleDates } : {}) }
  }
  const roster = state.roster.map(hero => update(hero, hero.condition !== 'dead'))
  const graveyard = state.graveyard.map(grave => update(grave, false))
  return { ...state, roster, graveyard, ...(gains.length ? {
    titleLog: [...state.titleLog, ...gains].slice(-20),
    discoveredTitles: [...new Set([...state.discoveredTitles, ...gains.map(row => row.title)])],
  } : {}) }
}
