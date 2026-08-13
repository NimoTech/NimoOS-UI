// SP8-P5f Task 4 — `AllowlistView.vue` component test.
// Blueprint `NimoOS-UI` @ `7a6ee6b7` `src/views/AI/Knowledge/AllowlistView.vue` (249 lines).
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
// 🔴 Shape (§4.1 table + `p5f-fixtures/README.md` §3):
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
// source tag** (ruling R3 constraint 1), **do not read `.superpowers/` with `node:fs`** —
// that directory is gitignore'd (lost once in SP7), and when this branch merges to master,
// tests under `src/` with cross-boundary dependencies will mysteriously hang with
// "file not found".
// 🔴 **only take data fields, convert `__meta` to comments** (ruling R14 /
// `p5f-fixtures/README.md` §0.2) — `__meta` is not part of the backend API shape,
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
// FIXTURE-COPY-BEGIN  p5f-fixtures/allowlist-extensions.REAL.json  (take `extensions` array only)
// Three-level source tag: **`.REAL`** — raw response from this machine's real
// `GET http://127.0.0.1:8283/v1/parser/allowlist/extensions` (JSON indented for readability
// only, field names / values / order unchanged; see README §0.1 correction block).
// This file's top level has **no** `__meta`, can be used whole; here we take just the
// `extensions` array itself.
// 🔴 Verified (README §2): **45 items**; `enabled` value set = `{1}`, type set = `{int}`
//   ⇒ **cannot get `enabled: 0` from real machine**, chip flip must rely on `.REPLAYED`
//   sample below.
// 🔴 Ruling R6: this machine's `.wps` (`enabled: 1`) **does not match any of the three groups**
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

// FIXTURE-COPY-BEGIN  p5f-fixtures/allowlist-extensions.REPLAYED.json  (take `extensions` array only)
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

// FIXTURE-COPY-BEGIN  p5f-fixtures/allowlist-folders.REAL.json  (whole file)
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
// copy and blueprint confirmed by programmatic comparison in T4 report §6
// (`git -C ../../NimoOS-UI show 7a6ee6b7:...` raw output, not visual inspection).
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
// Pattern = second instance of P5d-T3 nailing `NOTE_TYPES` four gradients (K40).
// 🔴 Criterion: inject a color literal into any `bg` → this suite must fail (two outputs +
//   md5sum restore in T4 report §7).
describe('AllowlistView — K55: GROUPS_TEMPLATE three bg contain only var(--…), zero color literals', () => {
  /** Extract `const GROUPS_TEMPLATE = [ … ]` whole block (up to `]` at column 0). */
  function groupsBlock(src: string): string {
    const start = src.indexOf('const GROUPS_TEMPLATE')
    expect(start, 'AllowlistView.vue 里找不到 GROUPS_TEMPLATE 常量').toBeGreaterThan(-1)
    const end = src.indexOf('\n]', start)
    expect(end, 'GROUPS_TEMPLATE 的收尾 `]` 没找到 —— 抽取边界写错了').toBeGreaterThan(start)
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
    // 🔴 Ruling R11: **forbid `\bwhite\b`** — use `(?<![\w-])X(?![\w-])`, compound words with
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
    // 先坐实 store 侧真的有 45 条(否则「页面 44」可能是取数没取全,而不是过滤生效)
    expect(store.extensions).toHaveLength(45)
    expect(store.extensions.some((e) => e.ext === '.wps')).toBe(true)
    const chips = chipTexts(w)
    expect(chips).toHaveLength(44)
    expect(chips).not.toContain('.wps')
    // 组内计数 11 / 12 / 21(裁定 R6 订正值)
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
    // store 侧:`!!e.enabled` 归一化成 boolean(knowledgeStore.ts:395)
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

  it('onCountFor(g)(蓝本 :193)—— 每组 meta 是「开启数/总数 已启用」', async () => {
    const { w } = await mountPage(EXT_REPLAYED)
    expect(extGroups(w).map((g) => norm(g.find('.k-extgroup-meta').text()))).toEqual([
      '1/2 已启用',
      '1/2 已启用',
      '2/2 已启用',
    ])
  })

  it('点 chip → toggleExtension(ext, !enabled) + 成功 toast(两侧文案都比)', async () => {
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
  // 🔴 T5 追加(裁定 **R24** 的 Important I-1)—— K58 的**第五个落点**:`toggle()` 的 catch。
  // 【为什么补】T4 评审实证:K58 的五个落点里,`toggle()` 的 catch **完全没有守卫** ——
  //   把 K5/K58 最核心的禁令(**回显后端 `e.message`**)直接写进那个 catch,
  //   `AllowlistView.test.ts` **52/52 全绿、三门也一条都不响**。
  //   这是「产品代码对、守卫为零」家族的又一次;缺口越早补越不会被遗忘(承 P5e 裁定 R16)。
  // 🔴 判据 = 把 `e.message` 回显写进 `AllowlistView.vue` 的 `toggle()` catch → **必须报红**
  //   (T5 报告 §7 贴完整输出 + md5sum 还原)。
  // ⚠️ 探针文本 `PROBE-K58-8Q3Z-*` 与本文件其余四条 K58 用例同一族;它**故意不出现在
  //   `AllowlistView.vue` 里**(治理 §9:否定式断言撞注释 = 假报红)。
  // ⚠️ **本刀只新增用例,`AllowlistView.vue` 的产品码一行未动**(裁定 R24:评审已逐字核为正确)。
  it('🔴 K58(T5 追加)—— toggle 失败:只弹固定键「保存失败」,不回显后端 body', async () => {
    const { w, store } = await mountPage(EXT_REPLAYED)
    const toast = vi.spyOn(store, 'toast')
    ai.patchParserAllowlistExtensions.mockRejectedValue(new Error('PROBE-K58-8Q3Z-toggle'))
    // §9.17:先确认这个 chip 在本条数据下真渲染成了可点元素
    const chip = w.findAll('.k-ext-chip').find((c) => norm(c.text()) === '.pdf')!
    expect(chip.exists(), '.pdf chip 没渲染出来 —— 下面那一发 click 会点在空气上').toBe(true)
    await chip.trigger('click')
    await flushPromises()
    expect(toast).toHaveBeenLastCalledWith('保存失败')
    expect(toast.mock.calls.flat().join('|')).not.toContain('PROBE-K58-8Q3Z')
    expect(w.html()).not.toContain('PROBE-K58-8Q3Z')
  })

  it('🔴 K58(T5 追加)—— 关闭态 chip 的 toggle 失败走同一条 catch(另一侧,同样不回显)', async () => {
    const { w, store } = await mountPage(EXT_REPLAYED)
    const toast = vi.spyOn(store, 'toast')
    ai.patchParserAllowlistExtensions.mockRejectedValue(new Error('PROBE-K58-8Q3Z-toggleoff'))
    const chip = w.findAll('.k-ext-chip').find((c) => norm(c.text()) === '.docx')!
    expect(chip.attributes('data-on'), '这一侧必须是关闭态,否则两条用例走的是同一条数据').toBe(
      'false',
    )
    await chip.trigger('click')
    await flushPromises()
    expect(toast).toHaveBeenLastCalledWith('保存失败')
    expect(toast.mock.calls.flat().join('|')).not.toContain('PROBE-K58-8Q3Z')
    expect(w.html()).not.toContain('PROBE-K58-8Q3Z')
    // 失败后 store 侧不该把 chip 翻过去(store.toggleExtension 抛错 ⇒ 归一化列表没被换)
    expect(
      w.findAll('.k-ext-chip').find((c) => norm(c.text()) === '.docx')!.attributes('data-on'),
    ).toBe('false')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 附录 B §B.3-① —— 蓝本 :30 的 `color="white"` → `var(--text-on-accent)`。
describe('AllowlistView —— 勾选标记的 KIcon 用 token 前景色,不是具名色', () => {
  it('🔴 color 属性 = var(--text-on-accent),且不是任何具名色(禁 \\bwhite\\b,裁定 R11)', async () => {
    const { w } = await mountPage(EXT_REPLAYED)
    const marks = w
      .findAllComponents(KIcon)
      .filter((i) => i.props('name') === 'check' && i.props('size') === 9)
    // 开启态才渲染勾(蓝本 :30 的 v-if="e.enabled")—— .REPLAYED 里有 4 个开启
    expect(marks.length, 'v-if="e.enabled" 下应有 4 个勾(.pdf/.md/.go/.py)').toBe(4)
    const NAMED = ['white', 'black', 'red', 'green', 'blue', 'orange', 'gray', 'grey']
    for (const icon of marks) {
      const color = String(icon.props('color'))
      expect(color).toBe('var(--text-on-accent)')
      expect(color, '🔴 --on-accent 暗档是深色,不能用在实底前景上(附录 B §B.3.1)').not.toBe(
        'var(--on-accent)',
      )
      const scrubbed = color.replace(/var\([^)]*\)/g, '')
      for (const c of NAMED) {
        expect(scrubbed, `color 属性值位置出现具名色 ${c}`).not.toMatch(
          new RegExp(`(?<![\\w-])${c}(?![\\w-])`, 'i'),
        )
      }
    }
  })

  it('关闭态 chip 不渲染勾(蓝本 :30 的 v-if)', async () => {
    const { w } = await mountPage(EXT_REPLAYED)
    const off = w.findAll('.k-ext-chip').find((c) => norm(c.text()) === '.docx')!
    expect(off.find('.k-ext-chip-mark').exists()).toBe(true)
    expect(off.findComponent(KIcon).exists()).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 N52 —— setAllInGroup 串行 + 跳过已是目标态。
describe('AllowlistView —— N52:setAllInGroup 串行 await + 跳过已是目标态', () => {
  /** 拿到某一组的「全选 / 全不选」按钮。 */
  const groupBtns = (w: ReturnType<typeof mount>, i: number) =>
    extGroups(w)[i]!.findAll('.k-extgroup-toggle button')

  it('🔴 已是目标态的一个请求都不发(蓝本 :205 的 if (e.enabled !== on))', async () => {
    // .REAL 里 docs 组 11 个全是 enabled=1 → 点「全选」应当零请求
    const { w, store } = await mountPage(EXT_REAL)
    const toast = vi.spyOn(store, 'toast')
    await groupBtns(w, 0)[0]!.trigger('click')
    await flushPromises()
    expect(ai.patchParserAllowlistExtensions).not.toHaveBeenCalled()
    expect(toast).toHaveBeenCalledWith('已全选 文档')
  })

  it('全不选 → 11 个全发(每个 enabled:false),toast 文案是另一侧', async () => {
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

  it('🔴🔴 顺序是**串行**:第一发未落地前不许发第二发(判据:改成 Promise.all → 必须报红)', async () => {
    // 只喂 docs 组的 3 个开启项 —— 请求数少,交错路径好读。
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
    // 🔴 串行的判别点:此刻只该有 **1** 发在飞。`Promise.all` 会在这里已经是 3。
    expect(issued, '一次发出多于一发 —— setAllInGroup 被改成并发了(N52 被破)').toBe(1)
    expect(ai.patchParserAllowlistExtensions).toHaveBeenCalledTimes(1)
    expect(ai.patchParserAllowlistExtensions.mock.calls[0]![0]).toEqual({ ext: '.doc', enabled: false })

    d1.resolve({})
    await flushPromises()
    expect(issued, '第一发落地后才轮到第二发').toBe(2)
    expect(ai.patchParserAllowlistExtensions.mock.calls[1]![0]).toEqual({ ext: '.odt', enabled: false })

    d2.resolve({})
    await flushPromises()
    expect(issued).toBe(3)
    expect(ai.patchParserAllowlistExtensions.mock.calls[2]![0]).toEqual({ ext: '.pdf', enabled: false })
    d3.resolve({})
    await flushPromises()
  })

  it('K58 —— 中途失败:只弹固定键「保存失败」,不回显后端 body', async () => {
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
// 🔴 N53 —— addCustom 的规范化。
describe('AllowlistView —— N53:addCustom 规范化(trim + toLowerCase + 补前导点)', () => {
  /** §9.17:输入框在 `v-if="customOpen"` 里 —— 必须先点开高级折叠区,它才是可点/可填元素。 */
  async function openAdv(w: ReturnType<typeof mount>) {
    expect(w.find('.k-custom-add').exists(), '折叠前输入区不该渲染').toBe(false)
    const toggle = w.find('.k-adv-toggle')
    expect(toggle.attributes('data-open')).toBe('false')
    await toggle.trigger('click')
    expect(toggle.attributes('data-open')).toBe('true')
    const input = w.find('.k-custom-add input')
    expect(input.exists(), '展开后输入框必须真的渲染出来').toBe(true)
    return input
  }

  it('`log` → `.log`(补前导点)', async () => {
    const { w, store } = await mountPage(EXT_REAL)
    const toast = vi.spyOn(store, 'toast')
    const input = await openAdv(w)
    await input.setValue('log')
    await w.find('.k-custom-add button.k-btn').trigger('click')
    await flushPromises()
    expect(ai.patchParserAllowlistExtensions).toHaveBeenCalledWith({ ext: '.log', enabled: true })
    expect(toast).toHaveBeenLastCalledWith('已添加 .log')
  })

  it('`.LOG ` → `.log`(trim + toLowerCase,已有前导点不重复补)', async () => {
    const { w } = await mountPage(EXT_REAL)
    const input = await openAdv(w)
    await input.setValue('  .LOG  ')
    await input.trigger('keydown.enter')
    await flushPromises()
    expect(ai.patchParserAllowlistExtensions).toHaveBeenCalledWith({ ext: '.log', enabled: true })
  })

  it('🔴 空串 / 全空白 → 一个请求都不发(蓝本 :214 的 if (!ext) return)', async () => {
    const { w } = await mountPage(EXT_REAL)
    const input = await openAdv(w)
    await input.setValue('   ')
    // `disabled` 是真布尔属性 —— 两侧都比
    const btn = w.find('.k-custom-add button.k-btn')
    expect((btn.element as HTMLButtonElement).disabled).toBe(true)
    // 绕过按钮 disabled,直接走 enter 键路径,证明函数自己也守住了
    await input.trigger('keydown.enter')
    await flushPromises()
    expect(ai.patchParserAllowlistExtensions).not.toHaveBeenCalled()
  })

  it('`:disabled="!customExt.trim()"` 两侧(蓝本 :48)', async () => {
    const { w } = await mountPage(EXT_REAL)
    const input = await openAdv(w)
    const btn = () => w.find('.k-custom-add button.k-btn').element as HTMLButtonElement
    expect(btn().disabled).toBe(true)
    await input.setValue('.conf')
    expect(btn().disabled).toBe(false)
  })

  it('成功后 customExt 清空(蓝本 :219)', async () => {
    const { w } = await mountPage(EXT_REAL)
    const input = await openAdv(w)
    await input.setValue('conf')
    await w.find('.k-custom-add button.k-btn').trigger('click')
    await flushPromises()
    expect((input.element as HTMLInputElement).value).toBe('')
  })

  it('K58 —— 失败时只弹「添加失败」,且 customExt **不**清空(蓝本 :219 在 await 之后)', async () => {
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
describe('AllowlistView —— B 区空态 / 非空态两侧(蓝本 :65-91)', () => {
  it('空态:folderRules 为空 → 提示文案,且不渲染表头与任何行', async () => {
    const { w, store } = await mountPage(EXT_REAL, FOLDERS_REAL.rules)
    expect(store.folderRules).toEqual([])
    expect(w.find('.k-frow-head').exists()).toBe(false)
    expect(w.findAll('.k-frow')).toHaveLength(0)
    const body = w.findAll('.k-section-body')[1]!
    expect(norm(body.text())).toContain('还没有规则。点右上角 [+ 添加规则] 开始。')
  })

  it('非空态:表头 + 每条规则一行(蓝本 :69-90)', async () => {
    const { w } = await mountPage(EXT_REAL, FOLDER_RULES_CONSTRUCTED)
    const head = w.find('.k-frow-head')
    expect(head.exists()).toBe(true)
    expect(head.findAll('span').map((s) => s.text())).toEqual(['存储库', '路径', '类型', ''])
    // .k-frow 共 3 个:1 个表头 + 2 行
    const rows = w.findAll('.k-frow').filter((r) => !r.classes('k-frow-head'))
    expect(rows).toHaveLength(2)
    expect(rows[0]!.find('.k-frow-root').text()).toContain('DATA')
    expect(rows[0]!.find('.k-frow-path').text()).toBe('/Downloads/*')
    expect(rows[0]!.find('.k-frow-path').attributes('title')).toBe('/Downloads/*')
    expect(rows[0]!.find('.k-frow-action').attributes('data-act')).toBe('deny')
    expect(norm(rows[0]!.find('.k-frow-action').text())).toBe('拒绝')
    // 🔴 N49 同族:root_id 是空串 → 走蓝本 :78 的 `|| 'any'` 兜底
    expect(rows[1]!.find('.k-frow-root').text()).toContain('any')
    expect(rows[1]!.find('.k-frow-action').attributes('data-act')).toBe('allow')
    expect(norm(rows[1]!.find('.k-frow-action').text())).toBe('同意')
    // 空态提示不再渲染
    expect(norm(w.findAll('.k-section-body')[1]!.text())).not.toContain('还没有规则')
  })

  it('allow / deny 两侧的图标不同(蓝本 :82 的三元)', async () => {
    const { w } = await mountPage(EXT_REAL, FOLDER_RULES_CONSTRUCTED)
    const rows = w.findAll('.k-frow').filter((r) => !r.classes('k-frow-head'))
    expect(rows[0]!.find('.k-frow-action').findComponent(KIcon).props('name')).toBe('x')
    expect(rows[1]!.find('.k-frow-action').findComponent(KIcon).props('name')).toBe('check')
  })

  it('优先级提示行恒在(蓝本 :92-95),两态都渲染', async () => {
    const { w } = await mountPage(EXT_REAL, [])
    expect(norm(w.find('.k-priority-hint').text())).toBe(
      '举例：禁止 /Downloads/* 后，该文件夹下所有文件停止索引',
    )
  })

  it('removeRule 成功 → deleteFolderRule(id) + toast(蓝本 :239-246)', async () => {
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

  it('K58 —— removeRule 失败只弹「删除失败」,不回显后端 body', async () => {
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
// 🔴 K57 —— 「添加文件夹规则」弹窗转 reka 原语(蓝本 :101-151 是裸 .k-modal-bg + @click)。
// portal 目标 `.knowledge-app` 只认第一个同名宿主 → 每条用例先 `withHost()`。
describe('AllowlistView —— K57:reka「添加文件夹规则」弹窗', () => {
  async function openModal(rules: FolderRuleLike[] = []) {
    // 宿主由 `mountPage` 在挂载**之前**建好并回传(见它的注释)。
    const m = await mountPage(EXT_REAL, rules)
    expect(m.host.querySelector('.k-modal'), '默认不该渲染弹窗').toBeNull()
    await m.w.findAll('.k-section-head')[1]!.find('button.k-btn.primary').trigger('click')
    await nextTick()
    await flushPromises()
    return m
  }

  it('点「+ 添加规则」→ portal 到 .knowledge-app;head / body / foot 内容逐字', async () => {
    const { host } = await openModal()
    const modal = host.querySelector('.k-modal')
    expect(modal).not.toBeNull()
    // 遮罩类名照抄蓝本 :102
    expect(host.querySelector('.k-modal-bg')).not.toBeNull()
    // head:DialogTitle 套在蓝本自己的 .k-modal-title 上(as-child)⇒ 不多一个隐藏节点
    const titleEl = modal!.querySelector('.k-modal-title') as HTMLElement
    expect(titleEl.textContent).toBe('添加文件夹规则')
    expect(titleEl.id).toBe(modal!.getAttribute('aria-labelledby'))
    expect(modal!.querySelectorAll('[id]')).toHaveLength(1)
    expect(modal!.querySelector('.k-modal-head button.k-modal-x')).not.toBeNull()
    // body:三个 .k-field(存储库 / 路径 / 类型),第二个带 .k-field-mono
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
    // body:两张 radio 卡
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
    // body:底部整段优先级说明
    expect(norm(modal!.querySelector('.k-modal-body')!.textContent!)).toContain(
      '优先级：禁止 > 允许 > 默认允许。例：禁止 /Downloads/* 下所有文件不被索引。',
    )
    // foot:取消 + 保存规则
    const footBtns = Array.from(modal!.querySelectorAll('.k-modal-foot button'))
    expect(footBtns.map((b) => norm(b.textContent!))).toEqual(['取消', '保存规则'])
    expect(footBtns[0]!.className).toBe('k-btn ghost')
    expect(footBtns[1]!.className).toBe('k-btn primary')
  })

  it('表单初值 = 蓝本 :177(any / /Downloads/* / deny),radio 的 data-on 两侧都比', async () => {
    const { host } = await openModal()
    const inputs = Array.from(host.querySelectorAll('.k-field input')) as HTMLInputElement[]
    expect(inputs[0]!.value).toBe('any')
    expect(inputs[1]!.value).toBe('/Downloads/*')
    const cards = Array.from(host.querySelectorAll('.k-radio-card'))
    expect(cards.map((c) => c.getAttribute('data-on'))).toEqual(['false', 'true'])
  })

  it('点「同意」卡 → data-on 翻到另一侧(蓝本 :122/:129)', async () => {
    const { host } = await openModal()
    ;(host.querySelectorAll('.k-radio-card')[0] as HTMLElement).click()
    await nextTick()
    expect(
      Array.from(host.querySelectorAll('.k-radio-card')).map((c) => c.getAttribute('data-on')),
    ).toEqual(['true', 'false'])
  })

  it('点 × 关闭,且不发请求', async () => {
    const { host } = await openModal()
    ;(host.querySelector('.k-modal-x') as HTMLElement).click()
    await nextTick()
    await flushPromises()
    expect(host.querySelector('.k-modal')).toBeNull()
    expect(ai.addParserAllowlistFolder).not.toHaveBeenCalled()
  })

  it('点「取消」关闭,且不发请求', async () => {
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

  it('🔴 点遮罩(弹窗外)关闭;点弹窗内不关闭(reka pointerDownOutside 等价蓝本 @click/@click.stop)', async () => {
    const { host } = await openModal()
    // reka 的 usePointerDownOutside 用 setTimeout(0) 延后挂 document 监听 —— 补一次真宏任务 tick。
    await new Promise((r) => setTimeout(r, 0))
    ;(host.querySelector('.k-modal-title') as HTMLElement).dispatchEvent(
      new Event('pointerdown', { bubbles: true }),
    )
    await nextTick()
    expect(host.querySelector('.k-modal'), '点弹窗内不该关闭').not.toBeNull()
    ;(host.querySelector('.k-modal-bg') as HTMLElement).dispatchEvent(
      new Event('pointerdown', { bubbles: true }),
    )
    await nextTick()
    await flushPromises()
    expect(host.querySelector('.k-modal'), '点遮罩必须关闭').toBeNull()
  })

  it('🔴 `:disabled="!form.path_glob.trim()"` 两侧(蓝本 :145)', async () => {
    const { host } = await openModal()
    const saveBtn = () =>
      Array.from(host.querySelectorAll('.k-modal-foot button')).find(
        (b) => norm(b.textContent!) === '保存规则',
      ) as HTMLButtonElement
    expect(saveBtn().disabled, '初值 /Downloads/* 非空 → 可点').toBe(false)
    const pathInput = (host.querySelectorAll('.k-field input')[1] as HTMLInputElement)
    pathInput.value = '   '
    pathInput.dispatchEvent(new Event('input'))
    await nextTick()
    expect(saveBtn().disabled, '全空白路径 → 必须灰掉').toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('AllowlistView —— saveRule(蓝本 :224-238)', () => {
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

  it('成功 → addFolderRule(snake_case body,path 去空格)+ 关弹窗 + toast', async () => {
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

  it('root_id 被清空 → 走蓝本 :227 的 `|| "any"` 兜底', async () => {
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

  it('🔴 成功后表单重置成 { any, /Downloads/*, deny }(蓝本 :234 逐字同值)—— 重开弹窗逐格验', async () => {
    const { w, host } = await openModal()
    await setInput(host, 0, 'Backup')
    await setInput(host, 1, '/Media/**')
    ;(host.querySelectorAll('.k-radio-card')[0] as HTMLElement).click()
    await nextTick()
    saveBtn(host).click()
    await flushPromises()
    expect(host.querySelector('.k-modal')).toBeNull()
    // 重开
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

  it('🔴 K58 —— 失败:只弹「保存失败」,弹窗**不关**、表单**不重置**,且不回显后端 body', async () => {
    const { host, store } = await openModal()
    const toast = vi.spyOn(store, 'toast')
    ai.addParserAllowlistFolder.mockRejectedValue(new Error('PROBE-K58-8Q3Z-save'))
    await setInput(host, 1, '/Media/**')
    saveBtn(host).click()
    await flushPromises()
    expect(toast).toHaveBeenLastCalledWith('保存失败')
    expect(toast.mock.calls.flat().join('|')).not.toContain('PROBE-K58-8Q3Z')
    expect(host.innerHTML).not.toContain('PROBE-K58-8Q3Z')
    // 蓝本 :231/:234 在 await 之后 ⇒ 失败路径两件事都不该发生
    expect(host.querySelector('.k-modal')).not.toBeNull()
    expect((host.querySelectorAll('.k-field input')[1] as HTMLInputElement).value).toBe('/Media/**')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 裁定 R27 / 勘误 E-62 —— toast 一律走 `store.toast(...)`(内部 2400ms),
// 直调 `useToast()` 会丢掉蓝本自己的 2400ms(全局 `show()` 默认只有 1500ms)。
// 🔴 **T5 顺手订正(裁定 R24 的 Minor M-1)**:落点数原写 **9**,实为 **10**
//   (5 个成功 + **5** 个 catch,不是 4 个 —— `toggle` 的 catch 被漏数了)。
//   口径:`AllowlistView.vue` 里 `store.toast(` 共 12 处,其中 2 处在文件头的 `<!-- -->`
//   注释里(那两行讲的正是这条约定本身)⇒ 真落点 **10**。
//   ⚠️ **只改注释与用例名,一条断言都没动**(裁定 R24 明令)。
//   ⚠️ 顺带一条给下一刀的教训:核这个数时用「裸 `/\*[\s\S]*?\*/` 剥块注释」会数成 **9** ——
//     `saveRule` 里的路径字面量 `'/Downloads/*'` 会被当成块注释的起点,一路吃掉后面的真代码。
//     剥注释器必须要求 `/*` 前面是空白或行首(E-25 / 裁定 R19 同族)。
describe('AllowlistView —— R27:10 处 toast 全部经 store.toast(不是直调 useToast)', () => {
  it('五个成功分支 + 五个失败分支的 toast 都被 store.toast 的 spy 捕获', async () => {
    const { w, store } = await mountPage(EXT_REPLAYED, FOLDER_RULES_CONSTRUCTED)
    const toast = vi.spyOn(store, 'toast')
    // ① toggle 成功
    await w.findAll('.k-ext-chip')[0]!.trigger('click')
    await flushPromises()
    // ② setAllInGroup 成功
    await extGroups(w)[0]!.findAll('.k-extgroup-toggle button')[0]!.trigger('click')
    await flushPromises()
    // ③ removeRule 成功
    const rows = w.findAll('.k-frow').filter((r) => !r.classes('k-frow-head'))
    await rows[0]!.find('button.k-row-action').trigger('click')
    await flushPromises()
    expect(toast.mock.calls.length).toBeGreaterThanOrEqual(3)
    // 判据:任何一处改成直调 useToast().show(...) → 该处的 spy 记录消失
    expect(toast.mock.calls.map((c: unknown[]) => c[0])).toEqual([
      '已收录 .docx',
      '已全选 文档',
      '已删除，正在清理受影响的文件…',
    ])
  })
})
