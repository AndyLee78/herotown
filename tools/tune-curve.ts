// Run: npx tsx tools/tune-curve.ts [samples] [--quartile|--marsh=antidote4]
import { dungeons } from '../src/core/data'
import { BATTLES_PER_PARTY, DEFAULT_PARTY_SAMPLES, FORT_ID, MARSH_ID, fortLoadouts, marshLoadouts, starterParties, starterWinRates, winRate } from './curve'

const TARGET_WIN_RATE = 0.6
const SCALE_STEPS = 20
const MAX_SCALE = 6
const MAX_LEVEL = 17
const args = process.argv.slice(2)
const marsh = args.find((arg) => arg.startsWith('--marsh='))?.slice(8)
const fort = args.find((arg) => arg.startsWith('--fort='))?.slice(7)
const scenario = fort ?? marsh
const loadout = Object.entries(fort != null ? fortLoadouts : marshLoadouts).find(([name]) => name === scenario)?.[1]
const quartile = args.includes('--quartile') || scenario != null
const samples = Number(args.find((arg) => !arg.startsWith('--')) ?? DEFAULT_PARTY_SAMPLES)
if ((marsh != null && fort != null) || (scenario != null && !loadout) || !Number.isSafeInteger(samples) || samples < 1) {
  throw new Error('Usage: npx tsx tools/tune-curve.ts [positive samples] [--quartile|--marsh=LOADOUT|--fort=LOADOUT]')
}
const parties = quartile ? starterParties(samples) : []
const measure = (id: string, level: number) => quartile
  ? starterWinRates(parties, id, level, loadout).lowerQuartile
  : winRate(id, level, samples)

// Search the 0.05 grid assuming win rate generally falls as scale rises.
// The selected candidate and its first passing level are measured again.
function strongestPassingScale(passes: (step: number) => boolean): number {
  let low = 0
  let high = MAX_SCALE * SCALE_STEPS + 1
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2)
    if (passes(middle)) low = middle
    else high = middle
  }
  return Math.max(1, low)
}

function firstPassingLevel(dungeonId: string, ceiling: number): number | undefined {
  for (let level = 1; level <= ceiling; level += 1) {
    if (measure(dungeonId, level) >= TARGET_WIN_RATE) return level
  }
  return undefined
}

const rows = dungeons.filter(({ id }) => scenario == null || id === (fort != null ? FORT_ID : MARSH_ID)).map((dungeon) => {
  const originalScale = dungeon.monsterScale
  const target = dungeon.recommendedLevel
  try {
    let step = SCALE_STEPS
    if (quartile) {
      step = strongestPassingScale((candidate) => {
        dungeon.monsterScale = candidate / SCALE_STEPS
        return measure(dungeon.id, target) >= TARGET_WIN_RATE
      })
    } else {
      // Preserve the fixed-lineup calibration for comparison.
      dungeon.monsterScale = 1
      while (step < MAX_SCALE * SCALE_STEPS && firstPassingLevel(dungeon.id, target - 1) != null) {
        step += 1
        dungeon.monsterScale = step / SCALE_STEPS
      }
    }
    const scale = step / SCALE_STEPS
    dungeon.monsterScale = scale
    const rate = measure(dungeon.id, target)
    const level = firstPassingLevel(dungeon.id, MAX_LEVEL)
    const status = rate < TARGET_WIN_RATE ? '목표 미달' : level !== target ? '목표보다 낮은 레벨에서 달성' : '목표 달성'
    return { dungeon: dungeon.id, target, recommended: level ?? '—', monsterScale: scale, targetWinRate: `${Math.round(rate * 100)}%`, status }
  } finally {
    dungeon.monsterScale = originalScale
  }
})

console.log(quartile ? `P25 ≥ 60% · ${samples} starter parties × ${BATTLES_PER_PARTY} battles${scenario ? ` · loadout ${scenario}` : ''}` : `Fixed lineup ≥ 60% · ${samples} battles`)
console.table(rows)
