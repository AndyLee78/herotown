// Finds each dungeon's monsterScale so a party of ordinary visitors first
// wins 60% of the time at the target level. Prints JSON to paste into
// src/data/dungeons.json. Run: npx vite-node tools/tune-curve.ts [samples]
import { dungeons } from '../src/core/data'
import { winRate } from './curve'

const TARGET: Record<string, number> = { hill_cave: 1, moss_path: 2, abandoned_mine: 4, deep_shaft: 5, barrow: 7, sunken_crypt: 9 }
const samples = Number(process.argv[2] ?? 30)

function firstWinningLevel(dungeonId: string, ceiling: number): number {
  for (let level = 1; level <= ceiling; level += 1) {
    if (winRate(dungeonId, level, samples) >= 0.6) {
      return level
    }
  }
  return ceiling + 1
}

const result: Record<string, { scale: number; level: number }> = {}
for (const dungeon of dungeons) {
  const target = TARGET[dungeon.id] ?? 1
  let scale = 1
  dungeon.monsterScale = scale
  // Raise the scale until the party needs the target level, then stop.
  while (firstWinningLevel(dungeon.id, target + 3) < target && scale < 6) {
    scale = Math.round((scale + 0.05) * 100) / 100
    dungeon.monsterScale = scale
  }
  result[dungeon.id] = { scale, level: firstWinningLevel(dungeon.id, 14) }
  console.log(dungeon.id, JSON.stringify(result[dungeon.id]))
}
