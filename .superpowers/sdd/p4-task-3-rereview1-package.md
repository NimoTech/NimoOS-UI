# P4 Task 3 fix-round-1 re-review package — 39f7e44..HEAD

## commits
ae161ca fix(ai): SP8-P4 T3 评审修复——补 4 类边界形状用例(裸串/数组/error_key:null/502 非常规 body)

## stat
 src/ai/util/mcpErrorKey.test.ts | 49 +++++++++++++++++++++++++++++++++++++++++
 src/ai/util/mcpErrorKey.ts      |  2 +-
 2 files changed, 50 insertions(+), 1 deletion(-)

## diff -U10
diff --git a/src/ai/util/mcpErrorKey.test.ts b/src/ai/util/mcpErrorKey.test.ts
index ce7877e..ce29168 100644
--- a/src/ai/util/mcpErrorKey.test.ts
+++ b/src/ai/util/mcpErrorKey.test.ts
@@ -36,20 +36,35 @@ describe('saveServerErrorKey —— 后端 validateAndClean 的三条 400', () =
   })
   it('无 response / 网络错 → 通用兜底', () => {
     expect(saveServerErrorKey(new Error('Network Error'))).toBe('aiCfgSaveFailed')
     expect(saveServerErrorKey(null)).toBe('aiCfgSaveFailed')
     expect(saveServerErrorKey(undefined)).toBe('aiCfgSaveFailed')
   })
   it('也读 FastAPI 的 detail 形状(同 channelsFormat 的双读惯例)', () => {
     expect(saveServerErrorKey(httpErr(400, { detail: 'command required for stdio' })))
       .toBe('aiMcpSrvErrCommandRequired')
   })
+  // 评审 Important:body 裸字符串——rawMessage 只认 `{message}`/`{detail}` 对象形状,
+  // 裸字符串不满足 `typeof data === 'object'`,必须落通用兜底,且该字符串不能原样漏出。
+  it('body 是裸字符串 → 通用兜底,不回显该字符串', () => {
+    const k = saveServerErrorKey(httpErr(400, 'plain text error'))
+    expect(k).toBe('aiCfgSaveFailed')
+    expect(JSON.stringify(k)).not.toContain('plain text error')
+  })
+  // body 数组:`typeof [] === 'object'` 为真,但数组没有 `.message`/`.detail` 属性,
+  // 取值链必须安全地拿到 undefined 而不是抛异常或意外拼出数组内容。
+  it('body 是数组 → 通用兜底,不泄漏数组内容', () => {
+    const k = saveServerErrorKey(httpErr(400, ['a', 'b']))
+    expect(k).toBe('aiCfgSaveFailed')
+    expect(JSON.stringify(k)).not.toContain('"a"')
+    expect(JSON.stringify(k)).not.toContain('"b"')
+  })
 })
 
 describe('parseCommandErrorKey —— mcpparse 的五条 400', () => {
   it('empty command', () => {
     expect(parseCommandErrorKey(httpErr(400, { message: 'empty command' })))
       .toBe('aiMcpSrvParseErrEmpty')
   })
   // 「没解析出可执行的命令」是同一个用户可见原因的两种后端措辞,合并到一个键。
   // (合并前已按 P3b 教训 2 检查过:两条对用户而言就是同一件事——粘贴的内容里
   //  找不到可执行命令,措辞差异只反映后端在哪一步发现的。)
@@ -73,20 +88,33 @@ describe('parseCommandErrorKey —— mcpparse 的五条 400', () => {
   // 会被 NoCommand 抢走。这条钉住优先级。
   it('「只有环境变量」不能被「没有可执行命令」抢走', () => {
     expect(parseCommandErrorKey(httpErr(400, { message: 'no command (only environment variables)' })))
       .not.toBe('aiMcpSrvParseErrNoCommand')
   })
   it('认不出的落通用兜底,不回显原文', () => {
     const k = parseCommandErrorKey(httpErr(400, { message: 'some brand new parser error' }))
     expect(k).toBe('aiMcpSrvParseFailed')
     expect(k).not.toContain('brand new')
   })
+  // 评审 Important:同一份 rawMessage 取值链被 parseCommandErrorKey 复用,
+  // 裸字符串/数组两种边界形状也要在这个函数上钉一遍(不只钉 saveServerErrorKey)。
+  it('body 是裸字符串 → 通用兜底,不回显该字符串', () => {
+    const k = parseCommandErrorKey(httpErr(400, 'plain text error'))
+    expect(k).toBe('aiMcpSrvParseFailed')
+    expect(JSON.stringify(k)).not.toContain('plain text error')
+  })
+  it('body 是数组 → 通用兜底,不泄漏数组内容', () => {
+    const k = parseCommandErrorKey(httpErr(400, ['a', 'b']))
+    expect(k).toBe('aiMcpSrvParseFailed')
+    expect(JSON.stringify(k)).not.toContain('"a"')
+    expect(JSON.stringify(k)).not.toContain('"b"')
+  })
 })
 
 describe('toTestView —— 200 响应体 → 视图', () => {
   it('成功', () => {
     expect(toTestView({ ok: true, tool_count: 3, tools: ['a', 'b', 'c'] }))
       .toEqual({ ok: true, toolCount: 3, tools: ['a', 'b', 'c'] })
   })
   it('成功但 tools 缺失 → 空数组,tool_count 缺失 → 0', () => {
     expect(toTestView({ ok: true })).toEqual({ ok: true, toolCount: 0, tools: [] })
   })
@@ -124,30 +152,51 @@ describe('toTestView —— 200 响应体 → 视图', () => {
   })
   it('完全不是对象 / null / undefined → 失败 + 通用兜底', () => {
     expect(toTestView(null)).toEqual({ ok: false, msgKey: 'aiMcpSrvTestFailed', detail: '' })
     expect(toTestView(undefined)).toEqual({ ok: false, msgKey: 'aiMcpSrvTestFailed', detail: '' })
     expect(toTestView('nope')).toEqual({ ok: false, msgKey: 'aiMcpSrvTestFailed', detail: '' })
   })
   it('detail 非字符串时归一成空串', () => {
     expect(toTestView({ ok: false, error_key: 'list_failed', detail: { a: 1 } }))
       .toEqual({ ok: false, msgKey: 'aiMcpSrvTestErrListFailed', detail: '' })
   })
+  // 评审 Important:`error_key: null` 不在四值查表里,switch 落 default 分支;
+  // 强断言整个视图形状,确保 null 本身与 detail 都没有被错误地拼进结果。
+  it('error_key 为 null → 落通用兜底,detail 仍原样保留、null 不泄漏进结果', () => {
+    const v = toTestView({ ok: false, error_key: null, detail: 'x' })
+    expect(v).toEqual({ ok: false, msgKey: 'aiMcpSrvTestFailed', detail: 'x' })
+    expect(JSON.stringify(v)).not.toContain('null')
+  })
 })
 
 describe('toTestViewFromError —— 抛出的错误 → 视图', () => {
   it('502 agent unreachable(mcp.go:351)', () => {
     expect(toTestViewFromError(httpErr(502, { ok: false, error: 'agent unreachable' })))
       .toEqual({ ok: false, msgKey: 'aiMcpSrvTestErrAgentDown', detail: '' })
   })
   it('404 mcp server not found', () => {
     expect(toTestViewFromError(httpErr(404, { message: 'mcp server not found' })))
       .toEqual({ ok: false, msgKey: 'aiMcpSrvErrNotFound', detail: '' })
   })
   it('网络错 / 无 response → 通用兜底', () => {
     expect(toTestViewFromError(new Error('Network Error')))
       .toEqual({ ok: false, msgKey: 'aiMcpSrvTestFailed', detail: '' })
   })
   it('任意后端原文都不进入视图', () => {
     const v = toTestViewFromError(httpErr(500, { message: 'LEAKED-ENGLISH-STRING' }))
     expect(JSON.stringify(v)).not.toContain('LEAKED-ENGLISH-STRING')
   })
+  // 评审 Important:502 判定只看 status===502(见 mcpErrorKey.ts 的
+  // `status === 502 || bodyError === 'agent unreachable'`),不依赖 body 形状——
+  // body 不是预期的 `{ok:false,error:'agent unreachable'}` 时也必须落 agentDown,
+  // 且 body 里塞的任何内容都不能泄漏进视图。
+  it('502 但 body 形状不是预期的那个(非常规对象)→ 仍判 agentDown,不泄漏 body 内容', () => {
+    const v = toTestViewFromError(httpErr(502, { unexpected: 'LEAKED-UNEXPECTED-SHAPE' }))
+    expect(v).toEqual({ ok: false, msgKey: 'aiMcpSrvTestErrAgentDown', detail: '' })
+    expect(JSON.stringify(v)).not.toContain('LEAKED-UNEXPECTED-SHAPE')
+  })
+  it('502 且 body 是裸字符串 → 仍判 agentDown,不泄漏该字符串', () => {
+    const v = toTestViewFromError(httpErr(502, 'LEAKED-STRING-BODY'))
+    expect(v).toEqual({ ok: false, msgKey: 'aiMcpSrvTestErrAgentDown', detail: '' })
+    expect(JSON.stringify(v)).not.toContain('LEAKED-STRING-BODY')
+  })
 })
diff --git a/src/ai/util/mcpErrorKey.ts b/src/ai/util/mcpErrorKey.ts
index b99a6b7..dc83e85 100644
--- a/src/ai/util/mcpErrorKey.ts
+++ b/src/ai/util/mcpErrorKey.ts
@@ -88,21 +88,21 @@ export function toTestView(body: unknown): McpTestView {
   switch (b.error_key) {
     case 'probe_timeout': return { ok: false, msgKey: 'aiMcpSrvTestErrTimeout', detail }
     case 'connect_failed': return { ok: false, msgKey: 'aiMcpSrvTestErrConnect', detail }
     case 'list_timeout': return { ok: false, msgKey: 'aiMcpSrvTestErrListTimeout', detail }
     case 'list_failed': return { ok: false, msgKey: 'aiMcpSrvTestErrListFailed', detail }
     default: return { ok: false, msgKey: 'aiMcpSrvTestFailed', detail }
   }
 }
 
 /** 抛出的错误(HTTP 层失败,不是 200 里的 `{ok:false,...}`)→ 视图。
- *  `mcp.go:349` 的 502 `{ok:false,error:"agent unreachable"}` 与 404
+ *  `mcp.go:351` 的 502 `{ok:false,error:"agent unreachable"}` 与 404
  *  `mcp server not found` 各给专用键,其余一律通用兜底,body 的字符串
  *  永不放进 `detail`(那是后端英文原文)。 */
 export function toTestViewFromError(e: unknown): McpTestView {
   const status = statusOf(e)
   const data = (e as { response?: { data?: unknown } } | null | undefined)?.response?.data
   const bodyError = data && typeof data === 'object' ? (data as { error?: unknown }).error : undefined
   if (status === 502 || bodyError === 'agent unreachable') {
     return { ok: false, msgKey: 'aiMcpSrvTestErrAgentDown', detail: '' }
   }
   if (rawMessage(e) === 'mcp server not found') {
