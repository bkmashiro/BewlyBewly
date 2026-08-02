import type { MomentFilterCandidate, MomentRuleAction } from './types'

export const MOMENT_QUICK_ACTION_CLASS = 'bewly-moment-filter-quick-action'
export const MOMENT_QUICK_MENU_CLASS = 'bewly-moment-filter-quick-menu'

export interface MomentQuickActionLabels {
  allow: string
  error: string
  hide: string
  open: string
}

export interface MomentQuickActionManager {
  cleanup: () => void
  ensure: (card: Element, candidate: MomentFilterCandidate, fingerprint: string) => void
}

export function createMomentQuickActionManager(
  labels: MomentQuickActionLabels,
  onAction: (candidate: MomentFilterCandidate, action: MomentRuleAction) => Promise<void>,
): MomentQuickActionManager {
  const cleanups = new Map<Element, () => void>()

  function remove(card: Element): void {
    cleanups.get(card)?.()
    cleanups.delete(card)
  }

  function ensure(card: Element, candidate: MomentFilterCandidate, fingerprint: string): void {
    const authorValue = candidate.authorUid ?? candidate.authorName
    if (!authorValue) {
      remove(card)
      return
    }

    const existing = card.querySelector<HTMLElement>(`.${MOMENT_QUICK_ACTION_CLASS}`)
    if (existing?.dataset.fingerprint === fingerprint)
      return
    remove(card)

    const header = card.querySelector<HTMLElement>('.bili-dyn-item__header')
    if (!header)
      return

    const wrapper = document.createElement('span')
    wrapper.className = MOMENT_QUICK_ACTION_CLASS
    wrapper.dataset.fingerprint = fingerprint

    const trigger = document.createElement('button')
    trigger.type = 'button'
    trigger.className = `${MOMENT_QUICK_ACTION_CLASS}__trigger`
    trigger.setAttribute('aria-label', labels.open)
    trigger.setAttribute('aria-expanded', 'false')
    trigger.textContent = '⏷'

    const menu = document.createElement('span')
    menu.className = MOMENT_QUICK_MENU_CLASS
    menu.setAttribute('role', 'menu')
    menu.hidden = true

    const hideButton = document.createElement('button')
    hideButton.type = 'button'
    hideButton.setAttribute('role', 'menuitem')
    hideButton.textContent = labels.hide

    const allowButton = document.createElement('button')
    allowButton.type = 'button'
    allowButton.setAttribute('role', 'menuitem')
    allowButton.textContent = labels.allow

    menu.append(hideButton, allowButton)
    wrapper.append(trigger, menu)
    header.append(wrapper)

    let disposed = false
    const close = (): void => {
      menu.hidden = true
      trigger.setAttribute('aria-expanded', 'false')
    }
    const handleDocumentClick = (event: MouseEvent): void => {
      if (!wrapper.contains(event.target as Node))
        close()
    }
    const handleKeydown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        close()
        trigger.focus()
      }
    }
    const runAction = async (action: MomentRuleAction): Promise<void> => {
      hideButton.disabled = true
      allowButton.disabled = true
      try {
        await onAction(candidate, action)
        close()
      }
      catch {
        trigger.title = labels.error
      }
      finally {
        hideButton.disabled = false
        allowButton.disabled = false
      }
    }

    trigger.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      menu.hidden = !menu.hidden
      trigger.setAttribute('aria-expanded', String(!menu.hidden))
      if (!menu.hidden)
        hideButton.focus()
    })
    hideButton.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      void runAction('hide')
    })
    allowButton.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      void runAction('allow')
    })
    document.addEventListener('click', handleDocumentClick)
    wrapper.addEventListener('keydown', handleKeydown)

    cleanups.set(card, () => {
      if (disposed)
        return
      disposed = true
      document.removeEventListener('click', handleDocumentClick)
      wrapper.removeEventListener('keydown', handleKeydown)
      wrapper.remove()
    })
  }

  return {
    ensure,
    cleanup: () => {
      cleanups.forEach(cleanup => cleanup())
      cleanups.clear()
    },
  }
}
