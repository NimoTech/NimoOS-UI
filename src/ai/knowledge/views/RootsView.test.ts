// SP8-P5f Task 5 — Component test for `RootsView.vue`.
// Blueprint: `NimoOS-UI` @ `7a6ee6b7` `src/views/AI/Knowledge/RootsView.vue` (289 lines).
//
// ═══ Mock strategy (governance §4.1 requires explicit documentation) ═══
// 🔴 **Mock the six `service.wiki.*` methods of the shared package, use real `knowledgeStore`** — don't mock store.
//   Reasoning same as `AllowlistView.test.ts` / `SettingsView.test.ts`, plus one **critical** reason more:
//   🔴🔴 **Decision R9's `toggle()` invariant** ("store mutates the same object in-place") can only
//   be tested by using a real store — if we mock `setRootEnabled`, `r.enabled` never changes,
//   and those two guard tests degrade to "assert a value that never changes", with zero discriminative power.
// 🔴 Shape (§4.1 table + `p5f-fixtures/README.md` §3):
//   · `service.wiki.getRoots` — **shared package already normalized** (`NimoOS-Service/src/wiki.ts:85`
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
// (decision R3 constraint 1), **don't use `node:fs` to read `.superpowers/`** — that directory is
// gitignored (lost entirely in SP7 once).
// 🔴 **Take only data fields, convert `__meta` to comments** (decision R14 / `p5f-fixtures/README.md` §0.2).
// Copy equivalence confirmed by **byte-for-byte programmatic verification** (output pasted in T5 report §5),
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
// i18n 由 `vitest.setup.ts` 全局装好(见 `mountPage` 注释),本文件不再自己装 —— 也**不许**
// 另建 `createI18n`(与 setup 的单例重复安装,记忆 `vitest-reporter-hides-warnings`)。
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
//                 NimoOS-Service/src/wiki.ts:85 normalizeRoot.
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
//   · passthrough: 🔴 getCandidates **does not normalize** (NimoOS-Service/src/wiki.ts:154-157 pass-through as-is)
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
//    → first two of this suite + the one in R27 **all 3 fail** (T5 report §7 pasted full output + md5sum restored).
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
// 🔴🔴 N46 的下划线陷阱 —— `createRootBody` 必须来自共享包,且三个入参真的传到位。
//    传错了后端会**静默丢弃**(Go 解码器大小写不敏感但下划线不匹配)⇒ 真机无报错、三门全绿。
describe('RootsView —— submit():createRootBody 的三个入参真的传到位(N46)', () => {
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

  it('🔴 源码里 `createRootBody` 是从共享包 import 的,不是本仓重写的(D3 已进包)', () => {
    expect(SRC).toMatch(/import\s*\{[^}]*\bcreateRootBody\b[^}]*\}\s*from\s*'@nimotech\/nimoos-service'/)
    // 反向:本文件里不许自己拼那套 Go 字段名
    // 防空转同上:先证明剥注释后 `createRootBody` 的调用点还在,再做否定断言。
    expect(SRC_CODE, '剥注释器把 createRootBody 的调用点吃掉了').toContain('createRootBody({')
    expect(SRC_CODE, 'RootsView 自己拼 body 了 —— 必须用共享包的 createRootBody').not.toMatch(
      /\bStorageMode\s*:/,
    )
    expect(SRC_CODE).not.toMatch(/\bScanIntervalS\s*:/)
  })

  it('🔴 默认表单 → body 逐字段(Path/Level/WatchMode/StorageMode/ScanIntervalS)', async () => {
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
    // 同时钉住「它就是共享包 createRootBody 的产物」
    expect(wiki.createRoot.mock.calls[0]![0]).toEqual(
      createRootBody({ path: '/DATA/Books', watchMode: 'auto', scanIntervalH: 6, mirror: false }),
    )
  })

  it('🔴🔴 watchMode / scanIntervalH 两个入参真的传到位(改高级选项 → body 跟着变)', async () => {
    const { host } = await openModal()
    await setPath(host, '/mnt/ro')
    ;(host.querySelector('.k-adv-toggle') as HTMLElement).click()
    await nextTick()
    // 监视模式 → scan_only
    ;(host.querySelectorAll('.k-radio-group button')[1] as HTMLElement).click()
    await nextTick()
    // 扫描间隔 → 2 小时
    const hours = host.querySelectorAll('input.kr-input')[1] as HTMLInputElement
    hours.value = '2'
    hours.dispatchEvent(new Event('input'))
    await nextTick()
    addBtn(host).click()
    await flushPromises()
    const body = wiki.createRoot.mock.calls[0]![0] as Record<string, unknown>
    expect(body.WatchMode, 'watchMode 没传进 createRootBody —— 后端会静默用默认值').toBe('scan_only')
    expect(body.ScanIntervalS, 'scanIntervalH 没传进 createRootBody').toBe(7200)
    expect(body).toEqual(
      createRootBody({ path: '/mnt/ro', watchMode: 'scan_only', scanIntervalH: 2, mirror: false }),
    )
  })

  it('🔴🔴 mirror 入参真的传到位(镜像重试 → StorageMode: mirror)', async () => {
    const { host } = await openModal()
    await setPath(host, '/mnt/ro')
    wiki.createRoot.mockRejectedValueOnce(httpError(409))
    addBtn(host).click()
    await flushPromises()
    // 第一发 mirror=false
    expect((wiki.createRoot.mock.calls[0]![0] as Record<string, unknown>).StorageMode).toBe('inline')
    // 点「以镜像模式添加」→ 第二发 mirror=true
    const mirrorBtn = host.querySelector('.kr-error button.k-btn.outline') as HTMLElement
    expect(mirrorBtn, 'N50 的镜像按钮没渲染出来').not.toBeNull()
    mirrorBtn.click()
    await flushPromises()
    const body = wiki.createRoot.mock.calls[1]![0] as Record<string, unknown>
    expect(body.StorageMode, 'mirror 没传进 createRootBody').toBe('mirror')
    expect(body).toEqual(
      createRootBody({ path: '/mnt/ro', watchMode: 'auto', scanIntervalH: 6, mirror: true }),
    )
  })

  it('成功 → 关弹窗 + toast「已添加索引目录」+ 重载列表', async () => {
    const { host, store } = await openModal()
    const toast = vi.spyOn(store, 'toast')
    await setPath(host, '/DATA/Books')
    addBtn(host).click()
    await flushPromises()
    expect(host.querySelector('.k-modal')).toBeNull()
    expect(toast).toHaveBeenLastCalledWith('已添加索引目录')
    // createRoot 内部会再 loadRoots 一次(knowledgeStore.ts:682)
    expect(wiki.getRoots).toHaveBeenCalledTimes(2)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 canSubmit(蓝本 :144)+ submitting 门(治理 §5.2)。
describe('RootsView —— canSubmit 两侧 + submitting 门', () => {
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

  it('🔴 canSubmit = path.startsWith("/") 两侧(disabled 是真布尔属性)', async () => {
    const { host } = await openModal()
    expect(addBtn(host).disabled, '初值空串 → 灰掉').toBe(true)
    await setPath(host, 'DATA/Books')
    expect(addBtn(host).disabled, '相对路径 → 灰掉').toBe(true)
    await setPath(host, '/DATA/Books')
    expect(addBtn(host).disabled, '绝对路径 → 可点').toBe(false)
  })

  it('🔴 函数自己也守 canSubmit(绕过按钮 disabled 直接调也不发请求)', async () => {
    const { w, host } = await openModal()
    await setPath(host, 'relative/path')
    // v-model.trim 已把值同步进 form;直接触发一次镜像按钮那条路径不可用,
    // 这里走「按钮虽 disabled 但 DOM click 仍派发」的等价路径
    addBtn(host).click()
    await flushPromises()
    expect(wiki.createRoot).not.toHaveBeenCalled()
    expect(w.html()).toBeTruthy()
  })

  it('🔴 submitting 门:第一发在飞时重复点不发第二发(蓝本 :184 自带)', async () => {
    const { host } = await openModal()
    await setPath(host, '/DATA/Books')
    const d = makeDeferred<unknown>()
    wiki.createRoot.mockReturnValue(d.promise)
    addBtn(host).click()
    await nextTick()
    await flushPromises()
    expect(wiki.createRoot).toHaveBeenCalledTimes(1)
    // 按钮此刻应当是 disabled(`!canSubmit || submitting`)
    expect(addBtn(host).disabled, 'submitting 期间按钮没灰').toBe(true)
    addBtn(host).click()
    await nextTick()
    await flushPromises()
    expect(wiki.createRoot, 'submitting 门没挡住第二发').toHaveBeenCalledTimes(1)
    d.resolve({})
    await flushPromises()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 K59 —— addError 走**弹窗内联**(不是 toast)。
//    记忆 `newui-dialog-error-not-toast`:toast 是 z-index 60、弹窗遮罩 1000 还带 blur
//    ⇒ 弹窗里的错误写成 toast 会被压住 + 糊掉。
describe('RootsView —— K59:addError 弹窗内联(409 出镜像按钮 / 非 409 只有文案)', () => {
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

  it('🔴 409 → 只读文案 + 「以镜像模式添加」按钮(N50 照抄,弹窗**不关**)', async () => {
    const { host, store } = await openModal()
    const toast = vi.spyOn(store, 'toast')
    wiki.createRoot.mockRejectedValue(httpError(409, 'PROBE-K58-R5T9-409'))
    await clickAdd(host)
    const err = host.querySelector('.kr-error')
    expect(err, 'K59:错误必须内联在弹窗里').not.toBeNull()
    expect(norm(err!.textContent!)).toContain(
      '该目录只读——可改用镜像模式添加(wiki 数据存放在中央目录)。',
    )
    const mirrorBtn = err!.querySelector('button.k-btn.outline')
    expect(mirrorBtn, 'N50 的镜像按钮必须在').not.toBeNull()
    expect(norm(mirrorBtn!.textContent!)).toBe('以镜像模式添加')
    expect(host.querySelector('.k-modal'), '失败不该关弹窗').not.toBeNull()
    // 🔴 K59:走内联,**不**弹 toast
    expect(toast, '错误弹成了 toast —— 会被遮罩压住(记忆 newui-dialog-error-not-toast)').not.toHaveBeenCalled()
    // K58:不回显后端 body
    expect(host.innerHTML).not.toContain('PROBE-K58-R5T9')
  })

  it('🔴 非 409(500)→ K58 映射文案「操作失败」,且**没有**镜像按钮', async () => {
    const { host, store } = await openModal()
    const toast = vi.spyOn(store, 'toast')
    wiki.createRoot.mockRejectedValue(httpError(500, 'PROBE-K58-R5T9-500add'))
    await clickAdd(host)
    const err = host.querySelector('.kr-error')
    expect(err).not.toBeNull()
    expect(norm(err!.textContent!)).toBe('操作失败')
    expect(err!.querySelector('button'), '非 409 不该出镜像按钮').toBeNull()
    expect(toast).not.toHaveBeenCalled()
    expect(host.innerHTML).not.toContain('PROBE-K58-R5T9')
  })

  it('🔴 裸 Error(无 response)也走映射,不回显 e.message(蓝本 :202 的第三条兜底)', async () => {
    const { host } = await openModal()
    wiki.createRoot.mockRejectedValue(new Error('PROBE-K58-R5T9-bareadd'))
    await clickAdd(host)
    expect(norm(host.querySelector('.kr-error')!.textContent!)).toBe('操作失败')
    expect(host.innerHTML).not.toContain('PROBE-K58-R5T9')
  })

  it('409 之后再点镜像按钮:先清掉旧错误块(蓝本 :186-187 在 try 之前)', async () => {
    const { host } = await openModal()
    wiki.createRoot.mockRejectedValueOnce(httpError(409))
    await clickAdd(host)
    expect(host.querySelector('.kr-error')).not.toBeNull()
    wiki.createRoot.mockResolvedValue({})
    ;(host.querySelector('.kr-error button.k-btn.outline') as HTMLElement).click()
    await flushPromises()
    expect(host.querySelector('.k-modal'), '成功应关弹窗').toBeNull()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 K57 —— 删除确认弹窗(蓝本 :93-120)+ confirmDelete()(蓝本 :209-219)。
describe('RootsView —— K57:reka「删除索引目录?」确认弹窗 + confirmDelete()', () => {
  async function openDelete(i = 0) {
    const m = await mountPage()
    expect(m.host.querySelector('.k-modal'), '默认不该渲染弹窗').toBeNull()
    const btn = rows(m.w)[i]!.findAll('button.k-btn.ghost')[1]!
    expect(btn.attributes('title')).toBe('删除')
    await btn.trigger('click')
    await nextTick()
    await flushPromises()
    return m
  }

  it('点垃圾桶 → portal 到 .knowledge-app,标题 / 路径 / 勾选 / 提示 / 两个按钮逐字', async () => {
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

  it('点 × 关闭,且不发请求', async () => {
    const { host } = await openDelete()
    ;(host.querySelector('.k-modal-x') as HTMLElement).click()
    await nextTick()
    await flushPromises()
    expect(host.querySelector('.k-modal')).toBeNull()
    expect(wiki.deleteRoot).not.toHaveBeenCalled()
  })

  it('点「取消」关闭,且不发请求', async () => {
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

  it('🔴 点遮罩关闭;点弹窗内不关闭(reka pointerDownOutside)', async () => {
    const { host } = await openDelete()
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

  it('🔴 purgeFiles 两侧:不勾 → deleteRoot(id, false)', async () => {
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

  it('🔴 purgeFiles 两侧:勾上 → deleteRoot(id, true)', async () => {
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

  it('🔴 删完 deleting=null 且 purgeFiles=false(蓝本 :217-218 在 try/catch **之外**)', async () => {
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
    // deleting=null ⇒ 弹窗关掉
    expect(host.querySelector('.k-modal'), 'deleting 没被置 null').toBeNull()
    // purgeFiles=false ⇒ 重开一次,勾选框回到未勾
    await rows(w)[1]!.findAll('button.k-btn.ghost')[1]!.trigger('click')
    await nextTick()
    await flushPromises()
    expect(
      (host.querySelector('.kr-check input') as HTMLInputElement).checked,
      'purgeFiles 没被重置 —— 下次删除会意外连文件一起清掉',
    ).toBe(false)
  })

  it('🔴 K58 —— 删除失败:只弹「操作失败」,弹窗仍关、purgeFiles 仍重置(蓝本那两行在 catch 之外)', async () => {
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
    expect(host.querySelector('.k-modal'), '蓝本 :217 在 catch 之外 ⇒ 失败也关').toBeNull()
  })

  it('🔴 关闭弹窗**不**重置 purgeFiles(蓝本三条关闭路径都只置 deleting=null,照抄)', async () => {
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
      '蓝本关闭路径不碰 purgeFiles —— 这里被「顺手修正」了',
    ).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 裁定 R27 / 勘误 E-62 —— toast 一律走 `store.toast(...)`(内部 2400ms),
// 直调 `useToast()` 会丢掉蓝本自己的 2400ms(全局 `show()` 默认只有 1500ms)。
describe('RootsView —— R27:7 处 toast 全部经 store.toast(不是直调 useToast)', () => {
  it('toggle / rescan / confirmDelete 三条成功分支都被 store.toast 的 spy 捕获', async () => {
    const { w, host, store } = await mountPage()
    const toast = vi.spyOn(store, 'toast')
    // 🔴 §9.17:「点某个东西」之前先确认它在本条数据下真是可点元素 ——
    //   重扫按钮带 `:disabled="!r.enabled"`,所以**必须先重扫再 toggle**;
    //   反过来先把第 0 行关掉,重扫按钮就灰了,那一发 click 静默不发生(实测栽过一次)。
    expect(
      (rows(w)[0]!.findAll('button.k-btn.ghost')[0]!.element as HTMLButtonElement).disabled,
      '第 0 行的重扫按钮此刻必须是可点的',
    ).toBe(false)
    // ① rescan 成功
    await rows(w)[0]!.findAll('button.k-btn.ghost')[0]!.trigger('click')
    await flushPromises()
    // ② toggle 成功
    await rows(w)[0]!.find('button.k-sw').trigger('click')
    await flushPromises()
    // ③ confirmDelete 成功
    await rows(w)[1]!.findAll('button.k-btn.ghost')[1]!.trigger('click')
    await nextTick()
    await flushPromises()
    ;(
      Array.from(host.querySelectorAll('.k-modal-foot button')).find(
        (b) => norm(b.textContent!) === '删除',
      ) as HTMLElement
    ).click()
    await flushPromises()
    // 判据:任何一处改成直调 useToast().show(...) → 该处的 spy 记录消失
    expect(toast.mock.calls.map((c: unknown[]) => c[0])).toEqual([
      '已开始重新扫描',
      '已禁用',
      '已删除',
    ])
  })

  it('🔴 源码里零 `useToast(` 直调(治理 §5.1 / 裁定 R27)', () => {
    expect(SRC_CODE, '直调 useToast() 会丢掉蓝本的 2400ms(裁定 R27)').not.toMatch(/useToast\s*\(/)
    // 🔴 防空转:确认真的有 store.toast 调用点(否则上面那条对着一个不发 toast 的页面也绿)。
    //   7 = toggle 2(成功 + catch)+ rescan 2 + confirmDelete 2 + submit 成功 1;
    //   submit 的失败路径按 K59 走弹窗内联,**不弹 toast**,故不计。
    expect((SRC_CODE.match(/store\.toast\(/g) || []).length, 'store.toast 落点数').toBe(7)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴 SP8-P5f **Task 6 追加**(裁定 **R27** —— T5 评审的 Important I-1 派给本刀)
//
// ⚠️ 本文件对 T6 是**极窄解禁:只许新增,既有每一行零改动**(裁定 R27)。
//    🔴 **`RootsView.vue` 产品码一个字都没动** —— 评审已逐字核为**正确**,
//    缺的从来是守卫(「产品代码对、守卫为零」家族第 N 次)。
//
// 【上面那条 submitting 用例为什么是零判别力】
//   `RootsView —— canSubmit 两侧 + submitting 门` 里的
//   「🔴 submitting 门:第一发在飞时重复点不发第二发」点的是 `.k-modal-foot` 里的
//   **「添加」按钮**,而那个按钮带 `:disabled="!canSubmit || submitting"`。
//   🔴 **jsdom 不向 `:disabled` 元素派发 click 事件** ⇒ 第二次 `.click()` 根本没进入
//   被测代码 ⇒ 那条用例实测的是 **`:disabled` 绑定**,不是 `submit()` 里的函数门。
//   评审实证:把 `submit()` 的 `|| submitting.value` 整条门去掉,**60/60 全绿**。
//   ⚠️ 这是治理 §9.17「点某个东西先确认它在给定数据下真渲染成**可点**元素」的变种:
//     **元素渲染了,但它是 disabled ⇒ 点击事件根本没发生 ⇒ 用例从未到达被测代码。**
//     **常驻教训:jsdom 下点 `:disabled` 元素 = 零判别力,验「函数门」必须走无 disabled 的入口。**
//
// 【本条走的真实绕过路径】**N50 的「以镜像模式添加」按钮**(`RootsView.vue` 的
//   `.kr-error` 内联块里那个 `k-btn outline`)—— 它 `@click="submit(true)"` 且
//   **没有任何 `:disabled` 绑定** ⇒ 双击真的会派发两次 click、真的会进两次 `submit()`。
//   🔴 判据:去掉 `submit()` 的 `submitting.value` 门 → **本条必须报红**
//   (带门 1 发 / 去门 2 发 `createRoot`)。RED 输出与 `md5sum` 还原确认贴在
//   `p5f-task-6-report.md` §7。
// ═══════════════════════════════════════════════════════════════════════════
describe('RootsView —— 🔴 submitting 是**函数门**,不只是 :disabled 绑定(裁定 R27)', () => {
  /** 开弹窗 → 填一个合法路径 → 用 409 换出「以镜像模式添加」按钮(N50)。 */
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

  it('🔴 §9.17 前置:「以镜像模式添加」按钮真渲染成**可点**元素(无 disabled)', async () => {
    const { host } = await openWithMirrorOffer()
    const mirrorBtn = host.querySelector('.kr-error button.k-btn.outline') as HTMLButtonElement
    expect(mirrorBtn, 'N50 的镜像按钮没渲染出来 —— 本组会退化成零判别力').not.toBeNull()
    expect(norm(mirrorBtn.textContent!)).toBe('以镜像模式添加')
    // 🔴 这才是本条能测到「函数门」的前提:它**不是** disabled 元素。
    expect(mirrorBtn.hasAttribute('disabled'), '镜像按钮带了 disabled —— jsdom 不会派发 click').toBe(false)
    expect(mirrorBtn.disabled).toBe(false)
    // 对照:同一时刻「添加」按钮是 disabled 的(它才是上面那条零判别力用例点的目标)。
    const addBtn = Array.from(host.querySelectorAll('.k-modal-foot button')).find(
      (b) => norm(b.textContent!) === '添加',
    ) as HTMLButtonElement
    expect(addBtn.disabled, '「添加」按钮此刻应当是 disabled(canSubmit 为真但 submitting 为假?)').toBe(false)
  })

  it('🔴 双击镜像按钮:submitting 函数门挡住第二发(判据:去掉该门 → 本条必须报红)', async () => {
    const { host } = await openWithMirrorOffer()
    const mirrorBtn = host.querySelector('.kr-error button.k-btn.outline') as HTMLButtonElement
    expect(mirrorBtn).not.toBeNull()
    wiki.createRoot.mockClear() // 409 那一发不算
    const d = makeDeferred<unknown>()
    wiki.createRoot.mockReturnValue(d.promise)
    // 🔴 **同步双击**:两次点击之间不 await —— Vue 还没重渲染,元素与监听器都还在,
    //   两次 click **都真的派发到 `submit(true)`**。挡住第二发的只能是函数里的
    //   `if (!canSubmit.value || submitting.value) return`。
    mirrorBtn.click()
    mirrorBtn.click()
    await flushPromises()
    expect(
      wiki.createRoot,
      '🔴 第二发也发出去了 —— submit() 里的 submitting 门丢了(:disabled 挡不住这个入口)',
    ).toHaveBeenCalledTimes(1)
    d.resolve({})
    await flushPromises()
  })

  it('第一发落地之后镜像按钮才允许再发(finally 里 submitting 归位)', async () => {
    const { host } = await openWithMirrorOffer()
    const mirrorBtn = host.querySelector('.kr-error button.k-btn.outline') as HTMLButtonElement
    wiki.createRoot.mockClear()
    wiki.createRoot.mockRejectedValueOnce(httpError(409))
    mirrorBtn.click()
    await flushPromises()
    expect(wiki.createRoot).toHaveBeenCalledTimes(1)
    // 409 再次给出镜像按钮;门已归位 ⇒ 这一发能出去。
    const again = host.querySelector('.kr-error button.k-btn.outline') as HTMLButtonElement
    expect(again, '第二次 409 后镜像按钮没回来').not.toBeNull()
    wiki.createRoot.mockResolvedValueOnce({})
    again.click()
    await flushPromises()
    expect(wiki.createRoot, 'submitting 没在 finally 里归位 —— 门变成了一次性').toHaveBeenCalledTimes(2)
  })
})
