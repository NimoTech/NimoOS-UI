# P5d · T6 报告 —— `NotesView.vue`

状态:**DONE**。起点 `sp8-ai@b905943`(T0–T5 六刀已关账)。本刀新增 2 文件、改 1 文件(仅 1 行)。

## 1. 交付物

- `src/ai/knowledge/views/NotesView.vue`(新建)—— 1:1 移植蓝本 `NimoOS-UI@7a6ee6b7:src/views/AI/Knowledge/NotesView.vue`(271 行)。
- `src/ai/knowledge/views/NotesView.test.ts`(新建)—— 31 条用例。
- `src/ai/styles/knowledgeStyles.test.ts`(改 1 行)—— `KNOWLEDGE_VUE_FILES` 加入 `'views/NotesView.vue'`(唯一允许的改动,`git diff` 已核实只有这一行)。

## 2. 蓝本对照(区块 → 本文件)

pathstrip `:8-16` → pathstrip 段;骨架屏 `:19-28` → 骨架 v-if 分支(N24 算术内联样式照抄);空态 `:31-38`;草稿收件箱 `:42-76`;工具栏 `:79-99`;列表 `:102-142`;删除确认弹窗 `:147-175`(转 reka,见 §5);全部 script `:180-266`(`data()`→refs、`computed`→computed、`watch`→`watch()`、`created()`→setup 顶层直调、`methods`→本地函数)。

## 3. 数据契约(mock 层次,治理 §4.1)

- `service.notes.list({limit:200})` mock 为**已归一化 `Note[]`**(不是 `{notes:[]}` 信封)—— 3 条取自 `p5d-fixtures/notes-list-200.json` 真实条目(id/title/description/revision/updatedAt/path/tags/sourceRefs 逐字段照抄该 fixture),camelCase 化;curated/archived 两档在真机验不到(23 条全是 draft/insight/pipeline,`p5d-fixtures/README.md` §4 已记),故这两条的 `status`/`type`/`createdBy` 是在 fixture 原条目基础上手动覆盖,已在测试文件声明处逐条注明。
- `service.notes.getSettings()` mock 为 camelCase `{notesRoot, autoExtract}` 两字段(取自 `p5d-fixtures/notes-settings.json`,归一后丢弃 `distill_*`/`background_model` 三字段)。
- `service.notes.remove(id)` mock 为 `{status:'deleted', id}` —— **按 `p5d-fixtures/README.md` §3.1 的实测勘误**(治理 §4.1 写「包不剥不归一,返回整个 axios 响应」是错的,真实是 `return res.data` 且真机 200 body 就是这个 JSON;本页也不读返回值,蓝本 `:261` 只 `await`)。

## 4. §3 六处判据与证据

**①§5.2 过期守卫**(K15 同族第 8 次):`reload()` 用组件本地 `let reloadEpoch`(非模块级)。
- 用例①「交错」:A 先发后至、B 后发先至 —— RED 探针(临时删掉 3 处 epoch 检查):`① 交错…` 报红(`expected [Array(1)] to deeply equal [Array(1)]`,B 的结果被 A 覆盖),还原后复绿。
- 用例②「两实例交错」:判据要求把 `reloadEpoch` 挪到模块级必须报红 —— RED 探针(临时把 `let reloadEpoch` 移进独立 `<script lang="ts">` 块,改名 `reloadEpochShared` 并去 setup 化)：`🔴 ② 两实例交错…` 精确报红(`expected [] to deeply equal [Array(1)]`,instance1 的迟到响应被 instance2 的调用误判为过期而丢弃)。两次探针均先 `md5sum` 证注入落盘、跑对应用例、再用 `cp` 备份覆盖、`md5sum` 逐字节比对还原、`git status` 干净。

**②N30 两条**:`watch(editingId, v => { if(!v) reload() })` + 模板 `:key="editingId"`。用例:非空→非空(不 reload,子组件 DOM 节点身份变化证明重建)+ 非空→空(reload 触发)。

**③深链 `?id=`**:`editingId` 是读 `route.query.id` 的 `computed`(非 onMounted 一次性读值),测试直接 `router.push({query:{id:...}})` 模拟改地址栏,验证不需重挂载整个视图即可切到编辑态。

**④静默兜底(K6)**:`getSettings().catch(() => {})` 空 catch,连注释都照抄「keep placeholder」。用例验证:占位保留、`useToast().toasts` 为空、`console.error` spy 未被调用。

**⑤模板内联色(缺口③)**:`:85` 的 `background: 'rgba(255,149,0,.14)'` 换成 `'var(--warning-soft)'`。**未在 `NotesView.test.ts` 里补重复的定向断言** —— `knowledgeStyles.test.ts` 已有的「守卫缺口③′」是贪婪抽取整个 `<template>` 文本做正则扫描(P5c 建、P5d T2/T5 扩过),天然覆盖 `:style` JS 对象字面量里的字符串,本刀只需把 `views/NotesView.vue` 加进 `KNOWLEDGE_VUE_FILES` 集合断言即被其覆盖。RED 探针:临时把该行换回 `'rgba(255,149,0,.14)'`(`md5` 证落盘:`697610d8…`)→ `pnpm exec vitest run knowledgeStyles.test.ts -t 模板内` 精确报红 `views/NotesView.vue —— 模板内(剥离 var()/color-mix() 后)零 hex / rgb / hsl 字面量`;`cp` 还原,`md5` 复核与改前一致(`b45f5007…`),`git status` 干净。

**⑥confirmAll(N31)**:照抄 `Promise.all` 并发 + 无 `finally` + 失败也 `reload()`。用例:全部成功(toast 带数量)、部分成功(一条 curate 拒绝 → `Promise.all` 整体 reject,只弹一条「操作失败」,但 `reload()` 仍执行,`notes.list` 被再次调用)。

## 5. K/N 命中申报

K1(单层取数)· K3(全局 `useToast()`)· K5(全部 5 处 catch 不回显 `e.message`,统一 `aiKbOpFailed`)· K6(notesRoot 静默兜底)· K15 同族第 8 次(§5.2)· K34 同族(`deleting.value!.id` 非空断言,保抛而非 `?.`)· K41 同族(`tagsOf()` 收窄 `unknown[]`→`string[]`,K41 治理正式登记于 T7,本刀命中同一字段用同一手法)。N24(骨架算术内联样式)· N25(列表脚注整句)· N30(两条)· N31(confirmAll)。

## 6. 删除确认弹窗转 reka(申报)

**判断:转。** 理由:K7 自 P5b 起对本期新增弹窗一律生效,`QueueView`/`IndexedFilesView`/`SettingsView` 三个先例全部已转,没有例外先例。蓝本本身有可见 `.k-modal-title`,按 K36 既定选择用 `<DialogTitle as-child>` 套在该 div 上(不加 `VisuallyHidden`)。结构照 `QueueView.vue:560-583`/`SettingsView.vue:580-624` 抄。测试覆盖:打开/取消/改为归档/删除/点遮罩关闭点内部不关闭,共 5 条,`withHost()` 备 `.knowledge-app` 宿主。

## 7. 尚不存在的 `NoteEditPane.vue`(依赖链缺口)

T6 早于 T7(单车道顺序),`NoteEditPane.vue` 真身不存在。为使本刀能独立过三门,`<script setup>` 内定义了一个零逻辑本地占位组件(`h('div', {class:'kn-edit-pane-stub', 'data-note-id':...})`)顶替静态 import,不创建新 `.vue` 文件(不影响「.vue 180→181」算术,也不算本刀创建了 `NoteEditPane.vue`)。模板挂载点与 `:key="editingId"` 均照蓝本 1:1 写。测试直接消费这个占位组件断言 `:key` 触发的重建(DOM 节点身份变化)。已在文件头与内联注释详细申报。

## 8. 三门与算式

```
Test Files  330 passed (330)
     Tests  3874 passed (3874)
vue-tsc --noEmit  exit=0
vite build        exit=0
sass knowledge.scss  exit=0
```

- 「329 + 1 = 330」文件:vitest 的 `Test Files` 只计 `*.test.ts`,本刀只新增 `NotesView.test.ts` 一个 ✓。
- 「3839 + 35 = 3874」例:本刀 `NotesView.test.ts` 31 例 + `views/NotesView.vue` 带来的动态用例 4 例(`color-guard.test.ts` glob `**/*.vue` +1、`knowledgeStyles.test.ts` 三个 `it.each(KNOWLEDGE_VUE_FILES)` 各 +1 = 3)= 35 ✓。
- `.vue` 180 → 181(只 `NotesView.vue`)✓,color-guard +1 ✓。

`git status --porcelain`:仅 3 个文件(`NotesView.vue` 新建、`NotesView.test.ts` 新建、`knowledgeStyles.test.ts` 改 1 行),无其它改动。

## 9. §9.9 可点性清单(五个条件两侧用例)

`drafts.length`(收件箱有/无)· `notes.length`(空态/非空)· `filtered.length`(筛选空态/有结果)· `n.status==='draft'`(draft 行有确认按钮 / curated·archived 行无)· `n.status!=='archived'`(draft·curated 行有归档按钮 / archived 行无,且 archived 行验证「两个条件都到反面,只剩删除按钮」)。全部覆盖于对应 describe 块。

## 10. 已知噪声

未命中已知噪声(`persist.test.ts`/`AgentComposer.test.ts`),全量单跑零复跑。
