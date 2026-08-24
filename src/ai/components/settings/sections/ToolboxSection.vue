<!--
  ToolboxSection — persistent CLI components for the agent sandbox.
  Ported 1:1 from Vue2 src/views/AI/Settings/sections/ToolboxSection.vue
  (feat/toolbox-upgrade tip, which adds the upgrade button when the catalog
  version is ahead of the installed one).

  [D2 declaration] State lives in component local scope (ref), calling
  service.ai directly — same policy as ChannelsSection/BlacklistSection.

  Zero <style> block by repo convention: `.tok-noop` / `.tox-err` /
  `.tox-spin` / `.tok-row.unmanaged` live in settings-styles.scss with a
  specificity guard in settingsStyles.test.ts (`.tok-noop` is a button and
  must outrank the `.set-app button` reset).
-->
<template>
  <div class="set-inner">
    <div class="set-page-head">
      <h1 class="set-h1">{{ t('aiCfgToolbox') }}</h1>
      <p class="set-desc">{{ t('aiCfgToolboxDesc') }}</p>
    </div>

    <div class="sk-section">
      <div class="sk-section-head">
        <div class="sk-section-title">{{ t('aiCfgToolboxComponents') }}</div>
        <div class="sk-section-hint">{{ components.length }}</div>
      </div>
      <div class="sk-section-body">
        <div v-if="loading" class="set-note">{{ t('aiCfgLoadingDots') }}</div>
        <div v-else-if="!components.length" class="set-note">{{ t('aiCfgToolboxEmpty') }}</div>
        <div
          v-for="c in components"
          v-else
          :key="c.id"
          class="tok-row"
          :class="{ unmanaged: isUnmanaged(c) }"
        >
          <span class="tok-ic"><AgentIcon name="grid" :size="16" /></span>
          <div class="tok-body">
            <div class="tok-name">{{ c.name || c.id }}</div>
            <div class="tok-meta">
              <span v-if="c.description">{{ c.description }}</span>
              <template v-if="isUnmanaged(c)">
                <span class="sep"></span>
                <span>{{ t('aiCfgToolboxUnmanaged') }}</span>
              </template>
              <template v-else>
                <span class="sep"></span>
                <span>{{ versionLabel(c) }}</span>
              </template>
            </div>
            <div v-if="c.status === 'failed' && c.error" class="tox-err">{{ c.error }}</div>
          </div>
          <span class="set-pill" :data-s="pillState(c.status)">
            <span class="d"></span>{{ statusLabel(c.status) }}
          </span>
          <button v-if="isUnmanaged(c)" class="tok-noop" disabled>
            {{ t('aiCfgToolboxUnmanaged') }}
          </button>
          <button v-else-if="c.status === 'installing'" class="tok-noop" disabled>
            <span class="tox-spin"></span> {{ t('aiCfgToolboxInstalling') }}
          </button>
          <template v-else-if="c.status === 'installed'">
            <button
              v-if="canUpgrade(c)"
              class="sk-btn primary"
              :disabled="busyId === c.id"
              data-test="toolbox-upgrade"
              @click="onUpgrade(c)"
            >
              <AgentIcon name="download" :size="13" />
              {{ t('aiCfgToolboxUpgradeTo', { version: c.latest_version }) }}
            </button>
            <button
              class="tok-del"
              :disabled="busyId === c.id"
              data-test="toolbox-uninstall"
              @click="onUninstall(c)"
            >
              <AgentIcon name="trash" :size="13" /> {{ t('aiCfgToolboxUninstall') }}
            </button>
          </template>
          <button
            v-else
            class="sk-btn primary"
            :disabled="busyId === c.id"
            data-test="toolbox-install"
            @click="onInstall(c)"
          >
            <AgentIcon name="download" :size="13" /> {{ t('aiCfgToolboxInstall') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import { useToast } from '../../../../stores/toast'
import AgentIcon from '../../icons/AgentIcon.vue'

const { t } = useI18n()
const toast = useToast()

// Test seam (Vue2's `pollIntervalMs` escape hatch): tests shrink the wait so
// a settle-poll finishes inside the test budget.
const props = withDefaults(defineProps<{ pollIntervalMs?: number }>(), {
  pollIntervalMs: 2000,
})

interface ToolboxComponent {
  id: string
  name?: string
  description?: string
  latest_version?: string
  installed_version?: string | null
  status: string
  error?: string
}

const components = ref<ToolboxComponent[]>([])
const loading = ref(false)
const busyId = ref('')

// Vue2 kept `_destroyed` out of data() as instance bookkeeping; the
// composition-API equivalent is a plain ref flipped in onBeforeUnmount so
// the poll loop stops when the user navigates away mid-install.
const destroyed = ref(false)
onBeforeUnmount(() => {
  destroyed.value = true
})

async function load() {
  loading.value = true
  try {
    const r = (await service.ai.listToolboxComponents()) as { components?: ToolboxComponent[] }
    components.value = (r && r.components) || []
  } catch {
    toast.show(t('aiCfgLoadFailed'), 3000, 'danger')
  } finally {
    loading.value = false
  }
}

async function poll(pred: (list: ToolboxComponent[]) => boolean, tries = 60) {
  for (let i = 0; i < tries; i++) {
    if (destroyed.value) return false
    await load()
    if (pred(components.value)) return true
    await new Promise((r) => setTimeout(r, props.pollIntervalMs))
  }
  return false
}

function settled(id: string) {
  return (list: ToolboxComponent[]) => {
    const c = list.find((x) => x.id === id)
    return !!c && c.status !== 'installing'
  }
}

async function onInstall(comp: ToolboxComponent) {
  busyId.value = comp.id
  try {
    await service.ai.installToolboxComponent(comp.id)
    await poll(settled(comp.id))
  } catch {
    toast.show(t('aiCfgToolboxInstallFailed'), 3000, 'danger')
  } finally {
    busyId.value = ''
  }
}

async function onUpgrade(comp: ToolboxComponent) {
  busyId.value = comp.id
  try {
    await service.ai.upgradeToolboxComponent(comp.id)
    await poll(settled(comp.id))
  } catch {
    toast.show(t('aiCfgToolboxUpgradeFailed'), 3000, 'danger')
  } finally {
    busyId.value = ''
  }
}

async function onUninstall(comp: ToolboxComponent) {
  busyId.value = comp.id
  try {
    await service.ai.uninstallToolboxComponent(comp.id)
    await load()
  } catch {
    toast.show(t('aiCfgToolboxUninstallFailed'), 3000, 'danger')
  } finally {
    busyId.value = ''
  }
}

function isUnmanaged(c: ToolboxComponent) {
  return typeof c.id === 'string' && c.id.indexOf('unmanaged:') === 0
}

function canUpgrade(c: ToolboxComponent) {
  return !!(c.installed_version && c.latest_version && c.installed_version !== c.latest_version)
}

function versionLabel(c: ToolboxComponent) {
  if (c.installed_version) return t('aiCfgToolboxVersionInstalled', { version: c.installed_version })
  if (c.latest_version) return t('aiCfgToolboxVersionAvailable', { version: c.latest_version })
  return ''
}

// Vue2 mapping preserved: failed→'off' (settings-styles only knows
// ok/warn/off), and not_installed gets no pill state at all — an
// uninstalled component must not light a dot.
function pillState(status: string) {
  if (status === 'installed') return 'ok'
  if (status === 'installing') return 'warn'
  if (status === 'failed') return 'off'
  return ''
}

function statusLabel(status: string) {
  if (status === 'installed') return t('aiCfgToolboxInstalled')
  if (status === 'installing') return t('aiCfgToolboxInstalling')
  if (status === 'failed') return t('aiCfgToolboxFailed')
  if (status === 'unmanaged') return t('aiCfgToolboxUnmanaged')
  return t('aiCfgToolboxNotInstalled')
}

onMounted(() => {
  void load()
})
</script>
