// Run: npx tsx tools/loot-5c-month.ts [seeds=6]
import { simulateVillage } from './village-balance'

const seeds = Number(process.argv[2] ?? 6)
if (!Number.isSafeInteger(seeds) || seeds < 1) throw new Error('Expected a positive seed count')
const grades = ['common', 'fine', 'rare', 'epic', 'legend'] as const
const sourcePatterns = {
  dungeon: /^\d+-[du]\d+$/,
  raid: /^\d+-r\d+$/,
  exchange: /^\d+-x\d+$/,
  smith: /^\d+-g\d+$/,
  event: /^\d+-ev/,
  market: /^\d+-m/,
  magic: /^\d+-t\d+$/,
}
const sources = Object.keys(sourcePatterns) as (keyof typeof sourcePatterns)[]
const runs = Array.from({ length: seeds }, (_, index) => {
  const seed = index + 1
  const run = simulateVillage(seed, 65, undefined, true, true, 30, undefined, true)
  if (!run.late) {
    console.log('Lv10 not reached in 65 days for seed', seed)
    return []
  }
  const unclassified = run.late.acquired.filter(({ id }) => !sources.some((source) => sourcePatterns[source].test(id)))
  if (unclassified.length) console.log('Other gear IDs for seed', seed, unclassified.map(({ id }) => id))
  const rows = sources.map((source) => {
    const items = run.late!.acquired.filter(({ id }) => sourcePatterns[source].test(id))
    return { seed, source, items: items.length, unique: items.filter((item) => item.unique).length,
      grades: grades.map((grade) => items.filter((item) => item.grade === grade).length) }
  })
  console.log('Completed 30 days for seed', seed, 'after reaching Lv10 on day', run.late.startDay.toFixed(2))
  return rows
}).filter((rows) => rows.length)
if (!runs.length) throw new Error('No completed Lv10 measurements')
const mean = (values: number[]) => Number((values.reduce((sum, n) => sum + n, 0) / values.length).toFixed(2))
console.table(runs.flat().map(({ grades: counts, ...row }) => ({ ...row, ...Object.fromEntries(grades.map((grade, index) => [grade, counts[index]])) })))
console.table(sources.map((source) => {
  const group = runs.flat().filter((row) => row.source === source)
  return { source, samples: group.length, items: mean(group.map(({ items }) => items)), unique: mean(group.map(({ unique }) => unique)),
    ...Object.fromEntries(grades.map((grade, index) => [grade, mean(group.map(({ grades }) => grades[index]!))])) }
}))
