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
    expect(TREE_RAW_NORMAL.length, 'fixture copy is empty — guards against a no-op').toBe(3)
    expect(ROOTS_NORMALIZED.length, 'fixture copy is empty — guards against a no-op').toBe(2)
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
    // expand: Specs appears. ⚠️ this half's actual provider is `select()`'s ancestor loop
    // (blueprint :247 that line is unreachable branch, see nodeClick declaration comment in WikiView.vue).
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

  it('🔴 ③ write `?path=` (router.replace, value different from initial — §9.14-3 prevent zero discriminant)', async () => {
    // initial: no query ⇒ loadTree chooses roots[0] and replaces with ?path=/DATA.
    const { w, router, replaceSpy } = await mountPage()
    expect(router.currentRoute.value.query.path).toBe('/DATA')
    replaceSpy.mockClear()
    // 🔴 written value must **differ from current value**, else Vue watch's Object.is pre-dedup prevents callback from executing.
    await treeRows(w)[1].trigger('click')
    await flush()
    expect(replaceSpy, 'select() did not write query').toHaveBeenCalledTimes(1)
    expect(router.currentRoute.value.query.path).toBe('/DATA/Documents')
    expect(router.currentRoute.value.query.path).not.toBe('/DATA')
  })

  it('🔴 when `fromRoute: true` **do not** write query (prevent watch → replace → watch loop)', async () => {
    // deep link matches ⇒ in loadTree `fromRoute: q === initial` is true ⇒ should not have any replace.
    const { router, replaceSpy } = await mountPage({ query: { path: '/DATA/Documents' } })
    expect(replaceSpy, 'fromRoute branch still wrote query — will ping-pong with watch').not.toHaveBeenCalled()
    expect(router.currentRoute.value.query.path).toBe('/DATA/Documents')
  })

  it('when `?path=` does not match, initially select roots[0], and rewrite query to it (fromRoute false branch)', async () => {
    const { router, replaceSpy } = await mountPage({ query: { path: '/not/in/tree' } })
    expect(replaceSpy).toHaveBeenCalledTimes(1)
    expect(router.currentRoute.value.query.path).toBe('/DATA')
  })

  it('select() early returns for paths not in byPath (blueprint :250)', async () => {
    const { w, store } = await mountPage()
    const before = wiki.getNode.mock.calls.length
    const toast = vi.spyOn(store, 'toast')
    // can only reach before select() call point via "query becomes out-of-tree path" path; here directly verify
    // "out-of-tree query changes nothing" — two layers of guards (watch's byPath condition + select's early return) are equivalent.
    await w.vm.$router.replace({ query: { path: '/nope/nope' } })
    await flush()
    expect(norm(w.find('.kw-crumb .cur').text()), 'selection was changed by out-of-tree path').toBe('/DATA')
    expect(wiki.getNode.mock.calls.length).toBe(before)
    expect(toast).not.toHaveBeenCalled()
  })

  it('🔴 N57 — `router.replace` reject swallowed by `.catch(() => {})`, article fetch continues normally', async () => {
    const { w, replaceSpy } = await mountPage()
    replaceSpy.mockClear() // one during mount (initial selection writes ?path=/DATA) doesn't count
    replaceSpy.mockImplementation(() => Promise.reject(new Error('NavigationDuplicated')))
    const before = wiki.getNode.mock.calls.length
    await treeRows(w)[1].trigger('click')
    await flush()
    // did not throw (test reaching here means no crash), fetchArticle executed normally.
    expect(replaceSpy).toHaveBeenCalledTimes(1)
    expect(wiki.getNode.mock.calls.length).toBe(before + 1)
    expect(treeRows(w)[1].attributes('data-active')).toBe('true')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 N56 — deep link two halves (plan T6-6). **must not unify to `immediate: true`**.
describe('WikiView — N56 deep link first half: read route.query.path once in loadTree (blueprint :230-232)', () => {
  it('query matches → select it (not roots[0])', async () => {
    const { w } = await mountPage({ query: { path: '/DATA/Documents' } })
    expect(norm(w.find('.kw-crumb .cur').text())).toBe('Documents')
    expect(norm(w.find('.kw-title').text())).toBe('TREEDocuments')
    expect(wiki.getNode).toHaveBeenCalledWith('/DATA/Documents')
  })

  it('query does not match → fall back to roots[0]', async () => {
    const { w } = await mountPage({ query: { path: '/DATA/Nope' } })
    expect(norm(w.find('.kw-crumb .cur').text())).toBe('/DATA')
    expect(wiki.getNode).toHaveBeenCalledWith('/DATA')
  })

  it('no query and no roots → initial is "", select nothing (right side shows onboarding)', async () => {
    wiki.getTree.mockResolvedValue([])
    const { w } = await mountPage()
    expect(w.find('.kw-crumb').exists(), 'breadcrumb should not render when sel is empty').toBe(false)
    expect(w.find('.kw-pending').exists()).toBe(true)
    expect(wiki.getNode, 'article fetch request sent without selection').not.toHaveBeenCalled()
  })
})

describe('WikiView — N56 deep link second half: watch without immediate (blueprint :210-214)', () => {
  it('🔴 after mount change address bar query → truly switch (criterion: remove watch → this test must fail)', async () => {
    // see `newui-router-query-only-no-remount`: only read query once in onMounted,
    // user changing address bar nothing runs. here is **one query change after mount**.
    const { w, router } = await mountPage()
    expect(norm(w.find('.kw-crumb .cur').text())).toBe('/DATA')
    await router.replace({ query: { path: '/DATA/Documents/Specs' } })
    await flush()
    expect(norm(w.find('.kw-crumb .cur').text()), 'watch did not catch query change').toBe('Specs')
    expect(wiki.getNode).toHaveBeenCalledWith('/DATA/Documents/Specs')
    // ancestors also expanded (select's task ② has same effect on this watch path).
    expect(rowPaths(w)).toEqual(['/DATA', 'Documents', 'Specs'])
  })

  it('🔴 that `v !== sel` line: query written back by select() does not trigger article fetch again (prevent loop)', async () => {
    // 🔴 §9.14-3 — this is the **discriminant** form of "same value not repeated":
    //   click tree row → select() sets sel and router.replace writes query → watch triggered by this write,
    //   at this time `v === sel` ⇒ guard blocks, no second select().
    //   criterion: remove `v !== sel.value` → fetchArticle called again (one more getNode).
    //   ⚠️ opposite approach ("set query to same value as now") zero discriminant: Vue watch's Object.is
    //   pre-dedup makes callback **not execute at all**, product code green with or without guard.
    const { w } = await mountPage()
    wiki.getNode.mockClear()
    wiki.getRaw.mockClear()
    await treeRows(w)[1].trigger('click')
    await flush()
    expect(wiki.getNode.mock.calls.map((c: unknown[]) => c[0])).toEqual(['/DATA/Documents'])
    expect(wiki.getRaw.mock.calls.map((c: unknown[]) => c[0])).toEqual(['/DATA/Documents'])
  })

  it('that `byPath[v]` line: when query points outside tree does nothing', async () => {
    // ⚠️ declaration: watch's `byPath[v]` and `select()`'s own `if (!byPath[path]) return` are
    //   two-layer equivalent defense — removing watch alone does not change observable behavior. this test locks
    //   **combined observable behavior** (out-of-tree query doesn't change selection, doesn't send request), only red with both broken.
    const { w, router } = await mountPage()
    wiki.getNode.mockClear()
    await router.replace({ query: { path: '/DATA/Documents/Nope' } })
    await flush()
    expect(norm(w.find('.kw-crumb .cur').text())).toBe('/DATA')
    expect(wiki.getNode).not.toHaveBeenCalled()
  })

  it('watch **not** immediate — at mount moment byPath not yet built, relies on loadTree half', async () => {
    // discriminant form: when getTree long delayed sending no response, query already has valid path, tree not built yet
    //   ⇒ if watch is immediate, at empty byPath it runs idle once (silently do nothing),
    //     real effect still only loadTree half — this locks "before response no select, after response select".
    const d = makeDeferred<WikiTreeNode[]>()
    wiki.getTree.mockReturnValue(d.promise)
    const { w } = await mountPage({ query: { path: '/DATA/Documents' } })
    expect(w.find('.kw-crumb').exists(), 'tree has not responded yet but something already got selected').toBe(false)
    expect(wiki.getNode).not.toHaveBeenCalled()
    d.resolve(TREE_NORMAL.map((n) => ({ ...n })))
    await flush()
    expect(norm(w.find('.kw-crumb .cur').text())).toBe('Documents')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴 N55 — fetchArticle three stale guards (plan T6-7). **each of four fails independently**.
//    governance §9.1: two things to guard — ① logic (interleaving); ② **variable scope** (two instances).
describe('WikiView — N55 fetchArticle stale guards (blueprint :261-281)', () => {
  /** Controllable promise keyed by path — for interleaving. */
  function deferredByPath<T>() {
    const map = new Map<string, ReturnType<typeof makeDeferred<T>>>()
    const get = (p: string) => {
      if (!map.has(p)) map.set(p, makeDeferred<T>())
      return map.get(p)!
    }
    return { get, impl: (p: string) => get(p).promise }
  }

  it('🔴 ① logic interleaving: A → B, B returns first, A returns late ⇒ final state is B\'s (blueprint :270)', async () => {
    const nodes = deferredByPath<WikiNode>()
    const raws = deferredByPath<string>()
    wiki.getNode.mockImplementation(nodes.impl)
    wiki.getRaw.mockImplementation(raws.impl)
    const { w } = await mountPage() // initially select /DATA (A), both calls pending
    await treeRows(w)[1].trigger('click') // select /DATA/Documents (B)
    await flush()
    // B returns first
    nodes.get('/DATA/Documents').resolve(nodeWithChild('/DATA/Documents', 'child-of-B'))
    raws.get('/DATA/Documents').resolve('# raw-B')
    await flush()
    // A returns late — late success response must be dropped by guard
    nodes.get('/DATA').resolve(nodeWithChild('/DATA', 'child-of-A'))
    raws.get('/DATA').resolve('# raw-A')
    await flush()
    // 🔴 T7: `node` / `raw` now **both have render touchpoints** ⇒ all assertions become black box (T6 review checklist item 1).
    expect(w.find('.kw-crumb .cur').text()).toBe('Documents')
    expect(
      norm(w.find('.kw-summary').text()),
      'late A overwrote B original — stale guard in try lost',
    ).toBe('raw-B')
    expect(
      w.findAll('.kw-child-name').map((n) => n.text()),
      'late A overwrote B node',
    ).toEqual(['child-of-B'])
  })

  it('🔴 ② two instances interleaved guard **scope** (criterion: move `sel` to module level → this test must fail)', async () => {
    // module-level `sel` would make inst1's response compare against inst2's selection ⇒ inst1's finally guard evaluates false
    // ⇒ inst1's skeleton **never closes**.
    const nodes = deferredByPath<WikiNode>()
    const raws = deferredByPath<string>()
    wiki.getNode.mockImplementation(nodes.impl)
    wiki.getRaw.mockImplementation(raws.impl)
    const inst1 = await mountPage() // select /DATA
    const inst2 = await mountPage({ query: { path: '/DATA/Documents' } }) // select /DATA/Documents
    expect(inst1.w.find('.kw-crumb .cur').text()).toBe('/DATA')
    expect(inst2.w.find('.kw-crumb .cur').text()).toBe('Documents')
    // only resolve inst1's path response
    nodes.get('/DATA').resolve(nodeFor('/DATA'))
    raws.get('/DATA').resolve('# A')
    await flush()
    const skels = inst1.w.findAll('.kw-article-inner .k-skel')
    expect(
      skels.length,
      '🔴 inst1 article skeleton did not close — `sel` became module-level (polluted by inst2 selection)',
    ).toBe(0)
    // inst2's still pending (its response hasn't come), proving two instances truly calculate separately.
    expect(inst2.w.findAll('.kw-article-inner .k-skel').length).toBe(4)
  })

  it('🔴 ③ catch branch also has guard: late **failure** does not toast, does not clear (blueprint :274)', async () => {
    const nodes = deferredByPath<WikiNode>()
    const raws = deferredByPath<string>()
    wiki.getNode.mockImplementation(nodes.impl)
    wiki.getRaw.mockImplementation(raws.impl)
    const { w, store } = await mountPage()
    const toast = vi.spyOn(store, 'toast')
    await treeRows(w)[1].trigger('click') // switch to B
    await flush()
    // B succeeds
    nodes.get('/DATA/Documents').resolve(nodeWithChild('/DATA/Documents', 'child-of-B'))
    raws.get('/DATA/Documents').resolve('# raw-B')
    await flush()
    // A (stale) fails
    nodes.get('/DATA').reject(httpError(500, 'stale-failure'))
    raws.get('/DATA').resolve('# raw-A')
    await flush()
    expect(toast, 'late failure toasted — stale guard in catch lost').not.toHaveBeenCalled()
    // 🔴 T7: convert to black box (T6 review checklist item 2).
    expect(norm(w.find('.kw-summary').text()), 'late failure cleared B original').toBe('raw-B')
    expect(w.findAll('.kw-child-name').map((n) => n.text())).toEqual(['child-of-B'])
    expect(w.find('.kw-pending-title').exists(), 'late failure rendered "no summary" screen').toBe(false)
  })

  it('🔴 ④ finally nodeLoading also has guard: late response must not prematurely close new selection skeleton (blueprint :279)', async () => {
    const nodes = deferredByPath<WikiNode>()
    const raws = deferredByPath<string>()
    wiki.getNode.mockImplementation(nodes.impl)
    wiki.getRaw.mockImplementation(raws.impl)
    const { w } = await mountPage()
    await treeRows(w)[1].trigger('click') // switch to B, B's two calls pending
    await flush()
    expect(w.findAll('.kw-article-inner .k-skel').length, 'B skeleton should be there').toBe(4)
    // A (stale) returns — must not close B skeleton
    nodes.get('/DATA').resolve(nodeFor('/DATA'))
    raws.get('/DATA').resolve('# A')
    await flush()
    expect(
      w.findAll('.kw-article-inner .k-skel').length,
      '🔴 late response closed new selection skeleton — finally stale guard lost',
    ).toBe(4)
    // B itself returns then closes
    nodes.get('/DATA/Documents').resolve(nodeFor('/DATA/Documents'))
    raws.get('/DATA/Documents').resolve('# B')
    await flush()
    expect(w.findAll('.kw-article-inner .k-skel').length).toBe(0)
  })

  it('🔴 `Promise.all` copied verbatim: node and raw **concurrent**, not serial (blueprint :266-269)', async () => {
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
    // with serial approach raw would wait for node to land; here node pending while raw already sent.
    expect(order).toEqual(['node:/DATA', 'raw:/DATA'])
    nodeD.resolve(nodeFor('/DATA'))
    await flush()
  })

  it('🔴 N48: 404 converted to null at store layer, is **business state** not error (no toast, skeleton closes normally)', async () => {
    wiki.getNode.mockRejectedValue(httpError(404))
    wiki.getRaw.mockRejectedValue(httpError(404))
    const { w, store } = await mountPage()
    const toast = vi.spyOn(store, 'toast')
    await flush()
    // 🔴 T7: convert to black box (T6 review checklist item 3) — 404's observable surface is "no wiki summary" screen.
    expect(norm(w.find('.kw-pending-title').text())).toBe('此目录还没有 wiki 摘要')
    expect(w.find('.kw-summary').exists(), 'raw is null but summary section rendered').toBe(false)
    expect(w.find('.kw-rawsrc').exists()).toBe(false)
    expect(w.find('.kw-foot').exists(), 'raw is null but footer also present').toBe(false)
    expect(toast, '404 went to error branch — N48 layering flattened').not.toHaveBeenCalled()
    expect(w.findAll('.kw-article-inner .k-skel').length).toBe(0)
  })

  it('🔴 K58 form A: non-404 goes to catch, only toasts fixed key, **does not echo backend body**', async () => {
    wiki.getNode.mockRejectedValue(httpError(500, 'PROBE-K58-T6WV-500'))
    const { w, store } = await mountPage()
    const toast = vi.spyOn(store, 'toast')
    // re-trigger (spy mounted late during mount)
    await treeRows(w)[1].trigger('click')
    await flush()
    expect(toast).toHaveBeenCalledTimes(1)
    expect(toast.mock.calls[0][0]).toBe('操作失败')
    expect(String(toast.mock.calls[0][0])).not.toContain('PROBE-K58-T6WV')
    expect(w.html(), 'backend string leaked into page').not.toContain('PROBE-K58-T6WV')
    // 🔴 T7: convert to black box (T6 review checklist item 4) — catch's observable surface of clearing node/raw same as 404.
    expect(norm(w.find('.kw-pending-title').text())).toBe('此目录还没有 wiki 摘要')
    expect(w.find('.kw-summary').exists()).toBe(false)
    expect(w.find('.kw-rawsrc').exists()).toBe(false)
  })

  it('🔴 every article fetch resets showSource back to false (blueprint :264) — back to render view after changing selection', async () => {
    // 🔴 T7: convert to black box (T6 review checklist item 5) — from "click button switch to source view" to "auto back to render after switching article",
    //   zero `w.vm` writes throughout.
    const { w } = await mountPage()
    await w.find('.kw-foot button').trigger('click')
    await flush()
    expect(w.find('pre.kw-rawsrc').exists(), 'clicked "view source" but did not switch to source view').toBe(true)
    expect(w.find('.kw-summary').exists()).toBe(false)
    // switch to another article
    await treeRows(w)[1].trigger('click')
    await flush()
    expect(
      w.find('pre.kw-rawsrc').exists(),
      'fetchArticle did not reset showSource — still in source view after article switch',
    ).toBe(false)
    expect(w.find('.kw-summary').exists(), 'did not return to render view after article switch').toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 selName / selAiLabel / updatedFmt defaults (plan T6-8)
describe('WikiView — three computed defaults (blueprint :190-195)', () => {
  it('🔴 when selTreeNode is null selName degrades to entire `sel` (blueprint :190)', async () => {
    // ⚠️ declaration: this is **defensive branch**, unreachable via UI — `sel` can only be set by `select()`, and
    //   `select()`'s first line is `if (!byPath[path]) return` ⇒ in normal path `byPath[sel]` must exist.
    //   this test directly modifies setup binding to create this state, and locks "degrade to entire path" not blank.
    const { w } = await mountPage()
    const vm = w.vm as unknown as { byPath: Record<string, unknown>; sel: string }
    vm.byPath = {}
    await nextTick()
    expect(vm.sel).toBe('/DATA')
    expect(norm(w.find('.kw-crumb .cur').text()), 'selName defaulted to blank').toBe('/DATA')
    expect(norm(w.find('.kw-title').text())).toBe('TREE/DATA')
  })

  it('🔴 when parseTs returns 0 updatedFmt is "" (entire span not rendered) — both sides', async () => {
    // opposite (has timestamp): /DATA last_modified is true RFC3339 ⇒ "summary updated at …" appears.
    const withTs = await mountPage()
    const meta1 = withTs.w.find('.kw-meta')
    expect(meta1.exists()).toBe(true)
    expect(norm(meta1.text())).toContain('摘要更新于')
    // positive (empty string): Specs last_modified is empty string (true form of backend formatTS(ms<=0)) ⇒ entire block not rendered.
    const noTs = await mountPage({ query: { path: '/DATA/Documents/Specs' } })
    const meta2 = noTs.w.find('.kw-meta')
    expect(norm(meta2.text())).not.toContain('摘要更新于')
    expect(norm(meta2.text())).toBe('由 Nimo 自动维护')
  })

  it('selAiLabel both sides: with aiLabel render <b>, empty string entire block not rendered (blueprint :191)', async () => {
    const withLabel = await mountPage()
    expect(withLabel.w.find('.kw-meta b').exists()).toBe(true)
    expect(norm(withLabel.w.find('.kw-meta b').text())).toBe('主数据盘')
    const noLabel = await mountPage({ query: { path: '/DATA/Documents/Specs' } })
    expect(noLabel.w.find('.kw-meta b').exists(), 'aiLabel empty string should not render <b>').toBe(false)
  })

  it('selName: top-level roots show full path, children show basename (buildWikiTree two branches)', async () => {
    const root = await mountPage()
    expect(norm(root.w.find('.kw-crumb .cur').text())).toBe('/DATA')
    const child = await mountPage({ query: { path: '/DATA/Documents' } })
    expect(norm(child.w.find('.kw-crumb .cur').text())).toBe('Documents')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 openFolder (plan T6-9)
describe('WikiView — openFolder (blueprint :292-294)', () => {
  it('🔴 click "Open folder" → openDirInNewTab(sel)', async () => {
    const { w } = await mountPage({ query: { path: '/DATA/Documents' } })
    const btn = w.findAll('.kw-actions button').find((b) => norm(b.text()) === '打开文件夹')
    expect(btn, '"Open folder" button not rendered (§9.17: confirm it is clickable)').toBeTruthy()
    await btn!.trigger('click')
    expect(openDirInNewTab).toHaveBeenCalledTimes(1)
    expect(openDirInNewTab).toHaveBeenCalledWith('/DATA/Documents')
  })

  it('after changing selection passes new sel (not the one at mount)', async () => {
    const { w } = await mountPage()
    await treeRows(w)[1].trigger('click')
    await flush()
    await w.findAll('.kw-actions button')[0].trigger('click')
    expect(openDirInNewTab).toHaveBeenCalledWith('/DATA/Documents')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 created()'s `if (!wikiRoots.length) loadRoots()` (plan T6-10) — both sides
describe('WikiView — loadRoots gate in created (blueprint :215-218)', () => {
  it('roots not in store → fetch once at mount', async () => {
    await mountPage()
    expect(wiki.getRoots).toHaveBeenCalledTimes(1)
  })

  it('🔴 roots already in store → **do not re-fetch** (copied from blueprint `if (!…length)`)', async () => {
    await mountPage({ seedRoots: ROOTS_NORMALIZED.map((r) => ({ ...r })) })
    expect(wiki.getRoots, 'root list exists but fetched again — `if (!wikiRoots.length)` lost').not.toHaveBeenCalled()
  })

  it('mount immediately fetches tree (loadTree that call unconditional)', async () => {
    await mountPage({ seedRoots: ROOTS_NORMALIZED.map((r) => ({ ...r })) })
    expect(wiki.getTree).toHaveBeenCalledTimes(1)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 "auto-loaded" guard (governance §9.19 / plan T6-12)
//
// This test **currently passes lazily** (assertion still executes, not `it.skip` / `it.todo`);
// **once T7 writes `kw-summary` markup it immediately loads**, forcing simultaneous `showSource` toggle button.
//
// §9.19 cross-task conflict argument: **no conflict** — blueprint T7 items 3, 4 already require
// "`kw-summary` / `kw-rawsrc` mutually exclusive per `showSource`" and "`:137` toggle button text flip between
// `Rendered view` / `View source`" ⇒ this guard does not ask T7 for anything it has no right to write
// (contrasts with P5e's T5↔T6 conflict: that time guard asked T6 to write markup it couldn't, resolved by ruling R25).
//
// 🔴 predicate forbids bare substring (per ruling **R19**): `WikiView.vue`'s file header comment and template T7 placeholder comment
// **both mention `kw-summary` and `showSource` string literals** — bare substring predicate immediately judges this
// "already loaded", then string in comment judges "already satisfied" = double false positive, zero discriminant.
// ⇒ first **strip comments**, then lock `kw-summary` to **class attribute value position**.
// 🔴 comment stripper requires `/*` preceded by **whitespace or line start** (per ruling **R26-3**): bare `/\*[\s\S]*?\*\//`
// gets fooled by **path literals** like `'/Downloads/*'`, treats fake comment opening, eats real code after.
// 🔴 file reading always via `node:fs` (Vite's `?raw` always empty in vitest → assertion false positive on empty string).
// ═══════════════════════════════════════════════════════════════════════════

/** Line-preserving comment stripper — covers `<!-- -->` (template) · `/* *\/` (script) · whole-line `//`. */
function blankComments(src: string): string {
  const blank = (m: string): string => m.replace(/[^\n]/g, ' ')
  return src
    .replace(/<!--[\s\S]*?-->/g, blank)
    .replace(/(^|\s)\/\*[\s\S]*?\*\//g, blank)
    .replace(/^[ \t]*\/\/.*$/gm, blank)
}

/**
 * 🔴🔴 **T7 prerequisite (ruling R28 — closure of T6 review Important I-1)**.
 *
 * **T6's original implementation** (archived, not deleted, honoring "reverse but don't delete"):
 * ```
 * function extractTemplate(src: string): string {
 *   const start = src.indexOf('<template>')          // ← bare indexOf, no column anchoring
 *   const end = src.lastIndexOf('\n</template>')
 *   if (start < 0 || end < 0 || end <= start) return ''
 *   return src.slice(start, end + '\n</template>'.length)
 * }
 * ```
 * **What went wrong**: `WikiView.vue`'s **file header HTML comment** has prose explaining K56
 * "…written on `<template>` itself…" — bare `indexOf('<template>')` hits that **same-name string literal**,
 * anchors start mid-comment, extracts 448 lines (**including entire `<script setup>`**). Three consequences:
 *   ① writing `class="kw-summary …"` in file header comment **false-loads then fails** — but T7 (this task)
 *      per file style will definitely write this phrase in header ⇒ must hit;
 *   ② `/showSource/` line degrades to **always-true filler assertion** (extracted block contains `const showSource = ref(false)`);
 *   ③ "template truly extracted" assertion wording contradicts reality.
 *
 * 🔴 **this task's fix = harden only, relax nothing (§9.10)**, copies correct existing pattern in this repo
 * (`src/ai/styles/knowledgeStyles.test.ts` same-name function):
 *   · **column 0 anchoring** — `<template>` must **occupy line alone** (preceded by line start or `\n`, followed by `\n`);
 *     `</template>` same requirement: whole line exactly equal to it;
 *   · **coverage self-check** — two **independent derivations** (string `indexOf/lastIndexOf` vs **line-by-line** scan)
 *     must match exactly, segment must end with template **original last 3 lines**;
 *   · **reverse empty-loop** — extracted block **must not** contain `<script setup` (criterion: revert to bare `indexOf` → must fail).
 */
function extractTemplate(src: string): { tmpl: string; byLine: string; tail: string } {
  const OPEN = '<template>\n'
  const CLOSE = '\n</template>'
  const EMPTY = { tmpl: '', byLine: '', tail: '' }
  // 🔴 Column-0 anchoring: accept only one shape — line start + `<template>` + newline.
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

  // ── Independent derivation: line-by-line scan (does not reuse the string derivation above) ──
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

describe('WikiView — auto-load guard: template has kw-summary ⇒ must also have showSource toggle button', () => {
  const EX = extractTemplate(SRC)
  const TMPL_RAW = EX.tmpl
  const TMPL = blankComments(TMPL_RAW)

  it('prevent empty ① — template truly extracted, after stripping comments **real markup still there** (not entire block eaten)', () => {
    expect(SRC.length, 'WikiView.vue read as empty — node:fs read failed').toBeGreaterThan(0)
    expect(TMPL_RAW.length, 'root <template> block not extracted').toBeGreaterThan(0)
    // 🔴 real markup anchor: these three classes written by T6, never alone in comments.
    expect(TMPL, 'stripping comments also ate real markup (R26-3 path literal pit)').toMatch(
      /class="kw-node"/,
    )
    expect(TMPL).toMatch(/class="kw-crumb"/)
    expect(TMPL).toMatch(/class="kw-meta"/)
    // what was stripped truly just comments: original has HTML comments, none left after stripping.
    expect(TMPL_RAW).toMatch(/<!--/)
    expect(TMPL).not.toMatch(/<!--/)
  })

  it('🔴 coverage self-check (ruling R28) — two independent derivations match exactly + segment extends to template last line', () => {
    expect(EX.tail, 'cannot find template tail signature').not.toBe('')
    // ① segment must end with template **original last 3 lines** — early truncation fails.
    expect(
      TMPL_RAW.endsWith(EX.tail),
      `extracted template segment does not extend to last line (tail signature:\n${EX.tail}\n) — truncated early`,
    ).toBe(true)
    // ② string derivation vs line-by-line scan must match exactly — content-independent, boundary off by one fails.
    expect(TMPL_RAW, 'string extraction vs line-by-line derivation mismatch — extraction boundary wrong').toBe(EX.byLine)
  })

  it('🔴 reverse empty-loop (ruling R28) — extracted block **must not** contain `<script setup` (criterion: revert to bare indexOf → must fail)', () => {
    // T6's bare `indexOf('<template>')` hits **file header comment**'s same-name string,
    // pulls entire `<script setup>` in ⇒ predicate completely decoupled from "template has markup".
    expect(TMPL_RAW, 'extracted block mixed in <script setup> — start anchor wrong (R28)').not.toContain(
      '<script setup',
    )
    // same family: script's `const showSource = ref(false)` also must not appear in template segment,
    // else `/showSource/` line becomes always-true filler assertion (T6 review I-1 consequence ②).
    expect(TMPL_RAW).not.toContain('const showSource = ref(')
    // prevent empty: confirm file **truly has** both strings (else above two are empty-set assertions).
    expect(SRC, 'WikiView.vue has no <script setup> — above two become empty assertions').toContain(
      '<script setup',
    )
    expect(SRC).toContain('const showSource = ref(')
  })

  it('🔴 real file edge case A (ruling R28) — file header comment has kw-summary, but only as comment ⇒ must judge "not loaded"', () => {
    // 🔴 use **real file header**, only swap template body with minimal markup without summary section.
    //   this is the edge case T6 review found to fail, and **position must be right**:
    //   bare `indexOf('<template>')`'s start lands on file header comment's K56-explaining `<template>` literal,
    //   ⇒ only **the half after it** gets cut into "template block", `<!--` at start already cut
    //   ⇒ comment stripper can't strip it ⇒ predicate reads `class="kw-summary kw-md"` right from comment.
    //   comment **before it** doesn't come in — so edge case must be after, else zero discriminant.
    const headStart = SRC.indexOf('<template>\n')
    expect(headStart, 'cannot find root <template> — this test construction failed').toBeGreaterThan(0)
    const head = SRC.slice(0, headStart)
    // prevent empty ①: file header comment **truly has** `<template>` literal (bare indexOf anchors to it).
    const nakedAnchor = head.indexOf('<template>')
    expect(nakedAnchor, 'file header comment has no <template> literal — this test degrades to empty').toBeGreaterThan(-1)
    // insert note before file header comment's closing `-->` — i.e., "after bare anchor point".
    const lastClose = head.lastIndexOf('-->')
    expect(lastClose, 'cannot find file header comment end').toBeGreaterThan(nakedAnchor)
    const note = '  [edge case] summary section written as <div class="kw-summary kw-md" v-html="html"/> (comment only, not real markup).\n'
    const injectedHead = head.slice(0, lastClose) + note + head.slice(lastClose)
    // prevent empty ②: injection point truly after bare anchor (else this test does not reproduce R28 failure).
    expect(injectedHead.indexOf(note.trim())).toBeGreaterThan(nakedAnchor)
    const headerOnly = injectedHead + '<template>\n  <div class="kw-meta"/>\n</template>\n'
    expect(
      hasSummaryMarkup(blankComments(extractTemplate(headerOnly).tmpl)),
      'kw-summary in file header comment treated as real markup — start anchor wrong (R28 ①)',
    ).toBe(false)
    // comparison: on same source, **bare substring** predicate judges true — this is what to prevent.
    expect(headerOnly.includes('class="kw-summary kw-md"')).toBe(true)
  })

  it('prevent empty ② — predicate bidirectionally discerning (comment content does not count; real class attribute counts)', () => {
    const commentOnly = [
      '<template>',
      '  <!-- summary section class="kw-summary kw-md" and showSource toggle button belong to T7 -->',
      '  <div class="kw-meta"/>',
      '</template>',
    ].join('\n')
    expect(hasSummaryMarkup(blankComments(extractTemplate(commentOnly).tmpl))).toBe(false)
    // comparison: bare substring predicate judges true on same source — this is what R19 prevents.
    expect(commentOnly.includes('kw-summary')).toBe(true)

    const realMarkup = [
      '<template>',
      '  <div class="kw-summary kw-md" v-html="html"/>',
      '</template>',
    ].join('\n')
    expect(hasSummaryMarkup(blankComments(extractTemplate(realMarkup).tmpl))).toBe(true)
    // classes like `kw-summary-foo` with same prefix must not slip through (E-25 word boundary pit).
    const lookalike = '<template>\n  <div class="kw-summary-note"/>\n</template>'
    expect(hasSummaryMarkup(blankComments(extractTemplate(lookalike).tmpl))).toBe(false)
  })

  it('🔴 main assertion: once template has kw-summary, must simultaneously have showSource toggle button (loaded since T7)', () => {
    if (!hasSummaryMarkup(TMPL)) {
      // lazy branch (walked during T6). T7 already wrote markup ⇒ **no longer** walk this branch.
      expect(
        hasSummaryMarkup(TMPL),
        'kw-summary not yet written to template — this test in "loaded-pending" state',
      ).toBe(false)
      return
    }
    expect(
      /showSource/.test(TMPL),
      'template has kw-summary section, but no showSource toggle entry — ' +
        'blueprint :137 "View source / Rendered view" button is summary section only escape, missing means never switch to source view',
    ).toBe(true)
    // button not other element: toggle must be clickable.
    expect(/<button[^>]*showSource|showSource[^<]*<\/button>|@click="showSource/.test(TMPL)).toBe(true)
  })

  it('🔴 loaded state self-proof (T7) — template **truly** has kw-summary (previous test no longer walks lazy branch)', () => {
    expect(
      hasSummaryMarkup(TMPL),
      'T7 already moved in summary section, but predicate judges "not loaded" — either markup wrong or predicate broken',
    ).toBe(true)
  })
})

/** Whether `kw-summary` **truly** appears as a complete token in class attribute (not substring, not comment). */
function hasSummaryMarkup(strippedTmpl: string): boolean {
  return /class="[^"]*(?<![\w-])kw-summary(?![\w-])[^"]*"/.test(strippedTmpl)
}

// ═══════════════════════════════════════════════════════════════════════════
// ═══════════════════════ SP8-P5f Task 7 — bottom-half test cases ═══════════════════════
//
// Coverage: §9.15 XSS · `raw` two branches · `showSource` toggle · `childMap` directory section ·
//       `changes` recent changes · `rescan()` · `kw-foot`.
// 🔴 assertions with data always use `p5f-fixtures/` copies (`NODE_DATA` / `WIKI_RAW_REAL_EXCERPT`),
//    `nodeFor` / `nodeWithChild` only in "just need one valid non-null value" scenarios.
// ═══════════════════════════════════════════════════════════════════════════

/** Use `.CONSTRUCTED` node copy for currently selected article (12 recent_changes / 4 child_map items). */
function useNodeFixture(): void {
  wiki.getNode.mockImplementation((p: string) =>
    Promise.resolve(p === '/DATA' ? NODE_DATA : nodeFor(p)),
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴 §9.15 — `v-html` XSS surface (K49 family second time, only XSS surface this task)
//
// 🔴 **real `renderMarkdown` throughout (includes DOMPurify), not mocked at all.**
//    governance §9.15 mandates: mock out `renderMarkdown` then claim XSS verified = placebo test.
// 🔴 criterion falls on **this task's code**: mount real component → check real DOM, **not** direct call to `renderWikiMarkdown`
//    (that "just forwards renderMarkdown" assertion is in T3's `wikiViewHelpers.test.ts`, different layer).
describe('WikiView — §9.15 v-html XSS surface (real renderMarkdown + real DOM)', () => {
  it('🔴 prerequisite self-proof: `renderMarkdown` **not** mocked (criterion: whoever vi.mocks it, this fails immediately)', () => {
    expect(vi.isMockFunction(renderMarkdown), 'renderMarkdown was mocked — the XSS test degrades into a placebo').toBe(
      false,
    )
    // Real-render output self-check: the real implementation turns markdown into HTML (a mocked-out shell would not).
    expect(renderMarkdown('# hi')).toContain('<h1>')
    expect(renderMarkdown('')).toBe('')
  })

  it('🔴 inject <script> and onerror ⇒ no script elements in DOM, no onerror attributes', async () => {
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
    expect(summary.exists(), 'summary section did not render — this case cannot exercise v-html').toBe(true)
    const el = summary.element as HTMLElement

    // ① no <script> allowed (entire page scope).
    expect(el.querySelector('script'), 'v-html put a <script> element').toBeNull()
    expect(w.element.querySelectorAll('script').length).toBe(0)
    // ② no element with onerror allowed (check attributes per element, not innerHTML text —
    //    markdown-it's `html:false` escapes to **visible text**, text naturally still has those chars).
    const all = Array.from(el.querySelectorAll('*')) as HTMLElement[]
    expect(all.filter((n) => n.hasAttribute('onerror')).map((n) => n.tagName)).toEqual([])
    expect(el.querySelector('img'), 'injected <img> became real element').toBeNull()
    // ③ prevent empty: normal markdown structure **still there** (not slipping by "entire block eaten").
    expect(el.querySelector('h1')?.textContent).toBe('标题仍在')
    expect(el.querySelector('li')?.textContent).toBe('列表项仍在')
    expect(el.querySelector('code')?.textContent).toBe('inline code 仍在')
    // ④ The dangerous string survives on the page as **escaped plain text** (proving it really was fed in, not that it never arrived).
    expect(el.textContent).toContain('alert(1)')
  })

  it('🔴 normal path: `.REAL` true .wiki.md original renders title / list / inline code, zero script', async () => {
    wiki.getRaw.mockResolvedValue(WIKI_RAW_REAL_EXCERPT)
    const { w } = await mountPage()
    const el = w.find('.kw-summary').element as HTMLElement
    // ⚠️ front-matter ending `---` treated by markdown-it as setext level-2 heading underline ⇒
    //   yaml before becomes 1st <h2>. this is **true render result**, assert as-is (don't "fix" input).
    const h2s = Array.from(el.querySelectorAll('h2')).map((n) => n.textContent)
    expect(h2s.length).toBe(3)
    expect(h2s.slice(-2)).toEqual(['Summary', 'Child Map'])
    expect(h2s[0]).toContain('wiki_version: 1')
    expect(el.querySelectorAll('li').length, 'Child Map 5 list items not rendered').toBe(5)
    expect(el.querySelector('li code')?.textContent).toBe('.snapshots/')
    expect(el.querySelectorAll('script').length).toBe(0)
    // HTML comment in real file (`<!-- BEGIN: system -->`) must not become live element / treated as HTML injection.
    expect(el.innerHTML).not.toContain('<!-- BEGIN: system -->')
  })

  it('source view uses `{{ raw }}` text interpolation, not v-html — dangerous string cannot become any element', async () => {
    wiki.getRaw.mockResolvedValue('<script>alert(2)</script>\n\n<b>bold</b>')
    const { w } = await mountPage()
    await w.find('.kw-foot button').trigger('click')
    await flush()
    const pre = w.find('pre.kw-rawsrc')
    expect(pre.exists()).toBe(true)
    expect(pre.text()).toContain('<script>alert(2)</script>')
    expect((pre.element as HTMLElement).querySelectorAll('*').length, 'child elements appeared inside <pre>').toBe(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 `raw !== null` vs `null` two branches (plan T7-3) — four tests
describe('WikiView — raw two branches (blueprint :84-95)', () => {
  it('① raw non-null + showSource=false → render `.kw-summary`, don\'t render `.kw-rawsrc`', async () => {
    const { w } = await mountPage()
    expect(w.find('.kw-summary').exists()).toBe(true)
    expect(w.find('.kw-summary').classes()).toContain('kw-md')
    expect(w.find('.kw-rawsrc').exists()).toBe(false)
    expect(w.find('.kw-pending-title').exists(), 'raw non-null but "no summary" screen appears').toBe(false)
  })

  it('② raw non-null + showSource=true → `pre.kw-rawsrc` displays original verbatim, `.kw-summary` disappears', async () => {
    wiki.getRaw.mockResolvedValue('# 原文\n\n第二行')
    const { w } = await mountPage()
    await w.find('.kw-foot button').trigger('click')
    await flush()
    const pre = w.find('pre.kw-rawsrc')
    expect(pre.exists()).toBe(true)
    expect(pre.text()).toBe('# 原文\n\n第二行')
    expect(w.find('.kw-summary').exists()).toBe(false)
  })

  it('③ raw is null → `kw-pending` screen + rescan button (when owningRoot non-null)', async () => {
    wiki.getRaw.mockRejectedValue(httpError(404)) // N48: store layer converts to null
    const { w } = await mountPage()
    expect(norm(w.find('.kw-pending-title').text())).toBe('此目录还没有 wiki 摘要')
    expect(norm(w.find('.kw-pending-sub').text())).toBe('下次定期扫描时会自动生成。')
    const btn = w.find('.kw-pending button')
    expect(btn.exists(), 'owningRoot exists but rescan button not rendered').toBe(true)
    expect(norm(btn.text())).toBe('重新扫描该根')
    // §9.17: first confirm it's **clickable** element (not rendered but disabled).
    expect((btn.element as HTMLButtonElement).hasAttribute('disabled')).toBe(false)
  })

  it('🔴 ④ when `owningRoot` is null rescan button **entire block not rendered** (§9.17 clickability; criterion: remove v-if → fails)', async () => {
    // device D1 true state: `/v1/wiki/roots` timeout ⇒ store.wikiRoots always empty ⇒ owningRoot always null.
    wiki.getRoots.mockResolvedValue([])
    wiki.getRaw.mockRejectedValue(httpError(404))
    const { w, store } = await mountPage()
    expect(store.wikiRoots.length, 'prerequisite: roots must truly be empty').toBe(0)
    expect(norm(w.find('.kw-pending-title').text())).toBe('此目录还没有 wiki 摘要')
    expect(
      w.find('.kw-pending button').exists(),
      'owningRoot null but rescan button rendered — clicking inevitably hangs',
    ).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 `showSource` toggle (plan T7-4) — button text flip side (reset side in N55 group)
describe('WikiView — showSource toggle button text (blueprint :137-139)', () => {
  it('🔴 text flips between "view source" / "rendered view", click once flips once', async () => {
    const { w } = await mountPage()
    const btn = () => w.find('.kw-foot button')
    expect(norm(btn().text())).toBe('查看原文 →')
    await btn().trigger('click')
    await flush()
    expect(norm(btn().text()), 'after switching to source view, the button should read "Rendered view"').toBe('渲染视图 →')
    await btn().trigger('click')
    await flush()
    expect(norm(btn().text()), 'clicking again should flip back').toBe('查看原文 →')
    expect(w.find('.kw-summary').exists()).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 `childMap` directory section (plan T7-5)
describe('WikiView — childMap directory section (blueprint :97-117)', () => {
  it('🔴 `v-if="node && node.childMap.length"` both sides: only render block with children', async () => {
    useNodeFixture()
    const withChildren = await mountPage()
    const secs = withChildren.w.findAll('.kw-sec')
    expect(secs.length, 'both directory + recent changes blocks should be there').toBeGreaterThanOrEqual(1)
    expect(withChildren.w.find('.kw-children').exists()).toBe(true)
    expect(norm(withChildren.w.findAll('.kw-sec-title')[0]!.text())).toBe('子项清单')
    // opposite: childMap empty → entire block not rendered (nodeFor's childMap is []).
    wiki.getNode.mockImplementation((p: string) => Promise.resolve(nodeFor(p)))
    const empty = await mountPage()
    expect(empty.w.find('.kw-children').exists(), 'childMap empty but directory section rendered').toBe(false)
    // opposite2: node is null (404) ⇒ also not rendered (`node &&` side).
    wiki.getNode.mockRejectedValue(httpError(404))
    const noNode = await mountPage()
    expect(noNode.w.find('.kw-children').exists()).toBe(false)
  })

  it('🔴 count uses `{n} items` + render each name (copy has 4 items, order copied as-is, not sorted)', async () => {
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

  it('🔴 `childIsDir` determines data-kind and icon: items in tree are dirs, others are files', async () => {
    useNodeFixture()
    const { w } = await mountPage()
    // tree has /DATA/Documents ⇒ dir; Downloads (collapsed) / notes.md / Archive not in tree ⇒ file.
    expect(w.findAll('.kw-child-ico').map((n) => n.attributes('data-kind'))).toEqual([
      'dir',
      'file',
      'file',
      'file',
    ])
  })

  it('🔴 `c.isOpaque` → "collapsed" note, both sides', async () => {
    useNodeFixture()
    const { w } = await mountPage()
    const rows = w.findAll('.kw-child')
    // Downloads is the only item in copy with is_opaque: true.
    expect(rows[1]!.find('.kw-child-sum').exists()).toBe(true)
    expect(norm(rows[1]!.find('.kw-child-sum').text())).toBe('已折叠 — 内容不逐项索引')
    for (const i of [0, 2, 3]) {
      expect(rows[i]!.find('.kw-child-sum').exists(), `row ${i} should not have "collapsed" note`).toBe(false)
    }
  })

  it('🔴 `c.lastModified ? fmtTs(...) : ""` both sides (Archive last_modified entire key missing → empty)', async () => {
    // 🔴 **declaration (N58 family second instance of equivalence)**: this ternary in template and `fmtTs`'s builtin `ms ? … : ''`
    //   **mutually redundant** — testing (probe15) removing template ternary alone → 100 green, `fmtTs('')` already returns empty.
    //   ⇒ this test guards **observable behavior** (missing timestamp cell must be empty), not the ternary itself.
    //   criterion: **remove both defaults simultaneously** → this fails (probe21 proof: `1 failed | 99 passed`, this is the red one).
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-05T12:12:00+08:00'))
    useNodeFixture()
    const { w } = await mountPage()
    const metas = w.findAll('.kw-child-meta').map((n) => norm(n.text()))
    expect(metas[0], 'Documents last_modified is 10:12, exactly 2 hours before 12:12').toBe('2 小时前')
    expect(metas[3], 'Archive last_modified is absent ⇒ normalizes to an empty string ⇒ this cell must be empty').toBe('')
  })

  it('🔴 `childClick` branch A — byPath matches ⇒ `select(full)` (criterion: change to always openFileInNewTab → fails)', async () => {
    useNodeFixture()
    const { w } = await mountPage()
    const first = w.findAll('.kw-child')[0]!
    expect(norm(first.find('.kw-child-name').text())).toBe('Documents')
    await first.trigger('click')
    await flush()
    expect(norm(w.find('.kw-crumb .cur').text()), 'clicking directory child did not switch article').toBe('Documents')
    expect(openFileInNewTab, 'directory child must not be passed to file manager').not.toHaveBeenCalled()
  })

  it('🔴 `childClick` branch B — byPath does not match ⇒ `openFileInNewTab(full)` (criterion: change to always select → fails)', async () => {
    useNodeFixture()
    const { w } = await mountPage()
    const third = w.findAll('.kw-child')[2]!
    expect(norm(third.find('.kw-child-name').text())).toBe('notes.md')
    await third.trigger('click')
    await flush()
    expect(openFileInNewTab).toHaveBeenCalledTimes(1)
    expect(openFileInNewTab).toHaveBeenCalledWith('/DATA/notes.md')
    // Selection did not move (never selects a path that does not exist in the tree).
    expect(norm(w.find('.kw-crumb .cur').text())).toBe('/DATA')
  })

  it('🔴 N58 — `childPath` root path branch: when `sel` is `/` produce `/DATA`, not `//DATA`', async () => {
    // build tree with `/` root: in buildWikiTree `/`'s lastIndexOf('/') === 0 ⇒ it's top-level root.
    wiki.getTree.mockResolvedValue(
      [{ path: '/' }, { path: '/DATA' }].map((n) =>
        toStoreShape({ path: n.path, level: '', ai_label: '', user_notes_updated_at: '', last_modified: '' }),
      ),
    )
    wiki.getNode.mockImplementation((p: string) =>
      Promise.resolve(p === '/' ? nodeWithChild('/', 'DATA') : nodeFor(p)),
    )
    const { w } = await mountPage()
    expect(norm(w.find('.kw-crumb .cur').text()), 'prerequisite: initial selection must be `/`').toBe('/')
    const row = w.findAll('.kw-child')[0]!
    // 🔴 `/`'s `replace(/\/+$/, '')` strips to empty string ⇒ identity's "empty" side ⇒ `'' + '/' + 'DATA'`.
    //   if concatenated as `//DATA` then `byPath['//DATA']` misses ⇒ data-kind becomes 'file' ⇒ this fails.
    expect(row.find('.kw-child-ico').attributes('data-kind'), 'childPath concatenated as //DATA').toBe('dir')
    await row.trigger('click')
    await flush()
    // ⚠️ `/DATA` also **top-level root** in this tree (findParent's `i <= 0` makes `/` never parent)
    //   ⇒ its name is full path, breadcrumb shows `/DATA`. this is buildWikiTree existing behavior, assert as-is.
    expect(norm(w.find('.kw-crumb .cur').text()), 'clicking child under root did not switch article').toBe('/DATA')
    expect(openFileInNewTab, 'childPath concatenated wrong ⇒ fell to "no match" branch').not.toHaveBeenCalled()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 `changes` recent changes (plan T7-6)
describe('WikiView — changes recent changes (blueprint :119-132 / :198-208)', () => {
  it('🔴 `v-if="changes.length"` both sides', async () => {
    useNodeFixture()
    const withChanges = await mountPage()
    expect(withChanges.w.find('.kw-changes').exists()).toBe(true)
    expect(
      withChanges.w.findAll('.kw-sec-title').map((n) => norm(n.text())),
    ).toEqual(['子项清单', '最近变化'])
    wiki.getNode.mockImplementation((p: string) => Promise.resolve(nodeFor(p)))
    const none = await mountPage()
    expect(none.w.find('.kw-changes').exists(), 'recentChanges empty but timeline rendered').toBe(false)
  })

  it('🔴 `.slice(0, 10)` limit: copy has 12 items only render 10 (criterion: remove slice → must fail)', async () => {
    useNodeFixture()
    const { w } = await mountPage()
    expect(NODE_DATA.recentChanges.length, 'prerequisite: the fixture copy must have 12 items').toBe(12)
    const rows = w.findAll('.kw-change')
    expect(rows.length, 'changes has no slice(0, 10) — all 12 items rendered').toBe(10)
    // Items 11 and 12 (a11 / a12) must not appear.
    const names = rows.map((r) => r.find('.kw-change-name').text())
    expect(names).not.toContain('Documents/a11.md')
    expect(names).not.toContain('Documents/a12.md')
    expect(names[0]).toBe('Documents/a1.md')
    expect(names[9]).toBe('Documents/a10.md')
  })

  it('🔴 prefix stripping both sides: hits root prefix → relative path; misses → full path (title always full path)', async () => {
    useNodeFixture()
    const { w } = await mountPage()
    const rows = w.findAll('.kw-change')
    // Hit side: root.path = '/DATA' ⇒ prefix '/DATA/' gets stripped.
    expect(rows[0]!.find('.kw-change-name').text()).toBe('Documents/a1.md')
    expect(rows[0]!.find('.kw-change-name').attributes('title')).toBe('/DATA/Documents/a1.md')
    // Miss side: '/outside/a6.md' does not start with '/DATA/' ⇒ shows the full path as-is.
    expect(
      rows[5]!.find('.kw-change-name').text(),
      'cross-root entry had its prefix stripped incorrectly',
    ).toBe('/outside/a6.md')
    expect(rows[5]!.find('.kw-change-name').attributes('title')).toBe('/outside/a6.md')
  })

  it('🔴 owningRoot is null ⇒ prefix is empty string ⇒ nothing gets stripped (third side of prefix stripping)', async () => {
    wiki.getRoots.mockResolvedValue([])
    useNodeFixture()
    const { w, store } = await mountPage()
    expect(store.wikiRoots.length).toBe(0)
    expect(w.findAll('.kw-change-name')[0]!.text()).toBe('/DATA/Documents/a1.md')
  })

  it('🔴 `opToType(c.op)` → `data-type` (four known values + fallback to mod for unknown)', async () => {
    useNodeFixture()
    const { w } = await mountPage()
    const types = w.findAll('.kw-change').map((r) => r.attributes('data-type'))
    // a1 create → add · a2 modify → mod · a3 delete → del · a4 rename → ren · a5 chmod (unknown) → mod
    expect(types.slice(0, 6)).toEqual(['add', 'mod', 'del', 'ren', 'mod', 'mod'])
  })

  it('🔴 `c.at ? fmtAgo(parseTs(c.at)) : ""` both sides', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-05T12:00:00+08:00'))
    // 🔴 The fixture copy's empty-`at` entry (a12) sits at position 12 and gets cut off by slice(0,10) ⇒ here we
    //    **pick two entries verbatim** from the fixture (a1 has at / a12 does not) to build a 2-item recentChanges, values unchanged.
    const picked = [NODE_DATA.recentChanges[0]!, NODE_DATA.recentChanges[11]!]
    expect(picked[0]!.at).toBe('2026-08-05T11:00:00+08:00')
    expect(picked[1]!.at, 'prerequisite: at for entry 12 must be an empty string').toBe('')
    wiki.getNode.mockImplementation((p: string) =>
      Promise.resolve(p === '/DATA' ? { ...NODE_DATA, recentChanges: picked } : nodeFor(p)),
    )
    const { w } = await mountPage()
    const times = w.findAll('.kw-change-time').map((n) => norm(n.text()))
    expect(times[0], 'at is non-empty ⇒ should go through fmtAgo').toBe('1 小时前')
    expect(times[1], 'at is an empty string ⇒ this cell must be empty (not "—" and not 1970)').toBe('')
  })

  // 🔴 Parameterized guard — §9.14-4 empty-loop prevention: pin down the case count first, then go case by case with it.
  const OP_LABEL_CASES: Array<{ op: string; zh: string }> = [
    { op: 'create', zh: '新增' },
    { op: 'modify', zh: '更新' },
    { op: 'delete', zh: '已删除' },
    { op: 'rename', zh: '重命名' },
    { op: 'chmod', zh: '更新' }, // unknown op falls back to 'Updated' (blueprint :205)
  ]
  it('🔴 parameterized guard empty-loop prevention: OP_LABEL_CASES must have exactly 5 entries (else the it.each below is a no-op)', () => {
    expect(OP_LABEL_CASES.length).toBe(5)
    expect(new Set(OP_LABEL_CASES.map((c) => c.op)).size).toBe(5)
  })

  it.each(OP_LABEL_CASES)(
    '🔴 OP_LABEL_KEYS — the label copy for op=$op is $zh',
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
      expect(rows.length, `op=${op} row did not render — this case cannot exercise the label`).toBe(1)
      expect(norm(rows[0]!.find('.kw-change-type').text())).toBe(zh)
    },
  )
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 `rescan()` (plan T7-7)
//
// ⚠️ 🔴 **verify "function gate" must use entry without `:disabled`** (ruling R27 persistent lesson, T5 stumbled):
//    jsdom **does not dispatch click to `:disabled` elements** ⇒ directly clicking the
//    rescan button with `:disabled="rescanBusy"` second click never happens, `rescanBusy` **function gate**
//    never executes = zero discriminant.
// 🔴 **page has no second non-disabled entry** (blueprint has only one button) ⇒ **explicit declaration**:
//    `rescanBusy` function gate on **product UI** protected only by `:disabled`; function gate itself verified by
//    **direct call `vm.rescan()`** (that's its only reachable path). two layers each have one test, locked separately.
describe('WikiView — rescan() (blueprint :295-307)', () => {
  /** `<script setup>` setup binding readable from `w.vm` under VTU (T6 proven readable/writable). */
  function rescanOf(w: ReturnType<typeof mount>): () => Promise<void> {
    const vm = w.vm as unknown as { rescan: () => Promise<void> }
    expect(typeof vm.rescan, 'rescan not exposed on vm — every function-gate case in this group is void').toBe('function')
    return vm.rescan
  }

  it('🔴 when owningRoot null ⇒ **silently return**, zero requests, zero toast (blueprint :297 `!root` side)', async () => {
    // 🔴 declaration: only "rescanRoot not called" **zero discriminant** — testing (probe13: remove `!root ||` → 100 green)
    //   proves: gate removed `root.id` throws TypeError first, `rescanRoot` **still not called**, just one more
    //   "operation failed" toast. ⇒ true discriminant is "any side effects", assertions must hit toast and button state.
    wiki.getRoots.mockResolvedValue([])
    wiki.getRaw.mockRejectedValue(httpError(404))
    const { w, store } = await mountPage()
    expect(store.wikiRoots.length, 'prerequisite: roots must truly be empty').toBe(0)
    const rescanRoot = vi.spyOn(store, 'rescanRoot')
    const toast = vi.spyOn(store, 'toast')
    await rescanOf(w)()
    await flush()
    expect(rescanRoot, 'owningRoot null but rescan request sent').not.toHaveBeenCalled()
    expect(
      toast,
      'owningRoot null but toast appeared — `!root` gate lost (root.id throws TypeError falls to catch)',
    ).not.toHaveBeenCalled()
  })

  it('🔴 rescanBusy in flight ⇒ second call does not fire (function gate; criterion: remove `|| rescanBusy` → this case must fail red)', async () => {
    wiki.getRaw.mockRejectedValue(httpError(404))
    const { w, store } = await mountPage()
    const d = makeDeferred<void>()
    const rescanRoot = vi.spyOn(store, 'rescanRoot').mockReturnValue(d.promise)
    const rescan = rescanOf(w)
    const p1 = rescan() // first call, in flight
    const p2 = rescan() // 🔴 second call synchronously right after — must be blocked by the function gate
    expect(rescanRoot, 'rescanBusy gate did not block the second call').toHaveBeenCalledTimes(1)
    d.resolve()
    await Promise.all([p1, p2])
    await flush()
  })

  it('🔴 control layer: while the first call is in flight the button really is `disabled` (the UI-side layer)', async () => {
    wiki.getRaw.mockRejectedValue(httpError(404))
    const { w, store } = await mountPage()
    const d = makeDeferred<void>()
    vi.spyOn(store, 'rescanRoot').mockReturnValue(d.promise)
    const btn = w.find('.kw-pending button')
    expect((btn.element as HTMLButtonElement).hasAttribute('disabled'), 'should not start out disabled').toBe(
      false,
    )
    await btn.trigger('click')
    await nextTick()
    expect(
      (w.find('.kw-pending button').element as HTMLButtonElement).hasAttribute('disabled'),
      'button did not become disabled during rescanBusy',
    ).toBe(true)
    d.resolve()
    await flush()
  })

  it('🔴 success → `rescanRoot(root.id)` + "Rescan started" toast (click the real button, §9.17 proves it is clickable first)', async () => {
    wiki.getRaw.mockRejectedValue(httpError(404))
    const { w, store } = await mountPage()
    const rescanRoot = vi.spyOn(store, 'rescanRoot').mockResolvedValue(undefined)
    const toast = vi.spyOn(store, 'toast')
    const btn = w.find('.kw-pending button')
    expect(btn.exists()).toBe(true)
    expect((btn.element as HTMLButtonElement).hasAttribute('disabled')).toBe(false)
    await btn.trigger('click')
    await flush()
    // 🔴 id, not path — passing the wrong one 404s on the backend, and none of the three gates would react.
    expect(rescanRoot).toHaveBeenCalledWith('dfcd1840f5dab439cd9d7050aa5bafd0')
    expect(toast).toHaveBeenCalledTimes(1)
    expect(toast.mock.calls[0]![0]).toBe('已开始重新扫描')
  })

  it('🔴 failure → "Operation failed" toast, and **does not echo the backend body** (K58 form A)', async () => {
    wiki.getRaw.mockRejectedValue(httpError(404))
    const { w, store } = await mountPage()
    vi.spyOn(store, 'rescanRoot').mockRejectedValue(new Error('PROBE-T7-RESCAN-500'))
    const toast = vi.spyOn(store, 'toast')
    await w.find('.kw-pending button').trigger('click')
    await flush()
    expect(toast).toHaveBeenCalledTimes(1)
    expect(toast.mock.calls[0]![0]).toBe('操作失败')
    expect(String(toast.mock.calls[0]![0])).not.toContain('PROBE-T7-RESCAN')
    expect(w.html(), 'backend string leaked into the page').not.toContain('PROBE-T7-RESCAN')
  })

  it('🔴 `finally` resets rescanBusy: can fire again after a failure (criterion: remove finally → this case must fail red)', async () => {
    wiki.getRaw.mockRejectedValue(httpError(404))
    const { w, store } = await mountPage()
    const rescanRoot = vi
      .spyOn(store, 'rescanRoot')
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(undefined)
    const rescan = rescanOf(w)
    await rescan()
    await flush()
    // The button must also become un-disabled (if finally never reset it, it would stay gray forever).
    expect(
      (w.find('.kw-pending button').element as HTMLButtonElement).hasAttribute('disabled'),
      'button still gray after failure — finally did not restore rescanBusy',
    ).toBe(false)
    await rescan()
    await flush()
    expect(rescanRoot, 'second call never fired — rescanBusy got stuck').toHaveBeenCalledTimes(2)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 `kw-foot` (plan T7-8)
describe('WikiView — kw-foot (blueprint :134-140)', () => {
  it('🔴 `{path}` interpolation = `sel + "/.wiki.md"`', async () => {
    const { w } = await mountPage({ query: { path: '/DATA/Documents' } })
    const foot = w.find('.kw-foot')
    expect(foot.exists()).toBe(true)
    expect(norm(foot.text())).toContain('本页由 /DATA/Documents/.wiki.md 渲染')
    // E-45: vue-i18n for unmatched placeholders **silently replaces with empty string** ⇒ reverse assertion must not write "contains {path} literal",
    // assert actual interpolated value (above). here just ensure braces not leaked.
    expect(norm(foot.text())).not.toContain('{path}')
  })

  it('🔴 `v-if="raw !== null"` — when raw is null entire footer not rendered', async () => {
    wiki.getRaw.mockRejectedValue(httpError(404))
    const { w } = await mountPage()
    expect(w.find('.kw-foot').exists(), 'raw null but footer rendered (button there switches to empty source view)').toBe(
      false,
    )
  })

  it('`{path}` follows along after switching selection (not the one at mount time)', async () => {
    const { w } = await mountPage()
    expect(norm(w.find('.kw-foot').text())).toContain('/DATA/.wiki.md')
    await treeRows(w)[1].trigger('click')
    await flush()
    expect(norm(w.find('.kw-foot').text())).toContain('/DATA/Documents/.wiki.md')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 [SP8-P5f Task 8 added, 2026-08-06] T7 independent review closure Important I-1:
// `kw-sec-en` two decorator texts **previously zero-guarded**.
// Governance §3.5 / Appendix A §A.4 mandates: blueprint these two **not passed through `$t()`**, copy literals, must not i18n;
// `WikiView.vue` template comments also state this twice. but repo has no assertions guarding it —
// review i18n'd both, single file 100 tests and full repo 4658 tests **all green** ("product code right, guard zero"
// family). ⚠️ same group `.kw-sec-title` Chinese **has** assertion, `kw-title` `TREE` **has** assertion,
// **only `kw-sec-en` pair naked** ⇒ omission, not "this type untested".
// 🔴 criterion (this task tested, see p5f-task-8-report.md): change both to `{{ t('…') }}`
//    → this must fail.
// 🔴 this block **only adds**, `WikiView.test.ts` existing zero changes per line (report to `git diff` self-proves).
describe('WikiView — kw-sec-en decorator text copy literals (Appendix A §A.4 / T7 review I-1)', () => {
  it('🔴 both `kw-sec-en` must be English literals, must not pass through $t()', async () => {
    useNodeFixture()
    const { w } = await mountPage()
    // Prevent empty loop: these two blocks (directory section / recent changes) must truly render, else what is asserted below is an empty array.
    expect(w.find('.kw-children').exists(), 'prerequisite: directory section did not render ⇒ this case cannot discriminate').toBe(true)
    expect(w.find('.kw-changes').exists(), 'prerequisite: recent changes did not render ⇒ this case cannot discriminate').toBe(true)
    expect(
      w.findAll('.kw-sec-en').map((n) => norm(n.text())),
      'kw-sec-en got run through i18n — the blueprint never passes these two through $t(), copy the literals as-is (Appendix A §A.4)',
    ).toEqual(['Contents', 'Recent changes'])
  })
})
