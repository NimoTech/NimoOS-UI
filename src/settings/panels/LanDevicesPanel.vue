<script setup lang="ts">
// Settings - LAN devices. Ports Vue2 components/settings/LanDevices.vue (#93).
// Data source: GET /gateway/lan-discovery (bare JSON, see packages/service/src/sys.ts).
//
// Two deliberate departures from Vue2, both under the "copy the UI, fix the logic" rule:
//  1. Vue2's catch() clears the list, so a failed request renders "no other devices
//     found" -- it reports a broken request as an empty network. We keep an error
//     state and say the scan failed instead.
//  2. Vue2's scan() has no generation guard: clicking rescan while a scan is still in
//     flight lets the older response overwrite the newer one. Guarded here, in place,
//     the same way SystemStatusPanel.vue and AppPathDialog.vue do it.
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { service, type LanDevice } from '@nimotech/nimoos-service'
import SettingsSection from '../components/SettingsSection.vue'
import '../styles/settings.css'

const { t } = useI18n()
const devices = ref<LanDevice[]>([])
const truncated = ref(false)
const loading = ref(false)
const failed = ref(false)

let scanSeq = 0

async function scan() {
  const seq = ++scanSeq
  loading.value = true
  failed.value = false
  try {
    const res = await service.sys.getLanDiscovery()
    if (seq !== scanSeq) return // superseded by a newer scan: drop this result
    devices.value = res.devices
    truncated.value = res.truncated
  } catch {
    if (seq !== scanSeq) return
    devices.value = []
    truncated.value = false
    failed.value = true
  } finally {
    if (seq === scanSeq) loading.value = false
  }
}

// Only plain IPv4 is allowed through: the value goes straight into a window URL, and a
// hostname or a path-bearing string would let the backend steer where we navigate.
function open(d: LanDevice) {
  if (d.self) return
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(d.ip)) return
  window.open(`http://${d.ip}/`, '_blank', 'noopener')
}

onMounted(scan)
</script>

<template>
  <SettingsSection :title="t('settingsLanTitle')">
    <div class="set-comp-head">
      <button
        class="set-btn set-lan-refresh" type="button"
        :title="t('settingsLanRescan')" @click="scan"
      >
        {{ t('settingsLanRescan') }}
      </button>
    </div>

    <p class="set-lan-sub">{{ t('settingsLanSubtitle') }}</p>

    <p v-if="loading" class="set-lan-empty">{{ t('settingsLanScanning') }}</p>

    <template v-else>
      <div
        v-for="d in devices" :key="d.ip"
        class="set-lan-row" :class="{ 'is-link': !d.self }"
        @click="open(d)"
      >
        <span class="set-lan-name">
          {{ d.hostname || t('settingsLanDeviceFallback') }}
          <span v-if="d.self" class="set-lan-tag">{{ t('settingsLanThisDevice') }}</span>
        </span>
        <span class="set-lan-ip">{{ d.ip }}</span>
        <span class="set-lan-ver">{{ d.version || t('settingsLanUnknownVersion') }}</span>
      </div>

      <p v-if="truncated" class="set-lan-warn">{{ t('settingsLanTruncated') }}</p>
      <p v-if="failed" class="set-lan-error">{{ t('settingsLanFailed') }}</p>
      <p v-else-if="!devices.length" class="set-lan-empty">{{ t('settingsLanEmpty') }}</p>
    </template>
  </SettingsSection>
</template>
