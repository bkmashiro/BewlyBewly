import AutoImport from 'unplugin-auto-import/vite'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [
    AutoImport({
      dirs: ['src/composables'],
      dts: false,
      imports: [
        'vue',
        {
          'webextension-polyfill': [
            ['*', 'browser'],
          ],
        },
      ],
    }),
  ],
  resolve: {
    alias: {
      '~/': `${new URL('./src/', import.meta.url).pathname}`,
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    root: 'src',
  },
})
