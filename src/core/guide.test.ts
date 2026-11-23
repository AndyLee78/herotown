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
    expect(guideStatus(claimed).step?.id).toBe('team')
    expect(guideStatus(claimed).current).toBe(1)
    expect(reduce(claimed, { type: 'claimGuide' }).guideStep).toBe(1)
  })

  it('counts construction, auto runs and cleared dungeons', () => {
    const start = { ...freshState(3, now), guideStep: 3 }
    expect(guideStatus(start).done).toBe(false)
    expect(guideStatus(reduce(start, { type: 'build', id: 'house', now })).done).toBe(true)
    const auto = { ...start, guideStep: 4 }
    expect(guideStatus(reduce(auto, { type: 'auto', enabled: true })).done).toBe(true)
    const cave = { ...start, guideStep: 2, cleared: ['hill_cave'] }
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
})
