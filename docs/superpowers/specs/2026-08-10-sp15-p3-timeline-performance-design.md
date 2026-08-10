# SP15-P3 相册区补迁 · 时间线性能线 —— 设计

> 写于 2026-08-10。分支 `sp15-photos-moments`，worktree `.claude/worktrees/sp15-photos-moments`，
> 基线 New-UI 本分支 `45751ae`（P2c 关账后）。

---

## 0. 这一期在哪个位置

SP15 分期表（出处：`docs/superpowers/specs/2026-08-09-sp15-p1-photos-moments-design.md` §0）：

| Part | 内容 | Vue2 提交 | 状态 |
|---|---|---|---|
| P1 | Moments 整块 | `#100` `#107`–`#111` | 已关账 |
| P2a | 智能视图手动加/移/恢复照片 | `#79` `#82` | 已关账 |
| P2b | Albums / SmartViews IA 合并 | `#112` `#113` | 已关账 |
| P2c | 相册详情换骨架 + 五项菜单 | `#114`–`#117` | 已关账（未验收）|
| **P3** | **时间线性能线** | `#138` `#139` `#140` | **本期** |
| P4 | 人物区 P0/P1 修复 + 地点地图整块 | `#137` `#106` | 未开 |
| P5 | cutover + 收口 | — | 未开 |

### 0.1 本期没有 1:1 靶子 —— 这是与 P1/P2a/P2b/P2c 的根本区别

机主 2026-08-10 裁定原文：

> 「它这个主要解决的是图片太多时一次性加载太慢的问题，我们功能上解决就行，代码上不需要对齐，
> 界面上需要让用户感觉到第一次进来不是什么都看不到，不是要加载很久就行。」

⇒ **本期是按目标自研，不是移植。** Vue2 `#138`–`#140` 的地位从「靶子」降为「教训来源」：
它们踩过的坑（§5）照结论抄，代码结构、方法名、文件划分一律不对齐。

**因此「界面严格 1:1」这条常规纪律在本期被机主明确放宽**，替换为两条可验的界面要求：

1. 一进相册主页**立刻有结构可看**（月份标题 + 张数 + 等高占位），不是白屏或长时间转圈；
2. 滚动过程中**滚动条长度稳定、不跳**。

其余界面（瓷砖、月标题排版、刻度尺、收藏/回收站版式）保持现状不动 —— 本期不改视觉，
只在「未加载」这个**现状根本不存在的新状态**上新增骨架样式。

### 0.2 机主四条裁定（本期binding，实现期不重开）

| # | 裁定 | 含义 |
|---|---|---|
| D1 | **后端归机主** | `NimoOS-Photos` 的拉取、构建、部署全部由机主执行。本期**不动** `NimoOS-Photos` 仓、**不部署**。实现期任何需要真机探测后端的动作，**先停下来问机主「后端拉取部署完成了吗」**，得到确认才探。 |
| D2 | **一期做完** | 不拆 P3a/P3b。逐任务评审 + 整支终审。 |
| D3 | **筛选 × 未加载月份：照 Vue2 的限制** | 筛选栏（年份/地点/相机/归档）一生效，未加载月份连骨架一起隐起，只对已加载桶筛选。白纸黑字登记为遗留限制（§5.1），真正的修法是后端筛选，不属本期。 |
| D4 | **机制层验收，不造测试数据** | 设备库只有几百张（`/DATA/Gallery` 14 个媒体文件、缩略图目录 785 个资产、`photos.db` 13 MB），肉眼看不出「变快」。验收步骤写成「开 F12 看 Network / Elements」的形式（§6.3）。 |

### 0.3 首屏与窗口化的机制选择（机主 2026-08-10 拍板）

- **首屏走「先拿目录再填照片」**（另两个候选：最新 60 张直铺 + 目录并行 / 纯无限滚动，均否）。
- **DOM 卸载走 `IntersectionObserver` + 记住实测高度**（另两个候选：手写 scroll + offsetTop 计算 /
  本期不做卸载，均否）。

---

## 1. 后端契约（全部实测取证，非推测）

取证方式：`git -C /home/nimo/NimoTech/NimoOS-Photos show <sha>:<path>`，读的是已 fetch 下来的
远端提交，**没有动本地 main**。相关后端提交：`1fac515`(#54) `629a33c`(#55)。

### 1.1 目录接口

```
GET /v1/photos/timeline/buckets
→ 200, 裸 JSON 数组（无 {Success,Message,Data} 信封）
[ { "year": 2026, "month": 8, "count": 312, "videoCount": 12 }, ... ]
```

- 字段是 **camelCase**（`videoCount`，不是 `video_count`）—— 出处 `service/timeline_buckets.go`
  的 struct tag。
- 排序：**年降序、月降序**（新→旧）。
- `year=0 && month=0` 是「无日期」桶（`taken_at` 与 `indexed_at` 皆 NULL），**永远排最后**。
- 统计口径：排除 live photo 的视频分身、已删除、offline 资产。

### 1.2 单桶接口

```
GET /v1/photos/timeline/bucket?year=2026&month=8&limit=500&offset=0
→ 200, 裸资产数组（列集与老 /timeline 完全一致，现有 assetToPhoto 可直接吃）
```

- **单页硬上限 500**：`limit <= 0 || limit > 500` 一律当 500。⇒ 一个月超过 500 张必须翻页。
- `offset < 0` 归零。
- `month < 0 || month > 12 || year < 0` → **400**。
- `#55` 追加：**半零键 400** —— `year=0` 与 `month=0` 必须成对出现，只填一个会被拒。
  ⇒ 前端的桶键解析必须保证「无日期桶」这一路永远同时传 0/0。
- 无日期桶的取法：`year=0&month=0`（后端转成 `IS NULL` 条件）。

### 1.3 分桶与老接口的月份归属差异（后端已登记为接受偏差）

- 分桶：`strftime('%Y-%m', ...)` 按 **UTC** 分组。
- 老 `/timeline`：Go 侧按 `time.Time` 自己的**本地时区**分组。
- ⇒ 月末深夜拍的照片，在分桶模式与回退模式下可能落在**不同月份**。
- 出处：`service/timeline_buckets.go` 的 `TimelineBuckets` doc comment。
- 本期态度：**不修、不补偿**。目录与桶内容用的是同一个表达式，所以分桶模式内部自洽；
  两种模式之间的这点差异写进 §5.3 登记。

### 1.4 收藏 / 回收站的分页语义（这是正确性风险，不是性能优化）

`route/v1/favorites.go` 与 `route/v1/trash.go` 在 `#54` 双双改成：

```go
// Default AND ceiling: an absent limit used to mean "everything", which
// at gallery scale serializes tens of thousands of rows per request.
if limit <= 0 || limit > 500 { limit = 500 }
```

⇒ **不传 limit 从「全部」变成「500」**。而现在 New-UI 这两页正是不传 limit 的
（`packages/service/src/photos.ts` 的 `listFavorites(limit = 0)` 在 limit<=0 时不带参；
`listTrash()` 连参数都没有）。

**后果**：机主部署后端 `#54` 的那一刻，线上收藏页/回收站页会**静默只显示 500 条**，
界面上看不出少了东西。⇒ 本期必须把这两页的分页补上（§3.6），这一条与性能无关，是正确性。

**响应里没有总数字段** —— 后端没有返回 total。精确总数只能另外拿（§3.6）。

---

## 2. 范围

### 2.1 做

1. **分桶时间线数据层**：目录 + 单桶按需拉取 + 桶缓存失效规则 + legacy 404 回退与退避（§3.1）
2. **纯函数几何/取窗模块**：列数、瓷砖边长、节高、骨架张数（§3.2）
3. **网格三态渲染 + IntersectionObserver 窗口化 + 实测高度占位**（§3.3）
4. **骨架样式**（月标题 + 张数 + 等高灰块 + 流光）—— 现状不存在的新状态，唯一的新视觉
5. **CSS ↔ TS 网格数值一致性守卫**（§6.2）
6. **写路径增量化**：删除/收藏/归档只改受影响桶，不再全量重取（§3.5）
7. **索引轮询期间只刷目录 + 防抖**（§3.5）
8. **收藏页分页**：500 一批 + 加载更多 + 精确总数 + 「统计基于已加载前 N 项」提示（§3.6）
9. **回收站分页**：500 一批 + 加载更多 + 未取完时的批量操作文案降级 + 撤销同步（§3.6）
10. **三处分页列表的陈旧/生成号守卫**（§3.6）
11. **月份刻度尺死刻度置灰**（当前 tab/筛选下不显示的月份不可点）
12. i18n 新键，两 locale 同步（§4）
13. 相册详情瓷砖补 `loading="lazy"`：`src/views/PhotosAlbumDetail.vue:817` 的 `<img>` 现在没有
    这个属性（已取证；`PhotosSmartViewDetail.vue` 与 `PhotosGrid.vue` 都已经有了）。
    对应 Vue2 `#138` 里那一行改动，顺手带走

### 2.2 不做（各有出处，实现期不重新讨论）

| 不做的 | 理由 |
|---|---|
| 动 `NimoOS-Photos` 仓 / 部署后端 | D1：后端归机主 |
| 造批量测试照片 | D4 |
| 筛选生效时补齐未加载桶 | D3 |
| 改瓷砖/月标题/刻度尺/收藏页/回收站的既有视觉 | 本期只改「未加载」这个新状态的样式 |
| 把网格 CSS 改成 Vue2 的固定 10/7/4 列 | New-UI 自适应列数是 SP7 定的既有形态，本期不动视觉；几何按容器宽度算即可 |
| 抽 `PhotosGridSection` 子组件 / 新建独立 buckets store | 无关重构，超出本期 |
| 搜索页 / 智能视图 / Moments / 人物页的网格 | 它们不消费 `PhotosGrid`（或消费但数据已在手），本期只保证不回归 |
| 部署 / 推 origin / 合 master | 停在分支上等机主统一验收（与前四期同） |

---

## 3. 架构

### 3.1 数据层：`src/photos/stores/timeline.ts`

新增状态（与 Vue2 的 store 拓扑无关，只服务本期需要）：

```ts
buckets: Ref<BucketMeta[]>            // 目录，后端顺序原样保留（新→旧，unknown 最后）
bucketAssets: Ref<Map<string, Photo[]>>   // key -> 已加载照片
bucketLoading: Ref<Set<string>>       // key -> 正在加载
bucketMode: Ref<boolean>              // true = 走分桶；false = 回退老接口
```

`BucketMeta = { year: number; month: number; count: number; videoCount: number }`

**桶键**：`bucketKey({year, month})` → `2026-08` 形式；`year===0 && month===0` → `'unknown'`。
反解析 `parseBucketKey` 必须保证 `'unknown'` → `{year: 0, month: 0}`（**成对**，见 §1.2 的半零 400）。
键的生成/反解析放进 §3.2 的纯函数模块，store 与组件都只用它，不各自拼字符串。

**进页面流程**（替换现在的 `fetchTimeline()`）：

```
fetchTimeline()
  ├─ 若 now < bucketsRetryAfter（上次探测 404 未过退避期）→ 直接走 legacy
  ├─ 试 getTimelineBuckets()
  │    ├─ 成功 → buckets = res, bucketMode = true, loading = false（首屏结构立刻可渲染）
  │    └─ 404  → bucketsRetryAfter = now + 10min, 走 legacy
  └─ legacy: getTimeline() → timelineGroups（现有逻辑，一字不改）
```

- 只有 **404** 才认定「老后端」并进退避；其他错误（500 / 网络断）不进退避，下次照常再探
  —— 否则一次偶发抖动会把用户按在老路径上十分钟。
- 退避时间戳是模块级变量（不是 store state，时间戳不该进响应式），`__resetForTest()` 必须清。

**单桶拉取** `fetchBucket(key)`：

- 已在 `bucketAssets` 或已在 `bucketLoading` → 直接返回（**同键去重**，否则窗口进出会重复发请求）
- 内部循环翻页：`offset += 500`，直到累计条数 ≥ 目录里的 `count`，或某页返回 < 500
- 硬上限保护：累计 40 页（2 万张）后停手并 `console.warn`
- 失败：不写 `bucketAssets`（保持未加载），清 `bucketLoading`，`console.error`
  ⇒ 用户滚回来会自然重试，不需要额外重试机制

**目录刷新** `refreshBuckets()`（供索引轮询与写操作后调用）：

- 重新拿目录 → 逐桶比对：
  - 桶消失 → 丢掉它的 `bucketAssets`
  - `count` 变了 → 丢掉它的 `bucketAssets`（内容陈旧，下次进视口重拉）
  - `count` 没变 → **一个字节都不动**（界面不闪，这是「不刷屏」的关键）

**月份列表** `months` computed：

- `bucketMode === false` → 现有 `timelineGroups → groupToMonth` 路径**原样保留**
- `bucketMode === true` → 由 `buckets` 生成，每项带：
  - `key` / `title` / `photos`（未加载时 `[]`）
  - `count` / `videoCount`（来自目录）
  - `loaded: boolean`（该键是否在 `bucketAssets` 里）

**计数**：`bucketMode` 下 `totalCount / photoCount / videoCount` 直接对目录求和 ⇒ 顶部统计是
**全库精确值**。（现状是「已加载多少算多少」，库大时本来就是错的 —— 这一条是顺带修正，
不是新增功能。）

### 3.2 纯函数模块（本期唯一的新增文件）

`src/photos/util/timelineBuckets.ts`
- `bucketKey(b)` / `parseBucketKey(key)` / `bucketTitle(b)`
  **键与标题必须与既有的 `groupToMonth`（`src/photos/util/assetToPhoto.ts:415-417`）逐字一致**：
  `month === 0` → key `'unknown'`、title `'Unknown Date'`；否则 key `2026-08`、
  title `` `${MONTH_NAMES[month-1]} ${year}` ``。理由：回退模式走 `groupToMonth`，
  分桶模式走这里，两条路径产出的 key 一旦不一致，跳月锚点/`activeMonth` 追踪/刻度尺
  会在两种模式下行为不同。**标题是硬编码英文串（现状如此，非 i18n）——本期不改、不新增 i18n 键。**
  另：`PhotosGrid.vue:92` 的刻度尺**已经**会跳过 `'unknown'` 键，分桶模式沿用即可。
- `diffBucketDirectory(prev, next)` → 需要失效的键集合（§3.1 的比对规则，纯函数好测）

`src/photos/util/gridMetrics.ts`
- `GRID_METRICS: Record<Density, { minColWidth: number; gap: number }>`
  —— 唯一真相源，数值取自 `PhotosGrid.vue` 现有 CSS：
  `comfortable 140/4`、`compact 96/2`、`loose 200/10`
- `columnsFor(containerWidth, density)` = `max(1, floor((W + gap) / (min + gap)))`
  —— 复刻 `repeat(auto-fill, minmax(min, 1fr))` 的行为
- `tileEdge(containerWidth, density)` = `(W - (cols-1)*gap) / cols`（瓷砖是 `aspect-ratio: 1`，边长=行高）
- `estimateSectionBodyHeight({ containerWidth, density, itemCount })`
  = `rows * tileEdge + (rows-1) * gap`，`rows === 0` 时返回 0
- `skeletonItemCount({ bucket, tab, loaded, loadedLength })`：
  - `tab === 'all'` → `count`
  - `tab === 'video'` → `videoCount`
  - **`tab === 'photo'` → `count - videoCount`** ← 见 §5.2，这是本期最容易踩死的一条
  - `tab === 'doc'`（OCR）→ 0（目录里没有这个维度，登记为限制 §5.4）
  - 已加载且没有目录字段（合成分组）→ `loadedLength`

为什么下沉成纯函数：jsdom 没有布局引擎，`clientWidth/offsetTop/offsetHeight` 全是 0，
几何逻辑写在组件里就**只能验退化路径**（Vue2 那 95 行 windowing 测试测的正是退化路径）。
喂数字进纯函数才能验「算得对」。

### 3.3 渲染层：`src/photos/components/PhotosGrid.vue`

**结构不变**：每个月一个 `.month-group`（`id="m-<key>"`），**始终存在** —— 跳月锚点、
刻度尺、滚动条长度全靠它。

**三态**：

| 状态 | 条件 | 渲染 |
|---|---|---|
| hydrated | 在窗口内 && `loaded` | 真实瓷砖（现有模板一字不改）|
| placeholder | 不在窗口内 && 曾经量到过高度 | 空块，`height = 实测值` |
| skeleton | `!loaded`，或不在窗口内且从未量到高度 | 月标题 + 张数 + 等高灰块 + 流光 |

**窗口判定**：一个 `IntersectionObserver`
- `root` = 滚动容器（`wrapRef`），`rootMargin = '200% 0px'`（前后各 2 屏）
- 进入 → `activeSections.add(key)`；若 `!loaded && !loading` → 调 `fetchBucket(key)`
- 离开 → `activeSections.delete(key)`
- 观察目标随 `months` 变化重挂（`watch(months)` → 重新 observe）

**实测高度**：hydrated 的 section 在离开窗口**之前**把 `offsetHeight` 记进一张
`Map<key, number>`（非响应式或 shallowRef，别让它触发重渲染循环）。占位优先用实测值，
没有才用估算值 ⇒ 已看过的区域滚动条完全不跳。

**降级（关键兼容设计）**：`typeof IntersectionObserver === 'undefined'`（jsdom）
→ **全部 hydrated**，等于现在的行为。这样相册区现有 ~10958 个测试不会因为窗口化
而集体看不见瓷砖。同一条降级也覆盖「容器宽度为 0」的退化布局。

**tab / 筛选 / 刻度尺**：
- 骨架张数按 §3.2 的 `skeletonItemCount`
- 筛选生效（D3）→ 未加载月份整块不渲染（连骨架）
- 刻度尺：当前 tab/筛选下不显示的月份，刻度 `data-disabled` 置灰且不可点击
  （数据源必须是**与模板同一个** `filteredMonths`，不能另算一遍，否则会漂）

### 3.4 三个消费方的兼容（必须逐个成立）

`PhotosGrid` 的消费方：`src/views/Photos.vue`（时间线）、`src/views/PhotosFavorites.vue`、
`src/views/PhotosPlaceAssets.vue`（地点照片页）。

- **收藏页 / 地点页**的 months 是合成分组：没有 `count/videoCount/loaded` 字段。
  ⇒ 契约：**不带 `loaded` 字段 = 已加载**。它们只吃「DOM 卸载」的好处，
  永远不会触发 `fetchBucket`（`need-bucket` 只在 `loaded === false` 时发）。
- 骨架张数对它们走 `loadedLength` 分支 ⇒ 卸载后占位高度仍然正确。

### 3.5 写路径增量化

- `deleteAssets(ids)`：成功后**不再** `refreshTimelineQuiet()`。改为：
  - `bucketMode` → 从每个已加载桶里剔掉这些 id，并把目录里对应桶的 `count`
    按**实际剔掉的条数**减（不是按传入 ids 长度减 —— 部分失败时会算错）；
    `videoCount` 同理按剔掉的视频数减
  - 非 `bucketMode` → 保留现有 `refreshTimelineQuiet()`
- 收藏/归档：现有实现已是局部翻转（`favorites.ts` 的乐观翻转），本期只确认它们**没有**
  连带全量重取；有就改掉。
- `trash.ts` 的 `restore / restoreAll / undoRestore` 现在各调一次
  `useTimelineStore().fetchTimeline()`（全量）→ 改为 `refreshBuckets()`（只刷目录，几百字节）。
- **索引轮询**（`fetchIndexStatus`，5 秒一次）：现在 `indexed` 涨了就
  `refreshTimelineQuiet()`（全量）→ 改为 `refreshBuckets()` + **防抖 ≥3s**（模块级时间戳）。
  非 `bucketMode` 时保留原行为。

### 3.6 收藏 / 回收站分页

**service 层**：`listTrash(limit, offset)` 补上参数（现在没有）；`listFavorites` 已有参数，
不动签名。

**收藏页**（`favorites.ts` + `PhotosFavorites.vue`）：
- 首屏 `listFavorites(500, 0)`；`exhausted = 返回条数 < 500`
- 「加载更多」：`offset += 500`；`loadingMore` 期间禁止重入
- **精确总数**：`listFavoriteIds()`（返回全部 id 的数组，很便宜，现有 store 已在调它）
  → `favIdsLoaded ? favIds.size : 已加载条数`（favIds 还没落地时**不要闪 0**）
- 未取完时显示一行提示：统计卡/筛选下拉都是基于已加载部分算的，显式说明
  「统计基于已加载的前 N 项」，不静默少报
- 错误路径：失败时把分页游标复位，避免下次「加载更多」跳过一段

**回收站页**（`trash.ts` + `PhotosTrash.vue`）：
- 同样 500 一批 + 加载更多 + `exhausted`
- **未取完时批量操作文案降级**：「恢复全部 / 清空回收站」的确认框现在带具体容量（`{size} MB`），
  未取完时算不出总容量 ⇒ 换成不带容量的版本；成功 toast 与撤销提示同理
- 撤销（`undoRestore`）后重新取第一页，游标复位

**陈旧/生成号守卫**（三处分页列表共用同一套写法）：
- 每次「刷新 / 切页 / 复位」递增 `generation`
- 任一异步响应回来先比对 `generation`，变了就**整份丢弃**（不写 state、不推进 offset）
- 失败路径也要消费掉 generation，否则一个在飞的 `loadMore` 会在失败后把旧数据接上

---

## 4. i18n

新键（`src/i18n/locales/zh_cn.photos.ts` + `en_us.photos.ts`，两 locale 同步；
parity 测试会检查两边键集相等）：

| 键 | zh_CN | 用处 |
|---|---|---|
| `Stats reflect the first {n} loaded items` | 统计基于已加载的前 {n} 项 | 收藏页未取完提示 |
| `Load more` | 加载更多 | 两页的加载更多按钮（若现有键已有则复用，不新增）|
| `Restore all items in trash?` | 恢复回收站中的所有项？ | 未取完时的确认标题 |
| `Permanently delete all items in trash?` | 永久删除回收站中的所有项？ | 同上 |
| `This frees up space on the NAS. Once gone, the originals can't be recovered — not by Restore, not by Nimo.` | 这将释放 NAS 上的空间。一旦删除，原始文件将无法恢复——恢复功能和 Nimo 都无法找回。 | 未取完时的不带容量版正文 |
| `All items restored to Library` | 所有项已恢复到资料库 | 未取完时的成功 toast |
| `Trash emptied` | 回收站已清空 | 同上 |

zh_CN 文案以 Vue2 `zh_CN.json` 现有值为准（这 7 条在 Vue2 `#140` 里已存在，逐字取）。
**无日期桶不需要新键** —— 它的标题沿用 `groupToMonth` 既有的硬编码 `'Unknown Date'`（§3.2）。

实现期必须先查现有键，**已存在就复用，不新增同义键**（P2c 栽过一次：一个键服务两个不同目标串）。

---

## 5. 已知限制登记（白纸黑字，代码注释 + 台账都要写）

### 5.1 筛选只看已加载桶（D3）
筛选栏一生效，未加载月份连骨架一起隐起 ⇒ 筛选结果只包含已滚过/已加载的月份，
**界面上看不出结果不完整**。真正的修法是后端筛选，开后续票，不属本期。

### 5.2 照片 tab 的骨架张数必须是 `count - videoCount`
New-UI 相册主页**默认 tab 是 `photo`**（`src/views/Photos.vue:55`，与 Vue2 一致）。
目录里只有 `count` 与 `videoCount`，没有「纯照片数」。若照片 tab 估成 0，
**首屏之外的月份永远不出骨架、永远不触发加载**（Vue2 `#139` 修的正是这个 bug，
而我们默认 tab 与它相同 ⇒ 踩坑概率 100%）。这条写进 §3.2 的函数契约，并配单测。

### 5.3 分桶与回退模式的月份归属可能差一天
§1.3。分桶按 UTC 分组、老接口按本地时区分组。不修、不补偿。

### 5.4 文档（OCR）tab 下未加载月份不出骨架
目录里没有 OCR 维度的计数 ⇒ 该 tab 下无法估算骨架高度，未加载月份不显示。
与 Vue2 同（它的注释写的是 "OCR tab keeps the documented limitation"）。

### 5.5 目录接口 404 的十分钟退避
后端未升级时，`/timeline/buckets` 每次进页面都 404 一次是噪音 ⇒ 探测失败后 10 分钟内
直接走老接口。副作用：机主部署后端后，**最多 10 分钟内**（或刷新页面重载 JS 后立即）
才切到分桶模式。验收时若发现「部署了后端但还在走老接口」，先硬刷新页面。

---

## 6. 验证策略

### 6.1 现有五道门（每个任务结束都要过）
`vue-tsc` 0 错 · `pnpm test` 全绿 · 开源导出 · color-guard · `pnpm build`

开源导出注意：相册区整块是被剥离的（`oss/` 那套 + `photosStripCoverage` 结构性守卫）。
**新增文件必须同步登记进剥离清单**，否则导出门会红 —— SP15 前四期这一条已红过四次。

### 6.2 本期新增守卫：CSS ↔ TS 网格数值一致性
`gridMetrics.ts` 的 `minColWidth/gap` 与 `PhotosGrid.vue` `<style>` 里
`repeat(auto-fill, minmax(Npx, 1fr))` / `gap: Npx` 必须一致。
守卫测试用 `node:fs` 读 `.vue` 源文本（**不能用 `?raw` import**，本仓已栽过：`?raw` 恒空、
color-guard 曾因此空转），正则抓出三档密度的数值与常量表比对。
理由：这两处数值一旦漂移，骨架高度会静默算错，而三道门都看不见。

### 6.3 机制层真机验收（D4；第 1–4 步需机主先部署后端 `#54`）

| # | 步骤 | 期望 |
|---|---|---|
| 1 | 进相册主页，F12 Network 过滤 `timeline` | `timeline/buckets` **只出现一次**；页面**立刻**出现月份标题 + 张数 + 灰块，不是白屏 |
| 2 | 慢慢往下滚 | 逐个出现 `timeline/bucket?year=..&month=..`；已滚过的月份**不重复请求** |
| 3 | 滚到很下面再滚回顶部 | Elements 里 `.tile` 数量有增有减（远处被卸载）；**滚动条位置不跳** |
| 4 | 收藏页 / 回收站页滚到底 | 首屏 500 条后能继续加载；「全部 N」是精确总数；未取完时出现「统计基于已加载的前 N 项」 |
| 5 | **后端未部署时**（设备当前状态）| 页面正常（走老接口）；`timeline/buckets` 404 一次后，10 分钟内不再重复探测 |

第 5 步现在就能验（设备当前正是老后端 —— 本地 `NimoOS-Photos` 在 `#52`，
落后 origin/main 6 个提交，设备二进制里 `timeline/bucket` 零命中）。

---

## 7. 风险与「计划会被推翻」的地方

按前四期的经验，计划里被实测推翻 7–16 处是常态。已知最可能翻的：

1. **实测高度的记录时机**。「离开窗口前记 `offsetHeight`」在 IO 回调里读可能已经太晚
   （回调触发时元素还在 DOM 里，应该没问题，但要实测）。备选：`ResizeObserver` 持续记录。
2. **IO 的 `rootMargin: '200%'`** 在 `root` 是内部滚动容器时的行为要实测确认
   （百分比相对 root 尺寸）。若不符预期改成 `${2 * clientHeight}px`。
3. **`watch(months)` 重挂 observer 的抖动**：目录刷新会重建 months 数组，若每次都全量
   `unobserve/observe`，可能引发一轮多余的进入/离开回调 ⇒ 需要按 key 增量挂。
4. **收藏页的筛选下拉与统计卡**基于已加载部分算 —— 分页后这些数会变小，
   §3.6 的提示行是缓解不是修复；实现期若发现某个统计明显误导，登记为限制而不是硬修。
5. **`aspect-ratio: 1` 之外的瓷砖**：若某处瓷砖不是正方形（例如 Moments 马赛克），
   几何函数会算错 —— 但 Moments 不走 `PhotosGrid`，实现期需确认无其他非方形消费方。
6. **无日期桶**（`year=0,month=0`）：键与标题在回退路径已有既成约定，刻度尺也已经跳过它
   （§3.2 已取证）。剩余未取证的是**跳月与 `activeMonth` 追踪**在这个键上的行为
   —— 实现期要实测一遍，不要假设它和普通月份等价。

---

## 8. 不在本期、需要开票的

| 票 | 内容 |
|---|---|
| BE-P3-1 | 后端筛选（年份/相机/地点）—— 是 §5.1 那条限制的唯一真正修法 |
| BE-P3-2 | 收藏/回收站接口返回 total（现在得靠 `listFavoriteIds` 绕） |
| BE-P3-3 | 目录接口补 OCR/文档维度计数 —— §5.4 的修法 |
