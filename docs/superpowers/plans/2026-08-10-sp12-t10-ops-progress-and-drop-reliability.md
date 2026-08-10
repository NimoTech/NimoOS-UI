# SP12 T10 文件操作进度并入上传框 + #90 互传可靠性核心 —— 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把粘贴/移动进度从左下角独立浮层收进右下角上传框(T10),并给互传补上断连感知、等待超时、真取消、切页守卫四件可靠性能力(#90 核心)。

**Architecture:** 两部分互不重叠。T10 先抽纯函数层(`opsRow.ts`)再改 `UploadPanel.vue` 消费,最后删旧组件;#90 先在 `Peer` 基类上立「断连即复位并上报」这一条主干,再依次挂超时、取消、UI 消费、切页守卫。所有状态机改动都落在可脱离 WebRTC 单测的 `Peer` 基类上,`RTCPeer` 只负责真实通道。

**Tech Stack:** Vue 3 `<script setup>` · TypeScript strict · Pinia · vue-i18n · vue-router 4 · reka-ui · vitest + jsdom + @vue/test-utils

**设计文档:** `docs/superpowers/specs/2026-08-10-sp12-t10-ops-progress-and-drop-reliability-design.md`

## Global Constraints

- **代码注释一律英文**(工作区 CLAUDE.md 硬要求)。**测试描述(`describe`/`it` 字符串)也一律英文** —— 机主 SP12 起拍板。本计划代码块里若出现中文注释,那是计划层面的讲解,**落盘时一律改写成英文**。既有文件里的中文注释不做无关翻译,只在你正好改到那一行时顺带处理。
- **颜色一律 theme token**(`var(--…)`),禁止字面色值;新语义 token 要在 `:root` 与 `:root[data-theme="light"]` **两个块**都给值。
- **i18n 新键必须同时加到 `src/i18n/zh_cn.base.ts` 与 `src/i18n/en_us.base.ts`**,否则 `src/i18n/parity.test.ts` 变红。中文文案以 Vue2 `zh_CN.json` 为准,查不到再自拟。
- **测试必须能因正确的理由变红。** 每个任务收尾要做一次变异验证:把实现改回旧行为 → 目标用例必须真红 → 恢复 → 全绿。报告里如实写明哪些用例改前也绿、为什么(性质使然 vs 写错了)。
- **前台跑测试。** 不要把 `pnpm test` 丢进后台 job / Monitor 然后停下等 —— 本仓已复发四次。全量约 3 分钟,等就是了。
- **提交后再跑 oss 门**:未提交的 `src/**` 改动会让 `checkClean` 拒绝导出,表现成几条 export 测试变红,容易误判成新缺陷。
- **本工作树 `git status` 干净**,提交时按步骤里给的 pathspec 加文件即可(主工作树那条「必须带 pathspec 否则卷走 design-export 删除」的约束**不适用于本工作树**,但按 pathspec 提交仍是好习惯)。
- **不改 `packages/service/`**;本批不需要碰它。
- **禁止无关重构**:界面严格 1:1 照 Vue2,但 Vue2 的 bug/竞态/吞错不照抄,改正确逻辑并用英文注释登记。

---

## 文件结构

**新建**
- `src/files/util/opsRow.ts` —— T10 纯函数层(四个函数,零副作用,零 Vue 依赖)
- `src/files/util/opsRow.test.ts`
- `src/files/drop/leaveGuard.ts` —— 互传离站守卫纯函数 + `beforeunload` 安装器
- `src/files/drop/leaveGuard.test.ts`

**修改**
- `src/i18n/zh_cn.base.ts` / `src/i18n/en_us.base.ts` —— 新增 4 个键
- `src/files/components/UploadPanel.vue` —— 显示门控 / 自动弹开 / 头部三态 / 「文件操作」分组
- `src/files/components/UploadPanel.test.ts` —— 新增用例(若无此文件则新建)
- `src/views/Files.vue` —— 删 `OperationStatusBar` 的 import 与挂载
- `src/files/drop/protocol.ts` —— 新增 `transfer-cancel` 消息类型与超时常量
- `src/files/drop/chunker.ts` —— 新增 `abort()`
- `src/files/drop/rtcPeer.ts` —— 断连主干 / 超时 / 取消
- `src/files/drop/rtcPeer.test.ts` —— 新增用例
- `src/files/drop/peersManager.ts` + `.test.ts` —— 转发两个新方法
- `src/files/drop/stores/drop.ts` —— 接断连事件、暴露两个方法
- `src/files/drop/components/DropItem.vue` —— 取消菜单项 + 看门狗
- `src/files/drop/components/DropPage.vue` —— 接线取消/看门狗/离站守卫
- `src/files/drop/components/DropItem.test.ts` / `DropPage.test.ts` —— 新增用例(若无则新建)

**删除**
- `src/files/components/OperationStatusBar.vue`
- `src/files/components/OperationStatusBar.test.ts`

---

# Part A —— T10

### Task 1: `opsRow.ts` 三个渲染纯函数

**Files:**
- Create: `src/files/util/opsRow.ts`
- Test: `src/files/util/opsRow.test.ts`

**Interfaces:**
- Consumes: `FileTask` from `src/files/util/fileOps.ts`
- Produces: `opsTaskPercent(task: FileTask): number | null` · `opsTaskLabelKey(task: FileTask): string` · `opsTaskBasename(path: string): string`

- [ ] **Step 1: 写失败测试**

```ts
// src/files/util/opsRow.test.ts
import { describe, it, expect } from 'vitest'
import { opsTaskPercent, opsTaskLabelKey, opsTaskBasename } from './opsRow'
import type { FileTask } from './fileOps'

function task(over: Partial<FileTask> = {}): FileTask {
  return {
    id: 't1', type: 'copy', finished: false, status: 'PROCESSING',
    processing_path: '/DATA/Documents/report.pdf',
    processed_size: 50, total_size: 200, to: '/DATA/Downloads',
    ...over,
  }
}

describe('opsTaskPercent', () => {
  it('floors the processed/total ratio to a whole percent', () => {
    expect(opsTaskPercent(task({ processed_size: 50, total_size: 200 }))).toBe(25)
    expect(opsTaskPercent(task({ processed_size: 1, total_size: 3 }))).toBe(33)
  })

  it('returns null when the total size is unknown, so callers do not draw a false 0%', () => {
    expect(opsTaskPercent(task({ total_size: 0 }))).toBeNull()
    expect(opsTaskPercent(task({ total_size: -1 }))).toBeNull()
  })

  it('returns 0 when the size is known but nothing has been processed yet', () => {
    expect(opsTaskPercent(task({ processed_size: 0, total_size: 200 }))).toBe(0)
  })

  it('never exceeds 100 even if the backend overshoots', () => {
    expect(opsTaskPercent(task({ processed_size: 300, total_size: 200 }))).toBe(100)
  })
})

describe('opsTaskLabelKey', () => {
  it('maps copy and move onto their i18n keys', () => {
    expect(opsTaskLabelKey(task({ type: 'copy' }))).toBe('filesOpCopy')
    expect(opsTaskLabelKey(task({ type: 'move' }))).toBe('filesOpMove')
  })

  it('falls back to the move key for any unknown type, matching the old ternary', () => {
    expect(opsTaskLabelKey(task({ type: 'something-else' }))).toBe('filesOpMove')
  })
})

describe('opsTaskBasename', () => {
  it('keeps only the last segment so the full /DATA path is not shown', () => {
    expect(opsTaskBasename('/DATA/Documents/report.pdf')).toBe('report.pdf')
  })

  it('ignores trailing slashes on directories', () => {
    expect(opsTaskBasename('/DATA/Documents/')).toBe('Documents')
  })

  it('returns the input unchanged when there is no separator to strip', () => {
    expect(opsTaskBasename('report.pdf')).toBe('report.pdf')
    expect(opsTaskBasename('')).toBe('')
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm exec vitest run src/files/util/opsRow.test.ts`
Expected: FAIL —— `Failed to resolve import "./opsRow"`

- [ ] **Step 3: 写实现**

```ts
// src/files/util/opsRow.ts
import type { FileTask } from './fileOps'

/**
 * Percentage for one file-operation row, or null when the backend has not told
 * us how big the job is.
 *
 * Deliberately NOT the same as `taskPercent` in ./fileOps.ts, which returns 0
 * for an unknown total. Returning 0 draws a progress bar that claims "0% done"
 * when the truth is "size unknown, in progress" -- two different states that
 * must not render the same. `taskPercent` keeps its own semantics for its own
 * callers; do not "unify" the two.
 */
export function opsTaskPercent(task: FileTask): number | null {
  if (!task.total_size || task.total_size <= 0) return null
  const pct = Math.floor((task.processed_size / task.total_size) * 100)
  return Math.min(100, Math.max(0, pct))
}

/** i18n key (not text) for a task's verb, so the caller owns translation. */
export function opsTaskLabelKey(task: FileTask): string {
  return task.type === 'copy' ? 'filesOpCopy' : 'filesOpMove'
}

/** Last path segment only -- the panel must never leak the full /DATA path. */
export function opsTaskBasename(path: string): string {
  return path.split('/').filter(Boolean).pop() || path
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm exec vitest run src/files/util/opsRow.test.ts`
Expected: PASS,13 例全绿

- [ ] **Step 5: 变异验证**

把 `opsTaskPercent` 的 null 分支改成 `return 0`,重跑 → 「returns null when the total size is unknown」必须真红。恢复后全绿。**在任务报告里写明这条变异的实际输出。**

- [ ] **Step 6: 提交**

```bash
git add src/files/util/opsRow.ts src/files/util/opsRow.test.ts
git commit -m "feat(files): add pure helpers for file-operation progress rows

opsTaskPercent returns null rather than 0 for an unknown total size: a 0%
bar claims progress the backend never reported. taskPercent in fileOps.ts
keeps its old semantics for its own callers.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `resolveUploaderHeader` 头部三态 + 两个 i18n 键

**Files:**
- Modify: `src/files/util/opsRow.ts`, `src/files/util/opsRow.test.ts`
- Modify: `src/i18n/zh_cn.base.ts:85` 附近, `src/i18n/en_us.base.ts:85` 附近

**Interfaces:**
- Produces: `resolveUploaderHeader(counts: { uploadCount: number; opsCount: number }): string` —— 返回 i18n key

- [ ] **Step 1: 写失败测试(追加到 `opsRow.test.ts` 末尾)**

```ts
import { resolveUploaderHeader } from './opsRow'
import zh from '../../i18n/zh_cn'
import en from '../../i18n/en_us'

describe('resolveUploaderHeader', () => {
  it('shows the uploading header whenever an upload is in flight', () => {
    expect(resolveUploaderHeader({ uploadCount: 3, opsCount: 0 })).toBe('filesUploadHeaderUploading')
  })

  it('prefers uploading over processing when both are running', () => {
    expect(resolveUploaderHeader({ uploadCount: 1, opsCount: 5 })).toBe('filesUploadHeaderUploading')
  })

  it('shows the processing header when only file operations are running', () => {
    expect(resolveUploaderHeader({ uploadCount: 0, opsCount: 2 })).toBe('filesUploadHeaderProcessing')
  })

  it('falls back to the plain title when nothing is running', () => {
    expect(resolveUploaderHeader({ uploadCount: 0, opsCount: 0 })).toBe('filesUploadTitle')
  })

  it('resolves every header key it can return in both locales', () => {
    const keys = [
      resolveUploaderHeader({ uploadCount: 1, opsCount: 0 }),
      resolveUploaderHeader({ uploadCount: 0, opsCount: 1 }),
      resolveUploaderHeader({ uploadCount: 0, opsCount: 0 }),
    ]
    for (const k of keys) {
      expect(zh[k as keyof typeof zh]).toBeTruthy()
      expect(en[k as keyof typeof en]).toBeTruthy()
    }
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm exec vitest run src/files/util/opsRow.test.ts`
Expected: FAIL —— `resolveUploaderHeader is not a function`

- [ ] **Step 3: 加 i18n 键**

`src/i18n/zh_cn.base.ts`,在 `filesUploadTitle` 那一行下面加:

```ts
  filesUploadHeaderUploading: '正在上传',
  filesUploadHeaderProcessing: '正在处理文件',
```

`src/i18n/en_us.base.ts` 同位置加:

```ts
  filesUploadHeaderUploading: 'Uploading',
  filesUploadHeaderProcessing: 'Processing files',
```

- [ ] **Step 4: 写实现(追加到 `opsRow.ts`)**

```ts
/**
 * i18n key for the upload panel header. Mixed state deliberately shows the
 * uploading header (matches Vue2): uploads carry bytes the user would lose on
 * navigation, file operations run server-side and survive it.
 */
export function resolveUploaderHeader(counts: { uploadCount: number; opsCount: number }): string {
  if (counts.uploadCount > 0) return 'filesUploadHeaderUploading'
  if (counts.opsCount > 0) return 'filesUploadHeaderProcessing'
  return 'filesUploadTitle'
}
```

- [ ] **Step 5: 跑测试确认通过 + parity 门**

Run: `pnpm exec vitest run src/files/util/opsRow.test.ts src/i18n/parity.test.ts`
Expected: 全绿。**若 parity 红,说明只加了一个 locale。**

- [ ] **Step 6: 变异验证**

把混合态那两行顺序对调(`opsCount` 判在前),重跑 → 「prefers uploading over processing」必须真红。恢复后全绿。

- [ ] **Step 7: 提交**

```bash
git add src/files/util/opsRow.ts src/files/util/opsRow.test.ts src/i18n/zh_cn.base.ts src/i18n/en_us.base.ts
git commit -m "feat(files): resolve the upload panel header from both queues

New-UI had no header states at all -- the title was hardcoded. Mixed state
shows uploading because uploads hold bytes that navigating away would lose.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: 上传框对文件操作可见 —— 门控与自动弹开

**Files:**
- Modify: `src/files/components/UploadPanel.vue`
- Test: `src/files/components/UploadPanel.test.ts`(不存在则新建)

**Interfaces:**
- Consumes: `useFileOpsStore()` from `src/files/stores/fileOps.ts`(`active: FileTask[]`)

**这是本批最容易被漏掉的一条。** `totalCount` 是**上传队列长度**;不改门控,「只粘贴、没在上传」这个最常见场景下后面 Task 4 加的分组**永远看不见**,而只喂上传队列的单测**照不出来**。

- [ ] **Step 1: 写失败测试**

```ts
// src/files/components/UploadPanel.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { i18n } from '../../i18n'
import UploadPanel from './UploadPanel.vue'
import { useFileOpsStore } from '../stores/fileOps'
import type { FileTask } from '../util/fileOps'

function opsTask(over: Partial<FileTask> = {}): FileTask {
  return {
    id: 'op1', type: 'copy', finished: false, status: 'PROCESSING',
    processing_path: '/DATA/Documents/big.iso',
    processed_size: 30, total_size: 100, to: '/DATA/Downloads',
    ...over,
  }
}

describe('UploadPanel visibility', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('stays hidden when neither uploads nor file operations are running', () => {
    const w = mount(UploadPanel, { global: { plugins: [i18n] } })
    expect(w.find('.upload-panel-wrap').exists()).toBe(false)
  })

  it('appears for file operations alone, with no uploads queued at all', () => {
    const ops = useFileOpsStore()
    ops.active = [opsTask()]
    const w = mount(UploadPanel, { global: { plugins: [i18n] } })
    expect(w.find('.upload-panel-wrap').exists()).toBe(true)
  })

  it('opens itself when a file operation starts while the panel sits collapsed', async () => {
    const ops = useFileOpsStore()
    const w = mount(UploadPanel, { global: { plugins: [i18n] } })
    ops.active = [opsTask()]
    await w.vm.$nextTick()
    expect(w.find('.upload-panel').exists()).toBe(true)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm exec vitest run src/files/components/UploadPanel.test.ts`
Expected: 后两条 FAIL(`.upload-panel-wrap` 不存在)

- [ ] **Step 3: 改实现**

在 `<script setup>` 里,`const totalCount = ...` 附近加:

```ts
import { useFileOpsStore } from '../stores/fileOps'

const ops = useFileOpsStore()

// The panel is shared by two independent queues. `totalCount` is the upload
// queue alone; gating on it would hide the file-operation group in the most
// common case of all -- a paste with nothing uploading.
const opsCount = computed(() => ops.active.length)
const panelVisible = computed(() => totalCount.value > 0 || opsCount.value > 0)
```

把已有的 `watch` 换成同时监听两路(保留 `shouldAutoOpenUploadList` 的既有语义,不要改那个纯函数):

```ts
watch(
  () => store.queue.length,
  (curLen, prevLen) => {
    if (shouldAutoOpenUploadList(prevLen ?? 0, curLen)) open.value = true
  },
)
// Same rule for file operations: an empty -> non-empty transition pops the
// panel open. Reuses the upload helper so both queues share one definition of
// "something just started".
watch(
  opsCount,
  (cur, prev) => {
    if (shouldAutoOpenUploadList(prev ?? 0, cur)) open.value = true
  },
)
```

模板里把最外层 `v-if="totalCount"` 换成 `v-if="panelVisible"`,折叠态按钮的计数改成 `{{ totalCount + opsCount }}`:

```vue
  <div v-if="panelVisible" class="upload-panel-wrap">
    <button v-if="!open" class="upload-panel-toggle" @click="open = true">
      {{ t('filesUploadTitle') }} ({{ totalCount + opsCount }})
    </button>
```

⚠️ 头部那句 `<span class="up-title">{{ t('filesUploadTitle') }}</span>` **本任务不动**,Task 4 再接三态。
⚠️ 「全部删除」按钮的 `v-if="totalCount"` **保持不变** —— 它删的是上传队列,不该因为有粘贴任务而出现。

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm exec vitest run src/files/components/UploadPanel.test.ts`
Expected: 3/3 PASS

- [ ] **Step 5: 跑既有全套上传相关测试,确认没打破**

Run: `pnpm exec vitest run src/files/`
Expected: 全绿

- [ ] **Step 6: 变异验证**

把 `panelVisible` 改回 `totalCount.value > 0`,重跑 → 后两条必须真红。恢复后全绿。

- [ ] **Step 7: 提交**

```bash
git add src/files/components/UploadPanel.vue src/files/components/UploadPanel.test.ts
git commit -m "feat(files): let the upload panel open for file operations too

Gating on the upload queue alone would hide the incoming file-operation
group in its most common case: a paste with nothing uploading.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: 「文件操作」分组 + 头部三态接线

**Files:**
- Modify: `src/files/components/UploadPanel.vue`, `src/files/components/UploadPanel.test.ts`

**Interfaces:**
- Consumes: Task 1/2 的四个纯函数;Task 3 的 `ops` / `opsCount` / `panelVisible`
- Modify: 新增一个 i18n 键 `filesUploadZoneOps`

- [ ] **Step 1: 写失败测试(追加)**

```ts
describe('UploadPanel file-operation group', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('renders one row per active operation, showing only the basename', () => {
    const ops = useFileOpsStore()
    ops.active = [opsTask({ id: 'a' }), opsTask({ id: 'b', processing_path: '/DATA/Media/movie.mkv' })]
    const w = mount(UploadPanel, { global: { plugins: [i18n] } })
    const rows = w.findAll('.up-ops-item')
    expect(rows.length).toBe(2)
    expect(rows[1].text()).toContain('movie.mkv')
    expect(rows[1].text()).not.toContain('/DATA')
  })

  it('shows the percentage when the size is known', () => {
    const ops = useFileOpsStore()
    ops.active = [opsTask({ processed_size: 30, total_size: 100 })]
    const w = mount(UploadPanel, { global: { plugins: [i18n] } })
    expect(w.find('.up-ops-item').text()).toContain('30%')
  })

  it('omits the percentage entirely when the total size is unknown', () => {
    const ops = useFileOpsStore()
    ops.active = [opsTask({ total_size: 0 })]
    const w = mount(UploadPanel, { global: { plugins: [i18n] } })
    expect(w.find('.up-ops-item').text()).not.toContain('%')
  })

  it('switches the header to the processing wording when only operations run', () => {
    const ops = useFileOpsStore()
    ops.active = [opsTask()]
    const w = mount(UploadPanel, { global: { plugins: [i18n] } })
    expect(w.find('.up-title').text()).toBe(i18n.global.t('filesUploadHeaderProcessing'))
  })

  it('cancels every operation through the store when cancel-all is pressed', async () => {
    const ops = useFileOpsStore()
    ops.active = [opsTask()]
    let called = 0
    ops.cancelAll = async () => { called += 1 }
    const w = mount(UploadPanel, { global: { plugins: [i18n] } })
    await w.find('.up-ops-cancel-all').trigger('click')
    expect(called).toBe(1)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm exec vitest run src/files/components/UploadPanel.test.ts`
Expected: 5 条新用例 FAIL

- [ ] **Step 3: 加第三个 i18n 键**

`src/i18n/zh_cn.base.ts`:`filesUploadZoneOps: '文件操作',`
`src/i18n/en_us.base.ts`:`filesUploadZoneOps: 'File operations',`

- [ ] **Step 4: 写实现**

`<script setup>` 里加:

```ts
import { opsTaskPercent, opsTaskLabelKey, opsTaskBasename, resolveUploaderHeader } from '../util/opsRow'

const headerText = computed(() =>
  t(resolveUploaderHeader({ uploadCount: totalCount.value, opsCount: opsCount.value })),
)
```

模板:头部那句改成 `<span class="up-title">{{ headerText }}</span>`。
在**警示区(`problemBatches`)之后、上传中区(`activeBatches`)之前**插入分组:

```vue
      <div v-if="opsCount" class="up-zone">
        <div class="up-zone-head">
          <span class="up-zone-title">{{ t('filesUploadZoneOps') }}</span>
          <button class="up-link-btn up-ops-cancel-all" @click="ops.cancelAll()">{{ t('filesCancelAll') }}</button>
        </div>
        <div v-for="task in ops.active" :key="task.id" class="up-item up-ops-item">
          <div class="up-item-line">
            <span class="up-item-name">{{ t(opsTaskLabelKey(task)) }} · {{ opsTaskBasename(task.processing_path) }}</span>
            <span v-if="opsTaskPercent(task) !== null" class="up-item-pct">{{ opsTaskPercent(task) }}%</span>
          </div>
          <div class="up-progress">
            <div class="up-progress-fill" :style="{ width: (opsTaskPercent(task) ?? 0) + '%' }"></div>
          </div>
        </div>
      </div>
```

`<style scoped>` 里加(**只用 token,禁字面色值**):

```css
.up-zone-head { display: flex; align-items: center; justify-content: space-between; }
```

⚠️ `.up-zone-title` / `.up-item` / `.up-progress` / `.up-progress-fill` / `.up-item-pct` **复用既有规则,不要重复定义**。
⚠️ 改 CSS 时确认没有 `*` 紧贴 `/` —— 那会提前关闭注释块并吃掉后面整条规则,而五道门全瞎(本仓已有专门守卫,务必跑 `src/styles/`)。

- [ ] **Step 5: 跑测试确认通过**

Run: `pnpm exec vitest run src/files/components/UploadPanel.test.ts src/i18n/parity.test.ts src/styles/`
Expected: 全绿

- [ ] **Step 6: 变异验证**

把 `v-if="opsTaskPercent(task) !== null"` 改成 `v-if="true"` 并把插值换成 `opsTaskPercent(task) ?? 0`,重跑 → 「omits the percentage entirely」必须真红。恢复后全绿。

- [ ] **Step 7: 提交**

```bash
git add src/files/components/UploadPanel.vue src/files/components/UploadPanel.test.ts src/i18n/zh_cn.base.ts src/i18n/en_us.base.ts
git commit -m "feat(files): show file-operation progress inside the upload panel

Rows sit between the problem and active upload zones, matching Vue2's
layout. An unknown total size renders no percentage rather than a bar
claiming 0%.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: 下线 `OperationStatusBar`

**Files:**
- Delete: `src/files/components/OperationStatusBar.vue`, `src/files/components/OperationStatusBar.test.ts`
- Modify: `src/views/Files.vue`(删 `:17` 的 import 与 `:739` 的挂载)

⚠️ **只删组件。** `Files.vue:578` 的 socket 接线(`bus.on('nimoos:file:operate', ...)`)与 `src/files/stores/fileOps.ts` **一行都不许动** —— 它们本就在组件之外,是 Vue2 #89 要求「把 socket 处理器搬出组件」的既成结果。

- [ ] **Step 1: 先确认没有别的消费者**

Run: `grep -rn "OperationStatusBar" src/`
Expected: 只剩 `src/views/Files.vue` 两处 + 组件自身 + 它自己的测试。**若出现第三处消费者,停下来报告,不要自行处置。**
(注:`src/apps/views/AppSettingsPage.vue` 与 `src/files/util/fileOps.ts` 里各有一处**注释**提到这个名字 —— 那是历史说明不是引用,本任务把它们改写成不指向已删文件的措辞。)

- [ ] **Step 2: 删组件与其测试**

```bash
git rm src/files/components/OperationStatusBar.vue src/files/components/OperationStatusBar.test.ts
```

- [ ] **Step 3: 改 `Files.vue`**

删掉这一行 import:

```ts
import OperationStatusBar from '../files/components/OperationStatusBar.vue'
```

删掉模板里这一行:

```vue
    <OperationStatusBar />
```

- [ ] **Step 4: 改写两处悬空注释**

`src/files/util/fileOps.ts` 里 `parseFileOperate` 上方那句「(移植 Vue2 OperationStatusBar)」改成:

```ts
// socket props.file_operate is a JSON string -> { data: FileTask[] } (ported
// from Vue2's FilePanel socket handler).
```

`src/apps/views/AppSettingsPage.vue:190` 附近那句提到 `OperationStatusBar.vue` 的注释,把该文件名换成 `UploadPanel.vue`(同类先例仍然成立,只是宿主换了)。

- [ ] **Step 5: 跑类型检查 + 全量测试(前台)**

Run: `pnpm exec vue-tsc --noEmit && pnpm exec vitest run`
Expected: exit 0,零失败。**这一步会跑约 3 分钟,前台等它跑完,不要丢后台。**

- [ ] **Step 6: 提交**

```bash
git add -A src/files/components src/views/Files.vue src/files/util/fileOps.ts src/apps/views/AppSettingsPage.vue
git commit -m "refactor(files): retire the standalone operation status bar

Its content now lives in the upload panel. The socket wiring stays where it
already was, outside the component, so nothing about the data path changes.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

# Part B —— #90 可靠性核心

### Task 6: 断连主干 —— `onTransferBroken` + 传输态复位

**Files:**
- Modify: `src/files/drop/rtcPeer.ts`, `src/files/drop/rtcPeer.test.ts`
- Modify: `src/files/drop/stores/drop.ts`(补上新回调,否则类型不过)

**Interfaces:**
- Produces: `PeerEvents.onTransferBroken(e: { peerId: string; reason: TransferBrokenReason }): void` · `type TransferBrokenReason = 'disconnected' | 'timeout' | 'cancelled'` · `Peer.hasActiveTransfer(): boolean` · `Peer.handleDisconnect(reason: TransferBrokenReason): void`

**这是 Part B 的地基**,后面三个任务都调 `handleDisconnect`。

- [ ] **Step 1: 写失败测试(追加到 `rtcPeer.test.ts`)**

```ts
describe('Peer disconnect handling', () => {
  it('reports a broken transfer and unblocks the queue when the peer goes away mid-send', async () => {
    const ev = makeEvents()
    const p = new TestPeer({ send: vi.fn() }, 'peer2', ev)
    const f = (n: string) => new File([new Uint8Array(10)], n)
    p.sendFiles([f('1')], 'self1')
    await vi.waitFor(() => expect(jsonOut(p).filter((m) => m.type === 'header').length).toBe(1))

    p.handleDisconnect('disconnected')

    expect(ev.onTransferBroken).toHaveBeenCalledWith({ peerId: 'peer2', reason: 'disconnected' })
    expect(p.hasActiveTransfer()).toBe(false)
  })

  it('accepts a brand new send after a disconnect, instead of staying wedged forever', async () => {
    const ev = makeEvents()
    const p = new TestPeer({ send: vi.fn() }, 'peer2', ev)
    const f = (n: string) => new File([new Uint8Array(10)], n)
    p.sendFiles([f('first')], 'self1')
    await vi.waitFor(() => expect(jsonOut(p).filter((m) => m.type === 'header').length).toBe(1))
    p.handleDisconnect('disconnected')

    p.sendFiles([f('second')], 'self1')

    await vi.waitFor(() => expect(jsonOut(p).filter((m) => m.type === 'header').length).toBe(2))
    const headers = jsonOut(p).filter((m) => m.type === 'header')
    expect(headers[1].name).toBe('second')
  })

  it('drops the half-assembled incoming file so a later transfer does not inherit its bytes', () => {
    const ev = makeEvents()
    const p = new TestPeer({ send: vi.fn() }, 'peer2', ev)
    p.handleChannelMessage(JSON.stringify({ type: 'header', name: 'x.bin', mime: '', size: 16, from: 'peer2' }))
    p.handleChannelMessage(new Uint8Array(8).buffer)
    expect(p.hasActiveTransfer()).toBe(true)

    p.handleDisconnect('disconnected')

    expect(p.hasActiveTransfer()).toBe(false)
    p.handleChannelMessage(new Uint8Array(8).buffer)
    expect(ev.onFileReceived).not.toHaveBeenCalled()
  })

  it('stays silent when nothing was in flight, so idle reconnects do not nag the user', () => {
    const ev = makeEvents()
    const p = new TestPeer({ send: vi.fn() }, 'peer2', ev)
    p.handleDisconnect('disconnected')
    expect(ev.onTransferBroken).not.toHaveBeenCalled()
  })
})
```

⚠️ 同时把文件顶部的 `makeEvents()` 补上新回调:

```ts
function makeEvents(): PeerEvents {
  return {
    onFileProgress: vi.fn(), onFileReceived: vi.fn(), onTextReceived: vi.fn(),
    onTransferComplete: vi.fn(), onTransferBroken: vi.fn(),
  }
}
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm exec vitest run src/files/drop/rtcPeer.test.ts`
Expected: FAIL —— `p.handleDisconnect is not a function`

- [ ] **Step 3: 写实现**

`src/files/drop/protocol.ts` 加类型(放在 `ChannelMessage` 定义下方):

```ts
export type TransferBrokenReason = 'disconnected' | 'timeout' | 'cancelled'
```

`src/files/drop/rtcPeer.ts`:

```ts
import { ..., type TransferBrokenReason } from './protocol'

export interface PeerEvents {
  onFileProgress: (e: { sender: string; progress: number; filesQueue: number; files: File[] }) => void
  onFileReceived: (e: { file: ReceivedFile; from: string }) => void
  onTextReceived: (e: { text: string; sender: string }) => void
  onTransferComplete: () => void
  onTransferBroken: (e: { peerId: string; reason: TransferBrokenReason }) => void
}
```

在 `Peer` 类里加:

```ts
  /** True while this peer is sending or assembling something. */
  hasActiveTransfer(): boolean {
    return this.busy || this.digester !== null
  }

  /**
   * The single place a transfer dies. Resets the peer so the next send starts
   * clean, then tells the UI -- but only when something was actually in
   * flight. Channels close routinely during idle reconnects; reporting those
   * would train the user to ignore the message that matters.
   */
  handleDisconnect(reason: TransferBrokenReason): void {
    const wasActive = this.hasActiveTransfer()
    this.resetTransferState()
    if (wasActive) this.events.onTransferBroken({ peerId: this._peerId, reason })
  }

  protected resetTransferState(): void {
    this.busy = false
    this.chunker = null
    this.digester = null
    this.filesQueue = []
    this.files = []
    this.lastProgress = 0
    this.incomingFrom = ''
  }
```

`src/files/drop/stores/drop.ts` 的 `new PeersManager(server, { ... })` 回调表里补一条,先接成清状态 + toast(Task 10 会再细化,这里必须先有,否则 TS 不过):

```ts
      onTransferBroken: (e) => {
        delete transfers.value[e.peerId]
        useToast().show(t('filesDropInterrupted'), 3000)
      },
```

并加 i18n 键 —— `zh_cn.base.ts`: `filesDropInterrupted: '传输已中断',`;`en_us.base.ts`: `filesDropInterrupted: 'Transfer interrupted',`

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm exec vitest run src/files/drop/ src/i18n/parity.test.ts`
Expected: 全绿

- [ ] **Step 5: 变异验证**

把 `handleDisconnect` 里的 `if (wasActive)` 去掉(改成无条件 emit),重跑 → 「stays silent when nothing was in flight」必须真红。再把 `resetTransferState()` 整行注释掉 → 前两条必须真红。两次都恢复后全绿。

- [ ] **Step 6: 提交**

```bash
git add src/files/drop/protocol.ts src/files/drop/rtcPeer.ts src/files/drop/rtcPeer.test.ts src/files/drop/stores/drop.ts src/i18n/zh_cn.base.ts src/i18n/en_us.base.ts
git commit -m "feat(drop): report broken transfers and reset the peer that lost one

Until now a vanished peer left busy=true forever, so its queue could never
accept another file. Idle channel closes stay silent on purpose.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: 通道关闭 / 连接失败 / 无通道发送 三条路径接上断连主干

**Files:**
- Modify: `src/files/drop/rtcPeer.ts`, `src/files/drop/rtcPeer.test.ts`

**Interfaces:**
- Consumes: Task 6 的 `handleDisconnect`

**现状缺口**:`onChannelClosed()` 对**非主叫直接 `return`**(接收端断连完全静默);`onConnectionStateChange` 只认 `disconnected`/`failed`,漏 `closed`;`sendRaw` 无通道时**静默丢掉这一片数据**再 `refresh()`,传输就此停住且无人知情。

- [ ] **Step 1: 写失败测试(追加)**

⚠️ 先把测试文件顶部的 import 补齐 —— 现在只 import 了 `Peer` 和 `PeerEvents`:

```ts
import { Peer, RTCPeer, type PeerEvents } from './rtcPeer'
import { encodeText, type TransferBrokenReason } from './protocol'
```

这三条分支都在 `RTCPeer` 上,必须真的走到那些分支才算数 —— **不要用「直接调 `handleDisconnect()`」冒充**,那只是重测了 Task 6,测试名会说谎。

`RTCPeer` 的构造与 `refresh()` 都会 `new RTCPeerConnection(...)`,而 jsdom 没有这个全局,所以先备一个最小替身:

```ts
describe('RTCPeer disconnect branches', () => {
  class FakeConn {
    connectionState = 'new'
    onicecandidate: unknown = null
    onconnectionstatechange: unknown = null
    ondatachannel: unknown = null
    createDataChannel() { return { send: vi.fn(), close: vi.fn(), readyState: 'connecting' } }
    createOffer() { return Promise.resolve({ type: 'offer', sdp: '' }) }
    setLocalDescription() { return Promise.resolve() }
    setRemoteDescription() { return Promise.resolve() }
    addIceCandidate() { return Promise.resolve() }
    close() {}
  }

  beforeEach(() => { vi.stubGlobal('RTCPeerConnection', FakeConn) })
  afterEach(() => { vi.unstubAllGlobals() })

  function makeRtcPeer(ev: PeerEvents) {
    // A null peerId skips the constructor's connectRtc() -- this is the real
    // "callee waits for the caller to dial" path, not a test-only backdoor.
    const p = new RTCPeer({ send: vi.fn() }, null, ev)
    ;(p as unknown as { _peerId: string })._peerId = 'peer2'
    return p
  }

  function startIncoming(p: RTCPeer) {
    p.handleChannelMessage(JSON.stringify({ type: 'header', name: 'x.bin', mime: '', size: 16, from: 'peer2' }))
    p.handleChannelMessage(new Uint8Array(8).buffer)
  }

  it('reports a disconnect when the data channel closes on the receiving side', () => {
    const ev = makeEvents()
    const p = makeRtcPeer(ev)
    startIncoming(p)

    ;(p as unknown as { onChannelClosed: () => void }).onChannelClosed()

    expect(ev.onTransferBroken).toHaveBeenCalledWith({ peerId: 'peer2', reason: 'disconnected' })
  })

  it('reports a disconnect when the connection reaches the closed state', () => {
    const ev = makeEvents()
    const p = makeRtcPeer(ev)
    startIncoming(p)
    const inner = (p as unknown as { conn: FakeConn | null })
    inner.conn = new FakeConn()
    inner.conn.connectionState = 'closed'

    ;(p as unknown as { onConnectionStateChange: () => void }).onConnectionStateChange()

    expect(ev.onTransferBroken).toHaveBeenCalledWith({ peerId: 'peer2', reason: 'disconnected' })
  })

  it('reports a disconnect when a chunk cannot be sent because the channel is gone', () => {
    const ev = makeEvents()
    const p = makeRtcPeer(ev)
    startIncoming(p) // makes hasActiveTransfer() true so the report is not suppressed
    expect((p as unknown as { channel: unknown }).channel).toBeNull()

    ;(p as unknown as { sendRaw: (d: string) => void }).sendRaw('anything')

    expect(ev.onTransferBroken).toHaveBeenCalledWith({ peerId: 'peer2', reason: 'disconnected' })
  })
})
```

⚠️ 最后一条会顺带走进 `refresh()` → `connectRtc()`,这就是上面必须备 `FakeConn` 的原因。**若它因为替身缺方法而报错,补替身,不要改生产代码去迁就测试。**

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm exec vitest run src/files/drop/rtcPeer.test.ts`
Expected: 「reports a disconnect when the data channel closes on the receiving side」FAIL —— 现在接收端会静默 return

- [ ] **Step 3: 写实现**

`RTCPeer` 里改三处:

```ts
  private onChannelClosed(): void {
    // Both roles must surface the break; only the caller re-dials. The old
    // code returned early for the callee, which meant a receiver whose sender
    // vanished got no signal at all.
    this.handleDisconnect('disconnected')
    if (!this.isCaller) return
    this.connectRtc(this._peerId, true)
  }

  private onConnectionStateChange(): void {
    if (!this.conn) return
    switch (this.conn.connectionState) {
      case 'disconnected': this.onChannelClosed(); break
      case 'closed': this.onChannelClosed(); break
      case 'failed': this.conn = null; this.onChannelClosed(); break
    }
  }

  protected sendRaw(data: string | ArrayBuffer): void {
    if (!this.channel) {
      // Previously this dropped the chunk and called refresh(), so the
      // transfer stalled with nobody told. Treat a missing channel as what it
      // is -- the transfer cannot continue.
      this.handleDisconnect('disconnected')
      this.refresh()
      return
    }
    // TS's send overloads do not accept the union, so dispatch on the runtime type
    if (typeof data === 'string') this.channel.send(data)
    else this.channel.send(data)
  }
```

⚠️ `onChannelClosed` 必须从 `private` 改成 `protected`(测试要调它),或在测试里用 `as unknown as` 断言访问 —— **选后者,不要为了测试放宽生产代码的可见性**。上面的测试代码已按后者写好。

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm exec vitest run src/files/drop/`
Expected: 全绿

- [ ] **Step 5: 变异验证**

把 `onChannelClosed` 里 `handleDisconnect` 那行挪回 `if (!this.isCaller) return` **之后**,重跑 → 接收端那条必须真红。恢复后全绿。

- [ ] **Step 6: 提交**

```bash
git add src/files/drop/rtcPeer.ts src/files/drop/rtcPeer.test.ts
git commit -m "fix(drop): stop swallowing disconnects on the receiving side

The callee returned early from onChannelClosed, so a receiver whose sender
vanished was never told. A missing channel in sendRaw dropped the chunk just
as quietly. Both now report; the caller still re-dials.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: 发送端等待超时 —— 解开「队列永久卡死」

**Files:**
- Modify: `src/files/drop/protocol.ts`, `src/files/drop/rtcPeer.ts`, `src/files/drop/rtcPeer.test.ts`

**Interfaces:**
- Consumes: Task 6 的 `handleDisconnect`
- Produces: `ACK_TIMEOUT_MS` from `protocol.ts`

**这是本批最核心的行为。** 发送端发完一个分区就等对端的 `partition-received`,发完最后一片就等 `transfer-complete`;对端一旦消失,这两个等待**永远不会结束**,`busy` 恒真 ⇒ 该 peer 从此彻底卡死。

- [ ] **Step 1: 写失败测试(追加)**

⚠️ **fake timers 必须用 `{ shouldAdvanceTime: true }`**(下面代码里已经是)。`FileChunker` 靠 `FileReader` 真异步推进,而 `vi.waitFor` 用 `setTimeout` 轮询 —— 普通 fake timers 会把两者一起冻住,测试挂死而不是变红。这一条同样适用于 Task 12。

```ts
describe('Peer send-side timeouts', () => {
  it('gives up on a partition acknowledgement that never comes, and unblocks the queue', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const ev = makeEvents()
      const p = new TestPeer({ send: vi.fn() }, 'peer2', ev)
      const file = new File([new Uint8Array(70000)], 'a.bin')
      p.sendFiles([file], 'self1')
      // FileReader is async even under fake timers; drain the microtask/macro
      // queue until the first partition marker has gone out.
      await vi.waitFor(() => expect(jsonOut(p).some((m) => m.type === 'partition')).toBe(true))

      vi.advanceTimersByTime(ACK_TIMEOUT_MS + 1)

      expect(ev.onTransferBroken).toHaveBeenCalledWith({ peerId: 'peer2', reason: 'timeout' })
      expect(p.hasActiveTransfer()).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not fire once the acknowledgement arrives in time', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const ev = makeEvents()
      const p = new TestPeer({ send: vi.fn() }, 'peer2', ev)
      const file = new File([new Uint8Array(70000)], 'a.bin')
      p.sendFiles([file], 'self1')
      await vi.waitFor(() => expect(jsonOut(p).some((m) => m.type === 'partition')).toBe(true))

      p.handleChannelMessage(JSON.stringify({ type: 'partition-received', offset: 64000 }))
      vi.advanceTimersByTime(ACK_TIMEOUT_MS + 1)

      expect(ev.onTransferBroken).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('arms the same timeout while waiting for the final transfer-complete', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const ev = makeEvents()
      const p = new TestPeer({ send: vi.fn() }, 'peer2', ev)
      const file = new File([new Uint8Array(10)], 'small.bin')
      p.sendFiles([file], 'self1')
      await vi.waitFor(() => expect(jsonOut(p).some((m) => m.type === 'partition')).toBe(true))
      p.handleChannelMessage(JSON.stringify({ type: 'partition-received', offset: 10 }))

      vi.advanceTimersByTime(ACK_TIMEOUT_MS + 1)

      expect(ev.onTransferBroken).toHaveBeenCalledWith({ peerId: 'peer2', reason: 'timeout' })
    } finally {
      vi.useRealTimers()
    }
  })

  it('clears the timer on transfer-complete so a finished send never reports a timeout', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const ev = makeEvents()
      const p = new TestPeer({ send: vi.fn() }, 'peer2', ev)
      const file = new File([new Uint8Array(10)], 'small.bin')
      p.sendFiles([file], 'self1')
      await vi.waitFor(() => expect(jsonOut(p).some((m) => m.type === 'partition')).toBe(true))
      p.handleChannelMessage(JSON.stringify({ type: 'partition-received', offset: 10 }))
      p.handleChannelMessage(JSON.stringify({ type: 'transfer-complete' }))

      vi.advanceTimersByTime(ACK_TIMEOUT_MS + 1)

      expect(ev.onTransferBroken).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })
})
```

顶部 import 补 `ACK_TIMEOUT_MS`。

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm exec vitest run src/files/drop/rtcPeer.test.ts`
Expected: FAIL —— `ACK_TIMEOUT_MS` 未导出

- [ ] **Step 3: 写实现**

`protocol.ts`:

```ts
// A sender that has shipped a partition waits for the peer's acknowledgement.
// Without a bound, a peer that simply vanished leaves the queue wedged for the
// lifetime of the tab.
export const ACK_TIMEOUT_MS = 30000
```

`rtcPeer.ts` 的 `Peer` 类:

```ts
  private ackTimer: ReturnType<typeof setTimeout> | null = null

  private armAck(): void {
    this.clearAck()
    this.ackTimer = setTimeout(() => this.handleDisconnect('timeout'), ACK_TIMEOUT_MS)
  }

  private clearAck(): void {
    if (this.ackTimer === null) return
    clearTimeout(this.ackTimer)
    this.ackTimer = null
  }
```

`resetTransferState()` 里第一行加 `this.clearAck()`。

`sendFile` 的分区回调改成发完就武装:

```ts
    this.chunker = new FileChunker(
      file,
      (chunk) => this.sendRaw(chunk),
      (offset) => { this.sendJSON({ type: 'partition', offset }); this.armAck() },
    )
```

`handleChannelMessage` 的两个 case 改成:

```ts
      case 'partition-received':
        this.clearAck()
        if (this.chunker && !this.chunker.isFileEnd()) this.chunker.nextPartition()
        // Last partition acknowledged: now we are waiting for the receiver to
        // finish assembling and say transfer-complete. Same bound applies.
        else this.armAck()
        break
      case 'transfer-complete': this.clearAck(); this.onTransferCompleted(); break
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm exec vitest run src/files/drop/rtcPeer.test.ts`
Expected: 全绿

- [ ] **Step 5: 变异验证**

把 `case 'partition-received'` 里的 `else this.armAck()` 删掉,重跑 → 「arms the same timeout while waiting for the final transfer-complete」必须真红。再把 `clearAck()` 从 `transfer-complete` 分支删掉 → 最后一条必须真红。两次都恢复后全绿。

- [ ] **Step 6: 提交**

```bash
git add src/files/drop/protocol.ts src/files/drop/rtcPeer.ts src/files/drop/rtcPeer.test.ts
git commit -m "fix(drop): bound the sender's waits so a vanished peer cannot wedge it

Waiting for partition-received or transfer-complete had no timeout, so busy
stayed true forever and that peer accepted no further files for the life of
the tab.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: 真取消 —— `cancelTransfer` 两端生效

**Files:**
- Modify: `src/files/drop/protocol.ts`, `src/files/drop/chunker.ts`, `src/files/drop/chunker.test.ts`, `src/files/drop/rtcPeer.ts`, `src/files/drop/rtcPeer.test.ts`

**Interfaces:**
- Produces: `FileChunker.abort(): void` · `Peer.cancelTransfer(): void`;`ChannelMessage` 新增 `{ type: 'transfer-cancel' }`

**为什么必须动 chunker**:`resetTransferState()` 只是把 `this.chunker` 置空,而 `FileReader` 的 load 回调**握着 chunker 自己的引用**,会继续读下一块并调 `sendRaw` —— 取消后字节照发。

- [ ] **Step 1: 写失败测试**

`src/files/drop/chunker.test.ts` 追加:

```ts
it('stops feeding chunks once aborted', async () => {
  const chunks: ArrayBuffer[] = []
  const file = new File([new Uint8Array(200000)], 'big.bin')
  const c = new FileChunker(file, (ch) => { chunks.push(ch); c.abort() }, () => {})
  c.nextPartition()
  await new Promise((r) => setTimeout(r, 20))
  expect(chunks.length).toBe(1)
})
```

`src/files/drop/rtcPeer.test.ts` 追加:

```ts
describe('Peer cancellation', () => {
  it('tells the peer, clears local state, and reports the cancellation', async () => {
    const ev = makeEvents()
    const p = new TestPeer({ send: vi.fn() }, 'peer2', ev)
    p.sendFiles([new File([new Uint8Array(10)], 'x')], 'self1')
    await vi.waitFor(() => expect(p.hasActiveTransfer()).toBe(true))

    p.cancelTransfer()

    expect(jsonOut(p).some((m) => m.type === 'transfer-cancel')).toBe(true)
    expect(p.hasActiveTransfer()).toBe(false)
    expect(ev.onTransferBroken).toHaveBeenCalledWith({ peerId: 'peer2', reason: 'cancelled' })
  })

  it('does nothing at all when there is no transfer to cancel', () => {
    const ev = makeEvents()
    const p = new TestPeer({ send: vi.fn() }, 'peer2', ev)
    p.cancelTransfer()
    expect(p.out.length).toBe(0)
    expect(ev.onTransferBroken).not.toHaveBeenCalled()
  })

  it('discards the partly received file when the sender cancels', () => {
    const ev = makeEvents()
    const p = new TestPeer({ send: vi.fn() }, 'peer2', ev)
    p.handleChannelMessage(JSON.stringify({ type: 'header', name: 'x.bin', mime: '', size: 16, from: 'peer2' }))
    p.handleChannelMessage(new Uint8Array(8).buffer)

    p.handleChannelMessage(JSON.stringify({ type: 'transfer-cancel' }))

    expect(p.hasActiveTransfer()).toBe(false)
    expect(ev.onTransferBroken).toHaveBeenCalledWith({ peerId: 'peer2', reason: 'cancelled' })
    p.handleChannelMessage(new Uint8Array(8).buffer)
    expect(ev.onFileReceived).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm exec vitest run src/files/drop/chunker.test.ts src/files/drop/rtcPeer.test.ts`
Expected: FAIL —— `c.abort is not a function` / `p.cancelTransfer is not a function`

- [ ] **Step 3: 写实现**

`protocol.ts` 的 `ChannelMessage` 联合加一项:

```ts
  | { type: 'transfer-cancel' }
```

`chunker.ts`:

```ts
  private aborted = false

  /** Stops the read loop. The FileReader's load callback holds its own
   *  reference to this chunker, so nulling the caller's handle is not enough
   *  to stop bytes from flowing. */
  abort(): void {
    this.aborted = true
    try { this.reader.abort() } catch { /* reader may already be idle */ }
  }
```

`onChunkRead` 第一行加 `if (this.aborted) return`。

`rtcPeer.ts` 的 `Peer`:

```ts
  /** User-initiated stop. Silent when nothing is running so a stray click
   *  cannot spam the peer with cancel messages. */
  cancelTransfer(): void {
    if (!this.hasActiveTransfer()) return
    this.sendJSON({ type: 'transfer-cancel' })
    this.chunker?.abort()
    this.resetTransferState()
    this.events.onTransferBroken({ peerId: this._peerId, reason: 'cancelled' })
  }
```

`resetTransferState()` 里,在把 `chunker` 置空**之前**加 `this.chunker?.abort()`,这样任何复位路径(断连/超时/取消)都停得住读循环。**顺带把 `cancelTransfer` 里那句重复的 `this.chunker?.abort()` 去掉。**

`handleChannelMessage` 加一个 case:

```ts
      case 'transfer-cancel':
        // The other side gave up. Drop whatever we were assembling; a later
        // transfer must not inherit these bytes.
        this.resetTransferState()
        this.events.onTransferBroken({ peerId: this._peerId, reason: 'cancelled' })
        break
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm exec vitest run src/files/drop/`
Expected: 全绿

- [ ] **Step 5: 变异验证**

把 `chunker.ts` 的 `if (this.aborted) return` 删掉,重跑 → 「stops feeding chunks once aborted」必须真红。恢复后全绿。

- [ ] **Step 6: 提交**

```bash
git add src/files/drop/protocol.ts src/files/drop/chunker.ts src/files/drop/chunker.test.ts src/files/drop/rtcPeer.ts src/files/drop/rtcPeer.test.ts
git commit -m "feat(drop): make cancelling a transfer actually stop it

Nulling the chunker was never enough -- the FileReader callback holds its own
reference and keeps shipping bytes. Aborting it is now part of every reset
path, and the receiving side discards its partial file.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: `PeersManager` 转发 + drop store 暴露

**Files:**
- Modify: `src/files/drop/peersManager.ts`, `src/files/drop/peersManager.test.ts`, `src/files/drop/stores/drop.ts`

**Interfaces:**
- Produces: `PeersManager.hasActiveTransfers(): boolean` · `PeersManager.cancelTransfer(peerId: string): void` · store 的 `hasActiveTransfers()` / `cancelTransfer(peerId)`

- [ ] **Step 1: 写失败测试(追加到 `peersManager.test.ts`)**

```ts
describe('PeersManager transfer control', () => {
  it('reports an active transfer when any peer has one', () => {
    const made: Array<{ hasActiveTransfer: () => boolean; cancelTransfer: () => void }> = []
    const mgr = new PeersManager({ send: vi.fn() }, makeEvents(), {
      rtcSupported: true,
      makePeer: () => {
        const p = { hasActiveTransfer: () => made.length === 1, cancelTransfer: vi.fn(), refresh: vi.fn(), close: vi.fn() }
        made.push(p as never)
        return p as never
      },
    })
    mgr.handleServerMessage({ type: 'peers', peers: [{ id: 'p1', name: { model: 'desktop', deviceName: 'd', displayName: 'D' }, rtcSupported: true }] })
    expect(mgr.hasActiveTransfers()).toBe(true)
  })

  it('cancels only the peer it was asked about', () => {
    const cancels: string[] = []
    const mgr = new PeersManager({ send: vi.fn() }, makeEvents(), {
      rtcSupported: true,
      makePeer: (_s, id) => ({
        hasActiveTransfer: () => true,
        cancelTransfer: () => cancels.push(String(id)),
        refresh: vi.fn(), close: vi.fn(),
      }) as never,
    })
    mgr.handleServerMessage({ type: 'peers', peers: [
      { id: 'p1', name: { model: 'desktop', deviceName: 'a', displayName: 'A' }, rtcSupported: true },
      { id: 'p2', name: { model: 'desktop', deviceName: 'b', displayName: 'B' }, rtcSupported: true },
    ] })

    mgr.cancelTransfer('p2')

    expect(cancels).toEqual(['p2'])
  })

  it('ignores a cancel for a peer that is not connected', () => {
    const mgr = new PeersManager({ send: vi.fn() }, makeEvents(), { rtcSupported: true })
    expect(() => mgr.cancelTransfer('nobody')).not.toThrow()
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm exec vitest run src/files/drop/peersManager.test.ts`
Expected: FAIL —— `mgr.hasActiveTransfers is not a function`

- [ ] **Step 3: 写实现**

`peersManager.ts`:

```ts
  hasActiveTransfers(): boolean {
    return Object.values(this.peers).some((p) => p.hasActiveTransfer())
  }

  cancelTransfer(peerId: string): void {
    this.peers[peerId]?.cancelTransfer()
  }
```

`stores/drop.ts`:把 Task 6 临时接的 `onTransferBroken` 保留(已经是最终形态),并在文件末尾的 `return { ... }` 里补两个方法:

```ts
  function hasActiveTransfers(): boolean {
    return manager?.hasActiveTransfers() ?? false
  }

  function cancelTransfer(peerId: string): void {
    manager?.cancelTransfer(peerId)
  }
```

```ts
  return {
    peers, selfId, connected, transfers, receiveQueue, init, destroy, sendFiles,
    saveCurrent, ignoreCurrent, deviceName, hasActiveTransfers, cancelTransfer,
  }
```

⚠️ **Pinia setup store 的坑**:忘了写进 `return` 不会报错,外部读到的是 `undefined`(本仓已栽过一次)。加完立刻用下一步的测试确认。

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm exec vitest run src/files/drop/`
Expected: 全绿

- [ ] **Step 5: 变异验证**

从 store 的 `return` 里删掉 `cancelTransfer`,跑 `pnpm exec vue-tsc --noEmit` —— **预期它不报错**(这正是那个坑),再跑 Task 11 之后的组件测试才会红。**把这个观察如实写进报告**,说明这条只能靠组件层测试保护。恢复。

- [ ] **Step 6: 提交**

```bash
git add src/files/drop/peersManager.ts src/files/drop/peersManager.test.ts src/files/drop/stores/drop.ts
git commit -m "feat(drop): expose transfer state and cancellation to the UI layer

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: `DropItem` 取消菜单项

**Files:**
- Modify: `src/files/drop/components/DropItem.vue`, `src/files/drop/components/DropPage.vue`
- Test: `src/files/drop/components/DropItem.test.ts`(不存在则新建)

**Interfaces:**
- Produces: `DropItem` 新增 emit `'cancel-transfer': []`
- Consumes: store 的 `cancelTransfer(peerId)`

**注意**:`DropItem` 已有 reka-ui `ContextMenu`(`:71-89`),里面当前只有一项「发送文件」。本任务是**往已有菜单加第二项**,不是新造组件。

- [ ] **Step 1: 加 i18n 键**

`zh_cn.base.ts`: `filesDropMenuCancel: '取消发送',`
`en_us.base.ts`: `filesDropMenuCancel: 'Cancel sending',`

- [ ] **Step 2: 写失败测试**

```ts
// src/files/drop/components/DropItem.test.ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { i18n } from '../../../i18n'
import DropItem from './DropItem.vue'
import type { PeerInfo } from '../protocol'

const device: PeerInfo = {
  id: 'p2', rtcSupported: true,
  name: { model: 'desktop', deviceName: 'box', displayName: 'Box' },
}

function mountItem(props: Record<string, unknown>) {
  return mount(DropItem, {
    props: { device, isSelf: false, isFloat: false, ...props },
    global: { plugins: [i18n] },
  })
}

describe('DropItem cancel entry', () => {
  it('offers cancelling only while a transfer is running', () => {
    const idle = mountItem({})
    expect(idle.html()).not.toContain(i18n.global.t('filesDropMenuCancel'))
  })

  it('emits cancel-transfer when the menu entry is chosen', async () => {
    const w = mountItem({ transfer: { progress: 40, sending: true, count: 1 } })
    const entries = w.findAllComponents({ name: 'ContextMenuItem' })
    const cancel = entries.find((e) => e.text() === i18n.global.t('filesDropMenuCancel'))
    expect(cancel).toBeTruthy()
    await cancel!.vm.$emit('select')
    expect(w.emitted('cancel-transfer')).toBeTruthy()
  })
})
```

⚠️ reka-ui 的 `ContextMenuItem` 只有在菜单**打开**时才渲染进 portal。若上面 `findAllComponents` 取不到,改用「直接断言组件树里 `#menu` 插槽的 vnode」的写法 —— **不要为了让测试好写而把菜单项挪出 ContextMenu**。若两种写法都取不到,停下来报告,由控制器裁定。

- [ ] **Step 3: 跑测试确认失败**

Run: `pnpm exec vitest run src/files/drop/components/DropItem.test.ts`
Expected: 第二条 FAIL

- [ ] **Step 4: 写实现**

`DropItem.vue`:

```ts
const emit = defineEmits<{ 'select-files': [files: File[]]; 'cancel-transfer': [] }>()
```

菜单插槽里加第二项:

```vue
      <template #menu>
        <ContextMenuItem class="ui-ctx-item" @select="pick">{{ t('filesDropMenuSend') }}</ContextMenuItem>
        <ContextMenuItem
          v-if="transfer"
          class="ui-ctx-item danger"
          @select="emit('cancel-transfer')"
        >{{ t('filesDropMenuCancel') }}</ContextMenuItem>
      </template>
```

`.ui-ctx-item.danger` 是 `components/ui/ContextMenu.vue` 里既有的非 scoped 规则(危险色随主题切换),**不要新写颜色**。

`DropPage.vue` 的 `<DropItem>` 挂载点加一行接线:

```vue
        @cancel-transfer="drop.cancelTransfer(p.peer.id)"
```

- [ ] **Step 5: 跑测试确认通过**

Run: `pnpm exec vitest run src/files/drop/ src/i18n/parity.test.ts`
Expected: 全绿

- [ ] **Step 6: 变异验证**

把 `v-if="transfer"` 删掉,重跑 → 「offers cancelling only while a transfer is running」必须真红。恢复后全绿。

- [ ] **Step 7: 提交**

```bash
git add src/files/drop/components/DropItem.vue src/files/drop/components/DropItem.test.ts src/files/drop/components/DropPage.vue src/i18n/zh_cn.base.ts src/i18n/en_us.base.ts
git commit -m "feat(drop): add a cancel entry to the device context menu

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 12: `DropItem` 进度看门狗

**Files:**
- Modify: `src/files/drop/components/DropItem.vue`, `src/files/drop/components/DropItem.test.ts`, `src/files/drop/components/DropPage.vue`

**Interfaces:**
- Produces: `DropItem` 新增 emit `'transfer-stalled': []`

**为什么还要看门狗**:Task 8 的超时只覆盖「发送端等 ack」。接收端、以及连接**没有关闭但数据不再流动**(网络黑洞)的情况,通道层不会报任何事件 —— 只有「进度多久没动」这个信号能发现。

- [ ] **Step 1: 写失败测试(追加)**

```ts
import { vi } from 'vitest'

describe('DropItem stall watchdog', () => {
  it('reports a stall when progress stops moving for long enough', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const w = mountItem({ transfer: { progress: 40, sending: true, count: 1 } })
      vi.advanceTimersByTime(20000)
      await w.vm.$nextTick()
      expect(w.emitted('transfer-stalled')).toBeTruthy()
    } finally {
      vi.useRealTimers()
    }
  })

  it('keeps quiet while progress is still advancing', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const w = mountItem({ transfer: { progress: 40, sending: true, count: 1 } })
      vi.advanceTimersByTime(10000)
      await w.setProps({ transfer: { progress: 55, sending: true, count: 1 } })
      vi.advanceTimersByTime(10000)
      await w.vm.$nextTick()
      expect(w.emitted('transfer-stalled')).toBeFalsy()
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not run at all when no transfer is in flight', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const w = mountItem({})
      vi.advanceTimersByTime(60000)
      await w.vm.$nextTick()
      expect(w.emitted('transfer-stalled')).toBeFalsy()
    } finally {
      vi.useRealTimers()
    }
  })

  it('stops its timer on unmount so a torn-down card cannot fire', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const w = mountItem({ transfer: { progress: 40, sending: true, count: 1 } })
      w.unmount()
      vi.advanceTimersByTime(60000)
      expect(w.emitted('transfer-stalled')).toBeFalsy()
    } finally {
      vi.useRealTimers()
    }
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm exec vitest run src/files/drop/components/DropItem.test.ts`
Expected: 第一条 FAIL

- [ ] **Step 3: 写实现**

`DropItem.vue` 的 `<script setup>`:

```ts
import { onBeforeUnmount, watch } from 'vue'

const emit = defineEmits<{ 'select-files': [files: File[]]; 'cancel-transfer': []; 'transfer-stalled': [] }>()

// Task 8's ack timeout only covers a sender waiting for an acknowledgement.
// A connection that stays open while bytes stop flowing raises no channel
// event at all, so "progress has not moved" is the only signal left.
const STALL_CHECK_MS = 5000
const STALL_LIMIT_MS = 15000

let lastMovedAt = Date.now()
let stallTimer: ReturnType<typeof setInterval> | null = null

watch(
  () => props.transfer?.progress,
  () => { lastMovedAt = Date.now() },
)

function stopWatchdog() {
  if (stallTimer === null) return
  clearInterval(stallTimer)
  stallTimer = null
}

function startWatchdog() {
  stopWatchdog()
  lastMovedAt = Date.now()
  stallTimer = setInterval(() => {
    const t = props.transfer
    if (!t || t.progress <= 0 || t.progress >= 100) return
    if (Date.now() - lastMovedAt < STALL_LIMIT_MS) return
    stopWatchdog()
    emit('transfer-stalled')
  }, STALL_CHECK_MS)
}

watch(
  () => !!props.transfer,
  (active) => { if (active) startWatchdog(); else stopWatchdog() },
  { immediate: true },
)

onBeforeUnmount(stopWatchdog)
```

⚠️ `props` 在 `<script setup>` 里已经通过 `const props = defineProps<...>()` 拿到,别重复声明。

`DropPage.vue` 的 `<DropItem>` 再加一行:

```vue
        @transfer-stalled="drop.cancelTransfer(p.peer.id)"
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm exec vitest run src/files/drop/components/DropItem.test.ts`
Expected: 全绿

- [ ] **Step 5: 变异验证**

把 `onBeforeUnmount(stopWatchdog)` 删掉,重跑 → 「stops its timer on unmount」必须真红。恢复后全绿。

- [ ] **Step 6: 提交**

```bash
git add src/files/drop/components/DropItem.vue src/files/drop/components/DropItem.test.ts src/files/drop/components/DropPage.vue
git commit -m "feat(drop): notice a transfer whose progress has stopped moving

An open connection that stops carrying bytes raises no channel event, so the
progress clock is the only stall signal available.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 13: 离站守卫 —— 路由离开 + 关页

**Files:**
- Create: `src/files/drop/leaveGuard.ts`, `src/files/drop/leaveGuard.test.ts`
- Modify: `src/files/drop/components/DropPage.vue`
- Test: `src/files/drop/components/DropPage.test.ts`(不存在则新建)

**Interfaces:**
- Produces: `installDropUnloadGuard(hasActive: () => boolean, win?: Window): () => void`

⚠️ **形态照 `src/files/upload/unloadGuard.ts`,但装载位置故意不同 —— 且理由不是「那边装错了」。**

**计划撰写期实测更正**:票 A(`installUnloadGuard` 装在 `Files.vue`)**已经修好了**,随 master 合并进来 —— 现在装在 `src/App.vue:75`,并有 `src/App.unloadGuard.test.ts` 专门守着。**不要再把它当成现存缺陷去援引**(本仓教训:计划里写死的事实会先于计划腐烂,援引先例前先核现场)。

正确的对比是**作用域**:上传队列是**应用级** Pinia store、导航走了照传 ⇒ 守卫必须装在应用级;互传传输**只在 drop 页存在**(`DropPage` 的 `onBeforeUnmount` 就调 `drop.destroy()` 把连接全拆了)⇒ 守卫装在页面级才对。装到应用级反而会在没有 drop 页的时候常驻一个恒假的监听器。这条理由要写成英文注释。

- [ ] **Step 1: 写失败测试**

```ts
// src/files/drop/leaveGuard.test.ts
import { describe, it, expect, vi } from 'vitest'
import { installDropUnloadGuard } from './leaveGuard'

function fakeWindow() {
  const handlers: Record<string, EventListener[]> = {}
  return {
    handlers,
    addEventListener: (t: string, h: EventListener) => { (handlers[t] ||= []).push(h) },
    removeEventListener: (t: string, h: EventListener) => {
      handlers[t] = (handlers[t] || []).filter((x) => x !== h)
    },
  } as unknown as Window & { handlers: Record<string, EventListener[]> }
}

describe('installDropUnloadGuard', () => {
  it('prompts the browser while a transfer is running', () => {
    const win = fakeWindow() as never as Window & { handlers: Record<string, EventListener[]> }
    installDropUnloadGuard(() => true, win)
    const e = { preventDefault: vi.fn(), returnValue: undefined } as unknown as BeforeUnloadEvent
    win.handlers.beforeunload[0](e as unknown as Event)
    expect(e.preventDefault).toHaveBeenCalled()
  })

  it('stays out of the way when nothing is in flight', () => {
    const win = fakeWindow() as never as Window & { handlers: Record<string, EventListener[]> }
    installDropUnloadGuard(() => false, win)
    const e = { preventDefault: vi.fn(), returnValue: undefined } as unknown as BeforeUnloadEvent
    win.handlers.beforeunload[0](e as unknown as Event)
    expect(e.preventDefault).not.toHaveBeenCalled()
  })

  it('removes its listener when the returned cleanup runs', () => {
    const win = fakeWindow() as never as Window & { handlers: Record<string, EventListener[]> }
    const off = installDropUnloadGuard(() => true, win)
    off()
    expect(win.handlers.beforeunload.length).toBe(0)
  })

  it('is a no-op in an environment with no window', () => {
    expect(() => installDropUnloadGuard(() => true, undefined as never)()).not.toThrow()
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm exec vitest run src/files/drop/leaveGuard.test.ts`
Expected: FAIL —— 模块不存在

- [ ] **Step 3: 写实现**

```ts
// src/files/drop/leaveGuard.ts

/**
 * Prompts the browser's native "leave site?" dialog while a peer-to-peer
 * transfer is running. Bytes in flight live only in this tab, so a reload or
 * close loses them with no server-side record to resume from.
 *
 * Mounted from DropPage, not from App.vue -- the opposite of
 * src/files/upload/unloadGuard.ts, and deliberately so. Each guard lives where
 * its work lives: the upload queue is an app-level store that keeps running
 * after navigation, so its guard sits in App.vue; drop transfers exist only
 * while DropPage is mounted (its onBeforeUnmount tears the connections down),
 * so an app-level listener here would just idle at all times.
 */
export function installDropUnloadGuard(hasActive: () => boolean, win?: Window): () => void {
  const target = win || (typeof window !== 'undefined' ? window : null)
  if (!target || typeof target.addEventListener !== 'function') return () => {}

  const handler = (e: BeforeUnloadEvent) => {
    if (!hasActive()) return undefined
    // Both forms are needed across browsers to raise the prompt
    e.preventDefault()
    e.returnValue = ''
    return ''
  }

  target.addEventListener('beforeunload', handler as EventListener)
  return () => target.removeEventListener('beforeunload', handler as EventListener)
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm exec vitest run src/files/drop/leaveGuard.test.ts`
Expected: 4/4 PASS

- [ ] **Step 5: 加路由离开确认(`DropPage.vue`)**

i18n 三个键 —— `zh_cn.base.ts`:

```ts
  filesDropLeaveTitle: '传输正在进行',
  filesDropLeaveMessage: '离开此页会中断正在进行的文件传输。确定要离开吗?',
  filesDropLeaveConfirm: '离开',
```

`en_us.base.ts`:

```ts
  filesDropLeaveTitle: 'Transfer in progress',
  filesDropLeaveMessage: 'Leaving this page will interrupt the transfer in progress. Leave anyway?',
  filesDropLeaveConfirm: 'Leave',
```

`DropPage.vue` 的 `<script setup>`:

```ts
import { onBeforeRouteLeave } from 'vue-router'
import AlertDialog from '../../../components/ui/AlertDialog.vue'
import { installDropUnloadGuard } from '../leaveGuard'

const leaveOpen = ref(false)
let leaveResolver: ((ok: boolean) => void) | null = null

function settleLeave(ok: boolean) {
  const r = leaveResolver
  if (!r) return
  leaveResolver = null
  leaveOpen.value = false
  r(ok)
}

// reka-ui's AlertDialogAction fires update:open(false) on the SAME click that
// runs our @confirm, and the order is not guaranteed (see the note in
// UploadPanel.vue). Deferring the cancel answer by a tick lets a confirm that
// lands in the same task win; a real cancel has no confirm behind it, so its
// deferred answer still runs.
function onLeaveOpenChange(v: boolean) {
  leaveOpen.value = v
  if (!v) setTimeout(() => settleLeave(false), 0)
}

function askLeave(): Promise<boolean> {
  return new Promise((resolve) => {
    leaveResolver = resolve
    leaveOpen.value = true
  })
}

onBeforeRouteLeave(async () => {
  if (!drop.hasActiveTransfers()) return true
  return await askLeave()
})

let offUnloadGuard: (() => void) | null = null
```

`onMounted` 里加 `offUnloadGuard = installDropUnloadGuard(() => drop.hasActiveTransfers())`;
`onBeforeUnmount` 里加 `offUnloadGuard?.(); offUnloadGuard = null`(**放在 `drop.destroy()` 之前**)。

模板末尾加:

```vue
    <AlertDialog
      :open="leaveOpen"
      :title="t('filesDropLeaveTitle')"
      :message="t('filesDropLeaveMessage')"
      :confirm-text="t('filesDropLeaveConfirm')"
      :cancel-text="t('filesCancel')"
      destructive
      @update:open="onLeaveOpenChange"
      @confirm="settleLeave(true)"
    />
```

⚠️ 取消按钮用**既有**的 `filesCancel`(`src/i18n/zh_cn.base.ts:76` = '取消'),已核实存在。**不要新造重复的取消键**。

- [ ] **Step 6: 写 DropPage 测试**

**现场已核实**:本仓有 `createRouter` + `createMemoryHistory` 的测试先例(`src/App.unloadGuard.test.ts`、`src/storage/components/StorageShell.test.ts` 等 5 个文件),照它们的手法搭即可。
⚠️ 但 **`onBeforeRouteLeave` 在本仓是零先例**(`grep -rn "onBeforeRouteLeave" src/` 目前无命中),Task 13 是第一处 —— 所以这条测试要真的**驱动一次导航**来触发守卫,不能只断言「函数被注册了」。

```ts
// src/files/drop/components/DropPage.test.ts —— 只测离站守卫接线,不测布局
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { i18n } from '../../../i18n'
import DropPage from './DropPage.vue'
import { useDropStore } from '../stores/drop'

async function mountAtDropRoute() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/files/drop', component: DropPage },
      { path: '/elsewhere', component: { template: '<div>elsewhere</div>' } },
    ],
  })
  router.push('/files/drop')
  await router.isReady()
  const wrapper = mount({ template: '<router-view />' }, { global: { plugins: [router, i18n] } })
  await flushPromises()
  return { router, wrapper }
}

describe('DropPage leave guard', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('lets navigation through untouched when no transfer is running', async () => {
    const { router } = await mountAtDropRoute()
    const drop = useDropStore()
    drop.hasActiveTransfers = () => false

    await router.push('/elsewhere')
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/elsewhere')
  })

  it('holds navigation on the drop page until the user confirms', async () => {
    const { router, wrapper } = await mountAtDropRoute()
    const drop = useDropStore()
    drop.hasActiveTransfers = () => true

    const nav = router.push('/elsewhere')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/files/drop') // still held

    wrapper.findComponent({ name: 'AlertDialog' }).vm.$emit('confirm')
    await nav
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/elsewhere')
  })

  it('stays on the page when the user backs out', async () => {
    const { router, wrapper } = await mountAtDropRoute()
    const drop = useDropStore()
    drop.hasActiveTransfers = () => true

    void router.push('/elsewhere')
    await flushPromises()
    wrapper.findComponent({ name: 'AlertDialog' }).vm.$emit('update:open', false)
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/files/drop')
  })
})
```

⚠️ `DropPage` 的 `onMounted` 会调 `drop.init()`(真的开 WebSocket)与 `files.loadRoots()`(真的发 HTTP)。**上面三条测试若因此报网络错或超时,不要改生产代码去迁就测试** —— 用 `vi.mock` 把 `@nimotech/nimoos-service` 与 `../stores/drop` 的 `init`/`destroy` 打桩(照 `App.unloadGuard.test.ts` 顶部那套 `vi.mock` 手法)。若打桩后仍跑不通,**停下来报告,由控制器裁定**,不要自行把守卫逻辑挪出组件。

- [ ] **Step 7: 跑全套 + 类型检查(前台)**

Run: `pnpm exec vitest run src/files/drop/ src/i18n/parity.test.ts && pnpm exec vue-tsc --noEmit`
Expected: 全绿,exit 0

- [ ] **Step 8: 变异验证**

把 `onBeforeRouteLeave` 里的 `if (!drop.hasActiveTransfers()) return true` 改成恒 `return true`,重跑 → 守卫测试必须真红。恢复后全绿。

- [ ] **Step 9: 提交**

```bash
git add src/files/drop/leaveGuard.ts src/files/drop/leaveGuard.test.ts src/files/drop/components/DropPage.vue src/files/drop/components/DropPage.test.ts src/i18n/zh_cn.base.ts src/i18n/en_us.base.ts
git commit -m "feat(drop): ask before leaving or closing during a transfer

Mounted at page scope on purpose -- unlike the upload guard, whose Files.vue
mount point is a known defect for an app-level queue.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## 收尾门(控制器统一跑,不在任务内)

```bash
pnpm exec vue-tsc --noEmit
pnpm exec vitest run
pnpm exec vitest run src/i18n/parity.test.ts
pnpm build
node oss/export.mjs --out /tmp/claude-1000/oss-preview --no-commit --allow-dirty-oss
```

**跑 oss 门前必须先提交。** 另:`src/home/components/DesktopContextMenu.test.ts` **只在单独跑那一个文件时**失败(SP11 遗留的 reka-ui 隔离 flake),全量套件里是绿的 —— 别去追。

---

## 真机验收清单

见设计文档 §5(T10 六步 + #90 六步)。⚠️ **T10 那六步必须用 ≥5GB 的文件** —— 后端每 3 秒采样一次进度,而本机本地复制 1.4 GB/s,小文件粘贴根本来不及产生任何中间进度,照小文件验会把「做好了」误判成「没做」。#90 那六步需要**两台设备**。
