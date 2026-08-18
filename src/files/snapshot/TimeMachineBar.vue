<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const props = defineProps<{ momentText: string; canEnter: boolean; folderText?: string }>()
const emit = defineEmits<{ (e: 'cancel'): void; (e: 'enter'): void }>()
const { t } = useI18n()
function onEnter() { if (props.canEnter) emit('enter') }
</script>

<template>
  <div class="tm-bar">
    <button class="tm-bar-cancel" @click="emit('cancel')">{{ t('filesCancel') }}</button>
    <!-- "Viewing history of ……" was originally in the top-left corner, but with long paths it
         extends across to the gear icon and overlaps the page-flip animation (user feedback).
         Moved to the bottom bar, positioned above the time: this area is already a column of text,
         long paths have the full width of the bottom bar available, and completely avoids the
         animation area. -->
    <div class="tm-bar-center">
      <div v-if="props.folderText" class="tm-bar-folder">{{ props.folderText }}</div>
      <div class="tm-bar-moment">{{ props.momentText }}</div>
    </div>
    <button class="tm-bar-enter" :disabled="!props.canEnter" @click="onEnter">{{ t('tmEnter') }}</button>
  </div>
</template>

<style scoped>
.tm-bar {
  position: absolute; left: 0; right: 0; bottom: 0; height: 76px;
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 28px; z-index: 2; color: var(--tm-fg);
}
.tm-bar-cancel {
  border: none; background: none; color: var(--tm-fg-muted);
  font-size: 13px; cursor: pointer; padding: 8px 4px;
}
.tm-bar-cancel:hover { color: var(--tm-fg); }
.tm-bar-center { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 2px; }
.tm-bar-folder {
  max-width: 100%; font-size: 12px; color: var(--tm-fg-muted);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.tm-bar-moment { text-align: center; font-size: 18px; font-weight: 600; }
.tm-bar-enter {
  border: none; border-radius: 999px; padding: 9px 20px; font-size: 13px; font-weight: 600;
  background: var(--accent); color: var(--on-accent); cursor: pointer;
  transition: transform 0.15s var(--ease), opacity 0.15s var(--ease);
}
.tm-bar-enter:hover:not(:disabled) { transform: translateY(-1px); }
.tm-bar-enter:disabled { opacity: 0.4; cursor: default; }
</style>
