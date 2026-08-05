### Task 3: `sources` Pinia store(load / register / unregister / 事件 + 轮询收敛)

**Files:**
- Create: `src/apps/stores/sources.ts`
- Test: `src/apps/stores/sources.test.ts`

**Interfaces:**
- Consumes: `service.appstore.listSources(): Promise<AppStoreSource[]>`、`registerSource(url: string): Promise<void>`、`unregisterSource(id: number): Promise<void>`(共享包已有);`useAppstoreStore().invalidate()`(Task 2);`useMessageBus().on(event, cb): () => void`;`useToast().show(text, duration?)`;`i18n.global.t`。
- Produces(Task 4 页面消费): store `useSourcesStore()`,字段 `sources: AppStoreSource[]`、`loading: boolean`、`error: boolean`、`loaded: boolean`、`registeringUrl: string | null`;actions `load(): Promise<void>`、`register(url: string): Promise<void>`(同步 HTTP 错误 **抛 `Error(message)`**,调用方就地展示)、`unregister(id: number): Promise<void>`(错误自行 toast,不抛)。

**依赖的 i18n 键在 Task 4 才落文件** —— store 引用键名即可,vue-i18n 缺键时回显键名,不炸测试;Task 4 落键后文案生效。(单测断言 toast 调用参数用键名或 `expect.any(String)`,不断言中文文案。)

- [ ] **Step 1: 写失败测试**

```ts
// src/apps/stores/sources.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const svc = vi.hoisted(() => ({
  appstore: {
    listSources: vi.fn(),
    registerSource: vi.fn(),
    unregisterSource: vi.fn(),
  },
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))

// 捕获事件处理器,测试里手动触发
const busHandlers = vi.hoisted(() => new Map<string, (props: unknown) => void>())
const busOn = vi.hoisted(() =>
  vi.fn((ev: string, cb: (props: unknown) => void) => {
    busHandlers.set(ev, cb)
    return () => {}
  }),
)
vi.mock('../../composables/useMessageBus', () => ({ useMessageBus: () => ({ on: busOn }) }))

import { useSourcesStore } from './sources'
import { useAppstoreStore } from './appstore'
import { useToast } from '../../stores/toast'

const SRC = { id: 0, url: 'https://github.com/NimoTech/NimoOS-AppStore/archive/main.zip', store_root: 'NimoOS-AppStore-main' }
const THIRD = { id: 1, url: 'https://github.com/WisdomSky/CasaOS-Coolstore/archive/main.zip' }

describe('sources store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    busHandlers.clear()
    vi.clearAllMocks()
    vi.useFakeTimers()
  })
  afterEach(() => vi.useRealTimers())

  it('load 成功写 sources/loaded;失败置 error', async () => {
    const store = useSourcesStore()
    svc.appstore.listSources.mockResolvedValueOnce([SRC, THIRD])
    await store.load()
    expect(store.sources).toEqual([SRC, THIRD])
    expect(store.loaded).toBe(true)
    expect(store.error).toBe(false)

    svc.appstore.listSources.mockRejectedValueOnce(new Error('boom'))
    await store.load()
    expect(store.error).toBe(true)
  })

  it('register 受理:registeringUrl 置目标,service 收到 trim 后 URL', async () => {
    const store = useSourcesStore()
    svc.appstore.registerSource.mockResolvedValueOnce(undefined)
    await store.register('  https://example.com/store.zip  ')
    expect(svc.appstore.registerSource).toHaveBeenCalledWith('https://example.com/store.zip')
    expect(store.registeringUrl).toBe('https://example.com/store.zip')
  })

  it('register 同步 409:抛后端 message,registeringUrl 复位', async () => {
    const store = useSourcesStore()
    svc.appstore.registerSource.mockRejectedValueOnce({
      response: { data: { message: 'appstore source already exists' } },
    })
    await expect(store.register('https://dup.example.com/s.zip')).rejects.toThrow('appstore source already exists')
    expect(store.registeringUrl).toBeNull()
  })

  it('register-end 事件收敛:清 pending + 重拉列表 + invalidate + toast', async () => {
    const store = useSourcesStore()
    const appstore = useAppstoreStore()
    const inv = vi.spyOn(appstore, 'invalidate')
    const toast = useToast()
    const show = vi.spyOn(toast, 'show')

    svc.appstore.registerSource.mockResolvedValueOnce(undefined)
    await store.register('https://example.com/store.zip')
    svc.appstore.listSources.mockResolvedValueOnce([SRC, THIRD])

    busHandlers.get('app-store:register-end')!({})
    // 断言全部同步可验:convergeRegistered 同步清 pending/调 invalidate/toast,load() 同步发起 listSources
    expect(store.registeringUrl).toBeNull()
    expect(inv).toHaveBeenCalled()
    expect(show).toHaveBeenCalled()
    expect(svc.appstore.listSources).toHaveBeenCalled()
  })

  it('register-error 事件:清 pending + toast 带后端 message,不重拉', async () => {
    const store = useSourcesStore()
    const toast = useToast()
    const show = vi.spyOn(toast, 'show')
    svc.appstore.registerSource.mockResolvedValueOnce(undefined)
    await store.register('https://bad.example.com/s.zip')

    busHandlers.get('app-store:register-error')!({ message: 'not an appstore' })
    expect(store.registeringUrl).toBeNull()
    expect(show).toHaveBeenCalledWith(expect.stringContaining('not an appstore'), expect.any(Number))
  })

  it('事件丢失兜底:15s 轮询 listSources 看到新 URL 即收敛(大小写不敏感)', async () => {
    const store = useSourcesStore()
    const appstore = useAppstoreStore()
    const inv = vi.spyOn(appstore, 'invalidate')
    svc.appstore.registerSource.mockResolvedValueOnce(undefined)
    await store.register('https://Example.com/Store.zip')

    // 第一轮:还没出现 → 仍 pending
    svc.appstore.listSources.mockResolvedValueOnce([SRC])
    await vi.advanceTimersByTimeAsync(15_000)
    expect(store.registeringUrl).not.toBeNull()

    // 第二轮:出现(后端存的小写)→ 收敛
    svc.appstore.listSources.mockResolvedValue([SRC, { id: 1, url: 'https://example.com/store.zip' }])
    await vi.advanceTimersByTimeAsync(15_000)
    expect(store.registeringUrl).toBeNull()
    expect(inv).toHaveBeenCalled()
  })

  it('unregister 成功:重拉 + invalidate;失败:toast 后端 message', async () => {
    const store = useSourcesStore()
    const appstore = useAppstoreStore()
    const inv = vi.spyOn(appstore, 'invalidate')
    const toast = useToast()
    const show = vi.spyOn(toast, 'show')

    svc.appstore.unregisterSource.mockResolvedValueOnce(undefined)
    svc.appstore.listSources.mockResolvedValueOnce([SRC])
    await store.unregister(1)
    expect(svc.appstore.unregisterSource).toHaveBeenCalledWith(1)
    expect(inv).toHaveBeenCalled()

    svc.appstore.unregisterSource.mockRejectedValueOnce({
      response: { data: { message: 'cannot unregister the last app store - need at least one app store' } },
    })
    await store.unregister(0)
    expect(show).toHaveBeenCalledWith(expect.stringContaining('cannot unregister the last app store'), expect.any(Number))
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm exec vitest run src/apps/stores/sources.test.ts`
Expected: FAIL(`./sources` 模块不存在)

- [ ] **Step 3: 实现**

```ts
// src/apps/stores/sources.ts
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { service, type AppStoreSource } from '@nimotech/nimoos-service'
import { useMessageBus } from '../../composables/useMessageBus'
import { useToast } from '../../stores/toast'
import { i18n } from '../../i18n'
import { useAppstoreStore } from './appstore'

/** 注册期间的兜底轮询间隔:MessageBus 订阅通道 buffer=1 可能丢事件(系统已知),
 *  register-end 丢失时靠轮询 listSources 看到新 URL 收敛,不永久转圈(Vue2 只靠事件,是旧 bug)。 */
const REGISTER_POLL_MS = 15_000

function errMsg(e: unknown): string {
  const r = (e as { response?: { data?: { message?: string } } })?.response
  if (r?.data?.message) return r.data.message
  return e instanceof Error ? e.message : String(e)
}

export const useSourcesStore = defineStore('appSources', () => {
  const t = i18n.global.t
  const toast = useToast()
  const appstore = useAppstoreStore()

  const sources = ref<AppStoreSource[]>([])
  const loading = ref(false)
  const error = ref(false)
  const loaded = ref(false)
  /** 正在注册的源 URL;null=空闲。一次只允许一个注册在途(对齐后端异步任务语义)。 */
  const registeringUrl = ref<string | null>(null)

  let seq = 0
  let pollTimer: ReturnType<typeof setInterval> | null = null

  async function load() {
    const mySeq = ++seq
    loading.value = true
    error.value = false
    try {
      const list = await service.appstore.listSources()
      if (mySeq !== seq) return
      sources.value = list
      loaded.value = true
    } catch (e) {
      if (mySeq !== seq) return
      error.value = true
      console.warn('[sources] load', e)
    } finally {
      if (mySeq === seq) loading.value = false
    }
  }

  function stopPoll() {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }

  function settleRegister() {
    registeringUrl.value = null
    stopPoll()
  }

  /** 注册成功收敛(事件或轮询,谁先到谁生效):清 pending + toast + 重拉列表 + 失效商店目录缓存 */
  function convergeRegistered() {
    if (registeringUrl.value === null) return
    settleRegister()
    toast.show(t('appsSourcesRegisterOk'), 4000)
    void load()
    appstore.invalidate()
  }

  /** 注册第三方源。同步 HTTP 错误(409 重复/400 坏 URL)抛 Error(message) 给调用方就地展示;
   *  受理(200)后是后端异步任务,由 app-store:register-end/-error 事件或轮询收敛。 */
  async function register(url: string) {
    const target = url.trim()
    registeringUrl.value = target
    try {
      await service.appstore.registerSource(target)
    } catch (e) {
      settleRegister()
      throw new Error(errMsg(e))
    }
    const needle = target.toLowerCase() // 后端重复判定不区分大小写,轮询对齐
    stopPoll()
    pollTimer = setInterval(async () => {
      if (registeringUrl.value === null) return
      try {
        const list = await service.appstore.listSources()
        if (registeringUrl.value !== null && list.some((s) => s.url.toLowerCase() === needle)) {
          convergeRegistered()
        }
      } catch {
        /* 轮询失败静默,下个周期再试 */
      }
    }, REGISTER_POLL_MS)
  }

  /** 注销:后端无事件,同步等待(Vue2 同款)。错误(如删最后一个源的 400)toast 透出,不抛。 */
  async function unregister(id: number) {
    try {
      await service.appstore.unregisterSource(id)
      toast.show(t('appsSourcesRemoveOk'), 4000)
      await load()
      appstore.invalidate()
    } catch (e) {
      toast.show(t('appsSourcesRemoveFail', { msg: errMsg(e) }), 5000)
    }
  }

  // 订阅挂 store 生命周期(应用级单例):注册是慢任务(下载 tarball),
  // 用户切走页面也要能收敛 + toast(installProgress 同款模式)
  const bus = useMessageBus()
  bus.on('app-store:register-end', () => {
    if (registeringUrl.value !== null) {
      convergeRegistered()
    } else {
      // 别的客户端注册的源:静默同步(不 toast,不是本页发起的)
      if (loaded.value) void load()
      appstore.invalidate()
    }
  })
  bus.on('app-store:register-error', (props) => {
    if (registeringUrl.value === null) return
    const p = (props && typeof props === 'object' ? props : {}) as Record<string, unknown>
    const msg = typeof p['message'] === 'string' ? p['message'] : ''
    settleRegister()
    toast.show(t('appsSourcesRegisterFail', { msg }), 5000)
  })

  return { sources, loading, error, loaded, registeringUrl, load, register, unregister }
})
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm exec vitest run src/apps/stores/sources.test.ts`
Expected: PASS(7 用例)
注意:此时 i18n 键还没落文件,toast 收到的是键名字符串——测试只断言 `stringContaining('not an appstore')` 一处真实插值,`register-error` 的插值键 `appsSourcesRegisterFail` 缺键时 vue-i18n 回显键名,该断言会失败。**若如此,把 Task 4 的 i18n 键块提前到本 Task 落文件即可**(两个文件都要加,见 Task 4 Step 3 的键块),这不算越界——键块归属哪个 commit 不影响验收。

- [ ] **Step 5: Commit**

```bash
git add src/apps/stores/sources.ts src/apps/stores/sources.test.ts
git commit -m "P7: 商店源 store(注册事件+轮询双通道收敛,同步错误透出)"
```

---

