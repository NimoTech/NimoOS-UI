// SP8-P5a Task 9 —— 1:1 ported from Vue2
// the Vue 2 panel's `src/views/AI/Knowledge/dashboardHelpers.js` (main@7a6ee6b7).
//
// Original file has 4 pure functions (`updatePeak`/`progressPercent`/`summarizeNotes`/
// `fmtEta`), all ported here, for T7 (`loadNotesSummary` consumes `summarizeNotes`)
// and T12 (`DashboardView` consumes `progressPercent`/`fmtEta`).
//
// 【Final Review Minor, 2026-08-01 note】 `updatePeak` is already dead code in original ——
// `git grep updatePeak main -- src/views/AI/Knowledge` shows original repo only has this
// definition + its own test referencing it; `knowledgeStore.js` (loadOverview) and
// `DashboardView.vue` never call it; `backlogPeak` maintained via inline `Math.max(...)`
// only. After porting, also zero production consumers —— T6 (`knowledgeStore.ts:317`) and
// T12 (`DashboardView.vue` header comment "found, not defect" section) each copied that
// inline, not changed to call `updatePeak`. This function kept purely for 1:1 with original
// (original exports it, so we port it), not a pending hook.

// Original :1-5 —— Progress math for the parsing backlog (spec §4.8).
// The percent is an honest UI-local measure: peak is the rolling max backlog
// seen this page session (updatePeak BEFORE progressPercent each poll), so
// the bar can recede when new files arrive — semantically correct, never
// negative.

/** Original :7-9 */
export function updatePeak(peak: number, backlog: number): number {
  return Math.max(peak || 0, backlog || 0)
}

/** Original :11-15 */
export function progressPercent(backlog: number, peak: number): number {
  if (!peak || peak <= 0) return 0
  const pct = Math.round((1 - backlog / peak) * 100)
  return Math.min(100, Math.max(0, pct))
}

/* Original :17-20 —— Status roll-up for the Dashboard's Notes layer
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

// Original :29-34 —— `'<1m'`/`'{m}m'`/`'{h}h {m}m'` are English abbreviation literals;
// original doesn't use i18n (not Chinese time units, terminal-style compact notation);
// this port copies verbatim, no i18n integration —— integration would change original's
// UI text contract, unauthorized deviation (brief hard constraint explicitly names this).
export function fmtEta(etaS: number | null | undefined): string {
  if (etaS == null || etaS <= 0) return ''
  if (etaS < 60) return '<1m'
  const m = Math.floor(etaS / 60)
  if (m < 60) return `${m}m`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}
