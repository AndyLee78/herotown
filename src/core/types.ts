export const STAT_KEYS = ['str', 'agi', 'vit', 'int', 'wil', 'wis'] as const

export type StatKey = (typeof STAT_KEYS)[number]
export type Stats = Record<StatKey, number>
export type ClassId = 'warrior' | 'rogue' | 'archer' | 'mage' | 'cleric' | 'bard' | 'dancer'
export type Gender = 'male' | 'female'
export type Role = 'tank' | 'dps' | 'healer' | 'support'
export type Reach = 'melee' | 'ranged'
export type Row = 'front' | 'back'
export type SkillKind = 'attack' | 'taunt' | 'heal' | 'buff' | 'debuff'
export type TraitId = 'tough' | 'coward' | 'nocturnal' | 'treasure' | 'ironWill' | 'frail'
export type Condition = 'healthy' | 'fatigued' | 'injured' | 'critical' | 'dead'
export type TargetPriority = 'lowestHp' | 'backRow' | 'boss'
export type DefeatReason = 'noTank' | 'noHealer' | 'retreated' | 'wiped' | 'outmatched'
export type CombatError = 'emptyParty' | 'partyTooLarge' | 'underage' | 'badFormation' | 'dead'

export type AgeBand = {
  id: string
  min: number
  max: number
  canDeploy: boolean
  physical: number
  mental: number
}

export type SkillDef = {
  id: string
  kind: SkillKind
  power: number
}

export type ClassDef = {
  id: ClassId
  role: Role
  femaleOnly: boolean
  reach: Reach
  aoe: boolean
  hpBase: number
  hpPerVit: number
  attackStat: StatKey
  attackScale: number
  defenseScale: number
  healScale: number
  skills: SkillDef[]
  potentialBias: Stats
}

export type TraitDef = {
  id: TraitId
}

export type MonsterDef = {
  id: string
  tier: 1 | 2 | 3
  boss: boolean
  row: Row
  reach: Reach
  hp: number
  attack: number
  defense: number
  speed: number
  dot: number
  resist?: number
  weakHoly?: boolean
  weakSilver?: boolean
  weakFlame?: boolean
}

export type DungeonFloor = {
  monsters: string[]
}

export type DungeonDef = {
  id: string
  tier: 1 | 2 | 3
  betweenHeal: number
  gold: number
  xp: number
  floors: DungeonFloor[]
}

export type GearSlot = 'weapon' | 'armor'
export type GearGrade = 'common' | 'fine' | 'rare'
export type GearElement = 'flame' | 'silver'
export type GearOption = 'power' | 'guard'

export type Gear = {
  id: string
  recipeId: string
  slot: GearSlot
  grade: GearGrade
  element?: GearElement
  option?: GearOption
  enhance: number
}

export type Hero = {
  id: string
  name: string
  gender: Gender
  classId: ClassId
  age: number
  training: number
  potentials: Stats
  stats: Stats
  potential: number
  traitIds: TraitId[]
  level: number
  xp: number
  skillPoints: number
  learned: string[]
  gear: Gear[]
  clears: string[]
  deaths: number
  fatigue: number
  condition: Condition
  arrivedAt?: number
  resurrectAt?: number
  treatAt?: number
}

export type Tactics = {
  target: TargetPriority
  healBelow: number
  retreatBelow: number
}

export type PartyMember = {
  hero: Hero
  row: Row
}

export type LogEntry = {
  tick: number
  key: string
  params: Record<string, string | number>
}

export type UnitReport = {
  id: string
  name: string
  nameKey: string
  side: 'hero' | 'enemy'
  hp: number
  maxHp: number
  dealt: number
  taken: number
  healed: number
}

// A unit as it stood when a floor began, for replaying the battle.
export type ReplayUnit = {
  id: string
  refId: string
  side: 'hero' | 'enemy'
  row: Row
  reach: Reach
  hp: number
  maxHp: number
  boss: boolean
}

export type ReplayHero = {
  id: string
  classId: ClassId
  gender: Gender
  age: number
}

export type DungeonReport = {
  // Replay data. Missing on reports saved before replays existed.
  dungeonId?: string
  party?: ReplayHero[]
  floors?: ReplayUnit[][]
  victory: boolean
  defeatReason: DefeatReason | null
  ticks: number
  floorsCleared: number
  gold: number
  xp: number
  units: UnitReport[]
  log: LogEntry[]
  conditions: { id: string; condition: Condition; fatigue: number }[]
}

export type DungeonResult =
  | { ok: true; report: DungeonReport }
  | { ok: false; error: CombatError }
