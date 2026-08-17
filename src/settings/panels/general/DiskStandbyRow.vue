<script setup lang="ts">
// Corresponds to Vue2 SettingsPanel.vue L157-173 + watcher L1230-1237.
// Porting discipline #2: Vue2's `barData.disk_standby` watcher also fires on the initial
// hydrate, so opening the settings page sends a disk standby command every time. Here it only fires on user change.
// Two things must happen: ① patch the config (for the old UI and next boot to read) ② send the command immediately (takes effect this session).
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import SettingsRow from '../../components/SettingsRow.vue'
import { STANDBY_OPTIONS, parseStandbyMinutes } from '../../util/standby'
import { readSystemConfig, patchSystemConfig, SYSTEM_DEFAULTS } from '../../util/systemConfig'
import { useToast } from '../../../stores/toast'
import '../../styles/settings.css'

const { t } = useI18n()
const toast = useToast()
const value = ref<string>(SYSTEM_DEFAULTS.disk_standby as string)

// Race guard (review fix 3, same rationale as TimezoneRow.vue): under real network latency, the
// user may already have changed the selection and sent the correct command before onMounted's
// read returns — the read callback must not overwrite the displayed value with the server's stale snapshot again. An inline boolean flag, not extracted into a shared helper.
let touched = false

onMounted(async () => {
  const cfg = await readSystemConfig()
  if (touched) return
  if (typeof cfg.disk_standby === 'string' && cfg.disk_standby) value.value = cfg.disk_standby
})

async function onChange(e: Event) {
  touched = true
  const next = (e.target as HTMLSelectElement).value
  value.value = next
  try {
    await patchSystemConfig({ disk_standby: next })
  } catch (err) {
    // Review fix round 2 · Important: this is the config write itself failing, not the case
    // described by the comment below ("config already persisted, just the command send failed" —
    // that one only applies to the setDiskStandby call further down) — here the persist
    // genuinely failed, and the user must be told.
    console.warn('[settings] save disk_standby failed', err)
    toast.show(t('settingsSaveFailed'))
  }
  try {
    await service.sys.setDiskStandby({ minutes: parseStandbyMinutes(next) })
  } catch (err) {
    // Config already persisted, just this command send failed → warn but don't snap the select back
    console.warn('[settings] apply disk standby failed', err)
    toast.show(t('settingsSaveFailed'))
  }
}
</script>

<template>
  <SettingsRow :label="t('settingsDiskStandby')">
    <template #control>
      <select class="set-select" :value="value" @change="onChange">
        <option v-for="o in STANDBY_OPTIONS" :key="o.value" :value="o.value">{{ t(o.labelKey) }}</option>
      </select>
    </template>
  </SettingsRow>
</template>
