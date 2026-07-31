<script setup lang="ts">
// 设置 · 网络。对位 Vue2 SettingsPanel.vue 的 network 分支(L492-585)+ loadNetworkData(:2134)
// + switchWifiMode(:2199)+ openIfaceConfig(:2241)。
//
// 数据装配(spec §1.7):**列表源 = /v1/sys/utilization 的 net(实时枚举)**,
//   /v2/nimoos/network/interfaces 只按 name 匹配后补 zone/type/ipv4/wireless/hybridCapable。
//   合并逻辑全在 util/netMerge.ts(纯函数 + 单测)。
//
// 实时性(用户 2026-07-31 拍板):列表接 MessageBus 的 5 秒 utilization 流(useUtilization
//   = 首次 HTTP 取 + 订阅推送)。因此:
//   移植纪律 #2(登记):**删掉 Vue2 保存后那段 4×2s 的 setInterval 补抓 DHCP 地址** ——
//   实时流本来就会把新地址刷出来,而 Vue2 那个定时器还漏了卸载停表。保存后只重取一次 config。
//   ⚠️ 推送里 max_speed 恒 0(NimoOS/route/periodical.go:44-47 少了那一行),靠 MaxSpeedMemo
//   记住 HTTP 那次的真值,否则速率标签会每 5 秒变形。
//
// 移植纪律 #3(登记):Vue2 的裸切模式失败只 console.error 就继续打开配置弹窗(用户以为切好了)
//   → 这里失败就 toast 报错并且**不开弹窗**。
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
const util = useUtilization() // onMounted 首次 HTTP 取 + 订阅 nimoos:system:utilization
const memo = new MaxSpeedMemo()

const configs = ref<NetworkInterfaceConfig[]>([])
const configLoaded = ref(false)

const rows = computed<MergedIface[]>(() => mergeInterfaces(util.data?.net, configs.value, memo))
const loading = computed(() => !configLoaded.value && rows.value.length === 0)

// 配置弹窗
const dlgOpen = ref(false)
const dlgIface = ref<MergedIface | null>(null)
const dlgSwitchMode = ref<'ap' | 'client' | 'concurrent' | undefined>(undefined)
const dlgSwitchTab = ref<'hybrid' | undefined>(undefined)

// 切模式确认框
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
    // 降级:config 拿不到时列表仍然出(只是没有 zone/ipv4/wireless 那部分)——Vue2 同样 .catch(() => [])
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
  if (iface.isVirtual) return // 虚拟口不给配置(Vue2 openIfaceConfig 的第一行)
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
  // 第一步:裸切模式(照抄 Vue2 —— 先切了,弹窗里的 wifi 扫描才有结果)
  try {
    await service.network.updateInterface({ name: p.iface.name, wireless: { mode: p.target } })
  } catch (e) {
    toast.show(networkErrorText(e) || t('settingsNetSwitchFailed'))
    pending.value = null
    return // 移植纪律 #3:切失败就不要再打开弹窗
  }
  await loadConfigs()
  // 第二步:打开配置弹窗。用重取后的 config 重新合并出的那一行(拿到后端刚落的 mode)
  const fresh = rows.value.find((r) => r.name === p.iface.name) ?? p.iface
  if (p.target === 'concurrent') openConfig(fresh, { switchTab: 'hybrid' })
  else openConfig(fresh, { switchMode: p.target })
  pending.value = null
}

async function onSaved() {
  toast.show(t('settingsNetApplied')) // 成功提示在弹窗关掉之后弹,否则被遮罩压住 + 糊掉
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
