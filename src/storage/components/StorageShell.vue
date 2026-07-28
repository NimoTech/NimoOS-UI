<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'

const router = useRouter()
const route = useRoute()
const { t } = useI18n()
function goHome() {
  router.push('/')
}
</script>

<template>
  <div class="storage-shell">
    <header class="st-bar">
      <button class="st-home" type="button" @click="goHome">‹ {{ t('areaBackHome') }}</button>
      <h1 class="st-title">{{ t('storageTitle') }}</h1>
      <nav class="st-tabs">
        <RouterLink to="/storage" class="st-tab" :class="{ active: route.path === '/storage' }">{{ t('storageTabVolumes') }}</RouterLink>
        <RouterLink to="/storage/drives" class="st-tab" :class="{ active: route.path === '/storage/drives' }">{{ t('storageTabDrives') }}</RouterLink>
        <RouterLink to="/storage/raid" class="st-tab" :class="{ active: route.path.startsWith('/storage/raid') }">{{ t('storageTabRaid') }}</RouterLink>
      </nav>
    </header>
    <main class="st-body"><slot /></main>
  </div>
</template>

<style scoped>
.storage-shell { min-height: 100dvh; display: flex; flex-direction: column; background: var(--bg); color: var(--fg); }
.st-bar { display: flex; align-items: center; gap: 14px; padding: 14px 22px; }
.st-home {
  border: 1px solid var(--chip-border); background: var(--chip-bg); color: var(--fg);
  border-radius: 999px; padding: 6px 14px; font-size: 13px; cursor: pointer; white-space: nowrap;
}
.st-home:hover { background: var(--chip-bg-hi); }
.st-title { font-size: 18px; font-weight: 600; margin: 0; }
.st-tabs { display: flex; gap: 6px; margin-left: auto; }
.st-tab {
  padding: 6px 16px; border-radius: 999px; font-size: 13px; text-decoration: none;
  color: var(--fg-muted); border: 1px solid transparent;
}
.st-tab:hover { color: var(--fg); background: var(--hover); }
.st-tab.active { color: var(--fg); background: var(--chip-bg-hi); border-color: var(--chip-border); }
.st-body { flex: 1; overflow-y: auto; padding: 8px 22px 28px; }
.st-body > :deep(*) { max-width: 980px; margin-left: auto; margin-right: auto; }
@media (max-width: 768px) {
  .st-bar { flex-wrap: wrap; padding: 10px 14px; gap: 8px; }
  .st-tabs { margin-left: 0; width: 100%; }
  .st-body { padding: 4px 14px 20px; }
}
</style>
