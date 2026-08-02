export interface LatestRequestGuard {
  next: () => () => boolean
  dispose: () => void
}

export function createLatestRequestGuard(): LatestRequestGuard {
  let generation = 0
  let disposed = false

  return {
    next() {
      const requestGeneration = ++generation
      return () => !disposed && requestGeneration === generation
    },
    dispose() {
      disposed = true
      generation += 1
    },
  }
}
