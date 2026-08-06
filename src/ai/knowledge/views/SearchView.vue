<script setup lang="ts">
// SP8-P5e Task 6+7 —— `SearchView.vue`(1:1 移植自蓝本
// `NimoOS-UI@7a6ee6b7` `src/views/AI/Knowledge/SearchView.vue`,401 行)。
//
// T6 范围(治理 `p5e-plan.md` §T6,`p5e-coordinator-rulings-T0.md` R25):
//   模板 `:1-119`(sticky 搜索框 + 高级面板 + idle/loading/empty 三态)+
//   `:158-162`(error 态)+ script 常量块(`SAMPLE_QUERIES`/`FILE_TYPES`/
//   `MIME_PREFIXES`/`MTIMES`/`WEEK_MS`/`MONTH_MS`/`YEAR_MS`)+
//   `advEnabled`/`totalChunks` + `clear`/`quickSearch`/`toggleSet`/
//   `buildFilters`/`run` + `$route.query.q` 的 watch。
// T7 范围(本次续写,`p5e-plan.md` §T7 · 裁定 R1「方案 A」):
//   结果卡列表(`:121-156`)+ 两个子组件挂载 markup(`:164-172`)+
//   `fetchBlobUrl`/`openOriginal`/`downloadFile`/`onDrawerToast` + 两个 ext
//   常量集(`:186-190`)。
//
// ═══ 🔴 K44 —— `.vue` 侧零 `<style>` 块(scss 全部由 T2 搬进 `src/ai/styles/knowledge.scss`) ═══
//
// ═══ 🔴 K52(裁定 R1,方案 A)—— 文件字节流走 `service.file.fileUrl()` + `getHttp()` ═══
// 治理 K50 原文规定的落法(`getHttp().get('/v3/file', { params, responseType:'blob' })`)
// 在真机上 100% 401 ——`/v3/file`(`NimoOS/route/v2.go:237-266` 的 `InitFile()`)是裸
// `http.HandlerFunc`、零 JWT 中间件,只读 `?token=` query 参数,`getHttp()` 只设
// `Authorization` 头、从不往 query 拼 token。用户 2026-08-05 拍板方案 A:改走
// `service.file.fileUrl(path)`(唯一接受该端点认证形式的调用)拼出的 URL 去发那一次
// XHR,仍用 `getHttp()`(Service 仓零改动),`inline` 时手工拼 `&inline=1`(后端真支持,
// `route/v2.go:257-261`)。`window.open`/`<a href>` 消费的是 `URL.createObjectURL()`
// 产出的 `blob:` 地址,不是 `fileUrl()` 本身 —— 地址栏/浏览历史/Referer 不含 token,
// 代价是 token 进这一次后台 XHR 的 query(并入既有的「终端 WS token 进访问日志」后端票)。
// `/v3/file` 不会被 `withVersion()` 改写成 `/v1/v3/file`
// (`.sp8/NimoOS-Service/src/http.ts:6-10` 的 `/^\/v[1-9]/` 原样放行,`v3` 命中)。
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { getHttp, service } from '@nimotech/nimoos-service'
import KIcon from '../components/KIcon.vue'
import FileDetailDrawer from '../components/FileDetailDrawer.vue'
import KFileViewer from '../components/KFileViewer.vue'
import { useKnowledgeStore } from '../stores/knowledgeStore'
import { chunkCount, fmtMtime, highlight, relLabel, relLevel, toFileResults } from '../util/searchAggregate'
import type { FileVM, SearchTextResponseRaw } from '../util/searchAggregate'

const { t } = useI18n()
const route = useRoute()
const store = useKnowledgeStore()

// ─── 蓝本 :186-219 script 常量 ───

// 蓝本 :188。浏览器不能原生预览这些 office 格式 —— 走 in-app 的 `@vue-office`
// 预览器(`KFileViewer`),不新开标签页。
const OFFICE_INAPP_EXTS = new Set(['docx', 'wps', 'xls', 'xlsx', 'csv'])
// 蓝本 :190。既非浏览器也非 `@vue-office` 能处理的旧版二进制 office —— 只能提示下载。
const NO_PREVIEW_EXTS = new Set(['doc', 'ppt', 'pptx'])

// 蓝本 :192。🔴 N33:五个示例查询照抄且过 i18n —— 本仓没有用蓝本那种「英文短语
// 本身当 key」的写法,T1 已把它们落成 `aiKbSample*` 键(zh_cn.ts/en_us.ts),这里存
// 键名,模板里 `t(s)` 解析出真正译文(与蓝本 `$t(s)` 的双重渲染语义等价:按钮文案
// 与点击后填入搜索框的值都是译文)。
const SAMPLE_QUERIES = [
  'aiKbSampleThyroid',
  'aiKbSamplePythonAsync',
  'aiKbSampleContract',
  'aiKbSampleIphone',
  'aiKbSampleSkating',
]

// 蓝本 :194-200。⚠️ 这五个 label 是裸字面量,模板 `{{ t.label }}` 没过 `$t()`
// → 不进 i18n,照抄字面量(T1 i18n 头注释已明确这一条,别搞混 MTIMES/SAMPLE_QUERIES)。
const FILE_TYPES = [
  { id: 'pdf', label: 'PDF', icon: '📕' },
  { id: 'md', label: 'Markdown', icon: '📝' },
  { id: 'txt', label: 'TXT', icon: '📃' },
  { id: 'doc', label: 'DOC', icon: '📚' },
  { id: 'code', label: 'Code', icon: '💻' },
]

// 蓝本 :202-208。🔴 N35:逐字照抄,不许"补全"缺的 docling 变体 —— 那是后端 mime
// 取值的既有事实,补了会静默改变筛选结果(本机 7 个已收录文件 mime 全是
// text/plain,取消勾选 TXT 以外任何一类都不会改变结果集,见 fixtures README §2③)。
const MIME_PREFIXES: Record<string, string[]> = {
  pdf: ['text/markdown+docling/pdf', 'application/pdf'],
  md: ['text/markdown'],
  txt: ['text/plain'],
  doc: ['text/markdown+docling/docx', 'text/markdown+docling/pptx', 'text/markdown+docling/xlsx'],
  code: ['text/x-source'],
}

// 蓝本 :210-215。label 存键名(过 `t()`),不是字面量 —— 与 SAMPLE_QUERIES 同款处理。
const MTIMES = [
  { id: 'any', label: 'aiKbSrMtimeAny' },
  { id: '1w', label: 'aiKbSrMtimeWeek' },
  { id: '1m', label: 'aiKbSrMtimeMonth' },
  { id: '1y', label: 'aiKbSrMtimeYear' },
]

// 蓝本 :217-219。🔴 N36:`1m` = 30 天、`1y` = 365 天(常量,不是日历月/年)。
const WEEK_MS = 7 * 24 * 3600 * 1000
const MONTH_MS = 30 * 24 * 3600 * 1000
const YEAR_MS = 365 * 24 * 3600 * 1000

// ─── 蓝本 data()(:224-244)—— 页面级瞬态,一律组件本地 ref,不塞 store(治理 §5.1) ───

const q = ref('')
const advOpen = ref(false)
// 蓝本 :232 —— 初值是全 5 类(K51:`ref<Set<string>>` + 整体替换,不用
// `reactive(new Set())` 就地 add/delete,见下方 `toggleSet`)。
const types = ref<Set<string>>(new Set(['pdf', 'md', 'doc', 'txt', 'code']))
const mtime = ref('any')
const quality = ref<'fast' | 'accurate'>('fast')
const topK = ref(10)
type Phase = 'idle' | 'loading' | 'results' | 'empty' | 'error'
const phase = ref<Phase>('idle')
const results = ref<FileVM[]>([])
// N39:`clear()` 一并清空这两个(蓝本 :264)。渲染归 T7,状态本刀声明。
const openFile = ref<FileVM | null>(null)
const viewerFile = ref<FileVM | null>(null)
const ms = ref(0)
const errorMsg = ref('')
const showRerankWarn = ref(false)
const lastQuery = ref('')

// ─── 蓝本 computed(:246-251) ───

/**
 * 蓝本 :247-249。🔴 N34:判据是 `types.size < FILE_TYPES.length` —— **全选 = 未启用**
 * (反直觉,照抄不改)。四个 or 分支任一为真即 `true`。
 */
const advEnabled = computed(
  () =>
    types.value.size < FILE_TYPES.length ||
    mtime.value !== 'any' ||
    quality.value !== 'fast' ||
    topK.value !== 10,
)
/** 蓝本 :250。 */
const totalChunks = computed(() => chunkCount(results.value))

// ─── 蓝本 methods ───

/** 蓝本 :264。N39:一并清 `openFile`/`viewerFile`。 */
function clear() {
  q.value = ''
  phase.value = 'idle'
  results.value = []
  openFile.value = null
  viewerFile.value = null
}

/** 蓝本 :265-268。 */
function quickSearch(s: string) {
  q.value = s
  run()
}

/**
 * 蓝本 :269-274(注释原文 "mutate set then reassign for reactivity")。K51:
 * 复制新 Set 再整体赋值 —— 🔴 不许改成 `reactive(new Set())` 就地 add/delete
 * (那会让 `advEnabled` 的 `types.size` 依赖追踪走另一条路径,与蓝本不同源)。
 * ⚠️ 蓝本这个方法虽然签名上接收 `set` 形参,但重新赋值的目标写死是 `this.types`
 * (唯一调用点 `toggleSet(types, t.id)` 也只传 `types` 本身)—— 逐字照抄这个写法,
 * 不"泛化"成按传入引用动态赋值。
 */
function toggleSet(set: Set<string>, v: string) {
  const next = new Set(set)
  if (next.has(v)) next.delete(v)
  else next.add(v)
  types.value = next
}

/**
 * 蓝本 :275-289。🔴 N35/N36 逐字:全选(`types.size === FILE_TYPES.length`)不发
 * `mime_prefix`;取消至少一类才发,且前缀按 `types` 迭代顺序(Set 插入序)拼接。
 * `mtime !== 'any'` 才发 `mtime_after_ms`,三档常量见上方 `WEEK_MS`/`MONTH_MS`/`YEAR_MS`。
 */
function buildFilters(): Record<string, unknown> {
  const f: Record<string, unknown> = {}
  if (types.value.size < FILE_TYPES.length) {
    const prefixes: string[] = []
    for (const ty of types.value) {
      for (const p of MIME_PREFIXES[ty] || []) prefixes.push(p)
    }
    if (prefixes.length) f.mime_prefix = prefixes
  }
  if (mtime.value !== 'any') {
    const map: Record<string, number> = { '1w': WEEK_MS, '1m': MONTH_MS, '1y': YEAR_MS }
    f.mtime_after_ms = Date.now() - map[mtime.value]
  }
  return f
}

// 🔴 治理 §5.2 —— 蓝本无此守卫,本期新增(K15 同族第 9 次)。并发入口 3 个:
// `run()`(回车/按钮)· `quickSearch()` · 下方 `route.query.q` 的 watch —— 三者
// 最终都调用这同一个 `run()`,守卫只需加在这一处。`runEpoch` 是 <script setup>
// 顶层声明的变量:Vue SFC 的 `<script setup>` 编译成每个组件实例各自执行一次的
// `setup()` 函数体,这里声明的 `let` 因此是**组件实例局部闭包变量**,不是模块级
// 共享状态 ——「两实例交错」用例(见 `SearchView.test.ts`)钉住这一点,判据是
// "把它挪到模块级共享 → 必须报红"(手工 RED 探针,见报告,不落进永久测试文件)。
let runEpoch = 0

/**
 * 蓝本 :290-316。分支:空 query → `'idle'` 且不发请求;成功且有结果 → `'results'`;
 * 成功但零结果 → `'empty'`;抛错 → `'error'`。🔴 N37:catch 里不设 `ms`(上一次
 * 成功的耗时保留,但 `phase==='error'` 时那块不渲染)。
 * 🔴 过期守卫(治理 §5.2,蓝本没有):`myEpoch` 捕获当前发号,await 结束后与
 * `runEpoch` 比对 —— 不一致说明已经有更新的一发在途/落地,直接丢弃这发的更新,
 * 不覆盖 `results`/`ms`/`phase`/`errorMsg`。success 与 catch 两个分支都要挡
 * (蓝本没有这个守卫,是本刀出于"phase 直接驱动整屏渲染,用户可见"这条真实
 * bug 主动加的,不是蓝本行为的一部分)。
 */
async function run() {
  const query = q.value.trim()
  if (!query) {
    phase.value = 'idle'
    return
  }
  lastQuery.value = query
  phase.value = 'loading'
  showRerankWarn.value = false
  const myEpoch = ++runEpoch
  const t0 = Date.now()
  try {
    const r = (await store.runSearch({
      query,
      filters: buildFilters(),
      topK: topK.value,
      rerank: quality.value === 'accurate',
    })) as SearchTextResponseRaw
    if (myEpoch !== runEpoch) return
    const elapsed = Date.now() - t0
    results.value = toFileResults(r)
    ms.value = elapsed
    if (r.warnings && r.warnings.includes('rerank_unavailable')) {
      showRerankWarn.value = true
      // N38:蓝本 `setTimeout` 无清理(:309),照抄 —— 组件卸载后回调仍会跑,但在
      // Vue 3 里写一个已卸载组件的 ref 无副作用、无警告,不加 onBeforeUnmount。
      setTimeout(() => {
        showRerankWarn.value = false
      }, 5000)
    }
    phase.value = results.value.length ? 'results' : 'empty'
  } catch (e) {
    if (myEpoch !== runEpoch) return
    phase.value = 'error'
    const err = e as { response?: { data?: { error?: string } }; message?: string }
    errorMsg.value = (err.response && err.response.data && err.response.data.error) || err.message || String(e)
  }
}

/**
 * 蓝本 :346-355 `fetchBlobUrl`。🔴 K52/裁定 R1(方案 A,见文件头说明):不走
 * `getHttp().get('/v3/file', {params, responseType:'blob'})`(那条落法在本后端上恒
 * 401)——改走 `service.file.fileUrl(fullPath)` 拼出的 URL 字符串(该端点唯一接受的
 * 认证形式)去发同一次 `getHttp()` XHR。`inline` 为真时手工拼 `&inline=1`
 * (后端真支持,`route/v2.go:257-261`),否则 URL 里不含 `inline`。
 * 🔴 **`responseType: 'blob'` 是硬断言**——`blob` 会从响应 `Content-Type` 带上真实类型,
 * `arraybuffer` 会丢它,新标签页会变成下载而不是预览(判据:改成 `'arraybuffer'` →
 * 用例必须报红)。返回值是 `URL.createObjectURL()` 产出的同源 `blob:` 地址——
 * `window.open`/`<a href>` 消费的必须是这个,不许是 `fileUrl()` 本身
 * (地址栏/浏览历史/Referer 不含 token,K52 的隐私收益落点)。
 */
async function fetchBlobUrl(fullPath: string, opts: { inline?: boolean } = {}): Promise<string> {
  const url = service.file.fileUrl(fullPath) + (opts.inline ? '&inline=1' : '')
  const resp = await getHttp().get(url, { responseType: 'blob' })
  return URL.createObjectURL(resp.data as Blob)
}

/**
 * 蓝本 :357-380 `openOriginal`。按扩展名路由:office in-app 格式 → `viewerFile`
 * (不发请求);无预览器的旧版 office → toast 提示下载(不发请求);其余 → 新标签页
 * 打开 blob URL(浏览器原生预览快)。
 * 🔴 ext 提取是 `(file.name || '').split('.').pop().toLowerCase()`(`|| ''` 是
 * TS 层面对 `.pop()` 返回类型 `string | undefined` 的防御写法,与 `KFileViewer.vue`
 * 同款,运行时对非空数组永不触发——不是行为变化)——**无扩展名的文件名会把整个
 * 名字当 ext**(例如文件名恰好是 `docx`,零扩展名,会被误判成 in-app 可预览格式),
 * 照抄,不"修好"。
 */
async function openOriginal(payload: { file: FileVM }) {
  const file = payload.file
  if (!file || !file.fullPath) {
    store.toast(t('aiKbSrNoPath'))
    return
  }
  const ext = ((file.name || '').split('.').pop() || '').toLowerCase()
  if (OFFICE_INAPP_EXTS.has(ext)) {
    viewerFile.value = file
    return
  }
  if (NO_PREVIEW_EXTS.has(ext)) {
    store.toast(t('aiKbSrNoPreviewToast'))
    return
  }
  try {
    const url = await fetchBlobUrl(file.fullPath, { inline: true })
    const w = window.open(url, '_blank', 'noopener,noreferrer')
    if (!w) store.toast(t('aiKbSrPopupBlocked'))
    // N38 同族:蓝本自带的 60s 延迟回收,照抄。
    setTimeout(() => URL.revokeObjectURL(url), 60000)
  } catch (e) {
    const err = e as { message?: string } | undefined
    // `String(...)` 只是让 TS(`e: unknown`)编译通过——JS 的 `+` 本来就会对非字符串
    // 操作数做同样的隐式 ToString,运行时输出与蓝本 `... + e` 逐字相同,不是行为变化。
    store.toast(t('aiKbSrOpenFailed') + ': ' + String((err && err.message) || e))
  }
}

/**
 * 蓝本 :382-397 `downloadFile`。取字节 → 造 `<a download>` → 触发点击 → 清理。
 * 🔴 逐步都要断:`a.download` 的 `file.name || 'download'` 兜底 · `rel` ·
 * `document.body.removeChild(a)` 真的被调用(否则 DOM 泄漏)· 60s 延迟
 * `revokeObjectURL`。
 */
async function downloadFile(file: FileVM) {
  if (!file || !file.fullPath) {
    store.toast(t('aiKbSrNoPath'))
    return
  }
  try {
    const url = await fetchBlobUrl(file.fullPath)
    const a = document.createElement('a')
    a.href = url
    a.download = file.name || 'download'
    a.rel = 'noopener noreferrer'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 60000)
  } catch (e) {
    const err = e as { message?: string } | undefined
    store.toast(t('aiKbSrDownloadFailed') + ': ' + String((err && err.message) || e))
  }
}

/**
 * 蓝本 :398 `onDrawerToast`。`FileDetailDrawer` 的通知约定是 emit `toast`
 * (蓝本 `:186-190` 注释),由父组件转发到 store 的 toast action
 * (`store.toast` 内部调 `useToast().show(msg, 2400)`,治理 §5.1)。
 * 🔴 不许让子组件直接调 `useToast()` —— 那会改掉蓝本的组件契约。
 */
function onDrawerToast(msg: string) {
  store.toast(msg)
}

/**
 * 蓝本 :252-261 watch('$route.query.q', {immediate:true})。🔴 N40:必须用响应式
 * `watch`,不许只在 `onMounted` 里读一次(记忆 `newui-router-query-only-no-remount`:
 * 用户改地址栏一行都不跑)。条件 `v && v !== q.value` —— query 与当前 `q` 相同时
 * 不重复搜。
 */
watch(
  () => route.query.q,
  (v) => {
    if (v && v !== q.value) {
      q.value = v as string
      run()
    }
  },
  { immediate: true },
)
</script>

<template>
  <div class="k-scroll">
    <div class="k-scroll-inner">
      <!-- Sticky search box -->
      <div class="k-search-sticky">
        <div class="k-search-sticky-inner">
          <div class="k-search-box">
            <KIcon name="search" :size="16" color="var(--text-tertiary)" />
            <input
              type="text"
              :placeholder="t('aiKbSrPlaceholder')"
              v-model="q"
              @keydown.enter="run"
              autofocus
            />
            <button v-if="q" class="k-search-clear" @click="clear">
              <KIcon name="x" :size="10" />
            </button>
            <button class="k-btn primary" :disabled="!q.trim()" @click="run">
              <KIcon name="search" :size="12" /> {{ t('aiKbSearch') }}
            </button>
          </div>

          <button class="k-adv-toggle" :data-open="String(advOpen)" @click="advOpen = !advOpen">
            <span class="chev"><KIcon name="chev" :size="11" /></span>
            <KIcon name="settings" :size="12" />
            {{ t('aiKbSrAdvanced') }}
            <span v-if="advEnabled" style="color: var(--accent); font-weight: 600">· {{ t('aiKbSrAdvOn') }}</span>
          </button>

          <div v-if="advOpen" class="k-adv-panel">
            <div class="k-adv-field">
              <div class="k-adv-label">{{ t('aiKbSrFileType') }}</div>
              <div class="k-adv-chips">
                <button
                  v-for="ft in FILE_TYPES"
                  :key="ft.id"
                  class="k-adv-chip"
                  :data-on="String(types.has(ft.id))"
                  @click="toggleSet(types, ft.id)"
                >
                  <span>{{ ft.icon }}</span> {{ ft.label }}
                </button>
              </div>
            </div>
            <div class="k-adv-field">
              <div class="k-adv-label">{{ t('aiKbSrModified') }}</div>
              <div class="k-adv-chips">
                <button
                  v-for="m in MTIMES"
                  :key="m.id"
                  class="k-adv-chip"
                  :data-on="String(mtime === m.id)"
                  @click="mtime = m.id"
                >
                  {{ t(m.label) }}
                </button>
              </div>
            </div>
            <div class="k-adv-field">
              <div class="k-adv-label">{{ t('aiKbSrQuality') }}</div>
              <div class="k-seg">
                <button :data-on="String(quality === 'fast')" @click="quality = 'fast'">
                  <KIcon name="play" :size="10" /> {{ t('aiKbSrQualityFast') }}
                </button>
                <button :data-on="String(quality === 'accurate')" @click="quality = 'accurate'">
                  <KIcon name="target" :size="10" /> {{ t('aiKbSrQualityAccurate') }}
                </button>
              </div>
              <div v-if="showRerankWarn" class="k-rerank-warn">
                {{ t('aiKbSrRerankWarn') }}
              </div>
            </div>
            <div class="k-adv-field">
              <div class="k-adv-label">{{ t('aiKbSrTopK') }}</div>
              <div class="k-seg">
                <button
                  v-for="n in [5, 10, 20, 50]"
                  :key="n"
                  :data-on="String(topK === n)"
                  @click="topK = n"
                >
                  {{ n }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- States -->
      <div v-if="phase === 'idle'" class="k-empty">
        <div class="k-empty-illust"><KIcon name="search" :size="36" /></div>
        <div class="k-empty-title">{{ t('aiKbSrIdleTitle') }}</div>
        <div class="k-empty-sub">
          {{ t('aiKbSrIdleSub') }}
        </div>
        <div class="k-empty-tips">
          <div
            style="
              font-size: 11px;
              color: var(--text-quaternary);
              text-transform: uppercase;
              letter-spacing: 0.04em;
              font-weight: 600;
              margin-top: 8px;
            "
          >
            {{ t('aiKbTry') }}
          </div>
          <div class="k-hero-suggest" style="justify-content: center">
            <button v-for="s in SAMPLE_QUERIES" :key="s" class="k-suggest-chip" @click="quickSearch(t(s))">
              {{ t(s) }}
            </button>
          </div>
        </div>
      </div>

      <div v-else-if="phase === 'loading'" class="k-results">
        <div class="k-result-count">
          <span class="k-skel" style="display: inline-block; width: 200px; height: 12px" />
        </div>
        <div v-for="i in 6" :key="i" class="k-skel-rcard">
          <div class="k-skel" style="width: 30px; height: 36px" />
          <div style="flex: 1; display: flex; flex-direction: column; gap: 8px">
            <div class="k-skel" style="width: 40%; height: 14px" />
            <div class="k-skel" style="width: 100%; height: 12px" />
            <div class="k-skel" style="width: 90%; height: 12px" />
            <div class="k-skel" style="width: 35%; height: 10px" />
          </div>
        </div>
      </div>

      <div v-else-if="phase === 'empty'" class="k-empty">
        <div class="k-empty-illust"><KIcon name="search" :size="32" /></div>
        <div class="k-empty-title">{{ t('aiKbSrEmptyTitle') }}</div>
        <div class="k-empty-sub">{{ t('aiKbSrEmptySub') }}</div>
        <div class="k-empty-tips">
          <div class="k-empty-tip"><KIcon name="edit" :size="12" /> {{ t('aiKbSrEmptyTipKeyword') }}</div>
          <div class="k-empty-tip"><KIcon name="folder" :size="12" /> {{ t('aiKbSrEmptyTipIndexed') }}</div>
          <div class="k-empty-tip"><KIcon name="settings" :size="12" /> {{ t('aiKbSrEmptyTipAllowlist') }}</div>
        </div>
      </div>

      <!-- phase === 'results':蓝本 :121-156(T7)。 -->
      <div v-else-if="phase === 'results'" class="k-results">
        <div class="k-result-count">
          <b>{{ results.length }}</b> {{ t('aiKbSrCountFiles') }} ·
          <b>{{ totalChunks }}</b> {{ t('aiKbSrCountMatches') }} · for <b>"{{ lastQuery }}"</b>
          <span style="color: var(--text-quaternary); margin-left: 6px">
            <!-- 蓝本 :125 `v-if="ms"`——🔴 ms === 0 时不渲染(falsy),不是空字符串占位。 -->
            <span v-if="ms"> · {{ ms }} ms</span>
          </span>
        </div>
        <div v-for="r in results" :key="r.id" class="k-rcard" @click="openFile = r">
          <div class="k-rcard-icon">
            <span class="k-rcard-tag" :data-kind="r.kind">{{ r.kind.toUpperCase() }}</span>
          </div>
          <div class="k-rcard-body">
            <div class="k-rcard-head">
              <div class="k-rcard-name">{{ r.name }}</div>
              <!-- 🔴 :title 与可见文案是两个不同的 i18n 键(蓝本 :135-136),不许合并。 -->
              <span class="k-match-pill" :title="t('aiKbSrMatchTitle', { n: r.chunks.length })">
                <KIcon name="search" :size="10" /> {{ t('aiKbSrMatchPill', { n: r.chunks.length }) }}
              </span>
              <span class="k-rel" :data-level="relLevel(r.score)" :title="`${t('aiKbSrSimilarity')} ${(r.score * 100).toFixed(0)}%`">
                <span class="k-rel-dot" /> {{ relLabel(r.score) }}
              </span>
            </div>
            <!-- 蓝本 :142:`r.chunks[0] && r.chunks[0].snippet` —— 零 chunk 的文件不许抛。
                 K49:v-html 消费 highlight() 的转义输出,XSS 面已在 util 层测过,这里补
                 组件层渲染后的真实 DOM 断言(见测试文件)。 -->
            <div class="k-rcard-snippet" v-html="highlight(r.chunks[0] && r.chunks[0].snippet, lastQuery)" />
            <!-- 蓝本 :143:v-if 用 chunks.length > 1,文案用 chunks.length - 1(两侧都要用例)。 -->
            <div v-if="r.chunks.length > 1" class="k-more-hint">
              <span class="chev"><KIcon name="chev" :size="11" /></span>
              {{ t('aiKbSrMoreHint', { n: r.chunks.length - 1 }) }}
            </div>
            <div class="k-rcard-meta">
              <span class="k-rcard-meta-item"><KIcon name="folder" :size="11" /><span class="path">{{ r.path }}</span></span>
              <span style="color: var(--text-quaternary)">·</span>
              <span class="k-rcard-meta-item">{{ t('aiKbSrModified') }} {{ fmtMtime(r.mtimeMs) }}</span>
              <span style="color: var(--text-quaternary)">·</span>
              <span class="k-rcard-meta-item"><KIcon name="check" :size="11" color="var(--success)" /> {{ t('aiKbStatusIndexed') }}</span>
            </div>
          </div>
        </div>
      </div>

      <div v-else-if="phase === 'error'" class="k-empty">
        <div class="k-empty-illust" style="color: var(--danger)"><KIcon name="danger" :size="32" /></div>
        <div class="k-empty-title">{{ t('aiKbSrErrorTitle') }}</div>
        <div class="k-empty-sub">{{ errorMsg }}</div>
      </div>

      <!-- 蓝本 :164-172(T7)。FileDetailDrawer 四个监听全接(T5 DoD-12 自动上膛守卫
           在此刻满足);onDrawerToast 把子组件的 toast 约定转发到 store.toast。 -->
      <FileDetailDrawer
        v-if="openFile"
        :file="openFile"
        :query="lastQuery"
        @close="openFile = null"
        @open="openOriginal"
        @download="downloadFile"
        @toast="onDrawerToast"
      />

      <KFileViewer v-if="viewerFile" :file="viewerFile" @close="viewerFile = null" @download="downloadFile" />
    </div>
  </div>
</template>
