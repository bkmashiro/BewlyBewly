import type {
  MomentFilterRule,
  MomentFilterSettingsV1,
  MomentFilterValidationIssue,
} from './types'
import {
  MomentFilterSettingsValidationError,
  parseMomentFilterSettings,
} from './validation'

export type MomentFilterImportMode = 'merge' | 'replace'

export interface MomentFilterImportCounts {
  added: number
  updated: number
  unchanged: number
  removed: number
}

export interface MomentFilterImportPreview {
  value: MomentFilterSettingsV1
  counts: MomentFilterImportCounts
}

function parseImportText(input: string): MomentFilterSettingsV1 {
  let decoded: unknown
  try {
    decoded = JSON.parse(input)
  }
  catch {
    const issues: MomentFilterValidationIssue[] = [
      { path: '$', message: 'Import is not valid JSON' },
    ]
    throw new MomentFilterSettingsValidationError(issues)
  }
  return parseMomentFilterSettings(decoded)
}

function valuesEqual(left: string | string[], right: string | string[]): boolean {
  if (typeof left === 'string' || typeof right === 'string')
    return left === right
  return left.length === right.length && left.every((value, index) => value === right[index])
}

function rulesEqual(left: MomentFilterRule, right: MomentFilterRule): boolean {
  return left.id === right.id
    && left.enabled === right.enabled
    && left.action === right.action
    && left.field === right.field
    && left.operator === right.operator
    && valuesEqual(left.value, right.value)
    && left.caseSensitive === right.caseSensitive
    && left.note === right.note
    && left.createdAt === right.createdAt
}

export function exportMomentFilterSettings(input: unknown): string {
  return `${JSON.stringify(parseMomentFilterSettings(input), null, 2)}\n`
}

export function planMomentFilterImport(
  currentInput: unknown,
  importText: string,
  mode: MomentFilterImportMode,
): MomentFilterImportPreview {
  const current = parseMomentFilterSettings(currentInput)
  const incoming = parseImportText(importText)
  const currentById = new Map(current.rules.map(rule => [rule.id, rule]))
  const incomingById = new Map(incoming.rules.map(rule => [rule.id, rule]))
  const counts: MomentFilterImportCounts = {
    added: 0,
    updated: 0,
    unchanged: 0,
    removed: 0,
  }

  for (const rule of incoming.rules) {
    const existing = currentById.get(rule.id)
    if (!existing)
      counts.added += 1
    else if (rulesEqual(existing, rule))
      counts.unchanged += 1
    else
      counts.updated += 1
  }

  let value: MomentFilterSettingsV1
  if (mode === 'replace') {
    counts.removed = current.rules.filter(rule => !incomingById.has(rule.id)).length
    value = incoming
  }
  else {
    const mergedRules = current.rules.map(rule => incomingById.get(rule.id) ?? rule)
    const existingIds = new Set(current.rules.map(rule => rule.id))
    mergedRules.push(...incoming.rules.filter(rule => !existingIds.has(rule.id)))
    value = {
      ...current,
      rules: mergedRules,
    }
  }

  return {
    value: parseMomentFilterSettings(value),
    counts,
  }
}
