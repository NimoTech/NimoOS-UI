# SP8-P3b Task 3 评审 —— 沙箱 SSE 传输层 (skillTestTransport)

评审者:独立子代理(sonnet),不采信实现者报告,自行读源码/跑测试/做 RED 验证。
提交:`e1a53c7`(BASE `f4a859d`),工作目录 `.sp8/NimoOS-New-UI`,分支 `sp8-ai`。

## 判定

- ① 规格合规:✅
- ② 代码质量:通过
- Critical: 0 · Important: 0 · Minor: 0

## 逐条核查

### 1. 「薄」—— 是否重实现 sse.ts 已有语义

自己读了 `/home/nimo/NimoTech/.sp8/NimoOS-Service/src/sse.ts` 全文(`sseRequest`,28-90 行)。逐条核对
`skillTestTransport.ts`:

| sse.ts 已 owns | 本文件是否重做 |
|---|---|
| Authorization 注入(`sse.ts:33-38`) | 未重做,不传 headers 里不含 token 逻辑 |
| 401→refresh→整条重发一次(`sse.ts:46-54`) | 未重做,零涉及 |
| 204→`{ok:true,noContent:true}`(`sse.ts:56`) | 未重做,交给 `!outcome.ok` 天然放过(noContent 时 ok=true) |
| 非 2xx→`{ok:false,status,errorBody}`(`sse.ts:57-61`) | 未重做,直接转译成 `onError({status,body})` |
| 按行分帧/`data:`剥离/JSON 解析/`[DONE]`(`sse.ts:63-84`) | 未重做,只把已解析事件原样转发 |
| AbortError 向外抛、调用方自理(`sse.ts:85-88`) | 未重做,`.catch` 里判断 `name!=='AbortError'` 才报 `onError`,逐字照抄 `agentTransport.ts:36` 同款判断 |
| `Content-Type` 仅 body 存在时加(`sse.ts:37`) | 未重做,交给 sseRequest 自动处理 |

**结论:零重做**。文件本体只做三件事:拼端点路径(`encodeURIComponent`)、拼 body(`{prompt, network:false}`)、
把 `SseOutcome` 翻译成 `onEvent`/`onError` 两个回调 —— 与已评审通过的先例 `agentTransport.ts:21-39`
(`runAgentRun`)同形,连 `.catch` 那一行都是同一段代码搬过来的。没有发现任何鉴权/刷新/分帧逻辑被复制进来。

### 2. 端点与 body 逐字对 Vue2

自己打开 `/home/nimo/NimoTech/NimoOS-UI/src/service/ai.js:204-258`(`streamSkillTest`)核对:
- URL:``/v1/ai/skills/${encodeURIComponent(id)}/test``(`ai.js:205`)—— 逐字一致。
- Method:`POST` —— 一致。
- Body:`JSON.stringify({ prompt, network: false })`(`ai.js:216`)—— 字段名/值一致(序列化交给 `sseRequest`)。
- Headers:Vue2 只有 `Content-Type` + 可选 `Authorization`(`ai.js:212-215`),**没有** `Language`。
  本文件不传 `headers` 参数 —— 一致,不偏离。

### 3. 不发 `Language` 头 —— 断言判别力(RED 探针)

自己在实现里临时加 `headers: { Language: 'zh_cn' }`(真实编辑,非猜测),跑
`pnpm exec vitest run src/ai/services/skillTestTransport.test.ts`:

```
FAIL  ... > POSTs to the skill-test endpoint ... and no Language header
AssertionError: expected { Language: 'zh_cn' } to not have property "Language"
- Expected: undefined
+ Received: "zh_cn"
Tests  1 failed | 4 passed (5)
```

精确报红(只坏这一条,其余 4 条仍绿),证明该断言确有判别力。已还原(`git diff --stat` 为空,
`git status --short` 干净)。

### 4. 错误路径形状

- `!outcome.ok` → `onError({ status: outcome.status, body: outcome.errorBody })` —— 代码逐字符合;
  测试用例 3 用 `{ok:false,status:422,errorBody:{...}}` mock,断言 `onError` 收到 `{status,body}`、
  `onEvent` 零调用 —— 通过实测复核(见下方三门数字)。
- `AbortError` 静默:`.catch` 判断 `name!=='AbortError'` 才调用 `onError`,`outcome` 为 falsy 时直接
  `return`,不抛 —— 测试用例 4 mock reject 一个 `name==='AbortError'` 的 Error,断言 `onError`/`onEvent`
  均零调用且 promise resolve —— 与 `agentTransport.ts` 同款先例一致,逻辑正确。
- 非 abort 异常 → `onError(e)` 收到原始 error,`return` 不抛 —— 测试用例 5 验证,`toHaveBeenCalledWith(err)`
  断言的是原始 error 对象(不是包了一层的东西)——符合预期。

### 5. 不越界(本层不做事件语义)

`skillTestTransport.ts` 只 `import { sseRequest } from '@nimotech/nimoos-service'`,没有引入
`sandboxRun`/reducer/`useI18n`/任何文案。事件回调 `onEvent(evt as Record<string, unknown>)` 是纯转发,
零归约、零判断事件类型。未发现越界进 T2/T4 职责的代码。本任务也**零 i18n 改动**(自查 `src/i18n/zh_cn.ts`
/`en_us.ts` diff 为空,与 `git show --stat HEAD` 一致)。

### 6. 文件头「必 422」三段根因 —— 自己回源复核

- **Python** `NimoOS-AI/agent/main.py`:自己读了 2465-2495 行。`@app.post("/agent/sandbox-run")`
  装饰器确实在 **2477** 行(不是任务书写的 2481),`x_agent_provider_key`/`x_agent_provider_url` 用
  `Header(..., alias=...)` 声明在 **2483/2484** 行,`...` 无默认值即必填 —— **实现者报告的订正
  (2481→2477)是对的**,已独立核实。
- **Go** `NimoOS-AI/route/v2/skills_files.go:154-160`:自己读了 130-174 行,循环
  `for _, hdr := range [...]{ if v := c.Request().Header.Get(hdr); v != "" { upstream.Header.Set(hdr, v) } }`
  —— 确认**只转发浏览器已发的头,自己不解析/注入** provider,与报告描述完全一致。
- **对比** `route/v2/agent.go:110-148`:自己读了这段,确认它会主动 `resolveProvider`/`routeOpenVINO`
  并 `c.Request().Header.Set(...)` 注入,`TestStream` 没有等价步骤 —— 对比成立。
- **Vue2** `ai.js:212-215` 只有 `Content-Type`/`Authorization`,从未发 provider 头 —— 已在上面第 2 条核实。
- 文件头注释明确写了「Do not "fix" this by fabricating provider headers client-side or by patching
  the backend as a side effect of this task」—— 满足「不要为了跑起来伪造头/改后端」要求。

**结论:三段根因均属实,报告的行号订正(2481→2477)正确,不是缺陷。**

### 7. 测试质量 / mock 骨架

实现者 mock 的是 `sseRequest` 本身(`vi.mock('@nimotech/nimoos-service', ...)`),不是 `fetchImpl` 注入点。
核对任务书原文:「先例 `sse.test.ts`;**若本仓 `agentTransport.test.ts` 有更贴近的 mock 骨架,照它**」——
`agentTransport.test.ts` 恰好就是同层(同为 `sseRequest` 消费者)且已评审通过的先例,也是 mock
`sseRequest` 本身。这属于任务书明文授权的替代路径,不是无端选择。

是否让「端点正确」「不发 Language 头」这几条断言失去意义?**没有**——这些断言查的是
「`skillTestTransport.ts` 传给 `sseRequest` 的参数对不对」,而 mock 直接捕获这些参数
(`sseRequestMock.mock.calls[0]`),恰好精确命中这一层的职责边界;`sseRequest` 内部是否真的把这些参数
落到 fetch 上,是 `sse.test.ts` 的职责(已独立验证,不在本任务范围)。用 RED 探针实测已证明该断言确有
判别力(见第 3 节)。未发现空转。

各断言未见「单元素数组测 `.some`/`.every`」「`not.toThrow()` 套异步」等已知高危模式。异步用
`await runSkillTest(...)` 直接 await(函数本身 async,无需 `flushPromises`)。

## 三门与算术核对

自己跑的(不是采信报告):
```
pnpm test:  Test Files  294 passed (294)   Tests  2478 passed (2478)   exit=0
```
- diff --stat 只新增 2 个文件(`skillTestTransport.ts` + `.test.ts`),无新 `.vue` —— color-guard 用例数
  不变,与「293→294 仅因新增 1 个 `.test.ts` 文件」的说法吻合(294 文件里的 +1 就是这个新测试文件本身,
  不是 color-guard 动态生成的)。
- 新测试文件内 `it(` 计数 = 5,与「+5 例」吻合。
- 未单独重跑 tsc/build(实现者已跑绿,且本任务是纯 `.ts` 新文件、无模板/类型改动,风险低,遵照任务
  指示不必重跑全量)。

## 提交范围自查

`git show --stat e1a53c7` 与 `p3b-task-3-package.md` 的 diff --stat 完全一致(仅 2 个新文件,147 行),
无夹带其它改动。`git status --short` 在评审开始与结束时均为空(RED 探针已完整还原)。

## 未发现的疑点(排除项,供交叉核对)

- 未发现把 `errorBody` 包了一层 `{data: ...}` 之类信封缺陷(符合 §4 数据契约裸对象原则,虽然本文件不解析
  body,只是管道传递,但类型/形状未被误改)。
- 未发现遗漏 `signal` 传递(`opts.signal` 断言 `toBe(signal)`,即同一引用,非拷贝)。
- 未发现 `Record<string, unknown>` 类型断言影响运行时行为(纯类型层面的 cast,不影响转发内容)。
