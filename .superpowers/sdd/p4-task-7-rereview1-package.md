# P4 Task 7 fix-round-1 re-review package — 39fed70..HEAD

## commits
7b4e46b test(ai): SP8-P4 T7 补 finally 守卫判别性用例(评审 Important 修复)

## stat
 .../settings/mcp/McpServerDetail.test.ts           | 47 ++++++++++++++++++++++
 1 file changed, 47 insertions(+)

## diff -U10
diff --git a/src/ai/components/settings/mcp/McpServerDetail.test.ts b/src/ai/components/settings/mcp/McpServerDetail.test.ts
index 3aa943b..d20497d 100644
--- a/src/ai/components/settings/mcp/McpServerDetail.test.ts
+++ b/src/ai/components/settings/mcp/McpServerDetail.test.ts
@@ -403,11 +403,58 @@ describe('测试连接', () => {
     let resolveIt!: (v: unknown) => void
     h.testMCPServer.mockReturnValueOnce(new Promise((r) => { resolveIt = r }))
     const w = mountDetail(srv({ id: 1 }))
     await w.find('.mcp-test-btn').trigger('click')
     await nextTick()
     resolveIt({ ok: true, tool_count: 1, tools: ['kept'] })
     await flushPromises()
     expect(w.find('.mcp-test-result').attributes('data-ok')).toBe('true')
     expect(w.text()).toContain('kept')
   })
+
+  // ★ finally 守卫的判别性用例(评审 Important 补丁)。
+  // 只有「旧请求落地时,新一轮测试正在进行中」这个场景才能区分「有 seq 守卫」与
+  // 「无 seq 守卫」——因为只有这时 testing 的值才会被旧请求错误地打回 false。
+  // 时序:server1 点测试(悬挂)→ 切到 server2 → server2 点测试(悬挂,testing=true)
+  // → 此时才让 server1 的旧请求落地 → 断言界面仍是「测试中…」、按钮仍 disabled、
+  // 结果面板仍不存在。若 finally 分支是无条件 `testing.value = false`(去掉
+  // seq 比对),旧请求落地会把 testing 打回 false,这条会红。
+  it('finally 守卫:旧请求成功落地时若新一轮测试进行中,不会把 testing 打回 false', async () => {
+    let resolveOld!: (v: unknown) => void
+    h.testMCPServer.mockReturnValueOnce(new Promise((r) => { resolveOld = r }))
+    const w = mountDetail(srv({ id: 1, name: 'old' }))
+    await w.find('.mcp-test-btn').trigger('click')
+    await nextTick()
+    await w.setProps({ server: srv({ id: 2, name: 'new' }) })
+    await nextTick()
+    h.testMCPServer.mockReturnValueOnce(new Promise(() => {})) // 新一轮悬挂,不落地
+    await w.find('.mcp-test-btn').trigger('click')
+    await nextTick()
+    expect(w.find('.mcp-test-btn').text()).toContain(zh.aiMcpSrvTesting)
+    // 旧请求(server1)现在才成功落地
+    resolveOld({ ok: true, tool_count: 3, tools: ['leaked-ok'] })
+    await flushPromises()
+    expect(w.find('.mcp-test-btn').text()).toContain(zh.aiMcpSrvTesting)
+    expect(w.find('.mcp-test-btn').attributes('disabled')).toBeDefined()
+    expect(w.find('.mcp-test-result').exists()).toBe(false)
+  })
+
+  it('finally 守卫:旧请求抛错落地时若新一轮测试进行中,不会把 testing 打回 false', async () => {
+    let rejectOld!: (e: unknown) => void
+    h.testMCPServer.mockReturnValueOnce(new Promise((_resolve, reject) => { rejectOld = reject }))
+    const w = mountDetail(srv({ id: 1, name: 'old' }))
+    await w.find('.mcp-test-btn').trigger('click')
+    await nextTick()
+    await w.setProps({ server: srv({ id: 2, name: 'new' }) })
+    await nextTick()
+    h.testMCPServer.mockReturnValueOnce(new Promise(() => {})) // 新一轮悬挂,不落地
+    await w.find('.mcp-test-btn').trigger('click')
+    await nextTick()
+    expect(w.find('.mcp-test-btn').text()).toContain(zh.aiMcpSrvTesting)
+    // 旧请求(server1)现在才抛错落地
+    rejectOld(Object.assign(new Error('boom'), { response: { status: 500, data: {} } }))
+    await flushPromises()
+    expect(w.find('.mcp-test-btn').text()).toContain(zh.aiMcpSrvTesting)
+    expect(w.find('.mcp-test-btn').attributes('disabled')).toBeDefined()
+    expect(w.find('.mcp-test-result').exists()).toBe(false)
+  })
 })
