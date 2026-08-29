<template>
  <main class="home-screen">
    <HomeTopbar @add="addPanel.openLib" />
    <!-- ≤720px: read-only phone launcher; otherwise the desktop grid. Data lifecycle (onMounted below) is independent of the branch -->
    <MobileHome v-if="isMobile" />
    <DesktopContextMenu v-else>
      <GridCanvas ref="canvas" :cell="cell" :gap="gap" :cols="cols" :rows="rows" />
    </DesktopContextMenu>
    <HomeDock ref="dock" :cell="cell" :gap="gap" :cols="cols" :rows="rows" :grid-el="gridEl" />
    <AddPanel :open="addPanel.open.value" :cell="cell" :gap="gap" :cols="cols" :rows="rows" :grid-el="gridEl" @close="addPanel.close" />
    <SearchDialog />
    <StartAppDialog />
  </main>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, watch, computed } from 'vue'
import GridCanvas from '../home/components/GridCanvas.vue'
import MobileHome from '../home/components/MobileHome.vue'
import DesktopContextMenu from '../home/components/DesktopContextMenu.vue'
import HomeTopbar from '../home/components/HomeTopbar.vue'
import HomeDock from '../home/components/HomeDock.vue'
import AddPanel from '../home/components/AddPanel.vue'
import SearchDialog from '../home/components/SearchDialog.vue'
import StartAppDialog from '../home/components/StartAppDialog.vue'
import { useLayoutStore } from '../home/stores/layout'
import { useAppsStore } from '../home/stores/apps'
import { usePhotosStore } from '../home/stores/photos'
import { useHomeUiStore } from '../home/stores/homeUi'
import { useGridMeasure } from '../home/composables/useGridMeasure'
import { useIsMobile } from '../home/composables/useIsMobile'
import { useLiveStats } from '../home/composables/useLiveStats'
import { useEvents } from '../home/composables/useEvents'
import { reconcileGpu } from '../home/composables/reconcileGpu'
import { useAddPanel } from '../home/composables/useAddPanel'
import { useDock } from '../home/composables/useDock'
import { useParallax } from '../home/composables/useParallax'
import { useMessageBus } from '../composables/useMessageBus'
import { createContainerEventHandler, CONTAINER_EVENT, createUninstallEndHandler, APP_UNINSTALL_END } from '../home/containerEventBridge'

const canvas = ref<InstanceType<typeof GridCanvas> | null>(null)
const dock = ref<InstanceType<typeof HomeDock> | null>(null)
const gridEl = ref<HTMLElement | null>(null)
const layout = useLayoutStore()
const apps = useAppsStore()
const photos = usePhotosStore()
const homeUi = useHomeUiStore()
const live = useLiveStats()
const addPanel = useAddPanel({ cols: 12, rows: 8 })
useEvents()

// dockEl points to HomeDock root element for useGridMeasure to read dockTop
const dockEl = computed(() => dock.value?.root ?? null)

const { cols, rows, cell, gap, relayout } = useGridMeasure(gridEl, dockEl)
const isMobile = useIsMobile()
// gridEl is captured only once in onMounted; GridCanvas only mounts when switching back from the phone breakpoint to desktop, so it must be recaptured and re-measured
watch(isMobile, async (mobile) => {
  if (mobile) return
  await nextTick()
  gridEl.value = canvas.value?.gridEl ?? null
  relayout()
})
watch(() => live.gpu, () => reconcileGpu(layout, live))

const DIMS = { cols: 12, rows: 8 } // same fixed grid as useAddPanel (a responsive grid is an existing deferred item)

let onResize: (() => void) | null = null
let stopParallax: (() => void) | null = null
let pollTimer: ReturnType<typeof setInterval> | null = null
let onFocus: (() => void) | null = null
let offContainerEvents: (() => void) | null = null
let offUninstallEvents: (() => void) | null = null
let containerEventBridge: ReturnType<typeof createContainerEventHandler> | null = null

function refreshApps() {
  apps.loadGrid().then(() => {
    useDock().refresh()
    // A confirmed probe failure is a definite "not here" signal, the same class as
    // APP_UNINSTALL_END below -- not the ambiguous "missing from a possibly-flaky
    // grid fetch" that sweepGone's grace period exists for. Evict right away instead
    // of waiting on the sweep: missingSince is an in-memory Map that resets on every
    // page load, so a user who reloads more often than the 45s grace would otherwise
    // never reach removal at all (#125 review finding 1).
    if (apps.kvmAvailable === false) layout.evict('vm', { force: true })
    layout.autoPin(apps.desktopDecls(), DIMS, apps.stoppedDesktopKeys())
    // Unified sweep: uninstalled/removed apps (including manually pinned tiles, LinkApp) have their tiles removed once absent past the full grace period
    layout.sweepGone(Object.keys(apps.apps))
  }).catch((e) => console.warn('[home] appgrid', e))
}

onMounted(async () => {
  layout.loadInitial()
  await nextTick()
  gridEl.value = canvas.value?.gridEl ?? null
  relayout()
  layout.loadServer().then(() => relayout()).catch(() => {})
  onResize = () => relayout()
  window.addEventListener('resize', onResize)
  stopParallax = useParallax().stop

  layout.loadServerSeen().finally(() => refreshApps())
  pollTimer = setInterval(() => { if (!document.hidden) refreshApps() }, 30_000)
  onFocus = () => refreshApps()
  window.addEventListener('focus', onFocus)

  // docker daemon event push: destroy evicts immediately, everything else debounces a refresh (polling still backstops it)
  containerEventBridge = createContainerEventHandler({ evict: (k) => layout.evict(k), refresh: refreshApps })
  offContainerEvents = useMessageBus().on(CONTAINER_EVENT, containerEventBridge.handle)
  // Uninstall complete = an unambiguous app-gone signal: evict immediately (including manually pinned tiles), without waiting for the grace period
  offUninstallEvents = useMessageBus().on(APP_UNINSTALL_END, createUninstallEndHandler({
    evictForce: (k) => layout.evict(k, { force: true }),
    refresh: refreshApps,
  }))

  photos.loadAssets().then(() => layout.bindPhotos(photos.assets.map((a) => a.id))).catch((e) => console.warn('[home] photos', e))
})

onUnmounted(() => {
  if (onResize) window.removeEventListener('resize', onResize)
  if (stopParallax) stopParallax()
  if (pollTimer) clearInterval(pollTimer)
  if (onFocus) window.removeEventListener('focus', onFocus)
  if (offContainerEvents) offContainerEvents()
  if (offUninstallEvents) offUninstallEvents()
  if (containerEventBridge) containerEventBridge.dispose()
})
</script>

<style scoped>
.home-screen { min-height: 100vh; padding: 24px 24px 12px; box-sizing: border-box; }
/* The phone launcher page only scrolls vertically. body has global overflow:hidden (desktop full-screen design),
   so the scroll container must be .home-screen itself: lock its height to the viewport, scroll vertically inside. */
@media (max-width: 720px) {
  .home-screen {
    padding: 12px 8px 0;
    height: 100dvh;
    min-height: 0; /* overrides the desktop's min-height:100vh, otherwise on phone the container gets stretched back to 100vh and the bottom hides behind the browser toolbar */
    overflow-y: auto;
    overflow-x: hidden;
    -webkit-overflow-scrolling: touch;
  }
}
</style>
