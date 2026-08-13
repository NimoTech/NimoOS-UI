<script setup lang="ts">
// Counterpart of Vue2 DeviceInfoPanel.vue (191 lines). 5 rows: Platform / DC / CPU / RAM / GPU.
// Container swapped from a Buefy modal to New-UI's existing ui/Dialog.vue (reka), content 1:1 (same-kind container replacement per authorized deviation #2).
// Only fetch data when open turns true — no need to hit the hardware API just by entering the settings page.
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { service, type HardwareInfo } from '@nimotech/nimoos-service'
import Dialog from '../../components/ui/Dialog.vue'
import { toDeviceInfoView } from '../util/deviceInfo'
import '../styles/settings.css'

defineOptions({ name: 'DeviceInfoDialog' })
const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ 'update:open': [boolean] }>()

const { t } = useI18n()
const hw = ref<HardwareInfo | null>(null)
const deviceId = ref<string | null>(null)
const view = ref(toDeviceInfoView(null, null))

async function load() {
  // The two APIs succeed/fail independently: hardware failing shouldn't hide DC too (two sources in Vue2; keep them independent here)
  await Promise.allSettled([
    service.sys.hardwareInfo().then((r) => { hw.value = r }),
    service.sys.getBaseInfo().then((r) => { deviceId.value = r.device_id }),
  ])
  view.value = toDeviceInfoView(hw.value, deviceId.value)
}

watch(() => props.open, (o) => { if (o) void load() }, { immediate: true })
</script>

<template>
  <Dialog :open="open" :title="t('settingsDeviceInfoTitle')" @update:open="emit('update:open', $event)">
    <div class="dev-rows">
      <div class="dev-row">
        <span class="dev-label">Platform</span>
        <span class="dev-value one-line">{{ view.platform }}</span>
      </div>
      <div class="dev-row">
        <span class="dev-label">DC</span>
        <span class="dev-value one-line">{{ view.deviceId }}</span>
      </div>
      <div class="dev-row">
        <span class="dev-label">CPU</span>
        <span class="dev-value">
          <span class="dev-strong">{{ view.cpuModel || t('settingsDeviceDetecting') }}</span>
          <span class="dev-sub">{{ view.cpuCores }} Cores | {{ view.cpuFreq }} | {{ view.cpuThreads }} Threads</span>
        </span>
      </div>
      <div class="dev-row">
        <span class="dev-label">RAM</span>
        <span class="dev-value">
          <span class="dev-strong">{{ view.ramDetail }}</span>
          <span class="dev-sub">{{ view.ramFreq }} | {{ view.ramType }}</span>
        </span>
      </div>
      <div class="dev-row">
        <span class="dev-label">GPU</span>
        <span class="dev-value">
          <span v-for="(g, i) in view.gpuList" :key="i" class="dev-gpu dev-strong">{{ g }}</span>
          <span v-if="view.gpuList.length === 0" class="dev-sub">{{ t('settingsDeviceNoGpu') }}</span>
        </span>
      </div>
    </div>
  </Dialog>
</template>

<style scoped>
.dev-rows { display: flex; flex-direction: column; gap: 12px; min-width: min(520px, 80vw); }
.dev-row {
  display: flex; align-items: flex-start; gap: 20px;
  padding: 14px 16px; border: 1px solid var(--border); border-radius: var(--radius-sm);
  background: var(--card-bg);
}
.dev-label {
  flex: 0 0 56px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;
  color: var(--fg-muted); padding-top: 2px;
}
.dev-value { display: flex; flex-direction: column; gap: 4px; flex: 1 1 auto; min-width: 0; font-size: 14px; }
.dev-strong { font-weight: 500; }
.dev-sub { font-size: 12px; color: var(--fg-muted); }
.one-line { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
