import { describe, expect, it } from 'vitest'
import { paintCharacter, VIEW_HEIGHT, VIEW_WIDTH, paintVillage } from './pixelArt'

const hero = {
  id: '4-0',
  classId: 'warrior' as const,
  gender: 'female' as const,
}

describe('pixel characters', () => {
  it('paints the same sprite for the same hero', () => {
    expect(paintCharacter(hero, 0)).toEqual(paintCharacter(hero, 0))
  })

  it('changes the picture for class, gender, and the walk frame', () => {
    const standing = paintCharacter(hero, 0)
    expect(paintCharacter(hero, 1)).not.toEqual(standing)
    expect(paintCharacter({ ...hero, classId: 'mage' }, 0)).not.toEqual(standing)
    expect(paintCharacter({ ...hero, gender: 'male' }, 0)).not.toEqual(standing)
    expect(standing[3]).toBe(0)
  })
})

describe('village painting', () => {
  it('fills the map and keeps the same pixels', () => {
    const village = paintVillage()
    expect(village).toHaveLength(VIEW_WIDTH * VIEW_HEIGHT * 4)
    expect(village[3]).toBe(255)
    expect(village).toEqual(paintVillage())
  })
})
