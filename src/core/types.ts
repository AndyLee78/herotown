import type { Genes } from './genes'

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
// Docs/personality.md
export type PersonalityId = 'social' | 'loner' | 'ambitious' | 'gentle' | 'hotheaded' | 'timid'
export type Condition = 'healthy' | 'fatigued' | 'injured' | 'critical' | 'dead'
export type TargetPriority = 'lowestHp' | 'backRow' | 'boss'
export type DefeatReason = 'noTank' | 'noHealer' | 'retreated' | 'wiped' | 'outmatched' | 'tooWeak' | 'poisoned' | 'paralyzed' | 'silenced' | 'trapped' | 'ambushed' | 'blasted'
export type PotionId = 'heal' | 'antidote' | 'tonic' | 'clarity'
// Trinkets from the magic workshop (Docs/depth.md 3b).
// Seasonal dungeon modifiers in the dragon's nest (Docs/depth.md 3d).
export type AffixId = 'venom' | 'traps' | 'ambush' | 'charged' | 'silence' | 'paralyze' | 'swift' | 'noRest'
export type TrinketId = 'alert' | 'trapSense' | 'poisonWard' | 'steady' | 'calm'
// Potions by kind: the village stock, what a party carries, or what it used.
export type Supplies = Partial<Record<PotionId, number>>
export type CombatError = 'emptyParty' | 'partyTooLarge' | 'underage' | 'badFormation' | 'dead'

export type AgeBand = {
  id: string
  min: number
  max: number
  canDeploy: boolean
  physical: number
  mental: number
}

// What a learned skill adds on top of the role's innate actions (Docs/skills.md).
export type SkillEffect = {
  attack?: number
  guard?: number
  speed?: number
  heal?: number
  threat?: number
  bleed?: number
  weaken?: number
  regen?: number
  partyGuard?: number
  partyAttack?: number
  volleyEvery?: number
  cleanse?: boolean
}

export type SkillDef = {
  id: string
  kind: SkillKind
  power: number
  effect?: SkillEffect
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
  // Can break a boss's charged blast (Docs/depth.md 3c).
  interrupt?: boolean
  skills: SkillDef[]
  potentialBias: Stats
}

export type TraitDef = {
  id: TraitId
}

export type MonsterDef = {
  id: string
  tier: 1 | 2 | 3 | 4 | 5 | 6 | 7
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
  // Status chances on a hit (Docs/depth.md 3a). Poison is `dot`.
  paralyze?: number
  slow?: number
  silence?: number
  // Every n-th action hits the whole party.
  aoeEvery?: number
  // Poison this monster can stack up to (default combatRules.dotCap).
  poisonCap?: number
  // Starts a floor ready to strike the back row, unless someone is on watch (3b).
  ambush?: boolean
  // Boss patterns (Docs/depth.md 3c): every n-th action charges, the next blasts.
  blastEvery?: number
  blastPower?: number
  phases?: BossPhase[]
}

export type BossPhase = {
  // Starts when the boss's health falls to this share.
  at: number
  summon?: string[]
  blastEvery?: number
  attackUp?: number
}

export type DungeonFloor = {
  monsters: string[]
  // Chance of a trap before the fight (Docs/depth.md 3b).
  trapChance?: number
  // This floor's own monster scale, for the abyss that grows floor by floor (Docs/endgame.md 4a).
  scale?: number
}

export type DungeonDef = {
  id: string
  tier: 1 | 2 | 3 | 4 | 5 | 6 | 7
  recommendedLevel: number
  // Multiplies monster health and attack in this dungeon (1 = as listed).
  monsterScale?: number
  betweenHeal: number
  gold: number
  xp: number
  floors: DungeonFloor[]
  // Weekday trials and the endless abyss (Docs/endgame.md 4a) live apart from
  // the regular dungeon ladder.
  special?: 'weekday' | 'endless' | 'raid' | 'invasion'
  element?: Essence
  difficulty?: 1 | 2 | 3
}

// The weekday essences (Docs/endgame.md 4a).
export type Essence = 'flame' | 'frost' | 'light'

export type GearSlot = 'weapon' | 'armor' | 'trinket'
// Heroic and legendary gear come with smith levels 4 and 5 (Docs/endgame.md).
export type GearGrade = 'common' | 'fine' | 'rare' | 'epic' | 'legend'
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
  // Left behind or handed down by a hero (Docs/tavern.md).
  heirloom?: { ownerId: string; ownerName: string; family?: string; generations: number; comforted?: string[] }
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
  // 0-100; missing means the base (Docs/morale.md).
  morale?: number
  // Scouting (Docs/scouting.md): how much an interview revealed, and a hidden prodigy.
  interviewed?: number
  prodigy?: boolean
  // A child at school (Docs/school.md).
  school?: { focus?: StatKey; career?: ClassId; seasons: number; carry: number }
  // Missing on heroes from before personalities: personalityOf derives one from the id.
  personality?: PersonalityId
  // Defeats in a row, and trips watched from home while friends went (Docs/personality.md).
  losses?: number
  benched?: number
  gear: Gear[]
  clears: string[]
  deaths: number
  fatigue: number
  condition: Condition
  arrivedAt?: number
  resurrectAt?: number
  treatAt?: number
  recoverAt?: number
  // Family (stage 2). Missing on heroes from before families existed.
  family?: string
  parents?: [string, string]
  spouseId?: string
  widowedAt?: number
  // A child on the way: decided at conception, born at dueAt.
  expecting?: { dueAt: number; child: Hero }
  genes?: Genes
}

// Affinity between two heroes, stored once per pair with a < b.
export type Bond = {
  a: string
  b: string
  affinity: number
  // No new proposal from this pair before this time (after a refusal).
  cooldownUntil?: number
}

export type Proposal = {
  a: string
  b: string
  at: number
}

export type BondStage = 'stranger' | 'friend' | 'lover' | 'spouse'

export type Tactics = {
  target: TargetPriority
  healBelow: number
  retreatBelow: number
  // Drink a healing potion below this HP %. Missing on older presets.
  potionBelow?: number
  // Against a charged blast: break it, or brace for it (Docs/depth.md 3c).
  blast?: 'interrupt' | 'brace'
}

export type PartyMember = {
  hero: Hero
  row: Row
  // Bonds and personality fit with the party: attack goes up (or down) by this share.
  bonus?: number
  // Healing goes up by the bond share only (review 49c92da); missing means the bonus, if positive.
  healBonus?: number
  // Extra attack and defense from family heirlooms the hero wears (Docs/tavern.md).
  heirloom?: { attack: number; defense: number }
  // A legend among their forebears: attack goes up by this share (Docs/legends.md).
  blessing?: number
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
  genes?: Genes
}

export type DungeonReport = {
  // Replay data. Missing on reports saved before replays existed.
  dungeonId?: string
  party?: ReplayHero[]
  floors?: ReplayUnit[][]
  // Filled in when an expedition comes home.
  presetId?: string
  finishedAt?: number
  gained?: { gold: number; fame: number; materials: Partial<Record<'wood' | 'stone' | 'iron' | 'bone' | 'herb' | 'crystal', number>>; vault?: Partial<Record<'flame' | 'frost' | 'light' | 'abyss', number>> }
  // Where an abyss run started and the deepest floor after it (Docs/endgame.md 4a).
  abyss?: { from: number; best: number }
  potionsUsed?: Supplies
  // Traps met on the way, in dungeons that have them.
  traps?: { sprung: number; disarmed: number }
  // The nest's affixes on this trip (Docs/depth.md 3d).
  affixes?: AffixId[]
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
