// SP8-P2a Task 9 — Extracted from Vue2 src/views/AI/Settings/sections/ModelsSection.vue
// component methods (structural adjustment, not behavioral change — extracted to enable
// precise boundary testing; originally mixed into `methods` object, not unit-testable).

/**
 * Exactly aligns with Vue2 ModelsSection.vue:170-175 (`formatSize`).
 * Note: `!bytes` is a truthy check; `0` also falls into this branch returning an em dash—
 * Vue2 does this, replicated verbatim, not "improved" (brief explicitly specifies).
 */
export function formatModelSize(bytes: number | null | undefined): string {
  if (!bytes) return '—'
  const gb = bytes / 1024 / 1024 / 1024
  if (gb >= 1) return gb.toFixed(1) + ' GB'
  return (bytes / 1024 / 1024).toFixed(0) + ' MB'
}

/**
 * Exactly aligns with Vue2 ModelsSection.vue:176-180 (`etaLabel`)'s branching/rounding logic,
 * but returns a struct instead of a formatted string — unit text passes through `$t` in the
 * component (unit is one of sec/min/hr; plural forms vary by locale), pure function does not
 * carry localized text. Same approach as P1c2 Task 10 `formatDuration` (see that file's
 * header comment).
 */
export function formatEtaSeconds(secs: number): { unit: 'sec' | 'min' | 'hr'; n: number } {
  if (secs < 60) return { unit: 'sec', n: Math.round(secs) }
  if (secs < 3600) return { unit: 'min', n: Math.round(secs / 60) }
  return { unit: 'hr', n: Number((secs / 3600).toFixed(1)) }
}
