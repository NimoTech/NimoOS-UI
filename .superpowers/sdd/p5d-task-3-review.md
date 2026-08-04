# P5d · T3 独立评审 —— util 两份(`notesViewHelpers.ts` + `noteEditHelpers.ts`)

评审范围:BASE `f128450` → HEAD `e48b09a`。评审全程未改仓库(两组探针均以 `cp` 备份 +
`md5sum` 逐字节比对方式还原,零 `git checkout`/`restore`)。

## 0. 代码膨胀逐行判定(蓝本 61 行 → 产出 155 行)

逐行核对 `notesViewHelpers.ts`(116 行,蓝本 50 行)与 `noteEditHelpers.ts`(39 行,蓝本 11 行):

- **膨胀来源全部是正当项**:文件头 K 系列申报注释(19+9 行)、4 个 TS `interface`(20 行)、
  逐函数 JSDoc 引蓝本 `:行号`(约 30 行)、`applyFilters`/`parseTags` 因带类型标注被
  vitest/prettier 风格拆成多行(纯格式,非逻辑)、空行。
- **逐函数比对无未申报新逻辑**:
  - `NOTE_TYPES`/`NOTE_SOURCES` 常量:字段值 1:1(`color`→token 是 K40 已申报的偏离,
    `labelKey`→New-UI 键名是附录 A §A.4 已申报的偏离)。
  - `noteTypeMeta`/`noteSourceMeta`:蓝本 `NOTE_TYPES[type] || NOTE_TYPES.note`
    改写成 `(type && NOTE_TYPES[type]) || NOTE_TYPES.note`。**这不是行为变化**——
    `type` 为 `undefined`/`null` 时两种写法结果相同(索引 undefined/null 均得
    `undefined`,短路结果一致),只是 TS 严格模式下用字符串索引 `Record` 前必须先
    做真值收窄。判定:**格式/类型层面改写,非重构,不需申报**。
  - `statusBadge`/`applyFilters`/`relativeTime`/`parseTags`/`conflictMessage`:
    逐条件/逐分支与蓝本逐字对应,零新增分支、零删分支、零顺序调整。
- **结论:未发现未申报的新逻辑或"顺手修正"的行为。膨胀纯粹是 TS 化 + 申报注释的代价。**

## 1. 两组自跑探针(不采信报告断言)

### K40(色字面量 RED 探针)
- `cp` 备份 `notesViewHelpers.ts` → md5 `03b4c1a...`(与产品文件一致)。
- 注入:`note.color` 改回 `'linear-gradient(135deg, #5AC8FA, #007AFF)'`。
- `vitest run notesViewHelpers.test.ts` → **报红**:`Test Files 1 failed | Tests 2 failed | 27 passed (29)`
  (正向 `toMatch` 与反向"零 `#`/`rgb(`/`rgba(`/`hsla(`" 两条断言均失败,报错内容与实际改动吻合)。
- 用备份 `cp` 覆盖还原 → md5 再次核对与备份一致 → 复跑转绿 `29 passed (29)`。
- **判定:定向断言有真实判别力,与实现者报告一致。**

### 秒/毫秒陷阱(不同于报告贴的探针,评审自行设计:改产品代码 `unixSec * 1000` → `unixSec`)
- 从已验证 md5 一致的干净文件出发,把第 5 档 `return new Date(unixSec * 1000).toLocaleDateString()`
  改成 `return new Date(unixSec).toLocaleDateString()`。
- `vitest run` → **报红**:`Tests 2 failed | 27 passed (29)`
  ——第 4/5 档边界用例与"远早于 30 天"用例均失败(`Expected "10/16/2023"`/`"10/11/2022"`,
  `Received "1/20/1970"`,即把秒当毫秒喂给 `Date` 后钟表回落到 1970 年附近)。
- `cp` 备份覆盖还原 → md5 一致 → 复跑转绿 `29 passed (29)`。
- **判定:第 5 档"同式比对"断言确实依赖正确的 `unixSec*1000` 构造,不是零判别力写法。**
  同时确认测试 fixture(`NOW_SEC = NOW_MS/1000`,四个边界值均以整数秒运算、传入 `relativeTime`)
  喂的是**秒**而非毫秒——若喂毫秒,所有输入的 `d = Date.now()/1000 - unixSec` 会是巨大负/正数,
  必然全部跌进第 5 档,4 个边界用例会全部执行到 `toLocaleDateString()` 分支而不是分钟/小时/天分支,
  与本次探针观察到的失败模式互证成立。

git 全程只在评审临时注入时脏,还原后 `git status --short` 为空,`HEAD` 仍 `e48b09a92d7e7c5dd4f3bfe3d49bccfadaaedc2b`。

## 2. 三门复跑(不采信,自己重跑)

```
pnpm test:      Test Files 328 passed (328) / Tests 3592 passed (3592)   exit=0
vue-tsc --noEmit: exit=0
vite build:       exit=0
```
与报告一致。`.vue` 文件数复核仍 179(`find src -name '*.vue' | wc -l`)。

## 3. 逐条检查项核验

1. **K40 token 名**:`--grad-note-note/-summary/-insight/-digest` 与附录 B §B.1 逐字一致,
   与 T2 `knowledge.scss:291-294`/`:398-401` 逐字核对一致(`grep` 复核)。
2. **秒/毫秒**:fixture 用秒(见上);4 个边界(60/3600/86400/86400×30)**两侧均有用例**；
   第 5 档两条用例均"同式比对"、不钉死字符串；`0`/`undefined`/`null` 三个早退输入各有断言。
3. **`i18n.global.t` 先例**:`import { i18n } from '../../../i18n'` + `i18n.global.t(...)`,
   与先例 `indexedFilesView.ts:31/48-58`(`i18n.global.t('aiKbJustNow'|'aiKbMinAgo'|…)`)
   写法一致，未用 `useI18n()`。键名 `aiKbJustNow`/`aiKbRelMinAgo`/`aiKbRelHrAgo`/`aiKbRelDaysAgo`
   在 `zh_cn.ts`/`en_us.ts` 中存在且占位符为 `{n}`（`grep` 复核），未误用占位符为 `{m}`/`{h}`/`{d}`
   的旧键。**反向断言用的是"渲染结果 ≠ 键名字面量"（`labelKey` 组）与"渲染出真实数字/文案"
   （`relativeTime` 组，各边界值断言完整渲染字符串如 `'1 分钟前'`），不是 E-45 点名的
   "渲染出字面量 `{n}` 才报红"这种零判别力写法** —— 未发现 E-45 复发。
4. **Vue2 spec 承接**:`applyFilters` 三档 status（''/active/精确匹配）均有独立用例；
   type/status 独立生效有用例；`statusBadge` 三分支、`parseTags` 分隔符 `/[,\s]+/`
   （`' a, b ,a  c,'` → `['a','b','c']` 逐字核对）、`conflictMessage` 只认 409 且
   `.toContain('4')` 蓝本原例 + 完整串 `toBe` 全等断言（未简化成 `return true`）均落实。
5. **兜底分支**:`noteTypeMeta`/`noteSourceMeta` 的未知值、`undefined`、`null` 三档均有用例。
6. **`statusBadge` 零消费者**:`grep -rn "statusBadge"` 全仓复核，命中的全部是无关的
   `IndexedFilesView.vue` 里的 `statusBadgeMap`(名字碰巧相似的另一个符号），
   `notesViewHelpers.statusBadge` 本身**确无任何 `.vue`/`.ts` 导入点**（当前只有测试文件调用）。
   与报告一致。
7. **零 `any`**:`grep -n '\bany\b'` 对 4 个新文件 exit=1（无命中）。文件数 328 / 用例数
   3592 / `.vue` 179 均复核一致。

## 4. 缺口猎（自行复核，不依赖报告）

- **41 条新用例逐条读过，未发现"只断言存在性/类型、不断言值"的空壳**；`relativeTime`/
  `applyFilters`/`conflictMessage` 的断言全部落在具体值或关系上。
- **假时钟确认真实生效**：每个依赖时间差的 `it()` 内部各自 `vi.spyOn(Date, 'now')`，
  `afterEach(vi.restoreAllMocks)` 兜底；早退用例（0/undefined/null）不触碰 `Date.now()`，
  不会有真实时间导致的偶发红绿。
- 🟡 **发现一个缺口**：`applyFilters` **没有 type 与 status 同时给出非空值的组合筛用例**
  （六条 `it` 逐一读过，均是"其中一个为空字符串"的单变量场景，见 §5 Important-1）。

## 5. 判定与发现

**① 规格符合(§T3 DoD 1–6)：✅ 通过**（K40/relativeTime 单位与键名/承接 Vue2 spec/兜底分支/零 any 六条均现场核验一致）。
**② 任务质量：通过**（有一个 Important 级缺口，不影响整体判定为通过，建议登记债务）。

**代码膨胀判定**：155 行内**未发现**未申报的新逻辑/被"修正"的行为/无关抽象；全部膨胀来自
TS interface、K 系列申报注释、JSDoc 引用行号、及类型标注导致的多行格式化。唯一一处写法差异
（`noteTypeMeta`/`noteSourceMeta` 加 `type &&` 真值收窄）是 TS 严格索引要求下的等价改写，非行为变化。

**两组探针结果**：K40 报红→还原→转绿，md5 全程一致；秒/毫秒报红→还原→转绿，md5 全程一致。两组均证实断言有真实判别力。

### Critical
无。

### Important
1. `src/ai/knowledge/util/notesViewHelpers.test.ts:122-155`（`applyFilters` describe 块）——
   缺一条 **type 与 status 同时给非空值** 的组合筛用例（例如 `{type:'note', status:'draft'}`
   在一个含"仅 type 匹配"、"仅 status 匹配"、"两者都匹配"三类元素的列表上验证只留下"两者都匹配"的项）。
   取证：`sed -n '122,156p' src/ai/knowledge/util/notesViewHelpers.test.ts`，六个 `it` 逐一读，
   均只让 `type`/`status` 其中一个非空。产品代码逻辑本身是两个独立 AND 条件、风险不高，
   但这是 brief 明确点名的常规检查项，建议登记债务由下一刀或本刀补一条用例。

### Minor
无。

## ⚠️ 无法核验项
- 无。本刀范围内的 brief 六条检查项、附录 B/A 对照、两组探针均已现场核验，未采信任何未复核的既有结论。
