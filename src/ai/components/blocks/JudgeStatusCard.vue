<!-- Mirror of Vue2 src/views/AI/Agent/blocks/JudgeStatusCard.vue (dual-repo
     rule, 2026-08-21). Compact inline status for the local safety judge:
     while `streaming` it shows a live "checking…" row so the user knows why
     the agent paused; once judged it collapses to the outcome (allow = ran
     with no click needed; ask = the confirmation card below explains). -->
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import AgentIcon from '../icons/AgentIcon.vue'

const props = withDefaults(defineProps<{
  kind?: string        // shell | upload
  command?: string
  host?: string
  verdict?: string     // '' | allow | ask | block
  streaming?: boolean
}>(), { kind: 'shell', command: '', host: '', verdict: '', streaming: false })

const { t } = useI18n()

const CMD_CAP = 80

const stateKey = computed(() => (props.streaming ? 'running' : (props.verdict || 'ended')))

const label = computed(() => {
  if (props.streaming) {
    return props.kind === 'upload'
      ? t('aiJudgeCheckingUpload', { host: props.host })
      : t('aiJudgeCheckingShell')
  }
  if (props.verdict === 'allow') return t('aiJudgeAllowed')
  if (props.verdict === 'ask') return t('aiJudgeNeedsConfirm')
  if (props.verdict === 'block') return t('aiJudgeBlocked')
  return t('aiJudgeEnded')
})

const shortCommand = computed(() => {
  const c = props.command || ''
  return c.length > CMD_CAP ? `${c.slice(0, CMD_CAP)}…` : c
})
</script>

<template>
  <div class="judge-row" :data-state="stateKey">
    <span class="judge-ico">
      <span v-if="streaming" class="judge-spinner" />
      <AgentIcon v-else :name="verdict === 'allow' ? 'check' : 'bell'" :size="12" />
    </span>
    <span class="judge-text">{{ label }}</span>
    <code v-if="command" class="judge-cmd" :title="command">{{ shortCommand }}</code>
  </div>
</template>

<style scoped>
.judge-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  margin: 4px 0;
  border-radius: var(--r-md);
  font-size: 12px;
  color: var(--text-secondary);
  background: var(--bg-elevated);
  border: 1px solid var(--line);
  min-width: 0;
}
.judge-row[data-state="allow"] { color: var(--text-tertiary); }
.judge-row[data-state="block"] { border-color: var(--danger); }
.judge-ico { display: inline-flex; align-items: center; flex: none; }
.judge-text { flex: none; white-space: nowrap; }
.judge-cmd {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
  font-size: 11px;
  color: var(--text-tertiary);
  background: transparent;
}
.judge-spinner {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 2px solid var(--line);
  border-top-color: var(--accent);
  animation: judge-spin 0.9s linear infinite;
}
@keyframes judge-spin { to { transform: rotate(360deg); } }
</style>
