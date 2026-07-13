# NimoOS-New-UI 音频转录「章节」下拉多选过滤 设计

- 日期：2026-07-13
- 状态：已实现（2026-07-13，见 plans/2026-07-13-new-ui-audio-chapter-filter.md）
- 范围仓库：`NimoOS-New-UI`
- 影响文件：`src/files/viewers/MediaViewer.vue`、`src/files/viewers/speakerWave.ts`（+测试）、`src/i18n/{zh_cn,en_us}.ts`

## 1. 需求（用户定稿）

转录工具栏加「章节」过滤器，做成**下拉多选菜单**，与既有「说话人 chips」「只看重点」**AND 叠加**——支持「章节一 × 老师 × 重点」这类组合。三项决策（用户已选）：

1. **选择语义与说话人完全一致**（master-checkbox）：初始全选；菜单顶部「全部章节」=全选/全不选总开关（仅全选时打勾）；全选=等效不过滤；全不选=全隐藏。
2. **联动波形压暗**：未选中章节的时间段竖条同样压暗（与说话人压暗同一套视觉，条件取 OR）。
3. **章节标题头**：只按章节过滤时，选中章节的标题头保留显示；一旦叠加说话人过滤或只看重点，标题头全部隐藏（沿用现状避免空章节）。

## 2. 下拉菜单 UI

- 触发器：`.ap-tool` 胶囊样式，「章节 ▾」，位置在「只看重点」右侧、说话人 chips 左侧；**部分选中时显示计数**「章节 3/14 ▾」；`hasChapters` 才渲染。
- 菜单：复用仓库既有 reka-ui DropdownMenu 模式（参照 `src/files/components/AddMountMenu.vue`）+ 共享非 scoped 样式 `ui-ctx-content`/`ui-ctx-item`/`ui-ctx-sep`（`src/components/ui/ContextMenu.vue`）。用 `DropdownMenuItem` + 手绘 ✓ 标记（不用 CheckboxItem，避免其 API 纠缠）。
- **点选项不关菜单**：`@select.prevent`（阻止 reka 默认的选中即关闭），可连续勾选；点菜单外关闭。
- 菜单项：「全部章节」+ 分隔线 + 每章一项（✓ 占位 + 时间 + 标题，标题超长省略号）；菜单 `max-height: 320px; overflow-y: auto`。
- **z-index 坑（已确认）**：预览浮层 `ViewerShell` 是 `z-index: 200`，共享菜单样式 `ui-ctx-content` 只有 `120`——Portal 到 body 的菜单会被压在浮层下。补充非 scoped 类 `.ap-ch-menu { z-index: 240; }`（只提本菜单，不动全局 `ui-ctx-content`）。Portal 内容拿不到 scoped 属性，`.ap-ch-*` 全部走非 scoped `<style>` 块（AddMountMenu 已有此先例）。
- i18n 新键：`audioChapters`（zh「章节」/ en "Chapters"）、`audioAllChapters`（zh「全部章节」/ en "All chapters"）。

## 3. 状态与过滤语义（MediaViewer）

- `pickedChapters: Ref<Set<number>>`（章节序号），初始全选；`toggleChapter(k)` / `toggleAllChapters()` 与说话人的同名逻辑一致（整体替换 Set）。
- `allChaptersPicked = hasChapters && pickedChapters.size === chapters.length`；`chapterFiltering = hasChapters && !allChaptersPicked`。
- 段落显示条件（AND，顺序无关）：
  1. `!chapterFiltering || pickedChapters.has(segChap[i])`（i=段落原始索引，查表见 §4）；
  2. `segMatches(seg, hasSpeakers ? pickedSpeakers : null, highlightsOnly)`（既有，不改）。
- **索引不重排**：过滤只减行，`data-seg` 仍用原始索引——播放高亮/seek/滚动定位机制不受影响；`pickedChapters` 加入既有的 scroll watch。
- 章节标题头：`showHeads = !highlightsOnly && !speakerFiltering`（speakerFiltering = hasSpeakers && !allPicked）。showHeads 时在每章第一个可见段前插标题头；被章节过滤掉的章连段带头整体消失（其段落已被条件 1 挡掉）。
- `hasChapters` computed 在上一轮说话人任务中被删（当时无消费者），本次重新引入。

## 4. 纯函数（`speakerWave.ts` 追加，vitest 单测）

```ts
/** 每个段落(按原始索引) → 所属章节序号。段落起始时间落在 [章节k.t, 章节k+1.t) 即属 k;
    早于第一章 → -1;chapters 空 → 全 -1。chapters/segments 均要求按时间升序(既有前提)。 */
export function segChapterIndex(segments: { t: string }[], chapters: { t: string }[]): number[]

/** 每根竖条(按中点时间) → 所属章节序号;duration<=0 / n<=0 / chapters 空 → 全 -1(长度 max(0,n))。 */
export function barChapterIndex(chapters: { t: string }[], duration: number, n: number): number[]
```

## 5. 波形联动

- `barChap = waveSpeakerMode ? barChapterIndex(chapters, durTime, WAVE_N) : []`。
- `barDim(i)` 扩为 OR：说话人维度非全选且该条说话人未选中 → dim；**或** `chapterFiltering && !pickedChapters.has(barChap[i])` → dim。颜色/不透明度/已播机制全不动。
- **限制（有意）**：波形压暗只在说话人模式（`waveSpeakerMode`）下生效——`.dim` 的 CSS 只存在于 `.np-wave.spk` 分支。「有章节但无说话人」的音频波形不压暗（目前无此数据，避免为假想场景改旧渲染分支）。

## 6. 测试

- `segChapterIndex`：跨章边界归属、早于第一章 → -1、chapters 空 → 全 -1。
- `barChapterIndex`：中点归章、duration=0 → 全 -1、第一章前的竖条 → -1。
- 组合语义 = 查表条件 + 既有 `segMatches`（已有单测）线性叠加，无新分支逻辑，由真机验收覆盖。
- i18n parity、color-guard 自动覆盖；`pnpm exec vue-tsc --noEmit` + 全量 `pnpm test` 须绿。

## 7. 验收（真机 `/app/`，New recording 21.m4a）

1. 工具栏出现「章节 ▾」，点开是「全部章节」+ 14 章可勾选列表，菜单浮在播放器浮层之上，滚动可达底部，点选项菜单不关闭。
2. 只勾「Sampling & the Nyquist theorem」→ 列表只剩该章段落且带该章标题头，波形只有该章时间段保持彩色其余压暗，计数显示「章节 1/14」。
3. 组合：「章节 1」+「Instructor」+「只看重点」→ 只显示第一章里讲师的重点句；标题头隐藏（叠加了说话人/重点过滤）。
4. 「全部章节」勾选状态只在全选时出现；全不选 → 列表空、波形全暗；再点「全部章节」→ 恢复全选。
5. 筛选中点击某段（seek）后改章节勾选：该段若仍可见保持高亮、进度条不动。
6. 无章节数据的音频不显示「章节」按钮；dark/light 两主题菜单观感正常；Console 无报错。

## 8. 取舍

- 用 `DropdownMenuItem` 手绘 ✓ 而非 `DropdownMenuCheckboxItem`：少一层受控 API，行为完全自持。
- 章节序号（number）作为选中集键而非章节 t 字符串：查表 O(1) 且天然对齐 `segChapterIndex` 输出。
- 不给「章节」触发器加说话人式的彩色圆点——章节无固定色语义，波形按说话人着色不变。
