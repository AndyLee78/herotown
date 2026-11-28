import {
  GATE,
  LAMP_SPOTS,
  LOTS,
  PICNIC_SPOT,
  TREE_SPOTS,
  WELL_SPOT,
  festivalDecorAnchors,
  lotFront,
  type FestivalKind,
} from './world'

export const FOUNTAIN_CLEAR = 1.75
export const STUCK_SECONDS = 1.5
export const STUCK_PROGRESS = 0.18

export type Obstacle =
  | { id: string; kind: 'circle'; x: number; z: number; r: number }
  | { id: string; kind: 'box'; x: number; z: number; hx: number; hz: number }

export type ObstacleOptions = {
  festival?: FestivalKind | null
  pad?: number
}

export function hitsObstacle(x: number, z: number, obstacles: readonly Obstacle[], margin = 0): Obstacle | null {
  for (const obstacle of obstacles) {
    if (obstacle.kind === 'circle') {
      if (Math.hypot(x - obstacle.x, z - obstacle.z) < obstacle.r + margin) {
        return obstacle
      }
      continue
    }
    if (Math.abs(x - obstacle.x) < obstacle.hx + margin && Math.abs(z - obstacle.z) < obstacle.hz + margin) {
      return obstacle
    }
  }
  return null
}

export function isWalkable(x: number, z: number, obstacles: readonly Obstacle[], margin = 0.15): boolean {
  return hitsObstacle(x, z, obstacles, margin) == null
}

// Push a point out of every overlapping obstacle. Returns the last obstacle that moved it.
export function pushOffObstacles(point: { x: number; z: number }, obstacles: readonly Obstacle[], margin = 0): Obstacle | null {
  let hit: Obstacle | null = null
  for (const obstacle of obstacles) {
    if (obstacle.kind === 'circle') {
      const dx = point.x - obstacle.x
      const dz = point.z - obstacle.z
      const distance = Math.hypot(dx, dz)
      const need = obstacle.r + margin
      if (distance >= need) {
        continue
      }
      if (distance < 1e-4) {
        point.x = obstacle.x + need
        point.z = obstacle.z
      } else {
        point.x = obstacle.x + (dx / distance) * need
        point.z = obstacle.z + (dz / distance) * need
      }
      hit = obstacle
      continue
    }
    const dx = point.x - obstacle.x
    const dz = point.z - obstacle.z
    const hx = obstacle.hx + margin
    const hz = obstacle.hz + margin
    if (Math.abs(dx) >= hx || Math.abs(dz) >= hz) {
      continue
    }
    const pushX = (hx - Math.abs(dx) + 0.05) * (dx < 0 ? -1 : 1)
    const pushZ = (hz - Math.abs(dz) + 0.05) * (dz < 0 ? -1 : 1)
    if (Math.abs(dx) / hx > Math.abs(dz) / hz) {
      point.x += pushX
    } else {
      point.z += pushZ
    }
    hit = obstacle
  }
  return hit
}

export function villageObstacles(options: ObstacleOptions = {}): Obstacle[] {
  const pad = options.pad ?? 0.3
  const list: Obstacle[] = []
  for (const [id, lot] of Object.entries(LOTS)) {
    if (id === 'fountain') {
      list.push({ id: 'fountain', kind: 'circle', x: lot.x, z: lot.z, r: FOUNTAIN_CLEAR })
      continue
    }
    // Training yard stays walkable for drills; the scarecrow pad is tiny enough.
    if (id === 'training') {
      continue
    }
    list.push({
      id: `lot:${id}`,
      kind: 'box',
      x: lot.x,
      z: lot.z,
      hx: lot.w / 2 + pad,
      hz: lot.d / 2 + pad,
    })
  }
  TREE_SPOTS.forEach(([x, z, s], index) => {
    list.push({ id: `tree:${index}`, kind: 'circle', x, z, r: 0.35 + s * 0.25 })
  })
  LAMP_SPOTS.forEach(([x, z], index) => {
    list.push({ id: `lamp:${index}`, kind: 'circle', x, z, r: 0.32 })
  })
  list.push({ id: 'well', kind: 'circle', x: WELL_SPOT.x, z: WELL_SPOT.z, r: 0.7 })
  list.push({ id: 'picnic', kind: 'box', x: PICNIC_SPOT.x, z: PICNIC_SPOT.z, hx: 0.85, hz: 0.55 })
  for (const side of [-1, 1] as const) {
    list.push({ id: `gate:${side}`, kind: 'circle', x: GATE.x + side * 1.7, z: GATE.z, r: 0.55 })
  }
  if (options.festival) {
    festivalDecorAnchors(options.festival).forEach((spot, index) => {
      list.push({ id: `festival:${options.festival}:${index}`, kind: 'circle', x: spot.x, z: spot.z, r: 0.4 })
    })
  }
  return list
}

export function fountainRimSpot(angle: number, clear = FOUNTAIN_CLEAR + 0.4): { x: number; z: number } {
  return { x: Math.cos(angle) * clear, z: Math.sin(angle) * clear }
}

export function shouldUnstick(stuckSeconds: number, threshold = STUCK_SECONDS): boolean {
  return stuckSeconds >= threshold
}

// Move an illegal target onto the nearest clear spot (fountain rim or plaza fallback).
export function resolveWalkTarget(
  point: { x: number; z: number },
  obstacles: readonly Obstacle[],
  random: () => number,
  avoidId: string | null = null,
): void {
  pushOffObstacles(point, obstacles, 0.12)
  if (isWalkable(point.x, point.z, obstacles, 0.12) && (!avoidId || hitsObstacle(point.x, point.z, obstacles, 0.45)?.id !== avoidId)) {
    return
  }
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const rim = fountainRimSpot(random() * Math.PI * 2, FOUNTAIN_CLEAR + 0.45 + random() * 0.35)
    if (!isWalkable(rim.x, rim.z, obstacles, 0.12)) {
      continue
    }
    if (avoidId && hitsObstacle(rim.x, rim.z, obstacles, 0.5)?.id === avoidId) {
      continue
    }
    point.x = rim.x
    point.z = rim.z
    return
  }
  const front = lotFront(LOTS.legends, (random() - 0.5) * 1.4, 0.75)
  if (isWalkable(front.x, front.z, obstacles, 0.12)) {
    point.x = front.x
    point.z = front.z
    return
  }
  point.x = 2.6 + (random() - 0.5) * 1.4
  point.z = 2.4 + (random() - 0.5) * 1.4
  pushOffObstacles(point, obstacles, 0.12)
}

export function pickClearInArea(
  area: { minX: number; maxX: number; minZ: number; maxZ: number },
  obstacles: readonly Obstacle[],
  random: () => number,
  avoidId: string | null = null,
): { x: number; z: number } {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const x = area.minX + random() * (area.maxX - area.minX)
    const z = area.minZ + random() * (area.maxZ - area.minZ)
    if (!isWalkable(x, z, obstacles, 0.2)) {
      continue
    }
    if (avoidId && hitsObstacle(x, z, obstacles, 0.55)?.id === avoidId) {
      continue
    }
    return { x, z }
  }
  const fallback = openPlazaFallback(random)
  pushOffObstacles(fallback, obstacles, 0.12)
  if (!avoidId || hitsObstacle(fallback.x, fallback.z, obstacles, 0.55)?.id !== avoidId) {
    return fallback
  }
  const front = lotFront(LOTS.legends, (random() - 0.5) * 1.4, 0.75)
  return front
}

export function openPlazaFallback(random: () => number): { x: number; z: number } {
  // East-south plaza lane: clear of the fountain basin and most lots.
  return {
    x: 2.4 + (random() - 0.5) * 1.6,
    z: 2.6 + (random() - 0.5) * 1.6,
  }
}
