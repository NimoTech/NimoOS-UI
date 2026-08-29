<template>
  <div v-if="!store.list.length" class="event">
    <span class="ei" v-html="evIcon" />
    <div><b>{{ t('widgetEventsEmpty') }}</b><s>{{ t('widgetEventsEmptyHint') }}</s></div>
  </div>
  <div v-for="e in shown" v-else :key="e.uuid" class="event">
    <span class="ei" v-html="`<svg class='icon' viewBox='0 0 24 24'>${e.icon}</svg>`" />
    <div><b>{{ e.title }}</b><s>{{ relTime(e.ts) }}</s></div>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { LayoutItem } from '../../grid/types'
import { useEventsStore } from '../../stores/events'
import { relTime } from '../../util/format'
import { WIDGETS } from '../../widgets/registry'
const props = defineProps<{ item: LayoutItem }>()
const { t } = useI18n()
const store = useEventsStore()
const evIcon = `<svg class='icon' viewBox='0 0 24 24'>${WIDGETS.events.icon}</svg>`
const shown = computed(() => store.list.slice(0, Math.max(1, Math.min(store.list.length, props.item.h))))
</script>
<style scoped>
/* base.css:227-233 — events widget (w-events mapping: WidgetCard adds .w-events on .card) */
/* .card.w-events .card-in gap is set globally in theme; here we handle interior elements */
.event { display: grid; grid-template-columns: auto 1fr; gap: 10px; }
.ei { display: grid; place-items: center; width: clamp(22px, 11cqmin, 30px); height: clamp(22px, 11cqmin, 30px); border-radius: 9px; background: var(--inner-bg); color: var(--accent2); }
.ei :deep(.icon) { width: 54%; height: 54%; }
.event b { font-size: clamp(11px, 5.5cqmin, 14px); font-weight: 600; }
.event s { text-decoration: none; display: block; margin-top: 2px; font-size: clamp(10px, 5cqmin, 13px); color: var(--fg-faint); font-family: var(--num-font, inherit); }
</style>
