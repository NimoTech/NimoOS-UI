<!--
  "Knowledge Roots" page (rail item 7, route `/ai/knowledge/roots`),
  1:1 ported from Vue2 reference the Vue 2 panel @ `7a6ee6b7`
  `src/views/AI/Knowledge/RootsView.vue` (289 lines, fetch via `git -C ../../the Vue 2 panel show 7a6ee6b7:`
  — governance §0.4: that repo's working tree is on another branch, unreliable).

  Structure mapping (reference line ranges → this file):
    :2-4     `.k-view` → `.k-scroll` → `.k-scroll-inner` three-layer shell (copy each layer)
    :5-40    header (title / subtitle / top-right "Add Knowledge Root") + empty state `.kr-empty` / list `.k-set-card` sides
    :43-91   "Add Knowledge Root" dialog (**K57: convert to reka primitives + portal to `.knowledge-app`**)
    :93-120  "Delete Knowledge Root?" confirmation dialog (same as above)
    :131-141 seven page-level ephemeral states from `data()` → local component `ref`
    :142-148 `computed` (roots / canSubmit / browserRoots)
    :149-151 `created()` → `onMounted()`
    :152-219 `methods` → plain functions

  ────────────────────────────────────────────────────────────────────────────
  【Zero style block — K44 / K53 / governance §3】this file's reference has `<style lang="scss" scoped>`
    (`:223-289`, 66 lines / 9 `kr-*` classes: `.kr-empty` `.kr-path` `.kr-badge` `.kr-label`
    `.kr-input` `.kr-adv-row` `.kr-error` `.kr-check` `.kr-hint`), already moved wholesale by **T2** to
    `src/ai/styles/knowledge.scss` (nested under `.knowledge-app`, K9) and reviewed ⇒ **this file
    has no style blocks**. `knowledge.scss` imported by `KnowledgeLayout.vue` side,
    this file no longer imports styles (precedent: `QueueView.vue` / `SettingsView.vue` / `AllowlistView.vue`).
    Guard: K44 parameterized assertion in `knowledgeStyles.test.ts` (T2b layout, decision R20 C-1) ——
    it **strips comments first, then anchors to line start**, so the sentence above won't trip it (direct consequence of decision **R19**).
    Also this file must be registered in `KNOWLEDGE_VUE_FILES` list in `knowledgeStyles.test.ts`
    (set equality prevents drift; unregistered = that assertion goes red, **that is correct behavior, do not change the assertion**).

  【K54 — two `var(--x, <literal>)` fallbacks removed on scss side】reference `:243`
    `var(--bg-tertiary, …)` → `var(--bg-chip)`, `:254` `var(--border, …)` → `var(--line)`
    (appendix B §B.2, fixed values). **those two are in scss, this file does not touch them**; recorded here to avoid missing in next round.
    ⚠️ Decision **R8**: `--bg-tertiary` has zero declaration on both sides ⇒ fallback always active ⇒ `.kr-badge`
    token swap is **visible change, not equivalent substitution** (acceptance checklist notes to glance at that small badge).

  【K1 — store layer reduction, each place】reference `this.store.state.wikiRoots` (`:143`) /
    `this.store.state.wikiRootsLoading` (`:13`) / `this.store.state.wikiCandidates` (`:146`),
    this repo's `knowledgeStore` is Pinia setup store, **the `state` layer disappears entirely**
    → `store.wikiRoots` / `store.wikiRootsLoading` / `store.wikiCandidates`.
    Layer reduction points total **3** (computed 2 + template 1) — miss one and that section goes blank with no error.

  【K57 — two dialogs convert to reka primitives】reference `:44` / `:94` both bare `.k-modal-bg` +
    overlay `@click="adding = false"` / `@click="deleting = null"` + inner `@click.stop`.
    this repo changes to `DialogRoot` / `DialogPortal to=".knowledge-app" defer` /
    `DialogOverlay class="k-modal-bg"` / `DialogContent class="k-modal"`,
    structure follows existing precedent `SettingsView.vue` (K29 landed) and contemporaneous `AllowlistView.vue` (T4) **copy same one**,
    **do not create a second variant**. Three mappings:
      · overlay click closes / click inside dialog doesn't close → `DialogContent`'s `pointerDownOutside` (equivalent),
        🔴 **no longer write `@click.stop`**;
      · new dialog's three close paths (× / cancel / click overlay) all just set `adding` to false ⇒
        `@update:open` write `adding = $event` directly (same as `AllowlistView`);
        delete dialog's state is **object** (`deleting`) not boolean ⇒ needs named callback
        `onDeletingOpen`, translates "close" to `deleting = null`.
        🔴 **reference does not reset `purgeFiles` on close** (only `confirmDelete` resets, `:218`)
        ⇒ this repo copies it, `onDeletingOpen` **does not** touch `purgeFiles`.
      · reka's a11y requires a `DialogTitle`. **reference's two dialogs `:47` / `:97` already have
        `.k-modal-title`** → wrap with `<DialogTitle as-child>` directly on that div, DOM structure matches reference
        verbatim (no extra hidden node), **no need for `VisuallyHidden`** — same choice as `SettingsView`.
    ⚠️ `DialogPortal to=".knowledge-app"` **only recognizes the first same-name host** (P5b handoff item #3).
      this page in production sits under `KnowledgeLayout.vue`, and `.knowledge-app` class in whole repo
      **only rendered in one place: `KnowledgeLayout.vue`** ⇒ at any moment page has exactly one host,
      no ambiguity in `to` target. Tests create their own host in body (`RootsView.test.ts`'s `withHost()`).
    ⚠️ **at most one dialog open at a time** (`adding` and `deleting` don't trigger each other), two Portals pointing to
      same host no conflict — closed `DialogContent` doesn't render content.

  【K58 / K59 — two error display patterns】
    · **K59 (inline in dialog)**: reference `:77-81` `.kr-error` is **already inline block inside dialog**,
      **not a toast** ⇒ this half is copy. 🔴 meanwhile fulfills memory `newui-dialog-error-not-toast`:
      toast is `z-index: 60`, dialog overlay 1000 plus blur, **errors inside dialog always inline**,
      rendering as toast gets overlaid + blurred.
      the divergence is the other half: reference `:202` directly echoes `e.response.data.message` to `addError`
      (K5/K58 explicitly forbid echoing backend body) ⇒ this repo non-409 branch uses fixed i18n key instead.
    · **K58 (form A)**: established practice ——
      **in catch discard `e.message`, show only fixed i18n key, and "no second sentence to compose, so no `': '` prefix"**
      (precedent `QueueView.vue:212-217` / `IndexedFilesView.vue:592-593` / `NoteEditPane.vue:461`).
      reference four places `$t('Operation failed') + ': ' + (e.message || e)` (`:171` `:180` `:216`) and
      `addError = e.response.data.message` (`:202`) all become fixed key `aiKbOpFailed`.
      **do not create a second mapping.**
      🔴 **two exceptions copy as-is (form B sibling, second sentence is reference's fixed text, not backend body)**:
      `toggle()`'s 404-specific message (N51) and `submit()`'s 409 read-only message (N50).
      implementation criterion is **exclusion assertion** (see test file K58 group: have store action reject error with identifiable
      text, assert toast text and entire page DOM both **lack** that text).
      ⚠️ that probe text **intentionally does not appear in this file** (governance §9: negation assertion hits comment = false positive).

  【K27 sibling — all toasts go through `store.toast(...)`】decision **R27** / errata **E-62**:
    inside `knowledgeStore.ts` `toast()` is `useToast().show(msg, 2400)`, and **global `show()`
    defaults to only 1500ms** ⇒ direct `useToast()` call loses reference's own 2400ms. existing 7 pages all use
    `store.toast()`, this page follows the same pattern — total **7 places** = toggle 2 (success + catch) + rescan 2 +
    confirmDelete 2 + submit success 1. 🔴 **submit's failure path per K59 uses inline dialog, not toast**
    ⇒ it's this page's only "has catch but no toast" branch, don't thoughtlessly add one following other patterns.

  ═══════════════════ quoted declarations (§3.5's N entries) ═══════════════════

  【N46 — 🔴 easiest mistake this round】Wiki's `WikiRoot` / `CreateArgs` **Go structs have no json tag**
    ⇒ HTTP response is **PascalCase**, POST body must use **Go field names** (Go decoder case-insensitive
    but **underscore doesn't match**, `watch_mode` gets **silently discarded**, no error on real device).
    🔴 **bidirectional normalization already in shared package** (`the shared service package's src/wiki.ts:85` `normalizeRoot` /
    `:136` `createRootBody`) ⇒ **store exports all camelCase** (T0 real-world decision), this page only consumes `r.id` / `r.path` / `r.enabled` /
    `r.watchMode` / `r.scanIntervalS` / `r.lastScanAt`, **must not normalize again in page**.
    🔴 **body always via shared package `createRootBody`, do not rewrite** (D3 already in package).

  【N49 — Go nil slice fallback】`pickerRoots(...)` carries `(candidates || [])`
    (`util/folderBrowser.ts:75`), this page just passes `store.wikiCandidates` as-is.

  【N50 — 409 → mirror mode retry, copy】reference `:196-206`.
    ⚠️ `storage_mode=mirror` **backend never implemented** (memory + `NimoOS-Wiki/OVERVIEW.md`, errata **E-64**)
    ⇒ **copy UI as-is, do not delete button**; acceptance checklist notes "mirror mode backend unimplemented, clicking has no effect".
    ⚠️ §9.17: this machine `/v1/wiki/roots` is **timeout** not 409 ⇒ **unreachable on real device**, only verified in unit tests.

  【N51 — `toggle()`'s 404-specific message, copy】reference `:168-170`. this is reference's
    dedicated message for **backend lag currently happening this round**.

  ═══════════════════ 🔴🔴 `toggle()` toast direction: **not a reference bug** (decision R9) ═══════════════════

  Reference `:163-173`:
      await this.store.actions.setRootEnabled(r.id, !r.enabled)
      this.store.actions.toast(r.enabled ? $t('Root enabled') : $t('Root disabled'))
  looks like "calls with `!r.enabled` but reads `r.enabled`" = message reversed. **step-by-step reasoning shows not reversed**:
    ① `!r.enabled` evaluates **before call happens** — it is the **target state** (negate old value);
    ② `setRootEnabled` (`knowledgeStore.ts:736-747`) is **optimistic update**:
       `root.enabled = enabled` written **before** `await`, request hasn't even sent but already updated in place;
    ③ `r` in `v-for="r in roots"` and `wikiRoots.value.find(...)` from store are
       **same object reference** (store only mutates field, doesn't replace array element) ⇒ `r.enabled` and `root.enabled`
       are the same memory location;
    ④ so `r.enabled` read after `await` lands **is already new value** ⇒ message direction correct;
    ⑤ failure path: `setRootEnabled` rolls back `root.enabled = prev` then `throw` ⇒ enter catch,
       **success toast never executes**.
  ⇒ per decision **R9** "prove why not a bug" branch: **copy verbatim, do not change logic.**

  🔴 **but this correctness entirely depends on "store in-place update is same object" invariant**, and this repo's store is
    Pinia `ref<WikiRoot[]>` — if future `loadRoots` becomes full array replacement, or `setRootEnabled` becomes
    `wikiRoots.value = wikiRoots.value.map(...)`, **this silently becomes wrong** (UI toggle still flips, only toast
    message reverses, three guards won't fire). ⇒ test has guard cases (see `RootsView.test.ts`
    "R9 invariant" group): "after success, toast message is **new** state" both sides + "on failure **no success toast**".
    🔴 **criterion revision (declared decision R18)**: decision R9's criterion "move `root.enabled = enabled` after
    `await`" **real-world test shows no red** (60/60 still all green) — moving after `await` still inside
    `setRootEnabled` **function**, caller resumes after function returns, assignment already done.
    **real-world valid criterion = replace in-place update with full array replacement**
    (`wikiRoots.value = wikiRoots.value.map((r) => (r.id === id ? { ...r, enabled } : r))`)
    → **3 go red**. reasoning and evidence in `RootsView.test.ts` "R9 invariant" comment.

  ═══════════════════ Vue2 → Vue3 forced rewrites (governance §2, not counted as divergence) ═══════════════════
    | Reference (Options API) | This file | Rationale |
    |---|---|---|
    | `data()` object | `ref()` | `<script setup>` has no `this` |
    | `computed: { roots/canSubmit/browserRoots }` | `computed()` | same |
    | `created()` | `onMounted()` | reference's `loadRoots()` similarly **doesn't block first paint** (no await) |
    | `methods: { … }` | plain functions | same |
    | `this.$refs.fb` | `ref<InstanceType<typeof FolderBrowser>>` | `FolderBrowser.vue:97` has `defineExpose({ reset })` |
    | `this.$nextTick` | `nextTick` | same |
    | `this.$t` | `useI18n().t` | established in this repo |
    | `this.store.actions.x()` | `store.x()` | Pinia setup store has no `actions` layer |
    | `methods: { fmtAgo }` | direct `import { fmtAgo }` | reference hangs it on methods only for template visibility |

  🔴 **zero `any`** (inheriting K41): `WikiRoot` type imported directly from shared package; HTTP status code lookup
    collected in this file's `httpStatus(e: unknown)` function, using type narrowing not `as any`.
  🔴 extra `if (!r) return` in `confirmDelete()` is **TS null narrowing requirement**
    (reference `deleting` untyped, this repo is `WikiRoot | null`) — **unreachable branch**:
    function only callable from button inside dialog that only renders when `deleting` non-null.
-->
<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  DialogRoot,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
} from 'reka-ui'
import { createRootBody } from '@nimotech/nimoos-service'
import type { WikiRoot } from '@nimotech/nimoos-service'
import KIcon from '../components/KIcon.vue'
import FolderBrowser from '../components/FolderBrowser.vue'
import { pickerRoots } from '../util/folderBrowser'
import { useKnowledgeStore, fmtAgo } from '../stores/knowledgeStore'

const { t } = useI18n()
const store = useKnowledgeStore()

/** Four fields of reference `:139`'s `form`. `hours` is **hours** (passed as `scanIntervalH` to `createRootBody`,
 *  multiplied by 3600 inside package to convert to seconds); `watchMode` is `'auto' | 'scan_only'`
 *  two backend enum strings, **copy as-is, do not change**. */
interface RootForm {
  path: string
  watchMode: string
  hours: number
  advOpen: boolean
}

/** Initial values from reference `:135-140` — `openAdd()` (`:154`) resets to **this exact copy** each time, identical value. */
function emptyForm(): RootForm {
  return { path: '', watchMode: 'auto', hours: 6, advOpen: false }
}

/* ── seven page-level ephemeral states from reference data() (`:132-140`), all local component ref, not stored (governance §5.1) ── */

/** Reference `:134` — "Add Knowledge Root" dialog toggle. */
const adding = ref(false)
/** Reference `:135` — target row for delete confirmation dialog (null = closed). */
const deleting = ref<WikiRoot | null>(null)
/** Reference `:136` — whether to also purge `.wiki.md` on delete. */
const purgeFiles = ref(false)
/** Reference `:137` — submit gate (governance §5.2: reference has it, copy). */
const submitting = ref(false)
/** Reference `:138` — K59: error message **inline in dialog** (not a toast). */
const addError = ref('')
/** Reference `:139` — true only on 409, controls whether "Add as Mirror" button appears (N50). */
const mirrorOffer = ref(false)
/** Reference `:140`. */
const form = ref<RootForm>(emptyForm())

/** Reference `:53`'s `ref="fb"` — Vue3 gets instance method via `defineExpose({ reset })`. */
const fb = ref<InstanceType<typeof FolderBrowser> | null>(null)

/** Reference `:143` (K1 layer reduction: `store.state.wikiRoots` → `store.wikiRoots`). */
const roots = computed<WikiRoot[]>(() => store.wikiRoots)

/** Reference `:144` — only accepts absolute paths. `submit()` guards again (governance §5.2). */
const canSubmit = computed<boolean>(() => form.value.path.startsWith('/'))

/** Reference `:145-147` (K1 layer reduction + N49: `pickerRoots` carries `(candidates || [])` fallback). */
const browserRoots = computed(() => pickerRoots(store.wikiCandidates))

/** Reference `:149-151`'s `created()`. reference has no await or catch — copy as-is
 *  (`loadRoots` carries its own catch + toast, `knowledgeStore.ts:661-663`). */
onMounted(() => {
  store.loadRoots()
})

/**
 * Extract HTTP status code from axios error. **zero `any`** (inheriting K41): use `in` to narrow, not assertion cast.
 * Reference writes `e && e.response && e.response.status === 404` (`:168`) /
 * `e && e.response && e.response.status` (`:195`) — semantically identical, just collected into a function.
 */
function httpStatus(e: unknown): number | undefined {
  if (e && typeof e === 'object' && 'response' in e) {
    const res = (e as { response?: { status?: number } }).response
    if (res && typeof res.status === 'number') return res.status
  }
  return undefined
}

/**
 * Reference `:153-160` — open add dialog: reset form / clear error / open dialog / pull candidates /
 * **reset `FolderBrowser` inside `nextTick`**.
 * 🔴 that `reset()` call is essential: when dialog closes, `FolderBrowser`'s internal `current` / `entries`
 * still sit on the directory from last browse; skipping reset means next open shows previous state.
 * 🔴 `nextTick` also essential: at moment `adding = true` executes, `DialogContent` not yet rendered,
 * `fb.value` still null.
 */
function openAdd(): void {
  form.value = emptyForm()
  addError.value = ''
  mirrorOffer.value = false
  adding.value = true
  store.loadCandidates()
  nextTick(() => {
    fb.value?.reset()
  })
}

/** Reference `:161-163` — do not fill empty path (clicking root breadcrumb, `FolderBrowser` doesn't emit anyway). */
function onBrowsePick(path: string): void {
  if (path) form.value.path = path
}

/**
 * Reference `:164-174` — 🔴 **decision R9: message direction not a bug**, full reasoning in file header.
 * in a nutshell: `setRootEnabled` updates `root.enabled` in-place **before** `await`,
 * and `r` and store's `root` are **same object** ⇒ read here is already new state.
 * failure path rolls back and `throw` ⇒ enters catch, success toast never executes.
 * N51: 404 is **dedicated message** (specific hint for backend lag), copy; others use K58 form A.
 */
async function toggle(r: WikiRoot): Promise<void> {
  try {
    await store.setRootEnabled(r.id, !r.enabled)
    store.toast(r.enabled ? t('aiKbRtRootEnabled') : t('aiKbRtRootDisabled'))
  } catch (e) {
    store.toast(httpStatus(e) === 404 ? t('aiKbRtBackendTooOld') : t('aiKbOpFailed'))
  }
}

/** Reference `:175-182`. K58 form A: on failure show only fixed key, don't echo backend body. */
async function rescan(r: WikiRoot): Promise<void> {
  try {
    await store.rescanRoot(r.id)
    store.toast(t('aiKbRescanStarted'))
  } catch {
    store.toast(t('aiKbOpFailed'))
  }
}

/**
 * Reference `:183-208`.
 * · `submitting` gate is reference's own (governance §5.2), copy — repeated clicks don't send second request.
 * · **K59**: errors always go to `addError` (inline in dialog), **no toast**.
 * · **N50**: 409 → read-only message + "Add as Mirror" button (that button calls `submit(true)`).
 * · **K58**: non-409 branch reference echoes `e.response.data.message`, this repo uses fixed key.
 * · **N46**: body always via shared package `createRootBody`, three params `watchMode` / `scanIntervalH` /
 *   `mirror` must be actually passed — lost params backend **silently ignores**, no error on device.
 */
async function submit(mirror: boolean): Promise<void> {
  if (!canSubmit.value || submitting.value) return
  submitting.value = true
  addError.value = ''
  mirrorOffer.value = false
  try {
    await store.createRoot(
      createRootBody({
        path: form.value.path,
        watchMode: form.value.watchMode,
        scanIntervalH: form.value.hours,
        mirror,
      }),
    )
    adding.value = false
    store.toast(t('aiKbRtRootAdded'))
  } catch (e) {
    if (httpStatus(e) === 409) {
      addError.value = t('aiKbRtReadOnly')
      mirrorOffer.value = true
    } else {
      addError.value = t('aiKbOpFailed')
    }
  } finally {
    submitting.value = false
  }
}

/**
 * Reference `:209-219` — success/failure both close dialog and reset `purgeFiles`
 * (those two lines outside try/catch, copy as-is).
 */
async function confirmDelete(): Promise<void> {
  const r = deleting.value
  // TS null narrowing (reference has no such line); unreachable — function only callable from button inside dialog that only renders when `deleting` non-null.
  if (!r) return
  try {
    await store.deleteRoot(r.id, purgeFiles.value)
    store.toast(t('aiKbRtRootDeleted'))
  } catch {
    store.toast(t('aiKbOpFailed'))
  }
  deleting.value = null
  purgeFiles.value = false
}

/** K57 — delete dialog's state is object not boolean, `@update:open` needs a translation layer.
 *  🔴 reference's three close paths (× / cancel / click overlay) **all just set `deleting` to null**,
 *  **do not reset `purgeFiles`** (only `confirmDelete` resets, `:218`) — copy as-is. */
function onDeletingOpen(open: boolean): void {
  if (!open) deleting.value = null
}
</script>

<template>
  <div class="k-view">
    <div class="k-scroll">
      <div class="k-scroll-inner">
        <div class="k-section">
          <!-- Section header (reference :6-11) -->
          <div class="k-section-head">
            <div class="k-section-title">{{ t('aiKbNavRoots') }}</div>
            <div class="k-section-hint">{{ t('aiKbRtSubtitle') }}</div>
            <button class="k-btn primary" style="margin-left: auto" @click="openAdd">
              <KIcon name="plus" :size="12" /> {{ t('aiKbRtAddRoot') }}
            </button>
          </div>
          <div class="k-section-body">
            <!-- Empty state (reference :13-19) — 🔴 §9.17: this machine `/v1/wiki/roots` times out ⇒ this is the only reachable state. -->
            <div v-if="!roots.length && !store.wikiRootsLoading" class="kr-empty">
              <!-- Reference :15's `color="var(--text-tertiary)"` is already a token, copy (appendix B §B.5). -->
              <KIcon name="folder" :size="28" color="var(--text-tertiary)" />
              <div>{{ t('aiKbRtEmpty') }}</div>
              <button class="k-btn primary" @click="openAdd">
                <KIcon name="plus" :size="12" /> {{ t('aiKbRtAddRoot') }}
              </button>
            </div>
            <!-- List (reference :20-40) -->
            <div v-else class="k-set-card" style="margin: 12px 16px">
              <div v-for="r in roots" :key="r.id" class="k-set-row">
                <div class="k-set-row-info">
                  <div class="k-set-row-title kr-path" :data-off="String(!r.enabled)">
                    {{ r.path }}
                  </div>
                  <div class="k-set-row-desc">
                    <span class="kr-badge">{{
                      r.watchMode === 'auto' ? t('aiKbRealtimeWatch') : t('aiKbScheduledScanOnly')
                    }}</span>
                    ·
                    {{ t('aiKbRtScanEvery', { h: Math.max(1, Math.round(r.scanIntervalS / 3600)) }) }}
                    · {{ t('aiKbLastScan') }} {{ r.lastScanAt ? fmtAgo(r.lastScanAt) : t('aiKbNever') }}
                  </div>
                </div>
                <button
                  class="k-btn ghost"
                  :disabled="!r.enabled"
                  :title="t('aiKbRtRescanNow')"
                  @click="rescan(r)"
                >
                  <KIcon name="refresh" :size="13" />
                </button>
                <button class="k-btn ghost" :title="t('aiKbRtDelete')" @click="deleting = r">
                  <KIcon name="trash" :size="13" />
                </button>
                <button class="k-sw" :data-on="String(r.enabled)" @click="toggle(r)" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Add modal (reference :43-91) — K57: reka Dialog primitives, portal to knowledge container.
         reference's "overlay click closes / click inside doesn't close" expressed equivalently by DialogContent's pointerDownOutside. -->
    <DialogRoot :open="adding" @update:open="adding = $event">
      <DialogPortal to=".knowledge-app" defer>
        <DialogOverlay class="k-modal-bg">
          <DialogContent class="k-modal" :aria-describedby="undefined">
            <div class="k-modal-head">
              <DialogTitle as-child>
                <div class="k-modal-title">{{ t('aiKbRtAddRoot') }}</div>
              </DialogTitle>
              <button class="k-modal-x" @click="adding = false">
                <KIcon name="x" :size="12" />
              </button>
            </div>
            <div class="k-modal-body">
              <FolderBrowser
                ref="fb"
                style="margin-top: 0"
                :roots="browserRoots"
                @pick="onBrowsePick"
              />

              <div class="kr-label">{{ t('aiKbRtSelectedPath') }}</div>
              <input
                v-model.trim="form.path"
                class="kr-input"
                type="text"
                placeholder="/DATA"
                spellcheck="false"
              />

              <button
                class="k-adv-toggle"
                style="margin-top: 12px"
                :data-open="String(form.advOpen)"
                @click="form.advOpen = !form.advOpen"
              >
                <span class="chev"><KIcon name="chev" :size="11" /></span>
                <KIcon name="settings" :size="12" />
                {{ t('aiKbRtAdvancedOptions') }}
              </button>
              <template v-if="form.advOpen">
                <div class="kr-adv-row">
                  <span>{{ t('aiKbRtWatchMode') }}</span>
                  <div class="k-radio-group">
                    <button
                      :data-on="String(form.watchMode === 'auto')"
                      @click="form.watchMode = 'auto'"
                    >
                      {{ t('aiKbRtWatchAuto') }}
                    </button>
                    <button
                      :data-on="String(form.watchMode === 'scan_only')"
                      @click="form.watchMode = 'scan_only'"
                    >
                      {{ t('aiKbRtWatchScanOnly') }}
                    </button>
                  </div>
                </div>
                <div class="kr-adv-row">
                  <span>{{ t('aiKbRtScanInterval') }}</span>
                  <input
                    v-model.number="form.hours"
                    class="kr-input"
                    style="width: 90px"
                    type="number"
                    min="1"
                  />
                </div>
              </template>

              <!-- K59 — error inline in dialog (not a toast: toast z-index 60, overlay 1000 would cover it). -->
              <div v-if="addError" class="kr-error">
                <KIcon name="danger" :size="12" />
                <span>{{ addError }}</span>
                <!-- N50: mirror backend unimplemented, but UI copies 1:1, do not delete this button. -->
                <button v-if="mirrorOffer" class="k-btn outline" @click="submit(true)">
                  {{ t('aiKbRtAddMirror') }}
                </button>
              </div>
            </div>
            <div class="k-modal-foot">
              <button class="k-btn outline" @click="adding = false">{{ t('aiKbCancel') }}</button>
              <button
                class="k-btn primary"
                :disabled="!canSubmit || submitting"
                @click="submit(false)"
              >
                <KIcon name="plus" :size="12" /> {{ t('aiKbAdd') }}
              </button>
            </div>
          </DialogContent>
        </DialogOverlay>
      </DialogPortal>
    </DialogRoot>

    <!-- Delete confirm modal (reference :93-120) -->
    <DialogRoot :open="!!deleting" @update:open="onDeletingOpen">
      <DialogPortal to=".knowledge-app" defer>
        <DialogOverlay class="k-modal-bg">
          <DialogContent class="k-modal" :aria-describedby="undefined">
            <div class="k-modal-head">
              <DialogTitle as-child>
                <div class="k-modal-title">{{ t('aiKbRtDeleteTitle') }}</div>
              </DialogTitle>
              <button class="k-modal-x" @click="deleting = null">
                <KIcon name="x" :size="12" />
              </button>
            </div>
            <div class="k-modal-body">
              <div class="kr-path" style="margin-bottom: 10px">{{ deleting?.path }}</div>
              <label class="kr-check">
                <input v-model="purgeFiles" type="checkbox" />
                {{ t('aiKbRtPurgeFiles') }}
              </label>
              <div class="kr-hint">{{ t('aiKbRtDeleteHint') }}</div>
            </div>
            <div class="k-modal-foot">
              <button class="k-btn outline" @click="deleting = null">{{ t('aiKbCancel') }}</button>
              <button class="k-btn danger" @click="confirmDelete">
                <KIcon name="trash" :size="12" /> {{ t('aiKbRtDelete') }}
              </button>
            </div>
          </DialogContent>
        </DialogOverlay>
      </DialogPortal>
    </DialogRoot>
  </div>
</template>
