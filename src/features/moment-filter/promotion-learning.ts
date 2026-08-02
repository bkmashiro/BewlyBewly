import type { MomentFilterCandidate } from './types'

export const PROMOTION_LEARNING_SCHEMA_VERSION = 1 as const

export interface PromotionSignature {
  id: string
  authorUid?: string
  keywords: string[]
  domains: string[]
  commercialSignals: string[]
  exampleFingerprint?: string
  createdAt: number
}

export interface PromotionLearningState {
  schemaVersion: typeof PROMOTION_LEARNING_SCHEMA_VERSION
  signatures: PromotionSignature[]
}

export interface PromotionLearningValidationIssue {
  path: string
  message: string
}

export type PromotionClassification = 'none' | 'suspected' | 'confirmed'

export interface PromotionClassificationResult {
  classification: PromotionClassification
  reasons: string[]
}

const STATE_KEYS = new Set(['schemaVersion', 'signatures'])
const SIGNATURE_KEYS = new Set([
  'id',
  'authorUid',
  'keywords',
  'domains',
  'commercialSignals',
  'exampleFingerprint',
  'createdAt',
])
const MAX_SIGNATURES = 500
const MAX_ID_LENGTH = 128
const MAX_FEATURE_LENGTH = 128
const MAX_FEATURES = 32
const GENERIC_SUGGESTION_WORDS = new Set([
  'a',
  'and',
  'for',
  'the',
  'this',
  'with',
  '分享',
  '点击',
  '购买',
  '链接',
  '转发',
  '视频',
  '大家',
  '今天',
  '可以',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function addUnknownKeyIssues(
  value: Record<string, unknown>,
  allowedKeys: ReadonlySet<string>,
  path: string,
  issues: PromotionLearningValidationIssue[],
): void {
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key))
      issues.push({ path: `${path}.${key}`, message: 'Unknown field' })
  }
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)]
}

function normalizeKeyword(value: string): string | undefined {
  const normalized = value.normalize('NFKC').trim().toLowerCase().replace(/\s+/gu, ' ')
  return normalized || undefined
}

export function normalizePromotionKeywords(input: string | readonly string[] | undefined): string[] {
  const values = typeof input === 'string' ? [input] : input ?? []
  return unique(values
    .map(normalizeKeyword)
    .filter((value): value is string => value !== undefined)
    .filter(value => value.length <= MAX_FEATURE_LENGTH))
}

function normalizeDomain(value: string): string | undefined {
  let candidate = value.normalize('NFKC').trim().toLowerCase()
  if (!candidate)
    return undefined
  if (!candidate.includes('://'))
    candidate = `https://${candidate}`

  try {
    const hostname = new URL(candidate).hostname.replace(/^www\./u, '')
    if (!hostname || !hostname.includes('.') || hostname.includes('..'))
      return undefined
    if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/u.test(hostname))
      return undefined
    return hostname
  }
  catch {
    return undefined
  }
}

export function normalizePromotionDomains(input: string | readonly string[] | undefined): string[] {
  const values = typeof input === 'string' ? [input] : input ?? []
  return unique(values
    .map(normalizeDomain)
    .filter((value): value is string => value !== undefined)
    .filter(value => value.length <= MAX_FEATURE_LENGTH))
}

function normalizeSignal(value: string): string | undefined {
  const normalized = value.normalize('NFKC').trim().toLowerCase().replace(/\s+/gu, '-')
  return normalized || undefined
}

function normalizeSignals(input: string | readonly string[] | undefined): string[] {
  const values = typeof input === 'string' ? [input] : input ?? []
  return unique(values
    .map(normalizeSignal)
    .filter((value): value is string => value !== undefined))
    .filter(value => value.length <= MAX_FEATURE_LENGTH)
}

function extractDomains(content: string): string[] {
  const candidates = content.match(/(?:https?:\/\/|www\.)[^\s<>()"']+|\b[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+(?:\/[^\s<>()"']*)?/giu) ?? []
  return normalizePromotionDomains(candidates)
}

function removeUrlsAndMentions(content: string): string {
  return content
    .replace(/(?:https?:\/\/|www\.)[^\s<>()"']+/giu, ' ')
    .replace(/@[\p{L}\p{N}_-]+/gu, ' ')
}

export function suggestPromotionKeywords(candidate: Pick<MomentFilterCandidate, 'content'> | string): string[] {
  const content = (typeof candidate === 'string' ? candidate : candidate.content)?.normalize('NFKC') ?? ''
  if (!content)
    return []

  const cleaned = removeUrlsAndMentions(content)
  const tokens = cleaned.match(/\p{Script=Han}{2,10}|[a-z][a-z0-9]*(?:[ -]+[a-z][a-z0-9]*){0,3}/giu) ?? []
  return unique(tokens
    .map(normalizeKeyword)
    .filter((value): value is string => value !== undefined)
    .filter(value => !GENERIC_SUGGESTION_WORDS.has(value))
    .filter(value => value.length >= 2 && value.length <= MAX_FEATURE_LENGTH))
    .slice(0, 8)
}

function validateStringList(
  input: unknown,
  path: string,
  issues: PromotionLearningValidationIssue[],
): input is string[] {
  if (!Array.isArray(input)) {
    issues.push({ path, message: 'Expected an array of strings' })
    return false
  }
  if (input.length > MAX_FEATURES)
    issues.push({ path, message: `At most ${MAX_FEATURES} values are allowed` })
  input.forEach((value, index) => {
    if (typeof value !== 'string' || !value.trim() || value.length > MAX_FEATURE_LENGTH)
      issues.push({ path: `${path}[${index}]`, message: 'Expected a non-blank short string' })
  })
  return true
}

function validateSignature(
  input: unknown,
  index: number,
  issues: PromotionLearningValidationIssue[],
): input is PromotionSignature {
  const path = `$.signatures[${index}]`
  if (!isRecord(input)) {
    issues.push({ path, message: 'Expected a signature object' })
    return false
  }
  addUnknownKeyIssues(input, SIGNATURE_KEYS, path, issues)

  if (typeof input.id !== 'string' || !input.id.trim() || input.id.length > MAX_ID_LENGTH)
    issues.push({ path: `${path}.id`, message: `Expected a non-blank id up to ${MAX_ID_LENGTH} characters` })
  if (input.authorUid !== undefined
    && (typeof input.authorUid !== 'string' || !/^\d+$/u.test(input.authorUid.trim()))) {
    issues.push({ path: `${path}.authorUid`, message: 'Expected a numeric author UID' })
  }
  const hasKeywords = validateStringList(input.keywords, `${path}.keywords`, issues)
  const hasDomains = validateStringList(input.domains, `${path}.domains`, issues)
  const hasCommercialSignals = validateStringList(input.commercialSignals, `${path}.commercialSignals`, issues)
  if (hasKeywords && hasDomains && hasCommercialSignals
    && Array.isArray(input.keywords)
    && Array.isArray(input.domains)
    && Array.isArray(input.commercialSignals)
    && input.keywords.length + input.domains.length + input.commercialSignals.length === 0) {
    issues.push({ path, message: 'Expected at least one selected feature' })
  }
  if (input.exampleFingerprint !== undefined
    && (typeof input.exampleFingerprint !== 'string' || !input.exampleFingerprint.trim() || input.exampleFingerprint.length > 256)) {
    issues.push({ path: `${path}.exampleFingerprint`, message: 'Expected a short non-blank fingerprint' })
  }
  if (typeof input.createdAt !== 'number' || !Number.isSafeInteger(input.createdAt) || input.createdAt < 0)
    issues.push({ path: `${path}.createdAt`, message: 'Expected a non-negative safe integer timestamp' })

  return issues.every(issue => !issue.path.startsWith(path))
}

function cloneSignature(input: PromotionSignature): PromotionSignature {
  const signature: PromotionSignature = {
    id: input.id,
    keywords: normalizePromotionKeywords(input.keywords),
    domains: normalizePromotionDomains(input.domains),
    commercialSignals: normalizeSignals(input.commercialSignals),
    createdAt: input.createdAt,
  }
  if (input.authorUid !== undefined)
    signature.authorUid = input.authorUid.trim()
  if (input.exampleFingerprint !== undefined)
    signature.exampleFingerprint = input.exampleFingerprint
  return signature
}

function cloneState(input: PromotionLearningState): PromotionLearningState {
  return {
    schemaVersion: PROMOTION_LEARNING_SCHEMA_VERSION,
    signatures: input.signatures.map(cloneSignature),
  }
}

export class PromotionLearningValidationError extends Error {
  constructor(readonly issues: PromotionLearningValidationIssue[]) {
    super(issues.map(issue => `${issue.path}: ${issue.message}`).join('; '))
    this.name = 'PromotionLearningValidationError'
  }
}

export function parsePromotionLearningState(input: unknown): PromotionLearningState {
  const issues: PromotionLearningValidationIssue[] = []
  if (!isRecord(input)) {
    issues.push({ path: '$', message: 'Expected a learning state object' })
  }
  else {
    addUnknownKeyIssues(input, STATE_KEYS, '$', issues)
    if (input.schemaVersion !== PROMOTION_LEARNING_SCHEMA_VERSION)
      issues.push({ path: '$.schemaVersion', message: 'Unsupported schema version' })
    if (!Array.isArray(input.signatures)) {
      issues.push({ path: '$.signatures', message: 'Expected an array' })
    }
    else {
      if (input.signatures.length > MAX_SIGNATURES)
        issues.push({ path: '$.signatures', message: `At most ${MAX_SIGNATURES} signatures are allowed` })
      const ids = new Set<string>()
      input.signatures.forEach((signature, index) => {
        if (validateSignature(signature, index, issues)) {
          if (ids.has(signature.id))
            issues.push({ path: `$.signatures[${index}].id`, message: 'Signature ids must be unique' })
          ids.add(signature.id)
        }
      })
    }
  }
  if (issues.length > 0)
    throw new PromotionLearningValidationError(issues)
  return cloneState(input as PromotionLearningState)
}

export function safeParsePromotionLearningState(input: unknown):
  | { success: true, value: PromotionLearningState }
  | { success: false, issues: PromotionLearningValidationIssue[] } {
  try {
    return { success: true, value: parsePromotionLearningState(input) }
  }
  catch (error) {
    if (error instanceof PromotionLearningValidationError)
      return { success: false, issues: error.issues }
    throw error
  }
}

export function decodePromotionLearningState(input: unknown):
  | { success: true, value: PromotionLearningState }
  | { success: false, issues: PromotionLearningValidationIssue[] } {
  if (typeof input !== 'string')
    return safeParsePromotionLearningState(input)
  try {
    return safeParsePromotionLearningState(JSON.parse(input))
  }
  catch {
    return {
      success: false,
      issues: [{ path: '$', message: 'Stored learning state is not valid JSON' }],
    }
  }
}

export function createEmptyPromotionLearningState(): PromotionLearningState {
  return {
    schemaVersion: PROMOTION_LEARNING_SCHEMA_VERSION,
    signatures: [],
  }
}

function matchesKeyword(content: string, keyword: string): boolean {
  if (/^[a-z0-9][a-z0-9 -]*$/iu.test(keyword))
    return new RegExp(`(?:^|[^a-z0-9])${keyword.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}(?:$|[^a-z0-9])`, 'iu').test(content)
  return content.includes(keyword)
}

interface MatchedFeatures {
  keywords: boolean
  domains: boolean
  commercialSignals: boolean
}

function matchedFeatures(candidate: MomentFilterCandidate, signature: PromotionSignature): MatchedFeatures {
  const content = candidate.content?.normalize('NFKC').toLowerCase() ?? ''
  const contentDomains = normalizePromotionDomains([
    ...extractDomains(candidate.content ?? ''),
    ...(candidate.domains ?? []),
  ])
  const candidateSignals = normalizeSignals(candidate.commercialSignals)
  return {
    keywords: signature.keywords.some(keyword => matchesKeyword(content, keyword)),
    domains: signature.domains.some(domain => contentDomains.includes(domain)),
    commercialSignals: signature.commercialSignals.some(signal => candidateSignals.includes(signal)),
  }
}

function featureNames(features: MatchedFeatures): string[] {
  const names: string[] = []
  if (features.keywords)
    names.push('keyword')
  if (features.domains)
    names.push('domain')
  if (features.commercialSignals)
    names.push('commercial signal')
  return names
}

function heuristicFeatureGroups(candidate: MomentFilterCandidate): string[] {
  const content = candidate.content?.normalize('NFKC') ?? ''
  if (!content)
    return []
  const groups: string[] = []
  if (/广告|推广|赞助|商业合作|品牌合作|商务合作|付费合作|合作伙伴|sponsored|advertis(?:ing|ement)|paid partnership/iu.test(content))
    groups.push('disclosure')
  if (/[¥￥$€]\s*\d|\d+(?:\.\d+)?\s*[元折]|优惠[码券]|满.{0,8}减|限时(?:优惠|折扣)|专属(?:链接|优惠)|下单|购买|店铺|商品|带货|领取/u.test(content))
    groups.push('transaction')
  if (extractDomains(content).length > 0 || (candidate.domains?.length ?? 0) > 0)
    groups.push('external link')
  return groups
}

export function classifyPromotionCandidate(
  candidate: MomentFilterCandidate,
  state: PromotionLearningState,
): PromotionClassificationResult {
  const normalizedState = parsePromotionLearningState(state)
  const explicitSignals = normalizeSignals(candidate.commercialSignals)
  if (explicitSignals.length > 0) {
    return {
      classification: 'confirmed',
      reasons: explicitSignals.map(signal => `explicit commercial signal: ${signal}`),
    }
  }

  for (const signature of normalizedState.signatures) {
    const features = matchedFeatures(candidate, signature)
    const matches = featureNames(features)
    if (signature.authorUid !== undefined) {
      if (signature.authorUid === candidate.authorUid && matches.length > 0) {
        return {
          classification: 'confirmed',
          reasons: [`signature ${signature.id} matched author scope and ${matches[0]} feature`],
        }
      }
    }
    else if (matches.length >= 2) {
      return {
        classification: 'confirmed',
        reasons: [`signature ${signature.id} matched ${matches.slice(0, 2).join(' and ')} features`],
      }
    }
  }

  const heuristics = heuristicFeatureGroups(candidate)
  if (heuristics.length >= 2) {
    return {
      classification: 'suspected',
      reasons: heuristics.map(group => `heuristic feature group: ${group}`),
    }
  }
  return { classification: 'none', reasons: [] }
}

function signatureIdentity(signature: PromotionSignature): string {
  return JSON.stringify([
    signature.authorUid ?? null,
    [...signature.keywords].sort(),
    [...signature.domains].sort(),
    [...signature.commercialSignals].sort(),
  ])
}

export function upsertPromotionSignature(
  state: PromotionLearningState,
  input: PromotionSignature,
): PromotionLearningState {
  const current = parsePromotionLearningState(state)
  const incoming = parsePromotionLearningState({
    schemaVersion: PROMOTION_LEARNING_SCHEMA_VERSION,
    signatures: [input],
  }).signatures[0]
  if (!incoming)
    return current

  const index = current.signatures.findIndex(signature => signature.id === incoming.id
    || signatureIdentity(signature) === signatureIdentity(incoming))
  if (index < 0)
    return { ...current, signatures: [...current.signatures, incoming] }

  const existing = current.signatures[index]
  const merged: PromotionSignature = {
    id: existing.id,
    keywords: normalizePromotionKeywords([...existing.keywords, ...incoming.keywords]),
    domains: normalizePromotionDomains([...existing.domains, ...incoming.domains]),
    commercialSignals: normalizeSignals([...existing.commercialSignals, ...incoming.commercialSignals]),
    createdAt: Math.min(existing.createdAt, incoming.createdAt),
  }
  const authorUid = existing.authorUid ?? incoming.authorUid
  const exampleFingerprint = existing.exampleFingerprint ?? incoming.exampleFingerprint
  if (authorUid !== undefined)
    merged.authorUid = authorUid
  if (exampleFingerprint !== undefined)
    merged.exampleFingerprint = exampleFingerprint

  const signatures = [...current.signatures]
  signatures[index] = merged
  return { ...current, signatures }
}

export const normalizeKeywords = normalizePromotionKeywords
export const normalizeDomains = normalizePromotionDomains
export const suggestKeywords = suggestPromotionKeywords
export const classifyPromotion = classifyPromotionCandidate
export const upsertSignature = upsertPromotionSignature
