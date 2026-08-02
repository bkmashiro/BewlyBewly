import type { MomentFilterCandidate } from './types'
import {
  MOMENT_AUTHOR_LINK_SELECTOR,
  MOMENT_AUTHOR_SELECTOR,
  MOMENT_AUTHOR_UID_FALLBACK_SELECTOR,
  MOMENT_COMMERCIAL_SIGNAL_SELECTORS,
  MOMENT_CONTENT_SELECTORS,
  MOMENT_FORWARD_SELECTOR,
} from './selectors'

function normalizedText(element: Element | null): string | undefined {
  const value = element?.textContent?.replace(/\s+/g, ' ').trim()
  return value || undefined
}

function extractAuthorUid(card: Element): string | undefined {
  const href = card.querySelector<HTMLAnchorElement>(MOMENT_AUTHOR_LINK_SELECTOR)?.href
  if (href) {
    try {
      const match = new URL(href, 'https://t.bilibili.com').pathname.match(/^\/(\d+)(?:\/|$)/)
      if (match?.[1])
        return match[1]
    }
    catch {
      // Fall through to the data-mid marker used by the current page.
    }
  }

  const fallback = card.querySelector(MOMENT_AUTHOR_UID_FALLBACK_SELECTOR)?.getAttribute('data-mid')?.trim()
  return fallback && /^\d+$/.test(fallback) ? fallback : undefined
}

function extractContent(card: Element): string | undefined {
  const [origSelector, ...structuredSelectors] = MOMENT_CONTENT_SELECTORS
  const origParts = Array.from(card.querySelectorAll(origSelector))
    .map((element) => {
      const clone = element.cloneNode(true) as Element
      if (structuredSelectors.length > 0)
        clone.querySelectorAll(structuredSelectors.join(',')).forEach(child => child.remove())
      return normalizedText(clone)
    })
  const structuredParts = structuredSelectors
    .flatMap(selector => Array.from(card.querySelectorAll(selector)))
    .map(normalizedText)
  const parts = [...origParts, ...structuredParts]
    .filter((value): value is string => value !== undefined)
  const uniqueParts = Array.from(new Set(parts))
  return uniqueParts.length > 0 ? uniqueParts.join('\n') : undefined
}

function extractDynamicType(card: Element): string | undefined {
  if (card.querySelector(MOMENT_FORWARD_SELECTOR))
    return 'forward'
  if (card.querySelector('.bili-dyn-card-video__title'))
    return 'video'
  if (card.querySelector('.bili-dyn-card-link-common__detail__title'))
    return 'link'
  if (card.querySelector('.dyn-card-opus'))
    return 'opus'
  return undefined
}

function extractCommercialSignals(card: Element): string[] {
  return Object.entries(MOMENT_COMMERCIAL_SIGNAL_SELECTORS)
    .filter(([, selector]) => card.querySelector(selector) !== null)
    .map(([signal]) => signal)
}

function extractDomains(card: Element): string[] {
  const domains = Array.from(card.querySelectorAll<HTMLAnchorElement>('a[href]'))
    .flatMap((anchor) => {
      try {
        const url = new URL(anchor.href, 'https://t.bilibili.com')
        if (url.protocol !== 'http:' && url.protocol !== 'https:')
          return []
        const hostname = url.hostname.toLowerCase().replace(/^www\./u, '')
        if (hostname === 'bilibili.com' || hostname === 'space.bilibili.com' || hostname === 't.bilibili.com' || hostname === 'b23.tv')
          return []
        return [hostname]
      }
      catch {
        return []
      }
    })
    .filter(Boolean)
  return Array.from(new Set(domains))
}

export function extractMomentCandidate(card: Element): MomentFilterCandidate {
  const domains = extractDomains(card)
  return {
    authorUid: extractAuthorUid(card),
    authorName: normalizedText(card.querySelector(MOMENT_AUTHOR_SELECTOR)),
    content: extractContent(card),
    dynamicType: extractDynamicType(card),
    ...(domains.length > 0 ? { domains } : {}),
    commercialSignals: extractCommercialSignals(card),
  }
}

export function fingerprintMomentCandidate(candidate: MomentFilterCandidate): string {
  return JSON.stringify([
    candidate.authorUid ?? '',
    candidate.authorName ?? '',
    candidate.content ?? '',
    candidate.dynamicType ?? '',
    candidate.domains ?? [],
    candidate.commercialSignals ?? [],
  ])
}
