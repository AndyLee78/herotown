import { classById, endgameRules } from './data'
import { DEFAULT_TACTICS, runDungeon } from './dungeon'
import type { GameState } from './game'
import { busyHeroIds, presetById } from './game'
import { canDeploy } from './hero'
import { feel } from './personality'
import { freshVault } from './trials'
import type { DungeonFloor, PartyMember } from './types'

// Town invasions (Docs/endgame.md 4c): from town level 9 a raiding band comes
// every three days, announced six hours ahead. Up to three chosen parties
// hold the line wave by wave; with none chosen, whoever is home steps up.
// Holding earns valour; failing costs supplies and spirits.

export type InvasionResult = { at: number; won: boolean; waves: number; lost?: { gold: number } }
export type Invasion = { nextAt: number; defenders: string[]; count: number; wins: number; last?: InvasionResult }

export function warned(state: GameState, now: number): boolean {
  return state.invasion != null && now >= state.invasion.nextAt - endgameRules.invasion.warnMs
}

export function setDefenders(state: GameState, presetIds: string[]): GameState {
  if (!state.invasion) {
    return { ...state, notice: 'noInvasion' }
  }
  const ids = [...new Set(presetIds)].filter((id) => presetById(state, id)).slice(0, endgameRules.invasion.maxDefenders)
  return { ...state, notice: null, invasion: { ...state.invasion, defenders: ids } }
}

function waves(count: number): DungeonFloor[] {
  const rules = endgameRules.invasion
  const scale = rules.scale * (1 + rules.scalePerInvasion * count)
  return rules.waves.map((monsters) => ({ monsters: [...monsters], scale }))
}

// The parties that hold the line: the chosen ones as they are at home, or
// with none chosen, the strongest five who are home and able.
function defenders(state: GameState): PartyMember[][] {
  const away = busyHeroIds(state)
  const able = (id: string) => {
    const hero = state.roster.find((entry) => entry.id === id)
    return hero && canDeploy(hero) && !away.has(id) && hero.condition !== 'critical' ? hero : null
  }
  const chosen = (state.invasion?.defenders ?? [])
    .map((id) => presetById(state, id))
    .map((preset) => (preset?.slots ?? []).flatMap((slot) => {
      const hero = able(slot.id)
      return hero ? [{ hero, row: slot.row }] : []
    }))
    .filter((party) => party.length > 0)
  if (chosen.length) {
    return chosen
  }
  const home = state.roster
    .map((hero) => able(hero.id))
    .filter((hero): hero is NonNullable<typeof hero> => hero != null)
    .sort((a, b) => b.level - a.level)
    .slice(0, 5)
  return home.length ? [home.map((hero) => ({ hero, row: classById(hero.classId).reach === 'melee' ? 'front' as const : 'back' as const }))] : []
}

// Battles the band when it arrives. `settle` applies a party's report the way
// an expedition home does (fatigue, wounds, no deaths in defence).
export function resolveInvasion(state: GameState, settle: (state: GameState, report: import('./types').DungeonReport, heroIds: string[]) => GameState): GameState {
  const invasion = state.invasion!
  const rules = endgameRules.invasion
  let floors = waves(invasion.count)
  let next = state
  let held = 0
  for (const party of defenders(state)) {
    if (!floors.length) {
      break
    }
    const result = runDungeon(party, 'invasion', DEFAULT_TACTICS, state.seed + 5_000_011 + invasion.count * 977 + held, {}, { floors })
    if (!result.ok) {
      continue
    }
    next = settle(next, result.report, party.map((member) => member.hero.id))
    held += result.report.floorsCleared
    floors = floors.slice(result.report.floorsCleared)
  }
  const won = floors.length === 0
  const base = { ...next.invasion!, nextAt: invasion.nextAt + rules.everyMs, count: invasion.count + 1, defenders: invasion.defenders }
  if (won) {
    const vault = { ...(next.vault ?? freshVault()) }
    vault.valor += rules.valor + rules.valorPer * invasion.count
    const proud = new Set(defenders(state).flat().map((member) => member.hero.id))
    return {
      ...next,
      vault,
      roster: next.roster.map((hero) => (proud.has(hero.id) ? feel(hero, 'pride', rules.pride) : hero)),
      invasion: { ...base, wins: invasion.wins + 1, last: { at: invasion.nextAt, won: true, waves: held } },
    }
  }
  // The raiders carry off a share of the gold and materials and leave the town shaken.
  const gold = Math.floor(next.gold * rules.loss)
  const materials = Object.fromEntries(Object.entries(next.materials).map(([key, amount]) => [key, amount - Math.floor(amount * rules.loss)])) as GameState['materials']
  return {
    ...next,
    gold: next.gold - gold,
    materials,
    roster: next.roster.map((hero) => feel(hero, 'anxiety', -rules.dread)),
    invasion: { ...base, last: { at: invasion.nextAt, won: false, waves: held, lost: { gold } } },
  }
}
