<!--
  SP8-P5b Task 8 — "Indexed Files" page, cut 1: skeleton + filter bar + head meta +
  error banner + skeleton screen + empty state. 1:1 ported from Vue2 reference
  `NimoOS-UI` (main@7a6ee6b7) `src/views/AI/Knowledge/IndexedFilesView.vue`
  (826 lines, read via `git show main:`; codebase review §1: worktree is an
  old branch and untrustworthy).

  🔴 This file is built over three cuts (T8→T9→T10) and cannot be done in parallel.
  **This cut's scope strictly covers lines :1-142 of the reference template +
  corresponding script**, everything else (:143 onward with ready-state table +
  pagination + file details + batch action bar + full-rebuild modal etc) is not
  ported at all — intentionally left for T9/T10:
    - `pageState === 'ready'` branch (table body, pagination, row detail expand) — T9/T10
    - `selectedCount`/`overExplicitCap`/`rebuildRow`/`rebuildSelected`/
      `openRebuildAllConfirm`/`doRebuildAll` etc. action bar and confirm modal — T9/T10
    - `expSet`/`doneSet` (row expand / green flash feedback) — only used in T9/T10
    - `EXPLICIT_REBUILD_CAP` (action bar exclusive limit; this cut uses
      `FILTER_REBUILD_CAP` for error banner only) — T9/T10
  The DOM within this cut's scope (skeleton container / 7 filter controls /
  head meta / error banner / skeleton screen / empty state) is complete — no
  partial tags, no TODOs, no hollow "T9 to fill" shells.

  Structure mapping (reference line range → this file):
    :1-5     .k-view / .k-scroll / .k-scroll-inner skeleton container
    :6-57    7 filter controls (Root dropdown / path prefix / type prefix /
             status dropdown / failed-only / clear button — 6 visible controls,
             7 is task spec count including clear button)
    :60-90   head meta: {n} indexed files + statusSuffix · "auto-refresh · 30s"
             when isAnyIndexing · sort dropdown + sort direction button
    :93-103  error banner (K14 / K19, see below)
    :106-132 skeleton screen (k-ftable dummy head + 8 rows of k-skel placeholders)
    :135-142 empty state (includes .k-empty-btn from N10)

  【K13】Remove from reference `selTick`/`expTick`/`doneTick` (Vue2 workaround
  for Set change detection that Vue3 doesn't need — ref replacement triggers
  reactivity automatically). This cut only uses `selSet` (cleared in
  `_applyFilter`); `expSet`/`doneSet` are T9/T10 things, not declared here.

  【N10】Reference line :139's `.k-empty-btn` is an undefined class in the
  reference itself (`git grep k-empty-btn main` hits only this template line;
  `knowledge.scss` has no such rule). Copy the class name as-is, renders as
  unstyled button matching Vue2 — **do not add to `knowledgeStyles.test.ts`
  whitelist** (it's not an scss class).

  【N12】`statusViewLocal` and `onStatusViewChange` handle reference lines :496-501
  (read) / :658-664 (write) `active` ↔ `alive` bidirectional mapping — reference
  has a comment "prototype says active, API wants alive". UI has three values
  `active`/`tombstoned`/`all`; API side `tombstoned` field has three values
  `alive`/`tombstoned`/`all`. **Copy both directions exactly; don't try to
  "unify into one name".**

  【K14】rebuild-all 400 branch (`errorBanner` truthy) does not display backend
  `detail` — warning bar only shows `400 Bad Request` + reference's i18n string
  (`aiKbRebuildCapHint`). 🔴 The `doRebuildAll()` that sets `errorBanner` to a
  non-null value (reference :791-809, corresponding confirm modal :356-381) is
  T9/T10 scope — not declared in this cut. But `errorBanner` ref itself and its
  display branch (:93-103) are within this cut's scope, so this cut gets the
  display logic right: when T9/T10 later stores backend `detail` in
  `errorBanner.value`, this branch will never render it.

  【K19】Load error banner (`storeError` truthy, `errorBanner` falsy branch) does
  not display `e.message` (reference shows `{{ storeError }}`, where `storeError`
  comes from `loadIndexedFiles` catch setting `s.error = e.message`,
  knowledgeStore.ts:459); instead use fixed `aiKbLoadErrorBody`, same pattern as
  P5a's `loadRoots`/`aiKbOpFailed`.

  【filters still in store】`store.indexedFiles.filters.xxx` — codebase review
  P5a §5 settled on "copy as-is", don't move filters into component local state.

  【_applyFilter semantics】Four things, all essential: zero offset + clear
  selection (selSet) + clear errorBanner + reload (refresh() = loadIndexedFiles
  then startIndexedPolling). `clearFilters()` resets six filter fields then
  directly calls `_applyFilter()` (reference code repeats those four lines
  inside `clearFilters` as well — identical to `_applyFilter`, mechanical
  deduplication, not a behavior change).

  【Lifecycle】`onMounted` → `refresh()` (loadIndexedFiles first, then
  startIndexedPolling), corresponds to reference `created()`. `onUnmounted` →
  stop polling, corresponds to reference `beforeDestroy()` — even though the task
  spec only mentions created half, this cut may start 30s polling at mount time
  (when `isAnyIndexing` is true); `startIndexedPolling`'s timer handle is a
  **module-level** variable in knowledgeStore.ts (shared across Pinia instances),
  and leaving it running would let a test mount's timer persist and trigger
  `startIndexedPolling`'s own guard (`if (indexedPollTimer) return`), polluting
  subsequent tests/mounts — same lesson as T5(M-4), so add this necessary
  lifecycle symmetry; it doesn't count as "early-porting T9/T10 stuff".

  【Colors】Appendix B confirmed this file's template has zero inline color
  literals and doesn't need §B.0's color-mix mapping; guard gap ③
  (color-guard doesn't scan template `style=`) still exists; tests compensate
  with targeted assertions matching T5's pattern.

  ══════════════════════════════════════════════════════════════════════
  SP8-P5b Task 9 — Cut 2: table header row + file rows · inline detail panel ·
  pagination (reference :146-317). This cut lands the placeholder section T8 left.

  Structure mapping (reference line range → this file):
    :148-165 header row (select-all checkbox + 7 column titles)
    :168-259 file rows: three attribute states (data-selected/data-status/data-done)·
             statusBadgeMap four-state badges (N14)· path cell (errhint/zerohint)·
             type tag (simplifyMime + Legacy)· size/time · vector count
             (data-zero)· rebuild button (three title variants)· expand button (data-open)
    :261-293 inline detail panel: 5 field rows (tombstoned_at conditional) + last_error row
    :298-317 pagination: currentPage/pageCount/pageFrom/pageTo calculations · 4-tier
             per-page options · prev/next disabled conditions

  【N14, 🔴 easiest to break】Reference's `statusBadgeMap` `en` field is dual-use:
  (:191's `title` shows untranslated English; :197's badge text uses `$t()` to show
  translated Chinese, relying on "English string = i18n key" coincidence). New-UI's
  keys are aiKb*, so coincidence breaks; split into two fields `en` (title only)
  and `key` (badge text only), don't merge. K20: `indexing` key `aiKbStatusIndexing`
  fills both branches with English `Indexing` (Vue2 language pack never had this key,
  fallback shows English original; New-UI copies exact same appearance). `badgeFor()`
  fallback when not found (reference :190/:194): data-s falls back to 'ok',
  title/text fall back to file.status string, icon falls back to 'check'.

  【N13】`.k-status-badge-cn` (reference :197) is an undefined class in reference
  itself (`git grep k-status-badge-cn main` hits only this template line;
  `knowledge.scss` has no rule). Copy the class name, **don't add to**
  `knowledgeStyles.test.ts` whitelist (it's not an scss class), same treatment as N10.

  【tomb glyph】KIcon's `tomb` glyph is not a literal `name="tomb"` in this
  file's template — it comes dynamically via `statusBadgeMap.tombstoned.icon`
  (codebase review §1.2 confirmed it exists; don't change KIcon.vue just because
  grep doesn't find the literal — it's on the zero-change list).

  【K13, expSet】`toggleExpand` uses `expSet = ref(new Set())`, replaces the
  whole ref to trigger reactivity, doesn't use reference's `expTick` (Vue2 forced-
  refresh workaround Vue3 ref replacement doesn't need).

  【doneSet read-only in this cut】`doneSet` declared as empty `ref(new Set())`,
  `data-done` binds it but this cut's code never writes to it — `_flashDone`
  (reference :811-823, green flash after rebuild success) stays in T10. Tests
  cover the "real" side of `data-done` using T8's established technique
  `(w.vm as unknown as {...}).xxx` for direct read-write of `<script setup>`
  internal refs (same as errorBanner), not a new functionality entry point.

  【rebuildRow is documentation placeholder in this cut】Button's disabled
  condition / three title variants / icon switching are in scope (reference
  :225-244, DOM complete), but the `@click` handler's full implementation (store
  dispatch + toast + startIndexedPolling + `_flashDone`, reference :760-770)
  requires writing `doneSet` — prior note says this cut keeps `doneSet` read-only,
  so leave this function body as empty placeholder; T10 replaces just the body,
  doesn't touch button DOM or call sites. This is the only place in this cut that
  "declares but leaves body empty", will be highlighted in the report.

  【Select-all checkbox: both read and write in this cut】`selSet` is declared
  in T8; this cut adds `toggleRow`/`toggleAll`/`selectablePageIds`/`allSelected`/
  `someSelected` (with indeterminate watch) — these are self-contained pure Set
  operations not depending on any HTTP dispatch or T10-only things (unlike
  rebuildRow), so treat same as K13's `toggleExpand`, land real read-write, no
  placeholder. `selectedCount` / `overExplicitCap` / `rebuildSelected` / bottom
  action bar / full-rebuild confirm modal are T10's "selection" scope (depends on
  batch rebuild HTTP dispatch).

  【This cut still doesn't do (left for T10)】`EXPLICIT_REBUILD_CAP`,
  `selectedCount`, `overExplicitCap`, `rebuildSelected`, `openRebuildAllConfirm`,
  `doRebuildAll`, `showRebuildAllConfirm`, bottom action bar (`.k-files-actionbar`),
  full-rebuild confirm modal, `_flashDone` (above), 30s polling's
  `startIndexedPolling()` call inside rebuild actions, route reversal.
  ══════════════════════════════════════════════════════════════════════
  SP8-P5b Task 10 — Cut 3 (final): three rebuild entry points + dual limits +
  K7 confirm modal + sticky bottom action bar + polling closure + route reversal.
  **From here, all 826 lines of reference are landed; this file has no more
  placeholders, empty bodies, or TODOs.**

  Structure mapping (reference line range → this file):
    :322-353 sticky bottom action bar (`.k-files-actionbar` + `data-active`)
    :355-381 full-rebuild confirm modal (K7 use reka primitives, see below)
    :392     `EXPLICIT_REBUILD_CAP = 500` (front-end hard block)
    :464     `showRebuildAllConfirm` local switch
    :484-485 `selectedCount` / `overExplicitCap`
    :760-770 `rebuildRow` (T9's empty placeholder, filled in this cut)
    :772-784 `rebuildSelected`
    :786-789 `openRebuildAllConfirm`
    :791-809 `doRebuildAll` (note: function's closing `},` is at :809; :808 is
             inner catch close — T8 report said :791-808, off by 1; corrected
             above in【K14】section's line refs)
    :811-823 `_flashDone` (2200 ms green flash)

  【Dual limits, reference :392-393 / codebase review §4.4】Two constants with
  different semantics; don't mix them up:
    - `EXPLICIT_REBUILD_CAP = 500` — backend `MAX_REINDEX_FILE_IDS`
      (`service_reindex.py:26`, condition `len < 1 || len > 500`).
      **Front-end hard blocks**: `overExplicitCap` = `selectedCount > 500` →
      "rebuild selected" button disabled + action bar warning; also check again
      in `rebuildSelected` and return directly (belt-and-suspenders; reference
      :773 has this line, not redundant).
      🔴 Boundary is strict greater-than: 500 files OK, 501 blocked.
    - `FILTER_REBUILD_CAP = 10000` — backend `MAX_REINDEX_BY_FILTER`
      (`service_files.py:205`, condition `n > 10000`).
      **Front-end warns only, doesn't block**: embed over-limit banner in modal
      (when `total > 10000`), button still clickable, real block is backend →
      400 status triggers K14's warning bar.
      🔴 Also strict greater-than: 10000 no banner, 10001 shows banner.

  【K7, 🔴 SP8 broke three times on this】Full-rebuild confirm modal uses reka
  primitives `DialogRoot > DialogPortal to=".knowledge-app" defer > DialogOverlay
  .k-modal-bg > DialogContent .k-modal`, no bare `<div class="k-modal-bg">`
  hand-rolled, no `Teleport to="body"`. Structure copies exactly from T5's
  `QueueView.vue:559-583` template (includes reka a11y requirements
  `VisuallyHidden > DialogTitle` and `:aria-describedby="undefined"`). Reference
  :356's "click backdrop to close" / :357's `@click.stop` "click inside modal
  doesn't close" equivalent provided by DialogContent's pointerDownOutside
  (T5 has a test for this mechanism; this cut uses the same pattern). Visual DOM
  still uses reference's `.k-confirm-body` / `.k-confirm-summary` /
  `.k-modal-foot > .right` structure; K17's `.k-modal-head` etc 4 classes not
  ported this time — reference's modal doesn't use them either.

  【K14, real write entry point now complete】This cut adds `doRebuildAll` so
  `errorBanner` now has a real write entry. **Per T8's design, catch stores
  backend `detail` per reference :805-807 into `errorBanner` (value unchanged);
  K14's guarantee is in the render layer** — the :625-640 branch only renders
  fixed `400 Bad Request` + `aiKbRebuildCapHint`, backend detail never appears.
  This way the reverse assertion is truly end-to-end (400 with detail → DOM
  lacks detail), not just testing a manually-stuffed ref string.

  【K5】`rebuildRow` / `rebuildSelected` catch doesn't display `e.message`
  (reference :768 / :782 show `$t('Rebuild failed') + ': ' + e.message`);
  use fixed `aiKbRebuildFailed` instead, no second phrase to concatenate so
  no `': '` prefix — same pattern as T5's `QueueView.vue` bulkCancel/cancelOne
  etc. catch branches.

  【Attribute binding, appendix D §D.3 + codebase review §12 E-9】`.k-files-actionbar`'s
  `:data-active="selectedCount > 0"` **doesn't wrap in `String()`** — reference
  :323 doesn't wrap it either (appendix D §D.3 marks ❌ no wrap; E-9 read Vue 3's
  `patchAttr` source proving `data-*` isn't special boolean, `false` still renders
  as `"false"`, wrapping or not produces identical output, so per E-9's verdict
  "copy reference exactly at each site").
  🔴 This cut's brief §4 saying "wrap in String(), copy reference" is self-
  contradictory (reference doesn't wrap); resolved per authoritative sources
  (appendix D + codebase review §12 E-9 + reference text) and copied unwrapped;
  reported above.

  【_flashDone's setTimeout doesn't cleanup on unmount】Reference :817-822 has
  no cleanup, copy as-is. The 2200 ms callback just replaces one `ref` with a
  new `Set`; when component unmounts the write triggers no render, holds no DOM
  ref, is not "reproducible error behavior", so not in scope per codebase review
  §2 criteria. Tests use fake timers to advance within controlled bounds.

  【Polling closure】Three rebuild entry points each call `store.startIndexedPolling()`
  once on success (reference :764 / :780 / :803). `onMounted → refresh()`
  (contains `startIndexedPolling`) and `onUnmounted → stopIndexedPolling()`
  **T8 already lands completely** (see【Lifecycle】section above), this cut makes
  zero changes.
  ══════════════════════════════════════════════════════════════════════
-->
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
// T10:K7 — confirm modal uses reka primitives, structure copies T5's
// QueueView.vue template.
import {
  DialogRoot,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
  VisuallyHidden,
} from 'reka-ui'
import KIcon from '../components/KIcon.vue'
import { useKnowledgeStore, type IndexedFile } from '../stores/knowledgeStore'
import { anyIndexing } from '../util/indexedFiles'
import { fmtBytes, fmtRel, fmtAbs, simplifyMime, topSegment } from '../util/indexedFilesView'

const { t } = useI18n()
const store = useKnowledgeStore()

/** Reference :393 — filter mode limit, **front-end warns only, doesn't block**
 * (real block in backend, over-limit returns 400 triggering K14's warning bar).
 * Used in two places: condition for over-limit banner in modal, and parameter
 * for K14's warning text. Backend constant `MAX_REINDEX_BY_FILTER = 10000`
 * (`service_files.py:205`, condition `n > 10000` — strict greater-than,
 * 10000 doesn't trigger). */
const FILTER_REBUILD_CAP = 10000

/** T10: Reference :392 — explicit file_ids mode limit, **front-end hard blocks**
 * (button disabled + action bar warning + return again in `rebuildSelected`).
 * Backend constant `MAX_REINDEX_FILE_IDS = 500` (`service_reindex.py:26`,
 * condition `len(file_ids) < 1 || len(file_ids) > 500` — strict greater-than,
 * 500 files OK). */
const EXPLICIT_REBUILD_CAP = 500

/** K13 — this cut only uses selSet (cleared in `_applyFilter`). */
const selSet = ref<Set<string>>(new Set())

/** Reference's data() `errorBanner` (:465) — error banner for rebuild-all 400
 * branch, see 【K14】 in file head comment. */
const errorBanner = ref<string | null>(null)

/** T9: K13, row expand — see 【K13, expSet】 in file head comment. */
const expSet = ref<Set<string>>(new Set())

/** T9 declares, T10 writes: Reference doneSet (:457) — collection for 2200 ms
 * green flash after rebuild success; write entry is `_flashDone` added in this
 * cut (reference :811-823). */
const doneSet = ref<Set<string>>(new Set())

/** T10: Reference's data() `showRebuildAllConfirm` (:464) — full-rebuild confirm
 * modal toggle, page-level transient state, component local ref (codebase
 * review §5). */
const showRebuildAllConfirm = ref(false)

/** T9: Reference `ref="selectAllRef"` (:155) — imperatively set checkbox
 * indeterminate (HTML has no declarative indeterminate attribute). */
const selectAllRef = ref<HTMLInputElement | null>(null)

// ── computed (reference's computed section, those used in this cut's scope) ──

const total = computed<number>(() => store.indexedFiles.total)

/** T9: Reference files (:475) — direct alias to store's file array, avoids
 * repeating `store.indexedFiles.files` in template. */
const files = computed<IndexedFile[]>(() => store.indexedFiles.files)
const storeError = computed<string | null>(() => store.indexedFiles.error)

/** Reference pageState — loading takes priority over empty; empty condition is
 * total === 0. */
const pageState = computed<'loading' | 'empty' | 'ready'>(() => {
  if (store.indexedFiles.loading) return 'loading'
  if (total.value === 0) return 'empty'
  return 'ready'
})

/** Reference isAnyIndexing — reuse `anyIndexing` from P5a's zero-change list. */
const isAnyIndexing = computed<boolean>(() => anyIndexing(store.indexedFiles.files))

/** N12 (read direction) — API `tombstoned` field's `alive` maps back to UI's
 * `active`; other two values pass through as-is. */
const statusViewLocal = computed<'active' | 'tombstoned' | 'all'>(() => {
  const tv = store.indexedFiles.filters.tombstoned
  if (tv === 'alive') return 'active'
  if (tv === 'tombstoned') return 'tombstoned'
  return 'all'
})

/** Reference statusSuffix — when not "active-only", append parenthetical status
 * view to file count. */
const statusSuffix = computed<string>(() => {
  const v = statusViewLocal.value
  if (v === 'tombstoned') return ' (' + t('aiKbStatusRemoved') + ')'
  if (v === 'all') return ' (' + t('aiKbAll') + ')'
  return ''
})

/** Reference filtersDirty — six conditions, all essential: path_prefix /
 * mime_prefix / has_error any truthy, or tombstoned/sort/order any non-default. */
const filtersDirty = computed<boolean>(() => {
  const f = store.indexedFiles.filters
  return !!(
    f.path_prefix ||
    f.mime_prefix ||
    f.has_error ||
    f.tombstoned !== 'alive' ||
    f.sort !== 'indexed_at' ||
    f.order !== 'desc'
  )
})

/** Reference derivedRoots — best-effort: derive from first path segment of
 * loaded files on current page, not authoritative server Root list (reference's
 * own comment says so). */
const derivedRoots = computed<string[]>(() => {
  const segs = new Set<string>()
  store.indexedFiles.files.forEach((f) => {
    const path = f.paths && f.paths[0] ? f.paths[0].path : null
    const seg = topSegment(path)
    if (seg) segs.add(seg)
  })
  return Array.from(segs).sort()
})

/** Reference rootSelect — reverse-infer Root dropdown's display value from
 * `path_prefix`: only show the segment if `path_prefix` matches `/<seg>/` and
 * `<seg>` is actually in `derivedRoots`; otherwise fall back to `'all'`
 * (includes user hand-typed prefix or Root no longer in current page data). */
const rootSelect = computed<string>(() => {
  const pp = store.indexedFiles.filters.path_prefix
  if (!pp) return 'all'
  const m = pp.match(/^\/([^/]+)\/$/)
  if (m && derivedRoots.value.includes(m[1])) return m[1]
  return 'all'
})

// ── T9: statusBadgeMap (N14) — see 【N14】 in file head comment. `en` for
// :title only (original English, untranslated), `key` for badge text only
// (i18n key, renders Chinese). Reference :573-580. ──

interface StatusBadgeEntry {
  en: string
  key: string
  icon: string
  cls: string
}
const statusBadgeMap: Record<string, StatusBadgeEntry> = {
  ok: { en: 'Indexed', key: 'aiKbStatusIndexed', icon: 'check', cls: 'ok' },
  indexing: { en: 'Indexing', key: 'aiKbStatusIndexing', icon: 'spinner', cls: 'indexing' },
  error: { en: 'Error', key: 'aiKbStatusError', icon: 'x', cls: 'error' },
  tombstoned: { en: 'Removed', key: 'aiKbStatusRemoved', icon: 'tomb', cls: 'tombstoned' },
}

/** Reference :190/:194 fallback branch — return `null` when not found; ternary
 * expressions at call sites each fall back to data-s='ok' / title=file.status /
 * icon='check' / text=file.status. */
function badgeFor(status: string | undefined): StatusBadgeEntry | null {
  return status ? (statusBadgeMap[status] ?? null) : null
}

/** T9: In `knowledgeStore.ts` (zero-change file), `IndexedFile.indexed_at` /
 * `tombstoned_at` are type-annotated as `string`, but fixtures / real device
 * actually provide millisecond timestamps `number` (matching `fmtRel`/`fmtAbs`
 * parameter types) — existing type annotation oversight; this cut doesn't change
 * store, uses this conversion point to absorb type mismatch, avoids sprinkling
 * `as` assertions in template. */
function ms(v: unknown): number | null | undefined {
  return v as number | null | undefined
}

/** Reference filePath (:610-612) — extract `paths[0].path` only, or `'—'`. */
function filePath(file: IndexedFile): string {
  return file.paths && file.paths[0] ? file.paths[0].path : '—'
}

/** Reference fileModalityKeys (:614-616). */
function fileModalityKeys(file: IndexedFile): string[] {
  return Object.keys(file.modalities_done || {})
}

// ── T9: Multi-select (read+write, see 【Select-all checkbox: both read and
// write in this cut】 in file head comment) ──

/** Reference selectablePageIds (:533-536) — selectable rows on current page
 * (non-tombstoned). */
const selectablePageIds = computed<string[]>(() =>
  files.value.filter((f) => f.status !== 'tombstoned').map((f) => f.file_id),
)
const allSelected = computed<boolean>(() => {
  const ids = selectablePageIds.value
  return ids.length > 0 && ids.every((id) => selSet.value.has(id))
})
const someSelected = computed<boolean>(() =>
  selectablePageIds.value.some((id) => selSet.value.has(id)),
)

/** T10: Reference selectedCount (:484) / overExplicitCap (:485) — condition is
 * **strict greater-than** `EXPLICIT_REBUILD_CAP`: 500 files not over limit
 * (backend `len > 500` gives 400), 501 files over. */
const selectedCount = computed<number>(() => selSet.value.size)
const overExplicitCap = computed<boolean>(() => selectedCount.value > EXPLICIT_REBUILD_CAP)

// ── T9: Pagination (reference :519-530) — four calculations, boundary logic
// copied exactly: pageCount uses Math.max(1, …) to ensure at least 1 page;
// pageTo uses Math.min to clamp to total, never exceeds. ──

const currentPage = computed<number>(() => {
  const f = store.indexedFiles.filters
  return f.limit > 0 ? Math.floor(f.offset / f.limit) : 0
})
const pageCount = computed<number>(() =>
  Math.max(1, Math.ceil(total.value / store.indexedFiles.filters.limit)),
)
const pageFrom = computed<number>(() =>
  total.value === 0 ? 0 : store.indexedFiles.filters.offset + 1,
)
const pageTo = computed<number>(() =>
  Math.min(store.indexedFiles.filters.offset + store.indexedFiles.filters.limit, total.value),
)

// ── T9: indeterminate watch (reference :583-592) — HTML checkbox has no
// declarative indeterminate attribute, must set imperatively. ──

watch(someSelected, (val) => {
  const cb = selectAllRef.value
  if (cb) cb.indeterminate = val && !allSelected.value
})
watch(allSelected, () => {
  const cb = selectAllRef.value
  if (cb) cb.indeterminate = someSelected.value && !allSelected.value
})

// ── lifecycle ──

/** Reference refresh() — load first, after load completes decide whether to
 * start 30s polling (`startIndexedPolling` internally checks `isAnyIndexing`
 * to decide). */
async function refresh(): Promise<void> {
  await store.loadIndexedFiles()
  store.startIndexedPolling()
}

onMounted(() => {
  refresh()
})

/** 蓝本 beforeDestroy() —— 见文件头注释,停轮询防止 store 模块级定时器句柄
 * 泄漏到下一个挂载实例。 */
onUnmounted(() => {
  store.stopIndexedPolling()
})

// ── filter actions(全部落到 `_applyFilter`:offset 归零 + 清选择 + 清错误
// 横幅 + 重载,一件都不能少)──

function _applyFilter(): void {
  store.indexedFiles.filters.offset = 0
  selSet.value = new Set()
  errorBanner.value = null
  refresh()
}

function onPathPrefixInput(e: Event): void {
  store.indexedFiles.filters.path_prefix = (e.target as HTMLInputElement).value
  _applyFilter()
}

function clearPathPrefix(): void {
  store.indexedFiles.filters.path_prefix = ''
  _applyFilter()
}

function onMimePrefixInput(e: Event): void {
  store.indexedFiles.filters.mime_prefix = (e.target as HTMLInputElement).value
  _applyFilter()
}

function clearMimePrefix(): void {
  store.indexedFiles.filters.mime_prefix = ''
  _applyFilter()
}

function setLegacyDoc(): void {
  store.indexedFiles.filters.mime_prefix = 'application/legacy-office/'
  _applyFilter()
}

/** N12(写方向)—— UI `active` 映射回 API 的 `alive`,其余两值原样透传。 */
function onStatusViewChange(e: Event): void {
  const v = (e.target as HTMLSelectElement).value
  store.indexedFiles.filters.tombstoned = v === 'active' ? 'alive' : v
  _applyFilter()
}

function onHasErrorChange(e: Event): void {
  store.indexedFiles.filters.has_error = (e.target as HTMLInputElement).checked
  _applyFilter()
}

function onRootSelectChange(e: Event): void {
  const seg = (e.target as HTMLSelectElement).value
  store.indexedFiles.filters.path_prefix = seg === 'all' ? '' : '/' + seg + '/'
  _applyFilter()
}

function onSortChange(e: Event): void {
  store.indexedFiles.filters.sort = (e.target as HTMLSelectElement).value
  _applyFilter()
}

function toggleSortDir(): void {
  store.indexedFiles.filters.order = store.indexedFiles.filters.order === 'asc' ? 'desc' : 'asc'
  _applyFilter()
}

/** 蓝本 clearFilters —— 复位六个筛选字段,再走与 `_applyFilter` 完全相同的
 * 四件事(见文件头注释,机械去重,非行为改动)。 */
function clearFilters(): void {
  const f = store.indexedFiles.filters
  f.path_prefix = ''
  f.mime_prefix = ''
  f.has_error = false
  f.tombstoned = 'alive'
  f.sort = 'indexed_at'
  f.order = 'desc'
  _applyFilter()
}

/** 蓝本 dismissBanner —— 同时清本地 errorBanner 与 store 侧的加载错误。 */
function dismissBanner(): void {
  errorBanner.value = null
  store.indexedFiles.error = null
}

// ── T9:多选(蓝本 :730-748)—— 见文件头注释【多选复选框:read+write 都在
// 本刀】,自包含纯 Set 操作,不依赖任何 T10 才有的东西。 ──

function toggleRow(fileId: string): void {
  const s = new Set(selSet.value)
  if (s.has(fileId)) s.delete(fileId)
  else s.add(fileId)
  selSet.value = s
}

function toggleAll(): void {
  const ids = selectablePageIds.value
  const s = new Set(selSet.value)
  if (allSelected.value) {
    ids.forEach((id) => s.delete(id))
  } else {
    ids.forEach((id) => s.add(id))
  }
  selSet.value = s
}

// ── T9:展开(蓝本 :751-757)—— K13:expSet 整体替换,不用 expTick。 ──

function toggleExpand(fileId: string): void {
  const s = new Set(expSet.value)
  if (s.has(fileId)) s.delete(fileId)
  else s.add(fileId)
  expSet.value = s
}

// ── T10:重建三入口(蓝本 :760-809)+ 绿闪(:811-823)。T9 留的 `rebuildRow`
// 空占位在此补全,按钮 DOM 与调用点一个字都没动。 ──

/** 后端 `POST /v1/parser/files/reindex` 的成功响应体形状(fixture
 * `p5b-fixtures/reindex-one.http` 实测:
 * `{"queued":1,"tombstoned":1,"job_ids":[349],"skipped":[]}`)。
 * store 的 `reindexIndexedByIds`/`reindexIndexedByFilter` 返回 `unknown`
 * (零改动文件),这里做一次收窄:蓝本三处只读 `res.queued`。 */
type ReindexResult = { queued?: number }

/**
 * 蓝本 rebuildRow(:760-770)—— 单行强制重建:
 *   ① `reindexIndexedByIds([fileId], 'rebuild row')`(store 内部会跟着重载列表)
 *   ② toast「已入队 {n} 个任务」,n 取响应体的 `queued`
 *   ③ `startIndexedPolling()` —— 刚入队的行会变 indexing,起 30 秒轮询盯着
 *   ④ `_flashDone([fileId])` —— 2200 ms 绿闪
 * catch 走 K5:固定 `aiKbRebuildFailed`,不回显 `e.message`(蓝本 :768 拼了
 * `': ' + e.message`,见文件头注释【K5】)。
 */
async function rebuildRow(fileId: string): Promise<void> {
  try {
    const res = (await store.reindexIndexedByIds([fileId], 'rebuild row')) as ReindexResult
    store.toast(t('aiKbQueuedNJobs', { n: res.queued }))
    store.startIndexedPolling()
    // brief green-flash
    _flashDone([fileId])
  } catch {
    store.toast(t('aiKbRebuildFailed'))
  }
}

/**
 * 蓝本 rebuildSelected(:772-784)—— 批量重建当前选中行。
 * 🔴 首行的 `if (selectedCount === 0 || overExplicitCap) return` 是蓝本 :773
 * 原文,与按钮的 `:disabled` 条件重复但**不是冗余**:键盘/程序化调用绕过
 * disabled 时它是唯一的拦。照抄。
 * 成功后清空选择(蓝本 :778,不清会让动作条一直显示旧计数)。
 */
async function rebuildSelected(): Promise<void> {
  if (selectedCount.value === 0 || overExplicitCap.value) return
  const ids = Array.from(selSet.value)
  try {
    const res = (await store.reindexIndexedByIds(ids, 'rebuild selected')) as ReindexResult
    store.toast(t('aiKbQueuedNJobs', { n: res.queued }))
    selSet.value = new Set()
    store.startIndexedPolling()
  } catch {
    store.toast(t('aiKbRebuildFailed'))
  }
}

/** 蓝本 openRebuildAllConfirm(:786-789)—— `total === 0` 直接 return(按钮此时
 * 也是 disabled,同 rebuildSelected 那条双保险)。 */
function openRebuildAllConfirm(): void {
  if (total.value === 0) return
  showRebuildAllConfirm.value = true
}

/**
 * 蓝本 doRebuildAll(:791-809)—— 按当前筛选整批重建。
 * 🔴 `filterObj` 只带**真值/非默认**的字段,四条判据逐字照抄蓝本 :796-799:
 *   `path_prefix` / `mime_prefix` / `has_error` 各自 truthy 才带;
 *   `tombstoned` 要 **truthy 且 `!== 'all'`** 才带 —— `'all'` 意为「不限」,
 *   带上去反而会把「不限」编码成一个具体的筛选值。
 * catch:照蓝本 :805-807 取后端 detail 存进 `errorBanner`,渲染层按 K14 不回显
 * (见文件头注释【K14,真实入口到齐】)。
 */
async function doRebuildAll(): Promise<void> {
  showRebuildAllConfirm.value = false
  // Build filter object from active, non-paging filters
  const f = store.indexedFiles.filters
  const filterObj: Record<string, unknown> = {}
  if (f.path_prefix) filterObj.path_prefix = f.path_prefix
  if (f.mime_prefix) filterObj.mime_prefix = f.mime_prefix
  if (f.has_error) filterObj.has_error = f.has_error
  if (f.tombstoned && f.tombstoned !== 'all') filterObj.tombstoned = f.tombstoned
  try {
    const res = (await store.reindexIndexedByFilter(
      filterObj,
      'rebuild all matching',
    )) as ReindexResult
    store.toast(t('aiKbQueuedNJobs', { n: res.queued }))
    store.startIndexedPolling()
  } catch (e) {
    const detail =
      (e as { response?: { data?: { detail?: string } } } | undefined)?.response?.data?.detail ||
      (e as Error | undefined)?.message ||
      String(e)
    errorBanner.value = detail
  }
}

/**
 * 蓝本 _flashDone(:811-823)—— 重建入队后给该行 2200 ms 的绿闪(`data-done`
 * 驱动 scss 的 `@keyframes row-done`)。K13:`doneSet` 整体替换,不用 doneTick。
 * 蓝本没有卸载清理,照抄(见文件头注释【_flashDone 的 setTimeout 不做卸载清理】)。
 */
function _flashDone(ids: string[]): void {
  const d = new Set(doneSet.value)
  ids.forEach((id) => d.add(id))
  doneSet.value = d
  setTimeout(() => {
    const d2 = new Set(doneSet.value)
    ids.forEach((id) => d2.delete(id))
    doneSet.value = d2
  }, 2200)
}

// ── T9:分页(蓝本 :718-727,onPageSizeChange 见 :691-697)──

function prevPage(): void {
  const f = store.indexedFiles.filters
  f.offset = Math.max(0, f.offset - f.limit)
  refresh()
}

function nextPage(): void {
  const f = store.indexedFiles.filters
  f.offset = f.offset + f.limit
  refresh()
}

/** 蓝本 onPageSizeChange(:691-697)—— 注意与 `_applyFilter` 不同:不清
 * `errorBanner`,只清选择 + 归零 offset + 重载,四件事里少一件。照抄不补
 * 齐(N9 同族的"照抄不许统一"判据:这不是要修的错误行为,是蓝本本来的
 * 写法)。 */
function onPageSizeChange(e: Event): void {
  store.indexedFiles.filters.limit = Number((e.target as HTMLSelectElement).value)
  store.indexedFiles.filters.offset = 0
  selSet.value = new Set()
  refresh()
}
</script>

<template>
  <div class="k-view">
    <div class="k-scroll">
      <div class="k-scroll-inner">
        <!-- ---- filter bar(蓝本 :6-57)---- -->
        <div class="k-filter-bar">
          <!-- Root convenience select(best-effort,derivedRoots 见上)-->
          <div class="k-filt">
            <label class="k-filt-label">{{ t('aiKbRoot') }}</label>
            <select class="k-filt-select" :value="rootSelect" @change="onRootSelectChange">
              <option value="all">{{ t('aiKbAll') }}</option>
              <option v-for="seg in derivedRoots" :key="seg" :value="seg">{{ seg }}</option>
            </select>
          </div>
          <!-- Path prefix free-text(authoritative)-->
          <div class="k-filt k-filt-grow">
            <label class="k-filt-label">{{ t('aiKbPathPrefix') }}</label>
            <div class="k-filt-input">
              <KIcon name="folder" :size="13" color="var(--text-tertiary)" />
              <input
                :value="store.indexedFiles.filters.path_prefix"
                @input="onPathPrefixInput"
                placeholder="/DATA/Wiki/ …"
              />
              <button
                v-if="store.indexedFiles.filters.path_prefix"
                class="k-filt-clear"
                @click="clearPathPrefix"
              >
                <KIcon name="x" :size="9" />
              </button>
            </div>
          </div>
          <!-- Type prefix -->
          <div class="k-filt k-filt-grow">
            <label class="k-filt-label">{{ t('aiKbTypePrefix') }}</label>
            <div class="k-filt-input">
              <KIcon name="file" :size="13" color="var(--text-tertiary)" />
              <input
                :value="store.indexedFiles.filters.mime_prefix"
                @input="onMimePrefixInput"
                placeholder="application/legacy-office/ …"
              />
              <button
                v-if="store.indexedFiles.filters.mime_prefix"
                class="k-filt-clear"
                @click="clearMimePrefix"
              >
                <KIcon name="x" :size="9" />
              </button>
              <button v-else class="k-filt-chip" :title="t('aiKbLegacyDocTip')" @click="setLegacyDoc">
                {{ t('aiKbLegacyDoc') }}
              </button>
            </div>
          </div>
          <!-- Status tombstoned select(N12)-->
          <div class="k-filt">
            <label class="k-filt-label">{{ t('aiKbStatus') }}</label>
            <!-- N12: Prototype shows "active" but API expects "alive" for alive rows -->
            <select class="k-filt-select" :value="statusViewLocal" @change="onStatusViewChange">
              <option value="active">{{ t('aiKbStatusActive') }}</option>
              <option value="tombstoned">{{ t('aiKbStatusRemoved') }}</option>
              <option value="all">{{ t('aiKbAll') }}</option>
            </select>
          </div>
          <!-- Failed only checkbox -->
          <label class="k-filt-check" :data-on="String(store.indexedFiles.filters.has_error)">
            <input
              type="checkbox"
              class="k-row-check"
              :checked="store.indexedFiles.filters.has_error"
              @change="onHasErrorChange"
            />
            {{ t('aiKbFailedOnly') }}
          </label>
          <!-- Reset filters -->
          <button class="k-btn ghost" :disabled="!filtersDirty" @click="clearFilters">
            <KIcon name="x" :size="12" /> {{ t('aiKbClear') }}
          </button>
        </div>

        <!-- ---- table head meta(蓝本 :60-90)---- -->
        <div class="k-files-meta">
          <div class="k-files-count">
            <template v-if="pageState === 'ready' || pageState === 'empty'">
              {{ t('aiKbNIndexedFiles', { n: total.toLocaleString() }) }}{{ statusSuffix }}
            </template>
            <span v-else class="k-skel" style="display: inline-block; width: 160px; height: 12px" />
          </div>
          <div class="k-files-tools">
            <span v-if="isAnyIndexing" class="k-poll" :title="t('aiKbPollTip')">
              <KIcon name="spinner" :size="12" /> {{ t('aiKbPolling') }}
            </span>
            <div class="k-sort">
              <KIcon name="sort" :size="12" color="var(--text-tertiary)" />
              <select
                class="k-filt-select"
                :value="store.indexedFiles.filters.sort"
                @change="onSortChange"
              >
                <option value="indexed_at">{{ t('aiKbSortIndexTime') }}</option>
                <option value="size">{{ t('aiKbColSize') }}</option>
                <option value="vector_count">{{ t('aiKbSortVectorCount') }}</option>
              </select>
              <button
                class="k-sort-dir"
                @click="toggleSortDir"
                :title="store.indexedFiles.filters.order === 'asc' ? t('aiKbSortAsc') : t('aiKbSortDesc')"
              >
                <span
                  :style="{
                    display: 'inline-flex',
                    transform: store.indexedFiles.filters.order === 'asc' ? 'rotate(180deg)' : 'none',
                  }"
                >
                  <KIcon name="arrowDown" :size="13" />
                </span>
              </button>
            </div>
            <!-- Demo state switcher from prototype is REMOVED — states driven by real store -->
          </div>
        </div>

        <!-- ---- error banner(蓝本 :93-103,K14/K19 见文件头注释)---- -->
        <div v-if="storeError || errorBanner" class="k-banner" data-tone="warn" style="margin: 0">
          <span class="k-banner-icon"><KIcon name="danger" :size="13" /></span>
          <!-- K14: 不回显 errorBanner 里可能存的后端 detail,只留固定文案 -->
          <span v-if="errorBanner">
            <b>400 Bad Request</b>
            <br />
            <span style="color: var(--text-tertiary)">
              {{ t('aiKbRebuildCapHint', { cap: FILTER_REBUILD_CAP.toLocaleString() }) }}
            </span>
          </span>
          <!-- K19: 不回显 storeError(= e.message),改固定 aiKbLoadErrorBody -->
          <span v-else>
            <b>{{ t('aiKbLoadErrorLabel') }}</b> {{ t('aiKbLoadErrorBody') }}
          </span>
          <button class="k-banner-close" @click="dismissBanner">{{ t('aiKbClose') }}</button>
        </div>

        <!-- ---- loading skeleton(蓝本 :106-132)---- -->
        <template v-if="pageState === 'loading'">
          <div class="k-ftable">
            <!-- head disabled -->
            <div class="k-frow-f k-frow-fhead">
              <input type="checkbox" class="k-row-check" disabled />
              <span>{{ t('aiKbStatus') }}</span>
              <span>{{ t('aiKbColPath') }}</span>
              <span>{{ t('aiKbColType') }}</span>
              <span>{{ t('aiKbColSize') }}</span>
              <span>{{ t('aiKbStatusIndexed') }}</span>
              <span class="k-frow-num">{{ t('aiKbColVectors') }}</span>
              <span>{{ t('aiKbColAction') }}</span>
              <span />
            </div>
            <div v-for="i in 8" :key="i" class="k-frow-f k-frow-skel">
              <span class="k-skel" style="width: 16px; height: 16px" />
              <span class="k-skel" style="width: 70px; height: 20px" />
              <span class="k-skel" style="width: 70%; height: 13px" />
              <span class="k-skel" style="width: 44px; height: 18px" />
              <span class="k-skel" style="width: 48px; height: 12px" />
              <span class="k-skel" style="width: 60px; height: 12px" />
              <span class="k-skel" style="width: 40px; height: 12px" />
              <span class="k-skel" style="width: 64px; height: 26px" />
              <span />
            </div>
          </div>
        </template>

        <!-- ---- empty(蓝本 :135-142,N10 见文件头注释)---- -->
        <div v-else-if="pageState === 'empty'" class="k-empty">
          <div class="k-empty-illust"><KIcon name="layers" :size="34" /></div>
          <div class="k-empty-title">{{ t('aiKbNoMatchTitle') }}</div>
          <div class="k-empty-sub">{{ t('aiKbNoMatchSub') }}</div>
          <button v-if="filtersDirty" class="k-empty-btn" @click="clearFilters">
            <KIcon name="x" :size="13" /> {{ t('aiKbClearFilters') }}
          </button>
        </div>

        <!-- ---- ready: table + pager(蓝本 :146-317,T9)---- -->
        <template v-else-if="pageState === 'ready'">
          <div class="k-ftable">
            <!-- table header(蓝本 :148-165)-->
            <div class="k-frow-f k-frow-fhead">
              <input
                type="checkbox"
                class="k-row-check"
                ref="selectAllRef"
                :checked="allSelected"
                :disabled="selectablePageIds.length === 0"
                @change="toggleAll"
                :title="t('aiKbSelectAllTip')"
              />
              <span>{{ t('aiKbStatus') }}</span>
              <span>{{ t('aiKbColPath') }}</span>
              <span>{{ t('aiKbColType') }}</span>
              <span>{{ t('aiKbColSize') }}</span>
              <span>{{ t('aiKbStatusIndexed') }}</span>
              <span class="k-frow-num">{{ t('aiKbColVectors') }}</span>
              <span>{{ t('aiKbColAction') }}</span>
              <span />
            </div>

            <!-- file rows(蓝本 :168-259)-->
            <template v-for="file in files" :key="file.file_id">
              <!-- row(Vue3 编译器要求 v-for 的 key 放在 template 标签上,单个
              key 覆盖这一组的 row + 可选 detail 两个兄弟节点,蓝本的
              `:key="file.file_id + '-row'"`/`'-detail'` 两个独立 key 是 Vue2
              写法,搬进 Vue3 会编译报错,故按 Vue3 语法调整,不是行为改动)-->
              <div
                class="k-frow-f"
                :data-selected="selSet.has(file.file_id)"
                :data-status="file.status"
                :data-done="doneSet.has(file.file_id)"
              >
                <input
                  type="checkbox"
                  class="k-row-check"
                  :checked="selSet.has(file.file_id)"
                  :disabled="file.status === 'tombstoned'"
                  @change="toggleRow(file.file_id)"
                  :title="file.status === 'tombstoned' ? t('aiKbTombstonedNoSelect') : ''"
                />
                <!-- status badge(N14:见文件头注释)-->
                <span class="k-frow-status">
                  <span
                    class="k-status-badge"
                    :data-s="badgeFor(file.status) ? badgeFor(file.status)!.cls : 'ok'"
                    :title="badgeFor(file.status) ? badgeFor(file.status)!.en : file.status"
                  >
                    <KIcon
                      :name="badgeFor(file.status) ? badgeFor(file.status)!.icon : 'check'"
                      :size="11"
                    />
                    <span class="k-status-badge-cn">{{
                      badgeFor(file.status) ? t(badgeFor(file.status)!.key) : file.status
                    }}</span>
                  </span>
                </span>
                <!-- path cell -->
                <span class="k-frow-pathcell">
                  <span class="k-frow-pathtxt" :title="filePath(file)">{{ filePath(file) }}</span>
                  <span
                    v-if="file.status === 'error' && file.last_error"
                    class="k-frow-errhint"
                    :title="file.last_error"
                  >
                    <KIcon name="danger" :size="10" /> {{ file.last_error }}
                  </span>
                  <span
                    v-if="file.status === 'ok' && file.vector_count === 0"
                    class="k-frow-zerohint"
                    :title="t('aiKbZeroVecTip')"
                    >{{ t('aiKbZeroVec') }}</span
                  >
                </span>
                <!-- type tag -->
                <span>
                  <span
                    class="k-type-tag"
                    :data-kind="simplifyMime(file.mime).kind"
                    :title="file.mime"
                  >
                    {{ simplifyMime(file.mime).label
                    }}<span v-if="simplifyMime(file.mime).legacy" class="k-type-legacy">{{
                      t('aiKbLegacy')
                    }}</span>
                  </span>
                </span>
                <!-- size -->
                <span class="k-frow-num" :title="(file.size || 0).toLocaleString() + ' bytes'">{{
                  fmtBytes(file.size)
                }}</span>
                <!-- indexed time -->
                <span class="k-frow-time" :title="fmtAbs(ms(file.indexed_at))">{{
                  fmtRel(ms(file.indexed_at))
                }}</span>
                <!-- vector count -->
                <span class="k-frow-num k-frow-vec" :data-zero="file.vector_count === 0">
                  {{ (file.vector_count || 0).toLocaleString() }}
                </span>
                <!-- rebuild button(文档化占位,见文件头注释)-->
                <span class="k-frow-rebuild">
                  <button
                    class="k-btn outline k-rebuild-btn"
                    :disabled="file.status !== 'ok' && file.status !== 'error'"
                    @click="rebuildRow(file.file_id)"
                    :title="
                      file.status === 'indexing'
                        ? t('aiKbRebuilding')
                        : file.status === 'tombstoned'
                          ? t('aiKbTombstonedTip')
                          : t('aiKbRebuildRowTip')
                    "
                  >
                    <template v-if="file.status === 'indexing'">
                      <KIcon name="spinner" :size="11" /> {{ t('aiKbRebuilding') }}
                    </template>
                    <template v-else>
                      <KIcon name="refresh" :size="11" /> {{ t('aiKbRebuild') }}
                    </template>
                  </button>
                </span>
                <!-- expand toggle -->
                <button
                  class="k-frow-expand"
                  :data-open="expSet.has(file.file_id)"
                  @click="toggleExpand(file.file_id)"
                  :title="t('aiKbMore')"
                >
                  <KIcon name="chevDown" :size="13" />
                </button>
              </div>
              <!-- expanded detail panel(蓝本 :261-293)-->
              <div v-if="expSet.has(file.file_id)" class="k-file-detail">
                <div class="k-fd-grid">
                  <div class="k-fd-item">
                    <div class="k-fd-k">parser_version</div>
                    <div class="k-fd-v mono">{{ file.parser_version || '—' }}</div>
                  </div>
                  <div class="k-fd-item">
                    <div class="k-fd-k">modalities_done</div>
                    <div class="k-fd-v">
                      <span v-if="fileModalityKeys(file).length" class="k-fd-mods">
                        <span v-for="m in fileModalityKeys(file)" :key="m" class="k-fd-mod">{{
                          m
                        }}</span>
                      </span>
                      <span v-else style="color: var(--text-quaternary)">—</span>
                    </div>
                  </div>
                  <div class="k-fd-item k-fd-wide">
                    <div class="k-fd-k">sha256_full</div>
                    <div class="k-fd-v mono k-fd-sha" :title="file.sha256_full">
                      {{ file.sha256_full || '—' }}
                    </div>
                  </div>
                  <div v-if="file.tombstoned_at" class="k-fd-item">
                    <div class="k-fd-k">tombstoned_at</div>
                    <div class="k-fd-v mono" :title="fmtAbs(ms(file.tombstoned_at))">
                      {{ fmtAbs(ms(file.tombstoned_at)) }}
                    </div>
                  </div>
                  <div class="k-fd-item k-fd-wide">
                    <div class="k-fd-k">mime</div>
                    <div class="k-fd-v mono">{{ file.mime || '—' }}</div>
                  </div>
                </div>
                <div v-if="file.last_error" class="k-fd-error">
                  <KIcon name="danger" :size="12" />
                  <span><b>last_error:</b> {{ file.last_error }}</span>
                </div>
              </div>
            </template>
          </div>

          <!-- ---- pagination(蓝本 :298-317)---- -->
          <div class="k-pager">
            <div class="k-pager-info">
              {{ t('aiKbShowingRange', { from: pageFrom, to: pageTo, total: total.toLocaleString() }) }}
            </div>
            <div class="k-pager-ctrls">
              <div class="k-pager-size">
                <span>{{ t('aiKbPerPage') }}</span>
                <select
                  class="k-filt-select"
                  :value="store.indexedFiles.filters.limit"
                  @change="onPageSizeChange"
                >
                  <option v-for="n in [50, 100, 200, 500]" :key="n" :value="n">{{ n }}</option>
                </select>
              </div>
              <button class="k-btn outline" :disabled="currentPage === 0" @click="prevPage">
                <KIcon name="chevLeft" :size="13" /> {{ t('aiKbPagerPrev') }}
              </button>
              <span class="k-pager-page">{{ currentPage + 1 }} / {{ pageCount }}</span>
              <button
                class="k-btn outline"
                :disabled="currentPage >= pageCount - 1"
                @click="nextPage"
              >
                {{ t('aiKbPagerNext') }} <KIcon name="chev" :size="13" />
              </button>
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- ---- sticky bottom action bar(蓝本 :322-353)---- -->
    <!-- data-active 不套 String():蓝本 :323 原文没套,附录 D §D.3 标 ❌ 不套,
    治理 §12 E-9 裁定「逐处照抄蓝本」(Vue 3 下 data-* 的 false 照样渲染成
    "false",套不套渲染一致)。见文件头注释【属性态】。 -->
    <div class="k-files-actionbar" :data-active="selectedCount > 0">
      <div class="k-ab-inner">
        <div class="k-ab-info">
          <template v-if="selectedCount > 0">
            {{ t('aiKbNSelected', { n: selectedCount }) }}
            <span v-if="overExplicitCap" class="k-ab-warn">
              <KIcon name="danger" :size="11" />
              {{ t('aiKbOverExplicitCap', { cap: EXPLICIT_REBUILD_CAP }) }}
            </span>
          </template>
          <span v-else style="color: var(--text-tertiary)">{{ t('aiKbSelectFilesHint') }}</span>
        </div>
        <div class="k-ab-actions">
          <!-- Rebuild matching: replaces prototype's "rebuild entire root", uses current filters -->
          <button
            class="k-btn outline"
            :disabled="total === 0"
            :title="
              total === 0
                ? t('aiKbNoMatchTitle')
                : t('aiKbRebuildAllTip', { n: total.toLocaleString() })
            "
            @click="openRebuildAllConfirm"
          >
            <KIcon name="drive" :size="13" /> {{ t('aiKbRebuildAllInRoot') }}
          </button>
          <button
            class="k-btn primary"
            :disabled="selectedCount === 0 || overExplicitCap"
            @click="rebuildSelected"
          >
            <KIcon name="refresh" :size="13" /> {{ t('aiKbRebuildSelectedN', { n: selectedCount }) }}
          </button>
        </div>
      </div>
    </div>

    <!-- ---- rebuild-all-matching confirm modal(蓝本 :355-381)---- -->
    <!-- K7:reka Dialog 原语,portal 到知识库容器;蓝本的「点遮罩关闭 /
    点弹窗内不关闭」由 DialogContent 的 pointerDownOutside 等价提供。
    结构逐字照 T5 的 QueueView.vue:559-583 样板。 -->
    <DialogRoot :open="showRebuildAllConfirm" @update:open="showRebuildAllConfirm = $event">
      <DialogPortal to=".knowledge-app" defer>
        <DialogOverlay class="k-modal-bg">
          <DialogContent
            class="k-modal"
            style="width: min(460px, 100%)"
            :aria-describedby="undefined"
          >
            <VisuallyHidden as-child
              ><DialogTitle>{{ t('aiKbRebuildAllTitle') }}</DialogTitle></VisuallyHidden
            >
            <div class="k-confirm-body">
              <div class="k-confirm-icon"><KIcon name="refresh" :size="26" /></div>
              <div class="k-confirm-title">{{ t('aiKbRebuildAllTitle') }}</div>
              <div class="k-confirm-summary">
                {{ t('aiKbRebuildAllBody1', { n: total.toLocaleString() }) }}<br />
                {{ t('aiKbRebuildAllBody2') }}
              </div>
              <!-- 内嵌超限横幅:FILTER_REBUILD_CAP 前端只警告不拦,判据严格大于 -->
              <div
                v-if="total > FILTER_REBUILD_CAP"
                class="k-banner"
                data-tone="warn"
                style="margin: 0"
              >
                <span class="k-banner-icon"><KIcon name="danger" :size="13" /></span>
                <span>
                  {{
                    t('aiKbRebuildAllOverCap', {
                      n: total.toLocaleString(),
                      cap: FILTER_REBUILD_CAP.toLocaleString(),
                    })
                  }}
                </span>
              </div>
            </div>
            <div class="k-modal-foot">
              <div class="right" style="margin-left: auto">
                <button class="k-btn ghost" @click="showRebuildAllConfirm = false">
                  {{ t('aiKbCancel') }}
                </button>
                <button class="k-btn danger" @click="doRebuildAll">
                  <KIcon name="refresh" :size="12" />
                  {{ t('aiKbConfirmRebuildN', { n: total.toLocaleString() }) }}
                </button>
              </div>
            </div>
          </DialogContent>
        </DialogOverlay>
      </DialogPortal>
    </DialogRoot>
  </div>
</template>
