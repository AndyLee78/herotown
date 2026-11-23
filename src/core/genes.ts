import type { Rng } from './rng'
import type { Gender, Hero } from './types'

// Appearance genes. Heroes born in town store theirs; everyone else gets genes
// drawn from their id, in the same order the UI always used, so a hero who
// existed before genes keeps the same face.

export type HairStyle = 'short' | 'spiky' | 'ponytail' | 'long' | 'bob' | 'bald'

export type Genes = {
  skin: string
  hair: string
  eye: string
  // Index into the hair styles for the hero's gender.
  style: number
  beard: boolean
  height: number
  // Goes bald after 50 (men only).
  balding: boolean
}

export const SKINS = ['#f7dcc0', '#ecc39b', '#d49d6e', '#ab7149', '#7b4c30'] as const
export const HAIRS = ['#2a2019', '#4e3221', '#7b4a2a', '#b0722f', '#e0b85a', '#a8352a', '#3d4256'] as const
export const EYES = ['#2a2522', '#3c6fa8', '#3f7f4c', '#7a5230'] as const

export const STYLES: Record<Gender, readonly HairStyle[]> = {
  male: ['short', 'spiky', 'ponytail', 'short'],
  female: ['long', 'bob', 'ponytail', 'short'],
}

export function genesFor(hero: Pick<Hero, 'id' | 'gender'> & { genes?: Genes }): Genes {
  if (hero.genes) {
    return hero.genes
  }
  const next = seeded(hashString(hero.id))
  const index = (length: number) => Math.floor(next() * length) % length
  const skin = SKINS[Math.min(SKINS.length - 1, Math.floor(next() * next() * 6))] as string
  const hair = HAIRS[index(HAIRS.length)] as string
  const eye = EYES[index(EYES.length)] as string
  const style = index(STYLES[hero.gender].length)
  const beard = hero.gender === 'male' && next() < 0.45
  const height = 0.96 + next() * 0.08
  const balding = hero.gender === 'male' && next() < 0.35
  return { skin, hair, eye, style, beard, height, balding }
}

// A child's genes: colours blend, features come from one parent.
export function inheritGenes(rng: Rng, gender: Gender, mother: Genes, father: Genes): Genes {
  const either = <T>(a: T, b: T): T => (rng.next() < 0.5 ? a : b)
  const blend = (a: string, b: string) => mixHex(a, b, 0.3 + rng.next() * 0.4)
  const skin = blend(mother.skin, father.skin)
  const hair = blend(mother.hair, father.hair)
  const eye = either(mother.eye, father.eye)
  const style = either(mother.style, father.style) % STYLES[gender].length
  const beard = gender === 'male' && (rng.next() < 0.7 ? father.beard : rng.next() < 0.45)
  const height = clamp((mother.height + father.height) / 2 + (rng.next() * 2 - 1) * 0.02, 0.94, 1.06)
  const balding = gender === 'male' && (rng.next() < 0.7 ? father.balding : rng.next() < 0.35)
  return { skin, hair, eye, style, beard, height, balding }
}

export function mixHex(a: string, b: string, t: number): string {
  const from = parseHex(a)
  const to = parseHex(b)
  const k = clamp(t, 0, 1)
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

export function isGenes(value: unknown): value is Genes {
  if (value == null || typeof value !== 'object') {
    return false
  }
  const genes = value as Genes
  return (
    typeof genes.skin === 'string' &&
    typeof genes.hair === 'string' &&
    typeof genes.eye === 'string' &&
    typeof genes.style === 'number' &&
    typeof genes.beard === 'boolean' &&
    typeof genes.height === 'number' &&
    typeof genes.balding === 'boolean'
  )
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function parseHex(hex: string): number[] {
  const clean = hex.replace('#', '')
  return [0, 2, 4].map((offset) => Number.parseInt(clean.slice(offset, offset + 2), 16) || 0)
}
