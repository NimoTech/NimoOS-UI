<!--
  The white-glass snapshot settings modal,
  opened by TimeMachineStage.vue's own gear button (@open-settings -> Files.vue's settingsOpen
  ref, wired the same way the now-deleted SnapshotSettingsDialog.vue was). Ports
  the Vue 2 panel's SnapshotSettingsModal.vue (src/components/filebrowser/components/) 1:1 in
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
  style": same DialogRoot/Portal/Overlay/Content shape, same z-index tier
  (1000 overlay / 1001 content) as components/ui/Dialog.vue, so the Esc/teleport guard
  TimeMachineStage.vue's own `dialogOpen` prop already relies on keeps working
  unchanged -- that guard is driven by the `open` v-model this component receives from
  Files.vue's `settingsOpen` ref, not by which component renders the dialog chrome.

  No "volume unsupported" flash: the storage snapshot store's
  volumeLoading starts `true` and this template gates the whole unsupported/enabled tree
  behind `v-if="!store.volumeLoading"`, so the network round-trip never flashes the wrong
  conclusion before landing -- ported straight from SnapshotSettingsDialog.vue's own guard
  (see that file's own comment for the original rationale, same store).

  Esc closes only this modal: reka-ui's DialogRoot handles its
  own Escape-to-close internally via `update:open`, entirely independent of
  TimeMachineStage.vue's own `window.addEventListener('keydown', ...)` handler -- that
  handler checks the SAME `dialogOpen`/`settingsOpen` ref this modal's `open` prop is bound
  to and returns early while it is true, so a single Escape keypress closes this modal
  without also exiting Time Machine. Nothing about that mechanism depends on which component
  renders the dialog, only on both sides sharing the one `settingsOpen` ref (Files.vue's own
  wiring, unchanged here).

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

// Rebuilds the
// bare `<input type="number">` fields as Vue2's own Buefy `b-numberinput controls-position="compact"`
// [-][value][+] ghost stepper -- Buefy/Bulma have no JS logic of their own to port, just a bordered
// `.field.has-addons` box with two ghost buttons flanking the input (SnapshotSettingsModal.vue:972-1013);
// this is the JS equivalent of that widget's own increment/decrement/clamp behavior. `min`/`max`
// mirror the template's own `:min`/`:max` props on each of the four `<b-numberinput>` usages
// (own file:215,220,225,234 -- the three keep-count fields are min=1/no max, the pause-threshold
// field is min=1/max=100).
function stepField(field: keyof PolicyForm, delta: number, min: number, max?: number): void {
  const cur = form.value[field] ?? 0
  let next = cur + delta
  next = Math.max(min, next)
  if (max !== undefined) next = Math.min(max, next)
  form.value[field] = next
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
// Found via TDD: `deleteOpen` (dialog visibility) and `pendingDelete` (which item
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
                        <div class="ssm-num-group">
                          <button type="button" class="ssm-num-btn" :disabled="form.hourly_keep <= 1" :aria-label="t('snapNumDecrease')" @click="stepField('hourly_keep', -1, 1)">&minus;</button>
                          <input class="ssm-num-input" type="number" min="1" v-model.number="form.hourly_keep" />
                          <button type="button" class="ssm-num-btn" :aria-label="t('snapNumIncrease')" @click="stepField('hourly_keep', 1, 1)">+</button>
                        </div>
                        <em v-if="errors.hourly_keep" class="ssm-err">{{ t(errors.hourly_keep) }}</em>
                      </label>
                      <label class="ssm-field">
                        <span class="ssm-field-label">{{ t('snapDailyKeep') }}</span>
                        <div class="ssm-num-group">
                          <button type="button" class="ssm-num-btn" :disabled="form.daily_keep <= 1" :aria-label="t('snapNumDecrease')" @click="stepField('daily_keep', -1, 1)">&minus;</button>
                          <input class="ssm-num-input" type="number" min="1" v-model.number="form.daily_keep" />
                          <button type="button" class="ssm-num-btn" :aria-label="t('snapNumIncrease')" @click="stepField('daily_keep', 1, 1)">+</button>
                        </div>
                        <em v-if="errors.daily_keep" class="ssm-err">{{ t(errors.daily_keep) }}</em>
                      </label>
                      <label class="ssm-field">
                        <span class="ssm-field-label">{{ t('snapWeeklyKeep') }}</span>
                        <div class="ssm-num-group">
                          <button type="button" class="ssm-num-btn" :disabled="form.weekly_keep <= 1" :aria-label="t('snapNumDecrease')" @click="stepField('weekly_keep', -1, 1)">&minus;</button>
                          <input class="ssm-num-input" type="number" min="1" v-model.number="form.weekly_keep" />
                          <button type="button" class="ssm-num-btn" :aria-label="t('snapNumIncrease')" @click="stepField('weekly_keep', 1, 1)">+</button>
                        </div>
                        <em v-if="errors.weekly_keep" class="ssm-err">{{ t(errors.weekly_keep) }}</em>
                      </label>
                    </div>
                    <div class="ssm-fields-footer">
                      <label class="ssm-field ssm-pause-field">
                        <span class="ssm-field-label">{{ t('snapPauseThreshold') }}</span>
                        <div class="ssm-num-group">
                          <button type="button" class="ssm-num-btn" :disabled="form.pause_threshold_pct <= 1" :aria-label="t('snapNumDecrease')" @click="stepField('pause_threshold_pct', -1, 1, 100)">&minus;</button>
                          <input class="ssm-num-input" type="number" min="1" max="100" v-model.number="form.pause_threshold_pct" />
                          <button type="button" class="ssm-num-btn" :disabled="form.pause_threshold_pct >= 100" :aria-label="t('snapNumIncrease')" @click="stepField('pause_threshold_pct', 1, 1, 100)">+</button>
                        </div>
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
/* Buefy's own `.modal` scrim is a flat, unblurred
   rgba[0,0,0,.5] for all three white-glass TM dialogs -- see theme.css's own comment on
   `--tm-modal-overlay-bg` for the full Vue2/Bulma citation. Deliberately scoped to only this
   dialog's own overlay rule, not the shared `--overlay-bg`/`--overlay-blur` every other app
   dialog still uses. */
.ssm-overlay { position: fixed; inset: 0; background: var(--tm-modal-overlay-bg); z-index: 1000; }

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
/* Vue2's own `.title.is-header` sets `line-height: 1.5rem`
   (24px, common/_title.scss:28) -- New-UI previously left it at the browser default (~1.2).
   Font-family is a deliberate, documented deviation: Vue2's `$family-sans-serif` starts with a
   custom `BrittiSans` webfont (the Vue 2 panel's src/assets/fonts/britti-sans-regular.woff, loaded via
   its own `@font-face` in common/_root.scss) that has no counterpart asset in this repo and no
   `@font-face`/`--font` infra to bring one in without touching every heading app-wide. */
.ssm-title { margin: 0; font-size: 16px; font-weight: 600; line-height: 24px; color: var(--tm-text); }
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

/* Rebuilt to Buefy's OWN em-based `_switch.scss` formula
   (`$switch-width: 2.75em`, `$switch-padding: 0.2em`, knob `($switch-width - $switch-padding*2)*0.5`)
   at `font-size: 12px` (Buefy's `is-small` control-small size) rather than New-UI's own
   hand-picked 38x21px/17px-thumb/2px-inset numbers -- using em units (not hand-rounded px)
   reproduces Buefy's actual fractional-pixel geometry exactly, same technique Buefy itself uses.
   Track: 2.75em = 33px. Height: width*0.5 + padding = 1.575em ≈ 19px. Knob: 1.175em ≈ 14px,
   inset 0.2em ≈ 2.4px. Knob travel: Buefy's own `translate3d(100%,0,0)` moves the knob by
   exactly its own width (the content box is exactly 2x the knob width by construction), so
   `translateX(1.175em)` is the pixel-exact equivalent, not an approximation. */
.ssm-switch {
  position: relative; width: 2.75em; height: 1.575em; font-size: 12px; flex: none; padding: 0; cursor: pointer;
  border-radius: 9999px; border: none; background: var(--tm-switch-off-bg);
  transition: background 0.15s var(--ease, ease);
}
/* Vue2's switch-on fill is Buefy's own `type="is-primary"` ->
   `$switch-active-background-color: $primary` -- `--tm-primary`, not `--tm-accent` (see
   theme.css's own comment on the token split for the full citation). */
.ssm-switch--on { background: var(--tm-primary); }
.ssm-switch:disabled { opacity: 0.55; cursor: not-allowed; }
.ssm-switch-thumb {
  position: absolute; top: 0.2em; left: 0.2em; width: 1.175em; height: 1.175em; border-radius: 9999px;
  background: var(--tm-panel-bg-solid); box-shadow: var(--tm-switch-thumb-shadow); transition: transform 0.15s var(--ease, ease);
}
.ssm-switch--on .ssm-switch-thumb { transform: translateX(1.175em); }

/* Vue2's own `&__fields { margin-top: 4px }`
   (SnapshotSettingsModal.vue:940-943), not 12px. */
.ssm-fields { margin-top: 4px; }
.ssm-fields-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); column-gap: 12px; }
.ssm-fields-footer { display: flex; align-items: flex-end; gap: 16px; margin-top: 12px; }
.ssm-field { display: flex; flex-direction: column; gap: 4px; font-size: 11px; color: var(--tm-text-dim); }
.ssm-field-label { font-weight: 500; }
.ssm-pause-field { flex-grow: 1; max-width: 280px; }
.ssm-label-input {
  box-sizing: border-box; padding: 6px 10px; font-size: 12.5px; border-radius: 6px;
  border: 1px solid var(--tm-ghost-border); background: transparent; color: var(--tm-text); outline: none;
}
/* Rebuilt
   as Vue2's own Buefy `b-numberinput controls-position="compact"` shape -- a bordered
   `.field.has-addons` box (own file:972-976: border 1px solid rgba[0,0,0,.15]; radius:6px;
   overflow:hidden`) containing a ghost [-] button / centered input / ghost [+] button, each
   divided by a hairline (own file:990-999). */
.ssm-num-group {
  display: flex; align-items: stretch; max-width: 132px;
  border: 1px solid var(--tm-ghost-border); border-radius: 6px; overflow: hidden;
}
.ssm-num-btn {
  flex: 0 0 auto; width: 26px; display: flex; align-items: center; justify-content: center;
  padding: 0; border: none; background: transparent; color: var(--tm-text-dim); cursor: pointer;
  font-size: 13px; line-height: 1;
}
.ssm-num-btn:first-child { border-right: 1px solid var(--tm-ghost-border); }
.ssm-num-btn:last-child { border-left: 1px solid var(--tm-ghost-border); }
.ssm-num-btn:hover:not(:disabled) { background: var(--tm-ghost-hover-bg); color: var(--tm-text); }
.ssm-num-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.ssm-num-input {
  flex: 1 1 auto; min-width: 0; box-sizing: border-box; height: 2.25em; padding: 0 2px;
  font-size: 12px; text-align: center; border: none; background: transparent; color: var(--tm-text); outline: none;
}
/* Hide the native up/down spinner arrows -- Vue2's own Buefy stepper has no native browser
   spinner either (it's fully replaced by the ghost +/- buttons above). */
.ssm-num-input::-webkit-inner-spin-button, .ssm-num-input::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
.ssm-num-input { -moz-appearance: textfield; }
.ssm-err { display: block; color: var(--tm-danger); font-size: 11px; margin-top: 2px; }

/* Vue2's Save button is Bulma's own `.is-primary`
   solid fill = `$primary` -- `--tm-primary`/`--tm-primary-hover`, not `--tm-accent`. */
.ssm-save, .ssm-create {
  padding: 8px 16px; height: 32px; border-radius: var(--tm-control-radius); font-size: 12.5px; font-weight: 600; cursor: pointer;
  border: none; background: var(--tm-primary); color: var(--tm-chrome-text);
}
.ssm-save:hover:not(:disabled), .ssm-create:hover:not(:disabled) { background: var(--tm-primary-hover); }
.ssm-save:disabled, .ssm-create:disabled { opacity: 0.5; cursor: not-allowed; }

.ssm-manual-row { display: flex; flex-direction: column; gap: 10px; margin-top: 12px; }
/* Vue2's own manual-row scoped override sets
   the Create button's font-size to `0.8125rem` (13px, SnapshotSettingsModal.vue:1042), distinct
   from Save's own is-small 12.5px -- split out of the shared `.ssm-save, .ssm-create` rule above. */
.ssm-create { width: 100%; height: 40px; font-size: 13px; }
.ssm-label-input { width: 100%; background: var(--tm-panel-bg-solid); }
.ssm-label-input::placeholder { color: var(--tm-placeholder-text); }
/* Vue2's own focus state adds a 2px accent
   ring (box-shadow 0 0 0 2px rgba[$primary,.15], own file:1064) alongside the border-color
   change -- New-UI only had the border-color change. */
.ssm-label-input:focus {
  border-color: color-mix(in srgb, var(--tm-primary) 60%, transparent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--tm-primary) 15%, transparent);
}
.ssm-label-input:disabled { opacity: 0.55; }

.ssm-history { display: flex; flex-direction: column; min-height: 0; }
.ssm-history-header { padding: 0 0 8px; flex-shrink: 0; }
.ssm-history-header .ssm-key { font-size: 13px; font-weight: 600; color: var(--tm-text); }
.ssm-history-scroll { max-height: 420px; overflow-y: auto; padding-right: 4px; }
/* Vue2's own thin 6px always-faint webkit
   scrollbar (SnapshotSettingsModal.vue:1108-1119), replacing the OS/browser default this box
   fell back to before. */
.ssm-history-scroll::-webkit-scrollbar { width: 6px; }
.ssm-history-scroll::-webkit-scrollbar-track { background: transparent; }
.ssm-history-scroll::-webkit-scrollbar-thumb { background: var(--tm-ghost-border); border-radius: 10px; }
.ssm-history-scroll:hover::-webkit-scrollbar-thumb { background: var(--tm-scroll-thumb-hover); }
.ssm-history-empty { padding: 12px 0; text-align: center; }
/* Vue2's own animated shimmer gradient
   (linear-gradient 90deg, rgba[0,0,0,.05] 25%, rgba[0,0,0,.1] 37%, rgba[0,0,0,.05] 63%,
   `background-size: 400% 100%`, `snapshot-settings-modal-history-shimmer 1.4s ease infinite`,
   own file:1130-1133) -- replacing the previous static flat tint. */
.ssm-history-skeleton-row {
  height: 14px; border-radius: 4px; margin-bottom: 8px;
  background: linear-gradient(90deg, var(--tm-chip-bg) 25%, var(--tm-skeleton-shimmer-mid) 37%, var(--tm-chip-bg) 63%);
  background-size: 400% 100%;
  animation: ssm-history-shimmer 1.4s ease infinite;
}
@keyframes ssm-history-shimmer {
  0% { background-position: 100% 0; }
  100% { background-position: 0 0; }
}
.ssm-history-group:not(:last-child) { margin-bottom: 6px; }
/* Vue2's own sticky header background is
   rgba[255,255,255,.95] (95%-opaque, own file:1179), not a fully opaque solid -- and its hover
   tint is a distinct cool-grey rgba[242,243,245,.95] (own file:1185), not the panel's generic
   ghost-hover. */
.ssm-history-group-header {
  display: flex; align-items: center; gap: 6px; width: 100%; padding: 6px 8px;
  border-radius: var(--tm-control-radius); position: sticky; top: 0; z-index: 1;
  background: color-mix(in srgb, var(--tm-panel-bg-solid) 95%, transparent); border: none; border-bottom: 1px solid var(--tm-hairline);
  cursor: pointer; font-family: inherit; text-align: left; color: inherit;
}
.ssm-history-group-header:hover { background: var(--tm-history-header-hover-bg); }
.ssm-history-chevron { display: inline-block; font-size: 12px; color: var(--tm-text-dim); transition: transform 0.15s ease; }
.ssm-history-chevron--open { transform: rotate(90deg); }
.ssm-history-group-label { font-size: 12px; font-weight: 500; color: var(--tm-text-dim); }
.ssm-history-group-count {
  margin-left: auto; font-size: 10px; font-weight: 500; color: var(--tm-text-dim);
  background: var(--tm-chip-bg); border-radius: 980px; padding: 1px 7px; line-height: 14px;
}
/* Vue2's own
   `&__history-list::before`, a 1px vertical connector line running behind every dot in the
   group (own file:1212-1224). `left: 4px` lines up with the dot's own `left: 0`/8px-diameter
   below (both positioned relative to this same list's coordinate frame -- the list itself has
   no horizontal padding, and each item spans its full width, so an item's `left: 0` dot sits at
   the list's own x=0). */
.ssm-history-list { position: relative; padding: 2px 0 6px 0; list-style: none; margin: 0; }
.ssm-history-list::before {
  content: ''; position: absolute; top: 0; bottom: 10px; left: 4px; width: 1px;
  background: var(--tm-rail-connector);
}
/* Vue2's own `padding: 7px 6px 7px
   22px` (22px left reserves room for the absolutely-positioned dot+rail, own file:1230) and
   (`&:hover { background: rgba[0,0,0,.035] }`, own file:1234) -- a lighter alpha than the panel's
   generic ghost-hover, hence its own token. */
.ssm-history-item { position: relative; display: flex; align-items: flex-start; gap: 10px; padding: 7px 6px 7px 22px; border-radius: 6px; }
.ssm-history-item:hover { background: var(--tm-history-item-hover); }
/* Anchored to the rail
   (`position: absolute; left: 0; top: 12px`, own file:1237-1240) instead of floating in-flow,
   plus the secondary hairline ring (box-shadow 0 0 0 1px rgba[0,0,0,.12], own file:1247) around
   the existing white border. */
.ssm-history-dot {
  position: absolute; left: 0; top: 12px; width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
  border: 2px solid var(--tm-panel-bg-solid); box-shadow: 0 0 0 1px var(--tm-dot-ring);
}
.ssm-history-dot--auto { background: var(--tm-dot-auto); }
/* Vue2's manual dot is Buefy's own
   `$primary`, not the read-only chip's `--tm-accent` (see theme.css's token-split comment). */
.ssm-history-dot--manual { background: var(--tm-primary); }
.ssm-history-dot--preop { background: var(--tm-warn-dot); }
.ssm-history-info { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; flex-grow: 1; min-width: 0; }
.ssm-history-time { font-size: 12px; font-weight: 500; color: var(--tm-text); }
.ssm-history-badge { display: inline-block; padding: 1px 7px; border-radius: 980px; font-size: 10px; font-weight: 500; }
.ssm-history-badge--auto { background: var(--tm-chip-bg); color: var(--tm-text-dim); }
/* Vue2's manual badge is
   rgba[$primary,.12] / darken[$primary,14%], not the chip's `--tm-accent` family -- see
   theme.css's own comment on `--tm-primary-text` for the distinct darken-percentage citation. */
.ssm-history-badge--manual { background: color-mix(in srgb, var(--tm-primary) 12%, transparent); color: var(--tm-primary-text); }
.ssm-history-badge--preop { background: var(--tm-warn-bg); color: var(--tm-warn-text); }
.ssm-history-label { font-size: 12px; color: var(--tm-text-dim); overflow: hidden; text-overflow: ellipsis; }
.ssm-history-actions { display: flex; flex-shrink: 0; gap: 6px; }
/* Vue2's own `min-width: 84px`
   (SnapshotSettingsModal.vue:1297), not 68px. */
.ssm-history-browse, .ssm-history-delete {
  min-width: 84px; height: 26px; padding: 0 10px; border-radius: var(--tm-control-radius);
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
/* Vue2's own `<b-button>` here has no
   `size` prop, so it renders at Bulma's DEFAULT/medium size -- `font-size: 1rem`(16px), height
   `2.5em`≈40px (own file:1343-1354) -- not New-UI's previous 13px/~30px. `display: inline-flex`
   pins the height exactly regardless of line-height, same technique as the other footer buttons
   fixed alongside this one (RestoreDestinationModal/FileConflictDialog). */
.ssm-close {
  display: inline-flex; align-items: center; justify-content: center;
  padding: 0 16px; height: 40px; border-radius: var(--tm-control-radius); font-size: 16px; cursor: pointer;
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
