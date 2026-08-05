### Task 10: 类 2 替换 —— MediaViewer 拆转录面板

**Files:**
- Create: `oss/files/MediaViewer.vue`
- Modify: `oss/manifest.mjs`(`REPLACE` 第二条)
- Test: `oss/tree.test.mjs`

**Interfaces:**
- Consumes: `src/files/viewers/waveform.ts`(保留)、`mediaKind.ts`、`ViewerShell.vue`
- Produces: 只有播放器 + 真实波形的 MediaViewer,不导出任何转录相关符号

**保留**:自绘播放器、真实波形(`waveform.ts` 解码 PCM)、快退/快进/倍速、图片与视频通路、封面与元数据。
**删掉**:摘要 / 转录 / Ask 三 tab 的整套 UI 与状态、说话人分色、章节过滤、说话人 chips。

**⚠️ E11 的落点**:波形的静场竖条用 `--wave-none`,它与说话人着色**共用一套 token 家族**。删 `--spk-*`/`--wave-dim` 时**不能把保留下来的波形弄没颜色** —— 本任务必须有截图证据,不能只靠读代码。

- [ ] **Step 1: 写失败断言**

```js
describe('类 2 · MediaViewer 拆转录', () => {
  it('转录/说话人/Ask 的符号全无(speaker 是哨兵词)', () => {
    const s = read('src/files/viewers/MediaViewer.vue')
    for (const bad of ['audioTranscripts', 'speakerWave', 'lookupTranscript', 'TranscriptSegment',
                       'speakerToken', 'segMatches', 'barSpeakers', 'segChapterIndex', 'barChapterIndex',
                       'transcriptRows', 'highlightsOnly', 'pickedSpeakers', 'pickedChapters',
                       'askMsgs', 'sendAsk', 'PRESETS', 'answerFor', 'stopStream',
                       'ap-tabs', 'ap-transcript', 'spk-chip', 'audio-panel', 'has-panel',
                       '--spk-', '--wave-dim', 'DropdownMenu']) {
      expect(s, bad).not.toContain(bad)
    }
  })

  it('播放器与真实波形完整保留,静场 token 还在(E11)', () => {
    const s = read('src/files/viewers/MediaViewer.vue')
    for (const k of ['waveform', 'decodeWaveform', 'synthWaveform', 'waveCacheKey',
                     'np-wave-bar', 'playedBars', 'togglePlay', 'cycleRate',
                     'audioSkipBack', 'audioSkipForward', 'audioSpeed',
                     'var(--wave-none)', 'music-metadata-browser', 'artplayer']) {
      expect(s, k).toContain(k)
    }
  })

  it('文件明显变短(852 行 → 600 行以内)', () => {
    expect(read('src/files/viewers/MediaViewer.vue').split('\n').length).toBeLessThan(600)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm exec vitest run oss/tree.test.mjs -t 'MediaViewer'`
Expected: FAIL(3 例)

- [ ] **Step 3: 从私有侧拷一份,按清单逐块删**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI
cp src/files/viewers/MediaViewer.vue oss/files/MediaViewer.vue
```

按行号(以 `cd382d5` 的 852 行版为准,**从后往前删**,免得行号漂):

**`<style>` 段(627–852)**:删 `.np-wave.spk*`(713/716–718)· `.spk-chip*` 与 `.spk-dot`(755/784–797)· `.ap-*` 全族(tabs / tab / summary / kw / chip / tools / tool / ch-* / scroll / transcript / chapter* / seg* / time / speaker* / hl-star / ask-*)· `.audio-panel` · `.media-wrap.has-panel`。**保留** `.np-*` 全族与 `.audio-layout` / `.audio-player` / `.audio-blur`。

**`<template>` 段(433–625)**:
- 第 435 行 `:class="{ 'has-panel': kind === 'audio' && !!transcript }"` → 整个 `:class` 去掉
- 第 477–478 行波形的 `:class="{ spk: waveSpeakerMode }"` 与竖条的 `:class="{ played: i < playedBars, dim: barDim(i) }"` → 后者简化为 `:class="{ played: i < playedBars }"`,竖条内联色改成固定 `var(--wave-none)`
- 第 507 行起 `<aside v-if="transcript" class="audio-panel">` 到它的 `</aside>` **整块删除**(三 tab、章节菜单、说话人 chips、转录列表、Ask 面板全在里面)

**`<script setup>` 段(1–431)**:
- 删 import:第 7–9 行(`audioTranscripts` / `TranscriptSegment` / `speakerWave`)
- 删第 12–16 行的 reka-ui `DropdownMenu*` import 块(只有章节菜单在用 —— 先 `grep -c DropdownMenu` 确认)
- 删第 24 行 `transcript` computed、第 25 行 `tab` ref
- 删第 82–92 行(`barSpk` / `waveSpeakerMode` / `barChap`)
- 第 93–110 行:`barColor` 与 `barDim` 整个删掉(竖条改用固定 token,见上)
- 删第 182–209 行(`seekTo` / `transcriptEl` / `activeSeg` / `scrollActiveIntoView`)
- 删第 210–373 行(`// ── 转录面板` 整节:highlights / speakers / chapters / transcriptRows / speakerName / speakerColor / Ask 全套 / `stopStream` / `pickAskChip`)
- 第 428 行 `onBeforeUnmount` 里的 `stopStream()` 一行删掉(函数已不存在)
- **保留** 第 375–427 行的 `onMounted`(artplayer 视频通路 + `startWaveDecode()` + music-metadata 封面)整块不动

每删一块跑一次 `pnpm exec vue-tsc --noEmit --skipLibCheck oss/files/MediaViewer.vue` 或直接靠 Step 5 的整树 tsc 兜。

- [ ] **Step 4: 加 `REPLACE` 条目**

```bash
node -e "console.log(require('node:crypto').createHash('sha256').update(require('node:fs').readFileSync('src/files/viewers/MediaViewer.vue','utf8')).digest('hex'))"
```

```js
  { path: 'src/files/viewers/MediaViewer.vue', from: 'MediaViewer.vue',
    privateSha256: '<输出>' },
```

- [ ] **Step 5: 跑产出树测试 + 整树类型检查**

```bash
pnpm exec vitest run oss/tree.test.mjs
node oss/export.mjs --out /tmp/oss-mv --skip-guard --no-commit
cd /tmp/oss-mv && pnpm install && pnpm exec vue-tsc --noEmit
```

Expected: 断言全绿;`vue-tsc` **0 错**。

- [ ] **Step 6: 波形有颜色的截图证据(E11,不许只读代码)**

在 `/tmp/oss-mv` 起 dev server,打开任意音频文件预览,暗色 + 亮色各截一张:
- 播放器与波形正常渲染,竖条**有颜色**(不是全灰/全透明)
- 已播放段与未播放段能分辨
- 右侧没有面板,布局不因为少了 `has-panel` 而错位

- [ ] **Step 7: 提交**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI
git add oss/manifest.mjs oss/files/MediaViewer.vue oss/tree.test.mjs
git commit -m "feat(oss): MediaViewer 拆转录面板(保留播放器与真实波形)"
```

---

