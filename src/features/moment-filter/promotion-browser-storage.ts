import browser from 'webextension-polyfill'

import { createPromotionLearningStorage } from './promotion-storage'

export function createBrowserPromotionLearningStorage() {
  return createPromotionLearningStorage(browser.storage.local, browser.storage.onChanged)
}
