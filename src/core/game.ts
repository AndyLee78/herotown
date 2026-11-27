import { chargeFountain, freshFountain, makeWish, readFountain, upgradeFountain, type FountainState } from './fountain'
import { claimGuide, guideSteps } from './guide'
import { advanceIncident, nextIncidentTime, readIncidentState, resolveIncident, type Incident, type IncidentLog } from './incidents'
import { claimAchievement, codexDungeons, readAchievements, readCodex, recordCollection, recordDungeonClear, recordEncounter, restoreCollection, type Codex } from './codex'
import { canLearn, skillPicks } from './skills'
import { deliver, ensureBoard, expeditionSlotsFor, guildLevel, progressClear, readBoard, type GuildBoard } from './guild'
import { cheer, driftMorale, lowMorale, mourn } from './morale'
import { arrive, interview, type Interviews } from './scouting'
import { enroll, graduate, teachSeason, unenroll } from './school'
import { afterTrip, benchAtDeparture, feel } from './personality'
import { festivalScale, gather, type TavernState } from './tavern'
import { bequeath, bequeathed, comfortHeir, heirloomMods } from './heirloom'
import { blessing, enshrine, fitShrine, shrineMorale, unshrine, type Shrine } from './legends'
import { abyssFloors, freshVault, settleSpecial, specialBlock, spendTrial, type Abyss, type Trials, type Vault, type VaultKey } from './trials'
import { currentRaid, raidVariant, rewardBonus, settleRaid, type Raid } from './raid'
import { resolveInvasion, setDefenders, type Invasion } from './invasion'
import { buyEvent, eventBlock, settleEvent, spendEvent, type EventState } from './events'
import { lighthousePotential, monumentStage, raiseMonument, statueXp, type MonumentId } from './monuments'
import { prosper } from './prosperity'
import { buyOffer, freshMarket, sellGear, sellPotion, trade, updateMerchant, type Market, type MerchantOffer } from './market'
import { autoFormation } from './formation'
import { forgetSkill, readDrills, runDrills, startDrill, type Drill } from './drill'
import { buyIntel, finishScout, isNest, nestSeason, readScout, seasonKey, startScout, type ScoutJob } from './nest'
import { TRINKET_IDS, enchantTime, finishEnchant, readMagicJob, startEnchant, type MagicJob } from './magic'
import { POTION_IDS, brewTime, finishBrew, readAlchemyJob, readSupplies, returnSupplies, startBrew, takeSupplies, type AlchemyJob } from './alchemy'
import { adRules, giftRules, automationRules, potionById, trinketById, moraleRules, magicRules, nestRules, classById, classList, combatRules, dungeonById, dungeons, expeditionRules, lifeRules, progression, retirementRules, smithRules, timeRules, villageRules, specialDungeons, endgameRules, lootRules } from './data'
import { canWield, forgeGear, normalizeGear, orderId, recipeById, rerollOption, splitOrder } from './gear'
import { canExchange, dungeonLoot, exchangeCost, uniqueById, uniqueGear, type LootEntry, type LootTag } from './loot'
import { applyReport, DEFAULT_TACTICS, gainXp, runDungeon } from './dungeon'
import { canDeploy, generateHero, isChild, generateVisitors, normalizeHero, restHero, withAge } from './hero'
import { acceptProposal, bedsTaken, bondParty, declineProposal, deliverBirths, femaleChance, graveFor, nextAge, partyParts, passAway, readBonds, readProposals, recordGraveFriends, tidyFamily, turnSeason, wageCount, type FamilyEvents } from './family'
import { createRng } from './rng'
import type { Rng } from './rng'
import type { Genes } from './genes'
import type { Bond, ClassId, CombatError, DungeonReport, Gear, GearSlot, GearType, Gender, Hero, PartyMember, PotionId, Proposal, Role, Row, Supplies, Tactics, TrinketId , StatKey } from './types'

export const SAVE_VERSION = 31

// Town levels up to here come with fame alone (Docs/endgame.md 4b).
export const PROMOTION_FREE = 7

export function townLevelOf(state: Pick<GameState, 'fame' | 'promoted'>) {
  return townLevel(state.fame, state.promoted ?? PROMOTION_FREE)
}

export function innRefreshCost(state: Pick<GameState, 'fame' | 'promoted'>): number {
  const { base, perTownLevel } = villageRules.inn.refreshCost
  return base + perTownLevel * townLevelOf(state).level
}

export type SeasonId = 'spring' | 'summer' | 'autumn' | 'winter'

export type Calendar = {
  year: number
  season: SeasonId
  intoSeasonMs: number
}

export type AbsenceReport = {
  incidents?: { pending?: string; ignored: string[] }
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
  autoDetails?: {
    dungeons: { dungeonId: string; wins: number; losses: number; xp: number; materials: Partial<Record<MaterialName, number>> }[]
    gear: Gear[]
    injured: { id: string; name: string }[]
  }
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
  // The weapon or armour type chosen for a craft (Docs/identity.md 5b).
  gearType?: GearType
  gear: Gear | null
  finishAt: number
}

export type BuildingId = 'hall' | 'inn' | 'house' | 'guild' | 'smith' | 'temple' | 'fountain' | 'alchemy' | 'magic' | 'training' | 'school' | 'market' | 'tavern' | 'legends'
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
  // The floor an abyss run started below (Docs/endgame.md 4a).
  abyssFrom?: number
  // The raid week and the boss's health before and after this party (Docs/endgame.md 4c).
  // `tier`: the raid tier it fought; missing on trips from before tiers counts as 1 (review 1eeb27b).
  raid?: { week: string; tier?: number; start: number | null; left?: number; max?: number }
}

// A hero who has hung up their sword. They stay in town, cost no wages,
// keep ageing, and can run one building for a bonus (GDD 3.3, 5.2).
export type Retiree = {
  hero: Hero
  retiredYear: number
  building: BuildingId | null
}

export type Grave = {
  diedAt?: number
  friends?: string[]
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
  gift?: Hero['gift']
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
  | 'noMarket'
  | 'noMaterial'
  | 'noMerchant'
  | 'soldOut'
  | 'noTavern'
  | 'tavernFull'
  | 'gatherSize'
  | 'notHeir'
  | 'wrongClass'
  | 'noLegends'
  | 'shrineFull'
  | 'trialDay'
  | 'trialsUsed'
  | 'promoteFame'
  | 'promoteDeed'
  | 'promoteOffering'
  | 'promoteMax'
  | 'raidDone'
  | 'noInvasion'
  | 'eventSeason'
  | 'eventUsed'
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
  incident: Incident | null
  incidentNonce: number
  nextIncidentAt: number
  recentIncidents: string[]
  incidentLog: IncidentLog[]
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
  codex: Codex
  achievements: string[]
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
  // The market's prices and the wandering merchant (Docs/market.md).
  market: Market
  // Rounds at the tavern this season (Docs/tavern.md).
  tavern: TavernState | null
  // Heirlooms on display in the hall of fame (Docs/legends.md).
  shrine: Shrine | null
  // Late-game rewards and their counters (Docs/endgame.md 4a).
  vault: Vault
  trials: Trials | null
  abyss: Abyss
  // The highest town level whose promotion ritual is done (7 before any).
  promoted: number
  // This week's raid, raids won, and the coming invasion (Docs/endgame.md 4c).
  raid: Raid | null
  raidKills: number
  // The last pieces found in dungeons and raids, for the new-gear notice (Docs/identity.md 5c).
  loot: LootEntry[]
  invasion: Invasion | null
  // Seasonal event runs and shop, monuments, prosperity rank (Docs/endgame.md 4d).
  event: EventState | null
  monuments: Partial<Record<MonumentId, number>>
  prosperity: number
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
  | { type: 'craft'; recipeId: string; gearType?: GearType; now: number }
  | { type: 'enhance'; gearId: string; now: number }
  | { type: 'equip'; heroId: string; gearId: string }
  | { type: 'unequip'; heroId: string; slot: GearSlot; gearId?: string }
  | { type: 'enchant'; trinketId: TrinketId; now: number }
  | { type: 'add'; id: string; presetId?: string }
  | { type: 'autoFill'; presetId: string }
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
  | { type: 'innRefresh' }
  | { type: 'lockSeed'; locked: boolean }
  | { type: 'setSeed'; seed: number }
  | { type: 'reset'; now: number }
  | { type: 'adReward'; placement: AdPlacement; now: number }
  | { type: 'claimGuide' }
  | { type: 'resolveIncident'; choice: string }
  | { type: 'claimAchievement'; id: string }
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
  | { type: 'trade'; material: MaterialName; amount: number }
  | { type: 'sellGear'; gearId: string }
  | { type: 'sellPotion'; potionId: PotionId; count: number }
  | { type: 'buyOffer'; offerId: string }
  | { type: 'gather'; heroIds: string[] }
  | { type: 'bequeath'; retireeId: string; gearId: string; toId: string | null }
  | { type: 'promote' }
  | { type: 'defend'; presetIds: string[] }
  | { type: 'buyEvent'; itemId: string }
  | { type: 'raiseMonument'; id: MonumentId }
  | { type: 'prosper' }
  | { type: 'reroll'; gearId: string; index: number }
  | { type: 'exchange'; uniqueId: string }
  | { type: 'seenLoot' }
  | { type: 'enshrine'; gearId: string }
  | { type: 'unshrine'; gearId: string }
  | { type: 'declineProposal'; a: string; b: string; now?: number }
  | { type: 'wish'; now: number }
  | { type: 'brew'; potionId: PotionId; now: number }
  | { type: 'supplies'; potionId: PotionId; count: number; presetId?: string }

export function freshState(seed: number, now: number): GameState {
  return {
    version: SAVE_VERSION,
    incident: null,
    incidentNonce: 0,
    nextIncidentAt: nextIncidentTime(seed, 0, now),
    recentIncidents: [],
    incidentLog: [],
    gold: progression.startGold,
    materials: { ...villageRules.start, herb: 0, crystal: 0 },
    fame: 0,
    buildings: startingBuildings(),
    construction: null,
    smith: null,
    stash: [],
    craftNonce: 0,
    cleared: [],
    codex: readCodex(null),
    achievements: [],
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
    market: freshMarket(now),
    tavern: null,
    shrine: null,
    vault: freshVault(),
    trials: null,
    abyss: { best: 0, checkpoint: 0 },
    promoted: PROMOTION_FREE,
    raid: null,
    raidKills: 0,
    loot: [],
    invasion: null,
    event: null,
    monuments: {},
    prosperity: 0,
  }
}

export function reduce(state: GameState, action: GameAction): GameState {
  const applied = applyAction(state, action)
  const next = applied.roster !== state.roster || applied.stash !== state.stash || applied.retirees !== state.retirees || applied.graveyard !== state.graveyard
    ? recordCollection(applied) : applied
  // A town level-up cheers everyone, whatever raised the fame: a first clear,
  // a building, a festival or a contract (Docs/morale.md, review b9036a0).
  const gained = townLevelOf(next).level - townLevelOf(state).level
  if (gained > 0 && next !== state) {
    return { ...next, roster: next.roster.map((hero) => feel(hero, 'pride', moraleRules.pride.townLevel * gained)) }
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
    return restoreCollection(fromLegacy(record, now))
  }
  if (typeof record.version === 'number' && record.version >= 2 && record.version <= SAVE_VERSION) {
    const next = unequipMisfits(dropUnpaidOrders(fitShrine(normalize(record, now)), record.version))
    return record.version < 30 ? restoreCollection(next) : next
  }
  if (typeof record.version === 'number' && record.version > SAVE_VERSION) {
    throw new Error('newer')
  }
  return freshState(1, now)
}

// A weapon a hero's class cannot wield, from an edited or older save, goes
// to storage (review 3ad100c).
function unequipMisfits(state: GameState): GameState {
  const off: Gear[] = []
  const roster = state.roster.map((hero) => {
    const misfits = hero.gear.filter((item) => !canWield(hero.classId, item))
    if (misfits.length === 0) {
      return hero
    }
    off.push(...misfits)
    return { ...hero, gear: hero.gear.filter((item) => !misfits.includes(item)) }
  })
  return off.length ? { ...state, roster, stash: [...state.stash, ...off] } : state
}

function apply(state: GameState, action: GameAction): GameState {
  if (action.type === 'resolveIncident') return resolveIncident(state, action.choice)
  if (action.type === 'hire') {
    const hero = state.visitors.find((entry) => entry.id === action.id)
    if (!hero) {
      return { ...state, notice: 'missing' }
    }
    if (state.gold < progression.hireCost) {
      return { ...state, notice: 'poor' }
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
    const order = orderId(action.recipeId, action.gearType)
    if (action.gearType && splitOrder(order).type !== action.gearType) {
      return { ...state, notice: 'recipe' }
    }
    return state.smith ? enqueue(state, 'smith', order) : startCraft(state, order, action.now)
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
    // Trials and the abyss are by hand only, even if an imported save lists them (review b80777c).
    if (!state.cleared.includes(action.id) || specialDungeons.some((dungeon) => dungeon.id === action.id)) {
      return { ...state, notice: 'autoLocked' }
    }
    return { ...state, notice: null, auto: { ...state.auto, dungeonId: action.id } }
  }
  if (action.type === 'autoParty') {
    const preset = presetById(state, state.presetId)
    return { ...state, notice: null, auto: { ...state.auto, party: (preset?.slots ?? []).map((slot) => ({ ...slot })) } }
  }
  if (action.type === 'autoFill') {
    return editPreset(state, action.presetId, (preset) => ({
      ...preset,
      slots: autoFormation(state.roster, busyHeroIds(state), state.dungeonId),
    }))
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
  if (action.type === 'refreshVisitors' || action.type === 'innRefresh') {
    const paid = action.type === 'innRefresh'
    const cost = paid ? innRefreshCost(state) : 0
    if (paid && state.gold < cost) return { ...state, notice: 'poor' }
    const visitorNonce = !paid && state.seedLocked ? state.visitorNonce : state.visitorNonce + 1
    const now = state.lastTickAt
    const visitors = generateVisitors(
      state.seed + visitorNonce * progression.visitorNonceStride,
      visitorCap(state.buildings.inn),
      townLevelOf(state).visitorPotential + retireeBonus(state, 'inn') + lighthousePotential(state),
      femaleChance(state),
      neededClasses(state, []),
      giftBonus(state),
    ).map((hero) => ({ ...hero, arrivedAt: now }))
    return {
      ...state,
      notice: null,
      gold: state.gold - cost,
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
  if (action.type === 'claimAchievement') {
    return claimAchievement(state, action.id, townLevelOf(state).level)
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
  if (action.type === 'buyEvent') {
    return buyEvent(state, action.itemId)
  }
  if (action.type === 'raiseMonument') {
    return raiseMonument(state, action.id)
  }
  if (action.type === 'prosper') {
    return prosper(state)
  }
  if (action.type === 'reroll') {
    return reroll(state, action.gearId, action.index)
  }
  if (action.type === 'exchange') {
    return exchange(state, action.uniqueId)
  }
  if (action.type === 'seenLoot') {
    return { ...state, notice: null, loot: [] }
  }
  if (action.type === 'defend') {
    return setDefenders(state, action.presetIds)
  }
  if (action.type === 'promote') {
    return promote(state)
  }
  if (action.type === 'enshrine') {
    return enshrine(state, action.gearId)
  }
  if (action.type === 'unshrine') {
    return unshrine(state, action.gearId)
  }
  if (action.type === 'gather') {
    return gather(state, action.heroIds, busyHeroIds(state))
  }
  if (action.type === 'bequeath') {
    return bequeath(state, action.retireeId, action.gearId, action.toId, busyHeroIds(state))
  }
  if (action.type === 'trade') {
    return trade(state, action.material, action.amount)
  }
  if (action.type === 'sellGear') {
    return sellGear(state, action.gearId)
  }
  if (action.type === 'sellPotion') {
    return sellPotion(state, action.potionId, action.count)
  }
  if (action.type === 'buyOffer') {
    return buyOffer(state, action.offerId)
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
  const autoTally: AutoTally = { runs: 0, gold: 0, ...(rawElapsed >= timeRules.reportAfterMs ? { details: { dungeons: [], gear: [], injured: [] } } : {}) }
  let next = state
  while (next.lastTickAt < effectiveNow) {
    const turnAt = next.lastTickAt + (timeRules.seasonMs - next.calendar.intoSeasonMs)
    // A finished building also ends a piece, so work before it runs at the
    // old level and work after it at the new one (review a6be730).
    const builtAt = next.construction && next.construction.finishAt > next.lastTickAt ? next.construction.finishAt : Infinity
    // An invasion ends a piece too, so everyone home by then can defend (review 1650b75).
    const raidAt = next.invasion && next.invasion.nextAt > next.lastTickAt ? next.invasion.nextAt : Infinity
    // Always move forward, even if a broken save has the season overrun.
    const incidentAt = next.incident?.expiresAt ?? next.nextIncidentAt
    const until = Math.min(Math.max(Math.min(turnAt, builtAt, raidAt, incidentAt), next.lastTickAt + 1), effectiveNow)
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
    // The wandering merchant comes and goes (Docs/market.md).
    next = updateMerchant(next, until)
    const out = next.expeditions
    const lootBeforeReturn = next.loot
    next = returnExpeditions(next, until, returned)
    collectAbsenceGear(autoTally.details, lootBeforeReturn, next.loot)
    // The wounded who come home start treatment as they arrive.
    for (const trip of out.filter((entry) => !next.expeditions.some((still) => still.id === entry.id))) {
      next = autoCare(next, trip.returnAt, new Set(trip.heroIds))
    }
    next = finishCare(next, until)
    next = finishConstruction(next, until, completed)
    // Invasions from town level 9, every three days, fought once the piece's
    // returns, care and building are settled (Docs/endgame.md 4c).
    next = invade(next, until)
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
      next = passAway(next, family, until)
    }
    // Widow and unbond at the moment someone left, not when the catch-up ends.
    next = tidyFamily({ ...next, lastTickAt: until }, until)
    next = advanceIncident(next, until)
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
    incidents: {
      ...(next.incident ? { pending: next.incident.id } : {}),
      ignored: next.incidentLog.filter(({ choice, at }) => choice === 'ignore' && at > state.lastTickAt).map(({ id }) => id),
    },
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
    ...(autoTally.details ? { autoDetails: autoTally.details } : {}),
    adClaimed: false,
    aged,
    returned,
    births: family.births,
    proposals: family.proposals,
    deaths: family.deaths,
  }
  return { ...next, absence }
}

// The town level fame reaches; past level 7 each level also needs its
// promotion ritual (Docs/endgame.md 4b), so `promoted` caps it.
export function townLevel(fame: number, promoted = Number.POSITIVE_INFINITY) {
  let current = villageRules.levels[0]
  for (const level of villageRules.levels) {
    if (fame >= level.fame && (level.level <= PROMOTION_FREE || level.level <= promoted)) {
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
  // Aging may charge a pupil's last tuition (Docs/school.md), on top of the wages.
  const lived = years > 0 ? growOlder({ ...state, gold }, years, aged) : { ...state, gold }
  return {
    ...lived,
    warning,
    calendar: { year, season: (timeRules.seasons[index] ?? 'spring') as SeasonId, intoSeasonMs },
  }
}

function growOlder(state: GameState, years: number, aged: { name: string; age: number }[]): GameState {
  let roster = state.roster.map((hero) => older(hero, years, aged))
  // A child who reaches deploy age joins the hero lists with a welcome.
  const grownUp = roster.filter((hero, index) => isChild(state.roster[index]!) && !isChild(hero)).map((hero) => hero.id)
  // Pupils coming of age get the lesson of the season just ended, then leave
  // school, maybe for the career they chose (Docs/school.md, review 62e7837).
  const lastLesson = teachSeason({ ...state, roster }, new Set(grownUp))
  roster = lastLesson.roster.map((hero) => (grownUp.includes(hero.id) ? graduate(hero) : hero))
  state = { ...state, gold: lastLesson.gold }
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
  const bonus = townLevelOf(state).visitorPotential + retireeBonus(state, 'inn') + lighthousePotential(state)
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
        giftBonus(state),
      ),
      arrivedAt: now,
    }
    // A separate stream decides prodigies (Docs/scouting.md).
    const hero = { ...arrive(drawn, createRng(state.seed + nonce * progression.visitorNonceStride + 31), townLevelOf(state).level), arrivedAt: now }
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
  if (townLevelOf(state).level < def.unlockLevel) {
    return { ...state, notice: 'locked' }
  }
  const current = state.buildings[id]
  const cost = def.levels.find((level) => level.level === current + 1) as (Cost & { level: number; ms: number; town?: number }) | undefined
  // The late levels wait for town levels 8-10 (Docs/endgame.md); say so
  // before the cap, as the screen does (review c89e043).
  if (cost && (cost.town ?? 0) > townLevelOf(state).level) {
    return { ...state, notice: 'locked' }
  }
  if (!cost || current >= townLevelOf(state).maxBuildingLevel) {
    return { ...state, notice: 'maxLevel' }
  }
  if (!affordable(state, cost)) {
    return { ...state, notice: 'resources' }
  }
  return {
    ...pay(state, cost),
    construction: { id, finishAt: now + Math.round(cost.ms * (1 - retireeBonus(state, 'hall'))) },
  }
}

function dungeonForMaterial(state: GameState): string | null {
  return (
    state.cleared.find((id) => villageRules.drops[id as keyof typeof villageRules.drops]?.material === state.auto.material) ??
    null
  )
}

function autoMembers(state: GameState, presetId = state.presetId, details?: AbsenceReport['autoDetails']): PartyMember[] {
  // The fixed policy's own party stands in for the selected preset only.
  const slots = state.auto.policy === 'fixed' && presetId === state.presetId ? state.auto.party : (presetById(state, presetId)?.slots ?? [])
  const away = busyHeroIds(state)
  const members = slots.flatMap((slot) => {
    const hero = state.roster.find((entry) => entry.id === slot.id)
    if (!hero || !canDeploy(hero) || away.has(hero.id)) {
      return []
    }
    if (hero.condition === 'critical' || (state.auto.policy === 'safe' && hero.condition === 'injured')) {
      if (details && !details.injured.some(({ id }) => id === hero.id)) details.injured.push({ id: hero.id, name: hero.name })
      return []
    }
    // Grieving or dispirited heroes stay home from auto runs (Docs/morale.md).
    if (lowMorale(hero)) {
      return []
    }
    // So do tired heroes: they rest until fit, so the player comes back to a
    // fresh party (Docs/fatigue.md).
    if (hero.fatigue >= lifeRules.fatigue.tiredAt) {
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
export function withBonds(state: GameState, members: PartyMember[]): PartyMember[] {
  const parts = partyParts(state, members.map((member) => member.hero.id))
  return members.map((member) => {
    const part = parts[member.hero.id]
    const bonded = part && (part.total !== 0 || part.bond !== 0) ? { ...member, bonus: part.total, healBonus: part.bond } : member
    const heirloom = heirloomMods(state, member.hero)
    const withHeirloom = heirloom.attack > 0 || heirloom.defense > 0 ? { ...bonded, heirloom } : bonded
    // A legend among their forebears watches over them (Docs/legends.md).
    const blessed = blessing(state, member.hero)
    return blessed > 0 ? { ...withHeirloom, blessing: blessed } : withHeirloom
  })
}

type AutoTally = { runs: number; gold: number; details?: AbsenceReport['autoDetails'] }

function collectAbsenceGear(details: AbsenceReport['autoDetails'], before: GameState['loot'], after: GameState['loot']) {
  if (!details || before === after) return
  const previous = new Set(before.map(({ gearId }) => gearId))
  for (const entry of after) if (entry.gear && !previous.has(entry.gearId)) details.gear.push(entry.gear)
}

function runAuto(state: GameState, elapsed: number, tally: AutoTally): GameState {
  // Auto runs need the guild, which also sets how many parties go (Docs/guild.md).
  const parties = guildLevel(state.buildings.guild).autoParties
  if (!state.auto.enabled || parties < 1) {
    return state.auto.carryMs ? { ...state, auto: { ...state.auto, carryMs: 0 } } : state
  }
  let next = state
  let budget = (state.auto.carryMs ?? 0) + elapsed
  // The piece's rest is already in everyone's fatigue (recoverRoster), so the
  // time between runs only rests off what the runs themselves added; nobody
  // else gets it twice (review b1261a7).
  const debt = new Map<string, number>()
  const rest = (fatigueRecoveryRate(state) * villageRules.auto.runMs) / 3_600_000
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
      const members = autoMembers(next, presetId, tally.details)
      if (members.length === 0 || members.some((member) => used.has(member.hero.id))) {
        continue
      }
      for (const member of members) {
        used.add(member.hero.id)
      }
      const before = new Map(members.map((member) => [member.hero.id, member.hero.fatigue]))
      next = autoRun(next, members, presetId, dungeonId, tally)
      for (const hero of next.roster) {
        const was = before.get(hero.id)
        if (was != null && hero.fatigue > was) {
          debt.set(hero.id, (debt.get(hero.id) ?? 0) + hero.fatigue - was)
        }
      }
      ran += 1
    }
    // With everyone tired there is nothing to wait for unless runs are still
    // being rested off.
    if (ran === 0 && debt.size === 0) {
      break
    }
    budget -= villageRules.auto.runMs
    // Heroes rest between runs: a long absence is many runs with time in
    // between, not one marathon (fatigue used to pile up offline).
    next = {
      ...next,
      roster: next.roster.map((hero) => {
        const owed = debt.get(hero.id)
        if (owed == null) {
          return hero
        }
        const eased = Math.min(owed, rest, hero.fatigue)
        if (owed - eased <= 0 || hero.fatigue - eased <= 0) {
          debt.delete(hero.id)
        } else {
          debt.set(hero.id, owed - eased)
        }
        return { ...hero, fatigue: hero.fatigue - eased }
      }),
    }
  }
  // Leftover time waits for the next tick, but never more than one run's worth.
  return { ...next, auto: { ...next.auto, carryMs: Math.min(budget, villageRules.auto.runMs) } }
}

// The selected preset goes first, then the others in order.
function autoPresetOrder(state: GameState): string[] {
  return [state.presetId, ...state.presets.map((preset) => preset.id).filter((id) => id !== state.presetId)]
}

function autoRun(state: GameState, members: PartyMember[], presetId: string, dungeonId: string, tally: AutoTally): GameState {
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
  const goldGain = report.victory ? Math.floor(result.report.gold * scale * (1 + rewardBonus(next))) : 0
  next = dropFromPresets(grantVictoryRewards(afterTrip(bondParty({ ...next, ...settled, gold: next.gold + goldGain }, heroIds, report.victory), heroIds, report.victory), report, dungeonId, scale))
  tally.runs += 1
  tally.gold += goldGain
  if (tally.details) {
    const details = tally.details
    let dungeon = details.dungeons.find((entry) => entry.dungeonId === dungeonId)
    if (!dungeon) {
      dungeon = { dungeonId, wins: 0, losses: 0, xp: 0, materials: {} }
      details.dungeons.push(dungeon)
    }
    if (report.victory) dungeon.wins += 1
    else dungeon.losses += 1
    for (const material of Object.keys(state.materials) as MaterialName[]) {
      const gained = next.materials[material] - state.materials[material]
      if (gained > 0) dungeon.materials[material] = (dungeon.materials[material] ?? 0) + gained
    }
    const lifetimeXp = (hero: Hero) => hero.xp + progression.xpPerLevel * hero.level * (hero.level - 1) / 2
    for (const { hero } of members) {
      const after = settled.roster.find(({ id }) => id === hero.id)
      if (after) dungeon.xp += Math.max(0, lifetimeXp(after) - lifetimeXp(hero))
    }
    collectAbsenceGear(details, state.loot, next.loot)
  }
  return next
}

function grantVictoryRewards(state: GameState, report: DungeonReport, dungeonId: string, scale?: number, tag?: LootTag): GameState {
  if (!report.victory) {
    return state
  }
  const drop = villageRules.drops[dungeonId as keyof typeof villageRules.drops]
  if (!drop) {
    return state
  }
  const first = !state.cleared.includes(dungeonId)
  const applied = (scale ?? (first ? 1 : villageRules.repeatReward)) * (1 + (report.luck ?? 0))
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
    fame += Math.round(drop.fame * (1 + rewardBonus(state)))
  }
  const party = (report.party ?? []).map((member) => member.id)
  // Pride (up to the everyday cap), then joy on top for a village first (review b9036a0).
  let roster = cheer(state.roster, party, moraleRules.pride.victory, moraleRules.pride.victoryCap, 'pride')
  if (first) {
    roster = cheer(roster, party, moraleRules.joy.firstClear)
  }
  // Gear drops: a sure piece on a first clear, then a chance (Docs/identity.md 5c).
  const looted = dungeonLoot({ ...state, roster, materials, fame, cleared }, dungeonId, first, scale != null, report.luck ?? 0, tag, report.elites ?? 0)
  // The old one-off cave quest gave way to the contract board (Docs/guild.md).
  return progressClear(looted, dungeonId)
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

// The great lighthouse draws more gifted visitors (Docs/identity.md 5a).
function giftBonus(state: GameState): number {
  return monumentStage(state, 'lighthouse') * giftRules.perLighthouse
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
      hero = driftMorale(hero, hours, moraleRules.base + shrineMorale(state))
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
): { hero: Hero | null; grave: Grave | null; left?: Gear[] } {
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
    return { hero: null, grave: graveFor(next, 'battle', year), left: next.gear }
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
): Pick<GameState, 'roster' | 'graveyard' | 'stash' | 'codex'> {
  const rng = createRng(seed + 17)
  const partyIds = new Set(heroIds)
  // The statue of heroes speeds learning (Docs/endgame.md 4d).
  const bonus = statueXp(state)
  if (bonus > 0) {
    report = { ...report, xp: Math.round(report.xp * (1 + bonus)) }
  }
  const alliesLived = report.conditions.filter((entry) => entry.condition !== 'dead').length > 0
  const roster: Hero[] = []
  const graveyard = [...state.graveyard]
  const stash = [...state.stash]
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
      graveyard.push(recordGraveFriends(state, outcome.grave, now))
      // What survived the fall comes home as an heirloom (Docs/tavern.md).
      stash.push(...bequeathed(state, hero, outcome.left ?? []))
    }
  }
  // Grief lands when the party comes home with the news; several losses on
  // one trip count as the deepest one (Docs/morale.md, review b9036a0).
  const lost = graveyard.slice(state.graveyard.length)
  return { roster: lost.length ? mourn(roster, lost, state.bonds) : roster, graveyard, stash, codex: recordEncounter(state.codex, report) }
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
  // Weekday trials and the abyss open with the town (Docs/endgame.md 4a).
  const special = specialDungeons.find((entry) => entry.id === id)
  if (special) {
    // The invasion comes to the town; nobody sets out for it.
    if (special.special === 'invasion') {
      return false
    }
    const unlock =
      special.special === 'weekday' ? endgameRules.weekday.unlockTown
      : special.special === 'raid' ? endgameRules.raid.unlockTown
      : special.special === 'event' ? endgameRules.event.unlockTown
      : endgameRules.abyss.unlockTown
    return townLevelOf(state).level >= unlock
  }
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
  // Today's trial only, three a day (Docs/endgame.md 4a).
  const blocked = specialBlock(state, state.dungeonId, now) ?? (dungeonById(state.dungeonId).special === 'event' ? eventBlock(state, state.dungeonId) : null)
  if (blocked) {
    return { ...state, notice: blocked }
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
  // The abyss is laid out below its checkpoint as the party sets out.
  const abyssFrom = dungeon.special === 'endless' ? state.abyss.checkpoint : undefined
  // The raid: this week's boss, with whatever health it has left (Docs/endgame.md 4c).
  const raid = dungeon.special === 'raid' ? currentRaid(state, now) : null
  if (raid?.killed) {
    return { ...state, notice: 'raidDone' }
  }
  const raidPlan = raid ? raidVariant(state, now) : null
  const variant = abyssFrom != null ? { floors: abyssFloors(abyssFrom) } : raidPlan ?? nestVariant(state, state.dungeonId)
  const result = runDungeon(party, state.dungeonId, preset.tactics, battleSeed, carry.taken, variant)
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
    // Home as soon as the party has walked out of the dungeon: no empty wait
    // after the fight (the walk out takes about five seconds).
    returnAt: battleEndAt + expeditionRules.returnMs,
    ...(Object.keys(carry.taken).length > 0 ? { supplies: carry.taken } : {}),
    ...(isNest(state.dungeonId) ? { nestKey: seasonKey(state.calendar) } : {}),
    ...(abyssFrom != null ? { abyssFrom } : {}),
    ...(raid && raidPlan ? { raid: { week: raid.week, tier: raid.tier ?? 1, start: raid.hp, left: raidPlan.raid.left, max: raidPlan.raid.max } } : {}),
  }
  // Friends left at home notice who went without them (Docs/personality.md).
  const spent = dungeon.special === 'weekday' ? spendTrial(state, now) : dungeon.special === 'event' ? spendEvent(state) : raid ? { ...state, raid } : state
  const benched = benchAtDeparture(spent, expedition.heroIds, away)
  return { ...benched, notice: null, potions: carry.stock, expeditionNonce: state.expeditionNonce + 1, expeditions: [...state.expeditions, expedition] }
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
  const repeat = !dungeonById(dungeonId).special && state.cleared.includes(dungeonId)
  // The arch and prosperity add to what comes home (Docs/endgame.md 4d).
  const goldGain = Math.floor((repeat ? report.gold * villageRules.repeatReward : report.gold) * (1 + rewardBonus(state)))
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
  const special = settleSpecial(grantVictoryRewards(afterTrip(home, expedition.heroIds, report.victory), report, dungeonId, undefined, { at: expedition.returnAt, trip: expedition.id }), dungeonId, report.floorsCleared, report.victory, expedition.abyssFrom)
  const raided = expedition.raid ? settleRaid(special, expedition.raid.week, expedition.raid.start, expedition.raid.left, expedition.raid.max, expedition.returnAt, expedition.raid.tier ?? 1, expedition.id) : special
  const rewarded = dungeonById(dungeonId).special === 'event' ? settleEvent(raided, report.victory) : raided
  const next = dropFromPresets(report.victory || raided.raidKills > state.raidKills ? recordDungeonClear(rewarded, dungeonId) : rewarded)
  const materials: Partial<Materials> = {}
  for (const key of ['wood', 'stone', 'iron', 'bone', 'herb', 'crystal'] as const) {
    const diff = next.materials[key] - state.materials[key]
    if (diff > 0) {
      materials[key] = diff
    }
  }
  // Essences and abyss shards gained, kept on the record (review b80777c).
  const vaultGained: Partial<Vault> = {}
  for (const key of Object.keys(next.vault) as (keyof Vault)[]) {
    const diff = next.vault[key] - (state.vault?.[key] ?? 0)
    if (diff > 0) {
      vaultGained[key] = diff
    }
  }
  const record: DungeonReport = {
    ...report,
    // The experience as granted, with the statue's share (review 1eeb27b).
    xp: Math.round(report.xp * (1 + statueXp(state))),
    dungeonId,
    presetId: expedition.presetId,
    finishedAt: expedition.returnAt,
    gained: { gold: next.gold - state.gold, fame: next.fame - state.fame, materials, ...(Object.keys(vaultGained).length ? { vault: vaultGained } : {}) },
    ...(expedition.abyssFrom != null ? { abyss: { from: expedition.abyssFrom, best: next.abyss.best } } : {}),
  }
  return { ...next, history: [record, ...next.history].slice(0, expeditionRules.history) }
}

function learnSkill(state: GameState, id: string, skillId: string): GameState {
  const hero = state.roster.find((entry) => entry.id === id)
  if (!hero) {
    return { ...state, notice: 'missing' }
  }
  // Picks open by level (Docs/skills.md), whatever points a save carries; a
  // branch is learned step by step (Docs/identity.md 5a).
  const open = skillPicks(hero.level) - (hero.learned.length - 1)
  if (!canLearn(hero, skillId) || hero.skillPoints < 1 || open < 1) {
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

// Late costs also take bone, herb and crystal (Docs/endgame.md).
type Cost = { gold: number; wood: number; stone: number; iron: number; bone?: number; herb?: number; crystal?: number } & Partial<Record<VaultKey, number>>

function affordable(state: GameState, cost: Cost): boolean {
  return (
    state.gold >= cost.gold &&
    state.materials.wood >= cost.wood &&
    state.materials.stone >= cost.stone &&
    state.materials.iron >= cost.iron &&
    state.materials.bone >= (cost.bone ?? 0) &&
    state.materials.herb >= (cost.herb ?? 0) &&
    state.materials.crystal >= (cost.crystal ?? 0) &&
    // Essences and abyss shards from the vault (Docs/endgame.md 4b).
    (Object.keys(state.vault) as VaultKey[]).every((key) => state.vault[key] >= (cost[key] ?? 0))
  )
}

function pay(state: GameState, cost: Cost): GameState {
  return {
    ...state,
    notice: null,
    gold: state.gold - cost.gold,
    materials: {
      wood: state.materials.wood - cost.wood,
      stone: state.materials.stone - cost.stone,
      iron: state.materials.iron - cost.iron,
      bone: state.materials.bone - (cost.bone ?? 0),
      herb: state.materials.herb - (cost.herb ?? 0),
      crystal: state.materials.crystal - (cost.crystal ?? 0),
    },
    vault: Object.fromEntries((Object.keys(state.vault) as VaultKey[]).map((key) => [key, state.vault[key] - (cost[key] ?? 0)])) as Vault,
  }
}

// Smith orders queued before raid spoils were added to their cost never paid
// them: hand back what was paid and take the orders off (review 1650b75).
function dropUnpaidOrders(state: GameState, version: unknown): GameState {
  if (typeof version !== 'number' || version >= 25 || !state.automation) {
    return state
  }
  const spoils = ['scale', 'crown', 'core', 'valor'] as const
  let next = state
  const queue = next.automation.queues.smith
  for (let index = queue.length - 1; index >= 0; index -= 1) {
    const recipe = recipeById(splitOrder(queue[index]!).recipeId) as (Cost & { gold: number }) | undefined
    if (recipe && spoils.some((key) => (recipe[key] ?? 0) > 0)) {
      next = dequeue(next, 'smith', index)
      next = { ...next, vault: { ...next.vault, scale: next.vault.scale - (recipe.scale ?? 0), crown: next.vault.crown - (recipe.crown ?? 0), core: next.vault.core - (recipe.core ?? 0), valor: next.vault.valor - (recipe.valor ?? 0) } }
    }
  }
  return { ...next, notice: null }
}

// Schedules the first invasion when the town reaches level 9, and fights
// any that arrive by `until`. Defence never kills: the fallen come home
// critical, as on auto runs (Docs/endgame.md 4c).
function invade(state: GameState, until: number): GameState {
  const rules = endgameRules.invasion
  if (!state.invasion) {
    return townLevelOf(state).level >= rules.unlockTown ? { ...state, invasion: { nextAt: until + rules.everyMs, defenders: [], count: 0, wins: 0 } } : state
  }
  let next = state
  for (let fought = 0; next.invasion && next.invasion.nextAt <= until && fought < 3; fought += 1) {
    const at = next.invasion.nextAt
    next = resolveInvasion(next, (current, report, heroIds) => {
      const safe = { ...report, conditions: report.conditions.map((entry) => (entry.condition === 'dead' ? { ...entry, condition: 'critical' as const } : entry)) }
      return { ...current, ...settleParty(current, safe, current.seed + at, at, heroIds, 'invasion') }
    })
  }
  if ((next.invasion?.wins ?? 0) > (state.invasion?.wins ?? 0)) next = recordDungeonClear(next, 'invasion')
  // A long absence does not stack up raids: the next one is a full wait away.
  if (next.invasion && next.invasion.nextAt <= until) {
    next = { ...next, invasion: { ...next.invasion, nextAt: until + rules.everyMs } }
  }
  return next
}

// The promotion ritual for town levels 8-10: enough fame, a deed in the
// abyss, and an offering from the vault (Docs/endgame.md 4b).
function promote(state: GameState): GameState {
  const target = (state.promoted ?? PROMOTION_FREE) + 1
  const rule = endgameRules.promotions.find((entry) => entry.level === target)
  const level = villageRules.levels.find((entry) => entry.level === target)
  if (!rule || !level) {
    return { ...state, notice: 'promoteMax' }
  }
  if (state.fame < level.fame) {
    return { ...state, notice: 'promoteFame' }
  }
  // Level 9 needs a raid boss brought down, level 10 an invasion held (Docs/endgame.md 4c).
  const deeds = rule as { raidKills?: number; invasionWins?: number }
  if (state.abyss.best < rule.abyssBest || (state.raidKills ?? 0) < (deeds.raidKills ?? 0) || (state.invasion?.wins ?? 0) < (deeds.invasionWins ?? 0)) {
    return { ...state, notice: 'promoteDeed' }
  }
  const offering = rule.offering as Partial<Record<VaultKey, number>>
  if ((Object.keys(state.vault) as VaultKey[]).some((key) => state.vault[key] < (offering[key] ?? 0))) {
    return { ...state, notice: 'promoteOffering' }
  }
  const vault = Object.fromEntries((Object.keys(state.vault) as VaultKey[]).map((key) => [key, state.vault[key] - (offering[key] ?? 0)])) as Vault
  return { ...state, notice: null, vault, promoted: target }
}

function startCraft(state: GameState, order: string, now: number): GameState {
  const { recipeId, type: gearType } = splitOrder(order)
  if (state.buildings.smith < 1) {
    return { ...state, notice: 'noSmith' }
  }
  if (state.smith) {
    return { ...state, notice: 'smithBusy' }
  }
  const recipe = recipeById(recipeId)
  if (!recipe || recipe.smithLevel >= 99) {
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
    smith: { kind: 'craft', recipeId, ...(gearType ? { gearType } : {}), gear: null, finishAt: now + recipe.ms },
  }
}

// Heroic and legendary gear goes past +3 up to +10 (Docs/endgame.md 4d).
export function enhanceLimit(gear: Gear): number {
  return (smithRules.lateEnhance.grades as string[]).includes(gear.grade) ? smithRules.lateEnhance.max : smithRules.enhanceMax
}

export function enhanceCostFor(gear: Gear): Cost & { ms: number } {
  if (gear.enhance < smithRules.enhanceMax) {
    return smithRules.enhanceCost
  }
  const late = smithRules.lateEnhance
  const step = gear.enhance - smithRules.enhanceMax + 1
  const essence = gear.slot === 'armor' ? 'frost' : 'flame'
  return { gold: late.gold * step, wood: 0, stone: 0, iron: late.iron * step, bone: late.bonePerStep * step, crystal: late.crystalPerStep * step, [essence]: late.essencePerStep * step, abyss: late.abyssPerStep * step, ms: smithRules.enhanceCost.ms }
}

// Valour (and a raid unique's spoils) buys a unique (Docs/identity.md 5c).
function exchange(state: GameState, uniqueId: string): GameState {
  const def = uniqueById(uniqueId)
  if (!def) {
    return { ...state, notice: 'missing' }
  }
  if (!canExchange(def, state.cleared)) {
    return { ...state, notice: 'locked' }
  }
  const cost = exchangeCost(def)
  const vault = { ...state.vault }
  for (const [key, amount] of Object.entries(cost)) {
    if ((vault[key as VaultKey] ?? 0) < amount) {
      return { ...state, notice: 'resources' }
    }
    vault[key as VaultKey] -= amount
  }
  const craftNonce = state.craftNonce + 1
  const piece = uniqueGear(def, `${state.seed}-x${craftNonce}`)
  return { ...state, notice: null, vault, craftNonce, stash: [...state.stash, piece] }
}

// Valour rerolls one option of a stored piece (Docs/identity.md 5b).
function reroll(state: GameState, gearId: string, index: number): GameState {
  const gear = state.stash.find((item) => item.id === gearId)
  if (!gear || !Number.isInteger(index) || index < 0 || index >= (gear.options?.length ?? 0)) {
    return { ...state, notice: 'missing' }
  }
  if ((state.vault?.valor ?? 0) < smithRules.optionValor) {
    return { ...state, notice: 'resources' }
  }
  const craftNonce = state.craftNonce + 1
  const rolled = rerollOption(gear, index, state.seed + craftNonce * 100003 + 17)
  if (!rolled) {
    return { ...state, notice: 'missing' }
  }
  return {
    ...state,
    notice: null,
    craftNonce,
    vault: { ...state.vault, valor: state.vault.valor - smithRules.optionValor },
    stash: state.stash.map((item) => (item.id === gearId ? rolled : item)),
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
  if (!gear || gear.slot === 'trinket' || gear.enhance >= enhanceLimit(gear)) {
    return { ...state, notice: 'recipe' }
  }
  const cost = enhanceCostFor(gear)
  if (!affordable(state, cost)) {
    return { ...state, notice: 'resources' }
  }
  return {
    ...pay(state, cost),
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
    const gear = forgeGear(recipe, `${state.seed}-g${craftNonce}`, rng.int(2 ** 31), job.gearType)
    crafted.push(recipe.id)
    return { ...state, smith: null, craftNonce, stash: [...state.stash, gear] }
  }
  if (!job.gear) {
    return { ...state, smith: null, craftNonce }
  }
  // Past the table the last chance holds (review c89e043). Past +3 the late
  // table takes over, lower with each step (Docs/endgame.md 4d).
  const table = smithRules.successByLevel
  const late = job.gear.enhance >= smithRules.enhanceMax ? smithRules.lateEnhance.chance[job.gear.enhance - smithRules.enhanceMax] ?? 0 : null
  const chance = Math.min(1, (late ?? table[Math.min(state.buildings.smith, table.length - 1)] ?? 0) + retireeBonus(state, 'smith'))
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
  let item = state.stash.find((gear) => gear.id === gearId)
  const hero = state.roster.find((entry) => entry.id === heroId)
  if (!item || !hero) {
    return { ...state, notice: 'missing' }
  }
  // Gear is locked while its hero is away: the trip was simulated with it (review 1f690a1).
  if (busyHeroIds(state).has(heroId)) {
    return { ...state, notice: 'busyHero' }
  }
  // Each class wields its own weapon types (Docs/identity.md 5b).
  if (!canWield(hero.classId, item)) {
    return { ...state, notice: 'wrongClass' }
  }
  const stash = state.stash.filter((gear) => gear.id !== gearId)
  // An heir first wearing what a departed forebear left is comforted (Docs/tavern.md).
  const comfort = comfortHeir(state, heroId, item)
  item = comfort.item
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
      entry.id === heroId ? comfort.hero({ ...entry, gear: [...entry.gear.filter((gear) => !off.includes(gear)), item!] }) : entry,
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
  return normalize({ ...base, ...record, ...readIncidentState({}, now), visitors, version: SAVE_VERSION, calendar: base.calendar, lastTickAt: now, absence: null, notice: null }, now)
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
    ...readIncidentState(record, now),
    calendar,
    lastTickAt: numberOr(record.lastTickAt, now),
    cleared: Array.isArray(record.cleared) ? [...new Set(record.cleared.filter((id) => codexDungeons.includes(id)))] : [],
    codex: readCodex(record.codex),
    achievements: readAchievements(record.achievements),
    visitors: validHeroes(record.visitors)
      ? openStays(record.visitors.map((hero) => withRecovery(knownBefore18(record, hero), now)), now, visitorStay(innLevel(record, base)))
      : base.visitors,
    roster: validHeroes(record.roster) ? record.roster.map((hero) => withRecovery(hero, now)) : [],
    graveyard: Array.isArray(record.graveyard) ? (record.graveyard as Grave[]) : [],
    // Gear on the anvil is read like stored gear (review 3ad100c).
    smith: isSmith(record.smith) ? { ...record.smith, gear: record.smith.gear ? normalizeGear(record.smith.gear, 'warrior') : null } : null,
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
    market: readMarket(record.market, numberOr(record.lastTickAt, now)),
    tavern: readTavern(record.tavern),
    shrine: readShrine(record.shrine),
    vault: readVault(record.vault),
    trials: record.trials && typeof (record.trials as Trials).date === 'string' && typeof (record.trials as Trials).used === 'number' ? { date: (record.trials as Trials).date, used: (record.trials as Trials).used } : null,
    abyss: readAbyss(record.abyss),
    raid: readRaid(record.raid),
    raidKills: numberOr(record.raidKills, 0),
    loot: readLoot(record.loot),
    invasion: readInvasion(record.invasion),
    event: readEvent(record.event),
    monuments: readMonuments(record.monuments),
    prosperity: Math.max(0, Math.min(endgameRules.prosperity.maxRank, Math.floor(numberOr(record.prosperity, 0)))),
    promoted: typeof record.promoted === 'number' && Number.isFinite(record.promoted) ? Math.max(PROMOTION_FREE, Math.min(10, Math.floor(record.promoted))) : PROMOTION_FREE,
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
  return moraleRules.festival.goldBase + moraleRules.festival.goldPerTownLevel * townLevelOf(state).level
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
  const before = new Map(state.roster.map((hero) => [hero.id, hero.morale ?? moraleRules.base]))
  // A tavern hosting the festival makes it bigger (Docs/tavern.md).
  const scale = festivalScale(state)
  let roster = state.roster.map((hero) => feel(hero, 'joy', rules.morale * scale))
  let materials = state.materials
  if (kind === 'summer') {
    roster = roster.map((hero) => (isChild(hero) || hero.condition === 'dead' ? hero : gainXp(hero, Math.round(hero.level * progression.xpPerLevel * rules.xpShare), { gear: false })))
  }
  if (kind === 'autumn') {
    materials = { ...materials, wood: materials.wood + rules.harvest.wood, stone: materials.stone + rules.harvest.stone, iron: materials.iron + rules.harvest.iron }
  }
  if (kind === 'winter') {
    // The memorial comforts whoever was below their usual spirits before the
    // festival, felt like any joy (review 49c92da).
    roster = roster.map((hero) => ((before.get(hero.id) ?? moraleRules.base) < moraleRules.base ? feel(hero, 'joy', rules.memorial) : hero))
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
    // Essences and shards too, as a direct order would (review c89e043).
    vault: probe.vault,
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
    vault: Object.fromEntries((Object.keys(state.vault) as VaultKey[]).map((key) => [key, state.vault[key] + (refund.vault[key] ?? 0)])) as Vault,
    automation: { ...state.automation, queues: { ...state.automation.queues, [building]: queue.filter((_, at) => at !== index) } },
  }
}

function orderCost(building: QueueBuilding, id: string) {
  const none = { gold: 0, wood: 0, stone: 0, iron: 0, herb: 0, bone: 0, crystal: 0, vault: {} as Partial<Vault> }
  if (building === 'smith') {
    // Everything a recipe costs, the late bone, crystal and vault costs too (review c89e043).
    const recipe = recipeById(splitOrder(id).recipeId) as (Cost & { gold: number }) | undefined
    if (!recipe) {
      return none
    }
    const vault: Partial<Vault> = {}
    for (const key of Object.keys(freshVault()) as VaultKey[]) {
      if (recipe[key]) {
        vault[key] = recipe[key]
      }
    }
    return { ...none, gold: recipe.gold, wood: recipe.wood, stone: recipe.stone, iron: recipe.iron, bone: recipe.bone ?? 0, crystal: recipe.crystal ?? 0, vault }
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
      const { recipeId, type: gearType } = splitOrder(id)
      return { ...state, automation, smith: { kind: 'craft', recipeId, ...(gearType ? { gearType } : {}), gear: null, finishAt: at + (recipeById(recipeId)?.ms ?? 0) } }
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

// Saves before version 20 have no market yet (Docs/market.md).
function readRaid(value: unknown): Raid | null {
  const record = value as Partial<Raid> | null
  if (!record || typeof record.week !== 'string' || typeof record.bossId !== 'string') {
    return null
  }
  const num = (entry: unknown) => (typeof entry === 'number' && Number.isFinite(entry) ? Math.max(0, entry) : null)
  const tier = typeof record.tier === 'number' ? Math.max(1, Math.min(endgameRules.raid.tiers.length, Math.floor(record.tier))) : 1
  // A boss won before tiers existed opens tier 2 instead of closing the week (review 1eeb27b).
  if (typeof record.tier !== 'number' && record.killed === true) {
    return { week: record.week, bossId: record.bossId, hp: null, max: null, killed: false, tier: 2 }
  }
  return { week: record.week, bossId: record.bossId, hp: num(record.hp), max: num(record.max), killed: record.killed === true, tier }
}

function readEvent(value: unknown): EventState | null {
  const record = value as Partial<EventState> | null
  if (!record || typeof record.season !== 'string') {
    return null
  }
  const bought: Record<string, number> = {}
  for (const [key, amount] of Object.entries(record.bought ?? {})) {
    if (typeof amount === 'number' && Number.isFinite(amount)) {
      bought[key] = Math.max(0, Math.floor(amount))
    }
  }
  return { season: record.season, used: Math.max(0, Math.floor(numberOr(record.used, 0))), bought }
}

function readMonuments(value: unknown): Partial<Record<MonumentId, number>> {
  const out: Partial<Record<MonumentId, number>> = {}
  if (value && typeof value === 'object') {
    for (const def of endgameRules.monuments.list) {
      const stage = (value as Record<string, unknown>)[def.id]
      if (typeof stage === 'number' && Number.isFinite(stage)) {
        out[def.id as MonumentId] = Math.max(0, Math.min(def.stages.length, Math.floor(stage)))
      }
    }
  }
  return out
}

function readInvasion(value: unknown): Invasion | null {
  const record = value as Partial<Invasion> | null
  if (!record || typeof record.nextAt !== 'number') {
    return null
  }
  return {
    nextAt: record.nextAt,
    defenders: Array.isArray(record.defenders) ? record.defenders.filter((id): id is string => typeof id === 'string').slice(0, endgameRules.invasion.maxDefenders) : [],
    count: numberOr(record.count, 0),
    wins: numberOr(record.wins, 0),
    ...(record.last && typeof record.last.at === 'number' ? { last: record.last } : {}),
  }
}

function readVault(value: unknown): Vault {
  const vault = freshVault()
  if (value != null && typeof value === 'object') {
    for (const key of Object.keys(vault) as (keyof Vault)[]) {
      const amount = (value as Record<string, unknown>)[key]
      vault[key] = typeof amount === 'number' && Number.isFinite(amount) ? Math.max(0, Math.floor(amount)) : 0
    }
  }
  return vault
}

function readAbyss(value: unknown): Abyss {
  const record = (value ?? {}) as Partial<Abyss>
  const best = typeof record.best === 'number' && Number.isFinite(record.best) ? Math.max(0, Math.floor(record.best)) : 0
  // Checkpoints sit on whole runs of floors (review b80777c).
  const step = endgameRules.abyss.floorsPerRun
  const raw = typeof record.checkpoint === 'number' && Number.isFinite(record.checkpoint) ? Math.min(best, Math.floor(record.checkpoint)) : 0
  return { best, checkpoint: Math.max(0, Math.floor(raw / step) * step) }
}

function readShrine(value: unknown): Shrine | null {
  if (value == null || typeof value !== 'object') {
    return null
  }
  const shrine = value as Partial<Shrine>
  return {
    // Only heirlooms, each once (review 4c3aec1); fitShrine moves any extra to the stash.
    gear: Array.isArray(shrine.gear)
      ? shrine.gear.map((item) => normalizeGear(item, 'warrior')).filter((item, index, all) => item.heirloom != null && all.findIndex((other) => other.id === item.id) === index)
      : [],
    honoured: Array.isArray(shrine.honoured) ? shrine.honoured.filter((id): id is string => typeof id === 'string') : [],
  }
}

function readTavern(value: unknown): TavernState | null {
  if (value == null || typeof value !== 'object') {
    return null
  }
  const record = value as TavernState
  if (typeof record.season !== 'string' || typeof record.used !== 'number') {
    return null
  }
  const last = record.last && Array.isArray(record.last.heroIds) && typeof record.last.at === 'number' ? { heroIds: record.last.heroIds.filter((id): id is string => typeof id === 'string'), at: record.last.at } : undefined
  return { season: record.season, used: record.used, ...(last ? { last } : {}) }
}

function readMarket(value: unknown, now: number): Market {
  if (value == null || typeof value !== 'object') {
    return freshMarket(now)
  }
  const record = value as Partial<Market>
  const fresh = freshMarket(now)
  const pressure: Market['pressure'] = {}
  for (const [key, amount] of Object.entries(record.pressure ?? {})) {
    if (typeof amount === 'number' && Number.isFinite(amount)) {
      pressure[key as MaterialName] = amount
    }
  }
  const merchant = record.merchant
  const okMerchant =
    merchant != null && typeof merchant.arriveAt === 'number' && typeof merchant.leaveAt === 'number' && Array.isArray(merchant.offers)
      ? {
          arriveAt: merchant.arriveAt,
          leaveAt: merchant.leaveAt,
          // Gear on sale is read like stored gear (review 3ad100c).
          offers: (merchant.offers as MerchantOffer[]).map((offer) => (offer.kind === 'gear' ? { ...offer, gear: normalizeGear(offer.gear, 'warrior') } : offer)),
        }
      : null
  return {
    pressure,
    pressureAt: numberOr(record.pressureAt, now),
    merchant: okMerchant,
    nextMerchantAt: numberOr(record.nextMerchantAt, fresh.nextMerchantAt),
    merchantNonce: numberOr(record.merchantNonce, 0),
  }
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


function readLoot(value: unknown): LootEntry[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value
    .filter((entry): entry is LootEntry => entry != null && typeof entry === 'object' && typeof entry.gearId === 'string' && typeof entry.source === 'string' && typeof entry.at === 'number')
    .slice(-lootRules.recent)
    .map((entry) => ({
      gearId: entry.gearId,
      source: entry.source,
      at: entry.at,
      ...(entry.gear && typeof entry.gear === 'object' ? { gear: normalizeGear(entry.gear, 'warrior') } : {}),
      ...(typeof entry.trip === 'string' ? { trip: entry.trip } : {}),
    }))
}
