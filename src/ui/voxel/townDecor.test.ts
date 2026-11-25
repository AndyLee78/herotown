import { describe, expect, it } from 'vitest'
import { buildPromoteFx, buildTownDecor } from './world'

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
})
