<script setup lang="ts">
// Corresponds to Vue2 SettingsPanel.vue L176-208 (markup) + L1385-1440 (logic).
// Flow: validate → PUT /v1/gateway/port → poll the new port's /v1/gateway/port →
// once it responds, navigate over.
// Changing the gateway port means "bring up the new port, confirm with /ping, then
// gracefully close the old port", so this page on the old port
// stays alive during the switchover window, long enough to complete the probe.
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import SettingsRow from '../../components/SettingsRow.vue'
import {
  PROBE_INTERVAL_MS, PROBE_MAX_TRIES,
  buildProbeUrl, buildRedirectUrl, probeUiPort, validatePort,
} from '../../util/checkUiPort'
import { useToast } from '../../../stores/toast'
import '../../styles/settings.css'

const { t } = useI18n()
const toast = useToast()

const port = ref('')
const originalPort = ref('')
const busy = ref(false)
const error = ref('')
const probing = ref(false)

// Navigation is made an **optional prop**: writing window.location.href directly is both
// untestable in jsdom and triggers a warning there.
// Using a prop instead of a defineExpose test backdoor — the latter would be a
// production API that exists only for testing.
const props = defineProps<{ navigate?: (url: string) => void }>()
function go(url: string) {
  if (props.navigate) props.navigate(url)
  else window.location.href = url
}

let timer: ReturnType<typeof setInterval> | null = null
let tries = 0

const changed = computed(() => port.value.trim() !== '' && port.value.trim() !== originalPort.value)

// Interleaving guard (review fix 3, same rationale as TimezoneRow.vue / DiskStandbyRow.vue):
// under real network latency, the user may have already edited the input before onMounted's
// read resolves — the read callback must not overwrite the displayed value with the server's
// stale snapshot.
// Inline boolean flag, not extracted into a shared helper (a previous review in this repo
// ruled that would be premature abstraction).
// Note: the flag must be set the moment the user edits the input, not deferred until they
// click submit — the user may have edited it but not yet submitted, in which case if the
// load resolves in the meantime, it still must not overwrite what's already in the input.
let touched = false

function onInput(e: Event) {
  touched = true
  port.value = (e.target as HTMLInputElement).value
}

onMounted(async () => {
  try {
    const p = await service.sys.getServerPort()   // confirmed empirically to be the string "80"
    if (touched) return
    port.value = p
    originalPort.value = p
  } catch (e) {
    console.warn('[settings] getServerPort failed', e)
  }
})

function stopProbe() {
  if (timer) { clearInterval(timer); timer = null }
  probing.value = false
}
// Porting discipline #4: Vue2 only clears the timer in beforeDestroy; here it's cleared on
// both unmount and timeout.
onBeforeUnmount(stopProbe)

async function submit() {
  const v = validatePort(port.value)
  if (!v.ok) {
    error.value = t('settingsPortRange')
    return
  }
  error.value = ''
  busy.value = true
  const next = String(v.port)
  try {
    await service.sys.editServerPort({ port: next })
  } catch (e) {
    busy.value = false
    toast.show(t('settingsSaveFailed'))
    console.warn('[settings] editServerPort failed', e)
    return   // Don't proceed to probing if the save itself didn't succeed
  }
  startProbe(next)
}

function startProbe(next: string) {
  probing.value = true
  tries = 0
  const url = buildProbeUrl(next)
  timer = setInterval(async () => {
    tries++
    if (tries > PROBE_MAX_TRIES) {
      stopProbe()
      busy.value = false
      error.value = t('settingsPortTimeout')
      return
    }
    const reported = await probeUiPort(url)
    if (reported) {
      stopProbe()
      go(buildRedirectUrl(reported))
    }
  }, PROBE_INTERVAL_MS)
}
</script>

<template>
  <SettingsRow :label="t('settingsWebuiPort')">
    <template #control>
      <input
        :value="port"
        class="set-input"
        type="text"
        inputmode="numeric"
        :placeholder="t('settingsPortPlaceholder')"
        :disabled="busy"
        @input="onInput"
        @keyup.enter="submit"
      />
      <button v-if="changed" class="set-btn primary wpr-submit" type="button" :disabled="busy" @click="submit">
        ✓
      </button>
    </template>
    <template v-if="error || probing" #hint>
      <span v-if="error" class="set-danger">{{ error }}</span>
      <span v-else class="set-info">{{ t('settingsPortSwitching') }}</span>
    </template>
  </SettingsRow>
</template>
