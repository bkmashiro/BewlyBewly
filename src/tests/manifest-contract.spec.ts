import { access, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'
import type { Manifest } from 'webextension-polyfill'

import chromiumContract from '../../tests/fixtures/manifest/chromium.json'
import firefoxContract from '../../tests/fixtures/manifest/firefox.json'

type ExtensionManifest = Manifest.WebExtensionManifest
type ContentScriptWithWorld = NonNullable<ExtensionManifest['content_scripts']>[number] & {
  world?: 'ISOLATED' | 'MAIN'
}
type ManifestV3Extras = ExtensionManifest & {
  action?: unknown
  options_ui?: unknown
}

async function readBuiltManifest(target: 'chrome' | 'firefox'): Promise<ExtensionManifest> {
  const path = resolve(process.cwd(), `.output/${target}-mv3/manifest.json`)
  return JSON.parse(await readFile(path, 'utf8'))
}

function normalizeManifestContract(manifest: ExtensionManifest) {
  const manifestV3 = manifest as ManifestV3Extras
  const normalizeContentScript = (script: ContentScriptWithWorld) => ({
    ...script,
    matches: [...script.matches].sort(),
    ...(script.css ? { css: ['<isolated-css>'] } : {}),
    js: [script.world === 'MAIN' ? '<main-world-js>' : '<isolated-js>'],
  })

  const background = manifest.background && 'service_worker' in manifest.background
    ? { service_worker: '<background-js>' }
    : manifest.background && 'scripts' in manifest.background
      ? { scripts: ['<background-js>'] }
      : manifest.background

  return JSON.parse(JSON.stringify({
    manifest_version: manifest.manifest_version,
    name: manifest.name,
    version: manifest.version,
    description: manifest.description,
    homepage_url: manifest.homepage_url,
    icons: manifest.icons,
    action: manifestV3.action ?? null,
    options_ui: manifestV3.options_ui ?? null,
    background,
    permissions: manifest.permissions,
    host_permissions: manifest.host_permissions,
    content_scripts: manifest.content_scripts?.map(script => normalizeContentScript(script as ContentScriptWithWorld)),
    web_accessible_resources: manifest.web_accessible_resources?.map((resource) => {
      if (typeof resource === 'string')
        return resource
      return {
        ...resource,
        resources: resource.resources.map(path => path.includes('content') && path.endsWith('.css')
          ? '<isolated-css>'
          : path),
      }
    }),
    content_security_policy: manifest.content_security_policy,
    ...(manifest.declarative_net_request ? { declarative_net_request: manifest.declarative_net_request } : {}),
    ...(manifest.browser_specific_settings ? { browser_specific_settings: manifest.browser_specific_settings } : {}),
  }))
}

describe('manifest runtime contracts', () => {
  it('preserves the Chromium MV3 contract after WXT generation', async () => {
    const actual = await readBuiltManifest('chrome')

    expect(normalizeManifestContract(actual)).toEqual(normalizeManifestContract(chromiumContract as unknown as ExtensionManifest))
  })

  it('preserves the Firefox MV3 contract after WXT generation', async () => {
    const actual = await readBuiltManifest('firefox')

    expect(normalizeManifestContract(actual)).toEqual(normalizeManifestContract(firefoxContract as unknown as ExtensionManifest))
  })

  it('emits all extension entrypoints for both browsers', async () => {
    for (const target of ['chrome', 'firefox']) {
      const root = resolve(process.cwd(), `.output/${target}-mv3`)
      await Promise.all([
        'background.js',
        'content-scripts/content.js',
        'content-scripts/content.css',
        'content-scripts/main-world.js',
        'options.html',
        'popup.html',
      ].map(path => access(resolve(root, path))))
    }
  })

  it('retains the Firefox-only cookie forwarding branch', async () => {
    const chromeBackground = await readFile(resolve(process.cwd(), '.output/chrome-mv3/background.js'), 'utf8')
    const firefoxBackground = await readFile(resolve(process.cwd(), '.output/firefox-mv3/background.js'), 'utf8')

    expect(chromeBackground).not.toContain('cookieStoreId')
    expect(chromeBackground).not.toContain('getAll({storeId')
    expect(firefoxBackground).toContain('cookieStoreId')
    expect(firefoxBackground).toContain('getAll({storeId')
  })

  it('emits live-history signals from the MAIN-world entrypoint', async () => {
    const source = await readFile(resolve(process.cwd(), '.output/chrome-mv3/content-scripts/main-world.js'), 'utf8')
    expect(source).toContain('historyChange')
    expect(source).toContain('popstate')
    expect(source).toContain('hashchange')
  })
})
