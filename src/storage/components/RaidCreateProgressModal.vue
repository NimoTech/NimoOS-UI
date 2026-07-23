<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Dialog from '../../components/ui/Dialog.vue'
import type { RaidTask } from '../util/raidView'

const props = defineProps<{ open: boolean; task: RaidTask }>()
const emit = defineEmits<{ (e: 'update:open', v: boolean): void }>()
const { t } = useI18n()

// 逐字移植 Vue2 RaidCreateProgressModal.vue L112-125。
function isStepDone(n: number): boolean {
  return props.task.status === 'done' || n < props.task.step
}
function isStepActive(n: number): boolean {
  return props.task.status === 'creating' && n === props.task.step
}
function isStepFailed(n: number): boolean {
  return props.task.status === 'failed' && n === props.task.step
}

const steps = computed(() =>
  [1, 2, 3, 4, 5, 6].map((n) => ({
    n,
    label: n === 4 && props.task.filesystem
      ? t('raidStepInitFs', { fs: props.task.filesystem })
      : t('raidStep' + n),
    done: isStepDone(n),
    active: isStepActive(n),
    failed: isStepFailed(n),
  })),
)

const currentStepLabel = computed(() => {
  if (props.task.status === 'done') return t('raidCreateDone')
  if (props.task.status === 'failed') return t('raidCreateFailed')
  return t('raidStep' + props.task.step) || t('raidPreparing')
})
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <div class="rpm">
      <div class="rpm-head">
        <div v-if="task.status === 'creating'" class="rpm-spinner" />
        <span v-else-if="task.status === 'done'" class="rpm-icon done">✓</span>
        <span v-else class="rpm-icon failed">✕</span>
        <div class="rpm-head-text">
          <p class="rpm-title">{{ task.name }}</p>
          <p class="rpm-subtitle">{{ t('raidTaskMeta', { level: task.level, n: task.diskCount, fs: task.filesystem }) }}</p>
        </div>
      </div>

      <div class="rpm-progress-section">
        <progress class="rpm-progress" :class="{ failed: task.status === 'failed' }" :value="task.progress" max="100" />
        <div class="rpm-progress-labels">
          <span class="rpm-step-label">{{ currentStepLabel }}</span>
          <span class="rpm-pct" :class="{ failed: task.status === 'failed' }">{{ task.progress }}%</span>
        </div>
      </div>

      <div class="rpm-steps">
        <div
          v-for="s in steps"
          :key="s.n"
          class="rpm-step"
          :class="{ done: s.done, active: s.active, failed: s.failed, pending: !s.done && !s.active && !s.failed }"
        >
          <span class="rpm-step-icon-wrap">
            <span v-if="s.done" class="rpm-step-icon">✓</span>
            <span v-else-if="s.failed" class="rpm-step-icon">✕</span>
            <span v-else-if="s.active" class="rpm-step-spinner" />
            <span v-else class="rpm-step-icon dot">○</span>
          </span>
          <span class="rpm-step-text">{{ s.label }}</span>
        </div>
      </div>

      <div v-if="task.status === 'failed' && task.error" class="rpm-error">{{ task.error }}</div>
    </div>

    <template #footer>
      <span class="rpm-hint">{{ t('raidModalHint') }}</span>
      <span class="rpm-elapsed">{{ t('raidElapsed', { n: task.elapsedSeconds || 0 }) }}</span>
    </template>
  </Dialog>
</template>

<style scoped>
.rpm-head { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 16px; }
.rpm-spinner {
  width: 20px; height: 20px; border-radius: 50%; flex-shrink: 0; margin-top: 2px;
  border: 2.5px solid var(--accent-soft); border-top-color: var(--accent);
  animation: rpm-spin 0.9s linear infinite;
}
.rpm-icon { font-size: 18px; flex-shrink: 0; }
.rpm-icon.done { color: var(--sem-fg); }
.rpm-icon.failed { color: var(--remove-fg); }
@keyframes rpm-spin { to { transform: rotate(360deg); } }
.rpm-head-text { min-width: 0; }
.rpm-title { margin: 0 0 2px; font-size: 15px; font-weight: 700; color: var(--fg); }
.rpm-subtitle { margin: 0; font-size: 11.5px; color: var(--fg-muted); }

.rpm-progress-section { margin-bottom: 16px; }
.rpm-progress { width: 100%; height: 6px; accent-color: var(--accent); }
.rpm-progress.failed { accent-color: var(--remove-fg); }
.rpm-progress-labels { display: flex; justify-content: space-between; font-size: 11px; color: var(--fg-muted); margin-top: 4px; }
.rpm-pct { font-weight: 600; color: var(--accent); }
.rpm-pct.failed { color: var(--remove-fg); }

.rpm-steps { display: flex; flex-direction: column; gap: 6px; }
.rpm-step { display: flex; align-items: center; gap: 10px; padding: 7px 10px; border-radius: var(--radius-xs, 6px); font-size: 12px; }
.rpm-step.done { background: var(--sem-bg); color: var(--sem-fg); }
.rpm-step.active { background: var(--accent-soft); color: var(--accent-text); font-weight: 600; }
.rpm-step.failed { background: var(--drop-bad); color: var(--remove-fg); }
.rpm-step.pending { opacity: 0.45; color: var(--fg-muted); }
.rpm-step-icon-wrap { width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.rpm-step-icon { font-size: 12px; }
.rpm-step-icon.dot { font-size: 10px; }
.rpm-step-spinner {
  width: 14px; height: 14px; border-radius: 50%;
  border: 2px solid var(--accent-soft); border-top-color: var(--accent);
  animation: rpm-spin 0.9s linear infinite;
}
.rpm-step-text { flex: 1; min-width: 0; }

.rpm-error { margin-top: 12px; padding: 8px 10px; border-radius: var(--radius-xs, 6px); background: var(--drop-bad); color: var(--remove-fg); font-size: 12px; }

.rpm-hint { color: var(--fg-muted); font-size: 11px; }
.rpm-elapsed { color: var(--fg-muted); font-size: 11px; font-family: var(--num-font); }
</style>
