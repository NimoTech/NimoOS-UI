/** docker daemon 容器事件 → 桌面即时同步的纯逻辑桥(便于单测,Home.vue 只做接线)。
 *  契约:spec 2026-07-16-container-event-push-design.md。 */
export const CONTAINER_EVENT = 'docker:container:state-changed'

export function createContainerEventHandler(opts: {
  evict: (key: string) => void
  refresh: () => void
  debounceMs?: number
}): (props: unknown) => void {
  const ms = opts.debounceMs ?? 500
  let timer: ReturnType<typeof setTimeout> | null = null
  return (props: unknown) => {
    const p = (props && typeof props === 'object' ? props : {}) as Record<string, unknown>
    const action = typeof p['docker:container:action'] === 'string' ? p['docker:container:action'] : ''
    const name = typeof p['docker:container:name'] === 'string' ? p['docker:container:name'] : ''
    if (action === 'destroy' && name) opts.evict(name)
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => { timer = null; opts.refresh() }, ms)
  }
}
