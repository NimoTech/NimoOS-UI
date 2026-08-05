### Task 15: `useInfiniteScroll.ts` + `PhotosSearchGrid.vue`

**Files:**
- Create: `src/photos/composables/useInfiniteScroll.ts` + `__tests__/useInfiniteScroll.test.ts`
- Create: `src/photos/components/PhotosSearchGrid.vue` + `__tests__/PhotosSearchGrid.test.ts`
- Modify(按需): `src/styles/theme.css` + `docs/THEMING.md`
- Read-only 参考: `PhotosSearchView.vue:241-279`(模板)、`:405-415`(sentinel 门控)、`:694-721`(loadMore + IO)、`photos.scss:2711-2770`(**跳过 `:2728-2738` 死 CSS**)

**Interfaces:**
- Consumes: T10 的 `type ScoredPhoto` / `matchPct`、T9+T1 的键、`service.photos.thumbnailUrl`
- Produces:
  ```ts
  // useInfiniteScroll.ts
  export function useInfiniteScroll(opts: {
    target: Ref<HTMLElement | null>
    root: Ref<HTMLElement | null>
    enabled: Ref<boolean>
    onHit: () => void
    rootMargin?: string          // 默认 '200px 0px'
  }): void                       // 内部 watch(enabled + target) 挂/摘,onUnmounted 摘

  // PhotosSearchGrid.vue
  // props
  {
    best: ScoredPhoto[]
    more: ScoredPhoto[]
    moreExpanded: boolean
    showSentinel: boolean
    loadingMore: boolean
  }
  // emits
  (e: 'open', photo: Photo): void
  (e: 'update:moreExpanded', v: boolean): void
  (e: 'load-more'): void
  ```

**结构规格:**

**A. `useInfiniteScroll.ts`**

1. 照搬 Vue2 `:706-721` 的语义,但做成 composable:`teardown()` 先断开;`enabled` 为假或 `target`/`root` 为空 → 只 teardown;否则 `new IntersectionObserver(entries => { if (entries[0].isIntersecting) onHit() }, { root, rootMargin })` + `observe(target)`。
2. **`watch([enabled, target], …, { flush: 'post' })`** —— Vue2 是 `watch(showLoadMoreSentinel)` + `$nextTick`(`:607-610`);`flush: 'post'` 是 Vue3 的等价手法(**注释登记这个映射**)。`onUnmounted` 也 teardown。
3. **jsdom 没有 `IntersectionObserver`** ⇒ 测试里自己 stub 一个(记录 `observe`/`disconnect` 调用与构造参数,并暴露一个手动触发回调的钩子)。**stub 挂 `globalThis.IntersectionObserver`,`afterEach` 复原。**

**B. `PhotosSearchGrid.vue`**

4. 根 `.photos-wrap`(`ref="rootRef"`,`flex: 1`,`overflow-y: auto` —— **Vue2 靠全局 `.scroll` 类,本仓自己写**)含:
   - `.grid`(`data-density="comfortable"`)→ `v-for best` 出 tile。
   - `v-if="more.length"`:`.more-results-bar` 按钮(chevD/chevR 图标 11px + `photosSearchMoreResultsCount`(`{count}`),`@click` → `emit('update:moreExpanded', !moreExpanded)`)+ `v-if="moreExpanded"` 的第二个 `.grid` → `v-for more` 出 tile + `v-if="showSentinel"` 的 `.load-more-sentinel`(`ref="sentinelRef"`,内含 `v-if="loadingMore"` 的 `.load-more-status`(`photosSearchLoadingMore`))。
   - **两个 grid 的 tile 标记完全相同 ⇒ 抽成组件内的一个小 `<template>` 片段还是重复写?** Vue2 是**重复写了两遍**(`:243-250` 与 `:261-268`)。**New-UI 抽成一个内部子组件 `SearchTile`(同文件内 `defineComponent` 或单独文件)** —— 重复 8 行标记两遍是真重复,且 P6b 已有「漏渲染是最高频缺陷」的教训,两份容易漂。**偏离登记(结构去重,视觉 1:1)。** 抽成**同目录独立文件 `SearchResultTile.vue`** 更利于测试。
5. **tile 结构**(照 `:243-250` 逐元素):`.tile`(`@click` → `emit('open', r.p)`)含:
   - `<img :src="thumbnailUrl(r.p.id, 'small')" loading="lazy">`
   - `.tile-overlay`
   - `.type-badge`(`:data-type="r.p.isVideo ? 'video' : r.p.hasOcr ? 'ocr' : 'photo'"`,文案对应三键)
   - `v-if="r.p.matchedBy === 'ocr'"` → `.match-source`(`photosSearchTextMatch`);`v-else-if="r.score != null"` → `.match-score`(`{matchPct(r.score)}%`)
   - `v-if="r.p.fav"` → `.tile-fav`(star 图标 13px)
   - **四个徽标全压在照片上 ⇒ 前景钉死浅色 + `theme-exception`,禁 `--on-accent`。** `.type-badge` 的三种底色(Vue2 `scss:2768-2770` 是写死的青/橙/翠绿)⇒ **这是数据可视化类别色,按 THEMING.md 第三类例外处理**(照 `PLACE_PALETTE` 与地图预设的先例):新增三个 token(`--badge-photo` / `--badge-video` / `--badge-ocr`)**两套主题都给值** + 进 THEMING.md。**不要就近取 accent/danger 凑** —— 它们是三个并列的类别标识。
   - **收藏星的黄色**:Vue2 `:249` 是内联 `color="#FFD60A"`。**先 grep `PhotosGrid.vue` 里星标用的 token 并复用**(P3 建的),不要另造。
6. **`.grid` 的列宽**:Vue2 全局 `.grid[data-density]` 在 `photos.scss` 里(**先回源找到那段,照搬三档的 `grid-template-columns`**);本仓 `PhotosGrid.vue` 也有 density 实现 ⇒ **优先复用 `PhotosGrid` 里的那套列宽数值**(同区视觉一致),并在注释里说明取自哪里。**本组件不接 density prop**(搜索结果 Vue2 写死 `comfortable`,照搬)。

- [ ] **Step 1: 写失败测试**

`useInfiniteScroll.test.ts`(stub IO):
- `enabled: true` + target/root 都有 → `observe` 被调一次,构造参数含 `{ root, rootMargin: '200px 0px' }`。
- 手动触发回调 `isIntersecting: true` → `onHit` 被调;`false` → 不调。
- `enabled` 变假 → `disconnect` 被调、`observe` 不再新增。
- `target` 从 null 变有值 → 才 observe(**首帧 target 为 null 的场景**)。
- `enabled` 反复 true/false/true → 每次重挂前都 disconnect(**无泄漏**:`observe` 与 `disconnect` 调用次数配平)。
- 组件卸载 → `disconnect` 被调。
- `rootMargin` 可覆写。

`PhotosSearchGrid.test.ts`:
- `best` 3 条 → 第一个 `.grid` 下 3 个 `.tile`;`more` 为空 → **无** `.more-results-bar`、无第二个 grid。
- `more` 2 条 + `moreExpanded: false` → 有折叠条(文案含 `2`)、**无**第二个 grid、**无** sentinel;点折叠条 → `update:moreExpanded` 带 `true`。
- `moreExpanded: true` → 第二个 grid 有 2 个 tile。
- `showSentinel: true` + expanded → sentinel 在;`showSentinel: false` → **不在**(**v-if 卸载才是拆 observer 的手段**);`loadingMore: true` → `.load-more-status` 在。
- tile 徽标四态:纯照片 → `data-type="photo"`;`isVideo` → `video`;`hasOcr` → `ocr`;`isVideo` 与 `hasOcr` 同真 → **`video` 胜出**(三元顺序);`matchedBy: 'ocr'` → 出 `.match-source` 且**无** `.match-score`;`matchedBy: 'semantic'` + `score: 0.87` → `.match-score` 文本 `87%`;`score: null` → 两者都无;`fav: true` → `.tile-fav` 在。
- 点 tile → `open` 带 `r.p`。
- `thumbnailUrl` 参数是 `(id, 'small')`。
- 前景色合规:四个徽标类所在规则不含 `--on-accent`;钉死色声明各有紧贴的 `theme-exception`;注释文本不含 `;` / `}` / 字面 `#`。
- 三个 badge token 在样式里被引用(`--badge-photo` / `--badge-video` / `--badge-ocr`),**且 THEMING.md 里能查到这三行**(读 `docs/THEMING.md` 的文本 —— **它是 `.md` 不是 `.css`,`?raw` 可用;但仍要先断言文本非空**)。
- `.match-badge` **不在**样式块里(死 CSS 未迁的反向断言)。
- 滚动容器:`.photos-wrap` 规则体含 `overflow-y: auto`(先锚定规则体)。

- [ ] **Step 2: 跑测试确认失败**

- [ ] **Step 3: 实现(含新增三个 badge token 两套主题 + THEMING.md 登记)**

- [ ] **Step 4: 跑全量 + tsc + color-guard,逐个删码验证**

删码清单:①`useInfiniteScroll` 的 teardown-before-observe → 「无泄漏」用例红;②`isIntersecting` 判断 → false 也触发用例红;③`showSentinel` 的 `v-if` → sentinel 卸载用例红;④`data-type` 三元顺序调换 → 「video 胜出」用例红;⑤`matchedBy === 'ocr'` 的 `v-if`/`v-else-if` 换成两个独立 `v-if` → 「ocr 时无 match-score」用例红;⑥`thumbnailUrl` 的 `'small'` 改 `'large'` → 参数用例红;⑦任一 badge token 换成字面色值 → color-guard 红。

- [ ] **Step 5: Commit**

```bash
git add src/photos/composables/useInfiniteScroll.ts src/photos/components/PhotosSearchGrid.vue src/photos/components/SearchResultTile.vue src/photos/composables/__tests__/ src/photos/components/__tests__/ src/styles/theme.css docs/THEMING.md
git commit -m "feat(photos): P7a-T15 搜索结果双档网格 + 无限滚动 sentinel + 三个类别色 token"
```

---

