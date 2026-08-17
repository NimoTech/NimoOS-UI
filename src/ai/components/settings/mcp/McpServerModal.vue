<!--
  SP8-P4 Task 8 — Ported from Vue2 `NimoOS-UI/src/views/AI/MCP/McpServerModal.vue`
  (216 lines). Add/edit form modal with quick-paste parsing and headers/env KV editor.

  ===== Interface divergence (coordinator ruling 3, authorized) =====
  Vue2 uses `v-if=”modalOpen”` (recreates instance each open, `data()` runs once) + `@close`
  event. This repo follows `../skills/AddSkillModal.vue` pattern, using `v-model:open`
  (component instance created once for entire settings page), and adds `serverError` prop
  for inline error display (Vue2 puts save errors in toast, divergence D5 requires inline,
  following `.sk-field-err` / `.chan-field-err` pattern).
  Persistent instance consequence: Vue2 gets clean form on each open via recreation; this repo
  must explicitly re-derive all fields in `watch(open)` from current `props.server` — not just
  “reset to empty” (AddSkillModal's approach, lacking edit scenario), but “clear on add,
  restore to server's values on edit”, since persistent instance may be used for different
  servers by parent. watch(open) true branch handles both cases.

  ===== Divergence D1 (public constraint §3.1, mandatory) =====
  `parsePaste()`: shared package `service.ai.parseMCPCommand` already `return res.data`
  (`NimoOS-Service/src/ai.ts`), backend `mcp.go:137` is bare object `200`. Vue2 line 166's
  `const p = (resp && resp.data) || {}` always resolves to `{}` here — quick-paste silently
  fails to fill any fields, no error (`{}` falls through to field defaults `|| ''`/`|| []`,
  appears “nothing happened”). This repo uses `await service.ai.parseMCPCommand(cmd)` return
  directly as `McpParsed`, no extra `.data` layer.

  ===== Divergence D5 (public constraint §3.5) =====
  `pasteErr` no longer reads Vue2 line 182's `e.response.data.message` (backend English text,
  hard rule against displaying raw backend text), uses `util/mcpErrorKey.ts` (T3)
  `parseCommandErrorKey(e)` to map to i18n key, `t()` produces localized text.

  ===== N1 (public constraint §3.5.1, follow exactly, confirmed) =====
  Vue2 `valid` (lines 141-146) requires non-empty name; backend `validateAndClean`
  (`mcp.go:273-289`) has zero validation. This repo copies exactly (see computed below),
  **no new validation, no deletion** — design doc §6 decision N1: not "frontend stricter than
  backend” issue, pure UI requirement (unnamed server = unidentifiable blank list entry),
  no data transformation involved.

  ===== N2 (public constraint §3.5.2, follow exactly, confirmed) =====
  `parsePaste()` non-stdio branch (`p.transport !== 'stdio'`) **does not clear `headers`** —
  aligns with Vue2 lines 174-179 else branch clearing only `command`/`argsText`/`env`,
  leaving `headers` alone. stdio branch (lines 168-173) clears `headers` (headers only for
  http/sse). Not oversight but by design: preserving manually-entered headers when parsing
  to http/sse is correct.

  ===== N3 (public constraint §3.5.3, follow exactly, confirmed) =====
  Edit mode cannot clear existing headers/env — both `headers` and `env` refs start empty
  (Vue2 `data(){ headers: [], env: [] }`, lines 132-133), never populate from
  `server.has_headers`/`has_env` because backend never sends plaintext (see
  `types/mcpServer.ts` comments on `has_headers`/`has_env`). `.mcp-kv-hint`
  (`aiMcpSrvKvHint`, “leave empty to keep; fill to replace all”) shown on edit when
  original `has_headers`/`has_env` true, expressing this semantic — matches backend
  `applyReq` (`mcp.go:230-269`) only overwriting fields in request.

  ===== Inline style / placeholder dimensions not colors, copied as-is (public constraint §6) =====
  - `style=”font-family: var(--font-mono); font-size: 12.5px”` (quick-paste input
    line 14, URL input line 42, command input line 65)
  - `style=”grid-template-columns: repeat(3, 1fr)”` (transport three-choice line 31)
  - `argsText` placeholder uses `&#10;` line break (line 73), copied verbatim

  ===== No <style> block, all classes already exist (grep evidence in task report) =====
  `.sk-field*`/`.sk-trig-options`/`.sk-trig-option`/`.sk-btn`/`.sw`/`.save-note`/
  `.sk-field-err` (`sk-shared.scss`) · `.mcp-quickadd-row`/`.mcp-quickadd-err`/
  `.mcp-kv*`/`.mcp-args` (T1 `mcp-styles.scss`). ⚠️ `.mcp-quickadd` (Vue2 line 9, this
  component also copies this class name on quick-add `.sk-field`) has no matching rule in
  `mcp-styles.scss` — Vue2 source is thus; not adding CSS for it.
-->
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import SkModal from '../SkModal.vue'
import AgentIcon from '../../icons/AgentIcon.vue'
import { parseCommandErrorKey } from '../../../util/mcpErrorKey'
import type { McpServer, McpParsed, McpServerFormPayload } from '../../../types/mcpServer'

interface KvRow { k: string; v: string }

// Interface divergence (ruling 3): adds `server` (edit mode data source) and `serverError` (inline error).
const props = defineProps<{
  open: boolean
  server: McpServer | null
  saving: boolean
  serverError: string
}>()

const emit = defineEmits<{
  (e: 'update:open', v: boolean): void
  (e: 'save', payload: McpServerFormPayload): void
}>()

const { t } = useI18n()

// Aligns with Vue2 `computed: { isEdit() { return !!this.server } }` (line 140).
const isEdit = computed(() => !!props.server)

const modalTitle = computed(() => (isEdit.value ? t('aiMcpSrvEditTitle') : t('aiMcpSrvAdd')))

// Aligns with Vue2 `data()` (lines 123-137). Form fields are always component-local refs (public constraint §5).
const name = ref('')
const transport = ref('http')
const url = ref('')
const command = ref('')
const argsText = ref('')
const enabled = ref(true)
const headers = ref<KvRow[]>([])
const env = ref<KvRow[]>([])
const pasteCmd = ref('')
const pasteErr = ref('')
const parsing = ref(false)

const nameInputEl = ref<HTMLInputElement | null>(null)

// Aligns with Vue2 `computed: { valid() {...} }` (lines 141-146).
// N1 (follow exactly): non-empty name is backend-lacking UI requirement, no additional pre-validation allowed.
const valid = computed(() => {
  if (name.value.trim().length === 0) return false
  return transport.value === 'stdio'
    ? command.value.trim().length > 0
    : url.value.trim().length > 0
})

// Aligns with Vue2 `computed: { transports() {...} }` (lines 147-153). name field (HTTP/SSE/STDIO)
// is literal not i18n key, matching Vue2; desc uses t().
const transports = computed(() => [
  { id: 'http', name: 'HTTP', descKey: 'aiMcpSrvTransportHttp' },
  { id: 'sse', name: 'SSE', descKey: 'aiMcpSrvTransportSse' },
  { id: 'stdio', name: 'STDIO', descKey: 'aiMcpSrvTransportStdio' },
])

// Derive form initial values from current props.server — add mode (server=null) clears all,
// edit mode refills except headers/env (N3: headers/env always start empty array, never refill
// plaintext because backend never sends it). See file header "interface divergence" section:
// persistent instance must re-derive each open, cannot read props.server only at creation
// (Vue2's v-if recreation gets that for free).
function resetForm() {
  const s = props.server
  name.value = s ? s.name : ''
  transport.value = s ? s.transport : 'http'
  url.value = s ? s.url : ''
  command.value = s ? (s.command || '') : ''
  argsText.value = s ? (s.args || []).join('\n') : ''
  enabled.value = s ? s.enabled : true
  headers.value = []
  env.value = []
  pasteCmd.value = ''
  pasteErr.value = ''
  parsing.value = false
}

// Aligns with Vue2 `mounted(){ this.$nextTick(() => focus) }` (lines 155-157).
// Uses setTimeout(0) not nextTick — follows AddSkillModal.vue header comment "reka initial focus
// test finding": reka Dialog FocusScope mount-auto-focus and this component's nextTick race at
// microtask level; macro-task delay needed to reliably override default focus on SkModal close
// button, not new divergence but reusing verified existing pattern.
watch(
  () => props.open,
  (v) => {
    if (v) {
      resetForm()
      setTimeout(() => { nameInputEl.value?.focus() }, 0)
    }
  },
  { immediate: true },
)

// Aligns with Vue2 `methods: { parsePaste() {...} }` (lines 159-187).
async function parsePaste() {
  const cmd = pasteCmd.value.trim()
  if (!cmd) return
  parsing.value = true
  pasteErr.value = ''
  try {
    // Divergence D1 (see file header): single-layer fetch, no extra `.data` layer.
    const p = await service.ai.parseMCPCommand(cmd) as McpParsed
    transport.value = p.transport || 'http'
    if (p.transport === 'stdio') {
      command.value = p.command || ''
      argsText.value = (p.args || []).join('\n')
      env.value = Object.keys(p.env || {}).map((k) => ({ k, v: p.env[k] }))
      url.value = ''
      headers.value = []
    } else {
      // N2 (follow exactly, see file header): non-stdio branch doesn't clear headers.
      url.value = p.url || ''
      command.value = ''
      argsText.value = ''
      env.value = []
    }
    if (!name.value.trim() && p.suggested_name) name.value = p.suggested_name
  } catch (e) {
    // Divergence D5 (see file header): no raw backend text, use error_key mapping + t().
    pasteErr.value = t(parseCommandErrorKey(e))
  } finally {
    parsing.value = false
  }
}

// Aligns with Vue2 `methods: { collect(rows) {...} }` (lines 188-195).
function collect(rows: KvRow[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const r of rows) {
    const k = (r.k || '').trim()
    if (k) out[k] = r.v || ''
  }
  return out
}

// Aligns with Vue2 `methods: { parseArgs(text) {...} }` (lines 196-198).
function parseArgs(text: string): string[] {
  return String(text || '').split('\n').map((s) => s.trim()).filter((s) => s.length > 0)
}

// Aligns with Vue2 `methods: { submit() {...} }` (lines 199-213).
// N3 (follow exactly, see file header): `if (!isEdit || Object.keys(x).length)` copied verbatim —
// edit mode with empty KV doesn't include field, matching backend "only overwrite fields in request".
function submit() {
  if (!valid.value) return
  const payload: McpServerFormPayload = {
    name: name.value.trim(),
    transport: transport.value,
    enabled: enabled.value,
  }
  if (transport.value === 'stdio') {
    payload.command = command.value.trim()
    payload.args = parseArgs(argsText.value)
    const e = collect(env.value)
    if (!isEdit.value || Object.keys(e).length) payload.env = e
  } else {
    payload.url = url.value.trim()
    const h = collect(headers.value)
    if (!isEdit.value || Object.keys(h).length) payload.headers = h
  }
  emit('save', payload)
}

function onCancel() {
  emit('update:open', false)
}
</script>

<template>
  <SkModal :open="props.open" :title="modalTitle" @update:open="(v) => emit('update:open', v)">
    <!-- Inline error (interface divergence, ruling 3): Vue2 puts save errors in toast, this repo uses inline,
         following `.sk-field-err` (AddSkillModal.vue line 183) / `.chan-field-err`
         (ChannelsSection.vue line 449), same pattern "appears at body top, before all fields". -->
    <p v-if="props.serverError" class="sk-field-err" role="alert">{{ props.serverError }}</p>

    <div v-if="!isEdit" class="sk-field mcp-quickadd">
      <label class="sk-field-label">
        {{ t('aiMcpSrvQuickAdd') }}
        <span class="sk-field-optional">({{ t('aiMcpSrvQuickAddHint') }})</span>
      </label>
      <div class="mcp-quickadd-row">
        <input
          type="text" data-f="paste" v-model="pasteCmd"
          style="font-family: var(--font-mono); font-size: 12.5px"
          placeholder="npx -y @upstash/context7-mcp"
          @keydown.enter.prevent="parsePaste"
        >
        <button
          type="button" class="sk-btn ghost" data-f="fill"
          :disabled="parsing || !pasteCmd.trim()" @click="parsePaste"
        >
          {{ parsing ? t('aiMcpSrvParsing') : t('aiMcpSrvFillForm') }}
        </button>
      </div>
      <div v-if="pasteErr" class="mcp-quickadd-err">{{ pasteErr }}</div>
    </div>

    <div class="sk-field">
      <label class="sk-field-label">{{ t('aiMcpSrvName') }}</label>
      <input
        ref="nameInputEl" type="text" data-f="name" v-model="name"
        :placeholder="t('aiMcpSrvNamePlaceholder')" @keydown.enter.prevent
      >
    </div>

    <div class="sk-field">
      <label class="sk-field-label">{{ t('aiMcpSrvTransportType') }}</label>
      <div class="sk-trig-options" style="grid-template-columns: repeat(3, 1fr)">
        <button
          v-for="o in transports" :key="o.id" type="button" class="sk-trig-option"
          :data-active="transport === o.id ? 'true' : 'false'" @click="transport = o.id"
        >
          <span class="name">{{ o.name }}</span><span class="desc">{{ t(o.descKey) }}</span>
        </button>
      </div>
    </div>

    <div v-if="transport !== 'stdio'" class="sk-field">
      <label class="sk-field-label">{{ t('aiMcpSrvUrl') }}</label>
      <input
        type="text" data-f="url" v-model="url"
        style="font-family: var(--font-mono); font-size: 12.5px"
        :placeholder="transport === 'sse' ? 'https://example.com/sse' : 'https://example.com/mcp'"
      >
    </div>

    <div v-if="transport !== 'stdio'" class="sk-field">
      <label class="sk-field-label">
        {{ t('aiMcpSrvReqHeaders') }}
        <span class="sk-field-optional">({{ t('aiMcpSrvOptional') }})</span>
      </label>
      <div class="mcp-kv" data-kv="headers">
        <div v-for="(row, i) in headers" :key="'h' + i" class="mcp-kv-row">
          <input data-kvk type="text" :placeholder="t('aiMcpSrvKvKey')" v-model="row.k">
          <input data-kvv type="text" :placeholder="t('aiMcpSrvKvValue')" v-model="row.v">
          <button class="mcp-kv-del" @click="headers.splice(i, 1)"><AgentIcon name="x" :size="12" /></button>
        </div>
      </div>
      <button class="mcp-kv-add" data-add="headers" @click="headers.push({ k: '', v: '' })">
        + {{ t('aiMcpSrvAddHeader') }}
      </button>
      <div v-if="isEdit && props.server?.has_headers" class="mcp-kv-hint">{{ t('aiMcpSrvKvHint') }}</div>
    </div>

    <div v-if="transport === 'stdio'" class="sk-field">
      <label class="sk-field-label">{{ t('aiMcpSrvCommand') }}</label>
      <input
        type="text" data-f="command" v-model="command"
        style="font-family: var(--font-mono); font-size: 12.5px"
        :placeholder="t('aiMcpSrvCommandPlaceholder')"
      >
    </div>

    <div v-if="transport === 'stdio'" class="sk-field">
      <label class="sk-field-label">
        {{ t('aiMcpSrvArgs') }}
        <span class="sk-field-optional">({{ t('aiMcpSrvOnePerLine') }})</span>
      </label>
      <textarea
        data-f="args" v-model="argsText" class="mcp-args" rows="4"
        placeholder="-y&#10;@modelcontextprotocol/server-everything"
      />
    </div>

    <div v-if="transport === 'stdio'" class="sk-field">
      <label class="sk-field-label">
        {{ t('aiMcpSrvEnvVars') }}
        <span class="sk-field-optional">({{ t('aiMcpSrvOptional') }})</span>
      </label>
      <div class="mcp-kv" data-kv="env">
        <div v-for="(row, i) in env" :key="'e' + i" class="mcp-kv-row">
          <input data-kvk type="text" :placeholder="t('aiMcpSrvKvKey')" v-model="row.k">
          <input data-kvv type="text" :placeholder="t('aiMcpSrvKvValue')" v-model="row.v">
          <button class="mcp-kv-del" @click="env.splice(i, 1)"><AgentIcon name="x" :size="12" /></button>
        </div>
      </div>
      <button class="mcp-kv-add" data-add="env" @click="env.push({ k: '', v: '' })">
        + {{ t('aiMcpSrvAddVariable') }}
      </button>
      <div v-if="isEdit && props.server?.has_env" class="mcp-kv-hint">{{ t('aiMcpSrvKvHint') }}</div>
    </div>

    <div class="sk-field">
      <label class="sk-field-label">{{ t('aiCfgEnabled') }}</label>
      <div
        class="sw" :data-on="enabled ? 'true' : 'false'" role="switch"
        :aria-checked="enabled ? 'true' : 'false'" @click="enabled = !enabled"
      />
    </div>

    <template #footerLeft>
      <span class="save-note">
        <AgentIcon name="check" :size="11" />
        {{ t('aiMcpSrvSavedLocally') }}
      </span>
    </template>
    <template #footer>
      <button type="button" class="sk-btn ghost" @click="onCancel">{{ t('aiCancel') }}</button>
      <button type="button" class="sk-btn primary" :disabled="!valid || props.saving" @click="submit">
        <AgentIcon :name="isEdit ? 'check' : 'plus'" :size="13" />
        {{ props.saving ? t('aiCfgSaving') : (isEdit ? t('aiCfgSave') : t('aiMcpSrvAddServer')) }}
      </button>
    </template>
  </SkModal>
</template>
