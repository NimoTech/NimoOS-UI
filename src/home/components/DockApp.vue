<template>
  <button class="dock-app" :data-app="appKey" @click="onClick">
    <span class="dock-ic" :class="meta?.icon ? 'has-img' : meta?.cls">
      <img v-if="meta?.icon" :src="meta.icon" alt="" loading="lazy" />
      <span v-else v-html="glyphSvg" />
    </span>
    <span class="dock-label">{{ meta?.name ?? appKey }}</span>
  </button>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useAppsStore } from '../stores/apps'
import { useOpenAction } from '../composables/useOpenAction'
const props = defineProps<{ appKey: string }>()
const apps = useAppsStore()
const { openApp } = useOpenAction()
const meta = computed(() => apps.app(props.appKey))
const glyphSvg = computed(() => meta.value?.glyph ? `<svg class="icon" viewBox="0 0 24 24">${meta.value.glyph}</svg>` : '')
function onClick() { openApp(props.appKey) }
</script>
<style scoped>
.dock-app { background: none; border: 0; color: inherit; display: flex; flex-direction: column; align-items: center; gap: 2px; cursor: pointer; padding: 0; }
.dock-ic { width: calc(var(--app-size, 48px) * var(--mag, 1)); height: calc(var(--app-size, 48px) * var(--mag, 1)); display: grid; place-items: center; background: rgba(255,255,255,.1); border-radius: 24%; transition: width .08s, height .08s; transform-origin: bottom; }
.dock-ic.has-img { background: none; }
.dock-ic img { width: 100%; height: 100%; object-fit: cover; border-radius: 24%; }
.dock-ic :deep(svg) { width: 58%; height: 58%; fill: none; stroke: currentColor; stroke-width: 1.6; }
.dock-label { font-size: 10px; opacity: .7; max-width: 64px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
