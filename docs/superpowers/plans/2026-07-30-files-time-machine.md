# 文件区时间机器(快照只读浏览套件)Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 Vue2 文件区快照套件(≈1400 行,SP4 遗留缺口)整套迁到 New-UI:全屏时间机器覆盖层(新视觉)+ 只读浏览闭环 + 恢复 + 设置弹窗。

**Architecture:** 纯路径/数学逻辑先落成可单测的 TS 纯函数(`files/util/`),浏览态与卷列表缓存收在一个 Pinia store(`files/stores/snapshotBrowse.ts`),UI 拆成 5 个时间机器组件 + 3 个浏览态组件,快照数据读写全部复用 SP6-P5 已有的 `storage/stores/snapshot.ts` 与 `storage/util/snapshotView.ts`,不新建第二套。

**Tech Stack:** Vue 3 `<script setup>` + TypeScript(strict)· Pinia · vue-i18n 9 · vitest + @vue/test-utils · 纯 CSS transform 动效(无动画库)· `@nimotech/nimoos-service` 共享包。

**Spec:** `docs/superpowers/specs/2026-07-30-files-time-machine-design.md`(每个任务的取舍理由都在里面,遇到判断分歧以 spec 为准)。

## Global Constraints

以下是全局要求,**每个任务都隐含包含**:

1. **颜色零硬编码**(CLAUDE.md 硬约束):任何 `<style>` 里出现新的 `#hex` / `rgb()` / `rgba()` / 具名色都算违规,必须用 `var(--token)`;新语义 token 要在 `src/styles/theme.css` 的 `:root`(深色)与 `:root[data-theme="light"]`(浅色)**两个块里都给值**。
2. **i18n 双语同步**:新增文案键必须同时加到 `src/i18n/zh_cn.ts` 和 `src/i18n/en_us.ts`,否则 `src/i18n/parity.test.ts` 直接红。默认中文,英文照写。
3. **包管理器 pnpm**,不用 yarn/npm。测试 `pnpm test`,类型检查 `pnpm exec vue-tsc --noEmit`。
4. **测试与实现同目录**:`Foo.vue` 的测试是 `Foo.test.ts`,`bar.ts` 的测试是 `bar.test.ts`。
5. **移植纪律**(既定长期约定):界面严格照 Vue2 视觉的部分不擅自改;**但 Vue2 的 bug/竞态/吞错不照抄**,改成正确逻辑并在代码里注释登记。本计划中有意偏离的 6 条已在 spec §4 列全,实现时逐条写注释。
6. **不引入新依赖**:动效一律纯 CSS `transform` + `transition`,不装 framer-motion / motion-v / GSAP。
7. **不新建第二套快照数据层**:快照列表/策略/开关/建删一律走 `src/storage/stores/snapshot.ts`;分组、时间格式、类型分类一律走 `src/storage/util/snapshotView.ts`。
8. **fail-safe 方向不得反转**:`shouldGuardSnapshotView` 只有在「卷列表已 ready + 精确匹配到该挂载点 + `supported === false`」时才解除只读锁;idle / loading / error / 未命中 四种情况一律**保持锁定**。
9. **后端契约**:`POST /v2/snapshot/restore` 的 `path` 相对**卷根**(不是相对快照目录);`PUT /v2/snapshot/policy` 是全量替换,写策略必须走 `patchPolicy` 读-改-写。
10. **本机无法实盘验证**(`/DATA` 是 ext4 单盘,快照卷只从 RAID 阵列派生,`GET /v2/snapshot/volumes` 恒返回空数组)。验收靠单测 + 假后端测试台 + 双主题截图,不要试图在真机上造真实快照。

---

## 文件结构

**新建**:

| 文件 | 职责 |
|---|---|
| `src/files/util/snapshotPath.ts` | 9 个路径纯函数(从 Vue2 逐字移植) |
| `src/files/util/snapshotPath.test.ts` | 同上测试 |
| `src/files/util/timeMachineMath.ts` | 鱼眼曲线 / 可见卡切片 / 步进夹紧 / 刻度节点 |
| `src/files/util/timeMachineMath.test.ts` | 同上测试 |
| `src/files/util/snapshotRestore.ts` | `performSnapshotRestore` / `blockedBySnapshotView` |
| `src/files/util/snapshotRestore.test.ts` | 同上测试 |
| `src/files/stores/snapshotBrowse.ts` | 卷列表缓存 + 浏览态派生 + 时间机器开关 + 恢复编排 |
| `src/files/stores/snapshotBrowse.test.ts` | 同上测试 |
| `src/files/snapshot/SnapshotBanner.vue` | 只读横幅 |
| `src/files/snapshot/SnapshotSelectionToolbar.vue` | 快照内选中工具条(恢复 + 下载) |
| `src/files/snapshot/TimeMachineOverlay.vue` | 全屏壳:三态 / 键盘 / 齿轮 / 编排 |
| `src/files/snapshot/TimeMachineDeck.vue` | 3D 卡堆 |
| `src/files/snapshot/TimeMachineCard.vue` | 单卡 |
| `src/files/snapshot/TimeMachineRail.vue` | 右侧刻度尺 |
| `src/files/snapshot/TimeMachineBar.vue` | 底栏 |
| `src/files/snapshot/SnapshotSettingsDialog.vue` | 齿轮设置弹窗 |
| `src/files/composables/useDeckPreview.ts` | 卡片目录预览拉取 + 缓存 + 降级 |
| 以上每个 `.vue` 的 `.test.ts` | 组件测试 |

**修改**:

| 文件 | 改什么 |
|---|---|
| `src/styles/theme.css` | 新增 `--tm-*` token(两套主题) |
| `src/views/Files.vue` | 入口 chip、覆盖层挂载、横幅、写入 chip 条件隐藏、选中工具条切换、投放 guard |
| `src/files/composables/useFileOps.ts` | 5 个写方法开头加 guard |
| `src/files/components/FileContextMenu.vue` | 快照态菜单裁剪 + 「恢复到原位置」 |
| `src/storage/components/SnapshotTimeline.vue` | `[浏览]` 按钮接回(跳文件区深链) |
| `src/i18n/zh_cn.ts` / `src/i18n/en_us.ts` | 新文案键 |

## 任务依赖顺序

```
T1 路径纯函数 ──┬─> T3 store ──┬─> T4 横幅+退出 ──> T5 禁写 ──> T6 恢复
                │              │
T2 数学纯函数 ──┼──────────────┴─> T7 时间机器骨架(含 token)──> T8 卡堆 ──> T9 卡片预览 ──> T10 刻度尺
                │
                └─> T11 设置弹窗 ──> T12 [浏览] 接回 + 收尾门禁
```

T4–T6 与 T7–T10 都改 `Files.vue`,**串行执行,不并行分派**。

---

### Task 1: 路径纯函数(`snapshotPath.ts`)

从 Vue2 `NimoOS-UI/src/service/snapshot.js` 与 `components/filebrowser/snapshotBrowse.js` **逐字移植** 9 个纯函数并补 TS 类型。判定逻辑、返回形状、fail-safe 方向一律不得改。

**Files:**
- Create: `src/files/util/snapshotPath.ts`
- Test: `src/files/util/snapshotPath.test.ts`

**Interfaces:**
- Consumes: 无(纯函数,零依赖)
- Produces:
  ```ts
  export interface SnapshotBrowseInfo { mount: string; snapshotName: string; relPath: string }
  export interface SnapshotVolumeLike { volume_uuid?: string; mount?: string; supported?: boolean; [k: string]: unknown }
  export interface VolumesState { status: 'idle' | 'loading' | 'ready' | 'error'; volumes: SnapshotVolumeLike[] }
  export const SNAPSHOTS_DIR_NAME = '.snapshots'
  export function snapshotBrowsePath(mount: string, snapshotName: string): string
  export function parseSnapshotBrowsePath(absPath: string | null | undefined): SnapshotBrowseInfo | null
  export function liveVolumePath(mount: string, relPath: string): string
  export function parseSnapshotName(name: string | null | undefined): { createdAt: Date } | null
  export function formatSnapshotBannerTime(name: string): string
  export function findVolumeForPath(volumes: SnapshotVolumeLike[], path: string): SnapshotVolumeLike | null
  export function findVolumeUuidForMount(volumes: SnapshotVolumeLike[], mount: string): string | null
  export function shouldGuardSnapshotView(parsed: SnapshotBrowseInfo | null, state: VolumesState | null | undefined): boolean
  export function resolveExitTarget(info: SnapshotBrowseInfo | null, dirExists: (p: string) => Promise<boolean>): Promise<string | null>
  ```

- [ ] **Step 1: 写失败测试**

创建 `src/files/util/snapshotPath.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import {
  snapshotBrowsePath, parseSnapshotBrowsePath, liveVolumePath, parseSnapshotName,
  formatSnapshotBannerTime, findVolumeForPath, findVolumeUuidForMount,
  shouldGuardSnapshotView, resolveExitTarget,
} from './snapshotPath'

describe('snapshotBrowsePath', () => {
  it('拼成 <挂载点>/.snapshots/<快照名>', () => {
    expect(snapshotBrowsePath('/DATA', '20260713T061900Z_manual_x')).toBe('/DATA/.snapshots/20260713T061900Z_manual_x')
  })
})

describe('parseSnapshotBrowsePath', () => {
  it('拆出 mount / snapshotName / relPath', () => {
    expect(parseSnapshotBrowsePath('/DATA/.snapshots/snap1/Photos/2024')).toEqual({
      mount: '/DATA', snapshotName: 'snap1', relPath: 'Photos/2024',
    })
  })
  it('快照根 relPath 为空串', () => {
    expect(parseSnapshotBrowsePath('/DATA/.snapshots/snap1')).toEqual({ mount: '/DATA', snapshotName: 'snap1', relPath: '' })
  })
  it('容忍末尾斜杠', () => {
    expect(parseSnapshotBrowsePath('/DATA/.snapshots/snap1/')).toEqual({ mount: '/DATA', snapshotName: 'snap1', relPath: '' })
  })
  it('段匹配而非子串匹配:名字里含 .snapshots 的普通目录不误判', () => {
    expect(parseSnapshotBrowsePath('/DATA/my.snapshotsbackup/x')).toBeNull()
  })
  it('多个 .snapshots 段取最左边那个(外层才是挂载边界)', () => {
    expect(parseSnapshotBrowsePath('/DATA/.snapshots/snap1/inner/.snapshots/deep')).toEqual({
      mount: '/DATA', snapshotName: 'snap1', relPath: 'inner/.snapshots/deep',
    })
  })
  it('没有挂载点前缀(以 /.snapshots 开头)返回 null', () => {
    expect(parseSnapshotBrowsePath('/.snapshots/snap1')).toBeNull()
  })
  it('.snapshots 自身(没选中任何快照)返回 null', () => {
    expect(parseSnapshotBrowsePath('/DATA/.snapshots')).toBeNull()
  })
  it('空值/非字符串返回 null', () => {
    expect(parseSnapshotBrowsePath('')).toBeNull()
    expect(parseSnapshotBrowsePath(null)).toBeNull()
  })
})

describe('liveVolumePath', () => {
  it('有相对路径就拼上', () => { expect(liveVolumePath('/DATA', 'Photos/2024')).toBe('/DATA/Photos/2024') })
  it('相对路径为空则回卷根', () => { expect(liveVolumePath('/DATA', '')).toBe('/DATA') })
})

describe('parseSnapshotName', () => {
  it('解析 ISO8601 basic 时间戳段', () => {
    const r = parseSnapshotName('20260713T061900Z_manual_改版前')
    expect(r?.createdAt.toISOString()).toBe('2026-07-13T06:19:00.000Z')
  })
  it('类型段不做校验:未知类型仍解析出时间', () => {
    expect(parseSnapshotName('20260713T061900Z_unknown')?.createdAt.toISOString()).toBe('2026-07-13T06:19:00.000Z')
  })
  it('格式不对返回 null 而不是抛错', () => {
    expect(parseSnapshotName('not-a-snapshot')).toBeNull()
    expect(parseSnapshotName('')).toBeNull()
  })
})

describe('formatSnapshotBannerTime', () => {
  it('解析失败时回退成原始名字,而不是空白', () => {
    expect(formatSnapshotBannerTime('weird-name')).toBe('weird-name')
  })
  it('解析成功时返回本地化时间串(非原始名)', () => {
    expect(formatSnapshotBannerTime('20260713T061900Z_manual')).not.toBe('20260713T061900Z_manual')
  })
})

describe('findVolumeForPath', () => {
  const vols = [
    { mount: '/DATA', volume_uuid: 'u-data' },
    { mount: '/DATA/sub', volume_uuid: 'u-sub' },
  ]
  it('取最长匹配的挂载前缀', () => {
    expect(findVolumeForPath(vols, '/DATA/sub/x')?.volume_uuid).toBe('u-sub')
    expect(findVolumeForPath(vols, '/DATA/other')?.volume_uuid).toBe('u-data')
  })
  it('挂载点自身也算命中', () => {
    expect(findVolumeForPath(vols, '/DATA')?.volume_uuid).toBe('u-data')
  })
  it('只是名字前缀相同不算命中(/DATAX 不属于 /DATA)', () => {
    expect(findVolumeForPath(vols, '/DATAX/y')).toBeNull()
  })
  it('非法输入返回 null', () => {
    expect(findVolumeForPath(vols, '')).toBeNull()
    expect(findVolumeForPath(null as never, '/DATA')).toBeNull()
  })
})

describe('findVolumeUuidForMount', () => {
  it('精确匹配,容忍末尾斜杠', () => {
    const vols = [{ mount: '/DATA/', volume_uuid: 'u1' }]
    expect(findVolumeUuidForMount(vols, '/DATA')).toBe('u1')
  })
  it('匹配不上返回 null', () => {
    expect(findVolumeUuidForMount([{ mount: '/A', volume_uuid: 'u1' }], '/B')).toBeNull()
  })
})

describe('shouldGuardSnapshotView(fail-safe 方向不得反转)', () => {
  const info = { mount: '/DATA', snapshotName: 's1', relPath: '' }
  it('路径本身不是快照 → 不锁', () => {
    expect(shouldGuardSnapshotView(null, { status: 'ready', volumes: [] })).toBe(false)
  })
  it('卷列表还没拉(idle)→ 保持锁定', () => {
    expect(shouldGuardSnapshotView(info, { status: 'idle', volumes: [] })).toBe(true)
  })
  it('卷列表在途(loading)→ 保持锁定', () => {
    expect(shouldGuardSnapshotView(info, { status: 'loading', volumes: [] })).toBe(true)
  })
  it('卷列表拉失败(error)→ 保持锁定', () => {
    expect(shouldGuardSnapshotView(info, { status: 'error', volumes: [] })).toBe(true)
  })
  it('已 ready 但列表里没有这个挂载点 → 保持锁定', () => {
    expect(shouldGuardSnapshotView(info, { status: 'ready', volumes: [{ mount: '/OTHER', supported: true }] })).toBe(true)
  })
  it('已 ready 且精确命中且 supported === false → 唯一解锁条件', () => {
    expect(shouldGuardSnapshotView(info, { status: 'ready', volumes: [{ mount: '/DATA', supported: false }] })).toBe(false)
  })
  it('已 ready 且命中但 supported === true → 锁定(这是真快照)', () => {
    expect(shouldGuardSnapshotView(info, { status: 'ready', volumes: [{ mount: '/DATA', supported: true }] })).toBe(true)
  })
  it('state 为 null/undefined → 保持锁定', () => {
    expect(shouldGuardSnapshotView(info, null)).toBe(true)
  })
})

describe('resolveExitTarget', () => {
  it('活卷上同名目录还在 → 回到那里', async () => {
    const dirExists = vi.fn().mockResolvedValue(true)
    await expect(resolveExitTarget({ mount: '/DATA', snapshotName: 's1', relPath: 'Photos/2024' }, dirExists))
      .resolves.toBe('/DATA/Photos/2024')
    expect(dirExists).toHaveBeenCalledWith('/DATA/Photos/2024')
  })
  it('活卷上该目录已不存在 → 回卷根', async () => {
    await expect(resolveExitTarget({ mount: '/DATA', snapshotName: 's1', relPath: 'gone' }, async () => false))
      .resolves.toBe('/DATA')
  })
  it('info 为 null → null', async () => {
    await expect(resolveExitTarget(null, async () => true)).resolves.toBeNull()
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm exec vitest run src/files/util/snapshotPath.test.ts`
Expected: FAIL —— `Failed to resolve import "./snapshotPath"`

- [ ] **Step 3: 写实现**

创建 `src/files/util/snapshotPath.ts`:

```ts
// 文件区快照浏览的路径纯函数。从 Vue2 NimoOS-UI/src/service/snapshot.js(6 个)与
// components/filebrowser/snapshotBrowse.js(3 个)逐字移植 —— 判定逻辑、返回形状、
// fail-safe 方向一律未改,只补了 TS 类型。这些函数完全不认识"卷"这个概念(除了两个
// 显式接收 volumes 的查找函数),纯按路径段工作,因此对任意挂载点一视同仁。

export interface SnapshotBrowseInfo {
  mount: string
  snapshotName: string
  /** 相对快照根的路径,浏览快照自身根目录时为空串 */
  relPath: string
}

export interface SnapshotVolumeLike {
  volume_uuid?: string
  mount?: string
  supported?: boolean
  [k: string]: unknown
}

export interface VolumesState {
  status: 'idle' | 'loading' | 'ready' | 'error'
  volumes: SnapshotVolumeLike[]
}

/** 每个支持快照的挂载点下那个只读子卷目录的名字 —— "进入快照"和"识别出正在快照里"
 *  两个方向共用同一个常量,不会漂移。 */
export const SNAPSHOTS_DIR_NAME = '.snapshots'

const stripTrailingSlash = (p: string | undefined | null): string => (p || '').replace(/\/+$/, '')

export function snapshotBrowsePath(mount: string, snapshotName: string): string {
  return `${mount}/${SNAPSHOTS_DIR_NAME}/${snapshotName}`
}

// 段匹配(不是 includes 子串匹配):一个名字里恰好含 ".snapshots" 文本的普通目录不会误判。
// 有多个 ".snapshots" 段时取最左边那个 —— 外层那个才是挂载边界,内层是快照里真实存在的
// 普通数据目录。
export function parseSnapshotBrowsePath(absPath: string | null | undefined): SnapshotBrowseInfo | null {
  if (!absPath || typeof absPath !== 'string') return null
  const clean = stripTrailingSlash(absPath)
  if (!clean) return null
  const segments = clean.split('/')
  const idx = segments.indexOf(SNAPSHOTS_DIR_NAME)
  if (idx === -1) return null
  const mount = segments.slice(0, idx).join('/')
  // mount 为空说明路径直接以 "/.snapshots" 开头(或压根没有前导斜杠)—— 前面没有真实挂载点
  if (!mount) return null
  const snapshotName = segments[idx + 1]
  if (!snapshotName) return null // ".../.snapshots" 自身:还没选中任何快照
  return { mount, snapshotName, relPath: segments.slice(idx + 2).join('/') }
}

export function liveVolumePath(mount: string, relPath: string): string {
  return relPath ? `${mount}/${relPath}` : mount
}

// 对应后端 NimoOS-LocalStorage service/snapshot/naming.go 的 ParseName,但只取横幅需要的
// "什么时候拍的";**故意不校验**类型段是否在已知类型表里 —— 浏览进一个未识别/被 reconcile 成
// unknown 类型的快照目录时,仍应显示真实时间而不是一片空白。永不抛错。
export function parseSnapshotName(name: string | null | undefined): { createdAt: Date } | null {
  if (!name || typeof name !== 'string') return null
  const tsPart = name.split('_')[0]
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(tsPart)
  if (!m) return null
  const [, y, mo, d, h, mi, s] = m
  const createdAt = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s)))
  if (Number.isNaN(createdAt.getTime())) return null
  return { createdAt }
}

/** 横幅上的人话时间。解析不出来就回退成原始名字(不抛错、不留空)。 */
export function formatSnapshotBannerTime(name: string): string {
  const parsed = parseSnapshotName(name)
  return parsed ? parsed.createdAt.toLocaleString() : name
}

// 入口按钮用:只有文件区那个任意的 currentPath(可能在挂载点下深处好几层),要找出它落在
// 哪个卷里 —— 最长挂载前缀匹配。注意 clean !== mount 时必须要求 `${mount}/` 前缀,
// 否则 "/DATAX" 会被判成属于 "/DATA"。
export function findVolumeForPath(volumes: SnapshotVolumeLike[], path: string): SnapshotVolumeLike | null {
  if (!path || typeof path !== 'string' || !Array.isArray(volumes)) return null
  const clean = stripTrailingSlash(path)
  let best: SnapshotVolumeLike | null = null
  for (const v of volumes) {
    const mount = stripTrailingSlash(v.mount)
    if (!mount) continue
    if (clean !== mount && !clean.startsWith(`${mount}/`)) continue
    if (!best || mount.length > stripTrailingSlash(best.mount).length) best = v
  }
  return best
}

/** 恢复用:已经知道确切挂载点,精确匹配出 volume_uuid(容忍末尾斜杠)。 */
export function findVolumeUuidForMount(volumes: SnapshotVolumeLike[], mount: string): string | null {
  const hit = (volumes || []).find((v) => stripTrailingSlash(v.mount) === stripTrailingSlash(mount))
  return hit && hit.volume_uuid ? hit.volume_uuid : null
}

// 只读锁的最终闸门,坐在 parseSnapshotBrowsePath 前面。
//
// fail-safe 方向是**有意的产品决定,不是疏漏**:除非从一次已经 resolved 的卷列表里
// 肯定地知道"这个挂载点确认 supported: false",否则一律保持锁定。误锁只是让一个恰好叫
// ".snapshots" 的普通目录短暂显示成只读(烦人);漏锁则让写请求打到真只读的 btrfs 快照上,
// 用户拿到的是一句原始文件系统报错(更糟)。所以 idle / loading / error / 列表里没有这个
// 挂载点 —— 四种都保持锁定。
export function shouldGuardSnapshotView(
  parsed: SnapshotBrowseInfo | null,
  state: VolumesState | null | undefined,
): boolean {
  if (!parsed) return false
  if (!state || state.status !== 'ready') return true
  const match = (state.volumes || []).find((v) => stripTrailingSlash(v.mount) === stripTrailingSlash(parsed.mount))
  if (match && match.supported === false) return false
  return true
}

/** 「退出快照」该落到哪:活卷上的同名目录;该目录在活卷上已不存在则回卷根。 */
export async function resolveExitTarget(
  info: SnapshotBrowseInfo | null,
  dirExists: (p: string) => Promise<boolean>,
): Promise<string | null> {
  if (!info) return null
  const target = liveVolumePath(info.mount, info.relPath)
  const exists = await dirExists(target)
  return exists ? target : info.mount
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm exec vitest run src/files/util/snapshotPath.test.ts`
Expected: PASS(31 例全绿)

- [ ] **Step 5: 类型检查 + 提交**

```bash
pnpm exec vue-tsc --noEmit
git add src/files/util/snapshotPath.ts src/files/util/snapshotPath.test.ts
git commit -m "feat(files): 快照浏览路径纯函数(时间机器 T1)"
```

---

### Task 2: 时间机器数学(`timeMachineMath.ts`)

鱼眼曲线、步进夹紧从 Vue2 `snapshotStackMath.js` 逐字移植;可见卡切片**扩展**(要支持新视觉里"已翻过去的卡朝观众飞走"),刻度节点是新写的。星空 `generateStarfieldShadow` **不移植** —— 新设计的星点由 CSS 承担且浅色主题没有星星。

**Files:**
- Create: `src/files/util/timeMachineMath.ts`
- Test: `src/files/util/timeMachineMath.test.ts`

**Interfaces:**
- Consumes: 无
- Produces:
  ```ts
  export interface StackEntry<T> { item: T; index: number; depth: number; state: 'front' | 'behind' | 'past' }
  export interface RailNode { type: 'day' | 'main' | 'sub'; key: string; label?: string; flatIndex?: number; anchorIndex?: number }
  export function fisheyeScale(distance: number, options?: { radius?: number; maxScale?: number; minScale?: number }): number
  export function computeFisheyeScales(centers: number[], cursorY: number, options?: { radius?: number; maxScale?: number; minScale?: number }): number[]
  export function buildVisibleStack<T>(items: T[], selectedIndex: number, maxDepth?: number, pastDepth?: number): StackEntry<T>[]
  export function stepSelectedIndex(currentIndex: number, delta: number, length: number): number
  export function buildRailNodes(groups: { dayKey: string; labelText: string; items: { flatIndex: number }[] }[], subPerGap?: number): RailNode[]
  ```

- [ ] **Step 1: 写失败测试**

创建 `src/files/util/timeMachineMath.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { fisheyeScale, computeFisheyeScales, buildVisibleStack, stepSelectedIndex, buildRailNodes } from './timeMachineMath'

describe('fisheyeScale', () => {
  it('光标正中时到达最大缩放', () => {
    expect(fisheyeScale(0)).toBeCloseTo(2.2, 5)
  })
  it('超出半径回到最小缩放', () => {
    expect(fisheyeScale(70)).toBe(1)
    expect(fisheyeScale(999)).toBe(1)
  })
  it('左右对称(只看距离绝对值)', () => {
    expect(fisheyeScale(-30)).toBeCloseTo(fisheyeScale(30), 10)
  })
  it('半径内单调递减', () => {
    const xs = [0, 10, 20, 30, 40, 50, 60, 69]
    const ys = xs.map((x) => fisheyeScale(x))
    for (let i = 1; i < ys.length; i++) expect(ys[i]).toBeLessThan(ys[i - 1])
  })
  it('两端斜率为 0(升余弦缓动,不出现折角)', () => {
    // 紧挨光标处相邻两点的差,应远小于中段同样间距的差
    const nearCenter = fisheyeScale(0) - fisheyeScale(2)
    const midway = fisheyeScale(34) - fisheyeScale(36)
    expect(nearCenter).toBeLessThan(midway)
  })
  it('非有限输入退回最小缩放', () => {
    expect(fisheyeScale(NaN)).toBe(1)
  })
  it('可覆盖参数', () => {
    expect(fisheyeScale(0, { maxScale: 3, minScale: 1.5 })).toBeCloseTo(3, 5)
    expect(fisheyeScale(10, { radius: 10 })).toBe(1)
  })
})

describe('computeFisheyeScales', () => {
  it('按每条刻度中心与光标的距离批量算', () => {
    const out = computeFisheyeScales([100, 140, 300], 100)
    expect(out).toHaveLength(3)
    expect(out[0]).toBeCloseTo(2.2, 5)
    expect(out[2]).toBe(1)
  })
  it('空输入返回空数组', () => {
    expect(computeFisheyeScales([], 0)).toEqual([])
  })
})

describe('buildVisibleStack', () => {
  const items = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
  it('选中项是 front,后面的更老快照依次 behind', () => {
    const st = buildVisibleStack(items, 2, 5, 2)
    const behind = st.filter((e) => e.state !== 'past')
    expect(behind.map((e) => e.item)).toEqual(['c', 'd', 'e', 'f', 'g'])
    expect(behind[0]).toMatchObject({ state: 'front', depth: 0, index: 2 })
    expect(behind[4]).toMatchObject({ state: 'behind', depth: 4, index: 6 })
  })
  it('比选中更新的快照进入 past 态(朝观众飞走),最多 pastDepth 张', () => {
    const past = buildVisibleStack(items, 4, 5, 2).filter((e) => e.state === 'past')
    expect(past.map((e) => e.item)).toEqual(['d', 'c'])
    expect(past.map((e) => e.depth)).toEqual([1, 2])
  })
  it('选中最新一张时没有 past 卡', () => {
    expect(buildVisibleStack(items, 0, 5, 2).filter((e) => e.state === 'past')).toEqual([])
  })
  it('选中最老一张时 behind 只有它自己', () => {
    const st = buildVisibleStack(items, 7, 5, 2).filter((e) => e.state !== 'past')
    expect(st.map((e) => e.item)).toEqual(['h'])
  })
  it('索引越界被夹紧', () => {
    expect(buildVisibleStack(items, -3, 5, 2)[0]).toMatchObject({ index: 0, state: 'front' })
    expect(buildVisibleStack(items, 99, 5, 2)[0]).toMatchObject({ index: 7, state: 'front' })
  })
  it('空列表返回空', () => {
    expect(buildVisibleStack([], 0)).toEqual([])
  })
  it('每个 entry 的 index 是在原列表里的下标(供点选回填)', () => {
    const st = buildVisibleStack(items, 3, 3, 1)
    expect(st.map((e) => e.index).sort((a, b) => a - b)).toEqual([2, 3, 4, 5])
  })
})

describe('stepSelectedIndex', () => {
  it('两端夹紧', () => {
    expect(stepSelectedIndex(0, -1, 5)).toBe(0)
    expect(stepSelectedIndex(4, 1, 5)).toBe(4)
  })
  it('正常步进', () => {
    expect(stepSelectedIndex(2, 1, 5)).toBe(3)
    expect(stepSelectedIndex(2, -1, 5)).toBe(1)
  })
  it('空列表恒为 0', () => {
    expect(stepSelectedIndex(3, 1, 0)).toBe(0)
  })
})

describe('buildRailNodes', () => {
  const groups = [
    { dayKey: '2026-07-30', labelText: '今天', items: [{ flatIndex: 0 }, { flatIndex: 1 }] },
    { dayKey: '2026-07-29', labelText: '昨天', items: [{ flatIndex: 2 }] },
  ]
  it('每组前面插一个日期标题节点', () => {
    const nodes = buildRailNodes(groups)
    expect(nodes.filter((n) => n.type === 'day').map((n) => n.label)).toEqual(['今天', '昨天'])
  })
  it('每个快照一个主刻度,flatIndex 透传', () => {
    expect(buildRailNodes(groups).filter((n) => n.type === 'main').map((n) => n.flatIndex)).toEqual([0, 1, 2])
  })
  it('相邻两个主刻度之间插 2 个装饰子刻度,吸附到上面那个主刻度', () => {
    const nodes = buildRailNodes(groups)
    const subs = nodes.filter((n) => n.type === 'sub')
    expect(subs).toHaveLength(4) // 0-1 之间 2 个,1-2 之间 2 个
    expect(subs.slice(0, 2).every((n) => n.anchorIndex === 0)).toBe(true)
  })
  it('最后一个主刻度后面不再挂子刻度', () => {
    const nodes = buildRailNodes(groups)
    expect(nodes[nodes.length - 1].type).toBe('main')
  })
  it('key 全局唯一(v-for 不会撞 key)', () => {
    const keys = buildRailNodes(groups).map((n) => n.key)
    expect(new Set(keys).size).toBe(keys.length)
  })
  it('subPerGap 可配为 0', () => {
    expect(buildRailNodes(groups, 0).filter((n) => n.type === 'sub')).toEqual([])
  })
  it('空分组返回空', () => {
    expect(buildRailNodes([])).toEqual([])
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm exec vitest run src/files/util/timeMachineMath.test.ts`
Expected: FAIL —— 模块不存在

- [ ] **Step 3: 写实现**

创建 `src/files/util/timeMachineMath.ts`:

```ts
// 时间机器的 DOM-free 数学。fisheyeScale / computeFisheyeScales / stepSelectedIndex 从
// Vue2 components/filebrowser/components/snapshotStackMath.js 逐字移植(曲线参数一并保留);
// buildVisibleStack 在 Vue2 版基础上**扩展**出 past 态(新视觉里比选中更新的卡片要朝观众
// 飞出屏幕,Vue2 那版只有"往后退"一个方向);buildRailNodes 是新写的。
//
// Vue2 的 generateStarfieldShadow 有意不移植:新设计的星点由 CSS 承担,且浅色主题下没有星空。

export interface StackEntry<T> {
  item: T
  /** 在扁平列表中的下标(newest-first),点卡片回填选中用 */
  index: number
  /** 距离选中项的层数:front 恒为 0;behind/past 都是 1、2、3… */
  depth: number
  state: 'front' | 'behind' | 'past'
}

export interface RailNode {
  type: 'day' | 'main' | 'sub'
  key: string
  /** type === 'day' 时的日期文案 */
  label?: string
  /** type === 'main' 时该快照的扁平下标 */
  flatIndex?: number
  /** type === 'sub' 时吸附到的主刻度下标 */
  anchorIndex?: number
}

interface FisheyeOptions { radius?: number; maxScale?: number; minScale?: number }

// macOS Time Machine 的刻度带(以及它借鉴的 Dock)是随光标距离**连续**放大的,不是
// hover/near/far 几档 —— 这只能靠读光标位置算一个真正的距离函数,任何纯 CSS :hover 规则
// 都表达不了。这就是那个函数:距离 0 时 maxScale,到 radius 平滑降到 minScale,超出保持 minScale。
export function fisheyeScale(distance: number, options: FisheyeOptions = {}): number {
  const { radius = 70, maxScale = 2.2, minScale = 1 } = options
  const d = Math.abs(distance)
  if (!Number.isFinite(d) || d >= radius) return minScale
  const t = 1 - d / radius // 半径边缘为 0,光标正下方为 1
  // 升余弦缓动:两端斜率都是 0,所以相邻刻度是"融"进放大区再"融"出来的,不会出现折角。
  const eased = (1 - Math.cos(t * Math.PI)) / 2
  return minScale + (maxScale - minScale) * eased
}

export function computeFisheyeScales(centers: number[], cursorY: number, options: FisheyeOptions = {}): number[] {
  return (centers || []).map((c) => fisheyeScale(c - cursorY, options))
}

// items 是 newest-first。选中项在最前(front);更老的快照(下标更大)依次往后退(behind);
// 比选中更新的快照(下标更小)已经"翻过去了",朝观众飞出屏幕(past)。
export function buildVisibleStack<T>(
  items: T[],
  selectedIndex: number,
  maxDepth = 5,
  pastDepth = 2,
): StackEntry<T>[] {
  const list = items || []
  if (list.length === 0) return []
  const start = Math.min(Math.max(selectedIndex, 0), list.length - 1)
  const out: StackEntry<T>[] = []
  // 先放 past(渲染顺序无关紧要,层级由 CSS 的 z-index 决定;这里保证 depth 从近到远)
  for (let depth = 1; depth <= pastDepth && start - depth >= 0; depth++) {
    out.push({ item: list[start - depth], index: start - depth, depth, state: 'past' })
  }
  for (let depth = 0; depth < maxDepth && start + depth < list.length; depth++) {
    out.push({ item: list[start + depth], index: start + depth, depth, state: depth === 0 ? 'front' : 'behind' })
  }
  return out
}

export function stepSelectedIndex(currentIndex: number, delta: number, length: number): number {
  if (!length || length <= 0) return 0
  const next = currentIndex + delta
  return Math.min(Math.max(next, 0), length - 1)
}

// 把按天分好的快照摊平成刻度尺要渲染的节点序列:每组前一个日期标题,每个快照一条主刻度,
// 相邻主刻度之间插 subPerGap 条装饰性子刻度(参考稿的 sub tick)。子刻度不可独立选中,
// 点它吸附到 anchorIndex 那条主刻度。
export function buildRailNodes(
  groups: { dayKey: string; labelText: string; items: { flatIndex: number }[] }[],
  subPerGap = 2,
): RailNode[] {
  const nodes: RailNode[] = []
  const mains: number[] = []
  for (const g of groups || []) {
    nodes.push({ type: 'day', key: `day-${g.dayKey}`, label: g.labelText })
    for (const item of g.items) {
      nodes.push({ type: 'main', key: `main-${item.flatIndex}`, flatIndex: item.flatIndex })
      mains.push(nodes.length - 1)
    }
  }
  if (subPerGap <= 0 || mains.length < 2) return nodes
  // 从后往前插,避免边插边改动前面已记录的下标
  const out = [...nodes]
  for (let i = mains.length - 2; i >= 0; i--) {
    const anchorNode = out[mains[i]]
    const subs: RailNode[] = []
    for (let j = 0; j < subPerGap; j++) {
      subs.push({ type: 'sub', key: `sub-${anchorNode.flatIndex}-${j}`, anchorIndex: anchorNode.flatIndex })
    }
    out.splice(mains[i] + 1, 0, ...subs)
  }
  return out
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm exec vitest run src/files/util/timeMachineMath.test.ts`
Expected: PASS(25 例全绿)

> ⚠️ `buildRailNodes` 的插入位置容易写错:子刻度必须插在**同一天组内**主刻度之后,而当下一条主刻度属于下一天时,子刻度会落在日期标题**之前**。这是有意的(视觉上跨天的空隙也该有装饰刻度)。测试里「最后一个主刻度后面不再挂子刻度」这条会抓住越界插入。

- [ ] **Step 5: 类型检查 + 提交**

```bash
pnpm exec vue-tsc --noEmit
git add src/files/util/timeMachineMath.ts src/files/util/timeMachineMath.test.ts
git commit -m "feat(files): 时间机器鱼眼/卡堆/刻度数学纯函数(T2)"
```

---

### Task 3: 浏览态 store(`snapshotBrowse.ts`)

一个 Pinia store 收拢:卷列表缓存(每会话一次)、由 `filesStore.currentPath` 派生的只读浏览态、时间机器开关。恢复相关的 action 在 T6 补。

**Files:**
- Create: `src/files/stores/snapshotBrowse.ts`
- Test: `src/files/stores/snapshotBrowse.test.ts`

**Interfaces:**
- Consumes: T1 的 `parseSnapshotBrowsePath` / `shouldGuardSnapshotView` / `findVolumeForPath` / `SnapshotVolumeLike` / `VolumesState`;既有 `useFilesStore()` 的 `currentPath`;共享包 `service.snapshot.listVolumes()`(已解信封,直接返回数组)
- Produces:
  ```ts
  export const useSnapshotBrowseStore: StoreDefinition  // id: 'snapshotBrowse'
  // state:   status: 'idle'|'loading'|'ready'|'error';  volumes: SnapshotVolumeLike[];  wheelOpen: boolean
  // getters: parsed: SnapshotBrowseInfo|null;  isSnapshotView: boolean;  browseInfo: SnapshotBrowseInfo|null
  //          currentVolume: SnapshotVolumeLike|null;  canShowEntry: boolean
  // actions: ensureVolumes(): Promise<void>;  openWheel(): void;  closeWheel(): void;  reset(): void
  ```

- [ ] **Step 1: 写失败测试**

创建 `src/files/stores/snapshotBrowse.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useSnapshotBrowseStore } from './snapshotBrowse'
import { useFilesStore } from './files'

const listVolumesMock = vi.fn()
vi.mock('@nimotech/nimoos-service', () => ({
  service: { snapshot: { listVolumes: () => listVolumesMock() } },
}))

const VOLS = [
  { volume_uuid: 'u-data', mount: '/DATA', supported: true },
  { volume_uuid: 'u-usb', mount: '/mnt/usb', supported: false },
]

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  listVolumesMock.mockResolvedValue(VOLS)
})

describe('ensureVolumes', () => {
  it('拉一次就落 ready', async () => {
    const s = useSnapshotBrowseStore()
    expect(s.status).toBe('idle')
    await s.ensureVolumes()
    expect(s.status).toBe('ready')
    expect(s.volumes).toEqual(VOLS)
    expect(listVolumesMock).toHaveBeenCalledTimes(1)
  })
  it('重复调用不重复发请求(每会话一次)', async () => {
    const s = useSnapshotBrowseStore()
    await s.ensureVolumes()
    await s.ensureVolumes()
    expect(listVolumesMock).toHaveBeenCalledTimes(1)
  })
  it('并发调用共用同一次在途请求', async () => {
    let release: (v: unknown) => void = () => {}
    listVolumesMock.mockImplementation(() => new Promise((r) => { release = r }))
    const s = useSnapshotBrowseStore()
    const a = s.ensureVolumes()
    const b = s.ensureVolumes()
    expect(s.status).toBe('loading')
    release(VOLS)
    await Promise.all([a, b])
    expect(listVolumesMock).toHaveBeenCalledTimes(1)
    expect(s.status).toBe('ready')
  })
  it('失败落 error 且不抛出去(快照是可选功能,老后端全 404)', async () => {
    listVolumesMock.mockRejectedValue(new Error('404'))
    const s = useSnapshotBrowseStore()
    await expect(s.ensureVolumes()).resolves.toBeUndefined()
    expect(s.status).toBe('error')
    expect(s.volumes).toEqual([])
  })
  it('返回非数组时退化成空列表', async () => {
    listVolumesMock.mockResolvedValue(null)
    const s = useSnapshotBrowseStore()
    await s.ensureVolumes()
    expect(s.volumes).toEqual([])
    expect(s.status).toBe('ready')
  })
})

describe('浏览态派生', () => {
  it('普通路径不是快照视图', async () => {
    const s = useSnapshotBrowseStore(); const files = useFilesStore()
    files.currentPath = '/DATA/Photos'
    await s.ensureVolumes()
    expect(s.isSnapshotView).toBe(false)
    expect(s.browseInfo).toBeNull()
  })
  it('快照路径 + 卷 supported → 锁定,browseInfo 出结果', async () => {
    const s = useSnapshotBrowseStore(); const files = useFilesStore()
    files.currentPath = '/DATA/.snapshots/snap1/Photos'
    await s.ensureVolumes()
    expect(s.isSnapshotView).toBe(true)
    expect(s.browseInfo).toEqual({ mount: '/DATA', snapshotName: 'snap1', relPath: 'Photos' })
  })
  it('卷列表还没拉时,快照路径同样保持锁定(fail-safe)', () => {
    const s = useSnapshotBrowseStore(); const files = useFilesStore()
    files.currentPath = '/DATA/.snapshots/snap1'
    expect(s.status).toBe('idle')
    expect(s.isSnapshotView).toBe(true)
  })
  it('确认 supported:false 的挂载点上,叫 .snapshots 的普通目录不误锁', async () => {
    const s = useSnapshotBrowseStore(); const files = useFilesStore()
    files.currentPath = '/mnt/usb/.snapshots/whatever'
    await s.ensureVolumes()
    expect(s.isSnapshotView).toBe(false)
  })
})

describe('canShowEntry 真值表', () => {
  it('ready + 命中 supported 卷 + 不在快照里 → 显示', async () => {
    const s = useSnapshotBrowseStore(); const files = useFilesStore()
    files.currentPath = '/DATA/Photos'
    await s.ensureVolumes()
    expect(s.canShowEntry).toBe(true)
  })
  it('还没 ready → 不显示(避免闪现)', () => {
    const s = useSnapshotBrowseStore(); const files = useFilesStore()
    files.currentPath = '/DATA/Photos'
    expect(s.canShowEntry).toBe(false)
  })
  it('路径不属于任何快照卷 → 不显示', async () => {
    const s = useSnapshotBrowseStore(); const files = useFilesStore()
    files.currentPath = '/mnt/smb-host/x'
    await s.ensureVolumes()
    expect(s.canShowEntry).toBe(false)
  })
  it('卷 supported:false → 不显示', async () => {
    const s = useSnapshotBrowseStore(); const files = useFilesStore()
    files.currentPath = '/mnt/usb/x'
    await s.ensureVolumes()
    expect(s.canShowEntry).toBe(false)
  })
  it('已经在快照里 → 不显示', async () => {
    const s = useSnapshotBrowseStore(); const files = useFilesStore()
    files.currentPath = '/DATA/.snapshots/snap1'
    await s.ensureVolumes()
    expect(s.canShowEntry).toBe(false)
  })
})

describe('时间机器开关', () => {
  it('open/close 切换,reset 归位', async () => {
    const s = useSnapshotBrowseStore()
    s.openWheel(); expect(s.wheelOpen).toBe(true)
    s.closeWheel(); expect(s.wheelOpen).toBe(false)
    await s.ensureVolumes()
    s.openWheel()
    s.reset()
    expect(s.wheelOpen).toBe(false)
    expect(s.status).toBe('idle')
    expect(s.volumes).toEqual([])
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm exec vitest run src/files/stores/snapshotBrowse.test.ts`
Expected: FAIL —— 模块不存在

- [ ] **Step 3: 写实现**

创建 `src/files/stores/snapshotBrowse.ts`:

```ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { service } from '@nimotech/nimoos-service'
import { useFilesStore } from './files'
import {
  parseSnapshotBrowsePath, shouldGuardSnapshotView, findVolumeForPath,
  type SnapshotVolumeLike, type VolumesState,
} from '../util/snapshotPath'

// 文件区快照浏览的共享态:卷列表缓存 + 由 currentPath 派生的只读锁 + 时间机器开关。
// 对应 Vue2 FilePanel.vue 的 snapshotVolumesState / isSnapshotView / currentSnapshotVolume /
// canShowSnapshotEntry / isSnapshotWheelOpen 那一组 data + computed —— Vue2 里它们散在一个
// 3000 行组件里,这里收成一个 store,好处是禁写 guard(useFileOps)与右键菜单也能直接读到
// 同一份判定,不必层层传 prop。
export const useSnapshotBrowseStore = defineStore('snapshotBrowse', () => {
  const status = ref<VolumesState['status']>('idle')
  const volumes = ref<SnapshotVolumeLike[]>([])
  const wheelOpen = ref(false)
  const files = useFilesStore()

  // 同一次会话里并发调用共用这一个在途 Promise,避免文件区挂载与深链解析各发一次请求
  let inflight: Promise<void> | null = null

  // 每会话拉一次(Vue2 ensureSnapshotVolumesLoaded 同款语义)。error 是本会话的终态:
  // 快照是可选功能(老后端 /v2/snapshot/* 全 404),失败后一直重试只会每次导航都白打一次
  // 请求;而 error 态在 shouldGuardSnapshotView 里本就保持只读锁定,是安全的一侧。
  async function ensureVolumes(): Promise<void> {
    if (status.value === 'ready' || status.value === 'error') return
    if (inflight) return inflight
    status.value = 'loading'
    inflight = (async () => {
      try {
        const list = await service.snapshot.listVolumes()
        volumes.value = Array.isArray(list) ? (list as SnapshotVolumeLike[]) : []
        status.value = 'ready'
      } catch (e) {
        console.warn('[snapshot-browse] load volumes failed', (e as Error)?.message)
        volumes.value = []
        status.value = 'error'
      } finally {
        inflight = null
      }
    })()
    return inflight
  }

  const parsed = computed(() => parseSnapshotBrowsePath(files.currentPath))
  const volumesState = computed<VolumesState>(() => ({ status: status.value, volumes: volumes.value }))

  /** 只读锁是否生效 —— 路径形状 + 卷确证的双重判定,fail-safe 方向见 snapshotPath.ts 注释 */
  const isSnapshotView = computed(() => shouldGuardSnapshotView(parsed.value, volumesState.value))
  /** 锁确实生效时才把解析结果交给横幅/退出/恢复消费 */
  const browseInfo = computed(() => (isSnapshotView.value ? parsed.value : null))
  /** 当前路径落在哪个快照卷下(最长挂载前缀)—— 入口按钮与时间机器都要它的 uuid/mount */
  const currentVolume = computed(() => findVolumeForPath(volumes.value, files.currentPath))

  const canShowEntry = computed(
    () => status.value === 'ready'
      && !!currentVolume.value
      && currentVolume.value.supported === true
      && !isSnapshotView.value,
  )

  function openWheel() { wheelOpen.value = true }
  function closeWheel() { wheelOpen.value = false }

  function reset() {
    status.value = 'idle'
    volumes.value = []
    wheelOpen.value = false
    inflight = null
  }

  return {
    status, volumes, wheelOpen,
    parsed, isSnapshotView, browseInfo, currentVolume, canShowEntry,
    ensureVolumes, openWheel, closeWheel, reset,
  }
})
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm exec vitest run src/files/stores/snapshotBrowse.test.ts`
Expected: PASS(16 例全绿)

- [ ] **Step 5: 类型检查 + 提交**

```bash
pnpm exec vue-tsc --noEmit
git add src/files/stores/snapshotBrowse.ts src/files/stores/snapshotBrowse.test.ts
git commit -m "feat(files): 快照浏览态 store(卷缓存+只读锁派生,T3)"
```

---

### Task 4: 只读横幅 + 退出快照

横幅组件 + 接进 `Files.vue`。[恢复] 按钮此刻只占位(`disabled`),T6 接上真逻辑。

**Files:**
- Create: `src/files/snapshot/SnapshotBanner.vue`
- Test: `src/files/snapshot/SnapshotBanner.test.ts`
- Modify: `src/views/Files.vue`(import + 挂载 + `exitSnapshot` + `onMounted` 调 `ensureVolumes`)
- Modify: `src/i18n/zh_cn.ts`、`src/i18n/en_us.ts`
- Modify: `src/styles/theme.css`(横幅用的 amber 语义已有 `--dem-bg/--dem-fg/--dem-bd`,**无需新增**;确认后不要另造)

**Interfaces:**
- Consumes: T1 `formatSnapshotBannerTime` / `resolveExitTarget`;T3 store 的 `browseInfo`
- Produces:
  ```ts
  // SnapshotBanner.vue
  defineProps<{ info: SnapshotBrowseInfo | null; restoring: boolean; canRestore: boolean }>()
  defineEmits<{ (e: 'exit'): void; (e: 'restore'): void }>()
  // Files.vue 内新增
  async function exitSnapshot(): Promise<void>
  ```

- [ ] **Step 1: 加 i18n 文案(中英同步)**

`src/i18n/zh_cn.ts` 在既有 `snapDeleteMsg` 之后追加:

```ts
  snapBrowseBanner: '正在查看 {time} 的快照(只读)',
  snapBrowseHint: '选中文件后点「恢复」,可把它们复制回原来的位置',
  snapBrowseExit: '退出快照',
  snapBrowseRestore: '恢复',
```

`src/i18n/en_us.ts` 同位置追加:

```ts
  snapBrowseBanner: 'Viewing snapshot from {time} (read-only)',
  snapBrowseHint: 'Select files, then click "Restore" to copy them back to their original location',
  snapBrowseExit: 'Exit snapshot',
  snapBrowseRestore: 'Restore',
```

- [ ] **Step 2: 写失败测试**

创建 `src/files/snapshot/SnapshotBanner.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import SnapshotBanner from './SnapshotBanner.vue'
import zh from '../../i18n/zh_cn'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const INFO = { mount: '/DATA', snapshotName: '20260713T061900Z_manual_改版前', relPath: 'Photos' }
const mountIt = (props: Record<string, unknown> = {}) =>
  mount(SnapshotBanner, {
    props: { info: INFO, restoring: false, canRestore: true, ...props },
    global: { plugins: [i18n] },
  })

describe('SnapshotBanner', () => {
  it('info 为 null 时整条不渲染', () => {
    expect(mountIt({ info: null }).find('.snap-banner').exists()).toBe(false)
  })
  it('显示解析出的人话时间,而不是原始快照名', () => {
    const text = mountIt().text()
    expect(text).not.toContain('20260713T061900Z')
    expect(text).toContain('只读')
  })
  it('快照名解析不出来时回退显示原始名字(不留空)', () => {
    const w = mountIt({ info: { ...INFO, snapshotName: 'weird' } })
    expect(w.text()).toContain('weird')
  })
  it('常驻提示行一直在(不是一次性 toast)', () => {
    expect(mountIt().find('.snap-banner-hint').text()).toContain('恢复')
  })
  it('点退出 emit exit', async () => {
    const w = mountIt()
    await w.find('.snap-banner-exit').trigger('click')
    expect(w.emitted('exit')).toHaveLength(1)
  })
  it('点恢复 emit restore', async () => {
    const w = mountIt()
    await w.find('.snap-banner-restore').trigger('click')
    expect(w.emitted('restore')).toHaveLength(1)
  })
  it('没有可恢复的选中项时恢复按钮禁用且不 emit', async () => {
    const w = mountIt({ canRestore: false })
    expect(w.find('.snap-banner-restore').attributes('disabled')).toBeDefined()
    await w.find('.snap-banner-restore').trigger('click')
    expect(w.emitted('restore')).toBeUndefined()
  })
  it('恢复在途时按钮禁用并显示忙态', async () => {
    const w = mountIt({ restoring: true })
    expect(w.find('.snap-banner-restore').attributes('disabled')).toBeDefined()
    expect(w.find('.snap-banner-restore').classes()).toContain('is-busy')
  })
})
```

- [ ] **Step 3: 跑测试确认失败**

Run: `pnpm exec vitest run src/files/snapshot/SnapshotBanner.test.ts`
Expected: FAIL —— 组件不存在

- [ ] **Step 4: 写组件**

创建 `src/files/snapshot/SnapshotBanner.vue`:

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatSnapshotBannerTime, type SnapshotBrowseInfo } from '../util/snapshotPath'

const props = defineProps<{
  info: SnapshotBrowseInfo | null
  /** 恢复在途:禁用按钮,防重复提交 */
  restoring: boolean
  /** 当前有没有可恢复的选中项 */
  canRestore: boolean
}>()
const emit = defineEmits<{ (e: 'exit'): void; (e: 'restore'): void }>()
const { t } = useI18n()

const bannerTime = computed(() => (props.info ? formatSnapshotBannerTime(props.info.snapshotName) : ''))
const restoreDisabled = computed(() => props.restoring || !props.canRestore)

function onRestore() {
  if (restoreDisabled.value) return
  emit('restore')
}
</script>

<template>
  <div v-if="props.info" class="snap-banner">
    <div class="snap-banner-row">
      <span class="snap-banner-text">{{ t('snapBrowseBanner', { time: bannerTime }) }}</span>
      <button
        class="snap-banner-btn snap-banner-restore"
        :class="{ 'is-busy': props.restoring }"
        :disabled="restoreDisabled"
        @click="onRestore"
      >{{ t('snapBrowseRestore') }}</button>
      <button class="snap-banner-btn snap-banner-exit" @click="emit('exit')">{{ t('snapBrowseExit') }}</button>
    </div>
    <!-- 常驻提示,不是一次性 toast:Vue2 M2-F2 的教训是一闪而过的提示没人看见,
         而"选中之后还要点恢复"这一步不说清楚,用户会以为进来就能改。 -->
    <div class="snap-banner-hint">{{ t('snapBrowseHint') }}</div>
  </div>
</template>

<style scoped>
/* 配色复用既有的"值得注意但不是错误"语义 token(--dem-*),与存储区快照时间线的
   preop 徽章同一套色,不新造一个黄色。 */
.snap-banner {
  display: flex; flex-direction: column; gap: 2px;
  padding: 8px 12px; margin-bottom: 10px;
  border: 1px solid var(--dem-bd); border-radius: 12px;
  background: var(--dem-bg); color: var(--dem-fg); font-size: 13px;
}
.snap-banner-row { display: flex; align-items: center; gap: 8px; }
.snap-banner-text { flex: 1 1 auto; min-width: 0; }
.snap-banner-btn {
  flex: 0 0 auto; padding: 4px 12px; border-radius: 999px;
  border: 1px solid var(--dem-bd); background: transparent; color: var(--dem-fg);
  cursor: pointer; font-size: 12px;
}
.snap-banner-btn:hover:not(:disabled) { background: color-mix(in srgb, var(--dem-fg) 14%, transparent); }
.snap-banner-btn:disabled { opacity: 0.5; cursor: default; }
.snap-banner-hint { font-size: 12px; opacity: 0.8; }
@media (max-width: 768px) {
  .snap-banner-row { flex-wrap: wrap; row-gap: 6px; }
  .snap-banner-text { flex: 1 1 100%; }
}
</style>
```

- [ ] **Step 5: 跑测试确认通过**

Run: `pnpm exec vitest run src/files/snapshot/SnapshotBanner.test.ts`
Expected: PASS(8 例)

- [ ] **Step 6: 接进 Files.vue**

在 `src/views/Files.vue` 的 `<script setup>` 里加 import(挨着既有 files 相关 import):

```ts
import SnapshotBanner from '../files/snapshot/SnapshotBanner.vue'
import { useSnapshotBrowseStore } from '../files/stores/snapshotBrowse'
import { resolveExitTarget } from '../files/util/snapshotPath'
import { service } from '@nimotech/nimoos-service'
```

在既有 `const shares = useSharesStore()` 一组后面加:

```ts
const browse = useSnapshotBrowseStore()
```

在 `function goVirtual` 之后加退出逻辑:

```ts
// 退出快照:回到活卷上的同名目录;该目录在活卷上已经不存在(比如那之后被删了)则回卷根。
// dirExists 用列目录成功与否判定 —— 文件区没有单独的"目录是否存在"接口,列目录失败
// (404/权限)一律当作不存在,退回卷根总是安全的落点。
async function exitSnapshot() {
  const target = await resolveExitTarget(browse.browseInfo, async (p) => {
    try { await service.folder.getList(p); return true } catch { return false }
  })
  if (target) goVirtual(toVirtualPath(target, files.displayNames))
}
```

在既有 `onMounted(() => { uploads.initUploads() })` 旁边加(每会话拉一次卷列表,入口按钮与只读锁都依赖它):

```ts
onMounted(() => { browse.ensureVolumes() })
```

模板里,在 `<Breadcrumb .../>` 所在的 `.files-topbar` **之后**、`<SelectionToolbar ...>` **之前**插入:

```html
        <SnapshotBanner
          :info="browse.browseInfo"
          :restoring="false"
          :can-restore="false"
          @exit="exitSnapshot"
          @restore="() => {}"
        />
```

> `restoring` / `canRestore` / `@restore` 这三处是 T6 的接线点,本任务先写死占位,T6 会替换成真值。**不要**在这里提前实现恢复。

- [ ] **Step 7: 写 Files.vue 集成测试**

在 `src/views/Files.test.ts` **末尾**追加(沿用该文件已有的 mock 与挂载工具,不要另起一套):

```ts
describe('快照只读横幅', () => {
  it('普通目录不显示横幅', async () => {
    const w = await mountFiles('/DATA/Photos')
    expect(w.find('.snap-banner').exists()).toBe(false)
  })
  it('进入快照路径后显示横幅', async () => {
    const w = await mountFiles('/DATA/.snapshots/20260713T061900Z_manual/Photos')
    expect(w.find('.snap-banner').exists()).toBe(true)
  })
})
```

> ⚠️ 执行到这一步时先读 `src/views/Files.test.ts` 现有的挂载辅助函数,把上面的 `mountFiles(path)` 换成该文件真实存在的写法(名字可能不同);**不要**照抄本计划里的名字就跑。这里同样需要给 `service.snapshot.listVolumes` 的 mock 补上返回 `[{ volume_uuid: 'u-data', mount: '/DATA', supported: true }]`,否则卷列表停在 idle —— 那种情况下横幅**仍应显示**(fail-safe),两条断言都要能过。

- [ ] **Step 8: 跑全量测试 + 类型检查 + 提交**

```bash
pnpm test
pnpm exec vue-tsc --noEmit
git add src/files/snapshot/SnapshotBanner.vue src/files/snapshot/SnapshotBanner.test.ts src/views/Files.vue src/views/Files.test.ts src/i18n/zh_cn.ts src/i18n/en_us.ts
git commit -m "feat(files): 快照只读横幅+退出快照(T4)"
```

---

### Task 5: 禁写(两道防线)+ 快照内选中工具条

第一道:UI 里直接移除写入入口(顶栏 chip、右键菜单、选中工具条换一套)。第二道:`useFileOps` 的写方法开头兜底 guard —— 拖拽投放、快捷键这些能绕过 UI 隐藏的路径,必须在发请求之前拦住,否则用户拿到的是一句原始 btrfs 只读报错。

**Files:**
- Create: `src/files/util/snapshotRestore.ts`(本任务只放 `blockedBySnapshotView`,T6 再补恢复编排)
- Create: `src/files/util/snapshotRestore.test.ts`
- Create: `src/files/snapshot/SnapshotSelectionToolbar.vue` + `.test.ts`
- Modify: `src/files/composables/useFileOps.ts`(5 个写方法加 guard)
- Modify: `src/views/Files.vue`(写入 chip 条件隐藏、选中工具条切换、投放 guard)
- Modify: `src/files/components/FileContextMenu.vue`(快照态菜单裁剪)
- Modify: `src/i18n/zh_cn.ts` / `en_us.ts`

**Interfaces:**
- Consumes: T3 store 的 `isSnapshotView`
- Produces:
  ```ts
  export function blockedBySnapshotView(isSnapshotView: boolean, toast: (m: string) => void, message: string): boolean
  // SnapshotSelectionToolbar.vue
  defineProps<{ count: number; restoring: boolean }>()
  defineEmits<{ (e: 'restore'): void; (e: 'download'): void; (e: 'clear'): void }>()
  // FileContextMenu.vue 新增 emit 动作字符串:'restore-original'
  ```

- [ ] **Step 1: 加 i18n 文案**

`zh_cn.ts`:

```ts
  snapBrowseWriteBlocked: '这是只读快照,不能在这里修改',
  snapBrowseRestoreToOriginal: '恢复到原位置',
```

`en_us.ts`:

```ts
  snapBrowseWriteBlocked: 'This is a read-only snapshot — changes are disabled here',
  snapBrowseRestoreToOriginal: 'Restore to original location',
```

- [ ] **Step 2: 写 `blockedBySnapshotView` 的失败测试**

创建 `src/files/util/snapshotRestore.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { blockedBySnapshotView } from './snapshotRestore'

describe('blockedBySnapshotView', () => {
  it('不在快照里 → 放行,不吐 toast', () => {
    const toast = vi.fn()
    expect(blockedBySnapshotView(false, toast, 'nope')).toBe(false)
    expect(toast).not.toHaveBeenCalled()
  })
  it('在快照里 → 拦截并吐 toast', () => {
    const toast = vi.fn()
    expect(blockedBySnapshotView(true, toast, '只读')).toBe(true)
    expect(toast).toHaveBeenCalledWith('只读')
  })
})
```

- [ ] **Step 3: 跑测试确认失败,然后写实现**

Run: `pnpm exec vitest run src/files/util/snapshotRestore.test.ts` → FAIL(模块不存在)

创建 `src/files/util/snapshotRestore.ts`:

```ts
// 快照浏览态下的写拦截与恢复编排。保持无 Vue 依赖(toast / 网络调用都靠注入),
// 这样两者都能不挂载任何组件直接单测 —— 与 Vue2 snapshotBrowse.js 同一边界。

/**
 * 在只读快照里挡住一次写操作:命中就把友好文案吐成 toast 并返回 true(调用方必须 return)。
 * 这是第二道防线 —— 第一道是把写入入口本身移除(顶栏 chip / 右键菜单 / 选中工具条),
 * 但拖拽投放、快捷键粘贴这些路径绕得过 UI,所以每个写方法开头都要再拦一次。
 */
export function blockedBySnapshotView(
  isSnapshotView: boolean,
  toast: (message: string) => void,
  message: string,
): boolean {
  if (!isSnapshotView) return false
  toast(message)
  return true
}
```

Run 同一条命令 → PASS(2 例)

- [ ] **Step 4: 给 `useFileOps` 的 5 个写方法加 guard(先写测试)**

在 `src/files/composables/useFileOps.test.ts` 末尾追加(先读该文件已有的 mock 结构,把下面的 `service` mock 合并进去,不要新建第二份 `vi.mock`):

```ts
describe('快照只读态拦截写操作', () => {
  const enterSnapshot = () => {
    const browse = useSnapshotBrowseStore()
    browse.status = 'ready'
    browse.volumes = [{ volume_uuid: 'u-data', mount: '/DATA', supported: true }]
    useFilesStore().currentPath = '/DATA/.snapshots/snap1/Photos'
    return browse
  }

  it('新建文件夹被拦,不发请求', async () => {
    enterSnapshot()
    const ops = useFileOps()
    await ops.createFolder('新建文件夹')
    expect(folderCreateMock).not.toHaveBeenCalled()
    expect(useToast().msg).toContain('只读')
  })
  it('新建文件被拦', async () => {
    enterSnapshot(); await useFileOps().createFile('a.txt')
    expect(fileCreateMock).not.toHaveBeenCalled()
  })
  it('重命名被拦', async () => {
    enterSnapshot(); await useFileOps().rename({ name: 'a', path: '/DATA/.snapshots/snap1/a', is_dir: false }, 'b')
    expect(fileRenameMock).not.toHaveBeenCalled()
  })
  it('删除被拦', async () => {
    enterSnapshot(); await useFileOps().remove([{ name: 'a', path: '/DATA/.snapshots/snap1/a', is_dir: false }])
    expect(batchDeleteMock).not.toHaveBeenCalled()
  })
  it('粘贴被拦', async () => {
    enterSnapshot(); await useFileOps().paste('overwrite')
    expect(batchTaskMock).not.toHaveBeenCalled()
  })
  it('不在快照里时这些操作照常放行', async () => {
    useFilesStore().currentPath = '/DATA/Photos'
    await useFileOps().createFolder('新建文件夹')
    expect(folderCreateMock).toHaveBeenCalled()
  })
})
```

Run: `pnpm exec vitest run src/files/composables/useFileOps.test.ts` → FAIL(请求仍被发出)

- [ ] **Step 5: 实现 guard**

`src/files/composables/useFileOps.ts` 顶部加 import:

```ts
import { useSnapshotBrowseStore } from '../stores/snapshotBrowse'
import { blockedBySnapshotView } from '../util/snapshotRestore'
```

在 `export function useFileOps() {` 内、`const clipboard = useClipboardStore()` 之后加:

```ts
  const browse = useSnapshotBrowseStore()

  // 只读快照兜底拦截(第二道防线)。第一道是 Files.vue / FileContextMenu.vue 里把写入
  // 入口整个移除;这里挡的是拖拽投放、快捷键等绕过 UI 的路径 —— 让请求打到只读 btrfs 上
  // 只会换回一句原始文件系统报错,对用户毫无意义。
  function blockedInSnapshot(): boolean {
    return blockedBySnapshotView(browse.isSnapshotView, (m) => toast.show(m), t('snapBrowseWriteBlocked'))
  }
```

然后在这 5 个方法的**第一行**插入 `if (blockedInSnapshot()) return`:`createFolder` / `createFile` / `rename`(在既有 `if (!newName || newName === entry.name) return` 之后)/ `remove` / `paste`。

> **不要**给 `download` / `copyPath` 加 guard —— 它们是读操作,快照里本就允许。

Run: `pnpm exec vitest run src/files/composables/useFileOps.test.ts` → PASS

- [ ] **Step 6: 快照内选中工具条(先写测试)**

创建 `src/files/snapshot/SnapshotSelectionToolbar.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import SnapshotSelectionToolbar from './SnapshotSelectionToolbar.vue'
import zh from '../../i18n/zh_cn'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const mountIt = (props = {}) =>
  mount(SnapshotSelectionToolbar, { props: { count: 2, restoring: false, ...props }, global: { plugins: [i18n] } })

describe('SnapshotSelectionToolbar', () => {
  it('只有恢复与下载两个动词(没有删除/剪切/复制/共享)', () => {
    const w = mountIt()
    expect(w.find('.snap-sel-restore').exists()).toBe(true)
    expect(w.find('.snap-sel-download').exists()).toBe(true)
    expect(w.findAll('button')).toHaveLength(3) // 恢复 + 下载 + 取消选择
    expect(w.text()).not.toContain('删除')
  })
  it('显示选中数量', () => { expect(mountIt({ count: 3 }).text()).toContain('3') })
  it('点击分别 emit restore / download / clear', async () => {
    const w = mountIt()
    await w.find('.snap-sel-restore').trigger('click')
    await w.find('.snap-sel-download').trigger('click')
    await w.find('.snap-sel-clear').trigger('click')
    expect(w.emitted('restore')).toHaveLength(1)
    expect(w.emitted('download')).toHaveLength(1)
    expect(w.emitted('clear')).toHaveLength(1)
  })
  it('恢复在途时禁用且不 emit', async () => {
    const w = mountIt({ restoring: true })
    expect(w.find('.snap-sel-restore').attributes('disabled')).toBeDefined()
    await w.find('.snap-sel-restore').trigger('click')
    expect(w.emitted('restore')).toBeUndefined()
  })
})
```

- [ ] **Step 7: 写组件**

创建 `src/files/snapshot/SnapshotSelectionToolbar.vue`:

```vue
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const props = defineProps<{ count: number; restoring: boolean }>()
const emit = defineEmits<{ (e: 'restore'): void; (e: 'download'): void; (e: 'clear'): void }>()
const { t } = useI18n()
function onRestore() { if (!props.restoring) emit('restore') }
</script>

<template>
  <!-- 快照里的动词集刻意收窄成 恢复 + 下载 两个(Vue2 M2-F2 的最终形态):
       剪切/复制/删除/共享在只读快照上要么无意义要么会失败,留着只会诱导用户点。
       视觉复用 SelectionToolbar 的类名尺度,保持像同一个系统。 -->
  <div class="selection-toolbar snap-sel">
    <span class="sel-count">{{ t('filesSelectedCount', { count: props.count }) }}</span>
    <button class="sel-btn snap-sel-restore" :disabled="props.restoring" @click="onRestore">
      {{ t('snapBrowseRestore') }}
    </button>
    <button class="sel-btn snap-sel-download" @click="emit('download')">{{ t('filesCtxDownload') }}</button>
    <button class="sel-btn snap-sel-clear" @click="emit('clear')">{{ t('filesClearSel') }}</button>
  </div>
</template>

<style scoped>
.selection-toolbar {
  display: flex; align-items: center; gap: 12px; padding: 8px 12px; margin-bottom: 10px;
  border-radius: 12px; background: var(--chip-bg); color: var(--fg); font-size: 13px;
}
.sel-count { flex: 0 0 auto; }
.sel-btn {
  padding: 4px 12px; border-radius: 999px; border: 1px solid var(--chip-border);
  background: transparent; color: var(--fg); cursor: pointer; font-size: 12px;
}
.sel-btn:hover:not(:disabled) { background: var(--chip-bg-hi); }
.sel-btn:disabled { opacity: 0.5; cursor: default; }
@media (max-width: 768px) { .selection-toolbar { flex-wrap: wrap; row-gap: 8px; } }
</style>
```

> ⚠️ `--chip-bg` / `--chip-border` / `--chip-bg-hi` 在 `theme.css` 里是否两套主题都有值,**动手前先 grep 确认**;既有 `SelectionToolbar.vue` 用的是带 fallback 的 `var(--chip-bg, rgba(...))` 写法(那 fallback 属于历史遗留的硬编码)。若确认 token 齐全就按上面写(无 fallback);若缺,先在 `theme.css` 两个主题块补齐,**不要**复制那串 rgba fallback。

- [ ] **Step 8: 接进 Files.vue**

import:

```ts
import SnapshotSelectionToolbar from '../files/snapshot/SnapshotSelectionToolbar.vue'
```

模板里把写入 chips 整组包上条件(快照里不出现),即给 `.files-actions` 里的 5 个按钮各加 `v-if="!browse.isSnapshotView"`,或更省事地把整个 `<div class="files-actions">` 换成:

```html
            <div v-if="!browse.isSnapshotView" class="files-actions">
              <!-- 原有 5 个 chip 原样不动 -->
            </div>
```

选中工具条改成二选一:

```html
        <SnapshotSelectionToolbar
          v-if="browse.isSnapshotView && files.selectedCount > 0"
          :count="files.selectedCount"
          :restoring="false"
          @restore="() => {}"
          @download="ops.download(files.entries.filter((e) => files.isSelected(e.path)))"
          @clear="files.clearSelection"
        />
        <SelectionToolbar
          v-else-if="files.selectedCount > 0"
          ...原有 props 与事件原样不动...
        />
```

投放/选择文件的兜底 guard —— 在 `commitSelectedFiles` 的第一行加:

```ts
  if (browse.isSnapshotView) { toast.show(t('snapBrowseWriteBlocked')); return }
```

> 这一处覆盖拖拽投放与文件选择器两条路径(它们都汇到 `commitSelectedFiles`)。执行时先读该函数确认它确实是共用入口。

- [ ] **Step 9: 右键菜单裁剪(先写测试)**

在 `src/files/components/FileContextMenu.test.ts` 末尾追加:

```ts
describe('快照只读态菜单', () => {
  const enterSnapshot = () => {
    const browse = useSnapshotBrowseStore()
    browse.status = 'ready'
    browse.volumes = [{ volume_uuid: 'u-data', mount: '/DATA', supported: true }]
    useFilesStore().currentPath = '/DATA/.snapshots/snap1'
  }
  it('空白区菜单只剩刷新', async () => {
    enterSnapshot()
    const w = await openBlankMenu()
    expect(w.text()).toContain('刷新')
    expect(w.text()).not.toContain('新建文件夹')
    expect(w.text()).not.toContain('粘贴')
  })
  it('条目菜单只剩恢复到原位置 + 下载', async () => {
    enterSnapshot()
    const w = await openItemMenu({ name: 'a.txt', path: '/DATA/.snapshots/snap1/a.txt', is_dir: false })
    expect(w.text()).toContain('恢复到原位置')
    expect(w.text()).toContain('下载')
    expect(w.text()).not.toContain('删除')
    expect(w.text()).not.toContain('重命名')
    expect(w.text()).not.toContain('复制路径')
  })
  it('多选时不出现恢复到原位置(恢复文案是单条路径)', async () => {
    enterSnapshot()
    const w = await openItemMenu({ name: 'a.txt', path: '/DATA/.snapshots/snap1/a.txt', is_dir: false }, 3)
    expect(w.text()).not.toContain('恢复到原位置')
  })
  it('点恢复到原位置 emit action=restore-original', async () => {
    enterSnapshot()
    const w = await openItemMenu({ name: 'a.txt', path: '/DATA/.snapshots/snap1/a.txt', is_dir: false })
    await w.find('.ctx-restore-original').trigger('click')
    expect(w.emitted('action')?.[0]?.[0]).toBe('restore-original')
  })
})
```

> ⚠️ `openBlankMenu` / `openItemMenu` 是本计划的占位名 —— 先读 `FileContextMenu.test.ts` 现有的打开菜单辅助写法(reka-ui 的菜单需要触发 contextmenu 并等 teleport 挂载),照它改。

- [ ] **Step 10: 实现菜单裁剪**

`FileContextMenu.vue` 加 import 与派生:

```ts
import { useSnapshotBrowseStore } from '../stores/snapshotBrowse'
const browse = useSnapshotBrowseStore()
const inSnapshot = computed(() => browse.isSnapshotView)
```

然后:

- 空白区菜单:新建文件/新建文件夹/粘贴 等项加 `v-if="!inSnapshot"`,「刷新」保持无条件。
- 条目菜单:复制路径 / 重命名 / 收藏 / 共享 / 删除 / 剪切 / 复制 全部加 `&& !inSnapshot` 到各自既有的 `show*` computed 里(改 computed,不要在模板上再叠一层条件,避免两处判断漂移);「下载」保持。
- 新增一项(放在下载之前):

```html
        <ContextMenuItem v-if="inSnapshot && single" class="ctx-item ctx-restore-original" @select="fire('restore-original')">
          {{ t('snapBrowseRestoreToOriginal') }}
        </ContextMenuItem>
```

`Files.vue` 的 `onCtxAction` switch 里加一个分支占位(T6 填实现):

```ts
    case 'restore-original': /* T6 接线 */ break
```

- [ ] **Step 11: 全量测试 + 类型检查 + 提交**

```bash
pnpm test
pnpm exec vue-tsc --noEmit
git add -A src/files src/views/Files.vue src/i18n
git commit -m "feat(files): 快照只读禁写两道防线+快照选中工具条(T5)"
```

---

### Task 6: 恢复到原位置(三个入口)

**Files:**
- Modify: `src/files/util/snapshotRestore.ts`(补 `performSnapshotRestore`)
- Modify: `src/files/util/snapshotRestore.test.ts`
- Modify: `src/files/stores/snapshotBrowse.ts`(补 `restoring` 状态与 `restore(entries)` action)
- Modify: `src/files/stores/snapshotBrowse.test.ts`
- Modify: `src/views/Files.vue`(三个入口接线,替换 T4/T5 的占位)
- Modify: `src/i18n/zh_cn.ts` / `en_us.ts`

**Interfaces:**
- Consumes: T1 `parseSnapshotBrowsePath` / `findVolumeUuidForMount`;`service.snapshot.listVolumes` / `service.snapshot.restore`
- Produces:
  ```ts
  export type RestoreResult =
    | { ok: true; restoredPath: string }
    | { ok: false; reason: 'invalid' | 'not-found' | 'error' }
  export function performSnapshotRestore(deps: {
    item: { path: string }
    info: { mount: string; snapshotName: string } | null
    listVolumes: () => Promise<unknown>
    restore: (body: { volume_uuid: string; snapshot: string; path: string }) => Promise<unknown>
  }): Promise<RestoreResult>
  // store 新增
  restoring: boolean
  restore(entries: { path: string }[]): Promise<void>
  ```

- [ ] **Step 1: 加 i18n 文案**

`zh_cn.ts`:

```ts
  snapBrowseRestored: '已恢复到 {path}',
  snapBrowseRestoredN: '已恢复 {n} 项(新副本名字带 .restored 后缀)',
  snapBrowseRestoreNotFound: '快照里已经找不到这个文件',
  snapBrowseRestoreInvalid: '路径无效,无法恢复',
  snapBrowseRestoreFailed: '恢复失败,请稍后再试',
```

`en_us.ts`:

```ts
  snapBrowseRestored: 'Restored to {path}',
  snapBrowseRestoredN: 'Restored {n} items (copies are suffixed .restored)',
  snapBrowseRestoreNotFound: 'That file no longer exists in this snapshot',
  snapBrowseRestoreInvalid: 'Invalid path — cannot restore',
  snapBrowseRestoreFailed: 'Restore failed, please try again',
```

- [ ] **Step 2: 写 `performSnapshotRestore` 的失败测试**

追加到 `src/files/util/snapshotRestore.test.ts`:

```ts
import { performSnapshotRestore } from './snapshotRestore'

const INFO = { mount: '/DATA', snapshotName: 'snap1' }
const VOLS = [{ volume_uuid: 'u-data', mount: '/DATA' }]

describe('performSnapshotRestore', () => {
  it('把快照侧绝对路径映射回卷相对路径再提交', async () => {
    const restore = vi.fn().mockResolvedValue({ restored_path: '/DATA/Photos/a.jpg.restored-1' })
    const r = await performSnapshotRestore({
      item: { path: '/DATA/.snapshots/snap1/Photos/a.jpg' },
      info: INFO,
      listVolumes: async () => VOLS,
      restore,
    })
    expect(restore).toHaveBeenCalledWith({ volume_uuid: 'u-data', snapshot: 'snap1', path: 'Photos/a.jpg' })
    expect(r).toEqual({ ok: true, restoredPath: '/DATA/Photos/a.jpg.restored-1' })
  })
  it('兼容后端把 restored_path 包在 data 里的情形', async () => {
    const r = await performSnapshotRestore({
      item: { path: '/DATA/.snapshots/snap1/a.txt' }, info: INFO,
      listVolumes: async () => VOLS,
      restore: async () => ({ data: { restored_path: '/DATA/a.txt.restored-1' } }),
    })
    expect(r).toEqual({ ok: true, restoredPath: '/DATA/a.txt.restored-1' })
  })
  it('info 为 null / item 无 path → invalid,且不发请求', async () => {
    const restore = vi.fn()
    expect(await performSnapshotRestore({ item: { path: '/x' }, info: null, listVolumes: async () => VOLS, restore }))
      .toEqual({ ok: false, reason: 'invalid' })
    expect(restore).not.toHaveBeenCalled()
  })
  it('路径不在快照里 → invalid', async () => {
    expect(await performSnapshotRestore({
      item: { path: '/DATA/Photos/a.jpg' }, info: INFO, listVolumes: async () => VOLS, restore: async () => ({}),
    })).toEqual({ ok: false, reason: 'invalid' })
  })
  it('快照根自身(relPath 为空)→ invalid', async () => {
    expect(await performSnapshotRestore({
      item: { path: '/DATA/.snapshots/snap1' }, info: INFO, listVolumes: async () => VOLS, restore: async () => ({}),
    })).toEqual({ ok: false, reason: 'invalid' })
  })
  it('卷列表里找不到该挂载点 → invalid', async () => {
    expect(await performSnapshotRestore({
      item: { path: '/DATA/.snapshots/snap1/a.txt' }, info: INFO,
      listVolumes: async () => [{ volume_uuid: 'u-other', mount: '/OTHER' }], restore: async () => ({}),
    })).toEqual({ ok: false, reason: 'invalid' })
  })
  it('卷列表请求失败 → error', async () => {
    expect(await performSnapshotRestore({
      item: { path: '/DATA/.snapshots/snap1/a.txt' }, info: INFO,
      listVolumes: async () => { throw new Error('boom') }, restore: async () => ({}),
    })).toEqual({ ok: false, reason: 'error' })
  })
  it('后端 404 → not-found', async () => {
    const err = Object.assign(new Error('gone'), { code: 404 })
    expect(await performSnapshotRestore({
      item: { path: '/DATA/.snapshots/snap1/a.txt' }, info: INFO,
      listVolumes: async () => VOLS, restore: async () => { throw err },
    })).toEqual({ ok: false, reason: 'not-found' })
  })
  it('后端 400 → invalid', async () => {
    const err = Object.assign(new Error('bad'), { code: 400 })
    expect(await performSnapshotRestore({
      item: { path: '/DATA/.snapshots/snap1/a.txt' }, info: INFO,
      listVolumes: async () => VOLS, restore: async () => { throw err },
    })).toEqual({ ok: false, reason: 'invalid' })
  })
  it('其它错误 → error', async () => {
    expect(await performSnapshotRestore({
      item: { path: '/DATA/.snapshots/snap1/a.txt' }, info: INFO,
      listVolumes: async () => VOLS, restore: async () => { throw new Error('boom') },
    })).toEqual({ ok: false, reason: 'error' })
  })
  it('响应里没有 restored_path → error(不能谎报成功)', async () => {
    expect(await performSnapshotRestore({
      item: { path: '/DATA/.snapshots/snap1/a.txt' }, info: INFO,
      listVolumes: async () => VOLS, restore: async () => ({}),
    })).toEqual({ ok: false, reason: 'error' })
  })
})
```

> ⚠️ 错误码来源与 Vue2 不同,**这是必须注意的差异**:Vue2 直接读 axios 的 `e.response.status`;New-UI 走共享包,`unwrap()` 抛的是 `Error & { code }`(code = 信封里的 `success` 字段)。所以这里判的是 `code`,不是 `response.status`。实现里要**两种都认**(`code` 优先,回落 `response?.status`),因为网络层 4xx 时 axios 拦截器抛的仍是原始 AxiosError。

- [ ] **Step 3: 跑测试确认失败,然后实现**

追加到 `src/files/util/snapshotRestore.ts`:

```ts
import { parseSnapshotBrowsePath, findVolumeUuidForMount, type SnapshotVolumeLike } from './snapshotPath'

export type RestoreResult =
  | { ok: true; restoredPath: string }
  | { ok: false; reason: 'invalid' | 'not-found' | 'error' }

// 从抛出来的错误里取 HTTP 状态。共享包的 unwrap() 抛的是 Error & {code}(信封里的 success
// 字段);网络层 4xx 由 axios 抛出时状态在 response.status 上 —— 两种都要认。
function statusOf(e: unknown): number | undefined {
  const withCode = e as { code?: number; response?: { status?: number } } | undefined
  return withCode?.code ?? withCode?.response?.status
}

// 响应形状容错:共享包已解一层信封,但历史上后端也出现过再包一层 data 的写法,两种都取。
function restoredPathOf(res: unknown): string | null {
  const r = res as { restored_path?: string; data?: { restored_path?: string } } | undefined
  return r?.restored_path || r?.data?.restored_path || null
}

/**
 * 「恢复到原位置」的完整编排:把条目的快照侧绝对路径解析回**相对卷根**的路径(后端契约,
 * 不是相对快照目录),用挂载点精确匹配出 volume_uuid,再提交恢复。
 * 后端永不覆盖 —— 目标名由它定为 `<原名>.restored-<时间戳>`,所以这里没有任何冲突处理。
 */
export async function performSnapshotRestore(deps: {
  item: { path: string }
  info: { mount: string; snapshotName: string } | null
  listVolumes: () => Promise<unknown>
  restore: (body: { volume_uuid: string; snapshot: string; path: string }) => Promise<unknown>
}): Promise<RestoreResult> {
  const { item, info, listVolumes, restore } = deps
  if (!info || !item || !item.path) return { ok: false, reason: 'invalid' }
  const parsed = parseSnapshotBrowsePath(item.path)
  if (!parsed || !parsed.relPath) return { ok: false, reason: 'invalid' }

  let volumeUuid: string | null
  try {
    const list = await listVolumes()
    volumeUuid = findVolumeUuidForMount((Array.isArray(list) ? list : []) as SnapshotVolumeLike[], info.mount)
  } catch {
    return { ok: false, reason: 'error' }
  }
  if (!volumeUuid) return { ok: false, reason: 'invalid' }

  try {
    const res = await restore({ volume_uuid: volumeUuid, snapshot: info.snapshotName, path: parsed.relPath })
    const restoredPath = restoredPathOf(res)
    if (!restoredPath) return { ok: false, reason: 'error' }
    return { ok: true, restoredPath }
  } catch (e) {
    const status = statusOf(e)
    if (status === 404) return { ok: false, reason: 'not-found' }
    if (status === 400) return { ok: false, reason: 'invalid' }
    return { ok: false, reason: 'error' }
  }
}
```

Run: `pnpm exec vitest run src/files/util/snapshotRestore.test.ts` → PASS(13 例)

- [ ] **Step 4: store 补 restore action(先写测试)**

追加到 `src/files/stores/snapshotBrowse.test.ts`:

```ts
describe('恢复', () => {
  const inSnapshot = async () => {
    const s = useSnapshotBrowseStore()
    useFilesStore().currentPath = '/DATA/.snapshots/snap1/Photos'
    await s.ensureVolumes()
    return s
  }
  it('单条成功:toast 报出恢复后的路径', async () => {
    restoreMock.mockResolvedValue({ restored_path: '/DATA/Photos/a.jpg.restored-1' })
    const s = await inSnapshot()
    await s.restore([{ path: '/DATA/.snapshots/snap1/Photos/a.jpg' }])
    expect(useToast().msg).toContain('/DATA/Photos/a.jpg.restored-1')
  })
  it('多条成功:toast 只报条数,不逐条刷屏', async () => {
    restoreMock.mockResolvedValue({ restored_path: '/DATA/x.restored-1' })
    const s = await inSnapshot()
    await s.restore([{ path: '/DATA/.snapshots/snap1/a' }, { path: '/DATA/.snapshots/snap1/b' }])
    expect(restoreMock).toHaveBeenCalledTimes(2)
    expect(useToast().msg).toContain('2')
  })
  it('恢复期间 restoring 为真,结束落回 false', async () => {
    let release: (v: unknown) => void = () => {}
    restoreMock.mockImplementation(() => new Promise((r) => { release = r }))
    const s = await inSnapshot()
    const p = s.restore([{ path: '/DATA/.snapshots/snap1/a' }])
    expect(s.restoring).toBe(true)
    release({ restored_path: '/DATA/a.restored-1' })
    await p
    expect(s.restoring).toBe(false)
  })
  it('在途时再次调用直接忽略(防重复提交)', async () => {
    let release: (v: unknown) => void = () => {}
    restoreMock.mockImplementation(() => new Promise((r) => { release = r }))
    const s = await inSnapshot()
    const p = s.restore([{ path: '/DATA/.snapshots/snap1/a' }])
    await s.restore([{ path: '/DATA/.snapshots/snap1/b' }])
    release({ restored_path: '/x' })
    await p
    expect(restoreMock).toHaveBeenCalledTimes(1)
  })
  it('404 → 专用文案', async () => {
    restoreMock.mockRejectedValue(Object.assign(new Error('gone'), { code: 404 }))
    const s = await inSnapshot()
    await s.restore([{ path: '/DATA/.snapshots/snap1/a' }])
    expect(useToast().msg).toContain('找不到')
  })
  it('空选区不发请求', async () => {
    const s = await inSnapshot()
    await s.restore([])
    expect(restoreMock).not.toHaveBeenCalled()
  })
})
```

> 该文件顶部的 `vi.mock('@nimotech/nimoos-service')` 要补上 `restore: (b) => restoreMock(b)`,并 import `useToast`。

- [ ] **Step 5: 实现 store action**

`src/files/stores/snapshotBrowse.ts` 补:

```ts
import { performSnapshotRestore } from '../util/snapshotRestore'
import { useToast } from '../../stores/toast'
import { i18n } from '../../i18n'
```

state 加 `const restoring = ref(false)`,并新增:

```ts
  // 恢复选中项。多条时逐条提交(后端一次只收一个 path),期间 restoring 为真,
  // 三个入口(横幅 / 选中工具条 / 右键菜单)共用这一个开关,任何一处在途都禁用其余两处。
  async function restore(entries: { path: string }[]): Promise<void> {
    if (restoring.value) return
    const list = entries || []
    if (!list.length) return
    const toast = useToast()
    const t = i18n.global.t
    restoring.value = true
    try {
      const results = []
      for (const item of list) {
        results.push(await performSnapshotRestore({
          item,
          info: browseInfo.value,
          listVolumes: () => service.snapshot.listVolumes(),
          restore: (body) => service.snapshot.restore(body),
        }))
      }
      const ok = results.filter((r) => r.ok) as { ok: true; restoredPath: string }[]
      const failed = results.find((r) => !r.ok) as { ok: false; reason: string } | undefined
      if (ok.length === 1 && !failed) toast.show(t('snapBrowseRestored', { path: ok[0].restoredPath }))
      else if (ok.length > 1 && !failed) toast.show(t('snapBrowseRestoredN', { n: ok.length }))
      if (failed) {
        toast.show(
          failed.reason === 'not-found' ? t('snapBrowseRestoreNotFound')
            : failed.reason === 'invalid' ? t('snapBrowseRestoreInvalid')
              : t('snapBrowseRestoreFailed'),
        )
      }
    } finally {
      restoring.value = false
    }
  }
```

把 `restoring` 与 `restore` 加进 store 的 return。

- [ ] **Step 6: 三个入口接线(替换 T4/T5 的占位)**

`Files.vue`:

```ts
// 当前选中项(快照态下三个恢复入口共用)
const snapshotSelection = computed(() => files.entries.filter((e) => files.isSelected(e.path)))
```

- 横幅:`:restoring="browse.restoring"` `:can-restore="snapshotSelection.length > 0"` `@restore="browse.restore(snapshotSelection)"`
- 选中工具条:`:restoring="browse.restoring"` `@restore="browse.restore(snapshotSelection)"`
- 右键菜单分支:`case 'restore-original': if (entry) browse.restore([entry]); break`

- [ ] **Step 7: 全量测试 + 类型检查 + 提交**

```bash
pnpm test
pnpm exec vue-tsc --noEmit
git add -A src/files src/views/Files.vue src/i18n
git commit -m "feat(files): 快照恢复到原位置(横幅/工具条/右键三入口,T6)"
```

---

### Task 7: 时间机器骨架(token + 覆盖层 + 底栏 + 入口 + 进入落点)

本任务把时间机器立起来:主题 token、全屏壳的三态与键盘、底栏、顶栏入口 chip、以及**进入落点**(对 Vue2 的有意改正)。卡堆先用一块占位方块,T8 才做真卡片。

**Files:**
- Modify: `src/styles/theme.css`(新增 `--tm-*`,两套主题各一份)
- Modify: `src/files/util/snapshotPath.ts` + `.test.ts`(补 `relPathUnderMount`)
- Create: `src/files/snapshot/TimeMachineBar.vue` + `.test.ts`
- Create: `src/files/snapshot/TimeMachineOverlay.vue` + `.test.ts`
- Modify: `src/views/Files.vue`(入口 chip + 挂载覆盖层 + 进入导航)
- Modify: `src/i18n/zh_cn.ts` / `en_us.ts`

**Interfaces:**
- Consumes: T2 `stepSelectedIndex`;T3 store `wheelOpen` / `currentVolume`;`storage/stores/snapshot.ts` 的 `loadSnapshots` / `snapshots` / `listLoading`;`storage/util/snapshotView.ts` 的 `groupSnapshotsByDay`
- Produces:
  ```ts
  export function relPathUnderMount(mount: string, absPath: string): string
  // TimeMachineBar.vue
  defineProps<{ momentText: string; canEnter: boolean }>()
  defineEmits<{ (e: 'cancel'): void; (e: 'enter'): void }>()
  // TimeMachineOverlay.vue
  defineProps<{ volumeUuid: string; mountPoint: string; relPath: string; folderLabel: string }>()
  defineEmits<{ (e: 'close'): void; (e: 'select', path: string): void; (e: 'open-settings'): void }>()
  // 内部对外暴露给 T8/T10 的形状:
  interface FlatSnapshotItem { id?: number|string; name: string; label: string; typeKind: 'auto'|'manual'|'preop'
                               typeLabelKey: string; time: string; createdAt: string; flatIndex: number; dayLabelText: string }
  ```

- [ ] **Step 1: 加主题 token(两套主题都要有值)**

`src/styles/theme.css` 的 `:root { … }`(深色默认)块内追加:

```css
  /* 时间机器覆盖层。跟随主题(用户拍板):深色是深空,浅色是纸感 —— 两套各自成立,
     不是一套深色硬塞进浅色主题里。 */
  --tm-bg:
    radial-gradient(ellipse at 28% 22%, rgba(76, 61, 158, 0.35) 0%, rgba(10, 13, 33, 0) 55%),
    radial-gradient(ellipse at 78% 78%, rgba(30, 64, 140, 0.28) 0%, rgba(10, 13, 33, 0) 55%),
    linear-gradient(160deg, #131a3a 0%, #0a0e21 45%, #05060f 100%);
  --tm-star: rgba(255, 255, 255, 0.85);
  --tm-fg: #f1f5f9;
  --tm-fg-muted: rgba(241, 245, 249, 0.62);
  --tm-card-bg: linear-gradient(155deg, rgba(255, 255, 255, 0.16), rgba(255, 255, 255, 0.03));
  --tm-card-bd: rgba(255, 255, 255, 0.18);
  --tm-card-shadow: 0 24px 60px rgba(0, 0, 0, 0.55);
  --tm-rail: rgba(255, 255, 255, 0.5);
  --tm-rail-sub: rgba(255, 255, 255, 0.2);
```

`:root[data-theme="light"] { … }` 块内追加同名的一整套:

```css
  /* 时间机器 —— 浅色纸感:没有星空(--tm-star 透明),背景是米白 + 极淡光晕 */
  --tm-bg:
    radial-gradient(ellipse at 26% 20%, rgba(59, 91, 219, 0.10) 0%, rgba(247, 245, 239, 0) 58%),
    radial-gradient(ellipse at 80% 80%, rgba(110, 90, 224, 0.08) 0%, rgba(247, 245, 239, 0) 58%),
    linear-gradient(160deg, #fbfaf6 0%, #f3f0e8 55%, #ebe7dd 100%);
  --tm-star: transparent;
  --tm-fg: #1c1b19;
  --tm-fg-muted: #6e6a61;
  --tm-card-bg: linear-gradient(155deg, #ffffff, #f6f4ee);
  --tm-card-bd: rgba(28, 27, 25, 0.12);
  --tm-card-shadow: 0 18px 44px rgba(28, 27, 25, 0.18);
  --tm-rail: rgba(28, 27, 25, 0.45);
  --tm-rail-sub: rgba(28, 27, 25, 0.16);
```

> 这是**唯一**允许出现色值字面量的地方(token 定义处)。此后所有时间机器组件的 `<style>` 里只准出现 `var(--tm-…)` / `var(--accent)` / `var(--on-accent)` / `var(--nrm-fg)` / `var(--dem-fg)`。

- [ ] **Step 2: 加 i18n 文案**

`zh_cn.ts`:

```ts
  tmEntry: '时间机器',
  tmViewingFolder: '正在查看 {path} 的历史版本',
  tmEnter: '进入此快照',
  tmSettings: '快照设置',
  tmNoFolderAtTime: '此时还没有这个文件夹',
  tmItemCount: '{n} 项',
```

`en_us.ts`:

```ts
  tmEntry: 'Time Machine',
  tmViewingFolder: 'Browsing earlier versions of {path}',
  tmEnter: 'Enter this snapshot',
  tmSettings: 'Snapshot settings',
  tmNoFolderAtTime: 'This folder did not exist yet',
  tmItemCount: '{n} items',
```

- [ ] **Step 3: 补 `relPathUnderMount`(先写测试)**

追加到 `src/files/util/snapshotPath.test.ts`:

```ts
import { relPathUnderMount } from './snapshotPath'

describe('relPathUnderMount', () => {
  it('挂载点自身 → 空串', () => { expect(relPathUnderMount('/DATA', '/DATA')).toBe('') })
  it('取相对卷根的路径', () => { expect(relPathUnderMount('/DATA', '/DATA/Photos/2024')).toBe('Photos/2024') })
  it('容忍两侧末尾斜杠', () => { expect(relPathUnderMount('/DATA/', '/DATA/Photos/')).toBe('Photos') })
  it('路径不在该挂载点下 → 空串(退回卷根,不猜)', () => {
    expect(relPathUnderMount('/DATA', '/OTHER/x')).toBe('')
    expect(relPathUnderMount('/DATA', '/DATAX/x')).toBe('')
  })
  it('空输入 → 空串', () => { expect(relPathUnderMount('', '/DATA/x')).toBe('') })
})
```

追加到 `src/files/util/snapshotPath.ts`:

```ts
/** 当前路径相对卷根的部分 —— 时间机器用它决定卡片展示哪个目录、以及进入快照后落在哪里。
 *  路径不在该挂载点下时返回空串(退回卷根),不做任何猜测。 */
export function relPathUnderMount(mount: string, absPath: string): string {
  const m = stripTrailingSlash(mount)
  const p = stripTrailingSlash(absPath)
  if (!m || !p) return ''
  if (p === m) return ''
  if (!p.startsWith(`${m}/`)) return ''
  return p.slice(m.length + 1)
}
```

Run: `pnpm exec vitest run src/files/util/snapshotPath.test.ts` → PASS

- [ ] **Step 4: 底栏组件(先写测试)**

创建 `src/files/snapshot/TimeMachineBar.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import TimeMachineBar from './TimeMachineBar.vue'
import zh from '../../i18n/zh_cn'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const mountIt = (props = {}) =>
  mount(TimeMachineBar, { props: { momentText: '今天 14:30', canEnter: true, ...props }, global: { plugins: [i18n] } })

describe('TimeMachineBar', () => {
  it('居中显示选中时刻', () => { expect(mountIt().find('.tm-bar-moment').text()).toBe('今天 14:30') })
  it('取消 emit cancel', async () => {
    const w = mountIt(); await w.find('.tm-bar-cancel').trigger('click')
    expect(w.emitted('cancel')).toHaveLength(1)
  })
  it('进入 emit enter', async () => {
    const w = mountIt(); await w.find('.tm-bar-enter').trigger('click')
    expect(w.emitted('enter')).toHaveLength(1)
  })
  it('没有可进入的快照时按钮禁用且不 emit', async () => {
    const w = mountIt({ canEnter: false })
    expect(w.find('.tm-bar-enter').attributes('disabled')).toBeDefined()
    await w.find('.tm-bar-enter').trigger('click')
    expect(w.emitted('enter')).toBeUndefined()
  })
})
```

- [ ] **Step 5: 写底栏组件**

创建 `src/files/snapshot/TimeMachineBar.vue`:

```vue
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const props = defineProps<{ momentText: string; canEnter: boolean }>()
const emit = defineEmits<{ (e: 'cancel'): void; (e: 'enter'): void }>()
const { t } = useI18n()
function onEnter() { if (props.canEnter) emit('enter') }
</script>

<template>
  <div class="tm-bar">
    <button class="tm-bar-cancel" @click="emit('cancel')">{{ t('filesCancel') }}</button>
    <div class="tm-bar-moment">{{ props.momentText }}</div>
    <button class="tm-bar-enter" :disabled="!props.canEnter" @click="onEnter">{{ t('tmEnter') }}</button>
  </div>
</template>

<style scoped>
.tm-bar {
  position: absolute; left: 0; right: 0; bottom: 0; height: 76px;
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 28px; z-index: 2; color: var(--tm-fg);
}
.tm-bar-cancel {
  border: none; background: none; color: var(--tm-fg-muted);
  font-size: 13px; cursor: pointer; padding: 8px 4px;
}
.tm-bar-cancel:hover { color: var(--tm-fg); }
.tm-bar-moment { flex: 1 1 auto; text-align: center; font-size: 18px; font-weight: 600; }
.tm-bar-enter {
  border: none; border-radius: 999px; padding: 9px 20px; font-size: 13px; font-weight: 600;
  background: var(--accent); color: var(--on-accent); cursor: pointer;
  transition: transform 0.15s var(--ease), opacity 0.15s var(--ease);
}
.tm-bar-enter:hover:not(:disabled) { transform: translateY(-1px); }
.tm-bar-enter:disabled { opacity: 0.4; cursor: default; }
</style>
```

> `--on-accent` 只在 accent 实底上可用(既定教训),这里正是实底按钮,合规。

Run: `pnpm exec vitest run src/files/snapshot/TimeMachineBar.test.ts` → PASS(4 例)

- [ ] **Step 6: 覆盖层(先写测试)**

创建 `src/files/snapshot/TimeMachineOverlay.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import TimeMachineOverlay from './TimeMachineOverlay.vue'
import zh from '../../i18n/zh_cn'

const listMock = vi.fn()
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    snapshot: {
      list: (...a: unknown[]) => listMock(...a),
      listVolumes: vi.fn().mockResolvedValue([]), getPolicy: vi.fn(), patchPolicy: vi.fn(),
      togglePolicy: vi.fn(), create: vi.fn(), remove: vi.fn(),
    },
    folder: { getList: vi.fn().mockResolvedValue({ content: [] }) },
    image: { thumbUrl: (p: string) => `/v1/image?path=${p}` },
  },
}))

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const at = (d: number, h: number, m = 0) => new Date(2026, 6, d, h, m).toISOString()
const SNAPS = [
  { id: 1, name: '20260730T143000Z_manual_x', label: '改版前', type: 'manual', created_at: at(30, 14, 30) },
  { id: 2, name: '20260730T090000Z_auto', label: '', type: 'auto-hourly', created_at: at(30, 9) },
  { id: 3, name: '20260729T090000Z_preop', label: '', type: 'preop', created_at: at(29, 9) },
]

const mountIt = (props = {}) =>
  mount(TimeMachineOverlay, {
    props: { volumeUuid: 'u-data', mountPoint: '/DATA', relPath: 'Photos', folderLabel: '/磁盘/Photos', ...props },
    global: { plugins: [i18n] },
  })
const flush = async (w: ReturnType<typeof mountIt>) => {
  await new Promise((r) => setTimeout(r)); await w.vm.$nextTick(); await w.vm.$nextTick()
}

beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks(); listMock.mockResolvedValue(SNAPS) })

describe('TimeMachineOverlay 三态', () => {
  it('挂载即按卷拉快照列表', async () => {
    const w = mountIt(); await flush(w)
    expect(listMock).toHaveBeenCalledWith('u-data')
  })
  it('加载中显示骨架', async () => {
    listMock.mockImplementation(() => new Promise(() => {}))
    const w = mountIt(); await w.vm.$nextTick()
    expect(w.find('.tm-skeleton').exists()).toBe(true)
  })
  it('空列表显示空态,且齿轮仍可用', async () => {
    listMock.mockResolvedValue([])
    const w = mountIt(); await flush(w)
    expect(w.find('.tm-empty').exists()).toBe(true)
    expect(w.find('.tm-gear').exists()).toBe(true)
  })
  it('请求失败按空态处理,不抛错', async () => {
    listMock.mockRejectedValue(new Error('404'))
    const w = mountIt(); await flush(w)
    expect(w.find('.tm-empty').exists()).toBe(true)
  })
  it('就绪后底栏显示最新一张的时刻(默认选中最新)', async () => {
    const w = mountIt(); await flush(w)
    expect(w.find('.tm-bar-moment').text()).toContain('14:30')
  })
  it('顶部显示当前文件夹', async () => {
    const w = mountIt(); await flush(w)
    expect(w.find('.tm-folder').text()).toContain('/磁盘/Photos')
  })
})

describe('TimeMachineOverlay 选择与进入', () => {
  it('↑ 往更早、↓ 往更晚,两端夹紧', async () => {
    const w = mountIt(); await flush(w)
    document.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowUp' })); await w.vm.$nextTick()
    expect(w.find('.tm-bar-moment').text()).toContain('09:00')
    document.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowDown' })); await w.vm.$nextTick()
    expect(w.find('.tm-bar-moment').text()).toContain('14:30')
    document.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowDown' })); await w.vm.$nextTick()
    expect(w.find('.tm-bar-moment').text()).toContain('14:30') // 已经在最新,夹紧
  })
  it('Esc emit close', async () => {
    const w = mountIt(); await flush(w)
    document.dispatchEvent(new KeyboardEvent('keyup', { code: 'Escape' }))
    expect(w.emitted('close')).toHaveLength(1)
  })
  it('进入落在当前相对路径下,而不是快照根(对 Vue2 的改正)', async () => {
    const w = mountIt(); await flush(w)
    await w.find('.tm-bar-enter').trigger('click')
    expect(w.emitted('select')?.[0]?.[0]).toBe('/DATA/.snapshots/20260730T143000Z_manual_x/Photos')
  })
  it('在卷根打开时进入快照根', async () => {
    const w = mountIt({ relPath: '' }); await flush(w)
    await w.find('.tm-bar-enter').trigger('click')
    expect(w.emitted('select')?.[0]?.[0]).toBe('/DATA/.snapshots/20260730T143000Z_manual_x')
  })
  it('Enter 键等价于点进入', async () => {
    const w = mountIt(); await flush(w)
    document.dispatchEvent(new KeyboardEvent('keyup', { code: 'Enter' }))
    expect(w.emitted('select')).toHaveLength(1)
  })
  it('齿轮 emit open-settings', async () => {
    const w = mountIt(); await flush(w)
    await w.find('.tm-gear').trigger('click')
    expect(w.emitted('open-settings')).toHaveLength(1)
  })
  it('卸载后键盘监听解除(不会对已销毁组件继续 emit)', async () => {
    const w = mountIt(); await flush(w)
    w.unmount()
    document.dispatchEvent(new KeyboardEvent('keyup', { code: 'Escape' }))
    expect(w.emitted('close')).toBeUndefined()
  })
})
```

- [ ] **Step 7: 写覆盖层**

创建 `src/files/snapshot/TimeMachineOverlay.vue`:

```vue
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSnapshotStore } from '../../storage/stores/snapshot'
import { groupSnapshotsByDay } from '../../storage/util/snapshotView'
import { snapshotBrowsePath } from '../util/snapshotPath'
import { stepSelectedIndex } from '../util/timeMachineMath'
import TimeMachineBar from './TimeMachineBar.vue'

const props = defineProps<{
  volumeUuid: string
  mountPoint: string
  /** 当前目录相对卷根的路径,空串表示就在卷根 */
  relPath: string
  /** 顶部那行给人看的路径(虚拟路径,带磁盘显示名) */
  folderLabel: string
}>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'select', path: string): void; (e: 'open-settings'): void }>()

const { t } = useI18n()
const store = useSnapshotStore()
const selectedIndex = ref(0)

// 分组复用 SP6-P5 已验收的 groupSnapshotsByDay(不重写一套),再摊平成带 flatIndex 的列表:
// 卡堆、键盘步进、刻度尺全都在这个跨天的扁平下标上工作。
const groups = computed(() => {
  let i = 0
  return groupSnapshotsByDay(store.snapshots).map((g) => ({
    dayKey: g.dayKey,
    labelText: g.label.i18nKey ? t(g.label.i18nKey === 'Today' ? 'snapToday' : 'snapYesterday') : (g.label.text ?? ''),
    items: g.items.map((item) => ({ ...item, flatIndex: i++ })),
  }))
})
const flatItems = computed(() => groups.value.flatMap((g) => g.items.map((it) => ({ ...it, dayLabelText: g.labelText }))))
const selectedItem = computed(() => flatItems.value[selectedIndex.value] ?? null)
const momentText = computed(() => (selectedItem.value ? `${selectedItem.value.dayLabelText} ${selectedItem.value.time}` : ''))

async function load() {
  if (!props.volumeUuid) return
  await store.loadSnapshots(props.volumeUuid)
  // 每次(重新)拉列表都回到最新一张 —— 旧的下标在新列表里未必还指同一个快照
  selectedIndex.value = 0
}
defineExpose({ reload: load })

function enterSnapshot() {
  if (!props.mountPoint || !selectedItem.value) return
  const root = snapshotBrowsePath(props.mountPoint, selectedItem.value.name)
  // ⚠️ 对 Vue2 的有意改正(spec §4 第 1 条):Vue2 的 enterSnapshot 只跳快照根,用户在
  // /Photos/2024 打开时间机器、进去后被扔回卷根还得一层层点回来。卡片展示的就是当前
  // 文件夹在那一刻的样子,进入自然应落在同一个相对路径。
  emit('select', props.relPath ? `${root}/${props.relPath}` : root)
}

function onKeyup(e: KeyboardEvent) {
  const code = e.code || e.key
  if (code === 'Escape') { emit('close'); return }
  // 与真 Time Machine 一致:↑ 往过去(下标更大,列表是 newest-first),↓ 回到现在
  if (code === 'ArrowUp') { selectedIndex.value = stepSelectedIndex(selectedIndex.value, 1, flatItems.value.length); return }
  if (code === 'ArrowDown') { selectedIndex.value = stepSelectedIndex(selectedIndex.value, -1, flatItems.value.length); return }
  if (code === 'Enter') enterSnapshot()
}

onMounted(() => { load(); document.addEventListener('keyup', onKeyup) })
onUnmounted(() => { document.removeEventListener('keyup', onKeyup) })
watch(() => props.volumeUuid, () => { load() })
</script>

<template>
  <div class="tm-overlay" role="dialog" aria-modal="true" :aria-label="t('tmEntry')">
    <div class="tm-folder">{{ t('tmViewingFolder', { path: props.folderLabel }) }}</div>
    <button class="tm-gear" :aria-label="t('tmSettings')" @click="emit('open-settings')">⚙</button>

    <div v-if="store.listLoading" class="tm-skeleton" aria-hidden="true">
      <div v-for="n in 3" :key="n" class="tm-skeleton-card" :style="{ transform: `translateY(${(n - 1) * -14}px) scale(${1 - (n - 1) * 0.06})` }"></div>
    </div>

    <div v-else-if="flatItems.length === 0" class="tm-empty">
      <p class="tm-empty-title">{{ t('snapNoneYet') }}</p>
      <p class="tm-empty-sub">{{ t('snapEmptyHint') }}</p>
    </div>

    <template v-else>
      <!-- 卡堆:T8 换成 TimeMachineDeck,刻度尺:T10 换成 TimeMachineRail -->
      <div class="tm-stack-placeholder"></div>
    </template>

    <TimeMachineBar :moment-text="momentText" :can-enter="!!selectedItem" @cancel="emit('close')" @enter="enterSnapshot" />
  </div>
</template>

<style scoped>
.tm-overlay {
  /* z-index 900:高过文件区里的一切(全库文件区最高是 240),但**低于** Dialog.vue 的
     1000/1001 —— 这样 T11 的齿轮设置弹窗天然叠在时间机器之上,不需要任何 z-index 覆写。
     Vue2 那版把轮盘设到 4000、再想办法把弹窗抬到 4500,结果踩了 `::v-deep .modal` 编译成
     后代选择器却匹配不到 teleport 出去的根节点这个坑(见 Vue2 SnapshotSettingsModal.vue
     的 Fix Round 1 注释)。这里从一开始就不制造那个问题。 */
  position: fixed; inset: 0; z-index: 900; overflow: hidden;
  display: flex; align-items: center; justify-content: center;
  background: var(--tm-bg); color: var(--tm-fg);
}
.tm-folder { position: absolute; top: 22px; left: 28px; font-size: 13px; color: var(--tm-fg-muted); }
.tm-gear {
  position: absolute; top: 16px; right: 24px; z-index: 2;
  border: none; background: none; color: var(--tm-fg-muted);
  font-size: 20px; line-height: 1; cursor: pointer;
  transition: transform 0.2s var(--ease), color 0.2s var(--ease);
}
.tm-gear:hover { color: var(--tm-fg); transform: rotate(45deg); }
.tm-empty { text-align: center; }
.tm-empty-title { font-size: 18px; font-weight: 600; margin: 0 0 6px; }
.tm-empty-sub { font-size: 13px; color: var(--tm-fg-muted); margin: 0; }
.tm-skeleton { position: relative; width: min(420px, 68vw); height: min(240px, 38vh); }
.tm-skeleton-card {
  position: absolute; inset: 0; border-radius: 18px;
  background: var(--tm-card-bg); border: 1px solid var(--tm-card-bd); box-shadow: var(--tm-card-shadow);
  opacity: 0.6;
}
.tm-stack-placeholder { width: min(420px, 68vw); height: min(240px, 38vh); }
</style>
```

Run: `pnpm exec vitest run src/files/snapshot/TimeMachineOverlay.test.ts` → PASS(12 例)

> ⚠️ `groups` 里把 `snapshotDayLabel` 的 `i18nKey`(`'Today'` / `'Yesterday'`)映射成本仓库的键 `snapToday` / `snapYesterday` —— 这是 SP6-P5 的 `SnapshotTimeline.vue` 已经在做的同一件事,**动手前先读它那段**照抄写法,不要自创第三种映射。

- [ ] **Step 7.5: 焦点管理(spec §6 无障碍)**

先补测试到 `TimeMachineOverlay.test.ts`:

```ts
describe('焦点管理', () => {
  it('打开时焦点移入覆盖层', async () => {
    const trigger = document.createElement('button')
    document.body.appendChild(trigger); trigger.focus()
    const w = mount(TimeMachineOverlay, {
      props: { volumeUuid: 'u-data', mountPoint: '/DATA', relPath: '', folderLabel: '/磁盘' },
      global: { plugins: [i18n] }, attachTo: document.body,
    })
    await flush(w)
    expect(document.activeElement).toBe(w.find('.tm-overlay').element)
  })
  it('关闭时焦点归还给打开它的元素', async () => {
    const trigger = document.createElement('button')
    document.body.appendChild(trigger); trigger.focus()
    const w = mount(TimeMachineOverlay, {
      props: { volumeUuid: 'u-data', mountPoint: '/DATA', relPath: '', folderLabel: '/磁盘' },
      global: { plugins: [i18n] }, attachTo: document.body,
    })
    await flush(w)
    w.unmount()
    expect(document.activeElement).toBe(trigger)
  })
})
```

实现:`TimeMachineOverlay.vue` 根元素加 `ref="rootEl"` 与 `tabindex="-1"`,脚本补:

```ts
const rootEl = ref<HTMLElement | null>(null)
let previouslyFocused: HTMLElement | null = null

onMounted(() => {
  // 全屏覆盖层接管了整个视口,焦点必须跟着进来 —— 否则键盘用户按 Tab 会在下面那层
  // 看不见的文件区里游走。卸载时归还,回到打开它的那颗按钮上。
  previouslyFocused = document.activeElement as HTMLElement | null
  rootEl.value?.focus()
})
onUnmounted(() => { previouslyFocused?.focus?.() })
```

Run: `pnpm exec vitest run src/files/snapshot/TimeMachineOverlay.test.ts` → PASS

- [ ] **Step 8: 接进 Files.vue(入口 chip + 挂载 + 进入导航)**

import:

```ts
import TimeMachineOverlay from '../files/snapshot/TimeMachineOverlay.vue'
import { relPathUnderMount } from '../files/util/snapshotPath'
```

派生:

```ts
// 时间机器要知道当前目录相对卷根的位置:卡片按它展示"那一刻的这个文件夹",
// 进入后也落在同一个相对路径上。
const snapshotRelPath = computed(() => relPathUnderMount(browse.currentVolume?.mount ?? '', files.currentPath))

function onSnapshotSelect(path: string) {
  browse.closeWheel()
  goVirtual(toVirtualPath(path, files.displayNames))
}
```

模板顶栏(在 `.files-actions` 之前)加入口 chip:

```html
            <button v-if="browse.canShowEntry" class="chip tb-time-machine" @click="browse.openWheel()">
              {{ t('tmEntry') }}
            </button>
```

模板末尾(与 `<ViewerHost />` 同级)挂覆盖层:

```html
    <TimeMachineOverlay
      v-if="browse.wheelOpen"
      :volume-uuid="browse.currentVolume?.volume_uuid ?? ''"
      :mount-point="browse.currentVolume?.mount ?? ''"
      :rel-path="snapshotRelPath"
      :folder-label="currentVirtual"
      @close="browse.closeWheel()"
      @select="onSnapshotSelect"
      @open-settings="() => {}"
    />
```

> `@open-settings` 是 T11 的接线点,先留空。

- [ ] **Step 9: Files.vue 集成测试**

追加到 `src/views/Files.test.ts`:

```ts
describe('时间机器入口', () => {
  it('supported 卷上出现入口 chip', async () => {
    const w = await mountFiles('/DATA/Photos') // listVolumes mock 需返回 supported:true 的 /DATA
    expect(w.find('.tb-time-machine').exists()).toBe(true)
  })
  it('已经在快照里时不出现入口 chip', async () => {
    const w = await mountFiles('/DATA/.snapshots/snap1')
    expect(w.find('.tb-time-machine').exists()).toBe(false)
  })
  it('点入口打开覆盖层', async () => {
    const w = await mountFiles('/DATA/Photos')
    await w.find('.tb-time-machine').trigger('click')
    expect(w.find('.tm-overlay').exists()).toBe(true)
  })
})
```

- [ ] **Step 10: 全量测试 + 类型检查 + 颜色自查 + 提交**

```bash
pnpm test
pnpm exec vue-tsc --noEmit
git diff --cached -- src/files src/views | grep -nE '#[0-9a-fA-F]{3,8}|rgba?\(' || echo "无新增硬编码颜色"
git add -A src/files src/views/Files.vue src/styles/theme.css src/i18n
git commit -m "feat(files): 时间机器骨架+主题token+入口+进入落点改正(T7)"
```

---

### Task 8: 3D 卡堆(`TimeMachineDeck.vue` + `TimeMachineCard.vue`)

本任务只做纯文字卡与三段式变换,缩略图预览在 T9。

**Files:**
- Create: `src/files/snapshot/TimeMachineCard.vue` + `.test.ts`
- Create: `src/files/snapshot/TimeMachineDeck.vue` + `.test.ts`
- Modify: `src/files/snapshot/TimeMachineOverlay.vue`(用 Deck 替换占位块)
- Modify: `src/files/snapshot/TimeMachineOverlay.test.ts`(补一条卡堆渲染断言)

**Interfaces:**
- Consumes: T2 `buildVisibleStack` / `StackEntry`;T7 的 `FlatSnapshotItem`
- Produces:
  ```ts
  // TimeMachineCard.vue
  defineProps<{
    item: { time: string; dayLabelText: string; label: string; typeKind: 'auto'|'manual'|'preop'; typeLabelKey: string }
    state: 'front' | 'behind' | 'past'
    depth: number
    preview?: DeckPreview | null   // T9 才传;T8 恒为 undefined
  }>()
  // TimeMachineDeck.vue
  defineProps<{ items: FlatSnapshotItem[]; selectedIndex: number; previews?: Record<string, DeckPreview> }>()
  defineEmits<{ (e: 'select', index: number): void; (e: 'enter'): void }>()
  ```

- [ ] **Step 1: 卡片测试**

创建 `src/files/snapshot/TimeMachineCard.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import TimeMachineCard from './TimeMachineCard.vue'
import zh from '../../i18n/zh_cn'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const ITEM = { time: '14:30', dayLabelText: '今天', label: '改版前', typeKind: 'manual' as const, typeLabelKey: 'snapTypeManual' }
const mountIt = (props = {}) =>
  mount(TimeMachineCard, { props: { item: ITEM, state: 'front' as const, depth: 0, ...props }, global: { plugins: [i18n] } })

describe('TimeMachineCard', () => {
  it('显示时间、日期、类型徽章、备注', () => {
    const text = mountIt().text()
    expect(text).toContain('14:30')
    expect(text).toContain('今天')
    expect(text).toContain('手动')
    expect(text).toContain('改版前')
  })
  it('没有备注时不渲染备注行', () => {
    expect(mountIt({ item: { ...ITEM, label: '' } }).find('.tm-card-label').exists()).toBe(false)
  })
  it('按状态与层数落 class(变换全交给 CSS)', () => {
    expect(mountIt({ state: 'behind', depth: 2 }).classes()).toEqual(expect.arrayContaining(['tm-card', 'is-behind', 'depth-2']))
    expect(mountIt({ state: 'past', depth: 1 }).classes()).toContain('is-past')
  })
  it('类型着色 class 三选一', () => {
    expect(mountIt().classes()).toContain('type-manual')
    expect(mountIt({ item: { ...ITEM, typeKind: 'auto', typeLabelKey: 'snapTypeAuto' } }).classes()).toContain('type-auto')
    expect(mountIt({ item: { ...ITEM, typeKind: 'preop', typeLabelKey: 'snapTypePreop' } }).classes()).toContain('type-preop')
  })
})
```

- [ ] **Step 2: 写卡片组件**

创建 `src/files/snapshot/TimeMachineCard.vue`:

```vue
<script setup lang="ts">
import { useI18n } from 'vue-i18n'

export interface TimeMachineCardItem {
  time: string
  dayLabelText: string
  label: string
  typeKind: 'auto' | 'manual' | 'preop'
  typeLabelKey: string
}

const props = defineProps<{
  item: TimeMachineCardItem
  state: 'front' | 'behind' | 'past'
  depth: number
}>()
const { t } = useI18n()
</script>

<template>
  <!-- 变换全部由 class 驱动的 CSS 决定(不写内联 transform):同一批 DOM 节点在选中变化时
       只换 class,浏览器就能沿着已声明的 transition 平滑过渡,无需任何 JS 动画循环。 -->
  <div
    class="tm-card"
    :class="[`is-${props.state}`, `depth-${props.depth}`, `type-${props.item.typeKind}`]"
  >
    <span class="tm-card-badge">{{ t(props.item.typeLabelKey) }}</span>
    <span class="tm-card-day">{{ props.item.dayLabelText }}</span>
    <span class="tm-card-time">{{ props.item.time }}</span>
    <span v-if="props.item.label" class="tm-card-label">{{ props.item.label }}</span>
  </div>
</template>

<style scoped>
.tm-card {
  position: absolute; inset: 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;
  padding: 20px; border-radius: 18px; text-align: center; cursor: pointer;
  color: var(--tm-fg); background: var(--tm-card-bg);
  border: 1px solid var(--tm-card-bd); box-shadow: var(--tm-card-shadow);
  transform-origin: center top;
  transition: transform 0.45s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.4s var(--ease), filter 0.4s var(--ease);
}
/* 选中(最前) */
.is-front { transform: translate3d(0, 0, 0) scale(1); z-index: 50; opacity: 1; }
/* 更老的快照往后退 */
.is-behind.depth-1 { transform: translate3d(0, -16px, -70px) rotateX(2deg) scale(0.94); z-index: 40; opacity: 0.86; filter: brightness(0.86); }
.is-behind.depth-2 { transform: translate3d(0, -30px, -140px) rotateX(4deg) scale(0.88); z-index: 30; opacity: 0.7; filter: brightness(0.7); }
.is-behind.depth-3 { transform: translate3d(0, -42px, -210px) rotateX(6deg) scale(0.82); z-index: 20; opacity: 0.52; filter: brightness(0.56); }
.is-behind.depth-4 { transform: translate3d(0, -52px, -280px) rotateX(8deg) scale(0.76); z-index: 10; opacity: 0.34; filter: brightness(0.44); }
/* 已经翻过去的(更新的)快照朝观众飞出屏幕下方 —— 参考稿的 isPast 分支 */
.is-past { transform: translate3d(0, 300px, 200px) rotateX(-20deg) scale(1.3); opacity: 0; z-index: 60; pointer-events: none; }

.tm-card-badge {
  font-size: 10px; font-weight: 700; letter-spacing: 0.6px;
  padding: 2px 8px; border-radius: 999px;
  background: var(--nrm-bg); color: var(--nrm-fg);
}
.type-manual .tm-card-badge { background: var(--accent-soft); color: var(--accent-text); }
.type-preop .tm-card-badge { background: var(--dem-bg); color: var(--dem-fg); }
/* 类型只给最前那张卡描边着色(与刻度尺、存储区时间线同一套三色系统) */
.is-front.type-manual { border-color: var(--accent-soft-bd); }
.is-front.type-preop { border-color: var(--dem-bd); }

.tm-card-day { font-size: 12px; color: var(--tm-fg-muted); }
.tm-card-time { font-size: 30px; font-weight: 600; line-height: 1.1; }
.tm-card-label {
  font-size: 12px; color: var(--tm-fg-muted); max-width: 90%;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
@media (prefers-reduced-motion: reduce) { .tm-card { transition: none; } }
</style>
```

Run: `pnpm exec vitest run src/files/snapshot/TimeMachineCard.test.ts` → PASS(4 例)

- [ ] **Step 3: 卡堆测试**

创建 `src/files/snapshot/TimeMachineDeck.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import TimeMachineDeck from './TimeMachineDeck.vue'
import zh from '../../i18n/zh_cn'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const mkItem = (i: number) => ({
  id: i, name: `snap-${i}`, label: '', typeKind: 'auto' as const, typeLabelKey: 'snapTypeAuto',
  time: `0${i}:00`, createdAt: '', flatIndex: i, dayLabelText: '今天',
})
const ITEMS = Array.from({ length: 8 }, (_, i) => mkItem(i))
const mountIt = (props = {}) =>
  mount(TimeMachineDeck, { props: { items: ITEMS, selectedIndex: 3, ...props }, global: { plugins: [i18n] } })

describe('TimeMachineDeck', () => {
  it('只渲染可见窗口的卡片(5 张后退 + 2 张飞走),不是全部 8 张', () => {
    expect(mountIt().findAll('.tm-card')).toHaveLength(7)
  })
  it('选中那张是 is-front', () => {
    const front = mountIt().findAll('.tm-card').filter((c) => c.classes().includes('is-front'))
    expect(front).toHaveLength(1)
    expect(front[0].text()).toContain('03:00')
  })
  it('点后面的卡只换选中,不进入', async () => {
    const w = mountIt()
    const behind = w.findAll('.tm-card').find((c) => c.classes().includes('depth-2'))!
    await behind.trigger('click')
    expect(w.emitted('select')?.[0]?.[0]).toBe(5)
    expect(w.emitted('enter')).toBeUndefined()
  })
  it('点最前那张 = 进入(和真 Time Machine 一致)', async () => {
    const w = mountIt()
    await w.findAll('.tm-card').find((c) => c.classes().includes('is-front'))!.trigger('click')
    expect(w.emitted('enter')).toHaveLength(1)
    expect(w.emitted('select')).toBeUndefined()
  })
  it('飞走的卡不吃点击(pointer-events:none 由 CSS 保证,这里断言不 emit)', async () => {
    const w = mountIt()
    const past = w.findAll('.tm-card').find((c) => c.classes().includes('is-past'))!
    await past.trigger('click')
    expect(w.emitted('enter')).toBeUndefined()
    expect(w.emitted('select')).toBeUndefined()
  })
  it('空列表渲染 0 张卡且不报错', () => {
    expect(mountIt({ items: [] }).findAll('.tm-card')).toHaveLength(0)
  })
  it('key 用快照 name(选中变化时复用同一批 DOM,才有平滑过渡)', () => {
    const w = mountIt()
    const first = w.findAll('.tm-card')[0].element
    w.setProps({ selectedIndex: 4 })
    expect(w.findAll('.tm-card').some((c) => c.element === first)).toBe(true)
  })
})
```

- [ ] **Step 4: 写卡堆组件**

创建 `src/files/snapshot/TimeMachineDeck.vue`:

```vue
<script setup lang="ts">
import { computed } from 'vue'
import TimeMachineCard from './TimeMachineCard.vue'
import { buildVisibleStack } from '../util/timeMachineMath'

// 形状与 T7 覆盖层里的 FlatSnapshotItem 一致(TS 结构类型,不需要互相 import);
// 这里独立声明是为了让卡堆不依赖覆盖层,单测可以直接造数据。
export interface DeckItem {
  id?: number | string
  name: string
  label: string
  typeKind: 'auto' | 'manual' | 'preop'
  typeLabelKey: string
  time: string
  createdAt: string
  flatIndex: number
  dayLabelText: string
}

const props = defineProps<{ items: DeckItem[]; selectedIndex: number }>()
const emit = defineEmits<{ (e: 'select', index: number): void; (e: 'enter'): void }>()

// 只渲染可见窗口(选中 + 后 4 张 + 已翻过去的 2 张),而不是整个列表:一个卷可能保留
// 上百个快照,全渲染成绝对定位卡片纯属浪费。
const visible = computed(() => buildVisibleStack(props.items, props.selectedIndex, 5, 2))

function onCardClick(entry: { index: number; state: string }) {
  if (entry.state === 'past') return // 已经飞出屏幕的卡不接受点击
  if (entry.state === 'front') emit('enter') // 点你正在看的那张 = 进去,和真 Time Machine 一致
  else emit('select', entry.index)
}
</script>

<template>
  <div class="tm-deck">
    <div class="tm-deck-inner">
      <TimeMachineCard
        v-for="entry in visible"
        :key="entry.item.name"
        :item="entry.item"
        :state="entry.state"
        :depth="entry.depth"
        @click="onCardClick(entry)"
      />
    </div>
  </div>
</template>

<style scoped>
.tm-deck { position: relative; width: min(460px, 68vw); height: min(280px, 40vh); perspective: 1400px; }
.tm-deck-inner { position: relative; width: 100%; height: 100%; transform-style: preserve-3d; }
</style>
```

Run: `pnpm exec vitest run src/files/snapshot/TimeMachineDeck.test.ts` → PASS(7 例)

- [ ] **Step 5: 换掉 Overlay 里的占位块**

`TimeMachineOverlay.vue`:import `TimeMachineDeck`,把 `<div class="tm-stack-placeholder"></div>` 换成:

```html
        <TimeMachineDeck
          :items="flatItems"
          :selected-index="selectedIndex"
          @select="(i: number) => (selectedIndex = i)"
          @enter="enterSnapshot"
        />
```

并删掉 `.tm-stack-placeholder` 那条样式。

追加一条 Overlay 测试:

```ts
  it('就绪后渲染卡堆,最前那张是最新快照', async () => {
    const w = mountIt(); await flush(w)
    const front = w.findAll('.tm-card').find((c) => c.classes().includes('is-front'))!
    expect(front.text()).toContain('14:30')
  })
```

- [ ] **Step 6: 全量测试 + 类型检查 + 提交**

```bash
pnpm test && pnpm exec vue-tsc --noEmit
git add -A src/files/snapshot
git commit -m "feat(files): 时间机器 3D 卡堆(T8)"
```

---

### Task 9: 卡片显示"那一刻的这个文件夹"(`useDeckPreview.ts`)

给可见卡片拉快照侧目录列表,渲染 3×2 缩略图格 + 项数。失败/目录不存在都有明确降级。

**Files:**
- Create: `src/files/composables/useDeckPreview.ts` + `.test.ts`
- Modify: `src/files/snapshot/TimeMachineCard.vue` + `.test.ts`
- Modify: `src/files/snapshot/TimeMachineDeck.vue`(透传 preview)
- Modify: `src/files/snapshot/TimeMachineOverlay.vue`(接 composable)

**Interfaces:**
- Consumes: `service.folder.getList(path)`(已解信封,返回 `{ content: FileEntry[] }`);`service.image.thumbUrl(path)`;既有 `files/util/isImage` 的 `isImageEntry`;既有 `files/util/icons` 的 `iconNameFor` / `iconUrl`;T1 `snapshotBrowsePath`
- Produces:
  ```ts
  export interface DeckPreviewTile { path: string; name: string; isImage: boolean; isDir: boolean }
  export interface DeckPreview { status: 'loading' | 'ready' | 'missing' | 'failed'; tiles: DeckPreviewTile[]; total: number }
  export function useDeckPreview(opts: {
    mountPoint: () => string
    relPath: () => string
    visibleNames: () => string[]
  }): { previews: Ref<Record<string, DeckPreview>> }
  ```

- [ ] **Step 1: 写 composable 测试**

创建 `src/files/composables/useDeckPreview.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, nextTick } from 'vue'
import { useDeckPreview } from './useDeckPreview'

const getListMock = vi.fn()
vi.mock('@nimotech/nimoos-service', () => ({
  service: { folder: { getList: (p: string) => getListMock(p) }, image: { thumbUrl: (p: string) => `/v1/image?path=${p}` } },
}))

const CONTENT = [
  { name: 'a.jpg', path: '/x/a.jpg', is_dir: false },
  { name: 'b.png', path: '/x/b.png', is_dir: false },
  { name: 'notes.txt', path: '/x/notes.txt', is_dir: false },
  { name: 'sub', path: '/x/sub', is_dir: true },
  { name: 'c.jpg', path: '/x/c.jpg', is_dir: false },
  { name: 'd.jpg', path: '/x/d.jpg', is_dir: false },
  { name: 'e.jpg', path: '/x/e.jpg', is_dir: false },
  { name: 'f.jpg', path: '/x/f.jpg', is_dir: false },
]

const setup = (names: string[], relPath = 'Photos') => {
  const visible = ref(names)
  const api = useDeckPreview({ mountPoint: () => '/DATA', relPath: () => relPath, visibleNames: () => visible.value })
  return { api, visible }
}
const flush = async () => { await new Promise((r) => setTimeout(r)); await nextTick() }

beforeEach(() => { vi.clearAllMocks(); getListMock.mockResolvedValue({ content: CONTENT }) })

describe('useDeckPreview', () => {
  it('按 <快照根>/<相对路径> 拉目录', async () => {
    setup(['snap1']); await flush()
    expect(getListMock).toHaveBeenCalledWith('/DATA/.snapshots/snap1/Photos')
  })
  it('相对路径为空时拉快照根', async () => {
    setup(['snap1'], ''); await flush()
    expect(getListMock).toHaveBeenCalledWith('/DATA/.snapshots/snap1')
  })
  it('最多取 6 个瓦片,total 是真实条目数', async () => {
    const { api } = setup(['snap1']); await flush()
    expect(api.previews.value.snap1.tiles).toHaveLength(6)
    expect(api.previews.value.snap1.total).toBe(8)
    expect(api.previews.value.snap1.status).toBe('ready')
  })
  it('标出图片瓦片(缩略图)与非图片瓦片(类型图标)', async () => {
    const { api } = setup(['snap1']); await flush()
    const tiles = api.previews.value.snap1.tiles
    expect(tiles[0]).toMatchObject({ name: 'a.jpg', isImage: true })
    expect(tiles.find((t) => t.name === 'notes.txt')?.isImage).toBe(false)
    expect(tiles.find((t) => t.name === 'sub')?.isDir).toBe(true)
  })
  it('同一个快照名只拉一次(来回拨刻度不重复请求)', async () => {
    const { visible } = setup(['snap1']); await flush()
    visible.value = ['snap2']; await flush()
    visible.value = ['snap1']; await flush()
    expect(getListMock).toHaveBeenCalledTimes(2)
  })
  it('目录在该快照里不存在 → missing', async () => {
    getListMock.mockRejectedValue(Object.assign(new Error('no'), { code: 404 }))
    const { api } = setup(['snap1']); await flush()
    expect(api.previews.value.snap1.status).toBe('missing')
  })
  it('其它失败 → failed(静默降级,不抛错)', async () => {
    getListMock.mockRejectedValue(new Error('boom'))
    const { api } = setup(['snap1']); await flush()
    expect(api.previews.value.snap1.status).toBe('failed')
  })
  it('空目录 → ready + 0 瓦片 + total 0', async () => {
    getListMock.mockResolvedValue({ content: [] })
    const { api } = setup(['snap1']); await flush()
    expect(api.previews.value.snap1).toMatchObject({ status: 'ready', total: 0 })
  })
  it('可见集合变化时给新出现的快照补拉', async () => {
    const { visible } = setup(['snap1']); await flush()
    visible.value = ['snap1', 'snap2', 'snap3']; await flush()
    expect(getListMock).toHaveBeenCalledTimes(3)
  })
  it('相对路径变了要清缓存重拉(不同目录不能复用)', async () => {
    const relPath = ref('Photos')
    const visible = ref(['snap1'])
    useDeckPreview({ mountPoint: () => '/DATA', relPath: () => relPath.value, visibleNames: () => visible.value })
    await flush()
    relPath.value = 'Docs'; await flush()
    expect(getListMock).toHaveBeenLastCalledWith('/DATA/.snapshots/snap1/Docs')
    expect(getListMock).toHaveBeenCalledTimes(2)
  })
})
```

- [ ] **Step 2: 跑测试确认失败,然后实现**

创建 `src/files/composables/useDeckPreview.ts`:

```ts
import { ref, watch, type Ref } from 'vue'
import { service } from '@nimotech/nimoos-service'
import { snapshotBrowsePath } from '../util/snapshotPath'
import { isImageEntry } from '../util/isImage'
import type { FileEntry } from '../stores/files'

const MAX_TILES = 6

export interface DeckPreviewTile { path: string; name: string; isImage: boolean; isDir: boolean }
export interface DeckPreview {
  status: 'loading' | 'ready' | 'missing' | 'failed'
  tiles: DeckPreviewTile[]
  total: number
}

// 卡片上的"那一刻这个文件夹长什么样":快照内容就是普通只读目录,所以直接用文件区现成的
// 列目录接口读 <快照根>/<当前相对路径>。只给**当前可见的**几张卡拉(卡堆窗口是 5+2 张),
// 结果按快照名缓存 —— 来回拨刻度不会重复打请求。
export function useDeckPreview(opts: {
  mountPoint: () => string
  relPath: () => string
  visibleNames: () => string[]
}): { previews: Ref<Record<string, DeckPreview>> } {
  const previews = ref<Record<string, DeckPreview>>({})
  let cacheKey = ''

  async function fetchOne(name: string) {
    const dir = opts.relPath()
      ? `${snapshotBrowsePath(opts.mountPoint(), name)}/${opts.relPath()}`
      : snapshotBrowsePath(opts.mountPoint(), name)
    previews.value = { ...previews.value, [name]: { status: 'loading', tiles: [], total: 0 } }
    try {
      const data = await service.folder.getList(dir)
      const content = ((data as { content?: FileEntry[] })?.content ?? []).filter((e) => !e.name.startsWith('.'))
      const tiles = content.slice(0, MAX_TILES).map((e) => ({
        path: e.path, name: e.name, isImage: isImageEntry(e), isDir: !!e.is_dir,
      }))
      previews.value = { ...previews.value, [name]: { status: 'ready', tiles, total: content.length } }
    } catch (e) {
      // 404 = 那时候还没有这个文件夹(卡片要说人话);其它一律 failed,静默退回纯文字卡。
      const code = (e as { code?: number; response?: { status?: number } })?.code
        ?? (e as { response?: { status?: number } })?.response?.status
      previews.value = {
        ...previews.value,
        [name]: { status: code === 404 ? 'missing' : 'failed', tiles: [], total: 0 },
      }
    }
  }

  watch(
    () => [opts.mountPoint(), opts.relPath(), opts.visibleNames().join('|')].join('::'),
    () => {
      const key = `${opts.mountPoint()}::${opts.relPath()}`
      // 换了卷或换了目录,之前缓存的目录内容全部作废
      if (key !== cacheKey) { cacheKey = key; previews.value = {} }
      if (!opts.mountPoint()) return
      for (const name of opts.visibleNames()) {
        if (!previews.value[name]) fetchOne(name)
      }
    },
    { immediate: true },
  )

  return { previews }
}
```

Run: `pnpm exec vitest run src/files/composables/useDeckPreview.test.ts` → PASS(10 例)

- [ ] **Step 3: 卡片渲染缩略图格(先补测试)**

追加到 `src/files/snapshot/TimeMachineCard.test.ts`:

```ts
describe('卡片缩略图格', () => {
  const preview = {
    status: 'ready' as const,
    total: 15,
    tiles: [
      { path: '/s/a.jpg', name: 'a.jpg', isImage: true, isDir: false },
      { path: '/s/n.txt', name: 'n.txt', isImage: false, isDir: false },
    ],
  }
  it('图片瓦片用缩略图 URL,非图片用类型图标', () => {
    const w = mountIt({ preview })
    const imgs = w.findAll('.tm-tile img')
    expect(imgs[0].attributes('src')).toContain('/v1/image')
    expect(imgs[1].attributes('src')).not.toContain('/v1/image')
  })
  it('总数多于瓦片数时显示 +N', () => {
    expect(mountIt({ preview }).find('.tm-tile-more').text()).toBe('+13')
  })
  it('显示项数', () => { expect(mountIt({ preview }).text()).toContain('15 项') })
  it('目录当时不存在 → 说人话,不显示空格子', () => {
    const w = mountIt({ preview: { status: 'missing', tiles: [], total: 0 } })
    expect(w.text()).toContain('此时还没有这个文件夹')
    expect(w.find('.tm-tiles').exists()).toBe(false)
  })
  it('拉取失败 → 退回纯文字卡,不显示报错', () => {
    const w = mountIt({ preview: { status: 'failed', tiles: [], total: 0 } })
    expect(w.find('.tm-tiles').exists()).toBe(false)
    expect(w.text()).toContain('14:30')
    expect(w.text()).not.toContain('失败')
  })
  it('没有 preview(还没拉)→ 纯文字卡', () => {
    expect(mountIt().find('.tm-tiles').exists()).toBe(false)
  })
})
```

- [ ] **Step 4: 卡片实现补预览**

`TimeMachineCard.vue` 加 prop `preview?: DeckPreview | null`,并在 `.tm-card-badge` 之前插入:

```html
    <div v-if="props.preview?.status === 'ready' && props.preview.tiles.length" class="tm-tiles">
      <span v-for="tile in props.preview.tiles" :key="tile.path" class="tm-tile">
        <img :src="tileSrc(tile)" alt="" loading="lazy" @error="onTileError" />
      </span>
      <span v-if="moreCount > 0" class="tm-tile tm-tile-more">+{{ moreCount }}</span>
    </div>
    <span v-else-if="props.preview?.status === 'missing'" class="tm-card-missing">{{ t('tmNoFolderAtTime') }}</span>
```

并在项数行(类型徽章旁)加 `<span v-if="props.preview?.status === 'ready'" class="tm-card-count">{{ t('tmItemCount', { n: props.preview.total }) }}</span>`。

脚本补:

```ts
import { service } from '@nimotech/nimoos-service'
import { iconNameFor, iconUrl } from '../util/icons'
import type { DeckPreview, DeckPreviewTile } from '../composables/useDeckPreview'

const moreCount = computed(() => {
  const p = props.preview
  return p && p.status === 'ready' ? Math.max(0, p.total - p.tiles.length) : 0
})
function tileSrc(tile: DeckPreviewTile): string {
  return tile.isImage
    ? service.image.thumbUrl(tile.path)
    : iconUrl(iconNameFor({ name: tile.name, path: tile.path, is_dir: tile.isDir }))
}
// 缩略图 404 时静默换成类型图标,不让卡片上出现破图
function onTileError(e: Event) {
  const img = e.target as HTMLImageElement
  img.src = iconUrl('unknown')
}
```

样式(全部 token,3×2 网格):

```css
.tm-tiles { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; width: 78%; margin-bottom: 4px; }
.tm-tile {
  aspect-ratio: 1 / 1; display: flex; align-items: center; justify-content: center;
  border-radius: 6px; overflow: hidden; background: var(--nrm-bg);
  font-size: 11px; color: var(--tm-fg-muted);
}
.tm-tile img { width: 100%; height: 100%; object-fit: cover; }
.tm-card-count { font-size: 11px; color: var(--tm-fg-muted); }
.tm-card-missing { font-size: 12px; color: var(--tm-fg-muted); }
```

> ⚠️ `iconNameFor` 的入参形状要以 `src/files/util/icons.ts` 的真实签名为准,**动手前先读**;若它要求完整 `FileEntry`,就补齐缺的可选字段,不要改 icons.ts。

- [ ] **Step 5: Deck 与 Overlay 透传**

- `TimeMachineDeck.vue` 加 prop `previews?: Record<string, DeckPreview>`,传给卡片:`:preview="props.previews?.[entry.item.name] ?? null"`。
- `TimeMachineOverlay.vue`:

```ts
import { useDeckPreview } from '../composables/useDeckPreview'
import { buildVisibleStack } from '../util/timeMachineMath'

// 只给卡堆窗口里那几张拉预览
const visibleNames = computed(() =>
  buildVisibleStack(flatItems.value, selectedIndex.value, 5, 2).map((e) => e.item.name))
const { previews } = useDeckPreview({
  mountPoint: () => props.mountPoint,
  relPath: () => props.relPath,
  visibleNames: () => visibleNames.value,
})
```

模板给 Deck 加 `:previews="previews"`。

- [ ] **Step 6: 全量测试 + 类型检查 + 提交**

```bash
pnpm test && pnpm exec vue-tsc --noEmit
git add -A src/files
git commit -m "feat(files): 时间机器卡片显示那一刻的文件夹缩略图(T9)"
```

---

### Task 10: 右侧刻度尺(`TimeMachineRail.vue`)

主刻度(每个快照一条)+ 装饰子刻度 + 按天分组标题 + 悬停日期标签 + 连续鱼眼放大(rAF 节流)。

**Files:**
- Create: `src/files/snapshot/TimeMachineRail.vue` + `.test.ts`
- Modify: `src/files/snapshot/TimeMachineOverlay.vue` + `.test.ts`

**Interfaces:**
- Consumes: T2 `buildRailNodes` / `computeFisheyeScales`
- Produces:
  ```ts
  defineProps<{
    groups: { dayKey: string; labelText: string; items: { flatIndex: number; time: string; typeKind: 'auto'|'manual'|'preop' }[] }[]
    selectedIndex: number
  }>()
  defineEmits<{ (e: 'select', index: number): void }>()
  ```

- [ ] **Step 1: 写测试**

创建 `src/files/snapshot/TimeMachineRail.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import TimeMachineRail from './TimeMachineRail.vue'
import zh from '../../i18n/zh_cn'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const GROUPS = [
  { dayKey: '2026-07-30', labelText: '今天', items: [
    { flatIndex: 0, time: '14:30', typeKind: 'manual' as const },
    { flatIndex: 1, time: '09:00', typeKind: 'auto' as const },
  ] },
  { dayKey: '2026-07-29', labelText: '昨天', items: [
    { flatIndex: 2, time: '09:00', typeKind: 'preop' as const },
  ] },
]
const mountIt = (props = {}) =>
  mount(TimeMachineRail, { props: { groups: GROUPS, selectedIndex: 0, ...props }, global: { plugins: [i18n] } })

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { cb(0); return 1 })
  vi.stubGlobal('cancelAnimationFrame', () => {})
})

describe('TimeMachineRail', () => {
  it('每个快照一条主刻度,带可读的 aria-label', () => {
    const mains = mountIt().findAll('.tm-tick-main')
    expect(mains).toHaveLength(3)
    expect(mains[0].attributes('aria-label')).toContain('14:30')
  })
  it('主刻度之间插装饰子刻度,子刻度不是按钮', () => {
    const w = mountIt()
    expect(w.findAll('.tm-tick-sub').length).toBeGreaterThan(0)
    expect(w.find('.tm-tick-sub').element.tagName).not.toBe('BUTTON')
  })
  it('每天一个日期标题', () => {
    expect(mountIt().findAll('.tm-rail-day').map((d) => d.text())).toEqual(['今天', '昨天'])
  })
  it('选中那条带 is-selected', () => {
    const w = mountIt({ selectedIndex: 1 })
    const sel = w.findAll('.tm-tick-main').filter((t) => t.classes().includes('is-selected'))
    expect(sel).toHaveLength(1)
    expect(sel[0].attributes('aria-label')).toContain('09:00')
  })
  it('类型着色 class', () => {
    const mains = mountIt().findAll('.tm-tick-main')
    expect(mains[0].classes()).toContain('type-manual')
    expect(mains[2].classes()).toContain('type-preop')
  })
  it('点主刻度 emit select(只换选中,不进入)', async () => {
    const w = mountIt()
    await w.findAll('.tm-tick-main')[2].trigger('click')
    expect(w.emitted('select')?.[0]?.[0]).toBe(2)
  })
  it('点子刻度吸附到它所属的主刻度', async () => {
    const w = mountIt()
    await w.find('.tm-tick-sub').trigger('click')
    expect(w.emitted('select')?.[0]?.[0]).toBe(0)
  })
  it('悬停主刻度时浮出时间标签,移开消失', async () => {
    const w = mountIt()
    await w.findAll('.tm-tick-main')[1].trigger('mouseenter')
    expect(w.find('.tm-tick-label').text()).toBe('09:00')
    await w.find('.tm-rail').trigger('mouseleave')
    expect(w.find('.tm-tick-label').exists()).toBe(false)
  })
  it('鼠标移动时给刻度算出缩放(离光标越近越大)', async () => {
    const w = mountIt()
    // jsdom 里 getBoundingClientRect 恒为 0,这里只断言 mousemove 后确实写了 transform,
    // 曲线本身由 timeMachineMath.test.ts 覆盖(那里是真数值断言)。
    await w.find('.tm-rail').trigger('mousemove', { clientY: 120 })
    expect(w.findAll('.tm-tick-main')[0].attributes('style')).toContain('scaleX')
  })
  it('移开后缩放复位', async () => {
    const w = mountIt()
    await w.find('.tm-rail').trigger('mousemove', { clientY: 120 })
    await w.find('.tm-rail').trigger('mouseleave')
    expect(w.findAll('.tm-tick-main')[0].attributes('style') ?? '').not.toContain('scaleX(2')
  })
  it('空分组渲染空刻度尺,不报错', () => {
    expect(mountIt({ groups: [] }).findAll('.tm-tick-main')).toHaveLength(0)
  })
})
```

- [ ] **Step 2: 跑测试确认失败,然后写组件**

创建 `src/files/snapshot/TimeMachineRail.vue`:

```vue
<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { buildRailNodes, computeFisheyeScales } from '../util/timeMachineMath'

export interface RailItem { flatIndex: number; time: string; typeKind: 'auto' | 'manual' | 'preop' }
export interface RailGroup { dayKey: string; labelText: string; items: RailItem[] }

const props = defineProps<{ groups: RailGroup[]; selectedIndex: number }>()
const emit = defineEmits<{ (e: 'select', index: number): void }>()

const nodes = computed(() => buildRailNodes(props.groups))
const itemByIndex = computed(() => {
  const map: Record<number, RailItem> = {}
  for (const g of props.groups) for (const it of g.items) map[it.flatIndex] = it
  return map
})

const scales = ref<Record<number, number>>({})
const hoveredIndex = ref<number | null>(null)
const railEl = ref<HTMLElement | null>(null)
let rafHandle: number | null = null
let pendingY = 0

// 光标距离驱动的连续放大。一帧内的一串 mousemove 只安排一次重算(rAF 合并),
// 回调触发时用最新的光标 Y —— 纯 CSS 的 :hover 只能做离散档位,表达不了连续函数。
function onMouseMove(e: MouseEvent) {
  pendingY = e.clientY
  if (rafHandle !== null) return
  rafHandle = requestAnimationFrame(() => {
    rafHandle = null
    updateScales(pendingY)
  })
}

function updateScales(cursorY: number) {
  const root = railEl.value
  if (!root) return
  const els = Array.from(root.querySelectorAll<HTMLElement>('[data-flat-index]'))
  const indices = els.map((el) => Number(el.dataset.flatIndex))
  const centers = els.map((el) => { const r = el.getBoundingClientRect(); return r.top + r.height / 2 })
  const out = computeFisheyeScales(centers, cursorY)
  const map: Record<number, number> = {}
  indices.forEach((idx, i) => { map[idx] = out[i] })
  scales.value = map
}

function onMouseLeave() {
  hoveredIndex.value = null
  scales.value = {}
}

onUnmounted(() => { if (rafHandle !== null) cancelAnimationFrame(rafHandle) })

function scaleStyle(flatIndex: number) {
  const s = scales.value[flatIndex]
  return s ? { transform: `scaleX(${s})` } : undefined
}
</script>

<template>
  <div ref="railEl" class="tm-rail" @mousemove="onMouseMove" @mouseleave="onMouseLeave">
    <template v-for="node in nodes" :key="node.key">
      <div v-if="node.type === 'day'" class="tm-rail-day">{{ node.label }}</div>

      <button
        v-else-if="node.type === 'main'"
        type="button"
        class="tm-tick tm-tick-main"
        :class="[`type-${itemByIndex[node.flatIndex!]?.typeKind}`, { 'is-selected': node.flatIndex === props.selectedIndex }]"
        :data-flat-index="node.flatIndex"
        :style="scaleStyle(node.flatIndex!)"
        :aria-label="itemByIndex[node.flatIndex!]?.time"
        @mouseenter="hoveredIndex = node.flatIndex!"
        @click="emit('select', node.flatIndex!)"
      >
        <span v-if="hoveredIndex === node.flatIndex" class="tm-tick-label">{{ itemByIndex[node.flatIndex!]?.time }}</span>
      </button>

      <!-- 装饰性子刻度:不可独立选中,点它吸附到上面那条主刻度(照参考稿的 sub tick) -->
      <div
        v-else
        class="tm-tick tm-tick-sub"
        :data-flat-index="node.anchorIndex"
        :style="scaleStyle(node.anchorIndex!)"
        @mouseenter="hoveredIndex = node.anchorIndex!"
        @click="emit('select', node.anchorIndex!)"
      ></div>
    </template>
  </div>
</template>

<style scoped>
.tm-rail {
  position: absolute; top: 0; right: 0; bottom: 76px; width: 96px;
  padding: 24px 20px 24px 0; z-index: 1;
  display: flex; flex-direction: column; align-items: flex-end; gap: 5px;
  overflow-y: auto; overflow-x: visible; scrollbar-width: thin;
}
.tm-rail-day {
  width: 100%; text-align: right; margin-top: 6px;
  font-size: 9px; font-weight: 600; letter-spacing: 0.5px;
  color: var(--tm-fg-muted);
}
.tm-rail-day:first-child { margin-top: 0; }
.tm-tick {
  position: relative; height: 3px; border: none; padding: 0; border-radius: 2px;
  transform-origin: right center; cursor: pointer;
  transition: transform 0.12s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.15s var(--ease);
}
.tm-tick-main { width: 26px; background: var(--tm-rail); }
.tm-tick-sub { width: 18px; background: var(--tm-rail-sub); }
.tm-tick-main.type-manual { background: var(--accent); }
.tm-tick-main.type-preop { background: var(--dem-fg); }
.tm-tick-main.is-selected { height: 4px; background: var(--accent); box-shadow: 0 0 8px var(--accent-soft-2); }
.tm-tick-label {
  position: absolute; right: 34px; top: -6px; white-space: nowrap;
  font-size: 10px; font-weight: 600; color: var(--tm-fg);
  transform: scaleX(1); /* 抵消父级 scaleX,文字不被拉伸 */
}
@media (prefers-reduced-motion: reduce) { .tm-tick { transition: none; } }
</style>
```

> ⚠️ **文字被拉伸的坑**:刻度用 `scaleX` 放大,标签是它的子元素会一并被横向拉扁。上面用 `transform: scaleX(1)` 只能在父级 scale 为 1 时正确;实现时改成把标签**移出**刻度按钮(放在 `.tm-rail` 层级,用绝对定位 + 当前 hover 项的位置),或给标签套一层反向 `scaleX(1/父级)`。**动手时先在浏览器里看一眼再定**,别只看单测过没过 —— 单测断言不到视觉拉伸。

- [ ] **Step 3: 接进 Overlay**

`TimeMachineOverlay.vue`:import `TimeMachineRail`,在 `<TimeMachineDeck ... />` 之后加:

```html
        <TimeMachineRail :groups="groups" :selected-index="selectedIndex" @select="(i: number) => (selectedIndex = i)" />
```

追加 Overlay 测试:

```ts
  it('就绪后同时渲染卡堆与刻度尺,刻度数 = 快照数', async () => {
    const w = mountIt(); await flush(w)
    expect(w.findAll('.tm-tick-main')).toHaveLength(3)
  })
  it('点刻度换选中,底栏时刻跟着变', async () => {
    const w = mountIt(); await flush(w)
    await w.findAll('.tm-tick-main')[2].trigger('click')
    expect(w.find('.tm-bar-moment').text()).toContain('昨天')
  })
```

- [ ] **Step 4: 全量测试 + 类型检查 + 提交**

```bash
pnpm test && pnpm exec vue-tsc --noEmit
git add -A src/files/snapshot
git commit -m "feat(files): 时间机器刻度尺(主/子刻度+鱼眼+悬停标签,T10)"
```

---

### Task 11: 齿轮设置弹窗(`SnapshotSettingsDialog.vue`)

复用 `storage/stores/snapshot.ts` 的写操作与 `storage/util/snapshotView.ts` 的校验,模板另写(字段常驻不折叠 —— 这个弹窗存在的理由就是让人改这些字段)。

**Files:**
- Create: `src/files/snapshot/SnapshotSettingsDialog.vue` + `.test.ts`
- Modify: `src/views/Files.vue`(齿轮接线)
- Modify: `src/files/snapshot/TimeMachineOverlay.vue`(暴露 `reload`,建快照后刷新;T7 已 `defineExpose({ reload })`)

**Interfaces:**
- Consumes: `useSnapshotStore()` 的 `volume` / `policy` / `volumeLoading` / `toggling` / `policySaving` / `creatingSnapshot` / `loadVolume` / `loadPolicy` / `toggle` / `savePolicy` / `createSnapshot`;`resolveSnapshotState` / `validatePolicyForm`
- Produces:
  ```ts
  defineProps<{ open: boolean; volumeUuid: string; mountPoint: string }>()
  defineEmits<{ (e: 'update:open', v: boolean): void; (e: 'snapshot-created'): void }>()
  ```

- [ ] **Step 1: 写测试**

创建 `src/files/snapshot/SnapshotSettingsDialog.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import SnapshotSettingsDialog from './SnapshotSettingsDialog.vue'
import zh from '../../i18n/zh_cn'

const listVolumesMock = vi.fn()
const getPolicyMock = vi.fn()
const patchPolicyMock = vi.fn()
const togglePolicyMock = vi.fn()
const createMock = vi.fn()
vi.mock('@nimotech/nimoos-service', () => ({
  service: { snapshot: {
    listVolumes: () => listVolumesMock(), getPolicy: (u: string) => getPolicyMock(u),
    patchPolicy: (u: string, p: unknown) => patchPolicyMock(u, p),
    togglePolicy: (u: string, e: boolean) => togglePolicyMock(u, e),
    create: (d: unknown) => createMock(d), list: vi.fn().mockResolvedValue([]), remove: vi.fn(),
  } },
}))

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const mountIt = (props = {}) =>
  mount(SnapshotSettingsDialog, {
    props: { open: true, volumeUuid: 'u-data', mountPoint: '/DATA', ...props },
    global: { plugins: [i18n] },
    attachTo: document.body,
  })
const flush = async (w: ReturnType<typeof mountIt>) => {
  await new Promise((r) => setTimeout(r)); await w.vm.$nextTick(); await w.vm.$nextTick()
}
const body = () => document.body.textContent ?? ''

beforeEach(() => {
  setActivePinia(createPinia()); vi.clearAllMocks(); document.body.innerHTML = ''
  listVolumesMock.mockResolvedValue([{ volume_uuid: 'u-data', mount: '/DATA', supported: true, enabled: true, count: 3 }])
  getPolicyMock.mockResolvedValue({ enabled: true, hourly_keep: 24, daily_keep: 7, weekly_keep: 4, pause_threshold_pct: 90 })
})

describe('SnapshotSettingsDialog', () => {
  it('打开即拉卷与策略', async () => {
    const w = mountIt(); await flush(w)
    expect(listVolumesMock).toHaveBeenCalled()
    expect(getPolicyMock).toHaveBeenCalledWith('u-data')
  })
  it('显示挂载点,让人知道在改哪个卷', async () => {
    const w = mountIt(); await flush(w)
    expect(body()).toContain('/DATA')
  })
  it('不支持快照的卷只显示一句说明,没有表单', async () => {
    listVolumesMock.mockResolvedValue([{ volume_uuid: 'u-data', mount: '/DATA', supported: false }])
    const w = mountIt(); await flush(w)
    expect(body()).toContain('不支持快照')
    expect(document.querySelector('.snap-set-fields')).toBeNull()
  })
  it('已启用时 4 个策略字段常驻可见(不折叠)', async () => {
    const w = mountIt(); await flush(w)
    expect(document.querySelectorAll('.snap-set-fields input').length).toBe(4)
  })
  it('保存走 patchPolicy(读-改-写,不是从零构造 PUT)', async () => {
    const w = mountIt(); await flush(w)
    await (document.querySelector('.snap-set-save') as HTMLElement).click()
    await flush(w)
    expect(patchPolicyMock).toHaveBeenCalledWith('u-data', expect.objectContaining({ hourly_keep: 24, daily_keep: 7 }))
  })
  it('字段非法时不提交,显示错误', async () => {
    const w = mountIt(); await flush(w)
    const input = document.querySelector('.snap-set-fields input') as HTMLInputElement
    input.value = '0'; input.dispatchEvent(new Event('input')); await flush(w)
    await (document.querySelector('.snap-set-save') as HTMLElement).click(); await flush(w)
    expect(patchPolicyMock).not.toHaveBeenCalled()
    expect(body()).toContain('大于 0')
  })
  it('开关调 togglePolicy', async () => {
    const w = mountIt(); await flush(w)
    await (document.querySelector('.snap-set-toggle') as HTMLElement).click(); await flush(w)
    expect(togglePolicyMock).toHaveBeenCalledWith('u-data', false)
  })
  it('立即创建快照:带备注提交,并 emit snapshot-created', async () => {
    createMock.mockResolvedValue({})
    const w = mountIt(); await flush(w)
    const label = document.querySelector('.snap-set-label') as HTMLInputElement
    label.value = '升级前'; label.dispatchEvent(new Event('input')); await flush(w)
    await (document.querySelector('.snap-set-create') as HTMLElement).click(); await flush(w)
    expect(createMock).toHaveBeenCalledWith({ volume_uuid: 'u-data', label: '升级前' })
    expect(w.emitted('snapshot-created')).toHaveLength(1)
  })
  it('备注为空时不带 label 字段', async () => {
    createMock.mockResolvedValue({})
    const w = mountIt(); await flush(w)
    await (document.querySelector('.snap-set-create') as HTMLElement).click(); await flush(w)
    expect(createMock).toHaveBeenCalledWith({ volume_uuid: 'u-data' })
  })
})
```

- [ ] **Step 2: 跑测试确认失败,然后写组件**

创建 `src/files/snapshot/SnapshotSettingsDialog.vue`。要点(**先读 `src/storage/components/SnapshotPanel.vue`,把状态派生、字段绑定、错误展示的写法照它来,不要另发明一套**):

- `<Dialog :open="props.open" :title="t('tmSettings')" @update:open="emit('update:open', $event)">`
- 标题下一行小字显示 `props.mountPoint`
- `onMounted` + `watch(() => [props.open, props.volumeUuid])`:open 为真时 `store.loadVolume(uuid)` + `store.loadPolicy(uuid)`
- `state = computed(() => resolveSnapshotState(store.volume))`
- `unsupported` → 只渲染 `t('snapUnsupported')`
- 开关按钮 `.snap-set-toggle` → `store.toggle(uuid, !enabled)`
- `enabled` 时渲染 `.snap-set-fields`:4 个 `<input type="number">`(`snapHourlyKeep` / `snapDailyKeep` / `snapWeeklyKeep` / `snapPauseThreshold`),本地 `policyForm` ref 从 `store.policy` 初始化
- 保存 `.snap-set-save`:先 `validatePolicyForm(policyForm)`,不合法就把 `errors` 渲染出来并 return;合法则 `store.savePolicy(uuid, policyForm)`
- 创建行:`.snap-set-label` 输入框 + `.snap-set-create` 按钮 → `store.createSnapshot(uuid, manualLabel)`,成功后 `emit('snapshot-created')` 并清空备注
- 所有按钮在对应 loading 标志为真时 `disabled`
- 样式:只用既有 token(`--fg` / `--fg-muted` / `--accent` / `--on-accent` / `--border` / `--dem-fg`),不新增

完整骨架(样式与细节按上面的要点补齐):

```vue
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Dialog from '../../components/ui/Dialog.vue'
import { useSnapshotStore } from '../../storage/stores/snapshot'
import { resolveSnapshotState, validatePolicyForm, type PolicyForm } from '../../storage/util/snapshotView'

const props = defineProps<{ open: boolean; volumeUuid: string; mountPoint: string }>()
const emit = defineEmits<{ (e: 'update:open', v: boolean): void; (e: 'snapshot-created'): void }>()

const { t } = useI18n()
const store = useSnapshotStore()
const state = computed(() => resolveSnapshotState(store.volume))

const form = ref<PolicyForm>({ hourly_keep: 24, daily_keep: 7, weekly_keep: 4, pause_threshold_pct: 90 })
const errors = ref<Partial<Record<keyof PolicyForm, string>>>({})
const manualLabel = ref('')

// 打开(或换卷)时拉数据;策略落地后把本地表单同步成后端当前值。
watch(
  () => [props.open, props.volumeUuid] as const,
  async ([open, uuid]) => {
    if (!open || !uuid) return
    await Promise.all([store.loadVolume(uuid), store.loadPolicy(uuid)])
    const p = store.policy
    if (p) form.value = {
      hourly_keep: Number(p.hourly_keep ?? 24), daily_keep: Number(p.daily_keep ?? 7),
      weekly_keep: Number(p.weekly_keep ?? 4), pause_threshold_pct: Number(p.pause_threshold_pct ?? 90),
    }
  },
  { immediate: true },
)

async function onSave() {
  const { valid, errors: errs } = validatePolicyForm(form.value)
  errors.value = errs
  if (!valid) return
  await store.savePolicy(props.volumeUuid, form.value)
}

async function onCreate() {
  const ok = await store.createSnapshot(props.volumeUuid, manualLabel.value)
  if (ok) { manualLabel.value = ''; emit('snapshot-created') }
}
</script>

<template>
  <Dialog :open="props.open" :title="t('tmSettings')" @update:open="emit('update:open', $event)">
    <p class="snap-set-mount">{{ props.mountPoint }}</p>

    <p v-if="state === 'unsupported'" class="snap-set-note">{{ t('snapUnsupported') }}</p>

    <template v-else>
      <div class="snap-set-row">
        <span>{{ t('snapTitle') }}</span>
        <button class="snap-set-toggle" :disabled="store.toggling"
          @click="store.toggle(props.volumeUuid, !store.volume?.enabled)">
          {{ store.volume?.enabled ? t('snapToggleOn') : t('snapToggleOff') }}
        </button>
      </div>

      <p v-if="state === 'disabled'" class="snap-set-note">{{ t('snapDisabledHint') }}</p>

      <template v-else>
        <!-- 字段常驻不折叠:这个弹窗存在的理由就是让人改这些值(与存储区那个空间受限的
             侧栏面板不同,那里才需要"高级设置"折叠)。 -->
        <div class="snap-set-fields">
          <label><span>{{ t('snapHourlyKeep') }}</span>
            <input v-model.number="form.hourly_keep" type="number" min="1" />
            <em v-if="errors.hourly_keep">{{ t('snapErrPositiveInt') }}</em></label>
          <label><span>{{ t('snapDailyKeep') }}</span>
            <input v-model.number="form.daily_keep" type="number" min="1" />
            <em v-if="errors.daily_keep">{{ t('snapErrPositiveInt') }}</em></label>
          <label><span>{{ t('snapWeeklyKeep') }}</span>
            <input v-model.number="form.weekly_keep" type="number" min="1" />
            <em v-if="errors.weekly_keep">{{ t('snapErrPositiveInt') }}</em></label>
          <label><span>{{ t('snapPauseThreshold') }}</span>
            <input v-model.number="form.pause_threshold_pct" type="number" min="1" max="100" />
            <em v-if="errors.pause_threshold_pct">{{ t('snapErrPercent') }}</em></label>
          <button class="snap-set-save" :disabled="store.policySaving" @click="onSave">{{ t('snapSave') }}</button>
        </div>

        <div class="snap-set-row">
          <input v-model="manualLabel" class="snap-set-label" :placeholder="t('snapLabelPlaceholder')"
            :disabled="store.creatingSnapshot" />
          <button class="snap-set-create" :disabled="store.creatingSnapshot" @click="onCreate">
            {{ t('snapCreateNow') }}
          </button>
        </div>
      </template>
    </template>
  </Dialog>
</template>
```

> ⚠️ `PolicyForm` 的确切字段名与 `validatePolicyForm` 的返回形状以 `src/storage/util/snapshotView.ts` 为准 —— **先读它**,上面的字段名若与实际不符以实际为准。开关按钮的文案这里借用了 `snapToggleOn/Off`(它们原本是 toast 文案),实现时若读着别扭,新增两个专用键并同步中英,不要复用得牵强。

- [ ] **Step 3: 接进 Files.vue**

```ts
const settingsOpen = ref(false)
const overlayRef = ref<InstanceType<typeof TimeMachineOverlay> | null>(null)
```

覆盖层加 `ref="overlayRef"` 与 `@open-settings="settingsOpen = true"`,并在其后挂:

```html
    <SnapshotSettingsDialog
      v-model:open="settingsOpen"
      :volume-uuid="browse.currentVolume?.volume_uuid ?? ''"
      :mount-point="browse.currentVolume?.mount ?? ''"
      @snapshot-created="overlayRef?.reload()"
    />
```

> 设置弹窗打开时**时间机器不关闭**(有意):新建快照成功后能当场看见新刻度冒出来。z-index 天然成立(覆盖层 900 < 弹窗 1000),不要加任何覆写。

追加 Files 集成测试:

```ts
  it('点齿轮打开设置弹窗,时间机器仍在', async () => {
    const w = await mountFiles('/DATA/Photos')
    await w.find('.tb-time-machine').trigger('click')
    await w.find('.tm-gear').trigger('click')
    expect(document.querySelector('.ui-dialog-content')).not.toBeNull()
    expect(w.find('.tm-overlay').exists()).toBe(true)
  })
```

- [ ] **Step 4: 全量测试 + 类型检查 + 提交**

```bash
pnpm test && pnpm exec vue-tsc --noEmit
git add -A src/files src/views/Files.vue
git commit -m "feat(files): 时间机器齿轮设置弹窗(T11)"
```

---

### Task 12: 存储区 `[浏览]` 接回 + 测试台 + 收尾门禁

把 SP6-P5 缺席的那颗按钮补上,搭好假后端测试台,双主题截图自查,跑全量门禁。

**Files:**
- Modify: `src/storage/components/SnapshotTimeline.vue` + `.test.ts`
- Create: `scripts/tmlab/server.mjs`、`scripts/tmlab/fixtures.json`、`scripts/tmlab/README.md`(**全部进 `.gitignore`**)
- Create: `vite.config.tmlab.ts`(**进 `.gitignore`**)
- Modify: `.gitignore`

- [ ] **Step 1: `[浏览]` 按钮(先写测试)**

追加到 `src/storage/components/SnapshotTimeline.test.ts`:

```ts
describe('浏览按钮(SP6-P5 缺席项补回)', () => {
  const SNAP = { id: 1, name: 'snap-a', label: '', type: 'manual', created_at: new Date().toISOString() }

  it('每个快照条目有浏览按钮', async () => {
    listMock.mockResolvedValue([SNAP])
    const w = mountIt(); await flush(w)
    useSnapshotStore().volume = { volume_uuid: 'u1', mount: '/DATA', supported: true, enabled: true } as never
    await w.vm.$nextTick()
    expect(w.findAll('.st-browse')).toHaveLength(1)
  })
  it('点浏览跳文件区深链,带上快照目录真实路径', async () => {
    listMock.mockResolvedValue([SNAP])
    const w = mountIt(); await flush(w)
    useSnapshotStore().volume = { volume_uuid: 'u1', mount: '/DATA', supported: true, enabled: true } as never
    await w.vm.$nextTick()
    await w.find('.st-browse').trigger('click')
    expect(pushMock).toHaveBeenCalledWith({ path: '/files', query: { path: '/DATA/.snapshots/snap-a' } })
  })
  it('卷挂载点未知时不显示浏览按钮(跳过去也没意义)', async () => {
    listMock.mockResolvedValue([SNAP])
    const w = mountIt(); await flush(w)
    useSnapshotStore().volume = null
    await w.vm.$nextTick()
    expect(w.findAll('.st-browse')).toHaveLength(0)
  })
})
```

> ⚠️ `pushMock` 需要给该测试文件补 `vi.mock('vue-router', ...)`;先读文件顶部现有 mock,合并进去而不是新加一份。第三条用例的 store 操作写法照该文件已有习惯补全 —— **不要**留着注释就交。

- [ ] **Step 2: 实现按钮**

`src/storage/components/SnapshotTimeline.vue`:把第 96 行那条 `<!-- [浏览] 未迁… -->` 注释换成真按钮:

```html
              <button v-if="mountPoint" class="st-btn st-browse" @click="browse(item.name)">
                {{ t('snapBrowse') }}
              </button>
```

脚本补:

```ts
import { useRouter } from 'vue-router'
import { snapshotBrowsePath } from '../../files/util/snapshotPath'

const router = useRouter()
const mountPoint = computed(() => store.volume?.mount ?? '')

// 跳文件区的快照只读浏览。走 /files?path=<真实路径> 这条既有深链格式:Files.vue 的 sync()
// 会把它归一成规范的 /files/<虚拟段>(真实路径→虚拟路径的映射依赖 displayNames,那份数据
// 在存储区这边并不齐全,交给文件区自己解更可靠)。
function browse(name: string) {
  if (!mountPoint.value) return
  router.push({ path: '/files', query: { path: snapshotBrowsePath(mountPoint.value, name) } })
}
```

i18n 补 `snapBrowse: '浏览'` / `snapBrowse: 'Browse'`。

- [ ] **Step 3: 假后端测试台**

`.gitignore` 追加:

```
scripts/tmlab/
vite.config.tmlab.ts
```

创建 `scripts/tmlab/server.mjs` —— Node 内置模块即可,零依赖:

```js
// 时间机器验收测试台(不进版本库)。127.0.0.1:8899 上:
//   - /v2/snapshot/*  → 返回 fixtures.json 里的假数据(可用 ?set= 切数据集)
//   - 其余全部       → 透传真机网关 127.0.0.1:80(文件列表/缩略图走真后端)
// 用法:node scripts/tmlab/server.mjs 然后 pnpm exec vite --config vite.config.tmlab.ts
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const load = () => JSON.parse(fs.readFileSync(path.join(here, 'fixtures.json'), 'utf8'))
let set = process.env.TMLAB_SET || 'default'

const envelope = (data) => JSON.stringify({ success: 200, message: 'ok', data })

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x')
  if (url.searchParams.has('tmlab_set')) set = url.searchParams.get('tmlab_set')
  const fx = load()[set] ?? load().default

  if (url.pathname.startsWith('/v2/snapshot')) {
    res.setHeader('content-type', 'application/json')
    if (fx.fail) { res.statusCode = 500; res.end(JSON.stringify({ success: 500, message: 'tmlab forced failure' })); return }
    if (url.pathname === '/v2/snapshot/volumes') { res.end(envelope(fx.volumes)); return }
    if (url.pathname === '/v2/snapshot/policy') { res.end(envelope(fx.policy)); return }
    if (url.pathname === '/v2/snapshot') { res.end(envelope(fx.snapshots)); return }
    if (url.pathname === '/v2/snapshot/restore') { res.end(envelope({ restored_path: '/DATA/tmlab-restored-1' })); return }
    res.end(envelope(null)); return
  }

  const proxy = http.request(
    { host: '127.0.0.1', port: 80, path: req.url, method: req.method, headers: req.headers },
    (up) => { res.writeHead(up.statusCode ?? 502, up.headers); up.pipe(res) },
  )
  proxy.on('error', () => { res.statusCode = 502; res.end('tmlab upstream error') })
  req.pipe(proxy)
})
server.listen(8899, () => console.log('tmlab on http://127.0.0.1:8899  set=' + set))
```

创建 `scripts/tmlab/fixtures.json`,至少 6 个数据集:`default`(1 卷 + 跨今天/昨天/上周/上月共 9 个快照,三种类型齐全,含中文备注)、`multi`(2 卷)、`empty`(卷在但无快照)、`unsupported`(supported:false)、`novolume`(空数组 —— 真机现状)、`fail`(`{"fail": true}`)。

> **fixture 必须逐字对齐真实响应形状**(本仓库栽过三次的坑):`volumes` 条目字段以 `NimoOS-LocalStorage/route/snapshot.go` 的 `ListVolumeStatuses` 返回结构为准,`snapshots` 条目字段以 `ListSnapshots` 为准。写之前先 `grep -n "json:" NimoOS-LocalStorage/service/snapshot/*.go` 把字段名抄下来,**不要凭印象编**。

创建 `vite.config.tmlab.ts`:

```ts
import base from './vite.config'
export default { ...base, server: { port: 5277, proxy: { '^/(?!app/)': { target: 'http://127.0.0.1:8899', changeOrigin: true, ws: true } } } }
```

再在真机上造一棵假快照目录树,让卡片预览与只读浏览走真实文件 API:

```bash
mkdir -p /DATA/.snapshots/20260730T143000Z_manual_改版前/Photos
cp /DATA/Gallery/*.jpg /DATA/.snapshots/20260730T143000Z_manual_改版前/Photos/ 2>/dev/null | head -8
# 另外再造 2~3 个不同时间戳的快照目录,其中一个**故意不建** Photos 子目录,
# 用来验证"此时还没有这个文件夹"这条降级路径
```

创建 `scripts/tmlab/README.md` 写清启动方式与 6 个数据集的切换方法。

- [ ] **Step 4: 双主题截图自查**

启动测试台与 dev server 后,用本机缓存的无头 chromium 截图(深色 + 浅色各一组:就绪态 / 空态 / 只读浏览态 / 设置弹窗打开态,共 8 张),自己先看一遍再交付。重点看四件事:

1. 浅色主题下卡片、刻度、底栏是否都可读(不是深色硬塞浅色)
2. 刻度悬停标签有没有被 `scaleX` 拉扁(T10 的已知坑)
3. 卡片缩略图格在 6 张/2 张/0 张时布局是否都稳
4. 卡堆切换选中时是否平滑(截连续两帧对比,或录一段)

- [ ] **Step 5: 全量门禁**

```bash
pnpm test                                   # 全绿
pnpm exec vue-tsc --noEmit                  # 无错
pnpm exec vitest run src/i18n/parity.test.ts # 中英键一致
git diff master --stat                       # 复核改动面
git diff master -- src | grep -nE '^\+.*(#[0-9a-fA-F]{3,8}|rgba?\()' | grep -v 'theme.css' || echo "无新增硬编码颜色"
```

- [ ] **Step 6: 提交**

```bash
git add -A src .gitignore
git commit -m "feat(storage): 快照时间线[浏览]接回文件区 + 时间机器收尾(T12)"
```

---

## 收尾:台账登记

实现完成后,把下面这些补进 `docs/superpowers/plans/2026-07-27-vue3-migration-sp6-p5-snapshots.md` 收尾挂账第 1 条旁边(标注已消化),并新登记本期遗留:

1. **本机永远无法实盘验证**:`/DATA` 是 ext4 单盘,快照卷只从 RAID 阵列派生,`GET /v2/snapshot/volumes` 恒返回空数组。本期以单测 + 假后端测试台 + 双主题截图为准,**随多盘设备补实盘验收**。
2. **`GET /v2/snapshot/file-versions` 仍未被任何前端消费**(Vue2 当年也没用)。若将来要做"单文件历史版本"入口,这是现成的后端能力。
3. **恢复是逐条串行提交**(后端一次只收一个 path)。选中几十项时会串行等待,没有进度条 —— 若实际使用中出现大批量恢复,需要后端批量接口或前端进度反馈。
4. **卡片预览对每张可见卡各发一次列目录请求**(最多 5 次,按快照名缓存)。快照数很多且用户快速拨刻度时会有一串请求;当前没有取消在途请求的逻辑。
5. **`.snapshots` 目录在文件区列表里不可见**(files store 过滤掉了 `.` 开头的条目),因此只能从时间机器或存储区 `[浏览]` 进入 —— 这是有意的。

## 自查清单(实现者交付前逐条确认)

- [ ] 只读锁的 fail-safe 方向没被"优化"反转(idle/loading/error/未命中 四种都保持锁定)
- [ ] 5 个 `useFileOps` 写方法 + 投放入口都有 guard,`download` / `copyPath` **没有**被误加
- [ ] 进入快照落在当前相对路径(不是快照根),且代码里有注释说明这是对 Vue2 的有意改正
- [ ] 时间机器 z-index 900 < 设置弹窗 1000,没有任何 z-index 覆写或 `:deep` hack
- [ ] `theme.css` 之外没有新增颜色字面量;`--tm-*` 每个 token 在深浅两套主题里都有值
- [ ] 新增 i18n 键在 `zh_cn.ts` 与 `en_us.ts` 都有,`parity.test.ts` 绿
- [ ] 所有 fixture(测试与测试台)的字段名都是从真实响应/后端源码抄来的,不是编的
- [ ] `pnpm test` 全绿、`vue-tsc --noEmit` 无错
- [ ] 深色与浅色两套主题都截过图并自查过

---

## 执行方式

**Plan complete and saved to `docs/superpowers/plans/2026-07-30-files-time-machine.md`.**

两种执行方式:

1. **Subagent-Driven(推荐)** —— 每个任务派一个全新 subagent,任务之间我来评审,迭代快
2. **Inline Execution** —— 在当前会话里按 executing-plans 批量执行,设检查点

选哪个?
