<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { SettingsModel } from '../../util/composeSettings'
import { RESTART_OPTIONS, CPU_OPTIONS, CAP_OPTIONS } from '../../util/composeSettings'
import { renderMarkdown } from '../../../files/viewers/renderMarkdown'
import PairRowsEditor from './PairRowsEditor.vue'
import PortsEditor from './PortsEditor.vue'

const props = defineProps<{ model: SettingsModel; conflicts?: string[] }>()
const { t } = useI18n()

const cur = ref(0)
const svc = computed(() => props.model.services[cur.value])
const showPreview = ref(false)
const tipsHtml = computed(() => renderMarkdown(props.model.tipsCustom))

const memoryStr = computed({
  get: () => (svc.value.memoryMB == null ? '' : String(svc.value.memoryMB)),
  set: (v: string) => { const n = parseInt(v, 10); svc.value.memoryMB = Number.isFinite(n) && n > 0 ? n : null },
})

const publishedPorts = computed(() => props.model.services.flatMap((s) => s.ports.map((p) => p.published)).filter(Boolean))
</script>

<template>
  <div class="settings-form">
    <div v-if="model.services.length > 1" class="svc-tabs">
      <button
        v-for="(s, i) in model.services" :key="s.name" type="button"
        class="svc-tab" :class="{ on: i === cur }" data-test="svc-tab" @click="cur = i"
      >{{ s.name }}</button>
    </div>

    <section v-if="cur === 0" class="set-section" data-test="webui-section">
      <h3>{{ t('appsSettingsSectionWeb') }}</h3>
      <div class="set-grid">
        <label>{{ t('appsSettingsAppTitle') }}<input v-model="model.webui.titleCustom" class="set-input" /></label>
        <label>{{ t('appsSettingsIconUrl') }}<input v-model="model.webui.icon" class="set-input" /></label>
        <label>{{ t('appsSettingsScheme') }}
          <select v-model="model.webui.scheme" class="set-input"><option value="http">http</option><option value="https">https</option></select>
        </label>
        <label>{{ t('appsSettingsHostname') }}<input v-model="model.webui.hostname" class="set-input" :placeholder="t('appsSettingsHostnamePh')" /></label>
        <label>{{ t('appsSettingsWebPort') }}<input v-model="model.webui.portMap" class="set-input" data-test="webui-port" list="webui-ports" /></label>
        <label>{{ t('appsSettingsIndex') }}<input v-model="model.webui.index" class="set-input" /></label>
      </div>
      <datalist id="webui-ports"><option v-for="p in publishedPorts" :key="p" :value="p" /></datalist>
    </section>

    <section class="set-section">
      <h3>{{ t('appsSettingsSectionPorts') }}</h3>
      <PortsEditor :rows="svc.ports" :conflicts="conflicts" :extras="svc.portsExtra" />
    </section>
    <section class="set-section">
      <h3>{{ t('appsSettingsSectionEnv') }}</h3>
      <PairRowsEditor :rows="svc.environment" :label-a="t('appsSettingsKey')" :label-b="t('appsSettingsValue')" />
    </section>
    <section class="set-section">
      <h3>{{ t('appsSettingsSectionVolumes') }}</h3>
      <PairRowsEditor :rows="svc.volumes" :label-a="t('appsSettingsVolHost')" :label-b="t('appsSettingsVolContainer')" />
    </section>
    <section class="set-section">
      <h3>{{ t('appsSettingsSectionDevices') }}</h3>
      <PairRowsEditor :rows="svc.devices" :label-a="t('appsSettingsDevHost')" :label-b="t('appsSettingsDevContainer')" />
    </section>

    <section class="set-section">
      <h3>{{ t('appsSettingsSectionAdvanced') }}</h3>
      <div class="set-grid">
        <label>{{ t('appsSettingsImage') }}<input v-model="svc.image" class="set-input" data-test="svc-image" /></label>
        <label>{{ t('appsSettingsContainerName') }}<input v-model="svc.containerName" class="set-input" /></label>
        <label>{{ t('appsSettingsRestart') }}
          <select v-model="svc.restart" class="set-input"><option v-for="r in RESTART_OPTIONS" :key="r" :value="r">{{ r }}</option></select>
        </label>
        <label>{{ t('appsSettingsMemory') }}<input v-model="memoryStr" class="set-input" data-test="svc-memory" type="text" inputmode="numeric" :placeholder="t('appsSettingsMemoryPh')" /></label>
        <label>{{ t('appsSettingsCpu') }}
          <select v-model.number="svc.cpuShares" class="set-input"><option v-for="c in CPU_OPTIONS" :key="c.value" :value="c.value">{{ t(c.labelKey) }}</option></select>
        </label>
        <label class="set-check"><input v-model="svc.privileged" type="checkbox" />{{ t('appsSettingsPrivileged') }}</label>
      </div>
      <details class="cap-details">
        <summary>{{ t('appsSettingsCapAdd') }}<span v-if="svc.capAdd.length"> ({{ svc.capAdd.length }})</span></summary>
        <div class="cap-grid">
          <label v-for="c in CAP_OPTIONS" :key="c" class="set-check"><input v-model="svc.capAdd" type="checkbox" :value="c" />{{ c }}</label>
        </div>
      </details>
    </section>

    <section class="set-section">
      <h3>{{ t('appsSettingsSectionTips') }}</h3>
      <div class="tips-toolbar">
        <button type="button" class="row-add" :class="{ on: !showPreview }" @click="showPreview = false">{{ t('appsSettingsTipsEdit') }}</button>
        <button type="button" class="row-add" :class="{ on: showPreview }" data-test="tips-preview-btn" @click="showPreview = true">{{ t('appsSettingsTipsPreview') }}</button>
      </div>
      <textarea v-if="!showPreview" v-model="model.tipsCustom" class="set-input tips-area" rows="6" data-test="tips-input" />
      <!-- eslint-disable-next-line vue/no-v-html -- renderMarkdown html:false,输出已转义 -->
      <div v-else class="tips-preview" data-test="tips-preview" v-html="tipsHtml" />
    </section>
  </div>
</template>

<style scoped>
.settings-form { display: flex; flex-direction: column; gap: 14px; }

.svc-tabs { display: flex; gap: 8px; flex-wrap: wrap; }
.svc-tab {
  padding: 6px 14px; font-size: 13px; cursor: pointer; color: var(--fg-muted);
  background: var(--chip-bg); border: 1px solid var(--card-border); border-radius: 999px;
}
.svc-tab:hover { background: var(--chip-bg-hi); }
.svc-tab.on { background: var(--accent-soft); color: var(--accent-text); border-color: var(--accent-soft-bd); }

.set-section {
  background: var(--card-bg); border: 1px solid var(--card-border); border-radius: var(--radius);
  padding: 14px 16px; display: flex; flex-direction: column; gap: 10px;
}
.set-section h3 { margin: 0; font-size: 14px; color: var(--fg); }

.set-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 10px; }
.set-grid label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--fg-muted); }
.set-check { flex-direction: row !important; align-items: center; gap: 6px !important; font-size: 13px !important; color: var(--fg) !important; }

.set-input {
  width: 100%; box-sizing: border-box; padding: 7px 10px; font-size: 13px;
  color: var(--fg); background: var(--chip-bg); border: 1px solid var(--card-border); border-radius: 9px; outline: none;
}
.set-input:focus { border-color: var(--accent); }
.tips-area { resize: vertical; font-family: inherit; }

.row-add { padding: 6px 12px; font-size: 12.5px; cursor: pointer; color: var(--fg); background: var(--chip-bg); border: 1px solid var(--card-border); border-radius: 9px; }
.row-add:hover { background: var(--chip-bg-hi); }
.row-add.on { background: var(--accent-soft); color: var(--accent-text); border-color: var(--accent-soft-bd); }

.tips-toolbar { display: flex; gap: 8px; }

.cap-details { color: var(--fg); }
.cap-details summary { cursor: pointer; font-size: 13px; color: var(--fg-muted); }
.cap-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 6px; margin-top: 8px; }

.tips-preview { font-size: 13px; line-height: 1.7; color: var(--fg); overflow-wrap: anywhere; }
.tips-preview :deep(a) { color: var(--accent); }
.tips-preview :deep(img) { max-width: 100%; }
.tips-preview :deep(code) { background: var(--chip-bg); border-radius: 4px; padding: 1px 5px; word-break: break-all; }
.tips-preview :deep(pre) {
  background: var(--chip-bg); border-radius: 8px; padding: 10px 12px; margin: 8px 0;
  white-space: pre-wrap; word-break: break-all; max-width: 100%;
}
.tips-preview :deep(pre code) { background: none; padding: 0; }
</style>
