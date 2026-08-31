<script setup lang="ts">
// Task 8: timeline integration — fills the content area left as a placeholder by T5,
// wires the socket task-progress feed, task-done toast coalescing and batch
// delete. Ports the Vue 2 panel's src/views/Photos/PhotosTimeline.vue's socket
// block (:74-91) and mounted-time coalescer wiring (:315-335), simplified per the P1 scope cut:
//  - non-'index' task types get a generic `{label} completed` toast
//    (photosTaskCompletedToast) instead of Vue2's per-type messages.
//  - no 5s pre-removal delay before announcing — a status:'done' transition
//    observed at ingest time goes straight into the coalescer.
// Task 9: lightbox integration (closing out this phase) — the tile `open` handler is no
// longer a no-op: it builds the current tab-filtered pagination set (matching what the
// user sees in the grid — the grid's own emitted `list` is always undefined) and hands it
// to useLightbox().openAt; PhotoLightbox is mounted at the end of the template, and its
// delete event lands on store.deleteAssets + a 4000ms toast (the lightbox already closes
// itself on confirm, so this doesn't close it again).
// Task 9 addendum (albums): unifies the selection toolbar's bulk "Add to album" and the
// lightbox's single-item "Add to album" through AlbumPickerDialog (T5) — pickerOpen/
// pickerIds + openAlbumPicker(ids), @added clears selection (per Vue2 pickAlbum:587-595).
// EXIF filter bar wiring — follows Vue2 PhotosTimeline.vue:142-175's gridMonths.
// FilterBar mounts into PhotosToolbar's after-tabs slot (T3); the exifFilter state +
// derived gridMonths + filteredCount/onOpenTile all switch to gridMonths, so all three
// (grid data source, topbar count, lightbox pagination set) share the same source.
//
// Task 3 (shell + sidebar re-cut): the root structure changes to Vue2's
// `.photos-root[themeClass] > .app[data-collapsed][data-selecting] > PhotosSidebar +
// main.main` (Vue2 PhotosTimeline.vue:943-956), replacing the old AreaShell +
// `.photos-layout` flex-row shell. The content slot (previously spanning from
// PhotosSearchBar down to PhotosGrid) stays as-is inside `.photos-main`, just now wrapped
// in an extra `.app`/`main.main` grid shell.
//
// Task 4 (topbar re-cut, D13): a new `<PhotosTopbar>` is added under `main.main` as
// `.photos-main`'s immediately preceding sibling (following Vue2 PhotosTimeline.vue:956-971's
// `<main class="main"><PhotosTopbar/><PhotosSearchView v-if=.../>...</main>` structure — the
// topbar is a direct child of main, not nested inside the content-slot container). The
// `<PhotosSearchBar>` line that used to be inlined here, along with the `.photos-summary`
// count line right after it, both move into PhotosTopbar.vue (title block `.topbar-title` +
// `.topbar-sub`, whose subline is always the whole-library count; the search box is the
// centered `.search` inside `.topbar`). The `collapsed` persisted ref/toggle semantics are
// unchanged, it just now has a real click entry point (a gap flagged in T3's report under
// "Concerns" item 4 — Vue2's own collapse button lives right in the topbar, not in
// AreaShell's hamburger menu; this restores it to Vue2's original location).
// The PhotosSearchBar.vue component wasn't deleted at the time -- a grep confirmed it was still
// reused by `PhotosSearch.vue` (the search-results page's own top search box), just no longer
// referenced by this file. (Update: that component has since been
// retired from `PhotosSearch.vue` too -- `PhotosSearch.vue` now echoes the route's `q` through the
// same `PhotosTopbar` instance this file uses, `PhotosSearchBar.vue` has no consumers left, and
// the component and its test file were deleted together.)
//
// AreaShell keep-or-drop decision (brief Step 4): read through AreaShell.vue — on desktop
// (≥769px) `.area-bar` is indeed `display:none` (the D13 comment holds up), but `.area-body`
// still carries `padding:20px` and `overflow:auto`, and `.area-shell` wraps everything in
// another `height:100vh` flex column container. That is not "zero visible chrome": in the
// Vue2 pixel baseline the sidebar sits flush against the viewport's left edge (the `.app`
// grid itself is already a padding-free 100vh), and AreaShell's 20px padding plus the extra
// flex wrapper would push the whole `.app` grid inward, and stacked on top of `.app`'s own
// `height:100vh` it creates a double scroll container. So, starting with this task, Photos.vue
// drops AreaShell and roots directly at `.photos-root` instead — matching the existing
// precedent of the AI Agent area's own fully custom full-page shell
// (src/ai/views/AgentPage.vue), which likewise never borrows AreaShell for its own standalone
// viewport shell.
import '../photos/styles/vue2-parity'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { usePhotosTheme } from '../photos/composables/usePhotosTheme'
import PhotosSidebar from '../photos/components/PhotosSidebar.vue'
import PhotosTopbar from '../photos/components/PhotosTopbar.vue'
import PhotosToolbar from '../photos/components/PhotosToolbar.vue'
import PhotosGrid from '../photos/components/PhotosGrid.vue'
import PhotosSelectionToolbar from '../photos/components/PhotosSelectionToolbar.vue'
import AlbumPickerDialog from '../photos/components/AlbumPickerDialog.vue'
import PhotosFilterBar, { type ExifFilterValue } from '../photos/components/PhotosFilterBar.vue'
import PhotoLightbox from '../photos/lightbox/PhotoLightbox.vue'
import { useLightbox } from '../photos/lightbox/useLightbox'
import { usePhotosDeepLinks } from '../photos/composables/usePhotosDeepLinks'
import { useSidebarCollapse } from '../photos/composables/useSidebarCollapse'
import { useTimelineStore } from '../photos/stores/timeline'
import { usePhotosFavorites } from '../photos/stores/favorites'
import { usePhotosTrash } from '../photos/stores/trash'
import PhotosToastHost from '../photos/components/PhotosToastHost.vue'
import AskNimoHost from '../photos/components/asknimo/AskNimoHost.vue'
import { useAskNimo } from '../photos/composables/useAskNimo'
import { usePhotosToast } from '../photos/composables/usePhotosToast'
import { useToast } from '../stores/toast'
import { useMessageBus } from '../composables/useMessageBus'
import { unwrapTaskBusPayload, type TaskBusPayload } from '../photos/util/taskBus'
import { createTaskDoneCoalescer } from '../photos/util/taskDoneCoalescer'
import { matchesTab } from '../photos/util/tabFilter'
import { tabCountOf } from '../photos/util/timelineBuckets'
import { applyExifFilters } from '../photos/util/photosFilterUtils'
import type { Photo } from '../photos/util/assetToPhoto'

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const store = useTimelineStore()
const trash = usePhotosTrash()
const toast = useToast()
// Task 8: delete-flow toasts (batch + lightbox) move off the global app toast
// onto the Photos-private queue (Task 2's usePhotosToast) — icon/Undo affordance
// parity with Vue2's window.PhotosToast (PhotosTimeline.vue:704-718). The
// task-progress coalescer below stays on the global `toast` — it is
// task-progress UX, not part of the delete flow this task owns (see the
// doneCoalescer wiring further down).
const photosToast = usePhotosToast()
const bus = useMessageBus()
const lb = useLightbox()

// Task 3: photos-private theme, applied to the `.photos-root` grid root (Task 1's shared
// composable — see usePhotosTheme.ts).
const { themeClass } = usePhotosTheme()

// Task 3/4: sidebar collapse (Vue2 PhotosTimeline.vue's `collapsed` data + the topbar
// toggle button that flips it, PhotosTimeline.vue:965 `@toggle="collapsed = !collapsed"`) —
// persisted state + the narrow-viewport drawer branch (on a ≤768px viewport PhotosSidebar
// renders as its own fixed drawer instead of the desktop two-column grid track, so flipping
// `collapsed` there would be a no-op; the composable routes the same toggle to the drawer's
// own toggle() when isNarrow is true) now live in the shared useSidebarCollapse composable
// (an extraction, behavior-preserving — see that file's header comment for the
// module-singleton rationale). Photos.vue is its first consumer; the five re-shelled
// album/for-you views (Task 2) share the same instance.
const { collapsed, toggle: onToggleCollapse } = useSidebarCollapse()

// Default tab: aligned with the Vue 2 panel's src/views/Photos/PhotosTimeline.vue's
// `data() { tab: 'photo' }` — 'all' was an accidental drift introduced during
// the port; deliberately corrected here.
const tab = ref('photo')

// The deep-link dispatcher — the composable does its own onMounted +
// watch internally, this just mounts it once. `?tab` is the only key that needs this host
// page's cooperation (tab is this page's own display filter, not a navigation destination,
// so there's no route to jump to), so the write-entry for tab is handed to it via hooks;
// every other key is resolved entirely by the router on its own.
// Mounted right after `const tab` rather than at the top of setup: the closure only runs
// inside onMounted/watch, so it would never actually hit a TDZ, but "referencing a binding
// that hasn't been declared yet" is an unnecessary hazard to leave lying around, and it's
// simpler to just avoid the ordering issue altogether.
usePhotosDeepLinks({ setTab: (v) => { tab.value = v } })

const density = ref('comfortable')
const selected = ref<Array<string | number>>([])

// EXIF filter state. Follows Vue2 PhotosTimeline.vue:116's activeFilters, but keeps
// only three facet keys — that Vue2 object also carries placeKey/spotKey, two keys used for
// spot jumps; New-UI's city/spot jumps go through a standalone routed page (D6), so those
// two keys have no counterpart in this repo.
//
// Partial reversal of D6: the explicit,
// binding requirement is that PlaceDetailPanel.vue's "Open in Library" button AND a spot row's
// "View in Library" jump must land HERE (the photo library), with a place filter applied — not
// on the standalone place-assets page (that page stays, as a net addition other entries may
// still use; only these two buttons' own navigation target changes, see PlaceDetailPanel.vue's
// own comment for the mechanism this file's `?libraryPlace=` query key feeds).
//
// Vue2's own city jump (PhotosTimeline.vue's `onPlacesOpenLibrary`) drives exactly this file's
// existing `places: string[]` EXIF facet — `activeFilters.places = [city]` — the client-side
// text-match filter already wired up above; it does NOT use a separate placeKey/backend fetch
// for this entry point. Vue2's *spot*-row jump (`onPlacesOpenSpot`) additionally sets
// `placeKey`/`spotKey`, which drive a SEPARATE precise backend fetch (`_loadPlaceAssets`) that
// swaps the grid's data source to the exact per-spot photo list, layered under a dedicated
// breadcrumb bar (`.place-filter-bar`, "City › Spot") — New-UI's library has no such
// infrastructure at all (no placeKey/spotKey facet, no per-spot backend fetch, no breadcrumb
// bar), and building it is out of this fix's scope (deliberate decision: mirror Vue2's
// parameters as closely as the EXISTING filter system allows, do not invent new filter UI).
// So here, a spot jump necessarily DEGRADES to the same city-level `places` filter as the plain
// "Open in Library" jump — both PlaceDetailPanel.vue handlers below feed this file the same
// single city-name query key, and there is no finer-grained spot filter for this file to apply
// even if it wanted to. This is a documented limitation, not an oversight.
const exifFilter = ref<ExifFilterValue>({ years: [], places: [], cameras: [] })

// One-shot city-name seed for the `places` EXIF facet, fed by
// PlaceDetailPanel.vue's "Open in Library"/"View in Library" jumps via `router.push({ path:
// '/photos', query: { libraryPlace: city } })`. Deliberately a NEW, separate query key, not a
// reuse of `usePhotosDeepLinks`'s existing `?place=<numeric key>` — that key's contract already
// means something else entirely (an old-bookmark redirect straight to the place-assets page,
// consumed by a DIFFERENT composable mounted on this same page) and takes a backend place KEY,
// not a city NAME; colliding the two would make `usePhotosDeepLinks` intercept and redirect
// before this logic ever saw the query at all. Read once on mount (Vue2's own equivalent is
// also a one-shot method call from a click handler, not a persistent binding) and the key is
// stripped immediately after being consumed — same "one-shot query, strip after use" idiom
// `usePhotosDeepLinks.ts`'s own `stripQueryKey` already establishes elsewhere on this exact
// route, so a later reload of the bare `/photos` URL (after the user has since cleared the
// filter) doesn't silently resurrect it.
onMounted(() => {
  const raw = route.query.libraryPlace
  const city = (Array.isArray(raw) ? raw[0] : raw) || ''
  if (!city) return
  exifFilter.value = { ...exifFilter.value, places: [city] }
  const rest = { ...route.query }
  delete rest.libraryPlace
  void router.replace({ path: route.path, query: rest })
})

// Is an EXIF filter actually narrowing anything right now? Only
// then does "unknown membership" become a real problem for an unloaded month.
const exifFilterActive = computed(() => {
  const f = exifFilter.value
  return f.years.length > 0 || f.places.length > 0 || f.cameras.length > 0
})

// Aligned with Vue2 gridMonths' library branch (:170-172): filter each month,
// then drop the ones left empty — except for one case. In bucket mode an
// unloaded month's `photos` is always an empty array, so that unconditional
// filter would drop exactly the months the grid needs in order to paint
// structure — they are also where the scroll length and the jump anchors come
// from. Once an EXIF filter is active the drop is restored: an unloaded
// month's membership under that filter is genuinely unknown to the frontend
// (a registered limitation per spec §5.1, not an
// oversight; the real fix is backend-side filtering).
const gridMonths = computed(() =>
  store.months
    .map((m) => ({ ...m, photos: applyExifFilters(m.photos, exifFilter.value) }))
    .filter((m) => m.photos.length > 0 || (m.loaded === false && !exifFilterActive.value)),
)

// Grid does tab-filtering internally; mirror the same predicate here (hoisted
// to photos/util/tabFilter.ts, Fix 3) to feed the toolbar's item count (Vue2
// passed the filtered count, PhotosGrid.vue filteredMonths logic ported at task-7).
// D20 (per user decision): the count shrinks together with the EXIF filter, matching what
// the user actually sees.
// (Vue2 passes allPhotos.length, following neither the tab nor the filter; New-UI's P1 already
// changed it to follow the tab as a sanctioned deviation — this folds EXIF into the same
// computed, same direction.)
// A loaded month sums its real photos through the same matchesTab predicate
// the grid uses. An unloaded month (bucket mode only, gridMonths keeps these
// only while no EXIF filter narrows membership — see the `.filter` above)
// has no photos in hand yet, so summing `m.photos` would undercount the
// topbar while buckets are still streaming in; tabCountOf estimates it from
// the same directory metadata the grid sizes its skeleton from instead.
const filteredCount = computed(() =>
  gridMonths.value.reduce((sum, m) => sum + (
    m.loaded === false
      ? tabCountOf({ count: m.count ?? 0, videoCount: m.videoCount ?? 0, ocrCount: m.ocrCount ?? 0 }, tab.value)
      : m.photos.filter((p) => matchesTab(p, tab.value)).length
  ), 0),
)

// T16 wiring (structural spec 22): the search box is always shown (matches Vue2's
// `show-search = isLibraryView` — New-UI has no "library view / everything else"
// polymorphic shell, the timeline page itself only has this one shape, so there's no
// v-if condition). Submitting navigates to /photos/search. An empty string is already
// blocked upstream in PhotosTopbar.submitSearch (an empty string after trim returns
// immediately without emitting search-submit), so this handler never actually receives
// an empty string; the `q ? { q } : {}` below is purely defensive (in case some future
// call path passes an empty string some other way, it still won't build the empty
// `?q=` query param) — it does not mean "an empty submit still navigates."
function onSearchSubmit(q: string) {
  router.push({ path: '/photos/search', query: q ? { q } : {} })
}

function toggleSelect(id: string | number) {
  const idx = selected.value.indexOf(id)
  if (idx >= 0) selected.value = selected.value.filter((x) => x !== id)
  else selected.value = [...selected.value, id]
}
function cancelSelection() { selected.value = [] }

// Task 9: the "Add to album" entry points (selection toolbar bulk / lightbox single item)
// — both go through AlbumPickerDialog (T5).
const pickerOpen = ref(false)
const pickerIds = ref<Array<string | number>>([])
function openAlbumPicker(ids: Array<string | number>) {
  pickerIds.value = ids
  pickerOpen.value = true
}
// Follows Vue2 pickAlbum:587-595's closing `this.selected = []` — clears the selection state
// once the add finishes (whether triggered from the toolbar's bulk action or the lightbox's
// single item; only the bulk case actually has a non-empty `selected`, in the single-item case
// it's always already an empty array, so the assignment is a safe no-op).
function onAlbumAdded() {
  selected.value = []
}

async function onBatchDelete(ids: Array<string | number>) {
  // Snapshot the full requested id set (not just however many
  // store.deleteAssets reports as actually deleted) — Undo has to hand back
  // exactly what was asked to go, same as Vue2's onBatchDelete/restoreTrash
  // pair (PhotosTimeline.vue:704-718), which never distinguishes a partial
  // failure either.
  const snapshot = ids.map(String)
  const count = await store.deleteAssets(snapshot)
  photosToast.show({
    text: t('photosDeletedToast', { count }),
    icon: 'trash',
    action: {
      label: t('photosTrashUndo'),
      // Undo restores through the trash store (restoreTrashBatch + refetch
      // trash + refresh timeline) and does NOT show a second toast — Vue2
      // parity: the Undo click only dispatches photos/restoreTrash.
      onClick: () => { void trash.restore(snapshot) },
    },
  })
  selected.value = []
}

function onOpenTile(photo: Photo, _list: undefined, startMs: number) {
  // The grid itself doesn't know the current tab (its own internal filtering is for display,
  // not for the pagination set) — rebuild the "what the user sees" pagination set here using
  // the same matchesTab predicate, sharing both data source and predicate with PhotosToolbar's
  // filteredCount.
  // The pagination set must match exactly what the user sees in the grid — filter by
  // EXIF first (gridMonths), then by tab, using the exact same two-stage predicate as
  // filteredCount — otherwise the lightbox could page into a photo that was filtered out.
  const filtered = gridMonths.value.flatMap((m) => m.photos).filter((p) => matchesTab(p, tab.value))
  lb.openAt(photo, filtered, startMs)
}

// Delete-chain diagnosis follow-up: this used to show the
// success+Undo toast unconditionally, ignoring store.deleteAssets's return value
// entirely (it hardcoded `count: 1` even when nothing was actually deleted) — the
// identical swallow-and-lie shape already fixed in PhotosFavorites.vue's own
// onLightboxDelete. A single-item delete only has two possible outcomes (1 or 0
// actually deleted); on 0 there is nothing to undo, so the failure branch omits the
// Undo action entirely rather than offering one that would try to "restore" an id
// that was never deleted.
async function onLightboxDelete(id: string | number) {
  // The lightbox already closes itself when the user confirms delete (see PhotoLightbox.vue
  // doDelete), so this doesn't close it again.
  const snapshot = [String(id)]
  const count = await store.deleteAssets(snapshot)
  if (count > 0) {
    // Same toast/Undo shape as onBatchDelete — Vue2's lightbox delete reuses
    // onBatchDelete([id]) wholesale (PhotosTimeline.vue:1138), so a single
    // delete gets the identical trash-icon + Undo toast, count 1.
    photosToast.show({
      text: t('photosDeletedToast', { count: 1 }),
      icon: 'trash',
      action: {
        label: t('photosTrashUndo'),
        onClick: () => { void trash.restore(snapshot) },
      },
    })
  } else {
    // Reuses the existing "Delete failed" family (same key PhotosTrash.vue /
    // PhotosFavorites.vue reuse for their own zero-success cases) rather than adding a
    // near-duplicate key.
    photosToast.show({ text: t('photosTrashDeleteFailed'), icon: 'trash' })
  }
}

// ─── task-done toast coalescing ───────────────────────────────────────────
// P1 message table: 'index' reports the indexed count (Vue2 taskDoneMessage's
// index branch, PhotosTimeline.vue:720-723); every other type collapses to a
// generic "{label} completed" toast (P1 scope cut — Vue2's
// nuanced per-type face/embedding copy is out of scope here).
function messageFor(task: TaskBusPayload): string | null {
  if (task.type === 'index') {
    const n = task.current || task.total || 0
    return n > 0 ? t('photosIndexedToast', { n }) : null
  }
  return t('photosTaskCompletedToast', { label: task.label || task.type || '' })
}

const doneCoalescer = createTaskDoneCoalescer<TaskBusPayload>({
  messageFor,
  // 4000ms, aligned with Vue2's task-done toast duration (the Vue 2 panel's
  // src/views/Photos/PhotosTimeline.vue:329 `$buefy.toast.open({..., duration: 4000})`).
  emit: (message) => toast.show(message, 4000),
})

// Ingest-time done-transition detection: capture whether this task was
// already 'done' before the store merges the new event in, so a task that
// stays 'done' across repeated events (or re-ingests) is only announced once.
// Fix: this used to check `store.tasks.find(...).status === 'done'` to decide
// "has this already been announced" — fetchIndexStatus's idle reconciliation
// (timeline.ts:118-120) strips a done index task out of store.tasks, so if a late duplicate
// done event arrives afterward, find returns undefined, and the old check would mistakenly
// read it as "never announced" and fire a second toast. Switched to an id set that doesn't
// depend on whether the task is still in the list: once an id has been announced it's
// remembered, and it's only allowed to be announced again once it "revives" into a running
// state (the same id reused for a new round of the task) — the same reset signal as the
// store side's 5s expiry timer's own "running cancels the timer."
const announcedTaskIds = new Set<string | number>()

function onTaskProgress(_props: unknown, raw: unknown) {
  const payload = unwrapTaskBusPayload(raw)
  if (!payload || payload.id == null) return
  if (payload.status === 'running') {
    announcedTaskIds.delete(payload.id)
  }
  store.ingestTaskBus(raw)
  if (payload.status === 'done' && !announcedTaskIds.has(payload.id)) {
    announcedTaskIds.add(payload.id)
    const merged = store.tasks.find((task) => task.id === payload.id) || payload
    doneCoalescer.push(merged)
  }
}

// Socket.io reconnects (initial connect too) can miss task.progress events
// while disconnected; re-sync on every 'connect' (Vue2 PhotosTimeline:78-82).
function onSocketConnect() {
  void store.fetchTasks()
  void store.fetchIndexStatus()
  void store.fetchTimeline()
}

const unsubs: Array<() => void> = []

onMounted(() => {
  store.fetchTimeline()
  store.startIndexPoll()
  store.fetchTasks()
  // Task 10: reconcile the favorites state on the timeline's first screen — if the user
  // hasn't opened the lightbox/favorites view yet this session, the per-tile star
  // (PhotosGrid) will all render outlined (falsely reporting "not favorited") because the
  // favorites store's favIds hasn't been fetched yet. Force a reconcile here so the stars
  // are already correct the moment the timeline loads.
  usePhotosFavorites().reconcileFavIds()
  unsubs.push(bus.on('nimoos.photos.task.progress', onTaskProgress))
  unsubs.push(bus.on('connect', onSocketConnect))
})
onUnmounted(() => {
  store.stopIndexPoll()
  unsubs.forEach((off) => off())
  doneCoalescer.cancel()
})
</script>

<template>
  <div class="photos-root" :class="themeClass">
    <div class="app" :data-collapsed="collapsed" :data-selecting="selected.length > 0">
      <!-- PhotosSidebar's own floating drawer-trigger
           button is suppressed here — PhotosTopbar's collapse-toggle button already delegates
           to the same drawer on a narrow viewport (see onToggleCollapse above), so rendering
           both would be a redundant double affordance on this one page. Every other
           photos-area page has no topbar and needs the sidebar's own trigger. -->
      <PhotosSidebar :collapsed="collapsed" hide-drawer-trigger />
      <main class="main">
        <PhotosTopbar :collapsed="collapsed" show-ask-nimo @toggle-collapse="onToggleCollapse" @search-submit="onSearchSubmit" @ask-nimo="useAskNimo().openDrawer()" />
        <div class="photos-main">
          <p v-if="store.loading" class="photos-loading">{{ t('photosTitle') }}…</p>
          <template v-else>
            <PhotosToolbar
              :tab="tab" :density="density" :count="filteredCount"
              @update:tab="tab = $event" @update:density="density = $event"
            >
              <template #after-tabs>
                <!-- The facet source is allPhotos, not gridMonths — otherwise, once a given
                     year gets filtered out, that year disappears from the dropdown and can
                     never be selected again (Vue2's own facet source is likewise
                     displayMonths, not gridMonths).
                     This comment used to say "always the whole library," which doesn't hold
                     in bucket mode — allPhotos flattens `months`, and in bucket mode an
                     unloaded month's photos is always an empty array, so the facet list only
                     covers **already-loaded buckets** and grows as the user scrolls. The
                     behavior itself is a registered limitation (spec §5.1, the real fix is
                     backend-side filtering) — this just corrects the comment to match
                     reality. -->
                <PhotosFilterBar v-model:filter="exifFilter" :photos="store.allPhotos" />
              </template>
            </PhotosToolbar>
            <!-- Task 7 (D19): the floating selectbar moves off being PhotosToolbar's
                 preceding sibling (P1 layout) and mounts INSIDE the grid slot instead — Vue2
                 pixel parity has `.selectbar` `position:absolute` anchored to the grid/scrubber
                 area it floats over (the Vue 2 panel's PhotosGrid.vue:109), not the toolbar row above
                 it. `.photos-grid-slot` is already `position: relative` (see this file's
                 style block below), so no extra positioning container is needed. -->
            <div class="photos-grid-slot">
              <PhotosSelectionToolbar
                v-if="selected.length"
                :count="selected.length"
                @clear="cancelSelection"
                @delete="onBatchDelete([...selected])"
                @add-to-album="openAlbumPicker([...selected])"
                @ask-nimo="useAskNimo().openWith(t('photosGridAskNimoRecap', { count: selected.length }))"
              />
              <PhotosGrid
                :months="gridMonths" :tab="tab" :density="density" :selected="selected"
                @open="onOpenTile"
                @toggle-select="toggleSelect"
                @need-bucket="(k: string) => store.fetchBucket(k)"
              />
            </div>
          </template>
        </div>
      </main>
    </div>

    <!-- Same lesson class as elsewhere, now found on the
         timeline page too: AlbumPickerDialog used to be a template-root SIBLING of
         `.photos-root` (a Vue 3 multi-root fragment) rather than its DOM descendant — the same
         root cause as the "New album" modal bug and the detail-page
         dialogs' issue, just never audited on this page until now.
         Its own parity styling is written as `.photos-root .album-picker-panel` etc.
         (vue2-parity/photos.scss:1072-1102) and its panel background is `var(--surface-2)` — a
         `.photos-root`-local custom property with NO fallback and no global (theme.css)
         definition at all, so outside `.photos-root` it resolves to nothing: the add-to-album
         picker panel likely rendered with a fully transparent background over the fixed dark
         scrim, not merely "wrong colour." Moved back inside `.photos-root`, as a sibling of
         `.app` (matching Vue2's own single-shell nesting and the F1/F2 precedent) — it is
         `position: fixed`, so nesting it inside the scrolling column buys nothing either way,
         and `.photos-root` itself sets no transform/filter/perspective/`contain` that would
         create a new containing block for `position: fixed` (same reasoning already verified in
         F1/F2).
         PhotosToastHost is NOT moved: it Teleports to `<body>` and re-applies `photos-root` +
         `themeClass` on its own portal target by design (see its own header comment and the
         comment just below) — moving its mount point in the template would not change where it
         actually renders, so there is nothing to fix there; it stays a sibling of `.photos-root`
         as it always was. -->
    <AlbumPickerDialog v-model:open="pickerOpen" :asset-ids="pickerIds" @added="onAlbumAdded" />
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
  <!-- Task 8: Photos-private toast queue (delete/Undo) — mounted once per photos view,
       Teleports to <body> (see PhotosToastHost.vue). -->
  <PhotosToastHost />
</template>

<style scoped>
/* Starting with Task 3, the outer height cap is no longer this file's `.photos-layout` rule's
   job (that rule has been deleted, and the class name no longer appears anywhere in this
   file's source — photosLayoutHeightCap.test.ts's CAPPED list has been updated to drop
   Photos.vue accordingly, see that file's own comment). The cap is now carried by the Vue2
   structure's `.app` grid itself (parity scss photos.scss:116-128's
   `height: 100vh; overflow: hidden`). */
/* New-UI mobile enhancement (Vue2 has no responsive drawer here — PhotosSidebar.vue's own
   file-header comment registers this deviation): once the sidebar switches into is-drawer
   mode (position:fixed, taken out of grid flow) at ≤768px, collapse `.app`'s sidebar column
   too, so `.main` doesn't leave a dead var(--sidebar-w) gutter where the now-floating sidebar
   used to sit. Parity scss only defines the two-column desktop grid; this override is
   New-UI-only and lives here rather than in the shared stylesheet. */
@media (max-width: 768px) {
  .app { grid-template-columns: 1fr; }
}

/* `.photos-main`/`.photos-loading`/`.photos-grid-slot`: content-slot styling — now a sibling
   of `<PhotosTopbar>` under `main.main` (Task 4 moved the topbar out to be `.photos-main`'s
   preceding sibling, matching Vue2's `<main class="main"><PhotosTopbar/><content/></main>`
   structure), instead of wrapping the search bar itself as it did through Task 3.
   `align-self: stretch` is a harmless leftover from the old flex-row parent (`.photos-main`'s
   former sibling was `.photos-sidebar`); `main.main`'s default grid `align-items: stretch`
   already does the same job.
   `.photos-summary` (Task 4): the standalone full-library count line moved into
   `PhotosTopbar.vue`'s `.topbar-sub` — no longer rendered here, rule deleted with it. */
.photos-main { position: relative; flex: 1 1 auto; min-width: 0; align-self: stretch; display: flex; flex-direction: column; min-height: 0; }
.photos-loading { color: var(--fg-muted, #9aa4bf); font-size: 14px; padding: 20px 0; }
.photos-grid-slot { position: relative; flex: 1 1 auto; min-height: 0; }
</style>
