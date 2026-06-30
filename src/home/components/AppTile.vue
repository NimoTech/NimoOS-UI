<template>
  <div class="app-tile">
    <span v-if="meta?.icon" class="app-ic has-img"><img :src="meta.icon" alt="" loading="lazy" /></span>
    <span v-else class="app-ic" v-html="glyphSvg" />
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
.app-tile { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; height: 100%; }
.app-ic { width: var(--app-size, 48px); height: var(--app-size, 48px); display: grid; place-items: center; background: rgba(255,255,255,.08); border-radius: 22%; }
.app-ic.has-img { background: none; }
.app-ic :deep(svg) { width: 60%; height: 60%; fill: none; stroke: currentColor; stroke-width: 1.6; }
.app-ic img { width: 100%; height: 100%; object-fit: cover; border-radius: 22%; }
.app-label { font-size: 11px; opacity: .85; text-align: center; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
