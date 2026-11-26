import type { ClassId, Gender, Genes, Gear, Hero } from '../../core'
import { STYLES, genesFor, hashString, mixHex, seeded } from '../../core'
import type { HairStyle } from '../../core'
import type { ArmorType, WeaponType } from '../../core/types'

// Highest worn gear grade that gets a glow: heroic purple, legendary gold.
export type GearAura = 'epic' | 'legend' | null

const WEAPON_TYPES: readonly WeaponType[] = [
  'sword',
  'axe',
  'shieldsword',
  'dagger',
  'bow',
  'crossbow',
  'staff',
  'tome',
  'scepter',
  'lute',
  'drum',
  'fan',
]
const ARMOR_TYPES: readonly ArmorType[] = ['plate', 'leather', 'robe']

export function gearAuraOf(gear: Pick<Gear, 'grade'>[] | undefined | null): GearAura {
  let best: GearAura = null
  for (const item of gear ?? []) {
    if (item.grade === 'legend') {
      return 'legend'
    }
    if (item.grade === 'epic') {
      best = 'epic'
    }
  }
  return best
}

export type GearSetId = 'dragonslayer' | 'gravekeeper' | 'windwalker' | 'choir'

// Unique weapon/armour ids that get a distinct voxel look (Docs/identity.md 5c).
export const UNIQUE_WEAPONS = ['gravecleaver', 'twinfang', 'dragonbane', 'lichscepter'] as const
export const UNIQUE_ARMORS = ['mossmantle', 'citadelvestment', 'wyrmscale', 'lichshroud'] as const
export type UniqueWeaponId = (typeof UNIQUE_WEAPONS)[number]
export type UniqueArmorId = (typeof UNIQUE_ARMORS)[number]

const UNIQUE_SET: Record<string, GearSetId> = {
  gravecleaver: 'gravekeeper',
  cryptcrown: 'gravekeeper',
  mossmantle: 'windwalker',
  twinfang: 'windwalker',
  citadelvestment: 'choir',
  dragonbane: 'dragonslayer',
  wyrmscale: 'dragonslayer',
  wyrmeye: 'dragonslayer',
  lichshroud: 'gravekeeper',
  lichscepter: 'choir',
  titanstride: 'windwalker',
  titanbell: 'choir',
}

export const SET_GLOW: Record<GearSetId, string> = {
  dragonslayer: '#ff6a3a',
  gravekeeper: '#6fbf4a',
  windwalker: '#7fe3ff',
  choir: '#ffe27a',
}

// Worn weapon/armour kinds for voxel models (Docs/identity.md 5b). Missing type
// keeps the class default look, same path gearAuraOf already walks.
export type GearStyle = {
  aura: GearAura
  weapon?: WeaponType
  armor?: ArmorType
  uniqueWeapon?: UniqueWeaponId
  uniqueArmor?: UniqueArmorId
  // Soft set-coloured light when three pieces of one set are worn (5c).
  setGlow?: GearSetId
}

export function gearStyleOf(gear: Pick<Gear, 'grade' | 'slot' | 'type' | 'unique'>[] | undefined | null): GearStyle {
  let weapon: WeaponType | undefined
  let armor: ArmorType | undefined
  let uniqueWeapon: UniqueWeaponId | undefined
  let uniqueArmor: UniqueArmorId | undefined
  const worn = new Map<GearSetId, Set<string>>()
  for (const item of gear ?? []) {
    if (item.slot === 'weapon' && item.type && (WEAPON_TYPES as readonly string[]).includes(item.type)) {
      weapon = item.type as WeaponType
    }
    if (item.slot === 'armor' && item.type && (ARMOR_TYPES as readonly string[]).includes(item.type)) {
      armor = item.type as ArmorType
    }
    if (item.unique && item.slot === 'weapon' && (UNIQUE_WEAPONS as readonly string[]).includes(item.unique)) {
      uniqueWeapon = item.unique as UniqueWeaponId
    }
    if (item.unique && item.slot === 'armor' && (UNIQUE_ARMORS as readonly string[]).includes(item.unique)) {
      uniqueArmor = item.unique as UniqueArmorId
    }
    const set = item.unique ? UNIQUE_SET[item.unique] : undefined
    if (set && item.unique) {
      worn.set(set, (worn.get(set) ?? new Set()).add(item.unique))
    }
  }
  let setGlow: GearSetId | undefined
  for (const [set, pieces] of worn) {
    if (pieces.size >= 3) {
      setGlow = set
      break
    }
  }
  return {
    aura: gearAuraOf(gear),
    ...(weapon ? { weapon } : {}),
    ...(armor ? { armor } : {}),
    ...(uniqueWeapon ? { uniqueWeapon } : {}),
    ...(uniqueArmor ? { uniqueArmor } : {}),
    ...(setGlow ? { setGlow } : {}),
  }
}

export function gearStyleKey(style: GearStyle): string {
  return `${style.aura ?? ''}|${style.weapon ?? ''}|${style.armor ?? ''}|${style.uniqueWeapon ?? ''}|${style.uniqueArmor ?? ''}|${style.setGlow ?? ''}`
}

// Appearance is drawn from the hero's genes (src/core/genes.ts). Heroes born
// in town carry theirs; everyone else gets genes from their id, so a hero
// always looks the same.

export type { HairStyle }
export { EYES, HAIRS, SKINS } from '../../core'
export { hashString, mixHex, seeded }

export type Look = {
  classId: ClassId
  gender: Gender
  age: number
  skin: string
  hair: string
  eye: string
  style: HairStyle
  beard: boolean
  height: number
}

export type AgeLook = {
  scale: number
  head: number
  gray: number
  stoop: number
}

const GRAY_HAIR = '#dcdcdc'

export function lookFor(hero: Pick<Hero, 'id' | 'classId' | 'gender' | 'age'> & { genes?: Genes }): Look {
  const genes = genesFor(hero)
  const styles = STYLES[hero.gender]
  const preferred = styles[genes.style % styles.length] ?? 'short'
  return {
    classId: hero.classId,
    gender: hero.gender,
    age: Math.floor(hero.age),
    skin: genes.skin,
    hair: genes.hair,
    eye: genes.eye,
    style: genes.balding && hero.gender === 'male' && hero.age >= 50 ? 'bald' : preferred,
    beard: hero.gender === 'male' && genes.beard,
    height: genes.height,
  }
}

export function lookKey(look: Look): string {
  return [look.classId, look.gender, look.age, look.skin, look.hair, look.eye, look.style, look.beard ? 1 : 0].join(':')
}

// Age changes body size, head ratio, grey hair and posture.
export function ageLook(age: number): AgeLook {
  const scale = age < 18 ? lerp(0.62, 0.95, (age - 8) / 10) : age < 22 ? lerp(0.95, 1, (age - 18) / 4) : age > 50 ? lerp(1, 0.94, (age - 50) / 15) : 1
  const head = age < 20 ? lerp(1.22, 1, (age - 8) / 12) : 1
  const gray = age < 38 ? 0 : lerp(0, 0.9, (age - 38) / 22)
  const stoop = age < 55 ? 0 : lerp(0, 0.22, (age - 55) / 12)
  return { scale, head, gray, stoop }
}

export function hairColor(look: Look): string {
  return mixHex(look.hair, GRAY_HAIR, ageLook(look.age).gray)
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.min(1, Math.max(0, t))
}
