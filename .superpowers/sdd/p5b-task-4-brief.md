# P5b · T4 任务书 —— `util/queueView.ts` 三个纯函数

## 你在哪

NimoOS 的 Vue2 → Vue3 整库迁移,第 8 期(SP8,AI 区)第 5 阶段第 b 批(P5b):把知识库的
**「已收录文件」页**与**「任务队列」页**从 Vue2 迁到 New-UI。T0–T10 单车道串行。

**你是 T4,只从蓝本 `QueueView.vue` 里抽三个纯函数出来单独成文件并测透。**
下一个任务 T5 会搬整个 `QueueView.vue`,直接 import 你这三个。
纯函数先于消费者落地,是为了让 T5 的组件测试不用再去覆盖这些分支。

**这是本批最小、最机械的一个任务** —— 但「机械」不等于「随便」:蓝本这三个函数里有
**三处看起来像 bug 的行为,全都要照抄**(见下)。

## 你的权威输入

1. **治理文件**:`/home/nimo/NimoTech/.sp8/NimoOS-New-UI/.superpowers/sdd/p5b-common-constraints.md`
   —— 全批共同约束。**先通读**,尤其 §1(工作区 + 全期零改动清单)· §2(移植纪律)· §3(K9–K20,**你落的是 K12**)·
   §3.5(N9–N14 照抄条)· §5(代码范式,含 `src/ai/knowledge/{views,util}` 的相对路径表)· §8(测试门)·
   §9(测试质量)· §10(报告契约)
2. **Vue2 蓝本**:仓库 `/home/nimo/NimoTech/NimoOS-UI`,`git show main:<QueueView.vue 路径>`
   (确切路径见治理文件 §1)。**那个工作树只读,禁止改 / 提交 / checkout / stash / restore。**
3. **既有同类先例**:本仓 `src/ai/knowledge/util/` 下 P5a 已经落的那几个 util 文件
   (`indexedFiles.ts` / `dashboardHelpers.ts` 及其测试)—— **照它们的文件组织、导出风格、测试写法**,
   别自己另发明一套。🔴 这两个文件本身属治理 §1.1 的**全期零改动清单,只读不改**。

## 新建哪两个文件

- `src/ai/knowledge/util/queueView.ts`
- `src/ai/knowledge/util/queueView.test.ts`

**只这两个。** 不改任何既有文件,不碰 `.vue`,不碰 store,不碰 i18n,不碰 scss。

## 要抽哪三个函数(K12)

从蓝本 `QueueView.vue` 的 **`:393-404`**:

| 函数 | 蓝本行 | 签名 |
|---|---|---|
| `distillIconState` | `:393-397` | `(row) => 'pending' \| 'running' \| 'failed'` |
| `basename` | `:398` | `(p) => string` |
| `dirname` | `:399-404` | `(p) => string` |

🔴 **逐字等价蓝本**。先 `git show main:` 把这 12 行原文拉出来,贴进报告,再照着写。

**必须照抄的三处「看起来像 bug」的行为**(治理 §2 的移植纪律:界面/行为 1:1,
蓝本自身的怪行为属照抄条 —— 这三处 T0 已在计划期核过):

1. **`distillIconState`**:`failed` 与 `skipped` **共用 danger 色**(都落 `'failed'`)。
   未知 / 缺省 status 也落 `'failed'`(不是 `'pending'`)—— 以蓝本实际写法为准,自己核。
2. **`basename`**:兜底是 `p.split('/').filter(Boolean).pop() || p`;空值返 **`'—'`**(U+2014 破折号,不是 `-`)。
3. **`dirname`**:返回 `'/' + parts.join('/') + '/'`。因此
   **空路径返 `''`、单段路径返 `'//'`** —— 这是蓝本行为,**照抄,不许"顺手改对"**。

🔴 如果你 `git show` 出来的实际代码与我上面写的有出入,**以蓝本为准**,并在报告里指出差异
(那就是任务书的错,不是你的);拿不准就返回 `NEEDS_CONTEXT` 问我。

## K11 —— `fmtAgo` 不要抽到这里

蓝本 `QueueView.vue` 里还有个 `fmtAgo`,**不抽**。T5 会直接
`import { fmtAgo } from '../stores/knowledgeStore'`(store 里已有等价实现,P5a 落的)。
你不要顺手把它搬过来,也不要在 `queueView.ts` 里重新实现一份。

## 测试要求

- **每个函数的每条分支两侧都要有用例**:
  - `dirname` / `basename`:**空串 / 单段 / 多段 / 尾斜杠**(以及 `null`/`undefined` 若蓝本会收到)
  - `distillIconState`:**三个 status 各一 + 未知 status 落 `'failed'`**
- 断言要**钉死确切返回值**(`toBe('//')` 这种),不是 `toBeTruthy()` / `toBeDefined()` 之类的松形式
- 上面那三处「照抄的怪行为」**每一处都要有一条专门的用例把它钉死**,
  并在用例名或注释里注明「蓝本 `<file>:<line>` 的行为,照抄不改」
  —— 否则将来有人「顺手改对」不会有人报红

## 测试门(提交前必须三门全过)

```
pnpm test                      # 全量
pnpm exec vue-tsc --noEmit     # 0 错
pnpm build                     # 通过
```

**基线(协调者实测)**:见本文件末尾「起点」。你的预期增量:**+1 文件,+12~15 例**。
实测多少报多少,差了要解释。

已知噪声(只它们红才复跑一次并说明,别去修):
`src/files/upload/persist.test.ts > dropPersisted …`(既有 IndexedDB flaky)· `AgentComposer.test.ts` 的 vue-i18n teardown 竞态。

## DoD

- 三门全绿
- 三个函数与蓝本 `:393-404` **逐字等价**(报告里贴蓝本原文 + 落地代码对照)
- 每条分支两侧都有钉死确切值的用例
- 三处「照抄的怪行为」各有一条专门用例 + 注释
- `fmtAgo` **确实没被抽过来**

## 🔴 RED 探针(至少 2 次,每次贴「改了什么 → 哪个用例报红 → 报红文本」,然后**改回来**并确认 `git status --short` 干净)

1. 删掉 `distillIconState` 的 `running` 分支 → 精确报红
2. 删掉 `dirname` 里的 `filter(Boolean)` → 精确报红

**建议再加一次**(不强制但很有价值):把 `dirname` 的单段路径行为从 `'//'` "改对"成 `'/'`
→ 确认那条「照抄」用例会报红(证明照抄条真的被钉住了)。

## 硬约束(治理文件有全文,这里只挑最要命的)

- 可写仓只有 `/home/nimo/NimoTech/.sp8/NimoOS-New-UI`(分支 `sp8-ai`)
- `/home/nimo/NimoTech/NimoOS-UI` **只读,且是多会话共享的检出**,只能 `git show main:<path>`
- `NimoOS-New-UI`(SP6/SP9)与 `.sp7/NimoOS-New-UI`(SP7)**禁碰**
- 治理 §1.1 的**全期零改动清单**一个都不许碰(含 `util/indexedFiles.ts` 与 `util/dashboardHelpers.ts`
  —— 你可以**读**它们学写法,但不许改)
- 禁 `git add -A` / `git add .` —— **只用显式 pathspec**;禁 rebase / reset / stash / merge / push
- 不跑 `./scripts/deploy.sh`,不写 `/var/lib`
- **界面/行为 1:1 照抄 Vue2**;但 Vue2 的 bug / 竞态 / 吞错**不照抄**,改正确并注释登记。
  🔴 **本任务这三处是「照抄」那一类,不是「改正确」那一类** —— 它们是**渲染结果**的一部分
  (图标颜色 / 路径显示文案),改了界面就不 1:1 了。
  遇到治理文件没登记过的同类情况,**停下返回 `NEEDS_CONTEXT` 问我**,别自己拍。

## 提交

`git add -f` 逐个显式路径(两个新文件 + 报告),**一次 commit**。

## 报告契约

**完整报告写进** `/home/nimo/NimoTech/.sp8/NimoOS-New-UI/.superpowers/sdd/p5b-task-4-report.md`:
蓝本 `:393-404` 原文 + 落地代码逐行对照 · 三处照抄行为各自的用例位置 · 分支覆盖表(每条分支两侧的用例)·
RED 探针的原始报红文本 · 三门实测数字 · 与任务书描述不一致的地方(如有)· 遗留疑问。

**返回给我的正文 5 行以内**:状态(`DONE` / `DONE_WITH_CONCERNS` / `NEEDS_CONTEXT` / `BLOCKED`)·
commit 短哈希 · 三门一行数字 · 蓝本对照是否逐字等价 · 最要紧的 1–2 个 concern。**不要把报告正文贴回来。**

## 起点

分支 `sp8-ai` · **BASE 与实测基线由协调者在派发时另行告知**(以那个为准)。
