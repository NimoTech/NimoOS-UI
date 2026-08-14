<script setup lang="ts">
import { computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useSidebarDrawer } from '../../composables/useSidebarDrawer'
import { useTimelineStore } from '../stores/timeline'
import { usePhotosSettingsStore } from '../stores/settings'
import { renderSize } from '../../files/util/format'
import { activeNavId } from '../util/activeNavId'

const router = useRouter()
const route = useRoute()
const { t } = useI18n()
const timeline = useTimelineStore()
// P8a-T6 (§7e-15): sidebar is a shared component for all pages in the photos area, pulls aiFeatures config once to decide whether to
// hide smart-views entry. store is a singleton; mounting in the same frame as any view's onMounted concurrently calls
// fetchAiFeatures() — concurrent deduplication is handled in settings.ts (see that file's fetchAiFeatures header comment),
// we just call it here, don't need to worry about dedup details.
const settings = usePhotosSettingsStore()
onMounted(() => { void settings.fetchAiFeatures() })

// Drawer state: must destructure (nested ref in templates won't auto-unwrap; drawer.isNarrow as always-true value is a trap) — same as FilesSidebar.
const { isNarrow, open: drawerOpen, close: closeDrawer } = useSidebarDrawer()

// Drawer auto-closes after any route change; on desktop close is no-op.
watch(() => route.fullPath, () => closeDrawer())

// ESC closes drawer, only listen when open on narrow screen.
function onDrawerKeydown(e: KeyboardEvent) { if (e.key === 'Escape') closeDrawer() }
watch(drawerOpen, (o) => {
  if (o) document.addEventListener('keydown', onDrawerKeydown)
  else document.removeEventListener('keydown', onDrawerKeydown)
})
onUnmounted(() => document.removeEventListener('keydown', onDrawerKeydown))

// Navigation entry registry.
const NAV_ALL = [
  { id: 'library', route: '/photos', labelKey: 'photosLibrary' },
  { id: 'albums', route: '/photos/albums', labelKey: 'photosAlbums' },
  { id: 'people', route: '/photos/people', labelKey: 'photosPeople' },
  { id: 'places', route: '/photos/places', labelKey: 'photosPlaces' },
  // SP7-P7a-T4: inserted after places, before favorites, following Vue2 PhotosSidebar.vue:114-118 order
  // (library / albums / people / places / smart). 7 items (was 6), favorites/trash indices each +1.
  // SP15-P2b (Vue2 939a7d3a: PhotosSidebar.vue:118): the page behind this entry is now a
  // Moments-only "For You" page -- the smart albums moved into Albums. Only the label
  // changes; id and route stay so the ?view=smart deep link and the hide-when-off filter
  // keep working.
  { id: 'smart-views', route: '/photos/smart-views', labelKey: 'photosMoForYou' },
  { id: 'favorites', route: '/photos/favorites', labelKey: 'photosFavorites' },
  { id: 'trash', route: '/photos/trash', labelKey: 'photosTrash' },
]

// P8a-T6 (§7e-15): Vue2 PhotosSidebar.vue:120-122 — when `ai.smartview === false`
// `items.filter(i => i.id !== 'smart')`. Criterion must be `=== false`, not `!x`: aiFeatures.
// smartview default and fallback for 'fetch failure/field missing' are both `true`; only hide this entry when backend explicitly turns it off —
// config jitter/request failure shouldn't make navigation entries disappear, scaring users into thinking features vanished.
const NAV = computed(() =>
  settings.aiFeatures.smartview === false
    ? NAV_ALL.filter((n) => n.id !== 'smart-views')
    : NAV_ALL,
)

function isActive(n: { id: string }): boolean {
  return activeNavId(route.path, NAV.value) === n.id
}

// Storage bar: usedText = totalBytes human-readable; percent = (diskTotal-diskAvail)/diskTotal, division-by-zero guard.
const usedText = computed(() => renderSize(timeline.indexStatus.totalBytes))
const usedPercent = computed(() => {
  const total = timeline.indexStatus.diskTotal
  if (!total) return 0
  const used = total - timeline.indexStatus.diskAvail
  return Math.min(100, Math.max(0, (used / total) * 100))
})
</script>

<template>
  <div v-if="isNarrow && drawerOpen" class="side-scrim" @click="closeDrawer"></div>
  <aside class="photos-sidebar" :class="{ 'is-drawer': isNarrow, 'is-open': drawerOpen }">
    <!-- Desktop: back home + title merged into sidebar glass panel (AreaShell top bar hides at the same span); narrow screen uses top bar, drawer doesn't repeat -->
    <div v-if="!isNarrow" class="side-top">
      <h1 class="side-app-title">{{ t('photosTitle') }}</h1>
      <button class="bar-btn side-home-btn" type="button" @click="router.push('/')">‹ {{ t('areaBackHome') }}</button>
    </div>
    <section class="side-section">
      <ul class="side-list">
        <li
          v-for="n in NAV" :key="n.id"
          class="side-item" :class="{ active: isActive(n) }"
          @click="router.push(n.route)"
        >
          <span class="side-name">{{ t(n.labelKey) }}</span>
        </li>
      </ul>
    </section>
    <section class="side-section storage-bar">
      <h4 class="side-title">{{ t('photosStorage') }}</h4>
      <div class="storage-bar-track">
        <div class="storage-bar-fill" :style="{ width: usedPercent + '%' }"></div>
      </div>
      <p class="storage-bar-text">{{ usedText }}</p>
    </section>

    <!-- SP7-P8a-T5: settings entry at bottom of sidebar, based on gear button in Vue2 PhotosSidebar.vue:34-35 (over there
         @open-settings emits to a fullscreen overlay with open prop; this repo is real routing, directly
         router.push). Don't change NAV array/existing navigation order — T6 needs the 'smart-views conditional hide'
         to also change NAV, the two don't interfere with each other. -->
    <section class="side-section side-settings">
      <button type="button" class="side-settings-btn" data-test="sidebar-settings-link" @click="router.push('/photos/settings')">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
        <span class="side-name">{{ t('photosSettingsTitle') }}</span>
      </button>
    </section>
  </aside>
</template>

<style scoped>
/* Same shell form as FilesSidebar/AppsSidebar (glass panel + narrow screen drawer). Five-token set copied verbatim. */
.photos-sidebar {
  flex: 0 0 220px; align-self: stretch; box-sizing: border-box;
  display: flex; flex-direction: column; gap: 18px;
  padding: 14px; overflow-y: auto;
  background: var(--panel-bg); border: 1px solid var(--card-border);
  border-radius: var(--radius); box-shadow: var(--panel-shadow);
  backdrop-filter: var(--blur);
}
.side-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.side-home-btn { font-size: 13px; flex: 0 0 auto; }
.side-app-title { font-size: clamp(20px, 1.8vw, 28px); font-weight: 600; margin: 0 0 0 2px; color: var(--fg); }
.side-section { min-width: 0; }
.side-title { font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: var(--fg-muted, #9aa4bf); margin: 0 0 6px; }
.side-list { list-style: none; margin: 0; padding: 0; }
.side-item { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 10px; cursor: pointer; color: var(--fg); }
.side-item:hover { background: var(--chip-bg-hi); }
.side-item.active { background: color-mix(in srgb, var(--accent) 16%, transparent); }
.side-name { flex: 1 1 auto; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.storage-bar { margin-top: auto; } /* Storage bar pushed to bottom of sidebar */
.storage-bar-track { height: 6px; border-radius: 999px; background: var(--chip-bg-hi); overflow: hidden; }
.storage-bar-fill { height: 100%; border-radius: 999px; background: var(--accent); }
.storage-bar-text { margin: 6px 0 0; font-size: 12px; color: var(--fg-muted, #9aa4bf); }

/* Settings entry: directly after storage bar, visually at the very bottom of sidebar. */
.side-settings-btn {
  display: flex; align-items: center; gap: 8px; width: 100%; margin-top: 10px;
  padding: 6px 8px; border: none; border-radius: 10px; background: transparent;
  color: var(--fg); font: inherit; cursor: pointer;
}
.side-settings-btn:hover { background: var(--chip-bg-hi); }

.side-scrim { position: fixed; inset: 0; z-index: 150; background: var(--overlay-bg); }
.photos-sidebar.is-drawer {
  position: fixed; left: 0; top: 0; bottom: 0; z-index: 151; width: 250px;
  padding: 16px; background: var(--card-bg); backdrop-filter: var(--blur);
  border: none; border-right: 1px solid var(--card-border);
  border-radius: 0; box-shadow: none;
  transform: translateX(-105%); transition: transform 0.25s var(--ease);
}
.photos-sidebar.is-drawer.is-open { transform: none; }
@media (prefers-reduced-motion: reduce) { .photos-sidebar.is-drawer { transition: none; } }
</style>
