import type { PromotionLearningLoadResult } from '~/features/moment-filter/promotion-storage'
import type { MomentFilterLoadResult } from '~/features/moment-filter/types'

import { describe, expect, it, vi } from 'vitest'
import { createDefaultMomentFilterSettings } from '~/features/moment-filter/defaults'
import { resolveEffectiveMomentUnreadFromSources } from '~/features/moment-filter/effective-unread-service'
import { createEmptyPromotionLearningState } from '~/features/moment-filter/promotion-learning'

function filterResult(enabled: boolean): MomentFilterLoadResult {
  return {
    status: 'loaded',
    value: { ...createDefaultMomentFilterSettings(), enabled },
    issues: [],
  }
}

function promotionResult(): PromotionLearningLoadResult {
  return {
    status: 'loaded',
    value: createEmptyPromotionLearningState(),
    issues: [],
  }
}

describe('effective moment unread source resolver', () => {
  it('does not fetch feed content while filtering is disabled', async () => {
    const fetchFeed = vi.fn()
    const result = await resolveEffectiveMomentUnreadFromSources(3, {
      loadFilter: async () => filterResult(false),
      loadPromotion: async () => promotionResult(),
      fetchFeed,
    })

    expect(result).toBe(3)
    expect(fetchFeed).not.toHaveBeenCalled()
  })

  it('filters complete unread feed content when enabled', async () => {
    const result = await resolveEffectiveMomentUnreadFromSources(1, {
      loadFilter: async () => filterResult(true),
      loadPromotion: async () => promotionResult(),
      fetchFeed: async () => ({
        code: 0,
        data: {
          update_num: 1,
          items: [{
            modules: {
              module_dynamic: {
                desc: { text: 'goods' },
                major: null,
                additional: { type: 'ADDITIONAL_TYPE_GOODS' },
              },
            },
          }],
        },
      }),
    })

    expect(result).toBe(0)
  })

  it('fails open when storage or feed loading fails', async () => {
    expect(await resolveEffectiveMomentUnreadFromSources(2, {
      loadFilter: async () => { throw new Error('storage unavailable') },
      loadPromotion: async () => promotionResult(),
      fetchFeed: async () => ({}),
    })).toBe(2)

    expect(await resolveEffectiveMomentUnreadFromSources(2, {
      loadFilter: async () => filterResult(true),
      loadPromotion: async () => promotionResult(),
      fetchFeed: async () => { throw new Error('network unavailable') },
    })).toBe(2)
  })
})
