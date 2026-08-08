<!-- Ported 1:1 from Vue2 src/views/AI/Agent/blocks/McpElicitUrlCard.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import AgentIcon from '../icons/AgentIcon.vue'
import { useProvidedAgentStore } from '../../composables/useProvidedAgentStore'
import { useConfirmResolve } from '../../composables/useConfirmResolve'

// The string passed to window.open is **entirely controlled by the third-party MCP
// server**, so this is an allowlist rather than a blocklist. javascript: runs, in
// several browsers, inside a document that still inherits the opener's origin;
// data: and blob: render the attacker's own HTML, and what the user reads is "a page
// NimoOS opened for me"; a registered custom scheme launches a local program
// directly. None of these are "go authorize on the external site".
// The backend (elicitation.py::_ALLOWED_URL_SCHEMES) already blocks this once, and
// that is not a reason to skip it here: this repo and NimoOS-AI ship on independent
// release cycles, so a user can perfectly well be running a new frontend against an
// old backend.
const OPENABLE_URL_RE = /^https?:\/\//i

const props = withDefaults(defineProps<{
  confirmId?: string
  server?: string
  message?: string
  url?: string
  host?: string
  // Punycode spelling of host, non-empty **only when it differs from host** (see the
  // backend's _host_flags)
  hostAscii?: string
  punycode?: boolean
  insecure?: boolean
}>(), {
  confirmId: '', server: '', message: '', url: '', host: '',
  hostAscii: '', punycode: false, insecure: false,
})

const { t } = useI18n()
const store = useProvidedAgentStore()
const { decision, submitting, expired, submitError, run, fail } =
  useConfirmResolve<'accept' | 'cancel'>()

// Host highlighting: the full URL must stay visible (the spec requires showing the
// complete URL), but the host should visually stand out, because that is the only
// part the user can actually use to judge "should I sign in here". Uses indexOf
// rather than split: the same string can recur later in the path, and split would
// cut on the wrong occurrence.
const urlParts = computed(() => {
  const url = props.url || ''
  const host = props.host || ''
  const at = host ? url.indexOf(host) : -1
  if (at < 0) return { before: '', host: '', after: url }
  return { before: url.slice(0, at), host, after: url.slice(at + host.length) }
})

async function openAndAccept(): Promise<void> {
  if (submitting.value || expired.value) return
  // Scheme allowlist: see the comment at the top of the file. The "not HTTPS" line
  // on the card is only advice, not a gate -- the gate is here, and a rejected
  // scheme reports an error instead of opening anything.
  if (!OPENABLE_URL_RE.test(String(props.url || '').trim())) {
    fail('aiMcpElicitUrlBlocked')
    return
  }
  // noopener,noreferrer: don't hand the third-party page a window.opener, and don't
  // leak the referrer.
  window.open(props.url, '_blank', 'noopener,noreferrer')
  // Reply accept immediately. Per spec, accept only means "the user agreed to go
  // through with this interaction", not that the interaction has completed. Against
  // a real OAuth server the authorization has most likely not landed yet by the time
  // the original request is resent, so this typically ends in the round budget being
  // exhausted -- the backend's _rounds_exceeded_msg then tells the model to ask the
  // user to finish authorizing and retry.
  await resolve('accept')
}

async function resolve(action: 'accept' | 'cancel'): Promise<void> {
  if (!props.confirmId) { fail('aiConfirmInvalid'); return }
  await run(action, () => store.resolveElicitation(props.confirmId, action, null))
}
</script>

<template>
  <div class="mcc-perm">
    <!-- Expired wins over everything: a consumed confirm_id can never succeed again.
         It matters more here than on the form card -- "Open and authorize" opens a
         third-party tab before the doomed POST is even attempted. -->
    <div v-if="expired" class="mcc-perm-resolved" data-decision="expired">
      <span class="rico"><AgentIcon name="x" :size="13" /></span>
      <span>{{ t('aiConfirmExpired') }}</span>
    </div>
    <div v-else-if="decision" class="mcc-perm-resolved" :data-decision="decision">
      <span class="rico"><AgentIcon :name="decision === 'accept' ? 'check' : 'x'" :size="13" /></span>
      <span v-if="decision === 'accept'">{{ t('aiMcpElicitUrlOpened') }}</span>
      <span v-else>{{ t('aiMcpElicitCancelled') }}</span>
    </div>
    <template v-else>
      <div class="mcc-perm-ribbon">
        <AgentIcon name="bell" :size="12" />
        {{ t('aiMcpElicitUrlAsk', { server }) }}
        <span class="badge">MCP</span>
      </div>
      <!-- Plain text interpolation: the spec only allows the url field itself to be
           clickable -->
      <div class="mcc-perm-ask">{{ message }}</div>

      <div class="mcc-url">
        <span class="dim">{{ urlParts.before }}</span><!--
        --><span class="host">{{ urlParts.host }}</span><!--
        --><span class="dim">{{ urlParts.after }}</span>
      </div>

      <div v-if="punycode" class="mcc-alarm">
        <AgentIcon name="x" :size="12" />
        <span>
          {{ t('aiMcpElicitUrlIdn') }}
          <!-- The backend only sends hostAscii when the encoded and displayed forms
               differ -- exactly the case the user cannot tell apart by eye. Showing
               both spellings side by side gives them something to judge from. -->
          <span v-if="hostAscii" class="ascii">{{ t('aiMcpElicitUrlPuny', { host: hostAscii }) }}</span>
        </span>
      </div>
      <div v-if="insecure" class="mcc-alarm">
        <AgentIcon name="x" :size="12" />
        {{ t('aiMcpElicitUrlInsecure') }}
      </div>

      <div class="mcc-perm-foot">
        <button class="mcc-btn primary" :disabled="submitting" @click="openAndAccept">
          <AgentIcon name="check" :size="13" /> {{ t('aiMcpElicitUrlOpen') }}
        </button>
        <button class="mcc-btn deny" :disabled="submitting" @click="resolve('cancel')">
          {{ t('aiMcpElicitCancel') }}
        </button>
        <span class="mcc-note">{{ t('aiMcpElicitUrlNote') }}</span>
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
.mcc-perm-ask {
  padding: 12px 16px; font-size: 13.5px; line-height: 1.55; color: var(--text-secondary);
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
.mcc-perm-resolved .rico {
  width: 22px; height: 22px; border-radius: 6px; flex-shrink: 0;
  display: grid; place-items: center;
}
/* decision only ever takes accept / cancel on this card. */
.mcc-perm-resolved[data-decision="accept"] .rico { background: var(--success-soft); color: var(--success); }
.mcc-perm-resolved[data-decision="cancel"] .rico { background: var(--danger-soft); color: var(--danger); }
/* Expired is not a decision the user made -- neutral gray, not cancel's red. */
.mcc-perm-resolved[data-decision="expired"] .rico { background: var(--bg-chip); color: var(--text-tertiary); }
.mcc-perm-resolved[data-decision="expired"] { color: var(--text-tertiary); }
.mcc-url {
  margin: 0 16px 10px; padding: 9px 11px; border-radius: var(--r-sm);
  background: var(--bg-canvas); border: 1px solid var(--line);
  font-family: var(--font-mono); font-size: 12px; line-height: 1.5;
  word-break: break-all;
}
.mcc-url .dim { color: var(--text-tertiary); }
.mcc-url .host { color: var(--text-primary); font-weight: 700; background: var(--purple-soft); }
.mcc-alarm {
  display: flex; gap: 7px; margin: 0 16px 10px; padding: 8px 11px;
  border-radius: var(--r-sm); font-size: 12.5px; line-height: 1.5;
  color: var(--danger); background: var(--danger-soft);
}
.mcc-alarm .ascii {
  display: block; margin-top: 4px;
  font-family: var(--font-mono); font-size: 12px; word-break: break-all;
}
.mcc-note { font-size: 11.5px; color: var(--text-tertiary); width: 100%; }
</style>
