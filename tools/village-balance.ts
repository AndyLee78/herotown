// Run: npx tsx tools/village-balance.ts [days=32] [seeds=20]
import { pathToFileURL } from 'node:url'
import { eventDungeonId, eventRunsLeft, eventShop } from '../src/core/events'
import { monumentStage, monumentCost, type MonumentId } from '../src/core/monuments'
import { alchemyRules, classById, combatRules, dungeons, endgameRules, guildRules, lifeRules, magicRules, marketRules, progression, retirementRules, schoolRules, smithRules, specialDungeons, villageRules } from '../src/core/data'
import { bedsTaken, isLegend } from '../src/core/family'
import { fountainWishes } from '../src/core/fountain'
import { bedCount, busyHeroIds, dungeonUnlocked, enhanceCostFor, enhanceLimit, festivalCost, freshState, presetById, reduce, retireeBonus, townLevelOf, type BuildingId, type GameAction, type GameState, type MaterialName } from '../src/core/game'
import { gearMods } from '../src/core/gear'
import { guideStatus } from '../src/core/guide'
import { canDeploy, isChild } from '../src/core/hero'
import { warned } from '../src/core/invasion'
import { MARKET_MATERIALS, buyQuote } from '../src/core/market'
import { lowMorale } from '../src/core/morale'
import { nestRevealed, seasonKey } from '../src/core/nest'
import { currentRaid, raidBoss, raidWeek } from '../src/core/raid'
import { gatherLeft } from '../src/core/tavern'
import { ESSENCES, freshVault, specialBlock, type Vault, type VaultKey } from '../src/core/trials'
import type { Hero, PotionId } from '../src/core/types'
import { skillChoices } from './curve'

const minute = 60_000
const hour = 60 * minute
const day = 24 * hour
const start = 1_700_000_000_000

const sources: Record<MaterialName, string> = {
  wood: 'hill_cave', stone: 'moss_path', iron: 'abandoned_mine', bone: 'barrow', herb: 'moss_path', crystal: 'sunken_crypt',
}
const priority: BuildingId[] = ['guild', 'market', 'smith', 'house', 'alchemy', 'tavern', 'training', 'magic', 'school', 'legends', 'inn', 'fountain', 'temple', 'hall']
const route = [...dungeons].sort((a, b) => a.tier - b.tier || a.recommendedLevel - b.recommendedLevel)
const blockedTypes = ['gold', 'materials', 'fame', 'guild record', 'idle', 'routine only', 'morale', 'fatigue', 'injury', 'overlap', 'gold surplus', 'material surplus'] as const
type Block = typeof blockedTypes[number]
type Cost = { gold: number } & Partial<Record<MaterialName | VaultKey, number>>
export const vaultKeys = [...ESSENCES, 'abyss', 'scale', 'crown', 'core', 'valor', 'token'] as const
export const lateResources = ['gold', ...MARKET_MATERIALS, ...vaultKeys] as const
type LateResource = typeof lateResources[number]
type ResourceAmounts = Partial<Record<LateResource, number>>
const stock = (state: GameState) => ({ gold: state.gold, ...state.materials, ...state.vault })
const trials = specialDungeons.filter((entry) => entry.special === 'weekday')
const hurt = (hero: Hero) => hero.condition === 'injured' || hero.condition === 'critical'
const roleRank = (hero: Hero) => ({ tank: 0, healer: 1, dps: 2, support: 3 })[classById(hero.classId).role]

type RaidWeekSample = { week: string; boss: string; openedAt: number; departures: number; killedAt?: number }

export function simulateVillage(seed: number, days: number, stopAtTown?: number, lateGame = false, raidAndInvasion = false, postTownDays = 0) {
  let state = freshState(seed, start)
  let now = start
  let acted = false
  let substantive = false
  let onlineMs = 0
  let progressionMs = 0
  let offlineMs = 0
  let manualRuns = 0
  let autoRuns = 0
  let queued = 0
  let bought = 0
  let gatherings = 0
  let festivals = 0
  const times: Record<string, number> = {}
  const totals: Partial<Record<Block, number>> = {}
  const beforeSeven: Partial<Record<Block, number>> = {}
  const streaks: Partial<Record<Block, number>> = {}
  const longest: Partial<Record<Block, number>> = {}
  const materialWait: Partial<Record<MaterialName, number>> = {}
  const failures = new Map<string, { count: number; retryLevel: number }>()
  let processed: string | undefined
  let previousHistory = state.history
  let priorLevel = 1
  let fastUnlocks = 0
  let peakUnlocks = 0
  let lastLevelAt = start
  const income = freshVault()
  const spending = { promote: freshVault(), build: freshVault(), craft: freshVault() }
  const promotionWait: Record<number, { fame: number; depth: number; offering: number; raid: number; invasion: number } | undefined> = {}
  const specialRuns = { trials: 0, abyss: 0, raid: 0 }
  const raidWeeks = new Map<string, RaidWeekSample>()
  const invasions: { round: number; won: boolean; waves: number; goldLost: number; materialsLost: Record<MaterialName, number>; valor: number }[] = []
  let abyssRetryAt = start
  let raidRetryAt = start
  let lateStart: number | undefined
  let lateInitial: ReturnType<typeof stock> | undefined
  const lateIncome: ResourceAmounts = {}
  const lateSpent: ResourceAmounts = {}
  const purchases: Record<string, number> = {}
  const enhancements = new Map<string, { recipe: string; initial: number; best: number; attempts: number; spent: ResourceAmounts; expected: ResourceAmounts; planned: Set<number> }>()
  const raidTiers = new Map<string, { tier: number; won: boolean }>()
  const lateActivity = { minutes: 0, routine: 0, surplus: 0, eventRuns: 0 }
  const nextPromotion = () => endgameRules.promotions.find(({ level }) => level === state.promoted + 1)
  const vaultShort = (cost: Partial<Vault>) => vaultKeys.some((key) => state.vault[key] < (cost[key] ?? 0))
  function raidSample(week: string) {
    const earlier = raidWeeks.get(week)
    if (earlier) return earlier
    const sample = { week, boss: raidBoss(week).id, openedAt: now, departures: 0 }
    raidWeeks.set(week, sample)
    return sample
  }
  const mark = (key: string, timestamp = now) => { times[key] ??= (timestamp - start) / hour }
  const cast = (action: GameAction) => {
    const next = reduce(state, action)
    if (next.notice) return false
    if (lateGame && (action.type === 'promote' || action.type === 'build' || action.type === 'craft')) {
      for (const key of vaultKeys) spending[action.type][key] += state.vault[key] - next.vault[key]
    }
    trackLate(next)
    state = next
    acted = true
    if (action.type !== 'wish') substantive = true
    return true
  }
  function trackLate(next: GameState) {
    if (lateStart == null) return
    // Some automatic payments and rewards settle in the same reducer call.
    // Their net movement is observable, but their gross amounts are not.
    const before = stock(state)
    const after = stock(next)
    for (const key of lateResources) {
      const delta = after[key] - before[key]
      if (delta > 0) lateIncome[key] = (lateIncome[key] ?? 0) + delta
      if (delta < 0) lateSpent[key] = (lateSpent[key] ?? 0) - delta
    }
  }

  function lateProjects() {
    cast({ type: 'prosper' })
    for (const def of endgameRules.monuments.list) {
      const id = def.id as MonumentId
      const cost = monumentCost(id, monumentStage(state, id) + 1)
      if (!cost || vaultShort(cost)) continue
      buyMissing({ ...cost, gold: cost.gold ?? 0 })
      cast({ type: 'raiseMonument', id })
    }
    for (const item of [...eventShop(state)].sort((a, b) => {
      const score = (item: typeof a) => item.gear ? 3 : item.vault ? 2 : item.materials ? 1 : 0
      return score(b) - score(a)
    })) {
      if (item.gear && item.left > 0 && state.vault.token < item.cost) break
      for (let left = item.left; left > 0 && state.vault.token >= item.cost; left -= 1) {
        if (!cast({ type: 'buyEvent', itemId: item.id })) break
        purchases[item.id] = (purchases[item.id] ?? 0) + 1
      }
    }
  }

  function lateEnhance() {
    if (state.smith || state.buildings.smith < 1 || state.automation.queues.smith.length) return
    const busy = busyHeroIds(state)
    const items = [...state.stash.map((gear) => ({ gear, hero: undefined as Hero | undefined })),
      ...state.roster.filter((hero) => canDeploy(hero) && !busy.has(hero.id)).flatMap((hero) => hero.gear.map((gear) => ({ gear, hero })))]
      .filter(({ gear }) => gear.slot !== 'trinket' && enhanceLimit(gear) > smithRules.enhanceMax)
      .sort((a, b) => Number(b.gear.grade === 'legend') - Number(a.gear.grade === 'legend') || b.gear.enhance - a.gear.enhance)
    for (const slot of ['weapon', 'armor'] as const) {
      const candidate = items.find(({ gear }) => gear.slot === slot)
      if (!candidate) continue
      const { gear, hero } = candidate
      if (gear.enhance >= enhanceLimit(gear)) continue
      const cost = enhanceCostFor(gear)
      if (vaultShort(cost)) continue
      buyMissing(cost)
      if (state.gold < cost.gold || state.materials.iron < cost.iron) continue
      if (hero && !cast({ type: 'unequip', heroId: hero.id, slot, gearId: gear.id })) continue
      if (!cast({ type: 'enhance', gearId: gear.id, now })) continue
      const sample = enhancements.get(gear.id) ?? { recipe: gear.recipeId, initial: gear.enhance, best: gear.enhance, attempts: 0, spent: {}, expected: {}, planned: new Set<number>() }
      const table = smithRules.successByLevel
      const base = smithRules.lateEnhance.chance[gear.enhance - smithRules.enhanceMax] ?? table[Math.min(state.buildings.smith, table.length - 1)] ?? 0
      const chance = Math.min(1, base + retireeBonus(state, 'smith'))
      sample.attempts += 1
      for (const key of lateResources) {
        const amount = cost[key] ?? 0
        if (!amount) continue
        sample.spent[key] = (sample.spent[key] ?? 0) + amount
        if (!sample.planned.has(gear.enhance) && chance > 0) sample.expected[key] = (sample.expected[key] ?? 0) + amount / chance
      }
      sample.planned.add(gear.enhance)
      enhancements.set(gear.id, sample)
      return
    }
  }
  function record() {
    const level = townLevelOf(state).level
    if (raidAndInvasion && level >= endgameRules.raid.unlockTown) raidSample(raidWeek(now))
    if (level > priorLevel) {
      for (let reached = priorLevel + 1; reached <= level; reached += 1) {
        mark(`town ${reached}`)
        const unlocked = villageRules.buildings.filter(({ unlockLevel }) => unlockLevel === reached).length
        peakUnlocks = Math.max(peakUnlocks, unlocked)
        if (now - lastLevelAt <= 15 * minute) fastUnlocks += unlocked
        lastLevelAt = now
      }
      priorLevel = level
    }
    for (const building of villageRules.buildings) {
      const id = building.id as BuildingId
      if (state.buildings[id] >= 1) mark(`${id} first`)
      if (state.buildings[id] >= building.levels.at(-1)!.level) mark(`${id} max`)
    }
    if (previousHistory !== state.history) {
      previousHistory = state.history
      for (const report of [...state.history].reverse()) {
        const dungeon = dungeons.find(({ id }) => id === report.dungeonId)
        if (report.victory && dungeon) mark(`tier ${dungeon.tier}`, report.finishedAt ?? now)
      }
    }
    if (state.roster.some(({ spouseId }) => spouseId)) mark('marriage')
    if (state.roster.some(({ parents }) => parents)) mark('birth')
    if (state.comingOfAge.length) mark('coming of age')
    if (state.retirees.length) mark('retirement')
    if (state.roster.some(isLegend) || state.retirees.some(({ hero }) => isLegend(hero)) || state.graveyard.some(({ legend }) => legend)) mark('legend qualification')
    if (state.graveyard.some(({ legend }) => legend) || (state.buildings.legends > 0 && state.retirees.some(({ hero }) => isLegend(hero)))) mark('hall legend')
  }
  function buyMissing(cost: Cost) {
    if (state.buildings.market === 0) return
    for (const material of MARKET_MATERIALS) {
      const missing = Math.min(marketRules.maxTrade, (cost[material] ?? 0) - state.materials[material])
      if (missing <= 0 || state.gold < cost.gold + buyQuote(state, material, missing)) continue
      const before = state.gold
      if (cast({ type: 'trade', material, amount: missing })) bought += before - state.gold
    }
  }
  function prepareParty() {
    if (state.expeditions.length) return
    const busy = busyHeroIds(state)
    const eligible = state.roster.filter((hero) => canDeploy(hero) && !busy.has(hero.id))
      .sort((a, b) => b.level - a.level)
    const tank = eligible.find((hero) => roleRank(hero) === 0)
    const healer = eligible.find((hero) => roleRank(hero) === 1)
    const ordered = [...new Set([tank, healer, ...eligible])].filter((hero): hero is Hero => hero != null).slice(0, combatRules.maxParty)
    const current = presetById(state, state.presetId)?.slots ?? []
    if (current.length === ordered.length && current.every(({ id }) => ordered.some((hero) => hero.id === id))) return
    for (const slot of current) state = reduce(state, { type: 'remove', id: slot.id })
    for (const hero of ordered) state = reduce(state, { type: 'add', id: hero.id })
  }
  function party() {
    const ids = new Set(presetById(state, state.presetId)?.slots.map(({ id }) => id))
    return state.roster.filter((hero) => ids.has(hero.id) && canDeploy(hero))
  }
  function upkeep() {
    while (fountainWishes(state, now) > 0) if (!cast({ type: 'wish', now })) break
    for (const proposal of state.proposals) cast({ type: 'acceptProposal', a: proposal.a, b: proposal.b, now })
    const adults = state.roster.filter((hero) => !isChild(hero) && hero.condition !== 'dead')
    const goal = Math.min(state.buildings.house > 1 ? 7 : 5, bedCount(state.buildings.house))
    for (const hero of [...state.visitors].sort((a, b) => roleRank(a) - roleRank(b))) {
      const lackingRole = roleRank(hero) <= 1 && !state.roster.some((member) => canDeploy(member) && roleRank(member) === roleRank(hero))
      if ((!lackingRole && state.roster.filter(canDeploy).length >= goal) || bedsTaken(state) >= bedCount(state.buildings.house) - Number(state.buildings.house > 1)) continue
      if (state.gold >= progression.hireCost) cast({ type: 'hire', id: hero.id, now })
    }
    const busy = busyHeroIds(state)
    for (const hero of state.roster) {
      if (hero.condition === 'dead' && hero.deaths === 1 && hero.resurrectAt == null) cast({ type: 'revive', id: hero.id, now })
      if (busy.has(hero.id) || !canDeploy(hero)) continue
      for (const id of skillChoices(hero.classId, 'recommended').filter((id) => !hero.learned.includes(id)).slice(0, hero.skillPoints)) {
        cast({ type: 'learn', id: hero.id, skillId: id })
      }
    }
    const candidate = adults.find((hero) => hero.age >= retirementRules.minAge && isLegend(hero) && !busy.has(hero.id) && adults.length >= 6
      && (roleRank(hero) > 1 || adults.some((other) => other.id !== hero.id && roleRank(other) === roleRank(hero))))
    if (candidate && cast({ type: 'retire', id: candidate.id })) {
      const post = (['house', 'guild', 'hall', 'tavern', 'school', 'legends'] as const).find((id) => state.buildings[id] > 0 && !state.retirees.some(({ building }) => building === id))
      if (post) cast({ type: 'assignRetiree', id: candidate.id, building: post })
    }
    if (state.comingOfAge.length) {
      mark('coming of age')
      state = reduce(state, { type: 'seenAdults' })
    }
    if (state.buildings.school > 0) for (const child of state.roster) {
      if (isChild(child) && child.age >= schoolRules.minAge && !child.school && state.gold >= 60) {
        cast({ type: 'enroll', heroId: child.id, focus: 'vit', career: null })
      }
    }
    const holding = raidAndInvasion && warned(state, now)
    if (holding) {
      if (state.automation.drill) cast({ type: 'automation', drill: false })
      if (state.auto.enabled) cast({ type: 'auto', enabled: false })
    } else {
      if (state.buildings.training > 0 && !state.automation.drill && state.gold >= 100) cast({ type: 'automation', drill: true })
      if (now - start >= hour && state.buildings.guild > 0 && !state.auto.enabled) cast({ type: 'auto', enabled: true })
    }
    while (guideStatus(state).done) if (!cast({ type: 'claimGuide' })) break
    if (state.festival?.season !== seasonKey(state.calendar) && state.gold >= festivalCost(state) + 100 && state.roster.length >= 3 && cast({ type: 'festival' })) festivals += 1
    if (gatherLeft(state) && state.gold >= 100) {
      const participants = state.roster.filter((hero) => canDeploy(hero) && !busy.has(hero.id) && hero.fatigue < 45)
      const partners = participants.flatMap((hero) => {
        const partner = participants.find((other) => other.id === hero.spouseId)
        return partner ? [hero, partner] : []
      })
      const round = partners.length ? partners.slice(0, 2) : participants.slice(0, 3)
      if (round.length >= 2 && cast({ type: 'gather', heroIds: round.map(({ id }) => id) })) gatherings += 1
    }
    const display = state.stash.find(({ heirloom }) => heirloom)
    if (display && state.buildings.legends > 0 && (state.shrine?.gear.length ?? 0) < state.buildings.legends * 2) cast({ type: 'enshrine', gearId: display.id })
  }
  function projects(blocks: Set<Block>) {
    if (state.construction) return undefined
    const level = townLevelOf(state)
    const available = priority.flatMap((id) => {
      const building = villageRules.buildings.find((entry) => entry.id === id)!
      const next = building.levels.find(({ level: target }) => target === state.buildings[id] + 1)
      return next ? [{ id, building, next }] : []
    })
    const options = available.filter(({ id, building, next }) => building.unlockLevel <= level.level
      && (!lateGame || (state.buildings[id] < level.maxBuildingLevel && (next.town ?? 0) <= level.level)))
      .sort((a, b) => Number(state.buildings[a.id] > 0) - Number(state.buildings[b.id] > 0) || state.buildings[a.id] - state.buildings[b.id])
    if (available.length > 0 && options.length === 0) blocks.add('fame')
    let shortage: MaterialName | undefined
    for (const { id, next } of options) {
      if (id === 'guild' && (state.guild?.record ?? 0) < (guildRules.levels[state.buildings.guild + 1]?.record ?? 0)) {
        blocks.add('guild record')
        continue
      }
      if (lateGame && vaultShort(next as Cost)) continue
      buyMissing(next)
      const material = MARKET_MATERIALS.find((key) => state.materials[key] < ((next as Cost)[key] ?? 0))
      if (state.gold < next.gold) blocks.add('gold')
      if (material) { blocks.add('materials'); shortage ??= material }
      if (!material && state.gold >= next.gold && cast({ type: 'build', id, now })) {
        blocks.delete('gold')
        blocks.delete('materials')
        return undefined
      }
    }
    return shortage
  }
  function workshops() {
    if (state.buildings.alchemy > 0) {
      for (const recipe of alchemyRules.potions) {
        const id = recipe.id as PotionId
        if (recipe.alchemyLevel <= state.buildings.alchemy && !state.automation.potions[id]) cast({ type: 'potionTarget', potionId: id, count: id === 'heal' || id === 'antidote' ? 6 : 2 })
      }
      const potion = alchemyRules.potions.find(({ id, alchemyLevel }) => alchemyLevel <= state.buildings.alchemy
        && (state.potions[id as PotionId] ?? 0) < 2 && state.alchemy?.potionId !== id && !state.automation.queues.alchemy.includes(id as PotionId))
      if (potion && state.gold >= 100 && state.automation.queues.alchemy.length < state.buildings.alchemy) {
        buyMissing(potion)
        if (state.alchemy && cast({ type: 'brew', potionId: potion.id as PotionId, now })) queued += 1
      }
    }
    if (state.gold < 80) return
    const members = party()
    const keys = ['weapon', 'armor'] as const
    const worn = state.roster.flatMap(({ gear }) => gear)
    for (const slot of keys) {
      const recipe = [...smithRules.recipes].reverse().find((entry) => entry.slot === slot && entry.smithLevel <= state.buildings.smith)
      if (!recipe || worn.filter(({ recipeId }) => recipeId === recipe.id).length + state.stash.filter(({ recipeId }) => recipeId === recipe.id).length
        + Number(state.smith?.recipeId === recipe.id) + state.automation.queues.smith.filter((id) => id === recipe.id).length >= Math.min(3, members.length)) continue
      if (state.automation.queues.smith.length >= state.buildings.smith) continue
      if (lateGame && (vaultShort(recipe as Cost) || (recipe.smithLevel >= 4 && state.smith))) continue
      buyMissing(recipe)
      const waiting = state.smith != null
      if (cast({ type: 'craft', recipeId: recipe.id, now }) && waiting) queued += 1
    }
    if (state.buildings.magic > 0 && !state.stash.some(({ slot }) => slot === 'trinket') && !worn.some(({ slot }) => slot === 'trinket') && !state.magic) {
      const recipe = magicRules.trinkets.find(({ magicLevel }) => magicLevel <= state.buildings.magic)
      if (recipe) {
        buyMissing(recipe)
        cast({ type: 'enchant', trinketId: recipe.id, now })
      }
    }
    const busy = busyHeroIds(state)
    for (const member of members.filter((hero) => !busy.has(hero.id))) {
      for (const item of state.stash) {
        if (item.slot === 'trinket') {
          if (!member.gear.some(({ slot }) => slot === 'trinket')) cast({ type: 'equip', heroId: member.id, gearId: item.id })
          break
        }
        const current = member.gear.find(({ slot }) => slot === item.slot)
        const grade = gearMods(item)
        const worn = current ? gearMods(current) : { attack: 0, defense: 0 }
        if (grade.attack + grade.defense > worn.attack + worn.defense) {
          cast({ type: 'equip', heroId: member.id, gearId: item.id })
          break
        }
      }
    }
  }
  function tryPromotion(step: number) {
    if (townLevelOf(state).level < 7) return
    const rule = nextPromotion()
    if (!rule) return
    const wait = promotionWait[rule.level] ??= { fame: 0, depth: 0, offering: 0, raid: 0, invasion: 0 }
    const fame = state.fame < villageRules.levels.find(({ level }) => level === rule.level)!.fame
    const depth = state.abyss.best < rule.abyssBest
    const offering = vaultShort(rule.offering)
    const raid = state.raidKills < (rule.raidKills ?? 0)
    const invasion = (state.invasion?.wins ?? 0) < (rule.invasionWins ?? 0)
    if (fame) wait.fame += step
    if (depth) wait.depth += step
    if (offering) wait.offering += step
    if (raid) wait.raid += step
    if (invasion) wait.invasion += step
    if (!fame && !depth && !offering && !raid && !invasion) cast({ type: 'promote' })
  }

  function prepareDefenders() {
    const invasion = state.invasion
    if (!invasion) return
    const main = presetById(state, state.presetId)
    if (!main) return
    const assigned = new Set(main.slots.map(({ id }) => id))
    const reserves = state.roster.filter((hero) => canDeploy(hero) && !assigned.has(hero.id))
      .sort((a, b) => b.level - a.level)
    const backups = state.presets.filter(({ id }) => id !== main.id).slice(0, endgameRules.invasion.maxDefenders - 1)
    for (const [index, backup] of backups.entries()) {
      const heroes = reserves.filter((_, member) => member % backups.length === index).slice(0, combatRules.maxParty)
      if (backup.slots.length === heroes.length && backup.slots.every(({ id }) => heroes.some((hero) => hero.id === id))) continue
      for (const slot of backup.slots) state = reduce(state, { type: 'remove', id: slot.id, presetId: backup.id })
      for (const hero of heroes) state = reduce(state, { type: 'add', id: hero.id, presetId: backup.id })
    }
    const ids = [main.id, ...backups.map(({ id }) => id)]
    if (ids.length !== invasion.defenders.length || ids.some((id, index) => id !== invasion.defenders[index])) {
      cast({ type: 'defend', presetIds: ids })
    }
  }

  function specialExpedition(members: Hero[], strength: number) {
    if (members.length < 3 || members.some(({ fatigue }) => fatigue >= lifeRules.fatigue.tiredAt)
      || !members.some((hero) => roleRank(hero) === 0) || !members.some((hero) => roleRank(hero) === 1)) return false
    const offering = nextPromotion()?.offering
    const trial = trials.filter(({ id }) => !specialBlock(state, id, now))
      .sort((a, b) => Number(b.recommendedLevel <= strength) - Number(a.recommendedLevel <= strength)
        || (a.recommendedLevel <= strength ? b.recommendedLevel - a.recommendedLevel : a.recommendedLevel - b.recommendedLevel)
        || ((offering?.[b.element!] ?? 0) - state.vault[b.element!]) - ((offering?.[a.element!] ?? 0) - state.vault[a.element!]))[0]
    const raid = raidAndInvasion && now >= raidRetryAt && dungeonUnlocked(state, 'raid') && !currentRaid(state, now).killed
    const event = lateStart != null && eventRunsLeft(state) > 0 ? eventDungeonId(state) : undefined
    const target = raid ? 'raid' : trial?.id ?? event ?? (now >= abyssRetryAt && !specialBlock(state, 'abyss', now) ? 'abyss' : undefined)
    if (!target) return false
    state = reduce(state, { type: 'dungeon', id: target })
    const preset = presetById(state, state.presetId)!
    if (preset.tactics.blast !== 'interrupt') state = reduce(state, { type: 'tactics', tactics: { ...preset.tactics, blast: 'interrupt' } })
    for (const id of ['heal', 'tonic', 'clarity', 'antidote'] as const) {
      const count = id === 'antidote' ? 0 : 2
      if ((preset.supplies?.[id] ?? 0) !== count) state = reduce(state, { type: 'supplies', potionId: id, count })
    }
    if (!cast({ type: 'depart', presetId: state.presetId, confirm: true, now })) return false
    if (raid) {
      specialRuns.raid += 1
      const trip = state.expeditions.at(-1)!
      const progress = trip.raid!
      raidSample(progress.week).departures += 1
      if (progress.left == null || progress.left >= (progress.start ?? progress.max ?? 0)) raidRetryAt = trip.returnAt + 2 * hour
    } else if (trial) specialRuns.trials += 1
    else if (event) lateActivity.eventRuns += 1
    else {
      specialRuns.abyss += 1
      const trip = state.expeditions.at(-1)!
      if ((trip.abyssFrom ?? state.abyss.checkpoint) + trip.report.floorsCleared <= state.abyss.best) abyssRetryAt = trip.returnAt + 2 * hour
    }
    return true
  }

  function expedition(blocks: Set<Block>, shortage?: MaterialName) {
    if (raidAndInvasion && warned(state, now)) return
    const members = party()
    const strength = members.length ? members.reduce((sum, hero) => sum + hero.level, 0) / members.length : 0
    const mainReport = state.history[0]
    if (mainReport?.dungeonId && mainReport.finishedAt != null) {
      const key = `${mainReport.dungeonId}:${mainReport.finishedAt}`
      if (key !== processed) {
        processed = key
        const loss = failures.get(mainReport.dungeonId)
        if (!mainReport.victory) failures.set(mainReport.dungeonId, { count: (loss?.count ?? 0) + 1, retryLevel: strength + 1 })
        else failures.delete(mainReport.dungeonId)
      }
    }
    if (state.expeditions.length > 0) return
    if (members.some(hurt)) blocks.add('injury')
    const autoExpected = state.auto.enabled && state.cleared.includes(state.auto.dungeonId)
    const ableAuto = members.filter((hero) => !hurt(hero) && hero.fatigue < lifeRules.fatigue.tiredAt)
    if (autoExpected && ableAuto.length > 0 && ableAuto.every(lowMorale)) blocks.add('morale')
    if (members.some(({ fatigue }) => fatigue >= lifeRules.fatigue.exhaustedAt)
      || (autoExpected && members.some((hero) => !hurt(hero)) && ableAuto.length === 0)) blocks.add('fatigue')
    if (members.length === 0 || members.some(hurt) || members.some(({ fatigue }) => fatigue >= lifeRules.fatigue.exhaustedAt)) return
    const viable = route.filter((dungeon) => dungeonUnlocked(state, dungeon.id) && strength >= dungeon.recommendedLevel
      && strength >= (failures.get(dungeon.id)?.retryLevel ?? 0))
    const next = viable.find(({ id }) => !state.cleared.includes(id) && (members.length >= 3 || id === 'hill_cave'))
    const board = [...(state.guild?.seasonal ?? []), state.guild?.repeat].filter((contract) => contract && !contract.done)
    for (const contract of board) {
      if (contract?.kind === 'deliver' && contract.material && state.materials[contract.material] >= contract.need - contract.progress + 12) cast({ type: 'deliver', contractId: contract.id })
    }
    if (lateGame && specialExpedition(members, strength)) {
      blocks.delete('morale')
      blocks.delete('fatigue')
      return
    }
    const contract = board.find((entry) => entry?.kind === 'clear' && entry.dungeonId && viable.some(({ id }) => id === entry.dungeonId))
    const fallback = [...viable].reverse().find(({ id, tier }) => state.cleared.includes(id) && tier <= 3)?.id ?? 'hill_cave'
    const gather = shortage && dungeonUnlocked(state, sources[shortage]) ? sources[shortage] : undefined
    const preferProgress = manualRuns % 3 !== 2
    let target = (preferProgress ? next?.id : gather ?? contract?.dungeonId) ?? next?.id ?? gather ?? contract?.dungeonId ?? fallback
    if (target === 'dragon_nest' && !nestRevealed(state) && !cast({ type: 'buyIntel' })) target = fallback
    if (now - start >= hour && state.cleared.includes('hill_cave')) {
      const autoTarget = gather && state.cleared.includes(gather) && viable.some(({ id }) => id === gather) ? gather : fallback
      if (state.auto.dungeonId !== autoTarget) state = reduce(state, { type: 'autoDungeon', id: autoTarget })
      // With the campaign cleared, the player leaves routine farming to auto.
      if (state.cleared.length >= route.length && !gather && !contract?.dungeonId) return
    }
    if (target !== state.dungeonId) state = reduce(state, { type: 'dungeon', id: target })
    const dungeon = route.find(({ id }) => id === target)!
    const preset = presetById(state, state.presetId)
    if (dungeon.tier >= 4 && preset && preset.tactics.blast !== 'interrupt') {
      state = reduce(state, { type: 'tactics', tactics: { ...preset.tactics, blast: 'interrupt' } })
    }
    const supplies = target === 'venom_marsh' ? { heal: 2, antidote: 4 } : dungeon.tier >= 5 ? { heal: 2, tonic: 2, clarity: 2 } : {}
    for (const id of ['heal', 'antidote', 'tonic', 'clarity'] as const) {
      const count = supplies[id] ?? 0
      if ((preset?.supplies?.[id] ?? 0) !== count) state = reduce(state, { type: 'supplies', potionId: id, count })
    }
    if (cast({ type: 'depart', presetId: state.presetId, confirm: true, now })) manualRuns += 1
    // A status is an actual stop only if no manual trip goes out this check.
    if (state.expeditions.length > 0) {
      blocks.delete('morale')
      blocks.delete('fatigue')
    }
  }

  while (true) {
    record()
    const endAt = lateStart == null ? start + days * day : lateStart + postTownDays * day
    if (now >= endAt || (stopAtTown != null && townLevelOf(state).level >= stopAtTown)) break
    const elapsed = now - start
    const sinceDay = elapsed % day
    const offline = sinceDay === 16 * hour
    const cadence = offline ? 8 * hour : Math.min(elapsed < hour ? 15_000 : elapsed < day ? 3 * minute : 10 * minute, 16 * hour - sinceDay)
    const step = Math.min(cadence, endAt - now)
    if (!offline) {
      const progressing = townLevelOf(state).level < 7
      acted = false
      substantive = false
      const blocks = new Set<Block>()
      upkeep()
      prepareParty()
      if (raidAndInvasion) prepareDefenders()
      if (lateGame) tryPromotion(step)
      if (postTownDays > 0 && lateStart == null && townLevelOf(state).level >= 10) {
        lateStart = now
        lateInitial = stock(state)
      }
      if (lateStart != null) {
        const raid = currentRaid(state, now)
        const key = `${raid.week}:${raid.tier}`
        if (!raid.killed && !raidTiers.has(key)) raidTiers.set(key, { tier: raid.tier, won: false })
        lateProjects()
        lateEnhance()
      }
      const short = projects(blocks)
      workshops()
      expedition(blocks, short)
      if (!acted) blocks.add('idle')
      if (acted && !substantive) blocks.add('routine only')
      if (state.gold >= 1000) blocks.add('gold surplus')
      if (MARKET_MATERIALS.filter((id) => state.materials[id] >= 100).length >= 3) blocks.add('material surplus')
      if (lateStart != null) {
        lateActivity.minutes += step / minute
        if (blocks.has('routine only')) lateActivity.routine += step / minute
        if (blocks.has('material surplus')) lateActivity.surplus += step / minute
      }
      if (['morale', 'fatigue', 'injury'].filter((kind) => blocks.has(kind as Block)).length > 1) blocks.add('overlap')
      onlineMs += step
      if (progressing) progressionMs += step
      if (short) materialWait[short] = (materialWait[short] ?? 0) + step
      for (const kind of blockedTypes) {
        const add = blocks.has(kind) ? step : 0
        totals[kind] = (totals[kind] ?? 0) + add
        if (progressing) beforeSeven[kind] = (beforeSeven[kind] ?? 0) + add
        streaks[kind] = add ? (streaks[kind] ?? 0) + add : 0
        longest[kind] = Math.max(longest[kind] ?? 0, streaks[kind]!)
      }
    } else {
      offlineMs += step
      for (const kind of blockedTypes) streaks[kind] = 0
    }
    const nonce = state.auto.nonce ?? 0
    const due = state.invasion?.nextAt
    const end = now + step
    if (raidAndInvasion && due != null && now < due && due <= end) {
      // Settle events strictly before the invasion so returns and production
      // before the defence are not confused with its losses.
      if (due - 1 > now) {
        const before = reduce(state, { type: 'catchUp', now: due - 1 })
        trackSettlement(before)
        state = before
      }
      const next = reduce(state, { type: 'catchUp', now: due })
      const last = next.invasion?.last
      if (last?.at === due) {
        // Only gold is persisted in the result. Compare the same 1 ms tick
        // with the invasion deferred to estimate each lost material.
        const without = last.won ? next : reduce({ ...state, invasion: { ...state.invasion!, nextAt: due + hour } }, { type: 'catchUp', now: due })
        const materialsLost = Object.fromEntries(MARKET_MATERIALS.map((key) => [key, without.materials[key] - next.materials[key]])) as Record<MaterialName, number>
        invasions.push({ round: next.invasion!.count, won: last.won, waves: last.waves, goldLost: last.lost?.gold ?? 0, materialsLost, valor: next.vault.valor - state.vault.valor })
      }
      trackSettlement(next)
      state = next
    }
    now = end
    const next = reduce(state, { type: 'catchUp', now })
    trackSettlement(next)
    state = next
    autoRuns += (state.auto.nonce ?? 0) - nonce
  }
  function trackSettlement(next: GameState) {
    trackLate(next)
    if (lateGame) for (const key of vaultKeys) income[key] += next.vault[key] - state.vault[key]
    if (raidAndInvasion && next.raidKills > state.raidKills && next.raid) {
      const sample = raidWeeks.get(next.raid.week)
      if (sample) sample.killedAt ??= next.history.find((report) => report.dungeonId === 'raid' && Object.values(report.gained?.vault ?? {}).some((amount) => amount > 0))?.finishedAt ?? next.lastTickAt
      if (lateStart != null) {
        const tier = next.raid.killed ? next.raid.tier : next.raid.tier - 1
        raidTiers.set(`${next.raid.week}:${tier}`, { tier, won: true })
      }
    }
    const gear = state.smith?.kind === 'enhance' ? state.smith.gear : null
    const sample = gear ? enhancements.get(gear.id) : undefined
    if (sample && gear) sample.best = Math.max(sample.best, next.stash.find(({ id }) => id === gear.id)?.enhance ?? 0)
  }
  return { state, times, totals, beforeSeven, longest, materialWait, onlineMs, progressionMs, offlineMs, manualRuns, autoRuns, queued, bought, gatherings, festivals, fame: state.fame, gold: state.gold, cleared: state.cleared.length, peakUnlocks, fastUnlocks, income, spending, promotionWait, specialRuns, raidWeeks: [...raidWeeks.values()], invasions, late: lateStart == null ? undefined : {
    startDay: (lateStart - start) / day, initial: lateInitial!, final: stock(state), income: lateIncome, spent: lateSpent,
    purchases, enhancements: [...enhancements.values()], tiers: [...raidTiers.values()], activity: lateActivity,
  } }
}

export function villageCheckpoint(seed: number, level: number): GameState | null {
  const { state } = simulateVillage(seed, 2, level)
  return townLevelOf(state).level >= level ? state : null
}

function stats(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b)
  const rounded = (value: number) => Number(value.toFixed(2))
  return sorted.length ? [rounded((sorted[Math.floor((sorted.length - 1) / 2)]! + sorted[Math.floor(sorted.length / 2)]!) / 2), rounded(sorted[0]!), rounded(sorted.at(-1)!)] : ['—', '—', '—']
}

export function printVillageBalance(days: number, seedCount: number) {
  if (!Number.isSafeInteger(days) || days < 1 || !Number.isSafeInteger(seedCount) || seedCount < 1) {
    throw new Error('Usage: npx tsx tools/village-balance.ts [positive integer days] [positive integer seeds]')
  }
  const runs = Array.from({ length: seedCount }, (_, index) => simulateVillage(index + 1, days))
  const milestone = (goal: string) => {
    const samples = runs.flatMap(({ times }) => times[goal] == null ? [] : [times[goal]!])
    const [median, min, max] = stats(samples)
    return { goal, reached: `${samples.length}/${runs.length}`, median, min, max }
  }
  console.log(`Seeds 1–${seedCount}; ${days} game days; 8h offline each day. Milestones are elapsed hours, censored at the horizon.`)
  console.table(Array.from({ length: 6 }, (_, index) => milestone(`town ${index + 2}`)))
  console.table(priority.flatMap((id) => [milestone(`${id} first`), milestone(`${id} max`)]))
  console.table(Array.from({ length: 7 }, (_, index) => milestone(`tier ${index + 1}`)))
  console.table(['marriage', 'birth', 'coming of age', 'retirement', 'legend qualification', 'hall legend'].map(milestone))
  console.table(blockedTypes.map((kind) => {
    const [median, min, max] = stats(runs.map((run) => 100 * (run.totals[kind] ?? 0) / run.onlineMs))
    const [longestMedian, , longestMax] = stats(runs.map((run) => (run.longest[kind] ?? 0) / minute))
    const [early] = stats(runs.map((run) => 100 * (run.beforeSeven[kind] ?? 0) / run.progressionMs))
    return { kind, 'before Lv7 % median': early, 'online % median': median, min, max, 'longest minutes median': longestMedian, 'longest minutes max': longestMax }
  }))
  console.table(MARKET_MATERIALS.map((material) => {
    const [median, min, max] = stats(runs.map((run) => (run.materialWait[material] ?? 0) / hour))
    return { material, 'first shortage hours median': median, min, max }
  }))
  console.table((['onlineMs', 'offlineMs', 'manualRuns', 'autoRuns', 'queued', 'bought', 'gatherings', 'festivals', 'fame', 'gold', 'cleared', 'peakUnlocks', 'fastUnlocks'] as const).map((key) => {
    const [median, min, max] = stats(runs.map((entry) => key.endsWith('Ms') ? entry[key] / hour : entry[key]))
    return { key, median, min, max }
  }))
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  printVillageBalance(Number(process.argv[2] ?? 32), Number(process.argv[3] ?? 20))
}
