import { BILIBILI_PAGE_MATCHES } from '~/constants/extension'

const HISTORY_CHANGE_EVENT = 'historyChange'

type MarkedWindow = Window & { ___inject?: boolean }

function setupMainWorld() {
  const markedWindow = window as MarkedWindow
  if (markedWindow.___inject)
    return () => {}

  const originalPushState = window.history.pushState.bind(window.history)
  const originalReplaceState = window.history.replaceState.bind(window.history)
  const originalForward = window.history.forward.bind(window.history)
  const notify = (...detail: unknown[]) => window.dispatchEvent(new CustomEvent(HISTORY_CHANGE_EVENT, { detail }))
  const notifyLocationChange = () => notify()

  window.history.pushState = (...args) => {
    const result = originalPushState(...args)
    notify(...args)
    return result
  }
  window.history.replaceState = (...args) => {
    const result = originalReplaceState(...args)
    notify(...args)
    return result
  }
  window.history.forward = () => {
    return originalForward()
  }
  window.addEventListener('popstate', notifyLocationChange)
  window.addEventListener('hashchange', notifyLocationChange)
  markedWindow.___inject = true

  return () => {
    window.history.pushState = originalPushState
    window.history.replaceState = originalReplaceState
    window.history.forward = originalForward
    window.removeEventListener('popstate', notifyLocationChange)
    window.removeEventListener('hashchange', notifyLocationChange)
    delete markedWindow.___inject
  }
}

export default defineContentScript({
  matches: BILIBILI_PAGE_MATCHES,
  allFrames: true,
  runAt: 'document_start',
  world: 'MAIN',
  main() {
    setupMainWorld()
  },
})
