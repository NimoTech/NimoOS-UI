<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'

const router = useRouter()
const { t } = useI18n()
function goHome() { router.push('/') }
</script>

<template>
  <div class="files-shell">
    <header class="files-bar">
      <button class="bar-btn files-home-btn" type="button" @click="goHome">‹ {{ t('filesBackHome') }}</button>
      <h1 class="files-title">{{ t('filesTitle') }}</h1>
    </header>
    <main class="files-body">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.files-shell { display: flex; flex-direction: column; height: 100vh; color: var(--fg); }
.files-bar { display: flex; align-items: center; gap: 16px; padding: 16px 20px; flex: 0 0 auto; }
.files-title { font-size: 18px; font-weight: 600; margin: 0; }
.files-body { flex: 1 1 auto; overflow: auto; padding: 0 20px 20px; }
</style>
