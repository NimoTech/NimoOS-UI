<!--
  SP8-P2a Task 8 —— 1:1 移植自 Vue2 `src/views/AI/Settings/Settings.vue`(243 行)。
  设置区页面壳:左 SettingsRail + 右状态灯顶栏 + 两种内容渲染模式(竖排/单换)+
  scroll-spy + `?section=` 深链。

  【根元素】同时带 `agent-app`(token 作用域,见 settings-styles.scss 头注释)
  与 `set-app`(布局)两个 class —— 本仓 `tokens.scss` 只在 `.agent-app` 作用域
  定义 token,`.set-app` 只管网格布局,少一个就没颜色或没布局。

  【与 Vue2 的差异,均按移植纪律申报】

  D1(架构差异,任务 4 已解决)—— 主题不再是本组件私有 state,委托给应用级
  `useAiTheme()`(Agent 页与设置页共享同一份,同一个 localStorage key)。

  D2(架构差异,任务 5 + 本任务)—— Vue2 `Settings.vue:100-111` 每次挂载
  `createSettingsStore()` 新建 state,所以 activeSection 恒从 'models' 起、
  表单恒收起、HF 搜索结果恒为空。Pinia 单例会把上次离开时的状态带回来,故
  `onMounted` 必须**先调用 `store.resetTransientUi()`,再读 `?section=`**——
  顺序颠倒会让深链被复位冲掉(brief 用例 13,Step 8 有专门的 RED 验证)。

  D3(申报,见下方恢复循环上方的完整注释)—— Vue2 的下载恢复循环因为
  `createSettingsStore()` 每次新建而从未真正执行过;Pinia 单例下第一次有了
  意义。`&& !job._timer` 守卫逐字保留。

  【新增,非 Vue2 蓝本】
  - 顶栏「详情」原为 `<router-link to="/ai/knowledge">`(Settings.vue:22-24)。
    `/ai/knowledge` 要到 SP8-P5 才存在,`router.push` 到不存在的路由会落空白
    死页 —— 改成 `<button>` + info toast 占位,样式类名 `.set-detail-link`
    保持不变(视觉 1:1),仅交互目标变了。
  - 选中 `mcp`(`DEFERRED_SECTIONS`)时弹一条 info toast —— Vue2 没有这个概念
    (它本就是真组件),本仓这个分区的真实现要等 SP8-P4,这里只是本阶段的范围
    提示,不是对 Vue2 行为的偏离。`skills` 已于 SP8-P3a 接入真组件
    `SkillsSection`,不再弹这条 toast。
-->
<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import type { Component } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '../stores/settingsStore'
import { useAiTheme } from '../stores/aiTheme'
import { useToast } from '../../stores/toast'
import SettingsRail from '../components/settings/SettingsRail.vue'
import SectionPlaceholder from '../components/settings/SectionPlaceholder.vue'
import ModelsSection from '../components/settings/sections/ModelsSection.vue'
import ProvidersSection from '../components/settings/sections/ProvidersSection.vue'
import PrivacySection from '../components/settings/sections/PrivacySection.vue'
import ThinkingDefaultsSection from '../components/settings/sections/ThinkingDefaultsSection.vue'
import BlacklistSection from '../components/settings/sections/BlacklistSection.vue'
import ExecutionSection from '../components/settings/sections/ExecutionSection.vue'
import SearchSection from '../components/settings/sections/SearchSection.vue'
import MemorySection from '../components/settings/sections/MemorySection.vue'
import ObservabilitySection from '../components/settings/sections/ObservabilitySection.vue'
import SkillsSection from '../components/settings/sections/SkillsSection.vue'
import McpTokensSection from '../components/settings/sections/McpTokensSection.vue'
import ChannelsSection from '../components/settings/sections/ChannelsSection.vue'
import AgentIcon from '../components/icons/AgentIcon.vue'
import {
  ALL_ITEMS,
  DEFERRED_SECTIONS,
  SPLIT_SECTIONS,
  VALID_SECTIONS,
  groupOf,
  type SectionId,
} from '../components/settings/sections'
import '../styles/tokens.scss'
import '../styles/sk-shared.scss'
import '../styles/settings-styles.scss'
import '../styles/skills-styles.scss'
import '../styles/mcp-styles.scss'

// SP8-P2a —— section id → 组件。必须与 sections.ts 的 id、以及 `?section=`
// 深链契约三方同步(Vue2 Settings.vue:75-90 同款约定)。
//
// SP8-P2b 收官接线后曾只剩 skills / mcp 两个仍渲染 SectionPlaceholder;
// SP8-P3a 把 skills 接上真组件 SkillsSection 后,现在只剩 mcp 一个仍渲染
// SectionPlaceholder(留给 P4)。其余 12 个(models/providers/privacy/thinking
// 为 P2a 已接;blacklist/execution/search/memory/observability/mcptokens/
// channels 为 P2b 已接;skills 为本任务 P3a 已接)均已指向各自的真组件。
//
// SP8-P2b Task 14 修复轮 1 —— 不 export 这个常量:`<script setup>` 不允许 ES
// module 具名导出(试过,编译直接报错),而协调者裁定"可测试性"不值得为此拆
// 出额外的 `<script>` 块(公开面收窄)。收口守卫测试改成断言渲染结果(是否
// 渗出占位文案),不再需要拿到这个常量本身。
const SECTION_COMPONENTS: Record<SectionId, Component> = {
  models: ModelsSection, // Task 9 —— 已替换
  providers: ProvidersSection, // Task 10 —— 已替换
  privacy: PrivacySection, // Task 11 —— 已替换
  thinking: ThinkingDefaultsSection, // Task 11 —— 已替换
  blacklist: BlacklistSection, // SP8-P2b Task 4 —— 已实现,收官接线
  execution: ExecutionSection, // SP8-P2b Task 5 —— 已实现,收官接线
  search: SearchSection, // SP8-P2b Task 7 —— 已实现,收官接线
  memory: MemorySection, // SP8-P2b Task 6 —— 已实现,收官接线
  observability: ObservabilitySection, // SP8-P2b Task 8 —— 已实现,收官接线
  skills: SkillsSection, // SP8-P3a Task 7 —— 已实现,收官接线
  mcp: SectionPlaceholder, // SP8-P4 才实现,保持占位
  mcptokens: McpTokensSection, // SP8-P2b Task 10 —— 已实现,收官接线
  channels: ChannelsSection, // SP8-P2b Task 12 —— 已实现,收官接线
}

// 非 Vue2 蓝本 —— SectionPlaceholder 需要 { titleKey, bodyKey } 两个 prop,而
// Vue2 的 SECTION_COMPONENTS 只是纯 id→组件映射、渲染处不传任何 prop
// (Settings.vue:40/45)。给非占位组件传这两个多余 prop 无害(已换上真组件的
// 12 个分区里,这两个 prop 会变成未声明的 fallthrough attrs,不影响功能),
// 占位场景(现仅 mcp)下用来源分区自己的导航文案(sections.ts 的
// labelKey)作标题,统一的 `aiCfgPlaceholderBody` 作说明文字。
function placeholderProps(id: SectionId): Record<string, string> {
  if (SECTION_COMPONENTS[id] !== SectionPlaceholder) return {}
  const item = ALL_ITEMS.find((i) => i.id === id)
  return { titleKey: item ? item.labelKey : '', bodyKey: 'aiCfgPlaceholderBody' }
}

const store = useSettingsStore()
const aiTheme = useAiTheme()
const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const toast = useToast()

const bodyEl = ref<HTMLDivElement | null>(null)
// v-for 的模板 ref 集合(Vue2 `:ref="'sec-' + item.id"` 的 Vue3 等价写法)。
// 纯记账用,不需要响应式。
const sectionEls: Record<string, HTMLElement | null> = {}
function setSectionEl(id: string, el: Element | null) {
  sectionEls[id] = el as HTMLElement | null
}

const activeGroup = computed(() => groupOf(store.activeSection))
// Vue2 `groupTitle()` 有一段 `this.activeGroup ? ... : 'AI Settings'` 的兜底 ——
// `groupOf()`(sections.ts)在找不到时会 fallback 回 GROUPS[0],`activeGroup`
// 永远不是假值,那条三元分支是死代码,这里不搬(纯化简死分支,不是行为改动)。
const groupTitle = computed(() => t(activeGroup.value.labelKey))
const isSplitSection = computed(
  () => !activeGroup.value.stack && SPLIT_SECTIONS.includes(store.activeSection),
)

function pillState(v: boolean | null | undefined): 'ok' | 'off' | '' {
  if (v === true) return 'ok'
  if (v === false) return 'off'
  return ''
}

const parserPillState = computed(() => {
  const p = store.parserStatus
  if (!p.running) return 'off'
  if (p.paused) return 'warn'
  return 'ok'
})

const parserBadgeTitle = computed(() => {
  const p = store.parserStatus
  if (!p.running) return t('aiCfgParserNotRunning')
  if (p.paused) {
    return t('aiCfgParserPaused', { pending: p.pending, concurrency: p.concurrency })
  }
  return t('aiCfgParserRunning', { pending: p.pending, concurrency: p.concurrency })
})

function onToggleTheme() {
  aiTheme.toggleTheme()
}

function goBack() {
  router.push('/ai/agent')
}

// P5 前占位(见文件头说明)—— 不 router.push,只弹 toast。
function onDetailsClick() {
  toast.show(t('aiCfgKnowledgeSoon'))
}

function onRefresh() {
  store.loadServicesStatus()
}

// 非 Vue2 蓝本 —— suppressSpy 是模拟点击滚动期间抑制 IntersectionObserver 高亮
// 抖动用的纯内部旗标(Vue2 `this._suppressSpy`),不需要响应式,普通闭包变量足够。
let suppressSpy = false
let spyTimer: ReturnType<typeof setTimeout> | null = null
let statusPollTimer: ReturnType<typeof setInterval> | null = null
let io: IntersectionObserver | null = null
let visible: Record<string, number | null> = {}

/** Vue2 Settings.vue:199-208 —— 非 stack 组直接释放抑制;stack 组滚过去再释放。 */
function scrollToSection(id: SectionId) {
  const group = groupOf(id)
  if (!group.stack) {
    releaseSpy()
    return
  }
  const el = sectionEls[id]
  if (el && typeof el.scrollIntoView === 'function') {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  releaseSpy()
}

/** Vue2 Settings.vue:209-213 —— 平滑滚动结束(约 650ms)后才解除抑制。 */
function releaseSpy() {
  if (spyTimer) clearTimeout(spyTimer)
  spyTimer = setTimeout(() => {
    suppressSpy = false
  }, 650)
}

/** Vue2 Settings.vue:214-240 —— IntersectionObserver scroll-spy。 */
function setupSpy() {
  if (io) {
    io.disconnect()
    io = null
  }
  // jsdom 没有 IntersectionObserver;Vue2 同样守卫这一点,静默跳过(不报错)。
  if (typeof IntersectionObserver === 'undefined') return
  const root = bodyEl.value
  if (!root || !activeGroup.value.stack) return
  visible = {}
  io = new IntersectionObserver(
    (entries) => {
      if (suppressSpy) return
      for (const e of entries) {
        const sid = (e.target as Element).getAttribute('data-section-id')
        if (!sid) continue
        visible[sid] = e.isIntersecting ? e.boundingClientRect.top : null
      }
      // 高亮当前处于视口上方带的最靠上分区。
      let best: string | null = null
      let bestTop = Infinity
      for (const sid in visible) {
        const top = visible[sid]
        if (top == null) continue
        if (top < bestTop) {
          bestTop = top
          best = sid
        }
      }
      // 只改高亮,不动 URL(Vue2 Settings.vue:234 明确注释了这一点)。
      if (best && best !== store.activeSection) {
        store.setActiveSection(best as SectionId)
      }
    },
    { root, rootMargin: '0px 0px -55% 0px', threshold: 0 },
  )
  const nodes = root.querySelectorAll('[data-section-id]')
  nodes.forEach((n) => io!.observe(n))
}

/** Vue2 Settings.vue:189-198 —— 点导航:切分区 → 抑制 spy → 同步 URL → 滚过去。 */
function onSelect(id: SectionId) {
  store.setActiveSection(id)
  // 非 Vue2 蓝本(见文件头说明)—— skills/mcp 本阶段是占位,弹一条提示告知
  // 用户该分区尚未开放。
  if (DEFERRED_SECTIONS.includes(id)) {
    toast.show(t('aiCfgSectionDeferred'), 3000)
  }
  suppressSpy = true
  if (route.query.section !== id) {
    router.replace({ path: '/ai/settings', query: { section: id } })
  }
  nextTick(() => scrollToSection(id))
}

function isValidSection(v: unknown): v is SectionId {
  return typeof v === 'string' && (VALID_SECTIONS as string[]).includes(v)
}

// Vue2 Settings.vue:142-147 —— `?section=` 变化(如浏览器前进/后退)时采纳。
watch(
  () => route.query.section,
  (v) => {
    if (isValidSection(v)) {
      store.setActiveSection(v)
      nextTick(() => scrollToSection(v))
    }
  },
)

// Vue2 Settings.vue:148-152 —— 可见的大类变了(锚点集合变了),重新装 observer。
watch(
  () => activeGroup.value.id,
  () => {
    nextTick(() => setupSpy())
  },
)

onMounted(async () => {
  // SP8-P2b 验收第 3 轮(2026-07-30):登记「AI 区在前台」。应用级 `AppToast` 据此改用
  // AI 的 toast 配色 —— 否则它用全局蓝黑主题的半透明白底 + 白字,画在本页浅色背景上
  // 完全看不见(本页所有 toast 反馈都收不到)。根因见 stores/aiTheme.ts 的 aiSurfaces 注释。
  aiTheme.enterAiSurface()
  // 非 brief 逐条步骤,自行补充(1:1 保真需要)—— Vue2 `Settings.vue:102-107`
  // 在 data() 里每次都独立读一遍 localStorage/matchMedia 初始化主题,与
  // Agent.vue 是否挂载过无关。本仓把主题状态搬到应用级单例 `useAiTheme`
  // 后,若只有 AgentPage 的 `initTheme()`(实为 `aiTheme.hydrateTheme()`,见
  // agentStore.ts:316-318)会读一次持久化偏好,直接从 `/ai/settings` 进站
  // (未先访问过 `/ai/agent`)就会一直停在 store 默认值 'light',无视用户
  // 已保存的偏好或系统深色模式——这是纯粹因为单例化而产生的 1:1 视觉回归,
  // 不是 brief 遗漏的边界情况。`hydrateTheme()` 本身是幂等的(可重复调用,
  // 见 aiTheme.ts 头注释),两个页面各自调用互不冲突。
  aiTheme.hydrateTheme()

  // D2 —— 必须先复位瞬态 UI,再读 `?section=`,顺序不可颠倒(brief 用例 13)。
  store.resetTransientUi()

  const qSection = route.query.section
  if (isValidSection(qSection)) {
    store.setActiveSection(qSection)
  }

  // Vue2 Settings.vue:154-158 —— 四次装载各自 try/catch 吞错,互不阻断。
  try {
    await store.loadServicesStatus()
  } catch {
    /* ignore */
  }
  try {
    await store.loadModels()
  } catch {
    /* ignore */
  }
  try {
    await store.loadProviders()
  } catch {
    /* ignore */
  }
  try {
    await store.loadPolicy()
  } catch {
    /* ignore */
  }

  // SP8-P2a D3 —— 逐字移植自 Vue2 `Settings.vue:159-163`,含 `!job._timer` 守卫。
  //
  // 【申报:同样的代码在本仓才第一次真正执行】Vue2 的 `createSettingsStore()`
  // 每次挂载新建 state,`hfImportJobs` 恒为 {},所以这个循环在 Vue2 里从未跑过
  // 一次 —— 实际效果是离开设置页进度条就没了,而后台 setInterval 仍持有已废弃
  // 的 store 闭包(泄漏)。本仓 store 是 Pinia 单例,任务与定时器都还在,该循环
  // 第一次有了意义:回到页面进度条继续显示。
  //
  // 这是「照搬后行为变好」,不是 bug 修复。`&& !job._timer` 那道守卫必须保留:
  // 它正是防止对同一个文件重复起第二个定时器的闸。
  for (const [filename, job] of Object.entries(store.hfImportJobs)) {
    if ((job.status === 'downloading' || job.status === 'creating model') && !job._timer) {
      store.startImportJob(job.repo, filename)
    }
  }

  statusPollTimer = setInterval(() => {
    store.loadServicesStatus()
  }, 15000)

  nextTick(() => {
    setupSpy()
    // 深链 `?section=` 挂载后滚过去一次(Vue2 Settings.vue:169-172)。
    const s = store.activeSection
    if (activeGroup.value.stack) scrollToSection(s)
  })
})

onUnmounted(() => {
  // SP8-P2b 验收第 3 轮:注销「AI 区在前台」,让应用级 toast 回到全局主题(桌面零影响)。
  aiTheme.leaveAiSurface()
  if (statusPollTimer) clearInterval(statusPollTimer)
  if (io) {
    io.disconnect()
    io = null
  }
  if (spyTimer) clearTimeout(spyTimer)
})
</script>

<template>
  <div class="agent-app set-app" :data-theme="aiTheme.theme">
    <SettingsRail
      :active-id="store.activeSection"
      :model-count="store.installedModels.length"
      @back="goBack"
      @select="onSelect"
    />

    <main class="set-main">
      <header class="set-topbar">
        <span class="tt">{{ groupTitle }}</span>
        <div class="set-status">
          <span class="set-pill" :data-s="pillState(store.servicesStatus.ollama)"
            ><span class="d" />Ollama</span
          >
          <span class="set-pill" :data-s="pillState(store.servicesStatus.openvino)"
            ><span class="d" />OpenVINO</span
          >
          <span class="set-pill" :data-s="pillState(store.servicesStatus.agent)"
            ><span class="d" />Agent</span
          >
          <span class="set-pill" :data-s="pillState(store.searchStatus.running)"
            ><span class="d" />Search</span
          >
          <span class="set-pill" :data-s="parserPillState" :title="parserBadgeTitle">
            <span class="d" />Parser
            <span v-if="store.parserStatus.pending > 0" class="badge-count">{{
              store.parserStatus.pending
            }}</span>
            <span v-if="store.parserStatus.paused" class="badge-pause">⏸</span>
          </span>
        </div>
        <!-- P5 前占位:样式类名保持 Vue2 的 .set-detail-link,交互改成弹 toast
             而不是 router-link(见文件头说明)。 -->
        <button class="set-detail-link" @click="onDetailsClick">
          {{ t('aiCfgDetails') }} <AgentIcon name="chev" :size="12" />
        </button>
        <button class="set-ibtn" :title="t('aiCfgRefresh')" @click="onRefresh">
          <AgentIcon name="refresh" :size="16" />
        </button>
        <button class="set-ibtn" :title="t('aiCfgToggleTheme')" @click="onToggleTheme">
          <AgentIcon :name="aiTheme.theme === 'dark' ? 'sun' : 'moon'" :size="16" />
        </button>
      </header>

      <div ref="bodyEl" class="set-body" :class="{ 'set-body-split': isSplitSection }">
        <!-- Stacked group: every section rendered top-to-bottom, rail navigates
             by scrolling; scroll position drives the rail highlight. -->
        <template v-if="activeGroup.stack">
          <section
            v-for="item in activeGroup.items"
            :key="item.id"
            class="set-stack-item"
            :data-section-id="item.id"
            :ref="(el) => setSectionEl(item.id, el as Element | null)"
          >
            <component :is="SECTION_COMPONENTS[item.id]" v-bind="placeholderProps(item.id)" />
          </section>
        </template>
        <!-- Swap group: one section at a time (Skills / MCP split panes, tokens,
             channels) — these full-height layouts cannot be stacked. -->
        <component
          v-else
          :is="SECTION_COMPONENTS[store.activeSection]"
          v-bind="placeholderProps(store.activeSection)"
        />
      </div>
    </main>
  </div>
</template>
