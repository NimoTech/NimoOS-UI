<script setup lang="ts">
// Corresponds to Vue2 SettingsPanel.vue L211-217 (lines) + getUsbStatus L1442 / usbAutoMount L1449.
// Porting discipline: Vue2's usbAutoMount() is fire-and-forget (no await, no result check) —
// when the request fails, the switch stays in its new position and the UI lies. Changed here to snap back on failure.
// Raspberry Pi warning: Vue2 checks whether hardwareInfo().drive_model contains "raspberry"
// (the LocalStorage service silently force-disables USB auto-mount on Raspberry Pi).
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import SettingsRow from '../../components/SettingsRow.vue'
import SettingsSwitch from '../../components/SettingsSwitch.vue'
import { useToast } from '../../../stores/toast'
import '../../styles/settings.css'

const { t } = useI18n()
const toast = useToast()

const on = ref(false)
const busy = ref(false)
const isRpi = ref(false)
const warn = ref('')

// Race guard (same rationale as DiskStandbyRow.vue / WebUiPortRow.vue): under real network latency,
// the user may click the switch before either of onMounted's two reads returns — the read
// callback must not overwrite the displayed value with the server's stale snapshot. An inline boolean flag, not extracted into a shared helper (a prior review in this repo ruled that premature abstraction).
let touched = false

onMounted(async () => {
  // `service.sys` is a getter that throws synchronously before initService() runs.
  // Reading it while the array literal is being evaluated puts that throw outside
  // allSettled's protection, so it escapes as an unhandled rejection. Wrapping
  // each call in an async thunk moves the getter access inside the promise, where
  // allSettled can catch it. Production never hits this (main.ts initialises
  // first), but any entry point mounting a settings component earlier would.
  await Promise.allSettled([
    (async () => {
      const v = await service.sys.getUsbStatus()
      if (!touched) on.value = v
    })(),
    (async () => {
      const hw = await service.sys.hardwareInfo()
      const model = typeof hw.drive_model === 'string' ? hw.drive_model : ''
      isRpi.value = model.toLowerCase().includes('raspberry')
    })(),
  ])
})

async function onToggle(next: boolean) {
  if (busy.value) return
  touched = true
  const prev = on.value
  on.value = next            // optimistic flip
  busy.value = true
  warn.value = ''
  try {
    await service.sys.toggleUsbAutoMount({ state: next ? 'on' : 'off' })
    // The warning only applies to the "on" direction
    if (next && isRpi.value) warn.value = t('settingsUsbRpiWarn')
  } catch (e) {
    on.value = prev          // snap back on failure (Vue2 does not; its UI lies)
    toast.show(t('settingsSaveFailed'))
    console.warn('[settings] toggleUsbAutoMount failed', e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <SettingsRow :label="t('settingsUsbAutoMount')">
    <template #control>
      <SettingsSwitch
        :model-value="on"
        :label="t('settingsUsbAutoMount')"
        :disabled="busy"
        @update:model-value="onToggle"
      />
    </template>
    <template v-if="warn" #hint><span class="set-warn">{{ warn }}</span></template>
  </SettingsRow>
</template>
