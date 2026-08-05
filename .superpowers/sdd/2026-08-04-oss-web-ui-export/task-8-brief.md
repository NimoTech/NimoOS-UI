### Task 8: 类 3 补丁 —— i18n 54 键 ×2 + theme.css

**Files:**
- Modify: `oss/manifest.mjs`
- Test: `oss/tree.test.mjs`

**Interfaces:**
- Consumes: T7 的 `PATCH`
- Produces: 四个 locale 文件同步删键;`theme.css` 去掉说话人/AI 相关 token 与类

**i18n 的守卫是自动的**:`src/i18n/parity.test.ts` 断言 `zh_cn` 与 `en_us` 键集完全一致 —— 漏删一边,T15 的 `pnpm test` 当场红。**`.sp9.ts` 分片也要同步。**

**E11(必须遵守)**:`--wave-none` **保留**(波形静场竖条在用),`--spk-1..5` 与 `--wave-dim` 删。`@keyframes pulse` / `--orb-core` / `--orb-glow` 唯一消费方是 `AiWidget.vue`,可以删 —— `DropPage.vue` 用的是自己的 `@keyframes dropPulse`。

- [ ] **Step 1: 写失败断言**

```js
describe('类 3 · i18n 与主题 token', () => {
  const LOCALES = ['src/i18n/zh_cn.ts', 'src/i18n/en_us.ts', 'src/i18n/zh_cn.sp9.ts', 'src/i18n/en_us.sp9.ts']

  it('四个 locale 里 AI/相册/搜索/转录/文件夹权限的键全没了', () => {
    const DEAD = [
      'appPhotos', 'appAi', 'widgetAiTitle', 'widgetAiPrompt1', 'addPanelTabPhoto', 'addPanelNoPhotos',
      'topbarSearch', 'searchPlaceholder', 'searchAskButton', 'searchTabVideos',
      // E1:spec 漏登记的 11 个 audio 转录键
      'audioSummary', 'audioTranscript', 'audioAsk', 'audioAskDemo', 'audioHighlightsOnly',
      'audioSpeakerAll', 'audioChapters', 'audioAllChapters',
      'settingsTabFolderPermissions', 'settingsFpKnowledge', 'settingsFpAiHidden', 'settingsFpPhotos',
    ]
    for (const f of LOCALES) for (const k of DEAD) expect(read(f), `${f} :: ${k}`).not.toContain(`${k}:`)
  })

  it('播放器控件键与商店筛选键保留', () => {
    for (const f of ['src/i18n/zh_cn.ts', 'src/i18n/en_us.ts']) {
      for (const k of ['audioSkipBack', 'audioSkipForward', 'audioSpeed', 'appsStoreSearch']) {
        expect(read(f), `${f} :: ${k}`).toContain(`${k}:`)
      }
    }
  })

  it('zh_cn 与 en_us 键数仍然相等(parity 的前置)', () => {
    const keys = (f) => (read(f).match(/^\s{2}[a-zA-Z][a-zA-Z0-9]*:/gm) || []).length
    expect(keys('src/i18n/zh_cn.ts')).toBe(keys('src/i18n/en_us.ts'))
    expect(keys('src/i18n/zh_cn.sp9.ts')).toBe(keys('src/i18n/en_us.sp9.ts'))
  })

  it('theme.css:说话人/AI token 与照片磁贴样式删净,--wave-none 保留(E11)', () => {
    const c = read('src/styles/theme.css')
    for (const bad of ['--spk-', '--wave-dim', '--orb-core', '--orb-glow',
                       '@keyframes pulse', '.ic-photos', '.ic-ai', '.ic-search',
                       '.photo-thumb', '.kind-photo']) {
      expect(c, bad).not.toContain(bad)
    }
    // 两套主题块里都要还有 --wave-none
    expect(c.match(/--wave-none/g)?.length).toBe(2)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm exec vitest run oss/tree.test.mjs -t 'i18n 与主题'`
Expected: FAIL(4 例)

- [ ] **Step 3: 现场取出四个 locale 的待删键原文**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI
# zh_cn.ts:44 键(33 + 11 个 audio)
sed -n '36,46p' src/i18n/zh_cn.ts      # audio 转录 11 键(47-49 的 Skip/Speed 保留!)
sed -n '222,223p;234,235p;255,261p' src/i18n/zh_cn.ts   # appPhotos/appAi/widgetAi*
sed -n '279p;285p;341,342p;349,367p'  src/i18n/zh_cn.ts # addPanel*/topbarSearch*/search*
# en_us.ts:同名键,行号不同 —— 用 grep -n 逐键定位,别照抄 zh 的行号
grep -nE "^\s+(appPhotos|appAi|widgetAi|addPanelTabPhoto|addPanelNoPhotos|topbarSearch|search[A-Z]|audio(Summary|Transcript|Ask|Highlights|ShowAll|SpeakerAll|Chapters|AllChapters))" src/i18n/en_us.ts
# sp9 分片:10 键 ×2
grep -nE "^\s+(settingsTabFolderPermissions|settingsFp)" src/i18n/zh_cn.sp9.ts src/i18n/en_us.sp9.ts
```

每个**连续键区**做成一条 PATCH(连续区一条,不连续的分开)—— 连续区能让锚点更长、更不容易撞车。示例:

```js
  { path: 'src/i18n/zh_cn.ts',
    find: "  audioSummary: '摘要',\n  audioTranscript: '转录文稿',\n  audioAsk: '问 Nimo',\n  audioAskPlaceholder: '关于这段音频，尽管问…',\n  audioAskEmpty: '这段音频的转录已向量化 — 关于内容尽管问 Nimo。',\n  audioAskDemo: '(demo 占位) 转录已向量化。接入 AI 后端后，这里会根据音频内容作答，并附上可跳转的时间戳。',\n  audioHighlightsOnly: '只看重点',\n  audioShowAll: '显示全部',\n  audioSpeakerAll: '全部',\n  audioChapters: '章节',\n  audioAllChapters: '全部章节',\n",
    replace: '' },
```

- [ ] **Step 4: 追加 `theme.css` 的补丁条目**

现场取原文(**两套主题块都要删**,`:root` 与 `:root[data-theme="light"]`):

```bash
sed -n '70,76p'   src/styles/theme.css   # :root 的 --spk-1..5 / --wave-none / --wave-dim
sed -n '289,295p' src/styles/theme.css   # light 主题的同一批
sed -n '150,151p' src/styles/theme.css   # :root 的 --orb-core / --orb-glow
sed -n '240,241p' src/styles/theme.css   # light 的同一对
sed -n '387p'     src/styles/theme.css   # @keyframes pulse
sed -n '473,474p;478p;481p;487p;500,501p;530p;536p;541,545p;557p' src/styles/theme.css
```

**注意**:`--wave-none` 那一行夹在 `--spk-5` 与 `--wave-dim` 之间,补丁的 `find` 必须**跨过它**(删 spk 五行 + 单独删 wave-dim 一行),否则会把要保留的 token 一起删掉。这一条是 E11 的落点。

- [ ] **Step 5: 跑产出树测试**

Run: `pnpm exec vitest run oss/tree.test.mjs`
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add oss/manifest.mjs oss/tree.test.mjs
git commit -m "feat(oss): i18n 54 键与 theme token 补丁(--wave-none 保留)"
```

---

