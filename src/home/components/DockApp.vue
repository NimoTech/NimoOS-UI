<template>
  <button class="dock-app" :class="{ 'is-stopped': apps.isStopped(appKey) }" :data-app="appKey" @click="onClick">
    <span class="dock-ic" :class="meta?.icon ? 'has-img' : meta?.cls">
      <img v-if="meta?.icon" :src="meta.icon" alt="" loading="lazy" draggable="false" />
      <span v-else v-html="glyphSvg" />
    </span>
    <span class="dock-label">{{ displayName }}</span>
  </button>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAppsStore } from '../stores/apps'
import { useOpenAction } from '../composables/useOpenAction'
import { useDock } from '../composables/useDock'
const props = defineProps<{ appKey: string }>()
const apps = useAppsStore()
const { t } = useI18n()
const { openApp } = useOpenAction()
const dock = useDock()
const meta = computed(() => apps.app(props.appKey))
// System apps store an i18n key in `name`; container apps store a literal title.
const displayName = computed(() => {
  const m = meta.value
  if (!m) return props.appKey
  return m.system ? t(m.name) : m.name
})
const glyphSvg = computed(() => meta.value?.glyph ? `<svg class="icon" viewBox="0 0 24 24">${meta.value.glyph}</svg>` : '')
function onClick() {
  if (dock.justDragged.value) return // suppress post-drag click
  openApp(props.appKey)
  if (dock.expanded.value) dock.toggleExpanded() // Auto-collapse dock after clicking an app while expanded
}
</script>
<!-- .dock-app / .dock-ic / .dock-label styles live in global theme.css so the
     HomeDock all-apps toggle (outside this component's scope) is styled identically. -->
<style scoped>
/* The dock's own pointer-based drag has to win over the browser's native image
   drag, which otherwise hijacks the gesture: no-drop cursor, and dropping on a
   tab navigates to the icon URL. draggable="false" is not sufficient on its own
   — a text selection re-enables the native drag — so selection is disabled too.
   Same three-part remedy as PhotoImageViewer.vue:221 and ImageViewer.vue. */
.dock-app {
  user-select: none;
  -webkit-user-select: none;
}
.dock-app img {
  -webkit-user-drag: none;
}
</style>

