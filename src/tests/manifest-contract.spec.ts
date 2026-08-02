import { describe, expect, it } from 'vitest'
import type { Manifest } from 'webextension-polyfill'

import chromiumContract from '../../tests/fixtures/manifest/chromium.json'
import firefoxContract from '../../tests/fixtures/manifest/firefox.json'
import { getManifest } from '../manifest'

function normalizeManifestContract(manifest: Manifest.WebExtensionManifest) {
  const {
    background,
    browser_specific_settings,
    content_scripts,
    content_security_policy,
    declarative_net_request,
    host_permissions,
    manifest_version,
    permissions,
    web_accessible_resources,
  } = manifest

  return JSON.parse(JSON.stringify({
    manifest_version,
    background,
    permissions,
    host_permissions,
    content_scripts,
    web_accessible_resources,
    content_security_policy,
    ...(declarative_net_request ? { declarative_net_request } : {}),
    ...(browser_specific_settings ? { browser_specific_settings } : {}),
  }))
}

describe('manifest runtime contracts', () => {
  it('preserves the Chromium MV3 contract', async () => {
    const manifest = await getManifest({ isDev: false, isFirefox: false, isSafari: false })

    expect(normalizeManifestContract(manifest)).toEqual(chromiumContract)
  })

  it('preserves the Firefox MV3 contract', async () => {
    const manifest = await getManifest({ isDev: false, isFirefox: true, isSafari: false })

    expect(normalizeManifestContract(manifest)).toEqual(firefoxContract)
  })
})
