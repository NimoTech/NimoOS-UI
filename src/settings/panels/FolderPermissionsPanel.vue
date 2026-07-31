<script setup lang="ts">
// P0 空骨架。内容见 spec §5.7(权限矩阵做样子,逻辑等 sp7/sp8 合并,债务 D11),P4,后续期填。
import { useI18n } from 'vue-i18n'
import SettingsSection from '../components/SettingsSection.vue'
const { t } = useI18n()
</script>

<template>
  <SettingsSection :title="t('settingsTabFolderPermissions')">
    <div class="set-skeleton">{{ t('settingsSkeletonHint') }}</div>
  </SettingsSection>
</template>
