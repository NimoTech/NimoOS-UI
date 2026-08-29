<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { RaidStatus } from '@nimotech/nimoos-service'
import type { ReplaceTask } from '../util/raidView'
import { useRaidEta } from '../composables/useRaidEta'

// Dashboard card for an in-progress drive replacement. Visually matches RaidCreatingCard
// (same spinner / label / progress bar sizing), but the progress source differs: creation has
// a backend task's step/progress, replacement does not — the backend replace API is
// synchronous, and the rebuild runs in the kernel, so all we can read is
// status.rebuild_pct (see the note at storage.ts's replaceTask).
//
// Progress is therefore **hybrid**, in two segments:
//   rebuild_pct < 0 (kernel hasn't taken over / hasn't started reporting yet) → the same
//     left-right sweeping indeterminate bar as the creation card
//   rebuild_pct >= 0                                                          → a real
//     percentage bar + number + time remaining + speed
// We avoid "always show 0%" — in the first few seconds after submission that would look like
// it's stuck.
const props = defineProps<{ task: ReplaceTask; status?: RaidStatus | null }>()
defineEmits<{ (e: 'dismiss'): void }>()
const { t } = useI18n()

const pct = computed(() => {
  const v = Number(props.status?.rebuild_pct)
  return Number.isFinite(v) ? v : -1
})
const hasPct = computed(() => pct.value >= 0)
const pctText = computed(() => `${Math.round(pct.value * 10) / 10}%`)
// Time remaining: prefers rebuild_eta_seconds, alternating every 5s between duration and
// completion time; falls back to the raw kernel string for older backends
const { etaText } = useRaidEta(() => props.status)
const speed = computed(() => (props.status?.rebuild_speed as string) || '')
</script>

<template>
  <article class="rpc-card">
    <div class="rpc-left"><div class="rpc-spinner" /></div>
    <div class="rpc-body">
      <div class="rpc-name">{{ task.arrayName }}</div>
      <div class="rpc-meta">
        {{ task.oldPath }} → {{ task.newPath }}
        <span v-if="etaText"> · {{ etaText }}</span>
        <span v-if="speed"> · {{ t('raidRebuildSpeed') }} {{ speed }}</span>
      </div>
    </div>
    <div class="rpc-right">
      <span class="rpc-tag">{{ t('raidReplacing') }}</span>
      <!-- Real percentage available: determinate progress bar + number -->
      <div v-if="hasPct" class="rpc-pctwrap">
        <div class="rpc-track"><div class="rpc-fill-det" :style="{ width: Math.min(100, Math.max(0, pct)) + '%' }" /></div>
        <span class="rpc-pct">{{ pctText }}</span>
      </div>
      <!-- Kernel hasn't reported numbers yet: indeterminate sweeping bar (same as the creation card) -->
      <div v-else class="rpc-track"><div class="rpc-fill-indet" /></div>
      <!-- Escape hatch: if the rebuild ever gets stuck (kernel never takes over, drive drops
           out again), the dashboard shouldn't spin forever with no way to close it. The card
           disappears automatically on completion — the user shouldn't need to click here;
           this button only exists as a fallback for the stuck case. -->
      <button class="rpc-dismiss" type="button" :title="t('raidReplacingDismiss')" @click="$emit('dismiss')">✕</button>
    </div>
  </article>
</template>

<style scoped>
.rpc-card {
  display: flex; align-items: center; gap: 12px; padding: 14px 16px;
  background: var(--card-bg); border: 1px solid var(--accent-soft-bd); border-radius: var(--radius-sm);
  margin-bottom: 12px;
}
.rpc-left { flex: none; display: flex; }
.rpc-spinner {
  width: 20px; height: 20px; border-radius: 50%; flex-shrink: 0;
  border: 2.5px solid var(--accent-soft); border-top-color: var(--accent);
  animation: rpc-spin 0.9s linear infinite;
}
@keyframes rpc-spin { to { transform: rotate(360deg); } }
.rpc-body { flex: 1; min-width: 0; }
.rpc-name { font-size: 14px; font-weight: 600; color: var(--fg); margin-bottom: 3px; }
.rpc-meta {
  font-size: 11.5px; color: var(--accent-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.rpc-right { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; flex: none; }
.rpc-tag {
  font-size: 11px; font-weight: 700; padding: 1px 8px; border-radius: 999px;
  background: var(--nrm-bg); border: 1px solid var(--nrm-bd); color: var(--accent);
}
.rpc-pctwrap { display: flex; align-items: center; gap: 6px; }
.rpc-pct { font-size: 11px; font-weight: 700; color: var(--accent); font-family: var(--num-font); }
.rpc-track { width: 72px; height: 4px; border-radius: 2px; overflow: hidden; background: var(--accent-soft); }
.rpc-fill-det { height: 100%; border-radius: 2px; background: var(--accent); transition: width 0.4s var(--ease); }
.rpc-fill-indet { height: 100%; border-radius: 2px; background: var(--accent); animation: rpc-indeterminate 2s ease-in-out infinite; }
@keyframes rpc-indeterminate {
  0% { width: 0%; margin-left: 0%; }
  50% { width: 70%; margin-left: 15%; }
  100% { width: 0%; margin-left: 100%; }
}
.rpc-dismiss {
  background: transparent; border: none; cursor: pointer; font-size: 11px;
  padding: 2px 6px; border-radius: 3px; color: var(--fg-muted);
}
.rpc-dismiss:hover { background: var(--nrm-bg); color: var(--remove-fg); }
</style>
