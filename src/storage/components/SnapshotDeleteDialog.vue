<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import Dialog from '../../components/ui/Dialog.vue'

defineProps<{ open: boolean; timeText: string; busy?: boolean }>()
const emit = defineEmits<{ (e: 'update:open', v: boolean): void; (e: 'confirm'): void }>()
const { t } = useI18n()
</script>

<template>
  <Dialog :open="open" :title="t('snapDeleteTitle')" @update:open="emit('update:open', $event)">
    <p class="sdd-msg">{{ t('snapDeleteMsg', { time: timeText }) }}</p>
    <template #footer>
      <button class="sdd-cancel" type="button" :disabled="busy" @click="emit('update:open', false)">{{ t('storageCancel') }}</button>
      <button class="sdd-ok" type="button" :disabled="busy" @click="emit('confirm')">{{ t('snapDelete') }}</button>
    </template>
  </Dialog>
</template>

<style scoped>
.sdd-msg { margin: 0; font-size: 14px; color: var(--fg-muted); }
.sdd-cancel, .sdd-ok {
  padding: 7px 16px; border-radius: 999px; border: 1px solid var(--chip-border);
  background: var(--chip-bg); color: var(--fg); cursor: pointer; font-size: 13px;
}
.sdd-ok { color: var(--remove-fg); border-color: var(--remove-fg); }
.sdd-cancel:disabled, .sdd-ok:disabled { opacity: 0.45; cursor: not-allowed; }
</style>
