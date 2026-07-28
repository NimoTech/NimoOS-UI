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
  ModelPicker、AI 改名按钮仍留给后续任务。
-->
<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import AgentIcon from '../icons/AgentIcon.vue'
import ThinkingBar from './ThinkingBar.vue'

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
  },
)

const emit = defineEmits<{
  (e: 'toggle-left'): void
  (e: 'toggle-theme'): void
  (e: 'toggle-right'): void
  (e: 'update-title', title: string): void
  (e: 'thinking-enabled', value: boolean): void
  (e: 'thinking-level', value: string): void
}>()

const { t } = useI18n()
const router = useRouter()

const localTitle = ref(props.storedTitle || '')
const isFocused = ref(false)
let debounceTimer: ReturnType<typeof setTimeout> | null = null

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
            @input="onInput"
            @focus="onFocus"
            @blur="onBlur"
          />
          <!-- 1c: AI-rename button -->
        </div>
        <div class="topbar-sub">Connected to NimoOS</div>
      </div>
      <div class="topbar-spacer" />
      <!-- 1c: ModelPicker -->
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
</style>
