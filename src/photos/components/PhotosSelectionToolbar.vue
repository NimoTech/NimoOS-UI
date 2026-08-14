<script setup lang="ts">
// P1 restyle (user acceptance feedback): the timeline's selection action bar
// moves from a floating bottom-center bar to a top bar styled like the Files
// region's SelectionToolbar.vue — same classes/tokens/values, copied verbatim
// (src/files/components/SelectionToolbar.vue).
import { useI18n } from 'vue-i18n'

// Task 9 (SP7-P4 album): restore "add-to-album" button (cut by P1 scope freeze, see
// identical delta comment in PhotosGrid.vue above) — new emit `add-to-album`, optional for
// host to listen, no error if ignored. Position is between "cancel" and "delete", not danger style.
const props = defineProps<{ count: number }>()
const emit = defineEmits<{ (e: 'clear'): void; (e: 'delete'): void; (e: 'add-to-album'): void }>()
const { t } = useI18n()
</script>

<template>
  <div class="selection-toolbar">
    <span class="sel-count">{{ t('photosSelectedCount', { count: props.count }) }}</span>
    <button class="sel-btn sel-clear" @click="emit('clear')">{{ t('photosCancel') }}</button>
    <button class="sel-btn sel-add-album" @click="emit('add-to-album')">{{ t('photosAddToAlbum') }}</button>
    <button class="sel-btn sel-delete danger" @click="emit('delete')">{{ t('photosDelete') }}</button>
  </div>
</template>

<style scoped>
.selection-toolbar { display: flex; align-items: center; gap: 12px; padding: 8px 12px; margin-bottom: 10px; border-radius: 12px; background: var(--chip-bg, rgba(255,255,255,0.06)); color: var(--fg); font-size: 13px; }
.sel-count { flex: 0 0 auto; }
.sel-btn { padding: 4px 12px; border-radius: 999px; border: 1px solid var(--chip-border, rgba(255,255,255,0.12)); background: transparent; color: var(--fg); cursor: pointer; font-size: 12px; }
.sel-btn:hover { background: var(--chip-bg-hi, rgba(255,255,255,0.14)); }
.sel-btn.danger { color: var(--remove-fg, #ff8a8a); border-color: color-mix(in srgb, var(--remove-fg, #ff5d5d) 45%, transparent); }
.sel-btn.danger:hover { background: color-mix(in srgb, var(--remove-fg, #ff5d5d) 22%, transparent); }
/* ≤768px: buttons flow into 2-3 rows (matches Files SelectionToolbar) */
@media (max-width: 768px) {
  .selection-toolbar { flex-wrap: wrap; row-gap: 8px; }
}
</style>
