<template>
  <div class="mobile-home">
    <section v-if="widgets.length" class="m-widgets">
      <div v-for="it in widgets" :key="it.id" class="m-widget" :style="{ aspectRatio: `${it.w} / ${it.h}` }">
        <WidgetCard :item="it" />
      </div>
    </section>
    <section v-if="tiles.length" class="m-tiles">
      <button
        v-for="it in tiles" :key="it.id"
        class="m-tile" :class="[`kind-${it.kind}`, { 'm-photo': it.kind === 'photo' }]"
        @click="openItem(it)"
      >
        <AppTile v-if="it.kind === 'app'" :item="it" />
        <FolderTile v-else-if="it.kind === 'folder'" :item="it" />
        <PhotoTile v-else :item="it" />
      </button>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useLayoutStore } from '../stores/layout'
import { linearizeLayout } from '../grid/linearize'
import { useOpenAction } from '../composables/useOpenAction'
import WidgetCard from './widgets/WidgetCard.vue'
import AppTile from './AppTile.vue'
import FolderTile from './FolderTile.vue'
import PhotoTile from './PhotoTile.vue'

// Mobile read-only launcher: widgets full-width stacked vertically + icons in 4-column flow, order follows desktop visual order.
// See docs/superpowers/specs/2026-07-18-mobile-home-launcher-design.md
const layout = useLayoutStore()
const { openItem } = useOpenAction()

const ordered = computed(() => linearizeLayout(layout.items))
const widgets = computed(() => ordered.value.filter((i) => i.kind === 'widget' || i.kind === 'appwidget'))
const tiles = computed(() => ordered.value.filter((i) => i.kind === 'app' || i.kind === 'folder' || i.kind === 'photo'))

// Mobile has no useGridMeasure to set global --app-size (Dock icon size), CSS fallback 64px is too large on narrow screens;
// press to 52px on mount, clear on unmount (switching back to desktop) to let measure() take over again.
onMounted(() => document.documentElement.style.setProperty('--app-size', '52px'))
onUnmounted(() => document.documentElement.style.removeProperty('--app-size'))
</script>

<style scoped>
/* --cell = column width in 4-column layout (container padding 12×2 + 3 gaps of 12):
   tile internal font-size/spacing/border-radius scale proportionally (theme.css ratio rules), isomorphic with desktop. */
.mobile-home {
  --cell: calc((100vw - 60px) / 4);
  display: flex; flex-direction: column; gap: 18px;
  padding: 12px 12px calc(120px + env(safe-area-inset-bottom)); /* leave space at bottom for Dock */
}
.m-widgets { display: flex; flex-direction: column; gap: 14px; }
.m-widget { width: 100%; max-height: 60vh; }
/* Icon area: row-height = column-width → grid always square; photo tiles span 2×2, dense backfills holes */
.m-tiles {
  display: grid; grid-template-columns: repeat(4, 1fr);
  grid-auto-rows: calc((100vw - 60px) / 4);
  gap: 12px; grid-auto-flow: row dense;
}
.m-tile { padding: 0; border: 0; background: transparent; color: inherit; font: inherit; cursor: pointer; }
.m-photo { grid-column: span 2; grid-row: span 2; }
</style>
