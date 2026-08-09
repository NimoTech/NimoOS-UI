# SP15-P2a Task 3 报告 —— 详情页交互(加照片 / 多选移除 / pin 角标 / 已排除)

分支 `sp15-photos-moments`,工作树 `.claude/worktrees/sp15-photos-moments`。

## 提交

| SHA | 主题 |
|---|---|
| `bdd9fb0` | fix(oss): strip the smart view asset service test from the export |
| `ba3c0ec` | feat(photos): let a smart view's photos be pinned, removed and restored |
| `9feac00` | fix(oss): strip this task's new view test from the export |

> 第三个提交在功能提交之后 —— 原因见「OSS 前置修复」第 2 段:导出守卫要求工作树干净,
> 所以本任务自己新增的 `src/views/PhotosSmartViewDetail.assets.test.ts` 只有在功能提交
> 落盘之后才会被泄漏守卫看见。

## OSS 前置修复(两次,不是一次)

**第 1 次(前置,`bdd9fb0`)** —— Task 1 新增的 `packages/service/src/photos.smartviewAssets.test.ts`
从未登记进 `oss/manifest.mjs` 的 `SERVICE_DELETE`,泄漏守卫因此一直红着。

- **实测命中 15 处,不是简报里写的 24 处**(简报的数字是估算)。
- 修法照既有先例:把该路径加进 `SERVICE_DELETE`(按字母序插在 `photos.places.test.ts` 与
  `photos.uploads.test.ts` 之间),并在旁边写清这是同一处遗漏的第三次。
- **没有**碰 `oss/forbidden.mjs` 或它的词表。
- 修后 `pnpm exec vitest run oss` = **19 文件 / 449 例全绿**。

**第 2 次(功能提交之后,第三个提交)** —— 我自己新建的
`src/views/PhotosSmartViewDetail.assets.test.ts` 同样需要登记进 `VIEW`/`DELETE` 清单。
这一条**在功能提交前是查不出来的**:`oss/export.mjs` 的前置检查要求工作树干净,未提交的改动
会让 `tree.test.mjs` / `media-wave.test.mjs` 直接以「工作树不干净」报错退出,泄漏守卫根本
跑不到。提交之后再跑,守卫立刻命中该文件。修法同上:加进相册区那份逐条枚举的视图测试清单,
并把注释里的「前两个不在 `__tests__/` 下」更新成「前三个」。

> **给后续任务的教训**:相册区的视图测试清单是逐个文件枚举的,而本期这三份测试都放在
> 视图旁边(不在 `__tests__/` 下),glob 覆盖不到。**新建任何 src 侧相册文件后,必须在
> 提交之后再跑一次 `vitest run oss`** —— 提交之前那一跑只能证明「没有别人的旧泄漏」,
> 证明不了自己这一份。

## 实现了什么

`src/views/PhotosSmartViewDetail.vue`(唯一改动的页面)。

**脚本层**

- 新增 `pickerOpen` / `selecting` / `selectedIds` / `excludedOpen` 四个状态,
  `viewAssetIds` computed(`String()` 归一),`pickerSubmitLabel(count)` **函数形态**。
- `toggleSelecting` / `toggleSelect`:照 Vue2 :462-469。
- `onPickPhotos`:`store.pinAssets` → toast 报后端给的条数 → 关 picker → 并行重载
  `loadDetail` + `loadExcluded`。失败只 toast(danger),**picker 保持打开**。
- `removeSelected`:`store.removeAssets` → toast `unpinned + excluded` 之和 →
  **仅成功时**清 `selecting`/`selectedIds` → 并行重载。失败保留选择供重试。
- `restoreOne(id)`:`store.restoreAssets` → 并行重载;失败 toast(danger)。
- `onTileClick` 最前面加选择态早退(`toggleSelect` 后 `return`)。
  **刻意放在「New 角标乐观清除」之前** —— 否则在选择态下点一张最近添加的照片,会把它
  标记成已看过,而用户其实只是勾选了它。
- `onMounted` 追加 `void store.loadExcluded(svId.value)`;`watch(route.params.id)` 里
  在重载之前把 `selecting` / `selectedIds` / `pickerOpen` / `excludedOpen` 四个全部重置,
  并同时重载 `loadDetail` + `loadExcluded`。

**模板层**

- 操作栏(`sv-action-pause` 那一组)追加 `sv-add-photos` 与 `sv-select-toggle` 两个按钮。
- 两个网格(最近添加 / 全部匹配)的 `.tile` 都加了 `:data-selected`、pin 角标
  (`data-test="sv-pin-tag"`)与选中勾选角标 —— 照 Vue2 :143-158,两个网格都有,不是只有一个。
- 「全部匹配」网格之后插入「已排除」分节:标题条(点击折叠/展开)+ 展开后的网格,
  每张点一下即恢复。
- 页面末尾:选择栏(`sv-select-bar`,计数 + 移除按钮)与 `PhotosLibraryPicker`。

**样式层**(全部照 Vue2 `photos-smartview.scss` 的 #79 增量 + `photos.scss:329-333`)

`.sv-grid-photos .tile[data-selected="true"]`(+ `::before` 蒙版)、`.sv-pin-tag`、
`.sv-tile-check`、`.sv-excluded-head`、`.sv-excluded-grid .tile` 与 `.sv-restore-hint`、
`.sv-select-bar`。

## TDD 证据

**RED** —— 先建测试文件,实现零行:

```
$ pnpm exec vitest run src/views/PhotosSmartViewDetail.assets.test.ts --reporter=verbose
 Test Files  1 failed (1)
      Tests  15 failed | 1 passed (16)
```

唯一通过的那条是「已排除区没有排除项时不出现」—— 当时页面根本没有这个区块,所以它是
**平凡通过**,不构成证据。首个失败正如简报预测:`[data-test="sv-add-photos"]` 找不到。

**中途一次真正的 RED→修正**(值得记录,因为它推翻了简报的测试代码):简报给的 `seed()`
直接往 store 写 `matchedAssets` / `excluded`,但页面在 `onMounted` 里就调用
`loadDetail` / `loadExcluded`,而这两个 action **在 await 之前会先把目标清空**,再用
mock 返回的 `[]` 覆盖。结果 11 条用例在实现完成后依然红。改成**通过 service mock 喂数据**
(`getSmartViewAssets` / `getSmartViewExcluded` 的 `mockResolvedValue`),既修好了,也更诚实
—— 走的是设备上真实的那条路径。

**GREEN**:

```
$ pnpm exec vitest run src/views/PhotosSmartViewDetail.assets.test.ts --reporter=verbose
 ✓ pin badge > marks only the pinned tiles
 ✓ add photos > opens the picker, pins what it confirms, and reports the count it was told
 ✓ add photos > reports a failure and keeps the picker open so the user can retry
 ✓ add photos > hands the picker the ids already in the view, String()-normalised
 ✓ add photos > passes the submit label as a function of the selected count
 ✓ selection and removal > suppresses the lightbox while selecting, and shows the count
 ✓ selection and removal > still opens the lightbox when not selecting
 ✓ selection and removal > removes the selection, then leaves selection mode
 ✓ selection and removal > keeps the selection on failure so the user can retry
 ✓ selection and removal > leaving selection mode clears what was selected
 ✓ selection and removal > drops the selection and closes the picker when the route id changes
 ✓ excluded section > stays hidden when nothing is excluded
 ✓ excluded section > appears with a count once there are excluded assets, collapsed by default
 ✓ excluded section > expands on click and restores a photo when one is clicked
 ✓ excluded section > reports a failed restore
 ✓ excluded section > loads the excluded list on mount and again when the route id changes
 Test Files  1 passed (1)
      Tests  16 passed (16)
```

比简报的 11 条多 5 条,新增的都是简报没写但硬约束点名要求的:submitLabel 函数形态、
非选择态仍开灯箱(让「抑制灯箱」那条真的在测抑制)、切 `:id` 重置、恢复失败报错、
`loadExcluded` 挂载 + 切 id 各触发一次。

## 三次删码验证(mutation check)

每次都是「改坏 → 跑测试 → 确认指定用例变红 → 从备份原样恢复」。

| # | 破坏内容 | 结果 |
|---|---|---|
| 1 | 删掉「全部匹配」网格里的 `<div v-if="p.pinned" class="sv-pin-tag">` 整块 | `pin badge > marks only the pinned tiles` 变红,**1 failed / 15 passed**。 |
| 2 | 删掉 `onTileClick` 开头的 `if (selecting.value) { toggleSelect(...); return }` | `suppresses the lightbox while selecting` 变红,另外 3 条依赖选择的用例连带变红,**4 failed / 12 passed**。 |
| 3 | 摘掉已排除瓦片的 `@click="restoreOne(String(p.id))"` | `expands on click and restores a photo` + `reports a failed restore` 变红,**2 failed / 14 passed**。 |

三次恢复后均回到 16/16。

## i18n:复用 vs 新增

**新增 12 键**(两个 locale 都加,块头注释 `// ── SP15-P2a: manual asset actions ──`):
`photosSvAddPhotos` / `photosSvRemoveFromView` / `photosSvRemovedNFromView` /
`photosSvExcludedN` / `photosSvAlreadyInView` / `photosSvPinnedNToView` /
`photosSvRestoreFailed` / `photosSvRemoveFailed` / `photosSvAddFailed` /
`photosSvShow` / `photosSvHide` / `photosSvRestore`。中文取自简报表格(= Vue2 `zh_CN.json`),
未自行翻译。

**复用 5 键,未新建**(逐个 grep 核对过取值):

| 用途 | 键 | 取值 |
|---|---|---|
| Select 按钮 | `photosPersonSelect` | `选择` |
| Cancel 按钮 | `photosCancel` | `取消` |
| 「N 已选」 | `photosSelectedCount` | `已选择 {count} 项` —— **参数是 `count`**,调用处写的就是 `{ count: selectedIds.length }` |
| picker 标题 | `photosAlbumPickerTitle` | `添加照片到「{name}」` |
| picker 提交按钮 | `photosAlbumPickerAdd` | `添加({count})`,经 `pickerSubmitLabel(count)` 函数形态传入 |

`src/i18n/parity.test.ts` 9 例全绿。

## 与 Vue 2 的偏离(逐条登记)

1. **选中态瓦片的高亮样式:Vue 2 有,简报没提,我补了。**
   Vue2 的 `.tile[data-selected="true"]`(3px accent 描边 + 20% accent 蒙版)不在
   `photos-smartview.scss` 里,而在全局 `photos.scss:329-333` —— 详情页的瓦片挂在
   `.photos-root` 下,天然吃到这条规则。只加 `data-selected` 属性而不搬这条规则,
   `data-selected` 就是死标记,选中态只剩左上角一个小勾。蒙版的 `rgba(110,91,255,0.20)`
   改写成 `color-mix(in srgb, var(--accent) 20%, transparent)`。
   **⚠️ 顺带发现的既有缺口(留给整支评审):`src/views/PhotosMomentDetail.vue`
   (SP15-P1-T8)同样加了 `:data-selected` 却没有对应样式规则 —— 那一页的选中高亮至今是
   死标记。** 我没有去动那个文件(不在本任务范围),但两页共用同一套 `.sv-*` 类名惯例,
   建议整支评审时一并处置。
2. **picker 关闭的责任方不同。** Vue2 的 picker 自己在 `confirm` resolve 后 `$emit('close')`,
   靠父组件 handler rethrow 来「失败不关」。Vue 3 的 `emit()` 拿不到 handler 的返回值
   (Task 2 组件头 deviation a 已登记),所以关闭改由父组件在成功分支显式 `pickerOpen = false`。
   用户可见行为完全一致:成功关、失败留。
3. **切 `:id` 时重置四个交互状态。** Vue2 的详情页是 `v-if` 挂载的,切视图会整组件重建,
   不存在这个问题;New-UI 走真路由、组件不重建,必须显式重置。这是硬约束 6 点名的那一类。
4. **`removeSelected` 不再重复刷新统计。** Vue2 在调用处额外 dispatch 一次
   `refreshSmartViewStats`;Task 1 已经把这一步移进了 store 的三个写 action 内部,
   调用处再刷一次是多发一个请求。
5. **失败 toast 走 `danger` 变体 + 2500ms**,对齐本仓既有写法(`PhotosMomentDetail.vue`),
   不照抄 Vue2 的 `window.PhotosToast` + 珊瑚红字面量。
6. **pin 图标用本文件已有的轮廓图钉路径**,不引入 Vue2 那个独立的实心水滴 `pin` 图标 ——
   同 `PhotosMomentDetail.vue` deviation 8 的处置。

## 四道门

| 门 | 命令 | 结果 |
|---|---|---|
| 测试 | `pnpm exec vitest run src/views/PhotosSmartViewDetail.assets.test.ts src/views/__tests__/PhotosSmartViewDetail.test.ts src/i18n/parity.test.ts --reporter=verbose` | **3 文件 / 96 例全绿**(新 16 + 既有页面测试 **71,未减** + parity 9) |
| 类型 | `pnpm exec vue-tsc --noEmit` | 干净,退出码 0,零输出 |
| 样式守卫 | `pnpm exec vitest run src/styles` | **4 文件 / 1075 例全绿** |
| 开源导出 | `pnpm exec vitest run oss` | **20 文件 / 465 例全绿**(第三个提交之后) |

既有页面测试文件**一行未动** —— 它的 service mock 里本来就没有 `getSmartViewExcluded`,
新增的 `loadExcluded` 调用在 store 里被 catch 掉,既没吞出可见错误也没影响任何断言,
所以简报预留的那一行补丁**没有必要加**,我没有加。

## 自查结果

- **每条新用例都能被删码证伪吗?** 三条点名的已实测(见上表)。其余各条在开发过程中
  都经历过真实的 RED(16 条里 15 条在实现前是红的),不是「写完实现再补测试」。
- **颜色是否全是 token 或带注释的例外?** `git diff` 里 grep `#` / `rgb(` / `rgba(`:
  只有两处 `color: #fff`(`.sv-pin-tag` 的图标、`.sv-restore-hint` 的文字),两处都紧跟
  `/* theme-exception: … */` 说明理由(压在不可预测的照片内容之上、位于固定深色底里),
  照 `PhotosMomentDetail.vue` 自己那个 pin 角标的先例。注释里**没有**写任何 hex/`rgba()`
  字面量,只用文字描述(「half-opaque black」是词、不是色值)。
- **CSS 注释里有没有 `*` 紧贴 `/`?** 没有;`src/styles` 那 1075 例里就有专门的整块吞噬守卫,全绿。
- **已排除区:空时隐藏、非空时折叠?** 两条用例分别钉住:
  `stays hidden when nothing is excluded`(`sv-excluded-head` 不存在)与
  `appears with a count …, collapsed by default`(标题条在、`sv-excluded-grid` 不在)。
- **测试输出是否干净?** 单独跑新文件:`grep -c "Vue warn|Unhandled"` = **0**。
  stderr 只剩三行,分别来自三条**故意制造失败**的用例(页面自己的 `console.error`,
  正是被测行为)。中途还顺手给 mock 补了 `getConfig` / `getTimeline` —— 挂载本页会带起
  设置 store、打开 picker 会带起图库时间线,不补的话每条用例都会打印一个被吞掉的
  TypeError,**噪声基线正是真错误藏身之处**。
  (组合跑时刷屏的 `[Vue warn] Component "i18n-t" has already been registered` 全部来自
  既有的 `src/views/__tests__/PhotosSmartViewDetail.test.ts` —— 它自建 `createI18n`,
  是记忆里那条既有坑,先于本任务,我没有去动它。)

## 关注点 / 挂账

1. **`PhotosMomentDetail.vue` 的 `data-selected` 是死标记**(见偏离 1)—— 本任务范围外,
   建议整支评审一并收。
2. **本期在真机上验不出已排除区。** 产生一条排除记录需要移除一张**自动匹配**的照片,
   而设备上的智能视图全是语义型、暂停中、从未评估过(设计文档 §2 已记)。验收时
   「已排除」整块不出现是**预期行为**,不是缺陷;pin/移除/加照片三件是可验的。
3. **移除按钮的 `:disabled` 绑的是 `store.assetBusy`**,不是页面本地 flag。三个写 action
   在 store 里共用这一把锁,所以它同时也挡住了「移除在途时点 picker 的提交」——
   这是 Task 1 的设计,不是本任务新加的约束,但值得评审确认这个耦合是想要的。
4. 三个提交都**未推 origin、未部署**。
