### Task 13: 离站守卫 —— 路由离开 + 关页

**Files:**
- Create: `src/files/drop/leaveGuard.ts`, `src/files/drop/leaveGuard.test.ts`
- Modify: `src/files/drop/components/DropPage.vue`
- Test: `src/files/drop/components/DropPage.test.ts`(不存在则新建)

**Interfaces:**
- Produces: `installDropUnloadGuard(hasActive: () => boolean, win?: Window): () => void`

⚠️ **形态照 `src/files/upload/unloadGuard.ts`,但装载位置故意不同 —— 且理由不是「那边装错了」。**

**计划撰写期实测更正**:票 A(`installUnloadGuard` 装在 `Files.vue`)**已经修好了**,随 master 合并进来 —— 现在装在 `src/App.vue:75`,并有 `src/App.unloadGuard.test.ts` 专门守着。**不要再把它当成现存缺陷去援引**(本仓教训:计划里写死的事实会先于计划腐烂,援引先例前先核现场)。

正确的对比是**作用域**:上传队列是**应用级** Pinia store、导航走了照传 ⇒ 守卫必须装在应用级;互传传输**只在 drop 页存在**(`DropPage` 的 `onBeforeUnmount` 就调 `drop.destroy()` 把连接全拆了)⇒ 守卫装在页面级才对。装到应用级反而会在没有 drop 页的时候常驻一个恒假的监听器。这条理由要写成英文注释。

- [ ] **Step 1: 写失败测试**

```ts
// src/files/drop/leaveGuard.test.ts
import { describe, it, expect, vi } from 'vitest'
import { installDropUnloadGuard } from './leaveGuard'

function fakeWindow() {
  const handlers: Record<string, EventListener[]> = {}
  return {
    handlers,
    addEventListener: (t: string, h: EventListener) => { (handlers[t] ||= []).push(h) },
    removeEventListener: (t: string, h: EventListener) => {
      handlers[t] = (handlers[t] || []).filter((x) => x !== h)
    },
  } as unknown as Window & { handlers: Record<string, EventListener[]> }
}

describe('installDropUnloadGuard', () => {
  it('prompts the browser while a transfer is running', () => {
    const win = fakeWindow() as never as Window & { handlers: Record<string, EventListener[]> }
    installDropUnloadGuard(() => true, win)
    const e = { preventDefault: vi.fn(), returnValue: undefined } as unknown as BeforeUnloadEvent
    win.handlers.beforeunload[0](e as unknown as Event)
    expect(e.preventDefault).toHaveBeenCalled()
  })

  it('stays out of the way when nothing is in flight', () => {
    const win = fakeWindow() as never as Window & { handlers: Record<string, EventListener[]> }
    installDropUnloadGuard(() => false, win)
    const e = { preventDefault: vi.fn(), returnValue: undefined } as unknown as BeforeUnloadEvent
    win.handlers.beforeunload[0](e as unknown as Event)
    expect(e.preventDefault).not.toHaveBeenCalled()
  })

  it('removes its listener when the returned cleanup runs', () => {
    const win = fakeWindow() as never as Window & { handlers: Record<string, EventListener[]> }
    const off = installDropUnloadGuard(() => true, win)
    off()
    expect(win.handlers.beforeunload.length).toBe(0)
  })

  it('is a no-op in an environment with no window', () => {
    expect(() => installDropUnloadGuard(() => true, undefined as never)()).not.toThrow()
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm exec vitest run src/files/drop/leaveGuard.test.ts`
Expected: FAIL —— 模块不存在

- [ ] **Step 3: 写实现**

```ts
// src/files/drop/leaveGuard.ts

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
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm exec vitest run src/files/drop/leaveGuard.test.ts`
Expected: 4/4 PASS

- [ ] **Step 5: 加路由离开确认(`DropPage.vue`)**

i18n 三个键 —— `zh_cn.base.ts`:

```ts
  filesDropLeaveTitle: '传输正在进行',
  filesDropLeaveMessage: '离开此页会中断正在进行的文件传输。确定要离开吗?',
  filesDropLeaveConfirm: '离开',
```

`en_us.base.ts`:

```ts
  filesDropLeaveTitle: 'Transfer in progress',
  filesDropLeaveMessage: 'Leaving this page will interrupt the transfer in progress. Leave anyway?',
  filesDropLeaveConfirm: 'Leave',
```

`DropPage.vue` 的 `<script setup>`:

```ts
import { onBeforeRouteLeave } from 'vue-router'
import AlertDialog from '../../../components/ui/AlertDialog.vue'
import { installDropUnloadGuard } from '../leaveGuard'

const leaveOpen = ref(false)
let leaveResolver: ((ok: boolean) => void) | null = null

function settleLeave(ok: boolean) {
  const r = leaveResolver
  if (!r) return
  leaveResolver = null
  leaveOpen.value = false
  r(ok)
}

// reka-ui's AlertDialogAction fires update:open(false) on the SAME click that
// runs our @confirm, and the order is not guaranteed (see the note in
// UploadPanel.vue). Deferring the cancel answer by a tick lets a confirm that
// lands in the same task win; a real cancel has no confirm behind it, so its
// deferred answer still runs.
function onLeaveOpenChange(v: boolean) {
  leaveOpen.value = v
  if (!v) setTimeout(() => settleLeave(false), 0)
}

function askLeave(): Promise<boolean> {
  return new Promise((resolve) => {
    leaveResolver = resolve
    leaveOpen.value = true
  })
}

onBeforeRouteLeave(async () => {
  if (!drop.hasActiveTransfers()) return true
  return await askLeave()
})

let offUnloadGuard: (() => void) | null = null
```

`onMounted` 里加 `offUnloadGuard = installDropUnloadGuard(() => drop.hasActiveTransfers())`;
`onBeforeUnmount` 里加 `offUnloadGuard?.(); offUnloadGuard = null`(**放在 `drop.destroy()` 之前**)。

模板末尾加:

```vue
    <AlertDialog
      :open="leaveOpen"
      :title="t('filesDropLeaveTitle')"
      :message="t('filesDropLeaveMessage')"
      :confirm-text="t('filesDropLeaveConfirm')"
      :cancel-text="t('filesCancel')"
      destructive
      @update:open="onLeaveOpenChange"
      @confirm="settleLeave(true)"
    />
```

⚠️ 取消按钮用**既有**的 `filesCancel`(`src/i18n/zh_cn.base.ts:76` = '取消'),已核实存在。**不要新造重复的取消键**。

- [ ] **Step 6: 写 DropPage 测试**

**现场已核实**:本仓有 `createRouter` + `createMemoryHistory` 的测试先例(`src/App.unloadGuard.test.ts`、`src/storage/components/StorageShell.test.ts` 等 5 个文件),照它们的手法搭即可。
⚠️ 但 **`onBeforeRouteLeave` 在本仓是零先例**(`grep -rn "onBeforeRouteLeave" src/` 目前无命中),Task 13 是第一处 —— 所以这条测试要真的**驱动一次导航**来触发守卫,不能只断言「函数被注册了」。

```ts
// src/files/drop/components/DropPage.test.ts —— 只测离站守卫接线,不测布局
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { i18n } from '../../../i18n'
import DropPage from './DropPage.vue'
import { useDropStore } from '../stores/drop'

async function mountAtDropRoute() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/files/drop', component: DropPage },
      { path: '/elsewhere', component: { template: '<div>elsewhere</div>' } },
    ],
  })
  router.push('/files/drop')
  await router.isReady()
  const wrapper = mount({ template: '<router-view />' }, { global: { plugins: [router, i18n] } })
  await flushPromises()
  return { router, wrapper }
}

describe('DropPage leave guard', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('lets navigation through untouched when no transfer is running', async () => {
    const { router } = await mountAtDropRoute()
    const drop = useDropStore()
    drop.hasActiveTransfers = () => false

    await router.push('/elsewhere')
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/elsewhere')
  })

  it('holds navigation on the drop page until the user confirms', async () => {
    const { router, wrapper } = await mountAtDropRoute()
    const drop = useDropStore()
    drop.hasActiveTransfers = () => true

    const nav = router.push('/elsewhere')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/files/drop') // still held

    wrapper.findComponent({ name: 'AlertDialog' }).vm.$emit('confirm')
    await nav
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/elsewhere')
  })

  it('stays on the page when the user backs out', async () => {
    const { router, wrapper } = await mountAtDropRoute()
    const drop = useDropStore()
    drop.hasActiveTransfers = () => true

    void router.push('/elsewhere')
    await flushPromises()
    wrapper.findComponent({ name: 'AlertDialog' }).vm.$emit('update:open', false)
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/files/drop')
  })
})
```

⚠️ `DropPage` 的 `onMounted` 会调 `drop.init()`(真的开 WebSocket)与 `files.loadRoots()`(真的发 HTTP)。**上面三条测试若因此报网络错或超时,不要改生产代码去迁就测试** —— 用 `vi.mock` 把 `@nimotech/nimoos-service` 与 `../stores/drop` 的 `init`/`destroy` 打桩(照 `App.unloadGuard.test.ts` 顶部那套 `vi.mock` 手法)。若打桩后仍跑不通,**停下来报告,由控制器裁定**,不要自行把守卫逻辑挪出组件。

- [ ] **Step 7: 跑全套 + 类型检查(前台)**

Run: `pnpm exec vitest run src/files/drop/ src/i18n/parity.test.ts && pnpm exec vue-tsc --noEmit`
Expected: 全绿,exit 0

- [ ] **Step 8: 变异验证**

把 `onBeforeRouteLeave` 里的 `if (!drop.hasActiveTransfers()) return true` 改成恒 `return true`,重跑 → 守卫测试必须真红。恢复后全绿。

- [ ] **Step 9: 提交**

```bash
git add src/files/drop/leaveGuard.ts src/files/drop/leaveGuard.test.ts src/files/drop/components/DropPage.vue src/files/drop/components/DropPage.test.ts src/i18n/zh_cn.base.ts src/i18n/en_us.base.ts
git commit -m "feat(drop): ask before leaving or closing during a transfer

Mounted at page scope on purpose -- unlike the upload guard, whose Files.vue
mount point is a known defect for an app-level queue.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## 收尾门(控制器统一跑,不在任务内)

```bash
pnpm exec vue-tsc --noEmit
pnpm exec vitest run
pnpm exec vitest run src/i18n/parity.test.ts
pnpm build
node oss/export.mjs --out /tmp/claude-1000/oss-preview --no-commit --allow-dirty-oss
```

**跑 oss 门前必须先提交。** 另:`src/home/components/DesktopContextMenu.test.ts` **只在单独跑那一个文件时**失败(SP11 遗留的 reka-ui 隔离 flake),全量套件里是绿的 —— 别去追。

---

## 真机验收清单

见设计文档 §5(T10 六步 + #90 六步)。⚠️ **T10 那六步必须用 ≥5GB 的文件** —— 后端每 3 秒采样一次进度,而本机本地复制 1.4 GB/s,小文件粘贴根本来不及产生任何中间进度,照小文件验会把「做好了」误判成「没做」。#90 那六步需要**两台设备**。
