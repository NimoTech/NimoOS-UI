# SP15-P2a 智能视图·手动加/移/恢复照片 —— 设计

> 写于 2026-08-09。分支 `sp15-photos-moments`（**接着 P1 往下做，不另开分支**），
> worktree `.claude/worktrees/sp15-photos-moments`，基线 = P1 收官处 `bbcd087`。

---

## 0. 这一期在哪个位置

SP15-P2 原设计是「Albums / SmartViews 统一」一整块（`#79` `#82` `#112`–`#117`）。
开工前量了体量:**8 个提交、约 5800 行新增**,而 P1 是 6 个提交约 1900 行做了整整一天。
一期做不完,拆三块:

| 子期 | 内容 | Vue2 提交 | 依赖 |
|---|---|---|---|
| **P2a** | **智能视图手动加/移/恢复照片 + 写后刷新统计**（本文件） | `#79` `#82` | 无 |
| P2b | IA 合并:智能视图并入 Albums（混排/创建二选一/For You 专页/深链承接/全局排序/双向互转） | `#112` `#113` | 无（但 P2c 等它） |
| P2c | 相册详情重构与打磨累积 | `#114`–`#117` | **依赖 P2b** |

**先做 P2a 的理由**:它与 IA 改动零依赖,是三块里唯一的纯功能补齐;
而且它要用的泛化 picker P1 刚做完 —— 相当于把那笔投入兑现。

> **⚠️ `#112` 会返工 P1 的成果。** 它让智能视图页瘦身成纯 Moments「For You」专页
> （728 → 317 行）,`mo-hero` 从分区标题升格为页面唯一 h1,原 SV 网格与创建弹窗整体并入
> Albums 页。P1 的 Task 5 届时要重做一遍。这是 P2b 的账,不是 P2a 的。

### 一条容易搞错、以本文件为准的事实:P2a 的靶子

P1 设计把 `#79`/`#82` 划归 P2 —— 那是**工作排期**的决定,不是关于时间顺序的断言,
本身没错。但排期表容易让人顺手把 `#82` 当成 P2a 的 1:1 靶子。**别这么做,顺序是反的**:

| 提交 | 日期 |
|---|---|
| `ccaccd36` `#79` | 2026-07-17 |
| `3584eb90` `#82` | 2026-07-18 |
| `899af59b` `#111`（**P1 的 1:1 靶子**） | 2026-07-29 |

⇒ **P2a 的 1:1 靶子仍是 `899af59b`,不需要新基线。** 在那个提交上 picker 本来就叫
`PhotosLibraryPicker.vue`,`PhotosSmartViewDetail.vue` 里本来就有加/移/恢复那套 UI。
New-UI 这页当初（SP7）是照一个**比 `#79` 更早**的 Vue2 状态移植的,所以整块缺失。

**改名因此不是一个独立决策**,是「对齐到靶子」的一部分（但见 §4 ③ 的限定）。

---

## 1. 范围

### 1.1 做

- **service**:4 个方法
- **store**（`src/photos/stores/smartViews.ts`）:4 个 action,**每个内置写后回拉统计**;
  `excluded` 列表也归 store
- **`assetToPhoto`**:补 `pinned` 字段
- **`PhotosSmartViewDetail.vue`**（现 854 行）:
  - 「加照片」按钮 + 挂 picker
  - Select 多选态 + 选择栏 + 「从此视图移除」
  - 瓦片 pin 角标（recent 与 matched 两个网格都要）
  - 可折叠「已排除（N）」分节 + 点击恢复
- **改名**:`AlbumLibraryPicker.vue` → `PhotosLibraryPicker.vue`,连带**改名时已有的 2 个
  消费方**（`PhotosAlbums.vue` / `PhotosAlbumDetail.vue`）、它自己的测试文件、开源剥离清单。
  第三个消费方是本期任务 3 新接的详情页,那时用的已经是新名字
- i18n 约 8 个键,两个 locale

### 1.2 不做（各有出处,别在实现期重新讨论）

| 不做的 | 理由 |
|---|---|
| `#112`–`#117` 全部 | P2b / P2c 的范围 |
| 逐任务评审 | 机主 2026-08-09 拍板本期流程轻一级:合并任务,只保留收尾整支终审 |
| 抽 `PhotosMomentDetail.vue` 的 grid 子组件 | P1 挂的独立票,且本期不碰那个文件 |

---

## 2. 真机数据现状（决定验收怎么设计）

在设备库 `/DATA/.system_data/photos/photos.db` 上实测（只读打开）:

| 事实 | 数值 |
|---|---|
| `smart_views` | **9**（全部名为「爬山」,`live=0`,`evaluated_at` 全为 `null`） |
| `smart_view_matches` | **0** |
| `smart_view_activity` | 9 |
| `albums` / `album_assets` | 5 / 40 |

那 9 个是 SP7 验收期反复点击留下的测试数据,**从未被评估过**,且「爬山」是语义条件
⇒ 撞的是与 moments `theme:*` 同一个 **BE-1**（`text.token_embedding.weight` 缺失）。

### 2.1 由此产生的一条硬约束:「已排除」默认填不出数据

后端 `RemoveAssets` 是**分层**的（`service/smartview.go`,`origin` 0=自动 / 1=钉住 / 2=排除）:

| 被移除的行 | 结果 |
|---|---|
| `origin=1`（手动钉住） | **DELETE 该行**（取消钉住），返回 `unpinned+1` |
| `origin=0`（自动匹配） | `UPDATE origin=2`（排除），返回 `excluded+1` |
| 已排除 / 表里没有 | no-op |

⇒ **只有移除「自动匹配」的照片才会产生排除行。** 而本机 `smart_view_matches` 为 0、
所有视图暂停且依赖 CLIP ⇒ 自己加进去再移除只会是「取消钉住」,**「已排除（N）」分节
永远不出现**。

### 2.2 绕开办法（验收前置步骤,不是代码改动）

条件类型共五种（`service/svparser.go`）:`person` / `place` / `date` / `semantic` / `ocr`。
**只有 `semantic` 走 CLIP 文本向量**（`smartview.go:868` 的 `c.Kind == condSemantic` 分支）。

⇒ **验收时先在界面上新建一个「日期」条件的智能视图并置为 live**,让它真正评估出
自动匹配行,「已排除」这条路径才活。**这一步必须写在验收清单第 0 步**,否则又是一轮
假缺陷（P1 已经栽过一次同款）。

若该步骤实测走不通,本期验收降级为「加照片 / 取消钉住 / pin 角标 / 统计刷新」可验,
**「已排除 + 恢复」两块挂账**,照 SP14 `#136`/`#141` 的先例提前声明,不假装验过。

---

## 3. 后端契约（已回源核对 `NimoOS-Photos/route/v1/smartviews.go`,不要凭印象改）

| 端点 | 响应 |
|---|---|
| `POST /photos/smart-views/:id/assets` `{assetIds}` | `{added}` |
| `POST /photos/smart-views/:id/assets/remove` `{assetIds}` | `{unpinned, excluded}` |
| `POST /photos/smart-views/:id/assets/restore` `{assetIds}` | `{restored}` |
| `GET /photos/smart-views/:id/excluded` | **裸数组**（不带包裹键） |

**资产上的 `pinned` 是 `json:"pinned,omitempty"`**（`service/types.go:91`）
⇒ **false 时字段整个不出现**,归一必须写 `!!raw.pinned`,不能假设字段一定在。

> **⚠️ 写操作只返回「改了几张」,拿不到新的 `count` / `median` / `storageBytes`。**
> 这就是 `#82` 存在的原因 —— 那次回拉是**必需的**,不是可以优化掉的冗余。

---

## 4. 三个「照抄会错」的地方

### ① `#82` 的「原地合并保引用」在 New-UI 是个非问题

Vue2 用 `MERGE_SMART_VIEW_STATS` + `Vue.set` 原地合并,是为了保住对象引用不变,让详情页
头部与列表卡片同时刷新。**New-UI 不需要**:`PhotosSmartViewDetail.vue` 的
`sv = computed(() => store.byId(svId.value))` 是派生量,SP7 已经在结构上解决了同一问题
（该文件顶部注释明写这条是 §7e-2 的核心修复）。

⇒ New-UI 版只需:写操作成功后回拉该视图,更新 store 列表项;头部与卡片自动跟随。
照抄 `Vue.set` 原地合并会得到一段为不存在的问题服务的代码。

### ② 回拉统计放在 store action 内部,不放调用处

Vue2 是在组件里手动 dispatch `refreshSmartViewStats`,而 **`#82` 这个提交存在的原因,
正是当初在调用处漏了**。放进 action 里,调用方就没有机会忘。

先例:P1 的 moments store 把 `applyAssetCount` 放在 `pin`/`exclude` 内部。

### ③ 改名是还债,不是 1:1 要求

New-UI 的文件名本来就不镜像 Vue2（`PhotosSmartViewsView.vue` → `PhotosSmartViews.vue`）,
所以「靶子上叫 `PhotosLibraryPicker`」本身不构成改名理由。**真正的理由是 P1 登记的债**:
P1 把这个组件泛化成了与相册无关的通用 picker,名字从那一刻起就在说谎。

⇒ 改名**单独一个提交、排在功能之前**,让功能 diff 干净,也把开源剥离清单的改动与逻辑
分开（那份清单本期已经因为漏登记红过两次）。

### ④ `#79` 对两个相册页的改动,P1 已经付过一半

Vue2 `#79` 改 `PhotosAlbumsView.vue` / `PhotosAlbumDetail.vue` 各 37 行,内容**正好是**
picker 泛化（props 换成 `title`/`existingIds`/`existingLabel`/`submitLabel`、
`existingIds` computed 上提、confirm 交回调用方）**加上改名调用点**。

P1 的 Task 9 Step 0 已经做完泛化那半 ⇒ **本期在这两个文件里只剩改名**。

---

## 5. 错误处理

- 瞬时反馈走 `src/stores/toast.ts` 的 `useToast().show()`；失败用 `'danger'` 档
- 移除失败:**保持选择态与已选不变**,让用户能直接重试（同 P1 的 `removeSelected`）
- 加照片失败:picker 保持打开
- `excluded` 拉取失败:该分节不渲染,不阻塞主网格
- store 的写 action **抛出**,由视图层决定提示（沿用 P1 moments store 的既定契约）

---

## 6. 测试与收尾门

收尾五门（控制器亲自复跑,不转述实现者的话）:

1. `pnpm exec vue-tsc --noEmit`
2. `pnpm test`
3. `pnpm exec vitest run src/i18n/parity.test.ts`
4. `node oss/export.mjs --out <scratch> --no-commit --allow-dirty-oss`
5. `pnpm build`

**外加 color-guard**（`pnpm exec vitest run src/styles`）。

已知踩过的坑,别再踩:

- **`oss` 门断言工作树干净** ⇒ 台账有未提交改动就报失败。先提交台账再跑,**不要 stash 绕过**。
- **`review-package` 脚本每跑一次就重建一次 `.superpowers/sdd/.gitignore`（一行 `*`）** ——
  正是机主 `0eec6ad` 专门删掉的那个。提交台账前先 `rm`。
- **CSS 注释里 `*` 紧贴 `/` 会提前关闭注释**、错误恢复吃到下一个块结束、吞掉整条规则,
  而五道门全部照不出来。
- **color-guard 不剥注释** —— 注释里写出 hex/rgba 字面量同样命中。
- 全量套件有已知 flake:jsdom `Not implemented: navigation` 噪声、
  `DesktopContextMenu.test.ts` 单跑时失败、`persist.test.ts:55` 偶发红。

---

## 7. 分支与并发

- **接着 P1 在同一分支 `sp15-photos-moments` 上做**,不另开分支:P2a 与 P1 同区,
  且 P1 未合 master,另开分支只会制造第二条待合线。
- **不需要先合 master**:实测 master 相对本分支基线的 161 个提交动了 54 个文件,
  **没有一个是相册区的**,与本期目标文件零重叠。
- 并行的 `sp12-files-fixes` 在文件区;唯一潜在共享面是 `src/i18n/*.base.ts`,**本期不碰它**,
  只改 `*.photos.ts`。
- 合并前用 `git merge-tree --write-tree A B` 只读预演;**后合的一方必须在合并结果上重跑全套门**。

---

## 8. 落点

| 文件 | 动作 |
|---|---|
| `packages/service/src/photos.ts` | +4 方法 |
| `src/photos/stores/smartViews.ts` | +4 action（内置回拉）+ `excluded` 状态 |
| `src/photos/util/assetToPhoto.ts` | + `pinned` |
| `src/photos/components/AlbumLibraryPicker.vue` | **改名**为 `PhotosLibraryPicker.vue` |
| `src/views/PhotosAlbums.vue` · `PhotosAlbumDetail.vue` | 仅改 import 与标签名 |
| `src/views/PhotosSmartViewDetail.vue` | 加照片 / 多选移除 / pin 角标 / 已排除分节 |
| `src/i18n/zh_cn.photos.ts` · `en_us.photos.ts` | `photosSv*` 新键 |
| `oss/manifest.mjs` | 改名后的路径 |

**零新依赖。**

---

## 9. 任务切分（4 个,按机主选的轻流程）

1. **数据层** —— service 4 方法 + store 4 action + `excluded` 状态 + `pinned` 归一
2. **改名** —— picker 改名 + 3 消费方 + 测试 + 开源清单（独立提交）
3. **详情页交互** —— 加照片 / 多选移除 / pin 角标 / 已排除分节 + i18n
4. **收尾** —— 五门 + color-guard + 验收清单（含 §2.2 的第 0 步）

收尾后派**一轮整支终审**（最强模型),不做逐任务评审。

---

## 10. 验收（真机）

清单细节留给实施计划,这两条现在就定死:

- **第 0 步**:先在界面上新建一个**日期条件**的智能视图并置为 live,等它评估出自动匹配行。
  否则「已排除（N）」分节永远不出现（见 §2.1）。
- **第 1 行提示**:本机既有的 9 个「爬山」视图是语义条件 + 从未评估,**在它们身上验不出
  自动匹配相关的任何东西**,这是数据不足不是本期缺陷。
