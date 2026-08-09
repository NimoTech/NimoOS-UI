# SP15-P1 相册区补迁 · Moments 整块 —— 设计

> 写于 2026-08-09。分支 `sp15-photos-moments`，worktree `.claude/worktrees/sp15-photos-moments`，
> 基线 New-UI `master@9100418`（sp12-plan-b 合入后）。

---

## 0. 这一期在哪个位置

New-UI 的移植蓝本是 **2026-07-15 的 Vue2**（本地分支 `docs/vue3-migration-sp3`）。Vue2 `origin/main`
在那之后继续演进，相册区的增量 New-UI 一条都没有。本期是相册区补迁的第一部分。

### SP15 分期表（本文件只覆盖 P1）

| Part | 内容 | Vue2 提交 | 依赖 |
|---|---|---|---|
| **P1** | **Moments 整块**：时刻卡 + 详情页 + 拖拽排序 + pin/exclude/delete + 马赛克布局 + 导出相册 | `#100` `#107`–`#111` | 无 |
| P2 | Albums / SmartViews 统一：混排、创建二选一、For You 专页、详情对齐、双向互转；**外加 `#79`/`#82` 智能视图手动加/移/恢复照片**（见下方更正 2） | `#79` `#82` `#112`–`#117` | **依赖 P1** |
| P3 | 时间线性能线：分桶时间线 + 窗口化网格 + 增量写入 + 骨架屏按桶计数 | `#138`–`#140` | 与 P1/P2 低冲突 |
| P4 | 零散：人物区上线前 P0/P1 修复；**地点地图整块**（对比度 + 自定义配色三修 + 点阵性能重构） | `#137` `#106` | 无 |

**`#106` 不在 P1 里。** 它的标题（「提高地图未点亮点与背景的对比度」）严重低估了内容 —— 实际是四件事：
对比度提档、自定义配色三个 bug（含 `localStorage` 键语义变更、不做迁移）、**性能重构**
（2490 个 `<circle>` 抽成 `PlacesWorldDots` 子组件 + 配色改命令式写 CSS 变量 + `persistTheme` 250ms 防抖）、
外加 8 个新性能测试。动的是 Places 页（`PhotosPlacesView` / `PlacesWorldDots` / `photos-places.scss`），
与 Moments 的文件集**零重叠**，独立成活归 P4。
| P5 | cutover + 收口 | — | 全部 |

**P2 依赖 P1，顺序不能反**：Vue2 自己就是这个顺序，`#114` 明写「相册详情去封面横幅、头部/侧栏**对齐 Moment 设计**」。

### 两条与 roadmap 不一致、以本文件为准的事实

1. **roadmap §4 SP12 那份清单已过期。** 它的基线是 2026-08-07 的 `#136`；重算时 `origin/main` 已到 `#137`，
   多出 4 个动相册的提交（`#137`–`#140`），roadmap 一条都没登记 —— 已收进上表 P3/P4。
2. **不能按提交列表算范围，但也不能只看名字像不像 —— 我在这条上先错了一次。**
   最初判定「`#79`/`#81`/`#82` SP7 已吃掉」，依据是 `src/photos/stores/smartViews.ts` 里有
   `restoreSmartView`。**那是错的**：那个方法是「撤销删除智能视图」，与 `#79` 的
   「恢复被排除的**照片**」不是一回事。逐方法核对后的真实状态：

   | Vue2 提交 | 真实状态 |
   |---|---|
   | `#79` 智能视图手动加/移/恢复照片 | **未吸收**。New-UI 的 `packages/service/src/photos.ts` 里 `pinSmartViewAssets` / `removeSmartViewAssets` / `restoreSmartViewAssets` / `getSmartViewExcluded` **四个全无**（Vue2 `src/service/photos.js:158-161`）。**归 P2**。 |
   | `#82` 钉住/移除/恢复后刷新统计 | **未吸收**（依赖 `#79`）。**归 P2**。 |
   | `#81` PhotosToast 兼容 title + 跟随浅色主题 | **不适用**。New-UI 有自己的 `src/stores/toast.ts`，不是 Vue2 那个全局 `window.PhotosToast`，结构性无对应物。 |

   **对 P1 的直接影响**：`#79` 顺带把 `PhotosAlbumLibraryPicker.vue` 泛化成了通用的
   `PhotosLibraryPicker.vue`（`R072` 重命名 + 43 行改动）。New-UI 没跟上这一步，
   `src/photos/components/AlbumLibraryPicker.vue` 仍是相册专用（props 是
   `albumId`/`albumName`，内部直接调 `albums.addAssetsToAlbum`）⇒ **P1 的「Add photos」
   不能直接复用它**，要先做同款泛化。见 plan Task 9。

   教训：判「已吸收」必须逐方法/逐组件核对，方法名相近不算证据。

---

## 1. P1 范围

### 1.1 做

- **数据层**：service 8 个方法 + Pinia store
- **时刻卡**：4 拼贴模板（T1/T2/T3/T4）+ single、三档尺寸、`+N this week` 绿标、dense 密排
- **「For You」分区**：挂在 `/photos/smart-views` 页内（与 Vue2 同位置），SortableJS 拖拽排序
- **详情页**：走**独立路由** `/photos/moments/:id`
  - Featured / All photos 两段网格
  - Add photos（复用 `AlbumLibraryPicker`）
  - Select 多选 → 从时刻移除
  - Save as Album
  - 更多菜单 → 删除时刻
  - 右栏 About / Stats / By month 分布直方图

### 1.2 不做（各有出处，别在实现期重新讨论）

| 不做的 | 理由 |
|---|---|
| P2 的 IA 合并（albums 与 smart-views 仍是两条独立路由） | 那是 P2 的范围；提前做会让两期边界糊掉、风险向前集中 |
| **重算入口** | Vue2 也没有 —— `src/service/photos.js:221-222` 原注释 *"Reserved: backend POST recompute trigger endpoint, not yet exposed in the UI (no call site)"*，全仓零调用点。加它是新功能，撞「界面严格照 Vue2」纪律。验收改用控制台一行 |
| theme 类时刻的语义生成 | BE-1（`text.token_embedding.weight` 缺 1.1 GB），机主 2026-08-03 已裁定不补 |

---

## 2. 真机数据现状（决定验收怎么设计）

在设备库 `/DATA/.system_data/photos/photos.db` 上实测（只读打开）：

| 事实 | 数值 |
|---|---|
| `assets` | 785 |
| `moments` | **0** |
| `moment_assets` | 0 |
| `moment_recipes` | 8 条，全部 `enabled=1` |
| `asset_geo` | **7**（GPS 覆盖率 7/785） |
| `user_profile_entities` | 1 条（某人 299 张，`updated_at` = 2026-08-08） |

8 条 recipe 里 5 条是 `theme:*`（靠 CLIP 文本向量，被 BE-1 卡死），另外 3 条是
`trip` / `profile:pets` / `profile:family`，**不依赖 CLIP**。

**为什么 3 条不依赖 CLIP 的也是 0：**

- 后端 `service/moments.go` 的 `RecomputeAll` 是**逐 recipe 隔离**的（单条失败只 `Warn` 跳过、继续下一条，
  注释里明写这是为了「ML 掉线不该让 trip 永远算不出来」）⇒ **不是「theme 挂了拖垮全部」**。
- `trip` 靠 GPS 聚类，`asset_geo` 只有 7 行 ⇒ 聚不出行程。
- `profile:family` 的候选实体 2026-08-08 才写入，调度器每天 04:xx 跑一次
  （`StartScheduler`：`t.Hour() != 4 || t.Minute() >= 5` 即跳过）⇒ 可能还差一轮。

**结论：真机上 Moments 最好情况 1 条（家人），最坏 0 条。这不是 bug，是这台机器的照片库不具备条件。**

### 2.1 由此产生的两条硬约束

1. **Vue2 的 `showMoments()` 在 `moments.length === 0` 时隐藏整个 For You 分区。** 所以界面做完打开
   看不到任何东西**是预期行为**。这条必须写在验收清单**第一行**，避免又出一轮假缺陷。
2. **验收第一步固定是手动触发一次重算。** `POST /v1/photos/moments/recompute` 需要真 JWT ——
   Photos 的 localhost 白名单是 fail-closed + 精确匹配，只放行 `POST /search/smart` 与 `GET /albums`
   （`route/router.go` 的 `mcpReadSkip`），curl 直打必 401。改用浏览器控制台，带机主自己的登录态。

---

## 3. 落点与复用

| 文件 | 动作 |
|---|---|
| `packages/service/src/photos.ts` | +8 方法：`listMoments` / `getMomentAssets` / `pinMomentAssets` / `excludeMomentAssets` / `deleteMoment` / `exportMomentAlbum` / `reorderMoments` / `recomputeMoments`；配套 `photos.moments.test.ts` |
| `src/photos/stores/moments.ts` | 新建 |
| `src/photos/util/momentLayout.ts` | 新建：`assignMomentSizes` / `pickMomentTemplate` 抽成**纯函数**（Vue2 那边本就是 `export function`，天然可单测，不必挂组件） |
| `src/photos/components/MomentCard.vue` | 新建，三行 meta 结构照 `src/photos/components/SmartViewCard.vue` |
| `src/views/PhotosMomentDetail.vue` | 新建，**复用 `src/views/PhotosSmartViewDetail.vue` 已有的 `sv-detail-*` 两栏骨架与样式** —— Vue2 自己就是这么复用的（`PhotosMomentDetail.vue` 顶栏注释写着 "same as sv-detail-bar"） |
| `src/views/PhotosSmartViews.vue` | 加 For You 分区（现 220 行） |
| `src/router/index.ts` | 追加 `/photos/moments/:id`，照 SP7-P8a-T5 的「只追加、不重排」约束 |

**零新依赖**：`sortablejs@^1.15.7` 与 `@types/sortablejs` 已在 `package.json`。

### 3.1 Vue2 侧的源坐标

- `src/views/Photos/PhotosMomentDetail.vue`（441 行，新增）
- `src/views/Photos/PhotosSmartViewsView.vue`（+274，含 `assignMomentSizes` / `pickMomentTemplate` / 内联 `MomentCard`）
- `src/views/Photos/photos-smartview.scss`（+156）
- `src/service/photos.js:200-223`（moments API 段）

---

## 4. 三个「照抄会错」的地方

### ① 后端没有单条时刻接口

`NimoOS-Photos/route/router.go` 只有 `GET /moments`（全量列表）与 `GET /moments/:id/assets`，
**没有 `GET /moments/:id`**。Vue2 内联渲染时详情对象由列表直接传下来，不存在这个问题；一旦路由化，
**直接深链 `/photos/moments/xxx` 就拿不到 moment 元数据**。

设计：store 缓存优先 → 缓存为空则拉全量列表再按 id 查找 → 仍找不到则渲染明确的「时刻不存在」态，
**不是空白页**。

### ② Sortable 的重绑时机不能照抄

Vue2 用两个 `watch` 监听「详情 ↔ 列表」切换来重绑 Sortable，因为回列表时 `.mo-grid` 是全新 DOM 节点、
旧实例已失效。路由化之后**那两个 watch 在 New-UI 里没有对应物** —— 等价物是列表页自己的挂载生命周期。
照抄 watch 会得到一段永远不触发的死代码。

### ③ 空态会把整块藏掉

见 §2.1 第 1 条。

### ④ 异步过期守卫（纪律项）

详情页拉 assets 必须带 epoch/uuid 过期守卫；回归测试要走**交错路径**。这类竞态在 New-UI 已被终审逮过四次。

---

## 5. 错误处理

- 瞬时反馈走 `src/stores/toast.ts` 的 `useToast().show()`（相册区现有通道，`AlbumLibraryPicker.vue:21,33` 即用它）
- 删除时刻的确认弹窗照 `PhotosSmartViewDetail.vue` 现有形态（`confirmDeleteOpen` + mousedown/keydown 双监听 + `anyOverlayOpen`），**不新造**
- **弹窗内的失败提示用内联**，不用 toast —— 答的是刚按的那个按钮，得钉在旁边、不自动消失
- 排序失败：乐观更新 + 回滚 + toast

---

## 6. 测试与收尾门

收尾五门（控制器亲自复跑，不转述实现者的话）：

1. `pnpm exec vue-tsc --noEmit`
2. `pnpm test`
3. `pnpm exec vitest run src/i18n/parity.test.ts`
4. `node oss/export.mjs --out <scratch> --no-commit --allow-dirty-oss`
5. `pnpm build`

**外加 color-guard** —— 本期 CSS 增量大（Vue2 侧仅 scss 就 +156 行）。并特别防这个坑：
**CSS 注释里 `*` 紧贴 `/` 会提前关闭注释，错误恢复会吃到下一个块结束、吞掉整条规则**，而上面五道门
全部照不出来（类名白名单/裸色扫描/color-guard 只看源文本，vue-tsc 不看 CSS，build 不报错，jsdom 不做布局）。

已知非缺陷，跑测试时别去追：
- 全量套件会打 jsdom `Not implemented: navigation` 噪声
- `src/home/components/DesktopContextMenu.test.ts` 只在单独跑那一个文件时失败（SP11 遗留的 reka-ui 隔离 flake）
- `src/files/upload/persist.test.ts:55` 偶发红（SP4 期既有 flake）

---

## 7. 分支与并发

- worktree `.claude/worktrees/sp15-photos-moments`，分支 `sp15-photos-moments`，从 `master@9100418` 开
- `sp12-plan-b` 已于本期开工当天合入 master（`9100418`），不再是并发面
- 与并行的 `sp12-files-fixes` **有两处潜在重叠，不是零重叠**：
  - `src/i18n/en_us.base.ts` / `src/i18n/zh_cn.base.ts` —— 双方都要加键。**真冲突面**，
    合并时按行合即可，但**必须在合并结果上重跑 i18n parity**
  - `src/views/Files.vue` 及其两个测试 —— 本期不碰，无冲突
  - 其余（`src/files/components`、`src/files/util`）本期不碰
- 合并前用 `git merge-tree --write-tree A B` 只读预演（退出码 0 + 单行 tree OID = 无冲突）；
  **后合的一方必须在合并结果上重跑全套门**

---

## 8. 验收（真机）

清单细节留给实施计划，但这两条现在就定死：

- **第 0 步**：F12 控制台发一次 `POST /v1/photos/moments/recompute`（带 `localStorage` 里的 token），再刷新页面
- **第 1 行提示**：如果 For You 分区整块不出现，先确认 `moments` 表是否仍为 0 —— 那是数据不足，不是本期缺陷

若重算后仍为 0 条，本期验收降级为「空态 + 数据层链路」可验，卡片与详情页两块**挂账**，
参照 SP14 `#136`/`#141` 的先例提前声明，不假装验过。
