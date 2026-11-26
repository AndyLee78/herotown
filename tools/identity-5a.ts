// Run: npx tsx tools/identity-5a.ts [--full]
import { classById, classList, combatRules, dungeons, dungeonById, endgameRules, giftRules, personalityRules, progression, specialDungeons } from '../src/core/data'
import { DEFAULT_TACTICS, gainXp, runDungeon, type DungeonVariant } from '../src/core/dungeon'
import { freshState } from '../src/core/game'
import { forgeGear, recipeById } from '../src/core/gear'
import { createHero, generateHero, withGiftPotentials } from '../src/core/hero'
import { raidVariant, raidWeek, raidBoss } from '../src/core/raid'
import { createRng } from '../src/core/rng'
import { skillPicks } from '../src/core/skills'
import { abyssFloors } from '../src/core/trials'
import type { ClassId, GiftId, PartyMember } from '../src/core/types'
import { starterParties } from './curve'

const parties = starterParties(6)
const battles = 3
const levels = [11, 15, 20, 25]
const modes = ['focus0', 'focus1', 'focus2', 'double', 'even'] as const
type Mode = typeof modes[number]
const normal = dungeons.filter(({ tier }) => tier >= 3)
const trialIds = specialDungeons.filter(({ special }) => special === 'weekday').map(({ id }) => id)
const eventIds = specialDungeons.filter(({ special }) => special === 'event').map(({ id }) => id)
const ids = [...normal.map(({ id }) => id), ...trialIds, 'abyss', 'raid', 'invasion']
const full = process.argv.includes('--full')
const probesOnly = process.argv.includes('--probes-only')
const monday = new Date(2026, 10, 23, 12).getTime()
const raidTown = freshState(5, monday)
const tactics = { ...DEFAULT_TACTICS, blast: 'interrupt' as const }
const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length
const rounded = (value: number) => Number(value.toFixed(2))

function percentile(values: number[], q: number) {
  const sorted = values.slice().sort((a, b) => a - b)
  const index = (sorted.length - 1) * q
  return sorted[Math.floor(index)]! + (sorted[Math.ceil(index)]! - sorted[Math.floor(index)]!) * (index % 1)
}

function branchOrder(mode: Mode): number[] {
  if (mode === 'even') return [0, 1, 2, 0, 1, 2]
  if (mode === 'double') return [0, 0, 0, 1, 1, 1]
  const primary = Number(mode.at(-1))
  return [primary, primary, primary, (primary + 1) % 3, (primary + 2) % 3, (primary + 1) % 3]
}

function skillPlan(classId: ClassId, level: number, mode: Mode) {
  const used = [0, 0, 0]
  const skills = classById(classId).skills
  return branchOrder(mode).slice(0, skillPicks(level)).map((branch) => {
    used[branch] = used[branch]! + 1
    return skills.find((s) => s.branch === branch && s.tier === used[branch])!.id
  })
}

function sampleParty(party: PartyMember[], index: number, level: number, mode: Mode = 'even', focus?: ClassId, gift?: GiftId, heroic = false) {
  const slot = focus === 'warrior' || focus === 'cleric' ? party.findIndex(({ hero }) => hero.classId === focus) : party.length - 1
  return party.map((member, i) => {
    const target = i === (slot < 0 ? party.length - 1 : slot)
    const hero = target && focus && member.hero.classId !== focus
      ? generateHero(createRng(1000 + index), `subject-${index}`, 0, 1, focus)
      : member.hero
    // Remove the generated gift's potential adjustment before each paired comparison.
    const potentials = hero.gift === 'heroBlood' ? Object.fromEntries(Object.entries(hero.potentials).map(([key, value]) => [key, value - giftRules.heroBlood])) as typeof hero.potentials : hero.potentials
    const nextGift = target ? gift : undefined
    return { ...member, hero: createHero({
      ...hero, potentials: withGiftPotentials(potentials, nextGift), level, training: (level - 1) * progression.trainingPerLevel,
      learned: skillPlan(hero.classId, level, !focus || target ? mode : 'even'), gift: nextGift,
      ...(heroic ? { gear: ['epic.blade', 'epic.mail'].map((id) => forgeGear(recipeById(id)!, `${hero.id}-${id}`)) } : {}),
    }) }
  })
}

function variantFor(id: string, multiplier = 1): DungeonVariant {
  if (id === 'raid') return raidVariant(raidTown, monday)
  if (id === 'abyss') return { floors: abyssFloors(15) }
  if (id === 'invasion') return { floors: endgameRules.invasion.waves.map((monsters) => ({ monsters, scale: endgameRules.invasion.scale })) }
  const dungeon = dungeonById(id)
  return { floors: dungeon.floors.map((floor) => ({ ...floor, scale: (floor.scale ?? dungeon.monsterScale ?? 1) * multiplier })) }
}

function measure(lineups: PartyMember[][], id: string, multiplier = 1) {
  let totalGold = 0
  let totalFatigue = 0
  let totalTicks = 0
  const rates = lineups.map((party, index) => {
    let wins = 0
    for (let seed = 1; seed <= battles; seed += 1) {
      const result = runDungeon(party, id, tactics, index * 107 + seed, {}, variantFor(id, multiplier))
      if (!result.ok) throw new Error(`${id} has an invalid sample: ${result.error}`)
      if (result.report.victory) wins += 1
      totalGold += result.report.gold
      totalTicks += result.report.ticks
      totalFatigue += result.report.conditions.at(-1)?.fatigue ?? 0
    }
    return wins / battles
  })
  const count = lineups.length * battles
  return { p25: percentile(rates, 0.25), median: percentile(rates, 0.5), average: mean(rates),
    gold: totalGold / count, fatigue: totalFatigue / count, ticks: totalTicks / count }
}

const branchRows = probesOnly ? [] : classList.flatMap(({ id: classId }) => levels.flatMap((level) => modes.flatMap((mode) => {
  const lineups = parties.map((party, index) => sampleParty(party, index, level, mode, classId))
  return ids.map((id) => ({ classId, level, mode, id, ...measure(lineups, id) }))
})))
type Row = typeof branchRows[number]
const display = <T extends { p25: number; median: number; average: number }>(row: T) => ({
  ...row, p25: rounded(row.p25 * 100), median: rounded(row.median * 100), average: rounded(row.average * 100),
})
if (full && !probesOnly) console.table(branchRows.map(display))
if (!probesOnly) {
  for (const { id } of classList) {
    const rows = branchRows.filter(({ classId }) => classId === id)
    console.table(levels.map((level) => {
      const at = rows.filter((row) => row.level === level)
      return { classId: id, level, ...Object.fromEntries(modes.map((mode) => {
        const group = at.filter((row) => row.mode === mode)
        return [mode, `${rounded(mean(group.map(({ p25 }) => p25)) * 100)}/${rounded(mean(group.map(({ median }) => median)) * 100)}`]
      })) }
    }))
  }

  function crossing(rows: Row[], mode: Mode) {
    const reference = ['bandit_fort', 'haunted_citadel', 'dragon_nest', 'trial_flame_3', 'trial_frost_3', 'trial_light_3', 'abyss', 'invasion']
    const rates = levels.map((level) => mean(rows.filter((row) => row.level === level && row.mode === mode && reference.includes(row.id)).map(({ average }) => average)))
    for (let i = 1; i < levels.length; i += 1) {
      if (rates[i - 1]! < 0.5 && rates[i]! >= 0.5) return levels[i - 1]! + (levels[i]! - levels[i - 1]!) * (0.5 - rates[i - 1]!) / (rates[i]! - rates[i - 1]!)
    }
    return null
  }
  console.table(classList.map(({ id }) => {
    const rows = branchRows.filter(({ classId }) => classId === id)
    const estimates = modes.flatMap((mode) => {
      const level = crossing(rows, mode)
      return level == null ? [] : [{ mode, level }]
    }).sort((a, b) => a.level - b.level)
    return { classId: id, ranged: estimates.length, strongest: estimates[0]?.mode, weakest: estimates.at(-1)?.mode, gap: estimates.length > 1 ? rounded(estimates.at(-1)!.level - estimates[0]!.level) : '—' }
  }))
  console.table(ids.map((id) => ({
    id, ...Object.fromEntries(classList.map(({ id: classId }) => {
      const rows = branchRows.filter((row) => row.id === id && row.classId === classId)
      const averages = modes.map((mode) => mean(rows.filter((row) => row.mode === mode).map(({ average }) => average)))
      const best = Math.max(...averages)
      return [classId, modes.filter((_, index) => averages[index] === best).join('/')]
    })),
  })))
}

const balanced = (level: number, gift?: GiftId, heroic = false) => parties.map((party, index) => sampleParty(party, index, level, 'even', undefined, gift, heroic))
const referenceIds = [...normal.map(({ id }) => id), 'trial_light_2', 'abyss', 'invasion']
const reference = balanced(13)
const referenceScores = (lineups: PartyMember[][]) => referenceIds.map((id) => measure(lineups, id))
const referenceResult = referenceScores(reference)
const affinity = personalityRules.affinityScale
let noAffinity: ReturnType<typeof referenceScores>
try {
  personalityRules.affinityScale = 1
  noAffinity = referenceScores(reference)
} finally {
  personalityRules.affinityScale = affinity
}
console.table(referenceIds.map((id, index) => ({
  id, p25: rounded(referenceResult[index]!.p25 * 100), median: rounded(referenceResult[index]!.median * 100),
  noAffinityP25: rounded(noAffinity[index]!.p25 * 100), noAffinityMedian: rounded(noAffinity[index]!.median * 100),
  delta: rounded((referenceResult[index]!.average - noAffinity[index]!.average) * 100),
})))
const baseAverage = mean(referenceResult.map(({ average }) => average))
console.table(giftRules.gifts.map(({ id }) => {
  const lineup = balanced(13, id)
  const results = referenceScores(lineup)
  const base = reference[0]!.at(-1)!.hero
  const blessed = lineup[0]!.at(-1)!.hero
  return { id, average: rounded(mean(results.map((row) => row.average)) * 100), delta: rounded((mean(results.map((row) => row.average)) - baseAverage) * 100),
    fatigueDelta: rounded(mean(results.map(({ fatigue }, i) => fatigue - referenceResult[i]!.fatigue))),
    goldDelta: rounded(mean(results.map(({ gold }, i) => gold - referenceResult[i]!.gold))),
    xpFrom100: gainXp({ ...blessed, level: 20, xp: 0 }, 100).xp, strength: blessed.potentials.str - base.potentials.str }
}))

console.table(normal.map(({ id, tier, recommendedLevel, monsterScale }) => {
  const lineup = balanced(recommendedLevel)
  const initial = tier <= 4 ? 1.1 : tier === 5 ? 1.2 : 1.3
  const base = measure(lineup, id)
  const factors = [0.55, 0.7, 0.85, ...Array.from({ length: 25 }, (_, index) => (900 + 25 * index) / 1000), 1.7]
  const candidates = factors.map((factor) => ({ factor, ...measure(lineup, id, factor) }))
  const chosen = candidates.slice().sort((a, b) => Math.abs(a.p25 - 0.8) - Math.abs(b.p25 - 0.8) || Math.abs(a.factor - 1) - Math.abs(b.factor - 1))[0]!
  let noElite
  const chance = combatRules.eliteChance
  try { combatRules.eliteChance = 0; noElite = measure(lineup, id) } finally { combatRules.eliteChance = chance }
  return { id, tier, recommendedLevel, baseScale: monsterScale, p25: rounded(base.p25 * 100), median: rounded(base.median * 100),
    seedFactor: initial, initialP25: rounded(candidates.find(({ factor }) => factor === initial)!.p25 * 100),
    pickedFactor: chosen.factor, proposedScale: rounded((monsterScale ?? 1) * chosen.factor), proposedP25: rounded(chosen.p25 * 100),
    noEliteP25: rounded(noElite.p25 * 100), noEliteMedian: rounded(noElite.median * 100),
  }
}))
console.table([...trialIds, 'abyss', 'raid', 'invasion', ...eventIds].map((id) => {
  const level = dungeonById(id).recommendedLevel
  return display({ id, level, ...measure(balanced(level), id) })
}))

function enrageProbe() {
  const lineups = balanced(25, undefined, true)
  let best = lineups.map(() => 0)
  let checkpoint = best.slice()
  let abyssEnrages = 0
  for (let run = 0; run < 12; run += 1) {
    const results = lineups.map((party, i) => runDungeon(party, 'abyss', tactics, 100 + i * 31 + run, {}, { floors: abyssFloors(checkpoint[i]!) }))
    abyssEnrages += results.filter((result) => result.ok && result.report.log.some(({ key }) => key === 'log.enrage')).length
    best = results.map((result, i) => result.ok ? Math.max(best[i]!, checkpoint[i]! + result.report.floorsCleared) : best[i]!)
    checkpoint = results.map((result, i) => result.ok && result.report.victory ? best[i]! : checkpoint[i]!)
  }
  const bosses = endgameRules.raid.bosses.map((boss) => {
    const date = Array.from({ length: 3 }, (_, i) => monday + i * 7 * 86_400_000).find((date) => raidBoss(raidWeek(date)).id === boss.id)!
    const week = raidWeek(date)
    return endgameRules.raid.tiers.map((_, i) => {
      const tier = i + 1
      let enrages = 0
      const attempts = lineups.map((party, index) => {
        let hp: number | null = null
        for (let run = 1; run <= 16; run += 1) {
          const variant = raidVariant({ ...raidTown, raidKills: i, raid: { week, bossId: boss.id, tier, hp, max: null, killed: false } }, date)
          const result = runDungeon(party, 'raid', tactics, 5000 + index * 113 + run, {}, variant)
          if (result.ok && result.report.log.some(({ key }) => key === 'log.enrage')) enrages += 1
          hp = variant.raid.left ?? hp
          if (hp === 0) return run
        }
        return null
      })
      const killed = attempts.flatMap((attempt) => attempt == null ? [] : [attempt])
      return { boss: boss.id, tier, kills: killed.length, medianAttempts: killed.length ? percentile(killed, 0.5) : '—', enrages }
    })
  })
  return { abyssBest: percentile(best, 0.5), abyssCheckpoint: percentile(checkpoint, 0.5), abyssEnrages, bosses: bosses.flat() }
}

const enrage = combatRules.enrageAttack
const on = enrageProbe()
try {
  combatRules.enrageAttack = 1
  console.log('Enrage on', JSON.stringify(on))
  console.log('Enrage off', JSON.stringify(enrageProbe()))
} finally {
  combatRules.enrageAttack = enrage
}
