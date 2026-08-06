# P5d · T6 任务 brief —— `NotesView.vue`(蓝本 271 行)

> **权威优先级:`p5d-coordinator-rulings-T0.md`(R1–R15)> `p5d-appendix-A/B/D` > `p5d-common-constraints.md`
> + P5a/P5b/P5c 治理 > `p5d-plan.md` > 本 brief。** 🔴 **治理已查实 15 处错(E-31 ~ E-45),冲突处信裁定书。**

## 0. 必读顺序

1. `.superpowers/sdd/p5d-coordinator-rulings-T0.md` 全文(**最高**)
2. `p5a-common-constraints.md` → `p5b-` → `p5c-` → **`p5d-common-constraints.md`** 全文
   (**§4.1 数据契约** · **§5.2 过期守卫** · **§9.9 可点性** · **§3/§3.5 的 K/N 清单**)
3. `p5d-plan.md` 的 **§0 开工必读** 与 **§T6**
4. 🔴 **`p5d-appendix-A-i18n.md`**(键名;**值只许从 §A.2 抄,§A.4 是归属核对表**)+
   **`p5d-appendix-B-tokens.md`**(那 1 处模板内联色换哪个 token 的**唯一权威**)+ **`p5d-fixtures/`**(真机响应体)
5. 本 brief

路径相对 `/home/nimo/NimoTech/.sp8/NimoOS-New-UI/`。**计划书 §T6 的 DoD 1–11 是你的验收口径。**

## 1. 坐标与基线

| | 值 |
|---|---|
| 可写仓 | `/home/nimo/NimoTech/.sp8/NimoOS-New-UI`,分支 `sp8-ai` |
| **起点 HEAD** | **`f43f9ad`**(T0–T5 **六刀全部关账**) |
| 蓝本 | `git -C /home/nimo/NimoTech/NimoOS-UI show 7a6ee6b7:src/views/knowledge/NotesView.vue`(**271 行**,T0 已核)。**禁读该仓工作树** · **永远禁 `checkout`/`stash`/`reset`** |
| 新建 | `src/ai/knowledge/views/NotesView.vue` · `NotesView.test.ts` |
| 文件数 | **329 → 330** · `.vue` **180 → 181** · color-guard **+1** |
| 🔴 **三门基线(T5 后)** | **329 文件 / `3839` 例** · `vue-tsc` 0 · `vite build` 0 |
| 已就绪的依赖 | **T1** 92 个 i18n 键 · **T2** 全部 scss 类(含 `.k-seg`/K45 `.k-btn.text`)· **T3** `notesViewHelpers.ts`(`NOTE_TYPES`/`noteTypeMeta`/`NOTE_SOURCES`/`noteSourceMeta`/`statusBadge`/`applyFilters`/`relativeTime`)· **T5** `openDirInNewTab` |
| 🔴 尚未存在 | `NoteEditPane.vue`(**T7/T8**)—— 本刀只写 `NotesView.vue`;**`:key="editingId"` 与子组件挂载点照蓝本写**,若测试需要就 stub 掉子组件并在报告说明 |

## 2. 🔴 数据契约(K1;**mock 搞反按 Critical**)

- **`service.notes.list({limit:200})` 返回**已归一化的 `Note[]`**,不是 `{notes:[]}` 信封**(治理 §4.1)。
- **`service.notes.getSettings()` 返回 camelCase 且只有 `{notesRoot, autoExtract}` 两个字段。**
- **`service.notes.remove(id)`** 的真机响应是 **200 + `{"status":"deleted","id":"…"}`**(E-33 + E-38)——
  **不许照抄治理里「204 空体 → `''`」那句**(那是 P5b 的另一个端点)。
- 🔴 **mock 形状一律取自 `p5d-fixtures/`(T0 落的真机响应体),不许手编** ——
  「手编 fixture」在本档栽过多次(裸信封 unwrap 已栽三次)。

## 3. 🔴 本刀最容易假绿/静默错的六处

### ① §5.2 过期守卫(K15 同族**第 8 次**)

`reload()` 有 **3 个并发入口**:`created` · `watch editingId` 变空 · 5 个动作各自 `reload()`。
**`loading = false` 被先完成的那个提前清掉 → 骨架提前消失、用户可见。**
- **两条用例**:① 交错(先发后至不覆盖);② 🔴 **「两实例交错」**
  —— **判据:把守卫变量挪到模块级,这条必须报红**(P5c §9.1)。
- 🔴 **inline 写,不许抽公共 guard**(过早抽象;本档明令)。

### ② N30 两条一起

`watch editingId` **只在变空时** `reload()`;`:key="editingId"` **不许删**。
**两条各一条用例**(切到另一条笔记时**不** reload、但子组件**重建**)。

### ③ 深链:`editingId` 来自 `route.query.id`

🔴 **要 watch 每个键各自的 getter** —— 只写在 `onMounted` 里的话,**用户改地址栏一行都不跑**
(记忆 `newui-router-query-only-no-remount`)。**「地址栏直接改 `?id=`」的用例必须有。**

### ④ 静默兜底照抄(K6)

`notesRoot` 的 `created()` 取数失败要**静默兜底** —— 蓝本 `:215` 是**空 catch + 注释 `keep placeholder`**。
🔴 **照抄,连 `console.error` 都不许加。**

### ⑤ 模板内联色(缺口③)

🔴 **本刀有 1 处模板内联色:蓝本 `:85` 的 `background: 'rgba(255,149,0,.14)'`,藏在 `:style` 的 JS 对象里**
(不是 `style="…"` 字符串)。按**附录 B** 换成 token,并 🔴 **确认那条「`<template>` 零裸色」断言真能扫到
`:style` 对象里的值** —— P5b 的 E-11 就是漏了这一类。**必配 RED 探针**(把 token 换回色字面量 → 必须报红)。

### ⑥ Vue watch 去重坑(**T4 刚栽过,已证实**)

写「防重复 / 去重 / 不重复触发」类用例时,**回写的值必须与初始值不同**。
否则 Vue watch 的 `Object.is` 前置去重会让**回调完全不执行** → 用例即使在「守卫被整个拿掉」时也照样绿
= **零判别力,且是「测试路径从未到达被测代码」这一最难自查的形态**。
🔴 **判据永远是:拿掉产品代码的守卫,这条用例必须红。**

## 4. 照抄不改的(N 系列;**改了就是缺陷**)

- **N24**:骨架 4 行的算术内联样式 `(52 - i*8)%` / `(72 - i*6)%` + `cursor: default` **照抄**。
- **N31**:`confirmAll` 照抄 —— **`Promise.all` 并发 + 无 `finally` + 失败也 `reload()`**。
  **部分成功的用例要有**(toast 报失败 + 列表仍刷新)。
- **N25**:整句带 `{n}` 的列表脚注**照抄**,**不许拆成三段拼接**。
- **K3**:`store.actions.toast(...)` → 全局 `useToast()`;
  **`store.actions.setNotesDraftCount(n)` 照抄调用**(`knowledgeStore.ts:509`;**store 全期零改动**)。
- **T5 的新函数**:`openDirInNewTab(notesRoot || '/DATA/Notes')`。

## 5. 本刀范围(蓝本分块;**行号以 T0 报告 §2 为准,治理若冲突信 T0**)

pathstrip(`:8-16`)· 骨架屏(`:19-28`)· 空态(`:31-38`)· 草稿收件箱(`:42-76`)· 工具栏(`:79-99`)·
列表(`:102-142`)· 删除确认弹窗(`:147-175`)· 全部 script(`:180-266`)。
⚠️ **`watch:` 在 `:208`**(治理写 `:210` 是错的)· **`confirmAll` 在 `:238`**(治理写 `:243` 是错的)—— **E-42**。

**§9.9 可点性清单**:`drafts.length` / `notes.length` / `filtered.length` / `n.status === 'draft'` /
`n.status !== 'archived'` **五个条件的两侧都要用例**。

⚠️ **删除确认弹窗要不要转 reka?** —— 计划书 §T8-7 说 T8 的冲突弹窗**转**;**本刀的删除弹窗同款**。
**若你判断本刀也该转,先在报告里申报并说明;若不转,也要写明理由** —— T8 会来核这两处一致性,
**不一致会被打回**。拿不准写 `NEEDS_CONTEXT`。

## 6. 常驻纪律

- 🔴 **申报注释一律引「蓝本 `file:line`」与「附录 B 行号」,禁在注释里写 `#hex`/`rgb()`/`rgba()`/具名色**
  —— **§0.3 明令「注释里也不许出现色字面量」**;`T2`(`f128450`)是可照抄的先例。
  ⚠️ 具名色与 hex/rgb/hsl 两条扫描**都不剥注释,这是有意为之**。
- 🔴 **一切可见颜色必须 `var(--…)`**;`transparent` 关键字不算。
- 🔴 **探针/变异还原禁用 `git checkout -- <path>` / `git restore`** —— 只许「先 `cp` 存副本 → **行首锚定**注入 →
  **先证注入真落盘** → 用副本覆盖 → `md5sum` 逐字节比对」。
- 🔴 **凡 DoD 里带 🔴 的「复跑 / 复扫 / 独立复核」项,不许用「采信上一刀的结论」替代;
  要跳过必须先停下写 `NEEDS_CONTEXT` 申报 —— 事后在报告里写一句不算申报。**
- ⚠️ **代码膨胀会被评审逐行追来历**(T3/T4/T5 各查一次,三次都干净):TS 类型标注与 K/N 申报注释正当,
  **蓝本没有的新逻辑 / 被"修正"的行为 / 顺手抽的抽象 = 缺陷**。
- **移植纪律**:界面严格 1:1(版式/间距/结构/文案/DOM 顺序/按钮位置逐字照蓝本);
  Vue2 的 bug/竞态/吞错**不照抄**,改正确逻辑并按治理 §3 **申报登记**;**禁无关重构**。
- **零 `any`**;`vue-tsc` 0。只有 **K1–K45** 登记过的偏离才许做;**照抄不改**的是 **N1–N32**;其余**先申报再做**。
- 🔴 **禁部署**、禁写 `/var/lib`、禁 `git push`/`rebase`/`reset`/`stash`/`merge`、禁 `git add -A`/`git add .`。
- 🔴 别碰 `/home/nimo/NimoTech/NimoOS-New-UI` 与 `/home/nimo/NimoTech/.sp7/NimoOS-New-UI`(**并发会话**)。
- 🔴 **不要 kill 或重起任何 dev server**(`:5288` 由协调者维护;`:5277`/`:5299` 属别的并发会话)。不装依赖。
- **不碰** `src/i18n/**`(T1)· `src/ai/styles/**`(T2/T5)· `src/ai/knowledge/util/**`(T3)·
  `NotesMarkdownEditor.*`(T4)· `openInApp.*`(T5)· **`knowledgeStore.ts`(全期零改动)**。
- `.sp8/NimoOS-Service` 零改动;不需要跨仓 `pnpm build`(裁定 R12)。

## 7. 三门

```bash
cd /home/nimo/NimoTech/.sp8/NimoOS-New-UI
pnpm test                      > /tmp/p5d-t6-test.log  2>&1; echo "exit=$?"
pnpm exec vue-tsc --noEmit     > /tmp/p5d-t6-tsc.log   2>&1; echo "exit=$?"
pnpm build                     > /tmp/p5d-t6-build.log 2>&1; echo "exit=$?"
```

**全量,输出完整落盘,不许 `| tail`。** 报告贴 `Test Files` / `Tests` 两行 +
**「329 + 1 = 330 文件」与「3839 + 本刀新增 N = 实测值」两个算式**。
⚠️ **新 `.vue` 必须登记进 `knowledgeStyles.test.ts` 的 `KNOWLEDGE_VUE_FILES`**(T4 就被这条中央守卫拦过)
—— 这是**本刀允许改 `knowledgeStyles.test.ts` 的唯一理由**,只许加那一行。
**已知噪声**(只它们红才复跑一次并说明,**不要顺手改**):`src/files/upload/persist.test.ts > … dropPersisted …` ·
`AgentComposer.test.ts` 的 vue-i18n teardown 竞态。包管理器 **`pnpm`**。

## 8. 报告契约

- 全文写 `.superpowers/sdd/p5d-task-6-report.md`。**返回给协调者 ≤ 20 行。**
- 必须含:§T6 **DoD 1–11 逐条** · **§3 六处各自的判据/变异证据**(尤其 ①「守卫挪到模块级 → 报红」与
  ⑤「token 换回色字面量 → 报红」各贴两段输出 + `md5` 比对)· **用了哪几个 fixture、mock 形状取自哪一层** ·
  **§9.9 五个条件两侧的用例清单** · **删除弹窗转不转 reka 的申报与理由** ·
  命中的每一条 K/N 编号申报 · 三门两个算式 · `knowledgeStyles.test.ts` 只加一行的自证。
- 拿不准 → 写 `NEEDS_CONTEXT` 并**停下**。

## 9. 提交

一刀 = 一个语义提交(`feat(kb): P5d T6 …`)。台账 `git add -f` 具体路径。
提交后 `git show --stat HEAD` + `git status` 自查。
