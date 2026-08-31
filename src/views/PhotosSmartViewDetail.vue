<script setup lang="ts">
// PhotosSmartViewDetail.vue -- smart view detail page shell (route /photos/smart-views/:id).
// This cycle's key architectural task: prove that §7e-2's core fix (the store's byId(id)) holds.
//
// *** The most important architectural difference from Vue2 -- read this fully to understand why this file is so short ***
// The Vue2 detail page (src/views/Photos/PhotosSmartViewDetail.vue) holds the entire sv object as
// a **prop** (:285 `props: { sv: { type: Object, required: true } }`), while the list side's
// UPDATE_SMART_VIEW mutation swaps in a **new object** via `splice(i, 1, {...})` -- meaning that
// after an edit/pause/rename, the Vue2 detail page's prop reference has already gone stale, and
// the UI shows no change until the user reopens the detail page.
// To paper over this real bug, Vue2 built an entire local-state sync mechanism: local `thresh`/
// `paused`/`includeVideos` state + a `syncingSv` flag + three watchers (:288-291, :345-371) --
// when the `sv` prop changes, the new value is copied into local state, while `syncingSv` blocks
// that same copy from re-triggering the local watchers and firing another PATCH request in an
// infinite loop.
//
// New-UI goes through real routing: `sv = computed(() => store.byId(String(route.params.id)))`,
// re-reading from the store array on every render, with a single source of data. **This bug
// structurally disappears** -- once the store updates an array entry, anywhere that reads
// `sv.value` (including this computed itself) immediately gets the new object, with no need for
// any local state copy, no `syncingSv`, and no three watchers. `paused` is simply a **derived
// value** via `computed(() => !sv.value?.live)`, not local state -- this is exactly the behaviour
// this task's test suite's "§7e-2 main guard" case pins down (mutate `sv.live` directly on the
// store, without remounting, and the pill copy follows automatically; deletion-check ① -- swapping
// byId for a local ref caching a copy of the sv object -- turns this case red).
//
// This file's scope (structural spec 1-9): the shell + header (title editing / live-paused pill /
// four stat tiles) + the action row's three menus (pause/resume / refine in search [wired up as of
// T16, see refineInSearch] / export [ZIP fixes 401 + static album] / more [rename/duplicate/
// delete]) + the delete confirmation dialog + the two-section photo grid (recently added / all
// matches).
// T7 (add-condition popover) and T8 (right-column threshold/settings/stats/activity feed) only get
// mount points here -- see the TODO comment below.
//
// -- Registered deviations (deliberate, documented here) ---------------------------------------
//  1) The "not found" empty state (listLoaded && !sv): this path does not exist in Vue2 -- its
//     detail page only renders when the parent component's `v-if="openSv"` is true, and `openSv`
//     is always a real object, so "has an id but the lookup misses" can never happen there.
//     New-UI uses real routing, so a user editing the address bar / opening a stale bookmark can
//     land here -- new to New-UI.
//  2) The live/paused pill: Vue2 only has `role="button"`, with no keyboard accessibility. Added
//     `tabindex="0"` + `@keydown.enter` here.
//  3) A commitTitle failure: Vue2 `:512-513` has no catch (optimistically assuming the PATCH
//     always succeeds). Here it's caught -> toast + stays in edit mode (does not silently exit,
//     so the user does not think the rename took effect).
//  4) "Refine in search" was temporarily disabled during the T6 stage (the /photos/search route
//     did not exist yet). T16 has since built the search route and wired it up (see refineInSearch
//     below), and the button is no longer disabled.
//  5) The dead `smartViewId` parameter is not ported over: Vue2's `:520` refineInSearch payload is
//     `{ q: sv.name, smartViewId: sv.id }`, but grepping the entire Vue2 repo for `smartViewId`
//     turns up only this one write, with zero consumers (`grep -rn smartViewId` hits only this one
//     line across all of Vue2). T16's wiring passes only `q`, without this dead parameter.
//  6) An excluded tile is inert while selecting.
//     Vue 2 :167 wires `restoreOne` onto the excluded tiles unconditionally, so in
//     selection mode every tile on the page toggles a checkmark except an excluded one,
//     which silently writes to the server instead. The user taps expecting selection and
//     gets an unconfirmed restore with no toast and no undo. Excluded assets are not
//     removal candidates — the only thing selection leads to here is "remove from view",
//     which they are already out of — so they are neither selectable nor restorable while
//     selecting: the click is a no-op. This is one of Vue 2's own defects being fixed and
//     registered rather than copied, per this branch's porting rule.
//
// Common shell swap: the shell went from AreaShell + `.photos-layout` flex-row to Photos.vue's
// Vue2 structure `.photos-root[themeClass] > .app[data-collapsed] > PhotosSidebar + main.main`
// -- `collapsed` now uses the shared composable useSidebarCollapse(). The inner scroll chain was
// already complete (`.sv-detail-main`/`.sv-detail-side`, each its own grid cell with its own
// overflow-y:auto), so the shell swap does not affect scroll behaviour. Known remaining gap (same
// shell-swap note as PhotosAlbums.vue's, not repeated page by page): on narrow mobile widths there
// is no AreaShell hamburger entry point to open the sidebar drawer; deliberate decision:
// filling this in was out of this task's scope.
import '../photos/styles/vue2-parity'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { service } from '@nimotech/nimoos-service'
import { usePhotosTheme } from '../photos/composables/usePhotosTheme'
import { useSidebarCollapse } from '../photos/composables/useSidebarCollapse'
import PhotosSidebar from '../photos/components/PhotosSidebar.vue'
import PhotosTopbar from '../photos/components/PhotosTopbar.vue'
import PhotosToastHost from '../photos/components/PhotosToastHost.vue'
import AskNimoHost from '../photos/components/asknimo/AskNimoHost.vue'
import { usePhotosToast } from '../photos/composables/usePhotosToast'
import SmartViewSidePanel from '../photos/components/SmartViewSidePanel.vue'
import SmartViewActivityFeed from '../photos/components/SmartViewActivityFeed.vue'
import PhotosLibraryPicker from '../photos/components/PhotosLibraryPicker.vue'
import AlbumPickerDialog from '../photos/components/AlbumPickerDialog.vue'
import PhotoLightbox from '../photos/lightbox/PhotoLightbox.vue'
import { usePhotosSmartViews, type DeletedSmartView } from '../photos/stores/smartViews'
import { usePhotosAlbums } from '../photos/stores/albums'
import { useTimelineStore } from '../photos/stores/timeline'
import { useToast } from '../stores/toast'
import { isConflict } from '../photos/util/httpErrors'
import { useLightbox } from '../photos/lightbox/useLightbox'
import { relTime } from '../photos/util/relTime'
// Reused, not re-implemented. Despite the name this is a plain photo
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
const timeline = useTimelineStore()
const toast = useToast()
// Vue2's duplicate-smart-view and convert-to-album
// confirmations go through `window.PhotosToast` (photosToast.js), the photos-private
// bottom-pill toast -- not the app-wide generic toast used everywhere else on this page.
// `duplicateSv()`/`doConvertToAlbum()` below used the generic `toast` (useToast()) for these
// two flows, which is why the owner no longer saw "the bottom toast confirmation" they
// remembered from Vue2. Scoped narrowly to these two flows (the ones the owner named) -- this
// page's other ~15 `toast.show(...)` calls also use the generic store and are NOT touched here;
// registered as a separate, larger pre-existing gap in the report rather than silently expanded.
const photosToast = usePhotosToast()
const lb = useLightbox()
const { t, locale } = useI18n()
const { themeClass } = usePhotosTheme()
// `toggle` wires the topbar's collapse button
// (same as Photos.vue/PhotosAlbums.vue).
const { collapsed, toggle: onToggleCollapse } = useSidebarCollapse()

// The single normalization point (hard rule: always compare ids via String()).
const svId = computed(() => String(route.params.id))

// PhotosTopbar's title/sub. This is the SMART ALBUM detail (saved search /
// conds+threshold+live) -- Vue2 nests it inside PhotosAlbumsView, under activeNav==='albums',
// the exact same nesting as the manual-album detail a few lines above it in that file
// (the Vue 2 panel's PhotosAlbumsView.vue:3-45). So the topbar here is identical to
// PhotosAlbums.vue/PhotosAlbumDetail.vue's own: title='Albums', sub=the aggregate across
// every album (manual AND smart alike are irrelevant to which nav is active; the aggregate
// itself only sums manual albums, matching Vue2's topbarSubContext exactly).
const topbarTitle = computed(() => t('photosAlbumsTitle'))
const topbarSub = computed(() => {
  const totalPhotos = albums.albums.reduce((sum, a) => sum + (Number((a as Record<string, unknown>).photoCount) || 0), 0)
  const totalVideos = albums.albums.reduce((sum, a) => sum + (Number((a as Record<string, unknown>).videoCount) || 0), 0)
  return t('photosCountSummary', { photos: totalPhotos.toLocaleString(), videos: totalVideos.toLocaleString() })
})
// * §7e-2 core fix: re-read from the store array on every render, never hold an object reference.
const sv = computed(() => store.byId(svId.value))

function fmtNum(n: number): string {
  return n.toLocaleString(locale.value.replace('_', '-'))
}

// Wrapped in a ref rather than calling Date.now() bare in the template: a test can pin this
// value before mounting with vi.useFakeTimers()/setSystemTime, while the component code itself
// still reads as the normal "just use the current time" pattern (this is not a workflow script,
// so using Date.now() directly here is fine).
const now = ref(Date.now())
const lastUpdated = computed(() => (sv.value?.evaluatedAt ? relTime(sv.value.evaluatedAt, now.value, t, locale.value) : '—'))

// ── Loading (structural spec 1) ────────────────────────────────────────────────────
onMounted(async () => {
  if (!store.listLoaded) await store.fetchSmartViews()
  await store.loadDetail(svId.value)
  void store.loadExcluded(svId.value)
  // The topbar's album-aggregate sub needs the full album list, which this page
  // otherwise never fetches (unlike PhotosAlbumDetail.vue, which already does for its own
  // reasons) -- same guarded fetch-once shape as that sibling page.
  if (!albums.albumsLoaded) void albums.fetchAlbums()
})
watch(() => route.params.id, (raw) => {
  if (raw === undefined) return // Already left this route (same existing precedent as PhotosPersonDetail.vue)
  // Everything the manual actions hold is keyed to the id we are leaving, so it all
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

// ── Title editing (structural spec 3, 8) ───────────────────────────────────────────────
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
  // Unchanged or cleared -> exit directly without sending a request (matches Vue2 :511's
  // `if (v && v !== this.sv.name)`).
  if (!v || v === s.name) {
    titleEdit.value = false
    return
  }
  try {
    await store.updateSmartView(s.id, { name: v })
    toast.show(t('photosSvSmartViewRenamed'))
    // Exiting edit mode is left to the watch(sv.name) below: on success the store writes back
    // the new name -> sv.value.name changes -> the watch fires -> titleEdit = false. On failure
    // name is unchanged, the watch does not fire, and titleEdit stays true (registered
    // deviation 3: Vue2 has no catch here -- on failure this must stay in edit mode rather than
    // silently exiting and letting the user think the rename took effect).
  } catch (e) {
    console.error('[photos-smartviews] commitTitle', e)
    toast.show(t('photosSvRenameFailed'))
  }
}
// Deletion-check ②: remove this watch and the "exits edit mode on success" case goes red (the
// name changes, but titleEdit is never set back to false here; the "unchanged" branch is
// unaffected, since that path already exits synchronously inside commitTitle without relying on
// this watch).
watch(() => sv.value?.name, () => {
  if (titleEdit.value) titleEdit.value = false
})

// ── paused: a derived value, not local state (structural spec 8, §7e-2's biggest simplification) ───────────────
const paused = computed(() => !sv.value?.live)
async function togglePaused(): Promise<void> {
  const s = sv.value
  if (!s) return
  const nextLive = paused.value // paused===true <=> currently !live, so toggling is just negating paused itself
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

// T16 delivered (structural spec 23): "Refine in search" -> jumps to the search page, using this
// smart view's name as the query term.
// Only `q` is passed -- Vue2 :520's smartViewId is a dead parameter with zero consumers across
// the whole repo (see registered deviation 5 in the file header).
function refineInSearch(): void {
  const s = sv.value
  if (!s) return
  void router.push({ path: '/photos/search', query: { q: s.name } })
}

// ── T7 wiring (structure spec T7) ────────────────────
// Ported from the Vue 2 panel's PhotosSmartViewDetail.vue:26-30 +
// :700-710 ("user-added requirement" -- a deliberate product decision, not an oversight): the
// "Add condition" entry (button + popover) is deleted along with the four Vue2 methods
// that only served it, and this repo's equivalents inside the now-deleted, formerly
// separate condition-editor component. The function that translated the editor's "add" emit into a store call went
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

// ── header's four stat tiles (structural spec 3) ──────────────────────────────────────────────
const newCount = computed(() => sv.value?.addedThisWeek || 0)
const median = computed(() => sv.value?.median || 0)
const storageText = computed(() => formatMB(sv.value?.storageBytes || 0))

// ── sort capsule + density pair (target :49-90) ─────────────────────────
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
// Smart album -> regular album, the reverse of the AlbumConvertToSmartDialog flow. Inline in
// this file rather than a new component (Vue2 inlines its lb-confirm-* version too, and this
// page already owns a confirmation of the same shape for delete).
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
  // The sort menu closes on an outside click the same way (Vue2 :545-548
  // adds its own click-outside for exactly this popup).
  if (sortMenuOpen.value) {
    const s = sortMenuRef.value
    if (s && !s.contains(target)) sortMenuOpen.value = false
  }
}

// Hard constraint: when multiple overlays are open, one Escape must close them all -- four
// independent ifs (five before Task 7 removed the export menu's own), no early return
// (deletion-check 8: adding `return` inside the first if turns that test red). The
// convertToAlbumOpen branch routes through closeConvertToAlbum() rather than setting the flag
// directly, or Escape could dismiss the dialog mid-flight while the Cancel button's own guard
// refuses to (closeConvertToAlbum defined below).
function onDocumentKeydown(e: KeyboardEvent): void {
  if (e.key !== 'Escape') return
  if (moreOpen.value) moreOpen.value = false
  if (confirmDeleteOpen.value) confirmDeleteOpen.value = false
  if (convertToAlbumOpen.value) closeConvertToAlbum()
  // Vue2 gives the sort popup a click-outside but no Escape; PhotosAlbumDetail
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

// ── Export (structural spec 5, 6) ──────────────────────────────────────────────────────
interface ExportToast { icon: 'download' | 'plus'; text: string }
const exportToast = ref<ExportToast | null>(null)
let toastTimer: ReturnType<typeof setTimeout> | null = null
function showExportToast(icon: ExportToast['icon'], text: string): void {
  exportToast.value = { icon, text }
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { exportToast.value = null }, 2800) // copied verbatim from Vue2 :499
}

// exportSmartViewUrl's /v1/photos/smart-views/:id/export is not on the backend's mediaGetSkip
// exemption list (only the /favorites/export suffix is exempted), and Photos' JWT middleware
// only reads the token from the Authorization header -- there is no query-string path -- so
// Vue2's window.location.href navigation is guaranteed to 401 (plan Global Constraints §7e-1,
// verified against the source, NimoOS-Photos/route/router.go).
// Switched here to a fetch with an Authorization header + blob download instead.
async function downloadZip(): Promise<void> {
  const s = sv.value
  // Task 7: this used to close the export menu (`exportOpen`); ZIP is now the unified menu's
  // third entry, so it closes that one instead.
  moreOpen.value = false
  if (!s) return
  try {
    const url = service.photos.exportSmartViewUrl(String(s.id), 'zip')
    // Do NOT add a 'Bearer ' prefix -- this repo stores a bare token: the shared package's
    // interceptor does `cfg.headers.Authorization = token` (shared service package
    // src/http.ts:59-60), and the token comes from `localStorage.getItem('access_token')`
    // (main.ts:24's getToken callback) -- a repo-wide grep finds no 'Bearer' literal anywhere.
    // The backend's `strings.TrimPrefix(auth, "Bearer ")` is a no-op on a bare token, so either
    // form would pass, but this keeps the same convention as the shared package
    // (deletion-check ⑤'s main point).
    // This endpoint (`route/v1/smartviews.go:34`) only registers `g.POST(...)` -- a repo-wide
    // grep for `"/smart-views/:id/export"` finds only this one route, no GET version --
    // verified against the source. `fetch`'s default GET would be rejected by Echo as 405 (not
    // 401, but equally 100% broken). `method: 'POST'` must be explicit. No body is needed --
    // the handler (`smartviews.go:208-215`) reads `format` from the query string, and
    // `exportSmartViewUrl` has already appended `?format=zip` to the URL.
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
    URL.revokeObjectURL(href) // deletion-check ⑥'s main point
    showExportToast('download', t('photosSvPreparingZipNPhotos', { n: fmtNum(s.count) }))
  } catch (e) {
    console.error('[photos-smartviews] downloadZip', e)
    showExportToast('download', t('photosFavExportFailed'))
  }
}

// Task 7: `exportAlbumAction` ("Save as static album" / sv-export-album) is deleted, not
// re-homed into the unified menu. This is an empirically-verified capability removal, not a
// guess: the Vue2 target's own final state (933a7d3a comment restated at 33b05636
// :184-189) records that Vue2 killed the identical button ("the Save as static Album entry is
// deleted entirely") in the same commit range
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
    // Smart albums now live inside Albums, so a deleted
    // smart view's owner list is the Albums page, not this now-Moments-only route.
    void router.push('/photos/albums')
    // The undo label reuses P3 Trash's existing established "Undo" key (grepping this repo's
    // zh_cn.ts confirms photosTrashUndo = '撤销' and photosPersonUndo shares the same value --
    // the former is used, since both are the generic "undo" copy and no new key is needed).
    // duration 5000 follows P5's existing "5 seconds to undo" convention.
    toast.show(t('photosSvSmartViewNameDeleted', { name: s.name }), 5000, {
      label: t('photosTrashUndo'),
      // The undo callback used to be `void store.restoreSmartView(...)`, which swallowed a
      // failed reject straight into an unhandled promise rejection -- the store's
      // restoreSmartView throws on failure (smartViews.ts :303-304's catch only
      // console.error's before re-throwing), and a `void` call does not catch that throw, so
      // the UI shows no feedback at all. The real sequence: the user clicks delete -> the
      // `router.push` above already sent them back to the list page (this smart view has
      // already been spliced out of the list) -> they click undo within 5 seconds -> the
      // backend call fails -> under the original implementation the UI shows nothing at all,
      // and this smart view is permanently gone from the list (it is actually still on the
      // backend -- it would reappear on a page refresh). This violated Global Constraints'
      // "an action thrown upward stays thrown (view layer catches -> toast)" -- doDelete itself
      // in this same file is try/catch + a failure toast; only this undo callback missed that
      // layer.
      // Copy reuse: a repo-wide grep confirms there is no dedicated "undo smart view failed"
      // key; `photosTrashRestoreFailed` (P3 Trash, PhotosTrash.vue:121/171's own "undo restore
      // failed" scenario, same 4500 duration) is semantically an exact match for "this
      // restore/undo action failed", so it is reused rather than adding a new key.
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
    // Was `toast.show(...)` (generic) -- Vue2's real call
    // here is `window.PhotosToast.show({ icon: 'sparkles', title: ... })`, same as
    // PhotosAlbumDetail.vue's `duplicateAlbum()`. See PhotosToastHost.vue's ICON_PATHS.
    photosToast.show({ text: t('photosSvDuplicatedNameOpenCopy', { name: s.name }), icon: 'sparkles' })
  } catch (e) {
    console.error('[photos-smartviews] duplicateSv', e)
    // Same switch as the success path -- Vue2's failure call is
    // `window.PhotosToast.show({ icon: 'trash', accent: '#FF6B5C', title: ... })`.
    photosToast.show({ text: t('photosSvDuplicateFailed'), icon: 'trash' })
  }
}

// (Vue2 939a7d3a diff's askConvertToAlbum/closeConvertToAlbum/
// doConvertToAlbum): the reverse of the convertFromAlbum flow. Freezes the current matches
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
    // Was `toast.show(...)` (generic) -- Vue2's real call
    // here is `window.PhotosToast.show({ icon: 'album', title: 'Converted to regular album' })`.
    // The failure path just below is unaffected -- it is already an inline message by deliberate
    // design (see its own comment), not a toast, so there is no Vue2 toast to restore there.
    photosToast.show({ text: t('photosSvConvertedToAlbum'), icon: 'album' })
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

// ── Two-section photo grid (structural spec 10) ─────────────────────────────────────────────
// The lightbox's browsing range is scoped to this smart view's full match set (not the whole
// library). Both grids share this one handler, but (target 33b05636 :96/:107
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
  // Mutates that element's property in place inside recentAssets (not replacing the array or
  // creating a new object): an optimistic in-place clear that hides the "New" badge early --
  // the actual view record lands asynchronously on the backend via something like lb.openAt's
  // own internal recordView action; this is just immediate feedback, and the comment is here
  // deliberately to flag that mutating a store ref's element property directly is intentional.
  if (r && r.isNew) r.isNew = false
  // The third arg is startMs (only meaningful for isVideo), not an index -- openAt computes the
  // index itself from the photo's position in `list` (useLightbox.ts's photoIndexById), so this
  // stays 0 unchanged from before this task.
  lb.openAt(p, list, 0)
}

// ── This page always called `lb.openAt` (above), but
// never mounted a `<PhotoLightbox>` of its own -- `useLightbox` is a module-level singleton, so
// the state flipped open (its network calls fired) with nothing on THIS page's own tree to
// render it; the previous page's own mounted lightbox (if any) would pick up the stale `open`
// state the next time it re-rendered, which is why the photo appeared only after
// navigating back. Vue2's own SmartViewDetail component doesn't own a lightbox instance either
// (it `$emit('open-photo', p, list)`s up to its single-page parent, which owns the one shared
// lightbox and all its wiring) -- New-UI's per-route architecture has no such parent to hoist
// to, so this page (like PhotosAlbumDetail.vue, the pattern reference) now owns its own
// `<PhotoLightbox>` instance and wires it directly.
//
// Delete: mirrors PhotosAlbumDetail.vue's `onLightboxDelete` exactly -- the lightbox deletes the
// underlying ASSET from the library entirely (`timeline.deleteAssets`), not merely "unpin from
// this view", so this refreshes this page's own matched/excluded lists afterward the same way
// removeSelected() already does, plus the shared 4000ms toast copy every other page's delete
// path already uses.
async function onLightboxDelete(assetId: string | number): Promise<void> {
  const n = await timeline.deleteAssets([String(assetId)])
  toast.show(t('photosDeletedToast', { count: n }), 4000)
  const id = svId.value
  await Promise.all([store.loadDetail(id), store.loadExcluded(id)])
}

// Add-to-album: same shape as PhotosAlbumDetail.vue's own `openAlbumPicker`/
// `onAlbumPickerAdded` -- adds to a DIFFERENT album than the one being viewed, so there is
// nothing of this page's own state to refresh once it lands.
const albumPickerOpen = ref(false)
const albumPickerIds = ref<Array<string | number>>([])
function openAlbumPicker(ids: Array<string | number>): void {
  albumPickerIds.value = ids
  albumPickerOpen.value = true
}
function onAlbumPickerAdded(): void {}

// ── Manual asset actions (Vue2 :456-534) ───────────────────────────────────────
// A smart view's membership is generated from its conditions; these four actions are the
// annotations layered on top of it — pin a photo the conditions missed, remove one (which
// either unpins it or flags it excluded), and put an excluded one back.
const pickerOpen = ref(false)
// A deliberate state decision. The earlier `selecting` flag is REUSED
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
    // (final review, finding 5: this used to toast "0 pinned to this view" and close).
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
  <div class="photos-root" :class="themeClass">
    <div class="app" :data-collapsed="collapsed">
      <!-- Same narrow-mode coordination as
           Photos.vue/PhotosAlbums.vue. -->
      <PhotosSidebar :collapsed="collapsed" hide-drawer-trigger />
      <main class="main">
        <PhotosTopbar
          :collapsed="collapsed"
          :title="topbarTitle"
          :sub="topbarSub"
          :show-search="false"
          @toggle-collapse="onToggleCollapse"
        />
       <div class="photos-main">
        <!-- Gate 1: the list hasn't finished loading yet -> skeleton (New-UI addition, Vue2 has no such concept) -->
        <div v-if="!store.listLoaded" class="sv-skeleton" data-test="sv-skeleton">
          <div class="sv-skel-bar" />
          <div class="sv-skel-header" />
          <div class="sv-skel-grid">
            <div v-for="i in 12" :key="i" class="sv-skel-tile" />
          </div>
        </div>

        <!-- Gate 2: the list finished loading, but byId finds nothing (registered deviation 1: a New-UI-only path) -->
        <div v-else-if="!sv" class="sv-not-found" data-test="sv-not-found">
          <div class="sv-not-found-title">{{ t('photosSvNotFound') }}</div>
          <button
            type="button" class="sv-not-found-back" data-test="sv-not-found-back"
            @click="router.push('/photos/albums')"
          >{{ t('photosAlbumBack') }}</button>
        </div>

        <!-- Gate 3: normal content -->
        <template v-else>
          <div class="sv-detail-bar">
            <!-- A registered departure from Vue 2. 939a7d3a:PhotosSmartViewDetail.vue:5 still
                 labels this button "All Smart Views" even though #112 made its @back return to
                 the Albums list -- Vue 2 shipped a button whose label lies about where it goes.
                 A misleading label is a user-visible defect rather than a styling choice, so
                 this port keeps Vue 2's destination and fixes the label, reusing the album
                 detail page's existing photosAlbumBack (PhotosAlbumDetail.vue:433) rather than
                 adding a key. photosSvAllSmartViews is deleted in the same commit. -->
            <button
              type="button" class="back" data-test="sv-detail-back"
              @click="router.push('/photos/albums')"
            >
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
              {{ t('photosAlbumBack') }}
            </button>
            <div style="flex:1" />
            <span class="sv-last-updated">{{ t('photosSvLastUpdatedTime', { time: lastUpdated }) }}</span>
          </div>

          <!-- Vue2 :10-11's two-layer container (sv-detail-layout grid 1fr/320px +
               sv-detail-main) was missing from the first version -- `.sv-detail-side` had
               invented its own empty-shell margin sitting below the grid instead, so the
               moment T8 filled it with content, that content would appear below the grid
               rather than in the right column -- a foreseeable structural rework. Built in
               here; the aside's inside is still T8's empty mount point, not implemented ahead
               of time. -->
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

              <!-- "Add condition" button + popover deleted here (ported from
                   the Vue 2 panel's PhotosSmartViewDetail.vue:26-30, "user-added requirement") --
                   only the removable chips survive. This used to mount a dedicated
                   condition-editor component; once `add` was gone it was down to a
                   bare v-for with no local state, so it folded back in here. -->
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

            <!-- (target :49-90). The row reads: Sort label -> capsule ->
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
                  <div v-if="sortMenuOpen" class="albums-sort-menu" data-test="sv-sort-menu">
                    <!-- Target :57-68 marks the active option with a check glyph and holds the
                         labels in line with a same-width spacer when there is none. -->
                    <button
                      v-for="s in sortOptions" :key="s.id"
                      type="button" class="albums-sort-item" data-test="sv-sort-item"
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
               for. -->
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
                <!-- (Vue2 :146-147): pin badge on the right, selection check on the
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
               the Sort capsule currently asks for. -->
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

          <!-- The "Excluded" section (Vue2 :161-172): the whole block only appears when there
               are excluded items, and is collapsed by default -- it is a record of a past
               decision, not this view's actual content. Clicking a tile restores it, with no
               second confirmation. -->
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

          <!-- T8 delivered: right column (threshold slider / settings toggles / four stat tiles / match distribution) + activity feed. -->
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
                <!-- The magnifying-glass handle used to be
                     `M21 21l-4.3-4.3` here -- a repo-wide outlier; the other 4 occurrences
                     (PhotosTopbar.vue/PhotosSearch.vue/PlaceCoverPicker.vue ×2 --
                     the original list's PhotosSearchBar.vue has since been retired,
                     its occurrence is now PhotosTopbar.vue's own `.search` icon, the count stays
                     4) all use `m20 20-3.5-3.5` (the circle params cx=11 cy=11 r=7 were already
                     identical across all four, only the handle length differed). Clicking
                     "Refine within search" from this detail page into the search page used to
                     make the magnifying-glass handle length jump between the two screens --
                     unified to the same value. -->
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
                  <!-- (Vue2 939a7d3a diff): grouped with rename/duplicate/zip
                       above the destructive separator, not beside Delete -- this is not a
                       destructive action, it freezes the current matches into a regular
                       album. -->
                  <button type="button" class="sv-export-item" data-test="sv-more-convert" @click="askConvertToAlbum">
                    <div class="sv-export-icon"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="18" height="14" rx="2" /><path d="M12 11v6M9 14h6" /><path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2" /></svg></div>
                    <div>
                      <!-- The target shortened both this title and Delete's
                           below specifically so the two "matching" detail pages' menus read the
                           same (33b05636 :143-147's own comment on the change). This entry used
                           `photosSvConvertToAlbum` ("Convert to regular album"), the long form
                           written before this page had a sibling to match against -- the album
                           page's own Convert entry already reuses `photosAlbumMenuConvert`
                           ("Convert", the target's exact short copy), so this switches to the same
                           key rather than coining a new SV-specific one. The confirm dialog's
                           own submit button (further down this file) still reads
                           `photosSvConvertToAlbum` unchanged -- that button predates this fix,
                           is not one of the two rows the reviewer flagged, and the target itself
                           gives it the same short "Convert" copy too, so revisiting it is a
                           separate, larger cleanup outside this fix's scope. -->
                      <div class="sv-export-title">{{ t('photosAlbumMenuConvert') }}</div>
                      <!-- Desc intentionally NOT realigned to the target's shorter
                           "stop auto-updating, freeze the current photos": `photosSvConvertToAlbumHint`
                           ("stop auto-updating, freeze the currently matched photos") is
                           semantically identical and was a deliberate registration made earlier
                           (this page's Convert entry existed before this fix). Only the two
                           titles were shortened in the target's own commit for cross-page parity;
                           the descs were left alone there too (the note below on Vue2 :119-123's
                           three inline coral-red literals shows Vue2 continuing to carry its own
                           full desc copy unchanged). Realigning this desc now would be scope
                           creep onto a different task's registered decision for a wording
                           difference with no user-visible parity gap -- recorded here rather than
                           changed. -->
                      <div class="sv-export-desc">{{ t('photosSvConvertToAlbumHint') }}</div>
                    </div>
                  </button>
                  <div class="sv-export-sep" />
                  <!-- All three of Vue2 :119-123's inline coral-red literals switched to the --remove-fg family (see the style block). -->
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
       </div>
      </main>
    </div>

  <!-- Same lesson class as elsewhere: this whole tail section
       (export toast / edit-mode select bar / library picker / delete-confirm dialog /
       convert-to-album dialog) used to be a template-root SIBLING of `.photos-root` (a Vue 3
       multi-root fragment) rather than its DOM descendant. Every one of these elements' actual
       visual styling comes from parity selectors written as `.photos-root .sv-toast` /
       `.photos-root .sv-select-bar` / `.photos-root .lb-confirm-scrim` (photos-smartview.scss:
       550-567/675, photos.scss:620) -- a CSS descendant combinator only matches real DOM
       descendants, and "declared after `.photos-root`'s closing tag in the same template" does
       not qualify (identical root cause to the "New album" modal bug also fixed elsewhere,
       and the same bug PhotosAlbumDetail.vue's own copy of this
       tail section had). Outside `.photos-root`, `position: fixed` / the scrim background /
       centering / z-index / the toast's dark-glass fill never applied. Moved back inside
       `.photos-root`, as a sibling of `.app` (matching Vue2's own single-shell nesting and that
       same precedent) -- none of these are affected by `.app`'s own
       `height:100vh;overflow:hidden`, since they are `position: fixed` or don't need
       viewport-relative sizing, and `.photos-root` itself sets no
       transform/filter/perspective/`contain` that would create a new containing block for
       `position: fixed` (same reasoning already verified there).

       The export-result in-page floating bar (structural spec 7): in Vue2 this is a
       page-positioned floating bar (scss:458-476), at a different position and information
       level than the global useToast -- drawn to match Vue2's own, not reusing useToast.
       This used to sit as a sibling of `.photos-root` (before that, a sibling inside the
       AreaShell slot's `.photos-layout`, shifted up one level unchanged after the shell was
       removed); it now moves back to being a sibling of `.app`,
       still inside `.photos-root`. -->
  <transition name="sv-toast-fade">
      <div v-if="exportToast" class="sv-toast" data-test="sv-export-toast">
        <svg v-if="exportToast.icon === 'download'" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 10l5 5 5-5M5 21h14" /></svg>
        <svg v-else viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14" /></svg>
        {{ exportToast.text }}
      </div>
    </transition>

    <!-- Edit-mode bottom bar (target :318-333). Reshapes the earlier version into the
         target's three elements — hint, Remove, Add photos — and re-gates it on `edit` alone
         instead of `edit && selectedIds.length`. The gate has to change: the bar now carries
         the hint line that speaks for the empty selection, and Add photos, which would be
         unreachable in a smart view with nothing selected otherwise. What used to keep an empty
         Remove request impossible is now the button's own `disabled` (plus removeSelected's own
         early return), which is where the album page puts it too.
         `&& sv` guards the same hole PhotosAlbumDetail.vue:1005 does: this bar sits outside the
         `v-else` that requires a smart view (this used to be a sibling of `.photos-root`
         itself; see the correction note above, it was moved back to being a sibling of
         `.app`, still inside `.photos-root`), so without the `&& sv` guard the bar would float
         over the not-found state if the view vanished without the id changing. -->
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

    <!-- Library picker (Vue2 :283-291). Title reuses photosAlbumPickerTitle --
         Vue2 already feeds one string to two pickers.
         submit-label: Vue2 :288 passes this picker a static `$t('Add selected')`, not the
         count-bearing `Add ({count})` the two album pages use. The first version passed the
         album pages' count function here and cited PhotosLibraryPicker's documented exception
         (b) -- but that exception is about keeping the album pages' existing consumers
         unchanged, and says nothing about which form a **new** consumer should use (final
         review, finding 3). Reverted to the static label, reusing P1's existing photosMoAddSelected (the
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

    <!-- Task 8 cross-page sweep: this used to invent its own `.sv-confirm-*` idiom (comment
         claimed it was avoiding a name clash with PhotoLightbox.vue's own `.lb-confirm-*`) --
         but Vue2's actual source (PhotosSmartViewDetail.vue:365-379) renders this dialog with
         `.lb-confirm-scrim`/`.lb-confirm`/`.trash-btn-ghost`/`.trash-btn-cta.trash-btn-cta-danger`
         inside `<transition name="lb-confirm">`, the exact reference idiom T3/T4 already
         parity-ized for the albums-index/AlbumDetail pages. PhotoLightbox.vue's own identically
         named local classes never collide with this (Vue scoped styles isolate per-component),
         same precedent T4 already noted for AlbumDetail's own copy. Renamed to match; local
         `.sv-confirm-*` CSS below is deleted, letting parity's own globally-imported rule
         (photos.scss:620-700) govern directly. -->
    <Transition name="lb-confirm">
    <div v-if="confirmDeleteOpen" class="lb-confirm-scrim" data-test="sv-confirm-scrim" @click.self="closeDeleteConfirm">
      <div class="lb-confirm">
        <div class="lb-confirm-icon" style="color: var(--danger)"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg></div>
        <div class="lb-confirm-title">{{ t('photosSvDeleteName', { name: sv?.name }) }}</div>
        <div class="lb-confirm-body">{{ t('photosSvSmartViewRemovedStops', { n: fmtNum(sv?.count ?? 0) }) }}</div>
        <div class="lb-confirm-foot">
          <button type="button" class="trash-btn-ghost" data-test="sv-confirm-cancel" @click="closeDeleteConfirm">{{ t('photosCancel') }}</button>
          <button type="button" class="trash-btn-cta trash-btn-cta-danger" data-test="sv-confirm-ok" @click="doDelete">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg>
            {{ t('photosDelete') }}
          </button>
        </div>
      </div>
    </div>
    </Transition>

    <!-- Task 8 cross-page sweep: same `.lb-confirm-*`/`.trash-btn-*` idiom as the delete dialog
         above -- Vue2's own convert dialog (PhotosSmartViewDetail.vue:386-406) reuses the exact
         same classes, only swapping `.trash-btn-cta-danger` for `.trash-btn-cta-primary`
         (parity already ships this modifier too, photos.scss:681-685 -- an accent-blue gradient
         filling in what would otherwise be a blank pill on the reset button background) and the
         icon's colour prop (`var(--accent-hi)` vs the delete dialog's `#FF6B5C`/--remove-fg).
         No `.accent` modifier class needed any more -- Vue2 never had one either, it just passes
         a different `color` to its icon component; this SFC now does the Vue3 equivalent with an
         inline `style="color: ..."`, same technique PhotosAlbumDetail.vue's own delete dialog
         already uses. `.sv-confirm-error` (a New-UI-only addition, Vue2 has no inline convert-
         error box) renamed to `.sv-convert-error` to match its own `data-test` and stop reading
         as a leftover fragment of the deleted `.sv-confirm-*` family. -->
    <Transition name="lb-confirm">
    <div v-if="convertToAlbumOpen" class="lb-confirm-scrim" data-test="sv-convert-confirm" @click.self="closeConvertToAlbum">
      <div class="lb-confirm">
        <div class="lb-confirm-icon" style="color: var(--accent-hi)"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="18" height="14" rx="2" /><path d="M12 11v6M9 14h6" /><path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2" /></svg></div>
        <div class="lb-confirm-title">{{ t('photosSvConvertToAlbumTitle', { name: sv?.name }) }}</div>
        <div class="lb-confirm-body">{{ t('photosSvConvertToAlbumBody', { n: fmtNum(sv?.count ?? 0) }) }}</div>
        <div v-if="convertError" class="sv-convert-error" data-test="sv-convert-error">{{ convertError }}</div>
        <div class="lb-confirm-foot">
          <button type="button" class="trash-btn-ghost" data-test="sv-convert-cancel" :disabled="convertingToAlbum" @click="closeConvertToAlbum">{{ t('photosCancel') }}</button>
          <button type="button" class="trash-btn-cta trash-btn-cta-primary" data-test="sv-convert-ok" :disabled="convertingToAlbum" @click="doConvertToAlbum">
            {{ convertingToAlbum ? t('photosAlbumConverting') : t('photosSvConvertToAlbum') }}
          </button>
        </div>
      </div>
    </div>
    </Transition>
  <!-- Add-to-album picker for the lightbox's
       `@add-to-album`, same shape as PhotosAlbumDetail.vue's own `AlbumPickerDialog` mount --
       nested inside `.photos-root` (its own panel background is `var(--surface-2)`, a
       `.photos-root`-local token with no fallback, per the F1/F4 lesson class); the lightbox
       just below joins it there too. -->
  <AlbumPickerDialog v-model:open="albumPickerOpen" :asset-ids="albumPickerIds" @added="onAlbumPickerAdded" />

  <!-- PhotoLightbox re-nested in Plan F: the re-skin (Tasks 3-4) removed the scoped-vs-parity cascade tie that F8-r4 guarded against. -->
  <PhotoLightbox
    @delete="onLightboxDelete"
    @toggle-fav="() => {}"
    @add-to-album="(id) => openAlbumPicker([id])"
  />
    <!-- Plan G: Ask Nimo FAB + popup + drawer, same "mount once per view, Teleport to body" shape
         as PhotosToastHost (where present) -- Photos has no shared shell to mount this once at. -->
    <AskNimoHost />
  </div>
  <!-- Photos-private toast queue (Duplicate/Convert/etc.)
       -- mounted once per photos view, Teleports to <body> and re-applies photos-root +
       themeClass on its own portal target (see PhotosToastHost.vue's own header comment), so its
       position here relative to `.photos-root`'s closing tag makes no rendering difference --
       same placement convention Photos.vue already uses for this exact component. This page
       previously had no mount for it at all (only `Photos.vue` did), which is why
       `duplicateSv()`/`doConvertToAlbum()`'s `photosToast.show(...)` calls had nothing to
       render them. -->
  <PhotosToastHost />
</template>

<style scoped>
/* The flex-row shell + the transitional `.sidebar { flex... }` width pin are
   gone — the `.app` CSS Grid (parity scss photos.scss:116-129) now owns both the sidebar's
   width and the height cap, same as Photos.vue since its own re-skin. This file's
   source no longer contains a `.photos-layout` rule — photosLayoutHeightCap.test.ts's
   CAPPED list has been updated to drop this page accordingly. */
.photos-main { position: relative; flex: 1 1 auto; min-width: 0; align-self: stretch; display: flex; flex-direction: column; min-height: 0; }

/* ── Skeleton (New-UI addition) ── */
.sv-skeleton { display: flex; flex-direction: column; gap: 14px; padding: 16px 32px; }
.sv-skel-bar { height: 20px; width: 200px; border-radius: 6px; background: var(--skeleton-bg); }
.sv-skel-header { height: 90px; border-radius: var(--radius-sm); background: var(--skeleton-bg); }
.sv-skel-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 6px; }
.sv-skel-tile { aspect-ratio: 1; border-radius: 6px; background: var(--skeleton-bg); }

/* ── Not found (registered deviation 1, New-UI addition) ── */
.sv-not-found { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 80px 20px; color: var(--text-2); text-align: center; }
.sv-not-found-title { font-size: 15px; font-weight: 600; color: var(--text-1); }
.sv-not-found-back { height: 34px; padding: 0 16px; border-radius: 8px; background: var(--surface-2); border: 1px solid var(--line); color: var(--text-1); font: inherit; font-size: 13px; cursor: pointer; }
.sv-not-found-back:hover { background: var(--surface-3); }

/* Re-skin (shadowing pass, same doctrine as previous passes): the already-imported
   global parity stylesheet (`import '../photos/styles/vue2-parity'`, line 59) carries its own
   `.photos-root .sv-detail-bar` / `.sv-header` / `.live-pill` / `.sv-actions` / `.sv-export-*` /
   `.sv-grid-photos` / `.sv-select-bar` / `.sv-toast` etc (photos-smartview.scss, imported
   globally). This component's own scoped rules of the identical selector text used to shadow
   those (a scoped `[data-v-xxx]` attribute ties or beats the global rule's specificity, and a
   scoped SFC's own <style> block loads after the script-level side-effect import in the
   bundle, so on a tie the local rule always won) -- pure duplication with nothing gained, the
   same "P2b's KEEP-THE-DUPLICATION ruling never actually covered the *global* parity import"
   finding Task 4 made for PhotosAlbumDetail.vue. Deleted below wherever the selector text
   matches by name; parity's own rule (and its own token set, scoped to `.photos-root`,
   inherited into this subtree regardless of this component's own `data-v-*` scoping) now
   governs directly. Two real bugs this cleanup surfaced, not just tidying:
   1. `.sv-toast` used to reference this repo's own theme-dependent tokens (--popup-bg/
      --card-border/--fg/var(--blur)) — parity's own `.sv-toast` (smartview.scss:550-567) is a
      *theme-invariant* dark-glass toast (a literal dark rgb value + blur(12px), independent of
      light/dark mode) precisely because it's this page's only such element. Deleting the local
      shadow means the toast now stays dark-glass in light mode instead of turning into a
      light popup that reads unreadable-white-on-white against the dark accent border.
   2. `.sv-select-bar` carried the same oversized `var(--blur)` glass token T4 already found
      (and fixed) on `PhotosAlbumDetail.vue`'s own copy of this bar — parity wants a much
      smaller blur(12px) saturate(180%), not this repo's big-panel blur token.
   Two more surfaced inside the photo tiles: `.sv-grid-photos .tile` locally repeated
   `border-radius: 4px` (photos.scss's own global `.tile` base rule is 3px, and Vue2 never
   overrides it for this grid -- smartview.scss:609 only restates `aspect-ratio: 1` here);
   and `.sv-grid-photos .tile img` was a *more specific* local duplicate of parity's global
   `.tile img`, which silently killed the hover-zoom transform/scale(1.04) that rule and its
   `.tile:hover img` sibling provide everywhere else in the app -- these tiles never zoomed on
   hover. Both deleted; parity's own (more correct) values now apply.
   Kept in place, as documented survivors below: rules with no parity selector name at all
   (Vue2 renders that spot with a bare inline `style=`, or it's a New-UI-only addition), one
   already-reviewed *consolidation* (`.sv-cond`, same precedent as PhotosAlbumDetail.vue's own
   `.sv-header h1 .sv-cond`), and the handful of rules the existing test suite's raw-source /
   cssCascade guards pin to *this file's own* text (see each one's own comment). The confirm-
   dialog idiom is covered by Task 8's own cross-page sweep ("四毛玻璃弹层类名激活确认"): this
   page's delete/convert dialogs were renamed from the invented `.sv-confirm-*` classes to the
   `.lb-confirm-*`/`.trash-btn-*` classes Vue2 actually uses (and T4 already adopted for the
   album page) -- see the template's own comment on the dialogs for the detail, and the deviation
   table entry below for the deleted local CSS this rename made redundant. */

/* Renamed to `back` in the template (was `.sv-back-btn`, a name that never matched Vue2's own
   `.sv-detail-bar .back` at all -- a pure naming drift, same category as the album page's
   singular/plural sort-menu finding T4 made). Now that the class matches, parity's nested
   `.photos-root .sv-detail-bar .back`(+:hover) (smartview.scss:305-313) governs directly and
   this rule is deleted outright. */
.sv-detail-bar { padding: 16px 32px; display: flex; align-items: center; gap: 12px; border-bottom: 1px solid var(--line); }
.sv-last-updated { font-size: 12px; color: var(--text-2); }

/* .sv-header / .sv-header h1 deleted -- identical shape to parity (smartview.scss:364-372),
   parity wins. */
.sv-title { cursor: text; color: var(--text-1); }
/* Property-by-property match against Vue2 :22's inline style: font-size:28px (already on h1) /
   font-weight:600 (same) / letter-spacing:-0.02em (same) / min-width:300px / background /
   border / border-radius / padding / color / font / outline.
   No parity class name (Vue2's input has no class at all), kept. */
.sv-title-input {
  background: var(--surface-2); border: 1px solid var(--accent); border-radius: 8px;
  padding: 2px 10px; color: var(--text-1); font: inherit; font-size: 28px; font-weight: 600;
  letter-spacing: -0.02em; font-family: var(--font-display, var(--font)); outline: none; min-width: 300px;
}
/* `.live-pill`/`.paused-pill`(+:hover/:active/.live-dot) and their local `@keyframes sv-pulse`
   are deleted entirely. Parity's actual selector is nested -- `.photos-root .sv-header h1
   .live-pill`/`.paused-pill` (smartview.scss:374-405) -- which out-specifies this file's bare
   `.live-pill` regardless of source order, so the local rule was already fully shadowed dead
   code (the opposite direction from the other shadows on this page: here parity was already
   winning, this deletion just removes the now-provably-inert duplicate). Parity's keyframe is
   the shared `photos-pulse` (photos.scss:203, imported globally) driving the breathing dot;
   this file's own private `sv-pulse` keyframe had no other consumer and is gone with it. */

/* T7 delivered: Vue2 scss:252's container layout (T6 only left a min-height placeholder). min-height:4px is a
   New-UI-only addition (keeps the row from collapsing when `sv.conds` is empty) -- parity's
   own `.sv-header-conds` (smartview.scss:415) has no such property, everything else here
   duplicates it, so only the addition survives. */
.sv-header-conds { min-height: 4px; }

/* Vue2 photos-smartview.scss:91-97 (base .sv-cond) + :414's h1-row size bump folded in -- the
   pill only ever appears on the h1 row here, so the two layers collapse into one rule, the
   same shape T4 already established for PhotosAlbumDetail.vue's own `.sv-header h1 .sv-cond`
   (and AlbumConvertToSmartDialog.vue:310 before that). Kept as-is: an intentional,
   already-reviewed *consolidation*, not a raw duplicate a scoped block could safely delegate
   to parity's own layered cascade -- a local `.sv-header-conds .sv-cond`/`.sv-header h1
   .sv-cond` override here would out-specify parity's own base `.sv-cond` regardless, so the
   self-contained version is the one that reliably renders the header's actual 11.5px/3px 10px
   sizing. */
.sv-cond {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: 999px;
  background: var(--surface-3);
  color: var(--text-2);
  font-size: 11.5px;
}
/* `.sv-cond-removable`(base)/`.sv-cond-x`(base)/`.sv-cond-removable:hover .sv-cond-x` are
   deleted -- identical shape to parity (smartview.scss:418-445, Vue2's coral-red literal maps
   to the --remove-fg family, matching this file's own `.sv-export-item-danger` precedent).
   `.sv-cond-removable:hover` itself is kept as a documented exception: this file's own
   cssCascade guard (`.sv-cond`/`.sv-cond-removable` hover-winning test) scans only this
   component's local <style> text, not the global parity stylesheet, so it needs one local
   `:hover` candidate to find -- deleting it would starve that test of any rule to compare,
   not just change which one wins. Kept verbatim (same value parity already carries), no
   functional difference either way since it's the sole local hover candidate. */
.sv-cond-removable:hover {
  background: color-mix(in srgb, var(--danger) 14%, transparent);
  color: var(--danger);
}
.sv-cond-removable[data-busy="true"] { cursor: not-allowed; opacity: 0.6; }

/* .sv-header-stats(+b/.delta) deleted -- identical shape to parity (smartview.scss:452-459),
   parity wins. */

/* .sv-actions deleted -- identical shape to parity (smartview.scss:478), parity wins. */
/* .sv-action-btn(base+:hover) deleted -- identical shape to parity (smartview.scss:479-488);
   parity's own global `.photos-root button` reset (photos.scss:104) already supplies
   `font: inherit; cursor: pointer`, so nothing is lost. */
.sv-action-btn:disabled { opacity: 0.5; cursor: not-allowed; }
/* Vue3-sibling-only restatement (no parity class name -- Vue2 sizes this button with an
   inline `style="padding:0 10px;min-width:36px;justify-content:center"`, :180). Real value
   fix: this was `min-width: 32px` -- a 4px drift from Vue2's own literal 36px that predates
   this cleanup (PhotosSmartViewDetail.test.ts locked the wrong value; corrected together with
   the test in this same commit). Sibling PhotosAlbumDetail.vue's own copy of this rule
   (Task 5) carries the identical 32px drift against its own Vue2 source's 36px -- out of this
   task's scope (different file, already committed), flagged as a follow-up in the report. */
.sv-action-btn-icon { padding: 0 10px; min-width: 36px; justify-content: center; }
/* .sv-action-btn[data-open="true"] deleted -- parity wins (smartview.scss:494-496). */

/* .sv-side-actions deleted -- identical shape to parity (smartview.scss:707-712), parity wins. */
.sv-more-wrap { position: relative; }

/* `.group`/`.sv-actions .order-pill`(base)/`.album-detail-actions-sep`/`.density`(all states)
   used to restate PhotosAlbumDetail.vue's own scoped values under the "P2b KEEP-THE-
   DUPLICATION" ruling -- but `.group`/`.order-pill`/`.density` are photos.scss's own *global*
   selectors (:471-476, :3514-3524, and photos.scss's own `.density` rule), already imported;
   T4 already reached the same conclusion and deleted PhotosAlbumDetail.vue's copies. Deleted
   here too; parity's own rules (shared by both detail pages) now govern directly. */
.sv-actions .order-pill:hover { background: var(--surface-3); color: var(--text-1); }

/* Sort popup. Renamed to `albums-sort-menu`/`albums-sort-item` in the template (was
   `sv-sort-menu`/`sv-sort-item`, names that never matched Vue2's own dropdown at all -- Vue2's
   SV sort popup uses the exact same `.albums-sort-menu`/`.albums-sort-item` classes as the
   Albums page's, per its own template; a pure naming drift, same category as the back-button
   fix above). Now that the classes match, parity's own rule (photos.scss:3157-3194) governs
   directly; the local rules of the old names are deleted. */
.sv-sort-wrap { position: relative; }
/* Vue2's own dropdown overrides parity's default `top: calc(100% + 6px)` with an inline
   `style="top:calc(100% + 4px)"` for this specific instance (same override T4 already kept for
   PhotosAlbumDetail.vue's copy of this same dropdown). */
.albums-sort-menu { top: calc(100% + 4px); }
/* `.sv-sort-check` keeps its own name (no parity class exists for it -- Vue2 renders the active
   glyph inline and pads the inactive row with a bare `style="width:12px;display:inline-block"`
   span). Colour corrected from --accent-text to --accent-hi, matching Vue2's own literal
   `color="var(--accent-hi)"` on the check icon and now that the global parity import defines
   --accent-hi on `.photos-root` itself (T4 already established the same "reference parity's own
   token" precedent for PhotosAlbumDetail.vue's `.album-sort-check`). */
.albums-sort-item .sv-sort-check { width: 12px; flex-shrink: 0; color: var(--accent-hi); }

/* ── Export / more menu (scss:499-544) ── */
/* .sv-export-menu deleted -- identical shape to parity, parity wins. */
.sv-more-menu { min-width: 220px; }
/* .sv-export-item(base+:hover)/.sv-export-icon/.sv-export-title/.sv-export-desc/.sv-export-sep
   deleted -- identical shape to parity, parity wins. Deleting the base `:hover` does not change
   which rule wins the danger row's own cssCascade guard below: `.sv-export-item.sv-export-item
   -danger:hover`'s compound selector was already the higher-specificity winner regardless of
   whether the base `:hover` rule was also present. */
/* Vue2 :119-123's three inline coral-red literals -> the --remove-fg family. No parity class name for the
   danger row (Vue2 expresses it with inline style literals), kept. */
.sv-export-item-danger, .sv-export-item-danger .sv-export-title { color: var(--danger); }
.sv-export-icon-danger { background: color-mix(in srgb, var(--danger) 14%, transparent); color: var(--danger); }
/* The compound selector's (0,3,0) specificity reliably beats the base class's `.sv-export-item:hover` (0,2,0) -- not relying on source order. */
.sv-export-item.sv-export-item-danger:hover { background: color-mix(in srgb, var(--danger) 14%, transparent); }

/* Vue2 :79/:102 each wrap a `<transition name="sv-menu">`, with the rule at
   scss:546-547 (opacity 0.14s + translateY(-4px) scale(0.97), a 140ms scale-fade-in). Kept as-is
   (same "necessary Vue3 transition-name translation" precedent T4 kept for its own identical
   copy): parity's own Vue2-spelled `-enter`/`-leave-to` selectors are unusable verbatim under
   Vue3's `<Transition>`, which requires `-enter-from`. Values here already match parity's. */
.sv-menu-enter-active, .sv-menu-leave-active { transition: opacity 0.14s ease, transform 0.16s cubic-bezier(0.2, 0.8, 0.2, 1); transform-origin: top right; }
.sv-menu-enter-from, .sv-menu-leave-to { opacity: 0; transform: translateY(-4px) scale(0.97); }

/* ── Two-section grid (scss:572-671) ── */
/* .sv-section-head(+.pill) deleted -- identical shape to parity, parity wins. */
/* .sv-grid-photos deleted -- identical shape to parity, parity wins. */
/* Vue2 :136's inline `padding-bottom:18px` is only added on the "recently added" section's
   grid (the all-matches section does not have it), giving that section breathing room against
   the "all matches" heading below it. No parity class name for this modifier -- kept,
   also test-locked (PhotosSmartViewDetail.test.ts asserts this exact rule body verbatim). */
.sv-grid-photos-recent { padding-bottom: 18px; }
/* .sv-grid-photos.is-compact deleted -- identical shape to parity (smartview.scss:606-608),
   parity wins. */
/* .sv-grid-photos .tile / .sv-grid-photos .tile img deleted -- see the big comment at the top
   of this block for the two real bugs this fixes (border-radius 4px→3px, and restoring the
   hover-zoom transform parity's global `.tile img`/`.tile:hover img` (photos.scss:340-341)
   was silently losing to this file's own more-specific duplicate). Parity's own narrow
   override here is just `aspect-ratio: 1` (smartview.scss:609), layered on top of the global
   `.tile` base -- that's all this selector needs to add. */
/* Vue2 scss:610-617 also layers a translucent black inset shadow on the inside of the accent
   border, whose job is to push the accent ring's contrast up over light-colored photos.
   Identical shape to parity (colour literal too) -- but kept verbatim rather than
   deleted: PhotosSmartViewDetail.test.ts asserts this exact selector+box-shadow property in
   this file's own raw source (a pre-existing guard, written before parity was wired in as a
   *global* import). Deleting it would only remove a now-redundant, harmless, pixel-identical
   duplicate -- no bug, no visual change -- so it is left in place rather than spending a test
   edit on a no-op cleanup. */
.sv-grid-photos .tile.recent::after {
  content: ""; position: absolute; inset: 0; border: 2px solid var(--accent); border-radius: inherit;
  pointer-events: none;
  box-shadow: inset 0 0 0 2px color-mix(in srgb, black 40%, transparent);
}
/* `.sv-grid-photos .tile[data-selected="true"]`(+::before) deleted: it duplicated parity's own
   *global* `.photos-root .tile[data-selected="true"]` rule (photos.scss:342-346) verbatim --
   that generic rule already reaches these grids' tiles (no `.sv-grid-photos`-scoped variant
   exists in smartview.scss at all), and its own selector out-specifies this file's local one
   regardless (5 vs 3 selector segments), so the local copy was redundant from the start. */
/* Pin badge (scss:632-641). Parity's own nested selector out-specifies this file's bare
   `.sv-pin-tag` regardless (5 vs 2 segments), so only the one property parity doesn't set
   (icon glyph colour) needs to survive locally. */
.sv-pin-tag {
  color: #fff; /* theme-exception: badge glyph sits on unpredictable photo content inside a
    fixed dark badge — same reasoning as PhotosMomentDetail.vue's own .sv-pin-tag. */
}
/* Selection check (scss:642-650): same story -- parity's nested selector wins on specificity,
   only the icon colour survives locally. */
.sv-tile-check {
  color: var(--on-accent); /* --on-accent's one legal use: icon sits on a solid --accent fill. */
}

/* Excluded band (scss:654-671): `.sv-excluded-head`(+:hover)/`.sv-excluded-grid .tile`(+:hover)
   /`.sv-excluded-grid .tile .sv-restore-hint`(+:hover) all deleted -- parity's own nested
   selectors out-specify (or tie-and-win, in `.sv-excluded-head`'s case) this file's local
   copies, and parity's `.sv-restore-hint` already sets its own literal white text colour, so
   nothing survives as a needed addition. */
/* Final review, finding 4 (deviation 6): while selecting, an excluded tile does nothing.
   The affordance has to say so too — otherwise the Restore hint still invites a click that
   is now deliberately ignored, which reads as the page being broken rather than as the tile
   being out of scope. No parity name (New-UI-only addition); compound selector beats parity's
   own `.tile:hover` rule structurally, not by source order. */
.sv-excluded-grid .tile[data-inert="true"] { cursor: default; }
.sv-excluded-grid .tile[data-inert="true"]:hover .sv-restore-hint { opacity: 0; }

/* Selection bar (scss:675-696): deleted -- see the big comment at the top of this block for
   the var(--blur) glass-token bug this fixes (same class of bug T4 already found and fixed on
   PhotosAlbumDetail.vue's own copy of this bar). Parity's own rule now governs the whole
   thing, including `.sv-select-bar span`. */

/* .sv-grid-photos .new-tag deleted entirely -- parity's own nested selector (smartview.scss:
   618-629) out-specifies this file's bare/compound local copy regardless, and it already sets
   its own literal white text colour, so no addition is needed. */

/* This settles up a debt this task's structural review flagged: T6 introduced this page's
   first 4 scrollable sections, and this fills in the layout for them:
   Vue2 scss:315-320 (sv-detail-layout) + :321-326 (sv-detail-main) + :341-348 (sv-detail-side's
   base appearance). --line -> --divider, --surface-1 -> --panel-bg-solid (the precedent is
   PlaceDetailPanel.vue:38/312, the same category of "solid-backed sidebar that sits beside
   content", not --popup-bg -- that one is reserved for floating overlays).
   **Decision (holds unchanged, not disturbed by this shadowing cleanup): Vue2 scss:324-361's
   `::-webkit-scrollbar`/`scrollbar-width`/`scrollbar-color` scrollbar styling is NOT ported --
   `.sv-detail-main`/`.sv-detail-side` both just use `overflow-y: auto` and leave it to the
   browser's default scrollbar.** The reasoning is unchanged: this branch's convention is to
   only ever hide a scrollbar (`scrollbar-width: none` / `display: none`), never repaint one --
   existing precedent at `PhotosGrid.vue:420`, `PhotoFilmstrip.vue`, `PhotosPersonDetail.vue:1041`;
   `theme.css` already provides a global thin-scrollbar fallback; and it has already been
   verified that once an element picks up the standard `scrollbar-width`/`scrollbar-color`
   properties, Chrome 121+ disables that element's entire `::-webkit-scrollbar` customization
   family -- porting Vue2's approach as-is would just add dead code. This layout is itself
   mutually confirmed with the precedent already established elsewhere that "PhotosAlbumDetail.vue
   follows PhotosSmartViewDetail.vue's existing precedent" -- this is that precedent's original
   source, and it stays unchanged. Test-locked (:1357-1362, the 768px media query at :1364-1372). */
.sv-detail-layout { display: grid; grid-template-columns: 1fr 320px; flex: 1 1 auto; min-height: 0; }
.sv-detail-main { min-width: 0; overflow-y: auto; padding-bottom: 60px; }
/* Background-colour correction (from a real-device screenshot: the whole right column showed up
   as a solid black slab against the glass shell). This previously followed T6's mapping of
   `--surface-1` -> `--panel-bg-solid`, citing PlaceDetailPanel as precedent -- but that
   precedent is a **functional** one: it sits over the PlacesMap canvas, and translucency would
   let the map's grid lines show through (found in on-device testing). This
   column has no map underneath, only the area shell, so an opaque solid background has only one
   effect: looking inconsistent with the area it actually sits in -- the other persistent
   sidebars in the same area (PhotosSidebar:119 / PlacesRail:200 / PhotoInfoPanel:175 /
   PersonPlacesTab:188) are all `var(--surface-1)`. Switched to the glass background to match
   them.
   `--panel-bg-solid`'s consumer allowlist is in views/__tests__/photosGlassSurfaces.test.ts. */
.sv-detail-side {
  border-left: 1px solid var(--line); background: var(--surface-1);
  overflow-y: auto; padding: 20px 18px 40px; min-height: 4px;
}

/* ── Export-result floating bar (scss:550-570) ── */
/* `.sv-toast` itself is deleted -- this file's own bare selector used to shadow parity's own
   theme-*invariant* dark-glass toast (a literal dark rgba + blur(12px), independent of light/
   dark mode -- ONLY this page uses this idiom) with this repo's ordinary theme-dependent glass
   tokens (--popup-bg/--card-border/--fg/var(--blur)), which would have rendered as a light
   popup in light mode instead of staying dark-glass. Parity now governs the box entirely.
   `.sv-toast-fade-*` keeps its own deliberately-different transition name (Vue2/parity's own
   transition is literally named `sv-toast`, colliding with the toast's own element class --
   this repo's `<transition name="sv-toast-fade">` avoids that ambiguity, a design choice
   already made before this cleanup). No parity selector matches this name at all, so nothing
   here shadows anything; values are already 1:1 with parity's own (opacity 0.2s/translate
   0.22s), kept unchanged. */
.sv-toast-fade-enter-active, .sv-toast-fade-leave-active { transition: opacity 0.2s ease, transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1); }
.sv-toast-fade-enter-from, .sv-toast-fade-leave-to { opacity: 0; transform: translate(-50%, 8px); }

/* ── Task 8 cross-page sweep: delete-confirm dialogs ──
   The entire invented `.sv-confirm-*` cluster that used to live here (scrim/panel/icon/title/
   body/foot/cancel/ok, ~44 lines, this repo's own --overlay-bg/--popup-bg/--card-border/--fg
   tokens) is deleted outright. Vue2's real source (PhotosSmartViewDetail.vue:365-406) renders
   both this page's dialogs (delete + convert-to-album) with `.lb-confirm-scrim`/`.lb-confirm`/
   `.lb-confirm-icon`/`.lb-confirm-title`/`.lb-confirm-body`/`.lb-confirm-foot`/`.trash-btn-ghost`/
   `.trash-btn-cta`(+`.trash-btn-cta-danger`/`.trash-btn-cta-primary`) -- the exact already-
   parity-ized reference idiom T3 established (albums-index) and T4 already adopted for
   PhotosAlbumDetail.vue's own delete dialog. Renamed the template's classes to match (see the
   template's own comments on both dialogs); parity's own self-contained rule (photos.scss:
   620-692, imported globally, unprefixed by this page's scoped attribute) now governs every
   part of both dialogs directly -- no local restatement needed at all, same as AlbumDetail's own
   copy of this idiom. The old `.sv-confirm-icon.accent` colour-disc modifier is gone too: Vue2
   never had one, it just passes a different icon colour per dialog (delete red vs convert
   accent-hi), which the template now does directly via inline `style="color: ..."`, matching
   AlbumDetail's own technique. Two things do NOT come from parity and are kept below:
   `.sv-convert-error` (a New-UI-only inline failure message, renamed from `.sv-confirm-error`
   to match its own `data-test` now that the rest of the `.sv-confirm-*` family is gone -- Vue2
   has no such box at all) and the Vue3 `-enter-from` transition-name translation of parity's
   Vue2-spelled `.lb-confirm-enter`/`.lb-confirm-leave-to` rule (same fix already applied to
   `.sv-menu-*` above and to PhotosAlbumDetail.vue's own copy of this exact dialog). */
.sv-convert-error { margin-top: 8px; font-size: 12px; color: var(--danger); line-height: 1.4; }
.lb-confirm-enter-active, .lb-confirm-leave-active { transition: opacity 0.2s, transform 0.2s; }
.lb-confirm-enter-from, .lb-confirm-leave-to { opacity: 0; transform: scale(0.95); }

/* New-UI mobile enhancement (Vue2 has no responsive drawer here — same registered deviation
   as Photos.vue's own copy of this rule): once the sidebar switches into is-drawer mode at
   ≤768px, collapse `.app`'s sidebar column too, so `.main` doesn't leave a dead
   var(--sidebar-w) gutter. 详情页自己的两列(内容/右栏)同样塌成单列,右栏排到内容下方。 */
@media (max-width: 768px) {
  .app { grid-template-columns: 1fr; }
  .sv-detail-layout { grid-template-columns: 1fr; }
  .sv-detail-side { border-left: 0; border-top: 1px solid var(--line); }
}
</style>
