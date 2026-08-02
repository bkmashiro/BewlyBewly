export const MOMENT_FILTER_SCHEMA_VERSION = 1 as const

export type MomentRuleField
  = | 'authorUid'
    | 'authorName'
    | 'content'
    | 'dynamicType'
    | 'commercialSignal'

export type MomentRuleOperator = 'equals' | 'contains' | 'regex' | 'in'
export type MomentRuleAction = 'hide' | 'allow'
export type MomentFilterMode = 'any' | 'all'

export interface MomentFilterRule {
  id: string
  enabled: boolean
  action: MomentRuleAction
  field: MomentRuleField
  operator: MomentRuleOperator
  value: string | string[]
  caseSensitive?: boolean
  note?: string
  createdAt: number
}

export interface MomentFilterSettingsV1 {
  schemaVersion: typeof MOMENT_FILTER_SCHEMA_VERSION
  enabled: boolean
  mode: MomentFilterMode
  rules: MomentFilterRule[]
}

export interface MomentFilterCandidate {
  authorUid?: string
  authorName?: string
  content?: string
  dynamicType?: string
  commercialSignals?: string[]
}

export interface MomentFilterMatchResult {
  action: 'none' | MomentRuleAction
  matchedRuleIds: string[]
}

export interface MomentFilterValidationIssue {
  path: string
  message: string
}

export type MomentFilterLoadStatus = 'default' | 'loaded' | 'recovered'

export interface MomentFilterLoadResult {
  status: MomentFilterLoadStatus
  value: MomentFilterSettingsV1
  issues: MomentFilterValidationIssue[]
}

export interface ExtensionStorageArea {
  get: (key: string) => Promise<Record<string, unknown>>
  set: (items: Record<string, unknown>) => Promise<void>
}

export interface StorageValueChange {
  oldValue?: unknown
  newValue?: unknown
}

export type StorageChangeListener = (
  changes: Record<string, StorageValueChange>,
  areaName: string,
) => void

export interface StorageChangeSource {
  addListener: (listener: StorageChangeListener) => void
  removeListener: (listener: StorageChangeListener) => void
}
