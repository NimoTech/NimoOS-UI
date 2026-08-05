# P4 Task 7 review package — b9ac9e1..HEAD

## commits
39fed70 feat(ai): SP8-P4 T7 测试连接(本地化错误+技术详情折叠+在途竞态守卫)

## stat
 .../settings/mcp/McpServerDetail.test.ts           | 156 ++++++++++++++++++++-
 src/ai/components/settings/mcp/McpServerDetail.vue |  96 +++++++++++--
 2 files changed, 240 insertions(+), 12 deletions(-)

## diff -U10
diff --git a/src/ai/components/settings/mcp/McpServerDetail.test.ts b/src/ai/components/settings/mcp/McpServerDetail.test.ts
index e5a9bbe..3aa943b 100644
--- a/src/ai/components/settings/mcp/McpServerDetail.test.ts
+++ b/src/ai/components/settings/mcp/McpServerDetail.test.ts
@@ -1,40 +1,52 @@
-import { describe, it, expect, beforeEach, afterEach } from 'vitest'
+import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
 import { mount, flushPromises } from '@vue/test-utils'
 import { nextTick } from 'vue'
 import { createI18n } from 'vue-i18n'
 import zh from '../../../../i18n/zh_cn'
 import McpServerDetail from './McpServerDetail.vue'
 import type { McpServer } from '../../../types/mcpServer'
 
 // SP8-P4 Task 6 —— 对齐 Vue2 src/views/AI/MCP/McpServerDetail.vue(174 行)的
-// :1-157(跳过 T7 范围:测试连接按钮 :50-53、结果面板 :87-100、runTest :158-171)。
+// :1-157。
+// SP8-P4 Task 7 —— 补上「测试连接」整段:按钮 :50-53、结果面板 :87-100、
+// runTest :158-171,含 D8(本地化错误 + 折叠技术详情)与 D11(在途请求竞态守卫)。
 // 公共约束 §9:reka Teleport 组件挂载后先 await nextTick() 再查 document;
 // 异步断言用 flushPromises() 不用单个 await nextTick()。
 
+// vi.hoisted 避免 ESM 提升的 TDZ(公共约束 §9 先例 agentStore.test.ts:4-19)。
+// 只 mock service.ai.testMCPServer 这一个方法——本文件其余用例不碰网络请求,
+// 不需要也不应该 mock 掉整个 service.ai 命名空间。
+const h = vi.hoisted(() => ({ testMCPServer: vi.fn() }))
+vi.mock('@nimotech/nimoos-service', () => ({ service: { ai: h } }))
+
 const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
 
 function makeServer(overrides: Partial<McpServer> = {}): McpServer {
   return {
     id: 1,
     name: 'brave-search',
     transport: 'http',
     url: 'https://mcp.example.com/brave',
     command: '',
     args: [],
     enabled: true,
     has_headers: false,
     has_env: false,
     ...overrides,
   }
 }
 
+// T7 用例沿用 brief 里的 `srv(...)` 命名,等价于既有的 `makeServer`——避免两份
+// 重复的 fixture 构造逻辑。
+const srv = makeServer
+
 // 删除确认弹窗 portal 到 `.set-app`(D6),测试须先在 body 里放同名宿主,
 // 先例 SkillDetail.test.ts::withHost()。
 function withHost(): HTMLElement {
   const host = document.createElement('div')
   host.className = 'set-app'
   document.body.appendChild(host)
   return host
 }
 
 const mountDetail = (server: McpServer | null) =>
@@ -252,10 +264,150 @@ describe('McpServerDetail', () => {
     const w = mountDetail(makeServer({ id: 1 }))
     await w.find('.sk-pill-more').trigger('click')
     await w.findAll('.sk-menu button')[1].trigger('click')
     await flush()
     expect(host.querySelector('.sk-confirm')).not.toBeNull()
     await w.setProps({ server: makeServer({ id: 2 }) })
     await flush()
     expect(host.querySelector('.sk-confirm')).toBeNull()
   })
 })
+
+// SP8-P4 Task 7 —— 测试连接:三态(idle/testing/result)、D8(本地化错误 + 折叠
+// 技术详情)、D11(在途请求竞态守卫)。任务书 Step 1 给的完整用例,逐字照抄。
+describe('测试连接', () => {
+  beforeEach(() => { h.testMCPServer.mockReset() })
+
+  it('点按钮进入 testing 态:按钮禁用、文案变「测试中…」、出现 spinner', async () => {
+    let resolve!: (v: unknown) => void
+    h.testMCPServer.mockReturnValue(new Promise((r) => { resolve = r }))
+    const w = mountDetail(srv({ id: 5 }))
+    await w.find('.mcp-test-btn').trigger('click')
+    await nextTick()
+    expect(w.find('.mcp-test-btn').attributes('disabled')).toBeDefined()
+    expect(w.find('.mcp-test-btn').text()).toContain(zh.aiMcpSrvTesting)
+    expect(w.find('.mcp-test-btn .sk-spinner').exists()).toBe(true)
+    resolve({ ok: true, tool_count: 0, tools: [] })
+    await flushPromises()
+  })
+
+  it('stdio 才显示 90 秒提示,http 不显示(两次挂载对照)', async () => {
+    h.testMCPServer.mockReturnValue(new Promise(() => {}))
+    const a = mountDetail(srv({ transport: 'stdio', command: 'npx' }))
+    await a.find('.mcp-test-btn').trigger('click'); await nextTick()
+    expect(a.find('.mcp-test-hint').exists()).toBe(true)
+    const b = mountDetail(srv({ transport: 'http' }))
+    await b.find('.mcp-test-btn').trigger('click'); await nextTick()
+    expect(b.find('.mcp-test-hint').exists()).toBe(false)
+  })
+
+  // 单层取数的钉子:mock 是**裸对象**。若实现多剥一层 .data,这条会红。
+  it('成功:单层取数,显示已连接 · N 个工具 + 工具 chip', async () => {
+    h.testMCPServer.mockResolvedValue({ ok: true, tool_count: 2, tools: ['search', 'fetch'] })
+    const w = mountDetail(srv({ id: 5 }))
+    await w.find('.mcp-test-btn').trigger('click')
+    await flushPromises()
+    expect(h.testMCPServer).toHaveBeenCalledWith(5)
+    expect(w.find('.mcp-test-result').attributes('data-ok')).toBe('true')
+    expect(w.find('.mcp-test-line').text()).toContain('已连接 · 2 个工具')
+    expect(w.findAll('.mcp-tool-chip').map((c) => c.text())).toEqual(['search', 'fetch'])
+    expect(w.find('.mcp-test-detail').exists()).toBe(false)
+  })
+
+  it('失败:显示本地化文案,后端 error 英文串不出现在界面上', async () => {
+    h.testMCPServer.mockResolvedValue({
+      ok: false, error_key: 'connect_failed',
+      error: 'Connection failed: All connection attempts failed',
+      detail: 'All connection attempts failed',
+    })
+    const w = mountDetail(srv())
+    await w.find('.mcp-test-btn').trigger('click')
+    await flushPromises()
+    expect(w.find('.mcp-test-result').attributes('data-ok')).toBe('false')
+    expect(w.find('.mcp-test-line').text()).toContain(zh.aiMcpSrvTestErrConnect)
+    expect(w.text()).not.toContain('Connection failed: All connection attempts failed')
+  })
+
+  it('detail 非空才渲染折叠区,且默认折叠(无 open 属性)', async () => {
+    h.testMCPServer.mockResolvedValue({ ok: false, error_key: 'connect_failed', detail: 'ENOENT npx' })
+    const w = mountDetail(srv())
+    await w.find('.mcp-test-btn').trigger('click')
+    await flushPromises()
+    const d = w.find('.mcp-test-detail')
+    expect(d.exists()).toBe(true)
+    expect(d.attributes('open')).toBeUndefined()
+    expect(d.find('summary').text()).toBe(zh.aiMcpSrvTestDetail)
+    expect(d.find('pre').text()).toBe('ENOENT npx')
+  })
+
+  it('detail 为空时不渲染折叠区(对照)', async () => {
+    h.testMCPServer.mockResolvedValue({ ok: false, error_key: 'probe_timeout' })
+    const w = mountDetail(srv())
+    await w.find('.mcp-test-btn').trigger('click')
+    await flushPromises()
+    expect(w.find('.mcp-test-line').text()).toContain(zh.aiMcpSrvTestErrTimeout)
+    expect(w.find('.mcp-test-detail').exists()).toBe(false)
+  })
+
+  it('502 agent unreachable(抛错路径)→ 专用文案,不显示后端 body', async () => {
+    h.testMCPServer.mockRejectedValue(
+      Object.assign(new Error('x'), { response: { status: 502, data: { ok: false, error: 'agent unreachable' } } }),
+    )
+    const w = mountDetail(srv())
+    await w.find('.mcp-test-btn').trigger('click')
+    await flushPromises()
+    expect(w.find('.mcp-test-line').text()).toContain(zh.aiMcpSrvTestErrAgentDown)
+    expect(w.text()).not.toContain('agent unreachable')
+  })
+
+  it('testing 期间重复点击不重复发请求(Vue2 :159 的 if (!this.server || this.testing) return)', async () => {
+    h.testMCPServer.mockReturnValue(new Promise(() => {}))
+    const w = mountDetail(srv())
+    await w.find('.mcp-test-btn').trigger('click')
+    await w.find('.mcp-test-btn').trigger('click')
+    await w.find('.mcp-test-btn').trigger('click')
+    expect(h.testMCPServer).toHaveBeenCalledTimes(1)
+  })
+
+  it('切换服务器时清空 testing 与结果', async () => {
+    h.testMCPServer.mockResolvedValue({ ok: true, tool_count: 1, tools: ['a'] })
+    const w = mountDetail(srv({ id: 1 }))
+    await w.find('.mcp-test-btn').trigger('click')
+    await flushPromises()
+    expect(w.find('.mcp-test-result').exists()).toBe(true)
+    await w.setProps({ server: srv({ id: 2, name: 'other' }) })
+    await nextTick()
+    expect(w.find('.mcp-test-result').exists()).toBe(false)
+  })
+
+  // ★ D11 竞态守卫 —— 本任务的核心钉子。
+  // 弱断言(只查「结果面板不存在」)在切换后本来就成立,抓不出竞态;必须让
+  // 旧请求在切换**之后**才落地,再断言面板仍为空。
+  it('D11:在途请求落地时若已切到别的服务器,结果被丢弃(不串台)', async () => {
+    let resolveOld!: (v: unknown) => void
+    h.testMCPServer.mockReturnValueOnce(new Promise((r) => { resolveOld = r }))
+    const w = mountDetail(srv({ id: 1, name: 'old' }))
+    await w.find('.mcp-test-btn').trigger('click')
+    await nextTick()
+    // 切到另一台服务器
+    await w.setProps({ server: srv({ id: 2, name: 'new' }) })
+    await nextTick()
+    // 旧请求现在才落地,且是「成功」——若无守卫,会在新服务器面板上显示成功
+    resolveOld({ ok: true, tool_count: 9, tools: ['leaked'] })
+    await flushPromises()
+    expect(w.find('.mcp-test-result').exists()).toBe(false)
+    expect(w.text()).not.toContain('leaked')
+    expect(w.find('.mcp-test-btn').text()).toContain(zh.aiMcpSrvTest) // 不卡在「测试中…」
+  })
+
+  it('D11 对照:未切换时结果正常落地(守卫不能把正常路径也挡掉)', async () => {
+    let resolveIt!: (v: unknown) => void
+    h.testMCPServer.mockReturnValueOnce(new Promise((r) => { resolveIt = r }))
+    const w = mountDetail(srv({ id: 1 }))
+    await w.find('.mcp-test-btn').trigger('click')
+    await nextTick()
+    resolveIt({ ok: true, tool_count: 1, tools: ['kept'] })
+    await flushPromises()
+    expect(w.find('.mcp-test-result').attributes('data-ok')).toBe('true')
+    expect(w.text()).toContain('kept')
+  })
+})
diff --git a/src/ai/components/settings/mcp/McpServerDetail.vue b/src/ai/components/settings/mcp/McpServerDetail.vue
index 4fe50a8..6ef924b 100644
--- a/src/ai/components/settings/mcp/McpServerDetail.vue
+++ b/src/ai/components/settings/mcp/McpServerDetail.vue
@@ -1,18 +1,19 @@
 <!--
   SP8-P4 Task 6 —— 1:1 移植自 Vue2 `NimoOS-UI/src/views/AI/MCP/McpServerDetail.vue`
-  (174 行)的 `:1-157`,但按任务书跳过留给 T7 的三段(本文件完全不出现相关 DOM/状态):
+  (174 行)的 `:1-157`。Task 7(测试连接)补全了 T6 留白的三段:
     - `:50-53` 「测试连接」按钮
     - `:87-100` 测试提示 `.mcp-test-hint` / 结果面板 `.mcp-test-result`
-    - `:158-171` `runTest()` 方法与 `testing`/`testResult` 状态
-  三处留给 T7 的落点标记为行内注释,写在 Vue2 原行号对应的确切位置(见下方模板里
-  「SP8-P4 T7 在此插入…」两处,以及 `watch` 回调里的第三处)。
+    - `:158-171` `runTest()` 方法与 `testing`/`testResult`(本仓 `testView`)状态,
+      外加 `watch(() => props.server?.id)` 里对应的重置
+  T7 的两条偏离(**D8** 错误呈现本地化 + 可折叠技术详情、**D11** 在途请求竞态守卫)
+  见 `<script>` 里 `runTest`/`reqSeq` 头注释与模板 `mcp-test-result` 分支内的注释。
 
   【偏离 D3,公共约束 §3 第 3 条】`SkillIcon.vue` 不移植,统一用
   `../../icons/AgentIcon.vue`(承 P3a/T5 先例)。
   Vue2 `:121` 给删除按钮的 `SkillIcon` 传了具名色 `color="white"`——本仓不传。
   已 grep 确认 `.sk-btn.danger`(sk-shared.scss:50-54)自带 `color: white` 声明:
     &.danger { background: var(--danger); color: white; &:hover { ... } }
   `AgentIcon` 的 `color` prop 默认值本就是 `currentColor`(AgentIcon.vue:79),
   SVG `stroke` 走 `currentColor`(AgentIcon.vue:88)会继承按钮的 `color: white`,
   不需要在本组件重复书写颜色——与 `SkillDetail.vue:507-510` 删除按钮的既有写法
   (同样不传 color)完全一致,不是新模式。
@@ -61,24 +62,26 @@
   视觉结果不变,不是遗漏。
 
   零 `<style>` 块:用到的每个类均已存在于 `skills-styles.scss`
   (`sk-detail*`/`sk-name`/`sk-meta-*`/`sk-section*`/`sk-menu`/`sk-pill-more`/
   `sk-confirm*`)、`sk-shared.scss`(`sw`/`sk-modal*`/`sk-btn`)或 T1 的
   `mcp-styles.scss`(`mcp-config*`/`mcp-code`)。
 -->
 <script setup lang="ts">
 import { ref, watch, onBeforeUnmount } from 'vue'
 import { useI18n } from 'vue-i18n'
+import { service } from '@nimotech/nimoos-service'
 import {
   DialogRoot, DialogPortal, DialogOverlay, DialogContent, DialogTitle, VisuallyHidden,
 } from 'reka-ui'
-import type { McpServer } from '../../../types/mcpServer'
+import type { McpServer, McpTestView } from '../../../types/mcpServer'
+import { toTestView, toTestViewFromError } from '../../../util/mcpErrorKey'
 import { serverColor, transportLabel, SERVER_GLYPH } from '../../../util/mcpServerVisual'
 import AgentIcon from '../../icons/AgentIcon.vue'
 import SkillTile from '../skills/SkillTile.vue'
 
 // 对齐 Vue2 `props: { server: { type: Object, default: null } }`(:139)。
 const props = defineProps<{ server: McpServer | null }>()
 
 // 对齐 Vue2 `$emit('toggle', …)`(:18)/`$emit('edit', …)`(:22)/`$emit('delete', …)`(:157)。
 const emit = defineEmits<{
   (e: 'toggle', id: number, enabled: boolean): void
@@ -92,45 +95,89 @@ const { t } = useI18n()
 const glyph = SERVER_GLYPH
 
 // 更多菜单开合,对齐 Vue2 `data(){ menuOpen: false }`(:140)。
 const menuOpen = ref(false)
 // 删除确认弹窗,对齐 Vue2 `data(){ confirm: false }`(:140)——改名 confirmOpen,
 // 见文件头注释「实现选择,非行为偏离」。
 const confirmOpen = ref(false)
 // `.sk-pill-more` 按钮 + `.sk-menu` 下拉的包裹元素,对齐 Vue2 `ref="menuWrap"`(:19)。
 const menuWrap = ref<HTMLElement | null>(null)
 
+// 测试连接,对齐 Vue2 `data(){ testing: false, testResult: null }`(:140)——本仓
+// `testResult` 改名 `testView`,因为存的是 T3 `toTestView`/`toTestViewFromError`
+// 映射后的 `McpTestView`(i18n 键 + detail),不是后端裸响应,改名避免与
+// `McpTestResult`(后端原始形状,types/mcpServer.ts)混淆。
+const testing = ref(false)
+const testView = ref<McpTestView | null>(null)
+// 【偏离 D11,公共约束 §3 第 11 条】Vue2 `runTest`(`:158-171`)没有请求令牌:
+// stdio 探测最长 100 秒(`NimoOS-AI/route/v2/mcp.go:346`),这期间用户切到别的
+// 服务器时,上面的 `watch(() => props.server?.id)` 已经把 `testView` 清空,
+// 但在途 promise 落地后仍会执行 `testView.value = ...`,把**旧服务器的结果**
+// 写进**新服务器的面板**——可复现的错配,不是无害的时序巧合。这里用单调递增的
+// `reqSeq` 守卫:进入时取号,`watch` 里切换服务器会让号作废,成功/失败/finally
+// 三处落地前都比对号是否还是自己发出时的那个,不是就整体丢弃(包括不复位
+// `testing`,因为那已经是新一轮的状态,由新一轮自己的 finally 负责)。
+const reqSeq = ref(0)
+
+// 对齐 Vue2 `runTest()`(:158-171)。
+async function runTest() {
+  if (!props.server || testing.value) return // Vue2 :159 逐字对应
+  const seq = ++reqSeq.value
+  const id = props.server.id
+  testing.value = true
+  testView.value = null
+  try {
+    // 【偏离 D1,公共约束 §3 第 1 条】单层取数:共享包 `service.ai.testMCPServer`
+    // 已 `return res.data`(`NimoOS-Service/src/ai.ts:388-391`),后端
+    // `mcp.go:355` 是 `c.JSONBlob` 裸对象。Vue2 `:164` 的 `resp.data` 在本仓
+    // 恒为 `undefined`,会让「测试连接」**永远显示连接失败**,哪怕后端返回
+    // `ok:true`——照抄即缺陷,这里直接用 `body` 本身。
+    const body = await service.ai.testMCPServer(id)
+    if (seq !== reqSeq.value) return
+    testView.value = toTestView(body)
+  } catch (e) {
+    if (seq !== reqSeq.value) return
+    testView.value = toTestViewFromError(e)
+  } finally {
+    if (seq === reqSeq.value) testing.value = false
+  }
+}
+
 // 外部点击关闭菜单,逐字等价 Vue2 `watch: { menuOpen(v) {...} }`(:143-150)+
 // `beforeDestroy`(:153)。见文件头注释「外部点击关菜单」。
 let docListener: ((e: MouseEvent) => void) | null = null
 watch(menuOpen, (v) => {
   if (v) {
     docListener = (e: MouseEvent) => {
       const w = menuWrap.value
       if (w && !w.contains(e.target as Node)) menuOpen.value = false
     }
     document.addEventListener('mousedown', docListener)
   } else if (docListener) {
     document.removeEventListener('mousedown', docListener)
     docListener = null
   }
 })
 onBeforeUnmount(() => {
   if (docListener) document.removeEventListener('mousedown', docListener)
 })
 
-// 对齐 Vue2 `watch: { 'server.id'() {...} }`(:151)。
+// 对齐 Vue2 `watch: { 'server.id'() {...} }`(:151),同一行还清了
+// `this.testing = false; this.testResult = null`。本仓额外 `reqSeq.value++`
+// ——【偏离 D11】见下方 `runTest` 头注释:让切走时仍在途的旧请求失效,落地时
+// 序号比对不通过就整体丢弃,不会把旧服务器的测试结果写进新服务器的面板。
 watch(() => props.server?.id, () => {
   menuOpen.value = false
   confirmOpen.value = false
-  // SP8-P4 T7 会在这里追加 testing / testView / reqSeq 的重置
-  // (Vue2 同一行 `:151` 还清了 `this.testing = false; this.testResult = null`)。
+  reqSeq.value += 1
+  testing.value = false
+  testView.value = null
 })
 
 // 对齐 Vue2 `closeAnd(fn)`(:155)。
 function closeAnd(fn?: () => void) {
   menuOpen.value = false
   fn?.()
 }
 
 // 对齐 Vue2 菜单第一项内联箭头 `() => $emit('edit', server)`(:22)。拆成具名函数
 // (而不是模板内联箭头函数体)是因为 vue-tsc 对 v-else 分支里 `server` 的非空窄化
@@ -216,21 +263,25 @@ function doDelete() {
             <div class="sk-meta-cell">
               <div class="lbl">{{ t('aiMcpSrvEnv') }}</div>
               <div class="val">{{ server.has_env ? t('aiMcpSrvConfigured') : t('aiMcpSrvNone') }}</div>
             </div>
           </div>
 
           <div class="sk-section">
             <div class="sk-section-head">
               <div class="sk-section-title">{{ t('aiMcpSrvConfiguration') }}</div>
               <div class="sk-section-hint">{{ t('aiMcpSrvConfigHint') }}</div>
-              <!-- SP8-P4 T7 在此插入「测试连接」按钮(Vue2 :50-53) -->
+              <!-- 对齐 Vue2 :50-53。 -->
+              <button class="sk-btn ghost mcp-test-btn" :disabled="testing" @click="runTest">
+                <span v-if="testing" class="sk-spinner" />
+                {{ testing ? t('aiMcpSrvTesting') : t('aiMcpSrvTest') }}
+              </button>
             </div>
             <div class="sk-section-body">
               <div class="mcp-config">
                 <template v-if="server.transport === 'stdio'">
                   <div class="mcp-config-row">
                     <div class="lbl">{{ t('aiMcpSrvCommand') }}</div>
                     <div class="val"><code class="mcp-code">{{ server.command }}</code></div>
                   </div>
                   <div class="mcp-config-row">
                     <div class="lbl">{{ t('aiMcpSrvArgs') }}</div>
@@ -250,21 +301,46 @@ function doDelete() {
                     <div class="lbl">{{ t('aiMcpSrvReqHeaders') }}</div>
                     <div class="val">{{ server.has_headers ? t('aiMcpSrvConfiguredHidden') : t('aiMcpSrvNone') }}</div>
                   </div>
                   <div class="mcp-config-row">
                     <div class="lbl">{{ t('aiMcpSrvEnvVars') }}</div>
                     <div class="val">{{ server.has_env ? t('aiMcpSrvConfiguredHidden') : t('aiMcpSrvNone') }}</div>
                   </div>
                 </template>
               </div>
 
-              <!-- SP8-P4 T7 在此插入测试提示与结果面板(Vue2 :87-100) -->
+              <!-- 对齐 Vue2 :87-100,stdio 90 秒提示照抄。 -->
+              <div v-if="testing && server.transport === 'stdio'" class="mcp-test-hint">
+                {{ t('aiMcpSrvTestStdioHint') }}
+              </div>
+              <div v-if="testView" class="mcp-test-result" :data-ok="testView.ok ? 'true' : 'false'">
+                <template v-if="testView.ok">
+                  <div class="mcp-test-line">✓ {{ t('aiMcpSrvTestOk', { n: testView.toolCount }) }}</div>
+                  <div class="mcp-test-tools">
+                    <span v-for="tool in testView.tools" :key="tool" class="mcp-tool-chip">{{ tool }}</span>
+                  </div>
+                </template>
+                <template v-else>
+                  <div class="mcp-test-line">✗ {{ t(testView.msgKey) }}</div>
+                  <!-- 【偏离 D8,公共约束 §3 第 8 条】Vue2 `:98` 直接显示后端拼好的
+                       英文 error 串(`testResult.error`)。这里改成 `error_key`
+                       映射出的本地化一句话(`testView.msgKey`)+ 默认折叠的技术
+                       详情(`testView.detail`,用户 2026-07-31 拍板);后端英文
+                       原文一律不上界面。`detail` 为空时整个折叠区不渲染
+                       (`v-if="testView.detail"`)——本控件 Vue2 没有,是本期新增
+                       的、已授权的界面偏离,不是"照抄之外顺手加的东西"。 -->
+                  <details v-if="testView.detail" class="mcp-test-detail">
+                    <summary>{{ t('aiMcpSrvTestDetail') }}</summary>
+                    <pre>{{ testView.detail }}</pre>
+                  </details>
+                </template>
+              </div>
             </div>
           </div>
 
           <div class="sk-section">
             <div class="sk-section-body">
               <div class="sk-description">{{ t('aiMcpSrvToolsNote') }}</div>
             </div>
           </div>
         </div>
       </div>
