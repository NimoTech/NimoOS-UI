<!--
  SP8-P5a Task 10 —— 知识库区外壳,1:1 移植自 Vue2 蓝本
  `NimoOS-UI` (main@7a6ee6b7) `src/views/AI/Knowledge/KnowledgeLayout.vue`(210 行,
  `git show main:` 读取,治理文件 §1:工作树是旧分支不可信)。

  结构对照(蓝本行号 → 本文件):
    :2-45   .knowledge-app > aside.k-rail(head/section/nav 9 项/状态块/foot)
    :47-71  .k-main(topbar/banner/router-view)
    :73-85  .k-mobile-tabs(前 4 项 + More)
    :87-91  .k-toast —— 不移植(K3),toast() 走全局 useToast().show()
    :99-108 NAV / :110-120 TITLES —— 逐字照抄的两个常量
    :141-146 currentTab 的 if/endsWith 不对称判据 —— 照抄(蓝本如此)
    :176-181 userName —— 蓝本读 Vuex,本仓无 Vuex,改走 K8 既定写法
             (照 src/ai/components/settings/SettingsRail.vue:75-86 逐字复用)
    :183-190 created()/beforeDestroy() 的 10s 轮询 —— 迁到 onMounted/onUnmounted

  i18n 键名适配(纯机械,非行为变化):蓝本 `$t(n.en)`/`$t(titleKey)` 直接拿字面英文
  短语当 key(Vue2 语言包以短语为 key)。本仓新键一律 `aiKb*` 前缀(附录 A),
  所以每个 NAV 项与 TITLES 项都多带一个 `*Key` 字段指向对应的 aiKb 键，
  翻译结果与蓝本逐一对应（见下方 NAV/TITLES 常量旁注）。

  【N8 照抄不改】rail 第 9 项标签用 aiKbNavSettings(“系统设置”)，topbar 标题
  用 aiKbTitleAdvancedSettings(“高级设置”)——同一页面两处不同措辞，蓝本如此。

  【K2】根节点 class 只有 knowledge-app，不带 data-theme —— .knowledge-app
  跟随全局 <html> 的 data-theme（knowledge.scss 里已用
  :root[data-theme="light"] .knowledge-app 选择器兜浅色档），不像 .agent-app
  那样自己维护容器态。

  零 <style> 块：knowledge.scss 由本文件在 <script setup> 里 JS 侧 import
  （照 src/ai/views/AgentPage.vue:71-72 的既有先例），这是全仓第一处 import
  它的地方——KnowledgeDeferred.vue（T5）特意没 import，留给本任务。
-->
<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import KIcon from '../components/KIcon.vue'
import { useKnowledgeStore } from '../stores/knowledgeStore'
import type { KnowledgeTabId } from '../deferred'
import '../../styles/knowledge.scss'

interface NavItem {
  id: KnowledgeTabId
  en: string
  icon: string
  /** aiKb* 键，翻译结果 = 蓝本 `$t(n.en)` 的结果（K1 同类机械改名，非行为变化）。 */
  labelKey: string
}

/** 蓝本 :99-108，逐字照抄（顺序即 rail 顺序，也是移动端 tabs `slice(0, 4)` 的依据）。 */
const NAV: NavItem[] = [
  { id: 'dashboard', en: 'Dashboard', icon: 'home', labelKey: 'aiKbNavDashboard' },
  { id: 'search', en: 'Search', icon: 'search', labelKey: 'aiKbNavSearch' },
  { id: 'wiki', en: 'Wiki', icon: 'layers', labelKey: 'aiKbNavWiki' },
  { id: 'notes', en: 'Notes', icon: 'edit', labelKey: 'aiKbNavNotes' },
  { id: 'indexed-files', en: 'Indexed Files', icon: 'file', labelKey: 'aiKbNavIndexedFiles' },
  { id: 'queue', en: 'Queue', icon: 'history', labelKey: 'aiKbNavQueue' },
  { id: 'roots', en: 'Index Roots', icon: 'drive', labelKey: 'aiKbNavRoots' },
  { id: 'allowlist', en: 'Allowlist', icon: 'folder', labelKey: 'aiKbNavAllowlist' },
  { id: 'settings', en: 'Settings', icon: 'settings', labelKey: 'aiKbNavSettings' },
]

interface TitleEntry {
  /** topbar 副标题的字面英文（不翻译，蓝本 `{{ titles[currentTab].en }}`）。 */
  en: string
  /** topbar 标题的 aiKb 键。多数 tab 与该 tab 的 NAV labelKey 是同一个键
   * （蓝本对同一英文短语调用同一次 $t，翻译结果自然相同）；wiki/queue/settings
   * 三个 tab 蓝本用了不同的英文短语（'Wiki map'/'Job Queue'/'Advanced Settings'），
   * 对应附录 A 专门给的 aiKbTitleWikiMap/aiKbTitleJobQueue/aiKbTitleAdvancedSettings
   * 三个键——这正是 N8 的落点（settings 的 titleKey 与 labelKey 不同）。 */
  titleKey: string
}

/** 蓝本 :110-120,逐字照抄(en 字段照抄字面英文,titleKey 按上面注释换算成 aiKb 键)。 */
const TITLES: Record<KnowledgeTabId, TitleEntry> = {
  dashboard: { en: 'Dashboard', titleKey: 'aiKbNavDashboard' },
  search: { en: 'Search', titleKey: 'aiKbNavSearch' },
  wiki: { en: 'Wiki', titleKey: 'aiKbTitleWikiMap' },
  'indexed-files': { en: 'Indexed Files', titleKey: 'aiKbNavIndexedFiles' },
  queue: { en: 'Job Queue', titleKey: 'aiKbTitleJobQueue' },
  roots: { en: 'Index Roots', titleKey: 'aiKbNavRoots' },
  allowlist: { en: 'Allowlist', titleKey: 'aiKbNavAllowlist' },
  notes: { en: 'Notes', titleKey: 'aiKbNavNotes' },
  settings: { en: 'Advanced Settings', titleKey: 'aiKbTitleAdvancedSettings' },
}

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const store = useKnowledgeStore()

/** 蓝本 :141-153 —— if/endsWith 不对称判据，照抄这个不对称（notes 用
 * `.includes`，其余用 `.endsWith`；蓝本如此，不做「统一成一种写法」的顺手重构）。 */
const currentTab = computed<KnowledgeTabId>(() => {
  const p = route.path
  if (p.includes('/knowledge/notes')) return 'notes'
  if (p.endsWith('/wiki')) return 'wiki'
  if (p.endsWith('/search')) return 'search'
  if (p.endsWith('/indexed-files')) return 'indexed-files'
  if (p.endsWith('/queue')) return 'queue'
  if (p.endsWith('/roots')) return 'roots'
  if (p.endsWith('/allowlist')) return 'allowlist'
  if (p.endsWith('/settings')) return 'settings'
  return 'dashboard'
})

/** 蓝本 :154-156。 */
const currentNav = computed<NavItem>(() => NAV.find((n) => n.id === currentTab.value) || NAV[0])

/** 蓝本 :157-161。 */
const svcState = computed<'error' | 'paused' | 'running'>(() => {
  if (store.unreachable) return 'error'
  if (store.controlState.paused) return 'paused'
  return 'running'
})

/** 蓝本 :162-167。 */
const svcMeta = computed<string>(() => {
  if (store.unreachable) return t('aiKbOffline')
  if (store.controlState.paused) return t('aiKbPaused')
  return t('aiKbRunningIndexed', { n: store.stats.indexed_files.toLocaleString() })
})

interface Badge {
  kind: 'number' | 'dot'
  value?: number
  tone?: string
}

/** 蓝本 :168-175 —— `allowlist`/`settings` 恒为 null（蓝本 :173 那行
 * `this.store.state.folderRules.length > 0 ? null : null` 两支结果相同，
 * 是蓝本的死代码而非可复现的错误行为，照抄不当「顺手清理」）。 */
const badges = computed<Partial<Record<KnowledgeTabId, Badge | null>>>(() => {
  const failed = store.stats.queue_depth.failed
  const drafts = store.notesDraftCount
  return {
    queue: failed > 0 ? { kind: 'number', value: failed } : null,
    notes: drafts > 0 ? { kind: 'number', value: drafts, tone: 'warn' } : null,
    allowlist: store.folderRules.length > 0 ? null : null,
    settings: null,
  }
})

interface StoredUser {
  nickname?: string
  username?: string
  role?: string
}

/** K8 —— 蓝本 :176-181 读 Vuex `$store.state.user.user_name`，本仓无 Vuex。
 * 逐字复用 SettingsRail.vue:75-86 的既定写法：localStorage 'user' 键 +
 * try/catch 兜 {} + nickname 优先于 username，最终回落 aiCfgYou（复用既有键，
 * 不新增）。 */
const storedUser = computed<StoredUser>(() => {
  try {
    const raw = localStorage.getItem('user')
    return raw ? (JSON.parse(raw) as StoredUser) : {}
  } catch {
    return {}
  }
})
const userLabel = computed<string>(
  () => storedUser.value.nickname || storedUser.value.username || t('aiCfgYou'),
)

/** 蓝本 :191-194。 */
function navigate(id: KnowledgeTabId): void {
  const path = id === 'dashboard' ? '/ai/knowledge' : `/ai/knowledge/${id}`
  if (route.path !== path) router.push(path)
}

/** 蓝本 :195-198。 */
async function onRefresh(): Promise<void> {
  await store.loadOverview()
  store.toast(t('aiKbRefreshed'))
}

/** 蓝本 :183-190 —— created()/pollTimer 迁到 onMounted，句柄用组件局部
 * 变量（不进 store，纯 UI 生命周期状态）。 */
let pollTimer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  store.loadOverview()
  store.refreshNotesDraftCount()
  pollTimer = setInterval(() => {
    if (document.hidden) return
    store.loadOverview()
  }, 10000)
})

/** 蓝本 :189-190 beforeDestroy()。 */
onUnmounted(() => {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
})
</script>

<template>
  <div class="knowledge-app">
    <!-- Left rail -->
    <aside class="k-rail">
      <div class="k-rail-head">
        <div style="flex: 1; min-width: 0">
          <div class="k-rail-title">{{ t('aiKbKnowledgeBase') }}</div>
          <div class="k-rail-sub">RAG · NimoOS</div>
        </div>
      </div>

      <div class="k-rail-section">{{ t('aiKbBrowse') }}</div>
      <nav class="k-rail-nav">
        <a
          v-for="n in NAV"
          :key="n.id"
          class="k-rail-item"
          :data-active="String(currentTab === n.id)"
          :href="`#${n.id === 'dashboard' ? '/ai/knowledge' : '/ai/knowledge/' + n.id}`"
          @click.prevent="navigate(n.id)"
        >
          <KIcon :name="n.icon" :size="15" />
          <div class="k-rail-item-label">
            <span class="k-rail-item-cn">{{ t(n.labelKey) }}</span>
            <span class="k-rail-item-en">{{ n.en }}</span>
          </div>
          <span
            v-if="badges[n.id] && badges[n.id]!.kind === 'number'"
            class="k-badge"
            :data-tone="badges[n.id]!.tone"
          >{{ badges[n.id]!.value }}</span>
          <span
            v-else-if="badges[n.id] && badges[n.id]!.kind === 'dot'"
            class="k-badge-dot"
            :data-tone="badges[n.id]!.tone"
          />
        </a>
      </nav>

      <div class="k-rail-section" style="margin-top: 8px">{{ t('aiKbStatus') }}</div>
      <div class="k-rail-svc">
        <div class="k-rail-svc-row">
          <span class="k-rail-svc-dot" :data-state="svcState" />
          <div class="k-rail-svc-name">{{ t('aiKbIndexer') }}</div>
        </div>
        <div class="k-rail-svc-meta">{{ svcMeta }}</div>
        <div class="k-rail-svc-meta" style="display: flex; align-items: center; gap: 6px">
          <KIcon name="clock" :size="11" /> {{ t('aiKbLastSynced') }} {{ store.lastSyncFmt }}
        </div>
      </div>

      <div class="k-rail-foot">
        <KIcon name="user" :size="13" />
        <span>NimoOS · {{ userLabel }}</span>
      </div>
    </aside>

    <!-- Main pane -->
    <div class="k-main">
      <header class="k-topbar">
        <KIcon :name="currentNav.icon" :size="18" color="var(--accent)" />
        <div>
          <div class="k-topbar-title">{{ t(TITLES[currentTab].titleKey) }}</div>
          <div class="k-topbar-sub">
            {{ TITLES[currentTab].en }} · /ai/knowledge{{ currentTab === 'dashboard' ? '' : '/' + currentTab }}
          </div>
        </div>
        <div class="k-topbar-spacer" />
        <button class="k-btn ghost" :title="t('aiKbRefresh')" @click="onRefresh">
          <KIcon name="refresh" :size="14" />
        </button>
      </header>

      <!-- Banner: service unreachable -->
      <div v-if="store.unreachable" class="k-banner" data-tone="warn">
        <span class="k-banner-icon"><KIcon name="info" :size="13" /></span>
        <span>{{ t('aiKbServiceOfflineBanner') }}</span>
      </div>

      <router-view />
    </div>

    <!-- Mobile tabs -->
    <nav class="k-mobile-tabs">
      <button
        v-for="n in NAV.slice(0, 4)"
        :key="n.id"
        class="k-mobile-tab"
        :data-active="String(currentTab === n.id)"
        @click="navigate(n.id)"
      >
        <KIcon :name="n.icon" :size="18" />
        <span>{{ t(n.labelKey) }}</span>
        <span v-if="badges[n.id] && badges[n.id]!.kind === 'number'" class="k-badge">{{ badges[n.id]!.value }}</span>
      </button>
      <button
        class="k-mobile-tab"
        :data-active="String(['indexed-files', 'queue', 'roots', 'allowlist', 'settings'].includes(currentTab))"
        @click="navigate('allowlist')"
      >
        <KIcon name="grid" :size="18" />
        <span>{{ t('aiKbMore') }}</span>
      </button>
    </nav>

    <!-- Toast: retired (K3) — global useToast() renders it via AppToast, not here. -->
  </div>
</template>
