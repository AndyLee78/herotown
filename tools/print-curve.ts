// Run: npx tsx tools/print-curve.ts [samples] [maxLevel] [--fixed]
import { dungeons } from '../src/core/data'
import { BATTLES_PER_PARTY, DEFAULT_PARTY_SAMPLES, starterParties, starterWinRates, winRate } from './curve'

const args = process.argv.slice(2)
const fixed = args.includes('--fixed')
const [sampleArg, maxLevelArg] = args.filter((arg) => arg !== '--fixed')
const samples = Number(sampleArg ?? DEFAULT_PARTY_SAMPLES)
const maxLevel = Number(maxLevelArg ?? 12)
if (!Number.isSafeInteger(samples) || samples < 1 || !Number.isSafeInteger(maxLevel) || maxLevel < 1) {
  throw new Error('Usage: npx tsx tools/print-curve.ts [positive samples] [positive maxLevel] [--fixed]')
}
const percent = (rate: number) => `${Math.round(rate * 100)}%`
const parties = fixed ? [] : starterParties(samples)
const width = fixed ? 6 : 11
console.log(fixed ? `Fixed lineup · ${samples} battles` : `Median/P25 · ${samples} starter parties × ${BATTLES_PER_PARTY} battles`)
console.log(['dungeon'.padEnd(18), ...Array.from({ length: maxLevel }, (_, i) => `L${i + 1}`.padStart(width))].join(''))

const weakestAtRecommended: string[] = []
for (const dungeon of dungeons) {
  const row = [dungeon.id.padEnd(18)]
  for (let level = 1; level <= maxLevel; level += 1) {
    if (fixed) {
      row.push(percent(winRate(dungeon.id, level, samples)).padStart(width))
      continue
    }
    const { median, lowerQuartile, weakest } = starterWinRates(parties, dungeon.id, level)
    row.push(`${percent(median)}/${percent(lowerQuartile)}`.padStart(width))
    if (level === dungeon.recommendedLevel) {
      weakestAtRecommended.push(`${dungeon.id} L${level}: ${percent(weakest.rate)} · seed ${weakest.partySeed} · ${weakest.classes.join('/')}`)
    }
  }
  console.log(row.join(''))
}
if (weakestAtRecommended.length) {
  console.log('\nWeakest sampled lineup at each displayed recommended level')
  console.log(weakestAtRecommended.join('\n'))
}
