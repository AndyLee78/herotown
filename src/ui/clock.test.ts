import { afterEach, describe, expect, it } from 'vitest'
import { timeRules } from '../core'
import { addGameOffset, gameOffset, offsetParts, offsetSteps, resetGameOffset } from './clock'

afterEach(() => {
  resetGameOffset()
})

describe('debug clock', () => {
  it('keeps a dev offset and can clear it', () => {
    addGameOffset(600_000)
    expect(gameOffset()).toBe(600_000)
    resetGameOffset()
    expect(gameOffset()).toBe(0)
  })

  it('splits a season into two catches the core will accept', () => {
    expect(offsetSteps(timeRules.seasonMs, timeRules.maxOfflineMs)).toEqual([
      timeRules.maxOfflineMs,
      timeRules.seasonMs - timeRules.maxOfflineMs,
    ])
  })

  it('reads an offset as days, hours and minutes', () => {
    expect(offsetParts(86_400_000 + 3 * 3_600_000 + 10 * 60_000)).toEqual({ days: 1, hours: 3, minutes: 10 })
    expect(offsetParts(600_000)).toEqual({ days: 0, hours: 0, minutes: 10 })
  })
})