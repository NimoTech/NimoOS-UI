<script setup lang="ts">
// Wi-Fi client form. Corresponds to Vue2 WifiForm.vue (135 lines).
//
// Porting discipline #1 (logged): Vue2 this component holds its own `dnsString` (data),
// initialized in created() from formData.ipv4.dns; when the user edits it, it is **never
// written back to the parent** — and the parent's save() uses the parent's own dnsString →
// **DNS entered in the advanced settings is silently dropped on save**. Here we bind
// directly to the parent's form.dnsText, so there's no second copy.
//
// Porting discipline #6 (logged): Vue2 declares and passes in two props, clientConnected /
// clientIpInfo, but the template **uses neither anywhere** (and clientConnected's computed
// returns an object while the prop is declared as Boolean) → genuinely dead code, not
// ported (same precedent as PortPanel.vue). Runtime IP is already shown in the list row.
//
// Porting discipline #7 (logged): Vue2's `v-for :key="net.ssid"` produces duplicate keys
// when SSIDs collide (real scan results include a hidden SSID like
// ssid="00:00:00:00:00:00") → key uses `bssid || ssid` instead (the manually appended
// "connected but not scanned" entry has no bssid, so it falls back to ssid).
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { WifiScanResult } from '@nimotech/nimoos-service'
import type { IfaceFormState } from '../../util/ifaceForm'
import { signalBar } from '../../util/ifaceDisplay'
import '../../styles/settings.css'

defineOptions({ name: 'WifiForm' })
const props = defineProps<{ form: IfaceFormState; networks: WifiScanResult[]; scanning: boolean }>()
const emit = defineEmits<{ scan: []; disconnect: [] }>()
const { t } = useI18n()

const showAdv = ref(false)

function pick(ssid: string) {
  props.form.wireless.ssid = ssid
}
</script>

<template>
  <div class="set-net-form">
    <div class="set-net-field">
      <span class="set-net-label">{{ t('settingsNetAvailable') }}</span>
      <button class="set-btn primary set-net-scan-btn" type="button" :disabled="scanning" @click="emit('scan')">
        {{ scanning ? t('settingsNetScanning') : t('settingsNetScan') }}
      </button>
    </div>

    <div class="set-wifi-list">
      <div v-if="scanning" class="set-wifi-empty">{{ t('settingsNetScanning') }}</div>
      <div v-else-if="networks.length === 0" class="set-wifi-empty">{{ t('settingsNetScanHint') }}</div>
      <button
        v-for="net in networks"
        v-else
        :key="net.bssid || net.ssid"
        type="button"
        class="set-wifi-row"
        :class="{ on: net.ssid === form.wireless.ssid }"
        @click="pick(net.ssid)"
      >
        <span class="set-wifi-bar" aria-hidden="true">{{ signalBar(net.signal) }}</span>
        <span class="set-wifi-ssid">{{ net.ssid }}</span>
        <span v-if="net.connected" class="set-wifi-flag">{{ t('settingsNetConnected') }}</span>
        <span v-else-if="net.secure" class="set-wifi-lock" :aria-label="t('settingsNetSecure')">🔒</span>
        <!-- Disconnect button uses a role=button span: the outer row is already a <button>, and HTML doesn't allow nesting button elements -->
        <span
          v-if="net.connected"
          class="set-btn set-wifi-disconnect"
          role="button"
          tabindex="0"
          @click.stop="emit('disconnect')"
          @keydown.enter.stop.prevent="emit('disconnect')"
        >{{ t('settingsNetDisconnect') }}</span>
      </button>
    </div>

    <label v-if="form.wireless.ssid" class="set-net-field">
      <span class="set-net-label">{{ t('settingsNetPassword') }}</span>
      <!-- Vue2 uses type="text" (plaintext, so the user can verify it), kept as-is -->
      <input v-model="form.wireless.password" class="set-input set-net-password" type="text" />
    </label>

    <!-- Advanced settings only appear in client mode; concurrent mode uses automatic defaults (Vue2 L47-48 comment) -->
    <template v-if="form.wireless.mode === 'client'">
      <button class="set-net-adv" type="button" @click="showAdv = !showAdv">
        <span aria-hidden="true">{{ showAdv ? '▾' : '▸' }}</span>{{ t('settingsNetAdvanced') }}
      </button>

      <template v-if="showAdv">
        <label class="set-net-field">
          <span class="set-net-label">{{ t('settingsNetZone') }}</span>
          <!-- client mode's zone only offers None / WAN (Vue2 L56-59 has no LAN) -->
          <select v-model="form.zone" class="set-select set-net-zone">
            <option value="">{{ t('settingsNetZoneNone') }}</option>
            <option value="wan">{{ t('settingsNetZoneWan') }}</option>
          </select>
        </label>

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
    </template>
  </div>
</template>
