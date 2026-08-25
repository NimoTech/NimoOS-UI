<!--
  Task 11 (Files Time Machine Vue2-parity line): the white-glass snapshot settings modal,
  opened by TimeMachineStage.vue's own gear button (@open-settings -> Files.vue's settingsOpen
  ref, wired the same way the colleague's now-deleted SnapshotSettingsDialog.vue was). Ports
  Vue2 NimoOS-UI's SnapshotSettingsModal.vue (src/components/filebrowser/components/) 1:1 in
  layout/copy/controls: a 760px/78vh white frosted-glass panel with three blocks --
  A) Protection & Schedule (enable switch, status line, paused warning, keep-count fields,
  pause threshold, Save), B) Manual Snapshot (optional label + Create), C) Snapshot History
  (day-grouped, collapsible, newest 2 days expanded by default, per-item Browse/Delete).

  Built directly on reka-ui's Dialog primitives (not the shared components/ui/Dialog.vue
  wrapper) for the same reason Vue2's own file-header comment documents at length: the
  generic wrapper's `.ui-dialog-content` carries its own fixed min-width/padding/dark-glass
  background, and CSS has no way for THIS component's scoped styles to reach up and override
  an ANCESTOR element rendered by a different component -- so a from-scratch 760px/78vh
  two-column white panel needs its own DialogContent, not the generic one. Still "house
  style" per the task brief: same DialogRoot/Portal/Overlay/Content shape, same z-index tier
  (1000 overlay / 1001 content) as components/ui/Dialog.vue, so the Esc/teleport guard
  TimeMachineStage.vue's own `dialogOpen` prop already relies on (T6) keeps working
  unchanged -- that guard is driven by the `open` v-model this component receives from
  Files.vue's `settingsOpen` ref, not by which component renders the dialog chrome.

  Colleague fix ④ preserved (no "volume unsupported" flash): the storage snapshot store's
  volumeLoading starts `true` and this template gates the whole unsupported/enabled tree
  behind `v-if="!store.volumeLoading"`, so the network round-trip never flashes the wrong
  conclusion before landing -- ported straight from SnapshotSettingsDialog.vue's own guard
  (see that file's own "Review fix" comment for the original rationale, same store).

  Colleague fix ② preserved (Esc closes only this modal): reka-ui's DialogRoot handles its
  own Escape-to-close internally via `update:open`, entirely independent of
  TimeMachineStage.vue's own `window.addEventListener('keydown', ...)` handler -- that
  handler checks the SAME `dialogOpen`/`settingsOpen` ref this modal's `open` prop is bound
  to and returns early while it is true, so a single Escape keypress closes this modal
  without also exiting Time Machine. Nothing about that mechanism depends on which component
  renders the dialog, only on both sides sharing the one `settingsOpen` ref (Files.vue's own
  wiring, unchanged by this task).

  Data layer: reuses storage/stores/snapshot.ts (Pinia, singleton) verbatim for
  policy/toggle/create/remove/list -- no service calls are duplicated here. Toasts are the
  store's own job (useToast, called from every store action); this component's only
  responsibility is form state, view-only helpers (day grouping, expand/collapse), and the
  Browse action, which hands off to the Files-area useSnapshotBrowseStore's own switchTo()
  (the store the always-live stage itself already reads/writes) rather than emitting a path
  up to Files.vue -- Vue2's own equivalent emitted a path because its dialog could be reused
  outside FilePanel.vue; this rebuild's modal is only ever mounted inside the Files view, one
  level away from the stage's own store, so there is no reason to route through Files.vue.
-->
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { DialogRoot, DialogPortal, DialogOverlay, DialogContent, DialogTitle } from 'reka-ui'
import AlertDialog from '../../components/ui/AlertDialog.vue'
import { useSnapshotStore } from '../../storage/stores/snapshot'
import { useSnapshotBrowseStore } from '../stores/snapshotBrowse'
import {
  resolveSnapshotState, validatePolicyForm, groupSnapshotsByDay, defaultExpandedDayKeys,
  type PolicyForm, type SnapshotDayGroup, type SnapshotItemView,
} from '../../storage/util/snapshotView'

defineOptions({ name: 'SnapshotSettingsModal' })

const props = defineProps<{ open: boolean; volumeUuid: string; mount: string }>()
const emit = defineEmits<{
  (e: 'update:open', v: boolean): void
  (e: 'snapshot-created'): void
  (e: 'snapshot-deleted'): void
}>()

const { t } = useI18n()
const store = useSnapshotStore()
const browse = useSnapshotBrowseStore()

const state = computed(() => resolveSnapshotState(store.volume))

const form = ref<PolicyForm>({ hourly_keep: 24, daily_keep: 7, weekly_keep: 4, pause_threshold_pct: 90 })
const errors = ref<Partial<Record<keyof PolicyForm, string>>>({})
const manualLabel = ref('')

// Same visibility gate Vue2's showKeptMessage/showHistory computed shared: existing history
// may still be worth showing/keeping while protection is enabled, OR while disabled but the
// volume still reports a nonzero count.
const showKept = computed(() => state.value === 'enabled' || (state.value === 'disabled' && (store.volume?.count ?? 0) > 0))

const statusText = computed(() => {
  const v = store.volume
  if (!v) return ''
  const count = v.count || 0
  if (!count && !v.last_at) return t('snapNoneYet')
  const time = v.last_at ? new Date(v.last_at).toLocaleString() : t('snapNever')
  return t('snapStatus', { n: count, time })
})

const pausedText = computed(() => {
  const reason = store.volume?.paused_reason
  return reason ? t('snapPaused', { reason }) : ''
})

// --- Snapshot History (day-grouped, collapsible) --------------------------------------------
const expandedDayKeys = ref<string[]>([])
const historyGroups = computed<SnapshotDayGroup[]>(() => groupSnapshotsByDay(store.snapshots))
function isGroupExpanded(dayKey: string): boolean {
  return expandedDayKeys.value.includes(dayKey)
}
function toggleGroup(dayKey: string): void {
  expandedDayKeys.value = isGroupExpanded(dayKey)
    ? expandedDayKeys.value.filter((k) => k !== dayKey)
    : [...expandedDayKeys.value, dayKey]
}
// Ported from Vue2's own `historyExpandInitialized` flag verbatim: default-expand the newest 2
// days ONCE per open, but only once the first NON-EMPTY fetch lands -- if the volume opens with
// zero history (this ref stays false), the very next snapshots.value change (typically the
// history refresh a manual create triggers) still gets to apply the default-expand, instead of
// silently missing it forever because the initial (empty) fetch already "used up" the one-shot.
// A later create/delete after that point must NOT re-collapse whichever days the user has
// toggled by hand, hence gating on this flag rather than re-deriving on every snapshots change.
let historyExpandInitialized = false
watch(
  historyGroups,
  (groups) => {
    if (!historyExpandInitialized && groups.length) {
      expandedDayKeys.value = defaultExpandedDayKeys(groups)
      historyExpandInitialized = true
    }
  },
)

// Every time the modal (re)opens, or the bound volume changes while it's already open, re-seed
// everything from the current props/store rather than trusting leftover state from a previous
// open -- this is also what makes closing without saving a true no-op (Vue2 parity: nothing
// typed before close survives to the next open unless Save/Create was actually clicked).
watch(
  () => [props.open, props.volumeUuid] as const,
  async ([open, uuid]) => {
    if (!open || !uuid) return
    errors.value = {}
    manualLabel.value = ''
    expandedDayKeys.value = []
    historyExpandInitialized = false
    await Promise.all([store.loadVolume(uuid), store.loadPolicy(uuid), store.loadSnapshots(uuid)])
    const p = store.policy
    if (p) {
      // Same Number() normalization SnapshotSettingsDialog.vue's own watcher used: the backend
      // may serialize these fields as numeric strings, which would otherwise mis-fail
      // validatePolicyForm's Number.isInteger checks.
      form.value = {
        hourly_keep: Number(p.hourly_keep ?? 24),
        daily_keep: Number(p.daily_keep ?? 7),
        weekly_keep: Number(p.weekly_keep ?? 4),
        pause_threshold_pct: Number(p.pause_threshold_pct ?? 90),
      }
    }
  },
  { immediate: true },
)

function onToggle(): void {
  store.toggle(props.volumeUuid, !(store.volume?.enabled ?? false))
}

async function onSave(): Promise<void> {
  const { valid, errors: errs } = validatePolicyForm(form.value)
  errors.value = errs
  if (!valid) return
  await store.savePolicy(props.volumeUuid, { ...form.value })
}

async function onCreate(): Promise<void> {
  const ok = await store.createSnapshot(props.volumeUuid, manualLabel.value)
  if (ok) {
    manualLabel.value = ''
    emit('snapshot-created')
  }
}

// Browse: the stage is now always live underneath this modal (Vue2 parity design decision --
// see the file-header comment), so "browse to this snapshot" is just switching the SAME
// window to it via the Files-area store, then closing this modal.
function onBrowse(item: SnapshotItemView): void {
  void browse.switchTo(item.name)
  emit('update:open', false)
}

// --- Delete (must confirm) -------------------------------------------------------------------
// Fix round (found via TDD): `deleteOpen` (dialog visibility) and `pendingDelete` (which item
// is being deleted) are DELIBERATELY two separate refs, not one derived from the other.
// reka-ui's AlertDialogAction fires its own internal `update:open(false)` (auto-close-on-click,
// same as Cancel) BEFORE it fires our `@confirm` listener -- confirmed empirically: a single
// click on the confirm button logs `update:open(false)` first, `@confirm`'s handler second.
// Had `:open` been driven by `pendingDelete !== null` with the update:open handler nulling
// `pendingDelete`, that ordering would null it out from under `onDeleteConfirmed` before it
// ever reads which item to delete -- removeSnapshot would silently never be called. Keeping
// `pendingDelete` untouched by the open/close handler (only `onDeleteConfirmed` itself clears
// it, after use) sidesteps the ordering entirely.
const deleteOpen = ref(false)
const pendingDelete = ref<SnapshotItemView | null>(null)
function confirmDelete(item: SnapshotItemView): void {
  pendingDelete.value = item
  deleteOpen.value = true
}
const deleteMessage = computed(() => {
  const item = pendingDelete.value
  if (!item) return ''
  return t('snapDeleteMsg', { time: new Date(item.createdAt).toLocaleString() })
})
async function onDeleteConfirmed(): Promise<void> {
  const item = pendingDelete.value
  if (!item) return
  const ok = await store.removeSnapshot(props.volumeUuid, item.name)
  deleteOpen.value = false
  pendingDelete.value = null
  if (ok) emit('snapshot-deleted')
}
</script>

<template>
  <DialogRoot :open="props.open" @update:open="emit('update:open', $event)">
    <DialogPortal>
      <DialogOverlay class="ssm-overlay" />
      <DialogContent class="ssm-content" :aria-describedby="undefined">
        <header class="ssm-head">
          <div class="ssm-head-text">
            <DialogTitle class="ssm-title">{{ t('tmSettings') }}</DialogTitle>
            <span class="ssm-mount">{{ props.mount }}</span>
          </div>
          <button type="button" class="ssm-close-x" :aria-label="t('filesViewerClose')" @click="emit('update:open', false)">×</button>
        </header>

        <section class="ssm-body">
          <div v-if="store.volumeLoading" class="ssm-muted">&nbsp;</div>
          <div v-else-if="state === 'unsupported'" class="ssm-muted ssm-unsupported">{{ t('snapUnsupported') }}</div>

          <div v-else class="ssm-layout">
            <div class="ssm-col" :class="{ 'ssm-col--full': !showKept }">
              <!-- Block A: Protection & Schedule -->
              <section class="ssm-section">
                <h4 class="ssm-section-title">{{ t('snapProtectionBlock') }}</h4>

                <div class="ssm-row">
                  <span class="ssm-key">{{ t('snapTitle') }}</span>
                  <button
                    type="button"
                    class="ssm-switch"
                    role="switch"
                    :aria-checked="store.volume?.enabled === true"
                    :aria-label="t('snapTitle')"
                    :class="{ 'ssm-switch--on': store.volume?.enabled }"
                    :disabled="store.toggling"
                    @click="onToggle"
                  ><span class="ssm-switch-thumb"></span></button>
                </div>

                <p v-if="state === 'disabled'" class="ssm-muted ssm-row">{{ t('snapDisabledHint') }}</p>
                <p v-if="showKept" class="ssm-muted ssm-row">{{ t('snapKept') }}</p>

                <template v-if="state === 'enabled'">
                  <p class="ssm-muted ssm-row ssm-status-row">{{ statusText }}</p>
                  <p v-if="pausedText" class="ssm-paused-row">⚠️ {{ pausedText }}</p>

                  <div class="ssm-fields">
                    <div class="ssm-fields-grid">
                      <label class="ssm-field">
                        <span class="ssm-field-label">{{ t('snapHourlyKeep') }}</span>
                        <input class="ssm-num" type="number" min="1" v-model.number="form.hourly_keep" />
                        <em v-if="errors.hourly_keep" class="ssm-err">{{ t(errors.hourly_keep) }}</em>
                      </label>
                      <label class="ssm-field">
                        <span class="ssm-field-label">{{ t('snapDailyKeep') }}</span>
                        <input class="ssm-num" type="number" min="1" v-model.number="form.daily_keep" />
                        <em v-if="errors.daily_keep" class="ssm-err">{{ t(errors.daily_keep) }}</em>
                      </label>
                      <label class="ssm-field">
                        <span class="ssm-field-label">{{ t('snapWeeklyKeep') }}</span>
                        <input class="ssm-num" type="number" min="1" v-model.number="form.weekly_keep" />
                        <em v-if="errors.weekly_keep" class="ssm-err">{{ t(errors.weekly_keep) }}</em>
                      </label>
                    </div>
                    <div class="ssm-fields-footer">
                      <label class="ssm-field ssm-pause-field">
                        <span class="ssm-field-label">{{ t('snapPauseThreshold') }}</span>
                        <input class="ssm-num" type="number" min="1" max="100" v-model.number="form.pause_threshold_pct" />
                        <em v-if="errors.pause_threshold_pct" class="ssm-err">{{ t(errors.pause_threshold_pct) }}</em>
                      </label>
                      <button type="button" class="ssm-save" :disabled="store.policySaving" @click="onSave">{{ t('snapSave') }}</button>
                    </div>
                  </div>
                </template>
              </section>

              <!-- Block B: Manual Snapshot -->
              <template v-if="state === 'enabled'">
                <div class="ssm-divider"></div>
                <section class="ssm-section">
                  <h4 class="ssm-section-title">{{ t('snapManualBlock') }}</h4>
                  <div class="ssm-manual-row">
                    <input
                      class="ssm-label-input"
                      type="text"
                      v-model="manualLabel"
                      :placeholder="t('snapLabelPlaceholder')"
                      :disabled="store.creatingSnapshot"
                    />
                    <button type="button" class="ssm-create" :disabled="store.creatingSnapshot" @click="onCreate">{{ t('snapCreateNow') }}</button>
                  </div>
                </section>
              </template>
            </div>

            <!-- Block C: Snapshot History -->
            <div v-if="showKept" class="ssm-col ssm-col--right">
              <div class="ssm-history">
                <div class="ssm-history-header"><span class="ssm-key">{{ t('snapHistory') }}</span></div>

                <div class="ssm-history-scroll">
                  <div v-if="store.listLoading" class="ssm-history-skeleton">
                    <div v-for="n in 3" :key="n" class="ssm-history-skeleton-row"></div>
                  </div>

                  <div v-else-if="historyGroups.length === 0" class="ssm-history-empty">
                    <p class="ssm-muted">{{ t('snapNoneYet') }}</p>
                    <p class="ssm-muted">{{ t('snapEmptyHint') }}</p>
                  </div>

                  <div v-else class="ssm-history-body">
                    <div v-for="group in historyGroups" :key="group.dayKey" class="ssm-history-group">
                      <button type="button" class="ssm-history-group-header" @click="toggleGroup(group.dayKey)">
                        <span class="ssm-history-chevron" :class="{ 'ssm-history-chevron--open': isGroupExpanded(group.dayKey) }">&rsaquo;</span>
                        <span class="ssm-history-group-label">{{ group.label.i18nKey ? t(group.label.i18nKey) : group.label.text }}</span>
                        <span class="ssm-history-group-count">{{ group.items.length }}</span>
                      </button>

                      <ul v-if="isGroupExpanded(group.dayKey)" class="ssm-history-list">
                        <li v-for="item in group.items" :key="item.id != null ? item.id : item.name" class="ssm-history-item">
                          <span class="ssm-history-dot" :class="'ssm-history-dot--' + item.typeKind"></span>
                          <div class="ssm-history-info">
                            <span class="ssm-history-time">{{ item.time }}</span>
                            <span class="ssm-history-badge" :class="'ssm-history-badge--' + item.typeKind">{{ t(item.typeLabelKey) }}</span>
                            <span v-if="item.label" class="ssm-history-label">{{ item.label }}</span>
                          </div>
                          <div class="ssm-history-actions">
                            <button type="button" class="ssm-history-browse" @click="onBrowse(item)">{{ t('snapBrowse') }}</button>
                            <button
                              type="button"
                              class="ssm-history-delete"
                              :disabled="store.deletingName !== null"
                              @click="confirmDelete(item)"
                            >{{ t('snapDelete') }}</button>
                          </div>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <footer class="ssm-foot">
          <button type="button" class="ssm-close" @click="emit('update:open', false)">{{ t('filesViewerClose') }}</button>
        </footer>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>

  <AlertDialog
    :open="deleteOpen"
    :title="t('snapDeleteTitle')"
    :message="deleteMessage"
    :confirm-text="t('snapDelete')"
    :cancel-text="t('filesCancel')"
    destructive
    @update:open="(v) => { deleteOpen = v }"
    @confirm="onDeleteConfirmed"
  />
</template>

<style scoped>
.ssm-overlay { position: fixed; inset: 0; background: var(--overlay-bg); backdrop-filter: var(--overlay-blur); z-index: 1000; }

.ssm-content {
  position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 1001;
  width: 760px; max-width: 92vw; height: auto; max-height: 78vh;
  border-radius: 16px;
  background: var(--tm-panel-bg);
  backdrop-filter: var(--tm-panel-blur);
  -webkit-backdrop-filter: var(--tm-panel-blur);
  border: 1px solid var(--tm-panel-border);
  box-shadow: var(--tm-panel-shadow);
  color: var(--tm-text);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .ssm-content { background: var(--tm-panel-bg-solid); }
}

.ssm-head {
  display: flex; align-items: flex-start; justify-content: space-between; gap: 16px;
  padding: 24px 28px 16px; border-bottom: 1px solid var(--tm-hairline); flex-shrink: 0;
}
.ssm-head-text { min-width: 0; display: flex; flex-direction: column; gap: 8px; }
.ssm-title { margin: 0; font-size: 16px; font-weight: 600; color: var(--tm-text); }
.ssm-mount {
  display: inline-block; align-self: flex-start; max-width: 100%; word-break: break-all;
  background: var(--tm-chip-bg); color: var(--tm-text-dim); border-radius: 980px;
  padding: 3px 10px; font-size: 12px; line-height: 1.4;
}
.ssm-close-x {
  flex-shrink: 0; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;
  background: transparent; border: none; padding: 0; color: var(--tm-text-dim); cursor: pointer;
  border-radius: var(--tm-control-radius); font-size: 18px; line-height: 1;
}
.ssm-close-x:hover { background: var(--tm-ghost-hover-bg); color: var(--tm-text); }

.ssm-body { padding: 20px 28px 24px; flex: 1 1 auto; min-height: 0; overflow-y: auto; color: var(--tm-text); }
.ssm-muted { font-size: 0.75rem; color: var(--tm-text-dim); margin: 0; }

.ssm-layout { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); column-gap: 28px; row-gap: 20px; align-items: start; }
.ssm-col { min-width: 0; }
.ssm-col--full { grid-column: 1 / -1; }

.ssm-section-title { font-size: 13px; font-weight: 600; color: var(--tm-text); margin: 0 0 8px; }
.ssm-divider { height: 1px; background: var(--tm-hairline); margin: 16px 0; }

.ssm-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 6px 0; margin: 0; }
.ssm-key { font-size: 12px; color: var(--tm-text-dim); }
.ssm-status-row { margin-top: 2px; }
.ssm-paused-row { padding: 6px 0; margin: 0; font-size: 0.75rem; color: var(--tm-warn-text); }

.ssm-switch {
  position: relative; width: 38px; height: 21px; flex: none; padding: 0; cursor: pointer;
  border-radius: 9999px; border: none; background: var(--tm-switch-off-bg);
  transition: background 0.15s var(--ease, ease);
}
.ssm-switch--on { background: var(--tm-accent); }
.ssm-switch:disabled { opacity: 0.55; cursor: not-allowed; }
.ssm-switch-thumb {
  position: absolute; top: 2px; left: 2px; width: 17px; height: 17px; border-radius: 9999px;
  background: var(--tm-panel-bg-solid); box-shadow: var(--tm-switch-thumb-shadow); transition: transform 0.15s var(--ease, ease);
}
.ssm-switch--on .ssm-switch-thumb { transform: translateX(17px); }

.ssm-fields { margin-top: 4px; }
.ssm-fields-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); column-gap: 12px; }
.ssm-fields-footer { display: flex; align-items: flex-end; gap: 16px; margin-top: 12px; }
.ssm-field { display: flex; flex-direction: column; gap: 4px; font-size: 11px; color: var(--tm-text-dim); }
.ssm-field-label { font-weight: 500; }
.ssm-pause-field { flex-grow: 1; max-width: 280px; }
.ssm-num, .ssm-label-input {
  box-sizing: border-box; padding: 6px 10px; font-size: 12.5px; border-radius: 6px;
  border: 1px solid var(--tm-ghost-border); background: transparent; color: var(--tm-text); outline: none;
}
.ssm-num { max-width: 132px; text-align: center; }
.ssm-num:focus, .ssm-label-input:focus { border-color: var(--tm-accent); }
.ssm-num:disabled, .ssm-label-input:disabled { opacity: 0.55; }
.ssm-err { display: block; color: var(--tm-danger); font-size: 11px; margin-top: 2px; }

.ssm-save, .ssm-create {
  padding: 8px 16px; height: 32px; border-radius: var(--tm-control-radius); font-size: 12.5px; font-weight: 600; cursor: pointer;
  border: none; background: var(--tm-accent); color: var(--tm-chrome-text);
}
.ssm-save:hover:not(:disabled), .ssm-create:hover:not(:disabled) { background: var(--tm-accent-hover); }
.ssm-save:disabled, .ssm-create:disabled { opacity: 0.5; cursor: not-allowed; }

.ssm-manual-row { display: flex; flex-direction: column; gap: 10px; margin-top: 12px; }
.ssm-create { width: 100%; height: 40px; }
.ssm-label-input { width: 100%; background: var(--tm-panel-bg-solid); }
.ssm-label-input::placeholder { color: var(--tm-placeholder-text); }

.ssm-history { display: flex; flex-direction: column; min-height: 0; }
.ssm-history-header { padding: 0 0 8px; flex-shrink: 0; }
.ssm-history-header .ssm-key { font-size: 13px; font-weight: 600; color: var(--tm-text); }
.ssm-history-scroll { max-height: 420px; overflow-y: auto; padding-right: 4px; }
.ssm-history-empty { padding: 12px 0; text-align: center; }
.ssm-history-skeleton-row {
  height: 14px; border-radius: 4px; margin-bottom: 8px;
  background: color-mix(in srgb, var(--tm-text-dim) 12%, transparent);
}
.ssm-history-group:not(:last-child) { margin-bottom: 6px; }
.ssm-history-group-header {
  display: flex; align-items: center; gap: 6px; width: 100%; padding: 6px 8px;
  border-radius: var(--tm-control-radius); position: sticky; top: 0; z-index: 1;
  background: var(--tm-panel-bg-solid); border: none; border-bottom: 1px solid var(--tm-hairline);
  cursor: pointer; font-family: inherit; text-align: left; color: inherit;
}
.ssm-history-group-header:hover { background: var(--tm-ghost-hover-bg); }
.ssm-history-chevron { display: inline-block; font-size: 12px; color: var(--tm-text-dim); transition: transform 0.15s ease; }
.ssm-history-chevron--open { transform: rotate(90deg); }
.ssm-history-group-label { font-size: 12px; font-weight: 500; color: var(--tm-text-dim); }
.ssm-history-group-count {
  margin-left: auto; font-size: 10px; font-weight: 500; color: var(--tm-text-dim);
  background: var(--tm-chip-bg); border-radius: 980px; padding: 1px 7px; line-height: 14px;
}
.ssm-history-list { position: relative; padding: 2px 0 6px 0; list-style: none; margin: 0; }
.ssm-history-item { position: relative; display: flex; align-items: flex-start; gap: 10px; padding: 7px 6px 7px 16px; border-radius: 6px; }
.ssm-history-item:hover { background: var(--tm-ghost-hover-bg); }
.ssm-history-dot {
  position: relative; top: 5px; width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
  border: 2px solid var(--tm-panel-bg-solid);
}
.ssm-history-dot--auto { background: var(--tm-dot-auto); }
.ssm-history-dot--manual { background: var(--tm-accent); }
.ssm-history-dot--preop { background: var(--tm-warn-dot); }
.ssm-history-info { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; flex-grow: 1; min-width: 0; }
.ssm-history-time { font-size: 12px; font-weight: 500; color: var(--tm-text); }
.ssm-history-badge { display: inline-block; padding: 1px 7px; border-radius: 980px; font-size: 10px; font-weight: 500; }
.ssm-history-badge--auto { background: var(--tm-chip-bg); color: var(--tm-text-dim); }
.ssm-history-badge--manual { background: color-mix(in srgb, var(--tm-accent) 12%, transparent); color: var(--tm-accent-hover); }
.ssm-history-badge--preop { background: var(--tm-warn-bg); color: var(--tm-warn-text); }
.ssm-history-label { font-size: 12px; color: var(--tm-text-dim); overflow: hidden; text-overflow: ellipsis; }
.ssm-history-actions { display: flex; flex-shrink: 0; gap: 6px; }
.ssm-history-browse, .ssm-history-delete {
  min-width: 68px; height: 26px; padding: 0 10px; border-radius: var(--tm-control-radius);
  font-size: 0.75rem; cursor: pointer; background: transparent;
}
.ssm-history-browse { border: 1px solid var(--tm-ghost-border); color: var(--tm-text-dim); }
.ssm-history-browse:hover { background: var(--tm-ghost-hover-bg); color: var(--tm-text); border-color: var(--tm-ghost-border-hover); }
.ssm-history-delete { border: 1px solid color-mix(in srgb, var(--tm-danger) 40%, transparent); color: var(--tm-danger); }
.ssm-history-delete:hover:not(:disabled) {
  background: color-mix(in srgb, var(--tm-danger) 8%, transparent);
  border-color: color-mix(in srgb, var(--tm-danger) 60%, transparent);
  color: var(--tm-danger-hover);
}
.ssm-history-delete:disabled { opacity: 0.5; cursor: not-allowed; }

.ssm-foot { padding: 14px 28px 20px; border-top: 1px solid var(--tm-hairline); flex-shrink: 0; display: flex; justify-content: flex-end; }
.ssm-close {
  padding: 7px 16px; border-radius: var(--tm-control-radius); font-size: 13px; cursor: pointer;
  background: transparent; border: 1px solid var(--tm-ghost-border); color: var(--tm-text-dim);
}
.ssm-close:hover { background: var(--tm-ghost-hover-bg); color: var(--tm-text); border-color: var(--tm-ghost-border-hover); }

@media screen and (max-width: 768px) {
  .ssm-content { width: 94vw; }
  .ssm-layout { grid-template-columns: 1fr; }
  .ssm-col--full { grid-column: auto; }
  .ssm-fields-grid { grid-template-columns: 1fr; }
  .ssm-fields-footer { flex-direction: column; align-items: stretch; }
  .ssm-pause-field { max-width: none; }
}
</style>
