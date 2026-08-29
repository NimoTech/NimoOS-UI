// SP8-P2a Task 5 — 1:1 ported from Vue2
// `src/views/AI/Settings/store/settingsStore.js` (376 lines), migrated as a whole
// Pinia setup store (user decided on 2026-07-28; splitting would make
// top-bar status lights, nav badges, etc. require cross-section store references,
// which is not worth the cost).
//
// 【Data format】In Vue2, `ai.xxx()` returns raw axios responses, so `resp.data`
// is written everywhere. The shared package `service.ai.*` already unwraps that
// layer internally and returns the body directly. Thus Vue2's `resp.data || []`
// becomes `body || []` here, **without unpacking an extra .data layer**.
// This matches the format established in agentStore.ts:110-130 header comment.
//
// 【Mechanical replacement of Vue2 reactivity APIs】(equivalent semantics, not
// behavior changes)
//   Vue.observable({...}) → a set of refs
//   Vue.set(o, k, v)      → o[k] = v
//   Vue.delete(o, k)      → delete o[k]
//   state.x               → x.value
//   actions.foo() internal calls → call local functions directly
//
// 【Behavior difference from Vue2: resetTransientUi()】See the comment above
// that function. The root cause is that Vue2's `createSettingsStore()` creates
// a new instance on every mount and discards it on unmount, whereas Pinia is
// a global singleton.
//
// 【Theme】Not in this store — see `./aiTheme` (shared between Agent and Settings pages).
//
// 【i18n】Vue2's `saveProvider()` (settingsStore.js:211) uses
// `i18n.t('Name and Base URL are required')` to get the production translation.
// This repo's vue-i18n 9 uses composition mode, so the equivalent is
// `i18n.global.t(...)` (matching the existing pattern in agentStore.ts:6,893),
// with key name `aiCfgProviderNameUrlRequired`.
// 【Task 5 fix, review-Important】The implementer initially judged that i18n
// could be deferred to Task 10 (reasoning: the `git add` list in brief Step 6
// doesn't list i18n files), so they hardcoded an English Error message — the
// review pointed out this judgment was wrong: `ProvidersSection.vue:175-182`'s
// catch is `e.message || t('Save failed')`, **e.message takes priority**, so
// hardcoded English will pop up verbatim to Chinese users — this is a production
// defect exposed immediately, not a deferrable debt. The coordinator ruled:
// the gap in the Step 6 file list must yield to the global hard constraint
// "user-visible copy must use i18n"; corrected immediately; already added
// the `aiCfgProviderNameUrlRequired` key to `src/i18n/zh_cn.ts` / `en_us.ts`.

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { service } from '@nimotech/nimoos-service'
import { i18n } from '../../i18n'
import type { SectionId } from '../components/settings/sections'

// ── Types: server return bodies are all `unknown` in the shared package, narrowed
// here based on Vue2's actual usage ──

/** settingsStore.js:71-73 — `installedModels` entry; fields inferred from ModelsSection.vue:71-73 usage. */
export interface ModelEntry {
  name: string
  size_bytes?: number
  [key: string]: unknown
}

/** settingsStore.js:84 — `hfResults` entry; fields inferred from ModelsSection.vue:129-134 usage. */
export interface HfRepo {
  id: string
  downloads?: number
  [key: string]: unknown
}

/**
 * settingsStore.js:114-121 — a single HF import job. **`_timer` must stay in this object**
 * (must not be moved to a module-level Map): Vue2's `Settings.vue:160` mount-recovery
 * loop uses `!job._timer` to determine whether to restart the timer; moving it would
 * break that guard (explicitly called out in brief).
 */
export interface ImportJob {
  repo: string
  filename: string
  status: string
  completed: number
  total: number
  error: string
  speed: number
  etaSecs: number | null
  _prevCompleted: number
  _prevTime: number
  _timer: ReturnType<typeof setInterval> | null
}

/** settingsStore.js:172 — `providers` entry; fields inferred from ProvidersSection.vue:30-33 usage. */
export interface Provider {
  id: string | number
  name: string
  base_url: string
  protocol?: string
  enabled?: boolean
  default_model?: string
  [key: string]: unknown
}

export interface ProviderFormData {
  name: string
  base_url: string
  api_key: string
  default_model: string
  protocol: string
}

/** settingsStore.js:22-25 — edit/create form dialog state. */
export interface ProviderForm {
  visible: boolean
  editing: Provider | null
  saving: boolean
  data: ProviderFormData
}

/** Shape of applyProviderPreset input parameters; PRESETS constant itself kept in the consuming component (ProvidersSection, Task 10). */
export interface ProviderPreset {
  name: string
  base_url: string
  default_model: string
  protocol: string
}

/** settingsStore.js:27 — model directory entry per provider; fields inferred from ProvidersSection.vue:63-67 usage. */
export interface ProviderModel {
  name: string
  source: string
  favorite: boolean
  supports_thinking?: boolean
}

export interface ProviderModelsEntry {
  loading: boolean
  models: ProviderModel[]
}

/** settingsStore.js:31 — privacy policy; fields inferred from PrivacySection.vue:22-45 usage. */
export interface Policy {
  allow_remote: boolean
  default_backend: string
  escalation_prompt: boolean
}

/** settingsStore.js:34 — blacklist entry. */
export interface BlacklistEntry {
  id: string | number
  pattern: string
  created_at: string
}

/**
 * settingsStore.js:38 — ready state of three background services. **Initial value is
 * `null` (unknown), not `false`** — Settings.vue:12-14's `pillState()` uses
 * three-state logic to distinguish "not checked yet" (gray) from "checked and
 * indeed off" (red). After `loadServicesStatus()` succeeds, always falls to boolean
 * value; only the initial unchecked moment is null.
 */
export interface ServicesStatus {
  ollama: boolean | null
  openvino: boolean | null
  agent: boolean | null
}

export interface SearchStatus {
  running: boolean
}

export interface ParserStatus {
  running: boolean
  paused: boolean
  pending: number
  concurrency: number
}

/** settingsStore.js:126 — polling response body; fields inferred from `data.completed/total/status/error` usage in that function body. */
interface ImportStatusBody {
  completed: number
  total: number
  status: string
  error?: string
}

/** settingsStore.js:337-345 — services status response body; fields inferred from usage in that function body. */
interface ServicesStatusBody {
  ollama?: { running?: boolean }
  openvino?: { running?: boolean }
  agent?: { running?: boolean }
  search?: SearchStatus
  parser?: ParserStatus
}

/** settingsStore.js:147 — narrowing wrapper for `e.response.status === 404` check (axios error shape). */
function isNotFound(e: unknown): boolean {
  const status = (e as { response?: { status?: number } } | null | undefined)?.response?.status
  return status === 404
}

export const useSettingsStore = defineStore('ai-settings', () => {
  // ── UI (settingsStore.js:8,45) ──
  const activeSection = ref<SectionId>('models')

  function setActiveSection(section: SectionId) {
    activeSection.value = section
  }

  // ── Models (settingsStore.js:11-18) ──
  const installedModels = ref<ModelEntry[]>([])
  const modelsLoading = ref(false)
  const pullModelInput = ref('')
  /** settingsStore.js:14 — `{ 'name:tag': true }`. */
  const pullingModels = ref<Record<string, true>>({})
  const hfQuery = ref('')
  const hfResults = ref<HfRepo[]>([])
  const hfSearchLoading = ref(false)
  const hfSelectedRepo = ref<string | null>(null)
  const hfFiles = ref<string[]>([])
  const hfFilesLoading = ref(false)
  const hfImportJobs = ref<Record<string, ImportJob>>({})

  /** settingsStore.js:48-56 */
  async function loadModels() {
    modelsLoading.value = true
    try {
      const body = await service.ai.listModels()
      installedModels.value = (body as ModelEntry[]) || []
    } finally {
      modelsLoading.value = false
    }
  }

  /**
   * settingsStore.js:58-68 — Observation item (ported as-is, unchanged, explicitly
   * registered in brief): `pullingModels[name]` is deleted immediately in `finally`,
   * so the "Pulling: xxx (running in background — please refresh manually to see
   * progress)" hint displayed by the caller is actually **only true during that one
   * moment when the HTTP request is in flight**, which doesn't match the "running
   * in background" semantics the copy claims. Unknown whether the backend `POST /pull`
   * is synchronously blocking (if it blocks until download completes, this hint
   * would actually be accurate); awaiting real-device observation; not changing this
   * to resident state without authority.
   */
  async function pullModel() {
    const name = pullModelInput.value.trim()
    if (!name) return
    pullingModels.value[name] = true
    try {
      await service.ai.pullModel(name)
      pullModelInput.value = ''
    } finally {
      delete pullingModels.value[name]
    }
  }

  /** settingsStore.js:70-73 */
  async function deleteModel(name: string) {
    await service.ai.deleteModel(name)
    await loadModels()
  }

  /** settingsStore.js:75-88 */
  async function searchHF() {
    const q = hfQuery.value.trim()
    if (!q) return
    hfSearchLoading.value = true
    hfResults.value = []
    hfSelectedRepo.value = null
    hfFiles.value = []
    try {
      const body = await service.ai.searchHFModels(q)
      hfResults.value = (body as HfRepo[]) || []
    } finally {
      hfSearchLoading.value = false
    }
  }

  /** settingsStore.js:90-93 */
  function selectHFRepo(repoId: string) {
    hfSelectedRepo.value = repoId
    hfFiles.value = []
  }

  /** settingsStore.js:95-105 */
  async function loadHFFiles() {
    if (!hfSelectedRepo.value) return
    hfFilesLoading.value = true
    hfFiles.value = []
    try {
      const body = await service.ai.listHFFiles(hfSelectedRepo.value)
      hfFiles.value = (body as string[]) || []
    } finally {
      hfFilesLoading.value = false
    }
  }

  /** settingsStore.js:107-111 */
  async function importHF(file: string) {
    if (!hfSelectedRepo.value) return
    await service.ai.importHFModel(hfSelectedRepo.value, file)
    startImportJob(hfSelectedRepo.value, file)
  }

  /**
   * settingsStore.js:113-153 — create entry + start 2s polling timer.
   *
   * D3(brief) — Vue2's `Settings.vue:159-163` has code that traverses
   * `state.hfImportJobs` on mount to restore unfinished download polling,
   * but Vue2 creates a new state with `createSettingsStore()` on every mount,
   * so `hfImportJobs` is always `{}`, and that recovery loop **never executes
   * once** — progress bar disappears when leaving Settings page, timer leaks
   * with closure. Under Pinia singleton, both `hfImportJobs` and `_timer`
   * persist; that recovery loop (Task 8 landing) now has meaning for the
   * first time: returning to the page shows the progress bar continuing.
   * This is "behavior improved after porting", not a bug fix, but by discipline
   * still must be reported. **The Vue2 original `&& !job._timer` guard must be
   * preserved word-for-word** — it is the latch preventing duplicate timer
   * starts, so `_timer` must remain in the job object (see ImportJob type
   * comment), must not be optimized into a module-level Map.
   */
  function startImportJob(repo: string, filename: string) {
    hfImportJobs.value[filename] = {
      repo,
      filename,
      status: 'downloading',
      completed: 0,
      total: 0,
      error: '',
      speed: 0,
      etaSecs: null,
      _prevCompleted: 0,
      _prevTime: Date.now(),
      _timer: null,
    }
    const job = hfImportJobs.value[filename]
    const timer = setInterval(async () => {
      try {
        const body = await service.ai.getImportStatus(filename)
        const data = body as ImportStatusBody
        const now = Date.now()
        const dt = (now - job._prevTime) / 1000
        const dc = data.completed - job._prevCompleted
        if (dt > 0) job.speed = dc / dt / 1024 / 1024
        job.etaSecs =
          job.speed > 0.01 ? (data.total - data.completed) / job.speed / 1024 / 1024 : null
        job._prevCompleted = data.completed
        job._prevTime = now
        job.status = data.status
        job.completed = data.completed
        job.total = data.total
        job.error = data.error || ''

        if (data.status === 'success') {
          clearInterval(timer)
          await loadModels()
          setTimeout(() => dismissImportJob(filename), 3000)
        } else if (data.status === 'error') {
          clearInterval(timer)
        }
      } catch (e) {
        if (isNotFound(e)) {
          clearInterval(timer)
          dismissImportJob(filename)
        }
      }
    }, 2000)
    job._timer = timer
  }

  /** settingsStore.js:155-159 */
  function dismissImportJob(filename: string) {
    const job = hfImportJobs.value[filename]
    if (job && job._timer) clearInterval(job._timer)
    delete hfImportJobs.value[filename]
  }

  /** settingsStore.js:161-166 — cancelImport failures are intentionally swallowed (fire and forget). */
  async function cancelImportJob(filename: string) {
    const job = hfImportJobs.value[filename]
    if (job && job._timer) clearInterval(job._timer)
    delete hfImportJobs.value[filename]
    try {
      await service.ai.cancelImport(filename)
    } catch {
      /* fire and forget */
    }
  }

  // ── Providers (settingsStore.js:21-28) ──
  const providers = ref<Provider[]>([])
  const providersLoading = ref(false)
  const providerForm = ref<ProviderForm>({
    visible: false,
    editing: null,
    saving: false,
    data: { name: '', base_url: '', api_key: '', default_model: '', protocol: 'openai' },
  })
  const providerModels = ref<Record<string, ProviderModelsEntry>>({})

  /** settingsStore.js:168-176 */
  async function loadProviders() {
    providersLoading.value = true
    try {
      const body = await service.ai.listProviders()
      providers.value = (body as Provider[]) || []
    } finally {
      providersLoading.value = false
    }
  }

  /** settingsStore.js:178-194 */
  function showProviderForm(provider?: Provider | null) {
    providerForm.value.visible = true
    providerForm.value.editing = provider || null
    if (provider) {
      providerForm.value.data = {
        name: provider.name || '',
        base_url: provider.base_url || '',
        api_key: '', // settingsStore.js:185 — never pre-fill api_key on edit
        default_model: (provider.default_model as string) || '',
        protocol: (provider.protocol as string) || 'openai',
      }
    } else {
      providerForm.value.data = {
        name: '',
        base_url: '',
        api_key: '',
        default_model: '',
        protocol: 'openai',
      }
    }
  }

  /** settingsStore.js:196-199 */
  function hideProviderForm() {
    providerForm.value.visible = false
    providerForm.value.editing = null
  }

  /** settingsStore.js:201-206 */
  function applyProviderPreset(preset: ProviderPreset) {
    providerForm.value.data.name = preset.name
    providerForm.value.data.base_url = preset.base_url
    providerForm.value.data.default_model = preset.default_model
    providerForm.value.data.protocol = preset.protocol
  }

  /**
   * settingsStore.js:208-233 — validation error copy uses i18n, see the 【i18n】
   * note in the file header: `ProvidersSection.vue:175-182`'s catch prioritizes
   * showing `e.message`, hardcoded English will pop up verbatim to Chinese users,
   * so using `i18n.global.t('aiCfgProviderNameUrlRequired')`.
   */
  async function saveProvider() {
    const data = providerForm.value.data
    if (!data.name.trim() || !data.base_url.trim()) {
      throw new Error(i18n.global.t('aiCfgProviderNameUrlRequired'))
    }
    providerForm.value.saving = true
    try {
      if (providerForm.value.editing) {
        const id = providerForm.value.editing.id
        const payload: Record<string, unknown> = {
          name: data.name,
          base_url: data.base_url,
          default_model: data.default_model,
          protocol: data.protocol,
        }
        if (data.api_key) payload.api_key = data.api_key
        await service.ai.updateProvider(id, payload)
      } else {
        const payload: Record<string, unknown> = { ...data }
        await service.ai.createProvider(payload)
      }
      hideProviderForm()
      await loadProviders()
    } finally {
      providerForm.value.saving = false
    }
  }

  /** settingsStore.js:235-248 — on failure, rollback to pre-call snapshot and re-throw. */
  async function toggleProvider(id: string | number, enabled: boolean) {
    const snapshot = providers.value.map((p) => ({ ...p }))
    try {
      await service.ai.updateProvider(id, { enabled })
      const idx = providers.value.findIndex((p) => p.id === id)
      if (idx !== -1) {
        providers.value.splice(idx, 1, { ...providers.value[idx], enabled })
      }
    } catch (e) {
      providers.value = snapshot
      throw e
    }
  }

  /** settingsStore.js:250-253 */
  async function deleteProvider(id: string | number) {
    await service.ai.deleteProvider(id)
    await loadProviders()
  }

  /** settingsStore.js:255-264 — on failure, keep the previous models, don't clear, and re-throw. */
  async function loadProviderModels(id: string | number) {
    providerModels.value[id] = {
      loading: true,
      models: providerModels.value[id]?.models || [],
    }
    try {
      const body = await service.ai.listProviderModels(id)
      providerModels.value[id] = { loading: false, models: (body as ProviderModel[]) || [] }
    } catch (e) {
      providerModels.value[id] = {
        loading: false,
        models: providerModels.value[id]?.models || [],
      }
      throw e
    }
  }

  /** settingsStore.js:266-275 — same as loadProviderModels, but with a different refresh endpoint. */
  async function refreshProviderModels(id: string | number) {
    providerModels.value[id] = {
      loading: true,
      models: providerModels.value[id]?.models || [],
    }
    try {
      const body = await service.ai.refreshProviderModels(id)
      providerModels.value[id] = { loading: false, models: (body as ProviderModel[]) || [] }
    } catch (e) {
      providerModels.value[id] = {
        loading: false,
        models: providerModels.value[id]?.models || [],
      }
      throw e
    }
  }

  /**
   * settingsStore.js:277-282 — persist a provider's favorites + manual model list.
   * `models` is the desired complete list `{ name, favorite }` (source is decided
   * authoritatively by the server).
   */
  async function saveProviderModels(id: string | number, models: { name: string; favorite: boolean }[]) {
    const body = await service.ai.updateProviderModels(id, models)
    providerModels.value[id] = { loading: false, models: (body as ProviderModel[]) || [] }
  }

  /** settingsStore.js:284-290 — submit only name/favorite fields, not source. */
  function toggleModelFavorite(id: string | number, name: string, favorite: boolean) {
    const entry = providerModels.value[id]
    if (!entry) return
    const next = entry.models.map((m) => (m.name === name ? { ...m, favorite } : m))
    const desired = next.map((m) => ({ name: m.name, favorite: m.favorite }))
    return saveProviderModels(id, desired)
  }

  /** settingsStore.js:292-298 */
  function addManualModel(id: string | number, name: string) {
    const entry = providerModels.value[id] || { loading: false, models: [] }
    if (!name || entry.models.some((m) => m.name === name)) return
    const desired = entry.models.map((m) => ({ name: m.name, favorite: m.favorite }))
    desired.push({ name, favorite: true })
    return saveProviderModels(id, desired)
  }

  /** settingsStore.js:300-307 — only delete same-name items where source==='manual'. */
  function removeManualModel(id: string | number, name: string) {
    const entry = providerModels.value[id]
    if (!entry) return
    const desired = entry.models
      .filter((m) => !(m.name === name && m.source === 'manual'))
      .map((m) => ({ name: m.name, favorite: m.favorite }))
    return saveProviderModels(id, desired)
  }

  // ── Privacy (settingsStore.js:31) ──
  const policy = ref<Policy | null>(null)
  const policyLoading = ref(false)
  const policySaving = ref(false)

  /** settingsStore.js:309-317 */
  async function loadPolicy() {
    policyLoading.value = true
    try {
      const body = await service.ai.getPolicy()
      policy.value = (body as Policy) || null
    } finally {
      policyLoading.value = false
    }
  }

  /** settingsStore.js:319-333 — optimistic update, rollback on failure and re-throw; if policy is null, fill defaults first. */
  async function updatePolicyField<K extends keyof Policy>(field: K, value: Policy[K]) {
    const old = policy.value ? { ...policy.value } : null
    if (!policy.value) {
      policy.value = { allow_remote: false, default_backend: 'local', escalation_prompt: false }
    }
    const next: Policy = { ...policy.value, [field]: value }
    policy.value = next
    policySaving.value = true
    try {
      // Policy deliberately omits index signature (see type definition comment),
      // to keep updatePolicyField<K>'s keyof narrowing; here convert to the
      // Record<string, unknown> parameter type the shared package requires as needed.
      await service.ai.updatePolicy(next as unknown as Record<string, unknown>)
    } catch (e) {
      policy.value = old
      throw e
    } finally {
      policySaving.value = false
    }
  }

  // ── Blacklist (settingsStore.js:34-35; consumed by P2b, only the store-side is
  // migrated this period) ──
  const blacklist = ref<BlacklistEntry[]>([])
  const blacklistLoading = ref(false)

  /** settingsStore.js:353-361 */
  async function loadBlacklist() {
    blacklistLoading.value = true
    try {
      const body = await service.ai.listBlacklist()
      blacklist.value = (body as BlacklistEntry[]) || []
    } finally {
      blacklistLoading.value = false
    }
  }

  /** settingsStore.js:362-368 — response body may be `{id,...}` or bare id itself, fall back to timestamp. */
  async function addBlacklist(pattern: string) {
    const body = await service.ai.addBlacklistPattern(pattern)
    const raw = body as { id?: string | number } | string | number | null | undefined
    const idInner = raw && typeof raw === 'object' ? (raw.id ?? raw) : raw
    const id = (idInner as string | number | undefined) || Date.now()
    blacklist.value.push({ id, pattern, created_at: new Date().toISOString() })
  }

  /** settingsStore.js:369-372 */
  async function removeBlacklist(id: string | number) {
    await service.ai.removeBlacklistPattern(id)
    blacklist.value = blacklist.value.filter((x) => x.id !== id)
  }

  // ── Services status (settingsStore.js:38-40) ──
  const servicesStatus = ref<ServicesStatus>({ ollama: null, openvino: null, agent: null })
  const searchStatus = ref<SearchStatus>({ running: false })
  const parserStatus = ref<ParserStatus>({
    running: false,
    paused: false,
    pending: 0,
    concurrency: 2,
  })

  /** settingsStore.js:335-351 — overall failure is swallowed, all three status groups fall back to default ("off") values. */
  async function loadServicesStatus() {
    try {
      const body = await service.ai.getServicesStatus()
      const data = (body || {}) as ServicesStatusBody
      servicesStatus.value = {
        ollama: data.ollama?.running ?? false,
        openvino: data.openvino?.running ?? false,
        agent: data.agent?.running ?? false,
      }
      searchStatus.value = data.search || { running: false }
      parserStatus.value = data.parser || {
        running: false,
        paused: false,
        pending: 0,
        concurrency: 2,
      }
    } catch (e) {
      servicesStatus.value = { ollama: false, openvino: false, agent: false }
      searchStatus.value = { running: false }
      parserStatus.value = { running: false, paused: false, pending: 0, concurrency: 2 }
    }
  }

  /**
   * SP8-P2a D2 — Vue2 doesn't have this action, but this repo must.
   *
   * Vue2's `Settings.vue:101` creates a new state with `createSettingsStore()`
   * on every mount and discards it on unmount, so every time entering Settings:
   * activeSection is always 'models', forms are always collapsed, HF search
   * results are always empty. Pinia is a global singleton and brings back the
   * transient UI state from the last time you left — that's an architectural
   * difference, not Vue2 behavior; must be explicitly reset to maintain 1:1 parity.
   *
   * Precise scope: **only reset transient UI**. Deliberately leave alone:
   *   - hfImportJobs / pullingModels: tasks truly running in background; clearing
   *     them clears the progress bar
   *   - installedModels / providers / policy / blacklist / *Status: server-side
   *     data caches; clearing them makes the page blank first then re-fill,
   *     visually worse than Vue2
   */
  function resetTransientUi() {
    activeSection.value = 'models'
    providerForm.value = {
      visible: false,
      editing: null,
      saving: false,
      data: { name: '', base_url: '', api_key: '', default_model: '', protocol: 'openai' },
    }
    hfQuery.value = ''
    hfResults.value = []
    hfSelectedRepo.value = null
    hfFiles.value = []
  }

  return {
    // UI
    activeSection,
    setActiveSection,
    resetTransientUi,
    // Models
    installedModels,
    modelsLoading,
    pullModelInput,
    pullingModels,
    hfQuery,
    hfResults,
    hfSearchLoading,
    hfSelectedRepo,
    hfFiles,
    hfFilesLoading,
    hfImportJobs,
    loadModels,
    pullModel,
    deleteModel,
    searchHF,
    selectHFRepo,
    loadHFFiles,
    importHF,
    startImportJob,
    dismissImportJob,
    cancelImportJob,
    // Providers
    providers,
    providersLoading,
    providerForm,
    providerModels,
    loadProviders,
    showProviderForm,
    hideProviderForm,
    applyProviderPreset,
    saveProvider,
    toggleProvider,
    deleteProvider,
    loadProviderModels,
    refreshProviderModels,
    saveProviderModels,
    toggleModelFavorite,
    addManualModel,
    removeManualModel,
    // Policy
    policy,
    policyLoading,
    policySaving,
    loadPolicy,
    updatePolicyField,
    // Blacklist
    blacklist,
    blacklistLoading,
    loadBlacklist,
    addBlacklist,
    removeBlacklist,
    // Services status
    servicesStatus,
    searchStatus,
    parserStatus,
    loadServicesStatus,
  }
})
