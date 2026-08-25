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

/** F5b `files[0..1]` (first 2 of the 4 files); preview.text is truncated to the first 50 chars except for files[0].chunks[0]. */
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
 * All 8 real `hits` from F5b (natural order, same source and same batch of real data as
 * `files[]`); preview.text is truncated to the first 50 chars throughout (the full version
 * of FIRST_CHUNK_FULL_TEXT was already used above — this file's R9 quota of "1-2 full-text
 * entries" is spent, so everything here is truncated).
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
 * Same batch of real data (first chunk of each of the 4 files), but **artificially
 * reordered** to `[4018267c (lowest score), dce79e8e (highest score), 05d732586, e531767d]`
 * — every field value is still a real F5b record, only the array element order is shuffled.
 * The point is to distinguish the "preserve response order" hypothesis from the "reorder by
 * score" hypothesis (if the implementation were changed to sort by score, the expected
 * order for this input would differ from what this test asserts → it would go red).
 */
const REORDERED_FOUR_REAL_HITS = [
  HITS_ONLY_EIGHT_REAL_HITS[6], // 4018267c..., score 0.4824 (globally lowest-scoring group)
  HITS_ONLY_EIGHT_REAL_HITS[0], // dce79e8e..., score 0.738 (globally highest-scoring group)
  HITS_ONLY_EIGHT_REAL_HITS[2], // 05d732586..., score 0.6118
  HITS_ONLY_EIGHT_REAL_HITS[4], // e531767d..., score 0.5127
]

function asResp(x: unknown): SearchTextResponseRaw {
  return x as SearchTextResponseRaw
}

// ═══════════════════════════════════════════════════════════════════════════
// toFileResults — N45's three things, each an independent test case
// ═══════════════════════════════════════════════════════════════════════════
describe('toFileResults — N45(1) resp.files takes priority', () => {
  it('resp is null/undefined → empty array', () => {
    expect(toFileResults(null)).toEqual([])
    expect(toFileResults(undefined)).toEqual([])
  })

  it('🔴 files non-empty and different from hits content (negative control): must take the files branch and not consume hits', () => {
    const resp = asResp({
      files: FILES_BRANCH_TWO_REAL_FILES,
      // Deliberately include a fake record unrelated to files as a negative control — only
      // to prove it "wasn't consumed", not representative of any real backend behavior.
      hits: [{ file_id: 'ZZZZ-must-not-appear', mime: 'text/plain', kind: 'body', score: 0.99, cite: { chunk_no: 0, page: null }, preview: { text: 'x' } }],
    })
    const out = toFileResults(resp)
    expect(out).toHaveLength(2)
    expect(out.map((f) => f.id)).toEqual(['dce79e8ea5d48719cd4ad16fe48da843', '05d732586959ea3f480b5feb4b0d17c8'])
    expect(out.map((f) => f.id)).not.toContain('ZZZZ-must-not-appear')
  })

  it('files field is an empty array (length 0) → treated as absent, falls back to groupHits(hits)', () => {
    const resp = asResp({ files: [], hits: HITS_ONLY_EIGHT_REAL_HITS })
    const out = toFileResults(resp)
    expect(out).toHaveLength(4)
  })

  it('files field, first entry: check field-level mapping one by one (inherits Vue2 spec case 1, and K1 single-level data extraction)', () => {
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

  it('🔴 preview.text passes through unchanged, not truncated (matches the real field length of 2342)', () => {
    const out = toFileResults(asResp({ files: FILES_BRANCH_TWO_REAL_FILES }))
    expect(out[0].chunks[0].snippet).toHaveLength(2342)
    expect(out[0].chunks[0].snippet).toBe(FIRST_CHUNK_FULL_TEXT)
  })
})

describe('toFileResults — N45(2) groupHits preserves order', () => {
  it("files absent → falls back to groupHits(hits); 4 files grouped in hits' first-occurrence order (natural order, from real F5b data)", () => {
    const out = toFileResults(asResp({ hits: HITS_ONLY_EIGHT_REAL_HITS }))
    expect(out).toHaveLength(4)
    expect(out.map((f) => f.id)).toEqual([
      'dce79e8ea5d48719cd4ad16fe48da843',
      '05d732586959ea3f480b5feb4b0d17c8',
      'e531767d0b917dfb86ea6c8451c4bf65',
      '4018267c2ec373cddb244ac220a06cc2',
    ])
    // Each group's chunk count matches the real data (2 chunks per file)
    out.forEach((f) => expect(f.chunks).toHaveLength(2))
  })

  it('🔴 Preserves order rather than resorting by score: for 4 artificially shuffled real records, the output order must equal the shuffled hits order', () => {
    // Criterion: if the implementation were changed to resort in descending score order,
    // the expected order would become
    // [dce79e8e(0.738), 05d732586(0.6118), e531767d(0.5127), 4018267c(0.4824)],
    // which differs from this assertion's order → would go red.
    const out = toFileResults(asResp({ hits: REORDERED_FOUR_REAL_HITS }))
    expect(out.map((f) => f.id)).toEqual([
      '4018267c2ec373cddb244ac220a06cc2',
      'dce79e8ea5d48719cd4ad16fe48da843',
      '05d732586959ea3f480b5feb4b0d17c8',
      'e531767d0b917dfb86ea6c8451c4bf65',
    ])
  })

  it('hits is an empty array → empty result', () => {
    expect(toFileResults(asResp({ hits: [] }))).toEqual([])
  })

  it('resp has no hits key at all (and no files) → groupHits([]) → empty result', () => {
    expect(toFileResults(asResp({}))).toEqual([])
  })
})

describe('toFileResults — N45(3) fileVM.score has three tiers: group.score || first chunk.score || 0', () => {
  it('Tier 1 — group.score exists (real data, files branch) → take group.score directly', () => {
    const out = toFileResults(asResp({ files: FILES_BRANCH_TWO_REAL_FILES }))
    expect(out[0].score).toBe(0.738)
  })

  it('Tier 1 (variant) — in the groupHits scenario, group.score comes from "the first chunk that hit this file_id" (inherits Vue2 spec case 2\'s "best chunk" assertion)', () => {
    // When groupHits() builds the group object, `score: h.score` is only written the
    // **first time** this file_id is seen (see the groupHits comment in searchAggregate.ts);
    // subsequent chunks hitting the same file_id do not overwrite it.
    const out = toFileResults(asResp({ hits: HITS_ONLY_EIGHT_REAL_HITS }))
    // The dce79e8e... group's first hit is chunk_no 0 (score 0.738); the second, chunk_no 1
    // (score 0.7354), is a lower score — if the code erroneously took the "highest score"
    // instead of "the first one", this would still be 0.738 (this case can't distinguish
    // the two, hence tiers 2/3 are constructed separately below).
    expect(out[0].score).toBe(0.738) // best/first chunk, consistent with the blueprint spec's `// best chunk` comment
  })

  // ═════ 【Added in P5e-T4, ruling R21】fills the coverage gap from T3 review Important-1 ═════
  // Fact (confirmed by an extra T3 review probe #7): changing groupHits' "take the first
  // chunk's score" to "take the highest-scoring chunk's score" left the "tier 1 (variant)"
  // case above (and all 74 existing cases) 74/74 green — zero discriminating power. The root
  // cause is that in the real F5b data, "the first chunk happens to also be the
  // highest-scoring one" (the previous case's own comment admits "this case can't
  // distinguish the two"). The production code itself is correct (faithfully ported from
  // the blueprint's groupHits: `score: h.score` is written only the first time a file_id is
  // seen) — this was purely a coverage gap.
  // 🔴 Constructed sample (D-6 mold, not representative of real-device values): two chunks
  // hit the same file_id, where **the first score (0.5) is explicitly lower** than the
  // second (0.9) — if the implementation were changed to "take the highest score", this
  // would become 0.9 instead of the asserted 0.5.
  it('🔴 Tier 1 (variant, constructed sample) — when the first chunk\'s score is lower than a later chunk\'s, fileVM.score still takes the first chunk (criterion: changing the implementation to "take the highest score" must go red)', () => {
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

  it("Tier 2 — group.score missing (undefined) → falls back to chunks[0].score (constructed sample; real data's files[] always carries score, so this tier can't be triggered naturally)", () => {
    const resp = asResp({
      files: [
        {
          file_id: 'ctor-1',
          mime: 'text/plain',
          kind: 'body',
          paths: [{ path: '/x/y.txt', mtime_ms: 1 }],
          chunks: [{ file_id: 'ctor-1', score: 0.55, cite: { chunk_no: 0, page: null }, preview: { text: 't' } }],
          // Note: no `score` field
        },
      ],
    })
    expect(toFileResults(resp)[0].score).toBe(0.55)
  })

  it('Tier 3 — both group.score and chunks[0].score are missing → falls back to 0 (constructed sample)', () => {
    const resp = asResp({
      files: [
        {
          file_id: 'ctor-2',
          mime: 'text/plain',
          kind: 'body',
          paths: [{ path: '/x/z.txt', mtime_ms: 1 }],
          chunks: [{ file_id: 'ctor-2', cite: { chunk_no: 0, page: null }, preview: { text: 't' } }],
          // No `score`, and chunks[0] has no `score` either
        },
      ],
    })
    expect(toFileResults(resp)[0].score).toBe(0)
  })

  it('Tier 3 (variant) — chunks array is empty → falls back to 0', () => {
    const resp = asResp({
      files: [{ file_id: 'ctor-3', mime: 'text/plain', kind: 'body', paths: [{ path: '/x/w.txt', mtime_ms: 1 }], chunks: [] }],
    })
    expect(toFileResults(resp)[0].score).toBe(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// chunkVM boundaries (tested indirectly through toFileResults; the blueprint itself doesn't
// export chunkVM either)
// 🔴 【Added in passing in P5e-T4, ruling R21 · Minor-2 · R3 constraint 1】All test cases
// below this describe block use fixtures (`oneChunkResp` and the chunk literals passed to
// each call: missing `cite` / non-numeric `chunk_no` / missing or explicit-null `page` /
// missing `preview.text`, etc.) that are all **`.CONSTRUCTED`** (D-6 mold) — hand-built
// specifically to cover chunkVM's various fallback branches, not representative of any
// real-device value distribution (see this file's other REPLAYED-sourced F5b cases for
// real-device mime/field distribution). The original text was missing this provenance
// label; added per ruling R3 constraint 1 (three-tier provenance labels must be spelled out
// individually) — comment-only, no assertions touched.
// ═══════════════════════════════════════════════════════════════════════════
describe('chunkVM boundaries — blueprint :25-36', () => {
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

  it('cite entirely missing → chunkNo falls back to 0, page falls back to null, id = "fx:body:0"', () => {
    const c = toFileResults(oneChunkResp({ score: 0.5, preview: { text: 'hi' } }))[0].chunks[0]
    expect(c.chunkNo).toBe(0)
    expect(c.page).toBeNull()
    expect(c.id).toBe('fx:body:0')
  })

  it('cite.chunk_no is non-numeric (string "3") → typeof check fails, falls back to 0', () => {
    const c = toFileResults(oneChunkResp({ score: 0.5, cite: { chunk_no: '3', page: null }, preview: { text: 'hi' } }))[0].chunks[0]
    expect(c.chunkNo).toBe(0)
    expect(c.id).toBe('fx:body:0')
  })

  it('cite.page missing (key not present at all) → page result is null', () => {
    const c = toFileResults(oneChunkResp({ score: 0.5, cite: { chunk_no: 1 }, preview: { text: 'hi' } }))[0].chunks[0]
    expect(c.page).toBeNull()
  })

  it('cite.page explicitly null → page result is null', () => {
    const c = toFileResults(oneChunkResp({ score: 0.5, cite: { chunk_no: 1, page: null }, preview: { text: 'hi' } }))[0].chunks[0]
    expect(c.page).toBeNull()
  })

  it('🔴 cite.page = 0 (a legitimate page number) → must be preserved as 0, must not be treated as falsy and fall back to null', () => {
    const c = toFileResults(oneChunkResp({ score: 0.5, cite: { chunk_no: 5, page: 0 }, preview: { text: 'hi' } }))[0].chunks[0]
    expect(c.page).toBe(0)
    expect(c.page).not.toBeNull()
  })

  it('cite.page = 12 (an ordinary positive integer) → preserved as-is', () => {
    const c = toFileResults(oneChunkResp({ score: 0.5, cite: { chunk_no: 5, page: 12 }, preview: { text: 'hi' } }))[0].chunks[0]
    expect(c.page).toBe(12)
  })

  it('preview.text missing (preview object exists but has no text key) → snippet falls back to ""', () => {
    const c = toFileResults(oneChunkResp({ score: 0.5, cite: { chunk_no: 0, page: null }, preview: {} }))[0].chunks[0]
    expect(c.snippet).toBe('')
  })

  it('preview entirely missing → snippet falls back to ""', () => {
    const c = toFileResults(oneChunkResp({ score: 0.5, cite: { chunk_no: 0, page: null } }))[0].chunks[0]
    expect(c.snippet).toBe('')
  })

  it('kind missing → falls back to "body"', () => {
    const c = toFileResults(oneChunkResp({ score: 0.5, cite: { chunk_no: 2, page: null }, preview: { text: 'hi' } }))[0].chunks[0]
    expect(c.kind).toBe('body')
  })

  it('score missing → falls back to 0', () => {
    const c = toFileResults(oneChunkResp({ cite: { chunk_no: 0, page: null }, preview: { text: 'hi' } }))[0].chunks[0]
    expect(c.score).toBe(0)
  })

  it("🔴 id is spelled exactly as `${fileId}:${kind}:${chunkNo}` (it's FileDetailDrawer's activeId comparison key)", () => {
    const c = toFileResults(oneChunkResp({ score: 0.9, kind: 'title', cite: { chunk_no: 42, page: null }, preview: { text: 'hi' } }))[0].chunks[0]
    expect(c.id).toBe('fx:title:42')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// chunkCount — blueprint :74-76
// ═══════════════════════════════════════════════════════════════════════════
describe('chunkCount — blueprint :74-76', () => {
  it('empty result → 0', () => {
    expect(chunkCount([])).toBe(0)
  })

  it('sums across multiple files and multiple chunks (real F5b data: 4 files × 2 chunks = 8)', () => {
    const out = toFileResults(asResp({ hits: HITS_ONLY_EIGHT_REAL_HITS }))
    expect(chunkCount(out)).toBe(8)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 K49 — highlight() is this period's only XSS surface: escape first, then insert <mark>
// ═══════════════════════════════════════════════════════════════════════════
describe('highlight — K49 XSS injection cases', () => {
  it('empty text → empty string (regardless of query)', () => {
    expect(highlight('', 'x')).toBe('')
    expect(highlight(null, 'x')).toBe('')
    expect(highlight(undefined, 'x')).toBe('')
  })

  it('empty query (empty string) → returns the escaped text as-is, no <mark>', () => {
    expect(highlight('hello & world', '')).toBe('hello &amp; world')
  })

  it('empty query (all whitespace) → same as above', () => {
    expect(highlight('hello world', '   ')).toBe('hello world')
  })

  it('🔴 <script> injection: output contains &lt;script&gt;, no bare "<script", alert is wrapped in <mark>', () => {
    const out = highlight('<script>alert(1)</script>', 'alert')
    expect(out).toBe('&lt;script&gt;<mark>alert</mark>(1)&lt;/script&gt;')
    expect(out).toContain('&lt;script&gt;')
    expect(out).not.toContain('<script')
    expect(out).toContain('<mark>alert</mark>')
  })

  it('🔴 <img onerror> injection: output contains &lt;img, no bare "<img", onerror is wrapped in <mark>', () => {
    const out = highlight('<img src=x onerror=1>', 'onerror')
    expect(out).toBe('&lt;img src=x <mark>onerror</mark>=1&gt;')
    expect(out).toContain('&lt;img')
    expect(out).not.toContain('<img')
    expect(out).toContain('<mark>onerror</mark>')
  })

  it('quotes are escaped too (all four characters & < > " covered)', () => {
    expect(highlight('a & b < c > d "e"', 'nomatch')).toBe('a &amp; b &lt; c &gt; d &quot;e&quot;')
  })

  it('regex metacharacter query (`a.b*c`) must not throw, and matches literally after escaping', () => {
    expect(() => highlight('abc', 'a.b*c')).not.toThrow()
    // "a.b*c" escapes to the literal "a\.b\*c", which is not found as a literal substring in "abc" → no highlight
    expect(highlight('abc', 'a.b*c')).toBe('abc')
    // But it does match text that literally contains "a.b*c"
    expect(highlight('xx a.b*c yy', 'a.b*c')).toBe('xx <mark>a.b*c</mark> yy')
  })

  it('multi-word query, case-insensitive, each word highlighted independently', () => {
    expect(highlight('Hello World', 'hello world')).toBe('<mark>Hello</mark> <mark>World</mark>')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// fmtMtime — governance §9.13: milliseconds/timezone
// ═══════════════════════════════════════════════════════════════════════════
describe('fmtMtime — governance §9.13', () => {
  it('0 → "—"', () => {
    expect(fmtMtime(0)).toBe('—')
  })
  it('null/undefined → "—"', () => {
    expect(fmtMtime(null)).toBe('—')
    expect(fmtMtime(undefined)).toBe('—')
  })

  it('🔴 real millisecond value (F5b paths[0].mtime_ms=1784424392240) → matches an "equivalent-formula comparison" result (TZ-safe, no hardcoded string)', () => {
    const ms = 1784424392240
    const d = new Date(ms)
    const expected = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    expect(fmtMtime(ms)).toBe(expected)
  })

  it('🔴 milliseconds vs seconds: for the same real timestamp, if it were mistakenly passed as "seconds" (numerically equal to ms/1000), you\'d get an obviously wrong 1970s date instead of the correct ms interpretation', () => {
    const realMs = 1784424392240
    const mistakenlyPassedAsSeconds = Math.floor(realMs / 1000) // 1784424392 — in case the caller mistakenly passes unix seconds where ms is expected
    const correct = fmtMtime(realMs)
    const wrong = fmtMtime(mistakenlyPassedAsSeconds)
    expect(correct).not.toBe(wrong)
    // Criterion (RED probe pasted in the report): change the production code's
    // `new Date(ms)` to `new Date(ms * 1000)` — the "real millisecond value" case above must
    // go red (fmtMtime(realMs) no longer equals the equivalent-formula result of
    // new Date(realMs) in the current TZ).
  })

  it('negative numbers / NaN never throw', () => {
    expect(() => fmtMtime(-1)).not.toThrow()
    expect(() => fmtMtime(NaN)).not.toThrow()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// relLevel / relLabel — three tiers + both sides of the two boundaries + i18n keys
// ═══════════════════════════════════════════════════════════════════════════
describe('relLevel — three-tier boundaries', () => {
  it('0.65 boundary: exactly 0.65 → high, just below 0.65 → mid', () => {
    expect(relLevel(0.65)).toBe('high')
    expect(relLevel(0.649999)).toBe('mid')
  })
  it('0.50 boundary: exactly 0.50 → mid, just below 0.50 → low', () => {
    expect(relLevel(0.5)).toBe('mid')
    expect(relLevel(0.499999)).toBe('low')
  })
  it('clearly-high / clearly-low extremes', () => {
    expect(relLevel(0.9)).toBe('high')
    expect(relLevel(0.1)).toBe('low')
  })
  it('real-device score range (0.4666–0.7380, see F9 §2⑥) can reach all three tiers', () => {
    expect(relLevel(0.738)).toBe('high')
    expect(relLevel(0.6118)).toBe('mid')
    expect(relLevel(0.4666)).toBe('low')
  })
})

describe('relLabel — three-tier boundaries + i18n keys (🔴 aiKbSrRelHigh/Mid/Low, not the generic High/Mid/Low)', () => {
  it('zh locale: three-tier Chinese copy', () => {
    expect(relLabel(0.65)).toBe('高')
    expect(relLabel(0.5)).toBe('中')
    expect(relLabel(0.1)).toBe('低')
  })

  it('both sides of the two boundaries (zh locale)', () => {
    expect(relLabel(0.649999)).toBe('中')
    expect(relLabel(0.499999)).toBe('低')
  })

  it("🔴 en locale: three-tier English copy, proving the keys really are wired to i18n rather than hardcoded Chinese (following the P5d precedent, must restore the global locale in try/finally)", () => {
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

  it('rendered value comes directly from the aiKbSrRelHigh/Mid/Low keys (matches the global i18n.global.t result character-for-character)', () => {
    expect(relLabel(0.9)).toBe(i18n.global.t('aiKbSrRelHigh'))
    expect(relLabel(0.5)).toBe(i18n.global.t('aiKbSrRelMid'))
    expect(relLabel(0.1)).toBe(i18n.global.t('aiKbSrRelLow'))
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// fileVM.name fallback — i18n.global.t('aiKbSrUntitled') (when basename resolution fails)
// ═══════════════════════════════════════════════════════════════════════════
describe('fileVM.name fallback — aiKbSrUntitled', () => {
  it("basename resolved from fullPath is empty (paths absent) → name falls back to i18n's (Untitled) copy", () => {
    const resp = asResp({
      files: [{ file_id: 'no-path', mime: 'text/plain', kind: 'body', score: 0.5, chunks: [] }],
    })
    const out = toFileResults(resp)
    expect(out[0].name).toBe(i18n.global.t('aiKbSrUntitled'))
    expect(out[0].name).toBe('(未命名)')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 SP8-P5f Task 1b — a coverage-gap patch for debt M-2 (P5e final review Minor-2)
//
// P5e final review found by hands-on testing: the minimum-length gate on `terms` inside
// `highlight()` has **zero coverage** — tighten it to `s.length >= 2` and all 3125 cases
// stay green (final-review probe F6), and the consequence is that **all single-character
// queries stop highlighting entirely** (single-character queries like "税" or "猫" in
// Chinese are a common query shape).
//
// 🔴 This block **only adds assertions — not a single line of production code was
// touched**. `searchAggregate.ts`'s `.filter((s) => s.length >= 1)` was verified
// word-for-word against the blueprint `bp-SearchView.vue:332` during P5e final review and
// confirmed **correct**.
//
// The real criterion, confirmed by re-reading the production code myself (not copied
// verbatim from the brief's `>= 1`):
//   `String(query).trim().split(/\s+/).filter((s) => s.length >= 1)`
//   ⇒ threshold = **each term's character length ≥ 1**, i.e. "participates in highlighting
//   as long as it's non-empty".
//   ⚠️ After `trim()`, `split(/\s+/)` on a non-empty string **never** produces an empty
//   string; the only input that can produce an empty string is an empty/all-whitespace
//   query (`''.split(/\s+/) === ['']`) ⇒ the "one character short = length 0" side can only
//   be reached via an empty/all-whitespace query (covered by the two cases below, which are
//   another phrasing of assertions already present in the K49 block).
//
// Criterion (RED probe, see p5f-task-1b-report.md): changing the threshold to `>= 2` → this
// block must go red.
// ⚠️ The opposite direction (changing to `>= 0`) is caught by the K49 block's existing
// "empty query → returned as-is" two cases:
//   `>= 0` would let an empty-string term into `new RegExp('', 'gi')`, inserting
//   `<mark></mark>` between every character.
// ═══════════════════════════════════════════════════════════════════════════

describe('highlight — debt M-2: term minimum-length gate (one case on each side of the threshold)', () => {
  // ─── Threshold side: a term of length **exactly 1** must participate in highlighting ───
  it('🔴 single-character Chinese query (length 1) → must highlight (goes red if the threshold is tightened to >= 2)', () => {
    expect(highlight('个人所得税申报表', '税')).toBe('个人所得<mark>税</mark>申报表')
  })

  it('🔴 single-character ASCII query (length 1) → must highlight', () => {
    expect(highlight('a b c', 'b')).toBe('a <mark>b</mark> c')
  })

  it('🔴 a multi-word query with one single-character term mixed in → both the short and long terms must be highlighted (not just the long one)', () => {
    expect(highlight('猫 咖啡馆', '猫 咖啡馆')).toBe('<mark>猫</mark> <mark>咖啡馆</mark>')
  })

  // ─── The other side of the threshold: not a single length-0 term may enter the regex ───
  // (Same criterion as the K49 block's two "empty query" cases, just worded differently —
  //  here it's spelled out explicitly as "the other side of the length gate" so both sides
  //  of the threshold read as a pair within the same describe block; the two K49 cases are
  //  neither changed nor relaxed.)
  it("empty query (the only way to reach length 0) → zero <mark>, returns the escaped text as-is", () => {
    const out = highlight('个人所得税申报表', '')
    expect(out).toBe('个人所得税申报表')
    expect(out).not.toContain('<mark>')
  })

  it('all-whitespace query (length 0 after trim) → zero <mark>', () => {
    const out = highlight('个人所得税申报表', ' \t \n ')
    expect(out).not.toContain('<mark>')
  })

  // Guards against "the threshold being hardcoded true as a special case": a length-1 term
  // goes through the same filter and behaves consistently with longer terms.
  it('length-1 and length-3 terms behave consistently on the same text (proves the criterion is a length gate, not a special-case branch)', () => {
    expect(highlight('所得税', '所')).toBe('<mark>所</mark>得税')
    expect(highlight('所得税', '所得税')).toBe('<mark>所得税</mark>')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Album-asset hits — caption vectors whose `file_id` starts with `photos:`
//
// Background (reported from real hardware, 2026-08-15): photo captions live in the same
// `text_chunks` collection as document bodies, so the semantic source returns album assets
// alongside files (`NimoOS-Search/service/agent_tools.go:19` states this is deliberate). But
// such a hit has no file path (Parser's ExpandFiles does not resolve the `photos:` prefix), so
// `basename('')` comes out empty → the whole row rendered as `(Untitled)` with no path.
// Plan B was chosen: detect them and render a photo card (thumbnail + description + open in
// the album). The thumbnail URL shape is taken from
// `NimoOS-Search/service/photos_client.go:84`.
// ═══════════════════════════════════════════════════════════════════════════
describe('album-asset hits — the photos: prefix', () => {
  const photoResp: SearchTextResponseRaw = {
    hits: [
      {
        file_id: 'photos:b615bb4a-5397-4113-b524-0c574d0fa46e',
        mime: 'video/mp4',
        kind: 'caption',
        score: 0.5724284648895264,
        paths: null,
        cite: { page: null, chunk_no: 0, offset_start: 0, offset_end: 418 },
        preview: { text: 'This image is a slide from an educational presentation' },
      },
    ],
  }

  it('recognized as an album asset: photoAssetId is the uuid with the prefix stripped', () => {
    const out = toFileResults(photoResp)
    expect(out[0].photoAssetId).toBe('b615bb4a-5397-4113-b524-0c574d0fa46e')
  })

  it('exposes a thumbnail URL (same shape as the images source: /v1/photos/assets/<id>/thumbnail?size=small)', () => {
    const out = toFileResults(photoResp)
    expect(out[0].thumbnailUrl).toBe(
      '/v1/photos/assets/b615bb4a-5397-4113-b524-0c574d0fa46e/thumbnail?size=small',
    )
  })

  it('a plain file hit carries neither field (existing rendering untouched)', () => {
    const out = toFileResults({
      hits: [{ file_id: 'abc123', mime: 'application/pdf', paths: [{ path: '/DATA/a.pdf', mtime_ms: 1 }] }],
    })
    expect(out[0].photoAssetId).toBeUndefined()
    expect(out[0].thumbnailUrl).toBeUndefined()
  })
})

// Once NimoOS-Search resolves photos:<asset_id> hits through Photos (GET /v1/photos/assets/{id}),
// the same `paths[0]` slot carries the real file — the card must read like any other file, and
// the Photo/Video label is only the fallback for a Photos outage (paths back to null).
describe('album-asset hits — with a path resolved by Photos', () => {
  const withPath: SearchTextResponseRaw = {
    hits: [
      {
        file_id: 'photos:b615bb4a-5397-4113-b524-0c574d0fa46e',
        mime: 'video/mp4',
        kind: 'caption',
        score: 0.57,
        paths: [{ root_id: 'photos', path: '/media/RAID_raid10/知识库/肝疾病1.mp4', mtime_ms: 1784600000000 }],
        cite: { page: null, chunk_no: 0, offset_start: 0, offset_end: 418 },
        preview: { text: 'A presenter in front of a slide about the liver' },
      },
    ],
  }

  it('name is the file basename, not the Video label', () => {
    const out = toFileResults(withPath)
    expect(out[0].name).toBe('肝疾病1.mp4')
    expect(out[0].name).not.toBe(i18n.global.t('aiKbSrVideoAsset'))
  })

  it('path / fullPath / mtimeMs come from paths[0] like a document', () => {
    const out = toFileResults(withPath)
    expect(out[0].path).toBe('/media/RAID_raid10/知识库/')
    expect(out[0].fullPath).toBe('/media/RAID_raid10/知识库/肝疾病1.mp4')
    expect(out[0].mtimeMs).toBe(1784600000000)
  })

  it('still carries photoAssetId + thumbnailUrl (the drawer and the card thumbnail need them)', () => {
    const out = toFileResults(withPath)
    expect(out[0].photoAssetId).toBe('b615bb4a-5397-4113-b524-0c574d0fa46e')
    expect(out[0].thumbnailUrl).toBe('/v1/photos/assets/b615bb4a-5397-4113-b524-0c574d0fa46e/thumbnail?size=small')
  })

  it('without a path (Photos unavailable, fail-open) the name still falls back to the Video/Photo label', () => {
    const out = toFileResults({
      hits: [{ ...withPath.hits![0], paths: null }, { ...withPath.hits![0], file_id: 'photos:x', mime: 'image/jpeg', paths: null }],
    })
    expect(out[0].name).toBe(i18n.global.t('aiKbSrVideoAsset'))
    expect(out[1].name).toBe(i18n.global.t('aiKbSrPhotoAsset'))
  })
})
