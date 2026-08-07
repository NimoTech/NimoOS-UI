import type { AxiosInstance } from 'axios'

// search 域 = 四源聚合搜索。**入口是 NimoOS-AI 的代理**:
//   POST /v1/ai/search/agent/tool  →(AI 注入 X-NimoOS-User-ID 后转发)→ NimoOS-Search
// 直连 /v1/search/agent/tool 必 400 —— 网关从不注入 X-NimoOS-User-ID(spec §1.1),
// 而 Search 拿它做授权根目录过滤。代价:搜索从此依赖 nimoos-ai 在跑(spec §2,债务 D3)。
//
// ⚠️ 信封:**裸 JSON,零层 unwrap**(AI 代理用 c.Blob 原样透传 Search 的 AggregateResponse)。
// ⚠️ 未参与/无命中的组可能是 **null 也可能是 []**,两者都出现过(spec §7.10a):
//    null = 该源没跑(未请求/不可用);[] = 跑了但零命中。**归一化后统一成 []**,
//    「哪些源没参与」只能看 warnings,不能用「组是不是 null」去推。
export type SearchSource = 'semantic' | 'filenames' | 'images' | 'notes'

/** NimoOS-Search/service/parser_client.go:139-143 FilePath */
export interface SearchFilePath { rootId: string; path: string; mtimeMs: number }

/** NimoOS-Search/service/search.go:46-53 Cite —— 前五个字段后端是指针,JSON 里可为 null */
export interface SearchCite {
  page: number | null
  offsetStart: number | null
  offsetEnd: number | null
  frameMsStart: number | null
  frameMsEnd: number | null
  chunkNo: number
}

/** 语义命中。形状 = agent_tools.go:186-211 trimHits() 的投影(七个键),
 *  **不是** search.go 的 Hit 全量:raw_score / collection / payload_extra 都被投影掉了。
 *  paths 最多 3 条(AgentMaxPaths=3),preview.text 最多 200 字符(AgentMaxPreviewChar=200)。
 *  kind 后端是开放字符串,已知取值 body / transcript / ocr / caption / summary。 */
export interface SemanticHit {
  score: number
  fileId: string
  paths: SearchFilePath[]
  mime: string
  kind: string
  cite: SearchCite
  preview: { text: string }
}

/** NimoOS-Search/service/fileindex/index.go:29-37 FileNameHit。
 *  ⚠️ match 是**无上界**的模糊相关度(实测 2 / 1.5),不是 0–1,更不是百分比。
 *  ⚠️ is_dir=true 的目录项也会出现在结果里。 */
export interface FileNameHit {
  path: string; name: string; ext: string
  size: number; mtimeMs: number; isDir: boolean; match: number
}

/** NimoOS-Search/service/photos_client.go:13-25 ImageHit(taken_at / caption 带 omitempty) */
export interface ImageHit {
  assetId: string; name: string; path: string; score: number
  takenAt: string; thumbnailUrl: string; caption: string
}

/** NimoOS-Search/service/notes_client.go:13-21 NoteHit —— 本期不请求 notes 源(债务 D2),
 *  类型留着是为了让 NormalizedAggregate 与后端契约完整对齐。 */
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
    /** POST /v1/ai/search/agent/tool —— 四源聚合。只做归一化,不产视图模型(spec §7.2)。
     *  失败(HTTP 5xx / AI 不可达 / 响应异形)一律抛,由调用方渲染错误态 —— **不得静默返回空结果**。 */
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
        // 异形响应绝不能退化成「四源全空」——那会在界面上伪装成「没搜到」。
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
