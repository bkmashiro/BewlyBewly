import type { PromotionLearningState } from './promotion-learning'
import type { MomentFilterSettingsV1 } from './types'
import { extractApiMomentCandidate } from './api-candidate'
import { planEffectiveUnread } from './effective-unread'
import { compileMomentFilter } from './matcher'
import { classifyPromotionCandidate } from './promotion-learning'

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

export function resolveEffectiveMomentUnreadCount(
  originalCount: number,
  feedData: unknown,
  filterSettings: MomentFilterSettingsV1,
  promotionState: PromotionLearningState,
): number {
  if (!filterSettings.enabled)
    return originalCount

  try {
    const data = asRecord(feedData)
    if (!data || !Array.isArray(data.items) || !Number.isInteger(data.update_num))
      return originalCount
    const updateNum = data.update_num as number
    if (updateNum !== originalCount)
      return originalCount

    const match = compileMomentFilter(filterSettings)
    const plan = planEffectiveUnread(data.items, updateNum, {
      ruleAction: item => match(extractApiMomentCandidate(item)).action,
      promotionState: item => classifyPromotionCandidate(
        extractApiMomentCandidate(item),
        promotionState,
      ).classification,
    })
    return plan.complete ? plan.count : originalCount
  }
  catch {
    return originalCount
  }
}
