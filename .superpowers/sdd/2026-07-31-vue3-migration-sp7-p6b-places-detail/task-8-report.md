# Task 8 报告: 容器接线 —— 面板挂载 · hasDetailPanel 真实化 · 灯箱 · toast · 跳库导航

## 结论

状态:完成。

- 修改 `src/views/PhotosPlaces.vue`(容器接线全部落地)、
  `src/views/__tests__/PhotosPlaces.test.ts`(既有 28 条不动 + 新增 21 条)、
  `src/photos/composables/__tests__/usePlacesView.test.ts`(既有 30 条不动 + 新增 4 条)。
- 额外修改 `src/photos/stores/places.ts` 一行(见下方"意外发现"节,非 brief 列出的文件,
  但是本任务能跑通的必要前提,已征得任务边界内的合理性判断)。
- 全量:`pnpm exec vitest run` 287 files / **2918 passed**(基线 287/2893,净增 25 例:
  21 + 4,与两文件新增 it() 数一致)。`pnpm exec vue-tsc --noEmit` 0 错误。
  `color-guard.test.ts` 406 passed(未改动任何样式,基线不变)。

## 13 条结构规格逐条落地情况

1. **activePlace/activeDetail 分流(偏离登记 4)**:逐字落地,`activeDetail` 用
   `String(store.detail.id) === String(activeId.value)` 守卫。`hasPanel` 用
   `activePlace != null || activeDetail != null`(brief 给的公式)。
2. **hasDetailPanel 真实化**:`usePlacesView({ ..., hasDetailPanel: () => hasPanel.value })`。
3. **面板挂载**:位置、props、13 个 emit 全部按 brief 逐条接线,放在 `.map-canvas-wrap` 内
   `PlacesMap` 之后、`.map-tip` 之前。
4. **容器状态**:`activeSpotKey`/`coverOpen`/`coverTab`(初 `'recent'`)/`coverSearch`/
   `coverPage` 五个 ref 全部按 Vue2 :114-121 的字段对应关系建好。
5. **activeId watch 追加重置**:五行重置追加在既有 `autoPanTo`+`loadDetail` 之后,两行不动。
6. **封面候选三个 watch + openCoverPicker**:`fetchCandidatesIfOpen()` 收口前置条件
   `activeId && coverOpen`;`coverTab`/`coverSearch` 变化各自把 `coverPage` 归零再拉;
   `coverPage` 变化直接拉;`openCoverPicker()` 置真后立即拉一次。未加 debounce。
7. **封面提交**:`onPickCover`/`onResetCover` 均先 `coverOpen.value=false` 再提交,失败
   `toast.show(t('photosPlacesCoverFailed'))`。
8. **spot 三动作**:`onPickSpot`/`onRenameSpot`/`onResetSpotName` 逐字落地,失败文案共用
   `photosPlacesSpotRenameFailed`,成功后均不额外 `loadDetail`。
9. **相册与 toast**:`createAlbum` 统一入口,`onSaveAlbum`/`onSaveTrip` 按 brief 公式拼
   `name`;成功 toast 5000ms + action(跳相册详情);`albumBusy` 消息不弹 toast。
10. **灯箱(D9)**:`onOpenPhoto` 用 `assetToPhoto({ id })` 占位,`list.length ? list : [assetId]`
    兜底;模板末尾 `AreaShell` 之外挂 `<PhotoLightbox />`。
11. **跳库导航**:`goLibrary`/`onOpenSpotLibrary` 均用 `activePlace.value?.key ?? activeId.value`
    (**不是** `activeId` 本身);`onOpenSpotLibrary` 跳走前 `activeSpotKey.value = null`。
12. **封面弹层挂载**:`AreaShell` 之外,`v-if="coverOpen"`? —— 实际按组件自身约定改为
    `:open="coverOpen"`(`PlaceCoverPicker` 内部按 `open` prop 控制 `v-if`,不是容器侧
    `v-if` 包一层);props/emit 全量接线,与 brief 给的接口签名核对一致。
13. **三浮层同开一次 Esc 各自都关**:补了一条集成测试(Filters + 主题 + 封面弹层三者同开,
    一次 `document` keydown Escape 三者都关)。

## 四条 panelFrac 断言的手算过程

`wrapEl` 宽 1000 → `panelFrac = min(0.55, 420/1000) = 0.42` → 可见中心
`c = { x: 1000*(1-0.42)/2 = 290, y: 250 }`(与既有 `visibleCenterVb` 用例的手算值一致)。

- **centerOn(100, 50, 2)**:从 `{tx:0,ty:0,scale:1}` 起,`animateView({scale:2, tx:c.x-100*2, ty:c.y-50*2})`
  → `tx = 290-200 = 90`,`ty = 250-100 = 150`。
- **zoomBy(2)**:从 scale=1(`{tx:0,ty:0,scale:1}`)起,`applyZoom(1*2=2, 290, 250)`:
  `wx=(290-0)/1=290`,`wy=(250-0)/1=250` → `tx=290-290*2=-290`,`ty=250-250*2=-250`。
  对照面板关闭(`c=(500,250)`):`tx=500-500*2=-500`,两者确实不同。
- **setScale(4)**:同起点,`applyZoom(4,290,250)` → `tx=290-290*4=-870`,`ty=250-250*4=-750`。
  对照关闭态:`tx=500-500*4=-1500`。
- **autoPanTo(place{lon:-90,lat:45})**:`project(-90,45)=(250,125)`,`scale=max(1,1.8)=1.8`,
  `centerOn(250,125,1.8)` → `tx=290-250*1.8=-160`,`ty=250-125*1.8=25`。用"世界点映射回屏幕
  坐标 `tx+wx*scale` 必须精确等于可见中心"这一不变量核验(`-160+250*1.8=290`,不是 500),
  比直接断言 tx 数值更贴合"该点最终落在可见中心"这句话的字面含义。

容器级(`PhotosPlaces.test.ts`)的对应集成测试因 jsdom 默认 `getBoundingClientRect` 恒返回
全 0(未显式 mock 宽度时),`420/0=Infinity` 会被 `Math.min(0.55, …)` 钳到 **0.55** 而非composable
测试里手动 mock 的 0.42 —— 这也是既有的"自动选中后 autoPanTo 被调用"用例需要更新数值的原因
(见下方"既有用例改动"节)。容器级"hasDetailPanel 真实化"新增用例里显式把 `.map-canvas-wrap`
的 `getBoundingClientRect` 钉到宽 1000,复现 0.42 这条口径,与 composable 层用例保持一致。

## 8 项删码验证结果

逐项单独删除 → 跑对应测试确认变红 → 用 Edit 手工切回(全程未用 `git checkout --`)。

| # | 删的内容 | 预期红的用例 | 实测结果 |
|---|---|---|---|
| ① | `hasDetailPanel: () => hasPanel.value` 改回 `() => false` | 既有"自动选中后 autoPanTo"用例 + 新增"hasDetailPanel 真实化"用例 | **确认变红**(2 条),已复原 |
| ② | `activeDetail` 的 id 匹配条件删掉(简化成 `computed(() => store.detail)`) | 偏离 4 守卫用例 | **确认变红**,已复原 |
| ③ | 切城市重置那 5 行删掉 | "打开封面弹层+选中spot+翻页,再改activeId→全部复位"用例 | **确认变红**,已复原 |
| ④ | `onPickCover` 里的 `coverOpen.value = false` 删掉 | "点cell→弹层先关"用例 | **确认变红**,已复原 |
| ⑤ | `createAlbum` 的 `albumBusy` 判据删掉(`catch` 恒弹 toast) | "albumBusy 错误不弹 toast"用例 | **确认变红**,已复原 |
| ⑥ | `goLibrary` 的 `activePlace.key` 换成 `activeId` | "open-library → push 到 /photos/places/7"用例(id≠key 的合成 fixture) | **确认变红**(实际 push 到 `/photos/places/weird-id`),已复原 |
| ⑦ | `onOpenPhoto` 的 `list.length ? list : [assetId]` 改成恒 `[assetId]` | D9 用例 | **确认变红**,已复原 |
| ⑧ | 封面拉取的 `!coverOpen.value` 前置条件删掉 | "coverOpen=false 时改tab不拉"用例 | **第一次删除测试未变红**(见下),定位并修正测试后**确认变红**,已复原 |

**⑧ 的插曲(已在测试文件内联注释登记)**:第一次验证时该用例仍然全绿——排查发现测试脚本里
误写了一句多余的 `panel.vm.$emit('close')`(在关闭封面弹层之前,先对 `PlaceDetailPanel`
emit 了 `close`),这会把 `activeId` 一并置空,而 `fetchCandidatesIfOpen` 里还有一条独立的
`!activeId.value` 早退——两条早退条件在这个错误的测试序列下"叠罗汉"生效,单独删掉
`!coverOpen.value` 那一条完全不影响结果,测试测不出差异。修正为只调用
`PlaceCoverPicker` 自己的 `close`(只把 `coverOpen` 置假,不碰 `activeId`)后,删码验证按
预期变红。这是一次真实的"测试本身有坑"经历,已在测试代码内联注释里说明,供后人参考。

## 既有 28 条用例是否有改动及理由

**改动了 1 条**(不属于删除或弱化,是数值订正):"首屏加载 + 自动选中 > 自动选中后 autoPanTo
被调用……" —— `hasDetailPanel` 换真实状态后,首屏自动选中 TOKYO 即让 `activePlace` 命中,
`hasPanel` 从首帧起就是 `true`。该用例的 `wrapEl` 是未 mock 宽度的真实 DOM 节点,jsdom 默认
`getBoundingClientRect` 恒返回全 0,`420/0=Infinity` 被 `Math.min(0.55,…)` 钳到 0.55,
可见中心 `c.x` 从原先假设的"正中心 500"变成 "225"(`1000*(1-0.55)/2`)。`ty` 公式不受影响
(panelFrac 只改 x,`visibleCenterVb` 源码只在 x 分量里乘 `(1-panelFrac)`)。原断言
`view.tx ≈ MAP_W/2 - wx*1.8` 改为 `view.tx ≈ 225 - wx*1.8`,并在用例上方加注释说明这是
"panelFrac 首次真正生效"导致的必然数值变化,不是弱化——用例的语义(autoPanTo 精确落点)
完全保留,只是常量随真实行为更新。其余 27 条零改动。

## 意外发现:store 缺口(places.ts)

实现过程中发现 `src/photos/stores/places.ts` 的 `return {...}` 语句里只导出了 `albumBusy`,
**没有导出 `coverBusy`/`spotBusy`**(两个 ref 在 store 内部都已定义并在各处正确读写,只是没
被暴露给消费方)。brief 的"前序任务已落地的真实接口"一节明确要求容器传
`:spot-busy="store.spotBusy"` 给 `PlaceDetailPanel`,`PlaceCoverPicker.vue` 文件头注释也
写着"容器负责……把 store.spotBusy 透传成本组件的 busy prop"——这是 T2 store 任务遗留的一个
真实缺口(此前没有任何消费方读取过这两个字段,所以没有测试捕捉到)。已在
`src/photos/stores/places.ts` 补上 `coverBusy, spotBusy` 到 return 语句(仅一行改动,不影响
`__resetForTest`/其余逻辑),否则本任务传给两个子组件的 busy prop 会恒为 `undefined`。
已核对 `src/photos/stores/__tests__/places.test.ts` 现有测试全部通过行为断言(reject/副作用)
验证 busy 语义,不直接读 `store.spotBusy`/`store.coverBusy`,因此这处修复未导致任何既有测试
变化。

commit 时一并带上这个文件(brief Step 5 给的 `git add` 列表未列出它,但它是本任务功能
正确性的必要前提,已在 commit message 里注明)。

## 测试数字前后

| | 改动前(基线) | 改动后 |
|---|---|---|
| `vitest run`(全量) | 287 files / 2893 passed | 287 files / **2918 passed** |
| `vue-tsc --noEmit` | 0 错误 | 0 错误 |
| `color-guard.test.ts` | 406 passed | 406 passed(未改动样式) |
| `PhotosPlaces.test.ts` | 28 | 49(+21) |
| `usePlacesView.test.ts` | 30 | 34(+4) |

## 遗留疑问

- `PlaceCoverPicker` 在 T7 里是"纯受控组件",自身用 `v-if="open"` 控制显隐(不是容器侧包一层
  `v-if`)——brief 结构规格 12 写的是"`v-if` 由 `coverOpen` 控制",本实现按 `:open="coverOpen"`
  prop 传入,由组件内部处理 `v-if`,与组件既有实现一致,语义等价,已在上方"13 条"逐条落地
  情况的第 12 条里登记这处措辞差异。
- `store.places.push(...)`/`store.detail = {...}` 这类直接改写 Pinia setup-store 内部
  ref 的手法用于"跳库导航"两条测试(需要构造 id≠key 的合成 fixture 来证明删码敏感性)——
  这是测试专用的合成数据注入,不代表真实 `fetchPlaces()`/`toPlace()` 链路会产生 id≠key 的
  情形(`toPlace()` 恒 `id = String(key)`)。如后续任务要在真实数据链路上验证这条不变量,
  需要另外设计 fixture 或 mock `service.photos.listPlaces()` 返回值本身。
- 未新增任何 i18n 键(复用 T1 已备的 45 键),`parity.test.ts` 未受影响。
