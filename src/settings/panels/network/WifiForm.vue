<script setup lang="ts">
// Wi-Fi 客户端表单。对位 Vue2 WifiForm.vue(135 行)。
//
// 移植纪律 #1(登记):Vue2 这个组件自己持有 `dnsString`(data),created() 从
// formData.ipv4.dns 初始化,用户改了**从不回写父层**;而父层 save() 用的是父层自己的
// dnsString → **高级设置里填的 DNS 保存时被静默丢弃**。这里直接绑父层的 form.dnsText,
// 不再有第二份。
//
// 移植纪律 #6(登记):Vue2 声明并传入了 clientConnected / clientIpInfo 两个 prop,
// 但模板里**零处使用**(且 clientConnected 的 computed 返回对象而 prop 声明 Boolean)→
// 真死代码,不移植(同 PortPanel.vue 先例)。运行时 IP 在列表行里已经有了。
//
// 移植纪律 #7(登记):Vue2 `v-for :key="net.ssid"` 在同名 SSID 时 key 重复
// (实测扫描结果里有 ssid="00:00:00:00:00:00" 这种隐藏 SSID)→ key 用 `bssid || ssid`
// (手动补进列表的「已连接但没扫到」那条没有 bssid,回落 ssid)。
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
        <!-- 断开按钮用 role=button 的 span:外层整行已经是 <button>,HTML 不允许嵌套 button -->
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
      <!-- Vue2 用的是 type="text"(明文,便于用户核对),照留 -->
      <input v-model="form.wireless.password" class="set-input set-net-password" type="text" />
    </label>

    <!-- 高级设置只在 client 模式出现;concurrent 模式用自动默认值(Vue2 L47-48 注释) -->
    <template v-if="form.wireless.mode === 'client'">
      <button class="set-net-adv" type="button" @click="showAdv = !showAdv">
        <span aria-hidden="true">{{ showAdv ? '▾' : '▸' }}</span>{{ t('settingsNetAdvanced') }}
      </button>

      <template v-if="showAdv">
        <label class="set-net-field">
          <span class="set-net-label">{{ t('settingsNetZone') }}</span>
          <!-- client 模式的 zone 只给 无 / WAN 两项(Vue2 L56-59 没有 LAN) -->
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
