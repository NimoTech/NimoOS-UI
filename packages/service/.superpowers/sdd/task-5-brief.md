### Task 5: 类型定义 + `appstore` 域(商店目录 + 源管理)

**Files:**
- Modify: `NimoOS-Service/src/types.ts`(追加,不动既有类型)
- Create: `NimoOS-Service/src/appstore.ts`
- Test: `NimoOS-Service/src/appstore.test.ts`

**Interfaces:**
- Consumes: `v2Data`(Task 4)。
- Produces(P1+ 页面与 Task 7 装配消费):
  - 类型 `AppCategory` / `StoreAppInfo` / `StoreAppCatalog` / `UpgradableAppInfo` / `AppStoreSource`
  - `createAppstore(http)` → `{ categories(), listApps(params?), getApp(id), getAppCompose(id), upgradable(), listSources(), registerSource(url), unregisterSource(id) }`

- [ ] **Step 1: types.ts 追加类型(字段以 Task 3 实录为准,下列为 openapi 基线,不符处修正并在台账记差异)**

```typescript
// ---- SP5: AppStore / Compose(v2 app_management,字段保留后端 snake_case)----
export interface AppCategory {
  id?: number
  name: string
  font?: string
  count?: number
  description?: string
}

export interface StoreAppInfo {
  store_app_id?: string
  title: Record<string, string>
  tagline?: Record<string, string>
  description?: Record<string, string>
  icon?: string
  thumbnail?: string
  screenshot_link?: string[]
  category?: string
  author?: string
  developer?: string
  index?: string
  port_map?: string
  tips?: unknown
  [k: string]: unknown
}

/** GET /apps 的 data:installed 是已装 store_app_id 列表,list 是 id→info 映射 */
export interface StoreAppCatalog {
  installed: string[]
  list: Record<string, StoreAppInfo>
}

export interface UpgradableAppInfo {
  store_app_id?: string
  title?: Record<string, string>
  [k: string]: unknown
}

export interface AppStoreSource {
  id: number
  url: string
  store_root?: string
}
```

- [ ] **Step 2: 写失败测试**

`src/appstore.test.ts`(mock http 模式照 `disks.test.ts`;fixture 用 Task 3 实录替换下述示意值):

```typescript
import { describe, it, expect } from 'vitest'
import type { AxiosInstance } from 'axios'
import { createAppstore } from './appstore'

function httpMock(handlers: Record<string, (url: string, arg?: unknown, cfg?: unknown) => unknown>) {
  return {
    get: async (u: string, c?: unknown) => ({ data: handlers.get?.(u, c) }),
    post: async (u: string, b?: unknown, c?: unknown) => ({ data: handlers.post?.(u, b, c) }),
    delete: async (u: string, c?: unknown) => ({ data: handlers.delete?.(u, c) }),
  } as unknown as AxiosInstance
}

describe('createAppstore', () => {
  it('categories 解 v2 裸信封为数组', async () => {
    const http = httpMock({ get: () => ({ message: '', data: [{ id: 1, name: 'Media', count: 3 }] }) })
    const cats = await createAppstore(http).categories()
    expect(cats).toEqual([{ id: 1, name: 'Media', count: 3 }])
  })
  it('listApps 透传 snake_case 查询参数并容空', async () => {
    let cfg: { params?: Record<string, unknown> } | undefined
    const http = httpMock({ get: (_u, c) => { cfg = c as typeof cfg; return { data: { installed: [], list: {} } } } })
    const r = await createAppstore(http).listApps({ category: 'Media', recommend: true })
    expect(cfg?.params).toEqual({ category: 'Media', author_type: undefined, recommend: true })
    expect(r).toEqual({ installed: [], list: {} })
  })
  it('listApps data 缺键时给安全默认', async () => {
    const http = httpMock({ get: () => ({ message: '', data: {} }) })
    expect(await createAppstore(http).listApps()).toEqual({ installed: [], list: {} })
  })
  it('getApp 编码 id 进路径', async () => {
    let url = ''
    const http = httpMock({ get: (u) => { url = u; return { data: { title: { en_us: 'X' } } } } })
    await createAppstore(http).getApp('a b')
    expect(url).toBe('/v2/app_management/apps/a%20b')
  })
  it('getAppCompose 带 Accept yaml 且不解析,原样返回文本', async () => {
    let cfg: { headers?: Record<string, string> } | undefined
    const http = httpMock({ get: (_u, c) => { cfg = c as typeof cfg; return 'services:\n  app:\n' } })
    const yml = await createAppstore(http).getAppCompose('syncthing')
    expect(yml).toBe('services:\n  app:\n')
    expect(cfg?.headers?.Accept).toBe('application/yaml')
  })
  it('registerSource 用 query 参数 url、无 body;unregisterSource DELETE /appstore/{id}', async () => {
    let post: { u?: string; b?: unknown; cfg?: { params?: Record<string, unknown> } } = {}
    let delUrl = ''
    const http = httpMock({
      post: (u, b, c) => { post = { u, b, cfg: c as typeof post.cfg }; return { message: '' } },
      delete: (u) => { delUrl = u; return { message: '' } },
    })
    const s = createAppstore(http)
    await s.registerSource('https://example.com/store.zip')
    expect(post.u).toBe('/v2/app_management/appstore')
    expect(post.b).toBeUndefined()
    expect(post.cfg?.params).toEqual({ url: 'https://example.com/store.zip' })
    await s.unregisterSource(3)
    expect(delUrl).toBe('/v2/app_management/appstore/3')
  })
})
```

- [ ] **Step 3: 跑测试确认失败**

Run: `pnpm vitest run src/appstore.test.ts`
Expected: FAIL(`./appstore` 不存在)。

- [ ] **Step 4: 实现 `src/appstore.ts`**

```typescript
import type { AxiosInstance } from 'axios'
import type { AppCategory, StoreAppCatalog, StoreAppInfo, UpgradableAppInfo, AppStoreSource } from './types.js'
import { v2Data } from './v2.js'

const BASE = '/v2/app_management'

export function createAppstore(http: AxiosInstance) {
  return {
    async categories(): Promise<AppCategory[]> {
      const res = await http.get(`${BASE}/categories`)
      return v2Data<AppCategory[]>(res.data) ?? []
    },

    async listApps(params?: { category?: string; authorType?: string; recommend?: boolean }): Promise<StoreAppCatalog> {
      const res = await http.get(`${BASE}/apps`, {
        params: { category: params?.category, author_type: params?.authorType, recommend: params?.recommend },
      })
      const d = v2Data<Partial<StoreAppCatalog>>(res.data)
      return { installed: d?.installed ?? [], list: d?.list ?? {} }
    },

    async getApp(id: string): Promise<StoreAppInfo> {
      const res = await http.get(`${BASE}/apps/${encodeURIComponent(id)}`)
      return v2Data<StoreAppInfo>(res.data)
    },

    /** 商店应用的 compose YAML 原文(安装的输入)。Accept yaml → 裸文本;
     *  transformResponse 置空防 axios 把 YAML 误当 JSON 解析。 */
    async getAppCompose(id: string): Promise<string> {
      const res = await http.get(`${BASE}/apps/${encodeURIComponent(id)}/compose`, {
        headers: { Accept: 'application/yaml' },
        responseType: 'text',
        transformResponse: [(d: unknown) => d],
      })
      return res.data as string
    },

    async upgradable(): Promise<UpgradableAppInfo[]> {
      const res = await http.get(`${BASE}/apps/upgradable`)
      return v2Data<UpgradableAppInfo[]>(res.data) ?? []
    },

    async listSources(): Promise<AppStoreSource[]> {
      const res = await http.get(`${BASE}/appstore`)
      return v2Data<AppStoreSource[]>(res.data) ?? []
    },

    /** 注册第三方商店源。url 走 query 参数(openapi AppStoreURL),无 body;
     *  注册是异步任务,完成经 MessageBus app-store:register-end/-error(P7 消费)。 */
    async registerSource(url: string): Promise<void> {
      await http.post(`${BASE}/appstore`, undefined, { params: { url } })
    },

    async unregisterSource(id: number): Promise<void> {
      await http.delete(`${BASE}/appstore/${id}`)
    },
  }
}
```

- [ ] **Step 5: 跑测试确认通过**

Run: `pnpm vitest run src/appstore.test.ts`
Expected: PASS 6/6。

- [ ] **Step 6: 对照 Task 3 实录校正 fixture**

台账实录里与本任务 fixture 形态不符的(如 `/apps` 的 data 结构),同步改测试 fixture 与类型/实现,重跑至绿。差异记台账。

- [ ] **Step 7: Commit**

```bash
git add src/types.ts src/appstore.ts src/appstore.test.ts
git commit -m "feat(appstore): 商店目录/详情/compose 原文/可升级/源管理 域方法(SP5-P0)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

