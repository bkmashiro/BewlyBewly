import type {
  MomentFilterSettingsV1,
  StorageChangeListener,
} from '~/features/moment-filter/types'

import { describe, expect, it, vi } from 'vitest'
import { createDefaultMomentFilterSettings } from '~/features/moment-filter/defaults'
import {
  createMomentFilterStorage,
  MOMENT_FILTER_STORAGE_KEY,
} from '~/features/moment-filter/storage'
import {
  MomentFilterSettingsValidationError,
  parseMomentFilterSettings,
} from '~/features/moment-filter/validation'

function validSettings(): MomentFilterSettingsV1 {
  return {
    schemaVersion: 1,
    enabled: true,
    mode: 'any',
    rules: [
      {
        id: 'rule-author-1',
        enabled: true,
        action: 'allow',
        field: 'authorUid',
        operator: 'equals',
        value: '10001',
        note: 'trusted creator',
        createdAt: 1_700_000_000_000,
      },
      {
        id: 'rule-content-1',
        enabled: true,
        action: 'hide',
        field: 'content',
        operator: 'regex',
        value: 'promo(?:tion)?',
        caseSensitive: false,
        createdAt: 1_700_000_000_001,
      },
    ],
  }
}

describe('moment filter settings validation', () => {
  it('creates isolated disabled defaults', () => {
    const first = createDefaultMomentFilterSettings()
    const second = createDefaultMomentFilterSettings()

    first.rules.push(validSettings().rules[0])

    expect(second).toEqual({
      schemaVersion: 1,
      enabled: false,
      mode: 'any',
      rules: [],
    })
  })

  it('parses and clones a valid v1 document', () => {
    const input = validSettings()
    const parsed = parseMomentFilterSettings(input)

    expect(parsed).toEqual(input)
    expect(parsed).not.toBe(input)
    expect(parsed.rules).not.toBe(input.rules)
  })

  it.each([
    ['unknown schema', { ...validSettings(), schemaVersion: 2 }],
    ['duplicate ids', { ...validSettings(), rules: [validSettings().rules[0], validSettings().rules[0]] }],
    ['invalid field/operator pair', {
      ...validSettings(),
      rules: [{ ...validSettings().rules[0], field: 'content', operator: 'equals' }],
    }],
    ['prototype field name', {
      ...validSettings(),
      rules: [{ ...validSettings().rules[0], field: 'toString' }],
    }],
    ['invalid regex', {
      ...validSettings(),
      rules: [{ ...validSettings().rules[1], value: '[unterminated' }],
    }],
    ['blank scalar value', {
      ...validSettings(),
      rules: [{ ...validSettings().rules[0], value: '   ' }],
    }],
    ['blank list item', {
      ...validSettings(),
      rules: [{ ...validSettings().rules[0], operator: 'in', value: ['10001', '  '] }],
    }],
  ])('rejects %s', (_name, input) => {
    expect(() => parseMomentFilterSettings(input)).toThrow(MomentFilterSettingsValidationError)
  })
})

describe('moment filter storage', () => {
  it('loads defaults when no document exists', async () => {
    const storage = createMomentFilterStorage({
      get: vi.fn(async () => ({})),
      set: vi.fn(async () => undefined),
    })

    await expect(storage.load()).resolves.toEqual({
      status: 'default',
      value: createDefaultMomentFilterSettings(),
      issues: [],
    })
  })

  it('loads object or JSON-string documents and clones them', async () => {
    const document = validSettings()
    const values = [document, JSON.stringify(document)]

    for (const storedValue of values) {
      const storage = createMomentFilterStorage({
        get: vi.fn(async () => ({ [MOMENT_FILTER_STORAGE_KEY]: storedValue })),
        set: vi.fn(async () => undefined),
      })
      const result = await storage.load()

      expect(result.status).toBe('loaded')
      expect(result.value).toEqual(document)
      expect(result.value).not.toBe(document)
    }
  })

  it('recovers fail-open from malformed persisted data', async () => {
    const storage = createMomentFilterStorage({
      get: vi.fn(async () => ({
        [MOMENT_FILTER_STORAGE_KEY]: { schemaVersion: 99, enabled: true, rules: [] },
      })),
      set: vi.fn(async () => undefined),
    })

    const result = await storage.load()

    expect(result.status).toBe('recovered')
    expect(result.value.enabled).toBe(false)
    expect(result.issues.length).toBeGreaterThan(0)
  })

  it('validates before saving and writes a cloned object', async () => {
    const set = vi.fn(async (_items: Record<string, unknown>) => undefined)
    const storage = createMomentFilterStorage({
      get: vi.fn(async () => ({})),
      set,
    })
    const input = validSettings()

    await storage.save(input)
    const written = set.mock.calls[0][0][MOMENT_FILTER_STORAGE_KEY] as MomentFilterSettingsV1

    expect(written).toEqual(input)
    expect(written).not.toBe(input)
    await expect(storage.save({ ...input, mode: 'invalid' } as never)).rejects.toThrow(
      MomentFilterSettingsValidationError,
    )
  })

  it('syncs valid storage changes and removes the listener during cleanup', () => {
    let changeListener: StorageChangeListener | undefined
    const removeListener = vi.fn()
    const listener = vi.fn()
    const storage = createMomentFilterStorage(
      {
        get: vi.fn(async () => ({})),
        set: vi.fn(async () => undefined),
      },
      {
        addListener: vi.fn((callback) => {
          changeListener = callback
        }),
        removeListener,
      },
    )

    const cleanup = storage.subscribe(listener)
    changeListener?.(
      { [MOMENT_FILTER_STORAGE_KEY]: { newValue: validSettings() } },
      'local',
    )

    expect(listener).toHaveBeenCalledWith({
      status: 'loaded',
      value: validSettings(),
      issues: [],
    })

    cleanup()
    expect(removeListener).toHaveBeenCalledWith(changeListener)
  })
})
