// SP8-P5a Task 6 —— 1:1 移植自 Vue2
// `NimoOS-UI` (main@7a6ee6b7) `src/views/AI/Knowledge/store/knowledgeStore.js`(363 行)。
// 本文件只搬 **Parser 组**(Dashboard/topbar、Jobs 队列、Allowlist、Control、
// Indexed Files 五块 state + 对应 action + `toast`/`fmtAgo`)。notes/wiki/distill
// 三组(state: distillJobs/wikiRoots/wikiCandidates/wikiRootsLoading/
// notesDraftCount/notesSummary + 对应 action)留给 T7 在本文件里续写 ——
// 见任务 brief:「本任务只做: state 里 Dashboard/topbar/Allowlist/Queue(parser
// 半)/indexedFiles 五块 + toast + loadOverview + Jobs 五个 action + Allowlist
// 四个 + setControl + IndexedFiles 五个。notes/wiki/distill 留给 T7」。
// 【评审 R1 修正,2026-08-01】`export const DISTILL_JOBS_LIMIT = 500` 曾被误判为
// 「本任务代码零处引用,归 T7」而漏掉。这个判断错了 —— 判据是任务 brief 的
// **Interfaces 契约**(brief 第 11 行明文把它列进 T6 的 Produces)与**下游消费者**
// (T7 brief `import { useKnowledgeStore, DISTILL_JOBS_LIMIT } from './knowledgeStore'`
// 且断言里直接用到这个值),不是「这个任务自己的代码里有没有用到」。跨任务契约里
// 点名要产出的东西缺了,下一个任务会直接编译不过。现补上,定义处见下方(紧邻
// `fmtAgo` 之前,对应蓝本 :11 的位置)。
//
// 【取数口径】(K1,承 P2a/P3a/P3b/P4 第五次同一模具)—— Vue2 里 `api.xxx()` 返回
// axios 原始响应,处处写 `resp.data`(如蓝本 :84 `stats.data`)。共享包
// `service.ai.*` 已在包内解过那一层,直接吐 body。故本文件把蓝本的
// `stats.data`/`control.data`/`r.data.jobs`/`r.data.files`/`r.data.total`/
// `exts.data.extensions`/`folders.data.rules` 全部改写成单层的
// `stats`/`control`/`body.jobs`/`body.files`/`body.total`/`body.extensions`/
// `body.rules`,不再多剥一层 `.data`。与 agentStore.ts:110-130、
// settingsStore.ts:6-9 确立的口径一致。
//
// 【Vue2 响应式 API 的机械替换】(等价物,非行为改动;承 P1)
//   Vue.observable({ state: {...} }) → 一组 ref
//   state.x                          → x.value
//   Vue.set(o, k, v)                 → o[k] = v(本组无命中)
//   actions.foo() 内部互调(如 loadAllJobs 调 this.loadJobs)→ 直接调本地函数
//
// 【偏离 P2:定时器句柄移出 state】—— 蓝本把 `indexedFiles.pollTimer` 放在响应式
// state 里(:53)。本文件改成模块级 `let indexedPollTimer`(与 agentStore.ts 的
// `_toastTimer` 同款):Pinia state 会被 devtools 序列化,定时器句柄不是数据。
// 行为等价 ——`startIndexedPolling` 里「已在轮询就不重复起」的守卫
// (蓝本 :346 `if (s.pollTimer) return`)原样保留,只是判据换成了模块级变量。
//
// 【偏离 P4:`.k-toast` 退役后 toast 的去处】—— 蓝本 `toast(msg)`(:72-76)直接写
// `knowledgeStore.state.toast` 并用模块级 `_toastTimer` 做 2400ms 自动清空,配
// 组件里的 `.k-toast` 渲染。本仓 `.k-toast` 不移植(K3),`toast()` 保留为 store
// action(蓝本多处调用点依赖它这个名字),内部改调全局 `useToast().show(msg,
// 2400)`——2400ms 是蓝本自己的超时,必须显式传参(`useToast().show` 默认值是
// 1500,见 `src/stores/toast.ts:21`)。`state.toast` 字段整个删除,不再需要。
//
// 【i18n】`fmtAgo`(蓝本 :60-69)用 `i18n.t(...)`。本仓 vue-i18n 9 走 composition
// 模式,Pinia setup store 不在组件 setup 上下文里、`useI18n()` 用不了,照
// agentStore.ts:6,899 的既有先例改用全局实例 `i18n.global.t(...)`。四个键
// (`aiKbJustNow`/`aiKbMinAgo`/`aiKbHrAgo`/`aiKbDaysAgo`)由 T8 落地,已在
// `src/i18n/{zh_cn,en_us}.ts` 核实存在,插值占位符名 `m`/`h`/`d` 与蓝本
// `{m}`/`{h}`/`{d}` 逐字一致。

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { service } from '@nimotech/nimoos-service'
import { i18n } from '../../../i18n'
import { useToast } from '../../../stores/toast'
import { buildListParams, anyIndexing } from '../util/indexedFiles'

// ── 类型:服务端返回体在共享包里都是 `unknown`,这里按蓝本的实际用法窄化 ──
// (字段形状见设计 §6.1 / p5a-common-constraints.md §4 的后端实测契约)

export interface QueueDepth {
  pending: number
  running: number
  failed: number
  done: number
}

export interface ParserModel {
  name: string
  version?: string
  modality?: string
  dim?: number
  [k: string]: unknown
}

/** parserStats() 回包 —— 实测无 rate_per_min/done_last_10m/eta_s(N2,照抄不补)。 */
export interface ParserStats {
  queue_depth: QueueDepth
  indexed_files: number
  total_vectors_text: number
  total_vectors_visual: number
  last_cursor_ms: number
  models?: ParserModel[]
}

/** parserState() 回包 —— 实测只有这 5 个字段。 */
export interface ParserControlState {
  paused: boolean
  concurrency: number
  device: string
  resolved_device: string
  ocr_enabled: boolean
}

export interface ParserJob {
  id: string | number
  root_id?: string
  path: string
  op?: string
  sub_modality?: string
  priority?: number
  attempts?: number
  last_error?: string | null
  locked_until?: string | null
  created_at?: string
  picked_at?: string | null
  done_at?: string | null
  [k: string]: unknown
}

export interface JobsBuckets {
  pending: ParserJob[]
  running: ParserJob[]
  failed: ParserJob[]
}

/** parserAllowlistExtensions() 单条 —— 后端 `enabled` 是 SQLite 整数 0/1(N1)。 */
export interface RawAllowlistExtension {
  ext: string
  enabled: number | boolean
  source: string
}

/** 归一化后(N1:`enabled` 转布尔)。 */
export interface AllowlistExtension {
  ext: string
  enabled: boolean
  source: string
}

export interface FolderRule {
  id: string | number
  root_id?: string
  path_glob?: string
  action?: string
  [k: string]: unknown
}

export interface IndexedFile {
  file_id: string
  paths?: { root_id: string; path: string; mtime_ms: number }[]
  sha256_full?: string
  size?: number
  mime?: string
  modalities_done?: string[]
  parser_version?: string
  indexed_at?: string
  tombstoned_at?: string | null
  vector_count?: number
  last_error?: string | null
  status?: string
  [k: string]: unknown
}

/** 蓝本 :48-52 —— Indexed Files tab 的筛选器初值。 */
export interface IndexedFileFilters {
  root_id: string | null
  path_prefix: string
  mime_prefix: string
  has_error: boolean
  tombstoned: string
  sort: string
  order: string
  limit: number
  offset: number
}

/** 蓝本 :46-54 —— **不含** `pollTimer`(P2 偏离,句柄挪到模块级 `indexedPollTimer`)。 */
export interface IndexedFilesState {
  files: IndexedFile[]
  total: number
  loading: boolean
  error: string | null
  filters: IndexedFileFilters
}

/**
 * 蓝本 :9-11 —— 一次沉淀任务队列拉取的服务端上限,与视图共用同一个数字,让
 * 「列表被截断」的判据(已加载行数 >= 这个上限)两边算的是同一件事。本批
 * (T6)不消费它——沉淀队列(distillJobs)整组归 T7;T7 起 `import { ...,
 * DISTILL_JOBS_LIMIT } from './knowledgeStore'` 使用。值与蓝本逐字一致(500)。
 */
export const DISTILL_JOBS_LIMIT = 500

/** 蓝本 :60-69 —— 相对时间格式化,四档(0 值/分钟/小时/天)。 */
export function fmtAgo(ms: number): string {
  if (!ms) return '—'
  const diff = Math.max(0, Date.now() - ms)
  const m = Math.floor(diff / 60000)
  if (m < 1) return i18n.global.t('aiKbJustNow')
  if (m < 60) return i18n.global.t('aiKbMinAgo', { m })
  const h = Math.floor(m / 60)
  if (h < 24) return i18n.global.t('aiKbHrAgo', { h })
  return i18n.global.t('aiKbDaysAgo', { d: Math.floor(h / 24) })
}

/** P2 —— 定时器句柄移出 state,理由见文件头注释。 */
let indexedPollTimer: ReturnType<typeof setInterval> | null = null

export const useKnowledgeStore = defineStore('ai-knowledge', () => {
  // ── Dashboard / topbar(蓝本 :18-23)──
  const stats = ref<ParserStats>({
    queue_depth: { pending: 0, running: 0, failed: 0, done: 0 },
    indexed_files: 0,
    total_vectors_text: 0,
    total_vectors_visual: 0,
    last_cursor_ms: 0,
  })
  const controlState = ref<ParserControlState>({
    paused: false,
    concurrency: 2,
    device: 'auto',
    resolved_device: 'cpu',
    ocr_enabled: false,
  })
  const unreachable = ref(false)
  const overviewLoaded = ref(false)
  const lastSyncFmt = ref('—')

  // ── Allowlist(蓝本 :24-26)──
  const extensions = ref<AllowlistExtension[]>([])
  const folderRules = ref<FolderRule[]>([])

  // ── Queue(蓝本 :27-28,parser 半)──
  const jobs = ref<JobsBuckets>({ pending: [], running: [], failed: [] })

  // ── Parsing progress(蓝本 :41-42)──
  const backlogPeak = ref(0)

  // ── Indexed Files tab(蓝本 :45-54,P2 去掉 pollTimer)──
  const indexedFiles = ref<IndexedFilesState>({
    files: [],
    total: 0,
    loading: false,
    error: null,
    filters: {
      root_id: null,
      path_prefix: '',
      mime_prefix: '',
      has_error: false,
      tombstoned: 'alive',
      sort: 'indexed_at',
      order: 'desc',
      limit: 100,
      offset: 0,
    },
  })

  /** P4 —— `.k-toast` 退役,转调全局 toast,2400ms 与蓝本一致(须显式传参)。 */
  function toast(msg: string): void {
    useToast().show(msg, 2400)
  }

  /** 蓝本 :78-96 —— 并行拉 stats + control state;失败置 unreachable,不动既有值。 */
  async function loadOverview(): Promise<void> {
    try {
      const [statsBody, controlBody] = await Promise.all([
        service.ai.parserStats(),
        service.ai.parserState(),
      ])
      stats.value = statsBody as ParserStats
      controlState.value = controlBody as ParserControlState
      lastSyncFmt.value = fmtAgo(stats.value.last_cursor_ms)
      unreachable.value = false
      overviewLoaded.value = true

      const q = stats.value.queue_depth || ({} as QueueDepth)
      const backlog = (q.pending || 0) + (q.running || 0)
      backlogPeak.value = Math.max(backlogPeak.value, backlog)
    } catch {
      unreachable.value = true
    }
  }

  // ── Jobs(蓝本 :141-166)──

  /** 蓝本 :142-145 —— 单桶拉取,N7:缺 `jobs` 键兜底空数组。 */
  async function loadJobs(status: string, limit = 200): Promise<ParserJob[]> {
    const body = (await service.ai.parserJobs({ status, limit })) as { jobs?: ParserJob[] }
    return body.jobs || []
  }

  /** 蓝本 :146-153 —— 三桶并行拉取并归位。 */
  async function loadAllJobs(): Promise<void> {
    const [p, r, f] = await Promise.all([
      loadJobs('pending'),
      loadJobs('running'),
      loadJobs('failed'),
    ])
    jobs.value = { pending: p, running: r, failed: f }
  }

  /** 蓝本 :154-157 —— 默认 `null`(全部重试)。 */
  async function retryFailed(fileIds: string[] | null = null): Promise<void> {
    await service.ai.parserRetryJobs({ file_ids: fileIds })
    await loadAllJobs()
  }

  /** 蓝本 :158-161。 */
  async function cancelJob(id: string | number): Promise<void> {
    await service.ai.parserDeleteJob(id)
    await loadAllJobs()
  }

  /** 蓝本 :162-166。 */
  async function clearFailed(): Promise<unknown> {
    const body = await service.ai.parserClearFailedJobs()
    await loadAllJobs()
    return body
  }

  // ── Allowlist(蓝本 :217-241)──

  /** 蓝本 :217-228 —— N1:`enabled` 的 0/1 归一化成布尔,连注释一起照抄。 */
  async function loadAllowlist(): Promise<void> {
    const [extsBody, foldersBody] = await Promise.all([
      service.ai.parserAllowlistExtensions(),
      service.ai.parserAllowlistFolders(),
    ])
    const exts = extsBody as { extensions?: RawAllowlistExtension[] }
    const folders = foldersBody as { rules?: FolderRule[] }
    // Parser 把 `enabled` 报成 SQLite INTEGER(0/1)。chip 模板靠布尔值驱动视觉
    // 翻转状态 —— 不做这层归一化,chip 永远不会随后端值切换高亮(蓝本 :222-225
    // 原注释逐字对齐)。
    extensions.value = (exts.extensions || []).map((e) => ({ ...e, enabled: !!e.enabled }))
    folderRules.value = folders.rules || []
  }

  /** 蓝本 :229-232。 */
  async function toggleExtension(ext: string, enabled: boolean): Promise<void> {
    await service.ai.patchParserAllowlistExtensions({ ext, enabled })
    await loadAllowlist()
  }

  /** 蓝本 :233-237。 */
  async function addFolderRule(payload: {
    root_id: string
    path_glob: string
    action: string
  }): Promise<unknown> {
    const body = await service.ai.addParserAllowlistFolder(payload)
    await loadAllowlist()
    return body
  }

  /** 蓝本 :238-241。 */
  async function deleteFolderRule(id: string | number): Promise<void> {
    await service.ai.deleteParserAllowlistFolder(id)
    await loadAllowlist()
  }

  // ── Control(蓝本 :310-314,设置页用)──

  /** 蓝本 :311-314 —— action + 附加字段合并进 body,成功后重载 overview。 */
  async function setControl(action: string, extra: Record<string, unknown> = {}): Promise<void> {
    await service.ai.parserControl({ action, ...extra })
    await loadOverview()
  }

  // ── Indexed Files tab(蓝本 :316-362)──

  /** 蓝本 :317-330。 */
  async function loadIndexedFiles(): Promise<void> {
    const s = indexedFiles.value
    s.loading = true
    s.error = null
    try {
      const body = (await service.ai.parserFiles(buildListParams(s.filters))) as {
        files?: IndexedFile[]
        total?: number
      }
      s.files = body.files || []
      s.total = body.total || 0
    } catch (e) {
      s.error = (e as Error | undefined)?.message || String(e)
    } finally {
      s.loading = false
    }
  }

  /** 蓝本 :332-336。 */
  async function reindexIndexedByIds(fileIds: string[], reason?: string): Promise<unknown> {
    const body = await service.ai.parserReindexFiles({ file_ids: fileIds, reason })
    await loadIndexedFiles()
    return body
  }

  /** 蓝本 :338-342。 */
  async function reindexIndexedByFilter(
    filter: Record<string, unknown>,
    reason?: string,
  ): Promise<unknown> {
    const body = await service.ai.parserReindexFiles({ filter, reason })
    await loadIndexedFiles()
    return body
  }

  /**
   * 蓝本 :344-353 —— 已在轮询就不重复起(P2:守卫判据从 `state.indexedFiles.pollTimer`
   * 换成模块级 `indexedPollTimer`,语义原样保留);无 indexing 行也不起;每 30s
   * 重载一次,完工(不再有 indexing 行)后自停。
   */
  function startIndexedPolling(): void {
    if (indexedPollTimer) return
    if (!anyIndexing(indexedFiles.value.files)) return
    indexedPollTimer = setInterval(async () => {
      await loadIndexedFiles()
      if (!anyIndexing(indexedFiles.value.files)) {
        stopIndexedPolling()
      }
    }, 30000)
  }

  /** 蓝本 :356-362。 */
  function stopIndexedPolling(): void {
    if (indexedPollTimer) {
      clearInterval(indexedPollTimer)
      indexedPollTimer = null
    }
  }

  return {
    // state
    stats,
    controlState,
    unreachable,
    overviewLoaded,
    lastSyncFmt,
    extensions,
    folderRules,
    jobs,
    backlogPeak,
    indexedFiles,
    // actions
    toast,
    loadOverview,
    loadJobs,
    loadAllJobs,
    retryFailed,
    cancelJob,
    clearFailed,
    loadAllowlist,
    toggleExtension,
    addFolderRule,
    deleteFolderRule,
    setControl,
    loadIndexedFiles,
    reindexIndexedByIds,
    reindexIndexedByFilter,
    startIndexedPolling,
    stopIndexedPolling,
  }
})
