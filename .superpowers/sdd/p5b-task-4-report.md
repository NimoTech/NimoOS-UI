# P5b · T4 报告 —— `util/queueView.ts` 三个纯函数

分支 `sp8-ai`,起点 `90b0cd9`(实测基线 314 文件 / 2889 例全绿,`vue-tsc` 0,`vite build` 0,由协调者告知)。

## 新建文件

- `src/ai/knowledge/util/queueView.ts`
- `src/ai/knowledge/util/queueView.test.ts`

未改任何既有文件,未碰 `.vue` / store / i18n / scss。

## 蓝本原文 vs 落地代码逐行对照

蓝本:`NimoOS-UI` `git show main:src/views/AI/Knowledge/QueueView.vue`(`main@7a6ee6b7`),`:393-404`。

**蓝本原文实测(逐字拉取,行号与任务书一致,无出入)：**

```
393	    distillIconState(row) {
394	      if (row.status === 'pending') return 'pending'
395	      if (row.status === 'running') return 'running'
396	      return 'failed' // failed + skipped share the same danger tone
397	    },
398	    basename(p) { return p ? (p.split('/').filter(Boolean).pop() || p) : '—' },
399	    dirname(p) {
400	      if (!p) return ''
401	      const parts = p.split('/').filter(Boolean)
402	      parts.pop()
403	      return '/' + parts.join('/') + '/'
404	    },
```

任务书里写的三处「怪行为」与实测蓝本**完全一致，无差异**（distillIconState 未知/缺省 status 落 'failed'
不是 'pending'；basename 空值返回 U+2014 破折号 '—'；dirname 单段/纯斜杠路径返回 '//'）。

**落地代码**（`src/ai/knowledge/util/queueView.ts`）：

```ts
export function distillIconState(
  row: { status?: string },
): 'pending' | 'running' | 'failed' {
  if (row.status === 'pending') return 'pending'
  if (row.status === 'running') return 'running'
  return 'failed' // failed + skipped share the same danger tone —— 蓝本 :396 原文注释,照抄
}

export function basename(p: string | null | undefined): string {
  return p ? p.split('/').filter(Boolean).pop() || p : '—'
}

export function dirname(p: string | null | undefined): string {
  if (!p) return ''
  const parts = p.split('/').filter(Boolean)
  parts.pop()
  return '/' + parts.join('/') + '/'
}
```

三个函数体的判断顺序、分支、返回值、字符串字面量（含 U+2014 破折号）**逐字等价**蓝本 `:393-404`。
唯一的差异是加了 TypeScript 类型标注（`row: { status?: string }` / `p: string | null | undefined`
/ 返回类型），这是把蓝本的动态 JS 落到静态 TS 所必需的，不改变任何运行时行为。

`fmtAgo`（蓝本 `:405-414`）**确实没有被抽过来**——`git grep fmtAgo src/ai/knowledge/util/queueView.ts`
零命中。K11 生效：T5 会 `import { fmtAgo } from '../stores/knowledgeStore'`。

## 三处「照抄的怪行为」各自的用例位置

| # | 行为 | 用例 | 位置 |
|---|---|---|---|
| 1 | `distillIconState`:`skipped` 与 `failed` 共用 `'failed'` | `skipped status shares the failed danger tone — QueueView.vue:396, copied verbatim` | `queueView.test.ts:26-28` |
| 1b | `distillIconState`:未知 status 落 `'failed'`,不是 `'pending'` | `unknown status falls through to failed, not pending — QueueView.vue:393-397, copied verbatim` | `queueView.test.ts:32-34` |
| 2 | `basename`:空值返回 U+2014 破折号 `'—'`,不是连字符 `'-'` | `empty/null/undefined return the em dash '—', not a hyphen — QueueView.vue:398, copied verbatim` | `queueView.test.ts:43-48` |
| 3 | `dirname`:单段路径返回 `'//'`,不是 `'/'` | `single-segment path (no slash) returns '//', not '/' — QueueView.vue:399-404, copied verbatim` | `queueView.test.ts:79-84` |

每条用例名与内联注释都点名蓝本 `file:line` 并写明「照抄不改」。

## 分支覆盖表(每条分支两侧都有用例)

### `distillIconState`

| 分支 | 用例 |
|---|---|
| `status === 'pending'` | `pending status -> pending` |
| `status === 'running'` | `running status -> running` |
| `status === 'failed'`(落穿到最后一行) | `failed status -> failed` |
| `status === 'skipped'`(落穿,照抄怪行为) | `skipped status shares the failed danger tone` |
| 未知 status(落穿) | `unknown status falls through to failed, not pending` |
| 缺省 status(`{}`,落穿) | `missing status falls through to failed` |

### `basename`

| 分支 | 用例 |
|---|---|
| `''` / `null` / `undefined`(falsy 分支) | `empty/null/undefined return the em dash '—', not a hyphen` |
| 单段(无 `/`) | `single segment (no slash) returns the segment itself` |
| 多段 | `multi segment path returns the last segment` |
| 尾斜杠 | `trailing slash is ignored, still returns the last real segment` |
| 兜底 `pop() || p`(纯斜杠路径,`pop()` 返回 `undefined`) | `path made only of slashes falls back to the raw input via '\|\| p'` |

### `dirname`

| 分支 | 用例 |
|---|---|
| `''` / `null` / `undefined`(`!p` 分支) | `empty/null/undefined return ''` |
| 单段(无 `/`,`parts` 变空数组) | `single-segment path (no slash) returns '//', not '/'` |
| 多段 | `multi segment path returns the parent path with leading/trailing slash` |
| 尾斜杠 | `trailing slash on input does not change the result` |
| 纯斜杠路径(同样落到 `parts=[]`) | `path made only of slashes also collapses to an empty parts list -> //` |

共 16 条用例,均用 `toBe(...)` 钉死确切值(含反向断言 `not.toBe(...)`),无 `toBeTruthy()` / `toBeDefined()` 之类的松形式。

## RED→GREEN 证据

三次探针,每次:改动 → 跑 `pnpm exec vitest run src/ai/knowledge/util/queueView.test.ts` → 精确报红
→ `cp` 备份还原 → `diff` 确认字节级一致 → `git status --short` 确认干净。

### 探针 1:删掉 `distillIconState` 的 `running` 分支

改动:删除 `if (row.status === 'running') return 'running'` 一行。

报红:

```
FAIL  src/ai/knowledge/util/queueView.test.ts > distillIconState > running status -> running
AssertionError: expected 'failed' to be 'running' // Object.is equality
Expected: "running"
Received: "failed"
 Test Files  1 failed (1)
      Tests  1 failed | 15 passed (16)
```

还原后 `diff` 显示两文件字节级一致。

### 探针 2:删掉 `dirname` 里的 `filter(Boolean)`

改动:`const parts = p.split('/').filter(Boolean)` → `const parts = p.split('/')`。

报红:

```
FAIL  src/ai/knowledge/util/queueView.test.ts > dirname > trailing slash on input does not change the result
AssertionError: expected '//a/b/' to be '/a/' // Object.is equality
Expected: "/a/"
Received: "//a/b/"
 Test Files  1 failed (1)
      Tests  1 failed | 15 passed (16)
```

还原后 `diff` 显示两文件字节级一致。

### 建议探针(已做):把 `dirname` 单段路径行为从 `'//'` "改对"成 `'/'`

改动:把 `return '/' + parts.join('/') + '/'` 改成 `joined === '//' ? '/' : joined` 的「修正版」。

报红(两条,含照抄用例本身报红,证明照抄条被钉住):

```
FAIL  src/ai/knowledge/util/queueView.test.ts > dirname > single-segment path (no slash) returns '//', not '/' — QueueView.vue:399-404, copied verbatim
AssertionError: expected '/' to be '//' // Object.is equality
Expected: "//"
Received: "/"

FAIL  src/ai/knowledge/util/queueView.test.ts > dirname > path made only of slashes also collapses to an empty parts list -> //
AssertionError: expected '/' to be '//' // Object.is equality
Expected: "//"
Received: "/"

 Test Files  1 failed (1)
      Tests  2 failed | 14 passed (16)
```

还原后 `diff` 显示两文件字节级一致;最终 `git status --short` 只列出两个新建的未跟踪文件
(`queueView.ts` / `queueView.test.ts`),无其它改动。

## 三门实测数字

- `pnpm test`:第一次 exit=1,**315 文件 / 2905 例全部 PASS**,唯一红是「Unhandled Rejection」
  (`AgentComposer.test.ts` 的 vue-i18n teardown 竞态,`ReferenceError: window is not defined` at
  `resolveMessageFormat`),这是治理文件 §8 登记的既有噪声。复跑一次:exit=0,**315 文件 / 2905 例全绿**,零 error。
  - 增量对照基线:314→315(+1,queueView.test.ts)· 2889→2905(+16,brief 预期 +12~15,实测 +16,
    多出的 1 条是给 `basename('/')` 兜底分支单独补的用例,详见分支覆盖表)。
- `pnpm exec vue-tsc --noEmit`:exit=0,**0 错**。
- `pnpm build`:exit=0,只有 `vite` 自带的「chunk > 500kB」第三方警告,无新警告。

## §3 (K1–K20) 命中项

**K12**(纯展示函数抽 `util/`):本任务正是 K12 的 `util/queueView.ts` 一半(`indexedFilesView.ts` 留 T7)。
**K11**(`fmtAgo` 不抽,复用 store 版):已确认未抽,`git grep fmtAgo` 在本文件零命中。
其余 K1-K10/K13-K20 与本任务无关,未涉及。

## §3.5 (N1–N14) 命中项

本任务不涉及模板/scss/store/i18n,N1-N14 均与本任务无直接命中项。三处「怪行为」照抄属于
brief 正文明确要求的 K12 附带条款,不是 §3.5 登记的条目,但精神一致(照抄、不改)。

## fixture / mock 使用

本任务是纯函数单测,不涉及网络请求或 service 包,**未使用任何 fixture**。

## 与任务书描述不一致的地方

无。`git show main:` 拉出的蓝本 `:393-404` 与任务书描述逐字一致(函数体、行号、注释、字符串字面量全部吻合)。

## 遗留疑问

无。测试增量比 brief 预期的「+12~15」多 1 条(实为 +16),原因是给 `basename` 的
`pop() || p`(纯斜杠路径)兜底分支单独补了一条用例,该分支不在 brief 明确列出的四类
(空串/单段/多段/尾斜杠)之内,但属于蓝本代码里真实存在的一条独立分支,补上是为了不留断言空转的分支;
不影响 DoD 达成,已在实测数字一节说明。
