// SP8-P5a Task 6 —— 1:1 ported from Vue2
// the Vue 2 panel's `src/views/AI/Knowledge/indexedFiles.js` (main@7a6ee6b7).
//
// Original file has 5 pure functions (`buildListParams`/`rowStatusLabel`/`formatSize`/
// `anyIndexing`/`rootsFromFolderRules`); T6 brief only names `buildListParams` and
// `anyIndexing` to port (needed by `indexedFiles` data flow and poll guard); others are
// IndexedFilesView display-layer helpers, left for consumer task (P5b) to bring together
// into this file —— this file path per design §5.1 is shared `util/indexedFiles.ts`.

/** Original :5-14 —— copy filters, discard keys with '' / null / undefined values. */
export function buildListParams(
  filters: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  Object.keys(filters || {}).forEach((k) => {
    const v = (filters as Record<string, unknown>)[k]
    if (v === '' || v === null || v === undefined) return
    out[k] = v
  })
  return out
}

/** Original :32-34 —— whether any row in indexing state (criterion for poll continuation). */
export function anyIndexing(
  files: Array<{ status?: string } | null | undefined> | null | undefined,
): boolean {
  return Array.isArray(files) && files.some((f) => !!f && f.status === 'indexing')
}
