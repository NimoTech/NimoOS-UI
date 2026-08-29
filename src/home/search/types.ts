// Shared types for Search area view layer. **Pure types, zero logic, zero Vue, zero i18n dependency** —
// three pure-function modules (reasons / buildSearchView / degrade) and components share this.

/** Semantic color for sorting reason tags. Reuses existing .rz-* styles; spec §7.5 removed the demote tier
 *  (backend has no demotion signal; that "Likely a person name · demoted" in the demo is made up). */
export type ReasonKind = 'primary' | 'normal' | 'semantic'

/** key = i18n key name, **not the text** — renders as t(key). */
export interface Reason { key: string; kind: ReasonKind }

export type ResultCategory = 'Documents' | 'Images' | 'Audio' | 'Videos'

/** Source badge one of three (spec §7.6: replacing accuracy percentages we can't honestly obtain from backend). */
export type SourceBadge = 'semantic' | 'filename' | 'ocr'

/** One result row. When the same real path hits multiple sources, merge into one row (spec §7.3). */
export interface ResultRow {
  /** Merge key = real path */
  realPath: string
  name: string
  category: ResultCategory
  /** Image / video → use thumbnail rendering (gallery card / media row) */
  isMedia: boolean
  /** filenames source may return directory item (is_dir=true); directories cannot be previewed, click goes directly to folder */
  isDir: boolean
  reasons: Reason[]
  badge: SourceBadge
  /** Snippet text: `preview.text` from semantic source, or `caption` from images source; empty string from filenames source */
  snippet: string
  /** Ranking layer (1–5, see spec §7.4 + plan supplementary rule A2); not displayed, used for sorting only */
  layer: number
  /** Within-layer sort score. **Not comparable across layers** (filenames.match has no upper bound / semantic.score is vector similarity) */
  score: number
  /** Thumbnail URL from images source. **Not consumed this round** (see Task 5 comment), kept to not lose backend data */
  thumbnailUrl?: string
}

export interface SearchTab { key: string; count: number }

export interface SearchView {
  /** All rows already sorted (layer → within-layer score → backend original order) */
  rows: ResultRow[]
  /** Non-media rows, preserving rows' relative order */
  docRows: ResultRow[]
  /** Media rows (Images / Videos), preserving rows' relative order */
  mediaRows: ResultRow[]
  /** [all results, ...categories sorted by hit count descending]; categories with count 0 do not appear */
  tabs: SearchTab[]
  total: number
}

/** Status code for degradation / empty state; text is mapped in component (spec §7.8). */
export interface DegradeState {
  /** Sources not participating in this search (already stripped _unavailable suffix, notes already filtered). Non-empty → show notice bar at top of results */
  unavailableSources: string[]
  /** Unrecognized warning, pass through to UI as-is, do not silently discard */
  unknownWarnings: string[]
  /** Empty state type; 'none' = has results, do not show empty state */
  empty: 'none' | 'no_roots' | 'backend_not_ready' | 'no_match'
}
