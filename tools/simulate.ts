import { dungeonById, progression } from '../src/core/data'
import { DEFAULT_TACTICS, runDungeon } from '../src/core/dungeon'
import { createHero } from '../src/core/hero'
import type { ClassId, PartyMember, Row, Stats, Tactics } from '../src/core/types'

const adult: Record<ClassId, Stats> = {
  warrior: { str: 15, agi: 10, vit: 15, int: 4, wil: 8, wis: 4 },
  rogue: { str: 8, agi: 16, vit: 8, int: 5, wil: 6, wis: 5 },
  archer: { str: 7, agi: 15, vit: 8, int: 6, wil: 7, wis: 6 },
  mage: { str: 4, agi: 9, vit: 7, int: 16, wil: 8, wis: 9 },
  cleric: { str: 5, agi: 8, vit: 10, int: 7, wil: 11, wis: 16 },
  bard: { str: 5, agi: 10, vit: 9, int: 8, wil: 14, wis: 8 },
  dancer: { str: 5, agi: 15, vit: 8, int: 6, wil: 12, wis: 7 },
}

export type CompName = 'standard' | 'dealers' | 'noHealer' | 'noTank' | 'twoSupports'

const comps: Record<CompName, [ClassId, Row][]> = {
  standard: [
    ['warrior', 'front'],
    ['rogue', 'front'],
    ['archer', 'back'],
    ['bard', 'back'],
    ['cleric', 'back'],
  ],
  dealers: [
    ['rogue', 'front'],
    ['archer', 'front'],
    ['mage', 'back'],
    ['rogue', 'back'],
    ['archer', 'back'],
  ],
  noHealer: [
    ['warrior', 'front'],
    ['rogue', 'front'],
    ['archer', 'back'],
    ['mage', 'back'],
    ['bard', 'back'],
  ],
  noTank: [
    ['rogue', 'front'],
    ['archer', 'front'],
    ['mage', 'back'],
    ['bard', 'back'],
    ['cleric', 'back'],
  ],
  twoSupports: [
    ['warrior', 'front'],
    ['rogue', 'front'],
    ['bard', 'back'],
    ['dancer', 'back'],
    ['cleric', 'back'],
  ],
}

// level also adds the training a hero of that level would have earned.
export function partyFor(name: CompName, level = 1): PartyMember[] {
  return comps[name].map(([classId, row], index) => ({
    hero: createHero({
      id: `${name}-${classId}-${index}`,
      name: classId,
      gender: classId === 'dancer' ? 'female' : 'male',
      classId,
      age: 28,
      potentials: adult[classId],
      level,
      training: (level - 1) * progression.trainingPerLevel,
    }),
    row,
  }))
}

export type Survey = {
  rate: number
  turns: number
}

export function survey(name: CompName, dungeonId: string, tactics: Tactics, runs: number, level = 1): Survey {
  let wins = 0
  let turns = 0
  const party = partyFor(name, level)
  for (let seed = 1; seed <= runs; seed += 1) {
    const result = runDungeon(party, dungeonId, tactics, seed)
    if (!result.ok) {
      continue
    }
    turns += result.report.ticks
    if (result.report.victory) {
      wins += 1
    }
  }
  return { rate: wins / runs, turns: turns / runs }
}

export function winRate(name: CompName, dungeonId: string, tactics: Tactics, runs: number, level = 1): number {
  return survey(name, dungeonId, tactics, runs, level).rate
}

export function balanceTable(runs = 1000): { text: string; rows: Record<CompName, { cave: Survey; mine: Survey }>; careful: number; reckless: number } {
  const names: CompName[] = ['standard', 'dealers', 'noHealer', 'noTank', 'twoSupports']
  const lines = ['comp        cave   mine   cave turns  mine turns']
  const rows = {} as Record<CompName, { cave: Survey; mine: Survey }>
  // The mine is judged at its recommended level, as players meet it.
  const mineLevel = dungeonById('abandoned_mine').recommendedLevel
  for (const name of names) {
    const cave = survey(name, 'hill_cave', DEFAULT_TACTICS, runs)
    const mine = survey(name, 'abandoned_mine', DEFAULT_TACTICS, runs, mineLevel)
    rows[name] = { cave, mine }
    lines.push(`${name.padEnd(12)}${pct(cave.rate)}  ${pct(mine.rate)}  ${Math.round(cave.turns).toString().padStart(6)}      ${Math.round(mine.turns).toString().padStart(6)}`)
  }
  const careful = winRate('standard', 'abandoned_mine', { ...DEFAULT_TACTICS, healBelow: 80 }, runs, mineLevel)
  const reckless = winRate('standard', 'abandoned_mine', { ...DEFAULT_TACTICS, healBelow: 0 }, runs, mineLevel)
  lines.push(`tactics heal80 ${pct(careful)}  heal0 ${pct(reckless)}  delta ${pct(Math.abs(careful - reckless))}`)
  return { text: `${lines.join('\n')}\n`, rows, careful, reckless }
}

export function pct(value: number): string {
  return `${Math.round(value * 100)}%`.padStart(4)
}
