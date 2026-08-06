# P6-T9 台账搬迁记录 —— gitignore 覆盖但要长期存活的东西搬去哪了

**为什么这份文档存在**:机主 2026-08-06 提出,合并时 `.gitignore` 覆盖掉的东西(挂账、台账)如果以后还要用,必须手动搬,不能指望 gitignore 之外的机制自动带走。本项目已经因为这条真丢过两次(SP7 整个 `.superpowers` 目录、SP8 30 个台账文件从未被 git 跟踪)。T10 要撤 `.sp8` worktree 前,必须先读完这份文档、跑完 §6 的核验门。

三处暴露的复核结果、四个 Step 的处置结果都在下面。

---

## Step 1:三处暴露还在不在(复核)

```bash
cd /home/nimo/NimoTech/NimoOS-UI && git status --short && ls docs/vue3-pending/ && wc -l docs/vue3-pending/*
cd /home/nimo/NimoTech/.sp8/NimoOS-Service && git status --ignored --short && find .superpowers -type f | wc -l
```

**实测(2026-08-06,T9 开工时)**:

1. `NimoOS-UI/docs/vue3-pending/` —— **未跟踪**,8 个文件 / 1574 行(2026-08-06 当天全期未做项审计,400+ 条)。✅ 确认还在,已处置(见 §2)。
2. `NimoOS-UI/FRONTEND_API_GUIDE.md` —— 当时**未跟踪**,333 行。✅ 确认还在;**机主 2026-08-06 拍板入库,已提交 VUE2 commit `6c5c632f`**(见 §3)。
3. `.sp8/NimoOS-Service/.superpowers/` —— 整目录被 `.superpowers/sdd/.gitignore`(内容裸 `*`)吃掉,`git status --ignored --short` 只报一行 `!! .superpowers/`;`find .superpowers -type f | wc -l` = **13**。✅ 确认还在,已处置(见 §4)。

---

## Step 2:`docs/vue3-pending/` 入库

已执行,分两次提交(第二次顺带带上 Step 5 的产出,见下)。VUE2(`NimoOS-UI`)commit:

```
7dfe35ce docs: Vue3 迁移未做项全期审计入库(8 文件)          — 7 个未改动文件
9b83c539 docs(p6-t9): P5f 挂账落进长期台账 + 撤 worktree 前核验门  — 07-后端票汇总.md(第 8 个文件,含本刀新增内容)+ roadmap.md
```

`git status --short` 复核:两次提交后 `docs/vue3-pending/` 8 个文件全部 tracked、clean。

---

## Step 3:`FRONTEND_API_GUIDE.md` 定性 —— 🟢 机主 2026-08-06 拍板:入库,已提交(不再是"等拍板")

**机主拍板**:文档记的几个坑(缺 `Bearer` 前缀、响应信封层数、401 刷新队列)正是本项目反复栽过的地方,SP10 删掉 Vue2 之前都是活的参考;不入库则一次 `git clean` 就没了。

🔴 **订正(修复轮 1/5)**:本节上一版写「读了全部 179 行」是错的,独立评审用四种方法(`wc -l`/`wc -c`/`awk 'END{print NR}'`/python `readlines()`)交叉实测**全部得 333 行**,且当时的内容摘要也确实只覆盖到第 3 节,完全没提第 4-8 节(实时通信/Vuex/i18n/Home.vue 结构/9 条重构红线,全部在第 179 行之后)。误读成因、防范措施、补读后的完整内容判断与建议,见 `p6-task-9-report.md` §2.0–§2.2(那份文档是权威版本,这里不重复贴长文本,只留一句指引)。

**结论摘要(完整版见 `p6-task-9-report.md` §2.2/§9.1)**:补读第 4-8 节后,**建议不变——入库**。这是一份**面向"接手重构 `Home.vue` 的开发者"的 Vue2 前端架构说明**,共 8 节,覆盖 HTTP 对接(第 3 节)之外,还有实时通信三套机制(Socket.io/WebSocket/EventBus,第 4 节)、Vuex 状态管理(第 5 节)、i18n(第 6 节)、当前主页结构(第 7 节)、以及 9 条重构红线(第 8 节)。全篇纯描述性,没有密钥、没有敏感数据,是**准确的技术文档**(含第 4-8 节,与代码/CLAUDE.md 核对一致,没发现错误)。价值不止服务于"重构 Home.vue"这一次性任务——第 8 节的 9 条红线本身就是一份可复用的验收清单。

**入库前第三次安全复核**(不可逆动作,再核一遍全文 333 行):真实 token/密码/私钥——无;内网 IP 或主机名——无(`VUE_APP_DEV_IP`/`VUE_APP_DEV_PORT` 只是变量名);机主个人信息——无。三类均干净。

**已执行**:`cd NimoOS-UI && git add FRONTEND_API_GUIDE.md`(带 pathspec)→ commit **`6c5c632f`**。VUE2 工作树自此归零。

（历史记录:本节原本等机主拍板,不入库也不删;2026-08-06 机主已拍板入库并执行,见上——此事已完结,不是未决事项。）

---

## Step 4:Service 侧 13 个文件的可达性实测与处置

`.sp8/NimoOS-Service/.superpowers/sdd/` 下 13 个文件里,**11 个是评审 diff**(文件名形如 `review-<A>..<B>.diff`,外加一个不带区间名的 `p5a-task-1-rereview-pkg.diff`),另外 2 个是支撑文件(`.gitignore`、`progress.md`)。

### 4.1 九个真区间 diff —— 全部可达,判定「不入库,登记重生成命令」

**实测命令(brief 给的那条 + 补测两条)**:

```bash
cd /home/nimo/NimoTech/NimoOS-Service
git diff 3bf15b3..ca34772 --stat | tail -3
git diff f9a0096..2af8262 --stat | tail -3
git diff 39e8a4e..501cc97 --stat | tail -3
```

**输出**(三条全部非空、有真实文件变更行数,证明区间在合流后的 `master`——当前 `ac39cd7`——上完整可达):

```
# 3bf15b3..ca34772
 src/ai.ts       | 677 +++++++++++++++++++++++++++++++++++++++++++++++++++
 src/index.ts    |   8 +-
 src/sse.test.ts | 124 ++++++++++
 src/sse.ts      |  85 +++++++
 5 files changed, 1636 insertions(+), 1 deletion(-)

# f9a0096..2af8262
 src/disks.test.ts | 15 +++++++++++++++
 src/disks.ts      |  6 ++++++
 2 files changed, 21 insertions(+)

# 39e8a4e..501cc97
 src/ai.test.ts | 238 +++++++++++++++++++++++++++++++++++++++++++++++++++++++
 src/ai.ts      | 207 +++++++++++++++++++++++++++++++++++++++++++++++++
 2 files changed, 445 insertions(+)
```

进一步用 `git cat-file -e <sha> && git merge-base --is-ancestor <sha> HEAD` 对涉及的全部 10 个真实 SHA(`f9a0096 2af8262 3bf15b3 ca34772 39e8a4e 501cc97 f405eee 1126162 f3e32d0` 全部,以及下面单独讨论的 `dadfb0e`)逐个验证 —— **除 `dadfb0e` 外,9 个全部 `exists, ancestor-of-HEAD=YES`**。⇒ 剩余 6 个未逐一 `--stat` 抽测的区间(理由同构,同一个 Service 仓、同一条 `ac39cd7` 分支线,SHA 已确认是该分支的祖先)判定同样可达。

**处置 = 不 `git add -f`,登记重生成命令**(原文件是「review-package」脚本产出,带 `# Review package: A..B` / `## Commits` / `## Files changed` / `## Diff` 的包装头,不是裸 `git diff` 输出;下面给的是**功能等价**的重生成法,不追求字节级复刻包装头):

| 原文件名 | 重生成命令 |
|---|---|
| `review-f9a0096..2af8262.diff` | `git log --oneline f9a0096..2af8262 && git diff f9a0096..2af8262` |
| `review-3bf15b3..ca34772.diff` | `git log --oneline 3bf15b3..ca34772 && git diff 3bf15b3..ca34772` |
| `review-39e8a4e..501cc97.diff` | `git log --oneline 39e8a4e..501cc97 && git diff 39e8a4e..501cc97` |
| `review-f405eee..1126162.diff` | `git log --oneline f405eee..1126162 && git diff f405eee..1126162` |
| `review-3bf15b3..39e8a4e.diff` | `git log --oneline 3bf15b3..39e8a4e && git diff 3bf15b3..39e8a4e` |
| `review-f3e32d0..ca34772.diff` | `git log --oneline f3e32d0..ca34772 && git diff f3e32d0..ca34772` |
| `review-1126162..f3e32d0.diff` | `git log --oneline 1126162..f3e32d0 && git diff 1126162..f3e32d0` |
| `review-501cc97..f405eee.diff` | `git log --oneline 501cc97..f405eee && git diff 501cc97..f405eee` |
| `review-ca34772..f9a0096.diff` | `git log --oneline ca34772..f9a0096 && git diff ca34772..f9a0096` |

全部在 `cd /home/nimo/NimoTech/NimoOS-Service` 下执行。

### 4.2 `p2a-review-dadfb0e..2af8262.diff` —— 不可达,但**零信息可丢**(不需要 `git add -f`)

`dadfb0e` 在 `NimoOS-Service` 仓**不存在**(`git cat-file -e` 报错);它其实是 `NimoOS-New-UI` 仓的一个 commit(`dadfb0e5300d46a27c9af68291ef62ea264336e8` "SP8-P2a Task 4: 抽出应用级 aiTheme,agentStore 改委托"),文件名带着 Service 侧的命名习惯但指向了别的仓 —— 是当时生成脚本走错仓的产物。

**关键事实:这个文件本身内容是空的** —— 全文只有 5 行模板骨架(`=== commits ===` / `=== stat ===` / `=== diff -U10 ===` 三个空节),**没有任何实际 diff 数据**。已用 `cat` 核对全文。⇒ 判定它不构成"不可达就必须 git add -f 保住的信息",因为压根没有信息在里面。**不入库,不需要任何补救。**

### 4.3 `p5a-task-1-rereview-pkg.diff` —— 0 字节,同样零信息

`wc -l` = 0,`grep -m5 "^diff --git\|^commit\|^From "` 零匹配。文件是空文件。**不入库。**

### 4.4 支撑文件 `progress.md`(18 行)—— 已原文抄录进本文档 §7,不单独 `git add -f`

这是一份 P2b 任务的历史完成记录片段(memory-context/context 显示与用户长期记忆 `sp8-ai-migration-progress.md` 里记的 P2b 内容高度重合,属冗余留痕)。出于谨慎(万一"已被记忆覆盖"这个判断本身有误),把全文原样抄进本文档 §7 兜底,而不是信任判断后直接丢弃。

### 4.5 `.gitignore`(裸 `*`)—— 不搬,它是问题本身不是答案

这份文件就是 progress.md 里 Task 2 记录的"review-package 脚本会把 `.superpowers/sdd/.gitignore` 覆写成裸 `*`"那个肇因文件,本身没有搬迁价值。

---

## Step 5:P5f 挂账落盘位置(已完成)

全部落进 `NimoOS-UI` 两处(VUE2 commit `9b83c539`):

| 编号/条目 | 落到哪个文件、哪一节 |
|---|---|
| D-10 / D-11 / D-12 / 票 B / `isDeferred` 知情项 | `docs/vue3-migration-roadmap.md` §SP8「🔴 SP8 债务台账」表一(P5f 收官新登记的债务) |
| `?raw` 全仓性空转 / T8-D3 三条陷阱 / oss lockfile 三条挂账 / `strangler.js:28` 注释数字错 / D47 泄漏扩大 | 同上,表二(本期新产生的债务) |
| `NimoOS-Web` 未提交的 `M README.md` | 同上小节,单独一条「🔴 发布前人工检查项」(不算债务,是推送前必须人看一眼的东西) |
| 守卫常量终值表(`WHITELIST_425`/`NON_K_HELPER_CLASSES`/常量-扫出数差值/`.vue`·color-guard 数/`aiKb*`·全表键数) | 同上小节,「守卫常量终值表」——**每个数字都标了"P5f收官值 vs 现测"并附取数命令**,已实测出合流后 `.vue` 从 188 涨到 340(全仓范围变了) |
| 票 A(Agent 语义搜索卡补 notes 分组) | `docs/vue3-pending/07-后端票汇总.md` 附录表 `BE-A8`(标注它其实是前端功能缺口而非后端缺陷,按用户裁定归档于此) |
| 票 C(搜索链路授权根缺失) | 同上 `BE-30`(🔴 一等) |
| 票 D(Parser rerank 端点 500) | 同上 `BE-31`(🟡 二等) |
| 票 E(未分组扩展名不可管理) | 同上 `BE-32`(🟡 二等) |
| Wiki 数据库运维票(38GB/1.42亿行 `file_events`,`cff8a2c` 未装) | 同上 `BE-29`(🔴 一等) |

---

## Step 6:撤 `.sp8` worktree 前的核验门(可执行)

**T10 撤 worktree 之前必须全部跑一遍、全部通过:**

```bash
# 1. 两个 worktree 除 dist/node_modules 外必须干净
cd /home/nimo/NimoTech/.sp8/NimoOS-New-UI && git status --ignored --short   # 只应有 !! dist/ 与 !! node_modules/
cd /home/nimo/NimoTech/.sp8/NimoOS-Service && git status --ignored --short  # 只应有 !! .superpowers/(内容已按 Step 4 处置完毕,允许继续留在 worktree 里直到撤除,只是不随合流带出去)/ !! dist/ / !! node_modules/

# 2. 本刀落盘的文档必须已提交、工作区干净
cd /home/nimo/NimoTech/NimoOS-UI && git log --oneline -5   # 应看到 7dfe35ce / 9b83c539 / 8ba172b7 / 6c5c632f / 6ff26538
cd /home/nimo/NimoTech/NimoOS-New-UI && git status --short .superpowers/sdd/p6-ledger-migration.md .superpowers/sdd/p6-task-9-report.md  # 应为空(无输出,提交后)

# 3. FRONTEND_API_GUIDE.md 已经机主拍板入库,确认工作树因此归零(不再是"仍原状未决")
cd /home/nimo/NimoTech/NimoOS-UI && git status --short   # 应为空(0 行)——这是本轮与上一版核验门的唯一差异

# 4. 全局约束复核:NEW-UI 主工作树(非 .sp8 那份)status 应恰好 3 行 design-export 删除,SERVICE 主仓 0 行
cd /home/nimo/NimoTech/NimoOS-New-UI && git status --short   # 恰好 3 行 " D design-export/..."
cd /home/nimo/NimoTech/NimoOS-Service && git status --short  # 0 行
```

若第 1 条在 Service worktree 里看到除 `.superpowers/`/`dist/`/`node_modules/` 之外的第四类未跟踪/忽略项,说明本刀之后又有新的一次性文件被扔进了 worktree,**必须先追加处置再撤**,不能假设"以前核过一次就一直干净"。

---

## Step 7:提交记录

VUE2(`NimoOS-UI`,分支 `docs/vue3-migration-sp3`):

```
7dfe35ce docs: Vue3 迁移未做项全期审计入库(8 文件)
9b83c539 docs(p6-t9): P5f 挂账落进长期台账 + 撤 worktree 前核验门
8ba172b7 fix(p6-t9): 修复轮 1/5 —— 取数命令订正
6c5c632f docs: 前端架构 & API 对接指南入库(机主 2026-08-06 拍板)
6ff26538 docs(p6-t9): oss/export.mjs 的 DEFAULT_OUT 危险默认值单独立票
```

NEW-UI(`NimoOS-New-UI`,`git add -f` 因为 `.superpowers/` 被 gitignore):

```
本文件 + p6-task-9-report.md,commit 见仓库 log(T9 报告里贴了 SHA,含修复轮与机主拍板执行两次追加提交)
```

---

## §7 附:Step 4.4 提到的 `progress.md` 全文抄录(防止判断有误导致信息丢失)

来源:`.sp8/NimoOS-Service/.superpowers/sdd/progress.md`(该文件本身未 `git add -f`,内容已完整照抄在此):

> P2b Task 6: complete (New-UI fe235b0..e8f8564 / **Service 2af8262..c8f1919**, review Spec ✅ / Quality Approved
>   零 Critical/Important,2 条 Minor;reviewer 实测 MemorySection+memoryLabels 24 例、全量 276 文件/2150 例全绿,
>   tsc 清, build 成功)。**D5 落地**:Service `src/ai.ts` 的 `putMemorySettings` payload
>   `context_window?: number | null`(`null` 是后端真实契约值 = 「自动」,Vue2 MemorySection.vue:141 就发 null),
>   重建 + New-UI 侧 `pnpm install` 重新同步 `file:` 链接;**调用点零 `as unknown as number` 强转**。
>   reviewer 特别核实:`node_modules/@nimotech/nimoos-service` 是**符号链接**指向 Service 仓的 dist(非陈旧拷贝),
>   故消费侧 `vue-tsc` 绿是真有效。
>   **承接 Vue2 既有测试 13/13 全在、零削弱**,含关键那条「空白 context_window 必须发真 `null`」(组件与用例双向验)。
>   **偏离(申报级)**:①scope 从 4 文件扩到 6 —— brief Step 2 #14 明确要求把 `<script setup>` 里无法借 `this` 调用的
>   纯函数抽成 `src/ai/util/memoryLabels.ts`(+单测),reviewer 判定扩权正当、非无谓抽象。
>   ②**逻辑修复 1(真缺陷)**:`load()` 加 `!!s.enabled` 归一 —— `undefined` 会被 `JSON.stringify` 丢字段,
>   后端当"未改动",与用户看到的开关态不符。③**逻辑修复 2(真缺陷)**:4 条写路径全补 danger toast,
>   Vue2 四处**都是静默失败**(reviewer 逐条回读确认,其中一处还写着"失败保留"注释)。
>   reviewer 三次 RED(`null`→`undefined` → 2 条红;拆 toast → 1 条红;拆回滚 → 1 条红)全部精确、已还原。
>   🔶 Minor 记账:①`listUserMemory()` 后多了一处未申报的 `|| []` 兜底(Vue2 无,无害但未申报)。
>   ②逻辑修复 1 没有专属用例(承接的用例 1 mock 的是 `{enabled:false}`,与裸赋值不可区分)。
>   ⚙️ 协调者措施:本次起新增 `.superpowers/sdd/p2b-common-constraints.md`(公共约束 + 对账既定事实 + 评审要求),
>   后续 dispatch 只引用它,避免每次重述导致协调者上下文膨胀 / 约束漂移。
