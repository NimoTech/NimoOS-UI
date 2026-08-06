<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { DockerNetwork } from '@nimotech/nimoos-service'
import type { SettingsModel } from '../../util/composeSettings'
import { RESTART_OPTIONS, CPU_OPTIONS, CAP_OPTIONS, rewriteImageTag } from '../../util/composeSettings'
import { renderMarkdown } from '../../../files/viewers/renderMarkdown'
import PairRowsEditor from './PairRowsEditor.vue'
import PortsEditor from './PortsEditor.vue'

const props = defineProps<{
  model: SettingsModel; conflicts?: string[]
  networks?: DockerNetwork[]
  stableTags?: Record<string, string | null>
}>()
const { t } = useI18n()

const NETWORK_MODE_VALUES = ['bridge', 'host', 'none']

const cur = ref(0)
const svc = computed(() => props.model.services[cur.value])
const showPreview = ref(false)
const tipsHtml = computed(() => renderMarkdown(props.model.tipsCustom))

const memoryStr = computed({
  get: () => (svc.value.memoryMB == null ? '' : String(svc.value.memoryMB)),
  set: (v: string) => { const n = parseInt(v, 10); svc.value.memoryMB = Number.isFinite(n) && n > 0 ? n : null },
})

const publishedPorts = computed(() => props.model.services.flatMap((s) => s.ports.map((p) => p.published)).filter(Boolean))

// ── D5: command 逐 token 编辑 ──
function addCmd() { svc.value.commandTokens.push(''); svc.value.commandDirty = true }
function delCmd(i: number) { svc.value.commandTokens.splice(i, 1); svc.value.commandDirty = true }
function setCmd(i: number, ev: Event) { svc.value.commandTokens[i] = (ev.target as HTMLInputElement).value; svc.value.commandDirty = true }

// ── D5: 网络下拉,按 driver 分组,bridge/host/none 置顶 ──
const networkGroups = computed(() => {
  const groups = new Map<string, DockerNetwork[]>()
  for (const n of props.networks ?? []) {
    if (NETWORK_MODE_VALUES.includes(n.name)) continue // 默认网络已固定置顶,不重复列出
    if (!groups.has(n.driver)) groups.set(n.driver, [])
    groups.get(n.driver)!.push(n)
  }
  return [...groups.entries()].map(([driver, nets]) => ({ driver, nets }))
})
function onNetworkChange() { svc.value.networkDirty = true }

// ── D5: stable tag 下拉,贴在 image 输入框旁 ──
const currentStableTag = computed(() => props.stableTags?.[svc.value.name] ?? null)
function imageTagOf(image: string): string {
  const i = image.lastIndexOf(':')
  if (i < 0) return ''
  const after = image.slice(i + 1)
  return after.includes('/') ? '' : after
}
const tagSelect = computed<string>({
  get: () => {
    const cur = imageTagOf(svc.value.image)
    if (currentStableTag.value && cur === currentStableTag.value) return 'stable'
    if (cur === 'latest') return 'latest'
    return ''
  },
  set: (v: string) => {
    if (v === 'latest') svc.value.image = rewriteImageTag(svc.value.image, 'latest')
    else if (v === 'stable' && currentStableTag.value) svc.value.image = rewriteImageTag(svc.value.image, currentStableTag.value)
  },
})
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
      <h3>{{ t('appsSettingsCommand') }}</h3>
      <p class="set-hint">{{ t('appsSettingsCmdHint') }}</p>
      <div class="pair-editor">
        <div v-for="(tok, i) in svc.commandTokens" :key="i" class="cmd-row">
          <input :value="tok" class="set-input" type="text" data-test="cmd-input"
            :placeholder="t('appsSettingsCmdTokenPh')" @input="setCmd(i, $event)" />
          <button class="row-del" type="button" data-test="cmd-del" :aria-label="t('appsSettingsRemove')" @click="delCmd(i)">✕</button>
        </div>
        <button class="row-add" type="button" data-test="cmd-add" @click="addCmd">+ {{ t('appsSettingsAdd') }}</button>
      </div>
    </section>
    <section class="set-section">
      <h3>{{ t('appsSettingsNetwork') }}</h3>
      <p v-if="svc.networksMultiple" class="set-hint">{{ t('appsSettingsNetworkMulti') }}</p>
      <select v-model="svc.network" class="set-input" data-test="svc-network"
        :disabled="svc.networksMultiple" @change="onNetworkChange">
        <option value="">—</option>
        <option value="bridge">bridge</option>
        <option value="host">host</option>
        <option value="none">none</option>
        <optgroup v-for="g in networkGroups" :key="g.driver" :label="g.driver">
          <option v-for="n in g.nets" :key="n.id" :value="n.name">{{ n.name }}</option>
        </optgroup>
      </select>
    </section>

    <section class="set-section">
      <h3>{{ t('appsSettingsSectionAdvanced') }}</h3>
      <div class="set-grid">
        <label>{{ t('appsSettingsImage') }}
          <div class="image-row">
            <input v-model="svc.image" class="set-input" data-test="svc-image" />
            <select v-if="currentStableTag != null" v-model="tagSelect" class="set-input tag-select" data-test="tag-select">
              <option value="latest">{{ t('appsSettingsTagLatest') }}</option>
              <option value="stable">{{ t('appsSettingsTagStable') }} ({{ currentStableTag }})</option>
            </select>
          </div>
        </label>
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
/* 上面那条把 background 设成了 var(--chip-bg) —— 深色主题下它是**半透明白的渐变**。
 * 本文件有 5 个 <select class="set-input">:作者一旦给 <select> 指定背景,Chrome 就把它带到
 * 弹出列表上,而原生 option **不渲染 gradient**(退回浏览器默认白底),配上近白的 --fg 就是
 * 白底白字。根节点的 color-scheme: dark 救不了(作者背景优先)。`.set-input` 同时给文本框用,
 * 多这条后代规则对文本框无影响。守卫:styles/selectPopup.test.ts。 */
.set-input option,
.set-input optgroup {
  background-color: var(--set-option-bg);
  color: var(--set-option-fg);
}
.tips-area { resize: vertical; font-family: inherit; }

.set-hint { margin: 2px 0 8px; font-size: 12px; color: var(--fg-muted); }

.pair-editor { display: flex; flex-direction: column; gap: 8px; }
.cmd-row { display: grid; grid-template-columns: 1fr 28px; gap: 8px; align-items: center; }

.image-row { display: flex; gap: 8px; }
.image-row .set-input { flex: 1 1 auto; min-width: 0; }
.tag-select { flex: 0 0 auto; width: auto; }

.row-add { align-self: flex-start; padding: 6px 12px; font-size: 12.5px; cursor: pointer; color: var(--fg); background: var(--chip-bg); border: 1px solid var(--card-border); border-radius: 9px; }
.row-add:hover { background: var(--chip-bg-hi); }
.row-add.on { background: var(--accent-soft); color: var(--accent-text); border-color: var(--accent-soft-bd); }
.row-del { width: 28px; height: 28px; border: none; border-radius: 8px; cursor: pointer; background: transparent; color: var(--fg-muted); }
.row-del:hover { background: var(--chip-bg-hi); color: var(--remove-fg); }

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
