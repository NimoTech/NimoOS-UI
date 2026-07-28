<!--
  SP8-P2b Task 6 —— 1:1 移植自 Vue2 src/views/AI/Settings/sections/MemorySection.vue(159 行)。

  【D2 申报】状态留在组件本地(ref)、直调 service.ai —— 与 Vue2 归属一致(Vue2 data()
  是组件本地状态),不做 store 集中(只有 blacklist 用 store,见 BlacklistSection.vue
  头注释,用户 2026-07-28 拍板)。

  【逻辑修正 1】`enabled.value = !!s.enabled` 是刻意偏离:Vue2 写的是
  `this.enabled = s.enabled`(MemorySection.vue:105,不加 `!!`)。后端漏 enabled 字段时
  会变成 undefined ——SetSwitch 收到 undefined 渲染成关,但 payload 又把 undefined
  发回去,让后端按「未修改」处理,是个可复现的错误行为。加 `!!` 归一。Vue2 测试第 1
  条 mock 的是 {enabled:false},加 `!!` 后断言不变。

  【逻辑修正 2】saveEnabled/saveCompaction/saveContextWindow/remove 失败时补
  danger toast。Vue2 这四处失败都是静默的(MemorySection.vue:122-124/133-135/
  145-147/153-155,remove 处甚至有注释 `/* keep the item on failure */` 显式说明
  「只保留不提示」)。本分区不属于挂载即触发的多分区并发场景(不像 BlacklistSection
  的 mounted 静默吞是为了避免多分区同时挂载时 toast 糊屏),这几处是用户主动操作后
  的保存/删除失败,静默会让用户以为操作生效了、其实没有,补提示更安全。
-->
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import { useToast } from '../../../../stores/toast'
import { apiErrorMessage } from '../../../util/apiError'
import { kindLabel, sourceLabel } from '../../../util/memoryLabels'
import SetSwitch from '../SetSwitch.vue'
import AgentIcon from '../../icons/AgentIcon.vue'

interface MemoryItem {
  id: string | number
  kind: string
  text: string
  source: string
  recall_count?: number
}

const { t } = useI18n()
const toast = useToast()

const memories = ref<MemoryItem[]>([])
const enabled = ref(true)
const loading = ref(false)
const error = ref(false)
const compactionEnabled = ref(false)
const contextWindow = ref<string>('') // 与 Vue2 一致:字符串,空串表示自动

onMounted(async () => {
  await load()
})

// Vue2 MemorySection.vue:112-116 / :126-130 / :140-144 三处发的是同一个三字段
// payload,这里收成一处。
function payload() {
  return {
    enabled: enabled.value,
    compaction_enabled: compactionEnabled.value,
    context_window: contextWindow.value !== '' ? Number(contextWindow.value) : null,
  }
}

async function load() {
  loading.value = true
  error.value = false
  try {
    const s = (await service.ai.getMemorySettings()) as {
      enabled?: boolean
      compaction_enabled?: boolean
      context_window?: number | null
    }
    enabled.value = !!s.enabled // 逻辑修正 1,见文件头注释
    compactionEnabled.value = !!s.compaction_enabled
    contextWindow.value = s.context_window != null ? String(s.context_window) : ''
    memories.value = ((await service.ai.listUserMemory()) as MemoryItem[]) || []
  } catch {
    error.value = true
  } finally {
    loading.value = false
  }
}

async function saveEnabled() {
  try {
    await service.ai.putMemorySettings(payload())
  } catch (e) {
    enabled.value = !enabled.value // Vue2 :119 同款回滚
    toast.show(apiErrorMessage(e, t('aiCfgSaveFailed')), 3000, 'danger') // 逻辑修正 2
  }
}

async function saveCompaction() {
  try {
    await service.ai.putMemorySettings(payload())
  } catch (e) {
    compactionEnabled.value = !compactionEnabled.value
    toast.show(apiErrorMessage(e, t('aiCfgSaveFailed')), 3000, 'danger') // 逻辑修正 2
  }
}

async function saveContextWindow() {
  const prev = contextWindow.value // Vue2 :138 —— 发请求前先存快照,不是失败时读当前值
  try {
    await service.ai.putMemorySettings(payload())
  } catch (e) {
    contextWindow.value = prev
    toast.show(apiErrorMessage(e, t('aiCfgSaveFailed')), 3000, 'danger') // 逻辑修正 2
  }
}

async function remove(m: MemoryItem) {
  try {
    await service.ai.deleteUserMemory(m.id)
    memories.value = memories.value.filter((x) => x.id !== m.id)
  } catch (e) {
    // Vue2 :152 注释是「keep the item on failure」——保留条目这条照搬,但补提示(逻辑修正 2)。
    toast.show(apiErrorMessage(e, t('aiCfgSaveFailed')), 3000, 'danger')
  }
}

function onEnabledChange(v: boolean) {
  enabled.value = v
  void saveEnabled()
}

function onCompactionChange(v: boolean) {
  compactionEnabled.value = v
  void saveCompaction()
}
</script>

<template>
  <div class="set-inner">
    <div class="set-page-head">
      <h1 class="set-h1">{{ t('aiCfgMemory') }}</h1>
      <p class="set-desc">{{ t('aiCfgMemoryDesc') }}</p>
    </div>

    <div class="sk-section">
      <div class="sk-section-head">
        <div class="sk-section-title">{{ t('aiCfgCrossSessionMemory') }}</div>
      </div>
      <div class="sk-section-body">
        <div v-if="!enabled" class="set-banner warn">
          {{ t('aiCfgMemoryOffBanner') }}
        </div>
        <div class="set-rows">
          <div class="set-row">
            <div class="lbl">
              {{ t('aiCfgEnableMemory') }}
              <span class="sub">{{ t('aiCfgEnableMemorySub') }}</span>
            </div>
            <div class="val end">
              <SetSwitch :model-value="enabled" @change="onEnabledChange" />
            </div>
          </div>
          <div class="set-row">
            <div class="lbl">{{ t('aiCfgContextCompaction') }}</div>
            <div class="val end">
              <SetSwitch :model-value="compactionEnabled" @change="onCompactionChange" />
            </div>
          </div>
          <div class="set-row">
            <div class="lbl">{{ t('aiCfgContextWindow') }}</div>
            <div class="val end">
              <input
                v-model="contextWindow"
                class="set-input num"
                type="number"
                min="1"
                :placeholder="t('aiCfgAutoPlaceholder')"
                @change="saveContextWindow"
              >
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="sk-section">
      <div class="sk-section-head">
        <div class="sk-section-title">{{ t('aiCfgSavedMemories') }}</div>
        <div class="sk-section-hint">{{ memories.length }}</div>
      </div>
      <div class="sk-section-body">
        <div v-if="loading" class="set-note">{{ t('aiCfgLoadingEllipsis') }}</div>
        <div v-else-if="error" class="set-note">{{ t('aiCfgMemoryLoadFailed') }}</div>
        <div v-else-if="memories.length === 0" class="set-note">{{ t('aiCfgNoMemories') }}</div>
        <div v-else v-for="m in memories" :key="m.id" class="mem-row">
          <div class="mem-body">
            <div class="mem-text">{{ m.text }}</div>
            <div class="mem-tags">
              <span class="mem-tag" :data-k="m.kind === 'preference' ? 'pref' : 'fact'">{{ t(kindLabel(m.kind)) }}</span>
              <span class="mem-tag">{{ t(sourceLabel(m.source)) }}</span>
              <span class="mem-tag recall">{{ t('aiCfgRecalledTimes', { n: m.recall_count || 0 }) }}</span>
            </div>
          </div>
          <button class="mem-del" :title="t('aiCfgDeleteMemory')" @click="remove(m)">
            <AgentIcon name="x" :size="14" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
