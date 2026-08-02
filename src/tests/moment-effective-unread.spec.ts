import { describe, expect, it } from 'vitest'
import { planEffectiveUnread } from '~/features/moment-filter/effective-unread'

interface Item {
  id: string
  ruleAction: 'none' | 'hide' | 'allow'
  promotionState: 'none' | 'suspected' | 'confirmed'
}

function item(
  id: string,
  ruleAction: Item['ruleAction'] = 'none',
  promotionState: Item['promotionState'] = 'none',
): Item {
  return { id, ruleAction, promotionState }
}

const options = {
  ruleAction: (value: Item) => value.ruleAction,
  promotionState: (value: Item) => value.promotionState,
}

describe('planEffectiveUnread', () => {
  it('counts allowed, suspected, and unclassified unread items while filtering hidden or confirmed ones', () => {
    const items = [
      item('allow-hidden', 'allow', 'confirmed'),
      item('hidden', 'hide'),
      item('confirmed', 'none', 'confirmed'),
      item('suspected', 'none', 'suspected'),
      item('visible', 'none'),
    ]

    expect(planEffectiveUnread(items, items.length, options)).toEqual({
      count: 3,
      visibleItems: [items[0], items[3], items[4]],
      filteredItems: [items[1], items[2]],
      complete: true,
    })
  })

  it('uses only the first updateNum items and preserves source order', () => {
    const items = [item('first'), item('second', 'hide'), item('after-boundary', 'hide')]

    expect(planEffectiveUnread(items, 2, options)).toEqual({
      count: 1,
      visibleItems: [items[0]],
      filteredItems: [items[1]],
      complete: true,
    })
  })

  it('returns an empty complete plan when updateNum is zero', () => {
    const items = [item('unread')]

    expect(planEffectiveUnread(items, 0, options)).toEqual({
      count: 0,
      visibleItems: [],
      filteredItems: [],
      complete: true,
    })
  })

  it('fails open with the original unread slice when updateNum is invalid', () => {
    const items = [item('one', 'hide'), item('two', 'hide')]

    expect(planEffectiveUnread(items, 4, options)).toEqual({
      count: 2,
      visibleItems: items,
      filteredItems: [],
      complete: false,
    })
    expect(planEffectiveUnread(items, 1.5, options)).toEqual({
      count: 1,
      visibleItems: [items[0]],
      filteredItems: [],
      complete: false,
    })
    expect(planEffectiveUnread(items, Number.NaN, options)).toEqual({
      count: 0,
      visibleItems: [],
      filteredItems: [],
      complete: false,
    })
    expect(planEffectiveUnread(items, -1, options)).toEqual({
      count: 0,
      visibleItems: [],
      filteredItems: [],
      complete: false,
    })
  })

  it('fails open with the original unread slice when a callback throws', () => {
    const items = [item('one', 'hide'), item('two', 'none')]

    expect(planEffectiveUnread(items, 2, {
      ruleAction: () => {
        throw new Error('rule unavailable')
      },
      promotionState: options.promotionState,
    })).toEqual({
      count: 2,
      visibleItems: items,
      filteredItems: [],
      complete: false,
    })
  })
})
