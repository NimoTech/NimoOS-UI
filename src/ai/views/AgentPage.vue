<!--
  1:1 移植自 Vue2 src/views/AI/Agent/Agent.vue(242 行),1a 裁剪版:
  去 AgentComposer(1b 无输入框 UI —— 本期唯一发送入口是 Task 11 的
  ?search=/?message= 自动发送 + EmptyState 建议卡)、
  AgentRightPanel(1c),以及 systemMetrics/disks 的装载段(1c)。

  SP8-P1c1 Task 12 —— AgentComposer 已挂载(Vue2 Agent.vue:38-42 挂载契约,
  1:1):props busy/ctx-usage,emits send/stop/send-init 直连 store 同名 action。
  ctxUsage 状态 + refreshContextUsage() 移植自 Vue2 Agent.vue:99/198-207,
  三个刷新触发点(mounted 一次、activeSessionId 变化一次、busy true→false 下降
  沿一次)移植自 Vue2 120-132(当时**不**移植同一会话 watcher 里的
  loadSessionThinking/updateThinkingForModel,也**不**移植 lastFallbackNotice
  toast watcher——两者都属于 ThinkingBar/ModelPicker,留给 1c-2)。
  ModelPicker、ThinkingBar UI 仍留后续任务。

  SP8-P1c2 Task 2 —— data-rightcollapsed 解开硬编码,改绑 store.rightCollapsed
  (Vue2 Agent.vue:4 逐字对齐);AgentTopbar 新增 right-collapsed prop +
  toggle-right emit → store.toggleRight(Vue2 Agent.vue:20/24)。右栏 shell 本身
  (AgentRightPanel)仍未挂载,留给后续任务——本任务只解开容器状态 + 顶栏开关。

  SP8-P1c2 Task 3 —— 补齐上面 Task 12 留白的那两行:会话 watcher(Vue2
  Agent.vue:120-123)现在与 refreshContextUsage() 并列触发
  loadSessionThinking(newId)/updateThinkingForModel()(仅 newId 非空时,顺序照
  Vue2,不 await);mounted 里在 loadSessions/loadAvailableModels 之前新增一次
  store.loadThinkingDefaults()(Vue2 Agent.vue:151)。lastFallbackNotice toast
  watcher 仍不在本任务范围(ModelPicker 的事,留后续任务)。ThinkingBar/
  ModelPicker UI 本身仍未挂载——本任务只管 store 状态 + 页面接线。

  SP8-P1c2 Task 13 —— `<AgentRightPanel>` 正式挂载(Vue2 Agent.vue:44-64 挂载契约),
  11 个 prop + 7 个事件逐条对齐(F1 终审修复后新增第 8 个事件
  `remove-resource-by-path` → `store.removeVisibleResourceByPath`,写法与相邻
  处理器一致);唯一少的一个 prop 是 `systemMetrics`(用户 2026-07-27
  拍板的有意偏离,详见模板处与 AgentRightPanel.vue props 处注释)。至此右栏 4 个
  tab(Activity/Context/System/Resources)全部接真。

  主题持久化已下沉到 store.toggleTheme(Task 2 里直接 localStorage.setItem),
  这里不再像 Vue2 Agent.vue:117-119 那样额外 watch store.theme 落盘。

  SP8-P1c2 Task 9 —— ModelPicker 挂载 + 模型回退提示 + AI-rename 按钮(Vue2
  Agent.vue:15-33 的 AgentTopbar 挂载契约剩余部分):
  - AgentTopbar 新增 `available-models`/`selected-model`/`regenerating-title-for`
    三个 prop 直传 store 同名字段;`select-model` → `store.selectModel(key)`,
    `regenerate-title` → `onRegenerateTitle`(Vue2 Agent.vue:216-220,带
    activeSessionId 非空守卫)。
  - ModelPicker 空态的"去设置" 与顶栏未来的设置入口共用同一个 `open-settings`
    事件名,复用已有的 `onOpenSettings`(P2 前占位 toast,不路由跳转)。
  - `lastFallbackNotice` watcher 逐字港 Vue2 Agent.vue:133-142:非空时弹一条
    4000ms 的 warning toast(Task 6 的 tier),`to` 为空时兜底显示
    `t('aiNoModelAvailable')`;**watcher 自己把 store.lastFallbackNotice 置回
    null**——store 侧(agentStore.ts)特意不清空这个字段,清空职责在消费它的视图。
-->
<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import { useAgentStore } from '../stores/agentStore'
import type { ThinkingLevel } from '../stores/agentStore'
import { provideAgentStore } from '../composables/useProvidedAgentStore'
import { useToast } from '../../stores/toast'
import { toStoragePayload, type StoragePayload } from '../util/toStoragePayload'
import AgentSidebar from '../components/shell/AgentSidebar.vue'
import AgentTopbar from '../components/shell/AgentTopbar.vue'
import AgentComposer from '../components/shell/AgentComposer.vue'
import AgentRightPanel from '../components/shell/AgentRightPanel.vue'
import type { ActivityStep } from '../components/tabs/ActivityTab.vue'
import type { ResourceAttachment } from '../components/tabs/ResourcesTab.vue'
import MessageList from '../components/stream/MessageList.vue'
import EmptyState from '../components/stream/EmptyState.vue'
import '../styles/tokens.scss'
import '../styles/agent-styles.scss'

const store = useAgentStore()
provideAgentStore(store)
const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const toast = useToast()

// store.messages is typed as the loose AgentMessage (Record<string, unknown>) —
// MessageList needs `role` to be known-present. Runtime shape always has it
// (backend contract), this is a type-level bridge only.
interface AgentMsgLike { id?: string | number; role: string; [key: string]: unknown }
const messagesForList = computed(() => store.messages as unknown as AgentMsgLike[])

// SP8-P1c2 Task 13 —— 同上,纯类型桥接,零运行时语义:store 里这两个字段是宽松的
// Record<string, unknown>[](activitySteps 由 pushActivityStep 就地构造、attachments
// 由 /attachments 接口原样落库),右栏两个 tab 组件各自声明了更窄的形状
// (ActivityStep / ResourceAttachment)。运行时形状始终满足(store 的构造点 +
// 后端契约),这里只是把类型对上,不做任何转换/拷贝。
const activityStepsForPanel = computed(() => store.activitySteps as unknown as ActivityStep[])
const attachmentsForPanel = computed(() => store.attachments as unknown as ResourceAttachment[])

// Agent.vue:104-108 semantics: fall back to '' when the active session has no
// (or an empty) title — AgentTopbar shows its own placeholder in that case.
const currentSessionTitle = computed(() => {
  const id = store.activeSessionId
  const s = store.sessions.find((x) => x.id === id)
  return s && s.title ? s.title : ''
})

// F2 修复(review)—— AgentTopbar 的 `thinking` prop 收窄了 `level: ThinkingLevel`
// (agentStore.ts 里说明了为什么 store 自己的 ThinkingState.level 保持 string 不
// 收窄:它要接住共享服务包 getSessionThinking() 的裸 string 返回值)。这里的 cast
// 是安全的——运行时 `thinking.level` 只可能来自 ThinkingBar 的四个 <option> 值或
// 服务端 `thinking_level || 'medium'` 兜底,从未出现过第五种取值。
const thinkingForTopbar = computed(() => ({
  ...store.thinking,
  level: store.thinking.level as ThinkingLevel,
}))

function onOpenSettings() {
  // P2: router.push('/ai/settings') — 路由该期才存在,先占位(评审跟进:
  // 路由不存在且无 catch-all,push 会落到空白死页)。
  toast.show(t('aiSettingsComingSoon'))
}

function onUpdateTitle(title: string) {
  if (store.activeSessionId) store.setSessionTitle(store.activeSessionId, title)
}

// Vue2 Agent.vue:216-220 —— sparkle click, guarded by activeSessionId (no-op
// with no active session, mirrors the same guard onUpdateTitle uses above).
function onRegenerateTitle() {
  if (store.activeSessionId) store.regenerateTitle(store.activeSessionId)
}

// Vue2 Agent.vue:133-142 —— model-fallback toast. The store deliberately
// never clears `lastFallbackNotice` itself (see agentStore.ts) — clearing it
// is this watcher's job, same as Vue2 did inline (`this.store.state
// .lastFallbackNotice = null`), so a second identical fallback later still
// re-fires the watcher instead of being silently swallowed by an unchanged
// (falsy) value.
watch(
  () => store.lastFallbackNotice,
  (notice) => {
    if (notice) {
      toast.show(
        t('aiModelFallback', { from: notice.from, to: notice.to || t('aiNoModelAvailable') }),
        4000,
        'warning',
      )
      store.lastFallbackNotice = null
    }
  },
)

// Agent.vue:99 ctxUsage state, populated by refreshContextUsage() below.
const ctxUsage = ref<{ tokens: number; window: number; pct: number } | null>(null)

// SP8-P1c2 Task 11 —— Agent.vue:159-162 storage state, populated once in
// onMounted below via toStoragePayload(). Deliberately a plain page-level ref,
// not agentStore.ts state: the brief is explicit that this task must not add
// store state it didn't ask for, and nothing else in the app needs this value
// — SystemTab (Task 11) takes it as a prop, AgentRightPanel wiring (Task 13)
// will pass this ref straight down when it mounts <AgentRightPanel> here.
// (systemMetrics — Agent.vue:155-158 — is intentionally NOT ported: SystemTab
// reads live data itself via useUtilization()/useUtilizationStore() per this
// phase's user-approved deviation, so there is no one-shot HTTP fetch or state
// for it on this page.)
const storage = ref<StoragePayload | null>(null)

// Vue2 缺陷修复(项目 2026-07-27 移植纪律:逻辑跟正确性,不跟字面 1:1)—— Agent.vue
// 198-207 的 refreshContextUsage 没有 in-flight/顺序守卫:一次快速切会话可能触发
// 两次重叠请求,若旧请求晚落地,会用上一个会话的用量覆盖当前会话的 ctxUsage。这里
// 加一个自增序号,只有仍是"最新一次调用"的结果才写回 ctxUsage,过期结果直接丢弃 ——
// 不改变三个触发点各自的调用次数/时机语义,修复面仅限"谁能写回"。
let ctxUsageSeq = 0

/**
 * Agent.vue:198-207 —— 无会话早退;传**原始 model key**(如 'local:llama3'),
 * 不是裸模型名;失败置 null。
 */
async function refreshContextUsage() {
  // Final-review fix (2026-07-27, 项目移植纪律:逻辑跟正确性,Vue2 Agent.vue
  // 198-207 在这个早退分支上完全没有守卫,不是"跟 Vue2 不一样"而是补一个 Vue2
  // 从没做过的守卫):no-session 早退必须一样地(a) 递增 ctxUsageSeq,使一个
  // "刚被删掉的会话"仍在途的请求落地时,因 seq 已过期而被 catch/then 里的
  // `seq === ctxUsageSeq` 检查丢弃,不会覆盖当前(空)状态;(b) 清空 ctxUsage,
  // 否则环形进度条会继续显示已经不存在的会话的旧 token 数。
  if (!store.activeSessionId) {
    ++ctxUsageSeq
    ctxUsage.value = null
    return
  }
  const seq = ++ctxUsageSeq
  try {
    const usage = (await service.ai.getContextUsage(
      store.activeSessionId,
      store.selectedModel as string,
    )) as { tokens: number; window: number; pct: number }
    if (seq === ctxUsageSeq) ctxUsage.value = usage
  } catch {
    if (seq === ctxUsageSeq) ctxUsage.value = null
  }
}

// Agent.vue:120-126 会话 watcher —— SP8-P1c2 Task 3 补上 loadSessionThinking/
// updateThinkingForModel(1c-1 阶段这两条留白,ThinkingBar 尚未接线,提前塞是死代码;
// 本任务把 store 侧的四个 loader/setter 补齐,页面侧顺势接上这两行)。顺序照 Vue2
// Agent.vue:120-123 逐字:先 loadSessionThinking(newId)+updateThinkingForModel()
// (仅 newId 非空时,不 await——与 Vue2 一样是 fire-and-forget),再 refreshContextUsage()
// (无论 newId 是否为空都要跑,与 Vue2 一致)。
watch(
  () => store.activeSessionId,
  (newId) => {
    if (newId) {
      store.loadSessionThinking(newId)
      store.updateThinkingForModel()
    }
    refreshContextUsage()
  },
)
// Agent.vue:127-132 —— 只在 busy true→false 下降沿刷新(一轮结束之后);没有针对
// selectedModel 的 watcher,与 Vue2 一致(切模型不会自动重拉用量)。
watch(
  () => store.busy,
  (v, old) => {
    if (old === true && v === false) refreshContextUsage()
  },
)

onMounted(async () => {
  store.initTheme()
  // Vue2 Agent.vue:151 —— loadThinkingDefaults 在 loadSessions/loadAvailableModels
  // 之前调一次(ThinkingBar 需要一份兜底默认值,先于会话/模型装载就绪)。函数本身已经
  // 吞掉了内部请求错误(agentStore.ts loadThinkingDefaults),这里的 try/catch 只是
  // 照 Vue2 同款防御式写法保持风格一致,不是因为它真的会抛。
  try {
    await store.loadThinkingDefaults()
  } catch {
    /* ignore */
  }
  try {
    await store.loadSessions()
  } catch {
    /* ignore — mirrors Vue2 Agent.vue's swallow-per-call mounted sequence */
  }
  try {
    // 在 auto-send 交接(Task 11)之前先把默认模型定下来,否则那时
    // selectedModel 还是 null,send() 会先落一个 "无模型" 的错误 block。
    await store.loadAvailableModels()
  } catch {
    /* ignore — 拉模型失败不该挡住页面渲染,send() 自己会兜底提示无模型 */
  }
  // Agent.vue:154 —— models 加载完之后拉一次 ctxUsage(mounted 触发,三个触发点之一)。
  refreshContextUsage()

  // SP8-P1c2 Task 11 —— Agent.vue:159-162 一次性拉存储容量(disks.list() 是
  // Task 1 新增的方法)。try/catch 吞错置 null,与 Vue2 同(空态兜底交给
  // SystemTab 渲染,不在这里报错)。存储容量不需要实时,只在挂载时拉一次。
  try {
    const disks = await service.disks.list()
    storage.value = toStoragePayload(disks)
  } catch {
    storage.value = null
  }

  // Vue2 Agent.vue:145-148 —— ?skill= 挂号:只暂存,消费点在 send()(agentStore.ts
  // send() 的 X-Skill-Id 组装段),这里不发送。
  const skill = route.query.skill
  if (skill) store.pendingSkillId = String(skill)

  // Handoff from the global search page / homepage AI widget
  // (/ai/agent?search=<query> or ?message=<text>) — Vue2 Agent.vue:166-192.
  // search wins over message when both are present (message is skipped
  // entirely). One-shot: router.replace strips both query keys BEFORE
  // sending so a page refresh doesn't re-send the seed turn.
  const seedSearch = (route.query.search ?? '').toString().trim()
  const seedMessage = (route.query.message ?? '').toString().trim()
  if (seedSearch || seedMessage) {
    const clean = { ...route.query }
    delete clean.search
    delete clean.message
    await router.replace({ path: '/ai/agent', query: clean })
    try {
      if (seedSearch) {
        await store.createSession() // always fresh
        await store.send(t('ai.searchMyNas', { query: seedSearch }))
      } else {
        if (!store.activeSessionId) await store.createSession() // reuse if present
        await store.send(seedMessage) // raw verbatim
      }
    } catch {
      /* onError already surfaced a block */
    }
  }
})
</script>

<template>
  <div
    class="agent-app"
    :data-theme="store.theme"
    :data-leftcollapsed="store.leftCollapsed"
    :data-rightcollapsed="store.rightCollapsed"
  >
    <AgentSidebar
      :sessions="store.sessions"
      :active-id="store.activeSessionId"
      :collapsed="store.leftCollapsed"
      @new="store.createSession"
      @select="store.selectSession"
      @delete="store.deleteSession"
      @open-settings="onOpenSettings"
    />
    <main class="main">
      <AgentTopbar
        :session-id="String(store.activeSessionId ?? '')"
        :stored-title="currentSessionTitle"
        :regenerating-title-for="store.regeneratingTitleFor"
        :theme="store.theme"
        :right-collapsed="store.rightCollapsed"
        :available-models="store.availableModels"
        :selected-model="store.selectedModel"
        :thinking="thinkingForTopbar"
        @toggle-left="store.toggleLeft"
        @toggle-theme="store.toggleTheme"
        @toggle-right="store.toggleRight"
        @update-title="onUpdateTitle"
        @select-model="(key) => store.selectModel(key)"
        @open-settings="onOpenSettings"
        @regenerate-title="onRegenerateTitle"
        @thinking-enabled="(v) => store.setThinkingEnabled(v)"
        @thinking-level="(v) => store.setThinkingLevel(v)"
      />
      <EmptyState v-if="store.messages.length === 0" />
      <MessageList v-else :messages="messagesForList" :busy="store.busy" />
      <!--
        Agent.vue:38-42 挂载契约 —— 1:1(props/emits 名与语义)。emit 处理器写成
        内联箭头函数、而不是像 Vue2 那样直接 `@send="store.actions.send"` 裸引用
        方法 —— Vue3 里裸方法引用会在渲染时把 `store.send` 这个函数值本身固化进
        vnode 的 onSend prop;此后若外部整体替换了 `store.send`(如测试用
        `vi.spyOn(store, 'send')`,底层走 `Object.defineProperty`,不经过 Vue
        reactive 的 set 陷阱,不会触发 AgentPage 重渲染),裸引用不会跟着变,仍会
        调到替换前的旧函数。内联箭头在**调用时**才去读 `store.send`,读到的是
        当前值,行为才和"调用方法当前实现"一致。
      -->
      <AgentComposer
        :busy="store.busy"
        :ctx-usage="ctxUsage"
        @send="(payload) => store.send(payload)"
        @stop="() => store.stop()"
        @send-init="(target) => store.sendInit(target)"
      />
    </main>
    <!--
      SP8-P1c2 Task 13 —— Agent.vue:44-64 挂载契约,逐条对齐。两处与 Vue2 的写法差异,
      都不改变行为:
      1) `:session-id` 这里包了 `String(... ?? '')`。Vue2 Agent.vue:51 直传
         `store.state.activeSessionId`(可能是 number 或 null,而 Vue2 那边 prop 声明
         的是 `{ type: String, default: '' }` —— 真跑到 number/null 会有 prop 类型
         告警)。与本页 AgentTopbar 的 :session-id 用同一种归一化写法。
      2) emit 处理器一律写成内联箭头(理由同上方 AgentComposer 处的长注释:
         Vue3 裸方法引用会把函数值固化进 vnode,spyOn 替换后不生效)。
      systemMetrics(Vue2 Agent.vue:47)有意不传 —— SystemTab 自己走 useUtilization()
      实时通道取数,AgentRightPanel 侧已把这个 prop 删掉(见该文件 props 处注释)。
    -->
    <AgentRightPanel
      :collapsed="store.rightCollapsed"
      :tab="store.rightTab"
      :activity-steps="activityStepsForPanel"
      :storage="storage"
      :busy="store.busy"
      :session-id="String(store.activeSessionId ?? '')"
      :visible-resources="store.visibleResources"
      :attachments="attachmentsForPanel"
      :staged-changes="store.stagedChanges"
      :committing="store.committing"
      :reverting="store.reverting"
      @set-tab="(tab) => store.setRightTab(tab)"
      @remove-resource="(id) => store.removeVisibleResource(id)"
      @remove-resource-by-path="(path) => store.removeVisibleResourceByPath(path)"
      @remove-attachment="(id) => store.removeAttachment(id)"
      @revert-run="(runId) => store.revertStagedRun(runId)"
      @revert-batch="(batchId) => store.revertStagedBatch(batchId)"
      @revert-item="(stagedId) => store.revertStagedItem(stagedId)"
      @commit-all="() => store.commitStagedAll()"
    />
  </div>
</template>
