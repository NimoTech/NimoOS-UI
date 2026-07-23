<!-- 1:1 移植自 Vue2 src/views/AI/Agent/blocks/McpWarningCard.vue -->
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import AgentIcon from '../icons/AgentIcon.vue'

withDefaults(defineProps<{ server?: string; error?: string }>(), { server: '', error: '' })
const { t } = useI18n()
</script>

<template>
  <div class="mcc-warn">
    <span class="ico"><AgentIcon name="bell" :size="12" /></span>
    <span class="txt">{{ t('aiMcpConnectFailed', { server, error }) }}</span>
  </div>
</template>

<style scoped>
.mcc-warn {
  display: flex; align-items: flex-start; gap: 9px; max-width: 560px; margin: 2px 0;
  padding: 9px 12px; border-radius: var(--r-md);
  background: var(--warning-soft); border: 1px solid var(--warning-soft-border);
  font-size: 12.5px; line-height: 1.5; color: var(--warning);
}
.mcc-warn .ico {
  width: 20px; height: 20px; border-radius: 6px; flex-shrink: 0;
  display: grid; place-items: center; background: var(--warning-soft); color: var(--warning);
}
.mcc-warn .txt { word-break: break-word; }
</style>
