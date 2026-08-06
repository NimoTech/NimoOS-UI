# P5d · T10 任务 brief —— 路由反转 + `DEFERRED_TABS` 摘 `notes` + **收官**

> **权威优先级:`p5d-coordinator-rulings-T0.md`(R1–R17)> `p5d-common-constraints.md` + P5a/P5b/P5c 治理
> > `p5d-plan.md` > 本 brief。** 🔴 **治理已查实 18 处错(E-31 ~ E-48),冲突处信裁定书。**

## 0. 必读顺序

1. `.superpowers/sdd/p5d-coordinator-rulings-T0.md` 全文(**最高**)
2. `p5a-` → `p5b-` → `p5c-` → **`p5d-common-constraints.md`** 全文(**§8.1 算术** · **§15.1** · **K7 反转不删**)
3. `p5d-plan.md` 的 **§0 开工必读** 与 **§T10**
4. 本 brief

路径相对 `/home/nimo/NimoTech/.sp8/NimoOS-New-UI/`。**计划书 §T10 的 1–7 条是你的验收口径。**

## 1. 这一刀干什么

前九刀把笔记区**建好了**,但 **`/ai/knowledge` 左栏第 4 项「笔记」现在仍然是占位页** ——
`notes` 子路由还映射到 `KnowledgeDeferred`。**本刀把它反转成真 `NotesView`,笔记区才第一次真正可达。**
T9 已把「详情」入口接通(`/ai/knowledge` 能进了),**本刀是最后一环**。

## 2. 坐标与基线

| | 值 |
|---|---|
| 可写仓 | `/home/nimo/NimoTech/.sp8/NimoOS-New-UI`,分支 `sp8-ai` |
| **起点 HEAD** | **`19fa973`**(T0–T9 **十刀全部关账**) |
| 改 | `src/ai/knowledge/deferred.ts` · `knowledgeRoutes.ts` · `knowledgeRoutes.test.ts` · `deferred.test.ts` |
| 文件数 | **零新建 → 仍 331**(收官值)· `.vue` 仍 **182**(收官值) |
| 🔴 **三门基线(T9 后)** | **331 文件 / `3958` 例** · `vue-tsc` 0 · `vite build` 0 |
| 其它基线 | 全表键数 **1595 / 1595** · `aiKb*` **387** · `KIcon.PATHS` **42**(E-35) |

## 3. 四件事(计划书 §T10 的 1–4 条)

### ① `DEFERRED_TABS` 摘 `'notes'`:5 → 4

`deferred.ts:28-34`,摘掉后剩 **`search` / `wiki` / `roots` / `allowlist`**。
按 **T12 / P5b T5 / P5b T10 / P5c T10 的先例**在文件头加本期注释。

### ② `notes` 子路由反转成真组件

`knowledgeRoutes.ts:74` 的 `KnowledgeDeferred` → 真 **`NotesView`**;**import 加在 `:52-60` 那组**。

### ③ 两条断言反转(**协调者实测坐标**)

- **`deferred.test.ts:46-47`**:
  `expect([...DEFERRED_TABS].sort()).toEqual(['allowlist','notes','roots','search','wiki'])`
  → 改成 **4 项** `['allowlist','roots','search','wiki']`;
- **`knowledgeRoutes.test.ts`** 的「其余子路由仍是 `KnowledgeDeferred`」那条
  (**该文件 `:32-131` 已有四代改前原文注释的完整谱系,去读、照那个格式**)→ **反转 `notes` 那一项**。

🔴 **反转,不删**;**改前原文留成注释 + 写清为什么**(引条目编号,**不引 `文件:行号`** —— 行号会失效,E-48 同族教训)。
🔴 **K7 占位机制本身保留**(承 P4 I2 教训:清空后要仍有用例证明它**有能力**)——
**`deferred.test.ts:60-69` 的「机制钉子」用例一字不许动。**

### ④ 🔴 在 `deferred.ts` 文件头**逐项写明剩下 4 个占位项归哪一期反转**

`search` → **P5e**;`wiki` / `roots` / `allowlist` → **P5f**。
**这是「跨期占位烂尾」这类债的制度性堵法,不是可选项**(兑现治理 §15.1 的通用教训 ——
本期票 1 就是「三期都漏了导航入口」的后果)。

## 4. 🔴 本刀的额外门:**构建管线核验**(承 P5c E-13,**最容易做成不可伪证的一步**)

`.vue` 文件**光「存在且写了 import」进不了产物** —— 它还得**被入口可达地 import**。
所以本刀要证明「反转之后,笔记区的代码真的进了打包产物」。

🔴 **必须先抓「改之前搜不到」的证据,再改** —— 顺序反了,这条证明就不成立(**「之后能搜到」单独存在毫无意义**):

1. **改动前**:`pnpm build` → 对 `dist/assets/*.js` 做判据搜索 → **应搜不到**。**贴输出。**
2. **改动后**:`pnpm build` → 同样的判据 → **必须命中**。**贴输出。**

🔴 **判据必须选择器/上下文感知**(承 **E-25**:裸子串会同时命中注释与真代码,做出**假结论**)——
计划书给的起点是 `grep -o "kn-inbox-chev\|NotesMarkdownEditor" dist/assets/*.js`,
**但你要自己确认这个判据在本仓真的能区分「真代码」与「注释/字符串」**;不行就换一个更硬的判据并说明理由。

⚠️ 🔴 **别把 CSS 与 JS 混为一谈**(P5c **E-8**):
**CSS 侧从 T2 起就已经在产物里**(`knowledge.scss` 由 `KnowledgeLayout.vue` 早已 import)——
所以 `grep kn-note-row dist/assets/*.css` **在 T2 之后就命中了,它不能用来证明 JS 侧可达**。**本门只看 JS。**

## 5. 收官口径(报告必须给全)

- **文件数 331** · **用例数**(3958 + 本刀新增)· 🔴 **`.vue` 182** · 🔴 **color-guard `+3` 已体现**
  (新增三个 `.vue`:`NotesMarkdownEditor` / `NotesView` / `NoteEditPane` → 179 → 182)·
  **`aiKb*` 键数 387** · **全表键数 1595 / 1595**。
- **本期新增依赖四个包**(`@tiptap/vue-3` / `starter-kit` / `pm` **2.27.2** + `tiptap-markdown` **0.8.10**)。
- 🔴 **逐项实测,不许用算式推**(本期已因「实测优先于算式」抓到过东西)。**每个数字附取数命令。**

## 6. 常驻纪律

- 🔴 **探针/变异还原禁用 `git checkout -- <path>` / `git restore`** —— 只许「先 `cp` 存副本 → **行首锚定**注入 →
  **先证注入真落盘** → 用副本覆盖 → `md5sum` 逐字节比对」。
- 🔴 **凡带 🔴 的「复跑 / 复扫 / 独立复核」项,不许用「采信上一刀的结论」替代;
  要跳过必须先停下写 `NEEDS_CONTEXT` 申报 —— 事后在报告里写一句不算申报。**
- 🔴 **若 brief/计划书自相矛盾,或需要改本 brief 未授权的文件 —— 停下写 `NEEDS_CONTEXT`,不许自行拍板**
  (T7 在这里被判过流程瑕疵,见裁定 R16)。
- 🔴 **注释里禁写色字面量**(§0.3 / R17 守卫已上线)。
- **零 `any`**;`vue-tsc` 0;**禁无关重构**。
- 🔴 **禁部署**、禁写 `/var/lib`、禁 `git push`/`rebase`/`reset`/`stash`/`merge`、禁 `git add -A`/`git add .`。
- 🔴 别碰 `/home/nimo/NimoTech/NimoOS-New-UI` 与 `/home/nimo/NimoTech/.sp7/NimoOS-New-UI`(**并发会话**)。
- 🔴 **不要 kill 或重起任何 dev server**(收官后由**协调者**重起 `:5288`)。不装依赖。
- **不碰** 本 brief §2 「改」栏之外的任何文件 —— 尤其 `src/i18n/**` · `src/ai/styles/**` · `util/**` ·
  三个新 `.vue` 及其测试 · `SettingsPage.*`(T9 已关账)· **`knowledgeStore.ts`(全期零改动)**。

## 7. 三门 + 额外门

```bash
cd /home/nimo/NimoTech/.sp8/NimoOS-New-UI
pnpm test                      > /tmp/p5d-t10-test.log  2>&1; echo "exit=$?"
pnpm exec vue-tsc --noEmit     > /tmp/p5d-t10-tsc.log   2>&1; echo "exit=$?"
pnpm build                     > /tmp/p5d-t10-build.log 2>&1; echo "exit=$?"
```

**全量,输出完整落盘,不许 `| tail`。** 报告贴 `Test Files` / `Tests` 两行 +
**「3958 + 本刀新增 N = 实测值」的算式**。
**已知噪声**(只它们红才复跑一次并说明,**不要顺手改**):`src/files/upload/persist.test.ts > … dropPersisted …` ·
`uploads.reattach-persist.test.ts` 的既有 stderr 噪声 · `AgentComposer.test.ts` 的 vue-i18n teardown 竞态。

## 8. 报告契约

- 全文写 `.superpowers/sdd/p5d-task-10-report.md`。**返回给协调者 ≤ 20 行。**
- 必须含:计划书 §T10 **1–7 条逐条** · 🔴 **构建管线门的「改前搜不到 / 改后命中」两段输出**
  + **你用的判据以及它为什么是上下文感知的** · **「反转不删」的注释位置与格式** ·
  **`deferred.test.ts:60-69` 机制钉子用例一字未动的自证** · **`deferred.ts` 文件头 4 个占位项归属的原文** ·
  🔴 **§5 收官口径逐项实测值 + 取数命令** · 命中的每一条 K/N 编号申报 · 三门算式 ·
  **每个被改文件「其余一字未动」的自证**。
- 🔴 **另请给协调者两样东西**(写在报告末尾,我要用来写验收清单):
  1. **从产品正常导航走到「笔记」那一屏的完整点击路径 + 可直接粘贴的 URL**(含**新建笔记**与**打开某条笔记**两个深链形态);
  2. **本期你知道的、验收时会真的写后端/改设备状态的操作清单**(笔记的增删改会在 `/DATA/Notes` 真的动 `.md` 文件)。
- 拿不准 → 写 `NEEDS_CONTEXT` 并**停下**。

## 9. 提交

一刀 = 一个语义提交(`feat(kb): P5d T10 …`)。台账 `git add -f` 具体路径。
提交后 `git show --stat HEAD` + `git status` 自查。
