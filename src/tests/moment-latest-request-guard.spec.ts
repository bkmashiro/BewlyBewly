import { describe, expect, it } from 'vitest'
import { createLatestRequestGuard } from '~/features/moment-filter/latest-request-guard'

describe('latest request guard', () => {
  it('allows only the newest request to commit', () => {
    const guard = createLatestRequestGuard()
    const first = guard.next()
    const second = guard.next()

    expect(first()).toBe(false)
    expect(second()).toBe(true)
  })

  it('invalidates pending requests when disposed', () => {
    const guard = createLatestRequestGuard()
    const pending = guard.next()

    guard.dispose()

    expect(pending()).toBe(false)
    expect(guard.next()()).toBe(false)
  })
})
