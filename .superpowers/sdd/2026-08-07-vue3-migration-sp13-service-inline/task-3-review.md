# Task 3 评审报告(合并效果:690b80a → 4e6d458 → 9a4ce20)

## 结论

- **规格符合性(按机主拍板后修正的判据,非计划原文)**:✅ 符合
- **任务质量**:Approved(有 1 条 Important、2 条 Minor,均不影响合入)

---

## 逐项核对记录

1. **净效果**
   - `package.json:29` 恰好是 `"@nimotech/nimoos-service": "file:packages/service"` —— 确认(diff + `grep`)。
   - `packages/service/package.json` 的 `main`/`module`/`types`/`exports`/`files` 全部指向 `./src/index.ts` / `["src"]` —— 确认。
   - `vite.config.ts`:`optimizeDeps.exclude`(含 `@nimotech/nimoos-service`)与 `include: ['axios']` 在最终状态里存在(4e6d458 恢复,9a4ce20 只改注释未改逻辑)—— 确认。`vitest.test.server.deps.inline` 在 690b80a 删除且此后未恢复 —— 确认,且这一删除是正确的(内联后包已是本地源码,vitest 走源码解析,无需再显式 inline)。

2. **守卫测试** `src/viteOptimizeDepsGuard.test.ts`:`git diff 95a2083 HEAD -- src/viteOptimizeDepsGuard.test.ts` 为空 —— 与 690b80a 前(即 SP13 开工前)逐字节一致,当前断言的是"exclude 必须包含该包名"(正向),不是反向、也不是被重写过的版本。690b80a 里确实临时改成反向断言并提交进了历史(与设计文档 §"不动 src/**,唯一例外是 Task4 临时取证" 的字面表述冲突,见下方 Important),4e6d458 用 `git show` 精确复原。

3. **文档准确性**(本次评审重点):
   - `CLAUDE.md`、`vite.config.ts` 注释、spec §6 表格、plan Task4 Step3/4 四处逐一读过,均已改为"改源码 → 重启 dev server → 生效,无需 build/清缓存/`pnpm install`"这一最终判据,未发现"存盘即生效""立刻生效""永远是新的"等已被证伪的措辞残留(逐字搜索确认)。
   - 已写清"重启"是必要步骤,且写清 `exclude` 守的是"服真源码 vs 服陈旧预打包产物"而非"即时性"。
   - 硬链接陷阱已写入 `CLAUDE.md`(症状/原因/`pnpm install` 处置/`stat -c '%i %n'` 自查命令齐全)。
   - spec §6 表格原判据保留删除线标注为"实测证伪",未被直接抹掉;plan Task4 Step3/4 同样保留"原文只说存盘"的说明再给出修订,历史记载完整。
   - 实现者关于"验收门表格实际在 spec 文件、Task4 步骤在 plan 文件"的说法经 `grep` 核实属实。

4. **`../NimoOS-Service/CLAUDE.md`**(commit `16d9963`):内容准确——声明本包 SP13 起只服务 Vue2、改它不影响 New-UI、Vue2 侧仍需 `pnpm build`,与 brief Step 9 给的模板一致。该仓 `git status` 干净,无残留探针文件。

5. **越界检查**:三个 commit 的 `--stat` 合计只涉及 `CLAUDE.md`、`package.json`、`packages/service/package.json`、`pnpm-lock.yaml`、`vite.config.ts`、`src/viteOptimizeDepsGuard.test.ts`(净零)、两份 plan/spec 文档 —— 未碰 `oss/`、未碰 `tsconfig.json`。工作树里 `M README.md`、`M oss/manifest.mjs`、3 个 `design-export/*` 删除均是未 staged 的并发会话遗留,不在这三个 commit 里(`git status --short` 前导字符为空格,确认未入 index)。

6. **`pnpm-lock.yaml`**:确认进了 690b80a 的 commit,`specifier`/`version`/`resolution.directory` 均从 `../NimoOS-Service` 改为 `packages/service`,`dependencies: axios` 保留,与新 `package.json` 一致。

---

## Findings

**[Important] 计划文档字面约束在 690b80a 里被违反,但已透明自报、最终净效果为零**
`docs/superpowers/specs/2026-08-07-vue3-migration-sp13-service-inline-design.md:16` 明确写"唯一允许碰 `src/` 的情形是 Task 4 的临时取证,且必须当场还原"。690b80a 修改并**提交**了 `src/viteOptimizeDepsGuard.test.ts`(改成反向断言),不属于 Task 4、也不是"当场还原"而是持久提交进历史,直到 4e6d458 才恢复。根因是 brief Step 4 要求删除的配置恰好是这份测试守卫的对象,brief 本身与这条设计级约束存在未预见的张力。影响:仅历史记录里有一个 commit 短暂破坏了这条硬约束,HEAD 状态已恢复零净差,且实现者在报告里主动坦白并给出理由。建议:后续做 sp13 类计划时,若某 Step 会使既有守卫测试失效,应在 brief 里显式列为可碰 `src/**` 的例外,避免依赖实现者事后自证。

**[Minor] `src/viteOptimizeDepsGuard.test.ts` 顶部注释仍写"该包是 `file:../NimoOS-Service` 依赖"**
这是 4e6d458 用 `git show 95a2083:...` 逐字节还原的结果,断言逻辑本身正确且与当前配置相符,但注释文字描述的路径(`../NimoOS-Service`)已经是 SP13 前的旧事实,与 `packages/service` 的新现实不符。不影响测试正确性,建议下次顺手更新一下注释路径。

**[Minor] `pnpm-lock.yaml` 未做 `pnpm install --frozen-lockfile` 复核**
本次评审只核对了 diff 内容一致性(specifier/version/resolution 三处联动正确),未实际跑 `pnpm install --frozen-lockfile` 验证 lockfile 是否真的能被冻结安装通过。报告里的三道门(`pnpm test`/`vue-tsc`/`pnpm build`)已隐含验证过 `pnpm install` 能跑通,风险很低,仅记录未做最后一步硬核实。
