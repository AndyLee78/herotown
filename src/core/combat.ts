import { alchemyRules, classById, combatRules, lifeRules, monsterById, potionById } from './data'
import { heroGearMods } from './gear'
import type { Rng } from './rng'
import type { LogEntry, MonsterDef, PartyMember, PotionId, ReplayUnit, Row, Supplies, Tactics, UnitReport } from './types'

export type BattleUnit = {
  id: string
  refId: string
  name: string
  nameKey: string
  index: number
  side: 'hero' | 'enemy'
  row: Row
  reach: 'melee' | 'ranged'
  role: 'tank' | 'dps' | 'healer' | 'support'
  boss: boolean
  aoe: boolean
  hasBuff: boolean
  hasDebuff: boolean
  hp: number
  maxHp: number
  attack: number
  defense: number
  heal: number
  speed: number
  gauge: number
  threat: number
  dot: number
  dotOnHit: number
  buffed: boolean
  debuffed: boolean
  opened: boolean
  dealt: number
  taken: number
  healed: number
  overkill: number
  coward: boolean
  ironWill: boolean
  frail: boolean
  resist: number
  weakHoly: boolean
  weakSilver: boolean
  weakFlame: boolean
  element?: 'flame' | 'silver'
  holy: boolean
  // Status effects (Docs/depth.md 3a). Chances are what this unit inflicts.
  paralyzeOnHit: number
  slowOnHit: number
  silenceOnHit: number
  aoeEvery: number
  poisonCap: number
  actions: number
  paralyzed: boolean
  paralyzeGuard: boolean
  slowed: number
  silenced: number
  immunePoison: number
  immuneStun: number
  // For the defeat report.
  poisonTaken: number
  stunned: number
  muted: number
}

// Potions a party carries into a fight and what it has drunk.
export type Kit = { stock: Supplies; used: Supplies }

const STATUS_FREE = {
  paralyzeOnHit: 0,
  slowOnHit: 0,
  silenceOnHit: 0,
  aoeEvery: 0,
  poisonCap: 0,
  actions: 0,
  paralyzed: false,
  paralyzeGuard: false,
  slowed: 0,
  silenced: 0,
  immunePoison: 0,
  immuneStun: 0,
  poisonTaken: 0,
  stunned: 0,
  muted: 0,
}

export type FloorOutcome = 'victory' | 'wipe' | 'retreat' | 'timeout'

export function createHeroUnit(member: PartyMember, index: number): BattleUnit {
  const hero = member.hero
  const klass = classById(hero.classId)
  const tough = hero.traitIds.includes('tough')
  const skills = new Set(klass.skills.map((skill) => skill.kind))
  const baseHp = Math.max(1, Math.round((klass.hpBase + hero.stats.vit * klass.hpPerVit) * (tough ? combatRules.toughHp : 1)))
  const gear = heroGearMods(hero)
  const element = hero.gear.find((item) => item.element)?.element
  const fatiguePenalty =
    hero.fatigue >= lifeRules.fatigue.exhaustedAt
      ? lifeRules.fatigue.exhaustedPenalty
      : hero.fatigue >= lifeRules.fatigue.tiredAt
        ? lifeRules.fatigue.tiredPenalty
        : 0
  const injuryPenalty =
    hero.condition === 'critical'
      ? lifeRules.injury.criticalPenalty
      : hero.condition === 'injured'
        ? lifeRules.injury.injuredPenalty
        : 0
  const fatigueScale = 1 - fatiguePenalty
  const injuryScale = 1 - injuryPenalty
  const bondScale = 1 + Math.max(0, member.bonus ?? 0)
  const maxHp = Math.max(1, Math.round(baseHp * injuryScale))
  return {
    id: hero.id,
    refId: hero.id,
    name: hero.name,
    nameKey: '',
    index,
    side: 'hero',
    row: member.row,
    reach: klass.reach,
    role: klass.role,
    boss: false,
    aoe: klass.aoe,
    hasBuff: skills.has('buff'),
    hasDebuff: skills.has('debuff'),
    hp: maxHp,
    maxHp,
    attack: (hero.stats[klass.attackStat] * klass.attackScale + gear.attack) * fatigueScale * injuryScale * bondScale,
    defense: hero.stats.vit * klass.defenseScale + gear.defense,
    heal: hero.stats.wis * klass.healScale * bondScale,
    speed: Math.max(1, (hero.stats.agi + (hero.traitIds.includes('nocturnal') ? combatRules.nocturnalSpeed : 0)) * fatigueScale),
    gauge: 0,
    threat: klass.role === 'tank' ? combatRules.tankThreat : combatRules.baseThreat,
    dot: 0,
    dotOnHit: 0,
    buffed: false,
    debuffed: false,
    opened: false,
    dealt: 0,
    taken: 0,
    healed: 0,
    overkill: 0,
    coward: hero.traitIds.includes('coward'),
    ironWill: hero.traitIds.includes('ironWill'),
    frail: hero.traitIds.includes('frail'),
    resist: 1,
    weakHoly: false,
    weakSilver: false,
    weakFlame: false,
    element,
    holy: hero.classId === 'cleric',
    ...STATUS_FREE,
  }
}

export function simulateFloor(
  heroes: BattleUnit[],
  monsterIds: string[],
  tactics: Tactics,
  rng: Rng,
  log: LogEntry[],
  floorNumber: number,
  floors?: ReplayUnit[][],
  monsterScale = 1,
  kit?: Kit,
): { outcome: FloorOutcome; ticks: number } {
  const enemies = monsterIds.map((id, index) => enemyUnit(monsterById(id), index, monsterScale))
  floors?.push([...heroes, ...enemies].map(replayUnit))
  push(log, 0, 'log.floor', { floor: floorNumber })
  let tick = 0
  while (tick < combatRules.maxTicks) {
    if (!living(heroes).length) {
      push(log, tick, 'log.defeat')
      return { outcome: 'wipe', ticks: tick }
    }
    if (!living(enemies).length) {
      push(log, tick, 'log.floorClear', { floor: floorNumber })
      return { outcome: 'victory', ticks: tick }
    }
    tick += 1
    for (const unit of [...heroes, ...enemies]) {
      if (unit.hp > 0) {
        unit.gauge += unit.slowed > 0 ? unit.speed * combatRules.slowFactor : unit.speed
      }
    }
    const ready = [...heroes, ...enemies]
      .filter((unit) => unit.hp > 0 && unit.gauge >= combatRules.gaugeThreshold)
      .sort((a, b) => b.gauge - a.gauge || a.index - b.index || a.id.localeCompare(b.id))
    const actor = ready[0]
    if (!actor) {
      continue
    }
    actor.gauge -= combatRules.gaugeThreshold
    if (actor.dot > 0) {
      const dotDamage = Math.max(1, Math.round(actor.dot * (actor.ironWill ? combatRules.ironWillDot : 1)))
      actor.poisonTaken += dotDamage
      hurt(actor, dotDamage, tick, log, 'log.dot')
      if (actor.hp <= 0) {
        continue
      }
    }
    if (actor.side === 'hero') {
      const average = averageHpRatio(heroes)
      if (average * 100 < tactics.retreatBelow) {
        push(log, tick, 'log.retreat', { hp: Math.round(average * 100) })
        return { outcome: 'retreat', ticks: tick }
      }
      // Paralysis takes this turn; the next one cannot be paralysed again.
      if (actor.paralyzed) {
        actor.paralyzed = false
        actor.paralyzeGuard = true
        actor.stunned += 1
        push(log, tick, 'log.paralyzed', actorParams(actor))
        endTurn(actor, true)
        continue
      }
      if (!(kit && drinkPotion(actor, kit, tactics, tick, log))) {
        heroAct(actor, heroes, enemies, tactics, rng, tick, log)
      }
    } else {
      enemyAct(actor, heroes, rng, tick, log)
    }
    endTurn(actor, false)
  }
  push(log, tick, 'log.defeat')
  return { outcome: 'timeout', ticks: tick }
}

export function heroUnitsToReport(units: BattleUnit[]): UnitReport[] {
  return units.map((unit) => ({
    id: unit.id,
    name: unit.name,
    nameKey: unit.nameKey,
    side: unit.side,
    hp: unit.hp,
    maxHp: unit.maxHp,
    dealt: unit.dealt,
    taken: unit.taken,
    healed: unit.healed,
  }))
}

function heroAct(
  actor: BattleUnit,
  heroes: BattleUnit[],
  enemies: BattleUnit[],
  tactics: Tactics,
  rng: Rng,
  tick: number,
  log: LogEntry[],
) {
  // Silence leaves only plain attacks: no taunt, healing, buffs or debuffs.
  if (actor.silenced > 0) {
    if (actor.role === 'healer' || actor.role === 'support' || (actor.role === 'tank' && !actor.opened)) {
      actor.muted += 1
    }
    attack(actor, enemies, tactics, rng, tick, log)
    return
  }
  if (actor.role === 'tank' && !actor.opened) {
    actor.opened = true
    actor.threat += combatRules.tauntThreat
    push(log, tick, 'log.taunt', actorParams(actor))
    return
  }
  if (actor.role === 'healer') {
    const patient = lowestRatio(living(heroes))
    if (patient && patient.hp / patient.maxHp < tactics.healBelow / 100) {
      heal(actor, patient, rng, tick, log)
      return
    }
  }
  if (actor.role === 'support' && !actor.opened && (actor.hasBuff || actor.hasDebuff)) {
    actor.opened = true
    if (actor.hasBuff) {
      for (const ally of living(heroes)) {
        ally.buffed = true
      }
      push(log, tick, 'log.buff', actorParams(actor))
      return
    }
    for (const enemy of living(enemies)) {
      enemy.debuffed = true
    }
    push(log, tick, 'log.debuff', actorParams(actor))
    return
  }
  attack(actor, enemies, tactics, rng, tick, log)
}

function attack(actor: BattleUnit, enemies: BattleUnit[], tactics: Tactics, rng: Rng, tick: number, log: LogEntry[]) {
  const pool = actor.reach === 'melee' ? frontOrAll(enemies) : living(enemies)
  if (!pool.length) {
    return
  }
  if (actor.aoe) {
    for (const target of pool) {
      strike(actor, target, rng, tick, log, combatRules.aoeMultiplier)
    }
    return
  }
  strike(actor, chooseTarget(pool, tactics), rng, tick, log, 1)
}

// A hero drinks at most one potion instead of acting: cures first, then healing.
function drinkPotion(actor: BattleUnit, kit: Kit, tactics: Tactics, tick: number, log: LogEntry[]): boolean {
  const has = (id: PotionId) => (kit.stock[id] ?? 0) > 0
  const drink = (id: PotionId) => {
    kit.stock[id] = (kit.stock[id] ?? 0) - 1
    kit.used[id] = (kit.used[id] ?? 0) + 1
    push(log, tick, 'log.potion', { ...actorParams(actor), potion: id })
  }
  if (actor.dot >= alchemyRules.antidoteAt && has('antidote')) {
    drink('antidote')
    actor.dot = 0
    actor.immunePoison = combatRules.immuneActions
    return true
  }
  if (actor.slowed > 0 && has('tonic')) {
    drink('tonic')
    actor.slowed = 0
    actor.immuneStun = combatRules.immuneActions
    return true
  }
  if (actor.silenced > 0 && (actor.role === 'healer' || actor.role === 'support') && has('clarity')) {
    drink('clarity')
    actor.silenced = 0
    return true
  }
  const below = tactics.potionBelow ?? alchemyRules.potionBelow
  if (actor.hp / actor.maxHp < below / 100 && has('heal')) {
    drink('heal')
    const amount = Math.round(actor.maxHp * (potionById('heal')?.heal ?? 0))
    const healed = Math.min(actor.maxHp - actor.hp, amount)
    actor.hp += healed
    push(log, tick, 'log.heal', { ...actorParams(actor), ...targetParams(actor), amount: healed })
    return true
  }
  return false
}

// Counts down timed effects after each of the unit's turns.
function endTurn(actor: BattleUnit, skipped: boolean) {
  actor.actions += 1
  if (!skipped) {
    actor.paralyzeGuard = false
  }
  actor.slowed = Math.max(0, actor.slowed - 1)
  actor.silenced = Math.max(0, actor.silenced - 1)
  actor.immunePoison = Math.max(0, actor.immunePoison - 1)
  actor.immuneStun = Math.max(0, actor.immuneStun - 1)
}

function enemyAct(actor: BattleUnit, heroes: BattleUnit[], rng: Rng, tick: number, log: LogEntry[]) {
  const pool = actor.reach === 'melee' ? frontOrAll(heroes) : living(heroes)
  if (!pool.length) {
    return
  }
  // Some bosses sweep the whole party every few turns.
  if (actor.aoeEvery > 0 && (actor.actions + 1) % actor.aoeEvery === 0) {
    push(log, tick, 'log.sweep', actorParams(actor))
    for (const target of living(heroes)) {
      strike(actor, target, rng, tick, log, combatRules.aoeMultiplier)
    }
    return
  }
  const target = [...pool].sort((a, b) => b.threat - a.threat || a.hp - b.hp || a.index - b.index)[0]
  if (!target) {
    return
  }
  strike(actor, target, rng, tick, log, 1)
}

function chooseTarget(pool: BattleUnit[], tactics: Tactics): BattleUnit {
  if (tactics.target === 'boss') {
    const boss = pool.find((unit) => unit.boss)
    if (boss) {
      return boss
    }
  }
  if (tactics.target === 'backRow') {
    const back = pool.filter((unit) => unit.row === 'back')
    if (back.length) {
      return lowestHp(back)
    }
  }
  return lowestHp(pool)
}

function strike(actor: BattleUnit, target: BattleUnit, rng: Rng, tick: number, log: LogEntry[], power: number) {
  let attack = actor.attack * power * (actor.buffed ? combatRules.buffMultiplier : 1)
  if (actor.debuffed) {
    attack *= combatRules.debuffMultiplier
  }
  if (actor.coward && actor.hp / actor.maxHp < 0.5) {
    attack *= combatRules.cowardMultiplier
  }
  let multiplier = 1
  if (!actor.element && !actor.holy) {
    multiplier *= target.resist
  }
  if (actor.holy && target.weakHoly) {
    multiplier *= 1.6
  }
  if (actor.element === 'silver' && target.weakSilver) {
    multiplier *= 1.6
  }
  if (actor.element === 'flame' && target.weakFlame) {
    multiplier *= 1.6
  }
  attack *= multiplier
  const amount = Math.max(combatRules.minDamage, Math.round(vary(rng, attack - target.defense)))
  actor.dealt += amount
  hurt(target, amount, tick, log, 'log.attack', actor)
  if (target.hp > 0 && actor.dotOnHit > 0 && target.immunePoison <= 0) {
    target.dot = Math.min(Math.max(combatRules.dotCap, actor.poisonCap), target.dot + actor.dotOnHit)
  }
  // Status chances roll only for units that have them, so older fights replay the same.
  if (target.hp > 0 && actor.paralyzeOnHit > 0 && rng.next() < actor.paralyzeOnHit) {
    if (!target.paralyzed && !target.paralyzeGuard && target.immuneStun <= 0) {
      target.paralyzed = true
      push(log, tick, 'log.paralyze', targetParams(target))
    }
  }
  if (target.hp > 0 && actor.slowOnHit > 0 && rng.next() < actor.slowOnHit && target.immuneStun <= 0) {
    if (target.slowed <= 0) {
      target.stunned += 1
      push(log, tick, 'log.slow', targetParams(target))
    }
    target.slowed = combatRules.slowActions
  }
  if (target.hp > 0 && actor.silenceOnHit > 0 && rng.next() < actor.silenceOnHit) {
    if (target.silenced <= 0) {
      push(log, tick, 'log.silence', targetParams(target))
    }
    target.silenced = combatRules.silenceActions
  }
}

function hurt(
  target: BattleUnit,
  amount: number,
  tick: number,
  log: LogEntry[],
  key: string,
  actor?: BattleUnit,
) {
  target.taken += amount
  target.hp = Math.max(0, target.hp - amount)
  const params = actor ? { ...actorParams(actor), ...targetParams(target), amount } : { ...actorParams(target), amount }
  push(log, tick, key, params)
  if (target.hp === 0) {
    target.overkill = amount
    push(log, tick, 'log.down', actorParams(target))
  }
}

function heal(actor: BattleUnit, target: BattleUnit, rng: Rng, tick: number, log: LogEntry[]) {
  const amount = Math.max(1, Math.round(vary(rng, actor.heal)))
  const healed = Math.min(target.maxHp - target.hp, amount)
  target.hp += healed
  actor.healed += healed
  push(log, tick, 'log.heal', { ...actorParams(actor), ...targetParams(target), amount: healed })
}

function vary(rng: Rng, amount: number): number {
  const swing = (rng.next() * 2 - 1) * combatRules.variance
  return amount * (1 + swing)
}

function enemyUnit(monster: MonsterDef, index: number, scale: number): BattleUnit {
  const hp = Math.round(monster.hp * scale)
  return {
    id: `${monster.id}-${index + 1}`,
    refId: monster.id,
    name: '',
    nameKey: `enemy.${monster.id}`,
    index,
    side: 'enemy',
    row: monster.row,
    reach: monster.reach,
    role: 'dps',
    boss: monster.boss,
    aoe: false,
    hasBuff: false,
    hasDebuff: false,
    hp,
    maxHp: hp,
    attack: monster.attack * scale,
    defense: monster.defense,
    heal: 0,
    speed: monster.speed,
    gauge: 0,
    threat: 0,
    dot: 0,
    dotOnHit: monster.dot,
    buffed: false,
    debuffed: false,
    opened: false,
    dealt: 0,
    taken: 0,
    healed: 0,
    overkill: 0,
    coward: false,
    ironWill: false,
    frail: false,
    resist: monster.resist ?? 1,
    weakHoly: monster.weakHoly ?? false,
    weakSilver: monster.weakSilver ?? false,
    weakFlame: monster.weakFlame ?? false,
    holy: false,
    ...STATUS_FREE,
    paralyzeOnHit: monster.paralyze ?? 0,
    slowOnHit: monster.slow ?? 0,
    silenceOnHit: monster.silence ?? 0,
    aoeEvery: monster.aoeEvery ?? 0,
    poisonCap: monster.poisonCap ?? 0,
  }
}

function living(units: BattleUnit[]): BattleUnit[] {
  return units.filter((unit) => unit.hp > 0)
}

function frontOrAll(units: BattleUnit[]): BattleUnit[] {
  const alive = living(units)
  const front = alive.filter((unit) => unit.row === 'front')
  return front.length ? front : alive
}

function lowestHp(units: BattleUnit[]): BattleUnit {
  return [...units].sort((a, b) => a.hp - b.hp || a.index - b.index)[0] as BattleUnit
}

function lowestRatio(units: BattleUnit[]): BattleUnit | undefined {
  return [...units].sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp || a.hp - b.hp)[0]
}

function averageHpRatio(units: BattleUnit[]): number {
  const alive = living(units)
  if (!alive.length) {
    return 0
  }
  return alive.reduce((sum, unit) => sum + unit.hp / unit.maxHp, 0) / alive.length
}

function replayUnit(unit: BattleUnit): ReplayUnit {
  return {
    id: unit.id,
    refId: unit.refId,
    side: unit.side,
    row: unit.row,
    reach: unit.reach,
    hp: unit.hp,
    maxHp: unit.maxHp,
    boss: unit.boss,
  }
}

// Ids let a replay find the unit; names and keys are for the text log.
function actorParams(unit: BattleUnit): LogEntry['params'] {
  if (unit.nameKey) {
    return { actorKey: unit.nameKey, actorIndex: unit.index + 1, actorId: unit.id }
  }
  return { actorName: unit.name, actorId: unit.id }
}

function targetParams(unit: BattleUnit): LogEntry['params'] {
  if (unit.nameKey) {
    return { targetKey: unit.nameKey, targetIndex: unit.index + 1, targetId: unit.id }
  }
  return { targetName: unit.name, targetId: unit.id }
}

function push(log: LogEntry[], tick: number, key: string, params: LogEntry['params'] = {}) {
  log.push({ tick, key, params })
}
