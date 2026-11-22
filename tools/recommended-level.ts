import { dungeons } from '../src/core/data'
import { DEFAULT_TACTICS, runDungeon } from '../src/core/dungeon'
import type { PartyMember } from '../src/core/types'
import { partyFor } from './simulate'

const runs = Number(process.argv[2] ?? 40)
const maxLevel = Number(process.argv[3] ?? 8)

export function standardAt(level: number): PartyMember[] {
  return partyFor('standard').map((member) => ({
    ...member,
    hero: { ...member.hero, level },
  }))
}

// Lowest average level where the standard party wins more than 60%.
// Level does not change combat stats, so this is usually 1 when level 1 already clears.
export function clearingLevel(dungeonId: string, sample = runs, ceiling = maxLevel): number | null {
  for (let level = 1; level <= ceiling; level += 1) {
    const party = standardAt(level)
    let wins = 0
    for (let seed = 1; seed <= sample; seed += 1) {
      const result = runDungeon(party, dungeonId, DEFAULT_TACTICS, seed)
      if (result.ok && result.report.victory) {
        wins += 1
      }
    }
    if (wins / sample > 0.6) {
      return level
    }
  }
  return null
}

const invoked = process.argv.some((arg) => arg.replaceAll('\\', '/').includes('recommended-level.ts'))
if (invoked) {
  for (const dungeon of dungeons) {
    const level = clearingLevel(dungeon.id)
    console.log(`${dungeon.id}\trecommended ${level ?? 'none'}`)
  }
}
