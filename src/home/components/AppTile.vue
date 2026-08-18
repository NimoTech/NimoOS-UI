<template>
  <div class="app-tile" :class="{ stopped: store.isStopped(item.key) }">
    <span
      v-if="meta?.icon && !imgFailed"
      class="app-ic has-img"
      :class="meta?.cls || 'ic-app'"
    ><img :src="meta.icon" alt="" loading="lazy" @error="imgFailed = true" /></span>
    <span
      v-else
      class="app-ic"
      :class="meta?.cls || 'ic-app'"
      v-html="glyphSvg"
    />
    <span class="app-label">{{ displayName }}</span>
  </div>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { LayoutItem } from '../grid/types'
import { useAppsStore } from '../stores/apps'

const props = defineProps<{ item: LayoutItem }>()
// Bad icon URL (404/domain missing) falls back to default glyph; retry loading when icon changes to new value
const imgFailed = ref(false)
const store = useAppsStore()
const { t } = useI18n()
const meta = computed(() => store.app(props.item.key))
watch(() => meta.value?.icon, () => { imgFailed.value = false })
// System apps store an i18n key in `name`; container apps store a literal title.
const displayName = computed(() => {
  const m = meta.value
  if (!m) return props.item.key
  return m.system ? t(m.name) : m.name
})
const BAG = '<path d="M5.5 8h13l-1 11.2a2 2 0 0 1-2 1.8H8.5a2 2 0 0 1-2-1.8Z"/><path d="M8.5 8a3.5 3.5 0 0 1 7 0"/>'
const glyphSvg = computed(() => `<svg class="icon" viewBox="0 0 24 24">${meta.value?.glyph || BAG}</svg>`)
</script>
<style scoped>
/* kind-app flex column layout lives in global theme.css (.kind-app rule) */
/* gap/font-size scale with --cell proportionally (anchored to 108px comfort grid: font-size 16.7/108≈0.155), grid scales arbitrarily with shape unchanged — proportional to theme.css .kind-app/.app-label */
.app-tile { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: calc(var(--cell, 92px) * 0.046); height: 100%; }
.app-tile.stopped { opacity: 0.45; filter: grayscale(0.6); }
/* .app-ic sizing: global theme.css provides border-radius/shadow/color via .app-ic rule;
   here we set width/height for the within-tile context (kind-app .app-ic is flex:1 1 auto globally) */
.app-ic { display: grid; place-items: center; width: 100%; height: 100%; border-radius: var(--icon-radius, 31%); color: #fff; /* theme-exception: icon glyph on colored gradient, must be white for contrast */ box-shadow: var(--icon-shadow); }
.app-ic :deep(svg) { width: 44%; height: 44%; fill: none; stroke: currentColor; stroke-width: 1.6; }
/* has-img: overflow+background handled globally; local transition kept for smooth load */
.app-label { flex: 0 0 auto; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: center; font-size: max(11px, calc(var(--cell, 92px) * 0.155)); font-weight: 500; line-height: 1.25; color: var(--label-color, var(--fg)); text-shadow: var(--label-shadow, none); }
</style>
