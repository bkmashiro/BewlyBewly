export type EffectiveUnreadRuleAction = 'none' | 'hide' | 'allow'
export type EffectiveUnreadPromotionState = 'none' | 'suspected' | 'confirmed'

export interface EffectiveUnreadOptions<T> {
  ruleAction: (item: T) => EffectiveUnreadRuleAction
  promotionState: (item: T) => EffectiveUnreadPromotionState
}

export interface EffectiveUnreadPlan<T> {
  count: number
  visibleItems: T[]
  filteredItems: T[]
  complete: boolean
}

function originalUnreadItems<T>(items: readonly T[], updateNum: number): T[] {
  if (Number.isNaN(updateNum) || updateNum <= 0)
    return []

  return items.slice(0, Math.trunc(updateNum))
}

function failOpen<T>(items: readonly T[], updateNum: number): EffectiveUnreadPlan<T> {
  const unreadItems = originalUnreadItems(items, updateNum)

  return {
    count: unreadItems.length,
    visibleItems: unreadItems,
    filteredItems: [],
    complete: false,
  }
}

export function planEffectiveUnread<T>(
  items: readonly T[],
  updateNum: number,
  options: EffectiveUnreadOptions<T>,
): EffectiveUnreadPlan<T> {
  const unreadItems = originalUnreadItems(items, updateNum)
  const complete = Number.isInteger(updateNum)
    && updateNum >= 0
    && updateNum <= items.length

  if (!complete) {
    return failOpen(items, updateNum)
  }

  if (updateNum === 0) {
    return {
      count: 0,
      visibleItems: [],
      filteredItems: [],
      complete: true,
    }
  }

  const visibleItems: T[] = []
  const filteredItems: T[] = []

  try {
    for (const item of unreadItems) {
      const action = options.ruleAction(item)
      if (action === 'allow') {
        visibleItems.push(item)
        continue
      }

      if (action === 'hide' || options.promotionState(item) === 'confirmed') {
        filteredItems.push(item)
      }
      else {
        visibleItems.push(item)
      }
    }
  }
  catch {
    return failOpen(items, updateNum)
  }

  return {
    count: visibleItems.length,
    visibleItems,
    filteredItems,
    complete: true,
  }
}
