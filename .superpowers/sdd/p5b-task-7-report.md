# P5b · T7 报告 —— `util/indexedFilesView.ts` 五个纯函数

分支 `sp8-ai`,起点 `15a8b76`(316 文件/2966 例全绿,`vue-tsc` 0,`vite build` 0)。

## 0. 新建文件

- `src/ai/knowledge/util/indexedFilesView.ts`
- `src/ai/knowledge/util/indexedFilesView.test.ts`

未改任何既有文件(`git status --short` 提交前只有这两个 `??` 未跟踪文件)。

## 1. 蓝本原文(`git show main:src/views/AI/Knowledge/IndexedFilesView.vue`,main@7a6ee6b7,`:396-444`)

```js
function fmtBytes(n) {
  if (n == null) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10240 ? 1 : 0)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / 1048576).toFixed(n < 10485760 ? 1 : 0)} MB`
  return `${(n / 1073741824).toFixed(2)} GB`
}

function fmtRel(ts) {
  if (!ts) return '—'
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000))
  if (s < 45) return i18n.t('just now')
  const m = Math.floor(s / 60)
  if (m < 60) return i18n.t('{m} min ago', { m })
  const h = Math.floor(m / 60)
  if (h < 24) return i18n.t('{h} hr ago', { h })
  const d = Math.floor(h / 24)
  if (d < 30) return i18n.t('{d} days ago', { d })
  return i18n.t('{n} months ago', { n: Math.floor(d / 30) })
}

function fmtAbs(ts) {
  if (!ts) return '—'
  const d = new Date(ts)
  const p = x => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

// mime → short friendly tag
function simplifyMime(m) {
  if (!m) return { label: 'FILE', kind: 'doc' }
  if (m.includes('docling') || m.includes('wordprocessing')) return { label: 'DOCX', kind: 'doc' }
  if (m.startsWith('application/legacy-office')) return { label: 'DOC', kind: 'doc', legacy: true }
  if (m.startsWith('application/pdf')) return { label: 'PDF', kind: 'pdf' }
  if (m.includes('spreadsheet')) return { label: 'XLSX', kind: 'txt' }
  if (m.includes('ms-powerpoint') || m.includes('presentation')) return { label: 'PPT', kind: 'code', legacy: true }
  if (m.startsWith('text/markdown')) return { label: 'MD', kind: 'md' }
  if (m.startsWith('text/x-')) return { label: 'CODE', kind: 'code' }
  if (m.startsWith('text/plain')) return { label: 'TXT', kind: 'txt' }
  return { label: 'FILE', kind: 'doc' }
}

// Extract top-level path segment (best-effort root list from the current page)
function topSegment(path) {
  if (!path) return null
  // path like /DATA/Wiki/... → 'DATA'
  const m = path.match(/^\/([^/]+)\//)
  return m ? m[1] : null
}
```

**与任务书描述的差异**:任务书行 43-47 的描述与蓝本实际代码**逐字一致**,没有出入。行号也对(`:396-402`/`:404-415`/`:417-422`/`:425-436`/`:439-444`)。

## 2. 逐行对照

| 蓝本 | New-UI | 差异 |
|---|---|---|
| `fmtBytes(n)` | `export function fmtBytes(n: number \| null \| undefined): string` | 只加类型注解,逻辑逐字相同 |
| `fmtRel(ts)` | `export function fmtRel(ts: number \| null \| undefined): string` | `i18n.t('just now')` → `i18n.global.t('aiKbJustNow')`,五个英文字面量键换成 `aiKb*` 键(渲染出的中文文案逐字相同,值见附录 A);写法照 `stores/knowledgeStore.ts` 里 `fmtAgo` 的 `i18n.global.t(...)` 既有用法 |
| `fmtAbs(ts)` | `export function fmtAbs(ts: number \| null \| undefined): string` | 只加类型注解,不接 i18n(蓝本如此),逐字相同 |
| `simplifyMime(m)` | `export function simplifyMime(m: string \| null \| undefined): MimeTag` | 只加类型注解(`MimeTag` 接口),9 条 if(含 guard clause)顺序、条件、返回值逐字相同 |
| `topSegment(path)` | `export function topSegment(path: string \| null \| undefined): string \| null` | 只加类型注解,逐字相同 |

**结论:五个函数与蓝本逐字等价**(唯一改动是 i18n 键名从蓝本的裸英文字符串换成本仓的 `aiKb*` 键,这是 K12 抽取到 New-UI 的必要改动,渲染文案不变)。

## 3. 边界覆盖表

### fmtBytes

| 档位/切换点 | 左侧值 → 输出 | 右侧值 → 输出 | 用例名 |
|---|---|---|---|
| B/KB | 1023 → `'1023 B'` | 1024 → `'1.0 KB'` | `B/KB 边界:1023 -> '1023 B'；1024 -> '1.0 KB'` |
| KB 档 toFixed 位数 | 10239 → `'10.0 KB'` | 10240 → `'10 KB'` | `KB 档 toFixed 位数切换:10239 -> '10.0 KB'（1 位小数）；10240 -> '10 KB'（0 位小数）— IndexedFilesView.vue:398, copied verbatim` |
| MB 档 toFixed 位数 | 10485759 → `'10.0 MB'` | 10485760 → `'10 MB'` | `MB 档 toFixed 位数切换:10485759 -> '10.0 MB'；10485760 -> '10 MB' — IndexedFilesView.vue:399, copied verbatim` |
| MB/GB | 1073741823 → `'1024 MB'` | 1073741824 → `'1.00 GB'` | `MB/GB 边界:1073741823 -> '1024 MB'；1073741824 -> '1.00 GB'` |
| 特例 | `null`→`'—'`、`undefined`→`'—'` | `0`→`'0 B'`(不是 `'—'`) | `null/undefined 返回 em dash，0 返回 '0 B'（宽松相等 == 不拦 0）— IndexedFilesView.vue:397, copied verbatim` |

### fmtRel

| 档位切换点 | 左侧值 → 输出 | 右侧值 → 输出 | 用例名 |
|---|---|---|---|
| 秒/分(44/45) | s=44 → `'刚刚'` | s=45 → `'0 分钟前'`(m=0,蓝本怪行为,照抄) | `秒/分 边界:44 秒(s=44)→ 刚刚；45 秒(s=45,m=0)→ 0 分钟前 — IndexedFilesView.vue:406-407, copied verbatim` |
| 分/时(59/60) | m=59 → `'59 分钟前'` | m=60 → `'1 小时前'` | `分/时 边界:59 分钟(m=59)→ 59 分钟前；60 分钟(m=60)→ 1 小时前` |
| 时/天(23/24) | h=23 → `'23 小时前'` | h=24 → `'1 天前'` | `时/天 边界:23 小时(h=23)→ 23 小时前；24 小时(h=24)→ 1 天前` |
| 天/月(29/30) | d=29 → `'29 天前'` | d=30 → `'1 个月前'` | `天/月 边界:29 天(d=29)→ 29 天前；30 天(d=30)→ 1 个月前 — IndexedFilesView.vue:414-415, copied verbatim` |
| 特例 | `null`/`undefined`/`0` → `'—'` | | `null/undefined/0 全部返回 em dash（与 fmtAgo 一致，但与 fmtBytes 的 0 特例相反）` |

四个切换点两侧全部有断言,一个不少;外加 `null`/`undefined`/`0` 特例、一条普通值「3 分钟前」、一条普通月值「2 个月前」。

## 4. `fmtRel` 中文渲染文案 vs 附录 A 对照

| 键 | 断言渲染值 | 附录 A 值 |
|---|---|---|
| `aiKbJustNow` | `'刚刚'` | 刚刚 |
| `aiKbMinAgo` | `'3 分钟前'` / `'59 分钟前'` / `'0 分钟前'` | {m} 分钟前 |
| `aiKbHrAgo` | `'23 小时前'` / `'1 小时前'` | {h} 小时前 |
| `aiKbDaysAgo` | `'29 天前'` / `'1 天前'` | {d} 天前 |
| `aiKbMonthsAgo` | `'1 个月前'` / `'2 个月前'` | {n} 个月前(A.1 #32) |

全部逐字比对一致(值从 `src/i18n/zh_cn.ts:1441-1444,1550` 实读,未凭空编造)。

## 5. `simplifyMime` 8 分支 + 顺序陷阱

| 分支 | 输入 | 期望输出 | 用例位置 |
|---|---|---|---|
| guard(不计入 8) | `null`/`undefined`/`''` | `{label:'FILE',kind:'doc'}` | `无 mime(...)-> FILE/doc（guard clause，不计入 8 条）` |
| 1 | docling / wordprocessing(两个 `||` 分量各测) | `{label:'DOCX',kind:'doc'}` | `分支 1:docling...` / `分支 1:wordprocessing...` |
| 2 | legacy-office | `{label:'DOC',kind:'doc',legacy:true}` | `分支 2:legacy-office -> DOC/doc，legacy: true` |
| 3 | pdf | `{label:'PDF',kind:'pdf'}`,`legacy` 为 `undefined` | `分支 3:pdf -> PDF/pdf（无 legacy 字段）` |
| 4 | spreadsheet | `{label:'XLSX',kind:'txt'}` | `分支 4:spreadsheet -> XLSX/txt` |
| 5 | ms-powerpoint / presentation(两个 `||` 分量各测) | `{label:'PPT',kind:'code',legacy:true}` | `分支 5:ms-powerpoint...` / `分支 5:presentation...` |
| 6 | text/markdown | `{label:'MD',kind:'md'}` | `分支 6:markdown -> MD/md` |
| 7 | text/x- | `{label:'CODE',kind:'code'}` | `分支 7:text/x- -> CODE/code` |
| 8 | text/plain | `{label:'TXT',kind:'txt'}` | `分支 8:text/plain -> TXT/txt` |
| 兜底(非 guard) | 未匹配 mime(如 `application/octet-stream`) | `{label:'FILE',kind:'doc'}` | `未匹配任何分支的 mime(非空)落到末尾兜底 FILE/doc` |

顺序陷阱(2 条,覆盖两处不同的顺序依赖):

1. 任务书要求的:`'application/legacy-office-presentation'`(同时含 `legacy-office` 与 `presentation`)→ 落 `{label:'DOC',kind:'doc',legacy:true}`,不是 PPT —— 因为分支 2(legacy-office)先于分支 5(presentation)判定。用例:`同时含 'legacy-office' 与 'presentation' -> 落在先判定的 legacy-office 分支（DOC）...`
2. 补充给 RED 探针 2 用的:`'application/legacy-office-wordprocessing'`(同时含 `wordprocessing` 与 `legacy-office`)→ 落 `{label:'DOCX',kind:'doc'}`,不是 DOC —— 因为分支 1(docling/wordprocessing)先于分支 2(legacy-office)判定。用例:`同时含 'wordprocessing' 与 'legacy-office' -> 落在先判定的 docling/wordprocessing 分支（DOCX）...`

这两条互不覆盖:第 1 条测的是分支 2 vs 分支 5 的顺序,第 2 条测的是分支 1 vs 分支 2 的顺序。RED 探针 2(「前两条 if 互换」)专门验证第 2 条——若只留第 1 条,互换分支 1/2 不会报红(用 node 实测过:互换前 `simplifyMime('application/legacy-office-presentation')` 仍然是 DOC,因为它不含 docling/wordprocessing 关键词)。

## 6. `topSegment` 边界

`/DATA`(无第二个斜杠)→ `null`;`/DATA/x`(有)→ `'DATA'`。两侧都在同一条用例里断言:
`"'/DATA'（无第二个斜杠）-> null；'/DATA/x'（有）-> 'DATA' — IndexedFilesView.vue:442-444, copied verbatim"`。
另加多段路径、不以斜杠开头两条辅助用例。

## 7. `fmtAbs` 时区处理

蓝本读的是本地时间 getter(`getFullYear`/`getMonth`/`getDate`/`getHours`/`getMinutes`,非 UTC)。测试用 `new Date(year, monthIdx, day, hours, minutes, 0)` 这种**本地分量构造函数**生成时间戳,断言值也用同样的本地分量拼出预期字符串——构造与读取用的是同一套本地 getter,因此不管运行测试的机器处于哪个时区,`new Date(2026,0,5,3,7,0).getHours()` 恒返回 `3`。三条用例:单位数分量补零(`2026-01-05 03:07`)、两位数分量(`2026-12-31 23:59`)、午夜零点(`2026-07-01 00:00`)。另有 `null`/`undefined`/`0` → `'—'` 特例。

## 8. RED 探针(4 次,均已还原,`git status --short` 干净)

**探针 1** —— `fmtRel` 的 `s < 45` 改成 `s < 90`:
```
FAIL src/ai/knowledge/util/indexedFilesView.test.ts > fmtRel > 秒/分 边界:44 秒(s=44)→ 刚刚；45 秒(s=45,m=0)→ 0 分钟前 — IndexedFilesView.vue:406-407, copied verbatim
AssertionError: expected '刚刚' to be '0 分钟前' // Object.is equality
```
1 failed / 38 passed。已改回 `s < 45`。

**探针 2** —— `simplifyMime` 前两条 if(docling/wordprocessing、legacy-office)互换:
```
FAIL src/ai/knowledge/util/indexedFilesView.test.ts > simplifyMime — 顺序陷阱... > 同时含 'wordprocessing' 与 'legacy-office' -> 落在先判定的 docling/wordprocessing 分支（DOCX），不是 legacy-office 分支（DOC）— IndexedFilesView.vue:427 先于 :428, copied verbatim
AssertionError: expected { label: 'DOC', kind: 'doc', …(1) } to deeply equal { label: 'DOCX', kind: 'doc' }
```
1 failed / 38 passed。已改回原顺序。

**探针 3** —— `topSegment` 正则去掉尾斜杠(`/^\/([^/]+)\//` → `/^\/([^/]+)/`):
```
FAIL src/ai/knowledge/util/indexedFilesView.test.ts > topSegment > '/DATA'（无第二个斜杠）-> null；'/DATA/x'（有）-> 'DATA' — IndexedFilesView.vue:442-444, copied verbatim
AssertionError: expected 'DATA' to be null
```
1 failed / 38 passed。已改回带尾斜杠的正则。

**探针 4(建议追加)** —— `fmtBytes` 的 `n < 10240 ? 1 : 0` 改成恒 `1`:
```
FAIL src/ai/knowledge/util/indexedFilesView.test.ts > fmtBytes > KB 档 toFixed 位数切换:10239 -> '10.0 KB'（1 位小数）；10240 -> '10 KB'（0 位小数）— IndexedFilesView.vue:398, copied verbatim
AssertionError: expected '10.0 KB' to be '10 KB' // Object.is equality
```
1 failed / 38 passed。已改回条件式。这正是 P5a T6 的同款教训(`h < 24` → `h < 48` 曾 16/16 全绿)——本次边界断言精确捕获了同类回归。

每次探针后均 `git status --short` 确认只有两个新文件的 `??`,无残留改动。

## 9. 三门实测

```
pnpm test                    exit=0   Test Files 317 passed (317)   Tests 3005 passed (3005)
pnpm exec vue-tsc --noEmit   exit=0   (无输出)
pnpm build                   exit=0   (仅既有第三方 chunk >500KB 警告)
```

基线 316 文件/2966 例 → 本次 317 文件/3005 例:**+1 文件、+39 例**。任务书预期 `+25~30 例`,实测多了约 9-14 条。差异原因:
- `simplifyMime` 对含 `||` 的两条 if(分支 1 docling/wordprocessing、分支 5 ms-powerpoint/presentation)**各测了两个分量**而非只测一侧(+2 例);
- 顺序陷阱按两处不同的顺序依赖各写了一条(任务书只点名一条,+1 例,详见 §5 的理由——RED 探针 2 需要它);
- `fmtBytes`/`fmtRel` 每条边界附带 1-2 条"普通值"辅助用例(+6~8 例);
- `fmtAbs` 补了三档补零场景而非一条(+2 例);
- 一条显式验证「`fmtRel` 与 store 的 `fmtAgo` 不是同一个函数」的用例(+1 例,K12 硬约束的直接体现)。

未跑到已知噪声用例(`persist.test.ts`/`AgentComposer.test.ts`),本次全绿,未复跑。

## 10. i18n

**零新增键**。`fmtRel` 用到的五个键全部复用既有:
- `aiKbJustNow`/`aiKbMinAgo`/`aiKbHrAgo`/`aiKbDaysAgo`(P5a 已落,`fmtAgo` 也在用,附录 A A.0 复用清单)
- `aiKbMonthsAgo`(附录 A A.1 #32,P5b T1 已落,本任务是它的第一个消费者)

`fmtAbs` 不接 i18n(蓝本如此,照抄)。

## 11. K1–K20 / N1–N14 命中项

- **K12**:本任务的直接依据——`util/indexedFilesView.ts` 里的 `fmtBytes`/`fmtRel`/`fmtAbs`/`simplifyMime`/`topSegment` 五个纯展示函数抽取。
- 未命中 K9/K10/K11/K13-K20(与本任务范围无关,均是组件/scss/store 相关任务)。
- N1-N8、N9-N14 均与视图组件/模板相关,本任务只产出纯函数,不命中。

`fmtRel` 与 store 的 `fmtAgo` **未合并**(硬约束逐条核对):
- 档数不同:`fmtAgo` 4 档(0/分钟/小时/天),`fmtRel` 5 档(45 秒/60 分/24 时/30 天/**月**)。
- 起算颗粒度不同:`fmtAgo` 直接从毫秒差算分钟(`Math.floor(diff / 60000)`),`fmtRel` 先落到秒(`Math.floor(diff / 1000)`)再算分钟。
- 两者独立实现、独立测试,`fmtAgo` 所在的 `knowledgeStore.ts` 本任务**零改动**。

## 12. Fixture / mock 说明

本任务五个函数均为纯函数,不调用 `service.*`,**不需要任何 fixture 或 mock**。`fmtRel` 依赖的 i18n 是模块级单例(`src/i18n/index.ts` 的 `createI18n(...)`),照 `knowledgeStore.parser.test.ts` 里 `fmtAgo` 测试的既有写法直接调用,不需要额外初始化或 mock。

## 13. 遗留疑问

无。蓝本与任务书描述逐字一致,五个 i18n 键全部已存在,未新增任何键,未触碰任何零改动清单文件。
