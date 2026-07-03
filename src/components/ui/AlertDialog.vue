<script setup lang="ts">
import {
  AlertDialogRoot, AlertDialogPortal, AlertDialogOverlay, AlertDialogContent,
  AlertDialogTitle, AlertDialogDescription, AlertDialogCancel, AlertDialogAction,
} from 'reka-ui'

defineProps<{
  open: boolean; title: string; message: string; confirmText: string; cancelText: string; destructive?: boolean
}>()
const emit = defineEmits<{ (e: 'update:open', v: boolean): void; (e: 'confirm'): void }>()
</script>

<template>
  <AlertDialogRoot :open="open" @update:open="emit('update:open', $event)">
    <AlertDialogPortal>
      <AlertDialogOverlay class="ui-dialog-overlay" />
      <AlertDialogContent class="ui-dialog-content">
        <AlertDialogTitle class="ui-dialog-title">{{ title }}</AlertDialogTitle>
        <AlertDialogDescription class="ui-alert-msg">{{ message }}</AlertDialogDescription>
        <div class="ui-dialog-footer">
          <AlertDialogCancel class="ui-btn">{{ cancelText }}</AlertDialogCancel>
          <AlertDialogAction class="ui-btn" :class="{ danger: destructive }" @click="emit('confirm')">{{ confirmText }}</AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialogPortal>
  </AlertDialogRoot>
</template>

<style scoped>
.ui-dialog-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); backdrop-filter: blur(2px); z-index: 100; }
.ui-dialog-content {
  position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 101;
  min-width: 320px; max-width: 92vw; padding: 20px; border-radius: 18px;
  background: var(--card-bg, rgba(30,32,44,0.92)); border: 1px solid var(--card-border, rgba(255,255,255,0.12));
  color: var(--fg); box-shadow: 0 24px 60px rgba(0,0,0,0.5);
}
.ui-dialog-title { font-size: 16px; font-weight: 600; margin: 0 0 10px; }
.ui-alert-msg { font-size: 14px; color: var(--fg-muted, #9aa4bf); margin: 0; }
.ui-dialog-footer { display: flex; justify-content: flex-end; gap: 10px; margin-top: 18px; }
.ui-btn { padding: 7px 16px; border-radius: 999px; border: 1px solid var(--chip-border, rgba(255,255,255,0.14)); background: var(--chip-bg, rgba(255,255,255,0.06)); color: var(--fg); cursor: pointer; font-size: 13px; }
.ui-btn.danger { background: color-mix(in srgb, #ff5d5d 30%, transparent); border-color: #ff5d5d; }
</style>
