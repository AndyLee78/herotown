import { describe, expect, it } from 'vitest'
import type { WeaponType } from '../../core/types'
import { buildCharacter } from './character'
import { lookFor, UNIQUE_ARMORS, UNIQUE_WEAPONS } from './look'

const weapons: WeaponType[] = [
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

describe('gear models', () => {
  it('builds every weapon and armour type without throwing', () => {
    const look = lookFor({ id: 'g-1', classId: 'warrior', gender: 'male', age: 26 })
    for (const weapon of weapons) {
      const rig = buildCharacter(look, { aura: null, weapon })
      expect(rig.kind).toBe('humanoid')
      expect(rig.height).toBeGreaterThan(0.5)
    }
    for (const armor of ['plate', 'leather', 'robe'] as const) {
      const rig = buildCharacter(look, { aura: 'legend', armor })
      expect(rig.group.children.length).toBeGreaterThan(0)
    }
  })

  it('builds unique weapons, armours and a set glow', () => {
    const look = lookFor({ id: 'g-2', classId: 'warrior', gender: 'female', age: 28 })
    for (const uniqueWeapon of UNIQUE_WEAPONS) {
      expect(buildCharacter(look, { aura: 'epic', uniqueWeapon }).kind).toBe('humanoid')
    }
    for (const uniqueArmor of UNIQUE_ARMORS) {
      expect(buildCharacter(look, { aura: null, uniqueArmor }).group.children.length).toBeGreaterThan(0)
    }
    const set = buildCharacter(look, { aura: 'legend', uniqueWeapon: 'dragonbane', uniqueArmor: 'wyrmscale', setGlow: 'dragonslayer' })
    expect(set.torso.getObjectByName('gearAura')).toBeTruthy()
  })
})
