# SP6-P4 RAID(写操作)迁移 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 Vue2 存储管理的 RAID **写操作**(创建向导 RaidDriveBay+级别卡+RaidMatrix 对比矩阵、删除阵列、换盘、恢复/重新识别)迁成 New-UI,补齐 P3 只读版留下的写按钮空位与创建入口,数据全部走已在 P0 进包的 `service.raid` 写方法(`create/remove/replaceDisk/recover`)。

**Architecture:** 沿用 P1/P2/P3 既定分层——视图在 `src/views/`,共享片段(向导/弹窗/矩阵/卡片/store/纯工具)在 `src/storage/`,所有 service 调用只在 Pinia store(`src/storage/stores/storage.ts`)里发生,视图只读 store + 管生命周期。创建走**独立路由** `/storage/raid/create`(向导),完成后 `@task-started` 接到 P3 已预留的 `store.startCreateTask(task)`,复用 P3 的 1500ms 单飞任务轮询。删除按**路线 B**:唯一不可逆的删阵列用 **type-to-confirm(输入阵列名 === 阵列名 才启用删除)**,create/换盘/恢复照 Vue2 不加密码/输入确认。**RAID 级别对比矩阵只迁矩阵主体,Vue2 里嵌的"故障模拟器"本期推迟(记台账,随 P5 或以后补)。**

**Tech Stack:** Vue 3 `<script setup>` + TS · Pinia setup-store · vue-router 4(hash,`createWebHashHistory('/app/')`)· vue-i18n 9 · reka-ui(Dialog 原语)· vitest + @vue/test-utils · socket.io(MessageBus,经 `useMessageBus`)。**无 Tailwind/无 CSS 框架,颜色一律 theme token。**

## Global Constraints

这些约束绑定**每一个** Task,不再逐条重复:

- **本期只做写操作 + 创建向导**:`create` / `remove` / `replaceDisk` / `recover` 四个写操作 + 创建向导(选盘/级别/矩阵/确认)。**btrfs 快照面板仍归 P5**(详情页左栏 `StorageRaidDetail.vue:134` 的 `<!-- 快照面板 P5 -->` 注释保持不动)。**故障模拟器推迟**(见下)。
- **零改 NimoOS-Service**:`service.raid` 写方法已在 P0 进包,签名(`node_modules/@nimotech/nimoos-service/dist/raid.d.ts`)逐字如下,**入参/返回全 `unknown`,action 内自行构造 body、不消费返回值(只 await)**:
  - `create(data: unknown): Promise<unknown>` → 后端 POST `/v2/raid`
  - `remove(id: number | string): Promise<unknown>` → 后端 DELETE `/v2/raid/{id}`(无 body)
  - `replaceDisk(id: number | string, data: unknown): Promise<unknown>` → 后端 POST `/v2/raid/{id}/disk`
  - `recover(id: number | string): Promise<unknown>` → 后端 POST `/v2/raid/{id}/recover`(无 body)
  - **不得**动 `/home/nimo/NimoTech/.sp6/NimoOS-Service`。
- **逐字对齐 Vue2 的请求形状**(迁移前后后端契约必须不变,来源 `NimoOS-UI/src/service/raid.js` + 各写组件):
  - **create** body:`{ name: string, level: number, disk_paths: string[], chunk_kb: 512, filesystem: 'btrfs'|'ext4', enable_snapshots: boolean }`。`chunk_kb` 硬编码 `512`;`enable_snapshots` 选 ext4 时**强制 `false`**(`isBtrfs ? enableSnapshots : false`)。`name` 前端已过滤为 `[a-zA-Z0-9_-]`。
  - **replaceDisk** body:`{ old_disk_path: string, new_disk_path: string }`。
  - **remove / recover**:无 body。
- **故障模拟器推迟(决策 2)**:`RaidMatrix` **只迁矩阵主体**——行 Layout / Min drives / Survives failure of / Usable capacity / Read speed / Write speed / Cost efficiency / Best for / Actions(Select+Details)。Vue2 里嵌的"Drive failure simulator"modal(`NimoOS-UI/.../RaidMatrix.vue:123-200`,点盘模拟失效算存活)**不迁**,`raidUtils.js` 的 `survival()`/`rebuildable()` 也**不迁**。在 ledger 记账推迟。
- **删除确认强度(决策 1 = 路线 B)**:仅删阵列用 **type-to-confirm**——弹窗内文本框输入的字符串必须 `=== 阵列名` 才启用红色删除按钮(防手滑,无密码)。`create`/`replaceDisk`/`recover` 照 Vue2:create 用一句普通 primary 确认,replaceDisk 在弹窗内点 danger 按钮直接执行(无二次确认),recover 点击直接执行(无确认)。
- **service 只读方法 + 类型**(P3 已用,写成功后刷新入口是 `loadRaid()`,**非 `loadAll()`**):`service.raid.list()/getStatus(id)/getUsage(id)/listTasks()/getTask(taskId)`;`RaidStatus`/`RaidMemberDisk` 从 `@nimotech/nimoos-service` import;视图收窄类型 `RaidArray`/`RaidTask`/`RaidUsage` 在 `src/storage/util/raidView.ts`(P3 建)。
- **颜色 = theme token,零字面量**(`src/styles/color-guard.test.ts` 会红;豁免要同行/上一行写 `/* theme-exception: 原因 */`):所有颜色写 `var(--…)`。状态→token 映射(全期统一):healthy/active→`--sem-fg`;rebuilding/info/主动作→`--accent`;retrying/warning→`--dem-fg`;degraded/failed/danger/删除→`--remove-fg`;neutral→`--nrm-fg`/`--fg-muted`。药丸/chip 沿用 `--nrm-bg`+`--nrm-bd`,输入框用 `--chip-bg`/`--chip-border`/`--fg`+focus `--accent`。**本期预计无需新增 token**;若确需(如混规格盘分组色),两块(`:root` 与 `:root[data-theme="light"]`)都加,禁止就地写死。
- **i18n 双写**:任何新文案 key 必须**同时**加到 `src/i18n/zh_cn.ts` 与 `src/i18n/en_us.ts`,否则 `src/i18n/parity.test.ts` 红。zh_cn 为默认/兜底。新 key 一律 `raid` 前缀,**不得**撞 P3 已占用的 `raidState*/raidMember*/raidStep*/raidLevel*/raidDetail*/raidUsage*/raidCreating/raidCreateFailed/raidNoArrays/...` 等键(完整已占清单见「附录 A」)。
- **MessageBus handler 不可阻塞**(buffer=1):沿用 `useDiskHotplug`,handler 内不 await 重活。
- **只记 message 不记整个 error**:catch 里 `console.warn('[storage] raid xxx failed', (e as Error)?.message)`(绝不整对象打日志,与 P1/P2 纪律一致)。
- **每期收尾门**:`pnpm test`(全绿)+ `pnpm exec vue-tsc --noEmit`(零错)→ 5273 常驻预览重建 dist 眼验(见 §收尾)。**禁区**:不跑 `deploy.sh`、不写 `/var/lib/nimoos/www`、不改 NimoOS-UI 仓、不改 roadmap、SP5 合入 master 前不合并本分支(全部推迟 P6)。
- **实盘限制**:设备仅单盘,RAID 需 ≥2 盘 → 写操作无法实盘验收。本期界面+接口层做全+单测锁死请求形状,实盘验一并随有多盘设备时补(与 P3 同口径,记 ledger)。

---

## 文件结构总览(本期创建/修改)

**新建:**
- `src/storage/util/raidLevels.ts`(+ `.test.ts`)—— RAID 级别元数据 `RAID_LEVELS` 常量 + 纯计算(容量/布局/推荐/健康风险/混规格分组色),从 Vue2 `raidUtils.js` 迁移(**不含** `survival()`/`rebuildable()`)。
- `src/storage/components/RaidDriveCard.vue`(+ `.test.ts`)—— 单盘可选卡片(勾选圈 + 容量/类型/健康)。
- `src/storage/components/RaidDriveBay.vue`(+ `.test.ts`)—— 选盘盘位:过滤(All/SSD/HDD)+ 全选健康/清空 + 多选网格 + 汇总条。
- `src/storage/components/RaidMatrix.vue`(+ `.test.ts`)—— 级别对比矩阵主体(**无故障模拟器**)。
- `src/storage/components/RaidDeleteDialog.vue`(+ `.test.ts`)—— type-to-confirm 删除弹窗(输入阵列名才启用)。
- `src/storage/components/RaidReplaceDialog.vue`(+ `.test.ts`)—— 换盘弹窗(故障盘只读 + 单选新盘 + 警告 + danger 直接执行)。
- `src/views/StorageRaidCreate.vue`(+ `.test.ts`)—— 创建向导视图(2 步:选盘+级别+文件系统+快照 / 确认),路由 `/storage/raid/create`。

**修改:**
- `src/storage/stores/storage.ts` —— 加 4 个写守卫 busy ref(`raidCreating`/`raidRemoving`/`raidReplacing`/`raidRecovering`)+ `createRaid`/`removeRaid`/`replaceRaidDisk`/`recoverRaid` action;全部加进 store return。
- `src/views/StorageRaid.vue` —— 列表页顶部加 `.sv-toolbar` + "创建 RAID" 按钮(`@click` → `router.push('/storage/raid/create')`)。
- `src/views/StorageRaidDetail.vue` —— `.rd-head` 加 Delete / Rediscover 按钮(按状态显隐);成员列表卡内(degraded 时)加换盘入口;**更新 P3 的按钮计数不变式测试**(baseline 从 2 变为写按钮加入后的新值)。
- `src/storage/components/RaidMemberList.vue` —— degraded 阵列的 faulty 成员行加"替换"动作(`@replace-disk`)。
- `src/router/index.ts` —— 加 `/storage/raid/create` 路由(**必须插在 `/storage/raid/:id` 之前**,否则 `:id==='create'` 被详情页吞掉)。
- `src/i18n/zh_cn.ts` / `src/i18n/en_us.ts` —— RAID 写文案 key(随引入它的 Task 增补,双写)。

**任务依赖顺序**:T1(纯工具+级别常量)→ T2(store 4 写 action)→ T3(RaidDriveCard+RaidDriveBay)→ T4(RaidMatrix 矩阵主体)→ T5(创建向导视图+路由+列表创建按钮,依赖 T2/T3/T4)→ T6(删除:type-to-confirm 弹窗+详情头按钮+计数不变式更新,依赖 T2)→ T7(换盘:弹窗+成员行入口+degraded 横幅,依赖 T2)→ T8(恢复:详情头按钮+toast,依赖 T2)。T6/T7/T8 仅依赖 T2,可并行分派。

---

### Task 1: 迁移 RAID 级别元数据与纯计算(`raidLevels.ts`)

从 Vue2 `NimoOS-UI/src/utils/raidUtils.js` 迁移级别常量与纯函数到 New-UI。**只迁矩阵/向导需要的部分**:`RAID_LEVELS`(每级 `id/name/min/tolerance/read/write/cost/desc/usecase` + `capacity(n,size)` + `layout(n)`)、`recommendRaidLevel(n)`、`isDiskAtRisk(disk)`、`groupColorKey(disk)`(混规格分组,返回 token 语义 key 而非字面色)。**不迁** `survival()`/`rebuildable()`(故障模拟器,推迟)。

**Files:**
- Create: `src/storage/util/raidLevels.ts`
- Test: `src/storage/util/raidLevels.test.ts`

**Interfaces:**
- Consumes: 无(纯常量/函数)。可 `import type { RaidDisk }` —— 若 `raidView.ts` 未导出磁盘视图类型,本 Task 在 `raidLevels.ts` 定义本地最小 `RaidDisk = { path: string; size: number; disk_type?: string; health?: string }`(对齐 Vue2 `disk.path/size/disk_type/health` 读法)并 export。
- Produces:
  - `export interface RaidLevelInfo { id: number; name: string; min: number; tolerance: string; read: number; write: number; cost: number; desc: string; usecase: string; capacity: (n: number, sizeBytes: number) => number; layout: (n: number) => Array<'data'|'mirror'|'parity'|'parity2'> }`
  - `export const RAID_LEVELS: RaidLevelInfo[]`(顺序 0,1,5,6,10)
  - `export function recommendRaidLevel(n: number): number`
  - `export function isDiskAtRisk(disk: RaidDisk): boolean`
  - `export function groupColorKey(disk: RaidDisk, groups: Array<{ key: string }>): string`(返回分组序号→token 语义,供组件映射到 `--nrm-*`/`--accent` 等,**不返回字面色**)
  - `export interface RaidDisk { path: string; size: number; disk_type?: string; health?: string }`

**逐字移植依据**(实现时对照 Vue2 源逐行核对,**读数/判定不得改**):
- `RAID_LEVELS` 各字段来自 `raidUtils.js:1-76`。`recommendRaidLevel`:2 盘→1,3 盘→5,盘数为偶→10,否则 5(`raidUtils.js:158-166`)。`isDiskAtRisk`:`disk.health === 'false'`(`raidUtils.js:108-110`,注意是**字符串** `'false'`)。
- `capacity(n,size)`/`layout(n)` 各级公式逐字对齐 `raidUtils.js`(RAID0 全 data;RAID1 1 data + (n-1) mirror;RAID5 (n-1) data + 1 parity;RAID6 (n-2) data + 2 parity2;RAID10 data/mirror 交替成对)。

- [ ] **Step 1: 写失败测试** `src/storage/util/raidLevels.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { RAID_LEVELS, recommendRaidLevel, isDiskAtRisk, type RaidDisk } from './raidLevels'

describe('RAID_LEVELS', () => {
  it('含 5 个级别,顺序 0,1,5,6,10', () => {
    expect(RAID_LEVELS.map(l => l.id)).toEqual([0, 1, 5, 6, 10])
  })
  it('每级最少盘数逐字对齐 Vue2', () => {
    const min = Object.fromEntries(RAID_LEVELS.map(l => [l.id, l.min]))
    expect(min).toEqual({ 0: 2, 1: 2, 5: 3, 6: 4, 10: 4 })
  })
  it('容量公式:4 盘 × 1000 → RAID0=4000 / RAID1=1000 / RAID5=3000 / RAID6=2000 / RAID10=2000', () => {
    const cap = (id: number) => RAID_LEVELS.find(l => l.id === id)!.capacity(4, 1000)
    expect(cap(0)).toBe(4000)
    expect(cap(1)).toBe(1000)
    expect(cap(5)).toBe(3000)
    expect(cap(6)).toBe(2000)
    expect(cap(10)).toBe(2000)
  })
  it('布局角色数量随盘数:RAID5 3盘 = 2 data + 1 parity', () => {
    const roles = RAID_LEVELS.find(l => l.id === 5)!.layout(3)
    expect(roles.filter(r => r === 'data')).toHaveLength(2)
    expect(roles.filter(r => r === 'parity')).toHaveLength(1)
  })
})

describe('recommendRaidLevel', () => {
  it('2盘→1, 3盘→5, 4盘→10, 6盘→10, 5盘→5', () => {
    expect(recommendRaidLevel(2)).toBe(1)
    expect(recommendRaidLevel(3)).toBe(5)
    expect(recommendRaidLevel(4)).toBe(10)
    expect(recommendRaidLevel(6)).toBe(10)
    expect(recommendRaidLevel(5)).toBe(5)
  })
})

describe('isDiskAtRisk', () => {
  it('health 字符串 "false" 视为风险,其余不是', () => {
    expect(isDiskAtRisk({ path: '/dev/sda', size: 1, health: 'false' } as RaidDisk)).toBe(true)
    expect(isDiskAtRisk({ path: '/dev/sda', size: 1, health: 'true' } as RaidDisk)).toBe(false)
    expect(isDiskAtRisk({ path: '/dev/sda', size: 1 } as RaidDisk)).toBe(false)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm exec vitest run src/storage/util/raidLevels.test.ts`
Expected: FAIL(模块/导出不存在)。

- [ ] **Step 3: 实现 `raidLevels.ts`**

对照 `NimoOS-UI/src/utils/raidUtils.js:1-166` 逐行移植 `RAID_LEVELS`(0/1/5/6/10 的 `min/tolerance/read/write/cost/desc/usecase/capacity/layout`)、`recommendRaidLevel`、`isDiskAtRisk`、`groupColorKey`。TS 化:`capacity`/`layout` 写成 `RaidLevelInfo` 里的方法;`layout` 返回 `('data'|'mirror'|'parity'|'parity2')[]`。**不移植** `survival`/`rebuildable`。文件顶部注释标 `// 从 NimoOS-UI/src/utils/raidUtils.js 逐字移植(P4);故障模拟器 survival()/rebuildable() 推迟`。

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm exec vitest run src/storage/util/raidLevels.test.ts`
Expected: PASS。补跑 `pnpm exec vue-tsc --noEmit` 零错。

- [ ] **Step 5: Commit**

```bash
git add src/storage/util/raidLevels.ts src/storage/util/raidLevels.test.ts
git commit -m "feat(storage): 迁移 RAID 级别元数据与纯计算(P4 T1,不含故障模拟器)"
```

---

### Task 2: store 四个 RAID 写 action(`createRaid`/`removeRaid`/`replaceRaidDisk`/`recoverRaid`)

在 `src/storage/stores/storage.ts` 加 4 个写守卫 busy ref + 4 个写 action,照 P2 `createStorage`/`unmount` 守卫范式,写成功后刷新入口 `loadRaid()`。**本 Task 只做 store 层 + 单测锁死请求形状**,视图接线在 T5–T8。

**Files:**
- Modify: `src/storage/stores/storage.ts`(busy ref 声明区 `:22-25` 附近加 4 个;action 区加 4 个函数;return `:221-248` 补出)
- Test: `src/storage/stores/storage.test.ts`(追加 RAID 写 action 用例)

**Interfaces:**
- Consumes: `service.raid.create/remove/replaceDisk/recover`(签名见 Global Constraints);`loadRaid()`(P3 建,`storage.ts:133`);`useToast()`;i18n `t`;`startCreateTask(task: RaidTask)`(P3 预留 `:187`);`mapTask`(P3,`raidView.ts`)。
- Produces(store return 新增):
  - `raidCreating: Ref<boolean>`、`raidRemoving: Ref<boolean>`、`raidReplacing: Ref<boolean>`、`raidRecovering: Ref<boolean>`
  - `createRaid(body: { name: string; level: number; disk_paths: string[]; chunk_kb: 512; filesystem: 'btrfs' | 'ext4'; enable_snapshots: boolean }): Promise<RaidTask | null>` —— 成功返回从 create 响应里取出的任务(供向导接 `startCreateTask`),失败返回 `null`。
  - `removeRaid(id: number | string): Promise<boolean>`
  - `replaceRaidDisk(id: number | string, body: { old_disk_path: string; new_disk_path: string }): Promise<boolean>`
  - `recoverRaid(id: number | string): Promise<{ state: string } | null>` —— 返回后端 `data.state` 供视图决定成功/警告 toast(Vue2 语义:`active`/`degraded`/`rebuilding` 判成功)。

- [ ] **Step 1: 写失败测试** `src/storage/stores/storage.test.ts`(追加)

在既有 mock service 结构(参照文件内 `service.raid` 只读方法已 mock 的方式)上追加 create/remove/replaceDisk/recover 的 mock。核心断言 = **请求形状逐字**:

```ts
describe('RAID 写 action', () => {
  it('createRaid 发 POST body 逐字 {name,level,disk_paths,chunk_kb:512,filesystem,enable_snapshots};单飞守卫', async () => {
    const createMock = vi.fn().mockResolvedValue({ data: { task_id: 't1' } })
    // ...把 createMock 装进 service.raid.create（沿用本文件既有 mock 装配方式）
    const s = useStorageStore()
    const body = { name: 'vault', level: 5, disk_paths: ['/dev/sda', '/dev/sdb', '/dev/sdc'], chunk_kb: 512 as const, filesystem: 'btrfs' as const, enable_snapshots: true }
    const p1 = s.createRaid(body)
    const p2 = s.createRaid(body)               // 并发第二发被守卫吞掉
    const [r1, r2] = await Promise.all([p1, p2])
    expect(createMock).toHaveBeenCalledTimes(1)
    expect(createMock).toHaveBeenCalledWith(body)
    expect(r2).toBeNull()                        // 单飞:第二发直接 null
    expect(s.raidCreating).toBe(false)           // finally 释放
  })

  it('createRaid 失败 → 返回 null、warn 只记 message、busy 复位', async () => {
    const createMock = vi.fn().mockRejectedValue(Object.assign(new Error('boom'), { config: { data: 'x' } }))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    // 装 createMock
    const s = useStorageStore()
    const r = await s.createRaid({ name: 'a', level: 0, disk_paths: ['/dev/sda', '/dev/sdb'], chunk_kb: 512, filesystem: 'ext4', enable_snapshots: false })
    expect(r).toBeNull()
    expect(warn).toHaveBeenCalled()
    // 断言日志不带整个 error 对象(不含 config)
    expect(JSON.stringify(warn.mock.calls)).not.toContain('config')
    expect(s.raidCreating).toBe(false)
  })

  it('removeRaid 发 DELETE {id} 无 body;成功 loadRaid 刷新、返回 true', async () => {
    const removeMock = vi.fn().mockResolvedValue(undefined)
    const listMock = vi.fn().mockResolvedValue([])       // loadRaid 内部
    // 装 removeMock + list
    const s = useStorageStore()
    const ok = await s.removeRaid(7)
    expect(removeMock).toHaveBeenCalledWith(7)
    expect(removeMock).toHaveBeenCalledTimes(1)
    expect(listMock).toHaveBeenCalled()                  // 刷新发生
    expect(ok).toBe(true)
  })

  it('replaceRaidDisk 发 POST(id, {old_disk_path,new_disk_path}) 逐字', async () => {
    const replaceMock = vi.fn().mockResolvedValue(undefined)
    // 装 replaceMock + list
    const s = useStorageStore()
    const ok = await s.replaceRaidDisk(3, { old_disk_path: '/dev/sdb', new_disk_path: '/dev/sdd' })
    expect(replaceMock).toHaveBeenCalledWith(3, { old_disk_path: '/dev/sdb', new_disk_path: '/dev/sdd' })
    expect(ok).toBe(true)
  })

  it('recoverRaid 返回后端 data.state', async () => {
    const recoverMock = vi.fn().mockResolvedValue({ data: { data: { state: 'rebuilding' } } })
    // 装 recoverMock + list
    const s = useStorageStore()
    const r = await s.recoverRaid(9)
    expect(recoverMock).toHaveBeenCalledWith(9)
    expect(r).toEqual({ state: 'rebuilding' })
  })
})
```

> 注:mock 装配请沿用 `storage.test.ts` 现有 `service.raid` 只读方法的 mock 写法(该文件顶部已有 `vi.mock('@nimotech/nimoos-service', …)` 或等价注入),保持一致。

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm exec vitest run src/storage/stores/storage.test.ts -t "RAID 写 action"`
Expected: FAIL(action 未定义)。

- [ ] **Step 3: 实现 4 个 action + busy ref**

在 `storage.ts` busy ref 区新增:
```ts
const raidCreating = ref(false)
const raidRemoving = ref(false)
const raidReplacing = ref(false)
const raidRecovering = ref(false)
```
action(照 `createStorage` 的 finally-刷新守卫 / `unmount` 的成功刷新守卫,视操作语义择一):
```ts
// 创建:成功后不在此刷新列表(阵列进"创建中"任务流,由 startCreateTask + 轮询接管),
// 从响应取 task 供向导调 startCreateTask。
async function createRaid(body: {
  name: string; level: number; disk_paths: string[]
  chunk_kb: 512; filesystem: 'btrfs' | 'ext4'; enable_snapshots: boolean
}): Promise<RaidTask | null> {
  if (raidCreating.value) return null
  raidCreating.value = true
  const toast = useToast()
  try {
    const res = (await service.raid.create(body)) as { data?: { task_id?: string } } | undefined
    const taskId = res?.data?.task_id
    // 用请求信息 + task_id 组装 creatingTask(step 未知先给初值,轮询会填)
    const task: RaidTask = {
      taskId: taskId ?? '', name: body.name, level: body.level,
      filesystem: body.filesystem, diskCount: body.disk_paths.length,
      step: 0, stepName: '', progress: 0, elapsedSeconds: 0, error: '', status: 'creating',
    }
    return task
  } catch (e) {
    console.warn('[storage] raid create failed', (e as Error)?.message)
    toast.show(t('raidCreateFailedToast'))
    return null
  } finally {
    raidCreating.value = false
  }
}

async function removeRaid(id: number | string): Promise<boolean> {
  if (raidRemoving.value) return false
  raidRemoving.value = true
  const toast = useToast()
  let ok = false
  try {
    await service.raid.remove(id)
    toast.show(t('raidRemoveSuccess'))
    ok = true
  } catch (e) {
    console.warn('[storage] raid remove failed', (e as Error)?.message)
    toast.show(t('raidRemoveFailed'))
  } finally {
    await loadRaid()
    raidRemoving.value = false
  }
  return ok
}

async function replaceRaidDisk(id: number | string, body: { old_disk_path: string; new_disk_path: string }): Promise<boolean> {
  if (raidReplacing.value) return false
  raidReplacing.value = true
  const toast = useToast()
  let ok = false
  try {
    await service.raid.replaceDisk(id, body)
    toast.show(t('raidReplaceSuccess'))
    ok = true
  } catch (e) {
    console.warn('[storage] raid replace failed', (e as Error)?.message)
    toast.show(t('raidReplaceFailed'))
  } finally {
    await loadRaid()
    raidReplacing.value = false
  }
  return ok
}

async function recoverRaid(id: number | string): Promise<{ state: string } | null> {
  if (raidRecovering.value) return null
  raidRecovering.value = true
  const toast = useToast()
  try {
    const res = (await service.raid.recover(id)) as { data?: { data?: { state?: string } } } | undefined
    const state = res?.data?.data?.state ?? 'retrying'
    if (state === 'active' || state === 'degraded' || state === 'rebuilding') toast.show(t('raidRecoverSuccess'))
    else toast.show(t('raidRecoverFailed'))
    await loadRaid()
    return { state }
  } catch (e) {
    console.warn('[storage] raid recover failed', (e as Error)?.message)
    toast.show(t('raidRecoverFailed'))
    return null
  } finally {
    raidRecovering.value = false
  }
}
```
把 4 个 ref + 4 个 action 加进 store 的 `return { … }`。**新增 5 个 toast key**(`raidCreateFailedToast`/`raidRemoveSuccess`/`raidRemoveFailed`/`raidReplaceSuccess`/`raidReplaceFailed`/`raidRecoverSuccess`/`raidRecoverFailed`)在 T2 就双写进 zh_cn/en_us(见附录 B 文案),否则 `t()` 返回 key 本身、`parity.test.ts` 不受影响但眼验会看到裸 key。

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm exec vitest run src/storage/stores/storage.test.ts`
Expected: PASS(全文件)。补 `pnpm exec vue-tsc --noEmit` 零错。

- [ ] **Step 5: Commit**

```bash
git add src/storage/stores/storage.ts src/storage/stores/storage.test.ts src/i18n/zh_cn.ts src/i18n/en_us.ts
git commit -m "feat(storage): RAID 四写 action + 守卫 + 请求形状单测锁死(P4 T2)"
```

---

### Task 3: 选盘组件 `RaidDriveCard` + `RaidDriveBay`

迁移 Vue2 选盘 UI(`NimoOS-UI/.../RaidDriveBay.vue` + `RaidDriveCard.vue`)。`RaidDriveCard` = 单盘可选卡片(整卡点击 toggle + 右上勾选圈 + 容量/类型/健康风险标记);`RaidDriveBay` = 过滤段(All/SSD/HDD)+ 全选健康/清空 + 4 列网格 + 底部汇总条(已选盘数 + 原始容量)。

**Files:**
- Create: `src/storage/components/RaidDriveCard.vue`、`src/storage/components/RaidDriveBay.vue`
- Test: `src/storage/components/RaidDriveCard.test.ts`、`src/storage/components/RaidDriveBay.test.ts`

**Interfaces:**
- Consumes: `isDiskAtRisk`、`RaidDisk`、`groupColorKey`(T1);`fmtSize`(`../../home/util/format`)。
- Produces:
  - `RaidDriveCard` props `{ disk: RaidDisk; selected: boolean; groupKey?: string }`,emits `{ (e:'toggle'): void }`。
  - `RaidDriveBay` props `{ disks: RaidDisk[]; modelValue: RaidDisk[] }`(选中盘,v-model),emits `{ (e:'update:modelValue', v: RaidDisk[]): void }`。内部维护过滤态(`'all'|'ssd'|'hdd'`)、`selectAllHealthy()`、`clear()`。

- [ ] **Step 1: 写失败测试**(`RaidDriveBay.test.ts`,DriveCard 同理)

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import RaidDriveBay from './RaidDriveBay.vue'
import zh from '../../i18n/zh_cn'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const disks = [
  { path: '/dev/sda', size: 1000, disk_type: 'SSD', health: 'true' },
  { path: '/dev/sdb', size: 2000, disk_type: 'HDD', health: 'true' },
  { path: '/dev/sdc', size: 1000, disk_type: 'SSD', health: 'false' }, // 风险盘
]

describe('RaidDriveBay', () => {
  it('点卡片 toggle → emit update:modelValue 含该盘', async () => {
    const w = mount(RaidDriveBay, { props: { disks, modelValue: [] }, global: { plugins: [i18n] } })
    await w.findAllComponents({ name: 'RaidDriveCard' })[0].vm.$emit('toggle')
    const evt = w.emitted('update:modelValue')!.at(-1)![0] as any[]
    expect(evt.map(d => d.path)).toEqual(['/dev/sda'])
  })
  it('全选健康 → 只选非风险盘(排除 health="false")', async () => {
    const w = mount(RaidDriveBay, { props: { disks, modelValue: [] }, global: { plugins: [i18n] } })
    await w.find('.rdb-select-all').trigger('click')
    const evt = w.emitted('update:modelValue')!.at(-1)![0] as any[]
    expect(evt.map(d => d.path).sort()).toEqual(['/dev/sda', '/dev/sdb'])
  })
  it('过滤 SSD → 只显示 SSD 盘', async () => {
    const w = mount(RaidDriveBay, { props: { disks, modelValue: [] }, global: { plugins: [i18n] } })
    await w.find('.rdb-filter-ssd').trigger('click')
    expect(w.findAllComponents({ name: 'RaidDriveCard' })).toHaveLength(2)
  })
  it('汇总条:已选 2 盘 → 显示盘数与容量合计', async () => {
    const w = mount(RaidDriveBay, { props: { disks, modelValue: [disks[0], disks[1]] }, global: { plugins: [i18n] } })
    expect(w.find('.rdb-summary').text()).toContain('2')
  })
})
```

- [ ] **Step 2: 运行确认失败** — `pnpm exec vitest run src/storage/components/RaidDriveBay.test.ts` → FAIL。

- [ ] **Step 3: 实现两组件**

对照 Vue2 `RaidDriveBay.vue`(:16-21 过滤/操作、:80-83 filteredDisks、:120-130 toggle/selectAllHealthy、汇总条)+ `RaidDriveCard.vue`(整卡 `@click="$emit('toggle')"`、勾选圈 `.rdc__check--on`、容量/类型/风险标)。改写为 `<script setup>`:
- `RaidDriveBay` 内 `filter = ref<'all'|'ssd'|'hdd'>('all')`,`filteredDisks = computed`;toggle 用 `props.modelValue` 增删后 `emit('update:modelValue', next)`;`selectAllHealthy` = `disks.filter(d => !isDiskAtRisk(d))`;`clear` emit `[]`。全选/清空/过滤按钮各带稳定 class(`.rdb-select-all`/`.rdb-clear`/`.rdb-filter-all|-ssd|-hdd`)。
- 网格 CSS 用 `grid-template-columns: repeat(auto-fill, minmax(...))`;颜色全 token;混规格分组色经 `groupColorKey` → 映射到 `--nrm-*`/`--accent`(禁字面色)。
- `RaidDriveCard` 根 `@click="emit('toggle')"`,选中态 class 切换,勾选圈 SVG √;风险盘用 `--remove-fg` 标记;容量 `fmtSize(disk.size)`。

- [ ] **Step 4: 运行确认通过** — 两测试 PASS;`vue-tsc --noEmit` 零错。

- [ ] **Step 5: Commit**

```bash
git add src/storage/components/RaidDriveCard.vue src/storage/components/RaidDriveCard.test.ts src/storage/components/RaidDriveBay.vue src/storage/components/RaidDriveBay.test.ts src/i18n/zh_cn.ts src/i18n/en_us.ts
git commit -m "feat(storage): RAID 选盘 DriveBay+DriveCard(P4 T3)"
```

---

### Task 4: 级别对比矩阵 `RaidMatrix`(仅主体,无故障模拟器)

迁移 Vue2 `RaidMatrix.vue` 的**矩阵主体**(`:12-121`)。行:Layout(磁盘条按 role 上色)/Min drives/Survives failure of(容错 pill)/Usable capacity(+利用率%)/Read/Write/Cost(各 5 段 pip 计量条)/Best for/Actions(Select + Details)。**决策 2:不迁 `:123-200` 的故障模拟器 modal 及相关 `survival` 逻辑。**

**Files:**
- Create: `src/storage/components/RaidMatrix.vue`
- Test: `src/storage/components/RaidMatrix.test.ts`

**Interfaces:**
- Consumes: `RAID_LEVELS`、`RaidLevelInfo`(T1);`fmtSize`;`useI18n`。
- Produces: props `{ diskCount: number; sizeBytes: number; selectedLevel: number | null }`,emits `{ (e:'update:selectedLevel', id: number): void; (e:'details', id: number): void }`。

- [ ] **Step 1: 写失败测试**

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import RaidMatrix from './RaidMatrix.vue'
import zh from '../../i18n/zh_cn'
const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

describe('RaidMatrix', () => {
  it('渲染 5 个级别列', () => {
    const w = mount(RaidMatrix, { props: { diskCount: 4, sizeBytes: 1000, selectedLevel: null }, global: { plugins: [i18n] } })
    expect(w.findAll('.rm-col')).toHaveLength(5)
  })
  it('点 Select → emit update:selectedLevel(级别 id)', async () => {
    const w = mount(RaidMatrix, { props: { diskCount: 4, sizeBytes: 1000, selectedLevel: null }, global: { plugins: [i18n] } })
    await w.findAll('.rm-select')[2].trigger('click')  // 第3列 = RAID5
    expect(w.emitted('update:selectedLevel')!.at(-1)).toEqual([5])
  })
  it('不渲染故障模拟器入口(推迟)', () => {
    const w = mount(RaidMatrix, { props: { diskCount: 4, sizeBytes: 1000, selectedLevel: null }, global: { plugins: [i18n] } })
    expect(w.find('.rm-simulator').exists()).toBe(false)
    expect(w.text().toLowerCase()).not.toContain('failure simulator')
  })
})
```

- [ ] **Step 2: 运行确认失败** → FAIL。

- [ ] **Step 3: 实现 `RaidMatrix.vue`**

对照 Vue2 `RaidMatrix.vue:12-121` 的 grid 结构逐行迁 `<script setup>`:9 行 × 5 列。Layout 条按 `lv.layout(diskCount)` 的 role 上色(data→`--accent`,mirror→`--sem-fg`,parity→`--dem-fg`,parity2→`--remove-fg`,均 token);容量 = `lv.capacity(diskCount, sizeBytes)` + 利用率 `capPct`;read/write/cost 用 5 段 pip(填充数 = `lv.read`,token 化)。`Select` 按钮 `.rm-select` emit `update:selectedLevel`;`Details` 按钮 `.rm-details` emit `details`。选中列高亮(`selectedLevel === lv.id`)。**删掉 Vue2 的 `openModal`/`failDrive`/`modalStatus`/`RestoreAll`/`Reset` 全部模拟器代码**,顶部注释标 `<!-- 故障模拟器 P4 决策2 推迟 -->`。表头/单元格不再挂 `@click="openModal"`。

- [ ] **Step 4: 运行确认通过** → PASS;`vue-tsc` 零错。

- [ ] **Step 5: Commit**

```bash
git add src/storage/components/RaidMatrix.vue src/storage/components/RaidMatrix.test.ts src/i18n/zh_cn.ts src/i18n/en_us.ts
git commit -m "feat(storage): RAID 级别对比矩阵主体(P4 T4,故障模拟器推迟)"
```

---

### Task 5: 创建向导视图 `StorageRaidCreate` + 路由 + 列表创建入口

迁移 Vue2 `RaidCreateWizard.vue`(2 步向导)。step0 = RaidDriveBay 选盘 + 快捷级别卡(RAID 0/1/5/6/10,含 ⭐推荐)+ 可折叠 RaidMatrix + 文件系统选择(btrfs/ext4,默认 btrfs)+ 快照复选框(仅 btrfs 显示,默认勾选);step1 = 确认摘要。确认用普通 primary 弹窗;`doCreate` → `store.createRaid(body)` → 拿到 task → `store.startCreateTask(task)` → `router.push('/storage/raid')`(回列表看进度卡)。

**Files:**
- Create: `src/views/StorageRaidCreate.vue`
- Test: `src/views/StorageRaidCreate.test.ts`
- Modify: `src/router/index.ts`、`src/views/StorageRaid.vue`

**Interfaces:**
- Consumes: `RaidDriveBay`(T3)、`RaidMatrix`(T4)、`RAID_LEVELS`/`recommendRaidLevel`(T1)、`Dialog`(`../components/ui/Dialog.vue`)、`useStorageStore`(`createRaid`/`startCreateTask`/`availDisks` 或 RAID 可用盘来源)、`useRouter`、`useI18n`。
- Produces: 路由 `{ path: '/storage/raid/create', name: 'storage-raid-create', component: StorageRaidCreate }`(**插在 `/storage/raid/:id` 之前**)。

- [ ] **Step 1: 写失败测试**(核心 = 请求 body 逐字 + 快照/文件系统联动 + task 接线)

```ts
// mock store.createRaid / startCreateTask / router.push,断言:
// 1) 选 3 盘 + 级别 5 + btrfs + 快照勾选 → 点确认 → createRaid 收到
//    { name, level:5, disk_paths:[3个], chunk_kb:512, filesystem:'btrfs', enable_snapshots:true }
// 2) 切 ext4 → enable_snapshots 强制 false、快照复选框隐藏
// 3) createRaid 返回 task → startCreateTask(task) 被调 + router.push('/storage/raid')
// 4) 盘数 < 级别 min → 确认按钮禁用
```
(测试用 `createTestingPinia` + stub `RaidDriveBay`/`RaidMatrix`,聚焦向导编排与 body 组装,不重测子组件内部。)

- [ ] **Step 2: 运行确认失败** → FAIL。

- [ ] **Step 3: 实现向导 + 路由 + 列表按钮**

- `StorageRaidCreate.vue`:`<script setup>`,state `selectedDisks`/`selectedLevel`/`selectedFilesystem='btrfs'`/`enableSnapshots=true`/`arrayName`/`step=0`。`isBtrfs = computed(() => selectedFilesystem === 'btrfs')`。快捷级别卡 v-for `RAID_LEVELS`,⭐ 标 `recommendRaidLevel(selectedDisks.length)`。RaidMatrix 折叠展开。step1 确认摘要。确认按钮点击 → 用 `Dialog` 弹一句 primary 确认(文案 `raidCreateConfirmMsg`,插值 `{level,name,n}`)→ 确认后组装 body:
  ```ts
  const body = {
    name: arrayName.value, level: selectedLevel.value!,
    disk_paths: selectedDisks.value.map(d => d.path),
    chunk_kb: 512 as const, filesystem: selectedFilesystem.value,
    enable_snapshots: isBtrfs.value ? enableSnapshots.value : false,
  }
  const task = await store.createRaid(body)
  if (task) { store.startCreateTask(task); router.push('/storage/raid') }
  ```
  确认按钮 `:disabled` = 无名字 / 未选级别 / `selectedDisks.length < 该级别 min` / `raidCreating`。名字输入过滤 `[a-zA-Z0-9_-]`。
- `router/index.ts`:在 `/storage/raid/:id` **上一行**插入 create 路由(顺序陷阱见 Global Constraints)。import `StorageRaidCreate`。
- `StorageRaid.vue`:顶部加 `.sv-toolbar` + 创建按钮(仿 `StorageVolumes.vue:62-73`),`@click="router.push('/storage/raid/create')"`。

- [ ] **Step 4: 运行确认通过** → PASS;`vue-tsc` 零错;补跑 `pnpm exec vitest run src/router` 确认路由测试(若有)不破。

- [ ] **Step 5: Commit**

```bash
git add src/views/StorageRaidCreate.vue src/views/StorageRaidCreate.test.ts src/router/index.ts src/views/StorageRaid.vue src/i18n/zh_cn.ts src/i18n/en_us.ts
git commit -m "feat(storage): RAID 创建向导视图+路由+列表入口(P4 T5)"
```

---

### Task 6: 删除阵列 —— type-to-confirm 弹窗 + 详情头按钮(路线 B)

新建 `RaidDeleteDialog.vue`(仿 `FormatDialog.vue`,但输入框是普通文本,提交条件 = `输入 === 阵列名`,**无密码**);详情页 `.rd-head` 加红色 Delete 按钮触发;确认后 `store.removeRaid(id)` → 成功回列表。**更新 P3 的按钮计数不变式测试**(加了写按钮,baseline 必变)。

**Files:**
- Create: `src/storage/components/RaidDeleteDialog.vue`
- Test: `src/storage/components/RaidDeleteDialog.test.ts`
- Modify: `src/views/StorageRaidDetail.vue`、`src/views/StorageRaidDetail.test.ts`(更新计数不变式)

**Interfaces:**
- Consumes: `Dialog`;`useStorageStore().removeRaid`/`raidRemoving`;`useRouter`。
- Produces: `RaidDeleteDialog` props `{ open: boolean; name: string; busy?: boolean }`,emits `{ (e:'update:open', v:boolean): void; (e:'confirm'): void }`(无 payload)。

- [ ] **Step 1: 写失败测试**

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import RaidDeleteDialog from './RaidDeleteDialog.vue'
import zh from '../../i18n/zh_cn'
const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

describe('RaidDeleteDialog', () => {
  const mountIt = () => mount(RaidDeleteDialog, {
    props: { open: true, name: 'vault' }, global: { plugins: [i18n] },
    attachTo: document.body,
  })
  it('输入不等于阵列名 → 删除按钮禁用', async () => {
    const w = mountIt()
    const input = document.body.querySelector('.rdd-input') as HTMLInputElement
    input.value = 'vaul'; input.dispatchEvent(new Event('input'))
    await w.vm.$nextTick()
    const ok = document.body.querySelector('.rdd-ok') as HTMLButtonElement
    expect(ok.disabled).toBe(true)
  })
  it('输入等于阵列名 → 启用,点击 emit confirm(无 payload)', async () => {
    const w = mountIt()
    const input = document.body.querySelector('.rdd-input') as HTMLInputElement
    input.value = 'vault'; input.dispatchEvent(new Event('input'))
    await w.vm.$nextTick()
    const ok = document.body.querySelector('.rdd-ok') as HTMLButtonElement
    expect(ok.disabled).toBe(false)
    ok.click()
    expect(w.emitted('confirm')).toHaveLength(1)
    expect(w.emitted('confirm')![0]).toEqual([])
  })
  it('开/关都清空输入', async () => {
    const w = mountIt()
    const input = document.body.querySelector('.rdd-input') as HTMLInputElement
    input.value = 'vault'; input.dispatchEvent(new Event('input'))
    await w.setProps({ open: false }); await w.setProps({ open: true })
    expect((document.body.querySelector('.rdd-input') as HTMLInputElement).value).toBe('')
  })
})
```

- [ ] **Step 2: 运行确认失败** → FAIL。

- [ ] **Step 3: 实现弹窗 + 详情头按钮 + 更新计数不变式**

- `RaidDeleteDialog.vue`:仿 `FormatDialog.vue` 骨架,`confirmText = ref('')`,`watch(() => props.open, () => confirmText.value = '')`。主文案用 `raidRemoveMsg`(逐字采用 Vue2 本意的删除主句,见附录 B)+ danger 小字 ⚠️ `raidRemoveWarning`。输入框 `.rdd-input` `type="text"` `:placeholder="t('raidRemoveTypeName', { name })"`;删除按钮 `.rdd-ok.danger` `:disabled="confirmText !== name || busy"` `@click="emit('confirm')"`;取消 `.rdd-cancel`。
- `StorageRaidDetail.vue`:`.rd-head`(`:99-104`)右侧加 Delete 按钮(红,`.rd-delete`)→ `deleteOpen = true`;挂 `<RaidDeleteDialog :open="deleteOpen" :name="detail.array.name" :busy="store.raidRemoving" @update:open="deleteOpen=$event" @confirm="onDelete" />`;`onDelete = async () => { const ok = await store.removeRaid(id); if (ok) { deleteOpen=false; router.push('/storage/raid') } }`。
- **更新计数不变式测试**:P3 终审加的"按钮计数 === 2"不变式(`StorageRaidDetail.test.ts`)现在会因新增按钮变化。把它改成**语义化断言**而非硬计数:断言 `.rd-delete` 存在(active/degraded 阵列),并断言不该出现的按钮(如 replace 在非 degraded 时)缺席;同时在 recover 尚未加(T8)前,先只对 delete 生效。**T8 完成后再回来把 recover 按钮纳入该测试**(在 T8 Step 记一笔)。

- [ ] **Step 4: 运行确认通过** → 弹窗测试 + 详情页测试 PASS;`vue-tsc` 零错。

- [ ] **Step 5: Commit**

```bash
git add src/storage/components/RaidDeleteDialog.vue src/storage/components/RaidDeleteDialog.test.ts src/views/StorageRaidDetail.vue src/views/StorageRaidDetail.test.ts src/i18n/zh_cn.ts src/i18n/en_us.ts
git commit -m "feat(storage): RAID 删除 type-to-confirm 弹窗+详情头按钮(P4 T6,路线B)"
```

---

### Task 7: 换盘 —— `RaidReplaceDialog` + degraded 入口

迁移 Vue2 `RaidReplaceDisk.vue`。弹窗:故障盘只读展示 + 单选新盘下拉(排除故障盘,来自可用盘)+ 黄色警告 + danger 按钮**直接执行(无二次确认)**。入口:degraded 阵列——详情页成员列表里 faulty 成员行的"替换"动作(`RaidMemberList` emit)+/或 详情头/列表卡 degraded 横幅。

**Files:**
- Create: `src/storage/components/RaidReplaceDialog.vue`
- Test: `src/storage/components/RaidReplaceDialog.test.ts`
- Modify: `src/views/StorageRaidDetail.vue`、`src/storage/components/RaidMemberList.vue`(+ 其测试)

**Interfaces:**
- Consumes: `Dialog`;`useStorageStore().replaceRaidDisk`/`raidReplacing`;可用盘来源(store 里既有的可用盘列表,同创建向导用的那个)。
- Produces:
  - `RaidReplaceDialog` props `{ open: boolean; raidId: number|string; faultyDiskPath: string; availableDisks: RaidDisk[]; busy?: boolean }`,emits `{ (e:'update:open',v:boolean): void; (e:'replaced'): void }`(内部直接调 store 或 emit 让父调 —— 统一:父传 `@confirm="(newPath)=>..."`?为与 P2 弹窗一致,这里让弹窗 emit `confirm(newPath: string)`,store 调用留在视图)。最终契约:emits `{ (e:'update:open',v:boolean): void; (e:'confirm', newDiskPath: string): void }`。
  - `RaidMemberList` 新增 emit `{ (e:'replace-disk', diskPath: string): void }`(faulty 行"替换"按钮,仅 degraded 时渲染)。

- [ ] **Step 1: 写失败测试**

```ts
// RaidReplaceDialog.test.ts:
// 1) 新盘下拉排除 faultyDiskPath
// 2) 未选新盘 → danger 按钮禁用;选了 → 启用
// 3) 点 danger → emit confirm(选中的 newDiskPath)
// 4) 开/关清空选择
// RaidMemberList.test.ts(追加):
// 5) degraded 阵列 faulty 成员行渲染 .rml-replace 按钮,点击 emit replace-disk(该盘 path)
// 6) 非 degraded / 非 faulty 成员行 无替换按钮
```

- [ ] **Step 2: 运行确认失败** → FAIL。

- [ ] **Step 3: 实现**

- `RaidReplaceDialog.vue`:仿 `FormatDialog` 骨架 + `Dialog` 底座。故障盘只读行(`raidReplaceFaulty` 标签 + `faultyDiskPath`,红字 help `raidReplaceRemoveHint`);新盘 `<select v-model="newDiskPath" class="rrd-select">`,选项 = `availableDisks.filter(d => d.path !== faultyDiskPath)`,显示 `${path} — ${fmtSize(size)}`;黄色警告 `raidReplaceWarning`;footer danger 按钮 `.rrd-ok` `:disabled="!newDiskPath || busy"` `@click="emit('confirm', newDiskPath)"`,取消 `.rrd-cancel`。`watch(open)` 清 `newDiskPath`。
- `RaidMemberList.vue`:degraded 且成员 `state` 判 faulty 时,该行加 `.rml-replace` 按钮 emit `replace-disk`(成员 path)。新增 prop 或从现有状态推断 degraded(优先复用现有传入)。
- `StorageRaidDetail.vue`:监听 `RaidMemberList` 的 `@replace-disk` → 设 `replaceTarget = diskPath` + `replaceOpen = true`;挂 `<RaidReplaceDialog :open="replaceOpen" :raid-id="id" :faulty-disk-path="replaceTarget" :available-disks="availDisks" :busy="store.raidReplacing" @update:open="replaceOpen=$event" @confirm="onReplace" />`;`onReplace = async (newPath) => { const ok = await store.replaceRaidDisk(id, { old_disk_path: replaceTarget, new_disk_path: newPath }); if (ok) replaceOpen = false }`。

- [ ] **Step 4: 运行确认通过** → PASS;`vue-tsc` 零错。

- [ ] **Step 5: Commit**

```bash
git add src/storage/components/RaidReplaceDialog.vue src/storage/components/RaidReplaceDialog.test.ts src/views/StorageRaidDetail.vue src/storage/components/RaidMemberList.vue src/storage/components/RaidMemberList.test.ts src/i18n/zh_cn.ts src/i18n/en_us.ts
git commit -m "feat(storage): RAID 换盘弹窗+成员行入口(P4 T7)"
```

---

### Task 8: 恢复/重新识别 —— 详情头按钮 + toast

迁移 Vue2 recover。详情页 `.rd-head` 在阵列 `retrying`/`failed` 时显示 Rediscover 按钮(warning),点击**直接执行**(无确认)→ `store.recoverRaid(id)` → 按返回 `state` 出成功/警告 toast(已在 T2 store action 内做)。**回填 T6 的计数不变式测试**把 recover 按钮纳入。

**Files:**
- Modify: `src/views/StorageRaidDetail.vue`、`src/views/StorageRaidDetail.test.ts`

**Interfaces:**
- Consumes: `useStorageStore().recoverRaid`/`raidRecovering`;详情页已有的 `effectiveState`/状态判定(P3)。

- [ ] **Step 1: 写失败测试**(`StorageRaidDetail.test.ts` 追加)

```ts
// 1) 阵列 state='retrying' → .rd-recover 按钮渲染;'active' → 不渲染
// 2) 点 .rd-recover → store.recoverRaid(id) 被调一次(mock),busy 时按钮禁用
// 3) 计数不变式(回填 T6):active 阵列头部写按钮 = [delete];retrying = [delete, recover]
```

- [ ] **Step 2: 运行确认失败** → FAIL。

- [ ] **Step 3: 实现**

`StorageRaidDetail.vue` `.rd-head`:`<button v-if="effectiveState==='retrying' || effectiveState==='failed'" class="rd-recover" :disabled="store.raidRecovering" @click="store.recoverRaid(id)">{{ t('raidRecover') }}</button>`(warning 色 `--dem-fg`)。toast 由 store action 出,视图不重复。更新 T6 的语义化按钮断言纳入 recover。

- [ ] **Step 4: 运行确认通过** → PASS;`vue-tsc` 零错;**跑全量** `pnpm test` 全绿。

- [ ] **Step 5: Commit**

```bash
git add src/views/StorageRaidDetail.vue src/views/StorageRaidDetail.test.ts src/i18n/zh_cn.ts src/i18n/en_us.ts
git commit -m "feat(storage): RAID 恢复/重新识别详情头按钮(P4 T8)"
```

---

## 收尾门(所有 Task 完成后)

1. `pnpm test` 全量全绿 + `pnpm exec vue-tsc --noEmit` 零错 + `pnpm exec vitest run src/styles/color-guard.test.ts`(零裸色)+ `src/i18n/parity.test.ts`(键对齐)。
2. `pnpm build` 重建 dist;5273 常驻 vite preview 自动伺服新哈希(挂了就 `cd .sp6/NimoOS-New-UI && nohup pnpm exec vite preview --host > ../preview-5273.log 2>&1 &`)。
3. **单盘设备无法实盘验写操作**(需 ≥2 盘):可眼验的 = `/storage/raid/create` 路由可达、创建向导选盘/级别卡/矩阵展开/文件系统与快照联动的**纯 UI 交互**(无盘或单盘下按钮禁用态)、详情页在无阵列时的空态。**写操作真机验收随多盘设备补,记 ledger**(与 P3 同口径)。
4. 整支终审(Opus,base 402ea6d)→ Ready to merge 判定后关账。**禁区**:不部署、不合并、不改 roadmap(P6)。

## Ledger 挂账(收尾写进 `.superpowers/sdd/progress.md`)

- 故障模拟器(决策 2 推迟):RaidMatrix 未迁 Vue2 `:123-200` 模拟器 + `raidUtils.js` `survival()`/`rebuildable()`,随 P5 或以后补。
- 写操作实盘验收(单盘限制):create/remove/replaceDisk/recover 全部界面+接口层做全+单测锁死,真机验随多盘设备补。
- Vue2 i18n 债修正:删除主文案 key 大小写 bug(Vue2 调 `confirm delete raid` 但只存在 `Confirm delete raid`)、replaceDisk 多个 key 无译文——New-UI 侧已补齐正确 key,记录 Vue2 侧遗留(不回改旧仓)。

---

## 附录 A:P3 已占用、P4 不得撞名的 i18n key

```
raidStateHealthy raidStateDegraded raidStateRebuilding raidStateFailed raidStateRetrying
raidDisksOnline raidRebuildFinish raidRebuildSpeed
raidMemberActive raidMemberFaulty raidMemberRebuilding
raidNoArrays raidCreating raidCreateFailed raidTaskMeta raidDetailsBtn raidDismiss
raidStep1..raidStep6 raidStepInitFs raidCreateDone raidPreparing raidElapsed raidModalHint
raidDetailDevicePath raidDetailMountPoint raidDetailFilesystem raidDetailUuid raidDetailChunk raidDetailState
raidUsageUsed raidUsageFree
raidLevelType raidLevelTolerance raidLevelRead raidLevelWrite raidMembers
raidBtrfsFreeEst raidBtrfsCachedAt
raidLevel{0,1,5,6,10}Tolerance raidLevel{0,1,5,6,10}Read raidLevel{0,1,5,6,10}Write raidLevel{0,1,5,6,10}Desc
storageTabRaid
```

## 附录 B:P4 新增 i18n key(zh_cn / en_us 双写建议文案)

| key | zh_cn | en_us |
|---|---|---|
| `raidCreate` | 创建 RAID | Create RAID |
| `raidCreateConfirmMsg` | 确认创建 RAID {level} 阵列「{name}」,共 {n} 块硬盘? | Create RAID {level} array "{name}" using {n} drive(s)? |
| `raidCreateFailedToast` | RAID 创建失败 | Failed to create RAID |
| `raidCreateName` | 阵列名称 | Array name |
| `raidCreateFilesystem` | 文件系统 | Filesystem |
| `raidCreateSnapshots` | 启用快照保护 | Enable snapshot protection |
| `raidCreateSnapshotsHint` | 创建后自动每小时快照,可随时关闭。 | Hourly auto-snapshots after creation — can be turned off anytime. |
| `raidCreateSelectDrives` | 选择硬盘与 RAID 级别 | Select drives and RAID |
| `raidCreateConfirmStep` | 确认 | Confirm |
| `raidBaySelectAll` | 全选健康盘 | Select all healthy |
| `raidBayClear` | 清空 | Clear |
| `raidBayFilterAll` | 全部 | All |
| `raidBaySelected` | 已选 {n} 块 · {size} | {n} selected · {size} |
| `raidMatrixLayout` | 布局 | Layout |
| `raidMatrixMinDrives` | 最少硬盘 | Min. drives |
| `raidMatrixSurvives` | 容错 | Survives failure of |
| `raidMatrixCapacity` | 可用容量 | Usable capacity |
| `raidMatrixRead` | 读取速度 | Read speed |
| `raidMatrixWrite` | 写入速度 | Write speed |
| `raidMatrixCost` | 成本效率 | Cost efficiency |
| `raidMatrixBestFor` | 适用场景 | Best for |
| `raidMatrixSelect` | 选择 | Select |
| `raidMatrixDetails` | 详情 | Details |
| `raidMatrixToggle` | 展开/收起对比 | Expand/Collapse comparison |
| `raidRemove` | 删除阵列 | Delete Array |
| `raidRemoveTitle` | 删除 RAID 阵列 | Delete RAID Array |
| `raidRemoveMsg` | 这将停止阵列并清除 mdadm 元数据,数据将无法恢复。 | This will stop the array and clear mdadm metadata. Data will be unrecoverable. |
| `raidRemoveWarning` | 请确保所有成员磁盘已连接。离线磁盘将保留 mdadm 超块,可能需要手动清除。 | Ensure all member disks are connected. Offline disks will retain mdadm superblocks and may need manual cleanup. |
| `raidRemoveTypeName` | 输入阵列名「{name}」以确认删除 | Type the array name "{name}" to confirm |
| `raidRemoveOk` | 删除 | Delete |
| `raidRemoveSuccess` | RAID 阵列已删除 | RAID array deleted |
| `raidRemoveFailed` | 删除失败 | Failed to delete array |
| `raidReplace` | 更换硬盘 | Replace Disk |
| `raidReplaceTitle` | 更换故障硬盘 | Replace Faulty Disk |
| `raidReplaceFaulty` | 故障硬盘 | Faulty Disk |
| `raidReplaceRemoveHint` | 该硬盘将从阵列中移除 | This disk will be removed from the array |
| `raidReplaceNew` | 更换硬盘 | Replacement Disk |
| `raidReplaceSelect` | 选择一块硬盘 | Select a disk |
| `raidReplaceWarning` | 更换将触发阵列重建,期间性能下降。 | Replacing triggers an array rebuild; performance is reduced during rebuild. |
| `raidReplaceSuccess` | 已开始更换硬盘 | Disk replacement started |
| `raidReplaceFailed` | 更换失败 | Failed to replace disk |
| `raidRecover` | 重新识别 | Rediscover |
| `raidRecoverSuccess` | 阵列已恢复 | Array recovered |
| `raidRecoverFailed` | 识别失败,请检查磁盘连接 | Discovery failed, check disk connections |
| `storageCancel`(P2 已存,复用) | 取消 | Cancel |

> 实施时逐 Task 只加该 Task 用到的 key(见各 Task Step);表中 `storageCancel` 已由 P2 提供,直接复用不重复添加。新增任何 key 必须 zh_cn/en_us 同步。
