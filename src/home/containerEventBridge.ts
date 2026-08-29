/** Pure-logic bridge from docker daemon container events to instant desktop sync (unit-testable; Home.vue only does the wiring).
 *  Contract: spec 2026-07-16-container-event-push-design.md. */
export const CONTAINER_EVENT = 'docker:container:state-changed'

export function createContainerEventHandler(opts: {
  evict: (key: string) => void
  refresh: () => void
  debounceMs?: number
}): { handle: (props: unknown) => void; dispose: () => void } {
  const ms = opts.debounceMs ?? 500
  let timer: ReturnType<typeof setTimeout> | null = null
  function handle(props: unknown) {
    const p = (props && typeof props === 'object' ? props : {}) as Record<string, unknown>
    const action = typeof p['docker:container:action'] === 'string' ? p['docker:container:action'] : ''
    const name = typeof p['docker:container:name'] === 'string' ? p['docker:container:name'] : ''
    if (action === 'destroy' && name) opts.evict(name)
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => { timer = null; opts.refresh() }, ms)
  }
  // Cancel a pending debounce timer (e.g. on component unmount); idempotent — repeated calls are harmless
  function dispose() {
    if (timer) { clearTimeout(timer); timer = null }
  }
  return { handle, dispose }
}

/** App-uninstall-complete event. Unlike container destroy, it is an explicit "app no longer exists" signal
 *  (not fired on update/rebuild) — the desktop can safely force-clear its slot, removing manually pinned tiles too. */
export const APP_UNINSTALL_END = 'app:uninstall-end'

export function createUninstallEndHandler(opts: {
  evictForce: (key: string) => void
  refresh: () => void
}): (props: unknown) => void {
  return (props: unknown) => {
    const p = (props && typeof props === 'object' ? props : {}) as Record<string, unknown>
    const name = typeof p['app:name'] === 'string' ? p['app:name'] : ''
    if (name) opts.evictForce(name)
    opts.refresh()
  }
}
