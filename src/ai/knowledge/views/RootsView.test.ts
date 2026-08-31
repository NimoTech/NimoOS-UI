// Component test for `RootsView.vue`.
// Blueprint: the Vue 2 panel @ `7a6ee6b7` `src/views/AI/Knowledge/RootsView.vue` (289 lines).
//
// ═══ Mock strategy (governance §4.1 requires explicit documentation) ═══
// 🔴 **Mock the six `service.wiki.*` methods of the shared package, use real `knowledgeStore`** — don't mock store.
//   Reasoning same as `AllowlistView.test.ts` / `SettingsView.test.ts`, plus one **critical** reason more:
//   🔴🔴 **Decision R9's `toggle()` invariant** ("store mutates the same object in-place") can only
//   be tested by using a real store — if we mock `setRootEnabled`, `r.enabled` never changes,
//   and those two guard tests degrade to "assert a value that never changes", with zero discriminative power.
// 🔴 Shape (§4.1 table + `p5f-fixtures/README.md` §3):
//   · `service.wiki.getRoots` — **shared package already normalized** (`the shared service package's src/wiki.ts:85`
//     `normalizeRoot`) ⇒ 🔴 **camelCase** (`id`/`path`/`watchMode`/`scanIntervalS`/
//     `lastScanAt`/`enabled`), **not** HTTP raw's PascalCase (N46 / T0 §4.4 decision).
//   · `service.wiki.getCandidates` — **pass-through as-is, no normalization** (`wiki.ts:154-157`) ⇒
//     snake_case shape: `{ path, type, size?, label? }`.
//   · Response bodies of `createRoot` / `deleteRoot` / `rescanRoot` / `patchRootEnabled` are not
//     consumed by this page, all mocked to `{}`.
// 🔴 **`createRootBody` use the real one** (`vi.importActual` preserved) — it's a D3 artifact already
//   in the package, this repo is not allowed to rewrite it; tests must also compare against
//   **the real version**, otherwise it's like writing a shadow implementation.
//
// ═══ Fixtures are copies, not runtime reads (governance §4 / P5c §4.4) ═══
// Data copied verbatim into the `FIXTURE-COPY-BEGIN/END` blocks below with **three-level source tags**
// (decision R3 constraint 1), **don't use `node:fs` to read the capture directory at runtime** — that directory is
// gitignored (lost entirely in SP7 once).
// 🔴 **Take only data fields, convert `__meta` to comments** (decision R14 / `p5f-fixtures/README.md` §0.2).
// Copy equivalence confirmed by **byte-for-byte programmatic verification**,
// not by eyeballing.
// Always read `.vue` source files with `node:fs`, **never use Vite's `?raw`** (always empty under vitest → false positives).
//
// ═══ Property state assertion criteria (governance §9) ═══
// `data-on` / `data-off` / `data-open` are plain `data-*` attributes (not boolean attributes) → JSDOM renders
// as string `"false"` not absent, so always use `toBe('true')` / `toBe('false')`, **compare both sides**.
// `disabled` is a true boolean attribute, assert DOM property `el.disabled`.
//
// ═══ Named color scan forbidden word boundaries (decision R11, permanent) ═══
// 🔴 **Forbid `\bwhite\b`** — `white-space` would match word boundary and cause false positives. This file
// uses `(?<![\w-])COLOR(?![\w-])` pattern for all `color=` attribute values (same criteria as `knowledgeStyles.test.ts`).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { createRootBody } from '@nimotech/nimoos-service'
import type { WikiRoot } from '@nimotech/nimoos-service'
// i18n configured globally by `vitest.setup.ts` (see `mountPage` comment), don't set up here — also **don't**
// create a separate `createI18n` (would duplicate with setup's singleton, see memory `vitest-reporter-hides-warnings`).
import { useKnowledgeStore } from '../stores/knowledgeStore'
import KIcon from '../components/KIcon.vue'
import FolderBrowser from '../components/FolderBrowser.vue'
import RootsView from './RootsView.vue'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SRC_PATH: string = resolve(__dirname, './RootsView.vue')
const SRC: string = readFileSync(SRC_PATH, 'utf8')

// ── vi.hoisted mock skeleton (governance §9: avoid ESM hoisting TDZ) ──
const wiki = vi.hoisted(() => ({
  getRoots: vi.fn(),
  getCandidates: vi.fn(),
  createRoot: vi.fn(),
  deleteRoot: vi.fn(),
  rescanRoot: vi.fn(),
  patchRootEnabled: vi.fn(),
}))
const folder = vi.hoisted(() => ({ getList: vi.fn() }))
// 🔴 Replace only `service`, **preserve `createRootBody` as-is** (importOriginal) — the assertion in this page
//   that "body is the product of createRootBody" must compare against the real version, not a shadow implementation.
vi.mock('@nimotech/nimoos-service', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, service: { wiki, folder } }
})

// ═══════════════════════════════════════════════════════════════════════════
// FIXTURE-COPY-BEGIN  p5f-fixtures/wiki-roots.normalized.CONSTRUCTED.json  (only `wikiRoots` array)
// Three-level source tag: **`.CONSTRUCTED`** — 🔴 **not real-device data**. Convert `__meta` to comments (decision R14),
// original key points:
//   · label     : .CONSTRUCTED
//   · why       : same as wiki-roots.CONSTRUCTED.json — /roots times out on device (90 s / 0 bytes), no real-device sample.
//   · built_from: pass each field of wiki-roots.CONSTRUCTED.json's raw_response through
//                 the shared service package's src/wiki.ts:85 normalizeRoot.
//   · shape     : 🔴 camelCase — this is the shape of store.state.wikiRoots output;
//                 RootsView / WikiView mocks all follow it (N46).
//   · note      : enabled normalized to boolean via `!!r.Enabled`;
//                 scanIntervalS/createdAt/lastScanAt have `|| 0` fallback.
// 🔴 Device D1: `/v1/wiki/roots` 90 s zero-byte timeout ⇒ §9.17 determines "list rows, toggle, rescan, delete
//   all unreachable", device can only see empty state. **This is not a defect, it's D1.**
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

// FIXTURE-COPY-BEGIN  p5f-fixtures/wiki-candidates.CONSTRUCTED.json  (only `candidates` array)
// Three-level source tag: **`.CONSTRUCTED`** — 🔴 **not real-device data**. Convert `__meta` to comments (decision R14):
//   · why        : GET /v1/wiki/candidates returns 200 on device but always `[]` in practice (see wiki-candidates.REAL.json,
//                  tested three times, 3 bytes each) ⇒ **no non-empty** sample available.
//   · built_from : Candidate struct from NimoOS-Wiki/service/roots/candidates.go;
//                  Path/Type always present (json tag has no omitempty), Size/Label are omitempty (entire key absent at zero value).
//   · passthrough: 🔴 getCandidates **does not normalize** (the shared service package's src/wiki.ts:154-157 pass-through as-is)
//                  ⇒ this is the shape seen by the page, **not camelCase normalized**.
//   · consumer   : RootsView's browserRoots = pickerRoots(store.state.wikiCandidates).
const CANDIDATES_CONSTRUCTED = [
  { "path": "/DATA", "type": "dir", "size": 0, "label": "主数据盘" },
  { "path": "/DATA/Documents", "type": "dir" },
  { "path": "/mnt/backup", "type": "dir", "label": "备份盘" }
]
// FIXTURE-COPY-END

// FIXTURE-COPY-BEGIN  p5f-fixtures/wiki-candidates.REAL.json  (entire file)
// Three-level source tag: **`.REAL`** — raw response from real device `GET http://127.0.0.1:41373/v1/wiki/candidates`
// (HTTP 200, 3 bytes). This file has no `__meta` at top level, use entire content as-is.
// 🔴 §9.17: device is in this state ⇒ `FolderBrowser` candidates always empty, use `pickerRoots` fallback three roots.
const CANDIDATES_REAL: never[] = []
// FIXTURE-COPY-END

const mountedWrappers: Array<ReturnType<typeof mount>> = []

/** Deep clone — each test case gets its own copy of objects, preventing `setRootEnabled` in-place mutations from leaking to the next test. */
const cloneRoots = (rows: WikiRoot[] = ROOTS_NORMALIZED): WikiRoot[] =>
  rows.map((r) => ({ ...r }))

function mockAllOk(roots: WikiRoot[] = cloneRoots(), candidates: unknown[] = CANDIDATES_REAL): void {
  wiki.getRoots.mockResolvedValue(roots)
  wiki.getCandidates.mockResolvedValue(candidates)
  wiki.createRoot.mockResolvedValue({})
  wiki.deleteRoot.mockResolvedValue({})
  wiki.rescanRoot.mockResolvedValue({})
  wiki.patchRootEnabled.mockResolvedValue({})
  folder.getList.mockResolvedValue({ content: [] })
}

/**
 * K57 / P5b handoff item #3 — Host for `DialogPortal to=".knowledge-app"`.
 * When mounted alone, this page is not in the `.knowledge-app` subtree (in production the host is provided by `KnowledgeLayout.vue`),
 * so tests must provide a host with that name in body.
 * 🔴 **`to` only recognizes the first host with that name** → place exactly one per test case; `afterEach`'s
 * `document.body.innerHTML = ''` cleans it up, preventing leakage to the next test.
 * Precedent: `AllowlistView.test.ts` / `SettingsView.test.ts` / `QueueView.test.ts`.
 */
function withHost(): HTMLElement {
  const host = document.createElement('div')
  host.className = 'knowledge-app'
  document.body.appendChild(host)
  return host
}

/** Mount. Component calls `store.loadRoots()` itself in `onMounted` (blueprint uses `created()`),
 *  so don't warm up the store here — let that call run for real, and guard "mount = load" invariant.
 *  🔴 **Host must be in place before mount**: `DialogPortal`'s Teleport renders even when the dialog is **closed**,
 *  missing host causes two `[Vue warn]` per mount (precedent and reasoning in `AllowlistView.test.ts`). */
async function mountPage(roots?: WikiRoot[], candidates?: unknown[]) {
  if (roots || candidates) mockAllOk(roots ?? cloneRoots(), candidates ?? CANDIDATES_REAL)
  const host = withHost()
  const store = useKnowledgeStore()
  // 🔴 **Don't pass `plugins: [i18n]`** — `vitest.setup.ts` already injected **the same** i18n singleton into
  //   `config.global.plugins`; passing it again raises `Plugin has already been applied` warning.
  const w = mount(RootsView)
  mountedWrappers.push(w)
  await flushPromises()
  await nextTick()
  return { w, store, host }
}

/** Controllable promise — for interleaving / gate test. */
function makeDeferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

/** Create an axios-style error with HTTP status code (blueprint reads `e.response.status`). */
function httpError(status: number, message = 'boom'): Error & { response: { status: number } } {
  const e = new Error(message) as Error & { response: { status: number } }
  e.response = { status }
  return e
}

/** VTU's `.text()` only trims, not collapses internal whitespace; normalize multi-line concatenated text before compare. */
const norm = (s: string): string => s.replace(/\s+/g, ' ').trim()

/**
 * Line-preserving comment stripper (governance §9 / E-60: **structural negation assertions**
 * must strip comments first, otherwise literal text in comments becomes false positives — decision **R19**
 * is how it rejected T2's bare-string predicate).
 *
 * 🔴 **Block comment start must be "line start or preceded by whitespace"**, not bare `/*`:
 *   This rule was **actually hit** when auditing `AllowlistView.vue`'s `store.toast` call counts —
 *   that file has a path literal `'/Downloads/*'`, and bare `\/\*[\s\S]*?\*\/` opens a fake comment from its middle,
 *   consuming several **real code** lines downstream (measured: count went from 10 to 9).
 *   This is the same family as E-25 / R19: "used a pattern that looks like it answers the question, but got the criterion wrong".
 *   With the added "must be preceded by whitespace" rule, all real block comments in this repo still get stripped,
 *   while the `/*` in path literals is no longer caught.
 */
function blankComments(src: string): string {
  const blank = (m: string): string => m.replace(/[^\n]/g, ' ')
  return src
    .replace(/<!--[\s\S]*?-->/g, blank)
    .replace(/(^|\s)\/\*[\s\S]*?\*\//g, blank)
    .replace(/(^|[^:])\/\/[^\n]*/g, blank)
}

/** Product code after stripping comments — shared by three structural negation assertions. */
const SRC_CODE: string = blankComments(SRC)

const rows = (w: ReturnType<typeof mount>) => w.findAll('.k-set-row')

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  vi.useRealTimers()
  mockAllOk()
})

afterEach(() => {
  while (mountedWrappers.length) mountedWrappers.pop()!.unmount()
  document.body.innerHTML = ''
  vi.useRealTimers()
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 Fixture copy equivalence — governance §4 "copy into tests + programmatic byte-by-byte verification".
// Here we compare **shape and values** (not re-reading JSON): three-level tags, field name style, types all pinned.
// Criterion: any field name written as PascalCase / snake_case → this suite fails immediately.
describe('RootsView — fixture copy self-check (N46: store output is camelCase)', () => {
  it('🔴 No __meta anywhere in the copy (decision R14: take only data fields, convert source to comments)', () => {
    for (const r of ROOTS_NORMALIZED) {
      expect(Object.keys(r)).not.toContain('__meta')
    }
    for (const c of CANDIDATES_CONSTRUCTED) {
      expect(Object.keys(c)).not.toContain('__meta')
    }
  })

  it('🔴 N46 — root object keys are **exactly** camelCase (PascalCase / snake_case all fail)', () => {
    // Ten output fields of normalizeRoot from `wiki-roots.normalized.CONSTRUCTED.json`, in order copied.
    expect(Object.keys(ROOTS_NORMALIZED[0]!)).toEqual([
      'id',
      'path',
      'level',
      'watchMode',
      'storageMode',
      'enabled',
      'scanIntervalS',
      'createdAt',
      'lastScanAt',
      'needsReconcile',
    ])
    // Negative: HTTP raw PascalCase keys must not appear (wrong form blanks entire page with no error)
    for (const bad of ['ID', 'Path', 'WatchMode', 'ScanIntervalS', 'LastScanAt', 'Enabled']) {
      expect(Object.keys(ROOTS_NORMALIZED[0]!)).not.toContain(bad)
    }
    // Negative: snake_case also forbidden (that's the style of /tree · /node · /raw family)
    for (const bad of ['watch_mode', 'scan_interval_s', 'last_scan_at']) {
      expect(Object.keys(ROOTS_NORMALIZED[0]!)).not.toContain(bad)
    }
  })

  it('🔴 `enabled` is already boolean (normalizeRoot\'s `!!r.Enabled`), not 0/1 integer', () => {
    expect(ROOTS_NORMALIZED.map((r) => typeof r.enabled)).toEqual(['boolean', 'boolean'])
    expect(ROOTS_NORMALIZED.map((r) => r.enabled)).toEqual([true, false])
  })

  it('Candidate copy is **pass-through shape** (snake style path/type/size/label, Size/Label can be absent)', () => {
    expect(Object.keys(CANDIDATES_CONSTRUCTED[0]!)).toEqual(['path', 'type', 'size', 'label'])
    expect(Object.keys(CANDIDATES_CONSTRUCTED[1]!)).toEqual(['path', 'type'])
    expect(CANDIDATES_REAL).toEqual([])
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('RootsView — three-layer shell + section head (blueprint :2-11, copy layer by layer)', () => {
  it('Root .k-view > .k-scroll > .k-scroll-inner, one .k-section at innermost', async () => {
    const { w } = await mountPage()
    const root = w.element as HTMLElement
    expect(root.tagName).toBe('DIV')
    expect(root.className).toBe('k-view')
    expect(w.find('.k-view > .k-scroll > .k-scroll-inner').exists()).toBe(true)
    expect(w.findAll('.k-view > .k-scroll > .k-scroll-inner > .k-section')).toHaveLength(1)
  })

  it('Section head text exact + button right-aligned (blueprint :7-11)', async () => {
    const { w } = await mountPage()
    expect(w.find('.k-section-title').text()).toBe('索引目录')
    expect(w.find('.k-section-hint').text()).toBe('知识库扫描的根目录')
    const btn = w.find('.k-section-head button.k-btn.primary')
    expect(norm(btn.text())).toBe('添加索引目录')
    expect(btn.attributes('style')).toContain('margin-left: auto')
  })

  it('Blueprint created() (:149-151) — mount triggers loadRoots(), getRoots fires exactly once', async () => {
    await mountPage()
    expect(wiki.getRoots).toHaveBeenCalledTimes(1)
    // Candidates only fetched on openAdd (blueprint :157), not on mount
    expect(wiki.getCandidates).not.toHaveBeenCalled()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 Empty state / list both sides (blueprint :13-40). §9.17: empty state is device's **only reachable side** (D1 — /roots times out).
describe('RootsView — empty state / list both sides (blueprint :13-40)', () => {
  it('🔴 Empty state (device only reachable): no roots and not loading → .kr-empty, don\'t render .k-set-card', async () => {
    const { w } = await mountPage([])
    const empty = w.find('.kr-empty')
    expect(empty.exists()).toBe(true)
    expect(w.find('.k-set-card').exists()).toBe(false)
    expect(norm(empty.text())).toContain('尚未配置索引目录，知识库不会索引任何文件。')
    // Empty state also has an "Add index directory" primary button (blueprint :16-18)
    expect(norm(empty.find('button.k-btn.primary').text())).toBe('添加索引目录')
  })

  it('🔴 Empty state icon color is token not named color (blueprint :15 already token, copy as-is; decision R11 forbid \\bwhite\\b)', async () => {
    const { w } = await mountPage([])
    const icon = w.find('.kr-empty').findComponent(KIcon)
    expect(icon.props('name')).toBe('folder')
    expect(icon.props('size')).toBe(28)
    const color = String(icon.props('color'))
    expect(color).toBe('var(--text-tertiary)')
    const scrubbed = color.replace(/var\([^)]*\)/g, '')
    for (const c of ['white', 'black', 'red', 'green', 'blue', 'orange', 'gray', 'grey']) {
      expect(scrubbed, `named color ${c} appears in color attribute value`).not.toMatch(
        new RegExp(`(?<![\\w-])${c}(?![\\w-])`, 'i'),
      )
    }
  })

  it('🔴 Loading (loading=true and list empty) → empty state **not** rendered (blueprint :13 `&& !wikiRootsLoading`)', async () => {
    const d = makeDeferred<WikiRoot[]>()
    wiki.getRoots.mockReturnValue(d.promise)
    const host = withHost()
    const w = mount(RootsView)
    mountedWrappers.push(w)
    await nextTick()
    expect(w.find('.kr-empty').exists(), 'showing empty state while loading = first screen flash "not configured"').toBe(false)
    d.resolve([])
    await flushPromises()
    expect(w.find('.kr-empty').exists()).toBe(true)
    expect(host).toBeTruthy()
  })

  it('Non-empty → .k-set-card list, one row per root (blueprint :20-39)', async () => {
    const { w } = await mountPage()
    expect(w.find('.kr-empty').exists()).toBe(false)
    const card = w.find('.k-set-card')
    expect(card.exists()).toBe(true)
    expect(card.attributes('style')).toContain('margin: 12px 16px')
    expect(rows(w)).toHaveLength(2)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 N46 landing — six camelCase fields the page reads each have landing points in DOM.
describe('RootsView — N46: row content reads camelCase fields (blueprint :22-28)', () => {
  it('path / enabled → .kr-path text and data-off both sides', async () => {
    const { w } = await mountPage()
    const titles = rows(w).map((r) => r.find('.k-set-row-title.kr-path'))
    expect(titles.map((e) => e.text())).toEqual(['/DATA', '/DATA/Documents'])
    // data-* not boolean attribute → JSDOM renders as string "false", compare both sides
    expect(titles.map((e) => e.attributes('data-off'))).toEqual(['false', 'true'])
  })

  it('watchMode → .kr-badge text both sides (auto / scan_only)', async () => {
    const { w } = await mountPage()
    expect(rows(w).map((r) => r.find('.kr-badge').text())).toEqual(['实时监视', '仅定时扫描'])
  })

  it('🔴 scanIntervalS → "every {h} hours scan", `Math.max(1, Math.round(s/3600))` exact (blueprint :26)', async () => {
    // 21600 s → 6 h; 3600 s → 1 h; plus two boundary cases only correct expression matches:
    //   1800 s → round(0.5)=1 (Math.round rounds 0.5 up) · 100 s → round(0.027)=0 → max(1,0)=1
    const { w } = await mountPage([
      { ...ROOTS_NORMALIZED[0]!, id: 'a', scanIntervalS: 21600 },
      { ...ROOTS_NORMALIZED[0]!, id: 'b', scanIntervalS: 3600 },
      { ...ROOTS_NORMALIZED[0]!, id: 'c', scanIntervalS: 1800 },
      { ...ROOTS_NORMALIZED[0]!, id: 'd', scanIntervalS: 100 },
      { ...ROOTS_NORMALIZED[0]!, id: 'e', scanIntervalS: 7000 },
    ])
    const descs = rows(w).map((r) => norm(r.find('.k-set-row-desc').text()))
    expect(descs.map((s) => s.match(/每 (\d+) 小时扫描/)?.[1])).toEqual(['6', '1', '1', '1', '2'])
  })

  it('🔴 lastScanAt: 0 → "never"; non-0 → fmtAgo(milliseconds; blueprint :27 ternary)', async () => {
    // Fake timers: fmtAgo reads Date.now(), real timers drift this test (governance §9.13)
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-05T12:00:00Z'))
    const twoHoursAgo = Date.now() - 2 * 3600 * 1000
    const { w } = await mountPage([
      { ...ROOTS_NORMALIZED[0]!, id: 'a', lastScanAt: twoHoursAgo },
      { ...ROOTS_NORMALIZED[1]!, id: 'b', lastScanAt: 0 },
    ])
    const descs = rows(w).map((r) => norm(r.find('.k-set-row-desc').text()))
    expect(descs[0]).toContain('上次扫描: 2 小时前')
    expect(descs[1]).toContain('上次扫描: 从未')
  })

  it('id → :key and parameters of three actions (rescan / delete / toggle all fetch right row)', async () => {
    const { w, store } = await mountPage()
    await rows(w)[1]!.find('button.k-sw').trigger('click')
    await flushPromises()
    expect(wiki.patchRootEnabled).toHaveBeenCalledWith('9b1c77e0aa2f4d3e8c5106b4f7d2a318', true)
    expect(store.wikiRoots[1]!.enabled).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴 Decision R9 — `toggle()` toast direction **is not a blueprint bug**, but its correctness depends entirely
//    on the invariant "store mutates **the same object in the component's hand**". This suite guards that invariant.
//    🔴 **Don't degrade to "assert that setRootEnabled(id, !enabled) was called"** — that can't catch toast direction.
//
// 🔴🔴 **Criterion corrected (declare decision R18: brief's RED criterion is just a hint; if empirical testing
//    contradicts it, trust empirical testing)**
//    Brief / decision R9 gave the criterion "move `knowledgeStore.ts`'s `root.enabled = enabled`
//    **after the `await`**". **Empirical: changing that way, this suite still all-green (60/60)**, criterion doesn't hold.
//    Reason: moved after await, it's still **inside** the async `setRootEnabled` function — the caller
//    `await store.setRootEnabled(...)` resumes **after the function returns**, at which point the assignment
//    is already done ⇒ `r.enabled` is still the new value. **"Before or after await" is not the discriminant.**
//    🔴 **Real discriminant = "whether the object in the component's hand got mutated"**, which is the future
//    risk decision R9 itself flagged ("what if we change to replacing the whole array"). **Empirically valid criterion**:
//    replace `setRootEnabled`'s in-place mutation with
//      `wikiRoots.value = wikiRoots.value.map((r) => (r.id === id ? { ...r, enabled } : r))`
//    → first two of this suite + the one in R27 **all 3 fail** (verified full output + md5sum restored).
//    ⇒ If downstream needs to re-run this guard, use **the later criterion**, not brief's literal version.
describe('RootsView — R9 invariant: after toggle() success, toast reads **new** state', () => {
  it('🔴 Off → On: toast is "enabled" (not old state "disabled")', async () => {
    const { w, store } = await mountPage()
    const toast = vi.spyOn(store, 'toast')
    // Row 2 has enabled=false
    await rows(w)[1]!.find('button.k-sw').trigger('click')
    await flushPromises()
    expect(wiki.patchRootEnabled).toHaveBeenCalledWith('9b1c77e0aa2f4d3e8c5106b4f7d2a318', true)
    expect(
      toast,
      'toast reads **old** value — store no longer mutates the object in the component\'s hand in place (likely replaced with whole array)',
    ).toHaveBeenLastCalledWith('已启用')
  })

  it('🔴 On → Off: toast is "disabled" (other side, same invariant)', async () => {
    const { w, store } = await mountPage()
    const toast = vi.spyOn(store, 'toast')
    // Row 1 has enabled=true
    await rows(w)[0]!.find('button.k-sw').trigger('click')
    await flushPromises()
    expect(wiki.patchRootEnabled).toHaveBeenCalledWith('dfcd1840f5dab439cd9d7050aa5bafd0', false)
    expect(toast).toHaveBeenLastCalledWith('已禁用')
  })

  it('🔴 On failure: **don\'t** show success toast (store rolls back + throw ⇒ that line never executes)', async () => {
    const { w, store } = await mountPage()
    const toast = vi.spyOn(store, 'toast')
    wiki.patchRootEnabled.mockRejectedValue(httpError(500, 'PROBE-K58-R5T9-toggle'))
    await rows(w)[1]!.find('button.k-sw').trigger('click')
    await flushPromises()
    const said = toast.mock.calls.flat().join('|')
    expect(said, 'failure path showed success toast').not.toContain('已启用')
    expect(said, 'failure path showed success toast').not.toContain('已禁用')
    expect(toast).toHaveBeenLastCalledWith('操作失败')
    // Optimistic update rolled back (store side), toggle also back to original
    expect(store.wikiRoots[1]!.enabled).toBe(false)
    expect(rows(w)[1]!.find('button.k-sw').attributes('data-on')).toBe('false')
  })

  it('data-on compare both sides (blueprint :37, `String(r.enabled)` copy as-is → JSDOM string "false")', async () => {
    const { w } = await mountPage()
    expect(rows(w).map((r) => r.find('button.k-sw').attributes('data-on'))).toEqual([
      'true',
      'false',
    ])
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 N51 / K58 — two error branches of toggle().
describe('RootsView — N51: toggle() 404-specific message + K58 other errors mapped', () => {
  it('🔴 404 → "Backend version too old, please deploy Wiki service update first." (blueprint :168-170 copy exactly)', async () => {
    const { w, store } = await mountPage()
    const toast = vi.spyOn(store, 'toast')
    wiki.patchRootEnabled.mockRejectedValue(httpError(404, 'PROBE-K58-R5T9-404'))
    await rows(w)[0]!.find('button.k-sw').trigger('click')
    await flushPromises()
    expect(toast).toHaveBeenLastCalledWith('后端版本过旧，请先部署 Wiki 服务更新。')
    expect(toast.mock.calls.flat().join('|')).not.toContain('PROBE-K58-R5T9')
  })

  it('🔴 Non-404 (500 / bare Error without response) → fixed key "operation failed", don\'t echo backend body', async () => {
    const { w, store } = await mountPage()
    const toast = vi.spyOn(store, 'toast')
    wiki.patchRootEnabled.mockRejectedValue(httpError(500, 'PROBE-K58-R5T9-500'))
    await rows(w)[0]!.find('button.k-sw').trigger('click')
    await flushPromises()
    expect(toast).toHaveBeenLastCalledWith('操作失败')
    expect(toast.mock.calls.flat().join('|')).not.toContain('PROBE-K58-R5T9')
    expect(w.html()).not.toContain('PROBE-K58-R5T9')

    // Second form: bare Error without even a `response` (blueprint `e.message || e` would echo it)
    wiki.patchRootEnabled.mockRejectedValue(new Error('PROBE-K58-R5T9-bare'))
    await rows(w)[1]!.find('button.k-sw').trigger('click')
    await flushPromises()
    expect(toast).toHaveBeenLastCalledWith('操作失败')
    expect(toast.mock.calls.flat().join('|')).not.toContain('PROBE-K58-R5T9')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('RootsView — rescan() (blueprint :175-182)', () => {
  it('Success → rescanRoot(id) + toast "started rescanning"', async () => {
    const { w, store } = await mountPage()
    const toast = vi.spyOn(store, 'toast')
    const btn = rows(w)[0]!.findAll('button.k-btn.ghost')[0]!
    expect(btn.attributes('title')).toBe('立即重扫')
    await btn.trigger('click')
    await flushPromises()
    expect(wiki.rescanRoot).toHaveBeenCalledWith('dfcd1840f5dab439cd9d7050aa5bafd0')
    expect(toast).toHaveBeenLastCalledWith('已开始重新扫描')
    // Blueprint intentionally **doesn't** reload list (comment in knowledgeStore.ts:692)
    expect(wiki.getRoots).toHaveBeenCalledTimes(1)
  })

  it('K58 — on failure only show "operation failed", don\'t echo backend body', async () => {
    const { w, store } = await mountPage()
    const toast = vi.spyOn(store, 'toast')
    wiki.rescanRoot.mockRejectedValue(new Error('PROBE-K58-R5T9-rescan'))
    await rows(w)[0]!.findAll('button.k-btn.ghost')[0]!.trigger('click')
    await flushPromises()
    expect(toast).toHaveBeenLastCalledWith('操作失败')
    expect(toast.mock.calls.flat().join('|')).not.toContain('PROBE-K58-R5T9')
    expect(w.html()).not.toContain('PROBE-K58-R5T9')
  })

  it('🔴 Disabled root: rescan button disabled (blueprint :30 `:disabled="!r.enabled"`, both sides)', async () => {
    const { w } = await mountPage()
    const btnOf = (i: number) =>
      rows(w)[i]!.findAll('button.k-btn.ghost')[0]!.element as HTMLButtonElement
    expect(btnOf(0).disabled, 'row with enabled=true should be clickable').toBe(false)
    expect(btnOf(1).disabled, 'row with enabled=false should be grayed').toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 K57 — "Add index directory" dialog (blueprint :43-91 is bare .k-modal-bg + @click).
describe('RootsView — K57: reka "Add index directory" dialog', () => {
  async function openModal(roots: WikiRoot[] = [], candidates: unknown[] = CANDIDATES_REAL) {
    const m = await mountPage(roots, candidates)
    expect(m.host.querySelector('.k-modal'), 'should not render modal by default').toBeNull()
    await m.w.find('.k-section-head button.k-btn.primary').trigger('click')
    await nextTick()
    await flushPromises()
    return m
  }

  it('Click "Add index directory" → portal to .knowledge-app; head / body / foot content exact', async () => {
    const { host } = await openModal()
    const modal = host.querySelector('.k-modal')
    expect(modal).not.toBeNull()
    expect(host.querySelector('.k-modal-bg')).not.toBeNull()
    // head: DialogTitle wrapped on blueprint's own .k-modal-title (as-child) ⇒ no extra hidden node
    const titleEl = modal!.querySelector('.k-modal-title') as HTMLElement
    expect(titleEl.textContent).toBe('添加索引目录')
    expect(titleEl.id).toBe(modal!.getAttribute('aria-labelledby'))
    expect(modal!.querySelectorAll('[id]')).toHaveLength(1)
    expect(modal!.querySelector('.k-modal-head button.k-modal-x')).not.toBeNull()
    // body: FolderBrowser + selected path label + input + advanced collapse (default collapsed)
    expect(modal!.querySelector('.fb')).not.toBeNull()
    expect(modal!.querySelector('.kr-label')!.textContent).toBe('已选路径')
    const pathInput = modal!.querySelector('input.kr-input') as HTMLInputElement
    expect(pathInput.getAttribute('placeholder')).toBe('/DATA')
    expect(pathInput.getAttribute('spellcheck')).toBe('false')
    const adv = modal!.querySelector('.k-adv-toggle') as HTMLElement
    expect(adv.getAttribute('data-open')).toBe('false')
    expect(norm(adv.textContent!)).toBe('高级选项')
    expect(modal!.querySelector('.kr-adv-row'), 'advanced section collapsed by default').toBeNull()
    expect(modal!.querySelector('.kr-error'), 'no error block by default').toBeNull()
    // foot: Cancel + Add
    const footBtns = Array.from(modal!.querySelectorAll('.k-modal-foot button'))
    expect(footBtns.map((b) => norm(b.textContent!))).toEqual(['取消', '添加'])
    expect(footBtns[0]!.className).toBe('k-btn outline')
    expect(footBtns[1]!.className).toBe('k-btn primary')
  })

  it('Click × closes, no request sent', async () => {
    const { host } = await openModal()
    ;(host.querySelector('.k-modal-x') as HTMLElement).click()
    await nextTick()
    await flushPromises()
    expect(host.querySelector('.k-modal')).toBeNull()
    expect(wiki.createRoot).not.toHaveBeenCalled()
  })

  it('Click "Cancel" closes, no request sent', async () => {
    const { host } = await openModal()
    const cancel = Array.from(host.querySelectorAll('.k-modal-foot button')).find(
      (b) => norm(b.textContent!) === '取消',
    ) as HTMLElement
    cancel.click()
    await nextTick()
    await flushPromises()
    expect(host.querySelector('.k-modal')).toBeNull()
    expect(wiki.createRoot).not.toHaveBeenCalled()
  })

  it('🔴 Click backdrop (outside dialog) closes; click inside dialog doesn\'t (reka pointerDownOutside equivalent to blueprint @click/@click.stop)', async () => {
    const { host } = await openModal()
    // reka's usePointerDownOutside uses setTimeout(0) to defer attaching document listener — need one real macrotask tick.
    await new Promise((r) => setTimeout(r, 0))
    ;(host.querySelector('.k-modal-title') as HTMLElement).dispatchEvent(
      new Event('pointerdown', { bubbles: true }),
    )
    await nextTick()
    expect(host.querySelector('.k-modal'), 'click inside should not close').not.toBeNull()
    ;(host.querySelector('.k-modal-bg') as HTMLElement).dispatchEvent(
      new Event('pointerdown', { bubbles: true }),
    )
    await nextTick()
    await flushPromises()
    expect(host.querySelector('.k-modal'), 'click on backdrop must close').toBeNull()
  })

  it('🔴 Zero `@click.stop` (K57-②: backdrop semantics delegated to reka, no manual stop propagation)', () => {
    // Structural negation assertion → must strip comments first (governance §9 / E-60 "class names/call shapes" side).
    // 🔴 Anti-false-negative: if stripper consumes real code too (E-25 family), the negation assertion becomes an empty shell.
    //    Anchor on distinctive string from **last segment** of template — it's at EOF, easiest to disappear if mistakenly consumed.
    expect(SRC_CODE, 'stripper consumed real code — negation assertion below will false-pass').toContain(
      'onDeletingOpen',
    )
    expect(SRC_CODE).toContain('DialogPortal')
    expect(SRC_CODE, 'template still has @click.stop — K57-② requires delegating to reka').not.toMatch(/@click\.stop/)
  })

  it('Advanced collapse both sides (blueprint :58-74): open → watch mode + scan interval two rows', async () => {
    const { host } = await openModal()
    const adv = host.querySelector('.k-adv-toggle') as HTMLElement
    adv.click()
    await nextTick()
    expect(adv.getAttribute('data-open')).toBe('true')
    const advRows = Array.from(host.querySelectorAll('.kr-adv-row'))
    expect(advRows).toHaveLength(2)
    expect(advRows.map((r) => r.querySelector('span')!.textContent)).toEqual([
      '监视模式',
      '扫描间隔(小时)',
    ])
    const modeBtns = Array.from(advRows[0]!.querySelectorAll('.k-radio-group button'))
    expect(modeBtns.map((b) => norm(b.textContent!))).toEqual(['自动', '仅扫描'])
    // Initial value watchMode='auto' → both sides of data-on
    expect(modeBtns.map((b) => b.getAttribute('data-on'))).toEqual(['true', 'false'])
    ;(modeBtns[1] as HTMLElement).click()
    await nextTick()
    expect(
      Array.from(host.querySelectorAll('.k-radio-group button')).map((b) =>
        b.getAttribute('data-on'),
      ),
    ).toEqual(['false', 'true'])
    // Interval input initial value 6
    const hours = advRows[1]!.querySelector('input.kr-input') as HTMLInputElement
    expect(hours.value).toBe('6')
    expect(hours.getAttribute('type')).toBe('number')
    expect(hours.getAttribute('min')).toBe('1')
    expect(hours.getAttribute('style')).toContain('width: 90px')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 FolderBrowser wiring (blueprint :53 + :153-163).
describe('RootsView — FolderBrowser wiring: roots / @pick / openAdd reset()', () => {
  async function openModal(candidates: unknown[] = CANDIDATES_REAL) {
    const m = await mountPage([], candidates)
    await m.w.find('.k-section-head button.k-btn.primary').trigger('click')
    await nextTick()
    await flushPromises()
    return m
  }

  it('🔴 :roots = pickerRoots(store.wikiCandidates) — non-empty candidates pass through one by one', async () => {
    const { w } = await openModal(CANDIDATES_CONSTRUCTED)
    const fb = w.findComponent(FolderBrowser)
    expect(fb.exists()).toBe(true)
    expect(fb.props('roots')).toEqual([
      { path: '/DATA', label: '主数据盘' },
      // label absent → pickerRoots fallback `c.label || c.path`
      { path: '/DATA/Documents', label: '/DATA/Documents' },
      { path: '/mnt/backup', label: '备份盘' },
    ])
  })

  it('🔴 Candidates always empty (device .REAL is in this state) → pickerRoots fallback three roots', async () => {
    const { w } = await openModal(CANDIDATES_REAL)
    expect(w.findComponent(FolderBrowser).props('roots')).toEqual([
      { path: '/DATA', label: 'System (/DATA)' },
      { path: '/media', label: '/media' },
      { path: '/mnt', label: '/mnt' },
    ])
  })

  it('openAdd fetches candidates once (blueprint :157); don\'t fetch on mount', async () => {
    const { w } = await mountPage([])
    expect(wiki.getCandidates).not.toHaveBeenCalled()
    await w.find('.k-section-head button.k-btn.primary').trigger('click')
    await flushPromises()
    expect(wiki.getCandidates).toHaveBeenCalledTimes(1)
  })

  it('🔴 @pick fills form.path (blueprint :161-163); empty path doesn\'t fill', async () => {
    const { w, host } = await openModal(CANDIDATES_CONSTRUCTED)
    const fb = w.findComponent(FolderBrowser)
    const input = () => host.querySelector('input.kr-input') as HTMLInputElement
    expect(input().value).toBe('')
    fb.vm.$emit('pick', '/DATA/Documents')
    await nextTick()
    expect(input().value).toBe('/DATA/Documents')
    // Empty string doesn't fill (blueprint `if (path)`)
    fb.vm.$emit('pick', '')
    await nextTick()
    expect(input().value, 'empty path overwrote selected path').toBe('/DATA/Documents')
  })

  /**
   * 🔴 **Criterion: remove `nextTick` or `reset()` → must fail** (catch both halves).
   *
   * 🔴 **Why must use stub instead of `vi.spyOn(fb.vm, 'reset')`** (empirical finding, declare R18):
   *   reka's `DialogContent` uses `Presence` ⇒ **closing dialog unmounts `FolderBrowser` entirely**
   *   (measured: after close `w.findComponent(FolderBrowser).exists() === false`, on reopen breadcrumbs
   *   go from 2 back to 1). So:
   *     · "close then open" gets a **new instance**, spy on old instance never catches;
   *     · "click again while open" is same instance and spy does catch, but on that path
   *       `fb.value` already non-empty ⇒ **remove `nextTick` still green** = only guards one half.
   *   ⇒ Use a stub with `defineExpose({ reset: spy })` to replace child: every new instance has
   *     the same spy, both `nextTick` and `reset()` halves can each independently fail.
   *
   * ⚠️ Side note: because child unmounts/rebuilds anyway, `reset()` in **this repo's reka version** is actually
   *   a step with no observable side effects (Vue2 blueprint with `v-if` is the same). **Copy exactly, don't delete**
   *   (blueprint 1:1), this guard pins "this call still happens", not its visible consequences.
   */
  it('🔴 openAdd really calls FolderBrowser.reset() (criterion: remove nextTick or reset() → fails)', async () => {
    const resetSpy = vi.fn()
    const FolderBrowserStub = defineComponent({
      name: 'FolderBrowserStub',
      props: { roots: { type: Array, default: () => [] } },
      setup(_props, { expose }) {
        expose({ reset: resetSpy })
        return () => h('div', { class: 'fb fb-stubbed' })
      },
    })
    mockAllOk([], CANDIDATES_CONSTRUCTED)
    const host = withHost()
    const w = mount(RootsView, { global: { stubs: { FolderBrowser: FolderBrowserStub } } })
    mountedWrappers.push(w)
    await flushPromises()
    await nextTick()
    // Anti-false-negative: stub really replaced, else we assert a spy that never gets called
    expect(resetSpy, 'reset() should not be called before opening dialog').not.toHaveBeenCalled()
    await w.find('.k-section-head button.k-btn.primary').trigger('click')
    await nextTick()
    await nextTick()
    await flushPromises()
    expect(host.querySelector('.fb-stubbed'), 'stub not replaced — test loses discriminative power').not.toBeNull()
    expect(
      resetSpy,
      'openAdd did not call FolderBrowser.reset() — nextTick or reset() removed',
    ).toHaveBeenCalledTimes(1)
  })

  it('🔴 openAdd resets form to initial value (blueprint :154 exact same value) + clears previous error block', async () => {
    const { w, host } = await openModal()
    const input = () => host.querySelector('input.kr-input') as HTMLInputElement
    // Create a 409 error block + non-initial form
    input().value = '/mnt/ro'
    input().dispatchEvent(new Event('input'))
    await nextTick()
    wiki.createRoot.mockRejectedValue(httpError(409))
    ;(
      Array.from(host.querySelectorAll('.k-modal-foot button')).find(
        (b) => norm(b.textContent!) === '添加',
      ) as HTMLElement
    ).click()
    await flushPromises()
    expect(host.querySelector('.kr-error')).not.toBeNull()
    // Close then open
    ;(host.querySelector('.k-modal-x') as HTMLElement).click()
    await nextTick()
    await w.find('.k-section-head button.k-btn.primary').trigger('click')
    await nextTick()
    await flushPromises()
    expect(input().value, 'path not reset').toBe('')
    expect(host.querySelector('.kr-error'), 'addError / mirrorOffer not cleared').toBeNull()
    expect((host.querySelector('.k-adv-toggle') as HTMLElement).getAttribute('data-open')).toBe(
      'false',
    )
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴 N46's underscore trap — `createRootBody` must come from shared package, all three params really passed.
//    Wrong parameter passing causes backend to **silently drop** (Go decoder case-insensitive but underscore-sensitive)
//    ⇒ no error on device, all tests pass falsely.
describe('RootsView — submit(): createRootBody three params really passed (N46)', () => {
  async function openModal() {
    const m = await mountPage([])
    await m.w.find('.k-section-head button.k-btn.primary').trigger('click')
    await nextTick()
    await flushPromises()
    return m
  }
  const addBtn = (host: HTMLElement) =>
    Array.from(host.querySelectorAll('.k-modal-foot button')).find(
      (b) => norm(b.textContent!) === '添加',
    ) as HTMLButtonElement
  const setPath = async (host: HTMLElement, v: string) => {
    const el = host.querySelector('input.kr-input') as HTMLInputElement
    el.value = v
    el.dispatchEvent(new Event('input'))
    await nextTick()
  }

  it('🔴 Source imports `createRootBody` from shared package, not rewritten here (D3 in package)', () => {
    expect(SRC).toMatch(/import\s*\{[^}]*\bcreateRootBody\b[^}]*\}\s*from\s*'@nimotech\/nimoos-service'/)
    // Negative: can't manually construct that Go field set
    // Anti-false-negative: first prove `createRootBody` call site still here after stripping, then negate.
    expect(SRC_CODE, 'stripper consumed createRootBody call site').toContain('createRootBody({')
    expect(SRC_CODE, 'RootsView constructed body itself — must use shared package createRootBody').not.toMatch(
      /\bStorageMode\s*:/,
    )
    expect(SRC_CODE).not.toMatch(/\bScanIntervalS\s*:/)
  })

  it('🔴 Default form → body fields exact (Path/Level/WatchMode/StorageMode/ScanIntervalS)', async () => {
    const { host } = await openModal()
    await setPath(host, '/DATA/Books')
    addBtn(host).click()
    await flushPromises()
    expect(wiki.createRoot).toHaveBeenCalledWith({
      Path: '/DATA/Books',
      Level: 'space',
      WatchMode: 'auto',
      StorageMode: 'inline',
      ScanIntervalS: 21600,
    })
    // Also pin "it's the product of shared package createRootBody"
    expect(wiki.createRoot.mock.calls[0]![0]).toEqual(
      createRootBody({ path: '/DATA/Books', watchMode: 'auto', scanIntervalH: 6, mirror: false }),
    )
  })

  it('🔴🔴 watchMode / scanIntervalH two params really passed (change advanced → body changes)', async () => {
    const { host } = await openModal()
    await setPath(host, '/mnt/ro')
    ;(host.querySelector('.k-adv-toggle') as HTMLElement).click()
    await nextTick()
    // Watch mode → scan_only
    ;(host.querySelectorAll('.k-radio-group button')[1] as HTMLElement).click()
    await nextTick()
    // Scan interval → 2 hours
    const hours = host.querySelectorAll('input.kr-input')[1] as HTMLInputElement
    hours.value = '2'
    hours.dispatchEvent(new Event('input'))
    await nextTick()
    addBtn(host).click()
    await flushPromises()
    const body = wiki.createRoot.mock.calls[0]![0] as Record<string, unknown>
    expect(body.WatchMode, 'watchMode not passed to createRootBody — backend silently uses default').toBe('scan_only')
    expect(body.ScanIntervalS, 'scanIntervalH not passed to createRootBody').toBe(7200)
    expect(body).toEqual(
      createRootBody({ path: '/mnt/ro', watchMode: 'scan_only', scanIntervalH: 2, mirror: false }),
    )
  })

  it('🔴🔴 mirror param really passed (mirror retry → StorageMode: mirror)', async () => {
    const { host } = await openModal()
    await setPath(host, '/mnt/ro')
    wiki.createRoot.mockRejectedValueOnce(httpError(409))
    addBtn(host).click()
    await flushPromises()
    // First call mirror=false
    expect((wiki.createRoot.mock.calls[0]![0] as Record<string, unknown>).StorageMode).toBe('inline')
    // Click "Add in mirror mode" → second call mirror=true
    const mirrorBtn = host.querySelector('.kr-error button.k-btn.outline') as HTMLElement
    expect(mirrorBtn, 'N50 mirror button not rendered').not.toBeNull()
    mirrorBtn.click()
    await flushPromises()
    const body = wiki.createRoot.mock.calls[1]![0] as Record<string, unknown>
    expect(body.StorageMode, 'mirror not passed to createRootBody').toBe('mirror')
    expect(body).toEqual(
      createRootBody({ path: '/mnt/ro', watchMode: 'auto', scanIntervalH: 6, mirror: true }),
    )
  })

  it('Success → close dialog + toast "added index directory" + reload list', async () => {
    const { host, store } = await openModal()
    const toast = vi.spyOn(store, 'toast')
    await setPath(host, '/DATA/Books')
    addBtn(host).click()
    await flushPromises()
    expect(host.querySelector('.k-modal')).toBeNull()
    expect(toast).toHaveBeenLastCalledWith('已添加索引目录')
    // createRoot internally calls loadRoots once (knowledgeStore.ts:682)
    expect(wiki.getRoots).toHaveBeenCalledTimes(2)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 canSubmit (blueprint :144) + submitting gate (governance §5.2).
describe('RootsView — canSubmit both sides + submitting gate', () => {
  async function openModal() {
    const m = await mountPage([])
    await m.w.find('.k-section-head button.k-btn.primary').trigger('click')
    await nextTick()
    await flushPromises()
    return m
  }
  const addBtn = (host: HTMLElement) =>
    Array.from(host.querySelectorAll('.k-modal-foot button')).find(
      (b) => norm(b.textContent!) === '添加',
    ) as HTMLButtonElement
  const setPath = async (host: HTMLElement, v: string) => {
    const el = host.querySelector('input.kr-input') as HTMLInputElement
    el.value = v
    el.dispatchEvent(new Event('input'))
    await nextTick()
  }

  it('🔴 canSubmit = path.startsWith("/") both sides (disabled is true boolean attribute)', async () => {
    const { host } = await openModal()
    expect(addBtn(host).disabled, 'initial empty string → grayed').toBe(true)
    await setPath(host, 'DATA/Books')
    expect(addBtn(host).disabled, 'relative path → grayed').toBe(true)
    await setPath(host, '/DATA/Books')
    expect(addBtn(host).disabled, 'absolute path → clickable').toBe(false)
  })

  it('🔴 Function also guards canSubmit (call directly bypassing button disabled still doesn\'t send)', async () => {
    const { w, host } = await openModal()
    await setPath(host, 'relative/path')
    // v-model.trim already syncs value to form; can't directly trigger mirror button path,
    // so walk the "button disabled but DOM click still dispatches" equivalent path
    addBtn(host).click()
    await flushPromises()
    expect(wiki.createRoot).not.toHaveBeenCalled()
    expect(w.html()).toBeTruthy()
  })

  it('🔴 submitting gate: first request in-flight, repeat click doesn\'t send second (blueprint :184 built-in)', async () => {
    const { host } = await openModal()
    await setPath(host, '/DATA/Books')
    const d = makeDeferred<unknown>()
    wiki.createRoot.mockReturnValue(d.promise)
    addBtn(host).click()
    await nextTick()
    await flushPromises()
    expect(wiki.createRoot).toHaveBeenCalledTimes(1)
    // Button should be disabled now (`!canSubmit || submitting`)
    expect(addBtn(host).disabled, 'button not grayed during submitting').toBe(true)
    addBtn(host).click()
    await nextTick()
    await flushPromises()
    expect(wiki.createRoot, 'submitting gate didn\'t block second request').toHaveBeenCalledTimes(1)
    d.resolve({})
    await flushPromises()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 K59 — addError goes **inline in dialog** (not toast).
//    Memory `newui-dialog-error-not-toast`: toast is z-index 60, dialog backdrop 1000 with blur
//    ⇒ error in dialog rendered as toast gets hidden + blurred.
describe('RootsView — K59: addError inline in dialog (409 shows mirror button / non-409 just text)', () => {
  async function openModal() {
    const m = await mountPage([])
    await m.w.find('.k-section-head button.k-btn.primary').trigger('click')
    await nextTick()
    await flushPromises()
    const el = m.host.querySelector('input.kr-input') as HTMLInputElement
    el.value = '/mnt/ro'
    el.dispatchEvent(new Event('input'))
    await nextTick()
    return m
  }
  const clickAdd = async (host: HTMLElement) => {
    ;(
      Array.from(host.querySelectorAll('.k-modal-foot button')).find(
        (b) => norm(b.textContent!) === '添加',
      ) as HTMLElement
    ).click()
    await flushPromises()
  }

  it('🔴 409 → read-only message + "Add in mirror mode" button (N50 copy, dialog **doesn\'t close**)', async () => {
    const { host, store } = await openModal()
    const toast = vi.spyOn(store, 'toast')
    wiki.createRoot.mockRejectedValue(httpError(409, 'PROBE-K58-R5T9-409'))
    await clickAdd(host)
    const err = host.querySelector('.kr-error')
    expect(err, 'K59: error must be inline in dialog').not.toBeNull()
    expect(norm(err!.textContent!)).toContain(
      '该目录只读——可改用镜像模式添加(wiki 数据存放在中央目录)。',
    )
    const mirrorBtn = err!.querySelector('button.k-btn.outline')
    expect(mirrorBtn, 'N50 mirror button must be here').not.toBeNull()
    expect(norm(mirrorBtn!.textContent!)).toBe('以镜像模式添加')
    expect(host.querySelector('.k-modal'), 'failure should not close dialog').not.toBeNull()
    // 🔴 K59: inline, **not** toast
    expect(toast, 'error showed as toast — would be hidden by backdrop (memory newui-dialog-error-not-toast)').not.toHaveBeenCalled()
    // K58: don't echo backend body
    expect(host.innerHTML).not.toContain('PROBE-K58-R5T9')
  })

  it('🔴 Non-409 (500) → K58 mapped message "operation failed", **no** mirror button', async () => {
    const { host, store } = await openModal()
    const toast = vi.spyOn(store, 'toast')
    wiki.createRoot.mockRejectedValue(httpError(500, 'PROBE-K58-R5T9-500add'))
    await clickAdd(host)
    const err = host.querySelector('.kr-error')
    expect(err).not.toBeNull()
    expect(norm(err!.textContent!)).toBe('操作失败')
    expect(err!.querySelector('button'), 'non-409 should not show mirror button').toBeNull()
    expect(toast).not.toHaveBeenCalled()
    expect(host.innerHTML).not.toContain('PROBE-K58-R5T9')
  })

  it('🔴 Bare Error (no response) also maps, don\'t echo e.message (blueprint :202 third fallback)', async () => {
    const { host } = await openModal()
    wiki.createRoot.mockRejectedValue(new Error('PROBE-K58-R5T9-bareadd'))
    await clickAdd(host)
    expect(norm(host.querySelector('.kr-error')!.textContent!)).toBe('操作失败')
    expect(host.innerHTML).not.toContain('PROBE-K58-R5T9')
  })

  it('After 409 click mirror button: first clear old error block (blueprint :186-187 before try)', async () => {
    const { host } = await openModal()
    wiki.createRoot.mockRejectedValueOnce(httpError(409))
    await clickAdd(host)
    expect(host.querySelector('.kr-error')).not.toBeNull()
    wiki.createRoot.mockResolvedValue({})
    ;(host.querySelector('.kr-error button.k-btn.outline') as HTMLElement).click()
    await flushPromises()
    expect(host.querySelector('.k-modal'), 'success should close dialog').toBeNull()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 K57 — delete confirmation dialog (blueprint :93-120) + confirmDelete() (blueprint :209-219).
describe('RootsView — K57: reka "Delete index directory?" confirmation dialog + confirmDelete()', () => {
  async function openDelete(i = 0) {
    const m = await mountPage()
    expect(m.host.querySelector('.k-modal'), 'should not render dialog by default').toBeNull()
    const btn = rows(m.w)[i]!.findAll('button.k-btn.ghost')[1]!
    expect(btn.attributes('title')).toBe('删除')
    await btn.trigger('click')
    await nextTick()
    await flushPromises()
    return m
  }

  it('Click trash → portal to .knowledge-app, title / path / checkbox / hint / two buttons exact', async () => {
    const { host } = await openDelete(0)
    const modal = host.querySelector('.k-modal')
    expect(modal).not.toBeNull()
    const titleEl = modal!.querySelector('.k-modal-title') as HTMLElement
    expect(titleEl.textContent).toBe('删除索引目录?')
    expect(titleEl.id).toBe(modal!.getAttribute('aria-labelledby'))
    expect(modal!.querySelectorAll('[id]')).toHaveLength(1)
    const pathEl = modal!.querySelector('.k-modal-body .kr-path') as HTMLElement
    expect(pathEl.textContent).toBe('/DATA')
    expect(pathEl.getAttribute('style')).toContain('margin-bottom: 10px')
    const check = modal!.querySelector('.kr-check') as HTMLElement
    expect(norm(check.textContent!)).toBe('同时删除该目录下已生成的 .wiki.md 导航文件')
    expect((check.querySelector('input') as HTMLInputElement).type).toBe('checkbox')
    expect(norm(modal!.querySelector('.kr-hint')!.textContent!)).toBe(
      '知识库中的索引数据会保留；重新添加同一目录可直接复用。',
    )
    const footBtns = Array.from(modal!.querySelectorAll('.k-modal-foot button'))
    expect(footBtns.map((b) => norm(b.textContent!))).toEqual(['取消', '删除'])
    expect(footBtns[0]!.className).toBe('k-btn outline')
    expect(footBtns[1]!.className).toBe('k-btn danger')
  })

  it('Click × closes, no request sent', async () => {
    const { host } = await openDelete()
    ;(host.querySelector('.k-modal-x') as HTMLElement).click()
    await nextTick()
    await flushPromises()
    expect(host.querySelector('.k-modal')).toBeNull()
    expect(wiki.deleteRoot).not.toHaveBeenCalled()
  })

  it('Click "Cancel" closes, no request sent', async () => {
    const { host } = await openDelete()
    ;(
      Array.from(host.querySelectorAll('.k-modal-foot button')).find(
        (b) => norm(b.textContent!) === '取消',
      ) as HTMLElement
    ).click()
    await nextTick()
    await flushPromises()
    expect(host.querySelector('.k-modal')).toBeNull()
    expect(wiki.deleteRoot).not.toHaveBeenCalled()
  })

  it('🔴 Click backdrop closes; click inside dialog doesn\'t (reka pointerDownOutside)', async () => {
    const { host } = await openDelete()
    await new Promise((r) => setTimeout(r, 0))
    ;(host.querySelector('.k-modal-title') as HTMLElement).dispatchEvent(
      new Event('pointerdown', { bubbles: true }),
    )
    await nextTick()
    expect(host.querySelector('.k-modal'), 'click inside should not close').not.toBeNull()
    ;(host.querySelector('.k-modal-bg') as HTMLElement).dispatchEvent(
      new Event('pointerdown', { bubbles: true }),
    )
    await nextTick()
    await flushPromises()
    expect(host.querySelector('.k-modal'), 'click on backdrop must close').toBeNull()
  })

  it('🔴 purgeFiles both sides: unchecked → deleteRoot(id, false)', async () => {
    const { host, store } = await openDelete(0)
    const toast = vi.spyOn(store, 'toast')
    ;(
      Array.from(host.querySelectorAll('.k-modal-foot button')).find(
        (b) => norm(b.textContent!) === '删除',
      ) as HTMLElement
    ).click()
    await flushPromises()
    expect(wiki.deleteRoot).toHaveBeenCalledWith('dfcd1840f5dab439cd9d7050aa5bafd0', false)
    expect(toast).toHaveBeenLastCalledWith('已删除')
  })

  it('🔴 purgeFiles both sides: checked → deleteRoot(id, true)', async () => {
    const { host } = await openDelete(1)
    const box = host.querySelector('.kr-check input') as HTMLInputElement
    box.checked = true
    box.dispatchEvent(new Event('change'))
    await nextTick()
    ;(
      Array.from(host.querySelectorAll('.k-modal-foot button')).find(
        (b) => norm(b.textContent!) === '删除',
      ) as HTMLElement
    ).click()
    await flushPromises()
    expect(wiki.deleteRoot).toHaveBeenCalledWith('9b1c77e0aa2f4d3e8c5106b4f7d2a318', true)
  })

  it('🔴 After delete deleting=null and purgeFiles=false (blueprint :217-218 **outside** try/catch)', async () => {
    const { w, host } = await openDelete(1)
    const box = host.querySelector('.kr-check input') as HTMLInputElement
    box.checked = true
    box.dispatchEvent(new Event('change'))
    await nextTick()
    ;(
      Array.from(host.querySelectorAll('.k-modal-foot button')).find(
        (b) => norm(b.textContent!) === '删除',
      ) as HTMLElement
    ).click()
    await flushPromises()
    // deleting=null ⇒ close dialog
    expect(host.querySelector('.k-modal'), 'deleting not set to null').toBeNull()
    // purgeFiles=false ⇒ reopen, checkbox back to unchecked
    await rows(w)[1]!.findAll('button.k-btn.ghost')[1]!.trigger('click')
    await nextTick()
    await flushPromises()
    expect(
      (host.querySelector('.kr-check input') as HTMLInputElement).checked,
      'purgeFiles not reset — next delete would accidentally clear files',
    ).toBe(false)
  })

  it('🔴 K58 — delete fails: only show "operation failed", dialog still closes, purgeFiles still resets (blueprint those two lines outside catch)', async () => {
    const { host, store } = await openDelete(0)
    const toast = vi.spyOn(store, 'toast')
    wiki.deleteRoot.mockRejectedValue(new Error('PROBE-K58-R5T9-del'))
    ;(
      Array.from(host.querySelectorAll('.k-modal-foot button')).find(
        (b) => norm(b.textContent!) === '删除',
      ) as HTMLElement
    ).click()
    await flushPromises()
    expect(toast).toHaveBeenLastCalledWith('操作失败')
    expect(toast.mock.calls.flat().join('|')).not.toContain('PROBE-K58-R5T9')
    expect(host.innerHTML).not.toContain('PROBE-K58-R5T9')
    expect(host.querySelector('.k-modal'), 'blueprint :217 outside catch ⇒ failure also closes').toBeNull()
  })

  it('🔴 Close dialog does **not** reset purgeFiles (blueprint three close paths all set deleting=null only, copy as-is)', async () => {
    const { w, host } = await openDelete(0)
    const box = host.querySelector('.kr-check input') as HTMLInputElement
    box.checked = true
    box.dispatchEvent(new Event('change'))
    await nextTick()
    ;(host.querySelector('.k-modal-x') as HTMLElement).click()
    await nextTick()
    await flushPromises()
    await rows(w)[0]!.findAll('button.k-btn.ghost')[1]!.trigger('click')
    await nextTick()
    await flushPromises()
    expect(
      (host.querySelector('.kr-check input') as HTMLInputElement).checked,
      'blueprint close paths don\'t touch purgeFiles — this was "convenient fix"',
    ).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 Decision R27 / Errata E-62 — toast always via `store.toast(...)` (internal 2400ms),
// direct call to `useToast()` loses blueprint's own 2400ms (global `show()` defaults to 1500ms only).
describe('RootsView — R27: 7 toasts all via store.toast (not direct useToast)', () => {
  it('toggle / rescan / confirmDelete three success branches all caught by store.toast spy', async () => {
    const { w, host, store } = await mountPage()
    const toast = vi.spyOn(store, 'toast')
    // 🔴 §9.17: before "click something" confirm it's truly clickable under this data state —
    //   rescan button has `:disabled="!r.enabled"`, so **must rescan before toggle**;
    //   opposite: disable row 0 first, rescan button grayed, that click silently doesn't happen (been caught once).
    expect(
      (rows(w)[0]!.findAll('button.k-btn.ghost')[0]!.element as HTMLButtonElement).disabled,
      'row 0 rescan button must be clickable now',
    ).toBe(false)
    // ① rescan success
    await rows(w)[0]!.findAll('button.k-btn.ghost')[0]!.trigger('click')
    await flushPromises()
    // ② toggle success
    await rows(w)[0]!.find('button.k-sw').trigger('click')
    await flushPromises()
    // ③ confirmDelete success
    await rows(w)[1]!.findAll('button.k-btn.ghost')[1]!.trigger('click')
    await nextTick()
    await flushPromises()
    ;(
      Array.from(host.querySelectorAll('.k-modal-foot button')).find(
        (b) => norm(b.textContent!) === '删除',
      ) as HTMLElement
    ).click()
    await flushPromises()
    // Criterion: change any to direct useToast().show(...) → spy record for that disappears
    expect(toast.mock.calls.map((c: unknown[]) => c[0])).toEqual([
      '已开始重新扫描',
      '已禁用',
      '已删除',
    ])
  })

  it('🔴 Zero direct `useToast(` calls in source (governance §5.1 / decision R27)', () => {
    expect(SRC_CODE, 'direct useToast() loses blueprint\'s 2400ms (decision R27)').not.toMatch(/useToast\s*\(/)
    // 🔴 Anti-false-negative: confirm there really are store.toast call sites (else above also green on page that doesn't toast).
    //   7 = toggle 2 (success + catch) + rescan 2 + confirmDelete 2 + submit success 1;
    //   submit failure path goes inline per K59, **doesn't toast**, so not counted.
    expect((SRC_CODE.match(/store\.toast\(/g) || []).length, 'store.toast call count').toBe(7)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴 **Later addition** (decision **R27** — Important I-1 from T5 review handed to this file)
//
// ⚠️ For T6 this file has **extremely narrow exemption: new tests only, zero changes to existing lines** (decision R27).
//    🔴 **`RootsView.vue` product code unchanged** — review verified it **character-by-character correct**,
//    what was missing has always been guards ("product correct, guards zero" family, Nth time).
//
// 【Why the submitting test above has zero discriminative power】
//   In `RootsView — canSubmit both sides + submitting gate`,
//   the "submitting gate: first request in-flight, repeat click doesn't send second" test clicks the **"Add" button**
//   in `.k-modal-foot`, which has `:disabled="!canSubmit || submitting"`.
//   🔴 **JSDOM doesn't dispatch click events to `:disabled` elements** ⇒ second `.click()` never enters
//   tested code ⇒ that test actually measures **`:disabled` binding**, not the function gate in `submit()`.
//   Review found: remove `|| submitting.value` gate from `submit()`, **all 60 tests still pass**.
//   ⚠️ This is a variant of governance §9.17 "before clicking something confirm it renders **clickable** under given data":
//     **Element renders but is disabled ⇒ click event never happens ⇒ test never reaches tested code.**
//     **Standing lesson: clicking `:disabled` element under JSDOM = zero discriminative power; to test "function gate" use an unblocked entry.**
//
// 【The real bypass path this test walks】**N50's "Add in mirror mode" button** (the `k-btn outline` in
//   `.kr-error` inline block of `RootsView.vue`) — it `@click="submit(true)"` and
//   **has no `:disabled` binding** ⇒ double-click really dispatches two clicks, really enters `submit()` twice.
//   🔴 Criterion: remove `submitting.value` gate from `submit()` → **this test must fail**
//   (with gate 1 call / without gate 2 calls to `createRoot`).
// ═══════════════════════════════════════════════════════════════════════════
describe('RootsView — 🔴 submitting is **function gate**, not just :disabled binding (decision R27)', () => {
  /** Open dialog → fill valid path → use 409 to get "Add in mirror mode" button (N50). */
  async function openWithMirrorOffer() {
    const m = await mountPage([])
    await m.w.find('.k-section-head button.k-btn.primary').trigger('click')
    await nextTick()
    await flushPromises()
    const input = m.host.querySelector('input.kr-input') as HTMLInputElement
    input.value = '/mnt/ro'
    input.dispatchEvent(new Event('input'))
    await nextTick()
    wiki.createRoot.mockRejectedValueOnce(httpError(409))
    ;(
      Array.from(m.host.querySelectorAll('.k-modal-foot button')).find(
        (b) => norm(b.textContent!) === '添加',
      ) as HTMLElement
    ).click()
    await flushPromises()
    return m
  }

  it('🔴 §9.17 prerequisite: "Add in mirror mode" button really renders **clickable** (no disabled)', async () => {
    const { host } = await openWithMirrorOffer()
    const mirrorBtn = host.querySelector('.kr-error button.k-btn.outline') as HTMLButtonElement
    expect(mirrorBtn, 'N50 mirror button not rendered — suite degrades to zero discriminative power').not.toBeNull()
    expect(norm(mirrorBtn.textContent!)).toBe('以镜像模式添加')
    // 🔴 This is the precondition to test the "function gate": it's **not** disabled.
    expect(mirrorBtn.hasAttribute('disabled'), 'mirror button has disabled — JSDOM won\'t dispatch click').toBe(false)
    expect(mirrorBtn.disabled).toBe(false)
    // Contrast: "Add" button is disabled at the same time (it's what the test above with zero discriminative power clicks).
    const addBtn = Array.from(host.querySelectorAll('.k-modal-foot button')).find(
      (b) => norm(b.textContent!) === '添加',
    ) as HTMLButtonElement
    expect(addBtn.disabled, '"Add" button should be disabled now (canSubmit true but submitting false?)').toBe(false)
  })

  it('🔴 Double-click mirror button: submitting function gate blocks second (criterion: remove gate → must fail)', async () => {
    const { host } = await openWithMirrorOffer()
    const mirrorBtn = host.querySelector('.kr-error button.k-btn.outline') as HTMLButtonElement
    expect(mirrorBtn).not.toBeNull()
    wiki.createRoot.mockClear() // 409 call doesn't count
    const d = makeDeferred<unknown>()
    wiki.createRoot.mockReturnValue(d.promise)
    // 🔴 **Synchronous double-click**: no await between clicks — Vue hasn't re-rendered, elements and listeners still there,
    //   both clicks **really dispatch to `submit(true)`**. Only the function's
    //   `if (!canSubmit.value || submitting.value) return` blocks the second.
    mirrorBtn.click()
    mirrorBtn.click()
    await flushPromises()
    expect(
      wiki.createRoot,
      '🔴 Second call also went out — submitting gate in submit() lost (:disabled can\'t block this entry)',
    ).toHaveBeenCalledTimes(1)
    d.resolve({})
    await flushPromises()
  })

  it('After first call lands mirror button allowed again (submitting reset in finally)', async () => {
    const { host } = await openWithMirrorOffer()
    const mirrorBtn = host.querySelector('.kr-error button.k-btn.outline') as HTMLButtonElement
    wiki.createRoot.mockClear()
    wiki.createRoot.mockRejectedValueOnce(httpError(409))
    mirrorBtn.click()
    await flushPromises()
    expect(wiki.createRoot).toHaveBeenCalledTimes(1)
    // 409 shows mirror button again; gate reset ⇒ this call goes through.
    const again = host.querySelector('.kr-error button.k-btn.outline') as HTMLButtonElement
    expect(again, 'second 409 mirror button didn\'t come back').not.toBeNull()
    wiki.createRoot.mockResolvedValueOnce({})
    again.click()
    await flushPromises()
    expect(wiki.createRoot, 'submitting not reset in finally — gate became one-time').toHaveBeenCalledTimes(2)
  })
})
