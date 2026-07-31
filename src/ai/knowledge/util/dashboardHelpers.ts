// SP8-P5a Task 9 —— 1:1 移植自 Vue2
// `NimoOS-UI` (main@7a6ee6b7) `src/views/AI/Knowledge/dashboardHelpers.js`。
//
// 蓝本该文件共 4 个纯函数(`updatePeak`/`progressPercent`/`summarizeNotes`/
// `fmtEta`),本任务全部搬入,供 T7(`loadNotesSummary` 消费 `summarizeNotes`)
// 与 T12(`DashboardView` 消费 `progressPercent`/`fmtEta`/`updatePeak`)使用。

// dashboardHelpers.js:1-5 —— Progress math for the parsing backlog (spec §4.8).
// The percent is an honest UI-local measure: peak is the rolling max backlog
// seen this page session (updatePeak BEFORE progressPercent each poll), so
// the bar can recede when new files arrive — semantically correct, never
// negative.

/** dashboardHelpers.js:7-9 */
export function updatePeak(peak: number, backlog: number): number {
  return Math.max(peak || 0, backlog || 0)
}

/** dashboardHelpers.js:11-15 */
export function progressPercent(backlog: number, peak: number): number {
  if (!peak || peak <= 0) return 0
  const pct = Math.round((1 - backlog / peak) * 100)
  return Math.min(100, Math.max(0, pct))
}

/* dashboardHelpers.js:17-20 —— Status roll-up for the Dashboard's Notes layer
 * card. Input is the normalized notes list (service/notes.js); unknown
 * statuses only count toward the total so the distribution bar never
 * over-reports. */
export function summarizeNotes(
  notes: { status?: string }[] | undefined | null,
): { total: number; draft: number; curated: number; archived: number } {
  const s = { total: 0, draft: 0, curated: 0, archived: 0 }
  for (const n of notes || []) {
    if (!n) continue
    s.total++
    if (n.status === 'draft') s.draft++
    else if (n.status === 'curated') s.curated++
    else if (n.status === 'archived') s.archived++
  }
  return s
}

// dashboardHelpers.js:29-34 —— `'<1m'`/`'{m}m'`/`'{h}h {m}m'` 是英文缩写
// 字面量,蓝本没有走 i18n(不是分钟/小时的中文单位,是终端式的紧凑记号),
// 本移植照抄,不接入 i18n —— 接入会改变蓝本约定的界面文案,属未授权偏离
// (brief 硬约束显式点名此条)。
export function fmtEta(etaS: number | null | undefined): string {
  if (etaS == null || etaS <= 0) return ''
  if (etaS < 60) return '<1m'
  const m = Math.floor(etaS / 60)
  if (m < 60) return `${m}m`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}
