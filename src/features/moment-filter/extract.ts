import type { MomentFilterCandidate } from './types'
import {
  MOMENT_AUTHOR_LINK_SELECTOR,
  MOMENT_AUTHOR_SELECTOR,
  MOMENT_COMMERCIAL_SIGNAL_SELECTORS,
  MOMENT_CONTENT_SELECTORS,
} from './selectors'

function normalizedText(element: Element | null): string | undefined {
  const value = element?.textContent?.replace(/\s+/g, ' ').trim()
  return value || undefined
}

function extractAuthorUid(card: Element): string | undefined {
  const href = card.querySelector<HTMLAnchorElement>(MOMENT_AUTHOR_LINK_SELECTOR)?.href
  if (!href)
    return undefined

  try {
    const match = new URL(href, 'https://t.bilibili.com').pathname.match(/^\/(\d+)(?:\/|$)/)
    return match?.[1]
  }
  catch {
    return undefined
  }
}

function extractContent(card: Element): string | undefined {
  const parts = MOMENT_CONTENT_SELECTORS
    .flatMap(selector => Array.from(card.querySelectorAll(selector)))
    .map(normalizedText)
    .filter((value): value is string => value !== undefined)
  const uniqueParts = Array.from(new Set(parts))
  return uniqueParts.length > 0 ? uniqueParts.join('\n') : undefined
}

function extractDynamicType(card: Element): string | undefined {
  if (card.querySelector('.bili-dyn-card-video__title'))
    return 'video'
  if (card.querySelector('.bili-dyn-card-link-common__detail__title'))
    return 'link'
  if (card.querySelector('.dyn-card-opus'))
    return 'opus'
  if (card.querySelector('.bili-dyn-forward, .bili-dyn-item__orig'))
    return 'forward'
  return undefined
}

function extractCommercialSignals(card: Element): string[] {
  return Object.entries(MOMENT_COMMERCIAL_SIGNAL_SELECTORS)
    .filter(([, selector]) => card.querySelector(selector) !== null)
    .map(([signal]) => signal)
}

export function extractMomentCandidate(card: Element): MomentFilterCandidate {
  return {
    authorUid: extractAuthorUid(card),
    authorName: normalizedText(card.querySelector(MOMENT_AUTHOR_SELECTOR)),
    content: extractContent(card),
    dynamicType: extractDynamicType(card),
    commercialSignals: extractCommercialSignals(card),
  }
}

export function fingerprintMomentCandidate(candidate: MomentFilterCandidate): string {
  return JSON.stringify([
    candidate.authorUid ?? '',
    candidate.authorName ?? '',
    candidate.content ?? '',
    candidate.dynamicType ?? '',
    candidate.commercialSignals ?? [],
  ])
}
