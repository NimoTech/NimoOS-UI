<script setup lang="ts">
// general 页装配。行顺序逐条对位 Vue2 SettingsPanel.vue L65-324,不许改序。
// 两处**有意不做**(见计划 §实测校正):
//   - 顶部 Premium 推广条(L67-73):用户 2026-07-31 拍板不做,授权偏离 #6
//     (Vue2 侧那个 Upgrade Now 按钮本来也没有任何 @click)
//   - 「显示其他 Docker 容器应用」开关行(L239-245):Vue2 恒不渲染,债务 D15
// 「开发者模式」入口行沿用 P0 已有的实现(Vue2 L315,常驻可见、无开关门控)。
//
// 说明:本页会打一次 /sys/hardware(此处 + DeviceInfoCard + UsbAutoMountRow 各自也打一次)。
// Vue2 也是多处各拉一次(SettingsPanel.getHardwareInfo + DeviceInfoPanel.fetchHardwareInfo),
// 且这是本机的廉价读接口 —— 不为此引入缓存层(YAGNI)。
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

// 固件更新行的副标题用 hardware.version(Vue2 L254),不是 os_version 的 current_version
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
/* 开发者入口行样式沿用 P0 原样,不改 */
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
