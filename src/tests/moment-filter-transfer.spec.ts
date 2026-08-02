import type { MomentFilterSettingsV1 } from '~/features/moment-filter/types'

import { describe, expect, it } from 'vitest'
import {
  exportMomentFilterSettings,
  planMomentFilterImport,
} from '~/features/moment-filter/transfer'
import { MomentFilterSettingsValidationError } from '~/features/moment-filter/validation'

function document(ruleIds: string[], enabled = true): MomentFilterSettingsV1 {
  return {
    schemaVersion: 1,
    enabled,
    mode: 'any',
    rules: ruleIds.map((id, index) => ({
      id,
      enabled: true,
      action: 'hide',
      field: 'authorUid',
      operator: 'equals',
      value: String(10_000 + index),
      createdAt: index + 1,
    })),
  }
}

describe('moment filter import and export', () => {
  it('exports only the validated versioned settings document', () => {
    const value = document(['one'])
    const exported = exportMomentFilterSettings(value)

    expect(JSON.parse(exported)).toEqual(value)
    expect(exported).toContain('"schemaVersion": 1')
    expect(exported).not.toMatch(/content|matched|history/i)
  })

  it('rejects invalid JSON and invalid settings before preview', () => {
    expect(() => planMomentFilterImport(document([]), '{broken', 'merge'))
      .toThrow(MomentFilterSettingsValidationError)
    expect(() => planMomentFilterImport(
      document([]),
      JSON.stringify({ ...document([]), schemaVersion: 99 }),
      'replace',
    )).toThrow(MomentFilterSettingsValidationError)
  })

  it('previews merge by id while preserving local top-level controls', () => {
    const current = document(['keep', 'update'], false)
    const incoming = document(['update', 'add'])
    incoming.mode = 'all'
    incoming.rules[0].value = 'changed'

    const preview = planMomentFilterImport(current, JSON.stringify(incoming), 'merge')

    expect(preview.counts).toEqual({ added: 1, updated: 1, unchanged: 0, removed: 0 })
    expect(preview.value.enabled).toBe(false)
    expect(preview.value.mode).toBe('any')
    expect(preview.value.rules.map(rule => rule.id)).toEqual(['keep', 'update', 'add'])
    expect(preview.value.rules[1].value).toBe('changed')
  })

  it('previews replacement including unchanged and removed counts', () => {
    const current = document(['keep', 'remove'])
    const incoming = document(['keep', 'add'], false)
    incoming.rules[0] = { ...current.rules[0] }

    const preview = planMomentFilterImport(current, JSON.stringify(incoming), 'replace')

    expect(preview.counts).toEqual({ added: 1, updated: 0, unchanged: 1, removed: 1 })
    expect(preview.value).toEqual(incoming)
    expect(preview.value).not.toBe(incoming)
  })
})
