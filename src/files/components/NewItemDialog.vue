<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import Dialog from '../../components/ui/Dialog.vue'

const props = defineProps<{ open: boolean; mode: 'file' | 'folder' }>()
const emit = defineEmits<{ (e: 'update:open', v: boolean): void; (e: 'confirm', name: string): void }>()
const { t } = useI18n()

const name = ref('')
const inputEl = ref<HTMLInputElement | null>(null)

watch(() => props.open, (o) => {
  if (!o) return
  name.value = props.mode === 'folder' ? t('filesDefaultFolderName') : t('filesDefaultFileName')
  nextTick(() => { inputEl.value?.focus(); inputEl.value?.select() })
}, { immediate: true })

function onInput(e: Event) {
  name.value = (e.target as HTMLInputElement).value.replace(/\//g, '') // Directory separators not allowed in names
}
function confirm() {
  const v = name.value.trim()
  if (!v) return
  emit('confirm', v)
  emit('update:open', false)
}
</script>

<template>
  <Dialog :open="open" :title="mode === 'folder' ? t('filesNewFolder') : t('filesNewFile')" @update:open="emit('update:open', $event)">
    <input ref="inputEl" class="ui-input" :value="name" @input="onInput" @keyup.enter="confirm" />
    <template #footer>
      <button class="ui-btn" @click="emit('update:open', false)">{{ t('filesCancel') }}</button>
      <button class="ui-btn ui-confirm-btn primary" @click="confirm">{{ t('filesConfirm') }}</button>
    </template>
  </Dialog>
</template>

<style scoped>
.ui-input { width: 100%; box-sizing: border-box; padding: 9px 12px; border-radius: 10px; border: 1px solid var(--chip-border, rgba(255,255,255,0.16)); background: var(--chip-bg, rgba(255,255,255,0.06)); color: var(--fg); font-size: 14px; outline: none; }
.ui-input:focus { border-color: var(--accent, #6ea8fe); }
.ui-btn { padding: 7px 16px; border-radius: 999px; border: 1px solid var(--chip-border, rgba(255,255,255,0.14)); background: var(--chip-bg, rgba(255,255,255,0.06)); color: var(--fg); cursor: pointer; font-size: 13px; }
.ui-btn.primary { background: color-mix(in srgb, var(--accent, #6ea8fe) 32%, transparent); border-color: var(--accent, #6ea8fe); }
</style>
