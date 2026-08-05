# P5b · T2 任务书 —— scss A:共享底座段

## 你在哪

NimoOS 的 Vue2 → Vue3 整库迁移,第 8 期(SP8,AI 区)第 5 阶段第 b 批(P5b):把知识库的
**「已收录文件」页**与**「任务队列」页**从 Vue2 迁到 New-UI。T0–T10 单车道串行。

**你是 T2,只搬 scss 的第一半 —— 两页共用的底座段。** T5(队列页 `.vue`)会消费你这一段的 32 个类;
T6 会搬 scss 的第二半(已收录文件页专属段)。**先有样式后有模板**,评审才能核「模板用到的每个类真实存在」。

🔴 **本任务档位是 opus,因为 scss 没有回归网** —— `color-guard.test.ts` 不扫 `.scss` 的类结构,
`knowledgeStyles.test.ts` 是你自己扩的。搬错一个嵌套层、串一个类名,单测和构建都不会红,只有人眼能抓。

## 你的权威输入(**这四份是你唯一的需求来源,不要去读计划书原文**)

1. **治理文件**:`/home/nimo/NimoTech/.sp8/NimoOS-New-UI/.superpowers/sdd/p5b-common-constraints.md`
   —— 全批共同约束。**先通读**,尤其 §1(工作区 + 全期零改动清单)· §3(K9–K20 偏离)· §3.5(N9–N14 照抄条)·
   §5(代码范式)· §6(配色硬约束 + **token 归属表**)· §8(测试门)· §9(测试质量)· §10(报告契约)
2. **附录 B**:`.sp8/NimoOS-New-UI/.superpowers/sdd/p5b-appendix-B-tokens.md`
   —— **色值映射的唯一权威**。它的每一行(行号 / 原色值 / 目标 token)都被独立 opus 评审回蓝本与两档色板复核过。
3. **附录 D**:`.sp8/NimoOS-New-UI/.superpowers/sdd/p5b-appendix-D-classes.md`
   —— 类白名单。**D.1 那 32 类是你的**;D.2 的 53 类是 T6 的,别提前搬。
4. **Vue2 蓝本**:仓库 `/home/nimo/NimoTech/NimoOS-UI`,`git show main:src/pages/AI/styles/knowledge.scss`
   (确切路径以治理文件 §1 里记的为准)。**那个工作树只读,禁止改 / 提交 / checkout / stash / restore。**

## 改哪两个文件

`src/ai/styles/knowledge.scss` · `src/ai/styles/knowledgeStyles.test.ts`

**只这两个。** 不新建文件,不碰 `.vue`,不碰 i18n。

## 要搬什么

蓝本 `knowledge.scss` 的 **7 段(S1–S7)**:

`:241-252` · `:253-257` · `:735-968` · `:1296-1316` + `:1335-1341` · `:1398-1430` · `:1484-1499` · `:2031-2039`

🔴 **全部写在既有 `.knowledge-app { … }` 基础块内部**(K9,整段重新嵌套),**段序照蓝本原序**。

**落笔前先通读本仓 `src/ai/styles/knowledge.scss` 现状** —— P5a 已经在里面落了一批东西,
你是在既有文件上增补,不是从零写。

## 七条必须做到的

1. **`.k-btn` 已经存在**(本仓 `knowledge.scss:496-526` 附近,自己 grep 确认现状行号)——
   **只在它内部补 `&.danger`**(蓝本 `:843-847`,注意 T0 勘误 E-10:**不是** `:844-848`),
   **不要重写整块**。色值按附录 B 映射。
2. **K17**:`.k-modal-head` / `.k-modal-title` / `.k-modal-x` / `.k-modal-body` **不搬**(本期不用,留 P5c);
   但 `.k-modal-foot` 里的 `.right` **要搬**。
3. **K10**:**只搬 `:1398-1430` 的嵌套版 confirm**;`:1675-1703` 的顶层重复段**丢弃**,
   并在段头注释里写明理由(级联被 0,2,0 覆盖 → Vue2 里就没生效过)。
4. **新 token 的两档声明** —— 🔴 **归属以治理文件 §6.2 的 token 归属表 + 附录 B §B.1 为准**,
   不要自己按语义猜。计划书 §2 T2 原文那句枚举是**笔误**(T0 勘误 E-5 查实并已订正):
   `--purple-soft` 其实属于 T6 段(`:1894`),`--danger-soft-faint` 在 T2 段(`:1417`)与 T6 段(`:1972`)都用到。
   **规则只有一条:只声明本段真正用到的**;归属表怎么写就怎么落。
   声明位置:`.knowledge-app { … }` 基础块(暗档)与 `:root[data-theme="light"] .knowledge-app { … }`(浅档),
   **这两个声明块内允许字面量**(它就是 token 的定义处),块外全文零字面量。
5. **色字面量按附录 B 逐行映射** —— T2 段是 **19 行 22 处**(T0 勘误 E-4 实测订正,计划书写的 18 处是错的)。
   🔴 **附录 B 里没有的色字面量 → 停下返回 `NEEDS_CONTEXT` 问我,不许自己发明映射**
   (P5a 的教训:自行发明 `color-mix` 蒙版比例本该先问)。
6. **注释口径 R5**:规则段落里的注释**一律不许出现色字面量**,改成「蓝本行号 + 中文描述」。
7. **落笔前 grep 重名**:你新加的每个类名,与 `src/ai/styles/` 下的 `agent-styles.scss` /
   `settings-styles.scss` / `skills-styles.scss` / `sk-shared.scss` **零重名**。
   🔴 嵌套作用域串号**单测与 color-guard 都抓不到,只能人肉**。

## 扩 `knowledgeStyles.test.ts`

1. **白名单 +32 类**(附录 D.1)。🔴 现状常量名是 `WHITELIST_102`(**102 项**,不是计划书写的 101)→ 本任务后 **134**。
   **是「扩」,不是删断言、不是放宽正则。** 常量重命名要连带改所有引用。
2. 🔴 **守卫缺口① 必须在本任务修掉**:现有类名提取正则 `/\.k2?-[a-z0-9-]+/g`
   (`knowledgeStyles.test.ts:95` 附近,自己 grep 确认现状行号)**匹配不到 `.kn-badge`**
   —— `k` 后面必须跟 `2` 或 `-`,而你这一段 S7(`:2031-2039`)搬的正是 `.kn-*`。
   不修的话你搬进来的 `.kn-badge` 及其属性态**一条都不会被守卫覆盖**(白名单假绿)。
   修完要**证明它真的开始咬了**(见下面 RED 探针第 4 条)。
3. R2 的 `*-soft` token 两档断言数组,扩到本段新声明的那几个。
4. 浅色档 token **集合式**覆盖断言(P5a 终审 ⑦ 的写法)自动覆盖新 token;**例外清单不许扩**。
5. `var()` 闭环守卫自动覆盖;**若它报「两档都找不到」说明你漏声明了,停下**,别去放宽守卫。

## 测试门(提交前必须三门全过)

```
pnpm test                      # 全量
pnpm exec vue-tsc --noEmit     # 0 错
pnpm build                     # 通过
```

外加 **`pnpm exec sass` 单独编译 `src/ai/styles/knowledge.scss` exit 0**。

**基线以协调者给的实测为准**(见本文件末尾「起点」一节),不要用计划书 §5 的预测数。
你的预期增量:**+0 文件**,`knowledgeStyles.test.ts` **+3~5 例**。实测多少报多少,差了要解释。

已知噪声(只它们红才复跑一次并说明,别去修):
`src/files/upload/persist.test.ts > dropPersisted …`(既有 IndexedDB flaky)· `AgentComposer.test.ts` 的 vue-i18n teardown 竞态。

## DoD

- 三门全绿 + `pnpm exec sass` 单独编译 exit 0
- `grep -c` **规则段落里色字面量 = 0**(两个 token 声明块除外)
- **`theme-exception` 逃逸 = 0**(禁用)
- 白名单 **134/134**
- 附录 B 的 T2 段 **19 行 22 处逐行核过**,报告里逐行列「蓝本行 → 原值 → 落地写法」
- 7 条「必须做到的」逐条在报告里回执

## 🔴 RED 探针(至少 4 次,每次贴「改了什么 → 哪个用例报红 → 报红文本」,然后**改回来**并确认 `git status --short` 干净)

1. 规则段落里塞一个 `#ff0000` → color 守卫**精确**报红
2. 删掉某个新类的规则 → 该类存在性断言报红
3. 删掉浅色档的一个新 token → **集合式覆盖断言指名报红**
4. **专为守卫缺口① 做**:删掉 `.kn-badge` 的规则(或改名) → 修正后的正则确实让它报红
   —— **修正则之前先跑一次证明它不红**(证明缺口真实存在),修完再跑一次证明它红了。两次输出都贴。

探针没做 = 你的守卫是不是真的咬得住无人知道,这一条不通过就退回。

## 硬约束(治理文件有全文,这里只挑最要命的)

- 可写仓只有 `/home/nimo/NimoTech/.sp8/NimoOS-New-UI`(分支 `sp8-ai`)
- `/home/nimo/NimoTech/NimoOS-UI` **只读,且是多会话共享的检出**,只能 `git show main:<path>`
- `NimoOS-New-UI`(SP6/SP9)与 `.sp7/NimoOS-New-UI`(SP7)**禁碰**
- 治理文件 §1.1 的**全期零改动清单**(`views/{KnowledgeLayout,DashboardView}.vue` · `components/KIcon.vue` ·
  `util/{indexedFiles,dashboardHelpers}.ts` · `knowledgeStore.ts` 只有 T3 能改 · Service 仓)一个都不许碰
- 禁 `git add -A` / `git add .` —— **只用显式 pathspec**;禁 rebase / reset / stash / merge / push
- 不跑 `./scripts/deploy.sh`,不写 `/var/lib`
- **界面 1:1 照抄 Vue2**;但 Vue2 的 bug / 竞态 / 吞错**不照抄**,改正确并注释登记。
  蓝本自身的**未定义类、悬空 animation-name、永不命中的选择器**属于「照抄条」,见治理 §3.5,**照抄不改**
  —— 遇到治理文件没登记过的同类情况,**停下问我**,别自己拍

## 提交

`git add -f` 逐个显式路径(两个源文件 + 报告),**一次 commit**。
`.superpowers/sdd/` 被 `.gitignore` 盖住,那里的文件必须 `-f`。

## 报告契约

**完整报告写进** `/home/nimo/NimoTech/.sp8/NimoOS-New-UI/.superpowers/sdd/p5b-task-2-report.md`:
七段各自搬了什么 / 落在哪 · 22 处色映射逐行回执 · 7 条「必须做到的」逐条回执 · 守卫缺口① 的修法与两次探针输出 ·
4 次 RED 探针的原始报红文本 · 重名 grep 结果 · 三门 + sass 实测数字 · 遗留疑问。

**返回给我的正文 5 行以内**:状态(`DONE` / `DONE_WITH_CONCERNS` / `NEEDS_CONTEXT` / `BLOCKED`)·
commit 短哈希 · 三门一行数字 · 白名单数 · 最要紧的 1–2 个 concern。**不要把报告正文贴回来。**

## 起点

分支 `sp8-ai`。**BASE 与实测基线由协调者在派发时另行告知**(以那个为准)。
