import { describe, expect, it } from 'vitest'
import { play, soundBlocked, SOUND_NAMES } from './sound'

describe('sound', () => {
  it('names twelve effects and blocks a second hit inside the gap', () => {
    expect(SOUND_NAMES).toHaveLength(12)
    expect(soundBlocked('hit', 100, 20)).toBe(true)
    expect(soundBlocked('hit', 120, 20)).toBe(false)
    expect(soundBlocked('tap', 30, 20)).toBe(true)
    expect(soundBlocked('tap', 40, 20)).toBe(false)
    expect(soundBlocked('coin', 10, undefined)).toBe(false)
  })

  it('does nothing when the platform has no audio context', () => {
    expect(() => play('tap')).not.toThrow()
  })
})
