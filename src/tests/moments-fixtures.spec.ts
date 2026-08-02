import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const fixtures = [
  ['visitor-opus.html', 'Fixture Opus Author'],
  ['visitor-link-card.html', 'Fixture Link Author'],
  ['synthetic-video-card.html', 'Fixture Video Author'],
] as const

describe('sanitized moments DOM fixtures', () => {
  it.each(fixtures)('%s keeps the current card, author and content contracts', async (filename, author) => {
    const html = await readFile(resolve(process.cwd(), 'tests/fixtures/moments', filename), 'utf8')
    document.body.innerHTML = html

    expect(document.querySelector('.bili-dyn-home--visitor')).not.toBeNull()
    expect(document.querySelector('.bili-dyn-list__items')).not.toBeNull()
    expect(document.querySelector('.bili-dyn-list__item')).not.toBeNull()
    expect(document.querySelector('.bili-dyn-title')?.textContent).toContain(author)
    expect(document.querySelector('.bili-dyn-content__orig')).not.toBeNull()

    expect(html).not.toMatch(/(?:cookie|csrf|sessdata|bili_jct)/i)
    expect(html).not.toMatch(/<(?:img|source)[^>]+src=/i)
  })

  it('keeps link and video title variants as separate contracts', async () => {
    const linkHtml = await readFile(resolve(process.cwd(), 'tests/fixtures/moments/visitor-link-card.html'), 'utf8')
    const videoHtml = await readFile(resolve(process.cwd(), 'tests/fixtures/moments/synthetic-video-card.html'), 'utf8')

    document.body.innerHTML = linkHtml
    expect(document.querySelector('.bili-dyn-card-link-common__detail__title')?.textContent).toContain('Fixture linked card')

    document.body.innerHTML = videoHtml
    expect(document.querySelector('.bili-dyn-card-video__title')?.textContent).toContain('Fixture video card')
  })
})
