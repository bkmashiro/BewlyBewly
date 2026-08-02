import type { PromotionLearningStorage } from '~/features/moment-filter/promotion-storage'
import type {
  MomentFilterLoadResult,
  MomentFilterSettingsV1,
  MomentFilterStorage,
} from '~/features/moment-filter/types'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  createMomentFilterController,
  MOMENT_FILTERED_ATTRIBUTE,
} from '~/features/moment-filter/controller'
import {
  MOMENT_PROMOTION_COLLAPSED_CLASS,
  MOMENT_PROMOTION_PANEL_CLASS,
} from '~/features/moment-filter/promotion-actions'
import { createEmptyPromotionLearningState } from '~/features/moment-filter/promotion-learning'

function settings(enabled = true): MomentFilterSettingsV1 {
  return {
    schemaVersion: 1,
    enabled,
    mode: 'any',
    rules: [{
      id: 'hide-author',
      enabled: true,
      action: 'hide',
      field: 'authorUid',
      operator: 'equals',
      value: '10001',
      createdAt: 1,
    }],
  }
}

function loadResult(value: MomentFilterSettingsV1): MomentFilterLoadResult {
  return { status: 'loaded', value, issues: [] }
}

function createStorage(initial = settings()) {
  let listener: ((result: MomentFilterLoadResult) => void) | undefined
  const storage: MomentFilterStorage = {
    load: vi.fn(async () => loadResult(initial)),
    save: vi.fn(async input => input as MomentFilterSettingsV1),
    subscribe(callback) {
      listener = callback
      return () => {
        listener = undefined
      }
    },
  }
  return {
    storage,
    emit(value: MomentFilterSettingsV1) {
      listener?.(loadResult(value))
    },
  }
}

function createPromotionStorage(): PromotionLearningStorage {
  const value = createEmptyPromotionLearningState()
  return {
    load: vi.fn(async () => ({ status: 'default' as const, value, issues: [] })),
    save: vi.fn(async input => input),
    subscribe: vi.fn(() => () => {}),
  }
}

function card(uid = '10001', text = 'Fixture text'): HTMLElement {
  const element = document.createElement('div')
  element.className = 'bili-dyn-list__item'
  element.innerHTML = `
    <header><a href="https://space.bilibili.com/${uid}/dynamic"><span class="bili-dyn-title__text">Fixture Author</span></a></header>
    <div class="dyn-card-opus"><div class="dyn-card-opus__summary">${text}</div></div>
  `
  return element
}

function mountFeed(cards: Element[]): Element {
  document.body.innerHTML = '<div class="bili-dyn-home--visitor"><div class="bili-dyn-list__items"></div></div>'
  const list = document.querySelector('.bili-dyn-list__items')!
  list.append(...cards)
  return list
}

async function flushMutations(): Promise<void> {
  await Promise.resolve()
  await new Promise(resolve => setTimeout(resolve, 0))
}

const cleanups: Array<() => void> = []
afterEach(() => {
  cleanups.splice(0).forEach(cleanup => cleanup())
  document.body.innerHTML = ''
  document.head.querySelectorAll('[data-bewly-moment-filter]').forEach(element => element.remove())
})

describe('moment filter controller', () => {
  it('collapses explainable promotions without deleting host content and restores them on cleanup', async () => {
    const promotionCard = card('20002', '品牌合作 新品上线')
    promotionCard.insertAdjacentHTML('beforeend', '<div class="bili-dyn-card-goods">Fixture goods</div>')
    mountFeed([promotionCard])
    const { storage } = createStorage()
    const controller = createMomentFilterController({
      window,
      document,
      storage,
      getHref: () => 'https://t.bilibili.com/',
      promotion: {
        storage: createPromotionStorage(),
        labels: {
          suspected: '疑似推广',
          confirmed: '已确认推广',
          show: '显示本条',
          hide: '收起本条',
          learn: '加入学习库',
          confirm: '确认学习',
          cancel: '取消',
          noKeywords: '没有关键词',
          error: '保存失败',
        },
        onLearn: vi.fn(),
      },
    })
    cleanups.push(controller.cleanup)

    await flushMutations()
    expect(promotionCard.classList.contains(MOMENT_PROMOTION_COLLAPSED_CLASS)).toBe(true)
    expect(promotionCard.querySelector('.bili-dyn-card-goods')).toBeTruthy()
    expect(promotionCard.querySelector('[data-promotion-status]')?.textContent).toContain('已确认推广')
    expect(document.querySelector<HTMLStyleElement>('style[data-bewly-moment-filter]')?.textContent)
      .toContain(`.${MOMENT_PROMOTION_PANEL_CLASS}[hidden]`)

    controller.cleanup()
    expect(promotionCard.classList.contains(MOMENT_PROMOTION_COLLAPSED_CLASS)).toBe(false)
    expect(promotionCard.querySelector('[data-promotion-status]')).toBeNull()
  })

  it('keeps allow rules ahead of promotion collapse', async () => {
    const promotionCard = card('20002', '品牌合作 限时优惠')
    promotionCard.insertAdjacentHTML('beforeend', '<div class="bili-dyn-card-goods">Fixture goods</div>')
    mountFeed([promotionCard])
    const allowed = settings()
    allowed.rules = [{
      id: 'allow-author',
      enabled: true,
      action: 'allow',
      field: 'authorUid',
      operator: 'equals',
      value: '20002',
      createdAt: 2,
    }]
    const controller = createMomentFilterController({
      window,
      document,
      storage: createStorage(allowed).storage,
      getHref: () => 'https://t.bilibili.com/',
      promotion: {
        storage: createPromotionStorage(),
        labels: {
          suspected: '疑似推广',
          confirmed: '已确认推广',
          show: '显示本条',
          hide: '收起本条',
          learn: '加入学习库',
          confirm: '确认学习',
          cancel: '取消',
          noKeywords: '没有关键词',
          error: '保存失败',
        },
        onLearn: vi.fn(),
      },
    })
    cleanups.push(controller.cleanup)

    await flushMutations()
    expect(promotionCard.classList.contains(MOMENT_PROMOTION_COLLAPSED_CLASS)).toBe(false)
    expect(promotionCard.querySelector('[data-promotion-status]')).toBeNull()
  })

  it('re-evaluates a reused card when its data-mid fallback author changes', async () => {
    const reusedCard = document.createElement('div')
    reusedCard.className = 'bili-dyn-list__item'
    reusedCard.innerHTML = `
      <header class="bili-dyn-item__following" data-mid="10001"><span class="bili-dyn-title__text">Fixture Author</span></header>
      <div class="dyn-card-opus"><div class="dyn-card-opus__summary">Fixture text</div></div>
    `
    mountFeed([reusedCard])
    const controller = createMomentFilterController({
      window,
      document,
      storage: createStorage().storage,
      getHref: () => 'https://t.bilibili.com/',
    })
    cleanups.push(controller.cleanup)

    await flushMutations()
    expect(reusedCard.hasAttribute(MOMENT_FILTERED_ATTRIBUTE)).toBe(true)

    reusedCard.querySelector<HTMLElement>('[data-mid]')!.dataset.mid = '20002'
    await flushMutations()
    expect(reusedCard.hasAttribute(MOMENT_FILTERED_ATTRIBUTE)).toBe(false)
  })

  it('scans existing cards, filters inserted cards, and skips unchanged fingerprints', async () => {
    const first = card()
    const list = mountFeed([first])
    const { storage } = createStorage()
    const controller = createMomentFilterController({
      window,
      document,
      storage,
      getHref: () => 'https://t.bilibili.com/',
    })
    cleanups.push(controller.cleanup)

    await flushMutations()
    expect(first.getAttribute(MOMENT_FILTERED_ATTRIBUTE)).toBe('true')
    expect(controller.getStats()).toEqual({ evaluated: 1, hidden: 1 })

    first.setAttribute('data-unrelated', 'unchanged')
    const second = card()
    list.append(second)
    await flushMutations()

    expect(second.getAttribute(MOMENT_FILTERED_ATTRIBUTE)).toBe('true')
    expect(controller.getStats()).toEqual({ evaluated: 2, hidden: 2 })
  })

  it('uses zero feed filtering while disabled and restores its own hidden cards', async () => {
    const first = card()
    const list = mountFeed([first])
    const fake = createStorage()
    const controller = createMomentFilterController({
      window,
      document,
      storage: fake.storage,
      getHref: () => 'https://t.bilibili.com/',
    })
    cleanups.push(controller.cleanup)
    await flushMutations()

    fake.emit(settings(false))
    const second = card()
    list.append(second)
    await flushMutations()

    expect(first.hasAttribute(MOMENT_FILTERED_ATTRIBUTE)).toBe(false)
    expect(second.hasAttribute(MOMENT_FILTERED_ATTRIBUTE)).toBe(false)
    expect(document.querySelector('[data-bewly-moment-filter]')).toBeNull()
  })

  it('rebinds when the feed root is replaced', async () => {
    const first = card()
    const list = mountFeed([first])
    const { storage } = createStorage()
    const controller = createMomentFilterController({
      window,
      document,
      storage,
      getHref: () => 'https://t.bilibili.com/',
    })
    cleanups.push(controller.cleanup)
    await flushMutations()

    const replacement = document.createElement('div')
    replacement.className = 'bili-dyn-list__items'
    const second = card()
    replacement.append(second)
    list.replaceWith(replacement)
    await flushMutations()

    expect(second.getAttribute(MOMENT_FILTERED_ATTRIBUTE)).toBe('true')
  })

  it('reads the current URL on route events and cleans up on page hide', async () => {
    const first = card()
    mountFeed([first])
    const fake = createStorage()
    let href = 'https://t.bilibili.com/'
    const controller = createMomentFilterController({
      window,
      document,
      storage: fake.storage,
      getHref: () => href,
    })
    cleanups.push(controller.cleanup)
    await flushMutations()
    expect(first.getAttribute(MOMENT_FILTERED_ATTRIBUTE)).toBe('true')

    href = 'https://www.bilibili.com/'
    window.dispatchEvent(new CustomEvent('historyChange'))
    expect(first.hasAttribute(MOMENT_FILTERED_ATTRIBUTE)).toBe(false)

    href = 'https://t.bilibili.com/'
    window.dispatchEvent(new CustomEvent('historyChange'))
    await flushMutations()
    expect(first.getAttribute(MOMENT_FILTERED_ATTRIBUTE)).toBe('true')

    window.dispatchEvent(new PageTransitionEvent('pagehide'))
    expect(first.hasAttribute(MOMENT_FILTERED_ATTRIBUTE)).toBe(false)
  })

  it('processes large queues in bounded batches', async () => {
    const cards = Array.from({ length: 500 }, () => card())
    mountFeed(cards)
    const callbacks: Array<() => void> = []
    const { storage } = createStorage()
    const controller = createMomentFilterController({
      window,
      document,
      storage,
      batchSize: 100,
      getHref: () => 'https://t.bilibili.com/',
      schedule: callback => callbacks.push(callback),
    })
    cleanups.push(controller.cleanup)
    await Promise.resolve()

    const startedAt = performance.now()
    let batches = 0
    while (callbacks.length > 0) {
      callbacks.shift()!()
      batches += 1
    }

    const durationMs = performance.now() - startedAt
    expect(batches).toBe(5)
    expect(controller.getStats()).toEqual({ evaluated: 500, hidden: 500 })
    expect(durationMs).toBeLessThan(1000)
  })

  it('stops responding and restores cards after cleanup', async () => {
    const first = card()
    const list = mountFeed([first])
    const { storage } = createStorage()
    const controller = createMomentFilterController({
      window,
      document,
      storage,
      getHref: () => 'https://t.bilibili.com/',
    })
    await flushMutations()
    controller.cleanup()

    const second = card()
    list.append(second)
    await flushMutations()

    expect(first.hasAttribute(MOMENT_FILTERED_ATTRIBUTE)).toBe(false)
    expect(second.hasAttribute(MOMENT_FILTERED_ATTRIBUTE)).toBe(false)
  })
})
