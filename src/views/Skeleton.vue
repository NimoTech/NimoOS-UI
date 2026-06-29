<template>
  <main class="skeleton">
    <h1>{{ t('appTitle') }}</h1>
    <SkeletonWidget />
  </main>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import SkeletonWidget from '../components/SkeletonWidget.vue'
import { useUtilization } from '../composables/useUtilization'
const { t } = useI18n()
useUtilization() // onMounted: REST 首屏 + socket 订阅
</script>

<style scoped>
.skeleton { padding: 24px; display: grid; gap: 20px; }
</style>
