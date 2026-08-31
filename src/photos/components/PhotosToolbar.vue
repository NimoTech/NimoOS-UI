<script setup lang="ts">
// Ported (Options API -> <script setup> Composition API, logic unchanged) from
// the Vue 2 panel's src/views/Photos/PhotosToolbar.vue (49 lines).
// Initial scope cut: no icon library — tabs/density buttons render as
// plain text with i18n labels. (The `after-tabs` slot was later restored.)
//
// Re-skin pass, done alongside a matching "toolbar + FilterBar re-skin" pass elsewhere:
// 1) Root class name `.photos-toolbar` -> `.toolbar`, so that the
//    `.photos-root .toolbar/.tabs/.tab/.density/.muted-text` rules already ported verbatim
//    into src/photos/styles/vue2-parity/photos.scss (matching Vue2 photos.scss:266-289) take
//    effect directly — the component no longer needs a parallel <style scoped> block of its
//    own (the old one was written in P1 with generic app tokens, whose values/colors don't
//    match Vue2 at all; the parity scss uses .photos-root's own local tokens, matching Vue2's
//    values literally). This component therefore carries no <style> block at all — styling
//    is entirely handed off to the parity scss (on the condition that the host renders under
//    .photos-root, which both the timeline page Photos.vue:272 and the jump-to-library page
//    PhotosPlaceAssets.vue:173 satisfy).
// 2) The initial pass dropped the tab/density icons because "there's no shared icon library" (see
//    the old comment above) — this re-skin restores them too. Following the precedent set by
//    PhotosFilterChip.vue/PhotosFilterBar.vue, this component inlines its own <svg> rather
//    than going through the shared PhotosIcon.vue component (note: PhotosIcon.vue already
//    existed by this point, and several other components were already consuming it — so the "no
//    shared icon library exists in this repo" premise no longer held true by the time this
//    was written; this is the component deliberately continuing to inline icons following an
//    existing precedent, not a lack of a shared component to reach for). The glyphs are
//    copied character-for-character from the Vue 2 panel's src/views/Photos/PhotosIcon.vue's
//    corresponding name branches (album/ocr/video for the tabs, compact/comfort/loose for the
//    three density levels); size/stroke follow Vue2's <photos-icon> call sites (12px for
//    tabs, 14px for density, stroke-width defaulting to 1.6, fill none, color following
//    currentColor so it tracks each .tab/.density button's own text color — matching Vue2's
//    `color` prop default of 'currentColor').
//    Side effect: this closes off the old text-based scheme's problem where
//    `label.slice(0, 1)` couldn't distinguish "Compact" from "Comfortable" in English (both
//    start with "C") — the Chinese labels "紧凑"/"舒适" don't collide on their first
//    character, so this defect was previously only visible in the English UI.
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
  <div class="toolbar">
    <div class="tabs">
      <button class="tab" :data-active="props.tab === 'all'" @click="setTab('all')">{{ t('photosTabAll') }}</button>
      <button class="tab" :data-active="props.tab === 'photo'" @click="setTab('photo')">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M3 14l5-4 4 3 3-2 6 5" /></svg>
        {{ t('photosTabPhotos') }}
      </button>
      <button class="tab" :data-active="props.tab === 'ocr'" @click="setTab('ocr')">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M3 16v3a2 2 0 0 0 2 2h3" /></svg>
        {{ t('photosTabOcr') }}
      </button>
      <button class="tab" :data-active="props.tab === 'video'" @click="setTab('video')">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="13" height="12" rx="2" /><path d="m16 10 5-3v10l-5-3z" /></svg>
        {{ t('photosTabVideos') }}
      </button>
    </div>
    <!-- The EXIF filter bar (funnel icon + inline-expanding chips) sits after the
         tabs -- position follows the Vue 2 panel's src/views/Photos/PhotosToolbar.vue:15-16.
         This slot was explicitly dropped early on and has since been restored. -->
    <slot name="after-tabs" />
    <div style="flex:1"></div>
    <span class="muted-text">{{ t('photosItemsCount', { count: props.count }) }}</span>
    <div class="density">
      <button
        :data-active="props.density === 'compact'" @click="setDensity('compact')"
        :title="t('photosDensityCompact')"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="6" height="6" rx="1" /><rect x="11" y="3" width="6" height="6" rx="1" />
          <rect x="3" y="11" width="6" height="6" rx="1" /><rect x="11" y="11" width="6" height="6" rx="1" />
          <rect x="3" y="19" width="6" height="2" /><rect x="11" y="19" width="6" height="2" />
        </svg>
      </button>
      <button
        :data-active="props.density === 'comfortable'" @click="setDensity('comfortable')"
        :title="t('photosDensityComfortable')"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="8" height="8" rx="1" /><rect x="13" y="3" width="8" height="8" rx="1" />
          <rect x="3" y="13" width="8" height="8" rx="1" /><rect x="13" y="13" width="8" height="8" rx="1" />
        </svg>
      </button>
      <button
        :data-active="props.density === 'loose'" @click="setDensity('loose')"
        :title="t('photosDensityLoose')"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" />
        </svg>
      </button>
    </div>
  </div>
</template>
