import { describe, expect, it } from 'vitest'
import { lifeRules, retirementRules, smithRules, timeRules, villageRules } from './data'
import { freshState, migrate, reduce, retireeBonus, retirementAdvised, type GameState } from './game'
import { withAge } from './hero'

const now = 1_700_000_000_000

// One hired hero, aged as asked, sitting in the first preset.
function withHero(age: number): { state: GameState; id: string } {
  const start = freshState(4, now)
  const hired = reduce(start, { type: 'hire', id: start.visitors[0]?.id ?? '', now })
  const hero = hired.roster[0]
  if (!hero) throw new Error('expected a hero')
  const aged = { ...hired, roster: [withAge(hero, age)] }
  return { state: reduce(aged, { type: 'add', id: hero.id }), id: hero.id }
}

describe('retirement', () => {
  it('advises retirement from the advise age', () => {
    const { state } = withHero(retirementRules.adviseAge)
    const hero = state.roster[0]
    if (!hero) throw new Error('expected a hero')
    expect(retirementAdvised(hero)).toBe(true)
    expect(retirementAdvised(withAge(hero, retirementRules.adviseAge - 1))).toBe(false)
  })

  it('refuses heroes younger than the minimum age', () => {
    const { state, id } = withHero(retirementRules.minAge - 1)
    expect(reduce(state, { type: 'retire', id }).notice).toBe('tooYoung')
  })

  it('moves a hero out of the roster and presets, stops wages and keeps ageing', () => {
    const { state, id } = withHero(52)
    const retired = reduce(state, { type: 'retire', id })
    expect(retired.roster).toHaveLength(0)
    expect(retired.presets[0]?.slots).toEqual([])
    expect(retired.retirees.map((retiree) => retiree.hero.id)).toEqual([id])
    expect(retired.retirees[0]?.retiredYear).toBe(retired.calendar.year)
    const nearSpring = { ...retired, calendar: { year: 1, season: 'winter' as const, intoSeasonMs: timeRules.seasonMs - 1000 } }
    const nextYear = reduce(nearSpring, { type: 'catchUp', now: nearSpring.lastTickAt + 2000 })
    expect(nextYear.gold).toBe(nearSpring.gold)
    expect(nextYear.retirees[0]?.hero.age).toBe(53)
  })

  it('will not retire a hero who is away on an expedition', () => {
    const { state, id } = withHero(52)
    const out = reduce(state, { type: 'depart', now, confirm: true })
    expect(out.expeditions).toHaveLength(1)
    expect(reduce(out, { type: 'retire', id }).notice).toBe('busyHero')
  })

  it('puts one retiree on each building post', () => {
    const { state, id } = withHero(52)
    let retired = reduce(state, { type: 'retire', id })
    retired = reduce(retired, { type: 'assignRetiree', id, building: 'smith' })
    expect(retireeBonus(retired, 'smith')).toBe(retirementRules.bonus.smith)
    expect(retireeBonus(retired, 'temple')).toBe(0)
    const second = { ...retired, retirees: [...retired.retirees, { ...retired.retirees[0]!, hero: { ...retired.retirees[0]!.hero, id: 'other' }, building: null }] }
    expect(reduce(second, { type: 'assignRetiree', id: 'other', building: 'smith' }).notice).toBe('postTaken')
    const moved = reduce(retired, { type: 'assignRetiree', id, building: null })
    expect(retireeBonus(moved, 'smith')).toBe(0)
  })

  it('speeds building, treatment and rest, and raises enhance odds', () => {
    const { state, id } = withHero(52)
    const retired = reduce(state, { type: 'retire', id })
    const post = (building: 'hall' | 'temple' | 'house' | 'smith') => reduce(retired, { type: 'assignRetiree', id, building })

    const plain = reduce(retired, { type: 'build', id: 'house', now })
    const fast = reduce(post('hall'), { type: 'build', id: 'house', now })
    expect((fast.construction?.finishAt ?? 0) - now).toBeLessThan((plain.construction?.finishAt ?? 0) - now)

    const tired = (s: GameState) => ({ ...s, roster: [{ ...s.retirees[0]!.hero, id: 'worker', fatigue: 80 }] })
    const rested = reduce(tired(retired), { type: 'catchUp', now: retired.lastTickAt + 3_600_000 })
    const restedWell = reduce(tired(post('house')), { type: 'catchUp', now: retired.lastTickAt + 3_600_000 })
    expect(restedWell.roster[0]!.fatigue).toBeLessThan(rested.roster[0]!.fatigue)

    expect(villageRules.buildings.some((b) => b.id === 'temple')).toBe(true)
    expect(lifeRules.treatMs * (1 - retirementRules.bonus.temple)).toBeLessThan(lifeRules.treatMs)
    expect(retireeBonus(post('smith'), 'smith') + (smithRules.successByLevel[1] ?? 0)).toBeGreaterThan(smithRules.successByLevel[1] ?? 0)
  })

  it('starts older saves with no retirees', () => {
    const old = { ...freshState(1, now), version: 6 } as Record<string, unknown>
    delete old.retirees
    expect(migrate(old, now).retirees).toEqual([])
  })
})
