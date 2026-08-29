// SP8-P5d Task 3 —— 1:1 ported from Vue2
// the Vue 2 panel's `src/views/AI/Knowledge/noteEditHelpers.js` (main@7a6ee6b7, 11 lines).
//
// N23: `conflictMessage` returns hardcoded English string, no i18n —— only call site
// `NoteEditPane.vue:293` is `if (conflictMessage(e) && !this.isNew)`, used only as boolean
// predicate, return value never displayed to user. Adding i18n key = spurious dead key.
// But Vue2's existing test `__tests__/noteEditHelpers.spec.js:11` asserts `.toContain('4')`
// (revision in string) —— must inherit this behavior, string content can't simplify to `return true`.

/** Original :1-3 —— delimiters `/[,\s]+/` (comma and whitespace), trim + filter + deduplicate. */
export function parseTags(str: string | null | undefined): string[] {
  return [
    ...new Set(
      String(str || '')
        .split(/[,\s]+/)
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ]
}

interface ConflictLikeError {
  response?: {
    status?: number
    data?: { current_revision?: unknown }
  }
}

/**
 * Original :6-10 —— returns non-null only on HTTP 409, reads `r.data.current_revision`.
 * T0 verified backend source confirms 409 field name is `current_revision` (`agent/main.py:2870-2872`),
 * governance's concern about "revision undefined" doesn't hold.
 */
export function conflictMessage(err: ConflictLikeError | null | undefined): string | null {
  const r = err && err.response
  if (!r || r.status !== 409) return null
  const rev = r.data && r.data.current_revision
  return `Note changed elsewhere (now revision ${rev}) — reload and retry`
}
