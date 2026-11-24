import { describe, expect, it } from 'vitest'
import { freshState, migrate, reduce } from './game'
import { guideStatus, guideSteps } from './guide'

const now = 1_700_000_000_000

describe('first-play guide', () => {
  it('starts on hiring and does nothing until the goal is met', () => {
    const start = freshState(3, now)
    const status = guideStatus(start)
    expect(status.step?.id).toBe('hire')
    expect(status.done).toBe(false)
    expect(reduce(start, { type: 'claimGuide' })).toEqual(start)
  })

  it('pays the reward once and moves on', () => {
    const start = freshState(3, now)
    const hired = reduce(start, { type: 'hire', id: start.visitors[0]?.id ?? '', now })
    expect(guideStatus(hired).done).toBe(true)
    const claimed = reduce(hired, { type: 'claimGuide' })
    expect(claimed.gold).toBe(hired.gold + (guideSteps[0]?.reward.gold ?? 0))
    expect(guideStatus(claimed).step?.id).toBe('wish')
    expect(guideStatus(claimed).done).toBe(false)
    expect(reduce(claimed, { type: 'claimGuide' }).guideStep).toBe(1)
    // One wish at the fountain clears the step; it pays nothing, the coins are the reward.
    const wished = reduce(claimed, { type: 'wish', now })
    expect(guideStatus(wished).done).toBe(true)
    const next = reduce(wished, { type: 'claimGuide' })
    expect(next.gold).toBe(wished.gold)
    expect(guideStatus(next).step?.id).toBe('team')
    expect(guideStatus(next).current).toBe(1)
  })

  it('counts construction, auto runs and cleared dungeons', () => {
    const start = { ...freshState(3, now), guideStep: 4 }
    expect(guideStatus(start).done).toBe(false)
    expect(guideStatus(reduce(start, { type: 'build', id: 'house', now })).done).toBe(true)
    // The guild comes before auto runs now (Docs/guild.md).
    const auto = { ...start, guideStep: 6, buildings: { ...start.buildings, guild: 1 } }
    expect(guideStatus(reduce(auto, { type: 'auto', enabled: true })).done).toBe(true)
    const cave = { ...start, guideStep: 3, cleared: ['hill_cave'] }
    expect(guideStatus(cave).done).toBe(true)
  })

  it('ends after the last step', () => {
    const finished = { ...freshState(3, now), guideStep: guideSteps.length }
    expect(guideStatus(finished).step).toBeNull()
    expect(reduce(finished, { type: 'claimGuide' })).toEqual(finished)
  })

  it('starts older saves at the first step', () => {
    const old = { ...freshState(3, now), version: 4 } as Record<string, unknown>
    delete old.guideStep
    expect(migrate(old, now).guideStep).toBe(0)
  })

  it('keeps an older player on the same step after the fountain step was added', () => {
    const past = { ...freshState(3, now), version: 9, guideStep: 3 } as Record<string, unknown>
    expect(guideSteps[migrate(past, now).guideStep]?.id).toBe('build')
    const first = { ...freshState(3, now), version: 9, guideStep: 0 } as Record<string, unknown>
    expect(migrate(first, now).guideStep).toBe(0)
    const current = { ...freshState(3, now), guideStep: 3 } as Record<string, unknown>
    expect(migrate(current, now).guideStep).toBe(3)
  })
})
