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
  ['synthetic-forward-card.html', {
    authorUid: '10004',
    authorName: 'Fixture Forward Author',
    content: 'Fixture forwarded body Fixture forwarded card',
    dynamicType: 'forward',
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

  it('falls back to a non-empty numeric data-mid when the author href is absent', async () => {
    const card = await loadCard('synthetic-forward-card.html')
    const following = card.querySelector('.bili-dyn-item__following')
    if (!following)
      throw new Error('Missing fixture following marker')

    expect(extractMomentCandidate(card).authorUid).toBe('10004')

    following.setAttribute('data-mid', 'not-a-uid')
    expect(extractMomentCandidate(card).authorUid).toBeUndefined()

    following.setAttribute('data-mid', ' ')
    expect(extractMomentCandidate(card).authorUid).toBeUndefined()
  })

  it('prefers a valid author href over a conflicting data-mid fallback', async () => {
    const card = await loadCard('visitor-opus.html')
    const marker = document.createElement('span')
    marker.className = 'bili-dyn-item__following'
    marker.dataset.mid = '99999'
    card.append(marker)

    expect(extractMomentCandidate(card).authorUid).toBe('10001')
  })

  it('recognizes a direct forwarded card but ignores unrelated nested forward elements', () => {
    const card = document.createElement('div')
    card.innerHTML = '<div class="unrelated-wrapper"><div class="forward"></div></div>'

    expect(extractMomentCandidate(card).dynamicType).toBeUndefined()
  })

  it('keeps forward as the outer type when the forwarded card contains a video', () => {
    const card = document.createElement('div')
    card.innerHTML = `
      <div class="bili-dyn-content__orig">
        <div class="forward">
          <div class="bili-dyn-card-video__title">Synthetic nested video</div>
        </div>
      </div>
    `

    expect(extractMomentCandidate(card).dynamicType).toBe('forward')
  })

  it.each([
    '<div class="bili-dyn-card-link-common__detail__title">Synthetic nested link</div>',
    '<div class="dyn-card-opus">Synthetic nested opus</div>',
  ])('keeps forward as the outer type for another nested card variant', (nestedCard) => {
    const card = document.createElement('div')
    card.innerHTML = `<div class="bili-dyn-content__orig"><div class="forward">${nestedCard}</div></div>`

    expect(extractMomentCandidate(card).dynamicType).toBe('forward')
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
