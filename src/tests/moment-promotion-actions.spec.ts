import type { PromotionClassificationResult } from '~/features/moment-filter/promotion-learning'
import type { MomentFilterCandidate } from '~/features/moment-filter/types'

import { describe, expect, it, vi } from 'vitest'
import {
  createMomentPromotionActionManager,
  MOMENT_PROMOTION_BANNER_CLASS,
  MOMENT_PROMOTION_COLLAPSED_ATTRIBUTE,
  MOMENT_PROMOTION_COLLAPSED_CLASS,
} from '~/features/moment-filter/promotion-actions'

const labels = {
  suspected: '疑似推广',
  confirmed: '已确认推广',
  show: '显示本条',
  hide: '收起本条',
  learn: '加入学习库',
  confirm: '确认学习',
  cancel: '取消',
  noKeywords: '没有可学习的关键词',
  error: '保存失败',
}

const candidate: MomentFilterCandidate = {
  authorUid: '10001',
  authorName: 'Author',
  content: '品牌合作 新品上线 https://shop.example.com/item',
  commercialSignals: [],
}

function result(classification: PromotionClassificationResult['classification'], ...reasons: string[]): PromotionClassificationResult {
  return { classification, reasons }
}

function makeCard(): HTMLElement {
  const card = document.createElement('article')
  card.innerHTML = '<div class="original">Original child</div><button class="host-control">Host control</button>'
  document.body.append(card)
  return card
}

describe('moment promotion actions DOM manager', () => {
  it('formats machine-readable reasons through the supplied localizer', () => {
    const card = makeCard()
    const manager = createMomentPromotionActionManager({
      ...labels,
      formatReason: reason => `本地化：${reason}`,
    })

    manager.ensure(card, candidate, 'fp-localized', result('suspected', 'heuristic feature group: disclosure'))

    expect(card.querySelector('[data-promotion-status]')?.textContent)
      .toContain('本地化：heuristic feature group: disclosure')
  })

  it('injects one direct-child accessible banner and collapses without changing host children', () => {
    const card = makeCard()
    const originalChildren = [...card.children]
    const manager = createMomentPromotionActionManager(labels)

    manager.ensure(card, candidate, 'fp-1', result('confirmed', 'explicit commercial signal'))

    expect(card.querySelectorAll(`:scope > .${MOMENT_PROMOTION_BANNER_CLASS}`)).toHaveLength(1)
    expect([...card.children].filter(child => !child.classList.contains(MOMENT_PROMOTION_BANNER_CLASS))).toEqual(originalChildren)
    expect(card.classList.contains(MOMENT_PROMOTION_COLLAPSED_CLASS)).toBe(true)
    expect(card.getAttribute(MOMENT_PROMOTION_COLLAPSED_ATTRIBUTE)).toBe('true')
    expect(card.getAttribute('style')).toBeNull()
    expect(card.querySelector('[role="status"]')?.textContent).toContain(labels.confirmed)
    expect(card.querySelector<HTMLButtonElement>('[data-promotion-action="toggle"]')?.getAttribute('aria-expanded')).toBe('false')
  })

  it('preserves an expanded state for the same fingerprint and can recollapse it', () => {
    const card = makeCard()
    const manager = createMomentPromotionActionManager(labels)
    manager.ensure(card, candidate, 'fp-1', result('suspected', 'heuristic feature group'))

    const toggle = card.querySelector<HTMLButtonElement>('[data-promotion-action="toggle"]')!
    toggle.click()
    expect(card.classList.contains(MOMENT_PROMOTION_COLLAPSED_CLASS)).toBe(false)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')

    manager.ensure(card, candidate, 'fp-1', result('confirmed', 'updated explanation'))
    expect(card.classList.contains(MOMENT_PROMOTION_COLLAPSED_CLASS)).toBe(false)
    expect(card.querySelector('[role="status"]')?.textContent).toContain('updated explanation')
    expect(card.querySelector(`.${MOMENT_PROMOTION_BANNER_CLASS}`)?.getAttribute('aria-label')).toBe(labels.confirmed)

    card.querySelector<HTMLButtonElement>('[data-promotion-action="toggle"]')!.click()
    expect(card.classList.contains(MOMENT_PROMOTION_COLLAPSED_CLASS)).toBe(true)
    expect(card.getAttribute(MOMENT_PROMOTION_COLLAPSED_ATTRIBUTE)).toBe('true')
  })

  it('rebuilds for a new fingerprint and removes stale UI for none', () => {
    const card = makeCard()
    const manager = createMomentPromotionActionManager(labels)
    manager.ensure(card, candidate, 'fp-1', result('confirmed', 'first'))
    manager.ensure(card, candidate, 'fp-2', result('suspected', 'second'))

    expect(card.querySelectorAll(`:scope > .${MOMENT_PROMOTION_BANNER_CLASS}`)).toHaveLength(1)
    expect(card.querySelector('[role="status"]')?.textContent).toContain(labels.suspected)
    manager.ensure(card, candidate, 'fp-3', result('none'))
    expect(card.querySelector(`:scope > .${MOMENT_PROMOTION_BANNER_CLASS}`)).toBeNull()
    expect(card.classList.contains(MOMENT_PROMOTION_COLLAPSED_CLASS)).toBe(false)
    expect(card.hasAttribute(MOMENT_PROMOTION_COLLAPSED_ATTRIBUTE)).toBe(false)
  })

  it('offers explicit keyword consent only for a numeric author and sends normalized selections', async () => {
    const card = makeCard()
    const onLearn = vi.fn(async (_candidate: MomentFilterCandidate, _keywords: string[]) => undefined)
    const manager = createMomentPromotionActionManager(labels)
    manager.ensure(card, candidate, 'fp-1', result('suspected', 'heuristic'), onLearn)

    const learn = card.querySelector<HTMLButtonElement>('[data-promotion-action="learn"]')!
    expect(learn).toBeTruthy()
    learn.click()
    const panel = card.querySelector<HTMLElement>('[data-promotion-panel]')!
    const checkboxes = [...panel.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')]
    expect(checkboxes.length).toBeGreaterThan(0)
    expect(checkboxes.some(input => input.checked)).toBe(false)
    const confirm = panel.querySelector<HTMLButtonElement>('[data-promotion-action="confirm"]')!
    expect(confirm.disabled).toBe(true)

    checkboxes[0].click()
    expect(confirm.disabled).toBe(false)
    confirm.click()
    await Promise.resolve()
    await Promise.resolve()

    expect(onLearn).toHaveBeenCalledWith(candidate, [checkboxes[0].value.normalize('NFKC').trim().toLowerCase()])
    expect(panel.hidden).toBe(true)
  })

  it('does not render learning controls without numeric author UID or suggestions', () => {
    const noAuthor = makeCard()
    const noKeywords = makeCard()
    const manager = createMomentPromotionActionManager(labels)

    manager.ensure(noAuthor, { ...candidate, authorUid: undefined }, 'no-author', result('suspected'))
    manager.ensure(noKeywords, { ...candidate, content: undefined }, 'no-keywords', result('suspected'))

    expect(noAuthor.querySelector('[data-promotion-action="learn"]')).toBeNull()
    expect(noAuthor.querySelector('[data-promotion-panel]')).toBeNull()
    expect(noKeywords.querySelector('[data-promotion-action="learn"]')).toBeNull()
    expect(noKeywords.querySelector('[data-promotion-panel]')).toBeNull()
  })

  it('stops control clicks, closes learning on Escape, and restores focus to the opener', () => {
    const card = makeCard()
    const manager = createMomentPromotionActionManager(labels)
    manager.ensure(card, candidate, 'fp-1', result('suspected'))
    const hostClick = vi.fn()
    card.addEventListener('click', hostClick)

    const learn = card.querySelector<HTMLButtonElement>('[data-promotion-action="learn"]')!
    learn.click()
    expect(hostClick).not.toHaveBeenCalled()
    const panel = card.querySelector<HTMLElement>('[data-promotion-panel]')!
    expect(panel.hidden).toBe(false)
    expect(learn.getAttribute('aria-expanded')).toBe('true')

    panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(panel.hidden).toBe(true)
    expect(learn.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(learn)
  })

  it('keeps all event listeners scoped to the injected banner', () => {
    const card = makeCard()
    const addDocumentListener = vi.spyOn(document, 'addEventListener')
    const manager = createMomentPromotionActionManager(labels)

    manager.ensure(card, candidate, 'fp-1', result('suspected'))

    expect(addDocumentListener).not.toHaveBeenCalled()
    addDocumentListener.mockRestore()
  })

  it('remove and cleanup restore owned state while preserving host content', () => {
    const first = makeCard()
    const second = makeCard()
    const manager = createMomentPromotionActionManager(labels)
    manager.ensure(first, candidate, 'fp-1', result('confirmed'))
    manager.ensure(second, candidate, 'fp-2', result('suspected'))

    manager.remove(first)
    expect(first.querySelector(`:scope > .${MOMENT_PROMOTION_BANNER_CLASS}`)).toBeNull()
    expect(first.querySelector('.original')).toBeTruthy()
    expect(first.classList.contains(MOMENT_PROMOTION_COLLAPSED_CLASS)).toBe(false)

    manager.cleanup()
    expect(second.querySelector(`:scope > .${MOMENT_PROMOTION_BANNER_CLASS}`)).toBeNull()
    expect(second.querySelector('.original')).toBeTruthy()
    expect(second.hasAttribute(MOMENT_PROMOTION_COLLAPSED_ATTRIBUTE)).toBe(false)
  })
})
