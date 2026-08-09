# SP13 整支终审 — 共享包内联 New-UI

范围:`3811365..c83206e`(11 commit)+ 同级仓 `NimoOS-Service@16d9963` / `NimoOS-UI@5bb63dfa`
终审日期:2026-08-07 · 终审者:opus(整支视角,独立取证)

---

## 总体结论

**可以合并** —— 无 Critical、无阻塞项。

工程实体(代码/依赖/锁文件/导出流水线)已独立验证正确且可复现;唯一成体系的缺口是**文档一致性**:
判据经三次修订后,`CLAUDE.md`、spec、Vue2 roadmap 三份都改准了,**唯独实施计划这一份整篇留着被推翻的旧说法**;
另有一份从没进过任何任务范围的文件 —— **New-UI 自己的 `README.md`** —— 至今写着「必须与 NimoOS-Service 克隆为同级目录」
「改动 `../NimoOS-Service` 后必须 `pnpm build`」,正是 spec §5 点名要防的那类事故,而 spec §5 的清单里恰好漏了它。

建议:合并前修 5 条(F1、F2、D1、D3、D6),其余 6 条留票。

### 我独立重跑的门(不采信报告数字)

| 门 | 我的实测 | 与台账口径 |
|---|---|---|
| `pnpm test` 第 1 次 | **1 failed / 10314 passed(640 文件)** — `src/files/upload/persist.test.ts:55` | ❌ 与「0 failed」不符 |
| `pnpm test` 第 2 次 | 640 文件 / **10315 全绿** | ✅ |
| 该文件单独跑 ×3 | 3/3 全绿(14 例) | ⇒ 判定为**负载敏感的既有 flake**,非 SP13 代码缺陷(见 F3) |
| `pnpm exec vue-tsc --noEmit` | exit 0(18s) | ✅ |
| `node oss/export.mjs --out <scratch> --no-commit` | 全六步跑通,**零真实泄漏命中**,1 个预期内二进制跳过 | ✅ 端到端可复现 |
| 产物树 `packages/service/src` | **51 个文件**(69 − 18 条 SERVICE_DELETE),`.superpowers` 已剥净 | ✅ |
| 产物树 `package.json` / `pnpm-lock.yaml` | 三处全部 `file:packages/service`,零 `NimoOS-Service` 路径 | ✅ |
| `pnpm install --frozen-lockfile --lockfile-only` | Done in 330ms(无漂移) | ✅ **D2 就此关闭** |

---

## Findings

### Important

**F1 · `README.md:20,24,32-33,106` —— New-UI 自己的 README 仍在教人去 `../NimoOS-Service` 克隆并构建**

四处白纸黑字:

- `:20` 「**必须与 `NimoOS-Service` 克隆为同级目录** —— 本仓库通过 `file:../NimoOS-Service` 链接……单独克隆无法安装依赖」
- `:24` 目录树把 `NimoOS-Service/` 标成「共享 service 包(**必需**)」
- `:32-33` 快速开始第 1 步 `git clone …NimoOS-Service && cd NimoOS-Service && pnpm install && pnpm build`
- `:106` 「### 共享包漂移 —— 改动 `../NimoOS-Service` 后必须 `cd ../NimoOS-Service && pnpm build`」

这**正是 spec §5 定义的核心事故形态**(「以后有人改了 NimoOS-Service、pnpm build、然后等 New-UI 生效 —— 静默无效,
且三道门全绿」),而 spec §5 的必改清单只列了 `CLAUDE.md` 与 Service 仓,漏了本仓 README。
`:20/:32-33` 还是**事实错误**:内联后单独克隆本仓已经能装依赖。
本支实际动过 `README.md`(089ee6c),却只改了部署章节,未顺带清这四处。

> 处置:改这四处。**注意联动** —— `oss/manifest.mjs:222` 的 `REPLACE` 表存着 README 的
> `privateSha256`(现为 `316642c3…`,我已核对与当前文件一致),改 README 必须同步更新它,
> 否则 `oss/tree.test.mjs` 立刻红。这个哈希是**有意的绊线**:它逼人重新确认公开面的整文件替换仍然够用。

---

**F2 · `docs/superpowers/plans/2026-08-07-vue3-migration-sp13-service-inline.md:7,59,122,317-332,372-390,443,757` —— 计划是三份文档里唯一没跟上三次判据修订的**

回答「三份文档还自洽吗」:**不自洽,且偏差集中在计划这一份。**
`CLAUDE.md`、spec §6(三段带删除线的修订记载)、Vue2 roadmap §4/§SP13(明确写了「误删又恢复 / 最终保留 / 坑未根治 / 靠重启+硬刷新两步」)三份都是准的;计划则整篇保留原文,只有 Task 4 的 Step 3/4(:486-517)和末尾取证表(:810+)带了修订说明。剩下的仍写着:

- `:7` Architecture:「入口指 TS 源码之后,那条漂移链路对 New-UI 侧**彻底消失**,`optimizeDeps.exclude` 与 `vitest server.deps.inline` **两处补丁随之删除**」
- `:59` / `:317-332` Task 3 Step 4:「**删 `optimizeDeps.exclude`**」+ 一整段要写进 vite.config.ts 的替换文本,内含「**SP13 内联后此坑根治**……exclude 与配套的 `include: ['axios']` 一并删除」
- `:372-390` **要写进 `CLAUDE.md` 的替换模板**:「**改完存盘即生效,没有任何构建步骤**」「**这条坑已根治,别再照旧文档操作**」「个别文件头带 `// @vitest-environment node`」——**三条全部是已被查实推翻的说法**(第三条实测为 0 个文件,`grep -rl` 为空);`CLAUDE.md` 正本已改对,计划里的模板没改
- `:757` 拟给 roadmap 的关账文案:「`optimizeDeps.exclude` 与 `server.deps.inline` 两处补丁**已删**」—— 与实际落地的 roadmap 文案矛盾(所幸 roadmap 落的是正确版本)

危害不是「文档不好看」:计划是这类工作**最容易被照抄的模板**(SP11/SP12 若也要内联某个包,第一件事就是翻这份计划)。

> 处置:在 Task 3 Step 4 与「Step 9 改 CLAUDE.md」两处各加一个与 spec §6 同款的修订横幅,指向最终口径;
> `:7`/`:59`/`:757` 三处加删除线或就地订正。**不要**重写整份计划——保留「原判据已证伪」的历史是这套流程的价值所在。

---

**F3 · `src/files/upload/persist.test.ts:55` —— `pnpm test` 不是确定性绿的,我 2 次全量跑中有 1 次红**

第 1 次全量:`1 failed | 639 passed (640)` / `1 failed | 10314 passed (10315)`,失败点是
`expect(await getAllQueueItems()).toEqual([])`(`dropPersisted` 后)。第 2 次全量:全绿。该文件单跑 3/3 全绿。

机理已定位、**不是 SP13 引入的代码缺陷**:`persist.ts:61-64` 的 `dropPersisted` 走 `enqueueWrite` 异步队列
(fire-and-forget),而测试的 `flush()` 只是 `setTimeout(r, 0)` —— 高并发下这一跳不足以让 IDB 写落地。
文件最后一次改动是 `59dc605`(SP4 期),远早于本支。

但**与本支有因果关系**:SP13 往同一批 worker 里加了 37 文件 / 377 例(+~4% 例数,+6% 文件数),
抬高了整体负载与调度抖动,把一条长期潜伏的 flake 顶到了可观测频率(我这台机上 1/2)。
台账与 roadmap 里「六道门 640 文件/10315 例 **0 失败**」这句话因此**不可复现**,直接写进永久关账记录会误导后人。

> 处置:合并不受阻。但 ① roadmap/台账那句改成「10315 例;`persist.test.ts` 有一条既有的负载敏感 flake,
> 单跑稳定绿,全量偶发红」;② 开一张独立小票修 flake(把 `flush()` 换成对 `enqueueWrite` 队列的真实 await,
> 或用 `vi.waitFor`)。别用「重跑一次就绿」当结论关账 —— 这条正是 SP9 那类「测试写了但分辨不出对错」的邻居。

---

### Minor

**F4 · `src/**`(37 个文件 / 54 处)—— 代码注释仍把共享包源码指路到 `NimoOS-Service/src/*.ts`**

例:`src/storage/stores/storage.ts:221`「共享包 NimoOS-Service src/raid.ts create() 已同步改成不 unwrap()」、
`src/storage/components/RaidMemberList.vue:8`「见 NimoOS-Service/src/raid.ts」、`src/ai/stores/agentStore.ts:33,759`。
内联后这些指针对 New-UI 全是错的(正确位置是 `packages/service/src/raid.ts`)。
这与 F1 是同一种事故的两半:**Service 仓门口的牌子立好了(见下),但仓内 54 个指向那扇门的路标还都在。**

> 处置:留票批量替换 `NimoOS-Service/src/` → `packages/service/src/`(纯注释,零行为风险,可一次 sed + 人工过一遍)。

**F5 · `089ee6c` 夹在支中间 —— 回退时会被范围 revert 连带卷走**

commit 本身**处理得当**:message 明确声明非 SP13、说清了它是 SP10 的遗留配套、说清了代提交的理由
(解开 `export.mjs` 的 `checkClean`);两个文件是真配套(`privateSha256` 就是当前 README 的哈希,我已核对);
`--allow-dirty-oss` 确实不豁免 `README.md`,所以不代提交就跑不了 Task 5 的门。**这个处理可以接受,不需要拆票。**

唯一代价:它位于 `5d69067` 与 `c83206e` 之间,spec §7 承诺的「`git revert` 那一两条 commit 即可完全复原」
若被理解成 `git revert 95a2083..c83206e`,会把这条 SP10 收尾一起 revert 掉。

> 处置:在 spec §7「回退」处写死回退集:`c83206e`、`9a4ce20`、`4e6d458`、`690b80a`、`95a2083`(**跳过 `089ee6c`**),
> 之后 `pnpm install`。一行字的事。

**F6 · `CLAUDE.md`「内联消掉的是构建步骤,不是构建本身」—— 措辞自相矛盾**

`vite.config.ts:60-62` 的原意是「内联真正根治的只是**构建步骤**,**没有根治预打包缓存喂旧包**」。
搬进 `CLAUDE.md` 时后半句被写成「不是构建本身」,读起来是「消掉了构建步骤但没消掉构建」——无意义。
这一整节的存在理由就是精确,标题句不该是全节最含糊的一句。

> 处置:改成「内联消掉的是**构建步骤**,没有消掉**预打包缓存**」。

**F7 · `vite.config.ts:88` —— worktree 注释仍提「含整个仓库副本 + NimoOS-Service 软链」**

内联后 New-UI 的 worktree 不再需要那条软链(`file:packages/service` 是仓内相对路径,worktree 里天然可解析——
这其实是本期一个没被记下来的**附带收益**)。注释是残留。

> 处置:留票,或与 F4 同批清。

**F8 · `spec §3.2` 承诺的 `.gitignore` 一条 `packages/service/dist` 没加 —— 但这是对的,不是漏做**

根 `.gitignore` 第 2 行是裸 `dist`(gitignore 裸模式匹配任意层级的同名目录),`packages/service/.gitignore`
里另有 `node_modules` + `dist`。加那一条是纯冗余。

> 处置:无需改代码;若要严谨,在 spec §3.2 那句后面补一句「实测冗余,未加」。记在这里防止后人当成漏项去补。

---

## 对提问 3 / 5 的专门判断

### Q3 · `NimoOS-Service/CLAUDE.md`(`16d9963`)够不够防住「改那边等这边生效」?

**内容本身写得很好,足以防住 Claude 会话走错门。** 它做对了最关键的一点:显式点出「**不会有任何报错提示你走错了地方**」
—— 直接命名了失败的静默性,而不只是陈述事实。同时给了 Vue2 侧的正确用法(`pnpm build` 仍必需)。

两个残余口子:

1. **只有 `CLAUDE.md`,该仓没有 `README.md`。** 人类在 GitHub / 编辑器里浏览 `NimoOS-Service` 时看不到这块牌子
   (`git log` 里 T4 也记了「该仓既无 README.md 也无 CLAUDE.md」)。建议加一个 `README.md`(内容可与 CLAUDE.md 相同或引用它)。
2. **反向没防。** 牌子立在「错误目的地」的门口,但**出发地的 54 个路标(F4)+ 本仓 README 的 4 处(F1)全都指着那扇门**。
   一个 New-UI 开发者按 `storage.ts:221` 的注释走过去,是先看到路标、后看到牌子 —— 牌子救得回来,但成本已经付了。
   **⇒ F1 + F4 修掉之前,Q3 的答案只能算「一半」。**

### Q5 · 产物树里 8 处 `NimoOS-Service` + 2 处 `superpowers` 算不算泄漏?本期新写的 3 处该不该改?

**判断:不算泄漏,`forbidden.mjs` 不需要动,不构成合并阻塞。** 三条独立证据:

1. **词表的设计意图是「被剥离的功能」,不是「内部流程」。** `forbidden.mjs` 的 HARD/SOFT 全部围绕
   相册 / AI / 搜索 / RAG / 转录 这些**从公开版删掉的能力**(泄漏它们 = 暴露私有产品面)。仓名与冲刺号从来不在这个范畴里。
2. **公开树里这类词的存量是 1214 处 / 291 文件**(我实测 `New-UI` + `Vue2`),另有大量 `SP6-P5`、`SP8-P6-T3`、
   `NimoOS-UI` 出现在代码注释中。8 处 `NimoOS-Service` 相对这个基线是噪声,不是新政策破口。
3. **`tree.test.mjs:516` 那条断言的作用域是 README,不是全树** —— 它管的是「大门口不能暴露私有仓结构」。
   我在真实导出的产物树里核过:`README.md` 里 `NimoOS-Service` / `New-UI` / `Vue2` 命中数 **= 0**。
   **所以守卫与政策之间没有不一致**(台账里那句「与既有政策不一致」的观察,前提不成立)。

**但那 3 处新写的还是该改 —— 理由不是泄漏,是「指令错误」。**
产物树的 `vite.config.ts:44,61` 与 `viteOptimizeDepsGuard.test.ts:4,7` 会让一个开源使用者读到
「`cd ../NimoOS-Service && pnpm build`」这条对**他不可能执行、对私有仓也已经过时**的指令。
好消息是这不需要新增任何 `PATCH`:**按 D1 把 `viteOptimizeDepsGuard.test.ts` 的头注释改准、
把 `vite.config.ts` 里那两句祈使句改成过去时,私有侧和公开侧同时就正确了。**

`superpowers` 两处(`MobileHome.vue:31`、`waveform.ts:2`)确实与 oss/README 记的 I7a 先例
(「`.superpowers/sdd/…` 路径泄露内部 SDD 工作流目录结构」→ 加 PATCH 洗掉)不一致,
但它们是**存量、非本期引入**,且 `docs/superpowers/specs/…` 这个路径在公开树里指向一个不存在的目录,危害等于零。
⇒ **留票,不在本期处理。**

---

## Deferred minor 逐条 triage(台账 8 条)

| # | 条目 | 结论 | 理由 |
|---|---|---|---|
| **D1** | `src/viteOptimizeDepsGuard.test.ts:4,7` 头注释仍写「该包是 `file:../NimoOS-Service` 依赖」「pnpm 把它的 **dist** 硬链进 .pnpm」「`cd ../NimoOS-Service && pnpm build` 之后缓存不失效」「单测走 **dist**」 | **合并前修** | 这是**守着 exclude 的那条守卫自己的说明书**,而 SP13 已经因为「以为这条不再需要」删过一次 exclude。一个后人读到「依赖是 `file:../NimoOS-Service`」而 `package.json` 里根本没有这个字符串,最自然的结论就是「这条守卫过期了」→ 重蹈覆辙。改 6 行注释,正文可直接从 `vite.config.ts:36-63` 搬(那边已经写准了)。顺带解决 Q5 里两处「指令错误」 |
| **D2** | 未实跑 `pnpm install --frozen-lockfile` | **关闭(已由终审验证)** | 我实跑 `pnpm install --frozen-lockfile --lockfile-only` → `Done in 330ms`,无漂移。无需再做 |
| **D3** | `CLAUDE.md`「dev server 的实际生效方式」主段落只写「重启 → 生效」,硬刷新只在紧随的口诀框与第三条警告里 | **合并前修** | 主段落现在是一句**不完整因而错误**的判据 —— 而 SP13 全期最贵的教训恰恰是「判据必须落在生效载体上,不能停在中间层」。在那句末尾加「(浏览器侧还要硬刷新,见下)」一个从句即可,零重构 |
| **D4** | `oss/export.mjs:118` 进度显示 `3/6 → 4.5/6`,「4」悬空 | **留票**(建议与 D6 同批) | 纯观感。但 `oss/README.md:11` 写着「固定六步(见该文件内 `1/6..6/6` 的 log)」,实际只剩 5 条 log —— 与 D6 是同一处需要改的文档,一起做更省事 |
| **D5** | `oss/export.mjs:78` 注释举例「sibling `NimoOS-Service` 不存在/archive 失败」 | **留票** | 该注释解释的是「try 为什么从 mkdtemp 之后开始」,这个理由**依然成立**(archive 本仓也可能失败),只是例子过时。低危 |
| **D6** | `oss/export.mjs:63,68-74` 那段 437 处泄漏事故的注释仍写「**两个仓**都把台账入库了(New-UI 1718 份 / Service 32 份)」;`oss/README.md:15,18,21-22` 仍写「两个源仓工作树必须干净」「`NimoOS-Service` 取到 `packages/service/` 子目录」「4. 内嵌 Service —— 改 `file:` 依赖路径 + lockfile」 | **合并前修** | 这条我从 Minor 提到必修。`export.mjs:68-74` 那段的**结论**(需要 `DELETE` 与 `SERVICE_DELETE` **两条独立条目**)现在依然正确且 load-bearing,但它的**前提**(「两个仓」)已经不成立。后人读到「现在只有一个仓了」,最自然的推论是「那一条 `DELETE` 就够了」→ 删掉 `SERVICE_DELETE` 的 `.superpowers` → 437 处台账内容进公网,而**词表里恰好一个禁词都没有,泄漏守卫不会响**(这正是那段注释自己写的场景)。`oss/README.md` 又自称「唯一进 git、能存活下来的导出运维手册」,其第 1、4 步现在是错的。两处一起改,连 D4 的编号一并收 |
| **D7** | `task-5-report.md` 对 off-by-one 的定性一半是反的 | **留票** | 历史评审报告,读者只有回溯审计者,且台账已记「一半是反的」。改它不如把这条记载留着 |
| **D8** | (= D6 中 `oss/README.md` 那半条,台账原本单列) | **合并前修** | 见 D6 |

**合并前修共 5 项:F1、F2、D1、D3、D6。** 全部是文档/注释,无一行行为代码,改完只需重跑 `pnpm exec vitest run oss/`
(F1 会动 `privateSha256`,必跑)+ 一次全量 `pnpm test`。

---

## 值得记下的正面结论

- **两侧分叉的工程面是干净的。** `package.json` / `pnpm-lock.yaml` / `tsconfig.json` 对 `NimoOS-Service` 零引用
  (我逐个核过);Vue2 仓本期零代码改动;`NimoOS-Service` 仍能独立为 Vue2 服务。
- **导出流水线是收敛而不是复杂化。** 「保留 `SERVICE_*` 分组、只换基准目录」这个选择在 spec §4 里的论证经得起检验:
  40 条路径一条没动,`SERVICE_DELETE` 19 条 / `SERVICE_PATCH` 20 条(删 1)与产物树实测吻合,
  `tree.test.mjs` 那条「两处台账由两条不同条目负责」的守卫用例立论保住了。
- **`packages/service` 对其他流程零副作用**(我逐个查过):`scripts/deploy.sh` 只 rsync `dist/`,不受影响;
  仓内无 CI 配置;根 `.gitignore` 的裸 `dist` 已覆盖 `packages/service/dist`;
  vitest 的 `exclude: ['**/dist/**']` 同样覆盖;`packages/service/{tsconfig,vitest.config}.ts` 确认惰性(与产物树同形,留着是对的)。
- **附带收益(没人记下来的)**:worktree 隔离从此不再需要给 New-UI 软链 `NimoOS-Service`——`file:packages/service`
  是仓内相对路径,worktree 里天然解析得到。这消掉了一类历史上的 worktree 装配麻烦(见 F7)。
