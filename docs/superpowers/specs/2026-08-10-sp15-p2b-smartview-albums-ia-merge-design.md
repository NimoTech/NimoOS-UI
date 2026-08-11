# SP15-P2b 智能视图并入 Albums·IA 合并 —— 设计

> 写于 2026-08-10。分支 `sp15-photos-moments`（**接着 P1/P2a 往下做，不另开分支**），
> worktree `.claude/worktrees/sp15-photos-moments`，基线 = P2a 收官处 `baec949`。
> 流程：机主 2026-08-10 拍板 —— **整期做完**（不再拆），**混合流程**（地基四个任务逐任务
> 评审，其余只进收尾整支终审）。

---

## 0. 这一期在哪个位置

SP15-P2 原设计是「Albums / SmartViews 统一」一整块，开工前量体量后拆三块（见
`2026-08-09-sp15-p2a-smartview-manual-assets-design.md` §0）：

| 子期 | 内容 | Vue2 提交 | 状态 |
|---|---|---|---|
| P2a | 智能视图手动加/移/恢复照片 + 写后刷新统计 | `#79` `#82` | 已收官（未验收） |
| **P2b** | **IA 合并：智能视图并入 Albums**（本文件） | `#112` `#113` | 本期 |
| P2c | 相册详情重构与打磨累积 | `#114`–`#117` | **依赖 P2b** |

### 0.1 一条必须先更正的前提：1:1 靶子**不是** `899af59b`

P1 与 P2a 的靶子都是 `899af59b`（`#111`）。**P2b 不能沿用**：

```
899af59b  2026-07-29  #111   ← P1 / P2a 的靶子
bf908a42  2026-07-30  #112   ← 本期
939a7d3a  2026-07-30  #113   ← 本期
```

`899af59b` 正是 `#112` 的**父提交**。P2a 能沿用旧靶子是因为 `#79`/`#82` 早于 `#111`，
其内容在 `899af59b` 上已经在了；`#112`/`#113` 恰好相反，在那个提交上**还不存在**。

实证：
```
$ git cat-file -e 899af59b:src/views/Photos/PhotosSmartAlbumCreate.vue
fatal: path ... does not exist in '899af59b'
$ git show 939a7d3a:src/views/Photos/PhotosSmartAlbumCreate.vue | wc -l
372
```

⇒ **P2b 的 1:1 靶子是 `939a7d3a`**，取源码一律
`git -C /home/nimo/NimoTech/NimoOS-UI show 939a7d3a:<path>`。用 `899af59b:` 取到的是
改造**前**的旧版本，会静默照抄错的东西。

### 0.2 体量

Vue2 两个提交合计 2838 行新增，其中约 1600 行是测试；生产代码约 1200 行。扣掉
§2 列出的「New-UI 不适用」部分，再按本仓惯例的 1.5–2 倍膨胀（TS + scoped CSS + 注释
+ 测试），落在 **P1 同一量级**（P1 = 6 提交 ~1900 行 / 整整一天 / 11 轮评审）。
机主选定整期做完，故任务数比 P2a 多一倍。

---

## 1. 范围

### 1.1 做

1. **Albums 页混排**：手动相册 + 智能相册进同一个网格，每项带 `kind`；本页额外拉
   `smartViews`；AI 停更横幅（完整版）从 SV 页搬来；智能卡片点击跳
   `/photos/smart-views/:id`
2. **全局排序**：删 `updated` 选项、默认改 `created`、跨两类统一比较、**缺失值排最前**
3. **创建融合**：`New album` 面板的「How to fill it」加第 4 个选项 `Let Nimo draft it`
   （开关关闭时置灰 + title 提示），选中时面板加宽并就地嵌入智能创建表单
4. **`SmartViewCreateDialog` 嵌入模式**：新增 `embedded` / `initialName` 两个 prop
5. **SmartViews 页瘦身成 Moments「For You」专页**：删 sv-hero / SV 网格 / 新建卡 /
   创建弹窗 / 骨架屏，`mo-hero` 从 h2 升为页面唯一 h1，加一条精简的开关提示
6. **导航与回链**：侧栏标签 `智能视图` → `For You`；4 处回链从 `/photos/smart-views`
   改到 `/photos/albums`
7. **相册详情对齐 SV 版式**：右侧统计侧栏（Photos / Span / Videos / Created + 按月
   直方图）+ 更多菜单对齐到 `sv-export-item` 形态
8. **双向互转**：相册 → 智能相册（新弹窗组件）、智能相册 → 普通相册（SV 详情内联确认框）
9. **活动流**：`converted_from_album` 两个文案分支
10. 数据层：service 2 方法、`SmartView.createdAt`、两个 store action、`AlbumView` 扩字段
11. i18n 约 20 键 × 2 locale

### 1.2 不做（各有出处，别在实现期重新讨论）

| 不做的 | 理由 |
|---|---|
| `#114`–`#117` | P2c 的范围 |
| 动作排类名换皮（`.actions .btn` → `.sv-action-btn`） | 在 New-UI 是**视觉零变化**，见 §3① |
| Slideshow / Ask Nimo 两个按钮 | New-UI 相册详情从 SP7 起就没有（`PhotosAlbumDetail.vue:6` 已登记；Ask Nimo 归 SP8，SP8 收官后也没往相册详情加）。本期不新增 |
| Vue2 的 `Nimo will match` 键 | Vue2 自己在同一提交里用 suggests 版取代了它，是死键 |
| Vue2 的 `localSmartViews` / `localAlbums` 乐观槽位 | 见 §3③ |
| `SmartViewCreateDialog` 独立模式删除 | Vue2 明写「现无调用方但保持完整」，1:1 保留 |
| 部署 / 推 origin / 合 master | 机主指定本期停在分支上等统一验收 |

---

## 2. 结构差：清单里约一半在 New-UI 不适用

New-UI 的详情页是**真路由**，Vue2 是同页 `v-if` 切面板。逐项核对结论：

| Vue2 内容 | New-UI 现状（已取证） | 判定 |
|---|---|---|
| 抽出 `PhotosSmartAlbumCreate` 组件（新建 372 行） | 已有 `src/photos/components/SmartViewCreateDialog.vue`（822 行） | **已吸收** |
| smart 卡空 seed 不渲染破图 | `SmartViewCard.vue` 的 D15 偏离登记以更严格方式处理（缺格子渲染中性占位，绝不渲染 `<img>`） | **已吸收** |
| Albums 页内联承接 SV 详情（`<photos-smart-view-detail v-else-if="openSv">` + 5 事件接线） | SV 详情是 `/photos/smart-views/:id` 独立路由 | **不适用** |
| `?smartview=` 深链 + `_applyRouteDeepLink` 优先级判定 | `usePhotosDeepLinks.ts:246` 已落地，直跳详情路由 | **不适用** |
| SV 页 `@redirect-albums` → Timeline 改 `activeNav` | 无 `activeNav`；`?view=smart` 已映射到该页（`usePhotosDeepLinks.ts:101`） | **不适用** |
| `photoUrl` prop 层层下传（SmartViewCard / SmartAlbumCreate） | 一律走 `service.photos.thumbnailUrl` | **不适用** |
| `onBackFromSv` 里补拉一次 `fetchAlbums` | 路由切换会重新挂载 Albums 页并 `fetchAlbums` | **不适用**（结构性满足） |
| Timeline 的 `openNimoWith({album, prefill})` 死分支清理 | New-UI 从未有过这种 payload 形状 | **不适用** |
| `inferChips` 复用 | `src/photos/util/smartViewSuggest.ts` 已导出 | **已吸收** |

**真缺口 = §1.1 的 11 条。** 这份对照表是「不能按提交列表算范围」在本期的具体兑现；
P1 与 P2a 各被差集重算推翻过一次，本期同样逐文件、逐方法核对过才落笔。

---

## 3. 四个「照抄会错」的地方

### ① 动作排换皮在 New-UI 是视觉零变化，但**更多菜单不是**

Vue2 `#113` 把相册详情头部的 `.actions` / `.btn` 换成 `.sv-actions` / `.sv-action-btn`，
配套 CSS（`photos.scss:3533-3538`）是：

```
background: rgba(20,20,28,0.7); border-color: rgba(255,255,255,0.18);
color: rgba(255,255,255,0.92); backdrop-filter: blur(12px);
```

New-UI 的 `.album-hero-actions .bar-btn`（`PhotosAlbumDetail.vue:714-719`）**已经是同一套
取值**（`--overlay-bg` / `--card-border` / 固定浅色 + 两条 theme-exception 注释）。
⇒ 改类名不会带来任何用户可见变化，**不做**（照抄类名 ≠ 照抄视觉，见分支纪律）。
Vue2 那条 `:not([data-primary="true"]):hover` 终审修补是为 Ask Nimo 的渐变按钮服务的，
New-UI 没有那个按钮，一并不适用。

**更多菜单是真差异**：New-UI 现在是 `.album-more-item`（纯文字两行、无图标、`min-width:200px`），
目标态是 `.sv-export-item`（图标格 + 标题 + 描述、`min-width:220px`、分隔线上方放 Convert、
下方放 Delete）。New-UI 的 SV 详情已经在用这套形态（`PhotosSmartViewDetail.vue:671-693`），
相册详情对齐过去即可，**不新造第三种菜单形态**。

### ② 全局排序的缺失值语义是**反的**，要改实现也要改既有测试

现 `sortAlbums` 的 `ts()`（`albumView.ts`）把缺失值当 `0` ⇒ 排**最后**；
`src/photos/util/__tests__/albumView.test.ts:47-48` 正把这条钉住。

Vue2 目标态的 `applySort`（`PhotosAlbumsView.vue:686-693`）刻意反过来：

```js
// 缺失值(null)统一排最前,而不是当作时间戳 0(那样反而会被排到最后)。
```

理由写在它自己的注释里：两来源的创建时间不可比时让 smart 排前。这是 1:1 要求
⇒ **改实现 + 改那两条测试，并在测试里写明为什么是最前**，否则下一期会有人「修回去」。

连带：删 `updated` 选项（Vue2 `#113` 移除 `Last updated`/`Recently changed first` 两句
文案）、默认从 `updated` 改 `created`、清 `photosAlbumSortUpdated` / `photosAlbumSortUpdatedHint`
两个随之变死的键（先例：P8a-T6 删 `photosSvSettingsPending`）。
`PhotosAlbums.test.ts:135` 那条「默认 sort='updated' → 保持后端顺序」的断言随之作废，要重写。

### ③ 乐观插入槽位不需要

Vue2 的 `localSmartViews` / `localAlbums` 是「页面常驻、store getter 可能还没追上」的兜底。
New-UI 里：

- `createSmartView` 已经 `smartViews.value.unshift(created)`（`smartViews.ts:221`）——
  从 Albums 页嵌入表单创建成功后，卡片立即出现，不需要第二条路径
- 两条转换成功后都 `router.push` 到新详情；用户回列表是**重新挂载 + 重拉**

照抄会得到两段为不存在的问题服务的代码（同 P2a §4① 对 `Vue.set` 原地合并的判断）。

### ④ `SmartView` 缺 `createdAt`，而后端其实**有**

Vue2 `#113` 注释写「智能相册要等 Photos 后端补上同名字段才有值」——**这条已过时**：
`NimoOS-Photos/service/smartview.go:23` 就是 `CreatedAt time.Time \`json:"createdAt"\``。

但 New-UI 的 `SmartView` 接口（`smartViews.ts`）**没有这个字段**，`toSmartView` 也不读它。
全局排序的 `created`/`date` 两档都要读 `sv.createdAt` ⇒ **数据层必须先补字段**，
否则智能相册永远走 null 分支，而测试会「因为错的理由而通过」（本区已四次踩这个坑）。

Vue2 的 `dateTakenMs` 对 smart 回退 `createdAt`（智能相册没有「最早成员拍摄时间」聚合
字段）——这条保留，是真实的降级而不是缺陷。

---

## 4. 后端契约（已回源核对，不要凭印象改）

| 端点 | 请求 | 响应 |
|---|---|---|
| `POST /v1/photos/smart-views/from-album` | `{albumId, name?, description, conds?, threshold?, includeVideos?}` | **完整 SmartView 对象** |
| `POST /v1/photos/albums/from-smartview` | `{smartViewId}` | **完整 Album 对象** |

- 两端点均已存在并有 Go 侧 HTTP 测试（`route/v1/smartviews_test.go:161-200`、
  `route/v1/albums_test.go:47-95`）
- `albumId` / `smartViewId` 缺失 → **400**；目标不存在 → **404**；相册名撞名 → **409**
- `conds` 缺省时由后端 `svparser` 从 `description` 解析（与 Create 同链路）⇒ 前端只传
  `description` + `threshold`，展示的 chips 只是**预览**，不强求两边字面一致
- Album DTO 带 `photoCount` / `videoCount`（`service/types.go:178-179`，**非 omitempty**，
  无视频时仍是 0）与 `dateStart` / `dateEnd` / `createdAt` ⇒ 统计侧栏四格数据全部落地可用

---

## 5. 落点

| 文件 | 动作 |
|---|---|
| `packages/service/src/photos.ts` | +2 方法：`convertAlbumToSmart` / `convertSmartToAlbum` |
| `src/photos/stores/smartViews.ts` | `SmartView` + `createdAt`；`toSmartView` 读它；+`convertFromAlbum` action |
| `src/photos/stores/albums.ts` | +`convertFromSmartView` action |
| `src/photos/util/albumView.ts` | `AlbumView` + `videoCount` / `dateStart`；`sortAlbums` 删 `updated` + 改 null-first |
| `src/photos/util/mixedAlbums.ts` | **新建**：`MixedAlbumItem` 判别联合 + `sortMixed()` 纯函数 |
| `src/views/PhotosAlbums.vue` | 混排网格 + 拉 smartViews + AI 横幅 + 排序改接 `sortMixed` + 第 4 个 source + 嵌入表单宿主 |
| `src/photos/components/SmartViewCreateDialog.vue` | +`embedded` / `initialName`；`effectiveName`；嵌入态隐 scrim/标题头/名字字段、Esc 交宿主 |
| `src/views/PhotosSmartViews.vue` | 瘦身成 For You 专页 |
| `src/views/PhotosAlbumDetail.vue` | 右侧统计侧栏 + 更多菜单对齐 + 转智能入口接线 |
| `src/photos/components/AlbumConvertToSmartDialog.vue` | **新建**：转智能相册弹窗 |
| `src/views/PhotosSmartViewDetail.vue` | 更多菜单 +「转普通相册」+ 内联确认框；顺带清 P2a 挂账的中文模板注释（~1168-1173） |
| `src/photos/components/SmartViewActivityFeed.vue` | +`converted_from_album` 两分支 |
| `src/photos/components/PhotosSidebar.vue` | `labelKey` 改 For You（`id` / `route` 都不动） |
| `src/views/PhotosSmartViewDetail.vue:361,540,547` · `src/views/PhotosSearch.vue:499` | 回链改道 → `/photos/albums` |
| `src/i18n/{zh_cn,en_us}.photos.ts` | 约 20 新键 + 删 2 死键 |
| `oss/manifest.mjs` | 新增测试文件登记 |

**零新依赖。**

### 5.1 两个「新建组件」的取舍

- **`AlbumConvertToSmartDialog.vue` 抽出**：本仓弹窗一律独立组件（`ClusterActionDialog`
  / `MergeReviewDialog` / `AlbumPickerDialog` / `PlaceSpotDialog` 均是），而
  `PhotosAlbumDetail.vue` 已 853 行，内联会到 ~1150。抽出后详情页只管接线。
- **SV 详情的转普通相册确认框内联**：照该文件既有 `confirmDeleteOpen` 的形态（`lb-confirm`
  同款视觉语言 + mousedown/keydown 双监听 + `anyOverlayOpen`），Vue2 也是内联，1:1。
- **`mixedAlbums.ts` 抽纯函数**：排序含「跨两类取值 + null-first」的分支，是最容易被
  「测试因为错的理由而通过」命中的地方，必须能脱离组件单测（同 P1 把 `momentLayout.ts`
  抽成纯函数的先例）。

### 5.2 回链改道清单（不改会变成哑链）

瘦身后 `/photos/smart-views` 只有 Moments，**没有 SV 列表**：

| 位置 | 现在 | 改为 |
|---|---|---|
| `PhotosSmartViewDetail.vue:361`（删除后跳走） | `/photos/smart-views` | `/photos/albums` |
| `PhotosSmartViewDetail.vue:540`（查无此项的返回按钮） | 同上 | 同上 |
| `PhotosSmartViewDetail.vue:547`（详情页返回按钮） | 同上 | 同上 |
| `PhotosSearch.vue:499`（保存智能视图后的「查看」） | 同上 | 同上 |
| `PhotosMomentDetail.vue:386,544` | `/photos/smart-views` | **不改** —— 它回的正是 For You |
| `PhotosSidebar.vue:44` 的 `route` | `/photos/smart-views` | **不改** —— 只改 `labelKey` |
| `usePhotosDeepLinks.ts:101` 的 `smart` | `/photos/smart-views` | **不改** —— Vue2 的 `view=smart` 目标态也是 For You 页 |

#### 返回按钮的文案：一处刻意不照抄 Vue2（登记为偏离）

Vue2 目标态 `939a7d3a:PhotosSmartViewDetail.vue:5` 的返回按钮文案**仍然是
`All Smart Views`** —— 而 `#112` 之后它的 `@back` 已经回到 Albums 列表。也就是说
Vue2 自己留了一个**文案说谎的按钮**（写着「所有智能视图」，点了去相册）。

按分支纪律「界面严格 1:1，但 Vue2 的 bug 不照抄，改正确逻辑并注释登记」——
误导性文案是用户可见缺陷，不是外观选择 ⇒ **New-UI 三处返回按钮改用本仓既有的
`photosAlbumBack`**（`相册` / `Albums`，`PhotosAlbumDetail.vue:433,445` 已是同一用途的
既定先例，**不新增键**）。`photosSvAllSmartViews` 随之成为死键，从两个 locale 删除
（先例：P8a-T6 删 `photosSvSettingsPending`）。

这条必须写在代码旁的偏离登记里，理由带上 Vue2 的行号，否则会被后来的评审当成漏移植。

---

## 6. 错误处理

- 瞬时反馈走 `src/stores/toast.ts` 的 `useToast().show()`，失败用 `'danger'` 档
- **两条转换失败：弹窗保持打开**，让用户直接重试（同 Vue2 两处的显式注释）
- **409 撞名复用既有 `photosAlbumNameExists`**，不新造近义键（Vue2 终审修补也是这么定的）
- **弹窗内的失败提示用内联**，不用 toast —— 答的是刚按的那个按钮，得钉在旁边、不自动消失
- 嵌入表单的提交/取消由它自己 `@created` / `@close` 处理，宿主接住后关闭整个面板；
  `nimo` 态下宿主自己的 Cancel / Create 脚**隐藏**，避免两套提交入口并存
- store 的写 action **抛出**，由视图层决定提示（沿用 P1 / P2a 的既定契约）
- 混排网格拉 `smartViews` 失败：只影响智能那半，手动相册照常渲染，不阻塞整页

---

## 7. 测试与收尾门

收尾六门（**控制器亲自复跑，不转述实现者的话**）：

1. `pnpm exec vue-tsc --noEmit`
2. `pnpm test`
3. `pnpm exec vitest run src/i18n/parity.test.ts`
4. `node oss/export.mjs --out <scratch> --no-commit --allow-dirty-oss`
5. `pnpm build`
6. color-guard：`pnpm exec vitest run src/styles`

另有两道结构闸会随全量套件跑到：`src/photos/composables/__tests__/deepLinkCoverage.test.ts`
（深链键集双向核对）、`oss/photosStripCoverage.test.mjs`（P2a 新加：三个枚举目录下的
`/photo/i` 文件漏登记即失败）。

已知踩过的坑，别再踩：

- **`oss` 门断言工作树干净** ⇒ 台账有未提交改动就报失败。先提交台账再跑，**不要 stash 绕过**。
- **`review-package` 脚本每跑一次就重建一次 `.superpowers/sdd/.gitignore`（一行 `*`）** ——
  提交台账前先 `rm`，且台账一律 `git add -f`。
- **新增测试文件必须同步登记进 `oss/manifest.mjs`** —— 这条在 P1/P2a 已红四次；
  且导出守卫在脏树上会中止，所以新测试只有**提交之后**才对泄漏守卫可见（会有第二轮修）。
- **CSS 注释里 `*` 紧贴 `/` 会提前关闭注释**，错误恢复吃到下一个块结束、吞掉整条规则，
  而六道门全部照不出来。
- **color-guard 不剥注释** —— 注释里写出 hex/rgba 字面量同样命中。
- 全量套件已知 flake：jsdom `Not implemented: navigation` 噪声、
  `DesktopContextMenu.test.ts` 单跑时失败、`persist.test.ts:55` 偶发红。

---

## 8. 分支与并发

- **接着 P2a 在同一分支 `sp15-photos-moments` 上做**，不另开分支
- **不需要先合 master**：P2a 期实测 master 相对本分支基线动的文件与相册区零重叠；
  本期目标文件集与 P2a 同一片，结论沿用（收尾前用 `git merge-tree --write-tree` 复核一次）
- 与并行的 `sp12-files-fixes` 唯一潜在共享面是 `src/i18n/*.base.ts`，**本期不碰它**，
  只改 `*.photos.ts`
- 合并时用 `git merge-tree --write-tree A B` 只读预演（退出码 0 + 单行 tree OID = 无冲突）；
  **后合的一方必须在合并结果上重跑全套门**

---

## 9. 任务切分（9 个）

机主选定的混合流程：**T1–T4 逐任务评审**（它们是后续任务的地基），**T5–T8 只进收尾整支
终审**，T9 是收尾。

1. **数据层** —— service 2 方法 + `SmartView.createdAt` + 两个 store action +
   `AlbumView` 扩 `videoCount`/`dateStart` ← 评审
2. **混排模型** —— `mixedAlbums.ts`（判别联合 + `sortMixed` null-first）+ `sortAlbums`
   删 `updated` + 改既有两条测试及其理由注释 ← 评审
3. **Albums 页混排** —— 网格混排 + 拉 smartViews + AI 停更横幅 + 排序接线 +
   智能卡跳详情 ← 评审
4. **创建融合** —— `SmartViewCreateDialog` 的 `embedded`/`initialName` + 第 4 个 source
   + 面板加宽 + 嵌入宿主接线 ← 评审
5. **For You 专页** —— SmartViews 页瘦身 + 侧栏 `labelKey` + §5.2 的 4 处回链改道
6. **相册详情** —— 统计侧栏四格 + 按月直方图 + 更多菜单对齐 `sv-export-item`
7. **相册 → 智能相册** —— `AlbumConvertToSmartDialog.vue` + 详情页接线 + 跳新 SV 详情
8. **智能相册 → 普通相册** —— SV 详情菜单项 + 内联确认框 + `converted_from_album` 文案
   + 清 P2a 挂账的中文注释
9. **收尾** —— 六门 + 验收清单 + 派整支终审（最强模型）

---

## 10. 验收（真机）

清单细节留给实施计划，这三条现在就定死：

- **第 0 步**：For You 专页在 `moments` 表为 0 行时**整块不出现**，那页看起来近乎空白
  **是预期行为**，不是本期缺陷。要验非空内容得先在浏览器控制台发一次
  `POST /v1/photos/moments/recompute`（带 `localStorage` 里的 token —— Photos 的 localhost
  白名单是 fail-closed 精确匹配，curl 直打必 401）。P1 与 P2a 已各栽一次同款假缺陷。
- **可验清单**（本机数据支持）：相册 5 + 智能视图 9 ⇒ 混排 14 项、全局排序五档、创建
  面板四选一、嵌入表单、相册详情统计侧栏（`album_assets` 40 行，Videos / By month 有数据）、
  更多菜单形态、**两条转换链**（转换只 pin 现有成员，与 CLIP 无关）
- **降级声明**：本机 9 个智能视图全是语义条件且从未评估（撞 BE-1，
  `text.token_embedding.weight` 缺失）；新建的智能相册若用语义条件，匹配数恒 0。
  照 SP14 `#136`/`#141` 的先例**提前声明，不假装验过**。
