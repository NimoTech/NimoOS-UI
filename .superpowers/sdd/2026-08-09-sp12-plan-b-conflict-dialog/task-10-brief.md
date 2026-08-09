## Task 10: 票 A —— unloadGuard 搬到应用级

**Files:**
- Modify: `src/App.vue`, `src/views/Files.vue`
- Test: `src/App.unloadGuard.test.ts`（新建）

**问题**：`installUnloadGuard` 装在 `Files.vue` 的 `onMounted`、拆在 `onUnmounted`，但上传队列是**应用级** Pinia store（导航走了照传，也没有任何东西在 unmount 时取消队列）。开着上传离开 `/files` 再关标签页 → 中断信号不发、离站提示也不弹，只能等服务端 120s 空闲兜底，Plan A「关窗即刻标中断」的目标在这条路径上直接落空。

- [ ] **Step 1: 写失败的测试**

创建 `src/App.unloadGuard.test.ts`：

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import App from './App.vue'
import { useUploadsStore } from './files/stores/uploads'

// 实现者:照 src/ 下既有的 App/router 测试补齐 router 与 service 的 mock。

describe('App-level unload guard', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('signals every active batch on pagehide even when Files is not mounted', async () => {
    const interrupt = vi.fn()
    // mock service.uploadBatches.interruptBatch -> interrupt
    mount(App, { /* global mocks */ })
    const uploads = useUploadsStore()
    uploads.queue.push({ /* 一条 status:'uploading'、batchId:'b1' 的 UploadItem */ } as never)
    window.dispatchEvent(new Event('pagehide'))
    expect(interrupt).toHaveBeenCalledWith('b1')
  })

  it('warns before leaving while an upload is in flight', async () => {
    mount(App, { /* global mocks */ })
    const uploads = useUploadsStore()
    uploads.queue.push({ /* status:'uploading' */ } as never)
    const e = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(e)
    expect(e.defaultPrevented).toBe(true)
  })
})
```

并在 `src/views/__tests__/` 下加一例守住它**不再**装在 Files.vue（防止将来有人装回去，变成双份中断信号）：

```ts
  it('does not install its own unload guard — that lives at app level now', () => {
    // 断言 Files.vue 挂载/卸载不改变 window 上 beforeunload 监听的数量,
    // 或直接断言 Files.vue 源码不再 import installUnloadGuard(用 node:fs 读源文件)。
  })
```

- [ ] **Step 2: 跑测试确认它失败**

Run: `pnpm exec vitest run src/App.unloadGuard.test.ts`
Expected: FAIL — `interrupt` 没被调用（App.vue 还没装）

- [ ] **Step 3: 改实现**

`src/App.vue` script 里加：

```ts
import { onMounted, onUnmounted } from 'vue'
import { service } from '@nimotech/nimoos-service'
import { installUnloadGuard } from './files/upload/unloadGuard'
import { useUploadsStore } from './files/stores/uploads'

const uploads = useUploadsStore()

// App level, not the Files view: the upload queue is an app-lifetime Pinia
// store and keeps transferring after navigating away from /files. Installing
// this in Files.vue meant closing the tab from any other route sent no
// interrupt signal and showed no leave-site prompt, leaving the batch to the
// server's 120s idle sweep.
let offUnloadGuard: (() => void) | null = null
onMounted(() => {
  offUnloadGuard = installUnloadGuard(() => uploads.queue, undefined, (id) => service.uploadBatches.interruptBatch(id))
})
onUnmounted(() => { offUnloadGuard?.() })
```

`src/views/Files.vue`：删掉第 32 行的 import、第 495-497 行的 `offUnloadGuard` 三行；顺带检查 `service` import 是否还有别的用处（有就留）。

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm exec vitest run src/App.unloadGuard.test.ts src/files/upload/unloadGuard.test.ts src/views/`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/App.vue src/views/Files.vue src/App.unloadGuard.test.ts src/views/__tests__/
git commit -m "fix(files): install the upload unload guard at app level

The upload queue is an app-lifetime store that keeps transferring after
leaving /files, but the guard was mounted and unmounted with the Files view —
so closing the tab from any other route sent no interrupt signal and showed no
leave-site prompt, silently falling back to the server's 120s idle sweep."
```

---

