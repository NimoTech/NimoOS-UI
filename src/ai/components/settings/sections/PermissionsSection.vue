<!--
  Agent permission policy — box-wide confirmation-gate switches.
  Mirror of Vue2 src/views/AI/Settings/sections/PermissionsSection.vue (dual-repo rule).
  Admin-only endpoint: a 403 renders the read-only banner instead of the form.
  The PUT echoes the backend-normalized document — always re-render from the echo,
  never from what was sent.
-->
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import SetSwitch from '../SetSwitch.vue'

const { t } = useI18n()

type GateMode = 'ask' | 'auto'
type ShellMode = 'ask' | 'auto_gray' | 'auto_all'
type CtxMode = 'strict' | 'follow' | 'auto'

interface PolicyDoc {
  preset: string
  gates: Record<string, string>
  judges: { shell: boolean; egress: boolean }
  contexts: { tasks: CtxMode; channels: CtxMode }
  proxy: { tofu_ttl_hours: number; upload_threshold_kb: number }
}

// Preset id → the switch values it applies. `strict` mirrors the backend's
// factory defaults; keep in sync with agent/permissions.py default_policy().
const PRESET_VALUES: Record<string, Omit<PolicyDoc, 'preset' | 'proxy'>> = {
  strict: {
    gates: { apps: 'ask', message_bus: 'ask', notes: 'ask', wiki: 'ask',
             installs: 'ask', fs_access: 'ask', mcp_tools: 'ask',
             network: 'ask', upload: 'ask', shell: 'ask' },
    judges: { shell: true, egress: true },
    contexts: { tasks: 'strict', channels: 'strict' },
  },
  balanced: {
    gates: { apps: 'ask', message_bus: 'ask', notes: 'auto', wiki: 'auto',
             installs: 'ask', fs_access: 'auto', mcp_tools: 'auto',
             network: 'auto', upload: 'ask', shell: 'auto_gray' },
    judges: { shell: true, egress: true },
    contexts: { tasks: 'follow', channels: 'follow' },
  },
  trusted: {
    gates: { apps: 'auto', message_bus: 'auto', notes: 'auto', wiki: 'auto',
             installs: 'auto', fs_access: 'auto', mcp_tools: 'auto',
             network: 'auto', upload: 'auto', shell: 'auto_all' },
    judges: { shell: false, egress: false },
    contexts: { tasks: 'auto', channels: 'auto' },
  },
}

const preset = ref('custom')
const gates = ref<Record<string, string>>({ ...PRESET_VALUES.strict.gates })
const judges = ref({ ...PRESET_VALUES.strict.judges })
const contexts = ref({ ...PRESET_VALUES.strict.contexts })
const proxy = ref({ tofu_ttl_hours: 1, upload_threshold_kb: 64 })
const forbidden = ref(false)
const saving = ref(false)
const savedAt = ref(0)

const PRESETS = [
  { id: 'strict', nameKey: 'aiCfgPermPresetStrict', descKey: 'aiCfgPermPresetStrictDesc' },
  { id: 'balanced', nameKey: 'aiCfgPermPresetBalanced', descKey: 'aiCfgPermPresetBalancedDesc' },
  { id: 'trusted', nameKey: 'aiCfgPermPresetTrusted', descKey: 'aiCfgPermPresetTrustedDesc' },
]

const TOOL_GATES = [
  { key: 'fs_access', labelKey: 'aiCfgPermGateFs', subKey: 'aiCfgPermGateFsSub' },
  { key: 'notes', labelKey: 'aiCfgPermGateNotes', subKey: 'aiCfgPermGateNotesSub' },
  { key: 'wiki', labelKey: 'aiCfgPermGateWiki', subKey: 'aiCfgPermGateWikiSub' },
  { key: 'mcp_tools', labelKey: 'aiCfgPermGateMcp', subKey: 'aiCfgPermGateMcpSub' },
  { key: 'apps', labelKey: 'aiCfgPermGateApps', subKey: 'aiCfgPermGateAppsSub' },
  { key: 'installs', labelKey: 'aiCfgPermGateInstalls', subKey: 'aiCfgPermGateInstallsSub' },
  { key: 'message_bus', labelKey: 'aiCfgPermGateMb', subKey: 'aiCfgPermGateMbSub' },
]

function applyDoc(doc: unknown) {
  const d = doc as Partial<PolicyDoc> | null
  if (!d || typeof d !== 'object') return
  preset.value = d.preset || 'custom'
  gates.value = { ...gates.value, ...(d.gates || {}) }
  judges.value = { ...judges.value, ...(d.judges || {}) }
  contexts.value = { ...contexts.value, ...(d.contexts || {}) }
  proxy.value = { ...proxy.value, ...(d.proxy || {}) }
}

function buildDoc(): PolicyDoc {
  return {
    preset: preset.value,
    gates: { ...gates.value },
    judges: { ...judges.value },
    contexts: { ...contexts.value },
    proxy: {
      tofu_ttl_hours: Math.max(1, Math.floor(Number(proxy.value.tofu_ttl_hours) || 1)),
      upload_threshold_kb: Math.max(1, Math.floor(Number(proxy.value.upload_threshold_kb) || 64)),
    },
  }
}

function matchPreset(): string {
  const same = (a: Record<string, unknown>, b: Record<string, unknown>) =>
    Object.keys(b).every((k) => a[k] === b[k])
  for (const id of Object.keys(PRESET_VALUES)) {
    const p = PRESET_VALUES[id]
    if (same(gates.value, p.gates)
      && same(judges.value as Record<string, unknown>, p.judges as Record<string, unknown>)
      && same(contexts.value as Record<string, unknown>, p.contexts as Record<string, unknown>)) return id
  }
  return 'custom'
}

function is403(e: unknown): boolean {
  return !!(e && typeof e === 'object'
    && (e as { response?: { status?: number } }).response?.status === 403)
}

async function save() {
  saving.value = true
  try {
    applyDoc(await service.ai.putPermissionSettings(buildDoc() as unknown as Record<string, unknown>))
    savedAt.value = Date.now()
  } catch (e) {
    if (is403(e)) forbidden.value = true
  } finally {
    saving.value = false
  }
}

function setGate(key: string, value: GateMode | ShellMode) {
  gates.value = { ...gates.value, [key]: value }
  preset.value = matchPreset()
  void save()
}

function setJudge(key: 'shell' | 'egress', value: boolean) {
  judges.value = { ...judges.value, [key]: value }
  preset.value = matchPreset()
  void save()
}

function setContext(key: 'tasks' | 'channels', value: CtxMode) {
  contexts.value = { ...contexts.value, [key]: value }
  preset.value = matchPreset()
  void save()
}

function applyPreset(id: string) {
  const p = PRESET_VALUES[id]
  if (!p) return
  gates.value = { ...p.gates }
  judges.value = { ...p.judges }
  contexts.value = { ...p.contexts }
  preset.value = id
  void save()
}

onMounted(async () => {
  try {
    applyDoc(await service.ai.getPermissionSettings())
  } catch (e) {
    if (is403(e)) forbidden.value = true
  }
})

defineExpose({ gates, judges, contexts, preset, proxy, forbidden, setGate, setJudge, setContext, applyPreset, save })
</script>

<template>
  <div class="set-inner">
    <div class="set-page-head">
      <h1 class="set-h1">{{ t('aiCfgPermissions') }}</h1>
      <p class="set-desc">{{ t('aiCfgPermDesc') }}</p>
    </div>

    <div v-if="forbidden" class="set-banner">
      <span>{{ t('aiCfgPermAdminOnly') }}</span>
    </div>

    <template v-else>
      <div class="sk-section">
        <div class="sk-section-head">
          <div class="sk-section-title">{{ t('aiCfgPermPreset') }}</div>
        </div>
        <div class="sk-section-body">
          <div class="perm-presets">
            <button
              v-for="p in PRESETS" :key="p.id"
              class="perm-preset" :class="{ active: preset === p.id }"
              type="button"
              @click="applyPreset(p.id)"
            >
              <span class="perm-preset-name">{{ t(p.nameKey) }}</span>
              <span class="perm-preset-desc">{{ t(p.descKey) }}</span>
            </button>
          </div>
          <div v-if="preset === 'trusted'" class="set-banner warn">
            <span>{{ t('aiCfgPermTrustedWarn') }}</span>
          </div>
        </div>
      </div>

      <div class="sk-section">
        <div class="sk-section-head">
          <div class="sk-section-title">{{ t('aiCfgPermToolGates') }}</div>
        </div>
        <div class="sk-section-body">
          <div class="set-banner">
            <span>{{ t('aiCfgPermToolGatesHint') }}</span>
          </div>
          <div class="set-rows">
            <div v-for="g in TOOL_GATES" :key="g.key" class="set-row">
              <div class="lbl">
                {{ t(g.labelKey) }}
                <div class="sub">{{ t(g.subKey) }}</div>
              </div>
              <div class="val end">
                <SetSwitch
                  :model-value="gates[g.key] === 'auto'"
                  @update:model-value="(v: boolean) => setGate(g.key, v ? 'auto' : 'ask')"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="sk-section">
        <div class="sk-section-head">
          <div class="sk-section-title">{{ t('aiCfgPermShell') }}</div>
        </div>
        <div class="sk-section-body">
          <div class="set-rows">
            <div class="set-row">
              <div class="lbl">
                {{ t('aiCfgPermShellMode') }}
                <div class="sub">{{ t('aiCfgPermShellModeSub') }}</div>
              </div>
              <div class="val end">
                <select
                  class="set-select" :value="gates.shell"
                  @change="(e: Event) => setGate('shell', (e.target as HTMLSelectElement).value as ShellMode)"
                >
                  <option value="ask">{{ t('aiCfgPermShellAsk') }}</option>
                  <option value="auto_gray">{{ t('aiCfgPermShellAutoGray') }}</option>
                  <option value="auto_all">{{ t('aiCfgPermShellAutoAll') }}</option>
                </select>
              </div>
            </div>
            <div class="set-row">
              <div class="lbl">
                {{ t('aiCfgPermShellJudge') }}
                <div class="sub">{{ t('aiCfgPermShellJudgeSub') }}</div>
              </div>
              <div class="val end">
                <SetSwitch
                  :model-value="judges.shell"
                  @update:model-value="(v: boolean) => setJudge('shell', v)"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="sk-section">
        <div class="sk-section-head">
          <div class="sk-section-title">{{ t('aiCfgPermNetwork') }}</div>
        </div>
        <div class="sk-section-body">
          <div class="set-rows">
            <div class="set-row">
              <div class="lbl">
                {{ t('aiCfgPermNetworkGate') }}
                <div class="sub">{{ t('aiCfgPermNetworkGateSub') }}</div>
              </div>
              <div class="val end">
                <SetSwitch
                  :model-value="gates.network === 'auto'"
                  @update:model-value="(v: boolean) => setGate('network', v ? 'auto' : 'ask')"
                />
              </div>
            </div>
            <div class="set-row">
              <div class="lbl">
                {{ t('aiCfgPermUploadGate') }}
                <div class="sub">{{ t('aiCfgPermUploadGateSub') }}</div>
              </div>
              <div class="val end">
                <SetSwitch
                  :model-value="gates.upload === 'auto'"
                  @update:model-value="(v: boolean) => setGate('upload', v ? 'auto' : 'ask')"
                />
              </div>
            </div>
            <div class="set-row">
              <div class="lbl">
                {{ t('aiCfgPermEgressJudge') }}
                <div class="sub">{{ t('aiCfgPermEgressJudgeSub') }}</div>
              </div>
              <div class="val end">
                <SetSwitch
                  :model-value="judges.egress"
                  @update:model-value="(v: boolean) => setJudge('egress', v)"
                />
              </div>
            </div>
            <div class="set-row">
              <div class="lbl">
                {{ t('aiCfgPermTofuTtl') }}
                <div class="sub">{{ t('aiCfgPermRestartHint') }}</div>
              </div>
              <div class="val end">
                <input
                  v-model.number="proxy.tofu_ttl_hours"
                  class="set-input num" type="number" min="1" step="1"
                  @change="save"
                >
              </div>
            </div>
            <div class="set-row">
              <div class="lbl">
                {{ t('aiCfgPermUploadThreshold') }}
                <div class="sub">{{ t('aiCfgPermRestartHint') }}</div>
              </div>
              <div class="val end">
                <input
                  v-model.number="proxy.upload_threshold_kb"
                  class="set-input num" type="number" min="1" step="1"
                  @change="save"
                >
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="sk-section">
        <div class="sk-section-head">
          <div class="sk-section-title">{{ t('aiCfgPermContexts') }}</div>
        </div>
        <div class="sk-section-body">
          <div class="set-banner">
            <span>{{ t('aiCfgPermContextsHint') }}</span>
          </div>
          <div class="set-rows">
            <div class="set-row">
              <div class="lbl">
                {{ t('aiCfgPermTasksMode') }}
                <div class="sub">{{ t('aiCfgPermTasksModeSub') }}</div>
              </div>
              <div class="val end">
                <select
                  class="set-select" :value="contexts.tasks"
                  @change="(e: Event) => setContext('tasks', (e.target as HTMLSelectElement).value as CtxMode)"
                >
                  <option value="strict">{{ t('aiCfgPermCtxStrict') }}</option>
                  <option value="follow">{{ t('aiCfgPermCtxFollow') }}</option>
                  <option value="auto">{{ t('aiCfgPermCtxAuto') }}</option>
                </select>
              </div>
            </div>
            <div class="set-row">
              <div class="lbl">
                {{ t('aiCfgPermChannelsMode') }}
                <div class="sub">{{ t('aiCfgPermChannelsModeSub') }}</div>
              </div>
              <div class="val end">
                <select
                  class="set-select" :value="contexts.channels"
                  @change="(e: Event) => setContext('channels', (e.target as HTMLSelectElement).value as CtxMode)"
                >
                  <option value="strict">{{ t('aiCfgPermCtxStrict') }}</option>
                  <option value="follow">{{ t('aiCfgPermCtxFollow') }}</option>
                  <option value="auto">{{ t('aiCfgPermCtxAuto') }}</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="set-banner">
        <span>{{ t('aiCfgPermHardFloor') }}</span>
      </div>
      <span class="set-actions"><span class="hint">{{ saving ? t('aiCfgSaving') : (savedAt ? t('aiCfgSaved') : '') }}</span></span>
    </template>
  </div>
</template>

<style scoped>
.perm-presets { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 10px; }
.perm-preset {
  flex: 1 1 140px; text-align: left; cursor: pointer;
  border: 1px solid var(--line); border-radius: var(--r-sm);
  background: var(--bg-canvas); padding: 10px 12px;
  display: flex; flex-direction: column; gap: 4px;
  transition: all 120ms ease;
}
.perm-preset:hover { border-color: var(--accent); }
.perm-preset.active { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-softer); }
.perm-preset-name { font-size: 13px; font-weight: 600; color: var(--text-primary); }
.perm-preset-desc { font-size: 12px; color: var(--text-secondary); }
.set-banner.warn { border-color: var(--warn, #d97706); }
</style>
