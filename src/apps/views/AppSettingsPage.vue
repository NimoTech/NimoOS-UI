<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  DialogRoot, DialogPortal, DialogOverlay, DialogContent, DialogTitle,
} from 'reka-ui'
import { service, type DockerNetwork } from '@nimotech/nimoos-service'
import AreaShell from '../../components/shell/AreaShell.vue'
import AppsSidebar from '../components/AppsSidebar.vue'
import ComposeSettingsForm from '../components/settings/ComposeSettingsForm.vue'
import YamlEditor from '../components/custom/YamlEditor.vue'
import { useAppSettings } from '../composables/useAppSettings'
import { useInstalledAppsStore } from '../stores/installedApps'
import { useToast } from '../../stores/toast'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const installed = useInstalledAppsStore()
const id = computed(() => String(route.params.name ?? ''))
const s = useAppSettings(id)
const app = computed(() => installed.apps.find((a) => a.id === id.value))

const networks = ref<DockerNetwork[]>([])
const stableTags = ref<Record<string, string | null>>({})

// Form⇄YAML escape hatch (P6 acceptance patch #2): defaults to form; yamlText is fetched once via toYaml() only when
// switching to the yaml tab (carrying over form edits); switching back to form goes through replaceFromYaml — on failure stay on the yaml tab and show the red banner.
const tab = ref<'form' | 'yaml'>('form')
const yamlText = ref('')
function selectTab(next: 'form' | 'yaml') {
  if (next === tab.value) return
  if (next === 'yaml') { yamlText.value = s.toYaml(); tab.value = 'yaml' }
  else if (s.replaceFromYaml(yamlText.value)) tab.value = 'form'
}

onMounted(() => {
  void s.load().then(() => {
    const m = s.model.value
    if (!m) return
    // Look up the stable tag per service; non-store apps (e.g. manual imports) return null and the tag dropdown auto-hides
    void Promise.all(m.services.map((svc) =>
      service.appstore.stableTag(id.value, svc.name).then((tag) => [svc.name, tag] as const).catch(() => [svc.name, null] as const),
    )).then((entries) => { stableTags.value = Object.fromEntries(entries) })
  })
  if (!installed.apps.length) installed.refresh().catch(() => {})  // deep-link entry: fetch once (for title/icon)
  service.container.getNetworks().then((n) => { networks.value = n }).catch(() => { networks.value = [] })
})

// Port conflicts show a dialog first: the save button sits at the bottom of a long form, so the top red banner
// is out of view and users miss it (on-device acceptance feedback).
// On confirm, close the dialog, keep the top banner + red port rows, and scroll back to the banner.
const conflictDlg = ref(false)
const bannerEl = ref<HTMLElement | null>(null)

async function onSave() {
  const ok = await s.save()
  if (ok) {
    toast.show(t('appsSettingsApplying'), 5000)
    router.push({ name: 'apps' })
  } else if (s.conflicts.value.length) {
    conflictDlg.value = true
  } else {
    toast.show(s.saveError.value || t('appsSettingsSaveFailed'), 5000)
  }
}
function onConflictAck() {
  conflictDlg.value = false
  // scrollIntoView is not implemented in jsdom; guard with optional chaining
  void nextTick(() => bannerEl.value?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }))
}

// Save inside the YAML tab: dry_run→PUT with the raw text, bypassing the form dialog; conflicts/other errors
// all go to the in-tab red banner (the brief explicitly skips the form's per-row highlighting + dialog — a banner is enough).
async function onSaveYaml() {
  const ok = await s.saveYaml(yamlText.value)
  if (ok) {
    toast.show(t('appsSettingsApplying'), 5000)
    router.push({ name: 'apps' })
  }
}
function back() { router.push({ name: 'apps' }) }
</script>

<template>
  <AreaShell :title="t('appsTitle')">
    <!-- yaml-mode: under the YAML tab the layout switches to fixed height (min-height→height); otherwise the
         denominator of the editor's height:100% is content-driven (the editor grows with content and never overflows internally), leaving the scrollbar on the whole page -->

    <div class="apps-layout" :class="{ 'yaml-mode': tab === 'yaml' }">
      <AppsSidebar />
      <main class="apps-main">
        <button class="bar-btn detail-back" type="button" @click="back">‹ {{ t('appsSettingsBack') }}</button>
        <header class="set-head">
          <img v-if="app?.icon" :src="app.icon" alt="" class="set-icon" />
          <h2 class="set-title">{{ app?.title ?? id }} · {{ t('appsSettings') }}</h2>
        </header>

        <p v-if="s.loading.value" class="apps-empty">{{ t('appsSettingsLoading') }}</p>
        <div v-else-if="s.loadError.value" class="apps-empty">
          {{ t('appsSettingsLoadFailed') }}
          <button class="bar-btn" type="button" @click="s.load()">{{ t('appsStoreRetry') }}</button>
        </div>

        <template v-else-if="s.model.value">
          <nav class="settings-tabs" role="tablist">
            <button
              type="button" role="tab" data-test="settings-tab-form"
              :aria-selected="tab === 'form'" :class="{ on: tab === 'form' }"
              @click="selectTab('form')"
            >{{ t('appsSettingsTabForm') }}</button>
            <button
              type="button" role="tab" data-test="settings-tab-yaml"
              :aria-selected="tab === 'yaml'" :class="{ on: tab === 'yaml' }"
              @click="selectTab('yaml')"
            >{{ t('appsSettingsTabYaml') }}</button>
          </nav>

          <template v-if="tab === 'form'">
            <div v-if="s.conflicts.value.length" ref="bannerEl" class="set-conflict" data-test="settings-conflict">
              {{ t('appsSettingsPortConflict', { ports: s.conflicts.value.join(', ') }) }}
            </div>
            <ComposeSettingsForm :model="s.model.value" :conflicts="s.conflicts.value" :networks="networks" :stable-tags="stableTags" />
            <div class="set-actions">
              <button class="bar-btn" type="button" :disabled="s.saving.value" @click="back">{{ t('appsSettingsCancel') }}</button>
              <button class="set-save" type="button" data-test="settings-save" :disabled="s.saving.value" @click="onSave">
                {{ s.saving.value ? t('appsWorking') : t('appsSettingsSave') }}
              </button>
            </div>
          </template>

          <div v-else class="settings-yaml-panel" data-test="settings-yaml-panel">
            <div v-if="s.parseError.value" class="set-conflict" data-test="yaml-parse-error">
              {{ t('appsSettingsYamlParseError') }}{{ s.parseError.value }}
            </div>
            <div v-else-if="s.conflicts.value.length" class="set-conflict" data-test="settings-conflict">
              {{ t('appsSettingsPortConflict', { ports: s.conflicts.value.join(', ') }) }}
            </div>
            <div v-else-if="s.saveError.value" class="set-conflict" data-test="yaml-save-error">{{ s.saveError.value }}</div>
            <YamlEditor v-model="yamlText" class="settings-yaml-editor" />
            <div class="set-actions">
              <button class="bar-btn" type="button" :disabled="s.saving.value" @click="back">{{ t('appsSettingsCancel') }}</button>
              <button class="set-save" type="button" data-test="settings-yaml-save" :disabled="s.saving.value" @click="onSaveYaml">
                {{ s.saving.value ? t('appsWorking') : t('appsSettingsYamlSave') }}
              </button>
            </div>
          </div>
        </template>
      </main>
    </div>

    <DialogRoot :open="conflictDlg" @update:open="(v) => { if (!v) onConflictAck() }">
      <DialogPortal>
        <DialogOverlay class="cfl-overlay" />
        <DialogContent class="cfl-content" data-test="settings-conflict-dlg">
          <DialogTitle class="cfl-title">{{ t('appsSettingsPortConflictTitle') }}</DialogTitle>
          <p class="cfl-body">{{ t('appsSettingsPortConflict', { ports: s.conflicts.value.join(', ') }) }}</p>
          <div class="cfl-footer">
            <button class="cfl-btn primary" type="button" data-test="settings-conflict-ok" @click="onConflictAck">
              {{ t('appsSettingsConflictOk') }}
            </button>
          </div>
        </DialogContent>
      </DialogPortal>
    </DialogRoot>
  </AreaShell>
</template>

<style scoped>
.apps-layout { display: flex; gap: 16px; align-items: flex-start; min-height: 100%; }
.apps-main { flex: 1 1 auto; min-width: 0; align-self: stretch; display: flex; flex-direction: column; }
/* YAML tab: fixed-height layout, the editor fills remaining space and scrolls internally (the form tab keeps page-level document scrolling, unaffected) */
.apps-layout.yaml-mode { height: 100%; }
.apps-layout.yaml-mode .apps-main { min-height: 0; }
.detail-back { font-size: 13px; margin-bottom: 14px; }
.apps-empty { color: var(--fg-muted); font-size: 14px; padding: 24px 8px; }
.set-head { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
.set-icon { width: 44px; height: 44px; border-radius: 11px; object-fit: contain; }
.set-title { font-size: 18px; font-weight: 600; margin: 0; color: var(--fg); }
.settings-tabs { display: flex; gap: 6px; margin-bottom: 14px; }
.settings-tabs button {
  padding: 5px 16px; border-radius: 9px; border: 1px solid var(--card-border);
  background: transparent; color: var(--fg-muted); cursor: pointer; font-size: 13px;
}
.settings-tabs button.on { background: var(--chip-bg-hi); color: var(--fg); }
.settings-yaml-panel { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; gap: 12px; }
.settings-yaml-editor { flex: 1 1 auto; min-height: 320px; }
.set-conflict {
  /* Every other "danger / conflict" surface in the repo pairs a translucent
     --drop-bad fill with --remove-fg text (GridGhost.vue .bad, CustomAppsPage.vue
     .set-conflict, the conflict badges on FileTile.vue / FileRow.vue). The brief's
     original background: var(--remove-bg) collides with the color on the line
     below -- close hue and lightness, almost no contrast under the dark theme --
     so this uses --drop-bad instead. Still a token, not a new literal colour.
     (The earlier version of this comment cited UploadPanel.vue, which has never
     used --drop-bad.) */
  margin-bottom: 14px; padding: 10px 14px; font-size: 13px; border-radius: var(--radius);
  color: var(--remove-fg); background: var(--drop-bad); border: 1px solid var(--remove-fg);
}
.set-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 18px; }
/* YAML tab: keep only the panel gap (12px) between the button bar and the editor; the extra margin goes to editor height */
.settings-yaml-panel .set-actions { margin-top: 0; }
.set-save { font-size: 13.5px; padding: 8px 24px; cursor: pointer; color: var(--on-accent); background: var(--accent); border: none; border-radius: 10px; }
.set-save:hover { filter: brightness(1.08); }
.set-save:disabled { opacity: 0.55; cursor: default; filter: none; }
@media (max-width: 768px) { .apps-layout { gap: 0; } }

/* Port-conflict confirm dialog (same as PreInstallTips pit-*; scoped styles still apply through Portal — data-v follows the template vnodes) */
.cfl-overlay { position: fixed; inset: 0; background: var(--overlay-bg); backdrop-filter: var(--overlay-blur); z-index: 1000; }
.cfl-content {
  position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 1001;
  min-width: 320px; max-width: min(480px, 92vw); padding: 20px; border-radius: 18px;
  background: var(--popup-bg); border: 1px solid var(--card-border); backdrop-filter: blur(20px);
  color: var(--fg); box-shadow: var(--card-shadow-hi);
}
.cfl-title { font-size: 16px; font-weight: 600; margin: 0 0 10px; color: var(--remove-fg); }
.cfl-body { font-size: 13.5px; line-height: 1.7; margin: 0; color: var(--fg); overflow-wrap: anywhere; }
.cfl-footer { display: flex; justify-content: flex-end; margin-top: 18px; }
.cfl-btn { padding: 7px 20px; border-radius: 999px; border: 1px solid var(--chip-border); background: var(--chip-bg); color: var(--fg); cursor: pointer; font-size: 13px; }
.cfl-btn.primary { background: var(--accent); color: var(--on-accent); border-color: var(--accent); }
</style>
