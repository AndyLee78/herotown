import { classById, combatRules, dungeonById, lifeRules, magicRules, progression } from './data'
import { createHeroUnit, heroUnitsToReport, simulateFloor, type BattleUnit, type Kit } from './combat'
import { canDeploy, createHero } from './hero'
import { createRng } from './rng'
import type { Condition, DungeonReport, DungeonResult, Hero, PartyMember, Supplies, Tactics } from './types'

export const DEFAULT_TACTICS: Tactics = {
  target: 'lowestHp',
  healBelow: 70,
  retreatBelow: 0,
  potionBelow: 40,
}

export function runDungeon(party: PartyMember[], dungeonId: string, tactics: Tactics, seed: number, supplies: Supplies = {}): DungeonResult {
  if (party.length === 0) {
    return { ok: false, error: 'emptyParty' }
  }
  if (party.length > combatRules.maxParty) {
    return { ok: false, error: 'partyTooLarge' }
  }
  if (party.some((member) => !canDeploy(member.hero))) {
    return { ok: false, error: party.some((member) => member.hero.condition === 'dead') ? 'dead' : 'underage' }
  }
  const front = party.filter((member) => member.row === 'front').length
  const back = party.length - front
  if (front > combatRules.frontRowSize || back > combatRules.backRowSize) {
    return { ok: false, error: 'badFormation' }
  }

  const dungeon = dungeonById(dungeonId)
  const rng = createRng(seed)
  const heroes = party.map((member, index) => createHeroUnit(member, index))
  const kit: Kit = { stock: { ...supplies }, used: {} }
  const carried = Object.values(supplies).some((count) => (count ?? 0) > 0)
  const log: DungeonReport['log'] = []
  const floors: NonNullable<DungeonReport['floors']> = []
  let ticks = 0
  let floorsCleared = 0
  let outcome: 'victory' | 'wipe' | 'retreat' | 'timeout' = 'victory'
  const hasTraps = dungeon.floors.some((entry) => (entry.trapChance ?? 0) > 0)
  const traps = { sprung: 0, disarmed: 0 }

  for (let floor = 0; floor < dungeon.floors.length; floor += 1) {
    const floorDef = dungeon.floors[floor]
    if (!floorDef) {
      break
    }
    const result = simulateFloor(heroes, floorDef.monsters, tactics, rng, log, floor + 1, floors, dungeon.monsterScale ?? 1, carried ? kit : undefined, floorDef.trapChance ?? 0)
    ticks += result.ticks
    if (result.trap !== 'none') {
      traps[result.trap] += 1
    }
    if (result.outcome !== 'victory') {
      outcome = result.outcome
      break
    }
    floorsCleared += 1
    if (floor < dungeon.floors.length - 1) {
      for (const hero of heroes) {
        if (hero.hp > 0) {
          hero.hp = Math.min(hero.maxHp, Math.round(hero.hp + hero.maxHp * dungeon.betweenHeal))
          hero.dot = 0
        }
      }
    }
  }

  const victory = outcome === 'victory' && floorsCleared === dungeon.floors.length
  const hadTank = party.some((member) => classById(member.hero.classId).role === 'tank')
  // Healing potions stand in for a healer (Docs/depth.md 3a).
  const hadHealer = party.some((member) => classById(member.hero.classId).role === 'healer') || (supplies.heal ?? 0) > 0
  const treasure = party.some((member) => member.hero.traitIds.includes('treasure') && member.hero.condition !== 'dead')
  // A loss still brings home a little loot from the floors that were cleared,
  // so a struggling village always has some income.
  // A disarmed trap also gives up what it guarded (Docs/depth.md 3b).
  const gold =
    (victory
      ? Math.round(dungeon.gold * (treasure ? 1.25 : 1))
      : Math.round((dungeon.gold * progression.defeatGoldShare * floorsCleared) / dungeon.floors.length)) +
    traps.disarmed * Math.round(dungeon.gold * magicRules.disarmGold)
  // A loss still teaches something: half the XP, for the share of floors cleared.
  const xp = victory ? dungeon.xp : Math.round((dungeon.xp * progression.defeatXpShare * floorsCleared) / dungeon.floors.length)
  if (victory) {
    log.push({ tick: ticks, key: 'log.victory', params: {} })
  }

  const report: DungeonReport = {
    dungeonId,
    party: party.map(({ hero }) => ({ id: hero.id, classId: hero.classId, gender: hero.gender, age: hero.age, ...(hero.genes ? { genes: hero.genes } : {}) })),
    floors,
    victory,
    defeatReason: victory
      ? null
      : defeatReason(outcome, dungeon.tier, hadTank, hadHealer, averageLevel(party), dungeon.recommendedLevel, statusToll(heroes)),
    ticks,
    floorsCleared,
    gold,
    xp,
    ...(carried ? { potionsUsed: kit.used } : {}),
    ...(hasTraps ? { traps } : {}),
    units: heroUnitsToReport(heroes),
    log,
    conditions: heroes.map((hero) => ({
      id: hero.refId,
      condition: judgeCondition(hero),
      // Short early trips tire a hero a little; deeper ones more (Docs/fatigue.md).
      fatigue: tripFatigue(dungeon.tier) + (hero.hp > 0 ? 0 : lifeRules.fatigue.downedExtra),
    })),
  }
  return { ok: true, report }
}

export function tripFatigue(tier: number): number {
  const gain = lifeRules.fatigue.gainByTier
  return gain[Math.max(0, Math.min(gain.length, tier) - 1)] ?? 0
}

export function applyReport(hero: Hero, report: DungeonReport): Hero {
  const next = report.conditions.find((entry) => entry.id === hero.id)
  if (!next) {
    return hero
  }
  let xp = hero.xp + report.xp
  let level = hero.level
  while (xp >= level * progression.xpPerLevel) {
    xp -= level * progression.xpPerLevel
    level += 1
  }
  const skillPoints = (hero.skillPoints ?? 0) + (level - hero.level) * lifeRules.skillPointsPerLevel
  const rank = { healthy: 0, fatigued: 1, injured: 2, critical: 3, dead: 4 }
  const condition = rank[next.condition] > rank[hero.condition] ? next.condition : hero.condition
  // Each level is a round of hard-won experience: every stat grows by the training it adds.
  const grown = level > hero.level ? createHero({ ...hero, training: hero.training + (level - hero.level) * progression.trainingPerLevel }) : hero
  return {
    ...grown,
    xp,
    level,
    skillPoints,
    condition,
    fatigue: Math.min(100, hero.fatigue + next.fatigue),
  }
}

export type StatusToll = { poisonShare: number; stunned: number; muted: number; trapShare?: number; ambushShare?: number; blastShare?: number }

// How much the statuses cost the party: poison's share of the damage taken,
// turns lost to paralysis or slow, and support turns lost to silence.
function statusToll(heroes: BattleUnit[]): StatusToll {
  const taken = heroes.reduce((sum, hero) => sum + hero.taken, 0)
  const poison = heroes.reduce((sum, hero) => sum + hero.poisonTaken, 0)
  return {
    poisonShare: taken > 0 ? poison / taken : 0,
    stunned: heroes.reduce((sum, hero) => sum + hero.stunned, 0),
    muted: heroes.reduce((sum, hero) => sum + hero.muted, 0),
    trapShare: taken > 0 ? heroes.reduce((sum, hero) => sum + hero.trapTaken, 0) / taken : 0,
    ambushShare: taken > 0 ? heroes.reduce((sum, hero) => sum + hero.ambushTaken, 0) / taken : 0,
    blastShare: taken > 0 ? heroes.reduce((sum, hero) => sum + hero.blastTaken, 0) / taken : 0,
  }
}

export function defeatReason(
  outcome: 'wipe' | 'retreat' | 'timeout' | 'victory',
  tier: 1 | 2 | 3 | 4 | 5 | 6,
  hadTank: boolean,
  hadHealer: boolean,
  averageLevel: number,
  recommendedLevel: number,
  toll: StatusToll = { poisonShare: 0, stunned: 0, muted: 0 },
): DungeonReport['defeatReason'] {
  if (outcome === 'retreat') {
    return 'retreated'
  }
  // Missing a tank or a healer is named first at every tier: it is the most useful advice.
  if (!hadTank && tier >= 1) {
    return 'noTank'
  }
  if (!hadHealer && tier >= 1) {
    return 'noHealer'
  }
  // Then the status that hurt most, with the potion that answers it.
  if (toll.poisonShare >= combatRules.poisonedShare) {
    return 'poisoned'
  }
  if (toll.muted >= combatRules.silencedTurns) {
    return 'silenced'
  }
  if (toll.stunned >= combatRules.stunnedTurns) {
    return 'paralyzed'
  }
  // Then the fortress dangers, with the rogue or trinket that answers them.
  if ((toll.trapShare ?? 0) >= combatRules.trappedShare) {
    return 'trapped'
  }
  if ((toll.ambushShare ?? 0) >= combatRules.ambushedShare) {
    return 'ambushed'
  }
  // A boss blast nobody broke or braced for (Docs/depth.md 3c).
  if ((toll.blastShare ?? 0) >= combatRules.blastedShare) {
    return 'blasted'
  }
  if ((outcome === 'wipe' || outcome === 'timeout') && averageLevel < recommendedLevel) {
    return 'tooWeak'
  }
  if (outcome === 'timeout') {
    return 'outmatched'
  }
  return 'wiped'
}

function averageLevel(party: PartyMember[]): number {
  return party.reduce((sum, member) => sum + member.hero.level, 0) / party.length
}

function judgeCondition(unit: BattleUnit): Condition {
  if (unit.hp <= 0) {
    const ratio = unit.overkill / unit.maxHp
    if (ratio >= 0.55) {
      return 'dead'
    }
    if (ratio >= 0.3 || unit.frail) {
      return 'critical'
    }
    return 'injured'
  }
  if (unit.hp / unit.maxHp < 0.6) {
    return 'fatigued'
  }
  return 'healthy'
}

// One number to compare heroes on cards. It reads the same combat unit the
// battle uses (so fatigue and injuries count) but never decides a fight.
export function heroPower(hero: Hero): number {
  const unit = createHeroUnit({ hero, row: 'front' }, 0)
  return Math.round(unit.attack * 2 + unit.defense * 2 + unit.maxHp / 4 + unit.speed + unit.heal)
}
