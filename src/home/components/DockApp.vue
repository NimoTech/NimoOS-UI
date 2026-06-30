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
import { useDock } from '../composables/useDock'
const props = defineProps<{ appKey: string }>()
const apps = useAppsStore()
const { openApp } = useOpenAction()
const dock = useDock()
const meta = computed(() => apps.app(props.appKey))
const glyphSvg = computed(() => meta.value?.glyph ? `<svg class="icon" viewBox="0 0 24 24">${meta.value.glyph}</svg>` : '')
function onClick() {
  if (dock.justDragged.value) return // suppress post-drag click
  openApp(props.appKey)
}
</script>
<style scoped>
.dock-app {
  display: grid; justify-items: center; gap: 6px;
  border: 0; background: transparent; cursor: pointer; touch-action: none;
}
.dock-ic {
  display: grid; place-items: center;
  width: var(--app-size, 48px); height: var(--app-size, 48px);
  border-radius: var(--icon-radius, 16px); color: #fff; box-shadow: var(--icon-shadow);
  transform-origin: bottom center;
  transform: translateY(calc((var(--mag, 1) - 1) * -12px)) scale(var(--mag, 1));
  transition: transform .14s var(--ease, ease), filter .18s;
}
.dock-ic.has-img { background: none; }
.dock-ic img { width: 100%; height: 100%; object-fit: cover; border-radius: inherit; }
.dock-ic :deep(svg) { width: 58%; height: 58%; fill: none; stroke: currentColor; stroke-width: 1.6; }
.dock-app:hover .dock-ic { filter: brightness(1.08); }
/* label — mapped from prototype span:last-child */
.dock-label {
  max-width: 72px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-size: 11px; color: var(--fg-muted);
}
/* dragging: icon floats fixed, follows pointer */
.dock-app.dock-dragging { position: fixed; z-index: 80; margin: 0; pointer-events: none; }
.dock-app.dock-dragging .dock-ic {
  transform: scale(1.18); filter: brightness(1.08);
  box-shadow: var(--card-shadow-drag, var(--icon-shadow));
  transition: none;
}
</style>
