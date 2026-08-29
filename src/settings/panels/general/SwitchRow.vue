<script setup lang="ts">
// A toggle row for one boolean field in the server's system blob. Reused in two places:
//   - Recommended apps (Vue2 L220-226, saves directly)
//   - News feed (Vue2 L229-236 + rssConfirm L1696-1715, confirms **only when turning on**)
// The "show other Docker container apps" row is not implemented -- Vue2 never rendered it
// either (debt D15, see plan §measured-correction 4).
//
// Porting discipline #1: loading never writes back; only patch when the user toggles
// it, and only write that one field of its own
// (a full-blob overwrite would race with other rows/languages, see the serial queue in
// systemConfig.ts).
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import SettingsRow from '../../components/SettingsRow.vue'
import SettingsSwitch from '../../components/SettingsSwitch.vue'
import AlertDialog from '../../../components/ui/AlertDialog.vue'
import { readSystemConfig, patchSystemConfig, SYSTEM_DEFAULTS } from '../../util/systemConfig'
import { useToast } from '../../../stores/toast'
import '../../styles/settings.css'

const props = defineProps<{
  field: string
  labelKey: string
  /** the "confirm before turning on" behavior is only enabled when all three confirm* props are given */
  confirmTitleKey?: string
  confirmMsgKey?: string
  confirmOkKey?: string
}>()

const { t } = useI18n()
const toast = useToast()

const on = ref<boolean>(SYSTEM_DEFAULTS[props.field] === true)
const busy = ref(false)
const confirmOpen = ref(false)

// Interleaving guard (same rationale as DiskStandbyRow.vue / WebUiPortRow.vue): under
// real network latency, the user may have already flipped the toggle (saved directly,
// or gone through the confirm dialog) before onMounted's read has returned --
// the read callback must not flush the displayed value back to the server's stale
// snapshot. An in-place boolean flag, no shared helper extracted
// (a previous review in this repo ruled that cross-component abstraction here was
// premature).
let touched = false

onMounted(async () => {
  const cfg = await readSystemConfig()
  if (touched) return
  if (typeof cfg[props.field] === 'boolean') on.value = cfg[props.field] as boolean
})

async function save(next: boolean) {
  // Review fix round 2 · Minor: touched must only be set at the moment we actually
  // save, not the moment onToggle opens the confirm dialog (prior pitfall: the confirm
  // dialog opened but the user clicked cancel, touched was already true, and a
  // late-arriving hydrate could never pull the row back to the server's real value --
  // behavior stayed permanently stuck on an old displayed value the user never
  // confirmed).
  touched = true
  const prev = on.value
  on.value = next
  busy.value = true
  try {
    await patchSystemConfig({ [props.field]: next })
  } catch (e) {
    on.value = prev
    toast.show(t('settingsSaveFailed'))
    console.warn('[settings] save switch failed', props.field, e)
  } finally {
    busy.value = false
  }
}

function onToggle(next: boolean) {
  // Confirmation is only needed in the "turn on" direction; turning off saves directly (matches the !rss_switch branch of Vue2 rssConfirm)
  if (next && props.confirmMsgKey) {
    confirmOpen.value = true
    return
  }
  void save(next)
}

function onConfirm() {
  confirmOpen.value = false
  void save(true)
}
</script>

<template>
  <SettingsRow :label="t(labelKey)">
    <template #control>
      <SettingsSwitch
        :model-value="on"
        :label="t(labelKey)"
        :disabled="busy"
        @update:model-value="onToggle"
      />
    </template>
  </SettingsRow>

  <AlertDialog
    v-if="confirmMsgKey && confirmTitleKey && confirmOkKey"
    :open="confirmOpen"
    :title="t(confirmTitleKey)"
    :message="t(confirmMsgKey)"
    :confirm-text="t(confirmOkKey)"
    :cancel-text="t('settingsCancel')"
    @update:open="confirmOpen = $event"
    @confirm="onConfirm"
  />
</template>
