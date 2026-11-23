// Difficulty curve: win rate of a party of ordinary visitors per dungeon as
// they level up. Run: npx vite-node tools/curve.ts [runs] [maxLevel]
import { progression } from '../src/core/data'
import { DEFAULT_TACTICS, runDungeon } from '../src/core/dungeon'
import { createHero, generateHero } from '../src/core/hero'
import { createRng } from '../src/core/rng'
import type { ClassId, Hero, PartyMember, Row } from '../src/core/types'

const LINEUP: [ClassId, Row][] = [
  ['warrior', 'front'],
  ['rogue', 'front'],
  ['archer', 'back'],
  ['mage', 'back'],
  ['cleric', 'back'],
]

// A typical hire for each class: the first visitor of that class from fixed seeds.
function typicalParty(sample: number): Hero[] {
  return LINEUP.map(([classId], slot) => {
    for (let seed = sample * 1000 + slot * 97; ; seed += 1) {
      const hero = generateHero(createRng(seed), `c${slot}-${seed}`, 0)
      if (hero.classId === classId) {
        return hero
      }
    }
  })
}

export function partyAtLevel(heroes: Hero[], level: number): PartyMember[] {
  return heroes.map((hero, index) => ({
    row: LINEUP[index]?.[1] ?? 'back',
    hero: createHero({ ...hero, level, training: (level - 1) * progression.trainingPerLevel }),
  }))
}

export function winRate(dungeonId: string, level: number, samples: number): number {
  let wins = 0
  for (let sample = 0; sample < samples; sample += 1) {
    const result = runDungeon(partyAtLevel(typicalParty(sample), level), dungeonId, DEFAULT_TACTICS, sample + 1)
    if (result.ok && result.report.victory) {
      wins += 1
    }
  }
  return wins / samples
}
