import type { UploadItem } from './types'

/**
 * Checks if there are active uploads that would be lost on page reload.
 * Returns true for:
 * - Items with status 'uploading' (in flight)
 * - Items with status 'pending' that still have their File attached
 *
 * Excludes 'needs_file' items since they have no data to lose.
 */
export function hasActiveUploads(queue: UploadItem[]): boolean {
  if (!Array.isArray(queue)) {
    return false
  }
  return queue.some(item => item.status === 'uploading' || (item.status === 'pending' && item.file))
}

/**
 * Registers a beforeunload listener that prompts the browser's native "leave site?" dialog
 * while uploads are active. Useful for preventing accidental data loss on non-secure origins
 * where in-memory File bytes cannot be auto-resumed after reload.
 *
 * @param getQueue A function that returns the current upload queue
 * @param win Optional window object (default: global window). Useful for testing.
 * @returns An unsubscribe function that removes the beforeunload listener
 */
export function installUnloadGuard(
  getQueue: () => UploadItem[],
  win?: Window
): () => void {
  const targetWindow = win || (typeof window !== 'undefined' ? window : null)

  if (!targetWindow || typeof targetWindow.addEventListener !== 'function') {
    return () => {} // No-op cleanup function
  }

  const handler = (e: BeforeUnloadEvent) => {
    if (!hasActiveUploads(getQueue())) {
      return undefined
    }
    // Both forms are needed across browsers to trigger the confirmation prompt
    e.preventDefault()
    e.returnValue = ''
    return ''
  }

  targetWindow.addEventListener('beforeunload', handler as EventListener)

  // Return cleanup function
  return () => {
    targetWindow.removeEventListener('beforeunload', handler as EventListener)
  }
}
