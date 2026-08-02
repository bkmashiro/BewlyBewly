import { resolve } from 'node:path'

import VueI18nPlugin from '@intlify/unplugin-vue-i18n/vite'
import UnoCSS from 'unocss/vite'
import AutoImport from 'unplugin-auto-import/vite'
import { defineConfig } from 'wxt'

import packageJson from './package.json'

export default defineConfig({
  srcDir: 'src',
  publicDir: 'public',
  modules: ['@wxt-dev/module-vue'],
  targetBrowsers: ['chrome', 'firefox', 'safari'],
  webExt: {
    chromiumProfile: 'web-ext-profile/chrome',
    firefoxProfile: 'web-ext-profile/firefox',
    keepProfileChanges: true,
    startUrls: ['https://www.bilibili.com/'],
  },
  alias: {
    '~': 'src',
  },
  manifest: ({ browser, mode }) => {
    const isFirefox = browser === 'firefox'
    const isDevelopment = mode === 'development'

    return {
      name: `${packageJson.displayName || packageJson.name}${isDevelopment ? ' Dev' : ''}`,
      version: packageJson.version,
      description: packageJson.description,
      homepage_url: packageJson.homepage,
      icons: {
        16: 'assets/icon-16.png',
        48: 'assets/icon-48.png',
        128: 'assets/icon-128.png',
      },
      permissions: [
        'storage',
        'declarativeNetRequest',
        'tabs',
        ...(mode === 'development' ? ['webNavigation'] : []),
        ...(isFirefox ? ['webRequest', 'webRequestBlocking', 'cookies'] : []),
      ],
      host_permissions: [
        '*://*.bilibili.com/*',
        '*://*.hdslb.com/*',
      ],
      web_accessible_resources: [{
        resources: ['content-scripts/*.css', 'assets/*'],
        matches: ['<all_urls>'],
      }],
      ...(isDevelopment
        ? {}
        : {
            content_security_policy: {
              extension_pages: 'script-src \'self\'; object-src \'self\'',
            },
          }),
      ...(isFirefox
        ? {
            browser_specific_settings: {
              gecko: {
                id: 'addon@bewlybewly.com',
                data_collection_permissions: {
                  required: ['none'],
                },
              },
            },
          }
        : {
            declarative_net_request: {
              rule_resources: [{
                id: 'ruleset_1',
                enabled: true,
                path: 'assets/rules.json',
              }],
            },
          }),
    }
  },
  hooks: {
    'build:manifestGenerated': (_wxt, manifest) => {
      // These pages were built but intentionally unlisted in v0.41.1.
      delete manifest.action
      delete manifest.options_ui
    },
  },
  vite: () => ({
    plugins: [
      AutoImport({
        dirs: ['src/composables'],
        dts: 'src/auto-imports.d.ts',
        imports: [
          'vue',
          {
            'webextension-polyfill': [['*', 'browser']],
          },
        ],
      }),
      VueI18nPlugin({
        runtimeOnly: true,
        compositionOnly: true,
        strictMessage: false,
        include: [resolve('src/_locales/**')],
      }),
      UnoCSS(),
    ],
    build: {
      minify: 'terser',
      terserOptions: {
        mangle: false,
      },
    },
  }),
})
