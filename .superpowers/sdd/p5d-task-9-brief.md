# P5d · T9 任务 brief —— 票 1 导航入口(**本期最高优先级**)+ 票 2 注释债 + K36 a11y 常驻断言

> **权威优先级:`p5d-coordinator-rulings-T0.md`(R1–R17)> `p5d-common-constraints.md` + P5a/P5b/P5c 治理
> > `p5d-plan.md` > 本 brief。** 🔴 **治理已查实 17 处错(E-31 ~ E-47),冲突处信裁定书。**

## 0. 必读顺序

1. `.superpowers/sdd/p5d-coordinator-rulings-T0.md` 全文(**最高**)
2. `p5a-` → `p5b-` → `p5c-` → **`p5d-common-constraints.md`** 全文
   (🔴 **§1.1 全期零改动清单** · **§15.1 票 1** · **§15.2 票 2** · **K7 反转不删** · **K36**)
3. `p5d-plan.md` 的 **§0 开工必读** 与 **§T9**
4. 本 brief

路径相对 `/home/nimo/NimoTech/.sp8/NimoOS-New-UI/`。**计划书 §T9 的 1–7 条是你的验收口径。**

## 1. 这一刀为什么最重要(**先理解意图,再动手**)

**知识库整区(P5a–P5c 建了三期)现在在产品里根本走不到** —— AI 设置页顶栏那个「详情」按钮是个
**弹「即将上线」toast 的占位 `<button>`**。前三期都漏了这件事,**用户至今无法从正常导航进入知识库**。
🔴 **本刀把它反转成真路由入口 `/ai/knowledge`**,整区才第一次可达。**这是本期唯一让用户看得见变化的一刀。**

## 2. 坐标与基线

| | 值 |
|---|---|
| 可写仓 | `/home/nimo/NimoTech/.sp8/NimoOS-New-UI`,分支 `sp8-ai` |
| **起点 HEAD** | **`71eab1f`**(T0–T8 **九刀全部关账**) |
| 改(**5 个文件,全在零改动清单上 → 本刀是显式解禁的例外**) | 票 1:`src/ai/views/SettingsPage.vue` · `SettingsPage.test.ts`<br>票 2:`src/ai/knowledge/parser/ParserStatus.test.ts` · `ParserTest.test.ts` · `src/ai/knowledge/views/SettingsView.test.ts` |
| 文件数 | **零新建 → 仍 331** · `.vue` 仍 **182** |
| 🔴 **三门基线(T8 后)** | **331 文件 / `3958` 例** · `vue-tsc` 0 · `vite build` 0 |

🔴 **五个文件都在治理 §1.1 的全期零改动清单上,本刀是「显式解禁」的例外。**
**每个文件只许改本 brief 指定的那几行。**
**报告要逐文件给「其余一字未动」的自证**(`git diff` 逐行 + 说明每个 `-` 行的存在理由)。
**要改这 5 个之外的任何文件 → 停下写 `NEEDS_CONTEXT`。**

## 3. 半一:票 1(治理 §15.1)—— **本期最高优先级**

### ① `SettingsPage.vue:417` 反转

从
```
<button class="set-detail-link" @click="onDetailsClick">
```
**反转回**
```
<router-link class="set-detail-link" to="/ai/knowledge">
```
🔴 **照 `knowledgeRoutes.ts` 那四次「反转不删、改前原文留成注释」的先例**(该文件 `:32-131` 有完整谱系,**去读**)。

🔴 **内容物一字不动**:`{{ t('aiCfgDetails') }} <AgentIcon name="chev" :size="12" />`
- **文案键仍是既有的 `aiCfgDetails`** → **本刀零 i18n 改动**(不碰 `src/i18n/**`);
- **图标仍是 `AgentIcon`,不是 `KIcon`**(这是设置区的组件,别换)。

### ② 视觉与样式一律不动

🔴 **`.set-detail-link` 类名不动**;**`settings-styles.scss:73-74` 一行不许动**
(它已含 `text-decoration: none` → 渲染成 `<a>` 后视觉一致)。**别为这次反转加任何样式。**

### ③ `onDetailsClick` 删掉,**原文留成注释**

(治理 §15.1 第 3 条的裁定。)🔴 **`DEFERRED_SECTIONS` 占位机制本身不许碰。**

### ④ `SettingsPage.test.ts:239` 那条用例必须改

它**现在断言弹 toast** → 改成断言 `.set-detail-link` 是一个 **`to="/ai/knowledge"` 的 `RouterLink`**。
🔴 **必配 RED 探针**:把产品代码改回占位 `<button>` + toast → **新断言必须报红** → 还原。**报告贴两段输出。**

### ⑤ 订正 `SettingsPage.vue:26-29` 那段注释

它现在还说「`/ai/knowledge` 要到 SP8-P5 才存在」—— 已经不成立了。
🔴 **改成「带时点的历史记录 + 现状 + 引治理条目编号」**:引「**治理 §15.1 / P5c §8.5**」,
**不引 `文件:行号`** —— 行号会随后续改动失效(这条教训 P5c 已登记)。
**`:415-416` 那两行占位注释一并订正。**

## 4. 半二:票 2(治理 §15.2)+ K36 a11y

### ⑥ 3 处过期注释(**只改注释**)

- **`ParserStatus.test.ts:206`** —— 🔴 **双重过期**:① 说「仍指占位页」**本刀之后已反**;
  ② 它引的 `knowledgeRoutes.ts:63` **行号已变成 `:78`**。
- **`ParserTest.test.ts:180`**
- **`SettingsView.test.ts:213`**

改法同 P5c T10 的注释轮(**引条目编号,不引行号**)。
🔴 **只改注释** —— **报告给「非注释行改动为 0」的自证**(`git diff` 逐行 + **三门数字与基线一致**)。

### ⑦ K36 a11y 常驻断言:补 **3 行**进 `SettingsView.test.ts`

钉 `aria-labelledby` 与 `.k-modal-title` 的 **`id` 同值同元素**(先例 `IndexedFilesView.test.ts:1947`)。
🔴 **强度要与 T6/T8 齐平** —— 它们的做法是:**直接读 `.k-modal-title` 元素自身的 `.id` 去比对 `labelId`**,
**并加 `[id]` 计数 = 1 排除多节点退化**。**照这个强度做,别只比字符串值。**
🔴 **必配一次变异证据**(去掉 `as-child` 或改 id → 必须报红)。
⚠️ **`SettingsView.test.ts` 只许加这 3 行 + 上面第 ⑥ 条那 1 行注释,其余一字不动。**

## 5. 常驻纪律

- 🔴 **探针/变异还原禁用 `git checkout -- <path>` / `git restore`** —— 只许「先 `cp` 存副本 → **行首锚定**注入 →
  **先证注入真落盘** → 用副本覆盖 → `md5sum` 逐字节比对」。
- 🔴 **凡 DoD 里带 🔴 的「复跑 / 复扫 / 独立复核」项,不许用「采信上一刀的结论」替代;
  要跳过必须先停下写 `NEEDS_CONTEXT` 申报 —— 事后在报告里写一句不算申报。**
- 🔴 **若发现 brief/计划书自相矛盾,或需要改这 5 个之外的文件 —— 停下写 `NEEDS_CONTEXT`,不许自行拍板**
  (T7 在这里被判过流程瑕疵,见裁定 R16)。
- 🔴 **注释里禁写色字面量**(§0.3;T7 修复轮已补守卫,裁定 R17)。本刀基本不涉色,但别在注释里引色值。
- **移植纪律**:界面严格 1:1(**本刀视觉必须零变化** —— 反转前后用户看到的按钮长得一模一样);**禁无关重构**。
- **零 `any`**;`vue-tsc` 0。
- 🔴 **禁部署**、禁写 `/var/lib`、禁 `git push`/`rebase`/`reset`/`stash`/`merge`、禁 `git add -A`/`git add .`。
- 🔴 别碰 `/home/nimo/NimoTech/NimoOS-New-UI` 与 `/home/nimo/NimoTech/.sp7/NimoOS-New-UI`(**并发会话**)。
- 🔴 **不要 kill 或重起任何 dev server**。不装依赖。
- **不碰** `src/i18n/**`(本刀零 i18n 改动)· `settings-styles.scss` · `src/ai/styles/**` ·
  `knowledgeRoutes.ts` / `deferred.ts`(**归 T10**)· **`knowledgeStore.ts`(全期零改动)**。

## 6. 三门

```bash
cd /home/nimo/NimoTech/.sp8/NimoOS-New-UI
pnpm test                      > /tmp/p5d-t9-test.log  2>&1; echo "exit=$?"
pnpm exec vue-tsc --noEmit     > /tmp/p5d-t9-tsc.log   2>&1; echo "exit=$?"
pnpm build                     > /tmp/p5d-t9-build.log 2>&1; echo "exit=$?"
```

**全量,输出完整落盘,不许 `| tail`。** 报告贴 `Test Files` / `Tests` 两行 +
**「3958 + 本刀新增 N = 实测值」的算式**(N 应很小:票 1 改 1 条 + K36 加 3 行;**文件数仍 331**)。
**已知噪声**(只它们红才复跑一次并说明,**不要顺手改**):`src/files/upload/persist.test.ts > … dropPersisted …` ·
`uploads.reattach-persist.test.ts` 的既有 stderr 噪声 · `AgentComposer.test.ts` 的 vue-i18n teardown 竞态。

## 7. 报告契约

- 全文写 `.superpowers/sdd/p5d-task-9-report.md`。**返回给协调者 ≤ 20 行。**
- 必须含:计划书 §T9 **1–7 条逐条** · 🔴 **逐文件的「其余一字未动」自证(5 个文件各一段,每个 `-` 行都要有理由)** ·
  **票 1 的 RED 探针两段输出**(改回 `<button>`+toast → 报红) · **K36 断言的变异证据 + 强度说明**
  (是否做到「元素身份 + `[id]` 计数=1」)· **`onDigestClick`/`onDetailsClick` 原文留成注释的位置** ·
  **`settings-styles.scss` 与 `src/i18n/**` 零改动的自证** · 命中的每一条 K/N 编号申报 · 三门算式。
- 🔴 **另请在报告里写一句给协调者的验收提示**:反转后从产品正常导航进入知识库的**完整点击路径**
  与**可直接粘贴的 URL**(协调者要写进验收清单第一项)。
- 拿不准 → 写 `NEEDS_CONTEXT` 并**停下**。

## 8. 提交

一刀 = 一个语义提交(`feat(kb): P5d T9 …`)。台账 `git add -f` 具体路径。
提交后 `git show --stat HEAD` + `git status` 自查。
