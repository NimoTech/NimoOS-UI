<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  DialogRoot, DialogPortal, DialogOverlay, DialogContent, DialogTitle, DialogClose,
} from 'reka-ui'
import { renderMarkdown } from '../../files/viewers/renderMarkdown'

const props = defineProps<{ open: boolean; text: string }>()
const emit = defineEmits<{ (e: 'update:open', v: boolean): void; (e: 'confirm'): void }>()
const { t } = useI18n()
/** renderMarkdown is markdown-it with html:false — raw HTML is escaped, v-html its output is safe (§3.8-2) */
const html = computed(() => renderMarkdown(props.text))
</script>

<template>
  <DialogRoot :open="open" @update:open="emit('update:open', $event)">
    <DialogPortal>
      <DialogOverlay class="pit-overlay" />
      <DialogContent class="pit-content">
        <DialogTitle class="pit-title">{{ t('appsInstallTipsTitle') }}</DialogTitle>
        <!-- eslint-disable-next-line vue/no-v-html -- renderMarkdown html:false, output is escaped -->
        <div class="pit-body" v-html="html"></div>
        <div class="pit-footer">
          <DialogClose class="pit-btn">{{ t('appsCancel') }}</DialogClose>
          <button class="pit-btn primary" type="button" @click="emit('confirm')">
            {{ t('appsInstallTipsConfirm') }}
          </button>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<style scoped>
/* scoped is available: data-v attribute follows component template vnode, still present after Portal (UninstallConfirm has same precedent) */
.pit-overlay { position: fixed; inset: 0; background: var(--overlay-bg); backdrop-filter: var(--overlay-blur); z-index: 1000; }
.pit-content {
  position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 1001;
  min-width: 320px; max-width: min(560px, 92vw); max-height: 80vh; overflow: auto;
  padding: 20px; border-radius: 18px;
  background: var(--popup-bg); border: 1px solid var(--card-border); backdrop-filter: blur(20px);
  color: var(--fg); box-shadow: var(--card-shadow-hi);
}
.pit-title { font-size: 16px; font-weight: 600; margin: 0 0 10px; }
/* overflow-wrap: anywhere: long URLs/long commands (even without spaces) wrap inside dialog, don't break container */
.pit-body { font-size: 13.5px; line-height: 1.7; color: var(--fg); overflow-wrap: anywhere; }
.pit-body :deep(a) { color: var(--accent); }
.pit-body :deep(code) { background: var(--chip-bg); border-radius: 4px; padding: 1px 5px; word-break: break-all; }
/* fenced code block (complete command): wraps inside frame, does not overflow horizontally */
.pit-body :deep(pre) {
  background: var(--chip-bg); border-radius: 8px; padding: 10px 12px; margin: 8px 0;
  white-space: pre-wrap; word-break: break-all; max-width: 100%;
}
.pit-body :deep(pre code) { background: none; padding: 0; }
.pit-footer { display: flex; justify-content: flex-end; gap: 10px; margin-top: 18px; }
.pit-btn { padding: 7px 16px; border-radius: 999px; border: 1px solid var(--chip-border); background: var(--chip-bg); color: var(--fg); cursor: pointer; font-size: 13px; }
.pit-btn.primary { background: var(--accent); color: var(--on-accent); border-color: var(--accent); }
</style>
