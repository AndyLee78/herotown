import * as THREE from 'three'
import type { PersonalityId } from '../../core'
import { Builder } from './kit'

export type MoodKind = 'up' | 'down'

// Tiny voxel speech bubbles for sudden morale swings (Docs/personality.md task 79).
export function buildMoodBubble(kind: MoodKind): THREE.Group {
  const b = new Builder()
  b.box(0.55, 0.42, 0.1, '#fff8ee', 0, 0.26, 0)
  b.box(0.14, 0.14, 0.1, '#fff8ee', -0.12, 0.02, 0)
  if (kind === 'up') {
    b.box(0.14, 0.12, 0.07, '#e85d6a', -0.1, 0.3, 0.06)
    b.box(0.14, 0.12, 0.07, '#e85d6a', 0.1, 0.3, 0.06)
    b.box(0.24, 0.16, 0.07, '#e85d6a', 0, 0.16, 0.06)
    b.box(0.1, 0.1, 0.06, '#ffd36a', 0.2, 0.4, 0.06, { glow: true })
  } else {
    b.box(0.34, 0.14, 0.07, '#8a9aaa', 0, 0.3, 0.06)
    b.box(0.18, 0.12, 0.07, '#9aabba', -0.12, 0.38, 0.06)
    b.box(0.18, 0.12, 0.07, '#9aabba', 0.12, 0.38, 0.06)
    b.box(0.08, 0.18, 0.06, '#6a9fd4', -0.1, 0.12, 0.06)
    b.box(0.07, 0.12, 0.06, '#6a9fd4', 0.08, 0.1, 0.06)
  }
  const group = b.build({ castShadow: false, receiveShadow: false })
  group.visible = false
  return group
}

export function idleSeconds(personality: PersonalityId | null, random: () => number): number {
  if (personality === 'hotheaded') {
    return 0.55 + random() * 1.1
  }
  if (personality === 'timid') {
    return 2.4 + random() * 3.2
  }
  if (personality === 'loner') {
    return 2 + random() * 3.5
  }
  return 1.5 + random() * 4
}

export function strollPace(personality: PersonalityId | null, morale: number): number {
  let pace = 1
  if (personality === 'hotheaded') {
    pace *= 1.35
  } else if (personality === 'timid') {
    pace *= 0.7
  } else if (personality === 'ambitious') {
    pace *= 1.12
  }
  if (morale <= 30) {
    pace *= 0.55
  }
  return pace
}
