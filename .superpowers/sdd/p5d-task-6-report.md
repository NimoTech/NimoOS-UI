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

## 修复轮 1

评审两条(1 Important + 1 Minor,协调者一并要求)均已修复,**产品代码 `NotesView.vue` 本轮零改动**,只改了 `NotesView.test.ts`(自证见 §5)。

### 1)Important —— 占位组件「自动上膛」守卫

原状:`NoteEditPane.vue` 落地后若忘了回来接线,任何测试都不会红(TODO 注释可被无声忽略)。新加一条**文件系统条件断言**(`NotesView.test.ts` 新 describe「T6 占位组件的自动上膛守卫」):用 `node:fs` 的 `existsSync` 探测 `src/ai/knowledge/components/NoteEditPane.vue` 是否存在,`readFileSync` 读 `NotesView.vue` 源码本身,按存在与否分两支各自断言(两支都是会真失败的强断言,不是 `if` 不成立就 `return` 的空转写法):

- **不存在**(现在):断言占位标记(`kn-edit-pane-stub`/`NoteEditPanePlaceholder`)仍在、且不存在指向真文件的 `import` ——两条都可能报红(比如占位被误删但真文件没补上)。
- **存在**(T7 之后):反过来断言必须已经 `import` 真组件、且占位标记必须清空。

**① 惰性证明**(真执行,非 skip):当前 `src/ai/knowledge/components/NoteEditPane.vue` 不存在,`pnpm exec vitest run NotesView.test.ts -t 自动上膛` 走的正是「不存在」分支,两条 `expect` 都实际求值并通过(不是被 `it.skip` 跳过——用 `--reporter=verbose` 复核该条用例确实出现在通过列表里,耗时 1ms,是真跑不是跳过)。

**② 上膛证明**(RED 探针,临时文件,未提交):
```
$ touch/写入 src/ai/knowledge/components/NoteEditPane.vue(最小合法 .vue)
$ pnpm exec vitest run NotesView.test.ts -t 自动上膛
 × 🔴 自动上膛:… 1 failed
 AssertionError: NoteEditPane.vue 已存在:请在 NotesView.vue 里改成
 `import NoteEditPane from '../components/NoteEditPane.vue'`
 (T6 遗留的本地占位需要替换,见 T6 报告): expected false to be true
```
精确报红,失败信息里已给出下一步操作。随后 `rm src/ai/knowledge/components/NoteEditPane.vue`,`git status --porcelain -- src/ai/knowledge/components/` 输出为空(该目录本轮从未被 git 跟踪任何改动),重跑该用例复绿(`1 passed | 32 skipped`)。

### 2)Minor(协调者升级为必做)—— K36 a11y 常驻断言

`NotesView.test.ts` 的「删除确认弹窗」describe 里新增一条 `🔴 K36 a11y` 用例,照 `IndexedFilesView.test.ts:1947` 先例:打开弹窗后钉死 `modal.getAttribute('role') === 'dialog'`、`aria-labelledby` 与 `.k-modal-title` 的 `id` **同值同元素**、且弹窗内 `[id]` 元素**恰好 1 个**(反向确认 `as-child` 没有像 `VisuallyHidden` 那样多插一个隐藏节点)。

**变异证据(RED 探针,已在生产文件上真跑,非源码推理)**:`cp` 备份 `NotesView.vue` → 把 `<DialogTitle as-child>` 改成 `<DialogTitle>`(去掉 `as-child`)→ `md5sum` 证注入落盘(`b45f5007…` → `b52d7631…`)→ 跑 `pnpm exec vitest run NotesView.test.ts -t K36`:

```
× 🔴 K36 a11y —— aria-labelledby 与 .k-modal-title 的 id 同值同元素,且没有额外的隐藏 DialogTitle 节点
AssertionError: expected '' to be 'reka-dialog-title-v-0'
  - reka-dialog-title-v-0
  + (空字符串)
  at NotesView.test.ts:627 expect(titleEl.id).toBe(labelId)
```
精确报红(去掉 `as-child` 后 reka 另起一个独立节点持有生成的 `id`,`.k-modal-title` 自己的 `id` 属性变空)。随后用备份文件覆盖还原,`md5sum` 核对与改前完全一致(`b45f5007…`),`git diff -- src/ai/knowledge/views/NotesView.vue` 输出为空,重跑该用例复绿(`33 passed`)。

### 3)三门(全量,落盘)

```
Test Files  330 passed (330)
     Tests  3876 passed (3876)
vue-tsc --noEmit → exit=0
vite build       → exit=0
```
(完整日志:`/tmp/p5d-t6-fix-test.log` / `/tmp/p5d-t6-fix-tsc.log` / `/tmp/p5d-t6-fix-build.log`)

算式:**3874 + 2 = 3876**(本轮新增 2 例:自动上膛守卫 1 例 + K36 a11y 1 例)。`Test Files` 仍是 330(没有新增测试文件,只改了既有的 `NotesView.test.ts`)。

### 4)`NotesView.vue` 零改动自证

```
$ git diff -- src/ai/knowledge/views/NotesView.vue
(空输出)
$ git status --porcelain
 M src/ai/knowledge/views/NotesView.test.ts
```

本轮探针(内联色回退、epoch 挪模块级、logic 守卫拿掉)全部按「cp 备份 → 行首锚定注入 → 先证注入落盘(md5)→ 用备份覆盖 → md5 逐字节比对」流程操作,还原后与备份 `md5` 完全一致,`git diff`/`git status` 均确认 `NotesView.vue` 无残留改动。占位组件临时文件已 `rm` 删净,`git status` 对 `src/ai/knowledge/components/` 目录无任何记录。
