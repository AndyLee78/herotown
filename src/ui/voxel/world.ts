import * as THREE from 'three'
import type { BuildingId } from '../../core'
import { Builder } from './kit'
import { mixHex, seeded } from './look'

// Village layout in world units (one ground tile = 1). The plaza is the dirt
// square |x|, |z| <= 6 where residents walk.

export type Lot = { x: number; z: number; w: number; d: number }

// The camera looks from the south-east, so a building north-west of a taller
// one hides behind it. Each side keeps its doors (and stepping stones, south
// of each lot) clear of the next lot, and the south road (|x| <= 1) stays open.
export const LOTS: Record<BuildingId, Lot> = {
  // North row.
  hall: { x: -8.5, z: -8.5, w: 5, d: 4 },
  temple: { x: -1.5, z: -10.5, w: 4, d: 3.2 },
  inn: { x: 8.5, z: -8.5, w: 4, d: 3 },
  // West column, north to south.
  alchemy: { x: -10.5, z: -4, w: 3, d: 2.6 },
  magic: { x: -10.5, z: 1, w: 3, d: 2.6 },
  house: { x: -9, z: 5.8, w: 3, d: 2.6 },
  school: { x: -10.5, z: 10.6, w: 3.2, d: 2.6 },
  // East of the square, between the inn yard and the guild (Docs/market.md).
  // Kept clear of INN_YARD, the guild front, the fountain rim and the south road.
  market: { x: 10.8, z: -3.2, w: 3.2, d: 2.6 },
  // East of the square, between the plaza and the market (Docs/tavern.md).
  // North-west of the square it stood in front of the hall and hid its door
  // from the camera; here nothing stands behind it. The yard opens south.
  tavern: { x: 7.3, z: -2.1, w: 3.2, d: 2.8 },
  // East of the inn, clear of the wheat field and the inn yard (Docs/legends.md).
  // Front opens south for statues; trees south-east of here were nudged away.
  legends: { x: 12.6, z: -9.4, w: 3.4, d: 2.8 },
  // South-west of the square: the training yard, in plain view.
  training: { x: -5.6, z: 8.4, w: 3.6, d: 3.2 },
  // East and south-east.
  guild: { x: 9.5, z: 4, w: 3.4, d: 2.8 },
  smith: { x: 5.5, z: 9.5, w: 3, d: 2.6 },
  // The lucky fountain stands in the middle of the square (Docs/fountain.md).
  fountain: { x: 0, z: 0, w: 2.2, d: 2.2 },
}

// Where a drilling hero stands to hit the scarecrow.
export function trainingPad(): { x: number; z: number; faceX: number; faceZ: number } {
  const lot = LOTS.training
  return { x: lot.x - 0.35, z: lot.z + 0.55, faceX: lot.x + 0.55, faceZ: lot.z - 0.35 }
}

// Patch of dirt in front of the market where townsfolk sometimes browse.
export function marketFront(): { minX: number; maxX: number; minZ: number; maxZ: number } {
  const lot = LOTS.market
  return {
    minX: lot.x - 1.1,
    maxX: lot.x + 0.6,
    minZ: lot.z + lot.d / 2 + 0.15,
    maxZ: lot.z + lot.d / 2 + 1.35,
  }
}

// Parked spot for the wandering merchant's cart, just east of the stalls.
export function merchantPark(): { x: number; z: number } {
  const lot = LOTS.market
  return { x: lot.x + lot.w / 2 + 1.05, z: lot.z + 0.55 }
}

// Stone patch and benches in front of the tavern where townsfolk sit.
export function tavernYard(): { minX: number; maxX: number; minZ: number; maxZ: number } {
  const lot = LOTS.tavern
  return {
    minX: lot.x - 1.1,
    maxX: lot.x + 1.1,
    minZ: lot.z + lot.d / 2 + 0.35,
    maxZ: lot.z + lot.d / 2 + 1.7,
  }
}

// Round table in the tavern yard; seats face the middle for a toast.
export function tavernTableSpot(): { x: number; z: number; seats: { x: number; z: number }[] } {
  const lot = LOTS.tavern
  const x = lot.x + 0.15
  const z = lot.z + lot.d / 2 + 1.15
  return {
    x,
    z,
    seats: [
      { x: x - 0.55, z: z + 0.35 },
      { x: x + 0.55, z: z + 0.35 },
      { x: x, z: z - 0.55 },
    ],
  }
}

export const PLAZA = { min: -5.3, max: 5.3 }
// Parties gather here, then leave and come back through the south gate.
export const GATHER = { x: 0, z: 4.2 }
export const GATE = { x: 0, z: 12.2 }
export const INN_YARD = { minX: 6.9, maxX: 10.1, minZ: -6.5, maxZ: -5.5 }

const HALF = 15
const GRASS = ['#a5d46a', '#9acb5e', '#b0da78', '#94c55a']
const DIRT = ['#e2cfa6', '#dcc79b', '#e6d5b0', '#d8c294']
const WOOD = '#6b4a33'

const inPlaza = (x: number, z: number) => (Math.abs(x) <= 6 && Math.abs(z) <= 6) || (Math.abs(x) <= 1 && z > 0) || (Math.abs(z) <= 1 && x > 0)
const groundTop = (x: number, z: number) => (Math.max(Math.abs(x), Math.abs(z)) > 12.5 ? 0.3 : 0)

// Ground, trees, lamps and props: everything that never changes.
export function buildTerrain(): THREE.Group {
  const random = seeded(20261122)
  const pick = (list: readonly string[]) => list[Math.floor(random() * list.length)] as string
  const range = (a: number, b: number) => a + random() * (b - a)
  const b = new Builder()

  for (let x = -HALF; x < HALF; x += 1) {
    for (let z = -HALF; z < HALF; z += 1) {
      const cx = x + 0.5
      const cz = z + 0.5
      const top = groundTop(cx, cz)
      const h = 0.4 + top
      b.box(1, h, 1, inPlaza(cx, cz) && top === 0 ? pick(DIRT) : pick(GRASS), cx, top - h / 2, cz)
    }
  }

  const trees: [number, number, number][] = [
    [-13.5, -2, 1], [-13.6, 3.6, 0.8], [-13.5, 10, 1.1], [-4.5, -13.5, 0.9], [4.5, -13.5, 1], [14, 4.5, 1], [13.5, 8.5, 0.9],
    [13, 13, 1.1], [-13.4, 13.2, 0.9], [14.8, -13.2, 1], [-13, -13, 1.1], [3, 13.5, 0.8], [-13.4, -7, 0.7], [15.2, -11.2, 0.8], [-2.6, 13.5, 1],
  ]
  for (const [x, z, s] of trees) {
    const y = groundTop(x, z)
    const leaf = pick(['#7cb342', '#6fa83a', '#86bd4a'])
    const light = mixHex(leaf, '#ffffff', 0.12)
    b.box(0.3, 0.7, 0.3, '#6d4c33', x, y + 0.35, z)
      .box(1.3 * s, 0.8 * s, 1.3 * s, leaf, x, y + 0.7 + 0.4 * s, z)
      .box(0.95 * s, 0.6 * s, 0.95 * s, light, x, y + 0.7 + 1.1 * s, z)
      .box(0.5 * s, 0.4 * s, 0.5 * s, leaf, x, y + 0.7 + 1.6 * s, z)
  }

  for (const [x, z] of [[-6.4, -6.4], [6.4, -6.4], [-6.4, 6.4], [6.4, 6.4], [2.2, 10]] as const) {
    b.box(0.32, 0.16, 0.32, '#6d6d6d', x, 0.08, z)
      .box(0.12, 1.4, 0.12, '#3a3a3a', x, 0.8, z)
      .box(0.24, 0.26, 0.24, x < 0 && z < 0 ? '#9fe8ff' : '#ffd36b', x, 1.6, z, { glow: true })
      .box(0.3, 0.05, 0.3, '#3a3a3a', x, 1.76, z)
  }

  // Wheat field with a fence, between the temple and the inn (it is low, so
  // nothing behind it hides).
  b.within(4.4, 0, -10.5, 0, 0, 0, () => {
    b.box(3.6, 0.08, 2.4, '#7a5a3a', 0, 0.04, 0)
    for (let ix = 0; ix < 7; ix += 1) {
      for (let iz = 0; iz < 4; iz += 1) {
        b.box(0.1, range(0.35, 0.5), 0.1, pick(['#e8c95a', '#dcb945', '#f0d470']), -1.5 + ix * 0.5, 0.25, -0.75 + iz * 0.5)
      }
    }
    for (const [px, pz, w, d] of [[0, -1.35, 4, 0.08], [0, 1.35, 4, 0.08], [-2, 0, 0.08, 2.7], [2, 0, 0.08, 2.7]] as const) {
      b.box(w, 0.08, d, '#8d6e4f', px, 0.45, pz).box(w, 0.08, d, '#8d6e4f', px, 0.25, pz)
    }
    for (const [px, pz] of [[-2, -1.35], [2, -1.35], [-2, 1.35], [2, 1.35]] as const) {
      b.box(0.14, 0.6, 0.14, WOOD, px, 0.3, pz)
    }
  })

  // Well and a picnic table by the inn.
  b.within(7.6, 0, -3.4, 0, 0, 0, () => {
    for (const [px, pz, sx, sz] of [[0, -0.45, 1.1, 0.2], [0, 0.45, 1.1, 0.2], [-0.45, 0, 0.2, 0.7], [0.45, 0, 0.2, 0.7]] as const) {
      b.box(sx, 0.5, sz, '#9e9a92', px, 0.25, pz)
    }
    b.box(0.7, 0.05, 0.7, '#5fb7d9', 0, 0.42, 0)
      .box(0.1, 1.2, 0.1, WOOD, -0.5, 0.6, 0)
      .box(0.1, 1.2, 0.1, WOOD, 0.5, 0.6, 0)
      .box(1.4, 0.12, 0.9, '#b8443a', 0, 1.25, 0)
  })
  b.within(10.6, 0, -4.8, 0, 0, 0, () => {
    b.box(1.4, 0.1, 0.8, '#7a5a40', 0, 0.6, 0)
      .box(0.1, 0.55, 0.1, '#5d4433', -0.55, 0.28, 0)
      .box(0.1, 0.55, 0.1, '#5d4433', 0.55, 0.28, 0)
      .box(1.4, 0.08, 0.3, '#7a5a40', 0, 0.35, 0.65)
      .box(1.4, 0.08, 0.3, '#7a5a40', 0, 0.35, -0.65)
  })

  // The village gate on the south road. The opening stays wide enough to walk through.
  b.within(GATE.x, 0, GATE.z, 0, 0, 0, () => {
    for (const side of [-1, 1]) {
      b.box(0.7, 0.28, 0.7, '#9a948a', side * 1.7, 0.14, 0)
        .box(0.48, 0.22, 0.48, '#6e675f', side * 1.7, 0.34, 0)
        .box(0.42, 2.35, 0.42, '#8d8680', side * 1.7, 1.5, 0)
        .box(0.5, 0.16, 0.5, '#6e675f', side * 1.7, 2.72, 0)
      b.box(0.08, 0.7, 0.02, side < 0 ? '#e0584f' : '#3f8a2c', side * 1.95, 2.15, 0.16)
      b.box(0.06, 0.55, 0.06, '#5c3b22', side * 1.7, 2.95, 0)
        .box(0.16, 0.18, 0.16, '#ffd36b', side * 1.7, 2.55, 0.28, { glow: true })
    }
    b.box(2.4, 0.22, 0.36, '#8a5a32', 0, 2.55, 0)
      .box(1.7, 0.18, 0.3, '#6b4423', 0, 2.78, 0)
      .box(1.05, 0.16, 0.26, '#8a5a32', 0, 2.98, 0)
      .box(0.55, 0.14, 0.22, '#a56b3e', 0, 3.14, 0)
    b.box(0.08, 0.7, 0.55, '#6b4423', 2.45, 0.85, 0.15)
      .box(0.62, 0.42, 0.08, '#f3ead6', 2.45, 1.35, 0.42)
      .box(0.7, 0.08, 0.12, '#8a5a32', 2.45, 1.58, 0.42)
  })

  // Stepping stones to each door.
  for (const lot of Object.values(LOTS)) {
    const front = lot.z + lot.d / 2
    b.box(0.7, 0.06, 0.7, '#cfd3d6', lot.x, 0.03, front + 0.65).box(0.7, 0.06, 0.7, '#cfd3d6', lot.x + 0.15, 0.03, front + 1.45)
  }

  // Grass tufts and flowers outside the plaza.
  for (let i = 0; i < 90; i += 1) {
    const x = range(-14, 14)
    const z = range(-14, 14)
    if (inPlaza(x, z) || (Math.abs(x) < 7.5 && Math.abs(z) < 7.5) || nearLot(x, z)) {
      continue
    }
    const flower = random() < 0.4
    b.box(0.08, flower ? 0.12 : 0.16, 0.08, flower ? pick(['#ffffff', '#ffe27a', '#f7a8c4']) : '#5f8f35', x, groundTop(x, z) + 0.07, z)
  }
  return b.build()
}

function nearLot(x: number, z: number): boolean {
  return Object.values(LOTS).some((lot) => Math.abs(x - lot.x) < lot.w / 2 + 1 && Math.abs(z - lot.z) < lot.d / 2 + 1.8)
}

type HouseSpec = {
  w: number
  d: number
  h: number
  wall: string
  roof: string
  steps?: number
  timber?: boolean
  chimney?: boolean
  stone?: string
}

// A box house with windows and a stepped gable roof. Returns the roof top.
function house(b: Builder, spec: HouseSpec): number {
  const { w, d, h, wall, roof, steps = 4, timber = false, chimney = false, stone = '#a9a59c' } = spec
  b.box(w + 0.3, 0.2, d + 0.3, stone, 0, 0.1, 0).box(w, h, d, wall, 0, 0.2 + h / 2, 0)
  if (timber) {
    for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
      b.box(0.14, h, 0.14, WOOD, (px * w) / 2, 0.2 + h / 2, (pz * d) / 2)
    }
    b.box(w + 0.04, 0.1, d + 0.04, WOOD, 0, 0.2 + h * 0.55, 0)
  }
  b.box(0.5, 0.8, 0.06, WOOD, 0, 0.6, d / 2 + 0.03).box(0.06, 0.06, 0.03, '#d9b54a', 0.14, 0.6, d / 2 + 0.07)
  const windowY = 0.2 + h * 0.62
  for (const wx of [-w * 0.3, w * 0.3]) {
    b.box(0.44, 0.48, 0.05, '#f4f1e8', wx, windowY, d / 2 + 0.02).box(0.3, 0.34, 0.06, '#5aa0a0', wx, windowY, d / 2 + 0.03)
  }
  for (const wz of [-d * 0.22, d * 0.22]) {
    b.box(0.05, 0.48, 0.44, '#f4f1e8', w / 2 + 0.02, windowY, wz).box(0.06, 0.34, 0.3, '#5aa0a0', w / 2 + 0.03, windowY, wz)
  }
  const layer = 0.22
  for (let step = 0; step < steps; step += 1) {
    const depth = (d + 0.6) * (1 - step / steps)
    b.box(w + 0.5, layer, depth, step % 2 ? mixHex(roof, '#000000', 0.08) : roof, 0, 0.2 + h + layer / 2 + step * layer, 0)
  }
  if (chimney) {
    b.box(0.35, 0.6, 0.35, '#9e9a92', w * 0.25, 0.2 + h + steps * layer * 0.6, -d * 0.15)
  }
  return 0.2 + h + steps * layer
}

export type BuiltLot = { group: THREE.Group; top: number }

// Draws a lot: empty plot, construction site, or the building at its level.
export function buildLot(id: BuildingId, level: number, constructing: boolean): BuiltLot {
  const lot = LOTS[id]
  const b = new Builder()
  let top = 0.6
  if (level <= 0) {
    drawEmptyLot(b, lot)
    if (constructing) {
      b.box(lot.w * 0.9, 0.6, lot.d * 0.9, '#d8cbb0', 0, 0.3, 0)
      top = drawScaffold(b, lot, 1.2)
    }
  } else {
    top = drawBuilding(b, id, lot, level)
    if (constructing) {
      top = Math.max(top, drawScaffold(b, lot, top - 0.2))
    }
  }
  const group = b.build()
  if (id === 'fountain' && level > 0) {
    group.add(fountainWater(level))
  }
  if (id === 'alchemy' && level > 0) {
    const grow = level - 1
    group.add(alchemySmoke(level, lot.w - 0.6 + Math.min(0.6, grow * 0.3), lot.d - 0.4 + Math.min(0.4, grow * 0.2)))
  }
  if (id === 'magic' && level > 0) {
    group.add(magicCrystals(level))
  }
  group.position.set(lot.x, 0, lot.z)
  return { group, top }
}

const STONE = '#c5c9ce'
const RIM = '#9aa0a6'
const GOLD = '#e2b340'

// A wider basin at each level: one bowl, a second tier, a statue, then gold trim.
function drawFountain(b: Builder, level: number): number {
  const bowl = 0.7 + level * 0.08
  const trim = level >= 4 ? GOLD : RIM
  basin(b, bowl * 2.2, bowl * 2.2, 0.42, 0.12, STONE, trim)
  if (level >= 2) {
    basin(b, bowl * 1.25, bowl * 1.25, 0.38, 0.58, STONE, trim)
  }
  if (level >= 3) {
    b.box(0.22, 0.55, 0.16, '#d7c4a8', 0, 1.15, 0)
    b.box(0.18, 0.18, 0.16, '#f0d2b0', 0, 1.5, 0)
    b.box(0.08, 0.28, 0.08, '#d7c4a8', -0.18, 1.15, 0)
    b.box(0.08, 0.28, 0.08, '#d7c4a8', 0.18, 1.15, 0)
  }
  if (level >= 4) {
    b.box(0.28, 0.06, 0.28, GOLD, 0, 1.66, 0)
  }
  return level >= 3 ? 1.8 : level >= 2 ? 1.1 : 0.55
}

// Four walls around an open floor, so the water in the middle stays visible.
function basin(b: Builder, w: number, d: number, h: number, y: number, wall: string, trim: string) {
  const lip = 0.14
  b.box(w, 0.08, d, wall, 0, y, 0)
  b.box(w, h, lip, wall, 0, y + h / 2, d / 2 - lip / 2)
  b.box(w, h, lip, wall, 0, y + h / 2, -d / 2 + lip / 2)
  b.box(lip, h, d, wall, w / 2 - lip / 2, y + h / 2, 0)
  b.box(lip, h, d, wall, -w / 2 + lip / 2, y + h / 2, 0)
  b.box(w + 0.08, 0.06, lip, trim, 0, y + h, d / 2)
  b.box(w + 0.08, 0.06, lip, trim, 0, y + h, -d / 2)
  b.box(lip, 0.06, d + 0.08, trim, w / 2, y + h, 0)
  b.box(lip, 0.06, d + 0.08, trim, -w / 2, y + h, 0)
}

// Translucent water and a jet the scene bobs. Materials are listed so the lot can free them.
function fountainWater(level: number): THREE.Group {
  const group = new THREE.Group()
  const materials: THREE.Material[] = []
  const material = (color: number, opacity: number) => {
    const entry = new THREE.MeshBasicMaterial({ color, transparent: true, opacity })
    materials.push(entry)
    return entry
  }
  const bowl = 0.62 + level * 0.1
  const pool = new THREE.Mesh(new THREE.BoxGeometry(bowl * 1.5, 0.1, bowl * 1.5), material(0x5eb6e8, 0.72))
  pool.position.y = 0.28
  group.add(pool)
  const jet = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.42 + level * 0.06, 0.1), material(0x9fd4f5, 0.8))
  jet.name = 'jet'
  jet.position.y = 0.62
  jet.userData.baseY = jet.position.y
  group.add(jet)
  if (level >= 2) {
    const upper = new THREE.Mesh(new THREE.BoxGeometry(bowl * 0.95, 0.06, bowl * 0.95), material(0x7ec8ef, 0.5))
    upper.position.y = 0.9
    group.add(upper)
    const upperJet = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.36, 0.08), material(0xc6ebff, 0.85))
    upperJet.name = 'jet'
    upperJet.position.y = 1.12
    upperJet.userData.baseY = upperJet.position.y
    group.add(upperJet)
  }
  group.userData.materials = materials
  return group
}

// A timber shed, a cauldron, and a chimney. Smoke is added beside the merged mesh.
function drawAlchemy(b: Builder, w: number, d: number, level: number): number {
  const top = house(b, { w, d, h: 1.35 + (level - 1) * 0.15, wall: '#d7c4a2', roof: '#3f6b4a', timber: true, chimney: true })
  const front = d / 2 + 0.55
  b.box(0.95, 0.42, 0.8, '#3e4248', -0.15, 0.32, front)
  b.box(1.05, 0.14, 0.9, '#2c3036', -0.15, 0.56, front)
  b.box(0.7, 0.12, 0.55, '#3faf4a', -0.15, 0.62, front)
  b.box(0.22, 0.28, 0.18, '#c9a36b', 0.45, 0.2, front)
  if (level >= 2) {
    for (const [x, color] of [[0.55, '#8fd4ef'], [0.78, '#d7c4ff'], [1.01, '#f0e06a']] as const) {
      b.box(0.14, 0.32, 0.14, color, x, 0.7, front - 0.1)
      b.box(0.1, 0.06, 0.1, '#8a5a32', x, 0.88, front - 0.1)
    }
    b.box(0.85, 0.1, 0.28, '#6b4630', 0.78, 0.5, front - 0.1)
  }
  if (level >= 3) {
    b.box(0.4, 0.18, 0.08, '#d9b54a', -w * 0.28, 1.2, d / 2 + 0.06)
  }
  if (level >= 4) {
    b.box(0.55, 0.55, 0.55, '#3e4248', w * 0.32, 0.4, front - 0.15)
    b.box(0.4, 0.14, 0.4, '#6fbf4a', w * 0.32, 0.7, front - 0.15, { glow: true })
    b.box(0.18, 0.28, 0.18, '#a8ef7a', w * 0.32, 0.9, front - 0.15, { glow: true })
    for (const x of [-0.55, -0.3, -0.05]) {
      b.box(0.1, 0.1, 0.1, '#ffe27a', x, 1.35, d / 2 + 0.08, { glow: true })
    }
  }
  return top + 0.4
}

function drawMagic(b: Builder, w: number, d: number, level: number): number {
  const top = house(b, { w, d, h: 1.4 + (level - 1) * 0.15, wall: '#d8cce8', roof: '#6b4aa8', timber: true })
  b.box(0.5, 0.9, 0.5, '#5a4680', w * 0.28, top + 0.2, -d * 0.15)
  b.box(0.28, 0.28, 0.28, '#c79bff', w * 0.28, top + 0.75, -d * 0.15, { glow: true })
  b.box(0.7, 0.12, 0.2, '#4a3a68', 0, 0.55, d / 2 + 0.05)
  if (level >= 2) {
    b.box(0.35, 0.08, 0.55, '#8a6ab8', -w * 0.3, 0.7, d * 0.2)
    for (const x of [-0.45, -0.25, -0.05]) {
      b.box(0.1, 0.22, 0.1, '#e6d4ff', x, 0.88, d * 0.2, { glow: true })
    }
  }
  if (level >= 3) {
    b.box(0.4, 0.18, 0.08, '#d9b54a', -w * 0.25, 1.2, d / 2 + 0.05)
  }
  if (level >= 4) {
    b.box(0.7, 1.15, 0.7, '#4a3a68', w * 0.28, top + 0.35, -d * 0.15)
    b.box(0.4, 0.4, 0.4, '#e6d4ff', w * 0.28, top + 1.05, -d * 0.15, { glow: true })
    b.box(0.16, 0.5, 0.16, '#ffe27a', w * 0.28, top + 1.4, -d * 0.15, { glow: true })
    b.box(0.08, 1.2, 0.08, WOOD, -w * 0.4, 0.7, d / 2 + 0.25)
    b.box(0.36, 0.28, 0.05, '#9b6bff', -w * 0.22, 1.15, d / 2 + 0.28)
  }
  return top + (level >= 4 ? 1.6 : 1)
}

// Open sand yard with a shed, scarecrow and wooden-sword rack (Docs/skills.md).
function drawTraining(b: Builder, w: number, d: number, level: number): number {
  const sand = '#e2c48a'
  const post = '#6b4a33'
  b.box(w * 0.95, 0.08, d * 0.95, sand, 0, 0.06, 0)
  b.box(w * 0.7, 0.05, d * 0.55, '#d4b474', 0.1, 0.1, 0.15)
  // Small open shed at the back.
  const shedH = 1.15 + (level - 1) * 0.2
  b.box(w * 0.7, shedH, 0.12, '#c9b48a', 0, shedH / 2 + 0.08, -d * 0.42)
  b.box(0.12, shedH, d * 0.35, '#c9b48a', -w * 0.32, shedH / 2 + 0.08, -d * 0.28)
  b.box(0.12, shedH, d * 0.35, '#c9b48a', w * 0.32, shedH / 2 + 0.08, -d * 0.28)
  b.box(w * 0.82, 0.12, d * 0.45, '#8a5a32', 0, shedH + 0.14, -d * 0.3)
  // Scarecrow.
  b.box(0.12, 1.1, 0.12, post, 0.55, 0.6, -0.35)
  b.box(0.7, 0.12, 0.12, post, 0.55, 1.05, -0.35)
  b.box(0.28, 0.28, 0.28, '#e8d4a8', 0.55, 1.35, -0.35)
  b.box(0.08, 0.08, 0.04, '#3a2a20', 0.48, 1.38, -0.2)
  b.box(0.08, 0.08, 0.04, '#3a2a20', 0.62, 1.38, -0.2)
  b.box(0.45, 0.5, 0.2, '#c4a574', 0.55, 0.85, -0.35)
  // Wooden sword rack.
  b.box(0.08, 0.9, 0.08, post, -0.85, 0.5, 0.2)
  b.box(0.08, 0.9, 0.08, post, -0.45, 0.5, 0.2)
  b.box(0.55, 0.08, 0.08, post, -0.65, 0.85, 0.2)
  b.box(0.08, 0.55, 0.08, '#9a7450', -0.75, 0.7, 0.28, { rz: 0.35 })
  b.box(0.08, 0.55, 0.08, '#9a7450', -0.55, 0.7, 0.28, { rz: -0.25 })
  if (level >= 2) {
    b.box(0.08, 0.55, 0.08, '#9a7450', -0.65, 0.7, 0.35, { rz: 0.1 })
    b.box(0.9, 0.08, 0.5, '#6b4a33', 0, 0.12, 0.7)
  }
  if (level >= 3) {
    b.box(0.35, 0.35, 0.35, '#c9b48a', w * 0.35, 0.3, d * 0.3)
    b.box(0.2, 0.5, 0.08, post, w * 0.35, 0.55, d * 0.3)
    b.box(0.4, 0.18, 0.08, '#d9b54a', -w * 0.2, shedH * 0.7, -d * 0.35)
  }
  if (level >= 4) {
    b.box(0.9, 0.12, 0.55, '#8a5a32', 0.1, 0.14, 0.55)
    b.box(0.55, 0.08, 0.55, '#c45c3a', 0.1, 0.2, 0.55)
    b.box(0.08, 1.35, 0.08, post, -w * 0.4, 0.75, -d * 0.15)
    b.box(0.42, 0.32, 0.05, '#e2b340', -w * 0.22, 1.25, -d * 0.15)
    for (const x of [-0.35, 0, 0.35]) {
      b.box(0.1, 0.1, 0.1, '#ffe27a', x, shedH + 0.22, -d * 0.28, { glow: true })
    }
  }
  return shedH + 0.3
}

function magicCrystals(level: number): THREE.Group {
  const group = new THREE.Group()
  const materials: THREE.Material[] = []
  const add = (x: number, y: number, z: number, size: number, hex: number) => {
    const material = new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: 0.85 })
    materials.push(material)
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size, size * 1.4, size), material)
    mesh.name = 'crystal'
    mesh.position.set(x, y, z)
    mesh.userData.baseY = y
    group.add(mesh)
  }
  add(0.85, 1.55, 0.35, 0.22, 0xb48cff)
  add(-0.7, 1.85, 0.15, 0.18, 0xd7c4ff)
  add(0.2, 2.15, -0.45, 0.16, 0x9fe8ff)
  if (level >= 2) {
    add(-0.2, 2.45, 0.55, 0.14, 0xe6d4ff)
  }
  if (level >= 3) {
    add(0.55, 2.7, -0.2, 0.2, 0xffe56a)
  }
  if (level >= 4) {
    add(-0.55, 2.95, 0.1, 0.18, 0xffc8ff)
    add(0.35, 3.15, 0.35, 0.16, 0xffe27a)
  }
  group.userData.materials = materials
  return group
}

function alchemySmoke(level: number, w: number, d: number): THREE.Group {
  const group = new THREE.Group()
  const materials: THREE.Material[] = []
  const h = 1.35 + (level - 1) * 0.15
  const stack = 0.2 + h + 4 * 0.22 * 0.6 + 0.35
  const puff = (x: number, y: number, z: number, size: number) => {
    const material = new THREE.MeshBasicMaterial({ color: 0xd5ddd4, transparent: true, opacity: 0.72 })
    materials.push(material)
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size, size * 0.7, size), material)
    mesh.name = 'smoke'
    mesh.position.set(w * 0.25 + x, stack + y, -d * 0.15 + z)
    mesh.userData.baseY = mesh.position.y
    group.add(mesh)
  }
  puff(0, 0.15, 0, 0.34)
  puff(0.16, 0.42, -0.08, 0.42)
  puff(-0.06, 0.68, 0.1, 0.3)
  if (level >= 2) {
    puff(0.22, 0.95, -0.16, 0.26)
  }
  if (level >= 4) {
    puff(-0.12, 1.15, 0.12, 0.3)
    puff(0.1, 1.4, -0.05, 0.22)
  }
  group.userData.materials = materials
  return group
}

function drawEmptyLot(b: Builder, lot: Lot) {
  b.box(lot.w + 0.4, 0.04, lot.d + 0.4, '#cdb48a', 0, 0.02, 0)
  const hx = lot.w / 2 + 0.1
  const hz = lot.d / 2 + 0.1
  for (const [px, pz] of [[-hx, -hz], [hx, -hz], [-hx, hz], [hx, hz]] as const) {
    b.box(0.08, 0.45, 0.08, '#b08856', px, 0.22, pz)
  }
  b.box(lot.w + 0.2, 0.025, 0.025, '#e8dcc0', 0, 0.38, hz).box(lot.w + 0.2, 0.025, 0.025, '#e8dcc0', 0, 0.38, -hz)
  b.box(0.025, 0.025, lot.d + 0.2, '#e8dcc0', hx, 0.38, 0).box(0.025, 0.025, lot.d + 0.2, '#e8dcc0', -hx, 0.38, 0)
}

function drawScaffold(b: Builder, lot: Lot, height: number): number {
  const hx = lot.w / 2 + 0.3
  const hz = lot.d / 2 + 0.3
  const pole = '#b08856'
  for (const [px, pz] of [[-hx, -hz], [hx, -hz], [-hx, hz], [hx, hz]] as const) {
    b.box(0.1, height, 0.1, pole, px, height / 2, pz)
  }
  for (const y of [height * 0.45, height * 0.95]) {
    b.box(lot.w + 0.7, 0.08, 0.22, pole, 0, y, hz).box(lot.w + 0.7, 0.08, 0.22, pole, 0, y, -hz)
    b.box(0.22, 0.08, lot.d + 0.7, pole, hx, y, 0).box(0.22, 0.08, lot.d + 0.7, pole, -hx, y, 0)
  }
  b.box(0.45, 0.35, 0.45, '#9c7448', hx + 0.5, 0.18, hz + 0.2).box(0.9, 0.12, 0.3, '#c9a36b', hx + 0.3, 0.06, hz + 0.7)
  return height + 0.1
}

function drawBuilding(b: Builder, id: BuildingId, lot: Lot, level: number): number {
  const grow = level - 1
  const w = lot.w - 0.6 + Math.min(0.6, grow * 0.3)
  const d = lot.d - 0.4 + Math.min(0.4, grow * 0.2)
  if (id === 'hall') {
    const top = house(b, { w, d, h: 1.8 + grow * 0.35, wall: '#b9b6ad', roof: '#5b6570', steps: 3, stone: '#8f8b83' })
    for (const bx of [-w * 0.28, w * 0.28]) {
      b.box(0.3, 1.0, 0.05, '#c0392b', bx, 1.4, d / 2 + 0.05).box(0.34, 0.06, 0.07, '#d9b54a', bx, 1.92, d / 2 + 0.05)
    }
    if (level >= 2) {
      b.box(1.0, 1.0, 1.0, '#b9b6ad', -w * 0.3, top + 0.5, -d * 0.1).box(1.2, 0.2, 1.2, '#5b6570', -w * 0.3, top + 1.1, -d * 0.1)
      return top + 1.2
    }
    return top
  }
  if (id === 'inn') {
    const top = house(b, { w, d, h: 1.8 + grow * 0.35, wall: '#c99c6a', roof: '#e07b5f', timber: true, chimney: true })
    b.box(0.06, 0.06, 0.5, WOOD, w * 0.32, 1.25, d / 2 + 0.25).box(0.45, 0.32, 0.05, '#e9d6a8', w * 0.32, 1.05, d / 2 + 0.48)
    let peak = top
    if (level >= 3) {
      const story = 0.7
      b.box(w * 0.72, story, d * 0.65, '#c99c6a', 0, top + story / 2, -0.05)
      b.box(w * 0.86, 0.14, d * 0.78, '#e07b5f', 0, top + story + 0.07, -0.05)
      b.box(0.28, 0.22, 0.06, '#5aa0a0', -w * 0.18, top + story * 0.4, d * 0.3)
      b.box(0.28, 0.22, 0.06, '#5aa0a0', w * 0.18, top + story * 0.4, d * 0.3)
      b.box(0.08, 1.1, 0.08, WOOD, -w * 0.4, 0.7, d / 2 + 0.35)
      b.box(0.36, 0.28, 0.05, '#e2b340', -w * 0.22, 1.15, d / 2 + 0.35)
      peak = top + story + 0.14
    }
    return peak
  }
  if (id === 'house') {
    return drawHome(b, w, d, level)
  }
  if (id === 'fountain') {
    return drawFountain(b, level)
  }
  if (id === 'guild') {
    const top = house(b, { w, d, h: 1.6 + grow * 0.3, wall: '#e2dccb', roof: '#4f7fb5', timber: true })
    b.box(0.08, 2.4, 0.08, '#5d4433', w / 2 + 0.3, 1.2, d / 2).box(0.5, 0.35, 0.03, '#3f6fa8', w / 2 + 0.55, 2.2, d / 2)
    b.box(0.8, 0.6, 0.06, '#9c7448', -w * 0.3, 0.7, d / 2 + 0.35).box(0.06, 0.7, 0.06, WOOD, -w * 0.3 - 0.35, 0.35, d / 2 + 0.35).box(0.06, 0.7, 0.06, WOOD, -w * 0.3 + 0.35, 0.35, d / 2 + 0.35)
    let peak = Math.max(top, 2.4)
    if (level >= 5) {
      b.box(0.08, 1.2, 0.08, WOOD, -w / 2 - 0.25, 0.7, d / 2)
      b.box(0.42, 0.32, 0.04, '#e2b340', -w / 2 - 0.05, 1.15, d / 2)
      b.box(0.5, 0.16, 0.08, '#d9b54a', 0, 1.55, d / 2 + 0.04)
      b.box(0.18, 0.18, 0.06, '#ffe27a', 0, 1.55, d / 2 + 0.08, { glow: true })
      peak = Math.max(peak, 1.75)
    }
    return peak
  }
  if (id === 'school') {
    return drawSchool(b, w, d, level)
  }
  if (id === 'alchemy') {
    return drawAlchemy(b, w, d, level)
  }
  if (id === 'magic') {
    return drawMagic(b, w, d, level)
  }
  if (id === 'training') {
    return drawTraining(b, w, d, level)
  }
  if (id === 'market') {
    return drawMarket(b, w, d, level)
  }
  if (id === 'tavern') {
    return drawTavern(b, w, d, level)
  }
  if (id === 'legends') {
    return drawLegends(b, w, d, level)
  }
  if (id === 'smith') {
    const top = house(b, { w, d, h: 1.4 + grow * 0.25, wall: '#9a7a5c', roof: '#6d6d6d', steps: 3 })
    b.box(0.6, 1.3, 0.6, '#7d7a74', -w * 0.3, top + 0.2, -d * 0.15).box(0.36, 0.2, 0.36, '#ff8a3d', -w * 0.3, top + 0.86, -d * 0.15, { glow: true })
    b.box(0.5, 0.25, 0.3, '#4a4d54', w * 0.35, 0.55, d / 2 + 0.6).box(0.25, 0.3, 0.2, '#3a3d44', w * 0.35, 0.27, d / 2 + 0.6)
    b.box(0.3, 0.3, 0.06, '#ff9d4d', -w * 0.3, 0.45, d / 2 + 0.04, { glow: true })
    let peak = top + 1
    if (level >= 4) {
      b.box(0.85, 1.55, 0.85, '#6a6864', -w * 0.3, top + 0.35, -d * 0.15)
      b.box(0.5, 0.28, 0.5, '#ff6a3a', -w * 0.3, top + 1.15, -d * 0.15, { glow: true })
      b.box(0.28, 0.45, 0.28, '#ffd36b', -w * 0.3, top + 1.45, -d * 0.15, { glow: true })
      peak = top + 1.7
    }
    if (level >= 5) {
      b.box(0.55, 0.22, 0.35, '#d9b54a', w * 0.32, 0.72, d / 2 + 0.55)
      b.box(0.22, 0.45, 0.22, '#ffe27a', w * 0.32, 0.55, d / 2 + 0.55, { glow: true })
      b.box(0.4, 0.14, 0.08, '#d9b54a', 0, 1.25, d / 2 + 0.04)
      peak = Math.max(peak, 1.4)
    }
    return peak
  }
  return drawTemple(b, w, d, grow)
}

const HOME_WALL = '#efe3c4'
const HOME_ROOF = '#9a98e2'

// Level 1 is one storey. 2 adds a floor, 3 a side wing, 4 a yard and fence.
function drawHome(b: Builder, w: number, d: number, level: number): number {
  const top = house(b, { w, d, h: 1.3, wall: HOME_WALL, roof: HOME_ROOF })
  let peak = top
  if (level >= 2) {
    const story = 0.85
    b.box(w * 0.7, story, d * 0.68, HOME_WALL, 0, top + story / 2, 0)
    b.box(w * 0.82, 0.16, d * 0.8, HOME_ROOF, 0, top + story + 0.08, 0)
    b.box(0.32, 0.28, 0.06, '#5aa0a0', 0, top + story * 0.45, d * 0.34)
    peak = top + story + 0.16
  }
  if (level >= 3) {
    const wingX = w / 2 + 0.62
    b.box(1.15, 1.05, d * 0.72, HOME_WALL, wingX, 0.72, 0.05)
    b.box(1.4, 0.16, d * 0.88, HOME_ROOF, wingX, 1.32, 0.05)
    b.box(0.32, 0.55, 0.06, WOOD, wingX, 0.48, d * 0.36)
    b.box(0.22, 0.22, 0.05, '#5aa0a0', wingX + 0.28, 0.85, d * 0.36)
  }
  if (level >= 4) {
    const fx = w / 2 + 0.75
    const fz = d / 2 + 0.55
    b.box(fx * 2, 0.05, fz * 2, '#d3c4a2', 0, 0.05, 0.1)
    const post = '#8d6a45'
    const rail = '#efe6d4'
    for (const px of [-fx, fx]) {
      for (const pz of [-fz, fz]) {
        b.box(0.08, 0.42, 0.08, post, px, 0.26, pz + 0.1)
      }
    }
    b.box(fx * 2, 0.06, 0.05, rail, 0, 0.34, -fz + 0.1)
    b.box(0.05, 0.06, fz * 2, rail, -fx, 0.34, 0.1)
    b.box(0.05, 0.06, fz * 2, rail, fx, 0.34, 0.1)
    b.box(fx * 0.62, 0.06, 0.05, rail, -fx * 0.58, 0.34, fz + 0.1)
    b.box(fx * 0.62, 0.06, 0.05, rail, fx * 0.58, 0.34, fz + 0.1)
  }
  if (level >= 5) {
    const wingX = -(w / 2 + 0.62)
    b.box(1.1, 1.0, d * 0.68, HOME_WALL, wingX, 0.7, 0.05)
    b.box(1.3, 0.14, d * 0.82, HOME_ROOF, wingX, 1.28, 0.05)
    b.box(0.28, 0.5, 0.06, WOOD, wingX, 0.45, d * 0.34)
    b.box(0.2, 0.2, 0.05, '#5aa0a0', wingX - 0.25, 0.85, d * 0.34)
  }
  if (level >= 6) {
    const second = top + 0.85 + 0.16
    const story = 0.7
    b.box(w * 0.6, story, d * 0.55, HOME_WALL, 0, second + story / 2, 0)
    b.box(w * 0.72, 0.14, d * 0.68, HOME_ROOF, 0, second + story + 0.07, 0)
    b.box(0.26, 0.2, 0.05, '#5aa0a0', 0, second + story * 0.4, d * 0.26)
    b.box(0.16, 0.16, 0.16, '#ffe27a', 0, second + story + 0.22, 0, { glow: true })
    peak = second + story + 0.3
  }
  return peak
}

// Newest graves, up to 12. Older ones are left off the plot.
export function buildCemetery(graves: { legend?: boolean }[]): THREE.Group {
  const shown = graves.slice(-12)
  const b = new Builder()
  b.box(3.4, 0.08, 2.6, '#6f8f58', 0, 0.06, 0)
  shown.forEach((grave, index) => {
    const col = index % 4
    const row = Math.floor(index / 4)
    const x = (col - 1.5) * 0.72
    const z = (row - 1) * 0.72
    const stone = grave.legend ? '#e2b340' : '#e7e1d6'
    const trim = grave.legend ? '#c48a12' : '#b7b1a6'
    b.box(0.36, 0.08, 0.18, trim, x, 0.12, z)
    b.box(0.26, 0.5, 0.08, stone, x, 0.4, z)
    b.box(0.12, 0.08, 0.1, trim, x, 0.62, z)
  })
  const group = b.build()
  // The quiet south-east corner, clear of every lot.
  group.position.set(10.2, 0, 9.4)
  return group
}

// Tent stalls at Lv1, more stalls and a sign at Lv2, a roofed hall with flags at Lv3.
function drawMarket(b: Builder, w: number, d: number, level: number): number {
  const plank = '#c9a36b'
  b.box(w * 0.98, 0.08, d * 0.98, plank, 0, 0.06, 0)
  b.box(w * 0.7, 0.04, d * 0.55, '#d4b474', 0, 0.1, 0.15)
  drawStall(b, -w * 0.3, 0.05, '#e85d4c', '#f4f0e4')
  drawStall(b, w * 0.28, 0.1, '#4a7eb5', '#f4f0e4')
  // Goods out front.
  b.box(0.34, 0.28, 0.34, '#8a5a32', -0.55, 0.22, d * 0.38)
  b.box(0.28, 0.22, 0.28, '#6b4a33', -0.2, 0.2, d * 0.4)
  b.box(0.38, 0.2, 0.26, '#d4b474', 0.25, 0.18, d * 0.42)
  b.box(0.26, 0.32, 0.26, '#7a5236', 0.6, 0.24, d * 0.32)
  b.box(0.22, 0.18, 0.22, '#c4a574', 0.55, 0.48, d * 0.32)
  let peak = 1.2
  if (level >= 2) {
    drawStall(b, 0, -0.35, '#3f6b4a', '#efe6d4')
    b.box(0.08, 1.15, 0.08, WOOD, w * 0.05, 0.7, d / 2 + 0.15)
    b.box(0.72, 0.42, 0.06, '#e2b340', w * 0.05, 1.25, d / 2 + 0.18)
    b.box(0.5, 0.08, 0.04, '#8a5a32', w * 0.05, 1.08, d / 2 + 0.2)
    b.box(0.3, 0.24, 0.3, '#9c7448', -w * 0.4, 0.22, -d * 0.35)
    peak = 1.5
  }
  if (level >= 3) {
    const posts = [
      [-w * 0.42, -d * 0.4],
      [w * 0.42, -d * 0.4],
      [-w * 0.42, d * 0.28],
      [w * 0.42, d * 0.28],
    ] as const
    const roofH = 1.55
    for (const [px, pz] of posts) {
      b.box(0.12, roofH, 0.12, WOOD, px, roofH / 2 + 0.08, pz)
    }
    b.box(w * 0.98, 0.14, d * 0.88, '#c45c3a', 0, roofH + 0.16, -0.05)
    b.box(w * 0.7, 0.08, d * 0.55, '#a84830', 0, roofH + 0.28, -0.05)
    // Flags on the back posts.
    b.box(0.07, 0.85, 0.07, WOOD, -w * 0.42, roofH + 0.45, -d * 0.4)
    b.box(0.38, 0.26, 0.04, '#e2b340', -w * 0.22, roofH + 0.8, -d * 0.4)
    b.box(0.07, 0.85, 0.07, WOOD, w * 0.42, roofH + 0.45, -d * 0.4)
    b.box(0.38, 0.26, 0.04, '#4a7eb5', w * 0.22, roofH + 0.8, -d * 0.4)
    peak = roofH + 1.05
  }
  if (level >= 4) {
    drawStall(b, -w * 0.15, 0.35, '#d9b54a', '#efe6d4')
    b.box(0.55, 0.45, 0.45, '#9c7448', w * 0.35, 0.35, -d * 0.2)
    b.box(0.4, 0.2, 0.35, '#c9a36b', w * 0.35, 0.65, -d * 0.2)
    for (const x of [-0.6, -0.2, 0.2, 0.6]) {
      b.box(0.1, 0.1, 0.1, '#ffe27a', x, 1.75, -0.05, { glow: true })
    }
    peak = Math.max(peak, 1.9)
  }
  return peak
}

function drawStall(b: Builder, x: number, z: number, stripeA: string, stripeB: string) {
  b.box(0.95, 0.38, 0.55, '#8a5a32', x, 0.35, z)
  b.box(0.9, 0.06, 0.5, '#6b4a33', x, 0.56, z)
  b.box(0.06, 0.9, 0.06, WOOD, x - 0.42, 0.8, z - 0.22)
  b.box(0.06, 0.9, 0.06, WOOD, x + 0.42, 0.8, z - 0.22)
  b.box(0.06, 0.72, 0.06, WOOD, x - 0.42, 0.7, z + 0.24)
  b.box(0.06, 0.72, 0.06, WOOD, x + 0.42, 0.7, z + 0.24)
  for (let i = 0; i < 4; i += 1) {
    b.box(0.24, 0.09, 0.72, i % 2 === 0 ? stripeA : stripeB, x - 0.36 + i * 0.24, 1.08, z)
  }
  b.box(0.18, 0.16, 0.18, '#e8d4a8', x - 0.25, 0.68, z + 0.05)
  b.box(0.14, 0.2, 0.14, '#8fd4ef', x + 0.2, 0.7, z + 0.02)
}

// Wooden tavern: mug sign and barrels at Lv1, a second storey and outdoor table
// at Lv2, a wider terrace and string lights at Lv3 (Docs/tavern.md).
function drawTavern(b: Builder, w: number, d: number, level: number): number {
  const grow = level - 1
  const top = house(b, { w, d, h: 1.45 + grow * 0.2, wall: '#b8885a', roof: '#8a3a2a', timber: true, chimney: true })
  // Mug sign by the door.
  b.box(0.08, 1.05, 0.08, WOOD, w * 0.38, 0.7, d / 2 + 0.22)
  b.box(0.55, 0.42, 0.06, '#e8d4a8', w * 0.38, 1.2, d / 2 + 0.26)
  b.box(0.16, 0.18, 0.05, '#c45c3a', w * 0.35, 1.18, d / 2 + 0.3)
  b.box(0.07, 0.12, 0.04, '#c45c3a', w * 0.44, 1.2, d / 2 + 0.3)
  b.box(0.2, 0.05, 0.05, '#efe6d4', w * 0.35, 1.3, d / 2 + 0.3)
  // Barrels and crates by the entrance.
  b.box(0.34, 0.4, 0.34, '#6b4a33', -w * 0.38, 0.3, d / 2 + 0.5)
  b.box(0.28, 0.08, 0.28, '#8a5a32', -w * 0.38, 0.52, d / 2 + 0.5)
  b.box(0.3, 0.24, 0.3, '#9c7448', -w * 0.12, 0.22, d / 2 + 0.55)
  // Front yard stones and a bench.
  b.box(w * 1.15, 0.06, 1.55, '#cfd3d6', 0, 0.04, d / 2 + 1.05)
  b.box(w * 0.85, 0.04, 1.1, '#b8bdc2', 0.1, 0.07, d / 2 + 1.15)
  b.box(0.95, 0.12, 0.3, WOOD, -0.35, 0.24, d / 2 + 1.55)
  b.box(0.1, 0.3, 0.1, WOOD, -0.75, 0.2, d / 2 + 1.55)
  b.box(0.1, 0.3, 0.1, WOOD, 0.05, 0.2, d / 2 + 1.55)
  let peak = top
  if (level >= 2) {
    const story = 0.85
    b.box(w * 0.78, story, d * 0.72, '#b8885a', 0, top + story / 2, -0.05)
    b.box(w * 0.9, 0.16, d * 0.84, '#8a3a2a', 0, top + story + 0.08, -0.05)
    b.box(0.28, 0.24, 0.06, '#5aa0a0', -w * 0.2, top + story * 0.45, d * 0.34)
    b.box(0.28, 0.24, 0.06, '#5aa0a0', w * 0.2, top + story * 0.45, d * 0.34)
    // Outdoor table.
    b.box(0.7, 0.08, 0.7, WOOD, w * 0.15, 0.42, d / 2 + 1.05)
    b.box(0.08, 0.4, 0.08, WOOD, w * 0.15 - 0.25, 0.22, d / 2 + 1.05 - 0.25)
    b.box(0.08, 0.4, 0.08, WOOD, w * 0.15 + 0.25, 0.22, d / 2 + 1.05 - 0.25)
    b.box(0.08, 0.4, 0.08, WOOD, w * 0.15 - 0.25, 0.22, d / 2 + 1.05 + 0.25)
    b.box(0.08, 0.4, 0.08, WOOD, w * 0.15 + 0.25, 0.22, d / 2 + 1.05 + 0.25)
    peak = top + story + 0.16
  }
  if (level >= 3) {
    // Wider terrace and string lights.
    b.box(w * 1.35, 0.08, 1.9, '#d4b474', 0, 0.08, d / 2 + 1.15)
    b.box(0.08, 1.15, 0.08, WOOD, -w * 0.55, 0.7, d / 2 + 0.55)
    b.box(0.08, 1.15, 0.08, WOOD, w * 0.55, 0.7, d / 2 + 0.55)
    b.box(0.08, 1.15, 0.08, WOOD, -w * 0.55, 0.7, d / 2 + 1.75)
    b.box(0.08, 1.15, 0.08, WOOD, w * 0.55, 0.7, d / 2 + 1.75)
    b.box(w * 1.2, 0.04, 0.04, WOOD, 0, 1.2, d / 2 + 0.55)
    b.box(w * 1.2, 0.04, 0.04, WOOD, 0, 1.2, d / 2 + 1.75)
    for (const x of [-0.7, -0.35, 0, 0.35, 0.7]) {
      b.box(0.1, 0.1, 0.1, '#ffe27a', x, 1.12, d / 2 + 0.55, { glow: true })
      b.box(0.1, 0.1, 0.1, '#ffe27a', x, 1.12, d / 2 + 1.75, { glow: true })
    }
    b.box(0.4, 0.18, 0.08, '#d9b54a', -w * 0.25, 1.15, d / 2 + 0.05)
    peak = Math.max(peak, 1.35)
  }
  if (level >= 4) {
    b.box(0.08, 1.4, 0.08, WOOD, -w * 0.48, 0.85, d / 2 + 0.15)
    b.box(0.45, 0.35, 0.05, '#c0392b', -w * 0.28, 1.35, d / 2 + 0.15)
    b.box(1.1, 0.1, 0.9, WOOD, w * 0.2, 0.48, d / 2 + 1.2)
    b.box(0.85, 0.55, 0.55, '#6b4a33', -w * 0.35, 0.4, -d * 0.15)
    b.box(0.5, 0.2, 0.4, '#8a5a32', -w * 0.35, 0.75, -d * 0.15)
    for (const x of [-0.5, 0, 0.5]) {
      b.box(0.12, 0.12, 0.12, '#ffe27a', x, peak + 0.15, d * 0.1, { glow: true })
    }
    peak = Math.max(peak, peak + 0.25)
  }
  return peak
}

// Round toast table and three cups for a tavern round; cups are named for bobbing.
export function buildToastTable(): THREE.Group {
  const root = new THREE.Group()
  const body = new Builder()
  body.box(0.85, 0.1, 0.85, '#8a5a32', 0, 0.48, 0)
  body.box(0.95, 0.06, 0.95, '#6b4a33', 0, 0.55, 0)
  body.box(0.1, 0.45, 0.1, WOOD, -0.3, 0.24, -0.3)
  body.box(0.1, 0.45, 0.1, WOOD, 0.3, 0.24, -0.3)
  body.box(0.1, 0.45, 0.1, WOOD, -0.3, 0.24, 0.3)
  body.box(0.1, 0.45, 0.1, WOOD, 0.3, 0.24, 0.3)
  root.add(body.build())
  const cups = new THREE.Group()
  cups.name = 'cups'
  ;[
    [-0.22, 0.18],
    [0.22, 0.18],
    [0, -0.22],
  ].forEach(([cx, cz], index) => {
    const cup = new Builder()
      .box(0.14, 0.16, 0.14, '#c45c3a', 0, 0.08, 0)
      .box(0.16, 0.04, 0.16, '#efe6d4', 0, 0.16, 0)
      .box(0.05, 0.1, 0.04, '#c45c3a', 0.1, 0.08, 0)
      .build({ castShadow: false })
    cup.name = `cup${index}`
    cup.position.set(cx, 0.58, cz)
    cups.add(cup)
  })
  root.add(cups)
  root.visible = false
  return root
}

export type FestivalKind = 'spring' | 'summer' | 'autumn' | 'winter'

// Late-town look for levels 8–10 (Docs/endgame.md 4b): hall flags, a low
// perimeter with the south gate left open, lanterns on the road, and a spire.
// Rebuild only when the town level changes.
export function buildTownDecor(townLevel: number): THREE.Group {
  const root = new THREE.Group()
  root.name = 'townDecor'
  if (townLevel < 8) {
    return root
  }
  const b = new Builder()
  const hall = LOTS.hall
  // Lv8+: tall banners by the hall door.
  for (const side of [-1, 1] as const) {
    const x = hall.x + side * (hall.w * 0.42)
    const z = hall.z + hall.d / 2 + 0.45
    b.box(0.1, 3.0, 0.1, WOOD, x, 1.55, z)
    b.box(0.85, 1.15, 0.06, side < 0 ? '#c0392b' : '#3f6fa8', x + side * 0.48, 2.55, z)
    b.box(0.85, 0.14, 0.06, '#d9b54a', x + side * 0.48, 3.2, z)
    b.box(0.16, 0.16, 0.08, '#ffe27a', x + side * 0.48, 2.55, z + 0.06, { glow: true })
  }
  if (townLevel >= 9) {
    const wall = '#8d8680'
    const cap = '#6e675f'
    const y = 0.45
    const h = 0.9
    // North, east, west stretches; south leaves a gap at the gate.
    for (let x = -13; x <= 13; x += 1.2) {
      b.box(1.05, h, 0.28, wall, x, y, -13.4)
      b.box(1.05, 0.12, 0.36, cap, x, y + h / 2 + 0.04, -13.4)
    }
    for (let z = -12.5; z <= 12.5; z += 1.2) {
      b.box(0.28, h, 1.05, wall, -13.4, y, z)
      b.box(0.36, 0.12, 1.05, cap, -13.4, y + h / 2 + 0.04, z)
      b.box(0.28, h, 1.05, wall, 13.4, y, z)
      b.box(0.36, 0.12, 1.05, cap, 13.4, y + h / 2 + 0.04, z)
    }
    for (let x = -13; x <= -2.6; x += 1.2) {
      b.box(1.05, h, 0.28, wall, x, y, 13.4)
      b.box(1.05, 0.12, 0.36, cap, x, y + h / 2 + 0.04, 13.4)
    }
    for (let x = 2.6; x <= 13; x += 1.2) {
      b.box(1.05, h, 0.28, wall, x, y, 13.4)
      b.box(1.05, 0.12, 0.36, cap, x, y + h / 2 + 0.04, 13.4)
    }
    // Lantern posts along the south road toward the gate.
    for (const z of [3.5, 6.2, 9.0, 11.2]) {
      for (const side of [-1.35, 1.35] as const) {
        b.box(0.1, 1.35, 0.1, WOOD, side, 0.7, z)
        b.box(0.22, 0.22, 0.22, '#ffe27a', side, 1.45, z, { glow: true })
      }
    }
  }
  if (townLevel >= 10) {
    // Spire and gold crest above the hall (kept short so it does not hide the north row).
    b.box(1.1, 1.15, 1.1, '#b9b6ad', hall.x, 3.35, hall.z - 0.1)
    b.box(1.3, 0.18, 1.3, '#5b6570', hall.x, 3.95, hall.z - 0.1)
    b.box(0.55, 1.05, 0.55, '#d9b54a', hall.x, 4.55, hall.z - 0.1)
    b.box(0.22, 0.55, 0.22, '#ffe27a', hall.x, 5.25, hall.z - 0.1, { glow: true })
    b.box(0.7, 0.14, 0.14, '#d9b54a', hall.x, 3.55, hall.z + hall.d / 2 + 0.05)
    b.box(0.2, 0.2, 0.08, '#ffe27a', hall.x, 3.55, hall.z + hall.d / 2 + 0.12, { glow: true })
    for (const side of [-1, 1] as const) {
      b.box(0.35, 0.12, 0.35, '#d9b54a', hall.x + side * 1.5, 2.15, hall.z + hall.d / 2 + 0.1)
    }
  }
  root.add(b.build())
  return root
}

// Short-lived light pillar and rising banners over the hall for a promotion.
export function buildPromoteFx(townLevel: number): THREE.Group {
  const root = new THREE.Group()
  root.name = 'promoteFx'
  const hall = LOTS.hall
  const pillar = new Builder()
    .box(0.4, 5.2, 0.4, townLevel >= 10 ? '#ffe27a' : townLevel >= 9 ? '#c79bff' : '#9fe8ff', hall.x, 3.6, hall.z, { glow: true })
    .box(0.7, 0.7, 0.7, '#fff6c8', hall.x, 6.4, hall.z, { glow: true })
    .box(0.28, 0.28, 0.28, '#ffe27a', hall.x, 7.0, hall.z, { glow: true })
    .build({ castShadow: false })
  pillar.name = 'pillar'
  root.add(pillar)
  const banners = new Builder()
  for (const side of [-1, 1] as const) {
    const x = hall.x + side * 1.6
    const z = hall.z + hall.d / 2 + 0.2
    banners.box(0.08, 2.4, 0.08, WOOD, x, 1.3, z)
    banners.box(0.7, 0.95, 0.05, side < 0 ? '#c0392b' : '#3f6fa8', x + side * 0.4, 2.2, z)
    banners.box(0.7, 0.12, 0.05, '#d9b54a', x + side * 0.4, 2.75, z)
  }
  const flags = banners.build({ castShadow: false })
  flags.name = 'risingFlags'
  flags.userData.baseY = 0
  root.add(flags)
  return root
}

// Enemy camp beyond the south gate while an invasion is warned (Docs/endgame.md 4c).
// Built once and shown or hidden.
export function buildInvasionCamp(): THREE.Group {
  const root = new THREE.Group()
  root.name = 'invasionCamp'
  const b = new Builder()
  const z0 = GATE.z + 2.6
  for (const side of [-2.4, -0.8, 0.8, 2.4] as const) {
    b.box(0.12, 1.7, 0.12, WOOD, side, 0.9, z0)
    b.box(0.7, 0.95, 0.06, '#8a1a1a', side + (side < 0 ? 0.4 : -0.4), 1.45, z0)
    b.box(0.7, 0.12, 0.06, '#2a1010', side + (side < 0 ? 0.4 : -0.4), 2.0, z0)
  }
  for (const [x, z] of [[-1.6, z0 + 1.1], [1.6, z0 + 1.1], [0, z0 + 2.0]] as const) {
    b.box(0.55, 0.18, 0.55, '#3a2a20', x, 0.14, z)
    b.box(0.32, 0.45, 0.32, '#ff6a3a', x, 0.5, z, { glow: true })
    b.box(0.16, 0.35, 0.16, '#ffd36b', x, 0.85, z, { glow: true })
  }
  // Warning banner closer to the gate.
  b.box(0.1, 1.4, 0.1, WOOD, -3.2, 0.75, GATE.z + 0.9)
  b.box(0.85, 0.55, 0.06, '#e05a4a', -2.7, 1.35, GATE.z + 0.9)
  b.box(0.2, 0.2, 0.08, '#ffe27a', -2.7, 1.35, GATE.z + 0.96, { glow: true })
  root.add(b.build())
  root.visible = false
  return root
}

// Aftermath props after an invasion fight: rubble and smoke for a loss,
// confetti anchors for a win (bursts handle the petals).
export function buildInvasionAftermath(won: boolean): THREE.Group {
  const root = new THREE.Group()
  root.name = won ? 'invasionWin' : 'invasionLoss'
  const b = new Builder()
  if (won) {
    for (const x of [-1.4, 0, 1.4]) {
      b.box(0.2, 0.2, 0.2, '#ffe27a', x, 1.6, GATE.z - 0.8, { glow: true })
    }
  } else {
    for (const [x, z, s] of [[-1.2, GATE.z - 0.4, 0.7], [0.8, GATE.z + 0.2, 0.55], [-0.3, GATE.z + 0.9, 0.85]] as const) {
      b.box(s, 0.35, s * 0.7, '#6a5a4a', x, 0.2, z)
      b.box(s * 0.5, 0.25, s * 0.4, '#4a3a30', x + 0.2, 0.4, z + 0.1)
    }
    for (const x of [-1.8, 0.2, 1.6]) {
      b.box(0.35, 0.5, 0.35, '#5a5a5a', x, 0.5, GATE.z + 0.5)
      b.box(0.5, 0.35, 0.5, '#7a7a7a', x, 0.9, GATE.z + 0.5)
    }
  }
  root.add(b.build())
  root.visible = false
  return root
}

// Seasonal festival props for the plaza (and the tavern yard when it is open).
// One merged mesh per season; world-space coordinates (Docs/morale.md, Docs/tavern.md).
export function buildFestivalDecor(kind: FestivalKind, withYard: boolean): THREE.Group {
  const b = new Builder()
  const corners: [number, number][] = [
    [PLAZA.min + 0.55, PLAZA.min + 0.55],
    [PLAZA.max - 0.55, PLAZA.min + 0.55],
    [PLAZA.min + 0.55, PLAZA.max - 0.55],
    [PLAZA.max - 0.55, PLAZA.max - 0.55],
  ]
  if (kind === 'spring') {
    for (const [x, z] of corners) {
      b.box(0.08, 1.15, 0.08, WOOD, x, 0.65, z)
      for (const t of [0.35, 0.55, 0.75, 0.95]) {
        b.box(0.22, 0.08, 0.08, t % 0.4 < 0.2 ? '#f4a0c0' : '#ffe08a', x, t + 0.2, z)
        b.box(0.08, 0.08, 0.22, t % 0.4 < 0.2 ? '#ff8fb8' : '#fff0a8', x, t + 0.2, z)
      }
    }
    for (const [x, z] of [
      [-2.4, -2.1],
      [2.4, -2.1],
      [-2.2, 2.3],
      [2.2, 2.3],
    ] as [number, number][]) {
      b.box(0.34, 0.14, 0.34, '#c9a36b', x, 0.12, z)
      b.box(0.12, 0.12, 0.12, '#f278a8', x - 0.08, 0.24, z - 0.05)
      b.box(0.12, 0.12, 0.12, '#ffe08a', x + 0.08, 0.24, z + 0.05)
      b.box(0.1, 0.1, 0.1, '#9fd36b', x, 0.28, z)
    }
    // Flower ropes along the north plaza edge.
    for (let i = 0; i < 7; i += 1) {
      const x = -3.2 + i * 1.05
      b.box(0.18, 0.1, 0.1, i % 2 === 0 ? '#f4a0c0' : '#ffe08a', x, 1.05, PLAZA.min + 0.35)
    }
  } else if (kind === 'summer') {
    const banners = ['#c0392b', '#3f6fa8', '#e2b340', '#3f8f5a']
    corners.forEach(([x, z], index) => {
      const color = banners[index % banners.length]!
      b.box(0.08, 1.4, 0.08, WOOD, x, 0.75, z)
      b.box(0.42, 0.55, 0.06, color, x + 0.22, 1.15, z)
      b.box(0.42, 0.08, 0.06, '#efe6d4', x + 0.22, 1.4, z)
    })
    // Small archery targets facing the plaza centre.
    for (const [x, z] of [
      [-3.6, 0.8],
      [3.6, -0.6],
    ] as [number, number][]) {
      b.box(0.08, 0.9, 0.08, WOOD, x, 0.5, z)
      b.box(0.5, 0.5, 0.06, '#efe6d4', x, 0.85, z + (x < 0 ? 0.05 : -0.05))
      b.box(0.32, 0.32, 0.05, '#c0392b', x, 0.85, z + (x < 0 ? 0.07 : -0.07))
      b.box(0.14, 0.14, 0.05, '#efe6d4', x, 0.85, z + (x < 0 ? 0.09 : -0.09))
      b.box(0.06, 0.06, 0.05, '#2a2a2a', x, 0.85, z + (x < 0 ? 0.11 : -0.11))
    }
  } else if (kind === 'autumn') {
    for (const [x, z] of [
      [-4.2, -3.4],
      [4.0, -3.6],
      [-3.8, 3.5],
      [3.9, 3.4],
    ] as [number, number][]) {
      // Grain sheaf.
      b.box(0.28, 0.7, 0.28, '#d9b54a', x, 0.4, z)
      b.box(0.34, 0.18, 0.34, '#c9a036', x, 0.78, z)
      b.box(0.1, 0.2, 0.1, '#8a5a32', x, 0.12, z)
    }
    for (const [x, z] of [
      [-2.6, 3.8],
      [-1.9, 4.0],
      [2.4, 3.7],
    ] as [number, number][]) {
      b.box(0.28, 0.24, 0.28, '#e07b2a', x, 0.18, z)
      b.box(0.08, 0.1, 0.08, '#3f8f5a', x, 0.32, z)
    }
    // Fruit cart near the south plaza edge.
    b.box(0.9, 0.12, 0.5, WOOD, 0.4, 0.35, 4.55)
    b.box(0.12, 0.28, 0.12, WOOD, 0.05, 0.18, 4.35)
    b.box(0.12, 0.28, 0.12, WOOD, 0.75, 0.18, 4.35)
    b.box(0.12, 0.28, 0.12, WOOD, 0.05, 0.18, 4.75)
    b.box(0.12, 0.28, 0.12, WOOD, 0.75, 0.18, 4.75)
    b.box(0.18, 0.18, 0.18, '#c0392b', 0.2, 0.48, 4.5)
    b.box(0.16, 0.16, 0.16, '#e2b340', 0.42, 0.48, 4.55)
    b.box(0.16, 0.16, 0.16, '#e07b2a', 0.62, 0.46, 4.48)
  } else {
    // Winter remembrance: lantern poles and candles.
    for (const [x, z] of corners) {
      b.box(0.08, 1.2, 0.08, WOOD, x, 0.7, z)
      b.box(0.28, 0.2, 0.28, '#5d4433', x, 1.35, z)
      b.box(0.18, 0.18, 0.18, '#ffe27a', x, 1.35, z, { glow: true })
    }
    for (const [x, z] of [
      [-1.9, -1.7],
      [1.9, -1.7],
      [-1.9, 1.7],
      [1.9, 1.7],
      [0, -2.2],
      [0, 2.2],
    ] as [number, number][]) {
      b.box(0.1, 0.18, 0.1, '#efe6d4', x, 0.16, z)
      b.box(0.06, 0.1, 0.06, '#ffe27a', x, 0.3, z, { glow: true })
    }
  }

  if (withYard) {
    const yard = tavernYard()
    const cx = (yard.minX + yard.maxX) / 2
    const cz = (yard.minZ + yard.maxZ) / 2
    if (kind === 'spring') {
      b.box(0.08, 1.0, 0.08, WOOD, yard.minX + 0.2, 0.55, yard.minZ + 0.2)
      b.box(0.08, 1.0, 0.08, WOOD, yard.maxX - 0.2, 0.55, yard.minZ + 0.2)
      for (let i = 0; i < 5; i += 1) {
        const x = yard.minX + 0.25 + i * ((yard.maxX - yard.minX - 0.5) / 4)
        b.box(0.16, 0.1, 0.1, i % 2 === 0 ? '#f4a0c0' : '#9fd36b', x, 1.0, yard.minZ + 0.2)
      }
      b.box(0.32, 0.14, 0.32, '#c9a36b', cx + 0.55, 0.12, cz + 0.15)
      b.box(0.12, 0.12, 0.12, '#f278a8', cx + 0.55, 0.24, cz + 0.15)
    } else if (kind === 'summer') {
      b.box(0.08, 1.25, 0.08, WOOD, yard.minX + 0.15, 0.7, cz)
      b.box(0.38, 0.5, 0.06, '#3f6fa8', yard.minX + 0.35, 1.1, cz)
      b.box(0.08, 1.25, 0.08, WOOD, yard.maxX - 0.15, 0.7, cz)
      b.box(0.38, 0.5, 0.06, '#c0392b', yard.maxX - 0.35, 1.1, cz)
      b.box(0.4, 0.4, 0.06, '#efe6d4', cx, 0.7, yard.maxZ - 0.15)
      b.box(0.24, 0.24, 0.05, '#c0392b', cx, 0.7, yard.maxZ - 0.12)
    } else if (kind === 'autumn') {
      b.box(0.26, 0.65, 0.26, '#d9b54a', yard.minX + 0.35, 0.38, cz)
      b.box(0.3, 0.16, 0.3, '#c9a036', yard.minX + 0.35, 0.72, cz)
      b.box(0.26, 0.22, 0.26, '#e07b2a', cx + 0.45, 0.16, yard.maxZ - 0.25)
      b.box(0.7, 0.1, 0.4, WOOD, cx - 0.1, 0.32, yard.minZ + 0.35)
      b.box(0.14, 0.14, 0.14, '#c0392b', cx - 0.25, 0.44, yard.minZ + 0.35)
      b.box(0.14, 0.14, 0.14, '#e2b340', cx, 0.44, yard.minZ + 0.4)
    } else {
      b.box(0.08, 1.1, 0.08, WOOD, yard.minX + 0.2, 0.6, yard.minZ + 0.25)
      b.box(0.22, 0.18, 0.22, '#5d4433', yard.minX + 0.2, 1.2, yard.minZ + 0.25)
      b.box(0.14, 0.14, 0.14, '#ffe27a', yard.minX + 0.2, 1.2, yard.minZ + 0.25, { glow: true })
      b.box(0.08, 1.1, 0.08, WOOD, yard.maxX - 0.2, 0.6, yard.minZ + 0.25)
      b.box(0.22, 0.18, 0.22, '#5d4433', yard.maxX - 0.2, 1.2, yard.minZ + 0.25)
      b.box(0.14, 0.14, 0.14, '#ffe27a', yard.maxX - 0.2, 1.2, yard.minZ + 0.25, { glow: true })
      b.box(0.1, 0.16, 0.1, '#efe6d4', cx, 0.14, cz + 0.2)
      b.box(0.06, 0.1, 0.06, '#ffe27a', cx, 0.28, cz + 0.2, { glow: true })
    }
  }

  const root = new THREE.Group()
  root.name = `festival-${kind}`
  root.add(b.build())
  return root
}

// Covered cart and donkey for the wandering merchant (Docs/market.md).
export function buildMerchantCart(): THREE.Group {
  const root = new THREE.Group()
  const body = new Builder()
  body.box(1.35, 0.22, 0.8, '#8a5a32', 0, 0.48, 0)
  body.box(1.45, 0.08, 0.9, '#6b4a33', 0, 0.62, 0)
  body.box(0.08, 0.45, 0.78, '#8a5a32', -0.62, 0.78, 0)
  body.box(0.08, 0.45, 0.78, '#8a5a32', 0.62, 0.78, 0)
  body.box(1.2, 0.5, 0.72, '#c45c3a', 0, 0.95, 0)
  body.box(1.28, 0.08, 0.78, '#efe6d4', 0, 1.22, 0)
  body.box(0.35, 0.22, 0.28, '#9c7448', -0.25, 0.78, 0.05)
  body.box(0.28, 0.18, 0.22, '#d4b474', 0.3, 0.76, -0.05)
  body.box(0.5, 0.08, 0.12, WOOD, 0, 0.4, 0.75)
  root.add(body.build())

  const wheels = new THREE.Group()
  wheels.name = 'wheels'
  for (const [x, z] of [
    [-0.48, 0.42],
    [0.48, 0.42],
    [-0.48, -0.42],
    [0.48, -0.42],
  ] as const) {
    const wheel = new Builder()
      .box(0.12, 0.42, 0.42, '#3a2a20', 0, 0, 0)
      .box(0.08, 0.12, 0.12, '#c9a36b', 0, 0, 0)
      .build({ castShadow: false })
    wheel.position.set(x, 0.22, z)
    wheels.add(wheel)
  }
  root.add(wheels)

  const animal = new Builder()
  animal.box(0.32, 0.38, 0.62, '#8a7048', 0, 0.48, 1.15)
  animal.box(0.26, 0.26, 0.28, '#8a7048', 0, 0.72, 1.48)
  animal.box(0.08, 0.16, 0.06, '#5a4830', -0.08, 0.88, 1.42)
  animal.box(0.08, 0.16, 0.06, '#5a4830', 0.08, 0.88, 1.42)
  animal.box(0.08, 0.08, 0.04, '#2a2a2a', -0.07, 0.74, 1.62)
  animal.box(0.08, 0.08, 0.04, '#2a2a2a', 0.07, 0.74, 1.62)
  animal.box(0.08, 0.28, 0.08, '#5a4830', -0.12, 0.22, 0.95)
  animal.box(0.08, 0.28, 0.08, '#5a4830', 0.12, 0.22, 0.95)
  animal.box(0.08, 0.28, 0.08, '#5a4830', -0.12, 0.22, 1.35)
  animal.box(0.08, 0.28, 0.08, '#5a4830', 0.12, 0.22, 1.35)
  animal.box(0.06, 0.22, 0.08, '#6b4a33', 0, 0.45, 0.8)
  root.add(animal.build())
  return root
}

function drawTemple(b: Builder, w: number, d: number, grow: number): number {
  const top = house(b, { w, d, h: 1.6 + grow * 0.3, wall: '#f1efe8', roof: '#7fa6d8', steps: 3, stone: '#c9c5bb' })
  b.box(0.9, 1.0, 0.9, '#f1efe8', 0, top + 0.4, 0).box(1.1, 0.2, 1.1, '#7fa6d8', 0, top + 1.0, 0)
  b.box(0.25, 0.25, 0.25, '#e8c95a', 0, top + 0.55, 0.46, { glow: true })
  b.box(0.36, 0.5, 0.05, '#9fd3ff', w * 0.3, 1.2, d / 2 + 0.03, { glow: true })
  return top + 1.1
}

// Schoolhouse: chalk board and book sign, then a wing, a bell, and lanterns.
function drawSchool(b: Builder, w: number, d: number, level: number): number {
  const grow = level - 1
  const top = house(b, { w, d, h: 1.5 + grow * 0.18, wall: '#efe8d6', roof: '#5a7a9a', timber: true, steps: 2, stone: '#c9c5bb' })
  b.box(0.55, 0.38, 0.06, '#3a5a40', -w * 0.22, 1.15, d / 2 + 0.05)
  b.box(0.08, 1.05, 0.08, WOOD, w * 0.35, 0.65, d / 2 + 0.22)
  b.box(0.42, 0.3, 0.05, '#e8d4a8', w * 0.35, 1.12, d / 2 + 0.26)
  b.box(0.18, 0.14, 0.04, '#c45c3a', w * 0.32, 1.12, d / 2 + 0.3)
  let peak = top
  if (level >= 2) {
    const wingX = w / 2 + 0.55
    b.box(1.05, 1.15, d * 0.7, '#efe8d6', wingX, 0.75, 0)
    b.box(1.25, 0.14, d * 0.85, '#5a7a9a', wingX, 1.4, 0)
    b.box(0.3, 0.24, 0.06, '#5aa0a0', wingX, 0.95, d * 0.32)
    peak = Math.max(peak, 1.55)
  }
  if (level >= 3) {
    b.box(0.18, 0.55, 0.18, '#8a9098', 0, top + 0.35, 0)
    b.box(0.4, 0.12, 0.4, '#d9b54a', 0, top + 0.65, 0)
    b.box(0.16, 0.16, 0.16, '#ffe27a', 0, top + 0.82, 0, { glow: true })
    peak = Math.max(peak, top + 0.95)
  }
  if (level >= 4) {
    for (const x of [-w * 0.35, w * 0.15]) {
      b.box(0.1, 0.85, 0.1, WOOD, x, 0.55, d / 2 + 0.45)
      b.box(0.18, 0.18, 0.18, '#ffe27a', x, 1.05, d / 2 + 0.45, { glow: true })
    }
    b.box(0.5, 0.14, 0.08, '#d9b54a', 0, 1.45, d / 2 + 0.06)
    peak = Math.max(peak, 1.2)
  }
  return peak
}

// Hall of fame: white-stone shrine with pillars (Docs/legends.md).
// Lv2 adds steps and banners; Lv3 adds a gold roof crest and braziers.
function drawLegends(b: Builder, w: number, d: number, level: number): number {
  const grow = level - 1
  const top = house(b, { w, d, h: 1.55 + grow * 0.2, wall: '#f2efe6', roof: '#8a9098', steps: 3, stone: '#c9c5bb' })
  // Front columns.
  for (const x of [-w * 0.32, w * 0.32]) {
    b.box(0.22, 1.35, 0.22, '#e8e4da', x, 0.78, d / 2 + 0.05)
    b.box(0.3, 0.1, 0.3, '#d4d0c6', x, 1.5, d / 2 + 0.05)
    b.box(0.3, 0.1, 0.3, '#d4d0c6', x, 0.12, d / 2 + 0.05)
  }
  // Pediment plaque.
  b.box(w * 0.55, 0.28, 0.08, '#d9b54a', 0, 1.55, d / 2 + 0.08)
  b.box(0.18, 0.18, 0.06, '#ffe27a', 0, 1.55, d / 2 + 0.12, { glow: true })
  let peak = Math.max(top, 1.7)
  if (level >= 2) {
    // Broad front steps and flags.
    b.box(w * 1.05, 0.1, 0.55, '#c9c5bb', 0, 0.08, d / 2 + 0.55)
    b.box(w * 0.9, 0.1, 0.4, '#bdb9af', 0, 0.16, d / 2 + 0.4)
    for (const x of [-w * 0.45, w * 0.45]) {
      b.box(0.08, 1.35, 0.08, WOOD, x, 0.75, d / 2 + 0.7)
      b.box(0.38, 0.5, 0.05, x < 0 ? '#c0392b' : '#3f6fa8', x + (x < 0 ? 0.2 : -0.2), 1.15, d / 2 + 0.7)
      b.box(0.38, 0.08, 0.05, '#efe6d4', x + (x < 0 ? 0.2 : -0.2), 1.38, d / 2 + 0.7)
    }
    peak = Math.max(peak, 1.55)
  }
  if (level >= 3) {
    // Gold crest and braziers.
    b.box(0.7, 0.18, 0.7, '#d9b54a', 0, top + 0.2, 0)
    b.box(0.35, 0.35, 0.35, '#ffe27a', 0, top + 0.45, 0, { glow: true })
    b.box(0.5, 0.12, 0.12, '#d9b54a', 0, top + 0.55, 0)
    for (const x of [-w * 0.38, w * 0.38]) {
      b.box(0.28, 0.35, 0.28, '#6b4a33', x, 0.35, d / 2 + 0.35)
      b.box(0.22, 0.12, 0.22, '#ff8a3d', x, 0.58, d / 2 + 0.35, { glow: true })
      b.box(0.1, 0.22, 0.1, '#ffd36b', x, 0.72, d / 2 + 0.35, { glow: true })
    }
    peak = Math.max(peak, top + 0.7)
  }
  if (level >= 4) {
    for (const x of [-w * 0.18, w * 0.18]) {
      b.box(0.18, 1.55, 0.18, '#e8e4da', x, 0.9, d / 2 + 0.05)
      b.box(0.26, 0.1, 0.26, '#d9b54a', x, 1.72, d / 2 + 0.05)
    }
    b.box(0.9, 0.2, 0.12, '#d9b54a', 0, 1.75, d / 2 + 0.1)
    b.box(0.22, 0.22, 0.08, '#ffe27a', 0, 1.75, d / 2 + 0.16, { glow: true })
    for (const x of [-w * 0.5, w * 0.5]) {
      b.box(0.12, 0.12, 0.12, '#ffe27a', x, 1.4, d / 2 + 0.55, { glow: true })
    }
    peak = Math.max(peak, 1.95)
  }
  return peak
}

// Pads south of the hall for legend statues: 2 / 4 / 6 by building level.
export function legendStatuePads(level: number): { x: number; z: number }[] {
  const count = level <= 0 ? 0 : level === 1 ? 2 : level === 2 ? 4 : 6
  const lot = LOTS.legends
  const front = lot.z + lot.d / 2 + 0.85
  const pads: { x: number; z: number }[] = []
  if (count <= 2) {
    for (const x of [lot.x - 0.75, lot.x + 0.75]) {
      pads.push({ x, z: front })
    }
  } else if (count <= 4) {
    for (let index = 0; index < 4; index += 1) {
      pads.push({
        x: lot.x - 0.85 + (index % 2) * 1.7,
        z: front + Math.floor(index / 2) * 0.9,
      })
    }
  } else {
    for (let index = 0; index < 6; index += 1) {
      pads.push({
        x: lot.x - 1.15 + (index % 3) * 1.15,
        z: front + Math.floor(index / 3) * 0.9,
      })
    }
  }
  return pads.slice(0, count)
}

// Pedestals for displayed heirlooms around the hall front and sides.
export function shrinePedestals(count: number): { x: number; z: number }[] {
  const lot = LOTS.legends
  const spots: { x: number; z: number }[] = [
    { x: lot.x - 1.35, z: lot.z + 0.2 },
    { x: lot.x + 1.35, z: lot.z + 0.2 },
    { x: lot.x - 1.35, z: lot.z - 0.55 },
    { x: lot.x + 1.35, z: lot.z - 0.55 },
    { x: lot.x - 0.55, z: lot.z - lot.d / 2 - 0.35 },
    { x: lot.x + 0.55, z: lot.z - lot.d / 2 - 0.35 },
    { x: lot.x - 1.55, z: lot.z + 0.85 },
    { x: lot.x + 1.55, z: lot.z + 0.85 },
  ]
  return spots.slice(0, Math.max(0, count))
}

const SHRINE_GRADE: Record<string, string> = {
  common: '#c9c5bb',
  fine: '#6db36d',
  rare: '#5a8fd4',
  epic: '#9b6bff',
  legend: '#d9b54a',
}

// Tiny glowing heirloom model for a shrine pedestal (slot + grade colour).
export function buildShrineRelic(slot: string, grade: string): THREE.Group {
  const tint = SHRINE_GRADE[grade] ?? SHRINE_GRADE.common!
  const b = new Builder()
  b.box(0.36, 0.12, 0.36, '#8a8580', 0, 0.06, 0)
  b.box(0.28, 0.08, 0.28, '#6b6762', 0, 0.14, 0)
  if (slot === 'weapon') {
    b.box(0.08, 0.55, 0.08, tint, 0, 0.48, 0, { glow: true })
    b.box(0.22, 0.08, 0.06, '#d9b54a', 0, 0.28, 0)
    b.box(0.14, 0.14, 0.04, tint, 0, 0.72, 0, { glow: true })
  } else if (slot === 'armor') {
    b.box(0.28, 0.32, 0.16, tint, 0, 0.4, 0, { glow: true })
    b.box(0.34, 0.1, 0.2, '#d9b54a', 0, 0.28, 0)
    b.box(0.12, 0.12, 0.12, tint, 0, 0.58, 0, { glow: true })
  } else {
    b.box(0.16, 0.16, 0.1, tint, 0, 0.36, 0, { glow: true })
    b.box(0.06, 0.22, 0.06, '#d9b54a', 0, 0.28, 0)
    b.box(0.2, 0.06, 0.06, tint, 0, 0.48, 0, { glow: true })
  }
  return b.build({ castShadow: false })
}
