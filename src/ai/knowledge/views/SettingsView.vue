<!--
  SP8-P5c Task 8 — "System Settings" page (rail item 9, route `/ai/knowledge/settings`),
  1:1 ported from Vue 2 reference `NimoOS-UI` (main@7a6ee6b7)
  `src/views/AI/Knowledge/SettingsView.vue` (322 lines, read via `git show main:` —
  governance §1: the working tree in that repo is an old branch, not reliable).

  Upper half (service card / concurrency card / sandbox link / danger zone) implemented by **T8**
  and reviewed; lower half (notes root folder collapse section + migrate confirmation dialog +
  auto-capture toggle + `notesSettings` / `rootPicker` / `dirProbe` / `browserRoots` script)
  inserted by **T9** between "concurrency card" and "sandbox link" — together they comprise
  all 322 lines of the reference, **zero placeholders, zero comment stubs**.

  Structure mapping (reference line ranges → this file; New-UI line numbers recalculated by script,
  see T8 / T9 reports §2):
    :2-4     `.k-view` → `.k-scroll` → `.k-scroll-inner` three-layer shell (copied verbatim)
    :7-19    service card: status light `[data-state]` + two lines of text + resume/pause button
    :22-34   concurrency card · concurrency row: three buttons, text **is the number itself**
             (no tier names)
    :36-49   concurrency card · device row: auto / cuda|gpu / cpu three tiers + `deviceLabel`
    :51-60   concurrency card · OCR row: `.k-sw` toggle + `.warn` warning text
    ── Below is T9 ───────────────────────────────────────────────────────────
    :63-70   notes section `.k-section` header (N16: `📝` outside `t()`)
    :71-102  notes folder row: `<code>` display + `openRootPicker` collapse section +
             `FolderBrowser` + three tier badges + "Point to" / "Move files" two buttons +
             `.kn-pick-note` note
    :104-116 auto-capture row: `.k-sw` toggle + `.warn` hint for `v-if="!autoExtract"`
    :120-156 migrate confirmation dialog (**K29: converted to reka primitives + portal to
             `.knowledge-app`**)
    ── Above is T9 ───────────────────────────────────────────────────────────
    :159-166 sandbox link `.k-sandbox-link`
    :169-186 danger zone `.k-section` + hardcoded `disabled` rebuild button
    :206-212 data(): `notesSettings` / `rootPicker` / `dirProbe` / `migrating` / `migrateAck` (T9)
    :215-226 computed `controlState` / `deviceLabel` / `browserRoots` (third one is T9)
    :228-230 `created()` fetches `notesApi.getSettings()`, catch swallows error and keeps defaults (T9)
    :232-281 `openRootPicker` / `onPick` / `toggleAutoExtract` / `closeMigrate` /
             `doMigrate` / `applyRoot` (T9)
    :282-319 `togglePause` / `setConcurrency` / `setDevice` / `toggleOcr` / `goSandbox`

  ─────────────────────────────────────────────────────────────────────────────
  【This page is not at the top-level route, no K22/K31 wrapper concerns】
    This page is nested under `KnowledgeLayout` (rail item 9) → `.k-scroll` already has
    `overflow-y:auto` (T2a/P5a already in place), **does not need** a custom scroll container,
    **must not** attach `.parser-app` (governance §6.1 landing constraint 4).

  【Zero `<style>` block】The entire settings section SCSS (`.k-set-*` / `.k-svc-*` /
    `.k-radio-group` / `.k-sw` / `.k-section*` / `.k-sandbox-*` / `.k-set-danger` /
    `.k-set-soon` / `.warn`) moved to `src/ai/styles/knowledge.scss` by **T2a** and reviewed;
    `knowledge.scss` is imported by `KnowledgeLayout.vue` side, this file no longer imports
    styles (precedent: `QueueView.vue` / `IndexedFilesView.vue` same pattern).

  【K1 — store flattening, per occurrence】Reference `this.store.state.controlState` (`:215`),
    this repo `parserStore` / `knowledgeStore` are both Pinia setup stores, **the `state` layer
    entirely disappears** → `store.controlState`. Total flattening points in this change: **1
    computed** (`:215` → `controlState` below), which is the sole entry point for **12 reads**
    of `controlState.xxx` in template (`paused` ×6 / `concurrency` ×1 / `device` ×3 /
    `ocr_enabled` ×1 / `resolved_device` ×1, two more in `deviceLabel` computed) — omitting
    this layer means all those fields become `undefined`. Reference `:225` `browserRoots`
    (second `.state.`) is T9.

  【K27 — all REST / toast goes through package and store】Reference
    `this.store.actions.setControl(...)` → `store.setControl(...)` (**4 places**);
    `this.store.actions.toast(...)` → `store.toast(...)` (**8 places** = 4 successes + 4 catches).
    `store.toast` internally calls global `useToast().show(msg, 2400)` (`knowledgeStore.ts:311-313`,
    2400ms consistent with reference), **this file does not directly use `useToast()`** —
    follows existing `QueueView.vue` pattern, no custom solutions.

  【K30 (K5 family) — four catches do not expose backend text】Reference has all four as
    `toast($t('Operation failed') + ': ' + (e.message || e))` (`:287` / `:295` / `:304` / `:313`),
    this repo **only toasts fixed keys**: `aiKbOpFailed` (three places) / `aiKbSwitchFailed`
    (the `setDevice` one). Landing criterion is **negation assertion** (see `SettingsView.test.ts`
    K30 group: make `parserControl` reject an error with recognizable text, assert toast text
    and entire page DOM **do not contain** that text). Warning: that probe text **intentionally
    absent from this file** (governance §9 rule nine: negation assertion hitting comment = false
    positive).

  【Deviation, §2 "Don't copy Vue2 bugs" — `togglePause` success toast was inverted】
    Reference `:282-288`:
        await this.store.actions.setControl(this.controlState.paused ? 'resume' : 'pause')
        this.store.actions.toast(this.controlState.paused ? this.$t('Resumed') : this.$t('Paused'))
    `setControl` internally `await this.loadOverview()` (reference `knowledgeStore.js:311-314`,
    this repo `knowledgeStore.ts:425-428` character-for-character isomorphic) **replaces
    `controlState` with the backend-refreshed new value** → the second read of `paused` is
    already **in the post-action state**:
        paused → send `resume` → refreshed `paused === false` → toast "Paused" (wrong)
        running → send `pause` → refreshed `paused === true` → toast "Resumed" (wrong)
    **Both tiers inverted**, reproducible user-visible error (governance §2 rule: "is → fix and
    log"). Critical: the other three actions in the reference **all store intent first**
    (`setConcurrency` stores param `n`, `setDevice` stores param `d`, `toggleOcr` stores
    `:308` `const next = !ocr_enabled`) — **three of four in the same file correct, one wrong**
    suggests missed refactoring, not intentional design. This repo's fix (minimal): read `paused`
    once **before** `await` and store in `wasPaused`, use it both places → resume toasts "Resumed",
    pause toasts "Paused". DOM / class / icon / text / request payload unchanged, only toast
    text from "wrong" to "right". **Already explicitly declared in T8 report; if coordinator
    judges "copy reference," reverting requires deleting `wasPaused` in two places.**

  【K34 — Vue 3 mechanical rewrite (zero behavior change)】
    | Reference | This repo | Why required |
    |---|---|---|
    | `this.$t(...)` | `t(...)` (`useI18n()`) | `<script setup>` has no `this` |
    | `this.$router.push('/ai/parser/test')` (`:318`) | `router.push(...)` (`useRouter()`) | Same |
    | `computed: { controlState() {...} }` | `computed(() => ...)` | Options → Composition API |
    Zero-guard baseline (T7 review M-1): this change **zero `?.` / zero `&&` guards**, zero `!`
    non-null assertions — reference's `(r || '').toUpperCase()` in `deviceLabel` is **reference's
    own fallback**, copied verbatim (not TS-forced: `resolved_device` in `ParserControlState`
    is required `string`).

  【N16 — emoji / punctuation positions copied verbatim, not one moved in/out of `t()`】
    Inside `t()`: `⏸` (`aiKbSetSvcPausedLine` = `⏸ Paused` / `⏸ 已暂停`, reference `:11`) ·
                 `✅` (`aiKbSetSvcRunningLine`, same line) — **keys themselves contain emoji**.
    Outside `t()`: `🧪` (reference `:162`) · `⚠️` (reference `:171`).
    (`📝` is reference `:67` notes section, belongs to T9.)

  【N21 #1 / #2 — two key pairs where "zh collision, only en disambiguates", use both correctly】
    #1 `aiKbResume` (en `Resume`) vs existing `aiKbRebuild` (en `Rebuild`) — zh **both are
       「恢復」** (Vue2 mistranslated `Rebuild` as 「恢復」, `Resume`→「恢復」 is correct; don't unify).
    #2 `aiKbSetSandboxTitle` (en `Test Sandbox`, capital S) vs `aiKbPrTestLink` (en
       `Test sandbox` lowercase) — zh both are 「測試沙盒」. **This page uses the first.**
    Two more pairs unnamed in this governance file but found by T8's full table scan (see test
    file's same-named describe): `aiKbDeviceAuto` (en `Auto`) vs `aiCfgAutoPlaceholder`
    (en `auto`, lowercase) · `aiKbSwitchFailed` (en `Switch failed`) vs `aiCfgToggleFailed`
    (en `Toggle failed`). → Governance §9.2 strong en assertions all land in `SettingsView.test.ts`.

  【Decision A-1 — device "auto" uses `aiKbDeviceAuto`, does not reuse `aiKbOriginAuto`】
    Two keys with **identical en/zh values** → render assertions have zero discriminating power,
    guard must pin the `t()` call shape in source (precedent: T6 `ParserStatus.test.ts`).

  【Hardcoded non-i18n (N22 family rule)】Device tier bare `GPU` / `CPU` (reference `:46-47`)
    and `deviceLabel` `'GPU (CUDA)'` / `'CPU'` (reference `:220-221`) — tech identifiers,
    reference intentionally left out of i18n, **do not sneak in keys**.

  【N15 family — this page has no tier names】Concurrency three buttons' text **is `{{ n }}`
    itself**. `Power-saving` / `Balanced` / `Full power` is **ParserStatus** (reference `:38`),
    **not here**, don't port that pattern.

  【Danger zone button hardcoded `disabled`】Reference `:181` is permanently `disabled`, never
    clickable (governance §13: acceptance only validates "is grayed out + has 'coming soon' badge").

  【Router status — T10 reverted (2026-08-04)】**This page is now truly routed**: `knowledgeRoutes.ts`
    `settings` sub-route → this component, sandbox link jumps to `/ai/parser/test` → `ParserTest`,
    `DEFERRED_TABS` removed `'settings'` (6 → 5). Historical context (T8/T9 landing time): both
    routes still pointed to placeholder `KnowledgeDeferred`, `DEFERRED_TABS` contained `'settings'`,
    page invisible in browser — **at that time** expected, not a defect, so T8/T9 left routing
    files untouched. Reversal is T10 (governance §12.3 **E-13** records the causal chain).

  【Data source】`controlState` populated by `KnowledgeLayout.vue:186` `store.loadOverview()`
    (fetch on mount + 10s poll), upper half **makes no read requests itself**; sole read request
    is reference `created()` (`:228-230`) `notesApi.getSettings()`, belongs to lower half (T9).

  ═══════════════════ Below is T9 (lower half) deviation/copy declarations ═══════════════════

  【K29 — migrate dialog converted to reka primitives】Reference `:121-156` is bare `.k-modal-bg` +
    overlay `@click="closeMigrate"` + inner `@click.stop`. This repo uses `DialogRoot` /
    `DialogPortal` / `DialogOverlay` / `DialogContent`, `DialogPortal` `to` targets `.knowledge-app`
    (K7 family, SP8 had three incidents), structure copied from existing precedents `QueueView.vue:559-583`
    and `IndexedFilesView.vue:1135-1180`, not custom. Three mappings:
      · overlay click closes / inner click doesn't → `DialogContent` `pointerDownOutside` (equivalent)
      · reference `closeMigrate()` clears **two** state fields → all close paths must go through it,
        so `@update:open` receives `onMigrateOpenChange(v)`, calls `closeMigrate()` when `v === false`
        (**cannot** write `migrating = $event` like `QueueView` — drops `migrateAck` cleanup)
      · reka's a11y demands a `DialogTitle`. Precedent references have **no visible title element**,
        so they use `VisuallyHidden > DialogTitle` to add a hidden node; **this reference `:124`
        already has `.k-modal-title`** → use `<DialogTitle as-child>` to wrap that div,
        DOM structure verbatim with reference (no extra hidden node), a11y satisfied. **This is
        closer to 1:1 than copying precedent, explicitly declared in T9 report.**
    Warning: `DialogPortal to=".knowledge-app"` **only recognizes first matching host** (P5b handoff
    #3) — production host from `KnowledgeLayout.vue`; tests must supply own host in body
    (`SettingsView.test.ts` `withHost()`, precedent `QueueView.test.ts:141-146`).

  【K30 (K5 family) — lower half two more catches don't expose backend text】
    · Reference `applyRoot` (`:276-280`) catch reads
      `(e.response && e.response.data && e.response.data.detail) || e.message || e`
      into toast (reference's comment: "400 = backend guard for non-empty target dir, pass through")
      — this repo **only toasts fixed `aiKbOpFailed`**.
    · Reference `toggleAutoExtract` (`:259-261`) builds `e.message || e` — likewise only toasts
      `aiKbOpFailed`. Landing criterion is **negation assertion** (see test file K30 groups:
      make `putSettings` reject error with both `response.data.detail` and `message`, assert
      toast / global toast stack / entire DOM **do not contain** that text). Warning: probe
      text **intentionally absent** (governance §9 rule nine).

  【K1 — lower half second store flattening】Reference `browserRoots` (`:225`) reads
    `this.store.state.wikiCandidates` → this repo `store.wikiCandidates`;
    `this.store.actions.loadCandidates()` → `store.loadCandidates()`.

  【K27 — all `notesApi.*` goes through shared package】Reference `notesApi.getSettings()` /
    `putSettings()` / `dirInfo()` (`@/service/notes.js`) → `service.notes.*`. Critical:
    **layer detail**: `service.notes.getSettings/putSettings` internally goes through
    `normalizeSettings` (`NimoOS-Service/src/notes.ts:131-137`) → receives **camelCase with only
    `{ notesRoot, autoExtract }` two fields**; HTTP layer `distill_roots` / `distill_daily_cap` /
    `background_model` dropped by that normalization. `dirInfo` internally normalizes to
    `{ exists: boolean, empty: boolean }`. Warning: `normalizeSettings` `autoExtract: r.auto_extract !== false`
    — when backend omits field, normalizes to `true`, consistent with reference `data()` default
    (`:206`), copied verbatim.

  【§5.2 / §9.1 — two staleness guards in `onPick` copied verbatim】Reference `:241-253`:
    success branch `if (this.rootPicker.path !== path) return` (includes comment "A later pick may
    have superseded this probe") + catch `if (this.rootPicker.path === path)` then set `error`.
    **Both copied, neither may be omitted.** Guard variable is `rootPicker.path` this **component-local
    reactive state** (not module-level, not dedicated epoch counter) — rendered simultaneously
    (`v-if="rootPicker.path"` / `<code>` / button `:disabled` attributes), so "two instances
    collision" directly visible in DOM; tests still add one two-instance interleaved case per §9.1.

  【N16 — lower half emoji】`📝` (reference `:67`) outside `t()`. Lower half has zero emoji
    inside `t()`.

  【N7 family — `|| '/DATA/Notes'` fallback copied verbatim】Reference `:77` and `:129` both
    write `notesSettings.notesRoot || '/DATA/Notes'` (display fallback when backend returns empty),
    both copied verbatim.

  【K34 — lower half Vue 3 mechanical rewrite (zero behavior change)】
    | Reference | This repo | Why required |
    |---|---|---|
    | `this.$refs.fb` + `this.$nextTick` | template `ref="fb"` + `nextTick()` | `<script setup>` no `this` |
    | `async created()` | `onMounted(async () => …)` | Options → Composition; reference's `await` also **doesn't block first paint**, first frame uses defaults, behavior identical |
    | `data()` object | `ref()` | Same |
    Zero-guard baseline (T7 review M-1): lower half **zero `?.`, zero `!` non-null assertions**.
    `if (fb.value) fb.value.reset()` the `if` **is reference's own guard** (`:238`
    `if (this.$refs.fb)`), not TS-forced — copied character-for-character.
-->
<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  DialogRoot,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
} from 'reka-ui'
import { service } from '@nimotech/nimoos-service'
import type { NotesSettings } from '@nimotech/nimoos-service'
import KIcon from '../components/KIcon.vue'
import FolderBrowser from '../components/FolderBrowser.vue'
import { pickerRoots } from '../util/folderBrowser'
import { useKnowledgeStore } from '../stores/knowledgeStore'

const { t } = useI18n()
const router = useRouter()
const store = useKnowledgeStore()

/* ── T9: reference data() (`:206-211`) five page-level transient fields, all component-local
   refs, not in store ── */

/** Reference `:206` — default `autoExtract: true`, matches package's `normalizeSettings`
 *  `r.auto_extract !== false` (backend omits field → true). */
const notesSettings = ref<NotesSettings>({ notesRoot: '', autoExtract: true })

/** Reference `:207`. */
const rootPicker = ref<{ open: boolean; path: string }>({ open: false, path: '' })

/** Reference `:208-209` comment: `state: '' | 'loading' | 'done' | 'error'`;
 *  `migratable` = target directory **does not exist or is empty**. */
const dirProbe = ref<{ state: '' | 'loading' | 'done' | 'error'; migratable: boolean }>({
  state: '',
  migratable: false,
})

/** Reference `:210-211`. */
const migrating = ref(false)
const migrateAck = ref(false)

/** Reference uses `this.$refs.fb` (`:80` `ref="fb"` + `:238` call) — Vue 3 uses template ref;
 *  `FolderBrowser` side `defineExpose({ reset })` already in place (T3). */
const fb = ref<InstanceType<typeof FolderBrowser> | null>(null)

/** Reference computed `controlState` (`:215`) — K1: `store.state.controlState` → `store.controlState`. */
const controlState = computed(() => store.controlState)

/**
 * Reference computed `deviceLabel` (`:216-223`) — four branches copied verbatim:
 *   `auto`        → `自动（当前 {r}）`, `r` is uppercase `resolved_device` (empty value uses
 *                   reference's `(r || '')` fallback)
 *   `cuda` / `gpu` → bare `'GPU (CUDA)'` (hardcoded tech identifier)
 *   `cpu`         → bare `'CPU'`
 *   other         → return `d` unchanged (backend can add tiers without rendering blank)
 */
const deviceLabel = computed<string>(() => {
  const d = controlState.value.device
  const r = controlState.value.resolved_device
  if (d === 'auto') return t('aiKbSetDeviceAutoCurrent', { r: (r || '').toUpperCase() })
  if (d === 'cuda' || d === 'gpu') return 'GPU (CUDA)'
  if (d === 'cpu') return 'CPU'
  return d
})

/**
 * Reference computed `browserRoots` (`:224-226`) — K1's second flattening:
 * `this.store.state.wikiCandidates` → `store.wikiCandidates`.
 * `pickerRoots([])` uses fallback three roots (`System (/DATA)` / `/media` / `/mnt`),
 * governance §4.3 tested on device `GET /v1/wiki/candidates` is `[]` → fallback is
 * **the actual path on live device**.
 */
const browserRoots = computed(() => pickerRoots(store.wikiCandidates))

/**
 * Reference `async created()` (`:228-230`) — sole read request.
 * Critical: catch **swallows error and keeps defaults** (reference comment `/* keep defaults *\/`):
 * when settings fetch fails, `notesSettings` stays at `{ notesRoot: '', autoExtract: true }`,
 * page renders normally, `notesRoot` uses template `|| '/DATA/Notes'` fallback. Copied verbatim,
 * do not change to toast error.
 */
onMounted(async () => {
  try {
    notesSettings.value = await service.notes.getSettings()
  } catch {
    /* keep defaults */
  }
})

/**
 * Reference `openRootPicker()` (`:232-240`) — copied line-by-line: toggle open, **only when
 * opening** clear path, reset probe, fetch candidates, next frame reset FolderBrowser.
 * Warning: `loadCandidates()` **no `silent` param** (governance handoff #7: only background
 * prefetch passes `silent`, user-initiated paths don't); reference also omits param and doesn't
 * await (failures silently clear in store).
 */
function openRootPicker(): void {
  rootPicker.value.open = !rootPicker.value.open
  if (rootPicker.value.open) {
    rootPicker.value.path = ''
    dirProbe.value = { state: '', migratable: false }
    store.loadCandidates()
    nextTick(() => {
      if (fb.value) fb.value.reset()
    })
  }
}

/**
 * Reference `onPick(path)` (`:241-253`) — **two staleness guards copied verbatim**.
 * Success branch reference includes comment: "A later pick may have superseded this probe —
 * only apply if current."; catch reference includes comment: "Probe is best-effort UX; the
 * backend migrate guard remains the gate."
 * Critical: omit either guard, "click A then B, A response arrives late" puts A's probe
 * result onto B's selection (badge and "Move files" button clickability both wrong).
 */
async function onPick(path: string): Promise<void> {
  rootPicker.value.path = path
  dirProbe.value = { state: 'loading', migratable: false }
  try {
    const info = await service.notes.dirInfo(path)
    if (rootPicker.value.path !== path) return
    dirProbe.value = { state: 'done', migratable: !info.exists || info.empty }
  } catch {
    if (rootPicker.value.path === path) dirProbe.value = { state: 'error', migratable: false }
  }
}

/**
 * Reference `toggleAutoExtract()` (`:254-262`) — `next` computed before sending request
 * (same as `toggleOcr`). Critical: payload **only includes `autoExtract`**, not `notesRoot`
 * (package's `buildSettingsBody` only writes `notes_root` + `mode` when `notesRoot` has value).
 * Catch uses K30 fixed key.
 */
async function toggleAutoExtract(): Promise<void> {
  const next = !notesSettings.value.autoExtract
  try {
    notesSettings.value = await service.notes.putSettings({ autoExtract: next })
    store.toast(next ? t('aiKbSetAutoCaptureOn') : t('aiKbSetAutoCaptureOff'))
  } catch {
    store.toast(t('aiKbOpFailed'))
  }
}

/** Reference `closeMigrate()` (`:263-266`) — **clears both state fields**, copied verbatim. */
function closeMigrate(): void {
  migrating.value = false
  migrateAck.value = false
}

/**
 * K29 landing: reka's `DialogRoot` uses `@update:open` to signal "dialog was closed".
 * Reference's three close paths (× button / cancel button / overlay click) all call `closeMigrate()`,
 * so here `v === false` is unified to it — **cannot** write `migrating = $event`
 * (drops `migrateAck` cleanup, next open checkbox stays checked, danger button directly clickable).
 */
function onMigrateOpenChange(v: boolean): void {
  if (!v) closeMigrate()
}

/** Reference `doMigrate()` (`:267-270`) — red flag: **close dialog before sending request**,
 *  order copied verbatim. */
async function doMigrate(): Promise<void> {
  closeMigrate()
  await applyRoot('migrate')
}

/**
 * Reference `applyRoot(mode)` (`:271-281`) — `mode` two values: `'adopt'` (point to) /
 * `'migrate'` (move files). On success close collapse section + toast "notes folder updated".
 * Catch uses K30: reference reads `e.response.data.detail` and passes backend 400 text through,
 * this repo only toasts fixed key.
 */
async function applyRoot(mode: string): Promise<void> {
  try {
    notesSettings.value = await service.notes.putSettings({
      notesRoot: rootPicker.value.path,
      mode,
    })
    rootPicker.value.open = false
    store.toast(t('aiKbSetNotesFolderUpdated'))
  } catch {
    store.toast(t('aiKbOpFailed'))
  }
}

/**
 * Reference `togglePause()` (`:282-289`).
 * Critical: `wasPaused` is this repo's bug fix (see file header "Deviation, §2" section):
 * reference reads `controlState.paused` again **after** `await`, but `setControl` internally
 * `await loadOverview()` already replaced it with new value → both tier toasts inverted. Here
 * store intent **before** sending request, use in both places.
 */
async function togglePause(): Promise<void> {
  const wasPaused = controlState.value.paused
  try {
    await store.setControl(wasPaused ? 'resume' : 'pause')
    store.toast(wasPaused ? t('aiKbResumed') : t('aiKbPaused'))
  } catch {
    // K30: reference builds `': ' + (e.message || e)`, this repo only toasts fixed key
    store.toast(t('aiKbOpFailed'))
  }
}

/** Reference `setConcurrency(n)` (`:290-297`) — red flag: payload key is `n`
 *  (backend `controlReq{ N *int json:"n" }`). */
async function setConcurrency(n: number): Promise<void> {
  try {
    await store.setControl('set_concurrency', { n })
    store.toast(t('aiKbSetConcurrencySet', { n }))
  } catch {
    store.toast(t('aiKbOpFailed'))
  }
}

/**
 * Reference `setDevice(d)` (`:298-306`) — toast `label` ternary copied verbatim:
 * `auto` uses i18n, `cpu` / other use bare `'CPU'` / `'GPU'` (note: bare `GPU` here,
 * not `'GPU (CUDA)'` from `deviceLabel`, reference differs in both places, don't unify).
 * Failure key is `aiKbSwitchFailed` (switch failed), **not** `aiKbOpFailed`.
 */
async function setDevice(d: string): Promise<void> {
  try {
    await store.setControl('set_device', { device: d })
    const label = d === 'auto' ? t('aiKbDeviceAuto') : d === 'cpu' ? 'CPU' : 'GPU'
    store.toast(t('aiKbSetDeviceSet', { label }))
  } catch {
    store.toast(t('aiKbSwitchFailed'))
  }
}

/** Reference `toggleOcr()` (`:307-315`) — `next` computed before request (reference so, copied). */
async function toggleOcr(): Promise<void> {
  const next = !controlState.value.ocr_enabled
  try {
    await store.setControl('set_ocr', { enabled: next })
    store.toast(next ? t('aiKbSetOcrOn') : t('aiKbSetOcrOff'))
  } catch {
    store.toast(t('aiKbOpFailed'))
  }
}

/** Reference `goSandbox()` (`:316-319`) — reuses existing `/ai/parser/test` page.
 *  That route **at T9 landing time** still pointed to placeholder, **P5c T10 (2026-08-04)
 *  reverted** to real `ParserTest`. */
function goSandbox(): void {
  router.push('/ai/parser/test')
}
</script>

<template>
  <div class="k-view">
    <div class="k-scroll">
      <div class="k-scroll-inner">

        <!-- Service card (reference :6-19) — N16: `⏸` / `✅` inside t() (keys contain them) -->
        <div class="k-set-card k-set-svc">
          <div class="k-svc-state">
            <span class="k-svc-light" :data-state="controlState.paused ? 'paused' : 'running'" />
            <div style="flex: 1">
              <div class="k-svc-name">{{ controlState.paused ? t('aiKbSetSvcPausedLine') : t('aiKbSetSvcRunningLine') }}</div>
              <div class="k-svc-cn">{{ controlState.paused ? t('aiKbSetSvcPausedDesc') : t('aiKbSetSvcRunningDesc') }}</div>
            </div>
            <button :class="['k-btn', controlState.paused ? 'primary' : 'outline']" @click="togglePause">
              <KIcon :name="controlState.paused ? 'play' : 'pause'" :size="12" />
              {{ controlState.paused ? t('aiKbResume') : t('aiKbPause') }}
            </button>
          </div>
        </div>

        <!-- Concurrency card (reference :21-61) -->
        <div class="k-set-card">
          <div class="k-set-row">
            <div class="k-set-row-info">
              <div class="k-set-row-title">{{ t('aiKbSetConcurrentFiles') }}</div>
              <div class="k-set-row-cn">{{ t('aiKbConcurrencyLevel') }}</div>
              <div class="k-set-row-desc">{{ t('aiKbSetConcurrencyDesc') }}</div>
            </div>
            <!-- Critical: button text **is the number itself** (N15 family: tier names in ParserStatus, not here) -->
            <div class="k-radio-group">
              <button v-for="n in [1, 2, 4]" :key="n"
                      :data-on="String(controlState.concurrency === n)"
                      @click="setConcurrency(n)">{{ n }}</button>
            </div>
          </div>

          <div class="k-set-row">
            <div class="k-set-row-info">
              <div class="k-set-row-title">{{ t('aiKbInferenceDevice') }}</div>
              <div class="k-set-row-cn">{{ t('aiKbSetDeviceCn') }}</div>
              <div class="k-set-row-desc">
                {{ t('aiKbSetCurrentlyUsing') }} <b>{{ deviceLabel }}</b>
              </div>
            </div>
            <!-- Critical: second tier's data-on accepts both `cuda` **and** `gpu` values (reference :46) -->
            <div class="k-radio-group">
              <button :data-on="String(controlState.device === 'auto')" @click="setDevice('auto')">{{ t('aiKbDeviceAuto') }}</button>
              <button :data-on="String(controlState.device === 'cuda' || controlState.device === 'gpu')" @click="setDevice('cuda')">GPU</button>
              <button :data-on="String(controlState.device === 'cpu')" @click="setDevice('cpu')">CPU</button>
            </div>
          </div>

          <div class="k-set-row">
            <div class="k-set-row-info">
              <div class="k-set-row-title">{{ t('aiKbSetOcrTitle') }}</div>
              <div class="k-set-row-cn">{{ t('aiKbSetOcrCn') }}</div>
              <div class="k-set-row-desc">
                <span class="warn"><KIcon name="danger" :size="11" /> {{ t('aiKbSetOcrWarn') }}</span>. {{ t('aiKbSetOcrOnlyScanned') }}
              </div>
            </div>
            <!-- Critical: `!!` double negation copied (reference :59): when backend omits field,
                 String(undefined) renders as "undefined" -->
            <button class="k-sw" :data-on="String(!!controlState.ocr_enabled)" @click="toggleOcr" />
          </div>
        </div>

        <!-- Notes section (reference :63-118) — N16: 📝 outside t() -->
        <div class="k-section">
          <div class="k-section-head">
            <div>
              <div class="k-section-title">📝 {{ t('aiKbSetNotesSection') }}</div>
              <div class="k-section-hint">{{ t('aiKbSetNotesSectionHint') }}</div>
            </div>
          </div>
          <div class="k-set-card">
            <!-- Notes folder row (reference :72-102) — this row's align-items is flex-start
                 (content grows tall) -->
            <div class="k-set-row" style="align-items: flex-start">
              <div class="k-set-row-info">
                <div class="k-set-row-title">{{ t('aiKbSetNotesFolder') }}</div>
                <div class="k-set-row-cn">{{ t('aiKbSetNotesFolderCn') }}</div>
                <div class="k-set-row-desc">
                  <!-- Critical: N7 family: `|| '/DATA/Notes'` fallback copied (display fallback
                       when backend returns empty) -->
                  <code>{{ notesSettings.notesRoot || '/DATA/Notes' }}</code> — {{ t('aiKbSetNotesFolderDesc') }}
                </div>
                <div v-if="rootPicker.open" style="border-top: 1px dashed var(--line); margin-top: 12px; padding-top: 12px">
                  <FolderBrowser ref="fb" :roots="browserRoots" @pick="onPick" />
                  <div v-if="rootPicker.path" class="kn-picked" style="margin-top: 10px">
                    <!-- Colon is bare ASCII `:` in template (not in t()), copied from reference :82 -->
                    {{ t('aiKbSetSelected') }}: <code>{{ rootPicker.path }}</code>
                    <!-- Critical: three tier badges: loading / done+migratable / done+not-migratable.
                         When `state === 'error'` **none display** (reference has no fourth branch). -->
                    <span v-if="dirProbe.state === 'loading'" class="kn-badge" data-s="archived">{{ t('aiKbSetChecking') }}</span>
                    <span v-else-if="dirProbe.state === 'done' && dirProbe.migratable" class="kn-badge" data-s="curated">{{ t('aiKbSetDirEmptyMigratable') }}</span>
                    <span v-else-if="dirProbe.state === 'done'" class="kn-badge" data-s="draft">{{ t('aiKbSetDirNotEmpty') }}</span>
                  </div>
                  <div class="kn-pick-actions" style="margin-top: 10px">
                    <button class="k-btn primary" :disabled="!rootPicker.path" @click="applyRoot('adopt')">
                      <KIcon name="folder" :size="12" /> {{ t('aiKbSetPointToExisting') }}
                    </button>
                    <!-- Critical: this button's disabled is **two** conditions: path not selected,
                         or probe explicitly says target non-empty. When probe is still loading /
                         error it is **clickable** (backend migrate guard is final gate). Clicking
                         only sets migrating true, **sends no request**. -->
                    <button class="k-btn outline" :disabled="!rootPicker.path || (dirProbe.state === 'done' && !dirProbe.migratable)"
                            @click="migrating = true">
                      <KIcon name="upload" :size="12" /> {{ t('aiKbSetMoveFiles') }}
                    </button>
                    <span class="kn-pick-note">{{ t('aiKbSetPickNote') }}</span>
                  </div>
                </div>
              </div>
              <button :class="['k-btn', rootPicker.open ? 'ghost' : 'outline']" @click="openRootPicker">
                {{ rootPicker.open ? t('aiKbCancel') : t('aiKbSetChange') }}
              </button>
            </div>

            <!-- Auto-capture row (reference :104-116) -->
            <div class="k-set-row">
              <div class="k-set-row-info">
                <div class="k-set-row-title">{{ t('aiKbSetAutoCapture') }}</div>
                <div class="k-set-row-cn">{{ t('aiKbSetAutoCaptureCn') }}</div>
                <div class="k-set-row-desc">
                  {{ t('aiKbSetAutoCaptureDesc') }}
                  <!-- Critical: tested on device auto_extract:true → this line **does not render**
                       (governance §13, is correct behavior) -->
                  <span v-if="!notesSettings.autoExtract" class="warn" style="display: block; margin-top: 2px">
                    <KIcon name="danger" :size="11" /> {{ t('aiKbSetAutoCaptureOffWarn') }}
                  </span>
                </div>
              </div>
              <!-- Critical: `!!` double negation copied (reference :115) -->
              <button class="k-sw" :data-on="String(!!notesSettings.autoExtract)" @click="toggleAutoExtract" />
            </div>
          </div>
        </div>

        <!-- Migrate confirmation dialog (reference :120-156) — K29: reka Dialog primitives,
             portal to knowledge container. Reference's "overlay click closes / inner click
             doesn't" handled by DialogContent's pointerDownOutside; all close paths unified
             to closeMigrate() (see onMigrateOpenChange comment). -->
        <DialogRoot :open="migrating" @update:open="onMigrateOpenChange">
          <DialogPortal to=".knowledge-app" defer>
            <DialogOverlay class="k-modal-bg">
              <DialogContent class="k-modal" style="width: min(460px, 100%)" :aria-describedby="undefined">
                <div class="k-modal-head">
                  <!-- DialogTitle wraps reference's own .k-modal-title (as-child) — satisfies
                       reka a11y requirements and **adds no extra hidden node**, DOM verbatim
                       with reference :124. -->
                  <DialogTitle as-child>
                    <div class="k-modal-title">{{ t('aiKbSetMigrateTitle') }}</div>
                  </DialogTitle>
                  <button class="k-modal-x" @click="closeMigrate"><KIcon name="x" :size="13" /></button>
                </div>
                <div class="k-modal-body">
                  <div class="kn-mig-path">
                    <span style="color: var(--text-tertiary)">{{ notesSettings.notesRoot || '/DATA/Notes' }}</span>
                    <KIcon name="arrowRight" :size="13" color="var(--warning)" />
                    <b>{{ rootPicker.path }}</b>
                  </div>
                  <ul class="kn-mig-req" style="margin-top: 10px">
                    <li>
                      <!-- Critical: only first item's :color is ternary (turns danger when target
                           non-empty), other two always success -->
                      <KIcon name="check" :size="13" :color="dirProbe.state === 'done' && !dirProbe.migratable ? 'var(--danger)' : 'var(--success)'" />
                      <span>
                        {{ t('aiKbSetMigrateReq1') }}
                        <b v-if="dirProbe.state === 'done' && !dirProbe.migratable" style="color: var(--danger)">{{ t('aiKbSetMigrateNotEmpty') }}</b>
                      </span>
                    </li>
                    <li><KIcon name="check" :size="13" color="var(--success)" /><span>{{ t('aiKbSetMigrateReq2') }}</span></li>
                    <li><KIcon name="check" :size="13" color="var(--success)" /><span>{{ t('aiKbSetMigrateReq3') }}</span></li>
                  </ul>
                  <label class="kn-checkline" style="margin-top: 10px">
                    <input v-model="migrateAck" type="checkbox" />
                    {{ t('aiKbSetMigrateAck') }}
                  </label>
                </div>
                <div class="k-modal-foot">
                  <button class="k-btn ghost" @click="closeMigrate">{{ t('aiKbCancel') }}</button>
                  <button class="k-btn danger" :disabled="!migrateAck" @click="doMigrate">
                    <KIcon name="upload" :size="12" /> {{ t('aiKbSetMigrateStart') }}
                  </button>
                </div>
              </DialogContent>
            </DialogOverlay>
          </DialogPortal>
        </DialogRoot>

        <!-- Sandbox link (reference :158-166) — N16: 🧪 outside t() -->
        <a class="k-sandbox-link" @click.prevent="goSandbox">
          <div class="k-sandbox-icon"><KIcon name="test" :size="20" /></div>
          <div style="flex: 1">
            <div style="font-size: 14px; font-weight: 600; letter-spacing: -0.005em">🧪 {{ t('aiKbSetSandboxTitle') }}</div>
            <div style="font-size: 12px; color: var(--text-secondary); margin-top: 2px">{{ t('aiKbSetSandboxHint') }}</div>
          </div>
          <KIcon name="chev" :size="14" color="var(--text-tertiary)" />
        </a>

        <!-- Danger zone (reference :168-186) — N16: ⚠️ outside t(); button hardcoded disabled -->
        <div class="k-section">
          <div class="k-section-head">
            <div class="k-section-title" style="color: var(--danger)">⚠️ {{ t('aiKbSetDangerZone') }}</div>
            <div class="k-section-hint">{{ t('aiKbDeferredTitle') }}</div>
          </div>
          <div class="k-set-card k-set-danger">
            <div class="k-set-row" style="padding: 8px 0">
              <div class="k-set-row-info">
                <div class="k-set-row-title">{{ t('aiKbSetRebuildAll') }} <span class="k-set-soon">{{ t('aiKbDeferredTitle') }}</span></div>
                <div class="k-set-row-cn">{{ t('aiKbSetRebuildAll') }}</div>
                <div class="k-set-row-desc">{{ t('aiKbSetRebuildAllDesc') }}</div>
              </div>
              <button class="k-btn danger" disabled>
                <KIcon name="danger" :size="12" /> {{ t('aiKbSetRebuildEllipsis') }}
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>
