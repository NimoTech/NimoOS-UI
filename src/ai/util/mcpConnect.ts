// SP8-P2b Task 9 — 1:1 taken from Vue2 src/views/AI/Settings/sections/McpTokensSection.vue
// endpointUrl computed(:138-141) and buildInstruction/buildJson/fmtCreated/
// fmtLastUsed four methods(:157-166, :209-216).
//
// Reason for extracting to pure functions: Vue2 has tests using `M.buildJson.call(ctx, token)` to
// directly call methods via this; <script setup> has no methods object to borrow; without extracting
// those assertions (endpointUrl uses window origin / buildInstruction inlines … / buildJson is valid
// MCP config JSON / fmtCreated no x1000 / fmtLastUsed falsy handling) they can only degrade to
// "check textarea text after mount", reducing discriminative power.
//
// i18n stays at component layer (Task 10): the template strings of buildMcpInstruction, the
// translation prefixes 'Created'/'Last used'/'Never used' in fmtCreated/fmtLastUsed do not enter
// this pure function module — here we only preserve the core logic shared by Vue2 fmtCreated/
// fmtLastUsed: "format by milliseconds, provide fallback for empty" with a unified fallback of '-'
// (aligned with Vue2 fmtCreated empty fallback); the Task 10 component switches to $t('Never used')
// text when last_used_at is empty, not affecting this pure function's responsibility.
export const MCP_PLACEHOLDER_TOKEN = '<YOUR_TOKEN>'

const MCP_PATH = '/v1/ai/mcp-rpc/'

/** Align with Vue2 McpTokensSection.vue:138 endpointUrl computed. */
export function mcpEndpointUrl(origin?: string): string {
  const o = origin ?? (typeof window !== 'undefined' ? window.location?.origin : '') ?? ''
  return o + MCP_PATH
}

/** Align with Vue2 McpTokensSection.vue:157 buildInstruction. */
export function buildMcpInstruction(template: string, endpointUrl: string, token: string): string {
  // Vue2 uses .split(x).join(y) instead of .replace(x, y) — because replace only changes the
  // first occurrence, and {url} indeed appears more than once in the template, so we keep this
  // approach.
  return template.split('{url}').join(endpointUrl).split('{token}').join(token)
}

/** Align with Vue2 McpTokensSection.vue:162 buildJson. */
export function buildMcpJson(endpointUrl: string, token: string): string {
  return JSON.stringify(
    { mcpServers: { nimoos: { url: endpointUrl, headers: { Authorization: `Bearer ${token}` } } } },
    null,
    2,
  )
}

/** Align with Vue2 McpTokensSection.vue:209/213 shared time formatting core of fmtCreated/fmtLastUsed. */
export function formatEpochMs(ms: number | undefined | null): string {
  // Vue2 :211/215 — created_at / last_used_at backend provides is in **milliseconds**, don't multiply
  // by 1000.
  return ms ? new Date(ms).toLocaleString() : '-'
}
