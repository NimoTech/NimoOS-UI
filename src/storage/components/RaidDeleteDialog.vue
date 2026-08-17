<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Dialog from '../../components/ui/Dialog.vue'

const props = defineProps<{ open: boolean; name: string; busy?: boolean }>()
const emit = defineEmits<{ (e: 'update:open', v: boolean): void; (e: 'confirm'): void }>()
const { t } = useI18n()
const confirmText = ref('')
// Clear on both open and close: prevents leftover input from being mistaken for confirmation the next time the dialog opens
watch(
  () => props.open,
  () => {
    confirmText.value = ''
  },
)
</script>

<template>
  <Dialog :open="open" :title="t('raidRemoveTitle')" @update:open="emit('update:open', $event)">
    <p class="rdd-msg">{{ t('raidRemoveMsg') }}</p>
    <p class="rdd-warning">⚠️ {{ t('raidRemoveWarning') }}</p>
    <input
      v-model="confirmText"
      type="text"
      class="rdd-input"
      :placeholder="t('raidRemoveTypeName', { name })"
    />
    <template #footer>
      <button class="rdd-cancel" type="button" :disabled="busy" @click="emit('update:open', false)">{{ t('storageCancel') }}</button>
      <button class="rdd-ok danger" type="button" :disabled="confirmText !== name || busy" @click="emit('confirm')">
        {{ t('raidRemoveOk') }}
      </button>
    </template>
  </Dialog>
</template>

<style scoped>
.rdd-msg { margin: 0 0 8px; font-size: 14px; color: var(--fg-muted); }
.rdd-warning { margin: 0 0 12px; font-size: 12px; color: var(--dem-fg); }
.rdd-input {
  width: 100%; box-sizing: border-box; padding: 9px 12px; font-size: 14px;
  border-radius: 10px; border: 1px solid var(--chip-border);
  background: var(--chip-bg); color: var(--fg); outline: none;
}
.rdd-input:focus { border-color: var(--accent); }
.rdd-cancel, .rdd-ok {
  padding: 7px 16px; border-radius: 999px; border: 1px solid var(--chip-border);
  background: var(--chip-bg); color: var(--fg); cursor: pointer; font-size: 13px;
}
.rdd-cancel:disabled, .rdd-ok:disabled { opacity: 0.45; cursor: not-allowed; }
.rdd-ok.danger { color: var(--remove-fg); border-color: var(--remove-fg); }
</style>
