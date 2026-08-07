### Task 1: 核心块(assets/timeline/config/storage/status/tasks)+ URL 生成器统一 token

**Files:**
- Modify: `src/photos.ts`(整文件重写,保留现有 4 方法语义)
- Modify: `src/photos.test.ts`(扩展)

**Interfaces:**
- Consumes: `unwrap`(`./unwrap.js`)、`PhotoAsset`(`./types.js`)、`AxiosInstance`。
- Produces(后续任务在同一工厂返回对象里追加方法,并复用这里定义的模块级辅助):
  - `loose<T>(d: unknown): T` — 裸数组/信封双形态解包(模块级函数)
  - 工厂内 `tokenQ(sep: '?' | '&'): string` — token query 片段(闭包内函数,后续任务的 URL 生成器直接用)
  - 方法:`getAsset(id)`, `getAssetOcr(id, q?)`, `deleteAsset(id)`, `getConfig()`, `updateConfig(watchDirs, retentionDays?, facesEnabled?, extra?)`, `getStorage()`, `getAbout()`, `getStatus()`, `listTasks()`, `pruneCache()`, `rebuildIndex()`, `triggerScan()`, `liveUrl(id)` — 均挂在 `createPhotos` 返回对象上

- [ ] **Step 1: 写失败测试**

在 `src/photos.test.ts` 现有内容之上,顶部加统一 mock 辅助(供本文件所有新用例复用;后续任务的测试文件各自复制同一辅助——测试文件间不互相 import):

```ts
import { describe, it, expect } from 'vitest'
import type { AxiosInstance } from 'axios'
import { createPhotos } from './photos'

type Call = { method: string; url: string; params?: unknown; body?: unknown; cfg?: unknown }
function capture(data: unknown = []) {
  const calls: Call[] = []
  const ok = { data: { success: 200, data }, headers: {} }
  const http = {
    get: async (url: string, cfg?: { params?: unknown }) => { calls.push({ method: 'get', url, params: cfg?.params, cfg }); return ok },
    post: async (url: string, body?: unknown, cfg?: unknown) => { calls.push({ method: 'post', url, body, cfg }); return ok },
    put: async (url: string, body?: unknown) => { calls.push({ method: 'put', url, body }); return ok },
    patch: async (url: string, body?: unknown) => { calls.push({ method: 'patch', url, body }); return ok },
    delete: async (url: string, cfg?: { data?: unknown }) => { calls.push({ method: 'delete', url, cfg }); return ok },
  } as unknown as AxiosInstance
  return { http, calls }
}
const noToken = () => null
```

新增用例(既有 listAssets/getTimeline/thumbnailUrl 用例保留不动):

```ts
describe('photos 核心块', () => {
  it('getAsset 发 GET /photos/assets/:id 并解信封', async () => {
    const { http, calls } = capture({ id: 'a1' })
    const r = await createPhotos(http, noToken).getAsset('a1')
    expect(calls[0]).toMatchObject({ method: 'get', url: '/photos/assets/a1' })
    expect(r).toEqual({ id: 'a1' })
  })
  it('getAssetOcr 带 q 传 params,不带 q 无 params', async () => {
    const { http, calls } = capture()
    const p = createPhotos(http, noToken)
    await p.getAssetOcr('a1', '猫')
    expect(calls[0]).toMatchObject({ url: '/photos/assets/a1/ocr', params: { q: '猫' } })
    await p.getAssetOcr('a1')
    expect(calls[1].params).toBeUndefined()
  })
  it('deleteAsset 发 DELETE /photos/assets/:id', async () => {
    const { http, calls } = capture()
    await createPhotos(http, noToken).deleteAsset('a1')
    expect(calls[0]).toMatchObject({ method: 'delete', url: '/photos/assets/a1' })
  })
  it('updateConfig 只带非空字段(对齐 Vue2 逐字段判空)', async () => {
    const { http, calls } = capture()
    await createPhotos(http, noToken).updateConfig(['/DATA/Gallery'], 30, null, { ocrEnabled: true })
    expect(calls[0]).toMatchObject({ method: 'put', url: '/photos/config' })
    expect(calls[0].body).toEqual({ watchDirs: ['/DATA/Gallery'], retentionDays: 30, ocrEnabled: true })
  })
  it.each([
    ['getConfig', 'get', '/photos/config'],
    ['getStorage', 'get', '/photos/storage'],
    ['getAbout', 'get', '/photos/about'],
    ['getStatus', 'get', '/photos/status'],
    ['listTasks', 'get', '/photos/tasks'],
    ['pruneCache', 'post', '/photos/cache/prune'],
    ['rebuildIndex', 'post', '/photos/index/rebuild'],
    ['triggerScan', 'post', '/photos/scan'],
  ] as const)('%s 发 %s %s', async (m, verb, url) => {
    const { http, calls } = capture()
    await (createPhotos(http, noToken) as never as Record<string, () => Promise<unknown>>)[m]()
    expect(calls[0]).toMatchObject({ method: verb, url })
  })
  it('信封 success!==200 抛错', async () => {
    const http = { get: async () => ({ data: { success: 500, message: '炸了' } }) } as unknown as AxiosInstance
    await expect(createPhotos(http, noToken).getConfig()).rejects.toThrow('炸了')
  })
  it('originalUrl/liveUrl 统一追加 token,无 token 不加', () => {
    const p = createPhotos({} as AxiosInstance, () => 'T&1')
    expect(p.originalUrl('a1')).toBe('/v1/photos/assets/a1/original?token=T%261')
    expect(p.liveUrl('a1')).toBe('/v1/photos/assets/a1/live?token=T%261')
    const p2 = createPhotos({} as AxiosInstance, noToken)
    expect(p2.originalUrl('a1')).toBe('/v1/photos/assets/a1/original')
  })
})
```

注意:既有用例若断言 `originalUrl` 恰为无 token 形态,同步改为新口径。

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run src/photos.test.ts`
Expected: FAIL — `getAsset is not a function` 等。

- [ ] **Step 3: 实现**

`src/photos.ts` 重写为(现有 4 方法保留,`originalUrl` 换 token 口径):

```ts
import type { AxiosInstance } from 'axios'
import type { PhotoAsset } from './types.js'
import { unwrap } from './unwrap.js'
import type { StdEnvelope } from './types.js'

// 列表类端点兼容两种响应:裸数组 或 标准信封
function loose<T>(d: unknown): T {
  return Array.isArray(d) ? (d as T) : unwrap<T>(d as StdEnvelope<T>)
}

export function createPhotos(http: AxiosInstance, getToken: () => string | null) {
  // 统一口径:媒体/导出 URL 一律追加 token(后端对媒体路径本就豁免 JWT,带上无害且兼容转发场景)
  const tokenQ = (sep: '?' | '&') => {
    const t = getToken()
    return t ? `${sep}token=${encodeURIComponent(t)}` : ''
  }
  return {
    async listAssets(limit = 60, offset = 0): Promise<PhotoAsset[]> {
      const res = await http.get('/photos/assets', { params: { limit, offset } })
      return loose<PhotoAsset[]>(res.data)
    },
    async getTimeline(): Promise<unknown> {
      const res = await http.get('/photos/timeline')
      return loose<unknown>(res.data)
    },
    async getAsset(id: string | number): Promise<PhotoAsset> {
      const res = await http.get(`/photos/assets/${id}`)
      return unwrap<PhotoAsset>(res.data)
    },
    // OCR 行坐标:q 为搜索词时只返回命中行;不带 q 返回全部行(对齐 Vue2 注释)
    async getAssetOcr(id: string | number, q?: string): Promise<unknown> {
      const res = await http.get(`/photos/assets/${id}/ocr`, q ? { params: { q } } : undefined)
      return unwrap<unknown>(res.data)
    },
    async deleteAsset(id: string | number): Promise<unknown> {
      const res = await http.delete(`/photos/assets/${id}`)
      return unwrap<unknown>(res.data)
    },
    async getConfig(): Promise<Record<string, unknown>> {
      const res = await http.get('/photos/config')
      return unwrap<Record<string, unknown>>(res.data)
    },
    // extra: { scenesEnabled, ocrEnabled, smartViewEnabled, scanInterval } — 省略的字段后端保持现值
    async updateConfig(
      watchDirs: string[],
      retentionDays?: number | null,
      facesEnabled?: boolean | null,
      extra: Record<string, unknown> = {},
    ): Promise<unknown> {
      const body: Record<string, unknown> = { watchDirs }
      if (retentionDays != null) body.retentionDays = retentionDays
      if (facesEnabled != null) body.facesEnabled = facesEnabled
      for (const k of ['scenesEnabled', 'ocrEnabled', 'smartViewEnabled', 'scanInterval']) {
        if (extra[k] != null) body[k] = extra[k]
      }
      const res = await http.put('/photos/config', body)
      return unwrap<unknown>(res.data)
    },
    async getStorage(): Promise<Record<string, unknown>> {
      const res = await http.get('/photos/storage')
      return unwrap<Record<string, unknown>>(res.data)
    },
    async getAbout(): Promise<Record<string, unknown>> {
      const res = await http.get('/photos/about')
      return unwrap<Record<string, unknown>>(res.data)
    },
    async getStatus(): Promise<Record<string, unknown>> {
      const res = await http.get('/photos/status')
      return unwrap<Record<string, unknown>>(res.data)
    },
    async listTasks(): Promise<unknown[]> {
      const res = await http.get('/photos/tasks')
      return loose<unknown[]>(res.data)
    },
    async pruneCache(): Promise<unknown> {
      const res = await http.post('/photos/cache/prune', {})
      return unwrap<unknown>(res.data)
    },
    async rebuildIndex(): Promise<unknown> {
      const res = await http.post('/photos/index/rebuild', {})
      return unwrap<unknown>(res.data)
    },
    async triggerScan(): Promise<unknown> {
      const res = await http.post('/photos/scan', {})
      return unwrap<unknown>(res.data)
    },
    thumbnailUrl(id: string | number, size = 'small'): string {
      return `/v1/photos/assets/${id}/thumbnail?size=${size}${tokenQ('&')}`
    },
    originalUrl(id: string | number): string {
      return `/v1/photos/assets/${id}/original${tokenQ('?')}`
    },
    liveUrl(id: string | number): string {
      return `/v1/photos/assets/${id}/live${tokenQ('?')}`
    },
  }
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm vitest run src/photos.test.ts` → PASS;`pnpm test` 全量绿;`pnpm build` 无类型错。

- [ ] **Step 5: Commit**

```bash
git add src/photos.ts src/photos.test.ts
git commit -m "photos 域核心块:assets/config/storage/status/tasks + 媒体 URL 统一 token 口径"
```

---

