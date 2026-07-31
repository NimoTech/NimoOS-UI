<script setup lang="ts">
// P0 空骨架。Vue2 的 developer 用返回按钮代替 h1(SettingsPanel.vue L52-56),此处 1:1。
// 内容(HTTPS 开关 + WebUIHTTPSModal)见 spec §5.2,P1 填。
import { useI18n } from 'vue-i18n'
import SettingsSection from '../components/SettingsSection.vue'
const { t } = useI18n()
const emit = defineEmits<{ 'open-tab': [tab: string] }>()
</script>

<template>
  <SettingsSection
    :title="t('settingsTabDeveloper')"
    back-to="general"
    @back="emit('open-tab', $event)"
  >
    <div class="set-skeleton">{{ t('settingsSkeletonHint') }}</div>
  </SettingsSection>
</template>
