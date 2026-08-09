# Task 9 报告 · 加入照片 / 移出照片(SP15-P1)

分支 `sp15-photos-moments`,两个提交:

| SHA | 主题 |
|---|---|
| `143dc0f` | refactor(photos): make the library picker album-agnostic |
| `b384c00` | feat(photos): add and remove photos from a moment |

---

## 1. 做了什么

### Step 0 — 泛化 `AlbumLibraryPicker.vue`(单独提交)

组件此前把「相册」硬编进了它工作的两半:读「哪些已经在里面」(`albums.assetsOf(props.albumId)`)
和写「把选中的加进去」(`albums.addAssetsToAlbum` + 成功/失败 toast)。两半都搬到调用方,组件只剩
「挑照片」。

- props:`{open, albumId, albumName}` → `{open, title, existingIds, existingLabel, submitLabel, submitting?}`
- emits:`{update:open, added}` → `{update:open, confirm}`
- `confirmAdd()` 由 async 写库改为同步 `emit('confirm', Array.from(selected))`,既不清空
  `selected` 也不关面板。
- 删掉 `usePhotosAlbums` / `useToast` 两个 import 与本地 `adding` state。
- **没有做重命名**(Vue2 #79 在同一个提交里把它改名成 `PhotosLibraryPicker.vue`)。文件头登记了
  「名字已经名不副实、重命名随 #79 其余部分归 P2」。

两个既有消费方(`PhotosAlbums.vue` / `PhotosAlbumDetail.vue`)各自补上原本由组件承担的四件事:
`addAssetsToAlbum` → `photosAlbumAddedToast`(相册名+张数)→ 关面板 → 原 `@added` 接的那次刷新
(列表页 `fetchAlbums`,详情页 `fetchAlbumAssets`);失败走 `photosAlbumAddFailed` 且**不关面板**。

### 时刻侧(第二个提交)

- `PhotosMomentDetail.vue`:`Add photos` 按钮(`data-test="mo-add-photos"`,`:disabled="allLoading"`,
  照 Vue2 :26-28)、选择栏里的 `Remove from this moment`(`data-test="mo-remove-selected"`)、
  `<AlbumLibraryPicker>` 挂载、`onPickPhotos` / `removeSelected` 两个处理函数、`memberIds` computed。
- i18n:8 个新键写进 `zh_cn.photos.ts` + `en_us.photos.ts`(中文全部取自 Vue2 自己的
  `899af59b:zh_CN.json`,未重译)。

---

## 2. TDD 证据

### 基线(动手之前)

```
pnpm exec vitest run src/photos/components/__tests__/AlbumLibraryPicker.test.ts  → 12 passed
pnpm exec vitest run src/views/__tests__/PhotosAlbums.test.ts                    → 17 passed
pnpm exec vitest run src/views/__tests__/PhotosAlbumDetail.test.ts               → 31 passed
pnpm exec vitest run src/views/PhotosMomentDetail.test.ts                        → 32 passed
四文件合计 92 passed
```

### RED(时刻侧测试先行,实现前)

```
pnpm exec vitest run src/views/PhotosMomentDetail.test.ts --reporter=verbose
 × the Add photos button opens the library picker with the moment's own photos marked as already in
 × the Add photos button is disabled while the all-photos list is still loading
 × adding: pins the picked ids, adopts the count from the response, reloads both grids, closes the picker and confirms with a toast
 × adding: a failed pin leaves the count untouched, says so in the danger tier and keeps the picker open to retry
 × removing: excludes the selection, adopts the count from the response, leaves selection mode and reloads the grids
 × removing: a failed exclude keeps selection mode and the selection itself, so the user can retry
 × renders Vue 2's own wording for the two new controls
 Error: Cannot call props on an empty VueWrapper. / Cannot call trigger on an empty DOMWrapper.
 Tests  7 failed | 33 passed (40)
```
(第 8 条「空选不能发请求」按其性质在 RED 阶段就是绿的——它断言的是「整条选择栏不渲染」。)

### GREEN(实现后)

```
pnpm exec vitest run src/views/PhotosMomentDetail.test.ts                       → 40 passed
pnpm exec vitest run <picker + 两个相册页 + 时刻页>                              → 106 passed
pnpm exec vitest run(全量)  → Test Files 674 passed / 4 failed;Tests 10720 passed | 70 skipped | 3 failed
```
全量里那 4 文件 / 3 例失败**全部**是 `oss/` 导出门在**工作树不干净**时的拒绝执行——脏的只有控制器
自己的 `.superpowers/sdd/.../progress.md`(按约定我不碰、不 stash)。为了真验这道门,我用
`git worktree add --detach <scratchpad> HEAD` 开了一份 HEAD 的干净检出、软链 `node_modules` 后跑:

```
oss(干净树,HEAD=b384c00) → Test Files 19 passed (19) · Tests 448 passed (448)
```
跑完已 `git worktree remove --force` 撤掉。

### 变异验证(新用例是否真的钉住行为)

| 变异 | 结果 |
|---|---|
| 删掉 `onPickPhotos` 成功分支里的 `pickerOpen.value = false` | 「adding: … closes the picker」变红 ✔ |
| 在 `removeSelected` 的 catch 里也清空 `selecting`/`selectedIds` | 「removing: a failed exclude keeps selection …」变红 ✔ |
| 删掉 `PhotosAlbums.vue` catch 里的失败 toast | 「source==='select' 挑完照片写库失败 …」变红 ✔ |
| 删掉 `PhotosAlbumDetail.vue` 成功分支的 `pickerOpen.value = false` | 「点「添加照片」→ … + 关面板 …」变红 ✔ |

四次变异跑完全部还原,`git status` 已确认只剩 progress.md 一处(控制器的)。

---

## 3. picker 与两个相册页的用例数:Step 0 前 / 后

| 文件 | 前 | 后 | 说明 |
|---|---|---|---|
| `photos/components/__tests__/AlbumLibraryPicker.test.ts` | **12** | **15** | 12 条全部保留(props 换成新签名),另加 3 条:brief 指定的「只 emit confirm 不写库」、`submitting` 飞行态、`submitLabel` 传定值字符串 |
| `views/__tests__/PhotosAlbums.test.ts` | **17** | **19** | 既有 17 条一条未动,新增 2 条(@confirm 成功链路 / 失败链路)——接住从组件里搬出来的行为 |
| `views/__tests__/PhotosAlbumDetail.test.ts` | **31** | **32** | 既有用例保留;原「@added → fetchAlbumAssets」那条改写成 @confirm 全链路(写库+toast+关面板+刷新),另新增失败链路 1 条 |
| `views/PhotosMomentDetail.test.ts` | 32 | **40** | 本任务新增 8 条 |
| 合计 | 92 | **106** | 无删除、无减弱 |

**没有删掉任何用例**。两处改写都是「同一断言换到它现在真正的宿主」:

- picker 那条「store 抛错 → 失败 toast」:组件已经不再写库、根本看不到失败,原地保留只能变成谎话。
  它拆成两半——**组件侧**(「调用方写失败、面板保持 open ⇒ 已选内容保留、按钮可用、可以再次提交」)
  留在 picker 测试里,**失败 toast** 那半在两个相册页测试里各补了一条(断言 `photosAlbumAddFailed`
  且面板仍在)。
- picker 那条「点击 → batchAddToAlbum + added + update:open + toast」同理:点击那半留下(现在断言
  `confirm` 的 payload、按钮文案仍带张数),写库/toast/关面板三半搬到相册页。

---

## 4. 两个消费方各改了什么、为什么行为不变

### `src/views/PhotosAlbums.vue`

```
新增 pickerExistingIds(computed)= new Set(albums.assetsOf(pickerAlbumId).map(p => String(p.id)))
     pickerSubmitLabel(count)     = t('photosAlbumPickerAdd', { count })
     pickerAdding(ref)            → 传给 :submitting
     onPickerConfirm(ids)         → addAssetsToAlbum → 成功 toast → 关面板 → fetchAlbums
                                    失败 → console.error + photosAlbumAddFailed(不关面板)
删除 onPickerAdded()(它那句 fetchAlbums 挪进 onPickerConfirm 的成功分支)
模板 :album-id/:album-name/@added → :title/:existing-ids/:existing-label/:submit-label/:submitting/@confirm
```

行为等价性逐条:

- **existingIds**:组件里原来就是 `albums.assetsOf(props.albumId)` 同一个表达式,只是求值点从组件挪到
  调用方,String 归一那一半仍在组件内(`isExisting`)。
- **成功 toast**:同一个 `photosAlbumAddedToast`、同样的 `{count, name}`;`count` 原来是
  `selected.size`,现在是 `ids.length`——同一批 id,恒等。
- **关面板**:原来组件 `closeNow()`,现在调用方置 `pickerOpen=false`。**只在成功分支**,失败仍不关,
  且面板不卸载 ⇒ 组件内 `selected` 原样保留,用户能直接重试(与泛化前一致)。
- **刷新**:原来 `@added → fetchAlbums`,现在成功分支里同一句 `void albums.fetchAlbums()`。相对
  `closeNow()` 的先后次序变了,但两者互不依赖,无可观察差异。
- **「添加中…」**:原来组件本地 `adding`,现在调用方 `pickerAdding` 经 `:submitting` 传回去——按钮
  依旧在请求飞行期变文案 + 禁用,连点仍只发一次(守卫同时在组件与调用方两侧)。
- **按钮文案**:仍是 `photosAlbumPickerAdd`(带已选张数),靠函数式 `submitLabel`(见偏离 b)。

### `src/views/PhotosAlbumDetail.vue`

同样五处,唯二不同:`pickerExistingIds` 取 `albumId.value`,刷新那句是 `fetchAlbumAssets(albumId)`,
toast 名字取 `album.value?.title ?? ''`(与组件此前拿的 `props.albumName` 同源)。

---

## 5. 与 Vue 2 的偏离(全部登记在代码里)

**组件侧(`AlbumLibraryPicker.vue` 文件头)**

| # | 偏离 | 理由 |
|---|---|---|
| a | `submitting` 是 **prop** 而不是组件本地 state | Vue2 能 `await this.$listeners.confirm(...)`(Vue2 的 listener 是普通函数、能拿到父组件的 promise);Vue3 的 `emit()` 丢弃返回值,组件无从得知写入何时结束 ⇒ 忙碌标志跟着写入一起搬到调用方。渲染结果一致:飞行期「添加中…」+ 禁用。 |
| b | `submitLabel` 允许 `(count) => string` | Vue2 #79 把相册按钮从 `Add ({n})` 改成定值 `Add selected`,**悄悄丢掉了张数**。New-UI 相册两条路径不能因为一次重构变文案,所以相册传函数(张数照旧),时刻传定值(与 Vue2 时刻侧完全一致)。 |
| c | 关面板的决定权交给调用方 | 同 a:组件分不出成功与失败。三个调用方一律「成功关、失败留」——这正是 Vue2 的可观察行为。 |
| d | 不改名 | Vue2 #79 同commit改名 `PhotosLibraryPicker.vue`;本期只取泛化那一半,改名随 #79 其余部分归 P2。文件头已登记「名字名不副实」。 |

**时刻页(`PhotosMomentDetail.vue` 文件头 13/14/15)**

| # | 偏离 | 理由 |
|---|---|---|
| 13 | 不移植 `asset-count-changed` 事件 | Vue2 详情组件自己存一份 `momentAssetCount` 并向列表页 emit 同步;这里两个视图读同一个 store 条目,`store.pin/exclude` 把响应里的 `asset_count` 直接写进去(moments.ts:239-257),没有第二份可同步。 |
| 14 | picker 的 `title` 复用 `photosAlbumPickerTitle`,不新建 `photosMoAddPhotosTitle` | Vue2 给两个 picker 喂的是**同一个** `'Add photos to {name}'` 字符串(:144),复用才是 1:1 复现;新建一个内容完全相同的键反而不是。**这是对 brief 的一处偏离**(brief 列了 `photosMoAddPhotosTitle` 且文案写作「加入「{name}」」,而 Vue2 自己的中文是「添加照片到 {name}」——按「中文以 Vue2 为准、不重译」的规则取 Vue2 的)。 |
| 15 | 关面板由页面做(成功关、失败留) | 同组件偏离 c。 |

**另外两处对 brief 的偏离(非 Vue2)**

- brief 键表里的 `photosMoSelectedN` **没有新增**:选择栏计数在 T8 已经用了 `photosSelectedCount`
  (与 Vue2 `'{n} selected'` 同义),再加一个同义键是死键。
- `removeSelected` 加了重入守卫 `removing`(Vue2 :361 没有,连点会对同一批 id 发两轮并发 exclude)。
  照本仓既有先例(`PhotosAlbumDetail.vue` 的 `removing`,评审 Minor 6)与「界面 1:1、逻辑照正确」的
  纪律,不照抄这个竞态;已在代码里注明。失败重试路径有用例覆盖(连点两次确实发两次)。

---

## 6. 各道门

| 门 | 结果 |
|---|---|
| `pnpm exec vue-tsc --noEmit` | 干净(无输出,exit 0) |
| `pnpm exec vitest run src/i18n/parity.test.ts` | **9 passed** |
| `pnpm exec vitest run src/styles` | **1075 passed**(与交接一致;本任务未新增任何 CSS) |
| `pnpm exec vitest run oss` | **448 passed / 19 files**(在 HEAD 的干净检出里跑;主工作树因控制器的 progress.md 脏而 3 例拒跑 + 70 例 skip) |
| 全量 `pnpm exec vitest run` | 10720 passed / 70 skipped / 3 failed(3 failed 全是上面那条脏树原因) |

未新增文件 ⇒ `oss/manifest.mjs` 无需改动(导出树扫描 448 全绿已证)。

---

## 7. 改动的文件

提交 `143dc0f`(Step 0):
- `src/photos/components/AlbumLibraryPicker.vue`
- `src/photos/components/__tests__/AlbumLibraryPicker.test.ts`
- `src/views/PhotosAlbums.vue` · `src/views/__tests__/PhotosAlbums.test.ts`
- `src/views/PhotosAlbumDetail.vue` · `src/views/__tests__/PhotosAlbumDetail.test.ts`

提交 `b384c00`(时刻侧):
- `src/views/PhotosMomentDetail.vue` · `src/views/PhotosMomentDetail.test.ts`
- `src/i18n/zh_cn.photos.ts` · `src/i18n/en_us.photos.ts`

---

## 8. 自审发现与处置

1. **「brief 的三处改动」不止三处** —— props 换签名必然带着模板里三处 `t(...)` 换成 prop,`confirm`
   外移必然带着 toast/关面板/`added` 一起走。这些都在 brief 那三处的语义范围内,没有扩大重构面
   (没动 380 行的其余部分、没改名、没碰 Esc/确认条/时间线那套逻辑),所以按继续执行处理而不是
   NEEDS_CONTEXT。真正超出 brief 字面的只有 `submitting` prop 与函数式 `submitLabel` 两点,都是
   **为了不让相册页发生任何可观察变化**才加的,已逐条登记。
2. **相册页的失败 toast 差点被弄丢**:原来只有 picker 的测试覆盖它。已在两个相册页测试里各补一条
   (并用变异验证确认它们会因为删掉 toast 而变红)。
3. **`mo-remove-selected` 失败后能不能真重试**:补了断言——失败后再点一次,`excludeMomentAssets`
   确实被调用两次(重入守卫不会把按钮永久卡死)。
4. **测试输出干净**:`PhotosMomentDetail.test.ts` 全程无任何 `[Vue warn]` / stderr。picker 与两个相册页
   测试文件里那批 `Component "i18n-t" has already been registered` 是它们各自 `createI18n` 带来的
   **既有**噪声(T7 的报告里已记载过这一模式),本任务未新增,也未去动那三个文件的 i18n 装配方式。
5. **data-test 钩子逐字核对**:`mo-add-photos` / `mo-remove-selected` / `mo-select-bar` /
   `mo-select-toggle` / `mo-all-tile` / `lib-picker-*` 全部与 brief 一致。
6. **颜色**:本任务一行 CSS 都没写(两个新按钮复用既有 `.sv-action-btn`),不存在裸色值/注释里写色值
   /CSS 注释提前闭合的风险;`src/styles` 1075 全绿。

---

## 9. 关注点 / 交接

1. **`AlbumLibraryPicker.vue` 现在名不副实**,P2 做 #79 其余部分时要连带改名(改名会牵动 3 个 import、
   1 个测试路径、oss manifest,所以刻意留在一起做)。
2. **`photosAlbumPickerTitle` / `photosAlbumPickerAlready` / `photosAlbumPickerAdd` / `photosAlbumPickerAdding`
   这几个键的名字也带着 album 味**,但其中 `photosAlbumPickerTitle`(时刻页复用)与
   `photosAlbumPickerAdding`(所有调用方共用的「添加中…」)已经是通用文案。若 P2 改名组件,建议把这两个
   键一起改名,别只改文件名。
3. **时刻页的 `Add photos` 按钮在 `allLoading` 期间禁用**(照 Vue2)。真机上如果一个时刻的全量资产很多,
   这个按钮会有一段可见的禁用期——这是 Vue2 的既有行为,不是本任务引入的。
4. 真机验收仍受「moments 表 0 行」限制(见记忆:验收第 0 步要先在控制台触发重算),本任务无法在设备上
   自证。

---

# Fix round 1(2026-08-09)

提交 `2dd1458` — *test(photos): pin down two guarantees the picker refactor left uncovered*
(三个 Important + 一个折进来的 Minor 一并处理,与前两个提交分开)。

## Finding 1(Important)—— 忙碌标志复位真的没人守

评审说得对:我报告里那句「无删除、无减弱」在这一条上不成立。泛化前 picker 有一条用例证明
**失败之后按钮会从提交态恢复**;我的替代用例在一个 `submitting` 从来没为真过的场景里断言「按钮可用」,
证不了任何东西。而这份责任现在落在三个 `finally` 里(`PhotosAlbums.vue` / `PhotosAlbumDetail.vue` /
`PhotosMomentDetail.vue`),一条测试都没盖。

改法(三处失败用例都加,采用评审建议里更强的那种——再点一次、断言真的又发了一次写入):

- `PhotosAlbums.test.ts` 失败用例:`expect(picker.props('submitting')).toBe(false)` + 再 emit 一次
  `confirm` → `batchAddToAlbum` 被调 **2** 次。
- `PhotosAlbumDetail.test.ts` 失败用例:同上。
- `PhotosMomentDetail.test.ts` 加入失败用例:`props('submitting')` 为 false + 再 emit 一次 →
  `pinMomentAssets` 被调 **2** 次。(移出失败用例本来就已经是这种强形式,连点两次断言
  `excludeMomentAssets` 两次,守的是 `removing` 那个 `finally`。)
- 组件侧那条失败用例也重写了:现在会**真的把 `submitting` 打开再关掉**(模拟调用方「飞行中 → finally
  清掉」的完整生命周期),再断言选择保留 / 按钮恢复 / 二次提交发得出去。原来的版本从头到尾没让
  `submitting` 为真,所以「按钮恢复了」这句话在点击之前就已经成立。

**变异验证(三处都做了,评审只要求一处)**

| 变异 | 结果 |
|---|---|
| 删 `PhotosAlbums.vue` 的 `finally { pickerAdding.value = false }` | 「a failed write → … the busy flag is released」变红,其余全绿 ✔ |
| 删 `PhotosMomentDetail.vue` 的 `finally { pinning.value = false }` | 「adding: a failed pin …」变红(40 例里只红这一条)✔ |
| (`PhotosAlbumDetail.vue` 与 PhotosAlbums 同构,断言逐字相同) | —— |

## Finding 2(Important)—— String() 归一被搬出了它的测试

也确认成立。泛化前 `new Set(assetsOf(id).map(p => String(p.id)))` 在组件里,组件那条跨类型用例
(数字 5 ↔ 字符串 '5')证的就是它;搬走之后组件测试的 `existingIds` 来自**测试自己的 helper**,证的
只是 fixture 会归一。两个相册页测试当时一句 `existingIds` 都没断言,时刻页那条的 fixture 又本来就是字符串。

改法:两个相册页各加一条用例,fixture 用**数字 id 的相册资产**(经真实 `getAlbum → assetToPhoto`
管线,`Photo.id` 确为 number),断言传给 picker 的 `existingIds` 里是 `'5'`:

- `PhotosAlbums.test.ts` · `the existingIds handed to the picker are String()-normalised …`
- `PhotosAlbumDetail.test.ts` · 同名用例

组件侧对应的注释也改了,写明「归一现在只剩消费那一半在这里,生产那一半由各调用方自测」。

**变异验证**:把 `PhotosAlbumDetail.vue` 的 `.map(p => String(p.id))` 改成 `.map(p => p.id)` →
该用例变红(`expected [ 5 ] to deeply equal [ '5' ]`),其余 52 例全绿;还原后 53 全绿。

## Finding 3(Important)—— 英文注释规则只在时刻那一半执行了

属实,已全部翻成英文(**意译不直译**,行号/出处原样保留):

- `src/photos/components/AlbumLibraryPicker.vue` —— 头部以下我新写的三处注释
- `src/photos/components/__tests__/AlbumLibraryPicker.test.ts` —— 5 条 `it` 标题 + 内联注释
- `src/views/__tests__/PhotosAlbums.test.ts` —— 2 条 `it` 标题 + 注释
- `src/views/__tests__/PhotosAlbumDetail.test.ts` —— 改写/新增的 `it` 标题 + 注释(含「两次拉取」那段)
- `src/views/PhotosAlbums.vue` · `src/views/PhotosAlbumDetail.vue` —— 整块 Step 0 说明

处理原则两条:(1)**被我改动过的既有中文注释一律还原成原文**,我的补充另起一行用英文写(例如组件里
「选中集合直接存原始 id」那段、测试文件头那段——都恢复原句 + `[T9]` 英文补注),这样「既有中文别动」
与「新写的用英文」两条规则不打架;(2)**中文作为数据的一律不动**:i18n 值、`zh.photosAlbumAddFailed`
这类断言、以及作为 prop 传进去被断言的 `'添加所选'`。

自查手法:`git diff <本任务起点> -- src/ | grep '^+' | grep -P '[\x{4e00}-\x{9fff}]'`,逐条确认剩下的
命中项全部是上述「数据」类。

## Finding 4(Minor,折入)—— 成功 toast 的断言在搬家途中变松了

也属实:`showSpy.mock.calls.map(...).some(m => m.includes(...))` 这种写法,弹两条、或者失败路径上顺手
多弹一条成功 toast,都抓不到。四条相关用例改成**先钉数量再钉内容**:

- 两个相册页的成功用例:`toHaveBeenCalledTimes(1)` + 完整串
  `zh.photosAlbumAddedToast.replace('{count}','2').replace('{name}','Trip'/'Picked')`;
  spy 改成在「新建相册」那一步**之后**才装,免得把「相册已创建」那条也算进来。
- 两个相册页的失败用例、时刻页的加入/移出成功与失败用例:同样 `toHaveBeenCalledTimes(1)`,失败路径
  额外确认只有 danger 那一条(成功 toast 漏到失败路径会被数量抓住)。

## 各道门(fix round 1 后的实测)

| 门 | 结果 | 与 round 0 相比 |
|---|---|---|
| `AlbumLibraryPicker.test.ts` | **15 passed** | 15 → 15(基线 12) |
| `views/__tests__/PhotosAlbums.test.ts` | **20 passed** | 19 → 20(基线 17) |
| `views/__tests__/PhotosAlbumDetail.test.ts` | **33 passed** | 32 → 33(基线 31) |
| `views/PhotosMomentDetail.test.ts` | **40 passed** | 40 → 40(基线 32) |
| 四文件合计 | **108 passed** | 106 → 108(基线 92) |
| `src/i18n/parity.test.ts` | **9 passed** | 不变 |
| `src/styles` | **1075 passed** | 不变(仍未新增任何 CSS) |
| `oss` | **448 passed / 19 files** | 不变 |
| `pnpm exec vue-tsc --noEmit` | 干净(exit 0) | 不变 |

`oss` 依旧是在 `git worktree add --detach <scratchpad> HEAD` 的干净检出里跑的(软链 node_modules,跑完
撤掉):主工作树始终因控制器自己的 `.superpowers/sdd/.../progress.md` 处于 dirty 状态,导出脚本会拒跑并
连带 skip 70 例——按约定我不碰、不 stash 它。另外 `.superpowers/sdd/.gitignore`(单行 `*`)在本轮开始时
又出现了一次,已按约定删除且未重建。

## 本轮仍存的判断

- 组件那条失败用例现在把「调用方会复位 submitting」当作**前提**来演(setProps 手动拨回 false),真正
  证明这个前提成立的是三个调用方各自的用例——这是刻意的分工:组件测组件的、页面测页面的。
- 「空选不能发移出请求」那条依旧是「整条选择栏不渲染」的存在性断言,变异不敏感(实现里的
  `if (!ids.length) return` 从 UI 走不到)。留着当回归护栏,没有把它包装成更强的样子。
