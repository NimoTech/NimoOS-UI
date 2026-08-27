// Fix wave K (Files Time Machine Vue2-parity line, owner acceptance 2026-08-26): owner-facing
// diagnostics for the travel lifecycle (TimeMachineDepthStack.vue's own watcher fires/token
// bumps/runTravel calls/timeline kills/settle paths, and snapshotBrowse.ts's own store-side
// safety ceiling), gated behind `localStorage.getItem('tmDebug')` so it costs nothing in normal
// operation and can be switched on live in DevTools without a rebuild -- exactly the kind of
// "why did this freeze" question the owner had no way to answer from the DOM alone (see this
// module's own consumers for the specific reason: DevTools' element picker skips
// `pointer-events: none` depth-stack strips, so `Ctrl+F` on `data-snapshot` in the Elements panel
// is the only DOM-level way in; this console channel is the complementary behavioral trace).
//
// Read ONCE per module load (not on every call) -- `localStorage.getItem` is cheap, but the whole
// point of a debug flag is that leaving it off costs as close to nothing as possible; a single
// boolean check per call site is already negligible, no need to re-read storage every time.
const TM_DEBUG_ENABLED = (() => {
  try {
    return !!localStorage.getItem('tmDebug')
  }
  catch {
    // Storage can throw (private browsing, disabled cookies) -- default to off, never let a
    // debug aid itself break the app.
    return false
  }
})()

/** Owner-facing console trace for the Time Machine travel lifecycle. No-op (zero cost beyond one
 *  boolean check) unless `localStorage.setItem('tmDebug', '1')` was set before this module loaded.
 *  English text only -- this is a diagnostic channel, not user-facing UI copy. */
export function tmDebugLog(...args: unknown[]): void {
  if (!TM_DEBUG_ENABLED) return
  console.log('[tm-debug]', ...args)
}
