<script setup lang="ts">
// Task 3 (shell + sidebar re-skin): re-skinned to the Vue2 pixel baseline (the Vue 2 panel's
// src/views/Photos/PhotosSidebar.vue:1-93). Structure/classes transcribed
// verbatim (.sidebar/.sidebar-head/.nav-section/.nav-item/.nav-label/
// .sidebar-foot/.storage-mini*, collapsed → centered brand-icon + icon-btn
// column) — styling for all of it lives in the shared parity stylesheet
// (photos/styles/vue2-parity/photos.scss:104-260), scoped under `.photos-root`.
//
// Script-level logic is NOT ported from Vue2's local `activeNav` prop/emit
// model — this repo already gave every nav entry a real vue-router route
// (SP7-P7a-T4's NAV table + activeNavId()), a sanctioned deviation predating
// this task. That routing plumbing (NAV table, isActive-by-route, storage
// usedPercent, router.push, the aiFeatures smartview-hide filter, the mobile
// drawer via useSidebarDrawer) is kept as-is; only the template/classes and
// the two things Vue2 actually owns here — the theme toggle and the
// collapsed prop — are new.
//
// Deviation (registered per brief): Vue2 has no responsive drawer for this
// sidebar at all — collapsing to the 56px icon rail is its only concession to
// narrow viewports, at any width. New-UI's mobile drawer (is-narrow → fixed
// overlay + scrim, closes on route change/ESC/backdrop click) predates this
// task and is kept as a New-UI-only enhancement; the parity scss has no
// opinion on it (it only defines the two-column desktop grid), so the
// drawer's positioning rules stay in this component's own scoped style block.
//
// Plan C Task 2 review fix round 1 (Important 1): the floating `.sidebar-drawer-trigger`
// button below is the same kind of New-UI-only addition — Vue2 never needed one since it has
// no drawer to open. It exists because unwrapping AreaShell from the five re-shelled
// album/for-you views removed their only ≤768px entry point to this drawer (AreaShell's own
// `.area-bar` hamburger). Putting the fix here, on the shared component every photos-area page
// mounts, covers all of them (and any future sister page) in one place instead of wiring a
// topbar-less button onto each view individually. `hideDrawerTrigger` lets Photos.vue opt out
// since its own PhotosTopbar already exposes an equivalent toggle.
//
// IMPORTANT (updated post-a822ef1d, comment count refreshed plan-C task 1 2026-08-13):
// all 14 photos-area pages are now rooted under `.photos-root` (fix commit
// a822ef1d0edaebf6d0dc104ae306316385ec5f1f, "root every photos view under
// photos-root so the shared sidebar keeps its layout"; Plan B has since
// re-skinned the timeline view, `Photos.vue`) — the parity scss above
// reaches every one of them, not just this one. The 7 pages (after acceptance Fix-3 —
// PhotosSearch.vue's own `.app`-grid re-skin landed as part of that owner-acceptance item,
// pulled forward from Plan F, dropping the count from 8) that haven't had their own
// `.app`-grid re-skin yet still carry a transitional `.sidebar { flex: 0 0 var(--sidebar-w) }`
// pin plus the accepted parity-token/theme.css collision (--bg/--accent/--accent-soft/--success
// shadowed to Vue2's values) described in task-3-report.md's token-collision table — a known,
// registered hybrid transitional look, not a missing-styling gap anymore.
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useSidebarDrawer } from '../../composables/useSidebarDrawer'
import { useTimelineStore } from '../stores/timeline'
import { usePhotosSettingsStore } from '../stores/settings'
import { usePhotosFavorites } from '../stores/favorites'
import { usePhotosTrash } from '../stores/trash'
import { usePhotosTheme } from '../composables/usePhotosTheme'
import { useSessionStore } from '../../stores/session'
import { renderSize } from '../../files/util/format'
import { activeNavId } from '../util/activeNavId'
import PhotosIcon from './PhotosIcon.vue'

// `hideDrawerTrigger`: review fix round 1 (Plan C Task 2). Photos.vue's own PhotosTopbar
// already exposes a collapse-toggle button that on a narrow viewport delegates to this same
// drawer (see Photos.vue's onToggleCollapse) — rendering the floating trigger below there too
// would be a redundant second affordance doing the identical thing. Every other photos-area
// page has no topbar of its own, so the floating trigger is their only entry point and must
// render; Photos.vue is the one page that opts out.
withDefaults(defineProps<{ collapsed?: boolean; hideDrawerTrigger?: boolean }>(), {
  collapsed: false,
  hideDrawerTrigger: false,
})

const router = useRouter()
const route = useRoute()
const { t } = useI18n()
const timeline = useTimelineStore()
const favorites = usePhotosFavorites()
const trash = usePhotosTrash()
const session = useSessionStore()

// Task 3: sidebar-head theme toggle (Vue2 PhotosSidebar.vue:27-33's
// `$store.dispatch('photos/toggleTheme')` icon button) — this is Vue2's
// actual toggle location. The Plan A stopgap segmented toggle inside
// PhotosSettings.vue is untouched (a different, pre-existing entry point to
// the same shared usePhotosTheme() singleton; both stay in sync for free).
const photosTheme = usePhotosTheme()
const isLight = computed(() => photosTheme.theme.value === 'light')
function toggleTheme() {
  photosTheme.set(isLight.value ? 'dark' : 'light')
}

// P8a-T6 (§7e-15): the sidebar is a component shared by every page in the photos area, so it
// pulls the aiFeatures config itself once to decide whether to hide the smart-views entry.
// The store is a singleton, so mounting alongside any view's own onMounted in the same frame
// will call fetchAiFeatures() concurrently -- concurrency dedup is handled in settings.ts (see
// that file's fetchAiFeatures header comment); this component just calls it and doesn't need
// to worry about the dedup details.
const settings = usePhotosSettingsStore()
onMounted(() => { void settings.fetchAiFeatures() })

// Task 10 (closing the registered gap in this file's own header comment): fetch trash once
// per app session -- `trash.loaded` (a Pinia singleton flag) guards against every sidebar
// remount firing a fresh request; only the FIRST mount after app start pays this cost, same
// shape as favorites' favIdsLoaded gate.
onMounted(() => { if (!trash.loaded) void trash.fetchTrash() })
// Storage-bar data (timeline.indexStatus) is deliberately NOT fetched here — Photos.vue
// already owns that (fetchIndexStatus/startIndexPoll, Task 8's socket wiring). Unlike Vue2
// (single-page tab-switcher, sidebar mounts once per session), this sidebar remounts on every
// photos-area route change; fetching here too would mean a request on every nav click instead
// of Vue2's one-time cost. Existing behavior, unchanged by this task.

// Drawer state: note this must be destructured (a nested ref doesn't auto-unwrap in the
// template, so drawer.isNarrow being always-truthy is a trap) -- following FilesSidebar's lead.
const { isNarrow, open: drawerOpen, close: closeDrawer, toggle: toggleDrawer } = useSidebarDrawer()

// The drawer auto-closes after any route change; close is a no-op on desktop.
watch(() => route.fullPath, () => closeDrawer())

// ESC closes the drawer; only listened for while it's open on narrow screens.
function onDrawerKeydown(e: KeyboardEvent) { if (e.key === 'Escape') closeDrawer() }
watch(drawerOpen, (o) => {
  if (o) document.addEventListener('keydown', onDrawerKeydown)
  else document.removeEventListener('keydown', onDrawerKeydown)
})
onUnmounted(() => document.removeEventListener('keydown', onDrawerKeydown))

// Nav item registry -- content/order unchanged (already registered by SP7-P7a-T4/SP15-P2b);
// this only adds an `icon` field (Vue2 nav1/nav2's icon name) for the new template to render
// PhotosIcon; the nav1/nav2 split point also follows Vue2 (favorites/trash go to nav2,
// everything else to nav1).
const NAV_ALL = [
  { id: 'library', route: '/photos', labelKey: 'photosLibrary', icon: 'clock' },
  { id: 'albums', route: '/photos/albums', labelKey: 'photosAlbums', icon: 'album' },
  { id: 'people', route: '/photos/people', labelKey: 'photosPeople', icon: 'person' },
  { id: 'places', route: '/photos/places', labelKey: 'photosPlaces', icon: 'map' },
  // SP7-P7a-T4: inserted after places, before favorites, following Vue2
  // PhotosSidebar.vue:114-118's order (library / albums / people / places / smart). 7 items
  // total (was 6), favorites/trash indices each +1.
  // SP15-P2b (Vue2 939a7d3a:PhotosSidebar.vue:118): the page behind this entry is now a
  // Moments-only "For You" page -- the smart albums moved into Albums. Only the label
  // changes; id and route stay so the ?view=smart deep link and the hide-when-off filter
  // keep working.
  { id: 'smart-views', route: '/photos/smart-views', labelKey: 'photosMoForYou', icon: 'sparkles' },
  { id: 'favorites', route: '/photos/favorites', labelKey: 'photosFavorites', icon: 'starOutline' },
  { id: 'trash', route: '/photos/trash', labelKey: 'photosTrash', icon: 'trash' },
]

// P8a-T6 (§7e-15): Vue2 PhotosSidebar.vue:120-122 -- when `ai.smartview === false`,
// `items.filter(i => i.id !== 'smart')`. The check must be `=== false`, not `!x`:
// aiFeatures.smartview's default value and its fallback for "fetch failed/field missing" are
// both `true`; this entry is only hidden when the backend explicitly says it's off -- a
// config-read glitch or failed request shouldn't make a nav entry vanish and scare the user
// into thinking the feature disappeared.
const visibleNav = computed(() =>
  settings.aiFeatures.smartview === false
    ? NAV_ALL.filter((n) => n.id !== 'smart-views')
    : NAV_ALL,
)

// Vue2 nav1/nav2 split (PhotosSidebar.vue:112-131): nav1 is the un-labelled top section,
// nav2 (favorites/trash) sits under the collapsible "Photo library" drawer header.
const nav1 = computed(() => visibleNav.value.filter((n) => n.id !== 'favorites' && n.id !== 'trash'))
const nav2 = computed(() => visibleNav.value.filter((n) => n.id === 'favorites' || n.id === 'trash'))
// Collapsed-state icon column renders both sections flattened, Vue2 `allNav` (:133).
const allNav = computed(() => visibleNav.value)

// Vue2 PhotosSidebar.vue:107 `data() { libraryOpen: true }` — the nav2 drawer starts open.
const libraryOpen = ref(true)

function isActive(n: { id: string }): boolean {
  return activeNavId(route.path, visibleNav.value) === n.id
}

// Favorites count badge (Vue2 nav2 :129 `this.favCount`) — sourced from the favorites store,
// which every photos page already reconciles on mount elsewhere (Task 10, Photos.vue).
// Task 10 (Plan H): trash's badge is now wired the same way as favorites' -- see the
// onMounted guard above. Known remaining deviation: this count is loaded-page-only once the
// backend's 500-row cap kicks in, same limitation the Trash view's own loaded-subset hint
// already discloses.
// Review fix (Task 10 round 2): Vue2 PhotosSidebar.vue:129-131 builds both counts as
// `this.favCount || null` / `this.trashCount || null` -- a falsy 0 collapses to null there, so
// a loaded-but-empty list hides the badge entirely rather than rendering a literal "0". Our
// `!= null` template guard (":47/:73" there, this file's `countFor(n.id) != null` here) only
// catches null/undefined, not 0, so both branches below must fold zero into null themselves to
// match. This applies to favorites too, not just trash -- same pre-existing gap, fixed in the
// same pass since it's the identical shape.
function countFor(id: string): number | null {
  if (id === 'favorites') return favorites.favIdsLoaded && favorites.favIds.size > 0 ? favorites.favIds.size : null
  if (id === 'trash') return trash.loaded && trash.items.length > 0 ? trash.items.length : null
  return null
}

// displayName (Vue2 :134-142) — session store already holds the same localStorage-backed
// `user` object Vue2 read directly; this repo's equivalent.
const displayName = computed(() => session.user?.username || '')

// Storage bar: usedText = totalBytes in human-readable form; percent = (diskTotal-diskAvail)/diskTotal, guarded against division by zero.
const hasStorageInfo = computed(() => timeline.indexStatus.diskTotal > 0)
const usedText = computed(() => renderSize(timeline.indexStatus.totalBytes))
const storagePercent = computed(() => {
  if (!hasStorageInfo.value) return 0
  const total = timeline.indexStatus.diskTotal
  const used = total - timeline.indexStatus.diskAvail
  return Math.min(100, Math.max(0, Math.round((used / total) * 100)))
})

function go(routePath: string) {
  router.push(routePath)
}
</script>

<template>
  <button
    v-if="isNarrow && !drawerOpen && !hideDrawerTrigger"
    type="button"
    class="sidebar-drawer-trigger"
    data-test="sidebar-drawer-trigger"
    :aria-label="t('photosToggleSidebar')"
    @click="toggleDrawer"
  >
    <PhotosIcon name="panelLeft" :size="17" />
  </button>
  <div v-if="isNarrow && drawerOpen" class="side-scrim" @click="closeDrawer"></div>
  <aside class="sidebar" :class="{ 'is-drawer': isNarrow, 'is-open': drawerOpen }">
    <template v-if="collapsed">
      <div class="sidebar-head" style="justify-content:center;padding:0">
        <div class="brand-icon"></div>
      </div>
      <div class="nav-section" style="display:flex;flex-direction:column;align-items:center;gap:2px;padding:10px 0">
        <button
          v-for="n in allNav" :key="n.id"
          class="icon-btn" :data-active="isActive(n)"
          :title="t(n.labelKey)"
          @click="go(n.route)"
        >
          <PhotosIcon :name="n.icon" :size="17" />
        </button>
      </div>
      <div style="flex:1"></div>
    </template>

    <template v-else>
      <div class="sidebar-head">
        <div class="brand-icon"></div>
        <div style="flex:1;min-width:0">
          <div class="brand-name">{{ t('photosTitle') }}</div>
          <div v-if="displayName" class="brand-user">{{ displayName }}</div>
        </div>
        <button
          class="icon-btn"
          :title="isLight ? t('photosSwitchToDarkTheme') : t('photosSwitchToLightTheme')"
          @click="toggleTheme"
        >
          <PhotosIcon :name="isLight ? 'moon' : 'sun'" :size="15" />
        </button>
        <button
          class="icon-btn" :title="t('photosSettingsTitle')"
          data-test="sidebar-settings-link"
          @click="go('/photos/settings')"
        >
          <PhotosIcon name="settings" :size="15" />
        </button>
      </div>

      <div class="nav-section">
        <div
          v-for="n in nav1" :key="n.id"
          class="nav-item" :data-active="isActive(n)"
          @click="go(n.route)"
        >
          <span class="nav-icon"><PhotosIcon :name="n.icon" :size="16" /></span>
          <span>{{ t(n.labelKey) }}</span>
          <span v-if="countFor(n.id) != null" class="nav-count">{{ countFor(n.id) }}</span>
        </div>
      </div>

      <div class="nav-section">
        <div
          class="nav-label"
          style="cursor:pointer;display:flex;align-items:center;gap:4px;user-select:none"
          @click="libraryOpen = !libraryOpen"
        >
          <PhotosIcon
            :name="libraryOpen ? 'chevD' : 'chevR'"
            :size="10"
            color="var(--text-3)"
            :style="{ opacity: 0.65 }"
          />
          <span>{{ t('photosLibrary') }}</span>
        </div>
        <template v-if="libraryOpen">
          <div
            v-for="n in nav2" :key="n.id"
            class="nav-item" :data-active="isActive(n)"
            @click="go(n.route)"
          >
            <span class="nav-icon"><PhotosIcon :name="n.icon" :size="16" /></span>
            <span>{{ t(n.labelKey) }}</span>
            <span v-if="countFor(n.id) != null" class="nav-count">{{ countFor(n.id)!.toLocaleString() }}</span>
          </div>
        </template>
      </div>

      <div style="flex:1"></div>

      <div class="sidebar-foot">
        <div class="storage-mini">
          <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px">
            <span style="color:var(--text-2)">{{ t('photosStorage') }}</span>
            <span v-if="hasStorageInfo" class="storage-mini-usage">
              {{ usedText }} ({{ storagePercent }}%)
            </span>
          </div>
          <div class="storage-mini-bar"><div :style="{ width: storagePercent + '%' }"></div></div>
        </div>
      </div>
    </template>
  </aside>
</template>

<style scoped>
/* Vue2 has no mobile drawer for this sidebar at all (see file-header deviation note) — this
   is a New-UI-only responsive enhancement. Everything else (background, width via the .app
   grid column, nav item look, storage bar, ...) comes from the shared parity stylesheet
   (photos/styles/vue2-parity/photos.scss:104-260), scoped under `.photos-root`. */
/* New-UI-only mobile enhancement (see file-header review-fix comment): floating drawer
   trigger, styled like the other floating affordances in this area (PlacesZoomBar.vue's
   `.map-zoombar` is the closest precedent — same `var(--float-bg)` + blur + `--card-border`
   token combo, token-only per repo convention, no bare color literals). z-index sits below
   the drawer/scrim (151/150): the two conditions are mutually exclusive in the template
   (`!drawerOpen` vs `drawerOpen`), so they never actually overlap, but keeping this one lower
   registers it belongs to "closed" state that content the drawer would otherwise cover. */
.sidebar-drawer-trigger {
  position: fixed; top: 12px; left: 12px; z-index: 149;
  width: 38px; height: 38px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  border: 1px solid var(--card-border); background: var(--float-bg);
  backdrop-filter: var(--blur); color: var(--fg); cursor: pointer;
}
.side-scrim { position: fixed; inset: 0; z-index: 150; background: var(--overlay-bg); }
.sidebar.is-drawer {
  position: fixed; left: 0; top: 0; bottom: 0; z-index: 151; width: 250px;
  transform: translateX(-105%); transition: transform 0.25s var(--ease);
}
.sidebar.is-drawer.is-open { transform: none; }
@media (prefers-reduced-motion: reduce) { .sidebar.is-drawer { transition: none; } }
</style>
