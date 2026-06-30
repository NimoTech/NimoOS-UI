<template>
  <div class="app-tile">
    <span
      v-if="meta?.icon"
      class="app-ic has-img"
      :class="meta?.cls || 'ic-app'"
    ><img :src="meta.icon" alt="" loading="lazy" /></span>
    <span
      v-else
      class="app-ic"
      :class="meta?.cls || 'ic-app'"
      v-html="glyphSvg"
    />
    <span class="app-label">{{ meta?.name ?? item.key }}</span>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import type { LayoutItem } from '../grid/types'
import { useAppsStore } from '../stores/apps'

const props = defineProps<{ item: LayoutItem }>()
const store = useAppsStore()
const meta = computed(() => store.app(props.item.key))
const BAG = '<path d="M5.5 8h13l-1 11.2a2 2 0 0 1-2 1.8H8.5a2 2 0 0 1-2-1.8Z"/><path d="M8.5 8a3.5 3.5 0 0 1 7 0"/>'
const glyphSvg = computed(() => `<svg class="icon" viewBox="0 0 24 24">${meta.value?.glyph || BAG}</svg>`)
</script>
<style scoped>
/* kind-app flex column layout lives in global theme.css (.kind-app rule) */
.app-tile { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 5px; height: 100%; }
/* .app-ic sizing: global theme.css provides border-radius/shadow/color via .app-ic rule;
   here we set width/height for the within-tile context (kind-app .app-ic is flex:1 1 auto globally) */
.app-ic { display: grid; place-items: center; width: 100%; height: 100%; border-radius: var(--icon-radius, 22px); color: #fff; box-shadow: var(--icon-shadow); }
.app-ic :deep(svg) { width: 44%; height: 44%; fill: none; stroke: currentColor; stroke-width: 1.6; }
/* has-img: overflow+background handled globally; local transition kept for smooth load */
.app-label { flex: 0 0 auto; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: center; font-size: clamp(12.5px, 1.05vw, 14.5px); font-weight: 500; line-height: 1.25; color: var(--label-color, var(--fg)); text-shadow: var(--label-shadow, none); }
</style>
