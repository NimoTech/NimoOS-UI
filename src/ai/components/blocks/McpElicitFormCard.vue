<!-- Ported 1:1 from Vue2 src/views/AI/Agent/blocks/McpElicitFormCard.vue -->
<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AgentIcon from '../icons/AgentIcon.vue'
import { useProvidedAgentStore } from '../../composables/useProvidedAgentStore'
import { useConfirmResolve } from '../../composables/useConfirmResolve'
import { validateArrayFields } from '../../util/mcpElicitValidate'
import type { ElicitField } from '../../types/mcpElicit'

const props = withDefaults(defineProps<{
  confirmId?: string
  server?: string
  message?: string
  fields?: ElicitField[]
  // The reason the backend bounced the previous answer (re-ask loop). Empty on the
  // first question.
  error?: string
}>(), { confirmId: '', server: '', message: '', fields: () => [], error: '' })

const { t } = useI18n()
const store = useProvidedAgentStore()
const { decision, submitting, expired, submitError, run, fail } =
  useConfirmResolve<'accept' | 'decline' | 'cancel'>()

const form = ref<HTMLFormElement | null>(null)

// Spec: clients that support defaults SHOULD pre-fill the form with them.
const values = reactive<Record<string, unknown>>({})
for (const f of props.fields) {
  if (f.type === 'multi_enum') values[f.key] = Array.isArray(f.default) ? [...f.default] : []
  else if (f.type === 'boolean') values[f.key] = f.default === true
  else values[f.key] = f.default === null || f.default === undefined ? '' : f.default
}

// Descriptor format -> native input type. The selection principle is "whatever the
// control can produce, the backend is guaranteed to accept":
//   email          -> the regex the browser runs is exactly the backend's, by construction
//   date/date-time -> the control only emits YYYY-MM-DD / YYYY-MM-DDTHH:MM, which is
//                      exactly the shape of the backend's two regexes
//   uri            -> deliberately does **not** use type="url": that constraint is
//                      stricter than the backend's rule and would reject values the
//                      backend would actually accept (e.g. mailto:a@b), leaving the
//                      user stuck on a form that is correctly filled in but unsubmittable
const FORMAT_INPUT_TYPE: Record<string, string> = { email: 'email', date: 'date', 'date-time': 'datetime-local' }

function fieldId(f: ElicitField): string { return `mcc-${props.confirmId}-${f.key}` }

// Descriptor -> DOM attribute. This is the **only** point of contact between the
// frontend and backend rules: it doesn't duplicate the rules, it only declares who
// enforces them. A missing constraint is omitted entirely (rather than emitted as
// undefined), to avoid rendering something like minlength="undefined" which would
// make the browser reject the wrong thing.
function inputAttrs(f: ElicitField): Record<string, unknown> {
  const a: Record<string, unknown> = { type: 'text', required: !!f.required }
  if (f.type === 'integer' || f.type === 'number') {
    a.type = 'number'
    a.step = f.type === 'integer' ? 1 : 'any'
    if (f.minimum !== null && f.minimum !== undefined) a.min = f.minimum
    if (f.maximum !== null && f.maximum !== undefined) a.max = f.maximum
    return a
  }
  if (f.format && FORMAT_INPUT_TYPE[f.format]) a.type = FORMAT_INPUT_TYPE[f.format]
  if (f.min_length !== null && f.min_length !== undefined) a.minlength = f.min_length
  if (f.max_length !== null && f.max_length !== undefined) a.maxlength = f.max_length
  return a
}

// Empty optional fields are omitted entirely: the backend's validate_content treats a
// key that isn't in the schema as an error, and an empty string means nothing for
// anything other than a required field.
function buildPayload(): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const f of props.fields) {
    const v = values[f.key]
    if (v === undefined || v === null || v === '') continue
    if (Array.isArray(v)) { if (v.length) out[f.key] = [...v]; continue }
    if (f.type === 'integer' || f.type === 'number') {
      const n = Number(v)
      out[f.key] = Number.isNaN(n) ? v : n // Send non-numeric values as-is, let the backend report the error
      continue
    }
    out[f.key] = v
  }
  return out
}

async function submit(): Promise<void> {
  // Gate 1: the browser. required / minlength / maxlength / min / max / step /
  // type=email|date|datetime-local are all enforced by it, and it pops its own
  // native hint.
  const el = form.value
  if (el && typeof el.reportValidity === 'function' && !el.reportValidity()) return
  // Gate 2: array rules -- HTML cannot express minItems/maxItems, this is the one
  // hand-written rule.
  const payload = buildPayload()
  const err = validateArrayFields(props.fields, payload, t)
  if (err) { submitError.value = err; return }
  // The authoritative validation lives on the backend. If it bounces the answer, the
  // re-ask loop resends a new card carrying the reason.
  await resolve('accept', payload)
}

async function resolve(action: 'accept' | 'decline' | 'cancel', content: Record<string, unknown> | null = null): Promise<void> {
  if (!props.confirmId) { fail('aiConfirmInvalid'); return }
  await run(action, () => store.resolveElicitation(props.confirmId, action, content))
}
</script>

<template>
  <div class="mcc-perm">
    <!-- expired overrides everything: a consumed confirm_id can never succeed again,
         so the card must stop offering anything clickable -- including the form. -->
    <div v-if="expired" class="mcc-perm-resolved" data-decision="expired">
      <span class="rico"><AgentIcon name="x" :size="13" /></span>
      <span>{{ t('aiConfirmExpired') }}</span>
    </div>
    <div v-else-if="decision" class="mcc-perm-resolved" :data-decision="decision">
      <span class="rico"><AgentIcon :name="decision === 'accept' ? 'check' : 'x'" :size="13" /></span>
      <span v-if="decision === 'accept'">{{ t('aiMcpElicitSent', { server }) }}</span>
      <span v-else-if="decision === 'decline'">{{ t('aiMcpElicitDeclined', { server }) }}</span>
      <span v-else>{{ t('aiMcpElicitCancelled') }}</span>
    </div>
    <template v-else>
      <div class="mcc-perm-ribbon">
        <AgentIcon name="bell" :size="12" />
        {{ t('aiMcpElicitAsk', { server }) }}
        <span class="badge">MCP</span>
      </div>
      <!-- Plain text interpolation: the spec forbids rendering URLs inside
           elicitation copy as clickable links -->
      <div class="mcc-perm-ask">{{ message }}</div>

      <!-- When the backend bounces the previous answer, the reason arrives in `error`
           and must be shown -- otherwise the user will just fill in the same thing again -->
      <div v-if="error" class="mcc-bounced">
        <AgentIcon name="x" :size="12" />
        {{ t('aiMcpElicitBounced', { reason: error }) }}
      </div>

      <form ref="form" class="mcc-fields" @submit.prevent="submit">
        <div v-for="f in fields" :key="f.key" class="mcc-field">
          <label :for="fieldId(f)">
            {{ f.title || f.key }}<span v-if="f.required" class="req">*</span>
          </label>
          <p v-if="f.description" class="hint">{{ f.description }}</p>

          <input
            v-if="f.type === 'string' || f.type === 'integer' || f.type === 'number'"
            :id="fieldId(f)" v-model="values[f.key]" v-bind="inputAttrs(f)" class="mcc-input">

          <label v-else-if="f.type === 'boolean'" class="mcc-check">
            <input v-model="values[f.key]" type="checkbox"> {{ t('aiMcpElicitYes') }}
          </label>

          <select
            v-else-if="f.type === 'enum'" :id="fieldId(f)" v-model="values[f.key]"
            :required="f.required" class="mcc-input">
            <option v-if="!f.required" value="">{{ t('aiMcpElicitUnanswered') }}</option>
            <option v-for="o in (f.options || [])" :key="String(o.value)" :value="o.value">{{ o.title }}</option>
          </select>

          <div v-else-if="f.type === 'multi_enum'" class="mcc-multi">
            <label v-for="o in (f.options || [])" :key="String(o.value)" class="mcc-check">
              <input v-model="values[f.key]" type="checkbox" :value="o.value"> {{ o.title }}
            </label>
          </div>
        </div>
      </form>
      <div class="mcc-perm-foot">
        <button class="mcc-btn primary" :disabled="submitting" @click="submit">
          <AgentIcon name="check" :size="13" /> {{ t('aiMcpElicitSend') }}
        </button>
        <button class="mcc-btn ghost" :disabled="submitting" @click="resolve('decline')">
          {{ t('aiMcpElicitDecline') }}
        </button>
        <button class="mcc-btn deny" :disabled="submitting" @click="resolve('cancel')">
          {{ t('aiMcpElicitCancel') }}
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
.mcc-btn.ghost { background: var(--bg-chip); color: var(--text-secondary); }
.mcc-btn.ghost:hover { background: var(--line); color: var(--text-primary); }
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
/* decision only ever takes accept / decline / cancel -- the allow|always|deny values
   borrowed from McpPermissionCard will never match on this card (Vue2 copied that
   wrong once, and the resolved-state icon never got a color as a result). */
.mcc-perm-resolved[data-decision="accept"] .rico { background: var(--success-soft); color: var(--success); }
.mcc-perm-resolved[data-decision="decline"] .rico,
.mcc-perm-resolved[data-decision="cancel"] .rico { background: var(--danger-soft); color: var(--danger); }
/* expired is not a decision the user made -- neutral gray, not decline's red. */
.mcc-perm-resolved[data-decision="expired"] .rico { background: var(--bg-chip); color: var(--text-tertiary); }
.mcc-perm-resolved[data-decision="expired"] { color: var(--text-tertiary); }
.mcc-fields { padding: 0 16px 4px; display: flex; flex-direction: column; gap: 12px; }
.mcc-field label { display: block; font-size: 12.5px; font-weight: 600; color: var(--text-primary); }
.mcc-field .req { color: var(--danger); margin-left: 3px; }
.mcc-field .hint { margin: 2px 0 6px; font-size: 12px; color: var(--text-tertiary); }
/* Solid background only, no gradient/translucency: Chrome carries a select's
   background into its popup list and it wins over color-scheme, so a translucent
   background renders as white text on white (see newui-css-invisible-failure-guards). */
.mcc-input {
  width: 100%; padding: 7px 10px; font-size: 13px; border-radius: var(--r-sm);
  border: 1px solid var(--line); background: var(--bg-canvas); color: var(--text-primary);
}
.mcc-input:focus { outline: none; border-color: var(--purple); }
.mcc-check { display: inline-flex; align-items: center; gap: 6px; font-weight: 400; font-size: 13px; }
.mcc-multi { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 4px; }
.mcc-bounced {
  display: flex; gap: 7px; margin: 0 16px 10px; padding: 8px 11px;
  border-radius: var(--r-sm); font-size: 12.5px; line-height: 1.5;
  color: var(--danger); background: var(--danger-soft);
}
</style>
