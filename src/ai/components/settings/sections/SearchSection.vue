<!--
  1:1 port from Vue2 src/views/AI/Settings/sections/SearchSection.vue (230 lines).

  【D2 declaration】 State remains in component local (ref), direct call to service.ai —
  consistent with Vue2 attribution (Vue2 data() is component local state),
  no store centralization (user decision 2026-07-28).

  【Dead field, not ported】 Vue2 :154 `_active` (cached "current effective value" of fileindex,
  comment says for restart-required check, but never read elsewhere) — dead code, not ported.
  Real restartRequired comes from `restart_required` field in backend response (:210-212).

  【Logic fix 1】 Vue2 saveParams/saveFileindex/rescan have no catch at three locations (:188-219);
  on failure only finally resets saving/rescanning; user sees "Saving..." flash then disappear,
  assumes it saved/rescanned, actually didn't. Here all three add catch + danger toast.

  【Logic fix 2】 Vue2 `rescan()` has `setTimeout(() => this.loadStatus(), 1500)` (:217)
  with no cleanup — timer fires after unmount, calling `loadStatus()` on unmounted component state.
  Here add `rescanTimer` ref + `onUnmounted` cleanup.

  【Logic fix 4】 Vue2 `savedAt` once set never clears (SearchSection.vue:199/212 — only set
  `Date.now()` on saveParams/saveFileindex success, never set back to 0); "Saved" label hangs
  permanently (even if value changes unsaved later). Here auto-clear after 2s (`markSaved()`
  and cleanup timer on unmount). Same Vue2 defect as ExecutionSection.vue header's "Logic fix 2",
  omitted from declaration there, now added here.

  【Logic fix 3】 Vue2 `copyCmd()` (:220-222) only writes `navigator.clipboard?.writeText(...)`.
  Device over plaintext HTTP local IP (http://192.168.x.x/) is not secure context,
  `navigator.clipboard` is `undefined`, optional chain short-circuits — click does nothing,
  no feedback. Inevitable failure on real device. Here use repo's existing `copyText`
  (with execCommand fallback), success/failure both show toast feedback.
-->
<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import { useToast } from '../../../../stores/toast'
import { apiErrorMessage } from '../../../util/apiError'
import { useCopyFeedback } from '../../../composables/useCopyFeedback'
import AgentIcon from '../../icons/AgentIcon.vue'
import SetSwitch from '../SetSwitch.vue'

type SourceKey = 'semantic' | 'filenames' | 'images'
interface Inotify { max_user_watches: number; recommended: number; raise_cmd: string }
interface FileindexStatus {
  status: string
  indexed_count: number
  watch_degraded: boolean
  inotify: Inotify | null
}

const { t } = useI18n()
const toast = useToast()
const { copiedKey, copy } = useCopyFeedback()

const sources = ref<SourceKey[]>(['semantic', 'filenames', 'images'])
const semanticTopK = ref(5)
const filenameTopK = ref(5)
const imageTopK = ref(5)
const maxTotal = ref(15)
const fiEnabled = ref(true)
const scanIntervalH = ref(6)
const roots = ref<string[]>(['/DATA'])
const restartRequired = ref(false)
const status = ref<FileindexStatus>({ status: 'disabled', indexed_count: 0, watch_degraded: false, inotify: null })
const saving = ref(false)
const rescanning = ref(false)
const savedAt = ref(0)
let savedTimer: ReturnType<typeof setTimeout> | null = null
let rescanTimer: ReturnType<typeof setTimeout> | null = null

const statusLabel = computed(() => {
  const map: Record<string, string> = {
    ready: t('aiCfgIndexReady'),
    scanning: t('aiCfgIndexBuilding'),
    disabled: t('aiCfgIndexDisabled'),
  }
  return map[status.value.status] || status.value.status // Vue2 :162 same fallback
})

onMounted(async () => {
  try {
    const d = (await service.ai.getSearchSettings()) as {
      settings?: Record<string, unknown>
      data?: { settings?: Record<string, unknown> }
    }
    const s = d.settings || d.data?.settings || {}
    sources.value = (s.default_sources as SourceKey[]) || sources.value
    semanticTopK.value = (s.semantic_top_k as number) ?? 5
    filenameTopK.value = (s.filename_top_k as number) ?? 5
    imageTopK.value = (s.image_top_k as number) ?? 5
    maxTotal.value = (s.max_total_results as number) ?? 15
    fiEnabled.value = !!s.fileindex_enabled
    scanIntervalH.value = (s.fileindex_scan_interval_h as number) ?? 6
    roots.value = ((s.fileindex_roots as string[]) && (s.fileindex_roots as string[]).slice()) || ['/DATA']
  } catch {
    /* Vue2 :178 likewise silent */
  }
  void loadStatus() // Vue2 :179 — outside try/catch; load status even if settings fetch fails
})

onUnmounted(() => {
  if (savedTimer) clearTimeout(savedTimer)
  if (rescanTimer) clearTimeout(rescanTimer) // Logic fix 2: see header comment
})

async function loadStatus() {
  try {
    const d = (await service.ai.getFileindexStatus()) as { data?: FileindexStatus } & FileindexStatus
    status.value = (d.data || d) as FileindexStatus
  } catch {
    /* Vue2 :186 likewise silent, keep defaults */
  }
}

function markSaved() {
  savedAt.value = 1
  if (savedTimer) clearTimeout(savedTimer)
  savedTimer = setTimeout(() => { savedAt.value = 0 }, 2000)
}

async function saveParams() {
  if (sources.value.length === 0) return
  saving.value = true
  try {
    await service.ai.putSearchSettings({
      default_sources: sources.value,
      semantic_top_k: semanticTopK.value,
      filename_top_k: filenameTopK.value,
      image_top_k: imageTopK.value,
      max_total_results: maxTotal.value,
    })
    markSaved()
  } catch (e) {
    toast.show(apiErrorMessage(e, t('aiCfgSaveFailed')), 3000, 'danger') // Logic fix 1
  } finally {
    saving.value = false
  }
}

async function saveFileindex() {
  saving.value = true
  try {
    const resp = (await service.ai.putSearchSettings({
      fileindex_enabled: fiEnabled.value,
      fileindex_roots: roots.value.filter((r) => r.trim()),
      fileindex_scan_interval_h: scanIntervalH.value,
    })) as { data?: { restart_required?: boolean }; restart_required?: boolean }
    const body = resp.data || resp
    restartRequired.value = !!body.restart_required
    markSaved()
  } catch (e) {
    toast.show(apiErrorMessage(e, t('aiCfgSaveFailed')), 3000, 'danger') // Logic fix 1
  } finally {
    saving.value = false
  }
}

async function rescan() {
  rescanning.value = true
  try {
    await service.ai.rescanFileindex()
    if (rescanTimer) clearTimeout(rescanTimer)
    rescanTimer = setTimeout(() => { void loadStatus() }, 1500)
  } catch (e) {
    toast.show(apiErrorMessage(e, t('aiCfgSaveFailed')), 3000, 'danger') // Logic fix 1
  } finally {
    rescanning.value = false
  }
}

async function copyCmd() {
  const cmd = status.value.inotify?.raise_cmd
  if (!cmd) return
  // Logic fix 3: see header comment.
  // Copy feedback (toast + checkmark state) unified via useCopyFeedback.
  await copy(cmd, 'raise-cmd')
}

function toggleSource(k: SourceKey) {
  const i = sources.value.indexOf(k)
  if (i < 0) sources.value.push(k)
  else sources.value.splice(i, 1)
}
</script>

<template>
  <div class="set-inner">
    <div class="set-page-head">
      <h1 class="set-h1">{{ t('aiCfgSearch') }}</h1>
      <p class="set-desc">{{ t('aiCfgSearchDesc') }}</p>
    </div>

    <div v-if="restartRequired" class="set-banner warn">
      {{ t('aiCfgSearchRestartRequired') }}
    </div>

    <!-- Retrieval params (hot-reload) -->
    <div class="sk-section">
      <div class="sk-section-head">
        <div class="sk-section-title">{{ t('aiCfgRetrievalParams') }}</div>
        <div class="sk-section-hint">{{ t('aiCfgLive') }}</div>
      </div>
      <div class="sk-section-body">
        <div class="set-banner">
          <span class="ico"><AgentIcon name="search" :size="12" /></span>
          <span>{{ t('aiCfgRetrievalBanner') }}</span>
        </div>
        <div class="set-rows">
          <div class="set-row top">
            <div class="lbl">{{ t('aiCfgDefaultSources') }}</div>
            <div class="val">
              <div class="set-chips">
                <button
                  class="set-chip" :data-on="sources.includes('semantic') ? 'true' : 'false'"
                  @click="toggleSource('semantic')"
                >
                  <span class="box"><AgentIcon name="check" :size="11" /></span>{{ t('aiCfgSourceSemantic') }}
                </button>
                <button
                  class="set-chip" :data-on="sources.includes('filenames') ? 'true' : 'false'"
                  @click="toggleSource('filenames')"
                >
                  <span class="box"><AgentIcon name="check" :size="11" /></span>{{ t('aiCfgSourceFilenames') }}
                </button>
                <button
                  class="set-chip" :data-on="sources.includes('images') ? 'true' : 'false'"
                  @click="toggleSource('images')"
                >
                  <span class="box"><AgentIcon name="check" :size="11" /></span>{{ t('aiCfgSourceImages') }}
                </button>
              </div>
            </div>
          </div>
          <div v-if="sources.length === 0" class="set-row">
            <div class="lbl" />
            <div class="val"><span class="warn">{{ t('aiCfgSelectAtLeastOneSource') }}</span></div>
          </div>
          <div class="set-row">
            <div class="lbl">{{ t('aiCfgSemanticTopK') }}</div>
            <div class="val"><input v-model.number="semanticTopK" class="set-input num" type="number" min="1" max="20"></div>
          </div>
          <div class="set-row">
            <div class="lbl">{{ t('aiCfgFilenameTopK') }}</div>
            <div class="val"><input v-model.number="filenameTopK" class="set-input num" type="number" min="1" max="20"></div>
          </div>
          <div class="set-row">
            <div class="lbl">{{ t('aiCfgImageTopK') }}</div>
            <div class="val"><input v-model.number="imageTopK" class="set-input num" type="number" min="1" max="20"></div>
          </div>
          <div class="set-row">
            <div class="lbl">{{ t('aiCfgTotalCap') }}</div>
            <div class="val"><input v-model.number="maxTotal" class="set-input num" type="number" min="1" max="60"></div>
          </div>
        </div>
        <div class="set-actions">
          <button class="sk-btn primary" :disabled="sources.length === 0 || saving" @click="saveParams">
            <AgentIcon name="check" :size="13" /> {{ t('aiCfgSave') }}
          </button>
          <span v-if="savedAt" class="hint">{{ t('aiCfgSaved') }}</span>
        </div>
      </div>
    </div>

    <!-- Filename index (roots hot-reload; enable/scan interval require restart) -->
    <div class="sk-section">
      <div class="sk-section-head">
        <div class="sk-section-title">{{ t('aiCfgFilenameIndex') }}</div>
      </div>
      <div class="sk-section-body">
        <div class="set-rows">
          <div class="set-row">
            <div class="lbl">{{ t('aiCfgEnableFilenameIndex') }}</div>
            <div class="val end">
              <SetSwitch :model-value="fiEnabled" @change="(v) => (fiEnabled = v)" />
            </div>
          </div>
          <div class="set-row">
            <div class="lbl">{{ t('aiCfgScanIntervalHours') }}</div>
            <div class="val"><input v-model.number="scanIntervalH" class="set-input num" type="number" min="0"></div>
          </div>
        </div>
        <div v-for="(r, i) in roots" :key="i" class="dir-row">
          <input v-model="roots[i]" class="set-input mono" placeholder="/DATA">
          <button class="dir-del" :title="t('aiCfgDelete')" @click="roots.splice(i, 1)">
            <AgentIcon name="trash" :size="14" />
          </button>
        </div>
        <button class="dir-add" @click="roots.push('')">
          <AgentIcon name="plus" :size="13" /> {{ t('aiCfgAddRoot') }}
        </button>
        <div class="set-actions">
          <button class="sk-btn primary" :disabled="saving" @click="saveFileindex">{{ t('aiCfgSave') }}</button>
          <button class="sk-btn ghost" :disabled="rescanning" @click="rescan">{{ t('aiCfgRescanNow') }}</button>
          <span class="hint">{{ t('aiCfgFileindexSaveHint') }}</span>
        </div>
      </div>
    </div>

    <!-- Diagnostics (read-only) -->
    <div class="sk-section">
      <div class="sk-section-head">
        <div class="sk-section-title">{{ t('aiCfgDiagnostics') }}</div>
      </div>
      <div class="sk-section-body">
        <div class="diag">
          <div class="diag-row">
            <span class="k">{{ t('aiCfgIndexStatus') }}</span>
            <span class="v"><span class="diag-dot" />{{ statusLabel }}</span>
          </div>
          <div class="diag-row">
            <span class="k">{{ t('aiCfgIndexedFiles') }}</span>
            <span class="v">{{ status.indexed_count }}</span>
          </div>
          <template v-if="status.inotify">
            <div class="diag-row">
              <span class="k">{{ t('aiCfgInotifyLimit') }}</span>
              <span class="v">
                {{ status.inotify.max_user_watches }}
                <span class="rec">{{ t('aiCfgInotifyRecommended', { n: status.inotify.recommended }) }}</span>
              </span>
            </div>
            <div v-if="status.watch_degraded || status.inotify.max_user_watches < status.inotify.recommended" class="diag-row">
              <span class="k">{{ t('aiCfgRaiseLimitHint') }}</span>
            </div>
            <div v-if="status.watch_degraded || status.inotify.max_user_watches < status.inotify.recommended" class="set-copy">
              <input class="set-input mono" readonly :value="status.inotify.raise_cmd">
              <button class="set-copybtn" :class="{ done: copiedKey === 'raise-cmd' }" @click="copyCmd"><AgentIcon :name="copiedKey === 'raise-cmd' ? 'check' : 'copy'" :size="13" /> {{ t('aiCopy') }}</button>
            </div>
          </template>
          <p v-if="status.watch_degraded" class="warn">
            {{ t('aiCfgWatchDegraded') }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
