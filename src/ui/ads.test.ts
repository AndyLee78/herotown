import { describe, expect, it } from 'vitest'
import { FakeAds } from './ads'

describe('fake rewarded ads', () => {
  it('resolves rewarded after the wait', async () => {
    await expect(new FakeAds(0).showRewarded('absence')).resolves.toBe('rewarded')
  })
})
