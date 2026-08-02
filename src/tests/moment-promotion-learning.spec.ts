import type {
  PromotionLearningState,
  PromotionSignature,
} from '~/features/moment-filter/promotion-learning'

import { describe, expect, it, vi } from 'vitest'
import {
  classifyPromotionCandidate,
  createEmptyPromotionLearningState,
  decodePromotionLearningState,
  normalizePromotionDomains,
  normalizePromotionKeywords,
  PROMOTION_LEARNING_SCHEMA_VERSION,
  suggestPromotionKeywords,
  upsertPromotionSignature,
} from '~/features/moment-filter/promotion-learning'
import {
  createPromotionLearningStorage,
  PROMOTION_LEARNING_STORAGE_KEY,
} from '~/features/moment-filter/promotion-storage'

describe('promotion learning pure core', () => {
  it('fails open to an empty v1 state for malformed, empty, or unknown documents', () => {
    const malformed = decodePromotionLearningState({
      schemaVersion: 99,
      signatures: [],
    })
    const invalidSignature = decodePromotionLearningState({
      schemaVersion: 1,
      signatures: [{
        id: 'invalid',
        authorUid: 'not-a-uid',
        keywords: [],
        domains: [],
        commercialSignals: [],
        createdAt: 1,
      }],
    })
    const unknownField = decodePromotionLearningState({
      schemaVersion: 1,
      signatures: [],
      content: 'must never be persisted',
    })

    expect(malformed).toEqual({
      success: false,
      issues: expect.any(Array),
    })
    expect(invalidSignature).toEqual({
      success: false,
      issues: expect.any(Array),
    })
    expect(unknownField).toEqual({
      success: false,
      issues: expect.any(Array),
    })
    expect(createEmptyPromotionLearningState()).toEqual({
      schemaVersion: PROMOTION_LEARNING_SCHEMA_VERSION,
      signatures: [],
    })
  })

  it('normalizes and suggests short deduplicated chips without URLs or mentions', () => {
    expect(normalizePromotionKeywords(['  New Product ', 'new product', '  ']))
      .toEqual(['new product'])
    expect(normalizePromotionDomains(['HTTPS://WWW.Example.COM/path', 'example.com']))
      .toEqual(['example.com'])

    const suggestions = suggestPromotionKeywords({
      content: '@creator 新品上线，点击 https://example.com/shop 购买 New Product，New Product！',
    })

    expect(suggestions).toContain('新品上线')
    expect(suggestions).toContain('new product')
    expect(suggestions).not.toContain('@creator')
    expect(suggestions).not.toContain('https://example.com/shop')
    expect(new Set(suggestions).size).toBe(suggestions.length)
    expect(suggestions.every(item => item.length <= 32)).toBe(true)
  })

  it('confirms candidates with explicit commercial signals and explains the signal', () => {
    const result = classifyPromotionCandidate({
      content: '普通内容',
      commercialSignals: ['paid-promotion-label'],
    }, createEmptyPromotionLearningState())

    expect(result.classification).toBe('confirmed')
    expect(result.reasons.join(' ')).toContain('paid-promotion-label')
  })

  it('confirms an author-scoped signature after one selected feature matches', () => {
    const state: PromotionLearningState = {
      schemaVersion: 1,
      signatures: [{
        id: 'author-example',
        authorUid: '10001',
        keywords: ['new product'],
        domains: [],
        commercialSignals: [],
        createdAt: 1,
      }],
    }

    const result = classifyPromotionCandidate({
      authorUid: '10001',
      content: 'A New Product launch',
    }, state)

    expect(result.classification).toBe('confirmed')
    expect(result.reasons.join(' ')).toMatch(/author-example|author|keyword/i)
  })

  it('requires two independent feature groups for a global signature', () => {
    const state: PromotionLearningState = {
      schemaVersion: 1,
      signatures: [{
        id: 'global-example',
        keywords: ['new product'],
        domains: ['example.com'],
        commercialSignals: [],
        createdAt: 1,
      }],
    }

    expect(classifyPromotionCandidate({ content: 'New Product' }, state).classification)
      .toBe('none')
    expect(classifyPromotionCandidate({
      content: 'New Product https://example.com/shop',
    }, state).classification).toBe('confirmed')
  })

  it('marks conservative heuristic combinations suspected but ignores ordinary single-word purchase copy', () => {
    const state = createEmptyPromotionLearningState()

    expect(classifyPromotionCandidate({ content: '购买' }, state).classification).toBe('none')
    const result = classifyPromotionCandidate({
      content: '品牌合作优惠码：购买 https://shop.example.com/item',
    }, state)
    expect(result.classification).toBe('suspected')
    expect(result.reasons.length).toBeGreaterThanOrEqual(2)
  })

  it('upserts semantically duplicate signatures idempotently without adding raw content', () => {
    const signature: PromotionSignature = {
      id: 'learned-1',
      authorUid: '10001',
      keywords: ['New Product', 'bonus'],
      domains: ['Example.com'],
      commercialSignals: [],
      createdAt: 10,
    }
    const first = upsertPromotionSignature(createEmptyPromotionLearningState(), signature)
    const second = upsertPromotionSignature(first, {
      ...signature,
      id: 'learned-2',
      keywords: ['BONUS', 'new product'],
      createdAt: 20,
    })

    expect(second).toEqual(first)
    expect(second.signatures).toHaveLength(1)
    expect(second.signatures[0]).not.toHaveProperty('content')
    expect(second.signatures[0].keywords).toEqual(['new product', 'bonus'])
    expect(second.signatures[0].domains).toEqual(['example.com'])
  })
})

describe('promotion learning storage', () => {
  it('loads fail-open and saves strict v1 objects', async () => {
    const set = vi.fn(async (_items: Record<string, unknown>) => undefined)
    const storage = createPromotionLearningStorage({
      get: vi.fn(async () => ({
        [PROMOTION_LEARNING_STORAGE_KEY]: { schemaVersion: 2, signatures: [] },
      })),
      set,
    })

    const loaded = await storage.load()
    expect(loaded.status).toBe('recovered')
    expect(loaded.value).toEqual(createEmptyPromotionLearningState())

    await storage.save(createEmptyPromotionLearningState())
    expect(set).toHaveBeenCalledWith({
      [PROMOTION_LEARNING_STORAGE_KEY]: createEmptyPromotionLearningState(),
    })
  })

  it('subscribes to local key changes and removes the listener', () => {
    let changeListener: ((
      changes: Record<string, { newValue?: unknown, oldValue?: unknown }>,
      areaName: string,
    ) => void) | undefined
    const addListener = vi.fn((listener) => {
      changeListener = listener
    })
    const removeListener = vi.fn()
    const listener = vi.fn()
    const storage = createPromotionLearningStorage(
      {
        get: vi.fn(async () => ({})),
        set: vi.fn(async () => undefined),
      },
      { addListener, removeListener },
    )

    const cleanup = storage.subscribe(listener)
    changeListener?.({
      [PROMOTION_LEARNING_STORAGE_KEY]: { newValue: createEmptyPromotionLearningState() },
    }, 'local')
    changeListener?.({
      [PROMOTION_LEARNING_STORAGE_KEY]: { newValue: createEmptyPromotionLearningState() },
    }, 'sync')

    expect(listener).toHaveBeenCalledTimes(1)
    cleanup()
    expect(removeListener).toHaveBeenCalledWith(changeListener)
  })
})
