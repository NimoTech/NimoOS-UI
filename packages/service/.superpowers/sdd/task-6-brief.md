### Task 6: `compose` 域(已装应用生命周期)

**Files:**
- Modify: `NimoOS-Service/src/types.ts`(追加 `ComposeAppWithStoreInfo`)
- Create: `NimoOS-Service/src/compose.ts`
- Test: `NimoOS-Service/src/compose.test.ts`

**Interfaces:**
- Consumes: `v2Data`(Task 4)、`StoreAppInfo`(Task 5)。
- Produces(P1+ 消费):`createCompose(http)` → `{ list(), get(id), install(yaml, opts?), applySettings(id, yaml, opts?), update(id, opts?), uninstall(id, opts?), setStatus(id, action), logs(id, opts?), containers(id), healthcheck(id) }`
- 明确不做:`POST /convert`(实证为 appfile→compose 转换,不是 docker run 导入;P5 自定义安装期按需再评,docker run 导入走前端 composerize——spec §3.6 的决策规则落定)。

- [ ] **Step 1: types.ts 追加**

```typescript
/** GET /compose 与 /compose/{id} 的 data 单元 */
export interface ComposeAppWithStoreInfo {
  store_info?: StoreAppInfo
  compose?: unknown
  status?: string
  update_available?: boolean
  is_uncontrolled?: boolean
  [k: string]: unknown
}
```

(`StoreAppInfo` 已在 Task 5 定义,同文件无需 import。)

- [ ] **Step 2: 写失败测试**

`src/compose.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import type { AxiosInstance } from 'axios'
import { createCompose } from './compose'

interface Call { u?: string; b?: unknown; cfg?: { params?: Record<string, unknown>; headers?: Record<string, string> } }

function httpMock(reply: unknown = { message: '', data: {} }) {
  const calls: Record<string, Call> = {}
  const rec = (m: string) => (u: string, b?: unknown, c?: unknown) => {
    // get/delete 签名是 (url, config)
    const isBodyless = m === 'get' || m === 'delete'
    calls[m] = isBodyless ? { u, cfg: b as Call['cfg'] } : { u, b, cfg: c as Call['cfg'] }
    return Promise.resolve({ data: reply })
  }
  const http = { get: rec('get'), post: rec('post'), put: rec('put'), patch: rec('patch'), delete: rec('delete') } as unknown as AxiosInstance
  return { http, calls }
}

describe('createCompose', () => {
  it('list 解映射,缺 data 容空', async () => {
    const { http } = httpMock({ message: '', data: { jellyfin: { status: 'running' } } })
    expect(await createCompose(http).list()).toEqual({ jellyfin: { status: 'running' } })
    const empty = httpMock({ message: '' })
    expect(await createCompose(empty.http).list()).toEqual({})
  })
  it('install:YAML body + Content-Type yaml + snake_case query', async () => {
    const { http, calls } = httpMock({ message: '' })
    await createCompose(http).install('services: {}', { dryRun: true, checkPortConflict: false })
    expect(calls.post?.u).toBe('/v2/app_management/compose')
    expect(calls.post?.b).toBe('services: {}')
    expect(calls.post?.cfg?.headers?.['Content-Type']).toBe('application/yaml')
    expect(calls.post?.cfg?.params).toEqual({ dry_run: true, check_port_conflict: false })
  })
  it('applySettings:PUT /compose/{id} 同款 body/参数', async () => {
    const { http, calls } = httpMock({ message: '' })
    await createCompose(http).applySettings('jellyfin', 'services: {}', { dryRun: true })
    expect(calls.put?.u).toBe('/v2/app_management/compose/jellyfin')
    expect(calls.put?.cfg?.params).toEqual({ dry_run: true, check_port_conflict: undefined })
  })
  it('setStatus 发 JSON 字符串 body(echo Bind 只认 "start" 带引号形态)', async () => {
    const { http, calls } = httpMock({ message: '' })
    await createCompose(http).setStatus('jellyfin', 'restart')
    expect(calls.put?.u).toBe('/v2/app_management/compose/jellyfin/status')
    expect(calls.put?.b).toBe('"restart"')
    expect(calls.put?.cfg?.headers?.['Content-Type']).toBe('application/json')
  })
  it('update PATCH、uninstall DELETE + delete_config_folder', async () => {
    const { http, calls } = httpMock({ message: '' })
    const c = createCompose(http)
    await c.update('jellyfin')
    expect(calls.patch?.u).toBe('/v2/app_management/compose/jellyfin')
    await c.uninstall('jellyfin', { deleteConfigFolder: false })
    expect(calls.delete?.u).toBe('/v2/app_management/compose/jellyfin')
    expect(calls.delete?.cfg?.params).toEqual({ delete_config_folder: false })
  })
  it('logs 解 data 为字符串并透传 lines', async () => {
    const { http, calls } = httpMock({ message: '', data: 'line1\nline2' })
    const out = await createCompose(http).logs('jellyfin', { lines: 200 })
    expect(out).toBe('line1\nline2')
    expect(calls.get?.cfg?.params).toEqual({ lines: 200 })
  })
  it('healthcheck:2xx→true,reject→false', async () => {
    const ok = httpMock({ message: '' })
    expect(await createCompose(ok.http).healthcheck('jellyfin')).toBe(true)
    const bad = { get: () => Promise.reject(new Error('503')) } as unknown as AxiosInstance
    expect(await createCompose(bad).healthcheck('jellyfin')).toBe(false)
  })
})
```

- [ ] **Step 3: 跑测试确认失败**

Run: `pnpm vitest run src/compose.test.ts`
Expected: FAIL(`./compose` 不存在)。

- [ ] **Step 4: 实现 `src/compose.ts`**

```typescript
import type { AxiosInstance } from 'axios'
import type { ComposeAppWithStoreInfo } from './types.js'
import { v2Data } from './v2.js'

const BASE = '/v2/app_management/compose'
const idPath = (id: string) => `${BASE}/${encodeURIComponent(id)}`

export function createCompose(http: AxiosInstance) {
  return {
    async list(): Promise<Record<string, ComposeAppWithStoreInfo>> {
      const res = await http.get(BASE)
      return v2Data<Record<string, ComposeAppWithStoreInfo>>(res.data) ?? {}
    },

    async get(id: string): Promise<ComposeAppWithStoreInfo> {
      const res = await http.get(idPath(id))
      return v2Data<ComposeAppWithStoreInfo>(res.data)
    },

    /** 安装。yaml = compose 原文;dryRun=true 只校验不执行(安装前校验用)。
     *  安装是异步任务:2xx 只代表受理,进度/完成走 MessageBus app:install-*(P3 消费)。 */
    async install(yaml: string, opts?: { dryRun?: boolean; checkPortConflict?: boolean }): Promise<void> {
      await http.post(BASE, yaml, {
        headers: { 'Content-Type': 'application/yaml' },
        params: { dry_run: opts?.dryRun, check_port_conflict: opts?.checkPortConflict },
      })
    },

    /** 修改已装应用设置(PUT 整份 compose YAML,支持 dryRun 预校验)。 */
    async applySettings(id: string, yaml: string, opts?: { dryRun?: boolean; checkPortConflict?: boolean }): Promise<void> {
      await http.put(idPath(id), yaml, {
        headers: { 'Content-Type': 'application/yaml' },
        params: { dry_run: opts?.dryRun, check_port_conflict: opts?.checkPortConflict },
      })
    },

    /** 更新到商店版本(异步,完成走 app:update-end/-error)。 */
    async update(id: string, opts?: { force?: boolean }): Promise<void> {
      await http.patch(idPath(id), undefined, { params: { force: opts?.force } })
    },

    /** 卸载。deleteConfigFolder 后端默认 true(连数据目录一起删),
     *  UI 的「保留数据」选项传 false。异步,完成走 app:uninstall-end/-error。 */
    async uninstall(id: string, opts?: { deleteConfigFolder?: boolean }): Promise<void> {
      await http.delete(idPath(id), { params: { delete_config_folder: opts?.deleteConfigFolder } })
    },

    /** 启停重启。body 是裸 JSON 字符串("start"),直接传字面量会被 axios
     *  当 text/plain 发出、echo Bind 解析失败——apps.start 同款坑。 */
    async setStatus(id: string, action: 'start' | 'stop' | 'restart'): Promise<void> {
      await http.put(`${idPath(id)}/status`, JSON.stringify(action), {
        headers: { 'Content-Type': 'application/json' },
      })
    },

    /** 日志(data 是整段字符串)。lines=-1 取全部,默认后端 1000。 */
    async logs(id: string, opts?: { lines?: number }): Promise<string> {
      const res = await http.get(`${idPath(id)}/logs`, { params: { lines: opts?.lines } })
      return v2Data<string>(res.data) ?? ''
    },

    async containers(id: string): Promise<unknown> {
      const res = await http.get(`${idPath(id)}/containers`)
      return v2Data<unknown>(res.data)
    },

    /** 健康检查:2xx→true,任何失败→false(AppLauncherCheck 语义)。 */
    async healthcheck(id: string): Promise<boolean> {
      try {
        await http.get(`${idPath(id)}/healthcheck`)
        return true
      } catch {
        return false
      }
    },
  }
}
```

- [ ] **Step 5: 跑测试确认通过**

Run: `pnpm vitest run src/compose.test.ts`
Expected: PASS 7/7。

- [ ] **Step 6: 对照 Task 3 实录校正**

重点核:`/compose` data 映射结构、logs data 是否字符串、dry_run 成败两种响应。不符即改,记台账。

- [ ] **Step 7: Commit**

```bash
git add src/types.ts src/compose.ts src/compose.test.ts
git commit -m "feat(compose): 已装应用生命周期域(装/卸/更/设/启停/日志/健康检查,SP5-P0)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

