## Task 13: 收尾 —— 懒加载补齐、六道门、台账、验收清单

**Files:**
- Modify: `src/views/PhotosAlbumDetail.vue:817`
- Create: `docs/superpowers/2026-08-10-sp15-p3-acceptance.md`
- Create: `.superpowers/sdd/2026-08-10-sp15-p3-timeline-performance/progress.md`

- [ ] **Step 1: 相册详情瓷砖补懒加载**

```html
                  <img :src="thumbnailUrl(p.id, 'small')" alt="" loading="lazy">
```

- [ ] **Step 2: 跑六道门（全套，逐条记下真实数字）**

```bash
pnpm exec vue-tsc --noEmit
pnpm test
pnpm test oss
pnpm build
```
`color-guard` 与开源导出门都在 `pnpm test` / `pnpm test oss` 覆盖内；**开源导出门在脏工作树上
会中止**，所以先 `git status --short` 确认干净再跑。数字（文件数 / 用例数 / build 秒数）
逐条抄进台账，不要写「全绿」了事。

- [ ] **Step 3: 与 master 做只读合并预演**

```bash
git merge-tree --write-tree master HEAD | head -3
```
退出码 0 且只输出一行 tree OID ⇒ 无冲突。**不要真的合并。**

- [ ] **Step 4: 写验收清单**

`docs/superpowers/2026-08-10-sp15-p3-acceptance.md`，照 spec §6.3 的五步展开，每步写清
「点哪里 / 看什么 / 期望什么」，并在开头写明：

- 第 1–4 步**需要机主先把 `NimoOS-Photos` 升到 origin/main 并部署**，第 5 步现在就能验；
- 第 5 步验完若要继续验 1–4 步，**部署后端后要硬刷新页面**（目录探测有 10 分钟退避，
  见 spec §5.5）；
- 库很小（几百张、月份少），**看不出「变快」是预期的**，验的是机制在跑。

- [ ] **Step 5: 写台账**

`.superpowers/sdd/2026-08-10-sp15-p3-timeline-performance/progress.md`：逐任务记
「做了什么 / 计划被实测推翻的地方 / 评审逮到什么 / 挂账」，并把 spec §5 那五条已知限制
原样抄一遍（这是「白纸黑字登记」的落地），另加本期新登记的限制与后续票。

- [ ] **Step 6: 提交**

```bash
git add src/views/PhotosAlbumDetail.vue docs/superpowers/2026-08-10-sp15-p3-acceptance.md .superpowers/sdd/2026-08-10-sp15-p3-timeline-performance/progress.md
git commit -m "docs(sp15): close out the P3 timeline performance line

The album detail tiles were the last grid in the area still loading every
thumbnail eagerly. The acceptance checklist is written for a mechanism-level
run because the device library is a few hundred assets: nothing here will look
faster, so each step names the request or the DOM change that proves the
machinery is live, and the first four steps say up front that they need the
backend the owner is deploying."
```

---

## Self-Review

**Spec 覆盖核对**（spec 章节 → 任务）：

| spec | 任务 |
|---|---|
| §1.1/1.2 目录与单桶接口 | T1 T4 T5 |
| §1.4 收藏/回收站 500 语义 | T1 T11 T12 |
| §3.1 store 分桶状态/探测/回退/退避/月份/计数 | T4 |
| §3.1 单桶翻页 + 目录失效 | T5 |
| §3.2 两个纯函数模块 | T2 T3 |
| §3.3 三态 + IO + 实测高度 + 降级 | T6 T7 |
| §3.3 tab/筛选/刻度尺 | T6（tab）T8（筛选 + 死刻度）|
| §3.4 三个消费方兼容 | T6 T7（`loaded === undefined` = 已加载，`need-bucket` 只在 `false` 时发）|
| §3.5 写路径增量化 + 轮询 | T9 T10 |
| §3.6 两页分页 + generation 守卫 | T11 T12 |
| §4 i18n 四键 | T11 T12 |
| §5 限制登记 | T13（台账）+ 各任务代码注释 |
| §6.1 六道门 | 各任务局部 + T13 全套 |
| §6.2 CSS↔TS 守卫 | T3（含变异验证）|
| §6.3 机制层验收清单 | T13 |
| §2.1-13 相册详情懒加载 | T13 |

**类型/命名一致性**（跨任务对齐过）：`bucketKey` / `parseBucketKey` / `normalizeBuckets` /
`bucketToMonth` / `staleBucketKeys`（T2 定义，T4 T5 T9 使用）· `columnsFor` / `tileEdge` /
`estimateSectionBodyHeight` / `skeletonItemCount` / `GRID_METRICS` / `CONTENT_INSET` /
`FALLBACK_CONTAINER_WIDTH` / `MONTH_HEAD_HEIGHT`（T3 定义，T6 T7 使用）· `bucketMode` /
`buckets` / `bucketAssets` / `bucketLoading` / `fetchBucket` / `refreshBuckets` / `totalCount`
（T4 T5 定义，T8 T9 T10 使用）· `need-bucket`（T7 定义，T8 接线）· `favoritesExhausted` /
`loadingMore` / `favoritesTotal` / `loadMoreFavorites`（T11）· `trashExhausted` /
`loadMoreTrash`（T12）。

**已知的两处「计划自己踩过的坑」**（实现期若与实际不符，按实际改并在台账登记）：

1. T2 的 `bucketToMonth` 返回类型在 T6 扩 `Month` 之前只能用交叉类型顶着 —— 已在 T2 Step 4
   写明处置，不要在 T2 里提前改 `Month`（那会让 T6 的失败测试一开始就是绿的）。
2. T8 Step 4 那个刻度尺用例，单月份写法会因为 `anyContent` 为假而拿不到刻度 ——
   已就地写明必须构造两个月份。

**未在任务里解决、留作后续票的**：`Photos.vue` 的 `filteredCount`（工具栏计数）在分桶模式下
仍只数已加载照片，与顶部目录精确计数口径不同（T8 明确不改，评审若认为该统一，开票）。

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-10-sp15-p3-timeline-performance.md`.
