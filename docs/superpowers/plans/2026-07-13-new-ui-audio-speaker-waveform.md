# 音频说话人过滤 + 波形分段着色 + 高光去色 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 音频预览的波形按说话人分段着色、转录面板支持说话人 chips 多选过滤、重点句去掉金色底（星标保留），过滤操作不干扰播放进度与高亮。

**Architecture:** 纯函数逻辑（竖条→说话人归属、过滤谓词、颜色 token 映射）全部收进新模块 `speakerWave.ts` 并用 vitest 锁定；`MediaViewer.vue` 只做接线与渲染；颜色全部走 `theme.css` 新增的 `--spk-1..5` / `--wave-none` / `--wave-dim` token（dark/light 两套主题都给值）。无说话人数据的音频完全走旧渲染分支，行为零变化。

**Tech Stack:** Vue 3 `<script setup>` + TypeScript（strict）· vitest · vue-i18n。无新依赖。

**Spec:** `docs/superpowers/specs/2026-07-13-new-ui-audio-speaker-waveform-design.md`
**视觉权威来源:** `design-export/design-final.html`（CSS 值以它为准）

## Global Constraints

- 一切可见颜色走 `var(--token)`，token 在 `src/styles/theme.css` 的 `:root` 与 `:root[data-theme="light"]` 两块都要有值；组件里禁止裸颜色字面量（`color-guard.test.ts` 强制）。`oklch()` 字面量只允许出现在 `theme.css`。`color-mix(in oklab, var(--c) N%, transparent)` 属 token 派生，允许。
- 包管理器只用 **pnpm**（勿用 yarn/npm）。本仓库是独立 git 仓库，在 `/home/nimo/NimoTech/NimoOS-New-UI` 内操作。
- i18n 新键必须同时加 `src/i18n/zh_cn.ts` 与 `src/i18n/en_us.ts`（`parity.test.ts` 强制）。
- 波形保持 3px 圆头 × 96 根（`WAVE_N`）、虚线基线、seek/拖拽/点击交互不变；播放器布局结构不改。
- 设计稿中的滚动条样式、顶部说明卡**不落地**（用户明确）。
- 每个任务结束：`pnpm exec vue-tsc --noEmit` 与相关测试须绿，然后 commit。

---

### Task 1: theme.css 新增说话人颜色 token

**Files:**
- Modify: `src/styles/theme.css`（`:root` 块约 L66 `--hl-*` 行之后；`:root[data-theme="light"]` 块约 L237 `--hl-*` 行之后）

**Interfaces:**
- Produces: CSS 自定义属性 `--spk-1`…`--spk-5`、`--wave-none`、`--wave-dim`，后续任务在组件里以 `var(--spk-N)` 引用。

- [ ] **Step 1: 在 `:root` 块（dark，亮版取值）追加 token**

在 `theme.css` `:root` 块内、`--hl-bg: … --hl-star: #e8c06a;` 那一行之后插入：

```css
  /* 说话人配色(音频转录/波形,最多 5 色循环;dark 用亮版;避开金色以免与星标混淆) */
  --spk-1: oklch(0.74 0.13 250);   /* 蓝 */
  --spk-2: oklch(0.72 0.13 305);   /* 紫 */
  --spk-3: oklch(0.77 0.12 190);   /* 青 */
  --spk-4: oklch(0.73 0.15 18);    /* 珊瑚 */
  --spk-5: oklch(0.79 0.14 150);   /* 绿 */
  --wave-none: var(--fg-subtle);   /* 波形:静场/无人声竖条 */
  --wave-dim: var(--fg-faint);     /* 波形:过滤时被弱化的竖条 */
```

- [ ] **Step 2: 在 `:root[data-theme="light"]` 块（暗版取值）追加 token**

在 light 块内、`--hl-bg: … --hl-star: #c9992f;` 那一行之后插入：

```css
  /* 说话人配色(白色纸感用暗版,同 hue 系) */
  --spk-1: oklch(0.52 0.15 255);
  --spk-2: oklch(0.50 0.16 305);
  --spk-3: oklch(0.53 0.12 200);
  --spk-4: oklch(0.55 0.18 22);
  --spk-5: oklch(0.52 0.15 150);
  --wave-none: var(--fg-subtle);
  --wave-dim: var(--fg-faint);
```

- [ ] **Step 3: 验证**

Run: `grep -c 'spk-1' src/styles/theme.css`
Expected: `2`（两套主题各一处）

Run: `pnpm test`
Expected: 全绿（color-guard 不扫 theme.css，parity 不受影响）

- [ ] **Step 4: Commit**

```bash
git add src/styles/theme.css
git commit -m "feat(theme): speaker palette tokens --spk-1..5 / --wave-none / --wave-dim (dark+light)"
```

---

### Task 2: speakerWave.ts 纯函数模块（TDD）

**Files:**
- Create: `src/files/viewers/speakerWave.ts`
- Test: `src/files/viewers/speakerWave.test.ts`

**Interfaces:**
- Consumes: `parseTimestamp(ts: string): number`（既有，`./audioTranscripts`）。
- Produces（后续 Task 3–5 依赖，签名精确如下）:
  - `speakerToken(idx: number): string` — 返回 `` `var(--spk-${(idx % 5) + 1})` ``。
  - `barSpeakers(segments: { t: string; speaker?: string }[], duration: number, n: number): (string | null)[]` — 每根竖条的说话人 id 或 null。
  - `segMatches(seg: { speaker?: string; highlight?: boolean }, picked: ReadonlySet<string>, highlightsOnly: boolean): boolean` — 单段过滤谓词。

- [ ] **Step 1: 写失败测试 `src/files/viewers/speakerWave.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { barSpeakers, speakerToken, segMatches } from './speakerWave'

// 双说话人构造数据:s1 主导,s2 只在 0:30–0:33 有 3 秒插话。
// duration=100s、n=4 → 每根竖条覆盖 25s。
const SEGS = [
  { t: '0:00', speaker: 's1' },
  { t: '0:30', speaker: 's2' },
  { t: '0:33', speaker: 's1' },
  { t: '1:10', speaker: 's1' },
]

describe('barSpeakers(竖条→说话人归属,少数说话人优先)', () => {
  it('短插话所在竖条归少数说话人(不被时长平均掉)', () => {
    const bars = barSpeakers(SEGS, 100, 4)
    expect(bars[0]).toBe('s1') // 0–25s 只有 s1
    expect(bars[1]).toBe('s2') // 25–50s 内 s1、s2 都出现;s2 全局段数少 → 归 s2
    expect(bars[2]).toBe('s1')
    expect(bars[3]).toBe('s1')
  })
  it('窗口内无任何分段 → null', () => {
    const bars = barSpeakers([{ t: '0:50', speaker: 's1' }], 100, 4)
    expect(bars[0]).toBe(null) // 0–25s 无段
    expect(bars[1]).toBe(null) // 25–50s 无段(唯一段从 50s 起)
    expect(bars[2]).toBe('s1')
    expect(bars[3]).toBe('s1')
  })
  it('duration=0(元数据未就绪)→ 全 null', () => {
    expect(barSpeakers(SEGS, 0, 4)).toEqual([null, null, null, null])
  })
  it('单说话人全程 → 全该人', () => {
    expect(barSpeakers([{ t: '0:00', speaker: 's1' }], 100, 4)).toEqual(['s1', 's1', 's1', 's1'])
  })
})

describe('speakerToken(序号→CSS token,5 色循环)', () => {
  it('0 → var(--spk-1)', () => expect(speakerToken(0)).toBe('var(--spk-1)'))
  it('4 → var(--spk-5)', () => expect(speakerToken(4)).toBe('var(--spk-5)'))
  it('5 → var(--spk-1)(%5 循环)', () => expect(speakerToken(5)).toBe('var(--spk-1)'))
})

describe('segMatches(过滤谓词:picked 与 highlightsOnly AND 叠加)', () => {
  const segs = [
    { t: '0:00', speaker: 's1', highlight: false },
    { t: '0:10', speaker: 's2', highlight: true },
    { t: '0:20', speaker: 's1', highlight: true },
  ]
  it('picked 空 + 不只看重点 = 全显', () => {
    for (const s of segs) expect(segMatches(s, new Set(), false)).toBe(true)
  })
  it('picked={s2} 只剩 s2 段', () => {
    const picked = new Set(['s2'])
    expect(segs.map((s) => segMatches(s, picked, false))).toEqual([false, true, false])
  })
  it('与 highlightsOnly AND 叠加', () => {
    const picked = new Set(['s1'])
    expect(segs.map((s) => segMatches(s, picked, true))).toEqual([false, false, true])
  })
  it('过滤保留原始索引:同一索引仍是同一段(锁需求5,不重排)', () => {
    const rows = segs.map((seg, i) => ({ seg, i })).filter(({ seg }) => segMatches(seg, new Set(['s1']), true))
    expect(rows).toEqual([{ seg: segs[2], i: 2 }])
  })
  it('无 speaker 字段的段:picked 非空时被过滤', () => {
    expect(segMatches({ t: '0:00' } as { speaker?: string }, new Set(['s1']), false)).toBe(false)
    expect(segMatches({ t: '0:00' } as { speaker?: string }, new Set(), false)).toBe(true)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm exec vitest run src/files/viewers/speakerWave.test.ts`
Expected: FAIL — `Cannot find module './speakerWave'`（或等价的解析错误）

- [ ] **Step 3: 实现 `src/files/viewers/speakerWave.ts`**

```ts
// 音频波形 × 说话人:纯函数(竖条归属 / 颜色 token 映射 / 过滤谓词)。
// 设计:docs/superpowers/specs/2026-07-13-new-ui-audio-speaker-waveform-design.md §3/§4/§7
import { parseTimestamp } from './audioTranscripts'

/** 说话人序号 → 颜色 token(5 色循环,token 定义在 theme.css,两套主题都有值)。 */
export function speakerToken(idx: number): string {
  return `var(--spk-${(idx % 5) + 1})`
}

/**
 * 每根竖条的时间窗 [a,b) 内出现过的说话人里,取「全局分段数最少」的那位。
 * 理由:竖条约 25s 一根,学生几秒的插话按中点采样/时长占比都会被平均掉;
 * 少数说话人优先保证短插话在波形上留下有色竖条。窗口内无人 → null。
 * duration<=0(元数据未就绪)→ 全 null,调用方在 loadedmetadata 后靠响应式重算。
 */
export function barSpeakers(
  segments: { t: string; speaker?: string }[],
  duration: number,
  n: number,
): (string | null)[] {
  const out = new Array<string | null>(n).fill(null)
  if (!(duration > 0) || n <= 0) return out
  // 段区间 [start,end):end = 下一段起始,最后一段到 duration。无 speaker 的段不参与归属。
  const spans: { start: number; end: number; speaker: string }[] = []
  const freq = new Map<string, number>()
  for (let i = 0; i < segments.length; i++) {
    const speaker = segments[i].speaker
    const start = parseTimestamp(segments[i].t)
    const end = i + 1 < segments.length ? parseTimestamp(segments[i + 1].t) : duration
    if (!speaker) continue
    spans.push({ start, end, speaker })
    freq.set(speaker, (freq.get(speaker) ?? 0) + 1)
  }
  for (let i = 0; i < n; i++) {
    const a = (i / n) * duration
    const b = ((i + 1) / n) * duration
    let best: string | null = null
    for (const s of spans) {
      if (Math.min(b, s.end) - Math.max(a, s.start) > 0) {
        if (best === null || (freq.get(s.speaker) as number) < (freq.get(best) as number)) best = s.speaker
      }
    }
    out[i] = best
  }
  return out
}

/**
 * 单段过滤谓词:picked(说话人多选集,空=全部)与 highlightsOnly AND 叠加。
 * MediaViewer 的转录行过滤与波形 .dim 判断共用同一 picked 集合,保证两处口径一致。
 */
export function segMatches(
  seg: { speaker?: string; highlight?: boolean },
  picked: ReadonlySet<string>,
  highlightsOnly: boolean,
): boolean {
  if (highlightsOnly && !seg.highlight) return false
  if (picked.size > 0 && (!seg.speaker || !picked.has(seg.speaker))) return false
  return true
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm exec vitest run src/files/viewers/speakerWave.test.ts`
Expected: PASS（12 tests）

Run: `pnpm exec vue-tsc --noEmit`
Expected: 无错误

- [ ] **Step 5: Commit**

```bash
git add src/files/viewers/speakerWave.ts src/files/viewers/speakerWave.test.ts
git commit -m "feat(files): speakerWave pure module — barSpeakers / speakerToken / segMatches"
```

---

### Task 3: MediaViewer 说话人颜色 token 化 + 重点句去色

**Files:**
- Modify: `src/files/viewers/MediaViewer.vue`（script 约 L204-216;template 约 L466-476;style 约 L625-654）

**Interfaces:**
- Consumes: `speakerToken(idx)`（Task 2）。
- Produces: `speakerColor(id?: string): string` 改为返回 `var(--spk-N)`（Task 4 chips、Task 5 波形复用）;`.ap-speaker` 经 CSS 变量 `--c` 取色。

- [ ] **Step 1: script — 删除写死 hex,speakerColor 走 token**

把 MediaViewer.vue 中这段（约 L204-216）：

```ts
// 说话人分离：id → 显示名 / 固定配色（沿用主页蓝紫，多说话人各给一色）。
// 说话人配色：适配浅色底的深色版（Azure 蓝 / 紫 / 绿 / 琥珀 / 玫红）
const SPEAKER_COLORS = ['#3550c4', '#6e5ae0', '#15754c', '#b5730a', '#c0416a']
function speakerName(id?: string): string {
  if (!id) return ''
  const found = transcript.value?.speakers?.find((s) => s.id === id)
  return found?.name ?? id
}
function speakerColor(id?: string): string {
  const list = transcript.value?.speakers ?? []
  const idx = Math.max(0, list.findIndex((s) => s.id === id))
  return SPEAKER_COLORS[idx % SPEAKER_COLORS.length]
}
```

替换为：

```ts
// 说话人分离：id → 显示名 / 颜色 token(--spk-N,5 色循环;波形与转录共用同一映射)。
function speakerName(id?: string): string {
  if (!id) return ''
  const found = transcript.value?.speakers?.find((s) => s.id === id)
  return found?.name ?? id
}
function speakerColor(id?: string): string {
  const list = transcript.value?.speakers ?? []
  const idx = Math.max(0, list.findIndex((s) => s.id === id))
  return speakerToken(idx)
}
```

并在文件顶部 import 区（`import type { TranscriptSegment } from './audioTranscripts'` 之后）加：

```ts
import { speakerToken } from './speakerWave'
```

- [ ] **Step 2: template — `.ap-speaker` 改为 `--c` 注入**

把（约 L469-471）：

```html
<span v-if="row.seg.speaker" class="ap-speaker" :style="{ color: speakerColor(row.seg.speaker) }">
  <span class="ap-speaker-dot" :style="{ background: speakerColor(row.seg.speaker) }"></span>{{ speakerName(row.seg.speaker) }}
</span>
```

替换为：

```html
<span v-if="row.seg.speaker" class="ap-speaker" :style="{ '--c': speakerColor(row.seg.speaker) }">
  <span class="ap-speaker-dot"></span>{{ speakerName(row.seg.speaker) }}
</span>
```

- [ ] **Step 3: style — speaker 取色走 `--c`;删除重点句金色底;「只看重点」按钮选中态改中性 accent**

(a) 把 `.ap-speaker` / `.ap-speaker-dot`（约 L626-627）改为：

```css
/* 说话人分离：小圆点 + 名字（颜色由 --c 注入,值为 var(--spk-N) token） */
.ap-speaker { display: inline-flex; align-items: center; gap: 6px; font-size: 15px; font-weight: 700; letter-spacing: 0.02em; color: var(--c); }
.ap-speaker-dot { width: 7px; height: 7px; border-radius: 50%; flex: 0 0 auto; background: var(--c); }
```

(b) **删除**这两行（约 L632-634,重点句只保留星标,星标金色不变）：

```css
/* 重点句高光（金句）——柔和琥珀底 + 金色星标 */
.ap-seg.hl { background: var(--hl-bg); }
.ap-seg.hl:hover { background: var(--hl-bd); }
```

（`.ap-hl-star { fill: var(--hl-star) }` 保留。template 里 `:class` 的 `hl` 绑定保留——无样式即无视觉效果,留着不影响行为,也免改模板。）

(c) 把 `.ap-tool.on`（约 L654）从金色系改为中性 accent（设计稿定稿）：

```css
.ap-tool.on { background: var(--accent-soft); border-color: var(--accent-soft-bd); color: var(--accent-text); }
```

- [ ] **Step 4: 验证**

Run: `pnpm exec vue-tsc --noEmit`
Expected: 无错误

Run: `pnpm test`
Expected: 全绿（color-guard:MediaViewer 不再有 speaker hex;其余不受影响）

Run: `grep -c 'SPEAKER_COLORS\|#3550c4' src/files/viewers/MediaViewer.vue`
Expected: `0`

- [ ] **Step 5: Commit**

```bash
git add src/files/viewers/MediaViewer.vue
git commit -m "refactor(files): speaker colors via --spk-N tokens; drop highlight gold background"
```

---

### Task 4: 说话人过滤 chips + 转录列表过滤

**Files:**
- Modify: `src/files/viewers/MediaViewer.vue`（script 过滤状态 + transcriptRows;template ap-tools;style 追加 chips）
- Modify: `src/i18n/zh_cn.ts`（L42 `audioShowAll` 之后）、`src/i18n/en_us.ts`（同位置）

**Interfaces:**
- Consumes: `segMatches(seg, picked, highlightsOnly)`、`speakerToken(idx)`（Task 2）;`scrollActiveIntoView()`（既有 L166）。
- Produces: `pickedSpeakers: Ref<Set<string>>`（Task 5 波形 `.dim` 判断复用）;i18n 键 `audioSpeakerAll`。

- [ ] **Step 1: i18n 两份 locale 加 `audioSpeakerAll`**

`src/i18n/zh_cn.ts` 在 `audioShowAll: '显示全部',` 之后加：

```ts
    audioSpeakerAll: '全部',
```

`src/i18n/en_us.ts` 在 `audioShowAll: 'Show all',` 之后加：

```ts
    audioSpeakerAll: 'All',
```

- [ ] **Step 2: script — 过滤状态与行过滤**

(a) import 行改为同时引入 segMatches：

```ts
import { speakerToken, segMatches } from './speakerWave'
```

(b) 在 `const highlightsOnly = ref(false)`（约 L179）之后加：

```ts
// 说话人过滤:多选集合,空集=「全部」。整体替换 Set 实例保证 watch 可靠触发。
const pickedSpeakers = ref<Set<string>>(new Set())
const speakers = computed(() => transcript.value?.speakers ?? [])
const hasSpeakers = computed(() => speakers.value.length > 0)
function toggleSpeaker(id: string): void {
  const next = new Set(pickedSpeakers.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  pickedSpeakers.value = next
}
function clearSpeakerFilter(): void {
  if (pickedSpeakers.value.size) pickedSpeakers.value = new Set()
}
```

(c) `transcriptRows`（约 L185-200）改为经 `segMatches` 过滤;任一过滤激活时不插章节头（避免空章节）：

```ts
const filtering = computed(() => highlightsOnly.value || pickedSpeakers.value.size > 0)
const transcriptRows = computed<TransRow[]>(() => {
  const tr = transcript.value
  if (!tr) return []
  const chapterAt = new Map<string, string>()
  for (const c of tr.chapters ?? []) chapterAt.set(c.t, c.title)
  const rows: TransRow[] = []
  tr.segments.forEach((seg, i) => {
    if (!segMatches(seg, pickedSpeakers.value, highlightsOnly.value)) return
    // 过滤激活（只看重点 / 说话人筛选）时不插章节头（避免出现空章节）。
    if (!filtering.value && chapterAt.has(seg.t)) {
      rows.push({ type: 'chapter', title: chapterAt.get(seg.t) as string, t: seg.t })
    }
    rows.push({ type: 'seg', seg, i })
  })
  return rows
})
```

(d) 在既有 `watch(activeSeg, …)`（约 L171）旁加（需求 5:过滤变化后若当前段仍在列表,平滑滚回可见）：

```ts
watch([pickedSpeakers, highlightsOnly], () => void nextTick(scrollActiveIntoView))
```

(e) 删除 `const hasChapters = computed(() => (transcript.value?.chapters?.length ?? 0) > 0)`（约 L201）——Step 3 改掉工具栏条件后它是最后一个使用点,删掉避免死代码。

- [ ] **Step 3: template — 工具栏加「全部」+ 说话人 chips**

把 ap-tools 块（约 L452-457）：

```html
<div v-if="hasHighlights || hasChapters" class="ap-tools">
  <button v-if="hasHighlights" type="button" class="ap-tool" :class="{ on: highlightsOnly }" @click="highlightsOnly = !highlightsOnly">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5l2.6 5.7 6.2.6-4.7 4.1 1.4 6.1L12 16.9 6.5 20.1l1.4-6.1L3.2 9.8l6.2-.6z" /></svg>
    {{ highlightsOnly ? t('audioShowAll') : t('audioHighlightsOnly') }}
  </button>
</div>
```

替换为：

```html
<div v-if="hasHighlights || hasSpeakers" class="ap-tools">
  <button v-if="hasHighlights" type="button" class="ap-tool" :class="{ on: highlightsOnly }" @click="highlightsOnly = !highlightsOnly">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5l2.6 5.7 6.2.6-4.7 4.1 1.4 6.1L12 16.9 6.5 20.1l1.4-6.1L3.2 9.8l6.2-.6z" /></svg>
    {{ highlightsOnly ? t('audioShowAll') : t('audioHighlightsOnly') }}
  </button>
  <!-- 说话人过滤 chips:「全部」+ 每说话人一个;多选,空集=全部(与只看重点 AND 叠加) -->
  <template v-if="hasSpeakers">
    <button type="button" class="spk-chip spk-chip-all" :class="{ on: pickedSpeakers.size === 0 }" @click="clearSpeakerFilter">
      {{ t('audioSpeakerAll') }}
    </button>
    <button
      v-for="(sp, si) in speakers"
      :key="sp.id"
      type="button"
      class="spk-chip"
      :class="{ on: pickedSpeakers.has(sp.id) }"
      :style="{ '--c': speakerToken(si) }"
      @click="toggleSpeaker(sp.id)"
    >
      <span class="spk-dot"></span>{{ sp.name }}
    </button>
  </template>
</div>
```

- [ ] **Step 4: style — chips 样式（抄设计稿）+ 工具栏允许换行**

把 `.ap-tools`（约 L645）加 `flex-wrap: wrap;`：

```css
.ap-tools { flex: 0 0 auto; display: flex; flex-wrap: wrap; gap: 8px; padding: 4px 20px 6px; }
```

在 `.ap-tool.on { … }` 之后追加：

```css
/* ── 说话人过滤 chip:说话人色圆点 + color-mix 光环;选中时边框/底色用该说话人色 ── */
.spk-chip {
  display: inline-flex; align-items: center; gap: 8px; padding: 5px 14px; border-radius: 999px;
  font-size: 15px; font-weight: 600; cursor: pointer; border: 1px solid var(--border);
  background: transparent; color: var(--fg-muted); transition: color 0.15s, border-color 0.15s, background 0.15s;
}
.spk-chip .spk-dot {
  width: 9px; height: 9px; border-radius: 50%; flex: 0 0 auto; background: var(--c);
  box-shadow: 0 0 0 3px color-mix(in oklab, var(--c) 20%, transparent); transition: box-shadow 0.15s;
}
.spk-chip:hover { border-color: var(--fg-faint); color: var(--fg); }
.spk-chip.on { color: var(--fg); border-color: var(--c); background: color-mix(in oklab, var(--c) 15%, transparent); }
.spk-chip.on .spk-dot { box-shadow: 0 0 0 3px color-mix(in oklab, var(--c) 38%, transparent); }
/* 「全部」chip:无说话人色,选中用中性 accent */
.spk-chip-all.on { color: var(--accent-text); border-color: var(--accent-soft-bd); background: var(--accent-soft); }
```

- [ ] **Step 5: 验证**

Run: `pnpm exec vue-tsc --noEmit`
Expected: 无错误

Run: `pnpm test`
Expected: 全绿（含 i18n parity、color-guard——`color-mix(in oklab, var(--c) …)` 剥掉 `var()` 后无 hex/rgb,守卫通过）

- [ ] **Step 6: Commit**

```bash
git add src/files/viewers/MediaViewer.vue src/i18n/zh_cn.ts src/i18n/en_us.ts
git commit -m "feat(files): speaker filter chips on transcript panel (multi-select, AND with highlights-only)"
```

---

### Task 5: 波形按说话人分段着色 + 过滤压暗

**Files:**
- Modify: `src/files/viewers/MediaViewer.vue`（script 波形区约 L49-73;template 波形约 L410-417;style 波形约 L588-591）

**Interfaces:**
- Consumes: `barSpeakers(segments, duration, n)`（Task 2）、`speakerColor(id)`（Task 3）、`pickedSpeakers`（Task 4）、既有 `WAVE_N` / `durTime` / `playedBars` / `waveBars`。

- [ ] **Step 1: script — 竖条归属与取色**

(a) import 行改为：

```ts
import { speakerToken, segMatches, barSpeakers } from './speakerWave'
```

(b) 在 `const playedBars = computed(…)`（约 L73）之后加：

```ts
// 波形×说话人:仅当转录带说话人数据时启用(spec §3;无说话人音频保持旧渲染分支零变化)。
// durTime 为 0(loadedmetadata 前)时 barSpeakers 返回全 null → 全部竖条先走 --wave-none,就绪后响应式重算。
const barSpk = computed<(string | null)[]>(() => {
  const tr = transcript.value
  if (!tr?.speakers?.length) return []
  return barSpeakers(tr.segments, durTime.value, WAVE_N)
})
const waveSpeakerMode = computed(() => barSpk.value.length > 0)
function barColor(i: number): string {
  const id = barSpk.value[i]
  return id ? speakerColor(id) : 'var(--wave-none)'
}
// 过滤压暗:过滤集非空且该条说话人不在选中集(静场条也压暗,与转录列表口径一致)。
function barDim(i: number): boolean {
  if (!waveSpeakerMode.value || pickedSpeakers.value.size === 0) return false
  const id = barSpk.value[i]
  return !id || !pickedSpeakers.value.has(id)
}
```

> **执行修正（77d79c1）：** `barColor` 必须感知 dim——内联样式优先级恒高于样式表，`.dim` 规则里的 `--bar-c: var(--wave-dim)` 覆盖不到内联值。落地版本：
>
> ```ts
> function barColor(i: number): string {
>   if (barDim(i)) return 'var(--wave-dim)'
>   const id = barSpk.value[i]
>   return id ? speakerColor(id) : 'var(--wave-none)'
> }
> ```
>
> 相应地 Step 3 的 `.np-wave.spk .np-wave-bar.dim` 规则只保留 `opacity: 0.12`，**不要**在样式表里写 `--bar-c: var(--wave-dim)`（死声明，勿恢复）。

- [ ] **Step 2: template — 竖条绑定说话人色与 dim**

把波形容器与竖条（约 L402-418）：

```html
<div
  ref="track"
  class="np-wave"
  @pointerdown="onBarDown"
  @pointermove="onBarMove"
  @pointerup="onBarUp"
  @pointercancel="onBarUp"
>
  <div class="np-wave-base"></div>
  <i
    v-for="(a, i) in waveBars"
    :key="i"
    class="np-wave-bar"
    :class="{ played: i < playedBars }"
    :style="{ height: a * 100 + '%' }"
  ></i>
</div>
```

替换为：

```html
<div
  ref="track"
  class="np-wave"
  :class="{ spk: waveSpeakerMode }"
  @pointerdown="onBarDown"
  @pointermove="onBarMove"
  @pointerup="onBarUp"
  @pointercancel="onBarUp"
>
  <div class="np-wave-base"></div>
  <i
    v-for="(a, i) in waveBars"
    :key="i"
    class="np-wave-bar"
    :class="{ played: i < playedBars, dim: barDim(i) }"
    :style="waveSpeakerMode ? { height: a * 100 + '%', '--bar-c': barColor(i) } : { height: a * 100 + '%' }"
  ></i>
</div>
```

- [ ] **Step 3: style — 说话人模式的着色/不透明度方案（抄设计稿;旧规则原样保留兜底无说话人音频）**

在既有三行波形竖条规则（约 L589-591,**不动它们**）：

```css
.np-wave-bar { position: relative; flex: 0 1 3px; max-width: 3px; border-radius: 999px; background: var(--fg-subtle); transition: background 0.12s, height 0.3s var(--ease); }
.np-wave-bar.played { background: var(--accent); }
.np-wave:hover .np-wave-bar.played { background: var(--accent2); }
```

之后追加（`.np-wave.spk` 分支靠更高特异性 + 后声明覆盖旧规则）：

```css
/* ── 说话人模式(.np-wave.spk,仅转录带说话人数据时):每根竖条按该时段说话人取色,
   进度 = 不透明度(已播满色/未播同色淡出),说话人配色与播放进度同时可读。 ── */
.np-wave.spk .np-wave-bar {
  background: var(--bar-c, var(--wave-none)); opacity: 0.30;
  transition: background 0.14s, opacity 0.14s, filter 0.14s, height 0.3s var(--ease);
}
.np-wave.spk .np-wave-bar.played { background: var(--bar-c, var(--wave-none)); opacity: 1; }
.np-wave.spk:hover .np-wave-bar.played { background: var(--bar-c, var(--wave-none)); }
/* 过滤:未选中说话人的竖条去色转灰并进一步压暗,只留选中者的颜色跳出来 */
.np-wave.spk .np-wave-bar.dim { --bar-c: var(--wave-dim); opacity: 0.12; }
.np-wave.spk .np-wave-bar.dim.played { opacity: 0.30; }
.np-wave.spk:hover .np-wave-bar.played:not(.dim) { filter: brightness(1.12); }
```

- [ ] **Step 4: 验证**

Run: `pnpm exec vue-tsc --noEmit`
Expected: 无错误

Run: `pnpm test`
Expected: 全绿

- [ ] **Step 5: Commit**

```bash
git add src/files/viewers/MediaViewer.vue
git commit -m "feat(files): waveform bars colored by speaker with filter dimming (opacity = progress)"
```

---

### Task 6: 全量验证 + 构建 + 部署 + spec 状态更新

**Files:**
- Modify: `docs/superpowers/specs/2026-07-13-new-ui-audio-speaker-waveform-design.md:4`（状态行）

- [ ] **Step 1: 全量测试与构建**

Run: `pnpm test`
Expected: 全绿

Run: `pnpm build`
Expected: vue-tsc 通过 + vite build 产出 `dist/`

- [ ] **Step 2: 部署到设备**

Run: `./scripts/deploy.sh`
Expected: rsync 到 `/var/lib/nimoos/www/app/` 成功（若无权限则提示用户执行）

- [ ] **Step 3: spec 状态行更新**

把 spec 第 4 行 `- 状态：设计已定，待实现` 改为 `- 状态：已实现（2026-07-13，见 plans/2026-07-13-new-ui-audio-speaker-waveform.md）`。

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-07-13-new-ui-audio-speaker-waveform-design.md docs/superpowers/plans/2026-07-13-new-ui-audio-speaker-waveform.md
git commit -m "docs: mark audio speaker waveform spec implemented; add implementation plan"
```

- [ ] **Step 5: 真机验收清单（交给用户,浏览器打开 `/app/` → 文件 → New recording 21.m4a）**

1. 波形:讲师段蓝、学生插话紫（短插话可见）、静场灰;已播段满色、未播淡;dark/light 两主题下都成立。
2. chips:点「Student」→ 列表只剩学生段、波形只有学生竖条保持彩色其余压暗;再点「全部」→ 恢复。
3. 筛选中点击某段（seek）→ 点「全部」/再勾一人:该段仍高亮、进度条不动、自动滚回该段。
4. 重点句无金色底,星标仍金色;「只看重点」+ 说话人过滤可叠加。
5. 无转录的普通音乐:波形与改动前完全一致（未播灰/已播蓝紫）。
6. Console 无报错;主题切换即时生效。
