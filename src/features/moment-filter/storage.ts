import type {
  ExtensionStorageArea,
  MomentFilterLoadResult,
  MomentFilterSettingsV1,
  StorageChangeListener,
  StorageChangeSource,
} from './types'
import { createDefaultMomentFilterSettings } from './defaults'
import {
  decodeMomentFilterSettings,
  parseMomentFilterSettings,
} from './validation'

export const MOMENT_FILTER_STORAGE_KEY = 'bewly:moment-filter'

function defaultResult(): MomentFilterLoadResult {
  return {
    status: 'default',
    value: createDefaultMomentFilterSettings(),
    issues: [],
  }
}

function decodeStoredValue(input: unknown): MomentFilterLoadResult {
  if (input === undefined)
    return defaultResult()

  const result = decodeMomentFilterSettings(input)
  if (result.success !== false) {
    return {
      status: 'loaded',
      value: result.value,
      issues: [],
    }
  }

  return {
    status: 'recovered',
    value: createDefaultMomentFilterSettings(),
    issues: result.issues,
  }
}

export function createMomentFilterStorage(
  area: ExtensionStorageArea,
  changes?: StorageChangeSource,
) {
  return {
    async load(): Promise<MomentFilterLoadResult> {
      try {
        const stored = await area.get(MOMENT_FILTER_STORAGE_KEY)
        return decodeStoredValue(stored[MOMENT_FILTER_STORAGE_KEY])
      }
      catch {
        return {
          status: 'recovered',
          value: createDefaultMomentFilterSettings(),
          issues: [{ path: '$', message: 'Unable to read extension storage' }],
        }
      }
    },

    async save(input: unknown): Promise<MomentFilterSettingsV1> {
      const value = parseMomentFilterSettings(input)
      await area.set({ [MOMENT_FILTER_STORAGE_KEY]: value })
      return value
    },

    subscribe(listener: (result: MomentFilterLoadResult) => void): () => void {
      if (!changes)
        return () => undefined

      const handleChange: StorageChangeListener = (storageChanges, areaName) => {
        if (areaName !== 'local')
          return
        const change = storageChanges[MOMENT_FILTER_STORAGE_KEY]
        if (!change)
          return
        listener(decodeStoredValue(change.newValue))
      }

      changes.addListener(handleChange)
      return () => changes.removeListener(handleChange)
    },
  }
}
