### Task 4: `PlaceSpotDialog.vue` + 面板内 spots 列表段

**Files:**
- Create: `src/photos/components/PlaceSpotDialog.vue`
- Create: `src/photos/components/__tests__/PlaceSpotDialog.test.ts`
- Modify: `src/photos/components/PlaceDetailPanel.vue`(在 `.detail-body` 里加 spot 弹窗挂载点 + spots 列表段)
- Modify: `src/photos/components/__tests__/PlaceDetailPanel.test.ts`(追加 spots 段用例)
- Read-only 参考: `PhotosPlacesView.vue:1109-1172`(模板)、`photos-places.scss:621-701`(样式)、`:473-516`(逻辑)

**Interfaces:**
- Consumes: `type PlaceSpot`(T2)、T1 的键
- Produces:
  ```ts
  // PlaceSpotDialog.vue props
  {
    spot: PlaceSpot          // 必须是 detail.spots 里的那一项(不持副本,改名后自动同步,偏离登记 7)
    busy: boolean            // store.spotBusy —— 重命名/恢复默认在途时禁用两个提交按钮
  }
  // emits
  (e: 'close'): void
  (e: 'rename', name: string): void
  (e: 'reset-name'): void                       // D8
  (e: 'open-library'): void
  (e: 'open-photo', assetId: string): void
  ```
  `PlaceDetailPanel` 新增 emits:`(e: 'pick-spot', spot: PlaceSpot): void`(点 spots 列表行);新增 props:`activeSpotKey: string | null`(容器持有当前打开的 spot key,面板据此在 `.detail-body` 顶部渲染弹窗)、`spotBusy: boolean`;并把 `PlaceSpotDialog` 的五个 emit 原样透传给容器(`rename` / `reset-name` / `close-spot` / `open-library` 用 **`open-spot-library`** 区分于面板自己的 `open-library`)。

**结构规格:**

**A. spot 弹窗(照 Vue2 `:1109-1150`)** —— 注意它**不是浮层**,是 `.detail-body` 顶部的一张内嵌卡片(`margin-bottom:16px`,accent 软底 + accent 边框):

1. `.spot-dialog-head`:13px 地图图标(色用 `--accent-text`,Vue2 是 `--accent-hi`)+ 中间弹性区 + 右侧 `.icon-btn` 关闭(17px ×)。
2. 中间弹性区两态:
   - **非编辑态** `.spot-dialog-name`:`.one-line`(单行省略)显示 `spot.name` + `.spot-rename-btn`(20×20,16px 铅笔图标,`title` = `photosPlacesSpotRename`)。
   - **编辑态** `.spot-rename`:`<input>`(`maxlength="60"`、`placeholder` = `photosPlacesSpotNamePlaceholder`、回车提交、Esc 退出编辑)+ `.spot-rename-save`(`photosPlacesSpotSave`,`:disabled` = 空白名 **或 `busy`**)+ `.spot-rename-cancel`(复用 `photosCancel`)。
   - **点铅笔进编辑态时:草稿初值 = 当前名,并 `nextTick` 后 focus 输入框**(照 Vue2 `:486-494`)。
   - **`props.spot.key` 变化时退出编辑态**(照 Vue2 watch `:303`)。
3. `.spot-dialog-coords`:**`formatSpotCoords(spot.lat, spot.lon)`(T2 的纯函数,偏离登记 16 —— 按符号出 N/S、E/W,不照搬 Vue2 写死的 N/E)**;函数返回空串时**整行不渲染**。**等宽字体**用 `--num-font`(本仓已有),不照抄 Vue2 的 `ui-monospace, SFMono-Regular, monospace` 字体栈。
4. **`.spot-dialog-reset`(D8,net-new)**:放在编辑态那一行的**最右**(`photosPlacesSpotResetName`,`:disabled` = `busy`),`@click` → `emit('reset-name')`。样式复用 `.spot-rename-cancel` 的 ghost 形态。**代码注释必须写明这是 D8 授权的新增元素、Vue2 无此按钮。**
5. `.spot-dialog-stat`:`<b>{{ spot.count }}</b>` + `photosPlacesPhotosShotHere`。
6. `.spot-dialog-thumbs`:6 列网格,**只在 `spot.thumb` 非空时渲染那一张 `<img>`**(Vue2 `:1140-1143` 就只有一张,`v-if` 照搬),可点 → `emit('open-photo', spot.thumb)`。
7. `.spot-dialog-btn`(整行 accent 实底):12px 相册图标 + `photosPlacesSpotViewInLibrary` + 11px 右尖角图标,`@click` → `emit('open-library')`。hover 走 `background: var(--accent); filter: brightness(1.08)`(本仓既定,替代 Vue2 的 `--accent-hi`)。

**B. spots 列表段(照 Vue2 `:1152-1172`,写在 `PlaceDetailPanel` 里)**:

1. `v-if="spots.length > 0"` 的 `.detail-section`:`<h4>` = `photosPlacesSpotsInCity`({city}) + **不可点的** `<span class="more">` = `photosPlacesViewAll`(spec §7c-9:Vue2 无 `@click`,**照样渲染成静态文本,不要接功能、不要加 `cursor:pointer`**)。
2. `.spot-list` → 每行 `.spot-row`(`grid-template-columns: 36px 1fr auto`,`@click` → `emit('pick-spot', s)`):`.thumb > img`(空 thumb 不渲染 img)+ 中列(`.name` 单行省略 + `.sub` 坐标)+ `.count`。
3. `.spot-row:hover` 换 `--chip-bg`;`.spot-row .thumb` 的底色 Vue2 是写死纯黑 → 用 `--chip-bg`(登记:随主题走的中性底,同 P6a `.rail-place .thumb` 的既定处置)。

- [ ] **Step 1: 写失败测试**

`PlaceSpotDialog.test.ts` 必含:
- 结构清点:head / 关闭钮 / 名字行 / 铅笔钮 / 坐标行 / stat 行 / thumbs / 底部整行按钮 各存在。
- 坐标行走 `formatSpotCoords`:`lat=30.2741, lon=120.1551` → 文本含 `30.274° N · 120.155° E`;**`lat=-33.8688, lon=-43.1729` → 含 `33.869° S` 与 `43.173° W`**(偏离 16 的组件侧守卫);`lat=NaN` → 坐标行整行不渲染。
- 点铅笔 → 进编辑态:input 出现、初值等于当前名、**非编辑态那一行消失**。
- 编辑态:空白名(`'   '`)时保存钮 disabled;`busy` 为 true 时保存钮与恢复默认钮**都** disabled。
- 回车提交 emit `rename` 带 **trim 后**的名字;点保存同样;点取消 → 回非编辑态且**不 emit**;按 Esc → 回非编辑态且不 emit。
- **`props.spot.key` 变化时退出编辑态**(先进编辑态,再 `setProps` 换一个 spot → input 消失)。这条钉 Vue2 watch `:303` 的语义。
- **改名后 `props.spot.name` 变化,非编辑态直接显示新名**(不持副本,偏离登记 7):`setProps({ spot: { ...spot, name: '新名' } })` → 文本含新名。
- D8:点「恢复默认名」→ emit `reset-name`,零参数;按钮文案取 `photosPlacesSpotResetName`。
- 点缩略图 → emit `open-photo` 带 `spot.thumb`;`thumb` 为空串时 img 不渲染。
- 点底部整行按钮 → emit `open-library`;点关闭 → emit `close`。
- `cssCascade.ts`:hover 态下 `.spot-dialog-btn` 的 background 归属含 `:hover` 的规则。
- 缩略图 src 来自 `service.photos.thumbnailUrl`(mock 断言参数)。

`PlaceDetailPanel.test.ts` 追加:
- `spots` 为空数组 → 整段不渲染;非空 → 段头文案含城市名、`.spot-row` 条数等于 spots 长度。
- 「查看全部」渲染为**静态文本**:断言该节点是 `span`、**不是** `button`,且样式块里 `.detail-section h4 .more` **不含** `cursor: pointer`(spec §7c-9 的程序化守卫)。
- 点 `.spot-row` → emit `pick-spot` 带该 spot 对象。
- `activeSpotKey` 非空且能在 `spots` 里按 **`String()` 归一**命中时渲染 `PlaceSpotDialog`,命中不到时不渲染(深链/详情刷新后 spot 消失的场景)。
- 弹窗的五个 emit 原样透传到面板对外的 emit(逐个 emit 断言)。

- [ ] **Step 2: 跑测试确认失败**
- [ ] **Step 3: 实现**
- [ ] **Step 4: 跑测试确认通过 + 逐个删码验证**

删码清单(一次只删一处):①`spot.key` 变化退出编辑态的 watch 删掉 → 对应用例红;②`rename` 的 `.trim()` 删掉 → trim 用例红;③保存钮的 `|| busy` 删掉 → busy 用例红;④「查看全部」加上 `@click` 与 `cursor:pointer` → §7c-9 守卫红;⑤`activeSpotKey` 的 `String()` 归一去掉(数字 key fixture)→ 命中用例红;⑥空 thumb 守卫删掉 → 「img 不渲染」红。

- [ ] **Step 5: Commit** — `feat(photos): P6b-T4 spot 弹窗(重命名 + D8 恢复默认名)+ 面板 spots 列表段`

---

