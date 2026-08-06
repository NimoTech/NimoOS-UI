<!--
  1:1 移植自 Vue2 src/views/AI/Agent/tabs/ContextTab.vue(16 行)。SP8-P1c2 Task 10。

  这是 Vue2 里本来就"尚未支持"的纯占位面板(标题 + 说明句),不是本任务被裁剪掉的
  功能——按 brief 原样港过来即可,不要顺手实现"把文件加入对话上下文"。
-->
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import AgentIcon from '../icons/AgentIcon.vue'

const { t } = useI18n()
</script>

<template>
  <div style="padding: 30px 16px; text-align: center; color: var(--text-tertiary)">
    <AgentIcon name="folder" :size="32" color="var(--text-quaternary)" />
    <div style="margin-top: 12px; font-size: 13px; color: var(--text-secondary); font-weight: 500">
      {{ t('aiContextNotYet') }}
    </div>
    <div style="margin-top: 6px; font-size: 12px; line-height: 1.5">
      {{ t('aiContextDesc') }}
    </div>
  </div>
</template>
