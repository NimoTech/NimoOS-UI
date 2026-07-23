# SP6-P0 共享包存储域迁移 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `@nimotech/nimoos-service` 补全 `disks` 域并新建 `raid`、`snapshot` 两域,为 SP6 存储区 UI(P1–P5)备齐网络层。

**Architecture:** 照包内既有 domain 模式:`createX(http: AxiosInstance)` 工厂 + `unwrap` 拆标准信封 `{Success,Message,Data}`;惰性 getter 挂到 `index.ts` 的 `service` 上。快照域必须保留 Vue2 已修的两个语义:策略 PUT 全量替换→写操作走读-改-写 `patchPolicy`;快照名可含中文→URL 编码。

**Tech Stack:** TypeScript(NodeNext,**相对 import 必须带 `.js` 后缀**)、axios(注入)、vitest。

## Global Constraints

- 工作区:**只在 `/home/nimo/NimoTech/.sp6/NimoOS-Service`**(worktree,分支 `sp6-storage`)改代码;禁止碰 `/home/nimo/NimoTech/NimoOS-Service`(SP5 会话在用)。
- 包管理 pnpm;测试 `pnpm test`(vitest run);构建 `pnpm build`(tsc)。
- 相对 import 一律 `./xxx.js` 后缀(NodeNext,SP3-T9 教训)。
- 域方法返回**拆信封后的数据**(`unwrap`),不返回 axios response(包内既定契约)。
- 请求形状以 Vue2 现网行为为准(下面每个方法都注了对应后端端点);不发明新字段。
- 背景事实(2026-07-23 真机核查):`/v2/raid` 经网关 200;`/v2/snapshot/*` 经网关 404 = **设备二进制 2026-06-22 旧于快照代码(07-12)**,属版本差非路由错;快照域照迁,P5 前部署新后端。`local_storage` 域不迁(唯二消费者是 MergerFS 死组件)。

---

### Task 1: disks 域补全(getDiskList / umount / getUsbs)

**Files:**
- Modify: `src/disks.ts`(现仅 `umountUsb`)
- Test: `src/disks.test.ts`(已存在,追加用例)

**Interfaces:**
- Produces: `service.disks.getDiskList(params?): Promise<unknown>`(GET `/disks`,信封拆包,Data 通常为盘数组)、`service.disks.umount(data): Promise<unknown>`(DELETE `/disks`,body 透传)、`service.disks.getUsbs(): Promise<unknown>`(GET `/disks/usb`)。`umountUsb` 保持原签名不动。

- [ ] **Step 1: 写失败测试**(追加到 `src/disks.test.ts`)

```ts
it('getDiskList forwards params and unwraps envelope', async () => {
  let seen: unknown
  const http = { get: async (_u: string, cfg?: { params?: unknown }) => { seen = cfg?.params; return { data: { success: 200, data: [{ path: '/dev/sda' }] } } } } as unknown as AxiosInstance
  const res = await createDisks(http).getDiskList({ type: 'all' })
  expect(seen).toEqual({ type: 'all' })
  expect(res).toEqual([{ path: '/dev/sda' }])
})

it('umount deletes /disks with body; getUsbs gets /disks/usb and unwraps', async () => {
  const log: Array<[string, string, unknown]> = []
  const http = {
    get: async (u: string) => { log.push(['get', u, undefined]); return { data: { success: 200, data: [{ name: 'usb0' }] } } },
    delete: async (u: string, cfg?: { data?: unknown }) => { log.push(['delete', u, cfg?.data]); return { data: { success: 200, data: 'ok' } } },
  } as unknown as AxiosInstance
  const d = createDisks(http)
  await d.umount({ path: '/dev/sda' })
  const usbs = await d.getUsbs()
  expect(log).toEqual([['delete', '/disks', { path: '/dev/sda' }], ['get', '/disks/usb', undefined]])
  expect(usbs).toEqual([{ name: 'usb0' }])
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd /home/nimo/NimoTech/.sp6/NimoOS-Service && pnpm test -- disks`
Expected: FAIL,`getDiskList is not a function`

- [ ] **Step 3: 最小实现**(`src/disks.ts` 整文件替换)

```ts
import type { AxiosInstance } from 'axios'
import { unwrap } from './unwrap.js'

export function createDisks(http: AxiosInstance) {
  return {
    // GET /v1/disks — 物理盘列表(信封 Data = 数组)
    async getDiskList(params?: Record<string, unknown>): Promise<unknown> {
      const res = await http.get('/disks', { params })
      const d = res.data
      return Array.isArray(d) ? d : unwrap<unknown>(d)
    },
    // DELETE /v1/disks — 卸载盘(body 透传,Vue2 disks.umount 同形)
    async umount(data: unknown): Promise<unknown> {
      const res = await http.delete('/disks', { data })
      return unwrap<unknown>(res.data)
    },
    // GET /v1/disks/usb — USB 设备列表
    async getUsbs(): Promise<unknown> {
      const res = await http.get('/disks/usb')
      const d = res.data
      return Array.isArray(d) ? d : unwrap<unknown>(d)
    },
    async umountUsb(mountPoint: string): Promise<void> {
      await http.delete('/disks/usb', { data: { mount_point: mountPoint } })
    },
  }
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm test -- disks`
Expected: PASS(原有 umountUsb 用例 + 新增 2 例)

- [ ] **Step 5: Commit**

```bash
git add src/disks.ts src/disks.test.ts
git commit -m "feat(disks): 补全 getDiskList/umount/getUsbs(SP6-P0)"
```

---

### Task 2: raid 域新建(9 方法 + 类型)

**Files:**
- Create: `src/raid.ts`
- Create: `src/raid.test.ts`

**Interfaces:**
- Produces: `createRaid(http)` 返回
  `list(): Promise<RaidStatus[]>` · `create(data: unknown): Promise<unknown>` ·
  `remove(id: number | string): Promise<unknown>` · `getStatus(id): Promise<RaidStatus>` ·
  `getUsage(id): Promise<unknown>` · `replaceDisk(id, data: unknown): Promise<unknown>` ·
  `recover(id): Promise<unknown>` · `listTasks(): Promise<unknown>` · `getTask(taskId: string): Promise<unknown>`。
  类型 `RaidStatus` / `RaidMemberDisk` 从 `raid.ts` 导出(字段抄自后端
  `NimoOS-LocalStorage/service/v2/raid.go:38-56`;DB 内嵌字段走索引签名,不猜名)。

- [ ] **Step 1: 写失败测试**(`src/raid.test.ts` 新文件)

```ts
import { describe, it, expect } from 'vitest'
import type { AxiosInstance } from 'axios'
import { createRaid } from './raid'

function fakeHttp(log: Array<[string, string, unknown]>, data: unknown = {}) {
  return {
    get: async (u: string, cfg?: { params?: unknown }) => { log.push(['get', u, cfg?.params]); return { data: { success: 200, data } } },
    post: async (u: string, b?: unknown) => { log.push(['post', u, b]); return { data: { success: 200, data } } },
    delete: async (u: string, cfg?: { data?: unknown }) => { log.push(['delete', u, cfg?.data]); return { data: { success: 200, data } } },
  } as unknown as AxiosInstance
}

describe('createRaid', () => {
  it('list unwraps RAIDStatus array', async () => {
    const log: Array<[string, string, unknown]> = []
    const arr = [{ live_state: 'clean', rebuild_pct: 0, total_bytes: 1, used_bytes: 0, free_bytes: 1, members: [] }]
    const res = await createRaid(fakeHttp(log, arr)).list()
    expect(log).toEqual([['get', '/v2/raid', undefined]])
    expect(res).toEqual(arr)
  })

  it('urls and verbs match Vue2 raid.js exactly', async () => {
    const log: Array<[string, string, unknown]> = []
    const r = createRaid(fakeHttp(log))
    await r.create({ name: 'md0' }); await r.remove(3); await r.getStatus(3); await r.getUsage(3)
    await r.replaceDisk(3, { old: '/dev/sda', new: '/dev/sdb' }); await r.recover(3)
    await r.listTasks(); await r.getTask('t1')
    expect(log).toEqual([
      ['post', '/v2/raid', { name: 'md0' }],
      ['delete', '/v2/raid/3', undefined],
      ['get', '/v2/raid/3/status', undefined],
      ['get', '/v2/raid/3/usage', undefined],
      ['post', '/v2/raid/3/disk', { old: '/dev/sda', new: '/dev/sdb' }],
      ['post', '/v2/raid/3/recover', undefined],
      ['get', '/v2/raid/tasks', undefined],
      ['get', '/v2/raid/tasks/t1', undefined],
    ])
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test -- raid`
Expected: FAIL,`Cannot find module './raid'`(或等价)

- [ ] **Step 3: 最小实现**(`src/raid.ts` 新文件)

```ts
import type { AxiosInstance } from 'axios'
import { unwrap } from './unwrap.js'

// 字段抄自 NimoOS-LocalStorage/service/v2/raid.go RAIDStatus/MemberDiskStatus;
// 内嵌 DB model(*model.RAIDArray)字段后端拍平在同层,走索引签名。
export interface RaidMemberDisk {
  path: string
  state: string
  number: number
}
export interface RaidStatus {
  live_state: string
  rebuild_pct: number
  rebuild_finish: string
  rebuild_speed: string
  total_bytes: number
  used_bytes: number
  free_bytes: number
  members: RaidMemberDisk[]
  [k: string]: unknown
}

export function createRaid(http: AxiosInstance) {
  return {
    // GET /v2/raid — 阵列列表(含 mdadm 实时态)
    async list(): Promise<RaidStatus[]> {
      const res = await http.get('/v2/raid')
      return unwrap<RaidStatus[]>(res.data)
    },
    // POST /v2/raid — 创建阵列(破坏性;body 同 Vue2 RaidCreateForm)
    async create(data: unknown): Promise<unknown> {
      const res = await http.post('/v2/raid', data)
      return unwrap<unknown>(res.data)
    },
    // DELETE /v2/raid/:id — 删除阵列(破坏性)
    async remove(id: number | string): Promise<unknown> {
      const res = await http.delete(`/v2/raid/${id}`)
      return unwrap<unknown>(res.data)
    },
    async getStatus(id: number | string): Promise<RaidStatus> {
      const res = await http.get(`/v2/raid/${id}/status`)
      return unwrap<RaidStatus>(res.data)
    },
    async getUsage(id: number | string): Promise<unknown> {
      const res = await http.get(`/v2/raid/${id}/usage`)
      return unwrap<unknown>(res.data)
    },
    // POST /v2/raid/:id/disk — 换盘(破坏性)
    async replaceDisk(id: number | string, data: unknown): Promise<unknown> {
      const res = await http.post(`/v2/raid/${id}/disk`, data)
      return unwrap<unknown>(res.data)
    },
    async recover(id: number | string): Promise<unknown> {
      const res = await http.post(`/v2/raid/${id}/recover`)
      return unwrap<unknown>(res.data)
    },
    async listTasks(): Promise<unknown> {
      const res = await http.get('/v2/raid/tasks')
      return unwrap<unknown>(res.data)
    },
    async getTask(taskId: string): Promise<unknown> {
      const res = await http.get(`/v2/raid/tasks/${taskId}`)
      return unwrap<unknown>(res.data)
    },
  }
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm test -- raid`
Expected: PASS(2 例)

- [ ] **Step 5: Commit**

```bash
git add src/raid.ts src/raid.test.ts
git commit -m "feat(raid): 新建 raid 域,9 方法对齐 Vue2 raid.js + RaidStatus 类型(SP6-P0)"
```

---

### Task 3: snapshot 域新建(8 方法,保留读-改-写与编码语义)

**Files:**
- Create: `src/snapshot.ts`
- Create: `src/snapshot.test.ts`

**Interfaces:**
- Produces: `createSnapshot(http)` 返回
  `listVolumes(): Promise<SnapshotVolume[]>` · `list(volumeUuid: string): Promise<unknown>` ·
  `getPolicy(volumeUuid: string): Promise<SnapshotPolicy>` · `updatePolicy(policy: SnapshotPolicy): Promise<unknown>` ·
  `patchPolicy(volumeUuid: string, patch: Partial<SnapshotPolicy>): Promise<unknown>` ·
  `togglePolicy(volumeUuid: string, enabled: boolean): Promise<unknown>` ·
  `create(data: unknown): Promise<unknown>` · `remove(name: string, volumeUuid: string): Promise<unknown>` ·
  `restore(data: { volume_uuid: string; snapshot: string; path: string }): Promise<unknown>`。
  类型 `SnapshotVolume` / `SnapshotPolicy` 从 `snapshot.ts` 导出。
- **两条铁律语义(Vue2 snapshot.js 注释原样搬)**:
  1. `PUT /v2/snapshot/policy` 是**全量替换**——所有策略写操作必须经 `patchPolicy`(先 GET 再合并再 PUT),严禁在别处从零拼 PUT body;
  2. 快照 `name` 常含用户中文(如 `20260712T101502Z_manual_改版前`)——DELETE 的路径段必须 `encodeURIComponent`。

- [ ] **Step 1: 写失败测试**(`src/snapshot.test.ts` 新文件)

```ts
import { describe, it, expect } from 'vitest'
import type { AxiosInstance } from 'axios'
import { createSnapshot } from './snapshot'

describe('createSnapshot', () => {
  it('listVolumes/list/getPolicy pass volume_uuid as query and unwrap', async () => {
    const log: Array<[string, string, unknown]> = []
    const http = { get: async (u: string, cfg?: { params?: unknown }) => { log.push(['get', u, cfg?.params]); return { data: { success: 200, data: [] } } } } as unknown as AxiosInstance
    const s = createSnapshot(http)
    await s.listVolumes(); await s.list('uu-1'); await s.getPolicy('uu-1')
    expect(log).toEqual([
      ['get', '/v2/snapshot/volumes', undefined],
      ['get', '/v2/snapshot', { volume_uuid: 'uu-1' }],
      ['get', '/v2/snapshot/policy', { volume_uuid: 'uu-1' }],
    ])
  })

  it('patchPolicy does read-modify-write (PUT body = current policy + patch)', async () => {
    let putBody: unknown
    const current = { volume_uuid: 'uu-1', enabled: false, hourly_keep: 6, daily_keep: 7, weekly_keep: 4, pause_threshold_pct: 90 }
    const http = {
      get: async () => ({ data: { success: 200, data: current } }),
      put: async (_u: string, b?: unknown) => { putBody = b; return { data: { success: 200, data: 'ok' } } },
    } as unknown as AxiosInstance
    await createSnapshot(http).togglePolicy('uu-1', true)
    expect(putBody).toEqual({ ...current, enabled: true })
  })

  it('remove URL-encodes Chinese snapshot names in the path segment', async () => {
    let seen = ''
    const http = { delete: async (u: string, cfg?: { params?: unknown }) => { seen = u + ':' + JSON.stringify(cfg?.params); return { data: { success: 200, data: 'ok' } } } } as unknown as AxiosInstance
    await createSnapshot(http).remove('20260712T101502Z_manual_改版前', 'uu-1')
    expect(seen).toBe(`/v2/snapshot/${encodeURIComponent('20260712T101502Z_manual_改版前')}:{"volume_uuid":"uu-1"}`)
  })

  it('create posts to root; restore posts {volume_uuid,snapshot,path}', async () => {
    const log: Array<[string, string, unknown]> = []
    const http = { post: async (u: string, b?: unknown) => { log.push(['post', u, b]); return { data: { success: 200, data: 'ok' } } } } as unknown as AxiosInstance
    const s = createSnapshot(http)
    await s.create({ volume_uuid: 'uu-1', type: 'manual' })
    await s.restore({ volume_uuid: 'uu-1', snapshot: 'snap', path: 'docs/a.txt' })
    expect(log).toEqual([
      ['post', '/v2/snapshot', { volume_uuid: 'uu-1', type: 'manual' }],
      ['post', '/v2/snapshot/restore', { volume_uuid: 'uu-1', snapshot: 'snap', path: 'docs/a.txt' }],
    ])
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test -- snapshot`
Expected: FAIL,`Cannot find module './snapshot'`(或等价)

- [ ] **Step 3: 最小实现**(`src/snapshot.ts` 新文件)

```ts
import type { AxiosInstance } from 'axios'
import { unwrap } from './unwrap.js'

// 字段以 Vue2 SnapshotPanel/snapshot.js 实际消费为准(supported/enabled/mount/last_at 等),
// 其余走索引签名——后端 route/snapshot.go 的响应未做 openapi 定义。
export interface SnapshotVolume {
  mount?: string
  volume_uuid?: string
  supported?: boolean
  enabled?: boolean
  [k: string]: unknown
}
export interface SnapshotPolicy {
  volume_uuid?: string
  enabled?: boolean
  hourly_keep?: number
  daily_keep?: number
  weekly_keep?: number
  pause_threshold_pct?: number
  [k: string]: unknown
}

export function createSnapshot(http: AxiosInstance) {
  const api = {
    async listVolumes(): Promise<SnapshotVolume[]> {
      const res = await http.get('/v2/snapshot/volumes')
      return unwrap<SnapshotVolume[]>(res.data)
    },
    async list(volumeUuid: string): Promise<unknown> {
      const res = await http.get('/v2/snapshot', { params: { volume_uuid: volumeUuid } })
      return unwrap<unknown>(res.data)
    },
    async getPolicy(volumeUuid: string): Promise<SnapshotPolicy> {
      const res = await http.get('/v2/snapshot/policy', { params: { volume_uuid: volumeUuid } })
      return unwrap<SnapshotPolicy>(res.data)
    },
    // ⚠️ PUT /v2/snapshot/policy 是全量替换:发部分 body 会把没带的 keep 字段清零。
    // 所有策略写操作必须走 patchPolicy(读-改-写),严禁在别处从零拼 PUT body。
    async updatePolicy(policy: SnapshotPolicy): Promise<unknown> {
      const res = await http.put('/v2/snapshot/policy', policy)
      return unwrap<unknown>(res.data)
    },
    async patchPolicy(volumeUuid: string, patch: Partial<SnapshotPolicy>): Promise<unknown> {
      const current = await api.getPolicy(volumeUuid)
      return api.updatePolicy({ ...current, ...patch })
    },
    async togglePolicy(volumeUuid: string, enabled: boolean): Promise<unknown> {
      return api.patchPolicy(volumeUuid, { enabled })
    },
    async create(data: unknown): Promise<unknown> {
      const res = await http.post('/v2/snapshot', data)
      return unwrap<unknown>(res.data)
    },
    // 快照名常含用户中文(如 20260712T101502Z_manual_改版前)——路径段必须编码。
    async remove(name: string, volumeUuid: string): Promise<unknown> {
      const res = await http.delete(`/v2/snapshot/${encodeURIComponent(name)}`, { params: { volume_uuid: volumeUuid } })
      return unwrap<unknown>(res.data)
    },
    // POST /v2/snapshot/restore 永不覆盖,目标名由后端定;path 相对卷根(非快照目录)。
    async restore(data: { volume_uuid: string; snapshot: string; path: string }): Promise<unknown> {
      const res = await http.post('/v2/snapshot/restore', data)
      return unwrap<unknown>(res.data)
    },
  }
  return api
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm test -- snapshot`
Expected: PASS(4 例)

- [ ] **Step 5: Commit**

```bash
git add src/snapshot.ts src/snapshot.test.ts
git commit -m "feat(snapshot): 新建 snapshot 域,保留策略读-改-写与中文名编码语义(SP6-P0)"
```

---

### Task 4: index.ts 挂载导出 + 构建 + 消费方回归

**Files:**
- Modify: `src/index.ts`(import + `service` getter + 类型导出)
- Test: 全量 `pnpm test` + `pnpm build`;New-UI worktree 重链后全量回归

**Interfaces:**
- Consumes: Task 2 `createRaid`/`RaidStatus`/`RaidMemberDisk`,Task 3 `createSnapshot`/`SnapshotVolume`/`SnapshotPolicy`。
- Produces: `service.raid` / `service.snapshot` 惰性 getter(P1–P5 的 UI 用这个入口);类型经包根导出。

- [ ] **Step 1: 挂载**(`src/index.ts` 三处追加)

import 区(照现有排列,注意 `.js` 后缀):

```ts
import { createRaid } from './raid.js'
import { createSnapshot } from './snapshot.js'
```

类型导出行追加(与现有 `export type {...} from './types.js'` 并列,新加一行):

```ts
export type { RaidStatus, RaidMemberDisk } from './raid.js'
export type { SnapshotVolume, SnapshotPolicy } from './snapshot.js'
```

`service` 对象内追加(照 `storage` getter 的样子):

```ts
  get raid(): ReturnType<typeof createRaid> {
    return createRaid(getHttp() as AxiosInstance)
  },
  get snapshot(): ReturnType<typeof createSnapshot> {
    return createSnapshot(getHttp() as AxiosInstance)
  },
```

- [ ] **Step 2: 包内全量测试 + 构建**

Run: `cd /home/nimo/NimoTech/.sp6/NimoOS-Service && pnpm test && pnpm build`
Expected: 全部 PASS(117 基线 + 本期新增 8 例),tsc 零错误

- [ ] **Step 3: 消费方重链 + 回归**(pnpm file: 依赖不自动同步——`nimoos-service-pnpm-drift` 教训)

Run: `cd /home/nimo/NimoTech/.sp6/NimoOS-New-UI && pnpm install && pnpm test && npx vue-tsc --noEmit`
Expected: install 重链本地包;New-UI 1197 基线全 PASS;tsc 零错误

- [ ] **Step 4: Commit**

```bash
cd /home/nimo/NimoTech/.sp6/NimoOS-Service
git add src/index.ts
git commit -m "feat: service.raid / service.snapshot 挂载导出(SP6-P0 收口)"
```

---

## 完成定义(P0 关账条件)

1. Service worktree:disks 3 新方法 + raid 域 9 方法 + snapshot 域 8 方法,全部有 URL/动词/语义锁死的单测;`pnpm test`、`pnpm build` 双清。
2. New-UI worktree 重链后 1197 基线 + tsc 双清(本期不改 New-UI 代码)。
3. 不迁清单已核实并留证:`local_storage` 域(死,唯二消费者为 MergerFS 死组件;`display_names` 后端活但无消费者)、`port` 域(推迟 SP9)——记入 spec §6 台账,合并时进 roadmap。
