<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const props = defineProps<{ count: number; restoring: boolean }>()
const emit = defineEmits<{ (e: 'restore'): void; (e: 'download'): void; (e: 'clear'): void }>()
const { t } = useI18n()
function onRestore() { if (!props.restoring) emit('restore') }
</script>

<template>
  <!-- 快照里的动词集刻意收窄成 恢复 + 下载 两个(Vue2 M2-F2 的最终形态):
       剪切/复制/删除/共享在只读快照上要么无意义要么会失败,留着只会诱导用户点。
       视觉复用 SelectionToolbar 的类名尺度,保持像同一个系统。 -->
  <div class="selection-toolbar snap-sel">
    <span class="sel-count">{{ t('filesSelectedCount', { count: props.count }) }}</span>
    <button class="sel-btn snap-sel-restore" :disabled="props.restoring" @click="onRestore">
      {{ t('snapBrowseRestore') }}
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
