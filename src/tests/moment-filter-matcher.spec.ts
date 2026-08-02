import type {
  MomentFilterCandidate,
  MomentFilterRule,
  MomentFilterSettingsV1,
} from '~/features/moment-filter/types'

import { describe, expect, it } from 'vitest'
import { compileMomentFilter } from '~/features/moment-filter/matcher'

function rule(overrides: Partial<MomentFilterRule> = {}): MomentFilterRule {
  return {
    id: 'rule-1',
    enabled: true,
    action: 'hide',
    field: 'content',
    operator: 'contains',
    value: 'sponsor',
    createdAt: 1,
    ...overrides,
  }
}

function settings(
  rules: MomentFilterRule[],
  overrides: Partial<MomentFilterSettingsV1> = {},
): MomentFilterSettingsV1 {
  return {
    schemaVersion: 1,
    enabled: true,
    mode: 'any',
    rules,
    ...overrides,
  }
}

const candidate: MomentFilterCandidate = {
  authorUid: '10001',
  authorName: 'Example Creator',
  content: 'A sponsored update about a new release',
  dynamicType: 'video',
  commercialSignals: ['paid-promotion-label'],
}

describe('moment filter matcher', () => {
  it('does nothing when filtering is disabled', () => {
    const matcher = compileMomentFilter(settings([rule()], { enabled: false }))

    expect(matcher(candidate)).toEqual({ action: 'none', matchedRuleIds: [] })
  })

  it('gives any matching allow rule priority over hide rules', () => {
    const matcher = compileMomentFilter(settings([
      rule({ id: 'hide-content' }),
      rule({
        id: 'allow-author',
        action: 'allow',
        field: 'authorUid',
        operator: 'equals',
        value: '10001',
      }),
    ]))

    expect(matcher(candidate)).toEqual({
      action: 'allow',
      matchedRuleIds: ['allow-author'],
    })
  })

  it('uses any mode across enabled hide rules', () => {
    const matcher = compileMomentFilter(settings([
      rule({ id: 'miss', value: 'unrelated' }),
      rule({ id: 'hit', value: 'sponsored' }),
      rule({ id: 'disabled-hit', enabled: false, value: 'sponsored' }),
    ]))

    expect(matcher(candidate)).toEqual({ action: 'hide', matchedRuleIds: ['hit'] })
  })

  it('uses all mode across enabled hide rules', () => {
    const matching = rule({
      id: 'author',
      field: 'authorName',
      operator: 'contains',
      value: 'creator',
    })
    const matcher = compileMomentFilter(settings([
      rule({ id: 'content' }),
      matching,
    ], { mode: 'all' }))
    const missMatcher = compileMomentFilter(settings([
      rule({ id: 'content' }),
      { ...matching, value: 'another author' },
    ], { mode: 'all' }))

    expect(matcher(candidate)).toEqual({
      action: 'hide',
      matchedRuleIds: ['content', 'author'],
    })
    expect(missMatcher(candidate)).toEqual({ action: 'none', matchedRuleIds: ['content'] })
  })

  it('supports case sensitivity, regex, list and commercial signals', () => {
    expect(compileMomentFilter(settings([
      rule({ field: 'authorName', value: 'example creator' }),
    ]))(candidate).action).toBe('hide')

    expect(compileMomentFilter(settings([
      rule({ field: 'authorName', value: 'example creator', caseSensitive: true }),
    ]))(candidate).action).toBe('none')

    expect(compileMomentFilter(settings([
      rule({ field: 'content', operator: 'regex', value: '^A sponsored' }),
    ]))(candidate).action).toBe('hide')

    expect(compileMomentFilter(settings([
      rule({ field: 'dynamicType', operator: 'in', value: ['opus', 'video'] }),
    ]))(candidate).action).toBe('hide')

    expect(compileMomentFilter(settings([
      rule({ field: 'commercialSignal', operator: 'equals', value: 'paid-promotion-label' }),
    ]))(candidate).action).toBe('hide')
  })

  it('fails open when a candidate field is absent', () => {
    const matcher = compileMomentFilter(settings([
      rule({ field: 'authorUid', operator: 'equals', value: '10001' }),
    ]))

    expect(matcher({ content: 'sponsor' })).toEqual({ action: 'none', matchedRuleIds: [] })
  })
})
