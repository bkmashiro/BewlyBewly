import { BILIBILI_PAGE_MATCHES } from '~/constants/extension'
import { cleanupContentScript, setupContentScript } from '~/contentScripts'

export default defineContentScript({
  matches: BILIBILI_PAGE_MATCHES,
  allFrames: true,
  matchAboutBlank: true,
  runAt: 'document_start',
  main(ctx) {
    setupContentScript()
    ctx.onInvalidated(cleanupContentScript)
  },
})
