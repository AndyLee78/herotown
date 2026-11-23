// Run: npx tsx tools/print-curve.ts [samples] [maxLevel] [--fixed|--marsh]
// Reproduce the design sample size: npx tsx tools/print-curve.ts --marsh 24 14 --battles=6
import { alchemyRules, dungeonById, dungeons, potionById, villageRules } from '../src/core/data'
import type { PotionId } from '../src/core/types'
import { BATTLES_PER_PARTY, DEFAULT_PARTY_SAMPLES, MARSH_ID, marshLoadouts, starterParties, starterWinRates, winRate } from './curve'

const args = process.argv.slice(2)
const fixed = args.includes('--fixed')
const marsh = args.includes('--marsh')
const battles = Number(args.find((arg) => arg.startsWith('--battles='))?.slice(10) ?? BATTLES_PER_PARTY)
const [sampleArg, maxLevelArg] = args.filter((arg) => !arg.startsWith('--'))
const samples = Number(sampleArg ?? DEFAULT_PARTY_SAMPLES)
const maxLevel = Number(maxLevelArg ?? (marsh ? 14 : 12))
if ((fixed && marsh) || !Number.isSafeInteger(samples) || samples < 1 || !Number.isSafeInteger(maxLevel) || maxLevel < (marsh ? 8 : 1) || !Number.isSafeInteger(battles) || battles < 1) {
  throw new Error('Usage: npx tsx tools/print-curve.ts [positive samples] [maxLevel] [--fixed|--marsh] [--battles=N]')
}
const percent = (rate: number) => `${Math.round(rate * 100)}%`
const parties = fixed ? [] : starterParties(samples)
if (marsh) {
  const repeatGold = Math.floor(dungeonById(MARSH_ID).gold * villageRules.repeatReward)
  console.log(`Venom Marsh · median/P25 · ${samples} starter parties × ${battles} battles · base repeat reward ${repeatGold} gold`)
  console.table(Object.entries(marshLoadouts).map(([name, loadout]) => {
    const costs = (Object.entries(loadout.supplies) as [PotionId, number][]).reduce((gold, [id, count]) => gold + Math.ceil(count / alchemyRules.batch) * potionById(id)!.gold, 0)
    return {
      loadout: name, 'brew gold': costs, '% repeat': percent(costs / repeatGold),
      ...Object.fromEntries(Array.from({ length: maxLevel - 7 }, (_, index) => {
        const level = index + 8
        const { median, lowerQuartile } = starterWinRates(parties, MARSH_ID, level, loadout, battles)
        return [`L${level}`, `${percent(median)}/${percent(lowerQuartile)}`]
      })),
    }
  }))
} else {
  const width = fixed ? 6 : 11
  console.log(fixed ? `Fixed lineup · ${samples} battles` : `Median/P25 · ${samples} starter parties × ${battles} battles`)
  console.log(['dungeon'.padEnd(18), ...Array.from({ length: maxLevel }, (_, i) => `L${i + 1}`.padStart(width))].join(''))

  const weakestAtRecommended: string[] = []
  for (const dungeon of dungeons) {
    const row = [dungeon.id.padEnd(18)]
    for (let level = 1; level <= maxLevel; level += 1) {
      if (fixed) {
        row.push(percent(winRate(dungeon.id, level, samples)).padStart(width))
        continue
      }
      const { median, lowerQuartile, weakest } = starterWinRates(parties, dungeon.id, level, undefined, battles)
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
}
