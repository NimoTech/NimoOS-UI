<script setup lang="ts">
import { computed } from 'vue'
import FavoriteStar from './FavoriteStar.vue'

const props = defineProps<{ virtualPath: string; currentRealPath: string }>()
const emit = defineEmits<{ (e: 'navigate', virtualPath: string): void }>()

interface Seg { label: string; vpath: string }
const segments = computed<Seg[]>(() => {
  const parts = props.virtualPath.replace(/^\/+/, '').split('/').filter(Boolean)
  const segs: Seg[] = []
  let acc = ''
  for (const p of parts) {
    acc += '/' + p
    segs.push({ label: p, vpath: acc })
  }
  return segs
})
const lastName = computed(() => (segments.value.length ? segments.value[segments.value.length - 1].label : ''))
</script>

<template>
  <nav class="breadcrumb">
    <template v-for="(seg, i) in segments" :key="seg.vpath">
      <span v-if="i > 0" class="crumb-sep">›</span>
      <button class="crumb" :class="{ current: i === segments.length - 1 }" @click="emit('navigate', seg.vpath)">{{ seg.label }}</button>
    </template>
    <FavoriteStar v-if="currentRealPath && lastName" class="crumb-star" :path="props.currentRealPath" :name="lastName" />
  </nav>
</template>

<style scoped>
.breadcrumb { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; min-width: 0; }
.crumb { background: none; border: none; cursor: pointer; color: var(--fg-muted, #9aa4bf); font-size: 14px; padding: 2px 4px; border-radius: 6px; }
.crumb:hover { background: var(--chip-bg, rgba(255,255,255,0.06)); color: var(--fg); }
.crumb.current { color: var(--fg); font-weight: 600; }
.crumb-sep { color: var(--fg-muted, #9aa4bf); font-size: 12px; }
.crumb-star { margin-left: 4px; }
</style>
