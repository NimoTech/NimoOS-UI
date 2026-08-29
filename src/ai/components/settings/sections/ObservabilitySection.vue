<!--
  SP8-P2b Task 8 — Port 1:1 from Vue2 src/views/AI/Settings/sections/ObservabilitySection.vue
  (211 lines) + existing tests sections/__tests__/ObservabilitySection.spec.js(5 tests; see
  mapping table in test file header comment).

  【D2 declaration】State stays local to component (ref), calling service.ai / service.compose directly —
  matches Vue2 pattern (Vue2 data() is component-local state), not centralizing to store (only blacklist
  uses store, see BlacklistSection.vue header comment, approved by user 2026-07-28).

  【D4 declaration, architectural divergence】This section subscribes to three MessageBus events
  `app:install-progress` / `app:install-end` / `app:install-error`, filtering by
  `Properties['app:name'] === 'arize-phoenix'` (maps exactly to Vue2 :70-89 `sockets:` block),
  **not reusing the app-section's installProgress Pinia store**. Reason: Phoenix is a toggle
  within this settings section and should not appear as an "installation task" in the app-section
  tiles / home event stream (approved by user 2026-07-28). Trade-off: two independent subscribers
  to the same event batch across the codebase (this section + app-section installProgress store),
  accepted as known.

  【Logic fix】After Vue2 component unmount, `pollStatus` setTimeout loop keeps running and
  calling `setState` (Vue2 :110-117 has no unmount checks). This section is one of a stack group;
  user switching sections in settings unmounts it, yet Phoenix's two polls run 12×1500ms / 40×2000ms
  respectively, collision is likely. Here: introduce `alive` flag, set to false in `onUnmounted`,
  and after every `await` in `pollStatus` and `turnOnFlow`/`confirmInstall`/`turnOff`, add
  `if (!alive) return`. After unmount, stop flow and stop mutating any ref.

  【Framework API difference, not logic change】Vue2 uses `$buefy.dialog.confirm({ onConfirm, onCancel })`
  for two confirm dialogs; here replace with two controlled `AlertDialog` (reka-ui). Reka's
  `AlertDialogCancel` only closes the dialog (drives `v-model:open` to false), emitting no separate
  cancel event. So "cancel reverts the toggle" now uses `watch(open)`: when opening, set
  `xxxConfirmed = false` sentinel; in `@confirm` handler, set sentinel to true first;
  when closing, if sentinel is still false, it means "cancel / mask click", calling Vue2's
  equivalent `onCancel` logic.

  【final review Fix 4, revoking undeclared unnecessary divergence】`onToggle` previously
  optimistically wrote `enabled.value = v` **only in the branches opening** the two confirm dialogs
  (`confirmInstallOpen`/`confirmStopOpen` set to true). Vue2 (ObservabilitySection.vue:118-146)
  **never touches** `this.enabled` before calling `$buefy.dialog.confirm` — only after success in
  respective `onConfirm` (`confirmInstall()`/`turnOff()`). `SetSwitch` is fully controlled
  (`:model-value="enabled"`); optimistic write consequence: toggle jumps to new state, but the
  "Phoenix running but monitoring off" warning condition is `phoenixStatus === 'running' && !enabled` —
  optimistic write happens while dialog **is still open**, causing the warning to flicker behind
  the dialog, visual glitch not in the original declaration. Now revert per Vue2: neither branch
  opening confirm dialogs writes `enabled.value`; toggle stays original during dialog; `turnOnFlow()`/
  `turnOff()` direct branches (non-dialog paths) unaffected, changing `enabled` after async success.
  `onInstallCancel` (maps to Vue2 :130 `onCancel: () => { this.enabled = false }`) keeps explicit
  false per Vue2. `onStopCancel`'s prior "optimistic write needs manual revert on cancel" rationale
  (earlier version) revoked with optimistic write — after not writing optimistically, `enabled` was
  never touched on cancel anyway, so `onStopCancel` is now equivalent to Vue2 `onCancel: () => {}`
  (leave comment explaining, no dead-code assignment).
-->
<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import { useMessageBus } from '../../../../composables/useMessageBus'
import { apiErrorMessage } from '../../../util/apiError'
import SetSwitch from '../SetSwitch.vue'
import AgentIcon from '../../icons/AgentIcon.vue'
import AlertDialog from '../../../../components/ui/AlertDialog.vue'

const APP_ID = 'arize-phoenix'
type PhoenixStatus = 'absent' | 'exited' | 'running' | string

const { t } = useI18n()

const enabled = ref(false)
const phoenixStatus = ref<PhoenixStatus>('absent')
const busy = ref(false)
const installing = ref(false)
const progress = ref(0)
const error = ref('')
const confirmInstallOpen = ref(false)
const confirmStopOpen = ref(false)

let alive = true // After unmount, stop mutating state and stop scheduling next poll (see file header "Logic fix")
const offs: Array<() => void> = [] // MessageBus unsubscribe closures
let installConfirmed = false
let stopConfirmed = false

const statusLabel = computed(() => {
  if (phoenixStatus.value === 'running') return t('aiCfgPhoenixRunning')
  if (phoenixStatus.value === 'absent') return t('aiCfgPhoenixNotInstalled')
  return t('aiCfgPhoenixStopped')
})

// useMessageBus().on handler's first parameter is already unwrapped by extractProps (removes
// Properties/properties envelope, New-UI composable does this, see src/composables/useMessageBus.ts),
// type is unknown. Here narrow it consistently, corresponding to Vue2's direct `res.Properties['app:name']`.
function asProps(p: unknown): Record<string, string> {
  return p && typeof p === 'object' ? (p as Record<string, string>) : {}
}

onMounted(() => {
  const bus = useMessageBus()

  offs.push(bus.on('app:install-progress', (p) => {
    const props = asProps(p)
    if (props['app:name'] !== APP_ID) return
    progress.value = parseInt(props['app:progress'] || '0', 10) || 0
  }))
  offs.push(bus.on('app:install-end', (p) => {
    if (asProps(p)['app:name'] !== APP_ID) return
    installing.value = false
    busy.value = false
    void load()
  }))
  offs.push(bus.on('app:install-error', (p) => {
    const props = asProps(p)
    if (props['app:name'] !== APP_ID) return
    installing.value = false
    busy.value = false
    error.value = props.message || t('aiCfgInstallationFailed')
    void service.ai.putTracingSetting({ enabled: false }).catch(() => { /* Vue2 :87 swallows similarly */ }) // Rollback optimistic enable
    enabled.value = false
  }))

  void load()
})

onUnmounted(() => {
  alive = false
  offs.forEach((off) => off())
})

async function load() {
  try {
    const s = (await service.ai.getTracingSetting()) as { enabled?: boolean }
    if (!alive) return
    enabled.value = !!s.enabled
  } catch { /* Vue2 :99 also silent */ }
  if (!alive) return
  await refreshStatus()
}

async function refreshStatus() {
  try {
    const map = await service.compose.list()
    if (!alive) return
    const entry = map?.[APP_ID]
    phoenixStatus.value = entry ? (entry.status || 'exited') : 'absent'
  } catch { /* Vue2 :108 — keep current */ }
}

async function pollStatus(pred: (s: string) => boolean, tries: number, intervalMs: number): Promise<boolean> {
  for (let i = 0; i < tries; i++) {
    if (!alive) return false
    await refreshStatus()
    if (!alive) return false
    if (pred(phoenixStatus.value)) return true
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  return false
}

function onToggle(v: boolean) {
  if (v) {
    if (phoenixStatus.value === 'absent') {
      // final review Fix 4: wait for user confirmation; don't optimistically write enabled here, see file header comment.
      confirmInstallOpen.value = true
    } else {
      enabled.value = v
      void turnOnFlow()
    }
  } else if (phoenixStatus.value === 'running') {
    // final review Fix 4: wait for user confirmation; don't optimistically write enabled here, see file header comment.
    confirmStopOpen.value = true
  } else {
    enabled.value = v
    void turnOff()
  }
}

// See file header "Framework API difference" comment: reka AlertDialogCancel only drives v-model:open to
// false, not emitting separately. Cancel needs these two watch blocks to supply Vue2's equivalent onCancel logic.
watch(confirmInstallOpen, (open) => {
  if (open) { installConfirmed = false; return }
  if (!installConfirmed) onInstallCancel()
})
watch(confirmStopOpen, (open) => {
  if (open) { stopConfirmed = false; return }
  if (!stopConfirmed) onStopCancel()
})

function onInstallCancel() { enabled.value = false } // Vue2 :130 onCancel
// final review Fix 4: not optimistically writing anymore, enabled not touched on cancel anyway —
// equivalent to Vue2 :141 `onCancel: () => {}` no-op, no dead-code assignment.
function onStopCancel() { /* no-op, see file header final review Fix 4 comment */ }

function onConfirmInstallClick() {
  installConfirmed = true
  void confirmInstall()
}
function onConfirmStopClick() {
  stopConfirmed = true
  void turnOff()
}

async function turnOnFlow() {
  error.value = ''
  if (phoenixStatus.value !== 'running') {
    busy.value = true
    try {
      await service.compose.setStatus(APP_ID, 'start')
      if (!alive) return
      await pollStatus((s) => s === 'running', 12, 1500)
      if (!alive) return
    } catch { /* Vue2 :154 ignore */ }
    if (!alive) return
    busy.value = false
  }
  if (!alive) return
  await turnOn()
}

async function turnOn() {
  try {
    await service.ai.putTracingSetting({ enabled: true })
    if (!alive) return
    enabled.value = true
  } catch {
    if (!alive) return
    enabled.value = false
    error.value = t('aiCfgFailedToSaveSetting')
  }
}

async function confirmInstall() {
  installing.value = true
  busy.value = true
  progress.value = 0
  await turnOn() // Optimistically set enabled first (Vue2 :169)
  if (!alive) return
  try {
    const yaml = (await service.ai.getObservabilityCompose()) as string
    if (!alive) return
    await service.compose.install(yaml) // Package includes yaml content-type, no hand-crafted header needed (Vue2 :172 hand-crafts it)
    if (!alive) return
    const ok = await pollStatus((s) => s === 'running', 40, 2000)
    if (!alive) return
    installing.value = false
    busy.value = false
    if (!ok) error.value = t('aiCfgInstallationFailed')
  } catch (e) {
    if (!alive) return
    installing.value = false
    busy.value = false
    // apiErrorMessage is equivalent wrapper of Vue2 :180's manual extraction chain (e.response.data.message),
    // house style requires using it, behavior unchanged.
    error.value = apiErrorMessage(e, t('aiCfgInstallationFailed'))
    await service.ai.putTracingSetting({ enabled: false }).catch(() => { /* Vue2 :182 also swallows */ })
    if (!alive) return
    enabled.value = false
  }
}

async function turnOff() {
  busy.value = true
  try {
    await service.ai.putTracingSetting({ enabled: false })
    if (!alive) return
    enabled.value = false
    if (phoenixStatus.value === 'running') {
      await service.compose.setStatus(APP_ID, 'stop')
      if (!alive) return
      await pollStatus((s) => s !== 'running', 10, 1500)
      if (!alive) return
    }
  } catch {
    if (!alive) return
    error.value = t('aiCfgFailedToSaveSetting')
  } finally {
    if (alive) busy.value = false
  }
}

function openPhoenix() {
  window.open(`http://${window.location.hostname}:6006/`, '_blank') // Vue2 :202, 6006 is Phoenix default UI port
}
</script>

<template>
  <div class="set-inner">
    <div class="set-page-head">
      <h1 class="set-h1">{{ t('aiCfgObservability') }}</h1>
      <p class="set-desc">{{ t('aiCfgObservabilityDesc') }}</p>
    </div>

    <div class="sk-section">
      <div class="sk-section-head">
        <div class="sk-section-title">{{ t('aiCfgPhoenixTracing') }}</div>
      </div>
      <div class="sk-section-body">
        <div class="set-rows">
          <div class="set-row">
            <div class="lbl">{{ t('aiCfgEnableAgentMonitoring') }}</div>
            <div class="val end">
              <SetSwitch :model-value="enabled" :disabled="busy" @change="onToggle" />
            </div>
          </div>
        </div>
        <div class="set-banner">
          <span class="ico"><AgentIcon name="waves" :size="12" /></span>
          <span>{{ t('aiCfgObservabilityBanner') }}</span>
        </div>
        <div class="px-status">
          <span class="k">{{ t('aiCfgPhoenixStatus') }}</span>
          <span class="state"><span class="d" />{{ statusLabel }}</span>
          <!-- 【Declaration: visual divergence from Vue2 1:1, approved by user 2026-07-30 during acceptance】
               Vue2 :29 uses `download` icon + `--accent-softer` very light background. Two issues:
               ①download (downward arrow + underline) semantics mean "download", but this button opens Phoenix in new tab;
               ②in light theme, accent-softer barely visible, user feedback "button not visible".
               Changed to `external` (external link) icon + solid accent color (styled in settings-styles.scss `.px-open`).
               Pinned: ObservabilitySection.test.ts case 20 and settingsStyles.test.ts `.px-open` case. -->
          <button v-if="phoenixStatus === 'running'" class="px-open" @click="openPhoenix">
            <AgentIcon name="external" :size="12" /> {{ t('aiCfgOpenPhoenix') }}
          </button>
        </div>
        <p v-if="installing" class="px-msg">{{ t('aiCfgInstallingPhoenix') }} {{ progress }}%</p>
        <p v-if="error" class="px-msg err">{{ error }}</p>
        <div v-if="phoenixStatus === 'running' && !enabled" class="set-banner warn">
          {{ t('aiCfgPhoenixRunningButOff') }}
        </div>
      </div>
    </div>

    <AlertDialog
      v-model:open="confirmInstallOpen"
      :title="t('aiCfgObservability')"
      :message="t('aiCfgPhoenixInstallConfirm')"
      :confirm-text="t('aiCfgDownloadAndInstall')"
      :cancel-text="t('aiCancel')"
      @confirm="onConfirmInstallClick"
    />
    <AlertDialog
      v-model:open="confirmStopOpen"
      :title="t('aiCfgObservability')"
      :message="t('aiCfgPhoenixStopConfirm')"
      :confirm-text="t('aiCfgContinue')"
      :cancel-text="t('aiCancel')"
      @confirm="onConfirmStopClick"
    />
  </div>
</template>
