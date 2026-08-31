<!--
  1:1 character-for-character port from Vue2 src/views/AI/Agent/shell/ModelPicker.vue (127 lines).

  Vue2-ism conversion checklist:
  - `directives: { 'click-outside': {...bind/unbind} }` → `useClickOutside`
    composable (see top comment in ../../composables/useClickOutside.ts).
  - `<template v-for="grp in cloudGroups">` with `:key="grp.providerId"` in Vue2
    source code (:28-38) was placed on the child element `.model-subgroup-label` rather than on
    the `<template>` itself — Vue3 warns/breaks on this (when `<template>` is the v-for root,
    key must be placed directly on `<template>`). Here the key has been moved to `<template v-for>`,
    which is the only structural fix needed in this port; everything else is preserved verbatim.
  - Added Vue3 `emits` declaration (Vue2 relies on implicit `this.$emit` so no declaration needed).

  The "Go to Settings" button (Vue2 :43 `onOpenSettings` → `$emit('open-settings')`) behavior
  itself is unchanged; its **destination** is determined by the mount point (AgentTopbar → AgentPage) —
  in this phase (before P2), the AgentPage side connects it to the same "settings page about to open"
  placeholder toast as the top bar settings button, not an actual route jump. This is a product
  decision from 2026-07-27, not this component's own logic.

  Pure calculation logic (local/cloud grouping, size formatting) extracted to ../../util/modelPickerView.ts;
  this component only handles rendering + interaction state (open/query).
-->
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AgentIcon from '../icons/AgentIcon.vue'
import { useClickOutside } from '../../composables/useClickOutside'
import { splitModels, cloudGroups as buildCloudGroups, formatModelSize } from '../../util/modelPickerView'
import type { AgentModel } from '../../stores/agentStore'

const props = withDefaults(
  defineProps<{
    availableModels?: AgentModel[]
    selectedKey?: string | null
  }>(),
  {
    availableModels: () => [],
    selectedKey: null,
  },
)

const emit = defineEmits<{
  (e: 'select', key: string): void
  (e: 'open-settings'): void
}>()

const { t } = useI18n()

const rootEl = ref<HTMLElement | null>(null)
const open = ref(false)
const query = ref('')

const selectedItem = computed(
  () => props.availableModels.find((m) => m.key === props.selectedKey) || null,
)
const pillLabel = computed(() => {
  if (selectedItem.value) return selectedItem.value.displayName
  return props.availableModels.length === 0 ? t('aiModelSelect') : t('aiModelNotSelected')
})

const splits = computed(() => splitModels(props.availableModels))
const localModels = computed(() => splits.value.local)
const cloudModels = computed(() => splits.value.cloud)
const cloudGroups = computed(() => buildCloudGroups(cloudModels.value, query.value))

function closeDropdown() {
  open.value = false
  query.value = ''
}
useClickOutside(rootEl, closeDropdown)

function onSelect(key: string) {
  emit('select', key)
  open.value = false
  query.value = ''
}

function onOpenSettings() {
  emit('open-settings')
  open.value = false
}
</script>

<template>
  <div class="model-picker" ref="rootEl">
    <button class="model-pill" @click="open = !open">
      <span class="model-pill-icon" :data-source="selectedItem ? selectedItem.source : 'none'">
        <AgentIcon :name="selectedItem && selectedItem.source === 'local' ? 'bot' : 'sparkle'" :size="13" />
      </span>
      <span class="model-pill-name">{{ pillLabel }}</span>
      <AgentIcon name="chevDown" :size="13" />
    </button>

    <div v-if="open" class="model-dropdown">
      <template v-if="availableModels.length > 0">
        <div v-if="localModels.length > 0" class="model-group">
          <div class="model-group-label">💻 {{ t('aiLocalOllama') }}</div>
          <button
            v-for="mdl in localModels"
            :key="mdl.key"
            class="model-option"
            :data-active="mdl.key === selectedKey"
            @click="onSelect(mdl.key)"
          >
            <AgentIcon v-if="mdl.key === selectedKey" name="check" :size="13" />
            <span v-else style="width: 13px"></span>
            <span class="model-option-name">{{ mdl.displayName }}</span>
            <span v-if="mdl.size" class="model-option-meta">{{ formatModelSize(mdl.size) }}</span>
          </button>
        </div>
        <div v-if="cloudModels.length > 0" class="model-group">
          <div class="model-group-label">☁️ {{ t('aiCloudModels') }}</div>
          <input
            v-if="cloudModels.length > 6"
            v-model="query"
            class="model-search"
            type="text"
            :placeholder="t('aiSearchModelsPlaceholder')"
            @click.stop
          />
          <template v-for="grp in cloudGroups" :key="grp.providerId">
            <div class="model-subgroup-label">{{ grp.providerName }}</div>
            <button
              v-for="mdl in grp.models"
              :key="mdl.key"
              class="model-option"
              :data-active="mdl.key === selectedKey"
              @click="onSelect(mdl.key)"
            >
              <AgentIcon v-if="mdl.key === selectedKey" name="check" :size="13" />
              <span v-else style="width: 13px"></span>
              <span class="model-option-name">{{ mdl.displayName }}</span>
              <span v-if="mdl.supports_thinking" class="model-option-meta">🧠</span>
            </button>
          </template>
        </div>
      </template>
      <div v-else class="model-empty">
        <div class="model-empty-text">{{ t('aiModelEmptyText') }}</div>
        <button class="model-empty-btn" @click="onOpenSettings">{{ t('aiGoToSettings') }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/*
  Vue2 shell/ModelPicker.vue:124-125 —— these two rules lived in the
  component's own scoped <style> and were NOT part of the shared .model-*
  block later ported to ../../styles/agent-styles.scss (confirmed absent
  there). Per this phase's brief, agent-styles.scss is not to be touched, so
  they stay local here exactly as in Vue2 — layout-only, no colours.
*/
.model-search {
  width: calc(100% - 16px);
  margin: 4px 8px;
  padding: 4px 8px;
  font-size: 12px;
}
.model-subgroup-label {
  padding: 4px 12px 2px;
  font-size: 11px;
  opacity: 0.6;
}
</style>
