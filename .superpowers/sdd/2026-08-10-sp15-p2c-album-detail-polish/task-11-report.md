# Task 11 报告：i18n 孤儿清理 + 四件折叠修复 + 六道门 + 真机验收清单

**状态：DONE**
**分支末位：本报告的提交（六道门跑在 `2a945c7` 上，即本报告提交前的末位）**
**基线：P2c 起点 `61a666c`（P2b 收尾），与 master 的 merge-base 是 `9100418`**

---

## Part 1 · i18n 孤儿清理

### 方法

全仓 `git grep -n "\b<key>\b"`，排除四个 locale 文件（`src/i18n/{zh_cn,en_us}.photos.ts`
才是这批 key 的实际所在，不是 `zh_cn.ts`/`en_us.ts`）。同时排除 `.superpowers/` 与
`docs/`（台账里提到 key 名不算消费者），再对每个候选逐条看命中行是**真调用**
（`t('key')`）还是**注释里的提名**。

另外查了一次动态拼 key（`` t(`...${}` ) ``）——全仓只有 `StorageRaidCreate.vue` 一处
`` t(`raidLevel${...}Tolerance`) ``，与 photos 无关，不存在被拼出来的 photos key。

### 逐键裁决

| key | 裁决 |
|---|---|
| `photosSvAddCondition` | **deleted (0 consumers)** |
| `photosSvNewCondition` | **deleted (0 consumers)** |
| `photosSvEGSceneSunset` | **deleted (0 consumers)** |
| `photosSvSuggestions` | **deleted (0 consumers)** |
| `photosSvDone` | **deleted (0 consumers)** |
| `photosSvAdd` | **deleted (0 consumers)** |
| `photosAlbumRename` | **deleted (0 consumers)** — 唯一命中是 `zh_cn.photos.ts:186` 的一条注释（Task 5 自己写的「本期先不删」备忘），不是调用 |
| `photosAlbumItemsShown` | **deleted (0 consumers)** |
| `photosSvSaveStaticAlbum` | **deleted (0 consumers)** |
| `photosSvSnapshotCurrentMatchesStops` | **deleted (0 consumers)** |
| `photosSvNameSnapshotSavedAlbum` | **deleted (0 consumers)** |
| `photosSvExport` | **deleted (0 consumers)** |
| `photosSvDeleteSmartView` | **deleted (0 consumers)** — 唯一命中是 `PhotosSmartViewDetail.vue:1062` 的注释（Task 7 写的「留给 Task 11 扫」），不是调用 |
| `photosAlbumRenameHint` | **kept** (`src/views/PhotosAlbumDetail.vue:858`) |
| `photosAlbumConvertToSmart` | **kept** (`src/photos/components/AlbumConvertToSmartDialog.vue:119, :125, :180`) |
| `photosAlbumConvertToSmartHint` | **kept** (`src/photos/components/AlbumConvertToSmartDialog.vue:126`、`src/views/PhotosAlbumDetail.vue:903`) |
| `photosAlbumDelete` | **kept** (`src/views/PhotosAlbumDetail.vue:1046` — 删除确认模态的主按钮) |
| `photosAlbumDeleteHint` | **kept** (`src/views/PhotosAlbumDetail.vue:921`) |
| `photosSvConvertToAlbum` | **kept** (`src/views/PhotosSmartViewDetail.vue:1179` — 转换确认弹窗的提交按钮) |
| `photosFavExport` | **kept** (`src/views/PhotosSmartViewDetail.vue:1014`、`src/views/PhotosFavorites.vue:197`、`src/views/PhotosAlbumDetail.vue:888`、`src/views/__tests__/PhotosSmartViewDetail.test.ts:876`) |
| `photosSvRemoveC` | **kept** (`src/views/PhotosSmartViewDetail.vue:769` — 条件 chip 的 title) |

**删 13 键 × 2 个 locale 文件**（zh 1077→1064 行，en 1040→1027 行，两侧各减 13，
parity 不会红）。

### 连带修的两处注释

两条注释在说「这个 key 现在没人用了，留给 Task 11 扫」。key 删掉后这两句话就成了指向
空气的记载，一并改成陈述事实：

- `src/i18n/zh_cn.photos.ts:182-186`：改成「`photosAlbumRename` 已删；
  `photosAlbumConvertToSmart` 留下，AlbumConvertToSmartDialog 仍在用」
  —— 原注释把这两个 key 并列说成「都失去唯一引用」，其中后者其实是**活的**。
- `src/views/PhotosSmartViewDetail.vue:1062`：改成「已被 Task 11 删除」。

---

## Part 2 · 四件折叠修复

### (a) 排序菜单宽度，两个页面都改

靶子 `33b05636:src/views/Photos/photos.scss:3126` 是 `min-width: 240px`。

- `src/views/PhotosAlbumDetail.vue` `.album-sort-menu`：180px → **240px**
- `src/views/PhotosSmartViewDetail.vue` `.sv-sort-menu`：180px → **240px**

两处都在 CSS 里留了英文注释登记来源行号。

### (b) 排序项的勾选图标 —— 真 1:1 破绽

靶子 `33b05636:src/views/Photos/PhotosAlbumDetail.vue:88-101`：**选中项**渲染一个
check 图标，**未选中项**渲染一个**等宽空占位**，从而三行标签左边缘对齐。

- **智能视图页**：核对了 `PhotosSmartViewDetail.vue:809-822`，本期已经是这个形状
  （`<svg class="sv-sort-check">` / `<span v-else class="sv-sort-check">` + `.lbl`），
  **无需改动**，只有上面 (a) 的宽度动了。
- **相册页**：原来是 `<button ...>{{ s.label }}</button>` 裸标签 + `display:block`，
  只靠 `data-active` 的背景色区分。已改成与智能视图页同形的 flex 行：
  `.album-sort-check`（12px 定宽、`flex-shrink:0`、`color: var(--accent-text)`）
  + `.lbl`。CSS 也从 `display:block` 改成 `display:flex; align-items:center; gap:8px`。

配色全走 token（`--accent-text` / `--accent-soft` / `--chip-bg-hi` / `--fg`），
无颜色字面量。

### (c) 死 CSS 与它的测试，一起删

`.sv-action-btn-primary` 与 `.sv-action-btn.sv-action-btn-primary:hover` 在
`PhotosSmartViewDetail.vue` 上的唯一消费者是 Task 7 删掉的「导出」主按钮
（本文件已无 `data-primary`、无该 class 的任何 markup，已 grep 确认）。

**规则和测试一起删**：
- 删 `src/views/PhotosSmartViewDetail.vue` 的两条规则 + 它们的说明注释
- 删 `src/views/__tests__/PhotosSmartViewDetail.test.ts:1403-1412` 那条
  `winningHoverBackground(style, ['sv-action-btn', 'sv-action-btn-primary'])` 用例
  —— 它的描述里写着「导出主按钮」，而那颗按钮已经不存在。

**顺带修了三处会因此指向空气的交叉引用注释**（这一点 brief 没点名，是删规则的必然
连带）：`:1358`（原文「见上面 .sv-action-btn-primary」）、`:1399`（原文「同上
.sv-action-btn-primary 的道理」）、`:1582`（原文「hover 镜像本页的
.sv-action-btn-primary:hover」）。前两处改成不依赖被删规则的自足说法，第三处改指
`PhotosMomentDetail.vue:934`（同一个变体在那页仍然活着，连同它自己的级联回归测试
`PhotosMomentDetail.test.ts:874-880`）。

### (d) PhotosAlbums.vue 两件一致性小项

- **`data-test` 补齐**：smart 分支的 `.album-cover-fallback` 加上
  `data-test="album-cover-fallback"`，与 manual 分支对齐。
  查过现有两处消费：`PhotosAlbums.test.ts:171` 是在**单张卡的 wrapper 内**
  `find`，`:810` 用的是 class 选择器 —— 都不会因为文档里多出第二个同名
  `data-test` 而变歧义。
- **`String(item.sv.id)` —— 选择「删掉」**，理由写在渲染处的注释里：
  `SmartView.id` 的类型就是 `string`（`smartViews.ts:28`），且 store 的每一条写入
  路径都过 `toSmartView` 归一（`smartViews.ts:98`），这层 cast 是彻底的 no-op，
  不是「双保险」。（store 自己的 `byId` 里那层 `String()` 是**另一回事**——它比对的是
  调用方传进来的外部 id，那里保留。）

---

## Part 3 · 六道门（干净工作树，`2a945c7`）

| # | 门 | 结果 |
|---|---|---|
| 1 | `git status --short` | **空**（干净） |
| 2 | `pnpm exec vue-tsc --noEmit` | **exit 0，零输出** |
| 3 | `pnpm test` | **685 文件 / 10954 例 全过**，169.52s |
| 4 | `pnpm exec vitest run src/i18n/parity.test.ts src/styles` | **5 文件 / 1081 例 全过**，2.28s |
| 5 | `pnpm exec vitest run oss/` | **8 文件 / 149 例 全过**，14.65s |
| 6 | `pnpm build` | **exit 0**，`✓ built in 17.11s` |
| 7 | `git merge-tree --write-tree master HEAD` | **exit 0，单行 tree OID `f886b055…`** ⇒ 与 master **无冲突** |

oss 导出清单实测：**DELETE 78 · REPLACE 4 · PATCH 258**，
**零真实泄漏命中**（3 个二进制文件按预期跳过内容扫描并登记）。

### ⚠️ 一个必须记的坑（brief 提前警告过，实测确认）

第一次跑 `pnpm test` 时 **4 个 oss 测试文件红、3 例失败**，报的是
「工作树不干净,导出中止」。这不是缺陷，是**纯粹的门自身副作用**：`oss/*.test.mjs` 断言干净
工作树。更阴的一层是——

**`git status --short` 一开始就是空的，但那是假象**：`review-package` 工具重建的
`.superpowers/sdd/.gitignore` 里只有一行 `*`，把整个台账目录（31 个文件）藏得连
`git status` 都看不见。按 brief 先 `rm -f .superpowers/sdd/.gitignore` 再
`git add -f .superpowers/sdd/`，这 31 个文件才浮出来。清理并提交后重跑，
oss 的 8 个文件 149 例全绿，全量套件也从「10881 passed / 70 skipped」变成
「10954 passed」（那 70 个 skipped 正是脏树时自我跳过的 oss 用例）。

---

## Part 4 · 真机验收清单大纲

产出：`docs/superpowers/2026-08-10-sp15-p2c-acceptance.md`

**第 0 步（预期基线）**分成方向相反的两半，刻意不重蹈上一期的覆辙：

- **允许为空的**（列了三条，各带理由）：「关于」段的**地点**行无 GPS 时显示 `—`；
  「按月分布」直方图在成员照片全无 EXIF 拍摄时间时缺席；智能视图网格因 BE-1
  匹配数恒为 0。
- **⛔ 不允许为空的**（一张 6 项的 must-see 清单）：整页不是白屏、返回条、页头大标题 +
  统计行、页头右侧完整动作行、右侧栏三节全在、「⋯」菜单恰好五项。并直书一句
  「少任何一项都是缺陷，**不能用『数据为空』解释掉**」。
- 直方图那条特意补了一句反向约束：**至少要在一个相册上看到直方图**，五个全无就记缺陷
  —— 免得「允许缺席」被当成「全都缺席也行」。

**15 个验收步骤，每步都带具体点击路径**：

| 步 | 内容 |
|---|---|
| 1 | 进相册详情页（后续步骤的共同起点） |
| 2 | 页头排序下拉：240px 宽度 + **对勾/空占位/文字左对齐** |
| 3 | 密度切换 |
| 4 | 编辑态：动作组连同分隔线一起消失 + **底部浮条**的四态 |
| 5 | 侧栏「⋯」**五项菜单**（逐项标题+说明，含红色项的 hover 可读性） |
| 6 | **短视口向上翻转** —— 明写「先调矮窗口，再点⋯」，因为 resize 会关菜单 |
| 7 | **Download as ZIP 真机点一次** ⭐⭐（落盘、非 0 字节、解压有照片、失败症状） |
| 8 | Duplicate（含验完删副本的收尾） |
| 9 | 转换：手动相册 → 智能相册（含 AI 开关关闭时的置灰分支） |
| 10 | 智能视图页**新增的排序与密度**（先教怎么手动塞照片，否则网格空验不了） |
| 11 | 智能视图页「⋯」菜单与相册页**并排比对** |
| 12 | 转换：智能视图 → 普通相册（反方向） |
| 13 | **灯箱按网格当前顺序打开**（切排序后再验一次） |
| 14 | Albums 页**两种卡片等高** ⭐ |
| 15 | 明暗两套主题各扫一遍 |

末尾附勾选结果表。文档为中文（`docs/superpowers/*-acceptance.md` 的既定惯例，
写给机主看），代码注释与提交信息全英文。

### 写清单时用代码取证推翻的 4 处

1. **「在搜索中细化」不在页头**。原稿把它写进了智能视图页的页头动作行；实际它在
   `.sv-side-actions`（`PhotosSmartViewDetail.vue:971-975`），和「⋯」同一行。已改，
   并额外写明「相册页那一行只有『⋯』一颗，这是两页允许的差别，不是缺陷」。
2. **`useFixedMenuPosition` 在 resize 与 scroll 时会关菜单**
   （`useFixedMenuPosition.ts:36-41`）。所以第 6 步的顺序**必须**是「先调矮窗口 →
   再点⋯」，反过来只会看到菜单被关掉，机主会误判成缺陷。已写成粗体的前置说明。
3. **两个排序下拉的选项文案**是「手动排序/拍摄日期/添加日期」与
   「**匹配分数**/拍摄日期」——原稿写的「匹配度」是我自己编的，
   `photosSortScore` 的实际值是「匹配分数」。同理智能卡的 live 文案是
   「**即时生效**」不是「Live」，徽章是「**智能视图**」不是「Smart」。全部按 locale
   实际值改写。
4. **侧栏三节的中文标题**是「关于 / 统计 / 按月分布」（`photosMoAbout` /
   `photosMoStats` / `photosMoByMonth`），原稿按英文写成 About/Stats。已改成屏幕上
   真正会出现的字，否则机主对不上。

另外核对通过（未改）：两个转换方向的跳转目标确实是
`router.push('/photos/smart-views/' + sv.id)`（`PhotosAlbumDetail.vue:409`）与
`router.push('/photos/albums/' + String(album.id))`（`PhotosSmartViewDetail.vue:528`）。

---

## 改动文件

| 文件 | 改动 |
|---|---|
| `src/i18n/zh_cn.photos.ts` | 删 13 键；修 1 处注释 |
| `src/i18n/en_us.photos.ts` | 删 13 键 |
| `src/views/PhotosAlbumDetail.vue` | 排序项加 check/占位（模板）；`.album-sort-menu` 240px、`.album-sort-item` 改 flex、新增 `.album-sort-check`/`.lbl` |
| `src/views/PhotosSmartViewDetail.vue` | `.sv-sort-menu` 240px；删 `.sv-action-btn-primary` 规则对；修 4 处注释 |
| `src/views/__tests__/PhotosSmartViewDetail.test.ts` | 删 1 条已失去选择器的级联回归用例 |
| `src/views/PhotosAlbums.vue` | smart 分支补 `data-test`；去 `String()` 包裹 |
| `docs/superpowers/2026-08-10-sp15-p2c-acceptance.md` | 新增 |
| `.superpowers/sdd/2026-08-10-sp15-p2c-album-detail-polish/**` | 31 个此前被 `*` gitignore 藏住的台账文件入库 |

## 本次提交

| SHA | 主题 |
|---|---|
| `5a6e00b` | chore(photos): drop the i18n keys the menu rework orphaned |
| `22ec28b` | fix(photos): give the album sort dropdown the target's check glyph |
| `9450fda` | chore(photos): widen the smart-view sort menu, drop its dead primary rule |
| `ef9a684` | chore(photos): tidy the smart album card branch |
| `2a945c7` | docs(sp15): write the P2c real-device acceptance checklist |
| （本次） | docs(sp15): record the Task 11 report |

---

## 自检

- [x] 每个 key 的裁决都有 `git grep` 实证，不是照抄 Task 8 的清单
      —— 事实上 Task 8 报的 6 个孤儿全部属实，但 brief 另给的 14 个「也查一下」里
      **7 个是活的**，盲删会打断五处界面文案。
- [x] (a) 两个页面都改了，不是只改一个（相册页 + 智能视图页各一处 `min-width`）
- [x] (b) 相册页补齐，智能视图页**核对过**已符合靶子形状（不是想当然假设）
- [x] (c) 死规则与它的测试**同一次提交**删掉；额外清了三处会悬空的交叉引用
- [x] 六道门在**干净工作树**上真跑，数字如实记录；没有把任何一门的红解释成已知问题
- [x] 清单每一步都有点击路径；两个「只有真机能验」的项（ZIP 下载、卡片等高）打了 ⭐
- [x] 触碰的 CSS 全走 token，零颜色字面量
- [x] CSS 注释里没有 `*` 紧贴 `/`
- [x] 代码注释、测试描述、提交信息全英文；验收清单中文（既定惯例）
- [x] 所有测试与门都在前台单次阻塞执行，无后台 job

## 关切

1. **验收清单里 ZIP 那一步是唯一无法自证的**。`downloadZip()` 走的是
   `window.location.href = exportAlbumZipUrl(...)`，jsdom 只会抛
   `Not implemented: navigation`（全量套件里那几行 stderr 就是它，不是失败）。
   后端 `/albums/:id/zip` 这条路径在本分支上**从未真机跑过**，如果 token 参数名或
   JWT 豁免路径与实现不符，只有第 7 步能发现。已在清单里写明失败症状。
2. **第 9 步依赖 `smartViewSuggest` 给出日期类建议**。若某个相册的照片元数据太稀薄、
   Nimo 只吐得出语义类建议，机主会卡在「转换后匹配数 0」上。清单里写了绕开办法，
   但没有兜底路径——真遇上只能换一个相册再试。
3. **智能视图页的排序/密度/灯箱三项，全部依赖机主先手动塞照片**（第 10 步开头）。
   这一步比其它步骤重，如果机主跳过，第 10/13 两步会验成「什么都没发生」。已用
   引用块单独标出，但仍是本清单最容易被略过的地方。
4. **`.superpowers/sdd/.gitignore` 会被 `review-package` 重建**。本期已删并把台账
   `-f` 入库，但下一期只要再跑一次那个工具，同样的 `*` 就会回来，
   而且**症状是 `git status` 一片干净**（看起来没问题，实际是台账整个隐身）。
   这是第二次踩（SP17 台账里已有同款记载），值得在工具侧根治而不是每期手删。
