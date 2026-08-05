#!/usr/bin/env node
/* P5e fixtures 自查 —— 逐字段核 4 个 .REPLAYED 有没有「未申报的加工」。
 * 用法:node .superpowers/sdd/p5e-fixtures/scripts/verify-fixtures.mjs
 * 全部检查只读本目录下已提交的 fixture,不打任何网络。
 *
 * 由 T0b 整改轮新增(评审 Important-2 第 2 条:「自己再全量自查一遍每一个字段」)。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const rd = (f) => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))
let fail = 0
const ok = (c, m) => { console.log(`  ${c ? 'PASS' : '🔴 FAIL'}  ${m}`); if (!c) fail++ }

const F0 = rd('F0-qdrant-points.REAL.json')
const F0b = rd('F0b-qdrant-scroll-source-points.REAL.json')
const F0c = rd('F0c-qdrant-chunkwindow-source-points.REAL.json')
const F5 = rd('F5-search-text.nonempty.REPLAYED.json')
const F5b = rd('F5b-search-text.multifile.REPLAYED.json')
const F6 = rd('F6-search-chunk.window.REPLAYED.json')
const F6b = rd('F6b-search-chunk.window-multi.REPLAYED.json')

const key = (p) => `${p.payload.chunk_no}|${p.payload.file_id}|${p.payload.offset_start ?? 'x'}`
const hkey = (h) => `${h.cite.chunk_no}|${h.file_id}|${h.cite.offset_start ?? 'x'}`
const srcIndex = (pts) => new Map(pts.map((p) => [key(p), p.payload]))

console.log('=== 1. 溯源:每条 hit / chunk 都能在 .REAL 源点里找到 ===')
for (const [name, fx, src] of [['F5', F5, F0.result.points], ['F5b', F5b, F0b.points]]) {
  const idx = srcIndex(src)
  const miss = fx.hits.filter((h) => !idx.has(hkey(h)))
  ok(miss.length === 0, `${name}: ${fx.hits.length} 条 hit 全部溯到源点(缺 ${miss.length} 条)`)
}
{
  const idx = srcIndex(F0c.points)
  for (const [name, fx] of [['F6', F6], ['F6b', F6b]]) {
    const miss = fx.chunks.filter((c) => !idx.has(`${c.chunk_no}|${fx.file_id}|${c.offset_start ?? 'x'}`))
    ok(miss.length === 0, `${name}: ${fx.chunks.length} 条 chunk 全部溯到源点(缺 ${miss.length} 条)`)
  }
}

console.log('\n=== 2. 零截断:正文与源点逐字节相同 ===')
for (const [name, fx, src] of [['F5', F5, F0.result.points], ['F5b', F5b, F0b.points]]) {
  const idx = srcIndex(src)
  const bad = fx.hits.filter((h) => (h.preview.text ?? '') !== (idx.get(hkey(h))?.text ?? ''))
  ok(bad.length === 0, `${name}: preview.text 与源点逐字节相同(不同 ${bad.length} 条);长度 ${fx.hits.map((h) => (h.preview.text || '').length).join(',')}`)
}
{
  const idx = srcIndex(F0c.points)
  for (const [name, fx] of [['F6', F6], ['F6b', F6b]]) {
    const bad = fx.chunks.filter((c) => c.text !== (idx.get(`${c.chunk_no}|${fx.file_id}|${c.offset_start ?? 'x'}`)?.text ?? ''))
    ok(bad.length === 0, `${name}: chunks[].text 与源点逐字节相同(不同 ${bad.length} 条);长度 ${fx.chunks.map((c) => c.text.length).join(',')}`)
  }
}
for (const [name, fx] of [['F5', F5], ['F5b', F5b], ['F6', F6], ['F6b', F6b]]) {
  const lens = name.startsWith('F6') ? fx.chunks.map((c) => c.text.length) : fx.hits.map((h) => (h.preview.text || '').length)
  const round = new Set(lens.filter((n) => n % 100 === 0))
  ok(!(lens.length > 1 && new Set(lens).size === 1) && round.size === 0,
    `${name}: 长度不是「齐刷刷的整百」(旧版 400/320/600 就是这样被逮到的)`)
}

console.log('\n=== 3. 字段全集:与 Go struct 的 JSON tag 逐个对齐 ===')
// SearchResponse service/search.go:68-73 · Hit :32-44 · Cite :46-53 · Preview :55-58 · SearchStats :60-66
const EXP = {
  top: ['files', 'hits', 'stats', 'warnings'],
  hit: ['cite', 'collection', 'file_id', 'kind', 'mime', 'paths', 'payload_extra', 'preview', 'raw_score', 'score'],
  cite: ['chunk_no', 'frame_ms_end', 'frame_ms_start', 'offset_end', 'offset_start', 'page'],
  preview: ['text', 'thumbnail_url'],
  stats: ['embed_ms', 'expand_ms', 'rerank_ms', 'total_candidates', 'vector_search_ms'],
  group: ['chunks', 'file_id', 'kind', 'mime', 'paths', 'score'],
  path: ['mtime_ms', 'path', 'root_id'],
  cw: ['anchor_chunk_no', 'chunks', 'file_id', 'kind'],
}
const noMeta = (o) => Object.keys(o).filter((k) => !k.startsWith('_')).sort()
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b)
for (const [name, fx] of [['F5', F5], ['F5b', F5b]]) {
  ok(eq(noMeta(fx), EXP.top), `${name}: 顶层键 = ${noMeta(fx).join(',')}`)
  ok(fx.hits.every((h) => eq(noMeta(h), EXP.hit)), `${name}: 每条 hit 的键集与 Hit struct 一致`)
  ok(fx.hits.every((h) => eq(noMeta(h.cite), EXP.cite)), `${name}: 每个 cite 的键集与 Cite struct 一致(page/offset_* 无 omitempty ⇒ 键恒存在)`)
  ok(fx.hits.every((h) => eq(noMeta(h.preview), EXP.preview)), `${name}: 每个 preview 的键集一致`)
  ok(eq(noMeta(fx.stats), EXP.stats), `${name}: stats 键集一致`)
  ok(fx.files.every((g) => eq(noMeta(g), EXP.group)), `${name}: 每个 files[] 的键集与 FileGroup struct 一致`)
  ok(fx.hits.every((h) => Array.isArray(h.paths) && h.paths.every((p) => eq(noMeta(p), EXP.path))),
    `${name}: hits[].paths 已回填且每项键集 = FilePath struct(root_id/path/mtime_ms)`)
  ok(fx.files.every((g) => g.score === g.chunks[0].score), `${name}: files[].score === chunks[0].score(search.go:287)`)
  ok(fx.files.every((g) => g.paths === g.chunks[0].paths || eq(g.paths, g.chunks[0].paths)), `${name}: files[].paths === chunks[0].paths(search.go:284)`)
  ok(fx.hits.every((h) => h.collection === 'text_chunks'), `${name}: collection 恒为 text_chunks(search.go:328)`)
  ok(fx.hits.every((h) => eq(h.payload_extra, {})), `${name}: payload_extra 恒为 {}(search.go:334)`)
  ok(fx.hits.every((h) => h.score === h.raw_score), `${name}: 未 rerank ⇒ score === raw_score(search.go:326-327)`)
  ok(fx.hits.every((h) => h.preview.thumbnail_url === null), `${name}: preview.thumbnail_url 恒 null(本机无视觉模态)`)
  const s = fx.hits.map((h) => h.score)
  ok(s.every((v, i) => i === 0 || s[i - 1] >= v), `${name}: hits 按 score 降序(search.go:206)`)
  ok(fx.hits.length <= 10 * 8 && fx.files.length <= 10, `${name}: topK≤10 / maxChunksPerFile≤8 边界成立`)
  ok(eq(fx.warnings, []), `${name}: warnings = []`)
}
for (const [name, fx] of [['F6', F6], ['F6b', F6b]]) {
  ok(eq(noMeta(fx), EXP.cw), `${name}: 顶层键 = ${noMeta(fx).join(',')}(ChunkContextResponse authz.go:96-101)`)
  ok(fx.chunks.every((c) => !('page' in c)), `${name}: page 带 omitempty ⇒ 本机 text/plain 下整键消失`)
  ok(fx.chunks.every((c) => noMeta(c).every((k) => ['chunk_no', 'text', 'page', 'offset_start', 'offset_end'].includes(k))), `${name}: chunk 键集 ⊆ ChunkContextChunk`)
  const ns = fx.chunks.map((c) => c.chunk_no)
  ok(ns.every((v, i) => i === 0 || ns[i - 1] < v), `${name}: chunks 按 chunk_no 升序(authz.go:145)`)
  ok(ns.every((n) => Math.abs(n - fx.anchor_chunk_no) <= 2), `${name}: 全部落在 [anchor-2, anchor+2](authz.go:124)`)
}

console.log('\n=== 4. 三级标签 + 出处说明 ===')
/* 🔴 白名单:这 4 个是「端到端逐字节真抓」的纯响应体,**故意不加任何 _ 前缀键** ——
 * 它们的全部价值就是可以原样抄进测试当 mock。它们的出处写在 ../README.md §0 的清单表里。
 * 白名单是显式常量,不许悄悄变长。 */
const PURE_REAL = [
  'F1-search-text.empty.REAL.json',
  'F2-search-text.rerank-true.empty.REAL.json',
  'F3-search-text.filtered.empty.REAL.json',
  'F4-search-text.no_accessible_roots.REAL.json',
]
for (const f of fs.readdirSync(DIR).filter((f) => f.endsWith('.json')).sort()) {
  const d = rd(f)
  const p = d._provenance
  const tag = f.includes('.REAL.') ? 'REAL' : f.includes('.REPLAYED.') ? 'REPLAYED' : f.includes('.CONSTRUCTED.') ? 'CONSTRUCTED' : null
  ok(!!tag, `${f}: 文件名带三级标签之一`)
  if (PURE_REAL.includes(f)) {
    ok(Object.keys(d).every((k) => !k.startsWith('_')), `${f}: 纯真抓响应体,零 _ 前缀键(白名单,出处见 README §0)`)
    continue
  }
  ok(typeof p === 'string' || Object.keys(d).some((k) => k.startsWith('_')), `${f}: 有 _provenance / _ 前缀出处说明`)
  if (typeof p === 'string' && tag) ok(p.startsWith(tag), `${f}: _provenance 开头声明的等级 == 文件名的等级`)
}
ok(PURE_REAL.every((f) => fs.existsSync(path.join(DIR, f))), 'PURE_REAL 白名单里的 4 个文件都还在(防白名单腐烂)')

console.log(`\n=== 结果:${fail === 0 ? '全部通过 ✅' : `🔴 ${fail} 项失败`} ===`)
process.exit(fail === 0 ? 0 : 1)
