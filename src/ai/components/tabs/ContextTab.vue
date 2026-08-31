<!--
  1:1 port from Vue2 src/views/AI/Agent/tabs/ContextTab.vue (16 lines).

  This is a pure placeholder panel (title + description) that was already "not yet supported"
  in Vue2, not functionality cut from this task — port as-is per brief, do not implement
  "add files to context" feature.
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
