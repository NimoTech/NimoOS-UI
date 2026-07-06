<script setup lang="ts">
import { DialogRoot, DialogPortal, DialogOverlay, DialogContent, DialogTitle } from 'reka-ui'

defineProps<{ open: boolean; title?: string }>()
const emit = defineEmits<{ (e: 'update:open', v: boolean): void }>()
</script>

<template>
  <DialogRoot :open="open" @update:open="emit('update:open', $event)">
    <DialogPortal>
      <DialogOverlay class="ui-dialog-overlay" />
      <DialogContent class="ui-dialog-content" :aria-describedby="undefined">
        <DialogTitle v-if="title" class="ui-dialog-title">{{ title }}</DialogTitle>
        <div class="ui-dialog-body"><slot /></div>
        <div class="ui-dialog-footer"><slot name="footer" /></div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<style scoped>
.ui-dialog-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); backdrop-filter: blur(2px); z-index: 1000; }
.ui-dialog-content {
  position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 1001;
  min-width: 320px; max-width: 92vw; padding: 20px; border-radius: 18px;
  background: var(--popup-bg, rgba(20,23,35,0.95)); border: 1px solid var(--card-border, rgba(255,255,255,0.12)); backdrop-filter: blur(20px);
  color: var(--fg); box-shadow: 0 24px 60px rgba(0,0,0,0.5);
}
.ui-dialog-title { font-size: 16px; font-weight: 600; margin: 0 0 14px; }
.ui-dialog-footer { display: flex; justify-content: flex-end; gap: 10px; margin-top: 18px; }
</style>
