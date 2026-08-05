# SP8-P4 Task 7 任务书

**先读**(顺序不可换,本文件与它们冲突时以它们为准):
1. `.sp8/NimoOS-New-UI/.superpowers/sdd/p4-common-constraints.md` —— 公共约束,**你的行为准则**
2. `NimoOS-UI/docs/superpowers/specs/2026-07-31-vue3-migration-sp8-p4-mcp-design.md` —— 设计文档,**权威**
   (公共约束 > 本任务书;设计文档 > 本任务书。发现冲突立即在报告里申报,不要默默选一边。)

## Global Constraints(计划原文,逐字)

- **工作区**:只写 `/home/nimo/NimoTech/.sp8/NimoOS-New-UI`(分支 `sp8-ai`)。**本期 Service 仓与两个后端仓零改动。**
- **界面 / 视觉 / 交互严格 1:1 照 Vue2**(DOM 结构、class、文案、尺寸、动效、键位、**组件拆分**);**逻辑 / bug 不照抄**,偏离必须三件套齐全(代码注释注明 Vue2 `file:line` + 报告申报 + 台账登记)。**未申报的偏离本身就是缺陷。**
- **一切可见颜色必须 `var(--…)` token**,禁 `#hex` / `rgb()` / `rgba()` / 具名色(`white`/`black` 也算)。**内联 `:style` 里的颜色同样违规。** ⚠️ `color-guard.test.ts` **不扫 `.scss`**,Task 1 的配色无回归网。
- **单层取数**:共享包 `service.ai.*` 已 `return res.data`,消费端**不许再剥一层**。Vue2 的 `resp.data` 照抄即缺陷(设计 §3,本期命中 4 处)。
- **界面永不回显后端原文 / JSON**,一律走 i18n 键映射(先例 `util/channelsFormat.ts:65-76`)。
- **新 i18n 键双档同增**(`src/i18n/{zh_cn,en_us}.ts`),值逐字照本计划 Task 4 的表,**不许自行翻译、不许改标点**(含 `·` `…` `(` `)` 与中文逗号句号)。字面 `@` 写成 `{'@'}`。
- **import 一律相对路径**(本仓无 `@/` 别名先例)。
- **状态一律组件本地 `ref`**,不新建 store。
- **组件里零 `<style>` 块**;用到的每个 CSS 类先 `grep` 确认存在。
- **toast 真签名**:`show(text: string, duration = 1500, tier: 'info'|'warning'|'danger' = 'info')`(`src/stores/toast.ts:18-27`)。
- **每个任务跑全量三门**,输出完整落盘,**禁 `| tail`**。基线 **296 文件 / 2574 例绿 · tsc 0 · build 0**。
- 禁 `git add -A` / `git add .`,只显式列路径;禁 rebase / reset / stash / merge / **push**。一个任务 = 一个语义提交。

## File Structure(全期文件落点,供你定位自己的位置)

| 文件 | 责任 | 任务 |
|

---

## Task 7: 测试连接(D8 本地化 + 技术详情折叠 + D11 竞态守卫)

**Files:**
- Modify: `src/ai/components/settings/mcp/McpServerDetail.vue`(T6 创建)
- Modify: `src/ai/components/settings/mcp/McpServerDetail.test.ts`(T6 创建)

**Interfaces:**
- Consumes: `toTestView` / `toTestViewFromError`(T3)· `McpTestView`(T2)· `service.ai.testMCPServer`(共享包)
- Produces: 无对外新接口(组件内部状态)

**蓝本:** Vue2 `McpServerDetail.vue:50-53`(按钮)· `:87-100`(结果面板)· `:158-171`(`runTest`)。

- [ ] **Step 1: 写失败的测试(追加到 `McpServerDetail.test.ts`)**

```ts
// 文件顶部追加(与既有 mock 合并;骨架用 vi.hoisted 避免 ESM 提升的 TDZ)
const h = vi.hoisted(() => ({ testMCPServer: vi.fn() }))
vi.mock('@nimotech/nimoos-service', () => ({ service: { ai: h } }))
```

用例:

```ts
describe('测试连接', () => {
  beforeEach(() => { h.testMCPServer.mockReset() })

  it('点按钮进入 testing 态:按钮禁用、文案变「测试中…」、出现 spinner', async () => {
    let resolve!: (v: unknown) => void
    h.testMCPServer.mockReturnValue(new Promise((r) => { resolve = r }))
    const w = mountDetail(srv({ id: 5 }))
    await w.find('.mcp-test-btn').trigger('click')
    await nextTick()
    expect(w.find('.mcp-test-btn').attributes('disabled')).toBeDefined()
    expect(w.find('.mcp-test-btn').text()).toContain(zh.aiMcpSrvTesting)
    expect(w.find('.mcp-test-btn .sk-spinner').exists()).toBe(true)
    resolve({ ok: true, tool_count: 0, tools: [] })
    await flushPromises()
  })

  it('stdio 才显示 90 秒提示,http 不显示(两次挂载对照)', async () => {
    h.testMCPServer.mockReturnValue(new Promise(() => {}))
    const a = mountDetail(srv({ transport: 'stdio', command: 'npx' }))
    await a.find('.mcp-test-btn').trigger('click'); await nextTick()
    expect(a.find('.mcp-test-hint').exists()).toBe(true)
    const b = mountDetail(srv({ transport: 'http' }))
    await b.find('.mcp-test-btn').trigger('click'); await nextTick()
    expect(b.find('.mcp-test-hint').exists()).toBe(false)
  })

  // 单层取数的钉子:mock 是**裸对象**。若实现多剥一层 .data,这条会红。
  it('成功:单层取数,显示已连接 · N 个工具 + 工具 chip', async () => {
    h.testMCPServer.mockResolvedValue({ ok: true, tool_count: 2, tools: ['search', 'fetch'] })
    const w = mountDetail(srv({ id: 5 }))
    await w.find('.mcp-test-btn').trigger('click')
    await flushPromises()
    expect(h.testMCPServer).toHaveBeenCalledWith(5)
    expect(w.find('.mcp-test-result').attributes('data-ok')).toBe('true')
    expect(w.find('.mcp-test-line').text()).toContain('已连接 · 2 个工具')
    expect(w.findAll('.mcp-tool-chip').map((c) => c.text())).toEqual(['search', 'fetch'])
    expect(w.find('.mcp-test-detail').exists()).toBe(false)
  })

  it('失败:显示本地化文案,后端 error 英文串不出现在界面上', async () => {
    h.testMCPServer.mockResolvedValue({
      ok: false, error_key: 'connect_failed',
      error: 'Connection failed: All connection attempts failed',
      detail: 'All connection attempts failed',
    })
    const w = mountDetail(srv())
    await w.find('.mcp-test-btn').trigger('click')
    await flushPromises()
    expect(w.find('.mcp-test-result').attributes('data-ok')).toBe('false')
    expect(w.find('.mcp-test-line').text()).toContain(zh.aiMcpSrvTestErrConnect)
    expect(w.text()).not.toContain('Connection failed: All connection attempts failed')
  })

  it('detail 非空才渲染折叠区,且默认折叠(无 open 属性)', async () => {
    h.testMCPServer.mockResolvedValue({ ok: false, error_key: 'connect_failed', detail: 'ENOENT npx' })
    const w = mountDetail(srv())
    await w.find('.mcp-test-btn').trigger('click')
    await flushPromises()
    const d = w.find('.mcp-test-detail')
    expect(d.exists()).toBe(true)
    expect(d.attributes('open')).toBeUndefined()
    expect(d.find('summary').text()).toBe(zh.aiMcpSrvTestDetail)
    expect(d.find('pre').text()).toBe('ENOENT npx')
  })

  it('detail 为空时不渲染折叠区(对照)', async () => {
    h.testMCPServer.mockResolvedValue({ ok: false, error_key: 'probe_timeout' })
    const w = mountDetail(srv())
    await w.find('.mcp-test-btn').trigger('click')
    await flushPromises()
    expect(w.find('.mcp-test-line').text()).toContain(zh.aiMcpSrvTestErrTimeout)
    expect(w.find('.mcp-test-detail').exists()).toBe(false)
  })

  it('502 agent unreachable(抛错路径)→ 专用文案,不显示后端 body', async () => {
    h.testMCPServer.mockRejectedValue(
      Object.assign(new Error('x'), { response: { status: 502, data: { ok: false, error: 'agent unreachable' } } }),
    )
    const w = mountDetail(srv())
    await w.find('.mcp-test-btn').trigger('click')
    await flushPromises()
    expect(w.find('.mcp-test-line').text()).toContain(zh.aiMcpSrvTestErrAgentDown)
    expect(w.text()).not.toContain('agent unreachable')
  })

  it('testing 期间重复点击不重复发请求(Vue2 :159 的 if (!this.server || this.testing) return)', async () => {
    h.testMCPServer.mockReturnValue(new Promise(() => {}))
    const w = mountDetail(srv())
    await w.find('.mcp-test-btn').trigger('click')
    await w.find('.mcp-test-btn').trigger('click')
    await w.find('.mcp-test-btn').trigger('click')
    expect(h.testMCPServer).toHaveBeenCalledTimes(1)
  })

  it('切换服务器时清空 testing 与结果', async () => {
    h.testMCPServer.mockResolvedValue({ ok: true, tool_count: 1, tools: ['a'] })
    const w = mountDetail(srv({ id: 1 }))
    await w.find('.mcp-test-btn').trigger('click')
    await flushPromises()
    expect(w.find('.mcp-test-result').exists()).toBe(true)
    await w.setProps({ server: srv({ id: 2, name: 'other' }) })
    await nextTick()
    expect(w.find('.mcp-test-result').exists()).toBe(false)
  })

  // ★ D11 竞态守卫 —— 本任务的核心钉子。
  // 弱断言(只查「结果面板不存在」)在切换后本来就成立,抓不出竞态;必须让
  // 旧请求在切换**之后**才落地,再断言面板仍为空。
  it('D11:在途请求落地时若已切到别的服务器,结果被丢弃(不串台)', async () => {
    let resolveOld!: (v: unknown) => void
    h.testMCPServer.mockReturnValueOnce(new Promise((r) => { resolveOld = r }))
    const w = mountDetail(srv({ id: 1, name: 'old' }))
    await w.find('.mcp-test-btn').trigger('click')
    await nextTick()
    // 切到另一台服务器
    await w.setProps({ server: srv({ id: 2, name: 'new' }) })
    await nextTick()
    // 旧请求现在才落地,且是「成功」——若无守卫,会在新服务器面板上显示成功
    resolveOld({ ok: true, tool_count: 9, tools: ['leaked'] })
    await flushPromises()
    expect(w.find('.mcp-test-result').exists()).toBe(false)
    expect(w.text()).not.toContain('leaked')
    expect(w.find('.mcp-test-btn').text()).toContain(zh.aiMcpSrvTest) // 不卡在「测试中…」
  })

  it('D11 对照:未切换时结果正常落地(守卫不能把正常路径也挡掉)', async () => {
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
})
```

- [ ] **Step 2: 跑测试确认失败**

```bash
pnpm exec vitest run src/ai/components/settings/mcp/McpServerDetail.test.ts
```

预期:新增的「测试连接」整组红(按钮不存在)。

- [ ] **Step 3: 实现**

在 T6 的组件里加:

```ts
// 【偏离 D11】Vue2 runTest(McpServerDetail.vue:158-171)没有请求令牌:stdio
// 探测最长 100 秒(Go 侧 mcp.go:346),这期间用户切到别的服务器时 watch 已把
// testView 清空,但在途 promise 落地后仍会把**旧服务器的结果**写进**新服务器
// 的面板**——可复现的错配。这里用单调递增序号守卫,落地时序号不匹配就整个丢弃
// (包括不复位 testing,因为那已经是新一轮的状态)。
const reqSeq = ref(0)
const testing = ref(false)
const testView = ref<McpTestView | null>(null)

async function runTest() {
  if (!props.server || testing.value) return          // Vue2 :159 逐字对应
  const seq = ++reqSeq.value
  const id = props.server.id
  testing.value = true
  testView.value = null
  try {
    // 【偏离 D1】单层取数:共享包已 return res.data(NimoOS-Service/src/ai.ts:388-391),
    // 后端 mcp.go:355 是 c.JSONBlob 裸对象。Vue2 :164 的 `resp.data` 在本仓恒 undefined,
    // 会让「测试连接」**永远显示连接失败**,哪怕后端返回 ok:true。
    const body = await service.ai.testMCPServer(id)
    if (seq !== reqSeq.value) return
    testView.value = toTestView(body)
  } catch (e) {
    if (seq !== reqSeq.value) return
    testView.value = toTestViewFromError(e)
  } finally {
    if (seq === reqSeq.value) testing.value = false
  }
}
```

`watch(() => props.server?.id)` 里追加:`reqSeq.value++`(让在途请求作废)· `testing.value = false` · `testView.value = null`。

模板(照 Vue2 `:50-53` 与 `:87-100`,只改错误呈现):

```html
<button class="sk-btn ghost mcp-test-btn" :disabled="testing" @click="runTest">
  <span v-if="testing" class="sk-spinner" />
  {{ testing ? t('aiMcpSrvTesting') : t('aiMcpSrvTest') }}
</button>
…
<div v-if="testing && server.transport === 'stdio'" class="mcp-test-hint">
  {{ t('aiMcpSrvTestStdioHint') }}
</div>
<div v-if="testView" class="mcp-test-result" :data-ok="testView.ok ? 'true' : 'false'">
  <template v-if="testView.ok">
    <div class="mcp-test-line">✓ {{ t('aiMcpSrvTestOk', { n: testView.toolCount }) }}</div>
    <div class="mcp-test-tools">
      <span v-for="tool in testView.tools" :key="tool" class="mcp-tool-chip">{{ tool }}</span>
    </div>
  </template>
  <template v-else>
    <div class="mcp-test-line">✗ {{ t(testView.msgKey) }}</div>
    <!-- 【偏离 D8】Vue2 :98 直接显示后端拼好的英文 error 串。改成 error_key 映射的
         本地化一句话 + 默认折叠的技术详情(用户 2026-07-31 拍板)。detail 为空时
         整个折叠区不渲染。 -->
    <details v-if="testView.detail" class="mcp-test-detail">
      <summary>{{ t('aiMcpSrvTestDetail') }}</summary>
      <pre>{{ testView.detail }}</pre>
    </details>
  </template>
</div>
```

`✓` / `✗` 是 Vue2 `:92,98` 的原文字符,照抄(它们是字符不是颜色)。

- [ ] **Step 4: 跑测试确认通过**

```bash
pnpm exec vitest run src/ai/components/settings/mcp/McpServerDetail.test.ts
```

- [ ] **Step 5: RED 探针(必做两次,各贴两段输出)**

1. **D11 守卫**:把 `if (seq !== reqSeq.value) return`(成功分支那条)删掉 → 确认「D11:在途请求落地时…结果被丢弃」精确报红 → 还原。
2. **单层取数**:把 `toTestView(body)` 改成 `toTestView((body as any).data)` → 确认「成功:单层取数…」报红 → 还原。

两次都要 `git status` 确认干净。

- [ ] **Step 6: 跑全量三门**

日志名 `p4-t7-*`。**本任务不新增 `.vue`(改的是 T6 建的那个)→ color-guard 用例数不变。**

- [ ] **Step 7: Commit**

```bash
git add src/ai/components/settings/mcp/McpServerDetail.vue src/ai/components/settings/mcp/McpServerDetail.test.ts
git commit -m "feat(ai): SP8-P4 T7 测试连接(本地化错误+技术详情折叠+在途竞态守卫)"
```
