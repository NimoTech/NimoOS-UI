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

/** Lines put into the DOM at once.
 *
 *  `GET /v1/sys/logs` has no tail parameter -- `?line=` exists in the route but
 *  `NimoOS/service/system.go:1734` ignores it and `io.ReadAll`s the whole file, which
 *  on a 4-month-old device is 5 MB / 19943 lines (rotation caps it at 10 MB,
 *  `NimoOS-Common/utils/logger/log.go:24`). Rendering all of it into one <pre> was
 *  measured (headless Chrome, real payload, 1440x900) at 682-1180 ms of blocked main
 *  thread per 5-second refresh and +1162 MB of renderer memory; 1000 lines costs
 *  38-95 ms and +74 MB. Machines with less headroom cross Chrome's 5-second
 *  unresponsive-input threshold and pop the "page unresponsive" dialog on the next
 *  click. Same cap the app console already uses (`apps/console/useAppLogs.ts`). */
export const LOG_PAGE_SIZE = 1000

/** A single trailing newline terminates the last line rather than starting an empty
 *  one -- counting it would spend a page slot on a blank row and turn exactly 1000
 *  lines into "page 1 of 2". */
function splitLogLines(text: string): string[] {
  if (!text) return []
  return (text.endsWith('\n') ? text.slice(0, -1) : text).split('\n')
}

/** Total pages, never less than 1 (so the indicator can't read "page 1 of 0"). */
export function logPageCount(text: string, pageSize = LOG_PAGE_SIZE): number {
  return Math.max(1, Math.ceil(splitLogLines(text).length / pageSize))
}

/** Page 1 is the NEWEST `pageSize` lines; higher pages walk backwards through history.
 *
 *  Numbering runs from the tail, not from the start of the file, because the log only
 *  grows at the tail: tail-anchored numbering keeps "page 1 = what is happening now"
 *  stable, whereas start-anchored numbering would put April on page 1 and move the
 *  newest lines to a page number that changes on every refresh.
 *
 *  Out-of-range pages are clamped instead of returning empty, so a stale page number
 *  (e.g. the snapshot shrank) can never blank the card. */
export function logPage(text: string, page: number, pageSize = LOG_PAGE_SIZE): string {
  const lines = splitLogLines(text)
  const count = Math.max(1, Math.ceil(lines.length / pageSize))
  const clamped = Math.min(Math.max(1, Math.trunc(page) || 1), count)
  const end = lines.length - (clamped - 1) * pageSize
  return lines.slice(Math.max(0, end - pageSize), end).join('\n')
}

/** 下载日志走 /v2/nimoos/health/logs(返回 NimoOS.zip)。
 *  鉴权:NimoOS/route/v2.go:77 的 Skipper 认 ?token= 查询参数
 *  —— 浏览器直接开链接拿不到 Authorization 头,只能靠它。 */
export function downloadLogsUrl(token: string | null): string {
  const base = '/v2/nimoos/health/logs'
  return token ? `${base}?token=${encodeURIComponent(token)}` : base
}
