import type { UploadItem } from './types'

/**
 * Checks if there are active uploads that would be lost on page reload.
 * Returns true for:
 * - Items with status 'uploading' (in flight)
 * - Items with status 'pending' that still have their File attached
 *
 * Any other status (done, error, paused, conflict) has no in-flight bytes to
 * lose, so those items don't count.
 */
export function hasActiveUploads(queue: UploadItem[]): boolean {
  if (!Array.isArray(queue)) {
    return false
  }
  return queue.some(item => item.status === 'uploading' || (item.status === 'pending' && item.file))
}

/**
 * Batch ids that still have unfinished work — the set that gets an interrupt
 * signal when the page goes away. Deduped; items with no batchId are ignored.
 */
export function activeBatchIds(queue: UploadItem[]): string[] {
  const ids = new Set<string>()
  if (!Array.isArray(queue)) return []
  for (const it of queue) {
    // Same shape as hasActiveUploads' pending check (a pending item only counts
    // if its File is still attached) — kept in sync so the two guards over the
    // same event flow don't quietly drift apart.
    if ((it.status === 'uploading' || (it.status === 'pending' && it.file)) && it.batchId) ids.add(it.batchId)
  }
  return [...ids]
}

/**
 * Registers a beforeunload listener that prompts the browser's native "leave site?" dialog
 * while uploads are active. Useful for preventing accidental data loss on non-secure origins
 * where in-memory File bytes cannot be auto-resumed after reload.
 *
 * Also registers a pagehide listener that, when an `interruptBatch` callback is supplied,
 * signals every still-active batch that the page is going away.
 *
 * @param getQueue A function that returns the current upload queue
 * @param win Optional window object (default: global window). Useful for testing.
 * @param interruptBatch Optional callback invoked with each active batch id on pagehide.
 * @returns An unsubscribe function that removes both listeners
 */
export function installUnloadGuard(
  getQueue: () => UploadItem[],
  win?: Window,
  interruptBatch?: (id: string) => void,
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

  // pagehide fires reliably on both "user confirmed leave" and an outright window
  // close, unlike beforeunload's return value which only controls the prompt. Send
  // an interrupt signal per active batch so the NAS marks it interrupted and clears
  // staging immediately — the torn badge shows up right away. If the signal itself
  // is lost (power cut, process killed), the server's own idle-timeout sweep is the
  // fallback.
  const onPageHide = () => {
    if (!interruptBatch) return
    for (const id of activeBatchIds(getQueue())) interruptBatch(id)
  }

  targetWindow.addEventListener('beforeunload', handler as EventListener)
  targetWindow.addEventListener('pagehide', onPageHide)

  // Return cleanup function
  return () => {
    targetWindow.removeEventListener('beforeunload', handler as EventListener)
    targetWindow.removeEventListener('pagehide', onPageHide)
  }
}
