import { classById, classList, combatRules, dungeonById, dungeons, endgameRules, giftRules, lootRules, monsterById, progression, smithRules, specialDungeons } from '../src/core/data'
import { DEFAULT_TACTICS, runDungeon, type DungeonVariant } from '../src/core/dungeon'
import { freshState } from '../src/core/game'
import { optionRange, weaponTypes } from '../src/core/gear'
import { createHero, generateHero, withGiftPotentials } from '../src/core/hero'
import { rollDrop, uniqueGear } from '../src/core/loot'
import { raidVariant } from '../src/core/raid'
import { createRng } from '../src/core/rng'
import { skillPicks } from '../src/core/skills'
import { abyssFloors } from '../src/core/trials'
import type { ClassId, Gear, GearGrade, GearOption, GiftId, Hero, PartyMember } from '../src/core/types'
import { starterParties, winRate } from './curve'

const samples = starterParties(12)
const levels = [11, 15, 20, 25]
const curveLevels = [5, 7, 9, 11, 13, 15, 17, 20]
const trials = specialDungeons.filter(({ special }) => special === 'weekday').map(({ id }) => id)
const scenarios = [...dungeons.filter(({ tier }) => tier >= 3).map(({ id }) => id), ...trials, 'abyss', 'raid', 'invasion']
const reference = ['bandit_fort', 'haunted_citadel', 'dragon_nest', 'trial_flame_3', 'trial_frost_3', 'trial_light_3', 'abyss', 'invasion']
const time = Date.parse('2026-11-23T12:00:00+09:00')
const raid = raidVariant(freshState(5, time), time)
const tactics = { ...DEFAULT_TACTICS, blast: 'interrupt' as const }
const mean = (values: number[]) => values.reduce((sum, v) => sum + v, 0) / values.length
const round = (n: number) => Number(n.toFixed(3))
const even = [0, 1, 2, 0, 1, 2]
const plans = [0, 1, 2].flatMap((first) => [0, 1, 2].filter((next) => first !== next).map((next) => ({
  id: `${first}>${next}`, order: [first, first, first, next, next, next],
}))).concat({ id: 'even', order: even })
const branchCounts = [0, 1, 2, 3]
const allocations = branchCounts.flatMap((a) => branchCounts.flatMap((b) => branchCounts.map((c) => [a, b, c])))
const grades: GearGrade[] = ['common', 'fine', 'rare', 'epic', 'legend']
const stage = process.env.HEROTOWN_5D_STAGE ?? 'all'

function percentile(values: number[], q: number) {
  const sorted = values.slice().sort((a, b) => a - b)
  const index = (sorted.length - 1) * q
  return sorted[Math.floor(index)]! + (sorted[Math.ceil(index)]! - sorted[Math.floor(index)]!) * (index % 1)
}

function skills(classId: ClassId, level: number, order: number[]) {
  const counts = [0, 0, 0]
  return order.slice(0, skillPicks(level)).map((branch) => {
    counts[branch] = counts[branch]! + 1
    return classById(classId).skills.find((s) => s.branch === branch && s.tier === counts[branch])!.id
  })
}

function drops(klass: ClassId, tier: number, seed: number, grade?: GearGrade) {
  const rng = createRng(seed)
  const rolled = Array.from({ length: grade ? 120 : 10 }, (_, i) => rollDrop(tier, `drop-${seed}-${i}`, rng))
  const weapons = weaponTypes(klass)
  return (['weapon', 'armor'] as const).flatMap((slot) => {
    const item = rolled.find((g) => g?.slot === slot && (!grade || g.grade === grade) && (slot === 'armor' || !g.type || weapons.some((type) => type === g.type)))
    return item ? [item] : []
  })
}

function beforeTier(level: number) {
  return Math.max(1, ...dungeons.filter((d) => d.recommendedLevel < level).map(({ tier }) => tier))
}

type Profile = { klass?: ClassId; plan?: number[]; gift?: GiftId | null; gear?: (hero: Hero, seed: number) => Gear[]; tier?: number; swap?: boolean; uniques?: boolean }
function lineup(sample: number, level: number, profile: Profile = {}) {
  const party = samples[sample]!
  const subject = profile.swap ? party.length - 1 : (profile.klass ? party.findIndex(({ hero }) => hero.classId === profile.klass) : -1)
  return party.map((member, index) => {
    const target = index === (subject < 0 ? party.length - 1 : subject)
    const klass = target && profile.klass ? profile.klass : member.hero.classId
    const hero = klass === member.hero.classId ? member.hero : generateHero(createRng(10000 + sample), member.hero.id, 0, 1, klass)
    const gift = target && profile.gift !== undefined ? profile.gift ?? undefined : hero.gift
    const potentials = gift === hero.gift ? hero.potentials : withGiftPotentials(hero.gift === 'heroBlood'
      ? Object.fromEntries(Object.entries(hero.potentials).map(([stat, value]) => [stat, value - giftRules.heroBlood])) as Hero['potentials']
      : hero.potentials, gift)
    const seed = 1000 + sample * 101 + index
    const gear = drops(klass, profile.tier ?? beforeTier(level), seed)
    if (profile.uniques && level >= 16 && index === 0) {
      const pieces = lootRules.uniques.filter(({ set, grade }) => set === 'gravekeeper' && (level >= 25 || grade === 'epic')).map((def) => uniqueGear(def, def.id))
      gear.splice(0, gear.length, ...gear.filter(({ slot }) => !pieces.some((piece) => piece.slot === slot)), ...pieces)
    }
    return { ...member, hero: createHero({ ...hero, gift, potentials, level,
      gear: target && profile.gear ? profile.gear(hero, seed) : gear,
      learned: skills(klass, level, target ? profile.plan ?? even : even), training: (level - 1) * progression.trainingPerLevel }) }
  })
}

function variantFor(id: string, scale?: number): DungeonVariant {
  if (id === 'raid') return raid
  if (id === 'abyss') return { floors: abyssFloors(15) }
  if (id === 'invasion') return { floors: endgameRules.invasion.waves.map((monsters) => ({ monsters, scale: endgameRules.invasion.scale })) }
  if (scale === undefined) return {}
  const dungeon = dungeonById(id)
  return { floors: dungeon.floors.map((floor) => ({ ...floor, scale: (floor.scale ?? dungeon.monsterScale ?? 1) * scale / (dungeon.monsterScale ?? 1) })) }
}

function measure(parties: PartyMember[][], id: string, battles: number, scale?: number) {
  const variant = variantFor(id, scale)
  let eliteWins = 0
  let cleared = 0
  let damage = 0
  const rates = parties.map((party, sample) => {
    let wins = 0
    for (let run = 1; run <= battles; run += 1) {
      const result = runDungeon(party, id, tactics, sample * 107 + run, {}, variant.raid ? { ...variant, raid: { ...variant.raid } } : variant)
      if (!result.ok) throw new Error(`${id}: ${result.error}`)
      cleared += result.report.floorsCleared
      damage += result.report.units.reduce((sum, unit) => sum + unit.dealt, 0)
      if (result.report.victory) {
        wins += 1
        if (result.report.floors?.some((units) => units.some(({ elite }) => elite))) eliteWins += 1
      }
    }
    return wins / battles
  })
  const count = parties.length * battles
  return { p25: percentile(rates, 0.25), median: percentile(rates, 0.5), win: mean(rates), eliteWins, cleared: cleared / count, damage: damage / count }
}

function threshold(profile: Profile) {
  const points = curveLevels.map((level) => {
    const parties = [0, 1, 2, 3].map((sample) => lineup(sample, level, profile))
    return { level, rate: mean(reference.map((id) => measure(parties, id, 2).win)) }
  })
  const crossing = points.findIndex(({ rate }) => rate >= 0.5)
  if (crossing <= 0) throw new Error(`Unbracketed crossing: ${JSON.stringify(points)}`)
  const low = points[crossing - 1]!, high = points[crossing]!
  return low.level + (high.level - low.level) * (0.5 - low.rate) / (high.rate - low.rate)
}

function output(name: string, data: unknown) {
  console.log(JSON.stringify({ name, data }))
}

if (stage === 'all' || stage === 'branches') {
  for (const { id: klass } of classList.filter(({ id }) => !process.env.HEROTOWN_5D_CLASS || id === process.env.HEROTOWN_5D_CLASS)) {
    const rows = plans.map(({ id, order: plan }) => {
      const profile = { klass, plan, uniques: true }
      const rates = levels.map((level) => {
        const parties = [0, 1, 2, 3].map((sample) => lineup(sample, level, profile))
        const rows = scenarios.map((id) => ({ id, ...measure(parties, id, 2) }))
        if (process.env.HEROTOWN_5D_FULL) output('details', { klass, plan: id, level, rows })
        return [round(mean(rows.map(({ p25 }) => p25)) * 100), round(mean(rows.map(({ median }) => median)) * 100)]
      })
      return { id, rates, level: round(threshold(profile)) }
    })
    output('branches', { klass, rows, gap: round(Math.max(...rows.map(({ level }) => level)) - Math.min(...rows.map(({ level }) => level))) })
  }
  output('classes', classList.map(({ id }) => ({ id, level: round(threshold({ klass: id, swap: true, tier: 4 })) })))
}

if (stage === 'cleric-probe') {
  const klass = classById('cleric')
  const heal = klass.branches.find(({ id }) => id === 'cleric.mercy')!.mastery
  const bless = klass.skills.find(({ id }) => id === 'cleric.bless')!.effect!
  for (const [effect, key, values] of [[heal, 'heal', [0.06, 0.04, 0.02]], [bless, 'partyAttack', [0.025, 0.03, 0.04]]] as const) {
    const original = effect[key]
    try {
      for (const value of values) {
        effect[key] = value
        const estimates = plans.map(({ id, order: plan }) => ({ id, level: round(threshold({ klass: 'cleric', plan, uniques: true })) }))
        output('cleric-probe', { key, value, estimates })
      }
    } finally {
      effect[key] = original
    }
  }
}

if (stage === 'class-probe') {
  for (const [klass, key, values] of [['rogue', 'attackScale', [1.3, 1.25, 1.2]], ['cleric', 'healScale', [3.95, 4.1, 4.25]]] as const) {
    const definition = classById(klass)
    const original = definition[key]
    try {
      for (const scale of values) {
        definition[key] = scale
        const estimates = classList.map(({ id }) => ({ id, level: round(threshold({ klass: id, swap: true, tier: 4 })) }))
        output('class-probe', { klass, key, scale, estimates })
      }
    } finally {
      definition[key] = original
    }
  }
}

if (stage === 'all' || stage === 'allocations') {
  for (const { id: klass } of classList) {
    const rows = levels.flatMap((level) => allocations.filter((counts) => counts.reduce((sum, n) => sum + n, 0) === skillPicks(level)).map((counts) => {
      const plan = counts.flatMap((count, branch) => Array<number>(count).fill(branch))
      const parties = [0, 1, 2, 3].map((sample) => lineup(sample, level, { klass, plan, uniques: true }))
      const results = scenarios.map((id) => ({ id, ...measure(parties, id, 2) }))
      if (process.env.HEROTOWN_5D_FULL) output('allocation-details', { klass, level, counts, results })
      return { level, counts: counts.join(''), mastery: counts.filter((n) => n === 3).length,
        p25: round(mean(results.map((row) => row.p25)) * 100), median: round(mean(results.map((row) => row.median)) * 100) }
    }))
    output('allocations', { klass, rows })
  }
}

if (stage === 'all' || stage === 'gifts') {
  const base = threshold({ gift: null, uniques: true })
  output('gifts', giftRules.gifts.map(({ id }) => ({ id, lead: round(base - threshold({ gift: id, uniques: true })) })))
}

if (stage === 'all' || stage === 'gear') {
  const klass = 'archer'
  const base = threshold({ klass, gear: () => [] })
  output('gear', grades.map((grade) => {
    const tier = [1, 3, 5, 6, 7][grades.indexOf(grade)]!
    const generated = new Map<number, Gear[]>()
    const draw = (_hero: Hero, seed: number) => {
      if (!generated.has(seed)) generated.set(seed, drops(klass, tier, seed, grade))
      return generated.get(seed)!
    }
    const averageDrop = threshold({ klass, gear: draw })
    const compareOptions = (bound: 'max' | 'min') => {
      const selected = Object.fromEntries((['weapon', 'armor'] as const).map((slot) => {
        const options = smithRules.optionPool.filter((row) => row[slot]).map(({ id }) => id as GearOption['id'])
        const combos = options.reduce<GearOption['id'][][]>((all, id) => [...all, ...all.filter((ids) => ids.length < smithRules.optionCount[grade]).map((ids) => [...ids, id])], [[]])
          .filter((ids) => ids.length === smithRules.optionCount[grade])
        if (combos.length === 1 || (grade === 'rare' && slot === 'armor')) return [slot, []]
        const ranked = combos.map((ids) => {
          const effects = ids.map((id) => ({ id, value: optionRange(id, grade)![bound] }))
          const parties = [4, 5, 6].map((sample) => lineup(sample, 13, { klass, gear: (hero, seed) => draw(hero, seed)
            .map((item) => item.slot === slot ? { ...item, options: effects } : item) }))
          const results = ['haunted_citadel', 'dragon_nest', 'trial_light_3', 'abyss'].map((id) => measure(parties, id, 1))
          return { effects, win: mean(results.map(({ win }) => win)), cleared: mean(results.map(({ cleared }) => cleared)), damage: mean(results.map(({ damage }) => damage)) }
        }).sort((a, b) => a.win - b.win || a.cleared - b.cleared || a.damage - b.damage)
        return [slot, (bound === 'max' ? ranked.at(-1)! : ranked[0]!).effects]
      }))
      return { level: threshold({ klass, gear: (hero, seed) => draw(hero, seed).map((item) => ({ ...item, options: selected[item.slot] })) }), selected }
    }
    const best = compareOptions('max'), worst = compareOptions('min')
    const pieces = lootRules.uniques.filter((def) => def.grade === grade)
    const unique = pieces.length ? threshold({ klass, gear: (_, seed) => [uniqueGear(pieces[seed % pieces.length]!, `unique-${seed}`)] }) : null
    const set = grade === 'legend' ? threshold({ klass, gear: () => lootRules.uniques.filter((def) => def.set === 'dragonslayer').map((def) => uniqueGear(def, def.id)) }) : null
    return { grade, drop: round(base - averageDrop), best: round(base - best.level), worst: round(base - worst.level), bestOptions: best.selected, worstOptions: worst.selected,
      unique: unique === null ? null : round(base - unique), set: set === null ? null : round(base - set) }
  }))
}

if (stage === 'all' || stage === 'recommend') {
  const selected = process.env.HEROTOWN_5D_DUNGEON?.split(',')
  const candidates = [...new Set([...dungeons.map(({ id }) => id), ...scenarios])].filter((id) => !selected || selected.includes(id))
  for (const id of candidates) {
    const { tier, recommendedLevel, monsterScale, special } = dungeonById(id)
    const parties = samples.map((_, sample) => lineup(sample, recommendedLevel))
    const current = measure(parties, id, 10)
    let noElite
    if (tier >= 4) {
      const chance = combatRules.eliteChance
      try { combatRules.eliteChance = 0; noElite = measure(parties, id, 10) } finally { combatRules.eliteChance = chance }
    }
    const tuning = process.env.HEROTOWN_5D_CANDIDATES
    const factors = tuning ? tuning.split(',').map(Number) : [0.85, 0.92, 0.97, 1.03, 1.06, 1.1, 1.15, 1.22, 1.3, 1.4, 1.5, 1.65, 1.8, 2, 2.25, 2.5]
    const proposals = []
    if ((!special || special === 'weekday') && tier >= 3 && monsterScale && (current.p25 < 0.75 || current.p25 > 0.85)) {
      const atScale = (scale: number) => ({ scale, ...measure(parties, id, 10, scale) })
      const measured = [{ ...current, scale: monsterScale }, ...factors.map((factor) => atScale(round(monsterScale * factor)))]
        .sort((a, b) => a.scale - b.scale)
      for (let index = 1; index < measured.length; index += 1) {
        const low = measured[index - 1]!, high = measured[index]!
        if (low.p25 > 0.85 && high.p25 < 0.75) {
          for (const fraction of [0.2, 0.4, 0.6, 0.8]) proposals.push(atScale(round(low.scale + fraction * (high.scale - low.scale))))
        }
      }
      proposals.push(...measured)
    }
    const dungeon = dungeonById(id)
    const patterned = dungeon.floors.some((floor) => floor.monsters.some((monster) => (monsterById(monster).blastEvery ?? 0) > 0))
    const checked = proposals.filter(({ p25 }) => p25 >= 0.75 && p25 <= 0.85)
      .sort((a, b) => Math.abs(a.scale - (monsterScale ?? 1)) - Math.abs(b.scale - (monsterScale ?? 1))).map((proposal) => {
      if (special) return proposal
      const snapshot = dungeon.monsterScale
      try {
        dungeon.monsterScale = proposal.scale
        return { ...proposal, guardAt: winRate(id, recommendedLevel, 12),
          guardBelow: !patterned && recommendedLevel >= 4 ? winRate(id, recommendedLevel - 3, 12) : undefined }
      } finally {
        dungeon.monsterScale = snapshot
      }
    })
    output('recommend', { id, tier, level: recommendedLevel, scale: monsterScale, current, noElite, proposals: checked })
  }
}
