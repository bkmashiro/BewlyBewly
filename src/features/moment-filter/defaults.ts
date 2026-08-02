import type { MomentFilterSettingsV1 } from './types'
import { MOMENT_FILTER_SCHEMA_VERSION } from './types'

export function createDefaultMomentFilterSettings(): MomentFilterSettingsV1 {
  return {
    schemaVersion: MOMENT_FILTER_SCHEMA_VERSION,
    enabled: false,
    mode: 'any',
    rules: [],
  }
}
