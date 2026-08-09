# SP13 终审后一次性修复波 · 执行报告

日期:2026-08-07 · commits:`efb8846`(主修复,9 文件)、`0a7e6fb`(manifest.mjs 锚点同步,1 文件)

范围:`.superpowers/sdd/2026-08-07-vue3-migration-sp13-service-inline/final-review.md` 裁定的
「合并前修 5 项」+ 「顺手 3 项」,共 8 个条目(F1/F2/D1/D3+F6/D6+D8/F7/Q5/F5)。**只碰文档与注释,
零行为代码改动**——除下方"计划外必要偏离"一节说明的一处机械性锚点同步。

---

## 逐项处置

### 必修 1 · F1 — `README.md` 仍教人克隆同级仓

**改了**:
- `## 环境要求`:删掉"必须与 NimoOS-Service 克隆为同级目录"的要求与目录树,改成
  "共享包已内联在 `packages/service/`,单独克隆本仓即可安装依赖"。
- `## 快速开始`:删掉"先构建共享包"那两行(`git clone NimoOS-Service && pnpm build`)。
- `### 共享包漂移` → 改标题为 `### 共享包(@nimotech/nimoos-service)`,内容改成本期最终口径
  三条(重启 dev server → 硬刷新浏览器 → 硬链接陷阱时才需要 `pnpm install`),指回 `CLAUDE.md`。

**联动**:`sha256sum README.md` 算出新值 `bc30420593910b48cc5750dc759d646bea8db62a24ff400d1763e106f243c155`,
同步写进 `oss/manifest.mjs:222` 的 `REPLACE` 表 README 条目的 `privateSha256`(原值
`316642c3...`)。未同步的话 `oss/tree.test.mjs` 立刻红——已用 `pnpm exec vitest run oss/` 验证绿。

### 必修 2 · F2 — 计划文件未跟上三次判据修订

**改了** `docs/superpowers/plans/2026-08-07-vue3-migration-sp13-service-inline.md`:
- 文件顶部新增 🔴 修订横幅,列出三条被实测推翻的前提与最终口径,并声明"不删原文,就地按
  『原文 X(已证伪)→ 实际 Y』标注"的处置原则。
- `:7` Architecture 段:用删除线标出已证伪的论点(exclude 可删),补订正说明
  (pnpm build 那一半确实消失,但 exclude 守的是另一半,已恢复;server.deps.inline 那一处
  删除没问题)。
- `:59` File Structure 表:vite.config.ts 那一行加订正注记。
- Task 1 Step 2(spike 阶段,原 :122):补一句"spike 里做没问题,真仓上被证伪"的脚注。
- Task 3 Step 4(原 :317-332):加独立的 🔴 修订横幅 + 在代码块前标"已证伪"+ 块后补"实际结果"。
- Task 3 Step 7(原 :372-390,"要写进 CLAUDE.md 的模板"):加独立的 🔴 修订横幅,逐条点出三处
  已被证伪的说法(存盘即生效 / 已根治 / 个别文件回落到 node 环境),并指向 `CLAUDE.md` 正本的
  真实文案。
- Task 3 Step 10 commit message(原 :443):把"删 optimizeDeps.exclude"改成准确描述
  (只删了 server.deps.inline,exclude 恢复)。
- Task 6 Step 5 的 roadmap diff 文案(原 :757):用删除线标出"两处补丁已删",补订正
  (只删了一处)。

原文全部保留(用删除线/引用块呈现,没有物理删除任何一行),按 brief 要求"保留历史价值"。

### 必修 3 · D1 — `viteOptimizeDepsGuard.test.ts` 头注释过时

改了头部注释:去掉"该包是 `file:../NimoOS-Service` 依赖"等已过时描述,改成准确现状(包已内联
`packages/service/`,但依旧经 `node_modules` 解析、依旧要被预打包,`exclude` 仍必需),并说明
SP13 曾因误判把它删过一次、实测证伪后恢复。**断言逻辑(`describe`/`it`/`expect`)一个字没动**——
`pnpm exec vitest run src/viteOptimizeDepsGuard.test.ts` 仍是 1 passed。

### 必修 4 · D3 + F6 — `CLAUDE.md` 两处

- **D3**:主段落"dev server 的实际生效方式"末尾补"(浏览器侧还要硬刷新,见下)"从句,不再是
  只读主段落就会误判普通 F5 够用的不完整判据。
- **F6**:"内联消掉的是构建步骤,不是构建本身"(自相矛盾)改成"内联消掉的是构建步骤,没有消掉
  预打包缓存",并补一句说明这是两件独立的事、后者靠 `optimizeDeps.exclude` 顶着。

### 必修 5 · D6 + D8 — oss 里"两个仓"的措辞

- `oss/export.mjs:60-74` 附近那段 437 处泄漏事故的注释:把"两个仓"框架改写成"同一个仓的两个
  各自独立入库的台账目录"(New-UI 根 `.superpowers/` + `packages/service/.superpowers/`),
  **保住 load-bearing 结论**(仍需两条独立 DELETE 条目)并新增一段显式写明误删
  `SERVICE_DELETE` 的 `.superpowers` 条目会导致什么(437 处台账落进公开产物树,词表拦不住)。
- `oss/README.md` 六步流程 1/2/4 三步:改成一个仓的描述;第 4 步"内嵌 Service"按 Task 5 实际
  改动重写为"重算 lockfile"(该步骤里改写 `file:` 路径的动作已经不存在了)。

### 顺手 6 · F7 — `vite.config.ts:88` worktree 注释

补上"内联后 worktree 不再需要给 NimoOS-Service 打软链"这条附带收益,原因(`file:packages/service`
是仓内相对路径,worktree 天然可解析)。

### 顺手 7 · Q5 — `vite.config.ts:39,44,61` 指令式注释

把三处含 `cd ../NimoOS-Service && pnpm build` 字面指令的历史叙述改写成不针对该仓的说法
(如"手动对着外部仓单独重新构建一遍"),消除"叫开源使用者操作一个他们不可能有的私有仓"的
指令错误,同时保留历史因果说明。**配置行(`optimizeDeps: { exclude: [...], include: [...] }`)
一个字符没动**——`git diff` 可核对逐字节。

### 顺手 8 · F5 — spec §7 补回退集

在 `docs/superpowers/specs/2026-08-07-vue3-migration-sp13-service-inline-design.md` §7
「回退」那条后面补写死的回退集:`c83206e`、`9a4ce20`、`4e6d458`、`690b80a`、`95a2083`
(从新到旧逐条 `git revert`),明确**跳过 `089ee6c`**(SP10 遗留的代提交,非 SP13 范围)。

---

## 计划外必要偏离(如实说明)

F7 编辑 `vite.config.ts:88` 的注释时删掉了 `+ NimoOS-Service 软链` 半句。这行文字恰好是
`oss/manifest.mjs` 里 I6 那条 `PATCH` 的 `find` 精确锚点(整行字符串匹配)。改完注释后
`oss/export.mjs` 立刻报"锚点未命中:vite.config.ts",`oss/tree.test.mjs` 与
`oss/export-rsync.test.mjs` 转红——这是任何编辑该注释行都无法避免的连锁反应,不是选择性扩大
范围。按 `oss/README.md` §3「锚点漂了怎么办」的规矩(现场核对新原文,更新 `find`),把这条
`PATCH` 的 `find` 同步成新的注释原文,`replace` 的洗白意图(去 Claude Code 品牌指名)不变、
不涉及任何泄漏词表改动。这处偏离了"`oss/manifest.mjs` 只改那一个 sha256"的字面约束,但不做
的话验收命令 1(`vitest run oss/`)永远红,与"验收必须全绿"这条硬要求直接冲突——已用独立
commit `0a7e6fb` 隔离出来,方便单独审查/回退。

---

## 三条验收命令的实际输出

```
$ pnpm exec vitest run oss/
 Test Files  6 passed (6)
      Tests  138 passed (138)

$ pnpm exec vue-tsc --noEmit
(无输出,exit 0)

$ pnpm exec vitest run src/viteOptimizeDepsGuard.test.ts
 Test Files  1 passed (1)
      Tests  1 passed (1)
```

## 未做 / 做不了的项

无。8 个条目(F1/F2/D1/D3/F6/D6/D8/F7/Q5/F5 —— 注意 D3+F6 合并算一项、D6+D8 合并算一项,
brief 的"8 项"计数口径)全部处置完毕。唯一超出"允许碰的文件"字面范围的改动是上面"计划外
必要偏离"里说明的 `oss/manifest.mjs` 锚点同步,已独立说明理由并单独提交。

## 未提交的既有状态(未触碰)

工作树里 3 个 `design-export/*` 的删除态(`Audio Speaker Segmentation.html` /
`audio-waveform-design-kit.html` / `design-final.html`)在开工前就已是 staged-for-deletion
状态,本次两个 commit 均带精确 pathspec,未涉及这 3 个文件,`git status --short` 显示它们
仍是唯一剩下的未提交改动。

---

## 补项 · F3 关账文字回填(控制器补派,组织上一波修复时漏掉的范围)

**范围**:`/home/nimo/NimoTech/NimoOS-UI/docs/vue3-migration-roadmap.md`(**Vue2 仓,不是本仓**),
只改这一个文件。commit `6d982092`(该仓当前分支 `docs/vue3-migration-sp3`)。

**问题**:Task 6 在终审**之前**把"六道门 0 failed"写成了确定的零失败,但终审 F3 独立重跑
`pnpm test` 两次,第 1 次 `src/files/upload/persist.test.ts:55` 红——这个数字不可复现,
不该这样写进永久关账。

**改了两处**:
1. **第 63 行**(阶段总表 SP13 行,篇幅克制,一句话带过):句尾"六道门 640 文件/10315 例
   0 失败"后面补上`(**但不可复现**,见 §4:`persist.test.ts` 有条 SP4 期既有 flake,SP13
   加重未引入)`。
2. **§4 SP13 段落**的 `pnpm test` 门(篇幅完整,写清因果):在原有"640/10315 全绿"那句
   后面新增一段——终审独立重跑两次、第 1 次红在哪一行、单跑 3/3 绿、根因是 `persist.ts`
   的 `dropPersisted` fire-and-forget + 测试 `flush()` 只是 `setTimeout(0)` 的既有竞态
   (SP4 期就有,该文件最后改动 `59dc605` 远早于 SP13)、SP13 的因果关系是"加重而非引入"
   (新并入 377 例抬高负载~4-6%,把潜伏的老 flake 顶到可观测频率)、并加一句"后人跑全量
   看到这条红不该怀疑内联,该认出是老 flake,建议独立开票修"。

原有的"640 文件/10315 例 0 failed"数字**没有删**——那是 Task 6 当天的真实观测,只是补充
"不可复现"的实情,没有否定这个观测本身。

**纪律核对**:该仓工作树里另有 8 个 `docs/vue3-pending/*.md` 的既有脏文件(非本次改动,
未去查是谁改的),commit 用 `-- docs/vue3-migration-roadmap.md` 精确 pathspec,提交后
`git status --short` 确认那 8 个文件仍是 `M`、未被带入 commit。未跑任何测试(纯 markdown,
按指示不需要)。未使用 `git checkout`/`git stash`。
