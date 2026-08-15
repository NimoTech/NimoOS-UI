<script setup lang="ts">
// Task 8: Timeline integration -- fills the content area left as a placeholder by T5,
// wires the socket task-progress feed, task-done toast coalescing and batch
// delete. Ports Vue2 NimoOS-UI src/views/Photos/PhotosTimeline.vue's socket
// block (:74-91) and mounted-time coalescer wiring (:315-335), simplified per
// task-8-brief.md's P1 scope cut:
//  - non-'index' task types get a generic `{label} completed` toast
//    (photosTaskCompletedToast) instead of Vue2's per-type messages.
//  - no 5s pre-removal delay before announcing — a status:'done' transition
//    observed at ingest time goes straight into the coalescer.
// Task 9: Lightbox integration (P2 wrap-up) -- tile `open` is no longer an empty handler: builds
// the current tab-filtered browsing set (matching what the user sees on the grid; the grid's own
// emitted list is always undefined) and hands it to useLightbox().openAt; PhotoLightbox is
// mounted at the end of the template, and the delete event lands on store.deleteAssets + a
// 4000ms toast (the lightbox already closes itself on confirm, so this doesn't close it again).
// Task 9 (SP7-P4 albums) addition: the selection toolbar's batch "Add to album" and the
// lightbox's single-photo "Add to album" both wire uniformly into AlbumPickerDialog (T5) --
// pickerOpen/pickerIds + openAlbumPicker(ids), @added clears the selection (matching Vue2
// pickAlbum:587-595).
// SP7-P7b-T4: EXIF filter bar wiring -- matches Vue2 PhotosTimeline.vue:142-175's gridMonths.
// FilterBar is mounted into PhotosToolbar's after-tabs slot (T3); the exifFilter state +
// gridMonths derived value + filteredCount/onOpenTile switch to using gridMonths, all three
// sharing the same source (the grid's data source, the top bar's count, the lightbox's
// browsing set).
//
// Task 3 (shell + sidebar re-carve): the root structure changes to Vue2's
// `.photos-root[themeClass] > .app[data-collapsed][data-selecting] > PhotosSidebar + main.main`
// (NimoOS-UI PhotosTimeline.vue:943-956), replacing the old AreaShell + `.photos-layout`
// flex-row shell. The content slot (at the time running from PhotosSearchBar through
// PhotosGrid) stays as-is inside `.photos-main`, just wrapped in one more layer of
// `.app`/`main.main` grid shell.
//
// Task 4 (top bar re-carve, D13): adds `<PhotosTopbar>` under `main.main` as `.photos-main`'s
// **preceding sibling** (matching Vue2 PhotosTimeline.vue:956-971's
// `<main class="main"><PhotosTopbar/><PhotosSearchView v-if=.../>...</main>` structure -- the
// topbar is a direct child of main, not nested inside the content slot's container). The
// `<PhotosSearchBar>` line and the `.photos-summary` count line that used to be inlined right
// after it here both move into PhotosTopbar.vue (title block `.topbar-title`+`.topbar-sub`, the
// sub line = always the full-library count; the search box = the centred `.search` inside
// `.topbar`). `collapsed`'s persisted ref/toggle semantics are unchanged, it just now has a
// real click entry point (the gap left open by T3's report "Concerns" item 4 -- Vue2's own
// collapse button lives right in the top bar, not in AreaShell's hamburger menu; filling it in
// here is exactly Vue2's original location).
// PhotosSearchBar.vue itself is not deleted -- grepping confirms it's still reused by
// `PhotosSearch.vue` (the search results page's own top search box), this file just no longer
// references it.
//
// AreaShell keep-or-drop verdict (brief Step 4): read through AreaShell.vue -- on desktop
// (≥769px) `.area-bar` really is `display:none` (the D13 comment checks out), but `.area-body`
// still carries `padding:20px` and `overflow:auto`, and `.area-shell` wraps another
// `height:100vh` flex-column container around that. This is not "zero visible chrome": in the
// Vue2 pixel baseline the sidebar sits flush against the viewport's left edge (the `.app` grid
// itself is 100vh with no padding), and AreaShell's 20px padding plus the extra flex wrapper
// would push the whole `.app` grid inward, stacking with `.app`'s own `height:100vh` to create a
// double scroll container. So from this task on, Photos.vue drops AreaShell and roots directly
// on `.photos-root` -- matching the existing precedent set by the AI Agent area
// (src/ai/views/AgentPage.vue), a same-shape custom full-page shell that likewise never
// borrows AreaShell.
import '../photos/styles/vue2-parity'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
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
import { useSidebarDrawer } from '../composables/useSidebarDrawer'
import { useTimelineStore } from '../photos/stores/timeline'
import { usePhotosFavorites } from '../photos/stores/favorites'
import { usePhotosTrash } from '../photos/stores/trash'
import PhotosToastHost from '../photos/components/PhotosToastHost.vue'
import { usePhotosToast } from '../photos/composables/usePhotosToast'
import { useToast } from '../stores/toast'
import { useMessageBus } from '../composables/useMessageBus'
import { unwrapTaskBusPayload, type TaskBusPayload } from '../photos/util/taskBus'
import { createTaskDoneCoalescer } from '../photos/util/taskDoneCoalescer'
import { matchesTab } from '../photos/util/tabFilter'
import { applyExifFilters } from '../photos/util/photosFilterUtils'
import type { Photo } from '../photos/util/assetToPhoto'

const { t } = useI18n()
const router = useRouter()
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

// Task 3: sidebar collapse (Vue2 PhotosTimeline.vue's `collapsed` data + the topbar toggle
// button that flips it — the toggle button itself lands with the topbar in T4+; this task
// only owns the persisted state and the `.app[data-collapsed]` wiring). Persisted here
// (not in PhotosSidebar) per the brief's interface contract — the sidebar is a shared
// component mounted by every photos-area page, this state is Photos.vue's own.
const COLLAPSE_KEY = 'nimo_photos_sidebar_collapsed'
const collapsed = ref(localStorage.getItem(COLLAPSE_KEY) === '1')
watch(collapsed, (v) => { localStorage.setItem(COLLAPSE_KEY, v ? '1' : '0') })
// Task 4: the topbar's collapse-toggle button (Vue2 PhotosTopbar's own `☰`, wired at
// PhotosTimeline.vue:965 `@toggle="collapsed = !collapsed"`) — same flip, now reachable.
//
// final-review fix (item 6): on a ≤768px viewport PhotosSidebar renders as its own fixed
// drawer instead of the desktop two-column grid track (useSidebarDrawer — a module
// singleton PhotosSidebar.vue already consumes for its is-narrow/is-drawer/is-open
// classes). Flipping `collapsed` there is a no-op: that flag only ever drives the
// `.app[data-collapsed]` desktop column-width rule, which the drawer isn't part of — so
// the topbar's panelLeft button had no way to open the sidebar on mobile at all (Task 3's
// shell rewrite dropped the old AreaShell hamburger that used to do that job). Route the
// same click to the drawer's own toggle() when isNarrow is true instead.
const { isNarrow: sidebarIsNarrow, toggle: toggleSidebarDrawer } = useSidebarDrawer()
function onToggleCollapse() {
  if (sidebarIsNarrow.value) { toggleSidebarDrawer(); return }
  collapsed.value = !collapsed.value
}

// Default tab: aligned with Vue2 NimoOS-UI src/views/Photos/PhotosTimeline.vue's
// `data() { tab: 'photo' }` — 'all' was an unsanctioned drift introduced during
// the port (SP7-P1 review finding), sanctioned fix.
const tab = ref('photo')

// Task 7 (P8a) + P8b: the deep-link dispatcher -- the composable handles its own onMounted +
// watch internally, this only mounts it once. `?tab` is the only key that needs the host
// page's cooperation (tab is this page's own display filter, not a navigation destination, so
// there's no matching route to jump to), so its write entry point is handed over via hooks;
// every other key lands entirely through the router on its own.
// The mount call sits after `const tab` rather than at the top of setup: the closure only
// actually runs inside onMounted/watch and would never really hit a TDZ, but "referencing a
// binding that isn't declared yet" is an unnecessary hazard, and it's cheaper to just avoid the
// ordering question altogether.
usePhotosDeepLinks({ setTab: (v) => { tab.value = v } })

const density = ref('comfortable')
const selected = ref<Array<string | number>>([])

// P7b-T4: EXIF filter state. Matches Vue2 PhotosTimeline.vue:116's activeFilters, but keeps
// only three facet keys -- Vue2's object also carries placeKey/spotKey, two keys used for spot
// navigation; New-UI's city/spot navigation goes through a separate route page (D6), so those
// two keys have no counterpart in this repo.
const exifFilter = ref<ExifFilterValue>({ years: [], places: [], cameras: [] })

// SP15-P3-T8: is an EXIF filter actually narrowing anything right now? Only
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
// (owner ruling 2026-08-10, spec §5.1 — a registered limitation, not an
// oversight; the real fix is backend-side filtering).
const gridMonths = computed(() =>
  store.months
    .map((m) => ({ ...m, photos: applyExifFilters(m.photos, exifFilter.value) }))
    .filter((m) => m.photos.length > 0 || (m.loaded === false && !exifFilterActive.value)),
)

// Grid does tab-filtering internally; mirror the same predicate here (hoisted
// to photos/util/tabFilter.ts, Fix 3) to feed the toolbar's item count (Vue2
// passed the filtered count, PhotosGrid.vue filteredMonths logic ported at task-7).
// D20 (owner ruling, 2026-08-03): the count shrinks along with the EXIF filter too, matching
// what the user sees.
// (Vue2 passes allPhotos.length, which follows neither the tab nor the filter; New-UI already
// changed it in P1 to follow the tab, a sanctioned deviation -- this folds EXIF into the same
// computed, keeping the same direction.)
const filteredCount = computed(() =>
  gridMonths.value.reduce((sum, m) => sum + m.photos.filter((p) => matchesTab(p, tab.value)).length, 0),
)

// T16 wiring (structure spec 22): the search box always shows (corresponding to Vue2's
// `show-search = isLibraryView` -- New-UI has no "library view / everything else" polymorphic
// shell, the timeline page itself only ever has this one shape, so there's no v-if condition).
// Submit → navigate to /photos/search. An empty string is already blocked inside
// PhotosTopbar.submitSearch (an empty string after trim returns immediately without emitting
// search-submit -- ledger 六-2, owner's ruling), so this handler never receives an empty
// string at all; the `q ? { q } : {}` below is purely defensive (in case some other call path
// passes an empty string in the future, it still won't produce the empty `?q=` query param),
// not a sign that "an empty submit still navigates".
function onSearchSubmit(q: string) {
  router.push({ path: '/photos/search', query: q ? { q } : {} })
}

function toggleSelect(id: string | number) {
  const idx = selected.value.indexOf(id)
  if (idx >= 0) selected.value = selected.value.filter((x) => x !== id)
  else selected.value = [...selected.value, id]
}
function cancelSelection() { selected.value = [] }

// Task 9: the "Add to album" entry point (selection toolbar batch / lightbox single) -- unified through AlbumPickerDialog (T5).
const pickerOpen = ref(false)
const pickerIds = ref<Array<string | number>>([])
function openAlbumPicker(ids: Array<string | number>) {
  pickerIds.value = ids
  pickerOpen.value = true
}
// Matches Vue2 pickAlbum:587-595's ending `this.selected = []` -- clears the selection state
// once the add completes (whether triggered from the toolbar's batch action or the lightbox's
// single photo -- only the batch case ever has a non-empty selected; the single-photo case
// always has an empty array here, so the assignment is a safe no-op).
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
  // The grid itself doesn't know the current tab (its internal filtering is for display, not
  // for the browsing set) -- rebuild the "what the user sees" browsing set here using the same
  // matchesTab predicate, sharing the same data source and predicate as PhotosToolbar's
  // filteredCount.
  // P7b-T4: the browsing set must match exactly what the user sees in the grid: EXIF-filter
  // first (gridMonths), then tab-filter, using the exact same two predicates as filteredCount --
  // otherwise the lightbox could page into a photo that was filtered out.
  const filtered = gridMonths.value.flatMap((m) => m.photos).filter((p) => matchesTab(p, tab.value))
  lb.openAt(photo, filtered, startMs)
}

async function onLightboxDelete(id: string | number) {
  // The lightbox already closes itself when the user confirms delete (see PhotoLightbox.vue's
  // doDelete), so this doesn't close it again.
  const snapshot = [String(id)]
  await store.deleteAssets(snapshot)
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
}

// ─── task-done toast coalescing ───────────────────────────────────────────
// P1 message table: 'index' reports the indexed count (Vue2 taskDoneMessage's
// index branch, PhotosTimeline.vue:720-723); every other type collapses to a
// generic "{label} completed" toast (task-8-brief.md P1 scope cut — Vue2's
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
  // 4000ms, aligned with Vue2's task-done toast duration (NimoOS-UI
  // src/views/Photos/PhotosTimeline.vue:329 `$buefy.toast.open({..., duration: 4000})`).
  emit: (message) => toast.show(message, 4000),
})

// Ingest-time done-transition detection: capture whether this task was
// already 'done' before the store merges the new event in, so a task that
// stays 'done' across repeated events (or re-ingests) is only announced once.
// P8a-T10 fix: this used to check `store.tasks.find(...).status === 'done'` to decide "has this
// already been announced" -- fetchIndexStatus's idle reconciliation (timeline.ts:118-120) drops
// a done index task out of store.tasks, so if a late duplicate done event arrives afterward,
// find returns undefined and the old check mistakenly reads it as "not announced yet", firing a
// second toast. Switched to an id set that doesn't depend on whether the task is still in the
// list: once an id has been announced, remember it, and only allow announcing it again once it
// "comes back to life" in a running state (the same id reused for a new round of the task) --
// the same reset signal as the store side's 5s expiry timer's "running cancels the timer".
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
  // Task 10: reconcile favourite state on the timeline's first screen -- if the user hasn't
  // opened the lightbox or the favourites view this session, the per-tile star (PhotosGrid)
  // will all render as outline-only because the favorites store's favIds hasn't been fetched
  // yet (a false "not favourited" report). Force one reconcile here so the stars are correct
  // the moment the timeline loads.
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
      <PhotosSidebar :collapsed="collapsed" />
      <main class="main">
        <PhotosTopbar :collapsed="collapsed" @toggle-collapse="onToggleCollapse" @search-submit="onSearchSubmit" />
        <div class="photos-main">
          <p v-if="store.loading" class="photos-loading">{{ t('photosTitle') }}…</p>
          <template v-else>
            <PhotosToolbar
              :tab="tab" :density="density" :count="filteredCount"
              @update:tab="tab = $event" @update:density="density = $event"
            >
              <template #after-tabs>
                <!-- The facet source is allPhotos, not gridMonths -- otherwise once a year gets
                     filtered out, that year disappears from the dropdown and can never be picked
                     again (Vue2's facet source is likewise displayMonths, not gridMonths).
                     Whole-branch review fix (minor 11): this comment used to say "always takes
                     the whole library" -- that doesn't hold in bucket mode -- allPhotos flattens
                     `months`, and in bucket mode an unloaded month's photos is always an empty
                     array, so the facet list only covers the **already-loaded buckets**, and
                     grows as the user scrolls. The behaviour itself is a registered limitation
                     (spec §5.1, the real fix is backend-side filtering); this just corrects the
                     comment to match reality. -->
                <PhotosFilterBar v-model:filter="exifFilter" :photos="store.allPhotos" />
              </template>
            </PhotosToolbar>
            <!-- Task 7 (D19): the floating selectbar moves off being PhotosToolbar's
                 preceding sibling (P1 layout) and mounts INSIDE the grid slot instead — Vue2
                 pixel parity has `.selectbar` `position:absolute` anchored to the grid/scrubber
                 area it floats over (NimoOS-UI PhotosGrid.vue:109), not the toolbar row above
                 it. `.photos-grid-slot` is already `position: relative` (see this file's
                 style block below), so no extra positioning container is needed. -->
            <div class="photos-grid-slot">
              <PhotosSelectionToolbar
                v-if="selected.length"
                :count="selected.length"
                @clear="cancelSelection"
                @delete="onBatchDelete([...selected])"
                @add-to-album="openAlbumPicker([...selected])"
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
  </div>
  <!-- Favourite state shares its source with the photosFavorites store (the lightbox already
       calls usePhotosFavorites().toggle() directly internally), so an empty handler here is
       enough, no need to bubble it up further. -->
  <PhotoLightbox
    @delete="onLightboxDelete"
    @toggle-fav="() => {}"
    @add-to-album="(id) => openAlbumPicker([id])"
  />
  <AlbumPickerDialog v-model:open="pickerOpen" :asset-ids="pickerIds" @added="onAlbumAdded" />
  <!-- Task 8: Photos-private toast queue (delete/Undo) — mounted once per photos view,
       Teleports to <body> (see PhotosToastHost.vue). -->
  <PhotosToastHost />
</template>

<style scoped>
/* From Task 3 on, the outer height cap is no longer this file's own `.photos-layout` rule's
   job (that rule is deleted, and the class name no longer appears anywhere in this file's
   source -- photosLayoutHeightCap.test.ts's CAPPED list has Photos.vue removed to match, see
   that file's own comment). The cap is now carried by Vue2's `.app` grid structure itself
   (parity scss photos.scss:116-128 `height: 100vh; overflow: hidden`). */
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
