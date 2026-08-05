# P5b · T3 任务书 —— store 三处 epoch 过期守卫

## 你在哪

NimoOS 的 Vue2 → Vue3 整库迁移,第 8 期(SP8,AI 区)第 5 阶段第 b 批(P5b):把知识库的
**「已收录文件」页**与**「任务队列」页**从 Vue2 迁到 New-UI。T0–T10 单车道串行。

**你是 T3,只给 store 的三个 action 加异步过期守卫。** 你排在 T5(队列页 `.vue`)前面,
是因为 pill / scope 切换正是这三个 action 的竞态触发点 —— 守卫先落地,T5 的测试才钉得住「切 pill 不串桶」。

🔴 **这是本仓第 6 次命中「异步过期守卫」这条纪律**(前五次全是评审逮出来的)。
所以本任务的重点不是「加个 if 判断」,而是**交错路径的回归测试**。

## 你的权威输入

1. **治理文件**:`/home/nimo/NimoTech/.sp8/NimoOS-New-UI/.superpowers/sdd/p5b-common-constraints.md`
   —— 全批共同约束。**先通读**,尤其 §1(工作区 + 全期零改动清单)· §3(K9–K20 偏离,**你要落的是 K15**)·
   §3.5(N9–N14 照抄条,**N9 是你的竞态实证依据**)· §4(数据契约:三个 action 各自的真实响应形状)·
   §5(代码范式)· §8(测试门)· §9(测试质量)· §10(报告契约)
2. **后端 fixture**:`.sp8/NimoOS-New-UI/.superpowers/sdd/p5b-fixtures/`(T0 从真机直连 Parser `:8283` /
   agent `:8282` 抓的原始响应体,附 `README.md`)。
   🔴 **你的 mock 形状一律从这里取,禁手编** —— 本仓「裸信封 unwrap」已经栽过三次,
   「mdadm 丢 faulty 行」栽过一次。凭想象写 fixture 是本项目的复发坑。
3. **现状代码**:`src/ai/knowledge/stores/knowledgeStore.ts`(**本任务是全批唯一被允许改它的任务**)
4. **既有先例**:P5a 给 `loadRoots` 加守卫的那一刀,commit **`3d8c9bc`**(`git show 3d8c9bc`)。
   **照它的写法**,不要另发明一套。

## 改哪两个文件

- **改**:`src/ai/knowledge/stores/knowledgeStore.ts`
- **新建**:`src/ai/knowledge/stores/knowledgeStore.staleGuard.test.ts`

**只这两个。** 治理 §1.1 的全期零改动清单一个都不许碰。

## 要做什么(K15)

给这三个 action 各加一个 **store 实例局部的 epoch 计数器**:

| action | 现状行号(自己 grep 确认) |
|---|---|
| `loadAllJobs` | `:336` 附近 |
| `loadIndexedFiles` | `:415` 附近 |
| `loadDistillJobs` | `:558` 附近 |

🔴 **inline 写,不抽公共 guard**(承本仓纪律:过早抽象;P5a 的 `loadRoots` 也是 inline)。

**三个语义一致**:

- 进函数先 `const my = ++xxxEpoch`
- `await` 之后先判 `if (my !== xxxEpoch) return` —— **不写共享 state、不归位 loading、不弹 toast**
- 🔴 `loadIndexedFiles` 的 `finally { s.loading = false }` **也要受守卫约束**
  —— 否则先发后至的那一发会提前把骨架撤掉

**计数器必须是 store 实例局部的**,不是模块级单例(多实例互相串号)。

## 竞态实证(写进代码注释 + 报告,不许只写「防竞态」四个字)

- **`loadIndexedFiles`**:`onPathPrefixInput` / `onMimePrefixInput` **每敲一键整发重载,蓝本无 debounce**
  (这是 **N9**,治理 §3.5 登记的照抄条 —— 触发频率照抄不改,K15 只修「先发后至覆盖」的正确性)。
  打 `abc` 三发并存 → 先发后至会把 `ab` 的结果盖上去,而过滤条显示的是 `abc`。
- **`loadAllJobs`**:QueueView 10 秒轮询 + `setScope('index')` 手动触发,两路并存。
- **`loadDistillJobs`**:10 秒轮询 + `setFilter(f)` + `setScope('distill')` +
  `retryDistill`/`cancelDistill` 内部的重载,**四路**并存;且它按 filter 只刷对应桶,
  串号会让 pending 的结果落进 failed 桶。

## 测试要求(本任务的真正难点)

🔴 **必须走交错路径,不是只测「守卫函数返回 true/false」。**

- 用**两个可控 deferred promise**,人为让**先发后至**(第一发的 resolve 排在第二发之后)
- 断言:state 是**第二发**的结果 · `loading` **没被提前归位** · toast **没多弹**
- **三个 action 各一组**
- **每组都要有反向对照**:顺序到达时(第一发先 resolve)两发都生效,守卫不误伤

## 测试门(提交前必须三门全过)

```
pnpm test                      # 全量
pnpm exec vue-tsc --noEmit     # 0 错
pnpm build                     # 通过
```

**基线(协调者实测)**:见本文件末尾「起点」。你的预期增量:**+1 文件,+8~10 例**。
实测多少报多少,差了要解释。

已知噪声(只它们红才复跑一次并说明,别去修):
`src/files/upload/persist.test.ts > dropPersisted …`(既有 IndexedDB flaky)· `AgentComposer.test.ts` 的 vue-i18n teardown 竞态。

## DoD

- 三门全绿
- 三个 action 的守卫**语义一致**,且都是 store 实例局部计数器
- `loadIndexedFiles` 的 `loading` 归位确实受守卫约束
- 三组交错用例 + 三组反向对照,**mock 形状全部回 `p5b-fixtures/`**(报告里逐个说明取自哪个 fixture 文件)
- 竞态实证写进了代码注释

## 🔴 RED 探针(必做三次,每次贴「改了什么 → 哪个用例报红 → 报红文本」,然后**改回来**并确认 `git status --short` 干净)

**逐个删掉一个守卫**(一次只删一个)→ 对应那组交错用例**精确报红**,
且 **互不误伤**(删 A 的守卫时,B、C 两组不能跟着红)—— 这一条是证明「各咬各的」。

三次探针的输出都要贴,包括「其余两组仍绿」的证据。

## 硬约束(治理文件有全文,这里只挑最要命的)

- 可写仓只有 `/home/nimo/NimoTech/.sp8/NimoOS-New-UI`(分支 `sp8-ai`)
- `/home/nimo/NimoTech/NimoOS-UI` **只读,且是多会话共享的检出**,只能 `git show main:<path>`,
  禁止改 / 提交 / checkout / stash / restore
- `NimoOS-New-UI`(SP6/SP9)与 `.sp7/NimoOS-New-UI`(SP7)**禁碰**
- 治理 §1.1 的**全期零改动清单**一个都不许碰;`knowledgeStore.ts` 你能改,但**只加守卫**,
  不做无关重构、不改既有逻辑、不改函数签名
- 禁 `git add -A` / `git add .` —— **只用显式 pathspec**;禁 rebase / reset / stash / merge / push
- 不跑 `./scripts/deploy.sh`,不写 `/var/lib`
- **界面 1:1 照抄 Vue2**;但 Vue2 的 bug / 竞态 / 吞错**不照抄**,改正确并注释登记
  —— 本任务正是「改正确」的那一类(K15 已授权)。**但触发频率(N9 无 debounce)照抄不改。**
- 遇到治理文件没登记过的偏离需求,**停下返回 `NEEDS_CONTEXT` 问我**,别自己拍

## 提交

`git add -f` 逐个显式路径(两个源文件 + 报告),**一次 commit**。

## 报告契约

**完整报告写进** `/home/nimo/NimoTech/.sp8/NimoOS-New-UI/.superpowers/sdd/p5b-task-3-report.md`:
三个守卫各自落在哪几行 / 与 `3d8c9bc` 先例的异同 · 三组交错用例怎么造的先发后至 ·
每个 mock 取自哪个 fixture 文件 · 三次 RED 探针的原始报红文本(含「其余两组仍绿」)· 三门实测数字 · 遗留疑问。

**返回给我的正文 5 行以内**:状态(`DONE` / `DONE_WITH_CONCERNS` / `NEEDS_CONTEXT` / `BLOCKED`)·
commit 短哈希 · 三门一行数字 · RED 探针一句话 · 最要紧的 1–2 个 concern。**不要把报告正文贴回来。**

## 起点

分支 `sp8-ai` · **BASE = `4c18508`** · **实测基线 = 313 文件 / 2882 例全绿**,`vue-tsc` 0,`vite build` 0。
