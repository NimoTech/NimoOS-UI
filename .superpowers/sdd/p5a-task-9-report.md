# SP8-P5a Task 9 报告 —— `dashboardHelpers.ts`

## 提交

- sha: `9ec4b0667fd480ee07bf79432116e348d9f8aaa9`
- `git show --stat HEAD`:仅 2 个新文件(`dashboardHelpers.ts` +54 行、`dashboardHelpers.test.ts` +110 行),无改动其它文件。
- `git status --short`:干净(无输出)。

## 蓝本对照(`NimoOS-UI` main@`7a6ee6b72b4b8184f0045c200371899a44653478`)

蓝本路径:`src/views/AI/Knowledge/dashboardHelpers.js`(全文 34 行,4 个导出函数,逐字读取见下)。

| 蓝本行号 | 函数 | New-UI 位置 |
|---|---|---|
| `dashboardHelpers.js:1-9`(含头部注释 + 函数体) | `updatePeak(peak, backlog)` | `dashboardHelpers.ts` `updatePeak` |
| `dashboardHelpers.js:11-15` | `progressPercent(backlog, peak)` | `dashboardHelpers.ts` `progressPercent` |
| `dashboardHelpers.js:17-29`(含函数上方块注释) | `summarizeNotes(notes)` | `dashboardHelpers.ts` `summarizeNotes` |
| `dashboardHelpers.js:31-36` | `fmtEta(etaS)` | `dashboardHelpers.ts` `fmtEta` |

四个函数体逐字对照(比较运算符、短路写法 `peak || 0` / `backlog || 0`、`for...of` 循环、`if/else if` 链、`Math.floor`/`Math.round`/`Math.max`/`Math.min` 用法)全部一致,只加了 TS 类型注解,无逻辑改写。

## Vue2 原 spec 实际条数

原 spec `NimoOS-UI/src/views/AI/Knowledge/__tests__/dashboardHelpers.spec.js` 实测数了一遍,**确实是 6 条 `it`**(与 brief 描述一致,本次未发现条数不符,不需申报偏离):

| # | 原用例名 | 对应本仓用例 |
|---|---|---|
| 1 | `updatePeak is a rolling max` | `updatePeak 是滚动最大值` |
| 2 | `progressPercent stays within 0..100 and recedes when backlog grows` | `progressPercent 夹在 0..100,且 backlog 变大时回落` |
| 3 | `fmtEta renders human durations` | `fmtEta 渲染人类可读时长` |
| 4 | `counts by status` | `按状态计数` |
| 5 | `unknown statuses only bump the total (bar never over-reports)` | `未知状态只加 total(分布条不虚报)` |
| 6 | `empty and missing input yield zeros` | `空输入与缺省输入都是全 0` |

brief 逐字给出的测试代码在这 6 条基础上另加了 3 条断言层面的边界(未新增独立 `describe`,是揉进已有 `it` 或新增 `it`)：
- `updatePeak 容忍 0/NaN 缺省`(新增 it)
- `progressPercent 对负 peak 返回 0`(新增 it)
- `fmtEta` 用例里追加 `fmtEta(0)` 与 `fmtEta(3600)` 两个断言点(未拆 it)

以上 brief 代码**逐字照用,未改一字**。

## 本次移植新增的补充用例(非 brief 逐字部分,治理文件 §9 硬要求驱动)

按任务书要求「每个分支切换点都写两侧」，补了 4 组、共 6 条断言级新增：

1. `updatePeak` 相等边界:`updatePeak(50, 50)` = 50(既非"抬高"也非"保持"两侧的交界点,钉住 `Math.max` 在相等时的行为不被误改成非对称比较)。
2. `progressPercent` 取整方式两侧:`progressPercent(1,3)` = 67(向上舍入)vs `progressPercent(2,3)` = 33(向下舍入),钉住 `Math.round` 而非 `Math.floor`/`Math.ceil`。
3. `fmtEta` 分钟边界两侧:`fmtEta(59)` = `'<1m'` vs `fmtEta(60)` = `'1m'`。
4. `fmtEta` 小时边界两侧:`fmtEta(3540)` = `'59m'` vs `fmtEta(3600)` = `'1h 0m'`。
5. `fmtEta` 的 `<=0` 分支补充:`fmtEta(-10)` = `''`,`fmtEta(undefined)` = `''`(brief 只测了 `null`,undefined 走同一 `== null` 松散相等分支,这里显式补上)。
6. `summarizeNotes(null)` 显式测(brief 只测了 `undefined`,两者走同一 `notes || []` 兜底分支,这里显式补上)。

## 分支切换点清单(每函数)

- **`updatePeak`**:1 个切换点(`backlog > peak` 之抬高 vs `backlog <= peak` 之保持)。覆盖:抬高侧(50,80→80)、保持侧(50,30→50)、相等交界(50,50→50,补充用例)。另有两个独立的 `|| 0` 缺省短路分支(peak 缺省、backlog 缺省),brief 已各自覆盖一侧(缺省值 vs 正常值对照)。
- **`progressPercent`**:2 个切换点。① `peak<=0`(含负数)→ 0 的除零守卫 vs `peak>0` 正常计算路径(两侧都覆盖:`progressPercent(10,-5)`=0、`progressPercent(0,0)`=0 走守卫;`progressPercent(25,100)`=75 走计算路径)。② 取整方向(向上/向下舍入,补充用例两侧)。另有夹紧上下界两侧(`backlog=peak`→0 下界、`backlog=0`→100 上界,brief 已覆盖)。
- **`summarizeNotes`**:1 个主切换点(已知三态 `draft`/`curated`/`archived` 分别计数 vs 未知状态只加 total),brief 已四态各自覆盖 + 未知态覆盖。另一个切换点是入参兜底(`null`/`undefined`/`[]` 三种缺省輸入 vs 非空数组正常输入),brief 覆盖了 `undefined`/`[]`,本次补 `null`。falsy 元素跳过分支(`if (!n) continue`)brief 已用 `null as never` 元素覆盖。
- **`fmtEta`**:3 个切换点(`<=0`→`''` vs `>0`；`<60s`→`'<1m'` vs `>=60s`进入分钟计算；`<60min`→`'{m}m'` vs `>=60min`→`'{h}h {m}m'`)。三个切换点均补了两侧边界值探针,brief 只覆盖了各分支内部的代表值,未卡边界,本次全部补齐。

## `fmtEta` 英文字面量申报

`'<1m'` / `'{m}m'` / `'{h}h {m}m'`(蓝本 `dashboardHelpers.js:31-36`)是英文缩写字面量,不接 i18n。已在 `dashboardHelpers.ts` `fmtEta` 函数上方写注释说明这是蓝本原意、照抄不改,不接入 i18n 是因为接入会改变蓝本约定的界面文案,属未授权偏离(brief 硬约束显式点名)。

## 三次 RED 探针

**探针 1:`fmtEta` 分钟阈值 `< 60` → `< 61`**
- 改前:`if (etaS < 60) return '<1m'`
- 改后:`if (etaS < 61) return '<1m'`
- 报红用例:`src/ai/knowledge/util/dashboardHelpers.test.ts > fmtEta 分支边界补充 > <1m 与 {m}m 的分钟边界两侧(59s vs 60s)`
- 输出片段:`AssertionError: expected '<1m' to be '1m'`(`fmtEta(60)` 走错分支)
- 已还原,`git diff` 确认为空,`pnpm exec vitest run` 14/14 绿。

**探针 2:`updatePeak` 比较符方向 `Math.max` → `Math.min`**
- 改前:`return Math.max(peak || 0, backlog || 0)`
- 改后:`return Math.min(peak || 0, backlog || 0)`
- 报红用例(2 条):
  - `src/ai/knowledge/util/dashboardHelpers.test.ts > dashboard progress helpers > updatePeak 是滚动最大值`
  - `src/ai/knowledge/util/dashboardHelpers.test.ts > dashboard progress helpers > updatePeak 容忍 0/NaN 缺省`
- 输出片段:`AssertionError: expected +0 to be 50`(`updatePeak(0,50)` 应抬高到 50,`Math.min` 却压回 0)
- 已还原,`git diff` 确认为空,`pnpm exec vitest run` 14/14 绿。
- 附带观察:我方新增的相等边界用例 `updatePeak(50,50)=50` 在这次探针里**没有**报红(`Math.min(50,50)===Math.max(50,50)===50`,数学上相等边界对两个比较符方向不敏感,是预期内的,不是断言缺陷 —— 该用例存在的意义是钉住"相等即保持"的语义,而非区分 max/min 方向,方向已由另两条用例抓住)。

**探针 3:`progressPercent` 除零守卫删除**
- 改前:
  ```
  if (!peak || peak <= 0) return 0
  const pct = Math.round((1 - backlog / peak) * 100)
  ```
- 改后(删掉守卫行):
  ```
  const pct = Math.round((1 - backlog / peak) * 100)
  ```
- 报红用例(2 条):
  - `src/ai/knowledge/util/dashboardHelpers.test.ts > dashboard progress helpers > progressPercent 夹在 0..100,且 backlog 变大时回落`
  - `src/ai/knowledge/util/dashboardHelpers.test.ts > dashboard progress helpers > progressPercent 对负 peak 返回 0(不产生负值)`
- 输出片段:`expected NaN to be +0`(`progressPercent(0,0)` 除零得 NaN)、`expected 100 to be +0`(`progressPercent(10,-5)` 负 peak 未拦截,`(1-10/-5)*100=300` 夹到 100)
- 已还原,`git diff` 确认为空,`pnpm exec vitest run` 14/14 绿。

三次探针均精确报红、精确还原,无一次全绿(未出现「探针全绿=真实发现」的情况)。

## 三门终值

```
pnpm test                  exit=0   Test Files  310 passed (310)   Tests  2783 passed (2783)
pnpm exec vue-tsc --noEmit exit=0   (无输出)
pnpm build                 exit=0   (仅既有 >500KB chunk 警告,无新增)
```

算术核对:基线 `sp8-ai@8075c3d` = 309 文件/2769 例。本任务未新增 `.vue`(color-guard 用例数不变),新增 1 个测试文件、14 条用例 → 预期 310 文件/2783 例,实测**完全吻合**。本次全量跑未见任何红项(含已知噪声 `persist.test.ts` 的 IndexedDB flaky 与 `AgentComposer.test.ts` 的 i18n teardown 竞态,本次均绿,未触发,无需复跑)。

## §3.5「照抄不改」核对

本任务命中 N1-N8 中的**无一条**(dashboardHelpers 是纯数学/计数函数,不涉及后端字段归一化、超时、竞态防截断等 N 系列场景)。特此说明:本任务未触碰任何 N1-N8 涉及的代码路径。

## 偏离申报

无与需求无关的重构、改名或换库。除治理文件 §3 K1-K8/P1-P4 外无其它偏离;本任务本身不涉及 K/P 系列(纯函数,无 service 调用、无主题、无 i18n 新键)。

唯一需要说明的一点:brief 逐字测试代码与本次补充的"两侧边界"用例分别成组存放(带注释区隔),没有把补充断言混进 brief 原有的 `it` 块内部,便于评审区分「brief 逐字」与「本次新增覆盖」两部分来源,不算偏离,只是排版选择。

## 结论

DONE。四个函数与原 spec 6 条 + brief 补的 3 条边界全部落地,另补 6 条分支两侧断言,三次 RED 探针精确报红精确还原,三门全绿,提交仅含 2 个目标文件。
