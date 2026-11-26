import * as THREE from 'three'
import { buildBody, idlePose, type BodySpec, type Rig } from './character'
import { Builder } from './kit'

// Monster models, one per monster id in src/data/monsters.json. Humanoid
// monsters reuse the hero body; animals and spirits have their own shapes.

export type Creature = {
  kind: 'beast' | 'flyer' | 'blob' | 'spider' | 'ghost' | 'golem' | 'wisp'
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
  bandit_thug: {
    outfit: { body: '#6a4a34', trim: '#3a2a22', pants: '#4a3830', weapon: 'mace', hat: 'hood' },
    skin: '#d4a07a',
    eye: '#2a1e18',
    hair: null,
    scale: 1.05,
  },
  crossbowman: {
    outfit: { body: '#5a5450', trim: '#8a3a34', pants: '#3e3a38', weapon: 'bow', quiver: true },
    skin: '#ecc39b',
    eye: '#2a2522',
    hair: '#3a3028',
    style: 'short',
    scale: 1,
  },
  cutthroat: {
    outfit: { body: '#3a2a2e', trim: '#7a2e2e', pants: '#2a2224', weapon: 'dagger', scarf: true, hat: 'hood' },
    skin: '#c99470',
    eye: '#1a1210',
    hair: null,
    scale: 0.95,
  },
  bandit_chief: {
    outfit: { body: '#5a2e2e', trim: '#c9a43a', pants: '#3a2828', weapon: 'pick', pads: true, robe: true },
    skin: '#d4a07a',
    eye: '#2a1e18',
    hair: '#2a2220',
    style: 'long',
    beard: true,
    scale: 1.45,
  },
  grave_knight: {
    outfit: { body: '#5a6a62', trim: '#3a4a42', pants: '#4a544c', weapon: 'rusty', pads: true, hat: 'helmet' },
    skin: '#c8c4b4',
    eye: '#7dff9a',
    eyeGlow: true,
    eyeSize: 1.3,
    hair: null,
    shoe: '#3a4440',
    scale: 1.12,
  },
  bone_archer: {
    outfit: { body: BONE, trim: '#8aa39a', pants: BONE, weapon: 'bow', quiver: true },
    skin: BONE,
    eye: '#7fe3ff',
    eyeGlow: true,
    eyeSize: 1.4,
    hair: null,
    ribs: true,
    shoe: '#cfc8b4',
    scale: 1,
  },
  citadel_lord: {
    outfit: { body: '#2a2438', trim: '#7a5ab8', pants: '#1e1a28', weapon: 'sword', pads: true, robe: true, hat: 'helmet' },
    skin: '#9aa3b0',
    eye: '#c79bff',
    eyeGlow: true,
    eyeSize: 1.5,
    hair: null,
    shoe: '#1a1620',
    scale: 1.55,
  },
  kobold_mystic: {
    outfit: { body: '#6a8a3a', trim: '#d9b54a', pants: '#4a6a2e', weapon: 'staff', robe: true, hat: 'wizard' },
    skin: '#8ab84a',
    eye: '#ff8a3d',
    eyeGlow: true,
    hair: '#3a5020',
    style: 'spiky',
    scale: 0.78,
  },
  // Sunken crypt backliner: hood, staff, sickly green glow (Docs/identity.md 5a).
  necromancer: {
    outfit: { body: '#2a2438', trim: '#3a8a4a', pants: '#1a1624', weapon: 'staff', robe: true, hat: 'hood' },
    skin: '#c8c4b4',
    eye: '#7dff9a',
    eyeGlow: true,
    eyeSize: 1.35,
    hair: null,
    style: 'bald',
    stoop: 0.08,
    scale: 1.05,
  },
}

export function buildEnemy(refId: string): Actor {
  const humanoid = HUMANOIDS[refId]
  if (humanoid) {
    const rig = buildBody({ head: 1, stoop: 0, style: 'short', beard: false, ...humanoid })
    if (refId === 'cutthroat') {
      addOffhandDagger(rig)
    }
    if (refId === 'grave_knight') {
      addShield(rig)
    }
    if (refId === 'citadel_lord') {
      addHorns(rig)
    }
    if (refId === 'necromancer') {
      addNecromancerGlow(rig)
    }
    return rig
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
    case 'venom_toad':
      return venomToad()
    case 'bog_leech':
      return bogLeech()
    case 'moss_golem':
      return mossGolem()
    case 'wisp':
      return wisp()
    case 'bog_queen':
      return bogQueen()
    case 'specter':
      return specter()
    case 'drake':
      return drake()
    case 'wyvern':
      return wyvern()
    case 'elder_dragon':
      return elderDragon()
    default:
      return blob('#c96b6b', '#d98f8f', 1)
  }
}

function addOffhandDagger(rig: Rig) {
  const dagger = new Builder()
    .box(0.045, 0.1, 0.045, '#3a2a20', 0, -0.27, 0.03)
    .box(0.13, 0.035, 0.05, '#8a3434', 0, -0.21, 0.03)
    .box(0.05, 0.22, 0.03, '#cfd5dc', 0, -0.09, 0.03)
  rig.armL.add(dagger.build({ castShadow: false }))
}

function addShield(rig: Rig) {
  const shield = new Builder()
    .box(0.08, 0.42, 0.32, '#5a6a62', -0.18, -0.12, 0.05)
    .box(0.05, 0.34, 0.24, '#3a4a42', -0.22, -0.12, 0.05)
    .box(0.04, 0.1, 0.1, '#7dff9a', -0.24, -0.08, 0.05, { glow: true })
  rig.armL.add(shield.build({ castShadow: false }))
}

function addHorns(rig: Rig) {
  const horns = new Builder()
    .box(0.1, 0.28, 0.1, '#1a1620', -0.18, 0.62, -0.05, { rz: 0.35 })
    .box(0.1, 0.28, 0.1, '#1a1620', 0.18, 0.62, -0.05, { rz: -0.35 })
    .box(0.08, 0.12, 0.08, '#7a5ab8', -0.22, 0.78, -0.08, { rz: 0.45 })
    .box(0.08, 0.12, 0.08, '#7a5ab8', 0.22, 0.78, -0.08, { rz: -0.45 })
    .box(0.5, 0.08, 0.28, '#1a1620', 0, 0.12, -0.18)
  rig.head.add(horns.build({ castShadow: false }))
}

function addNecromancerGlow(rig: Rig) {
  const tip = new Builder()
    .box(0.16, 0.16, 0.16, '#7dff9a', 0, 0.58, 0.05, { glow: true })
    .box(0.08, 0.08, 0.08, '#b8f5c8', 0, 0.7, 0.05, { glow: true })
  rig.armR.add(tip.build({ castShadow: false }))
  const aura = new Builder()
    .box(0.42, 0.08, 0.3, '#3a8a4a', 0, 0.08, 0.1, { glow: true })
    .box(0.12, 0.2, 0.08, '#2a5a38', -0.22, 0.35, -0.08)
    .box(0.12, 0.2, 0.08, '#2a5a38', 0.22, 0.35, -0.08)
  rig.head.add(aura.build({ castShadow: false }))
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

function venomToad(): Creature {
  const c = creature('blob', 0.7)
  c.body.add(
    new Builder()
      .box(0.86, 0.4, 0.7, '#4e6234', 0, 0.22, 0)
      .box(0.7, 0.08, 0.56, '#6a4a78', 0, 0.04, 0.04)
      .box(0.18, 0.16, 0.16, '#3f5228', -0.24, 0.46, 0.2)
      .box(0.18, 0.16, 0.16, '#3f5228', 0.24, 0.46, 0.2)
      .box(0.09, 0.09, 0.02, '#d2e06a', -0.24, 0.48, 0.29, { glow: true })
      .box(0.09, 0.09, 0.02, '#d2e06a', 0.24, 0.48, 0.29, { glow: true })
      .box(0.1, 0.08, 0.08, '#7a4a9a', -0.18, 0.4, -0.16)
      .box(0.12, 0.1, 0.1, '#6b3d82', 0.2, 0.34, 0.05)
      .box(0.08, 0.08, 0.08, '#5a6a32', 0.02, 0.42, -0.22)
      .box(0.5, 0.03, 0.02, '#2a3818', 0, 0.22, 0.36)
      .box(0.18, 0.1, 0.28, '#3d4e28', -0.42, 0.08, 0.22)
      .box(0.18, 0.1, 0.28, '#3d4e28', 0.42, 0.08, 0.22)
      .build(),
  )
  return c
}

function bogLeech(): Creature {
  const c = creature('blob', 0.42)
  const body = new Builder()
  const segments: Array<[number, number, string]> = [
    [0.34, 0.34, '#5a3d55'],
    [0.3, 0.22, '#6a4458'],
    [0.26, 0.1, '#4e3848'],
    [0.22, -0.02, '#6e4a3a'],
    [0.18, -0.16, '#5a4038'],
  ]
  for (const [width, z, color] of segments) {
    body.box(width, width * 0.7, 0.16, color, 0, 0.16, z)
  }
  body
    .box(0.16, 0.12, 0.12, '#3a2834', 0, 0.16, 0.48)
    .box(0.08, 0.04, 0.02, '#e07a8a', 0, 0.16, 0.55, { glow: true })
    .box(0.04, 0.1, 0.04, '#2a1c22', -0.08, 0.22, 0.2)
    .box(0.04, 0.1, 0.04, '#2a1c22', 0.08, 0.22, 0.05)
  c.body.add(body.build())
  return c
}

function mossGolem(): Creature {
  const c = creature('golem', 1.7)
  c.body.add(
    new Builder()
      .box(0.85, 0.7, 0.55, '#6d7564', 0, 0.7, 0)
      .box(0.55, 0.18, 0.4, '#4f8a3c', 0, 1.08, 0.04)
      .box(0.5, 0.48, 0.48, '#7a8270', 0, 1.28, 0)
      .box(0.22, 0.16, 0.16, '#3d7a34', -0.12, 1.42, 0.16)
      .box(0.16, 0.12, 0.12, '#3d7a34', 0.16, 1.2, 0.18)
      .box(0.1, 0.08, 0.02, '#d6e07a', -0.12, 1.32, 0.25, { glow: true })
      .box(0.1, 0.08, 0.02, '#d6e07a', 0.12, 1.32, 0.25, { glow: true })
      .box(0.28, 0.55, 0.28, '#5e6758', -0.55, 0.72, 0)
      .box(0.28, 0.55, 0.28, '#5e6758', 0.55, 0.72, 0)
      .box(0.32, 0.4, 0.32, '#656d5c', -0.22, 0.28, 0.06)
      .box(0.32, 0.4, 0.32, '#656d5c', 0.22, 0.28, 0.06)
      .box(0.4, 0.12, 0.3, '#2f6a32', 0.1, 0.55, 0.22)
      .build(),
  )
  return c
}

function wisp(): Creature {
  const c = creature('wisp', 0.7, 0.85)
  c.body.add(
    new Builder()
      .box(0.28, 0.28, 0.28, '#e7f6a4', 0, 0, 0, { glow: true })
      .box(0.16, 0.16, 0.16, '#fff8c8', 0, 0.02, 0.04, { glow: true })
      .box(0.1, 0.16, 0.1, '#b48cff', -0.16, 0.1, 0, { glow: true })
      .box(0.1, 0.14, 0.1, '#9fd48a', 0.16, -0.06, 0.02, { glow: true })
      .box(0.08, 0.1, 0.08, '#d7c4ff', 0.04, 0.2, -0.06, { glow: true })
      .build(),
  )
  c.body.position.y = c.hover
  return c
}

function bogQueen(): Creature {
  const c = creature('blob', 1.7)
  c.body.add(
    new Builder()
      .box(1.15, 0.55, 0.95, '#3f5a30', 0, 0.32, 0)
      .box(0.9, 0.1, 0.72, '#6a3f78', 0, 0.06, 0.06)
      .box(0.26, 0.22, 0.22, '#314824', -0.32, 0.68, 0.28)
      .box(0.26, 0.22, 0.22, '#314824', 0.32, 0.68, 0.28)
      .box(0.12, 0.12, 0.02, '#f0e06a', -0.32, 0.72, 0.4, { glow: true })
      .box(0.12, 0.12, 0.02, '#f0e06a', 0.32, 0.72, 0.4, { glow: true })
      .box(0.7, 0.04, 0.02, '#24180e', 0, 0.32, 0.48)
      .box(0.08, 0.28, 0.08, '#2f6a32', -0.22, 0.95, 0.05, { rz: 0.4 })
      .box(0.08, 0.32, 0.08, '#3d7a38', 0, 1.05, 0, { rz: -0.15 })
      .box(0.08, 0.26, 0.08, '#2a5a2c', 0.24, 0.92, 0.02, { rz: -0.45 })
      .box(0.12, 0.12, 0.12, '#c9a6ff', 0.02, 1.18, 0.04, { glow: true })
      .box(0.22, 0.12, 0.28, '#345028', -0.58, 0.1, 0.3)
      .box(0.22, 0.12, 0.28, '#345028', 0.58, 0.1, 0.3)
      .build(),
  )
  c.group.scale.setScalar(1.35)
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

// A cyan, more wispy spirit than the purple crypt wraith.
function specter(): Creature {
  const c = creature('ghost', 1.35, 0.35)
  c.body.add(
    new Builder()
      .box(0.38, 0.55, 0.34, '#5a8a9a', 0, 0.55, 0)
      .box(0.28, 0.4, 0.24, '#7fe3ff', 0, 0.35, 0.02, { glow: true })
      .box(0.22, 0.28, 0.18, '#3a6070', 0, 0.12, -0.04)
      .box(0.14, 0.2, 0.12, '#2a4858', -0.08, -0.05, -0.06)
      .box(0.14, 0.18, 0.12, '#2a4858', 0.1, -0.08, -0.04)
      .box(0.4, 0.38, 0.38, '#6aa0b0', 0, 1.05, 0)
      .box(0.08, 0.08, 0.02, '#9fe8ff', -0.08, 1.05, 0.2, { glow: true })
      .box(0.08, 0.08, 0.02, '#9fe8ff', 0.08, 1.05, 0.2, { glow: true })
      .box(0.1, 0.4, 0.12, '#4a7888', -0.28, 0.55, 0.04, { rz: 0.45 })
      .box(0.1, 0.4, 0.12, '#4a7888', 0.28, 0.55, 0.04, { rz: -0.45 })
      .box(0.16, 0.16, 0.16, '#b48cff', 0, 1.28, -0.05, { glow: true })
      .build(),
  )
  c.body.position.y = c.hover
  return c
}

function drake(): Creature {
  const c = creature('beast', 1.05)
  c.body.add(
    new Builder()
      .box(0.55, 0.38, 0.85, '#c45a2e', 0, 0.42, 0)
      .box(0.42, 0.12, 0.65, '#e08a40', 0, 0.22, 0.05)
      .box(0.18, 0.16, 0.4, '#a84828', 0, 0.48, -0.55, { rx: 0.4 })
      .box(0.08, 0.08, 0.08, '#ffcf5a', 0, 0.58, -0.72, { glow: true })
      .box(0.42, 0.36, 0.42, '#d46834', 0, 0.58, 0.55)
      .box(0.28, 0.18, 0.28, '#e08a40', 0, 0.48, 0.78)
      .box(0.07, 0.07, 0.02, '#ffe27a', -0.1, 0.64, 0.76, { glow: true })
      .box(0.07, 0.07, 0.02, '#ffe27a', 0.1, 0.64, 0.76, { glow: true })
      .box(0.06, 0.16, 0.06, '#8a3a20', -0.12, 0.8, 0.48, { rz: 0.3 })
      .box(0.06, 0.16, 0.06, '#8a3a20', 0.12, 0.8, 0.48, { rz: -0.3 })
      .box(0.04, 0.1, 0.04, '#f2efe6', -0.1, 0.42, 0.92, { rx: -0.5 })
      .box(0.04, 0.1, 0.04, '#f2efe6', 0.1, 0.42, 0.92, { rx: -0.5 })
      .build(),
  )
  for (const [x, z] of [[-0.18, 0.28], [0.18, 0.28], [-0.18, -0.28], [0.18, -0.28]] as const) {
    const leg = new THREE.Group()
    leg.position.set(x, 0.28, z)
    leg.add(new Builder().box(0.14, 0.28, 0.14, '#a84828', 0, -0.14, 0).box(0.15, 0.06, 0.18, '#e08a40', 0, -0.26, 0.02).build({ castShadow: false }))
    c.body.add(leg)
    c.legs.push(leg)
  }
  return c
}

function wyvern(): Creature {
  const c = creature('flyer', 1.35, 0.9)
  c.body.add(
    new Builder()
      .box(0.38, 0.32, 0.7, '#c0392b', 0, 0.1, 0)
      .box(0.28, 0.1, 0.5, '#e0673a', 0, -0.05, 0.05)
      .box(0.12, 0.12, 0.35, '#a82e22', 0, 0.15, -0.45, { rx: 0.35 })
      .box(0.34, 0.3, 0.34, '#d44a32', 0, 0.28, 0.42)
      .box(0.2, 0.14, 0.22, '#e0673a', 0, 0.2, 0.62)
      .box(0.06, 0.06, 0.02, '#ffe27a', -0.08, 0.34, 0.58, { glow: true })
      .box(0.06, 0.06, 0.02, '#ffe27a', 0.08, 0.34, 0.58, { glow: true })
      .box(0.05, 0.14, 0.05, '#8a2818', -0.1, 0.48, 0.36, { rz: 0.35 })
      .box(0.05, 0.14, 0.05, '#8a2818', 0.1, 0.48, 0.36, { rz: -0.35 })
      .build(),
  )
  for (const side of [-1, 1]) {
    const wing = new THREE.Group()
    wing.position.set(side * 0.18, 0.12, 0)
    wing.add(
      new Builder()
        .box(0.55, 0.04, 0.35, '#a82e22', side * 0.28, 0, 0)
        .box(0.28, 0.04, 0.22, '#c0392b', side * 0.58, 0.02, -0.05)
        .box(0.08, 0.04, 0.4, '#ff8a3d', side * 0.2, 0.02, 0.05, { glow: true })
        .build({ castShadow: false }),
    )
    c.body.add(wing)
    c.wings.push(wing)
  }
  c.body.position.y = c.hover
  return c
}

function elderDragon(): Creature {
  const c = creature('beast', 2.4)
  c.body.add(
    new Builder()
      .box(0.9, 0.7, 1.4, '#a82818', 0, 0.85, 0)
      .box(0.7, 0.2, 1.1, '#d44828', 0, 0.48, 0.05)
      .box(0.28, 0.28, 0.7, '#8a1e12', 0, 0.95, -0.85, { rx: 0.35 })
      .box(0.14, 0.14, 0.14, '#ffcf5a', 0, 1.1, -1.15, { glow: true })
      .box(0.7, 0.6, 0.7, '#c0392b', 0, 1.15, 0.85)
      .box(0.45, 0.32, 0.5, '#e05830', 0, 0.95, 1.25)
      .box(0.12, 0.12, 0.03, '#ffe27a', -0.18, 1.28, 1.18, { glow: true })
      .box(0.12, 0.12, 0.03, '#ffe27a', 0.18, 1.28, 1.18, { glow: true })
      .box(0.12, 0.4, 0.12, '#5a1810', -0.22, 1.55, 0.7, { rz: 0.35 })
      .box(0.12, 0.4, 0.12, '#5a1810', 0.22, 1.55, 0.7, { rz: -0.35 })
      .box(0.1, 0.18, 0.1, '#d9b54a', -0.28, 1.78, 0.62, { rz: 0.45 })
      .box(0.1, 0.18, 0.1, '#d9b54a', 0.28, 1.78, 0.62, { rz: -0.45 })
      .box(0.08, 0.2, 0.08, '#f2efe6', -0.16, 0.85, 1.48, { rx: -0.45 })
      .box(0.08, 0.2, 0.08, '#f2efe6', 0.16, 0.85, 1.48, { rx: -0.45 })
      .box(0.55, 0.08, 0.9, '#ff8a3d', 0, 1.25, 0.1, { glow: true })
      .build(),
  )
  for (const [x, z] of [[-0.32, 0.4], [0.32, 0.4], [-0.32, -0.4], [0.32, -0.4]] as const) {
    const leg = new THREE.Group()
    leg.position.set(x, 0.5, z)
    leg.add(new Builder().box(0.22, 0.5, 0.22, '#8a1e12', 0, -0.25, 0).box(0.24, 0.1, 0.28, '#c0392b', 0, -0.48, 0.04).build({ castShadow: false }))
    c.body.add(leg)
    c.legs.push(leg)
  }
  for (const side of [-1, 1]) {
    const wing = new THREE.Group()
    wing.position.set(side * 0.45, 1.1, -0.1)
    wing.add(
      new Builder()
        .box(0.7, 0.06, 0.5, '#8a1e12', side * 0.35, 0, 0)
        .box(0.4, 0.06, 0.35, '#a82818', side * 0.75, 0.04, -0.08)
        .build({ castShadow: false }),
    )
    c.body.add(wing)
    c.wings.push(wing)
  }
  c.group.scale.setScalar(1.35)
  c.height *= 1.35
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
  } else if (actor.kind === 'wisp') {
    actor.body.position.y = actor.hover + Math.sin(time * 3 + phase) * 0.12
    const pulse = 1 + Math.sin(time * 6 + phase) * 0.08
    actor.body.scale.setScalar(pulse)
  } else if (actor.kind === 'golem') {
    actor.body.rotation.z = wave * 0.03
  } else if (actor.kind === 'spider') {
    actor.body.position.y = Math.abs(wave) * 0.02
  } else {
    actor.body.position.y = wave * 0.012
    for (const leg of actor.legs) {
      leg.rotation.x = 0
    }
  }
}
