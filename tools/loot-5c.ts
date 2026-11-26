// Run: npx tsx tools/loot-5c.ts
import { classById, endgameRules, lootRules, progression, smithRules } from '../src/core/data'
import { DEFAULT_TACTICS, runDungeon } from '../src/core/dungeon'
import { forgeGear, optionRange, recipeById } from '../src/core/gear'
import { createHero, generateHero } from '../src/core/hero'
import { uniqueGear, type UniqueDef } from '../src/core/loot'
import { TRINKET_IDS, trinketRecipe } from '../src/core/magic'
import { createRng } from '../src/core/rng'
import { skillPicks } from '../src/core/skills'
import { abyssFloors } from '../src/core/trials'
import type { ClassId, Gear, GearOptionId, PartyMember } from '../src/core/types'
import { starterParties } from './curve'

const cases = ['sunken_crypt', 'bandit_fort', 'haunted_citadel', 'dragon_nest', 'trial_light_3', 'abyss', 'invasion']
const levels = [8, 10, 12, 14, 16, 18, 20]
const parties = starterParties(6)
const tactics = { ...DEFAULT_TACTICS, blast: 'interrupt' as const }
const average = (xs: number[]) => xs.reduce((sum, x) => sum + x, 0) / xs.length
const rounded = (n: number) => Number(n.toFixed(2))
type Loadout = (sample: number, seed: number) => Gear[]

const piece = (def: UniqueDef) => uniqueGear(def, `study-${def.id}`)
const ordinary = (id: string, seed?: number) => forgeGear(recipeById(id)!, `study-${id}`, seed)
const trinket = (sample: number): Gear => {
  const id = trinketRecipe(TRINKET_IDS[sample % TRINKET_IDS.length]!)
  return { id: `study-${id}`, recipeId: id, grade: 'common', slot: 'trinket', enhance: 0 }
}

function partyAtLevel(party: PartyMember[], sample: number, level: number, selectedClass: ClassId, gear: Gear[]) {
  const match = party.findIndex(({ hero }) => hero.classId === selectedClass)
  const subject = match < 0 ? party.length - 1 : match
  return party.map((member, index) => {
    const hero = index === subject && match < 0 ? generateHero(createRng(7000 + sample), `study-subject-${sample}`, 0, 1, selectedClass) : member.hero
    const skills = classById(hero.classId).skills
    const learned = Array.from({ length: skillPicks(level) }, (_, pick) => skills.find(({ branch, tier }) => branch === pick % 3 && tier === Math.floor(pick / 3) + 1)!.id)
    return { ...member, hero: createHero({
      ...hero, level, learned, training: (level - 1) * progression.trainingPerLevel,
      gear: index === subject ? gear : hero.gear,
    }) }
  })
}

function curve(klass: ClassId, loadout: Loadout) {
  return levels.map((level) => {
    let wins = 0
    for (const [sample, party] of parties.entries()) for (const seed of [1, 2]) {
      const lineup = partyAtLevel(party, sample, level, klass, loadout(sample, seed))
      for (const id of cases) {
        const variant = id === 'abyss' ? { floors: abyssFloors(15) } : id === 'invasion'
          ? { floors: endgameRules.invasion.waves.map((monsters) => ({ monsters, scale: endgameRules.invasion.scale })) } : {}
        const result = runDungeon(lineup, id, tactics, sample * 131 + seed, {}, variant)
        if (!result.ok) throw new Error(`${id}: ${result.error}`)
        wins += Number(result.report.victory)
      }
    }
    return { level, win: wins / (parties.length * 2 * cases.length) }
  })
}

function threshold(values: ReturnType<typeof curve>) {
  const index = values.findIndex(({ win }) => win >= 0.5)
  if (index <= 0) throw new Error('50% threshold is outside the tested levels')
  const from = values[index - 1]!, to = values[index]!
  return from.level + (to.level - from.level) * (0.5 - from.win) / (to.win - from.win)
}

function score(klass: ClassId, loadout: Loadout) {
  return threshold(curve(klass, loadout))
}

function selectedClass(def: UniqueDef): ClassId {
  if ('heal' in def.effect || 'healTaken' in def.effect && def.slot === 'trinket') return 'cleric'
  return def.slot === 'armor' ? 'warrior' : 'archer'
}

console.table(lootRules.uniques.map((def) => {
  const klass = selectedClass(def)
  const carry = (item: Gear) => [ordinary('fine.blade'), ordinary('fine.mail')].filter(({ slot }) => slot !== item.slot).concat(item)
  const unique = score(klass, () => carry(piece(def)))
  const reference = score(klass, (sample, seed) => carry('base' in def && def.base ? ordinary(def.base, sample * 107 + seed) : trinket(sample + seed)))
  return { id: def.id, klass, unique: rounded(unique), reference: rounded(reference), lead: rounded(reference - unique) }
}))

const setClasses = { dragonslayer: 'archer', gravekeeper: 'cleric', windwalker: 'archer', choir: 'cleric' } as const
const highestOptions = {
  archer: { weapon: ['power', 'crit', 'holy'], armor: ['hp', 'xp', 'lucky'] },
  cleric: { weapon: ['crit', 'bossDamage', 'holy'], armor: ['guard', 'speed', 'heal'] },
} as const satisfies Record<'archer' | 'cleric', Record<'weapon' | 'armor', readonly GearOptionId[]>>

const legend = ['legend.blade', 'legend.mail'].map((id) => ordinary(id))
const ordinaryScores = Object.fromEntries((['archer', 'cleric'] as const).map((klass) => {
  const base = score(klass, (sample) => [...legend, trinket(sample)])
  const strongest = Math.min(...(['weapon', 'armor'] as const).map((slot) => score(klass, (sample) => [
    ...legend.map((item) => item.slot !== slot ? item : { ...item, options: highestOptions[klass][slot].slice(0, smithRules.optionCount.legend).map((id) => ({ id, value: optionRange(id, 'legend')!.max })) }),
    trinket(sample),
  ])))
  return [klass, { base, strongest }]
}))

console.table(lootRules.sets.map((set) => {
  const klass = setClasses[set.id as keyof typeof setClasses]
  const members = lootRules.uniques.filter((def) => def.set === set.id).map(piece)
  const outfit = (count: number) => {
    const selected = members.slice(0, count)
    return [...selected, ...legend.filter(({ slot }) => !selected.some((item) => item.slot === slot))]
  }
  const two = score(klass, () => outfit(2))
  const three = score(klass, () => outfit(3))
  const snapshot = { two: set.two, three: set.three }
  let twoOff, threeOff, twoOnly
  try {
    Object.assign(set, { three: {} })
    twoOnly = score(klass, () => outfit(3))
    Object.assign(set, { two: {} })
    twoOff = score(klass, () => outfit(2))
    threeOff = score(klass, () => outfit(3))
  } finally {
    Object.assign(set, snapshot)
  }
  const { base, strongest } = ordinaryScores[klass]!
  return { set: set.id, klass, two: rounded(twoOff - two), three: rounded(threeOff - three), incrementalThird: rounded(twoOnly - three),
    vsLegend: rounded(strongest - three), bonusVsOptions: rounded(threeOff - three - (base - strongest)) }
}))

console.table([1, 2, 3].map((tiers) => {
  const samples = Array.from({ length: 10_000 }, (_, sample) => {
    const rng = createRng(sample + 20000)
    const collected = endgameRules.raid.bosses.map(() => new Set<number>())
    const completed = endgameRules.raid.bosses.map(() => 0)
    for (let week = 1; week <= 600; week += 1) {
      const boss = (week - 1 + sample % collected.length) % collected.length
      for (const chance of lootRules.raidUniqueChance.slice(0, tiers)) {
        if (rng.next() < chance) collected[boss]!.add(rng.int(2))
      }
      if (!completed[boss] && collected[boss]!.size === 2) completed[boss] = week
      if (completed.every(Boolean)) return { one: completed[0]!, all: week }
    }
    throw new Error('Raid collection exceeded 600 weeks')
  })
  const stats = (values: number[]) => {
    const sorted = values.slice().sort((a, b) => a - b)
    return [rounded(average(values)), sorted[Math.ceil(values.length / 2) - 1], sorted[Math.ceil(values.length * 0.9) - 1]].join('/')
  }
  return { tiersCleared: tiers, 'one boss pair mean/P50/P90': stats(samples.map(({ one }) => one)), 'all six mean/P50/P90': stats(samples.map(({ all }) => all)) }
}))
