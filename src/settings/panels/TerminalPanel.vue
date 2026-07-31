<script setup lang="ts">
// P0 空骨架。Vue2 的 terminal tab 不渲染 h1(SettingsPanel.vue L51),此处 1:1。
// 内容见 spec §5.5,P3 填;终端位本身是永久空态占位(授权偏离 #4 ——
// 后端 /v1/sys/wsssh 已被注释、实测 404,政策二:不做测试、不列验收项)。
import { useI18n } from 'vue-i18n'
import SettingsSection from '../components/SettingsSection.vue'
const { t } = useI18n()
</script>

<template>
  <SettingsSection>
    <div class="set-skeleton">{{ t('settingsSkeletonHint') }}</div>
  </SettingsSection>
</template>
