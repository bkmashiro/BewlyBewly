import browser from 'webextension-polyfill'

import { createMomentFilterStorage } from './storage'

export function createBrowserMomentFilterStorage() {
  return createMomentFilterStorage(browser.storage.local, browser.storage.onChanged)
}
