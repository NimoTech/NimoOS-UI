<template>
  <div class="widget">
    <div v-if="store.cpuPercent == null && store.memPercent == null" class="empty">
      {{ t('collecting') }}
    </div>
    <div v-else class="rows">
      <div class="row"><span>{{ t('cpu') }}</span><b>{{ store.cpuPercent ?? '—' }}%</b></div>
      <div class="row"><span>{{ t('memory') }}</span><b>{{ store.memPercent ?? '—' }}%</b></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useUtilizationStore } from '../stores/utilization'
const { t } = useI18n()
const store = useUtilizationStore()
</script>

<style scoped>
.widget { background: var(--skeleton-bg); border-radius: 16px; padding: 16px; max-width: 320px; }
.row { display: flex; justify-content: space-between; padding: 4px 0; }
.row b { color: var(--accent); }
.empty { opacity: .6; }
</style>
