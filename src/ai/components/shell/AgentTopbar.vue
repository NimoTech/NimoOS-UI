<!--
  1:1 移植自 Vue2 src/views/AI/Agent/shell/AgentTopbar.vue(230 行),1a 裁剪版:
  ModelPicker、ThinkingBar、右侧面板 toggle、AI 改名按钮全部整段省略,原位置
  留 `<!-- 1c: ... -->` 注释标记待 1c 回填。标题输入 500ms 防抖 + blur 立即
  flush 的语义逐字保留(DEBOUNCE_MS、onInput/onBlur/flushSave)。

  SP8-P1c2 Task 2 —— 右侧面板 toggle 按钮已回填(Vue2 shell/AgentTopbar.vue:
  43-45,1:1):新增 prop `rightCollapsed`(对齐 Vue2 :73,默认 false)+ emit
  `toggle-right`。ModelPicker、ThinkingBar、AI 改名按钮仍留给后续任务。

  SP8-P1c2 Task 8 —— ThinkingBar 第二行已挂载(Vue2 shell/AgentTopbar.vue:47-54,
  1:1):新增 prop `thinking`(形状对齐 store 的 ThinkingState 子集），拆开传给
  ThinkingBar 四个 prop；ThinkingBar 的 `update:enabled`/`update:level` 在此处
  重映射成 `thinking-enabled`/`thinking-level` 往上抛给 AgentPage（Vue2 同名两行
  `@update:enabled="$emit('thinking-enabled', ...)"` / `@update:level="..."`）。

  SP8-P1c2 Task 9 —— ModelPicker 挂载 + AI 改名按钮回填(Vue2 shell/AgentTopbar.vue
  逐字):新增 prop `availableModels`/`selectedModel`(直传 ModelPicker)、
  `regeneratingTitleFor`(与 sessionId 一起推导 isAnyRegenerating/
  isExplicitRegenerating,Vue2 :93-100);新增 emit `select-model`(ModelPicker
  的 `select`)、`open-settings`(ModelPicker 的空态"去设置"按钮,与顶栏本身未来
  可能有的设置入口共用同一上抛事件名)、`regenerate-title`(sparkle 按钮点击)。
  标题输入框在 `isExplicitRegenerating` 时禁用(Vue2 :17);sparkle 按钮在
  `isAnyRegenerating || isFocused` 时禁用(Vue2 :24)。
-->
<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import AgentIcon from '../icons/AgentIcon.vue'
import ModelPicker from './ModelPicker.vue'
import ThinkingBar from './ThinkingBar.vue'
import type { AgentModel } from '../../stores/agentStore'

const DEBOUNCE_MS = 500

const props = withDefaults(
  defineProps<{
    sessionId?: string
    storedTitle?: string
    theme?: 'light' | 'dark'
    // Vue2 shell/AgentTopbar.vue:73 —— 默认展开(false),用于按钮 data-active。
    rightCollapsed?: boolean
    // Vue2 shell/AgentTopbar.vue:76-84 —— 默认值逐字对齐(与 store 的
    // ThinkingState 兜底一致：enabled=true, level='medium', supportsThinking=false)。
    thinking?: {
      enabled: boolean
      level: string
      supportsThinking: boolean
      providerType: string
    }
    // Vue2 shell/AgentTopbar.vue:74-75,71 —— ModelPicker 直传 + regenerate-title
    // 禁用矩阵所需的当前重生成状态。
    availableModels?: AgentModel[]
    selectedModel?: string | null
    regeneratingTitleFor?: { id: string | number; background: boolean } | null
  }>(),
  {
    sessionId: '',
    storedTitle: '',
    theme: 'light',
    rightCollapsed: false,
    thinking: () => ({
      enabled: true,
      level: 'medium',
      supportsThinking: false,
      providerType: '',
    }),
    availableModels: () => [],
    selectedModel: null,
    regeneratingTitleFor: null,
  },
)

const emit = defineEmits<{
  (e: 'toggle-left'): void
  (e: 'toggle-theme'): void
  (e: 'toggle-right'): void
  (e: 'update-title', title: string): void
  (e: 'thinking-enabled', value: boolean): void
  (e: 'thinking-level', value: string): void
  (e: 'select-model', key: string): void
  (e: 'open-settings'): void
  (e: 'regenerate-title'): void
}>()

const { t } = useI18n()
const router = useRouter()

const localTitle = ref(props.storedTitle || '')
const isFocused = ref(false)
let debounceTimer: ReturnType<typeof setTimeout> | null = null

// Vue2 shell/AgentTopbar.vue:93-100 —— disable matrix for the title input /
// sparkle button. `isExplicitRegenerating` is true only for a foreground
// (non-background) regenerate targeting *this* session — it locks the title
// input so the user doesn't edit a value that's about to be overwritten.
// `isAnyRegenerating` also covers the background auto-title-on-first-turn
// case and only gates the sparkle button (still clickable-but-disabled while
// either kind of regenerate is in flight for this session).
const isExplicitRegenerating = computed(() => {
  const r = props.regeneratingTitleFor
  return !!(r && r.id === props.sessionId && !r.background)
})
const isAnyRegenerating = computed(() => {
  const r = props.regeneratingTitleFor
  return !!(r && r.id === props.sessionId)
})

function clearTimer() {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
}

function flushSave() {
  const trimmed = (localTitle.value || '').trim()
  if (trimmed) emit('update-title', trimmed)
}

function onInput() {
  clearTimer()
  debounceTimer = setTimeout(() => {
    debounceTimer = null
    flushSave()
  }, DEBOUNCE_MS)
}

function onFocus() {
  isFocused.value = true
}

function onBlur() {
  clearTimer()
  const trimmed = (localTitle.value || '').trim()
  if (!trimmed) {
    // Restore visual to the previous stored title
    localTitle.value = props.storedTitle || ''
  } else {
    flushSave()
  }
  isFocused.value = false
}

watch(
  () => props.storedTitle,
  (newVal) => {
    // Only sync from outside if user is not actively editing
    if (!isFocused.value) localTitle.value = newVal || ''
  },
)

watch(
  () => props.sessionId,
  () => {
    // Switching sessions resets local state
    localTitle.value = props.storedTitle || ''
    isFocused.value = false
    clearTimer()
  },
)

onBeforeUnmount(() => {
  clearTimer()
})

function goHome() {
  // The Agent page is opened in a new tab from the home launcher, so the
  // existing tab's history may not include `/`. Try a router push first;
  // if there's no history (we were the entry point) fall back to a hard
  // navigation so the back button always works.
  if (window.history.length > 1 && router.currentRoute.value.path !== '/') {
    router.push('/').catch(() => { window.location.href = '/app/' })
  } else {
    // strangler 语境下 '/' 是旧 Vue2 应用,新应用的落点是 '/app/'
    window.location.href = '/app/'
  }
}
</script>

<template>
  <header class="topbar">
    <div class="topbar-main-row">
      <button class="icon-btn" @click="goHome" :title="t('aiBack')">
        <AgentIcon name="arrowLeft" :size="16" />
      </button>
      <button class="icon-btn" @click="emit('toggle-left')">
        <AgentIcon name="panelLeft" :size="16" />
      </button>
      <div class="title-block">
        <div class="title-row">
          <input
            class="topbar-title-input"
            v-model="localTitle"
            :placeholder="storedTitle || t('aiNewConversation')"
            :disabled="isExplicitRegenerating"
            @input="onInput"
            @focus="onFocus"
            @blur="onBlur"
          />
          <button
            class="icon-btn ai-rename-btn"
            :disabled="isAnyRegenerating || isFocused"
            :title="t('aiRename')"
            @click="emit('regenerate-title')"
          >
            <AgentIcon name="sparkle" :size="14" />
          </button>
        </div>
        <div class="topbar-sub">Connected to NimoOS</div>
      </div>
      <div class="topbar-spacer" />
      <ModelPicker
        :available-models="availableModels"
        :selected-key="selectedModel"
        @select="emit('select-model', $event)"
        @open-settings="emit('open-settings')"
      />
      <button class="icon-btn" @click="emit('toggle-theme')">
        <AgentIcon :name="theme === 'dark' ? 'sun' : 'moon'" :size="16" />
      </button>
      <!-- Vue2 shell/AgentTopbar.vue:43-45 —— 1:1 端口(无 title,Vue2 亦无)。 -->
      <button class="icon-btn" :data-active="!rightCollapsed" @click="emit('toggle-right')">
        <AgentIcon name="panel" :size="16" />
      </button>
    </div>
    <ThinkingBar
      :enabled="thinking.enabled"
      :level="thinking.level"
      :supports-thinking="thinking.supportsThinking"
      :provider-type="thinking.providerType"
      @update:enabled="emit('thinking-enabled', $event)"
      @update:level="emit('thinking-level', $event)"
    />
  </header>
</template>

<style scoped>
/* Override global .topbar fixed height so the trimmed single row still lays out cleanly */
.topbar {
  height: auto !important;
  flex-direction: column !important;
  align-items: stretch !important;
  padding: 0 !important;
  gap: 0 !important;
}
.topbar-main-row {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 56px;
  padding: 0 18px;
}
.title-block {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex-shrink: 1;
  overflow: hidden;
}
.title-row {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}
.topbar-title-input {
  font: inherit;
  color: inherit;
  font-weight: 600;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  padding: 2px 6px;
  margin: -2px -6px;
  outline: none;
  min-width: 0;
  flex: 1;
  transition: background 120ms, border-color 120ms;
}
.topbar-title-input::placeholder {
  color: var(--text-tertiary);
  opacity: 0.7;
}
.topbar-title-input:hover:not(:disabled) {
  background: var(--bg-hover);
}
.topbar-title-input:focus {
  background: var(--bg-elevated);
  border-color: var(--line-strong);
}
.topbar-title-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.ai-rename-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
