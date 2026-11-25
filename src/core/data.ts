import adsFile from '../data/ads.json'
import alchemyFile from '../data/alchemy.json'
import ageBandsFile from '../data/ageBands.json'
import classesFile from '../data/classes.json'
import lifeFile from '../data/life.json'
import magicFile from '../data/magic.json'
import nestFile from '../data/nest.json'
import trainingFile from '../data/training.json'
import guildFile from '../data/guild.json'
import moraleFile from '../data/morale.json'
import automationFile from '../data/automation.json'
import scoutingFile from '../data/scouting.json'
import schoolFile from '../data/school.json'
import marketFile from '../data/market.json'
import personalityFile from '../data/personality.json'
import smithFile from '../data/smith.json'
import combatFile from '../data/combat.json'
import dungeonsFile from '../data/dungeons.json'
import expeditionFile from '../data/expedition.json'
import familyFile from '../data/family.json'
import fountainFile from '../data/fountain.json'
import retirementFile from '../data/retirement.json'
import monstersFile from '../data/monsters.json'
import namesFile from '../data/names.json'
import progressionFile from '../data/progression.json'
import timeFile from '../data/time.json'
import traitsFile from '../data/traits.json'
import villageFile from '../data/village.json'
import type {
  AgeBand,
  ClassDef,
  ClassId,
  DungeonDef,
  MonsterDef,
  SkillKind,
  StatKey,
  Stats,
  TraitDef,
  TraitId,
  PotionId,
  TrinketId,
} from './types'

const SKILL_KINDS = new Set<SkillKind>(['attack', 'taunt', 'heal', 'buff', 'debuff'])
const TRAIT_IDS = new Set<TraitId>(['tough', 'coward', 'nocturnal', 'treasure', 'ironWill', 'frail'])

export type GameData = {
  ageBands: AgeBand[]
  maxAge: number
  classes: ClassDef[]
  traits: TraitDef[]
  monsters: MonsterDef[]
  dungeons: DungeonDef[]
  names: { male: string[]; female: string[] }
  progression: typeof progressionFile
  combat: typeof combatFile
  time: typeof timeFile
  village: typeof villageFile
  life: typeof lifeFile
  smith: typeof smithFile
  ads: typeof adsFile
}

export function validateGameData(data: GameData): void {
  if (data.classes.length !== 7) {
    throw new Error(`Expected 7 classes, found ${data.classes.length}`)
  }
  const classIds = new Set<string>()
  for (const klass of data.classes) {
    if (classIds.has(klass.id)) {
      throw new Error(`Duplicate class ${klass.id}`)
    }
    classIds.add(klass.id)
    if (klass.skills.length < 3 || klass.skills.length > 4) {
      throw new Error(`${klass.id} must have 3 or 4 skills`)
    }
    for (const skill of klass.skills) {
      if (!SKILL_KINDS.has(skill.kind)) {
        throw new Error(`${klass.id} has unknown skill kind ${skill.kind}`)
      }
    }
    const kinds = new Set(klass.skills.map((skill) => skill.kind))
    if (klass.role === 'tank' && !kinds.has('taunt')) {
      throw new Error(`${klass.id} is a tank without taunt`)
    }
    if (klass.role === 'healer' && !kinds.has('heal')) {
      throw new Error(`${klass.id} is a healer without heal`)
    }
    if (klass.role === 'support' && !kinds.has('buff') && !kinds.has('debuff')) {
      throw new Error(`${klass.id} is a support without buff or debuff`)
    }
    if (klass.role === 'dps' && !kinds.has('attack')) {
      throw new Error(`${klass.id} is a damage class without attack`)
    }
  }
  if (!data.classes.some((klass) => klass.id === 'dancer' && klass.femaleOnly)) {
    throw new Error('Dancer must be female-only')
  }
  if (data.traits.length < 5) {
    throw new Error('Need at least 5 traits')
  }
  for (const trait of data.traits) {
    if (!TRAIT_IDS.has(trait.id)) {
      throw new Error(`Unknown trait ${trait.id}`)
    }
  }
  if (data.names.male.length < 100 || data.names.female.length < 100) {
    throw new Error('Name pools must contain at least 100 names each')
  }
  const monsterIds = new Set<string>()
  let bosses = 0
  for (const monster of data.monsters) {
    if (monsterIds.has(monster.id)) {
      throw new Error(`Duplicate monster ${monster.id}`)
    }
    monsterIds.add(monster.id)
    if (monster.boss) {
      bosses += 1
    }
    if (monster.hp <= 0 || monster.speed <= 0) {
      throw new Error(`Monster ${monster.id} has invalid combat numbers`)
    }
  }
  if (data.monsters.length < 8 || bosses < 2) {
    throw new Error('Need at least 8 monsters and 2 bosses')
  }
  if (data.life.injury.recoverMs <= 0 || data.life.injury.recoverMs > data.time.seasonMs) {
    throw new Error('Injury recovery must be positive and at most one season')
  }
  if (data.life.fatigue.tiredAt >= data.life.fatigue.exhaustedAt) {
    throw new Error('Exhaustion must start after tiredness')
  }
  if (data.dungeons.length < 2) {
    throw new Error('Need at least 2 dungeons')
  }
  const needed = ['hall', 'inn', 'house', 'guild', 'smith', 'temple', 'fountain', 'alchemy', 'magic', 'training', 'school', 'market']
  if (data.village.buildings.length !== needed.length || needed.some((id) => !data.village.buildings.some((building) => building.id === id))) {
    throw new Error(`The town needs exactly these buildings: ${needed.join(', ')}`)
  }
  const buildingIds = new Set(data.village.buildings.map((building) => building.id))
  if (buildingIds.size !== data.village.buildings.length) {
    throw new Error('Duplicate building id')
  }
  for (const level of data.village.levels) {
    if (level.fame < 0 || level.visitorPotential < 0) {
      throw new Error(`Village level ${level.level} has a negative requirement`)
    }
  }
  for (const dungeon of data.dungeons) {
    if (!Number.isInteger(dungeon.recommendedLevel) || dungeon.recommendedLevel < 1) {
      throw new Error(`${dungeon.id} needs a recommended level of at least 1`)
    }
    if (dungeon.floors.length < 2) {
      throw new Error(`${dungeon.id} needs multiple floors`)
    }
    const last = dungeon.floors[dungeon.floors.length - 1]
    const hasBoss = last?.monsters.some((id) => data.monsters.find((monster) => monster.id === id)?.boss)
    if (!hasBoss) {
      throw new Error(`${dungeon.id} must end on a boss floor`)
    }
    for (const floor of dungeon.floors) {
      const summoned = floor.monsters.flatMap((id) => data.monsters.find((monster) => monster.id === id)?.phases?.flatMap((phase) => phase.summon ?? []) ?? [])
      for (const id of [...floor.monsters, ...summoned]) {
        if (!monsterIds.has(id)) {
          throw new Error(`${dungeon.id} references missing monster ${id}`)
        }
      }
    }
  }
}

export const ageBands = ageBandsFile.bands as AgeBand[]
export const maxAge = ageBandsFile.maxAge
export const classList = classesFile.classes as ClassDef[]
export const traits = traitsFile.traits as TraitDef[]
export const monsters = monstersFile.monsters as MonsterDef[]
export const dungeons = dungeonsFile.dungeons as DungeonDef[]
export const names = namesFile
export const progression = progressionFile
export const combatRules = combatFile
export const timeRules = timeFile
export const villageRules = villageFile
export const lifeRules = lifeFile
export const smithRules = smithFile
export const adRules = adsFile
export const expeditionRules = expeditionFile
export const retirementRules = retirementFile
export const familyRules = familyFile
export const alchemyRules = alchemyFile as {
  potionsPerTrip: number
  batch: number
  potionBelow: number
  antidoteAt: number
  speedByLevel: number[]
  potions: { id: PotionId; alchemyLevel: number; gold: number; herb: number; bone: number; ms: number; heal?: number }[]
}

export function potionById(id: string) {
  return alchemyRules.potions.find((potion) => potion.id === id)
}

if (alchemyRules.potions.some((potion) => potion.alchemyLevel < 1 || potion.ms <= 0 || potion.herb < 0)) {
  throw new Error('Every potion needs a workshop level and a brewing time')
}
export const magicRules = magicFile as {
  trinketSlots: number
  speedByLevel: number[]
  disarm: number
  senseDisarm: number
  disarmGold: number
  trapDamage: number
  ambushPower: number
  ward: number
  trinkets: { id: TrinketId; magicLevel: number; gold: number; crystal: number; ms: number }[]
}

export function trinketById(id: string) {
  return magicRules.trinkets.find((trinket) => trinket.id === id)
}

if (magicRules.trinkets.some((trinket) => trinket.magicLevel < 1 || trinket.ms <= 0 || trinket.crystal < 0)) {
  throw new Error('Every trinket needs a workshop level and a making time')
}
export const trainingRules = trainingFile
export const moraleRules = moraleFile
export const automationRules = automationFile
export const scoutingRules = scoutingFile
export const schoolRules = schoolFile
export const marketRules = marketFile
export const personalityRules = personalityFile as {
  ids: string[]
  emotion: Record<import('./types').PersonalityId, Record<'grief' | 'joy' | 'pride' | 'anxiety' | 'resentment', number>>
  bondGrowth: Record<import('./types').PersonalityId, number>
  pairs: { a: string; b: string; affinity: number; party: number }[]
  partyMin: number
  inherit: number
  anxiety: { lossStreak: number; loss: number; familyCritical: number }
  resentment: { benchedTrips: number; loss: number }
}
export const guildRules = guildFile as typeof guildFile & { deliverAmount: Record<string, number>; materialValue: Record<string, number> }
export const nestRules = nestFile as typeof nestFile & { floors: string[][][] }
export const fountainRules = fountainFile

fountainRules.levels.forEach((level, index) => {
  if (level.level !== index + 1 || level.intervalMs <= 0 || level.cap < 1 || level.gold < 1 || level.jackpotChance < 0 || level.jackpotChance > 1 || level.jackpotMultiplier < 1) {
    throw new Error(`Fountain level ${index + 1} has bad numbers`)
  }
})

if (familyRules.friendAt >= familyRules.loverAt || familyRules.loverAt > familyRules.proposeAt || familyRules.proposeAt > 100) {
  throw new Error('Family thresholds must rise: friend < lover <= propose <= 100')
}
for (const key of ['birthChance', 'proposeChance', 'traitInherit', 'traitMutation', 'geniusChance', 'visitorBalanceChance'] as const) {
  if (familyRules[key] < 0 || familyRules[key] > 1) {
    throw new Error(`Family rule ${key} must be a chance between 0 and 1`)
  }
}
if (familyRules.oldAgeChancePerYear <= 0 || familyRules.oldAgeFrom >= maxAge) {
  throw new Error('Old age must start before the oldest age and carry a positive chance')
}
if (!Number.isInteger(familyRules.childYearsPerYear) || familyRules.childYearsPerYear < 1) {
  throw new Error('Children must age at least one year per year')
}

if (retirementRules.minAge > retirementRules.adviseAge) {
  throw new Error('Retirement must be allowed before it is advised')
}

for (const key of ['travelMs', 'returnMs', 'msPerTick', 'presets', 'history'] as const) {
  if (!Number.isInteger(expeditionRules[key]) || expeditionRules[key] < 1) {
    throw new Error(`Expedition rule ${key} must be a positive integer`)
  }
}

const adPlacements = ['absence', 'construction', 'temple'] as const
for (const placement of adPlacements) {
  const rule = adRules[placement]
  if (!Number.isInteger(rule.daily) || rule.daily < 1) {
    throw new Error(`${placement} ads need a daily cap of at least 1`)
  }
}
if (adRules.construction.shortenRatio <= 0 || adRules.construction.shortenRatio > 1) {
  throw new Error('Construction ads need a shorten ratio between 0 and 1')
}
if (!Number.isInteger(adRules.construction.shortenMinMs) || adRules.construction.shortenMinMs < 1) {
  throw new Error('Construction ads need a positive minimum shorten time')
}

validateGameData({
  ageBands,
  maxAge,
  classes: classList,
  traits,
  monsters,
  dungeons,
  names,
  progression,
  combat: combatRules,
  time: timeFile,
  village: villageFile,
  life: lifeFile,
  smith: smithFile,
  ads: adsFile,
})

const PHYSICAL: ReadonlySet<StatKey> = new Set(['str', 'agi', 'vit'])

export function bandForAge(age: number): AgeBand {
  const band = ageBands.find((entry) => age >= entry.min && age <= entry.max)
  if (!band) {
    throw new Error(`No age band for ${age}`)
  }
  return band
}

export function classById(id: ClassId): ClassDef {
  const found = classList.find((entry) => entry.id === id)
  if (!found) {
    throw new Error(`Unknown class ${id}`)
  }
  return found
}

export function monsterById(id: string): MonsterDef {
  const found = monsters.find((entry) => entry.id === id)
  if (!found) {
    throw new Error(`Unknown monster ${id}`)
  }
  return found
}

export function dungeonById(id: string): DungeonDef {
  const found = dungeons.find((entry) => entry.id === id)
  if (!found) {
    throw new Error(`Unknown dungeon ${id}`)
  }
  return found
}

export function ageMultiplier(age: number, stat: StatKey): number {
  const band = bandForAge(age)
  return PHYSICAL.has(stat) ? band.physical : band.mental
}

export function emptyStats(): Stats {
  return { str: 0, agi: 0, vit: 0, int: 0, wil: 0, wis: 0 }
}
