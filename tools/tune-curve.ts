// Finds each dungeon's monsterScale so a party of ordinary visitors first
// meets the win-rate threshold at the target level. Prints the candidate
// scale and its measured win rate. Run: npx tsx tools/tune-curve.ts [samples]
import { dungeons } from '../src/core/data'
import { winRate } from './curve'

const TARGET: Record<string, number> = { hill_cave: 1, moss_path: 2, abandoned_mine: 4, deep_shaft: 5, barrow: 7, sunken_crypt: 9 }
const TARGET_WIN_RATE = 0.6
const samples = Number(process.argv[2] ?? 30)

function firstWinningLevel(dungeonId: string, ceiling: number): number {
  for (let level = 1; level <= ceiling; level += 1) {
    if (winRate(dungeonId, level, samples) >= TARGET_WIN_RATE) {
      return level
    }
  }
  return ceiling + 1
}

for (const dungeon of dungeons) {
  const target = TARGET[dungeon.id] ?? 1
  let scale = 1
  dungeon.monsterScale = scale
  // Raise the scale until the party needs the target level, then stop.
  while (scale < 6 && firstWinningLevel(dungeon.id, target - 1) < target) {
    scale = Math.round((scale + 0.05) * 100) / 100
    dungeon.monsterScale = scale
  }
  const level = firstWinningLevel(dungeon.id, 14)
  const targetWinRate = winRate(dungeon.id, target, samples)
  const status = targetWinRate < TARGET_WIN_RATE ? '목표 미달' : level < target ? '목표보다 낮은 레벨에서 달성' : '목표 달성'
  console.log(dungeon.id, JSON.stringify({ scale, level, target, targetWinRate, status }))
}
