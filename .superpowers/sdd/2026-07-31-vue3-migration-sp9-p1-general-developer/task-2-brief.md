## Task 2: `systemConfig.ts` —— `system` blob 的串行读改写

**为什么单独一个任务:** general 页有 4 个控件(时区、推荐应用、新闻源、磁盘待机)都要写服务端 `system` 这一个 key,而 `src/stores/locale.ts` **已经**在同一个 key 上做「读→改 `lang`→写」。四个开关连点 + 切语言并发时,后写的会把先写的覆盖掉(纪律 #3)。先把这个地基做对,后面每行才能只管自己那一个字段。

**Files:**
- Create: `src/settings/util/systemConfig.ts`
- Create: `src/settings/util/systemConfig.test.ts`
- Modify: `src/stores/locale.ts`
- Modify: `src/stores/locale.test.ts`

**Interfaces:**
- Consumes: `service.users.getCustomStorage(key)` / `setCustomStorage(key, data)`(共享包既有,返回 `unknown`;**服务端可能返回 JSON 字符串而不是对象** —— `locale.ts:20-23` 已有这个兼容分支,搬过来)
- Produces:
  ```ts
  export const SYSTEM_KEY = 'system'
  export interface SystemBlob {
    lang?: string
    timezone?: string
    search_switch?: boolean
    recommend_switch?: boolean
    existing_apps_switch?: boolean
    rss_switch?: boolean
    disk_standby?: string
    [k: string]: unknown          // 未知字段必须原样保留,不能读改写时丢掉
  }
  export const SYSTEM_DEFAULTS: Readonly<SystemBlob>
  export function readSystemConfig(): Promise<SystemBlob>          // 已合并默认值
  export function patchSystemConfig(patch: SystemBlob): Promise<SystemBlob>  // 串行,返回合并后的整块
  export function __resetSystemConfigQueue(): void                 // 仅测试用
  ```

- [ ] **Step 1: 写失败测试**

`src/settings/util/systemConfig.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const store = { blob: undefined as unknown, getCalls: 0, setCalls: [] as unknown[] }

vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    users: {
      getCustomStorage: async () => { store.getCalls++; return store.blob },
      setCustomStorage: async (_k: string, data: unknown) => {
        store.setCalls.push(data)
        // 真实后端语义:整块覆写
        store.blob = JSON.parse(JSON.stringify(data))
      },
    },
  },
}))

import {
  SYSTEM_DEFAULTS, readSystemConfig, patchSystemConfig, __resetSystemConfigQueue,
} from './systemConfig'

beforeEach(() => {
  store.blob = undefined
  store.getCalls = 0
  store.setCalls = []
  __resetSystemConfigQueue()
})

describe('readSystemConfig', () => {
  it('服务端空值时给默认值', async () => {
    store.blob = ''
    expect(await readSystemConfig()).toEqual(SYSTEM_DEFAULTS)
  })

  it('服务端返回 JSON 字符串也能解(后端确实会这样返)', async () => {
    store.blob = JSON.stringify({ timezone: 'Asia/Shanghai' })
    expect((await readSystemConfig()).timezone).toBe('Asia/Shanghai')
  })

  it('坏 JSON 不抛,退回默认值', async () => {
    store.blob = '{不是 json'
    expect(await readSystemConfig()).toEqual(SYSTEM_DEFAULTS)
  })

  it('服务端字段覆盖默认值,未知字段原样保留', async () => {
    store.blob = { rss_switch: true, some_future_key: 42 }
    const c = await readSystemConfig()
    expect(c.rss_switch).toBe(true)
    expect(c.disk_standby).toBe(SYSTEM_DEFAULTS.disk_standby)
    expect(c.some_future_key).toBe(42)
  })

  it('请求失败时降级到默认值而不是抛(设置页不能因此白屏)', async () => {
    store.blob = undefined
    const svc = await import('@nimotech/nimoos-service')
    vi.spyOn(svc.service.users, 'getCustomStorage').mockRejectedValueOnce(new Error('boom'))
    expect(await readSystemConfig()).toEqual(SYSTEM_DEFAULTS)
  })
})

describe('patchSystemConfig 串行性(纪律 #3:丢写竞态)', () => {
  it('并发 patch 不同字段,两个都留在最终结果里', async () => {
    store.blob = {}
    const [a, b] = await Promise.all([
      patchSystemConfig({ timezone: 'UTC' }),
      patchSystemConfig({ rss_switch: true }),
    ])
    // 后完成的那次看到的是合并后的全量
    const last = b.timezone ? b : a
    expect(last.timezone).toBe('UTC')
    expect(last.rss_switch).toBe(true)
    expect(store.blob).toMatchObject({ timezone: 'UTC', rss_switch: true })
  })

  it('串行队列内每次都重新读,不用调用方传进来的旧快照', async () => {
    store.blob = { timezone: 'UTC' }
    await Promise.all([
      patchSystemConfig({ rss_switch: true }),
      patchSystemConfig({ recommend_switch: false }),
    ])
    // 两次 patch 各读一次(2)+ 无额外读
    expect(store.getCalls).toBe(2)
    expect(store.blob).toMatchObject({ timezone: 'UTC', rss_switch: true, recommend_switch: false })
  })

  it('三个开关连点(模拟用户快速拨)不丢任何一个', async () => {
    store.blob = {}
    await Promise.all([
      patchSystemConfig({ rss_switch: true }),
      patchSystemConfig({ recommend_switch: false }),
      patchSystemConfig({ disk_standby: '30m' }),
    ])
    expect(store.blob).toMatchObject({ rss_switch: true, recommend_switch: false, disk_standby: '30m' })
  })

  it('队列中一次失败不卡死后续(否则一次网络抖动会让设置页永久失灵)', async () => {
    store.blob = {}
    const svc = await import('@nimotech/nimoos-service')
    const spy = vi.spyOn(svc.service.users, 'setCustomStorage').mockRejectedValueOnce(new Error('boom'))
    await expect(patchSystemConfig({ rss_switch: true })).rejects.toThrow('boom')
    spy.mockRestore()
    await expect(patchSystemConfig({ timezone: 'UTC' })).resolves.toMatchObject({ timezone: 'UTC' })
  })

  it('patch 不会把未知字段洗掉', async () => {
    store.blob = { some_future_key: 'keep me' }
    await patchSystemConfig({ timezone: 'UTC' })
    expect(store.blob).toMatchObject({ some_future_key: 'keep me', timezone: 'UTC' })
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI && pnpm test src/settings/util/systemConfig.test.ts 2>&1 | tail -20
```
预期:`Failed to resolve import "./systemConfig"`。

- [ ] **Step 3: 实现 `src/settings/util/systemConfig.ts`**

```ts
import { service } from '@nimotech/nimoos-service'

/** 服务端自定义存储的 key。与 Vue2(SettingsPanel.vue 的 systemConfigName)和 stores/locale.ts 同一个。 */
export const SYSTEM_KEY = 'system'

/**
 * Vue2 `barData`(SettingsPanel.vue L938-946)的服务端形态。
 * 索引签名不是偷懒 —— 读改写必须把不认识的字段原样带回去,
 * 否则新 UI 一次保存就把旧 UI / 将来版本写进去的字段洗掉了。
 */
export interface SystemBlob {
  lang?: string
  timezone?: string
  search_switch?: boolean
  recommend_switch?: boolean
  /**
   * Vue2 有这个字段,但对应的「显示其他 Docker 容器应用」开关行恒不渲染
   * (notImportList 永远是空数组,SET_NOTIMPORT_LIST 从没被 commit)。
   * 本期不做那一行(债务 D15),但字段要保留,避免读改写把它丢了。
   */
  existing_apps_switch?: boolean
  rss_switch?: boolean
  disk_standby?: string
  [k: string]: unknown
}

/**
 * 默认值照 Vue2 L938-946,**但故意不含 `lang`** ——
 * Vue2 默认 en_us,New-UI 默认 zh_cn,语言归 stores/locale.ts 管,
 * 这里给默认值会在读取时把用户语言错误地"纠正"掉。
 */
export const SYSTEM_DEFAULTS: Readonly<SystemBlob> = Object.freeze({
  timezone: 'America/New_York',
  search_switch: true,
  recommend_switch: true,
  existing_apps_switch: true,
  rss_switch: false,
  disk_standby: 'never',
})

function coerce(raw: unknown): Record<string, unknown> {
  let data = raw
  // 后端会把这块当字符串存回来,不是总是对象(stores/locale.ts 早有这个兼容分支)
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data)
    } catch {
      return {}
    }
  }
  return data && typeof data === 'object' ? (data as Record<string, unknown>) : {}
}

/** 读原始整块(不合默认值)—— 只给 patch 内部用,保证写回去的是服务端真实全量。 */
async function readRaw(): Promise<Record<string, unknown>> {
  return coerce(await service.users.getCustomStorage(SYSTEM_KEY))
}

/**
 * 读配置(已合并默认值)。**失败不抛** —— 设置页拿不到配置也得能显示,
 * 显示默认值 + 用户一改就写,比整页白屏好。
 */
export async function readSystemConfig(): Promise<SystemBlob> {
  try {
    return { ...SYSTEM_DEFAULTS, ...(await readRaw()) }
  } catch (e) {
    console.warn('[systemConfig] read failed, using defaults', e)
    return { ...SYSTEM_DEFAULTS }
  }
}

/**
 * 串行队列。Vue2 的 saveData() 是整块覆写,而本仓库有多个入口
 * (general 页 4 个控件 + stores/locale.ts 的语言)都在同一个 key 上读改写 ——
 * 不串行的话并发保存会互相覆盖(移植纪律 #3)。
 * 队列**内部**重新读一次服务端,所以不依赖调用方手里的旧快照。
 */
let queue: Promise<unknown> = Promise.resolve()

export async function patchSystemConfig(patch: SystemBlob): Promise<SystemBlob> {
  // 无论上一环成功还是失败都接着排,单次失败不能卡死整条队列
  const run = queue.then(
    () => apply(patch),
    () => apply(patch),
  )
  queue = run.catch(() => undefined)
  return run
}

async function apply(patch: SystemBlob): Promise<SystemBlob> {
  const current = await readRaw()
  const next = { ...current, ...patch }
  await service.users.setCustomStorage(SYSTEM_KEY, next)
  return { ...SYSTEM_DEFAULTS, ...next }
}

/** 仅测试用:清空队列,避免用例间互相串。 */
export function __resetSystemConfigQueue(): void {
  queue = Promise.resolve()
}
```

- [ ] **Step 4: 跑测试确认通过**

```bash
pnpm test src/settings/util/systemConfig.test.ts 2>&1 | tail -8
```

- [ ] **Step 5: 把 `locale.ts` 改接同一条队列**

`src/stores/locale.ts` 删掉自己那份 `readSystemBlob`,`persist` 改走 `patchSystemConfig`:

```ts
import { defineStore } from 'pinia'
import { service } from '@nimotech/nimoos-service'
import { i18n } from '../i18n'
import { readSystemConfig, patchSystemConfig } from '../settings/util/systemConfig'

export const LOCALES = ['zh_cn', 'en_us'] as const
export type Locale = (typeof LOCALES)[number]

function isLocale(v: unknown): v is Locale {
  return typeof v === 'string' && (LOCALES as readonly string[]).includes(v)
}

export const useLocaleStore = defineStore('locale', () => {
  function setLocale(lang: Locale) {
    i18n.global.locale.value = lang
    localStorage.setItem('lang', lang)
  }

  async function loadFromServer(): Promise<void> {
    try {
      const blob = await readSystemConfig()
      if (isLocale(blob.lang)) setLocale(blob.lang)
    } catch (e) { console.warn('[locale] server load failed', e) }
  }

  // 改走 systemConfig 的串行队列:设置页的时区/开关也写这一个 key,
  // 各自读改写会丢写(移植纪律 #3)。
  async function persist(lang: Locale): Promise<void> {
    setLocale(lang)
    try {
      await patchSystemConfig({ lang })
    } catch (e) { console.warn('[locale] server save failed', e) }
  }

  return { setLocale, loadFromServer, persist }
})
```

> 保留 `import { service }` 只有在文件里仍有其它用途时才留;若 `vue-tsc` 报未使用,删掉该 import。

- [ ] **Step 6: 修 `locale.test.ts` 并加一条并发用例**

原测试若 mock 的是 `service.users.*`,因为 `systemConfig` 也走同一个 mock,通常无需改动。跑一次确认:

```bash
pnpm test src/stores/locale.test.ts 2>&1 | tail -12
```

若因新增 import 报错,按报错调整 mock。然后追加一条守住纪律 #3 的回归用例:

```ts
it('切语言与设置页写时区并发,两者都不丢(纪律 #3)', async () => {
  const { patchSystemConfig, __resetSystemConfigQueue } = await import('../settings/util/systemConfig')
  __resetSystemConfigQueue()
  const store = useLocaleStore()
  await Promise.all([store.persist('en_us'), patchSystemConfig({ timezone: 'UTC' })])
  const blob = await (await import('../settings/util/systemConfig')).readSystemConfig()
  expect(blob.lang).toBe('en_us')
  expect(blob.timezone).toBe('UTC')
})
```

- [ ] **Step 7: 任务门 + 提交**

```bash
pnpm test 2>&1 | tail -8
pnpm exec vue-tsc --noEmit
git status --short   # 确认 3 行 design-export 的 D 还在原位
git add src/settings/util/systemConfig.ts src/settings/util/systemConfig.test.ts
git commit src/settings/util/systemConfig.ts src/settings/util/systemConfig.test.ts \
           src/stores/locale.ts src/stores/locale.test.ts \
  -m "feat(settings): system blob 串行读改写,消除丢写竞态(SP9-P1)

Vue2 saveData() 整块覆写,而本仓库 locale store 与 general 页 4 个控件
都在同一个 system key 上读改写 —— 并发必丢写(移植纪律 #3)。
改为模块级 Promise 串行队列 + 队列内重新读取;locale store 改接同一条队列。
读失败降级到默认值而不抛(设置页不能因此白屏);
队列内单次失败不卡死后续。"
```

---

