# SP8-P4 Task 3 报告 —— 错误映射 `mcpErrorKey.ts`

提交:`39f7e44972e90f3063531b26dd882c4891dcda79`(分支 `sp8-ai`)

## 逐文件改了什么

- 新建 `src/ai/util/mcpErrorKey.ts`(112 行):四个纯函数,结构照
  `channelsFormat.ts:65-76`(`addBotErrorKey`)与 `skillsErrorKey.ts`(同分工)。
  - `rawMessage(e)`:同时读 `response.data.message`(Go)与 `response.data.detail`
    (FastAPI),trim + toLowerCase。
  - `statusOf(e)` / `detailOf(body)`:辅助取值,`detail` 非字符串一律归一成 `''`。
  - `saveServerErrorKey(e)`:三条 validate 串 + `mcp server not found` → 对应键,
    其余 `'aiCfgSaveFailed'`。
  - `parseCommandErrorKey(e)`:五条 parse 串(两条合并)→ 四个键,其余
    `'aiMcpSrvParseFailed'`;全部用 `===` 相等匹配,不用 `startsWith`。
  - `toTestView(body)`:200 响应体 → `McpTestView`;`error_key` 四值查表;
    `ok:true` 时 `tool_count ?? 0`、`tools` 非数组 → `[]`。
  - `toTestViewFromError(e)`:HTTP 层抛出的错误 → `McpTestView`;
    `status===502 || body.error==='agent unreachable'` → agentDown;
    `mcp server not found` → notFound;其余通用兜底。
- 新建 `src/ai/util/mcpErrorKey.test.ts`(153 行):brief Step 1 给的测试逐字照抄,
  未新增额外用例(brief 的 29 条覆盖已含判别力探针,见下)。

本任务不产出 `.vue`,不改任何既有文件。

## 回源核实的后端错误串清单(逐条 `file:line`)

全部在只读仓 `/home/nimo/NimoTech/NimoOS-AI` 里用 `grep -n` 实测,不是照抄计划:

| 串 | 实测位置 |
|---|---|
| `"url required for http/sse"` | `route/v2/mcp.go:277` |
| `"command required for stdio"` | `route/v2/mcp.go:282` |
| `"transport must be 'http', 'sse' or 'stdio'"` | `route/v2/mcp.go:286` |
| `"mcp server not found"`(404) | `route/v2/mcp.go:152, 168, 186, 332, 441` |
| `"agent unreachable"`(502,`c.JSON` 直出) | `route/v2/mcp.go:351` |
| `"empty command"` | `pkg/mcpparse/mcpparse.go:36` |
| `"no command after parsing"` | `pkg/mcpparse/mcpparse.go:47` |
| `"no command after '--'"` | `pkg/mcpparse/mcpparse.go:62` |
| `"no command (only environment variables)"` | `pkg/mcpparse/mcpparse.go:76` |
| `"unbalanced quotes in command"` | `pkg/mcpparse/mcpparse.go:138` |
| `error_key: "probe_timeout"` | `agent/mcp_client/client.py:437` |
| `error_key: "connect_failed"`(+ `detail`) | `agent/mcp_client/client.py:448` |
| `error_key: "list_timeout"` | `agent/mcp_client/client.py:453` |
| `error_key: "list_failed"`(+ `detail`) | `agent/mcp_client/client.py:456` |

**任务书/公共约束的抄漏、抄错**:
- 任务书给的 not-found 行号是 `mcp.go:152,187,332`(三处);公共约束给的是同样三处。
  实测有 **5 处** `"mcp server not found"`:`152, 168, 186, 332, 441`。
  `187` 是抄错(实际 `186`),`168` 与 `441`(测试端点自己的 404,即
  `Test()` 里 `GetMcpServer` 返回 `sql.ErrNoRows` 那支)两处漏抄。**不影响映射**——
  串完全相同,`saveServerErrorKey`/`toTestViewFromError` 按串匹配,与具体行号无关。
- 任务书给的 validate 三条行号是 `mcp.go:273-289`(区间,笼统);实测精确行号是
  `277`(url)/`282`(command)/`286`(transport)。已在 `mcpErrorKey.ts` 文件头注释里
  按实测行号写,不沿用任务书笼统区间。
- `agent unreachable` 任务书写 `mcp.go:351`,实测确认无误。

未发现后端还有别的、任务书完全没覆盖到的错误串——`validateAndClean`、`mcpparse.Parse`、
`test_server` 三处的错误分支都已逐条读过源码,没有遗漏分支。

## RED→GREEN 证据

**Step 2(建实现前先跑,确认因缺文件报红)**:

```
 FAIL  src/ai/util/mcpErrorKey.test.ts [ src/ai/util/mcpErrorKey.test.ts ]
Error: Failed to resolve import "./mcpErrorKey" from "src/ai/util/mcpErrorKey.test.ts".
...
 Test Files  1 failed (1)
      Tests  no tests
```

**Step 4(写完实现后跑,确认全绿)**:

```
 Test Files  1 passed (1)
      Tests  29 passed (29)
```

**Step 5 RED 探针**:按 brief 指示,删掉 `parseCommandErrorKey` 里
`if (s === 'no command (only environment variables)') return 'aiMcpSrvParseErrOnlyEnv'`
这一整条分支。

RED(报红):

```
 ❯ src/ai/util/mcpErrorKey.test.ts (29 tests | 1 failed) 16ms
     × no command (only environment variables) → 独立的键(原因不同:只有环境变量) 6ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/ai/util/mcpErrorKey.test.ts > parseCommandErrorKey —— mcpparse 的五条 400 > no command (only environment variables) → 独立的键(原因不同:只有环境变量)
AssertionError: expected 'aiMcpSrvParseFailed' to be 'aiMcpSrvParseErrOnlyEnv'
...
 Test Files  1 failed (1)
      Tests  1 failed | 28 passed (29)
```

**与 brief 预期不符,如实申报**:brief 写「确认『只有环境变量』不能被『没有可执行命令』
抢走」与「no command (only environment variables) → 独立的键」**两条**精确报红,实测
**只有 1 条**报红(「独立的键」那条)。原因:「不能被抢走」那条断言是
`.not.toBe('aiMcpSrvParseErrNoCommand')`——删掉整条分支后,该串落进了通用兜底
`'aiMcpSrvParseFailed'`,这个值本来就 `≠ 'aiMcpSrvParseErrNoCommand'`,所以这条
`not.toBe` 断言在“分支被整个删掉”这种破坏方式下**必然还是绿的**,它只对「该串被
错误地路由到 NoCommand 键」这一种失败模式有判别力(例如实现改用
`s.startsWith('no command')` 且 NoCommand 分支排在 OnlyEnv 前面时才会失守)。
brief 描述的破坏方式(直接删分支)不会触发这条断言,这是 brief 对这条断言判别力的
预期有出入,不是实现的问题——**未去改测试或加断言,原样保留**,此处只如实记录。

还原后全绿 + `git status` 干净:

```
 Test Files  1 passed (1)
      Tests  29 passed (29)
```

```
$ git status --short
?? src/ai/util/mcpErrorKey.test.ts
?? src/ai/util/mcpErrorKey.ts
```
(提交前只有这两个新文件,无其它改动残留。)

## 三门完整终值

```
$ pnpm test
 Test Files  298 passed (298)
      Tests  2612 passed (2612)

$ pnpm exec vue-tsc --noEmit
exit=0

$ pnpm build
exit=0
✓ built in 20.80s
(仅 >500KB chunk 警告与既有第三方包警告,符合 §8 许可范围)
```

无红项。基线是 T2 完成后的状态(T1/T2 已各自提交并跑过三门),本任务在此基础上
零新增 `.vue`,故新增用例数只来自本文件的 29 条。

## i18n

本任务**不写 i18n 键**——所有四个函数只返回键名字符串(如 `'aiMcpSrvErrUrlRequired'`),
未 `import` vue-i18n,未碰 `src/i18n/{zh_cn,en_us}.ts`。已按协调者裁定 1 确认这些键
在 T4 才会真正加入语言包,本期它们“还不存在”是预期状态,不构成缺陷。

已确认 `aiCfgSaveFailed` 是既有键(`src/i18n/zh_cn.ts:1039` = `'保存失败'`、
`src/i18n/en_us.ts:1027` = `'Save failed'`),作为 `saveServerErrorKey` 的通用兜底,
未新增此键。

## 偏离申报

本任务命中 **§3 D5**(HTTP 层失败不回显后端 body,改「后端串 → i18n 键」映射)——
这正是本任务的全部产出,四个函数无一例外只返回键,`error`/`message`/`detail` 里的
后端英文原文一律不进入返回值(`detail` 字段除外——它按设计 §5.3 明确保留,进
折叠区,但值本身不经过本文件加工,只做「是不是字符串」的类型归一,不做内容改写)。

未命中 §3 其余 10 条(D1-D4、D6-D11 都是组件/样式层面的偏离,与本任务的纯函数
范围无关)。

§3.5「照抄不改」5 条(N1-N5)均与本任务范围无关(表单校验/kv 编辑器/搜索行为),
本任务无涉及,故不适用。

## 测试质量说明

- brief 给的 29 条断言逐字照抄,未增删。
- 判别力探针(brief 自带,补做了一次独立 RED 验证,不是复述):把 `toTestView` 的
  `const detail = detailOf(body)` 临时改成
  `const detail = detailOf(body) || (b as { error?: string }).error || ''`
  (让 `error` 字段在 `detail` 缺失时泄漏进视图)→ 精确报红 2 条:
  `toTestView —— 200 响应体 → 视图 > probe_timeout`(期望 `detail:''`,实收
  `detail:'Probe timed out'`)与
  `toTestView —— 200 响应体 → 视图 > 后端的 error 英文串永不进入视图`
  (`JSON.stringify` 里出现了 `LEAKED-ENGLISH-STRING`)→ 精确还原 → 复跑 29 条全绿、
  `git status`/`git diff` 干净。证明「后端英文原文永不进入视图」这条判别力断言
  确有实效,不是空转。

---

## 追加(评审 Important 修复轮)

独立评审结论:**Spec ✅ / Quality 通过**,1 条 Important——裸字符串 body / 数组 body /
`error_key: null` / 502+非常规 body 四种边界形状,实现靠 `typeof`/`Array.isArray` 类型
防御安全兜住,但测试完全没钉,任务书明文要求覆盖的缺口。逐条修复如下。

### 补的用例(`mcpErrorKey.test.ts`,29 → 36 条)

- `saveServerErrorKey` 加 2 条:body 裸字符串(`httpErr(400, 'plain text error')`)、
  body 数组(`httpErr(400, ['a','b'])`),各断言①落 `'aiCfgSaveFailed'` ②
  `JSON.stringify(k)` 不含塞进去的原文/数组元素。
- `parseCommandErrorKey` 同款加 2 条(裸字符串 / 数组),落 `'aiMcpSrvParseFailed'`。
- `toTestView` 加 1 条:`{ ok:false, error_key:null, detail:'x' }` → 断言整个视图
  `toEqual({ok:false, msgKey:'aiMcpSrvTestFailed', detail:'x'})` **且**
  `JSON.stringify(v)` 不含 `'null'`。
- `toTestViewFromError` 加 2 条:502 + 非常规对象 body(`{unexpected:'...'}`)、
  502 + 裸字符串 body,均断言① 仍判 `aiMcpSrvTestErrAgentDown` ② 不泄漏塞进 body
  的原文——钉住「502 判定只看 `status===502`,不依赖 body 形状」这条设计(§5.3
  `toTestViewFromError` 的第一条判据)。

全部 7 条严格用「①正确兜底键 + ②`JSON.stringify(...).not.toContain(...)`强断言」
双重言之,未用 `not.toBeNull()` 一类弱断言(评审明确点名的教训)。

### RED 探针(两轮,均已还原)

**第一轮(覆盖 6/7 类新用例 + 2 条既有用例连带触发)**:同时做 5 处生产代码破坏
(临时,非最终版本):
1. `rawMessage` 的 `: undefined` 改成 `: String(data)`(让非对象 body 也能流入 `s`)
2. `saveServerErrorKey` 兜底 `return 'aiCfgSaveFailed'` 改成 `return s || 'aiCfgSaveFailed'`
3. `parseCommandErrorKey` 兜底同款改成 `return s || 'aiMcpSrvParseFailed'`
4. `toTestView` 的 `switch (b.error_key)` 改成 `switch ((b.error_key as string).toLowerCase())`
5. `toTestViewFromError` 的 `status === 502 || bodyError === 'agent unreachable'`
   删掉 `status === 502 ||`,只留 `bodyError === 'agent unreachable'`

跑 `pnpm exec vitest run src/ai/util/mcpErrorKey.test.ts`,精确报红 8 条:

```
 ❯ src/ai/util/mcpErrorKey.test.ts (36 tests | 8 failed) 35ms
     × 认不出的一律落通用兜底键,绝不回显后端原文 7ms
     × 无 response / 网络错 → 通用兜底 1ms
     × body 是裸字符串 → 通用兜底,不回显该字符串 1ms
     × 认不出的落通用兜底,不回显原文 1ms
     × body 是裸字符串 → 通用兜底,不回显该字符串 1ms
     × error_key 为 null → 落通用兜底,detail 仍原样保留、null 不泄漏进结果 1ms
     × 502 但 body 形状不是预期的那个(非常规对象)→ 仍判 agentDown,不泄漏 body 内容 3ms
     × 502 且 body 是裸字符串 → 仍判 agentDown,不泄漏该字符串 5ms

 Test Files  1 failed (1)
      Tests  8 failed | 28 passed (36)
```

(其中「认不出的一律落通用兜底键」「无 response / 网络错」「认不出的落通用兜底」三条是
**本轮之前就存在**的旧用例,被 mutation 2/3 连带击中——这是预期的交叉验证,不是新增
用例的功劳,如实标注。)

「body 是数组」两条(saveServerErrorKey / parseCommandErrorKey)**在这轮没有报红**——
原因:数组的 `typeof arr === 'object'` 天然为真,走的是 `rawMessage` 三元表达式的
**真分支**(`(data as {message}).message ?? (data as {detail}).detail`),不受第一轮
「假分支改 `String(data)`」这条 mutation 影响;数组身上不存在 `.message`/`.detail`
属性,取值安全返回 `undefined`,`s` 仍是 `''`,`s || fallback` 拿到的还是 fallback。
为了不漏判这两条的判别力,单独补了第二轮探针。

**第二轮(单独钉「数组 body」两条)**:先还原第一轮的全部 5 处改动,确认
`pnpm exec vitest run` 36 条全绿 + `git status`/`git diff` 干净;再做 2 处改动:
1. `rawMessage` 真分支加一层兜底:
   `(data as {message}).message ?? (data as {detail}).detail` 改成
   `(data as {message}).message ?? (data as {detail}).detail ?? String(data)`
2. `saveServerErrorKey` 兜底改回 `return s || 'aiCfgSaveFailed'`

跑测试,精确报红 2 条:

```
 ❯ src/ai/util/mcpErrorKey.test.ts (36 tests | 2 failed) 13ms
     × 认不出的一律落通用兜底键,绝不回显后端原文 4ms
     × body 是数组 → 通用兜底,不泄漏数组内容 1ms

AssertionError: expected 'a,b' to be 'aiCfgSaveFailed' // Object.is equality
 ❯ src/ai/util/mcpErrorKey.test.ts:57:15 (body 是数组 → 通用兜底,不泄漏数组内容)

 Test Files  1 failed (1)
      Tests  2 failed | 34 passed (36)
```

证实「body 是数组」这两条断言在 `rawMessage` 的真分支拿掉安全兜底时确有判别力。

**两轮探针后精确还原**(`cp` 回 mutation 前的备份文件),复跑确认全绿 + 干净:

```
$ pnpm exec vitest run src/ai/util/mcpErrorKey.test.ts
 Test Files  1 passed (1)
      Tests  36 passed (36)

$ git status --short
 M src/ai/util/mcpErrorKey.test.ts
 M src/ai/util/mcpErrorKey.ts

$ git diff --stat
 src/ai/util/mcpErrorKey.test.ts | 49 +++++++++++++++++++++++++++++++++++++++++
 src/ai/util/mcpErrorKey.ts      |  2 +-
```

(此时 `git status`/`git diff` 显示的改动**只有**测试新增的 49 行 + `.ts` 里 1 行注释
修正——见下方「生产代码那 1 行改动」——不含任何一处 RED 探针的临时破坏,探针的 5+2
处改动全部已用备份文件精确还原,未残留。)

### 生产代码那 1 行改动(明确申报)

`mcpErrorKey.ts` **确实改了 1 行**,但**不是**为了兜住这四种边界形状——那四种形状
本来就已经被 `typeof`/`Array.isArray` 安全兜住(评审的判断是对的,本轮两次 RED 探针
也证实了这一点:凡是把类型防御拆掉,新用例才会报红;防御本身完好时全部 36 条一次
就绿,不需要改任何生产逻辑)。

这 1 行是:`toTestViewFromError` 函数头注释里的行号引用,从
`` `mcp.go:349` `` 改成 `` `mcp.go:351` ``。背景:上一轮报告里我已经用 `grep -n` 回源
核实过 `agent unreachable` 的真实行号是 `mcp.go:351`(见报告主体「后端错误串清单」
表格),并在**文件头**的大段注释里改用了 `:351`;但同一个事实在 `toTestViewFromError`
函数自己的 doc comment 里还留着旧值 `:349`,是我自己漏改的一处引用不一致,不是本轮
评审发现、也不是本轮新增逻辑——本轮核对全文件时顺手发现并订正。**不影响任何运行时
行为**,纯注释文本,已跑过三门确认零回归。此处如实申报,不算「与需求无关的重构」
(改的是我自己在本任务里写下的注释错误,不是别的任务的代码)。

四种边界形状里**没有一种是真的没被兜住**——不改生产逻辑,只补测试。

### 三门完整终值(本轮)

```
$ pnpm test
 Test Files  298 passed (298)
      Tests  2619 passed (2619)

$ pnpm exec vue-tsc --noEmit
exit=0

$ pnpm build
exit=0
✓ built in 22.26s
(仅 >500KB chunk 警告 + 既有第三方包警告,符合 §8 许可范围)
```

无红项。2619 = 上一轮收官的 2612 + 本轮新增 7 条。
