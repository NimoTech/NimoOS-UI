<!--
  Prompt revision history for one task: version list (author + time + reason)
  and a git-style side-by-side diff of the selected version against what is
  currently in the editor. Revert only fills the editor (the parent PUTs on
  save), so backing out of a revert is just not saving.
  Ported 1:1 from Vue2 src/views/AI/Tasks/PromptHistoryPanel.vue.
  Styles live in src/ai/styles/tasks.scss (zero-<style> convention).
-->
<template>
  <div class="ph">
    <div v-if="loading" class="set-note">{{ t('aiTasksLoading') }}</div>
    <div v-else-if="errKey" class="set-note">{{ t(errKey) }}</div>
    <div v-else-if="!revisions.length" class="set-note">
      {{ t('aiTasksPromptHistoryEmpty') }}
    </div>
    <template v-else>
      <div class="ph-list">
        <button
          v-for="(rev, idx) in revisions"
          :key="rev.id"
          type="button"
          class="ph-item"
          data-test="ph-item"
          :data-active="selected === idx ? 'true' : 'false'"
          @click="selected = idx"
        >
          <span class="ph-author" :data-by="rev.revised_by">
            {{ t(rev.revised_by === 'agent' ? 'aiTasksPromptByAgent' : 'aiTasksPromptByUser') }}
          </span>
          <span class="ph-time">{{ formatTs(rev.created_at) }}</span>
          <span v-if="rev.reason" class="ph-reason">{{ rev.reason }}</span>
        </button>
      </div>

      <div class="ph-diff-head">
        <span>{{ t('aiTasksPromptDiffSelected') }}</span>
        <span>{{ t('aiTasksPromptDiffCurrent') }}</span>
      </div>
      <div class="ph-diff mono" data-test="ph-diff">
        <div v-for="(row, k) in rows" :key="k" class="ph-row">
          <div class="ph-cell" :data-x="cellMark(row, 'left')">
            {{ row.left === null ? '' : row.left || ' ' }}
          </div>
          <div class="ph-cell" :data-x="cellMark(row, 'right')">
            {{ row.right === null ? '' : row.right || ' ' }}
          </div>
        </div>
      </div>

      <button
        type="button"
        class="sk-btn ghost ph-revert"
        data-test="ph-revert"
        :title="t('aiTasksPromptRevertHint')"
        @click="emit('revert', revisions[selected].prompt)"
      >
        {{ t('aiTasksPromptRevertThis') }}
      </button>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import { diffLines, type DiffRow } from './promptDiff'
import { errorKey, formatTs } from './taskHelpers'

interface Revision {
  id: number
  prompt: string
  revised_by: string
  reason?: string
  created_at?: number
}

const props = defineProps<{
  taskId: string
  // What the selected version is compared AGAINST: the live editor text, so
  // the diff always shows exactly what saving a revert would change.
  current: string
}>()
const emit = defineEmits<{ (e: 'revert', prompt: string): void }>()

const { t } = useI18n()

const revisions = ref<Revision[]>([])
const loading = ref(true)
const errKey = ref('')
const selected = ref(0)

const rows = computed<DiffRow[]>(() => {
  const rev = revisions.value[selected.value]
  return rev ? diffLines(rev.prompt, props.current) : []
})

async function load() {
  loading.value = true
  errKey.value = ''
  try {
    const r = (await service.ai.listPromptRevisions(props.taskId)) as {
      revisions?: Revision[]
    }
    revisions.value = (r && r.revisions) || []
    selected.value = 0
  } catch (e) {
    errKey.value = errorKey(e)
  } finally {
    loading.value = false
  }
}

// 'del' / 'add' paints the changed halves; an empty half renders as a
// hatched filler so unpaired lines still align.
function cellMark(row: DiffRow, side: 'left' | 'right') {
  const val = side === 'left' ? row.left : row.right
  if (val === null) return 'empty'
  if (row.type === 'same') return ''
  return side === 'left' ? 'del' : 'add'
}

void load()
</script>
