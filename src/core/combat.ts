import { alchemyRules, classById, combatRules, giftRules, lifeRules, magicRules, monsterById, nestRules, potionById, trainingRules } from './data'
import { heroGearMods } from './gear'
import { heroTrinkets } from './magic'
import { heroSkillEffects } from './skills'
import { moraleScale } from './morale'
import type { Rng } from './rng'
import type { AffixId, BossPhase, LogEntry, MonsterDef, MonsterKind, MonsterTrait, PartyMember, PotionId, ReplayUnit, Row, Supplies, Tactics, UnitReport } from './types'

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
  // Traps and ambushes (Docs/depth.md 3b). Wards multiply status chances or poison.
  ambush: boolean
  ambushing: boolean
  disarm: number
  alert: boolean
  poisonWard: number
  steady: number
  calm: number
  trapTaken: number
  ambushTaken: number
  // Boss patterns (Docs/depth.md 3c).
  interrupt: boolean
  blastEvery: number
  blastPower: number
  phases: BossPhase[]
  phase: number
  sinceBlast: number
  charging: boolean
  blastAt: number
  braced: boolean
  blastTaken: number
  // Natural silencers hunt healers first; the nest's silence affix does not.
  huntsCasters: boolean
  // How hard the opening ambush strikes (the nest's affix is gentler, 3d).
  ambushPower: number
  // Learned skills (Docs/skills.md).
  guard: number
  volleyEvery: number
  weaken: number
  cleanse: boolean
  regen: number
  partyGuard: number
  partyAttack: number
  // Branches, gifts and monster traits (Docs/identity.md 5a).
  crit: number
  critDamage: number
  pierce: number
  lifesteal: number
  execute: number
  bossDamage: number
  counter: number
  dodge: number
  burnOnHit: number
  burn: number
  barrier: number
  firstStrike: number
  struck: boolean
  lastStand: number
  revive: number
  reviveUsed: boolean
  holyBonus: number
  aoePower: number
  healTaken: number
  twinStrike: number
  trapGuard: number
  farsight: boolean
  undying: boolean
  undyingUsed: boolean
  vanguard: boolean
  vanguardUsed: boolean
  guardian: boolean
  guardianUsed: boolean
  // What the party-wide skills of this hero add (applyAuras).
  partySpeed: number
  partyCrit: number
  enemyMiss: number
  shieldShare: number
  partyHoly: number
  partyFirstStrike: number
  kind?: MonsterKind
  armor: boolean
  evasion: number
  nodot: boolean
  fireproof: boolean
  mender: boolean
  thorns: boolean
  purgeEvery: number
  enrageAt: number
  enraged: boolean
  elite: boolean
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
  ambush: false,
  ambushing: false,
  disarm: 0,
  alert: false,
  poisonWard: 1,
  steady: 1,
  calm: 1,
  trapTaken: 0,
  ambushTaken: 0,
  interrupt: false,
  blastEvery: 0,
  blastPower: 1,
  phases: [] as BossPhase[],
  phase: 0,
  sinceBlast: 0,
  charging: false,
  blastAt: 0,
  braced: false,
  blastTaken: 0,
  huntsCasters: false,
  ambushPower: 1,
  guard: 0,
  volleyEvery: 0,
  weaken: 0,
  cleanse: false,
  regen: 0,
  partyGuard: 0,
  partyAttack: 0,
  crit: 0,
  critDamage: 0,
  pierce: 0,
  lifesteal: 0,
  execute: 0,
  bossDamage: 0,
  counter: 0,
  dodge: 0,
  burnOnHit: 0,
  burn: 0,
  barrier: 0,
  firstStrike: 0,
  struck: false,
  lastStand: 0,
  revive: 0,
  reviveUsed: false,
  holyBonus: 0,
  aoePower: 0,
  healTaken: 0,
  twinStrike: 0,
  trapGuard: 0,
  farsight: false,
  undying: false,
  undyingUsed: false,
  vanguard: false,
  vanguardUsed: false,
  guardian: false,
  guardianUsed: false,
  partySpeed: 0,
  partyCrit: 0,
  enemyMiss: 0,
  shieldShare: 0,
  partyHoly: 0,
  partyFirstStrike: 0,
  armor: false,
  evasion: 0,
  nodot: false,
  fireproof: false,
  mender: false,
  thorns: false,
  purgeEvery: 0,
  enrageAt: 0,
  enraged: false,
  elite: false,
}

export type FloorOutcome = 'victory' | 'wipe' | 'retreat' | 'timeout'

export function createHeroUnit(member: PartyMember, index: number): BattleUnit {
  const hero = member.hero
  const klass = classById(hero.classId)
  const tough = hero.traitIds.includes('tough')
  // The opening buff or debuff follows the innate skill and each branch's first step, as before branches.
  const skills = new Set(klass.skills.filter((skill) => (skill.tier ?? 1) <= 1).map((skill) => skill.kind))
  const learned = heroSkillEffects(hero, { allies: member.allies, bonded: (member.healBonus ?? member.bonus ?? 0) > 0 })
  const baseHp = Math.max(1, Math.round((klass.hpBase + hero.stats.vit * klass.hpPerVit) * (tough ? combatRules.toughHp : 1) * (1 + learned.hp)))
  const gear = heroGearMods(hero)
  // Heirlooms in a descendant's hands (Docs/tavern.md).
  gear.attack += member.heirloom?.attack ?? 0
  gear.defense += member.heirloom?.defense ?? 0
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
  // Bonds and personalities: a lift beside friends, a small drag beside a clash (Docs/personality.md).
  const bondScale = 1 + (member.bonus ?? 0)
  const maxHp = Math.max(1, Math.round(baseHp * injuryScale))
  const trinkets = heroTrinkets(hero)
  const spirit = moraleScale(hero)
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
    attack: (hero.stats[klass.attackStat] * klass.attackScale + gear.attack) * fatigueScale * injuryScale * bondScale * (1 + learned.attack) * spirit.attack * (1 + (member.blessing ?? 0)),
    defense: hero.stats.vit * klass.defenseScale + gear.defense,
    heal: hero.stats.wis * klass.healScale * (1 + (member.healBonus ?? Math.max(0, member.bonus ?? 0))) * (1 + learned.heal),
    speed: Math.max(1, (hero.stats.agi + (hero.traitIds.includes('nocturnal') ? combatRules.nocturnalSpeed : 0)) * fatigueScale * (1 + learned.speed) * spirit.speed),
    gauge: 0,
    threat: (klass.role === 'tank' ? combatRules.tankThreat : combatRules.baseThreat) + learned.threat,
    dot: 0,
    dotOnHit: learned.bleed,
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
    disarm: Math.max(hero.classId === 'rogue' ? magicRules.disarm : 0, trinkets.has('trapSense') ? magicRules.senseDisarm : 0),
    alert: trinkets.has('alert') || learned.alert,
    poisonWard: (trinkets.has('poisonWard') ? magicRules.ward : 1) * (1 - learned.dotGuard),
    // Steadfast heroes cannot be stunned or slowed.
    steady: learned.steadfast ? 0 : trinkets.has('steady') ? magicRules.ward : 1,
    calm: trinkets.has('calm') ? magicRules.ward : 1,
    interrupt: klass.interrupt ?? false,
    guard: learned.guard,
    volleyEvery: learned.volleyEvery,
    weaken: learned.weaken * (1 + learned.weakenPower),
    cleanse: learned.cleanse,
    regen: learned.regen,
    partyGuard: learned.partyGuard,
    partyAttack: learned.partyAttack,
    crit: learned.crit,
    critDamage: learned.critDamage,
    pierce: Math.min(1, learned.pierce),
    lifesteal: learned.lifesteal,
    execute: learned.execute,
    bossDamage: learned.bossDamage,
    counter: learned.counter,
    dodge: learned.dodge,
    paralyzeOnHit: learned.stun,
    slowOnHit: learned.slow,
    burnOnHit: Math.round(learned.burn * (1 + learned.burnPower)),
    firstStrike: learned.firstStrike,
    lastStand: learned.lastStand,
    revive: learned.revive,
    holyBonus: learned.holy,
    aoePower: learned.aoePower,
    healTaken: learned.healTaken,
    twinStrike: learned.twinStrike,
    trapGuard: learned.trapGuard,
    farsight: learned.farsight,
    undying: learned.undying,
    vanguard: learned.vanguard,
    guardian: learned.guardian,
    partySpeed: learned.partySpeed,
    partyCrit: learned.partyCrit,
    enemyMiss: learned.enemyMiss,
    shieldShare: learned.shield,
    partyHoly: learned.partyHoly,
    partyFirstStrike: learned.partyFirstStrike,
  }
}

// Party-wide skills (ward, veil, bless, anthem) apply when the party sets
// out, added up to a cap (Docs/skills.md).
export function applyAuras(heroes: BattleUnit[]) {
  const cap = trainingRules.partyAuraCap
  const total = (key: 'partyGuard' | 'partyAttack' | 'partySpeed' | 'partyCrit' | 'enemyMiss' | 'shieldShare' | 'partyHoly' | 'partyFirstStrike', most: number) =>
    Math.min(most, heroes.reduce((sum, hero) => sum + hero[key], 0))
  const guard = total('partyGuard', cap.guard)
  const attack = total('partyAttack', cap.attack)
  const speed = total('partySpeed', cap.speed)
  const crit = total('partyCrit', cap.crit)
  const miss = total('enemyMiss', cap.miss)
  const shield = total('shieldShare', cap.shield)
  const holy = total('partyHoly', cap.holy)
  const first = total('partyFirstStrike', cap.firstStrike)
  for (const hero of heroes) {
    if (guard > 0) {
      hero.guard = 1 - (1 - hero.guard) * (1 - guard)
    }
    if (attack > 0) {
      hero.attack *= 1 + attack
    }
    hero.speed *= 1 + speed
    hero.crit += crit
    hero.dodge = Math.min(trainingRules.dodgeCap, hero.dodge + miss)
    hero.shieldShare = shield
    hero.holyBonus += holy
    hero.firstStrike += first
  }
}

// A raid boss's health pool across attempts: `hp` in (null for a fresh boss),
// `left` and `max` out (Docs/endgame.md 4c).
export type RaidPool = { hpScale: number; hp: number | null; left?: number; max?: number }

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
  trapChance = 0,
  affixes: AffixId[] = [],
  raid?: RaidPool,
  elite = 0,
): { outcome: FloorOutcome; ticks: number; trap: TrapResult } {
  const enemies = monsterIds.map((id, index) => enemyUnit(monsterById(id), index, monsterScale))
  // Elites in the deeper dungeons (Docs/identity.md 5a): only where the chance is set, so other fights roll the same.
  if (elite > 0) {
    for (const enemy of enemies) {
      if (!enemy.boss && rng.next() < elite) {
        makeElite(enemy, rng)
      }
    }
  }
  // A raid boss has a far deeper pool of health and keeps what it lost
  // between attempts (Docs/endgame.md 4c).
  const raidBoss = raid ? enemies.find((enemy) => enemy.boss) : undefined
  if (raid && raidBoss) {
    raidBoss.maxHp = Math.round(raidBoss.maxHp * raid.hpScale)
    raidBoss.hp = raid.hp == null ? raidBoss.maxHp : Math.max(1, Math.min(raidBoss.maxHp, raid.hp))
    raid.max = raidBoss.maxHp
  }
  const done = <T,>(result: T): T => {
    if (raid && raidBoss) {
      raid.left = Math.max(0, raidBoss.hp)
    }
    return result
  }
  applyAffixes(enemies, affixes)
  floors?.push([...heroes, ...enemies].map(replayUnit))
  push(log, 0, 'log.floor', { floor: floorNumber })
  for (const hero of heroes) {
    hero.braced = false
    hero.struck = false
    hero.vanguardUsed = false
    hero.reviveUsed = false
    hero.undyingUsed = false
    hero.barrier = hero.hp > 0 && hero.shieldShare > 0 ? Math.round(hero.maxHp * hero.shieldShare) : 0
  }
  const trap = springTrap(heroes, trapChance, rng, log)
  // Ambushers start ready to strike, unless a hero on watch spots them.
  const ambushers = enemies.filter((enemy) => enemy.ambush)
  if (ambushers.length) {
    const watcher = living(heroes).find((hero) => hero.alert)
    if (watcher) {
      push(log, 0, 'log.alert', actorParams(watcher))
    } else {
      for (const enemy of ambushers) {
        enemy.gauge = combatRules.gaugeThreshold
        enemy.ambushing = true
      }
    }
  }
  let tick = 0
  while (tick < combatRules.maxTicks) {
    reviveFallen(heroes, tick, log)
    // The guardian angel stands the whole party up once a trip.
    const angel = !living(heroes).length ? heroes.find((hero) => hero.guardian && !hero.guardianUsed) : undefined
    if (angel) {
      angel.guardianUsed = true
      for (const hero of heroes) {
        hero.hp = Math.max(1, Math.round(hero.maxHp * giftRules.guardianHp))
        hero.dot = 0
        hero.burn = 0
      }
      push(log, tick, 'log.guardian', actorParams(angel))
    }
    if (!living(heroes).length) {
      push(log, tick, 'log.defeat')
      return done({ outcome: 'wipe' as const, ticks: tick, trap })
    }
    if (!living(enemies).length) {
      push(log, tick, 'log.floorClear', { floor: floorNumber })
      return done({ outcome: 'victory' as const, ticks: tick, trap })
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
    // A charged blast lands on its own clock, ahead of anyone's gauge (Docs/depth.md 3c).
    const blaster = enemies.find((enemy) => enemy.hp > 0 && enemy.charging && tick >= enemy.blastAt)
    if (blaster) {
      enemyAct(blaster, heroes, rng, tick, log, enemies)
      endTurn(blaster, false)
      advancePhases(enemies, monsterScale, tick, log, affixes)
      continue
    }
    const actor = ready[0]
    if (!actor) {
      continue
    }
    actor.gauge -= combatRules.gaugeThreshold
    if (actor.dot > 0) {
      const dotDamage = Math.max(1, Math.round(actor.dot * (actor.ironWill ? combatRules.ironWillDot : 1) * actor.poisonWard))
      actor.poisonTaken += dotDamage
      hurt(actor, dotDamage, tick, log, 'log.dot')
      advancePhases(enemies, monsterScale, tick, log, affixes)
      if (actor.hp <= 0) {
        continue
      }
    }
    if (actor.burn > 0) {
      hurt(actor, Math.max(1, Math.round(actor.burn * actor.poisonWard)), tick, log, 'log.burn')
      advancePhases(enemies, monsterScale, tick, log, affixes)
      if (actor.hp <= 0) {
        continue
      }
    }
    if (actor.side === 'hero') {
      const average = averageHpRatio(heroes)
      if (average * 100 < tactics.retreatBelow) {
        push(log, tick, 'log.retreat', { hp: Math.round(average * 100) })
        return done({ outcome: 'retreat' as const, ticks: tick, trap })
      }
      // A paralysed hero with a tonic drinks it instead of losing the turn
      // blankly: the turn still goes, but paralysis and slow wear off and
      // the hero is guarded for a while (Docs/depth.md 3a).
      if (actor.paralyzed && kit && (kit.stock.tonic ?? 0) > 0) {
        actor.paralyzed = false
        actor.paralyzeGuard = true
        actor.stunned += 1
        drinkTonic(actor, kit, tick, log)
        endTurn(actor, true)
        continue
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
      // A bracing hero holds still: no potions until the blast lands (review 7eaca30).
      if (!(kit && !actor.braced && drinkPotion(actor, kit, tactics, tick, log))) {
        heroAct(actor, heroes, enemies, tactics, rng, tick, log)
      }
      // The vanguard's first turn of a floor comes round again at once.
      if (actor.vanguard && !actor.vanguardUsed) {
        actor.vanguardUsed = true
        actor.gauge += combatRules.gaugeThreshold
      }
      // Hymn: a little healing for everyone on each of the singer's turns.
      if (actor.regen > 0) {
        for (const ally of living(heroes)) {
          const healed = Math.min(ally.maxHp - ally.hp, Math.max(1, Math.round(ally.maxHp * actor.regen)))
          if (healed > 0) {
            ally.hp += healed
            actor.healed += healed
            push(log, tick, 'log.heal', { ...actorParams(actor), ...targetParams(ally), amount: healed })
          }
        }
      }
    } else if (actor.paralyzed) {
      // A stunned monster loses this turn; the next one cannot be stunned again.
      actor.paralyzed = false
      actor.paralyzeGuard = true
      push(log, tick, 'log.paralyzed', actorParams(actor))
      endTurn(actor, true)
      continue
    } else {
      enemyAct(actor, heroes, rng, tick, log, enemies)
      // With the brace tactic the whole party takes its stance at the warning.
      if (tactics.blast === 'brace' && actor.charging && actor.blastAt === tick + combatRules.chargeTicks) {
        for (const hero of living(heroes)) {
          hero.braced = true
          push(log, tick, 'log.brace', actorParams(hero))
        }
      }
    }
    endTurn(actor, false)
    advancePhases(enemies, monsterScale, tick, log, affixes)
  }
  push(log, tick, 'log.defeat')
  return done({ outcome: 'timeout' as const, ticks: tick, trap })
}

export type TrapResult = 'none' | 'disarmed' | 'sprung'

// A trap before the fight (Docs/depth.md 3b). The best disarmer tries first;
// a sprung trap hurts everyone but never knocks anyone out, and costs the
// party its head start. Rolls only happen where traps exist.
export function springTrap(heroes: BattleUnit[], chance: number, rng: Rng, log: LogEntry[]): TrapResult {
  // A far-sighted hero walks the party round every trap (Docs/identity.md 5a).
  if (!(chance > 0) || living(heroes).some((hero) => hero.farsight) || rng.next() >= chance) {
    return 'none'
  }
  const alive = living(heroes)
  const best = [...alive].sort((a, b) => b.disarm - a.disarm || a.index - b.index)[0]
  if (best && best.disarm > 0 && rng.next() < best.disarm) {
    push(log, 0, 'log.disarm', actorParams(best))
    return 'disarmed'
  }
  push(log, 0, 'log.trap')
  for (const hero of alive) {
    const amount = Math.min(hero.hp - 1, Math.round(hero.maxHp * magicRules.trapDamage * (1 - hero.trapGuard)))
    if (amount > 0) {
      hero.hp -= amount
      hero.taken += amount
      hero.trapTaken += amount
      push(log, 0, 'log.trapHit', { ...actorParams(hero), amount })
    }
    hero.gauge = 0
  }
  return 'sprung'
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
  // A boss is gathering power: break it, or brace for it (Docs/depth.md 3c).
  const charger = living(enemies).find((enemy) => enemy.charging)
  if (charger) {
    if (actor.braced) {
      // Bracing heroes hold their stance until the blast lands; a healer still heals.
      const patient = actor.role === 'healer' && actor.silenced <= 0 ? lowestRatio(living(heroes)) : undefined
      if (!(patient && patient.hp / patient.maxHp < tactics.healBelow / 100)) {
        return
      }
    } else if (tactics.blast !== 'brace' && actor.interrupt && actor.silenced <= 0) {
      const reach = actor.reach === 'melee' ? frontOrAll(enemies) : living(enemies)
      if (reach.includes(charger)) {
        charger.charging = false
        charger.sinceBlast = 0
        push(log, tick, 'log.interrupt', { ...actorParams(actor), ...targetParams(charger) })
        return
      }
    }
  }
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
  // Slam and volley: every few actions the hit lands on everyone in reach.
  if (actor.aoe || (actor.volleyEvery > 0 && (actor.actions + 1) % actor.volleyEvery === 0)) {
    if (!actor.aoe) {
      push(log, tick, 'log.volley', actorParams(actor))
    }
    for (const target of pool) {
      strike(actor, target, rng, tick, log, combatRules.aoeMultiplier + actor.aoePower, true)
    }
    actor.struck = true
    return
  }
  const target = chooseTarget(pool, tactics)
  strike(actor, target, rng, tick, log, 1)
  // Twin strike: sometimes the blow lands twice.
  if (actor.twinStrike > 0 && target.hp > 0 && rng.next() < actor.twinStrike) {
    push(log, tick, 'log.twin', actorParams(actor))
    strike(actor, target, rng, tick, log, 1)
  }
  actor.struck = true
}

// A hero drinks at most one potion instead of acting: cures first, then healing.
function drinkPotion(actor: BattleUnit, kit: Kit, tactics: Tactics, tick: number, log: LogEntry[]): boolean {
  const has = (id: PotionId) => (kit.stock[id] ?? 0) > 0
  const drink = (id: PotionId) => {
    kit.stock[id] = (kit.stock[id] ?? 0) - 1
    kit.used[id] = (kit.used[id] ?? 0) + 1
    push(log, tick, 'log.potion', { ...actorParams(actor), potion: id })
  }
  // Immunity counts the turns after drinking, so it starts one higher.
  if (actor.dot >= alchemyRules.antidoteAt && has('antidote')) {
    drink('antidote')
    actor.dot = 0
    actor.immunePoison = combatRules.immuneActions + 1
    return true
  }
  if (actor.slowed > 0 && has('tonic')) {
    drinkTonic(actor, kit, tick, log)
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

function drinkTonic(actor: BattleUnit, kit: Kit, tick: number, log: LogEntry[]) {
  kit.stock.tonic = (kit.stock.tonic ?? 0) - 1
  kit.used.tonic = (kit.used.tonic ?? 0) + 1
  push(log, tick, 'log.potion', { ...actorParams(actor), potion: 'tonic' })
  actor.slowed = 0
  actor.immuneStun = combatRules.immuneActions + 1
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

function enemyAct(actor: BattleUnit, heroes: BattleUnit[], rng: Rng, tick: number, log: LogEntry[], allies: BattleUnit[] = []) {
  const pool = actor.reach === 'melee' ? frontOrAll(heroes) : living(heroes)
  if (!pool.length) {
    return
  }
  // Bosses grow furious in a long fight (Docs/identity.md 5a).
  if (actor.enrageAt > 0 && !actor.enraged && actor.actions + 1 >= actor.enrageAt) {
    actor.enraged = true
    actor.attack *= combatRules.enrageAttack
    push(log, tick, 'log.enrage', actorParams(actor))
  }
  // Some bosses shake off weakness and slow every few turns.
  if (actor.purgeEvery > 0 && (actor.actions + 1) % actor.purgeEvery === 0 && (actor.debuffed || actor.slowed > 0)) {
    actor.debuffed = false
    actor.slowed = 0
    push(log, tick, 'log.purge', actorParams(actor))
  }
  // Menders patch up a hurt ally instead of striking.
  if (actor.mender && !actor.charging) {
    const patient = lowestRatio(living(allies))
    if (patient && patient.hp / patient.maxHp < combatRules.mobHealBelow) {
      const healed = Math.min(patient.maxHp - patient.hp, Math.max(1, Math.round(actor.attack * combatRules.mobHealPower)))
      patient.hp += healed
      actor.healed += healed
      push(log, tick, 'log.heal', { ...actorParams(actor), ...targetParams(patient), amount: healed })
      return
    }
  }
  // Boss pattern: every few actions it charges, and the next one blasts everyone.
  if (actor.blastEvery > 0) {
    // While charging, the boss waits for its blast clock (review 7eaca30).
    if (actor.charging && tick < actor.blastAt) {
      return
    }
    if (actor.charging) {
      actor.charging = false
      actor.sinceBlast = 0
      push(log, tick, 'log.blast', actorParams(actor))
      for (const target of living(heroes)) {
        const before = target.taken
        strike(actor, target, rng, tick, log, actor.blastPower * (target.braced ? combatRules.braceFactor : 1))
        target.blastTaken += target.taken - before
      }
      for (const hero of heroes) {
        hero.braced = false
      }
      return
    }
    if (actor.sinceBlast + 1 >= actor.blastEvery) {
      actor.charging = true
      // The blast lands a few ticks later: only heroes about to act can break it.
      actor.blastAt = tick + combatRules.chargeTicks
      push(log, tick, 'log.charge', actorParams(actor))
      return
    }
    actor.sinceBlast += 1
  }
  // An ambusher's first strike goes past the front row (Docs/depth.md 3b).
  if (actor.ambushing) {
    actor.ambushing = false
    const back = living(heroes).filter((unit) => unit.row === 'back')
    const victim = lowestHp(back.length ? back : living(heroes))
    push(log, tick, 'log.ambush', { ...actorParams(actor), ...targetParams(victim) })
    const before = victim.taken
    strike(actor, victim, rng, tick, log, actor.ambushPower)
    victim.ambushTaken += victim.taken - before
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
  // Silencers go for the healers and supporters they can reach first.
  const casters = actor.huntsCasters ? pool.filter((unit) => unit.role === 'healer' || unit.role === 'support') : []
  const targets = casters.length ? casters : pool
  const target = [...targets].sort((a, b) => b.threat - a.threat || a.hp - b.hp || a.index - b.index)[0]
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

function strike(actor: BattleUnit, target: BattleUnit, rng: Rng, tick: number, log: LogEntry[], power: number, spread = false) {
  // Evasive monsters and nimble heroes slip single blows; sweeps still land.
  // Rolls only where someone can dodge, so older fights replay the same.
  const dodge = target.side === 'enemy' ? target.evasion : target.dodge
  if (!spread && dodge > 0 && rng.next() < dodge) {
    push(log, tick, 'log.miss', { ...actorParams(actor), ...targetParams(target) })
    return
  }
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
  if (actor.element === 'flame' && target.fireproof) {
    multiplier *= 1 - combatRules.fireproofCut
  }
  // Branch and gift bonuses (Docs/identity.md 5a).
  const low = combatRules.lowHp
  if (target.boss) {
    multiplier *= 1 + actor.bossDamage
  }
  if (target.kind === 'undead' || target.kind === 'spirit') {
    multiplier *= 1 + actor.holyBonus
  }
  if (actor.lastStand > 0 && actor.hp / actor.maxHp < low) {
    multiplier *= 1 + actor.lastStand
  }
  if (actor.firstStrike > 0 && !actor.struck) {
    multiplier *= 1 + actor.firstStrike
  }
  if (actor.execute > 0 && target.hp / target.maxHp < low) {
    multiplier *= 1 + actor.execute
  }
  const crit = actor.crit > 0 && rng.next() < actor.crit
  if (crit) {
    multiplier *= combatRules.critMultiplier + actor.critDamage
  } else if (target.armor) {
    // Armour turns plain blows; a critical hit gets through.
    multiplier *= 1 - combatRules.armorCut
  }
  attack *= multiplier
  const rolled = vary(rng, attack - target.defense * (1 - actor.pierce))
  // Guarding skills shave the blow before rounding (review 8e25753); only
  // heroes who learned them take this path, so older fights match.
  let guard = target.guard
  if (target.lastStand > 0 && target.hp / target.maxHp < low) {
    guard = 1 - (1 - guard) * (1 - target.lastStand)
  }
  const amount = Math.max(combatRules.minDamage, Math.round(guard !== 0 ? rolled * (1 - guard) : rolled))
  actor.dealt += amount
  if (crit) {
    push(log, tick, 'log.crit', actorParams(actor))
  }
  hurt(target, amount, tick, log, 'log.attack', actor)
  if (actor.lifesteal > 0 && actor.hp > 0) {
    const healed = Math.min(actor.maxHp - actor.hp, Math.round(amount * actor.lifesteal))
    if (healed > 0) {
      actor.hp += healed
      actor.healed += healed
      push(log, tick, 'log.heal', { ...actorParams(actor), ...targetParams(actor), amount: healed })
    }
  }
  if (target.thorns && actor.hp > 0) {
    hurt(actor, Math.max(1, Math.round(amount * combatRules.thorns)), tick, log, 'log.thorns', target)
  }
  if (!spread && target.counter > 0 && target.hp > 0 && actor.hp > 0 && rng.next() < target.counter) {
    push(log, tick, 'log.counter', actorParams(target))
    strike(target, actor, rng, tick, log, combatRules.counterPower, true)
  }
  if (target.hp > 0 && actor.dotOnHit > 0 && target.immunePoison <= 0 && !target.nodot) {
    target.dot = Math.min(Math.max(combatRules.dotCap, actor.poisonCap), target.dot + actor.dotOnHit)
  }
  if (target.hp > 0 && actor.burnOnHit > 0 && !target.fireproof) {
    target.burn = Math.min(combatRules.dotCap, target.burn + actor.burnOnHit)
  }
  // Weakening skills: the target hits softer for the rest of the floor.
  if (target.hp > 0 && actor.weaken > 0 && !target.debuffed && rng.next() < actor.weaken) {
    target.debuffed = true
    push(log, tick, 'log.weaken', targetParams(target))
  }
  // Status chances roll only for units that have them, so older fights replay the same.
  if (target.hp > 0 && actor.paralyzeOnHit > 0 && rng.next() < actor.paralyzeOnHit * target.steady) {
    if (!target.paralyzed && !target.paralyzeGuard && target.immuneStun <= 0) {
      target.paralyzed = true
      push(log, tick, 'log.paralyze', targetParams(target))
    }
  }
  if (target.hp > 0 && actor.slowOnHit > 0 && rng.next() < actor.slowOnHit * target.steady && target.immuneStun <= 0) {
    if (target.slowed <= 0) {
      target.stunned += 1
      push(log, tick, 'log.slow', targetParams(target))
    }
    target.slowed = combatRules.slowActions
  }
  if (target.hp > 0 && actor.silenceOnHit > 0 && rng.next() < actor.silenceOnHit * target.calm) {
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
  // A holy shield soaks blows first (Docs/identity.md 5a).
  const absorbed = target.barrier > 0 ? Math.min(target.barrier, amount) : 0
  if (absorbed > 0) {
    target.barrier -= absorbed
    amount -= absorbed
  }
  // The undying hold on at 1 once a floor.
  if (target.undying && !target.undyingUsed && amount >= target.hp && target.hp > 0) {
    target.undyingUsed = true
    amount = target.hp - 1
    push(log, tick, 'log.undying', actorParams(target))
  }
  target.taken += amount
  target.hp = Math.max(0, target.hp - amount)
  const params = actor ? { ...actorParams(actor), ...targetParams(target), amount, ...(absorbed ? { absorbed } : {}) } : { ...actorParams(target), amount, ...(absorbed ? { absorbed } : {}) }
  push(log, tick, key, params)
  if (target.hp === 0) {
    target.overkill = amount
    push(log, tick, 'log.down', actorParams(target))
  }
}

function heal(actor: BattleUnit, target: BattleUnit, rng: Rng, tick: number, log: LogEntry[]) {
  const amount = Math.max(1, Math.round(vary(rng, actor.heal) * (1 + target.healTaken)))
  const healed = Math.min(target.maxHp - target.hp, amount)
  target.hp += healed
  actor.healed += healed
  push(log, tick, 'log.heal', { ...actorParams(actor), ...targetParams(target), amount: healed })
  // Purify eases poison by half; antidotes still clear it (Docs/skills.md).
  if (actor.cleanse && target.dot > 0) {
    target.dot = Math.floor(target.dot / 2)
    push(log, tick, 'log.cleanse', targetParams(target))
  }
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
    ambush: monster.ambush ?? false,
    blastEvery: monster.blastEvery ?? 0,
    blastPower: monster.blastPower ?? 1,
    phases: monster.phases ?? [],
    huntsCasters: (monster.silence ?? 0) > 0,
    ambushPower: magicRules.ambushPower,
    ...monsterTraits(monster),
  }
}

// Kinds and traits (Docs/identity.md 5a). Bosses hold steady against stuns
// and slows, and the deeper ones grow furious in a long fight.
function monsterTraits(monster: MonsterDef): Pick<BattleUnit, 'kind' | 'armor' | 'evasion' | 'nodot' | 'fireproof' | 'mender' | 'thorns' | 'purgeEvery' | 'enrageAt' | 'steady'> {
  const has = (trait: MonsterTrait) => monster.traits?.includes(trait) ?? false
  return {
    kind: monster.kind,
    armor: has('armor'),
    evasion: has('evasive') ? combatRules.evasion : 0,
    nodot: has('nodot'),
    fireproof: has('fireproof'),
    mender: has('healer'),
    thorns: has('thorns'),
    purgeEvery: has('purge') ? combatRules.purgeEvery : 0,
    enrageAt: monster.boss && monster.tier >= combatRules.enrageTier ? combatRules.enrageActions : 0,
    steady: monster.boss ? combatRules.bossSteady : 1,
  }
}

function makeElite(enemy: BattleUnit, rng: Rng) {
  enemy.elite = true
  enemy.maxHp = Math.round(enemy.maxHp * combatRules.eliteHp)
  enemy.hp = enemy.maxHp
  const open = (combatRules.eliteTraits as MonsterTrait[]).filter((trait) =>
    trait === 'armor' ? !enemy.armor : trait === 'evasive' ? enemy.evasion === 0 : trait === 'thorns' ? !enemy.thorns : !enemy.nodot,
  )
  const trait = open.length ? rng.pick(open) : undefined
  if (trait === 'armor') {
    enemy.armor = true
  } else if (trait === 'evasive') {
    enemy.evasion = combatRules.evasion
  } else if (trait === 'thorns') {
    enemy.thorns = true
  } else if (trait === 'nodot') {
    enemy.nodot = true
  }
}

// A miracle: a healer brings one fallen ally back once a floor.
function reviveFallen(heroes: BattleUnit[], tick: number, log: LogEntry[]) {
  const fallen = heroes.find((hero) => hero.hp <= 0)
  if (!fallen) {
    return
  }
  const saint = heroes.find((hero) => hero.hp > 0 && hero.revive > 0 && !hero.reviveUsed)
  if (!saint) {
    return
  }
  saint.reviveUsed = true
  fallen.hp = Math.max(1, Math.round(fallen.maxHp * saint.revive))
  fallen.dot = 0
  fallen.burn = 0
  push(log, tick, 'log.revive', { ...actorParams(saint), ...targetParams(fallen) })
}

// The nest's affixes change its monsters (Docs/depth.md 3d). Older dungeons
// pass none, so nothing here touches them.
function applyAffixes(enemies: BattleUnit[], affixes: AffixId[]) {
  if (!affixes.length) {
    return
  }
  const has = (id: AffixId) => affixes.includes(id)
  // The ambush comes from the floor's weakest hitter, so it stings without one-shotting.
  const ambusher = has('ambush') ? [...enemies].filter((enemy) => !enemy.boss).sort((a, b) => a.attack - b.attack || a.index - b.index)[0] : undefined
  if (ambusher) {
    ambusher.ambush = true
    ambusher.ambushPower = nestRules.ambushPower
  }
  // One silencer per floor, the fastest in the back: silencers hunt healers,
  // so a whole back row of them would just be a focus fire.
  const silencer = has('silence') ? [...enemies].filter((enemy) => !enemy.boss && enemy.row === 'back').sort((a, b) => b.speed - a.speed || a.index - b.index)[0] : undefined
  if (silencer) {
    silencer.silenceOnHit = Math.max(silencer.silenceOnHit, nestRules.silenceChance)
  }
  for (const enemy of enemies) {
    applyLasting(enemy, affixes)
  }
}

// The affixes every enemy carries, summoned ones too (review f47daff).
function applyLasting(enemy: BattleUnit, affixes: AffixId[]) {
  const has = (id: AffixId) => affixes.includes(id)
  if (has('swift')) {
    enemy.speed *= nestRules.swiftSpeed
  }
  if (enemy.boss) {
    if (has('charged') && enemy.blastEvery === 0) {
      enemy.blastEvery = nestRules.chargedEvery
      enemy.blastPower = nestRules.chargedPower
    }
    return
  }
  if (has('venom')) {
    enemy.dotOnHit += nestRules.venomDot
    enemy.poisonCap = Math.max(enemy.poisonCap, nestRules.venomCap)
  }
  if (has('paralyze') && enemy.row === 'front') {
    enemy.paralyzeOnHit = Math.max(enemy.paralyzeOnHit, nestRules.paralyzeChance)
  }
}

// A boss crossing a health line moves to its next phase: it may call help,
// blast more often, or hit harder. Two lines at once run in order.
function advancePhases(enemies: BattleUnit[], scale: number, tick: number, log: LogEntry[], affixes: AffixId[] = []) {
  for (const boss of [...enemies]) {
    while (boss.hp > 0 && boss.phase < boss.phases.length && boss.hp / boss.maxHp <= boss.phases[boss.phase]!.at) {
      const phase = boss.phases[boss.phase]!
      boss.phase += 1
      push(log, tick, 'log.phase', { ...actorParams(boss), phase: boss.phase + 1 })
      if (phase.blastEvery) {
        boss.blastEvery = phase.blastEvery
      }
      if (phase.attackUp) {
        boss.attack *= phase.attackUp
      }
      if (phase.summon?.length) {
        const called = phase.summon.map((id) => enemyUnit(monsterById(id), enemies.length, scale))
        for (const unit of called) {
          unit.index = enemies.length
          unit.id = `${unit.refId}-${unit.index + 1}`
          applyLasting(unit, affixes)
          enemies.push(unit)
        }
        push(log, tick, 'log.summon', { ...actorParams(boss), units: called.map((unit) => unit.id).join(','), refs: called.map((unit) => unit.refId).join(','), hps: called.map((unit) => unit.maxHp).join(',') })
      }
    }
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
    ...(unit.elite ? { elite: true } : {}),
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
