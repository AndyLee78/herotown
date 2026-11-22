import * as THREE from 'three'
import { buildBody, idlePose, type BodySpec, type Rig } from './character'
import { Builder } from './kit'

// Monster models, one per monster id in src/data/monsters.json. Humanoid
// monsters reuse the hero body; animals and spirits have their own shapes.

export type Creature = {
  kind: 'beast' | 'flyer' | 'blob' | 'spider' | 'ghost'
  group: THREE.Group
  body: THREE.Group
  legs: THREE.Group[]
  wings: THREE.Group[]
  height: number
  hover: number
}

export type Actor = Rig | Creature

const BONE = '#e9e4d4'

const HUMANOIDS: Record<string, Omit<BodySpec, 'head' | 'stoop' | 'style' | 'beard'> & Partial<Pick<BodySpec, 'stoop' | 'beard' | 'style'>>> = {
  miner: {
    outfit: { body: '#6b5a44', trim: '#3a3028', pants: '#4a4038', weapon: 'pick', hat: 'helmet' },
    skin: '#d49d6e',
    eye: '#2a2522',
    hair: '#3d3028',
    beard: true,
    scale: 1,
  },
  brigand: {
    outfit: { body: '#5a3a3a', trim: '#2e2626', pants: '#3a3030', weapon: 'sword', hat: 'hood' },
    skin: '#ecc39b',
    eye: '#2a2522',
    hair: null,
    scale: 1,
  },
  skeleton: {
    outfit: { body: BONE, trim: '#b9b2a0', pants: BONE, weapon: 'rusty' },
    skin: BONE,
    eye: '#2a2a2a',
    eyeSize: 1.5,
    hair: null,
    ribs: true,
    shoe: '#cfc8b4',
    scale: 1,
  },
  zombie: {
    outfit: { body: '#5a6a7a', trim: '#3e4a3a', pants: '#4a4a3a', weapon: 'none' },
    skin: '#8fb07a',
    eye: '#d9e07a',
    eyeGlow: true,
    hair: '#3a3a2a',
    style: 'bald',
    stoop: 0.15,
    scale: 1,
  },
  ghoul: {
    outfit: { body: '#4a4458', trim: '#2e2a38', pants: '#3a3646', weapon: 'none' },
    skin: '#9aa3b0',
    eye: '#ff6a4a',
    eyeGlow: true,
    hair: null,
    stoop: 0.3,
    scale: 1.05,
  },
  barrow_lord: {
    outfit: { body: '#6d7480', trim: '#d9b54a', pants: '#4f5560', weapon: 'sword', pads: true, hat: 'crown' },
    skin: BONE,
    eye: '#ff4b3a',
    eyeGlow: true,
    eyeSize: 1.4,
    hair: null,
    ribs: false,
    shoe: '#3a3d44',
    scale: 1.5,
  },
  crypt_lord: {
    outfit: { body: '#3d2a5c', trim: '#b48cff', pants: '#2e2046', weapon: 'staff', robe: true, hat: 'crown' },
    skin: BONE,
    eye: '#b48cff',
    eyeGlow: true,
    eyeSize: 1.4,
    hair: null,
    scale: 1.5,
  },
  mine_boss: {
    outfit: { body: '#76716a', trim: '#5e5953', pants: '#6a655e', weapon: 'none', pads: true },
    skin: '#8a857d',
    eye: '#ff8a3d',
    eyeGlow: true,
    eyeSize: 1.3,
    hair: null,
    shoe: '#5e5953',
    scale: 1.8,
  },
}

export function buildEnemy(refId: string): Actor {
  const humanoid = HUMANOIDS[refId]
  if (humanoid) {
    return buildBody({ head: 1, stoop: 0, style: 'short', beard: false, ...humanoid })
  }
  switch (refId) {
    case 'wolf':
      return beast({ fur: '#8d939c', belly: '#c9ccd1', eye: '#f2c14e', legHeight: 0.28, size: 1, ears: 'pointed' })
    case 'boar':
      return beast({ fur: '#7a5640', belly: '#9c7458', eye: '#2a1d16', legHeight: 0.22, size: 1.1, ears: 'small', tusks: true })
    case 'cave_boss':
      return beast({ fur: '#6b4a35', belly: '#a07a5a', eye: '#ffb04a', legHeight: 0.3, size: 1.7, ears: 'round' })
    case 'bat':
      return bat()
    case 'slime':
      return blob('#79c96b', '#8fd97f', 1)
    case 'toad':
      return toad()
    case 'spider':
      return spider()
    case 'wraith':
      return wraith()
    default:
      return blob('#c96b6b', '#d98f8f', 1)
  }
}

function creature(kind: Creature['kind'], height: number, hover = 0): Creature {
  const group = new THREE.Group()
  const body = new THREE.Group()
  group.add(body)
  return { kind, group, body, legs: [], wings: [], height, hover }
}

type BeastSpec = { fur: string; belly: string; eye: string; legHeight: number; size: number; ears: 'pointed' | 'small' | 'round'; tusks?: boolean }

function beast(spec: BeastSpec): Creature {
  const { fur, belly, legHeight: h } = spec
  const c = creature('beast', (h + 0.55) * spec.size)
  const torso = new Builder()
    .box(0.48, 0.34, 0.78, fur, 0, h + 0.17, 0)
    .box(0.4, 0.06, 0.6, belly, 0, h + 0.01, 0.02)
    .box(0.1, 0.1, 0.26, fur, 0, h + 0.28, -0.48, { rx: 0.5 })
  if (spec.tusks) {
    torso.box(0.1, 0.08, 0.6, '#4a3528', 0, h + 0.36, -0.05)
  }
  c.body.add(torso.build())
  const head = new Builder()
    .box(0.36, 0.32, 0.34, fur, 0, h + 0.32, 0.5)
    .box(0.22, 0.16, 0.22, belly, 0, h + 0.24, 0.74)
    .box(0.08, 0.06, 0.04, '#2a1d16', 0, h + 0.3, 0.86)
    .box(0.06, 0.06, 0.02, spec.eye, -0.1, h + 0.38, 0.675, { glow: spec.eye !== '#2a1d16' })
    .box(0.06, 0.06, 0.02, spec.eye, 0.1, h + 0.38, 0.675, { glow: spec.eye !== '#2a1d16' })
  if (spec.ears === 'pointed') {
    head.box(0.08, 0.14, 0.06, fur, -0.12, h + 0.54, 0.46).box(0.08, 0.14, 0.06, fur, 0.12, h + 0.54, 0.46)
  } else if (spec.ears === 'round') {
    head.box(0.1, 0.1, 0.06, fur, -0.15, h + 0.52, 0.44).box(0.1, 0.1, 0.06, fur, 0.15, h + 0.52, 0.44)
  } else {
    head.box(0.07, 0.07, 0.05, fur, -0.14, h + 0.5, 0.44).box(0.07, 0.07, 0.05, fur, 0.14, h + 0.5, 0.44)
  }
  if (spec.tusks) {
    head.box(0.04, 0.1, 0.04, '#f2efe6', -0.12, h + 0.26, 0.82, { rx: -0.4 }).box(0.04, 0.1, 0.04, '#f2efe6', 0.12, h + 0.26, 0.82, { rx: -0.4 })
  }
  c.body.add(head.build())
  for (const [x, z] of [[-0.16, 0.26], [0.16, 0.26], [-0.16, -0.26], [0.16, -0.26]] as const) {
    const leg = new THREE.Group()
    leg.position.set(x, h, z)
    leg.add(new Builder().box(0.12, h, 0.12, fur, 0, -h / 2, 0).box(0.13, 0.05, 0.15, belly, 0, -h + 0.025, 0.01).build({ castShadow: false }))
    c.body.add(leg)
    c.legs.push(leg)
  }
  c.group.scale.setScalar(spec.size)
  return c
}

function bat(): Creature {
  const c = creature('flyer', 1.15, 0.85)
  c.body.add(
    new Builder()
      .box(0.26, 0.24, 0.22, '#4a3d5c', 0, 0, 0)
      .box(0.22, 0.2, 0.2, '#5a4b6e', 0, 0.2, 0.02)
      .box(0.06, 0.12, 0.04, '#4a3d5c', -0.08, 0.34, 0.02)
      .box(0.06, 0.12, 0.04, '#4a3d5c', 0.08, 0.34, 0.02)
      .box(0.05, 0.05, 0.02, '#ff4b4b', -0.05, 0.22, 0.12, { glow: true })
      .box(0.05, 0.05, 0.02, '#ff4b4b', 0.05, 0.22, 0.12, { glow: true })
      .build(),
  )
  for (const side of [-1, 1]) {
    const wing = new THREE.Group()
    wing.position.set(side * 0.13, 0.05, 0)
    wing.add(
      new Builder()
        .box(0.36, 0.03, 0.26, '#3a2f4a', side * 0.18, 0, 0)
        .box(0.16, 0.03, 0.16, '#3a2f4a', side * 0.42, 0, -0.04)
        .build({ castShadow: false }),
    )
    c.body.add(wing)
    c.wings.push(wing)
  }
  c.body.position.y = c.hover
  return c
}

function blob(main: string, top: string, size: number): Creature {
  const c = creature('blob', 0.55 * size)
  c.body.add(
    new Builder()
      .box(0.62, 0.44, 0.62, main, 0, 0.22, 0)
      .box(0.46, 0.1, 0.46, top, 0, 0.49, 0)
      .box(0.07, 0.1, 0.02, '#222222', -0.12, 0.28, 0.315)
      .box(0.07, 0.1, 0.02, '#222222', 0.12, 0.28, 0.315)
      .box(0.08, 0.08, 0.02, '#ffffff', -0.2, 0.37, 0.315)
      .build(),
  )
  c.body.scale.setScalar(size)
  return c
}

function toad(): Creature {
  const c = creature('blob', 0.6)
  c.body.add(
    new Builder()
      .box(0.72, 0.36, 0.62, '#6f8f3a', 0, 0.2, 0)
      .box(0.6, 0.08, 0.5, '#c9d48a', 0, 0.03, 0.04)
      .box(0.16, 0.14, 0.16, '#6f8f3a', -0.2, 0.42, 0.18)
      .box(0.16, 0.14, 0.16, '#6f8f3a', 0.2, 0.42, 0.18)
      .box(0.08, 0.08, 0.02, '#f2d24a', -0.2, 0.44, 0.27, { glow: true })
      .box(0.08, 0.08, 0.02, '#f2d24a', 0.2, 0.44, 0.27, { glow: true })
      .box(0.44, 0.03, 0.02, '#3a4a1e', 0, 0.2, 0.315)
      .box(0.16, 0.1, 0.24, '#5d7a30', -0.36, 0.06, 0.2)
      .box(0.16, 0.1, 0.24, '#5d7a30', 0.36, 0.06, 0.2)
      .box(0.1, 0.06, 0.06, '#9c5ac9', 0.16, 0.36, -0.1)
      .build(),
  )
  return c
}

function spider(): Creature {
  const c = creature('spider', 0.6)
  c.body.add(
    new Builder()
      .box(0.5, 0.38, 0.52, '#3a2f38', 0, 0.36, -0.24)
      .box(0.14, 0.14, 0.02, '#c0392b', 0, 0.44, -0.5)
      .box(0.32, 0.24, 0.32, '#4a3d48', 0, 0.3, 0.16)
      .box(0.05, 0.05, 0.02, '#ff4b4b', -0.08, 0.36, 0.32, { glow: true })
      .box(0.05, 0.05, 0.02, '#ff4b4b', 0.08, 0.36, 0.32, { glow: true })
      .box(0.04, 0.04, 0.02, '#ff4b4b', -0.04, 0.3, 0.32, { glow: true })
      .box(0.04, 0.04, 0.02, '#ff4b4b', 0.04, 0.3, 0.32, { glow: true })
      .build(),
  )
  const legs = new THREE.Group()
  const leg = new Builder()
  for (const side of [-1, 1]) {
    for (const [z, spread] of [[0.26, 0.5], [0.12, 0.2], [-0.02, -0.15], [-0.16, -0.45]] as const) {
      leg.box(0.34, 0.05, 0.05, '#2e252c', side * 0.3, 0.38, z, { ry: side * spread, rz: side * -0.5 })
      leg.box(0.05, 0.34, 0.05, '#2e252c', side * 0.48, 0.17, z + side * 0, { rz: side * 0.25 })
    }
  }
  legs.add(leg.build({ castShadow: false }))
  c.body.add(legs)
  c.legs.push(legs)
  return c
}

function wraith(): Creature {
  const c = creature('ghost', 1.25, 0.2)
  c.body.add(
    new Builder()
      .box(0.46, 0.32, 0.42, '#3a2e52', 0, 0.62, 0)
      .box(0.4, 0.26, 0.36, '#33284a', 0, 0.36, -0.02)
      .box(0.32, 0.2, 0.28, '#2c2240', 0, 0.14, -0.04)
      .box(0.12, 0.12, 0.12, '#2c2240', -0.1, 0.0, -0.06)
      .box(0.44, 0.42, 0.42, '#2e2540', 0, 0.98, 0)
      .box(0.32, 0.26, 0.04, '#0e0a16', 0, 0.94, 0.2)
      .box(0.07, 0.05, 0.02, '#b48cff', -0.07, 0.97, 0.225, { glow: true })
      .box(0.07, 0.05, 0.02, '#b48cff', 0.07, 0.97, 0.225, { glow: true })
      .box(0.12, 0.3, 0.14, '#3a2e52', -0.3, 0.6, 0.06, { rz: 0.3 })
      .box(0.12, 0.3, 0.14, '#3a2e52', 0.3, 0.6, 0.06, { rz: -0.3 })
      .build(),
  )
  c.body.position.y = c.hover
  return c
}

export function idleActor(actor: Actor, time: number, phase: number) {
  if (actor.kind === 'humanoid') {
    idlePose(actor, time, phase)
    return
  }
  const wave = Math.sin(time * 2.4 + phase)
  actor.group.position.y = 0
  actor.group.rotation.set(0, 0, 0)
  actor.body.rotation.set(0, 0, 0)
  if (actor.kind === 'blob') {
    actor.body.scale.set(1 + wave * 0.05, 1 - wave * 0.07, 1 + wave * 0.05)
  } else if (actor.kind === 'flyer') {
    actor.body.position.y = actor.hover + Math.sin(time * 4 + phase) * 0.08
    for (const [index, wing] of actor.wings.entries()) {
      wing.rotation.z = (index === 0 ? 1 : -1) * Math.sin(time * 16 + phase) * 0.7
    }
  } else if (actor.kind === 'ghost') {
    actor.body.position.y = actor.hover + Math.sin(time * 2 + phase) * 0.06
  } else if (actor.kind === 'spider') {
    actor.body.position.y = Math.abs(wave) * 0.02
  } else {
    actor.body.position.y = wave * 0.012
    for (const leg of actor.legs) {
      leg.rotation.x = 0
    }
  }
}
