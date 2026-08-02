import type {
  MomentFilterRule,
  MomentFilterSettingsV1,
  MomentFilterValidationIssue,
  MomentRuleField,
  MomentRuleOperator,
} from './types'
import {
  MOMENT_FILTER_SCHEMA_VERSION,
} from './types'

const MAX_RULES = 500
const MAX_ID_LENGTH = 128
const MAX_VALUE_LENGTH = 2_000
const MAX_LIST_VALUES = 100
const MAX_NOTE_LENGTH = 500

const SETTINGS_KEYS = new Set(['schemaVersion', 'enabled', 'mode', 'rules'])
const RULE_KEYS = new Set([
  'id',
  'enabled',
  'action',
  'field',
  'operator',
  'value',
  'caseSensitive',
  'note',
  'createdAt',
])

const OPERATORS_BY_FIELD: Record<MomentRuleField, readonly MomentRuleOperator[]> = {
  authorUid: ['equals', 'in'],
  authorName: ['equals', 'contains', 'regex', 'in'],
  content: ['contains', 'regex'],
  dynamicType: ['equals', 'in'],
  commercialSignal: ['equals', 'in'],
}

export class MomentFilterSettingsValidationError extends Error {
  constructor(readonly issues: MomentFilterValidationIssue[]) {
    super(issues.map(issue => `${issue.path}: ${issue.message}`).join('; '))
    this.name = 'MomentFilterSettingsValidationError'
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function addUnknownKeyIssues(
  value: Record<string, unknown>,
  allowedKeys: ReadonlySet<string>,
  path: string,
  issues: MomentFilterValidationIssue[],
): void {
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key))
      issues.push({ path: `${path}.${key}`, message: 'Unknown field' })
  }
}

function validateScalarString(
  value: unknown,
  path: string,
  issues: MomentFilterValidationIssue[],
): value is string {
  if (typeof value !== 'string') {
    issues.push({ path, message: 'Expected a string' })
    return false
  }
  if (!value.trim())
    issues.push({ path, message: 'Value must not be blank' })
  if (value.length > MAX_VALUE_LENGTH)
    issues.push({ path, message: `Value must be at most ${MAX_VALUE_LENGTH} characters` })
  return true
}

function validateRule(
  input: unknown,
  index: number,
  issues: MomentFilterValidationIssue[],
): input is MomentFilterRule {
  const path = `$.rules[${index}]`
  if (!isRecord(input)) {
    issues.push({ path, message: 'Expected a rule object' })
    return false
  }

  addUnknownKeyIssues(input, RULE_KEYS, path, issues)

  if (typeof input.id !== 'string' || !input.id.trim() || input.id.length > MAX_ID_LENGTH)
    issues.push({ path: `${path}.id`, message: `Expected a non-blank id up to ${MAX_ID_LENGTH} characters` })
  if (typeof input.enabled !== 'boolean')
    issues.push({ path: `${path}.enabled`, message: 'Expected a boolean' })
  if (input.action !== 'hide' && input.action !== 'allow')
    issues.push({ path: `${path}.action`, message: 'Expected hide or allow' })

  const field = input.field
  const operator = input.operator
  const validField = typeof field === 'string' && Object.hasOwn(OPERATORS_BY_FIELD, field)
  if (!validField)
    issues.push({ path: `${path}.field`, message: 'Unsupported rule field' })
  if (operator !== 'equals' && operator !== 'contains' && operator !== 'regex' && operator !== 'in')
    issues.push({ path: `${path}.operator`, message: 'Unsupported rule operator' })
  else if (validField && !OPERATORS_BY_FIELD[field as MomentRuleField].includes(operator))
    issues.push({ path: `${path}.operator`, message: `Operator ${operator} is not valid for ${field}` })

  if (operator === 'in') {
    if (!Array.isArray(input.value) || input.value.length === 0 || input.value.length > MAX_LIST_VALUES) {
      issues.push({
        path: `${path}.value`,
        message: `Expected between 1 and ${MAX_LIST_VALUES} string values`,
      })
    }
    else {
      input.value.forEach((value, valueIndex) => {
        validateScalarString(value, `${path}.value[${valueIndex}]`, issues)
      })
    }
  }
  else {
    const scalarValue = input.value
    const validValue = validateScalarString(scalarValue, `${path}.value`, issues)
    if (operator === 'regex' && validValue) {
      try {
        String(new RegExp(scalarValue, input.caseSensitive ? '' : 'i'))
      }
      catch {
        issues.push({ path: `${path}.value`, message: 'Invalid regular expression' })
      }
    }
  }

  if (input.caseSensitive !== undefined && typeof input.caseSensitive !== 'boolean')
    issues.push({ path: `${path}.caseSensitive`, message: 'Expected a boolean' })
  if (input.note !== undefined) {
    if (typeof input.note !== 'string')
      issues.push({ path: `${path}.note`, message: 'Expected a string' })
    else if (input.note.length > MAX_NOTE_LENGTH)
      issues.push({ path: `${path}.note`, message: `Note must be at most ${MAX_NOTE_LENGTH} characters` })
  }
  if (typeof input.createdAt !== 'number' || !Number.isSafeInteger(input.createdAt) || input.createdAt < 0)
    issues.push({ path: `${path}.createdAt`, message: 'Expected a non-negative safe integer timestamp' })

  return issues.every(issue => !issue.path.startsWith(path))
}

function validateMomentFilterSettings(
  input: unknown,
  issues: MomentFilterValidationIssue[],
): input is MomentFilterSettingsV1 {
  if (!isRecord(input)) {
    issues.push({ path: '$', message: 'Expected a settings object' })
    return false
  }

  addUnknownKeyIssues(input, SETTINGS_KEYS, '$', issues)

  if (input.schemaVersion !== MOMENT_FILTER_SCHEMA_VERSION) {
    issues.push({
      path: '$.schemaVersion',
      message: `Unsupported schema version; expected ${MOMENT_FILTER_SCHEMA_VERSION}`,
    })
  }
  if (typeof input.enabled !== 'boolean')
    issues.push({ path: '$.enabled', message: 'Expected a boolean' })
  if (input.mode !== 'any' && input.mode !== 'all')
    issues.push({ path: '$.mode', message: 'Expected any or all' })
  if (!Array.isArray(input.rules)) {
    issues.push({ path: '$.rules', message: 'Expected an array' })
    return false
  }
  if (input.rules.length > MAX_RULES)
    issues.push({ path: '$.rules', message: `At most ${MAX_RULES} rules are allowed` })

  const ids = new Set<string>()
  input.rules.forEach((rule, index) => {
    if (validateRule(rule, index, issues)) {
      if (ids.has(rule.id))
        issues.push({ path: `$.rules[${index}].id`, message: 'Rule ids must be unique' })
      ids.add(rule.id)
    }
  })

  return issues.length === 0
}

function cloneSettings(input: MomentFilterSettingsV1): MomentFilterSettingsV1 {
  return {
    schemaVersion: MOMENT_FILTER_SCHEMA_VERSION,
    enabled: input.enabled,
    mode: input.mode,
    rules: input.rules.map(rule => ({
      ...rule,
      value: Array.isArray(rule.value) ? [...rule.value] : rule.value,
    })),
  }
}

export function parseMomentFilterSettings(input: unknown): MomentFilterSettingsV1 {
  const issues: MomentFilterValidationIssue[] = []
  if (!validateMomentFilterSettings(input, issues))
    throw new MomentFilterSettingsValidationError(issues)
  return cloneSettings(input)
}

export function safeParseMomentFilterSettings(input: unknown):
  | { success: true, value: MomentFilterSettingsV1 }
  | { success: false, issues: MomentFilterValidationIssue[] } {
  try {
    return { success: true, value: parseMomentFilterSettings(input) }
  }
  catch (error) {
    if (error instanceof MomentFilterSettingsValidationError)
      return { success: false, issues: error.issues }
    throw error
  }
}

export function decodeMomentFilterSettings(input: unknown):
  | { success: true, value: MomentFilterSettingsV1 }
  | { success: false, issues: MomentFilterValidationIssue[] } {
  if (typeof input !== 'string')
    return safeParseMomentFilterSettings(input)

  try {
    return safeParseMomentFilterSettings(JSON.parse(input))
  }
  catch {
    return {
      success: false,
      issues: [{ path: '$', message: 'Stored settings are not valid JSON' }],
    }
  }
}
