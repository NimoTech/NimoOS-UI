# Task 5 报告:AlbumPickerDialog.vue —— 「加入相册」选择器

## 实现了什么

新增 `src/photos/components/AlbumPickerDialog.vue`:

- **Props/Emits** 严格按 brief 契约:`{ open: boolean; assetIds: Array<string|number> }`
  / `update:open` + `added(albumId, count)`。
- **结构**照 Vue2 `PhotosTimeline.vue:1040-1065`:遮罩(`@click.self` 关闭)+ 面板;标题
  `photosAddToAlbumTitle`;逐项 = 封面(`service.photos.thumbnailUrl(cover,'small')`,无封面
  用 `--grad-a/--grad-b` 渐变占位)+ 标题 + `photosItemsCount`;列表末尾「+ 新建相册」
  (`photosAddToAlbumNew`)。
- **新建走面板内联输入行**(非 `window.prompt`)——点击「+ 新建相册」原位展开
  `<input>`,回车提交、Esc 收起(`@keydown.esc.stop`),自动 focus。
- **行为**:
  - `watch(() => props.open, ..., { immediate: true })`——变 true(含挂载时即为 true 的情形)
    调 `void albums.fetchAlbums()`,不 await。关闭时重置 `creating`/`newName`。
  - `pick(albumId)`:`assetIds` 为空直接短路返回(与 disabled 属性双保险);成功
    → emit `added` + toast `photosAlbumAddedToast{count,name}` + 关闭;失败
    → toast `photosAlbumAddFailed`,**不关闭**。
  - `submitCreate()`:`createAlbum(name)` 成功后走 `pick(created.id)`;失败
    → 409(`e.response.status===409`,对未知形状安全判断)显示 `photosAlbumNameExists`,
    否则 `photosAlbumCreateFailed`;**面板不关,输入内容保留**(`newName` 不清空)。
  - Esc 分层:输入行的 `@keydown.esc.stop` 先消费按键(收起输入,不冒泡);面板的
    `@keydown.esc` 只在未被拦截时触发(关闭整个面板)。
  - id 比较统一 `String()` 归一(`sameId` 辅助函数),无对象引用 `===`。
- **样式**全 token:遮罩 `--overlay-bg`+`--overlay-blur`,面板 `--popup-bg`(未用
  `--card-bg`),边框 `--card-border`/`--divider`/`--chip-border`,悬停 `--chip-bg-hi`,
  封面占位渐变 `--grad-a/--grad-b`。无 `#hex`/`rgb()`/`rgba()`。

## 测了什么及结果

`src/photos/components/__tests__/AlbumPickerDialog.test.ts`,12 条行为测试(挂真实
Pinia + i18n 真实 zh_cn 词条,mock `@nimotech/nimoos-service`,经由真实
`usePhotosAlbums()`/`useToast()` store 端到端验证——断言的是底层
`service.photos.batchAddToAlbum`/`createAlbum` 真的被调,不是 mock 掉 store 本身):

1. open false→true → `listAlbums` 被调;渲染相册项(标题+计数)与「+ 新建相册」行
2. 点相册项 → `batchAddToAlbum(id, assetIds)` 被调 → emit `added` + `update:open(false)` + toast
3. store 抛错 → 面板仍 open,toast 为失败文案
4. 点「+ 新建相册」→ 出现输入框;输入名+回车 → `createAlbum` 先于 `batchAddToAlbum`(用
   `mock.invocationCallOrder` 断言调用顺序)
5. `createAlbum` 抛 409 → 显示重名提示,`batchAddToAlbum` 未被调,输入内容仍在
6. `createAlbum` 抛非 409 错误 → 显示创建失败提示(brief Step1 未列但行为规则明确要求,补测)
7. 相册列表为空 → 渲染 `photosAddToAlbumEmpty`,「新建」行仍在
8. `assetIds` 为空 → 相册项 disabled,点击不触发 store
9. Esc 分层:输入展开时先收起输入,再次 Esc 才关闭面板
10. 封面缺失 → 不调用 `thumbnailUrl`,渲染渐变占位(补测,验证"绝不手拼 URL"约束)
11. 有封面 → 通过 `thumbnailUrl` 生成 URL,`<img src>` 与生成器一致(补测)
12. 点击遮罩(非面板本体)→ 关闭整个面板(补测)

## TDD 证据

**RED**(组件文件不存在前先写测试并运行):
```
pnpm exec vitest run src/photos/components/__tests__/AlbumPickerDialog.test.ts
```
输出:
```
FAIL  src/photos/components/__tests__/AlbumPickerDialog.test.ts [ ... ]
Error: Failed to resolve import "../AlbumPickerDialog.vue" from
"src/photos/components/__tests__/AlbumPickerDialog.test.ts". Does the file exist?
Test Files  1 failed (1)
     Tests  no tests
```
该失败正确——组件尚未创建,import 解析失败是预期的 RED 信号(证明测试确实在跑真实组件,
不是误配置成 no-op)。

**GREEN**(实现后):
```
pnpm exec vitest run src/photos/components/__tests__/AlbumPickerDialog.test.ts
```
```
Test Files  1 passed (1)
     Tests  12 passed (12)
```
中途有一轮失败(5 条,因 `watch` 未加 `immediate:true` 导致直接以 `open:true` 挂载的测试
拿不到已加载的相册列表)——修正后全绿,过程记录见下方"自审发现"。

**全量 + tsc + color-guard + parity**:
```
pnpm test
  Test Files  248 passed (248)
       Tests  1571 passed (1571)   # 基线 1558 + 本任务新增 12 + 既有其他改动带来的 1
pnpm exec vue-tsc --noEmit         # 无输出,通过
pnpm exec vitest run src/styles/color-guard.test.ts src/i18n/parity.test.ts
  Test Files  2 passed (2)
       Tests  114 passed (114)
```
(测试输出里出现的 `Error: Not implemented: navigation` 是 jsdom 对
`src/photos/stores/__tests__/favorites.test.ts` 里 `exportZip` 设置 `location.href` 的
既有噪音日志,与本任务无关,不影响测试通过。)

## 改了哪些文件

- 新增 `src/photos/components/AlbumPickerDialog.vue`
- 新增 `src/photos/components/__tests__/AlbumPickerDialog.test.ts`

## 自审发现

- **完整性**:brief 的每一条行为规则(结构、pick/createAndPick 语义、409 判定、Esc 分层、
  disabled 空提交、token 颜色)都已落地并有对应测试覆盖。
- **质量**:第一轮实现遗漏了"组件可能以 `open===true` 直接挂载"的情形——只用非
  immediate 的 `watch` 只在 false→true 变化时触发,导致以 `open:true` 直接挂载的测试拿不到
  数据。改为 `{ immediate: true }` 后修复,同时不破坏"open false→true 才拉取"这条 Step1
  测试(open 初始为 false 时 immediate 触发但 body 判断 `if (isOpen)` 为假,不发请求)。
  这个修正也让组件对宿主的两种可能用法都稳健:常驻挂载切换 `open` prop,或仅在
  `open===true` 时才挂载。
- **YAGNI**:未额外做确认二次弹窗、未做相册排序/搜索(brief 未要求)、未给「+ 新建相册」
  行加 disabled(brief 只要求相册项 disabled,新建流程本身通过 `pick()` 内部的
  `canSubmit` 短路兜底,不需要额外 UI 状态)。
- **测试是否真验行为**:12 条测试全部走真实 Pinia store + mock 到 service 层(而非 mock
  掉 store),断言的是底层 `service.photos.batchAddToAlbum`/`createAlbum` 调用参数、
  emit 载荷、toast 文案、DOM disabled 状态、Esc 分层的真实交互结果——不是 smoke mount。
- **颜色**:逐行检查 `<style>` 块,无 `#hex`/`rgb()`/`rgba()`,全部 `var(--…)` token,
  color-guard 测试确认通过。
- **手拼 URL**:全组件搜索 `/v1/` 无命中;封面 URL 唯一入口是
  `service.photos.thumbnailUrl(cover, 'small')`,并有专门测试断言"无封面时不调用该函数"
  和"有封面时调用参数与渲染 src 一致"。

## 与 Vue2 源比对时发现的 brief 出入

无出入。brief 已明确登记了唯一一处刻意偏离(`window.prompt` → 面板内联输入行),以及唯一
一处刻意的行为差异(失败路径不再像 Vue2 那样静默吞错,而是 toast + 保持面板打开)。逐行核对
`PhotosTimeline.vue:582-607`、`:1040-1065` 及 `PhotosFavoritesView.vue:471-476` 后,契约与
结构描述与源码一致,未发现需要向 T9 反馈的契约调整点。

## 遗留疑虑

- brief Step1 的测试清单未显式要求"createAlbum 抛非 409 错误"及"点击遮罩关闭"、
  "封面 URL 生成器"三条,但它们是行为规则里明确写出的约束(409 判定分支、绝不手拼 URL),
  故补测,不算超出范围。
- `pick()` 内部在 `assetIds` 为空时直接 `return`(未 toast 任何提示)——因为 UI 层已经把
  相册项 disabled,原生 `<button disabled>` 点击不会触发 handler,这个短路只是防御性兜底
  (例如未来某处以编程方式调用 `pick`),不影响任何已知交互路径,无需用户可见反馈。

---

## 评审修复(第 2 轮)

评审对提交 `e77eb25` 的两条 Important、两条 Minor 均已修复。

### Important 1 —— Esc 关闭改 document 级监听

**问题**:原实现用模板 `@keydown.esc`(overlay)/`@keydown.esc.stop`(input),依赖真实 DOM
焦点落在这两个元素上。用户从面板外触发按钮打开面板、不点面板内部直接按 Esc → 焦点仍在触发
按钮上 → overlay 的监听器收不到事件 → 面板关不掉;第一次 Esc 收起输入行后 input 被
`v-else` 卸载、焦点回落 `document.body`,第二次 Esc 同样断链。原测试在 overlay/input 元素上
直接 `.trigger('keydown')`,绕过了真实焦点路径,抓不到这个缺陷。

**RED**(先只改测试,仍用旧模板绑定实现,确认新测试挂红):
```
pnpm exec vitest run src/photos/components/__tests__/AlbumPickerDialog.test.ts
```
```
 FAIL  ... > Esc 分层(document 级派发,不依赖真实焦点):输入展开时先收起输入行,再次 Esc 才关闭面板
AssertionError: expected true to be false // Object.is equality
- Expected: false
+ Received: true
 ❯ ...:208 expect(w.find('[data-test="album-picker-new-input"]').exists()).to…
      Tests  2 failed | 12 passed (14)
```
(另一条失败是 Important 2 的红,见下)——该失败正确:改测试为 `document.dispatchEvent(...)`
后,旧的模板 `@keydown.esc` 绑定在 input 已收起（DOM 上没有任何元素持有该次按键的目标）时收不到
事件,输入行仍未收起,证明了缺陷真实存在。

**实现修复**:照 `PhotosSidebar.vue:22-27`(`watch(drawerOpen, ...)` 挂/摘
`document.addEventListener`)与 `PhotoLightbox.vue:119-140`(`onKey` 内先判断子状态、
再决定关哪一层)范式改写:
- 新增 `onDocumentKeydown(e)`:`e.key!=='Escape'` 直接返回;`creating.value` 为真则
  `cancelCreate()`,否则 `close()`——分层判断收敛到一个函数,不再依赖事件冒泡链。
- `watch(() => props.open, ...)` 的 `isOpen` 分支里 `document.addEventListener`,`else`
  分支里 `document.removeEventListener`;`onUnmounted` 再兜底摘一次,避免组件卸载时残留
  全局监听。
- 模板上删掉 `@keydown.esc`(overlay)、`tabindex="-1"`(不再需要脚本聚焦语义)、
  `@keydown.esc.stop`(input),只保留 `@keydown.enter` 和 `@click.self`。

**GREEN**:
```
pnpm exec vitest run src/photos/components/__tests__/AlbumPickerDialog.test.ts
  Test Files  1 passed (1)
       Tests  14 passed (14)
```

### Important 2 —— 409 判定补 message 兜底

**问题**:`isConflict()` 只查 `e.response.status===409`,漏了 brief 明确要求的「message 含
409」分支。不带结构化 `.response` 的错误(如纯 `new Error('...409...')`)会被误判成通用失败。

**RED**(新增测试,先跑红):
```
 FAIL  ... > createAlbum 抛无 response 字段但 message 含 409 的错误 → 仍判定为重名(brief 的 message 兜底)
AssertionError: expected '创建失败' to be '已存在同名相册'
Expected: "已存在同名相册"
Received: "创建失败"
```

**实现修复**:`isConflict()` 追加 `/409/.test(String(e.message ?? ''))` 分支(对 `message`
字段做同样的"未知形状安全"处理,不假设一定存在)。

**GREEN**:同上一轮全绿(14 passed)。

### Minor 1 —— 「+ 新建相册」键盘可达

原 `<div @click="startCreate">` 改为 `<button type="button">`,与相册项一致的
`.alb-picker-item` 基础样式(边框0/透明背景/cursor/font:inherit)已覆盖,无需额外样式。

### Minor 2 —— assetIds 为空时「+ 新建相册」静默无反馈

`canSubmit` 现在同时门控相册项与「+ 新建相册」按钮的 `:disabled`——assetIds 为空时两者都
disabled,避免"真建了相册但 pick() 被短路、用户对着输入行毫无反馈"的死胡同。新增测试断言
disabled 状态 + 点击不触发 `createAlbum`。

### 修复后的完整验证

```
pnpm exec vitest run src/photos/components/__tests__/AlbumPickerDialog.test.ts
  Test Files  1 passed (1)
       Tests  14 passed (14)

pnpm test
  Test Files  248 passed (248)
       Tests  1573 passed (1573)   # 基线 1571 + 本轮新增 2

pnpm exec vue-tsc --noEmit   # 无输出,通过

pnpm exec vitest run src/styles/color-guard.test.ts src/i18n/parity.test.ts
  Test Files  2 passed (2)
       Tests  114 passed (114)
```

### 改了哪些文件(第 2 轮)

- `src/photos/components/AlbumPickerDialog.vue` —— Esc 改 document 级监听、409 message
  兜底、「+ 新建相册」改 `<button>` 且随 `canSubmit` disabled。
- `src/photos/components/__tests__/AlbumPickerDialog.test.ts` —— Esc 测试改为
  `document.dispatchEvent`(新增"面板关闭后监听已摘除"一条)、新增 409 message 兜底测试、
  扩展 assetIds 为空测试覆盖「+ 新建相册」按钮。
