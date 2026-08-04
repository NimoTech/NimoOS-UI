# P5d · T8 任务 brief —— `NoteEditPane.vue` **下半**(侧栏 5 卡 + 标签编辑 + 冲突弹窗)

> **权威优先级:`p5d-coordinator-rulings-T0.md`(R1–R17)> `p5d-appendix-A/B/D` + `p5d-fixtures/` >
> `p5d-common-constraints.md` + P5a/P5b/P5c 治理 > `p5d-plan.md` > 本 brief。**
> 🔴 **治理已查实 17 处错(E-31 ~ E-47),冲突处信裁定书/附录/fixtures README。**

## 0. 必读顺序

1. `.superpowers/sdd/p5d-coordinator-rulings-T0.md` 全文(**最高;尤其 R16 / R17**)
2. `p5a-` → `p5b-` → `p5c-` → **`p5d-common-constraints.md`** 全文(**§4.1** · **§9.9** · **§3/§3.5** · **K7/K29/K36/K41**)
3. `p5d-plan.md` 的 **§0 开工必读** 与 **§T8**
4. 🔴 **`p5d-appendix-B-tokens.md`**(蓝本 `:152` 那处内联色换哪个 token 的**唯一权威**)·
   **`p5d-appendix-A-i18n.md`**(键名;**值只许来自 §A.2**)· **`p5d-fixtures/` 与 README**(**mock 唯一权威**)
5. 🔴 **T7 的成果与预警**:`.superpowers/sdd/p5d-task-7-report.md` + **`p5d-task-7-review.md`**
   (它给你留了一条明确预警,见本 brief §3)
6. 本 brief

路径相对 `/home/nimo/NimoTech/.sp8/NimoOS-New-UI/`。**计划书 §T8 的 DoD 1–11 是你的验收口径。**

## 1. 坐标与基线

| | 值 |
|---|---|
| 可写仓 | `/home/nimo/NimoTech/.sp8/NimoOS-New-UI`,分支 `sp8-ai` |
| **起点 HEAD** | **`76dcd8b`**(T0–T7 **八刀全部关账**) |
| 蓝本 | `git -C /home/nimo/NimoTech/NimoOS-UI show 7a6ee6b7:src/views/knowledge/components/NoteEditPane.vue`(**338 行**)。**禁读该仓工作树** · **永远禁 `checkout`/`stash`/`reset`** |
| 改 | `src/ai/knowledge/components/NoteEditPane.vue` · `NoteEditPane.test.ts` |
| 文件数 | **零新建 → 仍 331** · `.vue` 仍 **182**(收官值) |
| 🔴 **三门基线(T7 后)** | **331 文件 / `3923` 例** · `vue-tsc` 0 · `vite build` 0 |

## 2. 🔴 R16:**这两个函数 T7 已经实现了,不许重复实现**

- **`addTag()`** —— T7 已全量实现(纯逻辑、蓝本 1:1,评审核实不越界)。
- **`openConflict()`** —— T7 已实现**状态设置部分**(协调者裁定 **R16 追认**:计划书把它列在 T8,
  但 §T7 的 DoD-9 又要求 `save()` 的 catch 能到「conflict state 被设上」,**没有它 DoD-9 不可测** = 勘误 **E-46**)。
  🔴 **T8 只做冲突弹窗的 UI**,以及下半其余函数。
- **你要做的是**:为 `addTag()` 的去重行为**补齐 DoD-4 要求的用例**(若 T7 已覆盖,**核实并在报告说明**,不要重写实现)。

## 3. 🔴 T7 给你留的预警 + 「不许动 T7 断言」的正确做法

**计划书 §T8-11**:**T8 不许动 T7 的断言**;若某条 T7 用例因插入下半而「测错东西」,
那是**被迫改动**,要**逐处给 `git diff` 的 `-` 行自证**,并在报告写「除这 N 处外 T7 的东西一字未动」。

🔴 **T7 评审已明确预警一处隐性脆弱点**:
> `.kn-badge[data-s="draft"]` / `[data-s="archived"]` 两条断言 —— **你插入侧栏状态卡后会出现第二个同类元素**,
> `.find()` **巧合仍命中第一个(顶栏)且文案相同** → **测试大概率仍绿,但判别力已退化**。

**这一条要主动加固**(钉唯一祖先或 `data-testid`),**并在报告里说明这属于「加固而非改弱」** ——
给出「加固前 → 加固后」的对照,证明新定位器**更严**而不是更松。
⚠️ **「测试仍绿」不等于「没坏」** —— 这正是本刀最容易被放过的地方。

## 4. 本刀范围(蓝本)

侧栏(`:74-144`:状态卡 / 磁盘文件卡 / 属性卡 / 来源卡 / 被引用卡)· 冲突弹窗(`:148-180`)·
对应 script:`sourceRefs` / `focusTagInput` / `removeTag` / `onTagKey` / `refLabel` / `openRef` /
`openSessionRef` / `revealFile` / `copyPath` / `copyMine` / `adoptDisk` / `keepMine`。
(**`addTag` / `openConflict` 见 §2 —— 已存在。**)

## 5. 🔴 七个必须逐条兑现的点

### ① K41 的另一半(**禁 `as any`**)

- `Note.sourceRefs` 是 `unknown[]` → 本地 `interface SourceRef { path?: string; session_id?: string; label?: string }`;
- `service.notes.backlinks()` 返回 `unknown[]` → 本地 `interface Backlink { id: string; title: string }`。
- 🔴 **字段依据要引蓝本行**:`:128` 读 `r.path` · `:131` 读 `r.session_id` · `:132` 经 `refLabel` 读 `r.label` ·
  `:139-141` 读 `b.id` / `b.title`。**每处在文件头登记。**

### ② 数据契约

🔴 **`service.notes.backlinks` 返回**数组**(空时 `[]`),不是 `{backlinks:[]}` 信封**(治理 §4.1)。
🔴 **mock 形状一律取自 `p5d-fixtures/`,不许手编**(本档栽过三次裸信封 unwrap)。**搞反按 Critical。**

### ③ `onTagKey` 三条分支 + 一条反例

`Enter` / `,` → `preventDefault()` + `addTag()`;
`Backspace` **且输入框为空且已有标签** → 弹掉最后一个 + `dirty = true`。
**三条各一条用例 + 反例**(`Backspace` 但**输入框非空** → **不**弹)。

### ④ `addTag()` 的去重(DoD-4)

`parsed.filter(t => !form.tags.includes(t))`,**只有 `fresh.length` 才置 `dirty`** ——
**「输入一个已存在的标签 → `dirty` 不变」这条要有用例。**(实现已在 T7,见 §2。)

### ⑤ 冲突弹窗三个动作照抄语义(**`dirty` 的值都要断言**)

- **`adoptDisk()`**:`note = latest` + `form.body = latest.body || ''` + **`dirty = true`**(蓝本 `:321`);
- **`keepMine()`**:**只 rebase revision**(`note = {...note, revision: rev}`),**body 不动** + `dirty = true`
  + toast 带 `{n: rev}`(蓝本 `:324-330`,注释原文「Rebase onto the disk revision so the next save overwrites it」);
- **`copyMine()`**:`navigator.clipboard.writeText(form.body || '')`。

### ⑥ 🔴 `navigator.clipboard` 在 HTTP-IP 下**不存在**(治理 §9.9 / 记忆 `newui-clipboard-insecure-reka`)

`copyPath` 与 `copyMine` **真机会走 catch 弹「操作失败」**。
🔴 **按 N 系列照抄,不许顺手加 `execCommand` 兜底**(那是 Files 区的既有增强,不是笔记区蓝本行为)。
**但要**:① **一条 catch 分支用例**;② 报告里写明「HTTP 访问下弹操作失败 = 预期」(协调者会收进验收清单);
③ **开一张前端票**(写进报告)。

### ⑦ 冲突弹窗转 reka(**口径已由 T6 确立,直接对齐**)

- `DialogPortal to=".knowledge-app"`;**测试自己在 body 备宿主**(先例 `QueueView.test.ts:127-130` 的 `withHost()`)。
- 🔴 **`DialogTitle` 用 `as-child` 套在蓝本自己的 `.k-modal-title` 上,不加 `VisuallyHidden`** ——
  **K36 逐字适用**(本弹窗蓝本 `:155` 就有可见标题)。
- 🔴 **T6 的删除弹窗已转,且评审核准它跟的是 `SettingsView.vue` 先例**(**有可见标题 → `as-child`,
  不加 `VisuallyHidden`**),**不是** `QueueView.vue`(无可见标题)那套。**本刀对齐 `SettingsView.vue` 这一套。**
- **补 K36 a11y 常驻断言**:钉 `aria-labelledby` 与 `.k-modal-title` 的 **`id` 同值同元素**。
  ⚠️ **T6 的做法是标杆**:它**直接读 `.k-modal-title` 元素自身的 `.id` 去比对 `labelId`**,
  并**加 `[id]` 计数 = 1 排除多节点退化** —— **照这个强度做,别只比字符串值。**
  **必配一次变异证据**(去掉 `as-child` 或改 id → 必须报红)。

### ⑧ §9.9 可点性(每个条件**两侧**都要用例)

来源卡 `v-if="!isNew && sourceRefs.length"` · 被引用卡 `v-if="!isNew && backlinks.length"` ·
磁盘文件卡的 `<template v-else>`(即 `!isNew`)。
⚠️ **E-41 实测**:真机 23 条笔记**每条都有非空 `source_refs`** → 来源卡真机会渲染(治理原猜"通常不渲染"是错的)。

### ⑨ `refLabel(r)`:`r.label || String(r.session_id || '').slice(0, 8)` —— **三种输入都要用例。**

### ⑩ 缺口③:🔴 **本刀有 1 处模板内联色**

蓝本 `:152` 的 `style="… background: rgba(255,149,0,.14) …"` → **按附录 B 换成 token**,**断言要扫到**。
🔴 **申报注释里禁写那个色字面量** —— 引「蓝本 `:152`」+「附录 B §B.4 对应行」。
⚠️ **T7 修复轮刚补了一条守卫**:`KNOWLEDGE_VUE_FILES` 清单内文件的 **`<script>` 块注释**里出现色字面量会**报红**
(裁定 R17 / 勘误 E-47)。**你写申报注释时会撞上它 —— 照 T2/T7 的写法引行号即可。**

## 6. 常驻纪律

- 🔴 **探针/变异还原禁用 `git checkout -- <path>` / `git restore`** —— 只许「先 `cp` 存副本 → **行首锚定**注入 →
  **先证注入真落盘** → 用副本覆盖 → `md5sum` 逐字节比对」。
- 🔴 **凡 DoD 里带 🔴 的「复跑 / 复扫 / 独立复核」项,不许用「采信上一刀的结论」替代;
  要跳过必须先停下写 `NEEDS_CONTEXT` 申报 —— 事后在报告里写一句不算申报。**
- 🔴 **Vue watch 去重坑**(T4 栽过、复审证实):写「不重复触发」类用例时**回写值必须与初始值不同**,
  否则 `Object.is` 前置去重让回调**完全不执行**,守卫被整段删掉也照样绿。
  **判据永远是:拿掉产品代码的守卫,这条用例必须红。**
- ⚠️ **代码膨胀会被评审逐行追来历**(T3–T7 各查一次,五次都干净)。
- **移植纪律**:界面严格 1:1;Vue2 的 bug/竞态/吞错**不照抄**,改正确逻辑并按治理 §3 **申报登记**;**禁无关重构**。
- **零 `any`**;`vue-tsc` 0。只有 **K1–K45** 登记过的偏离才许做;**照抄不改**的是 **N1–N32**;其余**先申报再做**。
  🔴 **若发现 brief/计划书把某函数列进「不写」清单、却又在 DoD 里要求它的效果 —— 停下写 `NEEDS_CONTEXT`,
  不许自行拍板**(T7 就在这里被判了流程瑕疵,见 R16)。
- 🔴 **禁部署**、禁写 `/var/lib`、禁 `git push`/`rebase`/`reset`/`stash`/`merge`、禁 `git add -A`/`git add .`。
- 🔴 别碰 `/home/nimo/NimoTech/NimoOS-New-UI` 与 `/home/nimo/NimoTech/.sp7/NimoOS-New-UI`(**并发会话**)。
- 🔴 **不要 kill 或重起任何 dev server**。不装依赖。
- **不碰** `src/i18n/**` · `src/ai/styles/**`(**含 `knowledgeStyles.test.ts` —— 本刀零新建 `.vue`,无需登记**)·
  `util/**` · `NotesMarkdownEditor.*` · `openInApp.*` · `NotesView.*` · **`knowledgeStore.ts`(全期零改动)**。

## 7. 三门

```bash
cd /home/nimo/NimoTech/.sp8/NimoOS-New-UI
pnpm test                      > /tmp/p5d-t8-test.log  2>&1; echo "exit=$?"
pnpm exec vue-tsc --noEmit     > /tmp/p5d-t8-tsc.log   2>&1; echo "exit=$?"
pnpm build                     > /tmp/p5d-t8-build.log 2>&1; echo "exit=$?"
```

**全量,输出完整落盘,不许 `| tail`。** 报告贴 `Test Files` / `Tests` 两行 +
**「3923 + 本刀新增 N = 实测值」的算式**(文件数应仍 **331**)。
**已知噪声**(只它们红才复跑一次并说明,**不要顺手改**):`src/files/upload/persist.test.ts > … dropPersisted …` ·
`uploads.reattach-persist.test.ts` 的既有 stderr 噪声 · `AgentComposer.test.ts` 的 vue-i18n teardown 竞态。

## 8. 报告契约

- 全文写 `.superpowers/sdd/p5d-task-8-report.md`。**返回给协调者 ≤ 20 行。**
- 必须含:§T8 **DoD 1–11 逐条** · 🔴 **「除 N 处被迫改动外 T7 的东西一字未动」的自证**
  (被迫改动逐处给 `git diff` 的 `-` 行 + **「加固而非改弱」的对照**)· **K36 a11y 断言的变异证据** ·
  **内联色 token 化 + 断言扫到的证据(必配 RED 探针)** · **K41 逐处登记与字段依据** ·
  **clipboard 那张前端票的原文** · 用了哪几个 fixture、mock 形状取自哪一层 ·
  命中的每一条 K/N 编号申报 · 三门算式。
- 拿不准 → 写 `NEEDS_CONTEXT` 并**停下**。

## 9. 提交

一刀 = 一个语义提交(`feat(kb): P5d T8 …`)。台账 `git add -f` 具体路径。
提交后 `git show --stat HEAD` + `git status` 自查。
