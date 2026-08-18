<!-- 1:1 ported from Vue2 src/views/AI/Agent/blocks/McpCallCard.vue -->
<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import AgentIcon from '../icons/AgentIcon.vue'

const props = withDefaults(
  defineProps<{
    server?: string
    tool?: string
    args?: string
    state?: string
    result?: string
    callId?: string
  }>(),
  { server: '', tool: '', args: '{}', state: 'success', result: '', callId: '' },
)
const { t } = useI18n()

const open = ref(false)

const stateLabel = computed(() => {
  if (props.state === 'running') return t('aiMcpCalling')
  if (props.state === 'error') return t('aiFailed')
  return t('aiDone')
})
</script>

<template>
  <div class="mcc-call" :data-open="open ? 'true' : 'false'">
    <div class="mcc-call-head" @click="open = !open">
      <div class="mcc-call-tile"><AgentIcon name="drive" :size="15" color="var(--text-on-accent)" /></div>
      <div class="mcc-call-info">
        <div class="mcc-call-title">
          <span class="via">{{ t('aiViaMcp') }} ·</span> <code>{{ server }}</code>
          <span class="via">/</span> <code>{{ tool }}</code>
        </div>
      </div>
      <span class="mcc-call-state" :data-state="state">
        <AgentIcon v-if="state !== 'running'" :name="state === 'error' ? 'x' : 'check'" :size="11" />
        {{ stateLabel }}
      </span>
      <AgentIcon name="chev" :size="14" class="mcc-call-chev" />
    </div>
    <div v-if="open" class="mcc-call-body">
      <div class="mcc-seg" data-kind="call">
        <div class="mcc-seg-head"><AgentIcon name="upload" :size="11" /> {{ t('aiMcpCallArgs') }}</div>
        <pre>{{ args }}</pre>
      </div>
      <div v-if="state !== 'running'" class="mcc-seg" data-kind="return" :data-error="state === 'error' ? 'true' : 'false'">
        <div class="mcc-seg-head">
          <AgentIcon name="download" :size="11" /> {{ state === 'error' ? t('aiMcpReturnError') : t('aiMcpReturnResult') }}
        </div>
        <pre>{{ result }}</pre>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mcc-call {
  border: 1px solid var(--line); border-radius: var(--r-lg);
  background: var(--bg-elevated); box-shadow: var(--shadow-xs);
  overflow: hidden; max-width: 560px; margin: 2px 0;
}
.mcc-call-head { display: flex; align-items: center; gap: 11px; padding: 11px 13px; cursor: pointer; }
.mcc-call-head:hover { background: var(--bg-chip); }
.mcc-call-tile {
  width: 30px; height: 30px; border-radius: 8px; display: grid; place-items: center;
  color: var(--text-on-accent); flex-shrink: 0; background: linear-gradient(135deg, var(--purple-light), var(--purple));
  box-shadow: var(--gloss-inset);
}
.mcc-call-info { flex: 1; min-width: 0; }
.mcc-call-title { font-size: 13px; color: var(--text-secondary); display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.mcc-call-title .via { color: var(--text-tertiary); }
.mcc-call-title code { font-family: var(--font-mono); font-size: 12.5px; font-weight: 600; color: var(--purple); }
.mcc-call-state {
  display: inline-flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 500;
  padding: 3px 9px; border-radius: 999px; flex-shrink: 0; font-variant-numeric: tabular-nums;
}
.mcc-call-state[data-state="success"] { background: var(--success-soft); color: var(--success); }
.mcc-call-state[data-state="running"] { background: var(--purple-soft); color: var(--purple); }
.mcc-call-state[data-state="error"] { background: var(--danger-soft); color: var(--danger); }
.mcc-call-chev { color: var(--text-quaternary); flex-shrink: 0; transition: transform 160ms ease; }
.mcc-call[data-open="true"] .mcc-call-chev { transform: rotate(90deg); }
.mcc-call-body {
  border-top: 1px solid var(--line-faint); padding: 11px 13px;
  display: flex; flex-direction: column; gap: 9px; background: var(--bg-canvas);
}
.mcc-seg { border-radius: var(--r-md); border: 1px solid var(--line-faint); overflow: hidden; background: var(--bg-elevated); }
.mcc-seg-head { display: flex; align-items: center; gap: 7px; padding: 6px 11px; font-size: 10px; font-weight: 700; letter-spacing: 0.05em; }
.mcc-seg[data-kind="call"] .mcc-seg-head { color: var(--purple); background: var(--purple-soft-faint); border-bottom: 1px solid var(--purple-soft-border); }
.mcc-seg[data-kind="return"] .mcc-seg-head { color: var(--success); background: var(--success-soft-faint); border-bottom: 1px solid var(--success-soft-border); }
.mcc-seg[data-kind="return"][data-error="true"] .mcc-seg-head { color: var(--danger); background: var(--danger-soft-faint); border-bottom: 1px solid var(--danger-soft-border); }
.mcc-seg pre {
  margin: 0; padding: 9px 12px; font-family: var(--font-mono); font-size: 12px; line-height: 1.55;
  color: var(--text-primary); white-space: pre-wrap; word-break: break-word;
}
</style>
