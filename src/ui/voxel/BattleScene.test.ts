import { describe, expect, it } from 'vitest'
import { battleTheme } from './BattleScene'

describe('battleTheme', () => {
  it('keeps the tier path for normal dungeons', () => {
    expect(battleTheme(1).kind).toBe('tier')
    expect(battleTheme(3, 'hill_cave').kind).toBe('tier')
    expect(battleTheme(2, 'dragon_nest').kind).toBe('nest')
  })

  it('picks weekday element themes and denser intensity', () => {
    expect(battleTheme(1, 'trial_flame_2', { special: 'weekday', element: 'flame', difficulty: 2 }).kind).toBe('flame')
    expect(battleTheme(1, 'trial_frost_1', { special: 'weekday', element: 'frost', difficulty: 1 }).kind).toBe('frost')
    expect(battleTheme(1, 'trial_light_3', { special: 'weekday', element: 'light', difficulty: 3 }).intensity).toBe(3)
  })

  it('darkens the abyss as depth grows', () => {
    const shallow = battleTheme(1, 'abyss', { special: 'endless', abyssFrom: 0 })
    const deep = battleTheme(1, 'abyss', { special: 'endless', abyssFrom: 40 })
    expect(shallow.kind).toBe('abyss')
    expect(deep.sky).not.toBe(shallow.sky)
    expect(deep.light).not.toBe(shallow.light)
  })
})
