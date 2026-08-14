// Stale tab × redeploy: lazy-loaded chunks (viewers/lazy routes) have hashed filenames,
// and deploy.sh's rsync --delete removes old hashed files. In a tab opened before the
// deploy, the first click on these features makes the dynamic import 404 → the UI does
// nothing, and the failed module fetch is cached by the browser, so retrying the same
// URL cannot self-heal; only a full page reload fetching the new index.html recovers
// (reproduced on device: after pasting a screenshot, left-click won't open it; a manual
// refresh is required). Vite dispatches vite:preloadError on window when a preload fails —
// on receipt we auto-reload the whole page, performing that "required refresh" for the user.
// sessionStorage records the last auto-reload time; no repeat within 10s: if it still fails
// after a reload (e.g. the server is really down), we must not enter an infinite reload loop.

const KEY = 'nimoos-chunk-reload-at'
const MIN_INTERVAL_MS = 10_000

export function shouldReload(now: number, storage: Pick<Storage, 'getItem' | 'setItem'>): boolean {
  const last = Number(storage.getItem(KEY) || 0)
  if (now - last < MIN_INTERVAL_MS) return false
  storage.setItem(KEY, String(now))
  return true
}

export function installChunkReloadGuard(
  target: Pick<Window, 'addEventListener'> = window,
  reload: () => void = () => window.location.reload(),
  storage: Pick<Storage, 'getItem' | 'setItem'> = sessionStorage,
): void {
  target.addEventListener('vite:preloadError', (e: Event) => {
    if (!shouldReload(Date.now(), storage)) return // throttled: let the error bubble normally so it is visible in the console
    e.preventDefault() // about to reload the whole page; swallow this unhandled exception
    reload()
  })
}
