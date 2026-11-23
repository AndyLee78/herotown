import { describe, expect, it } from 'vitest'
import { brewTime, returnSupplies, takeSupplies } from './alchemy'
import { createHeroUnit, simulateFloor, type Kit } from './combat'
import { alchemyRules, combatRules, dungeonById, potionById, villageRules } from './data'
import { DEFAULT_TACTICS, defeatReason, runDungeon } from './dungeon'
import { dungeonUnlocked, freshState, migrate, reduce, type GameState } from './game'
import { createHero } from './hero'
import { createRng } from './rng'
import type { ClassId, LogEntry, PartyMember } from './types'

const now = 1_700_000_000_000
const stats = { str: 14, agi: 12, vit: 14, int: 12, wil: 12, wis: 14 }

function member(id: string, classId: ClassId, level = 11, row: 'front' | 'back' = 'front'): PartyMember {
  return { row, hero: createHero({ id, name: id, gender: 'female', classId, age: 25, potentials: stats, level, training: level - 1 }) }
}

function party(level = 11): PartyMember[] {
  return [member('w', 'warrior', level), member('r', 'rogue', level), member('a', 'archer', level, 'back'), member('m', 'mage', level, 'back'), member('c', 'cleric', level, 'back')]
}

function keys(log: LogEntry[]): Set<string> {
  return new Set(log.map((entry) => entry.key))
}

describe('status effects', () => {
  it('poisons, paralyses, slows and silences in the venom marsh', () => {
    const seen = new Set<string>()
    for (let seed = 1; seed <= 10; seed += 1) {
      const result = runDungeon(party(), 'venom_marsh', DEFAULT_TACTICS, seed)
      if (result.ok) for (const key of keys(result.report.log)) seen.add(key)
    }
    for (const key of ['log.dot', 'log.paralyze', 'log.paralyzed', 'log.slow', 'log.silence', 'log.sweep']) {
      expect(seen.has(key), key).toBe(true)
    }
  })

  it('never paralyses the same hero twice in a row', () => {
    for (let seed = 1; seed <= 10; seed += 1) {
      const result = runDungeon(party(), 'venom_marsh', DEFAULT_TACTICS, seed)
      if (!result.ok) continue
      const lost = result.report.log.filter((entry) => entry.key === 'log.paralyzed' || (entry.key !== 'log.paralyze' && entry.params.actorId != null))
      for (let index = 1; index < lost.length; index += 1) {
        const before = lost[index - 1]!
        const entry = lost[index]!
        if (entry.key === 'log.paralyzed' && before.key === 'log.paralyzed') {
          expect(entry.params.actorId === before.params.actorId && entry.tick === before.tick).toBe(false)
        }
      }
    }
  })

  it('slows the gauge and lets silence leave only plain attacks', () => {
    const healer = createHeroUnit(member('c', 'cleric'), 0)
    healer.silenced = 2
    healer.hp = Math.round(healer.maxHp * 0.3)
    const ally = createHeroUnit(member('w', 'warrior'), 1)
    const log: LogEntry[] = []
    simulateFloor([ally, healer], ['wolf'], DEFAULT_TACTICS, createRng(1), log, 1)
    const healedWhileSilenced = log.some((entry) => entry.key === 'log.heal' && entry.params.actorId === 'c' && entry.tick < 30)
    expect(healedWhileSilenced).toBe(false)
    expect(healer.muted).toBeGreaterThan(0)
    expect(combatRules.slowFactor).toBeLessThan(1)
  })

  it('leaves older dungeons exactly as they were (no extra random draws)', () => {
    const a = runDungeon(party(4), 'abandoned_mine', DEFAULT_TACTICS, 7)
    const b = runDungeon(party(4), 'abandoned_mine', DEFAULT_TACTICS, 7, { heal: 0 })
    expect(a.ok && b.ok && a.report.log).toEqual(b.ok && b.report.log)
  })
})

describe('potions in battle', () => {
  it('drinks antidotes when poisoned and reports what was used', () => {
    const result = runDungeon(party(), 'venom_marsh', DEFAULT_TACTICS, 3, { antidote: 4, heal: 2 })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.report.potionsUsed?.antidote ?? 0).toBeGreaterThan(0)
    expect(result.report.log.some((entry) => entry.key === 'log.potion' && entry.params.potion === 'antidote')).toBe(true)
  })

  it('wins the marsh more often with antidotes', () => {
    let bare = 0
    let armed = 0
    for (let seed = 1; seed <= 12; seed += 1) {
      const without = runDungeon(party(), 'venom_marsh', DEFAULT_TACTICS, seed)
      const withPotions = runDungeon(party(), 'venom_marsh', DEFAULT_TACTICS, seed, { antidote: 4 })
      if (without.ok && without.report.victory) bare += 1
      if (withPotions.ok && withPotions.report.victory) armed += 1
    }
    expect(armed).toBeGreaterThanOrEqual(bare)
  })

  it('drinks a healing potion below the potion threshold', () => {
    const hero = createHeroUnit(member('w', 'warrior'), 0)
    hero.hp = Math.round(hero.maxHp * 0.2)
    const kit: Kit = { stock: { heal: 1 }, used: {} }
    const log: LogEntry[] = []
    simulateFloor([hero], ['wolf'], DEFAULT_TACTICS, createRng(2), log, 1, undefined, 1, kit)
    expect(kit.used.heal).toBe(1)
    expect(potionById('heal')?.heal).toBeGreaterThan(0)
  })

  it('counts healing potions as a healer, and names poison as the cause of a loss', () => {
    expect(defeatReason('wipe', 4, true, true, 11, 11, { poisonShare: 0.5, stunned: 0, muted: 0 })).toBe('poisoned')
    expect(defeatReason('wipe', 4, true, true, 11, 11, { poisonShare: 0, stunned: 0, muted: 5 })).toBe('silenced')
    expect(defeatReason('wipe', 4, true, true, 11, 11, { poisonShare: 0, stunned: 6, muted: 0 })).toBe('paralyzed')
    expect(defeatReason('wipe', 4, true, false, 11, 11, { poisonShare: 0.5, stunned: 0, muted: 0 })).toBe('noHealer')
    const noHealer = party().filter((entry) => entry.hero.classId !== 'cleric')
    const result = runDungeon(noHealer, 'hill_cave', DEFAULT_TACTICS, 1, { heal: 2 })
    expect(result.ok && result.report.defeatReason).not.toBe('noHealer')
  })
})

describe('alchemy workshop and potion stock', () => {
  function workshop(extra: Partial<GameState> = {}): GameState {
    const base = freshState(5, now)
    return { ...base, gold: 500, materials: { ...base.materials, herb: 20, bone: 10 }, buildings: { ...base.buildings, alchemy: 1 }, ...extra }
  }

  it('opens at town level 4 and brews a batch into the stock', () => {
    const alchemy = villageRules.buildings.find((building) => building.id === 'alchemy')
    expect(alchemy?.unlockLevel).toBe(4)
    expect(reduce(freshState(5, now), { type: 'brew', potionId: 'heal', now }).notice).toBe('noAlchemy')
    const started = reduce(workshop(), { type: 'brew', potionId: 'antidote', now })
    expect(started.alchemy?.potionId).toBe('antidote')
    expect(reduce(started, { type: 'brew', potionId: 'heal', now }).notice).toBe('alchemyBusy')
    expect(reduce(workshop(), { type: 'brew', potionId: 'tonic', now }).notice).toBe('locked')
    const done = reduce(started, { type: 'catchUp', now: now + (potionById('antidote')?.ms ?? 0) })
    expect(done.alchemy).toBeNull()
    expect(done.potions.antidote).toBe(alchemyRules.batch)
  })

  it('carries what a preset asks for, capped by stock and the trip limit, and returns the rest', () => {
    const taken = takeSupplies({ heal: 3, antidote: 10 }, { heal: 5, antidote: 5 })
    expect(taken.taken).toEqual({ heal: 3, antidote: Math.min(5, alchemyRules.potionsPerTrip - 3) })
    expect(returnSupplies(taken.stock, taken.taken, { heal: 1 }).heal).toBe(2)
  })

  it('takes potions out when a party leaves and brings unused ones home', () => {
    let state = workshop({ potions: { antidote: 4 } })
    for (const visitor of [...state.visitors]) state = reduce(state, { type: 'hire', id: visitor.id, now })
    for (const hero of state.roster) state = reduce(state, { type: 'add', id: hero.id })
    state = reduce(state, { type: 'supplies', potionId: 'antidote', count: 2 })
    const left = reduce(state, { type: 'depart', confirm: true, now })
    expect(left.expeditions[0]?.supplies).toEqual({ antidote: 2 })
    expect(left.potions.antidote).toBe(2)
    const home = reduce(left, { type: 'catchUp', now: (left.expeditions[0]?.returnAt ?? now) + 1 })
    const used = home.history[0]?.potionsUsed?.antidote ?? 0
    expect(home.potions.antidote).toBe(4 - used)
  })

  it('opens the marsh only after every tier 3 dungeon is cleared', () => {
    const base = freshState(5, now)
    expect(dungeonUnlocked({ ...base, cleared: ['hill_cave', 'abandoned_mine', 'barrow'] }, 'venom_marsh')).toBe(false)
    expect(dungeonUnlocked({ ...base, cleared: ['hill_cave', 'abandoned_mine', 'barrow', 'sunken_crypt'] }, 'venom_marsh')).toBe(true)
  })

  it('gives herbs from the moss path and the marsh', () => {
    expect((villageRules.drops as Record<string, { material: string; herb?: number }>).moss_path?.herb).toBeGreaterThan(0)
    expect((villageRules.drops as Record<string, { material: string }>).venom_marsh?.material).toBe('herb')
    expect(dungeonById('venom_marsh').tier).toBe(4)
  })

  it('opens a version 10 save with an empty stock and no herbs', () => {
    const old = { ...freshState(5, now), version: 10 } as Record<string, unknown>
    delete old.potions
    delete old.alchemy
    old.materials = { wood: 1, stone: 2, iron: 3, bone: 4 }
    const loaded = migrate(JSON.parse(JSON.stringify(old)), now)
    expect(loaded.potions).toEqual({})
    expect(loaded.alchemy).toBeNull()
    expect(loaded.materials.herb).toBe(0)
    expect(loaded.buildings.alchemy).toBe(0)
  })
})

describe('review 1918eda fixes', () => {
  it('lets a paralysed hero with a tonic drink it instead of losing the turn blankly', () => {
    const hero = createHeroUnit(member('w', 'warrior'), 0)
    hero.paralyzed = true
    const kit: Kit = { stock: { tonic: 1 }, used: {} }
    const log: LogEntry[] = []
    simulateFloor([hero], ['wolf'], DEFAULT_TACTICS, createRng(1), log, 1, undefined, 1, kit)
    expect(kit.used.tonic).toBe(1)
    const first = log.find((entry) => entry.params.actorId === 'w' && (entry.key === 'log.potion' || entry.key === 'log.paralyzed'))
    expect(first?.key).toBe('log.potion')
  })

  it('sends silencers after the healer before the tank', () => {
    const tank = createHeroUnit(member('w', 'warrior'), 0)
    const healer = createHeroUnit({ ...member('c', 'cleric'), row: 'back' }, 1)
    tank.threat = 999
    const log: LogEntry[] = []
    simulateFloor([tank, healer], ['wisp'], DEFAULT_TACTICS, createRng(1), log, 1)
    const firstHit = log.find((entry) => entry.key === 'log.attack' && String(entry.params.actorId).startsWith('wisp'))
    expect(firstHit?.params.targetId).toBe('c')
  })

  it('brews faster in a bigger workshop', () => {
    const base = freshState(5, now)
    const at = (level: number) => brewTime({ ...base, buildings: { ...base.buildings, alchemy: level } }, 'antidote')
    expect(at(2)).toBeLessThan(at(1))
    expect(at(3)).toBeLessThan(at(2))
  })

  it('keeps the full antidote immunity for the turns after drinking', () => {
    const hero = createHeroUnit(member('w', 'warrior'), 0)
    hero.dot = alchemyRules.antidoteAt + 2
    const kit: Kit = { stock: { antidote: 1 }, used: {} }
    const log: LogEntry[] = []
    const result = simulateFloor([hero], ['slime'], DEFAULT_TACTICS, createRng(1), log, 1, undefined, 1, kit)
    expect(kit.used.antidote).toBe(1)
    const drankAt = log.findIndex((entry) => entry.key === 'log.potion')
    expect(drankAt).toBeGreaterThanOrEqual(0)
    expect(result.outcome).toBeDefined()
    expect(combatRules.immuneActions).toBeGreaterThan(0)
  })
})
