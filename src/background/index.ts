import browser from 'webextension-polyfill'

import { setupApiMsgLstnrs } from './messageListeners/api'
import { setupTabMsgLstnrs } from './messageListeners/tabs'

function isExtensionUri(url: string) {
  return new URL(url).origin === new URL(browser.runtime.getURL('')).origin
}

let isBackgroundSetup = false

export function setupBackground() {
  if (isBackgroundSetup)
    return

  isBackgroundSetup = true

  browser.runtime.onInstalled.addListener(async () => {
    // eslint-disable-next-line no-console
    console.log('Extension installed')
  })

  if (import.meta.env.BROWSER === 'firefox') {
    browser.webRequest.onBeforeSendHeaders.addListener(
      (details: browser.WebRequest.OnBeforeSendHeadersDetailsType) => {
        const requestHeaders: browser.WebRequest.HttpHeaders = []
        if (details.documentUrl) {
          const url = new URL(details.documentUrl)
          const extensionUri = isExtensionUri(details.documentUrl)
          details.requestHeaders = details.requestHeaders || []
          for (let i = 0; i < details.requestHeaders.length; i++) {
            if (details.requestHeaders[i].name.toLowerCase() === 'origin' || details.requestHeaders[i].name.toLowerCase() === 'referer')
              requestHeaders.push({ name: details.requestHeaders[i].name, value: extensionUri ? 'https://www.bilibili.com' : url.origin })
            else
              requestHeaders.push(details.requestHeaders[i])

            if (details.requestHeaders[i].name === 'firefox-multi-account-cookie') {
              requestHeaders.push({ name: 'cookie', value: details.requestHeaders[i].value })
            }
          }

          return { requestHeaders }
        }
      },
      { urls: ['<all_urls>'] },
      ['blocking', 'requestHeaders'],
    )
  }

  // Setup all message listeners
  setupApiMsgLstnrs()
  setupTabMsgLstnrs()
}
