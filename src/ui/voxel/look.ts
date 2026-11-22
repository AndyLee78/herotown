import type { ClassId, Gender, Hero } from '../../core'

// Appearance is cosmetic and lives in the UI. Until genes exist in the core
// (stage 2), it is derived from the hero id so a hero always looks the same.

export type HairStyle = 'short' | 'spiky' | 'ponytail' | 'long' | 'bob' | 'bald'

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

export const SKINS = ['#f7dcc0', '#ecc39b', '#d49d6e', '#ab7149', '#7b4c30'] as const
export const HAIRS = ['#2a2019', '#4e3221', '#7b4a2a', '#b0722f', '#e0b85a', '#a8352a', '#3d4256'] as const
export const EYES = ['#2a2522', '#3c6fa8', '#3f7f4c', '#7a5230'] as const

const STYLES: Record<Gender, readonly HairStyle[]> = {
  male: ['short', 'spiky', 'ponytail', 'short'],
  female: ['long', 'bob', 'ponytail', 'short'],
}
const GRAY_HAIR = '#dcdcdc'

export function lookFor(hero: Pick<Hero, 'id' | 'classId' | 'gender' | 'age'>): Look {
  const next = seeded(hashString(hero.id))
  const pick = <T>(list: readonly T[]): T => list[Math.floor(next() * list.length) % list.length] as T
  // Draw order is fixed so a hero keeps the same look as they age.
  const skin = SKINS[Math.min(SKINS.length - 1, Math.floor(next() * next() * 6))] as string
  const hair = pick(HAIRS)
  const eye = pick(EYES)
  const preferred = pick(STYLES[hero.gender])
  const beard = hero.gender === 'male' && next() < 0.45
  const height = 0.96 + next() * 0.08
  const balding = hero.gender === 'male' && next() < 0.35 && hero.age >= 50
  return {
    classId: hero.classId,
    gender: hero.gender,
    age: Math.floor(hero.age),
    skin,
    hair,
    eye,
    style: balding ? 'bald' : preferred,
    beard,
    height,
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

export function mixHex(a: string, b: string, t: number): string {
  const from = parseHex(a)
  const to = parseHex(b)
  const k = Math.min(1, Math.max(0, t))
  return `#${from.map((value, index) => Math.round(value + ((to[index] ?? value) - value) * k).toString(16).padStart(2, '0')).join('')}`
}

export function hashString(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function seeded(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.min(1, Math.max(0, t))
}

function parseHex(hex: string): number[] {
  const clean = hex.replace('#', '')
  return [0, 2, 4].map((offset) => Number.parseInt(clean.slice(offset, offset + 2), 16))
}
