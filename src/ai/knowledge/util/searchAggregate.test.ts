// SP8-P5e Task 3 —— `searchAggregate.ts` 的单测,承接 Vue2 既有
// `__tests__/searchAggregate.spec.js`(46 行 / 2 例,治理 §4.3)并加细
// (`kindFromMime` 六分支 / `basename`/`dirname` 边界 / `chunkVM` 边界 / N45 三件事
// 各自独立用例),外加 K48(等价性已由 T0 程序化证明,`p5e-task-0-report.md` §9)
// 与 K49(本期唯一 XSS 面)专项用例。
//
// 🔴 fixture 纪律(裁定 R3.2/R9/R10,`p5e-fixtures/README.md`):
// 本文件的多文件聚合用例取自 `.superpowers/sdd/p5e-fixtures/F5b-search-text.multifile.REPLAYED.json`
// (三级出处标签 = **REPLAYED**:真 Qdrant payload 经 `NimoOS-Search/service/search.go` 的权威
// 代码路径重放,含 2 处已在 README §3.1 申报的人工成分:8 个 score 取自本机实测区间的档位
// 代表值、"4 文件×2 chunk" 的选点规则)。
// 🔴 **R9-3**:正文是零截断真值(每条 preview.text 2156–2379 字)→ 本文件**只保留 1 条完整正文**
// (下面 `FIRST_CHUNK_FULL_TEXT`,取自 F5b `files[0].chunks[0].preview.text`,
// sha256 `fe4f68aa570a1ad127811d38a3d87f3845523f0ff0cb53c4f9baad6327bade1b`,长度 2342,
// 可用 `python3 -c "import json,hashlib; d=json.load(open('.superpowers/sdd/p5e-fixtures/F5b-search-text.multifile.REPLAYED.json')); t=d['files'][0]['chunks'][0]['preview']['text']; print(len(t), hashlib.sha256(t.encode()).hexdigest())"`
// 复核,应打印 `2342 fe4f68aa570a…`),**其余每条 preview.text 都截到前 50 字符**
// (仍是取自同一份真数据的真实前缀,不是手编内容 —— 聚合/排序/取分逻辑不依赖正文长度或
// 具体内容,只有一条独立用例校验「原样透传不截断」)。
// 🔴 `_` 前缀的台账元数据键(`_provenance` 等)已按 README §3.3 的要求删除,不抄进本文件。
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
// kindFromMime —— 蓝本 :5-12,六分支各一条 + 空值兜底 + 🔴 顺序敏感的一条
// ═══════════════════════════════════════════════════════════════════════════
describe('kindFromMime — 蓝本 :5-12', () => {
  it('空值兜底:null → doc', () => {
    expect(kindFromMime(null)).toBe('doc')
  })

  it('空值兜底:undefined → doc', () => {
    expect(kindFromMime(undefined)).toBe('doc')
  })

  it('空值兜底:空字符串 → doc(falsy 分支)', () => {
    expect(kindFromMime('')).toBe('doc')
  })

  it('分支 1 — 含 "pdf" → pdf', () => {
    expect(kindFromMime('application/pdf')).toBe('pdf')
  })

  it('分支 2 — 恰好等于 "text/markdown" → md', () => {
    expect(kindFromMime('text/markdown')).toBe('md')
  })

  it('分支 3 — 恰好等于 "text/x-source" → code', () => {
    expect(kindFromMime('text/x-source')).toBe('code')
  })

  it('分支 4 — 含 docx/pptx/xlsx → doc(三个各验一次)', () => {
    expect(kindFromMime('application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe('doc')
    expect(kindFromMime('application/vnd.openxmlformats-officedocument.presentationml.presentation.pptx')).toBe('doc')
    expect(kindFromMime('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.xlsx')).toBe('doc')
  })

  it('分支 5 — 含 "plain" → txt(真机 7 个已索引文件的实际 mime,见 F9)', () => {
    expect(kindFromMime('text/plain')).toBe('txt')
  })

  it('分支 6 — 未知 mime 落到 fallback → doc', () => {
    expect(kindFromMime('image/png')).toBe('doc')
  })

  it('includes("pdf") 的宽泛匹配网会兜住 docling 变体:"text/markdown+docling/pdf" → pdf,不是 md', () => {
    // 🔴 独立复核记录(不采信 brief/T0 报告未经验证的字面表述,治理 §9/裁定 R8 同款纪律):
    // brief 原文声称"把 `=== 'text/markdown'` 与 `includes('pdf')` 两支调换顺序 →
    // 本条断言必须报红"。亲手做 RED 探针后发现**不成立**:`=== 'text/markdown'` 是精确相等,
    // 'text/markdown+docling/pdf' 永远不可能精确等于 'text/markdown'(多了后缀),
    // 所以这两支在结构上互斥、调换顺序对这个输入零影响(node 实测:调换后仍返回 'pdf')。
    // 真正会因顺序改变结果的是**两个都用 `includes()` 的子串分支之间**(见下一条用例:
    // `includes('pdf')` vs `includes('plain')`)。本条断言本身仍然有效且真实
    // (它钉住的是"docling 变体不会被误判成 md"这个真实行为),只是不该被当作
    // "顺序敏感"的证据 —— 这个措辞已在报告里登记为对 brief 的一处订正。
    expect(kindFromMime('text/markdown+docling/pdf')).toBe('pdf')
    expect(kindFromMime('text/markdown+docling/pdf')).not.toBe('md')
  })

  it('🔴 分支顺序真正有语义之处:两个 includes() 子串分支之间("pdf" 与 "plain" 同时出现时,先到先得)', () => {
    // 判据(报告里贴 RED 探针):把 `includes('plain')` 挪到 `includes('pdf')` 之前 →
    // 本条断言必须报红(会变成 'txt')。这条输入是纯粹为区分"顺序敏感 vs 不敏感"两个分支对
    // 构造的边界样本(不代表任何真实后端 mime 取值,真机 mime 分布见 F9 §2③)。
    expect(kindFromMime('text/plain;pdf-scan')).toBe('pdf')
    expect(kindFromMime('text/plain;pdf-scan')).not.toBe('txt')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// basename / dirname —— 蓝本 :14-23,边界:空串 / 无斜杠 / 尾斜杠 / 根路径 / 多重斜杠
// ═══════════════════════════════════════════════════════════════════════════
describe('basename — 蓝本 :14-17', () => {
  it('空串 → ""', () => {
    expect(basename('')).toBe('')
  })
  it('null/undefined → ""', () => {
    expect(basename(null)).toBe('')
    expect(basename(undefined)).toBe('')
  })
  it('无斜杠 → 原样返回', () => {
    expect(basename('a.md')).toBe('a.md')
  })
  it('普通路径 → 取最后一段', () => {
    expect(basename('/DATA/Downloads/a.pdf')).toBe('a.pdf')
  })
  it('尾斜杠 → 取最后一个非空段(尾部空段被 filter(Boolean) 丢弃)', () => {
    expect(basename('/a/b/')).toBe('b')
  })
  it('根路径 "/" → pop() 落空,兜底返回原始入参 "/"', () => {
    expect(basename('/')).toBe('/')
  })
  it('多重斜杠 → filter(Boolean) 去掉空段后取最后一段', () => {
    expect(basename('a/b//c')).toBe('c')
  })
})

describe('dirname — 蓝本 :19-23', () => {
  it('空串 → ""', () => {
    expect(dirname('')).toBe('')
  })
  it('null/undefined → ""', () => {
    expect(dirname(null)).toBe('')
    expect(dirname(undefined)).toBe('')
  })
  it('🔴 无斜杠 dirname("b.md") = "/"', () => {
    expect(dirname('b.md')).toBe('/')
  })
  it('🔴 普通路径 dirname("/a/b.md") = "/a/"(带尾斜杠)', () => {
    expect(dirname('/a/b.md')).toBe('/a/')
  })
  it('尾斜杠输入 dirname("/a/b/") = "/a/"', () => {
    expect(dirname('/a/b/')).toBe('/a/')
  })
  it('根路径 dirname("/") = "/"', () => {
    expect(dirname('/')).toBe('/')
  })
  it('多重斜杠 dirname("a/b//c") = "/a/b/"', () => {
    expect(dirname('a/b//c')).toBe('/a/b/')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 真实 F5b 数据(见文件头 fixture 纪律说明)
// ═══════════════════════════════════════════════════════════════════════════

/** 取自 F5b `files[0].chunks[0].preview.text`,零截断,sha256 见文件头。 */
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
