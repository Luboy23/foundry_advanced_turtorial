export const scheduleIdleTask = (
  callback: () => void,
  timeout = 200,
): (() => void) => {
  if (typeof window === 'undefined') {
    return () => {}
  }

  const requestIdle = window.requestIdleCallback?.bind(window)
  const cancelIdle = window.cancelIdleCallback?.bind(window)

  if (requestIdle) {
    const idleId = requestIdle(() => callback(), { timeout })
    return () => {
      cancelIdle?.(idleId)
    }
  }

  const timerId = window.setTimeout(callback, Math.min(timeout, 120))
  return () => {
    window.clearTimeout(timerId)
  }
}
