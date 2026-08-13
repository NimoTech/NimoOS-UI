// SP8-P5f Task 6 — Component test for `WikiView.vue` (top half).
// Blueprint `NimoOS-UI` @ `7a6ee6b7` `src/views/AI/Knowledge/WikiView.vue` (314 lines).
// 🔴 T7 will continue writing this file (summary / directory / recent changes / source view toggle / rescan / §9.15 XSS cases).
//
// ═══ mock strategy (governance §4.1 requires explicit statement) ═══
// 🔴 **mock the four `service.wiki.*` methods of the shared package, use real `knowledgeStore`**, do not mock store.
//   Reason: same as `RootsView.test.ts` / `AllowlistView.test.ts`, plus one more **decisive** point for this page:
//   🔴 **N48's "404 → null, others re-thrown" layering is in the store** (`knowledgeStore.ts:715` / `:725`) —
//   if we mock out the store, that layer becomes equivalent to the test rewriting its own shadow implementation,
//   "404 becomes business state, 500 becomes catch" degrades to "I say it returns null and it returns null".
// 🔴 Shape (§4.1 table + `p5f-fixtures/README.md` §3):
//   · `service.wiki.getRoots` → **already normalized by shared package** (`NimoOS-Service/src/wiki.ts:85`
//     `normalizeRoot`) ⇒ 🔴 **camelCase**, **not** HTTP original PascalCase (N46).
//   · `service.wiki.getTree`  → **flat array**, already normalized to camelCase
//     (`wiki.ts:102 normalizeTreeNode`: `aiLabel` / `lastModified` / `userNotesUpdatedAt`).
//     🔴 Fixture copied in is **snake_case HTTP original**, this file uses `toStoreShape()`
//     to normalize explicitly — this step is **intentionally preserved**: copying camelCase directly
//     would lose the fact that "fixture records the true backend shape" (same approach as `wikiViewHelpers.test.ts`).
//   · `service.wiki.getNode` → camelCase `WikiNode` (`wiki.ts:112 normalizeNode`).
//   · `service.wiki.getRaw`  → `string`.
//   404 always has mock **reject an error with `response.status = 404`**, letting the store layer truly convert to `null`.
//
// ═══ fixtures are copies, not read at runtime (governance §4 / P5c §4.4) ═══
// Data copied verbatim into the `FIXTURE-COPY-BEGIN/END` blocks below with **three-level source tags** (ruling R3 constraint 1),
// **do not use `node:fs` to read `.superpowers/`** — that directory is covered by gitignore (SP7 lost it once).
// 🔴 **take only data fields, convert `__meta` to comments** (ruling R14 / `p5f-fixtures/README.md` §0.2).
// 🔴 Wiki samples are **all `.CONSTRUCTED`**, 🔴 **not real device data** (D1: `/v1/wiki/{roots,tree,node}`
//   device 90 second 0 byte timeout) — also cannot use it to overturn N46's naming conclusion (governance §9.18-2).
// Fixture equivalence confirmed by **programmatic byte-by-byte verification** (see "fixture copy self-check" group), not visual comparison.
// Read `.vue` source files always with `node:fs`, **never use Vite's `?raw`** (empty in vitest → false positive).
//
// ═══ environment pitfalls (verbatim reuse of proven solutions from `wikiViewHelpers.test.ts`) ═══
// This repo's `package.json` is `"type": "module"` ⇒ `__dirname` unavailable, use `import.meta.url`;
// `@types/node` already installed (SP8-P6 merged from master) ⇒ `node:fs` / `node:path` / `node:url` can be
// imported directly, **no need** for `@ts-expect-error` (existing suppress lines on sp8-ai branch were removed during merge).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import type { WikiNode, WikiRoot, WikiTreeNode } from '@nimotech/nimoos-service'
// i18n already set up globally by `vitest.setup.ts`, no need to set it up again — also **must not** create another `createI18n`
// (duplicate installation with the setup singleton, see `vitest-reporter-hides-warnings`).
import { useKnowledgeStore } from '../stores/knowledgeStore'
// 🔴 T7 / §9.15: **real** markdown renderer (includes DOMPurify), imported only to programmatically prove
// "it is not mocked" — **not** to replace DOM assertions at the component layer.
import { renderMarkdown } from '../../markdown/renderMarkdown'
import WikiView from './WikiView.vue'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SRC: string = readFileSync(resolve(__dirname, './WikiView.vue'), 'utf8')

// — vi.hoisted mock skeleton (governance §9: avoid ESM hoisting TDZ) —
const wiki = vi.hoisted(() => ({
  getRoots: vi.fn(),
  getTree: vi.fn(),
  getNode: vi.fn(),
  getRaw: vi.fn(),
}))
vi.mock('@nimotech/nimoos-service', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, service: { wiki } }
})

// `openDirInNewTab` is existing output from P5a-T5 (zero changes for this period), here only spy on
// "whether it was called with correct arguments", don't test its own behavior (precedent: `NotesView.test.ts:68`).
const openDirInNewTab = vi.hoisted(() => vi.fn())
// T7: the "byPath miss" branch of `childClick` calls `openFileInNewTab` (blueprint `:290`).
const openFileInNewTab = vi.hoisted(() => vi.fn())
vi.mock('../../services/openInApp', () => ({
  openDirInNewTab: (...args: unknown[]) => openDirInNewTab(...args),
  openFileInNewTab: (...args: unknown[]) => openFileInNewTab(...args),
}))

// 🔴 **never mock `renderMarkdown`** (governance §9.15 mandates: mock it out then claim XSS is verified = placebo test).
// The "§9.15 XSS" group in this file uses real `src/ai/markdown/renderMarkdown.ts` (contains DOMPurify),
// mounts real component and checks real DOM. The first assertion in that group **programmatically locks**
// the fact "it is not mocked" (`vi.isMockFunction(renderMarkdown) === false` + real render output self-check) —
// criterion: whoever adds `vi.mock('../../markdown/renderMarkdown', …)` in future, that assertion immediately fails.

// ═══════════════════════════════════════════════════════════════════════════
// FIXTURE-COPY-BEGIN  p5f-fixtures/wiki-tree.CONSTRUCTED.json  (only `normal` / `crossLevel` groups)
// Three-level source tag: **`.CONSTRUCTED`** — 🔴 **not real device data**. `__meta` converted to this comment (ruling R14),
// key points from original:
//   · label      : .CONSTRUCTED
//   · why        : GET /v1/wiki/tree device test 90 second timeout, 0 bytes (D1) ⇒ no real device sample.
//   · built_from : NimoOS-Wiki/route/v1/wiki.go:126-132 anonymous struct `sk`
//                  (**snake_case json tag**): path / level / ai_label /
//                  user_notes_updated_at / last_modified
//   · value_units: empty string valid for ai_label; last_modified is RFC3339 local timezone string,
//                  backend formatTS(ms<=0) returns **empty string** (wiki.go:47-52) — not '1970'
//   · normalized_shape: via NimoOS-Service/src/wiki.ts:102 normalizeTreeNode → camelCase
// 🔴 Device D1: `/v1/wiki/tree` 90 s zero bytes timeout ⇒ §9.17 determines "entire left tree always goes `treeError` branch",
//   device can only verify "load failure + retry". **This is not a defect, it's D1.**
const TREE_RAW_NORMAL = [
  { "path": "/DATA",           "level": "space",   "ai_label": "主数据盘",   "user_notes_updated_at": "", "last_modified": "2026-08-05T11:32:01+08:00" },
  { "path": "/DATA/Documents", "level": "project", "ai_label": "文档",       "user_notes_updated_at": "", "last_modified": "2026-08-05T10:12:00+08:00" },
  { "path": "/DATA/Documents/Specs", "level": "project", "ai_label": "", "user_notes_updated_at": "", "last_modified": "" }
]
// FIXTURE-COPY-END

// FIXTURE-COPY-BEGIN  p5f-fixtures/wiki-roots.normalized.CONSTRUCTED.json  (only `wikiRoots` array)
// Three-level source tag: **`.CONSTRUCTED`**. `__meta` converted to this comment (ruling R14):
//   · why        : same as wiki-roots.CONSTRUCTED.json — /roots device timeout, no real device sample.
//   · built_from : pass wiki-roots.CONSTRUCTED.json raw_response field by field through
//                  NimoOS-Service/src/wiki.ts:85 normalizeRoot.
//   · shape      : 🔴 camelCase — this is the outlet shape of store.state.wikiRoots (N46).
//   · note       : enabled normalized to boolean via `!!r.Enabled`;
//                  scanIntervalS/createdAt/lastScanAt defaulted via `|| 0`.
const ROOTS_NORMALIZED: WikiRoot[] = [
  {
    "id": "dfcd1840f5dab439cd9d7050aa5bafd0",
    "path": "/DATA",
    "level": "space",
    "watchMode": "auto",
    "storageMode": "inline",
    "enabled": true,
    "scanIntervalS": 21600,
    "createdAt": 1754280000000,
    "lastScanAt": 1754386321000,
    "needsReconcile": false
  },
  {
    "id": "9b1c77e0aa2f4d3e8c5106b4f7d2a318",
    "path": "/DATA/Documents",
    "level": "project",
    "watchMode": "scan_only",
    "storageMode": "inline",
    "enabled": false,
    "scanIntervalS": 3600,
    "createdAt": 1754281000000,
    "lastScanAt": 0,
    "needsReconcile": false
  }
]
// FIXTURE-COPY-END

// — T7 added two fixture copies ———————————————————————————————————————————
// FIXTURE-COPY-BEGIN  p5f-fixtures/wiki-node.CONSTRUCTED.json  (only `raw_response`)
// Three-level source tag: **`.CONSTRUCTED`** — 🔴 **not real device data**. `__meta` converted to this comment (ruling R14),
// key points from original (copied item by item from fixture's `__meta`):
//   · label       : .CONSTRUCTED
//   · why         : GET /v1/wiki/node device test 90 second timeout, 0 bytes (D1) ⇒ no real device sample.
//   · built_from  : NimoOS-Wiki/route/v1/wiki.go:16-42 nodeResponse / nodeChildEntry /
//                   nodeRecentEntry (**snake_case json tag**)
//   · omitempty_note: 🔴 nodeChildEntry's file_count / last_modified / is_opaque all have
//                   omitempty ⇒ when zero, **entire key missing**, not 0/''/false. Sample 'Archive'
//                   item intentionally omits these three keys to reproduce this shape (N49's `|| []`, `|| 0`, `!!` defaults are for it)
//   · summary_note: Summary is *string, backend currently always sends null
//   · op_values   : four known values for op create/modify/delete/rename → opToType maps to add/mod/del/ren;
//                   unknown values default to 'mod'. Sample intentionally contains unknown value 'chmod' to lock default branch
//   · recent_changes_count: 🔴 intentionally 12 items — changes' `.slice(0, 10)` needs 12 items to test the limit
//   · normalized_shape: via wiki.ts:112 normalizeNode → camelCase
//                   { path, level, aiLabel, summary, childMap[{name,fileCount,lastModified,isOpaque}],
//                     recentChanges[{path,op,at}], userNotes, parentWiki, subwikis, etag }
// 🔴 `key_sources` / `pending_count` are truly in the response, but **not accepted** by `normalizeNode` —
//   fixture preserves them, `toNodeShape()` drops them like `normalizeNode` (page never reads them).
interface RawChildEntry {
  name: string
  file_count?: number
  last_modified?: string
  is_opaque?: boolean
}
interface RawNodeResponse {
  path: string
  level: string
  ai_label: string
  summary: null
  child_map: RawChildEntry[]
  key_sources: unknown[]
  recent_changes: Array<{ path: string; op: string; at: string }>
  pending_count: number
  user_notes: string
  subwikis: unknown[]
  etag: string
}
const NODE_RAW_DATA: RawNodeResponse = {
  "path": "/DATA",
  "level": "space",
  "ai_label": "主数据盘",
  "summary": null,
  "child_map": [
    { "name": "Documents", "file_count": 128, "last_modified": "2026-08-05T10:12:00+08:00" },
    { "name": "Downloads", "file_count": 4,   "last_modified": "2026-08-04T22:01:00+08:00", "is_opaque": true },
    { "name": "notes.md",  "file_count": 1,   "last_modified": "2026-08-03T09:00:00+08:00" },
    { "name": "Archive" }
  ],
  "key_sources": [],
  "recent_changes": [
    { "path": "/DATA/Documents/a1.md", "op": "create", "at": "2026-08-05T11:00:00+08:00" },
    { "path": "/DATA/Documents/a2.md", "op": "modify", "at": "2026-08-05T10:59:00+08:00" },
    { "path": "/DATA/Documents/a3.md", "op": "delete", "at": "2026-08-05T10:58:00+08:00" },
    { "path": "/DATA/Documents/a4.md", "op": "rename", "at": "2026-08-05T10:57:00+08:00" },
    { "path": "/DATA/Documents/a5.md", "op": "chmod",  "at": "2026-08-05T10:56:00+08:00" },
    { "path": "/outside/a6.md",        "op": "modify", "at": "2026-08-05T10:55:00+08:00" },
    { "path": "/DATA/Documents/a7.md", "op": "modify", "at": "2026-08-05T10:54:00+08:00" },
    { "path": "/DATA/Documents/a8.md", "op": "modify", "at": "2026-08-05T10:53:00+08:00" },
    { "path": "/DATA/Documents/a9.md", "op": "modify", "at": "2026-08-05T10:52:00+08:00" },
    { "path": "/DATA/Documents/a10.md","op": "modify", "at": "2026-08-05T10:51:00+08:00" },
    { "path": "/DATA/Documents/a11.md","op": "modify", "at": "2026-08-05T10:50:00+08:00" },
    { "path": "/DATA/Documents/a12.md","op": "modify", "at": "" }
  ],
  "pending_count": 0,
  "user_notes": "",
  "subwikis": [],
  "etag": "W/\"9f2c1b\""
}
// FIXTURE-COPY-END

// FIXTURE-COPY-BEGIN  p5f-fixtures/wiki-raw-DATA.REAL.md  (**excerpt**: first 22 lines, copied verbatim)
// Three-level source tag: **`.REAL`** — this is **the true response body from device `GET /v1/wiki/raw?path=/DATA`**
// (README §0 table: `wiki-raw-DATA.REAL.md` is the only one of four `.REAL` **unchanged byte-for-byte**,
//  md5 `c0449363eb1069a36c9941a0fb842e18` / 3430 bytes).
// 🔴 **excerpt**: only first 22 lines of 78 total (front-matter + system section header + Summary + Child Map start) —
//   sufficient to cover six markdown structures: front-matter / HTML comment / heading / italics / unordered list / inline code,
//   §9.15's "normal path still renders correctly" uses this as input. **values unchanged by one character**, only truncated.
const WIKI_RAW_REAL_EXCERPT = [
  '---',
  'wiki_version: 1',
  'root_id: dfcd1840f5dab439cd9d7050aa5bafd0',
  'path: /DATA',
  'level: space',
  'generated_at: 2026-08-05T11:32:01+08:00',
  'generator: nimoos-wiki/1.9.0-alpha1',
  'checksum: 431cf74b0f811ea3606bf8330b530af197411893039dd9604ec650045da9d9ac',
  '---',
  '',
  '<!-- BEGIN: system -->',
  '<!-- 这段由系统自动维护,请勿手动编辑。要写笔记请在文件末尾的 User Notes 区域。 -->',
  '',
  '## Summary',
  '_暂未生成（待 AI 摘要 worker 处理）_',
  '',
  '## Child Map',
  '- `.snapshots/` — 0 个文件 (已跳过)',
  '- `.system_data/` — 目录',
  '- `Amalfi Coast/` — 目录',
  '- `AppData/` — 目录',
  '- `Documents/` — 目录',
].join('\n')
// FIXTURE-COPY-END

/**
 * Equivalent of shared package `wiki.ts:112 normalizeNode` (T7) — same reason as `toStoreShape`:
 * fixture records **true backend shape** (snake_case + omitempty missing keys), this normalization step must stay in view.
 * 🔴 `|| 0` / `|| ''` / `!!` three defaults copied as-is — 'Archive' item all three keys missing, caught by them (N49 family).
 */
function toNodeShape(n: RawNodeResponse): WikiNode {
  return {
    path: n.path,
    level: n.level || '',
    aiLabel: n.ai_label || '',
    summary: n.summary || null,
    childMap: n.child_map.map((c) => ({
      name: c.name,
      fileCount: c.file_count || 0,
      lastModified: c.last_modified || '',
      isOpaque: !!c.is_opaque,
    })),
    recentChanges: n.recent_changes.map((c) => ({ path: c.path, op: c.op, at: c.at || '' })),
    userNotes: n.user_notes || '',
    parentWiki: '',
    subwikis: n.subwikis || [],
    etag: n.etag || '',
  }
}
const NODE_DATA: WikiNode = toNodeShape(NODE_RAW_DATA)

/**
 * Equivalent of shared package `wiki.ts:102 normalizeTreeNode` — convert HTTP original snake_case to
 * store outlet camelCase. 🔴 **this file must not copy fixture directly as camelCase**:
 * fixture records **true backend shape**, this normalization step must stay in view (N46 is the easiest thing to get wrong this period).
 */
function toStoreShape(n: Record<string, string>): WikiTreeNode {
  return {
    path: n.path,
    level: n.level || '',
    aiLabel: n.ai_label || '',
    userNotesUpdatedAt: n.user_notes_updated_at || '',
    lastModified: n.last_modified || '',
  }
}
const TREE_NORMAL: WikiTreeNode[] = TREE_RAW_NORMAL.map(toStoreShape)

/**
 * T7 — create an **observable** difference surface for `node`.
 * 🔴 T6 review "convert to black box" checklist items 1/2 require replacing `vm.node` assertions with DOM assertions, and
 * `node.aiLabel` has **no render touchpoints anywhere on the page** (the `<b>` in `kw-meta` reads **tree node**'s
 * `selTreeNode.aiLabel`, not the article node) ⇒ the only observable place for `node` is `childMap`
 * (directory section) and `recentChanges` (recent changes). This helper stuffs a named child item into `childMap`,
 * assertion lands on `.kw-child-name`.
 */
function nodeWithChild(path: string, childName: string): WikiNode {
  return {
    ...nodeFor(path),
    childMap: [{ name: childName, fileCount: 1, lastModified: '', isOpaque: false }],
  }
}

/** Minimal normalized shape for `/wiki/node` (only needs one valid non-null value; **assertions with data always use fixture copies**). */
function nodeFor(path: string): WikiNode {
  return {
    path,
    level: 'space',
    aiLabel: '',
    summary: null,
    childMap: [],
    recentChanges: [],
    userNotes: '',
    parentWiki: '',
    subwikis: [],
    etag: '',
  }
}

/** Create an axios-style error with HTTP status code (store's `isNotFound` reads `e.response.status`). */
function httpError(status: number, message = 'boom'): Error & { response: { status: number } } {
  const e = new Error(message) as Error & { response: { status: number } }
  e.response = { status }
  return e
}

/** Controllable promise — for interleaving / gating tests. */
function makeDeferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const mountedWrappers: Array<ReturnType<typeof mount>> = []
const flush = async (): Promise<void> => {
  await flushPromises()
  await nextTick()
}

function makeRouter() {
  return createRouter({
    history: createWebHashHistory('/app/'),
    routes: [
      { path: '/ai/knowledge/wiki', name: 'KnowledgeWiki', component: WikiView },
      // Target pushed by "Manage knowledge roots" button — if not registered, vue-router logs "No match found" warning.
      { path: '/ai/knowledge/roots', name: 'KnowledgeRoots', component: { template: '<div/>' } },
    ],
  })
}

interface MountOpts {
  query?: Record<string, string>
  /** `wikiRoots` preset into store (test the `if (!wikiRoots.length)` side in `created`). */
  seedRoots?: WikiRoot[]
}

/** Mount. Component's `onMounted` itself calls `loadRoots()` + `loadTree()` (blueprint `created()`),
 *  so don't pre-warm here — let those two calls truly run, maintaining "mount triggers fetch". */
async function mountPage(opts: MountOpts = {}) {
  const router = makeRouter()
  await router.push({ path: '/ai/knowledge/wiki', query: opts.query ?? {} })
  await router.isReady()
  // 🔴 spy must be installed before mount: the `router` that `select()` gets is this instance,
  //   spyOn swaps out the method on the instance ⇒ component's call also goes through spy (default callThrough).
  const replaceSpy = vi.spyOn(router, 'replace')
  const store = useKnowledgeStore()
  if (opts.seedRoots) store.wikiRoots = opts.seedRoots
  // 🔴 **don't pass `plugins: [i18n]`** — `vitest.setup.ts` already installed **the same** i18n singleton into
  //   `config.global.plugins`, passing it again logs `Plugin has already been applied` warning.
  const w = mount(WikiView, { global: { plugins: [router] } })
  mountedWrappers.push(w)
  await flush()
  return { w, router, store, replaceSpy }
}

/** VTU's `.text()` only trims, doesn't collapse internal whitespace; normalize cross-line concatenated text before comparing. */
const norm = (s: string): string => s.replace(/\s+/g, ' ').trim()

const treeRows = (w: ReturnType<typeof mount>) => w.findAll('.kw-tree-scroll .kw-node')
const rowPaths = (w: ReturnType<typeof mount>) => treeRows(w).map((r) => r.find('.kw-node-name').text())

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  vi.useRealTimers()
  wiki.getRoots.mockResolvedValue(ROOTS_NORMALIZED.map((r) => ({ ...r })))
  wiki.getTree.mockResolvedValue(TREE_NORMAL.map((n) => ({ ...n })))
  wiki.getNode.mockImplementation((p: string) => Promise.resolve(nodeFor(p)))
  wiki.getRaw.mockImplementation((p: string) => Promise.resolve('# ' + p))
})

afterEach(() => {
  while (mountedWrappers.length) mountedWrappers.pop()!.unmount()
  document.body.innerHTML = ''
  vi.useRealTimers()
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 fixture copy equivalence — governance §4 "copy into test + programmatic byte-by-byte verification".
// Comparing **shape and values** (not reading JSON again): three-level tags, field name style, type all locked in.
// Criterion: any field name written as camelCase (tree side) / PascalCase (root side) → this group immediately fails.
describe('WikiView — fixture copy self-check (N46: HTTP original snake_case → store outlet camelCase)', () => {
  it('🔴 no __meta in fixture copy at all (ruling R14: take only data fields, convert source to comment)', () => {
    for (const n of TREE_RAW_NORMAL) expect(Object.keys(n)).not.toContain('__meta')
    for (const r of ROOTS_NORMALIZED) expect(Object.keys(r)).not.toContain('__meta')
    expect(TREE_RAW_NORMAL.length, '抄本为空 —— 防空转').toBe(3)
    expect(ROOTS_NORMALIZED.length, '抄本为空 —— 防空转').toBe(2)
  })

  it('🔴 tree fixture copy is HTTP original snake_case (`ai_label` / `last_modified`), not camelCase', () => {
    for (const n of TREE_RAW_NORMAL) {
      expect(Object.keys(n).sort()).toEqual([
        'ai_label',
        'last_modified',
        'level',
        'path',
        'user_notes_updated_at',
      ])
      expect(Object.keys(n)).not.toContain('aiLabel')
      expect(Object.keys(n)).not.toContain('lastModified')
    }
  })

  it('🔴 root fixture copy is store outlet camelCase (not HTTP original PascalCase)', () => {
    for (const r of ROOTS_NORMALIZED) {
      expect(Object.keys(r)).toContain('watchMode')
      expect(Object.keys(r)).toContain('scanIntervalS')
      expect(Object.keys(r)).not.toContain('WatchMode')
      expect(Object.keys(r)).not.toContain('ScanIntervalS')
      expect(typeof r.enabled, 'enabled must be normalized to boolean').toBe('boolean')
    }
  })

  it('toStoreShape same as shared package normalizeTreeNode (empty values all default to empty string)', () => {
    expect(TREE_NORMAL[0]).toEqual({
      path: '/DATA',
      level: 'space',
      aiLabel: '主数据盘',
      userNotesUpdatedAt: '',
      lastModified: '2026-08-05T11:32:01+08:00',
    })
    // third item last_modified is empty string (true form of backend formatTS(ms<=0)) — updatedFmt defaults to it.
    expect(TREE_NORMAL[2].lastModified).toBe('')
    expect(TREE_NORMAL[2].aiLabel).toBe('')
  })

  // — T7 added two fixture copies ——————————————————————————————————————
  it('🔴 T7 — node fixture copy has no __meta, and is HTTP original snake_case (not camelCase)', () => {
    expect(Object.keys(NODE_RAW_DATA)).not.toContain('__meta')
    expect(Object.keys(NODE_RAW_DATA).sort()).toEqual([
      'ai_label',
      'child_map',
      'etag',
      'key_sources',
      'level',
      'path',
      'pending_count',
      'recent_changes',
      'subwikis',
      'summary',
      'user_notes',
    ])
    expect(Object.keys(NODE_RAW_DATA)).not.toContain('childMap')
    expect(Object.keys(NODE_RAW_DATA)).not.toContain('recentChanges')
    // prevent empty loop + prerequisite of limit criterion: must **truly** have 12 items, fewer than 11 can't test slice(0, 10).
    expect(NODE_RAW_DATA.recent_changes.length, 'fixture copy not 12 items — slice(0,10) line will degrade').toBe(12)
    expect(NODE_RAW_DATA.child_map.length).toBe(4)
  })

  it('🔴 T7 — node fixture copy reproduces backend omitempty "entire key missing" shape (not 0 / "" / false)', () => {
    const archive = NODE_RAW_DATA.child_map[3]!
    expect(archive.name).toBe('Archive')
    expect(Object.keys(archive), 'Archive item should only have name key (omitempty)').toEqual(['name'])
    expect('file_count' in archive).toBe(false)
    expect('last_modified' in archive).toBe(false)
    expect('is_opaque' in archive).toBe(false)
    // toNodeShape (= normalizeNode) defaults the three absent keys to 0 / '' / false.
    const norm3 = NODE_DATA.childMap[3]!
    expect(norm3).toEqual({ name: 'Archive', fileCount: 0, lastModified: '', isOpaque: false })
  })

  it('🔴 T7 — toNodeShape same as shared package normalizeNode; `key_sources`/`pending_count` dropped', () => {
    expect(NODE_DATA.path).toBe('/DATA')
    expect(NODE_DATA.aiLabel).toBe('主数据盘')
    expect(NODE_DATA.summary).toBeNull()
    expect(NODE_DATA.childMap[1]).toEqual({
      name: 'Downloads',
      fileCount: 4,
      lastModified: '2026-08-04T22:01:00+08:00',
      isOpaque: true,
    })
    expect(NODE_DATA.recentChanges[11]).toEqual({ path: '/DATA/Documents/a12.md', op: 'modify', at: '' })
    expect(Object.keys(NODE_DATA)).not.toContain('key_sources')
    expect(Object.keys(NODE_DATA)).not.toContain('pending_count')
  })

  it('🔴 T7 — `.REAL` .wiki.md excerpt: 22 lines, copied verbatim, covers six markdown structures', () => {
    const lines = WIKI_RAW_REAL_EXCERPT.split('\n')
    expect(lines.length, 'excerpt line count changed — fixture copy was modified').toBe(22)
    expect(lines[0]).toBe('---')
    expect(lines[8]).toBe('---')
    expect(lines[3]).toBe('path: /DATA')
    expect(lines[10]).toBe('<!-- BEGIN: system -->')
    expect(lines[13]).toBe('## Summary')
    expect(lines[17]).toBe('- `.snapshots/` — 0 个文件 (已跳过)')
    // 🔴 descriptor of `.REAL`: it's device response body, **not** .CONSTRUCTED — don't mix the two tags.
    expect(WIKI_RAW_REAL_EXCERPT).toContain('nimoos-wiki/1.9.0-alpha1')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 left tree four states (plan T6-3) + governance §5.2 "loadTree without stale guard" proof guard.
describe('WikiView — left tree four states (blueprint :6-31)', () => {
  it('treeLoading → 6 k-skel (blueprint :6-8, `v-for="i in 6"`)', async () => {
    const d = makeDeferred<WikiTreeNode[]>()
    wiki.getTree.mockReturnValue(d.promise)
    const { w } = await mountPage()
    expect(w.findAll('.kw-tree-scroll .k-skel')).toHaveLength(6)
    expect(w.find('.kw-tree-note').exists(), 'no tree-note should appear during loading').toBe(false)
    expect(treeRows(w)).toHaveLength(0)
    d.resolve([])
    await flush()
  })

  it('treeError → kw-tree-note + retry button, clicking it truly re-sends once (blueprint :9-14)', async () => {
    wiki.getTree.mockRejectedValueOnce(new Error('boom'))
    const { w } = await mountPage()
    const note = w.find('.kw-tree-note')
    expect(note.exists()).toBe(true)
    expect(norm(note.text())).toContain('加载 Wiki 树失败')
    const retry = note.find('button.k-btn.outline')
    expect(retry.exists(), 'retry button not rendered').toBe(true)
    expect(norm(retry.text())).toBe('重试')
    expect(wiki.getTree).toHaveBeenCalledTimes(1)
    await retry.trigger('click')
    await flush()
    expect(wiki.getTree, 'retry button did not re-send loadTree').toHaveBeenCalledTimes(2)
    // second call succeeds ⇒ back to tree state
    expect(rowPaths(w)).toEqual(['/DATA', 'Documents'])
  })

  it('🔴 retry button entire block not rendered during treeLoading (governance §5.2: rationale for loadTree without stale guard)', async () => {
    // [Why this is a "without stale guard" guard] Retry button is the only
    // trigger point for `loadTree` other than onMounted. First call sets treeLoading to true immediately, and the button's
    // `v-else-if="treeError"` branch is positioned after `v-if="treeLoading"` ⇒ while request in flight button **doesn't exist** ⇒ cannot send two concurrently
    // ⇒ scenario of "first arrives after second" never happens. Whoever changes the three-state layout to "retry button always present", this test fails first.
    wiki.getTree.mockRejectedValueOnce(new Error('boom'))
    const { w } = await mountPage()
    const retry = w.find('.kw-tree-note button.k-btn.outline')
    expect(retry.exists()).toBe(true)
    const d = makeDeferred<WikiTreeNode[]>()
    wiki.getTree.mockReturnValue(d.promise)
    await retry.trigger('click')
    await nextTick()
    expect(wiki.getTree).toHaveBeenCalledTimes(2)
    expect(w.find('.kw-tree-note').exists(), 'second call in flight tree-note still there — button can be clicked again').toBe(false)
    expect(
      w.find('.kw-tree-note button').exists(),
      '🔴 retry button still clickable during loading ⇒ loadTree must add stale guard',
    ).toBe(false)
    expect(w.findAll('.kw-tree-scroll .k-skel')).toHaveLength(6)
    d.resolve([])
    await flush()
  })

  it('empty tree → left "not yet generated" message + right onboarding (blueprint :15-17 / :39-46)', async () => {
    wiki.getTree.mockResolvedValue([])
    const { w } = await mountPage()
    expect(norm(w.find('.kw-tree-note').text())).toBe('还没有生成任何 wiki')
    expect(w.find('.kw-tree-note button').exists(), 'empty tree state should not have retry button').toBe(false)
    const pending = w.find('.kw-pending')
    expect(pending.exists()).toBe(true)
    expect(norm(pending.find('.kw-pending-title').text())).toBe('还没有生成任何 wiki')
    expect(norm(pending.find('.kw-pending-sub').text())).toBe(
      '添加知识根后,Wiki 导航会自动从你的目录生成。',
    )
    expect(norm(pending.find('button.k-btn.primary').text())).toBe('管理知识根')
  })

  it('empty tree onboarding "Manage knowledge roots" button pushes to /ai/knowledge/roots (blueprint :43)', async () => {
    wiki.getTree.mockResolvedValue([])
    const { w, router } = await mountPage()
    await w.find('.kw-pending button.k-btn.primary').trigger('click')
    await flush()
    expect(router.currentRoute.value.path).toBe('/ai/knowledge/roots')
  })

  it('tree present → kw-node list (blueprint :18-31), onboarding screen does not appear', async () => {
    const { w } = await mountPage()
    expect(rowPaths(w)).toEqual(['/DATA', 'Documents'])
    expect(w.find('.kw-pending').exists(), 'onboarding should not appear when tree present').toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 visibleNodes / isOpen / toggle / nodeClick (plan T6-4)
describe('WikiView — tree expand/collapse and indentation (blueprint :178-186 / :239-248)', () => {
  it('top-level roots expanded on mount, deep nodes collapsed by default (blueprint :228 `openPaths = roots.map(...)`)', async () => {
    const { w } = await mountPage()
    // /DATA expanded ⇒ can see Documents; Documents collapsed ⇒ cannot see Specs.
    expect(rowPaths(w)).toEqual(['/DATA', 'Documents'])
    expect(treeRows(w)[0].find('.kw-node-chev').attributes('data-open')).toBe('true')
    expect(treeRows(w)[1].find('.kw-node-chev').attributes('data-open')).toBe('false')
  })

  it('🔴 indentation copies `paddingLeft: (8 + depth * 14) + "px"` verbatim (blueprint :22)', async () => {
    const { w } = await mountPage()
    expect(treeRows(w)[0].attributes('style')).toContain('padding-left: 8px')
    expect(treeRows(w)[1].attributes('style')).toContain('padding-left: 22px')
    // after expanding second level, third level is 8 + 2*14 = 36px.
    await treeRows(w)[1].find('.kw-node-chev').trigger('click')
    await flush()
    expect(rowPaths(w)).toEqual(['/DATA', 'Documents', 'Specs'])
    expect(treeRows(w)[2].attributes('style')).toContain('padding-left: 36px')
  })

  it('toggle is pure flip: click again to collapse (blueprint :240-244)', async () => {
    const { w } = await mountPage()
    const chev = () => treeRows(w)[1].find('.kw-node-chev')
    await chev().trigger('click')
    await flush()
    expect(rowPaths(w)).toEqual(['/DATA', 'Documents', 'Specs'])
    await chev().trigger('click')
    await flush()
    expect(rowPaths(w)).toEqual(['/DATA', 'Documents'])
  })

  it('🔴 chevron @click.stop: clicking it only collapses/expands, **does not** trigger whole-line selection (blueprint :26)', async () => {
    const { w } = await mountPage()
    // initial selection is roots[0] = /DATA.
    expect(treeRows(w)[0].attributes('data-active')).toBe('true')
    expect(treeRows(w)[1].attributes('data-active')).toBe('false')
    const nodeCallsBefore = wiki.getNode.mock.calls.length
    await treeRows(w)[1].find('.kw-node-chev').trigger('click')
    await flush()
    // expand takes effect, but selection didn't change, also no new article fetch request for Documents.
    expect(rowPaths(w)).toEqual(['/DATA', 'Documents', 'Specs'])
    expect(treeRows(w)[0].attributes('data-active'), 'clicking chevron moved selection — @click.stop lost').toBe('true')
    expect(treeRows(w)[1].attributes('data-active')).toBe('false')
    expect(wiki.getNode.mock.calls.length, 'clicking chevron triggered fetchArticle — @click.stop lost').toBe(
      nodeCallsBefore,
    )
  })

  it('rows without children render empty chevron placeholder (blueprint :27), rows with children have data-open', async () => {
    const { w } = await mountPage()
    await treeRows(w)[1].find('.kw-node-chev').trigger('click')
    await flush()
    const specChev = treeRows(w)[2].find('.kw-node-chev')
    expect(specChev.exists()).toBe(true)
    expect(specChev.attributes('data-open'), 'Specs has no children ⇒ no data-open').toBeUndefined()
    expect(specChev.element.children.length, 'empty placeholder should have no icon').toBe(0)
  })

  it('top-level roots use drive icon, children use folder icon (blueprint :28 `depth === 0 ? …`)', async () => {
    const { w } = await mountPage()
    const icoTitles = treeRows(w).map((r) => r.find('.kw-node-ico svg').attributes('data-glyph'))
    // KIcon without data-glyph degrades to undefined — comparing path data is more stable: only check two rows have different icons.
    const html0 = treeRows(w)[0].find('.kw-node-ico').html()
    const html1 = treeRows(w)[1].find('.kw-node-ico').html()
    expect(icoTitles.length).toBe(2)
    expect(html0, 'top-level root and children used same icon — `depth === 0` ternary lost').not.toBe(html1)
  })

  it('🔴 nodeClick click whole row: select + expand (blueprint :245-248)', async () => {
    const { w } = await mountPage()
    await treeRows(w)[1].trigger('click')
    await flush()
    expect(treeRows(w)[1].attributes('data-active')).toBe('true')
    expect(treeRows(w)[0].attributes('data-active')).toBe('false')
    // 展开:Specs 出现。⚠️ 这一半的实际提供者是 `select()` 的祖先循环
    // (蓝本 :247 那行是不可达分支,见 WikiView.vue 里 nodeClick 的申报注释)。
    expect(rowPaths(w)).toEqual(['/DATA', 'Documents', 'Specs'])
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 K56 — move breadcrumb's `:key` to `<template v-for>` itself (Vue 3 compiler requirement),
//    rendered DOM sequence must match blueprint :50-53 item by item.
describe('WikiView — K56 breadcrumb DOM sequence (blueprint :48-55)', () => {
  it('🔴 button / span("/") alternate, end with span.cur', async () => {
    const { w } = await mountPage({ query: { path: '/DATA/Documents/Specs' } })
    const crumb = w.find('.kw-crumb')
    expect(crumb.exists()).toBe(true)
    const kids = Array.from(crumb.element.children)
    expect(kids.length, 'breadcrumb child count wrong — prevent empty').toBe(5)
    expect(kids.map((el) => el.tagName)).toEqual(['BUTTON', 'SPAN', 'BUTTON', 'SPAN', 'SPAN'])
    expect(kids.map((el) => norm(el.textContent || ''))).toEqual([
      '/DATA', // top-level root shows full path (buildWikiTree's `t.name = n.path`)
      '/',
      'Documents',
      '/',
      'Specs',
    ])
    expect(kids[1].className).toBe('')
    expect(kids[3].className).toBe('')
    expect(kids[4].className, 'end must be .cur').toBe('cur')
  })

  it('breadcrumb only lists **ancestors**, current node does not appear in buttons (blueprint :188 `slice(0, -1)`)', async () => {
    const { w } = await mountPage({ query: { path: '/DATA/Documents/Specs' } })
    const btns = w.findAll('.kw-crumb button')
    expect(btns.map((b) => norm(b.text()))).toEqual(['/DATA', 'Documents'])
  })

  it('click breadcrumb button to jump back to that level (blueprint :51)', async () => {
    const { w, router } = await mountPage({ query: { path: '/DATA/Documents/Specs' } })
    await w.findAll('.kw-crumb button')[1].trigger('click')
    await flush()
    expect(norm(w.find('.kw-crumb .cur').text())).toBe('Documents')
    expect(router.currentRoute.value.query.path).toBe('/DATA/Documents')
  })

  it('when top-level root selected breadcrumb only has .cur item (crumbParents empty)', async () => {
    const { w } = await mountPage()
    const kids = Array.from(w.find('.kw-crumb').element.children)
    expect(kids.length).toBe(1)
    expect(kids[0].className).toBe('cur')
    expect(norm(kids[0].textContent || '')).toBe('/DATA')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 select() three tasks (plan T6-5)
describe('WikiView — select() three tasks (blueprint :249-260)', () => {
  it('🔴 ② expand **every single** ancestor (criterion: remove trailFor loop → this test must fail)', async () => {
    // deep link directly to three-level node: loadTree only puts top-level root in openPaths, middle layer
    // `/DATA/Documents` entirely relies on select()'s ancestor loop to expand. without loop ⇒ Specs row invisible in tree.
    const { w } = await mountPage({ query: { path: '/DATA/Documents/Specs' } })
    expect(rowPaths(w), 'ancestors not expanded ⇒ selected node invisible in tree').toEqual([
      '/DATA',
      'Documents',
      'Specs',
    ])
    expect(treeRows(w)[2].attributes('data-active')).toBe('true')
  })

  it('🔴 ③ 写 `?path=`(router.replace,值与初始值不同 —— §9.14-3 防零判别力)', async () => {
    // 初始:无 query ⇒ loadTree 选 roots[0] 并 replace 成 ?path=/DATA。
    const { w, router, replaceSpy } = await mountPage()
    expect(router.currentRoute.value.query.path).toBe('/DATA')
    replaceSpy.mockClear()
    // 🔴 回写值必须**与当前值不同**,否则 Vue watch 的 Object.is 前置去重让回调压根不执行。
    await treeRows(w)[1].trigger('click')
    await flush()
    expect(replaceSpy, 'select() 没写 query').toHaveBeenCalledTimes(1)
    expect(router.currentRoute.value.query.path).toBe('/DATA/Documents')
    expect(router.currentRoute.value.query.path).not.toBe('/DATA')
  })

  it('🔴 `fromRoute: true` 时**不**写 query(防 watch → replace → watch 回环)', async () => {
    // 深链命中 ⇒ loadTree 里 `fromRoute: q === initial` 为 true ⇒ 一发 replace 都不该有。
    const { router, replaceSpy } = await mountPage({ query: { path: '/DATA/Documents' } })
    expect(replaceSpy, 'fromRoute 那一支仍写了 query —— 会和 watch 互弹').not.toHaveBeenCalled()
    expect(router.currentRoute.value.query.path).toBe('/DATA/Documents')
  })

  it('`?path=` 未命中时初始选 roots[0],并把 query 改写成它(fromRoute 为 false 那一支)', async () => {
    const { router, replaceSpy } = await mountPage({ query: { path: '/not/in/tree' } })
    expect(replaceSpy).toHaveBeenCalledTimes(1)
    expect(router.currentRoute.value.query.path).toBe('/DATA')
  })

  it('select() 对 byPath 里没有的路径直接早退(蓝本 :250)', async () => {
    const { w, store } = await mountPage()
    const before = wiki.getNode.mock.calls.length
    const toast = vi.spyOn(store, 'toast')
    // 只能从「query 变成树外路径」这条路走到 select 的调用点之前;这里直接验
    // 「树外 query 不改变任何东西」——两层守卫(watch 的 byPath 条件 + select 的早退)同解。
    await w.vm.$router.replace({ query: { path: '/nope/nope' } })
    await flush()
    expect(norm(w.find('.kw-crumb .cur').text()), '选中被树外路径改掉了').toBe('/DATA')
    expect(wiki.getNode.mock.calls.length).toBe(before)
    expect(toast).not.toHaveBeenCalled()
  })

  it('🔴 N57 —— `router.replace` reject 被 `.catch(() => {})` 吞掉,后续照常取文章', async () => {
    const { w, replaceSpy } = await mountPage()
    replaceSpy.mockClear() // 挂载时那一发(初始选中写 ?path=/DATA)不算
    replaceSpy.mockImplementation(() => Promise.reject(new Error('NavigationDuplicated')))
    const before = wiki.getNode.mock.calls.length
    await treeRows(w)[1].trigger('click')
    await flush()
    // 没有抛出(用例走到这里就说明没炸),且 fetchArticle 照常发了。
    expect(replaceSpy).toHaveBeenCalledTimes(1)
    expect(wiki.getNode.mock.calls.length).toBe(before + 1)
    expect(treeRows(w)[1].attributes('data-active')).toBe('true')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 N56 —— 深链的两半(计划书 T6-6)。**不许统一成 `immediate: true`**。
describe('WikiView —— N56 深链第一半:loadTree 里读一次 route.query.path(蓝本 :230-232)', () => {
  it('query 命中 → 选它(不是 roots[0])', async () => {
    const { w } = await mountPage({ query: { path: '/DATA/Documents' } })
    expect(norm(w.find('.kw-crumb .cur').text())).toBe('Documents')
    expect(norm(w.find('.kw-title').text())).toBe('TREEDocuments')
    expect(wiki.getNode).toHaveBeenCalledWith('/DATA/Documents')
  })

  it('query 未命中 → 退回 roots[0]', async () => {
    const { w } = await mountPage({ query: { path: '/DATA/Nope' } })
    expect(norm(w.find('.kw-crumb .cur').text())).toBe('/DATA')
    expect(wiki.getNode).toHaveBeenCalledWith('/DATA')
  })

  it('无 query 且无 roots → initial 为 "",什么都不选(右栏走 onboarding)', async () => {
    wiki.getTree.mockResolvedValue([])
    const { w } = await mountPage()
    expect(w.find('.kw-crumb').exists(), 'sel 为空时不该渲染面包屑').toBe(false)
    expect(w.find('.kw-pending').exists()).toBe(true)
    expect(wiki.getNode, '没有选中却发了取文章请求').not.toHaveBeenCalled()
  })
})

describe('WikiView —— N56 深链第二半:watch 无 immediate(蓝本 :210-214)', () => {
  it('🔴 挂载后改地址栏 query → 真的切换(判据:删掉 watch → 本条必须报红)', async () => {
    // 记忆 `newui-router-query-only-no-remount`:只在 onMounted 里读一次 query 的写法,
    // 用户改地址栏一行都不跑。这里走的是**挂载之后**的一次 query 变更。
    const { w, router } = await mountPage()
    expect(norm(w.find('.kw-crumb .cur').text())).toBe('/DATA')
    await router.replace({ query: { path: '/DATA/Documents/Specs' } })
    await flush()
    expect(norm(w.find('.kw-crumb .cur').text()), 'watch 没接住 query 变更').toBe('Specs')
    expect(wiki.getNode).toHaveBeenCalledWith('/DATA/Documents/Specs')
    // 祖先也被展开(select 的第 ② 件事在 watch 这条路径上同样生效)。
    expect(rowPaths(w)).toEqual(['/DATA', 'Documents', 'Specs'])
  })

  it('🔴 `v !== sel` 那一条:select() 自己写回的 query 不会再触发一次取文章(防回环)', async () => {
    // 🔴 §9.14-3 —— 这才是「相同值不重复」**有判别力**的形态:
    //   点树行 → select() 设 sel 并 router.replace 写 query → watch 被这次写触发,
    //   此时 `v === sel` ⇒ 守卫拦住,不再 select 第二次。
    //   判据:去掉 `v !== sel.value` → fetchArticle 会被再发一次(getNode 多一发)。
    //   ⚠️ 反面写法(「把 query 设成和现在一样的值」)零判别力:Vue watch 的 Object.is
    //   前置去重让回调**压根不执行**,产品码有没有守卫都一样绿。
    const { w } = await mountPage()
    wiki.getNode.mockClear()
    wiki.getRaw.mockClear()
    await treeRows(w)[1].trigger('click')
    await flush()
    expect(wiki.getNode.mock.calls.map((c: unknown[]) => c[0])).toEqual(['/DATA/Documents'])
    expect(wiki.getRaw.mock.calls.map((c: unknown[]) => c[0])).toEqual(['/DATA/Documents'])
  })

  it('`byPath[v]` 那一条:query 指向树外路径时一动不动', async () => {
    // ⚠️ 申报:watch 的 `byPath[v]` 与 `select()` 自己的 `if (!byPath[path]) return` 是
    //   两层同解的防御 —— 单独去掉 watch 那一层不会改变可观测行为。本条钉的是
    //   **合起来的可观测行为**(树外 query 不改选中、不发请求),两层都被破才会红。
    const { w, router } = await mountPage()
    wiki.getNode.mockClear()
    await router.replace({ query: { path: '/DATA/Documents/Nope' } })
    await flush()
    expect(norm(w.find('.kw-crumb .cur').text())).toBe('/DATA')
    expect(wiki.getNode).not.toHaveBeenCalled()
  })

  it('watch **不是** immediate —— 挂载那一刻 byPath 还没建好,靠的是 loadTree 那一半', async () => {
    // 判别形态:getTree 迟迟不回包时,query 里已经有一个合法路径,但树还没建
    //   ⇒ 若 watch 是 immediate,它会在 byPath 为空时白跑一次(静默什么都不做),
    //     真正生效的仍然只有 loadTree 那一半 —— 本条钉住「回包之前不选中、回包之后才选中」。
    const d = makeDeferred<WikiTreeNode[]>()
    wiki.getTree.mockReturnValue(d.promise)
    const { w } = await mountPage({ query: { path: '/DATA/Documents' } })
    expect(w.find('.kw-crumb').exists(), '树还没回包就选中了').toBe(false)
    expect(wiki.getNode).not.toHaveBeenCalled()
    d.resolve(TREE_NORMAL.map((n) => ({ ...n })))
    await flush()
    expect(norm(w.find('.kw-crumb .cur').text())).toBe('Documents')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴 N55 —— fetchArticle 的三处过期守卫(计划书 T6-7)。**四条各自独立报红。**
//    治理 §9.1:两件事都要守 —— ① 逻辑(交错);② **变量作用域**(两实例)。
describe('WikiView —— N55 fetchArticle 过期守卫(蓝本 :261-281)', () => {
  /** 按路径分发的可控 promise —— 交错用。 */
  function deferredByPath<T>() {
    const map = new Map<string, ReturnType<typeof makeDeferred<T>>>()
    const get = (p: string) => {
      if (!map.has(p)) map.set(p, makeDeferred<T>())
      return map.get(p)!
    }
    return { get, impl: (p: string) => get(p).promise }
  }

  it('🔴 ① 逻辑交错:A → B,B 先回、A 后回 ⇒ 最终状态是 B 的(蓝本 :270)', async () => {
    const nodes = deferredByPath<WikiNode>()
    const raws = deferredByPath<string>()
    wiki.getNode.mockImplementation(nodes.impl)
    wiki.getRaw.mockImplementation(raws.impl)
    const { w } = await mountPage() // 初始选 /DATA(A),两发都挂起
    await treeRows(w)[1].trigger('click') // 选 /DATA/Documents(B)
    await flush()
    // B 先回
    nodes.get('/DATA/Documents').resolve(nodeWithChild('/DATA/Documents', 'child-of-B'))
    raws.get('/DATA/Documents').resolve('# raw-B')
    await flush()
    // A 后回 —— 迟到的成功响应必须被守卫丢弃
    nodes.get('/DATA').resolve(nodeWithChild('/DATA', 'child-of-A'))
    raws.get('/DATA').resolve('# raw-A')
    await flush()
    // 🔴 T7:`node` / `raw` 现在**都有渲染面**了 ⇒ 断言全部改成黑盒(T6 评审清单第 1 条)。
    expect(w.find('.kw-crumb .cur').text()).toBe('Documents')
    expect(
      norm(w.find('.kw-summary').text()),
      '迟到的 A 覆盖了 B 的原文 —— try 里的过期守卫丢了',
    ).toBe('raw-B')
    expect(
      w.findAll('.kw-child-name').map((n) => n.text()),
      '迟到的 A 覆盖了 B 的节点',
    ).toEqual(['child-of-B'])
  })

  it('🔴 ② 两实例交错守**作用域**(判据:把 `sel` 挪到模块级 → 本条必须报红)', async () => {
    // 模块级 `sel` 会让 inst1 的响应去比 inst2 的选中 ⇒ inst1 的 finally 守卫判假
    // ⇒ inst1 的骨架**永远关不掉**。
    const nodes = deferredByPath<WikiNode>()
    const raws = deferredByPath<string>()
    wiki.getNode.mockImplementation(nodes.impl)
    wiki.getRaw.mockImplementation(raws.impl)
    const inst1 = await mountPage() // 选 /DATA
    const inst2 = await mountPage({ query: { path: '/DATA/Documents' } }) // 选 /DATA/Documents
    expect(inst1.w.find('.kw-crumb .cur').text()).toBe('/DATA')
    expect(inst2.w.find('.kw-crumb .cur').text()).toBe('Documents')
    // 只回 inst1 那条路径的响应
    nodes.get('/DATA').resolve(nodeFor('/DATA'))
    raws.get('/DATA').resolve('# A')
    await flush()
    const skels = inst1.w.findAll('.kw-article-inner .k-skel')
    expect(
      skels.length,
      '🔴 inst1 的文章骨架没关掉 —— `sel` 变成模块级了(被 inst2 的选中污染)',
    ).toBe(0)
    // inst2 的还挂着(它的响应没回),证明两个实例真的各算各的。
    expect(inst2.w.findAll('.kw-article-inner .k-skel').length).toBe(4)
  })

  it('🔴 ③ catch 分支也有守卫:迟到的**失败**不弹 toast、不清空(蓝本 :274)', async () => {
    const nodes = deferredByPath<WikiNode>()
    const raws = deferredByPath<string>()
    wiki.getNode.mockImplementation(nodes.impl)
    wiki.getRaw.mockImplementation(raws.impl)
    const { w, store } = await mountPage()
    const toast = vi.spyOn(store, 'toast')
    await treeRows(w)[1].trigger('click') // 切到 B
    await flush()
    // B 成功
    nodes.get('/DATA/Documents').resolve(nodeWithChild('/DATA/Documents', 'child-of-B'))
    raws.get('/DATA/Documents').resolve('# raw-B')
    await flush()
    // A(已过期)失败
    nodes.get('/DATA').reject(httpError(500, 'stale-failure'))
    raws.get('/DATA').resolve('# raw-A')
    await flush()
    expect(toast, '迟到的失败弹了 toast —— catch 里的过期守卫丢了').not.toHaveBeenCalled()
    // 🔴 T7:改黑盒(T6 评审清单第 2 条)。
    expect(norm(w.find('.kw-summary').text()), '迟到的失败把 B 的原文清空了').toBe('raw-B')
    expect(w.findAll('.kw-child-name').map((n) => n.text())).toEqual(['child-of-B'])
    expect(w.find('.kw-pending-title').exists(), '迟到的失败把页面打到「还没有摘要」那屏了').toBe(false)
  })

  it('🔴 ④ finally 的 nodeLoading 也带守卫:迟到的响应不许提前收掉新选中的骨架(蓝本 :279)', async () => {
    const nodes = deferredByPath<WikiNode>()
    const raws = deferredByPath<string>()
    wiki.getNode.mockImplementation(nodes.impl)
    wiki.getRaw.mockImplementation(raws.impl)
    const { w } = await mountPage()
    await treeRows(w)[1].trigger('click') // 切到 B,B 的两发挂起
    await flush()
    expect(w.findAll('.kw-article-inner .k-skel').length, 'B 的骨架该在').toBe(4)
    // A(已过期)回来 —— 不许把 B 的骨架关掉
    nodes.get('/DATA').resolve(nodeFor('/DATA'))
    raws.get('/DATA').resolve('# A')
    await flush()
    expect(
      w.findAll('.kw-article-inner .k-skel').length,
      '🔴 迟到的响应把新选中的骨架收掉了 —— finally 的过期守卫丢了',
    ).toBe(4)
    // B 自己回来才收掉
    nodes.get('/DATA/Documents').resolve(nodeFor('/DATA/Documents'))
    raws.get('/DATA/Documents').resolve('# B')
    await flush()
    expect(w.findAll('.kw-article-inner .k-skel').length).toBe(0)
  })

  it('🔴 `Promise.all` 照抄:node 与 raw **并发**发,不串行(蓝本 :266-269)', async () => {
    const order: string[] = []
    const nodeD = makeDeferred<WikiNode>()
    wiki.getNode.mockImplementation((p: string) => {
      order.push('node:' + p)
      return nodeD.promise
    })
    wiki.getRaw.mockImplementation((p: string) => {
      order.push('raw:' + p)
      return Promise.resolve('# ' + p)
    })
    await mountPage()
    // 串行写法下 raw 那发要等 node 落地才发出;这里 node 一直挂着而 raw 已发出。
    expect(order).toEqual(['node:/DATA', 'raw:/DATA'])
    nodeD.resolve(nodeFor('/DATA'))
    await flush()
  })

  it('🔴 N48:404 在 store 层转 null,是**业务态**不是错误(不 toast、骨架照常收掉)', async () => {
    wiki.getNode.mockRejectedValue(httpError(404))
    wiki.getRaw.mockRejectedValue(httpError(404))
    const { w, store } = await mountPage()
    const toast = vi.spyOn(store, 'toast')
    await flush()
    // 🔴 T7:改黑盒(T6 评审清单第 3 条)—— 404 的可观测面就是「此目录还没有 wiki 摘要」那屏。
    expect(norm(w.find('.kw-pending-title').text())).toBe('此目录还没有 wiki 摘要')
    expect(w.find('.kw-summary').exists(), 'raw 为 null 却渲染了摘要区').toBe(false)
    expect(w.find('.kw-rawsrc').exists()).toBe(false)
    expect(w.find('.kw-foot').exists(), 'raw 为 null 时页脚也不该在').toBe(false)
    expect(toast, '404 走成了错误分支 —— N48 的分层被拉平了').not.toHaveBeenCalled()
    expect(w.findAll('.kw-article-inner .k-skel').length).toBe(0)
  })

  it('🔴 K58 形态 A:非 404 走 catch,只弹固定键,**不回显后端 body**', async () => {
    wiki.getNode.mockRejectedValue(httpError(500, 'PROBE-K58-T6WV-500'))
    const { w, store } = await mountPage()
    const toast = vi.spyOn(store, 'toast')
    // 重新触发一次(挂载那发的 spy 装晚了)
    await treeRows(w)[1].trigger('click')
    await flush()
    expect(toast).toHaveBeenCalledTimes(1)
    expect(toast.mock.calls[0][0]).toBe('操作失败')
    expect(String(toast.mock.calls[0][0])).not.toContain('PROBE-K58-T6WV')
    expect(w.html(), '后端串漏进了页面').not.toContain('PROBE-K58-T6WV')
    // 🔴 T7:改黑盒(T6 评审清单第 4 条)—— catch 把 node/raw 清空的可观测面同 404 那条。
    expect(norm(w.find('.kw-pending-title').text())).toBe('此目录还没有 wiki 摘要')
    expect(w.find('.kw-summary').exists()).toBe(false)
    expect(w.find('.kw-rawsrc').exists()).toBe(false)
  })

  it('🔴 每次取文章都把 showSource 重置回 false(蓝本 :264)—— 换选中后回到渲染视图', async () => {
    // 🔴 T7:改黑盒(T6 评审清单第 5 条)—— 从「点按钮切到源码视图」走到「换文章后自动回渲染视图」,
    //   全程零 `w.vm` 写入。
    const { w } = await mountPage()
    await w.find('.kw-foot button').trigger('click')
    await flush()
    expect(w.find('pre.kw-rawsrc').exists(), '点了「查看原文」却没切到源码视图').toBe(true)
    expect(w.find('.kw-summary').exists()).toBe(false)
    // 换一篇文章
    await treeRows(w)[1].trigger('click')
    await flush()
    expect(
      w.find('pre.kw-rawsrc').exists(),
      'fetchArticle 没重置 showSource —— 换文章后仍停在源码视图',
    ).toBe(false)
    expect(w.find('.kw-summary').exists(), '换文章后没回到渲染视图').toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 selName / selAiLabel / updatedFmt 的兜底(计划书 T6-8)
describe('WikiView —— 三个 computed 的兜底(蓝本 :190-195)', () => {
  it('🔴 selTreeNode 为 null 时 selName 退化成整条 `sel`(蓝本 :190)', async () => {
    // ⚠️ 申报:这是**防御分支**,走 UI 到不了 —— `sel` 只能经 `select()` 设置,而
    //   `select()` 第一行就是 `if (!byPath[path]) return` ⇒ 正常路径下 `byPath[sel]` 必然存在。
    //   本条直接改 setup 绑定制造该状态,并钉住「退化成整条路径」而不是空白。
    const { w } = await mountPage()
    const vm = w.vm as unknown as { byPath: Record<string, unknown>; sel: string }
    vm.byPath = {}
    await nextTick()
    expect(vm.sel).toBe('/DATA')
    expect(norm(w.find('.kw-crumb .cur').text()), 'selName 兜底成了空白').toBe('/DATA')
    expect(norm(w.find('.kw-title').text())).toBe('TREE/DATA')
  })

  it('🔴 parseTs 返 0 时 updatedFmt 为 ""(整块 span 不渲染)—— 两侧', async () => {
    // 反面(有时间戳):/DATA 的 last_modified 是真 RFC3339 ⇒ 「摘要更新于 …」出现。
    const withTs = await mountPage()
    const meta1 = withTs.w.find('.kw-meta')
    expect(meta1.exists()).toBe(true)
    expect(norm(meta1.text())).toContain('摘要更新于')
    // 正面(空串):Specs 的 last_modified 是空串(后端 formatTS(ms<=0) 的真形态)⇒ 整块不渲染。
    const noTs = await mountPage({ query: { path: '/DATA/Documents/Specs' } })
    const meta2 = noTs.w.find('.kw-meta')
    expect(norm(meta2.text())).not.toContain('摘要更新于')
    expect(norm(meta2.text())).toBe('由 Nimo 自动维护')
  })

  it('selAiLabel 两侧:有 aiLabel 渲染 <b>,空串整块不渲染(蓝本 :191)', async () => {
    const withLabel = await mountPage()
    expect(withLabel.w.find('.kw-meta b').exists()).toBe(true)
    expect(norm(withLabel.w.find('.kw-meta b').text())).toBe('主数据盘')
    const noLabel = await mountPage({ query: { path: '/DATA/Documents/Specs' } })
    expect(noLabel.w.find('.kw-meta b').exists(), 'aiLabel 为空串时不该渲染 <b>').toBe(false)
  })

  it('selName:顶层根显示全路径、子节点显示 basename(buildWikiTree 的两支)', async () => {
    const root = await mountPage()
    expect(norm(root.w.find('.kw-crumb .cur').text())).toBe('/DATA')
    const child = await mountPage({ query: { path: '/DATA/Documents' } })
    expect(norm(child.w.find('.kw-crumb .cur').text())).toBe('Documents')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 openFolder(计划书 T6-9)
describe('WikiView —— openFolder(蓝本 :292-294)', () => {
  it('🔴 点「打开文件夹」→ openDirInNewTab(sel)', async () => {
    const { w } = await mountPage({ query: { path: '/DATA/Documents' } })
    const btn = w.findAll('.kw-actions button').find((b) => norm(b.text()) === '打开文件夹')
    expect(btn, '「打开文件夹」按钮没渲染出来(§9.17:先确认它真是可点元素)').toBeTruthy()
    await btn!.trigger('click')
    expect(openDirInNewTab).toHaveBeenCalledTimes(1)
    expect(openDirInNewTab).toHaveBeenCalledWith('/DATA/Documents')
  })

  it('换选中之后传的是新的 sel(不是挂载时那个)', async () => {
    const { w } = await mountPage()
    await treeRows(w)[1].trigger('click')
    await flush()
    await w.findAll('.kw-actions button')[0].trigger('click')
    expect(openDirInNewTab).toHaveBeenCalledWith('/DATA/Documents')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 created() 的 `if (!wikiRoots.length) loadRoots()`(计划书 T6-10)—— 两侧
describe('WikiView —— created 的 loadRoots 门(蓝本 :215-218)', () => {
  it('store 里没有 roots → 挂载时拉一次', async () => {
    await mountPage()
    expect(wiki.getRoots).toHaveBeenCalledTimes(1)
  })

  it('🔴 store 里已有 roots → **不重复拉**(照抄蓝本的 `if (!…length)`)', async () => {
    await mountPage({ seedRoots: ROOTS_NORMALIZED.map((r) => ({ ...r })) })
    expect(wiki.getRoots, '已有根列表却又拉了一次 —— `if (!wikiRoots.length)` 丢了').not.toHaveBeenCalled()
  })

  it('挂载即拉树(loadTree 那一发无条件)', async () => {
    await mountPage({ seedRoots: ROOTS_NORMALIZED.map((r) => ({ ...r })) })
    expect(wiki.getTree).toHaveBeenCalledTimes(1)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 「自动上膛」守卫(治理 §9.19 / 计划书 T6-12)
//
// 本条**现在惰性通过**(断言仍被执行,不是 `it.skip` / `it.todo`);
// **T7 一写下 `kw-summary` 的 markup 就立刻上膛**,强制它同时给出 `showSource` 切换按钮。
//
// §9.19 跨刀冲突论证:**不冲突** —— 计划书 T7 的第 3、4 条本来就要求
// 「`kw-summary` / `kw-rawsrc` 按 `showSource` 二选一」与「`:137` 的切换按钮文案在
// `Rendered view` / `View source` 之间翻转」⇒ 本守卫不向 T7 索要任何它无权写的东西
// (与 P5e 的 T5↔T6 冲突形成对照:那次是守卫索要 T6 无权写的 markup,靠裁定 R25 才解开)。
//
// 🔴 谓词禁裸子串(承裁定 **R19**):`WikiView.vue` 的文件头注释与模板里的 T7 占位注释
// **都写了 `kw-summary` 与 `showSource` 这两个字面串** —— 裸子串谓词会当场把本条判成
// 「已上膛」,然后再拿注释里的 `showSource` 判成「已满足」= 双向假阳性、零判别力。
// ⇒ 先**剥注释**、再把 `kw-summary` 锚定到 **class 属性值位置**。
// 🔴 剥注释器要求 `/*` 前是**空白或行首**(承裁定 **R26-3**):裸 `/\*[\s\S]*?\*\//`
// 会被 `'/Downloads/*'` 这类**路径字面量**骗开一个假注释、一路吃掉后面的真代码。
// 🔴 读文件一律 `node:fs`(Vite 的 `?raw` 在 vitest 下恒空 → 断言对空串假通过)。
// ═══════════════════════════════════════════════════════════════════════════

/** 保行版剥注释器 —— 覆盖 `<!-- -->`(模板)· `/* *​/`(script)· 整行 `//`。 */
function blankComments(src: string): string {
  const blank = (m: string): string => m.replace(/[^\n]/g, ' ')
  return src
    .replace(/<!--[\s\S]*?-->/g, blank)
    .replace(/(^|\s)\/\*[\s\S]*?\*\//g, blank)
    .replace(/^[ \t]*\/\/.*$/gm, blank)
}

/**
 * 🔴🔴 **T7 开工前置(裁定 R28 —— T6 评审 Important I-1 的闭合)**。
 *
 * **T6 的原实现**(留档,不删,守「反转不删」):
 * ```
 * function extractTemplate(src: string): string {
 *   const start = src.indexOf('<template>')          // ← 裸 indexOf,无列锚定
 *   const end = src.lastIndexOf('\n</template>')
 *   if (start < 0 || end < 0 || end <= start) return ''
 *   return src.slice(start, end + '\n</template>'.length)
 * }
 * ```
 * **它错在哪**:`WikiView.vue` 的**文件头 HTML 注释**里有一句说明 K56 的散文
 * 「…写在 `<template>` 自身…」—— 裸 `indexOf('<template>')` 撞上那个**同名字面串**,
 * 起点被锚到文件头注释中间,抽出 448 行(**含整个 `<script setup>`**)。三条后果:
 *   ① 在文件头注释里写 `class="kw-summary …"` 会**假上膛报红** —— 而 T7(本刀)按本档文风
 *      一定会在文件头写下这句话 ⇒ 必踩;
 *   ② `/showSource/` 那条退化成**恒真填充断言**(抽出块里有 script 的 `const showSource = ref(false)`);
 *   ③ 「模板真的抽出来了」那条断言的措辞与事实不符。
 *
 * 🔴 **本刀的修法 = 只加固不放宽(§9.10)**,照抄本仓已有的正确写法
 * (`src/ai/styles/knowledgeStyles.test.ts` 的同名函数):
 *   · **第 0 列锚定** —— `<template>` 必须**独占一行**(前面是行首或 `\n`,后面紧跟 `\n`);
 *     `</template>` 同样要求整行严格等于它;
 *   · **覆盖度自检** —— 两条**独立推导**(字符串 `indexOf/lastIndexOf` vs **逐行**倒扫)
 *     必须逐字相等,且片段必须以模板**原始最后 3 行**收尾;
 *   · **反向防空转** —— 抽出块**不许**含 `<script setup`(判据:改回裸 `indexOf` → 该条必报红)。
 */
function extractTemplate(src: string): { tmpl: string; byLine: string; tail: string } {
  const OPEN = '<template>\n'
  const CLOSE = '\n</template>'
  const EMPTY = { tmpl: '', byLine: '', tail: '' }
  // 🔴 第 0 列锚定:只认「行首 + `<template>` + 换行」这一种形态。
  let openAt = -1
  for (let i = src.indexOf(OPEN); i >= 0; i = src.indexOf(OPEN, i + 1)) {
    if (i === 0 || src[i - 1] === '\n') {
      openAt = i
      break
    }
  }
  const closeAt = src.lastIndexOf(CLOSE)
  if (openAt < 0 || closeAt <= openAt) return EMPTY
  const tmpl = src.slice(openAt + OPEN.length, closeAt)

  // ── 独立推导:逐行扫(与上面的字符串推导互不复用)──
  const lines: string[] = src.split('\n')
  const openLine = lines.findIndex((l: string) => l === '<template>')
  let closeLine = -1
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i] === '</template>') {
      closeLine = i
      break
    }
  }
  if (openLine < 0 || closeLine <= openLine) return EMPTY
  const body = lines.slice(openLine + 1, closeLine)
  return { tmpl, byLine: body.join('\n'), tail: body.slice(-3).join('\n') }
}

describe('WikiView —— 自动上膛守卫:模板出现 kw-summary ⇒ 必须同时有 showSource 切换按钮', () => {
  const EX = extractTemplate(SRC)
  const TMPL_RAW = EX.tmpl
  const TMPL = blankComments(TMPL_RAW)

  it('防空转① —— 模板真的抽出来了,且剥注释后**真 markup 仍在**(不是把整块吃空)', () => {
    expect(SRC.length, 'WikiView.vue 读出来是空的 —— node:fs 读法失效了').toBeGreaterThan(0)
    expect(TMPL_RAW.length, '根 <template> 块没抽出来').toBeGreaterThan(0)
    // 🔴 真 markup 锚点:这三个 class 是 T6 写下的、绝不在注释里独占的结构。
    expect(TMPL, '剥注释把真 markup 也吃掉了(R26-3 的路径字面量坑)').toMatch(
      /class="kw-node"/,
    )
    expect(TMPL).toMatch(/class="kw-crumb"/)
    expect(TMPL).toMatch(/class="kw-meta"/)
    // 剥掉的确实只是注释:原文里有 HTML 注释,剥完一个都不剩。
    expect(TMPL_RAW).toMatch(/<!--/)
    expect(TMPL).not.toMatch(/<!--/)
  })

  it('🔴 覆盖度自检(裁定 R28)—— 两条独立推导逐字相等 + 片段延伸到模板最后一行', () => {
    expect(EX.tail, '找不到模板尾部特征串').not.toBe('')
    // ① 片段必须以模板**原始最后 3 行**收尾 —— 提前截断则报红。
    expect(
      TMPL_RAW.endsWith(EX.tail),
      `抽出的模板片段没延伸到最后一行(尾部特征串:\n${EX.tail}\n)—— 被提前截断了`,
    ).toBe(true)
    // ② 字符串推导 vs 逐行倒扫必须逐字相等 —— 与文本内容无关,边界错一行就报红。
    expect(TMPL_RAW, '字符串抽取与逐行推导不一致 —— 抽取边界错了').toBe(EX.byLine)
  })

  it('🔴 反向防空转(裁定 R28)—— 抽出块**不许**含 `<script setup`(判据:改回裸 indexOf → 本条必报红)', () => {
    // T6 的裸 `indexOf('<template>')` 会锚到**文件头注释**里的同名字面串,
    // 把整个 `<script setup>` 一起抽进来 ⇒ 谓词与「模板里有没有 markup」彻底脱钩。
    expect(TMPL_RAW, '抽出块里混进了 <script setup> —— 起点锚错了(R28)').not.toContain(
      '<script setup',
    )
    // 同族:script 里的 `const showSource = ref(false)` 也不许出现在模板片段里,
    // 否则 `/showSource/` 那条就成了恒真填充断言(T6 评审 I-1 的后果 ②)。
    expect(TMPL_RAW).not.toContain('const showSource = ref(')
    // 防空转:确认文件里**真的有**这两个串(否则上面两条是对空集断言)。
    expect(SRC, 'WikiView.vue 里没有 <script setup> —— 上面两条成了空断言').toContain(
      '<script setup',
    )
    expect(SRC).toContain('const showSource = ref(')
  })

  it('🔴 真实文件偏态 A(裁定 R28)—— 文件头注释里写了 kw-summary,但只有注释 ⇒ 必须判「没上膛」', () => {
    // 🔴 用**真的文件头**,只把模板体换成一段不含摘要区的最小 markup。
    //   这就是 T6 评审实测报红的那个偏态,而且**位置必须挑对**:
    //   裸 `indexOf('<template>')` 的起点会落在文件头注释里那个说明 K56 的 `<template>` 字面串上,
    //   ⇒ 只有**排在它之后**的那半截注释会被切进「模板块」,而且开头的 `<!--` 已被切掉
    //   ⇒ 剥注释器剥不掉它 ⇒ 谓词直接读到注释里的 `class="kw-summary kw-md"`。
    //   排在**它之前**的注释反而不会进来 —— 所以偏态必须构造在「之后」,否则零判别力。
    const headStart = SRC.indexOf('<template>\n')
    expect(headStart, '找不到根 <template> —— 本条构造失败').toBeGreaterThan(0)
    const head = SRC.slice(0, headStart)
    // 防空转 ①:文件头注释里**真的**有一个 `<template>` 字面串(裸 indexOf 会锚到它)。
    const nakedAnchor = head.indexOf('<template>')
    expect(nakedAnchor, '文件头注释里没有 <template> 字面串 —— 本条退化成空转').toBeGreaterThan(-1)
    // 在文件头注释的**收尾 `-->` 之前**插一句说明 —— 即「裸锚点之后」。
    const lastClose = head.lastIndexOf('-->')
    expect(lastClose, '找不到文件头注释的收尾').toBeGreaterThan(nakedAnchor)
    const note = '  【偏态】摘要区写成 <div class="kw-summary kw-md" v-html="html"/>(仅注释,非真 markup)。\n'
    const injectedHead = head.slice(0, lastClose) + note + head.slice(lastClose)
    // 防空转 ②:注入点确实排在裸锚点之后(否则本条不复现 R28 的失效形态)。
    expect(injectedHead.indexOf(note.trim())).toBeGreaterThan(nakedAnchor)
    const headerOnly = injectedHead + '<template>\n  <div class="kw-meta"/>\n</template>\n'
    expect(
      hasSummaryMarkup(blankComments(extractTemplate(headerOnly).tmpl)),
      '文件头注释里的 kw-summary 被当成真 markup —— 起点锚错了(R28 的 ①)',
    ).toBe(false)
    // 对照:同一份源码上,**裸子串**谓词会判真 —— 这正是要防的形态。
    expect(headerOnly.includes('class="kw-summary kw-md"')).toBe(true)
  })

  it('防空转② —— 谓词双向可分辨(注释里写了不算;真 class 属性才算)', () => {
    const commentOnly = [
      '<template>',
      '  <!-- 摘要区 class="kw-summary kw-md" 与 showSource 切换按钮归 T7 -->',
      '  <div class="kw-meta"/>',
      '</template>',
    ].join('\n')
    expect(hasSummaryMarkup(blankComments(extractTemplate(commentOnly).tmpl))).toBe(false)
    // 对照:裸子串谓词在同一份源码上会判真 —— 这正是 R19 要防的形态。
    expect(commentOnly.includes('kw-summary')).toBe(true)

    const realMarkup = [
      '<template>',
      '  <div class="kw-summary kw-md" v-html="html"/>',
      '</template>',
    ].join('\n')
    expect(hasSummaryMarkup(blankComments(extractTemplate(realMarkup).tmpl))).toBe(true)
    // `kw-summary-foo` 这类同名开头的类不许蒙混过关(E-25 的词边界坑)。
    const lookalike = '<template>\n  <div class="kw-summary-note"/>\n</template>'
    expect(hasSummaryMarkup(blankComments(extractTemplate(lookalike).tmpl))).toBe(false)
  })

  it('🔴 本体条件断言:模板一旦出现 kw-summary,就必须同时有 showSource 切换按钮(T7 起已上膛)', () => {
    if (!hasSummaryMarkup(TMPL)) {
      // 惰性分支(T6 期间走这里)。T7 已写下 markup ⇒ 现在**不再**走这一支。
      expect(
        hasSummaryMarkup(TMPL),
        'kw-summary 尚未写入模板 —— 本条处于「上膛待发」状态',
      ).toBe(false)
      return
    }
    expect(
      /showSource/.test(TMPL),
      '模板里出现了 kw-summary 摘要区,却没有任何 showSource 切换入口 —— ' +
        '蓝本 :137 的「查看原文 / 渲染视图」按钮是摘要区的唯一逃生口,漏了就再也切不回源码视图',
    ).toBe(true)
    // 按钮而不是别的元素:切换必须是可点的。
    expect(/<button[^>]*showSource|showSource[^<]*<\/button>|@click="showSource/.test(TMPL)).toBe(true)
  })

  it('🔴 上膛状态自证(T7)—— 本文件模板**确实**已经含 kw-summary(上一条不再走惰性分支)', () => {
    expect(
      hasSummaryMarkup(TMPL),
      'T7 已搬入摘要区,但谓词判「没上膛」—— 要么 markup 写错了,要么谓词失效了',
    ).toBe(true)
  })
})

/** `kw-summary` 是否**真的**作为 class 属性里的一个完整 token 出现(不是子串、不是注释)。 */
function hasSummaryMarkup(strippedTmpl: string): boolean {
  return /class="[^"]*(?<![\w-])kw-summary(?![\w-])[^"]*"/.test(strippedTmpl)
}

// ═══════════════════════════════════════════════════════════════════════════
// ═══════════════════════ SP8-P5f Task 7 —— 下半的用例 ═══════════════════════
//
// 覆盖:§9.15 XSS · `raw` 两分支 · `showSource` 切换 · `childMap` 目录区 ·
//       `changes` 最近变更 · `rescan()` · `kw-foot`。
// 🔴 带数据的断言一律取 `p5f-fixtures/` 的抄本(`NODE_DATA` / `WIKI_RAW_REAL_EXCERPT`),
//    `nodeFor` / `nodeWithChild` 只在「只需要一个合法非 null 值」的场合用。
// ═══════════════════════════════════════════════════════════════════════════

/** 让当前选中的文章走 `.CONSTRUCTED` 的 node 抄本(12 条 recent_changes / 4 项 child_map)。 */
function useNodeFixture(): void {
  wiki.getNode.mockImplementation((p: string) =>
    Promise.resolve(p === '/DATA' ? NODE_DATA : nodeFor(p)),
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴 §9.15 —— `v-html` 的 XSS 面(K49 同族第二次,本刀唯一 XSS 面)
//
// 🔴 **全程走真 `renderMarkdown`(含 DOMPurify),一行都没 mock。**
//    治理 §9.15 明令:mock 掉 `renderMarkdown` 之后还声称验过 XSS = 安慰剂测试。
// 🔴 判据落在**本刀的代码**上:挂载真组件 → 查真实 DOM,**不是**直接调 `renderWikiMarkdown`
//    (那条「就是转发 renderMarkdown」的断言在 T3 的 `wikiViewHelpers.test.ts` 里,另一层)。
describe('WikiView —— §9.15 v-html 的 XSS 面(真 renderMarkdown + 真实 DOM)', () => {
  it('🔴 前置自证:`renderMarkdown` **没有**被 mock(判据:谁去 vi.mock 它,本条立刻报红)', () => {
    expect(vi.isMockFunction(renderMarkdown), 'renderMarkdown 被 mock 了 —— XSS 用例退化成安慰剂').toBe(
      false,
    )
    // 真渲染产物自检:真实现会把 markdown 变成 HTML(mock 出来的空壳不会)。
    expect(renderMarkdown('# hi')).toContain('<h1>')
    expect(renderMarkdown('')).toBe('')
  })

  it('🔴 注入 <script> 与 onerror ⇒ DOM 里没有 script 元素、没有 onerror 属性', async () => {
    const evil = [
      '# 标题仍在',
      '',
      '<script>alert(1)</script>',
      '',
      '<img src=x onerror=1>',
      '',
      '- 列表项仍在',
      '',
      '`inline code 仍在`',
    ].join('\n')
    wiki.getRaw.mockResolvedValue(evil)
    const { w } = await mountPage()
    const summary = w.find('.kw-summary')
    expect(summary.exists(), '摘要区没渲染 —— 本条测不到 v-html').toBe(true)
    const el = summary.element as HTMLElement

    // ① 一个 <script> 都不许有(整页范围内也不许有)。
    expect(el.querySelector('script'), 'v-html 放进了一个 <script> 元素').toBeNull()
    expect(w.element.querySelectorAll('script').length).toBe(0)
    // ② 一个带 onerror 的元素都不许有(逐元素查属性,不查 innerHTML 文本 ——
    //    markdown-it 的 `html:false` 会把它转义成**可见文本**,文本里当然还有那几个字)。
    const all = Array.from(el.querySelectorAll('*')) as HTMLElement[]
    expect(all.filter((n) => n.hasAttribute('onerror')).map((n) => n.tagName)).toEqual([])
    expect(el.querySelector('img'), '注入的 <img> 变成了真元素').toBeNull()
    // ③ 防空转:正常 markdown 结构**仍在**(不是靠「整块被吃空」蒙混过关)。
    expect(el.querySelector('h1')?.textContent).toBe('标题仍在')
    expect(el.querySelector('li')?.textContent).toBe('列表项仍在')
    expect(el.querySelector('code')?.textContent).toBe('inline code 仍在')
    // ④ 危险串以**转义后的纯文本**留在页面上(证明它确实被喂进来了,不是没到达)。
    expect(el.textContent).toContain('alert(1)')
  })

  it('🔴 正常路径:`.REAL` 的真 .wiki.md 原文渲染出标题 / 列表 / 行内 code,且零 script', async () => {
    wiki.getRaw.mockResolvedValue(WIKI_RAW_REAL_EXCERPT)
    const { w } = await mountPage()
    const el = w.find('.kw-summary').element as HTMLElement
    // ⚠️ front-matter 的收尾 `---` 会被 markdown-it 当成 setext 二级标题的下划线 ⇒
    //   前面那段 yaml 变成第 1 个 <h2>。这是**真实渲染结果**,照实断言(不去「修」输入)。
    const h2s = Array.from(el.querySelectorAll('h2')).map((n) => n.textContent)
    expect(h2s.length).toBe(3)
    expect(h2s.slice(-2)).toEqual(['Summary', 'Child Map'])
    expect(h2s[0]).toContain('wiki_version: 1')
    expect(el.querySelectorAll('li').length, 'Child Map 的 5 条列表项没渲染出来').toBe(5)
    expect(el.querySelector('li code')?.textContent).toBe('.snapshots/')
    expect(el.querySelectorAll('script').length).toBe(0)
    // 真文件里的 HTML 注释(`<!-- BEGIN: system -->`)不许变成活元素/被当成 HTML 注入。
    expect(el.innerHTML).not.toContain('<!-- BEGIN: system -->')
  })

  it('源码视图走的是 `{{ raw }}` 文本插值,不是 v-html —— 危险串一个元素都变不出来', async () => {
    wiki.getRaw.mockResolvedValue('<script>alert(2)</script>\n\n<b>bold</b>')
    const { w } = await mountPage()
    await w.find('.kw-foot button').trigger('click')
    await flush()
    const pre = w.find('pre.kw-rawsrc')
    expect(pre.exists()).toBe(true)
    expect(pre.text()).toContain('<script>alert(2)</script>')
    expect((pre.element as HTMLElement).querySelectorAll('*').length, 'pre 里冒出了子元素').toBe(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 `raw !== null` vs `null` 两个分支(计划书 T7-3)—— 四条
describe('WikiView —— raw 两分支(蓝本 :84-95)', () => {
  it('① raw 非 null + showSource=false → 渲染 `.kw-summary`,不渲染 `.kw-rawsrc`', async () => {
    const { w } = await mountPage()
    expect(w.find('.kw-summary').exists()).toBe(true)
    expect(w.find('.kw-summary').classes()).toContain('kw-md')
    expect(w.find('.kw-rawsrc').exists()).toBe(false)
    expect(w.find('.kw-pending-title').exists(), 'raw 非 null 却出了「还没有摘要」那屏').toBe(false)
  })

  it('② raw 非 null + showSource=true → `pre.kw-rawsrc` 逐字显示原文,`.kw-summary` 消失', async () => {
    wiki.getRaw.mockResolvedValue('# 原文\n\n第二行')
    const { w } = await mountPage()
    await w.find('.kw-foot button').trigger('click')
    await flush()
    const pre = w.find('pre.kw-rawsrc')
    expect(pre.exists()).toBe(true)
    expect(pre.text()).toBe('# 原文\n\n第二行')
    expect(w.find('.kw-summary').exists()).toBe(false)
  })

  it('③ raw 为 null → `kw-pending` 那屏 + 重扫按钮(owningRoot 非空时)', async () => {
    wiki.getRaw.mockRejectedValue(httpError(404)) // N48:store 层转 null
    const { w } = await mountPage()
    expect(norm(w.find('.kw-pending-title').text())).toBe('此目录还没有 wiki 摘要')
    expect(norm(w.find('.kw-pending-sub').text())).toBe('下次定期扫描时会自动生成。')
    const btn = w.find('.kw-pending button')
    expect(btn.exists(), 'owningRoot 存在却没渲染重扫按钮').toBe(true)
    expect(norm(btn.text())).toBe('重新扫描该根')
    // §9.17:先确认它真是**可点**元素(不是渲染了但 disabled)。
    expect((btn.element as HTMLButtonElement).hasAttribute('disabled')).toBe(false)
  })

  it('🔴 ④ `owningRoot` 为 null 时重扫按钮**整块不渲染**(§9.17 可点性;判据:去掉 v-if → 报红)', async () => {
    // 本机 D1 的真实态:`/v1/wiki/roots` 超时 ⇒ store.wikiRoots 恒空 ⇒ owningRoot 恒 null。
    wiki.getRoots.mockResolvedValue([])
    wiki.getRaw.mockRejectedValue(httpError(404))
    const { w, store } = await mountPage()
    expect(store.wikiRoots.length, '前置:roots 必须真的是空的').toBe(0)
    expect(norm(w.find('.kw-pending-title').text())).toBe('此目录还没有 wiki 摘要')
    expect(
      w.find('.kw-pending button').exists(),
      'owningRoot 为 null 却渲染了重扫按钮 —— 点了必然打空',
    ).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 `showSource` 切换(计划书 T7-4)—— 文案翻转那一半(重置那一半在 N55 组里)
describe('WikiView —— showSource 切换的按钮文案(蓝本 :137-139)', () => {
  it('🔴 文案在「查看原文」/「渲染视图」之间翻转,点一次翻一次', async () => {
    const { w } = await mountPage()
    const btn = () => w.find('.kw-foot button')
    expect(norm(btn().text())).toBe('查看原文 →')
    await btn().trigger('click')
    await flush()
    expect(norm(btn().text()), '切到源码视图后按钮该变成「渲染视图」').toBe('渲染视图 →')
    await btn().trigger('click')
    await flush()
    expect(norm(btn().text()), '再点一次该翻回来').toBe('查看原文 →')
    expect(w.find('.kw-summary').exists()).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 `childMap` 目录区(计划书 T7-5)
describe('WikiView —— childMap 目录区(蓝本 :97-117)', () => {
  it('🔴 `v-if="node && node.childMap.length"` 两侧:有子项才渲染整块', async () => {
    useNodeFixture()
    const withChildren = await mountPage()
    const secs = withChildren.w.findAll('.kw-sec')
    expect(secs.length, '目录区 + 最近变更两块都该在').toBeGreaterThanOrEqual(1)
    expect(withChildren.w.find('.kw-children').exists()).toBe(true)
    expect(norm(withChildren.w.findAll('.kw-sec-title')[0]!.text())).toBe('子项清单')
    // 反面:childMap 为空 → 整块不渲染(nodeFor 的 childMap 是 [])。
    wiki.getNode.mockImplementation((p: string) => Promise.resolve(nodeFor(p)))
    const empty = await mountPage()
    expect(empty.w.find('.kw-children').exists(), 'childMap 为空却渲染了目录区').toBe(false)
    // 反面之二:node 为 null(404)⇒ 同样不渲染(`node &&` 那一半)。
    wiki.getNode.mockRejectedValue(httpError(404))
    const noNode = await mountPage()
    expect(noNode.w.find('.kw-children').exists()).toBe(false)
  })

  it('🔴 计数用 `{n} 项` + 逐项渲染名字(抄本 4 项,顺序照抄不排序)', async () => {
    useNodeFixture()
    const { w } = await mountPage()
    expect(norm(w.find('.kw-sec-count').text())).toBe('4 项')
    expect(w.findAll('.kw-child-name').map((n) => n.text())).toEqual([
      'Documents',
      'Downloads',
      'notes.md',
      'Archive',
    ])
  })

  it('🔴 `childIsDir` 决定 data-kind 与图标:树里有的算目录,其余算文件', async () => {
    useNodeFixture()
    const { w } = await mountPage()
    // 树里有 /DATA/Documents ⇒ dir;Downloads(被折叠)/ notes.md / Archive 都不在树里 ⇒ file。
    expect(w.findAll('.kw-child-ico').map((n) => n.attributes('data-kind'))).toEqual([
      'dir',
      'file',
      'file',
      'file',
    ])
  })

  it('🔴 `c.isOpaque` → 「已折叠」提示,两侧', async () => {
    useNodeFixture()
    const { w } = await mountPage()
    const rows = w.findAll('.kw-child')
    // Downloads 是抄本里唯一 is_opaque: true 的一项。
    expect(rows[1]!.find('.kw-child-sum').exists()).toBe(true)
    expect(norm(rows[1]!.find('.kw-child-sum').text())).toBe('已折叠 — 内容不逐项索引')
    for (const i of [0, 2, 3]) {
      expect(rows[i]!.find('.kw-child-sum').exists(), `第 ${i} 行不该有「已折叠」提示`).toBe(false)
    }
  })

  it('🔴 `c.lastModified ? fmtTs(...) : ""` 两侧(Archive 的 last_modified 整个键缺失 → 空)', async () => {
    // 🔴 **申报(N58 同族的第二处恒等)**:模板里的这个三元与 `fmtTs` 自带的 `ms ? … : ''`
    //   **互为冗余** —— 实测(probe15)单去掉模板三元 → 100 全绿,因为 `fmtTs('')` 本来就回空串。
    //   ⇒ 本条守的是**可观测行为**(缺时间戳的那一格必须是空的),不是那个三元本身。
    //   判据:**两处兜底同时去掉** → 本条报红(probe21 实证:`1 failed | 99 passed`,红的正是本条)。
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-05T12:12:00+08:00'))
    useNodeFixture()
    const { w } = await mountPage()
    const metas = w.findAll('.kw-child-meta').map((n) => norm(n.text()))
    expect(metas[0], 'Documents 的 last_modified 是 10:12,离 12:12 正好 2 小时').toBe('2 小时前')
    expect(metas[3], 'Archive 的 last_modified 缺席 ⇒ 归一成空串 ⇒ 这一格必须是空的').toBe('')
  })

  it('🔴 `childClick` 分支 A —— byPath 命中 ⇒ `select(full)`(判据:改成一律 openFileInNewTab → 报红)', async () => {
    useNodeFixture()
    const { w } = await mountPage()
    const first = w.findAll('.kw-child')[0]!
    expect(norm(first.find('.kw-child-name').text())).toBe('Documents')
    await first.trigger('click')
    await flush()
    expect(norm(w.find('.kw-crumb .cur').text()), '点目录型子项没有就地换文章').toBe('Documents')
    expect(openFileInNewTab, '目录型子项不该丢给文件管理器').not.toHaveBeenCalled()
  })

  it('🔴 `childClick` 分支 B —— byPath 未命中 ⇒ `openFileInNewTab(full)`(判据:改成一律 select → 报红)', async () => {
    useNodeFixture()
    const { w } = await mountPage()
    const third = w.findAll('.kw-child')[2]!
    expect(norm(third.find('.kw-child-name').text())).toBe('notes.md')
    await third.trigger('click')
    await flush()
    expect(openFileInNewTab).toHaveBeenCalledTimes(1)
    expect(openFileInNewTab).toHaveBeenCalledWith('/DATA/notes.md')
    // 选中没动(没有 select 到一个树里不存在的路径)。
    expect(norm(w.find('.kw-crumb .cur').text())).toBe('/DATA')
  })

  it('🔴 N58 —— `childPath` 的根路径分支:`sel` 是 `/` 时拼出 `/DATA`,不是 `//DATA`', async () => {
    // 造一棵含 `/` 根的树:buildWikiTree 里 `/` 的 lastIndexOf('/') === 0 ⇒ 它是顶层根。
    wiki.getTree.mockResolvedValue(
      [{ path: '/' }, { path: '/DATA' }].map((n) =>
        toStoreShape({ path: n.path, level: '', ai_label: '', user_notes_updated_at: '', last_modified: '' }),
      ),
    )
    wiki.getNode.mockImplementation((p: string) =>
      Promise.resolve(p === '/' ? nodeWithChild('/', 'DATA') : nodeFor(p)),
    )
    const { w } = await mountPage()
    expect(norm(w.find('.kw-crumb .cur').text()), '前置:初始选中必须是 `/`').toBe('/')
    const row = w.findAll('.kw-child')[0]!
    // 🔴 `/` 的 `replace(/\/+$/, '')` 剥成空串 ⇒ 恒等式的「空」那一支 ⇒ `'' + '/' + 'DATA'`。
    //   拼成 `//DATA` 的话 `byPath['//DATA']` 落空 ⇒ data-kind 会变成 'file' ⇒ 本条报红。
    expect(row.find('.kw-child-ico').attributes('data-kind'), 'childPath 拼成了 //DATA').toBe('dir')
    await row.trigger('click')
    await flush()
    // ⚠️ `/DATA` 在这棵树里也是**顶层根**(findParent 的 `i <= 0` 让 `/` 永远当不成父)
    //   ⇒ 它的 name 是全路径,面包屑显示 `/DATA`。这是 buildWikiTree 的既有行为,照实断言。
    expect(norm(w.find('.kw-crumb .cur').text()), '点根下子项没有就地换文章').toBe('/DATA')
    expect(openFileInNewTab, 'childPath 拼错了 ⇒ 落到「未命中」那一支').not.toHaveBeenCalled()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 `changes` 最近变更(计划书 T7-6)
describe('WikiView —— changes 最近变更(蓝本 :119-132 / :198-208)', () => {
  it('🔴 `v-if="changes.length"` 两侧', async () => {
    useNodeFixture()
    const withChanges = await mountPage()
    expect(withChanges.w.find('.kw-changes').exists()).toBe(true)
    expect(
      withChanges.w.findAll('.kw-sec-title').map((n) => norm(n.text())),
    ).toEqual(['子项清单', '最近变化'])
    wiki.getNode.mockImplementation((p: string) => Promise.resolve(nodeFor(p)))
    const none = await mountPage()
    expect(none.w.find('.kw-changes').exists(), 'recentChanges 为空却渲染了时间线').toBe(false)
  })

  it('🔴 `.slice(0, 10)` 上限:抄本 12 条只渲染 10 条(判据:去掉 slice → 本条必须报红)', async () => {
    useNodeFixture()
    const { w } = await mountPage()
    expect(NODE_DATA.recentChanges.length, '前置:抄本必须是 12 条').toBe(12)
    const rows = w.findAll('.kw-change')
    expect(rows.length, 'changes 没有 slice(0, 10) —— 12 条全渲染出来了').toBe(10)
    // 第 11、12 条(a11 / a12)不许出现。
    const names = rows.map((r) => r.find('.kw-change-name').text())
    expect(names).not.toContain('Documents/a11.md')
    expect(names).not.toContain('Documents/a12.md')
    expect(names[0]).toBe('Documents/a1.md')
    expect(names[9]).toBe('Documents/a10.md')
  })

  it('🔴 前缀剥离两侧:命中根前缀 → 相对路径;不命中 → 全路径(title 恒为全路径)', async () => {
    useNodeFixture()
    const { w } = await mountPage()
    const rows = w.findAll('.kw-change')
    // 命中侧:root.path = '/DATA' ⇒ prefix '/DATA/' 被剥掉。
    expect(rows[0]!.find('.kw-change-name').text()).toBe('Documents/a1.md')
    expect(rows[0]!.find('.kw-change-name').attributes('title')).toBe('/DATA/Documents/a1.md')
    // 不命中侧:'/outside/a6.md' 不以 '/DATA/' 开头 ⇒ 原样显示全路径。
    expect(
      rows[5]!.find('.kw-change-name').text(),
      '跨根条目被错误地剥了前缀',
    ).toBe('/outside/a6.md')
    expect(rows[5]!.find('.kw-change-name').attributes('title')).toBe('/outside/a6.md')
  })

  it('🔴 owningRoot 为 null ⇒ prefix 为空串 ⇒ 一条都不剥(前缀剥离的第三侧)', async () => {
    wiki.getRoots.mockResolvedValue([])
    useNodeFixture()
    const { w, store } = await mountPage()
    expect(store.wikiRoots.length).toBe(0)
    expect(w.findAll('.kw-change-name')[0]!.text()).toBe('/DATA/Documents/a1.md')
  })

  it('🔴 `opToType(c.op)` → `data-type`(四个已知值 + 未知值兜底 mod)', async () => {
    useNodeFixture()
    const { w } = await mountPage()
    const types = w.findAll('.kw-change').map((r) => r.attributes('data-type'))
    // a1 create → add · a2 modify → mod · a3 delete → del · a4 rename → ren · a5 chmod(未知)→ mod
    expect(types.slice(0, 6)).toEqual(['add', 'mod', 'del', 'ren', 'mod', 'mod'])
  })

  it('🔴 `c.at ? fmtAgo(parseTs(c.at)) : ""` 两侧', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-05T12:00:00+08:00'))
    // 🔴 抄本的空 `at` 那条(a12)排在第 12 位,被 slice(0,10) 切掉了 ⇒ 这里从抄本里
    //    **逐字挑出两条**(a1 有 at / a12 无 at)组成一个 2 条的 recentChanges,值一字未改。
    const picked = [NODE_DATA.recentChanges[0]!, NODE_DATA.recentChanges[11]!]
    expect(picked[0]!.at).toBe('2026-08-05T11:00:00+08:00')
    expect(picked[1]!.at, '前置:第 12 条的 at 必须是空串').toBe('')
    wiki.getNode.mockImplementation((p: string) =>
      Promise.resolve(p === '/DATA' ? { ...NODE_DATA, recentChanges: picked } : nodeFor(p)),
    )
    const { w } = await mountPage()
    const times = w.findAll('.kw-change-time').map((n) => norm(n.text()))
    expect(times[0], 'at 非空 ⇒ 该走 fmtAgo').toBe('1 小时前')
    expect(times[1], 'at 为空串 ⇒ 这一格必须是空的(不是「—」也不是 1970)').toBe('')
  })

  // 🔴 参数化守卫 —— §9.14-4 防空循环:先钉死用例条数,再逐条 it。
  const OP_LABEL_CASES: Array<{ op: string; zh: string }> = [
    { op: 'create', zh: '新增' },
    { op: 'modify', zh: '更新' },
    { op: 'delete', zh: '已删除' },
    { op: 'rename', zh: '重命名' },
    { op: 'chmod', zh: '更新' }, // 未知 op 兜底 → 'Updated'(蓝本 :205)
  ]
  it('🔴 参数化守卫防空循环:OP_LABEL_CASES 必须正好 5 条(否则下面的 it.each 是空转)', () => {
    expect(OP_LABEL_CASES.length).toBe(5)
    expect(new Set(OP_LABEL_CASES.map((c) => c.op)).size).toBe(5)
  })

  it.each(OP_LABEL_CASES)(
    '🔴 OP_LABEL_KEYS —— op=$op 的标签文案是「$zh」',
    async ({ op, zh }) => {
      wiki.getNode.mockImplementation((p: string) =>
        Promise.resolve(
          p === '/DATA'
            ? { ...NODE_DATA, recentChanges: [{ path: '/DATA/x.md', op, at: '' }] }
            : nodeFor(p),
        ),
      )
      const { w } = await mountPage()
      const rows = w.findAll('.kw-change')
      expect(rows.length, `op=${op} 那一行没渲染出来 —— 本条测不到标签`).toBe(1)
      expect(norm(rows[0]!.find('.kw-change-type').text())).toBe(zh)
    },
  )
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 `rescan()`(计划书 T7-7)
//
// ⚠️ 🔴 **验「函数门」必须走无 `:disabled` 的入口**(裁定 R27 的常驻教训,T5 栽过):
//    jsdom **不向 `:disabled` 元素派发 click** ⇒ 直接点那个带 `:disabled="rescanBusy"` 的
//    重扫按钮,第二发根本没发生过点击,`rescanBusy` 那道**函数门**从未被执行到 = 零判别力。
// 🔴 **本页没有第二个不带 disabled 的入口**(蓝本只有这一个按钮)⇒ **显式申报**:
//    `rescanBusy` 这道函数门在**产品 UI 上**只由 `:disabled` 保护;函数门本身用
//    **直调 `vm.rescan()`** 来验(那是它唯一能被到达的路径)。两层各有一条用例,分开钉。
describe('WikiView —— rescan()(蓝本 :295-307)', () => {
  /** `<script setup>` 的 setup 绑定在 VTU 下可从 `w.vm` 读到(T6 已实证可读写)。 */
  function rescanOf(w: ReturnType<typeof mount>): () => Promise<void> {
    const vm = w.vm as unknown as { rescan: () => Promise<void> }
    expect(typeof vm.rescan, 'rescan 没暴露到 vm —— 本组的函数门用例全部失效').toBe('function')
    return vm.rescan
  }

  it('🔴 owningRoot 为 null ⇒ **静默返回**,零请求、零 toast(蓝本 :297 的 `!root` 那一半)', async () => {
    // 🔴 申报:只断「`rescanRoot` 没被调到」**零判别力** —— 实测(probe13:去掉 `!root ||` → 100 全绿)
    //   证明:门去掉后 `root.id` 会先抛 TypeError,`rescanRoot` **照样没被调到**,只是多弹一个
    //   「操作失败」toast。⇒ 真正的判别轴是「有没有副作用」,断言必须落在 toast 与按钮态上。
    wiki.getRoots.mockResolvedValue([])
    wiki.getRaw.mockRejectedValue(httpError(404))
    const { w, store } = await mountPage()
    expect(store.wikiRoots.length, '前置:roots 必须真的是空的').toBe(0)
    const rescanRoot = vi.spyOn(store, 'rescanRoot')
    const toast = vi.spyOn(store, 'toast')
    await rescanOf(w)()
    await flush()
    expect(rescanRoot, 'owningRoot 为 null 却发了重扫请求').not.toHaveBeenCalled()
    expect(
      toast,
      'owningRoot 为 null 时弹了 toast —— `!root` 那道门丢了(会因 root.id 抛 TypeError 落进 catch)',
    ).not.toHaveBeenCalled()
  })

  it('🔴 rescanBusy 在飞 ⇒ 第二发不发(函数门;判据:去掉 `|| rescanBusy` → 本条必须报红)', async () => {
    wiki.getRaw.mockRejectedValue(httpError(404))
    const { w, store } = await mountPage()
    const d = makeDeferred<void>()
    const rescanRoot = vi.spyOn(store, 'rescanRoot').mockReturnValue(d.promise)
    const rescan = rescanOf(w)
    const p1 = rescan() // 第一发,挂起
    const p2 = rescan() // 🔴 同步紧跟第二发 —— 必须被函数门挡住
    expect(rescanRoot, 'rescanBusy 门没挡住第二发').toHaveBeenCalledTimes(1)
    d.resolve()
    await Promise.all([p1, p2])
    await flush()
  })

  it('🔴 对照层:第一发在飞时按钮真的是 `disabled`(UI 侧的那一层)', async () => {
    wiki.getRaw.mockRejectedValue(httpError(404))
    const { w, store } = await mountPage()
    const d = makeDeferred<void>()
    vi.spyOn(store, 'rescanRoot').mockReturnValue(d.promise)
    const btn = w.find('.kw-pending button')
    expect((btn.element as HTMLButtonElement).hasAttribute('disabled'), '起手不该是 disabled').toBe(
      false,
    )
    await btn.trigger('click')
    await nextTick()
    expect(
      (w.find('.kw-pending button').element as HTMLButtonElement).hasAttribute('disabled'),
      'rescanBusy 期间按钮没变 disabled',
    ).toBe(true)
    d.resolve()
    await flush()
  })

  it('🔴 成功 → `rescanRoot(root.id)` + 「已开始重新扫描」toast(点真按钮,§9.17 先证可点)', async () => {
    wiki.getRaw.mockRejectedValue(httpError(404))
    const { w, store } = await mountPage()
    const rescanRoot = vi.spyOn(store, 'rescanRoot').mockResolvedValue(undefined)
    const toast = vi.spyOn(store, 'toast')
    const btn = w.find('.kw-pending button')
    expect(btn.exists()).toBe(true)
    expect((btn.element as HTMLButtonElement).hasAttribute('disabled')).toBe(false)
    await btn.trigger('click')
    await flush()
    // 🔴 id 而不是 path —— 传错了后端 404,而三门不会响。
    expect(rescanRoot).toHaveBeenCalledWith('dfcd1840f5dab439cd9d7050aa5bafd0')
    expect(toast).toHaveBeenCalledTimes(1)
    expect(toast.mock.calls[0]![0]).toBe('已开始重新扫描')
  })

  it('🔴 失败 → 「操作失败」toast,且**不回显后端 body**(K58 形态 A)', async () => {
    wiki.getRaw.mockRejectedValue(httpError(404))
    const { w, store } = await mountPage()
    vi.spyOn(store, 'rescanRoot').mockRejectedValue(new Error('PROBE-T7-RESCAN-500'))
    const toast = vi.spyOn(store, 'toast')
    await w.find('.kw-pending button').trigger('click')
    await flush()
    expect(toast).toHaveBeenCalledTimes(1)
    expect(toast.mock.calls[0]![0]).toBe('操作失败')
    expect(String(toast.mock.calls[0]![0])).not.toContain('PROBE-T7-RESCAN')
    expect(w.html(), '后端串漏进了页面').not.toContain('PROBE-T7-RESCAN')
  })

  it('🔴 `finally` 里 rescanBusy 归位:失败之后**还能再发一次**(判据:删掉 finally → 本条必须报红)', async () => {
    wiki.getRaw.mockRejectedValue(httpError(404))
    const { w, store } = await mountPage()
    const rescanRoot = vi
      .spyOn(store, 'rescanRoot')
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(undefined)
    const rescan = rescanOf(w)
    await rescan()
    await flush()
    // 按钮也必须解除 disabled(finally 没归位的话它会永远灰着)。
    expect(
      (w.find('.kw-pending button').element as HTMLButtonElement).hasAttribute('disabled'),
      '失败后按钮还灰着 —— finally 没把 rescanBusy 放回来',
    ).toBe(false)
    await rescan()
    await flush()
    expect(rescanRoot, '第二发没发出去 —— rescanBusy 卡死了').toHaveBeenCalledTimes(2)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 `kw-foot`(计划书 T7-8)
describe('WikiView —— kw-foot(蓝本 :134-140)', () => {
  it('🔴 `{path}` 插值 = `sel + "/.wiki.md"`', async () => {
    const { w } = await mountPage({ query: { path: '/DATA/Documents' } })
    const foot = w.find('.kw-foot')
    expect(foot.exists()).toBe(true)
    expect(norm(foot.text())).toContain('本页由 /DATA/Documents/.wiki.md 渲染')
    // E-45:vue-i18n 对未匹配占位符是**静默替换成空串** ⇒ 反向断言不许写「含 {path} 字面量」,
    // 要断真实插值出来的值(上面那条)。这里只顺带钉一下花括号没漏出来。
    expect(norm(foot.text())).not.toContain('{path}')
  })

  it('🔴 `v-if="raw !== null"` —— raw 为 null 时整个页脚不渲染', async () => {
    wiki.getRaw.mockRejectedValue(httpError(404))
    const { w } = await mountPage()
    expect(w.find('.kw-foot').exists(), 'raw 为 null 却渲染了页脚(那里的按钮会切到一个空的源码视图)').toBe(
      false,
    )
  })

  it('换选中之后 `{path}` 跟着变(不是挂载时那个)', async () => {
    const { w } = await mountPage()
    expect(norm(w.find('.kw-foot').text())).toContain('/DATA/.wiki.md')
    await treeRows(w)[1].trigger('click')
    await flush()
    expect(norm(w.find('.kw-foot').text())).toContain('/DATA/Documents/.wiki.md')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 【SP8-P5f Task 8 追加,2026-08-06】T7 独立评审 Important I-1 的闭合:
// `kw-sec-en` 的两处装饰文案**此前零守卫**。
// 治理 §3.5 / 附录 A §A.4 明令:蓝本这两处**未过 `$t()`**,照抄字面量、不许顺手
// i18n 化;`WikiView.vue` 的模板注释里也写了这句话两次。但整仓没有任何断言绑住它 ——
// 评审把两处 i18n 化后,单文件 100 例与全仓 4658 例**全绿**(「产品代码对、守卫为零」
// 家族)。⚠️ 同组的 `.kw-sec-title` 中文**有**断言、`kw-title` 的 `TREE` **有**断言,
// **唯独 `kw-sec-en` 这一对裸奔** ⇒ 是漏了,不是「这类都不测」。
// 🔴 判据(本刀已实测,见 p5f-task-8-report.md):把这两处改成 `{{ t('…') }}`
//    → 本条必须报红。
// 🔴 本块**只新增**,`WikiView.test.ts` 既有每一行零改动(报告给 `git diff` 自证)。
describe('WikiView —— kw-sec-en 装饰文案照抄字面量(附录 A §A.4 / T7 评审 I-1)', () => {
  it('🔴 两处 `kw-sec-en` 必须是英文字面量,不许过 $t()', async () => {
    useNodeFixture()
    const { w } = await mountPage()
    // 防空转:这两块(目录区 / 最近变更)得真渲染出来,否则下面断的是空数组。
    expect(w.find('.kw-children').exists(), '前置:目录区没渲染 ⇒ 本条无从判别').toBe(true)
    expect(w.find('.kw-changes').exists(), '前置:最近变更没渲染 ⇒ 本条无从判别').toBe(true)
    expect(
      w.findAll('.kw-sec-en').map((n) => norm(n.text())),
      'kw-sec-en 被 i18n 化了 —— 蓝本这两处未过 $t(),照抄字面量(附录 A §A.4)',
    ).toEqual(['Contents', 'Recent changes'])
  })
})
