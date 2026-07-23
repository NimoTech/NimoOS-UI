<script setup lang="ts">
// Ported (Options API -> <script setup> Composition API, logic unchanged) from
// Vue2 NimoOS-UI src/views/Photos/PhotosToolbar.vue (49 lines).
// P1 scope cut (task-7-brief.md): no EXIF-filter `after-tabs` slot, no icon
// library — tabs/density buttons render as plain text with i18n labels.
import { useI18n } from 'vue-i18n'

const props = withDefaults(defineProps<{
  tab?: string
  density?: string
  count?: number
}>(), {
  tab: 'all',
  density: 'comfortable',
  count: 0,
})

const emit = defineEmits<{
  (e: 'update:tab', v: string): void
  (e: 'update:density', v: string): void
}>()

const { t } = useI18n()

function setTab(v: string) { emit('update:tab', v) }
function setDensity(v: string) { emit('update:density', v) }
</script>

<template>
  <div class="photos-toolbar">
    <div class="tabs">
      <button class="tab" :data-active="props.tab === 'all'" @click="setTab('all')">{{ t('photosTabAll') }}</button>
      <button class="tab" :data-active="props.tab === 'photo'" @click="setTab('photo')">{{ t('photosTabPhotos') }}</button>
      <button class="tab" :data-active="props.tab === 'ocr'" @click="setTab('ocr')">{{ t('photosTabOcr') }}</button>
      <button class="tab" :data-active="props.tab === 'video'" @click="setTab('video')">{{ t('photosTabVideos') }}</button>
    </div>
    <div style="flex:1"></div>
    <span class="muted-text">{{ t('photosItemsCount', { count: props.count.toLocaleString() }) }}</span>
    <div class="density">
      <button
        :data-active="props.density === 'compact'" @click="setDensity('compact')"
        :title="t('photosDensityCompact')"
      >{{ t('photosDensityCompact').slice(0, 1) }}</button>
      <button
        :data-active="props.density === 'comfortable'" @click="setDensity('comfortable')"
        :title="t('photosDensityComfortable')"
      >{{ t('photosDensityComfortable').slice(0, 1) }}</button>
      <button
        :data-active="props.density === 'loose'" @click="setDensity('loose')"
        :title="t('photosDensityLoose')"
      >{{ t('photosDensityLoose').slice(0, 1) }}</button>
    </div>
  </div>
</template>

<style scoped>
.photos-toolbar {
  display: flex; align-items: center; gap: 10px; padding: 8px 4px;
  color: var(--fg);
}
.tabs { display: flex; gap: 4px; }
.tab {
  display: flex; align-items: center; gap: 5px; padding: 5px 12px;
  border-radius: var(--chip-radius); border: 1px solid transparent;
  background: transparent; color: var(--fg-muted); cursor: pointer; font-size: 13px;
}
.tab:hover { background: var(--chip-bg); }
.tab[data-active="true"] { background: var(--chip-bg-hi); color: var(--fg); border-color: var(--chip-border); }
.muted-text { font-size: 12px; color: var(--fg-muted); white-space: nowrap; }
.density { display: flex; gap: 2px; padding: 2px; border-radius: var(--chip-radius); background: var(--chip-bg); }
.density button {
  width: 26px; height: 24px; border: none; border-radius: 999px; background: transparent;
  color: var(--fg-muted); cursor: pointer; font-size: 11px; font-weight: 600; text-transform: uppercase;
}
.density button[data-active="true"] { background: var(--accent); color: var(--on-accent); }
</style>
