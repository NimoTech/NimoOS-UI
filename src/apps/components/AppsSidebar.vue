<script setup lang="ts">
import { watch, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useSidebarDrawer } from '../../composables/useSidebarDrawer'

const router = useRouter()
const route = useRoute()
const { t } = useI18n()

// Drawer state: must destructure (nested refs are not auto-unwrapped in templates, drawer.isNarrow always being truthy is a trap)
const { isNarrow, open: drawerOpen, close: closeDrawer } = useSidebarDrawer()

// Close drawer automatically when route changes; on desktop, close is a no-op
watch(() => route.fullPath, () => closeDrawer())

function onDrawerKeydown(e: KeyboardEvent) { if (e.key === 'Escape') closeDrawer() }
watch(drawerOpen, (o) => {
  if (o) document.addEventListener('keydown', onDrawerKeydown)
  else document.removeEventListener('keydown', onDrawerKeydown)
})
onUnmounted(() => document.removeEventListener('keydown', onDrawerKeydown))

const nav = [
  { name: 'apps', labelKey: 'appsNavInstalled', to: '/apps' },
  { name: 'apps-store', labelKey: 'appsNavStore', to: '/apps/store' },
  { name: 'apps-custom', labelKey: 'appsNavCustom', to: '/apps/custom' },
  { name: 'apps-sources', labelKey: 'appsNavSources', to: '/apps/sources' },
]

/** Store details (apps-store-detail) also highlight 'App Store'; custom install uses prefix matching reserved for future sub-routes — sub-routes belong to parent nav items */
function isActive(n: { name: string }): boolean {
  const cur = String(route.name ?? '')
  if (n.name === 'apps-store') return cur.startsWith('apps-store')
  if (n.name === 'apps-custom') return cur.startsWith('apps-custom')
  return cur === n.name
}
</script>

<template>
  <div v-if="isNarrow && drawerOpen" class="side-scrim" @click="closeDrawer"></div>
  <aside class="apps-sidebar" :class="{ 'is-drawer': isNarrow, 'is-open': drawerOpen }">
    <!-- Desktop: back home button + title integrated into sidebar glass panel (AreaShell top bar hidden at same time); narrow screens use top bar, no duplication in drawer -->
    <div v-if="!isNarrow" class="side-top">
      <h1 class="side-app-title">{{ t('appsTitle') }}</h1>
      <button class="bar-btn side-home-btn" type="button" @click="router.push('/')">‹ {{ t('areaBackHome') }}</button>
    </div>
    <section class="side-section">
      <ul class="side-list">
        <li
          v-for="n in nav" :key="n.name"
          class="side-item" :class="{ active: isActive(n) }"
          @click="router.push(n.to)"
        >
          <span class="side-name">{{ t(n.labelKey) }}</span>
        </li>
      </ul>
    </section>
  </aside>
</template>

<style scoped>
/* Same shell layout as FilesSidebar (glass panel + narrow-screen drawer). Second occurrence: extract to AreaSidebar during region 3 (SP6). */
.apps-sidebar {
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
.side-list { list-style: none; margin: 0; padding: 0; }
.side-item { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 10px; cursor: pointer; color: var(--fg); }
.side-item:hover { background: var(--chip-bg-hi); }
.side-item.active { background: color-mix(in srgb, var(--accent) 16%, transparent); }
.side-name { flex: 1 1 auto; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.side-scrim { position: fixed; inset: 0; z-index: 150; background: var(--overlay-bg); }
.apps-sidebar.is-drawer {
  position: fixed; left: 0; top: 0; bottom: 0; z-index: 151; width: 250px;
  padding: 16px; background: var(--card-bg); backdrop-filter: var(--blur);
  border: none; border-right: 1px solid var(--card-border);
  border-radius: 0; box-shadow: none;
  transform: translateX(-105%); transition: transform 0.25s var(--ease);
}
.apps-sidebar.is-drawer.is-open { transform: none; }
@media (prefers-reduced-motion: reduce) { .apps-sidebar.is-drawer { transition: none; } }
</style>
