# P5d · T2 任务 brief —— `knowledge.scss` 65 类 + K39 新 token + K45 + 守卫(§9.6 + A-11 + R4/R8/R9)

> **权威优先级:`p5d-coordinator-rulings-T0.md`(R1–R15)> `p5d-appendix-D-classes.md` / `p5d-appendix-B-tokens.md`
> > `p5d-common-constraints.md` + P5a/P5b/P5c 治理 > `p5d-plan.md` > 本 brief。**
> 🔴 **T0 已查实治理文件有 12 处错(E-31 ~ E-42),T1 又加了 3 条(E-43/44/45)。凡治理与裁定书/附录冲突,信后者。**

## 0. 必读顺序

1. `.superpowers/sdd/p5d-coordinator-rulings-T0.md` 全文(**最高,先读;含 R15 与「四之二」节**)
2. `.superpowers/sdd/p5a-common-constraints.md` → `p5b-` → `p5c-` → **`p5d-common-constraints.md`** 全文
3. `.superpowers/sdd/p5d-plan.md` 的 **§0 开工必读** 与 **§T2**
4. 🔴 **`.superpowers/sdd/p5d-appendix-D-classes.md` 全文**(类表 / 白名单 / 不搬清单 / K44 例外 / K45)
   \+ 🔴 **`p5d-appendix-B-tokens.md` 全文**(色值与 token 的**唯一权威**)
5. 本 brief

路径相对 `/home/nimo/NimoTech/.sp8/NimoOS-New-UI/`。**计划书 §T2 全节是你的验收口径。**

## 1. 坐标与基线(**T1 已把基线推高,别用计划书里的旧数**)

| | 值 |
|---|---|
| 可写仓 | `/home/nimo/NimoTech/.sp8/NimoOS-New-UI`,分支 `sp8-ai` |
| **起点 HEAD** | **`56f8849`**(T0 `cc6d7c8`+`03db682` 已关账 · T1 `56f8849` 已关账,评审 clean) |
| 蓝本 | `NimoOS-UI`@**`7a6ee6b7`**,一律 `git -C /home/nimo/NimoTech/NimoOS-UI show 7a6ee6b7:<path>` 读。**禁读该仓工作树**(签出的是 07-15 旧分支)· **永远禁 `checkout`/`stash`/`reset`** |
| 改 | `src/ai/styles/knowledge.scss` · `src/ai/styles/knowledgeStyles.test.ts` |
| 文件数 | **零 `.vue`、零测试文件新增 → 仍 326** |
| 🔴 **三门基线(T1 后)** | **326 文件 / `3544` 例** · `vue-tsc` 0 · `vite build` 0。**不是计划书写的 3515** |
| 其它基线(T1 后实测) | 全表键数 **1595 / 1595** · `aiKb*` **387** · `.vue` **179** · `KIcon.PATHS` **42**(不是 43,E-35) |

## 2. 🔴 T0 交给你的三个**实测终值**(不许自己重算成别的数)

| 裁定 | 值 | 说明 |
|---|---|---|
| **R8** | `NON_K_HELPER_CLASSES` **10 → 16** | = 现状 10 + `dot` / `lbl` / `sep` / `spacer` / `wide` / **`text`**。🔴 **治理 A-10 写的「保持 10 项」作废**(E-34:照它做,`knowledgeStyles.test.ts:262` 那条集合相等断言**一提交就红**)。`nme-content` / `ProseMirror` 走**排除条件**、不进登记表;**`nme` 既不进登记表也不进排除条件**(蓝本零选择器,`nonKClassNames` 扫不到它) |
| **R9** | 白名单 226 → **293** | = 226 + 65(`k*`/`fb*` 新类)+ 2(`nme-content` / `ProseMirror`)。**常量改名 `WHITELIST_293`**(名字跟着数字改 = 本档既定习惯)。🔴 **`text` 不进这一侧**(两条守卫的正则差异,附录 D 有实测) |
| **E-39** | 新增类 **65**(不是计划书写的 66) | 「缺 66 / 已有 21」两种口径都不成立;一律用附录 D §D.0/§D.1 |

复现命令(T0 留的模拟器,**先跑一遍确认你和它同一个基准**):`node .superpowers/sdd/p5d-gen-r8r9-sim.mjs`

## 3. 🔴 本刀最容易「产品代码对、守卫为零」的四处(**本档五次猎中全是这一类**)

1. 🔴 **「没有搬多」正则扩展在现状文件上零可观测** —— T0 的严格超集自证结果是
   **`old 225 / new 225` 完全相同**(扫出的集合一字不差)。
   → **RED 探针是这条改动唯一的判别力证据,不许省。** 计划书要的三个探针都要做:
   ① 塞 `.kn-foo { }` → 报红;② 塞 `.fb-Foo { }` → **报红(这是 A-11「字符集加 `A-Z`」的判别力证据)**;
   ③ 还原。⚠️ **探针注入与断言两侧都要行首锚定 + 先 `stripComments`**(P5c §9 的写侧事故:注入撞注释会伪造出「守卫无效」的假结论),且**要先证注入真落盘**。
2. 🔴 **K45 重复搬的守法要锚定作用域** —— T0 发现白名单正则**收不到 `text`**(`.k-btn.text` 是复合类),
   改用了「`&.text` 恰好 2 次」的计数断言。**T0 复审指出这条没锚定在 `.k-btn{…}` 区间内 → 误红/漏判两种脆弱性。**
   → **本刀必须比照 K10 守 `.k-confirm-*` 的做法:先定位 `.k-btn { … }` 区间,再在区间内计数。**
   **判据:P5e 若在别处重复搬 `.k-btn.text`,这条必须报红;别处合法出现 `&.text` 时不许误红。**
3. 🔴 **K44 顶层例外必须是集合相等断言,不是「排除掉就算了」**(治理 §6.2-2 / 裁定 R4):
   「顶层裸选择器**恰好只有** `.nme-content .ProseMirror` 这一条」。
   **基线**:现状顶层裸选择器 = **0**(depth-0 共 15 条,全是 `.knowledge-app` / `:root[…]` / `@keyframes`)。
   ⚠️ **这条断言在本仓压根不存在,你是新建不是修改。** **必配 RED 探针**(临时加第二个顶层裸选择器 → 必须报红)。
4. 🔴 **`NON_K_HELPER_CLASSES` 的集合相等断言(`:263` 附近)要做 RED 探针** ——
   临时塞一个真·嵌套辅助类 → 必须报红 → 还原。

🔴 **探针还原禁用 `git checkout -- <path>` / `git restore`**(会连未提交编辑一起抹掉,P5c §9.5 险情)——
只许「先 `cp` 存副本 → 注入 → 用副本覆盖 → `md5sum` 逐字节比对」。

## 4. 搬运范围(附录 D 是权威,行号 T0 已逐个**括号配平**复核 9/9)

- 8 段 + `.k-seg`(K43)+ K44 的 ProseMirror 顶层段,落法见计划书 §T2 的表。
- 🔴 **K45(裁定 R1,本期新增授权)**:搬蓝本 `knowledge.scss:1569-1570` 的 `.k-btn.text` + `:hover` 两行,
  插在本仓 `.k-btn` 的 **`&.danger`(`:735-742`)之后、`&:disabled`(`:743`)之前**(与蓝本源序一致,不改级联)。
  声明处注释引「**K45 / 裁定 R1 / 蓝本 `knowledge.scss:1569-1570`**」;
  并在附录 D 已写的 **P5e 交接项**基础上,于 scss 注释里也写明「P5e 不许重复搬」。
- 🔴 **不搬**(断言要守得住它们**不出现**):`.k-section-body`(`:985-991`,归 P5f)·
  `.k-progress-*`(N15)· `:2250-2264` 的 `kn-*`(**P5c 已搬**)· `.kn-badge` 5 条(**P5b-T2 已搬**)。
  **「不搬 ≠ 忘搬」。**
- **K44 的顶层裸选择器保持顶层**(治理 §6.2 的**唯一**例外),紧邻上面那段,注释引「治理 §6.2 / K44 / 裁定 R4」。

## 5. 颜色(硬约束,违反即缺陷)

- 🔴 一切可见颜色必须是 `var(--…)`;**禁 `#hex` / `rgb()` / `rgba()` / 具名色**(`white`/`black` 也算);
  禁 `theme-exception` 逃逸;**注释里也不许出现色字面量**。`transparent` 是关键字,不算。
- 🔴 **新 token 必须在 `knowledge.scss` 的两个主题块里都显式写值**;声明处注释写明**蓝本 `file:line`**;
  **附录 B 有对应行**(附录 B 是权威,你不许自选 token)。
- **先找语义最近的既有 token**:`--warning-soft` / `--success-soft` / `--danger-soft` / `--accent-soft` /
  `--bg-chip` / `--bg-sunken` / `--bg-elevated` / `--line` / `--line-faint` / `--text-*` / `--shadow-xs`
  **都已在两档声明,直接用**(A-9:透明度差异按 A11 同族,**不开小灶**)。
- 🔴 **`#FF9500,#FFCC00` 一个 token 两个消费方**(`NOTE_TYPES.insight` + `.kn-inbox-icon` 蓝本 `:2066`),
  **不许声明两份**。
- **裁定 R11 已批准:两个 wash 渐变保留蓝本色相**(依 `--grad-sandbox` / `--grad-iri` 先例;
  K39 授权新渐变 token,A-9 只管 soft 填充不管渐变)。**协调者不给 alpha,按附录 B 的值落。**
- 🔴 **诚实登记**:4 个渐变里**只有** `#5AC8FA,#007AFF` 有仓内逐字同值先例,**另 3 个没有** ——
  **不许把 P5c「4/4 都有出处」那句照抄过来。**

## 6. 本期显式不动的

- 🔴 **`DARK_TOKEN_SELECTOR`(`:312`)/ `LIGHT_TOKEN_SELECTOR`(`:313`)一字不许改** ——
  K39 只往块里加 token,不改选择器。**报告要显式确认这两行一字未改。**
- **零 `.vue`、零依赖安装**(tiptap 归 T4)· 不碰 `src/i18n/**`(T1 已关账)· 不碰任何组件。
- 🔴 **禁部署**、禁写 `/var/lib`、禁 `git push`/`rebase`/`reset`/`stash`/`merge`、禁 `git add -A`/`git add .`。
- 🔴 别碰 `/home/nimo/NimoTech/NimoOS-New-UI` 与 `/home/nimo/NimoTech/.sp7/NimoOS-New-UI`(**并发会话**)。
- `.sp8/NimoOS-Service` 零改动;**T0 已核 `dist` 与 `src` 一致 → 不需要跨仓 `pnpm build`**(裁定 R12)。

## 7. 三门 + 本刀两个额外门

```bash
cd /home/nimo/NimoTech/.sp8/NimoOS-New-UI
pnpm test                      > /tmp/p5d-t2-test.log  2>&1; echo "exit=$?"
pnpm exec vue-tsc --noEmit     > /tmp/p5d-t2-tsc.log   2>&1; echo "exit=$?"
pnpm build                     > /tmp/p5d-t2-build.log 2>&1; echo "exit=$?"
# 额外门 ①(sass 能编译 —— 范围边界抄错会在这里炸)
pnpm exec sass --no-source-map src/ai/styles/knowledge.scss /dev/null; echo "exit=$?"
```

- **全量,输出完整落盘,不许 `| tail`。** 报告贴 `Test Files` / `Tests` 两行 + **「3544 + 本刀新增 N = 实测值」的算式**。
- **额外门 ②(CSS 进产物)**:本期 scss 全进 `knowledge.scss`,而它由 `KnowledgeLayout.vue` **早已 import** →
  **CSS 侧从本刀起就会进产物**。`pnpm build` 后 `grep -o "kn-note-row" dist/assets/*.css` **本刀就该命中**。
  🔴 **但 JS 侧的「入口可达」核验归 T10,别把 CSS 与 JS 混为一谈**(P5c E-8/E-13)。
- **已知噪声**(只它们红才复跑一次并说明,**不要顺手改**):`src/files/upload/persist.test.ts > … dropPersisted …`
  (IndexedDB flaky)· `AgentComposer.test.ts` 的 vue-i18n teardown 竞态。
- 包管理器 **`pnpm`**,勿用 yarn/npm。

## 8. 报告契约

- 全文写 `.superpowers/sdd/p5d-task-2-report.md`。**返回给协调者 ≤ 20 行**。
- 必须含:计划书 §T2 逐条兑现 · **四组 RED 探针各贴两段输出(报红 + 还原后转绿)+ `md5` 比对 + `git status` 干净证明** ·
  `NON_K_HELPER_CLASSES` 与白名单的**终值与实测复现** · **`DARK_/LIGHT_TOKEN_SELECTOR` 一字未改的自证** ·
  新建 token 逐个列(名 / 两档取值 / 蓝本 `file:line` / 附录 B 对应行)· **命中的每一条 K/N 编号申报** ·
  「不搬清单」的守法与证据 · 三门 + 两个额外门的输出。
- 🔴 **常驻纪律(T1 教训,裁定后新增)**:**凡 DoD 里带 🔴 的「复跑 / 复扫 / 独立复核」项,
  不许用「采信上一刀的结论」替代;要跳过必须先停下写 `NEEDS_CONTEXT` 申报 ——
  事后在报告里写一句不算申报。**
- 拿不准 → 写 `NEEDS_CONTEXT` 并**停下**,不要自己拍。

## 9. 提交

一刀 = 一个语义提交(`feat(kb): P5d T2 …`)。台账/脚本 `git add -f` 具体路径。
提交后 `git show --stat HEAD` + `git status` 自查。
🔴 **碰 gitignore 产物(`dist/`、`node_modules/.vite/`)时 `git status` 不构成任何证据**(P5c §1.3.1:有污染活了三天)。
