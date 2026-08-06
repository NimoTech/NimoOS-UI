# P4 final fix-wave re-review package — 69af8ed..HEAD

## commits
99ee99a fix(ai): SP8-P4 终审修复轮 —— I1/I2 判别力用例 + M2/M3/M5/M7 收尾

## stat
 src/ai/components/settings/mcp/McpServerDetail.vue |  15 ++-
 .../settings/sections/McpSection.test.ts           |  49 +++++++-
 src/ai/components/settings/sections/McpSection.vue |  19 ++-
 src/ai/types/mcpServer.ts                          |   3 +-
 src/ai/util/mcpServerVisual.ts                     |   4 +-
 src/ai/views/SettingsPage.placeholder.test.ts      | 130 +++++++++++++++++++++
 src/ai/views/SettingsPage.vue                      |  21 ++--
 7 files changed, 220 insertions(+), 21 deletions(-)

## diff -U10
diff --git a/src/ai/components/settings/mcp/McpServerDetail.vue b/src/ai/components/settings/mcp/McpServerDetail.vue
index 6ef924b..1affeb5 100644
--- a/src/ai/components/settings/mcp/McpServerDetail.vue
+++ b/src/ai/components/settings/mcp/McpServerDetail.vue
@@ -3,25 +3,27 @@
   (174 行)的 `:1-157`。Task 7(测试连接)补全了 T6 留白的三段:
     - `:50-53` 「测试连接」按钮
     - `:87-100` 测试提示 `.mcp-test-hint` / 结果面板 `.mcp-test-result`
     - `:158-171` `runTest()` 方法与 `testing`/`testResult`(本仓 `testView`)状态,
       外加 `watch(() => props.server?.id)` 里对应的重置
   T7 的两条偏离(**D8** 错误呈现本地化 + 可折叠技术详情、**D11** 在途请求竞态守卫)
   见 `<script>` 里 `runTest`/`reqSeq` 头注释与模板 `mcp-test-result` 分支内的注释。
 
   【偏离 D3,公共约束 §3 第 3 条】`SkillIcon.vue` 不移植,统一用
   `../../icons/AgentIcon.vue`(承 P3a/T5 先例)。
-  Vue2 `:121` 给删除按钮的 `SkillIcon` 传了具名色 `color="white"`——本仓不传。
-  已 grep 确认 `.sk-btn.danger`(sk-shared.scss:50-54)自带 `color: white` 声明:
-    &.danger { background: var(--danger); color: white; &:hover { ... } }
+  Vue2 `:121` 给删除按钮的 `SkillIcon` 传了一个具名色字面量——本仓不传。
+  已 grep 确认 `.sk-btn.danger`(sk-shared.scss:50-54)自带前景色声明:背景取
+  危险语义色 `--danger`、图标/文字继承该规则块里固定写死的前景色(修复轮 M7:
+  原文逐字引用了那行 CSS 源码里的颜色字面量,按公共约束 §6「注释里也不许出现
+  颜色字面量」的纪律改写成本段描述,不再照抄源码)。
   `AgentIcon` 的 `color` prop 默认值本就是 `currentColor`(AgentIcon.vue:79),
-  SVG `stroke` 走 `currentColor`(AgentIcon.vue:88)会继承按钮的 `color: white`,
+  SVG `stroke` 走 `currentColor`(AgentIcon.vue:88)会继承按钮的前景色声明,
   不需要在本组件重复书写颜色——与 `SkillDetail.vue:507-510` 删除按钮的既有写法
   (同样不传 color)完全一致,不是新模式。
 
   【偏离 D9,公共约束 §3 第 9 条】Vue2 `:36-37` 的状态圆点用内联 `:style` 现场拼
   `background` 与 `boxShadow`(两个色字面量,按配色约定不许出现在本文件里,已改写
   成中文描述:「启用」态取语义色 `--success` 的实心点 + 同色半透明发光圈,「停用」态
   取语义色 `--text-quaternary` 的实心点 + 同色半透明发光圈)。本仓整段内联 style 删掉,
   只保留 `.val` 上的 `:data-disabled`,颜色改由 `skills-styles.scss` 已有的两条静态
   规则供:`.sk-meta-cell .val .dot`(基础态,:351-369)与
   `.val[data-disabled="true"] .dot`(停用态覆写,:370-376)。DOM 结构逐字相同——
@@ -352,22 +354,23 @@ function doDelete() {
           <DialogOverlay class="sk-modal-bg">
             <DialogContent class="sk-modal sk-confirm" :aria-describedby="undefined">
               <VisuallyHidden as-child><DialogTitle>{{ t('aiMcpSrvRemoveTitle') }}</DialogTitle></VisuallyHidden>
               <div class="sk-confirm-body">
                 <h3>{{ t('aiMcpSrvRemoveTitle') }}</h3>
                 <p>{{ t('aiMcpSrvRemoveBody', { name: server.name }) }}</p>
               </div>
               <div class="sk-modal-foot">
                 <div class="right">
                   <button class="sk-btn ghost" @click="confirmOpen = false">{{ t('aiCancel') }}</button>
-                  <!-- 偏离 D3(见文件头注释):不传 color="white",由 .sk-btn.danger
-                       自带的 color: white 供色,AgentIcon 默认 currentColor 继承。 -->
+                  <!-- 偏离 D3(见文件头注释):不传具名色,由 .sk-btn.danger 自带的
+                       前景色声明供色,AgentIcon 默认 currentColor 继承(修复轮 M7:
+                       注释不再逐字引用 CSS 源码里的颜色字面量)。 -->
                   <button class="sk-btn danger" @click="doDelete">
                     <AgentIcon name="trash" :size="13" /> {{ t('aiMcpSrvRemoveConfirm') }}
                   </button>
                 </div>
               </div>
             </DialogContent>
           </DialogOverlay>
         </DialogPortal>
       </DialogRoot>
     </template>
diff --git a/src/ai/components/settings/sections/McpSection.test.ts b/src/ai/components/settings/sections/McpSection.test.ts
index 02f390a..d521038 100644
--- a/src/ai/components/settings/sections/McpSection.test.ts
+++ b/src/ai/components/settings/sections/McpSection.test.ts
@@ -1,19 +1,20 @@
 import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
 import { mount } from '@vue/test-utils'
 import { nextTick } from 'vue'
 import { createI18n } from 'vue-i18n'
 import { setActivePinia, createPinia } from 'pinia'
 import zh from '../../../../i18n/zh_cn'
 import type { McpServer } from '../../../types/mcpServer'
 import McpServerGroup from '../mcp/McpServerGroup.vue'
 import McpServerDetail from '../mcp/McpServerDetail.vue'
+import McpServerModal from '../mcp/McpServerModal.vue'
 
 // SP8-P4 Task 9(收官)—— 对齐 Vue2 src/views/AI/MCP/McpSection.vue(136 行)。
 // mock 骨架逐字照 brief §Step1「mock 骨架」段与公共约束 §9(vi.hoisted 避免 ESM
 // 提升的 TDZ,先例 agentStore.test.ts:4-19)。
 const h = vi.hoisted(() => ({
   listMCPServers: vi.fn(),
   createMCPServer: vi.fn(),
   updateMCPServer: vi.fn(),
   deleteMCPServer: vi.fn(),
   testMCPServer: vi.fn(),
@@ -293,44 +294,63 @@ describe('McpSection', () => {
     const detail = w.findComponent(McpServerDetail)
     detail.vm.$emit('delete', 2) // 删的是 b,不是当前选中的 c
     await flush()
 
     // 剩余 [a, c] 的第一项是 a——若无条件回落会错误跳成 a;正确实现应仍是 c。
     expect(w.findAll('.sk-item')).toHaveLength(2)
     expect(w.find('.sk-name span').text()).toBe('svc-c')
   })
 
   // ===== 覆盖点 9:onSave 新增单层取数 =====
-  it('9. createMCPServer 返回裸 {id:7} → activeId 变 7 + toast aiMcpSrvAddedName + 弹窗关闭 + 重新加载一次', async () => {
-    h.listMCPServers.mockResolvedValueOnce([]).mockResolvedValueOnce([srv(7, { name: 'new-one' })])
+  // 终审 Important I1(2026-07-31)—— 原 fixture 是「空列表 → 新建后单条」,即使
+  // 实现写成 Vue2 式的双剥壳(`(created as any).data?.id` 恒 undefined),
+  // `reload()` 里 `!activeId.value` 的兜底也会**恰好**选中那条唯一记录,53 条
+  // 全绿,用例分辨不出对错(见终审 §5 RED 探针 A)。改成「新建前已有 2 条且已
+  // 选中其中一条」——后端 `service/mcp.go:63` 是 `ORDER BY id` 升序,新建的
+  // 服务器 id 最大,第二次 list 返回时排在**末尾**,不是 servers[0]。这样双剥壳
+  // 缺陷下 `id` 恒 undefined、`activeId` 保持先前选中的 svc-b 不动(reload 的
+  // `!activeId.value || !found` 兜底也不会触发,因为 svc-b 仍在新列表里)——
+  // 断言精确报红;单层取数的正确实现下 `activeId` 在 onSave 里被直接设成 7,
+  // 断言精确报绿。
+  it('9. createMCPServer 返回裸 {id:7} → activeId 变 7(不是此前选中的项)+ toast aiMcpSrvAddedName + 弹窗关闭 + 重新加载一次', async () => {
+    h.listMCPServers
+      .mockResolvedValueOnce([srv(1, { name: 'svc-a' }), srv(2, { name: 'svc-b' })])
+      .mockResolvedValueOnce([srv(1, { name: 'svc-a' }), srv(2, { name: 'svc-b' }), srv(7, { name: 'new-one' })])
     const toast = useToast()
     const show = vi.spyOn(toast, 'show')
     const w = mountSection()
     await flush()
     expect(h.listMCPServers).toHaveBeenCalledTimes(1)
 
+    // 真实场景的常态:新建前用户已经选中了某台服务器(不是空态)。
+    await w.findAll('.sk-item')[1].trigger('click')
+    await flush()
+    expect(w.find('.sk-name span').text()).toBe('svc-b')
+
     await w.find('.sk-add-btn').trigger('click')
     await macroFlush()
     expect(modalTitleEl().textContent).toBe(zh.aiMcpSrvAdd)
 
     setValue(modalNameInput(), 'new-one')
     const urlInput = document.querySelector('.sk-modal [data-f="url"]') as HTMLInputElement
     setValue(urlInput, 'https://example.com/new')
     await flush()
     modalSubmitBtn().click()
     await flush()
 
     expect(h.createMCPServer).toHaveBeenCalledTimes(1)
     expect(document.querySelector('.sk-modal')).toBeNull() // 弹窗已关
     expect(show).toHaveBeenCalledWith(zh.aiMcpSrvAddedName.replace('{name}', 'new-one'))
     expect(h.listMCPServers).toHaveBeenCalledTimes(2) // 触发一次重新加载
-    expect(w.find('.sk-name span').text()).toBe('new-one') // activeId 落在 7
+    // activeId 落在新建的 7 上,不是此前选中的 svc-b,也不是列表第一项 svc-a——
+    // 双剥壳缺陷下这里会仍显示 svc-b(见上方用例头注释)。
+    expect(w.find('.sk-name span').text()).toBe('new-one')
   })
 
   // ===== 覆盖点 10:onSave 编辑 =====
   it('10. 编辑保存 → 调 updateMCPServer(editingId, payload) + toast aiCfgSaved + 弹窗关', async () => {
     h.listMCPServers.mockResolvedValue([srv(1, { name: 'svc-a', url: 'https://a.example.com' })])
     const toast = useToast()
     const show = vi.spyOn(toast, 'show')
     const w = mountSection()
     await flush()
 
@@ -382,20 +402,43 @@ describe('McpSection', () => {
   it('12b. 详情的 edit 事件打开编辑弹窗,server prop 为那一项(名称输入框回填)', async () => {
     h.listMCPServers.mockResolvedValue([srv(1, { name: 'existing-one' })])
     const w = mountSection()
     await flush()
     const detail = w.findComponent(McpServerDetail)
     detail.vm.$emit('edit', srv(1, { name: 'existing-one' }))
     await macroFlush()
     expect(modalTitleEl().textContent).toBe(zh.aiMcpSrvEditTitle)
     expect(modalNameInput().value).toBe('existing-one')
   })
+
+  // ===== 覆盖点 13(修复轮 M5,未申报偏离补正)=====
+  // Vue2 `closeModal()`(`:85`)是 `{ this.modalOpen = false; this.editing = null }`
+  // ——**任何**关闭路径都清 `editing`。本仓此前只在保存成功后调用的 `closeModal()`
+  // 里清,取消/X/遮罩三条关闭路径走 `v-model:open` 直接把 `modalOpen` 置 false,
+  // 不经过 `closeModal()`,`editing` 会残留旧值,传给 `McpServerModal` 的 `server`
+  // prop 也跟着残留——本次挪到 `watch(modalOpen)` 里统一清,钉住这条行为。
+  it('13. 编辑弹窗取消关闭(X 按钮,非保存路径)→ editing 清空,McpServerModal 的 server prop 变 null', async () => {
+    h.listMCPServers.mockResolvedValue([srv(1, { name: 'svc-a' })])
+    const w = mountSection()
+    await flush()
+
+    const detail = w.findComponent(McpServerDetail)
+    detail.vm.$emit('edit', srv(1, { name: 'svc-a' }))
+    await macroFlush()
+    const modal = w.findComponent(McpServerModal)
+    expect(modal.props('server')?.id).toBe(1)
+
+    modalCloseBtn().click() // 取消路径(X 按钮),不是保存
+    await flush()
+
+    expect(modal.props('server')).toBeNull()
+  })
 })
 
 // ============================================================================
 // 协调者追加的两条集成用例(T8 评审发现:McpServerModal 的 `watch(open)` true
 // 分支从 `props.server` 回填,依赖父组件同步设置 `server` + `open` 两个 prop 的
 // 时序——单组件测不到,必须在容器这里补集成用例)。
 // ============================================================================
 describe('McpSection — 弹窗常驻实例的表单残留回归', () => {
   it('编辑 A → 关闭 → 编辑 B:弹窗里名称是 B 的,不是 A 的残留', async () => {
     h.listMCPServers.mockResolvedValue([
diff --git a/src/ai/components/settings/sections/McpSection.vue b/src/ai/components/settings/sections/McpSection.vue
index a749595..ff26953 100644
--- a/src/ai/components/settings/sections/McpSection.vue
+++ b/src/ai/components/settings/sections/McpSection.vue
@@ -83,23 +83,38 @@ const toast = useToast()
 const servers = ref<McpServer[]>([])
 const loading = ref(true)
 const activeId = ref<number | null>(null)
 const query = ref('')
 
 const modalOpen = ref(false)
 const editing = ref<McpServer | null>(null)
 const saving = ref(false)
 const saveError = ref('')
 
-// 弹窗关闭时清掉行内错误(见文件头注释「偏离 D5」末段,照 SkillsSection.vue:126-128)。
+// 弹窗关闭时清掉行内错误(见文件头注释「偏离 D5」末段,照 SkillsSection.vue:126-128),
+// 并清掉 editing(修复轮 M5)。
+//
+// 【修复轮 M5,未申报偏离】Vue2 `closeModal()`(`:85`)是
+// `{ this.modalOpen = false; this.editing = null }`——**每一条关闭路径**都清
+// `editing`。本仓早前只在 `closeModal()`(见下方,onSave 成功后才调用)里清,
+// 取消 / 右上角 X / 遮罩三条关闭路径走的是 `v-model:open` 直接把 `modalOpen`
+// 置 false,不经过 `closeModal()`,`editing` 会残留旧值。虽然 `openCreate`/
+// `openEdit` 每次都会重新设置 `editing`,`McpServerModal` 的 `watch(open)`
+// true 分支也会用 `props.server` 回填,实测无可见后果——但这是一条未在任何
+// 报告里申报过的行为差异,按移植纪律「未申报的偏离本身就是缺陷」改正:把清
+// `editing` 挪到这个 watch 里,与清 `saveError` 同一处、覆盖全部关闭路径,
+// 和 Vue2 `closeModal()` 逐条路径都清的行为对齐。
 watch(modalOpen, (v) => {
-  if (!v) saveError.value = ''
+  if (!v) {
+    saveError.value = ''
+    editing.value = null
+  }
 })
 
 // 对齐 Vue2 `computed`(`:57-64`)。
 const filtered = computed(() => {
   const q = query.value.trim().toLowerCase()
   if (!q) return servers.value
   // Vue2 `:60` 只搜 name/url 两个字段,不搜 command——照抄(设计 §5.1)。
   return servers.value.filter(
     (s) => (s.name || '').toLowerCase().includes(q) || (s.url || '').toLowerCase().includes(q),
   )
diff --git a/src/ai/types/mcpServer.ts b/src/ai/types/mcpServer.ts
index 6d87963..700e3cb 100644
--- a/src/ai/types/mcpServer.ts
+++ b/src/ai/types/mcpServer.ts
@@ -44,21 +44,22 @@ export interface McpParsed {
   command: string
   /** 非 nil(`mcpparse.go:79-82` 显式兜底成 `[]string{}`)。 */
   args: string[]
   /** 非 nil map(`mcpparse.go:69` 初始化为 `map[string]string{}`)。 */
   env: Record<string, string>
   url: string
   suggested_name: string
 }
 
 /** 对齐 Python agent `test_server` 返回(`agent/mcp_client/client.py:432-461`),
- *  Go 侧 `mc.go:355` 用 `c.JSONBlob` 原样透传,`POST .../:id/test` 200 裸对象。
+ *  Go 侧 `mcp.go:355`(修复轮 M3:此前误打成 `mc.go:355`,少打一个 `p`)用
+ *  `c.JSONBlob` 原样透传,`POST .../:id/test` 200 裸对象。
  *  成功态只用 `ok/tool_count/tools`;失败态字段视 `error_key` 而定。 */
 export interface McpTestResult {
   ok: boolean
   tool_count?: number
   tools?: string[]
   /** 后端拼好的英文串(如 `"Connection failed: ..."`)——**本仓不上界面**,
    *  一律走 `error_key` 映射成 i18n 键(设计 §5.3 / D8)。 */
   error?: string
   /** 只有 4 个值:`probe_timeout`(`client.py:437`)· `connect_failed`
    *  (`:448`)· `list_timeout`(`:453`)· `list_failed`(`:456`)。 */
diff --git a/src/ai/util/mcpServerVisual.ts b/src/ai/util/mcpServerVisual.ts
index 9c060d8..d09e5b6 100644
--- a/src/ai/util/mcpServerVisual.ts
+++ b/src/ai/util/mcpServerVisual.ts
@@ -1,14 +1,16 @@
 // SP8-P4 Task 2 —— 1:1 移植自 Vue2 src/views/AI/MCP/mcpServerVisual.js(15 行)。
 // 哈希算法、色板顺序、取模逐字保留;色板与 SkillTile.vue 的 SKILL_COLOR_IDS
-// 完全相同(两边都映射到 tokens.scss:235-241 的 --grad-sk-* 七个渐变 token),
+// 完全相同(两边都映射到 tokens.scss:236-242 的 --grad-sk-* 七个渐变 token),
 // 故不新建色板、不新增 token。
+// 【修复轮 M3】此前误写成 `:235-241`(实测 `--grad-sk-blue` 在 :236、
+// `--grad-sk-slate` 在 :242,已 grep 复核修正)。
 //
 // 类型放宽到 unknown:Vue2 :7 是 `String(name || '')`,对 null/undefined/数字
 // 都做了兜底,这里保持同样的宽容度(列表数据来自后端,name 理论上必为 string,
 // 但兜底是 Vue2 既有行为,不收紧)。
 const PALETTE = ['blue', 'purple', 'pink', 'orange', 'green', 'teal', 'slate']
 
 /** Vue2 mcpServerVisual.js:4 —— 后端没有图标字段,全部 MCP 服务统一用这个字形。 */
 export const SERVER_GLYPH = 'drive'
 
 /** Vue2 mcpServerVisual.js:6-11 逐字移植。 */
diff --git a/src/ai/views/SettingsPage.placeholder.test.ts b/src/ai/views/SettingsPage.placeholder.test.ts
new file mode 100644
index 0000000..4f963d9
--- /dev/null
+++ b/src/ai/views/SettingsPage.placeholder.test.ts
@@ -0,0 +1,130 @@
+// SP8-P4 修复轮(终审 Important I2)—— 占位契约机制的行为覆盖。
+//
+// 背景:`DEFERRED_SECTIONS` 清空后,`SettingsPage.vue` 里两条分支再没有任何用例
+// 走到过:①`placeholderProps(id)` 的 `SECTION_COMPONENTS[id] === SectionPlaceholder`
+// 为真那条返回路径;②`onSelect()` 里 `if (DEFERRED_SECTIONS.includes(id))
+// toast.show(...)` 那条分支。`sections.test.ts` 的「DEFERRED_SECTIONS 机制仍在」
+// 只断言了常量本身是数组,不碰这两条分支的行为——终审 RED 探针 B 证实了这一点
+// (摘掉两条分支,src/ai 全域 85 文件/1403 例仍然全绿)。用户 2026-07-31 明示
+// 「反转不删」,意图是把机制留成将来可用的**能力**,不是留一段没人看着的代码。
+//
+// 【为什么单开一个文件,不塞进 SettingsPage.test.ts】
+// `SECTION_COMPONENTS`(SettingsPage.vue 内部字面量,不导出——SP8-P2b Task 14
+// 修复轮已裁定不为了可测性拆出额外 <script> 块扩张公开面)与 `DEFERRED_SECTIONS`
+// (sections.ts 导出)是两个独立机制,当前没有运行时自动联动:`SECTION_COMPONENTS`
+// 是写死的 id→组件字面量,不会因为 `DEFERRED_SECTIONS` 数组的内容而改变。
+// `SettingsPage.vue` 文件头注释写的「恢复占位行为」步骤,本就是「把映射改回
+// `SectionPlaceholder`、把 id 加回 `DEFERRED_SECTIONS`」两处手动改动一起做。
+// 要在不碰一行生产代码的前提下驱动这两条分支,必须同时模拟这两处改动——用
+// `vi.mock` 把 `McpSection.vue` 的导入重定向到 `SectionPlaceholder.vue` 本体
+// (两处 import 路径相对同一个测试文件目录解析到同一个绝对路径,模块单例相同,
+// 故 `SECTION_COMPONENTS.mcp === SectionPlaceholder` 的恒等判断为真),同时把
+// `sections.ts` 的 `DEFERRED_SECTIONS` 打成 `['mcp']`(其余导出用
+// `vi.importActual` 保留真实实现)。这两个 `vi.mock` 是文件级、会作用于本文件
+// 里的全部用例——所以单开一个文件,不影响 `SettingsPage.test.ts` 其余 46+ 条
+// 用例继续吃真实的 `McpSection` + 真实的空 `DEFERRED_SECTIONS`。
+//
+// RED→GREEN 证据见任务报告(.superpowers/sdd/p4-FINAL-fix-report.md §I2)。
+
+import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
+import { mount, flushPromises } from '@vue/test-utils'
+import { createPinia, setActivePinia, type Pinia } from 'pinia'
+import { createI18n } from 'vue-i18n'
+import { createRouter, createMemoryHistory, type Router } from 'vue-router'
+import zh from '../../i18n/zh_cn'
+
+// 与 SettingsPage.test.ts 同款保险:mock 掉 `@nimotech/nimoos-service`,防止本
+// 文件里意外未 stub 到的调用落到真实网络请求上(onMounted 的四个装载各自
+// try/catch 吞错,真落网不会让测试崩,只是拖慢/不确定)。
+const ai = vi.hoisted(() => ({
+  getServicesStatus: vi.fn(),
+  listModels: vi.fn(),
+  listProviders: vi.fn(),
+  getPolicy: vi.fn(),
+  listSkills: vi.fn(),
+  listMCPServers: vi.fn(),
+}))
+vi.mock('@nimotech/nimoos-service', () => ({ service: { ai } }))
+
+// 模拟「把 id 加回 DEFERRED_SECTIONS」这半步改动——其余导出(GROUPS/ALL_ITEMS/
+// VALID_SECTIONS/SPLIT_SECTIONS/groupOf)保持真实实现,只覆盖这一个常量。
+vi.mock('../components/settings/sections', async () => {
+  const actual = await vi.importActual<typeof import('../components/settings/sections')>(
+    '../components/settings/sections',
+  )
+  return { ...actual, DEFERRED_SECTIONS: ['mcp'] }
+})
+
+// 模拟「把 SECTION_COMPONENTS 里的映射改回 SectionPlaceholder」这半步改动——
+// 把 McpSection.vue 的导入重定向到 SectionPlaceholder.vue 本体(同一个模块
+// 单例),让 SettingsPage.vue 内部 `SECTION_COMPONENTS['mcp'] !== SectionPlaceholder`
+// 的恒等判断为假,从而触发 `placeholderProps()` 的有效返回分支。
+vi.mock('../components/settings/sections/McpSection.vue', async () => {
+  return await vi.importActual('../components/settings/SectionPlaceholder.vue')
+})
+
+import SettingsPage from './SettingsPage.vue'
+import { useSettingsStore } from '../stores/settingsStore'
+import { useToast } from '../../stores/toast'
+
+const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
+
+let pinia: Pinia
+
+async function mountPage(): Promise<{ w: ReturnType<typeof mount>; router: Router }> {
+  const router = createRouter({
+    history: createMemoryHistory(),
+    routes: [{ path: '/ai/settings', name: 'ai-settings', component: SettingsPage }],
+  })
+  await router.push('/ai/settings')
+  const w = mount(SettingsPage, { global: { plugins: [i18n, pinia, router] }, attachTo: document.body })
+  return { w, router }
+}
+
+function stubNetworkActions(store: ReturnType<typeof useSettingsStore>) {
+  vi.spyOn(store, 'loadServicesStatus').mockResolvedValue(undefined)
+  vi.spyOn(store, 'loadModels').mockResolvedValue(undefined)
+  vi.spyOn(store, 'loadProviders').mockResolvedValue(undefined)
+  vi.spyOn(store, 'loadPolicy').mockResolvedValue(undefined)
+}
+
+beforeEach(() => {
+  pinia = createPinia()
+  setActivePinia(pinia)
+  Object.values(ai).forEach((fn) => fn.mockReset())
+  document.body.innerHTML = ''
+})
+
+afterEach(() => {
+  document.body.innerHTML = ''
+})
+
+describe('SettingsPage — 占位契约机制仍是能力,不是死代码(I2)', () => {
+  it('mcp 被标记 deferred 时:渲染 SectionPlaceholder(正确 titleKey/bodyKey)且弹一条 deferred toast', async () => {
+    const store = useSettingsStore()
+    stubNetworkActions(store)
+    const { w } = await mountPage()
+    await flushPromises()
+
+    const toast = useToast()
+    const showSpy = vi.spyOn(toast, 'show')
+
+    const item = w.findAll('.set-nav-item').find((n) => n.text().includes('MCP 连接'))!
+    await item.trigger('click')
+    await flushPromises()
+
+    // ① placeholderProps() 的有效返回分支:渲染出 SectionPlaceholder——判别依据
+    // 与既有用例(SettingsPage.test.ts「SP8-P4 收口」)同款:页面文本含
+    // aiCfgPlaceholderBody,这段文案是占位面板独有的。
+    expect(w.text()).toContain(zh.aiCfgPlaceholderBody)
+    // titleKey 用来源分区自己的导航文案(sections.ts ALL_ITEMS 里 mcp 的
+    // labelKey 是 aiCfgMcpConnections,值「MCP 连接」)——不是空字符串兜底。
+    expect(w.find('.set-h1').text()).toBe(zh.aiCfgMcpConnections)
+    expect(w.find('.set-desc').text()).toBe(zh.aiCfgPlaceholderBody)
+
+    // ② onSelect() 的 deferred toast 分支。
+    expect(showSpy).toHaveBeenCalledWith(zh.aiCfgSectionDeferred, 3000)
+
+    w.unmount()
+  })
+})
diff --git a/src/ai/views/SettingsPage.vue b/src/ai/views/SettingsPage.vue
index 3dd352a..207036b 100644
--- a/src/ai/views/SettingsPage.vue
+++ b/src/ai/views/SettingsPage.vue
@@ -20,24 +20,25 @@
 
   D3(申报,见下方恢复循环上方的完整注释)—— Vue2 的下载恢复循环因为
   `createSettingsStore()` 每次新建而从未真正执行过;Pinia 单例下第一次有了
   意义。`&& !job._timer` 守卫逐字保留。
 
   【新增,非 Vue2 蓝本】
   - 顶栏「详情」原为 `<router-link to="/ai/knowledge">`(Settings.vue:22-24)。
     `/ai/knowledge` 要到 SP8-P5 才存在,`router.push` 到不存在的路由会落空白
     死页 —— 改成 `<button>` + info toast 占位,样式类名 `.set-detail-link`
     保持不变(视觉 1:1),仅交互目标变了。
-  - 选中 `mcp`(`DEFERRED_SECTIONS`)时弹一条 info toast —— Vue2 没有这个概念
-    (它本就是真组件),本仓这个分区的真实现要等 SP8-P4,这里只是本阶段的范围
-    提示,不是对 Vue2 行为的偏离。`skills` 已于 SP8-P3a 接入真组件
-    `SkillsSection`,不再弹这条 toast。
+  - `onSelect()` 里 `DEFERRED_SECTIONS.includes(id)` 时弹一条 info toast ——
+    Vue2 没有这个概念(它的 13 个分区本就全是真组件)。**修复轮 M2 更新**:
+    SP8-P4 起 `DEFERRED_SECTIONS` 已清空(13 个分区全部接入真组件),这条分支
+    现在**不会触发**,但机制本身保留(用户明示「反转不删」)供将来新增未完成
+    分区时复用——见下方 `SECTION_COMPONENTS` 注释与 `onSelect()` 处的说明。
 -->
 <script setup lang="ts">
 import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
 import type { Component } from 'vue'
 import { useRoute, useRouter } from 'vue-router'
 import { useI18n } from 'vue-i18n'
 import { useSettingsStore } from '../stores/settingsStore'
 import { useAiTheme } from '../stores/aiTheme'
 import { useToast } from '../../stores/toast'
 import SettingsRail from '../components/settings/SettingsRail.vue'
@@ -99,24 +100,28 @@ const SECTION_COMPONENTS: Record<SectionId, Component> = {
   memory: MemorySection, // SP8-P2b Task 6 —— 已实现,收官接线
   observability: ObservabilitySection, // SP8-P2b Task 8 —— 已实现,收官接线
   skills: SkillsSection, // SP8-P3a Task 7 —— 已实现,收官接线
   mcp: McpSection, // SP8-P4 Task 9 —— 已实现,收官接线(DEFERRED_SECTIONS 就此清空)
   mcptokens: McpTokensSection, // SP8-P2b Task 10 —— 已实现,收官接线
   channels: ChannelsSection, // SP8-P2b Task 12 —— 已实现,收官接线
 }
 
 // 非 Vue2 蓝本 —— SectionPlaceholder 需要 { titleKey, bodyKey } 两个 prop,而
 // Vue2 的 SECTION_COMPONENTS 只是纯 id→组件映射、渲染处不传任何 prop
-// (Settings.vue:40/45)。给非占位组件传这两个多余 prop 无害(已换上真组件的
-// 12 个分区里,这两个 prop 会变成未声明的 fallthrough attrs,不影响功能),
-// 占位场景(现仅 mcp)下用来源分区自己的导航文案(sections.ts 的
-// labelKey)作标题,统一的 `aiCfgPlaceholderBody` 作说明文字。
+// (Settings.vue:40/45)。给非占位组件传这两个多余 prop 无害(13 个分区目前
+// 全部是真组件,这两个 prop 会变成未声明的 fallthrough attrs,不影响功能)。
+// 【修复轮 M2 更新】SP8-P4 起 `SECTION_COMPONENTS` 里不再有任何一个映射到
+// `SectionPlaceholder`,这条函数的有效返回分支(`titleKey`/`bodyKey` 非空)
+// 现在**不会触发**——机制原样保留(用户明示「反转不删」):将来某个 id 的
+// `SECTION_COMPONENTS` 映射改回 `SectionPlaceholder` 时,直接复用来源分区
+// 自己的导航文案(`sections.ts` 的 `labelKey`)作标题,统一的
+// `aiCfgPlaceholderBody` 作说明文字。
 function placeholderProps(id: SectionId): Record<string, string> {
   if (SECTION_COMPONENTS[id] !== SectionPlaceholder) return {}
   const item = ALL_ITEMS.find((i) => i.id === id)
   return { titleKey: item ? item.labelKey : '', bodyKey: 'aiCfgPlaceholderBody' }
 }
 
 const store = useSettingsStore()
 const aiTheme = useAiTheme()
 const route = useRoute()
 const router = useRouter()
