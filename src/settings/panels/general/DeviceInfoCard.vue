<script setup lang="ts">
// Device info card, mirrors Vue2 SettingsPanel.vue L76-96:
// "NimoOS" title on the left + "Device Info" button + "NimoOS v<version>", logo on the right.
// The Premium promo banner mentioned in spec §5.1 (Vue2 L67-73) is out of scope this phase -- user signed off on 2026-07-31, authorized deviation #6.
/// <reference types="vite/client" />
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { service, type HardwareInfo } from '@nimotech/nimoos-service'
import DeviceInfoDialog from '../../components/DeviceInfoDialog.vue'
import { osVersionLabel } from '../../util/deviceInfo'
import logo from '../../../assets/img/nimologo.svg'
import '../../styles/settings.css'

const { t } = useI18n()
const hw = ref<HardwareInfo | null>(null)
const dialogOpen = ref(false)

onMounted(async () => {
  // Fails silently: version falls back to 1.0.0 (consistent with Vue2), so the whole card doesn't disappear
  try { hw.value = await service.sys.hardwareInfo() } catch (e) { console.warn('[settings] hardwareInfo failed', e) }
})
</script>

<template>
  <section class="set-card dic">
    <div class="dic-text">
      <h2 class="dic-title">NimoOS</h2>
      <button class="set-btn dic-btn" type="button" @click="dialogOpen = true">
        {{ t('settingsDeviceInfoBtn') }}
      </button>
      <p class="dic-version">NimoOS v{{ osVersionLabel(hw) }}</p>
    </div>
    <img class="set-logo" :src="logo" alt="" aria-hidden="true" />
    <DeviceInfoDialog v-model:open="dialogOpen" />
  </section>
</template>

<style scoped>
.dic { display: flex; align-items: center; gap: 16px; }
.dic-text { display: flex; flex-direction: column; align-items: flex-start; gap: 12px; flex: 1 1 auto; min-width: 0; }
.dic-title { margin: 0; font-size: 22px; font-weight: 700; }
.dic-btn { align-self: flex-start; }
.dic-version { margin: 0; font-size: 12px; color: var(--fg-muted); }
</style>
