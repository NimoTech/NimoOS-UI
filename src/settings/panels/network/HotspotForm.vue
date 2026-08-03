<script setup lang="ts">
// 热点(AP)表单。对位 Vue2 HotspotForm.vue(69 行)。
// 移植纪律 #1(登记):同 WifiForm —— Vue2 这里的 dnsString 也是子组件私有 ref、
// 保存时被丢掉;这里直接绑父层 form.dnsText。
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
      <!-- concurrent 模式频段跟随客户端(后端 watchdog 同步 channel),这里只读展示 —— Vue2 L10-11 -->
      <input
        v-if="form.wireless.mode === 'concurrent'"
        class="set-input set-net-band-auto"
        type="text"
        :value="t('settingsNetBandAuto')"
        disabled
      />
      <!-- 2.4GHz / 5GHz 是 Vue2 写死的字面量(不是 i18n key),照留 -->
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
      <!-- AP 恒 LAN,只读;concurrent 模式这一行不出现(由 Wi-Fi tab 管 zone)—— Vue2 L27-33 -->
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
