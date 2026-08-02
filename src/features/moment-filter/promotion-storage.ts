import type {
  PromotionLearningState,
  PromotionLearningValidationIssue,
} from './promotion-learning'
import {
  createEmptyPromotionLearningState,
  decodePromotionLearningState,
  parsePromotionLearningState,
} from './promotion-learning'

export const PROMOTION_LEARNING_STORAGE_KEY = 'bewly:promotion-learning'

export interface PromotionLearningStorageArea {
  get: (key: string) => Promise<Record<string, unknown>>
  set: (items: Record<string, unknown>) => Promise<void>
}

export interface PromotionLearningStorageChange {
  oldValue?: unknown
  newValue?: unknown
}

export type PromotionLearningStorageChangeListener = (
  changes: Record<string, PromotionLearningStorageChange>,
  areaName: string,
) => void

export interface PromotionLearningStorageChangeSource {
  addListener: (listener: PromotionLearningStorageChangeListener) => void
  removeListener: (listener: PromotionLearningStorageChangeListener) => void
}

export type PromotionLearningLoadStatus = 'default' | 'loaded' | 'recovered'

export interface PromotionLearningLoadResult {
  status: PromotionLearningLoadStatus
  value: PromotionLearningState
  issues: PromotionLearningValidationIssue[]
}

export interface PromotionLearningStorage {
  load: () => Promise<PromotionLearningLoadResult>
  save: (input: unknown) => Promise<PromotionLearningState>
  subscribe: (listener: (result: PromotionLearningLoadResult) => void) => () => void
}

function defaultResult(): PromotionLearningLoadResult {
  return {
    status: 'default',
    value: createEmptyPromotionLearningState(),
    issues: [],
  }
}

function decodeStoredValue(input: unknown): PromotionLearningLoadResult {
  if (input === undefined)
    return defaultResult()

  const result = decodePromotionLearningState(input)
  if (result.success) {
    return {
      status: 'loaded',
      value: result.value,
      issues: [],
    }
  }
  return {
    status: 'recovered',
    value: createEmptyPromotionLearningState(),
    issues: result.issues,
  }
}

export function createPromotionLearningStorage(
  area: PromotionLearningStorageArea,
  changes?: PromotionLearningStorageChangeSource,
): PromotionLearningStorage {
  return {
    async load(): Promise<PromotionLearningLoadResult> {
      try {
        const stored = await area.get(PROMOTION_LEARNING_STORAGE_KEY)
        return decodeStoredValue(stored[PROMOTION_LEARNING_STORAGE_KEY])
      }
      catch {
        return {
          status: 'recovered',
          value: createEmptyPromotionLearningState(),
          issues: [{ path: '$', message: 'Unable to read extension storage' }],
        }
      }
    },

    async save(input: unknown): Promise<PromotionLearningState> {
      const value = parsePromotionLearningState(input)
      await area.set({ [PROMOTION_LEARNING_STORAGE_KEY]: value })
      return value
    },

    subscribe(listener: (result: PromotionLearningLoadResult) => void): () => void {
      if (!changes)
        return () => undefined

      const handleChange: PromotionLearningStorageChangeListener = (storageChanges, areaName) => {
        if (areaName !== 'local')
          return
        const change = storageChanges[PROMOTION_LEARNING_STORAGE_KEY]
        if (!change)
          return
        listener(decodeStoredValue(change.newValue))
      }
      changes.addListener(handleChange)
      return () => changes.removeListener(handleChange)
    },
  }
}
