# P4 Task 3 review package — c154a1a..HEAD

## commits
39f7e44 feat(ai): SP8-P4 T3 MCP 错误映射(后端串→i18n 键,界面零原文)

## stat
 src/ai/util/mcpErrorKey.test.ts | 153 ++++++++++++++++++++++++++++++++++++++++
 src/ai/util/mcpErrorKey.ts      | 112 +++++++++++++++++++++++++++++
 2 files changed, 265 insertions(+)

## diff -U10
diff --git a/src/ai/util/mcpErrorKey.test.ts b/src/ai/util/mcpErrorKey.test.ts
new file mode 100644
index 0000000..ce7877e
--- /dev/null
+++ b/src/ai/util/mcpErrorKey.test.ts
@@ -0,0 +1,153 @@
+import { describe, it, expect } from 'vitest'
+import {
+  saveServerErrorKey, parseCommandErrorKey, toTestView, toTestViewFromError,
+} from './mcpErrorKey'
+
+/** 造一个 axios 风格的错误(共享包不吞 error,原样抛)。 */
+function httpErr(status: number, data: unknown) {
+  return Object.assign(new Error('Request failed'), { response: { status, data } })
+}
+
+describe('saveServerErrorKey —— 后端 validateAndClean 的三条 400', () => {
+  it('url required for http/sse', () => {
+    expect(saveServerErrorKey(httpErr(400, { message: 'url required for http/sse' })))
+      .toBe('aiMcpSrvErrUrlRequired')
+  })
+  it('command required for stdio', () => {
+    expect(saveServerErrorKey(httpErr(400, { message: 'command required for stdio' })))
+      .toBe('aiMcpSrvErrCommandRequired')
+  })
+  it("transport must be 'http', 'sse' or 'stdio'", () => {
+    expect(saveServerErrorKey(httpErr(400, { message: "transport must be 'http', 'sse' or 'stdio'" })))
+      .toBe('aiMcpSrvErrBadTransport')
+  })
+  it('404 mcp server not found', () => {
+    expect(saveServerErrorKey(httpErr(404, { message: 'mcp server not found' })))
+      .toBe('aiMcpSrvErrNotFound')
+  })
+  it('大小写与首尾空白不敏感', () => {
+    expect(saveServerErrorKey(httpErr(400, { message: '  URL Required For HTTP/SSE  ' })))
+      .toBe('aiMcpSrvErrUrlRequired')
+  })
+  it('认不出的一律落通用兜底键,绝不回显后端原文', () => {
+    const k = saveServerErrorKey(httpErr(500, { message: 'sql: database is locked' }))
+    expect(k).toBe('aiCfgSaveFailed')
+    expect(k).not.toContain('sql')
+  })
+  it('无 response / 网络错 → 通用兜底', () => {
+    expect(saveServerErrorKey(new Error('Network Error'))).toBe('aiCfgSaveFailed')
+    expect(saveServerErrorKey(null)).toBe('aiCfgSaveFailed')
+    expect(saveServerErrorKey(undefined)).toBe('aiCfgSaveFailed')
+  })
+  it('也读 FastAPI 的 detail 形状(同 channelsFormat 的双读惯例)', () => {
+    expect(saveServerErrorKey(httpErr(400, { detail: 'command required for stdio' })))
+      .toBe('aiMcpSrvErrCommandRequired')
+  })
+})
+
+describe('parseCommandErrorKey —— mcpparse 的五条 400', () => {
+  it('empty command', () => {
+    expect(parseCommandErrorKey(httpErr(400, { message: 'empty command' })))
+      .toBe('aiMcpSrvParseErrEmpty')
+  })
+  // 「没解析出可执行的命令」是同一个用户可见原因的两种后端措辞,合并到一个键。
+  // (合并前已按 P3b 教训 2 检查过:两条对用户而言就是同一件事——粘贴的内容里
+  //  找不到可执行命令,措辞差异只反映后端在哪一步发现的。)
+  it('no command after parsing → 同一个「没有可执行命令」键', () => {
+    expect(parseCommandErrorKey(httpErr(400, { message: 'no command after parsing' })))
+      .toBe('aiMcpSrvParseErrNoCommand')
+  })
+  it("no command after '--' → 同一个「没有可执行命令」键", () => {
+    expect(parseCommandErrorKey(httpErr(400, { message: "no command after '--'" })))
+      .toBe('aiMcpSrvParseErrNoCommand')
+  })
+  it('no command (only environment variables) → 独立的键(原因不同:只有环境变量)', () => {
+    expect(parseCommandErrorKey(httpErr(400, { message: 'no command (only environment variables)' })))
+      .toBe('aiMcpSrvParseErrOnlyEnv')
+  })
+  it('unbalanced quotes in command', () => {
+    expect(parseCommandErrorKey(httpErr(400, { message: 'unbalanced quotes in command' })))
+      .toBe('aiMcpSrvParseErrQuotes')
+  })
+  // 判别力:「只有环境变量」的串以 "no command" 开头,若实现用 startsWith 匹配
+  // 会被 NoCommand 抢走。这条钉住优先级。
+  it('「只有环境变量」不能被「没有可执行命令」抢走', () => {
+    expect(parseCommandErrorKey(httpErr(400, { message: 'no command (only environment variables)' })))
+      .not.toBe('aiMcpSrvParseErrNoCommand')
+  })
+  it('认不出的落通用兜底,不回显原文', () => {
+    const k = parseCommandErrorKey(httpErr(400, { message: 'some brand new parser error' }))
+    expect(k).toBe('aiMcpSrvParseFailed')
+    expect(k).not.toContain('brand new')
+  })
+})
+
+describe('toTestView —— 200 响应体 → 视图', () => {
+  it('成功', () => {
+    expect(toTestView({ ok: true, tool_count: 3, tools: ['a', 'b', 'c'] }))
+      .toEqual({ ok: true, toolCount: 3, tools: ['a', 'b', 'c'] })
+  })
+  it('成功但 tools 缺失 → 空数组,tool_count 缺失 → 0', () => {
+    expect(toTestView({ ok: true })).toEqual({ ok: true, toolCount: 0, tools: [] })
+  })
+  it('probe_timeout', () => {
+    expect(toTestView({ ok: false, error_key: 'probe_timeout', error: 'Probe timed out' }))
+      .toEqual({ ok: false, msgKey: 'aiMcpSrvTestErrTimeout', detail: '' })
+  })
+  it('connect_failed 带 detail', () => {
+    expect(toTestView({
+      ok: false, error_key: 'connect_failed',
+      error: 'Connection failed: All connection attempts failed',
+      detail: 'All connection attempts failed',
+    })).toEqual({
+      ok: false, msgKey: 'aiMcpSrvTestErrConnect', detail: 'All connection attempts failed',
+    })
+  })
+  it('list_timeout', () => {
+    expect(toTestView({ ok: false, error_key: 'list_timeout' }))
+      .toEqual({ ok: false, msgKey: 'aiMcpSrvTestErrListTimeout', detail: '' })
+  })
+  it('list_failed', () => {
+    expect(toTestView({ ok: false, error_key: 'list_failed', detail: 'boom' }))
+      .toEqual({ ok: false, msgKey: 'aiMcpSrvTestErrListFailed', detail: 'boom' })
+  })
+  // 判别力:后端拼好的英文 error 串绝不能漏进视图。四个 error_key 各钉一次。
+  it('后端的 error 英文串永不进入视图', () => {
+    for (const key of ['probe_timeout', 'connect_failed', 'list_timeout', 'list_failed']) {
+      const v = toTestView({ ok: false, error_key: key, error: 'LEAKED-ENGLISH-STRING' })
+      expect(JSON.stringify(v)).not.toContain('LEAKED-ENGLISH-STRING')
+    }
+  })
+  it('未知 error_key → 通用兜底键,detail 仍保留', () => {
+    expect(toTestView({ ok: false, error_key: 'brand_new_key', detail: 'd' }))
+      .toEqual({ ok: false, msgKey: 'aiMcpSrvTestFailed', detail: 'd' })
+  })
+  it('完全不是对象 / null / undefined → 失败 + 通用兜底', () => {
+    expect(toTestView(null)).toEqual({ ok: false, msgKey: 'aiMcpSrvTestFailed', detail: '' })
+    expect(toTestView(undefined)).toEqual({ ok: false, msgKey: 'aiMcpSrvTestFailed', detail: '' })
+    expect(toTestView('nope')).toEqual({ ok: false, msgKey: 'aiMcpSrvTestFailed', detail: '' })
+  })
+  it('detail 非字符串时归一成空串', () => {
+    expect(toTestView({ ok: false, error_key: 'list_failed', detail: { a: 1 } }))
+      .toEqual({ ok: false, msgKey: 'aiMcpSrvTestErrListFailed', detail: '' })
+  })
+})
+
+describe('toTestViewFromError —— 抛出的错误 → 视图', () => {
+  it('502 agent unreachable(mcp.go:351)', () => {
+    expect(toTestViewFromError(httpErr(502, { ok: false, error: 'agent unreachable' })))
+      .toEqual({ ok: false, msgKey: 'aiMcpSrvTestErrAgentDown', detail: '' })
+  })
+  it('404 mcp server not found', () => {
+    expect(toTestViewFromError(httpErr(404, { message: 'mcp server not found' })))
+      .toEqual({ ok: false, msgKey: 'aiMcpSrvErrNotFound', detail: '' })
+  })
+  it('网络错 / 无 response → 通用兜底', () => {
+    expect(toTestViewFromError(new Error('Network Error')))
+      .toEqual({ ok: false, msgKey: 'aiMcpSrvTestFailed', detail: '' })
+  })
+  it('任意后端原文都不进入视图', () => {
+    const v = toTestViewFromError(httpErr(500, { message: 'LEAKED-ENGLISH-STRING' }))
+    expect(JSON.stringify(v)).not.toContain('LEAKED-ENGLISH-STRING')
+  })
+})
diff --git a/src/ai/util/mcpErrorKey.ts b/src/ai/util/mcpErrorKey.ts
new file mode 100644
index 0000000..b99a6b7
--- /dev/null
+++ b/src/ai/util/mcpErrorKey.ts
@@ -0,0 +1,112 @@
+// SP8-P4 Task 3 —— MCP 分区的「后端串 → i18n 键」映射。
+//
+// 为什么不用 `apiError.apiErrorMessage`:它的文件头自己写了警告
+// (`apiError.ts:18-20`)——返回值仍可能是后端英文原文(FastAPI 的 `detail`
+// 直接透传),只适合“暂时兜个底”的场合,不满足“界面永不回显后端原文”这条
+// 硬约束。本文件与 `channelsFormat.addBotErrorKey`(`:65-76`)同一分工:纯函数
+// 只把后端错误归一成 i18n **键**,不碰 vue-i18n,调用方 `t()` 出当前语言的文案。
+//
+// 取值链与 channelsFormat/skillsErrorKey 同一惯例:同时读 Go 服务的
+// `response.data.message` 与 FastAPI 的 `response.data.detail`(该接口今天全部
+// 走 Go,但沿用双读不增加成本,防将来改道);匹配前 trim + toLowerCase。
+//
+// 后端串权威源(已回源逐条核实,见任务报告——brief/设计文档抄的行号与此处实测有
+// 一两行出入,已在报告里申报,不影响串本身):
+//   - `NimoOS-AI/route/v2/mcp.go:277,282,286`(validateAndClean 的三条 400)
+//   - `mcp.go:152,168,186,332,441`(五处 404 "mcp server not found";brief 只列了
+//     152/187/332 三处,实测还有 168、441 两处未被抄到——同一条串,不影响映射)
+//   - `mcp.go:351`(502 agent unreachable,`c.JSON` 直出,不经 echo.HTTPError)
+//   - `pkg/mcpparse/mcpparse.go:36,47,62,76,138`(parse 的五条 400)
+//   - `agent/mcp_client/client.py:437,448,453,456`(test_server 的 4 个 error_key)
+
+import type { McpTestView } from '../types/mcpServer'
+
+/** 对齐 channelsFormat.ts:66-70 / skillsErrorKey.ts:33-40 的取错误串形状:
+ *  同时读 Go 的 `message` 与 FastAPI 的 `detail`,取到就 trim + toLowerCase。 */
+function rawMessage(e: unknown): string {
+  const data = (e as { response?: { data?: unknown } } | null | undefined)?.response?.data
+  const raw = data && typeof data === 'object'
+    ? (data as { message?: unknown }).message ?? (data as { detail?: unknown }).detail
+    : undefined
+  return typeof raw === 'string' ? raw.trim().toLowerCase() : ''
+}
+
+function statusOf(e: unknown): number | undefined {
+  return (e as { response?: { status?: unknown } } | null | undefined)?.response?.status as number | undefined
+}
+
+/** 后端 `validateAndClean`(`mcp.go:273-289`)三条 400 + 404 "mcp server not found"
+ *  → i18n 键;其余(未知 400/500/网络错/无 response)一律落既有通用兜底键
+ *  `aiCfgSaveFailed`,绝不回显后端原文。 */
+export function saveServerErrorKey(e: unknown): string {
+  const s = rawMessage(e)
+  if (s === 'url required for http/sse') return 'aiMcpSrvErrUrlRequired'
+  if (s === 'command required for stdio') return 'aiMcpSrvErrCommandRequired'
+  if (s === "transport must be 'http', 'sse' or 'stdio'") return 'aiMcpSrvErrBadTransport'
+  if (s === 'mcp server not found') return 'aiMcpSrvErrNotFound'
+  return 'aiCfgSaveFailed'
+}
+
+/** `mcpparse.Parse`(`mcpparse.go:36,47,62,76,138`)五条 400 → 四个键(两条措辞
+ *  合并成 `aiMcpSrvParseErrNoCommand`,见测试注释);其余落 `aiMcpSrvParseFailed`。
+ *  ⚠️ 必须用相等匹配,不能用 `startsWith`/`includes` 判 "no command" 前缀——
+ *  否则 "no command (only environment variables)" 会被误判成
+ *  "no command after parsing" 类,测试已钉死这条优先级。 */
+export function parseCommandErrorKey(e: unknown): string {
+  const s = rawMessage(e)
+  if (s === 'empty command') return 'aiMcpSrvParseErrEmpty'
+  if (s === 'no command after parsing') return 'aiMcpSrvParseErrNoCommand'
+  if (s === "no command after '--'") return 'aiMcpSrvParseErrNoCommand'
+  if (s === 'no command (only environment variables)') return 'aiMcpSrvParseErrOnlyEnv'
+  if (s === 'unbalanced quotes in command') return 'aiMcpSrvParseErrQuotes'
+  return 'aiMcpSrvParseFailed'
+}
+
+/** `detail` 只在是字符串时保留,否则归一成 `''`——后端英文原文一律不上界面
+ *  (那些走 `error`/`error_key` 之外的自由文本字段,见 D8)。 */
+function detailOf(body: unknown): string {
+  const d = (body as { detail?: unknown } | null | undefined)?.detail
+  return typeof d === 'string' ? d : ''
+}
+
+/** `POST .../test` 200 裸响应体(`agent/mcp_client/client.py:432-461`)→ 视图。
+ *  成功态 `tool_count ?? 0` / `tools` 非数组归一成 `[]`;失败态按 `error_key`
+ *  四值查表,`error`(后端拼好的英文串)永不进入视图,只有 `msgKey` + `detail`。 */
+export function toTestView(body: unknown): McpTestView {
+  if (!body || typeof body !== 'object') {
+    return { ok: false, msgKey: 'aiMcpSrvTestFailed', detail: '' }
+  }
+  const b = body as { ok?: unknown; tool_count?: unknown; tools?: unknown; error_key?: unknown }
+  if (b.ok === true) {
+    return {
+      ok: true,
+      toolCount: typeof b.tool_count === 'number' ? b.tool_count : 0,
+      tools: Array.isArray(b.tools) ? b.tools : [],
+    }
+  }
+  const detail = detailOf(body)
+  switch (b.error_key) {
+    case 'probe_timeout': return { ok: false, msgKey: 'aiMcpSrvTestErrTimeout', detail }
+    case 'connect_failed': return { ok: false, msgKey: 'aiMcpSrvTestErrConnect', detail }
+    case 'list_timeout': return { ok: false, msgKey: 'aiMcpSrvTestErrListTimeout', detail }
+    case 'list_failed': return { ok: false, msgKey: 'aiMcpSrvTestErrListFailed', detail }
+    default: return { ok: false, msgKey: 'aiMcpSrvTestFailed', detail }
+  }
+}
+
+/** 抛出的错误(HTTP 层失败,不是 200 里的 `{ok:false,...}`)→ 视图。
+ *  `mcp.go:349` 的 502 `{ok:false,error:"agent unreachable"}` 与 404
+ *  `mcp server not found` 各给专用键,其余一律通用兜底,body 的字符串
+ *  永不放进 `detail`(那是后端英文原文)。 */
+export function toTestViewFromError(e: unknown): McpTestView {
+  const status = statusOf(e)
+  const data = (e as { response?: { data?: unknown } } | null | undefined)?.response?.data
+  const bodyError = data && typeof data === 'object' ? (data as { error?: unknown }).error : undefined
+  if (status === 502 || bodyError === 'agent unreachable') {
+    return { ok: false, msgKey: 'aiMcpSrvTestErrAgentDown', detail: '' }
+  }
+  if (rawMessage(e) === 'mcp server not found') {
+    return { ok: false, msgKey: 'aiMcpSrvErrNotFound', detail: '' }
+  }
+  return { ok: false, msgKey: 'aiMcpSrvTestFailed', detail: '' }
+}
