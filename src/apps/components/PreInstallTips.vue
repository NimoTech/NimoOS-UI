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
/** renderMarkdown 是 html:false 的 markdown-it——原始 HTML 被转义,v-html 其输出安全(§3.8-2) */
const html = computed(() => renderMarkdown(props.text))
</script>

<template>
  <DialogRoot :open="open" @update:open="emit('update:open', $event)">
    <DialogPortal>
      <DialogOverlay class="pit-overlay" />
      <DialogContent class="pit-content">
        <DialogTitle class="pit-title">{{ t('appsInstallTipsTitle') }}</DialogTitle>
        <!-- eslint-disable-next-line vue/no-v-html -- renderMarkdown html:false,输出已转义 -->
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
/* scoped 可用:data-v 属性随组件模板 vnode 走,Portal 后仍带(UninstallConfirm 同款先例) */
.pit-overlay { position: fixed; inset: 0; background: var(--overlay-bg); backdrop-filter: var(--overlay-blur); z-index: 1000; }
.pit-content {
  position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 1001;
  min-width: 320px; max-width: min(560px, 92vw); max-height: 80vh; overflow: auto;
  padding: 20px; border-radius: 18px;
  background: var(--popup-bg); border: 1px solid var(--card-border); backdrop-filter: blur(20px);
  color: var(--fg); box-shadow: var(--card-shadow-hi);
}
.pit-title { font-size: 16px; font-weight: 600; margin: 0 0 10px; }
/* overflow-wrap:anywhere:长 URL/长命令(哪怕无空格)也在弹窗内折行,不撑破容器 */
.pit-body { font-size: 13.5px; line-height: 1.7; color: var(--fg); overflow-wrap: anywhere; }
.pit-body :deep(a) { color: var(--accent); }
.pit-body :deep(code) { background: var(--chip-bg); border-radius: 4px; padding: 1px 5px; word-break: break-all; }
/* 围栏代码块(整行命令):在框内折行显示完整命令,不横向溢出 */
.pit-body :deep(pre) {
  background: var(--chip-bg); border-radius: 8px; padding: 10px 12px; margin: 8px 0;
  white-space: pre-wrap; word-break: break-all; max-width: 100%;
}
.pit-body :deep(pre code) { background: none; padding: 0; }
.pit-footer { display: flex; justify-content: flex-end; gap: 10px; margin-top: 18px; }
.pit-btn { padding: 7px 16px; border-radius: 999px; border: 1px solid var(--chip-border); background: var(--chip-bg); color: var(--fg); cursor: pointer; font-size: 13px; }
.pit-btn.primary { background: var(--accent); color: var(--on-accent); border-color: var(--accent); }
</style>
