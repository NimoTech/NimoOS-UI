<!--
  SP8-P2b Task 10 — 1:1 ported from Vue2 src/views/AI/Settings/sections/McpTokensSection.vue (247 lines).
  Pure functions (endpointUrl computed / buildInstruction / buildJson / fmtCreated and fmtLastUsed
  “format milliseconds” core) extracted to ../../../util/mcpConnect.ts in Task 9;
  this component retains only component-scoped state and i18n concatenation.

  [D2 declaration] State lives in component local scope (ref), calling service.ai directly —
  consistent with Vue2 pattern (Vue2 data() is component local state), not centralizing in store.
  User approved on 2026-07-28 (see BlacklistSection.vue header).

  [D1 declaration] Vue2 :91-120's plaintext token modal was hand-written `.sk-modal-bg` bare div
  + `@click.self` to close, replaced with Task 3's SkModal (reka Dialog shell, visual rules unchanged,
  see SkModal.vue header D1). Vue2's `.mcp-x` close button scoped styles now handled by SkModal's
  built-in `.sk-x`, not duplicated here. Vue2 `$buefy.dialog.confirm` (:185-191 delete confirmation)
  → shared AlertDialog; Vue2 `$buefy.dialog.prompt` (:167-174 create token) → shared PromptDialog
  (P2a Task 6 created) — usage pattern and title/confirmText reusing existing action names follow
  the established pattern in ProvidersSection.vue.

  [SkModal three close paths unified] Mask click / Esc / top-right × all go through `update:open(false)`,
  “Done” button goes through the same `onRevealClose` — semantically consistent with Vue2's
  `@click.self=”closeReveal”` and × both going through the same `closeReveal`, see `handleRevealOpenChange` below.

  [Backend response shape verified, correcting brief Step 3 pseudocode] The brief's pseudocode
  wrote load()/createToken() as `res?.data?.tokens` / `res?.data?.token`, which double-counted
  Vue2's axios wrapper: in Vue2, `res` is the axios response, `res.data` is the backend body,
  `res.data.tokens` only has one layer of `.data`. Verified from NimoOS-AI/agent/main.py:232-235
  (`GET /mcp-tokens` returns `{“tokens”: [...]}`) and :221-229 (`POST /mcp-tokens` returns
  `{“id”,”token”,”label”}`) confirming backend body is **flat** structure, no envelope.
  This repo's `service.ai.*` “returns body as-is” = Vue2's `res.data`, so correct mapping is
  `res.tokens` / `res.token` (one less `.data` than brief pseudocode) — common constraints §5
  explicitly forbids “stripping extra .data”, this is exactly where that layer needs removal.
  Defensive `&&` / `|| []` fallback semantics preserved as-is.

  [PromptDialog has no maxlength prop, degradation plan authorized at brief Step 3]
  Vue2 :170 `inputAttrs.maxlength = 64` has no corresponding prop on PromptDialog (P2a shared
  primitive); not adding a prop this cycle (would touch in-flight P2a files), instead using
  `label.slice(0, 64)` in `createToken()` — users can type more but can't save more characters,
  behavior is equivalent degradation, not silent requirement drop.

  [Review gap fix, declared] Vue2 :238-247 (scoped `<style>`) defined styles for three classes:
  `.mcp-x` (now handled by D1's SkModal `.sk-x`, see above), `.mcp-label` (:245), `.mcp-reveal-warn` (:246).
  First landing only handled `.mcp-x` replacement, missed the latter two — template still uses these classes
  (two “pass this to…” labels in plaintext modal + top warning text), no corresponding CSS,
  rendering as unstyled default font/black text, an undeclared 1:1 visual regression. Fix: values preserved
  verbatim (both are pure tokens anyway, `var(--text-secondary)` / `var(--danger)`, no bare color fallbacks,
  no extraction needed), **go into `src/ai/styles/settings-styles.scss`** (no `<style>` block for this component)
  — following Task 8's pattern of moving Vue2 `ObservabilitySection.vue` scoped `.status` to that file,
  **scope expansion, declared**: this is the second time this component moves Vue2 scoped styles there due to
  the “zero `<style>` blocks in section components” convention. Class names unchanged (`mcp-` prefix avoids
  collisions, unlike `.px-msg` which needed renaming). See comment in `settings-styles.scss` at same location;
  regression test in `src/ai/styles/settingsStyles.test.ts` (two assertions in McpTokensSection block).
-->
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import { useToast } from '../../../../stores/toast'
import { apiErrorMessage } from '../../../util/apiError'
import { useCopyFeedback } from '../../../composables/useCopyFeedback'
import {
  mcpEndpointUrl, buildMcpInstruction, buildMcpJson, formatEpochMs, MCP_PLACEHOLDER_TOKEN,
} from '../../../util/mcpConnect'
import AgentIcon from '../../icons/AgentIcon.vue'
import SkModal from '../SkModal.vue'
import AlertDialog from '../../../../components/ui/AlertDialog.vue'
import PromptDialog from '../../../../components/ui/PromptDialog.vue'

interface McpToken {
  id: string | number
  label?: string
  created_at?: number
  last_used_at?: number | null
}

const { t } = useI18n()
const toast = useToast()
const { copiedKey, copy, resetCopied } = useCopyFeedback()

const tokens = ref<McpToken[]>([])
const loading = ref(false)
const error = ref(false)
const revealedToken = ref('')
const showReveal = ref(false)
const promptOpen = ref(false)
const confirmDeleteOpen = ref(false)
const pendingDeleteId = ref<string | number | null>(null)

const endpointUrl = computed(() => mcpEndpointUrl())
const instructionTemplate = computed(() => t('aiCfgMcpInstructionTemplate'))

// Vue2 loads in created(), this repo uses onMounted — equivalent for this component (no SSR,
// no pre-mount timing dependency), consistent with other 6 section patterns.
onMounted(() => { void load() })

async function load() {
  loading.value = true
  error.value = false
  try {
    const res = (await service.ai.listMCPTokens()) as { tokens?: McpToken[] } | null | undefined
    tokens.value = (res && res.tokens) || [] // Vue2 :150 triple fallback, verified backend body is flat, see file header
  } catch {
    error.value = true
  } finally {
    loading.value = false
  }
}

function buildInstruction(token: string): string {
  return buildMcpInstruction(instructionTemplate.value, endpointUrl.value, token)
}

function buildJson(token: string): string {
  return buildMcpJson(endpointUrl.value, token)
}

function openPrompt() {
  promptOpen.value = true
}

// Vue2 :172 `(value || '').trim()` — trim done here, 64-char soft limit done in createToken()
// (see file header).
function onPromptConfirm(value: string) {
  void createToken((value || '').trim())
}

async function createToken(label: string) {
  const trimmedLabel = label.slice(0, 64)
  try {
    const res = (await service.ai.createMCPToken({ label: trimmedLabel })) as { token?: string } | null | undefined
    revealedToken.value = (res && res.token) || ''
    showReveal.value = true
  } catch (e) {
    toast.show(apiErrorMessage(e, t('aiCfgCreateFailed')), 3000, 'danger')
  }
}

function confirmDelete(tk: McpToken) {
  pendingDeleteId.value = tk.id
  confirmDeleteOpen.value = true
}

async function onConfirmDelete() {
  const id = pendingDeleteId.value
  if (id == null) return
  await doDelete(id)
}

async function doDelete(id: string | number) {
  try {
    await service.ai.deleteMCPToken(id)
    tokens.value = tokens.value.filter((x) => x.id !== id)
  } catch (e) {
    toast.show(apiErrorMessage(e, t('aiCfgDeleteFailed')), 3000, 'danger')
  }
}

// When plaintext modal closes: clear plaintext first, then re-fetch list (Vue2 :207-211 same order).
// Clear plaintext must be before await — otherwise during request the plaintext stays in memory/DOM.
async function onRevealClose() {
  // Remove checkmark state: otherwise next time opening modal still has last time's green checkmark,
  // looks like "this is already copied".
  resetCopied()
  showReveal.value = false
  revealedToken.value = ''
  await load()
}

// All three paths (mask click / Esc / top-right ×) unified here (see file header D1).
function handleRevealOpenChange(open: boolean) {
  if (!open) void onRevealClose()
}

function fmtCreated(tk: McpToken): string {
  return `${t('aiCfgCreatedAt')}: ${formatEpochMs(tk.created_at)}`
}

function fmtLastUsed(tk: McpToken): string {
  // Following Task 9 review conclusion: when last_used_at is empty, return bare "never used" string,
  // no prefix (Vue2 :213-216), cannot write as `'last used:' + formatEpochMs(x)` (would render as
  // "last used:-" 1:1 regression).
  if (!tk.last_used_at) return t('aiCfgNeverUsed')
  return `${t('aiCfgLastUsed')}: ${formatEpochMs(tk.last_used_at)}`
}

// SP8-P2b acceptance round 5: copy feedback (toast + "copied" checkmark state) unified via useCopyFeedback,
// with only one button showing checkmark, copying something else auto-resets.
// Requirements and design rationale in file header.
</script>

<template>
  <div class="set-inner">
    <div class="set-page-head">
      <h1 class="set-h1">{{ t('aiCfgMcpTokens') }}</h1>
      <p class="set-desc">{{ t('aiCfgMcpTokensDesc') }}</p>
    </div>

    <!-- A. connection info -->
    <div class="sk-section">
      <div class="sk-section-head">
        <div class="sk-section-title">{{ t('aiCfgMcpEndpoint') }}</div>
      </div>
      <div class="sk-section-body">
        <div class="set-rows">
          <div class="set-row top">
            <div class="lbl">{{ t('aiCfgMcpEndpointUrl') }}</div>
            <div class="val">
              <div class="set-copy">
                <input class="set-input full mono" :value="endpointUrl" readonly>
                <button class="set-copybtn" :class="{ done: copiedKey === 'endpoint' }"
                  @click="copy(endpointUrl, 'endpoint')">
                  <AgentIcon :name="copiedKey === 'endpoint' ? 'check' : 'copy'" :size="13" /> {{ t('aiCopy') }}
                </button>
              </div>
            </div>
          </div>
        </div>
        <div class="set-banner">
          <span class="ico"><AgentIcon name="key" :size="12" /></span>
          <span>{{ t('aiCfgMcpEndpointBanner') }}</span>
        </div>
      </div>
    </div>

    <!-- A2. onboarding (persistent, placeholder token) -->
    <div class="sk-section">
      <div class="sk-section-head">
        <div class="sk-section-title">{{ t('aiCfgConnectAnAgent') }}</div>
      </div>
      <div class="sk-section-body">
        <div class="set-rows">
          <div class="set-row top">
            <div class="lbl">{{ t('aiCfgGiveThisToAgent') }}</div>
            <div class="val">
              <div class="set-copy">
                <textarea
                  class="set-input code" :value="buildInstruction(MCP_PLACEHOLDER_TOKEN)"
                  readonly rows="7"
                />
                <button class="set-copybtn" :class="{ done: copiedKey === 'tmpl-instruction' }"
                  @click="copy(buildInstruction(MCP_PLACEHOLDER_TOKEN), 'tmpl-instruction')">
                  <AgentIcon :name="copiedKey === 'tmpl-instruction' ? 'check' : 'copy'" :size="13" /> {{ t('aiCopy') }}
                </button>
              </div>
            </div>
          </div>
          <div class="set-row top">
            <div class="lbl">{{ t('aiCfgOrPasteIntoConfig') }}</div>
            <div class="val">
              <div class="set-copy">
                <textarea class="set-input code" :value="buildJson(MCP_PLACEHOLDER_TOKEN)" readonly rows="7" />
                <button class="set-copybtn" :class="{ done: copiedKey === 'tmpl-json' }"
                  @click="copy(buildJson(MCP_PLACEHOLDER_TOKEN), 'tmpl-json')">
                  <AgentIcon :name="copiedKey === 'tmpl-json' ? 'check' : 'copy'" :size="13" /> {{ t('aiCopy') }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- B & C. tokens list -->
    <div class="sk-section">
      <div class="sk-section-head">
        <div class="sk-section-title">{{ t('aiCfgTokens') }}</div>
        <div class="sk-section-hint">{{ tokens.length }}</div>
        <button class="sk-btn primary" style="margin-left:auto" @click="openPrompt">
          <AgentIcon name="plus" :size="13" /> {{ t('aiCfgCreateToken') }}
        </button>
      </div>
      <div class="sk-section-body">
        <div v-if="loading" class="set-note">{{ t('aiCfgLoadingDots') }}</div>
        <div v-else-if="error" class="set-note">{{ t('aiCfgLoadFailed') }}</div>
        <div v-else-if="!tokens.length" class="set-note">{{ t('aiCfgNoTokensYet') }}</div>
        <div v-else v-for="tk in tokens" :key="tk.id" class="tok-row">
          <span class="tok-ic"><AgentIcon name="key" :size="16" /></span>
          <div class="tok-body">
            <div class="tok-name">{{ tk.label || t('aiCfgNoLabel') }}</div>
            <div class="tok-meta">
              <span>{{ fmtCreated(tk) }}</span>
              <span class="sep" />
              <span :class="{ never: !tk.last_used_at }">{{ fmtLastUsed(tk) }}</span>
            </div>
          </div>
          <button class="tok-del" @click="confirmDelete(tk)">
            <AgentIcon name="trash" :size="13" /> {{ t('aiCfgDelete') }}
          </button>
        </div>
      </div>
    </div>

    <!-- reveal modal: plaintext + inlined onboarding shown once -->
    <SkModal :open="showReveal" :title="t('aiCfgTokenCreated')" @update:open="handleRevealOpenChange">
      <p class="mcp-reveal-warn">{{ t('aiCfgTokenShownOnce') }}</p>
      <div class="set-copy">
        <input class="set-input full mono" :value="revealedToken" readonly>
        <button class="set-copybtn" :class="{ done: copiedKey === 'token' }"
                  @click="copy(revealedToken, 'token')">
          <AgentIcon :name="copiedKey === 'token' ? 'check' : 'copy'" :size="13" /> {{ t('aiCopy') }}
        </button>
      </div>
      <label class="mcp-label">{{ t('aiCfgGiveThisToAgent') }}</label>
      <div class="set-copy">
        <textarea class="set-input code" :value="buildInstruction(revealedToken)" readonly rows="6" />
        <button class="set-copybtn" :class="{ done: copiedKey === 'reveal-instruction' }"
                  @click="copy(buildInstruction(revealedToken), 'reveal-instruction')">
          <AgentIcon :name="copiedKey === 'reveal-instruction' ? 'check' : 'copy'" :size="13" /> {{ t('aiCopy') }}
        </button>
      </div>
      <label class="mcp-label">{{ t('aiCfgOrPasteIntoConfig') }}</label>
      <div class="set-copy">
        <textarea class="set-input code" :value="buildJson(revealedToken)" readonly rows="7" />
        <button class="set-copybtn" :class="{ done: copiedKey === 'reveal-json' }"
                  @click="copy(buildJson(revealedToken), 'reveal-json')">
          <AgentIcon :name="copiedKey === 'reveal-json' ? 'check' : 'copy'" :size="13" /> {{ t('aiCopy') }}
        </button>
      </div>
      <template #footer>
        <button class="sk-btn primary" @click="onRevealClose">{{ t('aiDone') }}</button>
      </template>
    </SkModal>

    <AlertDialog
      v-model:open="confirmDeleteOpen"
      :title="t('aiCfgDelete')"
      :message="t('aiCfgDeleteTokenConfirm')"
      :confirm-text="t('aiCfgDelete')"
      :cancel-text="t('aiCancel')"
      destructive
      @confirm="onConfirmDelete"
    />

    <PromptDialog
      v-model:open="promptOpen"
      :title="t('aiCfgCreateToken')"
      :message="t('aiCfgTokenLabelPrompt')"
      :placeholder="t('aiCfgTokenLabel')"
      :confirm-text="t('aiCfgCreateToken')"
      :cancel-text="t('aiCancel')"
      @confirm="onPromptConfirm"
    />
  </div>
</template>
