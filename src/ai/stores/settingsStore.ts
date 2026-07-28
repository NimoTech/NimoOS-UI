// SP8-P2a Task 5 —— 1:1 移植自 Vue2
// `src/views/AI/Settings/store/settingsStore.js`(376 行),整体搬成一个
// Pinia setup store(用户 2026-07-28 决定;拆分会让顶栏状态灯、导航徽标这些
// 跨分区读数变成 store 互相引用,得不偿失)。
//
// 【取数口径】Vue2 里 `ai.xxx()` 返回 axios 原始响应,所以处处写 `resp.data`。
// 共享包 `service.ai.*` 已在包内解过那一层,直接吐 body。故 Vue2 的
// `resp.data || []` 这里写作 `body || []`,**不再多剥一层 .data**。
// 与 agentStore.ts:110-130 头注释确立的口径一致。
//
// 【Vue2 响应式 API 的机械替换】(等价物,非行为改动)
//   Vue.observable({...}) → 一组 ref
//   Vue.set(o, k, v)      → o[k] = v
//   Vue.delete(o, k)      → delete o[k]
//   state.x               → x.value
//   actions.foo() 内部互调 → 直接调本地函数
//
// 【与 Vue2 的行为差:resetTransientUi()】详见函数上方注释。根因是 Vue2 的
// `createSettingsStore()` 每次挂载新建、卸载丢弃,而 Pinia 是全局单例。
//
// 【主题】不在本 store —— 见 `./aiTheme`(Agent 页与设置页共享)。
//
// 【i18n 偏离说明】Vue2 `saveProvider()`(settingsStore.js:211)用
// `i18n.t('Name and Base URL are required')` 取生产译文。本任务的文件清单
// (brief Step 6)只包含本 store 的两个文件,不含 `src/i18n/*`——因此这里不
// 新增 i18n 键,直接用与 Vue2 英文源字面量一致的硬编码 Error message。
// 该文案的 i18n 化留给消费方(Task 10 ProvidersSection,catch 处按需转译)。

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { service } from '@nimotech/nimoos-service'
import type { SectionId } from '../components/settings/sections'

// ── 类型:服务端返回体在共享包里都是 `unknown`,这里按 Vue2 的实际用法窄化 ──

/** settingsStore.js:71-73 `installedModels` 表项;字段依 ModelsSection.vue:71-73 用法推得。 */
export interface ModelEntry {
  name: string
  size_bytes?: number
  [key: string]: unknown
}

/** settingsStore.js:84 `hfResults` 表项;字段依 ModelsSection.vue:129-134 用法推得。 */
export interface HfRepo {
  id: string
  downloads?: number
  [key: string]: unknown
}

/**
 * settingsStore.js:114-121 —— 单个 HF 导入任务。**`_timer` 必须留在这个对象里**
 * (不得挪成模块级 Map):Vue2 `Settings.vue:160` 的挂载恢复循环靠 `!job._timer`
 * 判断是否需要重新起定时器,把它挪走会破坏那道守卫(brief 明确点名)。
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

/** settingsStore.js:172 `providers` 表项;字段依 ProvidersSection.vue:30-33 用法推得。 */
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

/** settingsStore.js:22-25 编辑/新建表单弹层状态。 */
export interface ProviderForm {
  visible: boolean
  editing: Provider | null
  saving: boolean
  data: ProviderFormData
}

/** applyProviderPreset 的入参形状;PRESETS 常量本身留在消费方组件(ProvidersSection,Task 10)。 */
export interface ProviderPreset {
  name: string
  base_url: string
  default_model: string
  protocol: string
}

/** settingsStore.js:27 每 provider 的模型目录条目;字段依 ProvidersSection.vue:63-67 用法推得。 */
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

/** settingsStore.js:31 隐私策略;字段依 PrivacySection.vue:22-45 用法推得。 */
export interface Policy {
  allow_remote: boolean
  default_backend: string
  escalation_prompt: boolean
}

/** settingsStore.js:34 黑名单条目。 */
export interface BlacklistEntry {
  id: string | number
  pattern: string
  created_at: string
}

/**
 * settingsStore.js:38 三个后台服务的就绪态。**初值是 `null`(未知),不是
 * `false`**——Settings.vue:12-14 的 `pillState()` 用三态区分"还没查过"(灰)
 * 与"查过了、确实是关的"(红)。`loadServicesStatus()` 成功后恒落到布尔值,
 * 只有初始未加载过这一刻是 null。
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

/** settingsStore.js:126 轮询回包;字段依同函数体内 `data.completed/total/status/error` 用法推得。 */
interface ImportStatusBody {
  completed: number
  total: number
  status: string
  error?: string
}

/** settingsStore.js:337-345 服务状态回包;字段依同函数体内用法推得。 */
interface ServicesStatusBody {
  ollama?: { running?: boolean }
  openvino?: { running?: boolean }
  agent?: { running?: boolean }
  search?: SearchStatus
  parser?: ParserStatus
}

/** settingsStore.js:147 `e.response.status === 404` 判断的窄化封装(axios 错误形状)。 */
function isNotFound(e: unknown): boolean {
  const status = (e as { response?: { status?: number } } | null | undefined)?.response?.status
  return status === 404
}

export const useSettingsStore = defineStore('ai-settings', () => {
  // ── UI(settingsStore.js:8,45)──
  const activeSection = ref<SectionId>('models')

  function setActiveSection(section: SectionId) {
    activeSection.value = section
  }

  // ── Models(settingsStore.js:11-18)──
  const installedModels = ref<ModelEntry[]>([])
  const modelsLoading = ref(false)
  const pullModelInput = ref('')
  /** settingsStore.js:14 `{ 'name:tag': true }`。 */
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
   * settingsStore.js:58-68 —— 观察项(照搬,不改,brief 点名登记):
   * `pullingModels[name]` 在 `finally` 里立即删除,所以调用方展示的
   * "Pulling: xxx(后台运行中——请手动刷新查看进度)"提示实际上**只在这次
   * HTTP 请求在途的那一瞬间**为真,与文案宣称的"后台运行中"语义不符。
   * 后端 `POST /pull` 是否同步阻塞未知(若同步阻塞到下载完成,这条提示反而
   * 是准的),待真机观察,这里不擅自改成常驻状态。
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
   * settingsStore.js:113-153 —— 建条目 + 起 2s 轮询定时器。
   *
   * D3(brief)——Vue2 `Settings.vue:159-163` 有一段挂载时遍历
   * `state.hfImportJobs` 恢复未完成下载轮询的代码,但 Vue2 每次挂载都
   * `createSettingsStore()` 新建一份 state,`hfImportJobs` 恒为 `{}`,那段
   * 恢复循环**从未执行过一次**——离开设置页时进度条消失、定时器随闭包泄漏。
   * Pinia 单例下 `hfImportJobs` 与 `_timer` 都还在,该恢复循环(Task 8 落地)
   * 第一次有了意义:回到页面进度条会继续显示。这是"照搬后行为变好",不是
   * bug 修复,但按纪律仍需申报。**Vue2 原文 `&& !job._timer` 守卫要逐字保留**
   * ——它是防止重复起定时器的闸,因此 `_timer` 必须留在 job 对象上(见
   * ImportJob 类型注释),不得优化成模块级 Map。
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

  /** settingsStore.js:161-166 —— cancelImport 的失败被有意吞掉(fire and forget)。 */
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

  // ── Providers(settingsStore.js:21-28)──
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
        api_key: '', // settingsStore.js:185 —— never pre-fill api_key on edit
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
   * settingsStore.js:208-233 —— 校验错误文案见文件头【i18n 偏离说明】:本任务
   * 不新增 i18n 键,直接沿用 Vue2 英文源字面量作为 Error message。
   */
  async function saveProvider() {
    const data = providerForm.value.data
    if (!data.name.trim() || !data.base_url.trim()) {
      throw new Error('Name and Base URL are required')
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

  /** settingsStore.js:235-248 —— 失败需回滚到调用前快照并重新抛出。 */
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

  /** settingsStore.js:255-264 —— 失败时保留上次的 models,不清空,并重新抛出。 */
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

  /** settingsStore.js:266-275 —— 同 loadProviderModels,换刷新端点。 */
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
   * settingsStore.js:277-282 —— 持久化某 provider 的收藏集 + 手动模型列表。
   * `models` 是期望的完整列表 `{ name, favorite }`(source 由服务端权威决定)。
   */
  async function saveProviderModels(id: string | number, models: { name: string; favorite: boolean }[]) {
    const body = await service.ai.updateProviderModels(id, models)
    providerModels.value[id] = { loading: false, models: (body as ProviderModel[]) || [] }
  }

  /** settingsStore.js:284-290 —— 只带 name/favorite 两个字段提交,不带 source。 */
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

  /** settingsStore.js:300-307 —— 只删 source==='manual' 的同名项。 */
  function removeManualModel(id: string | number, name: string) {
    const entry = providerModels.value[id]
    if (!entry) return
    const desired = entry.models
      .filter((m) => !(m.name === name && m.source === 'manual'))
      .map((m) => ({ name: m.name, favorite: m.favorite }))
    return saveProviderModels(id, desired)
  }

  // ── Privacy(settingsStore.js:31)──
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

  /** settingsStore.js:319-333 —— 乐观更新,失败回滚并重新抛出;policy 为 null 时先填默认值。 */
  async function updatePolicyField<K extends keyof Policy>(field: K, value: Policy[K]) {
    const old = policy.value ? { ...policy.value } : null
    if (!policy.value) {
      policy.value = { allow_remote: false, default_backend: 'local', escalation_prompt: false }
    }
    const next: Policy = { ...policy.value, [field]: value }
    policy.value = next
    policySaving.value = true
    try {
      // Policy 故意不带索引签名(见类型定义处注释),保持 updatePolicyField<K> 的
      // keyof 收窄;这里按需转成共享包要求的 Record<string, unknown> 形参。
      await service.ai.updatePolicy(next as unknown as Record<string, unknown>)
    } catch (e) {
      policy.value = old
      throw e
    } finally {
      policySaving.value = false
    }
  }

  // ── Blacklist(settingsStore.js:34-35;P2b 消费,本期只搬 store 侧)──
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

  /** settingsStore.js:362-368 —— 回包可能是 `{id,...}` 或裸 id 本身,兜底用时间戳。 */
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

  // ── Services status(settingsStore.js:38-40)──
  const servicesStatus = ref<ServicesStatus>({ ollama: null, openvino: null, agent: null })
  const searchStatus = ref<SearchStatus>({ running: false })
  const parserStatus = ref<ParserStatus>({
    running: false,
    paused: false,
    pending: 0,
    concurrency: 2,
  })

  /** settingsStore.js:335-351 —— 整体失败被吞掉,三组状态全部落回默认("关闭")值。 */
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
   * SP8-P2a D2 —— Vue2 没有这个动作,本仓必须有。
   *
   * Vue2 `Settings.vue:101` 每次挂载都 `createSettingsStore()` 新建一份 state,
   * 组件卸载即丢弃,所以每次进设置页 activeSection 恒为 'models'、表单恒收起、
   * HF 搜索结果恒为空。Pinia 是全局单例,会把上次离开时的瞬态 UI 状态原样带
   * 回来 —— 那是架构差异,不是 Vue2 的行为,必须显式复位以保持 1:1。
   *
   * 精确切分:**只重置瞬态 UI**。刻意不动
   *   - hfImportJobs / pullingModels:真在后台跑的任务,清了进度条就没了
   *   - installedModels / providers / policy / blacklist / *Status:服务端数据
   *     缓存,清了页面会先白一下再重填,视觉上反而比 Vue2 差
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
