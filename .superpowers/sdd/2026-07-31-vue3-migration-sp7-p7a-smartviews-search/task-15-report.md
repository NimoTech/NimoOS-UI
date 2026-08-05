# Task 15 报告:`useInfiniteScroll.ts` + `PhotosSearchGrid.vue`

## 实现内容

- `src/photos/composables/useInfiniteScroll.ts`(新)——无限滚动 sentinel 的
  IntersectionObserver 封装。
- `src/photos/components/SearchResultTile.vue`(新)——搜索结果单个瓦片(结构去重,
  Vue2 里同样 8 行标记重复写了两遍,本仓抽成独立组件,两个网格共用)。
- `src/photos/components/PhotosSearchGrid.vue`(新)——搜索结果双档网格(最佳匹配 +
  折叠长尾)+ sentinel 接线。
- `src/styles/theme.css`——新增三个 badge 类别色 token(`--badge-photo`/
  `--badge-video`/`--badge-ocr`),两套主题块同值。
- `docs/THEMING.md`——§6 例外清单补一行,登记这三个 token 的性质与理由。
- 测试:`useInfiniteScroll.test.ts`(8 例)、`SearchResultTile.test.ts`(22 例)、
  `PhotosSearchGrid.test.ts`(20 例),共 50 个新测试用例。

## 最终接口签名

```ts
// useInfiniteScroll.ts
export interface UseInfiniteScrollOptions {
  target: Ref<HTMLElement | null>
  root: Ref<HTMLElement | null>
  enabled: Ref<boolean>
  onHit: () => void
  rootMargin?: string          // 默认 '200px 0px'
}
export function useInfiniteScroll(opts: UseInfiniteScrollOptions): void
```

```ts
// PhotosSearchGrid.vue
defineProps<{
  best: ScoredPhoto[]
  more: ScoredPhoto[]
  moreExpanded: boolean
  showSentinel: boolean
  loadingMore: boolean
}>()
defineEmits<{
  (e: 'open', photo: Photo): void
  (e: 'update:moreExpanded', v: boolean): void
  (e: 'load-more'): void
}>()
```

```ts
// SearchResultTile.vue(结构去重新增,brief 未列出接口但 T16 若要单独用需要知道)
defineProps<{ result: ScoredPhoto }>()
defineEmits<{ (e: 'open', photo: Photo): void }>()
```

与 brief 冻结接口完全一致(`ScoredPhoto`/`Photo` 类型来自 T10 的 `util/searchSort.ts`
与既有的 `util/assetToPhoto.ts`,未新增/未改动)。

## 渲染项清单对照(Vue2 `PhotosSearchView.vue:241-279` 逐项 → New-UI 落点)

| Vue2(行号) | 内容 | New-UI 落点 |
|---|---|---|
| :241 `.photos-wrap.scroll`(内联 `flex:1;padding-top:0`) | 滚动容器 | `PhotosSearchGrid.vue` 根 `.photos-wrap`(`ref="rootRef"`),`flex:1;overflow-y:auto` 写进 scoped CSS(D7) |
| :242 `.grid[data-density=comfortable]`(内联 `padding:0 32px 40px`) | 最佳匹配网格容器 | 第一个 `.grid`,恒渲染,`padding` 折进 scoped 规则(视觉等价,非偏离) |
| :243-250 tile 标记(img/overlay/type-badge/match-source|match-score/tile-fav) | 单个瓦片 | 抽成 `SearchResultTile.vue`,`v-for="r in best"` |
| :255 `v-if="moreTierResults.length"` | 长尾整段门控 | `<template v-if="more.length">` |
| :256-259 `.more-results-bar`(chevD/chevR + 文案) | 折叠条 | `<button class="more-results-bar">` + 内联 svg(chevD/chevR)+ `t('photosSearchResultsCount', {count})` |
| :260 第二个 `.grid`(`v-if="moreExpanded"`) | 长尾网格 | 第二个 `.grid`,`v-if="moreExpanded"` |
| :261-268 tile 标记(与 :243-250 逐字重复) | 长尾瓦片 | 同一个 `SearchResultTile.vue`,`v-for="r in more"`(结构去重,偏离登记见下) |
| :275-277 `.load-more-sentinel` + `v-if="searchLoadingMore"` 的 `.load-more-status` | sentinel | `v-if="showSentinel"` 的 `.load-more-sentinel`(`ref="sentinelRef"`)+ 内含 `v-if="loadingMore"` 的 `.load-more-status` |

**校验方式**:逐项对照后确认无遗漏;`PhotosSearchGrid.test.ts` 的 "样式" 与结构分组
测试各自锚定了每一项(best 计数 / more 计数 / 折叠条文案 / sentinel v-if / loadingMore
v-if)。

## 两条腿审计(逐条声明粒度,`photos.scss :2711-2772`,跳过 `:2728-2738` 死 CSS)

| 选择器/声明 | 内联 style 契约 | scss 规则 | 落点 | 备注 |
|---|---|---|---|---|
| `.more-results-bar` | — | `:2711-2717` 全部声明(display/gap/margin/padding/border-radius/border/background/color/font-size/font-weight/cursor) | `PhotosSearchGrid.vue` `.more-results-bar` | token 映射:`--surface-2→--chip-bg`/`--line→--card-border`/`--text-2→--fg-muted` |
| `.more-results-bar:hover` | — | `:2718` background/color | 同上 `:hover` | `--surface-3→--chip-bg-hi`/`--text-1→--fg`;`winningHoverBackground` 断言选择器含 `:hover` |
| `.load-more-sentinel` | — | `:2722-2725` display/align/justify/height/margin/padding | `PhotosSearchGrid.vue` `.load-more-sentinel` | 无颜色,直接照搬 |
| `.load-more-status` | — | `:2726` font-size/font-weight/color | 同上 | `--text-3→--fg-faint` |
| `.match-badge` + 4 变体 | — | `:2728-2738` | **不迁(死 CSS)** | D6 核实:搜索模板零消费,反向断言 `.match-badge` 不在样式块里 |
| `.match-score` | — | `:2739-2743` position/font-size/font-variant-numeric/color/font-weight/background/padding/border-radius/z-index | `SearchResultTile.vue` `.match-score` | `color:white`、`background:rgba(0,0,0,0.6)` 各自 theme-exception |
| `.match-source` | — | `:2751-2758` position/font-size/font-weight/color/letter-spacing/text-transform/background/backdrop-filter/padding/border-radius/z-index/box-shadow | `SearchResultTile.vue` `.match-source` | **回源核对新发现**(见下节):底色不是 `.type-badge[ocr]` 同一个绿,保持独立字面量 |
| `.type-badge` 基类 | — | `:2761-2767` position/padding/border-radius/font-size/font-weight/color/z-index/text-transform/letter-spacing/backdrop-filter/box-shadow | `SearchResultTile.vue` `.type-badge` | D3 逐条核对:`text-transform`/`letter-spacing`/`font-weight:700`/`backdrop-filter`/`box-shadow` 全部落地,程序化断言钉住 |
| `.type-badge[data-type="photo"/"video"/"ocr"]` | — | `:2768-2770` | 同上,三个变体 | 改用新增 token `--badge-photo`/`--badge-video`/`--badge-ocr`(D9) |
| `.tile`(`photos.scss:112-116`,不在 `:2711-2770` 区间但结构规格要求) | — | position/aspect-ratio/overflow/border-radius/background/cursor/isolation | `SearchResultTile.vue` `.tile` | `--surface-2→--chip-bg`;不接 loose 变体(本组件无 loose 概念) |
| `.tile img` / `.tile:hover img`(`:117-118`) | — | width/height/object-fit/display/transition;hover transform | 同上 | 逐条保留,含 `filter 0.2s ease`(虽当前无触发场景,1:1 保留声明) |
| `.tile-overlay` / `.tile:hover .tile-overlay`(`:334-340`) | — | position/inset/background(渐变)/opacity/transition/z-index/pointer-events | `SearchResultTile.vue` `.tile-overlay` | 渐变字面量 theme-exception;程序化断言锚定规则体核对 opacity/transition/z-index/pointer-events |
| `.tile-fav`(`:357-360`) | Vue2 模板内联 `color="#FFD60A"` | position/z-index/color/filter | `SearchResultTile.vue` `.tile-fav` | D5 裁定:改用 `var(--star-fg, #ffd60a)`,不照抄内联 prop + CSS `color:white` 两层叠加 |

## 新增的三个 token

| Token | `:root`(蓝) | `:root[data-theme="light"]`(白) | THEMING.md 落点 |
|---|---|---|---|
| `--badge-photo` | `rgba(50, 190, 230, 0.9)` | 同值 | §6 例外清单新增一行 |
| `--badge-video` | `rgba(255, 149, 10, 0.92)` | 同值 | 同上 |
| `--badge-ocr` | `rgba(16, 185, 129, 0.92)` | 同值 | 同上 |

两套主题块给同一个值(精确复刻 Vue2 字面量,theme-invariant,同 `--place-current-trip`/
`--console-bg` 的既有先例)——不随皮肤深浅变化,因为它们是叠在照片缩略图上的**类别标识**,
不是主题皮肤色。`theme.css` 编辑位置:`:root` 块 `--warn-border` 之后、`--console-bg` 之前
(两处均已同步)。

## 回源核对结果

| brief 断言 | 源码真值 | 符/不符 |
|---|---|---|
| D1 三个 i18n 键名 | 全部 grep 核实存在(`photosSearchLoading`/`photosSearchResultsCount`/`photosSearchBadgePhoto`/`photosSearchBadgeVideo`/`photosSearchTypeOcr`/`photosSearchTextMatch`) | 符,零新增键 |
| D2 `.grid` 列宽二选一冲突 | 已按裁定采用 PhotosGrid.vue 默认(comfortable)自适应列宽 | 已裁定,见偏离登记 |
| D3 `.type-badge` 基类行号 `2760-2767` | 实测基类是 `2761-2767`(brief 原文 2760-2767 差 1 行,已用实测行号) | 基本符,行号差 1 |
| D3 三变体行号 `2770-2772` | 实测是 `2768-2770` | **不符**——brief 行号偏移了 2 行,已用实测值 |
| D4 `.match-source` 与 `.type-badge[ocr]` "同一个翠绿" | **不符**——实测两者字面量不同:`.match-source` 是 `rgba(52,199,89,0.85)`,`.type-badge[data-type="ocr"]` 是 `rgba(16,185,129,0.92)`;且 Vue2 源码在 `.match-source` 上方紧邻的注释(`:2744-2750`)明确写着 "Deliberately styled distinctly from the top-left .type-badge... **different color family**" —— 两者故意不同色,不是同一个绿 | **新发现的 brief 错误**,已按查实结果实现(两个独立 theme-exception 字面量,不合并成同一 token) |
| D4 `.match-source` 行号 `2752-2758` | 实测是 `2751-2758` | 基本符,行号差 1 |
| D6 `.match-badge` 死 CSS | 核实:模板(`:241-279`)确实零消费 `.match-badge`,只消费 `.match-score`/`.match-source` | 符 |
| D7 `.scroll` 定义 | 核实:`photos.scss:98` 确为 `overflow-y: auto`(全局工具类,本仓不存在) | 符 |
| D9 `--star-fg` 在 theme.css 零命中 | 核实:grep 确认无任何 `:root`/`[data-theme]` 块定义它,`var(--star-fg, #ffd60a)` 恒吃 fallback | 符,按控制器裁定不修 `PhotosGrid.vue`,报告里登记范围外观察(见下) |
| D9 `--badge-photo/video/ocr` 在 theme.css 零命中(新增前) | 核实 | 符 |

## 偏离登记

1. **列宽策略(D2,最重要一条)**:Vue2 `photos.scss:318`(comfortable 密度)是固定
   `grid-template-columns: repeat(7, 1fr); gap: 3px`。本仓改用 `PhotosGrid.vue:372`
   的默认(comfortable)规则:`repeat(auto-fill, minmax(140px, 1fr)); gap: 4px`(自适应
   列宽,非固定列数)。理由:①同区视觉一致优先(P3 已为整个相册区的 `.grid` 做过这个
   决定,搜索结果页不该单独开倒车用一套不同的布局策略)②这是控制器基于 brief 自相矛盾
   两条指示做出的裁定,非漏做。代码注释:`PhotosSearchGrid.vue` script 顶部(D2 段)与
   `.grid` 规则正上方各一处。测试:`PhotosSearchGrid.test.ts` "两条腿审计" 分组里的
   `.grid` 规则体断言钉住 `repeat(auto-fill, minmax(140px, 1fr))` + `gap: 4px`(不是
   `repeat(7, 1fr)`)。

2. **结构去重(SearchResultTile.vue 独立文件)**:Vue2 把 tile 的 8 行标记
   (`:243-250` 与 `:261-268`)逐字重复写了两遍。本仓抽成独立组件 `SearchResultTile.vue`,
   两个网格(best/more)各自 `v-for` 消费同一份实现。理由:P6b 教训"漏渲染是最高频缺陷",
   两份重复标记比单一组件更容易顾此失彼(改一处忘改另一处)。视觉逐元素 1:1,只是结构
   组织方式不同。代码注释:`SearchResultTile.vue` 顶部注释、`PhotosSearchGrid.vue` 顶部
   渲染项清单注释。

3. **收藏星颜色来源(D5)**:Vue2 `:249` 是内联 `photos-icon` 组件的 `color="#FFD60A"`
   prop(即 SVG `fill` 属性直接写死十六进制),CSS `.tile-fav` 另有 `color: white`(对
   `fill` 无实际影响,因为 fill 已被内联 prop 覆盖)。本仓没有 `PhotosIcon` 组件(全区
   内联 `<svg>` 既定做法),改用 `PhotosGrid.vue:395` 已建立的
   `color: var(--star-fg, #ffd60a)` 回落写法 + svg `fill="currentColor"`。理由:同一
   收藏星语义在同一相册区应该走同一套写法,不新造第二套"内联字面色"方案。代码注释:
   `SearchResultTile.vue` 顶部脚本注释 + `.tile-fav` 规则正上方。

4. **`.match-source` 底色不复用 `--badge-ocr`(回源核对纠正的偏离——纠正的是 brief,
   不是 Vue2)**:brief D4 断言两者"同一个翠绿",回源核实为假(见上节"回源核对结果"),
   Vue2 源码自己的注释明确说两者"故意不同色"。若按 brief 错误断言合并成同一个 token,
   会引入一个 Vue2 从未有过的视觉变化(改变 `.match-source` 的实际显示颜色)。本实现
   保持两者各自独立的固定字面量,不合并。代码注释:`SearchResultTile.vue` 顶部 + 
   `.match-source` 规则正上方,均说明"回源核对新发现"。

5. **`useInfiniteScroll` 的 `watch` 加 `immediate: true`(brief 结构规格只写
   `{ flush: 'post' }`,未提 immediate)**:Vue2 原 watcher(`:607-610`)监听
   `showLoadMoreSentinel`,该值恒从 `false` 起步(依赖 `moreExpanded`,初始必为
   false),"挂观察器"永远发生在一次真实的 false→true 变化里,天然不需要 immediate。
   但本 composable 是通用件,不能假设调用方传入的 `enabled`/`target` 初始状态——若
   两者在 setup 时已就绪(如测试直接构造好的场景),不给 immediate 会导致 `sync()`
   从未运行、`observe` 永远不会被调用,与"结构规格 A.1"要求的"enabled=true 且
   target/root 都有值 → observe 被调一次"矛盾。加 `immediate: true` 不改变真实宿主
   (`PhotosSearchGrid.vue`)的可观察行为——`showSentinel` 同样从 `false` 起步,首次
   运行只会命中"只 teardown"分支,是无副作用的空转。代码注释:`useInfiniteScroll.ts`
   顶部文档注释已说明。

## 删码验证清单

| 删了什么 | 结果 | 复原方式 |
|---|---|---|
| ①`sync()` 里的 `teardown()`(teardown-before-observe) | **红**——"enabled 变假"与"反复 true/false/true 无泄漏"两条用例失败 | Edit 手工切回 |
| ②IO 回调的 `if (entries[0].isIntersecting)` 判断(改成无条件调 onHit) | **红**——"isIntersecting:false → onHit 不被调"失败 | Edit 手工切回 |
| ③`.load-more-sentinel` 的 `v-if="showSentinel"` | **红**——"showSentinel:true/false" 两条用例均失败(true 时展开态但未加门控导致原本该在的还在——实际测出的是 false 场景「不在」断言失败,因为改动后恒渲染) | Edit 手工切回 |
| ④`badgeType` 三元顺序(hasOcr 判断挪到 isVideo 前面) | **红**——"isVideo 与 hasOcr 同真 → video 胜出"失败(拿到 ocr) | Edit 手工切回 |
| ⑤`matchedBy==='ocr'` 的 `v-else-if` 改成独立 `v-if` | **红**——"ocr 时无 match-score"失败(两者同时渲染) | Edit 手工切回 |
| ⑥`thumbnailUrl` 的 `'small'` 改 `'large'` | **红**——`SearchResultTile.test.ts` 与 `PhotosSearchGrid.test.ts` 的尺寸参数断言均失败 | Edit 手工切回 |
| ⑦`--badge-photo` token 换成字面量 `rgba(50,190,230,0.9)` | **红**——`color-guard.test.ts` 报裸颜色字面量 + `SearchResultTile.test.ts` 的 "三个 badge token 被引用" 断言均失败 | Edit 手工切回 |
| (追加)`more` 网格的 `SearchResultTile` 漏绑 `@open` | **红**——新增测试"点击 more 网格里的 tile → emit open"失败(emitted 为 undefined) | Edit 手工切回 |

全部一次一处、验完立即用 Edit 手工切回原状(未使用 `git checkout --`)。`diff` 核对最终
文件与验证前完全一致。

## 交接下游的事实(T16 需要知道)

- **`showSentinel` 怎么算**:本组件**不算**,只按 prop 值渲染/门控(`v-if="showSentinel"`)。
  T16 需在宿主里按 Vue2 `:413-415` 的逻辑算好再传入:
  `moreExpanded && !searchExhausted && more.length > 0`。
- **`load-more` 事件语义**:sentinel 一进入 `root`(即 `.photos-wrap`)视口
  (`rootMargin: '200px 0px'` 预取窗口)就直接 `emit('load-more')`,**本组件不做任何
  防抖/节流**——节流完全依赖 T11 store 的 `loadingMore`/`exhausted` 入口短路(D8)。
  T16 的宿主监听 `@load-more` 时应直接调 `store.loadMore()`,不要再包一层守卫。
- **tile 的 `open` 事件**:两个网格(best/more)都会 emit `('open', photo: Photo)`,
  T16 监听 `@open` 后应按 Vue2 `openResult(p)`(`:724`)的逻辑打开 lightbox,并且
  lightbox 的图片列表应是"当前过滤后的结果集"（Vue2 注释原话:"scoped to the current
  filtered+sorted result set so prev/next navigates search hits, not the whole
  library"）。
- **`update:moreExpanded`**:本组件用 `v-model:moreExpanded` 惯用法(emit 时机=点击
  折叠条),T16 宿主应该用 `v-model:moreExpanded="moreExpanded"` 接住,而不是手动
  监听 `@update:moreExpanded`(虽然两种写法在 Vue3 里等价,但前者更符合本仓其他组件的
  既定风格)。
- **`--star-fg` 范围外观察**(不在本任务修复范围,交给控制器 triage):`--star-fg` 在
  `theme.css` 的两套主题块里都没有定义,`PhotosGrid.vue`/`SearchResultTile.vue` 里所有
  `var(--star-fg, #ffd60a)` 用法永远吃 fallback 字面量,等同于没有走主题切换。这是 P3
  遗留的既有问题,本任务照抄先例保持全区一致,未修复,仅登记。

## 测试与结果

- `useInfiniteScroll.test.ts`:8 例(observe 调用/参数、isIntersecting 真假分支、
  enabled 变假断开、target null→有值、反复 true/false/true 无泄漏、卸载断开、
  rootMargin 可覆写)。
- `SearchResultTile.test.ts`:22 例(四态徽标三元顺序、match-source/match-score 互斥、
  收藏星、点击 emit、thumbnailUrl 参数、img lazy/alt、i18n 英文文案、样式两条腿审计
  含 theme-exception 三禁 + 死 CSS 反向断言)。
- `PhotosSearchGrid.test.ts`:20 例(best/more 计数、折叠条文案与点击、moreExpanded 双向、
  sentinel v-if 门控、loadingMore 文案、IO 触发 load-more、两个网格各自的 open 透传、
  thumbnailUrl 尺寸口径、`.photos-wrap`/`.grid`/`.more-results-bar:hover`/死 CSS 样式
  断言)。

全量:`pnpm exec vitest run` → **313 files / 3579 tests passed**(含本任务新增 50 例)。
`pnpm exec vue-tsc --noEmit` → 无输出,通过。

## TDD Evidence

### RED

```
$ pnpm exec vitest run src/photos/composables/__tests__/useInfiniteScroll.test.ts
 FAIL  src/photos/composables/__tests__/useInfiniteScroll.test.ts [ ... ]
Error: Failed to resolve import "../useInfiniteScroll" from
"src/photos/composables/__tests__/useInfiniteScroll.test.ts". Does the file exist?
 Test Files  1 failed (1)
      Tests  no tests
```
预期红:模块文件尚未创建,导入解析失败——不是断言失败,是"功能缺失"的正确失败原因。

```
$ pnpm exec vitest run src/photos/components/__tests__/SearchResultTile.test.ts
Error: Failed to resolve import "../SearchResultTile.vue" ...
 Test Files  1 failed (1)
      Tests  no tests
```

```
$ pnpm exec vitest run src/photos/components/__tests__/PhotosSearchGrid.test.ts
Error: Failed to resolve import "../PhotosSearchGrid.vue" ...
 Test Files  1 failed (1)
      Tests  no tests
```

### GREEN

```
$ pnpm exec vitest run src/photos/composables/__tests__/useInfiniteScroll.test.ts
 Test Files  1 passed (1)
      Tests  8 passed (8)

$ pnpm exec vitest run src/photos/components/__tests__/SearchResultTile.test.ts
 Test Files  1 passed (1)
      Tests  22 passed (22)

$ pnpm exec vitest run src/photos/components/__tests__/PhotosSearchGrid.test.ts
 Test Files  1 passed (1)
      Tests  20 passed (20)

$ pnpm exec vitest run
 Test Files  313 passed (313)
      Tests  3579 passed (3579)

$ pnpm exec vue-tsc --noEmit
(无输出,exit 0)
```

中途还各修了一次实现内的过程性 RED(非 TDD 意义上的首轮红,而是实现完成后自查发现的
测试断言/实现细节问题,均已收敛):
- `SearchResultTile.test.ts` 的 theme-exception 注释断言首次跑红(`extractStyleBlock`
  会剥注释,该测试却要检查注释本身内容),改用不剥注释的本地 `rawStyleBlock` 助手函数
  后收敛为绿。
- 同一测试的"注释紧贴声明"判定对多行 theme-exception 注释(`.tile-fav` 那条跨两行)
  误判,改成"先找注释块真正的 `*/` 收尾行,再看其后紧邻声明"后收敛为绿。
- `color-guard.test.ts` 全量跑时发现两处真实缺陷,均已修:①`SearchResultTile.vue`
  的一处**文档性**注释(不是声明豁免注释)里字面写了 `#FFD60A`,被 color-guard 当作
  裸颜色字面量报红——改成文字描述,不写字面十六进制。②`PhotosSearchGrid.vue` 的一处
  脚本注释里写了字面的 `<style>` 三个字("见下方 <style>"),触发 Minor 11 的"假开标签"
  防护测试——改成"见下方样式块"。这两处修复后全量 color-guard 454 例全绿。

## Files changed

- 新增:`src/photos/composables/useInfiniteScroll.ts`
- 新增:`src/photos/composables/__tests__/useInfiniteScroll.test.ts`
- 新增:`src/photos/components/SearchResultTile.vue`
- 新增:`src/photos/components/__tests__/SearchResultTile.test.ts`
- 新增:`src/photos/components/PhotosSearchGrid.vue`
- 新增:`src/photos/components/__tests__/PhotosSearchGrid.test.ts`
- 修改:`src/styles/theme.css`(新增三个 badge token,两套主题块)
- 修改:`docs/THEMING.md`(§6 例外清单新增一行)

## Self-review 发现

- 渲染项清单逐项对照:已完成,见上表,无遗漏。
- 逐条声明级两条腿审计:已完成,见上表,`:2728-2738` 明确标注未迁 + 反向断言钉住。
- 每处偏离双处登记(代码注释 + 报告):5 条偏离均已在代码里找到对应行注释,报告里
  逐条列出。
- 每条断言的区分力:全部经过至少一次"删码验证"或"手动 mutation"确认能变红(见删码
  验证清单,共 8 条,含追加的 more 网格 `@open` 绑定测试)。
- IntersectionObserver stub:两个测试文件都在 `afterEach` 里 `delete
  globalThis.IntersectionObserver`,已确认全量跑(313 files)不受渗漏影响。
- 测试输出无噪声:本任务新增的三个测试文件单独跑无 warning/error 输出;全量跑时的
  jsdom "Not implemented: navigation" 噪声来自既有的 `favorites.test.ts`(与本任务
  无关,baseline 即有)。

## Concerns

- `--star-fg` 无主题块定义(范围外观察,已在上文"交接下游的事实"登记,建议控制器
  安排单独任务补齐或明确保留现状)。
- `PhotosSearchGrid.vue` 未接 `density` prop(按 D2/结构规格 6 的裁定,Vue2 搜索结果
  写死 comfortable,本组件同样写死,不是遗漏)。

---

# Fix Round 1(评审回合:Spec ❌,0 Critical + 2 Important + 6 Minor,并入 5 条 Minor 共处理 7 项)

## 处理清单与改动

| 编号 | 问题 | 改法 | 文件 |
|---|---|---|---|
| I1 | 三枚 glyph(chevD/chevR/star)的 `d` 属性从未被断言,评审变异改坏两处仍 50 例全绿 | 补 3 条断言:chevD/chevR 各在 `moreExpanded` 两态下断一次,star 在 `fav:true` 下断一次,均逐字符核对 `PhotosIcon.vue` 对应分支 | `PhotosSearchGrid.test.ts`、`SearchResultTile.test.ts` |
| I2 | brief:81 明文要求的 "THEMING.md 里能查到这三行" 断言不存在 | 补 `themingDocRaw`(`?raw` 导入 `docs/THEMING.md`)先断言非空、再对三个 token 名各断一次 `toContain` | `SearchResultTile.test.ts` |
| M-1 | `.photos-wrap` 漏了 `position: relative`(D7 原文不完整,漏引 `photos.scss:300`),滚动条隐藏写法未落地 | 补 `position: relative`;滚动条隐藏改用本仓既定惯例 `display:none`(+`scrollbar-width:none`),不是 Vue2 字面 `width:0`(先例 `PhotosGrid.vue:420`/`PhotoFilmstrip.vue:148`);两条各配一条锚定规则体的断言 | `PhotosSearchGrid.vue` + `PhotosSearchGrid.test.ts` |
| M-2 | 测试标题承诺"不含 `;`/`}`/字面 `#`"但只断言了两条 | 补 `expect(commentBody).not.toContain('}')` | `SearchResultTile.test.ts` |
| M-3 | `.tile-fav` 规则上方注释自称"字面色值见 script 注释里的**文字描述**",但那两处其实就是字面十六进制,自述失实 | 改成准确表述(script 注释里是字面色值本身,不是文字转述) | `SearchResultTile.vue` |
| M-4 | `data-density="comfortable"` 是死属性(样式块无任何 `[data-density]` 选择器消费) | 保留属性(1:1 DOM),补模板注释说明是死属性、非遗漏 | `PhotosSearchGrid.vue` |
| M-5 | `.tile` 用了 Vue2 字面的 `border-radius:3px`,与同区 `PhotosGrid.vue` 的 8px 不一致 | 改成 8px(理由与 D2 同源),补一条锚定规则体的断言 | `SearchResultTile.vue` + `SearchResultTile.test.ts` |

**不用改的两条**:M-6(`root` 不在 `watch` 源里——brief 明文如此,挂账给终审,本轮不动)、
script 注释里的四个字面色值(M-3 澄清后确认合法保留,T3 既定规则:`<script>` 注释不受
color-guard 扫描)。

## 回源核对补充(控制器台账三处更新)

- **D4 全错,已由评审二次核实并查出我方根因**:控制器把 `.match-badge[data-kind="ocr"]`
  (`photos.scss:2736`,死 CSS)与 `.type-badge[data-type="ocr"]` 看混了——`.match-badge`
  的 ocr 变体才是 `rgba(52,199,89,0.85)`,与 `.match-source` 同值;`.type-badge` 的 ocr
  变体是 `rgba(16,185,129,0.92)`,两者本就不同。我方 T15 首轮的处置(保持 `.match-source`
  独立字面量,不合并成 `--badge-ocr`)是正确的,继续保持不变。
- **D3 行号偏移已确认**:`.type-badge` 基类真值 `:2761-2767`(`:2760` 是注释行),三变体
  真值 `:2768-2770`(不是控制器写的 `:2770-2772`,那已越界进 `.empty-search`)。brief
  Files 段给的 `:2711-2770` 反而是准的。本轮未改动任何行号引用(首轮报告已用实测值,
  与评审复核结果一致)。
- **D7 不完整,直接导致 M-1**:控制器的 "Vue2 靠全局 .scroll(只有 overflow-y:auto)" 漏了
  `photos.scss:300-301` 的 `.photos-root .photos-wrap { overflow-y: auto; position:
  relative; }` + `::-webkit-scrollbar { width: 0; }`。已在 `PhotosSearchGrid.vue` 补全
  并更新 D7 注释本身的措辞。

## 删码/变异验证(每条一次一处,Edit 手工还原,禁 `git checkout --`)

| 项 | 变异 | 结果 | 复原 |
|---|---|---|---|
| I1(chevD) | `PhotosSearchGrid.vue` chevD 的 `d` 末位 `6-6`→`6-5` | **红**——"moreExpanded:true → chevD 的 path d…" 用例失败(`Expected "m6 9 6 6 6-6"`,`Received "m6 9 6 6 6-5"`) | Edit 切回 |
| I1(star) | `SearchResultTile.vue` star 的 `d` 末位 `6-.9z`→`6-.8z` | **红**——"fav: true → star 的 path d…" 用例失败 | Edit 切回 |
| I2 | 删除 `docs/THEMING.md` 里三个 badge token 那一整行 | **红**——"docs/THEMING.md 能查到三个 badge token…" 用例失败(`toContain('--badge-photo')` 落空) | Edit 切回,`git diff docs/THEMING.md` 核对为空确认逐字节还原 |
| M-1(a) | `.photos-wrap` 删掉 `position: relative;` | **红**——".photos-wrap 规则体含 overflow-y: auto / position: relative…" 用例失败 | Edit 切回 |
| M-1(b) | 删掉 `.photos-wrap::-webkit-scrollbar { display: none; }` 整条规则 | **红**——".photos-wrap::-webkit-scrollbar 规则体含 display: none…" 用例失败(`未找到规则体`) | Edit 切回 |
| M-2 | 在 `.tile-fav` 的某条 theme-exception 注释文本里插入一个 `}` 字符 | **红**——"每个 theme-exception 注释紧贴…" 用例失败(`expected … not to contain '}'`),证明新断言真的有区分力(此前同一处插入不会被任何既有断言抓到) | Edit 切回 |
| M-5 | `.tile` 的 `border-radius` 从 8px 改回 Vue2 字面的 3px | **红**——".tile 规则体的 border-radius 是 8px…" 用例失败 | Edit 切回 |

全部经 `diff /tmp/*.bak2 <file>` 核对,变异测试结束后文件与修复完成态逐字节一致。

## 命令与真实输出(本轮 fix 完成后,当次实跑抓取)

```
$ pnpm exec vitest run src/photos/composables/__tests__/useInfiniteScroll.test.ts src/photos/components/__tests__/SearchResultTile.test.ts src/photos/components/__tests__/PhotosSearchGrid.test.ts

 Test Files  3 passed (3)
      Tests  56 passed (56)
   Duration 935ms
```

```
$ pnpm exec vitest run
 Test Files  313 passed (313)
      Tests  3585 passed (3585)
   Duration 63.87s
```

```
$ pnpm exec vue-tsc --noEmit
TSC_EXIT=0
```

```
$ pnpm exec vitest run src/styles/color-guard.test.ts
 Test Files  1 passed (1)
      Tests  454 passed (454)
   Duration 1.22s
```

## 中途发现并修的两处过程性问题(本轮修复过程中自查发现,非评审提出)

在写 M-3 与 M-1 的注释时,两次意外把 color-guard 的两条护栏自己踩了一遍(均已修正,
纳入最终态,不是遗留问题):
1. M-3 的修正注释里为了说明"上一版说错了什么",直接引用了两个字面十六进制
   (`#FFD60A`/`#ffd60a`)——这正是 color-guard 报错的裸颜色字面量,改成不复述字面值
   的表述后收敛。
2. 同一段注释里写了字面的 `<script>` / `<style>` 三个字讨论"这段注释在哪个标签块内",
   触发 Minor 11 的假开标签防护测试——改成"脚本标签块"/"样式块"这类不构成标签的措辞
   后收敛。
两处都在改完后跑了 `color-guard.test.ts` 全量确认收敛(454/454),不是留到本报告才
发现的遗留缺陷。

## Files changed(本轮追加)

- 修改:`src/photos/components/SearchResultTile.vue`(M-3 注释表述、M-5 border-radius）
- 修改:`src/photos/components/PhotosSearchGrid.vue`(M-1 补全 `.photos-wrap`、M-4 死属性注释）
- 修改:`src/photos/components/__tests__/SearchResultTile.test.ts`(I1 star d 断言、I2 THEMING.md 断言、M-2 补 `}` 断言、M-5 border-radius 断言）
- 修改:`src/photos/components/__tests__/PhotosSearchGrid.test.ts`(I1 chevD/chevR d 断言、M-1 两条样式断言）

## Concerns(本轮新增/变化)

- 无新增阻塞项。M-6(root 不在 watch 源里)按控制器指示本轮不动,继续挂账给终审。
