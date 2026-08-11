# SP15-P3 整支评审 · 单波修复报告

> 2026-08-11。分支 `sp15-photos-moments`，起点 `4e87233`（14 个任务各自评审通过、整支终审
> 找出任务之间的接缝）。本文逐条记录：改了什么、哪个测试钉住它、修前/修后证据，以及
> **哪些东西我没能验证、为什么**。
>
> 约束遵守：注释与测试描述全英文 · 颜色零字面量（本波未新增任何颜色）· CSS 注释里没有
> `*` 紧贴 `/` · 未部署 / 未推 / 未合 · 未碰 `NimoOS-Photos`。

---

## 修复顺序

Critical 1 与 Important 3 一起落（各自让对方的症状更糟：修好 Critical 1 会增加 resync
次数，而每次 resync 都会让未修的 Important 3 再棘轮一个月头高度），之后 Important 2 →
6 →（store 侧）4 → 5 → minor 7/8/9/10/11/12。

---

## Critical 1 — 切 tab 往返后观察器不再重新注册

**根因**：`PhotosGrid.vue` 的 resync watch 盯的是 `filteredMonths.map(key)`，但**哪些容器
存在**由 `v-if="hasContent(m)"` 决定，而 `hasContent → skeletonCountOf → skeletonItemCount`
**带 tab 维度**；`gridMonths`（`Photos.vue`）不带 tab ⇒ 切 tab 时那个 key 串一个字都不变。

**改动**（`src/photos/components/PhotosGrid.vue`）：watch 源改成**已渲染集合**
`filteredMonths.filter(hasContent).map(key).join('|')`，让注册跟着真实存在的元素走。
同时把 `need-bucket` 的唯一发射点从 `onIntersect` 挪出（见 Important 2），两件事合起来
才真正闭环。

**测试**：`PhotosGrid.test.ts` → `re-registers the containers a tab round trip recreated`。
为了让这条测试**有意义**，给 `FakeIO` 加了 `fireIfObserved()`：真浏览器只会通知**正在被
观察**的元素，用原来的 `fire()` 直接对着未注册元素开火等于测了一件浏览器永不会做的事。

**证据**：修前 `× re-registers the containers a tab round trip recreated`（fresh 元素不在
`io.targets` 里，`need-bucket` 只有 1 条）；修后通过（`io.targets` 含新元素，emit > 1 条）。

---

## Important 2 — `need-bucket` 只在「进入」边沿触发

**根因**：只有 `entry.isIntersecting === true` 才请求。两条真实路径因此永久卡住：
A（上传流）目录刷新把在屏月份的缓存判废 → `loaded:false` → 用户正在看的照片被换成灰色
微光，全程没有跨越任何交叉边界；B 请求失败时月份从未离开窗口，`fetchBucket` 注释里
「scrolling back to it retries naturally」的说法不成立（= 台账 deferred-minor #11 的
"traced correct by inspection" 判断是错的）。

**改动**：新增 `requestPendingBuckets()`（对**每个** active 且 `loaded === false` 的月份
发 emit），由 `watch([activeKeys, () => props.months])` 驱动 —— 电平触发。`activeKeys`
每批通知都整体换成新 Set（哪怕成员没变），所以「仍在交叉」的重复通知、resync、目录刷新
都会重新评估待办集。store 侧本来就按 key 去重（`_bucketInflight` / `bucketAssets.has`），
多发是免费的。顺手把 `timeline.ts` 里那句错的注释改成实情。

**测试**：
- 路径 A：`re-requests a month whose cache was invalidated while it was on screen`
- 路径 B：`re-requests a month whose fetch failed and never left the window`
- 反向闸（防止「刷新目录 = 请求全库」）：`never re-requests a month that is out of the window`

**证据**：修前两条 `×`；修后全绿。反向闸修前修后都绿（回归闸）。

**残留（诚实登记）**：完全静止的用户 + 后端持续失败 + 目录不刷新时，骨架仍会停在原地
——因为电平触发的重算源是「窗口变化 / 目录变化」，不是定时器。实际使用中 5s 索引轮询与
任何滚动都会推动一次重算；我刻意没有加轮询式重试（会把失败后端变成请求风暴）。

---

## Important 3 — 占位高度重复计入月头、且每次 resync 棘轮

**根因**：`entry.target` 是 `.month-group`（**含** `.month-head`），而这个高度被写到
`.month-placeholder` —— 头的**兄弟**节点。且离开分支没有「它当时是否已 hydrate」的判据，
`syncObserver` 又是 `disconnect()` + 重新 `observe()`，浏览器会对**已经塌陷**的区块重发
`isIntersecting:false` ⇒ 每次 resync 再叠一个头。

**改动**：改成量 **body**（`entry.target.querySelector('.grid')` 的 `offsetHeight`）。
`.grid` 只在瓷砖挂载时存在，所以这次查询**同时**就是「是否已 hydrate」的守卫：已塌陷的
区块查不到 body，保留它被测到的高度不动。

**测试**：
- `sizes the placeholder from the section body, not the group (the head is not part of it)`
- `does not grow the stored height when an already-collapsed section is notified again`

原来那条测试用的是「对 `.month-group` 定死一个 321 的 getter」，**分不出**量的是 group
还是 body。改成在 `HTMLElement.prototype.offsetHeight` 上装一个**盒模型 stub**（group =
head + 当前 body；body 是 `.grid` 或它的占位），这是 jsdom 里唯一能看见双计与棘轮的办法。

**证据（jsdom）**：修前两条 `×`，断言差异实打实打印出 `expected 353 to be 321`
（353 = 32 头 + 321 body ⇒ 双计的确切量）；修后 321，且第二、三次「已塌陷区块再通知」
不改变存储值。棘轮**逐次递增**的数列我在 jsdom 里没有打印出来（第一条断言就已失败、
测试提前结束），它由下面真浏览器那组数字直接实测。

**证据（真 Chromium，`~/.cache/ms-playwright/chromium-1228`，用本组件真实 `<style>` +
真实 DOM 结构跑一次布局）**：

```
group.offsetHeight=352   head.offsetHeight=31   grid.offsetHeight=321   group_minus_grid=31
hydrated wrap.scrollHeight=1608
OLD(量 group): cycle1 stored=352 scrollHeight=1639 (+31) | cycle2 stored=383 (+62) | cycle3 stored=414 (+93)
NEW(量 body):  cycle1 stored=321 scrollHeight=1608 (+0)
```

即：真引擎里 group 恰好比 body 高一个月头（31px），旧写法**每循环 +31px**（这正是绑定
要求 2「滚动条不跳」的反面），新写法首次塌陷 **delta = 0**。同一份 harness 还顺带交叉
验证了 `gridMetrics`：TS 侧 `estimateSectionBodyHeight(1200,'comfortable',12) = 320.57`
对上真实布局 `grid.offsetHeight = 321`（四舍五入内一致）。

harness 里 NEW 的 cycle2/3 显示 `stored=0` —— 那是 harness **无条件重测**的结果，正好
反向说明：若只换测量对象而不加 hydrate 守卫，塌陷区块会被测成 0 → 一次 -321px 的跳动。
组件里的守卫就是防这个，由上面第二条 jsdom 测试钉住。

---

## Important 4 — 收藏页点星标产出假的「加载更多」并复制第一页

**改动**（`src/photos/stores/favorites.ts`）：从 `toggle()` 成功路径删掉
`favoritesExhausted = false` 与 `_offset = 0`，**保留 `_generation++`**。这两行既错也多余：
错在收藏页没有 refetch 的 watcher（只有 `onMounted`），少于一页时会让一份**完整**列表自称
不完整（subset 提示 + Load more 都是 `v-if="!favoritesExhausted"`），点下去请求
`listFavorites(500, 0)` 并把每一行再追加一份；多余在 `fetchFavorites()` 成功/失败两条路径
都无条件设这两个值。

**测试**：
- 新增 `a toggle on a complete list leaves it complete, with nothing more to load`
- 改写 `favorites.test.ts:216` 那条（原标题断言 toggle 自己重置游标；且它的第一页是满 500
  行 ⇒ `favoritesExhausted` 修前修后都是 false，**这条断言原本不可能失败**）→ 现在钉的是
  「刷新自己重新判定 exhaustion」
- `:235` 那条交错测试的尾巴：`(500, 0)` → `(500, 500)`，性质不变（被丢弃的过期页不得用它
  自己的行数推进游标），只是游标现在停在**列表真实结尾**而不是被 rewind 的 0

**证据**：修前 `× a toggle on a complete list...` + `× a toggle landing while
loadMoreFavorites is in flight...`；修后全绿。

---

## Important 5 — `fetchTimeline` 刷新目录不做差分、且不退出分桶模式

**改动**（`src/photos/stores/timeline.ts`）：抽出 `applyDirectory(next)`（差分 + 清理
+ 赋值），`fetchTimeline` 与 `refreshBuckets` **同走一条路**；非 404 失败要落回旧接口前，
先 `bucketMode.value = false`。

**测试**：
- `re-entering the page drops the cache of a month whose count moved while away`（并断言
  「之后再刷新一次也救不回来」——这正是旧行为的死锁点）
- `re-entering the page keeps an unchanged month byte-identical`（反向闸：别把不该丢的
  缓存也丢了）
- `leaves bucket mode before falling back to the legacy timeline`

**证据**：修前 `× re-entering the page drops the cache...`、`× leaves bucket mode...`；
修后全绿。

---

## Important 6 — 分桶模式下 OCR tab 是死胡同

**改动**：
- `gridMetrics.ts` 新增 `tabHasDirectoryEstimate(tab)`（目录只有 `count`/`videoCount` ⇒
  只有 all/video/photo 可估）。`skeletonItemCount` 的 ocr 分支**仍然返回 0**，因为同一个
  函数的结果会被当作月头张数打印出来，编数字等于在界面上撒谎。
- `PhotosGrid.vue`：`hasContent` 在「不可估算的 tab + 未加载」时**保留容器**（容器是观察器
  唯一能盯的东西）；`showCount()` 在这种情况下**不渲染张数**；`sectionBodyHeight` 给它
  **一行瓷砖**的顶替高度 —— 这不是估算，是为了让观察窗内一次只有几个月，使该 tab 与其余
  tab 一样渐进加载，而不是一次把整个目录全请求下来。月份加载完若真没 OCR 资产，容器随即
  按第一条判据消失。

**测试**：
- 改写原来那条 `hides an unloaded month on the ocr tab...`（它断言的正是缺陷）→
  `keeps an unloaded month on the ocr tab loadable, with no invented count`
- 收敛闸：`drops the month again once it is loaded and really has nothing for the ocr tab`
- `gridMetrics.test.ts`：`tabHasDirectoryEstimate` 四条（含未知 tab 默认落安全侧）
- 连带修正 `disables the tick of a month the current tab hides`：它原本拿「ocr tab 上的未
  加载月份」当「被隐藏的月份」，本波之后那已经不是隐藏月份了 ⇒ 改用**已加载但资产不匹配
  本 tab** 的月份，靶子回到测试标题真正说的那件事。

**证据**：修前 `× keeps an unloaded month on the ocr tab loadable...`；修后全绿。

**spec §5.4 已改写**（`docs/superpowers/specs/2026-08-10-sp15-p3-timeline-performance-design.md`）：
原措辞「该 tab 下未加载月份不显示」= 缺陷描述而非限制，且它的论证（「与 Vue2 同」）在分桶
模式下本就不成立（Vue2 一次请求握住整库，它的 OCR tab 永远有数据）。新措辞写明：保留容器、
不显示张数、一行顶替高度、加载后收敛，并保留原文留档 + 指向后续票 BE-P3-3（目录补 OCR 计数
才是真修法）。

**残留（诚实登记）**：该 tab 上骨架高度普遍不符（多数月份文档远少于一行），加载完成时区块
会收缩一次；且由于每个未加载月份只有约一行高，一个月份很多的库在这个 tab 上会比其他 tab
更快地把桶拉完。两者都是「没有 OCR 计数」的直接后果，真修法在 BE-P3-3。

---

## Minors

**7. `MONTH_HEAD_HEIGHT` 死导出 + 不可能失败的测试** → 删掉常量与
`expect(32).toBeGreaterThan(0)`，在原处留注释说明为什么它不该被接上（头不属于任何被计算的
高度，接上就是 Important 3 的同一个双计 bug）。测试文件同步删导入。

**8. CSS↔TS 平价闸缺 `aspect-ratio`** → `gridMetricsCssParity.test.ts` 加
`tileEdge doubling as a row height requires .tile to stay square`。**变异验证**：把
`.tile` 的 `aspect-ratio: 1` 改成 `4/3` → 该条 `×`（其余 4 条仍绿），改回 → 全绿。

**9. `windowingActive` 在 onMounted 就置真 ⇒ 首帧灰闪** → 改到 `onIntersect` 首次调用时
置真。测试 `paints the photos it already holds before the first notification arrives`
（装了 FakeIO 但不开火：修前渲染骨架，修后渲染瓷砖）。修前 `×`。
**没能验证的部分**：真浏览器里「那一帧到底闪不闪」我没有测 —— 需要跑起真页面并卡在
paint 与 IO callback 之间取帧。我验证的是**机制**（首次通知前不武装窗口化），不是像素。

**10. `fetchBucket` 缺目录代际守卫** → 写入前重新查该 key 的 meta，若**已消失或
count/videoCount 变了**就丢弃整批页（并 warn）。
**这里我与评审意见有一处出入，明说**：评审建议「捕获一个目录计数器，动了就丢」。我改成
**按 key 比对**，因为全局计数器会在索引期把自己饿死 —— 索引进行时目录每几秒刷新一次
（`refreshBuckets` 去抖 3s），一个要 8s 才能翻完页的大月份会被反复请求、反复丢弃，永远
加载不完。按 key 的判据与 `staleBucketKeys` 用的是同一条（count/videoCount 动了或桶没了），
所以没变的月份保住它刚付出的请求，变了的月份由电平触发重取。
测试三条：`drops its pages when the month it was loading changed under it` /
`...vanished from the directory` / `keeps its pages when the refresh left that month alone`
（最后一条就是钉「不要用全局计数器」的那条闸）。修前前两条 `×`。
**同一条里的第二处出入**：评审说这个守卫会让 T5 那个「第二个清理循环」变得真正
load-bearing。实际相反 —— 守卫生效后，唯一可能往 `bucketAssets` 里塞孤儿 key 的写入方
（`fetchBucket`）已经不会写了，`staleBucketKeys` 本身也已经把「消失的桶」判为 stale
（`timelineBuckets.ts:87`）。所以那个循环是**纵深防御**而不是承重墙。我按指示保留了它，
但注释写的是实情（「守卫若被削弱，这个循环是最后一道」），没有写一句我不相信的话。

**11. `Photos.vue` facet 源注释说谎** → 改成实情：分桶模式下 `allPhotos` 只覆盖已加载的桶，
会随滚动变长；行为本身是已登记限制 §5.1。

**12. `PhotosLibraryPicker` 只在 scroll 事件里翻页** → 抽出 `pageInNextBucket()`，新增
`fillViewport()`：初次加载后若 `scrollHeight <= clientHeight`（= 用户根本没有滚动条可拖）
就继续拉，直到能滚或库拉完，上限 10 页。`clientHeight === 0`（未布局 / jsdom）时**什么都
不决定** —— 否则每个 picker 测试都会静默把整库拉下来。
测试两条：`pages in more months when the newest three do not fill the panel`（修前 `×`）+
`leaves paging to the user once the list overflows`（反向闸）。

---

## 我没能验证的东西（不装有覆盖）

1. **首帧灰闪（minor 9）** —— 只验证了机制（jsdom：首次通知前不武装窗口化），没有在真
   浏览器里抓那一帧。
2. **真机（设备）行为一律未验** —— 未部署是本波的硬约束。特别是 OCR tab：真机 `moments`/
   OCR 数据分布未知，「一行顶替」在真实库上的观感需要机主验收时看一眼。
3. **`syncObserver` 在真浏览器里对已塌陷区块重发 `isIntersecting:false` 这一点**，我是按
   IntersectionObserver 规范（`observe()` 会为每个目标投递一次初始通知）与评审给出的
   Chrome 行为（detached target 报 false）来处理的，没有在真浏览器里单独抓这条回调；
   Important 3 的守卫对「是否真的重发」并不敏感（重发就跳过，不重发也不影响）。
4. **多月份大库下 OCR tab 的实际并发请求数**，未实测（推算见 Important 6 残留）。

---

## 闸门

见提交信息与控制器复核；本文不复述数字，以免与最终一次运行不一致。

---

## 闸门（本波最终一次运行，提交 `4a7923a8`，工作树干净）

| 闸 | 结果 |
|---|---|
| `pnpm exec vue-tsc --noEmit` | 0 错误 |
| `pnpm test src/photos src/views/__tests__` | 131 files / 2732 tests passed |
| `pnpm test`（全量） | **689 files / 11105 tests passed**（基线 4e87233 是 689 / 11086 ⇒ 净 +19 例） |
| `pnpm test oss` | 21 files / 487 tests passed |
| `src/styles/color-guard.test.ts` + `selectPopup.test.ts` | 1060 tests passed（本波未新增任何颜色字面量） |

已知无关噪音（非本波引入）：`favorites.test.ts:126` 的 jsdom
`Not implemented: navigation`（`exportZip` 写 `location.href`）；一条
`/tmp/nimoos-www-*` 目录不可写的 stderr（部署脚本相关测试的既有输出）。

开源导出面无风险点：本波所有代码改动都在 `src/photos/**` 与 `src/views/Photos.vue`，
两者都在 `oss/manifest.mjs` 的 **DELETE** 表里整块剥离，**没有碰任何 PATCH 锚点**，
也没有新增/删除文件（`photosStripCoverage` 这类结构守卫无需更新）。

---

# R1/R2 追加一小波（2026-08-11，机主批准）

整支修复波自己带进来两条 Important 回归，逐条如下。两条都在 `src/photos/stores/timeline.ts`，
本波不碰其他文件的运行代码。

## R1 — m10 守卫在**健康后端**上重造了「永久骨架」

**根因链**（复审已端到端复现，我在本仓也复现了）：用户正看着八月、上传在索引 →
5s 轮询的 `refreshBuckets` 把八月的 count 改了，而它的分页请求**还在飞** →
`applyDirectory` 发布新目录 → 我的电平触发确实 emit 了 `need-bucket` →
**这一发被 `_bucketInflight` 去重吞掉**（注定要被丢弃的那次 run 此刻仍登记在册）→
那次 run 随后丢弃分页、`return`，而丢弃路径**碰不到任何网格在看的状态**
（`bucketLoading` 既不是 `months` 的依赖，也不是 `Photos.vue` 的 `gridMonths` 的依赖）⇒
再也没有下一次重算、下一次 emit。八月无限微光，恢复要等下一次目录变化或滚过 200% rootMargin。

**改法**：不重入，改成**丢弃路径必须发信号**。在 `finally` 里、**本次 run 从
`_bucketInflight` 注销之后**，把 `bucketAssets` 以**新身份、同内容**重新发布一次
（`bucketAssets.value = new Map(bucketAssets.value)`）⇒ `months` 重算 ⇒ 网格的电平触发重新
评估「在窗口内且仍未加载」⇒ 这次去重已解除，重问落地，按**新目录**重走分页。

为什么信号必须发在 `finally` 而不是丢弃分支里：在丢弃分支里发，去重仍然武装着，那一发还是
会被吞 —— 这正是 R1 的成因本身，换个地方发等于原地打转。

**怎么定界（机主要求说明）**：不是靠计数器，是**构造性有界** —— 只有「目录变化」能让一次
分页走废，所以**每次目录变化最多多付一次分页走查**；而目录变化本身是限速的
（索引期 `refreshBuckets` 去抖到 3s 一次），没走废的那次会写入并终结循环。**没有任何被丢弃
的 run 重入自己**，所以链式重入不可能发生。

**回归测试（就是那个复现）**：`src/views/__tests__/Photos.buckets.test.ts` →
`recovers when a directory refresh dooms the pages that were already in flight`。
它是 grid + store + FakeIO 的整链：一次挂起的分页 → 一次把该月 count 改动的目录刷新 →
放行挂起分页 → 断言该月**最终 loaded**（不是「又发了一次请求」），并断言用户眼前是 11 张
瓷砖、没有骨架。

**修前/修后**：修前 `× ... expected false to be true`（`aug.loaded` 为 false = 永久骨架，
与复审「`getTimelineBucket` 调用数停在 1」同一现象）；修后绿。

**测试脚手架上的一个坑（值得记下来）**：`Photos.vue` 在 `onMounted` 的 `fetchTimeline` 把
`store.loading` 翻真之前**已经画了一帧**，所以 PhotosGrid 会被挂载、被 `v-if` 卸载、再挂载
一次 ⇒ **存在两个 IntersectionObserver 实例，只有最后一个在观察东西**。第一版测试拿
`FakeIO.instances[0]`，那是个已 `disconnect()` 的死观察器（targets 为空），于是「开火」什么
也没发生、断言 0 次调用 —— 测试因此失败，但**理由是错的**（不是产品缺陷）。现在测试用
`liveIO()` 取最后一个实例，并**先断言该容器确实在 `targets` 里**再开火。

## R2 — 双端点同时失败会把一个存在的库画成空

**根因**：`bucketMode = false` 写在 `await getTimeline()` **之前**。会话中后端重启 ⇒ 探测非
404 失败 + 老接口也失败 ⇒ `timelineGroups` 还是进入分桶模式时写下的 `[]`，`months` 因此为空，
页面在一个**存在的库**上画出「没有照片」，而 `Photos.vue` 只有 `store.loading` 分支、没有错误
分支 ⇒ 一直空到用户离开页面。（我这条 Important 5 修之前，至少还留着旧目录在屏上。）

**改法**：`const res = await service.photos.getTimeline()` → **然后**才
`bucketMode.value = false` → `timelineGroups.value = res ?? []`。两行之间没有 await，所以不存在
「分桶模式已关、groups 还没到」的中间渲染。Important 5 的要求仍然满足：落回老接口成功时，
`months` 渲染的就是老接口的结果，不会有死内存。

**回归测试**：`timeline.test.ts` → `keeps the previous directory on screen when both endpoints
fail`（探测非 404 + `getTimeline` 也 reject ⇒ `bucketMode` 保持 true、`months` 仍是上一份目录的
两个月、`totalCount` 仍是 17、`loading` 收尾为 false）。
**修前/修后**：修前 `× expected false to be true`（`bucketMode` 已被翻成 false ⇒ 空库）；修后绿。

顺带把前一波那条测试的标题从 `leaves bucket mode before falling back to the legacy timeline`
改成 `leaves bucket mode once the legacy timeline answers` —— 它断言的东西没变（老接口的答案
必须真的是页面渲染的东西），但「before falling back」这个说法在 R2 之后已经不是实情，留着就是
下一个人的假靶子。

## 本波闸门（提交 `bc4b9d3`…见下方实际值，工作树干净）

见本文件末尾「R1/R2 闸门」小节。

## R1/R2 闸门（提交 `aa3f5b83`，工作树干净）

| 闸 | 结果 |
|---|---|
| `pnpm test src/photos src/views/__tests__` | 131 files / **2734** tests passed（上一波 2732 ⇒ +2） |
| `pnpm exec vue-tsc --noEmit` | 0 错误 |
| `pnpm test`（全量） | 689 files / **11107** tests passed（上一波 11105 ⇒ +2） |
| `pnpm test oss` | 21 files / 487 tests passed |

本波只改 `src/photos/stores/timeline.ts`（运行代码）+ 两个测试文件 + 台账/报告；
未新增/删除文件，开源导出面无新增风险点（`src/photos/**` 整块在 DELETE 表里）。
