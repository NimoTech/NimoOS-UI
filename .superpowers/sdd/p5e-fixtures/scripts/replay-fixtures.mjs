#!/usr/bin/env node
/* P5e fixtures —— 从零重跑 F0 / F0b / F0c / F5 / F5b / F6 / F6b / F12
 *
 * 用法(仓根或任意 cwd 都行,输出目录固定为本脚本的上一级):
 *   node .superpowers/sdd/p5e-fixtures/scripts/replay-fixtures.mjs
 *   node .../replay-fixtures.mjs --dry            # 只打印,不写文件
 *
 * 为什么需要「重放」而不是端到端抓:见 ../README.md §3(本机 /v1/ai/search/text 恒零结果,
 * Qdrant 5592 个向量的 root_ids 全是 dfcd1840…,而 search-roots 只返 ["photos"],交集恒空
 * —— 用户裁定 R2 已定案「结果半区不列真机验收项」,禁开 root grant)。
 *
 * 🔴 本脚本严格只做 NimoOS-Search 那条 Go 代码路径做的事,零截断、零补造:
 *   buildHitFromPayload   service/search.go:298-337   (+ :339-347 stringOrNilFromAny 把 "" 变 nil)
 *   排序 / 分组 / topK / maxChunks   service/search.go:205-231
 *   paths + mime 回填(真 Parser)    service/search.go:243-259
 *   files[] 组装(grp.Score = grp.Chunks[0].Score)  service/search.go:263-290
 *   GetChunkWindow(F6/F6b)           service/authz.go:103-149
 *
 * 🔴 人工成分只有两处,两处都在输出文件的 _provenance 里逐字申报:
 *   (1) F5b 的 8 个 score —— 从本机实测区间 0.4666–0.7380 里取的档位代表值,
 *       目的是让 relLevel 三档在同一个 fixture 里都有样本。
 *   (2) F5b 的「4 个文件 × 每文件 2 chunk」这个场景本身是设计出来的
 *       (本机真查询的 40 个 top hit 全落在同一个文件里,见 F0)。
 *   除此之外每个字段都来自真响应或上面那条 Go 路径。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.resolve(HERE, '..')
const DRY = process.argv.includes('--dry')

const PARSER = process.env.PARSER_URL || 'http://127.0.0.1:8283'
const QDRANT = process.env.QDRANT_URL || 'http://127.0.0.1:6333'
const COLLECTION = 'text_chunks'
const QUERY = '404 not found error in the parser upsert log'
const TOPK = 10
const MAXCH = 8
const LIMIT = 40 // = service/search.go 的 candidates 上界(GroupByFile 下 min(topK*maxChunks,100))

const log = (...a) => console.log(...a)
function write(name, obj) {
  const p = path.join(OUT, name)
  if (DRY) { log(`[dry] would write ${name} (${JSON.stringify(obj).length} bytes)`); return }
  fs.writeFileSync(p, JSON.stringify(obj, null, 1) + '\n')
  log(`wrote ${name}  ${fs.statSync(p).size} bytes`)
}
async function jpost(url, body) {
  const t = Date.now()
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  if (!r.ok) throw new Error(`${url} -> HTTP ${r.status}: ${(await r.text()).slice(0, 300)}`)
  return [await r.json(), Date.now() - t]
}
async function jget(url) {
  const t = Date.now()
  const r = await fetch(url)
  if (!r.ok) throw new Error(`${url} -> HTTP ${r.status}`)
  return [await r.json(), Date.now() - t]
}
/* 🔴 必须翻页翻到底。T0 第一版用单次 `limit: 1000` 的 scroll,Qdrant 只回了第一页,
 * 于是 F6 的窗口漏掉了 2385/2386/2388/2389,被误当成「真机 chunk_no 不连续」写进了附录
 * (T0b 整改时发现,详见 ../../p5e-task-0b-report.md §2 的第 4 类未申报加工)。 */
async function scrollAll(filter) {
  const points = []
  let offset = null
  for (let page = 0; page < 200; page++) {
    const body = { limit: 1000, with_payload: true, with_vector: false }
    if (filter) body.filter = filter
    if (offset != null) body.offset = offset
    const [r] = await jpost(`${QDRANT}/collections/${COLLECTION}/points/scroll`, body)
    points.push(...r.result.points)
    offset = r.result.next_page_offset
    if (offset == null) return points
  }
  throw new Error('scrollAll: too many pages')
}

/* ---------- Go 路径逐行移植 ---------- */
// service/search.go:355-367  asInt64
const asInt = (v) => (v == null ? 0 : Math.trunc(Number(v)))
// service/search.go:339-347  stringOrNilFromAny —— "" 也变 nil
const strOrNil = (v) => (typeof v === 'string' && v !== '' ? v : null)
// service/search.go:298-337  buildHitFromPayload
function buildHitFromPayload(qh) {
  const p = qh.payload
  const cite = { page: null, offset_start: null, offset_end: null, frame_ms_start: null, frame_ms_end: null, chunk_no: asInt(p.chunk_no) }
  for (const k of ['page', 'offset_start', 'offset_end', 'frame_ms_start', 'frame_ms_end']) {
    if (p[k] != null) cite[k] = asInt(p[k])
  }
  return {
    score: qh.score, raw_score: qh.score, collection: COLLECTION,
    file_id: typeof p.file_id === 'string' ? p.file_id : '',
    paths: null,
    mime: typeof p.mime === 'string' ? p.mime : '',
    kind: typeof p.kind === 'string' ? p.kind : '',
    cite,
    preview: { text: strOrNil(p.text), thumbnail_url: null }, // 🔴 零截断
    payload_extra: {},
  }
}
// service/search.go:205-231 + :243-259 + :263-290
async function assemble(hits, statsIn) {
  hits = [...hits].sort((a, b) => b.score - a.score) // :206 sort desc (SliceStable)
  const order = []; const byFile = new Map()
  for (const h of hits) {                            // :208-224
    let ch = byFile.get(h.file_id)
    if (ch === undefined) {
      if (order.length >= TOPK) continue
      order.push(h.file_id); byFile.set(h.file_id, ch = [])
    }
    if (ch.length < MAXCH) ch.push(h)
  }
  const flat = order.flatMap((fid) => byFile.get(fid))
  let expandMs = 0
  if (flat.length) {                                 // :234-259 真 Parser 回填
    const ids = [...new Set(flat.map((h) => h.file_id))]
    const [exp, ms] = await jget(`${PARSER}/v1/parser/_internal/files?file_ids=${ids.join(',')}`)
    expandMs = ms
    const byId = new Map(exp.files.map((f) => [f.file_id, f]))
    for (const h of flat) {
      const rec = byId.get(h.file_id)
      if (rec) { h.paths = rec.paths; if (!h.mime) h.mime = rec.mime }
    }
  }
  const files = order.map((fid) => {                 // :263-290
    const chunks = flat.filter((h) => h.file_id === fid)
    if (!chunks.length) return null
    return { file_id: fid, paths: chunks[0].paths, mime: chunks[0].mime, kind: chunks[0].kind, score: chunks[0].score, chunks }
  }).filter(Boolean)
  return { hits: flat, files, stats: { ...statsIn, expand_ms: expandMs }, warnings: [] }
}

/* ================= F0a: 真 bge-m3 embedding ================= */
const F0A = 'F0a-parser-embed.REAL.json'
let embed, embedMs
const cached = path.join(OUT, F0A)
if (fs.existsSync(cached) && !process.argv.includes('--reembed')) {
  const c = JSON.parse(fs.readFileSync(cached, 'utf8'))
  embed = c.response; embedMs = c._embed_ms
  log(`reusing ${F0A} (dim=${embed.dim}, embed_ms=${embedMs}) — 加 --reembed 强制重算`)
} else {
  ;[embed, embedMs] = await jpost(`${PARSER}/v1/parser/embed`, { model: 'bge-m3', input_type: 'text', text: QUERY })
  write(F0A, {
    _provenance: 'REAL —— POST ' + PARSER + '/v1/parser/embed 的逐字响应。存下来是为了让本脚本可重复:同一个 dense 向量 ⇒ 同一批 Qdrant 命中,不受模型/权重变动影响。',
    _request: { model: 'bge-m3', input_type: 'text', text: QUERY },
    _embed_ms: embedMs,
    response: embed,
  })
}

/* ================= F0 + F5:真查询 → 单文件多 chunk ================= */
const [q, vsMs] = await jpost(`${QDRANT}/collections/${COLLECTION}/points/query`,
  { query: embed.dense, using: 'dense', limit: LIMIT, with_payload: true })
const pts = q.result.points
log(`\nQdrant query: ${pts.length} points, scores ${pts[0].score.toFixed(6)} … ${pts[pts.length - 1].score.toFixed(6)}`)

write('F0-qdrant-points.REAL.json', {
  _provenance: `REAL —— POST ${QDRANT}/collections/${COLLECTION}/points/query 的逐字响应,**全部 ${pts.length} 个点、payload 零截断**。F5 的每一条 hit 都能在这里溯到源点(按 score|chunk_no|offset_start 三元组)。`,
  _request: { query: '<F0a 的 embed.dense,1024 维>', using: 'dense', limit: LIMIT, with_payload: true },
  _query_text: QUERY,
  _vector_search_ms: vsMs,
  result: q.result,
})

const f5 = await assemble(pts.map(buildHitFromPayload),
  { total_candidates: pts.length, rerank_ms: 0, embed_ms: embedMs, vector_search_ms: vsMs })
f5._provenance = [
  'REPLAYED —— 真 Qdrant 命中(F0,全 ' + pts.length + ' 点)经 NimoOS-Search 的 Go 路径逐行重放:',
  '  buildHitFromPayload service/search.go:298-337 · 排序/分组 service/search.go:205-231 ·',
  '  paths+mime 回填(真 Parser _internal/files)service/search.go:243-259 · files[] 组装 service/search.go:263-290',
  '🔴 人工成分:零。preview.text 零截断;每条 hit 都能在 F0 里溯到源点;',
  '   stats 的 embed_ms / vector_search_ms / expand_ms 是本次重放的真实耗时,total_candidates = len(F0.result.points)。',
  '🔴 抄进测试时删掉所有 _ 前缀的键(后端从不下发它们)。',
].join('\n')
write('F5-search-text.nonempty.REPLAYED.json', f5)
log(`F5: files=${f5.files.length} hits=${f5.hits.length} preview lens=${f5.hits.map((h) => (h.preview.text || '').length).join(',')}`)

/* ================= F0b + F5b:多文件场景(场景是设计的,数据是真的) ================= */
const scAll = await scrollAll(null)
const byFileAll = new Map()
for (const p of scAll) {
  if (!byFileAll.has(p.payload.file_id)) byFileAll.set(p.payload.file_id, [])
  byFileAll.get(p.payload.file_id).push(p)
}
log(`\nQdrant scroll (全量翻页): ${scAll.length} points across ${byFileAll.size} file_ids`)
// 🔴 人工成分 (2):挑前 4 个 file_id、每个取 chunk_no 最小的 2 个点。
const srcPts = []
for (const [, ps] of [...byFileAll].slice(0, 4)) {
  srcPts.push(...[...ps].sort((a, b) => asInt(a.payload.chunk_no) - asInt(b.payload.chunk_no)).slice(0, 2))
}
write('F0b-qdrant-scroll-source-points.REAL.json', {
  _provenance: `REAL —— F5b 的 ${srcPts.length} 个源点,逐字取自 POST ${QDRANT}/collections/${COLLECTION}/points/scroll 的响应(payload 零截断)。选点规则见 _selection。`,
  _selection: '按 scroll 返回顺序取前 4 个 file_id,每个 file_id 取 chunk_no 最小的 2 个点 —— 这是人工设计的场景(本机真查询的 40 个 top hit 全在同一个文件里,见 F0),不是查询结果。',
  points: srcPts,
})
// 🔴 人工成分 (1):8 个档位代表 score
const SCORES = [0.7380, 0.7354, 0.6118, 0.6002, 0.5127, 0.5044, 0.4824, 0.4666]
const f5bHits = srcPts.map((p, i) => { const h = buildHitFromPayload(p); h.score = h.raw_score = SCORES[i]; return h })
const f5b = await assemble(f5bHits, { total_candidates: srcPts.length, rerank_ms: 0, embed_ms: embedMs, vector_search_ms: vsMs })
f5b._provenance = [
  'REPLAYED(含 2 处已申报的人工成分)—— 用途:让 relLevel 三档 + 多文件聚合在同一个 fixture 里都有样本。',
  'Go 路径与 F5 完全相同(service/search.go:298-337 / 205-231 / 243-259 / 263-290)。',
  '🔴 人工成分 (1):8 个 score 是从本机实测区间 0.4666–0.7380 里取的档位代表值',
  '   (真值分布见 F0:40 个点全部落在 0.7340–0.7380,三档分不开)。high 1 / mid 2 / low 1。',
  '🔴 人工成分 (2):「4 个文件 × 每文件 2 chunk」这个场景本身是设计的 —— 源点选取规则见 F0b._selection。',
  '🔴 stats.total_candidates = 源点数(8),不是某次真查询的候选数;embed_ms/vector_search_ms 沿用 F0 那次真查询的耗时。',
  '除上述之外:preview.text 零截断、cite/mime/kind/file_id/paths 全部来自真 payload 或真 Parser 回填。',
  '🔴 抄进测试时删掉所有 _ 前缀的键。',
].join('\n')
write('F5b-search-text.multifile.REPLAYED.json', f5b)
log(`F5b: files=${f5b.files.length} scores=${f5b.files.map((f) => f.score).join(',')} preview lens=${f5b.hits.map((h) => (h.preview.text || '').length).join(',')}`)

/* ================= F0c + F6 / F6b:GetChunkWindow ================= */
// service/authz.go:103-149
function chunkWindow(points, fileId, kind, chunkNo, W) {
  const out = []
  for (const p of points) {
    const pl = p.payload
    if (pl.kind !== kind) continue
    const cn = asInt(pl.chunk_no)
    if (cn < chunkNo - W || cn > chunkNo + W) continue
    const cc = { chunk_no: cn, text: typeof pl.text === 'string' ? pl.text : '' } // 🔴 零截断
    for (const k of ['page', 'offset_start', 'offset_end']) if (pl[k] != null) cc[k] = asInt(pl[k]) // omitempty
    out.push(cc)
  }
  out.sort((a, b) => a.chunk_no - b.chunk_no)
  return { file_id: fileId, kind, anchor_chunk_no: chunkNo, chunks: out }
}
const f6File = f5.files[0].file_id
const f6Anchor = f5.files[0].chunks[0].cite.chunk_no
const scF6 = await scrollAll({ must: [{ key: 'file_id', match: { value: f6File } }] })
log(`Qdrant scroll (file_id=${f6File.slice(0, 12)}…, 全量翻页): ${scF6.length} points`)
// F6b:找一个窗口里真有 ≥4 条的 anchor
const nosB = [...new Set(scF6.filter((p) => p.payload.kind === 'body').map((p) => asInt(p.payload.chunk_no)))].sort((a, b) => a - b)
const contiguous = nosB.every((n, i) => i === 0 || n === nosB[i - 1] + 1)
log(`  body chunk_no: ${nosB.length} 个, ${nosB[0]}…${nosB[nosB.length - 1]}, 连续=${contiguous}`)
let f6bAnchor = null
for (const n of nosB) { if (nosB.filter((x) => x >= n - 2 && x <= n + 2).length >= 4) { f6bAnchor = n; break } }

const keepPts = scF6.filter((p) => {
  const cn = asInt(p.payload.chunk_no)
  return (cn >= f6Anchor - 2 && cn <= f6Anchor + 2) || (f6bAnchor != null && cn >= f6bAnchor - 2 && cn <= f6bAnchor + 2)
})
write('F0c-qdrant-chunkwindow-source-points.REAL.json', {
  _provenance: `REAL —— F6/F6b 的源点,逐字取自 POST ${QDRANT}/collections/${COLLECTION}/points/scroll(filter: file_id = ${f6File}),只保留落在两个窗口里的点,payload 零截断。`,
  _windows: { f6: { anchor: f6Anchor, window: 2 }, f6b: { anchor: f6bAnchor, window: 2 } },
  _source_scroll: { filter: { must: [{ key: 'file_id', match: { value: f6File } }] }, total_points_for_this_file: scF6.length, body_chunk_no_contiguous: contiguous },
  points: keepPts,
})

const f6 = chunkWindow(scF6, f6File, 'body', f6Anchor, 2)
f6._provenance = [
  'REPLAYED —— 真 Qdrant scroll(F0c)经 NimoOS-Search/service/authz.go:103-149 (GetChunkWindow) 逐行重放。',
  '🔴 人工成分:零。text 零截断;page/offset_* 按 Go 的 omitempty 语义「空则整键消失」。',
  `anchor_chunk_no = ${f6Anchor} = F5 首个文件首个 chunk 的 chunk_no(后端把请求里的 chunk_no 原样回显)。`,
  `窗口 = [${f6Anchor - 2}, ${f6Anchor + 2}],实际取到 ${f6.chunks.length} 条,升序。`,
  '🔴 抄进测试时删掉所有 _ 前缀的键。',
].join('\n')
write('F6-search-chunk.window.REPLAYED.json', f6)
log(`\nF6: anchor=${f6.anchor_chunk_no} chunk_nos=[${f6.chunks.map((c) => c.chunk_no)}] text lens=[${f6.chunks.map((c) => c.text.length)}]`)

if (f6bAnchor != null) {
  const f6b = chunkWindow(scF6, f6File, 'body', f6bAnchor, 2)
  f6b._provenance = [
    'REPLAYED —— 同 F6 的重放路径(service/authz.go:103-149),换一个窗口里真有多条的 anchor。',
    '🔴 人工成分:零(anchor 的挑选规则 = 第一个「窗口内 ≥4 条」的 chunk_no,见 F0c._windows)。text 零截断。',
    `窗口 = [${f6bAnchor - 2}, ${f6bAnchor + 2}];anchor=${f6bAnchor} 贴着 chunk_no 下界 ⇒ 只取到 ${f6b.chunks.length} 条(不足 2W+1),`,
    '正好可以钉住「后端只按 [anchor-W, anchor+W] 过滤 + 升序,不保证条数」。',
    '🔴 抄进测试时删掉所有 _ 前缀的键。',
  ].join('\n')
  write('F6b-search-chunk.window-multi.REPLAYED.json', f6b)
  log(`F6b: anchor=${f6b.anchor_chunk_no} chunk_nos=[${f6b.chunks.map((c) => c.chunk_no)}] text lens=[${f6b.chunks.map((c) => c.text.length)}]`)
}

/* ================= F12:anchor 缺席(CONSTRUCTED,Minor-7) ================= */
write('F12-search-chunk.anchor-absent.CONSTRUCTED.json', {
  _provenance: [
    'CONSTRUCTED(D-6 模具)—— 本机无真样本:F6/F6b 两个真窗口都恰好包含 anchor。',
    '字段形状的权威源 = NimoOS-Search/service/authz.go:96-101 (ChunkContextResponse) + :103-149。',
    '构造依据(为什么这个响应是后端真会产生的):GetChunkWindow 把请求里的 chunk_no 原样回显成',
    'anchor_chunk_no(authz.go:146-148),而 chunks 只保留「kind 相同 且 落在 [chunk_no-W, chunk_no+W]」的点',
    '(:120-125)—— 若 anchor 那一条被 re-chunk / tombstone 掉而邻居还在,anchor 就不在 chunks 里。',
    '⇒ 蓝本 FileDetailDrawer.vue:156 的 (r.chunks||[]).find(x => x.chunk_no === r.anchor_chunk_no) 得 undefined,',
    '   落到 :157 的 (anchor && anchor.text) || c.snippet || \'\' —— 这条兜底分支的唯一样本。',
    '🔴 抄进测试时删掉所有 _ 前缀的键。',
  ].join('\n'),
  file_id: f6File,
  kind: 'body',
  anchor_chunk_no: f6Anchor,
  chunks: [
    { chunk_no: f6Anchor - 1, text: 'neighbour before the anchor', offset_start: 1000, offset_end: 2000 },
    { chunk_no: f6Anchor + 1, text: 'neighbour after the anchor', offset_start: 3000, offset_end: 4000 },
  ],
})

log('\n=== done ===')
