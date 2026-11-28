import { describe, expect, it } from 'vitest'
import {
  FOUNTAIN_CLEAR,
  STUCK_SECONDS,
  fountainRimSpot,
  hitsObstacle,
  isWalkable,
  pickClearInArea,
  pushOffObstacles,
  resolveWalkTarget,
  shouldUnstick,
  villageObstacles,
} from './obstacles'
import { GATHER, GATE, LOTS, PLAZA, festivalDecorAnchors, lotFront, type FestivalKind } from './world'

const KINDS: FestivalKind[] = ['spring', 'summer', 'autumn', 'winter']

describe('village obstacles', () => {
  it('lists the fountain, lots, lamps, trees, well, picnic and gate posts', () => {
    const list = villageObstacles()
    const ids = new Set(list.map((obstacle) => obstacle.id))
    expect(ids.has('fountain')).toBe(true)
    expect(ids.has('lot:legends')).toBe(true)
    expect(ids.has('lot:inn')).toBe(true)
    expect(ids.has('well')).toBe(true)
    expect(ids.has('picnic')).toBe(true)
    expect(ids.has('tree:0')).toBe(true)
    expect(ids.has('lamp:0')).toBe(true)
    expect(ids.has('gate:-1')).toBe(true)
    expect(ids.has('lot:training')).toBe(false)
  })

  it('adds festival decor anchors as obstacles while a festival is on', () => {
    for (const kind of KINDS) {
      const list = villageObstacles({ festival: kind })
      const festivalIds = list.filter((obstacle) => obstacle.id.startsWith(`festival:${kind}:`))
      expect(festivalIds.length, kind).toBe(festivalDecorAnchors(kind).length)
    }
  })

  it('blocks the fountain basin and building lots', () => {
    const list = villageObstacles()
    expect(hitsObstacle(0, 0, list)?.id).toBe('fountain')
    expect(isWalkable(0, 0, list)).toBe(false)
    expect(hitsObstacle(LOTS.legends.x, LOTS.legends.z, list)?.id).toBe('lot:legends')
    expect(isWalkable(lotFront(LOTS.legends).x, lotFront(LOTS.legends).z, list, 0.15)).toBe(true)
  })

  it('pushes points out of circular and box obstacles', () => {
    const list = villageObstacles()
    const inFountain = { x: 0.2, z: 0.1 }
    expect(pushOffObstacles(inFountain, list)?.id).toBe('fountain')
    expect(Math.hypot(inFountain.x, inFountain.z)).toBeGreaterThanOrEqual(FOUNTAIN_CLEAR - 1e-6)

    const inLot = { x: LOTS.legends.x, z: LOTS.legends.z }
    expect(pushOffObstacles(inLot, list, 0.15)?.id).toBe('lot:legends')
    expect(isWalkable(inLot.x, inLot.z, list, 0.15)).toBe(true)
  })

  it('keeps gather, gate approach and plaza rim targets walkable', () => {
    const list = villageObstacles()
    const spots = [
      GATHER,
      { x: GATE.x, z: GATE.z - 1.6 },
      fountainRimSpot(0),
      fountainRimSpot(Math.PI / 2),
      fountainRimSpot(Math.PI),
      lotFront(LOTS.legends),
      { x: PLAZA.min + 1, z: PLAZA.min + 1 },
      { x: PLAZA.max - 1, z: PLAZA.max - 1 },
    ]
    for (const spot of spots) {
      expect(isWalkable(spot.x, spot.z, list, 0.12), `${spot.x},${spot.z}`).toBe(true)
    }
  })

  it('resolves illegal targets onto clear ground and skips a jammed obstacle', () => {
    const list = villageObstacles()
    const random = (() => {
      let n = 0
      return () => {
        n += 1
        return (n % 10) / 10
      }
    })()
    const point = { x: 0, z: 0 }
    resolveWalkTarget(point, list, random)
    expect(isWalkable(point.x, point.z, list, 0.12)).toBe(true)

    const avoided = { x: 0, z: 0 }
    resolveWalkTarget(avoided, list, random, 'fountain')
    expect(hitsObstacle(avoided.x, avoided.z, list, 0.5)?.id).not.toBe('fountain')
  })

  it('picks clear spots inside an area and away from an avoided obstacle', () => {
    const list = villageObstacles()
    let n = 0
    const random = () => {
      n += 1
      return ((n * 37) % 100) / 100
    }
    const area = { minX: PLAZA.min, maxX: PLAZA.max, minZ: PLAZA.min, maxZ: PLAZA.max }
    const clear = pickClearInArea(area, list, random)
    expect(isWalkable(clear.x, clear.z, list, 0.2)).toBe(true)

    const away = pickClearInArea(area, list, random, 'fountain')
    expect(hitsObstacle(away.x, away.z, list, 0.55)?.id).not.toBe('fountain')
  })

  it('unsticks after the jam threshold', () => {
    expect(shouldUnstick(STUCK_SECONDS - 0.01)).toBe(false)
    expect(shouldUnstick(STUCK_SECONDS)).toBe(true)
    expect(shouldUnstick(1.2, 1.5)).toBe(false)
    expect(shouldUnstick(1.5, 1.5)).toBe(true)
  })
})
