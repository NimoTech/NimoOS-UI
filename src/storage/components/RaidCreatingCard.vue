<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { RaidTask } from '../util/raidView'

const props = defineProps<{ task: RaidTask }>()
defineEmits<{ (e: 'open-modal'): void; (e: 'dismiss'): void }>()
const { t } = useI18n()
void props
</script>

<template>
  <article class="rcc-card" :class="{ failed: task.status === 'failed' }">
    <div class="rcc-left">
      <div v-if="task.status === 'failed'" class="rcc-fail-icon">✕</div>
      <div v-else class="rcc-spinner" />
    </div>
    <div class="rcc-body">
      <div class="rcc-name">{{ task.name }}</div>
      <div class="rcc-meta" :class="{ error: task.status === 'failed' }">
        {{ t('raidTaskMeta', { level: task.level, n: task.diskCount, fs: task.filesystem }) }}
        <span v-if="task.status === 'failed'"> · {{ t('raidCreateFailed') }}</span>
        <span v-else-if="task.stepName"> · {{ task.stepName }}</span>
      </div>
    </div>
    <div class="rcc-right">
      <span class="rcc-tag" :class="task.status === 'failed' ? 'danger' : 'info'">
        {{ task.status === 'failed' ? t('raidCreateFailed') : t('raidCreating') }}
      </span>
      <div v-if="task.status !== 'failed'" class="rcc-track"><div class="rcc-fill" /></div>
      <button v-if="task.status === 'failed'" class="rcc-dismiss" type="button" @click="$emit('dismiss')">✕</button>
      <button v-else class="rcc-details" type="button" @click="$emit('open-modal')">{{ t('raidDetailsBtn') }}</button>
    </div>
  </article>
</template>

<style scoped>
.rcc-card {
  display: flex; align-items: center; gap: 12px; padding: 14px 16px;
  background: var(--card-bg); border: 1px solid var(--accent-soft-bd); border-radius: var(--radius-sm);
  margin-bottom: 12px;
}
.rcc-card.failed { border-color: var(--remove-fg); }
.rcc-left { flex: none; display: flex; }
.rcc-spinner {
  width: 20px; height: 20px; border-radius: 50%; flex-shrink: 0;
  border: 2.5px solid var(--accent-soft); border-top-color: var(--accent);
  animation: rcc-spin 0.9s linear infinite;
}
.rcc-fail-icon {
  width: 20px; height: 20px; border-radius: 50%; flex-shrink: 0;
  background: var(--nrm-bg); color: var(--remove-fg);
  display: flex; align-items: center; justify-content: center; font-size: 11px;
}
@keyframes rcc-spin { to { transform: rotate(360deg); } }
.rcc-body { flex: 1; min-width: 0; }
.rcc-name { font-size: 14px; font-weight: 600; color: var(--fg); margin-bottom: 3px; }
.rcc-meta {
  font-size: 11.5px; color: var(--accent-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.rcc-meta.error { color: var(--remove-fg); }
.rcc-right { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; flex: none; }
.rcc-tag {
  font-size: 11px; font-weight: 700; padding: 1px 8px; border-radius: 999px;
  background: var(--nrm-bg); border: 1px solid var(--nrm-bd);
}
.rcc-tag.info { color: var(--accent); }
.rcc-tag.danger { color: var(--remove-fg); }
.rcc-track { width: 72px; height: 4px; border-radius: 2px; overflow: hidden; background: var(--accent-soft); }
.rcc-fill { height: 100%; border-radius: 2px; background: var(--accent); animation: rcc-indeterminate 2s ease-in-out infinite; }
@keyframes rcc-indeterminate {
  0% { width: 0%; margin-left: 0%; }
  50% { width: 70%; margin-left: 15%; }
  100% { width: 0%; margin-left: 100%; }
}
.rcc-details, .rcc-dismiss {
  background: transparent; border: none; cursor: pointer; font-size: 11px; padding: 2px 6px; border-radius: 3px;
}
.rcc-details { color: var(--accent); }
.rcc-details:hover { background: var(--accent-soft); }
.rcc-dismiss { color: var(--remove-fg); }
.rcc-dismiss:hover { background: var(--nrm-bg); }
</style>
