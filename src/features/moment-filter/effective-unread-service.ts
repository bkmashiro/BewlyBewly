import type { PromotionLearningLoadResult } from './promotion-storage'
import type { MomentFilterLoadResult } from './types'
import { resolveEffectiveMomentUnreadCount } from './effective-unread-count'

export interface EffectiveMomentUnreadSources {
  loadFilter: () => Promise<MomentFilterLoadResult>
  loadPromotion: () => Promise<PromotionLearningLoadResult>
  fetchFeed: () => Promise<unknown>
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

export async function resolveEffectiveMomentUnreadFromSources(
  originalCount: number,
  sources: EffectiveMomentUnreadSources,
): Promise<number> {
  if (originalCount <= 0)
    return originalCount

  try {
    const filter = await sources.loadFilter()
    if (!filter.value.enabled)
      return originalCount

    const [promotion, response] = await Promise.all([
      sources.loadPromotion(),
      sources.fetchFeed(),
    ])
    const envelope = asRecord(response)
    if (envelope?.code !== 0)
      return originalCount

    return resolveEffectiveMomentUnreadCount(
      originalCount,
      envelope.data,
      filter.value,
      promotion.value,
    )
  }
  catch {
    return originalCount
  }
}
