<script setup lang="ts">
// Hotspot (AP) form. Mirrors Vue2 HotspotForm.vue (69 lines).
// Porting discipline #1 (recorded): same as WifiForm -- the Vue2 dnsString here is also
// a child-component-private ref, discarded on save; here it binds directly to the parent's form.dnsText.
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { IfaceFormState } from '../../util/ifaceForm'
import '../../styles/settings.css'

defineOptions({ name: 'HotspotForm' })
defineProps<{ form: IfaceFormState }>()
const { t } = useI18n()
const showAdv = ref(false)
</script>

<template>
  <div class="set-net-form">
    <label class="set-net-field">
      <span class="set-net-label">{{ t('settingsNetApSsid') }}</span>
      <input v-model="form.wireless.apSsid" class="set-input set-net-apssid" type="text" placeholder="NimoOS-Hotspot" />
    </label>

    <label class="set-net-field">
      <span class="set-net-label">{{ t('settingsNetPassword') }}</span>
      <input v-model="form.wireless.apPassword" class="set-input set-net-appw" type="text" />
    </label>

    <label class="set-net-field">
      <span class="set-net-label">{{ t('settingsNetBand') }}</span>
      <!-- In concurrent mode the band follows the client (backend watchdog syncs the channel); read-only display here -- Vue2 L10-11 -->
      <input
        v-if="form.wireless.mode === 'concurrent'"
        class="set-input set-net-band-auto"
        type="text"
        :value="t('settingsNetBandAuto')"
        disabled
      />
      <!-- 2.4GHz / 5GHz are hardcoded literals in Vue2 (not i18n keys), kept as-is -->
      <select v-else v-model.number="form.wireless.channel" class="set-select set-net-band">
        <option :value="0">{{ t('settingsNetBandAuto') }}</option>
        <option :value="6">2.4GHz</option>
        <option :value="36">5GHz</option>
      </select>
    </label>

    <button class="set-net-adv" type="button" @click="showAdv = !showAdv">
      <span aria-hidden="true">{{ showAdv ? '▾' : '▸' }}</span>{{ t('settingsNetAdvanced') }}
    </button>

    <template v-if="showAdv">
      <!-- AP is always LAN, read-only; this row doesn't appear in concurrent mode (the Wi-Fi tab manages the zone) -- Vue2 L27-33 -->
      <label v-if="form.wireless.mode === 'ap'" class="set-net-field">
        <span class="set-net-label">{{ t('settingsNetZone') }}</span>
        <select v-model="form.zone" class="set-select set-net-zone" disabled>
          <option value="lan">{{ t('settingsNetZoneLan') }}</option>
        </select>
      </label>

      <label class="set-net-field">
        <span class="set-net-label">{{ t('settingsNetIpAddress') }}</span>
        <input v-model="form.ipv4.address" class="set-input set-net-ip" type="text" placeholder="192.168.22.1" />
      </label>
      <label class="set-net-field">
        <span class="set-net-label">{{ t('settingsNetNetmask') }}</span>
        <input v-model="form.ipv4.netmask" class="set-input set-net-mask" type="text" placeholder="255.255.255.0" />
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
  </div>
</template>
