<script setup lang="ts">
// 对位 Vue2 SettingsPanel.vue L76-96 的设备信息卡:
// 左「NimoOS」标题 + 「设备信息」按钮 + 「NimoOS v<版本>」,右 logo。
// spec §5.1 提到的 Premium 推广条(Vue2 L67-73)本期不做 —— 用户 2026-07-31 拍板,授权偏离 #6。
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
  // 失败静默:版本号回退 1.0.0(与 Vue2 一致),不让整张卡消失
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
