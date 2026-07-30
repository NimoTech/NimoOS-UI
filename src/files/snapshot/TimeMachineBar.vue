<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const props = defineProps<{ momentText: string; canEnter: boolean }>()
const emit = defineEmits<{ (e: 'cancel'): void; (e: 'enter'): void }>()
const { t } = useI18n()
function onEnter() { if (props.canEnter) emit('enter') }
</script>

<template>
  <div class="tm-bar">
    <button class="tm-bar-cancel" @click="emit('cancel')">{{ t('filesCancel') }}</button>
    <div class="tm-bar-moment">{{ props.momentText }}</div>
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
.tm-bar-moment { flex: 1 1 auto; text-align: center; font-size: 18px; font-weight: 600; }
.tm-bar-enter {
  border: none; border-radius: 999px; padding: 9px 20px; font-size: 13px; font-weight: 600;
  background: var(--accent); color: var(--on-accent); cursor: pointer;
  transition: transform 0.15s var(--ease), opacity 0.15s var(--ease);
}
.tm-bar-enter:hover:not(:disabled) { transform: translateY(-1px); }
.tm-bar-enter:disabled { opacity: 0.4; cursor: default; }
</style>
