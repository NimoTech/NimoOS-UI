<!-- 1:1 移植自 Vue2 src/views/AI/Agent/blocks/McpInstallCard.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import AgentIcon from '../icons/AgentIcon.vue'
import { useProvidedAgentStore } from '../../composables/useProvidedAgentStore'
import { useConfirmResolve } from '../../composables/useConfirmResolve'

const props = withDefaults(
  defineProps<{
    confirmId?: string
    name?: string
    transport?: string
    command?: string
    args?: string[]
    url?: string
  }>(),
  { confirmId: '', name: '', transport: '', command: '', args: () => [], url: '' },
)
const { t } = useI18n()
const store = useProvidedAgentStore()
const { decision, submitting, expired, submitError, run, fail } =
  useConfirmResolve<'allow' | 'deny'>()

const display = computed(() => {
  if (props.transport === 'stdio') {
    return [props.command].concat(props.args || []).join(' ')
  }
  return props.url
})

async function resolve(confirmed: boolean): Promise<void> {
  if (!props.confirmId) { fail('aiConfirmInvalid'); return }
  await run(
    confirmed ? 'allow' : 'deny',
    () => store.confirmAgentAction(props.confirmId, confirmed, false),
  )
}
</script>

<template>
  <div class="mcc-perm">
    <!-- expired overrides everything: a consumed confirm_id can never succeed again,
         so the card must stop offering anything clickable. -->
    <div v-if="expired" class="mcc-perm-resolved" data-decision="expired">
      <span class="rico"><AgentIcon name="x" :size="13" /></span>
      <span>{{ t('aiConfirmExpired') }}</span>
    </div>
    <div v-else-if="decision" class="mcc-perm-resolved" :data-decision="decision">
      <span class="rico"><AgentIcon :name="decision === 'deny' ? 'x' : 'check'" :size="13" /></span>
      <span v-if="decision === 'allow'">{{ t('aiMcpRegistered', { name }) }}</span>
      <span v-else>{{ t('aiMcpRegDeclined') }}</span>
    </div>
    <template v-else>
      <div class="mcc-perm-ribbon">
        <AgentIcon name="bell" :size="12" />
        {{ t('aiMcpRegisterAsk') }}
        <span class="badge">MCP</span>
      </div>
      <div class="mcc-perm-ask">
        <div>{{ t('aiMcpRegisterConfirm', { name }) }}</div>
        <code class="mcc-cmd">{{ display }}</code>
      </div>
      <div class="mcc-perm-foot">
        <button class="mcc-btn primary mcc-allow" :disabled="submitting" @click="resolve(true)">
          <AgentIcon name="check" :size="13" /> {{ t('aiRegister') }}
        </button>
        <button class="mcc-btn deny mcc-deny" :disabled="submitting" @click="resolve(false)">
          {{ t('aiDeny') }}
        </button>
        <span v-if="submitError" class="mcc-err">{{ submitError }}</span>
      </div>
    </template>
  </div>
</template>

<style scoped>
.mcc-perm {
  border: 1px solid var(--line); border-radius: var(--r-lg);
  background: var(--bg-elevated); box-shadow: var(--shadow-sm);
  overflow: hidden; max-width: 560px; margin: 2px 0;
}
.mcc-perm-ribbon {
  display: flex; align-items: center; gap: 7px; padding: 7px 14px;
  font-size: 11px; font-weight: 600; color: var(--purple);
  background: var(--purple-soft); border-bottom: 1px solid var(--purple-soft-border);
}
.mcc-perm-ribbon .badge {
  margin-left: auto; font-family: var(--font-mono); font-size: 10px; font-weight: 600;
  padding: 1px 7px; border-radius: 999px;
  background: var(--purple-soft-border); color: var(--purple); text-transform: uppercase;
}
.mcc-perm-ask { padding: 12px 16px; font-size: 13.5px; line-height: 1.55; color: var(--text-secondary); }
.mcc-cmd {
  display: block; margin-top: 8px; font-family: var(--font-mono); font-size: 12px;
  background: var(--bg-canvas); border: 1px solid var(--line-faint);
  border-radius: var(--r-sm); padding: 8px 10px; word-break: break-all; color: var(--text-primary);
}
.mcc-perm-foot {
  display: flex; align-items: center; gap: 8px; padding: 12px 16px;
  border-top: 1px solid var(--line-faint); background: var(--bg-canvas); flex-wrap: wrap;
}
.mcc-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  padding: 8px 14px; border-radius: var(--r-sm); font-size: 13px; font-weight: 500;
  border: 0; cursor: pointer; transition: all 120ms ease; white-space: nowrap;
}
.mcc-btn[disabled] { opacity: 0.6; cursor: not-allowed; }
.mcc-btn.primary { background: var(--purple); color: var(--text-on-accent); }
.mcc-btn.primary:hover { filter: brightness(1.06); }
.mcc-btn.deny { background: transparent; color: var(--text-tertiary); margin-left: auto; }
.mcc-btn.deny:hover { color: var(--danger); background: var(--danger-soft); }
.mcc-err { font-size: 12px; color: var(--danger); width: 100%; }
.mcc-perm-resolved {
  display: flex; align-items: center; gap: 10px; padding: 12px 16px;
  font-size: 13px; color: var(--text-secondary); background: var(--bg-canvas);
}
.mcc-perm-resolved .rico { width: 22px; height: 22px; border-radius: 6px; flex-shrink: 0; display: grid; place-items: center; }
.mcc-perm-resolved[data-decision="allow"] .rico { background: var(--success-soft); color: var(--success); }
.mcc-perm-resolved[data-decision="deny"] .rico { background: var(--danger-soft); color: var(--danger); }
/* expired is not a decision the user made -- neutral gray, not deny's red. */
.mcc-perm-resolved[data-decision="expired"] .rico { background: var(--bg-chip); color: var(--text-tertiary); }
.mcc-perm-resolved[data-decision="expired"] { color: var(--text-tertiary); }
</style>
