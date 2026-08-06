# P5d · T4 任务 brief —— tiptap 依赖(K37/§14)+ `NotesMarkdownEditor.vue`

> **权威优先级:`p5d-coordinator-rulings-T0.md`(R1–R15)> `p5d-appendix-D-classes.md`(§D.6)
> > `p5d-common-constraints.md` + P5a/P5b/P5c 治理 > `p5d-plan.md` > 本 brief。**
> 🔴 **T0/T1 已查实治理有 15 处错(E-31 ~ E-45),其中 E-36 直接改写本刀的装包版本。冲突处信裁定书。**

## 0. 必读顺序

1. `.superpowers/sdd/p5d-coordinator-rulings-T0.md` 全文(**最高;尤其 R2 装包版本**)
2. `p5a-common-constraints.md` → `p5b-` → `p5c-` → **`p5d-common-constraints.md`** 全文(**§14 装依赖五条** · **§5.3** · **§9.7**)
3. `p5d-plan.md` 的 **§0 开工必读** 与 **§T4**
4. 🔴 **`p5d-appendix-D-classes.md` 的 §D.6 全节**(tiptap 可测性结论 + §D.6.3 版本终值表)
5. 本 brief

路径相对 `/home/nimo/NimoTech/.sp8/NimoOS-New-UI/`。**计划书 §T4 的 DoD 1–7 是你的验收口径。**

## 1. 坐标与基线

| | 值 |
|---|---|
| 可写仓 | `/home/nimo/NimoTech/.sp8/NimoOS-New-UI`,分支 `sp8-ai` |
| **起点 HEAD** | **`d144cf6`**(T0 `cc6d7c8`+`03db682` · T1 `56f8849` · T2 `f128450` · T3 `e48b09a`+`d144cf6`,**四刀全部关账、评审 clean**) |
| 蓝本 | `NimoOS-UI`@**`7a6ee6b7`**:`git -C /home/nimo/NimoTech/NimoOS-UI show 7a6ee6b7:src/views/knowledge/components/NotesMarkdownEditor.vue`(**47 行**,T0 已核)。**禁读该仓工作树** · **永远禁 `checkout`/`stash`/`reset`** |
| 改 | `package.json` · `pnpm-lock.yaml`(治理 §1.1 **已显式解禁这两个**) |
| 新建 | `src/ai/knowledge/components/NotesMarkdownEditor.vue` · `NotesMarkdownEditor.test.ts` |
| 文件数 | **328 → 329** · `.vue` **179 → 180** · color-guard **+1** |
| 🔴 **三门基线(T3 后)** | **328 文件 / `3595` 例** · `vue-tsc` 0 · `vite build` 0。**不是计划书写的 3515** |
| 其它基线 | 全表键数 **1595 / 1595** · `aiKb*` **387** · `KIcon.PATHS` **42**(E-35) |
| 可用依赖 | **T3 已交付** `src/ai/knowledge/util/notesViewHelpers.ts`(`NOTE_TYPES` 等)与 `noteEditHelpers.ts`;**T2 已把本组件的样式搬进 `knowledge.scss`** |

## 2. 🔴 装依赖(裁定 R2 覆盖治理 K37/A-7)

**四个包,锁 v2 线:**

```
@tiptap/vue-3@^2.27.2 · @tiptap/starter-kit@^2.27.2 · @tiptap/pm@^2.27.2 · tiptap-markdown@^0.8.10
```

- 🔴 **`tiptap-markdown` 是 `^0.8.10`,不是治理/计划书写的 `^0.6.1`** ——
  **E-36 实测**:蓝本 `package.json:74` 就是 `^0.8.10`,锁文件解析 `0.8.10`(peer `@tiptap/core ^2.0.3`)。
  装 `0.6.1` = **拿蓝本从未跑过的版本做 1:1 移植,正好反转 K37 的初衷**。`0.8.10` 仍在 v2 线。
  ⚠️ **治理 §14-1 里「四个都要是 `2.x`/`0.6.x`」的期望串按裁定 R2 应读作 `2.x`/`0.8.x`** ——
  **别照旧口径把自己判红。**
- 🔴 **装成 3.x 按 Critical**(`tiptap-markdown@0.9.0` 的 peer 是 `@tiptap/core@^3.0.1`)。
- **不装** `@tiptap/core`(peer,pnpm 自动装)· `extension-highlight` · `extension-typography`
  —— 蓝本有这三个直接依赖,但**本期三个蓝本文件里 `Highlight`/`Typography` 零引用**(T0 与评审均已复核)。
- **落地要求**:`pnpm list` 核实真实解析版本是 `2.x`/`0.8.x` · `git diff package.json` **只有四行新增** ·
  **报告贴 `pnpm list` 输出 + `git diff --stat package.json pnpm-lock.yaml`**。
- 🔴 **装完必须 kill 重起 dev server `:5288`**(§14-3;记忆 `nimoos-service-pnpm-drift`:**Vite 预打包缓存不看内容,会喂旧包** —— P5b T11 已栽过一次)。
  **当前 `:5288` 由协调者刚重起,pid 会变 —— 用 `ss -ltnp | grep 5288` 或 `pgrep -af "vite.*5288"` 现查,别把 pid 写进报告当结论。**
  🔴 **只许动 5288**:`:5277` 是 SP7 并发会话、`:5299` 是 NimoOS-Web,**一个都不许碰**。
- 🔴 **`vite.config.ts` 里的 `optimizeDeps.exclude` 别删**(它堵的正是「dev server 喂旧共享包」那个坑)。

## 3. 🔴 组件的四条硬要求(**每条都要有「拿掉就报红」的判据**)

### ① K38 三件事

- `@tiptap/vue-2` → **`@tiptap/vue-3`** · `beforeDestroy` → **`onBeforeUnmount`** ·
  v-model 契约 `value`/`input` → **`modelValue`/`update:modelValue`,且**保留** `input` 事件**。
- 🔴 **`input` 必须保留**:父组件(T7)写的是
  `<NotesMarkdownEditor v-model="form.body" @input="dirty = true"/>` ——
  **Vue 3 里 `@input` 是另一个监听器**,子组件必须**同时**发两个 emit,否则「打字后标记为脏」这个行为会丢。
- 🔴 **判据:两个 emit 各一条用例,拿掉任一条必须报红**(报告贴变异证据)。

### ② §5.3 防回环不许删

- `watch modelValue` 里**先比对** `editor.storage.markdown.getMarkdown()` **再** `setContent(v)`。
- 🔴 **判据:一条「父组件把同一个 markdown 值写回来时 `setContent` 不被调用」的用例**(拿掉比对 → 必须报红)。

### ③ `onTransaction` → `emit('transaction')`;`mounted` 末尾 `emit('ready', editor)`

- 这两个是 **N29**(父组件工具栏 active 态)与 `cmd()` 的生命线,**顺序照抄蓝本**。

### ④ K44:`.vue` 侧**零 `<style>` 块**

- 样式 T2 已进 `knowledge.scss`(含顶层 `.nme-content .ProseMirror` 例外段)。
- 🔴 **JS 侧不需要 side-effect import** —— `knowledge.scss` 由 `KnowledgeLayout.vue` **早已 import**。
  **与 P5c 的 `parser-styles.scss` 不同,别照抄那条 import。报告要显式说明为什么不需要。**

## 4. 🔴 测试写法:**用真 `Editor`,不需要 mock**(T0 §D.6 结论,经独立评审复核)

- T0 在隔离工程里实测 5 个探针:真挂载 · `storage.markdown.getMarkdown()` · `isActive` ·
  `chain().focus()[cmd]().run()` · `onUpdate`/`onTransaction` · `setContent` ·
  真 SFC 渲染出 `.tiptap.ProseMirror` · 防回环可测 · `destroy` 可 spy —— **全部工作**。
  评审**重跑过一遍**(`@tiptap/*@2.27.2` + `tiptap-markdown@0.8.10`),结论一致。
- ⚠️ **裁定 R5:§D.6.1 对 N29 只证了前提、没实证整条链路**(探针只挂了编辑器 SFC,
  没挂父组件的 `tbActive` + `tbTick` + `@transaction` → `data-on` 翻转)。
  **T4/T7 不许引 §D.6.1 当已证** —— 本刀凡涉及 `transaction` 的断言,**要自己附变异证据**。
- **缺口③**:补一条「`<template>` 块零裸色」定向断言(本文件模板极短,但**照惯例补**)。

## 5. 移植纪律与禁止事项

- **界面/行为严格 1:1**(版式/结构/DOM 顺序/属性顺序逐字照蓝本);**Vue2 的 bug/竞态/吞错不照抄**,
  改正确逻辑并按治理 §3 申报登记;**禁无关重构**。
  ⚠️ **代码膨胀会被评审逐行追来历**(T3 就被查过):TS 类型标注与 K 系列申报注释是正当的,
  **蓝本没有的新逻辑 / 被"修正"的行为 / 顺手抽的抽象 = 缺陷**。
- 🔴 **一切可见颜色必须是 `var(--…)`**;禁 `#hex`/`rgb()`/`rgba()`/具名色(`white`/`black` 也算);**注释里也不许有**。
- **零 `any`**;`vue-tsc` 0。只有 **K1–K45** 登记过的偏离才许做;**照抄不改**的是 **N1–N32**;其余**先申报再做**。
- 🔴 **禁部署**、禁写 `/var/lib`、禁 `git push`/`rebase`/`reset`/`stash`/`merge`、禁 `git add -A`/`git add .`。
- 🔴 别碰 `/home/nimo/NimoTech/NimoOS-New-UI` 与 `/home/nimo/NimoTech/.sp7/NimoOS-New-UI`(**并发会话**)。
- `.sp8/NimoOS-Service` 零改动;**不需要跨仓 `pnpm build`**(裁定 R12)。
- **不碰** `src/i18n/**`(T1 关账)· `src/ai/styles/**`(T2 关账)· `src/ai/knowledge/util/**`(T3 关账)·
  `openInApp.ts`(归 T5)。

## 6. 三门

```bash
cd /home/nimo/NimoTech/.sp8/NimoOS-New-UI
pnpm test                      > /tmp/p5d-t4-test.log  2>&1; echo "exit=$?"
pnpm exec vue-tsc --noEmit     > /tmp/p5d-t4-tsc.log   2>&1; echo "exit=$?"
pnpm build                     > /tmp/p5d-t4-build.log 2>&1; echo "exit=$?"
```

**全量,输出完整落盘,不许 `| tail`。** 报告贴 `Test Files` / `Tests` 两行 +
**「328 + 1 = 329 文件」与「3595 + 本刀新增 N = 实测值」两个算式**。
⚠️ **装了新依赖后首次 `pnpm test` / `pnpm build` 会变慢**,属正常。
**已知噪声**(只它们红才复跑一次并说明,**不要顺手改**):`src/files/upload/persist.test.ts > … dropPersisted …`
(IndexedDB flaky)· `AgentComposer.test.ts` 的 vue-i18n teardown 竞态。包管理器 **`pnpm`**,勿用 yarn/npm。

## 7. 报告契约

- 全文写 `.superpowers/sdd/p5d-task-4-report.md`。**返回给协调者 ≤ 20 行。**
- 必须含:§T4 DoD **1–7 逐条** · **`pnpm list` 真实解析版本** + `git diff --stat package.json pnpm-lock.yaml` ·
  **§3 四条各自的变异证据**(两个 emit 各拿掉一次 / 防回环拿掉比对 / transaction)·
  **「为什么不需要 side-effect import `knowledge.scss`」的显式说明** · **dev server 重起的现查证据**
  (`ss -ltnp | grep 5288`,**别把 pid 当结论**)· 命中的每一条 K/N 编号申报 · 三门两个算式。
- 🔴 **探针/变异还原禁用 `git checkout -- <path>` / `git restore`** —— 只许「先 `cp` 存副本 → 注入 →
  用副本覆盖 → `md5sum` 逐字节比对」;**注入要行首锚定并先证注入真落盘**。
- 🔴 **常驻纪律**:**凡 DoD 里带 🔴 的「复跑 / 复扫 / 独立复核」项,不许用「采信上一刀的结论」替代;
  要跳过必须先停下写 `NEEDS_CONTEXT` 申报 —— 事后在报告里写一句不算申报。**
- 拿不准 → 写 `NEEDS_CONTEXT` 并**停下**。

## 8. 提交

一刀 = 一个语义提交(`feat(kb): P5d T4 …`)。台账 `git add -f` 具体路径。
提交后 `git show --stat HEAD` + `git status` 自查。
🔴 **碰 gitignore 产物(`dist/`、`node_modules/`)时 `git status` 不构成任何证据**。
