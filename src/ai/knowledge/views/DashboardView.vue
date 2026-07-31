<!--
  SP8-P5a Task 12 —— 知识库仪表盘，1:1 移植自 Vue2 蓝本
  `NimoOS-UI` (main@7a6ee6b7) `src/views/AI/Knowledge/DashboardView.vue`(371 行，
  `git show main:` 读取，治理文件 §1：工作树是旧分支不可信）。

  结构对照（蓝本行号 → 本文件）：
    :4-39    空库 onboarding（orb + 标题 + 文案 + CTA 两钮 + 三层 intro 卡 +
             「深入」入口格 4 项）
    :42-136  Surface A「What's inside」三层构成卡（wiki/vec/note）+ glue 行
             （三个 id 说明条，各自 inline `--g` 传色）
    :138-178 Surface B「How it's organized」知识根一览（启用根卡 + 添加根 +
             停用根提示条）
    :180-245 Surface C「What's happening now」解析进度 + 限速档位 + 队列健康
             + 自动沉淀
    :247-263 Surface D「Go deeper」快捷入口格（7 项，非空库）
    :269-371 script：SAMPLE_QUERIES / LAYER_INTROS / CC_LEVELS 三常量 +
             computed 取数 + created() 生命周期 + methods

  i18n 键名适配（纯机械，非行为变化，同 T10 手法）：蓝本 `$t(literal)` 直接拿
  字面英文短语当 key；本仓改成常量数组持有 `aiKb*` 键名，模板里 `t(key)`。
  `*-en` 字面英文子标题（`k2-sec-en`/`k2-layer-name-en`/`k2-tag`/entry 的
  `en` 字段）**不翻译**——与 T10 KnowledgeLayout.vue 的 `TITLES[...].en` 同一
  条既有先例（蓝本本身就是「中文翻译 + 固定英文子标题」的双语设计，不是
  遗漏）。

  【交接项 1】`.k2-cc` 按下态选择器是 `[data-on="true"]`（字符串），套
  `String(...)`，否则 Vue 对 `false` 会整个删掉属性。
  【交接项 2】`.k2-glue-id i` 的圆点色靠模板 inline `style="--g: var(--ly-*)"`
  传下来，三条各自颜色，逐字照抄。
  【交接项 3】`k2-layer-num` 的 `second`/`suffix`、`k2-live-ico` 的 `spin`、
  `k2-drafts` 都是子元素 class，不是父元素属性。
  【N2，照抄不改】`stats.rate_per_min`/`done_last_10m`/`eta_s` 后端实测不下发
  （knowledgeStore.ts `ParserStats` 类型故未声明这三个字段；`DashboardStats`
  在本文件本地窄化只读类型，不回改 knowledgeStore.ts —— 那是 T6/T7 范围，
  已提交）。`|| 0`/`fmtEta` 空判兜底后速率/ETA/10 分钟完成数恒为 0 与空串，
  这是后端现状，不是前端 bug，验收清单里另有一条。
  【N3，照抄不改，用户 2026-07-31 明示不修】`created()` 的
  `Promise.all([...]).finally(ready=true)`：`Promise.all` 是 **fail-fast**——
  任一输入 reject，组合 promise 立刻 reject（不等其余输入 settle），
  `.finally` 因此立刻触发，`ready` 立刻置起；`Promise.allSettled` 则相反，
  必须等全部输入 settle（无论成功失败）才会 resolve。代价是 Wiki 后端
  （38GB SQLite）挂死时 `loadRoots()` 卡 axios 60s 超时——只要它最终 settle
  （无论成功失败），`Promise.all` 就会跟着 settle，整页骨架卡到那一刻。
  不改成 `allSettled`（那样某个 loader 一旦真悬挂，骨架反而永远出不来），
  不给 `loadRoots` 单独超时。fail-fast 特性的可分辨钉子见
  `DashboardView.test.ts`「N3 钉子」用例。

  【发现，非缺陷】`dashboardHelpers.ts` 导出的 `updatePeak` 在 Vue2 蓝本里就是
  死代码——`git grep updatePeak main -- src/views/AI/Knowledge` 显示它只被
  自己的单测文件引用，`knowledgeStore.js:84`（loadOverview）与本文件
  `percent` 计算都不调用它，`backlogPeak` 完全由 store 内联的
  `Math.max(...)` 维护（T6 已 1:1 照抄这处内联，knowledgeStore.ts:317）。
  本文件因此不直接调用 `updatePeak`，只读取 `store.backlogPeak` 喂给
  `progressPercent`——这是蓝本行为，不是遗漏。
-->
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import KIcon from '../components/KIcon.vue'
import { useKnowledgeStore, fmtAgo } from '../stores/knowledgeStore'
import type { ParserStats } from '../stores/knowledgeStore'
import { progressPercent, fmtEta } from '../util/dashboardHelpers'

const { t } = useI18n()
const router = useRouter()
const store = useKnowledgeStore()

/** 蓝本 :274 SAMPLE_QUERIES —— 字面搜索词换成对应 aiKb 键（附录 A 逐字对照）。 */
const SAMPLE_QUERIES: string[] = [
  'aiKbSampleThyroid',
  'aiKbSamplePythonAsync',
  'aiKbSampleContract',
  'aiKbSampleIphone',
  'aiKbSampleSkating',
]

/** 蓝本 :278-285 LAYER_INTROS —— `name`/`desc` 换成对应 aiKb 键；`tag` 是
 * `k2-tag` 里的固定英文短标（TREE/SEMANTIC/BACKLINKS），蓝本本身不走 $t，
 * 照抄不译（与 `*-en` 同规律）。 */
interface LayerIntro {
  id: 'wiki' | 'vec' | 'note'
  tag: string
  nameKey: string
  descKey: string
}
const LAYER_INTROS: LayerIntro[] = [
  { id: 'wiki', tag: 'TREE', nameKey: 'aiKbWikiMap', descKey: 'aiKbLayerWikiDesc' },
  { id: 'vec', tag: 'SEMANTIC', nameKey: 'aiKbSemanticVectors', descKey: 'aiKbLayerVecDesc' },
  { id: 'note', tag: 'BACKLINKS', nameKey: 'aiKbDistilledNotes', descKey: 'aiKbLayerNoteDesc' },
]

/** 蓝本 :287-291 CC_LEVELS —— `key` 换成对应 aiKb 键。 */
interface CcLevel {
  n: number
  key: string
}
const CC_LEVELS: CcLevel[] = [
  { n: 1, key: 'aiKbCcPowerSaver' },
  { n: 2, key: 'aiKbCcBalanced' },
  { n: 4, key: 'aiKbCcFullSpeed' },
]

interface EntryItem {
  id: string
  en: string
  key: string
  icon: string
  tone?: string
  disabled?: boolean
  badge?: number
  badgeTone?: string
}

/** N2 —— 见文件头注释：本地窄化类型，读三个后端实测不下发的可选字段，
 * 不回改 knowledgeStore.ts。 */
interface DashboardStats extends ParserStats {
  rate_per_min?: number
  done_last_10m?: number
  eta_s?: number
}

const query = ref('')
const ready = ref(false)
const hero = ref<HTMLInputElement | null>(null)

const stats = computed<DashboardStats>(() => store.stats)
/** 【评审 Minor M-1,补申报】蓝本 :308 是 `this.stats.queue_depth || {}`——
 * 兜底成空对象,靠下游每个读取点自己 `.pending || 0` 防御。本仓 `QueueDepth`
 * 的 `pending`/`running`/`failed`/`done` 四个字段在 `knowledgeStore.ts` 里
 * 都是必填(非 optional),`|| {}` 在 strict 模式下类型不满足 `QueueDepth`,
 * 故改成兜底一个全零形状的对象。下游每个读取点仍然各自套了 `|| 0`
 * (与蓝本一致),两种写法在任何输入下行为等价,纯粹是 TS 类型约束下的机械
 * 改写,不改变任何可观察行为。 */
const queueDepth = computed(() => stats.value.queue_depth || { pending: 0, running: 0, failed: 0, done: 0 })
const failed = computed(() => queueDepth.value.failed || 0)
const backlog = computed(() => (queueDepth.value.pending || 0) + (queueDepth.value.running || 0))
/** N2 —— 后端不下发，恒 0。 */
const rate = computed(() => stats.value.rate_per_min || 0)
/** N2 —— 后端不下发，恒 0。 */
const done10m = computed(() => stats.value.done_last_10m || 0)
/** N2 —— 后端不下发，`fmtEta` 空判后恒空串。 */
const etaText = computed(() => fmtEta(stats.value.eta_s))
const percent = computed(() => progressPercent(backlog.value, store.backlogPeak))
const vectorsText = computed(() => stats.value.total_vectors_text || 0)
const vectorsVisual = computed(() => stats.value.total_vectors_visual || 0)
const notesSummary = computed(() => store.notesSummary)
const enabledRoots = computed(() => store.wikiRoots.filter((r) => r.enabled))
const disabledRoots = computed(() => store.wikiRoots.filter((r) => !r.enabled))
const autoRootCount = computed(() => enabledRoots.value.filter((r) => r.watchMode === 'auto').length)
const scanRootCount = computed(() => enabledRoots.value.length - autoRootCount.value)
const loading = computed(() => !ready.value)
const isEmpty = computed(
  () =>
    ready.value &&
    store.overviewLoaded &&
    store.wikiRoots.length === 0 &&
    (stats.value.indexed_files || 0) === 0,
)

/** 蓝本 :328-338 entries()。 */
const entries = computed<EntryItem[]>(() => [
  { id: 'search', en: 'Search', key: 'aiKbSearch', icon: 'search', tone: 'accent' },
  { id: 'wiki', en: 'Wiki', key: 'aiKbWikiMap', icon: 'layers', tone: 'wiki' },
  { id: 'indexed-files', en: 'Indexed Files', key: 'aiKbNavIndexedFiles', icon: 'file', tone: 'vec' },
  {
    id: 'notes',
    en: 'Notes',
    key: 'aiKbNavNotes',
    icon: 'edit',
    tone: 'note',
    badge: notesSummary.value.draft,
    badgeTone: 'note',
  },
  { id: 'roots', en: 'Roots', key: 'aiKbNavRoots', icon: 'drive', tone: 'wiki' },
  { id: 'queue', en: 'Queue', key: 'aiKbNavQueue', icon: 'history', badge: failed.value },
  { id: 'settings', en: 'Settings', key: 'aiKbTitleAdvancedSettings', icon: 'settings' },
])

/** 蓝本 :339-346 emptyEntries()。 */
const emptyEntries = computed<EntryItem[]>(() => [
  { id: 'search', en: 'Search', key: 'aiKbSearch', icon: 'search', tone: 'accent', disabled: true },
  { id: 'roots', en: 'Roots', key: 'aiKbNavRoots', icon: 'drive', tone: 'wiki' },
  { id: 'allowlist', en: 'Allowlist', key: 'aiKbNavAllowlist', icon: 'folder' },
  { id: 'settings', en: 'Settings', key: 'aiKbTitleAdvancedSettings', icon: 'settings' },
])

function fmtNum(n: number | undefined): string {
  return (n || 0).toLocaleString()
}

function submit(): void {
  if (!query.value.trim()) return
  goSearch(query.value.trim())
}

function goSearch(q: string): void {
  router.push({ path: '/ai/knowledge/search', query: { q } })
}

function goQueueFailed(): void {
  router.push({ path: '/ai/knowledge/queue', query: { filter: 'failed' } })
}

function go(id: string): void {
  router.push(id === 'dashboard' ? '/ai/knowledge' : `/ai/knowledge/${id}`)
}

/** 蓝本 :348-352 created() —— N3，见文件头注释，照抄不改。 */
onMounted(() => {
  Promise.all([store.loadOverview(), store.loadRoots(), store.loadNotesSummary()]).finally(() => {
    ready.value = true
  })
})
</script>

<template>
  <div class="k-scroll">
    <div class="k-scroll-inner">
      <!-- ============ Empty state（新装：0 根、0 文档）============ -->
      <template v-if="isEmpty">
        <div class="k2-onboard">
          <div class="k2-onboard-orb"><KIcon name="layers" :size="26" /></div>
          <h2>{{ t('aiKbOnboardTitle') }}</h2>
          <p>{{ t('aiKbOnboardBody') }}</p>
          <div class="k2-onboard-cta">
            <button class="k-btn primary" @click="go('roots')">
              <KIcon name="plus" :size="13" /> {{ t('aiKbAddRoot') }}
            </button>
            <button class="k-btn outline" @click="go('allowlist')">{{ t('aiKbCheckScopeFirst') }}</button>
          </div>
          <div class="k2-onboard-layers">
            <div v-for="l in LAYER_INTROS" :key="l.id" class="k2-ob-layer" :data-layer="l.id">
              <span class="k2-tag">{{ l.tag }}</span>
              <div class="k2-ob-name">{{ t(l.nameKey) }}</div>
              <div class="k2-ob-desc">{{ t(l.descKey) }}</div>
            </div>
          </div>
        </div>

        <div class="k2-sec-head">
          <span class="k2-sec-title">{{ t('aiKbGoDeeper') }}</span>
          <span class="k2-sec-en">Go to</span>
        </div>
        <div class="k2-entries">
          <button
            v-for="e in emptyEntries"
            :key="e.en"
            class="k2-entry"
            :data-disabled="String(!!e.disabled)"
            @click="!e.disabled && go(e.id)"
          >
            <span class="k2-entry-ico" :data-tone="e.tone"><KIcon :name="e.icon" :size="15" /></span>
            <span style="min-width: 0">
              <span class="k2-entry-cn">{{ t(e.key) }}</span
              ><br />
              <span class="k2-entry-en">{{ e.en }}</span>
            </span>
          </button>
        </div>
      </template>

      <!-- ============ Normal / loading ============ -->
      <template v-else>
        <!-- Search（surface D，前置）-->
        <div class="k2-search">
          <KIcon name="search" :size="17" color="var(--text-tertiary)" />
          <input
            ref="hero"
            type="text"
            :placeholder="t('aiKbSearchPlaceholder')"
            v-model="query"
            @keydown.enter="submit"
            autofocus
          />
          <span class="k2-search-dots" :title="t('aiKbThreeLayersTip')"><i /><i /><i /></span>
          <button class="k-btn primary" :disabled="!query.trim()" @click="submit">
            {{ t('aiKbSearch') }} <KIcon name="arrowRight" :size="12" />
          </button>
        </div>
        <div class="k2-suggest">
          <span class="k2-suggest-label">{{ t('aiKbTry') }}</span>
          <button v-for="q in SAMPLE_QUERIES" :key="q" class="k-suggest-chip" @click="goSearch(t(q))">
            {{ t(q) }}
          </button>
        </div>

        <!-- Surface A — what's inside（三层）-->
        <div class="k2-sec-head">
          <span class="k2-sec-title">{{ t('aiKbWhatsInside') }}</span>
          <span class="k2-sec-en">What's inside</span>
        </div>
        <div v-if="loading" class="k2-layers">
          <div v-for="i in 3" :key="i" class="k2-skel-card">
            <span class="k-skel" style="display: block; height: 14px; width: 55%" />
            <span class="k-skel" style="display: block; height: 24px; width: 40%" />
            <span class="k-skel" style="display: block; height: 11px; width: 80%" />
          </div>
        </div>
        <template v-else>
          <div class="k2-layers">
            <!-- Wiki layer -->
            <button class="k2-layer" data-layer="wiki" @click="go('wiki')">
              <div class="k2-layer-top">
                <span class="k2-tag">TREE</span>
                <span class="k2-layer-name"
                  >{{ t('aiKbWikiMap') }} <span class="k2-layer-name-en">· Wiki</span></span
                >
                <span class="k2-layer-chev"><KIcon name="chev" :size="13" /></span>
              </div>
              <div class="k2-layer-num">
                {{ enabledRoots.length }}<span class="suffix">{{ t('aiKbKnowledgeRootsSuffix') }}</span>
              </div>
              <div v-if="enabledRoots.length" class="k2-layer-bar">
                <i :style="{ flex: autoRootCount, opacity: 1 }" />
                <i :style="{ flex: Math.max(scanRootCount, 0.001), opacity: 0.35 }" />
              </div>
              <div class="k2-layer-sub">
                {{ t('aiKbWatchSplit', { a: autoRootCount, b: scanRootCount }) }}
              </div>
              <div class="k2-layer-desc">{{ t(LAYER_INTROS[0].descKey) }}</div>
            </button>
            <!-- Vector layer -->
            <button class="k2-layer" data-layer="vec" @click="go('indexed-files')">
              <div class="k2-layer-top">
                <span class="k2-tag">SEMANTIC</span>
                <span class="k2-layer-name"
                  >{{ t('aiKbSemanticVectors') }} <span class="k2-layer-name-en">· Vectors</span></span
                >
                <span class="k2-layer-chev"><KIcon name="chev" :size="13" /></span>
              </div>
              <div class="k2-layer-num">
                {{ fmtNum(stats.indexed_files) }}<span class="suffix">{{ t('aiKbDocumentsSuffix') }}</span>
                <span class="second">{{ t('aiKbVectorChunks', { n: fmtNum(vectorsText) }) }}</span>
              </div>
              <div v-if="vectorsText + vectorsVisual > 0" class="k2-layer-bar">
                <i :style="{ flex: vectorsText, opacity: 1 }" />
                <i :style="{ flex: Math.max(vectorsVisual * 8, 0.001), opacity: 0.35 }" />
              </div>
              <div class="k2-layer-sub">
                {{ t('aiKbVectorSplit', { t: fmtNum(vectorsText), v: fmtNum(vectorsVisual) }) }}
              </div>
              <div class="k2-layer-desc">{{ t(LAYER_INTROS[1].descKey) }}</div>
            </button>
            <!-- Notes layer -->
            <button class="k2-layer" data-layer="note" @click="go('notes')">
              <div class="k2-layer-top">
                <span class="k2-tag">BACKLINKS</span>
                <span class="k2-layer-name"
                  >{{ t('aiKbDistilledNotes') }} <span class="k2-layer-name-en">· Notes</span></span
                >
                <span class="k2-layer-chev"><KIcon name="chev" :size="13" /></span>
              </div>
              <div class="k2-layer-num">
                {{ notesSummary.total }}<span class="suffix">{{ t('aiKbNotesSuffix') }}</span>
                <span v-if="notesSummary.draft > 0" class="k2-drafts">{{
                  t('aiKbToConfirm', { n: notesSummary.draft })
                }}</span>
              </div>
              <div v-if="notesSummary.total > 0" class="k2-layer-bar">
                <i :style="{ flex: Math.max(notesSummary.curated, 0.001), opacity: 1 }" />
                <i :style="{ flex: Math.max(notesSummary.draft, 0.001), opacity: 0.55 }" />
                <i :style="{ flex: Math.max(notesSummary.archived, 0.001), opacity: 0.22 }" />
              </div>
              <div class="k2-layer-sub">
                {{
                  t('aiKbNotesSplit', {
                    c: notesSummary.curated,
                    d: notesSummary.draft,
                    a: notesSummary.archived,
                  })
                }}
              </div>
              <div class="k2-layer-desc">{{ t(LAYER_INTROS[2].descKey) }}</div>
            </button>
          </div>
          <div class="k2-glue">
            {{ t('aiKbGlueTitle') }}
            <span class="k2-glue-id" style="--g: var(--ly-vec)"
              ><i /><code>file_id</code> {{ t('aiKbGlueFileId') }}</span
            >
            <span class="k2-glue-id" style="--g: var(--ly-wiki)"
              ><i /><code>root_id</code> {{ t('aiKbGlueRootId') }}</span
            >
            <span class="k2-glue-id" style="--g: var(--ly-note)"
              ><i /><code>session_id</code> {{ t('aiKbGlueSessionId') }}</span
            >
          </div>
        </template>

        <!-- Surface B — knowledge roots -->
        <div class="k2-sec-head">
          <span class="k2-sec-title">{{ t('aiKbHowOrganized') }}</span>
          <span class="k2-sec-en">Knowledge roots</span>
          <button class="k2-sec-link" @click="go('roots')">{{ t('aiKbManageRoots') }} →</button>
        </div>
        <div v-if="loading" class="k2-roots">
          <div v-for="i in 3" :key="i" class="k2-skel-card">
            <span class="k-skel" style="display: block; height: 14px; width: 55%" />
            <span class="k-skel" style="display: block; height: 24px; width: 40%" />
          </div>
        </div>
        <template v-else>
          <div class="k2-roots">
            <button v-for="r in enabledRoots" :key="r.id" class="k2-root" @click="go('roots')">
              <div class="k2-root-top">
                <span class="k2-root-ico"><KIcon :name="r.level === 'space' ? 'drive' : 'folder'" :size="14" /></span>
                <span class="k2-root-path" :title="r.path">&lrm;{{ r.path }}</span>
                <span class="k2-root-level">{{ r.level === 'space' ? t('aiKbLevelSpace') : t('aiKbLevelProject') }}</span>
              </div>
              <div class="k2-root-badges">
                <span v-if="r.watchMode === 'auto'" class="k2-chip" data-tone="live"
                  ><i />{{ t('aiKbRealtimeWatch') }}</span
                >
                <span v-else class="k2-chip"><i />{{ t('aiKbScheduledScanOnly') }}</span>
                <span v-if="r.needsReconcile" class="k2-chip" data-tone="warn"><i />{{ t('aiKbReconciling') }}</span>
              </div>
              <div class="k2-root-meta">
                <KIcon name="clock" :size="11" />
                {{ t('aiKbLastScan') }} {{ r.lastScanAt ? fmtAgo(r.lastScanAt) : t('aiKbNever') }}
              </div>
            </button>
            <button class="k2-root-add" @click="go('roots')">
              <KIcon name="plus" :size="16" /> {{ t('aiKbAddRoot') }}
            </button>
          </div>
          <div v-if="disabledRoots.length" class="k2-roots-off">
            <KIcon name="eye" :size="12" />
            {{ t('aiKbDisabledRoots', { n: disabledRoots.length }) }}
            <code v-for="r in disabledRoots" :key="r.id">{{ r.path }}</code>
            <button @click="go('roots')">{{ t('aiKbRestoreInRootMgmt') }} →</button>
          </div>
        </template>

        <!-- Surface C — live status -->
        <div class="k2-sec-head">
          <span class="k2-sec-title">{{ t('aiKbWhatsHappening') }}</span>
          <span class="k2-sec-en">Live</span>
        </div>
        <div v-if="loading" class="k2-skel-card">
          <span class="k-skel" style="display: block; height: 16px; width: 45%" />
          <span class="k-skel" style="display: block; height: 10px; width: 90%" />
        </div>
        <div v-else class="k2-live">
          <div class="k2-live-top">
            <template v-if="backlog > 0">
              <span class="k2-live-ico"
                ><span class="spin"><KIcon name="spinner" :size="16" /></span
              ></span>
              <div>
                <div class="k2-live-title">{{ t('aiKbIndexingNFiles', { n: fmtNum(backlog) }) }}</div>
                <div class="k2-live-sub">
                  <template v-if="rate > 0"
                    >{{ rate.toFixed(1) }} {{ t('aiKbFilesPerMin') }}<template v-if="etaText">
                      · {{ t('aiKbEta') }} {{ etaText }}</template
                    ></template
                  >
                  <template v-else>{{
                    store.controlState.paused ? t('aiKbPaused') : t('aiKbWaitingForParser')
                  }}</template>
                </div>
              </div>
              <div class="k2-prog"><i :style="{ width: percent + '%' }" /></div>
              <span class="k2-prog-pct">{{ percent }}%</span>
            </template>
            <template v-else>
              <span class="k2-live-ico" data-ok="true"><KIcon name="check" :size="16" /></span>
              <div>
                <div class="k2-live-title">{{ t('aiKbAllSynced') }}</div>
                <div class="k2-live-sub">
                  {{ t('aiKbLastSynced') }} {{ store.lastSyncFmt }} ·
                  {{ t('aiKbDoneLast10m', { n: done10m }) }}
                </div>
              </div>
            </template>
          </div>
          <div class="k2-live-grid">
            <div class="k2-live-cell">
              <div class="k2-cell-label">{{ t('aiKbThrottle') }}</div>
              <span v-if="store.controlState.paused" class="k2-paused-note">
                <KIcon name="pause" :size="11" /> {{ t('aiKbAutoIndexPaused') }}
              </span>
              <span v-else class="k2-cc" :title="t('aiKbAdjustInAdvanced')">
                <button
                  v-for="c in CC_LEVELS"
                  :key="c.n"
                  :data-on="String(store.controlState.concurrency === c.n)"
                  @click="go('settings')"
                >
                  {{ t(c.key) }}
                </button>
              </span>
            </div>
            <div class="k2-live-cell">
              <div class="k2-cell-label">{{ t('aiKbQueueHealth') }}</div>
              <div class="k2-qrow">
                <span class="k2-qchip"><b>{{ queueDepth.pending || 0 }}</b> {{ t('aiKbPending') }}</span>
                <span class="k2-qchip"><b>{{ queueDepth.running || 0 }}</b> {{ t('aiKbRunning') }}</span>
                <button v-if="failed > 0" class="k2-qchip" data-tone="danger" @click="goQueueFailed">
                  <b>{{ failed }}</b> {{ t('aiKbFailed') }} →
                </button>
                <span v-else class="k2-qchip"><b>0</b> {{ t('aiKbFailed') }}</span>
              </div>
            </div>
            <div class="k2-live-cell">
              <div class="k2-cell-label">{{ t('aiKbAutoDistill') }}</div>
              <template v-if="notesSummary.draft > 0">
                <button class="k2-distill" @click="go('notes')">
                  <KIcon name="sparkle" :size="13" />
                  {{ t('aiKbDistilledRecently', { n: notesSummary.draft }) }} →
                </button>
                <div class="k2-distill-sub">{{ t('aiKbDistillFromChats') }}</div>
              </template>
              <div v-else class="k2-distill-sub">{{ t('aiKbNoNewInsights') }}</div>
            </div>
          </div>
        </div>

        <!-- Surface D — entries -->
        <template v-if="!loading">
          <div class="k2-sec-head">
            <span class="k2-sec-title">{{ t('aiKbGoDeeper') }}</span>
            <span class="k2-sec-en">Go deeper</span>
          </div>
          <div class="k2-entries">
            <button v-for="e in entries" :key="e.en" class="k2-entry" @click="go(e.id)">
              <span class="k2-entry-ico" :data-tone="e.tone"><KIcon :name="e.icon" :size="15" /></span>
              <span style="min-width: 0">
                <span class="k2-entry-cn">{{ t(e.key) }}</span
                ><br />
                <span class="k2-entry-en">{{ e.en }}</span>
              </span>
              <!-- 【终审 Minor-2,补申报】蓝本 :361 是 `v-if="e.badge > 0"`。
                   本仓 `EntryItem.badge` 是 optional 字段,strict 模式下不能对
                   `undefined` 直接 `> 0` 比较,故写成 `(e.badge || 0) > 0`——
                   与 :128-134 已申报的 M-1(`queueDepth` 兜底)同一类:TS 类型
                   约束逼出的机械改写,任何输入下行为等价(`undefined > 0` 与
                   `(undefined || 0) > 0` 都是 false),不是未申报的行为改动。 -->
              <span v-if="(e.badge || 0) > 0" class="k2-entry-badge" :data-tone="e.badgeTone">{{
                e.badge
              }}</span>
            </button>
          </div>
        </template>
      </template>
    </div>
  </div>
</template>
