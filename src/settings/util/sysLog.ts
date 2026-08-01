// 设置 · 终端与日志 —— 系统日志文本变换与下载 URL。
// Vue2 对位:SettingsPanel.vue:1732 getTerminalLogs() 与 :1769 downloadSystemLog()。
//
// 移植纪律(登记):Vue2 是 `replaceData.substring(8, replaceData.length - 1)` ——
//   **末尾那个 -1 把整块日志的最后一个字符也吃掉了**,是 off-by-one。这里只去开头 8 个字符
//   (去日期前缀,是它的本意与既有显示形态),尾部原样保留。

/** 去掉每行开头 8 个字符的日期前缀:'2026-04-13T15:38' → '13T15:38'。 */
export function formatSysLog(raw: string): string {
  if (!raw || raw.length < 10) return raw || ''
  const stripped = raw.replace(/\n(.{8})/gu, '\n')
  return stripped.length > 8 ? stripped.substring(8) : stripped
}

/** 下载日志走 /v2/nimoos/health/logs(返回 NimoOS.zip)。
 *  鉴权:NimoOS/route/v2.go:77 的 Skipper 认 ?token= 查询参数
 *  —— 浏览器直接开链接拿不到 Authorization 头,只能靠它。 */
export function downloadLogsUrl(token: string | null): string {
  const base = '/v2/nimoos/health/logs'
  return token ? `${base}?token=${encodeURIComponent(token)}` : base
}
