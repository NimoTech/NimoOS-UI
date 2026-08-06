## Task 10: `McpTokensSection`（对外 MCP 服务）

**Files:**
- Create: `src/ai/components/settings/sections/McpTokensSection.vue`
- Create: `src/ai/components/settings/sections/McpTokensSection.test.ts`
- Modify: `src/ai/views/SettingsPage.vue`（映射表 `mcptokens` 项 + import）
- Modify: `src/i18n/zh_cn.ts`、`src/i18n/en_us.ts`

**Interfaces:**
- Consumes: Task 9 的五个导出；Task 3 的 `SkModal`；`PromptDialog`（P2a Task 6 建的，`src/components/ui/PromptDialog.vue`）；`AlertDialog`；`service.ai.listMCPTokens()` / `createMCPToken({label})` / `deleteMCPToken(id)`；`copyText`
- Produces: 组件 `McpTokensSection`

**Vue2 蓝本：** `sections/McpTokensSection.vue`（247 行）+ **既有测试 `sections/__tests__/McpTokensSection.spec.js`（11 例）** —— 其中 6 条纯函数用例已在 Task 9 承接，本任务承接剩下 5 条（`load` 三条 + `createToken` + `doDelete` + `onRevealClosed`，共 5 条）。

### i18n（本任务新增 17 键）

| 新键名 | Vue2 key | zh_cn 值（逐字） | en_us 值（逐字） |
|---|---|---|---|
| `aiCfgMcpTokens` **复用** | `Expose as MCP server` | 对外 MCP 服务 | Expose as MCP server |
| `aiCfgMcpTokensDesc` | `mcpTokensDesc` | 外部 AI Agent 通过 MCP 连接本 NAS 时所用的长期令牌。令牌仅授予只读工具,可随时吊销。 | Long-lived tokens external AI agents use to connect to this NAS over MCP. Tokens grant read-only tools and can be revoked anytime. |
| `aiCfgMcpEndpoint` | `MCP endpoint` | MCP 端点 | MCP endpoint |
| `aiCfgMcpEndpointUrl` | `MCP endpoint URL` | MCP 端点 URL | MCP endpoint URL |
| `aiCfgMcpEndpointBanner` | `Use it as the MCP server URL; …` | 把它作为 MCP 客户端的服务器 URL,令牌放在 Authorization: Bearer 请求头里。提供搜索 / 读文档 / Wiki / 相册等只读工具。 | Use it as the MCP server URL; put the token in the Authorization: Bearer header. Provides read-only search / read-document / Wiki / photos tools. |
| `aiCfgConnectAnAgent` | `Connect an AI agent` | 接入 AI Agent | Connect an AI agent |
| `aiCfgGiveThisToAgent` | `Give this to another AI agent to add this NAS as an MCP server:` | 把下面这段交给别的 AI Agent，它就能把本 NAS 加为 MCP 服务器： | Give this to another AI agent to add this NAS as an MCP server: |
| `aiCfgOrPasteIntoConfig` | `Or paste this into its MCP config file:` | 或把下面的配置粘贴到它的 MCP 配置文件： | Or paste this into its MCP config file: |
| `aiCfgMcpInstructionTemplate` | `mcpAgentInstructionTemplate` | 你将获得一台 NimoOS 个人云 MCP 服务器的访问权限。请使用 Streamable HTTP 传输方式，把它添加为一个 MCP server。\n\n端点 URL：{url}\n鉴权：发送 HTTP 请求头  Authorization: Bearer {token}\n\n它提供只读工具：搜索文件、读取文档、查看文档页、浏览 Wiki、搜索相册。添加完成后，请调用 tools/list 确认连接。 | You are being given access to a NimoOS personal-cloud MCP server. Please add it as an MCP server using the Streamable HTTP transport.\n\nEndpoint URL: {url}\nAuth: send the HTTP header  Authorization: Bearer {token}\n\nIt exposes read-only tools: search files, read documents, view document pages, browse the Wiki, and search photos. After adding it, call tools/list to confirm the connection. |
| `aiCfgTokens` | `Tokens` | 令牌 | Tokens |
| `aiCfgCreateToken` | `Create token` | 创建令牌 | Create token |
| `aiCfgLoadingDots` | `Loading...` | 加载中... | Loading... |
| `aiCfgLoadFailed` | `Failed to load.` | 加载失败。 | Failed to load. |
| `aiCfgNoTokensYet` | `No tokens yet. Create one to let external AI agents connect.` | 还没有令牌。创建一个,让外部 AI agent 能连接你的 NAS。 | No tokens yet. Create one to let external AI agents connect. |
| `aiCfgNoLabel` | `(no label)` | (无标签) | (no label) |
| `aiCfgCreatedAt` | `Created` | 创建于 | Created |
| `aiCfgLastUsed` | `Last used` | 最近使用 | Last used |
| `aiCfgNeverUsed` | `Never used` | 从未使用 | Never used |
| `aiCfgTokenCreated` | `Token created` | 令牌已创建 | Token created |
| `aiCfgTokenShownOnce` | `This token is shown only once. …` | 此令牌只显示这一次,请立即复制保存;关闭后将无法再查看。 | This token is shown only once. Copy and save it now — you will not be able to see it again. |
| `aiCfgTokenLabelPrompt` | `Label (e.g. "Claude on laptop")` | 标签(如「笔记本上的 Claude」) | Label (e.g. "Claude on laptop") |
| `aiCfgTokenLabel` | `Label` | 标签 | Label |
| `aiCfgCreateFailed` | `Create failed` | 创建失败 | Create failed |
| `aiCfgDeleteFailed` | `Delete failed` | 删除失败 | Delete failed |
| `aiCfgDeleteTokenConfirm` | `Are you sure you want to delete this token?` | 确定要删除此令牌吗? | Are you sure you want to delete this token? |

⚠️ **`aiCfgLoadingDots`（加载中**...**，三个半角点）与 Task 6 的 `aiCfgLoadingEllipsis`（加载中**…**，单个省略号字符）是两个不同的键** —— Vue2 里 `McpTokensSection`/`ChannelsSection` 用 `'Loading...'`、`MemorySection` 用 `'Loading…'`，中文值也分别是「加载中...」与「加载中…」。**照抄，不要统一**（统一属于未申报的界面改动）。

复用键：`aiCopy` · `aiCopied` · `aiCfgCopyFailed`（Task 7 引入）· `aiDone` · `aiCancel` · `aiCfgDelete`。

- [ ] **Step 1: 写测试（承接 Vue2 5 条 + 新增 11 条）**

| # | Vue2 用例 | 移植后怎么驱动 | 断言（不变） |
|---|---|---|---|
| 1 | `load() fills tokens from res.data.tokens` | 挂载 | 渲染 1 行 `.tok-row`、标签是 `laptop`、无错误文案 |
| 2 | `load() defaults to [] when tokens key is absent` | mock 返回 `{data:{}}` | 渲染空态文案，零 `.tok-row` |
| 3 | `load() sets error on failure` | reject | 渲染「加载失败。」 |
| 4 | `createToken() reveals plaintext once and never stores it in the list` | 点「创建令牌」→ PromptDialog 输入 `x` → 确认 | `createMCPToken({label:'x'})` 被调、明文弹窗出现且含 `nimoos_mcp_secret`、**`listMCPTokens` 在此刻未被二次调用**、列表 DOM 里不含明文（三条否定/隔离断言全保留） |
| 5 | `doDelete() calls API and removes the row` | 点某行删除 → 确认框「确定」 | `deleteMCPToken('a')` 被调、该行消失、另一行还在 |
| 6 | `onRevealClosed() clears plaintext and relists` | 关闭明文弹窗 | 弹窗消失、明文不再出现在 DOM、`listMCPTokens` 被再调一次、新列表渲染 |

新增 11 条：

7. 端点 URL 只读输入框显示 `mcpEndpointUrl()` 的值，且 `readonly`。
8. 端点「复制」按钮 → `copyText(endpointUrl)` + 「已复制」toast。
9. 常驻的两个接入说明框用的是**占位令牌** `<YOUR_TOKEN>`（不是真令牌）—— 断言 textarea 文本含 `<YOUR_TOKEN>`。
10. 两个常驻框各自的复制按钮分别复制「说明文本」与「配置 JSON」（断言 `copyText` 收到的字符串分别以模板开头 / 是合法 JSON）。
11. `copyText` reject → warning toast「复制失败,请手动选择」（Vue2 有这条兜底，本仓复用 `copyText` 后行为一致）。
12. 令牌行的元信息渲染：`created_at` → 「创建于: <本地时间>」；`last_used_at` 为 null → 「从未使用」且带 `.never` 类；有值 → 「最近使用: <本地时间>」（三条断言一个用例）。
13. `label` 为空 → 显示「(无标签)」。
14. 令牌数量渲染在 `.sk-section-hint`。
15. 创建令牌时 PromptDialog 点取消 → `createMCPToken` 不被调。
16. PromptDialog 输入前后有空格 → 传给接口的 label 被 trim（Vue2 `(value || '').trim()`）。
17. 创建失败 → danger toast 用后端 message，兜底「创建失败」；删除失败 → danger toast 兜底「删除失败」（两条断言一个用例）。

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test src/ai/components/settings/sections/McpTokensSection.test.ts`
Expected: FAIL —— 组件不存在。

- [ ] **Step 3: 加 i18n 键 + 实现组件**

关键逻辑：

```ts
interface McpToken { id: string | number; label?: string; created_at?: number; last_used_at?: number | null }

const tokens = ref<McpToken[]>([])
const loading = ref(false)
const error = ref(false)
const revealedToken = ref('')
const showReveal = ref(false)
const promptOpen = ref(false)
const confirmDeleteOpen = ref(false)
const pendingDeleteId = ref<string | number | null>(null)

const endpointUrl = computed(() => mcpEndpointUrl())
const instructionTemplate = computed(() => t('aiCfgMcpInstructionTemplate'))

// Vue2 是 created() 里 load(),本仓用 onMounted —— 两者对本组件等价(无 SSR、
// 不依赖挂载前时序),且与其余 6 个分区写法统一。
onMounted(() => { void load() })

async function load() {
  loading.value = true
  error.value = false
  try {
    const res = (await service.ai.listMCPTokens()) as { data?: { tokens?: McpToken[] } }
    tokens.value = res?.data?.tokens || []      // Vue2 :180 三重兜底,照搬
  } catch {
    error.value = true
  } finally {
    loading.value = false
  }
}

async function createToken(label: string) {
  try {
    const res = (await service.ai.createMCPToken({ label })) as { data?: { token?: string } }
    revealedToken.value = res?.data?.token || ''
    showReveal.value = true
  } catch (e) {
    toast.show(apiErrorMessage(e, t('aiCfgCreateFailed')), 3000, 'danger')
  }
}

async function doDelete(id: string | number) {
  try {
    await service.ai.deleteMCPToken(id)
    tokens.value = tokens.value.filter((x) => x.id !== id)
  } catch (e) {
    toast.show(apiErrorMessage(e, t('aiCfgDeleteFailed')), 3000, 'danger')
  }
}

// 明文弹窗关闭时:先清明文、再重新拉列表(Vue2 :207-211 同序)。
// 清明文必须在 await 之前 —— 否则请求在途这段时间明文还留在内存/DOM 里。
async function onRevealClose() {
  showReveal.value = false
  revealedToken.value = ''
  await load()
}

function fmtCreated(tk: McpToken) { return `${t('aiCfgCreatedAt')}: ${formatEpochMs(tk.created_at)}` }
function fmtLastUsed(tk: McpToken) {
  return tk.last_used_at ? `${t('aiCfgLastUsed')}: ${formatEpochMs(tk.last_used_at)}` : t('aiCfgNeverUsed')
}

async function copy(text: string) {
  try { await copyText(text); toast.show(t('aiCopied')) }
  catch { toast.show(t('aiCfgCopyFailed'), 3000, 'warning') }
}
```

模板：三个 `.sk-section`（端点 / 接入说明 / 令牌列表）+ 一个 `SkModal`（明文展示）+ `PromptDialog`（创建标签）+ `AlertDialog`（删除确认）。结构照 Vue2 `:2-120` 逐行搬，`.sk-modal-*` 那三层 div 换成 `<SkModal v-model:open="showReveal" :title="t('aiCfgTokenCreated')">` + `<template #footer>` 里一个「完成」按钮（点它走 `onRevealClose`）。

⚠️ **`SkModal` 的 `update:open` 也要接 `onRevealClose`**（点遮罩 / 按 Esc / 点右上 × 三条路径都会发它），否则从这三条路径关闭时明文不清、列表不刷新 —— Vue2 的 `@click.self="closeReveal"` 与 × 都走同一个 `closeReveal`，语义一致。写法：`@update:open="(v) => { if (!v) void onRevealClose() }"`。

⚠️ **PromptDialog 的 props**（P2a Task 6 定的）：`open` / `title` / `message` / `placeholder` / `confirmText` / `cancelText` / `initialValue`，emit `confirm(value: string)` 与 `update:open`。这里 `message` 用 `aiCfgTokenLabelPrompt`、`placeholder` 用 `aiCfgTokenLabel`。**Vue2 的 `inputAttrs.maxlength = 64` 在 PromptDialog 里没有对应 prop** —— 本期不给 PromptDialog 加 prop（会动 P2a 的共享原语），改为在 `createToken` 里 `label.slice(0, 64)` 并注释申报；这是行为等价的降级（用户能多打但存不进去多的），若评审认为必须 1:1，改法是给 PromptDialog 加可选 `maxlength` prop，属扩权，需在报告里请示。

- [ ] **Step 4: 跑测试确认通过（17 例）+ 接映射表 + 全量测试门 + 提交**

```bash
pnpm test src/ai/components/settings/sections/McpTokensSection.test.ts
pnpm test && pnpm exec vue-tsc --noEmit && pnpm build
git add src/ai/components/settings/sections/McpTokensSection.vue \
        src/ai/components/settings/sections/McpTokensSection.test.ts \
        src/ai/views/SettingsPage.vue src/ai/views/SettingsPage.test.ts \
        src/i18n/zh_cn.ts src/i18n/en_us.ts
git commit -m "SP8-P2b Task 10: McpTokensSection(对外 MCP 服务,承接 Vue2 5 例)"
git show --stat HEAD && git status
```

---

