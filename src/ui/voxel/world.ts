import * as THREE from 'three'
import type { BuildingId } from '../../core'
import { Builder } from './kit'
import { mixHex, seeded } from './look'

// Village layout in world units (one ground tile = 1). The plaza is the dirt
// square |x|, |z| <= 6 where residents walk.

export type Lot = { x: number; z: number; w: number; d: number }

export const LOTS: Record<BuildingId, Lot> = {
  hall: { x: -8.5, z: -8.5, w: 5, d: 4 },
  inn: { x: 8.5, z: -8.5, w: 4, d: 3 },
  house: { x: -9, z: 5.5, w: 3, d: 2.6 },
  guild: { x: 9.5, z: 4, w: 3.4, d: 2.8 },
  smith: { x: 5.5, z: 9.5, w: 3, d: 2.6 },
  temple: { x: -1.5, z: -10.5, w: 4, d: 3.2 },
  // The lucky fountain stands in the middle of the square (Docs/fountain.md).
  fountain: { x: 0, z: 0, w: 2.2, d: 2.2 },
  // Placeholder spot for the alchemy workshop; task 37 gives it a model.
  alchemy: { x: -10.5, z: -1.5, w: 3, d: 2.6 },
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
    [-13.5, -2, 1], [-12.5, 2, 0.8], [-13.5, 10, 1.1], [-4.5, -13.5, 0.9], [4.5, -13.5, 1], [13.5, -1, 1], [13.5, 8.5, 0.9],
    [11, 12.5, 1.1], [-11, 13, 0.9], [13, -12.5, 1], [-13, -13, 1.1], [3, 13.5, 0.8], [-11, -3, 0.7], [12, -11.5, 0.8], [-2.6, 13.5, 1],
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

  // Wheat field with a fence.
  b.within(-6, 0, 11, 0, 0, 0, () => {
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
  return top + 0.4
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
    return top
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
    return Math.max(top, 2.4)
  }
  if (id === 'alchemy') {
    return drawAlchemy(b, w, d, level)
  }
  if (id === 'smith') {
    const top = house(b, { w, d, h: 1.4 + grow * 0.25, wall: '#9a7a5c', roof: '#6d6d6d', steps: 3 })
    b.box(0.6, 1.3, 0.6, '#7d7a74', -w * 0.3, top + 0.2, -d * 0.15).box(0.36, 0.2, 0.36, '#ff8a3d', -w * 0.3, top + 0.86, -d * 0.15, { glow: true })
    b.box(0.5, 0.25, 0.3, '#4a4d54', w * 0.35, 0.55, d / 2 + 0.6).box(0.25, 0.3, 0.2, '#3a3d44', w * 0.35, 0.27, d / 2 + 0.6)
    b.box(0.3, 0.3, 0.06, '#ff9d4d', -w * 0.3, 0.45, d / 2 + 0.04, { glow: true })
    return top + 1
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
  group.position.set(-5.2, 0, 9.2)
  return group
}

function drawTemple(b: Builder, w: number, d: number, grow: number): number {
  const top = house(b, { w, d, h: 1.6 + grow * 0.3, wall: '#f1efe8', roof: '#7fa6d8', steps: 3, stone: '#c9c5bb' })
  b.box(0.9, 1.0, 0.9, '#f1efe8', 0, top + 0.4, 0).box(1.1, 0.2, 1.1, '#7fa6d8', 0, top + 1.0, 0)
  b.box(0.25, 0.25, 0.25, '#e8c95a', 0, top + 0.55, 0.46, { glow: true })
  b.box(0.36, 0.5, 0.05, '#9fd3ff', w * 0.3, 1.2, d / 2 + 0.03, { glow: true })
  return top + 1.1
}
