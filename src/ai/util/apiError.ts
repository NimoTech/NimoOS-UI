// SP8-P2b Task 4 —— 后端错误消息提取。
//
// Vue2 的 7 个设置分区里各自手写同一段兜底链(例:BlacklistSection.vue:80-84、
// McpTokensSection.vue:186、ChannelsSection.vue:210),本期收成一处。取值顺序与
// 优先级与 Vue2 逐条对齐:response.data.message → response.data(字符串直用/
// 对象 JSON 序列化) → error.message → 调用方给的兜底文案。
//
// 只服务本期新写的 6 个分区。**不回头改 New-UI 既有的 5 处内联写法**
// (AgentComposer.vue / GoogleDriveAuthDialog.vue / NetworkStorageDialog.vue /
// files/stores/shares.ts / apps/composables/useInstallFlow.ts)——那属无关重构。
export function apiErrorMessage(e: unknown, fallback: string): string {
  const data = (e as { response?: { data?: unknown } } | null | undefined)?.response?.data

  if (data && typeof data === 'object') {
    const msg = (data as { message?: unknown }).message
    if (typeof msg === 'string' && msg) return msg
    return JSON.stringify(data)
  }
  if (typeof data === 'string' && data) return data

  const m = (e as { message?: unknown } | null | undefined)?.message
  if (typeof m === 'string' && m) return m

  return fallback
}
