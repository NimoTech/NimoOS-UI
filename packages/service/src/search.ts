import type { AxiosInstance } from 'axios'

// search domain = four-source aggregated search. **The entry point is NimoOS-AI's proxy**:
//   POST /v1/ai/search/agent/tool  →(AI injects X-NimoOS-User-ID then forwards)→ NimoOS-Search
// Hitting /v1/search/agent/tool directly always 400s —— the Gateway never injects X-NimoOS-User-ID (spec §1.1),
// and Search uses it for the authorized-root-directory filter. Cost: search now depends on nimoos-ai being up (spec §2, debt D3).
//
// Warning: envelope: **bare JSON, zero unwrap layers** (the AI proxy passes Search's AggregateResponse through as-is via c.Blob).
// Warning: a group that didn't participate/had no hits can be **either null or []**, both have been observed (spec §7.10a):
//    null = that source didn't run (not requested/unavailable); [] = it ran but got zero hits. **After normalization both become []**,
//    so "which sources didn't participate" can only be read from warnings, never inferred from "is the group null".
export type SearchSource = 'semantic' | 'filenames' | 'images' | 'notes'

/** NimoOS-Search/service/parser_client.go:139-143 FilePath */
export interface SearchFilePath { rootId: string; path: string; mtimeMs: number }

/** NimoOS-Search/service/search.go:46-53 Cite —— the backend's first five fields are pointers, can be null in JSON */
export interface SearchCite {
  page: number | null
  offsetStart: number | null
  offsetEnd: number | null
  frameMsStart: number | null
  frameMsEnd: number | null
  chunkNo: number
}

/** A semantic hit. Shape = the projection from agent_tools.go:186-211 trimHits() (seven keys),
 *  **not** the full search.go Hit: raw_score / collection / payload_extra are all projected away.
 *  paths has at most 3 entries (AgentMaxPaths=3), preview.text has at most 200 characters (AgentMaxPreviewChar=200).
 *  kind is an open string on the backend, known values are body / transcript / ocr / caption / summary. */
export interface SemanticHit {
  score: number
  fileId: string
  paths: SearchFilePath[]
  mime: string
  kind: string
  cite: SearchCite
  preview: { text: string }
}

/** NimoOS-Search/service/fileindex/index.go:29-37 FileNameHit.
 *  Warning: match is an **unbounded** fuzzy relevance score (observed values 2 / 1.5 in practice), not 0-1, and definitely not a percentage.
 *  Warning: directory entries with is_dir=true also appear in the results. */
export interface FileNameHit {
  path: string; name: string; ext: string
  size: number; mtimeMs: number; isDir: boolean; match: number
}

/** NimoOS-Search/service/photos_client.go:13-25 ImageHit (taken_at / caption carry omitempty) */
export interface ImageHit {
  assetId: string; name: string; path: string; score: number
  takenAt: string; thumbnailUrl: string; caption: string
}

/** NimoOS-Search/service/notes_client.go:13-21 NoteHit —— this phase doesn't request the notes source (debt D2),
 *  the type is kept around just to keep NormalizedAggregate fully aligned with the backend contract. */
export interface NoteHit {
  noteId: string; chunkNo: number; text: string
  type: string; status: string; updatedAt: number; score: number
}

export interface NormalizedAggregate {
  semantic: SemanticHit[]
  filenames: FileNameHit[]
  images: ImageHit[]
  notes: NoteHit[]
  stats: { fileindexStatus: string; totalCandidates: number }
  warnings: string[]
}

const DEFAULT_SOURCES: SearchSource[] = ['semantic', 'filenames', 'images']
const DEFAULT_TOP_K = 20

function arr(v: unknown): Record<string, unknown>[] {
  return Array.isArray(v) ? (v as Record<string, unknown>[]) : []
}
function str(v: unknown): string { return typeof v === 'string' ? v : '' }
function num(v: unknown): number { return typeof v === 'number' ? v : 0 }
function bool(v: unknown): boolean { return v === true }
function nullableNum(v: unknown): number | null { return typeof v === 'number' ? v : null }

function toFilePath(v: Record<string, unknown>): SearchFilePath {
  return { rootId: str(v.root_id), path: str(v.path), mtimeMs: num(v.mtime_ms) }
}

function toCite(v: unknown): SearchCite {
  const c = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>
  return {
    page: nullableNum(c.page),
    offsetStart: nullableNum(c.offset_start),
    offsetEnd: nullableNum(c.offset_end),
    frameMsStart: nullableNum(c.frame_ms_start),
    frameMsEnd: nullableNum(c.frame_ms_end),
    chunkNo: num(c.chunk_no),
  }
}

export function createSearch(http: AxiosInstance) {
  return {
    /** POST /v1/ai/search/agent/tool —— four-source aggregation. Only normalizes, produces no view model (spec §7.2).
     *  On failure (HTTP 5xx / AI unreachable / malformed response) always throws, letting the caller render the error state —— **must never silently return an empty result**. */
    async agentTool(
      query: string,
      opts?: { sources?: SearchSource[]; topK?: number },
    ): Promise<NormalizedAggregate> {
      const res = await http.post('/v1/ai/search/agent/tool', {
        name: 'nimoos_search',
        arguments: {
          query,
          sources: opts?.sources ?? DEFAULT_SOURCES,
          top_k: opts?.topK ?? DEFAULT_TOP_K,
        },
      })
      const body = res.data as Record<string, unknown> | null
      if (!body || typeof body !== 'object' || !body.groups || typeof body.groups !== 'object') {
        // A malformed response must never degrade into "all four sources empty" —— that would masquerade in the UI as "no results found".
        throw new Error('unexpected search response')
      }
      const g = body.groups as Record<string, unknown>
      const stats = (body.stats && typeof body.stats === 'object' ? body.stats : {}) as Record<string, unknown>
      return {
        semantic: arr(g.semantic).map((h) => ({
          score: num(h.score),
          fileId: str(h.file_id),
          paths: arr(h.paths).map(toFilePath),
          mime: str(h.mime),
          kind: str(h.kind),
          cite: toCite(h.cite),
          preview: { text: str((h.preview as Record<string, unknown> | undefined)?.text) },
        })),
        filenames: arr(g.filenames).map((h) => ({
          path: str(h.path), name: str(h.name), ext: str(h.ext),
          size: num(h.size), mtimeMs: num(h.mtime_ms), isDir: bool(h.is_dir), match: num(h.match),
        })),
        images: arr(g.images).map((h) => ({
          assetId: str(h.asset_id), name: str(h.name), path: str(h.path), score: num(h.score),
          takenAt: str(h.taken_at), thumbnailUrl: str(h.thumbnail_url), caption: str(h.caption),
        })),
        notes: arr(g.notes).map((h) => ({
          noteId: str(h.note_id), chunkNo: num(h.chunk_no), text: str(h.text),
          type: str(h.type), status: str(h.status), updatedAt: num(h.updated_at), score: num(h.score),
        })),
        stats: { fileindexStatus: str(stats.fileindex_status), totalCandidates: num(stats.total_candidates) },
        warnings: Array.isArray(body.warnings) ? (body.warnings as unknown[]).filter((w): w is string => typeof w === 'string') : [],
      }
    },
  }
}
