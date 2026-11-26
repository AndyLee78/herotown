import * as THREE from 'three'
import type { ClassId, WeaponType } from '../../core/types'
import { Builder } from './kit'
import {
  ageLook,
  hairColor,
  SET_GLOW,
  type GearAura,
  type GearStyle,
  type HairStyle,
  type Look,
  type UniqueArmorId,
  type UniqueWeaponId,
} from './look'

export type { GearAura, GearStyle }

const AURA_TRIM: Record<Exclude<GearAura, null>, string> = {
  epic: '#9b6bff',
  legend: '#d9b54a',
}
const AURA_BLADE: Record<Exclude<GearAura, null>, string> = {
  epic: '#c79bff',
  legend: '#ffe27a',
}

export type Weapon =
  | 'sword'
  | 'axe'
  | 'shieldsword'
  | 'dagger'
  | 'bow'
  | 'crossbow'
  | 'staff'
  | 'tome'
  | 'scepter'
  | 'mace'
  | 'lute'
  | 'drum'
  | 'fan'
  | 'rusty'
  | 'pick'
  | 'none'
export type Headwear = 'wizard' | 'feather' | 'helmet' | 'hood' | 'crown'

export type Outfit = {
  body: string
  trim: string
  pants: string
  weapon: Weapon
  pads?: boolean
  scarf?: boolean
  quiver?: boolean
  robe?: boolean
  skirt?: boolean
  bareArms?: boolean
  hat?: Headwear
  // Extra plate thickness when the worn armour is plate.
  plate?: boolean
  leather?: boolean
  uniqueWeapon?: UniqueWeaponId
  uniqueArmor?: UniqueArmorId
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

// Everything needed to build a box person. Heroes fill it from their look;
// humanoid monsters fill it directly.
export type BodySpec = {
  outfit: Outfit
  skin: string
  eye: string
  eyeGlow?: boolean
  eyeSize?: number
  blush?: boolean
  hair: string | null
  style: HairStyle
  beard: boolean
  ribs?: boolean
  scale: number
  head: number
  stoop: number
  shoe?: string
  aura?: GearAura
  setGlow?: string
}

export type Rig = {
  kind: 'humanoid'
  group: THREE.Group
  legL: THREE.Group
  legR: THREE.Group
  torso: THREE.Group
  armL: THREE.Group
  armR: THREE.Group
  head: THREE.Group
  height: number
}

export function outfitFor(classId: ClassId): Outfit {
  return OUTFITS[classId]
}

export function buildCharacter(look: Look, style: GearAura | GearStyle | null = null): Rig {
  const age = ageLook(look.age)
  const gear = asGearStyle(style)
  const outfit = dressOutfit(OUTFITS[look.classId], gear)
  const rig = buildBody({
    outfit,
    skin: look.skin,
    eye: look.eye,
    blush: true,
    hair: hairColor(look),
    style: look.style,
    beard: look.gender === 'male' && look.beard && look.age >= 25,
    scale: age.scale * look.height,
    head: age.head,
    stoop: age.stoop,
    aura: gear.aura,
    setGlow: gear.setGlow ? SET_GLOW[gear.setGlow] : undefined,
  })
  return rig
}

function asGearStyle(style: GearAura | GearStyle | null): GearStyle {
  if (style === 'epic' || style === 'legend') {
    return { aura: style }
  }
  if (style && typeof style === 'object') {
    return {
      aura: style.aura ?? null,
      ...(style.weapon ? { weapon: style.weapon } : {}),
      ...(style.armor ? { armor: style.armor } : {}),
      ...(style.uniqueWeapon ? { uniqueWeapon: style.uniqueWeapon } : {}),
      ...(style.uniqueArmor ? { uniqueArmor: style.uniqueArmor } : {}),
      ...(style.setGlow ? { setGlow: style.setGlow } : {}),
    }
  }
  return { aura: null }
}

function dressOutfit(base: Outfit, gear: GearStyle): Outfit {
  let outfit: Outfit = { ...base }
  if (gear.aura) {
    outfit = { ...outfit, trim: AURA_TRIM[gear.aura] }
  }
  if (gear.weapon) {
    outfit = { ...outfit, weapon: weaponVisual(gear.weapon), quiver: gear.weapon === 'bow' || gear.weapon === 'crossbow' || outfit.quiver }
  }
  if (gear.uniqueWeapon) {
    outfit = {
      ...outfit,
      uniqueWeapon: gear.uniqueWeapon,
      weapon: uniqueWeaponBase(gear.uniqueWeapon),
      quiver: false,
    }
  }
  if (gear.armor === 'plate') {
    outfit = {
      ...outfit,
      body: '#8e98a3',
      pants: '#5a6270',
      trim: gear.aura ? outfit.trim : '#c9a43a',
      pads: true,
      plate: true,
      robe: false,
      skirt: false,
      bareArms: false,
      leather: false,
    }
  } else if (gear.armor === 'leather') {
    outfit = {
      ...outfit,
      body: '#6a4a34',
      pants: outfit.pants,
      trim: gear.aura ? outfit.trim : '#8a6a3a',
      leather: true,
      plate: false,
      robe: false,
      pads: outfit.pads && !outfit.robe,
      bareArms: false,
    }
  } else if (gear.armor === 'robe') {
    outfit = {
      ...outfit,
      body: outfit.body,
      robe: true,
      plate: false,
      leather: false,
      skirt: false,
      bareArms: false,
      pads: false,
    }
  }
  if (gear.uniqueArmor) {
    outfit = { ...outfit, ...uniqueArmorOutfit(gear.uniqueArmor, gear.aura) }
  }
  return outfit
}

function uniqueWeaponBase(id: UniqueWeaponId): Weapon {
  if (id === 'lichscepter') {
    return 'scepter'
  }
  if (id === 'twinfang') {
    return 'dagger'
  }
  return 'sword'
}

function uniqueArmorOutfit(id: UniqueArmorId, aura: GearAura): Partial<Outfit> {
  const trim = (color: string) => (aura ? {} : { trim: color })
  if (id === 'mossmantle') {
    return { body: '#4a6a3a', ...trim('#7dff9a'), pants: '#3a4a2e', robe: true, plate: false, leather: false, pads: false, bareArms: false, skirt: false, uniqueArmor: id }
  }
  if (id === 'citadelvestment') {
    return { body: '#2a2438', ...trim('#c79bff'), pants: '#1e1a28', robe: true, plate: false, leather: false, pads: false, bareArms: false, skirt: false, uniqueArmor: id }
  }
  if (id === 'wyrmscale') {
    return { body: '#8a2e1a', ...trim('#ff8a3d'), pants: '#5a1e12', plate: true, robe: false, leather: false, pads: true, bareArms: false, skirt: false, uniqueArmor: id }
  }
  return { body: '#2a2030', ...trim('#b48cff'), pants: '#1a1420', robe: true, plate: false, leather: false, pads: false, bareArms: false, skirt: false, uniqueArmor: id }
}

function weaponVisual(type: WeaponType): Weapon {
  return type
}

// Each moving part is one merged mesh. Only the torso and head cast shadows,
// which keeps the shadow pass cheap with many characters.
export function buildBody(spec: BodySpec): Rig {
  const { outfit, skin } = spec
  const group = new THREE.Group()

  const legL = new THREE.Group()
  const legR = new THREE.Group()
  legL.position.set(-0.095, 0.3, 0)
  legR.position.set(0.095, 0.3, 0)
  for (const leg of [legL, legR]) {
    leg.add(
      new Builder()
        .box(0.15, 0.26, 0.17, outfit.pants, 0, -0.12, 0)
        .box(0.16, 0.07, 0.21, spec.shoe ?? '#4a3628', 0, -0.265, 0.02)
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
  } else if (outfit.plate) {
    body.box(0.42, 0.34, 0.28, outfit.body, 0, 0.16, 0).box(0.44, 0.06, 0.3, outfit.trim, 0, 0.02, 0)
    body.box(0.18, 0.12, 0.22, '#b8c0c8', -0.2, 0.34, 0).box(0.18, 0.12, 0.22, '#b8c0c8', 0.2, 0.34, 0)
  } else if (outfit.leather) {
    body.box(0.38, 0.3, 0.24, '#4a3428', 0, 0.15, 0).box(0.4, 0.22, 0.26, outfit.body, 0, 0.2, 0.01)
    body.box(0.12, 0.28, 0.04, outfit.trim, -0.12, 0.18, 0.14).box(0.12, 0.28, 0.04, outfit.trim, 0.12, 0.18, 0.14)
  } else {
    body.box(0.38, 0.32, 0.24, outfit.body, 0, 0.16, 0).box(0.39, 0.05, 0.25, outfit.trim, 0, 0.03, 0)
  }
  if (spec.ribs) {
    for (const y of [0.12, 0.19, 0.26]) {
      body.box(0.3, 0.025, 0.01, '#8d8676', 0, y, 0.123)
    }
  }
  if (outfit.scarf) {
    body.box(0.42, 0.07, 0.28, outfit.trim, 0, 0.31, 0)
  }
  if (outfit.quiver) {
    body.box(0.12, 0.34, 0.1, '#7a5236', 0.08, 0.22, -0.17, { rz: 0.3 }).box(0.1, 0.06, 0.08, '#f2efe6', 0.13, 0.4, -0.17, { rz: 0.3 })
  }
  decorateUniqueArmor(body, outfit.uniqueArmor)
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
      const pad = outfit.plate ? 0.2 : 0.16
      const padColor = outfit.uniqueArmor === 'wyrmscale' ? '#ff8a3d' : outfit.trim === '#c9a43a' || outfit.plate ? '#b8c0c8' : outfit.trim
      parts.box(pad, outfit.plate ? 0.1 : 0.08, outfit.plate ? 0.22 : 0.19, padColor, 0, 0.02, 0)
    }
    if (arm === armR) {
      if (outfit.uniqueWeapon) {
        drawUniqueWeapon(parts, outfit.uniqueWeapon, spec.aura ?? null)
      } else {
        drawWeapon(parts, outfit.weapon, spec.aura ?? null)
      }
    }
    if (arm === armL && outfit.weapon === 'shieldsword' && !outfit.uniqueWeapon) {
      drawOffhandShield(parts, spec.aura ?? null)
    }
    if (arm === armL && outfit.uniqueWeapon === 'twinfang') {
      drawUniqueWeapon(parts, 'twinfang', spec.aura ?? null, true)
    }
    arm.add(parts.build({ castShadow: false }))
  }
  torso.add(armL, armR)
  const glowColor = spec.setGlow ?? (spec.aura ? AURA_BLADE[spec.aura] : null)
  if (glowColor) {
    const spark = new Builder()
      .box(0.1, 0.1, 0.1, glowColor, 0.16, 0.38, -0.12, { glow: true })
      .box(0.08, 0.08, 0.08, glowColor, -0.14, 0.48, -0.08, { glow: true })
      .box(0.06, 0.06, 0.06, glowColor, 0.02, 0.55, -0.16, { glow: true })
      .build({ castShadow: false, receiveShadow: false })
    spark.name = 'gearAura'
    torso.add(spark)
  }

  const head = new THREE.Group()
  head.position.y = 0.32
  head.scale.setScalar(spec.head)
  torso.add(head)
  const eyeSize = spec.eyeSize ?? 1
  const face = new Builder()
    .box(0.44, 0.42, 0.42, skin, 0, 0.21, 0)
    .box(0.065 * eyeSize, 0.09 * eyeSize, 0.02, spec.eye, -0.1, 0.19, 0.215, { glow: spec.eyeGlow })
    .box(0.065 * eyeSize, 0.09 * eyeSize, 0.02, spec.eye, 0.1, 0.19, 0.215, { glow: spec.eyeGlow })
  if (spec.blush) {
    face.box(0.07, 0.03, 0.01, '#f2a5a0', -0.16, 0.12, 0.213).box(0.07, 0.03, 0.01, '#f2a5a0', 0.16, 0.12, 0.213)
  }
  if (spec.hair && outfit.hat !== 'wizard' && outfit.hat !== 'hood') {
    drawHair(face, spec.style, spec.hair)
  }
  if (spec.beard && spec.hair) {
    face.box(0.36, 0.13, 0.06, spec.hair, 0, 0.06, 0.225).box(0.2, 0.04, 0.03, spec.hair, 0, 0.115, 0.235)
  }
  drawHeadwear(face, outfit.hat, spec.hair ?? outfit.body)
  head.add(face.build())

  group.scale.setScalar(spec.scale)
  torso.rotation.x = spec.stoop
  head.rotation.x = -spec.stoop * 0.5
  const hatTop = outfit.hat === 'wizard' ? 0.25 : outfit.hat === 'crown' ? 0.1 : 0
  return { kind: 'humanoid', group, legL, legR, torso, armL, armR, head, height: (0.62 + 0.5 * spec.head + hatTop) * spec.scale }
}

function drawHeadwear(b: Builder, hat: Headwear | undefined, hair: string) {
  if (hat === 'wizard') {
    b.box(0.48, 0.1, 0.46, hair, 0, 0.4, -0.02)
      .box(0.64, 0.05, 0.62, '#2e3a7a', 0, 0.45, 0)
      .box(0.42, 0.14, 0.42, '#2e3a7a', 0, 0.54, -0.02)
      .box(0.28, 0.14, 0.28, '#2e3a7a', 0.02, 0.67, -0.05, { rz: -0.08 })
      .box(0.14, 0.16, 0.14, '#2e3a7a', 0.06, 0.8, -0.08, { rz: -0.2 })
      .box(0.43, 0.04, 0.43, '#d9b54a', 0, 0.49, -0.02)
  } else if (hat === 'feather') {
    b.box(0.58, 0.05, 0.56, '#7a3a2a', 0, 0.47, 0).box(0.42, 0.12, 0.42, '#7a3a2a', 0, 0.54, 0).box(0.03, 0.26, 0.07, '#f4f1e8', 0.17, 0.66, -0.06, { rz: -0.4 })
  } else if (hat === 'helmet') {
    b.box(0.5, 0.16, 0.48, '#e0b23a', 0, 0.47, 0).box(0.6, 0.04, 0.58, '#c99a2a', 0, 0.4, 0).box(0.12, 0.1, 0.05, '#fff2a8', 0, 0.47, 0.25, { glow: true })
  } else if (hat === 'hood') {
    b.box(0.5, 0.48, 0.48, '#4a2f2a', 0, 0.24, -0.03)
      .box(0.5, 0.12, 0.08, '#4a2f2a', 0, 0.44, 0.2)
      .box(0.46, 0.1, 0.03, '#7a2e2e', 0, 0.08, 0.22)
  } else if (hat === 'crown') {
    b.box(0.5, 0.08, 0.48, '#d9b54a', 0, 0.46, 0)
    for (const x of [-0.18, 0, 0.18]) {
      b.box(0.08, 0.12, 0.08, '#d9b54a', x, 0.55, 0.18)
    }
    b.box(0.07, 0.07, 0.03, '#d14a6a', 0, 0.48, 0.25, { glow: true })
  }
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

function decorateUniqueArmor(b: Builder, id: UniqueArmorId | undefined) {
  if (id === 'mossmantle') {
    b.box(0.48, 0.2, 0.1, '#6fbf4a', 0, 0.28, -0.16, { glow: true })
      .box(0.1, 0.14, 0.08, '#4a8a3a', -0.2, 0.1, 0.12)
      .box(0.1, 0.14, 0.08, '#4a8a3a', 0.2, 0.1, 0.12)
  } else if (id === 'citadelvestment') {
    b.box(0.36, 0.06, 0.28, '#d9b54a', 0, 0.34, 0, { glow: true })
      .box(0.08, 0.2, 0.08, '#c79bff', 0, 0.2, 0.14, { glow: true })
  } else if (id === 'wyrmscale') {
    for (const [x, y] of [[-0.12, 0.2], [0.12, 0.22], [0, 0.12], [-0.08, 0.28], [0.1, 0.14]] as const) {
      b.box(0.1, 0.08, 0.04, '#ff8a3d', x, y, 0.14, { glow: true })
    }
  } else if (id === 'lichshroud') {
    b.box(0.46, 0.12, 0.08, '#b48cff', 0, 0.34, -0.1, { glow: true })
      .box(0.08, 0.1, 0.06, '#e9e4d4', -0.12, 0.18, 0.13)
      .box(0.08, 0.1, 0.06, '#e9e4d4', 0.12, 0.18, 0.13)
  }
}

// Unique weapons (Docs/identity.md 5c): colour and ornament on a class-sized base.
function drawUniqueWeapon(b: Builder, id: UniqueWeaponId, aura: GearAura = null, offhand = false) {
  const forward = Math.PI / 2
  const glow = aura ? AURA_BLADE[aura] : null
  if (id === 'gravecleaver') {
    b.within(0, -0.27, 0.03, forward, 0, 0, () => {
      b.box(0.05, 0.12, 0.05, '#3a3d44')
        .box(0.22, 0.05, 0.06, '#7dff9a', 0, 0.08, 0, { glow: true })
        .box(0.08, 0.5, 0.04, glow ?? '#e9e4d4', 0, 0.34, 0, glow ? { glow: true } : {})
        .box(0.1, 0.1, 0.1, '#7dff9a', 0, 0.58, 0, { glow: true })
    })
  } else if (id === 'twinfang') {
    const side = offhand ? -1 : 1
    b.within(side * 0.02, -0.27, 0.03, forward, 0, 0, () => {
      b.box(0.04, 0.1, 0.04, '#2a1e18')
        .box(0.12, 0.03, 0.04, '#8a3434', 0, 0.06, 0)
        .box(0.045, 0.28, 0.03, glow ?? '#cfd5dc', 0, 0.2, 0, glow ? { glow: true } : {})
        .box(0.03, 0.08, 0.03, '#ff6a3a', 0, 0.36, 0, { glow: true })
    })
  } else if (id === 'dragonbane') {
    b.within(0, -0.27, 0.03, forward, 0, 0, () => {
      b.box(0.05, 0.12, 0.05, '#5a1810')
        .box(0.22, 0.05, 0.06, '#d9b54a', 0, 0.08, 0, { glow: true })
        .box(0.09, 0.52, 0.04, glow ?? '#ff6a3a', 0, 0.36, 0, { glow: true })
        .box(0.12, 0.08, 0.08, '#ffe27a', 0, 0.62, 0, { glow: true })
        .box(0.06, 0.1, 0.06, '#8a1e12', -0.1, 0.55, 0, { rz: 0.5 })
        .box(0.06, 0.1, 0.06, '#8a1e12', 0.1, 0.55, 0, { rz: -0.5 })
    })
  } else if (id === 'lichscepter') {
    b.within(0, -0.27, 0.03, forward, 0, 0, () => {
      b.box(0.045, 0.36, 0.045, '#e9e4d4', 0, 0.12, 0)
        .box(0.14, 0.14, 0.14, glow ?? '#b48cff', 0, 0.36, 0, { glow: true })
        .box(0.08, 0.16, 0.08, '#7fe3ff', 0, 0.5, 0, { glow: true })
        .box(0.1, 0.06, 0.1, '#2a2030', 0, 0.28, 0)
    })
  }
}

// Weapons hang from the right hand (arm-local y = -0.27).
function drawWeapon(b: Builder, weapon: Weapon, aura: GearAura = null) {
  const forward = Math.PI / 2
  const blade = aura ? AURA_BLADE[aura] : null
  const trim = aura ? AURA_TRIM[aura] : null
  if (weapon === 'sword' || weapon === 'rusty' || weapon === 'shieldsword') {
    const rusty = weapon === 'rusty'
    b.within(0, -0.27, 0.03, forward, 0, 0, () => {
      b.box(0.05, 0.12, 0.05, '#5a3d28')
        .box(0.2, 0.04, 0.06, rusty ? '#7a6a55' : (trim ?? '#c9a43a'), 0, 0.07, 0)
        .box(0.07, weapon === 'shieldsword' ? 0.38 : 0.46, 0.035, rusty ? '#9c8f7c' : (blade ?? '#dfe4ea'), 0, weapon === 'shieldsword' ? 0.28 : 0.32, 0, blade ? { glow: true } : {})
    })
  } else if (weapon === 'axe') {
    b.within(0, -0.27, 0.03, forward, 0, 0, () => {
      b.box(0.05, 0.36, 0.05, '#5a3d28', 0, 0.12, 0)
        .box(0.28, 0.16, 0.06, blade ?? '#cfd5dc', 0.12, 0.34, 0, blade ? { glow: true } : {})
        .box(0.1, 0.22, 0.05, trim ?? '#8a8f98', 0.22, 0.34, 0)
    })
  } else if (weapon === 'dagger') {
    b.within(0, -0.27, 0.03, forward, 0, 0, () => {
      b.box(0.045, 0.1, 0.045, '#3a2a20')
        .box(0.13, 0.035, 0.05, trim ?? '#8a3434', 0, 0.06, 0)
        .box(0.05, 0.22, 0.03, blade ?? '#cfd5dc', 0, 0.18, 0, blade ? { glow: true } : {})
    })
  } else if (weapon === 'mace' || weapon === 'scepter') {
    b.within(0, -0.27, 0.03, forward, 0, 0, () => {
      b.box(0.045, 0.32, 0.045, '#6b4a30', 0, 0.1, 0)
      if (weapon === 'scepter') {
        b.box(0.12, 0.12, 0.12, blade ?? '#ffe27a', 0, 0.32, 0, { glow: true })
          .box(0.06, 0.1, 0.06, trim ?? '#d9b54a', 0, 0.42, 0, { glow: true })
      } else {
        b.box(0.15, 0.15, 0.15, blade ?? '#c9a43a', 0, 0.3, 0, blade ? { glow: true } : {})
      }
    })
  } else if (weapon === 'pick') {
    b.within(0, -0.27, 0.03, forward, 0, 0, () => {
      b.box(0.045, 0.42, 0.045, '#6b4a30', 0, 0.15, 0).box(0.36, 0.06, 0.05, blade ?? '#8a8f98', 0, 0.36, 0, { rz: 0.15, ...(blade ? { glow: true } : {}) })
    })
  } else if (weapon === 'staff') {
    b.within(0, -0.27, 0.05, 0, 0, 0, () => {
      b.box(0.05, 1.0, 0.05, '#7a5236', 0, 0.28, 0)
        .box(0.18, 0.05, 0.05, '#7a5236', 0, 0.76, 0)
        .box(0.13, 0.13, 0.13, blade ?? '#7fe3ff', 0, 0.86, 0, { glow: true })
    })
  } else if (weapon === 'tome') {
    b.within(0, -0.27, 0.04, 0.2, 0, 0, () => {
      b.box(0.2, 0.06, 0.26, trim ?? '#5a3a28', 0, 0.02, 0)
        .box(0.18, 0.04, 0.24, blade ?? '#f2efe6', 0, 0.06, 0, blade ? { glow: true } : {})
        .box(0.04, 0.05, 0.22, '#3a2616', -0.08, 0.04, 0)
        .box(0.06, 0.02, 0.08, '#c9a43a', 0.04, 0.09, 0.04)
    })
  } else if (weapon === 'bow') {
    b.within(0, -0.27, 0.09, 0, 0, 0, () => {
      b.box(0.05, 0.2, 0.05, trim ?? '#7a5236')
        .box(0.05, 0.26, 0.05, trim ?? '#7a5236', 0, 0.21, -0.04, { rx: 0.3 })
        .box(0.05, 0.26, 0.05, trim ?? '#7a5236', 0, -0.21, -0.04, { rx: -0.3 })
        .box(0.012, 0.64, 0.012, blade ?? '#f2efe6', 0, 0, -0.09, blade ? { glow: true } : {})
    })
  } else if (weapon === 'crossbow') {
    b.within(0, -0.27, 0.06, 0, 0.4, 0, () => {
      b.box(0.06, 0.14, 0.28, '#6b4a30', 0, 0.02, 0.04)
        .box(0.36, 0.05, 0.06, trim ?? '#8a6a3a', 0, 0.06, -0.02)
        .box(0.04, 0.04, 0.22, blade ?? '#cfd5dc', 0, 0.08, 0.14, blade ? { glow: true } : {})
        .box(0.08, 0.08, 0.08, '#5a3d28', 0, 0.02, -0.12)
    })
  } else if (weapon === 'lute') {
    b.within(0, -0.27, 0.03, 1.1, 0, 0, () => {
      b.box(0.22, 0.26, 0.08, '#b07a3c', 0, 0.06, 0)
        .box(0.07, 0.07, 0.01, '#3a2616', 0, 0.07, 0.045)
        .box(0.05, 0.3, 0.04, '#7a5236', 0, 0.34, 0)
      if (blade) {
        b.box(0.1, 0.1, 0.04, blade, 0, 0.08, 0.06, { glow: true })
      }
    })
  } else if (weapon === 'drum') {
    b.within(0, -0.27, 0.04, 0.3, 0, 0, () => {
      b.box(0.22, 0.16, 0.22, '#8a5a32', 0, 0.04, 0)
        .box(0.2, 0.04, 0.2, blade ?? '#f2efe6', 0, 0.13, 0, blade ? { glow: true } : {})
        .box(0.04, 0.18, 0.04, '#5a3d28', -0.14, 0.04, 0)
        .box(0.04, 0.18, 0.04, '#5a3d28', 0.14, 0.04, 0)
        .box(0.06, 0.06, 0.06, trim ?? '#c9a43a', 0, 0.04, 0.12)
    })
  } else if (weapon === 'fan') {
    b.within(0, -0.27, 0.03, forward, 0, 0, () => {
      b.box(0.03, 0.12, 0.03, '#6b4a30', 0, 0.03, 0)
        .box(0.3, 0.2, 0.025, blade ?? '#f39bc2', 0, 0.18, 0, blade ? { glow: true } : {})
        .box(0.2, 0.06, 0.03, trim ?? '#f0c75e', 0, 0.29, 0)
    })
  }
}

function drawOffhandShield(b: Builder, aura: GearAura = null) {
  const face = aura ? AURA_BLADE[aura] : '#b8c0c8'
  const rim = aura ? AURA_TRIM[aura] : '#8a8f98'
  b.box(0.08, 0.32, 0.26, rim, -0.12, -0.12, 0.04)
    .box(0.05, 0.26, 0.2, face, -0.16, -0.12, 0.04, aura ? { glow: true } : {})
    .box(0.04, 0.08, 0.08, '#c9a43a', -0.18, -0.08, 0.04)
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
  const aura = rig.torso.getObjectByName('gearAura')
  if (aura) {
    aura.position.y = Math.sin(time * 2.2 + phase) * 0.04
    aura.rotation.y = time * 0.9 + phase
  }
}

export function walkPose(rig: Rig, time: number, phase: number, speed: number) {
  const k = time * 9 * speed + phase
  const swing = Math.sin(k)
  rig.group.position.y = Math.abs(Math.cos(k)) * 0.035
  const aura = rig.torso.getObjectByName('gearAura')
  if (aura) {
    aura.position.y = Math.sin(time * 2.2 + phase) * 0.04
    aura.rotation.y = time * 0.9 + phase
  }
  rig.group.rotation.set(0, 0, 0)
  rig.torso.scale.y = 1
  rig.legL.rotation.x = swing * 0.6
  rig.legR.rotation.x = -swing * 0.6
  rig.armL.rotation.set(-swing * 0.5, 0, -0.06)
  rig.armR.rotation.set(swing * 0.5, 0, 0.06)
}
