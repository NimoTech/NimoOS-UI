<!--
  1:1 移植自 Vue2 src/views/AI/Agent/shell/AgentTopbar.vue(230 行),1a 裁剪版:
  ModelPicker、ThinkingBar、右侧面板 toggle、AI 改名按钮全部整段省略,原位置
  留 `<!-- 1c: ... -->` 注释标记待 1c 回填。标题输入 500ms 防抖 + blur 立即
  flush 的语义逐字保留(DEBOUNCE_MS、onInput/onBlur/flushSave)。
-->
<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import AgentIcon from '../icons/AgentIcon.vue'

const DEBOUNCE_MS = 500

const props = withDefaults(
  defineProps<{
    sessionId?: string
    storedTitle?: string
    theme?: 'light' | 'dark'
  }>(),
  {
    sessionId: '',
    storedTitle: '',
    theme: 'light',
  },
)

const emit = defineEmits<{
  (e: 'toggle-left'): void
  (e: 'toggle-theme'): void
  (e: 'update-title', title: string): void
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
      <!-- 1c: right-panel toggle -->
    </div>
    <!-- 1c: ThinkingBar -->
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
