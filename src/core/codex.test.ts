import { describe, expect, it } from 'vitest'
import { achievementProgress, recordEncounter } from './codex'
import { freshState, migrate, reduce, townLevelOf } from './game'
import { dungeonLoot, raidLoot, uniqueById, uniqueGear } from './loot'

const now = 1_700_000_000_000
const equip = (id: string) => uniqueGear(uniqueById(id)!, id)

describe('persistent codex', () => {
  it('discovers hired heroes, and enemies and clears after a real return', () => {
    const start = freshState(1, now)
    let ready = start
    for (const visitor of start.visitors) {
      ready = reduce(ready, { type: 'hire', id: visitor.id })
      ready = reduce(ready, { type: 'add', id: visitor.id })
    }
    expect(ready.codex.classes).toEqual([...new Set(ready.roster.map(({ classId }) => classId))])
    const sent = reduce(ready, { type: 'depart' })
    expect(sent.codex.monsters).toEqual([])
    const returned = reduce(sent, { type: 'catchUp', now: sent.expeditions[0]!.returnAt })
    expect(returned.codex.monsters).toContain('slime')
    expect(returned.cleared).toContain('hill_cave')
    expect(recordEncounter(returned.codex, returned.history[0]!)).toBe(returned.codex)
  })

  it('records elite encounters, summoned enemies and earlier saves with existing heroes', () => {
    const base = freshState(1, now)
    const history = [{ victory: true, dungeonId: 'trial_light_1', floors: [[{ side: 'enemy', refId: 'slime', elite: true }]], log: [{ key: 'log.summon', params: { refs: 'wolf,invalid' } }] }]
    const state = migrate({
      ...base, version: 29, history,
      roster: [{ ...base.visitors[0], gift: 'ironBody' }],
      graveyard: [{ id: 'gone', classId: 'rogue', gift: 'guardian' }],
      stash: [equip('dragonbane')], codex: { monsters: ['slime', 'slime', 123, 'invalid'] },
      achievements: ['clears-1', 'clears-1', 'invalid'],
    }, now)
    expect(state.codex).toMatchObject({ monsters: ['slime', 'wolf'], elites: ['slime'], uniques: ['dragonbane'], gifts: ['ironBody', 'guardian'] })
    expect(state.codex.classes).toContain('rogue')
    expect(state.cleared).toContain('trial_light_1')
    expect(state.achievements).toEqual(['clears-1'])
  })

  it('discovers a gifted child at birth', () => {
    const base = freshState(1, now)
    const child = { ...base.visitors[0]!, id: 'child', age: 0, gift: 'guardian' as const }
    const mother = { ...base.visitors[1]!, gender: 'female' as const, expecting: { dueAt: now + 1000, child } }
    const born = reduce({ ...base, roster: [mother] }, { type: 'catchUp', now: now + 1000 })
    expect(born.roster.some(({ id }) => id === child.id)).toBe(true)
    expect(born.codex.gifts).toContain('guardian')
    expect(born.codex.classes).toContain(child.classId)
  })

  it('keeps discoveries from loot, exchanges and a fully equipped set', () => {
    const base = freshState(4, now)
    const drop = dungeonLoot(base, 'dragon_nest', true, false, 100)
    expect(drop.codex.uniques).toEqual(['dragonbane'])
    const raid = Array.from({ length: 24 }, (_, seed) => raidLoot({ ...drop, seed }, 'wyrm', 3))
      .find(({ codex }) => codex.uniques.length === 2)!
    expect(raid.codex.uniques).toHaveLength(2)
    let state = {
      ...base, cleared: ['dragon_nest'], roster: [base.visitors[0]!],
      vault: { ...base.vault, valor: 999, scale: 99 },
    }
    for (const id of ['dragonbane', 'wyrmscale', 'wyrmeye']) {
      state = reduce(state, { type: 'exchange', uniqueId: id })
      state = reduce(state, { type: 'equip', gearId: state.stash.at(-1)!.id, heroId: state.roster[0]!.id })
    }
    expect(state.codex.uniques).toEqual(['dragonbane', 'wyrmscale', 'wyrmeye'])
    expect(state.codex.sets).toEqual(['dragonslayer'])
    const dismissed = reduce(state, { type: 'dismiss', id: state.roster[0]!.id })
    expect(dismissed.codex).toBe(state.codex)
    const exchangeAgain = reduce(dismissed, { type: 'exchange', uniqueId: 'wyrmeye' })
    expect(exchangeAgain.codex).toBe(state.codex)
  })
})

describe('achievement claims', () => {
  it('pays only a ready unclaimed achievement, deterministically', () => {
    const base = freshState(1, now)
    const action = { type: 'claimAchievement' as const, id: 'clears-1' }
    expect(reduce(base, action).notice).toBe('locked')
    const ready = { ...base, cleared: ['hill_cave'] }
    expect(achievementProgress(ready, townLevelOf(ready).level).find(({ id }) => id === action.id)?.ready).toBe(true)
    const claimed = reduce(ready, action)
    expect(claimed.gold).toBe(ready.gold + 15)
    expect(claimed.achievements).toEqual([action.id])
    expect(reduce(ready, action)).toEqual(claimed)
    expect(reduce(claimed, action)).toMatchObject({ notice: 'missing', gold: claimed.gold })
    expect(reduce({ ...base, raidKills: 1 }, { type: 'claimAchievement', id: 'raids-1' }).vault.valor).toBe(8)
  })
})
