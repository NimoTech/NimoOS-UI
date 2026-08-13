<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const props = defineProps<{
  count: number
  restoring: boolean
  // Task 11: only set while a batch restore is in flight. The backend takes
  // one path per call, so a 40-item batch stays serial — this is what makes
  // that wait visible instead of just a disabled button.
  restoreProgress?: { done: number; total: number } | null
}>()
const emit = defineEmits<{ (e: 'restore'): void; (e: 'download'): void; (e: 'clear'): void }>()
const { t } = useI18n()
function onRestore() { if (!props.restoring) emit('restore') }
</script>

<template>
  <!-- Verbs in snapshots are intentionally narrowed to restore + download (the final form of Vue2
       M2-F2): cut/copy/delete/share on read-only snapshots are either meaningless or fail, leaving
       them only misleads users to click. Visually reuse the class name scale of SelectionToolbar,
       maintaining the appearance of one unified system. -->
  <div class="selection-toolbar snap-sel">
    <span class="sel-count">{{ t('filesSelectedCount', { count: props.count }) }}</span>
    <button class="sel-btn snap-sel-restore" :disabled="props.restoring" @click="onRestore">
      {{ props.restoreProgress
        ? t('snapBrowseRestoringProgress', { done: props.restoreProgress.done, total: props.restoreProgress.total })
        : t('snapBrowseRestore') }}
    </button>
    <button class="sel-btn snap-sel-download" @click="emit('download')">{{ t('filesCtxDownload') }}</button>
    <button class="sel-btn snap-sel-clear" @click="emit('clear')">{{ t('filesClearSel') }}</button>
  </div>
</template>

<style scoped>
.selection-toolbar {
  display: flex; align-items: center; gap: 12px; padding: 8px 12px; margin-bottom: 10px;
  border-radius: 12px; background: var(--chip-bg); color: var(--fg); font-size: 13px;
}
.sel-count { flex: 0 0 auto; }
.sel-btn {
  padding: 4px 12px; border-radius: 999px; border: 1px solid var(--chip-border);
  background: transparent; color: var(--fg); cursor: pointer; font-size: 12px;
}
.sel-btn:hover:not(:disabled) { background: var(--chip-bg-hi); }
.sel-btn:disabled { opacity: 0.5; cursor: default; }
@media (max-width: 768px) { .selection-toolbar { flex-wrap: wrap; row-gap: 8px; } }
</style>
