// Run: npx tsx tools/gear-5b-month.ts [seeds=4]
import { townLevelOf } from '../src/core/game'
import { simulateVillage } from './village-balance'

const seedCount = Number(process.argv[2] ?? 4)
if (!Number.isSafeInteger(seedCount) || seedCount < 1) throw new Error('Expected a positive seed count')

const modes = ['control', 'xp', 'lucky'] as const
const rounded = (value: number) => Number(value.toFixed(2))
const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length
const pairs = Array.from({ length: seedCount }, (_, index) => {
  const seed = index + 1
  const { state: initial } = simulateVillage(seed, 65, 10, true, true)
  if (townLevelOf(initial).level < 10) {
    console.log(`Seed ${seed} did not reach town Lv10 in 65 days`)
    return []
  }
  const rows = modes.map((option) => {
    const result = simulateVillage(seed, 65, undefined, true, true, 30, { initial, option })
    const late = result.late!
    if (!late.studyLevels.length) throw new Error(`Seed ${seed} has no tracked main party heroes`)
    return { seed, option, levelGain: mean(late.studyLevels), goldIncome: late.income.gold ?? 0, goldFinal: late.final.gold }
  })
  console.log('Completed 30-day paired runs for seed', seed)
  return rows
}).filter((rows) => rows.length)
if (!pairs.length) throw new Error('No 30-day samples')
console.table(pairs.flat().map((row) => ({ ...row, levelGain: rounded(row.levelGain) })))
console.table(modes.map((mode, i) => ({
  mode, seeds: pairs.length,
  levelGain: rounded(mean(pairs.map((rows) => rows[i]!.levelGain))),
  levelDelta: rounded(mean(pairs.map((rows) => rows[i]!.levelGain - rows[0]!.levelGain))),
  goldIncome: rounded(mean(pairs.map((rows) => rows[i]!.goldIncome))),
  goldIncomeDelta: rounded(mean(pairs.map((rows) => rows[i]!.goldIncome - rows[0]!.goldIncome))),
  goldFinal: rounded(mean(pairs.map((rows) => rows[i]!.goldFinal))),
})))
