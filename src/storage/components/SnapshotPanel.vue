<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSnapshotStore } from '../stores/snapshot'
import { resolveSnapshotState } from '../util/snapshotView'

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

// Vue2 的 state watcher(SnapshotPanel.vue:160-164):只在"变成 enabled"这一刻拉策略,
// 每次转换只拉一次(初次加载即 enabled 也算一次转换)。
watch(state, (val, oldVal) => {
  if (val === 'enabled' && oldVal !== 'enabled') store.loadPolicy(props.volumeUuid)
})

onMounted(() => { store.loadVolume(props.volumeUuid) })

function onToggle() {
  store.toggle(props.volumeUuid, !(store.volume?.enabled ?? false))
}
</script>

<template>
  <div v-if="!store.volumeLoading" class="sp-card">
    <div class="sp-title">{{ t('snapTitle') }}</div>

    <!-- 不支持:无开关,只有一行说明(Vue2 SnapshotPanel.vue:4-9) -->
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
          <div class="sp-policy-summary sp-muted">{{ policySummaryText }}</div>
          <!-- 高级设置按钮 + 表单:P5 T4 -->
        </div>
        <!-- 手动创建快照行:P5 T4 -->
      </template>

      <div v-if="state === 'disabled' && (store.volume?.count ?? 0) > 0" class="sp-row sp-kept">
        <span class="sp-muted">{{ t('snapKept') }}</span>
      </div>

      <!-- 快照历史时间线:P5 T5 -->
    </template>
  </div>
</template>

<style scoped>
/* 结构照 StorageRaidDetail 的 .rd-card —— scoped 样式不穿透子组件,与 Vue2
   SnapshotPanel 重复 .info-card 是同一个原因(见 Vue2:260-261 注释)。 */
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
</style>
