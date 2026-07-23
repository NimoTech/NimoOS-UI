<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Dialog from '../../components/ui/Dialog.vue'

const props = defineProps<{ open: boolean; name: string; busy?: boolean }>()
const emit = defineEmits<{ (e: 'update:open', v: boolean): void; (e: 'confirm', password: string): void }>()
const { t } = useI18n()
const password = ref('')
// 开/关都清空:关闭后明文密码不得驻留内存(P1 债③)
watch(
  () => props.open,
  () => {
    password.value = ''
  },
)
</script>

<template>
  <Dialog :open="open" :title="t('storageUnmountTitle')" @update:open="emit('update:open', $event)">
    <p class="ud-msg">{{ t('storageUnmountMsg', { name }) }}</p>
    <input
      v-model="password"
      type="password"
      class="ud-input"
      :placeholder="t('storageUnmountPassword')"
      @keyup.enter="password && !busy && emit('confirm', password)"
    />
    <template #footer>
      <button class="ud-btn" type="button" :disabled="busy" @click="emit('update:open', false)">{{ t('storageCancel') }}</button>
      <button class="ud-btn danger" type="button" :disabled="!password || busy" @click="emit('confirm', password)">
        {{ t('storageUnmountOk') }}
      </button>
    </template>
  </Dialog>
</template>

<style scoped>
.ud-msg { margin: 0 0 12px; font-size: 14px; color: var(--fg-muted); }
.ud-input {
  width: 100%; box-sizing: border-box; padding: 9px 12px; font-size: 14px;
  border-radius: 10px; border: 1px solid var(--chip-border);
  background: var(--chip-bg); color: var(--fg); outline: none;
}
.ud-input:focus { border-color: var(--accent); }
.ud-btn {
  padding: 7px 16px; border-radius: 999px; border: 1px solid var(--chip-border);
  background: var(--chip-bg); color: var(--fg); cursor: pointer; font-size: 13px;
}
.ud-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.ud-btn.danger { color: var(--remove-fg); border-color: var(--remove-fg); }
</style>
