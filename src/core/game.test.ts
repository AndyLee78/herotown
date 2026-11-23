import { describe, expect, it } from 'vitest'
import { adRules, lifeRules, progression, smithRules, timeRules, villageRules } from './data'
import { createHeroUnit } from './combat'
import { DEFAULT_TACTICS, runDungeon } from './dungeon'
import { SAVE_VERSION, applyCasualty, exportSave, freshState, importSave, migrate, reduce, townLevel, visitorStay } from './game'
import type { AbsenceReport, GameState } from './game'
import { forgeGear, recipeById } from './gear'
import { createHero, generateHero, withAge } from './hero'
import { createRng } from './rng'

const now = 1_700_000_000_000

describe('game state', () => {
  it('hires only through the action and keeps the same combat seed inputs', () => {
    const start = freshState(4, now)
    const hired = reduce(start, { type: 'hire', id: start.visitors[0]?.id ?? '' })
    expect(hired.roster).toHaveLength(1)
    expect(hired.gold).toBe(start.gold - 35)
    expect(hired.visitors).toHaveLength(4)
    expect(reduce(hired, { type: 'hire', id: 'missing' }).notice).toBe('missing')
  })

  it('migrates a version 1 save without dropping the roster', () => {
    const start = freshState(4, now)
    const hired = reduce(start, { type: 'hire', id: start.visitors[0]?.id ?? '' })
    const legacy = { ...hired, version: 1, calendar: undefined, lastTickAt: undefined, absence: undefined, notice: undefined }
    const migrated = migrate(legacy, now + 1000)
    expect(migrated.version).toBe(SAVE_VERSION)
    expect(migrated.ads.counts.absence).toBe(0)
    expect(migrated.roster.map((hero) => hero.id)).toEqual(hired.roster.map((hero) => hero.id))
    expect(migrated.calendar.season).toBe('spring')
    expect(migrated.absence).toBeNull()
  })

  it('caps offline time at 12 hours and reports it', () => {
    const start = freshState(1, now)
    const later = reduce(start, { type: 'catchUp', now: now + timeRules.maxOfflineMs + timeRules.seasonMs })
    expect(later.absence?.capped).toBe(true)
    expect(later.absence?.elapsedMs).toBe(timeRules.maxOfflineMs)
    expect(later.calendar.season).toBe('spring')
    const next = reduce(later, { type: 'catchUp', now: later.lastTickAt + timeRules.maxOfflineMs })
    expect(next.calendar.season).toBe('summer')
    expect(next.absence?.seasonsPassed).toBe(1)
  })

  it('stays quiet during a short tick', () => {
    const start = freshState(1, now)
    const ticked = reduce(start, { type: 'catchUp', now: now + timeRules.tickMs })
    expect(ticked.absence).toBeNull()
    expect(ticked.lastTickAt).toBe(now + timeRules.tickMs)
  })

  it('round-trips a save file and rejects a bad checksum', () => {
    const start = reduce(freshState(3, now), { type: 'debugGold' })
    const file = exportSave(start)
    expect(importSave(file, now + 5).gold).toBe(start.gold)
    const broken = file.replace(/"checksum":"[0-9a-f]+"/, '"checksum":"00000000"')
    expect(() => importSave(broken, now)).toThrow('checksum')
  })

  it('builds one house at a time and finishes it when the clock catches up', () => {
    const start = freshState(1, now)
    const started = reduce(start, { type: 'build', id: 'house', now })
    expect(started.construction?.id).toBe('house')
    expect(started.materials.wood).toBe(start.materials.wood - 20)
    expect(reduce(started, { type: 'build', id: 'inn', now }).notice).toBe('building')
    const finishAt = started.construction?.finishAt ?? now
    const done = reduce(started, { type: 'catchUp', now: finishAt })
    expect(done.buildings.house).toBe(2)
    expect(done.construction).toBeNull()
    expect(done.absence?.completed).toEqual(['house'])
    expect(done.fame).toBe(4)
    const again = reduce(freshState(1, now), { type: 'build', id: 'house', now })
    const instant = reduce(again, { type: 'finishBuild', now })
    expect(instant.buildings.house).toBe(2)
    expect(instant.construction).toBeNull()
  })

  it('keeps guild locked until the town level rises, then improves visitors', () => {
    const start = freshState(1, now)
    expect(reduce(start, { type: 'build', id: 'guild', now }).notice).toBe('locked')
    expect(townLevel(12).level).toBe(2)
    expect(townLevel(12).visitorPotential).toBe(10)
    const plain = generateHero(createRng(1), 'a', 0)
    const better = generateHero(createRng(1), 'b', 10)
    expect(better.potential - plain.potential).toBe(10)
  })

  it('stops hiring when the house has no free beds and warns when wages cannot be paid', () => {
    const start = freshState(2, now)
    const cramped = { ...start, buildings: { ...start.buildings, house: 0 } }
    expect(reduce(cramped, { type: 'hire', id: cramped.visitors[0]?.id ?? '' }).notice).toBe('beds')
    const hired = reduce(start, { type: 'hire', id: start.visitors[0]?.id ?? '' })
    const broke = {
      ...hired,
      gold: 0,
      calendar: { ...hired.calendar, intoSeasonMs: timeRules.seasonMs - 1000 },
    }
    const season = reduce(broke, { type: 'catchUp', now: now + timeRules.reportAfterMs })
    expect(season.warning).toBe('wages')
    expect(season.calendar.season).toBe('summer')
    expect(season.absence?.wagesPaid).toBe(0)
  })

  it('replaces a visitor when their stay ends', () => {
    const start = freshState(1, now)
    const ids = new Set(start.visitors.map((hero) => hero.id))
    const earliest = Math.min(...start.visitors.map((hero) => hero.arrivedAt ?? now))
    const turned = reduce(start, { type: 'catchUp', now: earliest + visitorStay(1) })
    expect(turned.visitors).toHaveLength(start.visitors.length)
    expect(turned.visitors.some((hero) => !ids.has(hero.id))).toBe(true)
    expect(turned.visitors.some((hero) => ids.has(hero.id))).toBe(true)
  })

  it('sends a visitor as soon as the inn has a free bed and the old timer is far away', () => {
    const start = freshState(1, now)
    const empty = { ...start, visitors: [], nextVisitorAt: now + timeRules.seasonMs }
    const arrived = reduce(empty, { type: 'catchUp', now: now + 1000 })
    expect(arrived.visitors).toHaveLength(1)
    expect(arrived.absence).toBeNull()
  })

  it('lets the house clear fatigue and leaves injuries for the temple', () => {
    const start = freshState(1, now)
    const hired = reduce(start, { type: 'hire', id: start.visitors[0]?.id ?? '' })
    const id = hired.roster[0]?.id ?? ''
    const injured = {
      ...hired,
      roster: hired.roster.map((hero) => ({ ...hero, condition: 'injured' as const, fatigue: 10 })),
    }
    const rested = reduce(injured, { type: 'rest', times: 1 })
    expect(rested.roster[0]?.condition).toBe('injured')
    expect(rested.roster[0]?.fatigue).toBe(0)
    expect(reduce(rested, { type: 'treat', id, now }).notice).toBe('noTemple')
    const temple = { ...rested, buildings: { ...rested.buildings, temple: 1 } }
    const treating = reduce(temple, { type: 'treat', id, now })
    const healed = reduce(treating, { type: 'catchUp', now: now + lifeRules.treatMs })
    expect(healed.roster[0]?.condition).toBe('fatigued')
  })

  it('warns before a hero who has seen death enters the mine', () => {
    const start = freshState(1, now)
    const hired = reduce(start, { type: 'hire', id: start.visitors[0]?.id ?? '' })
    const id = hired.roster[0]?.id ?? ''
    const marked = {
      ...hired,
      dungeonId: 'abandoned_mine',
      roster: hired.roster.map((hero) => ({ ...hero, deaths: 1 })),
      party: [{ id, row: 'front' as const }],
    }
    const warned = reduce(marked, { type: 'depart' })
    expect(warned.notice).toBe('seenDeath')
    expect(warned.report).toBeNull()
  })

  it('keeps a first death on the roster and buries the second', () => {
    const start = freshState(1, now)
    const hired = reduce(start, { type: 'hire', id: start.visitors[0]?.id ?? '' })
    const hero = hired.roster[0]
    if (!hero) {
      throw new Error('missing hero')
    }
    const report = {
      victory: false,
      defeatReason: 'wiped' as const,
      ticks: 1,
      floorsCleared: 0,
      gold: 0,
      xp: 0,
      units: [],
      log: [],
      conditions: [{ id: hero.id, condition: 'dead' as const, fatigue: 55 }],
    }
    const first = applyCasualty(hero, report, 'hill_cave', false, createRng(1))
    expect(first.hero?.deaths).toBe(1)
    expect(first.hero?.condition).toBe('dead')
    expect(first.grave).toBeNull()
    const second = applyCasualty(first.hero ?? hero, report, 'hill_cave', false, createRng(2))
    expect(second.hero).toBeNull()
    expect(second.grave?.name).toBe(hero.name)
    const dead = {
      ...hired,
      gold: hired.gold + lifeRules.reviveCost,
      buildings: { ...hired.buildings, temple: 1 },
      roster: first.hero ? [first.hero] : [],
    }
    const reviving = reduce(dead, { type: 'revive', id: hero.id, now })
    const back = reduce(reviving, { type: 'catchUp', now: now + lifeRules.reviveMs })
    expect(back.roster[0]?.condition).toBe('injured')
    expect(back.roster[0]?.deaths).toBe(1)
  })

  it('forges a weapon from iron, then lets a hero wear it', () => {
    const start = freshState(1, now)
    expect(reduce(start, { type: 'craft', recipeId: 'iron.blade', now }).notice).toBe('noSmith')
    const ready = {
      ...start,
      buildings: { ...start.buildings, smith: 1 },
      materials: { ...start.materials, iron: 20, wood: 20 },
    }
    const job = reduce(ready, { type: 'craft', recipeId: 'iron.blade', now })
    expect(job.smith?.recipeId).toBe('iron.blade')
    expect(job.materials.iron).toBe(16)
    expect(reduce(job, { type: 'craft', recipeId: 'iron.mail', now }).notice).toBe('smithBusy')
    const done = reduce(job, { type: 'catchUp', now: now + smithRules.recipes[1].ms })
    expect(done.stash).toHaveLength(1)
    expect(done.smith).toBeNull()
    const hired = reduce(done, { type: 'hire', id: done.visitors[0]?.id ?? '', now })
    const heroId = hired.roster[0]?.id ?? ''
    const gearId = hired.stash[0]?.id ?? ''
    const worn = reduce(hired, { type: 'equip', heroId, gearId })
    expect(worn.roster[0]?.gear.some((item) => item.recipeId === 'iron.blade')).toBe(true)
    expect(worn.stash.some((item) => item.recipeId === 'starter')).toBe(true)
  })

  it('gives a rare weapon one option and keeps the starter weapon from changing attack', () => {
    const start = freshState(3, now)
    const ready = {
      ...start,
      buildings: { ...start.buildings, smith: 3 },
      gold: 500,
      materials: { wood: 40, stone: 40, iron: 40, bone: 0 },
    }
    const job = reduce(ready, { type: 'craft', recipeId: 'flame.blade', now })
    const done = reduce(job, { type: 'catchUp', now: now + 7_200_000 })
    expect(done.stash[0]?.element).toBe('flame')
    expect(done.stash[0]?.option === 'power' || done.stash[0]?.option === 'guard').toBe(true)
    expect(done.absence?.crafted).toEqual(['flame.blade'])
    const naked = createHero({
      id: 'a',
      name: 'A',
      gender: 'female',
      classId: 'warrior',
      age: 28,
      potentials: { str: 15, agi: 10, vit: 15, int: 4, wil: 8, wis: 4 },
      gear: [],
    })
    const starter = createHero({ ...naked, id: 'b', gear: undefined })
    expect(createHeroUnit({ hero: starter, row: 'front' }, 0).attack).toBe(createHeroUnit({ hero: naked, row: 'front' }, 0).attack)
  })

  it('turns a lost mine into a clear once the party wears forged iron', () => {
    const stats = { str: 10, agi: 10, vit: 10, int: 4, wil: 6, wis: 14 }
    const member = (id: string, classId: 'warrior' | 'rogue' | 'archer' | 'bard' | 'cleric', row: 'front' | 'back') => ({
      row,
      hero: createHero({
        id,
        name: id,
        gender: classId === 'bard' ? 'female' : 'male',
        classId,
        age: 22,
        potentials: stats,
        gear: [],
      }),
    })
    const party = [
      member('w', 'warrior', 'front'),
      member('r', 'rogue', 'front'),
      member('a', 'archer', 'back'),
      member('b', 'bard', 'back'),
      member('c', 'cleric', 'back'),
    ]
    const blade = recipeById('iron.blade')
    const mail = recipeById('iron.mail')
    if (!blade || !mail) {
      throw new Error('missing recipe')
    }
    const armed = party.map((slot) => ({
      ...slot,
      hero: {
        ...slot.hero,
        gear: [forgeGear(blade, `${slot.hero.id}-blade`), forgeGear(mail, `${slot.hero.id}-mail`)],
      },
    }))
    const bare = runDungeon(party, 'abandoned_mine', DEFAULT_TACTICS, 11)
    const geared = runDungeon(armed, 'abandoned_mine', DEFAULT_TACTICS, 11)
    expect(bare.ok && bare.report.victory).toBe(false)
    expect(geared.ok && geared.report.victory).toBe(true)
  })

  it('pays a smaller repeat reward and runs a cleared dungeon while time passes', () => {
    const start = freshState(8, now)
    const hero = createHero({
      id: 'tank',
      name: 'Tank',
      gender: 'male',
      classId: 'warrior',
      age: 28,
      potentials: { str: 18, agi: 12, vit: 18, int: 6, wil: 8, wis: 6 },
      gear: [],
    })
    const cleric = createHero({
      id: 'heal',
      name: 'Heal',
      gender: 'female',
      classId: 'cleric',
      age: 28,
      potentials: { str: 6, agi: 8, vit: 12, int: 8, wil: 12, wis: 18 },
      gear: [],
    })
    const ready = {
      ...start,
      cleared: ['hill_cave'],
      fame: 12,
      materials: { ...start.materials, wood: 0 },
      roster: [hero, cleric],
      party: [
        { id: hero.id, row: 'front' as const },
        { id: cleric.id, row: 'back' as const },
      ],
    }
    const again = reduce(ready, { type: 'depart' })
    expect(again.report?.victory).toBe(true)
    expect(again.materials.wood).toBeLessThan(4)
    expect(again.fame).toBe(12)
    const watching = reduce(again, { type: 'autoDungeon', id: 'hill_cave' })
    const running = reduce({ ...watching, auto: { ...watching.auto, enabled: true } }, { type: 'catchUp', now: now + villageRules.auto.runMs })
    expect(running.gold).toBeGreaterThan(watching.gold)
    expect(running.materials.wood).toBeGreaterThan(watching.materials.wood)
    expect(running.roster.every((entry) => entry.condition !== 'dead')).toBe(true)
  })

  it('clears the barrow with a silver weapon after physical blows fail', () => {
    const blade = recipeById('silver.edge')
    if (!blade) {
      throw new Error('missing silver edge')
    }
    const make = (silver: boolean) => {
      const specs = [
        ['w', 'warrior', 'front', { str: 16, agi: 10, vit: 16, int: 4, wil: 8, wis: 4 }],
        ['r', 'rogue', 'front', { str: 8, agi: 16, vit: 8, int: 5, wil: 6, wis: 5 }],
        ['a', 'archer', 'back', { str: 7, agi: 15, vit: 8, int: 6, wil: 7, wis: 6 }],
        ['m', 'mage', 'back', { str: 4, agi: 9, vit: 7, int: 16, wil: 8, wis: 9 }],
        ['b', 'bard', 'back', { str: 5, agi: 10, vit: 9, int: 8, wil: 14, wis: 8 }],
      ] as const
      return specs.map(([id, classId, row, potentials]) => ({
        row,
        hero: createHero({
          id,
          name: id,
          gender: 'male',
          classId,
          age: 28,
          potentials,
          gear: silver ? [forgeGear(blade, `${id}-silver`)] : [],
        }),
      }))
    }
    const bare = runDungeon(make(false), 'barrow', DEFAULT_TACTICS, 4)
    const armed = runDungeon(make(true), 'barrow', DEFAULT_TACTICS, 4)
    expect(bare.ok && bare.report.victory).toBe(false)
    expect(armed.ok && armed.report.victory).toBe(true)
  })
})

describe('economy fixes', () => {
  // Hire every visitor, field them all and clear the cave once by hand.
  function clearedCave(seed: number) {
    let state = freshState(seed, now)
    for (const visitor of [...state.visitors]) {
      state = reduce(state, { type: 'hire', id: visitor.id, now })
    }
    for (const hero of state.roster) {
      state = reduce(state, { type: 'add', id: hero.id })
    }
    state = reduce(state, { type: 'depart' })
    expect(state.report?.victory).toBe(true)
    return state
  }

  it('pays an automatic run less than repeating the dungeon by hand', () => {
    const cleared = clearedCave(7)
    const manual = reduce(cleared, { type: 'depart' })
    const manualGold = manual.gold - cleared.gold
    const manualWood = manual.materials.wood - cleared.materials.wood
    let auto = reduce(cleared, { type: 'auto', enabled: true })
    auto = reduce(auto, { type: 'autoDungeon', id: 'hill_cave' })
    const ran = reduce(auto, { type: 'catchUp', now: auto.lastTickAt + villageRules.auto.runMs })
    expect(ran.report?.victory).toBe(true)
    const autoGold = ran.gold - auto.gold
    expect(autoGold).toBeGreaterThan(0)
    expect(autoGold).toBeLessThan(manualGold)
    expect(ran.materials.wood - auto.materials.wood).toBeLessThanOrEqual(manualWood)
  })

  it('reports income and wages separately after time away', () => {
    let state = clearedCave(7)
    state = reduce(state, { type: 'auto', enabled: true })
    state = reduce(state, { type: 'autoDungeon', id: 'hill_cave' })
    state = { ...state, calendar: { ...state.calendar, intoSeasonMs: timeRules.seasonMs - 1000 } }
    const later = reduce(state, { type: 'catchUp', now: state.lastTickAt + timeRules.reportAfterMs })
    const report = later.absence
    expect(report).not.toBeNull()
    expect(report?.wagesPaid).toBe(state.roster.length * progression.wage)
    expect(report?.goldGained).toBe(report?.autoGold)
    expect(report?.goldGained).toBeGreaterThan(0)
    expect(later.gold - state.gold).toBe((report?.goldGained ?? 0) - (report?.wagesPaid ?? 0))
  })

  it('lets heroes rest without spending gold', () => {
    const start = freshState(1, now)
    const hired = reduce(start, { type: 'hire', id: start.visitors[0]?.id ?? '' })
    const tired = { ...hired, roster: hired.roster.map((hero) => ({ ...hero, fatigue: 80 })) }
    const rested = reduce(tired, { type: 'rest', times: 1 })
    expect(rested.gold).toBe(tired.gold)
    expect(rested.roster[0]?.fatigue).toBeLessThan(80)
  })

  it('pays an absence ad once, stops at the daily cap, and resets on the next local date', () => {
    const day = new Date(2026, 10, 22, 15).getTime()
    const nextDay = new Date(2026, 10, 23, 15).getTime()
    const absence: AbsenceReport = {
      elapsedMs: timeRules.reportAfterMs,
      capped: false,
      seasonsPassed: 0,
      year: 1,
      season: 'spring',
      goldGained: 40,
      wagesPaid: 0,
      injuries: [],
      completed: [],
      crafted: [],
      visitors: [],
      autoRuns: 0,
      autoGold: 0,
      adClaimed: false,
      aged: [],
    }
    const start = { ...freshState(1, day), gold: 10, absence }
    const once = reduce(start, { type: 'adReward', placement: 'absence', now: day })
    expect(once.gold).toBe(50)
    expect(once.absence?.adClaimed).toBe(true)
    expect(once.ads.counts.absence).toBe(1)
    const twice = reduce(once, { type: 'adReward', placement: 'absence', now: day })
    expect(twice.gold).toBe(50)
    expect(twice.notice).toBe('adUsed')
    expect(twice.ads.counts.absence).toBe(1)

    let current: GameState = start
    for (let index = 0; index < adRules.absence.daily; index += 1) {
      current = reduce(
        { ...current, absence: { ...absence }, notice: null },
        { type: 'adReward', placement: 'absence', now: day },
      )
      expect(current.notice).toBeNull()
    }
    const blocked = reduce(
      { ...current, absence: { ...absence }, notice: null },
      { type: 'adReward', placement: 'absence', now: day },
    )
    expect(blocked.notice).toBe('adLimit')
    expect(blocked.gold).toBe(current.gold)
    const reset = reduce(
      { ...blocked, absence: { ...absence }, notice: null },
      { type: 'adReward', placement: 'absence', now: nextDay },
    )
    expect(reset.notice).toBeNull()
    expect(reset.ads.date).not.toBe(blocked.ads.date)
    expect(reset.ads.counts.absence).toBe(1)
    expect(reset.gold).toBe(blocked.gold + 40)
  })

  it('shortens construction by the larger of 30 percent and 30 minutes', () => {
    const day = new Date(2026, 10, 22, 15).getTime()
    const started = reduce(freshState(1, day), { type: 'build', id: 'house', now: day })
    const finishAt = started.construction?.finishAt ?? day
    const remaining = finishAt - day
    const cut = Math.round(Math.max(remaining * adRules.construction.shortenRatio, adRules.construction.shortenMinMs))
    const shortened = reduce(started, { type: 'adReward', placement: 'construction', now: day })
    expect(shortened.construction?.finishAt).toBe(finishAt - cut)
    expect(shortened.ads.counts.construction).toBe(1)
    expect(cut).toBeGreaterThan(adRules.construction.shortenMinMs)
  })

  it('finishes the hero currently being treated', () => {
    const day = new Date(2026, 10, 22, 15).getTime()
    const start = freshState(1, day)
    const hero = start.visitors[0]
    if (!hero) {
      throw new Error('expected a visitor')
    }
    const injured = {
      ...start,
      buildings: { ...start.buildings, temple: 1 },
      roster: [{ ...hero, condition: 'injured' as const }],
    }
    const treating = reduce(injured, { type: 'treat', id: hero.id, now: day })
    expect(treating.roster[0]?.treatAt).toBe(day + lifeRules.treatMs)
    const finished = reduce(treating, { type: 'adReward', placement: 'temple', now: day })
    expect(finished.roster[0]?.treatAt).toBeUndefined()
    expect(finished.roster[0]?.condition).toBe('fatigued')
    expect(finished.ads.counts.temple).toBe(1)
    expect(reduce(finished, { type: 'adReward', placement: 'temple', now: day }).notice).toBe('treat')
  })

  it('loads a version 2 save and starts the ad counts at zero', () => {
    const saved = { ...freshState(2, now), version: 2, ads: undefined }
    const loaded = migrate(saved, now)
    expect(loaded.version).toBe(SAVE_VERSION)
    expect(loaded.ads.counts).toEqual({ absence: 0, construction: 0, temple: 0 })
  })

  it('lowers attack, speed and max hp by fatigue and injury', () => {
    const hero = createHero({
      id: 'worn',
      name: 'Worn',
      gender: 'male',
      classId: 'warrior',
      age: 28,
      potentials: { str: 15, agi: 10, vit: 15, int: 4, wil: 8, wis: 4 },
    })
    const unit = (patch: Partial<typeof hero>) => createHeroUnit({ hero: { ...hero, ...patch }, row: 'front' }, 0)
    const healthy = unit({})
    const tired = unit({ fatigue: lifeRules.fatigue.tiredAt })
    expect(tired.attack).toBeCloseTo(healthy.attack * (1 - lifeRules.fatigue.tiredPenalty))
    expect(tired.speed).toBeCloseTo(healthy.speed * (1 - lifeRules.fatigue.tiredPenalty))
    expect(tired.maxHp).toBe(healthy.maxHp)
    const exhausted = unit({ fatigue: lifeRules.fatigue.exhaustedAt })
    expect(exhausted.attack).toBeCloseTo(healthy.attack * (1 - lifeRules.fatigue.exhaustedPenalty))
    expect(exhausted.speed).toBeCloseTo(healthy.speed * (1 - lifeRules.fatigue.exhaustedPenalty))
    const injured = unit({ condition: 'injured' })
    expect(injured.maxHp).toBe(Math.max(1, Math.round(healthy.maxHp * (1 - lifeRules.injury.injuredPenalty))))
    expect(injured.attack).toBeCloseTo(healthy.attack * (1 - lifeRules.injury.injuredPenalty))
    const critical = unit({ condition: 'critical' })
    expect(critical.attack).toBeCloseTo(healthy.attack * (1 - lifeRules.injury.criticalPenalty))
    const both = unit({ fatigue: lifeRules.fatigue.tiredAt, condition: 'injured' })
    expect(both.attack).toBeCloseTo(healthy.attack * (1 - lifeRules.fatigue.tiredPenalty) * (1 - lifeRules.injury.injuredPenalty))
    expect(unit({ fatigue: lifeRules.fatigue.exhaustedAt, stats: { ...hero.stats, agi: 1 } }).speed).toBe(1)
  })

  it('recovers fatigue faster in a better house and clears a tired hero at zero', () => {
    const start = freshState(1, now)
    const hired = reduce(start, { type: 'hire', id: start.visitors[0]?.id ?? '' })
    const hero = hired.roster[0]
    if (!hero) {
      throw new Error('expected a hero')
    }
    const tired = {
      ...hired,
      roster: [{ ...hero, fatigue: 40, condition: 'fatigued' as const }],
    }
    const hour = now + 3_600_000
    const house1 = reduce(tired, { type: 'catchUp', now: hour })
    expect(house1.roster[0]?.fatigue).toBe(30)
    expect(house1.roster[0]?.condition).toBe('fatigued')
    const house2 = reduce({ ...tired, buildings: { ...tired.buildings, house: 2 } }, { type: 'catchUp', now: hour })
    expect(house2.roster[0]?.fatigue).toBe(25)
    const clearing = reduce(
      { ...tired, roster: [{ ...hero, fatigue: lifeRules.fatigue.recoverPerHour, condition: 'fatigued' as const }] },
      { type: 'catchUp', now: hour },
    )
    expect(clearing.roster[0]?.fatigue).toBe(0)
    expect(clearing.roster[0]?.condition).toBe('healthy')
  })

  it('improves a critical hero one step per season', () => {
    const start = freshState(1, now)
    const hired = reduce(start, { type: 'hire', id: start.visitors[0]?.id ?? '' })
    const hero = hired.roster[0]
    if (!hero) {
      throw new Error('expected a hero')
    }
    const forward = (state: GameState) => {
      let next = state
      const target = next.lastTickAt + timeRules.seasonMs
      while (next.lastTickAt < target) {
        next = reduce(next, { type: 'catchUp', now: target })
      }
      return next
    }
    const critical = {
      ...hired,
      roster: [{ ...hero, condition: 'critical' as const, recoverAt: now + lifeRules.injury.recoverMs }],
    }
    const injured = forward(critical)
    expect(injured.roster[0]?.condition).toBe('injured')
    expect(injured.roster[0]?.recoverAt).toBe(injured.lastTickAt + lifeRules.injury.recoverMs)
    const tired = forward(injured)
    expect(tired.roster[0]?.condition).toBe('fatigued')
    expect(tired.roster[0]?.recoverAt).toBeUndefined()
  })

  it('warns before a worn party leaves and lets one confirm through', () => {
    const start = freshState(1, now)
    const hired = reduce(start, { type: 'hire', id: start.visitors[0]?.id ?? '' })
    const hero = hired.roster[0]
    if (!hero) {
      throw new Error('expected a hero')
    }
    const worn = {
      ...hired,
      roster: [{ ...hero, fatigue: lifeRules.fatigue.exhaustedAt }],
      party: [{ id: hero.id, row: 'front' as const }],
    }
    const warned = reduce(worn, { type: 'depart' })
    expect(warned.notice).toBe('wornParty')
    expect(warned.report).toBeNull()
    const sent = reduce(worn, { type: 'depart', confirm: true })
    expect(sent.notice).toBeNull()
    expect(sent.report).not.toBeNull()
    const both = {
      ...worn,
      dungeonId: 'abandoned_mine',
      roster: [{ ...hero, fatigue: lifeRules.fatigue.exhaustedAt, deaths: 1 }],
    }
    expect(reduce(both, { type: 'depart' }).notice).toBe('wornParty')
    expect(reduce(both, { type: 'depart', confirm: true }).report).not.toBeNull()
  })

  it('keeps a critical hero out of automatic runs', () => {
    const start = freshState(1, now)
    const hired = reduce(start, { type: 'hire', id: start.visitors[0]?.id ?? '' })
    const hero = hired.roster[0]
    if (!hero) {
      throw new Error('expected a hero')
    }
    for (const policy of ['material', 'fixed'] as const) {
      const parked = {
        ...hired,
        cleared: ['hill_cave'],
        roster: [{ ...hero, condition: 'critical' as const, fatigue: 0 }],
        party: [{ id: hero.id, row: 'front' as const }],
        auto: {
          enabled: true,
          dungeonId: 'hill_cave',
          policy,
          material: 'wood' as const,
          party: [{ id: hero.id, row: 'front' as const }],
        },
      }
      const later = reduce(parked, { type: 'catchUp', now: now + villageRules.auto.runMs })
      expect(later.report).toBeNull()
      expect(later.roster[0]?.fatigue).toBe(0)
      expect(later.roster[0]?.condition).toBe('critical')
    }
  })

  it('gives an injured hero from a version 2 save a recovery time', () => {
    const start = freshState(2, now)
    const hero = start.visitors[0]
    if (!hero) {
      throw new Error('expected a visitor')
    }
    const saved = { ...start, version: 2, roster: [{ ...hero, condition: 'injured' as const, recoverAt: undefined }] }
    const loaded = migrate(saved, now + 50)
    expect(loaded.version).toBe(SAVE_VERSION)
    expect(loaded.roster[0]?.recoverAt).toBe(now + 50 + lifeRules.injury.recoverMs)
  })

  it('ages the roster and visitors once per new year and recalculates the age band', () => {
    const start = freshState(1, now)
    const visitor = start.visitors[0]
    const hired = reduce(start, { type: 'hire', id: visitor?.id ?? '' })
    const hero = hired.roster[0]
    const staying = hired.visitors[0]
    if (!hero || !staying) {
      throw new Error('expected a hero and a visitor')
    }
    const at = (age: number) => ({ ...withAge(hero, age), arrivedAt: now })
    const prepared = {
      ...hired,
      roster: [at(49)],
      visitors: [{ ...withAge(staying, 49), arrivedAt: now + timeRules.seasonMs * 8 }],
    }
    const oneYear = seasons(prepared, 4)
    expect(oneYear.calendar).toMatchObject({ year: 2, season: 'spring' })
    expect(oneYear.roster[0]?.age).toBe(50)
    expect(oneYear.visitors[0]?.age).toBe(50)
    expect(oneYear.roster[0]?.stats).toEqual(withAge(hero, 50).stats)
    expect(oneYear.roster[0]?.stats).not.toEqual(withAge(hero, 49).stats)
    expect(oneYear.absence?.aged).toContainEqual({ name: hero.name, age: 50 })
    expect(oneYear.absence?.aged).toContainEqual({ name: staying.name, age: 50 })
    const twoYears = seasons(prepared, 8)
    expect(twoYears.roster[0]?.age).toBe(51)
    expect(twoYears.visitors.find((entry) => entry.id === staying.id)?.age).toBe(51)
    expect(twoYears.absence?.aged).toContainEqual({ name: hero.name, age: 51 })
    expect(twoYears.absence?.aged).toContainEqual({ name: staying.name, age: 51 })
    const elder = { ...prepared, roster: [at(80)], visitors: [{ ...withAge(staying, 80), arrivedAt: now + timeRules.seasonMs * 8 }] }
    const capped = seasons(elder, 4)
    expect(capped.roster[0]?.age).toBe(80)
    expect(capped.roster).toHaveLength(1)
    expect(capped.absence?.aged?.some((entry) => entry.name === hero.name)).toBe(false)
  })

  it('fills the aged list when an older absence report has none', () => {
    const start = freshState(1, now)
    const saved = {
      ...start,
      version: 4,
      absence: {
        elapsedMs: timeRules.reportAfterMs,
        capped: false,
        seasonsPassed: 0,
        year: 1,
        season: 'spring' as const,
        goldGained: 0,
        wagesPaid: 0,
        injuries: [],
        completed: [],
        crafted: [],
        visitors: [],
        autoRuns: 0,
        autoGold: 0,
        adClaimed: false,
      },
    }
    expect(migrate(saved, now).absence?.aged).toEqual([])
  })
})

function seasons(state: GameState, count: number): GameState {
  let next = state
  for (let season = 0; season < count; season += 1) {
    let left = timeRules.seasonMs
    while (left > 0) {
      const step = Math.min(timeRules.maxOfflineMs, left)
      next = reduce(next, { type: 'catchUp', now: next.lastTickAt + step })
      left -= step
    }
  }
  return next
}
