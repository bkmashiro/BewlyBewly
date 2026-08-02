import { createBrowserMomentFilterStorage } from './browser-storage'
import { createMomentFilterController } from './controller'

let cleanupActiveController: (() => void) | undefined

export function setupMomentFilter(): () => void {
  cleanupActiveController?.()
  cleanupActiveController = undefined

  if (window.top !== window || window.location.origin !== 'https://t.bilibili.com')
    return () => {}

  const controller = createMomentFilterController({
    window,
    document,
    storage: createBrowserMomentFilterStorage(),
    onDiagnostic: (message) => {
      if (import.meta.env.DEV)
        console.warn(`[BewlyBewly moment filter] ${message}`)
    },
  })
  const cleanup = () => {
    controller.cleanup()
    if (cleanupActiveController === cleanup)
      cleanupActiveController = undefined
  }
  cleanupActiveController = cleanup
  return cleanup
}
