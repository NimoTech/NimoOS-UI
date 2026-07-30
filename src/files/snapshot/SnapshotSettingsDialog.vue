<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Dialog from '../../components/ui/Dialog.vue'
import { useSnapshotStore } from '../../storage/stores/snapshot'
import { resolveSnapshotState, validatePolicyForm, type PolicyForm } from '../../storage/util/snapshotView'

defineOptions({ name: 'SnapshotSettingsDialog' })

const props = defineProps<{ open: boolean; volumeUuid: string; mountPoint: string }>()
const emit = defineEmits<{ (e: 'update:open', v: boolean): void; (e: 'snapshot-created'): void }>()

const { t } = useI18n()
const store = useSnapshotStore()
const state = computed(() => resolveSnapshotState(store.volume))

const form = ref<PolicyForm>({ hourly_keep: 24, daily_keep: 7, weekly_keep: 4, pause_threshold_pct: 90 })
const errors = ref<Partial<Record<keyof PolicyForm, string>>>({})
const manualLabel = ref('')

// 打开(或换卷)时拉数据;策略落地后把本地表单同步成后端当前值。Number() 包裹的理由同
// SnapshotPanel.vue openAdvanced:后端可能把这些字段序列化成数字字符串,不归一的话
// validatePolicyForm 里的 Number.isInteger 会把合法值误判为非法。
watch(
  () => [props.open, props.volumeUuid] as const,
  async ([open, uuid]) => {
    if (!open || !uuid) return
    errors.value = {}
    await Promise.all([store.loadVolume(uuid), store.loadPolicy(uuid)])
    const p = store.policy
    if (p) {
      form.value = {
        hourly_keep: Number(p.hourly_keep ?? 24),
        daily_keep: Number(p.daily_keep ?? 7),
        weekly_keep: Number(p.weekly_keep ?? 4),
        pause_threshold_pct: Number(p.pause_threshold_pct ?? 90),
      }
    }
  },
  { immediate: true },
)

function onToggle() {
  store.toggle(props.volumeUuid, !(store.volume?.enabled ?? false))
}

async function onSave() {
  const { valid, errors: errs } = validatePolicyForm(form.value)
  errors.value = errs
  if (!valid) return
  await store.savePolicy(props.volumeUuid, { ...form.value })
}

async function onCreate() {
  const ok = await store.createSnapshot(props.volumeUuid, manualLabel.value)
  if (ok) {
    manualLabel.value = ''
    emit('snapshot-created')
  }
}
</script>

<template>
  <Dialog :open="props.open" :title="t('tmSettings')" @update:open="emit('update:open', $event)">
    <p class="ss-mount">{{ props.mountPoint }}</p>

    <p v-if="state === 'unsupported'" class="ss-note">{{ t('snapUnsupported') }}</p>

    <template v-else>
      <div class="ss-row">
        <span class="ss-key">{{ t('snapTitle') }}</span>
        <!-- 开关按钮不放文字:snapToggleOn/Off 是过去式的 toast 文案("已开启/已关闭快照
             保护"),当按钮标签读着别扭;这里照 SnapshotPanel.vue 的 .sp-switch 写法做成
             纯图形开关(role=switch + aria-checked + aria-label),不新增 i18n 键。 -->
        <button
          type="button"
          class="snap-set-toggle ss-switch"
          role="switch"
          :aria-checked="store.volume?.enabled === true"
          :aria-label="t('snapTitle')"
          :class="{ on: store.volume?.enabled }"
          :disabled="store.toggling"
          @click="onToggle"
        ><span class="ss-switch-thumb"></span></button>
      </div>

      <p v-if="state === 'disabled'" class="ss-note">{{ t('snapDisabledHint') }}</p>

      <template v-if="state === 'enabled'">
        <!-- 字段常驻不折叠:这个弹窗存在的理由就是让人改这些值(与存储区那个空间受限的
             侧栏面板不同,SnapshotPanel.vue 才需要"高级设置"折叠)。 -->
        <div class="snap-set-fields ss-fields">
          <label class="ss-field">
            <span class="ss-field-label">{{ t('snapHourlyKeep') }}</span>
            <input class="ss-num" type="number" min="1" v-model.number="form.hourly_keep" />
            <em v-if="errors.hourly_keep" class="ss-err">{{ t(errors.hourly_keep) }}</em>
          </label>
          <label class="ss-field">
            <span class="ss-field-label">{{ t('snapDailyKeep') }}</span>
            <input class="ss-num" type="number" min="1" v-model.number="form.daily_keep" />
            <em v-if="errors.daily_keep" class="ss-err">{{ t(errors.daily_keep) }}</em>
          </label>
          <label class="ss-field">
            <span class="ss-field-label">{{ t('snapWeeklyKeep') }}</span>
            <input class="ss-num" type="number" min="1" v-model.number="form.weekly_keep" />
            <em v-if="errors.weekly_keep" class="ss-err">{{ t(errors.weekly_keep) }}</em>
          </label>
          <label class="ss-field">
            <span class="ss-field-label">{{ t('snapPauseThreshold') }}</span>
            <input class="ss-num" type="number" min="1" max="100" v-model.number="form.pause_threshold_pct" />
            <em v-if="errors.pause_threshold_pct" class="ss-err">{{ t(errors.pause_threshold_pct) }}</em>
          </label>
          <button type="button" class="snap-set-save ss-save" :disabled="store.policySaving" @click="onSave">
            {{ t('snapSave') }}
          </button>
        </div>

        <div class="ss-row ss-create-row">
          <input
            class="snap-set-label ss-label-input"
            type="text"
            v-model="manualLabel"
            :placeholder="t('snapLabelPlaceholder')"
            :disabled="store.creatingSnapshot"
          />
          <button type="button" class="snap-set-create ss-create" :disabled="store.creatingSnapshot" @click="onCreate">
            {{ t('snapCreateNow') }}
          </button>
        </div>
      </template>
    </template>
  </Dialog>
</template>

<style scoped>
.ss-mount { margin: 0 0 12px; font-size: 12px; color: var(--fg-muted); }
.ss-note { margin: 0; font-size: 12.5px; color: var(--fg-muted); }
.ss-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 8px 0; }
.ss-key { color: var(--fg-muted); font-size: 13px; }

.ss-switch {
  position: relative; width: 38px; height: 21px; flex: none; padding: 0; cursor: pointer;
  border-radius: 999px; border: 1px solid var(--border); background: var(--chip-bg, transparent);
  transition: background 0.15s var(--ease), border-color 0.15s var(--ease);
}
.ss-switch.on { background: var(--accent); border-color: var(--accent); }
.ss-switch:disabled { opacity: 0.55; cursor: not-allowed; }
.ss-switch-thumb {
  position: absolute; top: 2px; left: 2px; width: 15px; height: 15px; border-radius: 50%;
  background: var(--fg); transition: transform 0.15s var(--ease);
}
.ss-switch.on .ss-switch-thumb { transform: translateX(17px); background: var(--on-accent); }

.ss-fields { display: flex; flex-direction: column; gap: 10px; margin-top: 4px; }
.ss-field { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 12.5px; color: var(--fg-muted); }
.ss-field-label { flex: 1 1 auto; }
.ss-num, .ss-label-input {
  box-sizing: border-box; padding: 6px 10px; font-size: 12.5px; border-radius: 8px;
  border: 1px solid var(--border); background: transparent; color: var(--fg); outline: none;
}
.ss-num { width: 90px; }
.ss-num:focus, .ss-label-input:focus { border-color: var(--accent); }
.ss-num:disabled, .ss-label-input:disabled { opacity: 0.55; }
.ss-err { flex: 1 0 100%; color: var(--dem-fg); font-size: 11px; }

.ss-save, .ss-create {
  align-self: flex-start; padding: 6px 14px; border-radius: 999px; font-size: 12.5px; cursor: pointer;
  border: 1px solid var(--accent); background: transparent; color: var(--accent);
}
.ss-save:hover, .ss-create:hover { background: color-mix(in srgb, var(--accent) 16%, transparent); }
.ss-save:disabled, .ss-create:disabled { opacity: 0.45; cursor: not-allowed; }

.ss-create-row { gap: 8px; }
.ss-label-input { flex: 1 1 auto; min-width: 0; }
</style>
