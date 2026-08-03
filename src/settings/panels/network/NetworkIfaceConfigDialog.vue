<script setup lang="ts">
// 接口配置弹窗。对位 Vue2 NetworkIfaceConfigModal.vue(431 行)。
//
// 移植纪律 #5(登记):Vue2 标题写死 `Wi-Fi - {{ iface.name }}`(模板第 5 行),以太网口
//   点「编辑」也显示「Wi-Fi - enp2s0」—— 用户 2026-07-31 拍板改成按类型派生(授权偏离 #7)。
// 移植纪律 #4(登记):Vue2 的 scanWifi 在 `!isWifi` 早退分支不复位 scanning,
//   且 `this.scanning = false` 不在 finally 里 → 这里用 try/finally。
// 移植纪律 #8(登记):Vue2 的失败提示用 $buefy.toast,会被遮罩(z-index 1000 + blur)
//   压住 + 糊掉 → 一律内联 .set-danger,且**优先显示后端 message**(network 域的错误键是
//   `error` 而不是 `message`,共享包的 axios 拦截器认不出来,所以走 networkErrorText)。
//
// ⚠️ 过期守卫(newui-async-stale-guard):scanWifi 实测 ~2.3s,期间用户可能再点扫描、
//   或关掉弹窗换另一张网卡打开 → 用代际计数器,迟到的结果直接丢弃。就地写,不抽公共 helper。
//
// ⚠️ 成功提示不在这里弹 —— 交给父层在 `saved` 事件里 toast(弹窗关掉后才没有遮罩挡着)。
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
  // 用表单里的当前模式派生(切了模式标题要跟着变),其余字段取 iface
  const wireless = mode.value ? { mode: mode.value } : f.wireless
  return `${t(ifaceTypeKey({ ...f, wireless }))} - ${f.name}`
})

watch(
  () => [props.open, props.iface] as const,
  ([open, iface]) => {
    if (!open || !iface) return
    // 同步 hydrate(不是异步取值)→ 不存在「迟到的服务端值盖掉用户输入」那类问题
    form.value = hydrateForm(iface, { switchMode: props.switchMode, switchTab: props.switchTab })
    networks.value = []
    error.value = ''
    tab.value = 'wifi'
    scanGen++ // 作废上一次打开时在飞的扫描
    if (mode.value === 'client' || mode.value === 'concurrent') void scan()
  },
  { immediate: true },
)

async function scan() {
  const name = props.iface?.name
  if (!name || !isWifi.value) return // 早退不动 scanning(Vue2 在这里漏了复位)
  const gen = ++scanGen
  scanning.value = true
  error.value = ''
  try {
    const found = await service.network.scanWifi(name)
    if (gen !== scanGen) return // 过期结果丢弃
    // 已保存的 SSID 没扫到(隐藏 SSID / 信号弱)→ 补一条置顶,标成已连接(Vue2 L354-357)
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
    error.value = networkErrorText(e) || t('settingsNetApplyFailed') // 不关窗,让用户改了再试
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
          <!-- v-if 而非 v-show:sp8-P2a 记过 v-show 的窄屏回归坑 -->
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
