// SP8-P5c Task 5 —— 1:1 移植自 Vue2
// `NimoOS-UI` (main@7a6ee6b7) `src/views/AI/Parser/store/parserStore.js`(65 行,全搬)。
//
// 消费方是 Parser 两页(`ParserStatus.vue` / `ParserTest.vue`,归 T6/T7)——
// **本刀落地时全仓零 import 是预期的**,没有为了让它进产物去建 `.vue` 或上路由。
//
// 【K26 —— Vue2 响应式 API 的机械替换】(等价物,非行为改动;承 P1/P2,与
// `knowledgeStore.ts` 同一模具)
//   Vue.observable({ state: {...} })  → 一组 ref
//   parserStore.state.x = v           → x.value = v
//   parserStore.actions.foo()         → setup store 里的本地函数(五个动作内部
//                                       `await this.loadAll()` → 直接调 `loadAll()`)
//   蓝本 `state` 这层对象整个消失(Pinia setup store 直接返回 ref)——
//   Vue2 组件里的 `store.state.stats` 在本仓写成 `store.stats`。
// 🔴 **`parserStore` 里没有定时器,也不该有**:5 秒轮询与 `document.hidden` 守卫在
//   组件里(蓝本 `ParserStatus.vue:129-135` 的 `this._timer` + `beforeDestroy`),
//   归 T6。K26 那句「`_timer` 句柄移出 state」说的是那一处,不是本文件。
//
// 【K27 —— 5 处直调改走共享包】蓝本 `api.get('/ai/parser/stats')` /
//   `'/ai/parser/state'` / `'/ai/parser/folders'` / `'/ai/parser/jobs'` 与
//   `api.post('/ai/parser/control')`(五个动作各一次)→ `service.ai.parserStats()` /
//   `parserState()` / `parserFolders({limit:20})` / `parserJobs({status:'failed',limit:5})` /
//   `parserControl({...})`(`NimoOS-Service/src/ai.ts:591-620`)。
//
// 【K1 —— 单层取数】Vue2 里 `api.*()` 返回 axios 原始响应,处处写 `.data`;共享包
//   六个 `service.ai.parser*` 都只 `return res.data`(`ai.ts:591-620`,零转换)→
//   本文件比蓝本**少剥一层**,4 处:
//     蓝本 :31 `stats.data`                        → 本文件 `statsBody`
//     蓝本 :32 `control.data`                      → 本文件 `controlBody`
//     蓝本 :33 `folders.data`                      → 本文件 `foldersBody`
//     蓝本 :34 `(failed.data && failed.data.jobs)` → 本文件 `(failed && failed.jobs)`
//   🔴 **N7:`|| []` 兜底原样保留**(Go/Python 侧缺键或 `null` 都会到这条路上)。
//
// 【K33 —— `loadAll()` 的 store 实例局部 epoch 过期守卫】(协调者 2026-08-03 预先
//   授权,依据见治理 §3 K33;K15 同族第 2 次)。蓝本 `parserStore.js:22-46` **无此
//   守卫**。理由:`loadAll` 有 8 个并发入口(`ParserStatus.vue` 的 `mounted()` ·
//   5 秒轮询 `:129-131` · 刷新按钮 `reload()` `:137` · 五个控制动作各自
//   `await this.loadAll()`),两发在飞时 ① 先发后至会用更旧的数据覆盖新数据;
//   ② 更要紧的是 `finally` 里的 `loading = false` 会被先完成的那一发提前清掉,而
//   `loading` 直接驱动刷新按钮的 `:disabled`(`ParserStatus.vue:7`)与全部控件的
//   `:disabled` → **按钮/单选框提前解禁,用户可见**。按治理 §2 判据这是「修一个
//   可复现的错误行为」。inline 写,**不抽公共 guard**(过早抽象);epoch 是 store
//   setup 闭包内的局部变量(**不是模块级**)—— 模块级会让两个 pinia 实例互相把
//   对方的请求判成过期。范围严格限定:只加守卫,`Promise.all` 四发 / catch 置
//   `unreachable` + `error` / 成功分支置 `unreachable=false` + `error=null` /
//   `|| []` 兜底 / 五个动作「先 `parserControl` 再 `await loadAll()`」全部照抄不动。
//
// 【与 `knowledgeStore` 的关系】两者都持有 `stats` / `controlState`,**这是 Vue2
//   现状**(蓝本也是 `store/parserStore.js` 与 `store/knowledgeStore.js` 两份),
//   按治理 §5.1 照抄两份,**不合并**。

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { service } from '@nimotech/nimoos-service'

// ── 类型:共享包 `service.ai.parser*` 的返回值在包里都是 `unknown`,这里按
//    **实测响应体**(`.superpowers/sdd/p5c-fixtures/`,2026-08-03 真机抓取)窄化。
//    蓝本是 JS 无类型 —— 初值仍逐字照抄蓝本 :5-19,服务端多回、而蓝本初值里没有
//    的字段(`total_vectors_visual` / `models`)标成可选,**不往初值里补**。

export interface ParserQueueDepth {
  pending: number
  running: number
  failed: number
  done: number
}

/** `GET /v1/parser/stats`(fixture `parser-stats.json`)。P5a N2:实测无
 * `rate_per_min` / `done_last_10m` / `eta_s`,照抄不补。 */
export interface ParserStatsBody {
  queue_depth: ParserQueueDepth
  indexed_files: number
  total_vectors_text: number
  last_cursor_ms: number
  /** 服务端有,蓝本初值(:6-11)没有 → 可选,不进初值。 */
  total_vectors_visual?: number
  /** 同上;`dim` 实测可为 `null`(reranker 那条)。 */
  models?: { name: string; version?: string; modality?: string; dim?: number | null }[]
}

/** `GET /v1/parser/state`(fixture `parser-control-state.json`)—— 实测只有这 5 个字段。 */
export interface ParserControlStateBody {
  paused: boolean
  concurrency: number
  device: string
  resolved_device: string
  ocr_enabled: boolean
}

/** `GET /v1/parser/folders?limit=20` 的单项(fixture `parser-folders-pending-20.json`)
 * —— 实测只有这 3 个字段。 */
export interface ParserPendingFolder {
  root_id: string
  folder: string
  count: number
}

export interface ParserFoldersBody {
  folders: ParserPendingFolder[]
  /** 蓝本 `ParserStatus.vue:80` 读它;实测字段确实存在(本机 119)。 */
  total_groups: number
}

/** `GET /v1/parser/jobs?status=failed&limit=5` 的单项。蓝本模板只读
 * `id` / `path` / `last_error`(`ParserStatus.vue:97-99`);其余字段原样留着。 */
export interface ParserFailedJob {
  id: string | number
  path: string
  last_error?: string | null
  [k: string]: unknown
}

export const useParserStore = defineStore('parser', () => {
  // ── state(蓝本 :5-18,初值逐字照抄)──

  /** 蓝本 :6-11。 */
  const stats = ref<ParserStatsBody>({
    queue_depth: { pending: 0, running: 0, failed: 0, done: 0 },
    indexed_files: 0,
    total_vectors_text: 0,
    last_cursor_ms: 0,
  })
  /** 蓝本 :12 —— 注意初值 `paused: false` / `concurrency: 2` / `device: 'auto'` /
   * `resolved_device: 'cpu'` / `ocr_enabled: false`,逐字照抄。 */
  const controlState = ref<ParserControlStateBody>({
    paused: false,
    concurrency: 2,
    device: 'auto',
    resolved_device: 'cpu',
    ocr_enabled: false,
  })
  /** 蓝本 :13 —— 外层对象 + 内层数组同名,照抄。 */
  const folders = ref<ParserFoldersBody>({ folders: [], total_groups: 0 })
  /** 蓝本 :14。 */
  const failedJobs = ref<ParserFailedJob[]>([])
  /** 蓝本 :15-17。 */
  const loading = ref(false)
  const error = ref<string | null>(null)
  const unreachable = ref(false)

  /** K33 —— `loadAll` 的过期守卫计数器。**store 实例局部,不是模块级**(见文件头
   * 注释);写法承 `knowledgeStore.ts` 里 K15 的 `allJobsEpoch` / `indexedFilesEpoch`。
   * 不是数据,故不进返回的 state。 */
  let loadAllEpoch = 0

  /**
   * 蓝本 :22-43 —— 四发并行,任一失败整发落 `unreachable`,`finally` 归位 `loading`。
   *
   * 【偏离,K33,过期守卫】蓝本无此守卫,加的是三处判断(成功分支 / catch / finally),
   * 过期时**一个 state 都不写**(含 `loading` / `error` / `unreachable`)。理由与授权
   * 见文件头注释。其余逐条照抄:`loading = true` 无条件在最前(最新那一发要把按钮
   * 禁掉)· `Promise.all` 四发的**顺序与参数**照抄 · 成功分支置
   * `unreachable = false` + `error = null` · catch 置 `unreachable = true` +
   * `error = e.message || String(e)`。
   */
  async function loadAll(): Promise<void> {
    const epoch = ++loadAllEpoch
    loading.value = true
    try {
      const [statsBody, controlBody, foldersBody, failedBody] = await Promise.all([
        service.ai.parserStats(),
        service.ai.parserState(),
        service.ai.parserFolders({ limit: 20 }),
        service.ai.parserJobs({ status: 'failed', limit: 5 }),
      ])
      if (epoch !== loadAllEpoch) return
      // K1:蓝本 :31-33 是 `stats.data` / `control.data` / `folders.data`,本仓包内
      // 已剥过那一层 → 直接就是数据本身,不再多剥。
      stats.value = statsBody as ParserStatsBody
      controlState.value = controlBody as ParserControlStateBody
      folders.value = foldersBody as ParserFoldersBody
      // 蓝本 :34 `(failed.data && failed.data.jobs) || []` → 少一层 `.data`;
      // N7:`|| []` 兜底不许删(缺 `jobs` 键 / `null` 都走这条)。
      const failed = failedBody as { jobs?: ParserFailedJob[] } | null | undefined
      failedJobs.value = (failed && failed.jobs) || []
      unreachable.value = false
      error.value = null
    } catch (e) {
      if (epoch !== loadAllEpoch) return
      unreachable.value = true
      error.value = (e as Error | undefined)?.message || String(e)
    } finally {
      if (epoch === loadAllEpoch) loading.value = false
    }
  }

  // ── 五个控制动作(蓝本 :45-64)——「先 `parserControl` 再 `await loadAll()`」,
  //    body 的字段名逐字照抄(注意 `set_concurrency` 传的键是 **`n`**,不是
  //    `concurrency` —— 那是 `knowledgeStore.setControl` 调用点的写法,两处不同是
  //    Vue2 现状,照抄)。

  /** 蓝本 :45-48。 */
  async function pause(): Promise<void> {
    await service.ai.parserControl({ action: 'pause' })
    await loadAll()
  }

  /** 蓝本 :49-52。 */
  async function resume(): Promise<void> {
    await service.ai.parserControl({ action: 'resume' })
    await loadAll()
  }

  /** 蓝本 :53-56。 */
  async function setConcurrency(n: number): Promise<void> {
    await service.ai.parserControl({ action: 'set_concurrency', n })
    await loadAll()
  }

  /** 蓝本 :57-60。 */
  async function setDevice(device: string): Promise<void> {
    await service.ai.parserControl({ action: 'set_device', device })
    await loadAll()
  }

  /** 蓝本 :61-64。 */
  async function setOcr(enabled: boolean): Promise<void> {
    await service.ai.parserControl({ action: 'set_ocr', enabled })
    await loadAll()
  }

  return {
    // state
    stats,
    controlState,
    folders,
    failedJobs,
    loading,
    error,
    unreachable,
    // actions
    loadAll,
    pause,
    resume,
    setConcurrency,
    setDevice,
    setOcr,
  }
})
