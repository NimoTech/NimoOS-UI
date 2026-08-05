# P5b · T6 任务书 —— scss B:已收录文件段

## 你在哪

NimoOS 的 Vue2 → Vue3 整库迁移,第 8 期(SP8,AI 区)第 5 阶段第 b 批(P5b):把知识库的
**「已收录文件」页**与**「任务队列」页**从 Vue2 迁到 New-UI。T0–T10 单车道串行。

**你是 T6,搬 scss 的第二半 —— 「已收录文件」页专属段。** T2 已经搬完第一半(两页共用的底座,32 个类)。
T8–T10 会分三刀搬 `IndexedFilesView.vue`(826 行),消费你这一段的 53 个类。
**先有样式后有模板**,评审才能核「模板用到的每个类真实存在」。

🔴 **本任务派 opus 的唯一原因:scss 没有回归网。** 搬错一个嵌套层、串一个类名、漏一个两档 token 声明、
把色字面量留在规则段落里 —— `pnpm test` / `vue-tsc` / `vite build` **三门都不会红**,只有人眼和你自己扩的守卫能抓。

**T2 是一轮过的**(零 Critical 零 Important),它的做法就是标准答案 —— 落笔前先
`git show 4c18508` 看看 T2 那一刀怎么写的,照它的风格。

## 你的权威输入

1. **治理文件**:`/home/nimo/NimoTech/.sp8/NimoOS-New-UI/.superpowers/sdd/p5b-common-constraints.md`
   —— **先通读**。尤其 §1(工作区 + §1.1 零改动清单)· §3(K9 / **K2** / K10 偏离)·
   §3.5(N9–N14 照抄条,**N11 是你的**)· §6(配色 + **token 归属表**)· §8(测试门)· §9(测试质量)· §10(报告契约)
2. **附录 B**:`.sp8/.../p5b-appendix-B-tokens.md` —— **色值映射的唯一权威**。
   **§B.3 是你的段**(13 行 17 处);**§B.4 是两处 `[data-theme="dark"]` 的并档处方**。
3. **附录 D**:`.sp8/.../p5b-appendix-D-classes.md` —— **§D.2 那 53 类是你的**;D.1 的 32 类 T2 已搬。
   另看 §D.5(死规则)与 §D.6。
4. **Vue2 蓝本**:仓库 `/home/nimo/NimoTech/NimoOS-UI`,`git show main:<knowledge.scss 路径>`
   (确切路径见治理 §1)。**只读,禁止改 / 提交 / checkout / stash / restore。**
5. **T2 的那一刀**:`git show 4c18508`(本仓)—— 风格、注释口径、守卫扩法的活样板

## 改哪两个文件

`src/ai/styles/knowledge.scss` · `src/ai/styles/knowledgeStyles.test.ts`

**只这两个。** 不新建文件,不碰 `.vue`,不碰 i18n,不碰 store。

## 要搬什么

蓝本 `knowledge.scss` 的 **`:1705-2022`**(318 行),🔴 **整段重新嵌套进 `.knowledge-app`**(K9)。

**落点**:照 T2 的先例写进**既有** `.knowledge-app { … }` 壳段内部,**不要追加新顶层块**
—— T2 的评审已端到端验过:追加到文件末尾会让 `@media` 覆写因同优先级、源码更早而被基础规则静默吃掉。

## 六条必须做到的

1. **K10 已在 T2 处理** —— 你这一段**从 `:1705` 起**,`:1675-1703` 那个顶层重复段**不搬**。段头注释写明。
2. 🔴 **`@keyframes row-done`(蓝本 `:1844-1847`)** 在你这一段的**内部**,但 scss 嵌套里的 keyframes
   要**放到文件末尾的全局 keyframes 区**(照 P5a 处理 `k2pulse` / `k2spin` 的先例,自己 grep 看现状)。
3. 🔴 **两处 `[data-theme="dark"]` 选择器并进两档(K2)** —— 处方在**附录 B §B.4**,照它做:
   - `:1862` `.k-status-badge[data-s="ok"] { color: #5BD876 }`
   - `:1895` `.k-type-tag[data-kind="md"] { background: rgba(255,255,255,0.1) }`
   这两条在 Vue2 与 New-UI **都永不命中**(Vue2 只有 `.agent-app` 带 `data-theme`,New-UI `<html>` 从不置 `"dark"`),
   正解是让基础块取暗值、浅色档取浅值,**那两条选择器整条删除**。
   两处都要在代码注释里注明「蓝本 `file:line` 的 `[data-theme="dark"]` 在两边都不命中,按 K2 并进两档」。
4. **色字面量按附录 §B.3 逐行映射** —— 你这一段是 **13 行 17 处**
   (T0 勘误 E-4 实测订正过,计划书原写的「22 处」是错的)。
   🔴 **附录 B 里没有的色字面量 → 停下返回 `NEEDS_CONTEXT` 问我,不许自己发明映射。**
5. 🔴 **N11 —— `.k-file-detail` 的 `animation: fade-in`(蓝本 `:1941`)照抄不改**。
   蓝本**只有 `k-fade-in`,没有 `fade-in`**,animation-name 悬空 = 不播动画。
   改成 `k-fade-in` 会**凭空多出一个 Vue2 没有的淡入** = 界面不 1:1。
   → **照抄**,并给 `knowledgeStyles.test.ts` 的 **keyframes 存在性守卫登记这一条例外**,
   注释注明理由。
6. **落笔前 grep 重名**:你新加的每个类名,与 `src/ai/styles/` 下的 `agent-styles.scss` /
   `settings-styles.scss` / `skills-styles.scss` / `sk-shared.scss` **零重名**。
   🔴 嵌套作用域串号**单测与 color-guard 都抓不到,只能人肉**。

## 扩 `knowledgeStyles.test.ts`

1. **白名单 +53 类**(附录 §D.2)。🔴 **现状是 `WHITELIST_134`(134 项,T2 扩过)→ 本任务后 187**。
   **是「扩」,不是删断言、不是放宽正则。** 常量重命名要连带改所有引用。
2. **`--danger-soft-faint` 若本段用到则按治理 §6.2 归属表补声明**,并扩 R2 断言。
   **只声明真正用到的**;`--purple-soft` 按归属表属你这一段(T2 没声明它)。
3. 浅色档 token **集合式**覆盖断言自动覆盖新 token;**例外清单不许扩**。
4. `var()` 闭环守卫自动覆盖;**若报「两档都找不到」说明你漏声明了,停下**,别去放宽守卫。
5. **N11 的 keyframes 例外**要写成**显式登记 + 注明理由**的形式,不是把守卫关掉。

### 顺带处理:守卫缺口④(T2 评审挂账,交给你)

`.k-modal-foot` 内的 `.right`(现状 `knowledge.scss:783` 附近,自己 grep 确认行号)
**既不在白名单、也不进扫描正则** —— 两者都只收 `k*` 前缀。
将来本文件里冒出任意 `.right` 规则,不会有任何断言说话。

**这不是缺陷,是口径缺口。** 请你二选一并在报告里说明理由:
- 在附录 D 的口径之外,给白名单/扫描加一条「非 `k*` 前缀的嵌套类」的处理方式;或
- 判定不值得(比如会引入更多假阳性),那就**在测试文件里写一条注释显式登记这个缺口**,
  让后来人知道它是已知的而不是漏掉的。

拿不准就返回 `NEEDS_CONTEXT` 问我。

## 测试门(提交前必须三门全过)

```
pnpm test                      # 全量
pnpm exec vue-tsc --noEmit     # 0 错
pnpm build                     # 通过
```

外加 **`pnpm exec sass` 单独编译 `src/ai/styles/knowledge.scss` exit 0**。

**基线(协调者实测)**:见本文件末尾「起点」。预期增量:**+0 文件,+3~5 例**。
实测多少报多少,差了要解释。

已知噪声(只它们红才复跑一次并说明,别去修):
`src/files/upload/persist.test.ts > dropPersisted …`(既有 IndexedDB flaky)· `AgentComposer.test.ts` 的 vue-i18n teardown 竞态。

## DoD

- 三门全绿 + `pnpm exec sass` 单独编译 exit 0
- 🔴 **`pnpm build` 后 `grep k-frow-f dist/assets/*.css` 命中**(证明真进了构建管线)
- `grep -c` **规则段落里色字面量 = 0**(两个 token 声明块除外)
- **`theme-exception` 逃逸 = 0**
- 白名单 **187/187**
- 附录 §B.3 的 **13 行 17 处逐行核过**,报告里逐行列「蓝本行 → 原值 → 落地写法」
- §B.4 的两处并档各有代码注释
- 六条「必须做到的」逐条在报告里回执
- 守卫缺口④ 的处置 + 理由

## 🔴 RED 探针(至少 3 次 + 1 次反向确认,每次贴「改了什么 → 哪个用例报红 → 报红文本」,然后**改回来**并确认 `git status --short` 干净)

1. 规则段落里塞一个 `#ff0000` → 色守卫**精确**报红
2. 删掉 `@keyframes row-done` → keyframes 守卫**指名**报红
3. 删掉浅色档的一个新 token → **集合式覆盖断言指名报红**
4. 🔴 **反向确认(最重要的一条)**:N11 给 `fade-in` 登记的那条例外,
   **不会**让「删掉 `k-fade-in` 这个真实存在的 keyframes」也变绿。
   —— 即:删掉 `@keyframes k-fade-in` 定义 → 守卫**仍然报红**。
   证明你登记的是「`fade-in` 这一个名字的例外」,不是把整条守卫放宽了。

## 硬约束(治理文件有全文,这里只挑最要命的)

- 可写仓只有 `/home/nimo/NimoTech/.sp8/NimoOS-New-UI`(分支 `sp8-ai`)
- `/home/nimo/NimoTech/NimoOS-UI` **只读,且是多会话共享的检出**,只能 `git show main:<path>`
- `NimoOS-New-UI`(SP6/SP9)与 `.sp7/NimoOS-New-UI`(SP7)**禁碰**
- 治理 §1.1 的**全期零改动清单**一个都不许碰
- 禁 `git add -A` / `git add .` —— **只用显式 pathspec**;禁 rebase / reset / stash / merge / push
- 不跑 `./scripts/deploy.sh`,不写 `/var/lib`
- **注释口径 R5**:规则段落里的注释**一律不许出现色字面量**,改「蓝本行号 + 中文描述」
- **界面 1:1 照抄 Vue2**;Vue2 的 bug / 竞态 / 吞错不照抄,但**未定义类 / 悬空 animation-name /
  永不命中的选择器 / 被级联覆盖的死规则**属治理 §3.5 的**照抄条**。
  遇到治理文件**没登记过**的同类情况,**停下返回 `NEEDS_CONTEXT` 问我**,别自己拍

## 提交

`git add -f` 逐个显式路径(两个源文件 + 报告),**一次 commit**。

## 报告契约

**完整报告写进** `/home/nimo/NimoTech/.sp8/NimoOS-New-UI/.superpowers/sdd/p5b-task-6-report.md`:
整段搬了什么 / 落在哪 / keyframes 挪到哪 · 17 处色映射逐行回执 · §B.4 两处并档的写法与注释 ·
六条「必须做到的」逐条回执 · 守卫缺口④ 的处置与理由 · 白名单 134→187 的核对 ·
4 次 RED 探针的原始报红文本(含反向确认)· 重名 grep 结果 · 三门 + sass + dist grep 实测 · 遗留疑问。

**返回给我的正文 5 行以内**:状态(`DONE` / `DONE_WITH_CONCERNS` / `NEEDS_CONTEXT` / `BLOCKED`)·
commit 短哈希 · 三门一行数字 · 白名单数 · 最要紧的 1–2 个 concern。**不要把报告正文贴回来。**

## 起点

分支 `sp8-ai` · **BASE 与实测基线由协调者在派发时另行告知**(以那个为准)。
