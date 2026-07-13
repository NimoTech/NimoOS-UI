# 音频转录「章节」下拉多选过滤 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 转录工具栏加「章节 ▾」下拉多选过滤器（master-checkbox 语义），与说话人 chips、只看重点 AND 叠加，并联动波形压暗。

**Architecture:** 章节归属是纯查表（`segChapterIndex` 段落→章节序号、`barChapterIndex` 竖条→章节序号，加进 `speakerWave.ts` 配单测）；MediaViewer 持 `pickedChapters: Set<number>`（初始全选），转录行过滤在既有 `segMatches` 前多一个查表条件，波形 `barDim` 扩为说话人/章节 OR。下拉菜单复用仓库既有 reka-ui DropdownMenu + `ui-ctx-*` 共享样式。

**Tech Stack:** Vue 3 `<script setup>` + TS strict · reka-ui（已有依赖）· vitest。

**Spec:** `docs/superpowers/specs/2026-07-13-new-ui-audio-chapter-filter-design.md`

## Global Constraints

- 一切可见颜色走 `var(--token)`，禁止裸颜色字面量（color-guard 强制）；本计划**零新增 token、零字面量**。
- i18n 新键必须同时加 `zh_cn.ts` 与 `en_us.ts`（parity 测试强制）：`audioChapters`（zh「章节」/ en "Chapters"）、`audioAllChapters`（zh「全部章节」/ en "All chapters"）。
- 过滤不得触碰 `<audio>`/`curTime`；分段原始索引 `data-seg` 不重排（过滤只减行）。
- **Portal 内容拿不到 scoped 属性**：菜单内元素的样式必须放非 scoped `<style>` 块（先例 `src/files/components/AddMountMenu.vue`）；菜单 z-index 须 ≥240（预览浮层是 200，共享 `ui-ctx-content` 只有 120）。
- pnpm only；每任务结束 `pnpm exec vue-tsc --noEmit` + 相关测试须绿后 commit。仓库 `/home/nimo/NimoTech/NimoOS-New-UI`，特性分支开发、ff-merge 回 master。

---

### Task 1: 章节归属纯函数（TDD）

**Files:**
- Modify: `src/files/viewers/speakerWave.ts`（文件末尾追加两个导出函数）
- Test: `src/files/viewers/speakerWave.test.ts`（末尾追加两个 describe 块）

**Interfaces:**
- Consumes: `parseTimestamp`（该文件已 import）。
- Produces（Task 2 依赖，签名精确）:
  - `segChapterIndex(segments: { t: string }[], chapters: { t: string }[]): number[]`
  - `barChapterIndex(chapters: { t: string }[], duration: number, n: number): number[]`

- [ ] **Step 1: 在 `speakerWave.test.ts` 末尾追加失败测试**

在文件顶部 import 行补上两个新函数名（改为 `import { barSpeakers, speakerToken, segMatches, segChapterIndex, barChapterIndex } from './speakerWave'`），文件末尾追加：

```ts
describe('segChapterIndex(段落→章节归属)', () => {
  const chapters = [{ t: '0:10' }, { t: '1:00' }]
  it('按段落起始时间归章;跨章边界正确', () => {
    expect(
      segChapterIndex(
        [{ t: '0:00' }, { t: '0:10' }, { t: '0:59' }, { t: '1:00' }, { t: '2:00' }],
        chapters,
      ),
    ).toEqual([-1, 0, 0, 1, 1])
  })
  it('chapters 空 → 全 -1', () => {
    expect(segChapterIndex([{ t: '0:00' }, { t: '0:30' }], [])).toEqual([-1, -1])
  })
  it('segments 空 → 空数组', () => {
    expect(segChapterIndex([], chapters)).toEqual([])
  })
})

describe('barChapterIndex(竖条中点→章节归属)', () => {
  it('按竖条中点时间归章', () => {
    // duration=100、n=4 → 中点 12.5 / 37.5 / 62.5 / 87.5;章节起点 0 与 50
    expect(barChapterIndex([{ t: '0:00' }, { t: '0:50' }], 100, 4)).toEqual([0, 0, 1, 1])
  })
  it('第一章之前的竖条 → -1', () => {
    expect(barChapterIndex([{ t: '0:50' }], 100, 4)).toEqual([-1, -1, 0, 0])
  })
  it('duration=0(元数据未就绪)→ 全 -1', () => {
    expect(barChapterIndex([{ t: '0:00' }], 0, 4)).toEqual([-1, -1, -1, -1])
  })
  it('chapters 空 → 全 -1;n<=0 → 空数组', () => {
    expect(barChapterIndex([], 100, 2)).toEqual([-1, -1])
    expect(barChapterIndex([{ t: '0:00' }], 100, 0)).toEqual([])
    expect(barChapterIndex([{ t: '0:00' }], 100, -1)).toEqual([])
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm exec vitest run src/files/viewers/speakerWave.test.ts`
Expected: FAIL —— `segChapterIndex` / `barChapterIndex` 未导出（SyntaxError 或 undefined is not a function）

- [ ] **Step 3: 在 `speakerWave.ts` 末尾追加实现**

```ts
/**
 * 每个段落(按原始索引) → 所属章节序号。段落起始时间落在 [章节k.t, 章节k+1.t) 即属 k;
 * 早于第一章 → -1;chapters 空 → 全 -1。chapters/segments 均要求按时间升序(既有前提)。
 */
export function segChapterIndex(segments: { t: string }[], chapters: { t: string }[]): number[] {
  const starts = chapters.map((c) => parseTimestamp(c.t))
  return segments.map((s) => {
    const ts = parseTimestamp(s.t)
    let idx = -1
    for (let k = 0; k < starts.length; k++) {
      if (starts[k] <= ts) idx = k
      else break
    }
    return idx
  })
}

/**
 * 每根竖条(按中点时间) → 所属章节序号;duration<=0 / chapters 空 → 全 -1(长度 max(0,n))。
 * 章节区间远长于竖条(~25s/根),中点采样即可,不需要说话人那套少数优先逻辑。
 */
export function barChapterIndex(chapters: { t: string }[], duration: number, n: number): number[] {
  const out = new Array<number>(Math.max(0, n)).fill(-1)
  if (!(duration > 0) || n <= 0 || !chapters.length) return out
  const starts = chapters.map((c) => parseTimestamp(c.t))
  for (let i = 0; i < n; i++) {
    const mid = ((i + 0.5) / n) * duration
    let idx = -1
    for (let k = 0; k < starts.length; k++) {
      if (starts[k] <= mid) idx = k
      else break
    }
    out[i] = idx
  }
  return out
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm exec vitest run src/files/viewers/speakerWave.test.ts`
Expected: PASS（15 既有 + 7 新增 = 22 tests）

Run: `pnpm exec vue-tsc --noEmit`
Expected: 无错误

- [ ] **Step 5: Commit**

```bash
git add src/files/viewers/speakerWave.ts src/files/viewers/speakerWave.test.ts
git commit -m "feat(files): segChapterIndex / barChapterIndex chapter attribution pure functions"
```

---

### Task 2: MediaViewer 章节过滤接入（状态 + 列表 + 波形 + 下拉 UI + i18n）

**Files:**
- Modify: `src/files/viewers/MediaViewer.vue`
- Modify: `src/i18n/zh_cn.ts`（`audioSpeakerAll` 行后）、`src/i18n/en_us.ts`（同位置）

**Interfaces:**
- Consumes: `segChapterIndex` / `barChapterIndex`（Task 1）；既有 `segMatches`、`pickedSpeakers`/`allPicked`/`hasSpeakers`、`barSpk`/`waveSpeakerMode`、`scrollActiveIntoView`、`WAVE_N`/`durTime`。
- Produces: 无后续任务。

- [ ] **Step 1: i18n 两份 locale 加键**

`src/i18n/zh_cn.ts` 在 `audioSpeakerAll: '全部',` 之后加：

```ts
    audioChapters: '章节',
    audioAllChapters: '全部章节',
```

`src/i18n/en_us.ts` 在 `audioSpeakerAll: 'All',` 之后加：

```ts
    audioChapters: 'Chapters',
    audioAllChapters: 'All chapters',
```

- [ ] **Step 2: script — import 与章节过滤状态**

(a) 把 import 行

```ts
import { speakerToken, segMatches, barSpeakers } from './speakerWave'
```

改为

```ts
import { speakerToken, segMatches, barSpeakers, segChapterIndex, barChapterIndex } from './speakerWave'
```

并在其后新增一行 reka-ui import（放已有 import 区末尾）：

```ts
import {
  DropdownMenuRoot, DropdownMenuTrigger, DropdownMenuPortal,
  DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from 'reka-ui'
```

(b) 在 `function toggleAll(): void { … }` 整个函数之后追加：

```ts
// 章节过滤(master-checkbox,与说话人同一套语义):选中集=显示哪些章节,初始全选;
// 全选=等效不过滤;空集=全不选=全隐藏。整体替换 Set 保证 watch 可靠触发。
const chapters = computed(() => transcript.value?.chapters ?? [])
const hasChapters = computed(() => chapters.value.length > 0)
const pickedChapters = ref<Set<number>>(new Set(chapters.value.map((_, k) => k)))
const allChaptersPicked = computed(() => hasChapters.value && pickedChapters.value.size === chapters.value.length)
function toggleChapter(k: number): void {
  const next = new Set(pickedChapters.value)
  if (next.has(k)) next.delete(k)
  else next.add(k)
  pickedChapters.value = next
}
function toggleAllChapters(): void {
  pickedChapters.value = allChaptersPicked.value ? new Set() : new Set(chapters.value.map((_, k) => k))
}
// 段落原始索引 → 章节序号查表(过滤条件按索引 O(1) 查)
const segChap = computed(() => segChapterIndex(transcript.value?.segments ?? [], chapters.value))
```

(c) 把 scroll watch 行

```ts
watch([pickedSpeakers, highlightsOnly], () => void nextTick(scrollActiveIntoView))
```

改为

```ts
watch([pickedSpeakers, pickedChapters, highlightsOnly], () => void nextTick(scrollActiveIntoView))
```

- [ ] **Step 3: script — transcriptRows 过滤与章节头规则**

把这一整段：

```ts
// 说话人过滤"激活"= 非全选(全选等效于没过滤);无说话人数据时恒不激活。
const filtering = computed(() => highlightsOnly.value || (hasSpeakers.value && !allPicked.value))
const transcriptRows = computed<TransRow[]>(() => {
  const tr = transcript.value
  if (!tr) return []
  const chapterAt = new Map<string, string>()
  for (const c of tr.chapters ?? []) chapterAt.set(c.t, c.title)
  const rows: TransRow[] = []
  tr.segments.forEach((seg, i) => {
    if (!segMatches(seg, hasSpeakers.value ? pickedSpeakers.value : null, highlightsOnly.value)) return
    // 过滤激活（只看重点 / 说话人筛选）时不插章节头（避免出现空章节）。
    if (!filtering.value && chapterAt.has(seg.t)) {
      rows.push({ type: 'chapter', title: chapterAt.get(seg.t) as string, t: seg.t })
    }
    rows.push({ type: 'seg', seg, i })
  })
  return rows
})
```

替换为：

```ts
// 各过滤维度"激活"= 非全选(全选等效于没过滤);无对应数据时恒不激活。
const speakerFiltering = computed(() => hasSpeakers.value && !allPicked.value)
const chapterFiltering = computed(() => hasChapters.value && !allChaptersPicked.value)
const transcriptRows = computed<TransRow[]>(() => {
  const tr = transcript.value
  if (!tr) return []
  const chapterAt = new Map<string, string>()
  for (const c of tr.chapters ?? []) chapterAt.set(c.t, c.title)
  const rows: TransRow[] = []
  // 章节头:只看重点/说话人过滤会造成"空章节",激活时全部隐藏(现状规则);
  // 只按章节过滤时保留——被滤掉的章连段带头整体消失,可见章的头帮助识别段落归属。
  const showHeads = !highlightsOnly.value && !speakerFiltering.value
  tr.segments.forEach((seg, i) => {
    if (chapterFiltering.value && !pickedChapters.value.has(segChap.value[i])) return
    if (!segMatches(seg, hasSpeakers.value ? pickedSpeakers.value : null, highlightsOnly.value)) return
    if (showHeads && chapterAt.has(seg.t)) {
      rows.push({ type: 'chapter', title: chapterAt.get(seg.t) as string, t: seg.t })
    }
    rows.push({ type: 'seg', seg, i })
  })
  return rows
})
```

（`filtering` computed 被 `speakerFiltering`/`chapterFiltering` 取代且无其他消费者——确认后删除即可。）

- [ ] **Step 4: script — 波形 dim 扩为说话人/章节 OR**

在 `const waveSpeakerMode = …` 行之后追加：

```ts
// 竖条→章节归属(仅说话人模式下波形参与压暗;spec §5 限制)
const barChap = computed<number[]>(() =>
  waveSpeakerMode.value ? barChapterIndex(chapters.value, durTime.value, WAVE_N) : [],
)
```

把 `barDim` 整个函数：

```ts
// 过滤压暗:非全选时,该条说话人不在选中集(或静场条)即压暗;
// 全选=等效无过滤全不压暗,全不选=全压暗(与转录列表口径一致)。
function barDim(i: number): boolean {
  if (!waveSpeakerMode.value || allPicked.value) return false
  const id = barSpk.value[i]
  return !id || !pickedSpeakers.value.has(id)
}
```

替换为：

```ts
// 过滤压暗(说话人/章节任一维度命中即压暗,各维度全选=该维度不参与):
// 说话人维度:非全选且该条说话人不在选中集(静场条同暗);
// 章节维度:非全选且该条所在章节不在选中集。与转录列表口径一致。
function barDim(i: number): boolean {
  if (!waveSpeakerMode.value) return false
  if (!allPicked.value) {
    const id = barSpk.value[i]
    if (!id || !pickedSpeakers.value.has(id)) return true
  }
  if (chapterFiltering.value && !pickedChapters.value.has(barChap.value[i])) return true
  return false
}
```

（注意：`barDim` 是函数声明、`chapterFiltering`/`barChap` 是其后才声明的 const——与现状 `allPicked` 同理，仅在渲染期调用，无 TDZ 问题。）

- [ ] **Step 5: template — 工具栏插入「章节 ▾」下拉**

把 ap-tools 开头两处：

```html
<div v-if="hasHighlights || hasSpeakers" class="ap-tools">
  <button v-if="hasHighlights" type="button" class="ap-tool" :class="{ on: highlightsOnly }" @click="highlightsOnly = !highlightsOnly">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5l2.6 5.7 6.2.6-4.7 4.1 1.4 6.1L12 16.9 6.5 20.1l1.4-6.1L3.2 9.8l6.2-.6z" /></svg>
    {{ highlightsOnly ? t('audioShowAll') : t('audioHighlightsOnly') }}
  </button>
```

替换为（外层条件加 `hasChapters`，重点按钮后插入下拉）：

```html
<div v-if="hasHighlights || hasSpeakers || hasChapters" class="ap-tools">
  <button v-if="hasHighlights" type="button" class="ap-tool" :class="{ on: highlightsOnly }" @click="highlightsOnly = !highlightsOnly">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5l2.6 5.7 6.2.6-4.7 4.1 1.4 6.1L12 16.9 6.5 20.1l1.4-6.1L3.2 9.8l6.2-.6z" /></svg>
    {{ highlightsOnly ? t('audioShowAll') : t('audioHighlightsOnly') }}
  </button>
  <!-- 章节过滤:下拉多选(master-checkbox,与说话人同语义);点选项不关菜单(@select.prevent) -->
  <DropdownMenuRoot v-if="hasChapters">
    <DropdownMenuTrigger class="ap-tool ap-ch-trigger" :class="{ on: chapterFiltering }">
      {{ t('audioChapters') }}<template v-if="chapterFiltering">&nbsp;{{ pickedChapters.size }}/{{ chapters.length }}</template>
      <svg class="ap-ch-caret" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10l5 5 5-5z" /></svg>
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <!-- Portal 到 body:scoped 样式够不到,ap-ch-* 全在非 scoped 块;z-index 须盖过预览浮层(200) -->
      <DropdownMenuContent class="ui-ctx-content ap-ch-menu" :side-offset="4" align="start">
        <DropdownMenuItem class="ui-ctx-item ap-ch-item" @select.prevent="toggleAllChapters">
          <span class="ap-ch-check">{{ allChaptersPicked ? '✓' : '' }}</span>{{ t('audioAllChapters') }}
        </DropdownMenuItem>
        <DropdownMenuSeparator class="ui-ctx-sep" />
        <DropdownMenuItem
          v-for="(c, k) in chapters"
          :key="c.t"
          class="ui-ctx-item ap-ch-item"
          @select.prevent="toggleChapter(k)"
        >
          <span class="ap-ch-check">{{ pickedChapters.has(k) ? '✓' : '' }}</span>
          <span class="ap-ch-t">{{ c.t }}</span>
          <span class="ap-ch-title">{{ c.title }}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
```

（说话人 chips 的 `<template v-if="hasSpeakers">` 块与 `</div>` 保持原样，下拉插在其前。）

- [ ] **Step 6: style — 触发器（scoped）与菜单（非 scoped）样式**

(a) scoped `<style>` 里 `.spk-chip-all.on { … }` 之后追加：

```css
/* 章节下拉触发器:沿用 .ap-tool 形态,补齿轮箭头与计数间距 */
.ap-ch-trigger { display: inline-flex; align-items: center; gap: 4px; }
.ap-ch-caret { width: 14px; height: 14px; fill: currentColor; }
```

(b) 文件末尾（`</style>` 之后）新增一个**非 scoped** 样式块：

```html
<style>
/* 章节下拉菜单:Portal 传送到 body,拿不到 scoped 属性,须非 scoped(先例 AddMountMenu.vue)。
   z-index 240 盖过预览浮层(ViewerShell z-index:200;共享 ui-ctx-content 默认 120)。 */
.ap-ch-menu { z-index: 240; max-height: 320px; overflow-y: auto; }
.ap-ch-item { display: flex; align-items: center; gap: 8px; max-width: 22rem; }
.ap-ch-check { flex: 0 0 auto; width: 14px; font-size: 12px; font-weight: 700; color: var(--accent-text); }
.ap-ch-t { flex: 0 0 auto; font-size: 12px; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--fg-subtle); }
.ap-ch-title { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
```

- [ ] **Step 7: 验证**

Run: `pnpm exec vue-tsc --noEmit`
Expected: 无错误

Run: `pnpm test`
Expected: 全绿（含 i18n parity、color-guard；vitest 已配置排除 `.claude/**`）

- [ ] **Step 8: Commit**

```bash
git add src/files/viewers/MediaViewer.vue src/i18n/zh_cn.ts src/i18n/en_us.ts
git commit -m "feat(files): chapter dropdown multi-select filter (AND with speaker/highlights, waveform dim)"
```

---

### Task 3: 全量验证 + spec 状态 + 部署

**Files:**
- Modify: `docs/superpowers/specs/2026-07-13-new-ui-audio-chapter-filter-design.md:4`

- [ ] **Step 1: 全量测试与构建**

Run: `pnpm test` → 全绿；`pnpm build` → vue-tsc + vite build 成功。

- [ ] **Step 2: spec 状态行**

第 4 行 `- 状态：设计已定，待实现` 改为 `- 状态：已实现（2026-07-13，见 plans/2026-07-13-new-ui-audio-chapter-filter.md）`。

- [ ] **Step 3: Commit 文档**

```bash
git add docs/superpowers/specs/2026-07-13-new-ui-audio-chapter-filter-design.md docs/superpowers/plans/2026-07-13-new-ui-audio-chapter-filter.md
git commit -m "docs: mark chapter filter spec implemented; add implementation plan"
```

- [ ] **Step 4: 部署（在 merge 回 master 之后由控制器执行）**

Run: `./scripts/deploy.sh`（用户指定的唯一部署入口）
Expected: `Deployed to /var/lib/nimoos/www/app/`

- [ ] **Step 5: 真机验收清单（交给用户）**

见 spec §7 六条。
