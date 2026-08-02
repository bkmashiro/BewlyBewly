import type { MomentFilterCandidate } from './types'

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

function text(value: unknown): string | undefined {
  if (typeof value !== 'string')
    return undefined
  const normalized = value.replace(/\s+/gu, ' ').trim()
  return normalized || undefined
}

function numericUid(value: unknown): string | undefined {
  if (typeof value !== 'string' && typeof value !== 'number')
    return undefined
  const normalized = String(value).trim()
  return /^\d+$/u.test(normalized) ? normalized : undefined
}

function normalizedDomain(value: unknown): string | undefined {
  if (typeof value !== 'string')
    return undefined
  try {
    const url = new URL(value, 'https://t.bilibili.com')
    if (url.protocol !== 'http:' && url.protocol !== 'https:')
      return undefined
    const hostname = url.hostname.toLowerCase().replace(/^www\./u, '')
    if (hostname === 'bilibili.com' || hostname === 'space.bilibili.com' || hostname === 't.bilibili.com' || hostname === 'b23.tv')
      return undefined
    return hostname
  }
  catch {
    return undefined
  }
}

function collectMajorParts(major: Record<string, unknown> | undefined): { content: string[], domains: string[] } {
  const content: string[] = []
  const domains: string[] = []
  if (!major)
    return { content, domains }

  for (const key of ['archive', 'opus', 'article', 'common', 'pgc']) {
    const part = asRecord(major[key])
    if (!part)
      continue
    for (const field of ['title', 'desc']) {
      const value = text(part[field])
      if (value)
        content.push(value)
    }
    const summary = asRecord(part.summary)
    const summaryText = text(summary?.text)
    if (summaryText)
      content.push(summaryText)
    for (const field of ['jump_url', 'url']) {
      const domain = normalizedDomain(part[field])
      if (domain)
        domains.push(domain)
    }
  }

  return { content, domains }
}

export function extractApiMomentCandidate(input: unknown): MomentFilterCandidate {
  const item = asRecord(input)
  const modules = asRecord(item?.modules)
  const author = asRecord(modules?.module_author)
  const dynamic = asRecord(modules?.module_dynamic)
  const desc = asRecord(dynamic?.desc)
  const major = asRecord(dynamic?.major)
  const additional = asRecord(dynamic?.additional)
  const majorParts = collectMajorParts(major)
  const content = [text(desc?.text), ...majorParts.content]
    .filter((value): value is string => value !== undefined)
  const uniqueContent = Array.from(new Set(content))
  const domains = Array.from(new Set(majorParts.domains))
  const additionalType = text(additional?.type)
  const commercialSignals = additionalType?.includes('GOODS') ? ['goods-card'] : []

  return {
    ...(numericUid(author?.mid) ? { authorUid: numericUid(author?.mid) } : {}),
    ...(text(author?.name) ? { authorName: text(author?.name) } : {}),
    ...(uniqueContent.length > 0 ? { content: uniqueContent.join('\n') } : {}),
    ...(text(item?.type) ? { dynamicType: text(item?.type) } : {}),
    ...(domains.length > 0 ? { domains } : {}),
    commercialSignals,
  }
}
