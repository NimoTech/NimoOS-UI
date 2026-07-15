<template>
  <div ref="root" class="aw">
    <iframe
      v-if="src && running && inView && !failed"
      :key="src + retry"
      class="aw-frame"
      :src="src"
      sandbox="allow-scripts allow-same-origin allow-forms"
      referrerpolicy="no-referrer"
      @load="onLoad"
    />
    <div v-else class="aw-fallback">
      <img v-if="app?.icon" class="aw-ic" :src="app.icon" alt="" />
      <span class="aw-msg">{{ running ? t('appWidgetUnavailable') : t('appWidgetNotRunning') }}</span>
      <button v-if="running && failed" class="aw-retry" type="button" @click="onRetry">{{ t('appWidgetRetry') }}</button>
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import type { LayoutItem } from '../../grid/types'
import { useAppsStore } from '../../stores/apps'
import { useThemeStore } from '../../../stores/theme'
import { useInView } from '../../../files/composables/useInView'
import { appWidgetUrl } from '../../util/appWidgetUrl'

const props = defineProps<{ item: LayoutItem }>()
const { t, locale } = useI18n()
const apps = useAppsStore()
const theme = useThemeStore()
const root = ref<HTMLElement | null>(null)
const inView = useInView(root)
const failed = ref(false)
const retry = ref(0)
let timer: ReturnType<typeof setTimeout> | null = null

const app = computed(() => apps.app(props.item.key))
const running = computed(() => app.value?.status === 'running')
const src = computed(() => {
  if (!app.value) return null
  return appWidgetUrl(app.value, {
    host: window.location.hostname,
    origin: window.location.origin,
    theme: theme.theme === 'light' ? 'light' : 'dark', // blue 主题映射 dark
    lang: String(locale.value),
  })
})

function armTimeout() {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => { failed.value = true }, 8000)
}
function onLoad() { if (timer) { clearTimeout(timer); timer = null } }
function onRetry() { failed.value = false; retry.value++ }

watch([src, inView, running, retry], ([s, v, r]) => {
  if (s && v && r && !failed.value) {
    armTimeout()
  } else {
    if (timer) { clearTimeout(timer); timer = null }
    if (!r) failed.value = false
  }
}, { immediate: true })
onBeforeUnmount(() => { if (timer) clearTimeout(timer) })
</script>
<style scoped>
.aw { width: 100%; height: 100%; display: flex; }
.aw-frame { flex: 1; border: 0; border-radius: var(--radius-sm); background: transparent; }
.aw-fallback { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; }
.aw-ic { width: 36px; height: 36px; border-radius: 10px; opacity: 0.7; }
.aw-msg { color: var(--fg-muted); font-size: 13px; }
.aw-retry {
  border: 1px solid var(--border); background: transparent; color: var(--fg);
  border-radius: 999px; padding: 3px 14px; font-size: 12px; cursor: pointer;
}
.aw-retry:hover { border-color: var(--accent); color: var(--accent); }
</style>
