# Task 10 报告:MediaViewer 拆转录面板

## 做了什么

1. `cp src/files/viewers/MediaViewer.vue oss/files/MediaViewer.vue`(852 行冻结分身)
2. 按 brief 清单从后往前删(`<style>` → `<template>` → `<script setup>`),每删一块跑一次 grep 核验零残留后再删下一块
3. `oss/manifest.mjs` 的 `REPLACE` 表追加 T10 条目,钉住私有侧 SHA-256
4. `oss/tree.test.mjs` 追加 `describe('类 2 · MediaViewer 拆转录')`(brief Step 1 给的 3 例,逐字照抄)
5. 跑 `oss/tree.test.mjs`(41 例全绿)+ `node oss/export.mjs --out /tmp/t10-tree --skip-guard --no-commit --allow-dirty-oss`(成功,产出与 `oss/files/MediaViewer.vue` 逐字节一致)

**没有**跑 `pnpm install` / `vue-tsc` / `pnpm build` / dev server / 截图(遵照任务说明,产出树编译不过是预期状态,因为 T11/T12/T13 还没做)。

## 删除清单逐块执行与验证

### `<style>` 段
- 删 `.np-wave.spk*` 说话人波形着色块(含 `.dim`/`hover` 变体)—— grep `np-wave.spk` 结果 0
- 删整个「转录/摘要面板」样式:`.audio-panel`、`.ap-tabs`/`.ap-tab*`、`.ap-scroll`、`.ap-summary*`、`.ap-kw`/`.ap-chip`、`.ap-transcript`/`.ap-seg*`/`.ap-time`/`.ap-hl-star`、`.ap-chapter*`、`.ap-tools`/`.ap-tool*`、`.spk-chip*`/`.spk-dot`、`.ap-ch-trigger*`、Ask Nimo 全套(`.ap-ask-*`/`.ap-msg*`)—— grep `ap-` / `spk-chip` / `audio-panel` 结果均 0
- 删第二个非 scoped `<style>` 块(`.ap-ch-menu*`/`.ap-ch-item*`/`.ap-ch-check`/`.ap-ch-t`/`.ap-ch-title`)—— DropdownMenu Portal 样式随功能整体删除,文件里只剩一个 `<style scoped>` 块
- `.media-wrap.has-panel` 相关:`.media-wrap:not(.has-panel) .audio-layout { justify-content: center; }` 与上方 `.audio-layout { ... }` 合并成一条规则(`has-panel` 类不再存在,`:not()` 限定词失去意义,合并是该删除的直接推论,非无关重构)
- **E11 关键改动**:`.np-wave-bar` 的基础背景色从 `var(--fg-subtle)` 改为 `var(--wave-none)`(该 token 语义正是"波形:静场/无人声竖条",此前只在已删除的说话人模式 CSS 变量兜底值里出现;现在成为常规未播放竖条的直接颜色源,保留 `.np-wave-bar.played { background: var(--accent); }` 不变)

### `<template>` 段
- `media-wrap` 的 `:class="{ 'has-panel': ... }"` 整个去掉
- `np-wave` 的 `:class="{ spk: waveSpeakerMode }"` 去掉
- 竖条 `:class="{ played: i < playedBars, dim: barDim(i) }"` → `:class="{ played: i < playedBars }"`;`:style` 从三元表达式(spk 模式下带 `--bar-c`)简化为固定 `{ height: a * 100 + '%' }`(颜色改走上面的 CSS 类,不再需要内联)
- `<aside v-if="transcript" class="audio-panel">...</aside>` 整块删除(三 tab、章节下拉菜单、说话人 chips、转录列表、Ask 面板全在里面)

### `<script setup>` 段
- 删 import:`audioTranscripts`(`lookupTranscript`/`parseTimestamp`/`TranscriptSegment`)、`speakerWave`(`speakerToken`/`segMatches`/`barSpeakers`/`segChapterIndex`/`barChapterIndex`)、reka-ui 的 6 个 `DropdownMenu*`
- 删 `transcript` computed、`tab` ref
- 删 `barSpk`/`waveSpeakerMode`/`barChap`/`barColor`/`barDim`
- 删 `seekTo`/`transcriptEl`/`activeSeg`/`scrollActiveIntoView` 及其两个 `watch`
- 删「转录面板」整节:`highlightsOnly`/`speakers`/`hasSpeakers`/`pickedSpeakers`/`allPicked`/`toggleSpeaker`/`toggleAll`/`chapters`/`hasChapters`/`pickedChapters`/`allChaptersPicked`/`toggleChapter`/`toggleAllChapters`/`segChap`/第三个 `watch`/`TransRow`/`speakerFiltering`/`chapterFiltering`/`transcriptRows`/`hasHighlights`/`speakerName`/`speakerColor`/`AskMsg`/`askInput`/`askMsgs`/`askScrollEl`/`PRESETS`/`askChips`/`answerFor`/`askTimer`/`stopStream`/`scrollAskToBottom`/`sendAsk`/`pickAskChip`
- `onBeforeUnmount` 里的 `stopStream()` 调用行删除(函数已不存在)
- `watch`/`nextTick` 从 `vue` 的 import 里一并摘除(全文件再无第二处使用,见下方死 import 证据)
- **保留**:`onMounted` 的 artplayer 视频通路 + `startWaveDecode()` + music-metadata 封面/标题/艺术家 整块未动

## 死 import 逐个 grep 证据

```
$ grep -c "DropdownMenu" src/files/viewers/MediaViewer.vue   # 删前
15   # 全部在被删的 <aside> 块与 import 块里,唯一消费方就是章节下拉菜单

$ grep -n "\bwatch\b\|nextTick" oss/files/MediaViewer.vue    # 删后
(none)  # watch/nextTick 无残留使用点,import 里已去掉,确认非死 import
```

## 符号级全扫结果(残留数)

```
$ for s in transcript speaker chapter ask spk 'ap-' highlight DropdownMenu stopStream; do
    echo "--- $s ---"; grep -n -i -- "$s" oss/files/MediaViewer.vue || echo "(none)"
  done
--- transcript ---   (none)
--- speaker ---      (none)
--- chapter ---      (none)
--- ask ---          (none)
--- spk ---          (none)
--- ap- ---          (none)
--- highlight ---    (none)
--- DropdownMenu ---  (none)
--- stopStream ---   (none)
```

全部 0 残留(大小写不敏感扫描,含注释与字符串)。

## 保留面完好证据

```
$ for s in waveform decodeWaveform synthWaveform waveCacheKey np-wave-bar playedBars \
           togglePlay cycleRate audioSkipBack audioSkipForward audioSpeed \
           'var(--wave-none)' music-metadata-browser artplayer; do
    printf "%-25s %s\n" "$s" "$(grep -c -- "$s" oss/files/MediaViewer.vue)"
  done
waveform                  2
decodeWaveform            2
synthWaveform             2
waveCacheKey              2
np-wave-bar               4
playedBars                2
togglePlay                2
cycleRate                 2
audioSkipBack             2
audioSkipForward          2
audioSpeed                1
var(--wave-none)          1
music-metadata-browser    1
artplayer                 1
```

全部 ≥1,保留面完好。`skip(`(快进/快退)、`decodeWaveform`/`synthWaveform`(波形合成+解码)均在,`onMounted` 视频/音频两条通路原样保留。

## `--wave-none` 在用 + `--spk-`/`--wave-dim` 零残留

```
$ grep -c -- "--spk-" oss/files/MediaViewer.vue    → 0
$ grep -c -- "--wave-dim" oss/files/MediaViewer.vue → 0
$ grep -n "var(--wave-none)" oss/files/MediaViewer.vue
351:.np-wave-bar { position: relative; ...; background: var(--wave-none); ... }
```

`--wave-none` 仅出现 1 处,但它是 `.np-wave-bar` 的**基础背景色**(非条件分支、非注释),每根未播放竖条都会渲染这个颜色 —— 波形静态有色。`theme.css` 里该 token 已确认在 `:root` 与 `[data-theme="light"]` 两套主题块各出现一次(T8 已验),值分别为 `var(--fg-subtle)`(蓝色主题)与对应白色主题取值,不是透明/未定义。截图证据按坑③说明挪至 T15。

## 最终行数

852 → **359 行**(brief 要求 <600,达标)。

## 测试输出

```
$ pnpm exec vitest run oss/tree.test.mjs
 Test Files  1 passed (1)
      Tests  41 passed (41)
```
(38 条既有 + 本任务新增 3 条,全绿。)

```
$ node oss/export.mjs --out /tmp/t10-tree --skip-guard --no-commit --allow-dirty-oss
[oss] 1/6 前置检查
[oss]   New-UI 8d4c8272 · Service 7e84566b
[oss] 2/6 取源
[oss] 3/6 应用清单(DELETE 21 · REPLACE 2 · PATCH 99)
[oss] 4/6 内嵌共享包
[oss] 5/6 泄漏守卫 —— 已用 --skip-guard 跳过(仅开发期允许,未扫描任何文件)
[oss] 6/6 落盘
[oss] 完成 → /tmp/t10-tree
```
产出树 `/tmp/t10-tree/src/files/viewers/MediaViewer.vue` 与 `oss/files/MediaViewer.vue` `diff` 结果为空(逐字节一致);`audioTranscripts.ts`/`speakerWave.ts` 已删除,`waveform.ts` 保留。跑完即 `rm -rf /tmp/t10-tree`,未指向 `/home/nimo/NimoTech/NimoOS-Web`。

## 自查结论

- 三个坑均已处理:① `--wave-none` 改为 `.np-wave-bar` 常规背景色(非仅注释引用),`--spk-`/`--wave-dim` 零残留;② `watch`/`nextTick`/`DropdownMenu*`/`audioTranscripts`/`speakerWave` 死 import 全部一并清除并 grep 核验;③ 未跑任何编译/构建/dev server/截图工具。
- 未碰 `src/**` 任何其它产品代码;未 `git checkout`/`stash`/`reset`;`git status --porcelain` 只多出 `oss/manifest.mjs`(M)、`oss/tree.test.mjs`(M)、`oss/files/MediaViewer.vue`(??),外加原本就在的 3 行 design-export `D`。
- `MediaViewer.test.ts` 未碰(仓库里目前没有这份测试文件,搜索确认;测试同步是 T13 的活)。
- `audioArtist` 这个 ref 在原文件里本就没有被模板消费(只在 `onMounted` 里赋值),不属于转录面板的一部分、也不是本任务引入的死代码 —— 按「禁无关重构」原则未动它,留给后续任务/复审判断是否需要清理。

## 遗留疑问

1. `audioArtist`(见上)是否要在后续任务里一并清理为死代码,不在 T10 范围内,标注给后续复审。
2. E11 的"波形有颜色"截图证据(暗色+亮色各一张)按坑③说明已挪到 T15,本任务只交静态 grep 证据,提醒 T15 执行者别漏做。
