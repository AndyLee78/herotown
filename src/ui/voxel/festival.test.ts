import { describe, expect, it } from 'vitest'
import {
  buildFestivalDecor,
  festivalDecorAnchors,
  onBuildingLot,
  pickClearSpots,
  type FestivalKind,
} from './world'

const KINDS: FestivalKind[] = ['spring', 'summer', 'autumn', 'winter']

describe('festival decor placement', () => {
  it('treats the hall of fame lot as blocked', () => {
    expect(onBuildingLot(-3.0, 3.0)).toBe(true)
    expect(onBuildingLot(-3.8, 3.5)).toBe(true)
    expect(onBuildingLot(0, 3.5)).toBe(false)
  })

  it('picks clear plaza spots away from lots and the fountain', () => {
    const spots = pickClearSpots(
      [
        [-3.8, 3.5],
        [-2.6, 3.8],
        [2.4, 3.7],
        [0, 0],
      ],
      3,
    )
    expect(spots.length).toBe(3)
    for (const [x, z] of spots) {
      expect(onBuildingLot(x, z)).toBe(false)
      expect(Math.hypot(x, z)).toBeGreaterThanOrEqual(1.7)
    }
  })

  it('keeps every season’s plaza anchors off building lots', () => {
    for (const kind of KINDS) {
      const anchors = festivalDecorAnchors(kind)
      expect(anchors.length, kind).toBeGreaterThan(0)
      for (const spot of anchors) {
        expect(onBuildingLot(spot.x, spot.z), `${kind} @ ${spot.x},${spot.z}`).toBe(false)
      }
      expect(buildFestivalDecor(kind, true).children.length).toBeGreaterThan(0)
      expect(buildFestivalDecor(kind, false).children.length).toBeGreaterThan(0)
    }
  })
})
