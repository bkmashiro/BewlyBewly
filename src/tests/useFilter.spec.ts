import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { FilterType, useFilter } from '~/composables/useFilter'
import { originalSettings, settings } from '~/logic'

vi.mock('webextension-polyfill', () => ({
  storage: {
    local: {
      get: vi.fn(async () => ({})),
      remove: vi.fn(async () => undefined),
      set: vi.fn(async () => undefined),
    },
  },
}))

function rule(keyword: string) {
  return { keyword, remark: '' }
}

afterEach(async () => {
  settings.value = structuredClone(originalSettings)
  await nextTick()
})

describe('useFilter', () => {
  it('applies in-place title rule mutations while mounted', async () => {
    settings.value.enableFilterByTitle = true
    settings.value.filterByTitle = [rule('alpha')]
    const filter = useFilter([], [FilterType.title], [['title']])

    expect(filter.value!({ title: 'Beta' })).toBe(true)

    settings.value.filterByTitle.unshift(rule('beta'))
    await nextTick()
    expect(filter.value!({ title: 'Beta' })).toBe(false)

    settings.value.filterByTitle[0] = rule('gamma')
    await nextTick()
    expect(filter.value!({ title: 'Beta' })).toBe(true)
    expect(filter.value!({ title: 'Gamma' })).toBe(false)

    settings.value.filterByTitle.splice(0, 1, rule('delta'))
    await nextTick()
    expect(filter.value!({ title: 'Delta' })).toBe(false)
  })

  it('applies in-place user rule mutations while mounted', async () => {
    settings.value.enableFilterByUser = true
    settings.value.filterByUser = [rule('Alice')]
    const filter = useFilter([], [FilterType.user], [['userName']])

    expect(filter.value!({ userName: 'Bob' })).toBe(true)

    settings.value.filterByUser.unshift(rule('Bob'))
    await nextTick()
    expect(filter.value!({ userName: 'Bob' })).toBe(false)

    settings.value.filterByUser[0] = rule('Carol')
    await nextTick()
    expect(filter.value!({ userName: 'Bob' })).toBe(true)
    expect(filter.value!({ userName: 'Carol' })).toBe(false)

    settings.value.filterByUser.splice(0, 1, rule('Dave'))
    await nextTick()
    expect(filter.value!({ userName: 'Dave' })).toBe(false)
  })

  it('ignores invalid title regex rules while keeping valid siblings active', () => {
    settings.value.enableFilterByTitle = true
    settings.value.filterByTitle = [rule('/[/'), rule('/sponsor/')]
    let filter: ReturnType<typeof useFilter> | undefined

    expect(() => {
      filter = useFilter([], [FilterType.title], [['title']])
    }).not.toThrow()

    expect(filter!.value!({ title: 'Sponsored video' })).toBe(false)
    expect(filter!.value!({ title: 'Ordinary video' })).toBe(true)
  })

  it('ignores invalid user regex rules while keeping valid siblings active', () => {
    settings.value.enableFilterByUser = true
    settings.value.filterByUser = [rule('/[/'), rule('/creator/')]
    let filter: ReturnType<typeof useFilter> | undefined

    expect(() => {
      filter = useFilter([], [FilterType.user], [['userName']])
    }).not.toThrow()

    expect(filter!.value!({ userName: 'Example Creator' })).toBe(false)
    expect(filter!.value!({ userName: 'Ordinary User' })).toBe(true)
  })

  it('preserves the followed-user exemption', () => {
    settings.value.recommendationMode = 'web'
    settings.value.disableFilterForFollowedUser = true
    settings.value.enableFilterByTitle = true
    settings.value.filterByTitle = [rule('sponsor')]
    const filter = useFilter(['followed'], [FilterType.title], [['title']])

    expect(filter.value!({ title: 'Sponsored video', followed: true })).toBe(true)
    expect(filter.value!({ title: 'Sponsored video', followed: false })).toBe(false)
  })
})
