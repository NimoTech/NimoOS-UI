// `AllowlistView.vue` component test.
// Blueprint: the Vue 2 panel's `src/views/AI/Knowledge/AllowlistView.vue` (main@7a6ee6b7, 249 lines).
//
// ═══ mock strategy (governance §4.1 requires explicit statement) ═══
// 🔴 **mock shared package `service.ai.parserAllowlist*` four methods, use real `knowledgeStore`**,
//   do not mock store.
//   Reason same as `SettingsView.test.ts` / `ParserStatus.test.ts`: every cell on this page
//   must traverse two layers:
//   ① K1 layer reduction (blueprint `store.state.extensions` → this repo `store.extensions`);
//   ② **N47's `!!enabled` normalization** (`knowledgeStore.ts:395`). mocking store would skip
//      these two failure-prone things entirely; using real store makes every render assertion
//      naturally an integration assertion — miss one layer or the normalization,
//      that cell immediately goes blank / chip never flips.
// 🔴 Shape (§4.1 table):
//   · `service.ai.parserAllowlistExtensions` → **HTTP as-is**, `enabled` is **SQLite integer 0/1**
//     (zero conversion in package; normalization happens in store).
//   · `service.ai.parserAllowlistFolders` → **HTTP as-is** `{ rules: [...] }`, `rules` elements are
//     `{ id, root_id, path_glob, action }` **snake_case**, store passes through as-is
//     (`knowledgeStore.ts:396`).
//   · `patchParserAllowlistExtensions` / `addParserAllowlistFolder` / `deleteParserAllowlistFolder`
//     response bodies not consumed here, all mocked as `{}` (same shape as
//     `knowledgeStore.parser.test.ts:129-136`, governance §4.1 red flag self-check:
//     same method with different shapes in two test files = time bomb).
//
// ═══ fixture is copy, not runtime read (governance §4 / P5c §4.4) ═══
// Data copied verbatim into the `FIXTURE-COPY-BEGIN/END` block below with **three-level
// source tag**, not read from disk at runtime — fixtures live outside this file's
// dependency graph, so tests that stay self-contained don't risk "file not found" surprises.
// 🔴 **only take data fields, convert `__meta` to comments** — `__meta` is not part of the backend API shape,
// copying it whole into the mock adds a field that doesn't exist in the backend.
// Copy equivalence confirmed by **programmatic byte-by-byte validation** (output in T4
// report §5), not visual inspection.
// Reading `.vue` source files (K55 / N54 those lines) always use `node:fs`, **never Vite's
// `?raw`** (vitest's CSSEnablerPlugin swaps the source for empty string → assertions
// against empty string "false pass"; hard rule).
//
// ═══ attribute state assertion basis (governance §9) ═══
// `data-on` / `data-act` / `data-open` are all ordinary `data-*` attributes (not boolean
// attributes) → SSR renders as string `"false"` not absent, so always `toBe('true')` /
// `toBe('false')`, **assert both sides**, forbid `toBeUndefined()`. `disabled` is a
// true boolean attribute, assert DOM property `el.disabled`.
//
// ═══ named color scan forbidden word boundary (ruling R11, permanent) ═══
// 🔴 **forbid `\bwhite\b`** — `white-space` would match word boundary and false-positive.
// This file always uses `(?<![\w-])COLOR(?![\w-])` form for `color=` attribute values
// (same basis as `knowledgeStyles.test.ts`).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
// i18n is globally set up by `vitest.setup.ts` (see `mountPage` comment), this file does not
// set it up again — and **must not** create a separate `createI18n` (duplicate installation
// with the setup singleton, remember `vitest-reporter-hides-warnings`).
import { useKnowledgeStore } from '../stores/knowledgeStore'
import type { RawAllowlistExtension } from '../stores/knowledgeStore'
import KIcon from '../components/KIcon.vue'
import AllowlistView from './AllowlistView.vue'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SRC_PATH: string = resolve(__dirname, './AllowlistView.vue')
const SRC: string = readFileSync(SRC_PATH, 'utf8')

// ── vi.hoisted mock skeleton (governance §9: avoid ESM hoisting TDZ) ──
const ai = vi.hoisted(() => ({
  parserAllowlistExtensions: vi.fn(),
  parserAllowlistFolders: vi.fn(),
  patchParserAllowlistExtensions: vi.fn(),
  addParserAllowlistFolder: vi.fn(),
  deleteParserAllowlistFolder: vi.fn(),
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: { ai } }))

// ═══════════════════════════════════════════════════════════════════════════
// FIXTURE-COPY-BEGIN  allowlist-extensions.REAL.json  (take `extensions` array only)
// Three-level source tag: **`.REAL`** — raw response from this machine's real
// `GET http://127.0.0.1:8283/v1/parser/allowlist/extensions` (JSON indented for readability
// only, field names / values / order unchanged; see README §0.1 correction block).
// This file's top level has **no** `__meta`, can be used whole; here we take just the
// `extensions` array itself.
// 🔴 Verified (README §2): **45 items**; `enabled` value set = `{1}`, type set = `{int}`
//   ⇒ **cannot get `enabled: 0` from real machine**, chip flip must rely on `.REPLAYED`
//   sample below.
// 🔴 this machine's `.wps` (`enabled: 1`) **does not match any of the three groups**
//   ⇒ page shows only 44/45. **This is blueprint behavior (N54), not a defect this cycle**
//   (ruling §4 vote E).
const EXT_REAL: RawAllowlistExtension[] = [
  { "ext": ".bash", "enabled": 1, "source": "default" },
  { "ext": ".c", "enabled": 1, "source": "default" },
  { "ext": ".cc", "enabled": 1, "source": "default" },
  { "ext": ".cpp", "enabled": 1, "source": "default" },
  { "ext": ".cs", "enabled": 1, "source": "default" },
  { "ext": ".csv", "enabled": 1, "source": "default" },
  { "ext": ".doc", "enabled": 1, "source": "default" },
  { "ext": ".docx", "enabled": 1, "source": "default" },
  { "ext": ".env", "enabled": 1, "source": "default" },
  { "ext": ".fish", "enabled": 1, "source": "default" },
  { "ext": ".go", "enabled": 1, "source": "default" },
  { "ext": ".h", "enabled": 1, "source": "default" },
  { "ext": ".hpp", "enabled": 1, "source": "default" },
  { "ext": ".htm", "enabled": 1, "source": "default" },
  { "ext": ".html", "enabled": 1, "source": "default" },
  { "ext": ".ini", "enabled": 1, "source": "default" },
  { "ext": ".java", "enabled": 1, "source": "default" },
  { "ext": ".js", "enabled": 1, "source": "default" },
  { "ext": ".json", "enabled": 1, "source": "default" },
  { "ext": ".jsx", "enabled": 1, "source": "default" },
  { "ext": ".log", "enabled": 1, "source": "default" },
  { "ext": ".md", "enabled": 1, "source": "default" },
  { "ext": ".odt", "enabled": 1, "source": "default" },
  { "ext": ".pdf", "enabled": 1, "source": "default" },
  { "ext": ".php", "enabled": 1, "source": "default" },
  { "ext": ".ppt", "enabled": 1, "source": "default" },
  { "ext": ".pptx", "enabled": 1, "source": "default" },
  { "ext": ".py", "enabled": 1, "source": "default" },
  { "ext": ".rb", "enabled": 1, "source": "default" },
  { "ext": ".rs", "enabled": 1, "source": "default" },
  { "ext": ".rst", "enabled": 1, "source": "default" },
  { "ext": ".sh", "enabled": 1, "source": "default" },
  { "ext": ".sql", "enabled": 1, "source": "default" },
  { "ext": ".toml", "enabled": 1, "source": "default" },
  { "ext": ".ts", "enabled": 1, "source": "default" },
  { "ext": ".tsv", "enabled": 1, "source": "default" },
  { "ext": ".tsx", "enabled": 1, "source": "default" },
  { "ext": ".txt", "enabled": 1, "source": "default" },
  { "ext": ".wps", "enabled": 1, "source": "default" },
  { "ext": ".xls", "enabled": 1, "source": "default" },
  { "ext": ".xlsx", "enabled": 1, "source": "default" },
  { "ext": ".xml", "enabled": 1, "source": "default" },
  { "ext": ".yaml", "enabled": 1, "source": "default" },
  { "ext": ".yml", "enabled": 1, "source": "default" },
  { "ext": ".zsh", "enabled": 1, "source": "default" },
]
// FIXTURE-COPY-END

// FIXTURE-COPY-BEGIN  allowlist-extensions.REPLAYED.json  (take `extensions` array only)
// Three-level source tag: **`.REPLAYED`** — shape of real machine response, only values
// changed (field names / types / enums unchanged).
// `__meta` converted to this comment (ruling R14), original key points:
//   · why       : this machine's real 45 extensions **all have enabled = 1** ⇒ cannot get
//                 `enabled: 0` sample from real machine.
//   · built_from: took 6 items from `allowlist-extensions.REAL.json` real machine response,
//                 only changed some `enabled` from 1 to 0 (field names / types / `source`
//                 values unchanged).
//   · n47       : `enabled` is SQLite **integer 0/1**, not boolean — store-side
//                 `!!e.enabled` normalization is necessary (`knowledgeStore.ts:395`),
//                 without it chip never flips visually.
//   · n47_page_side: page-side `:data-on="String(e.enabled)"` copied as-is ⇒ after
//                     normalization tests assert 'true'/'false' strings.
const EXT_REPLAYED: RawAllowlistExtension[] = [
  { "ext": ".pdf", "enabled": 1, "source": "default" },
  { "ext": ".docx", "enabled": 0, "source": "default" },
  { "ext": ".md", "enabled": 1, "source": "default" },
  { "ext": ".txt", "enabled": 0, "source": "default" },
  { "ext": ".py", "enabled": 1, "source": "default" },
  { "ext": ".go", "enabled": 1, "source": "default" },
]
// FIXTURE-COPY-END

// FIXTURE-COPY-BEGIN  allowlist-folders.REAL.json  (whole file)
// Three-level source tag: **`.REAL`** — raw response from this machine's real
// `GET .../allowlist/folders` (2026-08-06 actual test = empty rules table; 07-31 same form).
// This file's top level has no `__meta`, can be used whole.
// 🔴 §9.17: this machine is initially in this state ⇒ empty state is **the only side
// reachable without configuration**, non-empty side uses the constructed sample below.
const FOLDERS_REAL = { "rules": [] }
// FIXTURE-COPY-END

/** Non-empty folder rules — 🔴 **`.CONSTRUCTED`**: this machine's `rules` are always empty
 *  (the `.REAL` above is proof), non-empty form cannot be sampled from real machine.
 *  Field names / types constructed per **Parser's HTTP contract** (store passes through as-is,
 *  `knowledgeStore.ts:396`; blueprint `:76-86` reads exactly `r.root_id` / `r.path_glob` /
 *  `r.action`).
 *  🔴 Item 2 deliberately sets `root_id` to empty string, specifically to feed blueprint `:78`'s
 *  `r.root_id || 'any'` fallback (N49 family). */
const FOLDER_RULES_CONSTRUCTED = [
  { id: 1, root_id: 'DATA', path_glob: '/Downloads/*', action: 'deny' },
  { id: 2, root_id: '', path_glob: '/Photos/**/*.raw', action: 'allow' },
]

// ── Three `match` tables from blueprint `:161` / `:163` / `:165` (verbatim copies, for N54
// source comparison) ──
// 🔴 **N54 / corrigendum E-74**: **12 + 13 + 25 = 50** items. Verbatim equivalence between
// copy and blueprint confirmed by programmatic comparison
// (diffed against the Vue 2 panel's source at that commit, not visual inspection).
const DOCS_BLUEPRINT = ['.pdf', '.docx', '.doc', '.pptx', '.ppt', '.xlsx', '.xls', '.odt', '.html', '.htm', '.xml', '.epub']
const TEXT_BLUEPRINT = ['.md', '.markdown', '.txt', '.rst', '.csv', '.tsv', '.json', '.yaml', '.yml', '.toml', '.ini', '.env', '.log']
const CODE_BLUEPRINT = ['.py', '.go', '.js', '.ts', '.jsx', '.tsx', '.java', '.c', '.cc', '.cpp', '.h', '.hpp', '.cs', '.rb', '.rs', '.php', '.sh', '.bash', '.zsh', '.fish', '.sql', '.lua', '.kt', '.scala', '.swift']

const mountedWrappers: Array<ReturnType<typeof mount>> = []

type FolderRuleLike = { id: number | string; root_id?: string; path_glob?: string; action?: string }

function mockAllOk(exts: RawAllowlistExtension[] = EXT_REAL, rules: FolderRuleLike[] = []): void {
  ai.parserAllowlistExtensions.mockResolvedValue({ extensions: exts })
  ai.parserAllowlistFolders.mockResolvedValue({ rules })
  ai.patchParserAllowlistExtensions.mockResolvedValue({})
  ai.addParserAllowlistFolder.mockResolvedValue({})
  ai.deleteParserAllowlistFolder.mockResolvedValue({})
}

/** Mount. Component's `onMounted` fires `store.loadAllowlist()` itself (blueprint `created()`),
 *  so we don't pre-warm store here — let that fire for real, and incidentally guard "mount = fetch".
 *  🔴 **host always in place before mount** (see `withHost()`): `DialogPortal`'s Teleport renders
 *  even when the modal **is closed**, missing host makes **every** mount print two `[Vue warn]`
 *  (Failed to locate Teleport target / Invalid Teleport target on mount). Existing
 *  `SettingsView.test.ts` / `QueueView.test.ts` only add host in modal test cases, accumulating
 *  hundreds of silent warnings each (measured 154) — those are on governance §1.1's no-change
 *  list; this file doesn't create that noise from the start. */
async function mountPage(exts?: RawAllowlistExtension[], rules?: FolderRuleLike[]) {
  if (exts || rules) mockAllOk(exts ?? EXT_REAL, rules ?? [])
  const host = withHost()
  const store = useKnowledgeStore()
  // 🔴 **no longer pass `plugins: [i18n]`** — `vitest.setup.ts` already loaded **the same** i18n
  //   singleton into `config.global.plugins`, passing it again makes every mount print
  //   `[Vue warn]: Plugin has already been applied to target app.` (remember
  //   `vitest-reporter-hides-warnings`: default reporter doesn't print stderr of passing
  //   tests ⇒ this kind of warning silently accumulates). This file verified with
  //   `--reporter=verbose` zero [Vue warn] on mount path. ⚠️ Some existing view tests still
  //   pass it; those are on governance §1.1's no-change list; don't touch.
  const w = mount(AllowlistView)
  mountedWrappers.push(w)
  await flushPromises()
  await nextTick()
  return { w, store, host }
}

/**
 * K57 / P5b handoff item #3 — host for `DialogPortal to=".knowledge-app"`.
 * When mounted alone, this page is not in the `.knowledge-app` subtree (in production the
 * host is provided by `KnowledgeLayout.vue`), test must place its own same-named host in body.
 * 🔴 **`to` only recognizes the first same-named host** → place one per test case;
 * `afterEach`'s `document.body.innerHTML = ''` cleans it up, no bleed to next test.
 * Precedent: `withHost()` in `SettingsView.test.ts` / `QueueView.test.ts`.
 */
function withHost(): HTMLElement {
  const host = document.createElement('div')
  host.className = 'knowledge-app'
  document.body.appendChild(host)
  return host
}

/** Controllable promise — for serial/parallel discrimination (same technique as
 *  `SettingsView.test.ts`). */
function makeDeferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

/** VTU's `.text()` only trims, doesn't collapse internal whitespace; normalize multi-line text
 *  joins before comparison. */
const norm = (s: string): string => s.replace(/\s+/g, ' ').trim()

const extGroups = (w: ReturnType<typeof mount>) => w.findAll('.k-extgroup')
const chipTexts = (w: ReturnType<typeof mount>) => w.findAll('.k-ext-chip').map((c) => norm(c.text()))

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  mockAllOk()
})

afterEach(() => {
  while (mountedWrappers.length) mountedWrappers.pop()!.unmount()
  document.body.innerHTML = ''
})

// ═══════════════════════════════════════════════════════════════════════════
describe('AllowlistView — three-layer shell + two sections (blueprint :2-97, copied layer-by-layer)', () => {
  it('root .k-view > .k-scroll > .k-scroll-inner, two .k-section at innermost', async () => {
    const { w } = await mountPage()
    const root = w.element as HTMLElement
    expect(root.tagName).toBe('DIV')
    expect(root.className).toBe('k-view')
    expect(w.find('.k-view > .k-scroll > .k-scroll-inner').exists()).toBe(true)
    const sections = w.findAll('.k-view > .k-scroll > .k-scroll-inner > .k-section')
    expect(sections).toHaveLength(2)
  })

  it('section headers verbatim (blueprint :8-9 / :58-59)', async () => {
    const { w } = await mountPage()
    const titles = w.findAll('.k-section-title').map((e) => e.text())
    expect(titles).toEqual(['文件类型', '文件夹规则'])
    const hints = w.findAll('.k-section-hint').map((e) => e.text())
    expect(hints).toEqual(['取消勾选的将不再被收录', '优先级：禁止 > 允许 > 默认允许'])
  })

  it('blueprint created() (:189-191) — mount fires loadAllowlist(), each read-only endpoint once', async () => {
    await mountPage()
    expect(ai.parserAllowlistExtensions).toHaveBeenCalledTimes(1)
    expect(ai.parserAllowlistFolders).toHaveBeenCalledTimes(1)
  })

  it('"+ Add Rule" button in section B header, right-aligned (blueprint :60-62)', async () => {
    const { w } = await mountPage()
    const head = w.findAll('.k-section-head')[1]!
    const btn = head.find('button.k-btn.primary')
    expect(btn.exists()).toBe(true)
    expect(norm(btn.text())).toBe('添加规则')
    expect(btn.attributes('style')).toContain('margin-left: auto')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴 K55 (highest risk in this batch) — `GROUPS_TEMPLATE` three `bg` gradient literals → tokens.
// 【Why this suite is necessary】`color-guard.test.ts` **doesn't scan `<script>` constants in
//   `.ts` / `.vue` at all** (cross-area §1 vote B position ④, mutation test shows "color value
//   injection via comments all green"); this repo's `knowledgeStyles.test.ts` gap ③′ only
//   scans `<template>` block, §0.3 only scans `<script>` **comments** — all three miss
//   `<script>` **code body** ⇒ breaking it passes all three gates.
// Pattern = second instance of nailing `NOTE_TYPES` four gradients (K40).
// 🔴 Criterion: inject a color literal into any `bg` → this suite must fail (two outputs +
//   md5sum restore verified).
describe('AllowlistView — K55: GROUPS_TEMPLATE three bg contain only var(--…), zero color literals', () => {
  /** Extract `const GROUPS_TEMPLATE = [ … ]` whole block (up to `]` at column 0). */
  function groupsBlock(src: string): string {
    const start = src.indexOf('const GROUPS_TEMPLATE')
    expect(start, 'GROUPS_TEMPLATE constant not found in AllowlistView.vue').toBeGreaterThan(-1)
    const end = src.indexOf('\n]', start)
    expect(end, 'GROUPS_TEMPLATE closing `]` not found — extraction boundary wrong').toBeGreaterThan(start)
    return src.slice(start, end + 2)
  }

  /** Extract **string literal value** of each `bg:` in block (strip outer quotes). */
  function bgValues(src: string): string[] {
    const block = groupsBlock(src)
    return Array.from(block.matchAll(/\bbg:\s*('[^']*'|"[^"]*")/g)).map((m) => m[1].slice(1, -1))
  }

  // 🔴 §9.19 anti-empty-array guard: first prove "we really extracted three values",
  //   otherwise every test below false-passes on empty array.
  it('anti-empty-array — extracted exactly 3 bg literals (extraction failure != code correct)', () => {
    expect(bgValues(SRC)).toHaveLength(3)
  })

  it('three bg respectively = their var(--grad-ext-*) (appendix B §B.1, values fixed, order is docs/text/code)', () => {
    expect(bgValues(SRC)).toEqual([
      'var(--grad-ext-docs)',
      'var(--grad-ext-text)',
      'var(--grad-ext-code)',
    ])
  })

  it('🔴 three bg zero hex / rgb() / hsl() / linear-gradient() / named colors (criterion: inject hex → fail)', () => {
    const values = bgValues(SRC)
    expect(values.length).toBe(3)
    // Named color list same as the fixed 8-word list in `knowledgeStyles.test.ts` (consistent basis).
    // 🔴 **forbid `\bwhite\b`** — use `(?<![\w-])X(?![\w-])`, compound words with
    //    hyphens like `white-space` are naturally excluded.
    const NAMED = ['white', 'black', 'red', 'green', 'blue', 'orange', 'gray', 'grey']
    for (const v of values) {
      expect(v, `bare hex color in bg: ${v}`).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
      expect(v, `rgb()/hsl() function color in bg: ${v}`).not.toMatch(/\b(rgba?|hsla?)\s*\(/)
      expect(v, `inline gradient in bg (blueprint original not converted to token): ${v}`).not.toMatch(/linear-gradient\s*\(/)
      expect(v, `bg not pure token reference: ${v}`).toMatch(/^var\(--[a-z0-9-]+\)$/)
      // Strip `var(...)` then check named colors — token name itself shouldn't be mistaken
      // for a color value.
      const scrubbed = v.replace(/var\([^)]*\)/g, '')
      for (const c of NAMED) {
        expect(scrubbed, `named color ${c} appears in bg value position: ${v}`).not.toMatch(
          new RegExp(`(?<![\\w-])${c}(?![\\w-])`, 'i'),
        )
      }
    }
  })

  it('three bg each different (criterion: deduplicated into same token / concatenated on one line → fail)', () => {
    const values = bgValues(SRC)
    expect(new Set(values).size).toBe(3)
  })

  it('render side actually passes token into :style (blueprint :14 background: g.bg)', async () => {
    const { w } = await mountPage()
    const styles = w.findAll('.k-extgroup-icon').map((e) => e.attributes('style'))
    expect(styles).toEqual([
      'background: var(--grad-ext-docs);',
      'background: var(--grad-ext-text);',
      'background: var(--grad-ext-code);',
    ])
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 N54 — three `match` extension tables copied verbatim (**12 + 13 + 25 = 50**, corrigendum E-74).
describe('AllowlistView — N54: three match extension tables copied verbatim', () => {
  /** Extract array elements from three `match: (ext) => [ … ].includes(ext)` in source. */
  function matchTables(src: string): string[][] {
    const re = /match:\s*\(ext\)\s*=>\s*\[([^\]]*)\]\s*\.includes\(ext\)/g
    const out: string[][] = []
    let m: RegExpExecArray | null
    while ((m = re.exec(src)) !== null) {
      out.push(
        m[1]
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s.length > 0)
          .map((s) => s.replace(/^['"]|['"]$/g, '')),
      )
    }
    return out
  }

  // 🔴 Anti-empty-array guard: cannot extract three tables, count and verbatim comparison below
  //   false-pass on empty array.
  it('anti-empty-array — extracted exactly 3 match tables', () => {
    expect(matchTables(SRC)).toHaveLength(3)
  })

  it('🔴 three count assertions: docs 12 · text 13 · code 25 (corrigendum E-74, not 24 as originally written)', () => {
    const [docs, text, code] = matchTables(SRC)
    expect(docs.length, 'docs group extension count').toBe(12)
    expect(text.length, 'text group extension count').toBe(13)
    expect(code.length, 'code group extension count').toBe(25)
    expect(docs.length + text.length + code.length, 'three groups total').toBe(50)
  })

  it('🔴 three tables verbatim equal to blueprint (order also copied, no additions or deletions)', () => {
    const [docs, text, code] = matchTables(SRC)
    expect(docs).toEqual(DOCS_BLUEPRINT)
    expect(text).toEqual(TEXT_BLUEPRINT)
    expect(code).toEqual(CODE_BLUEPRINT)
  })

  it('three tables pairwise no overlap (criterion: extension copied to two groups → appears twice on page)', () => {
    const [docs, text, code] = matchTables(SRC)
    const all = [...docs, ...text, ...code]
    expect(new Set(all).size, `duplicate items in three tables: ${all.length} items deduplicated to ${new Set(all).size}`).toBe(50)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('AllowlistView — groups computed (blueprint :181-187): group / sort / empty groups hidden / ungrouped hidden', () => {
  it('real machine 45 extensions → three groups, within group sorted localeCompare asc (each order pinned)', async () => {
    const { w } = await mountPage(EXT_REAL)
    const gs = extGroups(w)
    expect(gs).toHaveLength(3)
    expect(gs.map((g) => g.find('.k-extgroup-title').text())).toEqual(['文档', '文本', '代码'])
    const texts = (i: number) => gs[i]!.findAll('.k-ext-chip').map((c) => norm(c.text()))
    expect(texts(0)).toEqual([
      '.doc', '.docx', '.htm', '.html', '.odt', '.pdf', '.ppt', '.pptx', '.xls', '.xlsx', '.xml',
    ])
    expect(texts(1)).toEqual([
      '.csv', '.env', '.ini', '.json', '.log', '.md', '.rst', '.toml', '.tsv', '.txt', '.yaml', '.yml',
    ])
    expect(texts(2)).toEqual([
      '.bash', '.c', '.cc', '.cpp', '.cs', '.fish', '.go', '.h', '.hpp', '.java', '.js', '.jsx',
      '.php', '.py', '.rb', '.rs', '.sh', '.sql', '.ts', '.tsx', '.zsh',
    ])
  })

  it('🔴 sorting really works — feed reversed, render still asc (criterion: delete .sort() → fail)', async () => {
    const reversed = [...EXT_REAL].reverse()
    const { w } = await mountPage(reversed)
    expect(extGroups(w)[0]!.findAll('.k-ext-chip').map((c) => norm(c.text()))).toEqual([
      '.doc', '.docx', '.htm', '.html', '.odt', '.pdf', '.ppt', '.pptx', '.xls', '.xlsx', '.xml',
    ])
  })

  it('🔴 ruling R6 — extensions not in three tables don\'t show: backend 45, page renders 44 chips, `.wps` absent', async () => {
    const { w, store } = await mountPage(EXT_REAL)
    // First confirm store-side really has 45 (else "page 44" might be incomplete fetch, not filtering)
    expect(store.extensions).toHaveLength(45)
    expect(store.extensions.some((e) => e.ext === '.wps')).toBe(true)
    const chips = chipTexts(w)
    expect(chips).toHaveLength(44)
    expect(chips).not.toContain('.wps')
    // Within-group counts 11 / 12 / 21 (ruling R6 corrected value)
    expect(extGroups(w).map((g) => g.findAll('.k-ext-chip').length)).toEqual([11, 12, 21])
  })

  it('🔴 empty group not rendered at all (filter(g => g.exts.length > 0)): only docs extensions → only 1 .k-extgroup', async () => {
    const { w } = await mountPage([
      { ext: '.pdf', enabled: 1, source: 'default' },
      { ext: '.odt', enabled: 0, source: 'default' },
    ])
    const gs = extGroups(w)
    expect(gs).toHaveLength(1)
    expect(gs[0]!.find('.k-extgroup-title').text()).toBe('文档')
  })

  it('all three groups empty (backend returns empty) → no .k-extgroup rendered, but advanced fold still present', async () => {
    const { w } = await mountPage([])
    expect(extGroups(w)).toHaveLength(0)
    expect(w.find('.k-adv-toggle').exists()).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 N47 — `enabled` is SQLite integer 0/1, normalized in store, page copies `String(e.enabled)` as-is.
describe('AllowlistView — N47: data-on is "true"/"false" strings, assert both sides', () => {
  it('🔴 integers 0/1 come in → chip flips correctly (use .REPLAYED sample: real machine all 1s, can\'t get 0)', async () => {
    const { w, store } = await mountPage(EXT_REPLAYED)
    // Store-side: `!!e.enabled` normalized to boolean (knowledgeStore.ts:395)
    expect(store.extensions.map((e) => e.enabled)).toEqual([true, false, true, false, true, true])
    const chips = w.findAll('.k-ext-chip')
    const pairs = chips.map((c) => [norm(c.text()), c.attributes('data-on')])
    expect(pairs).toEqual([
      ['.docx', 'false'],
      ['.pdf', 'true'],
      ['.md', 'true'],
      ['.txt', 'false'],
      ['.go', 'true'],
      ['.py', 'true'],
    ])
  })

  it('assert string not absence — off chip\'s data-on attribute exists and equals "false"', async () => {
    const { w } = await mountPage(EXT_REPLAYED)
    const off = w.findAll('.k-ext-chip').find((c) => norm(c.text()) === '.docx')!
    expect(off.attributes()).toHaveProperty('data-on')
    expect(off.attributes('data-on')).toBe('false')
  })

  it('onCountFor(g) (blueprint :193) — each group meta is "enabled-count/total enabled"', async () => {
    const { w } = await mountPage(EXT_REPLAYED)
    expect(extGroups(w).map((g) => norm(g.find('.k-extgroup-meta').text()))).toEqual([
      '1/2 已启用',
      '1/2 已启用',
      '2/2 已启用',
    ])
  })

  it('click chip → toggleExtension(ext, !enabled) + success toast (compare both sides text)', async () => {
    const { w, store } = await mountPage(EXT_REPLAYED)
    const toast = vi.spyOn(store, 'toast')
    const on = w.findAll('.k-ext-chip').find((c) => norm(c.text()) === '.pdf')!
    await on.trigger('click')
    await flushPromises()
    expect(ai.patchParserAllowlistExtensions).toHaveBeenLastCalledWith({ ext: '.pdf', enabled: false })
    expect(toast).toHaveBeenLastCalledWith('已停止收录 .pdf')

    const off = w.findAll('.k-ext-chip').find((c) => norm(c.text()) === '.docx')!
    await off.trigger('click')
    await flushPromises()
    expect(ai.patchParserAllowlistExtensions).toHaveBeenLastCalledWith({ ext: '.docx', enabled: true })
    expect(toast).toHaveBeenLastCalledWith('已收录 .docx')
  })

  // ═════════════════════════════════════════════════════════════════════════
  // 🔴 T5 addition (ruling **R24** Important I-1) — K58's **fifth touch point**: `toggle()`'s catch.
  // 【Why add it】T4 review evidence: among K58's five touch points, `toggle()`'s catch
  //   **has no guard at all** — put K5/K58's core prohibition (**echo backend `e.message`**)
  //   directly in that catch, `AllowlistView.test.ts` **all 52/52 green, three gates silent**.
  //   Another instance of "product code correct, zero guards" family; earlier we fill gaps,
  //   sooner we avoid forgetting them (ruling R16).
  // 🔴 Criterion = put `e.message` echo into `AllowlistView.vue`'s `toggle()` catch →
  //   **must fail** (verified complete output + md5sum restore).
  // ⚠️ Probe text `PROBE-K58-8Q3Z-*` same family as other four K58 test cases here;
  //   it **deliberately does not appear in `AllowlistView.vue`** (governance §9: negative
  //   assertion hits comment = false fail).
  // ⚠️ **this batch only adds test cases, `AllowlistView.vue` product code untouched**
  //   (ruling R24: review confirmed verbatim correct).
  it('🔴 K58 (T5 addition) — toggle fail: only show fixed message "Save failed", no backend body echo', async () => {
    const { w, store } = await mountPage(EXT_REPLAYED)
    const toast = vi.spyOn(store, 'toast')
    ai.patchParserAllowlistExtensions.mockRejectedValue(new Error('PROBE-K58-8Q3Z-toggle'))
    // §9.17: first confirm this chip under this data really renders as clickable element
    const chip = w.findAll('.k-ext-chip').find((c) => norm(c.text()) === '.pdf')!
    expect(chip.exists(), '.pdf chip not rendered — next click will hit nothing').toBe(true)
    await chip.trigger('click')
    await flushPromises()
    expect(toast).toHaveBeenLastCalledWith('保存失败')
    expect(toast.mock.calls.flat().join('|')).not.toContain('PROBE-K58-8Q3Z')
    expect(w.html()).not.toContain('PROBE-K58-8Q3Z')
  })

  it('🔴 K58 (T5 addition) — off chip toggle fail takes same catch (other side, also no echo)', async () => {
    const { w, store } = await mountPage(EXT_REPLAYED)
    const toast = vi.spyOn(store, 'toast')
    ai.patchParserAllowlistExtensions.mockRejectedValue(new Error('PROBE-K58-8Q3Z-toggleoff'))
    const chip = w.findAll('.k-ext-chip').find((c) => norm(c.text()) === '.docx')!
    expect(chip.attributes('data-on'), 'this side must be off, otherwise both tests use same data').toBe(
      'false',
    )
    await chip.trigger('click')
    await flushPromises()
    expect(toast).toHaveBeenLastCalledWith('保存失败')
    expect(toast.mock.calls.flat().join('|')).not.toContain('PROBE-K58-8Q3Z')
    expect(w.html()).not.toContain('PROBE-K58-8Q3Z')
    // After fail store shouldn't flip chip (store.toggleExtension threw → normalized list not swapped)
    expect(
      w.findAll('.k-ext-chip').find((c) => norm(c.text()) === '.docx')!.attributes('data-on'),
    ).toBe('false')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 Appendix B §B.3-① — blueprint :30 `color="white"` → `var(--text-on-accent)`.
describe('AllowlistView — check mark KIcon uses token foreground, not named color', () => {
  it('🔴 color attribute = var(--text-on-accent), not any named color (forbid \\bwhite\\b, ruling R11)', async () => {
    const { w } = await mountPage(EXT_REPLAYED)
    const marks = w
      .findAllComponents(KIcon)
      .filter((i) => i.props('name') === 'check' && i.props('size') === 9)
    // Render mark only when on (blueprint :30 v-if="e.enabled") — .REPLAYED has 4 on
    expect(marks.length, 'under v-if="e.enabled" should have 4 checks (.pdf/.md/.go/.py)').toBe(4)
    const NAMED = ['white', 'black', 'red', 'green', 'blue', 'orange', 'gray', 'grey']
    for (const icon of marks) {
      const color = String(icon.props('color'))
      expect(color).toBe('var(--text-on-accent)')
      expect(color, '🔴 --on-accent dark mode is dark color, cannot use on solid foreground (appendix B §B.3.1)').not.toBe(
        'var(--on-accent)',
      )
      const scrubbed = color.replace(/var\([^)]*\)/g, '')
      for (const c of NAMED) {
        expect(scrubbed, `named color ${c} appears in color attribute value position`).not.toMatch(
          new RegExp(`(?<![\\w-])${c}(?![\\w-])`, 'i'),
        )
      }
    }
  })

  it('off chip not render check (blueprint :30 v-if)', async () => {
    const { w } = await mountPage(EXT_REPLAYED)
    const off = w.findAll('.k-ext-chip').find((c) => norm(c.text()) === '.docx')!
    expect(off.find('.k-ext-chip-mark').exists()).toBe(true)
    expect(off.findComponent(KIcon).exists()).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 N52 — setAllInGroup serial + skip already-target-state.
describe('AllowlistView — N52: setAllInGroup serial await + skip already-target-state', () => {
  /** Get "select all / select none" buttons for a group. */
  const groupBtns = (w: ReturnType<typeof mount>, i: number) =>
    extGroups(w)[i]!.findAll('.k-extgroup-toggle button')

  it('🔴 already-target-state don\'t send any request (blueprint :205 if (e.enabled !== on))', async () => {
    // .REAL has docs group 11 all enabled=1 → click "select all" should be zero requests
    const { w, store } = await mountPage(EXT_REAL)
    const toast = vi.spyOn(store, 'toast')
    await groupBtns(w, 0)[0]!.trigger('click')
    await flushPromises()
    expect(ai.patchParserAllowlistExtensions).not.toHaveBeenCalled()
    expect(toast).toHaveBeenCalledWith('已全选 文档')
  })

  it('select none → 11 all sent (each enabled:false), toast text is other side', async () => {
    const { w, store } = await mountPage(EXT_REAL)
    const toast = vi.spyOn(store, 'toast')
    await groupBtns(w, 0)[1]!.trigger('click')
    await flushPromises()
    expect(ai.patchParserAllowlistExtensions).toHaveBeenCalledTimes(11)
    expect(
      ai.patchParserAllowlistExtensions.mock.calls.map((c: unknown[]) => c[0]),
    ).toEqual([
      { ext: '.doc', enabled: false },
      { ext: '.docx', enabled: false },
      { ext: '.htm', enabled: false },
      { ext: '.html', enabled: false },
      { ext: '.odt', enabled: false },
      { ext: '.pdf', enabled: false },
      { ext: '.ppt', enabled: false },
      { ext: '.pptx', enabled: false },
      { ext: '.xls', enabled: false },
      { ext: '.xlsx', enabled: false },
      { ext: '.xml', enabled: false },
    ])
    expect(toast).toHaveBeenCalledWith('已全不选 文档')
  })

  it('🔴🔴 order is **serial**: no second before first lands (criterion: change to Promise.all → must fail)', async () => {
    // Only feed docs group 3 on items — fewer requests, interleave path easy to read.
    const { w } = await mountPage([
      { ext: '.pdf', enabled: 1, source: 'default' },
      { ext: '.doc', enabled: 1, source: 'default' },
      { ext: '.odt', enabled: 1, source: 'default' },
    ])
    const d1 = makeDeferred<unknown>()
    const d2 = makeDeferred<unknown>()
    const d3 = makeDeferred<unknown>()
    const queue = [d1, d2, d3]
    let issued = 0
    ai.patchParserAllowlistExtensions.mockImplementation(() => queue[issued++]!.promise)

    await groupBtns(w, 0)[1]!.trigger('click')
    await nextTick()
    await flushPromises()
    // 🔴 Serial discrimination point: now only **1** should be in flight. `Promise.all` would
    //   be 3 already.
    expect(issued, 'sent more than one at once — setAllInGroup changed to parallel (N52 broken)').toBe(1)
    expect(ai.patchParserAllowlistExtensions).toHaveBeenCalledTimes(1)
    expect(ai.patchParserAllowlistExtensions.mock.calls[0]![0]).toEqual({ ext: '.doc', enabled: false })

    d1.resolve({})
    await flushPromises()
    expect(issued, 'second sent only after first lands').toBe(2)
    expect(ai.patchParserAllowlistExtensions.mock.calls[1]![0]).toEqual({ ext: '.odt', enabled: false })

    d2.resolve({})
    await flushPromises()
    expect(issued).toBe(3)
    expect(ai.patchParserAllowlistExtensions.mock.calls[2]![0]).toEqual({ ext: '.pdf', enabled: false })
    d3.resolve({})
    await flushPromises()
  })

  it('K58 — mid-way fail: only show fixed message "Save failed", no backend body echo', async () => {
    const { w, store } = await mountPage(EXT_REAL)
    const toast = vi.spyOn(store, 'toast')
    ai.patchParserAllowlistExtensions.mockRejectedValue(new Error('PROBE-K58-8Q3Z-setall'))
    await groupBtns(w, 0)[1]!.trigger('click')
    await flushPromises()
    expect(toast).toHaveBeenLastCalledWith('保存失败')
    expect(toast.mock.calls.flat().join('|')).not.toContain('PROBE-K58-8Q3Z')
    expect(w.html()).not.toContain('PROBE-K58-8Q3Z')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 N53 — addCustom normalization.
describe('AllowlistView — N53: addCustom normalization (trim + toLowerCase + prefix dot)', () => {
  /** §9.17: input inside `v-if="customOpen"` — must click open advanced fold first for it to be
   *  clickable/fillable. */
  async function openAdv(w: ReturnType<typeof mount>) {
    expect(w.find('.k-custom-add').exists(), 'input area should not render when folded').toBe(false)
    const toggle = w.find('.k-adv-toggle')
    expect(toggle.attributes('data-open')).toBe('false')
    await toggle.trigger('click')
    expect(toggle.attributes('data-open')).toBe('true')
    const input = w.find('.k-custom-add input')
    expect(input.exists(), 'input must really render when expanded').toBe(true)
    return input
  }

  it('`log` → `.log` (prefix dot)', async () => {
    const { w, store } = await mountPage(EXT_REAL)
    const toast = vi.spyOn(store, 'toast')
    const input = await openAdv(w)
    await input.setValue('log')
    await w.find('.k-custom-add button.k-btn').trigger('click')
    await flushPromises()
    expect(ai.patchParserAllowlistExtensions).toHaveBeenCalledWith({ ext: '.log', enabled: true })
    expect(toast).toHaveBeenLastCalledWith('已添加 .log')
  })

  it('`.LOG ` → `.log` (trim + toLowerCase, already-has dot not repeated)', async () => {
    const { w } = await mountPage(EXT_REAL)
    const input = await openAdv(w)
    await input.setValue('  .LOG  ')
    await input.trigger('keydown.enter')
    await flushPromises()
    expect(ai.patchParserAllowlistExtensions).toHaveBeenCalledWith({ ext: '.log', enabled: true })
  })

  it('🔴 empty string / all-whitespace → no request sent (blueprint :214 if (!ext) return)', async () => {
    const { w } = await mountPage(EXT_REAL)
    const input = await openAdv(w)
    await input.setValue('   ')
    // `disabled` is true boolean attribute — assert both sides
    const btn = w.find('.k-custom-add button.k-btn')
    expect((btn.element as HTMLButtonElement).disabled).toBe(true)
    // Bypass button disabled, directly take enter path, prove function guards itself too
    await input.trigger('keydown.enter')
    await flushPromises()
    expect(ai.patchParserAllowlistExtensions).not.toHaveBeenCalled()
  })

  it('`:disabled="!customExt.trim()"` both sides (blueprint :48)', async () => {
    const { w } = await mountPage(EXT_REAL)
    const input = await openAdv(w)
    const btn = () => w.find('.k-custom-add button.k-btn').element as HTMLButtonElement
    expect(btn().disabled).toBe(true)
    await input.setValue('.conf')
    expect(btn().disabled).toBe(false)
  })

  it('on success customExt cleared (blueprint :219)', async () => {
    const { w } = await mountPage(EXT_REAL)
    const input = await openAdv(w)
    await input.setValue('conf')
    await w.find('.k-custom-add button.k-btn').trigger('click')
    await flushPromises()
    expect((input.element as HTMLInputElement).value).toBe('')
  })

  it('K58 — on fail only show "Add failed", and customExt **not** cleared (blueprint :219 after await)', async () => {
    const { w, store } = await mountPage(EXT_REAL)
    const toast = vi.spyOn(store, 'toast')
    ai.patchParserAllowlistExtensions.mockRejectedValue(new Error('PROBE-K58-8Q3Z-add'))
    const input = await openAdv(w)
    await input.setValue('conf')
    await w.find('.k-custom-add button.k-btn').trigger('click')
    await flushPromises()
    expect(toast).toHaveBeenLastCalledWith('添加失败')
    expect(toast.mock.calls.flat().join('|')).not.toContain('PROBE-K58-8Q3Z')
    expect((input.element as HTMLInputElement).value).toBe('conf')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('AllowlistView — section B empty / non-empty both sides (blueprint :65-91)', () => {
  it('empty state: folderRules empty → hint text, no header or rows rendered', async () => {
    const { w, store } = await mountPage(EXT_REAL, FOLDERS_REAL.rules)
    expect(store.folderRules).toEqual([])
    expect(w.find('.k-frow-head').exists()).toBe(false)
    expect(w.findAll('.k-frow')).toHaveLength(0)
    const body = w.findAll('.k-section-body')[1]!
    expect(norm(body.text())).toContain('还没有规则。点右上角 [+ 添加规则] 开始。')
  })

  it('non-empty state: header + one row per rule (blueprint :69-90)', async () => {
    const { w } = await mountPage(EXT_REAL, FOLDER_RULES_CONSTRUCTED)
    const head = w.find('.k-frow-head')
    expect(head.exists()).toBe(true)
    expect(head.findAll('span').map((s) => s.text())).toEqual(['存储库', '路径', '类型', ''])
    // .k-frow total 3: 1 header + 2 rows
    const rows = w.findAll('.k-frow').filter((r) => !r.classes('k-frow-head'))
    expect(rows).toHaveLength(2)
    expect(rows[0]!.find('.k-frow-root').text()).toContain('DATA')
    expect(rows[0]!.find('.k-frow-path').text()).toBe('/Downloads/*')
    expect(rows[0]!.find('.k-frow-path').attributes('title')).toBe('/Downloads/*')
    expect(rows[0]!.find('.k-frow-action').attributes('data-act')).toBe('deny')
    expect(norm(rows[0]!.find('.k-frow-action').text())).toBe('拒绝')
    // 🔴 N49 family: root_id is empty string → take blueprint :78 `|| 'any'` fallback
    expect(rows[1]!.find('.k-frow-root').text()).toContain('any')
    expect(rows[1]!.find('.k-frow-action').attributes('data-act')).toBe('allow')
    expect(norm(rows[1]!.find('.k-frow-action').text())).toBe('同意')
    // Empty state hint not rendered
    expect(norm(w.findAll('.k-section-body')[1]!.text())).not.toContain('还没有规则')
  })

  it('allow / deny icons different (blueprint :82 ternary)', async () => {
    const { w } = await mountPage(EXT_REAL, FOLDER_RULES_CONSTRUCTED)
    const rows = w.findAll('.k-frow').filter((r) => !r.classes('k-frow-head'))
    expect(rows[0]!.find('.k-frow-action').findComponent(KIcon).props('name')).toBe('x')
    expect(rows[1]!.find('.k-frow-action').findComponent(KIcon).props('name')).toBe('check')
  })

  it('priority hint row always present (blueprint :92-95), both states render', async () => {
    const { w } = await mountPage(EXT_REAL, [])
    expect(norm(w.find('.k-priority-hint').text())).toBe(
      '举例：禁止 /Downloads/* 后，该文件夹下所有文件停止索引',
    )
  })

  it('removeRule success → deleteFolderRule(id) + toast (blueprint :239-246)', async () => {
    const { w, store } = await mountPage(EXT_REAL, FOLDER_RULES_CONSTRUCTED)
    const toast = vi.spyOn(store, 'toast')
    const rows = w.findAll('.k-frow').filter((r) => !r.classes('k-frow-head'))
    const del = rows[0]!.find('button.k-row-action')
    expect(del.attributes('data-tone')).toBe('danger')
    expect(del.attributes('title')).toBe('删除规则')
    await del.trigger('click')
    await flushPromises()
    expect(ai.deleteParserAllowlistFolder).toHaveBeenCalledWith(1)
    expect(toast).toHaveBeenLastCalledWith('已删除，正在清理受影响的文件…')
  })

  it('K58 — removeRule fail only show "Delete failed", no backend body echo', async () => {
    const { w, store } = await mountPage(EXT_REAL, FOLDER_RULES_CONSTRUCTED)
    const toast = vi.spyOn(store, 'toast')
    ai.deleteParserAllowlistFolder.mockRejectedValue(new Error('PROBE-K58-8Q3Z-del'))
    const rows = w.findAll('.k-frow').filter((r) => !r.classes('k-frow-head'))
    await rows[0]!.find('button.k-row-action').trigger('click')
    await flushPromises()
    expect(toast).toHaveBeenLastCalledWith('删除失败')
    expect(toast.mock.calls.flat().join('|')).not.toContain('PROBE-K58-8Q3Z')
    expect(w.html()).not.toContain('PROBE-K58-8Q3Z')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 K57 — "Add Folder Rule" modal to reka primitives (blueprint :101-151 is bare .k-modal-bg +
// @click).
// portal target `.knowledge-app` only recognizes first same-named host → each test `withHost()`.
describe('AllowlistView — K57: reka "Add Folder Rule" modal', () => {
  async function openModal(rules: FolderRuleLike[] = []) {
    // Host created by `mountPage` **before** mount and returned (see its comment).
    const m = await mountPage(EXT_REAL, rules)
    expect(m.host.querySelector('.k-modal'), 'should not render modal by default').toBeNull()
    await m.w.findAll('.k-section-head')[1]!.find('button.k-btn.primary').trigger('click')
    await nextTick()
    await flushPromises()
    return m
  }

  it('click "+ Add Rule" → portal to .knowledge-app; head / body / foot content verbatim', async () => {
    const { host } = await openModal()
    const modal = host.querySelector('.k-modal')
    expect(modal).not.toBeNull()
    // Overlay class name copied from blueprint :102
    expect(host.querySelector('.k-modal-bg')).not.toBeNull()
    // head: DialogTitle wrapped on blueprint's own .k-modal-title (as-child) ⇒ no extra hidden node
    const titleEl = modal!.querySelector('.k-modal-title') as HTMLElement
    expect(titleEl.textContent).toBe('添加文件夹规则')
    expect(titleEl.id).toBe(modal!.getAttribute('aria-labelledby'))
    expect(modal!.querySelectorAll('[id]')).toHaveLength(1)
    expect(modal!.querySelector('.k-modal-head button.k-modal-x')).not.toBeNull()
    // body: three .k-field (storage / path / type), second has .k-field-mono
    const fields = Array.from(modal!.querySelectorAll('.k-field'))
    expect(fields).toHaveLength(3)
    expect(fields.map((f) => f.querySelector('.k-field-label')!.textContent)).toEqual([
      '存储库',
      '路径',
      '类型',
    ])
    expect(fields[1]!.classList.contains('k-field-mono')).toBe(true)
    expect(fields.map((f) => f.querySelector('.k-field-hint')?.textContent ?? null)).toEqual([
      '填 "any" 表示所有存储库都生效',
      '支持 * 通配符，如 /Photos/**/*.raw',
      null,
    ])
    expect(fields.map((f) => f.querySelector('.k-field-hint')?.textContent ?? null)).toEqual([
      '填 "any" 表示所有存储库都生效',
      '支持 * 通配符，如 /Photos/**/*.raw',
      null,
    ])
    // body: two radio cards
    const cards = Array.from(modal!.querySelectorAll('.k-radio-2 .k-radio-card'))
    expect(cards).toHaveLength(2)
    expect(cards.map((c) => c.querySelector('.k-radio-card-text')!.textContent)).toEqual([
      '同意',
      '拒绝',
    ])
    expect(cards.map((c) => c.querySelector('.k-radio-card-desc')!.textContent)).toEqual([
      '收录该路径下的文件',
      '不再收录该路径',
    ])
    expect(
      cards.map((c) => c.querySelector('.k-radio-card-icon')!.getAttribute('data-tone')),
    ).toEqual(['allow', 'deny'])
    // body: bottom full priority explanation
    expect(norm(modal!.querySelector('.k-modal-body')!.textContent!)).toContain(
      '优先级：禁止 > 允许 > 默认允许。例：禁止 /Downloads/* 下所有文件不被索引。',
    )
    // foot: cancel + save rule
    const footBtns = Array.from(modal!.querySelectorAll('.k-modal-foot button'))
    expect(footBtns.map((b) => norm(b.textContent!))).toEqual(['取消', '保存规则'])
    expect(footBtns[0]!.className).toBe('k-btn ghost')
    expect(footBtns[1]!.className).toBe('k-btn primary')
  })

  it('form init value = blueprint :177 (any / /Downloads/* / deny), radio data-on both sides', async () => {
    const { host } = await openModal()
    const inputs = Array.from(host.querySelectorAll('.k-field input')) as HTMLInputElement[]
    expect(inputs[0]!.value).toBe('any')
    expect(inputs[1]!.value).toBe('/Downloads/*')
    const cards = Array.from(host.querySelectorAll('.k-radio-card'))
    expect(cards.map((c) => c.getAttribute('data-on'))).toEqual(['false', 'true'])
  })

  it('click allow card → data-on flips to other side (blueprint :122/:129)', async () => {
    const { host } = await openModal()
    ;(host.querySelectorAll('.k-radio-card')[0] as HTMLElement).click()
    await nextTick()
    expect(
      Array.from(host.querySelectorAll('.k-radio-card')).map((c) => c.getAttribute('data-on')),
    ).toEqual(['true', 'false'])
  })

  it('click × close, no request sent', async () => {
    const { host } = await openModal()
    ;(host.querySelector('.k-modal-x') as HTMLElement).click()
    await nextTick()
    await flushPromises()
    expect(host.querySelector('.k-modal')).toBeNull()
    expect(ai.addParserAllowlistFolder).not.toHaveBeenCalled()
  })

  it('click "Cancel" close, no request sent', async () => {
    const { host } = await openModal()
    const cancel = Array.from(host.querySelectorAll('.k-modal-foot button')).find(
      (b) => norm(b.textContent!) === '取消',
    ) as HTMLElement
    cancel.click()
    await nextTick()
    await flushPromises()
    expect(host.querySelector('.k-modal')).toBeNull()
    expect(ai.addParserAllowlistFolder).not.toHaveBeenCalled()
  })

  it('🔴 click outside mask closes; click inside modal stays open (reka pointerDownOutside ≈ blueprint @click/@click.stop)', async () => {
    const { host } = await openModal()
    // reka's usePointerDownOutside uses setTimeout(0) to delay attaching document listener —
    // add one real macrotask tick.
    await new Promise((r) => setTimeout(r, 0))
    ;(host.querySelector('.k-modal-title') as HTMLElement).dispatchEvent(
      new Event('pointerdown', { bubbles: true }),
    )
    await nextTick()
    expect(host.querySelector('.k-modal'), 'click inside modal should not close').not.toBeNull()
    ;(host.querySelector('.k-modal-bg') as HTMLElement).dispatchEvent(
      new Event('pointerdown', { bubbles: true }),
    )
    await nextTick()
    await flushPromises()
    expect(host.querySelector('.k-modal'), 'click on mask must close').toBeNull()
  })

  it('🔴 `:disabled="!form.path_glob.trim()"` both sides (blueprint :145)', async () => {
    const { host } = await openModal()
    const saveBtn = () =>
      Array.from(host.querySelectorAll('.k-modal-foot button')).find(
        (b) => norm(b.textContent!) === '保存规则',
      ) as HTMLButtonElement
    expect(saveBtn().disabled, 'init /Downloads/* non-empty → clickable').toBe(false)
    const pathInput = (host.querySelectorAll('.k-field input')[1] as HTMLInputElement)
    pathInput.value = '   '
    pathInput.dispatchEvent(new Event('input'))
    await nextTick()
    expect(saveBtn().disabled, 'all-whitespace path → must gray out').toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('AllowlistView — saveRule (blueprint :224-238)', () => {
  async function openModal() {
    const m = await mountPage(EXT_REAL, [])
    await m.w.findAll('.k-section-head')[1]!.find('button.k-btn.primary').trigger('click')
    await nextTick()
    await flushPromises()
    return m
  }

  const saveBtn = (host: HTMLElement) =>
    Array.from(host.querySelectorAll('.k-modal-foot button')).find(
      (b) => norm(b.textContent!) === '保存规则',
    ) as HTMLButtonElement

  const setInput = async (host: HTMLElement, idx: number, v: string) => {
    const el = host.querySelectorAll('.k-field input')[idx] as HTMLInputElement
    el.value = v
    el.dispatchEvent(new Event('input'))
    await nextTick()
  }

  it('success → addFolderRule(snake_case body, path strip spaces) + close modal + toast', async () => {
    const { host, store } = await openModal()
    const toast = vi.spyOn(store, 'toast')
    await setInput(host, 0, 'DATA')
    await setInput(host, 1, '  /Downloads/*  ')
    saveBtn(host).click()
    await flushPromises()
    expect(ai.addParserAllowlistFolder).toHaveBeenCalledWith({
      root_id: 'DATA',
      path_glob: '/Downloads/*',
      action: 'deny',
    })
    expect(host.querySelector('.k-modal')).toBeNull()
    expect(toast).toHaveBeenLastCalledWith('已保存。正在后台清理不再符合规则的文件…')
  })

  it('root_id cleared → take blueprint :227 `|| "any"` fallback', async () => {
    const { host } = await openModal()
    await setInput(host, 0, '')
    saveBtn(host).click()
    await flushPromises()
    expect(ai.addParserAllowlistFolder).toHaveBeenCalledWith({
      root_id: 'any',
      path_glob: '/Downloads/*',
      action: 'deny',
    })
  })

  it('🔴 on success form reset to { any, /Downloads/*, deny } (blueprint :234 verbatim same value) — reopen modal check each cell', async () => {
    const { w, host } = await openModal()
    await setInput(host, 0, 'Backup')
    await setInput(host, 1, '/Media/**')
    ;(host.querySelectorAll('.k-radio-card')[0] as HTMLElement).click()
    await nextTick()
    saveBtn(host).click()
    await flushPromises()
    expect(host.querySelector('.k-modal')).toBeNull()
    // reopen
    await w.findAll('.k-section-head')[1]!.find('button.k-btn.primary').trigger('click')
    await nextTick()
    await flushPromises()
    const inputs = Array.from(host.querySelectorAll('.k-field input')) as HTMLInputElement[]
    expect(inputs[0]!.value).toBe('any')
    expect(inputs[1]!.value).toBe('/Downloads/*')
    expect(
      Array.from(host.querySelectorAll('.k-radio-card')).map((c) => c.getAttribute('data-on')),
    ).toEqual(['false', 'true'])
  })

  it('🔴 K58 — on fail only show "Save failed", modal **stays open**, form **not reset**, no backend body echo', async () => {
    const { host, store } = await openModal()
    const toast = vi.spyOn(store, 'toast')
    ai.addParserAllowlistFolder.mockRejectedValue(new Error('PROBE-K58-8Q3Z-save'))
    await setInput(host, 1, '/Media/**')
    saveBtn(host).click()
    await flushPromises()
    expect(toast).toHaveBeenLastCalledWith('保存失败')
    expect(toast.mock.calls.flat().join('|')).not.toContain('PROBE-K58-8Q3Z')
    expect(host.innerHTML).not.toContain('PROBE-K58-8Q3Z')
    // blueprint :231/:234 after await ⇒ failure path neither thing should happen
    expect(host.querySelector('.k-modal')).not.toBeNull()
    expect((host.querySelectorAll('.k-field input')[1] as HTMLInputElement).value).toBe('/Media/**')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 toast always via `store.toast(...)` (internal 2400ms),
// direct call to `useToast()` loses blueprint's own 2400ms (global `show()` default only 1500ms).
// 🔴 **T5 quick correction (ruling R24 Minor M-1)**: touch point count originally **9**,
//   actually **10** (5 success + **5** catch, not 4 — `toggle`'s catch was miscounted).
//   Basis: `AllowlistView.vue` has `store.toast(` 12 times total, 2 in file header `<!-- -->`
//   comments (those two lines explain this very rule) ⇒ real touch points **10**.
//   ⚠️ **only change comments and test names, no assertion changed** (ruling R24 explicit).
//   ⚠️ Teaching moment for next batch: counting this with bare `/\*[\s\S]*?\*/` strip block
//   comment gives **9** — path literal `'/Downloads/*'` in `saveRule` treated as block
//   comment start, eats all real code after. Strip-comment logic must require `/*` preceded
//   by whitespace or line start (E-25 / ruling R19 family).
describe('AllowlistView — R27: 10 toast all via store.toast (not direct useToast)', () => {
  it('five success + five fail toast all captured by store.toast spy', async () => {
    const { w, store } = await mountPage(EXT_REPLAYED, FOLDER_RULES_CONSTRUCTED)
    const toast = vi.spyOn(store, 'toast')
    // ① toggle success
    await w.findAll('.k-ext-chip')[0]!.trigger('click')
    await flushPromises()
    // ② setAllInGroup success
    await extGroups(w)[0]!.findAll('.k-extgroup-toggle button')[0]!.trigger('click')
    await flushPromises()
    // ③ removeRule success
    const rows = w.findAll('.k-frow').filter((r) => !r.classes('k-frow-head'))
    await rows[0]!.find('button.k-row-action').trigger('click')
    await flushPromises()
    expect(toast.mock.calls.length).toBeGreaterThanOrEqual(3)
    // Criterion: change any place to direct useToast().show(...) → spy record disappears
    expect(toast.mock.calls.map((c: unknown[]) => c[0])).toEqual([
      '已收录 .docx',
      '已全选 文档',
      '已删除，正在清理受影响的文件…',
    ])
  })
})
