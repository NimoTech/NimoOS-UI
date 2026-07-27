# SP6-P5 btrfs 快照面板迁移 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 Vue2 RAID 详情里的 btrfs 快照面板(`SnapshotPanel.vue` 303 行 + `SnapshotTimeline.vue` 362 行 + `service/snapshot.js` 里的纯函数)迁成 New-UI 的 `/storage/raid/:id` 详情页左栏快照卡片:三态(不支持/已关闭/已启用)+ 保护开关 + 状态摘要 + 保留策略高级表单 + 手动创建快照 + 快照历史时间线(按天分组折叠)+ 删除快照确认弹窗。

**Architecture:** 沿用 P1–P4 既定分层——纯函数落 `src/storage/util/snapshotView.ts`,所有 service 调用只在 Pinia store 里发生(**本期新建 `src/storage/stores/snapshot.ts`**,不塞进已 348 行的 `storage.ts`;New-UI 早有一区多 store 先例,如 `files/stores/mounts.ts`),组件只读 store + 管生命周期。快照面板作为一张卡片填进 `StorageRaidDetail.vue` 左栏现有的 `<!-- 快照面板 P5 -->` 占位注释处,数据全部走 P0 已进包的 `service.snapshot`。

**Tech Stack:** Vue 3 `<script setup>` + TS · Pinia setup-store · vue-i18n 9 · reka-ui(`Dialog` 底座,经 `src/components/ui/Dialog.vue`)· vitest + @vue/test-utils。**无 Tailwind/无 CSS 框架,颜色一律 theme token。**

---

## Global Constraints

这些约束绑定**每一个** Task,不再逐条重复:

- **本期范围 = RAID 详情内的快照面板**(设计 spec §4 P5 字面范围):面板三态 + 开关 + 策略 + 手动建快照 + 时间线 + 删快照。
  **明确不做(用户 2026-07-27 拍板,收尾记台账)**:
  1. **时间线的 [浏览] 按钮不迁**——它跳的是文件区快照只读浏览(Vue2 `FilePanel.vue` 的只读横幅 / 禁写 / 退出回实时路径 / `SnapshotTimeWheel` / `SnapshotActionBar` / `SnapshotSettingsModal` / `snapshotBrowse.js`,≈1400 行 + 后端 `GET /v2/snapshot/file-versions`),SP4 文件区收官时未迁、也没记过台账。整套作为**独立一期**记台账,本期只在时间线代码里留注释标注入口位置。
  2. 因此 `snapshotBrowsePath` / `parseSnapshotBrowsePath` / `liveVolumePath` / `parseSnapshotName` / `formatSnapshotBannerTime` / `findVolumeForPath` 六个文件区专属纯函数**不迁**(随上面那一期走)。
  3. `service.snapshot.restore()` 本期**不调用**(恢复入口属文件区)。
- **零改 NimoOS-Service**:`service.snapshot` 已在 P0 进包,签名(`node_modules/@nimotech/nimoos-service/dist/snapshot.d.ts`)逐字如下,**不得**动 `/home/nimo/NimoTech/.sp6/NimoOS-Service`:
  - `listVolumes(): Promise<SnapshotVolume[]>` → GET `/v2/snapshot/volumes`
  - `list(volumeUuid: string): Promise<unknown>` → GET `/v2/snapshot?volume_uuid=`
  - `getPolicy(volumeUuid: string): Promise<SnapshotPolicy>` → GET `/v2/snapshot/policy?volume_uuid=`
  - `updatePolicy(policy: SnapshotPolicy): Promise<unknown>` → PUT `/v2/snapshot/policy`(**全量替换**)
  - `patchPolicy(volumeUuid, patch): Promise<unknown>` → 内部 getPolicy 读-改-写后 updatePolicy(**所有策略写操作只能走它**)
  - `togglePolicy(volumeUuid, enabled): Promise<unknown>` → 内部 `patchPolicy(uuid, { enabled })`
  - `create(data: unknown): Promise<unknown>` → POST `/v2/snapshot`
  - `remove(name: string, volumeUuid: string): Promise<unknown>` → DELETE `/v2/snapshot/{encodeURIComponent(name)}?volume_uuid=`
  - 类型 `SnapshotVolume` / `SnapshotPolicy` 从 `@nimotech/nimoos-service` import(两者都有索引签名 `[k: string]: unknown`)。
- **逐字对齐 Vue2 的请求形状**(来源 `NimoOS-UI/src/service/snapshot.js` + `SnapshotPanel.vue` + `SnapshotTimeline.vue`):
  - **create** body:`{ volume_uuid: string }`,label 非空(trim 后)时才加 `label` 字段——**空 label 不得出现在 body 里**(Vue2 `...(label ? { label } : {})`)。
  - **remove**:`service.snapshot.remove(name, volumeUuid)`,**参数顺序 (名字, 卷 UUID)**。
  - **策略写**:一律 `patchPolicy(uuid, {...})`,禁止从零拼 PUT body(PUT 是全量替换,漏字段会把保留数清零)。
- **后端现状(2026-07-27 核实)**:设备上 `nimoos-local-storage` 是 2026-06-22 版,`/v2/snapshot/*` **全部 404**;且后端 `currentVolumes()` = `VolumesFromRAIDArrays(...)`,即**「快照卷」== RAID 阵列**,单盘无阵列设备即使部署新后端也只返回空列表。**用户拍板:本期不部署后端**。因此:
  - 404 必须**优雅降级**成 Vue2 同款行为——`listVolumes()` 抛错 → `volume = null` → 面板显示「此卷的文件系统不支持快照」,**绝不能让快照把 RAID 详情页整页搞崩**(Vue2 注释原话:optional feature; keep the RAID detail panel functional without it)。每个 load 都要 try/catch。
- **只记 message 不记整个 error**:catch 里 `console.warn('[snapshot] xxx failed', (e as Error)?.message)`(绝不整对象打日志,与 P1–P4 纪律一致)。
- **颜色 = theme token,零字面量**(`src/styles/color-guard.test.ts` 会红;豁免要写 `/* theme-exception: 原因 */`)。本期状态→token 映射(全期统一,与 P3/P4 同源):
  | 语义 | Vue2 字面色 | New-UI token |
  |---|---|---|
  | 卡片底/边/标题 | `#fff` / `#e2e8f0` / `#6b7280` | `--card-bg` / `--card-border` / `--fg-muted` |
  | 次要说明文字 | `has-text-grey` | `--fg-muted` |
  | 暂停警告行 | `#92400e` | `--dem-fg` |
  | 主按钮(保存/立即创建) | `is-primary` | `--accent` |
  | 危险(删除) | `is-danger` | `--remove-fg` |
  | 时间线 auto 点/徽章 | `#9ca3af` / `#f1f5f9` | `--nrm-fg` / `--nrm-bg` |
  | 时间线 manual 点/徽章 | `#7c3aed` / `rgba(124,58,237,.12)` | `--accent` / `--accent-soft` |
  | 时间线 preop 点/徽章 | `#f59e0b` / `#fef9c3` | `--dem-fg` / `--dem-bg` |
  | 骨架屏渐变 | `#f1f5f9→#e2e8f0` | `--skeleton-bg` / `--nrm-bg` |
  **本期不新增 token**;若确需,`:root` 与 `:root[data-theme="light"]` 两块都要加。
  > 披露:manual 由紫改主题强调色、preop 由琥珀改 `--dem-fg`,是主题 token 化的必然结果(New-UI 无紫色语义 token),视觉层级(三类可区分)保持不变。
- **i18n 双写**:任何新文案 key 必须**同时**加到 `src/i18n/zh_cn.ts` 与 `src/i18n/en_us.ts`,否则 `src/i18n/parity.test.ts` 红。本期新 key 一律 **`snap` 前缀**(现仓库 `snap` 前缀键数 = 0,无撞名风险;`raidCreateSnapshot`/`raidCreateSnapshotHint` 是 P4 创建向导的,别动)。「取消」复用 P2 已有的 `storageCancel`。完整文案表见「附录 A」,**逐 Task 只加该 Task 用到的键**。
- **移植纪律(最高优先级)**:界面严格 1:1 照 Vue2;Vue2 的 bug/竞态/吞错**不照抄**,改正确并在代码里注释登记;禁无关重构;任何对 Vue2 的偏离/简化必须在任务报告里显式披露。本期已知的三处**有意偏离**(实现时按此执行,不要"照抄回去"):
  1. **Vue2 保存策略后摘要显示 undefined(真 bug,不照抄)**:后端 `PUT /v2/snapshot/policy` 返回 `data: null`(`route/snapshot.go:334` 实证),Vue2 `savePolicy` 却写 `this.policy = res.data?.data || res.data` → 拿到的是整个信封对象 → 摘要行 `p.hourly_keep` 为 `undefined`。New-UI 改法:PUT 是全量替换、我们**知道**刚写进去的是什么,成功后用本地表单值合并进 `policy`(见 T2 代码),并在该处注释登记 Vue2 bug。
  2. **slot + `refreshSignal` + `@deleted` 三段式换成 store 直连**:Vue2 里父组件用 `#timeline` slot 挂时间线、用 `${volume.count}|${volume.last_at}` 字符串当刷新信号、删除后 emit 回父再调 `panel.fetchVolume()`——这是 Vue2 无共享 store 的接线补丁。New-UI 里面板与时间线读同一个 `useSnapshotStore`,建/删快照后由 store action 自己刷新卷摘要与列表。**渲染结构与可见性条件保持 1:1**(时间线仍只在 `enabled` 或 `disabled 且 count>0` 时出现)。
  3. **校验错误文案由「英文原文当键」改成具名 i18n key**:Vue2 `validatePolicyForm` 返回 `"Must be a positive whole number"` 这种英文串直接当 `$t()` 的键;New-UI 的 i18n 是 camelCase 具名键,故返回 `'snapErrPositiveInt'` / `'snapErrPercent'`。
- **不引新依赖**:开关(Vue2 `b-switch`)、数字输入(`b-numberinput`)、确认框(`$buefy.dialog.confirm`)在 New-UI 没有对应原语 → 分别手写 `<button role="switch">`、原生 `<input type="number">`、复用 `src/components/ui/Dialog.vue`。这属于框架差异的必要改写,不算偏离。
- **每期收尾门**:`pnpm test`(全绿)+ `pnpm exec vue-tsc --noEmit`(零错)+ color-guard + parity 全绿 → `pnpm build` 重建 dist,5273 常驻预览验路由可达/无阵列空态。**禁区**:不跑 `deploy.sh`、不写 `/var/lib/nimoos/www`、不改 NimoOS-UI 仓、不改 roadmap、SP5 合入 master 前不合并本分支(全部推迟 P6)。
- **验收口径(用户 2026-07-27 拍板)**:单盘设备无 RAID 阵列 → 详情页进不去 → 快照面板在真机上渲染不出来。**以单测 + 整支终审为准,面板本体的真机眼验挂账,随多盘设备与 P3/P4 一并补**。

---

## 文件结构总览(本期创建/修改)

**新建:**
- `src/storage/util/snapshotView.ts`(+ `.test.ts`)—— 纯函数与视图类型:`resolveSnapshotState` / `validatePolicyForm` / `classifySnapshotType` / `snapshotTypeLabelKey` / `formatSnapshotClockTime` / `snapshotDayLabel` / `toSnapshotViewModel` / `groupSnapshotsByDay` / `defaultExpandedDayKeys` / `asSnapshotVolume`,从 Vue2 `service/snapshot.js` 逐字移植(不含文件区六函数)。
- `src/storage/stores/snapshot.ts`(+ `.test.ts`)—— Pinia setup-store:卷/策略/快照列表 + 6 个 action + 单飞守卫 + toast。
- `src/storage/components/SnapshotPanel.vue`(+ `.test.ts`)—— 快照保护卡片(三态 + 开关 + 状态/暂停/保留行 + 策略摘要 + 高级表单 + 手动创建行 + 内嵌时间线)。
- `src/storage/components/SnapshotTimeline.vue`(+ `.test.ts`)—— 快照历史(骨架/空态/按天分组折叠/条目 + 删除按钮)。
- `src/storage/components/SnapshotDeleteDialog.vue`(+ `.test.ts`)—— 删除快照确认弹窗。

**修改:**
- `src/views/StorageRaidDetail.vue` —— 左栏 `<!-- 快照面板 P5 -->`(`:184`)换成 `<SnapshotPanel :volume-uuid="array.uuid" />`。
- `src/views/StorageRaidDetail.test.ts` —— 追加快照面板挂载/降级用例。
- `src/i18n/zh_cn.ts` / `src/i18n/en_us.ts` —— 快照文案(随引入它的 Task 增补,双写)。

**任务依赖顺序**:T1(纯函数)→ T2(store,依赖 T1 类型)→ T3(面板三态+开关,依赖 T1/T2)→ T4(高级策略表单 + 手动创建,依赖 T3)→ T5(时间线 + 嵌进面板,依赖 T1/T2/T3)→ T6(删除弹窗 + 时间线删除接线,依赖 T2/T5)→ T7(接进详情页 + 收尾)。**串行执行**(T3–T6 都改同一批文件,不并行分派)。

---

### Task 1: 快照纯函数与视图类型(`snapshotView.ts`)

从 Vue2 `NimoOS-UI/src/service/snapshot.js` 逐字移植面板/时间线需要的纯函数。**判定逻辑、默认值、排序、分组规则一律不得改**;**不迁**文件区六个路径函数(见 Global Constraints)。

**Files:**
- Create: `src/storage/util/snapshotView.ts`
- Test: `src/storage/util/snapshotView.test.ts`

**Interfaces:**
- Consumes: `import type { SnapshotVolume } from '@nimotech/nimoos-service'`。
- Produces:
  ```ts
  export interface SnapshotVolumeView {
    volume_uuid: string; mount: string; supported: boolean; enabled: boolean
    count: number; last_at: string; paused_reason: string
  }
  export interface SnapshotRaw {
    id?: number | string; name: string; label?: string; type?: string; created_at: string | number
  }
  export interface SnapshotItemView {
    id: number | string | undefined; name: string; label: string; type: string
    typeKind: 'auto' | 'manual' | 'preop'; typeLabelKey: string; time: string; createdAt: string | number
  }
  export interface SnapshotDayGroup {
    dayKey: string; label: { i18nKey?: string; text?: string }; items: SnapshotItemView[]
  }
  export interface PolicyForm {
    hourly_keep: number; daily_keep: number; weekly_keep: number; pause_threshold_pct: number
  }
  export type SnapshotState = 'unsupported' | 'disabled' | 'enabled'

  export function asSnapshotVolume(raw: SnapshotVolume | Record<string, unknown>): SnapshotVolumeView
  export function resolveSnapshotState(v: SnapshotVolumeView | null): SnapshotState
  export function validatePolicyForm(form: PolicyForm): { valid: boolean; errors: Partial<Record<keyof PolicyForm, string>> }
  export function classifySnapshotType(type: string | undefined): 'auto' | 'manual' | 'preop'
  export function snapshotTypeLabelKey(type: string | undefined): string
  export function formatSnapshotClockTime(createdAt: string | number | Date): string
  export function snapshotDayLabel(createdAt: string | number | Date, now?: Date): { i18nKey?: string; text?: string }
  export function toSnapshotViewModel(snap: SnapshotRaw): SnapshotItemView
  export function groupSnapshotsByDay(snapshots: SnapshotRaw[], now?: Date): SnapshotDayGroup[]
  export function defaultExpandedDayKeys(groups: SnapshotDayGroup[], limit?: number): string[]
  ```

**逐字移植依据**(实现时对照 Vue2 源逐行核对):
- `resolveSnapshotState`(`snapshot.js:6-9`):`!volume || !volume.supported` → `'unsupported'`;否则 `volume.enabled ? 'enabled' : 'disabled'`。
- `validatePolicyForm`(`:15-31`):三个 keep 必须 `Number.isInteger(v) && v >= 1`;`pause_threshold_pct` 必须整数且 `1..100`。**错误值改为具名 key**:keep 三项 → `'snapErrPositiveInt'`,阈值 → `'snapErrPercent'`(见 Global Constraints 偏离 3)。
- `classifySnapshotType`(`:45-49`):`'manual'`→manual、`'preop'`→preop、**其余一律 auto**(含 `auto-hourly`/`auto-daily`/`auto-weekly`/未知)。
- `snapshotTypeLabelKey`:auto→`'snapTypeAuto'`、manual→`'snapTypeManual'`、preop→`'snapTypePreop'`(Vue2 的 `"Auto"/"Manual"/"Pre-op protection"` 英文键改具名键,同偏离 3)。
- `formatSnapshotClockTime`(`:64-69`):本地时钟 `HH:mm`,两位补零。
- `snapshotDayLabel`(`:80-89`):同日→`{ i18nKey: 'snapToday' }`、前一日→`{ i18nKey: 'snapYesterday' }`、更早→`{ text: d.toLocaleDateString() }`。日期键 `dayKeyOf` = `YYYY-MM-DD` 本地时区。
- `toSnapshotViewModel`(`:95-108`)、`groupSnapshotsByDay`(`:112-131`,**按 created_at 倒序、不改输入、天分组内也是新的在前**)、`defaultExpandedDayKeys`(`:135-137`,默认展开最近 2 组)。
- `asSnapshotVolume` 是 New-UI 新增的收窄映射(照 `raidView.asRaidArray` 范式):`SnapshotVolume` 带索引签名,直接读 `count`/`last_at`/`paused_reason` 在 TS strict 下是 `unknown`。**默认值必须让语义与 Vue2 一致**:`supported`/`enabled` 缺失 → `false`,`count` → `0`,`last_at`/`paused_reason` → `''`。

- [ ] **Step 1: 写失败测试** `src/storage/util/snapshotView.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import {
  asSnapshotVolume, resolveSnapshotState, validatePolicyForm, classifySnapshotType,
  snapshotTypeLabelKey, formatSnapshotClockTime, snapshotDayLabel, toSnapshotViewModel,
  groupSnapshotsByDay, defaultExpandedDayKeys, type SnapshotRaw,
} from './snapshotView'

describe('asSnapshotVolume', () => {
  it('缺字段一律给安全默认(supported/enabled=false, count=0, 字符串为空)', () => {
    expect(asSnapshotVolume({})).toEqual({
      volume_uuid: '', mount: '', supported: false, enabled: false,
      count: 0, last_at: '', paused_reason: '',
    })
  })
  it('原样透传后端字段', () => {
    const v = asSnapshotVolume({ volume_uuid: 'u1', mount: '/DATA', supported: true, enabled: true, count: 3, last_at: '2026-07-27T01:00:00Z', paused_reason: 'disk full' })
    expect(v.count).toBe(3)
    expect(v.mount).toBe('/DATA')
    expect(v.paused_reason).toBe('disk full')
  })
})

describe('resolveSnapshotState', () => {
  it('null 或 supported=false → unsupported;supported 时按 enabled 分二态', () => {
    expect(resolveSnapshotState(null)).toBe('unsupported')
    expect(resolveSnapshotState(asSnapshotVolume({ supported: false, enabled: true }))).toBe('unsupported')
    expect(resolveSnapshotState(asSnapshotVolume({ supported: true, enabled: false }))).toBe('disabled')
    expect(resolveSnapshotState(asSnapshotVolume({ supported: true, enabled: true }))).toBe('enabled')
  })
})

describe('validatePolicyForm', () => {
  const ok = { hourly_keep: 24, daily_keep: 7, weekly_keep: 4, pause_threshold_pct: 90 }
  it('合法表单 valid=true 且无错误', () => {
    expect(validatePolicyForm(ok)).toEqual({ valid: true, errors: {} })
  })
  it('keep 为 0/小数/负数 → snapErrPositiveInt', () => {
    expect(validatePolicyForm({ ...ok, hourly_keep: 0 }).errors.hourly_keep).toBe('snapErrPositiveInt')
    expect(validatePolicyForm({ ...ok, daily_keep: 1.5 }).errors.daily_keep).toBe('snapErrPositiveInt')
    expect(validatePolicyForm({ ...ok, weekly_keep: -1 }).errors.weekly_keep).toBe('snapErrPositiveInt')
  })
  it('阈值 0 / 101 / 小数 → snapErrPercent;1 与 100 是合法边界', () => {
    expect(validatePolicyForm({ ...ok, pause_threshold_pct: 0 }).errors.pause_threshold_pct).toBe('snapErrPercent')
    expect(validatePolicyForm({ ...ok, pause_threshold_pct: 101 }).errors.pause_threshold_pct).toBe('snapErrPercent')
    expect(validatePolicyForm({ ...ok, pause_threshold_pct: 50.5 }).errors.pause_threshold_pct).toBe('snapErrPercent')
    expect(validatePolicyForm({ ...ok, pause_threshold_pct: 1 }).valid).toBe(true)
    expect(validatePolicyForm({ ...ok, pause_threshold_pct: 100 }).valid).toBe(true)
  })
})

describe('classifySnapshotType', () => {
  it('只有 manual/preop 单列,其余(含 auto-hourly/未知/undefined)全归 auto', () => {
    expect(classifySnapshotType('manual')).toBe('manual')
    expect(classifySnapshotType('preop')).toBe('preop')
    expect(classifySnapshotType('auto-hourly')).toBe('auto')
    expect(classifySnapshotType('whatever')).toBe('auto')
    expect(classifySnapshotType(undefined)).toBe('auto')
  })
  it('标签 key 与类别一一对应', () => {
    expect(snapshotTypeLabelKey('manual')).toBe('snapTypeManual')
    expect(snapshotTypeLabelKey('preop')).toBe('snapTypePreop')
    expect(snapshotTypeLabelKey('auto-daily')).toBe('snapTypeAuto')
  })
})

describe('formatSnapshotClockTime', () => {
  it('本地时钟 HH:mm 两位补零', () => {
    expect(formatSnapshotClockTime(new Date(2026, 6, 27, 9, 5))).toBe('09:05')
    expect(formatSnapshotClockTime(new Date(2026, 6, 27, 23, 59))).toBe('23:59')
  })
})

describe('snapshotDayLabel', () => {
  const now = new Date(2026, 6, 27, 12, 0)
  it('今天/昨天走 i18n key,更早给已格式化文本', () => {
    expect(snapshotDayLabel(new Date(2026, 6, 27, 1, 0), now)).toEqual({ i18nKey: 'snapToday' })
    expect(snapshotDayLabel(new Date(2026, 6, 26, 23, 0), now)).toEqual({ i18nKey: 'snapYesterday' })
    const older = snapshotDayLabel(new Date(2026, 6, 20, 8, 0), now)
    expect(older.i18nKey).toBeUndefined()
    expect(typeof older.text).toBe('string')
  })
})

describe('groupSnapshotsByDay / defaultExpandedDayKeys', () => {
  const snaps: SnapshotRaw[] = [
    { id: 1, name: 'a', type: 'auto-hourly', created_at: new Date(2026, 6, 25, 10, 0).toISOString() },
    { id: 2, name: 'b', type: 'manual', label: '升级前', created_at: new Date(2026, 6, 27, 8, 30).toISOString() },
    { id: 3, name: 'c', type: 'preop', created_at: new Date(2026, 6, 27, 20, 15).toISOString() },
    { id: 4, name: 'd', type: 'auto-daily', created_at: new Date(2026, 6, 26, 6, 0).toISOString() },
  ]
  const now = new Date(2026, 6, 27, 23, 0)
  it('按天倒序分组,组内也是新的在前', () => {
    const groups = groupSnapshotsByDay(snaps, now)
    expect(groups.map(g => g.dayKey)).toEqual(['2026-07-27', '2026-07-26', '2026-07-25'])
    expect(groups[0].items.map(i => i.name)).toEqual(['c', 'b'])
  })
  it('不改动输入数组', () => {
    const input = [...snaps]
    groupSnapshotsByDay(input, now)
    expect(input.map(s => s.name)).toEqual(['a', 'b', 'c', 'd'])
  })
  it('条目视图带类别/标签键/时钟/备注', () => {
    const vm = toSnapshotViewModel(snaps[1])
    expect(vm.typeKind).toBe('manual')
    expect(vm.typeLabelKey).toBe('snapTypeManual')
    expect(vm.time).toBe('08:30')
    expect(vm.label).toBe('升级前')
  })
  it('无 label 归一为空串(模板直接判真假)', () => {
    expect(toSnapshotViewModel(snaps[0]).label).toBe('')
  })
  it('默认展开最近 2 组', () => {
    const groups = groupSnapshotsByDay(snaps, now)
    expect(defaultExpandedDayKeys(groups)).toEqual(['2026-07-27', '2026-07-26'])
    expect(defaultExpandedDayKeys(groups, 1)).toEqual(['2026-07-27'])
  })
  it('空列表 → 空分组、空展开键', () => {
    expect(groupSnapshotsByDay([], now)).toEqual([])
    expect(defaultExpandedDayKeys([])).toEqual([])
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm exec vitest run src/storage/util/snapshotView.test.ts`
Expected: FAIL(模块不存在)。

- [ ] **Step 3: 实现 `snapshotView.ts`**

对照 `NimoOS-UI/src/service/snapshot.js:1-137` 逐行移植。文件顶部注释标:
```ts
// 从 NimoOS-UI/src/service/snapshot.js 逐字移植(SP6-P5)。
// 未迁:snapshotBrowsePath / parseSnapshotBrowsePath / liveVolumePath / parseSnapshotName /
// formatSnapshotBannerTime / findVolumeForPath —— 属文件区快照浏览套件,随该期一起迁(见 P5 计划台账)。
```
骨架(其余函数照上面「逐字移植依据」补齐):
```ts
import type { SnapshotVolume } from '@nimotech/nimoos-service'

export type SnapshotState = 'unsupported' | 'disabled' | 'enabled'
// …(接口定义见 Interfaces 段,原样落盘)

const TYPE_LABEL_KEYS: Record<'auto' | 'manual' | 'preop', string> = {
  auto: 'snapTypeAuto', manual: 'snapTypeManual', preop: 'snapTypePreop',
}

export function asSnapshotVolume(raw: SnapshotVolume | Record<string, unknown>): SnapshotVolumeView {
  const r = raw as Record<string, unknown>
  return {
    volume_uuid: (r.volume_uuid as string) || '',
    mount: (r.mount as string) || '',
    supported: r.supported === true,
    enabled: r.enabled === true,
    count: Number(r.count) || 0,
    last_at: (r.last_at as string) || '',
    paused_reason: (r.paused_reason as string) || '',
  }
}

export function resolveSnapshotState(v: SnapshotVolumeView | null): SnapshotState {
  if (!v || !v.supported) return 'unsupported'
  return v.enabled ? 'enabled' : 'disabled'
}

export function validatePolicyForm(form: PolicyForm) {
  const errors: Partial<Record<keyof PolicyForm, string>> = {}
  const isPositiveInt = (v: number) => Number.isInteger(v) && v >= 1
  if (!isPositiveInt(form.hourly_keep)) errors.hourly_keep = 'snapErrPositiveInt'
  if (!isPositiveInt(form.daily_keep)) errors.daily_keep = 'snapErrPositiveInt'
  if (!isPositiveInt(form.weekly_keep)) errors.weekly_keep = 'snapErrPositiveInt'
  const pct = form.pause_threshold_pct
  if (!Number.isInteger(pct) || pct < 1 || pct > 100) errors.pause_threshold_pct = 'snapErrPercent'
  return { valid: Object.keys(errors).length === 0, errors }
}

function dayKeyOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
```
`groupSnapshotsByDay` 排序照 Vue2 用 `new Date(b.created_at).getTime() - new Date(a.created_at).getTime()`(Vue2 直接相减 Date 对象,TS 下改用 `getTime()`,结果等价)。

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm exec vitest run src/storage/util/snapshotView.test.ts` → PASS
Run: `pnpm exec vue-tsc --noEmit` → 零错

- [ ] **Step 5: Commit**

```bash
git add src/storage/util/snapshotView.ts src/storage/util/snapshotView.test.ts
git commit -m "feat(storage): 快照纯函数与视图类型逐字移植(P5 T1)"
```

---

### Task 2: 快照 store(`stores/snapshot.ts`)

新建 Pinia setup-store,承接 Vue2 `SnapshotPanel` 的 `fetchVolume/fetchPolicy/onToggle/savePolicy/createSnapshot` 与 `SnapshotTimeline` 的 `fetchSnapshots/doDelete`。**本 Task 只做 store + 单测锁死请求形状**,组件在 T3–T6。

**Files:**
- Create: `src/storage/stores/snapshot.ts`
- Test: `src/storage/stores/snapshot.test.ts`
- Modify: `src/i18n/zh_cn.ts`、`src/i18n/en_us.ts`(本 Task 只加 8 个 toast 键,见附录 A 标「T2」的行)

**Interfaces:**
- Consumes: `service.snapshot.*`(签名见 Global Constraints);`useToast()`(`src/stores/toast.ts`,`show(text)`);`i18n.global.t`;T1 的 `asSnapshotVolume`/`SnapshotVolumeView`/`SnapshotRaw`/`PolicyForm`。
- Produces:
  ```ts
  export const useSnapshotStore = defineStore('snapshot', () => ({
    volume: Ref<SnapshotVolumeView | null>          // 初值 null
    policy: Ref<SnapshotPolicy | null>              // 初值 null
    snapshots: Ref<SnapshotRaw[]>                   // 初值 []
    volumeLoading: Ref<boolean>                     // 初值 true(Vue2 loading 初值 true,面板 v-if="!loading")
    listLoading: Ref<boolean>                       // 初值 true
    toggling: Ref<boolean>
    policySaving: Ref<boolean>
    creatingSnapshot: Ref<boolean>
    deletingName: Ref<string | null>                // 初值 null
    loadVolume(uuid: string): Promise<void>
    loadPolicy(uuid: string): Promise<void>
    loadSnapshots(uuid: string): Promise<void>
    toggle(uuid: string, enabled: boolean): Promise<void>
    savePolicy(uuid: string, form: PolicyForm): Promise<boolean>
    createSnapshot(uuid: string, label: string): Promise<boolean>
    removeSnapshot(uuid: string, name: string): Promise<boolean>
  }))
  ```

- [ ] **Step 1: 写失败测试** `src/storage/stores/snapshot.test.ts`

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const listVolumes = vi.fn()
const listMock = vi.fn()
const getPolicy = vi.fn()
const patchPolicy = vi.fn()
const togglePolicy = vi.fn()
const createMock = vi.fn()
const removeMock = vi.fn()
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    snapshot: {
      listVolumes: (...a: unknown[]) => listVolumes(...a),
      list: (...a: unknown[]) => listMock(...a),
      getPolicy: (...a: unknown[]) => getPolicy(...a),
      patchPolicy: (...a: unknown[]) => patchPolicy(...a),
      togglePolicy: (...a: unknown[]) => togglePolicy(...a),
      create: (...a: unknown[]) => createMock(...a),
      remove: (...a: unknown[]) => removeMock(...a),
    },
  },
}))
const toastShow = vi.fn()
vi.mock('../../stores/toast', () => ({ useToast: () => ({ show: toastShow }) }))
vi.mock('../../i18n', () => ({ i18n: { global: { t: (k: string) => k } } }))

import { useSnapshotStore } from './snapshot'

const VOL = { volume_uuid: 'u1', mount: '/DATA', supported: true, enabled: true, count: 2, last_at: '2026-07-27T01:00:00Z' }

beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })

describe('loadVolume', () => {
  it('按 volume_uuid 命中本卷,收窄成视图对象', async () => {
    listVolumes.mockResolvedValue([{ volume_uuid: 'other' }, VOL])
    const s = useSnapshotStore()
    await s.loadVolume('u1')
    expect(s.volume?.volume_uuid).toBe('u1')
    expect(s.volume?.count).toBe(2)
    expect(s.volumeLoading).toBe(false)
  })
  it('列表里没有本卷 → volume=null(面板落 unsupported 态)', async () => {
    listVolumes.mockResolvedValue([{ volume_uuid: 'other' }])
    const s = useSnapshotStore()
    await s.loadVolume('u1')
    expect(s.volume).toBeNull()
  })
  it('端点 404/抛错 → volume=null、loading 释放、只记 message 不记整个 error', async () => {
    listVolumes.mockRejectedValue(Object.assign(new Error('boom'), { config: { data: 'secret' } }))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const s = useSnapshotStore()
    await s.loadVolume('u1')
    expect(s.volume).toBeNull()
    expect(s.volumeLoading).toBe(false)
    expect(warn).toHaveBeenCalled()
    expect(JSON.stringify(warn.mock.calls)).not.toContain('config')
  })
})

describe('loadSnapshots', () => {
  it('取回列表;非数组响应归一为空数组', async () => {
    listMock.mockResolvedValue([{ name: 'a', created_at: '2026-07-27T00:00:00Z' }])
    const s = useSnapshotStore()
    await s.loadSnapshots('u1')
    expect(listMock).toHaveBeenCalledWith('u1')
    expect(s.snapshots).toHaveLength(1)
    listMock.mockResolvedValue(null)
    await s.loadSnapshots('u1')
    expect(s.snapshots).toEqual([])
    expect(s.listLoading).toBe(false)
  })
  it('抛错 → 列表清空、loading 释放', async () => {
    listMock.mockRejectedValue(new Error('x'))
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const s = useSnapshotStore()
    await s.loadSnapshots('u1')
    expect(s.snapshots).toEqual([])
    expect(s.listLoading).toBe(false)
  })
})

describe('toggle', () => {
  it('成功:调 togglePolicy(uuid, enabled)、本地 enabled 跟随、出成功 toast、单飞', async () => {
    listVolumes.mockResolvedValue([VOL])
    togglePolicy.mockResolvedValue(undefined)
    const s = useSnapshotStore()
    await s.loadVolume('u1')
    await Promise.all([s.toggle('u1', false), s.toggle('u1', false)]) // 并发第二发被守卫吞掉
    expect(togglePolicy).toHaveBeenCalledTimes(1)
    expect(togglePolicy).toHaveBeenCalledWith('u1', false)
    expect(s.volume?.enabled).toBe(false)
    expect(toastShow).toHaveBeenCalledWith('snapToggleOff')
    expect(s.toggling).toBe(false)
  })
  it('失败:本地回滚到原值 + 失败 toast', async () => {
    listVolumes.mockResolvedValue([VOL])           // enabled: true
    togglePolicy.mockRejectedValue(new Error('x'))
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const s = useSnapshotStore()
    await s.loadVolume('u1')
    await s.toggle('u1', false)
    expect(s.volume?.enabled).toBe(true)
    expect(toastShow).toHaveBeenCalledWith('snapToggleFailed')
  })
})

describe('savePolicy', () => {
  const form = { hourly_keep: 12, daily_keep: 5, weekly_keep: 3, pause_threshold_pct: 80 }
  it('走 patchPolicy(读-改-写)传整个表单;成功返回 true', async () => {
    patchPolicy.mockResolvedValue(null)
    const s = useSnapshotStore()
    const ok = await s.savePolicy('u1', form)
    expect(patchPolicy).toHaveBeenCalledWith('u1', form)
    expect(ok).toBe(true)
    expect(toastShow).toHaveBeenCalledWith('snapPolicySaved')
  })
  it('后端 PUT 返回 null 时,本地 policy 用刚保存的表单值(Vue2 此处会显示 undefined,不照抄)', async () => {
    getPolicy.mockResolvedValue({ volume_uuid: 'u1', enabled: true, hourly_keep: 24, daily_keep: 7, weekly_keep: 4, pause_threshold_pct: 90 })
    patchPolicy.mockResolvedValue(null)
    const s = useSnapshotStore()
    await s.loadPolicy('u1')
    await s.savePolicy('u1', form)
    expect(s.policy?.hourly_keep).toBe(12)
    expect(s.policy?.pause_threshold_pct).toBe(80)
    expect(s.policy?.enabled).toBe(true)      // 未在表单里的字段保持原值
  })
  it('失败 → 返回 false + 失败 toast + busy 复位', async () => {
    patchPolicy.mockRejectedValue(new Error('x'))
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const s = useSnapshotStore()
    expect(await s.savePolicy('u1', form)).toBe(false)
    expect(toastShow).toHaveBeenCalledWith('snapPolicySaveFailed')
    expect(s.policySaving).toBe(false)
  })
})

describe('createSnapshot', () => {
  it('有备注:body = {volume_uuid, label}(label 前后空白被 trim)', async () => {
    createMock.mockResolvedValue(undefined)
    listVolumes.mockResolvedValue([VOL])
    listMock.mockResolvedValue([])
    const s = useSnapshotStore()
    expect(await s.createSnapshot('u1', '  升级前  ')).toBe(true)
    expect(createMock).toHaveBeenCalledWith({ volume_uuid: 'u1', label: '升级前' })
    expect(toastShow).toHaveBeenCalledWith('snapCreated')
  })
  it('无备注:body 里不得出现 label 字段', async () => {
    createMock.mockResolvedValue(undefined)
    listVolumes.mockResolvedValue([VOL])
    listMock.mockResolvedValue([])
    const s = useSnapshotStore()
    await s.createSnapshot('u1', '   ')
    expect(createMock).toHaveBeenCalledWith({ volume_uuid: 'u1' })
    expect(Object.keys(createMock.mock.calls[0][0] as object)).toEqual(['volume_uuid'])
  })
  it('成功后刷新卷摘要与快照列表', async () => {
    createMock.mockResolvedValue(undefined)
    listVolumes.mockResolvedValue([VOL])
    listMock.mockResolvedValue([])
    const s = useSnapshotStore()
    await s.createSnapshot('u1', '')
    expect(listVolumes).toHaveBeenCalled()
    expect(listMock).toHaveBeenCalledWith('u1')
  })
  it('单飞:并发第二发被吞;失败出失败 toast 且 busy 复位', async () => {
    createMock.mockResolvedValue(undefined)
    listVolumes.mockResolvedValue([VOL]); listMock.mockResolvedValue([])
    const s = useSnapshotStore()
    await Promise.all([s.createSnapshot('u1', ''), s.createSnapshot('u1', '')])
    expect(createMock).toHaveBeenCalledTimes(1)
    createMock.mockRejectedValue(new Error('x'))
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(await s.createSnapshot('u1', '')).toBe(false)
    expect(toastShow).toHaveBeenCalledWith('snapCreateFailed')
    expect(s.creatingSnapshot).toBe(false)
  })
})

describe('removeSnapshot', () => {
  it('调 remove(name, uuid) —— 参数顺序不可颠倒;成功后本地摘除该条并刷新卷摘要', async () => {
    listMock.mockResolvedValue([
      { name: 'snap-a', created_at: '2026-07-27T00:00:00Z' },
      { name: 'snap-b', created_at: '2026-07-26T00:00:00Z' },
    ])
    listVolumes.mockResolvedValue([VOL])
    removeMock.mockResolvedValue(undefined)
    const s = useSnapshotStore()
    await s.loadSnapshots('u1')
    expect(await s.removeSnapshot('u1', 'snap-a')).toBe(true)
    expect(removeMock).toHaveBeenCalledWith('snap-a', 'u1')
    expect(s.snapshots.map(x => x.name)).toEqual(['snap-b'])
    expect(listVolumes).toHaveBeenCalled()
    expect(toastShow).toHaveBeenCalledWith('snapDeleted')
    expect(s.deletingName).toBeNull()
  })
  it('删除中再点(同一/另一条)被守卫吞掉', async () => {
    listMock.mockResolvedValue([{ name: 'snap-a', created_at: '2026-07-27T00:00:00Z' }])
    listVolumes.mockResolvedValue([VOL])
    removeMock.mockResolvedValue(undefined)
    const s = useSnapshotStore()
    await s.loadSnapshots('u1')
    await Promise.all([s.removeSnapshot('u1', 'snap-a'), s.removeSnapshot('u1', 'snap-a')])
    expect(removeMock).toHaveBeenCalledTimes(1)
  })
  it('失败 → 返回 false、列表不变、失败 toast、守卫复位', async () => {
    listMock.mockResolvedValue([{ name: 'snap-a', created_at: '2026-07-27T00:00:00Z' }])
    removeMock.mockRejectedValue(new Error('x'))
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const s = useSnapshotStore()
    await s.loadSnapshots('u1')
    expect(await s.removeSnapshot('u1', 'snap-a')).toBe(false)
    expect(s.snapshots).toHaveLength(1)
    expect(toastShow).toHaveBeenCalledWith('snapDeleteFailed')
    expect(s.deletingName).toBeNull()
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm exec vitest run src/storage/stores/snapshot.test.ts`
Expected: FAIL(store 不存在)。

- [ ] **Step 3: 实现 `src/storage/stores/snapshot.ts`**

```ts
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { service } from '@nimotech/nimoos-service'
import type { SnapshotPolicy } from '@nimotech/nimoos-service'
import { i18n } from '../../i18n'
import { useToast } from '../../stores/toast'
import { asSnapshotVolume, type SnapshotVolumeView, type SnapshotRaw, type PolicyForm } from '../util/snapshotView'

export const useSnapshotStore = defineStore('snapshot', () => {
  const volume = ref<SnapshotVolumeView | null>(null)
  const policy = ref<SnapshotPolicy | null>(null)
  const snapshots = ref<SnapshotRaw[]>([])
  // Vue2 SnapshotPanel/SnapshotTimeline 的 loading 初值都是 true(面板 v-if="!loading"),
  // 首帧不闪空态,逐字继承。
  const volumeLoading = ref(true)
  const listLoading = ref(true)
  const toggling = ref(false)
  const policySaving = ref(false)
  const creatingSnapshot = ref(false)
  const deletingName = ref<string | null>(null)
  const t = i18n.global.t

  async function loadVolume(uuid: string) {
    try {
      const list = await service.snapshot.listVolumes()
      const hit = (Array.isArray(list) ? list : []).find(
        (v) => (v as { volume_uuid?: string })?.volume_uuid === uuid,
      )
      volume.value = hit ? asSnapshotVolume(hit) : null
    } catch (e) {
      // 快照是可选功能(老后端 /v2/snapshot/* 全 404):吞错落 unsupported 态,
      // 绝不能把 RAID 详情页拖垮 —— Vue2 SnapshotPanel.fetchVolume 同款语义。
      console.warn('[snapshot] load volume failed', (e as Error)?.message)
      volume.value = null
    } finally {
      volumeLoading.value = false
    }
  }

  async function loadPolicy(uuid: string) {
    try {
      policy.value = await service.snapshot.getPolicy(uuid)
    } catch (e) {
      console.warn('[snapshot] load policy failed', (e as Error)?.message)
      policy.value = null
    }
  }

  async function loadSnapshots(uuid: string) {
    listLoading.value = true
    try {
      const res = await service.snapshot.list(uuid)
      snapshots.value = Array.isArray(res) ? (res as SnapshotRaw[]) : []
    } catch (e) {
      console.warn('[snapshot] load list failed', (e as Error)?.message)
      snapshots.value = []
    } finally {
      listLoading.value = false
    }
  }

  async function toggle(uuid: string, enabled: boolean) {
    if (toggling.value) return
    toggling.value = true
    const toast = useToast()
    try {
      await service.snapshot.togglePolicy(uuid, enabled)
      if (volume.value) volume.value.enabled = enabled
      toast.show(enabled ? t('snapToggleOn') : t('snapToggleOff'))
    } catch (e) {
      console.warn('[snapshot] toggle failed', (e as Error)?.message)
      // Vue2 失败分支写的是 volume.enabled = !val,即回到切换前的值 —— 逐字继承
      if (volume.value) volume.value.enabled = !enabled
      toast.show(t('snapToggleFailed'))
    } finally {
      toggling.value = false
    }
  }

  async function savePolicy(uuid: string, form: PolicyForm): Promise<boolean> {
    if (policySaving.value) return false
    policySaving.value = true
    const toast = useToast()
    try {
      // 策略写一律走 patchPolicy(读-改-写);PUT 是全量替换,漏字段会把保留数清零
      await service.snapshot.patchPolicy(uuid, { ...form })
      // ⚠️ Vue2 bug 不照抄:后端 PUT /v2/snapshot/policy 返回 data:null
      //(NimoOS-LocalStorage route/snapshot.go putSnapshotPolicy),Vue2 却把整个响应
      // 信封赋给 policy,导致保存后摘要行显示 "保留 undefined"。这里改成用刚写进去的
      // 表单值合并进本地 policy —— PUT 是全量替换,我们确知落库内容。
      policy.value = { ...(policy.value ?? {}), ...form }
      toast.show(t('snapPolicySaved'))
      return true
    } catch (e) {
      console.warn('[snapshot] save policy failed', (e as Error)?.message)
      toast.show(t('snapPolicySaveFailed'))
      return false
    } finally {
      policySaving.value = false
    }
  }

  async function createSnapshot(uuid: string, label: string): Promise<boolean> {
    if (creatingSnapshot.value) return false
    creatingSnapshot.value = true
    const toast = useToast()
    try {
      const trimmed = label.trim()
      // 契约:POST /v2/snapshot {volume_uuid} + 仅在备注非空时带 label(Vue2 逐字)
      await service.snapshot.create({ volume_uuid: uuid, ...(trimmed ? { label: trimmed } : {}) })
      toast.show(t('snapCreated'))
      // Vue2 用 refreshSignal(count|last_at)间接触发时间线刷新;这里 store 直连,
      // 建完直接刷卷摘要 + 列表(行为等价,少一层字符串信号)
      await Promise.all([loadVolume(uuid), loadSnapshots(uuid)])
      return true
    } catch (e) {
      console.warn('[snapshot] create failed', (e as Error)?.message)
      toast.show(t('snapCreateFailed'))
      return false
    } finally {
      creatingSnapshot.value = false
    }
  }

  async function removeSnapshot(uuid: string, name: string): Promise<boolean> {
    if (deletingName.value) return false
    deletingName.value = name
    const toast = useToast()
    try {
      // 参数顺序 (name, volumeUuid);共享包内部对 name 做 encodeURIComponent(名字常含中文)
      await service.snapshot.remove(name, uuid)
      snapshots.value = snapshots.value.filter((s) => s.name !== name)
      toast.show(t('snapDeleted'))
      // 删除会改变卷的 count/last_at:刷新摘要(Vue2 靠 @deleted 冒泡回父组件做同一件事)
      await loadVolume(uuid)
      return true
    } catch (e) {
      console.warn('[snapshot] delete failed', (e as Error)?.message)
      toast.show(t('snapDeleteFailed'))
      return false
    } finally {
      deletingName.value = null
    }
  }

  return {
    volume, policy, snapshots,
    volumeLoading, listLoading, toggling, policySaving, creatingSnapshot, deletingName,
    loadVolume, loadPolicy, loadSnapshots, toggle, savePolicy, createSnapshot, removeSnapshot,
  }
})
```

加 i18n(附录 A 标 T2 的 8 个键)到 `zh_cn.ts` 与 `en_us.ts`,位置紧跟现有 `raid*` 键之后。

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm exec vitest run src/storage/stores/snapshot.test.ts` → PASS
Run: `pnpm exec vitest run src/i18n/parity.test.ts` → PASS
Run: `pnpm exec vue-tsc --noEmit` → 零错

- [ ] **Step 5: Commit**

```bash
git add src/storage/stores/snapshot.ts src/storage/stores/snapshot.test.ts src/i18n/zh_cn.ts src/i18n/en_us.ts
git commit -m "feat(storage): 快照 store 六 action + 守卫 + 请求形状单测锁死(P5 T2)"
```

---

### Task 3: 快照面板三态骨架 + 保护开关(`SnapshotPanel.vue`)

迁移 Vue2 `SnapshotPanel.vue` 的**卡片骨架与三态**:`unsupported`(只有一行说明)/ `disabled`(开关 + 一行解释,若有历史快照再加一行"保留"承诺)/ `enabled`(开关 + 状态摘要行 + 暂停警告行 + 保留承诺行 + 策略摘要行)。**高级表单与手动创建行留 T4,时间线留 T5**(本 Task 先把这两处留空注释占位)。

**Files:**
- Create: `src/storage/components/SnapshotPanel.vue`
- Test: `src/storage/components/SnapshotPanel.test.ts`
- Modify: `src/i18n/zh_cn.ts`、`src/i18n/en_us.ts`(附录 A 标「T3」的 8 个键)

**Interfaces:**
- Consumes: `useSnapshotStore()`(T2);`resolveSnapshotState`(T1);`useI18n`。
- Produces: 组件 props `{ volumeUuid: string }`,无 emits。稳定 class 契约(后续 Task 与详情页测试依赖):根 `.sp-card`、开关 `.sp-switch`、不支持行 `.sp-unsupported`、状态行 `.sp-status`、暂停行 `.sp-paused`、保留承诺行 `.sp-kept`、策略摘要 `.sp-policy-summary`、高级设置按钮 `.sp-advanced-btn`(T4)。

**Vue2 逐字对照点**(`SnapshotPanel.vue`):
- `v-if="!loading"`:加载中整卡不渲染(`:2`)。
- `unsupported` 分支只有标题 + 一行灰字(`:4-9`),**没有开关**。
- 开关 `:value="volume && volume.enabled"`、`:loading="toggling"`、`:disabled="toggling"`,`@input` → toggle(`:16-23`)。
- `disabled` 分支的解释行(`:27-31`)。
- `enabled` 分支的状态文案(`:133-140`):`count===0 && !last_at` → 「暂无快照」;否则 `{n} snapshots so far · last at {time}`,`time` = `new Date(last_at).toLocaleString()`,`last_at` 为空时用「从未」。
- 暂停行(`:38-40` + `:141-149`):`paused_reason` 非空才出,前缀 ⚠️。
- 保留承诺行:`enabled` 时一行(`:41-43`);`disabled` **且** `count > 0` 时也出一行(`:95-97`)。
- 策略摘要(`:150-158`):`policy` 为空 → 空字符串;否则 `每小时快照:保留 {hourly} · 每天:保留 {daily} · 每周:保留 {weekly}`。
- 策略拉取时机(`:160-164` 的 watcher):`state` 变为 `enabled` 且原先不是 `enabled` 时才 `loadPolicy` —— **每次转换只拉一次**,不要在 mounted 里无条件拉。
- `mounted` 只调 `fetchVolume`(`:165-167`)。

- [ ] **Step 1: 写失败测试** `src/storage/components/SnapshotPanel.test.ts`

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import SnapshotPanel from './SnapshotPanel.vue'
import zh from '../../i18n/zh_cn'

const listVolumes = vi.fn()
const getPolicy = vi.fn()
const listMock = vi.fn().mockResolvedValue([])
const togglePolicy = vi.fn().mockResolvedValue(undefined)
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    snapshot: {
      listVolumes: (...a: unknown[]) => listVolumes(...a),
      getPolicy: (...a: unknown[]) => getPolicy(...a),
      list: (...a: unknown[]) => listMock(...a),
      togglePolicy: (...a: unknown[]) => togglePolicy(...a),
      patchPolicy: vi.fn(),
      create: vi.fn(),
      remove: vi.fn(),
    },
  },
}))

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const mountPanel = () => mount(SnapshotPanel, { props: { volumeUuid: 'u1' }, global: { plugins: [i18n] } })
const flush = async (w: ReturnType<typeof mountPanel>) => {
  await new Promise((r) => setTimeout(r)); await w.vm.$nextTick(); await w.vm.$nextTick()
}

beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks(); getPolicy.mockResolvedValue({ hourly_keep: 24, daily_keep: 7, weekly_keep: 4, pause_threshold_pct: 90 }) })

describe('SnapshotPanel 三态', () => {
  it('端点 404(listVolumes 抛错)→ 不支持态:有说明、无开关,且不拉策略', async () => {
    listVolumes.mockRejectedValue(new Error('404'))
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const w = mountPanel(); await flush(w)
    expect(w.find('.sp-unsupported').exists()).toBe(true)
    expect(w.find('.sp-switch').exists()).toBe(false)
    expect(getPolicy).not.toHaveBeenCalled()
  })
  it('supported=false → 不支持态', async () => {
    listVolumes.mockResolvedValue([{ volume_uuid: 'u1', supported: false }])
    const w = mountPanel(); await flush(w)
    expect(w.find('.sp-unsupported').exists()).toBe(true)
  })
  it('已关闭态:有开关(未选中)+ 解释行,无状态行/无策略摘要', async () => {
    listVolumes.mockResolvedValue([{ volume_uuid: 'u1', supported: true, enabled: false, count: 0 }])
    const w = mountPanel(); await flush(w)
    expect(w.find('.sp-switch').attributes('aria-checked')).toBe('false')
    expect(w.find('.sp-status').exists()).toBe(false)
    expect(w.find('.sp-policy-summary').exists()).toBe(false)
    expect(getPolicy).not.toHaveBeenCalled()
  })
  it('已关闭但仍有历史快照 → 额外出"已有快照仍会保留"行', async () => {
    listVolumes.mockResolvedValue([{ volume_uuid: 'u1', supported: true, enabled: false, count: 3 }])
    const w = mountPanel(); await flush(w)
    expect(w.find('.sp-kept').exists()).toBe(true)
  })
  it('已启用态:开关选中 + 状态摘要 + 保留承诺 + 策略摘要(且策略只拉一次)', async () => {
    listVolumes.mockResolvedValue([{ volume_uuid: 'u1', supported: true, enabled: true, count: 5, last_at: '2026-07-27T01:00:00Z' }])
    const w = mountPanel(); await flush(w)
    expect(w.find('.sp-switch').attributes('aria-checked')).toBe('true')
    expect(w.find('.sp-status').text()).toContain('5')
    expect(w.find('.sp-kept').exists()).toBe(true)
    expect(w.find('.sp-policy-summary').text()).toContain('24')
    expect(getPolicy).toHaveBeenCalledTimes(1)
  })
  it('已启用但零快照 → 状态行显示"暂无快照"', async () => {
    listVolumes.mockResolvedValue([{ volume_uuid: 'u1', supported: true, enabled: true, count: 0, last_at: '' }])
    const w = mountPanel(); await flush(w)
    expect(w.find('.sp-status').text()).toBe(zh.snapNoneYet)
  })
  it('paused_reason 非空 → 出暂停警告行,内容含原因', async () => {
    listVolumes.mockResolvedValue([{ volume_uuid: 'u1', supported: true, enabled: true, count: 1, last_at: '2026-07-27T01:00:00Z', paused_reason: '磁盘使用率 95%' }])
    const w = mountPanel(); await flush(w)
    expect(w.find('.sp-paused').text()).toContain('磁盘使用率 95%')
  })
  it('无 paused_reason → 不出暂停行', async () => {
    listVolumes.mockResolvedValue([{ volume_uuid: 'u1', supported: true, enabled: true, count: 1 }])
    const w = mountPanel(); await flush(w)
    expect(w.find('.sp-paused').exists()).toBe(false)
  })
})

describe('SnapshotPanel 保护开关', () => {
  it('点开关 → togglePolicy(uuid, 目标值);切换后本地状态跟随', async () => {
    listVolumes.mockResolvedValue([{ volume_uuid: 'u1', supported: true, enabled: true, count: 1 }])
    const w = mountPanel(); await flush(w)
    await w.find('.sp-switch').trigger('click')
    await flush(w)
    expect(togglePolicy).toHaveBeenCalledWith('u1', false)
    expect(w.find('.sp-switch').attributes('aria-checked')).toBe('false')
  })
  it('切换在途时开关禁用(防连点)', async () => {
    listVolumes.mockResolvedValue([{ volume_uuid: 'u1', supported: true, enabled: false, count: 0 }])
    let release: (v?: unknown) => void = () => {}
    togglePolicy.mockImplementation(() => new Promise((r) => { release = r }))
    const w = mountPanel(); await flush(w)
    await w.find('.sp-switch').trigger('click')
    await w.vm.$nextTick()
    expect((w.find('.sp-switch').element as HTMLButtonElement).disabled).toBe(true)
    release(); await flush(w)
    expect((w.find('.sp-switch').element as HTMLButtonElement).disabled).toBe(false)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm exec vitest run src/storage/components/SnapshotPanel.test.ts`
Expected: FAIL(组件不存在)。

- [ ] **Step 3: 实现 `SnapshotPanel.vue`**

```vue
<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSnapshotStore } from '../stores/snapshot'
import { resolveSnapshotState } from '../util/snapshotView'

const props = defineProps<{ volumeUuid: string }>()
const store = useSnapshotStore()
const { t } = useI18n()

const state = computed(() => resolveSnapshotState(store.volume))

const statusText = computed(() => {
  const v = store.volume
  if (!v) return ''
  if (!v.count && !v.last_at) return t('snapNoneYet')
  const time = v.last_at ? new Date(v.last_at).toLocaleString() : t('snapNever')
  return t('snapStatus', { n: v.count, time })
})

const pausedText = computed(() => {
  const reason = store.volume?.paused_reason
  return reason ? t('snapPaused', { reason }) : ''
})

const policySummaryText = computed(() => {
  const p = store.policy
  if (!p) return ''
  return t('snapPolicySummary', { hourly: p.hourly_keep, daily: p.daily_keep, weekly: p.weekly_keep })
})

// Vue2 的 state watcher(SnapshotPanel.vue:160-164):只在"变成 enabled"这一刻拉策略,
// 每次转换只拉一次(初次加载即 enabled 也算一次转换)。
watch(state, (val, oldVal) => {
  if (val === 'enabled' && oldVal !== 'enabled') store.loadPolicy(props.volumeUuid)
})

onMounted(() => { store.loadVolume(props.volumeUuid) })

function onToggle() {
  store.toggle(props.volumeUuid, !(store.volume?.enabled ?? false))
}
</script>

<template>
  <div v-if="!store.volumeLoading" class="sp-card">
    <div class="sp-title">{{ t('snapTitle') }}</div>

    <!-- 不支持:无开关,只有一行说明(Vue2 SnapshotPanel.vue:4-9) -->
    <div v-if="state === 'unsupported'" class="sp-row sp-unsupported">
      <span class="sp-muted">{{ t('snapUnsupported') }}</span>
    </div>

    <template v-else>
      <div class="sp-row">
        <span class="sp-key">{{ t('snapTitle') }}</span>
        <button
          type="button"
          class="sp-switch"
          role="switch"
          :aria-checked="String(store.volume?.enabled === true)"
          :class="{ on: store.volume?.enabled }"
          :disabled="store.toggling"
          @click="onToggle"
        ><span class="sp-switch-thumb"></span></button>
      </div>

      <div v-if="state === 'disabled'" class="sp-row">
        <span class="sp-muted">{{ t('snapDisabledHint') }}</span>
      </div>

      <template v-if="state === 'enabled'">
        <div class="sp-row sp-status"><span class="sp-muted">{{ statusText }}</span></div>
        <div v-if="pausedText" class="sp-row sp-paused"><span>⚠️ {{ pausedText }}</span></div>
        <div class="sp-row sp-kept"><span class="sp-muted">{{ t('snapKept') }}</span></div>
        <div class="sp-row sp-policy-row">
          <div class="sp-policy-summary sp-muted">{{ policySummaryText }}</div>
          <!-- 高级设置按钮 + 表单:P5 T4 -->
        </div>
        <!-- 手动创建快照行:P5 T4 -->
      </template>

      <div v-if="state === 'disabled' && (store.volume?.count ?? 0) > 0" class="sp-row sp-kept">
        <span class="sp-muted">{{ t('snapKept') }}</span>
      </div>

      <!-- 快照历史时间线:P5 T5 -->
    </template>
  </div>
</template>

<style scoped>
/* 结构照 StorageRaidDetail 的 .rd-card —— scoped 样式不穿透子组件,与 Vue2
   SnapshotPanel 重复 .info-card 是同一个原因(见 Vue2:260-261 注释)。 */
.sp-card { background: var(--card-bg); border: 1px solid var(--card-border); border-radius: var(--radius-sm); overflow: hidden; margin-bottom: 14px; }
.sp-title { font-size: 11px; font-weight: 600; color: var(--fg-muted); text-transform: uppercase; letter-spacing: 0.4px; padding: 8px 12px; border-bottom: 1px solid var(--card-border); }
.sp-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 7px 12px; border-bottom: 1px solid var(--card-border); font-size: 12.5px; }
.sp-row:last-child { border-bottom: none; }
.sp-key { color: var(--fg-muted); }
.sp-muted { color: var(--fg-muted); font-size: 12px; }
.sp-paused { color: var(--dem-fg); font-size: 12px; }
.sp-policy-row { align-items: flex-start; }

.sp-switch {
  position: relative; width: 38px; height: 21px; flex: none; padding: 0; cursor: pointer;
  border-radius: 999px; border: 1px solid var(--chip-border); background: var(--chip-bg);
  transition: background 0.15s var(--ease), border-color 0.15s var(--ease);
}
.sp-switch.on { background: var(--accent); border-color: var(--accent); }
.sp-switch:disabled { opacity: 0.55; cursor: not-allowed; }
.sp-switch-thumb {
  position: absolute; top: 2px; left: 2px; width: 15px; height: 15px; border-radius: 50%;
  background: var(--fg); transition: transform 0.15s var(--ease);
}
.sp-switch.on .sp-switch-thumb { transform: translateX(17px); background: var(--on-accent); }
</style>
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm exec vitest run src/storage/components/SnapshotPanel.test.ts` → PASS
Run: `pnpm exec vitest run src/styles/color-guard.test.ts src/i18n/parity.test.ts` → PASS
Run: `pnpm exec vue-tsc --noEmit` → 零错

- [ ] **Step 5: Commit**

```bash
git add src/storage/components/SnapshotPanel.vue src/storage/components/SnapshotPanel.test.ts src/i18n/zh_cn.ts src/i18n/en_us.ts
git commit -m "feat(storage): 快照面板三态骨架+保护开关(P5 T3)"
```

---

### Task 4: 保留策略高级表单 + 手动创建快照(`SnapshotPanel.vue` 续)

在 T3 的面板里补齐 Vue2 `enabled` 态剩下的两块:**高级设置**(点按钮展开 → 4 个数字输入 + 逐字段校验 + 保存/取消;展开时摘要行隐藏)与**手动创建快照行**(备注输入框 + 「立即创建快照」按钮)。

**Files:**
- Modify: `src/storage/components/SnapshotPanel.vue`、`src/storage/components/SnapshotPanel.test.ts`
- Modify: `src/i18n/zh_cn.ts`、`src/i18n/en_us.ts`(附录 A 标「T4」的 9 个键)

**Interfaces:**
- Consumes: `validatePolicyForm`/`PolicyForm`(T1);`store.savePolicy`/`store.createSnapshot`/`store.policySaving`/`store.creatingSnapshot`(T2)。
- Produces: 新增稳定 class:`.sp-advanced-btn`、`.sp-advanced`(表单容器)、`.sp-in-hourly` / `.sp-in-daily` / `.sp-in-weekly` / `.sp-in-pct`(四个 `<input type="number">`)、`.sp-err-hourly` / `.sp-err-daily` / `.sp-err-weekly` / `.sp-err-pct`(错误文案)、`.sp-save`、`.sp-cancel-adv`、`.sp-label-input`、`.sp-create`。

**Vue2 逐字对照点**(`SnapshotPanel.vue:46-85` + `:209-254`):
- `openAdvanced`:表单初值取当前 policy,**缺失时用默认 24/7/4/90**(`?? `),清空 `fieldErrors`,再展开。
- `cancelAdvanced`:收起 + 清空错误(**不回写表单**)。
- `savePolicy`:先本地校验 → 有错就**只更新错误提示、不发请求**;通过则发请求,成功后收起表单。
- 保存中:保存按钮 loading + 禁用,取消按钮也禁用。
- 手动创建:输入框 `:disabled="creatingSnapshot"`,按钮 loading + 禁用;成功后**清空备注输入框**。
- 数字输入下限:hourly/daily/weekly `min=1`,阈值 `min=1 max=100`(Vue2 `b-numberinput` 的 min/max 原样落到原生 input)。

- [ ] **Step 1: 写失败测试**(追加到 `SnapshotPanel.test.ts`)

```ts
describe('SnapshotPanel 高级策略表单', () => {
  const enabledVol = [{ volume_uuid: 'u1', supported: true, enabled: true, count: 2, last_at: '2026-07-27T01:00:00Z' }]

  it('点"高级设置"→ 表单以当前策略为初值展开,摘要行让位', async () => {
    listVolumes.mockResolvedValue(enabledVol)
    const w = mountPanel(); await flush(w)
    await w.find('.sp-advanced-btn').trigger('click')
    expect(w.find('.sp-advanced').exists()).toBe(true)
    expect(w.find('.sp-policy-summary').exists()).toBe(false)
    expect((w.find('.sp-in-hourly').element as HTMLInputElement).value).toBe('24')
    expect((w.find('.sp-in-pct').element as HTMLInputElement).value).toBe('90')
  })

  it('策略缺失(getPolicy 抛错)时表单落默认值 24/7/4/90', async () => {
    listVolumes.mockResolvedValue(enabledVol)
    getPolicy.mockRejectedValue(new Error('x'))
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const w = mountPanel(); await flush(w)
    await w.find('.sp-advanced-btn').trigger('click')
    expect((w.find('.sp-in-daily').element as HTMLInputElement).value).toBe('7')
    expect((w.find('.sp-in-weekly').element as HTMLInputElement).value).toBe('4')
  })

  it('非法输入 → 显示逐字段错误且不发请求', async () => {
    listVolumes.mockResolvedValue(enabledVol)
    const w = mountPanel(); await flush(w)
    await w.find('.sp-advanced-btn').trigger('click')
    await w.find('.sp-in-hourly').setValue('0')
    await w.find('.sp-in-pct').setValue('101')
    await w.find('.sp-save').trigger('click'); await flush(w)
    expect(w.find('.sp-err-hourly').text()).toBe(zh.snapErrPositiveInt)
    expect(w.find('.sp-err-pct').text()).toBe(zh.snapErrPercent)
    expect(patchPolicy).not.toHaveBeenCalled()
    expect(w.find('.sp-advanced').exists()).toBe(true)   // 表单不收起
  })

  it('合法输入 → patchPolicy 收到四字段数字(非字符串),成功后收起表单', async () => {
    listVolumes.mockResolvedValue(enabledVol)
    patchPolicy.mockResolvedValue(null)
    const w = mountPanel(); await flush(w)
    await w.find('.sp-advanced-btn').trigger('click')
    await w.find('.sp-in-hourly').setValue('12')
    await w.find('.sp-in-daily').setValue('5')
    await w.find('.sp-in-weekly').setValue('3')
    await w.find('.sp-in-pct').setValue('80')
    await w.find('.sp-save').trigger('click'); await flush(w)
    expect(patchPolicy).toHaveBeenCalledWith('u1', { hourly_keep: 12, daily_keep: 5, weekly_keep: 3, pause_threshold_pct: 80 })
    expect(w.find('.sp-advanced').exists()).toBe(false)
    expect(w.find('.sp-policy-summary').text()).toContain('12')
  })

  it('取消 → 收起表单、错误清空、不发请求', async () => {
    listVolumes.mockResolvedValue(enabledVol)
    const w = mountPanel(); await flush(w)
    await w.find('.sp-advanced-btn').trigger('click')
    await w.find('.sp-in-hourly').setValue('0')
    await w.find('.sp-save').trigger('click'); await flush(w)
    expect(w.find('.sp-err-hourly').exists()).toBe(true)
    await w.find('.sp-cancel-adv').trigger('click')
    expect(w.find('.sp-advanced').exists()).toBe(false)
    expect(patchPolicy).not.toHaveBeenCalled()
    await w.find('.sp-advanced-btn').trigger('click')
    expect(w.find('.sp-err-hourly').exists()).toBe(false)   // 重开无残留错误
  })
})

describe('SnapshotPanel 手动创建快照', () => {
  const enabledVol = [{ volume_uuid: 'u1', supported: true, enabled: true, count: 2, last_at: '2026-07-27T01:00:00Z' }]

  it('填备注后点创建 → create 收到 {volume_uuid,label},成功后输入框清空', async () => {
    listVolumes.mockResolvedValue(enabledVol)
    createSnap.mockResolvedValue(undefined)
    const w = mountPanel(); await flush(w)
    await w.find('.sp-label-input').setValue('升级前')
    await w.find('.sp-create').trigger('click'); await flush(w)
    expect(createSnap).toHaveBeenCalledWith({ volume_uuid: 'u1', label: '升级前' })
    expect((w.find('.sp-label-input').element as HTMLInputElement).value).toBe('')
  })

  it('创建失败 → 备注保留(便于重试)', async () => {
    listVolumes.mockResolvedValue(enabledVol)
    createSnap.mockRejectedValue(new Error('x'))
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const w = mountPanel(); await flush(w)
    await w.find('.sp-label-input').setValue('升级前')
    await w.find('.sp-create').trigger('click'); await flush(w)
    expect((w.find('.sp-label-input').element as HTMLInputElement).value).toBe('升级前')
  })

  it('创建在途:按钮与输入框都禁用', async () => {
    listVolumes.mockResolvedValue(enabledVol)
    let release: (v?: unknown) => void = () => {}
    createSnap.mockImplementation(() => new Promise((r) => { release = r }))
    const w = mountPanel(); await flush(w)
    await w.find('.sp-create').trigger('click'); await w.vm.$nextTick()
    expect((w.find('.sp-create').element as HTMLButtonElement).disabled).toBe(true)
    expect((w.find('.sp-label-input').element as HTMLInputElement).disabled).toBe(true)
    release(); await flush(w)
    expect((w.find('.sp-create').element as HTMLButtonElement).disabled).toBe(false)
  })
})
```

> 注:本 Task 需要把测试文件顶部 mock 里的 `patchPolicy: vi.fn()` / `create: vi.fn()` 换成具名 mock(`const patchPolicy = vi.fn()`、`const createSnap = vi.fn()`,再在 `vi.mock` 工厂里转发),并在 `beforeEach` 里给 `patchPolicy.mockResolvedValue(null)`、`createSnap.mockResolvedValue(undefined)` 默认值——照 T3 已有 `listVolumes`/`getPolicy` 的写法。

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm exec vitest run src/storage/components/SnapshotPanel.test.ts`
Expected: FAIL(`.sp-advanced-btn` 等找不到)。

- [ ] **Step 3: 实现**

`<script setup>` 追加:
```ts
import { ref } from 'vue'
import { validatePolicyForm, type PolicyForm } from '../util/snapshotView'

const advancedOpen = ref(false)
const policyForm = ref<PolicyForm>({ hourly_keep: 24, daily_keep: 7, weekly_keep: 4, pause_threshold_pct: 90 })
const fieldErrors = ref<Partial<Record<keyof PolicyForm, string>>>({})
const manualLabel = ref('')

function openAdvanced() {
  const p = store.policy
  policyForm.value = {
    hourly_keep: Number(p?.hourly_keep ?? 24),
    daily_keep: Number(p?.daily_keep ?? 7),
    weekly_keep: Number(p?.weekly_keep ?? 4),
    pause_threshold_pct: Number(p?.pause_threshold_pct ?? 90),
  }
  fieldErrors.value = {}
  advancedOpen.value = true
}

function cancelAdvanced() {
  advancedOpen.value = false
  fieldErrors.value = {}
}

async function onSavePolicy() {
  const { valid, errors } = validatePolicyForm(policyForm.value)
  fieldErrors.value = errors
  if (!valid) return
  const ok = await store.savePolicy(props.volumeUuid, { ...policyForm.value })
  if (ok) advancedOpen.value = false
}

async function onCreateSnapshot() {
  const ok = await store.createSnapshot(props.volumeUuid, manualLabel.value)
  if (ok) manualLabel.value = ''   // Vue2 同款:只有成功才清备注
}
```

模板把 T3 的策略行与两处占位注释换成:
```vue
        <div class="sp-row sp-policy-row">
          <div class="sp-policy-wrap">
            <div v-if="!advancedOpen" class="sp-policy-summary sp-muted">{{ policySummaryText }}</div>
            <div v-else class="sp-advanced">
              <label class="sp-field">
                <span class="sp-field-label">{{ t('snapHourlyKeep') }}</span>
                <input class="sp-num sp-in-hourly" type="number" min="1" v-model.number="policyForm.hourly_keep" />
                <span v-if="fieldErrors.hourly_keep" class="sp-err sp-err-hourly">{{ t(fieldErrors.hourly_keep) }}</span>
              </label>
              <label class="sp-field">
                <span class="sp-field-label">{{ t('snapDailyKeep') }}</span>
                <input class="sp-num sp-in-daily" type="number" min="1" v-model.number="policyForm.daily_keep" />
                <span v-if="fieldErrors.daily_keep" class="sp-err sp-err-daily">{{ t(fieldErrors.daily_keep) }}</span>
              </label>
              <label class="sp-field">
                <span class="sp-field-label">{{ t('snapWeeklyKeep') }}</span>
                <input class="sp-num sp-in-weekly" type="number" min="1" v-model.number="policyForm.weekly_keep" />
                <span v-if="fieldErrors.weekly_keep" class="sp-err sp-err-weekly">{{ t(fieldErrors.weekly_keep) }}</span>
              </label>
              <label class="sp-field">
                <span class="sp-field-label">{{ t('snapPauseThreshold') }}</span>
                <input class="sp-num sp-in-pct" type="number" min="1" max="100" v-model.number="policyForm.pause_threshold_pct" />
                <span v-if="fieldErrors.pause_threshold_pct" class="sp-err sp-err-pct">{{ t(fieldErrors.pause_threshold_pct) }}</span>
              </label>
              <div class="sp-adv-actions">
                <button class="sp-save" type="button" :disabled="store.policySaving" @click="onSavePolicy">{{ t('snapSave') }}</button>
                <button class="sp-cancel-adv" type="button" :disabled="store.policySaving" @click="cancelAdvanced">{{ t('storageCancel') }}</button>
              </div>
            </div>
          </div>
          <button v-if="!advancedOpen" class="sp-advanced-btn" type="button" @click="openAdvanced">{{ t('snapAdvanced') }}</button>
        </div>

        <div class="sp-row sp-manual-row">
          <input
            class="sp-label-input"
            type="text"
            v-model="manualLabel"
            :placeholder="t('snapLabelPlaceholder')"
            :disabled="store.creatingSnapshot"
          />
          <button class="sp-create" type="button" :disabled="store.creatingSnapshot" @click="onCreateSnapshot">
            {{ t('snapCreateNow') }}
          </button>
        </div>
```

样式追加(全 token):
```css
.sp-policy-wrap { flex: 1 1 auto; min-width: 0; }
.sp-advanced { display: flex; flex-direction: column; gap: 8px; width: 100%; }
.sp-field { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 12px; color: var(--fg-muted); }
.sp-field-label { flex: 1 1 auto; }
.sp-num, .sp-label-input {
  box-sizing: border-box; padding: 5px 9px; font-size: 12.5px; border-radius: 8px;
  border: 1px solid var(--chip-border); background: var(--chip-bg); color: var(--fg); outline: none;
}
.sp-num { width: 88px; font-family: var(--num-font); }
.sp-num:focus, .sp-label-input:focus { border-color: var(--accent); }
.sp-num:disabled, .sp-label-input:disabled { opacity: 0.55; }
.sp-err { flex: 1 0 100%; color: var(--remove-fg); font-size: 11px; }
.sp-adv-actions { display: flex; gap: 8px; margin-top: 2px; }
.sp-manual-row { gap: 8px; }
.sp-label-input { flex: 1 1 auto; min-width: 0; }
.sp-advanced-btn, .sp-save, .sp-cancel-adv, .sp-create {
  padding: 5px 12px; border-radius: 999px; font-size: 12px; cursor: pointer; white-space: nowrap;
  border: 1px solid var(--chip-border); background: var(--chip-bg); color: var(--fg);
}
.sp-save, .sp-create { border-color: var(--accent); color: var(--accent); }
.sp-advanced-btn:hover, .sp-save:hover, .sp-cancel-adv:hover, .sp-create:hover { background: var(--chip-bg-hi); }
.sp-save:disabled, .sp-cancel-adv:disabled, .sp-create:disabled { opacity: 0.45; cursor: not-allowed; }
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm exec vitest run src/storage/components/SnapshotPanel.test.ts` → PASS
Run: `pnpm exec vitest run src/styles/color-guard.test.ts src/i18n/parity.test.ts` → PASS
Run: `pnpm exec vue-tsc --noEmit` → 零错

- [ ] **Step 5: Commit**

```bash
git add src/storage/components/SnapshotPanel.vue src/storage/components/SnapshotPanel.test.ts src/i18n/zh_cn.ts src/i18n/en_us.ts
git commit -m "feat(storage): 快照保留策略高级表单+手动创建快照(P5 T4)"
```

---

### Task 5: 快照历史时间线(`SnapshotTimeline.vue`)+ 嵌进面板

迁移 Vue2 `SnapshotTimeline.vue` 的**列表主体**:标题行 / 3 行骨架 / 空态双句 / 按天分组(默认展开最近 2 组,点组头折叠)/ 条目(类别圆点 + 时钟 + 类别徽章 + 备注)。**[浏览] 按钮不迁**(Global Constraints 第 1 条),条目动作区本 Task 先只留占位;删除按钮在 T6 落。然后把时间线嵌进 `SnapshotPanel`,可见性条件 1:1 照 Vue2:`enabled` 或(`disabled` 且 `count > 0`)。

**Files:**
- Create: `src/storage/components/SnapshotTimeline.vue`
- Test: `src/storage/components/SnapshotTimeline.test.ts`
- Modify: `src/storage/components/SnapshotPanel.vue`、`src/storage/components/SnapshotPanel.test.ts`
- Modify: `src/i18n/zh_cn.ts`、`src/i18n/en_us.ts`(附录 A 标「T5」的 6 个键)

**Interfaces:**
- Consumes: `useSnapshotStore()`(`snapshots`/`listLoading`/`loadSnapshots`);`groupSnapshotsByDay`/`defaultExpandedDayKeys`/`SnapshotDayGroup`(T1)。
- Produces: 组件 props `{ volumeUuid: string }`。稳定 class:根 `.st`、骨架 `.st-skeleton`、空态 `.st-empty`、组头 `.st-group-header`、组名 `.st-group-label`、组计数 `.st-group-count`、条目 `.st-item`、圆点 `.st-dot`(带 `.auto|.manual|.preop` 修饰)、徽章 `.st-badge`、时钟 `.st-time`、备注 `.st-label`。

**Vue2 逐字对照点**(`SnapshotTimeline.vue`):
- `mounted` 拉列表;`volumeUuid` 变化 → 重置展开态并重拉(`:92-104`)。
- 首次拿到非空分组时用 `defaultExpandedDayKeys` 初始化展开键,**只初始化一次**(`expandInitialized` 闸门,`:111-114`)——之后用户的折叠选择不被刷新覆盖。
- 分组头:`›` 雪佛龙(展开时旋转 90°)+ 组名(`i18nKey ? $t(key) : text`)+ 右侧计数。
- 条目 key:`item.id != null ? item.id : item.name`(`:26`)。
- 动作区 hover 才显形(`opacity` 过渡,**不是** `display:none`,保证键盘可达,Vue2 注释 `:339-341`)。

- [ ] **Step 1: 写失败测试** `src/storage/components/SnapshotTimeline.test.ts`

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import SnapshotTimeline from './SnapshotTimeline.vue'
import zh from '../../i18n/zh_cn'

const listMock = vi.fn()
vi.mock('@nimotech/nimoos-service', () => ({
  service: { snapshot: {
    list: (...a: unknown[]) => listMock(...a),
    listVolumes: vi.fn().mockResolvedValue([]), getPolicy: vi.fn(), patchPolicy: vi.fn(),
    togglePolicy: vi.fn(), create: vi.fn(), remove: vi.fn(),
  } },
}))

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const mountIt = () => mount(SnapshotTimeline, { props: { volumeUuid: 'u1' }, global: { plugins: [i18n] } })
const flush = async (w: ReturnType<typeof mountIt>) => {
  await new Promise((r) => setTimeout(r)); await w.vm.$nextTick(); await w.vm.$nextTick()
}
const day = (d: number, h: number) => new Date(2026, 6, d, h, 0).toISOString()

beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })

describe('SnapshotTimeline', () => {
  it('挂载即按卷拉列表', async () => {
    listMock.mockResolvedValue([])
    const w = mountIt(); await flush(w)
    expect(listMock).toHaveBeenCalledWith('u1')
  })
  it('加载中显示骨架、加载完不显示', async () => {
    let release: (v: unknown) => void = () => {}
    listMock.mockImplementation(() => new Promise((r) => { release = r }))
    const w = mountIt(); await w.vm.$nextTick()
    expect(w.find('.st-skeleton').exists()).toBe(true)
    release([]); await flush(w)
    expect(w.find('.st-skeleton').exists()).toBe(false)
  })
  it('空列表 → 空态双句', async () => {
    listMock.mockResolvedValue([])
    const w = mountIt(); await flush(w)
    expect(w.find('.st-empty').text()).toContain(zh.snapNoneYet)
    expect(w.find('.st-empty').text()).toContain(zh.snapEmptyHint)
  })
  it('按天分组:组头带组名与计数,最近两组默认展开、第三组收起', async () => {
    listMock.mockResolvedValue([
      { id: 1, name: 'a', type: 'auto-hourly', created_at: day(27, 9) },
      { id: 2, name: 'b', type: 'manual', label: '升级前', created_at: day(27, 20) },
      { id: 3, name: 'c', type: 'preop', created_at: day(26, 8) },
      { id: 4, name: 'd', type: 'auto-daily', created_at: day(20, 8) },
    ])
    const w = mountIt(); await flush(w)
    const headers = w.findAll('.st-group-header')
    expect(headers).toHaveLength(3)
    expect(headers[0].find('.st-group-count').text()).toBe('2')
    // 默认展开最近 2 组 = 3 条可见(2 + 1),第三组收起
    expect(w.findAll('.st-item')).toHaveLength(3)
  })
  it('点组头折叠/展开切换', async () => {
    listMock.mockResolvedValue([{ id: 1, name: 'a', type: 'manual', created_at: day(27, 9) }])
    const w = mountIt(); await flush(w)
    expect(w.findAll('.st-item')).toHaveLength(1)
    await w.find('.st-group-header').trigger('click')
    expect(w.findAll('.st-item')).toHaveLength(0)
    await w.find('.st-group-header').trigger('click')
    expect(w.findAll('.st-item')).toHaveLength(1)
  })
  it('条目渲染时钟/类别徽章/备注,类别圆点带类别修饰类', async () => {
    listMock.mockResolvedValue([{ id: 1, name: 'a', type: 'manual', label: '升级前', created_at: day(27, 9) }])
    const w = mountIt(); await flush(w)
    const item = w.find('.st-item')
    expect(item.find('.st-time').text()).toBe('09:00')
    expect(item.find('.st-badge').text()).toBe(zh.snapTypeManual)
    expect(item.find('.st-label').text()).toBe('升级前')
    expect(item.find('.st-dot').classes()).toContain('manual')
  })
  it('不渲染[浏览]入口(文件区快照套件推迟)', async () => {
    listMock.mockResolvedValue([{ id: 1, name: 'a', type: 'manual', created_at: day(27, 9) }])
    const w = mountIt(); await flush(w)
    expect(w.find('.st-browse').exists()).toBe(false)
    expect(w.text()).not.toContain(zh.filesTitle ?? '文件')
  })
  it('换卷 → 重置展开态并重拉', async () => {
    listMock.mockResolvedValue([{ id: 1, name: 'a', type: 'manual', created_at: day(27, 9) }])
    const w = mountIt(); await flush(w)
    listMock.mockClear()
    await w.setProps({ volumeUuid: 'u2' }); await flush(w)
    expect(listMock).toHaveBeenCalledWith('u2')
  })
})
```

> 注:最后一条负向断言里的 `zh.filesTitle` 只是"别把文件区文案漏进来"的兜底;若 `zh_cn.ts` 无该键,直接删掉那一行,保留 `.st-browse` 断言即可。

追加到 `SnapshotPanel.test.ts`:

```ts
describe('SnapshotPanel 内嵌时间线可见性(1:1 照 Vue2)', () => {
  it('已启用 → 时间线出现', async () => {
    listVolumes.mockResolvedValue([{ volume_uuid: 'u1', supported: true, enabled: true, count: 0 }])
    const w = mountPanel(); await flush(w)
    expect(w.findComponent({ name: 'SnapshotTimeline' }).exists()).toBe(true)
  })
  it('已关闭且有历史快照 → 时间线仍出现(保住"快照仍保留"的承诺)', async () => {
    listVolumes.mockResolvedValue([{ volume_uuid: 'u1', supported: true, enabled: false, count: 3 }])
    const w = mountPanel(); await flush(w)
    expect(w.findComponent({ name: 'SnapshotTimeline' }).exists()).toBe(true)
  })
  it('已关闭且无历史 → 无时间线;不支持 → 无时间线', async () => {
    listVolumes.mockResolvedValue([{ volume_uuid: 'u1', supported: true, enabled: false, count: 0 }])
    const w1 = mountPanel(); await flush(w1)
    expect(w1.findComponent({ name: 'SnapshotTimeline' }).exists()).toBe(false)
    listVolumes.mockResolvedValue([{ volume_uuid: 'u1', supported: false }])
    const w2 = mountPanel(); await flush(w2)
    expect(w2.findComponent({ name: 'SnapshotTimeline' }).exists()).toBe(false)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm exec vitest run src/storage/components/SnapshotTimeline.test.ts src/storage/components/SnapshotPanel.test.ts`
Expected: FAIL。

- [ ] **Step 3: 实现**

`SnapshotTimeline.vue`:
```vue
<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSnapshotStore } from '../stores/snapshot'
import { groupSnapshotsByDay, defaultExpandedDayKeys } from '../util/snapshotView'

defineOptions({ name: 'SnapshotTimeline' })
const props = defineProps<{ volumeUuid: string }>()
const store = useSnapshotStore()
const { t } = useI18n()

const expandedKeys = ref<string[]>([])
let expandInitialized = false

const groups = computed(() => groupSnapshotsByDay(store.snapshots))

// Vue2:首次拿到非空分组时才初始化默认展开(最近 2 天),之后刷新不覆盖用户的折叠选择
watch(groups, (g) => {
  if (!expandInitialized && g.length) {
    expandedKeys.value = defaultExpandedDayKeys(g)
    expandInitialized = true
  }
})

watch(() => props.volumeUuid, (uuid) => {
  expandInitialized = false
  expandedKeys.value = []
  store.loadSnapshots(uuid)
})

onMounted(() => { store.loadSnapshots(props.volumeUuid) })

const isExpanded = (dayKey: string) => expandedKeys.value.includes(dayKey)
function toggleGroup(dayKey: string) {
  expandedKeys.value = isExpanded(dayKey)
    ? expandedKeys.value.filter((k) => k !== dayKey)
    : [...expandedKeys.value, dayKey]
}
</script>

<template>
  <div class="st">
    <div class="st-header">{{ t('snapHistory') }}</div>

    <div v-if="store.listLoading" class="st-skeleton">
      <div v-for="n in 3" :key="n" class="st-skeleton-row"></div>
    </div>

    <div v-else-if="groups.length === 0" class="st-empty">
      <p>{{ t('snapNoneYet') }}</p>
      <p>{{ t('snapEmptyHint') }}</p>
    </div>

    <div v-else class="st-body">
      <div v-for="group in groups" :key="group.dayKey" class="st-group">
        <button type="button" class="st-group-header" @click="toggleGroup(group.dayKey)">
          <span class="st-chevron" :class="{ open: isExpanded(group.dayKey) }">›</span>
          <span class="st-group-label">{{ group.label.i18nKey ? t(group.label.i18nKey) : group.label.text }}</span>
          <span class="st-group-count">{{ group.items.length }}</span>
        </button>
        <ul v-if="isExpanded(group.dayKey)" class="st-list">
          <li v-for="item in group.items" :key="item.id != null ? item.id : item.name" class="st-item">
            <span class="st-dot" :class="item.typeKind"></span>
            <div class="st-info">
              <span class="st-time">{{ item.time }}</span>
              <span class="st-badge" :class="item.typeKind">{{ t(item.typeLabelKey) }}</span>
              <span v-if="item.label" class="st-label">{{ item.label }}</span>
            </div>
            <div class="st-actions">
              <!-- [浏览] 未迁:跳文件区快照只读浏览属文件区快照套件(只读横幅/禁写/退出),
                   SP4 未迁、SP6-P5 决策推迟到独立一期(见 P5 计划台账)。删除按钮:P5 T6 -->
            </div>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<style scoped>
.st { border-top: 1px solid var(--card-border); }
.st-header { padding: 8px 12px 2px; font-size: 11px; font-weight: 600; color: var(--fg-muted); text-transform: uppercase; letter-spacing: 0.4px; }
.st-empty { padding: 12px; text-align: center; }
.st-empty p { margin: 0 0 4px; font-size: 12px; color: var(--fg-muted); }
.st-skeleton { padding: 8px 12px; }
.st-skeleton-row {
  height: 14px; border-radius: 4px; margin-bottom: 8px;
  background: linear-gradient(90deg, var(--skeleton-bg) 25%, var(--nrm-bg) 37%, var(--skeleton-bg) 63%);
  background-size: 400% 100%; animation: st-shimmer 1.4s ease infinite;
}
.st-skeleton-row:last-child { margin-bottom: 0; }
.st-group:not(:last-child) { border-bottom: 1px solid var(--card-border); }
.st-group-header {
  display: flex; align-items: center; gap: 6px; width: 100%; padding: 6px 12px;
  background: none; border: none; cursor: pointer; font-family: inherit; text-align: left; color: var(--fg);
}
.st-group-header:hover { background: var(--hover); }
.st-chevron { display: inline-block; font-size: 12px; color: var(--fg-muted); transition: transform 0.15s var(--ease); }
.st-chevron.open { transform: rotate(90deg); }
.st-group-label { font-size: 12px; font-weight: 500; }
.st-group-count { margin-left: auto; font-size: 10px; font-weight: 600; color: var(--fg-muted); background: var(--nrm-bg); border-radius: 999px; padding: 0 7px; line-height: 16px; }
.st-list { position: relative; list-style: none; margin: 0; padding: 2px 12px 6px; }
.st-list::before { content: ''; position: absolute; top: 0; bottom: 10px; left: 20px; width: 1px; background: var(--card-border); }
.st-item { position: relative; display: flex; align-items: flex-start; gap: 10px; padding: 7px 0 7px 22px; border-radius: 6px; }
.st-item:hover { background: var(--hover); }
.st-item:hover .st-actions { opacity: 1; pointer-events: auto; }
.st-dot { position: absolute; left: 16px; top: 12px; width: 8px; height: 8px; border-radius: 50%; border: 2px solid var(--card-bg); box-shadow: 0 0 0 1px var(--card-border); }
.st-dot.auto { background: var(--nrm-fg); }
.st-dot.manual { background: var(--accent); }
.st-dot.preop { background: var(--dem-fg); }
.st-info { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; flex: 1 1 auto; min-width: 0; }
.st-time { font-size: 12px; font-weight: 500; font-family: var(--num-font); }
.st-badge { padding: 1px 7px; border-radius: 999px; font-size: 10px; font-weight: 500; }
.st-badge.auto { background: var(--nrm-bg); color: var(--nrm-fg); }
.st-badge.manual { background: var(--accent-soft); color: var(--accent); }
.st-badge.preop { background: var(--dem-bg); color: var(--dem-fg); }
.st-label { font-size: 12px; color: var(--fg-muted); overflow: hidden; text-overflow: ellipsis; }
/* hover 才显形,但保留在 DOM 里可 tab(Vue2 注释同款理由) */
.st-actions { display: flex; flex: none; gap: 6px; opacity: 0; pointer-events: none; transition: opacity 0.15s var(--ease); }

@keyframes st-shimmer { 0% { background-position: 100% 0; } 100% { background-position: 0 0; } }
</style>
```

`SnapshotPanel.vue`:import 组件,把 `<!-- 快照历史时间线:P5 T5 -->` 换成:
```vue
      <!-- 可见性 1:1 照 Vue2 SnapshotPanel.vue:99-102:启用时,或已关闭但仍有历史快照时 -->
      <SnapshotTimeline
        v-if="state === 'enabled' || (state === 'disabled' && (store.volume?.count ?? 0) > 0)"
        :volume-uuid="volumeUuid"
      />
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm exec vitest run src/storage/components/` → PASS
Run: `pnpm exec vitest run src/styles/color-guard.test.ts src/i18n/parity.test.ts` → PASS
Run: `pnpm exec vue-tsc --noEmit` → 零错

- [ ] **Step 5: Commit**

```bash
git add src/storage/components/SnapshotTimeline.vue src/storage/components/SnapshotTimeline.test.ts src/storage/components/SnapshotPanel.vue src/storage/components/SnapshotPanel.test.ts src/i18n/zh_cn.ts src/i18n/en_us.ts
git commit -m "feat(storage): 快照历史时间线+嵌入面板(P5 T5,浏览入口推迟)"
```

---

### Task 6: 删除快照 —— 确认弹窗 + 时间线接线

Vue2 用 `$buefy.dialog.confirm` 弹一个 danger 确认框(标题「删除快照」、正文「仅删除 {time} 的这个快照,你当前的文件不受影响。」、确认「删除」/取消)。New-UI 无该原语 → 新建 `SnapshotDeleteDialog.vue`(复用 `src/components/ui/Dialog.vue` 底座,照 `RaidDeleteDialog.vue` 骨架,但**不做 type-to-confirm**——删单个快照不是删阵列,确认强度照 Vue2 保持一次点击确认)。时间线条目动作区加删除按钮。

**Files:**
- Create: `src/storage/components/SnapshotDeleteDialog.vue`
- Test: `src/storage/components/SnapshotDeleteDialog.test.ts`
- Modify: `src/storage/components/SnapshotTimeline.vue`、`src/storage/components/SnapshotTimeline.test.ts`
- Modify: `src/i18n/zh_cn.ts`、`src/i18n/en_us.ts`(附录 A 标「T6」的 3 个键)

**Interfaces:**
- Consumes: `Dialog`(`../../components/ui/Dialog.vue`);`store.removeSnapshot`/`store.deletingName`(T2)。
- Produces:
  - `SnapshotDeleteDialog` props `{ open: boolean; timeText: string; busy?: boolean }`,emits `{ (e:'update:open', v: boolean): void; (e:'confirm'): void }`(无 payload——目标由父组件持有)。稳定 class:`.sdd-msg`、`.sdd-ok`、`.sdd-cancel`。
  - `SnapshotTimeline` 条目动作区新增 `.st-delete` 按钮。

- [ ] **Step 1: 写失败测试**

`src/storage/components/SnapshotDeleteDialog.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import SnapshotDeleteDialog from './SnapshotDeleteDialog.vue'
import zh from '../../i18n/zh_cn'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const mountIt = (props: Record<string, unknown> = {}) =>
  mount(SnapshotDeleteDialog, {
    props: { open: true, timeText: '2026/7/27 09:00:00', ...props },
    global: { plugins: [i18n] },
    attachTo: document.body,
  })

beforeEach(() => { document.body.innerHTML = '' })

describe('SnapshotDeleteDialog', () => {
  it('正文含被删快照的时间,并说明当前文件不受影响', async () => {
    const w = mountIt(); await w.vm.$nextTick()
    const msg = document.body.querySelector('.sdd-msg') as HTMLElement
    expect(msg.textContent).toContain('2026/7/27 09:00:00')
  })
  it('点删除 → emit confirm(无 payload)', async () => {
    const w = mountIt(); await w.vm.$nextTick()
    ;(document.body.querySelector('.sdd-ok') as HTMLButtonElement).click()
    expect(w.emitted('confirm')).toHaveLength(1)
    expect(w.emitted('confirm')![0]).toEqual([])
  })
  it('点取消 → emit update:open(false),不 emit confirm', async () => {
    const w = mountIt(); await w.vm.$nextTick()
    ;(document.body.querySelector('.sdd-cancel') as HTMLButtonElement).click()
    expect(w.emitted('update:open')![0]).toEqual([false])
    expect(w.emitted('confirm')).toBeUndefined()
  })
  it('busy 时两个按钮都禁用(防连点)', async () => {
    const w = mountIt({ busy: true }); await w.vm.$nextTick()
    expect((document.body.querySelector('.sdd-ok') as HTMLButtonElement).disabled).toBe(true)
    expect((document.body.querySelector('.sdd-cancel') as HTMLButtonElement).disabled).toBe(true)
  })
})
```

追加到 `SnapshotTimeline.test.ts`:
```ts
describe('SnapshotTimeline 删除', () => {
  const one = [{ id: 1, name: '20260727T090000Z_manual_升级前', type: 'manual', created_at: day(27, 9) }]

  it('条目有删除按钮;点击弹确认框(此时还没发请求)', async () => {
    listMock.mockResolvedValue(one)
    const w = mountIt(); await flush(w)
    expect(w.find('.st-delete').exists()).toBe(true)
    await w.find('.st-delete').trigger('click'); await flush(w)
    expect(document.body.querySelector('.sdd-ok')).not.toBeNull()
    expect(removeMock).not.toHaveBeenCalled()
  })

  it('确认后才发 remove(name, uuid),成功则该条从列表消失', async () => {
    listMock.mockResolvedValue(one)
    removeMock.mockResolvedValue(undefined)
    const w = mountIt(); await flush(w)
    await w.find('.st-delete').trigger('click'); await flush(w)
    ;(document.body.querySelector('.sdd-ok') as HTMLButtonElement).click()
    await flush(w)
    expect(removeMock).toHaveBeenCalledWith('20260727T090000Z_manual_升级前', 'u1')
    expect(w.findAll('.st-item')).toHaveLength(0)
  })

  it('取消 → 不发请求,条目还在', async () => {
    listMock.mockResolvedValue(one)
    const w = mountIt(); await flush(w)
    await w.find('.st-delete').trigger('click'); await flush(w)
    ;(document.body.querySelector('.sdd-cancel') as HTMLButtonElement).click()
    await flush(w)
    expect(removeMock).not.toHaveBeenCalled()
    expect(w.findAll('.st-item')).toHaveLength(1)
  })
})
```
> 注:`SnapshotTimeline.test.ts` 顶部 mock 里的 `remove: vi.fn()` 要改成具名 `const removeMock = vi.fn()` 并在工厂里转发;`beforeEach` 里加 `document.body.innerHTML = ''`(弹窗走 portal 挂 body,不清会串味——`FormatDialog.test.ts` 同款处理)。

- [ ] **Step 2: 运行测试确认失败** → FAIL。

- [ ] **Step 3: 实现**

`SnapshotDeleteDialog.vue`:
```vue
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import Dialog from '../../components/ui/Dialog.vue'

defineProps<{ open: boolean; timeText: string; busy?: boolean }>()
const emit = defineEmits<{ (e: 'update:open', v: boolean): void; (e: 'confirm'): void }>()
const { t } = useI18n()
</script>

<template>
  <Dialog :open="open" :title="t('snapDeleteTitle')" @update:open="emit('update:open', $event)">
    <p class="sdd-msg">{{ t('snapDeleteMsg', { time: timeText }) }}</p>
    <template #footer>
      <button class="sdd-cancel" type="button" :disabled="busy" @click="emit('update:open', false)">{{ t('storageCancel') }}</button>
      <button class="sdd-ok" type="button" :disabled="busy" @click="emit('confirm')">{{ t('snapDelete') }}</button>
    </template>
  </Dialog>
</template>

<style scoped>
.sdd-msg { margin: 0; font-size: 14px; color: var(--fg-muted); }
.sdd-cancel, .sdd-ok {
  padding: 7px 16px; border-radius: 999px; border: 1px solid var(--chip-border);
  background: var(--chip-bg); color: var(--fg); cursor: pointer; font-size: 13px;
}
.sdd-ok { color: var(--remove-fg); border-color: var(--remove-fg); }
.sdd-cancel:disabled, .sdd-ok:disabled { opacity: 0.45; cursor: not-allowed; }
</style>
```

`SnapshotTimeline.vue`:
```ts
import SnapshotDeleteDialog from './SnapshotDeleteDialog.vue'
import type { SnapshotItemView } from '../util/snapshotView'

const deleteOpen = ref(false)
const deleteTarget = ref<SnapshotItemView | null>(null)
// 弹窗正文里的时间:Vue2 用 new Date(item.createdAt).toLocaleString()
const deleteTimeText = computed(() =>
  deleteTarget.value ? new Date(deleteTarget.value.createdAt).toLocaleString() : '',
)

function confirmDelete(item: SnapshotItemView) {
  deleteTarget.value = item
  deleteOpen.value = true
}

async function onDeleteConfirmed() {
  const target = deleteTarget.value
  if (!target) return
  const ok = await store.removeSnapshot(props.volumeUuid, target.name)
  if (ok) { deleteOpen.value = false; deleteTarget.value = null }
}
```
动作区占位注释换成:
```vue
            <div class="st-actions">
              <!-- [浏览] 未迁:文件区快照只读浏览套件推迟到独立一期(见 P5 计划台账) -->
              <button
                class="st-delete"
                type="button"
                :disabled="store.deletingName !== null"
                @click="confirmDelete(item)"
              >{{ t('snapDelete') }}</button>
            </div>
```
根节点末尾挂弹窗:
```vue
    <SnapshotDeleteDialog
      :open="deleteOpen"
      :time-text="deleteTimeText"
      :busy="store.deletingName !== null"
      @update:open="deleteOpen = $event"
      @confirm="onDeleteConfirmed"
    />
```
样式补:
```css
.st-delete {
  padding: 3px 10px; border-radius: 999px; font-size: 11px; cursor: pointer;
  border: 1px solid var(--remove-fg); background: var(--chip-bg); color: var(--remove-fg);
}
.st-delete:disabled { opacity: 0.45; cursor: not-allowed; }
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm exec vitest run src/storage/` → PASS
Run: `pnpm exec vitest run src/styles/color-guard.test.ts src/i18n/parity.test.ts` → PASS
Run: `pnpm exec vue-tsc --noEmit` → 零错

- [ ] **Step 5: Commit**

```bash
git add src/storage/components/SnapshotDeleteDialog.vue src/storage/components/SnapshotDeleteDialog.test.ts src/storage/components/SnapshotTimeline.vue src/storage/components/SnapshotTimeline.test.ts src/i18n/zh_cn.ts src/i18n/en_us.ts
git commit -m "feat(storage): 删除快照确认弹窗+时间线接线(P5 T6)"
```

---

### Task 7: 接进 RAID 详情页 + 收尾门

把面板填进 `StorageRaidDetail.vue` 左栏的 `<!-- 快照面板 P5 -->` 占位处,并锁死两件事:**卷 UUID 正确传入**、**快照端点 404 不影响详情页其余部分**。

**Files:**
- Modify: `src/views/StorageRaidDetail.vue`(`:184`)
- Modify: `src/views/StorageRaidDetail.test.ts`

**Interfaces:**
- Consumes: `SnapshotPanel`(T3–T5);详情页已有的 `array.uuid`(`raidView.asRaidArray` 保证是 string,缺失为 `''`)。

- [ ] **Step 1: 写失败测试**(追加到 `StorageRaidDetail.test.ts`)

先在该文件顶部的 `vi.mock('@nimotech/nimoos-service', …)` 工厂里补 snapshot 域(现有 mock 只有 storage/disks/raid,不补会在挂载时抛 `Cannot read properties of undefined`):
```ts
const snapListVolumes = vi.fn().mockResolvedValue([])
const snapList = vi.fn().mockResolvedValue([])
// …在 vi.mock 工厂的 service 对象里加:
//   snapshot: { listVolumes: (...a: unknown[]) => snapListVolumes(...a),
//               list: (...a: unknown[]) => snapList(...a),
//               getPolicy: vi.fn().mockResolvedValue({}), patchPolicy: vi.fn(),
//               togglePolicy: vi.fn(), create: vi.fn(), remove: vi.fn() },
```
用例:
```ts
it('左栏挂载快照面板,并按本阵列 uuid 查卷', async () => {
  snapListVolumes.mockResolvedValue([{ volume_uuid: 'u-7', supported: true, enabled: true, count: 1, last_at: '2026-07-27T01:00:00Z' }])
  await router.push('/storage/raid/7'); await router.isReady()
  const store = (await import('../storage/stores/storage')).useStorageStore()
  await store.loadRaid()
  const w = mount(StorageRaidDetail, { global: { plugins: [router, i18n] } })
  await new Promise((r) => setTimeout(r)); await w.vm.$nextTick(); await w.vm.$nextTick()
  expect(w.findComponent({ name: 'SnapshotPanel' }).exists()).toBe(true)
  expect(w.find('.sp-switch').attributes('aria-checked')).toBe('true')
})

it('快照端点 404 → 面板落"不支持"态,详情页其余内容照常渲染', async () => {
  snapListVolumes.mockRejectedValue(new Error('404'))
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  await router.push('/storage/raid/7'); await router.isReady()
  const store = (await import('../storage/stores/storage')).useStorageStore()
  await store.loadRaid()
  const w = mount(StorageRaidDetail, { global: { plugins: [router, i18n] } })
  await new Promise((r) => setTimeout(r)); await w.vm.$nextTick(); await w.vm.$nextTick()
  expect(w.find('.sp-unsupported').exists()).toBe(true)
  expect(w.text()).toContain('md7')          // 阵列名还在
  expect(w.text()).toContain('/dev/sda')     // 成员列表还在
  expect(w.find('.rd-delete').exists()).toBe(true)
})
```

- [ ] **Step 2: 运行测试确认失败** → FAIL(面板未挂载)。

- [ ] **Step 3: 实现接线**

`StorageRaidDetail.vue`:
```ts
import SnapshotPanel from '../storage/components/SnapshotPanel.vue'
```
把 `:184` 的 `<!-- 快照面板 P5 -->` 换成:
```vue
          <SnapshotPanel :volume-uuid="array.uuid ?? ''" />
```
> `SnapshotPanel` 需 `defineOptions({ name: 'SnapshotPanel' })`(测试用 `findComponent({ name })` 定位);若 T3 未加,在此补上。

- [ ] **Step 4: 收尾门(全部要跑,贴输出)**

```bash
pnpm test                                   # 全量,全绿
pnpm exec vue-tsc --noEmit                  # 零错
pnpm exec vitest run src/styles/color-guard.test.ts src/i18n/parity.test.ts
pnpm build                                  # dist 重建
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:5273/app/   # 期望 200
```
5273 常驻预览挂了就重起:
```bash
cd /home/nimo/NimoTech/.sp6/NimoOS-New-UI && nohup pnpm exec vite preview --host > ../preview-5273.log 2>&1 &
```

- [ ] **Step 5: Commit**

```bash
git add src/views/StorageRaidDetail.vue src/views/StorageRaidDetail.test.ts
git commit -m "feat(storage): RAID 详情页挂载快照面板(P5 T7)"
```

---

## 收尾门(所有 Task 完成后)

1. `pnpm test` 全量全绿 + `pnpm exec vue-tsc --noEmit` 零错 + color-guard(零裸色)+ parity(键对齐)。
2. `pnpm build` 重建 dist;5273 常驻 vite preview 自动伺服新哈希(curl 核对 `index-*.js` 哈希与 dist 一致)。
3. **可眼验的**(单盘设备):`/storage/raid` 空态、详情页路由本身;**不可眼验的**:快照面板本体(需 ≥2 盘 btrfs 阵列 + 新后端)——按用户 2026-07-27 拍板,**以单测 + 整支终审为准,面板眼验挂账**。
4. 整支终审(Opus,base = P4 关账 `cc5adf0` + 本计划 commit)→ Ready to merge 判定后关账。**禁区**:不部署、不合并、不改 roadmap(P6)。

## Ledger 挂账(收尾写进 `.superpowers/sdd/progress.md`)

1. **文件区快照套件整体未迁(新登记,SP4 遗留缺口)**:`SnapshotBanner.vue` / `SnapshotTimeWheel.vue`(621 行)/ `SnapshotActionBar.vue` / `SnapshotSettingsModal.vue` / `snapshotBrowse.js` / `snapshotStackMath.js` + `FilePanel.vue`/`ContextMenu.vue` 里的只读浏览分支 + `service/snapshot.js` 六个路径纯函数 + 后端 `GET /v2/snapshot/file-versions` + `POST /v2/snapshot/restore`。**因此时间线的 [浏览] 按钮本期缺席**。建议作为独立一期(SP6-P5b 或并入文件区后续期)。
2. **后端未部署**:设备 `nimoos-local-storage` 仍是 2026-06-22 版,`/v2/snapshot/*` 全 404;P5 代码走优雅降级(面板显示"不支持")。部署时机由用户定。
3. **快照卷 == RAID 阵列**(后端 `currentVolumes()` = `VolumesFromRAIDArrays`):单盘设备无阵列 → 无快照卷,面板无法实盘验收,随多盘设备与 P3/P4 一并补。
4. **Vue2 bug 已修正不照抄**:`savePolicy` 后摘要显示 `undefined`(后端 PUT 返回 `data:null`,Vue2 把信封当策略对象)。New-UI 用刚保存的表单值合并本地 policy。
5. **有意偏离**:slot+`refreshSignal`+`@deleted` 三段式 → store 直连;校验错误文案从"英文原文当键"→ 具名 i18n key;`b-switch`/`b-numberinput`/`$buefy.dialog.confirm` → 手写开关 / 原生 number input / 共享 `Dialog`;manual 类别色由紫改 `--accent`、preop 由琥珀改 `--dem-fg`(主题 token 化的必然结果)。
6. **`service.snapshot.restore()` 与 `updatePolicy()` 本期无调用方**(restore 属文件区;updatePolicy 只经 `patchPolicy` 间接使用)——不是死代码,是下一期的接口面。

---

## 附录 A:P5 新增 i18n key(zh_cn / en_us 双写)

| Task | key | zh_cn | en_us |
|---|---|---|---|
| T2 | `snapToggleOn` | 已开启快照保护 | Snapshot protection enabled |
| T2 | `snapToggleOff` | 已关闭快照保护 | Snapshot protection disabled |
| T2 | `snapToggleFailed` | 快照保护设置失败 | Failed to update snapshot protection |
| T2 | `snapPolicySaved` | 快照计划已更新 | Snapshot schedule updated |
| T2 | `snapPolicySaveFailed` | 快照计划更新失败 | Failed to update snapshot schedule |
| T2 | `snapCreated` | 快照已创建 | Snapshot created |
| T2 | `snapCreateFailed` | 快照创建失败 | Failed to create snapshot |
| T2 | `snapDeleted` | 快照已删除 | Snapshot deleted |
| T2 | `snapDeleteFailed` | 快照删除失败 | Failed to delete snapshot |
| T3 | `snapTitle` | 快照保护 | Snapshot Protection |
| T3 | `snapUnsupported` | 此卷的文件系统不支持快照 | This volume's filesystem does not support snapshots |
| T3 | `snapDisabledHint` | 自动为此卷创建快照,可随时恢复到过去的某个时间点 | Automatically snapshot this volume so you can restore from an earlier point in time |
| T3 | `snapNoneYet` | 暂无快照 | No snapshots yet |
| T3 | `snapNever` | 从未 | Never |
| T3 | `snapStatus` | 已有 {n} 个快照 · 最近 {time} | {n} snapshots so far · last at {time} |
| T3 | `snapPaused` | 快照保护已暂停:{reason}。请释放此卷空间或调低保留数量以恢复自动快照。 | Snapshot protection paused: {reason}. Free up space on this volume or lower the retention counts to resume automatic snapshots. |
| T3 | `snapKept` | 关闭保护后,已有快照仍会保留 | Existing snapshots are kept when protection is turned off |
| T3 | `snapPolicySummary` | 每小时快照:保留 {hourly} · 每天:保留 {daily} · 每周:保留 {weekly} | Hourly snapshots: keep {hourly} · Daily: keep {daily} · Weekly: keep {weekly} |
| T4 | `snapAdvanced` | 高级设置 | Advanced settings |
| T4 | `snapHourlyKeep` | 每小时保留数 | Hourly keep count |
| T4 | `snapDailyKeep` | 每天保留数 | Daily keep count |
| T4 | `snapWeeklyKeep` | 每周保留数 | Weekly keep count |
| T4 | `snapPauseThreshold` | 卷使用率超过多少时暂停(%) | Pause when volume usage exceeds (%) |
| T4 | `snapErrPositiveInt` | 必须是大于 0 的整数 | Must be a positive whole number |
| T4 | `snapErrPercent` | 必须是 1 到 100 之间的整数 | Must be a whole number between 1 and 100 |
| T4 | `snapSave` | 保存 | Save |
| T4 | `snapCreateNow` | 立即创建快照 | Create Snapshot Now |
| T4 | `snapLabelPlaceholder` | 可选备注(例如:升级前) | Optional note (e.g. before upgrade) |
| T5 | `snapHistory` | 快照历史 | Snapshot History |
| T5 | `snapEmptyHint` | 创建第一个快照,开始积累可恢复的历史 | Create your first snapshot to start building a restore history |
| T5 | `snapToday` | 今天 | Today |
| T5 | `snapYesterday` | 昨天 | Yesterday |
| T5 | `snapTypeAuto` | 自动 | Auto |
| T5 | `snapTypeManual` | 手动 | Manual |
| T5 | `snapTypePreop` | 操作前保护 | Pre-op protection |
| T6 | `snapDelete` | 删除 | Delete |
| T6 | `snapDeleteTitle` | 删除快照 | Delete Snapshot |
| T6 | `snapDeleteMsg` | 仅删除 {time} 的这个快照,你当前的文件不受影响。 | This deletes only the snapshot from {time}. Your current files are not affected. |

> 「取消」复用 P2 已有的 `storageCancel`,不新增。

## 附录 B:Vue2 源文件坐标(逐字核对用)

- `NimoOS-UI/src/service/snapshot.js`:纯函数 `:1-137`(迁)、`:139-230` 路径函数(**不迁**)、`:232-284` API 对象(已在 P0 进包)。
- `NimoOS-UI/src/components/Storage/raid/SnapshotPanel.vue`:模板 `:1-105`、逻辑 `:107-257`、样式 `:259-303`。
- `NimoOS-UI/src/components/Storage/raid/SnapshotTimeline.vue`:模板 `:1-50`、逻辑 `:52-179`、样式 `:181-362`。
- `NimoOS-UI/src/components/Storage/raid/RaidDetailPanel.vue:80-89`:面板与时间线在 Vue2 里的挂载与接线(slot + refreshSignal + @deleted)。
- 后端:`NimoOS-LocalStorage/route/snapshot.go`(`:71-78` 路由表、`:300-336` PUT policy 返回 `data:nil`、`:133-143` `currentVolumes()` = RAID 阵列)。
