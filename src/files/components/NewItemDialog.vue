<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import Dialog from '../../components/ui/Dialog.vue'
import { nameTooLong } from '../util/pathLimits'

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
  name.value = (e.target as HTMLInputElement).value.replace(/\//g, '') // '/' is a separator, never part of a name
}

// Validate what confirm() would actually submit, i.e. the trimmed value —
// otherwise trailing spaces the user cannot see would push a legal 255-byte
// name over the edge and the error would look arbitrary.
const trimmed = computed(() => name.value.trim())
// nameTooLong is the shared, backend-measured rule (pathLimits.ts). Do NOT
// recompute byte lengths here: create, rename and upload all have to agree, and
// they only agree by going through the one function.
const tooLong = computed(() => nameTooLong(trimmed.value))
// Inline, not a toast: toasts render at z-index 60, beneath this dialog's
// blurred z-index-1000 overlay (memory: newui-dialog-error-not-toast).
const error = computed(() => (tooLong.value ? t('filesNameTooLong') : ''))
const canConfirm = computed(() => !!trimmed.value && !tooLong.value)

function confirm() {
  if (!canConfirm.value) return
  emit('confirm', trimmed.value)
  emit('update:open', false)
}
</script>

<template>
  <Dialog :open="open" :title="mode === 'folder' ? t('filesNewFolder') : t('filesNewFile')" @update:open="emit('update:open', $event)">
    <input
      ref="inputEl"
      class="ui-input"
      :class="{ invalid: tooLong }"
      :value="name"
      :aria-invalid="tooLong || undefined"
      aria-describedby="new-item-name-error"
      @input="onInput"
      @keyup.enter="confirm"
    />
    <p v-if="error" id="new-item-name-error" class="ui-field-error" role="alert">{{ error }}</p>
    <template #footer>
      <button class="ui-btn" @click="emit('update:open', false)">{{ t('filesCancel') }}</button>
      <button class="ui-btn ui-confirm-btn primary" :disabled="!canConfirm" @click="confirm">{{ t('filesConfirm') }}</button>
    </template>
  </Dialog>
</template>

<style scoped>
.ui-input { width: 100%; box-sizing: border-box; padding: 9px 12px; border-radius: 10px; border: 1px solid var(--chip-border, rgba(255,255,255,0.16)); background: var(--chip-bg, rgba(255,255,255,0.06)); color: var(--fg); font-size: 14px; outline: none; }
.ui-input:focus { border-color: var(--accent, #6ea8fe); }
/* --danger-fg is defined for both themes (theme.css:306 dark / :383 light);
   the raw red used elsewhere in this file's defaults would wash out on light. */
.ui-input.invalid, .ui-input.invalid:focus { border-color: var(--danger-fg); }
.ui-field-error { margin: 6px 0 0; font-size: 12px; line-height: 1.4; color: var(--danger-fg); }
.ui-btn { padding: 7px 16px; border-radius: 999px; border: 1px solid var(--chip-border, rgba(255,255,255,0.14)); background: var(--chip-bg, rgba(255,255,255,0.06)); color: var(--fg); cursor: pointer; font-size: 13px; }
.ui-btn.primary { background: color-mix(in srgb, var(--accent, #6ea8fe) 32%, transparent); border-color: var(--accent, #6ea8fe); }
.ui-btn:disabled { opacity: 0.45; cursor: not-allowed; }
</style>
