import { describe, expect, it } from 'vitest'

import { extractApiMomentCandidate } from '~/features/moment-filter/api-candidate'

describe('api moment candidate extraction', () => {
  it('extracts only fields needed by local filtering and normalizes external domains', () => {
    const candidate = extractApiMomentCandidate({
      type: 'DYNAMIC_TYPE_AV',
      modules: {
        module_author: { mid: 10001, name: 'Fixture Author' },
        module_dynamic: {
          desc: { text: 'Fixture campaign copy' },
          major: {
            type: 'MAJOR_TYPE_ARCHIVE',
            archive: {
              title: 'Fixture video title',
              desc: 'Fixture video description',
              jump_url: 'https://WWW.Example.com/campaign?token=[REDACTED]',
            },
          },
        },
      },
    })

    expect(candidate).toEqual({
      authorUid: '10001',
      authorName: 'Fixture Author',
      content: 'Fixture campaign copy\nFixture video title\nFixture video description',
      dynamicType: 'DYNAMIC_TYPE_AV',
      domains: ['example.com'],
      commercialSignals: [],
    })
    expect(JSON.stringify(candidate)).not.toContain('[REDACTED]')
  })

  it('maps explicit goods metadata to a commercial signal', () => {
    expect(extractApiMomentCandidate({
      modules: {
        module_dynamic: {
          additional: { type: 'ADDITIONAL_TYPE_GOODS' },
          major: null,
          desc: null,
        },
      },
    }).commercialSignals).toEqual(['goods-card'])
  })

  it('fails open for malformed payloads', () => {
    expect(extractApiMomentCandidate(null)).toEqual({ commercialSignals: [] })
    expect(extractApiMomentCandidate({ modules: 'invalid' })).toEqual({ commercialSignals: [] })
  })
})
