/**
 * Prompts the browser's native "leave site?" dialog while a peer-to-peer
 * transfer is running. Bytes in flight live only in this tab, so a reload or
 * close loses them with no server-side record to resume from.
 *
 * Mounted from DropPage, not from App.vue -- the opposite of
 * src/files/upload/unloadGuard.ts, and deliberately so. Each guard lives where
 * its work lives: the upload queue is an app-level store that keeps running
 * after navigation, so its guard sits in App.vue; drop transfers exist only
 * while DropPage is mounted (its onBeforeUnmount tears the connections down),
 * so an app-level listener here would just idle at all times.
 */
export function installDropUnloadGuard(hasActive: () => boolean, win?: Window): () => void {
  const target = win || (typeof window !== 'undefined' ? window : null)
  if (!target || typeof target.addEventListener !== 'function') return () => {}

  const handler = (e: BeforeUnloadEvent) => {
    if (!hasActive()) return undefined
    // Both forms are needed across browsers to raise the prompt
    e.preventDefault()
    e.returnValue = ''
    return ''
  }

  target.addEventListener('beforeunload', handler as EventListener)
  return () => target.removeEventListener('beforeunload', handler as EventListener)
}
