<template>
  <div class="screen">
    <header class="topbar">
      <a class="back" href="/">{{ t('backToOld') }}</a>
    </header>
    <router-view />
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
</script>

<style scoped>
.topbar { display: flex; align-items: center; padding: 12px 16px; }
.back { color: var(--accent); text-decoration: none; font-size: 14px; }
</style>
