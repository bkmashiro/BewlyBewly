import type { MomentQuickActionLabels } from './quick-actions'
import type {
  MomentFilterCandidate,
  MomentFilterMatchResult,
  MomentFilterSettingsV1,
  MomentFilterStorage,
  MomentRuleAction,
} from './types'
import { extractMomentCandidate, fingerprintMomentCandidate } from './extract'
import { compileMomentFilter } from './matcher'
import { createMomentQuickActionManager } from './quick-actions'
import {
  MOMENT_CARD_SELECTOR,
  MOMENT_LIST_SELECTOR,
  MOMENT_PAGE_ROOT_SELECTOR,
} from './selectors'

export const MOMENT_FILTER_HIDDEN_CLASS = 'bewly-moment-filter-hidden'
export const MOMENT_FILTERED_ATTRIBUTE = 'data-bewly-moment-filtered'
const HISTORY_CHANGE_EVENT = 'historyChange'
const DEFAULT_BATCH_SIZE = 100

export interface MomentFilterControllerStats {
  evaluated: number
  hidden: number
}

export interface MomentFilterControllerOptions {
  window: Window
  document: Document
  storage: MomentFilterStorage
  batchSize?: number
  schedule?: (callback: () => void) => void
  createObserver?: (callback: MutationCallback) => MutationObserver
  getHref?: () => string
  onDiagnostic?: (message: string) => void
  quickActions?: {
    labels: MomentQuickActionLabels
    onAction: (candidate: MomentFilterCandidate, action: MomentRuleAction) => Promise<void>
  }
}

function asElement(node: Node): Element | null {
  if (node.nodeType === 1)
    return node as Element
  return node.parentElement
}

function containsSelector(node: Node, selector: string): boolean {
  const element = asElement(node)
  return element?.matches(selector) === true || element?.querySelector(selector) !== null
}

function isMomentLocation(href: string): boolean {
  try {
    return new URL(href).origin === 'https://t.bilibili.com'
  }
  catch {
    return false
  }
}

function defaultSchedule(window: Window, callback: () => void): void {
  const idleWindow = window as Window & {
    requestIdleCallback?: (callback: () => void, options: { timeout: number }) => number
  }
  if (typeof idleWindow.requestIdleCallback === 'function') {
    idleWindow.requestIdleCallback(callback, { timeout: 100 })
    return
  }
  window.queueMicrotask(callback)
}

export function createMomentFilterController(options: MomentFilterControllerOptions) {
  const {
    document,
    storage,
    window,
    batchSize = DEFAULT_BATCH_SIZE,
    schedule = callback => defaultSchedule(window, callback),
    createObserver = callback => new MutationObserver(callback),
    getHref = () => window.location.href,
    onDiagnostic = () => {},
  } = options
  const quickActionManager = options.quickActions
    ? createMomentQuickActionManager(options.quickActions.labels, options.quickActions.onAction)
    : undefined

  let disposed = false
  let active = false
  let batchScheduled = false
  let diagnosedMissingList = false
  let settings: MomentFilterSettingsV1 | undefined
  let match = (_candidate: ReturnType<typeof extractMomentCandidate>): MomentFilterMatchResult => ({
    action: 'none',
    matchedRuleIds: [],
  })
  let seenFingerprints = new WeakMap<Element, string>()
  let feedRoot: Element | null = null
  let feedObserver: MutationObserver | undefined
  let rootObserver: MutationObserver | undefined
  let styleElement: HTMLStyleElement | undefined
  const pendingCards = new Set<Element>()
  const hiddenCards = new Set<Element>()
  let evaluated = 0

  function restoreCard(card: Element): void {
    card.classList.remove(MOMENT_FILTER_HIDDEN_CLASS)
    card.removeAttribute(MOMENT_FILTERED_ATTRIBUTE)
    hiddenCards.delete(card)
  }

  function applyResult(card: Element, result: MomentFilterMatchResult): void {
    if (result.action === 'hide') {
      card.classList.add(MOMENT_FILTER_HIDDEN_CLASS)
      card.setAttribute(MOMENT_FILTERED_ATTRIBUTE, 'true')
      hiddenCards.add(card)
      return
    }
    restoreCard(card)
  }

  function processBatch(): void {
    batchScheduled = false
    if (!active || disposed) {
      pendingCards.clear()
      return
    }

    const cards = Array.from(pendingCards).slice(0, batchSize)
    cards.forEach(card => pendingCards.delete(card))
    for (const card of cards) {
      if (!card.isConnected)
        continue
      const candidate = extractMomentCandidate(card)
      const fingerprint = fingerprintMomentCandidate(candidate)
      if (seenFingerprints.get(card) === fingerprint)
        continue
      seenFingerprints.set(card, fingerprint)
      quickActionManager?.ensure(card, candidate, fingerprint)
      evaluated += 1
      applyResult(card, match(candidate))
    }

    if (pendingCards.size > 0)
      scheduleBatch()
  }

  function scheduleBatch(): void {
    if (batchScheduled || !active || disposed)
      return
    batchScheduled = true
    schedule(processBatch)
  }

  function queueCard(card: Element | null): void {
    if (!card || !active)
      return
    pendingCards.add(card)
    scheduleBatch()
  }

  function queueCardsFromNode(node: Node): void {
    const element = asElement(node)
    if (!element)
      return
    queueCard(element.closest(MOMENT_CARD_SELECTOR))
    if (element.matches(MOMENT_CARD_SELECTOR))
      queueCard(element)
    element.querySelectorAll(MOMENT_CARD_SELECTOR).forEach(queueCard)
  }

  function handleFeedMutations(mutations: MutationRecord[]): void {
    for (const mutation of mutations) {
      queueCard(asElement(mutation.target)?.closest(MOMENT_CARD_SELECTOR) ?? null)
      mutation.addedNodes.forEach(queueCardsFromNode)
    }
  }

  function bindFeedRoot(): void {
    if (!active || !document.body)
      return
    const nextRoot = document.querySelector(MOMENT_LIST_SELECTOR)
    if (nextRoot === feedRoot && nextRoot?.isConnected)
      return

    feedObserver?.disconnect()
    feedObserver = undefined
    feedRoot = nextRoot

    if (!feedRoot) {
      if (!diagnosedMissingList && document.readyState !== 'loading' && document.querySelector(MOMENT_PAGE_ROOT_SELECTOR)) {
        diagnosedMissingList = true
        onDiagnostic('Moment feed list was not found; filtering remains fail-open.')
      }
      return
    }

    feedObserver = createObserver(handleFeedMutations)
    feedObserver.observe(feedRoot, {
      attributes: true,
      attributeFilter: ['aria-label', 'class', 'data-dyn-card-type', 'href'],
      characterData: true,
      childList: true,
      subtree: true,
    })
    feedRoot.querySelectorAll(MOMENT_CARD_SELECTOR).forEach(queueCard)
  }

  function handleRootMutations(mutations: MutationRecord[]): void {
    if (!feedRoot?.isConnected) {
      bindFeedRoot()
      return
    }

    for (const mutation of mutations) {
      const changedRoot = Array.from(mutation.addedNodes).some(node => containsSelector(node, MOMENT_PAGE_ROOT_SELECTOR))
        || Array.from(mutation.removedNodes).some(node => containsSelector(node, MOMENT_PAGE_ROOT_SELECTOR))
      if (changedRoot) {
        bindFeedRoot()
        return
      }
    }
  }

  function ensureDomBinding(): void {
    if (!active || !document.body)
      return
    if (!styleElement) {
      styleElement = document.createElement('style')
      styleElement.dataset.bewlyMomentFilter = 'true'
      styleElement.textContent = `
        .${MOMENT_FILTER_HIDDEN_CLASS} { display: none !important; }
        .bewly-moment-filter-quick-action {
          position: relative; display: inline-flex; margin-inline-start: 8px; vertical-align: middle;
        }
        .bewly-moment-filter-quick-action__trigger,
        .bewly-moment-filter-quick-menu button {
          border: 0; border-radius: 6px; color: inherit;
          background: rgba(127, 127, 127, 0.14); cursor: pointer; font: inherit;
        }
        .bewly-moment-filter-quick-action__trigger { width: 24px; height: 24px; opacity: 0.55; }
        .bewly-moment-filter-quick-action__trigger:hover,
        .bewly-moment-filter-quick-action__trigger:focus-visible {
          opacity: 1; outline: 2px solid currentColor; outline-offset: 2px;
        }
        .bewly-moment-filter-quick-menu {
          position: absolute; z-index: 1000; top: calc(100% + 4px); left: 0;
          display: flex; min-width: 150px; padding: 6px; gap: 4px; flex-direction: column;
          border-radius: 8px; background: var(--bg1, #fff); box-shadow: 0 6px 24px rgba(0, 0, 0, 0.2);
        }
        .bewly-moment-filter-quick-menu[hidden] { display: none !important; }
        .bewly-moment-filter-quick-menu button { padding: 6px 8px; white-space: nowrap; }
        .bewly-moment-filter-quick-menu button:focus-visible {
          outline: 2px solid currentColor; outline-offset: 1px;
        }
      `
      ;(document.head ?? document.documentElement).append(styleElement)
    }
    if (!rootObserver) {
      rootObserver = createObserver(handleRootMutations)
      rootObserver.observe(document.body, { childList: true, subtree: true })
    }
    bindFeedRoot()
  }

  function restoreAllCards(): void {
    hiddenCards.forEach(restoreCard)
    hiddenCards.clear()
  }

  function deactivate(): void {
    active = false
    feedObserver?.disconnect()
    rootObserver?.disconnect()
    feedObserver = undefined
    rootObserver = undefined
    feedRoot = null
    pendingCards.clear()
    batchScheduled = false
    seenFingerprints = new WeakMap<Element, string>()
    quickActionManager?.cleanup()
    restoreAllCards()
    styleElement?.remove()
    styleElement = undefined
  }

  function shouldRun(): boolean {
    return settings?.enabled === true
      && window.top === window
      && isMomentLocation(getHref())
  }

  function reconfigure(): void {
    if (disposed)
      return
    if (!shouldRun()) {
      deactivate()
      return
    }
    active = true
    ensureDomBinding()
  }

  function applySettings(nextSettings: MomentFilterSettingsV1): void {
    settings = nextSettings
    match = compileMomentFilter(nextSettings)
    seenFingerprints = new WeakMap<Element, string>()
    reconfigure()
    if (active)
      feedRoot?.querySelectorAll(MOMENT_CARD_SELECTOR).forEach(queueCard)
  }

  const handleLocationChange = () => reconfigure()
  const handlePageShow = () => reconfigure()
  const handlePageHide = () => deactivate()
  const handleDomReady = () => reconfigure()

  window.addEventListener(HISTORY_CHANGE_EVENT, handleLocationChange)
  window.addEventListener('popstate', handleLocationChange)
  window.addEventListener('hashchange', handleLocationChange)
  window.addEventListener('pageshow', handlePageShow)
  window.addEventListener('pagehide', handlePageHide)
  document.addEventListener('DOMContentLoaded', handleDomReady)

  const unsubscribe = storage.subscribe(result => applySettings(result.value))
  void storage.load().then((result) => {
    if (!disposed)
      applySettings(result.value)
  })

  return {
    getStats(): MomentFilterControllerStats {
      return { evaluated, hidden: hiddenCards.size }
    },
    cleanup(): void {
      if (disposed)
        return
      disposed = true
      unsubscribe()
      deactivate()
      window.removeEventListener(HISTORY_CHANGE_EVENT, handleLocationChange)
      window.removeEventListener('popstate', handleLocationChange)
      window.removeEventListener('hashchange', handleLocationChange)
      window.removeEventListener('pageshow', handlePageShow)
      window.removeEventListener('pagehide', handlePageHide)
      document.removeEventListener('DOMContentLoaded', handleDomReady)
    },
  }
}
