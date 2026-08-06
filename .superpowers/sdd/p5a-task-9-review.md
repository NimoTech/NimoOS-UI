# SP8-P5a Task 9 独立评审 —— `dashboardHelpers.ts`

评审者:独立评审 agent(sonnet),未采信实现者报告,蓝本一律 `git show main:` 读取。

## 1. 蓝本逐行对照(四函数)

蓝本:`NimoOS-UI` main@7a6ee6b7 `src/views/AI/Knowledge/dashboardHelpers.js`(34 行)。
本仓:`.sp8/NimoOS-New-UI/src/ai/knowledge/util/dashboardHelpers.ts`(54 行,含类型注解与移植注释)。

| 函数 | 蓝本行 | 本仓行 | 结论 |
|---|---|---|---|
| `updatePeak(peak, backlog)` | 7-9:`return Math.max(peak \|\| 0, backlog \|\| 0)` | 15-17 | **逐字等价**,仅加 `: number` 类型注解 |
| `progressPercent(backlog, peak)` | 11-15:`if (!peak \|\| peak <= 0) return 0` / `Math.round((1 - backlog/peak)*100)` / `Math.min(100, Math.max(0, pct))` | 20-24 | **逐字等价**,除零/负数守卫、`Math.round` 取整、双向夹取全部照搬,顺序未变 |
| `summarizeNotes(notes)` | 17-28:`for...of notes \|\| []`,`if(!n) continue`,`if/else if` 三态链 | 30-42 | **逐字等价**,`if/else if` 链未被改写成 `reduce`/查表,循环结构原样保留 |
| `fmtEta(etaS)` | 31-36:`etaS==null\|\|etaS<=0`→`''`,`<60`→`'<1m'`,`Math.floor(etaS/60)`,`<60`(分)→`` `${m}m` ``,否则 `` `${Math.floor(m/60)}h ${m%60}m` `` | 48-54 | **逐字等价**,含 `h` 与 `m` 之间的空格,`Math.floor` 未被换成 `Math.round` |

**未发现任何「结果等价但改写法」的未授权重构**:四个函数的分支结构、比较符方向、`if/else if` 链形态、循环写法(`for...of` 未改 `reduce`/`map`/`filter`)均与蓝本字符级一致,仅新增 TS 类型标注,符合治理文件 §2「移植纪律」与 §9 的字面照搬要求。

**参数顺序**:`updatePeak(peak, backlog)`、`progressPercent(backlog, peak)` 与 brief Interfaces 块声明完全一致,顺序未颠倒。签名与蓝本形参名顺序(`function updatePeak(peak, backlog)` / `function progressPercent(backlog, peak)`)也一致。

**类型**:全文无 `any`,`summarizeNotes` 入参类型 `{ status?: string }[] | undefined | null`、返回 `{ total; draft; curated; archived }`,`fmtEta` 入参 `number | null | undefined`、返回 `string` —— 与 brief Interfaces 块签名逐字符一致。

## 2. `fmtEta` 英文字面量

`'<1m'` / `` `${m}m` `` / `` `${Math.floor(m/60)}h ${m%60}m` `` **未接入 i18n**(未见 `t()`/`useI18n` 调用,`grep` 确认全文件零 i18n 依赖)。代码 44-47 行有专门注释,引用蓝本行号 `dashboardHelpers.js:29-34`,并显式写明"接入会改变蓝本约定的界面文案,属未授权偏离"。**合规**。

## 3. 原 spec 逐条对照

蓝本 `NimoOS-UI` main@7a6ee6b7 `src/views/AI/Knowledge/__tests__/dashboardHelpers.spec.js` 自数确认 **6 条 `it`**(非采信实现者报告,自己逐行数过):

| # | 蓝本用例 | 蓝本断言 | 本仓对应 | 断言是否等价/弱化 |
|---|---|---|---|---|
| 1 | `updatePeak is a rolling max` | `(0,50)=50 / (50,30)=50 / (50,80)=80` | `updatePeak 是滚动最大值` | 三条数值逐字相同,**未弱化** |
| 2 | `progressPercent stays within 0..100 and recedes when backlog grows` | `(0,0)=0 / (100,100)=0 / (25,100)=75 / (0,100)=100 / updatePeak(100,120)后(120,peak)=0` | `progressPercent 夹在 0..100...` | 五条数值逐字相同,**未弱化** |
| 3 | `fmtEta renders human durations` | `null='' / 45='<1m' / 150='2m' / 5400='1h 30m'` | `fmtEta 渲染人类可读时长`(叠加 brief 补的 0/3600 两点) | 原四条全部保留,**未弱化**,只是追加而非替换 |
| 4 | `counts by status` | 4元素→`{4,2,1,1}` | `按状态计数` | 逐字相同,**未弱化** |
| 5 | `unknown statuses only bump the total` | `[weird,null,draft]`→`{2,1,0,0}` | `未知状态只加 total` | 逐字相同(`null as never` 仅类型断言写法差异,运行时行为不变),**未弱化** |
| 6 | `empty and missing input yield zeros` | `[]`→全0,`undefined`→全0 | `空输入与缺省输入都是全 0` | 逐字相同,**未弱化** |

**结论:原 6 条全部移植,一条未漏、一条未弱化**。brief 逐字追加的 3 条边界(`updatePeak` 缺省容忍、`progressPercent` 负 peak、`fmtEta` 0/3600 两点)与实现者补充的 6 条分支两侧对照用例经核对均为新增覆盖,不影响原 6 条的完整性。测试文件总计 14 条,与实现者报告「6 原 + 3 brief + 补充」的算术一致(自己数的 `it` 数与 vitest 实测 14 条吻合)。

## 4. 独立 RED 探针(四条,均为本评审自选,不复用实现者的三条)

1. **`updatePeak` 参数顺序互换**(函数体内 `Math.max(peak||0, backlog||0)` → `Math.max(backlog||0, peak||0)`)→ **全绿,14/14,无人报红**。已还原(`git status --short` 干净)。
   - **这是一条真实发现,但不是可修复的测试缺陷**:`Math.max(a,b) === Math.max(b,a)` 对任意实数恒成立,`updatePeak` 在数学上对两个参数**天然对称**——无论函数体内部顺序、还是调用方传参顺序颠倒,输出永远相同。因此"参数顺序写反"对 `updatePeak` **不存在可被单测捕获的行为差异**,不是本次移植的缺陷,是该函数固有的数学性质。按 Important 报,建议：不必新增测试(加不出有判别力的用例),但可在函数注释追加一句说明"因 Math.max 对称,参数顺序对本函数无行为影响,顺序仅为与蓝本签名保持一致",避免后续读者误以为顺序是行为约束。
2. **`progressPercent` 取整方式**(`Math.round` → `Math.floor`)→ **报红,1/14**,报红用例:`progressPercent 分支边界补充 > 非整除结果四舍五入(Math.round,不是截断)`(`expected 66 to be 67`)。已还原,复跑 14/14 绿。
3. **`summarizeNotes` 未知 status 落桶**(在 `if/else if` 链末尾追加 `else s.draft++`)→ **报红,1/14**,报红用例:`summarizeNotes > 未知状态只加 total(分布条不虚报)`(`expected draft:2 to be draft:1`)。已还原,复跑 14/14 绿。
4. **`fmtEta` 小时/分钟拼接格式**(`` `${h}h ${m}m` `` 去掉空格 → `` `${h}h${m}m` ``)→ **报红,2/14**,报红用例:`fmtEta 渲染人类可读时长`(`expected '1h30m' to be '1h 30m'`)、`{m}m 与 {h}h {m}m 的小时边界两侧(59 分 vs 60 分)`(`expected '1h0m' to be '1h 0m'`)。已还原,复跑 14/14 绿。

## 5. 提交卫生

- `git show --stat 9ec4b06`:仅 2 个文件(`dashboardHelpers.ts` +54、`dashboardHelpers.test.ts` +110),自己核对属实。
- `git status --short`(本仓):干净。
- `.sp8/NimoOS-Service`:`git status --short` 干净,最近提交(`03d3028`/`55f42dc`/`feb85bc`)均属 wiki/notes 域任务,与 T9 无关,**无本任务新提交**。
- `NimoOS-UI`(只读蓝本仓):仅一个既有未跟踪文件 `FRONTEND_API_GUIDE.md`(与本任务无关,评审全程未碰)。

## 6. §3.5 N1-N8

本任务不涉及后端字段归一化/超时/竞态防截断等场景,N1-N8 均不适用,实现者报告的说明属实。

## 7. 三门实测(评审自己跑)

```
pnpm test                  exit=0   Test Files 310 passed (310)   Tests 2783 passed (2783)
pnpm exec vue-tsc --noEmit exit=0   (无输出)
```
与实现者报告数字完全吻合(基线 309/2769 + 本任务 1 文件/14 例 = 310/2783)。`pnpm build` 未重跑(实现者已跑 exit 0,治理文件允许不重跑)。

## 8. 判定

- **Spec 合规:✅**
- **任务质量:通过**
- **Critical:0 条 / Important:1 条**(见下)

### Important
- **`updatePeak` 参数顺序对函数行为无判别力**(因 `Math.max` 天然对称)——不是本次移植引入的缺陷,是函数固有数学性质;建议补一句代码注释说明,不要求补测试(补不出有意义的判别用例)。

无 ⚠️ 待协调者裁定项。
