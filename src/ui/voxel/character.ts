import * as THREE from 'three'
import type { ClassId } from '../../core'
import { Builder } from './kit'
import { ageLook, hairColor, type HairStyle, type Look } from './look'

type Outfit = {
  body: string
  trim: string
  pants: string
  weapon: 'sword' | 'dagger' | 'bow' | 'staff' | 'mace' | 'lute' | 'fan'
  pads?: boolean
  scarf?: boolean
  quiver?: boolean
  robe?: boolean
  skirt?: boolean
  bareArms?: boolean
  hat?: 'wizard' | 'feather'
}

const OUTFITS: Record<ClassId, Outfit> = {
  warrior: { body: '#8e98a3', trim: '#c9a43a', pants: '#5a4636', weapon: 'sword', pads: true },
  rogue: { body: '#3f5b4b', trim: '#8a3434', pants: '#2e3732', weapon: 'dagger', scarf: true },
  archer: { body: '#5d8a3c', trim: '#8a6a3a', pants: '#6a5638', weapon: 'bow', quiver: true },
  mage: { body: '#3e4f9c', trim: '#d9b54a', pants: '#2f3b78', weapon: 'staff', robe: true, hat: 'wizard' },
  cleric: { body: '#eeeae0', trim: '#d2ad46', pants: '#d9d3c3', weapon: 'mace', robe: true },
  bard: { body: '#a9453b', trim: '#e0c26a', pants: '#4b3b5c', weapon: 'lute', hat: 'feather' },
  dancer: { body: '#8c4fa3', trim: '#f0c75e', pants: '#c76cb6', weapon: 'fan', skirt: true, bareArms: true },
}

export type Rig = {
  group: THREE.Group
  legL: THREE.Group
  legR: THREE.Group
  torso: THREE.Group
  armL: THREE.Group
  armR: THREE.Group
  head: THREE.Group
  height: number
}

// Each moving part is one merged mesh. Only the torso and head cast shadows,
// which keeps the shadow pass cheap with many residents.
export function buildCharacter(look: Look): Rig {
  const outfit = OUTFITS[look.classId]
  const age = ageLook(look.age)
  const skin = look.skin
  const hair = hairColor(look)
  const group = new THREE.Group()

  const legL = new THREE.Group()
  const legR = new THREE.Group()
  legL.position.set(-0.095, 0.3, 0)
  legR.position.set(0.095, 0.3, 0)
  for (const leg of [legL, legR]) {
    leg.add(
      new Builder()
        .box(0.15, 0.26, 0.17, outfit.pants, 0, -0.12, 0)
        .box(0.16, 0.07, 0.21, '#4a3628', 0, -0.265, 0.02)
        .build({ castShadow: false }),
    )
  }
  group.add(legL, legR)

  const lower = new Builder()
  if (outfit.robe) {
    lower.box(0.42, 0.26, 0.28, outfit.body, 0, 0.17, 0).box(0.43, 0.04, 0.29, outfit.trim, 0, 0.05, 0)
  }
  if (outfit.skirt) {
    lower.box(0.46, 0.15, 0.32, outfit.pants, 0, 0.27, 0)
  }
  if (!lower.empty) {
    group.add(lower.build({ castShadow: false }))
  }

  const torso = new THREE.Group()
  torso.position.y = 0.3
  group.add(torso)
  const body = new Builder()
  if (outfit.bareArms) {
    body.box(0.36, 0.13, 0.22, skin, 0, 0.065, 0).box(0.38, 0.2, 0.24, outfit.body, 0, 0.22, 0)
  } else {
    body.box(0.38, 0.32, 0.24, outfit.body, 0, 0.16, 0).box(0.39, 0.05, 0.25, outfit.trim, 0, 0.03, 0)
  }
  if (outfit.scarf) {
    body.box(0.42, 0.07, 0.28, outfit.trim, 0, 0.31, 0)
  }
  if (outfit.quiver) {
    body.box(0.12, 0.34, 0.1, '#7a5236', 0.08, 0.22, -0.17, { rz: 0.3 }).box(0.1, 0.06, 0.08, '#f2efe6', 0.13, 0.4, -0.17, { rz: 0.3 })
  }
  torso.add(body.build())

  const armL = new THREE.Group()
  const armR = new THREE.Group()
  armL.position.set(-0.245, 0.28, 0)
  armR.position.set(0.245, 0.28, 0)
  for (const arm of [armL, armR]) {
    const parts = new Builder()
      .box(0.11, 0.22, 0.13, outfit.bareArms ? skin : outfit.body, 0, -0.1, 0)
      .box(0.1, 0.08, 0.11, skin, 0, -0.25, 0)
    if (outfit.pads) {
      parts.box(0.16, 0.08, 0.19, '#b8c0c8', 0, 0.02, 0)
    }
    if (arm === armR) {
      drawWeapon(parts, outfit.weapon)
    }
    arm.add(parts.build({ castShadow: false }))
  }
  torso.add(armL, armR)

  const head = new THREE.Group()
  head.position.y = 0.32
  head.scale.setScalar(age.head)
  torso.add(head)
  const face = new Builder()
    .box(0.44, 0.42, 0.42, skin, 0, 0.21, 0)
    .box(0.065, 0.09, 0.02, look.eye, -0.1, 0.19, 0.215)
    .box(0.065, 0.09, 0.02, look.eye, 0.1, 0.19, 0.215)
    .box(0.07, 0.03, 0.01, '#f2a5a0', -0.16, 0.12, 0.213)
    .box(0.07, 0.03, 0.01, '#f2a5a0', 0.16, 0.12, 0.213)
  if (outfit.hat !== 'wizard') {
    drawHair(face, look.style, hair)
  }
  if (look.gender === 'male' && look.beard && look.age >= 25) {
    face.box(0.36, 0.13, 0.06, hair, 0, 0.06, 0.225).box(0.2, 0.04, 0.03, hair, 0, 0.115, 0.235)
  }
  if (outfit.hat === 'wizard') {
    face
      .box(0.48, 0.1, 0.46, hair, 0, 0.4, -0.02)
      .box(0.64, 0.05, 0.62, '#2e3a7a', 0, 0.45, 0)
      .box(0.42, 0.14, 0.42, '#2e3a7a', 0, 0.54, -0.02)
      .box(0.28, 0.14, 0.28, '#2e3a7a', 0.02, 0.67, -0.05, { rz: -0.08 })
      .box(0.14, 0.16, 0.14, '#2e3a7a', 0.06, 0.8, -0.08, { rz: -0.2 })
      .box(0.43, 0.04, 0.43, '#d9b54a', 0, 0.49, -0.02)
  } else if (outfit.hat === 'feather') {
    face
      .box(0.58, 0.05, 0.56, '#7a3a2a', 0, 0.47, 0)
      .box(0.42, 0.12, 0.42, '#7a3a2a', 0, 0.54, 0)
      .box(0.03, 0.26, 0.07, '#f4f1e8', 0.17, 0.66, -0.06, { rz: -0.4 })
  }
  head.add(face.build())

  group.scale.setScalar(age.scale * look.height)
  torso.rotation.x = age.stoop
  head.rotation.x = -age.stoop * 0.5
  const hatTop = outfit.hat === 'wizard' ? 0.25 : 0
  return { group, legL, legR, torso, armL, armR, head, height: (0.62 + 0.5 * age.head + hatTop) * group.scale.y }
}

function drawHair(b: Builder, style: HairStyle, color: string) {
  if (style === 'bald') {
    b.box(0.05, 0.16, 0.3, color, -0.235, 0.2, -0.04).box(0.05, 0.16, 0.3, color, 0.235, 0.2, -0.04).box(0.46, 0.16, 0.05, color, 0, 0.2, -0.22)
    return
  }
  b.box(0.48, 0.1, 0.46, color, 0, 0.45, -0.01).box(0.48, 0.07, 0.06, color, 0, 0.37, 0.21)
  if (style === 'short' || style === 'spiky' || style === 'ponytail') {
    b.box(0.48, 0.3, 0.07, color, 0, 0.27, -0.215).box(0.05, 0.2, 0.4, color, -0.24, 0.31, -0.01).box(0.05, 0.2, 0.4, color, 0.24, 0.31, -0.01)
  }
  if (style === 'spiky') {
    b.box(0.12, 0.14, 0.12, color, -0.13, 0.54, 0.06, { rz: 0.3 })
      .box(0.12, 0.17, 0.12, color, 0.02, 0.56, -0.02, { rz: -0.1 })
      .box(0.12, 0.13, 0.12, color, 0.15, 0.53, 0.05, { rz: -0.35 })
  }
  if (style === 'ponytail') {
    b.box(0.12, 0.34, 0.12, color, 0, 0.2, -0.3).box(0.14, 0.05, 0.14, '#c0392b', 0, 0.37, -0.29)
  }
  if (style === 'long') {
    b.box(0.5, 0.58, 0.08, color, 0, 0.15, -0.225).box(0.06, 0.46, 0.36, color, -0.245, 0.2, -0.02).box(0.06, 0.46, 0.36, color, 0.245, 0.2, -0.02)
  }
  if (style === 'bob') {
    b.box(0.5, 0.34, 0.08, color, 0, 0.26, -0.225)
      .box(0.07, 0.34, 0.42, color, -0.25, 0.26, 0)
      .box(0.07, 0.34, 0.42, color, 0.25, 0.26, 0)
      .box(0.48, 0.1, 0.06, color, 0, 0.35, 0.215)
  }
}

// Weapons hang from the right hand (arm-local y = -0.27).
function drawWeapon(b: Builder, weapon: Outfit['weapon']) {
  const forward = Math.PI / 2
  if (weapon === 'sword') {
    b.within(0, -0.27, 0.03, forward, 0, 0, () => {
      b.box(0.05, 0.12, 0.05, '#5a3d28').box(0.2, 0.04, 0.06, '#c9a43a', 0, 0.07, 0).box(0.07, 0.46, 0.035, '#dfe4ea', 0, 0.32, 0)
    })
  } else if (weapon === 'dagger') {
    b.within(0, -0.27, 0.03, forward, 0, 0, () => {
      b.box(0.045, 0.1, 0.045, '#3a2a20').box(0.13, 0.035, 0.05, '#8a3434', 0, 0.06, 0).box(0.05, 0.22, 0.03, '#cfd5dc', 0, 0.18, 0)
    })
  } else if (weapon === 'mace') {
    b.within(0, -0.27, 0.03, forward, 0, 0, () => {
      b.box(0.045, 0.32, 0.045, '#6b4a30', 0, 0.1, 0).box(0.15, 0.15, 0.15, '#c9a43a', 0, 0.3, 0)
    })
  } else if (weapon === 'staff') {
    b.within(0, -0.27, 0.05, 0, 0, 0, () => {
      b.box(0.05, 1.0, 0.05, '#7a5236', 0, 0.28, 0).box(0.18, 0.05, 0.05, '#7a5236', 0, 0.76, 0).box(0.13, 0.13, 0.13, '#7fe3ff', 0, 0.86, 0, { glow: true })
    })
  } else if (weapon === 'bow') {
    b.within(0, -0.27, 0.09, 0, 0, 0, () => {
      b.box(0.05, 0.2, 0.05, '#7a5236')
        .box(0.05, 0.26, 0.05, '#7a5236', 0, 0.21, -0.04, { rx: 0.3 })
        .box(0.05, 0.26, 0.05, '#7a5236', 0, -0.21, -0.04, { rx: -0.3 })
        .box(0.012, 0.64, 0.012, '#f2efe6', 0, 0, -0.09)
    })
  } else if (weapon === 'lute') {
    b.within(0, -0.27, 0.03, 1.1, 0, 0, () => {
      b.box(0.22, 0.26, 0.08, '#b07a3c', 0, 0.06, 0).box(0.07, 0.07, 0.01, '#3a2616', 0, 0.07, 0.045).box(0.05, 0.3, 0.04, '#7a5236', 0, 0.34, 0)
    })
  } else {
    b.within(0, -0.27, 0.03, forward, 0, 0, () => {
      b.box(0.03, 0.12, 0.03, '#6b4a30', 0, 0.03, 0).box(0.3, 0.2, 0.025, '#f39bc2', 0, 0.18, 0).box(0.2, 0.06, 0.03, '#f0c75e', 0, 0.29, 0)
    })
  }
}

export function idlePose(rig: Rig, time: number, phase: number) {
  const breath = Math.sin(time * 2.4 + phase)
  rig.group.position.y = 0
  rig.group.rotation.set(0, 0, 0)
  rig.torso.scale.y = 1 + breath * 0.02
  rig.armL.rotation.set(0, 0, -0.06 - breath * 0.03)
  rig.armR.rotation.set(0, 0, 0.06 + breath * 0.03)
  rig.legL.rotation.x = 0
  rig.legR.rotation.x = 0
}

export function walkPose(rig: Rig, time: number, phase: number, speed: number) {
  const k = time * 9 * speed + phase
  const swing = Math.sin(k)
  rig.group.position.y = Math.abs(Math.cos(k)) * 0.035
  rig.group.rotation.set(0, 0, 0)
  rig.torso.scale.y = 1
  rig.legL.rotation.x = swing * 0.6
  rig.legR.rotation.x = -swing * 0.6
  rig.armL.rotation.set(-swing * 0.5, 0, -0.06)
  rig.armR.rotation.set(swing * 0.5, 0, 0.06)
}
