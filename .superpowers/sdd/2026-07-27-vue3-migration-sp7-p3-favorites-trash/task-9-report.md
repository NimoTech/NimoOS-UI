# Task 9 报告:回收站视图 `PhotosTrash.vue`

## 概述

新增 `src/views/PhotosTrash.vue`(路由组件,路由注册留给 T10)+ `src/views/__tests__/PhotosTrash.test.ts`。
自绘分桶网格(不复用 `PhotosGrid`),照 Vue2 `NimoOS-UI/src/views/Photos/PhotosTrashView.vue` 重塑为
New-UI token 语言,壳结构复制 `Photos.vue`/`PhotosFavorites.vue` 的 `AreaShell`/`photos-layout`/`photos-main`。

**额外(必要的基础设施扩展)**:共享 `useToast`(`src/stores/toast.ts`)原本只支持纯文本 toast,
没有"带一个可点按钮"的能力,而 brief 明确要求"恢复选中"成功后弹出**带 Undo 按钮**的 toast。为
避免另起一套并行的本地 toast UI(会在页面上同时出现两条视觉不一致的提示条),给共享 store 加了一个
向后兼容的第三参数 `action`,并在 `AppToast.vue` 里渲染成可点按钮。见下方"新增/改动的共享基础设施"。

## TDD 证据

### 1. 共享 toast store 扩展(先测试后实现)

- 编辑 `src/stores/toast.ts`:`ToastItem` 加 `action?: { label: string; onClick: () => void }`;
  `show(text, duration = 1500, action?)` 第三参数;新增 `dismiss(id)`。
- 编辑 `src/components/AppToast.vue`:渲染 `v-if="t.action"` 的 `.toast-action` 按钮,点击即调用
  `action.onClick()` + `toast.dismiss(t.id)`(不等自动消失计时器)。
- 补测试:
  - `src/stores/toast.test.ts` 加 2 条(`action` 原样存入 / `dismiss(id)` 立即移除)。
  - `src/components/AppToast.test.ts` 加 1 条(渲染按钮 + 点击触发回调 + toast 立即消失)。
- 先跑这 2 个测试文件确认 GREEN(8/8 通过),再验证未破坏已有 3 条旧测试(纯文本 toast 场景,
  `.text()` 断言在没有 action 时仍精确等于原文本,因为按钮走 `v-if` 不渲染)。
- 这一步单独跑:`pnpm exec vitest run src/stores/toast.test.ts src/components/AppToast.test.ts` → **8/8 通过**。

### 2. `PhotosTrash.vue`

- 先写 `src/views/__tests__/PhotosTrash.test.ts`(9 条,覆盖 brief 全部 7 条测试要点 + 2 条补充):
  1. `loaded` 且空 → 空态 + hero 两个按钮 `disabled`。
  2. 有项(2 条,daysLeft 分别算出 3/29,固定系统时间 2026-07-27 让 daysLeft 可预测)→ 2 个分桶
     (urgent + fresh)、瓦片数=2、`img src` 精确等于 mock 的 `thumbnailUrl(id,'small')` 返回值、
     倒计时角标文本含对应天数。
  3. 点选择圈 → 该项进 `selected`,bulk bar 出现,`data-selected="true"`。
  4. 点"恢复选中" → **不开确认模态**(直接执行,与 Vue2 `restoreSelected` 一致)→ `trash.restore(['a'])`
     被调 + 选择清空 + toast 渲染出"撤销"按钮 → 点撤销 → `trash.undoRestore(['a'])` 被调
     (真挂 `AppToast.vue` 于同一 Pinia 实例,端到端点击,不是白盒 spy)。
  5. 点"清空回收站" → 确认模态出现 → 点确认 CTA → `trash.empty()` 被调,模态关闭。
  6. ESC → 确认模态关闭。
  7.(补充)"永久删除选中" → 确认模态 `data-danger="true"` → 确认 → `trash.purge(ids)`。
  8.(补充)bulk bar "取消" → `selected` 清空,bulk bar 消失。
  9.(补充)点瓦片任意位置(非选择圈)同样切换选择——验证 P3 铁律"点瓦片=选择,不开灯箱"。
- **RED**:先确认组件不存在时测试报 `Failed to resolve import "../PhotosTrash.vue"`。
- **实现**:写 `PhotosTrash.vue`。
- **GREEN**:`pnpm exec vitest run src/views/__tests__/PhotosTrash.test.ts` → **9/9 一次性通过**
  (期间只有一次 `vue-tsc` 类型错误需修——`Array.reduce` 在 `Array<string|number>` 上推导累加器类型
  成 `string|number` 而非 `number`,用 `reduce<number>(...)` 显式标注解决,与 UI 逻辑无关)。

### 3. 全量验证

```
pnpm exec vue-tsc --noEmit         → 无输出(通过)
pnpm test (= vitest run 全量)       → 244 files passed, 1500 tests passed(含 color-guard 110 条、
                                       i18n parity)
```
过程中 color-guard 首次跑出 1 条失败(`.trash-tile-overlay` 的固定黑色渐变遮罩 rgba 未加豁免注释),
补上 `/* theme-exception: ... */` 后复跑通过。全量测试里出现的 `Error: Not implemented: navigation`
console 噪声来自**既有**的 `favorites.test.ts`(`exportZip` 设置 `location.href`,jsdom 不支持真实导航
但不影响断言结果),与本任务无关,测试计数仍是 244/244、1500/1500 全绿。

## 关键设计取舍

1. **倒计时三档色 = 复用既有语义 token,未新增 token**:
   - `urgent`(1–7 天)→ `var(--remove-fg)`(危险红,全仓库已用于 `ContextMenu.vue`/
     `PhotoLightbox.vue`/`SelectionToolbar.vue` 等一切"删除/危险"语义,深浅主题都已有值)。
   - `warn`(8–14 天)→ `var(--dem-fg)`(琥珀色,`SearchDialog.vue` 的"降权"结果标签、
     `UploadPanel.vue` 的警告态已在用,深浅主题都已有值)。
   - `normal`(15–21 天 / 最近删除)→ `var(--accent)`(常规强调蓝,全局到处都是)。
   - 桶头圆点、倒计时徽标底色(用 `color-mix(in srgb, var(--remove-fg) 78%, black)` 等叠黑加深,
     确保徽标在任意底图上足够醒目)、危险按钮前景色、确认弹窗危险描边/CTA 渐变全部走这三个 token,
     **没有新增任何 `--danger`/`--warn` token**——brief 允许"若无对应语义再新增",但仓库里已经有
     对应语义,复用更省心也更一致。
2. **CTA 渐变按钮复用 `--grad-a`/`--grad-b`**(非危险操作,如"恢复全部"确认)和
   `linear-gradient(135deg, var(--remove-fg), var(--remove-bg))`(危险操作,如"清空"/"永久删除"
   确认),白色按钮文字统一标 `/* theme-exception: 渐变胶囊按钮文字... */`——与 `SearchDialog.vue`/
   `MediaViewer.vue` 现有的同类渐变按钮完全同款注释与理由。
3. **P3 铁律落实**:`onTileClick(p)` 只调用 `toggleSelect(p.id)`,**没有任何灯箱/路由跳转接线**——
   回收站瓦片是"待恢复/待永久删除"的精简对象(`TrashPhoto`,无 `mimeType`/`livePhoto`/`ocr` 等灯箱
   需要的完整字段),灯箱的收藏★/删除🗑按钮语义在这里也不成立(删除=永久删除?还是恢复?不明确),
   故整块跳过——组件顶部注释已记入台账,措辞与用户记忆里的"trash 精简对象+灯箱收藏/删除钮语义不符"
   一致。
4. **选择态用原生 `Set`,不做 Vue2 风格的"整体替换"workaround**:`ref(new Set())` 在 Vue3 下
   对 Set/Map 有专门的集合响应式劫持,直接 `.add()`/`.delete()`/`.clear()` 即可触发视图更新;
   同时严格按 `p.id`(`string | number` 值)存取,不比较对象引用。
5. **恢复选中 vs 其余三个操作的确认路径**:`restoreSelected()` 直接执行(无 `askConfirm`),
   `restoreAll()`/`deleteSelected()`/`emptyTrash()` 三个都过 `askConfirm` → 单一 `confirm` ref
   → `<div v-if="confirm">` 模态,ESC 用 `document.addEventListener('keydown', ...)`(`onMounted`
   挂载、`onUnmounted` 卸载)。与 brief 逐字一致。
6. **Undo 链**:`restoreSelected`/`restoreAll` 成功后把参与恢复的 id 列表存进模块内闭包变量
   `undoIds`(非响应式,纯粹的"待撤销暂存",同 Vue2 `this._undoIds` 的用途,不需要参与渲染);
   toast 的 `action.onClick` 绑定到 `onUndo()`,内部读走 `undoIds` 后立即置空(防止重复点击二次
   撤销同一批)、调用 `trash.undoRestore(ids)`。永久删除/清空会显式把 `undoIds` 置 `null`
   (与 Vue2 `deleteSelected`/`emptyTrash` 里 `this._undoIds = null` 对应),防止误按一个早已失效的
   撤销入口。
7. **toast 时长统一 4500ms**(照 Vue2 `showToast` 的 4500ms,与全仓库其它视图常见的 4000ms 略有
   不同,是本视图特有的、brief 明确指定的数值)。

## 新增的 theme token

**无新增**。见上方"关键设计取舍 1"——三档倒计时色全部复用仓库已有的 `--remove-fg`/`--dem-fg`/
`--accent`,均已在 `:root` 与 `:root[data-theme="light"]` 两套主题块里有值。

## color-guard 处理

- 全新 `PhotosTrash.vue` 的 `<style scoped>`:所有可感知颜色一律 `var(--token[, fallback])`,
  三处 `theme-exception` 豁免(均照抄仓库既有惯例,理由写在注释里):
  1. `.trash-tile-overlay` 的黑色渐变遮罩(`rgba(0,0,0,0.5)`)——媒体缩略图上方固定遮罩,
     同 `.lib-tile-overlay`/`PhotosGrid.vue` 系列惯例。
  2. `.trash-tile-countdown` 的白色文字(`#fff`)——固定深底徽标叠在缩略图上,同 `.tile-vid` 惯例。
  3. `.trash-tile-select` 的固定白色描边(`rgba(255,255,255,0.7)`)——同 `.tile-fav` 惯例。
  4. `.trash-tile-meta` 的固定白字 + 阴影——同 `.lib-tile-place` 惯例。
  5. `.trash-btn-cta` 的白色按钮文字——同 `SearchDialog.vue`/`MediaViewer.vue` 渐变按钮惯例。
- `AppToast.vue` 无新增裸颜色(新按钮全走 `--accent-soft`/`--accent-soft-bd`/`--accent-text`/
  `--accent-soft-2`,均为既有 token)。
- 全量 `color-guard.test.ts`(110 条,每个 `.vue`/`.css` 一条)首次跑有 1 条失败(遗漏第 1 处
  exception 注释),补注释后全绿。

## 文件清单

- 新增:`src/views/PhotosTrash.vue`
- 新增:`src/views/__tests__/PhotosTrash.test.ts`
- 改动:`src/stores/toast.ts`(action 参数 + dismiss)
- 改动:`src/components/AppToast.vue`(渲染 action 按钮)
- 改动:`src/stores/toast.test.ts`(+2 测试)
- 改动:`src/components/AppToast.test.ts`(+1 测试,补 `vi` import)

## 遗留 / 挂账

- 无 P3 内遗留问题。路由注册(`/photos/trash`)按计划留给 T10;`PhotosSidebar.vue` 的 `trash` 导航
  条目此前(Task 6)已就位,无需本任务改动。
- 台账(非本任务缺陷,记录设计事实):P3 回收站瓦片刻意不接灯箱——精简对象 `TrashPhoto` 与灯箱
  收藏/删除钮语义不符,若未来产品需求要求"回收站瓦片可预览大图",需要先决定预览态下"删除"按钮
  该做什么(永久删除?恢复?二选一都可能违反直觉),再单独设计,不在本任务范围内。
