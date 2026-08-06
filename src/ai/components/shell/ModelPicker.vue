<!--
  1:1 逐字港 Vue2 src/views/AI/Agent/shell/ModelPicker.vue(127 行)。

  Vue2-ism 转换清单(SP8-P1c2 Task 9):
  - `directives: { 'click-outside': {...bind/unbind} }` → `useClickOutside`
    composable(见 ../../composables/useClickOutside.ts 顶部注释)。
  - `<template v-for="grp in cloudGroups">` 的 `:key="grp.providerId"` 在 Vue2
    源码(:28-38)里落在了子元素 `.model-subgroup-label` 上而不是 `<template>`
    本身——Vue3 对此会告警/错乱(`<template>` 作为 v-for 根时 key 必须直接标在
    `<template>` 上)。这里把 key 移到了 `<template v-for>` 上,是本次移植唯一
    需要修正的结构性问题,其余逐字保留。
  - 补齐 Vue3 `emits` 声明(Vue2 靠隐式 `this.$emit` 不需要声明)。

  「去设置」按钮(Vue2 :43 `onOpenSettings` → `$emit('open-settings')`)本身的
  行为不变;它的**去向**由挂载点(AgentTopbar → AgentPage）决定——本期(P2 之前)
  AgentPage 侧把它接到跟顶栏设置按钮同一个"设置页即将开启"占位 toast,而不是真的
  跳转路由,这是 2026-07-27 的产品决策,不是本组件自己的逻辑。

  纯计算逻辑(本地/云分组、size 格式化)拆到 ../../util/modelPickerView.ts,
  组件这里只做渲染 + 交互状态(open/query)。
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
