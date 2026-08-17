<script setup lang="ts">
// Plan B Task 7 (D19 floating top pill rebuild): P1 gave this a Files-style rectangular top bar
// (`.selection-toolbar`/`.sel-btn`, own <style scoped>); this task replaces that with
// Vue2 pixel parity — a floating, top-anchored glass pill. Classes/values now come
// entirely from src/photos/styles/vue2-parity/photos.scss:444-468 (`.photos-root
// .selectbar`/`.selectbar-count`/`.selectbar-btn`), ported from Vue2 NimoOS-UI
// src/views/Photos/PhotosGrid.vue:109-127 — this component therefore carries no
// <style> block of its own (re-skin doctrine: component <style scoped> near zero).
// The `bar-in` entrance keyframes + `backdrop-filter: blur(20px) saturate(160%)` glass
// look live in that stylesheet, not here.
//
// B-scope button set (owner-registered, see Global handoff notes): count + Add to Album +
// Delete(data-danger) + close(x). Vue2's Favorite (star, data-ai fill) and Ask Nimo
// (data-ai="true") buttons are NOT rendered — ledger 二-8 upheld the favorite cut,
// Ask Nimo is Plan G's, not this plan's. Emits stay exactly `clear`/`delete`/
// `add-to-album` — no new `favorite` emit.
//
// Vue2's trailing "x" icon button (no label, @click="$emit('cancel')") replaces P1's
// leading text "Cancel" button. New-UI's hosts (Photos.vue/PhotosFavorites.vue) listen
// for `clear`, not `cancel` — renaming the emit is a host-contract change out of this
// task's scope, so the close button keeps emitting `clear`.
import { useI18n } from 'vue-i18n'
import PhotosIcon from './PhotosIcon.vue'

const props = defineProps<{ count: number }>()
const emit = defineEmits<{ (e: 'clear'): void; (e: 'delete'): void; (e: 'add-to-album'): void }>()
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
      type="button" class="selectbar-btn" data-test="selectbar-close" :aria-label="t('photosClose')"
      @click="emit('clear')"
    >
      <PhotosIcon name="x" :size="14" />
    </button>
  </div>
</template>
