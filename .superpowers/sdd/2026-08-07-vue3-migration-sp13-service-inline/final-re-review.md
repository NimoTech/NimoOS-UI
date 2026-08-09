# SP13 终审修复波 · 范围内复评

复评对象:`review-c83206e..0a7e6fb.diff`(2 commit:`efb8846` 主修复 9 文件 + `0a7e6fb` manifest.mjs 锚点同步 1 文件)
对照:`final-review.md` 裁定的 8 条(F1/F2/D1/D3+F6/D6+D8/F7/Q5/F5)
复评方法:逐条读 diff 原文取证 + 独立重跑三条验收命令(不采信修复报告自报数字)

---

## 逐条判定

| # | 判定 | 理由 |
|---|---|---|
| **F1** | **ADDRESSED** | `README.md` 删掉「必须与 NimoOS-Service 克隆为同级目录」目录树与 `git clone NimoOS-Service && pnpm build` 两行,「共享包漂移」节改写为内联后的最终口径(重启 dev server → 硬刷新,指回 `CLAUDE.md`)。`oss/manifest.mjs:222` 的 `privateSha256` 已同步为 `bc304205...`——我独立跑 `sha256sum README.md` 得到的哈希与该值逐字节一致。`pnpm exec vitest run oss/` 138/138 绿,证实联动生效。 |
| **F2** | **ADDRESSED** | 计划文件顶部加了 🔴 修订横幅,逐处(`:7` Architecture、File Structure 表、Task 1 Step 2 脚注、Task 3 Step 4/Step 7 独立横幅、Step 10 commit message、roadmap 收尾文案)用删除线 `~~...~~` + 「原文 X(已证伪)→ 实际 Y」就地标注,原文一字未删(diff 里全是新增行,没有对原论述文字的 `-` 删除)。覆盖了终审点名的重灾区(:372-390 CLAUDE.md 模板三处证伪说法全部点出)。 |
| **D1** | **ADDRESSED** | `src/viteOptimizeDepsGuard.test.ts` 头注释改准(去掉「file:../NimoOS-Service 依赖」「cd ../NimoOS-Service && pnpm build」等过时/指令性描述)。我用 `git diff` 过滤掉注释行后确认非注释行(import/describe/it/expect)零改动,且独立重跑该测试 1/1 绿。 |
| **D3+F6** | **ADDRESSED** | `CLAUDE.md` 主段落末尾补了「(浏览器侧还要硬刷新,见下)」从句,不再是不完整判据;「不是构建本身」改成「没有消掉预打包缓存」,消除自相矛盾,并补一句说明是两件独立的事。 |
| **D6+D8** | **ADDRESSED** | `oss/export.mjs:63-74` 与 `oss/README.md` 六步流程 1/2/4 步都从「两个仓」改写成「同一棵树里两处各自独立入库的台账目录 / 一个仓的子目录」,同时保住了 load-bearing 结论(仍需两条独立 `DELETE`/`SERVICE_DELETE` 条目),并新增显式后果句:「若有人…把它删掉,437 处台账内容会原样落进公开产物树,而 forbidden.mjs 的词表里一个禁词都没有,泄漏守卫不会响」——逐字满足终审要求。 |
| **F7** | **ADDRESSED** | `vite.config.ts` worktree 注释新增一段,写明内联后 worktree 不再需要给 `NimoOS-Service` 打软链的附带收益及原因(`file:packages/service` 是仓内相对路径)。 |
| **Q5** | **ADDRESSED** | `vite.config.ts` 三处(注释里的 `cd ../NimoOS-Service && pnpm build`)全部改写成不针对该仓的历史陈述(如「手动对着外部仓单独重新构建一遍」),不再给开源使用者一条他们无法执行的指令,同时保留历史因果说明。判定标准正确对齐终审「指令是否还错,不是仓名是否出现」。 |
| **F5** | **ADDRESSED** | spec §7 回退条后补写死回退集 `c83206e`/`9a4ce20`/`4e6d458`/`690b80a`/`95a2083`,显式声明跳过 `089ee6c` 并说明理由(SP10 遗留代提交,非 SP13 范围)。 |

**8/8 ADDRESSED。**

---

## 特别核实项

### 1. "必要的越界"(`oss/manifest.mjs` I6 PATCH 锚点同步,独立 commit `0a7e6fb`)

核实结论:**属实,且处置得当。**

- `git diff c83206e..0a7e6fb -- oss/manifest.mjs` 只改了 `find` 字符串这一行,把
  `'... 含整个仓库副本 + NimoOS-Service 软链),'` 同步为 `'... 含整个仓库副本),'`——
  与 `efb8846` 中 `vite.config.ts` 该行的实际改动**逐字符一致**(我逐字比对过两边的 diff 输出)。
- `replace` 字段行在 diff 中**没有 +/− 标记**(未改动),仍是原来的洗白替换文本
  「本机可能存在 .claude/ 等工具目录(含整个仓库副本),」——去 Claude Code 品牌指名的剥离意图未变、未被削弱。
- 没有新增/删除任何 `PATCH`/`DELETE`/`REPLACE` 条目,只是修了漂移的锚点字符串,符合
  `oss/README.md` §3「锚点漂了怎么办」的既定流程。
- 独立成一个 commit,message 如实说明了因果链(F7 改注释 → 锚点漂移 → 两个 oss 测试转红 → 现场同步锚点),便于单独审查/回退。
- 三条验收命令均绿:`vitest run oss/`(138/138)、`vue-tsc --noEmit`(exit 0)、
  `vitest run src/viteOptimizeDepsGuard.test.ts`(1/1)。

### 2. 文件白名单合规性

改动文件清单(9 个,来自 diff 的 `Files changed` 汇总):
`CLAUDE.md`、`README.md`、`docs/superpowers/plans/2026-08-07-...md`、
`docs/superpowers/specs/2026-08-07-...-design.md`、`oss/README.md`、`oss/export.mjs`、
`oss/manifest.mjs`、`src/viteOptimizeDepsGuard.test.ts`、`vite.config.ts`。

**全部落在允许白名单内。** 逐一核实两处"仅注释"限制:

- `vite.config.ts`:用 `grep -v` 过滤掉所有注释行/空行后,`git diff c83206e..0a7e6fb` 无剩余输出
  ⇒ 非注释行(`optimizeDeps: { exclude: [...], include: [...] }`、`test: { ... exclude: [...] }` 等配置值)**零改动**。
- `src/viteOptimizeDepsGuard.test.ts`:同样过滤法确认非注释行(import/describe/it/expect)**零改动**。

`packages/service/**`、`package.json`、`tsconfig.json` 均未出现在改动文件列表中——未被碰。

工作树里 3 个 `design-export/*` 的删除态:`git show --stat` 核对 `efb8846` 与 `0a7e6fb` 两个 commit,
均不包含这 3 个文件;`git status --short` 显示它们仍是当前唯一的未提交改动,与修复报告所述一致。

---

## 新引入的破坏

**无。** 本轮改动是纯文档/注释,三条独立重跑的验收命令全部通过:

```
pnpm exec vitest run oss/                                 → 6 files / 138 tests, all passed
pnpm exec vue-tsc --noEmit                                → exit 0
pnpm exec vitest run src/viteOptimizeDepsGuard.test.ts    → 1 file / 1 test, passed
sha256sum README.md                                        → bc30420593910b48cc5750dc759d646bea8db62a24ff400d1763e106f243c155
                                                              (与 oss/manifest.mjs:222 登记值逐字节一致)
```

未跑全量 `pnpm test`(按指示跳过;本轮未动行为代码,且已知 `persist.test.ts:55` 是既有 flake、与本期无关)。

---

## 总判定

**8/8 ADDRESSED,复评范围内未发现新引入的破坏(Critical 或 Important)。**

**可以合并。**
