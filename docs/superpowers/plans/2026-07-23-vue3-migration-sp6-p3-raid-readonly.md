# SP6-P3 RAID(只读)迁移 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 Vue2 存储管理弹窗的 RAID **只读**部分(列表卡片 + 状态 + 详情面板【不含快照】+ 使用率 + 创建任务进度卡)迁成 New-UI `/storage/raid` 与 `/storage/raid/:id` 两个路由,数据全部走已在 P0 进包的 `service.raid` 只读方法。

**Architecture:** 沿用 P1/P2 既定套路——视图在 `src/views/`,共享片段(卡片/弹窗/store/纯工具)在 `src/storage/`,所有 service 调用只在 Pinia store(`src/storage/stores/storage.ts`)里发生,视图只读 store + 管生命周期。RAID 的活体轮询(重建中 5000ms 重拉状态、创建任务 1500ms 拉进度)用**递归 setTimeout 守卫**实现(单飞:上一拍 resolve 后才排下一拍,天然防重叠——这是 SP5-P6 的教训,也是用户本期明确要求)。**顺手偿还 P1 台账债**:把 StorageVolumes/StorageDrives 里字节级重复的 500ms 防抖热插拔接线抽成 `useDiskHotplug` composable(RAID 列表页是第三个消费者)。

**Tech Stack:** Vue 3 `<script setup>` + TS · Pinia setup-store · vue-router 4(hash,`createWebHashHistory('/app/')`)· vue-i18n 9 · reka-ui(Dialog 原语)· vitest + @vue/test-utils · socket.io(MessageBus,经 `useMessageBus`)。**无 Tailwind/无 CSS 框架,颜色一律 theme token。**

## Global Constraints

这些约束绑定**每一个** Task,不再逐条重复:

- **只读边界**:本期**不**做任何写操作。`create` / `remove` / `replaceDisk` / `recover` 归 **P4**;btrfs 快照面板归 **P5**。因此 RAID 详情页**不**渲染 "Replace Disk" / "Rediscover(recover)" / "Delete" 按钮,也**不**挂快照面板——降级/重试横幅只显示只读状态文字与进度,动作按钮留给 P4。这不是缺陷,是 plan 划定的相位边界(设计 §4)。
- **service 只读方法(P0 已进包,本期零改 NimoOS-Service)**:`service.raid.list(): Promise<RaidStatus[]>`、`service.raid.getStatus(id): Promise<RaidStatus>`、`service.raid.getUsage(id): Promise<unknown>`、`service.raid.listTasks(): Promise<unknown>`、`service.raid.getTask(taskId): Promise<unknown>`。`getUsage/listTasks/getTask` 返回 `unknown`——**在 UI 层收窄**(定义本地 interface),不改 service 包(P0 ledger 明示 "P1-P5 UI 可按需收窄 unknown 返回类型")。**不得**动 `/home/nimo/NimoTech/.sp6/NimoOS-Service`。
- **共享类型**:`import type { RaidStatus, RaidMemberDisk } from '@nimotech/nimoos-service'`。`RaidStatus = { live_state: string; rebuild_pct: number; rebuild_finish: string; rebuild_speed: string; total_bytes: number; used_bytes: number; free_bytes: number; members: RaidMemberDisk[]; [k: string]: unknown }`;`RaidMemberDisk = { path: string; state: string; number: number }`。注意 `RaidStatus` 有 `[k: string]: unknown` 索引签名,`list()` 返回的数组元素其实携带 `id/name/level/state/member_disks/mount_point/...` 等字段(经索引签名透传)——UI 需定义 `RaidArray` 视图类型来收窄这些字段。
- **要逐字保留的后端字符串词表**(迁移前后读数/判定必须不变):
  - **阵列 `state`**(来自 list/getStatus):`"active"`、`"degraded"`、`"rebuilding"`、`"retrying"`、`"failed"`;`live_state` 子串 `"recovering"`、`"resyncing"`。
  - **任务 `status`**(来自 listTasks/getTask):`"creating"`、`"done"`、`"failed"`。
  - **成员 `state`**(mdadm):`"active sync"`(**startsWith** 前缀匹配,RAID10 形如 `"active sync set-A"`/`"set-B"`)、`"faulty"`、`"removed"`、含 `"rebuilding"` 子串。
  - **RAID 级别**:数字 `level`(`0/1/5/6/10`),渲染为 `RAID {level}`。
- **数据来源纪律(逐字对齐 Vue2)**:`used/total/free` 与百分比来自 **getStatus**(`used_bytes/total_bytes/free_bytes`),**不**来自 getUsage;`getUsage` 只用于详情页 btrfs 估算空闲 + 缓存时刻两行。字节格式化统一用 `fmtSize`(`import { fmtSize } from '../../home/util/format'`,VolumeCard 同款)。
- **颜色 = theme token,零字面量**(`src/styles/color-guard.test.ts` + `color-guard` 会红):所有颜色写 `var(--…)`,新语义须在 `theme.css` 的 `:root` 与 `:root[data-theme="light"]` **两块**都给值。状态→token 映射(全期统一):healthy/active→`--sem-fg`;rebuilding/info→`--accent`;retrying/warning→`--dem-fg`;degraded/failed/danger→`--remove-fg`;neutral→`--nrm-fg`/`--fg-muted`。徽章药丸沿用 `.vc-os` 形状(圆角 999px,`--nrm-bg` 底 + `--nrm-bd` 边),文字色按上表。**本期预计无需新增 token**(复用现有);若确需新语义色,两块都加,禁止就地写死。
- **i18n 双写**:任何新文案 key 必须**同时**加到 `src/i18n/zh_cn.ts` 与 `src/i18n/en_us.ts`,否则 `src/i18n/parity.test.ts` 红。zh_cn 为默认/兜底。
- **MessageBus handler 不可阻塞**(buffer=1):热插拔只做 500ms 防抖后刷新,handler 内不 await 重活。
- **只记 message 不记整个 error**:catch 里 `console.warn('[storage] xxx failed', (e as Error)?.message)`——RAID 只读无密码请求体,但沿用既有纪律保持一致。
- **每期收尾门**:`pnpm test`(全绿)+ `pnpm exec vue-tsc --noEmit`(零错)→ 5273 常驻预览重建 dist 眼验(见 §收尾)。**禁区**:不跑 `deploy.sh`、不写 `/var/lib/nimoos/www`、不改 NimoOS-UI 仓、不改 roadmap(全部推迟 P6)。

---

### 文件结构总览(本期创建/修改)

**新建:**
- `src/storage/util/raidView.ts`(+ `.test.ts`)—— 纯函数 + 视图收窄类型(RAID 逻辑主场,TDD)
- `src/composables/useDiskHotplug.ts`(+ `.test.ts`)—— 抽取的热插拔 composable(P1 债)
- `src/composables/useGuardedPoll.ts`(+ `.test.ts`)—— 递归 setTimeout 单飞轮询器(状态重拉 + 任务进度共用)
- `src/storage/components/RaidCard.vue`(+ `.test.ts`)—— 列表卡片
- `src/storage/components/RaidCreatingCard.vue`(+ `.test.ts`)—— 列表顶内联"创建中"卡
- `src/storage/components/RaidCreateProgressModal.vue`(+ `.test.ts`)—— 创建进度详情弹窗(6 步)
- `src/storage/components/RaidMemberList.vue`(+ `.test.ts`)—— 成员盘列表(平铺 + RAID10 镜像对)
- `src/views/StorageRaid.vue`(+ `.test.ts`)—— RAID 列表视图
- `src/views/StorageRaidDetail.vue`(+ `.test.ts`)—— RAID 详情视图

**修改:**
- `src/storage/stores/storage.ts` —— 加 raid 只读状态 + `loadRaid()` / `loadRaidDetail(id)` / 任务检测&轮询 action
- `src/views/StorageVolumes.vue` / `src/views/StorageDrives.vue` —— 改用 `useDiskHotplug`(删重复块)
- `src/storage/components/StorageShell.vue` —— 加 RAID 标签页(`route.path.startsWith('/storage/raid')` 高亮)
- `src/router/index.ts` —— 加 `/storage/raid` 与 `/storage/raid/:id` 路由
- `src/i18n/zh_cn.ts` / `src/i18n/en_us.ts` —— RAID 文案 key(随引入它的 Task 增补)

**任务依赖顺序**:T1(hotplug 债)→ T2(纯工具+类型)→ T3(store 只读拉取)→ T4(RaidCard)→ T5(useGuardedPoll)→ T6(列表视图+路由+tab+状态重拉)→ T7(任务检测&轮询 store+接线)→ T8(创建中卡+进度弹窗)→ T9(详情视图+成员列表+路由)。

---

### Task 1: 抽取 `useDiskHotplug` composable(偿还 P1 台账债)

StorageVolumes 与 StorageDrives 各有一份**字节级完全相同**的 500ms 防抖热插拔接线。P1 ledger 记账:"第三个热插拔消费者出现时(RAID 列表页)抽成 `useDiskHotplug`"。本 Task 先抽,后续 RAID 视图直接复用。

**Files:**
- Create: `src/composables/useDiskHotplug.ts`
- Test: `src/composables/useDiskHotplug.test.ts`
- Modify: `src/views/StorageVolumes.vue`(删 L60-80 重复块,改调 composable)
- Modify: `src/views/StorageDrives.vue`(删 L13-33 重复块,改调 composable)

**Interfaces:**
- Produces: `useDiskHotplug(refresh: () => void, opts?: { debounceMs?: number; loadOnMount?: boolean }): void`
  - 默认 `debounceMs = 500`,`loadOnMount = true`。
  - 行为:`onMounted` 时若 `loadOnMount` 则立即 `refresh()`,并 `bus.on('local-storage:disk:added'|'local-storage:disk:removed', 防抖(refresh))`;`onUnmounted` 调两个 off-fn + `clearTimeout`。
  - 依赖 `useMessageBus()`(`on(event, cb) => offFn`,见 `src/composables/useMessageBus.ts`)。

- [ ] **Step 1: 写失败测试** `src/composables/useDiskHotplug.test.ts`

用一个宿主组件挂载 composable(仿 StorageDrives.test.ts 的 useMessageBus mock:捕获 handler + off-fn 到 map)。

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import { useDiskHotplug } from './useDiskHotplug'

const handlers: Record<string, (...a: unknown[]) => void> = {}
const offs: Record<string, ReturnType<typeof vi.fn>> = {}
vi.mock('./useMessageBus', () => ({
  useMessageBus: () => ({
    on: (ev: string, cb: (...a: unknown[]) => void) => {
      handlers[ev] = cb
      offs[ev] = vi.fn()
      return offs[ev]
    },
  }),
}))

function host(refresh: () => void, opts?: Record<string, unknown>) {
  return defineComponent({
    setup() { useDiskHotplug(refresh, opts); return () => null },
  })
}

describe('useDiskHotplug', () => {
  beforeEach(() => { vi.useFakeTimers(); for (const k in handlers) delete handlers[k]; for (const k in offs) delete offs[k] })
  afterEach(() => { vi.useRealTimers(); vi.clearAllMocks() })

  it('mount 时订阅 added/removed 且 loadOnMount 默认立即 refresh 一次', () => {
    const refresh = vi.fn()
    mount(host(refresh))
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(typeof handlers['local-storage:disk:added']).toBe('function')
    expect(typeof handlers['local-storage:disk:removed']).toBe('function')
  })

  it('loadOnMount:false 时 mount 不 refresh', () => {
    const refresh = vi.fn()
    mount(host(refresh, { loadOnMount: false }))
    expect(refresh).not.toHaveBeenCalled()
  })

  it('500ms 防抖:连发多次事件只刷新一次', () => {
    const refresh = vi.fn()
    mount(host(refresh, { loadOnMount: false }))
    handlers['local-storage:disk:added']()
    handlers['local-storage:disk:added']()
    handlers['local-storage:disk:removed']()
    expect(refresh).not.toHaveBeenCalled()
    vi.advanceTimersByTime(500)
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('unmount 调两个 off-fn 且清定时器', () => {
    const refresh = vi.fn()
    const w = mount(host(refresh, { loadOnMount: false }))
    handlers['local-storage:disk:added']() // 挂起一个未触发的防抖
    w.unmount()
    expect(offs['local-storage:disk:added']).toHaveBeenCalledTimes(1)
    expect(offs['local-storage:disk:removed']).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(500)
    expect(refresh).not.toHaveBeenCalled() // 卸载后不再触发
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm exec vitest run src/composables/useDiskHotplug.test.ts`
Expected: FAIL(`useDiskHotplug` 未定义 / 模块不存在)。

- [ ] **Step 3: 写实现** `src/composables/useDiskHotplug.ts`

```ts
import { onMounted, onUnmounted } from 'vue'
import { useMessageBus } from './useMessageBus'

// 从 StorageVolumes/StorageDrives 抽取的重复热插拔接线(P1 台账债)。
// MessageBus handler 不可阻塞(buffer=1):防抖后刷新(Vue2 MountList 先例)。
export function useDiskHotplug(
  refresh: () => void,
  opts: { debounceMs?: number; loadOnMount?: boolean } = {},
): void {
  const { debounceMs = 500, loadOnMount = true } = opts
  const bus = useMessageBus()
  let hotplugTimer: number | undefined
  function onHotplug() {
    clearTimeout(hotplugTimer)
    hotplugTimer = window.setTimeout(() => { refresh() }, debounceMs)
  }
  let offAdd: (() => void) | undefined
  let offRemove: (() => void) | undefined
  onMounted(() => {
    if (loadOnMount) refresh()
    offAdd = bus.on('local-storage:disk:added', onHotplug)
    offRemove = bus.on('local-storage:disk:removed', onHotplug)
  })
  onUnmounted(() => {
    offAdd?.()
    offRemove?.()
    clearTimeout(hotplugTimer)
  })
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm exec vitest run src/composables/useDiskHotplug.test.ts`
Expected: PASS(4/4)。

- [ ] **Step 5: 改 StorageVolumes.vue 用 composable**

删掉 `<script setup>` 里的 L60-80 热插拔块(`hotplugTimer`/`onHotplug`/`offAdd`/`offRemove`/相关 `onMounted`/`onUnmounted`)以及现在多余的 `bus`/`onMounted`/`onUnmounted` import(若别处仍用则保留)。改为:

```ts
import { useDiskHotplug } from '../composables/useDiskHotplug'
// ...
useDiskHotplug(() => store.loadAll())
```

保留视图里其它逻辑(dialog 状态、`store.loadAll()` 的其它引用)。若原 `onMounted` 里除 `store.loadAll()` 外无其它逻辑,则整段由 composable 的 `loadOnMount` 接管。

- [ ] **Step 6: 改 StorageDrives.vue 用 composable**

同样删 L13-33 块,改为 `useDiskHotplug(() => store.loadAll())`,清理不再使用的 import。

- [ ] **Step 7: 跑受影响测试确认全绿**

Run: `pnpm exec vitest run src/views/StorageVolumes.test.ts src/views/StorageDrives.test.ts src/composables/useDiskHotplug.test.ts`
Expected: PASS。若 StorageDrives.test.ts 里针对 mount 订阅/500ms 防抖/unmount off-fn 的三条断言现在测的是视图内联块,需保持它们仍能通过(视图仍经 composable 订阅同样的事件、同样 500ms、unmount 仍调 off-fn)。如断言用 `handlers['local-storage:disk:added']` 之类 mock 捕获,composable 复用同一 `useMessageBus` mock,应无缝通过。**不要**为迁就测试改动 composable 行为;若测试因内部结构而非可观察行为失败,调整测试断言到"可观察行为"层面。

- [ ] **Step 8: 提交**

```bash
git add src/composables/useDiskHotplug.ts src/composables/useDiskHotplug.test.ts src/views/StorageVolumes.vue src/views/StorageDrives.vue
git commit -m "refactor(storage): 抽取 useDiskHotplug composable(偿还 P1 热插拔重复债)"
```

---

### Task 2: `raidView.ts` 纯函数 + 视图收窄类型

RAID 逻辑主场(TDD)。收窄 `unknown` 返回、把 Vue2 `RaidCard`/`RaidDetailPanel`/`raidUtils.js` 里的状态/成员/级别/使用率纯逻辑逐字移植成可测纯函数。

**Files:**
- Create: `src/storage/util/raidView.ts`
- Test: `src/storage/util/raidView.test.ts`

**Interfaces:**
- Produces(类型):
  - `RaidArray`(收窄 `list()` 元素):`{ id: number | string; name: string; level: number; state: string; member_disks?: unknown[]; mount_point?: string; device_path?: string; uuid?: string; chunk_kb?: number; filesystem?: string; fsType?: string }`
  - `RaidTask`:`{ taskId: string; name: string; level: number; filesystem: string; diskCount: number; step: number; stepName: string; progress: number; elapsedSeconds: number; error: string; status: string }`
  - `RaidUsage`:`{ filesystem?: string; btrfs_usage?: { free_estimated_bytes?: number; cached_at?: string | number } }`
  - `RaidStateFlags`:`{ effectiveState: string; liveState: string; isRebuilding: boolean; isDegraded: boolean; isFailed: boolean; isRetrying: boolean }`
  - `RaidSeverity = 'ok' | 'info' | 'warning' | 'danger'`
  - `MemberSquare = { kind: 'ok' | 'fail' | 'rebuild' | 'unknown'; token: string; labelKey: string; glyph: string }`
- Produces(函数):`asRaidArray`, `mapTask`, `resolveRaidState`, `raidSeverity`, `raidStateLabelKey`, `countActiveDisks`, `memberSquare`, `raidUsagePercent`, `levelInfo`, `mirrorPairs`, `isRebuildingList`。

- [ ] **Step 1: 写失败测试** `src/storage/util/raidView.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import {
  mapTask, resolveRaidState, raidSeverity, raidStateLabelKey,
  countActiveDisks, memberSquare, raidUsagePercent, mirrorPairs, isRebuildingList,
} from './raidView'
import type { RaidArray } from './raidView'

const arr = (o: Partial<RaidArray> = {}): RaidArray =>
  ({ id: 1, name: 'md0', level: 1, state: 'active', ...o }) as RaidArray

describe('resolveRaidState', () => {
  it('healthy: active 无重建 → 全 false', () => {
    const f = resolveRaidState(arr({ state: 'active' }), { state: 'active', live_state: 'active', rebuild_pct: 0 } as never)
    expect(f).toMatchObject({ isRebuilding: false, isDegraded: false, isFailed: false, isRetrying: false })
    expect(raidSeverity(f)).toBe('ok')
    expect(raidStateLabelKey(f)).toBe('raidStateHealthy')
  })
  it('rebuilding: state==rebuilding → isRebuilding, info', () => {
    const f = resolveRaidState(arr({ state: 'rebuilding' }), { live_state: 'recovering', rebuild_pct: 42 } as never)
    expect(f.isRebuilding).toBe(true)
    expect(raidSeverity(f)).toBe('info')
    expect(raidStateLabelKey(f)).toBe('raidStateRebuilding')
  })
  it('live_state 含 resyncing 也算重建', () => {
    const f = resolveRaidState(arr({ state: 'active' }), { live_state: 'resyncing', rebuild_pct: 0 } as never)
    expect(f.isRebuilding).toBe(true)
  })
  it('rebuild_pct>0 也算重建', () => {
    const f = resolveRaidState(arr({ state: 'active' }), { live_state: 'active', rebuild_pct: 5 } as never)
    expect(f.isRebuilding).toBe(true)
  })
  it('degraded 且非重建 → isDegraded, danger', () => {
    const f = resolveRaidState(arr({ state: 'degraded' }), { live_state: 'degraded', rebuild_pct: 0 } as never)
    expect(f.isDegraded).toBe(true)
    expect(raidSeverity(f)).toBe('danger')
    expect(raidStateLabelKey(f)).toBe('raidStateDegraded')
  })
  it('degraded 且重建中 → isRebuilding 优先,isDegraded=false', () => {
    const f = resolveRaidState(arr({ state: 'degraded' }), { live_state: 'recovering', rebuild_pct: 30 } as never)
    expect(f.isRebuilding).toBe(true)
    expect(f.isDegraded).toBe(false)
    expect(raidStateLabelKey(f)).toBe('raidStateRebuilding')
  })
  it('failed → danger, raidStateFailed', () => {
    const f = resolveRaidState(arr({ state: 'failed' }), { live_state: 'failed', rebuild_pct: 0 } as never)
    expect(f.isFailed).toBe(true)
    expect(raidSeverity(f)).toBe('danger')
    expect(raidStateLabelKey(f)).toBe('raidStateFailed')
  })
  it('retrying → warning, raidStateRetrying', () => {
    const f = resolveRaidState(arr({ state: 'retrying' }), undefined)
    expect(f.isRetrying).toBe(true)
    expect(raidSeverity(f)).toBe('warning')
    expect(raidStateLabelKey(f)).toBe('raidStateRetrying')
  })
  it('status 缺失时回退 array.state', () => {
    const f = resolveRaidState(arr({ state: 'degraded' }), undefined)
    expect(f.effectiveState).toBe('degraded')
  })
})

describe('countActiveDisks', () => {
  it('前缀匹配 "active sync"(含 set-A/set-B)', () => {
    const members = [
      { path: '/dev/sda', state: 'active sync set-A', number: 0 },
      { path: '/dev/sdb', state: 'active sync set-B', number: 1 },
      { path: '/dev/sdc', state: 'faulty', number: 2 },
    ]
    expect(countActiveDisks(members, 3)).toBe(2)
  })
  it('members 为空时回退 fallback 计数', () => {
    expect(countActiveDisks([], 4)).toBe(0) // 空数组 → 0 active(fallback 只用于 total)
  })
})

describe('memberSquare', () => {
  it('active sync* → ok', () => { expect(memberSquare('active sync set-A').kind).toBe('ok') })
  it('faulty → fail', () => { expect(memberSquare('faulty').kind).toBe('fail') })
  it('removed → fail', () => { expect(memberSquare('removed').kind).toBe('fail') })
  it('含 rebuilding → rebuild', () => { expect(memberSquare('spare rebuilding').kind).toBe('rebuild') })
  it('其它 → unknown', () => { expect(memberSquare('spare').kind).toBe('unknown') })
})

describe('raidUsagePercent', () => {
  it('常规四舍五入', () => { expect(raidUsagePercent(50, 100)).toBe(50) })
  it('total=0 → 0', () => { expect(raidUsagePercent(10, 0)).toBe(0) })
  it('非零但 <1% → 夹为 1', () => { expect(raidUsagePercent(1, 100000)).toBe(1) })
  it('used=0 → 0', () => { expect(raidUsagePercent(0, 100)).toBe(0) })
})

describe('mapTask', () => {
  it('把 snake_case API 字段映射为 camelCase', () => {
    const t = mapTask({
      task_id: 'abc', name: 'md0', level: 5, filesystem: 'btrfs', disk_count: 4,
      step: 3, step_name: 'Create RAID Array', progress: 55, elapsed_seconds: 120,
      error: '', status: 'creating',
    })
    expect(t).toEqual({
      taskId: 'abc', name: 'md0', level: 5, filesystem: 'btrfs', diskCount: 4,
      step: 3, stepName: 'Create RAID Array', progress: 55, elapsedSeconds: 120,
      error: '', status: 'creating',
    })
  })
  it('缺字段给安全默认', () => {
    const t = mapTask({ task_id: 'x', status: 'creating' })
    expect(t.name).toBe(''); expect(t.progress).toBe(0); expect(t.diskCount).toBe(0)
  })
})

describe('mirrorPairs (RAID10)', () => {
  it('按 floor(number/2) 分对,set-A 在前', () => {
    const members = [
      { path: '/dev/sdb', state: 'active sync set-B', number: 1 },
      { path: '/dev/sda', state: 'active sync set-A', number: 0 },
      { path: '/dev/sdd', state: 'active sync set-B', number: 3 },
      { path: '/dev/sdc', state: 'active sync set-A', number: 2 },
    ]
    const pairs = mirrorPairs(members)
    expect(pairs.length).toBe(2)
    expect(pairs[0].map((m) => m.path)).toEqual(['/dev/sda', '/dev/sdb'])
    expect(pairs[1].map((m) => m.path)).toEqual(['/dev/sdc', '/dev/sdd'])
  })
})

describe('isRebuildingList', () => {
  it('任一阵列重建中 → true(驱动 5000ms 重拉)', () => {
    const flags = [
      { isRebuilding: false } as never,
      { isRebuilding: true } as never,
    ]
    expect(isRebuildingList(flags)).toBe(true)
  })
  it('全不重建 → false', () => {
    expect(isRebuildingList([{ isRebuilding: false } as never])).toBe(false)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm exec vitest run src/storage/util/raidView.test.ts`
Expected: FAIL(模块不存在)。

- [ ] **Step 3: 写实现** `src/storage/util/raidView.ts`

逐字移植自 Vue2:`RaidCard.vue` L79-145(状态/成员/activeDisks/usagePercent)、`RaidDetailPanel.vue` L244-307/343-375(mirrorPairs/成员标签)、`raidUtils.js` L1-76 `RAID_LEVELS`(级别信息)。

```ts
import type { RaidStatus, RaidMemberDisk } from '@nimotech/nimoos-service'

export interface RaidArray {
  id: number | string
  name: string
  level: number
  state: string
  member_disks?: unknown[]
  mount_point?: string
  device_path?: string
  uuid?: string
  chunk_kb?: number
  filesystem?: string
  fsType?: string
}

export interface RaidTask {
  taskId: string
  name: string
  level: number
  filesystem: string
  diskCount: number
  step: number
  stepName: string
  progress: number
  elapsedSeconds: number
  error: string
  status: string
}

export interface RaidUsage {
  filesystem?: string
  btrfs_usage?: { free_estimated_bytes?: number; cached_at?: string | number }
}

export interface RaidStateFlags {
  effectiveState: string
  liveState: string
  isRebuilding: boolean
  isDegraded: boolean
  isFailed: boolean
  isRetrying: boolean
}

export type RaidSeverity = 'ok' | 'info' | 'warning' | 'danger'

// list() 返回 RaidStatus[](索引签名透传 id/name/level 等);收窄为 RaidArray。
export function asRaidArray(raw: RaidStatus | Record<string, unknown>): RaidArray {
  const r = raw as Record<string, unknown>
  return {
    id: (r.id as number | string) ?? '',
    name: (r.name as string) || '',
    level: Number(r.level) || 0,
    state: (r.state as string) || '',
    member_disks: Array.isArray(r.member_disks) ? (r.member_disks as unknown[]) : [],
    mount_point: (r.mount_point as string) || '',
    device_path: (r.device_path as string) || '',
    uuid: (r.uuid as string) || '',
    chunk_kb: Number(r.chunk_kb) || 0,
    filesystem: (r.filesystem as string) || '',
    fsType: (r.fsType as string) || '',
  }
}

export function mapTask(raw: Record<string, unknown>): RaidTask {
  return {
    taskId: String(raw.task_id ?? ''),
    name: (raw.name as string) || '',
    level: Number(raw.level) || 0,
    filesystem: (raw.filesystem as string) || '',
    diskCount: Number(raw.disk_count) || 0,
    step: Number(raw.step) || 0,
    stepName: (raw.step_name as string) || '',
    progress: Number(raw.progress) || 0,
    elapsedSeconds: Number(raw.elapsed_seconds) || 0,
    error: (raw.error as string) || '',
    status: (raw.status as string) || '',
  }
}

// 逐字移植 RaidCard.vue 状态计算(L82-92)。
export function resolveRaidState(array: RaidArray, status?: RaidStatus | null): RaidStateFlags {
  const effectiveState = (status?.state as string) || array.state || ''
  const liveState = (status?.live_state as string) || effectiveState
  const rebuildPct = Number(status?.rebuild_pct) || 0
  const isRebuilding =
    effectiveState === 'rebuilding' ||
    liveState.includes('recovering') ||
    liveState.includes('resyncing') ||
    rebuildPct > 0
  const isDegraded = effectiveState === 'degraded' && !isRebuilding
  const isFailed = effectiveState === 'failed'
  const isRetrying = effectiveState === 'retrying'
  return { effectiveState, liveState, isRebuilding, isDegraded, isFailed, isRetrying }
}

// 颜色语义(RaidCard.vue statusColor L100-105):degraded/failed→danger,rebuilding→info,retrying→warning,else ok。
export function raidSeverity(f: RaidStateFlags): RaidSeverity {
  if (f.isDegraded || f.isFailed) return 'danger'
  if (f.isRebuilding) return 'info'
  if (f.isRetrying) return 'warning'
  return 'ok'
}

// 文案 key(RaidCard.vue statusLabel L106-112)。isDegraded 已互斥重建,故此序安全。
export function raidStateLabelKey(f: RaidStateFlags): string {
  if (f.isDegraded) return 'raidStateDegraded'
  if (f.isRebuilding) return 'raidStateRebuilding'
  if (f.isFailed) return 'raidStateFailed'
  if (f.isRetrying) return 'raidStateRetrying'
  return 'raidStateHealthy'
}

// RaidCard.vue activeDisks L114-118:前缀匹配 "active sync"。
export function countActiveDisks(members: RaidMemberDisk[], _total: number): number {
  return (members || []).filter((m) => (m?.state || '').startsWith('active sync')).length
}

export interface MemberSquare {
  kind: 'ok' | 'fail' | 'rebuild' | 'unknown'
  token: string // theme token(不含 var());模板里包 var()
  labelKey: string
  glyph: string
}

// RaidCard.vue memberSquares L125-136 + RaidDetailPanel memberColor/memberStateLabel L343-375。
export function memberSquare(state: string): MemberSquare {
  const s = state || ''
  if (s.startsWith('active sync')) return { kind: 'ok', token: '--sem-fg', labelKey: 'raidMemberActive', glyph: '✓' }
  if (s === 'faulty' || s === 'removed') return { kind: 'fail', token: '--remove-fg', labelKey: 'raidMemberFaulty', glyph: '✕' }
  if (s.includes('rebuilding')) return { kind: 'rebuild', token: '--accent', labelKey: 'raidMemberRebuilding', glyph: '↻' }
  return { kind: 'unknown', token: '--fg-muted', labelKey: '', glyph: '•' }
}

// RaidCard.vue usagePercent L139-144:非零 <1% 夹为 1,再 round。
export function raidUsagePercent(used: number, total: number): number {
  if (!total || total <= 0) return 0
  const pct = (used / total) * 100
  if (pct > 0 && pct < 1) return 1
  return Math.round(pct)
}

// RaidDetailPanel mirrorPairs L291-307:按 floor(number/2) 分组,set-A 在前。
export function mirrorPairs(members: RaidMemberDisk[]): RaidMemberDisk[][] {
  const groups = new Map<number, RaidMemberDisk[]>()
  for (const m of members || []) {
    const key = Math.floor((Number(m?.number) || 0) / 2)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(m)
  }
  return [...groups.keys()].sort((a, b) => a - b).map((k) =>
    groups.get(k)!.slice().sort((a, b) => {
      const aA = (a.state || '').includes('set-A') ? 0 : 1
      const bA = (b.state || '').includes('set-A') ? 0 : 1
      return aA - bA
    }),
  )
}

export function isRebuildingList(flags: Array<Pick<RaidStateFlags, 'isRebuilding'>>): boolean {
  return (flags || []).some((f) => f.isRebuilding)
}

// 级别静态信息。值逐字移植自 RaidDetailPanel.vue L267-290(levelFaultTolerance/ReadSpeed/WriteSpeed)
// 与 raidUtils.js RAID_LEVELS(L1-76,含 level 10);descKey 走 i18n。
export interface RaidLevelInfo {
  name: string          // 'RAID 0'..'RAID 10'
  faultToleranceKey: string
  readSpeedKey: string
  writeSpeedKey: string
  descKey: string
}
// TODO(实现步):把 RaidDetailPanel.vue L267-290 的 tolerance/read/write 文案、raidUtils RAID_LEVELS 的 name/desc
// 逐字转成 i18n key(raidLevel0Tolerance 等),填入下表。0/1/5/6 必填;10 从 raidUtils 补。
export const RAID_LEVEL_INFO: Record<number, RaidLevelInfo> = {
  0: { name: 'RAID 0', faultToleranceKey: 'raidLevel0Tolerance', readSpeedKey: 'raidLevel0Read', writeSpeedKey: 'raidLevel0Write', descKey: 'raidLevel0Desc' },
  1: { name: 'RAID 1', faultToleranceKey: 'raidLevel1Tolerance', readSpeedKey: 'raidLevel1Read', writeSpeedKey: 'raidLevel1Write', descKey: 'raidLevel1Desc' },
  5: { name: 'RAID 5', faultToleranceKey: 'raidLevel5Tolerance', readSpeedKey: 'raidLevel5Read', writeSpeedKey: 'raidLevel5Write', descKey: 'raidLevel5Desc' },
  6: { name: 'RAID 6', faultToleranceKey: 'raidLevel6Tolerance', readSpeedKey: 'raidLevel6Read', writeSpeedKey: 'raidLevel6Write', descKey: 'raidLevel6Desc' },
  10: { name: 'RAID 10', faultToleranceKey: 'raidLevel10Tolerance', readSpeedKey: 'raidLevel10Read', writeSpeedKey: 'raidLevel10Write', descKey: 'raidLevel10Desc' },
}
export function levelInfo(level: number): RaidLevelInfo | null {
  return RAID_LEVEL_INFO[level] ?? null
}
```

**实现步补充**:上面 `RAID_LEVEL_INFO` 的 value 是 i18n **key**;各 key 的中/英文案在 T9(详情视图)引入时逐字从 `RaidDetailPanel.vue` L267-290 与 `raidUtils.js` 转录到 `zh_cn.ts`/`en_us.ts`。本 Task 只需保证 `levelInfo(0/1/5/6/10)` 返回非空、`levelInfo(99)` 返回 `null`(加一条测试)。

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm exec vitest run src/storage/util/raidView.test.ts`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add src/storage/util/raidView.ts src/storage/util/raidView.test.ts
git commit -m "feat(storage): raidView 纯函数 + RAID 视图收窄类型(TDD)"
```

---

### Task 3: store 加 RAID 只读拉取(list + 逐阵列 status + 详情 usage)

**Files:**
- Modify: `src/storage/stores/storage.ts`
- Test: `src/storage/stores/storage.test.ts`(增补 RAID 用例)

**Interfaces:**
- Consumes: `asRaidArray`, `resolveRaidState`, `RaidArray`, `RaidUsage`(T2);`service.raid.list/getStatus/getUsage`。
- Produces(store 新增,追加进 return):
  - state:`raidArrays: Ref<RaidArray[]>`、`raidStatusMap: Ref<Record<string, RaidStatus>>`(key = `String(array.id)`)、`raidLoading: Ref<boolean>`、`raidDetail: Ref<{ array: RaidArray; status: RaidStatus | null; usage: RaidUsage | null } | null>`、`raidDetailLoading: Ref<boolean>`。
  - action:`loadRaid(): Promise<void>`(list → 填 raidArrays,并发 getStatus 填 raidStatusMap)、`loadRaidDetail(id): Promise<void>`(从 raidArrays 找 array,getStatus + getUsage)。

- [ ] **Step 1: 写失败测试**(追加到 `src/storage/stores/storage.test.ts`)

```ts
// 复用文件顶部既有的 @nimotech/nimoos-service mock;确保其 service.raid 暴露 getStatus/getUsage:
//   raid: { list: (...a)=>raidList(...a), getStatus:(...a)=>raidGetStatus(...a), getUsage:(...a)=>raidGetUsage(...a) }
// 顶部新增 hoisted:const raidGetStatus = vi.fn(); const raidGetUsage = vi.fn()

describe('loadRaid', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })

  it('list + 逐阵列 getStatus 填 raidArrays/raidStatusMap', async () => {
    raidList.mockResolvedValue([{ id: 1, name: 'md0', level: 1, state: 'active' }])
    raidGetStatus.mockResolvedValue({ live_state: 'active', state: 'active', rebuild_pct: 0, total_bytes: 100, used_bytes: 40, free_bytes: 60, members: [] })
    const store = useStorageStore()
    await store.loadRaid()
    expect(store.raidArrays.length).toBe(1)
    expect(store.raidArrays[0].name).toBe('md0')
    expect(store.raidStatusMap['1'].used_bytes).toBe(40)
  })

  it('raid.list 失败 → raidArrays 复位空,不抛', async () => {
    raidList.mockRejectedValue(new Error('boom'))
    const store = useStorageStore()
    await store.loadRaid()
    expect(store.raidArrays).toEqual([])
  })

  it('单个 getStatus 失败不拖垮整表', async () => {
    raidList.mockResolvedValue([{ id: 1, name: 'a', level: 1, state: 'active' }, { id: 2, name: 'b', level: 1, state: 'active' }])
    raidGetStatus.mockImplementation((id: number) => id === 1 ? Promise.reject(new Error('x')) : Promise.resolve({ live_state: 'active', members: [], total_bytes: 0, used_bytes: 0, free_bytes: 0, rebuild_pct: 0 }))
    const store = useStorageStore()
    await store.loadRaid()
    expect(store.raidArrays.length).toBe(2)
    expect(store.raidStatusMap['2']).toBeTruthy()
    expect(store.raidStatusMap['1']).toBeUndefined()
  })

  it('在途守卫:loadRaid 并发时第二次早退', async () => {
    let resolve1: (v: unknown) => void = () => {}
    raidList.mockReturnValue(new Promise((r) => { resolve1 = r }))
    const store = useStorageStore()
    const p1 = store.loadRaid()
    const p2 = store.loadRaid() // 应早退
    resolve1([])
    await Promise.all([p1, p2])
    expect(raidList).toHaveBeenCalledTimes(1)
  })
})

describe('loadRaidDetail', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })
  it('getStatus + getUsage 填 raidDetail', async () => {
    raidList.mockResolvedValue([{ id: 7, name: 'md7', level: 5, state: 'active' }])
    raidGetStatus.mockResolvedValue({ live_state: 'active', members: [], total_bytes: 9, used_bytes: 3, free_bytes: 6, rebuild_pct: 0 })
    raidGetUsage.mockResolvedValue({ filesystem: 'btrfs', btrfs_usage: { free_estimated_bytes: 5, cached_at: 123 } })
    const store = useStorageStore()
    await store.loadRaid()
    await store.loadRaidDetail(7)
    expect(store.raidDetail?.array.name).toBe('md7')
    expect(store.raidDetail?.status?.used_bytes).toBe(3)
    expect((store.raidDetail?.usage as { filesystem?: string })?.filesystem).toBe('btrfs')
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm exec vitest run src/storage/stores/storage.test.ts`
Expected: FAIL(`loadRaid`/`loadRaidDetail` 未定义)。

- [ ] **Step 3: 写实现**(改 `src/storage/stores/storage.ts`)

在 import 增 `import { asRaidArray, type RaidArray, type RaidUsage } from '../util/raidView'` 和 `import type { RaidStatus } from '@nimotech/nimoos-service'`。新增 state + action:

```ts
  const raidArrays = ref<RaidArray[]>([])
  const raidStatusMap = ref<Record<string, RaidStatus>>({})
  const raidLoading = ref(false)
  const raidDetail = ref<{ array: RaidArray; status: RaidStatus | null; usage: RaidUsage | null } | null>(null)
  const raidDetailLoading = ref(false)

  async function loadRaid() {
    if (raidLoading.value) return // 在途守卫:防轮询/热插拔重叠拉取
    raidLoading.value = true
    try {
      const listRes = await service.raid.list()
      const arrays = (Array.isArray(listRes) ? listRes : []).map(asRaidArray)
      raidArrays.value = arrays
      // 并发逐阵列拉 status;单个失败不拖垮整表(allSettled)
      const results = await Promise.allSettled(arrays.map((a) => service.raid.getStatus(a.id)))
      const map: Record<string, RaidStatus> = {}
      results.forEach((r, i) => { if (r.status === 'fulfilled') map[String(arrays[i].id)] = r.value })
      raidStatusMap.value = map
    } catch (e) {
      console.warn('[storage] raid load failed', (e as Error)?.message)
      raidArrays.value = []
      raidStatusMap.value = {}
    } finally {
      raidLoading.value = false
    }
  }

  async function loadRaidDetail(id: number | string) {
    if (raidDetailLoading.value) return
    raidDetailLoading.value = true
    try {
      const array = raidArrays.value.find((a) => String(a.id) === String(id))
        || asRaidArray({ id } as Record<string, unknown>)
      const [status, usage] = await Promise.all([
        service.raid.getStatus(id).catch(() => null),
        service.raid.getUsage(id).catch(() => null),
      ])
      raidDetail.value = { array, status: status as RaidStatus | null, usage: usage as RaidUsage | null }
    } catch (e) {
      console.warn('[storage] raid detail failed', (e as Error)?.message)
      raidDetail.value = null
    } finally {
      raidDetailLoading.value = false
    }
  }
```

把 `raidArrays, raidStatusMap, raidLoading, raidDetail, raidDetailLoading, loadRaid, loadRaidDetail` 追加进 `return {...}`。

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm exec vitest run src/storage/stores/storage.test.ts`
Expected: PASS(含既有卷/盘用例不回归)。

- [ ] **Step 5: 提交**

```bash
git add src/storage/stores/storage.ts src/storage/stores/storage.test.ts
git commit -m "feat(storage): store 加 RAID 只读拉取 loadRaid/loadRaidDetail(在途守卫)"
```

---

### Task 4: `RaidCard.vue` 列表卡片

**Files:**
- Create: `src/storage/components/RaidCard.vue`
- Test: `src/storage/components/RaidCard.test.ts`
- Modify: `src/i18n/zh_cn.ts` + `src/i18n/en_us.ts`(状态/成员/容量文案 key)

**Interfaces:**
- Consumes: `resolveRaidState/raidSeverity/raidStateLabelKey/countActiveDisks/memberSquare/raidUsagePercent`、`RaidArray`(T2);`RaidStatus`;`fmtSize`。
- Produces: `<RaidCard :array="RaidArray" :status="RaidStatus | undefined" @select />`(点击卡片 emit `select`,详情跳转由父视图 `router.push` 处理)。

**新增 i18n key(zh_cn + en_us 双写)**:`raidStateHealthy`(健康/Healthy)、`raidStateDegraded`(阵列降级/Array Degraded)、`raidStateRebuilding`(重建中/Rebuilding)、`raidStateFailed`(已失效/Failed)、`raidStateRetrying`(重试中/Retrying)、`raidDisksOnline`(在线磁盘 {n}/{total} 形式,用 `{n}`/`{total}` 具名参数)、`raidRebuildFinish`(预计完成)、`raidRebuildSpeed`(速度)、`raidMemberActive`(活动)、`raidMemberFaulty`(故障)、`raidMemberRebuilding`(重建中)、`raidNoArrays`(暂无 RAID 阵列)、`raidCapacity`(容量)。

- [ ] **Step 1: 写失败测试** `src/storage/components/RaidCard.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import RaidCard from './RaidCard.vue'
import zh from '../../i18n/zh_cn'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const mountCard = (array: Record<string, unknown>, status?: Record<string, unknown>) =>
  mount(RaidCard, { props: { array, status }, global: { plugins: [i18n] } })

describe('RaidCard', () => {
  it('渲染名称与 RAID {level} 徽章', () => {
    const w = mountCard({ id: 1, name: 'md0', level: 1, state: 'active' })
    expect(w.text()).toContain('md0')
    expect(w.text()).toContain('RAID 1')
  })
  it('健康态:severity=ok 徽章类', () => {
    const w = mountCard({ id: 1, name: 'a', level: 1, state: 'active' }, { live_state: 'active', state: 'active', rebuild_pct: 0, members: [], total_bytes: 0, used_bytes: 0, free_bytes: 0 })
    expect(w.find('.rc-badge.ok').exists()).toBe(true)
  })
  it('降级态:severity=danger', () => {
    const w = mountCard({ id: 1, name: 'a', level: 1, state: 'degraded' }, { live_state: 'degraded', state: 'degraded', rebuild_pct: 0, members: [], total_bytes: 0, used_bytes: 0, free_bytes: 0 })
    expect(w.find('.rc-badge.danger').exists()).toBe(true)
  })
  it('重建态:显示进度百分比', () => {
    const w = mountCard({ id: 1, name: 'a', level: 1, state: 'rebuilding' }, { live_state: 'recovering', rebuild_pct: 42.37, rebuild_finish: '2min', rebuild_speed: '100M/s', members: [], total_bytes: 0, used_bytes: 0, free_bytes: 0 })
    expect(w.find('.rc-badge.info').exists()).toBe(true)
    expect(w.text()).toContain('42.4') // rebuild_pct 保留 0.1
  })
  it('容量 used/total 用 fmtSize', () => {
    const w = mountCard({ id: 1, name: 'a', level: 1, state: 'active' }, { live_state: 'active', total_bytes: 2147483648, used_bytes: 1073741824, free_bytes: 1073741824, members: [], rebuild_pct: 0 })
    expect(w.text()).toMatch(/1(\.0)?\s?GB/i) // fmtSize(1073741824)
  })
  it('点击卡片 emit select', async () => {
    const w = mountCard({ id: 5, name: 'a', level: 1, state: 'active' })
    await w.find('.raid-card').trigger('click')
    expect(w.emitted('select')).toBeTruthy()
  })
  it('成员方块:active/faulty/rebuild 各类', () => {
    const w = mountCard({ id: 1, name: 'a', level: 1, state: 'degraded' }, {
      live_state: 'degraded', rebuild_pct: 0, total_bytes: 0, used_bytes: 0, free_bytes: 0,
      members: [
        { path: '/dev/sda', state: 'active sync', number: 0 },
        { path: '/dev/sdb', state: 'faulty', number: 1 },
      ],
    })
    expect(w.findAll('.rc-sq.ok').length).toBe(1)
    expect(w.findAll('.rc-sq.fail').length).toBe(1)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm exec vitest run src/storage/components/RaidCard.test.ts`
Expected: FAIL(组件不存在)。

- [ ] **Step 3: 写实现** `src/storage/components/RaidCard.vue`

结构镜像 VolumeCard(`.volume-card` 卡片壳 → `.raid-card`)。徽章药丸沿用 `.vc-os` 形状,颜色按 severity token。成员方块用 `memberSquare().token` 上色。容量条复用 `.vc-track/.vc-fill`(usage 用 `usageLevel` 阈值色,与卷一致)。**不渲染任何写操作按钮**(降级/重试只显示只读文字)。

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { RaidStatus, RaidMemberDisk } from '@nimotech/nimoos-service'
import { fmtSize } from '../../home/util/format'
import { usageLevel } from '../util/storageMap'
import {
  resolveRaidState, raidSeverity, raidStateLabelKey, countActiveDisks,
  memberSquare, raidUsagePercent, type RaidArray,
} from '../util/raidView'

const props = defineProps<{ array: RaidArray; status?: RaidStatus }>()
defineEmits<{ (e: 'select'): void }>()
const { t } = useI18n()

const flags = computed(() => resolveRaidState(props.array, props.status))
const severity = computed(() => raidSeverity(flags.value))
const labelKey = computed(() => raidStateLabelKey(flags.value))
const members = computed<RaidMemberDisk[]>(() => props.status?.members || [])
const total = computed(() => Number(props.status?.total_bytes) || 0)
const used = computed(() => Number(props.status?.used_bytes) || 0)
const pct = computed(() => raidUsagePercent(used.value, total.value))
const totalDisks = computed(() => members.value.length || (props.array.member_disks?.length ?? 0))
const activeDisks = computed(() => countActiveDisks(members.value, totalDisks.value))
const rebuildPct = computed(() => Math.round((Number(props.status?.rebuild_pct) || 0) * 10) / 10)
const squares = computed(() => members.value.map((m) => ({ ...memberSquare(m.state), path: m.path })))
</script>

<template>
  <article class="raid-card" @click="$emit('select')">
    <div class="rc-head">
      <h3 class="rc-name">{{ array.name }} <span class="rc-level">RAID {{ array.level }}</span></h3>
      <span class="rc-badge" :class="severity">{{ t(labelKey) }}</span>
    </div>
    <div class="rc-squares">
      <span v-for="(s, i) in squares" :key="i" class="rc-sq" :class="s.kind"
        :style="{ color: `var(${s.token})` }" :title="s.path">{{ s.glyph }}</span>
    </div>
    <p class="rc-usage">{{ fmtSize(used) }} / {{ fmtSize(total) }}
      <span class="rc-online">· {{ t('raidDisksOnline', { n: activeDisks, total: totalDisks }) }}</span></p>
    <div class="rc-track"><div class="rc-fill" :class="usageLevel(pct)" :style="{ width: Math.min(100, Math.max(0, pct)) + '%' }" /></div>
    <p v-if="flags.isRebuilding" class="rc-rebuild">
      {{ t('raidStateRebuilding') }} {{ rebuildPct }}%
      <span v-if="status?.rebuild_finish"> · {{ t('raidRebuildFinish') }} {{ status.rebuild_finish }}</span>
      <span v-if="status?.rebuild_speed"> · {{ t('raidRebuildSpeed') }} {{ status.rebuild_speed }}</span>
    </p>
  </article>
</template>

<style scoped>
.raid-card { padding: 16px 18px; background: var(--card-bg); border: 1px solid var(--card-border); border-radius: var(--radius-sm); cursor: pointer; }
.raid-card + .raid-card { margin-top: 12px; }
.raid-card:hover { background: var(--hover); }
.rc-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.rc-name { margin: 0; font-size: 15px; font-weight: 600; display: flex; align-items: center; gap: 8px; }
.rc-level { font-size: 11px; font-weight: 700; padding: 1px 7px; border-radius: 999px; background: var(--nrm-bg); color: var(--nrm-fg); border: 1px solid var(--nrm-bd); }
.rc-badge { font-size: 11px; font-weight: 700; padding: 2px 9px; border-radius: 999px; background: var(--nrm-bg); border: 1px solid var(--nrm-bd); }
.rc-badge.ok { color: var(--sem-fg); }
.rc-badge.info { color: var(--accent); }
.rc-badge.warning { color: var(--dem-fg); }
.rc-badge.danger { color: var(--remove-fg); }
.rc-squares { display: flex; flex-wrap: wrap; gap: 4px; margin: 10px 0 6px; font-size: 12px; }
.rc-sq { width: 18px; height: 18px; display: inline-flex; align-items: center; justify-content: center; border-radius: 5px; background: var(--nrm-bg); border: 1px solid var(--nrm-bd); }
.rc-usage { margin: 6px 0; font-size: 12.5px; color: var(--fg-muted); font-family: var(--num-font); }
.rc-online { color: var(--fg-muted); }
.rc-track { height: 6px; border-radius: 999px; background: var(--nrm-bg); overflow: hidden; }
.rc-fill { height: 100%; border-radius: 999px; }
.rc-fill.ok { background: var(--accent); }
.rc-fill.warn { background: var(--dem-fg); }
.rc-fill.danger { background: var(--remove-fg); }
.rc-rebuild { margin: 8px 0 0; font-size: 12px; color: var(--accent); }
</style>
```

- [ ] **Step 4: 加 i18n key(双写)**

在 `zh_cn.ts` 与 `en_us.ts` 各加上面列出的 key。示例(zh_cn):`raidStateHealthy: '健康'`、`raidDisksOnline: '在线磁盘 {n}/{total}'`……(en_us:`raidStateHealthy: 'Healthy'`、`raidDisksOnline: 'Disks online {n}/{total}'`……)。

- [ ] **Step 5: 跑测试确认通过**

Run: `pnpm exec vitest run src/storage/components/RaidCard.test.ts src/i18n/parity.test.ts`
Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add src/storage/components/RaidCard.vue src/storage/components/RaidCard.test.ts src/i18n/zh_cn.ts src/i18n/en_us.ts
git commit -m "feat(storage): RaidCard 列表卡片(只读状态/成员/容量,零字面量色)"
```

---

### Task 5: `useGuardedPoll` 单飞递归轮询 composable

状态重拉(重建中 5000ms)与创建任务进度(1500ms)共用。**单飞守卫 = 递归 setTimeout**:上一拍 `fn()` resolve 之后才排下一拍,天然杜绝请求重叠(SP5-P6 教训 + 本期用户明确要求)。

**Files:**
- Create: `src/composables/useGuardedPoll.ts`
- Test: `src/composables/useGuardedPoll.test.ts`

**Interfaces:**
- Produces: `useGuardedPoll(fn: () => Promise<void> | void, opts: { intervalMs: number; active: () => boolean }): void`
  - 组件挂载后启动一个循环:`if active() { await fn(); setTimeout(loop, intervalMs) } else { setTimeout(loop, intervalMs) }`——始终按 interval 复查 `active()`,但**只在上一拍 await 完成后**才排下一拍(单飞)。`onUnmounted` 停止(置 `stopped=true` + `clearTimeout`),且 unmount 后即使有在途 fn 也不再排下一拍。
  - `active()` 为 getter,每拍求值(重建结束后自动停拉体力活)。

- [ ] **Step 1: 写失败测试** `src/composables/useGuardedPoll.test.ts`

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import { useGuardedPoll } from './useGuardedPoll'

const host = (fn: () => Promise<void>, opts: { intervalMs: number; active: () => boolean }) =>
  defineComponent({ setup() { useGuardedPoll(fn, opts); return () => null } })

describe('useGuardedPoll', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => { vi.useRealTimers(); vi.clearAllMocks() })

  it('active 时按 interval 反复调用 fn', async () => {
    const fn = vi.fn().mockResolvedValue(undefined)
    mount(host(fn, { intervalMs: 1000, active: () => true }))
    await vi.advanceTimersByTimeAsync(1000)
    await vi.advanceTimersByTimeAsync(1000)
    expect(fn.mock.calls.length).toBeGreaterThanOrEqual(2)
  })

  it('单飞:fn 慢于 interval 时不重叠(下一拍等上一拍 resolve)', async () => {
    let inflight = 0
    let maxInflight = 0
    const fn = vi.fn(async () => {
      inflight++; maxInflight = Math.max(maxInflight, inflight)
      await new Promise((r) => setTimeout(r, 3000)) // 比 interval 慢
      inflight--
    })
    mount(host(fn, { intervalMs: 1000, active: () => true }))
    await vi.advanceTimersByTimeAsync(10000)
    expect(maxInflight).toBe(1) // 从不重叠
  })

  it('active()=false 时不调 fn 但循环存活(可后续转 true)', async () => {
    let on = false
    const fn = vi.fn().mockResolvedValue(undefined)
    mount(host(fn, { intervalMs: 1000, active: () => on }))
    await vi.advanceTimersByTimeAsync(3000)
    expect(fn).not.toHaveBeenCalled()
    on = true
    await vi.advanceTimersByTimeAsync(1000)
    expect(fn).toHaveBeenCalled()
  })

  it('unmount 后停止排程', async () => {
    const fn = vi.fn().mockResolvedValue(undefined)
    const w = mount(host(fn, { intervalMs: 1000, active: () => true }))
    await vi.advanceTimersByTimeAsync(1000)
    const n = fn.mock.calls.length
    w.unmount()
    await vi.advanceTimersByTimeAsync(5000)
    expect(fn.mock.calls.length).toBe(n) // 卸载后不再增
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm exec vitest run src/composables/useGuardedPoll.test.ts`
Expected: FAIL。

- [ ] **Step 3: 写实现** `src/composables/useGuardedPoll.ts`

```ts
import { onMounted, onUnmounted } from 'vue'

// 单飞递归 setTimeout 轮询:上一拍 await 完成后才排下一拍,永不重叠。
export function useGuardedPoll(
  fn: () => Promise<void> | void,
  opts: { intervalMs: number; active: () => boolean },
): void {
  let stopped = false
  let timer: number | undefined
  async function tick() {
    if (stopped) return
    try {
      if (opts.active()) await fn()
    } catch {
      // 单拍失败吞掉,下一拍继续(调用方 fn 内部已 catch 并记 message)
    }
    if (stopped) return
    timer = window.setTimeout(tick, opts.intervalMs)
  }
  onMounted(() => { timer = window.setTimeout(tick, opts.intervalMs) })
  onUnmounted(() => { stopped = true; clearTimeout(timer) })
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm exec vitest run src/composables/useGuardedPoll.test.ts`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add src/composables/useGuardedPoll.ts src/composables/useGuardedPoll.test.ts
git commit -m "feat(storage): useGuardedPoll 单飞递归轮询(状态重拉/任务进度共用)"
```

---

### Task 6: `StorageRaid.vue` 列表视图 + 路由 + Shell 标签页 + 状态重拉

**Files:**
- Create: `src/views/StorageRaid.vue`
- Test: `src/views/StorageRaid.test.ts`
- Modify: `src/router/index.ts`(加 `/storage/raid` + `/storage/raid/:id`)
- Modify: `src/storage/components/StorageShell.vue`(加 RAID 标签页)
- Modify: `src/i18n/zh_cn.ts` + `src/i18n/en_us.ts`(`storageTabRaid`)

**Interfaces:**
- Consumes: `useStorageStore().raidArrays/raidStatusMap/raidLoading/loadRaid`(T3)、`useDiskHotplug`(T1)、`useGuardedPoll`(T5)、`resolveRaidState/isRebuildingList`(T2)、`RaidCard`(T4)。
- Produces: 路由 `storage-raid`(`/storage/raid`)、`storage-raid-detail`(`/storage/raid/:id`);Shell 第三个 tab。

- [ ] **Step 1: 加路由**(`src/router/index.ts`)

顶部加 `import StorageRaid from '../views/StorageRaid.vue'` 和 `import StorageRaidDetail from '../views/StorageRaidDetail.vue'`(后者 T9 创建;本 Task 先建 StorageRaidDetail 占位空组件避免编译错,或把 detail 路由留到 T9 加。**决定:本 Task 只加 `/storage/raid` 列表路由;`/storage/raid/:id` 详情路由在 T9 与详情视图一起加**,避免引用未创建组件)。在 L33 后加:

```ts
{ path: '/storage/raid', name: 'storage-raid', component: StorageRaid },
```

- [ ] **Step 2: 加 Shell 标签页**(`src/storage/components/StorageShell.vue`)

在 Drives 那条 RouterLink 后加(注意详情页也要高亮 → 用 `startsWith`):

```html
<RouterLink to="/storage/raid" class="st-tab" :class="{ active: route.path.startsWith('/storage/raid') }">{{ t('storageTabRaid') }}</RouterLink>
```

`zh_cn`/`en_us` 加 `storageTabRaid`(`RAID` / `RAID`——两语言同字面,但仍须双写以过 parity)。

- [ ] **Step 3: 写失败测试** `src/views/StorageRaid.test.ts`

仿 StorageDrives.test.ts 的 mock 结构(service.raid.list/getStatus + useMessageBus + pinia + memory router + fake timers)。

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createI18n } from 'vue-i18n'
import { defineComponent } from 'vue'
import StorageRaid from './StorageRaid.vue'
import zh from '../i18n/zh_cn'

const raidList = vi.fn().mockResolvedValue([])
const raidGetStatus = vi.fn().mockResolvedValue({ live_state: 'active', members: [], total_bytes: 0, used_bytes: 0, free_bytes: 0, rebuild_pct: 0 })
const listTasks = vi.fn().mockResolvedValue([])
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    storage: { list: vi.fn().mockResolvedValue([]) },
    disks: { getDiskList: vi.fn().mockResolvedValue({ disks: [] }) },
    raid: { list: (...a: unknown[]) => raidList(...a), getStatus: (...a: unknown[]) => raidGetStatus(...a), listTasks: (...a: unknown[]) => listTasks(...a) },
  },
}))
const handlers: Record<string, (...a: unknown[]) => void> = {}
vi.mock('../composables/useMessageBus', () => ({ useMessageBus: () => ({ on: (ev: string, cb: (...a: unknown[]) => void) => { handlers[ev] = cb; return vi.fn() } }) }))

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const Stub = defineComponent({ render: () => null })
const router = createRouter({ history: createMemoryHistory(), routes: [
  { path: '/storage/raid', name: 'storage-raid', component: StorageRaid },
  { path: '/storage/raid/:id', name: 'storage-raid-detail', component: Stub },
  { path: '/', name: 'home', component: Stub },
] })

describe('StorageRaid', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks(); vi.useFakeTimers() })
  afterEach(() => vi.useRealTimers())

  it('mount 调 loadRaid,空态显示 raidNoArrays', async () => {
    await router.push('/storage/raid'); await router.isReady()
    const w = mount(StorageRaid, { global: { plugins: [router, i18n] } })
    await vi.runOnlyPendingTimersAsync()
    expect(raidList).toHaveBeenCalled()
    expect(w.text()).toContain(zh.raidNoArrays)
  })

  it('有阵列时渲染 RaidCard', async () => {
    raidList.mockResolvedValue([{ id: 1, name: 'md0', level: 1, state: 'active' }])
    await router.push('/storage/raid'); await router.isReady()
    const w = mount(StorageRaid, { global: { plugins: [router, i18n] } })
    await vi.runOnlyPendingTimersAsync(); await w.vm.$nextTick()
    expect(w.find('.raid-card').exists()).toBe(true)
    expect(w.text()).toContain('md0')
  })

  it('点击 RaidCard select → 跳详情路由', async () => {
    raidList.mockResolvedValue([{ id: 9, name: 'md9', level: 1, state: 'active' }])
    await router.push('/storage/raid'); await router.isReady()
    const w = mount(StorageRaid, { global: { plugins: [router, i18n] } })
    await vi.runOnlyPendingTimersAsync(); await w.vm.$nextTick()
    const push = vi.spyOn(router, 'push')
    await w.find('.raid-card').trigger('click')
    expect(push).toHaveBeenCalledWith('/storage/raid/9')
  })

  it('订阅热插拔事件(经 useDiskHotplug)', async () => {
    await router.push('/storage/raid'); await router.isReady()
    mount(StorageRaid, { global: { plugins: [router, i18n] } })
    expect(typeof handlers['local-storage:disk:added']).toBe('function')
    expect(typeof handlers['local-storage:disk:removed']).toBe('function')
  })
})
```

- [ ] **Step 4: 跑测试确认失败**

Run: `pnpm exec vitest run src/views/StorageRaid.test.ts`
Expected: FAIL(StorageRaid 不存在)。

- [ ] **Step 5: 写实现** `src/views/StorageRaid.vue`

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import StorageShell from '../storage/components/StorageShell.vue'
import RaidCard from '../storage/components/RaidCard.vue'
import { useStorageStore } from '../storage/stores/storage'
import { useDiskHotplug } from '../composables/useDiskHotplug'
import { useGuardedPoll } from '../composables/useGuardedPoll'
import { resolveRaidState, isRebuildingList } from '../storage/util/raidView'

const store = useStorageStore()
const router = useRouter()
const { t } = useI18n()

// 热插拔:第三个消费者,复用 T1 composable
useDiskHotplug(() => store.loadRaid())

// 重建中时 5000ms 单飞重拉状态(活体进度);无重建则不发请求
const anyRebuilding = () =>
  isRebuildingList(store.raidArrays.map((a) => resolveRaidState(a, store.raidStatusMap[String(a.id)])))
useGuardedPoll(() => store.loadRaid(), { intervalMs: 5000, active: anyRebuilding })

const arrays = computed(() => store.raidArrays)
function openDetail(id: number | string) { router.push(`/storage/raid/${id}`) }
</script>

<template>
  <StorageShell>
    <div v-if="store.raidLoading && !arrays.length" class="st-hint">{{ t('loading') }}</div>
    <div v-else-if="!arrays.length" class="st-hint">{{ t('raidNoArrays') }}</div>
    <template v-else>
      <RaidCard v-for="a in arrays" :key="a.id" :array="a" :status="store.raidStatusMap[String(a.id)]" @select="openDetail(a.id)" />
    </template>
  </StorageShell>
</template>

<style scoped>
.st-hint { padding: 24px 4px; color: var(--fg-muted); font-size: 14px; }
</style>
```

(`loading` key 已存在于 i18n;若无则复用 StorageDrives 用的同一 key——实现步确认并保持一致。)

- [ ] **Step 6: 跑测试 + tsc + parity 确认通过**

Run: `pnpm exec vitest run src/views/StorageRaid.test.ts src/i18n/parity.test.ts && pnpm exec vue-tsc --noEmit`
Expected: PASS + 零类型错误。

- [ ] **Step 7: 提交**

```bash
git add src/views/StorageRaid.vue src/views/StorageRaid.test.ts src/router/index.ts src/storage/components/StorageShell.vue src/i18n/zh_cn.ts src/i18n/en_us.ts
git commit -m "feat(storage): StorageRaid 列表视图 + 路由 + Shell RAID 页签 + 5000ms 单飞状态重拉"
```

---

### Task 7: 创建任务检测与轮询(store action + 接线列表视图)

设备上可能已有一个"创建中"任务(从 Vue2 或别处发起);列表页 mount 时 `listTasks()` 探测,若命中 `status==='creating'` 就显示进度并 1500ms 单飞轮询 `getTask`,直到 `done`/`failed`/404。**本期不提供从 UI 发起创建的入口**(创建向导是 P4);P4 会把向导的 `@task-started` 接到本 Task 建好的 `startCreateTask` 上。

**Files:**
- Modify: `src/storage/stores/storage.ts`(创建任务状态 + 探测/轮询 action)
- Test: `src/storage/stores/storage.test.ts`(增补)
- Modify: `src/views/StorageRaid.vue`(接线探测 + 1500ms 轮询)
- Modify: `src/views/StorageRaid.test.ts`(增补)

**Interfaces:**
- Consumes: `mapTask`, `RaidTask`(T2);`service.raid.listTasks/getTask`;`useGuardedPoll`(T5)。
- Produces(store):
  - state:`creatingTask: Ref<RaidTask | null>`。
  - action:`detectCreatingTask(): Promise<void>`(listTasks → 找 `status==='creating'` → `mapTask` → 填 `creatingTask`,否则不动)、`pollCreateTaskOnce(): Promise<void>`(有 `creatingTask` 时 `getTask(taskId)`,合并 step/step_name/progress/elapsed_seconds/error/status;`done`→停+`loadRaid()`+1000ms 后清、`failed`→停留卡、404→清+`loadRaid()`)、`startCreateTask(task: RaidTask)`(供 P4 用:直接置 `creatingTask`)、`dismissCreateTask()`(清 `creatingTask`)。
  - 轮询"是否 active" = `() => !!creatingTask.value && creatingTask.value.status === 'creating'`。

- [ ] **Step 1: 写失败测试**(追加 storage.test.ts)

```ts
describe('创建任务检测/轮询', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })

  it('detectCreatingTask 命中 creating 任务', async () => {
    listTasks.mockResolvedValue([{ task_id: 't1', name: 'md0', level: 5, disk_count: 3, status: 'done' }, { task_id: 't2', name: 'md1', level: 1, disk_count: 2, status: 'creating', step: 2, progress: 20 }])
    const store = useStorageStore()
    await store.detectCreatingTask()
    expect(store.creatingTask?.taskId).toBe('t2')
    expect(store.creatingTask?.status).toBe('creating')
  })

  it('无 creating 任务时 creatingTask 保持 null', async () => {
    listTasks.mockResolvedValue([{ task_id: 't1', status: 'done' }])
    const store = useStorageStore()
    await store.detectCreatingTask()
    expect(store.creatingTask).toBeNull()
  })

  it('pollCreateTaskOnce: status=done → 停并 loadRaid,1000ms 后清卡', async () => {
    vi.useFakeTimers()
    listTasks.mockResolvedValue([{ task_id: 't2', status: 'creating', name: 'x', level: 1, disk_count: 2 }])
    getTask.mockResolvedValue({ task_id: 't2', status: 'done', step: 6, progress: 100 })
    raidList.mockResolvedValue([])
    const store = useStorageStore()
    await store.detectCreatingTask()
    await store.pollCreateTaskOnce()
    expect(store.creatingTask?.status).toBe('done')
    expect(raidList).toHaveBeenCalled() // done 触发 loadRaid
    await vi.advanceTimersByTimeAsync(1000)
    expect(store.creatingTask).toBeNull() // 1000ms 后清
    vi.useRealTimers()
  })

  it('pollCreateTaskOnce: status=failed → 卡保留', async () => {
    listTasks.mockResolvedValue([{ task_id: 't2', status: 'creating', name: 'x', level: 1, disk_count: 2 }])
    getTask.mockResolvedValue({ task_id: 't2', status: 'failed', error: 'boom', step: 3 })
    const store = useStorageStore()
    await store.detectCreatingTask()
    await store.pollCreateTaskOnce()
    expect(store.creatingTask?.status).toBe('failed')
    expect(store.creatingTask?.error).toBe('boom')
  })

  it('pollCreateTaskOnce: getTask 404 → 清卡 + loadRaid', async () => {
    listTasks.mockResolvedValue([{ task_id: 't2', status: 'creating', name: 'x', level: 1, disk_count: 2 }])
    const err = Object.assign(new Error('nf'), { code: 404 }) // service unwrap 把 success 写进 .code;真 404 也可能是 axios status
    getTask.mockRejectedValue(err)
    raidList.mockResolvedValue([])
    const store = useStorageStore()
    await store.detectCreatingTask()
    await store.pollCreateTaskOnce()
    expect(store.creatingTask).toBeNull()
  })

  it('dismissCreateTask 清卡', async () => {
    listTasks.mockResolvedValue([{ task_id: 't2', status: 'creating', name: 'x', level: 1, disk_count: 2 }])
    const store = useStorageStore()
    await store.detectCreatingTask()
    store.dismissCreateTask()
    expect(store.creatingTask).toBeNull()
  })
})
// 文件顶部 mock 增:const getTask = vi.fn();并把 raid mock 补上 getTask/listTasks 委托。
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm exec vitest run src/storage/stores/storage.test.ts`
Expected: FAIL。

- [ ] **Step 3: 写实现**(storage.ts)

import 增 `mapTask, type RaidTask`。新增:

```ts
  const creatingTask = ref<RaidTask | null>(null)
  let clearTimer: number | undefined

  async function detectCreatingTask() {
    try {
      const res = await service.raid.listTasks()
      const tasks = Array.isArray(res) ? (res as Record<string, unknown>[]) : []
      const creating = tasks.find((t) => (t as { status?: string }).status === 'creating')
      if (creating) creatingTask.value = mapTask(creating)
    } catch (e) {
      console.warn('[storage] listTasks failed', (e as Error)?.message)
    }
  }

  function startCreateTask(task: RaidTask) { creatingTask.value = task } // P4 向导用
  function dismissCreateTask() { creatingTask.value = null }

  async function pollCreateTaskOnce() {
    const cur = creatingTask.value
    if (!cur) return
    try {
      const raw = (await service.raid.getTask(cur.taskId)) as Record<string, unknown>
      const merged = mapTask({ ...raw, task_id: cur.taskId, name: raw.name ?? cur.name, level: raw.level ?? cur.level, filesystem: raw.filesystem ?? cur.filesystem, disk_count: raw.disk_count ?? cur.diskCount })
      creatingTask.value = merged
      if (merged.status === 'done') {
        await loadRaid()
        clearTimeout(clearTimer)
        clearTimer = window.setTimeout(() => { creatingTask.value = null }, 1000)
      }
      // failed:卡保留(不清),交给用户 dismiss
    } catch (e) {
      // 404 视为任务已消失:清卡 + 刷新
      const code = (e as { code?: number; response?: { status?: number } })?.code ?? (e as { response?: { status?: number } })?.response?.status
      if (code === 404) {
        creatingTask.value = null
        await loadRaid()
      } else {
        console.warn('[storage] getTask failed', (e as Error)?.message)
      }
    }
  }
```

追加 `creatingTask, detectCreatingTask, startCreateTask, dismissCreateTask, pollCreateTaskOnce` 进 return。

- [ ] **Step 4: 接线 StorageRaid.vue**

在 `<script setup>` 加:mount 探测 + 1500ms 单飞轮询。

```ts
import { onMounted } from 'vue'
// ...
onMounted(() => { store.detectCreatingTask() })
useGuardedPoll(() => store.pollCreateTaskOnce(), {
  intervalMs: 1500,
  active: () => !!store.creatingTask && store.creatingTask.status === 'creating',
})
```

(创建中卡片 UI 在 T8 加;本 Task 先把轮询接上,`store.creatingTask` 变化即可断言。)

- [ ] **Step 5: 增补 StorageRaid.test.ts**

```ts
it('mount 探测创建任务;有 creating 时启动 1500ms 轮询', async () => {
  listTasks.mockResolvedValue([{ task_id: 't2', status: 'creating', name: 'md1', level: 1, disk_count: 2, step: 1, progress: 5 }])
  const getTask = vi.fn().mockResolvedValue({ task_id: 't2', status: 'creating', step: 2, progress: 30 })
  // 注:把 getTask 加进本文件顶部 raid mock 委托
  await router.push('/storage/raid'); await router.isReady()
  mount(StorageRaid, { global: { plugins: [router, i18n] } })
  await vi.runOnlyPendingTimersAsync()
  const store = useStorageStore()
  expect(store.creatingTask?.taskId).toBe('t2')
})
```

(顶部 raid mock 补 `getTask: (...a)=>getTaskFn(...a)`,`const getTaskFn = vi.fn().mockResolvedValue({ status: 'creating' })`。)

- [ ] **Step 6: 跑测试确认通过**

Run: `pnpm exec vitest run src/storage/stores/storage.test.ts src/views/StorageRaid.test.ts && pnpm exec vue-tsc --noEmit`
Expected: PASS + 零类型错误。

- [ ] **Step 7: 提交**

```bash
git add src/storage/stores/storage.ts src/storage/stores/storage.test.ts src/views/StorageRaid.vue src/views/StorageRaid.test.ts
git commit -m "feat(storage): 创建任务探测 + 1500ms 单飞进度轮询(done/failed/404 处理)"
```

---

### Task 8: `RaidCreatingCard.vue` + `RaidCreateProgressModal.vue` + 接线列表视图

**Files:**
- Create: `src/storage/components/RaidCreatingCard.vue`(+ `.test.ts`)
- Create: `src/storage/components/RaidCreateProgressModal.vue`(+ `.test.ts`)
- Modify: `src/views/StorageRaid.vue`(渲染创建中卡 + Details 打开弹窗)
- Modify: `src/i18n/zh_cn.ts` + `src/i18n/en_us.ts`

**Interfaces:**
- Consumes: `RaidTask`(T2);`store.creatingTask/dismissCreateTask`(T7);reka `Dialog.vue`(`src/components/ui/Dialog.vue`)。
- Produces:
  - `<RaidCreatingCard :task="RaidTask" @open-modal @dismiss />`
  - `<RaidCreateProgressModal v-model:open :task="RaidTask" />`

**新增 i18n key(双写)**:`raidCreating`(创建中/Creating)、`raidCreateFailed`(创建失败/Creation failed)、`raidTaskMeta`(`RAID-{level} · {n} 块盘 · {fs}` / `RAID-{level} · {n} disks · {fs}`)、`raidDetailsBtn`(详情/Details)、`raidDismiss`(关闭/Dismiss)、`raidStep1`..`raidStep6`(见下)、`raidStepInitFs`(`初始化文件系统 {fs}` / `Initialize filesystem {fs}`)、`raidCreateDone`(完成/Done)、`raidPreparing`(准备中…/Preparing…)、`raidElapsed`(`已用时 {n}s` / `Elapsed {n}s`)、`raidModalHint`(关闭弹窗不会中断创建/Closing modal will not interrupt creation)。

**6 步固定标签(逐字移植 RaidCreateProgressModal.vue L88-97)**:`raidStep1='加载内核模块'/'Load kernel modules'`、`raidStep2='清理磁盘超级块'/'Clean disk superblocks'`、`raidStep3='创建 RAID 阵列'/'Create RAID Array'`、`raidStep4`(第 4 步动态:`task.filesystem` 有值用 `raidStepInitFs({fs})`,否则 `raidStep4='初始化文件系统'/'Initialize filesystem'`)、`raidStep5='挂载阵列'/'Mount array'`、`raidStep6='保存配置'/'Save configuration'`。

- [ ] **Step 1: 写 RaidCreatingCard 失败测试**

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import RaidCreatingCard from './RaidCreatingCard.vue'
import zh from '../../i18n/zh_cn'
const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const task = (o = {}) => ({ taskId: 't', name: 'md0', level: 5, filesystem: 'btrfs', diskCount: 4, step: 3, stepName: '创建 RAID 阵列', progress: 55, elapsedSeconds: 30, error: '', status: 'creating', ...o })

describe('RaidCreatingCard', () => {
  it('creating:显示名称 + Creating 标签 + Details 按钮', () => {
    const w = mount(RaidCreatingCard, { props: { task: task() }, global: { plugins: [i18n] } })
    expect(w.text()).toContain('md0')
    expect(w.text()).toContain(zh.raidCreating)
    expect(w.find('.rcc-details').exists()).toBe(true)
  })
  it('Details 点击 emit open-modal', async () => {
    const w = mount(RaidCreatingCard, { props: { task: task() }, global: { plugins: [i18n] } })
    await w.find('.rcc-details').trigger('click')
    expect(w.emitted('open-modal')).toBeTruthy()
  })
  it('failed:显示失败态 + dismiss 按钮', async () => {
    const w = mount(RaidCreatingCard, { props: { task: task({ status: 'failed' }) }, global: { plugins: [i18n] } })
    expect(w.text()).toContain(zh.raidCreateFailed)
    await w.find('.rcc-dismiss').trigger('click')
    expect(w.emitted('dismiss')).toBeTruthy()
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm exec vitest run src/storage/components/RaidCreatingCard.test.ts`
Expected: FAIL。

- [ ] **Step 3: 写 RaidCreatingCard 实现**

顶内联卡:创建中 = spinner + name + meta(`raidTaskMeta` + `· stepName`)+ `Creating` 标签 + 不定进度条 + `Details`;失败 = `✕` + `Creation failed` + `Failed` 标签 + `✕ dismiss`。颜色全 token(`--accent` 进度、`--remove-fg` 失败、`--dem-fg`/`--nrm-*` 标签)。不定进度条用 CSS animation(纯装饰,不绑值)。结构参考 VolumeCard 卡壳。(完整模板由实现者按上述契约手写,镜像 Vue2 `RaidCreatingCard.vue`;所有文案走 i18n key。)

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm exec vitest run src/storage/components/RaidCreatingCard.test.ts`
Expected: PASS。

- [ ] **Step 5: 写 RaidCreateProgressModal 失败测试**

弹窗用共享 `Dialog.vue`(reka DialogPortal → teleport 到 body,测试查 `document.body`,每次 `beforeEach` 清 body,`await $nextTick`)。

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import RaidCreateProgressModal from './RaidCreateProgressModal.vue'
import zh from '../../i18n/zh_cn'
const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const task = (o = {}) => ({ taskId: 't', name: 'md0', level: 5, filesystem: 'btrfs', diskCount: 4, step: 3, stepName: '', progress: 55, elapsedSeconds: 30, error: '', status: 'creating', ...o })

describe('RaidCreateProgressModal', () => {
  beforeEach(() => { document.body.innerHTML = '' })
  it('open 时渲染 6 步 + 进度值', async () => {
    const w = mount(RaidCreateProgressModal, { props: { open: true, task: task() }, global: { plugins: [i18n] } })
    await w.vm.$nextTick()
    const body = document.body.textContent || ''
    expect(body).toContain(zh.raidStep1)
    expect(body).toContain(zh.raidStep6)
    expect(body).toContain('55') // progress
  })
  it('step<current → done;== current → active(creating)', async () => {
    const w = mount(RaidCreateProgressModal, { props: { open: true, task: task({ step: 3, status: 'creating' }) }, global: { plugins: [i18n] } })
    await w.vm.$nextTick()
    expect(document.body.querySelectorAll('.rpm-step.done').length).toBe(2) // 步 1,2
    expect(document.body.querySelectorAll('.rpm-step.active').length).toBe(1) // 步 3
  })
  it('failed:当前步标记 failed', async () => {
    const w = mount(RaidCreateProgressModal, { props: { open: true, task: task({ step: 3, status: 'failed' }) }, global: { plugins: [i18n] } })
    await w.vm.$nextTick()
    expect(document.body.querySelectorAll('.rpm-step.failed').length).toBe(1)
  })
  it('done:全部步 done', async () => {
    const w = mount(RaidCreateProgressModal, { props: { open: true, task: task({ status: 'done', step: 6 }) }, global: { plugins: [i18n] } })
    await w.vm.$nextTick()
    expect(document.body.querySelectorAll('.rpm-step.done').length).toBe(6)
  })
})
```

- [ ] **Step 6: 跑测试确认失败,写实现**

`RaidCreateProgressModal.vue`:用 `Dialog.vue`(`:open` + `@update:open`)。6 步来自 computed `steps`(1..6,label = `t('raidStep'+n)`,第 4 步若 `task.filesystem` 用 `t('raidStepInitFs',{fs})`)。步状态(逐字移植 Vue2 L112-125):`isDone = status==='done' || n < task.step`;`isActive = status==='creating' && n === task.step`;`isFailed = status==='failed' && n === task.step`。原生 `<progress :value="task.progress" max="100">`。标题按 status 切 spinner/✓/✕。footer:`raidModalHint` + `raidElapsed({n:task.elapsedSeconds})`。颜色全 token。

Run(失败→实现→通过):`pnpm exec vitest run src/storage/components/RaidCreateProgressModal.test.ts`

- [ ] **Step 7: 接线 StorageRaid.vue**

```vue
<!-- template 顶部,列表之上 -->
<RaidCreatingCard v-if="store.creatingTask" :task="store.creatingTask"
  @open-modal="progressOpen = true" @dismiss="store.dismissCreateTask()" />
<RaidCreateProgressModal v-if="store.creatingTask" v-model:open="progressOpen" :task="store.creatingTask" />
```

```ts
import { ref } from 'vue'
import RaidCreatingCard from '../storage/components/RaidCreatingCard.vue'
import RaidCreateProgressModal from '../storage/components/RaidCreateProgressModal.vue'
const progressOpen = ref(false)
```

- [ ] **Step 8: 跑全套 + parity + tsc**

Run: `pnpm exec vitest run src/storage/ src/views/StorageRaid.test.ts src/i18n/parity.test.ts && pnpm exec vue-tsc --noEmit`
Expected: PASS + 零类型错误。

- [ ] **Step 9: 提交**

```bash
git add src/storage/components/RaidCreatingCard.vue src/storage/components/RaidCreatingCard.test.ts src/storage/components/RaidCreateProgressModal.vue src/storage/components/RaidCreateProgressModal.test.ts src/views/StorageRaid.vue src/views/StorageRaid.test.ts src/i18n/zh_cn.ts src/i18n/en_us.ts
git commit -m "feat(storage): RAID 创建中卡 + 6 步进度弹窗 + 接线列表视图"
```

---

### Task 9: `StorageRaidDetail.vue` 详情视图 + `RaidMemberList.vue` + 详情路由

只读详情:头部(名称/RAID {level} 徽章/状态徽章,**无** recover/delete 按钮)、左列用量甜甜圈 + RAID 级别信息卡、右列阵列信息表 + 成员盘列表。**不挂快照面板**(P5 边界)。

**Files:**
- Create: `src/views/StorageRaidDetail.vue`(+ `.test.ts`)
- Create: `src/storage/components/RaidMemberList.vue`(+ `.test.ts`)
- Modify: `src/router/index.ts`(加 `/storage/raid/:id`)
- Modify: `src/i18n/zh_cn.ts` + `src/i18n/en_us.ts`(详情表 + 级别信息文案)

**Interfaces:**
- Consumes: `store.raidDetail/raidDetailLoading/loadRaidDetail`(T3)、`resolveRaidState/raidSeverity/raidStateLabelKey/raidUsagePercent/memberSquare/mirrorPairs/levelInfo/RAID_LEVEL_INFO`(T2)、`fmtSize`。
- Produces: 路由 `storage-raid-detail`;`<RaidMemberList :members :level />`。

**新增 i18n key(双写)**:`raidDetailDevicePath`(设备路径)、`raidDetailMountPoint`(挂载点)、`raidDetailFilesystem`(文件系统)、`raidDetailUuid`(UUID)、`raidDetailChunk`(块大小)、`raidDetailState`(状态)、`raidUsageUsed`(已用)、`raidUsageFree`(空闲)、`raidLevelType`(类型)、`raidLevelTolerance`(容错)、`raidLevelRead`(读速)、`raidLevelWrite`(写速)、`raidMembers`(成员磁盘)、`raidBtrfsFreeEst`(btrfs 估算可用)、`raidBtrfsCachedAt`(缓存于)、以及 T2 占位的级别文案 key(`raidLevel{0,1,5,6,10}{Tolerance,Read,Write,Desc}`)——值逐字从 `RaidDetailPanel.vue` L267-290 与 `raidUtils.js` RAID_LEVELS 转录。

- [ ] **Step 1: 写 RaidMemberList 失败测试**

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import RaidMemberList from './RaidMemberList.vue'
import zh from '../../i18n/zh_cn'
const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

describe('RaidMemberList', () => {
  it('非 RAID10:平铺渲染成员', () => {
    const w = mount(RaidMemberList, { props: { level: 1, members: [
      { path: '/dev/sda', state: 'active sync', number: 0 },
      { path: '/dev/sdb', state: 'faulty', number: 1 },
    ] }, global: { plugins: [i18n] } })
    expect(w.findAll('.rml-row').length).toBe(2)
    expect(w.text()).toContain('/dev/sda')
  })
  it('RAID10:按镜像对分组', () => {
    const w = mount(RaidMemberList, { props: { level: 10, members: [
      { path: '/dev/sdb', state: 'active sync set-B', number: 1 },
      { path: '/dev/sda', state: 'active sync set-A', number: 0 },
      { path: '/dev/sdd', state: 'active sync set-B', number: 3 },
      { path: '/dev/sdc', state: 'active sync set-A', number: 2 },
    ] }, global: { plugins: [i18n] } })
    expect(w.findAll('.rml-pair').length).toBe(2)
  })
  it('重建中成员显示 rebuild_pct', () => {
    const w = mount(RaidMemberList, { props: { level: 1, members: [
      { path: '/dev/sda', state: 'spare rebuilding', number: 0, rebuild_pct: 33 },
    ] }, global: { plugins: [i18n] } })
    expect(w.text()).toContain('33')
  })
})
```

- [ ] **Step 2: 跑失败,写 RaidMemberList 实现**

`level===10` → `mirrorPairs(members)` 渲染 `.rml-pair`(每对含成员行);否则平铺 `.rml-row`。每行:`memberSquare(state)` 上色圆点 + `path` + `t(memberSquare.labelKey)`(unknown 类回退原始 state)+ 可选 `member.rebuild_pct%`。全 token 色。

Run(失败→实现→通过):`pnpm exec vitest run src/storage/components/RaidMemberList.test.ts`

- [ ] **Step 3: 加详情路由**

`src/router/index.ts` 顶部 `import StorageRaidDetail from '../views/StorageRaidDetail.vue'`;`/storage/raid` 后加:

```ts
{ path: '/storage/raid/:id', name: 'storage-raid-detail', component: StorageRaidDetail },
```

- [ ] **Step 4: 写 StorageRaidDetail 失败测试**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createI18n } from 'vue-i18n'
import { defineComponent } from 'vue'
import StorageRaidDetail from './StorageRaidDetail.vue'
import zh from '../i18n/zh_cn'

const raidList = vi.fn().mockResolvedValue([{ id: 7, name: 'md7', level: 5, state: 'active', mount_point: '/DATA', uuid: 'u-7' }])
const raidGetStatus = vi.fn().mockResolvedValue({ live_state: 'active', state: 'active', rebuild_pct: 0, total_bytes: 100, used_bytes: 40, free_bytes: 60, members: [{ path: '/dev/sda', state: 'active sync', number: 0 }] })
const raidGetUsage = vi.fn().mockResolvedValue({ filesystem: 'btrfs', btrfs_usage: { free_estimated_bytes: 55, cached_at: 1700000000 } })
vi.mock('@nimotech/nimoos-service', () => ({ service: {
  storage: { list: vi.fn().mockResolvedValue([]) }, disks: { getDiskList: vi.fn().mockResolvedValue({ disks: [] }) },
  raid: { list: (...a: unknown[]) => raidList(...a), getStatus: (...a: unknown[]) => raidGetStatus(...a), getUsage: (...a: unknown[]) => raidGetUsage(...a) },
} }))
vi.mock('../composables/useMessageBus', () => ({ useMessageBus: () => ({ on: () => vi.fn() }) }))

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const Stub = defineComponent({ render: () => null })
const router = createRouter({ history: createMemoryHistory(), routes: [
  { path: '/storage/raid/:id', name: 'storage-raid-detail', component: StorageRaidDetail },
  { path: '/storage/raid', name: 'storage-raid', component: Stub }, { path: '/', component: Stub },
] })

describe('StorageRaidDetail', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })
  it('加载详情:名称 + RAID 级别 + 用量 + 成员 + btrfs 行', async () => {
    await router.push('/storage/raid/7'); await router.isReady()
    const store = (await import('../storage/stores/storage')).useStorageStore()
    await store.loadRaid() // 先填 raidArrays 让 detail 找得到 array
    const w = mount(StorageRaidDetail, { global: { plugins: [router, i18n] } })
    await new Promise((r) => setTimeout(r)); await w.vm.$nextTick(); await w.vm.$nextTick()
    expect(w.text()).toContain('md7')
    expect(w.text()).toContain('RAID 5')
    expect(w.text()).toContain('/dev/sda')
    expect(raidGetUsage).toHaveBeenCalledWith('7')
  })
  it('不渲染写操作按钮(recover/delete/replace)——P4 边界', async () => {
    await router.push('/storage/raid/7'); await router.isReady()
    const w = mount(StorageRaidDetail, { global: { plugins: [router, i18n] } })
    await new Promise((r) => setTimeout(r)); await w.vm.$nextTick()
    expect(w.find('.rd-recover').exists()).toBe(false)
    expect(w.find('.rd-delete').exists()).toBe(false)
    expect(w.find('.rd-replace').exists()).toBe(false)
  })
})
```

- [ ] **Step 5: 写 StorageRaidDetail 实现**

`<script setup>`:`route.params.id` → `onMounted(() => store.loadRaid().then(() => store.loadRaidDetail(id)))`(先 list 拿 array 名/level,再 detail);computed `detail = store.raidDetail`、`flags`、`severity`、`pct`。5000ms 单飞状态重拉(重建中):`useGuardedPoll(() => store.loadRaidDetail(id), { intervalMs: 5000, active: () => flags.value.isRebuilding })`。

template 包 `<StorageShell>`:
- 头部:返回列表(`router.push('/storage/raid')` 或 StorageShell 自带回主页;此处加一个"‹ 返回 RAID"局部返回按钮)+ 名称 + `RAID {level}` 徽章 + 状态徽章(`.rc-badge` 复用)。**无写按钮。**
- 左列:甜甜圈 `conic-gradient(var(--accent) {pct}%, var(--nrm-bg) {pct}%)` + 图例(已用 `--accent` / 空闲 `--nrm-bg`)+ 级别信息卡(`levelInfo(level)` → 类型/容错/读速/写速,`t(info.faultToleranceKey)` 等;`null` 则整卡不渲染)。
- 右列:阵列信息表(设备路径 `device_path || '/dev/'+name`、挂载点、文件系统(`status.filesystem||usage.filesystem||array.filesystem`,小写)、UUID、块大小 `chunk_kb`、状态(`t(labelKey)` 上色)、重建时:`raidRebuildFinish`/`raidRebuildSpeed` 行;btrfs:`usage.btrfs_usage.free_estimated_bytes`(fmtSize)+ `cached_at`)。
- 成员盘:`<RaidMemberList :level="detail.array.level" :members="detail.status?.members || []" />`。
- **不渲染 `<SnapshotPanel>`**(P5)——留一行注释 `<!-- 快照面板 P5 -->` 标边界。

颜色全 token。**实现步**:把 T2 占位的级别文案 key(`raidLevel*`)的中/英值从 `RaidDetailPanel.vue` L267-290 + `raidUtils.js` RAID_LEVELS 逐字转录进 zh_cn/en_us。

- [ ] **Step 6: 跑全套 + parity + tsc**

Run: `pnpm exec vitest run src/views/StorageRaidDetail.test.ts src/storage/components/RaidMemberList.test.ts src/i18n/parity.test.ts && pnpm exec vue-tsc --noEmit`
Expected: PASS + 零类型错误。

- [ ] **Step 7: 提交**

```bash
git add src/views/StorageRaidDetail.vue src/views/StorageRaidDetail.test.ts src/storage/components/RaidMemberList.vue src/storage/components/RaidMemberList.test.ts src/router/index.ts src/i18n/zh_cn.ts src/i18n/en_us.ts
git commit -m "feat(storage): RAID 详情视图(用量/级别/阵列信息/成员,无写操作+无快照)+ 详情路由"
```

---

## 收尾(全 9 Task 完成后)

- [ ] **全套测试 + tsc**:`pnpm test && pnpm exec vue-tsc --noEmit` 全绿。
- [ ] **构建产物**:`pnpm build`(vue-tsc + vite build → dist/)。
- [ ] **5273 眼验**(常驻 vite preview 伺服 dist,重建即生效):`http://<设备IP>:5273/app/#/storage/raid`
  - RAID 列表:阵列卡片(名称/RAID 级别/状态徽章色/成员方块/容量条/在线盘数);空态文案;点击进详情。
  - 详情页:甜甜圈用量 + 级别信息 + 阵列信息表 + 成员盘(RAID10 看镜像对);**确认无 recover/delete/replace 按钮、无快照面板**。
  - 状态/进度活体:若真机有重建中阵列,看 5000ms 是否活体刷新(无则记"未实盘验证");若有创建中任务,看进度卡 + 1500ms 轮询 + 弹窗 6 步。
  - 热插拔:插拔盘看列表 500ms 后刷新。
  - CSS/容器查询/甜甜圈**必须眼验**(SP2 血泪:jsdom 测不出布局)。
  - 亮/暗主题都扫一遍(状态徽章、成员点、甜甜圈色)。
- [ ] **台账**:在 `.superpowers/sdd/progress.md` 追加 P3 关账行 + Minor 汇总;更新长期记忆 `vue3-migration-plan`(SP6 段 P3 关账坐标)。**roadmap 记账推迟 P6**。

## Self-Review(写完自查)

- **spec 覆盖**(设计 §4 P3):列表卡片 ✅(T4)、状态 ✅(T2/T4)、详情面板不含快照 ✅(T9)、使用率 ✅(T4/T9)、创建任务进度卡 + listTasks/getTask 轮询带在途守卫 ✅(T5/T7/T8);P1 债 useDiskHotplug ✅(T1)。
- **只读边界**:recover/delete/replaceDisk/快照 全部显式排除并在 T9 加"无写按钮"回归测试 ✅。
- **在途守卫**:`loadRaid`(T3 布尔守卫)、状态重拉 & 任务轮询(T5 递归 setTimeout 单飞)三处均有 ✅。
- **类型一致**:`RaidArray`/`RaidTask`/`RaidStatus` 全程一致;`raidStatusMap` key 统一 `String(id)` ✅。
- **无占位符**:纯函数/composable/store 给完整代码;组件给完整契约 + 关键模板/样式 + 测试;级别文案值明确指示逐字转录源坐标(数据非逻辑)✅。
- **service 零改**:仅调既有 `service.raid` 只读方法,不碰 NimoOS-Service / dist rebuild ✅。
