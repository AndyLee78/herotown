import { describe, expect, it } from 'vitest'
import { buildMonuments, buildPromoteFx, buildProsperityDecor, buildTownDecor } from './world'

describe('town decor', () => {
  it('stays empty below level 8 and grows for 8–10', () => {
    expect(buildTownDecor(7).children.length).toBe(0)
    expect(buildTownDecor(8).children.length).toBeGreaterThan(0)
    expect(buildTownDecor(9).children.length).toBeGreaterThan(0)
    expect(buildTownDecor(10).children.length).toBeGreaterThan(0)
  })

  it('builds a promotion pillar and rising flags', () => {
    const fx = buildPromoteFx(8)
    expect(fx.getObjectByName('pillar')).toBeTruthy()
    expect(fx.getObjectByName('risingFlags')).toBeTruthy()
  })

  it('builds monuments by stage and a spinning lighthouse beam', () => {
    expect(buildMonuments({}).children.length).toBe(0)
    const mid = buildMonuments({ statue: 1, lighthouse: 2, walls: 2, arch: 1 })
    expect(mid.children.length).toBeGreaterThan(0)
    expect(mid.getObjectByName('lighthouseBeam')).toBeTruthy()
    expect(buildMonuments({ statue: 3, lighthouse: 3, walls: 3, arch: 3 }).children.length).toBeGreaterThan(0)
  })

  it('adds prosperity props from rank 10 up', () => {
    expect(buildProsperityDecor(0).children.length).toBe(0)
    expect(buildProsperityDecor(10).children.length).toBeGreaterThan(0)
    expect(buildProsperityDecor(20).children.length).toBeGreaterThan(0)
    expect(buildProsperityDecor(30).children.length).toBeGreaterThan(0)
  })
})
