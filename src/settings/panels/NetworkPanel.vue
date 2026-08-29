<script setup lang="ts">
// Settings · Network. Maps to the network branch of Vue2 SettingsPanel.vue (L492-585)
// + loadNetworkData(:2134) + switchWifiMode(:2199) + openIfaceConfig(:2241).
//
// Data assembly (spec §1.7): **list source = the net field from /v1/sys/utilization (live enumeration)**,
//   /v2/nimoos/network/interfaces only matches by name afterward to fill in zone/type/ipv4/wireless/hybridCapable.
//   All merge logic lives in util/netMerge.ts (pure function + unit tests).
//
// Liveness (decided by the user on 2026-07-31): the list is wired to MessageBus's 5-second utilization
//   stream (useUtilization = first HTTP fetch + subscribe to pushes). Therefore:
//   Porting rule #2 (logged): **removed Vue2's post-save 4×2s setInterval that re-polled for the DHCP
//   address** — the live stream already refreshes the new address, and Vue2's timer also leaked
//   because it never cleared it on unmount. After saving, only refetch config once.
//   ⚠️ max_speed is always 0 in the push payload (NimoOS/route/periodical.go:44-47 is missing that
//   line); MaxSpeedMemo remembers the real value from the HTTP fetch, otherwise the speed label
//   would flicker every 5 seconds.
//
// Porting rule #3 (logged): when Vue2's raw mode-switch fails, it only console.errors and still
//   opens the config dialog (the user thinks the switch worked) → here, a failure toasts an error
//   and **does not open the dialog**.
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { service, networkErrorText, type NetworkInterfaceConfig } from '@nimotech/nimoos-service'
import SettingsSection from '../components/SettingsSection.vue'
import AlertDialog from '../../components/ui/AlertDialog.vue'
import NetworkIfaceRow from './network/NetworkIfaceRow.vue'
import NetworkIfaceConfigDialog from './network/NetworkIfaceConfigDialog.vue'
import { mergeInterfaces, MaxSpeedMemo, type MergedIface } from '../util/netMerge'
import { switchTargetKey } from '../util/ifaceDisplay'
import { useUtilization } from '../../composables/useUtilization'
import { useToast } from '../../stores/toast'
import '../styles/settings.css'

const { t } = useI18n()
const toast = useToast()
const util = useUtilization() // onMounted does a first HTTP fetch + subscribes to nimoos:system:utilization
const memo = new MaxSpeedMemo()

const configs = ref<NetworkInterfaceConfig[]>([])
const configLoaded = ref(false)

const rows = computed<MergedIface[]>(() => mergeInterfaces(util.data?.net, configs.value, memo))
const loading = computed(() => !configLoaded.value && rows.value.length === 0)

// Config dialog
const dlgOpen = ref(false)
const dlgIface = ref<MergedIface | null>(null)
const dlgSwitchMode = ref<'ap' | 'client' | 'concurrent' | undefined>(undefined)
const dlgSwitchTab = ref<'hybrid' | undefined>(undefined)

// Mode-switch confirmation dialog
const confirmOpen = ref(false)
const pending = ref<{ iface: MergedIface; target: 'ap' | 'client' | 'concurrent' } | null>(null)
const confirmMsg = computed(() => {
  const p = pending.value
  if (!p) return ''
  return t('settingsNetSwitchMsg', { mode: t(switchTargetKey(p.target)), iface: p.iface.name })
})

async function loadConfigs() {
  try {
    configs.value = await service.network.getInterfaces()
  } catch (e) {
    // Degrade gracefully: if config can't be fetched, the list still renders (just without the zone/ipv4/wireless parts) — Vue2 does the same with .catch(() => [])
    console.warn('[settings] getInterfaces failed', e)
    configs.value = []
  } finally {
    configLoaded.value = true
  }
}
void loadConfigs()

function openConfig(
  iface: MergedIface,
  opts: { switchMode?: 'ap' | 'client' | 'concurrent'; switchTab?: 'hybrid' } = {},
) {
  if (iface.isVirtual) return // virtual interfaces don't get a config dialog (Vue2 openIfaceConfig's first line)
  dlgIface.value = iface
  dlgSwitchMode.value = opts.switchMode
  dlgSwitchTab.value = opts.switchTab
  dlgOpen.value = true
}

function askSwitch(iface: MergedIface, target: 'ap' | 'client' | 'concurrent') {
  pending.value = { iface, target }
  confirmOpen.value = true
}

async function doSwitch() {
  const p = pending.value
  confirmOpen.value = false
  if (!p) return
  // Step 1: raw mode switch (copied from Vue2 — switch first, so the wifi scan inside the dialog has results)
  try {
    await service.network.updateInterface({ name: p.iface.name, wireless: { mode: p.target } })
  } catch (e) {
    toast.show(networkErrorText(e) || t('settingsNetSwitchFailed'))
    pending.value = null
    return // Porting rule #3: don't open the dialog if the switch fails
  }
  await loadConfigs()
  // Step 2: open the config dialog. Use the row re-merged from the refetched config (picks up the mode the backend just persisted)
  const fresh = rows.value.find((r) => r.name === p.iface.name) ?? p.iface
  if (p.target === 'concurrent') openConfig(fresh, { switchTab: 'hybrid' })
  else openConfig(fresh, { switchMode: p.target })
  pending.value = null
}

async function onSaved() {
  toast.show(t('settingsNetApplied')) // the success toast fires after the dialog closes, otherwise it gets pinned under the overlay and blurred
  await loadConfigs()
}
</script>

<template>
  <SettingsSection :title="t('settingsTabNetwork')">
    <p class="set-net-section-title">{{ t('settingsNetConnection') }}</p>
    <div class="set-net-card">
      <div v-if="loading" class="set-net-loading">{{ t('settingsNetLoading') }}</div>
      <template v-else-if="rows.length">
        <NetworkIfaceRow
          v-for="iface in rows"
          :key="iface.name"
          :iface="iface"
          @edit="openConfig(iface)"
          @switch-mode="askSwitch(iface, $event)"
        />
      </template>
      <div v-else class="set-net-empty">{{ t('settingsNetEmpty') }}</div>
    </div>

    <AlertDialog
      v-model:open="confirmOpen"
      :title="t('settingsNetSwitchTitle')"
      :message="confirmMsg"
      :confirm-text="t('settingsConfirm')"
      :cancel-text="t('settingsCancel')"
      @confirm="doSwitch"
    />

    <NetworkIfaceConfigDialog
      v-model:open="dlgOpen"
      :iface="dlgIface"
      :switch-mode="dlgSwitchMode"
      :switch-tab="dlgSwitchTab"
      @saved="onSaved"
    />
  </SettingsSection>
</template>

<style scoped>
.set-net-section-title { font-size: 12px; color: var(--fg-muted); margin: 0 0 8px; }
</style>
