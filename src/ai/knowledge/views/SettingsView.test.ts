// SP8-P5c Task 8 + Task 9 — component test for `SettingsView.vue`.
// Blueprint: `NimoOS-UI` (main@7a6ee6b7) `src/views/AI/Knowledge/SettingsView.vue` (322 lines).
// **T8** covers upper half: service card · three config rows (concurrency/device/OCR) · sandbox
//   entry · danger zone + corresponding script functions
//   (`controlState` / `deviceLabel` / `togglePause` / `setConcurrency` / `setDevice` /
//   `toggleOcr` / `goSandbox`).
// **T9** covers lower half: notes section (directory row + `openRootPicker` collapsible area +
//   `FolderBrowser` integration + `onPick`/`dirProbe` four states + two button disabled logic +
//   auto-capture toggle) · K29 reka migration dialog ·
//   `browserRoots` / `created` / `applyRoot` / `doMigrate` / `closeMigrate` /
//   `toggleAutoExtract`. All T9 test cases are after the `═══ T9 ═══` divider at the end.
//
// 🔴 **T9 changes to T8 existing code in only 4 places, all mechanical byproducts of "inserting
//   lower half"** (details in T9 report §3):
//   ① `vi.hoisted` mock skeleton +3 fields (`notes` / `wiki` / `folder`) — component now truly
//     calls them;
//   ② `mockAllOk()` **+5 lines** defaults (pure addition, existing 3 lines unchanged) — otherwise
//     T8 existing cases would fail to mount with `getSettings()` returning undefined,
//     template reading `notesSettings.notesRoot` immediately throws TypeError;
//   ③ danger zone assertion's **selector** (not the assertion value): after inserting notes
//     section, `.k-section` has two, `w.find('.k-section .k-section-head')` hits notes section
//     first (recorded as E-22);
//   ④ "all four catches are parameterless catch" count **4 → 8** (lower half adds 4 catches,
//     recorded as E-23).
//   Apart from these, every T8 `expect` and DOM assertion is **verbatim unchanged**.
//
// ═══ mock strategy (governance §4.1 requires explicit documentation) ═══
// 🔴 **mock shared package `service.ai.parserStats/parserState/parserControl`, use real
//   `knowledgeStore`**, do not mock store. Same rationale as T6 `ParserStatus.test.ts`: every
//   cell on this page must traverse K1 layer reduction
//   (blueprint `store.state.controlState` → this repo `store.controlState`); mocking store
//   would bypass the most error-prone thing: whether layer reduction and field names align;
//   using real store makes every render assertion naturally an integration assertion — missing
//   one layer or misspelling a field by one letter immediately shows empty/undefined in that cell.
//   T9's `browserRoots` (K1's second layer reduction point, reads `store.wikiCandidates`) and
//   `store.loadCandidates()` also use real store + real `service.wiki.getCandidates` mock.
// 🔴 Shape: `service.ai.parserStats` / `parserState` both only `return res.data`
//   (`NimoOS-Service/src/ai.ts:591-596`, no transformation) → mock as **raw HTTP snake_case**,
//   the fixture verbatim. `parserControl` response body not consumed on this page, mock as `{}`,
//   matching verbatim `parserStore.test.ts:207` / `knowledgeStore.parser.test.ts:136` /
//   `ParserStatus.test.ts:182` (governance §4.1 red-flag self-check: same method different shapes
//   in two test files = time bomb).
// 🔴 **T9's four new mock layers, each aligned with §4.1 table**:
//   · `service.notes.getSettings` / `putSettings` → **camelCase with exactly two fields
//     `{ notesRoot, autoExtract }`** (package-internal `normalizeSettings`,
//     `NimoOS-Service/src/notes.ts:131-137`). **HTTP layer is `notes_root` / `auto_extract`,
//     plus three extra fields `distill_roots` / `distill_daily_cap` / `background_model` —
//     that normalization function discards all three**. Writing snake_case or including extra
//     fields is wrong.
//   · `service.notes.dirInfo` → `{ exists: boolean, empty: boolean }` (package-internal `!!`
//     normalization, `:264-267`).
//   · `service.wiki.getCandidates` → normalized array (empty as `[]`, `wiki.ts:154-156`).
//   · `service.folder.getList` (via `FolderBrowser`) → 🔴 **single-layer `{ content: FolderEntry[] }`
//     after `unwrap()`** (`folder.ts:7-10`), **not** the three-layer envelope in fixture.
//     Matches `FolderBrowser.test.ts:185` `{ content: [] }` verbatim (red-flag self-check passed).
//
// ═══ fixtures are copies, not read at runtime (governance §4.4) ═══
// Data copied verbatim into `FIXTURE-COPY-BEGIN/END` blocks below with attribution, **do not use
// `node:fs` to read `.superpowers/`** — that directory is gitignored (entire loss in SP7 once),
// this branch will merge to master, tests under `src/` crossing into it mysteriously fail as
// "file not found".
// Copy equivalence confirmed via **programmatic byte-for-byte verification** (output in T8 report
// §5), not visual inspection.
// Reading `.vue` source files (A-1 / no bare color rules) always use `node:fs`, **never Vite's
// `?raw`**
//   (vitest's CSSEnablerPlugin replaces stylesheet source with empty string → assertion against
//    empty string "falsely passes"; precedent `knowledgeStyles.test.ts` header comment ③).
//
// ═══ attribute state assertion criteria (governance §9 / appendix D §D.3.1) ═══
// `data-state` / `data-on` are normal `data-*` attributes (not boolean attributes) → SSR renders
// as string `"false"` not missing, so always `toBe('true')` / `toBe('false')`, **both sides
// checked**, forbid `toBeUndefined()`. `disabled` is a true boolean attribute, assert DOM property
// `el.disabled`.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createWebHashHistory } from 'vue-router'
import { i18n } from '../../../i18n'
import zhCn from '../../../i18n/zh_cn'
import enUs from '../../../i18n/en_us'
import { useToast } from '../../../stores/toast'
import { useKnowledgeStore } from '../stores/knowledgeStore'
import type { ParserControlState, ParserStats } from '../stores/knowledgeStore'
import type { NotesSettings } from '@nimotech/nimoos-service'
import KIcon from '../components/KIcon.vue'
import SettingsView from './SettingsView.vue'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SRC_PATH = resolve(__dirname, './SettingsView.vue')

// ── vi.hoisted mock skeleton (governance §9: avoid ESM hoisting TDZ) ──
const ai = vi.hoisted(() => ({
  parserStats: vi.fn(),
  parserState: vi.fn(),
  parserControl: vi.fn(),
}))
// T9 adds three fields: lower component half truly calls `service.notes.*`, `store.loadCandidates()`
// truly calls `service.wiki.getCandidates`, `FolderBrowser` truly calls `service.folder.getList`.
const notes = vi.hoisted(() => ({
  getSettings: vi.fn(),
  putSettings: vi.fn(),
  dirInfo: vi.fn(),
}))
const wiki = vi.hoisted(() => ({ getCandidates: vi.fn() }))
const folder = vi.hoisted(() => ({ getList: vi.fn() }))
vi.mock('@nimotech/nimoos-service', () => ({ service: { ai, notes, wiki, folder } }))

// ═══════════════════════════════════════════════════════════════════════════
// FIXTURE-COPY-BEGIN  p5c-fixtures/parser-control-state.json  (entire, GET /v1/parser/state)
// From `.superpowers/sdd/p5c-fixtures/parser-control-state.json` (2026-08-03 13:22 captured on device).
// 🔴 current device is **paused state** (governance §4.3) → service card is orange light
// `[data-state="paused"]` + `⏸ Paused` + "Resume" button in `primary` style; `device:"auto"` +
// `resolved_device:"cpu"` → deviceLabel renders "Auto (currently CPU)"; `ocr_enabled:false` →
// toggle in off state. "Running / green light" state not visible on this device (clicking "Resume"
// once would really resume indexing), covered by fixture variant below.
const STATE: ParserControlState = {
  "paused": true,
  "concurrency": 2,
  "device": "auto",
  "ocr_enabled": false,
  "resolved_device": "cpu"
}
// FIXTURE-COPY-END

// FIXTURE-COPY-BEGIN  p5c-fixtures/parser-stats.json  (entire, GET /v1/parser/stats)
// From `.superpowers/sdd/p5c-fixtures/parser-stats.json` (2026-08-03 13:22).
// This page **does not render any field from stats**, but `store.loadOverview()` is a
// `Promise.all` of two calls (stats + state); missing either causes whole flow to go to catch
// branch setting `unreachable` → controlState stays at default. Thus this fixture is a prerequisite
// for "letting the state call land", not decoration.
// 🔴 `models[1].dim` on device is `null`, but `ParserModel.dim` is `dim?: number`
//   (`knowledgeStore.ts:76`; T5's `parserStore.ts:78` relaxes to `number | null`, store-specific
//   types outside this change scope) → direct type annotation `: ParserStats` would TS error.
//   **fixture verbatim takes priority** (governance §4.4 "copy verbatim"), so use
//   `as unknown as ParserStats` — "backend truly returns null" is exactly what the mock simulates
//   in raw HTTP form; never alter data to appease types.
const STATS = {
  "queue_depth": {
    "pending": 339,
    "running": 1,
    "failed": 0,
    "done": 9
  },
  "indexed_files": 7,
  "total_vectors_text": 5592,
  "total_vectors_visual": 0,
  "last_cursor_ms": 1784775953391,
  "models": [
    {
      "name": "bge-m3",
      "version": "v1",
      "modality": "text",
      "dim": 1024
    },
    {
      "name": "bge-reranker-v2-m3",
      "version": "v1",
      "modality": "rerank",
      "dim": null
    }
  ]
} as unknown as ParserStats
// FIXTURE-COPY-END

// FIXTURE-COPY-BEGIN  p5c-fixtures/notes-settings.json  (GET /v1/notes/settings)
// HTTP raw (byte-for-byte):{"notes_root":"/DATA/Notes","auto_extract":true,"distill_roots":[],"distill_daily_cap":50,"background_model":""}
// From `.superpowers/sdd/p5c-fixtures/notes-settings.json` (2026-08-03 13:22 captured on device).
// 🔴 **layer reduction action (governance §4.1 / §4.4: document reduction in comments)**:
//   `service.notes.getSettings` package-internal goes through `normalizeSettings`
//   (`NimoOS-Service/src/notes.ts:131-137`):
//       notesRoot   = (r.notes_root as string) || ''
//       autoExtract = r.auto_extract !== false        ← undefined also normalizes to true
//   → component receives **camelCase with exactly these two fields**; the three `distill_*` /
//   `background_model` above are **entirely discarded** by the normalization function, including
//   any extra field in mock is wrong.
const NOTES_SETTINGS: NotesSettings = { notesRoot: '/DATA/Notes', autoExtract: true }
// FIXTURE-COPY-END

// FIXTURE-COPY-BEGIN  p5c-fixtures/notes-dir-info-notes.json  (GET /v1/notes/dir-info?path=/DATA/Notes)
// HTTP raw (byte-for-byte):{"exists":true,"empty":false}
// 🔴 on device `/DATA/Notes` is confirmed **exists and not empty** → `migratable = !exists || empty` = false
//   → when selecting it "move files to new directory…" button **is grayed out** (governance §4.3 / §13,
//   correct behavior).
//   Package-internal `dirInfo` (`notes.ts:264-267`) only does `!!` normalization, field names and
//   layer structure unchanged.
const DIR_INFO_NOTES = { exists: true, empty: false }
// FIXTURE-COPY-END

// FIXTURE-COPY-BEGIN  p5c-fixtures/wiki-candidates.json  (GET /v1/wiki/candidates)
// HTTP raw (byte-for-byte):[]
// 🔴 device test confirms empty array (HTTP 200, immediate response) → `pickerRoots([])` goes to
//   **three fallback roots** (`System (/DATA)` / `/media` / `/mnt`), this is the path device
//   actually takes, not dead code.
//   Package-internal `getCandidates` (`wiki.ts:154-156`) already normalizes with `|| []`, layer
//   structure unchanged.
const WIKI_CANDIDATES: never[] = []
// FIXTURE-COPY-END
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Return shape of `service.folder.getList` — 🔴 **single layer** `{ content: FolderEntry[] }`
 * (already `unwrap()` in `folder.ts:7-10`), matches `FolderBrowser.test.ts:185` verbatim.
 * 🔴 **do not copy the 18 items from `folder-list-DATA.json`**: this file has no assertions
 * depending on directory list content (list rendering, sorting, hidden item filtering all covered
 * by `FolderBrowser.test.ts` with real 18-item fixture); here we only need "clicking the root
 * directory row can proceed", feeding empty directory suffices (governance §4.4: don't copy what
 * you don't use).
 */
const EMPTY_LISTING = { content: [] }

/** Both calls succeed, feed fixture verbatim; control action returns `{}`. */
function mockAllOk(): void {
  ai.parserStats.mockResolvedValue(STATS)
  ai.parserState.mockResolvedValue(STATE)
  ai.parserControl.mockResolvedValue({})
  // T9: four lower read/write entry points default to all success, feed fixture copies (layer
  // structure see mock strategy in file header).
  notes.getSettings.mockResolvedValue(NOTES_SETTINGS)
  notes.putSettings.mockResolvedValue(NOTES_SETTINGS)
  notes.dirInfo.mockResolvedValue(DIR_INFO_NOTES)
  wiki.getCandidates.mockResolvedValue(WIKI_CANDIDATES)
  folder.getList.mockResolvedValue(EMPTY_LISTING)
}

const mountedWrappers: Array<ReturnType<typeof mount>> = []

function makeRouter() {
  const router = createRouter({
    history: createWebHashHistory('/app/'),
    routes: [
      { path: '/ai/knowledge/settings', name: 'KnowledgeSettings', component: SettingsView },
      // [Correction, SP8-P5d Task 9, governance §15.2] Blueprint `:318` target of `goSandbox()`;
      // in production this route has long been flipped to the real ParserTest (P5c-T10 output),
      // stub in this file's route table only manages href resolution, unrelated to production
      // presence.
      { path: '/ai/parser/test', name: 'AIParserTest', component: { template: '<div />' } },
    ],
  })
  router.push('/ai/knowledge/settings')
  return router
}

/**
 * Mount. In production `controlState` is populated by `KnowledgeLayout.vue:186`'s `loadOverview()`
 * (this page itself doesn't issue read-only requests); in test explicitly run the same action once
 * first — use real store, real service mock, K1 layer reduction and snake_case field names are
 * both verified on this path.
 */
async function mountPage(state?: Partial<ParserControlState>) {
  if (state) ai.parserState.mockResolvedValue({ ...STATE, ...state })
  const router = makeRouter()
  await router.isReady()
  const store = useKnowledgeStore()
  await store.loadOverview()
  const w = mount(SettingsView, { global: { plugins: [router, i18n] } } as never)
  mountedWrappers.push(w)
  await nextTick()
  return { w, store, router }
}

/** VTU's `.text()` only trims, doesn't collapse internal whitespace; normalize multi-line copy
 * before comparing. */
const norm = (s: string): string => s.replace(/\s+/g, ' ').trim()

// ── locator utilities ──
// 🔴 don't use `:nth-of-type()`: the `.k-set-row` in the danger zone card is also the first div
// of its parent element, selector would match both (currently happens not to error because it has
// no `.k-radio-group`, that's luck not design).
//   Switch to "first get the config card, then get the row within the card". After T9 inserts
//   the notes section between "config card" and "sandbox entry", `.k-set-card` index 1 is still
//   the config card (notes card comes after it), this locator group not affected.
const knobCard = (w: ReturnType<typeof mount>) => w.findAll('.k-set-card')[1]!
const knobRows = (w: ReturnType<typeof mount>) => knobCard(w).findAll('.k-set-row')
const concBtns = (w: ReturnType<typeof mount>) => knobRows(w)[0]!.findAll('.k-radio-group button')
const devBtns = (w: ReturnType<typeof mount>) => knobRows(w)[1]!.findAll('.k-radio-group button')
const devLabelB = (w: ReturnType<typeof mount>) => knobRows(w)[1]!.find('.k-set-row-desc b')
/** danger zone's `.k-section` — locate by semantics (card has `.k-set-danger`), not by index.
 *  After T9 inserts notes section `.k-section` has two, `find('.k-section …')` hits notes section
 *  first (E-22). */
const dangerSection = (w: ReturnType<typeof mount>) =>
  w.findAll('.k-section').find((s) => s.find('.k-set-card.k-set-danger').exists())!

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
describe('SettingsView — three wrapper layers (blueprint :2-4, copy each layer)', () => {
  it('root .k-view > .k-scroll > .k-scroll-inner, four content blocks all in innermost', async () => {
    const { w } = await mountPage()
    const root = w.element as HTMLElement
    expect(root.tagName).toBe('DIV')
    expect(root.className).toBe('k-view')
    expect(w.find('.k-view > .k-scroll > .k-scroll-inner').exists()).toBe(true)
    // this cycle four blocks: service card / config card / sandbox entry / danger zone
    // (write full path in child selector — jsdom querySelectorAll doesn't accept relative
    // selectors starting with `>`)
    expect(w.findAll('.k-scroll-inner > .k-set-card')).toHaveLength(2)
    expect(w.find('.k-scroll-inner > .k-sandbox-link').exists()).toBe(true)
    expect(w.find('.k-scroll-inner > .k-section').exists()).toBe(true)
  })

  it('no .parser-app class (governance §6.1 landing constraint 4: this page is under KnowledgeLayout, does not build its own scroll container)', async () => {
    const { w } = await mountPage()
    expect(w.find('.parser-app').exists()).toBe(false)
    expect((w.element as HTMLElement).classList.contains('parser-app')).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('SettingsView — service card two states (blueprint :7-19)', () => {
  it('device test paused:true — light data-state="paused", text "⏸ Paused" + secondary line, button primary + play + "Resume"', async () => {
    const { w } = await mountPage()
    const card = w.find('.k-set-card.k-set-svc')
    expect(card.exists()).toBe(true)
    expect(card.find('.k-svc-light').attributes('data-state')).toBe('paused')
    expect(card.find('.k-svc-name').text()).toBe('⏸ Paused')
    expect(card.find('.k-svc-cn').text()).toBe('New files will not be auto-indexed')
    const btn = card.find('.k-svc-state button')
    expect(btn.classes()).toEqual(['k-btn', 'primary'])
    expect(btn.findComponent(KIcon).props('name')).toBe('play')
    expect(btn.findComponent(KIcon).props('size')).toBe(12)
    expect(btn.text()).toBe('Resume')
  })

  it('fixture variant paused:false — light data-state="running", text "✅ Running" + secondary line, button outline + pause + "Pause"', async () => {
    const { w } = await mountPage({ paused: false })
    const card = w.find('.k-set-card.k-set-svc')
    expect(card.find('.k-svc-light').attributes('data-state')).toBe('running')
    expect(card.find('.k-svc-name').text()).toBe('✅ Running')
    expect(card.find('.k-svc-cn').text()).toBe('Continuously monitoring and indexing new files')
    const btn = card.find('.k-svc-state button')
    expect(btn.classes()).toEqual(['k-btn', 'outline'])
    expect(btn.findComponent(KIcon).props('name')).toBe('pause')
    expect(btn.text()).toBe('Pause')
  })

  it('N16: `⏸` / `✅` **inside** t() — key value includes emoji (not template-composed)', () => {
    const zh = zhCn as Record<string, string>
    const en = enUs as Record<string, string>
    expect(zh.aiKbSetSvcPausedLine).toBe('⏸ 已暂停')
    expect(zh.aiKbSetSvcRunningLine).toBe('✅ 运行中')
    expect(en.aiKbSetSvcPausedLine).toBe('⏸ Paused')
    expect(en.aiKbSetSvcRunningLine).toBe('✅ Running')
    // conversely: button's two keys **do not include** any emoji (no symbols moved into them)
    expect(zh.aiKbResume).toBe('恢复')
    expect(zh.aiKbPause).toBe('暂停')
    expect(zh.aiKbResume).not.toMatch(/[⏸✅▶🧪⚠]/u)
    expect(zh.aiKbPause).not.toMatch(/[⏸✅▶🧪⚠]/u)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('SettingsView — config card · concurrency row (blueprint :22-34)', () => {
  it('three lines: title / Chinese / description verbatim', async () => {
    const { w } = await mountPage()
    const row = knobRows(w)[0]!
    expect(row.find('.k-set-row-title').text()).toBe('Concurrent files')
    expect(row.find('.k-set-row-cn').text()).toBe('Concurrency level')
    expect(row.find('.k-set-row-desc').text()).toBe('Higher value faster, more resource use. Recommend 4 when NAS idle.')
  })

  it('🔴 button text **is just the number** — no level names (`Power-saving`/`Balanced`/`Full power` belong to ParserStatus)', async () => {
    const { w } = await mountPage()
    const btns = concBtns(w)
    expect(btns).toHaveLength(3)
    expect(btns.map((b) => b.text())).toEqual(['1', '2', '4'])
    // test criterion: if someone copies ParserStatus's N17 array-index notation, these four would all fail
    const page = w.text()
    for (const s of ['省电', '平衡', '全力', 'Power-saving', 'Balanced', 'Full power']) {
      expect(page).not.toContain(s)
    }
  })

  it('🔴 data-on both sides — on device with concurrency:2 only second level is "true"', async () => {
    const { w } = await mountPage()
    const btns = concBtns(w)
    expect(btns.map((b) => b.attributes('data-on'))).toEqual(['false', 'true', 'false'])
  })

  it('🔴 data-on both sides — fixture variants concurrency:1 / concurrency:4', async () => {
    const { w } = await mountPage({ concurrency: 1 })
    expect(
      concBtns(w).map((b) => b.attributes('data-on')),
    ).toEqual(['true', 'false', 'false'])

    setActivePinia(createPinia())
    const { w: w4 } = await mountPage({ concurrency: 4 })
    expect(
      concBtns(w4).map((b) => b.attributes('data-on')),
    ).toEqual(['false', 'false', 'true'])
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('SettingsView — config card · device row (blueprint :36-49)', () => {
  it('three lines: title / Chinese + three level text ("Auto" via i18n, bare GPU / CPU are hardcoded tech identifiers)', async () => {
    const { w } = await mountPage()
    const row = knobRows(w)[1]!
    expect(row.find('.k-set-row-title').text()).toBe('Inference device')
    expect(row.find('.k-set-row-cn').text()).toBe('Inference device · maintainers only')
    expect(devBtns(w).map((b) => b.text())).toEqual(['Auto', 'GPU', 'CPU'])
    // blueprint `:46-47` those two deliberately skip i18n (N22 same family) → in source **bare literals**,
    // not via t()
    const src: string = readFileSync(SRC_PATH, 'utf8')
    expect(src).toContain('@click="setDevice(\'cuda\')">GPU<')
    expect(src).toContain('@click="setDevice(\'cpu\')">CPU<')
  })

  it('🔴 data-on both sides — on device with device:"auto" only first level is "true"', async () => {
    const { w } = await mountPage()
    expect(devBtns(w).map((b) => b.attributes('data-on'))).toEqual(['true', 'false', 'false'])
  })

  it('🔴 second level accepts **both** `cuda` **and** `gpu` values (blueprint :46) — cuda matches', async () => {
    const { w } = await mountPage({ device: 'cuda' })
    expect(devBtns(w).map((b) => b.attributes('data-on'))).toEqual(['false', 'true', 'false'])
  })

  it('🔴 second level accepts **both** `cuda` **and** `gpu` values (blueprint :46) — gpu also matches (missing second half renders all false)', async () => {
    const { w } = await mountPage({ device: 'gpu' })
    expect(devBtns(w).map((b) => b.attributes('data-on'))).toEqual(['false', 'true', 'false'])
  })

  it('🔴 data-on both sides — when device:"cpu" only third level is "true"', async () => {
    const { w } = await mountPage({ device: 'cpu' })
    expect(devBtns(w).map((b) => b.attributes('data-on'))).toEqual(['false', 'false', 'true'])
  })

  it('unknown level (backend may add new values later) — all three "false", no false positives', async () => {
    const { w } = await mountPage({ device: 'mps' })
    expect(devBtns(w).map((b) => b.attributes('data-on'))).toEqual(['false', 'false', 'false'])
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('SettingsView — deviceLabel four branches + null fallback (blueprint :216-223)', () => {
  const label = (w: ReturnType<typeof mount>) =>
    norm(knobRows(w)[1]!.find('.k-set-row-desc').text())

  it('branch ① `auto` — on device resolved_device:"cpu" → "Currently using: Auto (currently CPU)"(toUpperCase)', async () => {
    const { w } = await mountPage()
    expect(label(w)).toBe('Currently using:  Auto (currently CPU)')
    expect(devLabelB(w).text()).toBe('Auto (currently CPU)')
  })

  it('branch ① edge case — resolved_device is empty string → renders "Auto (currently )" without error', async () => {
    const { w } = await mountPage({ resolved_device: '' })
    expect(devLabelB(w).text()).toBe('Auto (currently )')
  })

  it('🔴 branch ① edge case — when backend omits `resolved_device` field, blueprint\'s `(r || "")` fallback truly activates', async () => {
    // test criterion: remove `(r || '')` → `undefined.toUpperCase()` throws TypeError → test fails.
    // (empty string case **cannot verify** this fallback: `''.toUpperCase()` is legal anyway —
    //  first version only had empty string case, probe immediately saw zero discrimination against
    //  "remove fallback".)
    const { w } = await mountPage({ resolved_device: undefined as unknown as string })
    expect(devLabelB(w).text()).toBe('Auto (currently )')
  })

  it('branch ② `cuda` → bare `GPU (CUDA)` (note differs from bare `GPU` in setDevice toast, blueprint different in two places)', async () => {
    const { w } = await mountPage({ device: 'cuda' })
    expect(devLabelB(w).text()).toBe('GPU (CUDA)')
  })

  it('branch ② `gpu` also goes to `GPU (CUDA)` (blueprint :220 `d === "cuda" || d === "gpu"`)', async () => {
    const { w } = await mountPage({ device: 'gpu' })
    expect(devLabelB(w).text()).toBe('GPU (CUDA)')
  })

  it('branch ③ `cpu` → bare `CPU`', async () => {
    const { w } = await mountPage({ device: 'cpu' })
    expect(devLabelB(w).text()).toBe('CPU')
  })

  it('branch ④ fallback → return `d` as-is (not empty, not undefined)', async () => {
    const { w } = await mountPage({ device: 'mps' })
    expect(devLabelB(w).text()).toBe('mps')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('SettingsView — config card · OCR row (blueprint :51-60)', () => {
  it('title / Chinese line + `.warn` warning line: period and second half position copy verbatim (blueprint :56)', async () => {
    const { w } = await mountPage()
    const row = knobRows(w)[2]!
    expect(row.find('.k-set-row-title').text()).toBe('Scanned text recognition (OCR)')
    expect(row.find('.k-set-row-cn').text()).toBe('Scan PDF text recognition (OCR)')
    const warn = row.find('.k-set-row-desc .warn')
    expect(warn.exists()).toBe(true)
    expect(warn.findComponent(KIcon).props('name')).toBe('danger')
    expect(warn.findComponent(KIcon).props('size')).toBe(11)
    expect(norm(warn.text())).toBe('5-10× slower when enabled')
    // period **outside** `</span>`, second half immediately follows — wrong position fails test
    expect(norm(row.find('.k-set-row-desc').text())).toBe('5-10× slower when enabled. Only useful for scanned PDFs.')
  })

  it('🔴 data-on both sides — on device ocr_enabled:false → "false"', async () => {
    const { w } = await mountPage()
    expect(w.find('.k-sw').attributes('data-on')).toBe('false')
  })

  it('🔴 data-on both sides — fixture variant ocr_enabled:true → "true"', async () => {
    const { w } = await mountPage({ ocr_enabled: true })
    expect(w.find('.k-sw').attributes('data-on')).toBe('true')
  })

  it('🔴 `!!` double negation copy verbatim (blueprint :59) — when backend omits `ocr_enabled` field still is "false", not "undefined"', async () => {
    // test criterion: remove `!!` → `String(undefined)` === "undefined" → test fails
    // (`.k-sw[data-on="true"]` is CSS selector, `"undefined"` would get toggle stuck on gray with unclear semantics)
    const { w } = await mountPage({ ocr_enabled: undefined as unknown as boolean })
    expect(w.find('.k-sw').attributes('data-on')).toBe('false')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('SettingsView — four action setControl payloads each (blueprint :282-315)', () => {
  it('paused:true click button → setControl("resume")', async () => {
    const { w } = await mountPage()
    await w.find('.k-svc-state button').trigger('click')
    await flushPromises()
    expect(ai.parserControl).toHaveBeenCalledTimes(1)
    expect(ai.parserControl).toHaveBeenCalledWith({ action: 'resume' })
  })

  it('paused:false click button → setControl("pause")', async () => {
    const { w } = await mountPage({ paused: false })
    await w.find('.k-svc-state button').trigger('click')
    await flushPromises()
    expect(ai.parserControl).toHaveBeenCalledWith({ action: 'pause' })
  })

  it('🔴 concurrency → setControl("set_concurrency", { n }) — key is `n`, not `concurrency`', async () => {
    const { w } = await mountPage()
    await concBtns(w)[2]!.trigger('click')
    await flushPromises()
    expect(ai.parserControl).toHaveBeenCalledWith({ action: 'set_concurrency', n: 4 })
  })

  it('device three levels → setControl("set_device", { device })', async () => {
    const { w } = await mountPage()
    const btns = devBtns(w)
    await btns[0]!.trigger('click')
    await flushPromises()
    expect(ai.parserControl).toHaveBeenLastCalledWith({ action: 'set_device', device: 'auto' })
    await btns[1]!.trigger('click')
    await flushPromises()
    // second button sends `cuda` (not `gpu`) — blueprint :46 @click is setDevice('cuda')
    expect(ai.parserControl).toHaveBeenLastCalledWith({ action: 'set_device', device: 'cuda' })
    await btns[2]!.trigger('click')
    await flushPromises()
    expect(ai.parserControl).toHaveBeenLastCalledWith({ action: 'set_device', device: 'cpu' })
  })

  it('OCR toggle → setControl("set_ocr", { enabled: !current_value }) both sides', async () => {
    const { w } = await mountPage()
    await w.find('.k-sw').trigger('click')
    await flushPromises()
    expect(ai.parserControl).toHaveBeenLastCalledWith({ action: 'set_ocr', enabled: true })

    setActivePinia(createPinia())
    const { w: w2 } = await mountPage({ ocr_enabled: true })
    await w2.find('.k-sw').trigger('click')
    await flushPromises()
    expect(ai.parserControl).toHaveBeenLastCalledWith({ action: 'set_ocr', enabled: false })
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('SettingsView — success toast keys each (blueprint :285/:293/:302/:311)', () => {
  it('🔴 resume → "Resumed" (not "Paused") — see file header "divergence, §2": blueprint both levels inverted here', async () => {
    // key prerequisite: inside `setControl` `await loadOverview()` swaps controlState to **new value**.
    // here make second `parserState` return `paused:false` (backend truly resumed) — blueprint code at this
    // point reads new value false → would toast "Paused"; this repo saves `wasPaused` before await
    // → "Resumed".
    // test criterion: swap `wasPaused` back to blueprint's "read controlState.paused after await" → test fails.
    ai.parserState.mockResolvedValueOnce(STATE).mockResolvedValue({ ...STATE, paused: false })
    const { w, store } = await mountPage()
    const toast = vi.spyOn(store, 'toast')
    await w.find('.k-svc-state button').trigger('click')
    await flushPromises()
    expect(store.controlState.paused).toBe(false) // backend refreshed (prerequisite met)
    expect(toast).toHaveBeenCalledWith('Resumed')
  })

  it('🔴 pause → "Paused" (same as above, reversed)', async () => {
    // 🔴 cannot use `mountPage({ paused: false })`: that parameter internally calls
    // `mockResolvedValue` again, clobbering "second call returns paused:true" that we set here.
    ai.parserState
      .mockResolvedValueOnce({ ...STATE, paused: false })
      .mockResolvedValue({ ...STATE, paused: true })
    const { w, store } = await mountPage()
    const toast = vi.spyOn(store, 'toast')
    await w.find('.k-svc-state button').trigger('click')
    await flushPromises()
    expect(store.controlState.paused).toBe(true)
    expect(toast).toHaveBeenCalledWith('Paused')
  })

  it('concurrency → "Concurrency changed to 4" (`aiKbSetConcurrencySet` with {n})', async () => {
    const { w, store } = await mountPage()
    const toast = vi.spyOn(store, 'toast')
    await concBtns(w)[2]!.trigger('click')
    await flushPromises()
    expect(toast).toHaveBeenCalledWith('Concurrency changed to 4')
  })

  it('device → "Inference device: Auto / CPU / GPU" (label ternary copy verbatim: auto via i18n, other two bare strings)', async () => {
    const { w, store } = await mountPage()
    const toast = vi.spyOn(store, 'toast')
    const btns = devBtns(w)
    await btns[0]!.trigger('click')
    await flushPromises()
    expect(toast).toHaveBeenLastCalledWith('Inference device: Auto')
    await btns[2]!.trigger('click')
    await flushPromises()
    expect(toast).toHaveBeenLastCalledWith('Inference device: CPU')
    await btns[1]!.trigger('click')
    await flushPromises()
    // 🔴 bare `GPU`, **not** `GPU (CUDA)` in deviceLabel — blueprint :301 vs :220 intentionally different
    expect(toast).toHaveBeenLastCalledWith('Inference device: GPU')
  })

  it('OCR → "OCR enabled" / "OCR disabled" both sides', async () => {
    const { w, store } = await mountPage()
    const toast = vi.spyOn(store, 'toast')
    await w.find('.k-sw').trigger('click')
    await flushPromises()
    expect(toast).toHaveBeenLastCalledWith('OCR enabled')

    setActivePinia(createPinia())
    const { w: w2, store: s2 } = await mountPage({ ocr_enabled: true })
    const toast2 = vi.spyOn(s2, 'toast')
    await w2.find('.k-sw').trigger('click')
    await flushPromises()
    expect(toast2).toHaveBeenLastCalledWith('OCR disabled')
  })

  it('toast goes through store.toast(K27) → truly lands in global toast stack (2400ms level, knowledgeStore.ts:311-313)', async () => {
    const { w } = await mountPage()
    await w.find('.k-sw').trigger('click')
    await flushPromises()
    expect(useToast().toasts.map((x) => x.text)).toEqual(['OCR enabled'])
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 K30 (K5 same family) — four catches **do not expose backend text**. Landing criterion is
// **exclusion assertion**: have `parserControl` reject an error with identifiable text, assert
// toast text, global toast stack, whole page DOM three places **do not contain** that text,
// and toast **exactly equals** fixed-key value.
// ⚠️ probe text only appears in this file, **intentionally omitted from `SettingsView.vue` comments**
// (governance §9 clause 9: negation assertion hits comment = false positive, T6 fell for this once).
describe('SettingsView — K30: four catches exclusion assertions (blueprint :287/:295/:304/:313 + e.message)', () => {
  const PROBE = 'PROBE-BACKEND-DETAIL-7c41f9'

  async function failing(state?: Partial<ParserControlState>) {
    const mounted = await mountPage(state)
    ai.parserControl.mockRejectedValue(new Error(PROBE))
    const toast = vi.spyOn(mounted.store, 'toast')
    return { ...mounted, toast }
  }

  function assertNoLeak(w: ReturnType<typeof mount>, toast: { mock: { calls: unknown[][] } }): void {
    const calls = toast.mock.calls.map((c: unknown[]) => String(c[0]))
    expect(calls.join(' | ')).not.toContain(PROBE)
    expect(useToast().toasts.map((x) => x.text).join(' | ')).not.toContain(PROBE)
    expect(w.text()).not.toContain(PROBE)
    expect(w.html()).not.toContain(PROBE)
  }

  it('catch① togglePause → only toast "Operation failed", zero backend text', async () => {
    const { w, toast } = await failing()
    await w.find('.k-svc-state button').trigger('click')
    await flushPromises()
    expect(toast).toHaveBeenCalledTimes(1)
    expect(toast).toHaveBeenCalledWith('Operation failed')
    assertNoLeak(w, toast)
  })

  it('catch② setConcurrency → only toast "Operation failed", zero backend text', async () => {
    const { w, toast } = await failing()
    await concBtns(w)[0]!.trigger('click')
    await flushPromises()
    expect(toast).toHaveBeenCalledTimes(1)
    expect(toast).toHaveBeenCalledWith('Operation failed')
    assertNoLeak(w, toast)
  })

  it('catch③ setDevice → only toast "Switch failed" (dedicated key, not "Operation failed"), zero backend text', async () => {
    const { w, toast } = await failing()
    await devBtns(w)[2]!.trigger('click')
    await flushPromises()
    expect(toast).toHaveBeenCalledTimes(1)
    expect(toast).toHaveBeenCalledWith('Switch failed')
    expect(toast).not.toHaveBeenCalledWith('Operation failed')
    assertNoLeak(w, toast)
  })

  it('catch④ toggleOcr → only toast "Operation failed", zero backend text', async () => {
    const { w, toast } = await failing()
    await w.find('.k-sw').trigger('click')
    await flushPromises()
    expect(toast).toHaveBeenCalledTimes(1)
    expect(toast).toHaveBeenCalledWith('Operation failed')
    assertNoLeak(w, toast)
  })

  it('source side: each catch does not read `e` (zero `e.message` / zero `e.response` / zero `e.detail`)', () => {
    const src: string = readFileSync(SRC_PATH, 'utf8')
    const code = blankComments(src)
    expect(code).not.toMatch(/\.message\b/)
    expect(code).not.toMatch(/\.response\b/)
    expect(code).not.toMatch(/\.detail\b/)
    // all catches are parameterless `catch {` (don't even accept the error object).
    // 🔴 E-23 (T9 forced **count** change, assertion semantics unchanged): T8 had 4 (togglePause /
    // setConcurrency / setDevice / toggleOcr), T9 lower half adds 4 more (created getSettings
    // error-swallow-default / onPick / toggleAutoExtract / applyRoot) → total 8.
    expect((code.match(/\}\s*catch\s*\{/g) || []).length).toBe(8)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('SettingsView — sandbox entry (blueprint :158-166)', () => {
  it('icon / text / secondary line / trailing chev verbatim (N16: 🧪 outside t())', async () => {
    const { w } = await mountPage()
    const link = w.find('a.k-sandbox-link')
    expect(link.exists()).toBe(true)
    const icons = link.findAllComponents(KIcon)
    expect(icons).toHaveLength(2)
    expect(icons[0]!.props('name')).toBe('test')
    expect(icons[0]!.props('size')).toBe(20)
    expect(link.find('.k-sandbox-icon').exists()).toBe(true)
    // ⚠️ `.text()` gets textContent — **no** space between adjacent `<div>`s, don't add one
    expect(norm(link.text())).toBe('🧪 Test sandbox - parse single file, no index write')
    expect(icons[1]!.props('name')).toBe('chev')
    expect(icons[1]!.props('size')).toBe(14)
    expect(icons[1]!.props('color')).toBe('var(--text-tertiary)')
  })

  it('click once → router.push("/ai/parser/test") (blueprint :316-319)', async () => {
    const { w, router } = await mountPage()
    const push = vi.spyOn(router, 'push')
    await w.find('a.k-sandbox-link').trigger('click')
    await flushPromises()
    expect(push).toHaveBeenCalledWith('/ai/parser/test')
    expect(router.currentRoute.value.path).toBe('/ai/parser/test')
  })

  it('`@click.prevent` — bare `<a>` (no href), won\'t trigger browser navigation', async () => {
    const { w } = await mountPage()
    const a = w.find('a.k-sandbox-link')
    expect((a.element as HTMLElement).hasAttribute('href')).toBe(false)
    const ev = new MouseEvent('click', { bubbles: true, cancelable: true })
    ;(a.element as HTMLElement).dispatchEvent(ev)
    expect(ev.defaultPrevented).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('SettingsView — danger zone (blueprint :168-186)', () => {
  it('zone header: ⚠️ title (inline var(--danger)) + "Coming soon" notice', async () => {
    const { w } = await mountPage()
    // 🔴 E-22 (T9 forced **selector** change after inserting notes section, assertion value untouched):
    // `.k-section` now has **two** (notes section first, danger zone second), old
    // `w.find('.k-section .k-section-head')` would hit notes section first. Switch to semantic
    // locator (section with `.k-set-danger` card), no index needed.
    const head = dangerSection(w).find('.k-section-head')
    const title = head.find('.k-section-title')
    expect(title.text()).toBe('⚠️ Danger zone')
    // Vue re-serializes static style attribute, so use toContain to pin token (inline value already
    // var(), no literals)
    expect(title.attributes('style')).toContain('var(--danger)')
    expect(head.find('.k-section-hint').text()).toBe('Coming soon')
  })

  it('🔴 rebuild button hardcoded disabled (blueprint :181, never clickable) + "Coming soon" badge beside it', async () => {
    const { w } = await mountPage()
    const card = w.find('.k-set-card.k-set-danger')
    expect(card.exists()).toBe(true)
    expect(card.find('.k-set-row-title').text()).toBe('Rebuild all indexes Coming soon')
    expect(card.find('.k-set-soon').text()).toBe('Coming soon')
    expect(card.find('.k-set-row-cn').text()).toBe('Rebuild all indexes')
    expect(card.find('.k-set-row-desc').text()).toBe('Discards current index, rescans all files')
    const btn = card.find('button.k-btn.danger')
    expect((btn.element as HTMLButtonElement).disabled).toBe(true)
    expect(btn.findComponent(KIcon).props('name')).toBe('danger')
    expect(btn.text()).toBe('Rebuild…')
  })

  it('clicking it does nothing (governance §13: spec only verifies "is gray + has badge")', async () => {
    const { w, store } = await mountPage()
    const toast = vi.spyOn(store, 'toast')
    await w.find('button.k-btn.danger').trigger('click')
    await flushPromises()
    expect(ai.parserControl).not.toHaveBeenCalled()
    expect(toast).not.toHaveBeenCalled()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 governance §9.2 — rules like "must use key A, forbidden key B, reason: en differs" **show
// zero discrimination in zh-only assertions** (T6 review I-1 proof: swap to forbidden key,
// 47/47 pass). This page hits **4 pairs** of same family:
//   ① N21 #1  aiKbResume           en `Resume`        zh 恢复      ← this page must use
//              aiKbRebuild          en `Rebuild`       zh 恢复      ← forbidden (Vue2 mistranslation)
//   ② N21 #2  aiKbSetSandboxTitle  en `Test Sandbox`  zh 测试沙盒  ← this page must use
//              aiKbPrTestLink       en `Test sandbox`  zh 测试沙盒  ← ParserStatus's
//   ③ 🔴 T8 full table rescan discovery: aiKbDeviceAuto en `Auto` / aiCfgAutoPlaceholder en `auto` (lowercase)
//   ④ 🔴 T8 full table rescan discovery: aiKbSwitchFailed en `Switch failed` / aiCfgToggleFailed en `Toggle failed`
// Rescan method and complete conclusions in T8 report §6 (this page 33 keys × full table 1499 keys,
// zh collisions 15 pairs, of which en-different 4 pairs all land in this assertion group, remainder zero).
// 🔴 locale is global singleton → must restore with try/finally, else pollutes following test cases
// in file.
describe('SettingsView — 🔴 §9.2: en-only strong assertions (zh collisions, only en can discriminate)', () => {
  const localeRef = i18n.global.locale as unknown as { value: string }

  async function mountInEn(state?: Partial<ParserControlState>) {
    const prev = localeRef.value
    localeRef.value = 'en_us'
    try {
      const m = await mountPage(state)
      return { ...m, restore: () => { localeRef.value = prev } }
    } catch (e) {
      localeRef.value = prev
      throw e
    }
  }

  it('① forward: en-only resume button exactly `Resume`; reverse: whole page no `Rebuild` (=en value of aiKbRebuild)', async () => {
    const { w, restore } = await mountInEn()
    try {
      expect(w.find('.k-svc-state button').text()).toBe('Resume')
      expect(w.find('.k-svc-state button').text()).not.toBe('Rebuild')
      // scan whole page too (danger zone's `Rebuild all indexes` is aiKbSetRebuildAll, not bare `Rebuild`)
      expect(w.find('.k-svc-state').text()).not.toContain('Rebuild')
    } finally {
      restore()
    }
  })

  it('① other side: paused:false en-only button exactly `Pause`', async () => {
    const { w, restore } = await mountInEn({ paused: false })
    try {
      expect(w.find('.k-svc-state button').text()).toBe('Pause')
    } finally {
      restore()
    }
  })

  it('② forward: en-only sandbox title exactly `Test Sandbox` (capital S); reverse: not `Test sandbox` (=aiKbPrTestLink)', async () => {
    const { w, restore } = await mountInEn()
    try {
      // `<a>`'s 2nd direct child div is the copy column, its 1st div is title row
      // (its 1st child div is icon)
      const line = w.findAll('a.k-sandbox-link > div')[1]!.findAll('div')[0]!.text()
      expect(line).toBe('🧪 Test Sandbox')
      expect(line).not.toContain('Test sandbox')
      expect(norm(w.find('a.k-sandbox-link').text())).toBe(
        '🧪 Test SandboxParse a single file without touching the index',
      )
    } finally {
      restore()
    }
  })

  it('③ forward: en-only device first level exactly `Auto` (capital A); reverse: not `auto` (=en value of aiCfgAutoPlaceholder)', async () => {
    const { w, restore } = await mountInEn()
    try {
      const first = devBtns(w)[0]!
      expect(first.text()).toBe('Auto')
      expect(first.text()).not.toBe('auto')
      // same-family evidence: two keys zh verbatim identical, en differs only in first letter case
      // → only en locale can discriminate
      expect((zhCn as Record<string, string>).aiCfgAutoPlaceholder).toBe(
        (zhCn as Record<string, string>).aiKbDeviceAuto,
      )
      expect((enUs as Record<string, string>).aiCfgAutoPlaceholder).toBe('auto')
    } finally {
      restore()
    }
  })

  it('④ forward: en-only setDevice failure toast exactly `Switch failed`; reverse: not `Toggle failed` (=aiCfgToggleFailed)', async () => {
    const { w, store, restore } = await mountInEn()
    try {
      ai.parserControl.mockRejectedValue(new Error('boom'))
      const toast = vi.spyOn(store, 'toast')
      await devBtns(w)[2]!.trigger('click')
      await flushPromises()
      expect(toast).toHaveBeenCalledWith('Switch failed')
      expect(toast).not.toHaveBeenCalledWith('Toggle failed')
      expect((zhCn as Record<string, string>).aiCfgToggleFailed).toBe(
        (zhCn as Record<string, string>).aiKbSwitchFailed,
      )
      expect((enUs as Record<string, string>).aiCfgToggleFailed).toBe('Toggle failed')
    } finally {
      restore()
    }
  })

  it('switch back to zh service card is still "Resume" (proves locale restored, no pollution)', async () => {
    const { w } = await mountPage()
    expect(w.find('.k-svc-state button').text()).toBe('Resume')
  })

  // 🔴 ruling A-1 (device "Auto" uses `aiKbDeviceAuto`, doesn't reuse `aiKbOriginAuto`) guard **can only land in
  // source code**: two keys en and zh **both exactly identical** (`Auto` / `自动`) → any render assertion
  // has zero discrimination.
  // ⚠️ assertion must pin "`t()` call shape" not bare substring: this page and comments in this file both
  // say "no reuse of `aiKbOriginAuto`", `not.toContain('aiKbOriginAuto')` would hit comment and
  // **false-positive** (governance §9 clause 9, T6 fell for this).
  // So first `blankComments()` then pin call shape.
  it('🔴 A-1: template uses `t(\'aiKbDeviceAuto\')`, zero `t(\'aiKbOriginAuto\')` calls', () => {
    const src: string = readFileSync(SRC_PATH, 'utf8')
    const code = blankComments(src)
    expect(code).toContain("t('aiKbDeviceAuto')")
    expect(code).not.toMatch(/\bt\(\s*['"]aiKbOriginAuto['"]/)
    const zh = zhCn as Record<string, string>
    const en = enUs as Record<string, string>
    // proof "why must use source code": both locales same value, render can never tell apart
    expect(zh.aiKbDeviceAuto).toBe(zh.aiKbOriginAuto)
    expect(en.aiKbDeviceAuto).toBe(en.aiKbOriginAuto)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// guard gap ③ / ③′ — "template zero bare color".
// 🔴 this file **does not copy** that fragile non-greedy regex (governance §9 gap ③′ explicitly
//   "stop copying"); template zero-bare-color guard on `.vue` side already unified by T8 in
//   `src/ai/styles/knowledgeStyles.test.ts` to **greedy match + coverage self-check**, and scanned
//   each `src/ai/knowledge/**/*.vue` (this file's `SettingsView.vue` is in that list).
//   Here only keep two assertions unique to this file, not duplicating central guard.
describe('SettingsView — zero `<style>` block + whole file zero color literals', () => {
  it('zero `<style>` block (settings page all SCSS moved to knowledge.scss by T2a, this file no style import)', () => {
    const src: string = readFileSync(SRC_PATH, 'utf8')
    expect(src).not.toMatch(/^<style/m)
    expect(src).not.toContain("import '../../styles/")
  })

  it('🔴 whole file (incl. comments, after stripping var()/color-mix()) zero hex / rgb / hsl — stricter than just template scan', () => {
    // file has zero `<style>` block → whole-file scan is **strict superset** of "template zero bare color",
    // needs no `<template>` boundary anchor (gap ③′'s cause is that anchor). governance §6 R5: no
    // color literals in comments either.
    const src: string = readFileSync(SRC_PATH, 'utf8')
    const scrubbed = stripCalls(src, ['var(', 'color-mix('])
    expect(scrubbed).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(scrubbed).not.toMatch(/\b(rgba?|hsla?)\s*\(/)
    expect(scrubbed).not.toMatch(/\b(white|black|red|green|blue|orange|gray|grey)\b/i)
  })
})

// ── utilities (same technique as `knowledgeStyles.test.ts` / `ParserStatus.test.ts`) ──

/**
 * "preserve-lines" comment stripper (governance §9 clause 8): replace comment content with equal
 * spaces, **preserve all newlines** —
 * deleting comments eats newlines too, offsetting reported line numbers by dozens.
 * Covers `<!-- -->` (SFC template/file header) · `/* *\/` (JSDoc) · `//` (line comments).
 */
function blankComments(src: string): string {
  const blank = (m: string) => m.replace(/[^\n]/g, ' ')
  return src
    .replace(/<!--[\s\S]*?-->/g, blank)
    .replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(/(^|[^:'"\\])\/\/[^\n]*/g, (m, p1: string) => p1 + ' '.repeat(m.length - p1.length))
}

/** Scan paired parens char-by-char, strip `var(...)` / `color-mix(...)` segments (supports nested fallback). */
function stripCalls(s: string, prefixes: string[]): string {
  let out = ''
  let i = 0
  while (i < s.length) {
    const hit = prefixes.find((p) => s.startsWith(p, i))
    if (hit) {
      let depth = 0
      let j = i + hit.length - 1
      for (; j < s.length; j++) {
        if (s[j] === '(') depth++
        else if (s[j] === ')') {
          depth--
          if (depth === 0) {
            j++
            break
          }
        }
      }
      i = j
    } else {
      out += s[i]
      i++
    }
  }
  return out
}

// ═══════════════════════════════════════════════════════════════════════════
// ═════════════════ Below is T9 (blueprint lower half: notes section + migration dialog) ═════════════════
// ═══════════════════════════════════════════════════════════════════════════

/**
 * K29 / P5b handoff item #3 — host for `DialogPortal to=".knowledge-app"`.
 * When `SettingsView` mounts standalone, it's not in `.knowledge-app` subtree (production host
 * provided by `KnowledgeLayout.vue`), test must place one same-named host in body itself.
 * 🔴 **`to` only recognizes first host with matching name** → one host per test case; `afterEach`'s
 * `document.body.innerHTML = ''` cleans it up, won't leak to next case.
 * Precedent: `QueueView.test.ts`'s `withHost()`.
 */
function withHost(): HTMLElement {
  const host = document.createElement('div')
  host.className = 'knowledge-app'
  document.body.appendChild(host)
  return host
}

/** Controllable promise — for interleaved paths (same technique as `FolderBrowser.test.ts`). */
function makeDeferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

type DirInfo = { exists: boolean; empty: boolean }

// ── lower-half locator utilities ──
// `.k-set-card` indices: 0 service card / 1 config card / **2 notes card** / 3 danger card.
const notesCard = (w: ReturnType<typeof mount>) => w.findAll('.k-set-card')[2]!
const notesRows = (w: ReturnType<typeof mount>) => notesCard(w).findAll('.k-set-row')
const folderRow = (w: ReturnType<typeof mount>) => notesRows(w)[0]!
const captureRow = (w: ReturnType<typeof mount>) => notesRows(w)[1]!
/** "Change / Cancel" button — when collapsible opens, row has two action buttons inline, it's always **last**. */
const changeBtn = (w: ReturnType<typeof mount>) => {
  const bs = folderRow(w).findAll('button')
  return bs[bs.length - 1]!
}
const adoptBtn = (w: ReturnType<typeof mount>) =>
  folderRow(w).find('.kn-pick-actions button.k-btn.primary')
const moveBtn = (w: ReturnType<typeof mount>) =>
  folderRow(w).find('.kn-pick-actions button.k-btn.outline')
const badge = (w: ReturnType<typeof mount>) => folderRow(w).find('.kn-badge')
const fbRows = (w: ReturnType<typeof mount>) => folderRow(w).findAll('.fb-row')
const captureSw = (w: ReturnType<typeof mount>) => captureRow(w).find('.k-sw')
const isDisabled = (x: { element: Element }) => (x.element as HTMLButtonElement).disabled

/** Click "Change" to expand collapsible (waits for `loadCandidates` and `fb.reset()` in `nextTick` to land). */
async function openPicker(w: ReturnType<typeof mount>): Promise<void> {
  await changeBtn(w).trigger('click')
  await flushPromises()
  await nextTick()
}

/** Click volume `idx` at `FolderBrowser` root → trigger `@pick` (real DOM path, not manual emit). */
async function pickRoot(w: ReturnType<typeof mount>, idx = 0): Promise<void> {
  await fbRows(w)[idx]!.trigger('click')
  await flushPromises()
}

/** Return to `FolderBrowser` root (click first breadcrumb, `go('')` doesn't emit pick or issue request). */
async function backToRoot(w: ReturnType<typeof mount>): Promise<void> {
  await folderRow(w).findAll('.fb-crumb')[0]!.trigger('click')
  await flushPromises()
}

/** Check the migration acknowledgement checkbox (`v-model` listens to change). */
async function tickAck(host: HTMLElement): Promise<void> {
  const check = host.querySelector('.kn-checkline input') as HTMLInputElement
  check.checked = true
  check.dispatchEvent(new Event('change'))
  await nextTick()
}

const dangerFootBtn = (host: HTMLElement) =>
  host.querySelector('.k-modal-foot button.k-btn.danger') as HTMLButtonElement

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 governance §4.1 — guard for mock **layer** (review "gap hunt ①", 5th time this period
// "product code correct, guard zero"). Review probe: give `notes.getSettings` mock **extra**
// `distill_roots` / `distill_daily_cap` / `background_model` → **112/112 pass**. The half about
// "camelCase and **exactly two fields**" was only guarded by `p5c-task-9-fixture-verify.mjs` in
// ledger **not entering three gates** → whoever turns fixture copy into raw HTTP snake_case or
// casually adds fields, three gates miss it. Here pin key set to equality assertion.
describe('SettingsView/T9 — §4.1: fixture copy mock layer (key set equality)', () => {
  it('🔴 notes two copies are **after layer reduction** shape: key set exactly equal, not one more or less', () => {
    // `service.notes.getSettings/putSettings` package-internal goes through `normalizeSettings`
    // (`NimoOS-Service/src/notes.ts:131-137`) → **camelCase with exactly these two keys**;
    // the three HTTP-layer `distill_roots` / `distill_daily_cap` / `background_model` are discarded.
    expect(Object.keys(NOTES_SETTINGS)).toEqual(['notesRoot', 'autoExtract'])
    // `dirInfo` (`notes.ts:264-267`) only does `!!` normalization, keys/layer unchanged.
    expect(Object.keys(DIR_INFO_NOTES)).toEqual(['exists', 'empty'])
    // reverse: not one snake_case in the copy (writing as raw HTTP is wrong layer)
    for (const k of [...Object.keys(NOTES_SETTINGS), ...Object.keys(DIR_INFO_NOTES)]) {
      expect(k).not.toContain('_')
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('SettingsView/T9 — notes section static render (blueprint :63-102)', () => {
  it('section header: 📝 title + hint (N16: emoji outside t())', async () => {
    const { w } = await mountPage()
    // notes section is first `.k-section` (danger zone after sandbox entry)
    const sec = w.findAll('.k-section')[0]!
    expect(sec.find('.k-section-title').text()).toBe('📝 Knowledge notes')
    expect(sec.find('.k-section-hint').text()).toBe('notes = Markdown files on disk')
    // reverse: the key itself **does not include** emoji (no symbols moved into t())
    const zh = zhCn as Record<string, string>
    expect(zh.aiKbSetNotesSection).toBe('知识笔记')
    expect(zh.aiKbSetNotesSection).not.toMatch(/[📝⏸✅🧪⚠]/u)
  })

  it('notes directory row: title / Chinese / description + <code> showing fixture notesRoot', async () => {
    const { w } = await mountPage()
    const row = folderRow(w)
    expect(row.find('.k-set-row-title').text()).toBe('Notes directory')
    expect(row.find('.k-set-row-cn').text()).toBe('Location for note Markdown files')
    expect(row.find('.k-set-row-desc code').text()).toBe('/DATA/Notes')
    // em-dash and second half position copy verbatim blueprint :77
    expect(norm(row.find('.k-set-row-desc').text())).toBe(
      '/DATA/Notes — one subdirectory per user; files are pure Markdown.',
    )
    // collapsible default closed → no FolderBrowser, no two action buttons
    expect(row.find('.fb').exists()).toBe(false)
    expect(row.find('.kn-pick-actions').exists()).toBe(false)
    expect(changeBtn(w).classes()).toEqual(['k-btn', 'outline'])
    expect(changeBtn(w).text()).toBe('Change')
  })

  it('🔴 N7 same family: notesRoot empty string uses `|| "/DATA/Notes"` fallback (not render empty)', async () => {
    // test criterion: remove `|| '/DATA/Notes'` → <code> becomes empty → test fails
    notes.getSettings.mockResolvedValue({ notesRoot: '', autoExtract: true })
    const { w } = await mountPage()
    await flushPromises()
    expect(folderRow(w).find('.k-set-row-desc code').text()).toBe('/DATA/Notes')
  })

  it('🔴 created catch swallows error, keeps defaults: page still renders when getSettings rejects + uses fallback', async () => {
    // blueprint `:229` `catch (e) { /* keep defaults */ }`. test criterion: change to toast/throw → test fails.
    notes.getSettings.mockRejectedValue(new Error('boom'))
    const { w, store } = await mountPage()
    const toast = vi.spyOn(store, 'toast')
    await flushPromises()
    expect(folderRow(w).find('.k-set-row-desc code').text()).toBe('/DATA/Notes')
    expect(captureSw(w).attributes('data-on')).toBe('true') // default autoExtract: true
    expect(toast).not.toHaveBeenCalled()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('SettingsView/T9 — auto-capture row two states (blueprint :104-116)', () => {
  it('title / Chinese / description verbatim; on device auto_extract:true → toggle green, `.warn` line **not rendered**', async () => {
    const { w } = await mountPage()
    const row = captureRow(w)
    expect(row.find('.k-set-row-title').text()).toBe('Auto-capture conversation insights')
    expect(row.find('.k-set-row-cn').text()).toBe('Auto-capture insights into notes')
    expect(norm(row.find('.k-set-row-desc').text())).toBe(
      'After session idle, conclusions worth saving auto-save as "AI draft" notes, await your confirmation.',
    )
    expect(captureSw(w).attributes('data-on')).toBe('true')
    // governance §13: doesn't render on device data, is **correct behavior**
    expect(row.find('.k-set-row-desc .warn').exists()).toBe(false)
  })

  it('autoExtract:false → toggle off + `.warn` hint line renders (with danger icon and text)', async () => {
    notes.getSettings.mockResolvedValue({ notesRoot: '/DATA/Notes', autoExtract: false })
    const { w } = await mountPage()
    await flushPromises()
    expect(captureSw(w).attributes('data-on')).toBe('false')
    const warn = captureRow(w).find('.k-set-row-desc .warn')
    expect(warn.exists()).toBe(true)
    expect(warn.findComponent(KIcon).props('name')).toBe('danger')
    expect(warn.findComponent(KIcon).props('size')).toBe(11)
    expect(norm(warn.text())).toBe('Disabled — queued drafts will also be discarded')
  })

  it('🔴 `!!` double negation copy verbatim (blueprint :115) — autoExtract missing is "false", not "undefined"', async () => {
    // test criterion: remove `!!` → `String(undefined)` === "undefined" → test fails.
    notes.getSettings.mockResolvedValue({
      notesRoot: '/DATA/Notes',
      autoExtract: undefined,
    } as unknown as NotesSettings)
    const { w } = await mountPage()
    await flushPromises()
    expect(captureSw(w).attributes('data-on')).toBe('false')
  })

  it('autoExtract true toggle green and `.warn` line not rendered (blueprint data() default side)', async () => {
    // 🔴 **this case only asserts component-level semantics, no longer asserts "normalization"** (review I-1:
    //   original case name "backend omits `auto_extract` → package `r.auto_extract !== false` normalizes to true"
    //   **zero discrimination** — mock hits **package boundary**, `normalizeSettings` doesn't enter loop, this case
    //   and previous have identical pass/fail behavior).
    //   that invariant **belongs to upstream guard**: `NimoOS-Service/src/notes.test.ts:198-203`; review mutation test
    //   "modify Service `normalizeSettings` → New-UI 112/112 pass, upstream fails".
    //   this repo literally can't supplement it: `normalizeSettings` not exported from package index.
    //   → component side can only verify "receives `true` renders open", this case just asserts that.
    notes.getSettings.mockResolvedValue({ notesRoot: '/DATA/Notes', autoExtract: true })
    const { w } = await mountPage()
    await flushPromises()
    expect(captureSw(w).attributes('data-on')).toBe('true')
    expect(captureRow(w).find('.warn').exists()).toBe(false)
  })

  it('click toggle → putSettings({ autoExtract: false }) (payload one field only) + toast "Auto-capture disabled" + toggle flips', async () => {
    notes.putSettings.mockResolvedValue({ notesRoot: '/DATA/Notes', autoExtract: false })
    const { w, store } = await mountPage()
    await flushPromises()
    const toast = vi.spyOn(store, 'toast')
    await captureSw(w).trigger('click')
    await flushPromises()
    expect(notes.putSettings).toHaveBeenCalledTimes(1)
    expect(notes.putSettings).toHaveBeenCalledWith({ autoExtract: false })
    expect(toast).toHaveBeenCalledWith('Auto-capture disabled')
    expect(captureSw(w).attributes('data-on')).toBe('false')
    expect(captureRow(w).find('.warn').exists()).toBe(true)
  })

  it('reverse: autoExtract:false click toggle → putSettings({ autoExtract: true }) + toast "Auto-capture enabled"', async () => {
    notes.getSettings.mockResolvedValue({ notesRoot: '/DATA/Notes', autoExtract: false })
    notes.putSettings.mockResolvedValue({ notesRoot: '/DATA/Notes', autoExtract: true })
    const { w, store } = await mountPage()
    await flushPromises()
    const toast = vi.spyOn(store, 'toast')
    await captureSw(w).trigger('click')
    await flushPromises()
    expect(notes.putSettings).toHaveBeenCalledWith({ autoExtract: true })
    expect(toast).toHaveBeenCalledWith('Auto-capture enabled')
    expect(captureSw(w).attributes('data-on')).toBe('true')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('SettingsView/T9 — openRootPicker (blueprint :232-240, continues Vue2 existing two behaviors)', () => {
  it('click "Change" to expand: button becomes ghost + text changes to "Cancel", FolderBrowser appears, loadCandidates called', async () => {
    const { w } = await mountPage()
    expect(wiki.getCandidates).not.toHaveBeenCalled()
    await openPicker(w)
    expect(changeBtn(w).classes()).toEqual(['k-btn', 'ghost'])
    expect(changeBtn(w).text()).toBe('Cancel')
    expect(folderRow(w).find('.fb').exists()).toBe(true)
    // ⚠️ handoff item #7: `loadCandidates()` **no silent parameter** (blueprint also no params)
    expect(wiki.getCandidates).toHaveBeenCalledTimes(1)
    expect(wiki.getCandidates).toHaveBeenCalledWith()
  })

  it('on device wiki/candidates = [] → root level uses pickerRoots three fallback roots (K1: store.wikiCandidates)', async () => {
    const { w } = await mountPage()
    await openPicker(w)
    expect(fbRows(w).map((r) => r.find('.fb-name').text())).toEqual([
      'System (/DATA)',
      '/media',
      '/mnt',
    ])
  })

  it('when candidates non-empty root level uses candidates (proves browserRoots truly reads store.wikiCandidates)', async () => {
    wiki.getCandidates.mockResolvedValue([
      { path: '/mnt/pool', type: 'volume', label: 'Pool' },
      { path: '/mnt/bare', type: 'volume' },
    ])
    const { w } = await mountPage()
    await openPicker(w)
    // second item no label → FolderBrowser template `r.label || r.path` fallback
    expect(fbRows(w).map((r) => r.find('.fb-name').text())).toEqual(['Pool', '/mnt/bare'])
  })

  it('click once more to close (continues Vue2 spec "clicking again doesn\'t error")', async () => {
    const { w } = await mountPage()
    await openPicker(w)
    await changeBtn(w).trigger('click')
    await flushPromises()
    expect(folderRow(w).find('.fb').exists()).toBe(false)
    expect(changeBtn(w).text()).toBe('Change')
    // closing **doesn't** fetch candidates again (blueprint if only in open branch)
    expect(wiki.getCandidates).toHaveBeenCalledTimes(1)
  })

  it('🔴 continue Vue2 spec "reopen clears previous path" — also clears previous dirProbe badge', async () => {
    const { w } = await mountPage()
    await openPicker(w)
    await pickRoot(w, 0)
    expect(folderRow(w).find('.kn-picked code').text()).toBe('/DATA')
    expect(badge(w).exists()).toBe(true)
    // close → reopen
    await changeBtn(w).trigger('click')
    await flushPromises()
    await openPicker(w)
    // test criterion: remove `rootPicker.path = ''` → .kn-picked still there → test fails;
    //                 remove `dirProbe = { state: '', … }` → badge still there → also fails
    expect(folderRow(w).find('.kn-picked').exists()).toBe(false)
    expect(badge(w).exists()).toBe(false)
    expect(wiki.getCandidates).toHaveBeenCalledTimes(2)
  })

  it('🔴 on expand next frame calls FolderBrowser reset() (blueprint :238 `$nextTick` + `$refs.fb` guard)', async () => {
    // only this case swaps FolderBrowser for stub — it's the only one needing to observe
    // `fb.value.reset()` being called; rest always use **real** FolderBrowser (pick path uses real component).
    const resetSpy = vi.fn()
    const router = makeRouter()
    await router.isReady()
    const store = useKnowledgeStore()
    await store.loadOverview()
    const w = mount(SettingsView, {
      global: {
        plugins: [router, i18n],
        stubs: {
          FolderBrowser: {
            name: 'FolderBrowser',
            template: '<div class="fb fb-stubbed" />',
            methods: { reset: resetSpy },
          },
        },
      },
    } as never)
    mountedWrappers.push(w)
    await nextTick()
    await flushPromises()
    expect(resetSpy).not.toHaveBeenCalled()
    await changeBtn(w).trigger('click')
    await nextTick()
    await flushPromises()
    expect(w.find('.fb-stubbed').exists()).toBe(true)
    expect(resetSpy).toHaveBeenCalledTimes(1)
    // closing **doesn't** call reset (blueprint if only in open branch)
    await changeBtn(w).trigger('click')
    await nextTick()
    await flushPromises()
    expect(resetSpy).toHaveBeenCalledTimes(1)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('SettingsView/T9 — dirProbe four-state badge + migratable three-combination logic (blueprint :83-85 / :248)', () => {
  it('① loading — [data-s="archived"] "Checking..." (probe in flight)', async () => {
    const d = makeDeferred<DirInfo>()
    notes.dirInfo.mockReturnValue(d.promise)
    const { w } = await mountPage()
    await openPicker(w)
    await pickRoot(w, 0)
    expect(badge(w).attributes('data-s')).toBe('archived')
    expect(badge(w).text()).toBe('Checking...')
    d.resolve({ exists: false, empty: false })
    await flushPromises()
  })

  it('② done + migratable (directory **does not exist**) — [data-s="curated"] "Empty directory · migratable"', async () => {
    notes.dirInfo.mockResolvedValue({ exists: false, empty: false })
    const { w } = await mountPage()
    await openPicker(w)
    await pickRoot(w, 0)
    expect(badge(w).attributes('data-s')).toBe('curated')
    expect(badge(w).text()).toBe('Empty directory · migratable')
  })

  it('② done + migratable (directory **exists and empty**) — same level', async () => {
    notes.dirInfo.mockResolvedValue({ exists: true, empty: true })
    const { w } = await mountPage()
    await openPicker(w)
    await pickRoot(w, 0)
    expect(badge(w).attributes('data-s')).toBe('curated')
  })

  it('③ done + !migratable (on device /DATA/Notes fixture: exists and not empty) — [data-s="draft"] "Non-empty directory — pointer only"', async () => {
    notes.dirInfo.mockResolvedValue(DIR_INFO_NOTES)
    const { w } = await mountPage()
    await openPicker(w)
    await pickRoot(w, 0)
    expect(badge(w).attributes('data-s')).toBe('draft')
    expect(badge(w).text()).toBe('Non-empty directory — pointer only')
  })

  it('🔴 migratable criterion is `!exists || empty` (**or**, not and) — swap to && both sides collapse to draft', async () => {
    // discrimination explanation: under `!exists && empty` {exists:false,empty:false} → false → draft;
    // {exists:true,empty:true} also → false → draft. This case puts both sides together as regression anchor.
    notes.dirInfo.mockResolvedValueOnce({ exists: false, empty: false })
    const { w } = await mountPage()
    await openPicker(w)
    await pickRoot(w, 0)
    expect(badge(w).attributes('data-s')).toBe('curated')

    notes.dirInfo.mockResolvedValue({ exists: true, empty: true })
    await backToRoot(w)
    await pickRoot(w, 1)
    expect(badge(w).attributes('data-s')).toBe('curated')
  })

  it('🔴 ④ error — **all three badges absent** (blueprint has no fourth branch), but `.kn-picked` remains', async () => {
    notes.dirInfo.mockRejectedValue(new Error('boom'))
    const { w } = await mountPage()
    await openPicker(w)
    await pickRoot(w, 0)
    expect(folderRow(w).find('.kn-picked').exists()).toBe(true)
    expect(folderRow(w).find('.kn-picked code').text()).toBe('/DATA')
    expect(badge(w).exists()).toBe(false)
  })

  it('"Selected:" prefix and <code> position verbatim (blueprint :82, colon is bare ASCII in template)', async () => {
    notes.dirInfo.mockResolvedValue({ exists: true, empty: true })
    const { w } = await mountPage()
    await openPicker(w)
    await pickRoot(w, 0)
    // ⚠️ **no space** between `</code>` and badge `<span>`: adjacent across lines in template, Vue's
    //   `whitespace: 'condense'` (default) entirely removes "whitespace nodes containing only newlines".
    //   Blueprint `:82-83` same cross-line adjacency, same compilation stance → render verbatim, don't add space.
    expect(norm(folderRow(w).find('.kn-picked').text())).toBe('Selected: /DATAEmpty directory · migratable')
    // **one space** after colon (that's bare ASCII space in template `}}: <code>`, not newline)
    expect(folderRow(w).find('.kn-picked').text()).toContain('Selected: ')
  })

  it('.kn-pick-note long note verbatim (with Chinese quotes)', async () => {
    const { w } = await mountPage()
    await openPicker(w)
    expect(folderRow(w).find('.kn-pick-note').text()).toBe(
      '"Point to" does not move files, directly adopts existing .md in directory; "migrate" moves existing note files there (target must be empty).',
    )
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 governance §5.2 + §9.1 — two stale guards for `onPick`.
describe('SettingsView/T9 — onPick stale guards (blueprint :241-253, two guards)', () => {
  it('🔴 interleaved path: click A then B, **A response arrives late** → dirProbe is B result (success branch guard)', async () => {
    const dA = makeDeferred<DirInfo>()
    const dB = makeDeferred<DirInfo>()
    notes.dirInfo.mockImplementation((p: string) => (p === '/DATA' ? dA.promise : dB.promise))
    const { w } = await mountPage()
    await openPicker(w)
    await pickRoot(w, 0) // A = /DATA (probe in flight)
    await backToRoot(w)
    await pickRoot(w, 1) // B = /media (probe in flight)
    expect(notes.dirInfo.mock.calls.map((c: unknown[]) => c[0])).toEqual(['/DATA', '/media'])
    expect(folderRow(w).find('.kn-picked code').text()).toBe('/media')

    // later call (B) returns first -> lands
    dB.resolve({ exists: true, empty: true })
    await flushPromises()
    expect(badge(w).attributes('data-s')).toBe('curated')

    // earlier call (A) returns later -> 🔴 must be blocked by the guard, must not overwrite B's curated with draft
    // criterion: drop the success branch's `if (rootPicker.path !== path) return` -> turns into draft -> test goes red
    dA.resolve({ exists: true, empty: false })
    await flushPromises()
    expect(badge(w).attributes('data-s')).toBe('curated')
    expect(folderRow(w).find('.kn-picked code').text()).toBe('/media')
  })

  it('🔴 interleaved path · catch side: A response late and **fails** → don\'t erase B\'s success badge into error (catch guard)', async () => {
    const dA = makeDeferred<DirInfo>()
    const dB = makeDeferred<DirInfo>()
    notes.dirInfo.mockImplementation((p: string) => (p === '/DATA' ? dA.promise : dB.promise))
    const { w } = await mountPage()
    await openPicker(w)
    await pickRoot(w, 0)
    await backToRoot(w)
    await pickRoot(w, 1)
    dB.resolve({ exists: false, empty: false })
    await flushPromises()
    expect(badge(w).attributes('data-s')).toBe('curated')
    // test criterion: remove `if (rootPicker.path === path)` from catch → badge disappears entirely → test fails
    dA.reject(new Error('late failure'))
    await flushPromises()
    expect(badge(w).exists()).toBe(true)
    expect(badge(w).attributes('data-s')).toBe('curated')
  })

  it('same path failure **must** land in error level (guard is "stale-only", not "all-blocking")', async () => {
    notes.dirInfo.mockRejectedValue(new Error('boom'))
    const { w } = await mountPage()
    await openPicker(w)
    await pickRoot(w, 0)
    expect(badge(w).exists()).toBe(false) // error level all three badges absent
    // and "move files" **still clickable** under error level (second disabled condition requires state === 'done')
    expect(isDisabled(moveBtn(w))).toBe(false)
  })

  it('🔴 §9.1 — **two instances interleaved**: each gets own result, no overlap (guard var must be component-local)', async () => {
    // test criterion: move `rootPicker` to module level (open new `<script>` block) → two instances get crossed →
    // both sides render same path → test fails.
    const dA = makeDeferred<DirInfo>()
    const dB = makeDeferred<DirInfo>()
    notes.dirInfo.mockImplementation((p: string) => (p === '/DATA' ? dA.promise : dB.promise))
    const { w: w1 } = await mountPage()
    const { w: w2 } = await mountPage()
    await openPicker(w1)
    await openPicker(w2)
    await pickRoot(w1, 0) // instance 1 selects /DATA
    await pickRoot(w2, 1) // instance 2 selects /media

    // interleaved return: instance 2 returns first, instance 1 returns later
    dB.resolve({ exists: true, empty: true })
    await flushPromises()
    dA.resolve({ exists: true, empty: false })
    await flushPromises()

    expect(folderRow(w1).find('.kn-picked code').text()).toBe('/DATA')
    expect(folderRow(w2).find('.kn-picked code').text()).toBe('/media')
    expect(badge(w1).attributes('data-s')).toBe('draft') // /DATA not empty
    expect(badge(w2).attributes('data-s')).toBe('curated') // /media empty
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('SettingsView/T9 — two action buttons disabled (blueprint :88 / :91)', () => {
  it('no path selected → **both gray** ("point to" only condition / "move files" first condition)', async () => {
    const { w } = await mountPage()
    await openPicker(w)
    expect(adoptBtn(w).exists()).toBe(true)
    expect(isDisabled(adoptBtn(w))).toBe(true)
    expect(isDisabled(moveBtn(w))).toBe(true)
  })

  it('path selected + probe done + **migratable** → both clickable', async () => {
    notes.dirInfo.mockResolvedValue({ exists: true, empty: true })
    const { w } = await mountPage()
    await openPicker(w)
    await pickRoot(w, 0)
    expect(isDisabled(adoptBtn(w))).toBe(false)
    expect(isDisabled(moveBtn(w))).toBe(false)
  })

  it('🔴 path selected + probe done + **not migratable** (on device /DATA/Notes level) → "point to" clickable, "move files" gray', async () => {
    // test criterion: remove second disabled condition → "move files" becomes clickable → test fails
    notes.dirInfo.mockResolvedValue(DIR_INFO_NOTES)
    const { w } = await mountPage()
    await openPicker(w)
    await pickRoot(w, 0)
    expect(isDisabled(adoptBtn(w))).toBe(false)
    expect(isDisabled(moveBtn(w))).toBe(true)
  })

  it('path selected + probe still loading → "move files" **clickable** (second condition requires state === "done")', async () => {
    const d = makeDeferred<DirInfo>()
    notes.dirInfo.mockReturnValue(d.promise)
    const { w } = await mountPage()
    await openPicker(w)
    await pickRoot(w, 0)
    expect(badge(w).attributes('data-s')).toBe('archived')
    expect(isDisabled(moveBtn(w))).toBe(false)
    d.resolve({ exists: true, empty: true })
    await flushPromises()
  })

  it('two buttons icon / text verbatim (blueprint :89 / :93)', async () => {
    const { w } = await mountPage()
    await openPicker(w)
    expect(adoptBtn(w).findComponent(KIcon).props('name')).toBe('folder')
    expect(adoptBtn(w).findComponent(KIcon).props('size')).toBe(12)
    expect(adoptBtn(w).text()).toBe('Point to existing directory')
    expect(moveBtn(w).findComponent(KIcon).props('name')).toBe('upload')
    expect(moveBtn(w).findComponent(KIcon).props('size')).toBe(12)
    expect(moveBtn(w).text()).toBe('Migrate files to new directory…')
  })

  it('🔴 click "move files" only opens dialog, **no requests** (blueprint :92 is just `migrating = true`)', async () => {
    withHost()
    notes.dirInfo.mockResolvedValue({ exists: true, empty: true })
    const { w } = await mountPage()
    await openPicker(w)
    await pickRoot(w, 0)
    await moveBtn(w).trigger('click')
    await flushPromises()
    expect(notes.putSettings).not.toHaveBeenCalled()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 K29 — migration confirmation dialog becomes reka primitives (blueprint :120-156 is bare .k-modal-bg + @click).
// portal target `.knowledge-app` only recognizes first same-named host → each case calls `withHost()` first.
describe('SettingsView/T9 — K29: reka migration confirmation dialog', () => {
  /** Open collapsible, select directory, click "move files" → dialog opens. */
  async function openModal(dirInfo: DirInfo = { exists: true, empty: true }) {
    const host = withHost()
    notes.dirInfo.mockResolvedValue(dirInfo)
    const m = await mountPage()
    await flushPromises()
    await openPicker(m.w)
    await pickRoot(m.w, 0)
    await moveBtn(m.w).trigger('click')
    await nextTick()
    await flushPromises()
    return { ...m, host }
  }

  it('default not rendered; after clicking "move files" portals to .knowledge-app, head/body/foot content verbatim', async () => {
    const host = withHost()
    notes.dirInfo.mockResolvedValue({ exists: true, empty: true })
    const { w } = await mountPage()
    await flushPromises()
    await openPicker(w)
    await pickRoot(w, 0)
    expect(host.querySelector('.k-modal')).toBeNull()

    await moveBtn(w).trigger('click')
    await nextTick()
    await flushPromises()
    const modal = host.querySelector('.k-modal')
    expect(modal).not.toBeNull()
    // overlay class copy verbatim blueprint :121
    expect(host.querySelector('.k-modal-bg')).not.toBeNull()
    // head: title + × button
    expect(modal!.querySelector('.k-modal-head .k-modal-title')!.textContent).toBe('Migrate notes file?')
    expect(modal!.querySelector('.k-modal-head button.k-modal-x')).not.toBeNull()
    const titleEl = modal!.querySelector('.k-modal-title') as HTMLElement
    expect(titleEl.id).toBe(modal!.getAttribute('aria-labelledby'))
    expect(modal!.querySelectorAll('[id]')).toHaveLength(1)
    // body: old path → new path
    const path = modal!.querySelector('.kn-mig-path')!
    expect(path.querySelector('span')!.textContent).toBe('/DATA/Notes')
    expect(path.querySelector('b')!.textContent).toBe('/DATA')
    // body: three requirements
    const lis = Array.from(modal!.querySelectorAll('.kn-mig-req li'))
    expect(lis).toHaveLength(3)
    expect(norm(lis[0]!.textContent!)).toBe('Target directory must be empty — non-empty directory backend will reject.')
    expect(norm(lis[1]!.textContent!)).toBe('Files are moved (not copied), original directory becomes empty afterwards.')
    expect(norm(lis[2]!.textContent!)).toBe('During migration notes temporarily read-only, usually completes in seconds.')
    // body: acknowledgement line
    const check = modal!.querySelector('.kn-checkline input') as HTMLInputElement
    expect(check.type).toBe('checkbox')
    expect(norm(modal!.querySelector('.kn-checkline')!.textContent!)).toBe(
      'I understand this moves disk files',
    )
    // foot: cancel + danger start migration
    const footBtns = Array.from(modal!.querySelectorAll('.k-modal-foot button'))
    expect(footBtns.map((b) => norm(b.textContent!))).toEqual(['Cancel', 'Start migration'])
    expect(footBtns[0]!.className).toBe('k-btn ghost')
    expect(footBtns[1]!.className).toBe('k-btn danger')
  })

  it('🔴 N7 same family second place: notesRoot empty string also uses `|| "/DATA/Notes"` fallback in dialog old path (blueprint :129)', async () => {
    // first version missed this — probe P10b (removed only dialog fallback) 111/111 all pass, **zero discrimination**.
    // blueprint has same fallback in **two places** (:77 directory row + :129 dialog old path), both need test case.
    notes.getSettings.mockResolvedValue({ notesRoot: '', autoExtract: true })
    const { host } = await openModal()
    expect(host.querySelector('.kn-mig-path span')!.textContent).toBe('/DATA/Notes')
  })

  it('KIcons in dialog each: × is x/13 · arrow arrowRight/13/var(--warning) · bottom upload/12', async () => {
    const { w } = await openModal()
    const icons = w.findAllComponents(KIcon)
    const head = icons.find((i) => i.props('name') === 'x')!
    expect(head.props('size')).toBe(13)
    const arrow = icons.find((i) => i.props('name') === 'arrowRight')!
    expect(arrow.props('size')).toBe(13)
    expect(arrow.props('color')).toBe('var(--warning)')
    // upload two (collapsible button + dialog bottom), both size 12
    const uploads = icons.filter((i) => i.props('name') === 'upload')
    expect(uploads).toHaveLength(2)
    expect(uploads.map((i) => i.props('size'))).toEqual([12, 12])
  })

  it('🔴 first <li> ternary :color — migratable side three checks all var(--success), no red <b>', async () => {
    const { w, host } = await openModal({ exists: true, empty: true })
    const checks = w.findAllComponents(KIcon).filter((i) => i.props('name') === 'check')
    expect(checks).toHaveLength(3)
    expect(checks.map((i) => i.props('size'))).toEqual([13, 13, 13])
    expect(checks.map((i) => i.props('color'))).toEqual([
      'var(--success)',
      'var(--success)',
      'var(--success)',
    ])
    expect(host.querySelector('.kn-mig-req li b')).toBeNull()
  })

  it('🔴 ternary other side — target non-empty first check becomes var(--danger) + renders red <b> addendum', async () => {
    // 🔴 this level must bypass "move files" button (gray when non-empty) — first open dialog on **migratable**
    // directory, then swap probe to non-empty, re-pick (dialog already open, `migrating` unaffected by pick).
    const { w, host } = await openModal({ exists: true, empty: true })
    expect(host.querySelector('.kn-mig-req li b')).toBeNull()
    notes.dirInfo.mockResolvedValue(DIR_INFO_NOTES)
    await backToRoot(w)
    await pickRoot(w, 1)
    await nextTick()
    const checks = w.findAllComponents(KIcon).filter((i) => i.props('name') === 'check')
    expect(checks.map((i) => i.props('color'))).toEqual([
      'var(--danger)',
      'var(--success)',
      'var(--success)',
    ])
    const b = host.querySelector('.kn-mig-req li b')
    expect(b).not.toBeNull()
    expect(b!.textContent).toBe('Currently selected directory not empty.')
    expect(b!.getAttribute('style')).toContain('var(--danger)')
  })

  it('🔴 migrateAck gates danger button both sides: unchecked → gray; checked → clickable', async () => {
    const { host } = await openModal()
    expect(dangerFootBtn(host).disabled).toBe(true)
    await tickAck(host)
    expect(dangerFootBtn(host).disabled).toBe(false)
  })

  it('click × close dialog and no request', async () => {
    const { host } = await openModal()
    await tickAck(host)
    ;(host.querySelector('.k-modal-x') as HTMLElement).click()
    await nextTick()
    await flushPromises()
    expect(host.querySelector('.k-modal')).toBeNull()
    expect(notes.putSettings).not.toHaveBeenCalled()
  })

  it('🔴 closeMigrate clears migrateAck: close then reopen, checkbox **unchecked**, danger button back to gray', async () => {
    // test criterion: `closeMigrate` only clears `migrating` not `migrateAck` → danger directly clickable after reopen → test fails
    const { w, host } = await openModal()
    await tickAck(host)
    expect(dangerFootBtn(host).disabled).toBe(false)
    ;(host.querySelector('.k-modal-x') as HTMLElement).click()
    await nextTick()
    await flushPromises()
    // reopen
    await moveBtn(w).trigger('click')
    await nextTick()
    await flushPromises()
    expect((host.querySelector('.kn-checkline input') as HTMLInputElement).checked).toBe(false)
    expect(dangerFootBtn(host).disabled).toBe(true)
  })

  it('click "Cancel" close and no request', async () => {
    const { host } = await openModal()
    const cancel = Array.from(host.querySelectorAll('.k-modal-foot button')).find(
      (b) => norm(b.textContent!) === 'Cancel',
    ) as HTMLElement
    cancel.click()
    await nextTick()
    await flushPromises()
    expect(host.querySelector('.k-modal')).toBeNull()
    expect(notes.putSettings).not.toHaveBeenCalled()
  })

  it('click overlay (outside dialog) close; click inside dialog no close (reka pointerDownOutside equivalent blueprint @click/@click.stop)', async () => {
    const { host } = await openModal()
    // reka's usePointerDownOutside delays with setTimeout(0) to attach document listener (see
    // node_modules/reka-ui/dist/DismissableLayer/utils.js header) — add real macrotask tick.
    await new Promise((resolve) => setTimeout(resolve, 0))
    ;(host.querySelector('.k-modal-title') as HTMLElement).dispatchEvent(
      new Event('pointerdown', { bubbles: true }),
    )
    await nextTick()
    expect(host.querySelector('.k-modal')).not.toBeNull()
    ;(host.querySelector('.k-modal-bg') as HTMLElement).dispatchEvent(
      new Event('pointerdown', { bubbles: true }),
    )
    await nextTick()
    await flushPromises()
    expect(host.querySelector('.k-modal')).toBeNull()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('SettingsView/T9 — applyRoot two modes + doMigrate close-then-send (blueprint :267-281)', () => {
  it('"Point to" → putSettings({ notesRoot, mode: "adopt" }), close collapsible, toast "Notes directory updated"', async () => {
    notes.dirInfo.mockResolvedValue(DIR_INFO_NOTES)
    notes.putSettings.mockResolvedValue({ notesRoot: '/DATA', autoExtract: true })
    const { w, store } = await mountPage()
    await flushPromises()
    const toast = vi.spyOn(store, 'toast')
    await openPicker(w)
    await pickRoot(w, 0)
    await adoptBtn(w).trigger('click')
    await flushPromises()
    expect(notes.putSettings).toHaveBeenCalledTimes(1)
    expect(notes.putSettings).toHaveBeenCalledWith({ notesRoot: '/DATA', mode: 'adopt' })
    expect(toast).toHaveBeenCalledWith('Notes directory updated')
    // collapsible closed + <code> swaps to new value backend returned
    expect(folderRow(w).find('.fb').exists()).toBe(false)
    expect(folderRow(w).find('.k-set-row-desc code').text()).toBe('/DATA')
  })

  it('🔴 "Start migration" → mode: "migrate" (second value), and **close dialog then send request** (blueprint :268-269 order)', async () => {
    // 🔴 the **only observable difference** distinguishing "close then send" is "whether the
    //   dialog is still open while the request is in flight" -- so `putSettings` must hang off
    //   a controllable promise.
    //   (the first version checked the DOM inside mockImplementation, but that DOM had **not yet
    //    flushed**: there's no await between `closeMigrate()` and `putSettings()`, so Vue hasn't
    //    re-rendered yet -> always false.
    //    that wasn't "wrong order", it was "probing the wrong thing".)
    const host = withHost()
    notes.dirInfo.mockResolvedValue({ exists: true, empty: true })
    const d = makeDeferred<NotesSettings>()
    notes.putSettings.mockReturnValue(d.promise)
    const { w, store } = await mountPage()
    await flushPromises()
    const toast = vi.spyOn(store, 'toast')
    await openPicker(w)
    await pickRoot(w, 0)
    await moveBtn(w).trigger('click')
    await nextTick()
    await flushPromises()
    await tickAck(host)
    dangerFootBtn(host).click()
    // reka's FocusScope unmount takes one extra microtask tick (`data-focus-scope-unmounting`);
    // a bare `nextTick()` still leaves the node mounted (`data-state="closed"`). `flushPromises()`
    // only drains microtasks, it **will not** make `d.promise` settle -- the request is still in flight.
    await nextTick()
    await flushPromises()
    await nextTick()
    // the request is still in flight -- the dialog **is already closed**.
    // criterion: move closeMigrate() in doMigrate to after the await -> dialog would still be open here -> test goes red.
    expect(notes.putSettings).toHaveBeenCalledWith({ notesRoot: '/DATA', mode: 'migrate' })
    expect(host.querySelector('.k-modal')).toBeNull()

    d.resolve({ notesRoot: '/DATA', autoExtract: true })
    await flushPromises()
    expect(toast).toHaveBeenCalledWith('笔记目录已更新')
    expect(folderRow(w).find('.k-set-row-desc code').text()).toBe('/DATA')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 K30 — lower two catches **do not expose backend text** (blueprint `applyRoot` reads
// `e.response.data.detail`, `toggleAutoExtract` reads `e.message`).
// Criterion is **exclusion assertion**: have `putSettings` reject error with **both response.data.detail
// and message**, assert toast / global stack / whole DOM three don't contain either.
// ⚠️ probe text only in this file, **intentionally absent from `SettingsView.vue` comments**
// (governance §9 clause 9: negation hits comment = false positive, T6 fell for this).
describe('SettingsView/T9 — K30: lower two catches exclusion assertions', () => {
  const PROBE_DETAIL = 'PROBE-NOTES-DETAIL-3b9d20'
  const PROBE_MSG = 'PROBE-NOTES-MESSAGE-8e15af'

  function rejectingPut(): void {
    const err = new Error(PROBE_MSG) as Error & { response: { data: { detail: string } } }
    err.response = { data: { detail: PROBE_DETAIL } }
    notes.putSettings.mockRejectedValue(err)
  }

  function assertNoLeak(
    w: ReturnType<typeof mount>,
    toast: { mock: { calls: unknown[][] } },
  ): void {
    const calls = toast.mock.calls.map((c: unknown[]) => String(c[0])).join(' | ')
    for (const probe of [PROBE_DETAIL, PROBE_MSG]) {
      expect(calls).not.toContain(probe)
      expect(useToast().toasts.map((x) => x.text).join(' | ')).not.toContain(probe)
      expect(w.text()).not.toContain(probe)
      expect(w.html()).not.toContain(probe)
      expect(document.body.innerHTML).not.toContain(probe)
    }
  }

  it('catch⑤ applyRoot("adopt") → only toast "Operation failed", zero backend detail / zero e.message', async () => {
    notes.dirInfo.mockResolvedValue(DIR_INFO_NOTES)
    const { w, store } = await mountPage()
    await flushPromises()
    rejectingPut()
    const toast = vi.spyOn(store, 'toast')
    await openPicker(w)
    await pickRoot(w, 0)
    await adoptBtn(w).trigger('click')
    await flushPromises()
    expect(toast).toHaveBeenCalledTimes(1)
    expect(toast).toHaveBeenCalledWith('Operation failed')
    // on failure collapsible **doesn't close** (blueprint `rootPicker.open = false` after await, outside catch)
    expect(folderRow(w).find('.fb').exists()).toBe(true)
    assertNoLeak(w, toast)
  })

  it('catch⑥ toggleAutoExtract → only toast "Operation failed", zero backend text, toggle doesn\'t flip', async () => {
    const { w, store } = await mountPage()
    await flushPromises()
    rejectingPut()
    const toast = vi.spyOn(store, 'toast')
    await captureSw(w).trigger('click')
    await flushPromises()
    expect(toast).toHaveBeenCalledTimes(1)
    expect(toast).toHaveBeenCalledWith('Operation failed')
    expect(captureSw(w).attributes('data-on')).toBe('true') // failure → value stays
    assertNoLeak(w, toast)
  })

  it('catch⑤ migrate branch also only toasts fixed key (400 non-empty target real path)', async () => {
    const host = withHost()
    notes.dirInfo.mockResolvedValue({ exists: true, empty: true })
    const { w, store } = await mountPage()
    await flushPromises()
    rejectingPut()
    const toast = vi.spyOn(store, 'toast')
    await openPicker(w)
    await pickRoot(w, 0)
    await moveBtn(w).trigger('click')
    await nextTick()
    await flushPromises()
    await tickAck(host)
    dangerFootBtn(host).click()
    await flushPromises()
    expect(toast).toHaveBeenCalledTimes(1)
    expect(toast).toHaveBeenCalledWith('Operation failed')
    assertNoLeak(w, toast)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 governance §9.2 + §9.3 — **bidirectional** same-family scan permanent guards.
// T9 uses 29 keys × full table (real module import, 1595 keys — correction history in assertions below)
//   bidirectional compare:
//   direction 1 (§9.2): zh collision → en differs?   → verified 9 collisions, en **all same**
//   direction 2 (§9.3): en collision → zh differs?   → verified 9 collisions, zh **all same**
// → **this change zero same-family pairs** (need no new en +/reverse assertions; T8's four keep as-is).
// Two cases below pin "zero" as permanent assertion: whoever adds "zh same / en different" key must register by N21.
describe('SettingsView/T9 — §9.2/§9.3 bidirectional same-family scan: this change zero pairs', () => {
  const T9_KEYS = [
    'aiKbSetNotesSection', 'aiKbSetNotesSectionHint', 'aiKbSetNotesFolder',
    'aiKbSetNotesFolderCn', 'aiKbSetNotesFolderDesc', 'aiKbSetSelected',
    'aiKbSetChecking', 'aiKbSetDirEmptyMigratable', 'aiKbSetDirNotEmpty',
    'aiKbSetPointToExisting', 'aiKbSetMoveFiles', 'aiKbSetPickNote',
    'aiKbCancel', 'aiKbSetChange', 'aiKbSetAutoCapture', 'aiKbSetAutoCaptureCn',
    'aiKbSetAutoCaptureDesc', 'aiKbSetAutoCaptureOffWarn', 'aiKbSetAutoCaptureOn',
    'aiKbSetAutoCaptureOff', 'aiKbSetMigrateTitle', 'aiKbSetMigrateReq1',
    'aiKbSetMigrateReq2', 'aiKbSetMigrateReq3', 'aiKbSetMigrateNotEmpty',
    'aiKbSetMigrateAck', 'aiKbSetMigrateStart', 'aiKbSetNotesFolderUpdated',
    'aiKbOpFailed',
  ]
  const zh = zhCn as Record<string, string>
  const en = enUs as Record<string, string>

  it('all 29 keys added by this cut exist in both locales (key names traced back to Appendix A + bidirectional locale-pack verification -- lesson from E-18)', () => {
    expect(T9_KEYS).toHaveLength(29)
    for (const k of T9_KEYS) {
      expect(typeof zh[k], `zh_cn.ts is missing ${k}`).toBe('string')
      expect(typeof en[k], `en_us.ts is missing ${k}`).toBe('string')
    }
    // Full-table key count is computed via **real module import** (governance §9.3 clause 2:
    // text parsing would undercount).
    // Originally 1503 (the snapshot introduced by P5c-T9, never touched since); after P5d-T1
    // added 92 keys it was corrected to 1595 --
    // per coordinator ruling R15 / E-43 (this snapshot is unrelated to what this test case actually
    // covers -- T9's own 29 keys -- it just happens to be embedded in the same test case, so every
    // subsequent key-adding milestone collides with it once; D-3 is filed pending P5e's decision on
    // whether to switch to a lower-bound assertion; this pass only corrects the number, it does not
    // refactor this guard).
    // P5c-T9 introduced the snapshot -> P5d-T1 corrected 1503->1595 (ruling R15 / erratum E-43) ->
    // P5e switched to a lower-bound assertion per governance §0.1 (debt ticket D-3). The original
    // two lines were:
    //   expect(Object.keys(zh)).toHaveLength(1595)
    //   expect(Object.keys(en)).toHaveLength(1595)
    // Exact key-set parity is guarded by src/i18n/parity.test.ts (it asserts the zh/en key sets are
    // fully equal, stronger than "two numbers being equal"); the snapshot's only added value was
    // "the total key count never drops" (guards against bulk accidental deletion), and the lower-
    // bound assertion preserves exactly that value while permanently zeroing out the cross-milestone
    // trap of "every key-adding milestone goes red in a file that has nothing to do with it".
    // Lower bound = the measured value after P5e Task 1 landed (real module import, governance §9.3
    // clause 2: text parsing would undercount).
    expect(Object.keys(zh).length).toBeGreaterThanOrEqual(1648)
    expect(Object.keys(en).length).toBeGreaterThanOrEqual(1648)
  })

  it('🔴 direction 1 (§9.2): among zh-colliding pairs, en has **no** differing pair (if any, must register via N21)', () => {
    const bad: string[] = []
    for (const k of T9_KEYS) {
      for (const o of Object.keys(zh)) {
        if (o === k) continue
        if (zh[o] === zh[k] && en[o] !== en[k]) bad.push(`${k}(${en[k]}) vs ${o}(${en[o]})`)
      }
    }
    expect(bad).toEqual([])
  })

  it('🔴 direction 2 (§9.3): among en-colliding pairs, zh has **no** differing pair (mirror direction, added by T8 review)', () => {
    const bad: string[] = []
    for (const k of T9_KEYS) {
      for (const o of Object.keys(en)) {
        if (o === k) continue
        if (en[o] === en[k] && zh[o] !== zh[k]) bad.push(`${k}(${zh[k]}) vs ${o}(${zh[o]})`)
      }
    }
    expect(bad).toEqual([])
  })

  it('the 8 measured colliding pairs genuinely exist and match in both locales (proves the two tests above are not just scanning nothing)', () => {
    const pairs: Array<[string, string]> = [
      ['aiKbCancel', 'filesCancel'],
      ['aiKbCancel', 'startAppCancel'],
      ['aiKbCancel', 'appsCancel'],
      ['aiKbCancel', 'appsSettingsCancel'],
      ['aiKbCancel', 'aiCancel'],
      ['aiKbCancel', 'aiCfgCancel'],
      ['aiKbOpFailed', 'filesOpFailed'],
      ['aiKbOpFailed', 'filesShareFailed'],
    ]
    for (const [a, b] of pairs) {
      expect(zh[a], `${a} vs ${b}`).toBe(zh[b])
      expect(en[a], `${a} vs ${b}`).toBe(en[b])
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('SettingsView/T9 — source side: K29 reka primitives and portal target truly used', () => {
  it('DialogPortal to targets .knowledge-app + overlay/content use reka primitives (K7 same family, SP8 exposed thrice)', () => {
    const src: string = readFileSync(SRC_PATH, 'utf8')
    const code = blankComments(src)
    expect(code).toContain('<DialogPortal to=".knowledge-app" defer>')
    expect(code).toContain('<DialogOverlay class="k-modal-bg">')
    expect(code).toContain('style="width: min(460px, 100%)"')
    // negative: blueprint bare div syntax must not linger (strip comments first, else hits file header quote → false positive)
    expect(code).not.toMatch(/v-if="migrating"/)
    expect(code).not.toMatch(/@click\.stop/)
  })

  it('dialog any close path uses closeMigrate (not directly write migrating = $event)', () => {
    const src: string = readFileSync(SRC_PATH, 'utf8')
    const code = blankComments(src)
    expect(code).toContain('@update:open="onMigrateOpenChange"')
    expect(code).not.toMatch(/@update:open="migrating\s*=/)
  })
})
