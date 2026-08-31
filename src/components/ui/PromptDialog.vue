<!--
  New primitive replacing Vue2 `$buefy.dialog.prompt` (New-UI has no
  confirm dialog with an input field). Structure copied from `src/components/ui/AlertDialog.vue`,
  plus one <input> bound to a local ref.

  [Same class of issue as D2] reka-ui's AlertDialogRoot is never destroyed and recreated
  (it stays mounted), so every `open` transition from false → true must reset the local input
  value to initialValue — otherwise the previous dialog's input carries over verbatim into this
  one (same transient-state leftover problem as the settingsStore singleton; see the store-side
  resetTransientUi handling).
-->
<script setup lang="ts">
import { ref, watch } from 'vue'
import {
  AlertDialogRoot, AlertDialogPortal, AlertDialogOverlay, AlertDialogContent,
  AlertDialogTitle, AlertDialogDescription,
} from 'reka-ui'

const props = withDefaults(
  defineProps<{
    open: boolean; title: string; message: string; placeholder?: string
    confirmText: string; cancelText: string; initialValue?: string
  }>(),
  { placeholder: '', initialValue: '' },
)
const emit = defineEmits<{ (e: 'update:open', v: boolean): void; (e: 'confirm', value: string): void }>()

const value = ref(props.initialValue ?? '')

watch(() => props.open, (o) => {
  if (o) value.value = props.initialValue ?? ''
})

function onConfirm() {
  emit('confirm', value.value)
  emit('update:open', false)
}

function onCancel() {
  emit('update:open', false)
}
</script>

<template>
  <AlertDialogRoot :open="open" @update:open="emit('update:open', $event)">
    <AlertDialogPortal>
      <AlertDialogOverlay class="ui-dialog-overlay" />
      <AlertDialogContent class="ui-dialog-content">
        <AlertDialogTitle class="ui-dialog-title">{{ title }}</AlertDialogTitle>
        <AlertDialogDescription class="ui-alert-msg">{{ message }}</AlertDialogDescription>
        <input
          v-model="value"
          class="ui-dialog-input"
          :placeholder="placeholder"
          @keydown.enter="onConfirm"
        />
        <div class="ui-dialog-footer">
          <button type="button" class="ui-btn" data-testid="prompt-cancel" @click="onCancel">{{ cancelText }}</button>
          <button type="button" class="ui-btn" data-testid="prompt-confirm" @click="onConfirm">{{ confirmText }}</button>
        </div>
      </AlertDialogContent>
    </AlertDialogPortal>
  </AlertDialogRoot>
</template>

<style scoped>
/* Reuses AlertDialog.vue's .ui-dialog-* classes (scoped styles can't be shared across
   components, hence the copy). In AlertDialog.vue these rules are written as "token + raw-color
   fallback" (e.g. var(--popup-bg, rgba(20,23,35,0.95))) — this file is a newly written .vue,
   fully covered by color-guard, so the copy drops the fallbacks and keeps only the tokens. */
.ui-dialog-overlay { position: fixed; inset: 0; background: var(--overlay-bg); backdrop-filter: var(--overlay-blur); z-index: 1000; }
.ui-dialog-content {
  position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 1001;
  min-width: 320px; max-width: 92vw; padding: 20px; border-radius: 18px;
  background: var(--popup-bg); border: 1px solid var(--card-border); backdrop-filter: blur(20px);
  color: var(--fg); box-shadow: var(--card-shadow-hi);
}
.ui-dialog-title { font-size: 16px; font-weight: 600; margin: 0 0 10px; }
.ui-alert-msg { font-size: 14px; color: var(--fg-muted); margin: 0; }
.ui-dialog-input {
  display: block;
  width: 100%;
  margin-top: 14px;
  padding: 8px 12px;
  border-radius: 10px;
  border: 1px solid var(--chip-border);
  background: var(--chip-bg-hi);
  color: var(--fg);
  font-size: 13px;
  outline: none;
  box-sizing: border-box;
}
.ui-dialog-footer { display: flex; justify-content: flex-end; gap: 10px; margin-top: 18px; }
.ui-btn { padding: 7px 16px; border-radius: 999px; border: 1px solid var(--chip-border); background: var(--chip-bg); color: var(--fg); cursor: pointer; font-size: 13px; }
</style>
