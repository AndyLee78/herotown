// Run: npx tsx tools/abyss-probe.ts
// How deep a fresh party at a given level and gear gets in the abyss, run
// after run from the checkpoint, and how often each weekday trial is won
// (Docs/endgame.md 4a tuning).
import { specialDungeons } from '../src/core/data'
import { DEFAULT_TACTICS, runDungeon } from '../src/core/dungeon'
import { forgeGear, recipeById } from '../src/core/gear'
import { createHero } from '../src/core/hero'
import { abyssFloors } from '../src/core/trials'
import type { PartyMember } from '../src/core/types'
import { starterParties } from './curve'

const samples = starterParties(12)
type Grade = 'starter' | 'fine' | 'rare' | 'epic'

function withLevel(members: PartyMember[], level: number, grade: Grade): PartyMember[] {
  const blade = { fine: 'fine.blade', rare: 'flame.blade', epic: 'epic.blade' } as const
  const mail = { fine: 'fine.mail', rare: 'fine.mail', epic: 'epic.mail' } as const
  return members.map(({ hero, row }) => ({
    row,
    hero: createHero({
      ...hero,
      level,
      training: level - 1,
      ...(grade === 'starter' ? {} : { gear: [forgeGear(recipeById(blade[grade])!, `${hero.id}-b`), forgeGear(recipeById(mail[grade])!, `${hero.id}-m`)] }),
    }),
  }))
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)] ?? 0
}

function depth(party: PartyMember[], seed: number): number {
  let checkpoint = 0
  for (let run = 0; run < 60; run += 1) {
    const result = runDungeon(party, 'abyss', DEFAULT_TACTICS, seed + run * 31, {}, { floors: abyssFloors(checkpoint) })
    if (!result.ok || result.report.floorsCleared < 5) {
      return checkpoint + (result.ok ? result.report.floorsCleared : 0)
    }
    checkpoint += 5
  }
  return checkpoint
}

console.log('abyss depth (median of', samples.length, 'parties)')
for (const [level, grade] of [[12, 'starter'], [15, 'starter'], [15, 'fine'], [18, 'fine'], [20, 'rare'], [24, 'rare'], [28, 'epic'], [32, 'epic']] as const) {
  const depths = samples.map((party, index) => depth(withLevel(party, level, grade), 1000 + index))
  console.log(`Lv${level} ${grade}: ${median(depths)} (min ${Math.min(...depths)}, max ${Math.max(...depths)})`)
}

console.log('\nweekday trial wins out of', samples.length * 3)
for (const level of [12, 14, 16, 18]) {
  const row = specialDungeons
    .filter((dungeon) => dungeon.special === 'weekday')
    .map((dungeon) => {
      let wins = 0
      samples.forEach((party, index) => {
        for (let seed = 0; seed < 3; seed += 1) {
          const result = runDungeon(withLevel(party, level, 'fine'), dungeon.id, DEFAULT_TACTICS, 77 + index * 13 + seed)
          if (result.ok && result.report.victory) wins += 1
        }
      })
      return `${dungeon.id.replace('trial_', '')} ${wins}`
    })
  console.log(`Lv${level}: ${row.join(' | ')}`)
}
