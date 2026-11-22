import { classById, combatRules, dungeonById, lifeRules, progression, smithRules, timeRules, villageRules } from './data'
import { forgeGear, normalizeGear, recipeById } from './gear'
import { applyReport, DEFAULT_TACTICS, runDungeon } from './dungeon'
import { canDeploy, generateHero, generateVisitors, normalizeHero, restHero } from './hero'
import { createRng } from './rng'
import type { Rng } from './rng'
import type { ClassId, CombatError, DungeonReport, Gear, GearSlot, Hero, Row, Tactics } from './types'

export const SAVE_VERSION = 2

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
}

export type SmithJob = {
  kind: 'craft' | 'enhance'
  recipeId: string
  gear: Gear | null
  finishAt: number
}

export type BuildingId = 'hall' | 'inn' | 'house' | 'guild' | 'smith' | 'temple'
export type MaterialName = 'wood' | 'stone' | 'iron' | 'bone'

export type AutoPolicy = 'material' | 'safe' | 'fixed'

export type AutoPlan = {
  enabled: boolean
  dungeonId: string
  policy: AutoPolicy
  material: MaterialName
  party: PartySlot[]
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

export type Grave = {
  id: string
  name: string
  classId: ClassId
  level: number
  clears: string[]
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
  | 'recipe'
  | 'enhanceFail'
  | 'autoLocked'
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
  party: PartySlot[]
  tactics: Tactics
  dungeonId: string
  report: DungeonReport | null
  absence: AbsenceReport | null
  notice: GameNotice
  auto: AutoPlan
}

export type GameAction =
  | { type: 'hire'; id: string; now?: number }
  | { type: 'rest'; times: number }
  | { type: 'depart'; confirm?: boolean }
  | { type: 'learn'; id: string; skillId: string }
  | { type: 'treat'; id: string; now: number }
  | { type: 'revive'; id: string; now: number }
  | { type: 'dismiss'; id: string }
  | { type: 'craft'; recipeId: string; now: number }
  | { type: 'enhance'; gearId: string; now: number }
  | { type: 'equip'; heroId: string; gearId: string }
  | { type: 'unequip'; heroId: string; slot: GearSlot }
  | { type: 'add'; id: string }
  | { type: 'row'; id: string; row: Row }
  | { type: 'remove'; id: string }
  | { type: 'dungeon'; id: string }
  | { type: 'tactics'; tactics: Tactics }
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

export function freshState(seed: number, now: number): GameState {
  return {
    version: SAVE_VERSION,
    gold: progression.startGold,
    materials: { ...villageRules.start },
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
    visitors: stampVisitors(generateVisitors(seed, visitorCap(1), townLevel(0).visitorPotential), now),
    roster: [],
    party: [],
    tactics: { ...DEFAULT_TACTICS },
    dungeonId: 'hill_cave',
    report: null,
    absence: null,
    notice: null,
    auto: { enabled: false, dungeonId: 'hill_cave', policy: 'safe', material: 'wood', party: [] },
  }
}

export function reduce(state: GameState, action: GameAction): GameState {
  const next = apply(state, action)
  return action.type === 'catchUp' ? next : { ...next, notice: next.notice }
}

export function catchUp(state: GameState, now: number): GameState {
  return apply(state, { type: 'catchUp', now })
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
  if (record.version === SAVE_VERSION) {
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
    if (state.roster.length >= bedCount(state.buildings.house)) {
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
    let gold = state.gold
    let roster = state.roster
    const times = Math.max(0, Math.round(action.times))
    for (let index = 0; index < times; index += 1) {
      gold = Math.max(0, gold - progression.wage * roster.length)
      roster = roster.map((hero) => restHero(hero, restBonus(state.buildings.house)))
    }
    return { ...state, notice: null, gold, roster, day: state.day + times }
  }
  if (action.type === 'depart') {
    const party = state.party.flatMap((slot) => {
      const hero = state.roster.find((entry) => entry.id === slot.id)
      return hero ? [{ hero, row: slot.row }] : []
    })
    const dungeon = dungeonById(state.dungeonId)
    const marked = party.some((member) => member.hero.deaths >= 1)
    if (marked && dungeon.tier >= lifeRules.dangerousTier && !action.confirm) {
      return { ...state, notice: 'seenDeath' }
    }
    const battleSeed = state.seedLocked ? state.seed : state.seed + state.day
    const result = runDungeon(party, state.dungeonId, state.tactics, battleSeed)
    if (!result.ok) {
      return { ...state, notice: result.error }
    }
    const settled = settleParty(state, result.report, battleSeed)
    const repeat = state.cleared.includes(state.dungeonId)
    const goldGain = repeat ? Math.floor(result.report.gold * villageRules.repeatReward) : result.report.gold
    return grantVictoryRewards({
      ...state,
      ...settled,
      notice: null,
      gold: state.gold + goldGain,
      report: result.report,
    })
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
    return {
      ...state,
      notice: null,
      roster: state.roster.filter((hero) => hero.id !== action.id),
      party: state.party.filter((slot) => slot.id !== action.id),
    }
  }
  if (action.type === 'craft') {
    return startCraft(state, action.recipeId, action.now)
  }
  if (action.type === 'enhance') {
    return startEnhance(state, action.gearId, action.now)
  }
  if (action.type === 'equip') {
    return equipGear(state, action.heroId, action.gearId)
  }
  if (action.type === 'unequip') {
    return unequipGear(state, action.heroId, action.slot)
  }
  if (action.type === 'build') {
    return startBuild(state, action.id, action.now)
  }
  if (action.type === 'finishBuild') {
    return finishConstruction(state, Math.max(action.now, state.construction?.finishAt ?? action.now), [])
  }
  if (action.type === 'auto') {
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
    return { ...state, notice: null, auto: { ...state.auto, party: state.party.map((slot) => ({ ...slot })) } }
  }
  if (action.type === 'add') {
    if (state.party.some((slot) => slot.id === action.id) || state.party.length >= combatRules.maxParty) {
      return state
    }
    if (!state.roster.some((hero) => hero.id === action.id)) {
      return state
    }
    const row: Row = state.party.filter((slot) => slot.row === 'front').length < combatRules.frontRowSize ? 'front' : 'back'
    return { ...state, notice: null, party: [...state.party, { id: action.id, row }] }
  }
  if (action.type === 'row') {
    const nextFront = state.party.filter((slot) => slot.id !== action.id && slot.row === 'front').length + (action.row === 'front' ? 1 : 0)
    const nextBack = state.party.length - nextFront
    if (nextFront > combatRules.frontRowSize || nextBack > combatRules.backRowSize) {
      return state
    }
    return {
      ...state,
      notice: null,
      party: state.party.map((slot) => (slot.id === action.id ? { ...slot, row: action.row } : slot)),
    }
  }
  if (action.type === 'remove') {
    return { ...state, notice: null, party: state.party.filter((slot) => slot.id !== action.id) }
  }
  if (action.type === 'dungeon') {
    return { ...state, notice: null, dungeonId: action.id }
  }
  if (action.type === 'tactics') {
    return { ...state, notice: null, tactics: { ...action.tactics } }
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
      townLevel(state.fame).visitorPotential,
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
  let next = moveCalendar(state, elapsed)
  next = finishConstruction(next, effectiveNow, completed)
  next = finishSmith(next, effectiveNow, crafted)
  next = finishCare(next, effectiveNow)
  next = updateVisitors(next, effectiveNow, visitors)
  const autoTally = { runs: 0, gold: 0 }
  next = runAuto(next, elapsed, autoTally)
  next = { ...next, lastTickAt: effectiveNow }
  if (rawElapsed < timeRules.reportAfterMs) {
    return next
  }
  const absence: AbsenceReport = {
    elapsedMs: elapsed,
    capped,
    seasonsPassed: next.calendar.year * 4 + seasonIndex(next.calendar.season) - (state.calendar.year * 4 + seasonIndex(state.calendar.season)),
    year: next.calendar.year,
    season: next.calendar.season,
    goldGained: 0,
    wagesPaid: state.gold - next.gold,
    injuries: [],
    completed,
    crafted,
    visitors,
    autoRuns: autoTally.runs,
    autoGold: autoTally.gold,
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

export function expeditionSlots(guildLevel: number): number {
  return 1 + Math.max(0, guildLevel - 1)
}

export function restBonus(houseLevel: number): number {
  return Math.max(0, houseLevel - 1) * villageRules.house.restBonusPerLevel
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

function seasonIndex(season: SeasonId): number {
  const index = timeRules.seasons.indexOf(season)
  return index < 0 ? 0 : index
}

function moveCalendar(state: GameState, elapsed: number): GameState {
  let intoSeasonMs = state.calendar.intoSeasonMs + elapsed
  let index = seasonIndex(state.calendar.season)
  let year = state.calendar.year
  let gold = state.gold
  let warning = state.warning
  while (intoSeasonMs >= timeRules.seasonMs) {
    intoSeasonMs -= timeRules.seasonMs
    index = (index + 1) % timeRules.seasons.length
    if (index === 0) {
      year += 1
    }
    const due = progression.wage * state.roster.length
    const paid = Math.min(gold, due)
    gold -= paid
    warning = paid < due ? 'wages' : null
  }
  return {
    ...state,
    gold,
    warning,
    calendar: { year, season: (timeRules.seasons[index] ?? 'spring') as SeasonId, intoSeasonMs },
  }
}

function finishConstruction(state: GameState, now: number, completed: string[]): GameState {
  if (!state.construction || state.construction.finishAt > now) {
    return state
  }
  const id = state.construction.id
  completed.push(id)
  return {
    ...state,
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
  const bonus = townLevel(state.fame).visitorPotential
  if (visitors.length < state.visitors.length && visitors.length < cap) {
    nextVisitorAt = Math.min(nextVisitorAt, now)
  }
  if (visitors.length < cap && nextVisitorAt > now + villageRules.inn.arriveEveryMs) {
    nextVisitorAt = now
  }
  while (visitors.length < cap && nextVisitorAt <= now) {
    nonce += 1
    const hero = {
      ...generateHero(createRng(state.seed + nonce * progression.visitorNonceStride), `${state.seed}-v${nonce}`, bonus),
      arrivedAt: now,
    }
    visitors.push(hero)
    arrived.push(hero.name)
    nextVisitorAt += villageRules.inn.arriveEveryMs
  }
  if (visitors.length >= cap && nextVisitorAt <= now) {
    nextVisitorAt = now + villageRules.inn.arriveEveryMs
  }
  return { ...state, visitors, visitorNonce: nonce, nextVisitorAt }
}

function startBuild(state: GameState, id: BuildingId, now: number): GameState {
  if (state.construction) {
    return { ...state, notice: 'building' }
  }
  const def = villageRules.buildings.find((building) => building.id === id)
  if (!def) {
    return { ...state, notice: 'missing' }
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
    },
    construction: { id, finishAt: now + cost.ms },
  }
}

function dungeonForMaterial(state: GameState): string | null {
  return (
    state.cleared.find((id) => villageRules.drops[id as keyof typeof villageRules.drops]?.material === state.auto.material) ??
    null
  )
}

function autoMembers(state: GameState): { hero: Hero; row: Row }[] {
  const slots = state.auto.policy === 'fixed' ? state.auto.party : state.party
  const members = slots.flatMap((slot) => {
    const hero = state.roster.find((entry) => entry.id === slot.id)
    if (!hero || !canDeploy(hero)) {
      return []
    }
    if (state.auto.policy === 'safe' && (hero.condition === 'injured' || hero.condition === 'critical')) {
      return []
    }
    return [{ hero, row: slot.row }]
  })
  const front = members.filter((member) => member.row === 'front').length
  if (members.length === 0 || front > combatRules.frontRowSize || members.length - front > combatRules.backRowSize) {
    return []
  }
  return members
}

function runAuto(state: GameState, elapsed: number, tally: { runs: number; gold: number }): GameState {
  if (!state.auto.enabled) {
    return state
  }
  let next = state
  let budget = elapsed
  while (budget >= villageRules.auto.runMs && tally.runs < 36) {
    const dungeonId = next.auto.policy === 'material' ? dungeonForMaterial(next) : next.auto.dungeonId
    const members = autoMembers(next)
    if (!dungeonId || !next.cleared.includes(dungeonId) || members.length === 0) {
      break
    }
    const battleSeed = next.seed + 9000 + tally.runs + next.day
    const result = runDungeon(members, dungeonId, next.tactics, battleSeed)
    if (!result.ok) {
      break
    }
    const report = {
      ...result.report,
      conditions: result.report.conditions.map((entry) =>
        entry.condition === 'dead' ? { ...entry, condition: 'critical' as const } : entry,
      ),
    }
    const slots = members.map((member) => ({ id: member.hero.id, row: member.row }))
    const settled = settleParty({ ...next, dungeonId, party: slots }, report, battleSeed)
    const goldGain = report.victory ? Math.floor(result.report.gold * villageRules.auto.rewardScale) : 0
    next = grantVictoryRewards(
      { ...next, ...settled, dungeonId, gold: next.gold + goldGain, report: { ...report, gold: goldGain } },
      villageRules.auto.rewardScale,
    )
    budget -= villageRules.auto.runMs
    tally.runs += 1
    tally.gold += goldGain
  }
  return next
}

function grantVictoryRewards(state: GameState, scale?: number): GameState {
  if (!state.report?.victory) {
    return state
  }
  const drop = villageRules.drops[state.dungeonId as keyof typeof villageRules.drops]
  if (!drop) {
    return state
  }
  const first = !state.cleared.includes(state.dungeonId)
  const applied = scale ?? (first ? 1 : villageRules.repeatReward)
  const gained = Math.max(1, Math.floor(drop.amount * applied))
  const material = drop.material as MaterialName
  const materials = { ...state.materials, [material]: state.materials[material] + gained }
  if ('iron' in drop && typeof drop.iron === 'number' && material !== 'iron') {
    materials.iron += Math.max(1, Math.floor(drop.iron * applied))
  }
  let fame = state.fame
  const cleared = state.cleared.includes(state.dungeonId) ? state.cleared : [...state.cleared, state.dungeonId]
  if (first) {
    fame += drop.fame
  }
  let questProgress = state.questProgress
  let questClaimed = state.questClaimed
  let gold = state.gold
  if (state.buildings.guild > 0 && state.dungeonId === villageRules.guild.questDungeon && !questClaimed) {
    questProgress += gained
    if (questProgress >= villageRules.guild.questCount) {
      questClaimed = true
      gold += villageRules.guild.rewardGold
      fame += villageRules.guild.rewardFame
    }
  }
  return { ...state, materials, fame, cleared, questProgress, questClaimed, gold }
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
      next = { ...next, resurrectAt: undefined, condition: 'injured' }
    }
    if (next.treatAt != null && next.treatAt <= now) {
      const condition = next.condition === 'critical' ? 'injured' : next.condition === 'injured' ? 'fatigued' : next.condition
      next = { ...next, treatAt: undefined, condition }
    }
    return next
  })
  return { ...state, roster }
}

export function applyCasualty(
  hero: Hero,
  report: DungeonReport,
  dungeonId: string,
  alliesLived: boolean,
  rng: Rng,
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
    return {
      hero: null,
      grave: { id: next.id, name: next.name, classId: next.classId, level: next.level, clears: next.clears },
    }
  }
  return { hero: { ...next, deaths: 1, condition: 'dead' }, grave: null }
}

function settleParty(state: GameState, report: DungeonReport, seed: number): Pick<GameState, 'roster' | 'party' | 'graveyard'> {
  const rng = createRng(seed + 17)
  const partyIds = new Set(state.party.map((slot) => slot.id))
  const alliesLived = report.conditions.filter((entry) => entry.condition !== 'dead').length > 0
  const roster: Hero[] = []
  const graveyard = [...state.graveyard]
  for (const hero of state.roster) {
    if (!partyIds.has(hero.id)) {
      roster.push(hero)
      continue
    }
    const outcome = applyCasualty(hero, report, state.dungeonId, alliesLived, rng)
    if (outcome.hero) {
      roster.push(outcome.hero)
    }
    if (outcome.grave) {
      graveyard.push(outcome.grave)
    }
  }
  const alive = new Set(roster.map((hero) => hero.id))
  return { roster, graveyard, party: state.party.filter((slot) => alive.has(slot.id)) }
}

function learnSkill(state: GameState, id: string, skillId: string): GameState {
  const hero = state.roster.find((entry) => entry.id === id)
  if (!hero) {
    return { ...state, notice: 'missing' }
  }
  const known = classById(hero.classId).skills.some((skill) => skill.id === skillId)
  if (!known || hero.learned.includes(skillId) || hero.skillPoints < 1) {
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
    roster: state.roster.map((entry) => (entry.id === id ? { ...entry, treatAt: now + lifeRules.treatMs } : entry)),
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
    roster: state.roster.map((entry) => (entry.id === id ? { ...entry, resurrectAt: now + lifeRules.reviveMs } : entry)),
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
  if (!gear || gear.enhance >= smithRules.enhanceMax) {
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
  const chance = smithRules.successByLevel[state.buildings.smith] ?? 0
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
  const previous = hero.gear.find((gear) => gear.slot === item.slot)
  const stash = state.stash.filter((gear) => gear.id !== item.id)
  if (previous) {
    stash.push(previous)
  }
  return {
    ...state,
    notice: null,
    stash,
    roster: state.roster.map((entry) =>
      entry.id === heroId ? { ...entry, gear: [...entry.gear.filter((gear) => gear.slot !== item.slot), item] } : entry,
    ),
  }
}

function unequipGear(state: GameState, heroId: string, slot: GearSlot): GameState {
  const hero = state.roster.find((entry) => entry.id === heroId)
  const item = hero?.gear.find((gear) => gear.slot === slot)
  if (!hero || !item) {
    return { ...state, notice: 'missing' }
  }
  return {
    ...state,
    notice: null,
    stash: [...state.stash, item],
    roster: state.roster.map((entry) =>
      entry.id === heroId ? { ...entry, gear: entry.gear.filter((gear) => gear.slot !== slot) } : entry,
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
  return normalize({ ...base, ...record, version: SAVE_VERSION, calendar: base.calendar, lastTickAt: now, absence: null, notice: null }, now)
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
      ? openStays(record.visitors.map(normalizeHero), now, visitorStay(innLevel(record, base)))
      : base.visitors,
    roster: validHeroes(record.roster) ? record.roster.map(normalizeHero) : [],
    graveyard: Array.isArray(record.graveyard) ? (record.graveyard as Grave[]) : [],
    smith: isSmith(record.smith) ? record.smith : null,
    stash: Array.isArray(record.stash) ? (record.stash as Partial<Gear>[]).map((item) => normalizeGear(item, 'warrior')) : [],
    craftNonce: numberOr(record.craftNonce, 0),
    party: Array.isArray(record.party) ? (record.party as PartySlot[]) : [],
    tactics: isTactics(record.tactics) ? record.tactics : base.tactics,
    report: record.report == null ? null : (record.report as DungeonReport),
    absence: isAbsence(record.absence)
      ? { ...record.absence, crafted: record.absence.crafted ?? [], autoRuns: record.absence.autoRuns ?? 0, autoGold: record.absence.autoGold ?? 0 }
      : null,
    materials: readMaterials(record.materials, base.materials),
    auto: isAuto(record.auto) ? record.auto : base.auto,
    notice: null,
  }
}

function isCalendar(value: unknown): value is Calendar {
  if (value == null || typeof value !== 'object') {
    return false
  }
  const calendar = value as Calendar
  return timeRules.seasons.includes(calendar.season) && typeof calendar.year === 'number'
}

function isTactics(value: unknown): value is Tactics {
  if (value == null || typeof value !== 'object') {
    return false
  }
  const tactics = value as Tactics
  return typeof tactics.healBelow === 'number' && typeof tactics.retreatBelow === 'number' && typeof tactics.target === 'string'
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
