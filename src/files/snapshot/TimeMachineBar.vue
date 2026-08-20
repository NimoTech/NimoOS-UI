<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const props = defineProps<{ momentText: string; canEnter: boolean }>()
const emit = defineEmits<{ (e: 'cancel'): void; (e: 'enter'): void }>()
const { t } = useI18n()
function onEnter() { if (props.canEnter) emit('enter') }
</script>

<template>
  <!-- Owner's layout, in this order: the moment first, directly under the card it belongs to, then
       the two verbs beneath it. Both centred rather than pinned to the far left and right corners
       of the screen. Reading downwards it goes card -> which moment this is -> what to do about
       it, so the moment stays attached to the deck instead of being separated from it by a row of
       buttons. -->
  <div class="tm-bar">
    <div class="tm-bar-moment">{{ props.momentText }}</div>
    <div class="tm-bar-actions">
      <button class="tm-bar-cancel" @click="emit('cancel')">{{ t('filesCancel') }}</button>
      <button class="tm-bar-enter" :disabled="!props.canEnter" @click="onEnter">{{ t('tmEnter') }}</button>
    </div>
  </div>
</template>

<style scoped>
.tm-bar {
  position: absolute; left: 0; right: 0; bottom: 0; height: 104px;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;
  padding: 0 28px 12px; z-index: 2; color: var(--tm-fg);
}
.tm-bar-actions { display: flex; align-items: center; gap: 14px; }
.tm-bar-cancel {
  border: 1px solid var(--tm-card-bd); border-radius: 999px; background: var(--tm-card-bg);
  color: var(--tm-fg-muted); font-size: 13px; cursor: pointer; padding: 8px 18px;
  transition: color 0.15s var(--ease), border-color 0.15s var(--ease);
}
.tm-bar-cancel:hover { color: var(--tm-fg); border-color: var(--tm-fg-muted); }
.tm-bar-moment { text-align: center; font-size: 17px; font-weight: 600; }
.tm-bar-enter {
  border: none; border-radius: 999px; padding: 9px 22px; font-size: 13px; font-weight: 600;
  background: var(--accent); color: var(--on-accent); cursor: pointer;
  transition: transform 0.15s var(--ease), opacity 0.15s var(--ease);
}
.tm-bar-enter:hover:not(:disabled) { transform: translateY(-1px); }
.tm-bar-enter:disabled { opacity: 0.4; cursor: default; }
</style>
