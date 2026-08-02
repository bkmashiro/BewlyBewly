import { BILIBILI_PAGE_MATCHES } from '~/constants/extension'
import { cleanupContentScript, setupContentScript } from '~/contentScripts'
import { setupMomentFilter } from '~/features/moment-filter'

export default defineContentScript({
  matches: BILIBILI_PAGE_MATCHES,
  allFrames: true,
  matchAboutBlank: true,
  runAt: 'document_start',
  main(ctx) {
    setupContentScript()
    const cleanupMomentFilter = setupMomentFilter()
    ctx.onInvalidated(() => {
      cleanupMomentFilter()
      cleanupContentScript()
    })
  },
})
