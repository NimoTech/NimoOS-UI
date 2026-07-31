<script setup lang="ts">
// 对位 Vue2 SettingsPanel.vue L326-348(developer 分支)+ getSSLConfig / toggleHTTPS。
// 头部用返回按钮而不是 h1(Vue2 L52-56),P0 已经这么做了,保持不变。
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { service, type SSLConfig } from '@nimotech/nimoos-service'
import SettingsSection from '../components/SettingsSection.vue'
import SettingsRow from '../components/SettingsRow.vue'
import SettingsSwitch from '../components/SettingsSwitch.vue'
import WebUiHttpsDialog from '../components/WebUiHttpsDialog.vue'
import { useToast } from '../../stores/toast'
import '../styles/settings.css'

const { t } = useI18n()
const toast = useToast()
const emit = defineEmits<{ 'open-tab': [tab: string] }>()

const cfg = ref<SSLConfig | null>(null)
const enabled = ref(false)
const busy = ref(false)
const dialogOpen = ref(false)

// 交错路径守卫(newui-async-stale-guard):load() 在挂载时(以及弹窗 saved 之后)异步
// 拉取配置。如果用户在它返回之前已经拨了开关,迟到的服务端值不能把 enabled 弹回旧值 ——
// 那会让开关的显示状态说谎(用户明明操作成功了)。局部变量即可,不抽公共 composable。
let editedDuringLoad = false

async function load() {
  editedDuringLoad = false
  try {
    const c = await service.sys.getSSLConfig()
    if (editedDuringLoad) return
    cfg.value = c
    enabled.value = c.enabled
  } catch (e) {
    console.warn('[settings] getSSLConfig failed', e)
  }
}
onMounted(load)

async function toggle(next: boolean) {
  if (busy.value) return
  editedDuringLoad = true
  const prev = enabled.value
  enabled.value = next
  busy.value = true
  try {
    // 兜底值逐字照 Vue2 toggleHTTPS(L1324-1330):域名 nimoos.local、端口 443、证书 auto
    await service.sys.setSSLConfig({
      enabled: next,
      domain: cfg.value?.domain || 'nimoos.local',
      port: String(cfg.value?.port || '443'),
      cert_type: cfg.value?.cert_type || 'auto',
    })
    toast.show(t('settingsSaveSuccess'))
  } catch (e) {
    enabled.value = prev            // 对位 Vue2 sslEnabled = !val
    console.warn('[settings] setSSLConfig failed', e)
    toast.show(t('settingsSaveFailed'))
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <SettingsSection
    :title="t('settingsTabDeveloper')"
    back-to="general"
    @back="emit('open-tab', $event)"
  >
    <div class="set-list">
      <SettingsRow :label="t('settingsHttps')">
        <template #control>
          <SettingsSwitch
            :model-value="enabled"
            :label="t('settingsHttps')"
            :disabled="busy"
            @update:model-value="toggle"
          />
        </template>
      </SettingsRow>

      <!-- 只在 HTTPS 开启后才出现(对位 Vue2 v-if="sslEnabled") -->
      <SettingsRow
        v-if="enabled"
        class="dp-config"
        :label="t('settingsHttpsConfig')"
        clickable
        @click="dialogOpen = true"
      />
    </div>

    <WebUiHttpsDialog
      :open="dialogOpen"
      @update:open="dialogOpen = $event"
      @saved="load"
    />
  </SettingsSection>
</template>
