<script setup lang="ts">
// Interface config dialog. Maps to Vue2 NetworkIfaceConfigModal.vue (431 lines).
//
// Porting rule #5 (logged): Vue2 hardcodes the title as `Wi-Fi - {{ iface.name }}` (template
//   line 5), so clicking "edit" on an Ethernet interface also shows "Wi-Fi - enp2s0" — the user
//   decided on 2026-07-31 to derive it by type instead (authorized deviation #7).
// Porting rule #4 (logged): Vue2's scanWifi doesn't reset scanning on the early-return `!isWifi`
//   branch, and `this.scanning = false` isn't in a finally block → here we use try/finally.
// Porting rule #8 (logged): Vue2's failure toast uses $buefy.toast, which gets pinned under and
//   blurred by the overlay (z-index 1000 + blur) → always show it inline via .set-danger instead,
//   and **prefer the backend message** (the network domain's error key is `error`, not `message`,
//   which the shared package's axios interceptor doesn't recognize, hence going through
//   networkErrorText).
//
// ⚠️ Staleness guard (newui-async-stale-guard): scanWifi measured ~2.3s in practice; during that
//   window the user might click scan again, or close the dialog and open a different interface →
//   use a generation counter and discard late results outright. Written inline, not extracted
//   into a shared helper.
//
// ⚠️ The success toast doesn't fire here — that's left to the parent to toast on the `saved`
//   event (only once the dialog closes is there no overlay blocking it).
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { service, networkErrorText, type WifiScanResult } from '@nimotech/nimoos-service'
import Dialog from '../../../components/ui/Dialog.vue'
import type { MergedIface } from '../../util/netMerge'
import { ifaceTypeKey } from '../../util/ifaceDisplay'
import {
  createFormState, hydrateForm, buildUpdatePayload, isWifiName, isThunderboltType,
  AP_DEFAULTS, type IfaceFormState,
} from '../../util/ifaceForm'
import WifiForm from './WifiForm.vue'
import HotspotForm from './HotspotForm.vue'
import '../../styles/settings.css'

defineOptions({ name: 'NetworkIfaceConfigDialog' })
const props = defineProps<{
  open: boolean
  iface: MergedIface | null
  switchMode?: 'ap' | 'client' | 'concurrent'
  switchTab?: 'hybrid'
}>()
const emit = defineEmits<{ 'update:open': [boolean]; saved: [] }>()
const { t } = useI18n()

const form = ref<IfaceFormState>(createFormState())
const networks = ref<WifiScanResult[]>([])
const scanning = ref(false)
const saving = ref(false)
const error = ref('')
const tab = ref<'wifi' | 'hotspot'>('wifi')

let scanGen = 0

const isWifi = computed(() => isWifiName(props.iface?.name ?? ''))
const isThunderbolt = computed(() => isThunderboltType(props.iface?.type ?? ''))
const mode = computed(() => form.value.wireless.mode)
const title = computed(() => {
  const f = props.iface
  if (!f) return ''
  // Derives from the form's current mode (switching modes must update the title), other fields come from iface
  const wireless = mode.value ? { mode: mode.value } : f.wireless
  return `${t(ifaceTypeKey({ ...f, wireless }))} - ${f.name}`
})

watch(
  () => [props.open, props.iface] as const,
  ([open, iface]) => {
    if (!open || !iface) return
    // Hydrates synchronously (not an async fetch) → no "late server value overwrites user input" class of bug
    form.value = hydrateForm(iface, { switchMode: props.switchMode, switchTab: props.switchTab })
    networks.value = []
    error.value = ''
    tab.value = 'wifi'
    scanGen++ // invalidates any scan still in flight from the previous time it was opened
    if (mode.value === 'client' || mode.value === 'concurrent') void scan()
  },
  { immediate: true },
)

async function scan() {
  const name = props.iface?.name
  if (!name || !isWifi.value) return // early return leaves scanning untouched (Vue2 misses the reset here)
  const gen = ++scanGen
  scanning.value = true
  error.value = ''
  try {
    const found = await service.network.scanWifi(name)
    if (gen !== scanGen) return // discard the stale result
    // Saved SSID wasn't found in the scan (hidden SSID / weak signal) → add one pinned at the top, marked connected (Vue2 L354-357)
    const ssid = form.value.wireless.ssid
    if (ssid && !found.some((n) => n.ssid === ssid)) {
      networks.value = [{ ssid, bssid: '', signal: 0, channel: 0, secure: false, connected: true }, ...found]
    } else {
      networks.value = found
    }
  } catch (e) {
    if (gen !== scanGen) return
    error.value = networkErrorText(e) || t('settingsNetScanFailed')
  } finally {
    if (gen === scanGen) scanning.value = false
  }
}

function setMode(m: 'client' | 'ap') {
  form.value.wireless.mode = m
  if (m === 'ap') {
    form.value.wireless.apSsid = AP_DEFAULTS.ssid
    form.value.zone = 'lan'
    form.value.ipv4.method = 'static'
    form.value.ipv4.address = AP_DEFAULTS.address
    form.value.ipv4.netmask = AP_DEFAULTS.netmask
  } else {
    form.value.ipv4.method = 'dhcp'
    form.value.ipv4.address = ''
    form.value.ipv4.netmask = ''
    form.value.ipv4.gateway = ''
    form.value.dnsText = ''
    void scan()
  }
}

async function disconnect() {
  const name = form.value.name
  error.value = ''
  try {
    await service.network.updateInterface({ name, wireless: { mode: 'client', ssid: '', password: '' } })
    form.value.wireless.ssid = ''
    form.value.wireless.password = ''
    void scan()
  } catch (e) {
    error.value = networkErrorText(e) || t('settingsNetDisconnectFailed')
  }
}

async function save() {
  const f = props.iface
  if (!f) return
  error.value = ''
  const built = buildUpdatePayload(form.value, f)
  if (!built.ok) {
    error.value = t('settingsNetNothingToSave')
    return
  }
  saving.value = true
  try {
    await service.network.updateInterface(built.payload)
    emit('saved')
    emit('update:open', false)
  } catch (e) {
    error.value = networkErrorText(e) || t('settingsNetApplyFailed') // don't close the dialog, let the user fix and retry
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Dialog :open="open" :title="title" @update:open="emit('update:open', $event)">
    <div v-if="iface" class="set-net-dialog">
      <template v-if="isWifi">
        <HotspotForm v-if="mode === 'ap'" :form="form" />

        <WifiForm
          v-else-if="mode === 'client'"
          :form="form"
          :networks="networks"
          :scanning="scanning"
          @scan="scan"
          @disconnect="disconnect"
        />

        <template v-else-if="mode === 'concurrent'">
          <div class="set-net-tabs">
            <button class="set-net-tab" :class="{ on: tab === 'wifi' }" type="button" @click="tab = 'wifi'">
              {{ t('settingsNetTypeWifi') }}
            </button>
            <button class="set-net-tab" :class="{ on: tab === 'hotspot' }" type="button" @click="tab = 'hotspot'">
              {{ t('settingsNetTypeHotspot') }}
            </button>
          </div>
          <!-- v-if instead of v-show: an earlier fix logged a narrow-screen regression caused by v-show -->
          <WifiForm
            v-if="tab === 'wifi'"
            :form="form"
            :networks="networks"
            :scanning="scanning"
            @scan="scan"
            @disconnect="disconnect"
          />
          <HotspotForm v-else :form="form" />
        </template>

        <div v-else class="set-net-choose-wrap">
          <p class="set-net-hint">{{ t('settingsNetUnconfigured') }}</p>
          <div class="set-net-choose">
            <button class="set-btn primary" type="button" @click="setMode('client')">
              {{ t('settingsNetConnectWifi') }}
            </button>
            <button class="set-btn primary" type="button" @click="setMode('ap')">
              {{ t('settingsNetCreateHotspot') }}
            </button>
          </div>
        </div>
      </template>

      <div v-else class="set-net-form">
        <label class="set-net-field">
          <span class="set-net-label">{{ t('settingsNetZone') }}</span>
          <select v-model="form.zone" class="set-select set-net-zone">
            <option value="">{{ t('settingsNetZoneNone') }}</option>
            <option value="lan">{{ t('settingsNetZoneLan') }}</option>
            <option value="wan">{{ t('settingsNetZoneWan') }}</option>
          </select>
        </label>

        <template v-if="isThunderbolt">
          <p class="set-net-hint">{{ t('settingsNetTbStatic') }}</p>
          <label class="set-net-field">
            <span class="set-net-label">{{ t('settingsNetIpAddress') }}</span>
            <input v-model="form.ipv4.address" class="set-input set-net-ip" type="text" placeholder="169.254.1.1" />
          </label>
          <label class="set-net-field">
            <span class="set-net-label">{{ t('settingsNetNetmask') }}</span>
            <input v-model="form.ipv4.netmask" class="set-input set-net-mask" type="text" placeholder="255.255.0.0" />
          </label>
          <label class="set-net-field">
            <span class="set-net-label">{{ t('settingsNetGateway') }}</span>
            <input v-model="form.ipv4.gateway" class="set-input set-net-gw" type="text" placeholder="0.0.0.0" />
          </label>
          <label class="set-net-field">
            <span class="set-net-label">{{ t('settingsNetDns') }}</span>
            <input v-model="form.dnsText" class="set-input set-net-dns" type="text" placeholder="8.8.8.8, 1.1.1.1" />
          </label>
        </template>

        <template v-else>
          <label class="set-net-field">
            <span class="set-net-label">{{ t('settingsNetIpv4Method') }}</span>
            <select v-model="form.ipv4.method" class="set-select set-net-method">
              <option value="dhcp">{{ t('settingsNetIpv4Dhcp') }}</option>
              <option value="static">{{ t('settingsNetIpv4Static') }}</option>
            </select>
          </label>
          <template v-if="form.ipv4.method === 'static'">
            <label class="set-net-field">
              <span class="set-net-label">{{ t('settingsNetIpAddress') }}</span>
              <input v-model="form.ipv4.address" class="set-input set-net-ip" type="text" placeholder="192.168.1.100" />
            </label>
            <label class="set-net-field">
              <span class="set-net-label">{{ t('settingsNetNetmask') }}</span>
              <input v-model="form.ipv4.netmask" class="set-input set-net-mask" type="text" placeholder="255.255.255.0" />
            </label>
            <label class="set-net-field">
              <span class="set-net-label">{{ t('settingsNetGateway') }}</span>
              <input v-model="form.ipv4.gateway" class="set-input set-net-gw" type="text" placeholder="192.168.1.1" />
            </label>
            <label class="set-net-field">
              <span class="set-net-label">{{ t('settingsNetDns') }}</span>
              <input v-model="form.dnsText" class="set-input set-net-dns" type="text" placeholder="8.8.8.8, 1.1.1.1" />
            </label>
          </template>
        </template>
      </div>

      <p v-if="error" class="set-danger">{{ error }}</p>
    </div>

    <template #footer>
      <button class="set-btn set-net-cancel" type="button" :disabled="saving" @click="emit('update:open', false)">
        {{ t('settingsCancel') }}
      </button>
      <button class="set-btn primary set-net-save" type="button" :disabled="saving" @click="save">
        {{ t('settingsNetSaveApply') }}
      </button>
    </template>
  </Dialog>
</template>

<style scoped>
.set-net-dialog { display: flex; flex-direction: column; gap: 10px; min-width: min(460px, 84vw); }
.set-net-choose-wrap { text-align: center; padding: 12px 0; }
</style>
