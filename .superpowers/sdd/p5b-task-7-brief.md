# P5b · T7 任务书 —— `util/indexedFilesView.ts` 五个纯函数

## 你在哪

NimoOS 的 Vue2 → Vue3 整库迁移,第 8 期(SP8,AI 区)第 5 阶段第 b 批(P5b):把知识库的
**「已收录文件」页**与**「任务队列」页**从 Vue2 迁到 New-UI。T0–T10 单车道串行。

**你是 T7,从蓝本 `IndexedFilesView.vue` 里抽五个纯函数出来单独成文件并测透。**
接下来 T8/T9/T10 会分三刀搬那 826 行的组件,直接 import 你这五个。
纯函数先于消费者落地,是为了让组件测试不用再去覆盖这些分支。

**同类先例 T4 是零问题一轮过的** —— `git show 9a98106` 就是你的活样板(文件组织、导出风格、
「照抄的怪行为」怎么钉、测试怎么写)。

🔴 **本任务最大的坑是「边界差一档,测试全绿」**。P5a T6 的原话教训:
`fmtAgo` 的 `h < 24` 被改成 `h < 48`,**16/16 用例全绿**。所以任务书对边界断言的要求是硬的。

## 你的权威输入

1. **治理文件**:`/home/nimo/NimoTech/.sp8/NimoOS-New-UI/.superpowers/sdd/p5b-common-constraints.md`
   —— **先通读**。尤其 §1(工作区 + §1.1 零改动清单)· §2(移植纪律)· §3(K9–K20,**你落 K12**)·
   §3.5(N9–N14 照抄条)· §5(代码范式 + 相对路径表)· §7(i18n)· §8(测试门)· §9(测试质量)· §10(报告契约)
2. **附录 A**:`.sp8/.../p5b-appendix-A-i18n.md` —— `fmtRel` 用到的五个键的**确切中文值**在这里(T1 已落,你只查不改)
3. **Vue2 蓝本**:仓库 `/home/nimo/NimoTech/NimoOS-UI`,`git show main:<IndexedFilesView.vue 路径>`
   (确切路径见治理 §1)。**只读,禁止改 / 提交 / checkout / stash / restore。**
4. **T4 的活样板**:`git show 9a98106`(本仓)
5. **既有同类先例**(本仓,**只读不改**,属治理 §1.1 零改动清单):
   `src/ai/knowledge/util/indexedFiles.ts` / `dashboardHelpers.ts` 及其测试

## 新建哪两个文件

- `src/ai/knowledge/util/indexedFilesView.ts`
- `src/ai/knowledge/util/indexedFilesView.test.ts`

**只这两个。** 不改任何既有文件。

## 要抽哪五个函数(K12)

从蓝本 `IndexedFilesView.vue` 的 **`:396-444`**:

| 函数 | 蓝本行 | 关键点 |
|---|---|---|
| `fmtBytes(n)` | `:396-402` | **4 档**;🔴 **`toFixed` 的位数是条件式**(`n < 10240 ? 1 : 0`),GB 档恒 2 位;`n == null` → `'—'`;🔴 **`n === 0` 走 `< 1024` 分支返 `'0 B'`,不是 `'—'`**(`n == null` 用的是宽松 `==`,`0` 不命中) |
| `fmtRel(ts)` | `:404-415` | **5 档**(45 秒 / 60 分 / 24 时 / 30 天 / 月)。🔴 **与 store 的 `fmtAgo`(4 档)不是同一个函数,不许合并**。走 `i18n.global.t`,键:`aiKbJustNow` `aiKbMinAgo` `aiKbHrAgo` `aiKbDaysAgo` `aiKbMonthsAgo` |
| `fmtAbs(ts)` | `:417-422` | `YYYY-MM-DD HH:mm`,`padStart(2,'0')`;**不接 i18n**(蓝本如此) |
| `simplifyMime(m)` | `:425-436` | 🔴 **8 条 if 的顺序有意义**(`docling` / `wordprocessing` 在 `legacy-office` 之前);`legacy: true` **只在** `legacy-office` 与 `ms-powerpoint`/`presentation` 两条上 |
| `topSegment(path)` | `:439-444` | `/^\/([^/]+)\//` —— 🔴 **要求尾部有第二个斜杠**:`/DATA` 返 `null`、`/DATA/x` 返 `'DATA'` |

🔴 **逐字等价蓝本**。先 `git show main:` 把这 49 行原文拉出来贴进报告,再照着写。
🔴 **如果蓝本实际代码与我上面写的有出入,以蓝本为准**,并在报告里指出差异(那是任务书的错);
拿不准就返回 `NEEDS_CONTEXT` 问我。

## 测试要求(本任务的真正难点)

🔴 **`fmtBytes` 与 `fmtRel` 的每个档位两侧都要有边界断言**,一个都不许少:

- `fmtBytes`:**1023 / 1024**、**10239 / 10240**(这个是 `toFixed` 位数切换点,最容易漏)、
  以及 MB→GB 的切换点两侧;外加 `null` / `undefined` / `0` 三个特例
- `fmtRel`:**44 / 45 秒**、**59 / 60 分**、**23 / 24 时**、**29 / 30 天**

**理由**(写进报告):P5a T6 把 `fmtAgo` 的 `h < 24` 改成 `h < 48`,**16/16 用例全绿** ——
不钉两侧就等于没测。

其余:

- 🔴 **`fmtRel` 的断言要比「中文渲染文案」**,不只比分支
  (即断言渲染出来是「3 分钟前」这种确切串,值回附录 A 核)。
  测试里需要初始化 i18n —— 照本仓既有 util 测试的写法,别自己造。
- **`simplifyMime`**:8 条分支各一条用例 + **一条顺序陷阱用例**
  (构造一个**同时含 `presentation` 与 `legacy-office`** 的串,断言它落在蓝本实际会落的那一条)
- **`topSegment`**:`/DATA`(返 `null`)与 `/DATA/x`(返 `'DATA'`)两侧都要有
- **`fmtAbs`**:🔴 **注意时区** —— `padStart` 出来的是**本地时间**。
  用固定时间戳时要么锁时区、要么用不受时区影响的断言方式,别写出一条在别的机器上会红的用例
- 断言一律**钉死确切值**(`toBe('9.9 KB')` 这种),不是 `toBeTruthy()` / `toContain()` 松形式

## 测试门(提交前必须三门全过)

```
pnpm test                      # 全量
pnpm exec vue-tsc --noEmit     # 0 错
pnpm build                     # 通过
```

**基线(协调者实测)**:见本文件末尾「起点」。预期增量:**+1 文件,+25~30 例**。
实测多少报多少,差了要解释。

已知噪声(只它们红才复跑一次并说明,别去修):
`src/files/upload/persist.test.ts > dropPersisted …`(既有 IndexedDB flaky)· `AgentComposer.test.ts` 的 vue-i18n teardown 竞态。

## DoD

- 三门全绿
- 五个函数与蓝本 `:396-444` **逐字等价**(报告里贴蓝本原文 + 落地代码对照)
- **每个档位两侧的边界断言逐个到位**(报告里给边界覆盖表:档位 / 左侧值 / 右侧值 / 用例名)
- `fmtRel` 断言的是中文渲染文案,值与附录 A 一致
- `simplifyMime` 8 条分支 + 1 条顺序陷阱
- `fmtBytes` 的 `null` / `undefined` / `0` 三个特例各有用例,且 `0` 明确断言 `'0 B'`
- `fmtAbs` 的用例不受运行机器时区影响
- **`fmtRel` 没有与 store 的 `fmtAgo` 合并**(报告里说明两者档数不同)

## 🔴 RED 探针(至少 3 次,每次贴「改了什么 → 哪个用例报红 → 报红文本」,然后**改回来**并确认 `git status --short` 干净)

1. `fmtRel` 的 `s < 45` 改成 `s < 90` → 精确报红
2. `simplifyMime` 前两条 `if` 互换 → 精确报红
3. `topSegment` 的正则去掉尾斜杠(`/^\/([^/]+)\//` → `/^\/([^/]+)/`)→ 精确报红
4. **强烈建议再加一次**:`fmtBytes` 的 `n < 10240 ? 1 : 0` 改成恒 `1` → 确认那条 `toFixed` 位数切换的边界用例报红
   (这一条正是 P5a T6 栽过的同款,证明你的边界断言真的钉住了)

## 硬约束(治理文件有全文,这里只挑最要命的)

- 可写仓只有 `/home/nimo/NimoTech/.sp8/NimoOS-New-UI`(分支 `sp8-ai`)
- `/home/nimo/NimoTech/NimoOS-UI` **只读,且是多会话共享的检出**,只能 `git show main:<path>`
- `NimoOS-New-UI`(SP6/SP9)与 `.sp7/NimoOS-New-UI`(SP7)**禁碰**
- 治理 §1.1 的**全期零改动清单**一个都不许碰(含 `util/indexedFiles.ts` / `dashboardHelpers.ts`
  —— 可**读**不可改;也**不许**去改 store 里的 `fmtAgo`)
- 禁 `git add -A` / `git add .` —— **只用显式 pathspec**;禁 rebase / reset / stash / merge / push
- 不跑 `./scripts/deploy.sh`,不写 `/var/lib`
- **不许新增 i18n 键** —— 五个键 T1 已落。少了任何一个 → 停下返回 `NEEDS_CONTEXT` 问我
- **行为 1:1 照抄 Vue2**;Vue2 的 bug / 竞态 / 吞错不照抄,但**这五个函数里的怪行为
  (`0` 返 `'0 B'` 而非 `'—'`、`toFixed` 位数条件式、8 条 if 的顺序、`topSegment` 要第二个斜杠)
  全是渲染结果的一部分,属照抄条**。
  遇到治理文件**没登记过**的同类情况,**停下返回 `NEEDS_CONTEXT` 问我**,别自己拍

## 提交

`git add -f` 逐个显式路径(两个新文件 + 报告),**一次 commit**。

## 报告契约

**完整报告写进** `/home/nimo/NimoTech/.sp8/NimoOS-New-UI/.superpowers/sdd/p5b-task-7-report.md`:
蓝本 `:396-444` 原文 + 落地代码逐行对照 · **边界覆盖表**(每个档位两侧)· `simplifyMime` 8 分支 + 顺序陷阱的用例位置 ·
`fmtRel` 中文断言值与附录 A 的对照 · `fmtAbs` 怎么处理时区 · RED 探针的原始报红文本 ·
三门实测数字 · 与任务书描述不一致的地方(如有)· 遗留疑问。

**返回给我的正文 5 行以内**:状态(`DONE` / `DONE_WITH_CONCERNS` / `NEEDS_CONTEXT` / `BLOCKED`)·
commit 短哈希 · 三门一行数字 · 蓝本对照是否逐字等价 · 最要紧的 1–2 个 concern。**不要把报告正文贴回来。**

## 起点

分支 `sp8-ai` · **BASE = `15a8b76`** · **实测基线 = 316 文件 / 2966 例全绿**,`vue-tsc` 0,`vite build` 0。
