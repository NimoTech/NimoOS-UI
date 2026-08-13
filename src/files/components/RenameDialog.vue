<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import Dialog from '../../components/ui/Dialog.vue'
import { nameTooLong } from '../util/pathLimits'

const props = defineProps<{ open: boolean; name: string }>()
const emit = defineEmits<{ (e: 'update:open', v: boolean): void; (e: 'confirm', name: string): void }>()
const { t } = useI18n()

const value = ref('')
const inputEl = ref<HTMLInputElement | null>(null)

watch(() => props.open, (o) => {
  if (!o) return
  value.value = props.name
  nextTick(() => { inputEl.value?.focus(); inputEl.value?.select() })
}, { immediate: true })

function onInput(e: Event) {
  value.value = (e.target as HTMLInputElement).value.replace(/\//g, '')
}

// Mirrors NewItemDialog: same shared rule, same inline presentation. Renaming
// needs it more than creating does — the user starts from an existing name and
// appends to it — and useFileOps.rename() has no length guard at all, so
// without this the request reaches the backend and comes back as the bare
// literal "Fail", which errMsg() flattens into the generic "operation failed".
const trimmed = computed(() => value.value.trim())
const tooLong = computed(() => nameTooLong(trimmed.value))
const error = computed(() => (tooLong.value ? t('filesNameTooLong') : ''))
const canConfirm = computed(() => !!trimmed.value && !tooLong.value)

function confirm() {
  if (!canConfirm.value) return
  emit('confirm', trimmed.value)
  emit('update:open', false)
}
</script>

<template>
  <Dialog :open="open" :title="t('filesRename')" @update:open="emit('update:open', $event)">
    <input
      ref="inputEl"
      class="ui-input"
      :class="{ invalid: tooLong }"
      :value="value"
      :aria-invalid="tooLong || undefined"
      aria-describedby="rename-name-error"
      @input="onInput"
      @keyup.enter="confirm"
    />
    <p v-if="error" id="rename-name-error" class="ui-field-error" role="alert">{{ error }}</p>
    <template #footer>
      <button class="ui-btn" @click="emit('update:open', false)">{{ t('filesCancel') }}</button>
      <button class="ui-btn ui-confirm-btn primary" :disabled="!canConfirm" @click="confirm">{{ t('filesConfirm') }}</button>
    </template>
  </Dialog>
</template>

<style scoped>
.ui-input { width: 100%; box-sizing: border-box; padding: 9px 12px; border-radius: 10px; border: 1px solid var(--chip-border, rgba(255,255,255,0.16)); background: var(--chip-bg, rgba(255,255,255,0.06)); color: var(--fg); font-size: 14px; outline: none; }
.ui-input:focus { border-color: var(--accent, #6ea8fe); }
/* --danger-fg is defined for both themes (theme.css:306 dark / :383 light). */
.ui-input.invalid, .ui-input.invalid:focus { border-color: var(--danger-fg); }
.ui-field-error { margin: 6px 0 0; font-size: 12px; line-height: 1.4; color: var(--danger-fg); }
.ui-btn { padding: 7px 16px; border-radius: 999px; border: 1px solid var(--chip-border, rgba(255,255,255,0.14)); background: var(--chip-bg, rgba(255,255,255,0.06)); color: var(--fg); cursor: pointer; font-size: 13px; }
.ui-btn.primary { background: color-mix(in srgb, var(--accent, #6ea8fe) 32%, transparent); border-color: var(--accent, #6ea8fe); }
.ui-btn:disabled { opacity: 0.45; cursor: not-allowed; }
</style>
