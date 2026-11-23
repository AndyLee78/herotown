import type { ClassId, Gender, Genes, Hero } from '../../core'
import { STYLES, genesFor, hashString, mixHex, seeded } from '../../core'
import type { HairStyle } from '../../core'

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
