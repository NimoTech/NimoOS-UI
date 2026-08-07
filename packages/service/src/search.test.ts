import { describe, it, expect } from 'vitest'
import type { AxiosInstance } from 'axios'
import { createSearch } from './search'

// 记录调用的 http 桩:post 记下 url + body,返回 postMap[url]
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

// ── fixture ①:真机逐字响应(spec §7.10a,2026-08-04 curl,query=receipt)────────
// 注意三件事:semantic 是空数组(Parser 活着、零命中)、images/notes 是 null、
// warnings 只有 images_unavailable —— 「组为 null」与「warnings 含该源」不是同一件事。
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

// ── fixture ②:semantic / images 组的形状(本机产不出非空组,逐字派生自 Go 结构体)──
// semantic 元素 = NimoOS-Search/service/agent_tools.go:186-211 trimHits() 的投影
//   (score/file_id/paths/mime/kind/cite/preview 七个键,没有 raw_score/collection/payload_extra)
// paths 元素   = service/parser_client.go:139-143 FilePath{root_id,path,mtime_ms}
// cite         = service/search.go:46-53 Cite(前五个字段是指针,JSON 里可为 null)
// images 元素  = service/photos_client.go:13-25 ImageHit(taken_at/caption 带 omitempty)
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

describe('createSearch.agentTool —— 请求形状', () => {
  it('打 /v1/ai/search/agent/tool,body 是 nimoos_search 工具调用(蛇形 top_k)', async () => {
    const { http, calls } = stub({ [URL]: REAL_RECEIPT })
    await createSearch(http).agentTool('receipt')
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe(URL)
    expect(calls[0].body).toEqual({
      name: 'nimoos_search',
      arguments: { query: 'receipt', sources: ['semantic', 'filenames', 'images'], top_k: 20 },
    })
  })

  it('sources / topK 可覆盖', async () => {
    const { http, calls } = stub({ [URL]: REAL_RECEIPT })
    await createSearch(http).agentTool('receipt', { sources: ['filenames'], topK: 5 })
    expect(calls[0].body).toEqual({
      name: 'nimoos_search',
      arguments: { query: 'receipt', sources: ['filenames'], top_k: 5 },
    })
  })
})

describe('createSearch.agentTool —— 归一化', () => {
  it('真机响应:filenames 转驼峰,空组 null → [],stats/warnings 归位', async () => {
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

  it('semantic 命中转驼峰,preview.text / paths / cite 原样带出', async () => {
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

  it('images 命中转驼峰,omitempty 缺失的 takenAt / caption 退化成空串', async () => {
    const { http } = stub({ [URL]: SHAPED })
    const agg = await createSearch(http).agentTool('fish')
    expect(agg.images[0]).toEqual({
      assetId: 'asset-9', name: 'IMG_0042.jpg', path: '/DATA/Gallery/IMG_0042.jpg',
      score: 0.71, takenAt: '', thumbnailUrl: '/v1/photos/assets/asset-9/thumbnail', caption: '',
    })
    expect(agg.filenames).toEqual([])  // 这份 fixture 里 filenames 是 null
  })

  it('stats 缺键时退化成空串 / 0,不抛', async () => {
    const { http } = stub({ [URL]: { groups: { semantic: null, filenames: null, images: null, notes: null }, warnings: null } })
    const agg = await createSearch(http).agentTool('x')
    expect(agg.stats).toEqual({ fileindexStatus: '', totalCandidates: 0 })
    expect(agg.warnings).toEqual([])
  })

  it('响应里没有 groups → 抛错,绝不静默返回空结果', async () => {
    // spec §7.8 底线:AI 代理挂了/返回异形,必须让 UI 走「搜索服务不可用」而不是「没搜到」
    const { http } = stub({ [URL]: { message: 'internal error' } })
    await expect(createSearch(http).agentTool('x')).rejects.toThrow(/unexpected search response/)
  })

  it('响应体不是对象(null / 字符串)→ 同样抛错', async () => {
    const a = stub({ [URL]: null })
    await expect(createSearch(a.http).agentTool('x')).rejects.toThrow(/unexpected search response/)
    const b = stub({ [URL]: 'boom' })
    await expect(createSearch(b.http).agentTool('x')).rejects.toThrow(/unexpected search response/)
  })
})
