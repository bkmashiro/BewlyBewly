import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  extractMomentCandidate,
  fingerprintMomentCandidate,
} from '~/features/moment-filter/extract'
import { MOMENT_CARD_SELECTOR } from '~/features/moment-filter/selectors'

const fixtureCases = [
  ['visitor-opus.html', {
    authorUid: '10001',
    authorName: 'Fixture Opus Author',
    content: 'Fixture normal dynamic text',
    dynamicType: 'opus',
    commercialSignals: [],
  }],
  ['visitor-link-card.html', {
    authorUid: '10002',
    authorName: 'Fixture Link Author',
    content: 'Fixture dynamic with linked content\nFixture linked card',
    dynamicType: 'link',
    commercialSignals: [],
  }],
  ['synthetic-video-card.html', {
    authorUid: '10003',
    authorName: 'Fixture Video Author',
    content: 'Fixture dynamic with video content\nFixture video card',
    dynamicType: 'video',
    commercialSignals: [],
  }],
] as const

async function loadCard(filename: string): Promise<Element> {
  document.body.innerHTML = await readFile(
    resolve(process.cwd(), 'tests/fixtures/moments', filename),
    'utf8',
  )
  const card = document.querySelector(MOMENT_CARD_SELECTOR)
  if (!card)
    throw new Error(`Missing fixture card in ${filename}`)
  return card
}

describe('moment DOM extraction', () => {
  it.each(fixtureCases)('extracts %s through the centralized adapter', async (filename, expected) => {
    expect(extractMomentCandidate(await loadCard(filename))).toEqual(expected)
  })

  it('extracts only explicit commercial signals', async () => {
    const card = await loadCard('visitor-opus.html')
    const ordinaryText = card.querySelector('.dyn-card-opus__summary')
    if (!ordinaryText)
      throw new Error('Missing fixture summary')
    ordinaryText.textContent = '购买 ordinary words must not become an ad signal'
    expect(extractMomentCandidate(card).commercialSignals).toEqual([])

    const label = document.createElement('span')
    label.setAttribute('aria-label', 'Paid promotion')
    card.append(label)
    expect(extractMomentCandidate(card).commercialSignals).toEqual(['paid-promotion-label'])
  })

  it('changes its fingerprint only when extracted fields change', async () => {
    const card = await loadCard('visitor-opus.html')
    const first = fingerprintMomentCandidate(extractMomentCandidate(card))
    card.setAttribute('data-unrelated', 'value')
    const unrelated = fingerprintMomentCandidate(extractMomentCandidate(card))
    card.querySelector('.dyn-card-opus__summary')!.textContent = 'Changed fixture text'
    const changed = fingerprintMomentCandidate(extractMomentCandidate(card))

    expect(unrelated).toBe(first)
    expect(changed).not.toBe(first)
  })
})
