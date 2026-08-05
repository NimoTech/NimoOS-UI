### Task 9: `/photos/places/:key` 地点照片页 + 路由 + 面包屑

**Files:**
- Create: `src/views/PhotosPlaceAssets.vue`
- Create: `src/views/__tests__/PhotosPlaceAssets.test.ts`
- Modify: `src/router/index.ts`(在 `/photos/places` 那条**之后**追加,只追加不重排)
- Modify: `src/photos/components/PhotosGrid.vue`(加 `selectable?: boolean`,默认 `true`)
- Modify: `src/photos/components/__tests__/PhotosGrid.test.ts`(默认值回归 + 关闭态断言)
- Read-only 参考: `PhotosTimeline.vue:1073-1090`(面包屑)、`:756-788`、`:820-841`;本仓页面体例 `src/views/PhotosAlbumDetail.vue:1-80`(壳/route 归一/灯箱)、`PhotosPersonDetail.vue:579-600`(三态门控)

**Interfaces:**
- Consumes: `usePlaceAssets`(T2)、`store.loadDetail`/`store.detail`、`PhotosGrid`、`PhotoLightbox` + `useLightbox`、T1 的键
- Produces: 路由 `photos-place-assets` → `/photos/places/:key`;`PhotosGrid` 的 `selectable` prop

**结构规格:**

1. **壳**:`AreaShell`(title = 城市名,回落 `t('photosPlaces')`)+ `.photos-layout` + `PhotosSidebar` + `.photos-main`(逐段复制 `PhotosAlbumDetail.vue` 的既有结构,P3/P4/P5 既定:不抽公共)。
2. **参数归一**:`const placeKey = computed(() => String(route.params.key))`;`spotKey = computed(() => String(route.query.spot ?? ''))`;`lat`/`lon` 用 `Number(route.query.lat)`,**`Number.isFinite` 不成立时传 `null`**(共享包要求 lat/lon 与 spotKey 成对才带给后端)。
3. **数据编排**:`onMounted` → `void store.loadDetail(placeKey.value)`(**取城市名与 spot 名给面包屑**;复用 store 已有的 seq 守卫 action,不再写第二套详情拉取)+ `void assets.load(placeKey.value, spotKey.value, lat.value, lon.value)`。**`watch` 路由参数变化重跑两者**(照 SP6-P5.5 的第 6 条教训:详情页必须有 `:id` watcher,否则从一个地点跳到另一个地点会渲染陈旧数据)。
4. **面包屑**(照 Vue2 `:1073-1090` 的信息层级,落到本页顶部):
   - 12px 地图图标 + **城市段**:有 spot 时是 `<button>`(`title` = `photosPlacesShowWholeCity`,`@click` → `router.replace` 去掉 query 只留 path)、无 spot 时是静态 `<span>`。
   - 有 spot 时追加 11px 右尖角 + 静态 `<span>` spot 名(**spot 名从 `store.detail.spots` 里按 key 找;找不到时回落 query 里的 spot key**,并**静默降级**:把 `spot`/`lat`/`lon` 三个 query 清掉、只按整城显示,照 Vue2 `:547-551` 的降级语义)。
   - 右侧照片计数 = `photosPlacesPhotoCount`({n: photos.length})。
5. **三态门控**(照 `PhotosPersonDetail.vue:583-600` 体例):`loading && !loaded` → 骨架;`failed` → `photosPlacesLoadFailed` + `photosPlacesRetry` 按钮(重调 `assets.load`);`loaded && photos.length === 0` → `photosNoPhotos` + `photosNoPhotosHint`(**复用既有键**)。
6. **网格 + 灯箱**:`<PhotosGrid :months="assets.months" :selectable="false" @open="onOpen" />`;`onOpen(photo)` → `lb.openAt(photo, assets.photos)`(**整页照片当翻页集**);`<PhotoLightbox />` 挂在 `AreaShell` 之外。
7. **`PhotosGrid` 的 `selectable`(偏离 14)**:`withDefaults` 加 `selectable?: boolean`(默认 `true`),`.tile-check` 外层加 `v-if="selectable"`。**默认真保证另外 5 个消费方零变化。**

- [ ] **Step 1: 写失败测试**

`PhotosPlaceAssets.test.ts` 必含:
- 挂载即调 `loadDetail('7')` 与 `assets.load('7', '', null, null)`(route params `key='7'`,无 query)。
- 带 query:`?spot=s1&lat=30.1&lon=120.2` → `load('7', 's1', 30.1, 120.2)`;`lat=abc`(非数字)→ 传 `null`。
- **路由变化重跑**:`key` 从 7 改到 9 → 两个调用各再来一次,且旧数据不残留(断言网格条数随新数据变)。
- 面包屑:无 spot → 城市段是 `span`(不是 button);有 spot 且详情里能按 key 找到 → 出现 spot 名 + 右尖角;点城市段 → `router.replace` 到无 query 的同 path。
- **spot 找不到时静默降级**:query 有 `spot=zzz`、详情 spots 里没有 → 不出现 spot 段,且 `router.replace` 被调、目标 query 里没有 `spot`/`lat`/`lon`。
- 三态:`loading && !loaded` → 骨架;`failed` → 失败文案 + 重试钮,点重试再调 `load`;`loaded` 且零照片 → 复用的空态文案。
- 网格:`months` 透传给 `PhotosGrid`(断言 prop);`selectable` 传的是 `false`。
- 灯箱:`PhotosGrid` emit `open` → `lb.openAt` 收到的 list 是整页 `photos`。
- 标题:`AreaShell` 的 title 是城市名;详情未到时回落「地点」。
- 路由表含 `/photos/places/:key`,name 为 `photos-place-assets`,且**排在** `/photos/places` 之后(断言两条的下标顺序 —— vue-router 静态路径优先,但顺序仍要稳定)。

`PhotosGrid.test.ts` 追加:
- 不传 `selectable` → `.tile-check` **渲染**(默认值回归,保护另外 5 个消费方)。
- `selectable = false` → `.tile-check` **不渲染**,且 `toggle-select` 无从触发。

- [ ] **Step 2: 跑测试确认失败**
- [ ] **Step 3: 实现**
- [ ] **Step 4: 跑全量 + tsc + color-guard + parity 四道门 + 逐个删码验证**

Run: `pnpm exec vitest run && pnpm exec vue-tsc --noEmit`

删码清单(一次只删一处):①路由参数的 `watch` 删掉 → 「路由变化重跑」红;②`Number.isFinite` 守卫删掉 → `lat=abc` 用例红(会传 `NaN`);③spot 找不到的降级 `router.replace` 删掉 → 降级用例红;④城市段的 `v-if` 分流去掉(恒 button)→ 「无 spot 时是 span」红;⑤`selectable` 的默认值从 `true` 改成 `false` → PhotosGrid 默认值回归红;⑥`onOpen` 的第二参从 `assets.photos` 改成 `[photo]` → 翻页集用例红。

- [ ] **Step 5: Commit**

```bash
git add src/views/PhotosPlaceAssets.vue src/views/__tests__/PhotosPlaceAssets.test.ts src/router/index.ts src/photos/components/PhotosGrid.vue src/photos/components/__tests__/PhotosGrid.test.ts
git commit -m "feat(photos): P6b-T9 /photos/places/:key 地点照片页 + 面包屑 + 路由(D6/D10)

- 按月分组网格 + 灯箱 + 面包屑「城市 › spot」+ 三态门控;不接多选(D10,归 P7/P8)
- spot 找不到时静默降级为整城(照 Vue2 深链语义),路由参数变化重跑(SP6-P5.5 第 6 条教训)
- PhotosGrid 加 selectable(默认 true,零行为变化)门控无处可去的复选框(偏离登记 14)"
```

---

## Self-Review 记录

**1. Spec 覆盖(逐条核 spec §7b 的 P6b 行 + §1c 的 D8-D10)**

| spec 条目 | 落在 |
|---|---|
| hero(封面/关闭/设置封面按钮/country · 当前行程 · 大本营/城市名/last · trips) | T3 |
| 三统计 | T3 |
| 两动作(含 `createPlaceAlbum` + toast + 打开相册) | T2(action)+ T8(toast/导航) |
| spots 列表段 + spot 弹窗(坐标/计数/缩略图/inline 重命名 **+ 恢复默认名 D8**) | T4(+ T2 的 store action) |
| insights 段 | T5(+ T1 的映射表与键) |
| Recent photos 段(含 `+N`) | T5 |
| Visit history 时间线(current pill / faces / spots / Save trip) | T6 |
| 封面选择器全屏弹层(tabs/搜索/分页/设为/恢复默认) | T7(+ T2 的 seq 守卫、T8 的状态与提交) |
| `/photos/places/:key` 地点照片页 + 面包屑(D6) | T9(+ T2 的 `usePlaceAssets`) |
| D8 spot 恢复默认名 | T1(键)+ T2(action)+ T4(按钮) |
| D9 灯箱翻页集 | T3 / T5 / T6(发起方给 list)+ T8(`openAt` 落地) |
| D10 跳库页最小面 | T9 |
| §7c-4 insights 零 `v-html` | T5 |
| §7c-5 `Place.Key` 全链路 `String()` 归一 | T3/T4/T7/T8/T9 各自的归一用例 |
| §7c-8 灯箱翻页集错位 | = D9 |
| §7c-9 `View all` 不可点 | T4(含程序化守卫) |
| §7c-10 `.map-detail.is-entering` / `.trip-row` 死代码 | 范围收口「不做」清单 |
| P6a 接缝①(`resetSpotName` 无 store action) | T2 + T4(**并纠正 P6a 台账的推断:Vue2 零界面,补按钮是 D8 新授权,不是"补齐遗漏"**) |
| P6a 接缝②(`hasDetailPanel` 真实化 → 四条通路落点变) | T8 |

**与 spec 的两处偏差(本计划有意收窄/更正,已在正文登记):**
- **spec §7b P6b 行估 7 任务,本计划 9 个** —— D8(spot 恢复默认名)与 D10 的跳库页各多一个;spec §7b 的任务数已同步改为「估 7,细化后 9」。
- **spec §7c-4 引的「P5-T13 先例」是反例** —— P5-T13(`PersonRelationsTab.vue:19-29`)最终选的是「转义参数 + `v-html`」。本计划按 spec 的**要求**(零 `v-html`)执行,不按它的**引证**;T5 正文与代码注释双处登记。

**2. Placeholder 扫描:** 已过。T1 给了完整可粘贴的测试与实现;T3-T7 的组件测试以「必含用例」逐条列出断言内容(含要先手算的数值:`12.3k`、`+24`、`30.274° N`、`panelFrac 0.42 → x=290`),无 "TBD"/"类似 Task N"/"补充适当错误处理"。所有引用的 Vue2 行号、scss 行号、New-UI 文件行号、i18n 键值、token 名都已在 2026-07-31 回源核过(见每处括注)。

**3. 类型一致性:**
- `PlaceSpot` / `PlaceInsight` / `PlaceVisit` / `PlaceDetail` / `CreatedAlbum` **单点定义在 T2 的 `stores/places.ts`**,T3-T9 一律 import,无重复手写。
- `Place` / `PlacesFilter` / `Pin` 继续从 P6a 的 `util/placesMap.ts` 取,不新建。
- `CoverCandidates` 沿用 `stores/places.ts:51-57` 既有定义(T7 的 props 直接用它)。
- `Photo` / `Month` 从 `util/assetToPhoto.ts` 取;`usePlaceAssets` 的 `months` 是 `ComputedRef<Month[]>`,与 `PhotosGrid` 的 `months: Month[]` prop 对齐。
- emit 名逐个核对过:T3 `close`/`open-cover-picker`/`open-library`/`save-album`/`open-photo`;T4 对外经面板转发为 `pick-spot`/`close-spot`/`rename`/`reset-name`/`open-spot-library`(**刻意与面板自己的 `open-library` 区分**);T6 `save-trip`/`open-photo`;T7 `close`/`update:tab`/`update:search`/`update:page`/`pick`/`reset` —— 与 T8 的接线模板逐行一致。
- `open-photo` 的签名在 T3/T5/T6 三处**统一为 `(assetId: string, list: string[])`**,T8 的 `onOpenPhoto` 按此实现(D9)。
- `store.resetSpotName(id, spotKey)` 与 `store.setSpotName(id, spotKey, name)` 参数顺序一致;`createPlaceAlbum(id, { name, from, to })` 与 T8 的 `createAlbum` 调用一致。

**4. 范围检查:** 9 任务、单一子系统(地点详情),不需要再拆。依赖链:T1 → T2 → {T3 → T4 → T5}(同一面板文件顺序推进,必须串行)→ T6 → T7 → T8 → T9。**T1 是所有视图任务的共同前置**;T8 依赖 T3-T7 全部;T9 只依赖 T1/T2,可与 T3-T7 并行,但为避免 `router/index.ts` 与面板测试的合并噪声,排在最后。

---

## 文末:真机验收清单(:5277)

起服务:
```bash
ss -ltn | grep 527          # 5273 归主仓/SP6、5288 归 SP8,勿占;5277 有旧进程先杀那个 PID
cd /home/nimo/NimoTech/.sp7/NimoOS-New-UI && pnpm dev --host --port 5277
```
浏览器先在 `http://192.168.1.143:5277/` 根路径登录一次,再进 `http://192.168.1.143:5277/app/#/photos/places`。

**逐项眼验(勾不动的记进台账挂账,不要静默放过):**

- [ ] 进页面即自动选中第一个城市,**右侧详情面板从右滑入**,地图同时平移放大 —— 且**城市图钉落在"面板左侧那半边"的中间**,不是被面板盖住(`panelFrac` 生效的肉眼判据)。
- [ ] hero 出封面图(不是灰块/空白);hero 底部渐变之上的城市名、国家、日期、旅行次数**都看得清**(深浅两套 app 主题各看一遍)。
- [ ] hero 左上齿轮、右上 × 两颗按钮都看得见、点得到;× 关闭面板后**地图的居中重新回到整屏中央**。
- [ ] 「本次旅行」绿标只出现在真的当前行程的城市上(切几个城市看);常驻地城市出现「常驻地」标记且**两个标记颜色不同、都看得清**。
- [ ] 三统计(照片 / 地点 / 旅行)数字与下面各段内容对得上;没有 spot 的城市地点数显示 `—`。
- [ ] 点 hero 大图 → 开灯箱;**左右翻页只在预期范围内**(hero 是单张,翻不动)。
- [ ] 「最近的照片」九宫格出图;点第 N 张开灯箱后**左右翻页走的是这一段的照片**(不是整库);最后一格 `+N` 数字对得上,点它跳到地点照片页。
- [ ] 「查看全部 N 张」与「在图库中打开」都跳到 `/photos/places/<key>`;**浏览器后退键能回到地图页且面板还在**。
- [ ] 地点照片页:按月分组、缩略图出图、点开灯箱可翻页;**没有复选框**(D10);面包屑显示城市名;右侧照片数对得上。
- [ ] spot 列表出图;点某行 → `.detail-body` 顶部弹出 spot 卡片(accent 软底);坐标三位小数。
- [ ] spot 重命名:点铅笔 → **输入框自动获得焦点**;回车保存 → 卡片与下面列表里的名字**同时变**(不需要刷新);Esc 退出编辑不改名。
- [ ] **spot「恢复默认名」(D8 新增)**:改过名之后点它 → 名字变回后端自动名(通常是坐标或 POI 名)。
- [ ] spot 卡片「在 Library 中查看这个 spot 的全部照片」→ 跳到地点照片页且**面包屑是「城市 › spot 名」**;点面包屑里的城市 → 变成整城(spot 段消失、照片变多)。
- [ ] 「Nimo 发现」几张洞察卡:文案是**中文**、加粗词(拍摄点名 / 人名 / 大本营)确实加粗、**没有** `<b>` 字样漏出来;图标与内容对得上(人像图标配同框的人)。
- [ ] 「到访记录」时间线:竖线连贯且**最后一条不拖悬空线**;当前行程那条有绿色脉冲 pill(会一闪一闪)且卡片底色泛绿;其他条显示天数。
- [ ] 每条行程的 6 格缩略图出图;点其中一张 → 灯箱**翻页只在那一次行程的照片里**。
- [ ] 「保存旅行」→ 弹 toast「已创建相册「…」· N 张照片」且带「打开」按钮;点「打开」**直接进那个相册的详情页**(不是相册列表)。
- [ ] 「保存为相册」同上,相册名是城市名。
- [ ] 封面选择器:点齿轮打开 → 900px 宽弹层;当前封面在头部小图里且网格里那张**打了勾**;四个标签页(近期/最高分/已收藏/全部)都能切、切换后回到第 1 页;计数超千显示成 `x.xk`。
- [ ] 封面搜索:输词能筛;搜不到出「没有匹配"…"的照片」;**快速连打几个字后停手,结果与最后那个词一致**(seq 守卫的肉眼判据)。
- [ ] 分页:第一页时「上一页」灰掉,最后一页时「下一页」灰掉;页码信息「N 张可选 · 第 x / y 页」对得上。
- [ ] 点某张 → 弹层立刻关闭、hero 封面换成那张、**左侧 rail 里该城市的缩略图也跟着换**(乐观回写);「恢复默认」→ 换回默认封面。
- [ ] 封面弹层:点弹层外面 / 按 Esc / 点 × 都能关;**点弹层内部空白处不关**。
- [ ] **三个浮层(Filters / 地图主题 / 封面选择器)同时打开时按一次 Esc,三个都关。**
- [ ] 详情面板不遮挡工具栏与两个弹层(它们应盖在面板之上),也不被缩放条穿透。
- [ ] 窄屏(手机宽度或把窗口缩窄):详情面板**占满整宽**而不是挤成一条;地图区不横向溢出。
- [ ] 切到英文 locale:面板内全部文案变英文(注意「在 Library 中查看这个 spot…」这条 zh 原文本身混了英文词,是 1:1 照搬,不算残留)。
- [ ] 浅色 app 主题下:hero 文字、spot 卡片、洞察卡、行程卡、封面弹层**都看得清**(不是白底白字 / 深底深字)。
- [ ] 控制台无报错;Network 里 `/v1/photos/places/:key`、`/v1/photos/places/:key/cover-candidates`、`/v1/photos/assets?place_key=…` 都 200。
- [ ] **顺手补验 P6a 那 4 条未证实的看点**:①窄屏下地图区不塌高 ②弹层浮在地图上那层玻璃高光是否突兀 ③四套地图预设下图钉都看得清 ④浅色主题 + custom 黑底的可读性。
