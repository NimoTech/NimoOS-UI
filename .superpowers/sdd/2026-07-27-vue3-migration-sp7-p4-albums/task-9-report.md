# Task 9 报告:灯箱「加入相册」按钮 + 选择工具栏批量加相册 + 三处宿主接线

## 实现内容

### 1. `src/photos/lightbox/PhotoLightbox.vue`
- 新增 emit `(e: 'add-to-album', id: string | number): void`。
- 顶栏在 `.lb-fav`(收藏)与 `.lb-download`(下载)之间插入按钮 `.lb-icon-btn.lb-add-album`,
  `title`/`aria-label` = `t('photosAddToAlbum')`。
- 新增 `onAddToAlbum()`:取 `lb.current.value`,`emit('add-to-album', cur.id)`,**不调用
  `lb.close()`**,即灯箱保持打开——照 Vue2 `PhotosLightbox.vue:13-14`(仅 emit,无关闭逻辑)。
- 既有 `delete`/`toggle-fav` emit 签名与行为一律未动。
- 头部 delta 注释第 1 条由「删「加入相册」「交给 Nimo」两钮」改为「加入相册已于
  P4(Task 9)加回,Ask Nimo 仍归 SP8」。

### 2. `src/photos/components/PhotosSelectionToolbar.vue`
- 新增 emit `(e: 'add-to-album'): void`。
- 在「取消」(`.sel-clear`)与「删除」(`.sel-delete.danger`)之间插入
  `.sel-btn.sel-add-album`(非 danger),文案 `t('photosAddToAlbum')`。
- 既有 `clear`/`delete` emit 未动;回归测试验证点击新按钮不触发 `clear`/`delete`,反之亦然。

### 3. `src/photos/components/PhotosGrid.vue`
- 更新头部 delta 注释第 3 条:「favorite/add-to-album/ask-nimo return in P3/P4/SP8」
  改为注明 add-to-album 已在 P4(Task 9,`PhotosSelectionToolbar.vue`)落地,Ask Nimo
  仍归 SP8。

### 4. 三处宿主接线
统一模式:`pickerOpen`/`pickerIds` ref + `openAlbumPicker(ids)` + 挂
`<AlbumPickerDialog v-model:open="pickerOpen" :asset-ids="pickerIds" @added="onAlbumAdded" />`。

- **`src/views/Photos.vue`**(时间线):
  - `<PhotosSelectionToolbar @add-to-album="openAlbumPicker([...selected])">`
  - `<PhotoLightbox @add-to-album="(id) => openAlbumPicker([id])">`
  - `onAlbumAdded` → `selected.value = []`(照 Vue2 `pickAlbum:587-595` 结尾清空选择)。

- **`src/views/PhotosFavorites.vue`**:同样两处接线;`onAlbumAdded` → 清空 selection,
  收藏列表本身不受影响、不刷新。

- **`src/views/PhotosAlbumDetail.vue`**:**只接灯箱一处**。命名上出现偏离——本文件
  T8 已有一个 `pickerOpen` ref 用于 `AlbumLibraryPicker`(「添加照片」到本相册),
  brief 建议的统一命名 `pickerOpen`/`pickerIds` 会与其冲突,因此本任务改用
  `albumPickerOpen`/`albumPickerIds` + 空函数 `onAlbumPickerAdded(){}`(注释说明:
  加到的是别的相册,不刷新本相册的 `fetchAlbumAssets`)。这是命名层面的必要变通,
  行为完全遵照 brief。

## z-index 层级核对

- `PhotoLightbox.vue` `.lightbox`(灯箱根容器,`position: fixed`):`z-index: 200`。
  灯箱内部的删除确认模态 `.lb-confirm-scrim` 是 `.lightbox` 的子元素(该容器因
  `position+z-index` 自身已建立一个新的层叠上下文),其 `z-index: 5` 是**该子上下文内的
  局部值**,不与全局其他 `z-index` 比较。
- `AlbumPickerDialog.vue` `.alb-picker-overlay`(T5,`position: fixed`):`z-index: 230`。
- 三处宿主(`Photos.vue`/`PhotosFavorites.vue`/`PhotosAlbumDetail.vue`)里
  `<PhotoLightbox>` 与 `<AlbumPickerDialog>` 都是模板末尾的**同级顶层元素**,均为
  `position: fixed`,挂载它们的 `<AreaShell>`/`main` 容器未见 `transform`/`opacity`/
  `filter`/`will-change` 等会建立新层叠上下文的属性(用 grep 核对过
  `AreaShell.vue`/`.photos-main` 样式,未见此类声明)——因此两者与文档根处于同一层叠
  上下文,`230 > 200` 直接生效,`AlbumPickerDialog` 天然叠在灯箱之上。**结论:z-index
  数值本身已满足要求,本任务未对任何 z-index 做改动**(T5 建 `AlbumPickerDialog` 时
  选的 230 已预留了这个余量,不是巧合,但我没有找到 T5 brief 里明确写这个理由的记录,
  只能确认结果正确)。
  - 补充参考:`AlbumLibraryPicker.vue`(T6,「添加照片」到本相册)同样是 `z-index: 230`;
    `PhotosAlbumDetail.vue` 自己的删除相册确认模态 `.album-confirm-scrim` 是
    `z-index: 220`,均不小于灯箱的 200。
  - **这条 jsdom 测不了**,已按 brief 要求记入真机验收清单(见下方遗留疑虑)。

## TDD 证据

### RED
```
pnpm test -- --run src/photos/lightbox/__tests__/PhotoLightbox.test.ts \
  src/photos/components/__tests__/PhotosSelectionToolbar.test.ts \
  src/views/__tests__/Photos.integration.test.ts \
  src/views/__tests__/Photos.lightbox.test.ts \
  src/views/__tests__/PhotosFavorites.test.ts \
  src/views/__tests__/PhotosAlbumDetail.test.ts
```
结果:9 个新增/修改断言全部失败,失败原因均正确(缺按钮/emit,而非误写断言):
```
FAIL PhotosSelectionToolbar > exactly three .sel-btn buttons
  expected [...] to have a length of 3 but got 2
FAIL PhotoLightbox 加入相册 > 顶栏在收藏按钮与下载按钮之间渲染「加入相册」按钮
  AssertionError: expected -1 to be greater than 1   (addIdx 找不到,-1)
FAIL PhotoLightbox 加入相册 > 点「加入相册」emit add-to-album...
  Error: Cannot call trigger on an empty DOMWrapper.  (.lb-add-album 不存在)
FAIL Photos.vue integration > 选择工具栏「加入相册」...
  AssertionError: expected false to be true           (.sel-add-album 不存在)
FAIL Photos.vue 灯箱接线 > 灯箱「加入相册」...
  Error: Cannot call trigger on an empty DOMWrapper.  (.lb-add-album 不存在)
FAIL PhotosFavorites.vue > 选择工具栏「加入相册」...
  AssertionError: expected false to be true
FAIL PhotosFavorites.vue > 灯箱「加入相册」...
  Error: Cannot call trigger on an empty DOMWrapper.
FAIL PhotosAlbumDetail.vue > 灯箱「加入相册」...
  Error: Cannot call trigger on an empty DOMWrapper.
```
Test Files 6 failed / Tests 9 failed, 72 passed。

### GREEN
```
pnpm test -- --run <同上 6 个文件>
```
→ `Test Files 6 passed (6)` / `Tests 81 passed (81)`。

全量:
```
pnpm test -- --run
```
→ `Test Files 252 passed (252)` / `Tests 1635 passed (1635)`(基线 1627 + 8 新增,
含 `src/i18n/parity.test.ts`)。日志里出现的 `Error: Not implemented: navigation` 是
`favorites.test.ts`/`PhotosFavorites.test.ts` 里 `exportZip` 触发 jsdom 对
`location.href =` 赋值的既有已知噪音(P3 遗留,非本任务引入,不影响用例通过)。

类型检查:
```
pnpm exec vue-tsc --noEmit
```
→ 无输出,干净通过。

color-guard(本仓无独立自动化脚本,人工核对):`git diff` 全量改动里 grep
`#[0-9a-fA-F]{3,6}|rgba?\(` 未命中任何非 `theme-exception` 注释保护下的字面量颜色——
本任务未新增任何硬编码颜色。

## 改了哪些文件
- `src/photos/lightbox/PhotoLightbox.vue`
- `src/photos/lightbox/__tests__/PhotoLightbox.test.ts`
- `src/photos/components/PhotosSelectionToolbar.vue`
- `src/photos/components/__tests__/PhotosSelectionToolbar.test.ts`
- `src/photos/components/PhotosGrid.vue`(仅注释)
- `src/views/Photos.vue`
- `src/views/PhotosFavorites.vue`
- `src/views/PhotosAlbumDetail.vue`
- `src/views/__tests__/Photos.integration.test.ts`
- `src/views/__tests__/Photos.lightbox.test.ts`
- `src/views/__tests__/PhotosFavorites.test.ts`
- `src/views/__tests__/PhotosAlbumDetail.test.ts`

提交:`d776c7b feat(photos): 灯箱与选择工具栏「加入相册」入口 + 三处宿主接线`

## 自审

- **是否动了既有契约**:未动。`PhotoLightbox` 的 `delete`/`toggle-fav` emit 签名、
  触发条件、`doDelete` 的 close 行为均未改一行;`PhotosSelectionToolbar` 的
  `clear`/`delete` emit 同样未改。新增的 `add-to-album` 是纯追加,对宿主可选监听
  (三处宿主本期都接了,但组件本身不强制,已用回归测试验证)。
- **完整性**:brief Step 1 的 6 条行为清单(灯箱按钮存在+emit+不关闭;工具栏三钮+
  emit+既有回归;Photos.vue 两条;PhotosFavorites.vue 两条;PhotosAlbumDetail.vue
  一条)全部落成对应测试且通过,逐条核对过一遍,没有漏项。
- **测试是否真验行为**:全部是行为断言(DOM 结构/顺序、emit 载荷、真实 service 调用
  参数如 `batchAddToAlbum` 的具体 `(albumId, ids)`、selection 清空后 DOM 消失),
  没有 smoke-mount-only 的测试。
- **z-index**:已如上核对,数值本身满足(230 > 200),未做改动;这条明确记入了
  「jsdom 测不了,进真机验收清单」。
- **两处过时注释**:`PhotoLightbox.vue` 头部 delta 第 1 条、`PhotosGrid.vue` 头部 delta
  第 3 条均已更新(见上方「实现内容」1/3 节)。
- **与 Vue2 源比对时发现的 brief 出入**:
  1. Vue2 灯箱按钮顺序核对无误——`PhotosLightbox.vue:10-18` 依次是 收藏(fav)→
     加入相册(album)→ 下载(download)→ 删除(trash),brief 描述「收藏与下载之间」
     准确,与源码逐字核对过,不是我凭空断言。
  2. brief 给的三处宿主「统一命名」`pickerOpen`/`pickerIds` 在 `PhotosAlbumDetail.vue`
     里与 T8 既有的同名 `pickerOpen`(`AlbumLibraryPicker` 用)冲突——brief 正文其实
     也提到"T8 已挂灯箱,这里补该 emit"但没有点出这个命名冲突。已改用
     `albumPickerOpen`/`albumPickerIds` 规避,行为完全遵照 brief,仅命名层面变通,
     已在代码注释里写明原因。
  3. 其余没有发现 brief 与 Vue2 源不一致之处。

## 遗留疑虑

- z-index 层级只能静态核对(fixed 定位 + 无中间层叠上下文 → 数值直接比较),jsdom
  无法渲染真实层叠效果,**需要真机验收**:打开灯箱 → 点「加入相册」→ 确认选择器面板
  完整可见、可点击穿透到灯箱之下,而不是被灯箱盖住或反过来点不到灯箱按钮。
- 本任务新增的「加入相册」图标是自绘 SVG(相册占位符风格:方框 + 加号),不是 Vue2
  `photos-icon name="album"` 的复刻(Vue2 用的是内部 icon 字体/svg 库,New-UI 走内联
  svg 路线,同灯箱其余按钮一致的写法)——图形观感上是否与产品预期一致,建议真机过一眼。
