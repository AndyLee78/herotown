// Prints the difficulty curve. Run: npx vite-node tools/print-curve.ts [samples] [maxLevel]
import { dungeons } from '../src/core/data'
import { winRate } from './curve'

{
  const samples = Number(process.argv[2] ?? 30)
  const maxLevel = Number(process.argv[3] ?? 12)
  const header = ['dungeon'.padEnd(16), ...Array.from({ length: maxLevel }, (_, i) => `L${i + 1}`.padStart(5))].join('')
  console.log(header)
  for (const dungeon of dungeons) {
    const row = [dungeon.id.padEnd(16)]
    for (let level = 1; level <= maxLevel; level += 1) {
      row.push(`${Math.round(winRate(dungeon.id, level, samples) * 100)}%`.padStart(5))
    }
    console.log(row.join(''))
  }
}
