### Task 11: `PhotosPlaces.vue` 容器 + 图例 + 统计 + 悬停卡片 + 路由 + 侧栏

**Files:**
- Create: `src/views/PhotosPlaces.vue`
- Create: `src/views/__tests__/PhotosPlaces.test.ts`
- Modify: `src/router/index.ts`(在 `:44` 的 `photos-person-detail` 之后追加一条)
- Modify: `src/photos/components/PhotosSidebar.vue:31-35`(NAV 加 `places`,插在 `people` 之后、`favorites` 之前)
- Read-only 参考: `PhotosPlacesView.vue:760-761`+`:827-828`+`:949-950`+`:1013-1056`+`:1250-1251`(容器骨架、图例、统计、悬停卡片)、`:70-132`(state)、`:290-322`(watch)、`:323-367`(mounted/beforeDestroy)、`:736-753`(pickPin/setHover)、`photos-places.scss:19-38`(根/shell)、`:191-233`(canvas-wrap/toolbar)、`:285-332`(legend/stats)、`:437-477`(map-tip);既有壳体例 `src/views/PhotosPeople.vue:47-60` 与 `PhotosAlbums.vue:185-188`

**Interfaces:**
- Consumes: 全部前序任务
- Produces: 路由 `photos-places` → `/photos/places`;侧栏 `places` 条目

**结构规格:**

1. **壳**:`AreaShell`(title = `t('photosPlaces')`)+ `.photos-layout` + `PhotosSidebar` + `.photos-main`,**逐段复制 `PhotosAlbums.vue:185-188` 的结构**(P3/P4/P5 既定:不抽公共)。
2. `.map-shell` 两栏:`PlacesRail`(左)+ `.map-canvas-wrap`(右,`position: relative`,承载地图与所有浮层)。
3. `.map-canvas-wrap` 内(**层序照 Vue2**):`.map-toolbar`(内含 `PlacesFilterMenu` 与 `PlacesThemeMenu` 两个 chip,外加 `.map-spacer`)→ `PlacesZoomBar` → `PlacesMap` → 悬停卡片 → `.map-legend` → `.map-stats`。
   > `.map-toolbar` 的 `pointer-events: none` + `> * { pointer-events: auto }`(`scss:199-207`)必须照搬,否则工具栏那条透明带会吃掉地图拖拽。
4. **悬停卡片 `.map-tip`**(照 Vue2 `:1013-1028`):`v-if="hoverPlace && hoverPlace.id !== activeId"`(**当前选中的地点不显示 tip**);`:style="{ left: hoverPos.x + 'px', top: hoverPos.y + 'px' }"`;内含 `.thumb > img` + `.name`(城市)+ `.meta`(国家 · `photosPlacesPhotoCount` · 本地化日期)。定位换算照 Vue2 `:744-752` 但用**显式 wrap ref**(偏离登记 10):`hoverPos = { x: pinRect.left - wrapRect.left + 20, y: pinRect.top - wrapRect.top }`。
5. **图例 `.map-legend`**(照 Vue2 `:1030-1044`):四组 —— `.dot.s1` + `< 40`、`.dot.s2` + `40–100`、`.dot.s3` + `100+`、`.dot.s2`(绿色)+ `photosPlacesCurrentTrip`(`margin-left: 6px`)。**第四组的绿色 Vue2 是内联 `background:#34c759` + `box-shadow` —— New-UI 改用 `--good` token**,写进样式类而非内联。三个数字字面量直接写在模板(T2 已注释登记耦合关系)。
6. **统计 `.map-stats`**(照 Vue2 `:1046-1056`):三个 `.stat`,各 `.v` + `.k`(城市 / 国家 / 照片,照片数走 `toLocaleString()`)。
7. **接线**:
   - `onMounted`:`fetchPlaces()`;**成功后若 `activeId` 为空且有地点 → `activeId = places[0].id`**(照 Vue2 `:412-413`,T3 刻意没做这一步)。
   - `activeId` watch(照 Vue2 `:291-302`):变化且非空 → `autoPanTo(找到的 place)`;总是 `loadDetail(next)`(P6a 拉了详情但不渲染面板 —— **保留这条调用**,因为 P6b 接面板时就不用再动容器接线,且能在真机验收时从 Network 面板看出详情接口通不通)。
   - 过滤后的地点:`filterPlaces(store.places, filter)` 的结果同时喂 `PlacesRail`(props.places)与 `PlacesMap`(props.places)。**rail 的搜索词不影响地图**(核 Vue2 `:229`/`:237` 已确认)。
   - `pick-pin`:`pin.cluster` → `zoomToCluster(pin, view.scale)`;否则 `activeId = pin.id`(照 Vue2 `:736-743`,**事件里要 `stopPropagation`** 免得触发底层平移)。
   - **wheel 用 `addEventListener('wheel', onWheel, { passive: false })` 显式注册在 svg 元素上**(偏离登记 11-⑤),`onUnmounted` 摘掉;pointer 三个事件用模板绑定即可。
   - `onUnmounted`:`usePlacesView().dispose()` + 摘 wheel 监听。
8. **加载/失败态**(偏离登记 9):`!placesLoaded && loading` → 地图区骨架;`!placesLoaded && !loading`(即失败)→ `photosPlacesLoadFailed` + `photosPlacesRetry` 按钮(点了重调 `fetchPlaces`)。
9. **两个弹层的 Esc 互不干扰**:两个都开时按一次 Esc,**各自都要关**(P5-T10 的 bug 形态)——这条在本任务写集成测试钉住。
10. 路由:`{ path: '/photos/places', name: 'photos-places', component: PhotosPlaces }`,**追加在 `/photos/people/:id` 之后**(只追加,不重排)。侧栏:`{ id: 'places', route: '/photos/places', labelKey: 'photosPlaces' }` 插在 `people` 之后。

- [ ] **Step 1: 写失败测试**

必含用例:
- 壳:`AreaShell` title 为「地点」;`PhotosSidebar` 存在。
- `onMounted` 调 `fetchPlaces`;加载完自动选中第一个地点(`activeId === places[0].id`)。
- 首屏自动选中后 `autoPanTo` 被调用且入参是第一个 place(spy composable 或断言 `view` 变了)。
- **`activeId` 切换时 `loadDetail` 被调用**(P6b 的接缝守卫)。
- 过滤联动:设 `minCount = 50` 后 rail 与 map 收到的 `places` 都被过滤(断言两个子组件的 props 长度)。
- **rail 的搜索不影响 map**:在 rail 里输入词,map 的 `places` prop 不变。
- `pick-pin`:簇 → `zoomToCluster` 被调;非簇 → `activeId` 变成 pin.id。
- 悬停卡片:hover 非选中地点 → tip 出现且文案含城市/国家/照片数;**hover 当前选中地点 → tip 不出现**;`hover-clear` → tip 消失。
- 图例四组齐备;第四组文案是「当前行程」;三个数字字面量 `< 40` / `40–100` / `100+` 都在。
- 统计三项;照片数走 `toLocaleString()`(传 12345 断言出现千分位)。
- 失败态:`fetchPlaces` 失败 → 出现「地点加载失败」+ 重试按钮;点重试再调一次 `fetchPlaces`。
- **wheel 是 `addEventListener` 注册且 `passive: false`**:spy `svgEl.addEventListener`,断言第三参 `{ passive: false }`;`onUnmounted` 后 `removeEventListener` 被调。
- **两弹层同开时一次 Esc 各自都关**(document keydown,`bubbles: true`)。
- `.map-toolbar` 的 `pointer-events: none` 与 `> *` 的 `auto` 都在样式块里(程序化断言文本,防重塑时丢掉导致拖不动地图)。
- 路由表含 `/photos/places`;侧栏 NAV 顺序为 `library, albums, people, places, favorites, trash`。

- [ ] **Step 2-4: 跑失败 → 实现 → 全量绿 + 逐个删码验证**

Run: `pnpm exec vitest run && pnpm exec vue-tsc --noEmit`

删码清单:①自动选中第一个地点那行删掉 → 对应用例红;②`activeId` watch 里的 `loadDetail` 删掉 → 接缝用例红;③把 rail 的 `places` 换成搜索后的结果并同时喂给 map → 「搜索不影响 map」红;④tip 的 `hoverPlace.id !== activeId` 条件删掉 → 对应用例红;⑤wheel 改回模板 `@wheel` → passive 用例红;⑥`.map-toolbar` 的 `pointer-events` 两行删掉 → 程序化断言红。

- [ ] **Step 5: Commit**

```bash
git add src/views/PhotosPlaces.vue src/views/__tests__/PhotosPlaces.test.ts src/router/index.ts src/photos/components/PhotosSidebar.vue
git commit -m "feat(photos): P6a-T11 地点容器 + 图例/统计/悬停卡片 + 路由与侧栏第 6 条目

- 首屏自动选中第一个地点并 autoPan(照 Vue2 :412);详情接口照调,面板留 P6b
- wheel 显式 { passive: false } 注册(偏离登记 11-⑤)
- 悬停定位改用显式 wrap ref,不靠 parentElement(偏离登记 10)"
```

---

## Self-Review 记录

**1. Spec 覆盖(逐条核 spec §7b 的 P6a 11 项)**

| spec §7b P6a 条目 | 落在 |
|---|---|
| ① `placesCluster.ts` 照搬 + 单测全新建 | T1 |
| ② `placesMap.ts`(tierRadius / declutterPins / splitScaleFor / buildPins / visitedDots)+ worldMap 钳制补测 | T2 |
| ③ `stores/places.ts` | T3 |
| ④ i18n + 后端 key 映射表 | T4(**region 映射在本期;`photos.places.insight.*` 映射推 P6b —— 已在下方「与 spec 的两处偏差」登记**) |
| ⑤ `PlacesRail.vue` | T5 |
| ⑥ `PlacesMap.vue` | T6 |
| ⑦ `usePlacesView.ts` | T7 |
| ⑧ `PlacesZoomBar.vue` | T8 |
| ⑨ `PlacesFilterMenu.vue` | T9 |
| ⑩ `PlacesThemeMenu.vue`(D5) | T10 |
| ⑪ 容器 + 图例/统计/hover tip + 路由 + 侧栏 | T11 |

**与 spec §7b 的两处偏差(本计划有意收窄,已在上文对应位置登记):**
- **经纬线不做** —— spec §7b ② 列了「经纬线」,实测 `latitudeLines`/`longitudeLines` 与配套 `.world-graticule`/`.world-equator` CSS 在 Vue2 是死代码(模板零消费,已 grep 实证)。**spec §7b 的这半句作废,以本计划「不做」清单为准。**
- **insight key 映射推 P6b** —— spec §7b ④ 写「后端 key 映射两张表」,但 insights 只在详情面板渲染(P6b 范围),映射表跟着消费方走更不容易漂。P6a 只做 region 映射。

**2. Placeholder 扫描:** 已过。唯一带注释占位的是 T2 追加到 `worldMap.test.ts` 的三个 `it`,**已在正文用加粗警告要求实现者替换成真实断言、不许留空壳**,并给了「先手算期望值再写死」的方法。

**3. 类型一致性:**
- `Place` / `Pin` / `PlacesFilter` / `RegionCount` / `PlacesStats` 全部单点定义在 T2 `placesMap.ts`,T3/T5/T6/T9/T11 一律 import,无重复手写(P5-T12 的 `PersonPlace` 在两处手写重复是当期 deferred,本期不重犯)。
- `Cluster<T>` / `ClusterItem` 定义在 T1,只被 T2 消费。
- `MapThemePreset` / `ResolvedMapTheme` 定义在 T10,被 T6(`themeVars`)与 T11 消费 —— **T6 的 `themeVars` prop 类型写成 `Record<string, string>` 而非 `ResolvedMapTheme`**,因为它吃的是 `mapThemeStyleVars()` 的产物(CSS 变量字典),不是主题对象本身。已核。
- `MapThemePrefs` 定义在 T3(store),T10 弹层通过 emit 回传字段而非直接改 store。已核。
- `usePlacesView` 的 `zoomToCluster(pin, currentScale)` 比 Vue2 多收一个 `currentScale` —— 因为 composable 自己持有 `view`,本可不传;**保留显式传参是为了让 T11 的调用点读起来能看出「以当前缩放为下界」**。T7 接口块与 T11 调用点已对齐。
- T8 的 emit 名 `zoom-by` / `set-scale` / `reset` 与 T11 接线一致;T5 的 `pick` / `toggle-fold` 与 T11 一致;T6 的 `pick-pin` / `hover-pin` / `hover-clear` 与 T11 一致;T9/T10 的 `update:filter` / `update:open` 与 T11 一致。已逐个核。

**4. 范围检查:** 11 任务、单一子系统(地点地图主视图),不需要再拆。依赖链是 T1 → T2 → {T3, T5, T6, T7} → {T8, T9, T10} → T11,**T4(i18n)是 T5/T6/T8/T9/T10/T11 的共同前置,必须排在 T5 之前**。

---

## 文末:真机验收清单(:5277)

起服务:
```bash
ss -ltn | grep 5277        # 有旧 server 就先杀掉那个 PID
cd /home/nimo/NimoTech/.sp7/NimoOS-New-UI && pnpm dev --host --port 5277
```
浏览器先在 `http://192.168.1.143:5277/` 根路径登录一次,再进 `http://192.168.1.143:5277/app/#/photos/places`。

**逐项眼验(勾不动的记进台账挂账,不要静默放过):**

- [ ] 侧栏第 4 条「地点」在「人物」之后、「收藏」之前;点进来是地图页。
- [ ] rail 统计头三段数字(城市 / 国家 / 照片)与右下角 `.map-stats` 三项**一致**。
- [ ] rail 大洲分组头能折叠/展开,**折叠是高度过渡而不是瞬间消失**;刷新页面后折叠状态还在(localStorage)。
- [ ] rail 搜索框输城市名能筛;**搜索时被折叠的组会自动展开**(匹配项不被藏);搜索无果出「没有匹配…」文案。
- [ ] rail 缩略图能出图(不是灰块);点城市行 → 该城市高亮 + **地图平滑滑到该城市并放大到至少 1.8 倍**(不是瞬移、不是不动)。
- [ ] 地图陆地点阵能看出大陆轮廓;**去过的地方那几个点颜色更亮**。
- [ ] 图钉三档大小肉眼可分;右下图例的三个尺寸与地图上的对得上。
- [ ] 当前行程的图钉是**绿色**;图例第四组也是绿色 + 「当前行程」。
- [ ] 选中的图钉有**脉冲光环 + 城市名标签**;标签在放大/缩小时**字号不变**(始终一样大)。
- [ ] 滚轮缩放:**光标底下那个点不动**(以指针为锚,不是以屏幕中心)。
- [ ] 拖拽平移顺滑;**从图钉上按下拖动不会平移地图**(只有点选)。
- [ ] 右侧滑杆:拖到顶=最大缩放、拖到底=最小;±按钮有效;⤢ 一键复位到全球视图。
- [ ] 缩小到某个程度,邻近城市**合并成一个簇气泡**(带浅色描边、无内核圆点、无城市标签);点它 → **平滑放大到刚好裂成两个**的程度。反复点能一层层裂到单个城市。
- [ ] 放到最大缩放时,**同城/共点的城市被推开各占一个位置**,每个都能单独点中。
- [ ] 悬停图钉出小卡片(缩略图 + 城市 + 国家·N 张·日期);**悬停当前选中的那个不出卡片**;移开消失。
- [ ] Filters 弹层:徽标计数随开的条件数变化;「最少照片数」五档有效;「区域」再点一次能取消;「只看当前行程」有效;两个日期都填才生效(**只填一头时地图不应该变空**);重置能全清;点弹层外面/按 Esc 关闭。
- [ ] **「本年」相关**:自定义区间填今年 → 能筛到今年的地点(2026 年不再依赖写死的 202(5|6))。
- [ ] 地图主题弹层:4 个预设切换后地图底色/点色**立即变**;色板小方块的颜色与实际效果一致;两个取色器改色后地图跟着变;刷新页面后主题还在。
- [ ] **切换应用浅色/深色主题**(顶部/设置里的主题开关)→ 地图预设自动换成对应的浅色/深色变体;**自定义模式下不跟着变**(照 Vue2 现状,已登记)。
- [ ] 两个弹层同时打开时,按一次 Esc **两个都关**。
- [ ] 大洲名与所有文案是**中文**(不出现 `Asia` / `Ocean` / `Filters` 等英文残留);切到英文 locale 后全变英文。
- [ ] 日期显示是中文格式(不是 `Mar 7, 2026`)。
- [ ] 窄屏(手机/缩窗)下侧栏变抽屉、地图区不横向溢出。
- [ ] 浅色主题下地图上的城市标签、簇描边、图例文字都**看得见**(不是白底白字 / 深底深字)。
- [ ] 控制台无报错;Network 里 `/v1/photos/places` 与 `/v1/photos/places/:key` 都 200(**详情接口本期不渲染面板,但应当已在调**)。
