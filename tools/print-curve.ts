// Run: npx tsx tools/print-curve.ts [samples] [maxLevel] [--fixed|--marsh]
// Reproduce the design sample size: npx tsx tools/print-curve.ts --marsh 24 14 --battles=6
import { alchemyRules, classList, dungeonById, dungeons, potionById, villageRules } from '../src/core/data'
import type { PotionId } from '../src/core/types'
import { BATTLES_PER_PARTY, CITADEL_ID, DEFAULT_PARTY_SAMPLES, FORT_ID, MARSH_ID, NEST_ID, citadelLoadouts, fortLoadouts, marshLoadouts, nestPairs, skillLoadout, skillModes, starterParties, starterWinRates, wardLoadout, winRate } from './curve'

const args = process.argv.slice(2)
const fixed = args.includes('--fixed')
const marsh = args.includes('--marsh')
const fort = args.includes('--fort')
const wards = args.includes('--wards')
const citadel = args.includes('--citadel')
const nest = args.includes('--nest')
const skills = args.includes('--skills')
const battles = Number(args.find((arg) => arg.startsWith('--battles='))?.slice(10) ?? BATTLES_PER_PARTY)
const [sampleArg, maxLevelArg] = args.filter((arg) => !arg.startsWith('--'))
const samples = Number(sampleArg ?? DEFAULT_PARTY_SAMPLES)
const minLevel = nest ? 18 : citadel ? 14 : fort ? 12 : marsh ? 8 : 1
const maxLevel = Number(maxLevelArg ?? (nest ? 22 : citadel ? 18 : fort ? 17 : marsh ? 14 : 12))
if ([fixed, marsh, fort, wards, citadel, nest, skills].filter(Boolean).length > 1 || !Number.isSafeInteger(samples) || samples < 1 || !Number.isSafeInteger(maxLevel) || maxLevel < minLevel || !Number.isSafeInteger(battles) || battles < 1) {
  throw new Error('Usage: npx tsx tools/print-curve.ts [positive samples] [maxLevel] [--fixed|--marsh|--fort|--wards|--citadel|--nest|--skills] [--battles=N]')
}
const percent = (rate: number) => `${Math.round(rate * 100)}%`
const parties = fixed ? [] : starterParties(samples)
if (skills) {
  const rating = ({ median, lowerQuartile }: ReturnType<typeof starterWinRates>) => `${percent(median)}/${percent(lowerQuartile)}`
  const measure = (id: string, level: number, mode: typeof skillModes[number] | 'none') =>
    starterWinRates(parties, id, level, skillLoadout(level, mode), battles)
  console.log(`Skills · median/P25 · ${samples} starter parties × ${battles} battles; no supplies or seasonal affixes`)
  console.table(dungeons.map(({ id, recommendedLevel: level }) => ({
    dungeon: id, level, none: rating(measure(id, level, 'none')), 'none +1 Lv': rating(measure(id, level + 1, 'none')),
    ...Object.fromEntries(skillModes.map((mode) => [mode, rating(measure(id, level, mode))])),
  })))
  console.log('Single skill on one hero · change in median/P25 (percentage points) · same parties with the class')
  console.table(classList.flatMap(({ id: classId, skills: classSkills }) => {
    const matching = parties.filter((party) => party.some(({ hero }) => hero.classId === classId))
    const baselines = dungeons.map(({ id, recommendedLevel: level }) => matching.length > 0 && level >= 3
      ? starterWinRates(matching, id, level, skillLoadout(level, 'none'), battles) : undefined)
    return classSkills.filter(({ effect }) => effect).map(({ id: skill }) => ({
      skill, parties: matching.length,
      ...Object.fromEntries(dungeons.map(({ id, recommendedLevel: level }, index) => {
        const before = baselines[index]
        if (!before) return [id, '—']
        const after = starterWinRates(matching, id, level, skillLoadout(level, 'none', skill), battles)
        const delta = (value: number) => `${value > 0.005 ? '+' : ''}${Math.round(value * 100)}`
        return [id, `${delta(after.median - before.median)}/${delta(after.lowerQuartile - before.lowerQuartile)}`]
      })),
    }))
  }))
} else if (nest) {
  const levels = Array.from({ length: maxLevel - minLevel + 1 }, (_, index) => index + minLevel)
  const measurements = nestPairs.map((affixes) => ({
    pair: affixes.join('+'),
    levels: levels.map((level) => [false, true].map((prepareNest) => starterWinRates(parties, NEST_ID, level, { supplies: {}, affixes, prepareNest }, battles))),
  }))
  const cell = (base: { median: number; lowerQuartile: number }, prepared: { median: number; lowerQuartile: number }) =>
    `${percent(base.median)}/${percent(base.lowerQuartile)} → ${percent(prepared.median)}/${percent(prepared.lowerQuartile)}`
  console.log(`Dragon Nest · median/P25 without preparation → prepared · ${samples} parties × ${battles} battles per condition`)
  console.table([
    ...measurements.map(({ pair, levels: results }) => ({ pair, ...Object.fromEntries(levels.map((level, i) => [`L${level}`, cell(results[i]![0]!, results[i]![1]!)])) })),
    { pair: 'mean of pairs', ...Object.fromEntries(levels.map((level, i) => {
      const means = [0, 1].map((mode) => ({
        median: measurements.reduce((sum, row) => sum + row.levels[i]![mode]!.median, 0) / measurements.length,
        lowerQuartile: measurements.reduce((sum, row) => sum + row.levels[i]![mode]!.lowerQuartile, 0) / measurements.length,
      }))
      return [`L${level}`, cell(means[0]!, means[1]!)]
    })) },
  ])
} else if (fort || wards || citadel) {
  const scenarios = citadel ? citadelLoadouts : fort ? fortLoadouts : {
    none: marshLoadouts.none,
    ward1: wardLoadout(1),
    ward2: wardLoadout(2),
    antidote1: { supplies: { antidote: 1 } },
    antidote2: marshLoadouts.antidote2,
    antidote3: { supplies: { antidote: 3 } },
    antidote4: marshLoadouts.antidote4,
  }
  const levels = wards ? [10, 11, 12] : Array.from({ length: maxLevel - minLevel + 1 }, (_, index) => index + minLevel)
  const dungeon = citadel ? CITADEL_ID : fort ? FORT_ID : MARSH_ID
  console.log(`${dungeon} · median/P25 · ${samples} starter parties × ${battles} battles per row`)
  if (citadel) console.log('extra counts rogue/archer in addition to the warrior; interrupts counted per logged charge.')
  console.table(Object.entries(scenarios).flatMap(([loadout, kit]) => levels.map((level) => {
    const result = starterWinRates(parties, dungeon, level, kit, battles)
    return { loadout, level, 'median/P25': `${percent(result.median)}/${percent(result.lowerQuartile)}`,
      ...(citadel ? { interrupted: `${result.interrupts}/${result.charges} (${result.charges ? percent(result.interrupts / result.charges) : '—'})` } : {}),
      defeats: Object.entries(result.defeats).sort(([a], [b]) => a.localeCompare(b)).map(([reason, count]) => `${reason}:${count}`).join(' ') || '—' }
  })))
} else if (marsh) {
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
