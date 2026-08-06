// SP8-P2b Task 9 —— 1:1 取自 Vue2 src/views/AI/Settings/sections/McpTokensSection.vue
// 的 endpointUrl computed(:138-141)与 buildInstruction/buildJson/fmtCreated/
// fmtLastUsed 四个 methods(:157-166、:209-216)。
//
// 抽成纯函数的理由:Vue2 既有测试用 `M.buildJson.call(ctx, token)` 借 this 直调
// methods,<script setup> 没有 methods 对象可借;不抽出来那几条断言(endpointUrl uses
// window origin / buildInstruction inlines … / buildJson is valid MCP config JSON /
// fmtCreated no x1000 / fmtLastUsed falsy handling)只能降级成「挂载后查 textarea 文本」,
// 判别力变弱。
//
// i18n 留在组件层(Task 10):buildMcpInstruction 的模板串、fmtCreated/fmtLastUsed 里
// 'Created'/'Last used'/'Never used' 的翻译前缀都不进这个纯函数模块 —— 这里只保留
// Vue2 fmtCreated/fmtLastUsed 共享的「按毫秒格式化,空值给兜底串」核心逻辑,兜底串统一
// 成 '-'(对齐 Vue2 fmtCreated 的空值兜底);Task 10 的组件在 last_used_at 为空时自行
// 换成 $t('Never used') 文案,不影响这里的纯函数职责。
export const MCP_PLACEHOLDER_TOKEN = '<YOUR_TOKEN>'

const MCP_PATH = '/v1/ai/mcp-rpc/'

/** 对齐 Vue2 McpTokensSection.vue:138 endpointUrl computed。 */
export function mcpEndpointUrl(origin?: string): string {
  const o = origin ?? (typeof window !== 'undefined' ? window.location?.origin : '') ?? ''
  return o + MCP_PATH
}

/** 对齐 Vue2 McpTokensSection.vue:157 buildInstruction。 */
export function buildMcpInstruction(template: string, endpointUrl: string, token: string): string {
  // Vue2 用 .split(x).join(y) 而不是 .replace(x, y) —— 因为 replace 只换第一处,
  // 模板里 {url} 确实出现不止一次,照搬这个写法。
  return template.split('{url}').join(endpointUrl).split('{token}').join(token)
}

/** 对齐 Vue2 McpTokensSection.vue:162 buildJson。 */
export function buildMcpJson(endpointUrl: string, token: string): string {
  return JSON.stringify(
    { mcpServers: { nimoos: { url: endpointUrl, headers: { Authorization: `Bearer ${token}` } } } },
    null,
    2,
  )
}

/** 对齐 Vue2 McpTokensSection.vue:209/213 fmtCreated/fmtLastUsed 共享的时间格式化核心。 */
export function formatEpochMs(ms: number | undefined | null): string {
  // Vue2 :211/215 —— created_at / last_used_at 后端给的是**毫秒**,不要再 ×1000。
  return ms ? new Date(ms).toLocaleString() : '-'
}
