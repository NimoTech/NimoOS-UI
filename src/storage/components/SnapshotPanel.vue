<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSnapshotStore } from '../stores/snapshot'
import { resolveSnapshotState, validatePolicyForm, type PolicyForm } from '../util/snapshotView'
import SnapshotTimeline from './SnapshotTimeline.vue'

defineOptions({ name: 'SnapshotPanel' })

const props = defineProps<{ volumeUuid: string }>()
const store = useSnapshotStore()
const { t } = useI18n()

const state = computed(() => resolveSnapshotState(store.volume))

const statusText = computed(() => {
  const v = store.volume
  if (!v) return ''
  if (!v.count && !v.last_at) return t('snapNoneYet')
  const time = v.last_at ? new Date(v.last_at).toLocaleString() : t('snapNever')
  return t('snapStatus', { n: v.count, time })
})

const pausedText = computed(() => {
  const reason = store.volume?.paused_reason
  return reason ? t('snapPaused', { reason }) : ''
})

const policySummaryText = computed(() => {
  const p = store.policy
  if (!p) return ''
  return t('snapPolicySummary', { hourly: p.hourly_keep, daily: p.daily_keep, weekly: p.weekly_keep })
})

// Vue2's state watcher (SnapshotPanel.vue:160-164): only fetches the policy at the moment it
// "becomes enabled", once per transition (loading already enabled on first load also counts as one transition).
watch(state, (val, oldVal) => {
  if (val === 'enabled' && oldVal !== 'enabled') store.loadPolicy(props.volumeUuid)
})

// Must-fix 1 (Critical): the store singleton survives across routes. When switching arrays
// (/storage/raid/7 → /storage/raid/8), if vue-router reuses the StorageRaidDetail instance,
// this component's first frame may receive the old volumeUuid prop, with the prop only updating
// to the new volume afterward — without this watcher it would keep showing the old volume's
// toggle/count/policy summary while writing the protection toggle and retention policy against
// props.volumeUuid (the new volume). reset() flips volumeLoading back to true, collapsing the
// panel and unmounting/remounting the embedded SnapshotTimeline along with it, so it doesn't
// carry over the old expanded state.
onMounted(() => { store.reset(); store.loadVolume(props.volumeUuid) })
watch(() => props.volumeUuid, (uuid) => { store.reset(); store.loadVolume(uuid) })

function onToggle() {
  store.toggle(props.volumeUuid, !(store.volume?.enabled ?? false))
}

// --- Advanced retention policy form (Vue2 SnapshotPanel.vue:209-223) ----------------------
const advancedOpen = ref(false)
const policyForm = ref<PolicyForm>({ hourly_keep: 24, daily_keep: 7, weekly_keep: 4, pause_threshold_pct: 90 })
const fieldErrors = ref<Partial<Record<keyof PolicyForm, string>>>({})
const manualLabel = ref('')

function openAdvanced() {
  const p = store.policy
  // Wrapped in Number(): the backend may serialize these fields as numeric strings; without
  // normalizing them, validatePolicyForm's Number.isInteger check would wrongly flag valid
  // values as invalid (a string is never an integer), needlessly blocking the user from saving.
  policyForm.value = {
    hourly_keep: Number(p?.hourly_keep ?? 24),
    daily_keep: Number(p?.daily_keep ?? 7),
    weekly_keep: Number(p?.weekly_keep ?? 4),
    pause_threshold_pct: Number(p?.pause_threshold_pct ?? 90),
  }
  fieldErrors.value = {}
  advancedOpen.value = true
}

function cancelAdvanced() {
  advancedOpen.value = false
  fieldErrors.value = {}
}

async function onSavePolicy() {
  const { valid, errors } = validatePolicyForm(policyForm.value)
  fieldErrors.value = errors
  if (!valid) return
  const ok = await store.savePolicy(props.volumeUuid, { ...policyForm.value })
  if (ok) advancedOpen.value = false
}

// --- Manually create a snapshot (Vue2 SnapshotPanel.vue:240-254) --------------------------
async function onCreateSnapshot() {
  const ok = await store.createSnapshot(props.volumeUuid, manualLabel.value)
  if (ok) manualLabel.value = ''   // Same as Vue2: only clears the note on success
}
</script>

<template>
  <div v-if="!store.volumeLoading" class="sp-card">
    <div class="sp-title">{{ t('snapTitle') }}</div>

    <!-- Unsupported: no toggle, just a single line of explanation (Vue2 SnapshotPanel.vue:4-9) -->
    <div v-if="state === 'unsupported'" class="sp-row sp-unsupported">
      <span class="sp-muted">{{ t('snapUnsupported') }}</span>
    </div>

    <template v-else>
      <div class="sp-row">
        <span class="sp-key">{{ t('snapTitle') }}</span>
        <button
          type="button"
          class="sp-switch"
          role="switch"
          :aria-checked="store.volume?.enabled === true"
          :aria-label="t('snapTitle')"
          :class="{ on: store.volume?.enabled }"
          :disabled="store.toggling"
          @click="onToggle"
        ><span class="sp-switch-thumb"></span></button>
      </div>

      <div v-if="state === 'disabled'" class="sp-row">
        <span class="sp-muted">{{ t('snapDisabledHint') }}</span>
      </div>

      <template v-if="state === 'enabled'">
        <div class="sp-row sp-status"><span class="sp-muted">{{ statusText }}</span></div>
        <div v-if="pausedText" class="sp-row sp-paused"><span>⚠️ {{ pausedText }}</span></div>
        <div class="sp-row sp-kept"><span class="sp-muted">{{ t('snapKept') }}</span></div>
        <div class="sp-row sp-policy-row">
          <div class="sp-policy-wrap">
            <div v-if="!advancedOpen" class="sp-policy-summary sp-muted">{{ policySummaryText }}</div>
            <div v-else class="sp-advanced">
              <label class="sp-field">
                <span class="sp-field-label">{{ t('snapHourlyKeep') }}</span>
                <input class="sp-num sp-in-hourly" type="number" min="1" v-model.number="policyForm.hourly_keep" />
                <span v-if="fieldErrors.hourly_keep" class="sp-err sp-err-hourly">{{ t(fieldErrors.hourly_keep) }}</span>
              </label>
              <label class="sp-field">
                <span class="sp-field-label">{{ t('snapDailyKeep') }}</span>
                <input class="sp-num sp-in-daily" type="number" min="1" v-model.number="policyForm.daily_keep" />
                <span v-if="fieldErrors.daily_keep" class="sp-err sp-err-daily">{{ t(fieldErrors.daily_keep) }}</span>
              </label>
              <label class="sp-field">
                <span class="sp-field-label">{{ t('snapWeeklyKeep') }}</span>
                <input class="sp-num sp-in-weekly" type="number" min="1" v-model.number="policyForm.weekly_keep" />
                <span v-if="fieldErrors.weekly_keep" class="sp-err sp-err-weekly">{{ t(fieldErrors.weekly_keep) }}</span>
              </label>
              <label class="sp-field">
                <span class="sp-field-label">{{ t('snapPauseThreshold') }}</span>
                <input class="sp-num sp-in-pct" type="number" min="1" max="100" v-model.number="policyForm.pause_threshold_pct" />
                <span v-if="fieldErrors.pause_threshold_pct" class="sp-err sp-err-pct">{{ t(fieldErrors.pause_threshold_pct) }}</span>
              </label>
              <div class="sp-adv-actions">
                <button class="sp-save" type="button" :disabled="store.policySaving" @click="onSavePolicy">{{ t('snapSave') }}</button>
                <button class="sp-cancel-adv" type="button" :disabled="store.policySaving" @click="cancelAdvanced">{{ t('storageCancel') }}</button>
              </div>
            </div>
          </div>
          <button v-if="!advancedOpen" class="sp-advanced-btn" type="button" @click="openAdvanced">{{ t('snapAdvanced') }}</button>
        </div>

        <div class="sp-row sp-manual-row">
          <input
            class="sp-label-input"
            type="text"
            v-model="manualLabel"
            :placeholder="t('snapLabelPlaceholder')"
            :disabled="store.creatingSnapshot"
          />
          <button class="sp-create" type="button" :disabled="store.creatingSnapshot" @click="onCreateSnapshot">
            {{ t('snapCreateNow') }}
          </button>
        </div>
      </template>

      <div v-if="state === 'disabled' && (store.volume?.count ?? 0) > 0" class="sp-row sp-kept">
        <span class="sp-muted">{{ t('snapKept') }}</span>
      </div>

      <!-- Visibility mirrors Vue2 SnapshotPanel.vue:99-102 1:1: when enabled, or when disabled but historical snapshots still exist -->
      <SnapshotTimeline
        v-if="state === 'enabled' || (state === 'disabled' && (store.volume?.count ?? 0) > 0)"
        :volume-uuid="volumeUuid"
      />
    </template>
  </div>
</template>

<style scoped>
/* Structure mirrors StorageRaidDetail's .rd-card — scoped styles don't pierce child components,
   the same reason this duplicates .info-card from Vue2 SnapshotPanel (see the Vue2:260-261 comment). */
.sp-card { background: var(--card-bg); border: 1px solid var(--card-border); border-radius: var(--radius-sm); overflow: hidden; margin-bottom: 14px; }
.sp-title { font-size: 11px; font-weight: 600; color: var(--fg-muted); text-transform: uppercase; letter-spacing: 0.4px; padding: 8px 12px; border-bottom: 1px solid var(--card-border); }
.sp-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 7px 12px; border-bottom: 1px solid var(--card-border); font-size: 12.5px; }
.sp-row:last-child { border-bottom: none; }
.sp-key { color: var(--fg-muted); }
.sp-muted { color: var(--fg-muted); font-size: 12px; }
.sp-paused { color: var(--dem-fg); font-size: 12px; }
.sp-policy-row { align-items: flex-start; }

.sp-switch {
  position: relative; width: 38px; height: 21px; flex: none; padding: 0; cursor: pointer;
  border-radius: 999px; border: 1px solid var(--chip-border); background: var(--chip-bg);
  transition: background 0.15s var(--ease), border-color 0.15s var(--ease);
}
.sp-switch.on { background: var(--accent); border-color: var(--accent); }
.sp-switch:disabled { opacity: 0.55; cursor: not-allowed; }
.sp-switch-thumb {
  position: absolute; top: 2px; left: 2px; width: 15px; height: 15px; border-radius: 50%;
  background: var(--fg); transition: transform 0.15s var(--ease);
}
.sp-switch.on .sp-switch-thumb { transform: translateX(17px); background: var(--on-accent); }

.sp-policy-wrap { flex: 1 1 auto; min-width: 0; }
.sp-advanced { display: flex; flex-direction: column; gap: 8px; width: 100%; }
.sp-field { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 12px; color: var(--fg-muted); }
.sp-field-label { flex: 1 1 auto; }
.sp-num, .sp-label-input {
  box-sizing: border-box; padding: 5px 9px; font-size: 12.5px; border-radius: 8px;
  border: 1px solid var(--chip-border); background: var(--chip-bg); color: var(--fg); outline: none;
}
.sp-num { width: 88px; font-family: var(--num-font); }
.sp-num:focus, .sp-label-input:focus { border-color: var(--accent); }
.sp-num:disabled, .sp-label-input:disabled { opacity: 0.55; }
.sp-err { flex: 1 0 100%; color: var(--remove-fg); font-size: 11px; }
.sp-adv-actions { display: flex; gap: 8px; margin-top: 2px; }
.sp-manual-row { gap: 8px; }
.sp-label-input { flex: 1 1 auto; min-width: 0; }
.sp-advanced-btn, .sp-save, .sp-cancel-adv, .sp-create {
  padding: 5px 12px; border-radius: 999px; font-size: 12px; cursor: pointer; white-space: nowrap;
  border: 1px solid var(--chip-border); background: var(--chip-bg); color: var(--fg);
}
.sp-save, .sp-create { border-color: var(--accent); color: var(--accent); }
.sp-advanced-btn:hover, .sp-save:hover, .sp-cancel-adv:hover, .sp-create:hover { background: var(--chip-bg-hi); }
.sp-save:disabled, .sp-cancel-adv:disabled, .sp-create:disabled { opacity: 0.45; cursor: not-allowed; }
</style>
