import { describe, expect, it } from 'vitest'
import { exportSave, freshState, importSave, migrate } from './game'
import { heroSkillEffects } from './skills'
import { recordTripTitles, titleRules } from './titles'
import type { DungeonReport } from './types'

describe('expedition titles', () => {
  const base = freshState(2, 1000)
  const [a,b] = base.visitors
  const state = { ...base, roster: [a!, b!] }
  const report: DungeonReport = {
    victory: false, defeatReason: 'wiped', ticks: 5, floorsCleared: 1, gold: 0, xp: 0, conditions: [], units: [],
    floors: [[a!,b!].map(h => ({ id:h.id, refId:h.id, side:'hero', hp:1, maxHp:1, boss:false, row:'front', reach:'melee' }))],
    log: [
      {tick:0,key:'log.floor',params:{floor:1}},
      {tick:1,key:'log.down',params:{actorId:'dragon',boss:1,kind:'dragon',killerId:a!.id}},
      {tick:2,key:'log.down',params:{actorId:'ghost',elite:1,kind:'spirit',killerId:b!.id}},
      {tick:3,key:'log.down',params:{actorId:a!.id}},
    ],
  }
  it('credits boss participants, individual killing blows and survivors', () => {
    const next = recordTripTitles(state, report, state.roster.map(h=>h.id), 2000, 15, true)
    expect(next.roster[0]?.deeds).toMatchObject({ downed:1, losses:1, raidKills:1, abyssBest:16, dragonKills:1, bossKills:1 })
    expect(next.roster[0]?.deeds?.eliteKills).toBeUndefined()
    expect(next.roster[1]?.deeds).toMatchObject({ undeadKills:1, eliteKills:1, dragonKills:1, bossKills:1 })
  })
  it('awards once in table order, adds effects and preserves dates across saves', () => {
    const hero = { ...a!, deeds: Object.fromEntries(titleRules.map(r=>[r.deed,r.threshold])) }
    const next = recordTripTitles({ ...state, roster:[hero] },report,[hero.id],2000)
    expect(next.roster[0]?.titles).toEqual(['veteran','resilient','bossHunter'])
    expect(heroSkillEffects(next.roster[0]!).guard).toBeCloseTo(heroSkillEffects(hero).guard + .04)
    expect(recordTripTitles(next,report,[hero.id],3000).titleLog).toEqual(next.titleLog)
    const back = importSave(exportSave(next),3000)
    expect(back.roster[0]?.titleDates).toEqual(next.roster[0]?.titleDates)
    expect(back.titleLog).toEqual(next.titleLog)
    expect(migrate({ ...state,version:31 },3000).roster[0]?.titles).toBeUndefined()
    const dirty = migrate({ ...state,roster:[{ ...hero,titles:['fake','raider','raider','resilient','veteran','eliteHunter'],deeds:{fake:55,wins:-1,downed:4} }] },3000)
    expect(dirty.roster[0]).toMatchObject({ titles:['raider','resilient','veteran'],deeds:{downed:4} })
    expect(dirty.roster[0]?.deeds).toEqual({downed:4})
  })
})
