<script setup lang="ts">
// SP8-P5e Task 6 —— `SearchView.vue` 上半(1:1 移植自蓝本
// `NimoOS-UI@7a6ee6b7` `src/views/AI/Knowledge/SearchView.vue`,401 行)。
//
// 本刀范围(治理 `p5e-plan.md` §T6,`p5e-coordinator-rulings-T0.md` R25):
//   模板 `:1-119`(sticky 搜索框 + 高级面板 + idle/loading/empty 三态)+
//   `:158-162`(error 态)+ script 常量块(`SAMPLE_QUERIES`/`FILE_TYPES`/
//   `MIME_PREFIXES`/`MTIMES`/`WEEK_MS`/`MONTH_MS`/`YEAR_MS`)+
//   `advEnabled`/`totalChunks` + `clear`/`quickSearch`/`toggleSet`/
//   `buildFilters`/`run` + `$route.query.q` 的 watch。
// 🔴 不写(全归 T7):结果卡列表(`:121-156`)· 两个子组件挂载 markup
// (`:164-172`)· `fetchBlobUrl`/`openOriginal`/`downloadFile`/`onDrawerToast`。
// ⚠️ 不为了"能看见"提前写结果卡 markup —— `phase === 'results'` 分支目前
// 是一个空壳容器,内容由 T7 续写这个文件时填入。
//
// ═══ 🔴 K44 —— `.vue` 侧零 `<style>` 块(scss 全部由 T2 搬进 `src/ai/styles/knowledge.scss`) ═══
//
// ═══ 🔴 R25(裁定)—— 本文件 import `FileDetailDrawer` 但不挂载 markup ═══
// 原因:T5 DoD-12 给 `FileDetailDrawer.test.ts` 加了一条自动上膛守卫 ——
// 「若 `views/SearchView.vue` 存在,则它必须 import `FileDetailDrawer`」,而本刀
// (T6)按范围明令不许写两个子组件的挂载 markup(那是 T7 的活)。R25 裁定:
// T6 只 import、不挂载 —— 这条 import **专门为了满足 T5 DoD-12 的上膛守卫**,
// 不是本文件当前逻辑需要它。T7 续写本文件、加上 `<FileDetailDrawer ...>`
// markup 时会真正用到这个 import。🔴 不 import `KFileViewer` ——
// T4 没有给它加同类守卫,它的 import 与 markup 一起归 T7(少 import 一个不会
// 有守卫报红,多 import 一个才是越权,见裁定 R25 第②条)。
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import KIcon from '../components/KIcon.vue'
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- 见上方 R25 说明:此 import
// 本刀不消费(未挂载 markup),只为满足 T5 DoD-12 的自动上膛守卫。tsconfig 未开
// noUnusedLocals(已实测确认),vite build 只会 tree-shake,不报错、三门不受影响。
import FileDetailDrawer from '../components/FileDetailDrawer.vue'
import { useKnowledgeStore } from '../stores/knowledgeStore'
import { toFileResults, chunkCount } from '../util/searchAggregate'
import type { FileVM, SearchTextResponseRaw } from '../util/searchAggregate'

const { t } = useI18n()
const route = useRoute()
const store = useKnowledgeStore()

// ─── 蓝本 :186-219 script 常量(本刀范围内的部分;两个 ext 常量集归 T7) ───

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

      <!-- phase === 'results':结果卡列表归 T7(蓝本 :121-156),本刀不写内容,
           留空容器等 T7 续写本文件时填入 —— 不为了"能看见"提前写结果卡 markup。 -->
      <div v-else-if="phase === 'results'" class="k-results" />

      <div v-else-if="phase === 'error'" class="k-empty">
        <div class="k-empty-illust" style="color: var(--danger)"><KIcon name="danger" :size="32" /></div>
        <div class="k-empty-title">{{ t('aiKbSrErrorTitle') }}</div>
        <div class="k-empty-sub">{{ errorMsg }}</div>
      </div>

      <!-- 两个子组件挂载归 T7(蓝本 :164-172):FileDetailDrawer(四个监听全接)+
           KFileViewer。本刀不写任何 <FileDetailDrawer>/<KFileViewer> markup。 -->
    </div>
  </div>
</template>
