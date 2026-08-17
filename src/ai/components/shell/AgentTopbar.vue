<!--
  1:1 ported from Vue2 src/views/AI/Agent/shell/AgentTopbar.vue (230 lines), 1a trimmed
  version: ModelPicker, ThinkingBar, the right-panel toggle, and the AI-rename button are
  all omitted wholesale, with a `<!-- 1c: ... -->` comment marker left in their original
  spot for 1c to backfill. The 500ms-debounce + flush-immediately-on-blur semantics for
  the title input are preserved verbatim (DEBOUNCE_MS, onInput/onBlur/flushSave).

  SP8-P1c2 Task 2 — the right-panel toggle button has been backfilled (Vue2
  shell/AgentTopbar.vue:43-45, 1:1): added prop `rightCollapsed` (matches Vue2 :73,
  defaults to false) + emit `toggle-right`. ModelPicker, ThinkingBar, and the AI-rename
  button are still left for later tasks.

  SP8-P1c2 Task 8 — ThinkingBar's second row is now mounted (Vue2
  shell/AgentTopbar.vue:47-54, 1:1): added prop `thinking` (shape matches a subset of the
  store's ThinkingState), split apart and passed as ThinkingBar's four props; ThinkingBar's
  `update:enabled`/`update:level` are remapped here to `thinking-enabled`/`thinking-level`
  and forwarded up to AgentPage (same as Vue2's two matching lines
  `@update:enabled="$emit('thinking-enabled', ...)"` / `@update:level="..."`).

  SP8-P1c2 Task 9 — ModelPicker mounted + AI-rename button backfilled (verbatim from
  Vue2 shell/AgentTopbar.vue): added props `availableModels`/`selectedModel` (passed
  straight through to ModelPicker), `regeneratingTitleFor` (used together with sessionId
  to derive isAnyRegenerating/isExplicitRegenerating, Vue2 :93-100); added emits
  `select-model` (ModelPicker's `select`), `open-settings` (ModelPicker's empty-state
  "go to settings" button, sharing the same emitted event name as any settings entry point
  the topbar itself may gain in the future), `regenerate-title` (sparkle button click).
  The title input is disabled while `isExplicitRegenerating` (Vue2 :17); the sparkle
  button is disabled while `isAnyRegenerating || isFocused` (Vue2 :24).
-->
<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import AgentIcon from '../icons/AgentIcon.vue'
import ModelPicker from './ModelPicker.vue'
import ThinkingBar from './ThinkingBar.vue'
import type { AgentModel, ThinkingLevel } from '../../stores/agentStore'

const DEBOUNCE_MS = 500

const props = withDefaults(
  defineProps<{
    sessionId?: string
    storedTitle?: string
    theme?: 'light' | 'dark'
    // Vue2 shell/AgentTopbar.vue:73 — defaults to expanded (false), used for the
    // button's data-active.
    rightCollapsed?: boolean
    // Vue2 shell/AgentTopbar.vue:76-84 — defaults match verbatim (consistent with
    // the store's ThinkingState fallback: enabled=true, level='medium', supportsThinking=false).
    thinking?: {
      enabled: boolean
      // F2 fix (review) — narrowed the same way as ThinkingBar's level prop, reusing
      // the ThinkingLevel exported from agentStore.ts (the store's own
      // ThinkingState.level stays a plain string, not narrowed — see the comment
      // there: narrowing that layer would ripple into the shared service package's
      // return type).
      level: ThinkingLevel
      supportsThinking: boolean
      providerType: string
    }
    // Vue2 shell/AgentTopbar.vue:74-75,71 — the current regenerating state needed
    // for passing straight through to ModelPicker and for the regenerate-title
    // disable matrix.
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
// F1 fix (2026-07-28 review) —— `sessionId` reaches this component pre-coerced
// to a string (AgentPage.vue: `String(store.activeSessionId ?? '')`), but
// `regeneratingTitleFor.id` keeps its native `string | number` type straight
// from the store (session ids are `string | number` throughout the store and
// the shared service). Comparing `r.id === props.sessionId` silently breaks
// for numeric session ids (`42 === '42'` is `false`), so the AI-rename disable
// states never activate. Normalise both sides through `String()` at this
// string/number boundary before comparing.
const isExplicitRegenerating = computed(() => {
  const r = props.regeneratingTitleFor
  return !!(r && String(r.id) === props.sessionId && !r.background)
})
const isAnyRegenerating = computed(() => {
  const r = props.regeneratingTitleFor
  return !!(r && String(r.id) === props.sessionId)
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
    // In the strangler-fig context, '/' is the old Vue2 app; the new app's entry point is '/app/'
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
      <!-- Vue2 shell/AgentTopbar.vue:43-45 — ported 1:1 (no title, Vue2 has none either). -->
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
