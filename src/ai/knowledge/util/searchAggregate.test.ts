// SP8-P5e Task 3 — unit tests for `searchAggregate.ts`, inherit from Vue2 existing
// `__tests__/searchAggregate.spec.js`(46 lines / 2 cases, governance §4.3) and add refinement
// (`kindFromMime` six branches / `basename`/`dirname` boundaries / `chunkVM` boundaries /
// N45 three things each independent), plus K48 (equivalence programmatically proven by T0,
// `p5e-task-0-report.md` §9) and K49 (only XSS surface this period) specialized cases.
//
// 🔴 Fixture discipline (ruling R3.2/R9/R10, `p5e-fixtures/README.md`):
// This file's multi-file aggregate cases from `.superpowers/sdd/p5e-fixtures/F5b-search-text.multifile.REPLAYED.json`
// (three-level source label = **REPLAYED**: true Qdrant payload replayed through authoritative code path
// `NimoOS-Search/service/search.go`, with 2 human elements declared in README §3.1: 8 scores from local
// test interval tier representative values, "4 files × 2 chunks" selection rule).
// 🔴 **R9-3**: full text zero-truncated truth (each preview.text 2156–2379 chars) → this file **keeps 1 full text only**
// (below `FIRST_CHUNK_FULL_TEXT`, from F5b `files[0].chunks[0].preview.text`,
// sha256 `fe4f68aa570a1ad127811d38a3d87f3845523f0ff0cb53c4f9baad6327bade1b`, length 2342,
// verifiable via `python3 -c "import json,hashlib; d=json.load(open('.superpowers/sdd/p5e-fixtures/F5b-search-text.multifile.REPLAYED.json')); t=d['files'][0]['chunks'][0]['preview']['text']; print(len(t), hashlib.sha256(t.encode()).hexdigest())"`
// should print `2342 fe4f68aa570a…`), **other preview.text all truncated to first 50 chars**
// (still true prefix from same real data, not hand-written — aggregate/sort/score logic
// independent of text length or content, only one separate case validates "pass through untruncated").
// 🔴 Ledger metadata keys with `_` prefix (`_provenance` etc) already deleted per README §3.3,
// not copied to this file.
import { describe, it, expect } from 'vitest'
import {
  kindFromMime,
  basename,
  dirname,
  toFileResults,
  chunkCount,
  highlight,
  fmtMtime,
  relLevel,
  relLabel,
  type SearchTextResponseRaw,
} from './searchAggregate'
import { i18n } from '../../../i18n'

// ═══════════════════════════════════════════════════════════════════════════
// kindFromMime — blueprint :5-12, six branches each + empty value fallback +
// 🔴 order-sensitive case
// ═══════════════════════════════════════════════════════════════════════════
describe('kindFromMime — blueprint :5-12', () => {
  it('Empty value fallback: null → doc', () => {
    expect(kindFromMime(null)).toBe('doc')
  })

  it('Empty value fallback: undefined → doc', () => {
    expect(kindFromMime(undefined)).toBe('doc')
  })

  it('Empty value fallback: empty string → doc (falsy branch)', () => {
    expect(kindFromMime('')).toBe('doc')
  })

  it('Branch 1 — contains "pdf" → pdf', () => {
    expect(kindFromMime('application/pdf')).toBe('pdf')
  })

  it('Branch 2 — exactly equals "text/markdown" → md', () => {
    expect(kindFromMime('text/markdown')).toBe('md')
  })

  it('Branch 3 — exactly equals "text/x-source" → code', () => {
    expect(kindFromMime('text/x-source')).toBe('code')
  })

  it('Branch 4 — contains docx/pptx/xlsx → doc (verify each)', () => {
    expect(kindFromMime('application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe('doc')
    expect(kindFromMime('application/vnd.openxmlformats-officedocument.presentationml.presentation.pptx')).toBe('doc')
    expect(kindFromMime('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.xlsx')).toBe('doc')
  })

  it('Branch 5 — contains "plain" → txt (actual mime of 7 indexed files on real device, see F9)', () => {
    expect(kindFromMime('text/plain')).toBe('txt')
  })

  it('Branch 6 — unknown mime falls to fallback → doc', () => {
    expect(kindFromMime('image/png')).toBe('doc')
  })

  it('Broad match net of includes("pdf") catches docling variant: "text/markdown+docling/pdf" → pdf, not md', () => {
    // 🔴 Independent verification (don't trust unverified brief/T0 report literals, governance §9/ruling R8 same discipline):
    // Brief original claimed "swap `=== 'text/markdown'` and `includes('pdf')` branches →
    // this assertion must red". After hand-testing RED probe **not true**: `=== 'text/markdown'` exact match,
    // 'text/markdown+docling/pdf' can never exactly equal 'text/markdown' (extra suffix),
    // so structurally exclusive, swap order zero effect on this input (node test: still returns 'pdf' after swap).
    // What truly changes result by order is **between two `includes()` substring branches** (next case:
    // `includes('pdf')` vs `includes('plain')`). This assertion itself still valid and real
    // (pins "docling variant not misparsed as md"), just shouldn't be evidence of
    // "order-sensitive" — this phrasing registered in report as brief correction.
    expect(kindFromMime('text/markdown+docling/pdf')).toBe('pdf')
    expect(kindFromMime('text/markdown+docling/pdf')).not.toBe('md')
  })

  it('🔴 True semantic order-sensitive place: between two `includes()` substring branches ("pdf" and "plain" present simultaneously, first-come-first-served)', () => {
    // Criterion (RED probe in report): move `includes('plain')` before `includes('pdf')` →
    // this assertion must red (becomes 'txt'). This input purely constructed to distinguish
    // "order-sensitive vs insensitive" two branches (doesn't represent any real backend mime,
    // real-device mime distribution see F9 §2③).
    expect(kindFromMime('text/plain;pdf-scan')).toBe('pdf')
    expect(kindFromMime('text/plain;pdf-scan')).not.toBe('txt')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// basename / dirname — blueprint :14-23, boundaries: empty string / no slash /
// trailing slash / root path / multiple slashes
// ═══════════════════════════════════════════════════════════════════════════
describe('basename — blueprint :14-17', () => {
  it('Empty string → ""', () => {
    expect(basename('')).toBe('')
  })
  it('null/undefined → ""', () => {
    expect(basename(null)).toBe('')
    expect(basename(undefined)).toBe('')
  })
  it('No slash → returned as-is', () => {
    expect(basename('a.md')).toBe('a.md')
  })
  it('Normal path → get last segment', () => {
    expect(basename('/DATA/Downloads/a.pdf')).toBe('a.pdf')
  })
  it('Trailing slash → get last non-empty segment (trailing empty discarded by filter(Boolean))', () => {
    expect(basename('/a/b/')).toBe('b')
  })
  it('Root path "/" → pop() falls through, fallback returns original input "/"', () => {
    expect(basename('/')).toBe('/')
  })
  it('Multiple slashes → filter(Boolean) removes empty, get last segment', () => {
    expect(basename('a/b//c')).toBe('c')
  })
})

describe('dirname — blueprint :19-23', () => {
  it('Empty string → ""', () => {
    expect(dirname('')).toBe('')
  })
  it('null/undefined → ""', () => {
    expect(dirname(null)).toBe('')
    expect(dirname(undefined)).toBe('')
  })
  it('🔴 No slash dirname("b.md") = "/"', () => {
    expect(dirname('b.md')).toBe('/')
  })
  it('🔴 Normal path dirname("/a/b.md") = "/a/" (with trailing slash)', () => {
    expect(dirname('/a/b.md')).toBe('/a/')
  })
  it('Trailing slash input dirname("/a/b/") = "/a/"', () => {
    expect(dirname('/a/b/')).toBe('/a/')
  })
  it('Root path dirname("/") = "/"', () => {
    expect(dirname('/')).toBe('/')
  })
  it('Multiple slashes dirname("a/b//c") = "/a/b/"', () => {
    expect(dirname('a/b//c')).toBe('/a/b/')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Real F5b data (see fixture discipline explanation in file header)
// ═══════════════════════════════════════════════════════════════════════════

/** From F5b `files[0].chunks[0].preview.text`, zero-truncated, sha256 in file header. */
const FIRST_CHUNK_FULL_TEXT =
  '{"log":"/usr/share/nimoos/agent/main.py:201: DeprecationWarning: \\n","stream":"stderr","time":"2026-07-18T07:59:48.738908774Z"}\n{"log":"        on_event is deprecated, use lifespan event handlers instead.\\n","stream":"stderr","time":"2026-07-18T07:59:48.738952219Z"}\n{"log":"\\n","stream":"stderr","time":"2026-07-18T07:59:48.738954927Z"}\n{"log":"        Read more about it in the\\n","stream":"stderr","time":"2026-07-18T07:59:48.738956078Z"}\n{"log":"        [FastAPI docs for Lifespan Events](https://fastapi.tiangolo.com/advanced/events/).\\n","stream":"stderr","time":"2026-07-18T07:59:48.738957126Z"}\n{"log":"        \\n","stream":"stderr","time":"2026-07-18T07:59:48.738958158Z"}\n{"log":"  @app.on_event(\\"startup\\")\\n","stream":"stderr","time":"2026-07-18T07:59:48.738959023Z"}\n{"log":"/usr/share/nimoos/agent/main.py:206: DeprecationWarning: \\n","stream":"stderr","time":"2026-07-18T07:59:48.738960073Z"}\n{"log":"        on_event is deprecated, use lifespan event handlers instead.\\n","stream":"stderr","time":"2026-07-18T07:59:48.738961049Z"}\n{"log":"\\n","stream":"stderr","time":"2026-07-18T07:59:48.738961974Z"}\n{"log":"        Read more about it in the\\n","stream":"stderr","time":"2026-07-18T07:59:48.738962812Z"}\n{"log":"        [FastAPI docs for Lifespan Events](https://fastapi.tiangolo.com/advanced/events/).\\n","stream":"stderr","time":"2026-07-18T07:59:48.73896371Z"}\n{"log":"        \\n","stream":"stderr","time":"2026-07-18T07:59:48.738964717Z"}\n{"log":"  @app.on_event(\\"shutdown\\")\\n","stream":"stderr","time":"2026-07-18T07:59:48.738965618Z"}\n{"log":"/usr/share/nimoos/agent/main.py:245: DeprecationWarning: \\n","stream":"stderr","time":"2026-07-18T07:59:48.749300591Z"}\n{"log":"        on_event is deprecated, use lifespan event handlers instead.\\n","stream":"stderr","time":"2026-07-18T07:59:48.749311192Z"}\n{"log":"\\n","stream":"stderr","time":"2026-07-18T07:59:48.749313156Z"}\n{"log":"        Read more about it in the\\n","stream":"stderr","time":"2026-07-18T07:59:48.749314262Z"}\n{"log":"        [FastAPI docs for Lifespan Events](https://fastapi.tiangolo.com/advanced/events/).\\n","stream":"stderr","time":"2026-07-18T07:59:48.749315267Z"}\n{"log":"        \\n","stream":"stderr","time":"2026-07-18T07:59:48.749316299Z"}\n{"log":"  @app.on_event(\\"startup\\")\\n","stream":"stderr","time":"2026-07-18T07:59:48.749317178Z"}'

/** F5b `files[0..1]`(4 文件里的前 2 个),preview.text 除 files[0].chunks[0] 外均截到前 50 字符。 */
const FILES_BRANCH_TWO_REAL_FILES = [
  {
    file_id: 'dce79e8ea5d48719cd4ad16fe48da843',
    paths: [
      {
        root_id: 'dfcd1840f5dab439cd9d7050aa5bafd0',
        path: '/DATA/.system_data/.docker/containers/26be4bc607290dbbc955a0f5f1f1317d7a5b55df87ccdd86e9987ca8440c7ea1/26be4bc607290dbbc955a0f5f1f1317d7a5b55df87ccdd86e9987ca8440c7ea1-json.log',
        mtime_ms: 1784424392240,
      },
    ],
    mime: 'text/plain',
    kind: 'body',
    score: 0.738,
    chunks: [
      {
        score: 0.738,
        file_id: 'dce79e8ea5d48719cd4ad16fe48da843',
        mime: 'text/plain',
        kind: 'body',
        cite: { page: null, offset_start: 0, offset_end: 2343, chunk_no: 0 },
        preview: { text: FIRST_CHUNK_FULL_TEXT, thumbnail_url: null },
      },
      {
        score: 0.7354,
        file_id: 'dce79e8ea5d48719cd4ad16fe48da843',
        mime: 'text/plain',
        kind: 'body',
        cite: { page: null, offset_start: 2023, offset_end: 4341, chunk_no: 1 },
        preview: { text: 'stAPI docs for Lifespan Events](https://fastapi.ti', thumbnail_url: null },
      },
    ],
  },
  {
    file_id: '05d732586959ea3f480b5feb4b0d17c8',
    paths: [{ root_id: 'dfcd1840f5dab439cd9d7050aa5bafd0', path: '/DATA/.system_data/log/nimoos/log.log', mtime_ms: 1784404128499 }],
    mime: 'text/plain',
    kind: 'body',
    score: 0.6118,
    chunks: [
      {
        score: 0.6118,
        file_id: '05d732586959ea3f480b5feb4b0d17c8',
        mime: 'text/plain',
        kind: 'body',
        cite: { page: null, offset_start: 0, offset_end: 2286, chunk_no: 0 },
        preview: { text: '2026-04-13T15:38:19.417-0400\tinfo\tInitPathConfig: ', thumbnail_url: null },
      },
      {
        score: 0.6002,
        file_id: '05d732586959ea3f480b5feb4b0d17c8',
        mime: 'text/plain',
        kind: 'body',
        cite: { page: null, offset_start: 1966, offset_end: 4328, chunk_no: 1 },
        preview: { text: 'nimoos/file/upload", "func": "route.InitV2Router",', thumbnail_url: null },
      },
    ],
  },
]

/**
 * F5b 的全部 8 条真实 `hits`(自然顺序,与 `files[]` 同源,同一批真数据),
 * preview.text 全部截到前 50 字符(FIRST_CHUNK_FULL_TEXT 的完整版已用在上面,
 * 本文件 R9 的「1-2 条完整正文」配额已用完,这里全部截断)。
 */
const HITS_ONLY_EIGHT_REAL_HITS = [
  { score: 0.738, file_id: 'dce79e8ea5d48719cd4ad16fe48da843', mime: 'text/plain', kind: 'body', cite: { page: null, chunk_no: 0 }, preview: { text: '{"log":"/usr/share/nimoos/agent/main.py:201: Depre', thumbnail_url: null }, paths: [{ path: '/DATA/.system_data/.docker/containers/26be.../26be...-json.log', mtime_ms: 1784424392240 }] },
  { score: 0.7354, file_id: 'dce79e8ea5d48719cd4ad16fe48da843', mime: 'text/plain', kind: 'body', cite: { page: null, chunk_no: 1 }, preview: { text: 'stAPI docs for Lifespan Events](https://fastapi.ti', thumbnail_url: null }, paths: [{ path: '/DATA/.system_data/.docker/containers/26be.../26be...-json.log', mtime_ms: 1784424392240 }] },
  { score: 0.6118, file_id: '05d732586959ea3f480b5feb4b0d17c8', mime: 'text/plain', kind: 'body', cite: { page: null, chunk_no: 0 }, preview: { text: '2026-04-13T15:38:19.417-0400\tinfo\tInitPathConfig: ', thumbnail_url: null }, paths: [{ path: '/DATA/.system_data/log/nimoos/log.log', mtime_ms: 1784404128499 }] },
  { score: 0.6002, file_id: '05d732586959ea3f480b5feb4b0d17c8', mime: 'text/plain', kind: 'body', cite: { page: null, chunk_no: 1 }, preview: { text: 'nimoos/file/upload", "func": "route.InitV2Router",', thumbnail_url: null }, paths: [{ path: '/DATA/.system_data/log/nimoos/log.log', mtime_ms: 1784404128499 }] },
  { score: 0.5127, file_id: 'e531767d0b917dfb86ea6c8451c4bf65', mime: 'text/plain', kind: 'body', cite: { page: null, chunk_no: 0 }, preview: { text: '{"log":"/usr/share/nimoos/agent/main.py:127: Depre', thumbnail_url: null }, paths: [{ path: '/DATA/.system_data/.docker/containers/9f4d.../9f4d...-json.log', mtime_ms: 1784359333549 }] },
  { score: 0.5044, file_id: 'e531767d0b917dfb86ea6c8451c4bf65', mime: 'text/plain', kind: 'body', cite: { page: null, chunk_no: 1 }, preview: { text: 'stdout","time":"2026-07-16T06:37:33.686913167Z"}\n{', thumbnail_url: null }, paths: [{ path: '/DATA/.system_data/.docker/containers/9f4d.../9f4d...-json.log', mtime_ms: 1784359333549 }] },
  { score: 0.4824, file_id: '4018267c2ec373cddb244ac220a06cc2', mime: 'text/plain', kind: 'body', cite: { page: null, chunk_no: 0 }, preview: { text: '2026-07-13T16:10:05.000+0800\terror\terror while upd', thumbnail_url: null }, paths: [{ path: '/DATA/.system_data/log/nimoos/app-management.log', mtime_ms: 1784434525914 }] },
  { score: 0.4666, file_id: '4018267c2ec373cddb244ac220a06cc2', mime: 'text/plain', kind: 'body', cite: { page: null, chunk_no: 1 }, preview: { text: 'ce/appstore_management.go", "line": 442}\n2026-07-1', thumbnail_url: null }, paths: [{ path: '/DATA/.system_data/log/nimoos/app-management.log', mtime_ms: 1784434525914 }] },
]

/**
 * 同一批真实数据(4 个文件各取第一个 chunk),但**人为调换顺序**成
 * `[4018267c(最低分), dce79e8e(最高分), 05d732586, e531767d]` —— 每个字段值仍是
 * F5b 的真实记录,只是数组元素顺序被重排,目的是把「保留响应顺序」与
 * 「按 score 重排」这两个假设区分开(若实现改成按 score 排序,这组输入的期望顺序
 * 会与本用例断言的顺序不同 → 报红)。
 */
const REORDERED_FOUR_REAL_HITS = [
  HITS_ONLY_EIGHT_REAL_HITS[6], // 4018267c..., score 0.4824(全局最低分组)
  HITS_ONLY_EIGHT_REAL_HITS[0], // dce79e8e..., score 0.738(全局最高分组)
  HITS_ONLY_EIGHT_REAL_HITS[2], // 05d732586..., score 0.6118
  HITS_ONLY_EIGHT_REAL_HITS[4], // e531767d..., score 0.5127
]

function asResp(x: unknown): SearchTextResponseRaw {
  return x as SearchTextResponseRaw
}

// ═══════════════════════════════════════════════════════════════════════════
// toFileResults — N45 三件事各自独立用例
// ═══════════════════════════════════════════════════════════════════════════
describe('toFileResults — N45(1)resp.files 优先', () => {
  it('resp 为 null/undefined → 空数组', () => {
    expect(toFileResults(null)).toEqual([])
    expect(toFileResults(undefined)).toEqual([])
  })

  it('🔴 files 非空且与 hits 内容不同(负控):必须走 files 分支,不消费 hits', () => {
    const resp = asResp({
      files: FILES_BRANCH_TWO_REAL_FILES,
      // 故意放一条与 files 完全不相关的假记录当负控 —— 只用来证明"没被消费",
      // 不代表任何真实后端行为。
      hits: [{ file_id: 'ZZZZ-must-not-appear', mime: 'text/plain', kind: 'body', score: 0.99, cite: { chunk_no: 0, page: null }, preview: { text: 'x' } }],
    })
    const out = toFileResults(resp)
    expect(out).toHaveLength(2)
    expect(out.map((f) => f.id)).toEqual(['dce79e8ea5d48719cd4ad16fe48da843', '05d732586959ea3f480b5feb4b0d17c8'])
    expect(out.map((f) => f.id)).not.toContain('ZZZZ-must-not-appear')
  })

  it('files 字段是空数组(长度 0)→ 视为不存在,兜底 groupHits(hits)', () => {
    const resp = asResp({ files: [], hits: HITS_ONLY_EIGHT_REAL_HITS })
    const out = toFileResults(resp)
    expect(out).toHaveLength(4)
  })

  it('files 字段第一条:字段级映射逐个核对(承接 Vue2 spec 用例 1,承 K1 单层取数)', () => {
    const out = toFileResults(asResp({ files: FILES_BRANCH_TWO_REAL_FILES }))
    const f = out[0]
    expect(f.id).toBe('dce79e8ea5d48719cd4ad16fe48da843')
    expect(f.name).toBe('26be4bc607290dbbc955a0f5f1f1317d7a5b55df87ccdd86e9987ca8440c7ea1-json.log')
    expect(f.path).toBe('/DATA/.system_data/.docker/containers/26be4bc607290dbbc955a0f5f1f1317d7a5b55df87ccdd86e9987ca8440c7ea1/')
    expect(f.kind).toBe('txt')
    expect(f.mtimeMs).toBe(1784424392240)
    expect(f.score).toBe(0.738)
    expect(f.chunks).toHaveLength(2)
    expect(f.chunks[0]).toMatchObject({ chunkNo: 0, page: null, score: 0.738, snippet: FIRST_CHUNK_FULL_TEXT })
    expect(f.chunks[0].id).toBe('dce79e8ea5d48719cd4ad16fe48da843:body:0')
  })

  it('🔴 preview.text 原样透传,不截断(与真实字段长度 2342 一致)', () => {
    const out = toFileResults(asResp({ files: FILES_BRANCH_TWO_REAL_FILES }))
    expect(out[0].chunks[0].snippet).toHaveLength(2342)
    expect(out[0].chunks[0].snippet).toBe(FIRST_CHUNK_FULL_TEXT)
  })
})

describe('toFileResults — N45(2)groupHits 保序', () => {
  it('files 缺席 → 兜底 groupHits(hits),4 个文件按 hits 首次出现顺序分组(自然顺序,来自真实 F5b)', () => {
    const out = toFileResults(asResp({ hits: HITS_ONLY_EIGHT_REAL_HITS }))
    expect(out).toHaveLength(4)
    expect(out.map((f) => f.id)).toEqual([
      'dce79e8ea5d48719cd4ad16fe48da843',
      '05d732586959ea3f480b5feb4b0d17c8',
      'e531767d0b917dfb86ea6c8451c4bf65',
      '4018267c2ec373cddb244ac220a06cc2',
    ])
    // 每组的 chunks 数与真实数据一致(每文件 2 chunk)
    out.forEach((f) => expect(f.chunks).toHaveLength(2))
  })

  it('🔴 保序而非按 score 重排:人为打乱的 4 条真实记录,输出顺序必须等于打乱后的 hits 顺序', () => {
    // 判据:若实现被改成按 score 降序重排,期望顺序会变成
    // [dce79e8e(0.738), 05d732586(0.6118), e531767d(0.5127), 4018267c(0.4824)],
    // 与本条断言的顺序不同 → 报红。
    const out = toFileResults(asResp({ hits: REORDERED_FOUR_REAL_HITS }))
    expect(out.map((f) => f.id)).toEqual([
      '4018267c2ec373cddb244ac220a06cc2',
      'dce79e8ea5d48719cd4ad16fe48da843',
      '05d732586959ea3f480b5feb4b0d17c8',
      'e531767d0b917dfb86ea6c8451c4bf65',
    ])
  })

  it('hits 为空数组 → 空结果', () => {
    expect(toFileResults(asResp({ hits: [] }))).toEqual([])
  })

  it('resp 完全没有 hits 键(且没有 files)→ groupHits([]) → 空结果', () => {
    expect(toFileResults(asResp({}))).toEqual([])
  })
})

describe('toFileResults — N45(3)fileVM.score 三档:group.score || 首 chunk.score || 0', () => {
  it('档 1 — group.score 存在(真实数据,files 分支)→ 直接取 group.score', () => {
    const out = toFileResults(asResp({ files: FILES_BRANCH_TWO_REAL_FILES }))
    expect(out[0].score).toBe(0.738)
  })

  it('档 1(变体)— groupHits 场景下 group.score 来自"首个命中该 file_id 的 chunk"(承接 Vue2 spec 用例 2 的 "best chunk" 断言)', () => {
    // groupHits() 构造分组对象时 `score: h.score` 只在**第一次**见到该 file_id 时写入
    // (见 searchAggregate.ts groupHits 注释),之后命中同一 file_id 的 chunk 不会覆盖它。
    const out = toFileResults(asResp({ hits: HITS_ONLY_EIGHT_REAL_HITS }))
    // dce79e8e... 组第一条命中是 chunk_no 0(score 0.738),第二条 chunk_no 1(score 0.7354)更低分 —
    // 若代码错误地取"最高分"而不是"第一条",这里仍会是 0.738(本例不可区分,故档 2/档 3 单独构造)。
    expect(out[0].score).toBe(0.738) // best/first chunk,与蓝本 spec 的 `// best chunk` 注释一致
  })

  // ═════ 【P5e-T4 新增,裁定 R21】补 T3 评审 Important-1 的覆盖缺口 ═════
  // 事实(T3 评审自加探针 #7 实证):把 groupHits 的"取首 chunk 的 score"改成
  // "取最高分 chunk 的 score" → 上面那条"档 1(变体)"用例(以及全部 74 条既有用例)
  // 74/74 全绿,零判别力 —— 根因是 F5b 真实数据里"首 chunk 恰好就是最高分"
  // (上一条用例自己的注释也承认"本例不可区分")。产品代码本身正确(忠实移植蓝本
  // groupHits:`score: h.score` 只在第一次见到该 file_id 时写入),这是纯覆盖缺口。
  // 🔴 构造样本(D-6 模具,不代表真机取值):两个 chunk 命中同一 file_id,
  // **首条 score(0.5)显式低于**第二条(0.9)—— 若实现被改成"取最高分",这里
  // 会变成 0.9,而不是断言的 0.5。
  it('🔴 档 1(变体·构造样本)— 首 chunk 分数低于后续 chunk 时,fileVM.score 仍取首 chunk(判据:实现改成"取最高分" → 必须报红)', () => {
    const resp = asResp({
      hits: [
        { file_id: 'r21-ctor', mime: 'text/plain', kind: 'body', score: 0.5, cite: { chunk_no: 0, page: null }, preview: { text: 'first, lower score' }, paths: [{ path: '/x/r21.txt', mtime_ms: 1 }] },
        { file_id: 'r21-ctor', mime: 'text/plain', kind: 'body', score: 0.9, cite: { chunk_no: 1, page: null }, preview: { text: 'second, higher score' } },
      ],
    })
    const out = toFileResults(resp)
    expect(out).toHaveLength(1)
    expect(out[0].score).toBe(0.5)
    expect(out[0].score).not.toBe(0.9)
  })

  it('档 2 — group.score 缺失(未定义)→ 兜底取 chunks[0].score(构造样本,真实数据的 files[] 恒带 score,无法自然触发这一档)', () => {
    const resp = asResp({
      files: [
        {
          file_id: 'ctor-1',
          mime: 'text/plain',
          kind: 'body',
          paths: [{ path: '/x/y.txt', mtime_ms: 1 }],
          chunks: [{ file_id: 'ctor-1', score: 0.55, cite: { chunk_no: 0, page: null }, preview: { text: 't' } }],
          // 注意:没有 `score` 字段
        },
      ],
    })
    expect(toFileResults(resp)[0].score).toBe(0.55)
  })

  it('档 3 — group.score 与 chunks[0].score 都缺失 → 兜底 0(构造样本)', () => {
    const resp = asResp({
      files: [
        {
          file_id: 'ctor-2',
          mime: 'text/plain',
          kind: 'body',
          paths: [{ path: '/x/z.txt', mtime_ms: 1 }],
          chunks: [{ file_id: 'ctor-2', cite: { chunk_no: 0, page: null }, preview: { text: 't' } }],
          // 没有 `score`,chunks[0] 也没有 `score`
        },
      ],
    })
    expect(toFileResults(resp)[0].score).toBe(0)
  })

  it('档 3(变体)— chunks 数组为空 → 兜底 0', () => {
    const resp = asResp({
      files: [{ file_id: 'ctor-3', mime: 'text/plain', kind: 'body', paths: [{ path: '/x/w.txt', mtime_ms: 1 }], chunks: [] }],
    })
    expect(toFileResults(resp)[0].score).toBe(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// chunkVM 边界(通过 toFileResults 间接测试,蓝本自己也不导出 chunkVM)
// 🔴 【P5e-T4 顺手补,裁定 R21 · Minor-2 · R3 约束 1】本描述块下面全部用例的
// fixture(`oneChunkResp` 及其各次调用传入的 chunk 字面量:`cite` 缺失/`chunk_no`
// 非数字/`page` 缺失或显式 null/`preview.text` 缺失等)都是 **`.CONSTRUCTED`**
// (D-6 模具)—— 专为覆盖 chunkVM 各个兜底分支手写构造,不代表任何真机取值分布
// (真机 mime/字段分布见本文件其它 REPLAYED 出处的 F5b 用例)。原文缺这条出处标签,
// 按裁定 R3 约束 1(三级出处标签必须逐个写明)补上,只补注释,不动任何断言。
// ═══════════════════════════════════════════════════════════════════════════
describe('chunkVM 边界 — 蓝本 :25-36', () => {
  function oneChunkResp(chunk: Record<string, unknown>) {
    return asResp({
      files: [
        {
          file_id: 'fx',
          mime: 'text/plain',
          kind: 'body',
          score: 1,
          paths: [{ path: '/x/y.txt', mtime_ms: 1 }],
          chunks: [chunk],
        },
      ],
    })
  }

  it('cite 整个缺失 → chunkNo 兜 0、page 兜 null、id = "fx:body:0"', () => {
    const c = toFileResults(oneChunkResp({ score: 0.5, preview: { text: 'hi' } }))[0].chunks[0]
    expect(c.chunkNo).toBe(0)
    expect(c.page).toBeNull()
    expect(c.id).toBe('fx:body:0')
  })

  it('cite.chunk_no 非数字(字符串 "3")→ typeof 判断失败,兜底 0', () => {
    const c = toFileResults(oneChunkResp({ score: 0.5, cite: { chunk_no: '3', page: null }, preview: { text: 'hi' } }))[0].chunks[0]
    expect(c.chunkNo).toBe(0)
    expect(c.id).toBe('fx:body:0')
  })

  it('cite.page 缺失(键都没有)→ page 结果为 null', () => {
    const c = toFileResults(oneChunkResp({ score: 0.5, cite: { chunk_no: 1 }, preview: { text: 'hi' } }))[0].chunks[0]
    expect(c.page).toBeNull()
  })

  it('cite.page 显式 null → page 结果为 null', () => {
    const c = toFileResults(oneChunkResp({ score: 0.5, cite: { chunk_no: 1, page: null }, preview: { text: 'hi' } }))[0].chunks[0]
    expect(c.page).toBeNull()
  })

  it('🔴 cite.page = 0(合法页号)→ 必须原样保留为 0,不能被当假值兜成 null', () => {
    const c = toFileResults(oneChunkResp({ score: 0.5, cite: { chunk_no: 5, page: 0 }, preview: { text: 'hi' } }))[0].chunks[0]
    expect(c.page).toBe(0)
    expect(c.page).not.toBeNull()
  })

  it('cite.page = 12(普通正整数)→ 原样保留', () => {
    const c = toFileResults(oneChunkResp({ score: 0.5, cite: { chunk_no: 5, page: 12 }, preview: { text: 'hi' } }))[0].chunks[0]
    expect(c.page).toBe(12)
  })

  it('preview.text 缺失(preview 对象存在但没有 text 键)→ snippet 兜底 ""', () => {
    const c = toFileResults(oneChunkResp({ score: 0.5, cite: { chunk_no: 0, page: null }, preview: {} }))[0].chunks[0]
    expect(c.snippet).toBe('')
  })

  it('preview 整个缺失 → snippet 兜底 ""', () => {
    const c = toFileResults(oneChunkResp({ score: 0.5, cite: { chunk_no: 0, page: null } }))[0].chunks[0]
    expect(c.snippet).toBe('')
  })

  it('kind 缺失 → 兜底 "body"', () => {
    const c = toFileResults(oneChunkResp({ score: 0.5, cite: { chunk_no: 2, page: null }, preview: { text: 'hi' } }))[0].chunks[0]
    expect(c.kind).toBe('body')
  })

  it('score 缺失 → 兜底 0', () => {
    const c = toFileResults(oneChunkResp({ cite: { chunk_no: 0, page: null }, preview: { text: 'hi' } }))[0].chunks[0]
    expect(c.score).toBe(0)
  })

  it('🔴 id 拼法精确为 `${fileId}:${kind}:${chunkNo}`(它是 FileDetailDrawer 的 activeId 比对键)', () => {
    const c = toFileResults(oneChunkResp({ score: 0.9, kind: 'title', cite: { chunk_no: 42, page: null }, preview: { text: 'hi' } }))[0].chunks[0]
    expect(c.id).toBe('fx:title:42')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// chunkCount —— 蓝本 :74-76
// ═══════════════════════════════════════════════════════════════════════════
describe('chunkCount — 蓝本 :74-76', () => {
  it('空结果 → 0', () => {
    expect(chunkCount([])).toBe(0)
  })

  it('多文件多 chunk 累加(真实 F5b 数据:4 文件 × 2 chunk = 8)', () => {
    const out = toFileResults(asResp({ hits: HITS_ONLY_EIGHT_REAL_HITS }))
    expect(chunkCount(out)).toBe(8)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 K49 —— highlight() 本期唯一 XSS 面:先 escape 再插 <mark>
// ═══════════════════════════════════════════════════════════════════════════
describe('highlight — K49 XSS 注入用例', () => {
  it('空文本 → 空字符串(不管 query 是什么)', () => {
    expect(highlight('', 'x')).toBe('')
    expect(highlight(null, 'x')).toBe('')
    expect(highlight(undefined, 'x')).toBe('')
  })

  it('空 query(空字符串)→ 原样返回 escape 后的文本,不含 <mark>', () => {
    expect(highlight('hello & world', '')).toBe('hello &amp; world')
  })

  it('空 query(全空白)→ 同上', () => {
    expect(highlight('hello world', '   ')).toBe('hello world')
  })

  it('🔴 <script> 注入:输出含 &lt;script&gt;、不含裸 "<script"、alert 被 <mark> 包住', () => {
    const out = highlight('<script>alert(1)</script>', 'alert')
    expect(out).toBe('&lt;script&gt;<mark>alert</mark>(1)&lt;/script&gt;')
    expect(out).toContain('&lt;script&gt;')
    expect(out).not.toContain('<script')
    expect(out).toContain('<mark>alert</mark>')
  })

  it('🔴 <img onerror> 注入:输出含 &lt;img、不含裸 "<img"、onerror 被 <mark> 包住', () => {
    const out = highlight('<img src=x onerror=1>', 'onerror')
    expect(out).toBe('&lt;img src=x <mark>onerror</mark>=1&gt;')
    expect(out).toContain('&lt;img')
    expect(out).not.toContain('<img')
    expect(out).toContain('<mark>onerror</mark>')
  })

  it('引号也被转义(& < > " 四字符全覆盖)', () => {
    expect(highlight('a & b < c > d "e"', 'nomatch')).toBe('a &amp; b &lt; c &gt; d &quot;e&quot;')
  })

  it('正则元字符 query(`a.b*c`)不许抛异常,且按字面量转义后原样匹配', () => {
    expect(() => highlight('abc', 'a.b*c')).not.toThrow()
    // "a.b*c" 转义后是字面量 "a\.b\*c",在 "abc" 里找不到这个字面量子串 → 不高亮
    expect(highlight('abc', 'a.b*c')).toBe('abc')
    // 但确实能匹配含字面量 "a.b*c" 的文本
    expect(highlight('xx a.b*c yy', 'a.b*c')).toBe('xx <mark>a.b*c</mark> yy')
  })

  it('多词 query,大小写不敏感,各自独立高亮', () => {
    expect(highlight('Hello World', 'hello world')).toBe('<mark>Hello</mark> <mark>World</mark>')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// fmtMtime —— 治理 §9.13:毫秒/时区
// ═══════════════════════════════════════════════════════════════════════════
describe('fmtMtime — 治理 §9.13', () => {
  it('0 → "—"', () => {
    expect(fmtMtime(0)).toBe('—')
  })
  it('null/undefined → "—"', () => {
    expect(fmtMtime(null)).toBe('—')
    expect(fmtMtime(undefined)).toBe('—')
  })

  it('🔴 真实毫秒值(F5b paths[0].mtime_ms=1784424392240)→ 与"同式比对"结果一致(TZ 安全,不裸钉字符串)', () => {
    const ms = 1784424392240
    const d = new Date(ms)
    const expected = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    expect(fmtMtime(ms)).toBe(expected)
  })

  it('🔴 毫秒 vs 秒:同一个真实时间戳,若被当成"秒"误传(数值上等于 ms/1000),会得到明显错误的 1970 年代日期,而不是正确的 ms 解读结果', () => {
    const realMs = 1784424392240
    const mistakenlyPassedAsSeconds = Math.floor(realMs / 1000) // 1784424392 —— 若调用方误把 unix 秒当 ms 传入
    const correct = fmtMtime(realMs)
    const wrong = fmtMtime(mistakenlyPassedAsSeconds)
    expect(correct).not.toBe(wrong)
    // 判据(报告贴 RED 探针):把生产代码 `new Date(ms)` 改成 `new Date(ms * 1000)`,
    // 上面那条"真实毫秒值"用例必须报红(fmtMtime(realMs) 不再等于当前 TZ 下 new Date(realMs) 的同式结果)。
  })

  it('负数 / NaN 均不抛异常', () => {
    expect(() => fmtMtime(-1)).not.toThrow()
    expect(() => fmtMtime(NaN)).not.toThrow()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// relLevel / relLabel —— 三档 + 两个边界两侧 + i18n 键
// ═══════════════════════════════════════════════════════════════════════════
describe('relLevel — 三档边界', () => {
  it('0.65 边界:恰好 0.65 → high,0.65 之下一点 → mid', () => {
    expect(relLevel(0.65)).toBe('high')
    expect(relLevel(0.649999)).toBe('mid')
  })
  it('0.50 边界:恰好 0.50 → mid,0.50 之下一点 → low', () => {
    expect(relLevel(0.5)).toBe('mid')
    expect(relLevel(0.499999)).toBe('low')
  })
  it('明显高 / 明显低的两端', () => {
    expect(relLevel(0.9)).toBe('high')
    expect(relLevel(0.1)).toBe('low')
  })
  it('真机 score 区间(0.4666–0.7380,见 F9 §2⑥)三档均可达', () => {
    expect(relLevel(0.738)).toBe('high')
    expect(relLevel(0.6118)).toBe('mid')
    expect(relLevel(0.4666)).toBe('low')
  })
})

describe('relLabel — 三档边界 + i18n 键(🔴 aiKbSrRelHigh/Mid/Low,不是通用 High/Mid/Low)', () => {
  it('zh 档:三档中文文案', () => {
    expect(relLabel(0.65)).toBe('高')
    expect(relLabel(0.5)).toBe('中')
    expect(relLabel(0.1)).toBe('低')
  })

  it('两个边界两侧(zh 档)', () => {
    expect(relLabel(0.649999)).toBe('中')
    expect(relLabel(0.499999)).toBe('低')
  })

  it('🔴 en 档:三档英文文案,证明键真的接在 i18n 上而不是硬编码中文(承 P5d 先例,须 try/finally 复原全局 locale)', () => {
    const localeRef = i18n.global.locale as unknown as { value: string }
    const prev = localeRef.value
    localeRef.value = 'en_us'
    try {
      expect(relLabel(0.9)).toBe('High')
      expect(relLabel(0.5)).toBe('Mid')
      expect(relLabel(0.1)).toBe('Low')
    } finally {
      localeRef.value = prev
    }
  })

  it('渲染值直接来自 aiKbSrRelHigh/Mid/Low 键(与全局 i18n.global.t 结果逐字一致)', () => {
    expect(relLabel(0.9)).toBe(i18n.global.t('aiKbSrRelHigh'))
    expect(relLabel(0.5)).toBe(i18n.global.t('aiKbSrRelMid'))
    expect(relLabel(0.1)).toBe(i18n.global.t('aiKbSrRelLow'))
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// fileVM.name 兜底 —— i18n.global.t('aiKbSrUntitled')(基名解析失败时)
// ═══════════════════════════════════════════════════════════════════════════
describe('fileVM.name 兜底 — aiKbSrUntitled', () => {
  it('fullPath 解析出的 basename 为空(paths 缺席)→ name 落到 i18n 的 (Untitled) 文案', () => {
    const resp = asResp({
      files: [{ file_id: 'no-path', mime: 'text/plain', kind: 'body', score: 0.5, chunks: [] }],
    })
    const out = toFileResults(resp)
    expect(out[0].name).toBe(i18n.global.t('aiKbSrUntitled'))
    expect(out[0].name).toBe('(未命名)')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 SP8-P5f Task 1b —— 债务 M-2(P5e 终审 Minor-2)的补漏块
//
// P5e 终审实测:`highlight()` 里 `terms` 的最小长度门**零守卫** —— 把它收紧成
// `s.length >= 2`,3125 例全绿(终审探针 F6),而后果是**所有单字查询彻底不高亮**
// (中文里「税」「猫」这类单字查询是高发形态)。
//
// 🔴 本块**只加断言,产品码一行未动** —— `searchAggregate.ts` 的
// `.filter((s) => s.length >= 1)` 经 P5e 终审对蓝本 `bp-SearchView.vue:332` 逐字核为
// **正确**。
//
// 本刀自己回读产品码确认的真实判据(未照抄 brief 的 `>= 1` 字面):
//   `String(query).trim().split(/\s+/).filter((s) => s.length >= 1)`
//   ⇒ 门槛 = **每个 term 的字符长度 ≥ 1**,即「只要非空就参与高亮」。
//   ⚠️ `trim()` 之后 `split(/\s+/)` 在非空串上**永远不会**产出空串,唯一能产出空串的
//   输入是空/全空白 query(`''.split(/\s+/) === ['']`)⇒ 「差一个字符 = 长度 0」这一侧
//   只能通过空/全空白 query 到达(下方两条已覆盖,也是 K49 块既有断言的另一表述)。
//
// 判据(RED 探针,见 p5f-task-1b-report.md):把门槛改成 `>= 2` → 本块必须报红。
// ⚠️ 相反方向(改成 `>= 0`)由 K49 块既有的「空 query → 原样返回」两条捕获:
//   `>= 0` 会让空串 term 进入 `new RegExp('', 'gi')`,在每个字符间插入 `<mark></mark>`。
// ═══════════════════════════════════════════════════════════════════════════

describe('highlight — 债务 M-2:term 最小长度门(门槛两侧各一条)', () => {
  // ─── 门槛侧:长度**恰好 1** 的 term 必须参与高亮 ───
  it('🔴 单字中文 query(长度 1)→ 必须高亮(门槛收紧成 >= 2 即报红)', () => {
    expect(highlight('个人所得税申报表', '税')).toBe('个人所得<mark>税</mark>申报表')
  })

  it('🔴 单字符 ASCII query(长度 1)→ 必须高亮', () => {
    expect(highlight('a b c', 'b')).toBe('a <mark>b</mark> c')
  })

  it('🔴 多词 query 里混着一个单字 term → 长短两个 term 都要高亮(不许只留长的)', () => {
    expect(highlight('猫 咖啡馆', '猫 咖啡馆')).toBe('<mark>猫</mark> <mark>咖啡馆</mark>')
  })

  // ─── 门槛下一侧:长度 0 的 term 一个都不许进正则 ───
  // (与 K49 块的「空 query」两条同判据、不同措辞 —— 这里显式写成「长度门的下一侧」,
  //  让门槛的两侧在同一个 describe 里成对可读;不改动、不放宽 K49 那两条。)
  it('空 query(长度 0 的唯一到达方式)→ 零 <mark>,原样返回 escape 后的文本', () => {
    const out = highlight('个人所得税申报表', '')
    expect(out).toBe('个人所得税申报表')
    expect(out).not.toContain('<mark>')
  })

  it('全空白 query(trim 后长度 0)→ 零 <mark>', () => {
    const out = highlight('个人所得税申报表', ' \t \n ')
    expect(out).not.toContain('<mark>')
  })

  // 防「门槛被写死成常量真」:长度 1 的 term 走的是同一条 filter,与长 term 行为一致。
  it('长度 1 与长度 3 的 term 在同一份文本上行为一致(证明判据是长度门,不是特例分支)', () => {
    expect(highlight('所得税', '所')).toBe('<mark>所</mark>得税')
    expect(highlight('所得税', '所得税')).toBe('<mark>所得税</mark>')
  })
})
