import { chargeFountain, freshFountain, makeWish, readFountain, upgradeFountain, type FountainState } from './fountain'
import { claimGuide, guideSteps } from './guide'
import { skillPicks } from './skills'
import { deliver, ensureBoard, expeditionSlotsFor, guildLevel, progressClear, readBoard, type GuildBoard } from './guild'
import { cheer, driftMorale, lowMorale, mourn, shiftMorale } from './morale'
import { arrive, interview, type Interviews } from './scouting'
import { enroll, graduate, teachSeason, unenroll } from './school'
import { forgetSkill, readDrills, runDrills, startDrill, type Drill } from './drill'
import { buyIntel, finishScout, isNest, nestSeason, readScout, seasonKey, startScout, type ScoutJob } from './nest'
import { TRINKET_IDS, enchantTime, finishEnchant, readMagicJob, startEnchant, type MagicJob } from './magic'
import { POTION_IDS, brewTime, finishBrew, readAlchemyJob, readSupplies, returnSupplies, startBrew, takeSupplies, type AlchemyJob } from './alchemy'
import { adRules, automationRules, potionById, trinketById, moraleRules, magicRules, nestRules, classById, classList, combatRules, dungeonById, dungeons, expeditionRules, lifeRules, progression, retirementRules, smithRules, timeRules, villageRules } from './data'
import { forgeGear, normalizeGear, recipeById } from './gear'
import { applyReport, DEFAULT_TACTICS, gainXp, runDungeon } from './dungeon'
import { canDeploy, generateHero, isChild, generateVisitors, normalizeHero, restHero, withAge } from './hero'
import { acceptProposal, bedsTaken, bondParty, declineProposal, deliverBirths, femaleChance, graveFor, nextAge, partyBonus, passAway, readBonds, readProposals, tidyFamily, turnSeason, wageCount, type FamilyEvents } from './family'
import { createRng } from './rng'
import type { Rng } from './rng'
import type { Genes } from './genes'
import type { Bond, ClassId, CombatError, DungeonReport, Gear, GearSlot, Gender, Hero, PartyMember, PotionId, Proposal, Role, Row, Supplies, Tactics, TrinketId , StatKey } from './types'

export const SAVE_VERSION = 19

export type SeasonId = 'spring' | 'summer' | 'autumn' | 'winter'

export type Calendar = {
  year: number
  season: SeasonId
  intoSeasonMs: number
}

export type AbsenceReport = {
  elapsedMs: number
  capped: boolean
  seasonsPassed: number
  year: number
  season: SeasonId
  goldGained: number
  wagesPaid: number
  injuries: string[]
  completed: string[]
  crafted: string[]
  visitors: string[]
  autoRuns: number
  autoGold: number
  adClaimed: boolean
  aged: { name: string; age: number }[]
  returned: { dungeonId: string; victory: boolean }[]
  births: string[]
  proposals: number
  deaths: string[]
}

export type SmithJob = {
  kind: 'craft' | 'enhance'
  recipeId: string
  gear: Gear | null
  finishAt: number
}

export type BuildingId = 'hall' | 'inn' | 'house' | 'guild' | 'smith' | 'temple' | 'fountain' | 'alchemy' | 'magic' | 'training' | 'school'
export type MaterialName = 'wood' | 'stone' | 'iron' | 'bone' | 'herb' | 'crystal'

export type AutoPolicy = 'material' | 'safe' | 'fixed'

export type AutoPlan = {
  enabled: boolean
  dungeonId: string
  policy: AutoPolicy
  material: MaterialName
  party: PartySlot[]
  // Time toward the next auto run and a run counter for battle seeds, so
  // splitting time into short ticks changes nothing (review 1208be3).
  carryMs?: number
  nonce?: number
}
export type Materials = Record<MaterialName, number>

export type Construction = {
  id: BuildingId
  finishAt: number
}

export type PartySlot = {
  id: string
  row: Row
}

// A saved party: who stands where, and the tactics they fight with.
export type PartyPreset = {
  id: string
  slots: PartySlot[]
  tactics: Tactics
  // Potions this party asks to carry (Docs/depth.md 3a).
  supplies?: Supplies
}

// A party out of town. The fight is decided when it leaves; rewards and
// injuries land when it comes back at returnAt.
export type Expedition = {
  id: string
  presetId: string
  dungeonId: string
  heroIds: string[]
  seed: number
  report: DungeonReport
  departAt: number
  battleAt: number
  battleEndAt: number
  returnAt: number
  // Potions taken from the stock; what is left comes back.
  supplies?: Supplies
  // The nest season this trip went into (Docs/depth.md 3d).
  nestKey?: string
}

// A hero who has hung up their sword. They stay in town, cost no wages,
// keep ageing, and can run one building for a bonus (GDD 3.3, 5.2).
export type Retiree = {
  hero: Hero
  retiredYear: number
  building: BuildingId | null
}

export type Grave = {
  id: string
  name: string
  classId: ClassId
  level: number
  clears: string[]
  // Stage 2b. Missing on graves from before natural death existed.
  cause?: 'battle' | 'oldAge'
  year?: number
  age?: number
  gender?: Gender
  family?: string
  parents?: [string, string]
  spouseId?: string
  genes?: Genes
  // In the hall of fame (Docs/generations.md 11).
  legend?: boolean
}

export type GameNotice =
  | 'poor'
  | 'missing'
  | 'beds'
  | 'building'
  | 'locked'
  | 'maxLevel'
  | 'resources'
  | 'wages'
  | 'seenDeath'
  | 'noTemple'
  | 'skill'
  | 'treat'
  | 'noSmith'
  | 'smithBusy'
  | 'noAlchemy'
  | 'alchemyBusy'
  | 'noMagic'
  | 'scoutHero'
  | 'noTraining'
  | 'guildRecord'
  | 'festivalDone'
  | 'queueFull'
  | 'interviewed'
  | 'noSchool'
  | 'tooYoung'
  | 'schoolFull'
  | 'career'
  | 'hireTown'
  | 'drillHero'
  | 'trainingFull'
  | 'scoutBusy'
  | 'nestKnown'
  | 'noGuild'
  | 'magicBusy'
  | 'recipe'
  | 'enhanceFail'
  | 'autoLocked'
  | 'adLimit'
  | 'adUsed'
  | 'busyHero'
  | 'slotsFull'
  | 'lockedDungeon'
  | 'tooYoung'
  | 'postTaken'
  | 'wornParty'
  | 'noWish'
  | 'noHouse'
  | CombatError
  | 'checksum'
  | 'newer'
  | null

export type GameState = {
  version: typeof SAVE_VERSION
  gold: number
  materials: Materials
  fame: number
  buildings: Record<BuildingId, number>
  construction: Construction | null
  smith: SmithJob | null
  stash: Gear[]
  craftNonce: number
  cleared: string[]
  questProgress: number
  questClaimed: boolean
  nextVisitorAt: number
  warning: 'wages' | null
  graveyard: Grave[]
  seed: number
  seedLocked: boolean
  visitorNonce: number
  day: number
  calendar: Calendar
  lastTickAt: number
  visitors: Hero[]
  roster: Hero[]
  presets: PartyPreset[]
  presetId: string
  expeditions: Expedition[]
  expeditionNonce: number
  history: DungeonReport[]
  dungeonId: string
  absence: AbsenceReport | null
  notice: GameNotice
  auto: AutoPlan
  ads: AdUses
  guideStep: number
  retirees: Retiree[]
  bonds: Bond[]
  proposals: Proposal[]
  familyNonce: number
  // Children who have just come of age, for the welcome notice (cleared by 'seenAdults').
  comingOfAge: string[]
  fountain: FountainState
  alchemy: AlchemyJob | null
  potions: Supplies
  magic: MagicJob | null
  // The nest season revealed by scouting, intel or a trip (Docs/depth.md 3d).
  nestSeen: string | null
  scout: ScoutJob | null
  // Heroes at the training ground (Docs/skills.md).
  drills: Drill[]
  // The guild's contract board (Docs/guild.md).
  guild: GuildBoard | null
  // The festival held this season, if any (Docs/morale.md).
  festival: Festival | null
  // Workshop queues and standing orders (Docs/automation.md).
  automation: Automation
  // Interviews used this season (Docs/scouting.md).
  interviews: Interviews | null
}

export type QueueBuilding = 'smith' | 'alchemy' | 'magic'
export type Automation = {
  care: boolean
  drill: boolean
  potions: Supplies
  queues: { smith: string[]; alchemy: PotionId[]; magic: TrinketId[] }
}

export function freshAutomation(): Automation {
  return { care: automationRules.carePerDefault, drill: false, potions: {}, queues: { smith: [], alchemy: [], magic: [] } }
}

export type Festival = { season: string; kind: SeasonId }

export type AdPlacement = 'absence' | 'construction' | 'temple'

export type AdUses = {
  date: string
  counts: Record<AdPlacement, number>
}

export type GameAction =
  | { type: 'hire'; id: string; now?: number }
  | { type: 'rest'; times: number }
  | { type: 'depart'; presetId?: string; confirm?: boolean; now?: number }
  | { type: 'learn'; id: string; skillId: string }
  | { type: 'treat'; id: string; now: number }
  | { type: 'revive'; id: string; now: number }
  | { type: 'dismiss'; id: string }
  | { type: 'craft'; recipeId: string; now: number }
  | { type: 'enhance'; gearId: string; now: number }
  | { type: 'equip'; heroId: string; gearId: string }
  | { type: 'unequip'; heroId: string; slot: GearSlot; gearId?: string }
  | { type: 'enchant'; trinketId: TrinketId; now: number }
  | { type: 'add'; id: string; presetId?: string }
  | { type: 'row'; id: string; row: Row; presetId?: string }
  | { type: 'remove'; id: string; presetId?: string }
  | { type: 'preset'; id: string }
  | { type: 'dungeon'; id: string }
  | { type: 'tactics'; tactics: Tactics; presetId?: string }
  | { type: 'build'; id: BuildingId; now: number }
  | { type: 'finishBuild'; now: number }
  | { type: 'auto'; enabled: boolean }
  | { type: 'autoPolicy'; policy: AutoPolicy }
  | { type: 'autoMaterial'; material: MaterialName }
  | { type: 'autoDungeon'; id: string }
  | { type: 'autoParty' }
  | { type: 'dismissAbsence' }
  | { type: 'catchUp'; now: number }
  | { type: 'debugGold' }
  | { type: 'refreshVisitors' }
  | { type: 'lockSeed'; locked: boolean }
  | { type: 'setSeed'; seed: number }
  | { type: 'reset'; now: number }
  | { type: 'adReward'; placement: AdPlacement; now: number }
  | { type: 'claimGuide' }
  | { type: 'retire'; id: string }
  | { type: 'assignRetiree'; id: string; building: BuildingId | null }
  | { type: 'acceptProposal'; a: string; b: string; now?: number }
  | { type: 'seenAdults' }
  | { type: 'scout'; heroId: string; now: number }
  | { type: 'buyIntel' }
  | { type: 'drill'; heroId: string; now: number }
  | { type: 'forget'; heroId: string; skillId: string }
  | { type: 'deliver'; contractId: string }
  | { type: 'festival' }
  | { type: 'dequeue'; building: QueueBuilding; index: number }
  | { type: 'automation'; care?: boolean; drill?: boolean }
  | { type: 'potionTarget'; potionId: PotionId; count: number }
  | { type: 'interview'; id: string }
  | { type: 'enroll'; heroId: string; focus: StatKey | null; career: ClassId | null }
  | { type: 'unenroll'; heroId: string }
  | { type: 'declineProposal'; a: string; b: string; now?: number }
  | { type: 'wish'; now: number }
  | { type: 'brew'; potionId: PotionId; now: number }
  | { type: 'supplies'; potionId: PotionId; count: number; presetId?: string }

export function freshState(seed: number, now: number): GameState {
  return {
    version: SAVE_VERSION,
    gold: progression.startGold,
    materials: { ...villageRules.start, herb: 0, crystal: 0 },
    fame: 0,
    buildings: startingBuildings(),
    construction: null,
    smith: null,
    stash: [],
    craftNonce: 0,
    cleared: [],
    questProgress: 0,
    questClaimed: false,
    nextVisitorAt: now + villageRules.inn.arriveEveryMs,
    warning: null,
    graveyard: [],
    seed,
    seedLocked: false,
    visitorNonce: 0,
    day: 1,
    calendar: { year: timeRules.startYear, season: 'spring', intoSeasonMs: 0 },
    lastTickAt: now,
    // The first visitors always include a tank and a healer, so a new village can field a working party.
    visitors: stampVisitors(generateVisitors(seed, visitorCap(1), townLevel(0).visitorPotential, 0.5, progression.starterClasses as ClassId[]), now),
    roster: [],
    presets: makePresets(),
    presetId: 'p1',
    expeditions: [],
    expeditionNonce: 0,
    history: [],
    dungeonId: 'hill_cave',
    absence: null,
    notice: null,
    auto: { enabled: false, dungeonId: 'hill_cave', policy: 'safe', material: 'wood', party: [] },
    ads: emptyAds(now),
    guideStep: 0,
    retirees: [],
    bonds: [],
    proposals: [],
    familyNonce: 0,
    comingOfAge: [],
    fountain: freshFountain(now),
    alchemy: null,
    potions: {},
    magic: null,
    nestSeen: null,
    scout: null,
    drills: [],
    guild: null,
    festival: null,
    automation: freshAutomation(),
    interviews: null,
  }
}

export function reduce(state: GameState, action: GameAction): GameState {
  const next = applyAction(state, action)
  // A town level-up cheers everyone, whatever raised the fame: a first clear,
  // a building, a festival or a contract (Docs/morale.md, review b9036a0).
  const gained = townLevel(next.fame).level - townLevel(state.fame).level
  if (gained > 0 && next !== state) {
    return { ...next, roster: next.roster.map((hero) => shiftMorale(hero, moraleRules.pride.townLevel * gained)) }
  }
  return next
}

function applyAction(state: GameState, action: GameAction): GameState {
  const now = 'now' in action && typeof action.now === 'number' ? action.now : state.lastTickAt
  const next = tidyFamily(apply(state, action), now)
  return action.type === 'catchUp' ? next : { ...next, notice: next.notice }
}

export function catchUp(state: GameState, now: number): GameState {
  return reduce(state, { type: 'catchUp', now })
}

export function checksum(text: string): string {
  let hash = 2166136261
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

export function exportSave(state: GameState): string {
  const saved = { ...state, notice: null, absence: null }
  const body = JSON.stringify(saved)
  return JSON.stringify({ version: SAVE_VERSION, checksum: checksum(body), body })
}

export function importSave(text: string, now: number): GameState {
  const envelope = JSON.parse(text) as { version?: number; checksum?: string; body?: string }
  if (typeof envelope.body !== 'string' || envelope.checksum !== checksum(envelope.body)) {
    throw new Error('checksum')
  }
  if (typeof envelope.version === 'number' && envelope.version > SAVE_VERSION) {
    throw new Error('newer')
  }
  return migrate(JSON.parse(envelope.body) as unknown, now)
}

export function migrate(raw: unknown, now: number): GameState {
  if (raw == null || typeof raw !== 'object') {
    return freshState(1, now)
  }
  const record = raw as Record<string, unknown>
  if (record.version === 1) {
    return fromLegacy(record, now)
  }
  if (typeof record.version === 'number' && record.version >= 2 && record.version <= SAVE_VERSION) {
    return normalize(record, now)
  }
  if (typeof record.version === 'number' && record.version > SAVE_VERSION) {
    throw new Error('newer')
  }
  return freshState(1, now)
}

function apply(state: GameState, action: GameAction): GameState {
  if (action.type === 'hire') {
    const hero = state.visitors.find((entry) => entry.id === action.id)
    if (!hero) {
      return { ...state, notice: 'missing' }
    }
    if (state.gold < progression.hireCost) {
      return { ...state, notice: 'poor' }
    }
    // Promising visitors join only a village big enough (Docs/scouting.md).
    if (hero.terms && townLevel(state.fame).level < hero.terms) {
      return { ...state, notice: 'hireTown' }
    }
    // Babies on the way already have a bed waiting for them.
    if (bedsTaken(state) >= bedCount(state.buildings.house)) {
      return { ...state, notice: 'beds' }
    }
    const hired = {
      ...state,
      notice: null,
      gold: state.gold - progression.hireCost,
      visitors: state.visitors.filter((entry) => entry.id !== hero.id),
      roster: [...state.roster, hero],
    }
    return scheduleVisitor(hired, action.now ?? state.lastTickAt)
  }
  if (action.type === 'rest') {
    // Wages are paid once per season by the clock, so resting is free.
    let roster = state.roster
    const times = Math.max(0, Math.round(action.times))
    for (let index = 0; index < times; index += 1) {
      roster = roster.map((hero) => restHero(hero, restBonus(state.buildings.house)))
    }
    return { ...state, notice: null, roster, day: state.day + times }
  }
  if (action.type === 'depart') {
    return startExpedition(state, action.presetId ?? state.presetId, action.confirm === true, action.now ?? state.lastTickAt)
  }
  if (action.type === 'learn') {
    return learnSkill(state, action.id, action.skillId)
  }
  if (action.type === 'treat') {
    return startTreat(state, action.id, action.now)
  }
  if (action.type === 'revive') {
    return startRevive(state, action.id, action.now)
  }
  if (action.type === 'dismiss') {
    if (busyHeroIds(state).has(action.id)) {
      return { ...state, notice: 'busyHero' }
    }
    return dropFromPresets({ ...state, notice: null, roster: state.roster.filter((hero) => hero.id !== action.id) })
  }
  if (action.type === 'craft') {
    return state.smith ? enqueue(state, 'smith', action.recipeId) : startCraft(state, action.recipeId, action.now)
  }
  if (action.type === 'enhance') {
    return startEnhance(state, action.gearId, action.now)
  }
  if (action.type === 'equip') {
    return equipGear(state, action.heroId, action.gearId)
  }
  if (action.type === 'unequip') {
    return unequipGear(state, action.heroId, action.slot, action.gearId)
  }
  if (action.type === 'build') {
    return startBuild(state, action.id, action.now)
  }
  if (action.type === 'finishBuild') {
    return finishConstruction(state, Math.max(action.now, state.construction?.finishAt ?? action.now), [])
  }
  if (action.type === 'auto') {
    // Auto runs come with the guild (Docs/guild.md).
    if (action.enabled && state.buildings.guild < 1) {
      return { ...state, notice: 'noGuild' }
    }
    return { ...state, notice: null, auto: { ...state.auto, enabled: action.enabled } }
  }
  if (action.type === 'autoPolicy') {
    return { ...state, notice: null, auto: { ...state.auto, policy: action.policy } }
  }
  if (action.type === 'autoMaterial') {
    return { ...state, notice: null, auto: { ...state.auto, material: action.material } }
  }
  if (action.type === 'autoDungeon') {
    if (!state.cleared.includes(action.id)) {
      return { ...state, notice: 'autoLocked' }
    }
    return { ...state, notice: null, auto: { ...state.auto, dungeonId: action.id } }
  }
  if (action.type === 'autoParty') {
    const preset = presetById(state, state.presetId)
    return { ...state, notice: null, auto: { ...state.auto, party: (preset?.slots ?? []).map((slot) => ({ ...slot })) } }
  }
  if (action.type === 'add') {
    return editPreset(state, action.presetId, (preset) => {
      if (preset.slots.some((slot) => slot.id === action.id) || preset.slots.length >= combatRules.maxParty) {
        return null
      }
      const candidate = state.roster.find((hero) => hero.id === action.id)
      if (!candidate || isChild(candidate)) {
        return null
      }
      // Melee fighters take the front row and everyone else the back, while there is room.
      const hero = state.roster.find((entry) => entry.id === action.id)
      const front = preset.slots.filter((slot) => slot.row === 'front').length
      const back = preset.slots.length - front
      const wantsFront = hero ? classById(hero.classId).reach === 'melee' : true
      const row: Row = wantsFront ? (front < combatRules.frontRowSize ? 'front' : 'back') : back < combatRules.backRowSize ? 'back' : 'front'
      return { ...preset, slots: [...preset.slots, { id: action.id, row }] }
    })
  }
  if (action.type === 'row') {
    return editPreset(state, action.presetId, (preset) => {
      const nextFront = preset.slots.filter((slot) => slot.id !== action.id && slot.row === 'front').length + (action.row === 'front' ? 1 : 0)
      const nextBack = preset.slots.length - nextFront
      if (nextFront > combatRules.frontRowSize || nextBack > combatRules.backRowSize) {
        return null
      }
      return { ...preset, slots: preset.slots.map((slot) => (slot.id === action.id ? { ...slot, row: action.row } : slot)) }
    })
  }
  if (action.type === 'remove') {
    return editPreset(state, action.presetId, (preset) => ({ ...preset, slots: preset.slots.filter((slot) => slot.id !== action.id) }))
  }
  if (action.type === 'preset') {
    return presetById(state, action.id) ? { ...state, notice: null, presetId: action.id } : state
  }
  if (action.type === 'dungeon') {
    return { ...state, notice: null, dungeonId: action.id }
  }
  if (action.type === 'tactics') {
    return editPreset(state, action.presetId, (preset) => ({ ...preset, tactics: { ...action.tactics } }))
  }
  if (action.type === 'dismissAbsence') {
    return { ...state, absence: null }
  }
  if (action.type === 'catchUp') {
    return advance(state, action.now)
  }
  if (action.type === 'debugGold') {
    return { ...state, notice: null, gold: state.gold + progression.debugGold }
  }
  if (action.type === 'refreshVisitors') {
    const visitorNonce = state.seedLocked ? state.visitorNonce : state.visitorNonce + 1
    const now = state.lastTickAt
    const visitors = generateVisitors(
      state.seed + visitorNonce * progression.visitorNonceStride,
      visitorCap(state.buildings.inn),
      townLevel(state.fame).visitorPotential + retireeBonus(state, 'inn'),
      femaleChance(state),
      neededClasses(state, []),
    ).map((hero) => ({ ...hero, arrivedAt: now }))
    return {
      ...state,
      notice: null,
      visitorNonce,
      visitors,
      nextVisitorAt: now + villageRules.inn.arriveEveryMs,
    }
  }
  if (action.type === 'lockSeed') {
    return { ...state, notice: null, seedLocked: action.locked }
  }
  if (action.type === 'setSeed') {
    return { ...state, notice: null, seed: action.seed }
  }
  if (action.type === 'retire') {
    return retireHero(state, action.id)
  }
  if (action.type === 'assignRetiree') {
    return assignRetiree(state, action.id, action.building)
  }
  if (action.type === 'claimGuide') {
    return claimGuide(state)
  }
  if (action.type === 'wish') {
    return makeWish(state, action.now)
  }
  if (action.type === 'enchant') {
    return state.magic ? enqueue(state, 'magic', action.trinketId) : startEnchant(state, action.trinketId, action.now)
  }
  if (action.type === 'brew') {
    return state.alchemy ? enqueue(state, 'alchemy', action.potionId) : startBrew(state, action.potionId, action.now)
  }
  if (action.type === 'supplies') {
    const count = Math.max(0, Math.floor(action.count))
    return editPreset(state, action.presetId, (preset) => ({ ...preset, supplies: { ...(preset.supplies ?? {}), [action.potionId]: count } }))
  }
  if ((action.type === 'scout' || action.type === 'buyIntel') && !dungeonUnlocked(state, nestRules.dungeonId)) {
    return { ...state, notice: 'lockedDungeon' }
  }
  if (action.type === 'scout') {
    return startScout(state, action.heroId, action.now, busyHeroIds(state))
  }
  if (action.type === 'buyIntel') {
    return buyIntel(state)
  }
  if (action.type === 'enroll') {
    return enroll(state, action.heroId, action.focus, action.career)
  }
  if (action.type === 'unenroll') {
    return unenroll(state, action.heroId)
  }
  if (action.type === 'interview') {
    return interview(state, action.id)
  }
  if (action.type === 'dequeue') {
    return dequeue(state, action.building, action.index)
  }
  if (action.type === 'automation') {
    return { ...state, notice: null, automation: { ...state.automation, ...(action.care != null ? { care: action.care } : {}), ...(action.drill != null ? { drill: action.drill } : {}) } }
  }
  if (action.type === 'potionTarget') {
    return { ...state, notice: null, automation: { ...state.automation, potions: { ...state.automation.potions, [action.potionId]: Math.max(0, Math.floor(action.count)) } } }
  }
  if (action.type === 'festival') {
    return holdFestival(state)
  }
  if (action.type === 'deliver') {
    return deliver(state, action.contractId)
  }
  if (action.type === 'drill') {
    return startDrill(state, action.heroId, action.now, busyHeroIds(state))
  }
  if (action.type === 'forget') {
    return forgetSkill(state, action.heroId, action.skillId)
  }
  if (action.type === 'seenAdults') {
    return { ...state, comingOfAge: [] }
  }
  if (action.type === 'acceptProposal') {
    return acceptProposal(state, action.a, action.b, action.now ?? state.lastTickAt)
  }
  if (action.type === 'declineProposal') {
    return declineProposal(state, action.a, action.b, action.now ?? state.lastTickAt)
  }
  if (action.type === 'adReward') {
    return grantAdReward(state, action.placement, action.now)
  }
  return freshState(state.seed, action.now)
}

function advance(state: GameState, now: number): GameState {
  const rawElapsed = Math.max(0, now - state.lastTickAt)
  if (rawElapsed === 0) {
    return state
  }
  const capped = rawElapsed > timeRules.maxOfflineMs
  const elapsed = Math.min(rawElapsed, timeRules.maxOfflineMs)
  const effectiveNow = state.lastTickAt + elapsed
  const completed: string[] = []
  const crafted: string[] = []
  const visitors: string[] = []
  const wages = { paid: 0 }
  const aged: { name: string; age: number }[] = []
  const family: FamilyEvents = { births: [], proposals: 0, deaths: [] }
  const returned: AbsenceReport['returned'] = []
  // Time moves in pieces that end on each season turn, so everything due
  // before a turn (returns, births) is settled before the season's family
  // rolls, and those rolls happen at the turn itself.
  const autoTally = { runs: 0, gold: 0 }
  let next = state
  while (next.lastTickAt < effectiveNow) {
    const turnAt = next.lastTickAt + (timeRules.seasonMs - next.calendar.intoSeasonMs)
    // A finished building also ends a piece, so work before it runs at the
    // old level and work after it at the new one (review a6be730).
    const builtAt = next.construction && next.construction.finishAt > next.lastTickAt ? next.construction.finishAt : Infinity
    // Always move forward, even if a broken save has the season overrun.
    const until = Math.min(Math.max(Math.min(turnAt, builtAt), next.lastTickAt + 1), effectiveNow)
    const piece = until - next.lastTickAt
    const from = next.lastTickAt
    const before = next.calendar
    // Everything due within the piece settles first, in the old year, so a
    // party home just before a year turns is buried with that year's age.
    // Each workshop finishes job after job, starting the next in its queue (Docs/automation.md).
    next = runWorkshop(next, 'smith', from, until, crafted)
    next = runWorkshop(next, 'alchemy', from, until, crafted)
    next = runWorkshop(next, 'magic', from, until, crafted)
    // Training picks from heroes free at the start of the piece; scouts and
    // parties still out come back below (review a6be730).
    next = runDrills(next, from, until, busyHeroIds, drillReserved)
    next = finishScout(next, until, until === turnAt)
    // The wounded at home start treatment when the piece starts (review a6be730).
    next = autoCare(next, from)
    next = finishCare(next, until)
    next = recoverRoster(next, piece, until)
    next = updateVisitors(next, until, visitors)
    const out = next.expeditions
    next = returnExpeditions(next, until, returned)
    // The wounded who come home start treatment as they arrive.
    for (const trip of out.filter((entry) => !next.expeditions.some((still) => still.id === entry.id))) {
      next = autoCare(next, trip.returnAt, new Set(trip.heroIds))
    }
    next = finishCare(next, until)
    next = finishConstruction(next, until, completed)
    // Auto runs settle within their season, against that season's board (review 1208be3).
    next = ensureBoard(next)
    next = runAuto(next, piece, autoTally)
    // Then the season (and maybe the year) turns at the end of the piece.
    next = moveCalendar(next, piece, wages, aged)
    next = deliverBirths(next, until, family)
    for (let turned = seasonsBetween(before, next.calendar); turned > 0; turned -= 1) {
      next = turnSeason(next, until, family)
      // A season of lessons at the school (Docs/school.md).
      next = teachSeason(next)
    }
    // The old may pass away when a year turns, after everyone has aged.
    for (let years = next.calendar.year - before.year; years > 0; years -= 1) {
      next = passAway(next, family)
    }
    // Widow and unbond at the moment someone left, not when the catch-up ends.
    next = tidyFamily({ ...next, lastTickAt: until }, until)
    // The fountain fills offline too, up to its cap, at the level it had.
    next = { ...next, fountain: chargeFountain(next.fountain, next.buildings.fountain, until) }
  }
  // A new season (or a new guild) puts up a fresh contract board.
  next = ensureBoard(next)
  next = { ...next, lastTickAt: effectiveNow }
  if (rawElapsed < timeRules.reportAfterMs) {
    return next
  }
  const absence: AbsenceReport = {
    elapsedMs: elapsed,
    capped,
    seasonsPassed: seasonsBetween(state.calendar, next.calendar),
    year: next.calendar.year,
    season: next.calendar.season,
    // Income is the net change with wages added back, so it counts every
    // source (auto runs, guild quest) without listing them.
    goldGained: next.gold - state.gold + wages.paid,
    wagesPaid: wages.paid,
    injuries: [],
    completed,
    crafted,
    visitors,
    autoRuns: autoTally.runs,
    autoGold: autoTally.gold,
    adClaimed: false,
    aged,
    returned,
    births: family.births,
    proposals: family.proposals,
    deaths: family.deaths,
  }
  return { ...next, absence }
}

export function townLevel(fame: number) {
  let current = villageRules.levels[0]
  for (const level of villageRules.levels) {
    if (fame >= level.fame) {
      current = level
    }
  }
  if (!current) {
    throw new Error('Village levels are missing')
  }
  return current
}

export function visitorCap(innLevel: number): number {
  return villageRules.inn.visitorsByLevel[innLevel] ?? 0
}

export function bedCount(houseLevel: number): number {
  return houseLevel * villageRules.house.bedsPerLevel
}

export function expeditionSlots(level: number): number {
  return expeditionSlotsFor(level)
}

export function restBonus(houseLevel: number): number {
  return Math.max(0, houseLevel - 1) * villageRules.house.restBonusPerLevel
}

export function localDateKey(now: number): string {
  const date = new Date(now)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function emptyAds(now: number): AdUses {
  return { date: localDateKey(now), counts: { absence: 0, construction: 0, temple: 0 } }
}

export function adsRemaining(state: GameState, placement: AdPlacement, now: number): number {
  const used = state.ads.date === localDateKey(now) ? state.ads.counts[placement] : 0
  return Math.max(0, adRules[placement].daily - used)
}

function readAds(value: unknown, now: number): AdUses {
  if (value == null || typeof value !== 'object') {
    return emptyAds(now)
  }
  const record = value as Partial<AdUses>
  const counts = record.counts
  if (typeof record.date !== 'string' || counts == null) {
    return emptyAds(now)
  }
  return {
    date: record.date,
    counts: {
      absence: numberOr(counts.absence, 0),
      construction: numberOr(counts.construction, 0),
      temple: numberOr(counts.temple, 0),
    },
  }
}

function grantAdReward(state: GameState, placement: AdPlacement, now: number): GameState {
  const dated = state.ads.date === localDateKey(now) ? state : { ...state, ads: emptyAds(now) }
  if (dated.ads.counts[placement] >= adRules[placement].daily) {
    return { ...dated, notice: 'adLimit' }
  }
  const rewarded = applyAdReward(dated, placement, now)
  if (rewarded.notice) {
    return rewarded
  }
  return {
    ...rewarded,
    ads: {
      ...rewarded.ads,
      counts: { ...rewarded.ads.counts, [placement]: rewarded.ads.counts[placement] + 1 },
    },
  }
}

function applyAdReward(state: GameState, placement: AdPlacement, now: number): GameState {
  if (placement === 'absence') {
    if (!state.absence) {
      return { ...state, notice: 'missing' }
    }
    if (state.absence.adClaimed) {
      return { ...state, notice: 'adUsed' }
    }
    return {
      ...state,
      notice: null,
      gold: state.gold + state.absence.goldGained,
      absence: { ...state.absence, adClaimed: true },
    }
  }
  if (placement === 'construction') {
    if (!state.construction || state.construction.finishAt <= now) {
      return { ...state, notice: 'missing' }
    }
    const remaining = state.construction.finishAt - now
    const cut = Math.round(Math.max(remaining * adRules.construction.shortenRatio, adRules.construction.shortenMinMs))
    const finishAt = Math.max(now, state.construction.finishAt - cut)
    const shortened = { ...state, notice: null, construction: { ...state.construction, finishAt } }
    return finishAt <= now ? finishConstruction(shortened, now, []) : shortened
  }
  const hero = state.roster
    .filter((entry) => entry.treatAt != null && entry.treatAt > now)
    .sort((left, right) => (left.treatAt ?? 0) - (right.treatAt ?? 0))[0]
  if (!hero) {
    return { ...state, notice: 'treat' }
  }
  return {
    ...state,
    notice: null,
    roster: state.roster.map((entry) => (entry.id === hero.id ? completeTreatment(entry) : entry)),
  }
}

function startingBuildings(): Record<BuildingId, number> {
  const levels = {} as Record<BuildingId, number>
  for (const building of villageRules.buildings) {
    levels[building.id as BuildingId] = building.startLevel
  }
  return levels
}

export function visitorStay(innLevel: number): number {
  return villageRules.inn.stayMs + Math.max(0, innLevel - 1) * villageRules.inn.stayPerLevelMs
}

function innLevel(record: Record<string, unknown>, base: GameState): number {
  const buildings = record.buildings
  if (buildings != null && typeof buildings === 'object' && typeof (buildings as { inn?: unknown }).inn === 'number') {
    return (buildings as { inn: number }).inn
  }
  return base.buildings.inn
}

function openStays(visitors: Hero[], now: number, stay: number): Hero[] {
  const expired = visitors.some((hero) => hero.arrivedAt == null || hero.arrivedAt + stay <= now)
  if (!expired) {
    return visitors
  }
  const step = Math.floor(stay / Math.max(visitors.length, 1))
  let slot = 0
  return visitors.map((hero) => {
    if (hero.arrivedAt != null && hero.arrivedAt + stay > now) {
      return hero
    }
    slot += 1
    return { ...hero, arrivedAt: now - stay + step * slot }
  })
}

function stampVisitors(heroes: Hero[], now: number): Hero[] {
  const stay = visitorStay(1)
  const step = Math.floor(stay / Math.max(heroes.length, 1))
  return heroes.map((hero, index) => ({ ...hero, arrivedAt: now - stay + step * (index + 1) }))
}

function seasonsBetween(from: Calendar, to: Calendar): number {
  return to.year * timeRules.seasons.length + seasonIndex(to.season) - (from.year * timeRules.seasons.length + seasonIndex(from.season))
}

function seasonIndex(season: SeasonId): number {
  const index = timeRules.seasons.indexOf(season)
  return index < 0 ? 0 : index
}

function moveCalendar(state: GameState, elapsed: number, wages: { paid: number }, aged: { name: string; age: number }[]): GameState {
  let intoSeasonMs = state.calendar.intoSeasonMs + elapsed
  let index = seasonIndex(state.calendar.season)
  let year = state.calendar.year
  let gold = state.gold
  let warning = state.warning
  let years = 0
  while (intoSeasonMs >= timeRules.seasonMs) {
    intoSeasonMs -= timeRules.seasonMs
    index = (index + 1) % timeRules.seasons.length
    if (index === 0) {
      year += 1
      years += 1
    }
    // Children under the adult age live free.
    const due = progression.wage * wageCount(state)
    const paid = Math.min(gold, due)
    gold -= paid
    wages.paid += paid
    warning = paid < due ? 'wages' : null
  }
  const lived = years > 0 ? growOlder(state, years, aged) : state
  return {
    ...lived,
    gold,
    warning,
    calendar: { year, season: (timeRules.seasons[index] ?? 'spring') as SeasonId, intoSeasonMs },
  }
}

function growOlder(state: GameState, years: number, aged: { name: string; age: number }[]): GameState {
  let roster = state.roster.map((hero) => older(hero, years, aged))
  // A child who reaches deploy age joins the hero lists with a welcome.
  const grownUp = roster.filter((hero, index) => isChild(state.roster[index]!) && !isChild(hero)).map((hero) => hero.id)
  // Pupils come of age and leave school, maybe for the career they chose (Docs/school.md).
  roster = roster.map((hero) => (grownUp.includes(hero.id) ? graduate(hero) : hero))
  const proud = roster.filter((hero) => grownUp.includes(hero.id)).flatMap((hero) => hero.parents ?? [])
  return {
    ...state,
    comingOfAge: [...(state.comingOfAge ?? []), ...grownUp],
    roster: cheer(roster, proud, moraleRules.joy.comingOfAge),
    visitors: state.visitors.map((hero) => older(hero, years, aged)),
    retirees: state.retirees.map((retiree) => ({ ...retiree, hero: older(retiree.hero, years, aged) })),
  }
}

function older(hero: Hero, years: number, aged: { name: string; age: number }[]): Hero {
  let next = hero
  for (let year = 0; year < years; year += 1) {
    next = withAge(next, nextAge(next.age))
  }
  if (next.age !== hero.age) {
    aged.push({ name: next.name, age: next.age })
  }
  return next
}

function finishConstruction(state: GameState, now: number, completed: string[]): GameState {
  if (!state.construction || state.construction.finishAt > now) {
    return state
  }
  const id = state.construction.id
  completed.push(id)
  // The fountain fills at its old level until the upgrade is done (Docs/fountain.md 2).
  const fountain = id === 'fountain' ? upgradeFountain(state.fountain, state.buildings.fountain, state.buildings.fountain + 1, state.construction.finishAt) : state.fountain
  return {
    ...state,
    fountain,
    construction: null,
    fame: state.fame + villageRules.buildingFame,
    buildings: { ...state.buildings, [id]: state.buildings[id] + 1 },
  }
}

function updateVisitors(state: GameState, now: number, arrived: string[]): GameState {
  const stay = visitorStay(state.buildings.inn)
  const visitors = state.visitors.flatMap((hero) => {
    const arrivedAt = hero.arrivedAt ?? state.lastTickAt
    if (arrivedAt + stay <= now) {
      return []
    }
    return [{ ...hero, arrivedAt }]
  })
  let nextVisitorAt = state.nextVisitorAt
  let nonce = state.visitorNonce
  const cap = visitorCap(state.buildings.inn)
  const bonus = townLevel(state.fame).visitorPotential + retireeBonus(state, 'inn')
  if (visitors.length < state.visitors.length && visitors.length < cap) {
    nextVisitorAt = Math.min(nextVisitorAt, now)
  }
  if (visitors.length < cap && nextVisitorAt > now + villageRules.inn.arriveEveryMs) {
    nextVisitorAt = now
  }
  while (visitors.length < cap && nextVisitorAt <= now) {
    nonce += 1
    const drawn = {
      ...generateHero(
        createRng(state.seed + nonce * progression.visitorNonceStride),
        `${state.seed}-v${nonce}`,
        bonus,
        femaleChance(state),
        neededClasses(state, visitors)[0],
      ),
      arrivedAt: now,
    }
    // A separate stream decides prodigies and terms (Docs/scouting.md).
    const hero = { ...arrive(drawn, createRng(state.seed + nonce * progression.visitorNonceStride + 31), townLevel(state.fame).level), arrivedAt: now }
    visitors.push(hero)
    arrived.push(hero.name)
    nextVisitorAt += villageRules.inn.arriveEveryMs
  }
  if (visitors.length >= cap && nextVisitorAt <= now) {
    nextVisitorAt = now + villageRules.inn.arriveEveryMs
  }
  return { ...state, visitors, visitorNonce: nonce, nextVisitorAt }
}

// Roles the village has nobody for, among living heroes at home or at the inn,
// as the class the inn sends to fill each one.
function neededClasses(state: GameState, visitors: Hero[]): ClassId[] {
  const present = [...state.roster.filter((hero) => hero.condition !== 'dead'), ...visitors]
  return (progression.neededRoles as Role[])
    .filter((role) => !present.some((hero) => classById(hero.classId).role === role))
    .flatMap((role) => classList.find((klass) => klass.role === role && !klass.femaleOnly)?.id ?? [])
}

function startBuild(state: GameState, id: BuildingId, now: number): GameState {
  if (state.construction) {
    return { ...state, notice: 'building' }
  }
  const def = villageRules.buildings.find((building) => building.id === id)
  if (!def) {
    return { ...state, notice: 'missing' }
  }
  // A bigger guild needs a record of finished contracts (Docs/guild.md).
  if (id === 'guild' && (state.guild?.record ?? 0) < guildLevel(state.buildings.guild + 1).record) {
    return { ...state, notice: 'guildRecord' }
  }
  if (townLevel(state.fame).level < def.unlockLevel) {
    return { ...state, notice: 'locked' }
  }
  const current = state.buildings[id]
  const cost = def.levels.find((level) => level.level === current + 1)
  if (!cost || current >= townLevel(state.fame).maxBuildingLevel) {
    return { ...state, notice: 'maxLevel' }
  }
  if (
    state.gold < cost.gold ||
    state.materials.wood < cost.wood ||
    state.materials.stone < cost.stone ||
    state.materials.iron < cost.iron
  ) {
    return { ...state, notice: 'resources' }
  }
  return {
    ...state,
    notice: null,
    gold: state.gold - cost.gold,
    materials: {
      wood: state.materials.wood - cost.wood,
      stone: state.materials.stone - cost.stone,
      iron: state.materials.iron - cost.iron,
      bone: state.materials.bone,
      herb: state.materials.herb,
      crystal: state.materials.crystal,
    },
    construction: { id, finishAt: now + Math.round(cost.ms * (1 - retireeBonus(state, 'hall'))) },
  }
}

function dungeonForMaterial(state: GameState): string | null {
  return (
    state.cleared.find((id) => villageRules.drops[id as keyof typeof villageRules.drops]?.material === state.auto.material) ??
    null
  )
}

function autoMembers(state: GameState, presetId = state.presetId): PartyMember[] {
  // The fixed policy's own party stands in for the selected preset only.
  const slots = state.auto.policy === 'fixed' && presetId === state.presetId ? state.auto.party : (presetById(state, presetId)?.slots ?? [])
  const away = busyHeroIds(state)
  const members = slots.flatMap((slot) => {
    const hero = state.roster.find((entry) => entry.id === slot.id)
    if (!hero || !canDeploy(hero) || away.has(hero.id)) {
      return []
    }
    if (hero.condition === 'critical' || (state.auto.policy === 'safe' && hero.condition === 'injured')) {
      return []
    }
    // Grieving or dispirited heroes stay home from auto runs (Docs/morale.md).
    if (lowMorale(hero)) {
      return []
    }
    return [{ hero, row: slot.row }]
  })
  const front = members.filter((member) => member.row === 'front').length
  if (members.length === 0 || front > combatRules.frontRowSize || members.length - front > combatRules.backRowSize) {
    return []
  }
  return withBonds(state, members)
}

// Friends and lovers fight better side by side.
function withBonds(state: GameState, members: PartyMember[]): PartyMember[] {
  const bonus = partyBonus(state, members.map((member) => member.hero.id))
  return members.map((member) => ((bonus[member.hero.id] ?? 0) > 0 ? { ...member, bonus: bonus[member.hero.id] } : member))
}

function runAuto(state: GameState, elapsed: number, tally: { runs: number; gold: number }): GameState {
  // Auto runs need the guild, which also sets how many parties go (Docs/guild.md).
  const parties = guildLevel(state.buildings.guild).autoParties
  if (!state.auto.enabled || parties < 1) {
    return state.auto.carryMs ? { ...state, auto: { ...state.auto, carryMs: 0 } } : state
  }
  let next = state
  let budget = (state.auto.carryMs ?? 0) + elapsed
  while (budget >= villageRules.auto.runMs && tally.runs < 36 * parties) {
    const dungeonId = next.auto.policy === 'material' ? dungeonForMaterial(next) : next.auto.dungeonId
    if (!dungeonId || !next.cleared.includes(dungeonId)) {
      break
    }
    let ran = 0
    const used = new Set<string>()
    // Whole parties only: a preset that shares a hero with one already out
    // is skipped, and the next one gets the place (review 1208be3).
    for (const presetId of autoPresetOrder(next)) {
      if (ran >= parties) {
        break
      }
      const members = autoMembers(next, presetId)
      if (members.length === 0 || members.some((member) => used.has(member.hero.id))) {
        continue
      }
      for (const member of members) {
        used.add(member.hero.id)
      }
      next = autoRun(next, members, presetId, dungeonId, tally)
      ran += 1
    }
    if (ran === 0) {
      break
    }
    budget -= villageRules.auto.runMs
  }
  // Leftover time waits for the next tick, but never more than one run's worth.
  return { ...next, auto: { ...next.auto, carryMs: Math.min(budget, villageRules.auto.runMs) } }
}

// The selected preset goes first, then the others in order.
function autoPresetOrder(state: GameState): string[] {
  return [state.presetId, ...state.presets.map((preset) => preset.id).filter((id) => id !== state.presetId)]
}

function autoRun(state: GameState, members: PartyMember[], presetId: string, dungeonId: string, tally: { runs: number; gold: number }): GameState {
  let next = state
  const preset = presetById(next, presetId)
  // A lasting run counter keeps every auto battle on its own seed.
  const nonce = (next.auto.nonce ?? 0) + 1
  next = { ...next, auto: { ...next.auto, nonce } }
  const battleSeed = next.seed + 9000 + nonce
  // Auto runs carry the preset's potions too, and bring back the rest.
  const carry = takeSupplies(next.potions, preset?.supplies)
  const result = runDungeon(members, dungeonId, preset?.tactics ?? DEFAULT_TACTICS, battleSeed, carry.taken, nestVariant(next, dungeonId))
  if (!result.ok) {
    return next
  }
  next = { ...next, potions: returnSupplies(carry.stock, carry.taken, result.report.potionsUsed) }
  // Auto runs only repeat cleared dungeons, so they earn a share of the
  // repeat reward and always less than sending the party by hand.
  const scale = villageRules.repeatReward * villageRules.auto.rewardScale * (1 + retireeBonus(next, 'guild'))
  const report = {
    ...result.report,
    conditions: result.report.conditions.map((entry) =>
      entry.condition === 'dead' ? { ...entry, condition: 'critical' as const } : entry,
    ),
  }
  const heroIds = members.map((member) => member.hero.id)
  const settled = settleParty(next, report, battleSeed, next.lastTickAt, heroIds, dungeonId)
  const goldGain = report.victory ? Math.floor(result.report.gold * scale) : 0
  next = dropFromPresets(grantVictoryRewards(bondParty({ ...next, ...settled, gold: next.gold + goldGain }, heroIds, report.victory), report, dungeonId, scale))
  tally.runs += 1
  tally.gold += goldGain
  return next
}

function grantVictoryRewards(state: GameState, report: DungeonReport, dungeonId: string, scale?: number): GameState {
  if (!report.victory) {
    return state
  }
  const drop = villageRules.drops[dungeonId as keyof typeof villageRules.drops]
  if (!drop) {
    return state
  }
  const first = !state.cleared.includes(dungeonId)
  const applied = scale ?? (first ? 1 : villageRules.repeatReward)
  const gained = Math.max(1, Math.floor(drop.amount * applied))
  const material = drop.material as MaterialName
  const materials = { ...state.materials, [material]: state.materials[material] + gained }
  // Some dungeons also leave a little of a second material.
  for (const extra of ['iron', 'herb', 'crystal'] as const) {
    const amount = (drop as Record<string, unknown>)[extra]
    if (typeof amount === 'number' && material !== extra) {
      materials[extra] += Math.max(1, Math.floor(amount * applied))
    }
  }
  let fame = state.fame
  const cleared = state.cleared.includes(dungeonId) ? state.cleared : [...state.cleared, dungeonId]
  if (first) {
    fame += drop.fame
  }
  const party = (report.party ?? []).map((member) => member.id)
  // Pride (up to the everyday cap), then joy on top for a village first (review b9036a0).
  let roster = cheer(state.roster, party, moraleRules.pride.victory, moraleRules.pride.victoryCap)
  if (first) {
    roster = cheer(roster, party, moraleRules.joy.firstClear)
  }
  // The old one-off cave quest gave way to the contract board (Docs/guild.md).
  return progressClear({ ...state, roster, materials, fame, cleared }, dungeonId)
}

function scheduleVisitor(state: GameState, now: number): GameState {
  if (state.visitors.length >= visitorCap(state.buildings.inn)) {
    return state
  }
  const soon = now + villageRules.inn.arriveEveryMs
  if (state.nextVisitorAt <= soon) {
    return state
  }
  return { ...state, nextVisitorAt: soon }
}

function finishCare(state: GameState, now: number): GameState {
  const roster = state.roster.map((hero) => {
    let next = hero
    if (next.resurrectAt != null && next.resurrectAt <= now) {
      next = { ...next, resurrectAt: undefined, condition: 'injured', recoverAt: now + lifeRules.injury.recoverMs }
    }
    if (next.treatAt != null && next.treatAt <= now) {
      next = completeTreatment(next)
    }
    return next
  })
  return { ...state, roster }
}

function completeTreatment(hero: Hero): Hero {
  const condition = hero.condition === 'injured' || hero.condition === 'critical' ? 'fatigued' : hero.condition
  return { ...hero, condition, treatAt: undefined, recoverAt: undefined }
}

function needsWarning(hero: Hero): boolean {
  // Fatigue only weakens a hero; it never stops a departure (Docs/fatigue.md).
  return hero.condition === 'injured' || hero.condition === 'critical'
}

function stepCondition(hero: Hero, now: number): Hero {
  if (hero.condition === 'critical') {
    return { ...hero, condition: 'injured', recoverAt: now + lifeRules.injury.recoverMs }
  }
  if (hero.condition === 'injured') {
    return { ...hero, condition: 'fatigued', recoverAt: undefined }
  }
  return { ...hero, recoverAt: undefined }
}

function fatigueRecoveryRate(state: GameState): number {
  return (
    (lifeRules.fatigue.recoverPerHour + lifeRules.fatigue.recoverPerHouseLevel * Math.max(0, state.buildings.house - 1)) *
    (1 + retireeBonus(state, 'house'))
  )
}

function recoverRoster(state: GameState, elapsed: number, now: number): GameState {
  const hours = elapsed / 3_600_000
  const rate = fatigueRecoveryRate(state)
  const awayUntil = new Map(state.expeditions.flatMap((trip) => trip.heroIds.map((id) => [id, Math.min(now, trip.returnAt)] as const)))
  return {
    ...state,
    roster: state.roster.map((hero) => {
      const until = awayUntil.get(hero.id)
      // Morale drifts back toward its base wherever the hero is (Docs/morale.md).
      hero = driftMorale(hero, hours)
      if (until == null) {
        return recoverHero(hero, hours, rate, now)
      }
      // Away heroes still shake off fatigue on the road (Docs/fatigue.md), but
      // an existing wound's recovery clock pauses for the part spent away.
      const awayHours = Math.max(0, until - state.lastTickAt) / 3_600_000
      const rested = { ...hero, fatigue: Math.max(0, hero.fatigue - rate * awayHours) }
      return hero.recoverAt == null ? rested : { ...rested, recoverAt: hero.recoverAt + Math.max(0, until - state.lastTickAt) }
    }),
  }
}

function recoverHero(hero: Hero, hours: number, rate: number, now: number): Hero {
  let next = hero
  let fatigueWhenTired = hero.fatigue
  while ((next.condition === 'critical' || next.condition === 'injured') && next.recoverAt != null && next.recoverAt <= now) {
    const deadline = next.recoverAt
    next = stepCondition(next, deadline)
    if (next.condition === 'fatigued') {
      const hoursUntilTired = Math.max(0, hours - (now - deadline) / 3_600_000)
      fatigueWhenTired = hero.fatigue - rate * hoursUntilTired
    }
  }
  if (next.condition === 'dead') {
    return next
  }
  const fatigue = Math.max(0, next.fatigue - rate * hours)
  if (next.condition === 'fatigued' && fatigueWhenTired > 0 && fatigue === 0) {
    return { ...next, fatigue, condition: 'healthy', recoverAt: undefined }
  }
  return { ...next, fatigue }
}

function stampRecovery(before: Hero, after: Hero, now: number): Hero {
  const rank = { healthy: 0, fatigued: 1, injured: 2, critical: 3, dead: 4 }
  const hurt = after.condition === 'injured' || after.condition === 'critical'
  if (hurt && (rank[after.condition] > rank[before.condition] || after.recoverAt == null)) {
    return { ...after, recoverAt: now + lifeRules.injury.recoverMs }
  }
  if (!hurt) {
    return { ...after, recoverAt: undefined }
  }
  return after
}

export function applyCasualty(
  hero: Hero,
  report: DungeonReport,
  dungeonId: string,
  alliesLived: boolean,
  rng: Rng,
  year?: number,
): { hero: Hero | null; grave: Grave | null } {
  let next = applyReport(hero, report)
  if (report.victory && !next.clears.includes(dungeonId)) {
    next = { ...next, clears: [...next.clears, dungeonId] }
  }
  const blow = report.conditions.find((entry) => entry.id === hero.id)
  if (blow?.condition !== 'dead') {
    return { hero: next, grave: null }
  }
  const chance = alliesLived ? lifeRules.lossWithAllies : lifeRules.lossAlone
  next = { ...next, gear: next.gear.filter(() => rng.next() >= chance) }
  if (next.deaths >= 1) {
    return { hero: null, grave: graveFor(next, 'battle', year) }
  }
  return { hero: { ...next, deaths: 1, condition: 'dead' }, grave: null }
}

function settleParty(
  state: GameState,
  report: DungeonReport,
  seed: number,
  now: number,
  heroIds: string[],
  dungeonId: string,
): Pick<GameState, 'roster' | 'graveyard'> {
  const rng = createRng(seed + 17)
  const partyIds = new Set(heroIds)
  const alliesLived = report.conditions.filter((entry) => entry.condition !== 'dead').length > 0
  const roster: Hero[] = []
  const graveyard = [...state.graveyard]
  for (const hero of state.roster) {
    if (!partyIds.has(hero.id)) {
      roster.push(hero)
      continue
    }
    const outcome = applyCasualty(hero, report, dungeonId, alliesLived, rng, state.calendar.year)
    if (outcome.hero) {
      roster.push(stampRecovery(hero, outcome.hero, now))
    }
    if (outcome.grave) {
      graveyard.push(outcome.grave)
    }
  }
  // Grief lands when the party comes home with the news; several losses on
  // one trip count as the deepest one (Docs/morale.md, review b9036a0).
  const lost = graveyard.slice(state.graveyard.length)
  return { roster: lost.length ? mourn(roster, lost, state.bonds) : roster, graveyard }
}

// ---------- retirement ----------

// The bonus a building gets from the retiree running it, or 0.
export function retireeBonus(state: GameState, building: BuildingId): number {
  if (!(state.retirees ?? []).some((retiree) => retiree.building === building)) {
    return 0
  }
  return retirementRules.bonus[building]
}

export function retirementAdvised(hero: Hero): boolean {
  return hero.age >= retirementRules.adviseAge
}

function retireHero(state: GameState, id: string): GameState {
  const hero = state.roster.find((entry) => entry.id === id)
  if (!hero) {
    return { ...state, notice: 'missing' }
  }
  if (busyHeroIds(state).has(id)) {
    return { ...state, notice: 'busyHero' }
  }
  if (hero.age < retirementRules.minAge) {
    return { ...state, notice: 'tooYoung' }
  }
  const retiree: Retiree = {
    hero: { ...hero, treatAt: undefined, resurrectAt: undefined },
    retiredYear: state.calendar.year,
    building: null,
  }
  return dropFromPresets({
    ...state,
    notice: null,
    roster: state.roster.filter((entry) => entry.id !== id),
    retirees: [...state.retirees, retiree],
  })
}

// One retiree per building; null takes them off their post.
function assignRetiree(state: GameState, id: string, building: BuildingId | null): GameState {
  if (!state.retirees.some((retiree) => retiree.hero.id === id)) {
    return { ...state, notice: 'missing' }
  }
  if (building && state.retirees.some((retiree) => retiree.building === building && retiree.hero.id !== id)) {
    return { ...state, notice: 'postTaken' }
  }
  return {
    ...state,
    notice: null,
    retirees: state.retirees.map((retiree) => (retiree.hero.id === id ? { ...retiree, building } : retiree)),
  }
}

// ---------- party presets and expeditions ----------

function makePresets(): PartyPreset[] {
  return Array.from({ length: expeditionRules.presets }, (_, index) => ({ id: `p${index + 1}`, slots: [], tactics: { ...DEFAULT_TACTICS } }))
}

export function presetById(state: GameState, id: string): PartyPreset | undefined {
  return state.presets.find((preset) => preset.id === id)
}

// Heroes out of town on an expedition.
// This season's lineup and affixes when the dungeon is the nest.
export function nestVariant(state: GameState, dungeonId: string) {
  if (!isNest(dungeonId)) {
    return {}
  }
  const season = nestSeason(state.seed, state.calendar)
  return { floors: season.floors, affixes: season.affixes }
}

export function busyHeroIds(state: GameState): Set<string> {
  const away = new Set(state.expeditions.flatMap((expedition) => expedition.heroIds))
  // A scouting rogue is out too (Docs/depth.md 3d).
  if (state.scout) {
    away.add(state.scout.heroId)
  }
  // Heroes in training are busy too (Docs/skills.md).
  for (const drill of state.drills ?? []) {
    away.add(drill.heroId)
  }
  return away
}

// Tier 1 is open from the start; each later tier opens once any dungeon of
// the tier below has been cleared.
export function dungeonUnlocked(state: GameState, id: string): boolean {
  const dungeon = dungeons.find((entry) => entry.id === id)
  if (!dungeon) {
    return false
  }
  if (dungeon.tier <= 1) {
    return true
  }
  const previous = dungeons.filter((entry) => entry.tier === dungeon.tier - 1)
  // From tier 4 on, every dungeon of the tier before must be cleared (Docs/depth.md).
  if (dungeon.tier >= 4) {
    return previous.every((entry) => state.cleared.includes(entry.id))
  }
  return previous.some((entry) => state.cleared.includes(entry.id))
}

function editPreset(state: GameState, id: string | undefined, change: (preset: PartyPreset) => PartyPreset | null): GameState {
  const target = id ?? state.presetId
  const preset = presetById(state, target)
  const next = preset ? change(preset) : null
  if (!next) {
    return state
  }
  return { ...state, notice: null, presets: state.presets.map((entry) => (entry.id === target ? next : entry)) }
}

// Removes heroes who left the roster (dismissed, buried) from every preset.
function dropFromPresets(state: GameState): GameState {
  const ids = new Set(state.roster.map((hero) => hero.id))
  const keep = (slots: PartySlot[]) => slots.filter((slot) => ids.has(slot.id))
  return {
    ...state,
    presets: state.presets.map((preset) => ({ ...preset, slots: keep(preset.slots) })),
    auto: { ...state.auto, party: keep(state.auto.party) },
  }
}

function startExpedition(state: GameState, presetId: string, confirm: boolean, now: number): GameState {
  const preset = presetById(state, presetId)
  if (!preset) {
    return { ...state, notice: 'missing' }
  }
  if (!dungeonUnlocked(state, state.dungeonId)) {
    return { ...state, notice: 'lockedDungeon' }
  }
  const away = busyHeroIds(state)
  if (preset.slots.some((slot) => away.has(slot.id))) {
    return { ...state, notice: 'busyHero' }
  }
  if (state.expeditions.length >= expeditionSlots(state.buildings.guild)) {
    return { ...state, notice: 'slotsFull' }
  }
  // Heroes who cannot go (dead, too young) stay home; the rest of the party still leaves.
  const party = withBonds(
    state,
    preset.slots.flatMap((slot) => {
      const hero = state.roster.find((entry) => entry.id === slot.id)
      return hero && canDeploy(hero) ? [{ hero, row: slot.row }] : []
    }),
  )
  const dungeon = dungeonById(state.dungeonId)
  const worn = party.some((member) => needsWarning(member.hero))
  const marked = party.some((member) => member.hero.deaths >= 1)
  if (!confirm && (worn || (marked && dungeon.tier >= lifeRules.dangerousTier))) {
    return { ...state, notice: worn ? 'wornParty' : 'seenDeath' }
  }
  // The first expedition of a day keeps the old seed so earlier results replay.
  const battleSeed = state.seedLocked ? state.seed : state.seed + state.day + state.expeditionNonce * 7919
  const carry = takeSupplies(state.potions, preset.supplies)
  const result = runDungeon(party, state.dungeonId, preset.tactics, battleSeed, carry.taken, nestVariant(state, state.dungeonId))
  if (!result.ok) {
    return { ...state, notice: result.error }
  }
  const battleAt = now + expeditionRules.travelMs
  const battleEndAt = battleAt + result.report.ticks * expeditionRules.msPerTick
  const expedition: Expedition = {
    id: `e${state.expeditionNonce + 1}`,
    presetId,
    dungeonId: state.dungeonId,
    heroIds: party.map((member) => member.hero.id),
    seed: battleSeed,
    report: result.report,
    departAt: now,
    battleAt,
    battleEndAt,
    returnAt: battleEndAt + expeditionRules.travelMs,
    ...(Object.keys(carry.taken).length > 0 ? { supplies: carry.taken } : {}),
    ...(isNest(state.dungeonId) ? { nestKey: seasonKey(state.calendar) } : {}),
  }
  return { ...state, notice: null, potions: carry.stock, expeditionNonce: state.expeditionNonce + 1, expeditions: [...state.expeditions, expedition] }
}

function returnExpeditions(state: GameState, now: number, returned: AbsenceReport['returned']): GameState {
  let next = state
  for (const expedition of [...state.expeditions].sort((a, b) => a.returnAt - b.returnAt)) {
    if (expedition.returnAt <= now) {
      next = settleExpedition(next, expedition)
      const hoursAtHome = Math.max(0, now - Math.max(expedition.returnAt, state.lastTickAt)) / 3_600_000
      const rate = fatigueRecoveryRate(next)
      const returning = new Set(expedition.heroIds)
      next = {
        ...next,
        roster: next.roster.map((hero) => (returning.has(hero.id) ? recoverHero(hero, hoursAtHome, rate, now) : hero)),
      }
      returned.push({ dungeonId: expedition.dungeonId, victory: expedition.report.victory })
      // A party back from the nest has seen this season's affixes (Docs/depth.md 3d).
      if (isNest(expedition.dungeonId) && expedition.nestKey === seasonKey(next.calendar)) {
        next = { ...next, nestSeen: seasonKey(next.calendar) }
      }
    }
  }
  return next
}

// Applies an expedition's result when the party walks back in.
function settleExpedition(state: GameState, expedition: Expedition): GameState {
  const { dungeonId } = expedition
  // Training grounds: a fatal blow in a low-tier dungeon leaves a hero critical, not dead.
  const report =
    dungeonById(dungeonId).tier <= lifeRules.safeTier
      ? { ...expedition.report, conditions: expedition.report.conditions.map((entry) => (entry.condition === 'dead' ? { ...entry, condition: 'critical' as const } : entry)) }
      : expedition.report
  const settled = settleParty(state, report, expedition.seed, expedition.returnAt, expedition.heroIds, dungeonId)
  const repeat = state.cleared.includes(dungeonId)
  const goldGain = repeat ? Math.floor(report.gold * villageRules.repeatReward) : report.gold
  const home: GameState = bondParty(
    {
      ...state,
      ...settled,
      gold: state.gold + goldGain,
      expeditions: state.expeditions.filter((entry) => entry.id !== expedition.id),
      potions: returnSupplies(state.potions, expedition.supplies, report.potionsUsed),
    },
    expedition.heroIds,
    report.victory,
  )
  const next = dropFromPresets(grantVictoryRewards(home, report, dungeonId))
  const materials: Partial<Materials> = {}
  for (const key of ['wood', 'stone', 'iron', 'bone', 'herb', 'crystal'] as const) {
    const diff = next.materials[key] - state.materials[key]
    if (diff > 0) {
      materials[key] = diff
    }
  }
  const record: DungeonReport = {
    ...report,
    dungeonId,
    presetId: expedition.presetId,
    finishedAt: expedition.returnAt,
    gained: { gold: next.gold - state.gold, fame: next.fame - state.fame, materials },
  }
  return { ...next, history: [record, ...next.history].slice(0, expeditionRules.history) }
}

function learnSkill(state: GameState, id: string, skillId: string): GameState {
  const hero = state.roster.find((entry) => entry.id === id)
  if (!hero) {
    return { ...state, notice: 'missing' }
  }
  const known = classById(hero.classId).skills.some((skill) => skill.id === skillId)
  // Picks open by level (Docs/skills.md), whatever points a save carries.
  const open = skillPicks(hero.level) - (hero.learned.length - 1)
  if (!known || hero.learned.includes(skillId) || hero.skillPoints < 1 || open < 1) {
    return { ...state, notice: 'skill' }
  }
  return {
    ...state,
    notice: null,
    roster: state.roster.map((entry) =>
      entry.id === id ? { ...entry, skillPoints: entry.skillPoints - 1, learned: [...entry.learned, skillId] } : entry,
    ),
  }
}

function startTreat(state: GameState, id: string, now: number): GameState {
  if (state.buildings.temple < 1) {
    return { ...state, notice: 'noTemple' }
  }
  const hero = state.roster.find((entry) => entry.id === id)
  if (!hero || (hero.condition !== 'injured' && hero.condition !== 'critical') || hero.treatAt != null) {
    return { ...state, notice: 'treat' }
  }
  return {
    ...state,
    notice: null,
    roster: state.roster.map((entry) => (entry.id === id ? { ...entry, treatAt: now + Math.round(lifeRules.treatMs * (1 - retireeBonus(state, 'temple'))) } : entry)),
  }
}

function startRevive(state: GameState, id: string, now: number): GameState {
  if (state.buildings.temple < 1) {
    return { ...state, notice: 'noTemple' }
  }
  const hero = state.roster.find((entry) => entry.id === id)
  if (!hero || hero.condition !== 'dead' || hero.deaths !== 1 || hero.resurrectAt != null) {
    return { ...state, notice: 'missing' }
  }
  if (state.gold < lifeRules.reviveCost) {
    return { ...state, notice: 'poor' }
  }
  return {
    ...state,
    notice: null,
    gold: state.gold - lifeRules.reviveCost,
    roster: state.roster.map((entry) => (entry.id === id ? { ...entry, resurrectAt: now + Math.round(lifeRules.reviveMs * (1 - retireeBonus(state, 'temple'))) } : entry)),
  }
}

function affordable(state: GameState, cost: { gold: number; wood: number; stone: number; iron: number }): boolean {
  return (
    state.gold >= cost.gold &&
    state.materials.wood >= cost.wood &&
    state.materials.stone >= cost.stone &&
    state.materials.iron >= cost.iron
  )
}

function pay(state: GameState, cost: { gold: number; wood: number; stone: number; iron: number }): GameState {
  return {
    ...state,
    notice: null,
    gold: state.gold - cost.gold,
    materials: {
      wood: state.materials.wood - cost.wood,
      stone: state.materials.stone - cost.stone,
      iron: state.materials.iron - cost.iron,
      bone: state.materials.bone,
      herb: state.materials.herb,
      crystal: state.materials.crystal,
    },
  }
}

function startCraft(state: GameState, recipeId: string, now: number): GameState {
  if (state.buildings.smith < 1) {
    return { ...state, notice: 'noSmith' }
  }
  if (state.smith) {
    return { ...state, notice: 'smithBusy' }
  }
  const recipe = recipeById(recipeId)
  if (!recipe || recipe.smithLevel > 3) {
    return { ...state, notice: 'recipe' }
  }
  if (state.buildings.smith < recipe.smithLevel) {
    return { ...state, notice: 'locked' }
  }
  if (!affordable(state, recipe)) {
    return { ...state, notice: 'resources' }
  }
  return {
    ...pay(state, recipe),
    smith: { kind: 'craft', recipeId, gear: null, finishAt: now + recipe.ms },
  }
}

function startEnhance(state: GameState, gearId: string, now: number): GameState {
  if (state.buildings.smith < 1) {
    return { ...state, notice: 'noSmith' }
  }
  if (state.smith) {
    return { ...state, notice: 'smithBusy' }
  }
  const gear = state.stash.find((item) => item.id === gearId)
  // Trinkets have fixed effects (Docs/depth.md 3b): the smith cannot enhance them.
  if (!gear || gear.slot === 'trinket' || gear.enhance >= smithRules.enhanceMax) {
    return { ...state, notice: 'recipe' }
  }
  if (!affordable(state, smithRules.enhanceCost)) {
    return { ...state, notice: 'resources' }
  }
  return {
    ...pay(state, smithRules.enhanceCost),
    stash: state.stash.filter((item) => item.id !== gearId),
    smith: { kind: 'enhance', recipeId: gear.recipeId, gear, finishAt: now + smithRules.enhanceCost.ms },
  }
}

function finishSmith(state: GameState, now: number, crafted: string[]): GameState {
  if (!state.smith || state.smith.finishAt > now) {
    return state
  }
  const job = state.smith
  const craftNonce = state.craftNonce + 1
  const rng = createRng(state.seed + craftNonce * 100003)
  if (job.kind === 'craft') {
    const recipe = recipeById(job.recipeId)
    if (!recipe) {
      return { ...state, smith: null, craftNonce }
    }
    const rolled = rng.pick(smithRules.options)
    const gear = forgeGear(recipe, `${state.seed}-g${craftNonce}`, rolled === 'guard' ? 'guard' : 'power')
    crafted.push(recipe.id)
    return { ...state, smith: null, craftNonce, stash: [...state.stash, gear] }
  }
  if (!job.gear) {
    return { ...state, smith: null, craftNonce }
  }
  const chance = Math.min(1, (smithRules.successByLevel[state.buildings.smith] ?? 0) + retireeBonus(state, 'smith'))
  const success = rng.next() < chance
  const gear = success ? { ...job.gear, enhance: job.gear.enhance + 1 } : job.gear
  return {
    ...state,
    smith: null,
    craftNonce,
    stash: [...state.stash, gear],
    notice: success ? state.notice : 'enhanceFail',
  }
}

function equipGear(state: GameState, heroId: string, gearId: string): GameState {
  const item = state.stash.find((gear) => gear.id === gearId)
  const hero = state.roster.find((entry) => entry.id === heroId)
  if (!item || !hero) {
    return { ...state, notice: 'missing' }
  }
  // Gear is locked while its hero is away: the trip was simulated with it (review 1f690a1).
  if (busyHeroIds(state).has(heroId)) {
    return { ...state, notice: 'busyHero' }
  }
  const stash = state.stash.filter((gear) => gear.id !== item.id)
  // Weapons and armour swap one for one; trinkets fill two slots, and the
  // oldest comes off when both are taken (Docs/depth.md 3b).
  const same = hero.gear.filter((gear) => gear.slot === item.slot)
  const room = item.slot === 'trinket' ? magicRules.trinketSlots : 1
  const off = same.length >= room ? same.slice(0, same.length - room + 1) : []
  stash.push(...off)
  return {
    ...state,
    notice: null,
    stash,
    roster: state.roster.map((entry) =>
      entry.id === heroId ? { ...entry, gear: [...entry.gear.filter((gear) => !off.includes(gear)), item] } : entry,
    ),
  }
}

function unequipGear(state: GameState, heroId: string, slot: GearSlot, gearId?: string): GameState {
  const hero = state.roster.find((entry) => entry.id === heroId)
  const item = hero?.gear.find((gear) => gear.slot === slot && (gearId === undefined || gear.id === gearId))
  if (!hero || !item) {
    return { ...state, notice: 'missing' }
  }
  if (busyHeroIds(state).has(heroId)) {
    return { ...state, notice: 'busyHero' }
  }
  return {
    ...state,
    notice: null,
    stash: [...state.stash, item],
    roster: state.roster.map((entry) =>
      entry.id === heroId ? { ...entry, gear: entry.gear.filter((gear) => gear !== item) } : entry,
    ),
  }
}

function readMaterials(value: unknown, base: Materials): Materials {
  const record = value != null && typeof value === 'object' ? (value as Partial<Materials>) : {}
  return {
    wood: numberOr(record.wood, base.wood),
    stone: numberOr(record.stone, base.stone),
    iron: numberOr(record.iron, base.iron),
    bone: numberOr(record.bone, 0),
    herb: numberOr(record.herb, 0),
    crystal: numberOr(record.crystal, 0),
  }
}

function isAuto(value: unknown): value is AutoPlan {
  if (value == null || typeof value !== 'object') {
    return false
  }
  const plan = value as AutoPlan
  return typeof plan.enabled === 'boolean' && (plan.policy === 'material' || plan.policy === 'safe' || plan.policy === 'fixed')
}

function isSmith(value: unknown): value is SmithJob {
  if (value == null || typeof value !== 'object') {
    return false
  }
  const job = value as SmithJob
  return (job.kind === 'craft' || job.kind === 'enhance') && typeof job.finishAt === 'number' && typeof job.recipeId === 'string'
}

function fromLegacy(record: Record<string, unknown>, now: number): GameState {
  const base = freshState(numberOr(record.seed, 1), now)
  if (!validHeroes(record.visitors) || !validHeroes(record.roster)) {
    return base
  }
  // Visitors of a version 1 save were already looked over (review 8e1fa30).
  const visitors = Array.isArray(record.visitors) ? (record.visitors as Hero[]).map((hero) => ({ ...hero, interviewed: hero.interviewed || 1 })) : record.visitors
  return normalize({ ...base, ...record, visitors, version: SAVE_VERSION, calendar: base.calendar, lastTickAt: now, absence: null, notice: null }, now)
}

function withRecovery(hero: Hero, now: number): Hero {
  const next = normalizeHero(hero)
  if ((next.condition === 'injured' || next.condition === 'critical') && next.recoverAt == null) {
    return { ...next, recoverAt: now + lifeRules.injury.recoverMs }
  }
  return next
}

function normalize(record: Record<string, unknown>, now: number): GameState {
  const base = freshState(numberOr(record.seed, 1), now)
  const calendar = isCalendar(record.calendar) ? record.calendar : base.calendar
  return {
    ...base,
    ...record,
    version: SAVE_VERSION,
    calendar,
    lastTickAt: numberOr(record.lastTickAt, now),
    visitors: validHeroes(record.visitors)
      ? openStays(record.visitors.map((hero) => withRecovery(knownBefore18(record, hero), now)), now, visitorStay(innLevel(record, base)))
      : base.visitors,
    roster: validHeroes(record.roster) ? record.roster.map((hero) => withRecovery(hero, now)) : [],
    graveyard: Array.isArray(record.graveyard) ? (record.graveyard as Grave[]) : [],
    smith: isSmith(record.smith) ? record.smith : null,
    stash: Array.isArray(record.stash) ? (record.stash as Partial<Gear>[]).map((item) => normalizeGear(item, 'warrior')) : [],
    craftNonce: numberOr(record.craftNonce, 0),
    presets: readPresets(record, base.presets),
    presetId: typeof record.presetId === 'string' ? record.presetId : base.presetId,
    expeditions: Array.isArray(record.expeditions) ? (record.expeditions as Expedition[]) : [],
    expeditionNonce: numberOr(record.expeditionNonce, 0),
    history: Array.isArray(record.history) ? (record.history as DungeonReport[]) : record.report != null ? [record.report as DungeonReport] : [],
    absence: isAbsence(record.absence)
      ? {
          ...record.absence,
          crafted: record.absence.crafted ?? [],
          autoRuns: record.absence.autoRuns ?? 0,
          autoGold: record.absence.autoGold ?? 0,
          adClaimed: record.absence.adClaimed ?? false,
          aged: readAged(record.absence.aged),
          returned: Array.isArray(record.absence.returned) ? record.absence.returned : [],
          births: Array.isArray(record.absence.births) ? record.absence.births : [],
          proposals: numberOr(record.absence.proposals, 0),
          deaths: Array.isArray(record.absence.deaths) ? record.absence.deaths : [],
        }
      : null,
    ads: readAds(record.ads, now),
    guideStep: shiftGuide(record),
    // Buildings that now start built (the temple) are raised on older saves too.
    buildings: raiseToStart(record.buildings, base.buildings),
    retirees: Array.isArray(record.retirees) ? (record.retirees as Retiree[]).map((retiree) => ({ ...retiree, hero: normalizeHero(retiree.hero) })) : [],
    materials: addMaterials(readMaterials(record.materials, base.materials), skippedGuildReward(record)),
    bonds: readBonds(record.bonds),
    proposals: readProposals(record.proposals),
    familyNonce: numberOr(record.familyNonce, 0),
    comingOfAge: Array.isArray(record.comingOfAge) ? (record.comingOfAge as unknown[]).filter((id): id is string => typeof id === 'string') : [],
    fountain: readFountain(record.fountain, numberOr(record.lastTickAt, now)),
    alchemy: readAlchemyJob(record.alchemy),
    potions: readSupplies(record.potions),
    magic: readMagicJob(record.magic),
    nestSeen: typeof record.nestSeen === 'string' ? record.nestSeen : null,
    scout: readScout(record.scout),
    drills: readDrills(record.drills),
    guild: readBoard(record.guild),
    festival: readFestival(record.festival),
    automation: readAutomation(record.automation),
    interviews: readInterviews(record.interviews),
    auto: isAuto(record.auto) ? record.auto : base.auto,
    notice: null,
  }
}

// Saves from before the fountain step was added to the guide: a player past
// the first step moves one further so they keep their place (Docs/fountain.md 4).
function shiftGuide(record: Record<string, unknown>): number {
  let step = numberOr(record.guideStep, 0)
  const wishAt = guideSteps.findIndex((entry) => entry.id === 'wish')
  const version = typeof record.version === 'number' ? record.version : SAVE_VERSION
  if (version < 10 && wishAt >= 0 && step >= wishAt) {
    step = Math.min(guideSteps.length, step + 1)
  }
  // Version 15 put the guild before auto runs. A player who already took the
  // auto reward and stood on the guild step moves past both; the guild's
  // reward is paid on loading (review 1208be3).
  const guildAt = guideSteps.findIndex((entry) => entry.id === 'guild')
  if (version < 15 && guildAt >= 0 && step === guildAt + 1) {
    step = guildAt + 2
  }
  return step
}

function addMaterials(materials: Materials, more: Partial<Materials>): Materials {
  const next = { ...materials }
  for (const key of Object.keys(more) as MaterialName[]) {
    next[key] = (next[key] ?? 0) + (more[key] ?? 0)
  }
  return next
}

// The guild step's reward for a player moved past it by shiftGuide.
function skippedGuildReward(record: Record<string, unknown>): Partial<Materials> {
  const guildAt = guideSteps.findIndex((entry) => entry.id === 'guild')
  const version = typeof record.version === 'number' ? record.version : SAVE_VERSION
  if (version >= 15 || guildAt < 0 || numberOr(record.guideStep, 0) !== guildAt + 1) {
    return {}
  }
  return (guideSteps[guildAt]?.reward ?? {}) as Partial<Materials>
}

function isCalendar(value: unknown): value is Calendar {
  if (value == null || typeof value !== 'object') {
    return false
  }
  const calendar = value as Calendar
  return timeRules.seasons.includes(calendar.season) && typeof calendar.year === 'number'
}

function raiseToStart(value: unknown, fallback: Record<BuildingId, number>): Record<BuildingId, number> {
  const saved = value != null && typeof value === 'object' ? (value as Partial<Record<BuildingId, number>>) : {}
  const levels = { ...fallback }
  for (const building of villageRules.buildings) {
    const id = building.id as BuildingId
    levels[id] = Math.max(building.startLevel, numberOr(saved[id], fallback[id]))
  }
  return levels
}

// Version 5 and older saves had one party and one set of tactics; they become the first preset.
function readPresets(record: Record<string, unknown>, fallback: PartyPreset[]): PartyPreset[] {
  if (Array.isArray(record.presets) && record.presets.length > 0) {
    const saved = record.presets as PartyPreset[]
    return fallback.map((preset) => saved.find((entry) => entry.id === preset.id) ?? preset)
  }
  const first = fallback[0]
  if (!first) {
    return fallback
  }
  const slots = Array.isArray(record.party) ? (record.party as PartySlot[]) : []
  const tactics = isTactics(record.tactics) ? record.tactics : first.tactics
  return [{ ...first, slots, tactics }, ...fallback.slice(1)]
}

function isTactics(value: unknown): value is Tactics {
  if (value == null || typeof value !== 'object') {
    return false
  }
  const tactics = value as Tactics
  return typeof tactics.healBelow === 'number' && typeof tactics.retreatBelow === 'number' && typeof tactics.target === 'string'
}

function readAged(value: unknown): { name: string; age: number }[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value.flatMap((entry) => {
    if (entry == null || typeof entry !== 'object') {
      return []
    }
    const name = (entry as { name?: unknown }).name
    const age = (entry as { age?: unknown }).age
    return typeof name === 'string' && typeof age === 'number' ? [{ name, age }] : []
  })
}

function isAbsence(value: unknown): value is AbsenceReport {
  return value != null && typeof value === 'object' && typeof (value as AbsenceReport).elapsedMs === 'number'
}

function validHeroes(value: unknown): value is Hero[] {
  return Array.isArray(value) && value.every((hero) => Array.isArray((hero as Hero).traitIds) && typeof (hero as Hero).potential === 'number')
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

// Festivals (Docs/morale.md): once a season, a lift for everyone and a
// seasonal gift.
export function festivalCost(state: GameState): number {
  return moraleRules.festival.goldBase + moraleRules.festival.goldPerTownLevel * townLevel(state.fame).level
}

function holdFestival(state: GameState): GameState {
  const season = seasonKey(state.calendar)
  if (state.festival?.season === season) {
    return { ...state, notice: 'festivalDone' }
  }
  const cost = festivalCost(state)
  if (state.gold < cost) {
    return { ...state, notice: 'poor' }
  }
  const kind = state.calendar.season
  const rules = moraleRules.festival
  let roster = state.roster.map((hero) => shiftMorale(hero, rules.morale))
  let materials = state.materials
  if (kind === 'summer') {
    roster = roster.map((hero) => (isChild(hero) || hero.condition === 'dead' ? hero : gainXp(hero, Math.round(hero.level * progression.xpPerLevel * rules.xpShare))))
  }
  if (kind === 'autumn') {
    materials = { ...materials, wood: materials.wood + rules.harvest.wood, stone: materials.stone + rules.harvest.stone, iron: materials.iron + rules.harvest.iron }
  }
  if (kind === 'winter') {
    roster = roster.map((hero) => ((hero.morale ?? moraleRules.base) < moraleRules.base + rules.morale ? shiftMorale(hero, rules.memorial) : hero))
  }
  return { ...state, notice: null, gold: state.gold - cost, fame: state.fame + rules.fame, roster, materials, festival: { season, kind } }
}

function readFestival(value: unknown): Festival | null {
  if (value == null || typeof value !== 'object') {
    return null
  }
  const festival = value as Festival
  return typeof festival.season === 'string' && timeRules.seasons.includes(festival.kind) ? { season: festival.season, kind: festival.kind } : null
}

// ---------- automation (Docs/automation.md) ----------

function queueRoom(state: GameState, building: QueueBuilding): number {
  return state.buildings[building] * automationRules.queuePerLevel
}

// A busy workshop takes the order into its queue, paid now. The start
// function on an idle copy checks and charges exactly as a direct order would.
function enqueue(state: GameState, building: QueueBuilding, id: string): GameState {
  if (!state.automation) {
    state = { ...state, automation: freshAutomation() }
  }
  const queue = state.automation.queues[building]
  if (queue.length >= queueRoom(state, building)) {
    return { ...state, notice: 'queueFull' }
  }
  const probe =
    building === 'smith'
      ? startCraft({ ...state, smith: null }, id, 0)
      : building === 'alchemy'
        ? startBrew({ ...state, alchemy: null }, id as PotionId, 0)
        : startEnchant({ ...state, magic: null }, id as TrinketId, 0)
  if (probe.notice) {
    return { ...state, notice: probe.notice }
  }
  return {
    ...state,
    notice: null,
    gold: probe.gold,
    materials: probe.materials,
    automation: { ...state.automation, queues: { ...state.automation.queues, [building]: [...queue, id] } },
  }
}

function dequeue(state: GameState, building: QueueBuilding, index: number): GameState {
  const queue = state.automation.queues[building]
  const id = queue[index]
  if (id == null) {
    return { ...state, notice: 'missing' }
  }
  const refund = orderCost(building, id)
  return {
    ...state,
    notice: null,
    gold: state.gold + refund.gold,
    materials: {
      ...state.materials,
      wood: state.materials.wood + refund.wood,
      stone: state.materials.stone + refund.stone,
      iron: state.materials.iron + refund.iron,
      herb: state.materials.herb + refund.herb,
      bone: state.materials.bone + refund.bone,
      crystal: state.materials.crystal + refund.crystal,
    },
    automation: { ...state.automation, queues: { ...state.automation.queues, [building]: queue.filter((_, at) => at !== index) } },
  }
}

function orderCost(building: QueueBuilding, id: string) {
  const none = { gold: 0, wood: 0, stone: 0, iron: 0, herb: 0, bone: 0, crystal: 0 }
  if (building === 'smith') {
    const recipe = recipeById(id)
    return recipe ? { ...none, gold: recipe.gold, wood: recipe.wood, stone: recipe.stone, iron: recipe.iron } : none
  }
  if (building === 'alchemy') {
    const potion = potionById(id)
    return potion ? { ...none, gold: potion.gold, herb: potion.herb, bone: potion.bone } : none
  }
  const trinket = trinketById(id)
  return trinket ? { ...none, gold: trinket.gold, crystal: trinket.crystal } : none
}

// Starts the next paid order, or for the alchemy workshop a potion that has
// fallen below its standing stock, at the moment the workshop is free.
function startNext(state: GameState, building: QueueBuilding, at: number): GameState {
  const queue = state.automation.queues[building]
  const [id, ...rest] = queue
  if (id != null) {
    const queues = { ...state.automation.queues, [building]: rest }
    const automation = { ...state.automation, queues }
    if (building === 'smith') {
      return { ...state, automation, smith: { kind: 'craft', recipeId: id, gear: null, finishAt: at + (recipeById(id)?.ms ?? 0) } }
    }
    if (building === 'alchemy') {
      return { ...state, automation, alchemy: { potionId: id as PotionId, finishAt: at + brewTime(state, id as PotionId) } }
    }
    return { ...state, automation, magic: { trinketId: id as TrinketId, finishAt: at + enchantTime(state, id as TrinketId) } }
  }
  if (building === 'alchemy') {
    for (const potionId of automationRules.potionOrder as PotionId[]) {
      const want = state.automation.potions[potionId] ?? 0
      if (want > 0 && (state.potions[potionId] ?? 0) < want) {
        const started = startBrew(state, potionId, at)
        if (!started.notice) {
          return started
        }
      }
    }
  }
  return state
}

function jobOf(state: GameState, building: QueueBuilding): { finishAt: number } | null {
  return building === 'smith' ? state.smith : building === 'alchemy' ? state.alchemy : state.magic
}

function runWorkshop(state: GameState, building: QueueBuilding, from: number, until: number, crafted: string[]): GameState {
  if (state.buildings[building] < 1) {
    return state
  }
  // A state that skipped loading (a hot reload in development) may lack automation.
  if (!state.automation) {
    state = { ...state, automation: freshAutomation() }
  }
  let next = jobOf(state, building) ? state : startNext(state, building, from)
  for (let guard = 0; guard < 500; guard += 1) {
    const job = jobOf(next, building)
    if (!job || job.finishAt > until) {
      break
    }
    const at = job.finishAt
    next = building === 'smith' ? finishSmith(next, at, crafted) : building === 'alchemy' ? finishBrew(next, at, crafted) : finishEnchant(next, at, crafted)
    next = startNext(next, building, at)
  }
  return next
}

// The temple treats the wounded at home without being asked (treatment is free).
function autoCare(state: GameState, at: number, only?: Set<string>): GameState {
  if (!state.automation?.care || state.buildings.temple < 1) {
    return state
  }
  const away = busyHeroIds(state)
  let next = state
  for (const hero of state.roster) {
    if (only && !only.has(hero.id)) {
      continue
    }
    if ((hero.condition === 'injured' || hero.condition === 'critical') && hero.treatAt == null && !away.has(hero.id)) {
      const treated = startTreat(next, hero.id, at)
      if (!treated.notice) {
        next = { ...treated, notice: state.notice }
      }
    }
  }
  return next
}

function readAutomation(value: unknown): Automation {
  const base = freshAutomation()
  if (value == null || typeof value !== 'object') {
    return base
  }
  const record = value as Partial<Automation>
  const list = (entries: unknown) => (Array.isArray(entries) ? entries.filter((entry): entry is string => typeof entry === 'string') : [])
  return {
    care: typeof record.care === 'boolean' ? record.care : base.care,
    drill: typeof record.drill === 'boolean' ? record.drill : base.drill,
    potions: readSupplies(record.potions),
    queues: {
      smith: list(record.queues?.smith),
      alchemy: list(record.queues?.alchemy).filter((id): id is PotionId => POTION_IDS.includes(id as PotionId)),
      magic: list(record.queues?.magic).filter((id): id is TrinketId => TRINKET_IDS.includes(id as TrinketId)),
    },
  }
}

// Heroes auto training leaves alone: the selected party (for sending by
// hand) and every party the auto runs would actually use (review a6be730).
function drillReserved(state: GameState): Set<string> {
  const reserved = new Set((presetById(state, state.presetId)?.slots ?? []).map((slot) => slot.id))
  const parties = guildLevel(state.buildings.guild).autoParties
  if (!state.auto.enabled || parties < 1) {
    return reserved
  }
  if (state.auto.policy === 'fixed') {
    for (const slot of state.auto.party) {
      reserved.add(slot.id)
    }
  }
  let taken = 0
  const used = new Set<string>()
  for (const presetId of autoPresetOrder(state)) {
    if (taken >= parties) {
      break
    }
    const ids = (presetById(state, presetId)?.slots ?? []).map((slot) => slot.id)
    if (ids.length === 0 || ids.some((id) => used.has(id))) {
      continue
    }
    for (const id of ids) {
      used.add(id)
      reserved.add(id)
    }
    taken += 1
  }
  return reserved
}

function readInterviews(value: unknown): Interviews | null {
  if (value == null || typeof value !== 'object') {
    return null
  }
  const record = value as Interviews
  return typeof record.season === 'string' && typeof record.used === 'number' ? { season: record.season, used: record.used } : null
}

// Visitors already looked over before interviews existed stay known (Docs/scouting.md).
function knownBefore18(record: Record<string, unknown>, hero: Hero): Hero {
  const version = typeof record.version === 'number' ? record.version : SAVE_VERSION
  return version < 18 && !hero.interviewed ? { ...hero, interviewed: 1 } : hero
}

