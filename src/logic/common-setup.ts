import type { App } from 'vue'

import { createPinia } from 'pinia'
import Toast, { POSITION } from 'vue-toastification'
import components from '~/components'

import { i18n } from '~/utils/i18n'
import 'vue-toastification/dist/index.css'

const pinia = createPinia()

export async function setupApp(app: App) {
  app.use(i18n)
  app
    .use(Toast, {
      transition: 'Vue-Toastification__fade',
      maxToasts: 20,
      newestOnTop: true,
      position: POSITION.TOP_RIGHT,
    })
  app.use(components)
  app.use(pinia)
}
