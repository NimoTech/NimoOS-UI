import type { FileNameHit, SemanticHit } from '@nimotech/nimoos-service'
import type { Reason } from './types'

// Derivation rules table from spec §7.5. **Produces i18n key, not copy** (see plan Task 1 notes).
// Largest difference from hardcoded labels in demo era (Exact filename match / Body match ×9 / …):
// those counts (×9 / ×3) are not returned by the backend at all, they were made up, so labels no longer have numbers.

/** kind known values → label. Backend kind is an open string; unknown ones all fall back to "semantic match". */
const KIND_REASON: Record<string, Reason> = {
  body: { key: 'searchReasonBody', kind: 'normal' },
  transcript: { key: 'searchReasonTranscript', kind: 'normal' },
  ocr: { key: 'searchReasonOcr', kind: 'normal' },
  caption: { key: 'searchReasonCaption', kind: 'semantic' },
}

const SEMANTIC_REASON: Reason = { key: 'searchReasonSemantic', kind: 'semantic' }

/** filenames source. Backend match is fuzzy relevance, so "query is a substring of filename" does not necessarily hold
 *  (empirical test: query="how to cook" matches cookies.py) → supplemental rule A1: fuzzy match gives "filename match". */
export function filenameReason(hit: FileNameHit, query: string): Reason {
  const q = query.trim().toLowerCase()
  const name = hit.name.toLowerCase()
  if (q && name.includes(q)) return { key: 'searchReasonFilename', kind: 'primary' }
  return { key: 'searchReasonFilenameFuzzy', kind: 'semantic' }
}

/** semantic source. Among known kinds, only 'normal' tier (body/transcript/ocr) promises "query term visible in preview",
 *  so only this tier needs literal verification — if not found, degrade to "semantic match"; 'semantic' tier (caption)
 *  does not promise literal correspondence (CLIP image semantic match, preview is image description, not a rephrase of
 *  query), so we must not perform this verification, otherwise we'd wrongly flatten "caption hit" into generic "semantic
 *  match" and lose the more specific label. Unknown kind directly gets the generic label. */
export function semanticReason(hit: SemanticHit, query: string): Reason {
  const known = KIND_REASON[hit.kind]
  if (!known) return SEMANTIC_REASON
  if (known.kind === 'semantic') return known
  const q = query.trim().toLowerCase()
  const text = hit.preview.text.toLowerCase()
  if (!q || !text.includes(q)) return SEMANTIC_REASON
  return known
}

/** images source = CLIP semantic match from Photos, same semantic as caption, reuses the same label. */
export function imageReason(): Reason {
  return { key: 'searchReasonCaption', kind: 'semantic' }
}
