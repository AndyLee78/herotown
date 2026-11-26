// Run: npx tsx tools/gear-5b.ts [--full]
import { classList, dungeons, giftRules, progression, smithRules, specialDungeons } from '../src/core/data'
import { DEFAULT_TACTICS, runDungeon, type DungeonVariant } from '../src/core/dungeon'
import { freshState } from '../src/core/game'
import { armorTypes, forgeGear, optionRange, recipeById, weaponTypes } from '../src/core/gear'
import { createHero, generateHero } from '../src/core/hero'
import { raidVariant } from '../src/core/raid'
import { createRng } from '../src/core/rng'
import { skillPicks } from '../src/core/skills'
import { abyssFloors } from '../src/core/trials'
import type { ClassId, GearOption, GearType, PartyMember } from '../src/core/types'
import { starterParties } from './curve'

type Slot = 'weapon' | 'armor'
type Profile = { label: string; slot: Slot; type?: GearType; options?: GearOption[] }
const all = starterParties(9)
const parties = all.slice(0, 6)
const pilot = all.slice(6)
const levels = [11, 15, 20, 25]
const normal = dungeons.filter(({ tier }) => tier >= 3).map(({ id }) => id)
const trials = specialDungeons.filter(({ special }) => special === 'weekday').map(({ id }) => id)
const scenarios = [...normal, ...trials, 'abyss', 'raid']
const levelScenarios = ['bandit_fort', 'haunted_citadel', 'dragon_nest', 'trial_flame_3', 'trial_frost_3', 'trial_light_3', 'abyss']
const pilotScenarios = ['haunted_citadel', 'dragon_nest', 'trial_light_3']
const raidTime = new Date(2026, 10, 23, 12).getTime()
const raidState = freshState(5, raidTime)
const tactics = { ...DEFAULT_TACTICS, blast: 'interrupt' as const }
const mean = (items: number[]) => items.reduce((total, n) => total + n, 0) / items.length
const rounded = (value: number) => Number(value.toFixed(2))

function percentile(values: number[], q: number) {
  const sorted = values.slice().sort((a, b) => a - b)
  const index = (sorted.length - 1) * q
  return sorted[Math.floor(index)]! + (sorted[Math.ceil(index)]! - sorted[Math.floor(index)]!) * (index % 1)
}

function lineup(party: PartyMember[], sample: number, classId: ClassId, level: number, profile: Profile) {
  const sameClass = party.findIndex(({ hero }) => hero.classId === classId)
  const subject = sameClass < 0 ? party.length - 1 : sameClass
  return party.map((member, index) => {
    const hero = index === subject && sameClass < 0 ? generateHero(createRng(sample + 5000), `subject-${sample}`, 0, 1, classId) : member.hero
    const skills = classList.find(({ id }) => id === hero.classId)!.skills
    const learned = Array.from({ length: skillPicks(level) }, (_, pick) => skills.find(({ branch, tier }) => branch === pick % 3 && tier === Math.floor(pick / 3) + 1)!.id)
    const potentials = hero.gift === 'heroBlood'
      ? Object.fromEntries(Object.entries(hero.potentials).map(([key, value]) => [key, value - giftRules.heroBlood])) as typeof hero.potentials
      : hero.potentials
    let gear = hero.gear
    if (index === subject) gear = (['weapon', 'armor'] as const).map((slot) => {
      const chosen = profile.slot === slot
      const grade = chosen && profile.options ? 'legend' : 'fine'
      const recipe = recipeById(`${grade}.${slot === 'weapon' ? 'blade' : 'mail'}`)!
      const piece = forgeGear(recipe, `${hero.id}-${slot}`, undefined, chosen ? profile.type : undefined)
      return chosen && profile.options ? { ...piece, options: profile.options } : piece
    })
    return { ...member, hero: createHero({ ...hero, gear, gift: undefined, potentials, learned, level, training: (level - 1) * progression.trainingPerLevel }) }
  })
}

function variant(id: string): DungeonVariant {
  if (id === 'abyss') return { floors: abyssFloors(15) }
  if (id === 'raid') return raidVariant(raidState, raidTime)
  return {}
}

function measure(lineups: PartyMember[][], id: string, repeats: number, seedOffset = 0) {
  let floors = 0
  let dealt = 0
  const rates = lineups.map((party, index) => {
    let wins = 0
    for (let seed = 1; seed <= repeats; seed += 1) {
      const result = runDungeon(party, id, tactics, seedOffset + index * 107 + seed, {}, variant(id))
      if (!result.ok) throw new Error(`${id}: ${result.error}`)
      wins += Number(result.report.victory)
      floors += result.report.floorsCleared
      dealt += result.report.units.reduce((total, unit) => total + unit.dealt, 0)
    }
    return wins / repeats
  })
  return { p25: percentile(rates, 0.25), median: percentile(rates, 0.5), win: mean(rates), floors, dealt }
}

function triples(slot: Slot, bound: 'min' | 'max') {
  const pool = smithRules.optionPool.filter((entry) => entry[slot])
  return pool.flatMap((first, a) => pool.slice(a + 1).flatMap((second, b) => pool.slice(a + b + 2).map((third) =>
    [first, second, third].map(({ id }) => {
      const key = id as GearOption['id']
      return { id: key, value: optionRange(key, 'legend')![bound] }
    }))))
}

function selectOptions(classId: ClassId, slot: Slot, bound: 'min' | 'max') {
  const profiles = triples(slot, bound).map((options) => {
    const lineups = pilot.map((party, index) => lineup(party, 90 + index, classId, 13, { label: bound, slot, options }))
    const scores = pilotScenarios.map((id) => measure(lineups, id, 1, 10000))
    return { options, win: mean(scores.map(({ win }) => win)), floors: mean(scores.map(({ floors }) => floors)), dealt: mean(scores.map(({ dealt }) => dealt)) }
  })
  profiles.sort((a, b) => a.win - b.win || a.floors - b.floors || a.dealt - b.dealt)
  return (bound === 'max' ? profiles.at(-1) : profiles[0])!.options
}

function report(classId: ClassId, profile: Profile) {
  return levels.flatMap((level) => {
    const lineups = parties.map((party, index) => lineup(party, index, classId, level, profile))
    return scenarios.map((id) => ({ classId, profile: profile.label, level, id, ...measure(lineups, id, 2) }))
  })
}

type Row = ReturnType<typeof report>[number]

function crossing(classId: ClassId, profile: Profile, rows: Row[]) {
  const byLevel = levels.map((level) => mean(rows.filter((row) => row.level === level && levelScenarios.includes(row.id)).map(({ win }) => win)))
  const points = levels.map((level, index) => ({ level, win: byLevel[index]! }))
  if (points[0]!.win >= 0.5) {
    for (const level of [9, 7, 5, 3]) {
      const lineups = parties.map((party, index) => lineup(party, index, classId, level, profile))
      const win = mean(levelScenarios.map((id) => measure(lineups, id, 2).win))
      points.unshift({ level, win })
      if (win < 0.5) break
    }
  }
  const index = points.findIndex(({ win }) => win >= 0.5)
  if (index <= 0) return null
  const from = points[index - 1]!, to = points[index]!
  return from.level + (to.level - from.level) * (0.5 - from.win) / (to.win - from.win)
}

function summary(rows: Row[], level: number) {
  const at = rows.filter((row) => row.level === level)
  return `${rounded(mean(at.map(({ p25 }) => p25)) * 100)}/${rounded(mean(at.map(({ median }) => median)) * 100)}`
}

const comparisons = []
const optionsReport = []
for (const { id: classId } of classList) {
  for (const slot of ['weapon', 'armor'] as const) {
    const types = slot === 'weapon' ? weaponTypes(classId) : armorTypes()
    const profiles: Profile[] = [{ label: 'balanced', slot }, ...types.map((type) => ({ label: type, type, slot }))]
    const rows = profiles.map((profile) => ({ profile, rows: report(classId, profile) }))
    const estimates = rows.map(({ profile, rows }) => ({ name: profile.label, level: crossing(classId, profile, rows) }))
    const base = estimates[0]!.level
    const best = estimates.filter((row) => row.level != null).sort((a, b) => a.level! - b.level!)[0]
    comparisons.push({ classId, slot, best: best?.name ?? '—', gap: best?.level != null && base != null ? rounded(base - best.level) : '—' })
    console.table(rows.map(({ profile, rows }, index) => ({ classId, slot, type: profile.label, threshold: estimates[index]!.level == null ? '—' : rounded(estimates[index]!.level!),
      ...Object.fromEntries(levels.map((level) => [`Lv${level} P25/med`, summary(rows, level)])) })))
    if (process.argv.includes('--full')) console.table(rows.flatMap(({ rows }) => rows).map(({ classId, profile, level, id, p25, median }) => ({
      classId, slot, profile, level, id, p25: rounded(p25 * 100), median: rounded(median * 100),
    })))

    const bestOptions = selectOptions(classId, slot, 'max')
    const worstOptions = selectOptions(classId, slot, 'min')
    const high = { slot, label: 'best', options: bestOptions }
    const low = { slot, label: 'worst', options: worstOptions }
    const highRows = report(classId, high), lowRows = report(classId, low)
    const bestLevel = crossing(classId, high, highRows), worstLevel = crossing(classId, low, lowRows)
    optionsReport.push({ classId, slot, best: bestOptions.map(({ id }) => id).join('/'), worst: worstOptions.map(({ id }) => id).join('/'),
      gap: bestLevel != null && worstLevel != null ? rounded(worstLevel - bestLevel) : '—',
      'Lv15 best': summary(highRows, 15), 'Lv15 worst': summary(lowRows, 15) })
    if (process.argv.includes('--full')) console.table([...highRows, ...lowRows].map(({ classId, profile, id, level, p25, median }) => ({
      classId, slot, profile, level, id, p25: rounded(p25 * 100), median: rounded(median * 100),
    })))
  }
}
console.table(comparisons)
console.table(optionsReport)
