import { describe, it, expect } from 'vitest'
import type { AxiosInstance } from 'axios'
import { createSearch } from './search'

// http stub that records calls: post records url + body, returns postMap[url]
function stub(postMap: Record<string, unknown> = {}) {
  const calls: { url: string; body?: unknown }[] = []
  const http = {
    post: async (url: string, body: unknown) => {
      calls.push({ url, body })
      if (!(url in postMap)) throw new Error('unexpected url ' + url)
      return { data: postMap[url] }
    },
  } as unknown as AxiosInstance
  return { http, calls }
}

const URL = '/v1/ai/search/agent/tool'

// ── fixture 1: verbatim real-device response (spec §7.10a, 2026-08-04 curl, query=receipt) ────────
// Note three things: semantic is an empty array (Parser is alive, zero hits), images/notes are null,
// warnings only has images_unavailable —— "group is null" and "warnings contains this source" are not the same thing.
const REAL_RECEIPT = {
  groups: {
    semantic: [],
    filenames: [
      { path: '/DATA/Documents/Recipes/Receipt.pdf', name: 'Receipt.pdf', ext: 'pdf', size: 53866, mtime_ms: 1784715139167, is_dir: false, match: 2 },
      { path: "/DATA/Documents/life/Nick's receipt.jpg", name: "Nick's receipt.jpg", ext: 'jpg', size: 42943, mtime_ms: 1783651328200, is_dir: false, match: 1.5 },
    ],
    images: null,
    notes: null,
  },
  stats: { fileindex_status: 'ready', total_candidates: 2 },
  warnings: ['images_unavailable'],
}

// ── fixture 2: shape of the semantic / images groups (this machine can't produce a non-empty group, derived verbatim from the Go structs) ──
// semantic element = the projection of NimoOS-Search/service/agent_tools.go:186-211 trimHits()
//   (seven keys: score/file_id/paths/mime/kind/cite/preview, no raw_score/collection/payload_extra)
// paths element   = service/parser_client.go:139-143 FilePath{root_id,path,mtime_ms}
// cite         = service/search.go:46-53 Cite (the first five fields are pointers, can be null in JSON)
// images element  = service/photos_client.go:13-25 ImageHit (taken_at/caption carry omitempty)
const SHAPED = {
  groups: {
    semantic: [
      {
        score: 0.83,
        file_id: 'a1b2c3',
        paths: [{ root_id: 'r1', path: '/DATA/Documents/Recipes/fish_recipe.docx', mtime_ms: 1783499966725 }],
        mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        kind: 'body',
        cite: { page: null, offset_start: null, offset_end: null, frame_ms_start: null, frame_ms_end: null, chunk_no: 3 },
        preview: { text: 'Pan-seared fish with lemon butter', thumbnail_url: null },
      },
    ],
    filenames: null,
    images: [
      { asset_id: 'asset-9', name: 'IMG_0042.jpg', path: '/DATA/Gallery/IMG_0042.jpg', score: 0.71, thumbnail_url: '/v1/photos/assets/asset-9/thumbnail' },
    ],
    notes: null,
  },
  stats: { fileindex_status: 'building', total_candidates: 2 },
  warnings: [],
}

describe('createSearch.agentTool —— request shape', () => {
  it('hits /v1/ai/search/agent/tool, body is the nimoos_search tool call (snake_case top_k)', async () => {
    const { http, calls } = stub({ [URL]: REAL_RECEIPT })
    await createSearch(http).agentTool('receipt')
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe(URL)
    expect(calls[0].body).toEqual({
      name: 'nimoos_search',
      arguments: { query: 'receipt', sources: ['semantic', 'filenames', 'images'], top_k: 20 },
    })
  })

  it('sources / topK are overridable', async () => {
    const { http, calls } = stub({ [URL]: REAL_RECEIPT })
    await createSearch(http).agentTool('receipt', { sources: ['filenames'], topK: 5 })
    expect(calls[0].body).toEqual({
      name: 'nimoos_search',
      arguments: { query: 'receipt', sources: ['filenames'], top_k: 5 },
    })
  })
})

describe('createSearch.agentTool —— normalization', () => {
  it('real-device response: filenames converted to camelCase, empty group null → [], stats/warnings settle into place', async () => {
    const { http } = stub({ [URL]: REAL_RECEIPT })
    const agg = await createSearch(http).agentTool('receipt')
    expect(agg.filenames).toHaveLength(2)
    expect(agg.filenames[0]).toEqual({
      path: '/DATA/Documents/Recipes/Receipt.pdf', name: 'Receipt.pdf', ext: 'pdf',
      size: 53866, mtimeMs: 1784715139167, isDir: false, match: 2,
    })
    expect(agg.semantic).toEqual([])
    expect(agg.images).toEqual([])   // null → []
    expect(agg.notes).toEqual([])    // null → []
    expect(agg.stats).toEqual({ fileindexStatus: 'ready', totalCandidates: 2 })
    expect(agg.warnings).toEqual(['images_unavailable'])
  })

  it('semantic hit converted to camelCase, preview.text / paths / cite carried through as-is', async () => {
    const { http } = stub({ [URL]: SHAPED })
    const agg = await createSearch(http).agentTool('fish')
    expect(agg.semantic).toHaveLength(1)
    const h = agg.semantic[0]
    expect(h.fileId).toBe('a1b2c3')
    expect(h.kind).toBe('body')
    expect(h.paths[0]).toEqual({ rootId: 'r1', path: '/DATA/Documents/Recipes/fish_recipe.docx', mtimeMs: 1783499966725 })
    expect(h.cite.chunkNo).toBe(3)
    expect(h.cite.page).toBeNull()
    expect(h.preview.text).toBe('Pan-seared fish with lemon butter')
  })

  it('images hit converted to camelCase, takenAt / caption missing due to omitempty degrade to an empty string', async () => {
    const { http } = stub({ [URL]: SHAPED })
    const agg = await createSearch(http).agentTool('fish')
    expect(agg.images[0]).toEqual({
      assetId: 'asset-9', name: 'IMG_0042.jpg', path: '/DATA/Gallery/IMG_0042.jpg',
      score: 0.71, takenAt: '', thumbnailUrl: '/v1/photos/assets/asset-9/thumbnail', caption: '',
    })
    expect(agg.filenames).toEqual([])  // filenames is null in this fixture
  })

  it('stats degrades to an empty string / 0 on a missing key, never throws', async () => {
    const { http } = stub({ [URL]: { groups: { semantic: null, filenames: null, images: null, notes: null }, warnings: null } })
    const agg = await createSearch(http).agentTool('x')
    expect(agg.stats).toEqual({ fileindexStatus: '', totalCandidates: 0 })
    expect(agg.warnings).toEqual([])
  })

  it('response has no groups → throws, never silently returns an empty result', async () => {
    // spec §7.8 bottom line: if the AI agent is down/returns a malformed shape, the UI must go down the "search service unavailable" path, not "no results found"
    const { http } = stub({ [URL]: { message: 'internal error' } })
    await expect(createSearch(http).agentTool('x')).rejects.toThrow(/unexpected search response/)
  })

  it('response body is not an object (null / string) → also throws', async () => {
    const a = stub({ [URL]: null })
    await expect(createSearch(a.http).agentTool('x')).rejects.toThrow(/unexpected search response/)
    const b = stub({ [URL]: 'boom' })
    await expect(createSearch(b.http).agentTool('x')).rejects.toThrow(/unexpected search response/)
  })
})
