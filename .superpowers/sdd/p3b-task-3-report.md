# SP8-P3b Task 3 报告 —— 沙箱 SSE 传输层

## 逐文件改了什么

- 新建 `src/ai/services/skillTestTransport.ts`:导出 `runSkillTest(skillId, prompt, signal, onEvent, onError)`。
  - 端点:`POST /v1/ai/skills/${encodeURIComponent(skillId)}/test`,body `{ prompt, network: false }` —— 逐字对
    Vue2 `NimoOS-UI/src/service/ai.js:205,216`(`streamSkillTest` 的 url 拼接与 `body: JSON.stringify({ prompt, network: false })`)。
  - 不传 `headers`(即不发 `Language`)。
  - `.catch(e => { if ((e as Error)?.name !== 'AbortError') onError(e); return null })`,`outcome` 为 falsy 直接 `return`。
  - `!outcome.ok` → `onError({ status: outcome.status, body: outcome.errorBody })`。
  - 每个事件原样 `onEvent(evt as Record<string, unknown>)`,不做任何语义归约。
  - 文件头写了三段根因(见下「三处回源复核」)。
- 新建 `src/ai/services/skillTestTransport.test.ts`:5 个用例(见「测试覆盖」)。

## Vue2 file:line → New-UI 对照

| Vue2 | New-UI | 说明 |
|---|---|---|
| `ai.js:205` `` `/v1/ai/skills/${encodeURIComponent(id)}/test` `` | 同 | 端点逐字照抄 |
| `ai.js:216` `body: JSON.stringify({ prompt, network: false })` | `body: { prompt, network: false }`(交给 `sseRequest` 序列化) | 语义相同 |
| `ai.js:207-217` 手写 `doFetch` + 401 刷新重发 | `sseRequest` 内建(不重做) | 见下 |
| `ai.js:234-249` 手写 reader/decoder/按行分帧/`data:`/`[DONE]` | `sseRequest` 内建(不重做) | 见下 |
| `ai.js:251-256` `.catch` 里判断 `e.name !== 'AbortError'` 才报错 | 同款 `.catch` 判断,搬进 `runSkillTest` | 逐字照抄这条判断逻辑 |
| `ai.js:212-215` 无 `Language` 头 | 同(不加) | 见下"偏离申报"第 2 条(其实是"不偏离"的显式确认) |

## 承接了 Vue2 哪些行为

- 端点路径、`encodeURIComponent(id)`、body 字段名与值(`prompt`、`network: false`)。
- AbortError 静默、非 abort 异常报给 onError 的判断逻辑。
- 不发 `Language` 头(Vue2 `streamSkillTest` 本来就没发,不是遗漏)。

## `sseRequest` 已覆盖、本文件不重做的语义(读 `.sp8/NimoOS-Service/src/sse.ts` 后确认)

逐条核对 `sse.ts:28-90`:

1. **Authorization 注入**(`sse.ts:33-38`,`getConfig().getToken()` 裸 token,无 `Bearer` 前缀)。
2. **401 → `refreshAccessToken()` → 用新 token 整条重发一次**(`sse.ts:46-54`),且重发仍 401 不循环
   (只重发一次,直接把第二次的结果向外抛)。
3. **204 → `{ok:true, status:204, noContent:true}`,不读流**(`sse.ts:56`)。
4. **非 2xx(非 204)→ `{ok:false, status, errorBody}`,不读流**;`errorBody` 优先 `resp.json()`,失败再退到
   `resp.text()`(`sse.ts:57-61`)。
5. **按行分帧、`data: ` 前缀剥离、JSON 解析、`[DONE]` 终止**(`sse.ts:63-84`)。畸形 JSON 静默跳过
   (`sse.ts:78-82`,与 Vue2 `consumeSSE` 行为一致)。
6. **流中途非 AbortError 异常 → `{ok:true, status, error}`,已收到的事件不丢**;**AbortError 向外抛**
   (`sse.ts:85-88`),由调用方(本文件的 `.catch`)自行判断是否要报给 `onError`。
7. **`Content-Type: application/json` 仅在 `body !== undefined` 时才加**(`sse.ts:37`)——本文件传了 body,
   自动带上,不用手写。

本文件因此**零重做**上述任何一条 —— 只做了:拼端点路径、拼 body 字段、把 `outcome` 翻译成
`onEvent`/`onError` 两个回调调用(与 `agentTransport.ts:30-38` 的 `runAgentRun` 同形)。

## 测试 mock 骨架来源

**`agentTransport.test.ts:1-19`**(而非 `sse.test.ts`)—— 因为本文件(`skillTestTransport.ts`)和
`agentTransport.ts` 处在同一层:两者都**消费** `sseRequest`,不是 `sseRequest` 自身。`sse.test.ts` 的骨架是
用 `fetchImpl` 注入点在更底层测 `sseRequest` 本体的分帧/401/204 等逻辑,这些在本任务里已经是"信任的黑盒",
不需要重新验证,所以本文件的测试改为 mock `@nimotech/nimoos-service` 导出的 `sseRequest` 本身
(`vi.mock('@nimotech/nimoos-service', () => ({ sseRequest: (...args) => sseRequestMock(...args) }))`),
与 `agentTransport.test.ts:8-11` 完全同款写法。

## 测试覆盖(5 例,均绿)

1. `POSTs to the skill-test endpoint with encodeURIComponent(id), { prompt, network: false } body, and no Language header`
   —— 断言 path、method、body、signal 传递,以及 `opts.headers ?? {}` 不含 `Language` 属性,`onError` 零调用。
2. `forwards every SSE event to onEvent verbatim, in order, with zero reduction` —— 捕获传给 `sseRequest` 的
   `opts.onEvent`,手动喂 3 个不同形状的事件,断言 `onEvent` 被依次原样调用 3 次。
3. `on !ok calls onError with {status, body: errorBody} and never calls onEvent` —— `sseRequestMock` 返回
   `{ok:false, status:422, errorBody:{...}}`,断言 `onError` 收到 `{status, body}`、`onEvent` 零调用。
4. `swallows AbortError from sseRequest silently` —— `sseRequestMock` reject 一个 `name==='AbortError'` 的 Error,
   断言 `onError`/`onEvent` 均零调用、promise resolve(不抛)。
5. `reports a non-abort rejection to onError and does not throw` —— reject 一个普通 Error,断言 `onError`
   收到该 error、不抛。

## RED → GREEN 证据

### RED 1 —— "不发 Language 头" 断言的判别力

破坏:临时在实现里加 `headers: { Language: 'zh_cn' }`。

```
FAIL  src/ai/services/skillTestTransport.test.ts > runSkillTest > POSTs to the skill-test
endpoint with encodeURIComponent(id), { prompt, network: false } body, and no Language header
AssertionError: expected { Language: 'zh_cn' } to not have property "Language"
- Expected: undefined
+ Received: "zh_cn"
 Tests  1 failed | 4 passed (5)
```

复原后:

```
Test Files  1 passed (1)
      Tests  5 passed (5)
```

### RED 2 —— "事件原样逐条转发" 断言的判别力

破坏:临时把 `onEvent` 包一层计数器,只转发偶数序号事件(模拟"漏转/削弱转发"这类缺陷)。

```
FAIL  src/ai/services/skillTestTransport.test.ts > runSkillTest > forwards every SSE event to
onEvent verbatim, in order, with zero reduction
AssertionError: expected "vi.fn()" to be called 3 times, but got 1 times
 Tests  1 failed | 4 passed (5)
```

复原后(`diff` 与提交前版本一致,`git status --short` 干净):

```
Test Files  1 passed (1)
      Tests  5 passed (5)
```

## 三门完整终值

```
pnpm test:      Test Files  294 passed (294)   Tests  2478 passed (2478)   exit=0
pnpm vue-tsc:   (无输出)                                                     exit=0
pnpm build:     ✓ built in 11.88s(仅既有 >500KB chunk 警告)                  exit=0
```

无红项。未触发已知噪声用例(`persist.test.ts` 的 IndexedDB flaky)。

本任务未新增 `.vue` 文件,`color-guard.test.ts` 用例数无算术变化。

## i18n

本任务**零 i18n 改动**——不消费、不新增任何文案键(事件语义与文案归属 Task 4 `TestPanel.vue`)。

## 三处偏离/确认申报(按 §2 三件套)

本任务命中公共约束 §3 已授权偏离清单中的**第 5 条**(HTTP 层失败不回显后端 body)的相邻语义:
`onError({status, body: outcome.errorBody})` 把 `errorBody` 原样交给调用方,**是否回显**由 Task 4 消费端决定,
本文件本身不做任何回显/隐藏决策,只是管道传递 —— 不算新偏离,记录仅为说明责任边界。

**"不加 Language 头"不是一条偏离,是任务书明确要求的钉子**——已用 RED 1 验证该断言有判别力,不存在
"照抄 runAgentRun 多加一个头"这类无端偏离。

无其它偏离。

## §3 末三处回源复核 —— 本任务涉及的一处(SSE 必 422 的三段根因)

逐一打开源码核实(不采信协调者原话,自己确认后改写):

1. **`NimoOS-AI/agent/main.py:2477-2484`**(不是任务书写的 2481-2484 ——
   `@app.post("/agent/sandbox-run")` 装饰器在 2477 行,`async def sandbox_run_endpoint(...)` 签名占
   2478-2485 行,`x_agent_provider_key`/`x_agent_provider_url` 在 2483-2484 行用
   `Header(..., alias=...)` 声明为**必填**——FastAPI 的 `...` 表示无默认值,缺任一头会在进入
   handler 代码前就被 FastAPI 自身的请求校验拒绝,返回 422)。
2. **`NimoOS-AI/route/v2/skills_files.go:154-160`**——`TestStream` 的转发循环
   `for _, hdr := range []string{"X-Agent-Provider-Key", "X-Agent-Provider-Url", "X-Agent-Provider-Type"}`
   **只在浏览器已经发了该头时才转发**(`if v := c.Request().Header.Get(hdr); v != ""`),自己不解析/
   注入 provider。对比 `route/v2/agent.go:124-146`——那条路径(正常对话)会主动解析当前配置的 provider
   (OpenVINO / Ollama / 已配置的云 key)并 `c.Request().Header.Set(...)` 写进请求头再转发,
   TestStream 没有等价步骤。
3. **Vue2 `NimoOS-UI/src/service/ai.js:204-258`**(`streamSkillTest`)——`doFetch` 的 headers
   只有 `Content-Type` 与可选的 `Authorization`(`:212-215`),从未发送任何
   `X-Agent-Provider-*` 头。

**结论**:浏览器不发 provider 头 → Go 层不注入 → Python 层必填校验必然失败 → 真机必 422。
三段均已核实,与任务书描述的因果链一致(仅行号从 2481 订正为 2477,更精确)。

## 状态

DONE。工作树干净,仅两个新文件待提交。
