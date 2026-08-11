# Task 3 报告 — 相册详情骨架换血 + 编辑态底部浮条

**Commit:** `953a6a9` refactor(photos): rebuild the album detail on the smart-view skeleton
**Status:** DONE_WITH_CONCERNS（功能完成、六项自检通过；两处「计划 vs 靶子」冲突按靶子实现并登记，
另有一处 ⋯ 菜单临时安家需要 Task 5 收口）

---

## 1. 实现了什么

### 删掉
| 对象 | 位置（改前） |
|---|---|
| `.album-hero` / `-bg` / `-back` / `-inner` / `-text` / `-badge` / `-sub` / `-actions` 整块模板 | 模板 `:522-629` |
| 上述全部 CSS（含 `.album-hero-title`、`.album-hero-title-input`、`.album-hero-actions .bar-btn`） | CSS `:838-904` |
| `coverBgImage` computed | 脚本 `:114-120` |
| `.album-toolbar` 整条横带模板 + `.album-toolbar-muted`/`-spacer`/`-group` 三条 CSS | 模板 `:631-686`、CSS `:949-952` |
| `.album-detail-body` 双栏容器 + 它的 CSS | 模板 `:692`、CSS `:977-981` |
| `.album-density` 三条 CSS（换成靶子的 `.density`） | CSS `:968-970` |
| `photosAlbumItemsShown` 的使用（与 header stats 字面重复） | 模板 `:632` |
| `photosItemsCount` / `photosAlbumLabel` 在本页的使用（hero 副行/徽章随 hero 一起走；`photosAlbumLabel` 由 Task 4 的 About·Type 行接手） | 模板 `:532`、`:551` |

`--album-cover-fallback` token **未删**：`grep -rn "album-cover-fallback" src` 确认
`src/views/PhotosAlbums.vue:986` 的 `.album-cover-fallback` 仍是消费者，`theme.css` 的定义原样保留。

### 建立
- `.sv-detail-bar`：左 `.back`（chevL svg + `photosAlbumBack`，`data-test="album-back"`），
  `.sv-detail-bar-spacer`，右 `photosDetailCreatedAt`（`createdLabel === DASH` 时整个 span 不渲染）
- `.sv-detail-layout` > `.sv-detail-main`（`.sv-header` + `.album-photos-wrap`）+ `aside.sv-detail-side`
- `.sv-header` > `.sv-header-text`（`h1`：`.sv-title` 可点改名 / `.sv-title-input` 编辑态 /
  `.sv-cond` 日期胶囊**同行**）+ `.sv-header-stats`（`<b>N</b> 项`，`videoCount > 0` 才出 `<b>M</b> 视频`）
- `.sv-actions`：`.group`「排序：」+ `.order-pill`（带 chevD）+ `.album-detail-actions-sep` +
  `.sv-action-btn` Edit·Done（`:data-open="edit"`）+ `.album-detail-actions-sep` + `.density` 二钮
  （comfort/compact 两个 rect 组 svg，照 Vue2 `PhotosIcon.vue` 的 `comfort`/`compact` path）
  - Sort 与 density 各自包在 `<template v-if="!edit">` 里，分隔线跟着各自那组走；Edit·Done 常驻
- `.sv-select-bar`（编辑态底部浮条）：`.group`（info svg + `editHintText`）+
  「从相册移除」（trash svg，保留 `:disabled="!selected.size || removing"` 重入守卫）+
  「添加照片」（upload svg）。CSS 自写一份，块头登记与 `PhotosSmartViewDetail.vue:1138-1144` 同源
- 加载骨架从「260px hero 形状块」改成 `.album-skel-bar` + `.album-skel-header`（真实到来的是顶栏 + 头部）

### E5 重锚（关键，无自动门可见）
改前两条以被删容器为锚：
```
.album-toolbar[data-edit="true"] ~ .album-detail-body .tile[data-cover="true"]::after { display: none; }
.album-toolbar[data-edit="true"] ~ .album-detail-body .tile { outline: 1px dashed var(--card-border); … }
```
改后（靶子 `photos.scss:3546`/`:3604` 的做法，标记打在网格容器自己身上
`<div class="album-photos-wrap" :data-edit="edit">`）：
```
.album-photos-wrap[data-edit="true"] .tile[data-cover="true"]::after { display: none; }
.album-photos-wrap[data-edit="true"] .tile { outline: 1px dashed var(--card-border); outline-offset: -1px; }
```

### 孤儿选择器 grep 结果（Step 3 要求）
```
$ grep -n "album-toolbar\|album-detail-body\|album-hero\|album-density\|coverBgImage\|photosAlbumItemsShown" src/views/PhotosAlbumDetail.vue
104:  // SP15-P2c Task 3: `coverBgImage` is gone with the cover hero it painted. …   ← 注释
527:  … The old .album-toolbar band and .album-detail-body wrapper are …            ← 注释
632:  … (.album-hero-actions) is deleted by this task, …                            ← 注释
697:  <!-- Grid. E5 re-anchor: the edit flag used to live on the deleted .album-toolbar, …  ← 注释
944:  /* Vue2 photos.scss:285-288. Replaces the pill-shaped .album-density … */     ← 注释
1068: `.album-toolbar[data-edit="true"] ~ .album-detail-body`. Both … are gone, …   ← 注释
```
**六处命中全部是登记注释，零条 CSS 规则、零处模板仍以这些类为锚。**

全仓侧（本文件之外）：
```
$ grep -rn "album-hero\|album-toolbar\|album-detail-body" src | grep -v PhotosAlbumDetail.vue
src/photos/components/PlaceDetailPanel.vue:46,337  ← 注释里把 .album-hero-bg::after 当 theme-exception 先例引用
src/photos/components/PersonHero.vue:58            ← 同上
```
**这两个文件是散文引用，不是选择器依赖**，先例本身在 git 历史里仍可查；**未改动它们**
（不属本任务范围，改无关文件违反 YAGNI）。已在下文「遗留」里挂账。

---

## 2. 与靶子/计划的冲突 —— 逐条说明照谁做的

### D1（重要）浮条的出现条件：**照靶子，不照计划**
- 计划/brief：「选中数为 0 时浮条不渲染（照 SV 详情既有行为）」，测试标题也写
  `shows the select bar only in edit mode with at least one selection`。
- 靶子 `33b05636:PhotosAlbumDetail.vue:326-327` 明写反话：
  > `edit=true 就浮出(不要求已有选中项,因为文案本身覆盖"未选中"态)`
  且 `v-if="edit"`。
- **取证判定：靶子对，计划错。** 两条硬证据：
  1. 浮条里的文案是 `selectedIds.length ? '{n} selected' : (sortBy==='manual' ? 'Click to select · Drag to reorder' : 'Click to select')`
     —— 「未选中」那两句**只在 0 选中时才可能显示**，按计划做就是永远显示不出来的死文案。
  2. 「添加照片」按钮也在浮条里。按计划做 ⇒ **空相册进编辑态永远点不到「添加照片」**，
     是功能性回归（而且本仓已有测试 `评审 Important 2 回归:空相册 edit 态下添加照片…` 正走这条路）。
  3. 本页 P4 期既有测试 `edit 态点瓦片 → … 移除按钮 disabled→可用` 断言的正是
     「进编辑态、还没选任何东西时移除按钮存在且 disabled」—— 按计划做这条测试无处安身。
- 落地：`v-if="edit"`，测试标题改为
  `shows the select bar in edit mode even before anything is selected`，测试体覆盖
  「非编辑态无浮条 → 进编辑态浮条出现且显示提示语 → 选中一张后显示计数」三段。

### D2 i18n 键：表里 6 个键**复用既有键，不新造**
计划 §i18n 表把 `photosSortLabel`/`photosSortManual`/`photosSortTaken`/`photosSortAdded`/
`photosDensityComfort`/`photosDensityCompact` 列为 T3/T6 的新键。实测这 6 个语义**本仓已全部存在且中文值逐字相同**：

| 表里的新键 | 本仓既有键 | zh 值 | 结论 |
|---|---|---|---|
| `photosSortLabel` | `photosAlbumSort` | 排序： | 复用（`PhotosAlbums.vue:304` 也在用，新造会永久重复） |
| `photosSortManual` | `photosAlbumSortManual` | 手动排序 | 复用 |
| `photosSortTaken` | `photosAlbumSortTaken` | 拍摄日期 | 复用 |
| `photosSortAdded` | `photosAlbumSortAdded` | 添加日期 | 复用 |
| `photosDensityComfort` | `photosDensityComfortable` | 舒适 | 复用（`PhotosToolbar.vue:50` 也在用） |
| `photosDensityCompact` | **就是既有键本身** | 紧凑 | 表里这一行本来就不是新键 |

真正新增的只有 3 个（值逐字取自计划表）：

| 键 | zh_cn | en_us |
|---|---|---|
| `photosDetailCreatedAt` | `创建于 {date}` | `Created {date}` |
| `photosDetailItems` | `项` | `items` |
| `photosDetailVideos` | `视频` | `videos` |

`photosDetailVideos`（'视频'/**'videos'**）与既有 `photosAlbumStatVideos`（'视频'/**'Videos'**）
英文大小写不同、语境不同（header stats 里跟在粗体数字后的小写词 vs 侧栏统计格标题），故未合并。

> **给 T6 的口信**：SV 详情侧请同样复用 `photosAlbumSort` / `photosAlbumSortTaken` /
> `photosDensityComfortable` / `photosDensityCompact`，只需新增 `photosSortScore`。
> 若 T6 坚持要 `photosSort*` 前缀，那是一次纯改名，须连本页一起改并让 T11 删旧键。

### D3 `--font-display` 不存在（brief 已预告，照做）
`.sv-header h1` 与 `.sv-title-input` 都不写 `font-family`，只带 28px/600/-0.02em，
input 另加 `--chip-bg` 底 + `--accent` 边框 + 8px 圆角 + `min-width: 300px`（靶子 `:56` 内联的其余属性）。

### D4 密度枚举保留 `'comfortable'`/`'compact'`（brief 已预告，照做），模板处写了登记注释。

### D5 排序下拉面板内部**未重做**（登记）
靶子的下拉是 `.albums-sort-menu`/`.albums-sort-item`（活动项带 ✓ 图标 + `.lbl`），
本仓是 P4 期建的 `.album-sort-menu`/`.album-sort-item`（活动项 `--accent-soft` 底）。
brief「这一步建立的」清单只点名 `Sort:` 文案 + `.order-pill` 胶囊 + 分隔线，**未提下拉内部**；
两种形态都在标记活动项，改它属于范围外且会波及 P4 期既有测试的 `data-test` 钩子。
**只把触发按钮从 `.bar-btn` 换成 `.order-pill`（带 chevD），下拉面板原样保留。**

### D6 ⋯ 菜单**临时安家在 `.sv-actions`**（需 Task 5 收口）
派工书说「Task 5 wires it up, not you. Leave the existing menu markup where it is for now.」，
但它原来的家 `.album-hero-actions` 正是本任务要删的。折中：`morePopRef` 包裹层 + 按钮 + 菜单
**内容一字未改**，整块挪进 `.sv-actions` 末尾，并在模板处写了 `TEMPORARY HOME, registered` 注释
指明「靶子里它的家是侧栏 `.sv-side-actions`，Task 5 连五项菜单一起建」。
选头部而不是直接放侧栏的理由：`.sv-export-menu` 是 `position:absolute`，放进
`overflow-y:auto` 的 `.sv-detail-side` 就会立刻撞上 T1 composable 专门要修的裁切 bug；
放头部这个中间态不引入新缺陷。**代价：本任务结束时页面的 ⋯ 位置与靶子不一致，T5 必须搬走。**

### D7 `.sv-cond` 只写一条 `.sv-header h1 .sv-cond`
靶子是「基础 `.sv-cond`（11px / 2px 8px）+ `.sv-header h1 .sv-cond` 覆盖成 11.5px / 3px 10px」两层。
本页只有 h1 里这一个胶囊，两层折叠成一条（与 `AlbumConvertToSmartDialog.vue:310` 已有的同款写法一致）。
**刻意没有重置 font-weight / letter-spacing** —— 靶子里胶囊继承 h1 的 600 / -0.02em，重置反而是可见偏差
（第一版写了 `font-weight:400; letter-spacing:normal`，自审时对靶子发现是我加的，已删）。

### D8 `--surface-3` → `--chip-bg`（`.sv-cond` 底色）
按 token 映射本应是 `--chip-bg-hi`，但本仓已发布的两处 `.sv-cond` 复述
（`MomentCard.vue:213`、`AlbumConvertToSmartDialog.vue:310`）都用 `--chip-bg`，
与已发布形态一致优先于重新推导映射。已写进 CSS 注释。

---

## 3. TDD 证据

### RED（Step 2）
```
$ pnpm exec vitest run src/views/__tests__/PhotosAlbumDetail.test.ts
 Test Files  1 failed (1)
      Tests  13 failed | 44 passed (57)
```
新增 14 条里 13 条红。唯一一条上来就绿的是我额外加的
`goes back to the albums list from the detail bar` —— 它测的是 hero 上那个
`data-test="album-back"` 既有行为的搬家，本来就成立，属于「搬家守卫」而非新行为。

红的 13 条（逐条）：
```
renders the detail bar with a back button and the created date
omits the created date entirely when the album has no creation timestamp
no longer renders the cover hero or the toolbar band
renders the two-column layout with the main column and the sidebar
puts the date range pill on the h1 row, not in a separate chips row
shows the items count and hides the videos count when there are no videos
hides sort and density in edit mode but keeps Edit/Done
marks the photo grid wrapper with the edit flag so the cover badge and tile outline rules can key off it
shows the select bar in edit mode even before anything is selected
removes the selected photos and keeps the guard against a double click
opens the library picker from the select bar
hides the select bar again after leaving edit mode
clears the selection when leaving edit mode so a later edit session starts empty
```
（`still opens the lightbox from a tile click outside edit mode` 也是回归守卫、上来即绿，
与 `goes back…` 同类；两条都写在计划清单里，故都保留。）

### GREEN（Step 5）
```
$ pnpm exec vitest run src/views/__tests__/PhotosAlbumDetail.test.ts src/i18n/parity.test.ts src/styles
 Test Files  6 passed (6)
      Tests  1145 passed (1145)

$ pnpm exec vue-tsc --noEmit
（无输出，exit 0）
```
广域回归（确认没波及邻页）：
```
$ pnpm exec vitest run src/views src/i18n src/photos
 Test Files  151 passed (151)
      Tests  2955 passed (2955)
```

### 输出洁净度（`--reporter=verbose`）
两类 stderr，**均为改动前既有**：
1. `[Vue warn] Component "i18n-t" has already been registered` —— 本文件自建 `createI18n`
   与 setup 单例重复安装，全仓既有模式，每次 mount 都出，与本任务无关。
2. `[photos-timeline] fetchTimeline TypeError: getTimeline is not a function` ——
   `PhotosLibraryPicker` 打开时拉时间线，而本文件的 svc mock 没有 `getTimeline`。
   **改动前就有**：`grep` 确认它在既有的两条用例
   （`pressing Add photos opens PhotosLibraryPicker…` / `the existingIds handed to the picker are String()-normalised`）
   里同样出现，我的 `opens the library picker from the select bar` 只是第三个触发点。
   **未修**（补 mock 会让选择器渲染出照片，改变既有两条用例的运行条件，属范围外）。已挂账。

---

## 4. 变异验证（五条，逐条结果）

| # | 变异 | 预期变红 | 实测 |
|---|---|---|---|
| 1 | 删 `.album-photos-wrap` 的 `:data-edit="edit"` | `marks the photo grid wrapper …` | ✅ 只这一条红（1 failed / 57 passed） |
| 2 | 两个 `<template v-if="!edit">` 都改成 `<template>`（Sort/density 编辑态也渲染） | `hides sort and density in edit mode …` | ✅ 只这一条红（1 failed / 57 passed） |
| 3 | 日期胶囊从 h1 挪进独立 `.sv-header-conds` 行 | `puts the date range pill on the h1 row …` | ✅ 红，**外加**既有的 `铁律回归…渲染标题/计数/日期区间` 也红（2 failed / 56 passed）—— 后者正是本次搬家把 `May 2026` 钉到 h1 胶囊上的那条断言，双红说明搬家断言是真在起作用 |
| 4a | 只删函数内的 `removing.value` 重入守卫 | `keeps the guard against a double click` | ⚠️ **未变红（58 passed）** —— 见下方说明 |
| 4b | 把 `removing` 守卫**完整**删除（函数内 + 按钮 `:disabled` 绑定里的那半） | 同上 | ✅ 红，**外加**既有的 `Minor 6 回归:连点两次…` 也红（2 failed / 56 passed） |
| 5 | `toggleEditMode` 离开编辑态时不 `selected.value.clear()` | `clears the selection when leaving edit mode …` | ✅ 只这一条红（1 failed / 57 passed） |

**4a 为什么没红（重要，不是测试白写）**：`removing` 守卫在本页是**两层**的 ——
函数入口 `if (!selected.value.size || removing.value) return` 和按钮的
`:disabled="!selected.size || removing"`。只拆掉函数那层时，第二次点击会落在一个
**已 disabled 的按钮**上，jsdom（和真浏览器）都不会派发 handler ⇒ 行为仍然正确、
两次 DELETE 仍然发不出去 ⇒ 测试**应该**继续绿。4b 把守卫整体拆掉后测试立刻变红，
证明这条用例钉的是「双击不会发两轮请求」这个真不变量，而不是某一行代码的存在。
（同一现象在既有的 `Minor 6 回归` 那条上完全一致，说明这是本页守卫的既有形状，不是本次引入。）

每次变异后都 `cp` 还原并复跑确认回到 58/58 全绿。

---

## 5. 既有断言搬家表（原断言 → 新家，逐条点名）

被删的 `.album-hero*` / `.album-toolbar*` 一共牵动 **10 条既有用例**。逐条：

| # | 原用例 / 原断言 | 新家 |
|---|---|---|
| 1 | `铁律回归:route.params.id 字符串 "7"…` 里 `expect(svc.photos.thumbnailUrl).toHaveBeenCalledWith('cover-1','large')` | **反向搬到** 新用例 `no longer renders the cover hero or the toolbar band` 的 `expect(svc.photos.thumbnailUrl).not.toHaveBeenCalledWith('cover-1','large')` —— hero 是 large 封面缩略图的唯一消费方，它走了这条请求就不该再发 |
| 2 | 同上用例里 `w.find('.album-hero-bg').attributes('style')).toContain('mock://thumb/cover-1/large')` | 同 #1（同一主题的两条断言合并为一条反向断言）。**说明：这条断言的正向形式在新结构里没有对应物**（页面已无任何背景图元素），故以反向形式落地，不是悄悄删掉 |
| 3 | 同上用例里 `w.text()).toContain('Trip')`（原落在 `.album-hero-title`） | 同用例新增 `expect(w.find('.sv-header h1 .sv-title').text()).toBe('Trip')` |
| 4 | 同上用例里 `w.text()).toContain('3')`（原落在 `.album-hero-sub` 的 `photosItemsCount`） | 同用例新增 `expect(w.find('[data-test="album-header-items"]').text()).toContain('3')` |
| 5 | 同上用例里 `w.text()).toContain('May 2026')`（原落在 `.album-hero-sub`） | 同用例新增 `expect(w.find('.sv-header h1 .sv-cond').text()).toBe('May 2026')` |
| 6 | `albumsLoaded=false … → 渲染加载骨架` 的 `[data-test="album-loading"]`（原内含 `.album-hero.album-hero-skeleton`） | **原样存活**：`data-test` 钩子未变，内部块改成 `.album-skel-bar` + `.album-skel-header`，断言不需要改 |
| 7 | `keeps the rail out of the photo grid's scroll container` 的 `expect(css).toMatch(/\.album-detail-body\s*\{[^}]*overflow:\s*hidden/)` | 同名用例改写成四条：`.sv-detail-layout` 有 `min-height: 0`、`.sv-detail-main` 有 `overflow-y: auto`、`.sv-detail-side` 有 `overflow-y: auto`、**且** `.album-photos-wrap` 已**没有**自己的 overflow（`not.toMatch`）。守的是同一个不变量（两列各自滚、右栏不跟着照片滚走），换了承载它的容器 |
| 8 | `edit 态点瓦片 → …移除按钮 disabled→可用…` 的 `[data-test="album-remove-selected"]`（原在 `.album-toolbar`） | **原样存活**：按钮整体搬进 `.sv-select-bar`，`data-test` 与 `:disabled` 表达式一字未改 ⇒ 该用例零改动通过。新增用例 `removes the selected photos …` 用 `.sv-select-bar [data-test="album-remove-selected"]` 显式钉住它的新容器 |
| 9 | `pressing Add photos opens PhotosLibraryPicker…` 用的 `openPicker()` 助手里的 `[data-test="album-add-photos"]`（原在 `.album-toolbar`） | **原样存活**：同 #8，按钮搬进浮条、`data-test` 未变 ⇒ 助手与三条依赖它的用例零改动通过。新增用例 `opens the library picker from the select bar` 用 `.sv-select-bar [data-test="album-add-photos"]` 钉住新容器 |
| 10 | `[data-test="album-edit-toggle"]`（**8 条用例**在用：edit 态点瓦片 / 拖拽守卫回归 / drag.refresh 时机 / 路由切换 / Important 2 回归 / Minor 6 回归 等；原在 `.album-hero-actions`，`class="bar-btn" :data-active`） | **原样存活**：按钮搬进 `.sv-actions`，`data-test` 未变；类名换成靶子的 `.sv-action-btn`、状态属性从 `:data-active` 换成靶子的 `:data-open`。**8 条既有用例全部零改动通过**（它们只查 `data-test`，不查类名/属性） |
| 11 | `[data-test="album-sort-btn"]` / `[data-test="album-sort-item"]` / `[data-test="album-sort-menu"]`（原在 `.album-toolbar` 的 `v-else` 分支） | **原样存活**：整个 `.album-sort-wrap` 搬进 `.sv-actions`，三个 `data-test` 与 `sortMenuRef` 未变；触发按钮类名 `.bar-btn` → `.order-pill`。依赖它们的 2 条用例（灯箱排序切换 / drag.refresh 时机）零改动通过 |
| 12 | `[data-test="album-more-btn"]` / `[data-test="album-menu*"]`（原在 `.album-hero-actions`） | **原样存活**：见 D6，整块挪进 `.sv-actions`，markup 一字未改。依赖它们的 5 条用例零改动通过 |
| 13 | `[data-test="album-title"]` / `[data-test="album-title-input"]`（原 `.album-hero-title`） | **原样存活**：`data-test` 未变，类名换成 `.sv-title` / `.sv-title-input`。依赖它们的 3 条用例零改动通过 |

**没有任何一条既有断言被删除。** 唯一「形态变了」的是 #1/#2/#7 三条 ——
#1/#2 以反向断言落地（原正向主张在新结构里已不存在，理由见表内），#7 换承载容器但守同一不变量。

搬家后既有用例总数 44 条，**全部仍在、全部通过**；新增 14 条，全通过 ⇒ 58/58。

---

## 6. 改动文件

| 文件 | 改动 |
|---|---|
| `src/views/PhotosAlbumDetail.vue` | 主战场：脚本删 `coverBgImage`、模板换骨架 + 建浮条、CSS 删 hero/toolbar/body/density 建 detail-bar/layout/header/actions/select-bar + E5 重锚 + 媒体查询更新 + 文件头补英文修订说明 |
| `src/views/__tests__/PhotosAlbumDetail.test.ts` | 新增 `describe('P2c detail skeleton')` 14 例；改写 2 条既有用例的断言落点（#1-#5、#7） |
| `src/views/__tests__/photosLayoutHeightCap.test.ts` | **仅注释一行**：CAPPED 名单里本页的滚动容器说明从 `.album-photos-wrap` 更正为 `.sv-detail-main / .sv-detail-side`（断言未动） |
| `src/i18n/zh_cn.photos.ts` / `src/i18n/en_us.photos.ts` | 各 +3 键 + 一段英文登记注释 |

---

## 7. 自查结果

| 检查项 | 结果 |
|---|---|
| 新写的中文注释/测试描述 | `git diff --cached \| grep -nP '^\+.*[\x{4e00}-\x{9fff}]'` → **只剩 3 行 i18n 值**（`photosDetailCreatedAt`/`Items`/`Videos`）。我改写的两段既有中文注释（`.bar-btn:disabled` 与封面徽章那段）**已按 constraint 2 翻成英文** |
| 颜色字面量 | `grep -nE "#[0-9a-fA-F]{3,8}\b\|rgba?\(\|hsla?\("` → 唯一命中是既有、已登记的 `.tile-cover-btn { color: #fff }`（theme-exception，本次未触碰）。新写的全部走 token：`--chip-bg`/`--chip-bg-hi`/`--chip-border`/`--divider`/`--fg`/`--fg-muted`/`--accent`/`--accent-soft`/`--popup-bg`/`--card-border`/`--card-shadow-hi`/`--blur`/`--skeleton-bg`/`--panel-bg`。`src/styles` 门（含 color-guard）全绿 |
| CSS 注释里 `*` 紧贴 `/` | 脚本扫描 `<style>` 全部 29 个注释块：`/*` 29 个、`*/` 29 个、零个提前闭合/嵌套异常 |
| 两个被删容器的孤儿选择器 | 见 §1 grep 结果：本文件内六处命中全是注释；跨文件两处是散文引用非选择器依赖 |
| YAGNI | 未做未要求的事：排序下拉内部未重做（D5）、`.sv-side-actions` 未建（留给 T5）、侧栏三节未动（留给 T4）、`photosAlbumItemsShown` 等孤儿键未删（留给 T11） |
| 测试是否验真行为 | 五条变异全部按预期定位到指定用例（4a 的「未红」已论证是正确结果，见 §4） |

---

## 8. 遗留 / 需要下游注意

1. **T5 必须把 ⋯ 菜单从 `.sv-actions` 搬进 `aside.sv-detail-side` 顶部的 `.sv-side-actions`**（D6）。
   在此之前页面的 ⋯ 位置与靶子不一致。模板处已写 `TEMPORARY HOME, registered` 注释。
2. **T6 的 i18n**：请复用 `photosAlbumSort` / `photosAlbumSortTaken` / `photosDensityComfortable` /
   `photosDensityCompact`，只新增 `photosSortScore`（D2）。
3. **T11 的孤儿键候选**（本任务停止使用、尚未确认零消费者）：`photosAlbumItemsShown`。
   `photosItemsCount` 与 `photosAlbumLabel` **不要删** —— 前者全仓多处在用，后者 T4 的 About·Type 行要用。
4. `PlaceDetailPanel.vue:46,337` 与 `PersonHero.vue:58` 的注释仍把 `.album-hero-bg::after` 当先例引用，
   该规则已被本任务删除。属跨文件散文陈旧，未改（范围外）。
5. 测试 mock 缺 `svc.photos.getTimeline`，`PhotosLibraryPicker` 一打开就往 stderr 打一条
   `fetchTimeline TypeError`。**改动前就有**（既有两条用例同样触发），未修。
6. 本任务**未部署、未推 origin、未合 master**。真机验收未跑。
