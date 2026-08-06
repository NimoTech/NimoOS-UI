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
// 【SP8-P2b 验收第 3 轮改动,用户 2026-07-30 拍板】原实现有两处问题,一起修:
//   ① 只认 Go 服务的 `message`。Python agent(`:8282`,FastAPI)把错误放在 **`detail`**,
//      于是 detail 全部掉进下面那条「对象就 JSON.stringify」兜底。
//   ② 那条 JSON.stringify 兜底(承自 Vue2 BlacklistSection.vue:82)会把整个响应体糊到
//      界面上 —— 用户在 Channels 添加机器人失败时看到的正是 `{"detail":"bot token rejected"}`。
// 故:补 `detail` 提取,并**删掉 JSON.stringify**(认不出就继续往下走,最终落调用方的
// 本地化兜底文案)。有意偏离 Vue2,已在 apiError.test.ts 与台账登记。
// 注意:本函数返回的仍可能是**后端英文原文**(如 FastAPI 的 detail)。要保证界面全本地化的
// 调用点,应改用「后端串 → i18n 键」的映射(先例:channelsFormat.ts 的 addBotErrorKey),
// 不要直接把本函数的返回值当成面向用户的最终文案。
export function apiErrorMessage(e: unknown, fallback: string): string {
  const data = (e as { response?: { data?: unknown } } | null | undefined)?.response?.data

  if (data && typeof data === 'object') {
    const msg = (data as { message?: unknown }).message
    if (typeof msg === 'string' && msg) return msg
    const detail = (data as { detail?: unknown }).detail
    if (typeof detail === 'string' && detail) return detail
    // 认不出的对象:**不**序列化回显,继续往下走
  }
  if (typeof data === 'string' && data) return data

  const m = (e as { message?: unknown } | null | undefined)?.message
  if (typeof m === 'string' && m) return m

  return fallback
}
