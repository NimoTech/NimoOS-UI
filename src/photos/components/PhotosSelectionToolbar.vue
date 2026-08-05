<script setup lang="ts">
// P1 restyle (user acceptance feedback): the timeline's selection action bar
// moves from a floating bottom-center bar to a top bar styled like the Files
// region's SelectionToolbar.vue — same classes/tokens/values, copied verbatim
// (src/files/components/SelectionToolbar.vue).
import { useI18n } from 'vue-i18n'

// Task 9 (SP7-P4 相册): 加回「加入相册」按钮(P1 按范围收口砍掉,见头部 PhotosGrid.vue
// 的同款 delta 注释)——新 emit `add-to-album`,对宿主是可选监听,不接不报错。位置在
// 「取消」与「删除」之间,非 danger 样式。
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
/* ≤768px:按钮流成 2-3 行(与 Files SelectionToolbar 一致) */
@media (max-width: 768px) {
  .selection-toolbar { flex-wrap: wrap; row-gap: 8px; }
}
</style>
