<script setup lang="ts">
// General tab assembly. Row order corresponds exactly to Vue2 SettingsPanel.vue L65-324 — do not reorder.
// Two things **deliberately not done** (see plan §real-machine-test corrections):
//   - The Premium promo banner at the top (L67-73): the user decided on 2026-07-31 not to
//     build it, authorized deviation #6 (the Vue2-side "Upgrade Now" button never had any @click anyway)
//   - The "Show other Docker container apps" switch row (L239-245): Vue2 never renders it, debt D15
// The "Developer mode" entry row reuses P0's existing implementation (Vue2 L315, always visible, no gating switch).
//
// Note: this page fires /sys/hardware once (here + DeviceInfoCard + UsbAutoMountRow each fire it
// separately too). Vue2 also pulls it separately in multiple places
// (SettingsPanel.getHardwareInfo + DeviceInfoPanel.fetchHardwareInfo), and it's a cheap local
// read endpoint — no caching layer introduced for this (YAGNI).
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { service, type HardwareInfo } from '@nimotech/nimoos-service'
import SettingsSection from '../components/SettingsSection.vue'
import DeviceInfoCard from './general/DeviceInfoCard.vue'
import WallpaperRow from './general/WallpaperRow.vue'
import LanguageRow from './general/LanguageRow.vue'
import TimezoneRow from './general/TimezoneRow.vue'
import DiskStandbyRow from './general/DiskStandbyRow.vue'
import WebUiPortRow from './general/WebUiPortRow.vue'
import UsbAutoMountRow from './general/UsbAutoMountRow.vue'
import SwitchRow from './general/SwitchRow.vue'
import UpdateRow from './general/UpdateRow.vue'
import '../styles/settings.css'

const { t } = useI18n()
const emit = defineEmits<{ 'open-tab': [tab: string] }>()

// The firmware update row's subtitle uses hardware.version (Vue2 L254), not os_version's current_version
const hwVersion = ref('')
onMounted(async () => {
  try {
    const hw: HardwareInfo = await service.sys.hardwareInfo()
    if (typeof hw.version === 'string') hwVersion.value = hw.version
  } catch (e) {
    console.warn('[settings] hardwareInfo failed', e)
  }
})
</script>

<template>
  <SettingsSection :title="t('settingsTabGeneral')">
    <DeviceInfoCard />

    <div class="set-list">
      <WallpaperRow />
      <LanguageRow />
      <TimezoneRow />
      <DiskStandbyRow />
      <WebUiPortRow />
      <UsbAutoMountRow />
      <SwitchRow field="recommend_switch" label-key="settingsRecommendApps" />
      <SwitchRow
        field="rss_switch"
        label-key="settingsNewsFeed"
        confirm-title-key="settingsNewsFeedTitle"
        confirm-msg-key="settingsNewsFeedConfirm"
        confirm-ok-key="settingsAccept"
      />
      <UpdateRow kind="os" :sub="hwVersion" />
      <UpdateRow kind="app" />
    </div>

    <button class="set-dev-entry" type="button" @click="emit('open-tab', 'developer')">
      <span>{{ t('settingsTabDeveloper') }}</span>
      <span class="set-dev-chevron" aria-hidden="true">›</span>
    </button>
  </SettingsSection>
</template>

<style scoped>
/* Developer entry row style reuses P0 as-is, unchanged */
.set-dev-entry {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 14px 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--card-bg);
  color: var(--fg);
  font: inherit;
  font-size: 14px;
  cursor: pointer;
  text-align: left;
}
.set-dev-entry:hover {
  background: var(--hover);
}
.set-dev-chevron {
  color: var(--fg-faint);
}
</style>
