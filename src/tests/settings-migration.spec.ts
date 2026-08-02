import { describe, expect, it, vi } from 'vitest'

import existingUserSettings from '../../tests/fixtures/settings/v0.41.1-existing-user.json'
import { mergeSettingsDefaults, originalSettings } from '../logic/storage'

vi.mock('webextension-polyfill', () => ({
  storage: {
    local: {
      get: vi.fn(async () => ({})),
      remove: vi.fn(async () => undefined),
      set: vi.fn(async () => undefined),
    },
  },
}))

describe('legacy settings contract', () => {
  it('adds current defaults without replacing existing v0.41.1 choices or unknown legacy fields', () => {
    const migrated = mergeSettingsDefaults(existingUserSettings)

    expect(migrated.language).toBe('cmn-CN')
    expect(migrated.theme).toBe('dark')
    expect(migrated.themeColor).toBe('#fb7299')
    expect(migrated.filterByTitle).toEqual(existingUserSettings.filterByTitle)
    expect(migrated.filterByUser).toEqual(existingUserSettings.filterByUser)
    expect(migrated.enableVideoPreview).toBe(originalSettings.enableVideoPreview)
    expect(migrated).toHaveProperty('legacyUnknownField', 'must-survive')
  })

  it('deeply detaches migrated settings from mutable storage input and defaults', () => {
    const storageValue = {
      filterByTitle: [{ keyword: 'original', remark: '' }],
    }
    const defaults = structuredClone(originalSettings)
    const migrated = mergeSettingsDefaults(storageValue, defaults)

    storageValue.filterByTitle[0].keyword = 'mutated input'
    defaults.filterByUser.push({ keyword: 'mutated default', remark: '' })

    expect(migrated.filterByTitle[0].keyword).toBe('original')
    expect(migrated.filterByUser).toEqual([])

    migrated.filterByTitle[0].keyword = 'mutated output'
    expect(storageValue.filterByTitle[0].keyword).toBe('mutated input')
  })

  it('returns independent nested defaults for separate users', () => {
    const first = mergeSettingsDefaults({})
    const second = mergeSettingsDefaults({})

    first.filterByTitle.push({ keyword: 'mutated', remark: '' })

    expect(second.filterByTitle).toEqual([])
    expect(originalSettings.filterByTitle).toEqual([])
  })
})
