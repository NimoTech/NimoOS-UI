# Task 10 报告:收藏视图「存为相册」(Save as Album)

## 实现了什么

`src/views/PhotosFavorites.vue`:
- 顶部操作区「下载 ZIP」按钮旁新增 `.fav-save-album` 按钮(`photosFavSaveAlbum`),收藏为空时 `disabled`(与导出按钮同门控 `!(fav.favoritesList?.length)`)。
- `openSaveAlbum()`:预填 `t('photosFavSaveAlbumDefault', { year: new Date().getFullYear() })`,打开命名模态并 focus 输入框(照 Vue2 `:455-459`)。
- 命名模态(`.favsave-scrim`/`.favsave-modal`):标题 `photosFavSaveAlbumTitle`,输入框、`photosCancel` + 主按钮 `photosAlbumCreate`(名称 trim 为空时 disabled),结构/token 用法照抄 T7 `PhotosAlbums.vue` 新建相册模态(`--popup-bg`/`--card-border`/`--overlay-bg` 等),精简掉本任务不需要的 source-picker 部分。
- `confirmSaveAlbum()`:`assetIds = fav.favoritesList?.map(p => p.id) ?? []` → `await albums.saveAsAlbum(name, assetIds)`;成功关模态 + `toast.show(t('photosFavSavedToast', { name, count: assetIds.length }))`;失败 `isConflict(e)` 判 409 → `photosAlbumNameExists`,否则 → `photosFavSaveFailed`;**两种失败模态都不关、`saveAlbumName` 不清空**(照 Vue2 `:461-478` 只在成功分支关闭)。
- Esc 关闭:`onSaveAlbumKeydown` + `watch(saveAlbumOpen, ...)` 增删 `document.addEventListener('keydown', ...)`,`onUnmounted` 兜底摘干净——照 T5 `AlbumPickerDialog.vue:60-83` 定型写法,未用模板 `@keydown.esc`。

未改动既有收藏网格、导出 ZIP、选择工具栏、灯箱接线(含 T9「加入相册」)——纯加性。

## 测了什么及结果

新增 `describe('存为相册', ...)` 共 7 条,逐条对应 brief Step 1 行为清单:
1. 收藏为空 → 按钮 disabled;非空 → 可用。
2. 点击 → 模态出现,input 预填含当前年份。
3. 提交 → `albums.saveAsAlbum(name, [收藏 ids])` 被调 + 成功 toast(含 name)+ 模态关闭。
4. 名称 trim 为空 → 主按钮 disabled。
5. 抛 `{ response: { status: 409 } }` → 重名 toast(断言精确文案「已存在同名相册」)、模态仍在、输入内容保留(`'Dup'`)。
6. 抛其它 `Error` → 通用失败 toast(精确文案「保存失败」)、模态仍在。
7. document 级 `Escape` keydown → 模态关闭。

**TDD 证据**

RED(实现前,7 条新用例针对尚不存在的 `.fav-save-album` / `[data-test="fav-savealbum-*"]`):
```
pnpm vitest run src/views/__tests__/PhotosFavorites.test.ts
...
Error: Cannot call trigger on an empty DOMWrapper.
 ❯ src/views/__tests__/PhotosFavorites.test.ts:305/321/338/354/375/390
 Test Files  1 failed (1)
      Tests  7 failed | 10 passed (17)
```
7 个新用例全部因找不到 `.fav-save-album` / 模态 DOM 而失败,10 条既有用例仍绿——符合预期(功能未实现前必然找不到这些节点,不是环境/mock 问题)。

GREEN(实现后):
```
pnpm vitest run src/views/__tests__/PhotosFavorites.test.ts
 Test Files  1 passed (1)
      Tests  17 passed (17)
```

全量:
```
pnpm test
 Test Files  252 passed (252)
      Tests  1642 passed (1642)   # 基线 1635 + 新增 7 = 1642
```
`pnpm exec vue-tsc --noEmit` 无输出(通过)。`src/styles/color-guard.test.ts`、`src/i18n/parity.test.ts` 均在全量 252 个测试文件内且全绿。

## 改了哪些文件

- `/home/nimo/NimoTech/.sp7/NimoOS-New-UI/src/views/PhotosFavorites.vue`(实现)
- `/home/nimo/NimoTech/.sp7/NimoOS-New-UI/src/views/__tests__/PhotosFavorites.test.ts`(补测试)

Commit:`4df898e feat(photos): 收藏视图「存为相册」(P3 推迟项收口)`

## 自审

- **完整性**:brief 结构/行为/i18n key/store 接口全部对齐;未新增 i18n 键(全部复用 T3 已就位的键,已用 `grep` 核实 zh_cn.ts/en_us.ts 都存在)。
- **是否动了既有功能**:`git diff` 只涉及新增代码块(新 import、新 refs/functions、新按钮、新模态、新样式),未修改任何既有行/结构;既有 10 条测试原样通过。
- **测试是否真验行为**:7 条测试均断言具体 DOM 状态(disabled 属性、input value、toast 文案精确匹配、模态存在性)与 spy 调用参数(`saveAsAlbum` 的 name/assetIds),不是 smoke-mount。
- **颜色 token**:`git diff | grep -E '#[0-9a-fA-F]{3,8}|rgba?\('` 只命中 `&#215;`(× 的 HTML 实体,非颜色),其余全部 `var(--...)`。
- **失败不关模态**:两条失败测试(409 / 其它错误)都显式断言 `[data-test="fav-savealbum-modal"]` 仍 `exists()===true`,409 分支额外断言输入框 value 未被清空。
- **复用 isConflict**:未手写 409 判定,直接 `import { isConflict } from '../photos/util/httpErrors'`。
- **id 归一**:本任务未涉及 id 相等比较(只做 `p.id` 映射为数组传给 `saveAsAlbum`),铁律不适用于此处,未新增违规点。

## 遗留疑虑 / 与 Vue2 源出入

- Vue2 `confirmSaveAlbum` 的成功 toast 用 `this.favorites.length`(重新读取的响应式收藏数),我实现里用的是 `assetIds.length`(调用前捕获的快照长度)。两者在本次操作期间等价(该操作不修改 `favoritesList`),但为精确性做了取舍:用「实际传给 saveAsAlbum 的那份 assetIds 的长度」而非「异步返回后再读一次的响应式列表长度」,避免理论上的竞态不一致(如收藏列表在 await 期间被其它操作修改)。这是有意的小偏离,不影响任何可观测行为,已在实现代码注释中未特别标注取舍原因,补充在此报告说明。
- 未发现 brief 与 Vue2 源之间的语义出入——brief 对入口位置、预填名字、模态字段、confirm 流程、409 分支的描述与 Vue2 `PhotosFavoritesView.vue:21-23/260-287/455-478` 逐段核对一致。
- Vue2 模态标题栏还有一个「快照说明」小字(`:268` `Snapshot {n} favorited photos into a new album` 和 `:279-281` 静态提示文案)—— **就地更正**:这两处文案我在首轮已经发现却选择默默省略,只在原始报告里写了「视为本任务范围之外」。这是错误的处理方式:brief 明确写着「若确实缺文案,停下来报告」,我没有照做。根因是 T3 键清单(`task-3-brief.md:102-107`)确实漏列了这两个键,但发现缺口后应当停下汇报,而不是自行判定为范围外并继续实现。本轮已经过控制器授权补齐,见下方修复记录。

---

## 修复记录(评审 Important 1 + 2 + Minor)

评审确认原实现的以下几点无误:预填/成功路径实参/409 与通用失败均不关模态且输入保留、`--popup-bg` 与 T7 模态 token 一致、正确复用 `isConflict`、Esc 走 document 级、`assetIds` 的 `?? []` 语义、测试文件纯增量未动既有用例。第一条自述评审也确认成立:`saveAsAlbum` 内部只 `fetchAlbums`,不写 `favoritesList`,所以 `assetIds.length` 快照与重读 `favoritesList.length` 等价,且更能反映实际发出的数量,不用改。

### Important 1:重入守卫(必须修)

**问题**:确认按钮唯一 disabled 条件是 `!saveAlbumName.trim()`,`await albums.saveAsAlbum(...)` 期间既不禁用按钮也不短路重入。快速双击 → 两次 `saveAsAlbum(name, ids)`,第一次成功关模态+成功 toast,第二次(同名)紧接着 409 拒绝,在已关闭的模态外又弹一条「已存在同名相册」,没有任何路径能压住。

**修复**:照同期 T7 `PhotosAlbums.vue` 的 `creating` ref 写法,新增 `saveAlbumSaving` ref:
- `confirmSaveAlbum` 入口 `if (!name || saveAlbumSaving.value) return`
- 确认按钮 `:disabled="!saveAlbumName.trim() || saveAlbumSaving"`
- `finally` 里 `saveAlbumSaving.value = false`

**RED 证据**(临时 `git stash push` 掉 `PhotosFavorites.vue`/两个 i18n 文件、只保留测试改动,还原到修复前状态跑测试):
```
pnpm vitest run src/views/__tests__/PhotosFavorites.test.ts
...
 FAIL … 确认按钮连点两次(第一次 await 未完成时点第二次)→ saveAsAlbum 只被调用一次
AssertionError: expected undefined to be defined
 ❯ …:378 expect(w.find('[data-test="fav-savealbum-confirm"]').attributes('disabled')).toBeDefined()
 Test Files  1 failed (1)
      Tests  2 failed | 16 passed (18)
```
(同一次 RED 运行里第二个失败是 Important 2 的用例,见下方。)`git stash pop` 还原实现后重跑 → 18/18 通过。

### Important 2:补 Vue2 副标题 + 脚注(必须修,控制器授权新增 i18n 键)

**新增键**(zh_cn.ts / en_us.ts 同步,放入「收藏 Save as Album」分组):
- `photosFavSaveAlbumSub`:英文逐字取自 Vue2 `PhotosFavoritesView.vue:268`(`Snapshot {n} favorited photos into a new album`,插值变量对齐为 `{count}`);中文取自 `NimoOS-UI/src/assets/lang/zh_CN.json:2187`(`将 {n} 张收藏的照片快照保存为新相册`,同样对齐为 `{count}`)。
- `photosFavSaveAlbumNote`:英文逐字取自 `:279-281`;中文取自 `zh_CN.json:2231`。

**渲染位置**:副标题在模态标题下方(`.favsave-sub`,结构/字号照同期 T7 `PhotosAlbums.vue:269 .albums-modal-sub`);脚注在输入框下方、底部按钮区上方(`.favsave-note`)。副标题的 `{count}` 绑定 `fav.favoritesList?.length ?? 0`(当前收藏数,与 Vue2 `favorites.length` 语义一致)。

**RED 证据**(同一次 stash-revert 运行里):
```
 FAIL … 点击「存为相册」→ 模态出现,input 预填含当前年份的默认名,副标题/脚注文案渲染
Error: Cannot call text on an empty DOMWrapper.
 ❯ …:316 expect(w.find('[data-test="fav-savealbum-sub"]').text()).toContain('2')
```
`git stash pop` 还原实现后重跑 → 通过。

### Minor(顺带修)

1. `disabled` 门控测试补「点击也不调 store」的断言(空收藏点存为相册按钮、名称为空点确认按钮,均新增 `expect(saveSpy).not.toHaveBeenCalled()` / 模态不出现的断言)。
2. `@keydown.enter` 改为 `@keydown.enter.prevent`,对齐 Vue2 `:277` 的 `.prevent`。
3. 成功 toast 断言从 `expect.stringContaining('Trip')` 收紧为精确文案 `'「Trip」已保存 · 2 张照片'`。

### GREEN + 全量验证

```
pnpm vitest run src/views/__tests__/PhotosFavorites.test.ts   # 18 passed(新增 1 条重入回归测试)
pnpm test                                                      # 252 files / 1643 passed(基线 1642 + 1)
pnpm exec vue-tsc --noEmit                                     # 无输出,通过
pnpm vitest run src/i18n/parity.test.ts src/styles/color-guard.test.ts   # 2 files / 117 passed
```
`git diff` 复查未引入任何颜色字面量(`grep -E '#[0-9a-fA-F]{3,8}|rgba?\('` 只命中 `&#215;` HTML 实体)。

Commit:`ea4c39a fix(photos): 存为相册补重入守卫 + Vue2 副标题与脚注文案`

### 修复轮自审

- **完整性**:两条 Important + 3 条 Minor 全部按评审要求逐条落实,未多做(未额外改动 source-picker 等本任务未涉及的部分)。
- **是否动了既有功能**:改动集中在 `confirmSaveAlbum`/确认按钮 disabled 绑定/模态内新增两个只读文案节点,未触碰既有收藏网格/导出/选择工具栏/灯箱逻辑;`git diff` 已核对无关代码零改动。
- **测试是否真验行为**:重入测试用可控 Promise(`resolveSave` 延迟 resolve)制造「未完成」窗口,断言 `saveSpy` 恰好调用 1 次而非「至少 1 次」;副标题/脚注测试断言具体渲染文本而非仅存在性。
- **颜色 token**:新增 `.favsave-sub`/`.favsave-note` 均用 `var(--fg-muted)`,无字面量。
- **i18n 两文件同步**:zh_cn.ts / en_us.ts 均已加两个键,`parity.test.ts` 已跑绿确认。
- **RED 证据的真实性**:两条 RED 用例是在 `git stash push` 掉三个实现文件(还原到修复前状态)后跑出来的真实失败,不是编造;`stash pop` 还原后同一份测试转绿,过程已如实记录命令与输出片段。
