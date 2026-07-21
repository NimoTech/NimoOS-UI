<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { InstallTask } from '../stores/installProgress'

const props = defineProps<{ task: InstallTask }>()
defineEmits<{ dismiss: [] }>()
const { t } = useI18n()
</script>

<template>
  <article class="iac" :class="{ err: task.state === 'error' }">
    <img v-if="task.icon" :src="task.icon" alt="" class="iac-icon" />
    <div v-else class="iac-icon iac-icon-fallback">{{ task.title.slice(0, 1) }}</div>
    <div class="iac-meta">
      <h3 class="iac-title">{{ task.title }}</h3>
      <template v-if="task.state === 'installing'">
        <div class="op-progress"><div class="op-progress-fill" :style="{ width: task.percent + '%' }" /></div>
        <span class="iac-sub">{{ t('appsInstallingPercent', { percent: task.percent }) }}</span>
      </template>
      <span v-else class="iac-sub iac-err-text">{{ task.message || t('appsInstallFailed', { name: task.title }) }}</span>
    </div>
    <button v-if="task.state === 'error'" class="iac-dismiss" type="button" @click="$emit('dismiss')">
      {{ t('appsInstallDismiss') }}
    </button>
  </article>
</template>

<style scoped>
.iac {
  display: flex; gap: 12px; align-items: center; padding: 14px;
  background: var(--card-bg); border: 1px solid var(--card-border);
  border-radius: var(--radius); box-shadow: var(--card-shadow);
  backdrop-filter: var(--blur);
}
.iac-icon { width: 44px; height: 44px; border-radius: 12px; flex: 0 0 auto; object-fit: cover; background: var(--chip-bg); }
.iac-icon-fallback { display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 600; color: var(--fg-muted); background: var(--chip-bg-hi); }
.iac-meta { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 6px; }
.iac-title { font-size: 14px; font-weight: 600; margin: 0; color: var(--fg); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.op-progress { height: 6px; border-radius: 999px; background: var(--chip-bg); overflow: hidden; }
.op-progress-fill { height: 100%; background: var(--accent); transition: width 0.2s; }
.iac-sub { font-size: 12px; color: var(--fg-muted); }
.iac-err-text { color: var(--remove-fg); }
.iac-dismiss {
  flex: 0 0 auto; font-size: 12.5px; padding: 5px 14px; cursor: pointer; border-radius: 999px;
  color: var(--fg); background: var(--chip-bg); border: 1px solid var(--chip-border);
}
</style>
