import type { PromotionClassificationResult } from './promotion-learning'
import type { MomentFilterCandidate } from './types'
import {
  normalizePromotionKeywords,
  suggestPromotionKeywords,
} from './promotion-learning'

export const MOMENT_PROMOTION_ACTIONS_CLASS = 'bewly-moment-promotion-actions'
export const MOMENT_PROMOTION_BANNER_CLASS = `${MOMENT_PROMOTION_ACTIONS_CLASS}__banner`
export const MOMENT_PROMOTION_PANEL_CLASS = `${MOMENT_PROMOTION_ACTIONS_CLASS}__panel`
export const MOMENT_PROMOTION_COLLAPSED_CLASS = 'bewly-moment-promotion-collapsed'
export const MOMENT_PROMOTION_COLLAPSED_ATTRIBUTE = 'data-bewly-moment-promotion-collapsed'

// Short aliases keep the DOM contract easy to consume from a controller or stylesheet.
export const PROMOTION_ACTIONS_CLASS = MOMENT_PROMOTION_ACTIONS_CLASS
export const PROMOTION_BANNER_CLASS = MOMENT_PROMOTION_BANNER_CLASS
export const PROMOTION_PANEL_CLASS = MOMENT_PROMOTION_PANEL_CLASS
export const PROMOTION_COLLAPSED_CLASS = MOMENT_PROMOTION_COLLAPSED_CLASS
export const PROMOTION_COLLAPSED_ATTRIBUTE = MOMENT_PROMOTION_COLLAPSED_ATTRIBUTE

export interface MomentPromotionActionLabels {
  suspected: string
  confirmed: string
  show: string
  hide: string
  learn: string
  confirm: string
  cancel: string
  noKeywords: string
  error: string
  formatReason?: (reason: string) => string
}

export type PromotionLearnCallback = (
  candidate: MomentFilterCandidate,
  keywords: string[],
) => void | Promise<void>

export interface MomentPromotionActionManager {
  ensure: (
    card: Element,
    candidate: MomentFilterCandidate,
    fingerprint: string,
    result: PromotionClassificationResult,
    onLearn?: PromotionLearnCallback,
  ) => void
  remove: (card: Element) => void
  cleanup: () => void
}

interface BannerEntry {
  card: Element
  banner: HTMLElement
  candidate: MomentFilterCandidate
  result: PromotionClassificationResult
  fingerprint: string
  onLearn?: PromotionLearnCallback
  expanded: boolean
  restoreClass: boolean
  restoreAttribute: string | null
  dispose: () => void
}

function isNumericAuthorUid(authorUid: string | undefined): boolean {
  return typeof authorUid === 'string' && /^\d+$/u.test(authorUid.trim())
}

function stopControl(event: Event, preventDefault = false): void {
  if (preventDefault)
    event.preventDefault()
  event.stopPropagation()
}

function updateStatus(
  status: HTMLElement,
  result: PromotionClassificationResult,
  labels: MomentPromotionActionLabels,
): void {
  const label = result.classification === 'confirmed' ? labels.confirmed : labels.suspected
  const reasons = result.reasons
    .filter(reason => reason.trim())
    .map(reason => labels.formatReason?.(reason) ?? reason)
    .join(' · ')
  status.textContent = reasons ? `${label}: ${reasons}` : label
}

function restoreOwnedState(entry: BannerEntry): void {
  if (entry.restoreClass)
    entry.card.classList.add(MOMENT_PROMOTION_COLLAPSED_CLASS)
  else
    entry.card.classList.remove(MOMENT_PROMOTION_COLLAPSED_CLASS)

  if (entry.restoreAttribute === null)
    entry.card.removeAttribute(MOMENT_PROMOTION_COLLAPSED_ATTRIBUTE)
  else
    entry.card.setAttribute(MOMENT_PROMOTION_COLLAPSED_ATTRIBUTE, entry.restoreAttribute)
}

export function createMomentPromotionActionManager(
  labels: MomentPromotionActionLabels,
  defaultOnLearn?: PromotionLearnCallback,
): MomentPromotionActionManager {
  const entries = new Map<Element, BannerEntry>()

  function setCollapsed(entry: BannerEntry, collapsed: boolean): void {
    entry.expanded = !collapsed
    if (collapsed) {
      entry.card.classList.add(MOMENT_PROMOTION_COLLAPSED_CLASS)
      entry.card.setAttribute(MOMENT_PROMOTION_COLLAPSED_ATTRIBUTE, 'true')
    }
    else {
      entry.card.classList.remove(MOMENT_PROMOTION_COLLAPSED_CLASS)
      entry.card.removeAttribute(MOMENT_PROMOTION_COLLAPSED_ATTRIBUTE)
    }

    const toggle = entry.banner.querySelector<HTMLButtonElement>('[data-promotion-action="toggle"]')
    if (!toggle)
      return
    toggle.textContent = collapsed ? labels.show : labels.hide
    toggle.setAttribute('aria-expanded', String(!collapsed))
  }

  function remove(card: Element): void {
    const entry = entries.get(card)
    if (!entry)
      return
    entry.dispose()
    entry.banner.remove()
    restoreOwnedState(entry)
    entries.delete(card)
  }

  function ensure(
    card: Element,
    candidate: MomentFilterCandidate,
    fingerprint: string,
    result: PromotionClassificationResult,
    onLearn?: PromotionLearnCallback,
  ): void {
    if (result.classification === 'none') {
      remove(card)
      return
    }

    const existing = entries.get(card)
    if (existing?.fingerprint === fingerprint) {
      existing.candidate = candidate
      existing.result = result
      existing.onLearn = onLearn ?? defaultOnLearn
      existing.banner.setAttribute(
        'aria-label',
        result.classification === 'confirmed' ? labels.confirmed : labels.suspected,
      )
      const status = existing.banner.querySelector<HTMLElement>('[data-promotion-status]')
      if (status)
        updateStatus(status, result, labels)
      return
    }
    if (existing)
      remove(card)

    const ownerDocument = card.ownerDocument
    const banner = ownerDocument.createElement('div')
    banner.className = `${MOMENT_PROMOTION_ACTIONS_CLASS} ${MOMENT_PROMOTION_BANNER_CLASS}`
    banner.setAttribute('role', 'group')
    banner.setAttribute('aria-label', result.classification === 'confirmed' ? labels.confirmed : labels.suspected)
    banner.dataset.fingerprint = fingerprint

    const status = ownerDocument.createElement('span')
    status.dataset.promotionStatus = 'true'
    status.setAttribute('role', 'status')
    status.setAttribute('aria-live', 'polite')
    updateStatus(status, result, labels)

    const toggle = ownerDocument.createElement('button')
    toggle.type = 'button'
    toggle.dataset.promotionAction = 'toggle'
    toggle.setAttribute('aria-expanded', 'false')
    toggle.textContent = labels.show

    const entry: BannerEntry = {
      banner,
      card,
      candidate,
      dispose: () => {},
      expanded: false,
      fingerprint,
      onLearn: onLearn ?? defaultOnLearn,
      restoreAttribute: card.getAttribute(MOMENT_PROMOTION_COLLAPSED_ATTRIBUTE),
      restoreClass: card.classList.contains(MOMENT_PROMOTION_COLLAPSED_CLASS),
      result,
    }

    const controls: HTMLElement[] = [toggle]
    const panel = ownerDocument.createElement('div')
    panel.className = MOMENT_PROMOTION_PANEL_CLASS
    panel.dataset.promotionPanel = 'true'
    panel.setAttribute('role', 'dialog')
    panel.setAttribute('aria-hidden', 'true')
    panel.hidden = true

    const keywords = isNumericAuthorUid(candidate.authorUid)
      ? normalizePromotionKeywords(suggestPromotionKeywords(candidate))
      : []

    let learnButton: HTMLButtonElement | undefined
    let checkboxes: HTMLInputElement[] = []
    let confirmButton: HTMLButtonElement | undefined
    const error = ownerDocument.createElement('span')
    error.dataset.promotionError = 'true'
    error.setAttribute('role', 'alert')
    error.hidden = true

    const closePanel = (restoreFocus: boolean): void => {
      panel.hidden = true
      panel.setAttribute('aria-hidden', 'true')
      learnButton?.setAttribute('aria-expanded', 'false')
      if (restoreFocus)
        learnButton?.focus()
    }

    if (keywords.length > 0) {
      learnButton = ownerDocument.createElement('button')
      learnButton.type = 'button'
      learnButton.dataset.promotionAction = 'learn'
      learnButton.setAttribute('aria-expanded', 'false')
      learnButton.textContent = labels.learn
      controls.push(learnButton)

      const panelTitle = ownerDocument.createElement('div')
      panelTitle.textContent = labels.learn
      panel.append(panelTitle)

      const chipList = ownerDocument.createElement('div')
      chipList.setAttribute('role', 'group')
      chipList.setAttribute('aria-label', labels.learn)
      checkboxes = keywords.map((keyword) => {
        const label = ownerDocument.createElement('label')
        label.className = `${MOMENT_PROMOTION_PANEL_CLASS}__chip`
        label.addEventListener('click', event => stopControl(event))
        const checkbox = ownerDocument.createElement('input')
        checkbox.type = 'checkbox'
        checkbox.value = keyword
        checkbox.checked = false
        checkbox.addEventListener('click', event => stopControl(event))
        checkbox.addEventListener('change', event => stopControl(event))
        label.append(checkbox, ownerDocument.createTextNode(keyword))
        chipList.append(label)
        return checkbox
      })

      confirmButton = ownerDocument.createElement('button')
      confirmButton.type = 'button'
      confirmButton.dataset.promotionAction = 'confirm'
      confirmButton.textContent = labels.confirm
      confirmButton.disabled = true
      const cancelButton = ownerDocument.createElement('button')
      cancelButton.type = 'button'
      cancelButton.dataset.promotionAction = 'cancel'
      cancelButton.textContent = labels.cancel
      panel.append(chipList, error, confirmButton, cancelButton)
      controls.push(confirmButton, cancelButton)

      const updateConfirmState = (): void => {
        if (confirmButton)
          confirmButton.disabled = !checkboxes.some(checkbox => checkbox.checked)
      }
      checkboxes.forEach(checkbox => checkbox.addEventListener('change', updateConfirmState))

      learnButton.addEventListener('click', (event) => {
        stopControl(event, true)
        checkboxes.forEach((checkbox) => {
          checkbox.checked = false
        })
        updateConfirmState()
        error.hidden = true
        panel.hidden = false
        panel.setAttribute('aria-hidden', 'false')
        learnButton?.setAttribute('aria-expanded', 'true')
        checkboxes[0]?.focus()
      })
      cancelButton.addEventListener('click', (event) => {
        stopControl(event, true)
        closePanel(true)
      })
      confirmButton.addEventListener('click', async (event) => {
        stopControl(event, true)
        const callback = entry.onLearn
        if (!callback)
          return
        const selected = normalizePromotionKeywords(
          checkboxes.filter(checkbox => checkbox.checked).map(checkbox => checkbox.value),
        )
        if (selected.length === 0)
          return
        confirmButton!.disabled = true
        error.hidden = true
        try {
          await callback(entry.candidate, selected)
          closePanel(false)
        }
        catch {
          error.textContent = labels.error
          error.hidden = false
        }
        finally {
          updateConfirmState()
        }
      })
      panel.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape')
          return
        stopControl(event, true)
        closePanel(true)
      })
    }

    controls.forEach((control) => {
      if (control === learnButton || control === confirmButton)
        return
      control.addEventListener('click', event => stopControl(event, true))
    })
    toggle.addEventListener('click', (event) => {
      stopControl(event, true)
      setCollapsed(entry, entry.expanded)
    })

    banner.append(status, toggle)
    if (learnButton)
      banner.append(learnButton, panel)
    card.append(banner)
    entries.set(card, entry)
    setCollapsed(entry, true)

    entry.dispose = () => {
      controls.forEach((control) => {
        control.replaceWith(control.cloneNode(true))
      })
      panel.remove()
    }
  }

  return { ensure, remove, cleanup: () => entries.forEach((_entry, card) => remove(card)) }
}

export const createPromotionActionsManager = createMomentPromotionActionManager
export type PromotionActionLabels = MomentPromotionActionLabels
export type PromotionActionsManager = MomentPromotionActionManager
