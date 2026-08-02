import { describe, expect, it, vi } from 'vitest'

import {
  createMomentQuickActionManager,
  MOMENT_QUICK_ACTION_CLASS,
} from '~/features/moment-filter/quick-actions'

const labels = {
  allow: 'Allow author',
  error: 'Save failed',
  hide: 'Hide author',
  open: 'Open author actions',
}

describe('moment quick actions', () => {
  it('injects one accessible menu and runs the selected action', async () => {
    document.body.innerHTML = '<article class="bili-dyn-list__item"><header class="bili-dyn-item__header"></header></article>'
    const card = document.querySelector('article')!
    const onAction = vi.fn(async () => {})
    const manager = createMomentQuickActionManager(labels, onAction)
    const candidate = { authorUid: '12345', authorName: 'Fixture Author', commercialSignals: [] }

    manager.ensure(card, candidate, 'first')
    manager.ensure(card, candidate, 'first')

    const trigger = card.querySelector<HTMLButtonElement>(`.${MOMENT_QUICK_ACTION_CLASS}__trigger`)!
    expect(trigger.getAttribute('aria-label')).toBe(labels.open)
    expect(card.querySelectorAll(`.${MOMENT_QUICK_ACTION_CLASS}`)).toHaveLength(1)

    trigger.click()
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    const hideButton = card.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')[0]
    hideButton.click()
    await Promise.resolve()

    expect(onAction).toHaveBeenCalledWith(candidate, 'hide')
    manager.cleanup()
    expect(card.querySelector(`.${MOMENT_QUICK_ACTION_CLASS}`)).toBeNull()
  })

  it('rebinds recycled cards to the latest candidate', async () => {
    document.body.innerHTML = '<article><header class="bili-dyn-item__header"></header></article>'
    const card = document.querySelector('article')!
    const onAction = vi.fn(async () => {})
    const manager = createMomentQuickActionManager(labels, onAction)
    const first = { authorUid: '1', commercialSignals: [] }
    const second = { authorUid: '2', commercialSignals: [] }

    manager.ensure(card, first, 'first')
    manager.ensure(card, second, 'second')
    card.querySelector<HTMLButtonElement>(`.${MOMENT_QUICK_ACTION_CLASS}__trigger`)!.click()
    card.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')[1].click()
    await Promise.resolve()

    expect(onAction).toHaveBeenCalledWith(second, 'allow')
    manager.cleanup()
  })
})
