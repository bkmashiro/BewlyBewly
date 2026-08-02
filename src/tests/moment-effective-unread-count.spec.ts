import { describe, expect, it } from 'vitest'

import { createDefaultMomentFilterSettings } from '~/features/moment-filter/defaults'
import { resolveEffectiveMomentUnreadCount } from '~/features/moment-filter/effective-unread-count'
import { createEmptyPromotionLearningState } from '~/features/moment-filter/promotion-learning'

function apiItem(id: string, content: string, commercialSignal?: string) {
  return {
    id_str: id,
    modules: {
      module_author: { mid: Number(id), name: `Author ${id}` },
      module_dynamic: {
        desc: { text: content },
        major: null,
        additional: commercialSignal ? { type: commercialSignal } : null,
      },
    },
  }
}

describe('effective moment unread count', () => {
  it('excludes confirmed promotions and explicit hide rules while keeping suspected items', () => {
    const filter = createDefaultMomentFilterSettings()
    filter.enabled = true
    filter.rules = [{
      id: 'hide-author',
      enabled: true,
      action: 'hide',
      field: 'authorUid',
      operator: 'equals',
      value: '2',
      createdAt: 1,
    }]
    const items = [
      apiItem('1', 'ordinary update'),
      apiItem('2', 'hidden by rule'),
      apiItem('3', 'ordinary purchase text 购买'),
      apiItem('4', 'goods', 'ADDITIONAL_TYPE_GOODS'),
    ]

    expect(resolveEffectiveMomentUnreadCount(4, {
      items,
      update_num: 4,
    }, filter, createEmptyPromotionLearningState())).toBe(2)
  })

  it('keeps allow matches even when promotion learning confirms them', () => {
    const filter = createDefaultMomentFilterSettings()
    filter.enabled = true
    filter.rules = [{
      id: 'allow-author',
      enabled: true,
      action: 'allow',
      field: 'authorUid',
      operator: 'equals',
      value: '1',
      createdAt: 1,
    }]

    expect(resolveEffectiveMomentUnreadCount(1, {
      items: [apiItem('1', 'goods', 'ADDITIONAL_TYPE_GOODS')],
      update_num: 1,
    }, filter, createEmptyPromotionLearningState())).toBe(1)
  })

  it('returns the original count when filtering is disabled or the feed is incomplete', () => {
    const disabled = createDefaultMomentFilterSettings()
    const enabled = { ...disabled, enabled: true }
    const partial = { items: [apiItem('1', 'goods', 'ADDITIONAL_TYPE_GOODS')], update_num: 3 }

    expect(resolveEffectiveMomentUnreadCount(3, partial, disabled, createEmptyPromotionLearningState())).toBe(3)
    expect(resolveEffectiveMomentUnreadCount(3, partial, enabled, createEmptyPromotionLearningState())).toBe(3)
  })

  it('fails open for malformed payloads or mismatched endpoint counts', () => {
    const enabled = { ...createDefaultMomentFilterSettings(), enabled: true }
    expect(resolveEffectiveMomentUnreadCount(2, null, enabled, createEmptyPromotionLearningState())).toBe(2)
    expect(resolveEffectiveMomentUnreadCount(2, {
      items: [apiItem('1', 'goods', 'ADDITIONAL_TYPE_GOODS')],
      update_num: 1,
    }, enabled, createEmptyPromotionLearningState())).toBe(2)
  })
})
