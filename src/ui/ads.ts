export type AdPlacement = 'absence' | 'construction' | 'temple'
export type AdResult = 'rewarded' | 'skipped' | 'unavailable'

export interface RewardedAds {
  showRewarded(placement: AdPlacement): Promise<AdResult>
}

export class FakeAds implements RewardedAds {
  constructor(private readonly waitMs = 1000) {}

  showRewarded(placement: AdPlacement): Promise<AdResult> {
    void placement
    return new Promise((resolve) => {
      setTimeout(() => resolve('rewarded'), this.waitMs)
    })
  }
}

export const rewardedAds: RewardedAds = new FakeAds()
