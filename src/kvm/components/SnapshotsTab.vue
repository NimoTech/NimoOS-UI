<script setup lang="ts">
// VM Settings dialog "Snapshots" tab: create-snapshot form + snapshot list (each with restore/delete,
// both require in-place double confirmation). Visual 1:1 mirrors Vue2 KVMFullPage.vue template
// :327-385 (create-vm-body snapshots-body section); logic mirrors createSnapshot(:1237-1258) /
// confirmRestoreSnapshot(:1260-1276) / confirmDeleteSnapshot(:1290-1302) / formatDate(:1316-1320).
//
// This component is a pure presentation layer — does not make any requests, only emits intent
// ('create' / 'confirm-delete' / 'confirm-restore'). The parent component (VmSettingsDialog →
// KvmPage) is responsible for actually calling useSnapshots' create/remove/restore, and the
// progress overlay / toast are assembled at that layer (hard constraint, brief Step 4).
//
// In-place double confirmation reuses the pattern from P5 OverflowMenu.vue (a single
// pendingAction+pendingId determines "who is pending confirmation"), but **does not extract a
// shared component** — OverflowMenu manages menu items (single list, single confirmation target),
// whereas this is a combination of "restore/delete as two independent buttons on the same snapshot"
// plus "multiple snapshots", a different shape (hard constraint, brief Step 4 explicitly requires).
// Nor does this need OverflowMenu's non-reactive closure variables + tick technique — that was to
// handle the timing issue of "parent component using v-if to unmount early during close animation"
// (P4 lesson), a scenario this component does not have (reka DialogContent unmounts entirely when
// open=false, does not play animation then unmount), plain ref is enough.
import { reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { KvmSnapshot } from '@nimotech/nimoos-service'

const props = defineProps<{
  vmId: string
  vmState: string
  snapshots: KvmSnapshot[]
  busy: boolean
  submitError: string
}>()

const emit = defineEmits<{
  create: [payload: { name: string; description: string }]
  'confirm-delete': [s: KvmSnapshot]
  'confirm-restore': [s: KvmSnapshot]
}>()

const { t } = useI18n()

const form = reactive({ name: '', description: '' })
// '' = no inline error; hard constraint 10: dialog inline error, no toast (same as existing
// CreateVmDialog/VmSettingsDialog pattern).
const localError = ref('')

function onCreateClick(): void {
  // Prevent duplicate submission (same pattern as CreateVmDialog.onSubmit): native `disabled` already
  // blocks real clicks, this adds a second JS layer safeguard. Mutation validation in task report.
  if (props.busy) return
  // Following Vue2 createSnapshot(:1238-1240): if name is empty (including whitespace-only), do not send
  // request. **Fix correct**: Vue2 uses toast, this project's KVM area uses dialog inline error, no toast
  // (hard constraint 7).
  if (!form.name.trim()) {
    localError.value = t('kvmErrNoSnapshotName')
    return
  }
  localError.value = ''
  emit('create', { name: form.name, description: form.description })
}

// Clear form after successful creation (following Vue2 createSnapshot :1250:
// `this.snapshotForm = { name: '', description: '' }`, only on success). This component does
// not own the "success" result itself — the parent signals "this round succeeded" by busy going
// from true to false and submitError staying empty (consistent with CreateVmDialog/VmSettingsDialog's
// saving/submitError contract). Use the oldBusy parameter rather than a separate ref to track "was
// busy last time": the watch callback already provides the previous value.
watch(() => props.busy, (isBusy, wasBusy) => {
  if (wasBusy && !isBusy && !props.submitError) {
    form.name = ''
    form.description = ''
  }
})

// In-place double confirmation: a single pendingAction+pendingId determines "who is pending
// confirmation" (following Vue2's single pendingConfirmAction/pendingConfirmId semantics,
// confirmRestoreSnapshot:1265-1275 / confirmDeleteSnapshot:1291-1301). **Fix correct**: do not
// copy the dead-code toast in confirmRestoreSnapshot about "VM must be stopped" (:1262) — the
// restore button itself is already `:disabled="vmState !== 'stopped'"` (:368), this branch is
// unreachable (spec §1.15 verified).
const pendingAction = ref<'' | 'delete' | 'restore'>('')
const pendingId = ref('')

function isPending(action: 'delete' | 'restore', id: string): boolean {
  return pendingAction.value === action && pendingId.value === id
}

function confirmThenEmit(action: 'delete' | 'restore', snap: KvmSnapshot): void {
  if (isPending(action, snap.id)) {
    pendingAction.value = ''
    pendingId.value = ''
    // Full-branch review fix (A1, reported): we used to not clear localError here, causing "stale
    // validation failure text from a previous create" to continue blocking the `.cv-error` slot when
    // switching to delete/restore — the precedence of `localError || props.submitError` would hide
    // the actual backend failure message this time (see :143 template). This branch is the only exit
    // for "emit after confirm", clearing here follows the same pattern as CreateVmDialog.onSubmit(:172,
    // clear localError on each valid submit): before a new round of results starts (whether success
    // or the failure message the parent is about to write), first clear stale local validation errors
    // from the previous round.
    localError.value = ''
    // Hardcode event name in branch (not ternary expression computing a string to pass to emit) —
    // defineEmits overload signatures cannot recognize union-type strings from ternary, vue-tsc will
    // error "argument type mismatch" (tested).
    if (action === 'delete') emit('confirm-delete', snap)
    else emit('confirm-restore', snap)
  } else {
    // Replace the pending-confirmation target entirely with this click's (action, id) — naturally
    // implements "confirmation mutual exclusion" (switch to another snapshot) and "changing action
    // also resets" (same snapshot, different action): single source of truth, old target no longer
    // matches isPending() and automatically shows as "not pending", no separate reset branch needed.
    // Mutation verification in task report.
    pendingAction.value = action
    pendingId.value = snap.id
  }
}

// Following Vue2 formatDate(:1316-1320).
function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleString()
}
</script>

<template>
  <div>
    <div class="cv-field">
      <label class="cv-label">{{ t('kvmCreateSnapshot') }}</label>
    </div>
    <div class="cv-field">
      <label class="cv-label">{{ t('kvmName') }}</label>
      <input
        v-model="form.name"
        type="text"
        name="snapshotName"
        :placeholder="t('kvmSnapshotNamePlaceholder')"
        class="cv-input"
      />
    </div>
    <div class="cv-field">
      <label class="cv-label">{{ t('kvmDescription') }}</label>
      <input
        v-model="form.description"
        type="text"
        name="snapshotDescription"
        :placeholder="t('kvmSnapshotDescPlaceholder')"
        class="cv-input"
      />
    </div>
    <div class="cv-field">
      <button
        type="button"
        class="cv-primary-btn"
        :class="{ 'is-loading': props.busy }"
        :disabled="props.busy"
        @click="onCreateClick"
      >
        {{ t('kvmCreate') }}
      </button>
    </div>

    <p v-if="localError || props.submitError" class="cv-error">{{ localError || props.submitError }}</p>

    <div class="cv-field">
      <!-- Reuse kvmTabSnapshots (same i18n key as VmSettingsDialog's tab text) — Vue2's
           $t('Snapshots') here and the tab button's $t('Snapshots') are the same i18n key and
           same translation segment ("Snapshots"), not a coincidental word collision, no need for a
           new key just for identical text. -->
      <label class="cv-label">{{ t('kvmTabSnapshots') }}</label>

      <div v-if="props.snapshots.length === 0" class="cv-empty-state">
        <span>{{ t('kvmNoSnapshots') }}</span>
      </div>
      <div v-else>
        <div
          v-for="snap in props.snapshots"
          :key="snap.id"
          class="cv-field cv-snapshot-item"
        >
          <div class="cv-snapshot-info">
            <span class="cv-snapshot-name">{{ t('kvmName') }}: {{ snap.name }}</span>
            <span v-if="snap.description" class="cv-snapshot-desc">{{ t('kvmDescription') }}: {{ snap.description }}</span>
            <span class="cv-snapshot-date">{{ t('kvmCreatedAt') }}: {{ formatDate(snap.createdAt) }}</span>
          </div>
          <div class="cv-snapshot-actions">
            <button
              type="button"
              class="cv-btn cv-btn-restore"
              :disabled="props.vmState !== 'stopped'"
              @click="confirmThenEmit('restore', snap)"
            >
              <span aria-hidden="true">↺</span>
              <span :class="{ 'confirm-text-danger': isPending('restore', snap.id) }">
                {{ isPending('restore', snap.id) ? t('kvmAreYouSure') : t('kvmRestore') }}
              </span>
            </button>
            <button
              type="button"
              class="cv-btn cv-btn-delete"
              @click="confirmThenEmit('delete', snap)"
            >
              <span aria-hidden="true">⊟</span>
              <!-- Fix correct (reported): Vue2's delete button span at :379 does not bind
                   `confirm-text-danger` (only the restore button at :372 does) — both button
                   backgrounds have always been red, this omission is almost unnoticeable in Vue2, but
                   brief Step 3 coverage point 8 explicitly requires delete's "are you sure?" to also
                   carry this class; here we complete it per brief, logged as intentional deviation
                   rather than copying this asymmetry. -->
              <span :class="{ 'confirm-text-danger': isPending('delete', snap.id) }">
                {{ isPending('delete', snap.id) ? t('kvmAreYouSure') : t('kvmDelete') }}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
