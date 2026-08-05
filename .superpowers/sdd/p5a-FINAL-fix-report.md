# SP8-P5a 终审一次性修复轮 —— 报告(2026-08-01)

范围:终审 `p5a-FINAL-review.md` 判定「可以交用户验收,零 Critical、零 Important」,
本轮只收 5 条 Minor + 1 条覆盖缺口(⚠️-D1)+ 2 条本终审新发现的 Minor(H6 文档 · Minor-1/2)
里指名要修的 7 条,不做任何功能改动。

两个仓各一个提交:
- Service `sp8-ai`:`15c2eba`
- New-UI `sp8-ai`:见下方(commit sha 在报告末尾,与终态一致)

---

## 1. Service `src/wiki.ts:176` 蓝本行号订正

- 改前:`/* SP8-P5a Task 2 结构性偏离(评审裁定合理): 蓝本 wiki.js:89-92 的这四个 …`
- 改后:`/* SP8-P5a Task 2 结构性偏离(评审裁定合理): 蓝本 wiki.js:93-96 的这四个 …`
- 复核:`cd /home/nimo/NimoTech/NimoOS-UI && git show main:src/service/wiki.js | sed -n '80,100p'`
  实测 `:88-91` 是 `getRaw` 方法体(`api.get('${PREFIX}/raw', …)` + 类型转换),
  `createRoot`/`deleteRoot`/`rescanRoot`/`patchRootEnabled` 四个方法确实在 `:93-96`。
- 只改注释,不改任何行为。

## 2. New-UI `src/ai/knowledge/util/dashboardHelpers.ts:6` 头注释订正

- 改前:「本任务全部搬入,供 T7(`loadNotesSummary` 消费 `summarizeNotes`)与 T12
  (`DashboardView` 消费 `progressPercent`/`fmtEta`/`updatePeak`)使用。」
- 改后:去掉 `updatePeak` 作为 T12 消费方的表述,新增一段说明:`updatePeak` 在蓝本里
  本身就是死代码(`git grep updatePeak main -- src/views/AI/Knowledge` 只命中定义处 +
  它自己的 spec),移植后同样无生产消费者(`knowledgeStore.ts:317` 与
  `DashboardView.vue` 头注释「发现,非缺陷」段都各自照抄内联 `Math.max`),保留只是
  为了与蓝本 1:1(蓝本导出它,本仓就搬它)。
- 未删除 `updatePeak` 函数(1:1 parity),未补判别用例(`Math.max(a,b)` 天然对称,
  终审明确不要求)。

## 3. New-UI 治理文件 `.superpowers/sdd/p5a-common-constraints.md` §8 收官算术订正

- 改前:「本批新增 4 个 `.vue`……收官应为 **307 文件**。」
- 改后:订正为「收官应为 313 文件」,并补充完整算术:
  - 起点 **303 文件 / 2719 例** → 收官 **313 文件 / 2866 例**
  - 构成:**+10 个新 `*.test.ts` 文件**(`--diff-filter=A` 实测,删除 0,303+10=313)、
    **+147 例**(2719+147=2866),其中 **4 例**来自 4 个新增 `.vue` 带来的
    color-guard 动态用例,其余 143 例分布在 10 个新文件 + `messageSyntax.test.ts`
    新增 5 条 + `router/index.test.ts` 新增 1 条。
- 这是本轮最要紧的一条 —— 该文件是本期唯一被 git 跟踪的台账文件,P5b 会照它算基线。

## 4. New-UI `knowledgeStore.ts` 补 P3 标号

- 改前(`:477-479`):「蓝本 :102-107 —— agent 离线时静默保留旧值,不 toast(K6:
  不照抄 console.error,连日志都不打)。K1:`service.notes.list` 已归一化返回
  `Note[]`,不再剥 `r.data.notes`。」
- 改后:追加「【偏离 P3】蓝本此处是 `api.get('/ai/agent/notes',
  {status:'draft',limit:200})` 直调 axios,本仓改走 `service.notes.list(...)`
  (P0 既定「REST 一律走包」)。」
- 验证:`grep -n 'P3\b' src/ai/knowledge/stores/knowledgeStore.ts` 从 0 命中变为
  1 命中(:479)。只加标号,注释其余内容不变。

## 5. New-UI `DashboardView.vue:533` 补申报注释(Minor-2)

- 改前:`<span v-if="(e.badge || 0) > 0" …>` 前无任何说明。
- 改后:补一段行内 HTML 注释,注明蓝本 `:361` 原文是 `v-if="e.badge > 0"`,本仓因
  `EntryItem.badge` 是 optional、strict 模式下不能对 `undefined` 直接 `> 0` 比较,
  改成 `(e.badge || 0) > 0`,与同文件 `:128-134` 已申报的 M-1(`queueDepth` 兜底)
  同一类机械改写,任何输入下行为等价。代码本身未改。

## 6. New-UI `KnowledgeLayout.test.ts:207` 弱断言收紧

- 改前:`expect(w.find('.k-rail-svc-meta').text()).toContain('1,234') // toLocaleString`
- 改后:`expect(w.find('.k-rail-svc-meta').text()).toBe('运行中 · 1,234 已收录')`
  (整串精确匹配,值来自 `aiKbRunningIndexed` 键 `'运行中 · {n} 已收录'` +
  `(1234).toLocaleString()`)。
- **RED 探针(已做,已还原)**:临时把测试里的 `indexed_files: 1234` 改成
  `11234`,跑 `pnpm exec vitest run src/ai/knowledge/views/KnowledgeLayout.test.ts`:
  ```
  FAIL  … > 三态:unreachable → error/离线;paused → paused/已暂停;否则 running/已收录数
  AssertionError: expected '运行中 · 11,234 已收录' to be '运行中 · 1,234 已收录'
  Tests  1 failed | 23 passed (24)
  ```
  精确报红(旧的 `toContain('1,234')` 对 `'11,234'.includes('1,234')` 会误判通过,
  新断言不会)。已改回 `1234`,`diff` 对比 `/tmp/…/KnowledgeLayout.test.ts.bak`
  与工作区文件为空,确认还原。

## 7. New-UI `src/ai/styles/knowledgeStyles.test.ts` —— 浅色档 token 覆盖集合断言

新增一个 `describe`(位于文件 :296 之后,var() 闭环 describe 之前),两条 `it`:

1. **`暗色块声明的每一个颜色 token,浅色块必须也声明(白名单外漏一个就精确指名)`**
   —— 对暗色块(`.knowledge-app {`)与浅色块(`:root[data-theme="light"]
   .knowledge-app {`)各自解析出全部 `--token:` 声明名集合,排除例外清单后做差集,
   非空即报红并指名缺失的 token。
2. **`例外清单当前恰好是这 11 个,不多不少`** —— 反向核账:实际「暗有浅无」差集
   必须与登记的例外清单完全相等,防止例外清单被静默扩大成垃圾桶,或者清单里的
   条目其实已经不再是真实差集。

### 例外清单(`SHARED_STRUCTURAL_EXCEPTIONS`,共 11 条)

| # | Token | 理由 |
|---|---|---|
| 1 | `--r-xs` | 圆角半径,无色度/色相/明度信息,不是颜色 token;附录 B 原文归类为「结构量,两档共享,只写基础块」 |
| 2 | `--r-sm` | 同上 |
| 3 | `--r-md` | 同上 |
| 4 | `--r-lg` | 同上 |
| 5 | `--r-xl` | 同上 |
| 6 | `--r-2xl` | 同上 |
| 7 | `--r-pill` | 同上 |
| 8 | `--font-sans` | 字体栈,同样是无色结构量 |
| 9 | `--font-mono` | 同上 |
| 10 | `--grad-iri` | 品牌彩虹渐变,与皮肤无关;回源核实 `tokens.scss` 自己也只在 `:119-120` 声明一次(暗色块 `:250` 起不重定义),`.agent-app` 两档共用同一份,与本档做法一致,属 `theme.css` 例外清单第 1 类(品牌识别色) |
| 11 | `--grad-iri-soft` | 同上 |

程序化核对(`node` 脚本,直接跑 `declBlockRange` + 正则统计声明名):暗色块共
56 个 `--` 声明、浅色块共 45 个,差集恰好是这 11 个,与终审 D.3 的复核数字
(56/45/11)完全一致。

### RED 探针(两次,均已做、已还原)

**探针 1(暴露覆盖缺口,验证新断言能报红)**:删掉浅色块
`--line-strong: #D8D3C7;` 一整行 →
```
FAIL src/ai/styles/knowledgeStyles.test.ts
 > 暗色块声明的每一个颜色 token,浅色块必须也声明(白名单外漏一个就精确指名)
AssertionError: 浅色档漏声明的颜色 token(白名单外):--line-strong:
  expected [ '--line-strong' ] to deeply equal []
 > 例外清单当前恰好是这 11 个,不多不少(防止清单被悄悄扩大当垃圾桶)
AssertionError: expected [...(10)] to deeply equal [...(9)]
Tests  2 failed | 189 passed (191)
```
两条新断言都精确报红并指名 `--line-strong`。已用 `cp` 从
`/tmp/…/knowledge.scss.bak` 还原,`git status --short src/ai/styles/knowledge.scss`
为空。

**探针 2(验证例外清单不误报)**:删掉基础块的 `--r-xs: 6px;` 一整行(结构量,在
例外清单里)→
```
Tests  1 failed | 190 passed (191)
```
只有「例外清单恰好是这 11 个」这条**账目核对**断言报红(因为暗色块实际声明的
token 集合变了,差集不再是登记的 11 个,而是少了 `--r-xs` 这一项——这是账目性
质的红,不是「浅色块缺了颜色」性质的红);**主断言(覆盖检查)保持绿色**,证明
删掉一个登记在例外清单里的结构量,**不会**因为「浅色块本来就没有它」而被误判成
颜色 token 覆盖缺口 —— 例外清单机制按预期生效。已用 `cp` 还原,
`git status --short src/ai/styles/knowledge.scss` 为空。

（对照:探针 2 之所以没有让主断言报红,是因为主断言只关心「暗色块**现存**的
颜色 token 是否都在浅色块」——`--r-xs` 一旦从暗色块移除,它就不再是需要浅色块
覆盖的对象了。若真机场景是「结构量真的被误删导致其他规则的 `var(--r-xs)`
失效」,那属于既有的「var() 闭环」测试(评审 Important I-3)的职责范围,不是
本条覆盖断言要管的层次,两条测试各自负责一层,不重复也不缺位。）

---

## 三门终值

### New-UI
```
pnpm test                  → Test Files 313 passed (313) / Tests 2868 passed (2868), exit=0
pnpm exec vue-tsc --noEmit → 输出为空,exit=0
pnpm build                 → exit=0,只有既有 >500KB chunk 告警,零 sass 告警
```
用例数从基线 2866 → 2868(+2),来自本轮第 7 条新增的两条断言(覆盖检查 + 账目
核对);文件数不变(313,未新增 `.vue` / `.test.ts` 文件,只编辑既有文件)。
第 6 条(`toContain`→`toBe`)不改变用例数。

### Service
```
pnpm test → Test Files 26 passed (26) / Tests 227 passed (227), exit=0
```
未新增/删除任何测试,数字与基线一致。

首跑即全绿,两条已知噪声(`persist.test.ts` IndexedDB flaky · `AgentComposer`
vue-i18n teardown)本次未出现,未复跑。

---

## 提交

### Service
```
commit 15c2eba
docs(wiki): 终审 Minor —— 蓝本行号引用订正 89-92 → 93-96
 src/wiki.ts | 2 +-
 1 file changed, 1 insertion(+), 1 deletion(-)
```
`git status` 收尾:`nothing to commit, working tree clean`。

### New-UI
```
commit ac110e09bf8a6834638bd1b1e3e0622e33801213
docs(knowledge): 终审一次性修复轮 —— 7 条 Minor/覆盖缺口
```
文件:
```
.superpowers/sdd/p5a-common-constraints.md     | 11 ++++-
src/ai/knowledge/stores/knowledgeStore.ts      |  4 +-
src/ai/knowledge/util/dashboardHelpers.ts      | 11 ++++-
src/ai/knowledge/views/DashboardView.vue       |  6 +++
src/ai/knowledge/views/KnowledgeLayout.test.ts |  4 +-
src/ai/styles/knowledgeStyles.test.ts          | 58 +++++++++++++++++++
6 files changed, 89 insertions(+), 5 deletions(-)
```
`git status` 收尾:`nothing to commit, working tree clean`。

---

## i18n / 偏离申报 / §3.5 照抄不改

本轮不涉及任何 i18n 新增/复用键,不涉及任何功能行为改动,§3 的 12 条偏离与 §3.5
的 8 条「照抄不改」均未被触碰(第 4/5 条只是给已有的、之前就存在的偏离**补注释
标号**,不是新造偏离)。
