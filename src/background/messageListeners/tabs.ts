import browser from 'webextension-polyfill'

interface Message {
  contentScriptQuery: string
  url: string
}

export enum TABS_MESSAGE {
  OPEN_LINK_IN_BACKGROUND = 'openLinkInBackground',
}

function isMessage(value: unknown): value is Message {
  return typeof value === 'object'
    && value !== null
    && 'contentScriptQuery' in value
    && typeof value.contentScriptQuery === 'string'
    && 'url' in value
    && typeof value.url === 'string'
}

function handleMessage(value: unknown) {
  if (isMessage(value) && value.contentScriptQuery === TABS_MESSAGE.OPEN_LINK_IN_BACKGROUND) {
    return browser.tabs.create({ url: value.url, active: false })
  }
}

export function setupTabMsgLstnrs() {
  browser.runtime.onMessage.removeListener(handleConnect)
  browser.runtime.onMessage.addListener(handleConnect)
}

function handleConnect() {
  browser.runtime.onMessage.removeListener(handleMessage)
  browser.runtime.onMessage.addListener(handleMessage)
}
