<!--
  SP8-P2a Task 9 — 1:1 port from Vue2
  `src/views/AI/Settings/sections/ModelsSection.vue` (222 lines). Three cards:

    1. Installed models: card header (title + count + refresh) · download progress banners (one per
       store.hfImportJobs entry, four states: downloading / creating model /
       success / error) · loading / empty / table (name / size / delete)
    2. Pull from Ollama: input + pull button + in-progress hint
    3. Import GGUF from HuggingFace: search box + repo result list + file list for selected repo

  【Buefy → New-UI replacement】
  - $buefy.dialog.confirm (delete model) → shared AlertDialog, destructive.
    reka-ui AlertDialogAction emits update:open(false) then confirm on click —
    deleteDlg packs open and target name in same ref; v-model:open only changes .open,
    confirm handler still reads correct name (same pattern as AgentSidebar.vue:111-120,
    and lesson from InstalledAppsPage.vue:25-70 SP5-P1 noted in its header).
  - $buefy.toast.open({type:'is-success'}) → toast.show(msg) (info tier).
  - type:'is-danger' → toast.show(msg, 1500, 'danger').

  【Structure refactoring, not behavior change】 formatSize/etaLabel were Vue2 component methods,
  extracted to pure functions formatModelSize/formatEtaSeconds (../../../util/formatModelSize.ts).
  This allows precise unit testing of GB/MB boundary, sec/min/hr boundary, 0/null/undefined —
  extraction just enables boundary tests; behavior unchanged verbatim.

  【i18n structure differs】 etaLabel was Vue2 component's `this.$t('{n} sec' | '{n} min' |
  '{n} hr', {n})`; pure function returns just { unit, n } struct (no localized text,
  same as P1c2 formatDuration). This component picks aiCfgEtaSec/Min/Hr keys per unit then calls t().

  【Observation item, copied unchanged, noted in settingsStore.ts:218-224】
  pullingModels[name] deleted immediately in store finally block; "pulling" hint actually only
  shows for an instant while HTTP request is in flight, not matching "running in background"
  semantics. Unknown if backend POST /pull is sync-blocking; not changing here.

  【AlertDialog needs title, Buefy original call had none】 Shared AlertDialog component requires
  title/confirmText/cancelText three mandatory props; Vue2's `$buefy.dialog.confirm({message, type})`
  had no separate title concept (Buefy default look). Not fixing a Vue2 bug, but required
  parameter when adopting stricter shared primitive — following precedent from AgentSidebar.vue:192-200,
  title and confirmText both reuse "Delete" action name (aiCfgDelete), not creating generic "Confirm" text.
-->
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '../../../stores/settingsStore'
import { useToast } from '../../../../stores/toast'
import AgentIcon from '../../icons/AgentIcon.vue'
import AlertDialog from '../../../../components/ui/AlertDialog.vue'
import { formatModelSize, formatEtaSeconds } from '../../../util/formatModelSize'

const store = useSettingsStore()
const toast = useToast()
const { t } = useI18n()

const pullingNames = computed(() => Object.keys(store.pullingModels))
const hasPulling = computed(() => pullingNames.value.length > 0)

function formatSize(bytes: number | null | undefined): string {
  return formatModelSize(bytes)
}

/** ModelsSection.vue:176-180 `etaLabel` — pure function splits into tiers + this component picks i18n key. */
function etaLabel(secs: number): string {
  const { unit, n } = formatEtaSeconds(secs)
  const key = unit === 'sec' ? 'aiCfgEtaSec' : unit === 'min' ? 'aiCfgEtaMin' : 'aiCfgEtaHr'
  return t(key, { n })
}

// ── Delete model confirmation (see header "Buefy → New-UI replacement" note) ──
const deleteDlg = ref<{ open: boolean; name: string | null }>({ open: false, name: null })

function requestDelete(name: string) {
  deleteDlg.value = { open: true, name }
}

async function onDeleteConfirm() {
  const name = deleteDlg.value.name
  if (name === null) return
  try {
    await store.deleteModel(name)
    toast.show(t('aiCfgDeletedName', { name }))
  } catch {
    toast.show(t('aiCfgDeleteFailed'), 1500, 'danger')
  }
}

// ── Pull from Ollama (ModelsSection.vue:195-204) ──
async function onPull() {
  const name = store.pullModelInput.trim()
  if (!name) return
  try {
    await store.pullModel()
    toast.show(t('aiCfgPullStartedFor', { name }))
  } catch {
    toast.show(t('aiCfgPullRequestFailed'), 1500, 'danger')
  }
}

// ── HuggingFace search / import (ModelsSection.vue:205-219) ──
async function onSearch() {
  try {
    await store.searchHF()
  } catch {
    toast.show(t('aiCfgSearchFailed'), 1500, 'danger')
  }
}

async function onImport(file: string) {
  try {
    await store.importHF(file)
    toast.show(t('aiCfgImportStartedFor', { file }))
  } catch {
    toast.show(t('aiCfgImportFailed'), 1500, 'danger')
  }
}
</script>

<template>
  <div class="set-inner">
    <div class="set-page-head">
      <h1 class="set-h1">{{ t('aiCfgLocalModels') }}</h1>
      <p class="set-desc">{{ t('aiCfgModelsDesc') }}</p>
    </div>

    <!-- Installed models -->
    <div class="sk-section">
      <div class="sk-section-body">
        <div class="set-cardhead">
          <span class="t">{{ t('aiCfgInstalledModels') }}</span>
          <span class="ct">{{ store.installedModels.length }}</span>
          <span class="sp"></span>
          <button class="set-minibtn" @click="store.loadModels()">
            <AgentIcon name="refresh" :size="13" /> {{ t('aiCfgRefresh') }}
          </button>
        </div>

        <!-- Download progress banners -->
        <div
          v-for="(job, filename) in store.hfImportJobs"
          :key="filename"
          class="dl-banner"
          :class="job.status"
        >
          <div class="dl-banner-header">
            <div class="dl-banner-title">
              <div class="dl-dot"></div>
              <span v-if="job.status === 'success'">{{ t('aiCfgImportComplete') }}</span>
              <span v-else-if="job.status === 'error'">{{ t('aiCfgImportFailed') }}</span>
              <span v-else-if="job.status === 'creating model'">{{ t('aiCfgRegisteringModel') }}</span>
              <span v-else>{{ t('aiCfgImporting') }}</span>
            </div>
            <button
              v-if="job.status !== 'success'"
              class="dl-cancel-btn"
              @click="job.status === 'error'
                ? store.dismissImportJob(filename)
                : store.cancelImportJob(filename)"
            >{{ job.status === 'error' ? t('aiCfgClose') : t('aiCfgCancel') }}</button>
          </div>
          <div class="dl-filename">{{ filename }}</div>
          <div class="dl-prog-track">
            <div
              class="dl-prog-fill"
              :style="{ width: job.total > 0 ? ((job.completed / job.total) * 100).toFixed(1) + '%' : '0%' }"
            ></div>
          </div>
          <div v-if="job.status !== 'error'" class="dl-stats">
            <span><b>{{ job.total > 0 ? ((job.completed / job.total) * 100).toFixed(0) + '%' : '—' }}</b></span>
            <span>{{ formatSize(job.completed) }} / {{ formatSize(job.total) }}</span>
            <span v-if="job.speed > 0">{{ job.speed.toFixed(1) }} MB/s</span>
            <span v-if="job.etaSecs">{{ t('aiCfgEtaApprox', { eta: etaLabel(job.etaSecs) }) }}</span>
          </div>
          <div v-else class="dl-stats" style="color: var(--danger);">{{ job.error }}</div>
          <div v-if="job.status === 'downloading' || job.status === 'creating model'" class="dl-warn">
            {{ t('aiCfgDownloadWarning') }}
          </div>
        </div>

        <div v-if="store.modelsLoading" class="set-note">{{ t('aiCfgLoadingEllipsis') }}</div>
        <div v-else-if="store.installedModels.length === 0" class="set-note">
          {{ t('aiCfgNoModelsYet') }}
        </div>
        <table v-else class="set-table">
          <thead>
            <tr><th>{{ t('aiCfgColName') }}</th><th class="num">{{ t('aiCfgColSize') }}</th><th class="act">{{ t('aiCfgColActions') }}</th></tr>
          </thead>
          <tbody>
            <tr v-for="m in store.installedModels" :key="m.name">
              <td><span class="mono">{{ m.name }}</span></td>
              <td class="num">{{ formatSize(m.size_bytes) }}</td>
              <td class="act">
                <button class="set-tbtn danger" @click="requestDelete(m.name)">
                  <AgentIcon name="trash" :size="13" /> {{ t('aiCfgDelete') }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Pull from Ollama -->
    <div class="sk-section">
      <div class="sk-section-head">
        <div class="sk-section-title">{{ t('aiCfgPullFromOllama') }}</div>
      </div>
      <div class="sk-section-body">
        <div class="set-addrow">
          <input type="text" class="set-input mono"
                 :placeholder="t('aiCfgModelNamePlaceholder')"
                 v-model="store.pullModelInput"
                 @keydown.enter="onPull" />
          <button class="set-addbtn" :disabled="!store.pullModelInput"
                  @click="onPull">
            <AgentIcon name="download" :size="13" /> {{ t('aiCfgPull') }}
          </button>
        </div>
        <div v-if="hasPulling" class="set-actions">
          <span class="hint">
            {{ t('aiCfgPullingHint', { names: pullingNames.join(', ') }) }}
          </span>
        </div>
      </div>
    </div>

    <!-- HuggingFace import -->
    <div class="sk-section">
      <div class="sk-section-head">
        <div class="sk-section-title">{{ t('aiCfgImportGgufTitle') }}</div>
      </div>
      <div class="sk-section-body">
        <div class="set-addrow">
          <input type="text" class="set-input"
                 :placeholder="t('aiCfgSearchModelsPlaceholder')"
                 v-model="store.hfQuery"
                 @keydown.enter="onSearch" />
          <button class="set-addbtn ghost" @click="onSearch"
                  :disabled="!store.hfQuery.trim() || store.hfSearchLoading">
            <AgentIcon name="search" :size="13" /> {{ t('aiCfgSearchBtn') }}
          </button>
        </div>

        <div v-if="store.hfSearchLoading" class="set-note">{{ t('aiCfgSearchingEllipsis') }}</div>

        <div v-if="store.hfResults.length > 0" class="hf-results">
          <button v-for="r in store.hfResults" :key="r.id" class="hf-repo"
                  :data-active="store.hfSelectedRepo === r.id"
                  @click="store.selectHFRepo(r.id)">
            <span>{{ r.id }}</span>
            <span class="hf-meta">↓ {{ r.downloads || 0 }}</span>
          </button>
        </div>

        <div v-if="store.hfSelectedRepo" class="hf-files-area">
          <div class="hf-files-header">
            <span>{{ t('aiCfgSelectedRepo', { repo: store.hfSelectedRepo }) }}</span>
            <button class="set-minibtn" @click="store.loadHFFiles()"
                    :disabled="store.hfFilesLoading">
              {{ t('aiCfgLoadFiles') }}
            </button>
          </div>
          <div v-for="f in store.hfFiles" :key="f" class="hf-file">
            <span>{{ f }}</span>
            <button class="set-tbtn" @click="onImport(f)">
              <AgentIcon name="download" :size="13" /> {{ t('aiCfgImportBtn') }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <AlertDialog
      v-model:open="deleteDlg.open"
      :title="t('aiCfgDelete')"
      :message="t('aiCfgConfirmDeleteModel', { name: deleteDlg.name || '' })"
      :confirm-text="t('aiCfgDelete')"
      :cancel-text="t('aiCfgCancel')"
      destructive
      @confirm="onDeleteConfirm"
    />
  </div>
</template>
