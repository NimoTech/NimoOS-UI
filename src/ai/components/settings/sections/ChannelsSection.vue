<!--
  SP8-P2b Task 12 — 1:1 ported from Vue2 src/views/AI/Settings/sections/ChannelsSection.vue (410 lines).
  Pure functions (bindingLabel / pairInstructions split-join / channelsBotTokenTail
  split-join) extracted to ../../../util/channelsFormat.ts in Task 11;
  this component retains only component-scoped state and i18n concatenation.

  [D2 declaration] State lives in component local scope (ref), calling service.ai directly —
  consistent with Vue2 pattern (Vue2 data() is component local state), not centralizing
  in store. User approved on 2026-07-28 (see BlacklistSection.vue header).

  [D1 declaration] Vue2 :46-80 (add bot) and :140-160 (pairing code plaintext) had two
  places with hand-written `.sk-modal-bg` bare divs + `@click.self` to close, replaced
  with Task 3's SkModal (reka Dialog shell, visual rules unchanged, see SkModal.vue header D1).
  Vue2 `$buefy.dialog.confirm` (:287-293 delete bot, :341-347 unbind) → shared AlertDialog.
  Both are "pure action after confirmation, cancel needs no state restoration"
  (unlike Task 8's switch pattern "cancel must restore", no watch(open)+confirmed flag here),
  same technique as McpTokensSection.vue's confirmDeleteOpen/pendingDeleteId.
  The `.chan-x` close button scoped styles in Vue2 are now handled by SkModal's built-in `.sk-x`,
  not duplicated here.

  [Scope expansion, declared: style location diverges from brief] Brief Step 3 originally said
  to move Vue2's :387-410 nine `.chan-*` rules "into this component's <style scoped>" —
  but that was before brief reconciliation; the phase-wide standard pattern
  (constraints §4, verified twice by BlacklistSection/.px-msg and McpTokensSection/.mcp-label)
  is zero <style> blocks in section components. Following the latter, not the brief:
  the nine rules (`.chan-x`/`.chan-x:hover` now handled by SkModal, not moved) go to
  `src/ai/styles/settings-styles.scss` (same location as McpTokensSection),
  regression test in `src/ai/styles/settingsStyles.test.ts` added ChannelsSection block.
  Values preserved verbatim; Vue2's original nine are all `var(--…)` anyway, no bare colors to extract.

  [Non-ported item, declared] Vue2 :192-195 has `watch: { isAdmin(v) { if (v && !this.instances.length)
  this.loadInstances() } } }`, for runtime role switch scenarios (login, role changes from user
  to admin) to re-fetch admin data. In this repo isAdmin is computed reading localStorage
  (see useSessionStore header), unchanged within one component instance lifecycle (role changes
  go through full page reload, no "role flip mid-instance" intermediate state exists) —
  this watch can never fire here, so not ported, no corresponding test written.

  ⚠️ Bot enable toggle is native `<input type="checkbox">` wrapped in `<label class="chan-switch">`,
  not SetSwitch — Vue2 is the same (:34-37), carried over as-is, not "tidied up" to SetSwitch
  (UI change, out of porting scope).
-->
<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import { useSessionStore } from '../../../../stores/session'
import { useToast } from '../../../../stores/toast'
import { apiErrorMessage } from '../../../util/apiError'
import { useCopyFeedback } from '../../../composables/useCopyFeedback'
import {
  bindingLabel, fillPairInstructions, fillTokenTail, addBotErrorKey, type ChannelBinding,
} from '../../../util/channelsFormat'
import { buildCloudModelList, type AgentModel } from '../../../stores/agentStore'
import AgentIcon from '../../icons/AgentIcon.vue'
import ModelPicker from '../../shell/ModelPicker.vue'
import SkModal from '../SkModal.vue'
import AlertDialog from '../../../../components/ui/AlertDialog.vue'

interface ChannelInstance {
  id: string | number
  name?: string
  channel_type?: string
  bot_username?: string
  token_tail?: string
  invite_url?: string
  enabled?: boolean
}

const { t } = useI18n()
const toast = useToast()
const { copiedKey, copy, resetCopied } = useCopyFeedback()
const session = useSessionStore()
const isAdmin = computed(() => session.isAdmin)

const pairable = ref<ChannelInstance[]>([])
const pairLoading = ref(false)
const bindings = ref<ChannelBinding[]>([])
const loading = ref(false)
const error = ref(false)
const availableModels = ref<AgentModel[]>([])
const showCode = ref(false)
const revealedCode = ref('')
const codeInstance = ref<ChannelInstance | null>(null)
const instances = ref<ChannelInstance[]>([])
const instLoading = ref(false)
const showAdd = ref(false)
const newName = ref('')
const newToken = ref('')
const newType = ref<'telegram' | 'discord'>('telegram')
const adding = ref(false)
// [Declaration-level divergence from Vue2 1:1, user approved at 2026-07-30 acceptance]
// Vue2 :270-272 showed danger toast on add bot failure; user requested changing to
// "error message inline above token input field" and explicitly said "don't use the old
// Vue2 pattern anymore". So this ref carries the error, template renders it before the token
// field's <input>, addBot()'s catch no longer calls toast.show.
// Clear timing in the three watches below (change token / switch platform / toggle modal).
const addError = ref('')
const confirmDeleteBotOpen = ref(false)
const confirmUnbindOpen = ref(false)
const pendingBotId = ref<string | number | null>(null)
const pendingBindingId = ref<string | number | null>(null)

// ---- Feishu channel card (settings parity 2026-08-24, Vue2 :43-66/:194-354) ----
// Feishu sits in the same list as the token bots, but it is not one: it
// carries no token (lark-cli holds the credentials) and so has an
// enable/disable pair instead of a token tail and a switch.
interface LarkStatus {
  enabled?: boolean
  open_id?: string
  name?: string
  buttons_ready?: boolean
}
// How long to wait after a successful enable before re-reading the Feishu
// status. The click consumer needs one WebSocket handshake to report ready;
// this is a single delayed re-check, not a poll.
const LARK_CONNECT_RECHECK_MS = 3000
const lark = ref<LarkStatus>({ enabled: false, open_id: '', name: '', buttons_ready: false })
const larkBusy = ref(false)
// The POST response can never report buttons_ready: readiness only arrives
// once lark-cli's event consumer has finished a real WebSocket round-trip,
// which is strictly after the request returns. Without this flag every
// successful enable painted the red degraded banner and then never cleared
// it (nothing re-fetched).
const larkConnecting = ref(false)
let larkConnectTimer: ReturnType<typeof setTimeout> | null = null

// Feishu is listed in this section but is only a configured channel once it
// is enabled — an unenabled row is an offer, not a bot.
const botCount = computed(() => instances.value.length + (lark.value.enabled ? 1 : 0))
// Enabled but no click consumer. Suppressed while `larkConnecting`: straight
// after an enable, buttons_ready is deterministically false and says nothing
// about health, so reporting it as degraded is a guaranteed false alarm.
const larkDegraded = computed(
  () => !!lark.value.enabled && !lark.value.buttons_ready && !larkConnecting.value,
)

const pairInstructions = computed(() =>
  fillPairInstructions(t('aiCfgChannelsPairInstructions'), codeInstance.value?.bot_username || '', revealedCode.value),
)

// Vue2 triggered four loads synchronously in created(), this repo uses onMounted —
// equivalent for this component (no SSR, no pre-mount timing dependency), consistent with
// other section patterns. See file header "Non-ported items" for isAdmin watch declaration.
onMounted(() => {
  void loadPairable()
  void loadBindings()
  void loadModels()
  if (isAdmin.value) {
    void loadInstances()
    void loadLark()
  }
})

onBeforeUnmount(() => {
  clearLarkConnectTimer()
})

async function loadPairable() {
  pairLoading.value = true
  try {
    const res = (await service.ai.listPairableChannelInstances()) as { instances?: ChannelInstance[] } | null | undefined
    pairable.value = (res && res.instances) || [] // Vue2 :207-208, already stripped the axios .data layer (see common constraints §5)
  } catch {
    pairable.value = []
  } finally {
    pairLoading.value = false
  }
}

async function loadBindings() {
  loading.value = true
  error.value = false
  try {
    const res = (await service.ai.listChannelBindings()) as { bindings?: ChannelBinding[] } | null | undefined
    bindings.value = (res && res.bindings) || [] // Vue2 :219-220
  } catch {
    error.value = true
  } finally {
    loading.value = false
  }
}

// Vue2 :227-243: two independent try/catch blocks, failure of either doesn't affect the other.
async function loadModels() {
  const models: AgentModel[] = []
  try {
    const body = (await service.ai.listModels()) as
      | { models?: Array<{ name?: string; size?: number }> }
      | Array<{ name?: string; size?: number }>
      | null
      | undefined
    const list = (body && (Array.isArray(body) ? body : body.models || body)) || []
    for (const m of list as Array<{ name?: string; size?: number }>) {
      if (!m || !m.name) continue
      models.push({ key: 'local:' + m.name, source: 'local', displayName: m.name, size: m.size })
    }
  } catch {
    /* Vue2 :237 local models optional */
  }
  try {
    const provs = await service.ai.listProviders()
    models.push(...buildCloudModelList(provs || []))
  } catch {
    /* Vue2 :241 cloud models optional */
  }
  availableModels.value = models
}

async function loadInstances() {
  instLoading.value = true
  try {
    const res = (await service.ai.listChannelInstances()) as { instances?: ChannelInstance[] } | null | undefined
    instances.value = (res && res.instances) || [] // Vue2 :247-248
  } catch {
    instances.value = []
  } finally {
    instLoading.value = false
  }
}

async function loadLark() {
  try {
    const res = (await service.ai.getLarkChannel()) as LarkStatus | null | undefined
    lark.value = { ...lark.value, ...(res || {}) }
  } catch {
    lark.value = { enabled: false, open_id: '', name: '', buttons_ready: false }
  }
}

async function enableLark() {
  if (larkBusy.value) return
  larkBusy.value = true
  try {
    const res = (await service.ai.enableLarkChannel()) as LarkStatus | null | undefined
    lark.value = { ...lark.value, ...(res || {}) }
    if (lark.value.enabled && !lark.value.buttons_ready) {
      larkConnecting.value = true
      clearLarkConnectTimer()
      larkConnectTimer = setTimeout(() => void refreshLarkAfterConnect(), LARK_CONNECT_RECHECK_MS)
    }
  } catch {
    // 409 is the DEFAULT state of a fresh box (lark-cli not installed / not
    // logged in / bot-only identity) — the copy names the possibilities.
    toast.show(t('aiCfgChannelsLarkEnableFailed'), 3000, 'danger')
  } finally {
    larkBusy.value = false
  }
}

function clearLarkConnectTimer() {
  if (larkConnectTimer) {
    clearTimeout(larkConnectTimer)
    larkConnectTimer = null
  }
}

// One delayed re-read: by now the consumer has either come up (healthy) or it
// has not (genuinely degraded). Either way, stop suppressing.
async function refreshLarkAfterConnect() {
  larkConnectTimer = null
  try {
    await loadLark()
  } finally {
    larkConnecting.value = false
  }
}

async function disableLark() {
  if (larkBusy.value) return
  larkBusy.value = true
  clearLarkConnectTimer()
  larkConnecting.value = false
  try {
    await service.ai.disableLarkChannel()
  } catch {
    /* fall through to a refresh — the server decides */
  }
  await loadLark()
  larkBusy.value = false
}

// Clear timing for inline errors: whenever user touches token or platform, remove old error
// (otherwise user still sees old red text after fix, looks like a new error); clear on modal
// open/close too, avoid remnants when reopening. All three cases have use case 19b pinned.
watch([newToken, newType], () => { addError.value = '' })
watch(showAdd, () => { addError.value = '' })

async function addBot() {
  const token = newToken.value.trim()
  if (!token) return
  addError.value = ''
  adding.value = true
  try {
    await service.ai.createChannelInstance({
      channel_type: newType.value,
      name: newName.value.trim(),
      config: { bot_token: token },
    })
    showAdd.value = false
    newName.value = ''
    newToken.value = ''
    newType.value = 'telegram'
    await loadInstances()
    await loadPairable()
  } catch (e) {
    // Vue2 :270-272 keeps showAdd true on failure, doesn't close modal — kept as-is.
    // But error no longer goes through toast (see divergence note at addError declaration),
    // changed to inline message above token field.
    // Don't use apiErrorMessage — it might return raw backend English (FastAPI's detail).
    // Here we use "backend string → i18n key" mapping, ensuring inline error is
    // **always current language human-readable text, never returns JSON**
    // (user reported on 2026-07-30 seeing `{"detail":"bot token rejected"}` in UI).
    addError.value = t(addBotErrorKey(e))
  } finally {
    adding.value = false
  }
}

// Mask click / Esc / top-right × and "Cancel" button all just close, no state reset
// (consistent with Vue2 :46/75: cancel doesn't clear form, only addBot() success clears).
function onAddOpenChange(v: boolean) {
  showAdd.value = v
}

async function toggle(inst: ChannelInstance, enabled: boolean) {
  try {
    await service.ai.setChannelInstanceEnabled(inst.id, enabled)
    inst.enabled = enabled // Vue2 :280 written after await, on failure doesn't change, toggle naturally reverts to original
    await loadPairable()
  } catch (e) {
    toast.show(apiErrorMessage(e, t('aiCfgSaveFailed')), 3000, 'danger')
  }
}

function confirmDeleteBot(inst: ChannelInstance) {
  pendingBotId.value = inst.id
  confirmDeleteBotOpen.value = true
}

async function onConfirmDeleteBot() {
  const id = pendingBotId.value
  if (id == null) return
  await doDeleteBot(id)
}

async function doDeleteBot(id: string | number) {
  try {
    await service.ai.deleteChannelInstance(id)
    instances.value = instances.value.filter((i) => i.id !== id)
    await loadPairable()
  } catch (e) {
    toast.show(apiErrorMessage(e, t('aiCfgDeleteFailed')), 3000, 'danger')
  }
}

async function genCode(inst: ChannelInstance) {
  try {
    const res = (await service.ai.createChannelPairingCode(inst.id)) as { code?: string } | null | undefined
    revealedCode.value = (res && res.code) || ''
    codeInstance.value = inst
    showCode.value = true
  } catch (e) {
    toast.show(apiErrorMessage(e, t('aiCfgChannelsCreateCodeFailed')), 3000, 'danger')
  }
}

async function setModel(b: ChannelBinding, key: string) {
  try {
    await service.ai.setChannelBindingModel(b.id, key)
    b.default_model = key
    toast.show(t('aiCfgSaved'))
  } catch (e) {
    toast.show(apiErrorMessage(e, t('aiCfgSaveFailed')), 3000, 'danger')
  }
}

async function saveDownloadDir(b: ChannelBinding, dir: string) {
  const v = (dir || '').trim()
  if (!v || v === b.download_dir) return // Vue2 :293
  try {
    await service.ai.setChannelBindingDownloadDir(b.id, v)
    b.download_dir = v
    toast.show(t('aiCfgSaved'))
  } catch (e) {
    toast.show(apiErrorMessage(e, t('aiCfgSaveFailed')), 3000, 'danger')
  }
}

function confirmUnbind(b: ChannelBinding) {
  pendingBindingId.value = b.id
  confirmUnbindOpen.value = true
}

async function onConfirmUnbind() {
  const id = pendingBindingId.value
  if (id == null) return
  await doUnbind(id)
}

async function doUnbind(id: string | number) {
  try {
    await service.ai.deleteChannelBinding(id)
    bindings.value = bindings.value.filter((b) => b.id !== id)
  } catch (e) {
    toast.show(apiErrorMessage(e, t('aiCfgDeleteFailed')), 3000, 'danger')
  }
}

// Three close paths (mask/Esc/× via update:open, "Done" button direct call) all go here —
// same pattern as McpTokensSection.vue's onRevealClose/handleRevealOpenChange.
// Clear plaintext code before await (Vue2 :357-364 same order: first showCode=false,
// then clear revealedCode/codeInstance, then re-fetch bindings).
async function onCodeClosed() {
  showCode.value = false
  revealedCode.value = ''
  codeInstance.value = null
  await loadBindings()
}

function handleCodeOpenChange(open: boolean) {
  // Remove checkmark state, avoid last time's green checkmark lingering when reopening pairing code modal.
  if (!open) { resetCopied(); void onCodeClosed() }
}

// SP8-P2b acceptance round 5: copy feedback (toast + "copied" checkmark state) unified via useCopyFeedback.
</script>

<template>
  <div class="set-inner">
    <div class="set-page-head">
      <h1 class="set-h1">{{ t('aiCfgChannels') }}</h1>
      <p class="set-desc">{{ t('aiCfgChannelsDesc') }}</p>
    </div>

    <!-- admin bot config -->
    <div v-if="isAdmin" class="sk-section">
      <div class="sk-section-head">
        <div class="sk-section-title">{{ t('aiCfgChannelsAdminTitle') }}</div>
        <div class="sk-section-hint">{{ botCount }}</div>
        <button class="sk-btn primary" style="margin-left:auto" @click="showAdd = true">
          <AgentIcon name="plus" :size="13" /> {{ t('aiCfgChannelsAddBot') }}
        </button>
      </div>
      <div class="sk-section-body">
        <p class="set-note">{{ t('aiCfgChannelsAdminHint') }}</p>
        <div v-if="instLoading" class="set-note">{{ t('aiCfgLoadingDots') }}</div>
        <div v-else v-for="inst in instances" :key="inst.id" class="tok-row">
          <span class="tok-ic"><AgentIcon name="cloud" :size="16" /></span>
          <div class="tok-body">
            <div class="tok-name">
              {{ inst.name || inst.channel_type }}
              <span v-if="inst.bot_username" class="chan-bot">@{{ inst.bot_username }}</span>
            </div>
            <div class="tok-meta">
              <span>{{ fillTokenTail(t('aiCfgChannelsBotTokenTail'), inst.token_tail || '') }}</span>
              <a
                v-if="inst.invite_url" class="chan-invite" :href="inst.invite_url"
                target="_blank" rel="noopener"
              >{{ t('aiCfgChannelsDiscordInvite') }}</a>
            </div>
          </div>
          <label class="chan-switch">
            <input
              type="checkbox" :checked="inst.enabled"
              @change="toggle(inst, ($event.target as HTMLInputElement).checked)"
            >
            {{ t('aiCfgChannelsEnabled') }}
          </label>
          <button class="tok-del" @click="confirmDeleteBot(inst)">
            <AgentIcon name="trash" :size="13" /> {{ t('aiCfgDelete') }}
          </button>
        </div>

        <!-- Feishu sits in the same list as the token bots, but it is not one:
             it carries no token (lark-cli holds the credentials) and so has an
             enable/disable pair instead of a token tail and a switch. -->
        <div class="tok-row" data-test="lark-row">
          <span class="tok-ic"><AgentIcon name="cloud" :size="16" /></span>
          <div class="tok-body">
            <div class="tok-name">
              {{ t('aiCfgChannelsLarkTitle') }}
              <span v-if="lark.enabled && lark.name" class="chan-bot">{{ lark.name }}</span>
            </div>
            <div v-if="larkConnecting" class="tok-meta chan-lark-connecting">
              {{ t('aiCfgChannelsLarkConnecting') }}
            </div>
            <div v-else-if="larkDegraded" class="tok-meta chan-lark-degraded">
              {{ t('aiCfgChannelsLarkDegraded') }}
            </div>
          </div>
          <button
            v-if="!lark.enabled" class="sk-btn primary" :disabled="larkBusy"
            data-test="lark-enable" @click="enableLark"
          >
            {{ t('aiCfgChannelsLarkEnable') }}
          </button>
          <button
            v-else class="tok-del" :disabled="larkBusy"
            data-test="lark-disable" @click="disableLark"
          >
            <AgentIcon name="trash" :size="13" /> {{ t('aiCfgChannelsLarkDisable') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Pair a chat account -->
    <div class="sk-section">
      <div class="sk-section-head">
        <div class="sk-section-title">{{ t('aiCfgChannelsPairTitle') }}</div>
      </div>
      <div class="sk-section-body">
        <div v-if="pairLoading" class="set-note">{{ t('aiCfgLoadingDots') }}</div>
        <div v-else-if="!pairable.length" class="set-note">{{ t('aiCfgChannelsNoBots') }}</div>
        <div v-else class="set-rows">
          <div v-for="inst in pairable" :key="inst.id" class="set-row">
            <div class="lbl">
              {{ inst.name || inst.channel_type }}
              <span v-if="inst.bot_username" class="chan-bot">@{{ inst.bot_username }}</span>
            </div>
            <div class="val">
              <button class="sk-btn primary" @click="genCode(inst)">
                <AgentIcon name="plus" :size="13" /> {{ t('aiCfgChannelsGenerateCode') }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- My linked accounts -->
    <div class="sk-section">
      <div class="sk-section-head">
        <div class="sk-section-title">{{ t('aiCfgChannelsBindingsTitle') }}</div>
        <div class="sk-section-hint">{{ bindings.length }}</div>
      </div>
      <div class="sk-section-body">
        <div v-if="loading" class="set-note">{{ t('aiCfgLoadingDots') }}</div>
        <div v-else-if="error" class="set-note">{{ t('aiCfgLoadFailed') }}</div>
        <div v-else-if="!bindings.length" class="set-note">{{ t('aiCfgChannelsNoBindings') }}</div>
        <div v-else v-for="b in bindings" :key="b.id" class="tok-row">
          <span class="tok-ic"><AgentIcon name="user" :size="16" /></span>
          <div class="tok-body">
            <div class="tok-name">{{ bindingLabel(b, t('aiCfgNoLabel')) }}</div>
            <div class="tok-meta">
              <span>{{ b.instance_name || b.channel_type }}</span>
              <span class="sep" />
              <span class="chan-model-lbl">{{ t('aiCfgChannelsBindingDefaultModel') }}:</span>
              <ModelPicker
                :available-models="availableModels" :selected-key="b.default_model || null"
                @select="(k) => setModel(b, k)"
              />
              <span class="sep" />
              <span class="chan-model-lbl">{{ t('aiCfgChannelsBindingDownloadDir') }}:</span>
              <input
                class="set-input" style="width:220px" :value="b.download_dir"
                @change="saveDownloadDir(b, ($event.target as HTMLInputElement).value)"
              >
            </div>
          </div>
          <button class="tok-del" @click="confirmUnbind(b)">
            <AgentIcon name="trash" :size="13" /> {{ t('aiCfgChannelsUnbind') }}
          </button>
        </div>
      </div>
    </div>

    <!-- add-bot modal -->
    <SkModal :open="showAdd" :title="t('aiCfgChannelsAddBot')" @update:open="onAddOpenChange">
      <div class="sk-field">
        <label class="sk-field-label">{{ t('aiCfgChannelsBotType') }}</label>
        <div class="chan-type-row">
          <button
            type="button" class="chan-type-opt" :data-active="newType === 'telegram'"
            @click="newType = 'telegram'"
          >{{ t('aiCfgChannelsTypeTelegram') }}</button>
          <button
            type="button" class="chan-type-opt" :data-active="newType === 'discord'"
            @click="newType = 'discord'"
          >{{ t('aiCfgChannelsTypeDiscord') }}</button>
        </div>
      </div>
      <div class="sk-field">
        <label class="sk-field-label">{{ t('aiCfgChannelsBotName') }}</label>
        <input type="text" v-model="newName" maxlength="64">
      </div>
      <div class="sk-field">
        <label class="sk-field-label">{{ t('aiCfgChannelsBotToken') }}</label>
        <!-- Add failure inline error (user approved replacing Vue2's danger toast): must render
             before <input>, visually above input box. role="alert" lets screen readers announce immediately. -->
        <p v-if="addError" class="chan-field-err" role="alert">{{ addError }}</p>
        <input type="text" v-model="newToken">
        <p class="chan-field-hint">
          {{ newType === 'discord' ? t('aiCfgChannelsBotTokenDiscordHint') : t('aiCfgChannelsBotTokenTelegramHint') }}
        </p>
        <p v-if="newType === 'discord'" class="chan-field-hint">{{ t('aiCfgChannelsDiscordPairNote') }}</p>
      </div>
      <template #footer>
        <button class="sk-btn ghost" @click="showAdd = false">{{ t('aiCancel') }}</button>
        <button class="sk-btn primary" :disabled="!newToken.trim() || adding" @click="addBot">
          {{ t('aiCfgChannelsAddBot') }}
        </button>
      </template>
    </SkModal>

    <!-- pairing-code reveal modal -->
    <SkModal :open="showCode" :title="t('aiCfgChannelsCodeTitle')" @update:open="handleCodeOpenChange">
      <p class="chan-modal-warn">{{ t('aiCfgChannelsCodeWarn') }}</p>
      <div class="set-copy">
        <input class="set-input full mono" :value="revealedCode" readonly>
        <button class="set-copybtn" :class="{ done: copiedKey === 'pair-code' }"
          @click="copy(revealedCode, 'pair-code')">
          <AgentIcon :name="copiedKey === 'pair-code' ? 'check' : 'copy'" :size="13" /> {{ t('aiCopy') }}
        </button>
      </div>
      <p class="chan-modal-hint">{{ pairInstructions }}</p>
      <template #footer>
        <button class="sk-btn primary" @click="onCodeClosed">{{ t('aiDone') }}</button>
      </template>
    </SkModal>

    <AlertDialog
      v-model:open="confirmDeleteBotOpen"
      :title="t('aiCfgDelete')"
      :message="t('aiCfgChannelsDeleteBotConfirm')"
      :confirm-text="t('aiCfgDelete')"
      :cancel-text="t('aiCancel')"
      destructive
      @confirm="onConfirmDeleteBot"
    />

    <AlertDialog
      v-model:open="confirmUnbindOpen"
      :title="t('aiCfgChannelsUnbind')"
      :message="t('aiCfgChannelsUnbindConfirm')"
      :confirm-text="t('aiCfgChannelsUnbind')"
      :cancel-text="t('aiCancel')"
      destructive
      @confirm="onConfirmUnbind"
    />
  </div>
</template>
