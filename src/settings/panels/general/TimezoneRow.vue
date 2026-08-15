<script setup lang="ts">
// Corresponds to Vue2 SettingsPanel.vue L138-154.
// Porting discipline #1: Vue2's barData deep watcher fires **the moment loading completes**
// and writes the just-read config straight back to the server (a wasted write every time settings opens). Here we only patch on user change.
// Note: the timezone is currently only consumed by Vue2's clock widget (New-UI has no
// counterpart widget yet), but both UIs share the same server-side system blob —
// changing it here really does affect the old UI's clock; it is not a no-op.
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import SettingsRow from '../../components/SettingsRow.vue'
import { TIMEZONES } from '../../util/timezones'
import { readSystemConfig, patchSystemConfig, SYSTEM_DEFAULTS } from '../../util/systemConfig'
import { useToast } from '../../../stores/toast'
import '../../styles/settings.css'

const { t } = useI18n()
const toast = useToast()
const value = ref<string>(SYSTEM_DEFAULTS.timezone as string)

// Race guard (review fix 3, not hypothetical — this repo has repeatedly tripped on "async
// write to shared state missing a stale/touched guard"): onMounted's readSystemConfig() is a
// real network request; if the user manually picks a different timezone before it returns,
// the read result must not overwrite the value the user just picked. Once the user changes
// the selection, touched is set true; the read callback checks this local flag — not put into a shared store / shared composable (a previous review already ruled: write this guard inline, do not abstract it).
let touched = false

onMounted(async () => {
  const cfg = await readSystemConfig()
  if (touched) return
  if (typeof cfg.timezone === 'string' && cfg.timezone) value.value = cfg.timezone
})

async function onChange(e: Event) {
  touched = true
  const next = (e.target as HTMLSelectElement).value
  value.value = next
  try {
    await patchSystemConfig({ timezone: next })
  } catch (err) {
    // Review fix round 2 · Important: previously only console.warn — the user had no indication and assumed it had saved.
    console.warn('[settings] save timezone failed', err)
    toast.show(t('settingsSaveFailed'))
  }
}
</script>

<template>
  <SettingsRow :label="t('settingsTimezone')">
    <template #control>
      <select class="set-select" :value="value" @change="onChange">
        <option v-for="tz in TIMEZONES" :key="tz.value" :value="tz.value">{{ tz.label }}</option>
      </select>
    </template>
  </SettingsRow>
</template>
