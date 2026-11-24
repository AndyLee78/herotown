// Run: npx tsx tools/tune-curve.ts [samples] [--quartile|--marsh=antidote4]
import { dungeonById, dungeons, nestRules } from '../src/core/data'
import { BATTLES_PER_PARTY, CITADEL_ID, DEFAULT_PARTY_SAMPLES, FORT_ID, MARSH_ID, NEST_ID, citadelLoadouts, fortLoadouts, marshLoadouts, nestPairs, skillLoadout, skillModes, starterParties, starterWinRates, winRate } from './curve'

const TARGET_WIN_RATE = 0.6
const SCALE_STEPS = 20
const MAX_SCALE = 6
const MAX_LEVEL = 18
const args = process.argv.slice(2)
const nest = args.includes('--nest')
const skillArg = args.find((arg) => arg.startsWith('--skills='))?.slice(9)
const skillMode = skillModes.find((mode) => mode === skillArg)
const marsh = args.find((arg) => arg.startsWith('--marsh='))?.slice(8)
const fort = args.find((arg) => arg.startsWith('--fort='))?.slice(7)
const citadel = args.find((arg) => arg.startsWith('--citadel='))?.slice(10)
const scenario = citadel ?? fort ?? marsh
const loadout = Object.entries(citadel != null ? citadelLoadouts : fort != null ? fortLoadouts : marshLoadouts).find(([name]) => name === scenario)?.[1]
const quartile = args.includes('--quartile') || scenario != null
const samples = Number(args.find((arg) => !arg.startsWith('--')) ?? DEFAULT_PARTY_SAMPLES)
const battles = Number(args.find((arg) => arg.startsWith('--battles='))?.slice(10) ?? BATTLES_PER_PARTY)
if ([marsh, fort, citadel, nest ? 'nest' : undefined, skillArg].filter((entry) => entry != null).length > 1 || (scenario != null && !loadout) || (skillArg != null && !skillMode) || !Number.isSafeInteger(samples) || samples < 1 || !Number.isSafeInteger(battles) || battles < 1) {
  throw new Error('Usage: npx tsx tools/tune-curve.ts [positive samples] [--quartile|--marsh=LOADOUT|--fort=LOADOUT|--citadel=LOADOUT|--nest|--skills=first/last/recommended] [--battles=N]')
}
if (skillMode) {
  const parties = starterParties(samples)
  console.log(`Skill level equivalence · ${skillMode} · P25 · ${samples} parties × ${battles} battles`)
  console.table(dungeons.map(({ id, recommendedLevel: level }) => {
    const p25 = (at: number, learned: boolean) => starterWinRates(parties, id, at, skillLoadout(at, learned ? skillMode : 'none'), battles).lowerQuartile
    const learned = p25(level, true)
    const bare = p25(level, false)
    const next = p25(level + 1, false)
    return { dungeon: id, level, 'bare P25': bare, 'learned P25': learned, 'bare +1 level P25': next,
      'learned vs +1 (pp)': Math.round((learned - next) * 100) }
  }))
} else if (nest) {
  const parties = starterParties(samples)
  const dungeon = dungeonById(NEST_ID)
  const originalScale = dungeon.monsterScale
  const originalPower = nestRules.ambushPower
  const affected = nestPairs.filter((pair) => pair.includes('ambush'))
  try {
    const candidates: [number, number][] = [[originalScale ?? 1, originalPower], [9.5, 0.85], [9.5, 0.8], [9, 0.85]]
    console.table(candidates.map(([scale, power]) => {
      dungeon.monsterScale = scale
      nestRules.ambushPower = power
      const rates = affected.map((affixes) => starterWinRates(parties, NEST_ID, dungeon.recommendedLevel, { supplies: {}, affixes }, battles))
      const prepared = nestPairs.map((affixes) => starterWinRates(parties, NEST_ID, dungeon.recommendedLevel, { supplies: {}, affixes, prepareNest: true }, battles))
      const mean = (values: number[]) => Math.round(100 * values.reduce((sum, value) => sum + value, 0) / values.length)
      return { scale, power, 'ambush median avg %': mean(rates.map(({ median }) => median)), 'zero ambush medians': rates.filter(({ median }) => median === 0).length,
        'prepared P25 avg %': mean(prepared.map(({ lowerQuartile }) => lowerQuartile)), 'prepared pairs at 60%': prepared.filter(({ lowerQuartile }) => lowerQuartile >= TARGET_WIN_RATE).length }
    }))
  } finally {
    dungeon.monsterScale = originalScale
    nestRules.ambushPower = originalPower
  }
} else {
  const parties = quartile ? starterParties(samples) : []
  const measure = (id: string, level: number) => quartile
    ? starterWinRates(parties, id, level, loadout, battles).lowerQuartile
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

  const rows = dungeons.filter(({ id }) => scenario == null || id === (citadel != null ? CITADEL_ID : fort != null ? FORT_ID : MARSH_ID)).map((dungeon) => {
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

  console.log(quartile ? `P25 ≥ 60% · ${samples} starter parties × ${battles} battles${scenario ? ` · loadout ${scenario}` : ''}` : `Fixed lineup ≥ 60% · ${samples} battles`)
  console.table(rows)
}
