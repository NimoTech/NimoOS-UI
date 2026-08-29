// Settings · Terminal & Logs -- system log text transformation and download URL.
// Vue2 counterpart: SettingsPanel.vue:1732 getTerminalLogs() and :1769 downloadSystemLog().
//
// Porting discipline (on record): Vue2 does `replaceData.substring(8, replaceData.length - 1)` --
//   **that trailing -1 also eats the last character of the whole log**, an off-by-one bug.
//   Here we only strip the leading 8 characters (stripping the date prefix, which is the
//   original intent and existing display behavior), leaving the tail untouched.

/** Strips the leading 8-character date prefix from each line: '2026-04-13T15:38' -> '13T15:38'. */
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

/** Downloading logs goes through /v2/nimoos/health/logs (returns NimoOS.zip).
 *  Auth: the Skipper in NimoOS/route/v2.go:77 recognizes the ?token= query parameter
 *  -- opening the link directly in a browser cannot carry an Authorization header,
 *  so this is the only way. */
export function downloadLogsUrl(token: string | null): string {
  const base = '/v2/nimoos/health/logs'
  return token ? `${base}?token=${encodeURIComponent(token)}` : base
}
