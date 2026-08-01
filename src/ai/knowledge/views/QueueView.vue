<!--
  SP8-P5b Task 5 —— 「任务队列」页,1:1 移植自 Vue2 蓝本
  `NimoOS-UI` (main@7a6ee6b7) `src/views/AI/Knowledge/QueueView.vue`(417 行,
  `git show main:` 读取,治理文件 §1:工作树是旧分支不可信)。

  结构对照(蓝本行区间,见任务 brief 的区块表 → 本文件):
    :6-13    scope 切换(两个 .k-filter-pill,index/distill)
    :16-39   三桶 pill(pending/running/failed)+ 完成统计(k-done-stat)
    :44-75   工具条(index scope):未选中态 / 选中态两支
    :76-82   工具条(distill scope):单行 label,无批量操作
    :85-98   空态:failed 桶专属插画 + 🎉;K16 两句改走 i18n;:87 内联渐变见下
    :100-140 index 表格:全选 + 状态图标 + basename/dirname + fmtAgo + 行操作
    :145-185 distill 表格:专属栅格(data-scope="distill")· 无 checkbox · kn-badge 徽标
    :190-208 清空确认弹窗 —— K7:reka Dialog 原语,不用裸 div

  【K7】弹窗一律 reka 原语 + DialogPortal 的 to 指向知识库容器 `.knowledge-app`
  (SP8 已爆三次)。结构照 src/ai/components/settings/skills/SkillDetail.vue:488-511
  的确认弹窗先例(VisuallyHidden 包 DialogTitle 满足 reka 的 a11y 要求,视觉上
  DOM 仍是蓝本的 .k-confirm-body / .k-modal-foot 结构,K17 本期不搬 .k-modal-head
  一族——蓝本这个弹窗本来就没有它们)。

  【K11】fmtAgo 复用 store 导出版本(knowledgeStore.ts:190-199),不照抄蓝本
  :405-414 的本地副本——T0 已核两者在非负 diff 下输出相同,store 版只多一个
  Math.max(0, …) 钳制。

  【K16】:96 两句硬编码英文(`'All pending jobs are done.'` / `'No jobs running
  right now.'`)改走 aiKbQueueAllPendingDone / aiKbQueueNoRunningNow,两档同填
  英文原文,渲染结果与 Vue2 逐字相同。

  【K18】failed 桶三个重试入口(retryOne / bulkRetry / retryAllFailed)统一真发
  store.retryFailed(null),toast 统一 aiKbRetriedAllFailed(不报数)。证据链见
  治理文件 §4.3:parser_jobs 表没有 file_id 列(NimoOS-Parser/parser/db.py:30-42),
  retry_failed_jobs() 的 file_ids 是死形参(repo_jobs.py:107-121,源码注释原文
  `# file_ids param reserved for §B; for MVP retry all failed`)——蓝本
  retryOne 传的 file_id 恒 undefined、bulkRetry 的 fileIds 恒空数组(一个请求都不
  发却弹「已重试 {n} 条」的假成功 toast),只有 retryAllFailed 语义正确。三处
  改动详见下方各函数内的注释,按钮/禁用条件/图标/排版零变动。

  【K5,承 P5a】三处「操作失败」catch 分支不回显后端 body / e.message,改走
  固定 i18n 键(与 knowledgeStore.ts 的 loadRoots、DashboardView 等既有先例同一
  模具)。cancelDistillRow 的 409 分支保留蓝本的专属友好提示(aiKbCannotCancel),
  但不再拼接 Vue2 的 `'Cancel failed: ' + msg` 前缀——蓝本那个前缀本来就是为了
  拼 e.message 设计的,409 分支现在是一句独立的完整提示,重复加前缀反而是蛇足,
  不属于「照抄不改」范畴内的可观察行为(纯文案裁剪,不影响任何判断分支/请求)。

  【K12,承 T4】distillIconState / basename / dirname 从 util/queueView.ts 导入,
  不在本文件重复定义。三处蓝本自身的「怪行为」(failed/skipped 共用 danger 色、
  空值返回 U+2014、dirname 空路径与单段路径的边界拼接)已在该文件逐字照抄并注释,
  本文件不再重复解释。

  【偏离,类型安全机械改写】蓝本 computed `rows`/`counts`/`doneCount` 混用两种
  行形状(ParserJob 与 DistillJob)。TS 严格模式下对同一个 union 数组做
  `.map(r => r.id)`(index-only)或 `row.filePath`(distill-only)access 需要
  精确的类型收窄,故拆成 `indexRows`/`distillRows` 两个各自强类型的 computed,
  外加一个 `rowsEmpty` 计算「当前 scope 下没有行」——功能与蓝本单一 `rows`
  computed 完全等价(同一份 store 数据、同一个 filter 索引),只是 TS 类型层面
  的组织方式不同,不是行为改动。

  【偏离,K13 同款】selected 用 ref(new Set()) 整体替换,不用计数器 tick。

  【守卫缺口③,B.0.4】蓝本 :87 的 .k-empty-illust 内联 style= 渐变按附录 B §B.0
  换成 token 派生(3 处 color-mix),渐变结构/角度/停止位逐字不变。
-->
<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { DialogRoot, DialogPortal, DialogOverlay, DialogContent, DialogTitle, VisuallyHidden } from 'reka-ui'
import KIcon from '../components/KIcon.vue'
import { useKnowledgeStore, fmtAgo, DISTILL_JOBS_LIMIT } from '../stores/knowledgeStore'
import type { ParserJob } from '../stores/knowledgeStore'
import type { DistillJob } from '@nimotech/nimoos-service'
import { distillIconState, basename, dirname } from '../util/queueView'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const store = useKnowledgeStore()

type QueueFilter = 'pending' | 'running' | 'failed'
type QueueScope = 'index' | 'distill'

/** 蓝本 data() —— filter 默认 'pending',selected 空集合,confirmClear 关闭。 */
const filter = ref<QueueFilter>('pending')
const selected = ref<Set<string | number>>(new Set())
const confirmClear = ref(false)
let pollTimer: ReturnType<typeof setInterval> | null = null

/** 蓝本 :226 computed scope —— 深链:`?scope=distill` → 沉淀桶,其余(含缺省)
 * → 文件索引。 */
const scope = computed<QueueScope>(() => (route.query.scope === 'distill' ? 'distill' : 'index'))

/** 拆分自蓝本单一 `rows` computed(见文件头注释「类型安全机械改写」)。 */
const indexRows = computed<ParserJob[]>(() => store.jobs[filter.value] || [])
const distillRows = computed<DistillJob[]>(() => store.distillJobs[filter.value] || [])
const rowsEmpty = computed<boolean>(() =>
  (scope.value === 'distill' ? distillRows.value.length : indexRows.value.length) === 0,
)

/** 蓝本 counts computed —— distill 走 distillJobs.counts(全量 tally),
 * index 走 stats.queue_depth 三个字段。 */
const counts = computed<{ pending: number; running: number; failed: number }>(() => {
  if (scope.value === 'distill') return store.distillJobs.counts
  return {
    pending: store.stats.queue_depth.pending,
    running: store.stats.queue_depth.running,
    failed: store.stats.queue_depth.failed,
  }
})

/** 蓝本 doneCount computed。 */
const doneCount = computed<number>(() =>
  scope.value === 'distill' ? store.distillJobs.done || 0 : store.stats.queue_depth.done || 0,
)

/**
 * 蓝本 distillTruncated computed —— 沉淀队列单次拉取封顶 DISTILL_JOBS_LIMIT,
 * 已加载行数(`distillJobs.total`)达到这个上限就视为「被截断」,与判断
 * index 表格「仅展示前 200 条」同一种手法(比较已加载行数,不是另发一次
 * COUNT 查询——免竞态,N5 已在 knowledgeStore.ts 里申报照抄)。
 */
const distillTruncated = computed<boolean>(() => {
  if (scope.value !== 'distill') return false
  return (store.distillJobs.total || 0) >= DISTILL_JOBS_LIMIT
})

/** 蓝本 watch '$route.query.filter'(immediate)—— 深链 `?filter=failed` 立即生效。
 * DashboardView.vue:202 已经在推这个 query(该文件属零改动清单,只读不改),
 * 本任务在这里闭合这条链。 */
watch(
  () => route.query.filter,
  (v) => {
    if (v) filter.value = v as QueueFilter
  },
  { immediate: true },
)

/** 蓝本 loadForScope() —— 轮询与手动切换共用的分发点。 */
function loadForScope(): Promise<void> {
  return scope.value === 'distill' ? store.loadDistillJobs(filter.value) : store.loadAllJobs()
}

/** 蓝本 setScope(s)。 */
function setScope(s: QueueScope): void {
  if (scope.value === s) return
  selected.value = new Set()
  router.replace({ query: { ...route.query, scope: s } })
  if (s === 'distill') store.loadDistillJobs(filter.value)
  else store.loadAllJobs()
}

/** 蓝本 setFilter(f)。 */
function setFilter(f: QueueFilter): void {
  filter.value = f
  selected.value = new Set()
  if (scope.value === 'distill') store.loadDistillJobs(f)
}

/** 蓝本 toggleSel(id)。 */
function toggleSel(id: string | number): void {
  const next = new Set(selected.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selected.value = next
}

/** 蓝本 toggleAll()。 */
function toggleAll(): void {
  selected.value =
    selected.value.size === indexRows.value.length
      ? new Set()
      : new Set(indexRows.value.map((r) => r.id))
}

/**
 * 蓝本 retryOne(row)(:312-318)—— 原文 `retryFailed([row.file_id || row.id])`。
 * K18 证据①:parser_jobs 表没有 file_id 列 → `row.file_id` 恒 undefined,实际
 * 传的是 job id;证据②:repo_jobs.py:107-121 的 `file_ids` 是死形参,后端无条件
 * `UPDATE … WHERE done_at IS NOT NULL AND last_error IS NOT NULL`,传什么都重试
 * 整个 failed 桶。故改真发 retryFailed(null),行为(重试整桶)与后端实际发生的
 * 事一致,toast 统一 aiKbRetriedAllFailed。按钮/禁用条件/图标/排版零变动。
 * `row` 形参保留(签名与调用点 `@click="retryOne(row)"` 对齐,承接蓝本方法签名),
 * K18 后函数体不再读取它的任何字段。
 */
async function retryOne(row: ParserJob): Promise<void> {
  try {
    await store.retryFailed(null)
    store.toast(t('aiKbRetriedAllFailed'))
  } catch {
    store.toast(t('aiKbRetryFailedErr'))
  }
}

/** 蓝本 retryAllFailed()(:320-328)—— 唯一语义本来就正确的一条,`Retrying {n}
 * failed jobs` 判为死键(附录 A §A.7,K18 后无引用),toast 换成 aiKbRetriedAllFailed
 * 与另外两处统一。 */
async function retryAllFailed(): Promise<void> {
  try {
    await store.retryFailed(null)
    store.toast(t('aiKbRetriedAllFailed'))
  } catch {
    store.toast(t('aiKbRetryFailedErr'))
  }
}

/** 蓝本 cancelOne(row)(K5:不回显 e.message,改固定 i18n 键)。 */
async function cancelOne(row: ParserJob): Promise<void> {
  try {
    await store.cancelJob(row.id)
    store.toast(t('aiKbCancelled'))
  } catch {
    store.toast(t('aiKbCancelFailed'))
  }
}

/**
 * 蓝本 bulkRetry()(:337-349)—— 原文 `rows.filter(r => selected.has(r.id)).map(r
 * => r.file_id).filter(Boolean)`。K18 证据③:`file_id` 恒 undefined → `fileIds`
 * 恒为空数组 → `if (fileIds.length)` 恒 false → 一个请求都不发,却弹「已重试
 * {n} 条」的假成功 toast(`Retried {n} selected jobs` 判为死键,附录 A §A.7)。
 * 改真发 store.retryFailed(null),toast 统一 aiKbRetriedAllFailed。
 */
async function bulkRetry(): Promise<void> {
  try {
    await store.retryFailed(null)
    selected.value = new Set()
    store.toast(t('aiKbRetriedAllFailed'))
  } catch {
    store.toast(t('aiKbRetryFailedErr'))
  }
}

/** 蓝本 bulkCancel()(K5:不回显 e.message)。 */
async function bulkCancel(): Promise<void> {
  const ids = Array.from(selected.value)
  try {
    for (const id of ids) await store.cancelJob(id)
    selected.value = new Set()
    store.toast(t('aiKbCancelledNSelected', { n: ids.length }))
  } catch {
    store.toast(t('aiKbCancelFailed'))
  }
}

/** 蓝本 doClearFailed()(K5:不回显 e.message)。 */
async function doClearFailed(): Promise<void> {
  const n = counts.value.failed
  try {
    await store.clearFailed()
    confirmClear.value = false
    store.toast(t('aiKbClearedNFailed', { n }))
  } catch {
    store.toast(t('aiKbClearFailedErr'))
  }
}

/** 蓝本 retryDistillRow(row)(K5:不回显 e.message)。 */
async function retryDistillRow(row: DistillJob): Promise<void> {
  try {
    await store.retryDistill(row, filter.value)
    store.toast(t('aiKbRequeued'))
  } catch {
    store.toast(t('aiKbRetryFailedErr'))
  }
}

/**
 * 蓝本 cancelDistillRow(row)—— 409(已不可取消)保留蓝本的专属友好提示
 * aiKbCannotCancel;其余错误按 K5 改固定 aiKbCancelFailed,不再拼接
 * e.message(见文件头注释)。
 */
async function cancelDistillRow(row: DistillJob): Promise<void> {
  try {
    await store.cancelDistill(row, filter.value)
    store.toast(t('aiKbCancelled'))
  } catch (e) {
    const status = (e as { response?: { status?: number } } | undefined)?.response?.status
    store.toast(status === 409 ? t('aiKbCannotCancel') : t('aiKbCancelFailed'))
  }
}

/** 蓝本 created()/beforeDestroy() —— 10 秒轮询,document.hidden 时跳过。 */
onMounted(() => {
  loadForScope()
  pollTimer = setInterval(() => {
    if (document.hidden) return
    loadForScope()
  }, 10000)
})

onUnmounted(() => {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
})
</script>

<template>
  <div class="k-view">
    <div class="k-scroll">
      <div class="k-scroll-inner">
        <!-- scope 切换(蓝本 :6-13)—— 🔴 String() 必须套(选择器是 [data-on="true"]) -->
        <div class="k-queue-head" style="margin-bottom: 4px">
          <button class="k-filter-pill" :data-on="String(scope === 'index')" @click="setScope('index')">
            {{ t('aiKbScopeIndex') }}
          </button>
          <button class="k-filter-pill" :data-on="String(scope === 'distill')" @click="setScope('distill')">
            {{ t('aiKbScopeDistill') }}
          </button>
        </div>

        <!-- 三桶 pill + 完成统计(蓝本 :16-39) -->
        <div class="k-queue-head">
          <button class="k-filter-pill" :data-on="String(filter === 'pending')" @click="setFilter('pending')">
            <KIcon name="hourglass" :size="13" /> {{ t('aiKbPending') }}
            <span class="k-filter-pill-count">{{ counts.pending }}</span>
          </button>
          <button class="k-filter-pill" :data-on="String(filter === 'running')" @click="setFilter('running')">
            <KIcon name="spinner" :size="13" /> {{ t('aiKbRunning') }}
            <span class="k-filter-pill-count">{{ counts.running }}</span>
          </button>
          <button
            class="k-filter-pill"
            data-tone="danger"
            :data-on="String(filter === 'failed')"
            @click="setFilter('failed')"
          >
            <KIcon name="x" :size="12" /> {{ t('aiKbFailed') }}
            <span class="k-filter-pill-count">{{ counts.failed }}</span>
          </button>
          <div class="k-done-stat">
            <div class="k-done-stat-num">{{ t('aiKbTotalDone') }} <b>{{ doneCount.toLocaleString() }}</b></div>
            <div class="k-done-stat-label">{{ t('aiKbTotalDoneLabel') }}</div>
          </div>
        </div>

        <!-- 工具条:index scope 的完整批量工具条(蓝本 :44-75) -->
        <div v-if="scope === 'index'" class="k-toolbar" :data-selecting="String(selected.size > 0)">
          <template v-if="selected.size === 0">
            <span class="k-toolbar-label">
              <template v-if="filter === 'pending'">{{ t('aiKbNPendingJobs', { n: counts.pending }) }}</template>
              <template v-else-if="filter === 'running'">{{ t('aiKbNRunningJobs', { n: counts.running }) }}</template>
              <template v-else-if="filter === 'failed'">{{ t('aiKbNFailedRecords', { n: counts.failed }) }}</template>
            </span>
            <div style="margin-left: auto; display: flex; gap: 8px">
              <template v-if="filter === 'failed'">
                <button class="k-btn outline" :disabled="counts.failed === 0" @click="retryAllFailed">
                  <KIcon name="refresh" :size="12" /> {{ t('aiKbRetryAllFailed') }}
                </button>
                <button
                  class="k-btn ghost"
                  :disabled="counts.failed === 0"
                  :style="{ color: counts.failed > 0 ? 'var(--danger)' : undefined }"
                  @click="confirmClear = true"
                >
                  <KIcon name="trash" :size="12" /> {{ t('aiKbClearFailedRecords') }}
                </button>
              </template>
            </div>
          </template>
          <template v-else>
            <span class="k-toolbar-label">{{ t('aiKbNSelected', { n: selected.size }) }}</span>
            <div style="margin-left: auto; display: flex; gap: 8px">
              <button v-if="filter === 'failed'" class="k-btn primary" @click="bulkRetry">
                <KIcon name="refresh" :size="12" /> {{ t('aiKbRetrySelected') }}
              </button>
              <button class="k-btn ghost" @click="bulkCancel">
                <KIcon name="x" :size="12" />
                {{ filter === 'failed' ? t('aiKbClearSelected') : t('aiKbCancelSelected') }}
              </button>
              <button class="k-btn ghost" @click="selected = new Set()">{{ t('aiKbCancel') }}</button>
            </div>
          </template>
        </div>
        <!-- 工具条:distill scope 只有一行 label,无批量操作(蓝本 :76-82 —— 沉淀
             队列一次只重发单行,批量重试/清空在语义上没有对应操作) -->
        <div v-else class="k-toolbar">
          <span class="k-toolbar-label">
            <template v-if="filter === 'pending'">{{ t('aiKbNPendingJobs', { n: counts.pending }) }}</template>
            <template v-else-if="filter === 'running'">{{ t('aiKbNRunningJobs', { n: counts.running }) }}</template>
            <template v-else-if="filter === 'failed'">{{ t('aiKbNFailedRecords', { n: counts.failed }) }}</template>
          </span>
        </div>

        <!-- 空态(蓝本 :85-98) -->
        <div v-if="rowsEmpty" class="k-empty">
          <template v-if="filter === 'failed'">
            <!-- 蓝本 QueueView.vue:87 的内联渐变;三处裸色按附录 B §B.0 换成 token 派生,渐变结构逐字不变 -->
            <div
              class="k-empty-illust"
              style="
                background: radial-gradient(
                    circle at 30% 30%,
                    color-mix(in srgb, var(--text-on-accent) 50%, transparent),
                    transparent 60%
                  ),
                  linear-gradient(
                    135deg,
                    color-mix(in srgb, var(--success) 20%, transparent),
                    color-mix(in srgb, var(--accent) 20%, transparent)
                  )
              "
            >
              <KIcon name="rocket" :size="36" color="var(--success)" />
            </div>
            <div class="k-empty-title">🎉 {{ t('aiKbAllCaughtUp') }}</div>
            <div class="k-empty-sub">
              {{ scope === 'distill' ? t('aiKbNoFailedDistill') : t('aiKbNoFailedJobs') }}
            </div>
          </template>
          <template v-else>
            <div class="k-empty-illust"><KIcon name="check" :size="36" color="var(--success)" /></div>
            <div class="k-empty-title">{{ filter === 'pending' ? t('aiKbQueueEmpty') : t('aiKbNoRunningJobs') }}</div>
            <!-- K16:蓝本 :96 两句硬编码英文改走 i18n,两档同填英文原文 -->
            <div class="k-empty-sub">
              {{ filter === 'pending' ? t('aiKbQueueAllPendingDone') : t('aiKbQueueNoRunningNow') }}
            </div>
          </template>
        </div>

        <!-- index 表格(蓝本 :100-140) -->
        <div v-else-if="scope === 'index'" class="k-table">
          <div class="k-row k-row-head">
            <input
              type="checkbox"
              class="k-row-check"
              :checked="selected.size === indexRows.length && indexRows.length > 0"
              @change="toggleAll"
            />
            <span />
            <span>{{ t('aiKbColFile') }}</span>
            <span>{{ t('aiKbColPath') }}</span>
            <span>{{ t('aiKbColTime') }}</span>
            <span>{{ filter === 'failed' ? t('aiKbRetry') : '' }}</span>
            <span />
          </div>
          <div v-for="row in indexRows" :key="row.id" class="k-row" :data-selected="String(selected.has(row.id))">
            <input
              type="checkbox"
              class="k-row-check"
              :checked="selected.has(row.id)"
              @change="toggleSel(row.id)"
            />
            <span class="k-row-status" :data-state="filter">
              <KIcon v-if="filter === 'pending'" name="hourglass" :size="12" />
              <KIcon v-else-if="filter === 'running'" name="spinner" :size="12" />
              <KIcon v-else name="x" :size="12" />
            </span>
            <span class="k-row-name" :title="basename(row.path)">{{ basename(row.path) }}</span>
            <span class="k-row-path" :title="dirname(row.path)">{{ dirname(row.path) }}</span>
            <!-- ParserJob.created_at 在 knowledgeStore.ts 里声明成 string(该文件本任务
                 零改动权限),但后端实际下发的是毫秒时间戳数字(见 fixtures
                 jobs-pending.json)。Number(...) 只是满足 fmtAgo(ms: number) 的类型要求,
                 对真实数字输入是恒等转换,对 undefined 得到 NaN(!NaN 与 !undefined 同为
                 truthy 分支,回落 '—'),不改变任何可观察行为。 -->
            <span class="k-row-time">{{ fmtAgo(Number(row.created_at)) }}</span>
            <span class="k-row-retry">
              <template v-if="filter === 'failed' && row.attempts">{{ t('aiKbNRetried', { n: row.attempts }) }}</template>
              <span
                v-if="filter === 'failed' && row.last_error"
                style="
                  display: block;
                  font-size: 10px;
                  color: var(--text-quaternary);
                  font-weight: 400;
                  white-space: nowrap;
                  overflow: hidden;
                  text-overflow: ellipsis;
                "
              >
                {{ row.last_error }}
              </span>
            </span>
            <span class="k-row-actions">
              <button
                v-if="filter === 'pending'"
                class="k-row-action"
                data-tone="danger"
                :title="t('aiKbCancel')"
                @click="cancelOne(row)"
              >
                <KIcon name="x" :size="13" />
              </button>
              <button v-if="filter === 'failed'" class="k-row-action" :title="t('aiKbRetry')" @click="retryOne(row)">
                <KIcon name="refresh" :size="13" />
              </button>
            </span>
          </div>
          <div v-if="indexRows.length >= 200" class="k-table-foot">
            <KIcon name="info" :size="12" />
            {{ t('aiKbShowingFirst200') }}
          </div>
        </div>

        <!-- distill 表格(蓝本 :145-185)—— 专属栅格,无 checkbox 列,一行一个重试按钮 -->
        <div v-else class="k-table">
          <div class="k-row k-row-head" data-scope="distill">
            <span />
            <span>{{ t('aiKbColFile') }}</span>
            <span>{{ t('aiKbColPath') }}</span>
            <span>{{ t('aiKbStatus') }}</span>
            <span>{{ t('aiKbStatusError') }}</span>
            <span>{{ t('aiKbColTime') }}</span>
            <span />
          </div>
          <div v-for="row in distillRows" :key="row.filePath" class="k-row" data-scope="distill">
            <span class="k-row-status" :data-state="distillIconState(row)">
              <KIcon v-if="row.status === 'pending'" name="hourglass" :size="12" />
              <KIcon v-else-if="row.status === 'running'" name="spinner" :size="12" />
              <KIcon v-else name="x" :size="12" />
            </span>
            <span class="k-row-name" :title="basename(row.filePath)">{{ basename(row.filePath) }}</span>
            <span class="k-row-path" :title="dirname(row.filePath)">{{ dirname(row.filePath) }}</span>
            <span class="k-row-badges">
              <span class="kn-badge" :data-s="row.origin === 'manual' ? 'curated' : 'archived'">
                {{ row.origin === 'manual' ? t('aiKbOriginManual') : t('aiKbOriginAuto') }}
              </span>
              <span v-if="row.status === 'skipped'" class="kn-badge" data-s="draft">{{ t('aiKbSkipped') }}</span>
              <span v-else-if="row.status === 'failed'" class="kn-badge" data-s="failed">{{ t('aiKbFailed') }}</span>
            </span>
            <span class="k-row-error" :title="row.lastError">{{ row.lastError }}</span>
            <span class="k-row-time">{{ fmtAgo(row.updatedAt || row.enqueuedAt) }}</span>
            <span class="k-row-actions">
              <button
                v-if="row.status === 'pending'"
                class="k-row-action"
                data-tone="danger"
                :title="t('aiKbCancel')"
                @click="cancelDistillRow(row)"
              >
                <KIcon name="x" :size="13" />
              </button>
              <button
                v-if="row.status === 'failed' || row.status === 'skipped'"
                class="k-row-action"
                :title="t('aiKbRetry')"
                @click="retryDistillRow(row)"
              >
                <KIcon name="refresh" :size="13" />
              </button>
            </span>
          </div>
          <div v-if="distillTruncated" class="k-table-foot">
            <KIcon name="info" :size="12" />
            {{ t('aiKbShowingFirstN', { n: store.distillJobs.total }) }}
          </div>
        </div>
      </div>
    </div>

    <!-- 清空确认弹窗(蓝本 :190-208)—— K7:reka Dialog 原语,portal 到知识库容器。 -->
    <DialogRoot :open="confirmClear" @update:open="confirmClear = $event">
      <DialogPortal to=".knowledge-app" defer>
        <DialogOverlay class="k-modal-bg">
          <DialogContent class="k-modal" style="width: min(420px, 100%)" :aria-describedby="undefined">
            <VisuallyHidden as-child><DialogTitle>{{ t('aiKbClearFailedConfirmTitle') }}</DialogTitle></VisuallyHidden>
            <div class="k-confirm-body">
              <div class="k-confirm-icon"><KIcon name="danger" :size="28" /></div>
              <div class="k-confirm-title">{{ t('aiKbClearFailedConfirmTitle') }}</div>
              <div style="text-align: center; color: var(--text-secondary); font-size: 13px">
                {{ t('aiKbClearFailedConfirmBody', { n: counts.failed }) }}
              </div>
            </div>
            <div class="k-modal-foot">
              <div class="right" style="margin-left: auto">
                <button class="k-btn ghost" @click="confirmClear = false">{{ t('aiKbCancel') }}</button>
                <button class="k-btn danger" @click="doClearFailed">
                  <KIcon name="trash" :size="12" /> {{ t('aiKbConfirmClear') }}
                </button>
              </div>
            </div>
          </DialogContent>
        </DialogOverlay>
      </DialogPortal>
    </DialogRoot>
  </div>
</template>
