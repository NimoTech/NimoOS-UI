<script setup lang="ts">
// SP7-P7a-T6: PhotosSmartViewDetail.vue — smart-view detail page shell (route /photos/smart-views/:id).
// This phase's key architectural task: prove that §7e-2's core fix (store's byId(id) in T2) holds.
//
// ★★★ The most important architectural difference from Vue2 — read this fully before you can
// understand why this file is so short ★★★
// Vue2's detail page (NimoOS-UI src/views/Photos/PhotosSmartViewDetail.vue) holds the entire sv
// object as a **prop** (:285 `props: { sv: { type: Object, required: true } }`), while the list
// side's UPDATE_SMART_VIEW mutation swaps in a **new object** via `splice(i, 1, {...})` — meaning
// that after an edit/pause/rename, the Vue2 detail page's own prop reference has gone stale and
// the UI can't see the change until the user reopens the detail page.
// To paper over this real bug, Vue2 built an entire local-state sync mechanism: local `thresh`/
// `paused`/`includeVideos` + a `syncingSv` flag + three watchers (:288-291, :345-371) — when the
// `sv` prop changes, copy the new value into local state, while using syncingSv to block that
// "copy into local state" step from triggering the local watcher again and firing another PATCH
// request in an infinite loop.
//
// New-UI takes the real-routing path: `sv = computed(() => store.byId(String(route.params.id)))`,
// pulling fresh from the store array on every render, with a single source of truth.
// **This bug is structurally gone** — once the store updates the array entry, every place that
// reads `sv.value` (including this computed itself) picks up the new object immediately, with no
// local state copy, no syncingSv, no three watchers needed. `paused` is directly a **derived
// value** of `computed(() => !sv.value?.live)`, not local state — this is exactly the behaviour
// the "§7e-2 main guard" test case in this task's suite pins down (mutate sv.live on the store
// directly, without remounting, and the pill's copy follows automatically; deletion-verification
// ① — swapping byId for a local ref that caches a copy of the sv object — turns that case red).
//
// This file's scope (task-6-brief.md structure spec 1-9): shell + header (title editing /
// live-paused pill / four stat tiles) + the action bar's three menus (pause/resume / refine in
// search [T16 wired, see refineInSearch] / export [ZIP 401 fix + static album] / more
// [rename/duplicate/delete]) + delete confirmation dialog + two photo grids (recently added /
// all matches).
// T7 (add-condition popover) and T8 (right rail threshold/settings/stats/activity feed) leave only
// mounting points, see the TODO comments below.
//
// ── Registered deviations (the handful the brief pre-asked us to register) ──────────────────
//  1) "Not found" empty state (listLoaded && !sv): this path does not exist in Vue2 — its detail
//     page only ever renders while the parent's `v-if="openSv"` holds, and `openSv` is always a
//     real object, so "has an id but no matching item" can never happen there.
//     New-UI has real routing, so a user hand-editing the address bar / opening an old bookmark
//     lands here — this is new to New-UI.
//  2) live/paused pill: Vue2 only has `role="button"`, no keyboard accessibility. Here we add
//     `tabindex="0"` + `@keydown.enter`.
//  3) commitTitle failure: Vue2 `:512-513` has no catch (optimistically assumes the PATCH always
//     succeeds). Here, catch → toast + stay in edit mode (don't quietly exit, or the user might
//     think the rename took effect).
//  4) "Refine in search" was temporarily disabled during the T6 phase (the /photos/search route
//     didn't exist yet). T16 has since built the search route and wired it up (see refineInSearch
//     below), so the button is no longer disabled.
//  5) `smartViewId` dead parameter not ported: Vue2 `:520`'s refineInSearch payload is
//     `{ q: sv.name, smartViewId: sv.id }`, but grepping the whole Vue2 repo for `smartViewId`
//     turns up only this one write site and zero consumers (`grep -rn smartViewId NimoOS-UI/src/`
//     matches only this line). T16's wiring only passes `q`, dropping this dead parameter.
//  6) SP15-P2a final review, finding 4 — an excluded tile is inert while selecting.
//     Vue 2 :167 wires `restoreOne` onto the excluded tiles unconditionally, so in
//     selection mode every tile on the page toggles a checkmark except an excluded one,
//     which silently writes to the server instead. The user taps expecting selection and
//     gets an unconfirmed restore with no toast and no undo. Excluded assets are not
//     removal candidates — the only thing selection leads to here is "remove from view",
//     which they are already out of — so they are neither selectable nor restorable while
//     selecting: the click is a no-op. This is one of Vue 2's own defects being fixed and
//     registered rather than copied, per this branch's porting rule.
import '../photos/styles/vue2-parity'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { service } from '@nimotech/nimoos-service'
import AreaShell from '../components/shell/AreaShell.vue'
import { usePhotosTheme } from '../photos/composables/usePhotosTheme'
import PhotosSidebar from '../photos/components/PhotosSidebar.vue'
import SmartViewSidePanel from '../photos/components/SmartViewSidePanel.vue'
import SmartViewActivityFeed from '../photos/components/SmartViewActivityFeed.vue'
import PhotosLibraryPicker from '../photos/components/PhotosLibraryPicker.vue'
import { usePhotosSmartViews, type DeletedSmartView } from '../photos/stores/smartViews'
import { usePhotosAlbums } from '../photos/stores/albums'
import { useToast } from '../stores/toast'
import { isConflict } from '../photos/util/httpErrors'
import { useLightbox } from '../photos/lightbox/useLightbox'
import { relTime } from '../photos/util/relTime'
// SP15-P2c Task 6: reused, not re-implemented. Despite the name this is a plain photo
// comparator keyed off a string mode (util/albumView.ts:74) -- its 'taken' branch is
// byte-for-byte the comparator Vue2 writes inline here as `sortedByMode` (33b05636
// :577-587). Task 7 fold-in, finding (e): the fallback branch does not return the list
// "untouched" -- albumView.ts:88 returns `[...photos]`, a fresh shallow copy. The *order* is
// untouched (exactly what Vue2 means by 'score': its own comment there says "the order as it
// stands", because the backend already returns match_score DESC), the *reference* is not.
// Writing a second copy of the same two branches on this page is what the ruling against
// duplicated TS (phase ruling: option B on sharing) exists to prevent.
import { sortAlbumPhotos } from '../photos/util/albumView'
import { formatMB } from '../photos/util/formatBytes'
import type { Photo } from '../photos/util/assetToPhoto'
import { useFixedMenuPosition } from '../photos/composables/useFixedMenuPosition'

const route = useRoute()
const router = useRouter()
const store = usePhotosSmartViews()
const albums = usePhotosAlbums()
const toast = useToast()
const lb = useLightbox()
const { t, locale } = useI18n()
const { themeClass } = usePhotosTheme()

// The single normalisation point (hard rule: always compare-by-id via String()).
const svId = computed(() => String(route.params.id))
// ★ §7e-2 core fix: pull fresh from the store array on every render, never hold an object reference.
const sv = computed(() => store.byId(svId.value))

function fmtNum(n: number): string {
  return n.toLocaleString(locale.value.replace('_', '-'))
}

// Wrapped in a ref rather than calling Date.now() bare in the template: tests can pin this value
// before mount with vi.useFakeTimers()/setSystemTime, while the component code itself still
// reads as the normal "just use the current time" idiom (this is not a workflow script, so
// Date.now() is allowed).
const now = ref(Date.now())
const lastUpdated = computed(() => (sv.value?.evaluatedAt ? relTime(sv.value.evaluatedAt, now.value, t, locale.value) : '—'))

// ── Loading (structure spec 1) ────────────────────────────────────────────────────────
onMounted(async () => {
  if (!store.listLoaded) await store.fetchSmartViews()
  await store.loadDetail(svId.value)
  void store.loadExcluded(svId.value)
})
watch(() => route.params.id, (raw) => {
  if (raw === undefined) return // Left this route (same existing precedent as PhotosPersonDetail.vue)
  // SP15-P2a: everything the manual actions hold is keyed to the id we are leaving, so it all
  // resets here. `edit`/`selectedIds` are the pair with a write consequence —
  // removeSelected() reads svId.value at call time, so a selection carried across an :id
  // change would send view A's asset ids to view B's remove endpoint, under a bar counting
  // photos that are no longer on screen. `pickerOpen` is the same story from the other side
  // (its already-in set comes from the previous view's members) and `excludedOpen` is the
  // cosmetic remainder of the same rule. Vue 2 could not hit any of this — its detail
  // component was v-if'd and remounted per view.
  //
  // Task 7 fold-in, finding (a): `sortBy`/`density` (added by Task 6) are deliberately NOT in
  // this list, so the comment above no longer claims "nothing on screen may come from the old
  // id" -- that was true before Task 6 and stopped being the rule this watcher enforces.
  // Sort order and grid density are display preferences, not write-consequential state: unlike
  // `selected`/`pickerOpen`, nothing downstream reads them keyed to a specific view id, so
  // carrying them across a navigation cannot mislabel or misdirect a request the way a stale
  // selection can. PhotosAlbumDetail.vue's own route-id watcher (Task 3/4, the sibling this
  // page is being brought in line with) already sets this precedent -- it resets
  // `selected`/`titleEditing`/`titleDraft`/`edit`/`pickerOpen` but leaves its own `sortBy`
  // untouched too. Treating "the user prefers date-taken order at compact density" as a
  // per-session preference that survives switching views is the deliberate, matching choice
  // here, not an oversight.
  edit.value = false
  selectedIds.value = []
  pickerOpen.value = false
  excludedOpen.value = false
  void store.loadDetail(String(raw))
  void store.loadExcluded(String(raw))
})

// ── Title editing (structure spec 3, 8) ───────────────────────────────────────────────
const titleEdit = ref(false)
const titleDraft = ref('')
const titleInputRef = ref<HTMLInputElement | null>(null)

function startTitleEdit(): void {
  if (!sv.value) return
  titleDraft.value = sv.value.name
  titleEdit.value = true
  moreOpen.value = false
  void nextTick(() => {
    titleInputRef.value?.focus()
    titleInputRef.value?.select()
  })
}
function cancelTitle(): void {
  titleEdit.value = false
  if (sv.value) titleDraft.value = sv.value.name
}
async function commitTitle(): Promise<void> {
  const s = sv.value
  if (!s) { titleEdit.value = false; return }
  const v = titleDraft.value.trim()
  // Unchanged or empty → exit right away without sending a request (mirrors Vue2 :511's
  // `if (v && v !== this.sv.name)`).
  if (!v || v === s.name) {
    titleEdit.value = false
    return
  }
  try {
    await store.updateSmartView(s.id, { name: v })
    toast.show(t('photosSvSmartViewRenamed'))
    // Exiting edit mode is left to the watch(sv.name) below: on success the store writes back
    // the new name → sv.value.name changes → the watch fires → titleEdit = false. On failure
    // name is unchanged, the watch never fires, and titleEdit stays true (deviation 3: Vue2 has
    // no catch; here a failure must stay in edit mode instead of quietly exiting and letting the
    // user think the rename took effect).
  } catch (e) {
    console.error('[photos-smartviews] commitTitle', e)
    toast.show(t('photosSvRenameFailed'))
  }
}
// The core of deletion-verification ②: remove this watch and the "exits edit mode on success"
// test case goes red (the name changes but titleEdit never gets reset to false here; the
// "unchanged" branch is unaffected, since that path exits synchronously inside commitTitle
// itself and doesn't depend on this watch).
watch(() => sv.value?.name, () => {
  if (titleEdit.value) titleEdit.value = false
})

// ── paused: a derived value, not local state (structure spec 8, §7e-2's biggest simplification) ───────────────
const paused = computed(() => !sv.value?.live)
async function togglePaused(): Promise<void> {
  const s = sv.value
  if (!s) return
  const nextLive = paused.value // paused===true ⇔ currently !live, so toggling means negating, i.e. just paused itself
  try {
    await store.updateSmartView(s.id, { live: nextLive })
  } catch (e) {
    console.error('[photos-smartviews] togglePaused', e)
    toast.show(t('photosSvUpdateFailed'))
  }
}
function onPillKeydown(e: KeyboardEvent): void {
  if (e.key === 'Enter') void togglePaused()
}

// T16 delivered (structure spec 23): "Refine in search" → navigate to the search page, using
// this smart view's name as the query term.
// Only passes q — Vue2 :520's smartViewId is a dead parameter with zero consumers repo-wide
// (see registered deviation 5 in the file header).
function refineInSearch(): void {
  const s = sv.value
  if (!s) return
  void router.push({ path: '/photos/search', query: { q: s.name } })
}

// ── T7 wiring, shrunk by SP15-P2c Task 8 (structure spec T7) ────────────────────
// SP15-P2c Task 8, ported from Vue2 NimoOS-UI 33b05636 PhotosSmartViewDetail.vue:26-30 +
// :700-710 ("user-added requirement" -- a deliberate product decision, not an oversight): the
// "Add condition" entry (button + popover) is deleted along with the four Vue2 methods
// that only served it, and this repo's equivalents inside the now-deleted, formerly
// separate condition-editor component (see task-8-report.md for the exact names on both
// sides). The function that translated the editor's "add" emit into a store call went
// with it -- it had no other caller. `removeCond` survives (Vue2 keeps "existing
// condition, click to remove") and is now called directly from this page's own template
// instead of via the deleted component's "remove" emit.
//
// The `if (store.patchBusy) return` guard is net-new versus Vue2 (Vue2's removeCond has no
// reentry guard at :697-701) and was already reviewed/tested when it lived inside
// the deleted condition-editor component -- kept here rather than silently dropped when folding the
// component back in, per this repo's "port visually, fix logic, don't regress" convention.
// It is technically redundant with store.updateSmartView's own `if (patchBusy.value) return`
// (smartViews.ts:246) -- both guards no-op a concurrent call -- but removing it would also
// mean losing the `data-busy` visual affordance's justification, so it stays as
// belt-and-suspenders documentation of intent, not dead code.
async function removeCond(cond: string): Promise<void> {
  if (store.patchBusy) return
  const s = sv.value
  if (!s) return
  try {
    await store.updateSmartView(s.id, { conds: s.conds.filter((c) => c !== cond) })
  } catch (e) {
    console.error('[photos-smartviews] removeCond', e)
    toast.show(t('photosSvUpdateFailed'))
  }
}

// ── T8 wiring: right rail (threshold/settings toggles) -> store.updateSmartView
// (structure spec T8) ─────────────────────────────────────────────────────────
// SmartViewSidePanel doesn't touch the store itself -- it only keeps local draft/debounce
// state and derived values, and emits a single unified `patch`; this translates that into
// store.updateSmartView(id, patch). No extra .then(loadDetail) needed, same reasoning as
// removeCond: §7e-2's byId(id) makes the `sv` computed follow along once the store's array
// entry updates, so SmartViewSidePanel's `sv` prop picks up the new value immediately.
async function onSidePatch(patch: { threshold?: number; live?: boolean; includeVideos?: boolean }): Promise<void> {
  const s = sv.value
  if (!s) return
  try {
    await store.updateSmartView(s.id, patch)
  } catch (e) {
    console.error('[photos-smartviews] onSidePatch', e)
    toast.show(t('photosSvUpdateFailed'))
  }
}

// ── header's four stat tiles (structure spec 3) ──────────────────────────────────────────────
const newCount = computed(() => sv.value?.addedThisWeek || 0)
const median = computed(() => sv.value?.median || 0)
const storageText = computed(() => formatMB(sv.value?.storageBytes || 0))

// ── SP15-P2c Task 6: sort capsule + density pair (target :49-90) ─────────────────────────
// New construction: this page never had either control. Both are display-only preferences --
// they change what the two grids show and in what order, and send nothing to the backend
// (Vue2's own note at :457-459).
//
// 'score' is the identity ordering: the backend already returns matches by match_score DESC,
// so the mode exists to name the default rather than to reorder anything.
type SvSortBy = 'score' | 'taken'
const sortBy = ref<SvSortBy>('score')
const sortMenuOpen = ref(false)
const sortMenuRef = ref<HTMLElement | null>(null)
// Enum values match PhotosAlbumDetail.vue's (Vue2 spells the first one 'comfort'). The two
// detail pages have to agree: the value is never visible, and a split would mean two
// spellings of the same `data-active` test and the same `.density` rules.
const density = ref<'comfortable' | 'compact'>('comfortable')

// Two options here, against the album page's three -- a smart view has no manual order and no
// separate "date added" (target :56-67).
const sortOptions = computed(() => [
  { id: 'score' as SvSortBy, label: t('photosSortScore') },
  { id: 'taken' as SvSortBy, label: t('photosAlbumSortTaken') },
])
const currentSortLabel = computed(() => sortOptions.value.find((s) => s.id === sortBy.value)?.label ?? '')
function pickSort(s: SvSortBy): void {
  sortBy.value = s
  sortMenuOpen.value = false
}

// The display order for each grid. The store's arrays stay untouched: `viewAssetIds` looks ids
// up rather than reading positions. Task 9 hands the lightbox these two computeds (not the raw
// store arrays) at the template call sites below, so its navigation order matches what each
// grid is showing.
const matchedSet = computed(() => sortAlbumPhotos(store.matchedAssets, sortBy.value))
const recentSet = computed(() => sortAlbumPhotos(store.recentAssets, sortBy.value))

// ── more menu (spec 8, 9) / delete confirmation: one mousedown listener + one keydown listener ──
// Task 7: the Export button/menu is gone -- `exportOpen`/`exportBtnRef`/`exportMenuRef` went
// with it (ZIP is now the unified menu's third entry; "Save as static album" is a deleted
// capability, see `exportAlbumAction`'s own removal note below). `moreWrapRef` is renamed
// `morePopRef` and `moreBtnRef` is new, matching PhotosAlbumDetail.vue's own naming (Task 5):
// `morePopRef` wraps both the trigger button and the menu for click-outside purposes,
// `moreBtnRef` exists solely to hand the button's rect to `useFixedMenuPosition` -- neither
// replaces the other.
const moreOpen = ref(false)
const confirmDeleteOpen = ref(false)
// SP15-P2b Task 8: smart album -> regular album, the reverse of Task 7's
// AlbumConvertToSmartDialog. Inline in this file rather than a new component (Vue2 inlines
// its lb-confirm-* version too, and this page already owns a confirmation of the same
// shape for delete).
const convertToAlbumOpen = ref(false)
const convertingToAlbum = ref(false)
const convertError = ref('')
const morePopRef = ref<HTMLElement | null>(null)
const moreBtnRef = ref<HTMLElement | null>(null)

// Task 7 (T1): pins the unified menu to the viewport via the trigger button's rect, so it no
// longer clips against .sv-detail-side's own overflow-y:auto once the menu grew to five
// entries (the same fix Task 5 already applied to PhotosAlbumDetail.vue's own more menu).
const { menuStyle } = useFixedMenuPosition(moreOpen, moreBtnRef)

function toggleMoreMenu(): void {
  moreOpen.value = !moreOpen.value
}

function onDocumentMouseDown(e: MouseEvent): void {
  const target = e.target as Node
  if (moreOpen.value) {
    const w = morePopRef.value
    if (w && !w.contains(target)) moreOpen.value = false
  }
  // SP15-P2c Task 6: the sort menu closes on an outside click the same way (Vue2 :545-548
  // adds its own click-outside for exactly this popup).
  if (sortMenuOpen.value) {
    const s = sortMenuRef.value
    if (s && !s.contains(target)) sortMenuOpen.value = false
  }
}

// Hard constraint: when multiple overlays are open, one Escape must close them all -- four
// independent ifs (five before Task 7 removed the export menu's own), no early return
// (deletion-check 8: adding `return` inside the first if turns that test red). SP15-P2b Task 8 adds convertToAlbumOpen: this branch routes through
// closeConvertToAlbum() rather than setting the flag directly, or Escape could dismiss the
// dialog mid-flight while the Cancel button's own guard refuses to (closeConvertToAlbum
// defined below).
function onDocumentKeydown(e: KeyboardEvent): void {
  if (e.key !== 'Escape') return
  if (moreOpen.value) moreOpen.value = false
  if (confirmDeleteOpen.value) confirmDeleteOpen.value = false
  if (convertToAlbumOpen.value) closeConvertToAlbum()
  // SP15-P2c Task 6. Vue2 gives the sort popup a click-outside but no Escape; PhotosAlbumDetail
  // .vue:539 already closes its own sort menu on Escape, and a popup that ignores the key its
  // three neighbours on this same page answer reads as broken. Registered deviation, added as
  // a fifth independent `if` so it does not disturb the "one Escape closes everything" rule.
  if (sortMenuOpen.value) sortMenuOpen.value = false
}

const anyOverlayOpen = computed(() => moreOpen.value || confirmDeleteOpen.value || convertToAlbumOpen.value || sortMenuOpen.value)
watch(anyOverlayOpen, (open) => {
  if (open) document.addEventListener('keydown', onDocumentKeydown)
  else document.removeEventListener('keydown', onDocumentKeydown)
})
onMounted(() => document.addEventListener('mousedown', onDocumentMouseDown))
onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocumentMouseDown)
  document.removeEventListener('keydown', onDocumentKeydown)
  if (toastTimer) clearTimeout(toastTimer)
})

// ── Export (structure spec 5, 6) ──────────────────────────────────────────────────────
interface ExportToast { icon: 'download' | 'plus'; text: string }
const exportToast = ref<ExportToast | null>(null)
let toastTimer: ReturnType<typeof setTimeout> | null = null
function showExportToast(icon: ExportToast['icon'], text: string): void {
  exportToast.value = { icon, text }
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { exportToast.value = null }, 2800) // Matches Vue2 :499
}

// exportSmartViewUrl hits /v1/photos/smart-views/:id/export, which is not in the backend's
// mediaGetSkip exemption table (only the /favorites/export suffix is exempt), and Photos' JWT
// middleware only ever reads the token from the Authorization header — there is no query-string
// path — so Vue2's window.location.href is guaranteed to 401 (plan Global Constraints §7e-1,
// verified against source at NimoOS-Photos/route/router.go).
// Switched here to a fetch + blob download that carries the Authorization header.
async function downloadZip(): Promise<void> {
  const s = sv.value
  // Task 7: this used to close the export menu (`exportOpen`); ZIP is now the unified menu's
  // third entry, so it closes that one instead.
  moreOpen.value = false
  if (!s) return
  try {
    const url = service.photos.exportSmartViewUrl(String(s.id), 'zip')
    // ⚠ Do not add a 'Bearer ' prefix — this repo stores a bare token: the shared package's
    // interceptor does `cfg.headers.Authorization = token` (NimoOS-Service/src/http.ts:59-60),
    // and the token comes from `localStorage.getItem('access_token')` (the getToken callback in
    // main.ts:24) — grepping the whole repo turns up not a single 'Bearer' literal. The backend's
    // `strings.TrimPrefix(auth, "Bearer ")` is a no-op on a bare token, so both forms would work,
    // but this keeps the same convention as the shared package (the core of deletion-verification ⑤).
    // fix round 1 · C1 (Critical, verified against source): this endpoint `route/v1/smartviews.go:34`
    // only registers `g.POST(...)` — grepping the whole repo for `"/smart-views/:id/export"` finds
    // only this one route, no GET variant — so `fetch`'s default GET would get rejected by Echo as
    // a 405 (not a 401, but equally 100% broken). `method: 'POST'` must be explicit. No body is
    // needed — the handler (`smartviews.go:208-215`) reads `format` from the query first, and
    // `exportSmartViewUrl` already appends `?format=zip` to the URL.
    const res = await fetch(url, { method: 'POST', headers: { Authorization: localStorage.getItem('access_token') ?? '' } })
    if (!res.ok) throw new Error(`export ${res.status}`)
    const blob = await res.blob()
    const href = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = href
    a.download = `${s.name || 'smart-view'}.zip`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(href) // The core of deletion-verification ⑥
    showExportToast('download', t('photosSvPreparingZipNPhotos', { n: fmtNum(s.count) }))
  } catch (e) {
    console.error('[photos-smartviews] downloadZip', e)
    showExportToast('download', t('photosFavExportFailed'))
  }
}

// Task 7: `exportAlbumAction` ("Save as static album" / sv-export-album) is deleted, not
// re-homed into the unified menu. This is an empirically-verified capability removal, not a
// guess: the Vue2 target's own final state (933a7d3a comment restated at 33b05636
// :184-189) records that Vue2 killed the identical button ("Save as static Album entry deleted
// entirely" in the original commit's own words) in the same commit range
// that produced the five-entry menu, keeping only the backend
// endpoint (`photosService.exportSmartViewAlbum`) as a capability with no frontend caller.
// This page's Convert entry (`askConvertToAlbum` below) already does the equivalent job --
// freezing the current matches into a regular album -- so nothing reachable through the UI is
// lost. `store.exportAlbum` (smartViews.ts) and `service.photos.exportSmartViewAlbum` are left
// untouched, mirroring Vue2's own choice to keep the backend capability while dropping the
// frontend trigger; both become currently-unused exports of their respective modules, which is
// fine for a store action returned from its public API object (no unused-local warning) and is
// the exact shape Vue2's own history leaves behind.

// ── more menu: rename / duplicate / delete / convert / ZIP (spec 8, 9) ──────────────
function openDeleteConfirm(): void {
  moreOpen.value = false
  confirmDeleteOpen.value = true
}
function closeDeleteConfirm(): void { confirmDeleteOpen.value = false }

async function doDelete(): Promise<void> {
  const s = sv.value
  confirmDeleteOpen.value = false
  if (!s) return
  try {
    const result = await store.deleteSmartView(s.id)
    if (!result) return
    // SP15-P2b Task 5: smart albums now live inside Albums (Tasks 3/4), so a deleted
    // smart view's owner list is the Albums page, not this now-Moments-only route.
    void router.push('/photos/albums')
    // The undo label reuses the existing "Undo" key established by the P3 recycle bin (grepping
    // this repo's zh_cn.ts confirms photosTrashUndo = '撤销' matches photosPersonUndo's value --
    // both carry the same generic "undo" copy, so we take the former rather than adding a new
    // one). duration 5000 follows P5's existing "5-second undo window" convention.
    toast.show(t('photosSvSmartViewNameDeleted', { name: s.name }), 5000, {
      label: t('photosTrashUndo'),
      // fix wave F3 (final-review must-fix): `void store.restoreSmartView(...)` swallows a
      // failed rejection into an unhandled promise rejection -- the store's restoreSmartView
      // throws on failure (smartViews.ts :303-304's catch only console.errors before rethrowing),
      // and a `void` call doesn't catch that throw, so the UI gives zero feedback. The real
      // sequence: the user clicks delete → the `router.push` above has already sent them back to
      // the list page (this smart view has already been spliced out of the list) → they click
      // undo within 5 seconds → the backend call fails → under the original implementation the
      // UI shows no reaction at all, and this smart view vanishes from the list permanently (it
      // still exists on the backend; only refreshing the page would bring it back).
      // Violates Global Constraints' "an action thrown upward stays thrown (view-layer catch →
      // toast)" -- this same file's doDelete itself is try/catch + failure toast, only this undo
      // callback was missing that layer.
      // Copy reuse: grepping the whole repo confirms there is no dedicated "undo smart view
      // failed" key; `photosTrashRestoreFailed` (P3 recycle bin, PhotosTrash.vue:121/171's same
      // "undo restore failed" scenario, same duration 4500) is semantically an exact match for
      // "the restore/undo action failed" -- reused as-is, no new key added.
      onClick: () => {
        store.restoreSmartView(result as DeletedSmartView).catch((e: unknown) => {
          console.error('[photos-smartviews] undo delete', e)
          toast.show(t('photosTrashRestoreFailed'), 4500)
        })
      },
    })
  } catch (e) {
    console.error('[photos-smartviews] doDelete', e)
    toast.show(t('photosSvDeleteFailed'))
  }
}

async function duplicateSv(): Promise<void> {
  const s = sv.value
  moreOpen.value = false
  if (!s) return
  try {
    await store.duplicateSmartView(s.id)
    toast.show(t('photosSvDuplicatedNameOpenCopy', { name: s.name }))
  } catch (e) {
    console.error('[photos-smartviews] duplicateSv', e)
    toast.show(t('photosSvDuplicateFailed'))
  }
}

// SP15-P2b Task 8 (Vue2 939a7d3a diff's askConvertToAlbum/closeConvertToAlbum/
// doConvertToAlbum): the reverse of Task 7's convertFromAlbum. Freezes the current matches
// into a regular album and drops the smart view's conditions/live-updating -- not dressed up
// as reversible.
function askConvertToAlbum(): void {
  moreOpen.value = false
  convertError.value = ''
  convertToAlbumOpen.value = true
}

function closeConvertToAlbum(): void {
  // No dismissal mid-flight, or the user loses track of whether the request landed --
  // same guard as AlbumConvertToSmartDialog.vue's close() for the forward direction.
  if (convertingToAlbum.value) return
  convertToAlbumOpen.value = false
}

async function doConvertToAlbum(): Promise<void> {
  const s = sv.value
  if (!s || convertingToAlbum.value) return
  convertingToAlbum.value = true
  convertError.value = ''
  try {
    const album = await albums.convertFromSmartView(s.id)
    convertToAlbumOpen.value = false
    toast.show(t('photosSvConvertedToAlbum'))
    // Vue2 :631-647 emits to its host, which closes the panel, refetches both lists and
    // opens the new album. Here the destination is a real route that loads the album
    // itself, and the smart view no longer exists server-side -- no refetch needed.
    void router.push('/photos/albums/' + String(album.id))
  } catch (e) {
    console.error('[photos-smartviews] convertToAlbum', e)
    // Inline, not a toast: this answers the button just pressed, so it belongs next to it
    // and must not time out (same call as doConvertToAlbum's sibling AlbumConvertToSmartDialog
    // .vue). A 409 reuses the album pages' existing duplicate-name wording.
    convertError.value = isConflict(e) ? t('photosAlbumNameExists') : t('photosAlbumConvertFailed')
  } finally {
    // Cleared even on failure -- the dialog stays open precisely so retry is one click.
    convertingToAlbum.value = false
  }
}

// ── Two photo grids (structure spec 10) ─────────────────────────────────────────────────
// The lightbox's browsing range is scoped to this smart view's full match set (not the whole
// library). Both grids share this one handler, but SP15-P2c Task 9 (target 33b05636 :96/:107
// `onTileClick(p, list)`) stopped always forwarding `store.matchedAssets`: each grid now passes
// in *its own* currently-sorted display order (`recentSet`/`matchedSet`, already run through
// sortBy) from the template's v-for scope, and this just forwards it on to `lb.openAt`. E8's
// finding: once Task 6 added the Sort capsule, the grid re-orders on sortBy but the lightbox
// kept getting the unsorted store array, so "next" in the lightbox jumped to a photo that was
// not adjacent on screen -- this signature change is that fix.
// No fourth arg (query) => no OCR highlighting, matching Vue2.
function onTileClick(p: Photo, list: Photo[]): void {
  // Vue2 :456-459 (onTileClick): selection mode suppresses the lightbox — a tap either
  // selects or opens, never both. This has to come first, before the "New" badge is
  // optimistically cleared: selecting a recently-added photo must not mark it as seen.
  if (edit.value) {
    toggleSelect(String(p.id))
    return
  }
  const r = store.recentAssets.find((x) => String(x.id) === String(p.id))
  // Mutate that element's property inside recentAssets directly, in place (not replacing the
  // array or creating a new object): an in-store optimistic clear that hides the "New" badge
  // early -- the real view record lands asynchronously on the backend via something like
  // recordView inside lb.openAt; this is just immediate feedback here. The comment deliberately
  // spells out that mutating the store ref's element property directly is intentional, not an
  // oversight.
  if (r && r.isNew) r.isNew = false
  // The third arg is startMs (only meaningful for isVideo), not an index -- openAt computes the
  // index itself from the photo's position in `list` (useLightbox.ts's photoIndexById), so this
  // stays 0 unchanged from before this task.
  lb.openAt(p, list, 0)
}

// ── SP15-P2a: manual asset actions (Vue2 :456-534) ───────────────────────────────────────
// A smart view's membership is generated from its conditions; these four actions are the
// annotations layered on top of it — pin a photo the conditions missed, remove one (which
// either unpins it or flags it excluded), and put an excluded one back.
const pickerOpen = ref(false)
// SP15-P2c Task 6 -- state decision, registered as the brief asks. P2a's `selecting` is REUSED
// and renamed `edit` rather than a second flag being added beside it. Vue2 made the identical
// call and said so at :449-451 ("behaviour unchanged, only the name and the entry point"): the
// flag Edit/Done drives is the same one that suppresses the lightbox, draws the tile checkmarks
// and gates the bottom bar. A separate `edit` alongside `selecting` would be two names for one mode, and
// every predicate on this page (onTileClick, the route watcher, removeSelected,
// onExcludedTileClick, both grids' `data-selected`) would have to pick one and stay right
// about it forever. The button's copy changes with the name -- photosPersonSelect/photosCancel
// give way to photosAlbumEdit/photosAlbumDone -- and both old keys keep other consumers
// (PersonAssetGrid.vue:124 and PhotosMomentDetail.vue:648; photosCancel has 38 more), so
// neither is orphaned by this rename.
const edit = ref(false)
const selectedIds = ref<string[]>([])
const excludedOpen = ref(false)

// Target :319-322: the bar's own label covers the empty case, which is why the bar can appear
// before anything is picked.
const selectHint = computed(() => (
  selectedIds.value.length
    ? t('photosSelectedCount', { count: selectedIds.value.length })
    : t('photosSvClickToSelect')
))

// The ids the picker must show as already-in. Normalising with String() here is load-bearing:
// asset ids arrive from the API as numbers on some paths while timeline photo ids are strings,
// and a mismatch silently un-dims every tile. Same correction as PhotosAlbums.vue:163.
const viewAssetIds = computed(() => new Set(store.matchedAssets.map((p) => String(p.id))))

function toggleEdit(): void {
  edit.value = !edit.value
  if (!edit.value) selectedIds.value = []
  // Task 7 fold-in, finding (b): keyboard-activating this button (Space/Enter on a focused
  // element) fires a `click` but no `mousedown` -- the event onDocumentMouseDown listens for
  // to close the sort menu. Without this, entering edit mode that way leaves `sortMenuOpen`
  // true while the template unmounts the sort capsule (`v-if="!edit"`), and the popup
  // reappears the moment edit mode is left again, with no visible trigger for it. Sort has no
  // meaning in edit mode either way, so it is safe to always close it here, entering or leaving.
  sortMenuOpen.value = false
}

function toggleSelect(id: string): void {
  selectedIds.value = selectedIds.value.includes(id)
    ? selectedIds.value.filter((x) => x !== id)
    : [...selectedIds.value, id]
}

// Vue2 :516-534 (onPickPhotos). The store action already refetches this view's statistics,
// so only the asset grids are reloaded here. Both refreshes are needed: a pinned photo joins
// the matched grid, and pinning one that was previously excluded takes it out of the
// excluded band.
async function onPickPhotos(assetIds: Array<string | number>): Promise<void> {
  const id = svId.value
  const ids = assetIds.map(String)
  try {
    const n = await store.pinAssets(id, ids)
    // `null` means the store dropped the call because another write was still in flight —
    // nothing was sent, so nothing is reported and the picker keeps the user's selection
    // (final review, finding 5: this used to toast "已钉住 0 张到此视图" and close).
    if (n === null) return
    toast.show(t('photosSvPinnedNToView', { n }))
    pickerOpen.value = false
    await Promise.all([store.loadDetail(id), store.loadExcluded(id)])
  } catch (e) {
    console.error('[photos-smartviews] pinAssets', e)
    // The picker deliberately stays open on failure — the user still has their selection
    // and can retry without picking everything again (Vue2 rethrows from its handler to get
    // the same effect, its picker closing itself only on a resolved confirm).
    toast.show(t('photosSvAddFailed'), 2500, 'danger')
  }
}

// Vue2 :470-488 (removeSelected).
async function removeSelected(): Promise<void> {
  const id = svId.value
  const ids = selectedIds.value.slice()
  if (!ids.length) return
  try {
    const r = await store.removeAssets(id, ids)
    // Dropped because another write was in flight — nothing was sent, so the selection stays
    // and nothing is claimed (final review, finding 5).
    if (r === null) return
    // Removal is tiered on the backend — a pinned row is deleted, an automatically matched
    // one is flagged excluded — so the confirmation counts both (Vue2 :474).
    toast.show(t('photosSvRemovedNFromView', { n: r.unpinned + r.excluded }))
    // Cleared on success only, as in Vue2 :486: after a failure the selection is exactly
    // what the user needs in order to press the button again.
    edit.value = false
    selectedIds.value = []
    await Promise.all([store.loadDetail(id), store.loadExcluded(id)])
  } catch (e) {
    console.error('[photos-smartviews] removeAssets', e)
    toast.show(t('photosSvRemoveFailed'), 2500, 'danger')
  }
}

// Vue2 :493-503 (restoreOne). Clicking an excluded tile is the whole gesture — there is no
// separate confirm, which is why the band stays collapsed until asked for.
//
// Selection mode makes the tile inert instead (deviation 6 in the file header): Vue 2 fires
// the restore regardless, so the one tile on the page that does not toggle a checkmark
// silently writes to the server instead.
async function onExcludedTileClick(id: string): Promise<void> {
  if (edit.value) return
  const svid = svId.value
  try {
    const n = await store.restoreAssets(svid, [id])
    // Dropped because another write was in flight — nothing was sent, so there is nothing to
    // refetch (final review, finding 5).
    if (n === null) return
    await Promise.all([store.loadDetail(svid), store.loadExcluded(svid)])
  } catch (e) {
    console.error('[photos-smartviews] restoreAssets', e)
    toast.show(t('photosSvRestoreFailed'), 2500, 'danger')
  }
}
</script>

<template>
  <AreaShell :title="sv ? sv.name : t('photosSvSmartViews')">
    <div class="photos-layout photos-root" :class="themeClass">
      <PhotosSidebar />
      <main class="photos-main">
        <!-- Gate ①: the list has not finished loading yet → skeleton (new to New-UI, Vue2 has no such concept) -->
        <div v-if="!store.listLoaded" class="sv-skeleton" data-test="sv-skeleton">
          <div class="sv-skel-bar" />
          <div class="sv-skel-header" />
          <div class="sv-skel-grid">
            <div v-for="i in 12" :key="i" class="sv-skel-tile" />
          </div>
        </div>

        <!-- Gate ②: the list has finished loading, but byId finds no match (registered deviation 1: a path new to New-UI) -->
        <div v-else-if="!sv" class="sv-not-found" data-test="sv-not-found">
          <div class="sv-not-found-title">{{ t('photosSvNotFound') }}</div>
          <button
            type="button" class="sv-not-found-back" data-test="sv-not-found-back"
            @click="router.push('/photos/albums')"
          >{{ t('photosAlbumBack') }}</button>
        </div>

        <!-- Gate ③: normal content -->
        <template v-else>
          <div class="sv-detail-bar">
            <!-- Deviation from Vue 2, registered. 939a7d3a:PhotosSmartViewDetail.vue:5 still
                 labels this button "All Smart Views" even though #112 made its @back return to
                 the Albums list -- Vue 2 shipped a button whose label lies about where it goes.
                 A misleading label is a user-visible defect rather than a styling choice, so
                 this port keeps Vue 2's destination and fixes the label, reusing the album
                 detail page's existing photosAlbumBack (PhotosAlbumDetail.vue:433) rather than
                 adding a key. photosSvAllSmartViews is deleted in the same commit. -->
            <button
              type="button" class="sv-back-btn" data-test="sv-detail-back"
              @click="router.push('/photos/albums')"
            >
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
              {{ t('photosAlbumBack') }}
            </button>
            <div style="flex:1" />
            <span class="sv-last-updated">{{ t('photosSvLastUpdatedTime', { time: lastUpdated }) }}</span>
          </div>

          <!-- fix round 1 · M2: Vue2 :10-11's two-layer container (sv-detail-layout grid 1fr/320px +
               sv-detail-main) was missing from the first pass -- `.sv-detail-side` invented its own
               empty-shell margin sitting below the grid instead. The moment T8 fills it with content,
               that content would land below the grid instead of in the right rail -- a foreseeable
               structural rework. Built in this round; the aside's inside is still T8's empty mount
               point, content not implemented ahead of time. -->
          <div class="sv-detail-layout">
          <div class="sv-detail-main">
          <div class="sv-header">
            <div style="flex:1;min-width:0">
              <h1>
                <span
                  v-if="!titleEdit" class="sv-title" data-test="sv-title-view"
                  :title="t('photosAlbumClickToRename')" @click="startTitleEdit"
                >{{ sv.name }}</span>
                <input
                  v-else ref="titleInputRef" v-model="titleDraft" class="sv-title-input" data-test="sv-title-input"
                  @keydown.enter.prevent="commitTitle" @keydown.esc.prevent="cancelTitle" @blur="commitTitle"
                >
                <span
                  class="live-pill" :class="{ 'paused-pill': paused }" role="button" tabindex="0"
                  data-test="sv-live-pill" :title="t(paused ? 'photosSvResumeAutoUpdates' : 'photosSvPauseAutoUpdates')"
                  @click="togglePaused" @keydown="onPillKeydown"
                ><span class="live-dot" /> {{ t(paused ? 'photosSvPaused' : 'photosSvLive') }}</span>
              </h1>

              <!-- SP15-P2c Task 8: "Add condition" button + popover deleted here (ported from
                   Vue2 NimoOS-UI 33b05636 PhotosSmartViewDetail.vue:26-30, "user-added requirement") --
                   only the removable chips survive. This used to mount a dedicated
                   condition-editor component; once `add` was gone it was down to a
                   bare v-for with no local state, so it folded back in here (see
                   task-8-report.md for the reasoning). -->
              <div class="sv-header-conds" data-test="sv-header-conds">
                <span
                  v-for="c in sv.conds" :key="c" class="sv-cond sv-cond-removable" data-test="sv-cond-chip"
                  :data-busy="store.patchBusy" :title="t('photosSvRemoveC', { c })" @click="removeCond(c)"
                >
                  {{ c }}
                  <span class="sv-cond-x">
                    <svg viewBox="0 0 24 24" width="9" height="9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                  </span>
                </span>
              </div>

              <div class="sv-header-stats">
                <span><b data-test="sv-stat-count">{{ fmtNum(sv.count) }}</b> {{ t('photosSvPhotosCount') }}</span>
                <span v-if="newCount > 0" data-test="sv-stat-delta"><b class="delta">+{{ newCount }}</b> {{ t('photosSvThisWeek') }}</span>
                <span>{{ t('photosSvMedianMatch') }} <b data-test="sv-stat-median">{{ median }}%</b></span>
                <span>{{ t('photosStorage') }} <b data-test="sv-stat-storage">{{ storageText }}</b></span>
              </div>
            </div>

            <!-- SP15-P2c Task 6 (target :49-90). The row reads: Sort label -> capsule ->
                 separator -> Pause/Resume -> Edit/Done -> separator -> density. Sort and
                 density render outside edit mode only; Pause and Edit are unconditional, so in
                 edit mode those two are all that is left and Edit is how you get back out. Each
                 separator is inside the `v-if` of the group it parts, so neither can be left
                 dangling. P2a's separate Add photos and Select buttons are gone: Select's job
                 is now Edit/Done, and Add photos moved into the edit-mode bar at the bottom of
                 this file (target :318-333).
                 PARKED, NOT KEPT: Refine in Search, the Export menu and the "..." menu all sit
                 at the END of this row until Task 7 gives them their target home in the sidebar
                 (.sv-side-actions) and folds Export's two items into the "..." menu. Removing
                 them here would leave rename/duplicate/convert/delete/export unreachable for a
                 whole task -- the same call Task 3 made on the album page's own "..." menu,
                 which Task 5 then moved. Everything before them is already in the target's
                 order, so Task 7 only has to lift them out. -->
            <div class="sv-actions">
              <template v-if="!edit">
                <span class="group">{{ t('photosAlbumSort') }}</span>
                <div ref="sortMenuRef" class="sv-sort-wrap">
                  <button type="button" class="order-pill" data-test="sv-sort-btn" @click.stop="sortMenuOpen = !sortMenuOpen">
                    {{ currentSortLabel }}
                    <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                  </button>
                  <div v-if="sortMenuOpen" class="sv-sort-menu" data-test="sv-sort-menu">
                    <!-- Target :57-68 marks the active option with a check glyph and holds the
                         labels in line with a same-width spacer when there is none. -->
                    <button
                      v-for="s in sortOptions" :key="s.id"
                      type="button" class="sv-sort-item" data-test="sv-sort-item"
                      :data-sort-id="s.id" :data-active="s.id === sortBy"
                      @click="pickSort(s.id)"
                    >
                      <svg v-if="s.id === sortBy" class="sv-sort-check" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7" /></svg>
                      <span v-else class="sv-sort-check" />
                      <span class="lbl">{{ s.label }}</span>
                    </button>
                  </div>
                </div>
                <div class="album-detail-actions-sep" />
              </template>

              <button type="button" class="sv-action-btn" data-test="sv-action-pause" @click="togglePaused">
                <svg v-if="paused" viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                <svg v-else viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><rect x="6" y="5" width="4" height="14" /><rect x="14" y="5" width="4" height="14" /></svg>
                {{ t(paused ? 'photosSvResume' : 'photosSvPause') }}
              </button>
              <button
                type="button" class="sv-action-btn" data-test="sv-edit-toggle"
                :data-open="edit" @click="toggleEdit"
              >
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" /></svg>
                {{ edit ? t('photosAlbumDone') : t('photosAlbumEdit') }}
              </button>

              <template v-if="!edit">
                <div class="album-detail-actions-sep" />
                <div class="density">
                  <button
                    type="button" data-test="sv-density-comfortable"
                    :data-active="density === 'comfortable'" :title="t('photosDensityComfortable')"
                    @click="density = 'comfortable'"
                  >
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="8" height="8" rx="1" /><rect x="13" y="3" width="8" height="8" rx="1" /><rect x="3" y="13" width="8" height="8" rx="1" /><rect x="13" y="13" width="8" height="8" rx="1" /></svg>
                  </button>
                  <button
                    type="button" data-test="sv-density-compact"
                    :data-active="density === 'compact'" :title="t('photosDensityCompact')"
                    @click="density = 'compact'"
                  >
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="6" height="6" rx="1" /><rect x="11" y="3" width="6" height="6" rx="1" /><rect x="3" y="11" width="6" height="6" rx="1" /><rect x="11" y="11" width="6" height="6" rx="1" /><rect x="3" y="19" width="6" height="2" /><rect x="11" y="19" width="6" height="2" /></svg>
                  </button>
                </div>
              </template>

              <!-- Task 7: Refine in Search and the "..." menu are no longer in this row --
                   both moved to the new `.sv-side-actions` container at the top of
                   `aside.sv-detail-side` (target 33b05636 :127-225; see that container's own
                   comment for the full trail). Task 6 parked them here only because the
                   fixed-position composable did not exist yet at that point. -->
            </div>
          </div>

          <!-- "Recently added" band: rendered only while newCount > 0. Its tiles read
               `recentSet` -- store.recentAssets in the order the Sort capsule currently asks
               for (SP15-P2c Task 6). -->
          <template v-if="newCount > 0">
            <div class="sv-section-head" data-test="sv-recent-head">
              {{ t('photosSvRecentlyAdded') }} <span class="pill">{{ t('photosSvNNewThisWeek', { n: newCount }) }}</span>
            </div>
            <div class="sv-grid-photos sv-grid-photos-recent" :class="{ 'is-compact': density === 'compact' }" data-test="sv-recent-grid">
              <div
                v-for="p in recentSet" :key="p.id" class="tile" :class="{ recent: p.isNew }"
                :data-selected="edit && selectedIds.includes(String(p.id))"
                data-test="sv-recent-tile" @click="onTileClick(p, recentSet)"
              >
                <img :src="service.photos.thumbnailUrl(p.id, 'large')" alt="" loading="lazy">
                <div v-if="p.isNew" class="new-tag">{{ t('photosSvNew') }}</div>
                <!-- SP15-P2a (Vue2 :146-147): pin badge on the right, selection check on the
                     left, so the two never collide on the same tile. Both grids carry both. -->
                <div v-if="p.pinned" class="sv-pin-tag" data-test="sv-pin-tag">
                  <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-6.3 7-11a7 7 0 10-14 0c0 4.7 7 11 7 11z" /><circle cx="12" cy="10" r="2.2" /></svg>
                </div>
                <div v-if="edit && selectedIds.includes(String(p.id))" class="sv-tile-check">
                  <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7" /></svg>
                </div>
              </div>
            </div>
          </template>

          <!-- "All matches" band: tiles read `matchedSet` -- store.matchedAssets in the order
               the Sort capsule currently asks for (SP15-P2c Task 6). -->
          <div class="sv-section-head" data-test="sv-all-head">
            {{ t('photosSvAllMatches') }} <span class="pill">{{ fmtNum(sv.count) }}</span>
          </div>
          <div class="sv-grid-photos" :class="{ 'is-compact': density === 'compact' }" data-test="sv-all-grid">
            <div
              v-for="p in matchedSet" :key="p.id" class="tile"
              :data-selected="edit && selectedIds.includes(String(p.id))"
              data-test="sv-all-tile" @click="onTileClick(p, matchedSet)"
            >
              <img :src="service.photos.thumbnailUrl(p.id, 'large')" alt="" loading="lazy">
              <div v-if="p.pinned" class="sv-pin-tag" data-test="sv-pin-tag">
                <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-6.3 7-11a7 7 0 10-14 0c0 4.7 7 11 7 11z" /><circle cx="12" cy="10" r="2.2" /></svg>
              </div>
              <div v-if="edit && selectedIds.includes(String(p.id))" class="sv-tile-check">
                <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7" /></svg>
              </div>
            </div>
          </div>

          <!-- SP15-P2a "Excluded" section (Vue2 :161-172): the whole block only appears when there
               are excluded items, and is collapsed by default -- it's a record of past decisions,
               not this view's content. Clicking a tile restores it immediately, no confirmation. -->
          <template v-if="store.excluded.length">
            <div
              class="sv-section-head sv-excluded-head" data-test="sv-excluded-head"
              @click="excludedOpen = !excludedOpen"
            >
              {{ t('photosSvExcludedN', { n: store.excluded.length }) }}
              <span class="pill">{{ excludedOpen ? t('photosSvHide') : t('photosSvShow') }}</span>
            </div>
            <div v-if="excludedOpen" class="sv-grid-photos sv-excluded-grid" data-test="sv-excluded-grid">
              <div
                v-for="p in store.excluded" :key="p.id" class="tile"
                :data-inert="edit" data-test="sv-excluded-tile"
                @click="onExcludedTileClick(String(p.id))"
              >
                <img :src="service.photos.thumbnailUrl(p.id, 'large')" alt="" loading="lazy">
                <div class="sv-restore-hint">{{ t('photosSvRestore') }}</div>
              </div>
            </div>
          </template>
          </div>

          <!-- T8 delivered: right rail (threshold slider / settings toggles / four stat tiles / match distribution) + activity feed. -->
          <aside class="sv-detail-side" data-test="sv-side-mount">
            <!-- Task 7 (target 33b05636 :127-225). The "..." menu's target home -- moved here
                 from the header's .sv-actions, where Task 6 parked it unchanged (mounting it
                 in this overflow-y:auto sidebar before the fixed-position composable existed
                 would have reproduced the exact clipping bug that composable fixes; see
                 PhotosAlbumDetail.vue's own identical note, Task 5, which this container's
                 structure matches on purpose -- the point of this task is that the two detail
                 pages end up the same).

                 The five entries are the target's full set, in its order: Rename / Duplicate /
                 Download as ZIP / Convert / Delete. Unlike PhotosAlbumDetail.vue's own copy of
                 this menu, THIS page's entries call THIS page's existing backends, not the
                 album page's (brief's own warning, verified against each): Duplicate is
                 `store.duplicateSmartView` (smartViews.ts:342, no-ops on re-entry rather than
                 throwing -- not albums.ts's `duplicateAlbum`), Download as ZIP is this page's
                 own `downloadZip` (POST + Authorization header, not JWT-exempt -- not
                 `exportAlbumZipUrl`'s GET+token navigation), and Convert goes the opposite
                 direction from the album page's (smart view -> regular album, via
                 `askConvertToAlbum`/`albums.convertFromSmartView`, not regular -> smart via
                 `AlbumConvertToSmartDialog`). "Save as static album" does NOT reappear as a
                 sixth entry -- see `exportAlbumAction`'s own removal note above the more-menu
                 handlers for why that capability is deleted rather than folded in.

                 The menu itself is position:fixed via `menuStyle` (T1's useFixedMenuPosition
                 bound to `moreBtnRef`'s rect); `morePopRef` still wraps both the button and the
                 menu for click-outside dismissal (onDocumentMouseDown above) -- the composable
                 only computes coordinates, it does not touch open/close. Vue2 wraps this same
                 menu in <transition name="sv-menu"> (33b05636 :78) -- kept here.

                 Correction (whole-branch review, Important 4): this note used to justify the
                 asymmetry with PhotosAlbumDetail.vue by claiming the target's album page carries
                 no such transition. That claim was factually wrong -- 33b05636
                 src/views/Photos/PhotosAlbumDetail.vue:223/:278 wraps its own menu in exactly
                 the same <transition name="sv-menu">. The album page has since been given the
                 wrapper and the two .sv-menu-* rules, so the two menus now animate identically
                 and there is no asymmetry left to justify. -->
            <div class="sv-side-actions">
              <button
                type="button" class="sv-action-btn" data-test="sv-action-refine"
                @click="refineInSearch"
              >
                <!-- fix wave F7 (final review, incidental item): the magnifier handle used to be
                     `M21 21l-4.3-4.3` -- the one outlier in the whole repo; the other 4 places
                     (PhotosSearchBar.vue/PhotosSearch.vue/PlaceCoverPicker.vue x2) all use
                     `m20 20-3.5-3.5` (the circle params cx=11 cy=11 r=7 already matched across all
                     four, only the handle length differed). When the user clicks "Refine in search"
                     on this detail page into the search page, the magnifier handle length used to
                     jump between the two screens -- changed to the same value. -->
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
                {{ t('photosSvRefineSearch') }}
              </button>

              <div ref="morePopRef" class="sv-more-wrap">
                <button
                  ref="moreBtnRef" type="button" class="sv-action-btn sv-action-btn-icon" data-test="sv-more-toggle"
                  :data-open="moreOpen" @click="toggleMoreMenu"
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg>
                </button>
                <Transition name="sv-menu">
                <div v-if="moreOpen" class="sv-export-menu sv-more-menu" data-test="sv-more-menu" :style="menuStyle">
                  <button type="button" class="sv-export-item" data-test="sv-more-rename" @click="startTitleEdit">
                    <div class="sv-export-icon"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" /></svg></div>
                    <div>
                      <div class="sv-export-title">{{ t('photosSvRename') }}</div>
                      <div class="sv-export-desc">{{ t('photosSvChangeSmartViewName') }}</div>
                    </div>
                  </button>
                  <button type="button" class="sv-export-item" data-test="sv-more-duplicate" @click="duplicateSv">
                    <div class="sv-export-icon"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 012-2h10" /></svg></div>
                    <div>
                      <div class="sv-export-title">{{ t('photosSvDuplicate') }}</div>
                      <div class="sv-export-desc">{{ t('photosSvCopyQuerySv') }}</div>
                    </div>
                  </button>
                  <!-- Task 7: the Export section's ZIP item (sv-export-zip) folds in here as
                       the menu's third entry, between Duplicate and Convert -- the target's own
                       order. Same handler (`downloadZip`), same copy, new data-test. -->
                  <button type="button" class="sv-export-item" data-test="sv-more-zip" @click="downloadZip">
                    <div class="sv-export-icon"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 10l5 5 5-5M5 21h14" /></svg></div>
                    <div>
                      <div class="sv-export-title">{{ t('photosFavExport') }}</div>
                      <div class="sv-export-desc">{{ t('photosSvNPhotosMbMb', { n: fmtNum(sv.count), mb: fmtNum(Math.round(sv.count * 3.2)) }) }}</div>
                    </div>
                  </button>
                  <!-- SP15-P2b Task 8 (Vue2 939a7d3a diff): grouped with rename/duplicate/zip
                       above the destructive separator, not beside Delete -- this is not a
                       destructive action, it freezes the current matches into a regular
                       album. -->
                  <button type="button" class="sv-export-item" data-test="sv-more-convert" @click="askConvertToAlbum">
                    <div class="sv-export-icon"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="18" height="14" rx="2" /><path d="M12 11v6M9 14h6" /><path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2" /></svg></div>
                    <div>
                      <!-- Task 7 review fix: the target shortened both this title and Delete's
                           below specifically so the two "matching" detail pages' menus read the
                           same (33b05636 :143-147's own comment on the change). This entry used
                           `photosSvConvertToAlbum` ("转为普通相册"), the long form Task 8 wrote
                           before this page had a sibling to match against -- the album page's
                           own Convert entry (Task 5) already reuses `photosAlbumMenuConvert`
                           ("转换", the target's exact short copy), so this switches to the same
                           key rather than coining a new SV-specific one. The confirm dialog's
                           own submit button (further down this file) still reads
                           `photosSvConvertToAlbum` unchanged -- that button predates this task,
                           is not one of the two rows the reviewer flagged, and the target itself
                           gives it the same short "Convert" copy too, so revisiting it is a
                           separate, larger cleanup outside this fix's scope. -->
                      <div class="sv-export-title">{{ t('photosAlbumMenuConvert') }}</div>
                      <!-- Desc intentionally NOT realigned to the target's shorter
                           "停止自动更新,固化当前照片": `photosSvConvertToAlbumHint`
                           ("停止自动更新，固化当前已匹配的照片") is semantically identical and
                           was a deliberate registration back in SP15-P2b (this page's Convert
                           entry existed before this task). Only the two titles were shortened
                           in the target's own commit for cross-page parity; the descs were
                           left alone there too (the "Vue2 :119-123's three inline coral-red
                           literals" note below shows Vue2 continuing to carry its own full desc copy
                           unchanged). Realigning this desc now would be scope creep onto a
                           different task's registered decision for a wording difference with
                           no user-visible parity gap -- recorded here rather than changed. -->
                      <div class="sv-export-desc">{{ t('photosSvConvertToAlbumHint') }}</div>
                    </div>
                  </button>
                  <div class="sv-export-sep" />
                  <!-- All three of Vue2 :119-123's inline coral-red literals become the --remove-fg family (see the style block). -->
                  <button type="button" class="sv-export-item sv-export-item-danger" data-test="sv-more-delete" @click="openDeleteConfirm">
                    <div class="sv-export-icon sv-export-icon-danger"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg></div>
                    <div>
                      <!-- Task 7 review fix: same reasoning as Convert above -- the target
                           shortened this to plain "Delete" ("删除") for cross-page parity.
                           `photosDelete` already carries exactly that copy and is already the
                           key this page's own delete-confirmation button uses (below), so no
                           new key is needed; `photosSvDeleteSmartView` ("删除智能视图") lost its
                           last consumer here and Task 11's orphan sweep removed it. -->
                      <div class="sv-export-title">{{ t('photosDelete') }}</div>
                      <div class="sv-export-desc">{{ t('photosSvPhotosStayLibrary') }}</div>
                    </div>
                  </button>
                </div>
                </Transition>
              </div>
            </div>

            <SmartViewSidePanel :sv="sv" :busy="store.patchBusy" @patch="onSidePatch" />
            <SmartViewActivityFeed :activity="store.activity" />
          </aside>
          </div>
        </template>
      </main>
    </div>

    <!-- Export-result in-page floating bar (structure spec 7): in Vue2 this is an in-page
         positioned floating bar (scss:458-476), different from useToast's global position --
         the information hierarchy differs, so it's hand-drawn to match Vue2 rather than reusing
         useToast. -->
    <transition name="sv-toast-fade">
      <div v-if="exportToast" class="sv-toast" data-test="sv-export-toast">
        <svg v-if="exportToast.icon === 'download'" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 10l5 5 5-5M5 21h14" /></svg>
        <svg v-else viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14" /></svg>
        {{ exportToast.text }}
      </div>
    </transition>

    <!-- Edit-mode bottom bar (target :318-333). SP15-P2c Task 6 reshapes P2a's version into the
         target's three elements — hint, Remove, Add photos — and re-gates it on `edit` alone
         instead of `edit && selectedIds.length`. The gate has to change: the bar now carries
         the hint line that speaks for the empty selection, and Add photos, which would be
         unreachable in a smart view with nothing selected otherwise. What used to keep an empty
         Remove request impossible is now the button's own `disabled` (plus removeSelected's own
         early return), which is where the album page puts it too.
         `&& sv` guards the same hole PhotosAlbumDetail.vue:1005 does: this bar is a sibling of
         .photos-layout, outside the `v-else` that requires a smart view, so without it the bar
         would float over the not-found state if the view vanished without the id changing. -->
    <div v-if="edit && sv" class="sv-select-bar" data-test="sv-select-bar">
      <span class="group">
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg>
        {{ selectHint }}
      </span>
      <button
        type="button" class="sv-action-btn" data-test="sv-remove-selected"
        :disabled="!selectedIds.length || store.assetBusy" @click="removeSelected"
      >
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg>
        {{ t('photosSvRemoveFromView') }}
      </button>
      <button type="button" class="sv-action-btn" data-test="sv-add-photos" @click="pickerOpen = true">
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4m0 0-4 4m4-4 4 4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" /></svg>
        {{ t('photosSvAddPhotos') }}
      </button>
    </div>

    <!-- SP15-P2a library picker (Vue2 :283-291). Title reuses photosAlbumPickerTitle --
         Vue2 already feeds one string to two pickers.
         submit-label: Vue2 :288 passes this picker a static `$t('Add selected')`, not the
         count-bearing `Add ({count})` the two album pages use. The first version passed the
         album pages' count function here and cited PhotosLibraryPicker deviation b -- but
         that deviation is about keeping the album pages' existing consumers unchanged, and
         says nothing about which form a **new** consumer should use (final review, finding
         3). Reverted to the static label, reusing P1's existing photosMoAddSelected (the
         same Vue2 copy, no new key); the two album pages still pass the function. -->
    <PhotosLibraryPicker
      v-model:open="pickerOpen"
      :title="t('photosAlbumPickerTitle', { name: sv?.name ?? '' })"
      :existing-ids="viewAssetIds"
      :existing-label="t('photosSvAlreadyInView')"
      :submit-label="t('photosMoAddSelected')"
      :submitting="store.assetBusy"
      @confirm="onPickPhotos"
    />

    <!-- Delete confirmation dialog (structure spec 9, copied verbatim from Vue2 :239-253's
         content and copy; the class names don't reuse Vue2's borrowed lightbox lb-confirm-*
         naming -- this repo's PhotoLightbox.vue already has a same-named but differently-scoped
         style, so this uses sv-confirm-* instead to avoid misleading readers into thinking it's
         the same place; visually a 1:1 port). -->
    <Transition name="sv-confirm">
    <div v-if="confirmDeleteOpen" class="sv-confirm-scrim" data-test="sv-confirm-scrim" @click.self="closeDeleteConfirm">
      <div class="sv-confirm-panel">
        <div class="sv-confirm-icon"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg></div>
        <div class="sv-confirm-title">{{ t('photosSvDeleteName', { name: sv?.name }) }}</div>
        <div class="sv-confirm-body">{{ t('photosSvSmartViewRemovedStops', { n: fmtNum(sv?.count ?? 0) }) }}</div>
        <div class="sv-confirm-foot">
          <button type="button" class="sv-confirm-cancel" data-test="sv-confirm-cancel" @click="closeDeleteConfirm">{{ t('photosCancel') }}</button>
          <button type="button" class="sv-confirm-ok danger" data-test="sv-confirm-ok" @click="doDelete">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg>
            {{ t('photosDelete') }}
          </button>
        </div>
      </div>
    </div>
    </Transition>

    <!-- SP15-P2b Task 8: convert-to-album confirmation -- same sv-confirm-* visual idiom as
         the delete confirmation above. The copy spells out all three consequences (updates
         stop, members are fixed, theme and conditions are removed), not dressed up as
         reversible.
         Final fix wave: the submit button carries `.primary`, not `.danger` and not the bare
         base class. Vue2 uses its filled primary CTA here (`trash-btn-cta`,
         939a7d3a:photos.scss:2203-2213 -- filled accent, light text, weight 600), while the
         delete dialog above uses the danger variant. With neither modifier the button rendered
         as a ghost pixel-identical to the Cancel beside it, with no hover feedback at all.
         The icon disc likewise takes `.accent`: Vue2 :298 tints this album glyph with
         var(--accent-hi) and only the delete dialog's trash glyph (:279) is red. -->
    <Transition name="sv-confirm">
    <div v-if="convertToAlbumOpen" class="sv-confirm-scrim" data-test="sv-convert-confirm" @click.self="closeConvertToAlbum">
      <div class="sv-confirm-panel">
        <div class="sv-confirm-icon accent"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="18" height="14" rx="2" /><path d="M12 11v6M9 14h6" /><path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2" /></svg></div>
        <div class="sv-confirm-title">{{ t('photosSvConvertToAlbumTitle', { name: sv?.name }) }}</div>
        <div class="sv-confirm-body">{{ t('photosSvConvertToAlbumBody', { n: fmtNum(sv?.count ?? 0) }) }}</div>
        <div v-if="convertError" class="sv-confirm-error" data-test="sv-convert-error">{{ convertError }}</div>
        <div class="sv-confirm-foot">
          <button type="button" class="sv-confirm-cancel" data-test="sv-convert-cancel" :disabled="convertingToAlbum" @click="closeConvertToAlbum">{{ t('photosCancel') }}</button>
          <button type="button" class="sv-confirm-ok primary" data-test="sv-convert-ok" :disabled="convertingToAlbum" @click="doConvertToAlbum">
            {{ convertingToAlbum ? t('photosAlbumConverting') : t('photosSvConvertToAlbum') }}
          </button>
        </div>
      </div>
    </div>
    </Transition>
  </AreaShell>
</template>

<style scoped>
/* Fix round 1 (controller-adjudicated, task-3-report.md Disclosure 1): this page still
   uses the old flex-row `.photos-layout` shell (its own re-skin task hasn't landed yet), but
   its root now carries `.photos-root` so the shared PhotosSidebar's Vue2 `.sidebar` root gets
   the parity look. Parity scss deliberately sets no width on `.sidebar` itself (real
   pixel-parity width comes from the `.app` CSS Grid column Task 3 gave Photos.vue) — pin it
   here so the sidebar doesn't collapse to its shrink-to-fit content width in this page's
   flex row. Transitional: drop this rule once this page gets its own `.app` grid re-skin. */
.sidebar { flex: 0 0 var(--sidebar-w); align-self: stretch; overflow-y: auto; }

/* height (not min-height): this screen is capped, only the inner scroll container scrolls -- a
   same-source fix, reasoning and Vue2 origin are in the comment on the equivalent rule in
   src/views/Photos.vue. */
.photos-layout { display: flex; gap: 16px; align-items: flex-start; height: 100%; }
.photos-main { position: relative; flex: 1 1 auto; min-width: 0; align-self: stretch; display: flex; flex-direction: column; min-height: 0; }

/* ── Skeleton (new to New-UI) ── */
.sv-skeleton { display: flex; flex-direction: column; gap: 14px; padding: 16px 32px; }
.sv-skel-bar { height: 20px; width: 200px; border-radius: 6px; background: var(--skeleton-bg); }
.sv-skel-header { height: 90px; border-radius: var(--radius-sm); background: var(--skeleton-bg); }
.sv-skel-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 6px; }
.sv-skel-tile { aspect-ratio: 1; border-radius: 6px; background: var(--skeleton-bg); }

/* ── Not found (registered deviation 1, new to New-UI) ── */
.sv-not-found { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 80px 20px; color: var(--fg-muted); text-align: center; }
.sv-not-found-title { font-size: 15px; font-weight: 600; color: var(--fg); }
.sv-not-found-back { height: 34px; padding: 0 16px; border-radius: 8px; background: var(--chip-bg); border: 1px solid var(--chip-border); color: var(--fg); font: inherit; font-size: 13px; cursor: pointer; }
.sv-not-found-back:hover { background: var(--chip-bg-hi); }

/* ── Top bar (scss:146-159) ── */
.sv-detail-bar { padding: 16px 32px; display: flex; align-items: center; gap: 12px; border-bottom: 1px solid var(--divider); }
.sv-back-btn { display: inline-flex; align-items: center; gap: 4px; padding: 6px 10px 6px 8px; border-radius: 99px; background: var(--chip-bg); border: 1px solid var(--chip-border); color: var(--fg-muted); font: inherit; font-size: 12px; cursor: pointer; }
.sv-back-btn:hover { background: var(--chip-bg-hi); color: var(--fg); }
.sv-last-updated { font-size: 12px; color: var(--fg-muted); }

/* ── header(scss:210-253)── */
.sv-header { padding: 24px 32px 16px; display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; }
.sv-header h1 { font-family: var(--font-display, var(--font)); font-size: 28px; font-weight: 600; letter-spacing: -0.02em; margin: 0 0 8px; display: flex; align-items: center; gap: 10px; }
.sv-title { cursor: text; color: var(--fg); }
/* Vue2 :22 inline style, property by property: font-size:28px (already on h1) / font-weight:600
   (same) / letter-spacing:-0.02em (same) / min-width:300px / background / border / border-radius /
   padding / color / font / outline. */
.sv-title-input {
  background: var(--chip-bg); border: 1px solid var(--accent); border-radius: 8px;
  padding: 2px 10px; color: var(--fg); font: inherit; font-size: 28px; font-weight: 600;
  letter-spacing: -0.02em; font-family: var(--font-display, var(--font)); outline: none; min-width: 300px;
}
.live-pill {
  display: inline-flex; align-items: center; gap: 5px; padding: 3px 10px 3px 8px; border-radius: 99px;
  background: color-mix(in srgb, var(--success) 15%, transparent);
  border: 1px solid color-mix(in srgb, var(--success) 30%, transparent);
  color: var(--success); font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em;
  font-family: var(--font); vertical-align: middle; cursor: pointer; transition: filter 0.15s, transform 0.12s;
}
.live-pill:hover { filter: brightness(1.15); }
.live-pill:active { transform: scale(0.96); }
.live-pill .live-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--success); box-shadow: 0 0 6px var(--success); animation: sv-pulse 1.6s infinite; }
.live-pill.paused-pill {
  background: color-mix(in srgb, var(--dem-fg) 15%, transparent);
  border-color: color-mix(in srgb, var(--dem-fg) 32%, transparent);
  color: var(--dem-fg);
}
.live-pill.paused-pill .live-dot { background: var(--dem-fg); box-shadow: 0 0 6px var(--dem-fg); animation: none; }
@keyframes sv-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }

/* T7 delivered: Vue2 scss:252's container layout (T6 only left a min-height placeholder). */
.sv-header-conds { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 6px; align-items: center; min-height: 4px; }

/* SP15-P2c Task 8: chip styles moved in from the deleted condition-editor component
   (only the removable-chip half survives -- the add button / popover rules were dropped
   with the capability, not kept as dead selectors). Vue2 base .sv-cond
   (photos-smartview.scss:96-102 base + :253 header override) has no `:hover` rule of its
   own; the hover below is scss:255-282's `.sv-cond-removable`. */
.sv-cond {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: 999px;
  background: var(--chip-bg-hi);
  color: var(--fg-muted);
  font-size: 11.5px;
}
.sv-cond-removable {
  gap: 4px;
  cursor: pointer;
  padding-right: 6px;
  transition: background 0.12s, color 0.12s, padding 0.12s;
}
.sv-cond-x {
  width: 14px; height: 14px;
  display: inline-flex; align-items: center; justify-content: center;
  border-radius: 50%;
  background: color-mix(in srgb, var(--fg) 6%, transparent);
  color: var(--fg-faint);
  opacity: 0;
  transform: scale(0.7);
  transition: opacity 0.14s, transform 0.14s, background 0.12s;
}
/* Vue2's hardcoded coral-red literal maps to the --remove-fg family, matching this file's
   existing precedent (.sv-export-item-danger etc.). */
.sv-cond-removable:hover {
  background: color-mix(in srgb, var(--remove-fg) 14%, transparent);
  color: var(--remove-fg);
}
.sv-cond-removable:hover .sv-cond-x {
  opacity: 1;
  transform: scale(1);
  background: color-mix(in srgb, var(--remove-fg) 22%, transparent);
  color: var(--remove-fg);
}
.sv-cond-removable[data-busy="true"] { cursor: not-allowed; opacity: 0.6; }

.sv-header-stats { display: flex; gap: 20px; font-size: 12px; color: var(--fg-muted); font-variant-numeric: tabular-nums; }
.sv-header-stats b { color: var(--fg); font-weight: 600; }
.sv-header-stats .delta { color: var(--success); }

/* ── Action bar (scss:386-404) ── */
.sv-actions { display: flex; gap: 8px; align-items: center; }
.sv-action-btn {
  height: 32px; padding: 0 12px; border-radius: 99px; background: var(--chip-bg); border: 1px solid var(--chip-border);
  color: var(--fg-muted); font: inherit; font-size: 12.5px; display: inline-flex; align-items: center; gap: 5px; cursor: pointer;
}
.sv-action-btn:hover { background: var(--chip-bg-hi); color: var(--fg); }
.sv-action-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.sv-action-btn-icon { padding: 0 10px; min-width: 32px; justify-content: center; }
.sv-action-btn[data-open="true"] { box-shadow: 0 0 0 2px var(--accent-soft); }
/* Task 11 (c): the `.sv-action-btn-primary` pair that used to live here is gone. Task 7 folded
   this page's Export button into the unified "..." menu, and that button was the class's only
   consumer -- no element on this page carries it any more. The identical filled-accent variant
   still lives on PhotosMomentDetail.vue (:933-934), including its compound-selector hover and
   the cssCascade regression that guards it; look there for the reasoning that used to sit here. */

/* ── Task 7: sidebar top action row -- rule body restated from PhotosAlbumDetail.vue's own
   `.sv-side-actions` (Task 5; scoped styles do not cross SFCs in this repo). flex-wrap lets a
   narrow sidebar keep both buttons on their own line if needed. margin-bottom keeps the same
   24px rhythm as .sv-side-section below it. ── */
.sv-side-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 24px; }
.sv-more-wrap { position: relative; }

/* ── SP15-P2c Task 6: sort capsule, separators, density pair ──
   Rule bodies restated from PhotosAlbumDetail.vue's own (:1161-1176), which Task 3 in turn
   restated from Vue2 photos.scss (:3458-3475 .group / .order-pill, :285-288 .density) and
   photos-smartview.scss (.album-detail-actions-sep). Scoped styles do not cross SFCs in this
   repo, so this duplication is the phase's KEEP-THE-DUPLICATION ruling, not a missed
   extraction -- and it is what makes the two detail pages render the same row. */
.group { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--fg-muted); }
.sv-actions .order-pill {
  display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 999px;
  background: var(--chip-bg); border: 1px solid var(--chip-border); color: var(--fg-muted);
  font: inherit; font-size: 12px; cursor: pointer;
}
.sv-actions .order-pill:hover { background: var(--chip-bg-hi); color: var(--fg); }
.album-detail-actions-sep { width: 1px; height: 18px; background: var(--divider); flex-shrink: 0; }

.density { display: inline-flex; gap: 2px; background: var(--chip-bg); border-radius: 8px; padding: 3px; }
.density button {
  width: 28px; height: 24px; display: inline-flex; align-items: center; justify-content: center;
  border: 0; border-radius: 5px; background: transparent; color: var(--fg-muted); cursor: pointer;
}
.density button:hover { color: var(--fg); }
.density button[data-active="true"] { background: var(--chip-bg-hi); color: var(--fg); }

/* Sort popup. Vue2 photos.scss:3122-3153 (.albums-sort-menu / .albums-sort-item): a flex row
   per item so the check glyph and the label line up, and the active row carries --accent-soft.
   `.sv-sort-check` is the fixed-width slot the glyph sits in -- rendered as an empty span when
   the option is not the active one, which is how the target keeps every label at the same x
   (its own version writes `style="width:12px;display:inline-block"` inline). Vue2 tints the
   glyph with --accent-hi, a token this repo does not have (global convention: no --accent-hi);
   --accent-text is the pair this file's own .sv-export-icon already uses against --accent-soft. */
.sv-sort-wrap { position: relative; }
/* Task 11 (a): min-width is the target's 240px (photos.scss:3126), not the 180px written here first. */
.sv-sort-menu {
  position: absolute; top: calc(100% + 4px); right: 0; min-width: 240px; z-index: 20;
  background: var(--popup-bg); border: 1px solid var(--card-border); border-radius: 12px;
  padding: 4px; box-shadow: var(--card-shadow-hi);
}
.sv-sort-item {
  display: flex; width: 100%; align-items: center; gap: 8px; padding: 8px 10px;
  background: transparent; border: 0; border-radius: 8px; color: var(--fg);
  font: inherit; font-size: 12.5px; cursor: pointer; text-align: left;
}
.sv-sort-item:hover { background: var(--chip-bg-hi); }
.sv-sort-item[data-active="true"] { background: var(--accent-soft); }
.sv-sort-item .sv-sort-check { width: 12px; flex-shrink: 0; color: var(--accent-text); }
.sv-sort-item .lbl { display: block; font-weight: 500; }

/* ── Export / more menu (scss:407-452) ── */
.sv-export-menu {
  position: absolute; right: 0; top: calc(100% + 6px); min-width: 280px;
  background: var(--popup-bg); border: 1px solid var(--card-border); border-radius: 12px; padding: 6px;
  box-shadow: var(--card-shadow-hi); z-index: 50; display: flex; flex-direction: column; gap: 1px;
}
.sv-more-menu { min-width: 220px; }
.sv-export-item {
  display: flex; align-items: flex-start; gap: 10px; padding: 9px 10px; background: transparent; border: 0;
  border-radius: 8px; color: var(--fg); text-align: left; cursor: pointer; font: inherit; width: 100%;
}
.sv-export-item:hover { background: var(--chip-bg-hi); }
.sv-export-icon {
  width: 28px; height: 28px; border-radius: 7px; background: var(--accent-soft); color: var(--accent-text);
  display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 1px;
}
.sv-export-title { font-size: 12.5px; font-weight: 500; line-height: 1.2; }
.sv-export-desc { font-size: 11px; color: var(--fg-muted); margin-top: 3px; line-height: 1.35; }
.sv-export-sep { height: 1px; margin: 4px 6px; background: var(--divider); }
/* Vue2 :119-123's three inline coral-red literals → --remove-fg family. */
.sv-export-item-danger, .sv-export-item-danger .sv-export-title { color: var(--remove-fg); }
.sv-export-icon-danger { background: color-mix(in srgb, var(--remove-fg) 14%, transparent); color: var(--remove-fg); }
/* fix round 1: the compound selector (0,3,0) reliably beats the base class `.sv-export-item:hover`'s (0,2,0), not relying on source order. */
.sv-export-item.sv-export-item-danger:hover { background: color-mix(in srgb, var(--remove-fg) 14%, transparent); }

/* fix round 1 · I2: Vue2 :79/:102 each wrap a `<transition name="sv-menu">`, with the rule at
   scss:454-455 (opacity 0.14s + translateY(-4px) scale(0.97), a 140ms scale-fade-in).
   Vue3 uses `-enter-from`/`-leave-to` (not Vue2's `-enter`), matching this file's existing
   `.sv-toast-fade-*` convention. */
.sv-menu-enter-active, .sv-menu-leave-active { transition: opacity 0.14s ease, transform 0.16s cubic-bezier(0.2, 0.8, 0.2, 1); transform-origin: top right; }
.sv-menu-enter-from, .sv-menu-leave-to { opacity: 0; transform: translateY(-4px) scale(0.97); }

/* ── Two-band grid (scss:480-525) ── */
.sv-section-head { padding: 18px 32px 8px; display: flex; align-items: center; gap: 10px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--fg-muted); }
.sv-section-head .pill { padding: 1px 8px; border-radius: 99px; background: var(--chip-bg); color: var(--fg-muted); text-transform: none; letter-spacing: 0; font-weight: 500; }
.sv-grid-photos { padding: 0 32px; display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 6px; }
/* Vue2 :136's inline `padding-bottom:18px` is only added on the "Recently added" section's grid
   (the "All matches" section doesn't have it), giving that section breathing room from the
   "All matches" heading below it. The audit found the template already had this class but the
   style block was missing it -- filled in here; this class of missing-render bug is the most
   frequent defect in this project, caught by checking against the source line by line. */
.sv-grid-photos-recent { padding-bottom: 18px; }
/* SP15-P2c Task 6, compact density (Vue2 photos-smartview.scss:557-559): the only change is
   the auto-fill minimum, 180px down to 120px, so more thumbnails fit per row. Both grids on
   this page take the modifier; the excluded band deliberately does not, exactly as in the
   target. */
.sv-grid-photos.is-compact { grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); }
.sv-grid-photos .tile { position: relative; aspect-ratio: 1; cursor: pointer; border-radius: 4px; overflow: hidden; }
.sv-grid-photos .tile img { width: 100%; height: 100%; object-fit: cover; display: block; }
/* fix round 1 · I3: Vue2 scss:506-513 also layers a translucent dark inset shadow just inside
   the accent border, to push the accent ring into contrast on light-toned photos (on a very
   pale photo, a plain 2px accent border alone is too easily washed out by the background).
   `color-mix(in srgb, black 40%, transparent)` reproduces the same darkness without writing a
   literal hex/rgb function -- the `black` keyword paired with color-mix already has a precedent
   in this repo, `PhotosTrash.vue:405`. */
.sv-grid-photos .tile.recent::after {
  content: ""; position: absolute; inset: 0; border: 2px solid var(--accent); border-radius: inherit;
  pointer-events: none;
  box-shadow: inset 0 0 0 2px color-mix(in srgb, black 40%, transparent);
}
/* ── SP15-P2a: selection, pin badge, excluded band, selection bar ── */
/* Selected tile (Vue2 photos.scss:329-333, the global `.photos-root .tile[data-selected]`
   rule its grids inherit). The wash over the photo is Vue2's flat accent literal at 20%,
   restated as a mix of the accent token so it follows the theme. */
.sv-grid-photos .tile[data-selected="true"] { outline: 3px solid var(--accent); outline-offset: -3px; }
.sv-grid-photos .tile[data-selected="true"]::before {
  content: ""; position: absolute; inset: 0; z-index: 2;
  background: color-mix(in srgb, var(--accent) 20%, transparent);
}
/* Pin badge (scss:683-692). Background is --overlay-bg — the constant-dark-badge token
   PhotosTrash.vue's .trash-tile-countdown/.trash-tile-select already use for "fixed dark
   badge over an unpredictable photo" — instead of Vue2's literal half-opaque black. */
.sv-pin-tag {
  position: absolute; top: 6px; right: 6px; width: 18px; height: 18px; border-radius: 50%;
  background: var(--overlay-bg); backdrop-filter: blur(6px);
  display: inline-flex; align-items: center; justify-content: center; z-index: 3;
  color: #fff; /* theme-exception: badge glyph sits on unpredictable photo content inside a
    fixed dark badge — same reasoning as PhotosMomentDetail.vue's own .sv-pin-tag. */
}
/* Selection check (scss:693-701): left side, so it never collides with the pin badge on the
   right — Vue2's own placement rule. */
.sv-tile-check {
  position: absolute; top: 6px; left: 6px; width: 20px; height: 20px; border-radius: 50%;
  background: var(--accent); display: inline-flex; align-items: center; justify-content: center; z-index: 4;
  color: var(--on-accent); /* --on-accent's one legal use: icon sits on a solid --accent fill. */
}

/* Excluded band (scss:704-721): the tiles are dimmed and the Restore hint only surfaces on
   hover, which is what keeps a record of past decisions from reading as part of the view. */
.sv-excluded-head { cursor: pointer; user-select: none; }
.sv-excluded-head:hover { color: var(--fg); }
.sv-excluded-grid .tile { opacity: 0.7; transition: opacity 0.15s ease; }
.sv-excluded-grid .tile:hover { opacity: 1; }
.sv-excluded-grid .tile .sv-restore-hint {
  position: absolute; left: 0; right: 0; bottom: 0; padding: 4px 0; z-index: 3;
  text-align: center; font-size: 10.5px; font-weight: 600;
  color: #fff; /* theme-exception: label sits on unpredictable photo content inside a fixed
    dark strip — same reasoning as .sv-pin-tag above. */
  background: var(--overlay-bg); backdrop-filter: blur(4px);
  opacity: 0; transition: opacity 0.15s ease;
}
.sv-excluded-grid .tile:hover .sv-restore-hint { opacity: 1; }
/* Final review, finding 4 (deviation 6): while selecting, an excluded tile does nothing.
   The affordance has to say so too — otherwise the Restore hint still invites a click that
   is now deliberately ignored, which reads as the page being broken rather than as the tile
   being out of scope. Compound selector, so it beats the plain .tile:hover rule above
   without depending on source order. */
.sv-excluded-grid .tile[data-inert="true"] { cursor: default; }
.sv-excluded-grid .tile[data-inert="true"]:hover .sv-restore-hint { opacity: 0; }

/* Selection bar (scss:724-745): fixed pill, same idiom as this file's own .sv-toast
   (--popup-bg/--card-border/--card-shadow-hi/--blur). */
.sv-select-bar {
  position: fixed; left: 50%; transform: translateX(-50%); bottom: 24px; z-index: 150;
  display: flex; align-items: center; gap: 12px; padding: 10px 14px;
  background: var(--popup-bg); border: 1px solid var(--card-border); border-radius: 14px;
  box-shadow: var(--card-shadow-hi); backdrop-filter: var(--blur);
}
.sv-select-bar span { font-size: 13px; font-weight: 600; color: var(--fg); font-variant-numeric: tabular-nums; }

.sv-grid-photos .new-tag {
  position: absolute; top: 6px; left: 6px; padding: 2px 7px; border-radius: 99px; background: var(--accent);
  /* --on-accent's only legal scenario: the base colour is a fully saturated, solid var(--accent) fill. */
  color: var(--on-accent); font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;
}

/* fix round 1 · M2 (task-8 review: a debt T6 left on the books, this task actually introduces
   4 scrollable sections, so it's settled now): Vue2 scss:161-166 (sv-detail-layout) +
   :167-172 (sv-detail-main) + :187-194 (sv-detail-side base look). --line → --divider,
   --surface-1 → --panel-bg-solid (precedent PlaceDetailPanel.vue:38/312: the same kind of
   "permanent solid sidebar beside content" -- not --popup-bg, which is reserved for floating
   layers).
   **Decision: do NOT port Vue2 scss:195-209's `::-webkit-scrollbar` scrollbar styling (accent
   gradient thumb / 10px wide / accent 6% track); `.sv-detail-main`/`.sv-detail-side` both just
   use `overflow-y: auto` and leave it to the browser's default scrollbar.** Reasoning: this
   branch's convention is to only hide scrollbars (`scrollbar-width: none` / `display: none`),
   not to repaint them -- existing precedent at `PhotosGrid.vue:420`, `PhotoFilmstrip.vue`,
   `PhotosPersonDetail.vue:1041`; `theme.css` already has a global thin-scrollbar fallback; and
   SP5-P6 proved that once an element picks up the standard `scrollbar-width`/`scrollbar-color`
   on Chrome 121+, the browser disables the entire `::-webkit-scrollbar` customisation family on
   that element -- porting Vue2's version wholesale would just introduce dead code. */
.sv-detail-layout { display: grid; grid-template-columns: 1fr 320px; flex: 1 1 auto; min-height: 0; }
.sv-detail-main { min-width: 0; overflow-y: auto; padding-bottom: 60px; }
/* Background colour correction (real-device screenshot: the whole right rail rendered as a
   featureless dark slab over the glass shell). It originally followed T6's mapping,
   `--surface-1` → `--panel-bg-solid`, citing PlaceDetailPanel as precedent -- but that
   precedent is **functional**: it sits over PlacesMap's canvas, and translucency would let the
   map's grid dots show through (P6b real-device acceptance feedback). This rail has no map
   underneath, only the area shell, so an opaque solid fill only produces one effect here:
   "inconsistent with the area it sits in" -- the other permanent sidebars in the same area,
   PhotosSidebar:119 / PlacesRail:200 / PhotoInfoPanel:175 / PersonPlacesTab:188, are all
   `var(--panel-bg)`. Switched to the glass background to match them.
   `--panel-bg-solid`'s consumer allowlist is in views/__tests__/photosGlassSurfaces.test.ts. */
.sv-detail-side {
  border-left: 1px solid var(--divider); background: var(--panel-bg);
  overflow-y: auto; padding: 20px 18px 40px; min-height: 4px;
}

/* ── Export-result floating bar (scss:458-476) ── */
.sv-toast {
  position: fixed; bottom: 28px; left: 50%; transform: translateX(-50%);
  display: inline-flex; align-items: center; gap: 8px; padding: 10px 16px;
  background: var(--popup-bg); border: 1px solid var(--card-border); border-radius: 99px;
  color: var(--fg); font-size: 12.5px; box-shadow: var(--card-shadow-hi); backdrop-filter: var(--blur);
  z-index: 300;
}
.sv-toast-fade-enter-active, .sv-toast-fade-leave-active { transition: opacity 0.2s ease, transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1); }
.sv-toast-fade-enter-from, .sv-toast-fade-leave-to { opacity: 0; transform: translate(-50%, 8px); }

/* ── Delete confirmation (no dedicated block in scss; matches PhotoLightbox.vue's own
     .lb-confirm-* visual precedent, class names use sv-confirm-* instead to avoid confusion
     with the lightbox's same-named styles -- see the comment at the template site) ── */
.sv-confirm-scrim {
  position: fixed; inset: 0; z-index: 220; background: var(--overlay-bg); backdrop-filter: var(--overlay-blur);
  display: flex; align-items: center; justify-content: center; padding: 40px 20px;
}
.sv-confirm-panel {
  width: 380px; max-width: 100%; padding: 22px; border-radius: 16px;
  background: var(--popup-bg); border: 1px solid var(--card-border); box-shadow: var(--card-shadow-hi);
  color: var(--fg);
}
.sv-confirm-icon {
  width: 44px; height: 44px; border-radius: 50%; margin-bottom: 10px;
  background: color-mix(in srgb, var(--remove-fg) 14%, transparent); color: var(--remove-fg);
  display: flex; align-items: center; justify-content: center;
}
/* SP15-P2b final fix wave: the base disc is red because the only dialog that had one was the
   delete confirmation. Vue2 differentiates deliberately -- 939a7d3a:PhotosSmartViewDetail.vue
   :279 tints the delete dialog's trash glyph red, :298 tints the convert dialog's album glyph
   with var(--accent-hi) -- so a non-destructive action must not wear the delete colour. Reuses
   the --accent-soft/--accent-text pair the .sv-export-icon discs on this same page already use. */
.sv-confirm-icon.accent { background: var(--accent-soft); color: var(--accent-text); }
.sv-confirm-title { font-size: 16px; font-weight: 600; }
.sv-confirm-body { margin-top: 8px; font-size: 13px; color: var(--fg-muted); line-height: 1.5; }
/* SP15-P2b Task 8: inline failure message next to the convert confirmation's submit button
   (not a toast -- it answers the button just pressed, same reasoning as
   AlbumConvertToSmartDialog.vue's own .convert-error). */
.sv-confirm-error { margin-top: 8px; font-size: 12px; color: var(--remove-fg); line-height: 1.4; }
.sv-confirm-foot { margin-top: 20px; display: flex; justify-content: flex-end; gap: 10px; }
.sv-confirm-cancel, .sv-confirm-ok {
  padding: 8px 16px; border-radius: 8px; border: 1px solid var(--card-border); background: transparent;
  color: var(--fg); font: inherit; font-size: 13px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;
}
/* :not(:disabled) for the same reason as the .primary hover below -- Cancel is disabled while
   the conversion is in flight and must not light up under the cursor then. */
.sv-confirm-cancel:hover:not(:disabled) { background: var(--chip-bg-hi); }
.sv-confirm-ok.danger {
  border-color: color-mix(in srgb, var(--remove-fg) 45%, transparent);
  color: var(--remove-fg); background: color-mix(in srgb, var(--remove-fg) 10%, transparent);
}
.sv-confirm-ok.danger:hover { background: color-mix(in srgb, var(--remove-fg) 22%, transparent); }
/* SP15-P2b final fix wave: filled primary CTA for a non-destructive confirmation, standing in
   for Vue2's `trash-btn-cta` (939a7d3a:photos.scss:2203-2213 -- filled accent gradient, light
   text, weight 600; the gradient's literals are replaced by the --accent token per this repo's
   colour rule). Without a modifier this button inherited the base ghost look and was
   indistinguishable from the Cancel next to it. The hover mirrors the filled-accent variant on
   PhotosMomentDetail.vue:934. Both selectors below are two-class compounds (0,2,0), so they outrank the
   shared `.sv-confirm-cancel, .sv-confirm-ok` base (0,1,0) structurally, not by source order. */
.sv-confirm-ok.primary { background: var(--accent); color: var(--on-accent); border: 0; font-weight: 600; }
/* :not(:disabled) rather than a later :disabled override -- CSS applies :hover to disabled
   buttons too, and the mid-flight state must not brighten under the cursor. */
.sv-confirm-ok.primary:hover:not(:disabled) { filter: brightness(1.08); }
/* Both buttons are disabled while the conversion is in flight (the delete dialog above never
   disables either), so this pair only ever shows up on the convert confirmation. */
.sv-confirm-cancel:disabled, .sv-confirm-ok:disabled { opacity: 0.6; cursor: not-allowed; }
/* fix round 1 · I2: Vue2 :239 wraps a `<transition name="lb-confirm">`, with the rule at
   photos.scss:702-707 (opacity + scale(0.95), 200ms). Class names don't reuse `lb-confirm`
   (same naming rationale as the scrim/panel above, to avoid confusion with
   PhotoLightbox.vue's existing same-named transition). */
.sv-confirm-enter-active, .sv-confirm-leave-active { transition: opacity 0.2s, transform 0.2s; }
.sv-confirm-enter-from, .sv-confirm-leave-to { opacity: 0; transform: scale(0.95); }

/* ≤768px: the sidebar is already tucked into a drawer, layout is single-column (this area's
   established shape); the detail page's own two columns (content/right rail) likewise
   collapse to a single column, with the right rail falling below the content. */
@media (max-width: 768px) {
  .photos-layout { gap: 0; }
  .sv-detail-layout { grid-template-columns: 1fr; }
  .sv-detail-side { border-left: 0; border-top: 1px solid var(--divider); }
}
</style>
