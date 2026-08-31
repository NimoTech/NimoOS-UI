<!--
  1:1 port from Vue2 src/views/AI/Settings/sections/MemorySection.vue (159 lines).

  【D2 declaration】 State remains in component local (ref), direct call to service.ai —
  consistent with Vue2 attribution (Vue2 data() is component local state),
  no store centralization (only blacklist uses store, see BlacklistSection.vue header,
  user decision 2026-07-28).

  【Logic fix 1】 `enabled.value = !!s.enabled` is deliberate deviation: Vue2 writes
  `this.enabled = s.enabled` (MemorySection.vue:105, no `!!`). When backend omits enabled field,
  becomes undefined — SetSwitch receives undefined, renders off, but payload sends undefined back,
  letting backend treat as "unchanged"; reproducible wrong behavior. Add `!!` to normalize.
  Vue2 test case 1 mocks {enabled:false}; assertion unchanged after adding `!!`.

  【Logic fix 2】 saveEnabled/saveCompaction/saveContextWindow/remove failures add danger toast.
  Vue2 all four are silent (MemorySection.vue:122-124/133-135/145-147/153-155;
  remove even has comment `/* keep the item on failure */` explicitly saying "keep, no hint").
  This section is not a mount-triggered multi-section concurrent scenario
  (unlike BlacklistSection mounted silent to avoid toast flood at multi-section mount);
  these are user-initiated save/delete failures. Silent makes user think it succeeded when it didn't;
  adding hints is safer.
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
const contextWindow = ref<string>('') // Matches Vue2: string; empty string means auto

onMounted(async () => {
  await load()
})

// Vue2 MemorySection.vue:112-116 / :126-130 / :140-144 three places send same three-field
// payload; consolidated here.
function payload() {
  return {
    enabled: enabled.value,
    compaction_enabled: compactionEnabled.value,
    // 0 clears the override — the backend treats null as "don't touch",
    // so sending null here silently kept stale overrides forever.
    context_window: contextWindow.value !== '' ? Number(contextWindow.value) : 0,
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
    enabled.value = !!s.enabled // Logic fix 1, see header comment
    compactionEnabled.value = !!s.compaction_enabled
    contextWindow.value = s.context_window != null ? String(s.context_window) : ''
    // Logic fix 3 (final review Fix 5): `|| []` is new defensive fallback here; Vue2 corresponding
    // (MemorySection.vue:108, `this.memories = await ai.listUserMemory()`) lacks this layer —
    // when backend returns null/undefined, Vue2 sets memories to falsy; subsequent
    // `memories.length` throws, `v-for` fails; reproducible wrong behavior, so hardened here.
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
    enabled.value = !enabled.value // Vue2 :119 same rollback
    toast.show(apiErrorMessage(e, t('aiCfgSaveFailed')), 3000, 'danger') // Logic fix 2
  }
}

async function saveCompaction() {
  try {
    await service.ai.putMemorySettings(payload())
  } catch (e) {
    compactionEnabled.value = !compactionEnabled.value
    toast.show(apiErrorMessage(e, t('aiCfgSaveFailed')), 3000, 'danger') // Logic fix 2
  }
}

async function saveContextWindow() {
  const prev = contextWindow.value // Vue2 :138 — save snapshot before request, not read current on fail
  try {
    await service.ai.putMemorySettings(payload())
  } catch (e) {
    contextWindow.value = prev
    toast.show(apiErrorMessage(e, t('aiCfgSaveFailed')), 3000, 'danger') // Logic fix 2
  }
}

async function remove(m: MemoryItem) {
  try {
    await service.ai.deleteUserMemory(m.id)
    memories.value = memories.value.filter((x) => x.id !== m.id)
  } catch (e) {
    // Vue2 :152 comment is "keep the item on failure" — keep item as-is, but add hint (Logic fix 2).
    // Logic fix (final review Fix 2): this is a **delete** failure path; fallback text originally
    // misused t('aiCfgSaveFailed') ("Save failed"), inconsistent with McpTokensSection.vue:146 /
    // ChannelsSection.vue:223,276 which all use t('aiCfgDeleteFailed') ("Delete failed") for delete
    // failures. Vue2 :152-155 no constraint (bare e.message); changed to aiCfgDeleteFailed to align.
    toast.show(apiErrorMessage(e, t('aiCfgDeleteFailed')), 3000, 'danger')
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
                min="1024"
                :placeholder="t('aiCtxDefaultHint')"
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
