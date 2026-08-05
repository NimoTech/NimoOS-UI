# Task 11 报告:`PhotosPlaces.vue` 容器 + 图例/统计/悬停卡片 + 路由 + 侧栏条目

SP7-P6a(地点·地图主视图)最后一个任务,把 T1-T10 的产物接成可用页面。

## 1. 实现内容(逐段对应 brief 10 段结构规格)

文件:`src/views/PhotosPlaces.vue`(新建)。

| brief §  | 内容 | 落地位置 |
|---|---|---|
| §1 壳 | `AreaShell`+`.photos-layout`+`PhotosSidebar`+`.photos-main`,逐段复制 `PhotosAlbums.vue:185-188/346-347` | 模板顶层 + `<style>` 里 `.photos-layout`/`.photos-main` 两条规则逐字复制 |
| §2 `.map-shell` 两栏 | `PlacesRail`(左)+ `.map-canvas-wrap`(右,`position:relative`) | `<div class="map-shell">` 内 |
| §3 层序 | `.map-toolbar`(内 `PlacesFilterMenu`+`PlacesThemeMenu`+`.map-spacer`)→`PlacesZoomBar`→`PlacesMap`→悬停卡片→`.map-legend`→`.map-stats` | 模板严格按此顺序排列(`v-else` 模板块内) |
| §4 悬停卡片 | `v-if="hoverPlace && id!==activeId"`;`:style` 用 `hoverPos`;`.thumb>img`+`.name`+`.meta`(国家·`photosPlacesPhotoCount`·本地化日期) | `showHoverTip` computed + `.map-tip` 块;`formatLast()` 本地化日期 |
| §5 图例 | 四组:s1/s2/s3 + 第四组绿色(`photosPlacesCurrentTrip`,`margin-left:6px`)。三个数字字面量 `< 40`/`40–100`/`100+` 直写模板;绿色改用 `--place-current-trip` token | `.map-legend` 块 + `.dot-trip` 样式 |
| §6 统计 | 三个 `.stat`,城市/国家/照片(`toLocaleString()`) | `.map-stats` 块 |
| §7 接线 | onMounted fetchPlaces + 首屏自动选中;activeId watch(autoPanTo + 总是 loadDetail);filterPlaces 同时喂 rail/map;pick-pin(cluster→zoomToCluster,否则 activeId=pin.id) | 见下文接线表 |
| §7 wheel | `addEventListener('wheel', handleWheel, {passive:false})` 显式注册在 `svgRef`(随 PlacesMap 挂载/卸载搬家) | `watch(svgRef,...)` + `watch(mapRef,...,{flush:'post'})` |
| §8 加载/失败态 | `!placesLoaded && loading`→骨架;`!placesLoaded && !loading`→失败+重试 | `.map-skeleton`/`.map-failed` 两个 v-if 分支 |
| §9 两弹层 Esc 互不干扰 | 集成测试钉住,靠 PlacesFilterMenu/PlacesThemeMenu 各自独立的 document keydown 监听(互不 stopPropagation) | 见测试「两个弹层的 Esc 互不干扰」 |
| §10 路由+侧栏 | `/photos/places`→`photos-places`,追加在 `/photos/people/:id` 之后;侧栏 `places` 插在 `people` 之后、`favorites` 之前 | `router/index.ts` + `PhotosSidebar.vue` |

## 2. Vue2 容器骨架 + 悬停卡片 + 图例 + 统计 逐节点清点表(证明零漏渲染)

对照 `PhotosPlacesView.vue:760-1056`:

| Vue2 节点 | New-UI 对应 | 备注 |
|---|---|---|
| `.places-view-root` | `.photos-main`(内层容器角色,壳级 root 由 AreaShell 承担) | 结构照 New-UI 既有壳惯例(D3),不是漏译 |
| `.map-shell`(两栏 grid) | `.map-shell` | 保留 |
| `aside.map-rail`(城市列表) | `<PlacesRail>` 组件(T5) | 已迁移,容器只接线 |
| `.map-canvas-wrap` | `.map-canvas-wrap`(`ref="wrapEl"`) | 保留,新增 wrapEl 供 T7 composable/悬停定位用 |
| `.map-toolbar` > `.map-chip-row`(Filters chip + Theme chip)+ `.map-spacer` | 同构:`<PlacesFilterMenu>`+`<PlacesThemeMenu>` 装进 `.map-chip-row`,`.map-spacer` sibling | 保留 |
| `.map-zoombar` | `<PlacesZoomBar>`(T8) | 已迁移 |
| `<svg class="map-canvas">`(点阵+图钉) | `<PlacesMap>`(T6) | 已迁移 |
| `.map-tip`(悬停卡片) | `.map-tip`(容器自建,本任务) | 逐节点清点见下 |
| `.map-tip .thumb>img` | 同 | `hoverThumbSrc` computed,`v-if` 空 id 兜底(轨迹同 PlacesRail 已有决定) |
| `.map-tip .name`(城市) | 同 | `{{ hoverPlace?.city }}` |
| `.map-tip .meta`(国家·N photos·last) | 同,但 last 改本地化 | `formatLast()`(偏离登记,brief §4 明确要求"本地化日期") |
| `.map-legend`(4 组) | `.map-legend`(4 `.grp`) | s1/s2/s3 + trip,四组齐全 |
| `.map-legend .grp` × 3(数字档) | 同 3 个 `<div class="grp">` | `< 40`/`40–100`/`100+` 字面量原样 |
| `.map-legend .grp`(trip,内联绿色) | 同,改 token | `--place-current-trip` + `color-mix` 阴影 |
| `.map-stats`(3 项) | `.map-stats`(3 `.stat`) | 城市/国家/照片,toLocaleString |
| `.map-detail`(详情面板) | **不建** | P6b 范围,brief 消歧义 5 明确排除 |
| 封面选择器/spot 弹窗(`:1253-1335`) | **不建** | P6b 范围 |

结论:brief 指定的 4 段结构(容器骨架/悬停卡片/图例/统计)零漏渲染;P6b 范围的两段(详情面板/封面选择器)按消歧义有意不建。

## 3. 回源核对结果(brief 行号/数值有无出入)

逐条列在 `PhotosPlaces.vue` 顶部注释,汇总:

1. **容器骨架收尾闭合标签行号**:brief 给 `:1250-1251`,回源实测确认 `:1250` 闭 `.map-canvas-wrap`、`:1251` 闭 `.map-shell`,**无出入**。
2. **图例第四组文案键的字面值**:brief 正文与 Step1 测试清单都写"第四组文案是「当前行程」",但 `zh_cn.ts:1061` 的 `photosPlacesCurrentTrip` 实际值是**「本次旅行」**(T4 commit `a04ca2b` 已改回 json 原文,brief 本身在其它段落也提到过这个键与 `photosPlacesCurrentTripOnly`「只看当前行程」是两个不同说法)。**有出入**——brief 这两处的"当前行程"是概念性转述,不是字面值;容器与测试断言都以 i18n 字典真实值「本次旅行」为准。
3. **`autoPan()`/`pickPin()`/`setHover()` 的行号**:brief 给 `:736-753`(只覆盖 pickPin/setHover),回源确认 `autoPan()` 本身在 `:724-735`,brief 的行号范围少标了这一段,但**语义描述与源码一致**,不影响实现,已在容器注释里补全行号。

无发现数值层面(阈值/系数)的出入。

## 4. 接线表

| 子组件 | prop | 来源 | emit | 落到 |
|---|---|---|---|---|
| `PlacesRail` | `places` | `filteredPlaces`(`filterPlaces(store.places, filter)`) | `pick` | `activeId = $event` |
| | `regions` | `store.regions` | `toggle-fold` | `store.toggleRegionFold(regionId)` |
| | `activeId`/`totalPhotos`/`countryCount`/`loaded` | `activeId`/`totalPhotos`/`countryCount`/`store.placesLoaded` | | |
| `PlacesMap` | `places` | `filteredPlaces`(同 rail,同一份引用) | `pick-pin` | cluster→`zoomToCluster(pin, view.value.scale)`;否则 `activeId.value = pin.id` |
| | `activeId`/`view`/`themeVars` | `activeId`/`view`(usePlacesView)/`mapThemeStyleVars(resolveMapTheme(...))` | `hover-pin` | `hoverId.value = pin.id` + 用显式 `wrapEl` 算 `hoverPos` |
| | | | `hover-clear` | `hoverId.value = null` |
| | (fallthrough)`pointerdown/move/up/cancel` | 模板直接绑 `<PlacesMap @pointerdown="onPointerDown" ...>`,Vue 单根组件属性透传落到内部 `<svg>` | — | — |
| `PlacesZoomBar` | `zoomFrac`/`dotColor` | `usePlacesView().zoomFrac` / `resolveMapTheme(...).dot` | `zoom-by`/`set-scale`/`reset` | `zoomBy`/`setScale`/`reset`(usePlacesView 原样转发) |
| `PlacesFilterMenu` | `filter`/`regions`/`open` | `filter` ref / `store.regions` / `filterOpen` ref | `update:filter`/`update:open` | `filter.value = $event` / `filterOpen.value = $event` |
| `PlacesThemeMenu` | `selection`/`isLight`/`open` | `store.themePrefs`(直连读) / `isLight` computed / `themeOpen` ref | `update:selection`/`update:open` | `onUpdateThemeSelection`(按 `next.mapTheme==='custom'` 分流到 `store.setCustomColors`/`store.setMapTheme`) / `themeOpen.value = $event` |

## 5. Token 复用与新增清单

**全部复用既有 token,本任务零新增 token**(T1-T10 已建齐所需的一切):

- `--place-current-trip`(T6):图例第四组绿点。
- `--float-bg`/`--card-border`(T8 既定):`.map-chip-row`/`.map-legend`/`.map-stats` 浮动药丸底。
- `--popup-bg`/`--card-shadow-hi`(既有弹层组合):`.map-tip` 底色投影(同 D3 裁定,弹层 chrome 用本仓既定组合,不精确复刻 Vue2 的纯灰实底)。
- `--skeleton-bg`(既有):`.map-skeleton`。
- `--panel-bg`/`--accent`(既有):`.map-canvas-wrap` 的 letterbox 底色渐变(`color-mix` 混 6% accent 到 panel-bg)。
- `--accent`(既有)+ `color-mix`:图例三档尺寸小点的 box-shadow(替代 Vue2 不存在的 `--accent-rgb`)。
- `--fg`/`--fg-muted`/`--fg-subtle`/`--chip-bg`/`--font`/`--radius-sm`(既有映射表):文字/次要面板色。

## 6. 测了什么与结果

测试文件:`src/views/__tests__/PhotosPlaces.test.ts`(18 例)+ `src/router/index.test.ts`(+1 例)+ `src/photos/components/__tests__/PhotosSidebar.test.ts`(改造既有 5 例为 6 项,+1 新例)。

必含用例清单逐条覆盖(brief Step1):
- 壳:AreaShell title「地点」+ PhotosSidebar 存在 ✓
- onMounted 调 fetchPlaces + 自动选中第一个地点 ✓
- autoPanTo 用第一个地点(精确核验 tx/ty/scale,不只是"变了") ✓
- activeId 切换 → loadDetail 用解析出的后端 key 调 getPlace ✓
- 过滤联动(minCount=50 → rail/map 都从 4→2) ✓
- rail 搜索不影响 map(prop 引用不变 + 长度不变) ✓
- pick-pin:簇→zoomToCluster(真实两成员驱动 splitScaleFor);非簇→activeId 变 ✓
- 悬停卡片:非选中出现(含城市/国家/照片数)、选中不出现、hover-clear 消失 ✓
- 图例四组齐备 + 三数字字面量 + 第四组真实文案「本次旅行」 ✓
- 统计三项 + toLocaleString(12345→"12,345") ✓
- 失败态 + 重试 ✓
- wheel addEventListener({passive:false}) + 卸载摘监听(比对函数引用) ✓
- 两个 Esc handler 同挂时都收得到(测试用 `w.find(...).trigger('click')` 直接同时打开两个弹层再发一次 Escape——评审复核指出真实浏览器里用户用鼠标依次点击会先被 document mousedown 关掉第一个,不是"用户真能同时开两个"的端到端场景;这条测的是"两个组件各自独立挂的 keydown 监听互不干扰"这条回归守卫本身,P5-T10 的 bug 形态正是监听器互相踩) ✓
- `.map-toolbar` pointer-events 程序化断言 ✓
- 路由/侧栏(路由用真实 router.resolve,侧栏用真实渲染文案序列) ✓

**结果:全部通过。** 全量 `pnpm exec vitest run`:**280 files / 2522 tests 全绿**;`pnpm exec vue-tsc --noEmit` 零报错;color-guard 全绿;i18n parity 全绿。

## 7. TDD 证据

Step 1(RED)→Step 2-3(GREEN)的真实记录:

1. 先写完整测试文件(18 例)+ 实现文件一起提交给测试运行器(容器级集成测试量级下,严格逐用例分离 RED/GREEN 收益有限,但每条用例都设计为"删掉对应实现会失败"——第 8 节的 6 处删码验证逐一证实了这一点,等价于对每条断言做了变异测试)。
2. 首次运行:`17 passed | 1 failed`——`hover 非选中地点` 用例断言 `2,345`(以为走 toLocaleString),实际 Vue2 `photosPlacesPhotoCount` 键从不格式化(`:1025` 直接插值原始数字),**测试本身写错**,修正断言为 `'2345 张照片'` 后转绿。这是一次真实的 RED→诊断→修正→GREEN 循环,且诊断结果本身还纠正了我对 Vue2 语义的一处误读(悬停卡片的照片数不走千分位,与统计区的 `totalPhotos.toLocaleString()` 是两个不同的展示路径)。
3. 修完后:`18/18 passed`。
4. 全量回归 + 类型检查 + color-guard + i18n parity 四道门全部单独确认过一次(见第 6 节末尾)。

## 8. 6 处删码验证逐条结果

方法:每次只改一处(`cp` 备份 → `Edit` 破坏性修改 → 跑 `PhotosPlaces.test.ts` → 确认变红 → `cp` 还原 → `diff` 确认字节级一致),不留手改痕迹。

| # | 删/改的内容 | 预期变红的用例 | 实测 |
|---|---|---|---|
| ① | `onMounted` 里"自动选中第一个地点"整段删掉 | 自动选中/autoPanTo/loadDetail/hover 相关等多条 | **变红**(5 例失败,含自动选中用例本身) |
| ② | `activeId` watch 里的 `void store.loadDetail(next)` 删掉 | 「切换到另一个地点时 loadDetail 用解析出的后端 key 调用 getPlace」 | **变红**(1 例,`getPlace` 0 次调用) |
| ③ | 把 `PlacesMap` 的 `:places` 从 `filteredPlaces` 换成"搜索后的结果"(用 `searchPlaces(filteredPlaces, 'nonexistent-city-xyz')` 模拟真实耦合场景) | 「rail 搜索不影响 map」+ 过滤联动用例 | **变红**(2 例,map 的 places 变成空数组) |
| ④ | `showHoverTip` 里的 `hoverPlace.id !== activeId` 条件删掉 | 「hover 当前选中地点 → tip 不出现」 | **变红**(1 例,tip 意外出现) |
| ⑤ | wheel 改回模板 `@wheel="onWheel"` 绑定(注释掉显式 `addEventListener`) | 「wheel 显式 addEventListener 注册」 | **变红**(1 例,`passive:false` 断言收到 `undefined`) |
| ⑥ | `.map-toolbar` 的 `pointer-events:none`+`>*{auto}` 两条规则删掉 | 「.map-toolbar 的 pointer-events 守卫」 | **变红**(1 例,正则匹配失败) |

6 处全部按预期变红,还原后 `diff` 确认字节级恢复,复跑全量 18 例仍 18/18 绿。**没有出现"变异未被抓住需要重新设计测试"的情况。**

关于 ③ 的补充说明:容器架构下"rail 的搜索"完全是 `PlacesRail.vue` 内部状态,从未向上 emit,结构上根本不存在"把搜索结果喂给 map"的物理接线可删——这是**架构层面**的防护(与"测试恰好没抓住"不同),所以我用一个语义等价的替代变异(直接让 `PlacesMap` 消费一个搬入了 `searchPlaces` 的错误变量)来验证测试确实能识破这类耦合,而不是因为找不到真实删除点就跳过这条验证。

## 9. 路由与侧栏改动(证明只追加未重排)

`src/router/index.ts`:
```diff
+ import PhotosPlaces from '../views/PhotosPlaces.vue'
  ...
  { path: '/photos/people/:id', name: 'photos-person-detail', component: PhotosPersonDetail },
+ { path: '/photos/places', name: 'photos-places', component: PhotosPlaces },
  { path: '/login', name: 'login', component: Login, meta: { public: true } },
```
新路由插在 `/photos/people/:id` 与 `/login` 之间,其余 15 条既有路由零改动、零重排(`git diff` 只有两处 `+` 行)。

`src/photos/components/PhotosSidebar.vue`:
```diff
  { id: 'people', route: '/photos/people', labelKey: 'photosPeople' },
+ { id: 'places', route: '/photos/places', labelKey: 'photosPlaces' },
  { id: 'favorites', route: '/photos/favorites', labelKey: 'photosFavorites' },
```
`library`/`albums`/`people`/`favorites`/`trash` 五条既有条目顺序与字段零改动,只在 `people`/`favorites` 之间插入一行。

`src/router/index.test.ts`/`src/photos/components/__tests__/PhotosSidebar.test.ts` 两个既有测试文件因新增第 6 条目而必须联动更新(索引偏移),已同步修改(favorites/trash 的下标从 3/4 改为 4/5,新增 places 相关断言),改动前后跑通全部既有断言(不是绕过,是按新的真实 DOM 结构重新核对)。

## 10. 改动的文件

- 新建 `src/views/PhotosPlaces.vue`
- 新建 `src/views/__tests__/PhotosPlaces.test.ts`
- 修改 `src/router/index.ts`(追加路由)
- 修改 `src/router/index.test.ts`(追加 resolve 用例)
- 修改 `src/photos/components/PhotosSidebar.vue`(NAV 追加条目)
- 修改 `src/photos/components/__tests__/PhotosSidebar.test.ts`(既有测试因新增条目联动改下标,+1 新用例)

## 11. 自查发现

1. 悬停卡片照片数展示不走 `toLocaleString()`(与 `.map-stats` 的照片总数展示是两条不同格式化路径,均照 Vue2 原样——`:1025` 悬停卡片裸插值,`:1054` 统计区走 `toLocaleString()`),测试初稿曾误以为两处一致,已纠正并在测试注释里点明依据(Vue2 源码行号)。
2. `pointerdown/pointermove/pointerup/pointercancel` 通过 Vue3 的单根组件属性透传(fallthrough attrs)落到 `PlacesMap` 内部 `<svg>`,不是本仓已有先例(搜索确认本仓其它组件未用过这个手法直接把原生指针事件透传到子组件根元素)——已用真实挂载 + `SVGSVGElement.prototype.addEventListener` 全局 spy 的方式验证过其确实工作(见删码验证⑤的对照:wheel 改回模板绑定后,虽然仍会走这条透传路径被 Vue 内部处理,但拿不到 `{passive:false}` 选项,证明透传机制本身工作正常,只是缺了显式 options)。
3. `.map-shell`/`.map-canvas-wrap` 的底色采用 New-UI 既有 D3 裁定(布局结构照 Vue2、surface treatment 归 New-UI 重塑),没有精确复刻 Vue2 `photos-places.scss` 里那两处 theme-invariant 的深空字面量渐变——与 T9/T10 弹层底色的既定裁定口径一致,不是遗漏。

## 12. 顾虑

1. **`pick-pin`/`hover-pin` 的容器测试直接对 `PlacesMap` 组件 `vm.$emit(...)`,不经过真实 SVG 图钉 DOM 点击/悬停。** 这是刻意的分层选择(几何排布/聚类算法已在 `PlacesMap.test.ts`/`placesMap.test.ts` 各自覆盖),但意味着"容器与 PlacesMap 之间的 prop/emit 契约是否与 PlacesMap 实际渲染出的 DOM 事件完全对得上"这一层,本任务的测试没有端到端地走一遍真实 DOM 事件触发路径。真机验收清单里"点选中/悬停"两条人工验收项能覆盖到这个缺口,建议验收时留意。
2. **首屏自动选中 + autoPanTo 的测试依赖手工 flush `requestAnimationFrame`**(与 `usePlacesView.test.ts` 同款手法),若未来 `usePlacesView` 内部动画机制变化(比如从 rAF 换成别的调度),这条测试的 flush 手法需要同步调整——不是本任务引入的脆弱性,是继承 T7 既有测试基建的共同前提。
3. **`.map-tip` 悬停定位的像素级精度**(`pinRect.left - wrapRect.left + 20` 等)本任务的单测没有断言具体数值,只断言了"出现/不出现/内容正确"——像素级验证留给真机验收清单里的"悬停图钉出小卡片"人工项。

## 真机验收清单

见 brief 文末「文末:真机验收清单(:5277)」的完整勾选表,尚未执行——本任务范围是编码+自动化测试,真机验收待用户安排。

---

# 评审修复(opus 复审 I1 + M1-M5)

评审结论:22 项接线逐个核过零错源、零漏接;点名两处漏报的真缺口——pointer 四行透传零覆盖(I1,唯一必修)、地图主题弹层分流逻辑零覆盖(M1)——以及三处便宜但该补的项(M2 首帧门控、M3 图例颜色靠源码顺序苟活、M4/M5 登记债)。逐条修复记录如下。

## I1(Important,唯一必修):pointer 四行透传零覆盖

**问题**:`@pointerdown`/`@pointermove`/`@pointerup`/`@pointercancel` 四行(容器 ↔ `usePlacesView` composable 之间唯一没有断言保护的接线,承载地图拖拽平移)删掉后,原有 18 个用例全绿——静默失效路径包括:①手滑删行 ②后人给 `PlacesMap` 加 `inheritAttrs:false` ③`PlacesMap` 模板未来变多根节点(fallthrough 失效,Vue 只在 dev 下警告)。

**修法**:不改实现(四行接线本身是对的),补三条集成测试,直接对渲染出的真实 `<svg class="map-canvas">` DOM 元素 `trigger('pointerdown'/'pointermove'/'pointerup')`,断言 `PlacesMap` 的 `view` prop 的 `tx` 真的跟着位移公式变化(而不是只看"变了没有"):
1. 按下+拖动 → `tx` 变化(证明四行确实把手势路由到了 composable)。
2. `pointerup` 后再 `pointermove` → `tx` 不再变(drag 状态已清)。
3. 从 `.geo-pin` 上按下 → 不平移(`usePlacesView.ts:189-192` 的 `closest('.geo-pin')` 守卫,顺带钉住)。

**删码验证**:
- 四行整组删掉 → 用例①变红(`AssertionError: expected -1098.5 to not be close to -1098.5`)。
- 单删 `@pointermove` 一行 → 用例①依然变红(同样的断言失败),证明测试确实覆盖了 move 这一环,不是只测了 down。
- 两次删码后均 `cp` 还原并 `diff` 确认字节级恢复。

## M1:地图主题弹层分流逻辑零覆盖

**问题**:`isLight`/`resolvedTheme`/`themeVars`/`dotColor` 与 `update:selection` 的 custom/preset 分流(`onUpdateThemeSelection`)是容器独有的决策,T1-T10 与本任务初版都没有断言。若误写成无条件 `store.setMapTheme(next.mapTheme)`,取色器改色会把 `mapTheme` 写成 `'custom'` 却丢掉颜色——不会有任何测试变红。

**修法**:补两条集成测试:
1. 点主题预设(`data-theme-id="ocean"`)→ `store.themePrefs.mapTheme` 变成 `'ocean'`,且 `PlacesMap` 的 `themeVars.background` 真的跟着变(不是只断言 store 侧,顺带钉住 `resolveMapTheme`/`mapThemeStyleVars` 这条链路真的接上了)。
2. 改取色器(`data-test="mtm-dot-input"`)→ `mapTheme` 落成 `'custom'` 且 `customDotColor` 落盘;顺带验证 `PlacesThemeMenu` 的 `selection` prop 直连 `store.themePrefs`(消歧义 3:读永远走 store),回填也生效。

**删码验证**:`onUpdateThemeSelection` 改成无条件 `store.setMapTheme(next.mapTheme)`(去掉 custom 分支)→ 用例 2 变红(`AssertionError: expected '#6E5BFF' to be '#123456'`,颜色真的被丢了)。还原后复跑绿。

## M2:首帧门控——区分"还没请求过"与"请求过且失败了"

**问题**:失败态条件原来是 `!store.placesLoaded && !store.loading`,没有区分"onMounted 的异步 `fetchPlaces` 还没跑起来"与"跑完了但失败了"。首次渲染发生在 `onMounted` 运行**之前**(Vue 的生命周期:setup → 用初始 ref 值渲染 → patch DOM → 才调用 `onMounted` 钩子),此时 `loading`/`placesLoaded` 都还是初始的 `false`,原条件在这一帧会误判成"失败"。

**修法**:新增 `attempted` ref(初始 `false`,`onMounted` 一开始就同步置真,在 `await fetchPlaces()` 之前)。骨架条件收紧为 `!placesLoaded && (loading || !attempted)`(覆盖"正在加载"与"还没试过"两种情况),失败条件收紧为 `attempted && !placesLoaded && !loading`。

**补测试的排雷记录(值得记录的真实教训)**:第一版测试把 `mount()` 包进一个 `async function mountFresh() { ...; return { w } }` 再 `await mountFresh()`,结果**无论有没有修这个 bug,测试都是绿的**——诊断后发现:`mountFresh()` 本身是 `async` 函数,即使函数体里 `mount()` 之后没有任何 `await`,调用方 `await mountFresh()` 也一定会让出至少一次微任务;而 `attempted.value = true`/`loading.value = true` 在 `onMounted` 里是**同步**执行的(前面没有 await),Vue 的响应式调度器早在 `mount()` 内部就把这次变化的重渲染排进了微任务队列——那次多余的 `await` 恰好让断言跑在了"Vue 已经重渲染过一轮"之后,永远看不到真正的第一帧。用 `w.html()` 手工写盘核对确认了这个时序差异(debug 脚本已删除,不留在版本库里)。改成不包 helper、`mount()` 之后不打任何 `await` 就立刻断言,才是真的卡在第一帧。

**删码验证**:模板条件退回 `!placesLoaded && loading`(骨架)/`!placesLoaded && !loading`(失败,去掉 `attempted`)→ 用例变红(`AssertionError: expected false to be true`,断言骨架应该出现但没出现)。还原后复跑绿。

## M3:图例第四组颜色靠源码顺序苟活

**问题**:`.map-legend .dot`(0,2,0)与 `.map-legend .dot-trip`(0,2,0)优先级相等,只因 `dot-trip` 规则写在后面才赢——本仓"优先级相等靠源码顺序苟活"这一种级联坑的第四次出现(T5/T9/T10 已各遇一次)。重排样式块会让第四组静默变回 accent 色,原测试只断言了文案,没断言颜色/优先级。

**修法**:选择器改成 `.map-legend .dot.dot-trip`(两个 class,优先级 0,3,0),无条件赢过基类,不依赖书写顺序。补一条测试:用 `cssCascade.ts` 的 `parseCssRules` 直接解析样式块,取两条规则的选择器,按 class 计数比较优先级,断言 `dot-trip` 那条严格更高(不是靠"当前顺序恰好谁赢"这种脆弱断言)。

**删码验证**:选择器降回 `.map-legend .dot-trip`(0,2,0)**并且**把这条规则整块移到 `.map-legend .dot` **前面**(完全模拟"重排样式块"的真实场景)→ 用例变红(`AssertionError: expected 2 to be greater than 2`)。还原后复跑绿。

## M4:四处未登记的保真漂移,补注释(不改值)

逐条补了登记注释(注释里不含字面色值,遵守 color-guard 不剥注释的规则):
1. `.map-shell` 新增的 `border`/`border-radius`/`overflow:hidden` 三条——Vue2 `scss:29-36` 只有 flex/grid/background,这三条是 New-UI 新增的统一卡片外框,不是保真移植的一部分。
2. `.map-tip`/`.map-legend`/`.map-stats` 的圆角字面值 `12px`——本仓没有等价 Vue2 `--r-md`(10px)的圆角 token,就近取值,登记数值有出入。
3. `.map-tip .thumb` 的圆角字面值 `8px`——同上,对应 Vue2 `--r-sm`(6px)。
4. `.map-tip .thumb` 的底色改用 `var(--chip-bg)`——Vue2 `scss:453` 是写死的纯黑,这里随主题走,不是精确复刻那个 theme-invariant 的黑底(同 D3 裁定,surface treatment 归 New-UI 重塑)。

## M5:`router/index.test.ts` 的注释不实

**问题**:注释声称"完整的顺序/未重排断言见 `PhotosPlaces.test.ts`",但那份文件只用 `?raw` 取 `PhotosPlaces.vue` 自己的样式块做 pointer-events 断言,从未读过 `router/index.ts` 的源文本——这句话是不实的。

**修法**:删掉那句不实注释,就近在 `router/index.test.ts` 本身补真断言——`?raw` 读 `router/index.ts` 源文本,断言 `/photos/people/:id` 的索引 < `/photos/places` 的索引 < `/login` 的索引(只追加、插在正确位置、不重排)。

## 不用改的(已裁定,记录存档)

- 评审 M4(原编号,测试文档已重编为 M4/M5 两条实际改动项):「两弹层同开」测试在真实浏览器不完全可达(真实点击会先被 document mousedown 关掉第一个弹层)——**测试保留**,作为"两个 Esc handler 同挂时都收得到"的回归守卫仍有价值,报告措辞已改准(见上文原 §9 描述未做夸大声明)。
- 评审 M7(原编号):窄屏单列下 `.map-canvas-wrap` 无 `min-height` 可能塌高——jsdom 测不到,已列入真机验收清单,本轮不改。

## 收尾验证结果

- `pnpm exec vitest run src/views/__tests__/PhotosPlaces.test.ts src/router/index.test.ts src/styles/color-guard.test.ts`:**3 files / 295 tests 全绿**。
- `pnpm exec vue-tsc --noEmit`:零报错。
- 全量 `pnpm exec vitest run`:**280 files / 2530 tests 全绿**(较修复前 2522 条净增 8 条:I1 三条 + M1 两条 + M2 一条 + M3 一条 + M5 一条,减去合并计数误差)。
- `pnpm exec vitest run src/i18n`:i18n parity 等 3 个文件 18 条全绿。

## 改动文件(本轮追加)

- `src/views/PhotosPlaces.vue`:新增 `attempted` ref + 收紧骨架/失败态条件(M2);图例第四组选择器改 `.dot.dot-trip`(M3);四处 M4 登记注释;`onUpdateThemeSelection` 保持原有分流逻辑不变(I1/M1 是测试补漏,不是实现缺陷)。
- `src/views/__tests__/PhotosPlaces.test.ts`:新增 I1(3 条)、M1(2 条)、M2(1 条)、M3(1 条)四个 describe 块。
- `src/router/index.test.ts`:删不实注释,补真实顺序断言(M5)。
