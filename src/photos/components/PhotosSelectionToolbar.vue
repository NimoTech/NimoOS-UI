<script setup lang="ts">
// Floating top pill rebuild: this component previously had a Files-style rectangular top bar
// (`.selection-toolbar`/`.sel-btn`, own <style scoped>); it has been replaced with
// Vue2 pixel parity — a floating, top-anchored glass pill. Classes/values now come
// entirely from src/photos/styles/vue2-parity/photos.scss:444-468 (`.photos-root
// .selectbar`/`.selectbar-count`/`.selectbar-btn`), ported from the Vue 2 panel's
// src/views/Photos/PhotosGrid.vue:109-127 — this component therefore carries no
// <style> block of its own (re-skin doctrine: component <style scoped> near zero).
// The `bar-in` entrance keyframes + `backdrop-filter: blur(20px) saturate(160%)` glass
// look live in that stylesheet, not here.
//
// Button set: count + Add to Album +
// Delete(data-danger) + close(x). Vue2's Favorite (star, data-ai fill) button is NOT
// rendered — this cut is intentional and upheld. Emits were `clear`/`delete`/
// `add-to-album` only — no `favorite` emit.
//
// Vue2's trailing "x" icon button (no label, @click="$emit('cancel')") replaces the
// previous leading text "Cancel" button. New-UI's hosts (Photos.vue/PhotosFavorites.vue) listen
// for `clear`, not `cancel` — renaming the emit is a host-contract change out of
// scope here, so the close button keeps emitting `clear`.
//
// Adds Ask Nimo (`data-ai="true"`, emits `ask-nimo`). Vue2 source of
// truth is the Vue 2 panel's src/views/Photos/PhotosGrid.vue:120-123 — button order there is
// Favorite → Add to Album → Delete → **Ask Nimo** → close (Ask Nimo sits right before
// close, not right after Favorite as an earlier draft of the design assumed);
// with Favorite already cut in this repo, Ask Nimo lands between Delete and close.
// The `.selectbar-btn[data-ai="true"]` hover/tint rule already exists in
// src/photos/styles/vue2-parity/photos.scss:556-557 (pre-staged for this addition), and the
// orb is sized 18x18 (Vue2 PhotosGrid.vue:121 `width:18px;height:18px`), not 13px —
// 13px is only used for PhotosIcon glyphs on the other buttons in this bar, the Vue2
// nimo-orb span itself is always sized independently of that convention (Vue2
// PhotosTopbar.vue's own instance is also 18px, matching PhotosGrid.vue here; the 16px
// instance the Vue2 codebase actually has is PhotosLightbox.vue:85).
import { useI18n } from 'vue-i18n'
import PhotosIcon from './PhotosIcon.vue'

const props = defineProps<{ count: number }>()
const emit = defineEmits<{ (e: 'clear'): void; (e: 'delete'): void; (e: 'add-to-album'): void; (e: 'ask-nimo'): void }>()
const { t } = useI18n()
</script>

<template>
  <div class="selectbar">
    <div class="selectbar-count">{{ t('photosSelectedCount', { count: props.count }) }}</div>
    <button type="button" class="selectbar-btn" data-test="selectbar-add-album" @click="emit('add-to-album')">
      <PhotosIcon name="album" :size="13" />
      {{ t('photosAddToAlbum') }}
    </button>
    <button
      type="button" class="selectbar-btn" data-danger="true" data-test="selectbar-delete"
      @click="emit('delete')"
    >
      <PhotosIcon name="trash" :size="13" />
      {{ t('photosDelete') }}
    </button>
    <button
      type="button" class="selectbar-btn" data-ai="true" data-test="selectbar-ask-nimo"
      @click="emit('ask-nimo')"
    >
      <span class="nimo-orb" style="width:18px;height:18px;flex:none" />
      {{ t('photosAskNimo') }}
    </button>
    <button
      type="button" class="selectbar-btn" data-test="selectbar-close" :aria-label="t('photosClose')"
      @click="emit('clear')"
    >
      <PhotosIcon name="x" :size="14" />
    </button>
  </div>
</template>
