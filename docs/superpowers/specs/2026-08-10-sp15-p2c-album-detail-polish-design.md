# SP15-P2c 相册详情打磨累积 —— 设计

> 写于 2026-08-10。分支 `sp15-photos-moments`（**接着 P1/P2a/P2b 往下做，不另开分支**），
> worktree `.claude/worktrees/sp15-photos-moments`，基线 = P2b 收官处 `61a666c`。
> 流程：机主 2026-08-10 拍板 —— **整期做完**（不再拆），**全程逐任务评审**（每个任务
> 一轮独立评审 + 收尾整支终审）。

---

## 0. 这一期在哪个位置

SP15-P2 拆三块（见 `2026-08-09-sp15-p2a-...-design.md` §0 与
`2026-08-10-sp15-p2b-...-design.md` §0）：

| 子期 | 内容 | Vue2 提交 | 状态 |
|---|---|---|---|
| P2a | 智能视图手动加/移/恢复照片 | `#79` `#82` | 已收官（未验收） |
| P2b | IA 合并：智能视图并入 Albums | `#112` `#113` | 已收官（未验收） |
| **P2c** | **相册详情打磨累积**（本文件） | `#114`–`#117` | 本期 |

P1 / P2a / P2b 三期都是 code-complete、一步验收没跑，全堆在这一条分支上。P2c 同样停在
分支上，不部署、不推 origin、不合 master。

### 0.1 1:1 靶子 = `33b05636`（`#117`）

```
899af59b  #111   ← P1 / P2a 的靶子
939a7d3a  #113   ← P2b 的靶子
6e4d132d  #114   ┐
0c46d11e  #115   │ 本期
9f7e941f  #116   │
33b05636  #117   ┘ ← P2c 的靶子
```

取源码一律 `git -C /home/nimo/NimoTech/NimoOS-UI show 33b05636:<path>`。

`#118` 之后仍动过本期文件的提交只有三个，都不在本期范围：

| 提交 | 内容 | 归属 |
|---|---|---|
| `3822d378` `#133` | 翻译中文注释 + 硬编码串走 i18n | 与本期无关，但**取 i18n 值时注意**：`33b05636` 的 `zh_CN.json` 才是本期靶子文案 |
| `03245590` `#137` | People 修复 | P4 |
| `7ce2d211` `#138` | 时间线分桶 / 窗口化网格 | P3 |

### 0.2 照终态做，不逐提交复现

`#114`–`#117` 是同一次版式收敛的连续打磨，后一个反复推翻前一个：

- `#115` 新立的 `.album-detail-toolbar` 横带，`#117` 整个取消
- `#114` 放在头部的动作排，`#115` 下移到工具条行，`#117` 再搬进侧栏
- `#117` 自己的 8 个子提交里，前一条刚把 ⋯ 菜单按"向下展开够用"定稿，最后一条就因为真机
  截图被侧栏裁切而改成 fixed 定位

⇒ 逐提交复现等于把两个中间态各实现一遍再拆掉。**一律照 `33b05636` 的终态实现。**

### 0.3 一处已经提前吃掉的

`#117` 第一条子提交「转普通相册确认键补主色背景（`lb-confirm` 作用域缺非危险变体）」，
正是 P2b 终审 8 个 Important 里的一条，P2b 修复波已修完。本期不重复做，plan Step 0
须复核该修复仍在。

---

## 1. 范围

### 1.1 做

1. **相册详情整页换骨架**：删 hero 封面横幅与 `.album-detail-toolbar` 横带，改用 SV 详情
   同款 `sv-detail-bar` + `sv-detail-layout`（`sv-detail-main` / `sv-detail-side`）
2. **相册详情头部**：`sv-header` = h1（标题 + 点击改名 + 日期胶囊同行）→ `sv-header-stats`
   （items / videos）→ `sv-actions`（Sort 胶囊 → Edit·Done → 密度二钮）
3. **相册详情侧栏三节**：动作节（`sv-side-actions`）→ About（Type / Created / Time span /
   Place）→ Stats **2 格**（Photos / Videos）→ 按月直方图
4. **⋯ 菜单五项，两页统一**：Rename / Duplicate / Download as ZIP / Convert / Delete
5. **两个新能力**（机主 2026-08-10 拍板「两个都补」）：Duplicate、Download as ZIP
6. **菜单 fixed 定位**：新 composable `useFixedMenuPosition`，两个详情页共用
7. **SV 详情动作区对齐 Album 形态**：头部收敛到 Pause/Resume + Edit·Done（+Sort/密度）；
   Refine in search 与 ⋯ 菜单搬进侧栏动作节；原 Export 两项并入五项菜单；Add photos /
   Select 改走 Edit 模式
8. **SV 详情删除 Add condition 入口**（机主拍板「跟着删」）
9. **SV 详情灯箱导航序对齐当前排序**
10. **Albums 页智能卡改与手动相册卡同构**；`New album` 创建卡尺寸对齐相册卡
11. `SmartViewCard.vue` 删除（连组件 + 测试 + 开源剥离清单）
12. i18n 键增删，两 locale 同步

### 1.2 不做（各有出处，别在实现期重新讨论）

| 不做的 | 理由 |
|---|---|
| Slideshow | New-UI 从 SP7 起就没有（`PhotosAlbumDetail.vue:6` 已登记：Vue2 本身也只弹「敬请期待」toast）。侧栏动作节因此只剩 ⋯ 菜单一个按钮，这是预期形态 |
| Ask Nimo | Vue2 在 `#117` 第三轮反馈里自己删了（顶部全局 Ask Nimo 已够用）⇒ New-UI 的「没有」与终态天然一致 |
| `#137` / `#138` 带的相册文件改动 | P4 / P3 的范围 |
| 抽共享组件（⋯ 菜单 / 侧栏动作节） | 见 §3.4 —— 机主选定方案 B，只抽逻辑不抽视图 |
| 部署 / 推 origin / 合 master | 机主指定本期停在分支上等统一验收 |

---

## 2. 结构差：New-UI 现状 vs 终态

### 2.1 相册详情 `src/views/PhotosAlbumDetail.vue`（1109 行，P2b 收官形态）

| 终态要素 | New-UI 现状（已取证） | 判定 |
|---|---|---|
| `sv-detail-bar` 顶栏 | 无。现在是 hero 内的 back 按钮（`:524`） | **新建** |
| `sv-detail-layout` 双栏 | 有 `.album-detail-body`（P2b Task 6 建），语义不同：头部/工具条通顶、只有网格+侧栏两列滚 | **换掉** |
| hero 封面横幅（`.album-hero*`，`:522-629`） | 在 | **删除**，连 `coverBgImage` computed |
| `.album-toolbar` 横带（`:631`） | 在 | **删除**，Sort/密度移进 `sv-header` 的 `sv-actions` |
| `sv-header` h1 + stats 行 | 无（现在是 `.album-hero-text` 里的 badge/title/sub） | **新建** |
| 侧栏 `sv-side-actions` 动作节 | 无 | **新建**（New-UI 只放 ⋯ 菜单） |
| 侧栏 About 节 | 无 | **新建** |
| 侧栏 Stats | 有，**4 格**（Photos/Span/Videos/Created，`:731-750`） | **裁到 2 格**（Span/Created 与 About 两行同数据字面重复） |
| 侧栏按月直方图 | 有（P2b Task 6） | 保留 |
| ⋯ 菜单 | 3 项（Rename/Convert/Delete，`:584-624`） | **扩到 5 项** |
| 编辑态底部浮条 | 现在是 `.album-toolbar[data-edit]` 内的按钮 | **改 `sv-select-bar` 底部浮条** |

`.album-toolbar[data-edit="true"] ~ .tile` 这类兄弟选择器在 P2b Task 6 已因包一层 wrapper
断过一次（见 P2b 台账 Task 6 条目）。本期删掉整个 `.album-toolbar` ⇒ **所有以它为锚的兄弟
选择器都会失效，且没有任何自动门看得见**。plan 必须列一条专门的清点步骤。

### 2.2 SV 详情 `src/views/PhotosSmartViewDetail.vue`（1257 行）

骨架已是终态形制（`sv-detail-bar` `:605` / `sv-detail-layout` `:628` / `sv-detail-main`
`:629` / `sv-header` `:630` / `sv-actions` `:663` / `sv-detail-side` `:850`）⇒ **本期只改
动作区与菜单，不动骨架**。

| 终态要素 | New-UI 现状 | 判定 |
|---|---|---|
| 头部 `sv-actions` | 5 个按钮：Pause / Add photos / Select / Refine in search / ⋯ | **收敛**到 Pause + Edit·Done（+Sort/密度） |
| `sv-side-actions` 侧栏动作节 | 无 | **新建**：Refine in search + ⋯ 菜单 |
| ⋯ 菜单 | Export 区（ZIP `:714` / Save as album `:721`）+ 更多区（Rename/Duplicate/Convert/Delete `:741-771`） | **合并成统一五项** |
| Add condition 入口 | `SmartViewConditionEditor`（`:648-652`）带 add + remove | **删 add 半边**，remove（胶囊上的 ✕）保留 |
| 灯箱导航序 | 未对齐当前排序 | **对齐** |

### 2.3 Albums 页 `src/views/PhotosAlbums.vue`（701 行）

智能卡现在渲染 `<SmartViewCard>`（`:411`，P2b Task 3 接的）。终态改成与手动相册卡同构的
内联渲染：单封面（`seeds[0]`，空则 `.album-cover-fallback`）+ Smart 角标 + Live/Paused
呼吸点叠在封面 + 标题 + meta 行（`{n} photos` · Live/Paused）。三图拼贴、条件 chips、
阈值胶囊都不再上卡面。

**混排的数据层全部保留** —— `buildMixedAlbums` / `sortMixed` / `item.kind` / 网格 `:key`
的 kind 前缀（P2b Task 3 已查明它不可被测试观测，但仍保留）都不动，换的只是渲染层。

`SmartViewCard.vue` 的唯一生产消费者就是 `PhotosAlbums.vue:411`（全仓 grep 确认，其余命中
都是注释引用与它自己的测试）⇒ 组件与 `__tests__/SmartViewCard.test.ts` 一并删除。
**删文件必须同步开源剥离清单** —— 该清单对 `src/views/**` 与 `packages/service/src/**` 下的
相册文件是逐个列举的，P1+P2a 因漏登记新增文件红过四次；P2a 已加结构性守卫
`oss/photosStripCoverage.test.mjs`。本期是**删**文件，方向相反，plan 须确认该守卫对"清单
里列了但文件已不存在"是否也报错。

---

## 3. 四个机主裁定（2026-08-10，全期有效）

### 3.1 整期做完 + 全程逐任务评审

依据：P2a 轻流程 → 终审一次逮到 1 Important + 6 Minor + 5 处「测试因为错的理由通过」；
P2b 混合流程 → 终审逮到 1 Critical + 8 Important，其中 **6 条是任何自动门都看不见的 1:1
视觉破绽**。P2c 几乎全是模板/CSS 版式改造，正是那类缺陷的高发区。

### 3.2 Duplicate 与 Download as ZIP 两个都补

- **Duplicate**：`createAlbum` + `addAssetsToAlbum` 组合，两个 action 在
  `src/photos/stores/albums.ts`（`:97` / `:167`）都现成；store 另有 `saveAsAlbum`（`:205`）
  可评估复用。零后端改动。
- **Download as ZIP**：后端 `GET /v1/photos/albums/:id/export` **已实现**
  （`NimoOS-Photos/route/router.go:178`，handler 在 `route/v1/albums.go:84`），且在 JWT
  豁免白名单里（`router.go:52`，按路径后缀匹配）⇒ 走 favorites 同款 GET + `?token=` 模式。
  Vue2 注释里「后端端点并行开发中」的说法在今天已经过期。

### 3.3 删除 Add condition 入口

Vue2 `#117` 的注释写明是「用户追加需求」，即产品决定而非遗漏。跟着删，`remove` 保留。

### 3.4 方案 B：只抽逻辑，不抽视图

菜单 fixed 定位做成 composable `useFixedMenuPosition`（对应 Vue2 的 `fixedMoreMenu.js`
mixin），两个详情页共用；**菜单模板与 CSS 仍各写一份**。

理由分两层：
- Vue2 自己划的线就在这里 —— 它抽的是 mixin（逻辑），没抽组件。抽逻辑本身就在 1:1 靶子里。
- P2b 那条「KEEP THE DUPLICATION」裁定的理由是 **scoped 样式跨不了 SFC**，只对 CSS 成立，
  对纯 TS 逻辑不适用。composable 是新文件，不返工任何已关账的文件。

---

## 4. plan Step 0 必须先取证的事实

P2b 一期出了 10 处计划/派工缺陷，其中 3 个 Important 直接源于计划自身矛盾，且两个 i18n
猜测值全错。本期把易错项前置成取证步骤：

1. **i18n 值一律从靶子取**，不猜：
   `git -C /home/nimo/NimoTech/NimoOS-UI show 33b05636:src/assets/lang/zh_CN.json`。
   本期涉及新增（About / Type / Time span / Place / Duplicate / Download as ZIP / Copy the
   photos as a new album / …）与**改短**（`Rename album`→`Rename`、`Convert to Smart Album`
   →`Convert`、`Delete album`→`Delete`）两类，改短后原长标题键若无其它消费者要清理孤儿。
2. **`.album-toolbar` 兄弟选择器清点**（见 §2.1 末）—— 删容器前先 grep 出所有以它为锚的
   规则，逐条决定新家。
3. **`sv-select-bar` 在 New-UI 是否已存在**、其现有语义是否可直接承接相册编辑态。
4. **`Photo.place` 的实际可用性**：字段存在（`src/photos/util/assetToPhoto.ts:295`，
   源自 `asset.placeName`，无则 `countryFromCoords` 按经纬度反查国家名兜底）。plan 需确认
   相册资产列表接口是否返回 `placeName` / 经纬度。
5. **`oss/photosStripCoverage.test.mjs` 对"清单列了但文件已删"的行为**（见 §2.3 末）。
6. **P2b 那条 `lb-confirm` 主色修复仍在**（见 §0.3）。
7. **`exportAlbumZipUrl` 在 `packages/service` 里是否已有同形前例**（favorites 的
   `exportFavoritesUrl`），有则照抄其 token 拼接手法。

---

## 5. 风险与验收注意

### 5.1 返工面

P2b 的 Task 3（混排卡片渲染）/ Task 6（相册详情双栏）/ Task 8（SV 详情 Escape 守卫所在
文件）都会被本期改动。这是 Vue2 自己的迭代路径，不是白做 —— 数据层、双向互转、store 全部
保留，被换掉的是渲染层。评审时**不要**把「刚做完又改」当作缺陷。

### 5.2 P2a 入口形态变化

Add photos / Select 两个按钮从头部动作排改走 Edit 模式（功能保留、位置变）。P2a 的相关测试
会因选择器变化而红，属预期，须**逐条搬家而不是删除**（P1 Task 9 的 Step 0 就在这里丢过一条
断言，评审逐条点名才发现）。

### 5.3 验收清单必须写明的预期行为

- **Place 行**：真机 `asset_geo` 仅 7 行 / `assets` 785。相册成员若无 GPS，Place 行显示
  `—` 是**预期**，不是缺陷。`countryFromCoords` 兜底只在有经纬度时生效。
- **Download as ZIP 是真会下载文件的按钮**，jsdom 验不出来，必须真机点。
- **真机数据**：albums 5 / album_assets 40 / smart_views 9（全 paused，从未评估）/
  moments 0。For You 页空白仍是预期（P2b 终审 Critical 的教训：不要把空白当正确写进断言，
  但也不要把数据为空当缺陷报）。

### 5.4 已知的高危盲区（沿用前期教训，逐条进 plan 的公共约束）

- CSS 注释里 `*` 紧贴 `/` 会提前关闭注释并吞掉后面整条规则，五道门全瞎
- 新写的注释一律英文（P2b 一期栽了四次，靠 pre-commit grep 每次才抓住）
- `oss/*.test.mjs` 断言**工作树干净** ⇒ 台账未提交时它报的失败是假红；跑门前先提交台账
- `review-package` 脚本每跑一次就重建 `.superpowers/sdd/.gitignore`（一行 `*`），提交台账
  前先 `rm`
- 兄弟选择器 / 容器嵌套变化对样式的破坏，任何自动门都看不见

---

## 6. 门

沿用 P2b 收官的六门，全部在**干净工作树**上跑：

```
pnpm exec vue-tsc --noEmit
pnpm test                       # 全量
src/i18n/parity.test.ts         # 两 locale 键一致
src/styles                      # color-guard
oss/*.test.mjs                  # 开源剥离，含 photosStripCoverage
pnpm build
git merge-tree --write-tree master HEAD   # 与 master 的冲突预演
```

---

## 7. 交付形态

分支 `sp15-photos-moments` 上的一串提交，code-complete。不部署、不推 origin、不合 master。
收尾产出 `docs/superpowers/2026-08-10-sp15-p2c-acceptance.md` 真机验收清单，与 P1/P2a/P2b
的三份一起等机主统一验收。
