import { describe, expect, it } from 'vitest'
import { INN_YARD, LOTS, legendStatuePads, type Lot } from './world'

const FLAT = 12.5

function corners(lot: Lot): { x: number; z: number }[] {
  const hx = lot.w / 2
  const hz = lot.d / 2
  return [
    { x: lot.x - hx, z: lot.z - hz },
    { x: lot.x + hx, z: lot.z - hz },
    { x: lot.x - hx, z: lot.z + hz },
    { x: lot.x + hx, z: lot.z + hz },
  ]
}

function overlaps(a: Lot, b: Lot): boolean {
  return (
    Math.abs(a.x - b.x) < a.w / 2 + b.w / 2 &&
    Math.abs(a.z - b.z) < a.d / 2 + b.d / 2
  )
}

describe('village lot layout', () => {
  it('keeps every lot on the flat village lawn', () => {
    for (const [id, lot] of Object.entries(LOTS)) {
      for (const point of corners(lot)) {
        expect(Math.max(Math.abs(point.x), Math.abs(point.z)), id).toBeLessThanOrEqual(FLAT)
      }
    }
  })

  it('keeps lots from overlapping each other', () => {
    const entries = Object.entries(LOTS)
    for (let i = 0; i < entries.length; i += 1) {
      for (let j = i + 1; j < entries.length; j += 1) {
        const [aId, a] = entries[i]!
        const [bId, b] = entries[j]!
        expect(overlaps(a, b), `${aId} vs ${bId}`).toBe(false)
      }
    }
  })

  it('keeps the inn yard south of the inn and clear of the inn box', () => {
    const inn = LOTS.inn
    const front = inn.z + inn.d / 2
    expect(INN_YARD.minZ).toBeGreaterThan(front)
    expect(INN_YARD.maxX).toBeLessThanOrEqual(inn.x + inn.w / 2 + 0.5)
    expect(INN_YARD.minX).toBeGreaterThanOrEqual(inn.x - inn.w / 2 - 0.5)
  })

  it('places legend statue pads from the legends lot', () => {
    const pads = legendStatuePads(3)
    expect(pads).toHaveLength(6)
    for (const pad of pads) {
      expect(Math.abs(pad.x - LOTS.legends.x)).toBeLessThan(2.5)
      expect(pad.z).toBeGreaterThan(LOTS.legends.z)
    }
  })
})
