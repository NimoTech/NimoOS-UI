<script setup lang="ts">
// P0 空骨架。内容见 spec §5.7,P4,后续期填。
import { useI18n } from 'vue-i18n'
import SettingsSection from '../components/SettingsSection.vue'
const { t } = useI18n()
</script>

<template>
  <SettingsSection :title="t('settingsTabAccount')">
    <div class="set-skeleton">{{ t('settingsSkeletonHint') }}</div>
  </SettingsSection>
</template>
