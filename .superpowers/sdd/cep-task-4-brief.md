### Task 4: 前端事件桥 + Home.vue 接线

**Files:**
- Create: `/home/nimo/NimoTech/NimoOS-New-UI/src/home/containerEventBridge.ts`
- Test: `/home/nimo/NimoTech/NimoOS-New-UI/src/home/containerEventBridge.test.ts`
- Modify: `/home/nimo/NimoTech/NimoOS-New-UI/src/views/Home.vue`

**Interfaces:**
- Consumes: Task 3 的 `layout.evict(key)`；既有 `useMessageBus().on(event, cb): () => void`（`src/composables/useMessageBus.ts`，回调第一参已经 `extractProps` 解包）；Home.vue 既有 `refreshApps()`。
- Produces: `CONTAINER_EVENT`（=`docker:container:state-changed`）与 `createContainerEventHandler({ evict, refresh, debounceMs? }): (props: unknown) => void`。

- [ ] **Step 1: 写失败测试** — 新建 `containerEventBridge.test.ts`：

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createContainerEventHandler, CONTAINER_EVENT } from './containerEventBridge'

describe('containerEventBridge', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('事件名与后端契约一致', () => {
    expect(CONTAINER_EVENT).toBe('docker:container:state-changed')
  })

  it('destroy 立即 evict,其余动作不 evict', () => {
    const evict = vi.fn(); const refresh = vi.fn()
    const h = createContainerEventHandler({ evict, refresh })
    h({ 'docker:container:action': 'destroy', 'docker:container:name': 'tasklist' })
    expect(evict).toHaveBeenCalledWith('tasklist')
    h({ 'docker:container:action': 'die', 'docker:container:name': 'a' })
    h({ 'docker:container:action': 'start', 'docker:container:name': 'b' })
    expect(evict).toHaveBeenCalledTimes(1)
  })

  it('连发事件去抖成一次 refresh', () => {
    const evict = vi.fn(); const refresh = vi.fn()
    const h = createContainerEventHandler({ evict, refresh })
    h({ 'docker:container:action': 'die', 'docker:container:name': 'a' })
    h({ 'docker:container:action': 'destroy', 'docker:container:name': 'a' })
    expect(refresh).not.toHaveBeenCalled()
    vi.advanceTimersByTime(500)
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('畸形消息(缺属性/非对象)不抛错不触发 evict', () => {
    const evict = vi.fn(); const refresh = vi.fn()
    const h = createContainerEventHandler({ evict, refresh })
    expect(() => { h(null); h('x'); h({}) }).not.toThrow()
    expect(evict).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: 跑测试确认失败** — `pnpm exec vitest run src/home/containerEventBridge.test.ts`，预期：模块不存在。

- [ ] **Step 3: 最小实现** — 新建 `containerEventBridge.ts`：

```ts
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
```

- [ ] **Step 4: 跑测试确认通过** — 同 Step 2 命令，预期全绿。

- [ ] **Step 5: Home.vue 接线** — 修改 `src/views/Home.vue`：

script 顶部 import 区追加：

```ts
import { useMessageBus } from '../composables/useMessageBus'
import { createContainerEventHandler, CONTAINER_EVENT } from '../home/containerEventBridge'
```

`let onFocus: (() => void) | null = null` 之后追加：

```ts
let offContainerEvents: (() => void) | null = null
```

`onMounted` 内 `window.addEventListener('focus', onFocus)` 之后追加：

```ts
  // docker daemon 事件推送:destroy 立即清位,其余去抖刷新(轮询仍是兜底)
  offContainerEvents = useMessageBus().on(
    CONTAINER_EVENT,
    createContainerEventHandler({ evict: (k) => layout.evict(k), refresh: refreshApps }),
  )
```

`onUnmounted` 内追加：

```ts
  if (offContainerEvents) offContainerEvents()
```

- [ ] **Step 6: 类型检查与全量测试** — `pnpm exec vue-tsc --noEmit && pnpm test`，预期无类型错误、测试全绿。
- [ ] **Step 7: 提交** — `git add src/home/containerEventBridge.ts src/home/containerEventBridge.test.ts src/views/Home.vue && git commit -m "feat(home): 订阅 docker 容器事件推送,桌面秒级同步(destroy 即清,余者去抖刷新)"`

---

