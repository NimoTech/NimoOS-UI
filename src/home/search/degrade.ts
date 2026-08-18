import type { NormalizedAggregate } from '@nimotech/nimoos-service'
import type { DegradeState } from './types'

// spec §7.8. Most critical visible behavior in this area: when two of the four local sources are
// unavailable, the user must see that "this search only looked at filenames", not assume that is all the results.
//
// ⚠️ "Whether an array is empty" cannot be used to infer "whether that source participated" —— empirically semantic returns []
//    (ran, zero hits) or null (didn't run). **The only reliable signal is warnings.** (spec §7.10a)
// ⚠️ notes source not requested this sprint (debt D2). Even if we receive notes_unavailable, do not display it:
//    telling the user "note search unavailable" when we never searched notes at all would be misleading.

const UNAVAILABLE_SUFFIX = '_unavailable'
const KNOWN_SOURCES = ['semantic', 'filenames', 'images']
const NO_ROOTS = 'no_accessible_roots'

export function deriveDegrade(agg: NormalizedAggregate, totalRows: number): DegradeState {
  const unavailableSources: string[] = []
  const unknownWarnings: string[] = []
  let noRoots = false

  for (const w of agg.warnings) {
    if (w === NO_ROOTS) { noRoots = true; continue }
    if (w.endsWith(UNAVAILABLE_SUFFIX)) {
      const src = w.slice(0, -UNAVAILABLE_SUFFIX.length)
      if (src === 'notes') continue          // notes not requested this sprint, reporting it would be misleading
      if (KNOWN_SOURCES.includes(src)) { unavailableSources.push(src); continue }
    }
    unknownWarnings.push(w)                  // pass through unknown warnings as-is, do not silently drop
  }

  const empty: DegradeState['empty'] =
    noRoots ? 'no_roots'
    : totalRows > 0 ? 'none'
    : agg.warnings.length > 0 ? 'backend_not_ready'
    : 'no_match'

  return { unavailableSources, unknownWarnings, empty }
}
