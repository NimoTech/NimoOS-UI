# P5d · T3 报告 —— util 两份(`notesViewHelpers.ts` + `noteEditHelpers.ts`)

起点 `f128450`(T0/T1/T2 已关账)。新建 4 文件,`.vue` 与产品 `.scss`/i18n 均零改动。

## §T3 DoD 1–6 逐条

**1. K40** —— `NOTE_TYPES[*].color` 改成 `'var(--grad-note-note|summary|insight|digest)'`
(四个 token 名取自附录 B §B.1,与 T2 已声明的 `knowledge.scss` 逐字核对一致)。
`color-guard.test.ts` 只扫 `.vue`/`.css`,不扫 `.ts` → 在 `notesViewHelpers.test.ts` 补了
定向断言(四值 `toMatch(/^var\(--grad-note-[a-z]+\)$/)`)+ 反向断言(序列化后零
`#`/`rgb(`/`rgba(`/`hsla(`)。
🔴 **RED 探针实测**(禁 `git checkout`/`restore`,用 cp+md5 还原):
```
$ cp notesViewHelpers.ts /tmp/.../notesViewHelpers.ts.orig.bak && md5sum 两者   # 一致,03b4c1a...
$ Edit: note.color 改回 'linear-gradient(135deg, #5AC8FA, #007AFF)'（行首锚定,只改一行)
$ pnpm exec vitest run notesViewHelpers.test.ts
  ❯ K40 … 四个 color 值逐个形如 var(--grad-note-*)         FAIL（Expected "var(--grad-note-note)", Received "linear-gradient(...)"）
  ❯ K40 … 反向:… 零 # / rgb( / rgba( / hsla(                FAIL（未命中排除正则）
  Test Files 1 failed | Tests 2 failed | 27 passed (29)
$ cp /tmp/.../notesViewHelpers.ts.orig.bak notesViewHelpers.ts && md5sum 两者   # 一致,03b4c1a...(还原确认)
$ pnpm exec vitest run notesViewHelpers.test.ts
  Test Files 1 passed (1) / Tests 29 passed (29)
```
报红 → 还原 → 转绿,三段证据俱全,`git status` 全程只有 4 个预期的 `??` 新文件。

**2.** `relativeTime` 用 `import { i18n } from '../../../i18n'` → `i18n.global.t(...)`,
未改用 `useI18n()`(先例 `indexedFilesView.ts:31/51-58`)。

**3.** 测试用 `vi.spyOn(Date, 'now').mockReturnValue(NOW_MS)` + `afterEach(vi.restoreAllMocks)`,
禁真实时间。`unixSec` 按**秒**运算(`NOW_SEC = NOW_MS/1000`,`NOW_MS` 取 1000 整数倍避免浮点误差)。
4 个边界(60/3600/86400/86400×30 秒)两侧全覆盖:59→刚刚/60→"1 分钟前"、
3599→"59 分钟前"/3600→"1 小时前"、86399→"23 小时前"/86400→"1 天前"、
2591999→"29 天前"/2592000→落 `toLocaleDateString()`。第 5 档两条用例均用
`new Date(unixSec*1000).toLocaleDateString()` 同式比对,不钉死字符串。
`0`/`undefined`/`null` 三个早退输入各一条断言(均 `''`)。

**4. 承接 Vue2 spec**:`notesView.spec.js` 3 条(statusBadge 三分支 + applyFilters
type/status 独立 + `'active'` 语义)全部照抄承接,并加了全部/精确匹配等补充分支。
`noteEditHelpers.spec.js` 2 条(parseTags 分隔符 `/[,\s]+/` 逗号+空白皆算、
conflictMessage 只认 409 且 `.toContain(rev)`)照抄承接,`conflictMessage` 内容
未简化成 `return true`(补了逐字 `toBe` 全串断言 + `current_revision` 缺失时
仍 truthy 的 Vue2 现状用例,N23 照抄不改)。

**5.** `noteTypeMeta`/`noteSourceMeta` 兜底分支:未知 type/createdBy、`undefined`、`null`
三档均有用例,已知值也有一条正向用例。

**6.** 零 `any`(`vue-tsc --noEmit` exit 0,已单独跑过 + 随三门复跑)。

## `statusBadge` 零消费者声明

**协调者已 grep 核实全仓零生产消费者**(蓝本模板里徽标是内联 `kn-badge` 标记,唯一引用者是
Vue2 `__tests__/notesView.spec.js`)。本刀**照抄导出 + 照抄这 3 条用例,故意保留,不因为
「没人用」删除**,依据治理 §4.3 / K7 同族(反转不删)。已在源文件与测试文件注释中显式登记。

## 四个渐变 token 对应(附录 B §B.1)

| NOTE_TYPES 键 | token |
|---|---|
| note | `--grad-note-note` |
| summary | `--grad-note-summary` |
| insight | `--grad-note-insight` |
| digest | `--grad-note-digest` |

四个值与 T2 落地的 `knowledge.scss`(`:291-294`/`:398-401`)逐字核对一致。

## `relativeTime` 键名(附录 A §A.2/§A.6)

`aiKbJustNow`(复用,§A.1 #7)· `aiKbRelMinAgo` · `aiKbRelHrAgo` · `aiKbRelDaysAgo`
(三者新建,K42,占位符统一 `{n}`,不复用占位符为 `{m}`/`{h}`/`{d}` 的既有 `aiKbMinAgo`/
`aiKbHrAgo`/`aiKbDaysAgo`)。另 `NOTE_TYPES`/`NOTE_SOURCES` 的 7 个 `labelKey` 字段改写成
New-UI 键名(`aiKbNoteType*`/`aiKbNoteSrc*`,附录 A §A.4 落地口径),测试逐条验证
`i18n.global.t(labelKey)` 渲染出真实中文文案(非键名字面量)。

## 命中的 K/N 编号

K40(渐变改 token + 定向断言 + RED 探针)· K42(相对时间 4 键新建,占位符 `{n}`)·
K7 同族 / 治理 §4.3(`statusBadge` 反转不删)· N23(`conflictMessage` 不进 i18n,
`.toContain(rev)` 行为承接,未简化成 `return true`)。附录 A §A.4「labelKey 字段值改写成
New-UI 键名」落地口径已兑现。未发现需额外申报的新偏离。

## 三门 + 算式

```
pnpm test:      Test Files 328 passed (328) / Tests 3592 passed (3592)   exit=0
vue-tsc:        exit=0
vite build:     exit=0
```

- 文件数:**326 + 2 = 328**(实测 328)✅
- 用例数:**3551 + 41 = 3592**(实测 3592;新增 41 = notesViewHelpers.test.ts 29 例 +
  noteEditHelpers.test.ts 12 例)✅

零复跑、零红、`AgentComposer.test.ts` / `persist.test.ts` 两条已知噪声本轮均未触发。
`git status --short` 全程只有 4 个预期的 `??` 新文件,无其它改动。

## NEEDS_CONTEXT

无。所有 DoD 项均已现场核验完成,未采信任何未复核的既有结论。

---

## 修复轮 1

评审回:规格 ✅ · 质量通过,独立重跑了 K40 与秒/毫秒两组探针均报红→还原一致。
唯一要修的一条:`applyFilters` 缺「`type`/`status` 两个条件同时非空」的组合筛用例。

### 补的 3 条用例(`notesViewHelpers.test.ts`,只改这一个文件)

1. **组合命中** —— `type='insight'` + `status='draft'`,列表里 `a` 同时满足两者、
   `b` 只满足 type、`c` 只满足 status。结果 `['a']`,与单按 type 筛的 `['a','b']`、
   单按 status 筛的 `['a','c']` 均不同,证明不是巧合等于单条件结果。
2. **组合落空**(🔴 真正抓「误写成 OR」的一条)—— `d` 只满足 type、`e` 只满足
   status,两者各自都不同时满足两个条件 → 结果必须为 `[]`。
3. **组合 + `status='active'` 语义** —— `f` type 匹配且非 archived(应中)、
   `g` type 匹配但 archived(应被 active 语义排除)、`h` 非 archived 但 type 不匹配
   (应被 type 排除)→ 结果只有 `['f']`。

### 🔴 `&&`→`||` RED 探针(cp+md5 还原,禁 `git checkout`/`restore`)

```
$ cp notesViewHelpers.ts /tmp/.../notesViewHelpers.ts.fixround1.bak && md5sum 两者
  03b4c1a...  两者一致(注入前基线)
$ Edit:第 93-94 行 applyFilters 内部 `&&` 改成 `||`(行首锚定,只改这一处运算符)
$ grep 确认注入已落盘 → 第 93 行确实是 `|| n.type === type) ||`
$ pnpm exec vitest run notesViewHelpers.test.ts
  FAIL × status 为具体值(非 ""/"active")时是精确匹配
  FAIL × 组合命中:…                                    ← 本轮新增
  FAIL × 组合落空:… 真正抓「误写成 OR」的那条            ← 本轮新增
  FAIL × 组合筛纳入 status="active"…                    ← 本轮新增
  Test Files 1 failed | Tests 6 failed | 26 passed (32)
$ cp /tmp/.../notesViewHelpers.ts.fixround1.bak notesViewHelpers.ts && md5sum 两者
  03b4c1a...  两者一致(还原确认,与注入前逐字节相同)
$ pnpm exec vitest run notesViewHelpers.test.ts
  Test Files 1 passed (1) / Tests 32 passed (32)
```
3 条新增用例(以及 1 条既有的"精确匹配"用例)在 `||` 突变下全部报红,还原后全绿。

### 产品代码零改动自证

```
$ git status --short
 M src/ai/knowledge/util/notesViewHelpers.test.ts
$ git diff -- src/ai/knowledge/util/notesViewHelpers.ts
(空,零输出)
```
探针注入/还原全程针对 `notesViewHelpers.ts`,但还原后与 `git` 索引里的版本(HEAD 的
新增内容,尚未提交前的工作树基线)逐字节一致、`git diff` 对该文件零输出 —— 只有测试
文件被净改动。

### 三门(全量,已落盘)

```
/tmp/p5d-t3-fix-test.log:  Test Files 328 passed (328) / Tests 3595 passed (3595)   exit=0
/tmp/p5d-t3-fix-tsc.log:   exit=0
/tmp/p5d-t3-fix-build.log: exit=0
```

算式:**3592(T3 首轮) + 3(本轮新增) = 3595**(实测 3595)✅。文件数仍 328(未新增文件)。
零复跑、零红,已知噪声两条本轮均未触发。
