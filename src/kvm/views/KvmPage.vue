<script setup lang="ts">
// KVM area main page (route /kvm). Visual 1:1 with Vue2 components/KVM/KVMFullPage.vue.
// P5 = list + console + power; P6 adds create wizard / VM settings / snapshots / global settings.
//
// ⚠️ This area is **fixed dark and does not follow the global theme** — the Vue2 page uses a
// hardcoded dark console palette; --kvm-* tokens have identical values in both theme blocks
// (see the comment in styles/theme.sp9.css).
import { ref, computed, watch, watchEffect, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import '../styles/kvm.css'
import VmSidebar from '../components/VmSidebar.vue'
import ConsoleHeader from '../components/ConsoleHeader.vue'
import ConsoleStage from '../components/ConsoleStage.vue'
import SendKeyToolbar from '../components/SendKeyToolbar.vue'
import InstallBanner from '../components/InstallBanner.vue'
import SpiceInfoBar from '../components/SpiceInfoBar.vue'
import ProgressOverlay from '../components/ProgressOverlay.vue'
import KvmGlobalSettingsDialog from '../components/KvmGlobalSettingsDialog.vue'
import OsSelector from '../components/OsSelector.vue'
import CreateVmDialog from '../components/CreateVmDialog.vue'
import VmSettingsDialog from '../components/VmSettingsDialog.vue'
import { useVmList } from '../composables/useVmList'
import { useVncConsole } from '../composables/useVncConsole'
import { useIsoList } from '../composables/useIsoList'
import { useKvmHostInfo } from '../composables/useKvmHostInfo'
import { useSnapshots } from '../composables/useSnapshots'
import { isWindowsGuest } from '../util/vmState'
import { useToast } from '../../stores/toast'
import type { KvmVM, KvmCreateVMRequest, KvmUpdateVMRequest, KvmSnapshot } from '@nimotech/nimoos-service'
import type { SelectedOs } from '../components/OsSelector.vue'

const { t, te } = useI18n()
// Must-fix #1 (full-branch final review): in Vue2, the six power actions + toggleAutoStart +
// deleteVM + handleInstallationFinished all show a buefy toast on success — this is the sole
// consumption point (useVmList.ts comments always said "toasts are the view layer's job", but
// the view layer never wired it up: an undeclared deviation, fixed now). New-UI's global toast
// is useToast() (src/stores/toast.ts); dialogs/inline errors all use it, so it is reused here
// too rather than inventing a new mechanism.
const toast = useToast()

// Vue2 isSidebarCollapsed = sidebarCollapsed && !sidebarHover —
// when collapsed, hovering temporarily expands it and leaving collapses it again.
// Copied verbatim (KVMFullPage.vue:689-690).
const sidebarCollapsed = ref(false)
const sidebarHover = ref(false)
const collapsed = computed(() => sidebarCollapsed.value && !sidebarHover.value)

// Task 2: sidebar gear → global settings dialog. KvmGlobalSettingsDialog is mounted at the
// bottom of the template, always present (not v-if), toggled via v-model:open — the component's
// internal watch(props.open) relies on this switch to re-fetch on every open (see the comment
// at the top of that component).
const globalSettingsOpen = ref(false)

const s = useVmList()

// ===================== Create flow wiring (P6 Task 8) =====================
// isoList/hostInfo must be created by KvmPage and live for the page's lifetime (see the
// comment at the top of useIsoList.ts) — OsSelector/CreateVmDialog are pure presentation
// layers and do not create these two composables themselves.
// ⚠️ Cross-task dependency (a point the Task 7 review explicitly called out): in the template
// below, `<OsSelector>` and `<CreateVmDialog>` must receive the same `isoList.isos.value` for
// `:isos` — CreateVmDialog's internal watch(form.osTemplate) looks up the template via
// osTemplateDefaults(id, props.isos); if the two sides hold different isos, the template id
// the user picked in OsSelector cannot be found in the create dialog and the parameter linkage
// (recommended vcpu/memory/disk) silently breaks.
const isoList = useIsoList()
const hostInfo = useKvmHostInfo()

const createOpen = ref(false)
const osSelectorOpen = ref(false)
const selectedOs = ref<SelectedOs | null>(null)
const creating = ref(false)
const createError = ref('')
// Full-branch review fix (A3, declared): inline error for ISO download failure — see
// isoList.onDownloadFailed below and the full "why not a toast" reasoning in the comment at
// the top of the OsSelector component.
const isoDownloadError = ref('')

// ===================== VM settings dialog wiring (P6 Task 9) =====================
const vmSettingsOpen = ref(false)
const settingsSelectedOs = ref<SelectedOs | null>(null)
const settingsSaving = ref(false)
const settingsError = ref('')

// Mirrors the three download-state notices of Vue2 handleOSSelect/onOSSelect
// (OSSelector.vue:165/:173/:1421) — the download progress subscription lives in isoList
// (persistent, not tied to dialog open/close).
//
// onDownloadDone: success still uses the global toast, **unchanged** — even though this toast
// is hidden by the OS selector's overlay (z 920 > toast's z 60) while it is still open, the
// card simultaneously flips to the green is-selected/"select" state, so no information is
// actually lost. Review correction (the earlier comment implying "the toast is visible here"
// was inaccurate — what is actually visible is the card state change; the toast itself is
// equally hidden while the dialog is open, but that doesn't affect correctness, so no need to
// switch this one to inline).
isoList.onDownloadDone((row) => toast.show(`${row.name} ${t('kvmToastDownloaded')}`))
// onDownloadFailed (full-branch review fix A3, declared): **no longer** use toast. Key difference
// from onDownloadDone above — download failure has no "card turns green" fallback visual, the card
// just quietly reverts from the percentage to "download", and the toast is completely blocked by
// the overlay. Net result is the user has no visible failure explanation. Changed to write into
// `isoDownloadError`, displayed above the overlay via OsSelector's own `download-error` prop (see
// complete derivation in that component's top comment). Clear timing (following CreateVmDialog/
// VmSettingsDialog's existing "clear the previous one before each new round" convention): see
// onOsDownload below (before new download starts) and watch(osSelectorOpen) (when closing selector).
isoList.onDownloadFailed(() => { isoDownloadError.value = t('kvmDownloadFailed') })

// Full-branch review fix A3: OsSelector's `download` emit was previously bound directly to
// `isoList.download` — now inserted an extra step to clear the previous error before forwarding
// the actual download call.
function onOsDownload(id: string): void {
  isoDownloadError.value = ''
  void isoList.download(id)
}

// SP16 Task 6: Custom (local ISO browser) expanded state is owned by this page — OsSelector's
// content is unmounted by reka each time it closes, so if the state lives inside IsoBrowser it
// would inevitably reset (Vue2 selector is permanently mounted, expand once and stays expanded).
const isoBrowserExpanded = ref(false)

watch(osSelectorOpen, (open) => {
  // Close: clear any lingering download failure error — if not cleared, opening again (whether
  // from create dialog or settings dialog) will carry out old, now-irrelevant errors from last time.
  if (!open) { isoDownloadError.value = ''; return }
  // Open: Vue2 selector re-fetches the list each time visible:true. Here the list is a page-owned
  // prop; without re-fetching, if user finishes downloading an ISO in the dialog, closes, then
  // reopens, they see the old list from before that download.
  void isoList.fetch()
})

// P6 Task 9: OsSelector is a single page-level shared dialog (z-index 920 layered above other
// dialogs); both create dialog and VM settings dialog open it — following Vue2's approach using
// a boolean flag (settingsOSSelector) to distinguish "who this opening is for", onOSSelect routes
// the result based on this flag (:1376-1428). Here we use the same pattern (osSelectorTarget),
// but with a string literal type instead of a boolean, which is more self-documenting.
const osSelectorTarget = ref<'create' | 'settings'>('create')
function openOsSelectorFor(target: 'create' | 'settings'): void {
  osSelectorTarget.value = target
  osSelectorOpen.value = true
}

function onOsSelect(os: SelectedOs): void {
  if (osSelectorTarget.value === 'settings') {
    settingsSelectedOs.value = os
  } else {
    selectedOs.value = os
  }
}

// Open create dialog (reached via "Add VM" button / auto-open on empty list). Following Vue2's
// showCreateVM (:1155-1157) `this.selectedOS = null` step — avoid leftover selection from a previous
// open-but-no-submit-then-close carrying over into this new dialog open (default values / host
// specs now read from the existing useKvmHostInfo, not fetched again here with getSettings, see
// CreateVmDialog.vue top comment "Fix divergence #2").
function openCreateDialog(): void {
  selectedOs.value = null
  createOpen.value = true
}

// Auto-open create dialog on empty list (following Vue2 fetchVMs :898-902). ⚠️ Open only once
// on "first fetch returns empty", not re-open after every refresh — Vue2 checks this directly in
// fetchVMs, and fetchVMs is only called on mounted and MessageBus events, so Vue2 naturally has
// only one entry point that triggers "first fetch returns empty". New-UI moves this decision to
// an independent watch(s.isLoading), and without any restrictions, any subsequent fetchVMs()
// triggered by MessageBus event (e.g., another client deleted all VMs) would re-open this dialog —
// even if the user just manually closed it. Using a one-time flag autoOpenedCreate explicitly
// expresses the "open only once" constraint, preventing unexpected re-occurrence if new refresh
// triggers are added later.
let autoOpenedCreate = false
watch(() => s.isLoading.value, (loading) => {
  if (!loading && !autoOpenedCreate && s.vms.value.length === 0) {
    autoOpenedCreate = true
    openCreateDialog()
  }
})

async function onCreateSubmit(payload: KvmCreateVMRequest): Promise<void> {
  creating.value = true
  createError.value = ''
  try {
    const err = await s.create(payload)
    // CreateVmDialog's `submitError` contract (Task 7 defined, different from InstallBanner/
    // ConsoleStage's `error-key`): the component renders it as-is internally, does not itself
    // perform te()/t() judgment — `localError` beside it is already `t(err.key)` text, both should
    // maintain consistency of "everything displayed at this position is already resolved text".
    // Add judgment here to avoid passing create()'s i18n key name fallback (e.g. 'kvmFailedToCreate')
    // naked, which would display as key name instead of Chinese in the dialog.
    createError.value = err && te(err) ? t(err) : err
    if (createError.value === '') {
      toast.show(t('kvmToastVmCreated'))
      createOpen.value = false
      selectedOs.value = null
    }
  } finally {
    creating.value = false
  }
}

// Following Vue2's saveSettings (:1494-1514) success/failure branches — networkMode folding /
// form validation already sunk into VmSettingsDialog internal (hard constraint 7: inline in
// dialog, not at this layer), here just manages "send request → success close dialog and toast
// → failure inline display". The `err && te(err) ? t(err) : err` check is for the same reason
// as onCreateSubmit (see comment above): useVmList.update()'s fallback is i18n key name
// (e.g. 'kvmFailedToSaveSettings'), without judgment direct render would display the key name
// raw to user.
async function onSettingsSubmit(patch: KvmUpdateVMRequest): Promise<void> {
  const vm = s.selectedVM.value
  if (!vm) return
  settingsSaving.value = true
  settingsError.value = ''
  try {
    const err = await s.update(vm, patch)
    settingsError.value = err && te(err) ? t(err) : err
    if (settingsError.value === '') {
      toast.show(t('kvmToastSettingsSaved'))
      vmSettingsOpen.value = false
    }
  } finally {
    settingsSaving.value = false
  }
}

// ===================== Snapshots tab wiring (P6 Task 10) =====================
// snaps created by KvmPage, lives for the page's lifetime (following existing convention of
// isoList/hostInfo) — VmSettingsDialog/SnapshotsTab are pure presentation layers, do not own data.
const snaps = useSnapshots()
const snapCreating = ref(false)
// snapCreateError bound to SnapshotsTab's submitError prop — not just create's own error position,
// delete/restore failures also write here (see onSnapshotConfirmDelete/onSnapshotConfirmRestore
// comments below: toast is not visible when this dialog is open, must use the same inline error
// position). Variable name kept as "snapCreateError" without changing (to avoid unrelated
// refactoring expanding the diff), but semantics are now "snapshots tab's current inline error
// text", not "create-only error".
const snapCreateError = ref('')

// Following Vue2 :250 fetch on tab click (`@click="settingsActiveTab = 'snapshots'; fetchSnapshots()"`,
// unconditionally re-fetches each click, even if already on snapshots tab) — VmSettingsDialog's
// selectTab() similarly does not check "is this already the current tab", emits tab-change every
// click, correspond here as-is without extra judgment.
function onSettingsTabChange(tab: 'general' | 'snapshots'): void {
  if (tab !== 'snapshots') return
  const vm = s.selectedVM.value
  if (vm) void snaps.fetch(vm.id)
}

// Following Vue2's createSnapshot (:1237-1258) success/failure branches — name validation already
// sunk into SnapshotsTab internal (hard constraint 7: inline in dialog, not at this layer), here
// just manages "send request → success toast → failure inline display". The `err && te(err) ? t(err) : err`
// check follows the existing pattern of onCreateSubmit/onSettingsSubmit: useSnapshots.create()'s
// fallback is i18n key name.
async function onSnapshotCreate(payload: { name: string; description: string }): Promise<void> {
  const vm = s.selectedVM.value
  if (!vm) return
  snapCreating.value = true
  snapCreateError.value = ''
  try {
    const err = await snaps.create(vm.id, payload.name, payload.description)
    snapCreateError.value = err && te(err) ? t(err) : err
    if (snapCreateError.value === '') {
      // Full sentence (following Vue2 :1249), don't concatenate snapshot name. Full-branch review
      // fix: create success does not close settings dialog, this toast will also be blocked by
      // the dialog overlay (z 900+) — but the snapshot list itself will have a new row, information
      // is not actually lost, unlike the failure branches below in onSnapshotConfirmDelete/
      // onSnapshotConfirmRestore where "nothing visible changes", no need to move to inline
      // (this is the same z-index cause-effect chain as those two, just here the success path
      // has the list change as fallback, no extra handling needed).
      toast.show(t('kvmToastSnapshotCreated'))
    }
  } finally {
    snapCreating.value = false
  }
}

// Following Vue2's confirmDeleteSnapshot/deleteSnapshot (:1290-1314): after second confirmation
// passes (SnapshotsTab already completed local confirmation, this receives "confirmed execute"),
// display progress overlay, await, finally remove overlay.
// **Fix to correct state (review fix, corrected previous "failure also toasts" divergence record)**:
// Vue2 failure uses toast because buefy's toast z-index is higher than its own modal, overlay can't
// block toast. New-UI's z-axis relation is reversed — global toast is z-index:60 (src/components/
// AppToast.vue:12 `.toast-stack`), KVM dialog overlay is z-index:900, content 901 (KvmDialog.vue:23
// default `zBase:900` + :33/:36 inline style). 60 < 900, when settings dialog is open (delete/restore
// can only happen when dialog is open) toast will be completely covered by overlay, user can't see —
// this is exactly why hard constraint 10 "dialog inline errors" exists, not style preference. Changed
// to write into `snapCreateError` (forwarded via submitError prop to SnapshotsTab's own `.cv-error`,
// already vetted in Task 10 first version).
async function onSnapshotConfirmDelete(snap: KvmSnapshot): Promise<void> {
  const vm = s.selectedVM.value
  if (!vm) return
  snapCreateError.value = '' // Clear previous round's lingering error before starting new operation, prevent permanent red text after one failure
  progress.value = { title: t('kvmDeletingSnapshot'), message: `${snap.name} ${t('kvmDeletingShort')}...` }
  let err = ''
  try {
    err = await snaps.remove(vm.id, snap.id)
  } finally {
    progress.value = null
  }
  if (err === '') {
    // Full-branch review fix (C3, declared, original comment "toast is visible now" is inaccurate):
    // after delete success the settings dialog **does not** close (only restore success closes it,
    // see below :283), this toast fires while dialog is still open, will equally be blocked by
    // z-index 900+ dialog overlay, user can't see — just the delete action itself has other visible
    // change as fallback (that row disappears from snapshot list), information is not actually lost,
    // so no need to move to inline like failure branch. Behavior unchanged, just change this
    // erroneous assertion "toast is visible now" to accurate causal explanation.
    toast.show(`${snap.name} ${t('kvmToastDeleted')}`)
  } else {
    snapCreateError.value = err && te(err) ? t(err) : err
  }
}

// Following Vue2's confirmRestoreSnapshot/restoreSnapshot (:1260-1288). **Do NOT copy**
// confirmRestoreSnapshot (:1262)'s "must stop VM before restoring snapshot" dead code toast —
// restore button itself already `:disabled="vmState !== 'stopped'"` (SnapshotsTab, following Vue2 :368),
// cannot reach this branch (spec §1.15 verified). Close entire settings dialog on restore success
// (following Vue2 :1282). Inline display reasoning for failure branch same as onSnapshotConfirmDelete's
// top comment (toast will be blocked by dialog overlay).
async function onSnapshotConfirmRestore(snap: KvmSnapshot): Promise<void> {
  const vm = s.selectedVM.value
  if (!vm) return
  snapCreateError.value = '' // Clear previous round's lingering error before starting new operation
  progress.value = { title: t('kvmRestoringSnapshot'), message: `${snap.name} ${t('kvmRestoringShort')}...` }
  let err = ''
  try {
    err = await snaps.restore(vm.id, snap.id)
  } finally {
    progress.value = null
  }
  if (err === '') {
    toast.show(`${snap.name} ${t('kvmRestoredShort')}`) // Success still uses global toast — dialog closes at this point, toast is visible
    vmSettingsOpen.value = false
  } else {
    snapCreateError.value = err && te(err) ? t(err) : err
  }
}

// ===================== VNC console wiring (Task 6) =====================
// ConsoleStage is the component that actually owns the canvas mount point (hostEl), but
// useVncConsole needs a Ref at setup time — at that point ConsoleStage is likely not yet mounted
// (right side is empty before selecting a VM). Use watchEffect to mirror the hostEl that
// ConsoleStage exposes into this ref, always pointing to "current ConsoleStage instance's mount
// point" (null when no ConsoleStage).
const stageRef = ref<InstanceType<typeof ConsoleStage> | null>(null)
const hostEl = ref<HTMLElement | null>(null)
watchEffect(() => { hostEl.value = stageRef.value?.hostEl ?? null })
const vnc = useVncConsole(hostEl)

// SPICE ports write-back (following Vue2 connectVNC :974-983): update both list item and selectedVM.
// useVncConsole doesn't touch vms list (brief convention), write-back delegated to caller of data
// layer — here.
vnc.onSpicePorts((vmId, ports) => {
  const inList = s.vms.value.find((v) => v.id === vmId)
  if (inList) {
    inList.spicePort = ports.spicePort
    inList.spiceTlsPort = ports.spiceTlsPort
  }
  if (s.selectedVM.value?.id === vmId) {
    s.selectedVM.value.spicePort = ports.spicePort
    s.selectedVM.value.spiceTlsPort = ports.spiceTlsPort
  }
})

// Power action (start/stop/pause/resume/wakeup/restart) connect/disconnect timing decided inside
// useVmList (calls these two callbacks after setVMState), here only responsible for connecting
// the callbacks to useVncConsole's connect/disconnect.
s.onVncShouldConnect((vm) => { void vnc.connect(vm) })
s.onVncShouldDisconnect(() => { vnc.disconnect() })
// SP16 Task 8: After restart, reconnection delegated to kvm:vm_started, but that event never arrives
// when MessageBus is down — previous net result was black console, zero explanation on UI. useVmList's
// floor timer says it here. It doesn't reconnect (reconnect would fail, see useVmList.restart derivation),
// just explains current state + gives self-rescue action.
s.onVncReconnectStalled(() => { toast.show(t('kvmConsoleReconnectStalled')) })

// When switching selected VM, follow Vue2's watch selectedVM (:747-758) second half: only
// connect/disconnect when "switched to a different VM", modifying state of same VM in-place
// (power action/MessageBus event) does not go through here, that's the job of the two callbacks above.
// First half's SPICE info bubble timer (spiceInfoDismissed/spiceTimer) belongs to spice-info-bar,
// not implemented at Task 6 time, added as separate section below at Task 8 (not merged into this
// watch because that section also must not trigger when "VM not switched, id unchanged" — same
// watch callback can't easily express both "connect/disconnect only on id change" and "reset timer
// on id change" with these slightly different criteria, splitting makes it clearer, brief Step 3
// example code also splits into independent watch).
watch(() => s.selectedVM.value, (newVM, oldVM) => {
  if (!newVM) { vnc.disconnect(); return }
  if (oldVM?.id !== newVM.id) {
    if (newVM.state === 'running') void vnc.connect(newVM)
    else vnc.disconnect()
  }
})

// ===================== Install banner + SPICE info bar (Task 8) =====================
// Following Vue2's watch selectedVM first half (:748-752): reset "dismissed" flag and reset
// 180-second auto-collapse timer when switching VM. Split into independent watch (not merged above)
// because of explanation in comment above.
const hostname = window.location.hostname // Following Vue2 hostname computed (:707-709), doesn't change during runtime, no ref needed.
const spiceDismissed = ref(false)
// Review Important #2 fix (2026-08-02): when switching VM this also needs clearing — previous VM's
// eject failure message shouldn't carry over to the newly selected VM ("install banner inline error"
// is new display position added this review, see InstallBanner component's top comment; clear here
// in the same watch, reasoning same as spiceDismissed reset, no separate watch needed).
const ejectError = ref('')
let spiceTimer: ReturnType<typeof setTimeout> | undefined
// Full-branch review fix (A2, declared): this watch originally only managed SPICE bar + eject error
// reset, now takes on another responsibility — VM settings dialog's v-if binds to `s.selectedVM.value`
// (see template :718), but the dialog's own toggle `vmSettingsOpen` is independent ref. When the
// selected VM is deleted elsewhere (another browser tab / CLI / another user), `kvm:vm_deleted` sets
// selectedVM to null, v-if will **unmount** the dialog, but `vmSettingsOpen` itself remains true —
// next time user selects any other VM, v-if becomes true, dialog will pop itself up with this stale
// true, while user just wants to glance at the new VM. Conveniently also clear settingsError/
// snapCreateError, reasoning same as ejectError — they're all "error text left over from previous VM",
// shouldn't carry into next possible settings dialog reopen.
watch(() => s.selectedVM.value?.id, () => {
  spiceDismissed.value = false
  ejectError.value = ''
  vmSettingsOpen.value = false
  settingsError.value = ''
  snapCreateError.value = ''
  clearTimeout(spiceTimer)
  if (s.selectedVM.value) spiceTimer = setTimeout(() => { spiceDismissed.value = true }, 180_000)
})

// Install banner: following Vue2 :142 (v-if="selectedVM && selectedVM.state === 'running' &&
// !selectedVM.bootFromDisk && selectedVM.iso").
const showInstallBanner = computed(() => {
  const vm = s.selectedVM.value
  return !!vm && vm.state === 'running' && !vm.bootFromDisk && !!vm.iso
})

// SPICE info bar: following Vue2 :157 (v-if="selectedVM?.spicePort > 0 && selectedVM?.bootFromDisk
// && !spiceInfoDismissed").
const showSpiceBar = computed(() => {
  const vm = s.selectedVM.value
  return !!vm && vm.spicePort > 0 && vm.bootFromDisk && !spiceDismissed.value
})

const isWindowsGuestSelected = computed(() => isWindowsGuest(s.selectedVM.value))

// Following Vue2's handleInstallationFinished (:862-877): after setBootFromDisk(true) whole table
// refreshes, this logic already implemented in useVmList.ejectInstallMedia (including its own
// independent re-entrancy guard ejectingIds). The ejectBusy here is **the view layer's own**
// button busy state ref — brief explicitly requires not grafting useVmList's internal non-reactive
// ejectingIds (it's just a plain Set for internal deduplication, not a ref, template reading it
// won't trigger re-render, `InstallBanner`'s `is-loading` class would never show). Two-layer
// guards each with their duty: ejectingIds blocks "two concurrent requests for same VM",
// ejectBusy blocks "should this button's loading visual display, should the button click be
// intercepted by InstallBanner's own onClick" — functionally overlap but not the same state,
// can't substitute each other.
const ejectBusy = ref(false)
// SP16 Task 7: page can be unmounted while request is in flight. useVmList's own `alive` guard
// already blocked "write to destroyed state", but it reports that case **same as success** as
// '' — caller thus toasts success. Here self-check existence, keep useVmList's return value
// contract as-is unchanged.
let pageAlive = true
onUnmounted(() => { pageAlive = false })

async function onEjectFinish(): Promise<void> {
  const vm = s.selectedVM.value
  if (!vm || ejectBusy.value) return
  ejectBusy.value = true
  ejectError.value = '' // Clear previous error from last click before new round, prevent permanent error state after one failure
  try {
    // Review second round fix (Important #2): no longer read shared s.lastError — that's a single ref
    // shared by runAction/toggleAutostart/remove/ejectInstallMedia, if user triggers power action
    // on **another VM** while eject is in flight and resolves in the microtask gap of this await and
    // writes lastError, the old approach would display that unrelated error on this VM's install
    // banner ("crosstalk", see regression test in useVmList.test.ts). ejectInstallMedia now returns
    // the result directly (''=success, non-empty=this call's failure text), error naturally belongs
    // only to "this call", won't be polluted by any concurrent operations.
    const err = await s.ejectInstallMedia(vm)
    // SP16 Task 7: if page is gone, do nothing — neither write ref nor toast. See explanation below
    // about "''=success or =disposed".
    if (!pageAlive) return
    ejectError.value = err
    // Mandatory①: must toast on success too (Vue2 handleInstallationFinished :867-870, fixed full
    // sentence text, unlike power actions where we concatenate vm.name). ejectInstallMedia's return
    // value contract is ''=success/blocked by re-entrancy guard/short-circuit after dispose,
    // non-empty=this call's failure text (see top comment of that function). Here can safely treat
    // '' as success — entry `ejectBusy` of this function already guarantees only one call in flight
    // at a time, won't hit the "blocked by re-entrancy guard" branch; other possibility is component
    // already disposed.
    //
    // ⚠️ SP16 Task 7 fix: what was originally written here was "when component disposed, toasting
    // or not has no audience, doesn't affect correctness" — that's wrong, and is exactly how the
    // defect arises. Toast container is mounted at app layer, lives longer than this page, after
    // disposal message still visible to user: eject request fails + page already navigated away ⇒
    // ejectInstallMedia's catch goes `if (!alive) return ''` ⇒ here treat '' as success ⇒ user
    // sees "disc ejected" on another page. The pageAlive self-check above blocks this path.
    if (ejectError.value === '') toast.show(t('kvmEjectSuccess'))
  } finally {
    ejectBusy.value = false
  }
}

// ===================== SendKey floating toolbar + fullscreen (Task 7) =====================
// Following Vue2's `.console-display` with @mouseenter/@mouseleave/@mousemove (:154,:1140-1153)
// + toggleFullscreen/handleFullscreenChange (:1120-1133, verified 2026-08-02).
//
// Review fix (Important #1, documenting the detour): initial version used `<Teleport :to="hostEl">`
// to insert toolbar into ConsoleStage's internal `.console-display` node, mouse events also manually
// `addEventListener` on hostEl — reason was brief's Files list didn't include ConsoleStage.vue.
// Review pointed out this was overcautious: brief list is "what we expect to change" not a boundary
// for forbidden changes, and ConsoleStage adding `<slot />` + forwarding three mouse events (see
// that file) is simpler and lower risk than Teleport + manual lifecycle management — no need to
// maintain "remove/attach listeners when hostEl node changes" (`watch(hostEl,...)` +
// `attachConsoleListeners`/`detachConsoleListeners`, already deleted), the framework's slot/event
// system itself guarantees this. Now SendKeyToolbar is passed as slot content into `<ConsoleStage>`,
// mouse events received via `@console-enter`/`@console-leave`/`@console-move` forwarded by
// ConsoleStage.
const sendKeyVisible = ref(false)
const toolbarHover = ref(false)
const isFullscreen = ref(false)

// Toolbar can only appear when selected VM is in running state — corresponds to Vue2 template
// `v-if="sendKeyVisible && selectedVM.state === 'running'"` (:195). Even if sendKeyVisible is set
// true by onConsoleEnter, if not running state this is still false, toolbar won't render (below
// onConsoleEnter like Vue2 doesn't check state, relies on this computed as fallback, details in that
// function's comment).
const showSendKeyToolbar = computed(
  () => sendKeyVisible.value && s.selectedVM.value?.state === 'running',
)

// Following Vue2 :154 `@mouseenter="sendKeyVisible = true"` — note deliberately not checking VM
// state here, Vue2 original doesn't check either (only leave/move methods check internally),
// copy 1:1, delegate to showSendKeyToolbar above for rendering layer fallback.
function onConsoleEnter(): void {
  sendKeyVisible.value = true
}

// Following Vue2 onConsoleLeave (:1140-1142).
function onConsoleLeave(): void {
  if (!toolbarHover.value && s.selectedVM.value?.state === 'running') sendKeyVisible.value = false
}

// Following Vue2 onConsoleMove (:1144-1153): show when mouse's horizontal coordinate enters right
// 80px of container, otherwise (and not hovering over toolbar) hide. e.currentTarget is the
// `.console-display` node itself that ConsoleStage binds @mousemove to (native event forwarding
// doesn't change currentTarget), exactly equivalent to Vue2 line by line.
function onConsoleMove(e: MouseEvent): void {
  if (s.selectedVM.value?.state !== 'running') return
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const mouseX = e.clientX - rect.left
  if (mouseX >= rect.width - 80) {
    sendKeyVisible.value = true
  } else if (!toolbarHover.value) {
    sendKeyVisible.value = false
  }
}

// Following Vue2 toggleFullscreen (:1120-1128): if already fullscreen exit, otherwise request
// fullscreen for hostEl, force show toolbar once on success. Both swallow rejections (user
// denying fullscreen permission scenarios don't need errors).
function toggleFullscreen(): void {
  const el = hostEl.value
  if (!el) return
  if (!document.fullscreenElement) {
    el.requestFullscreen()
      .then(() => { isFullscreen.value = true; sendKeyVisible.value = true })
      .catch(() => {})
  } else {
    document.exitFullscreen().catch(() => {})
  }
}

// Following Vue2 handleFullscreenChange (:1130-1133): sync isFullscreen, force show toolbar when
// entering fullscreen and VM is running (user might trigger via system-level gesture other than F11/Esc,
// not necessarily through toggleFullscreen above).
function handleFullscreenChange(): void {
  isFullscreen.value = !!document.fullscreenElement
  if (isFullscreen.value && s.selectedVM.value?.state === 'running') sendKeyVisible.value = true
}

onMounted(() => {
  void s.fetchVMs()
  void isoList.fetch()
  void hostInfo.fetch()
  document.addEventListener('fullscreenchange', handleFullscreenChange)
})
onUnmounted(() => {
  s.dispose()
  vnc.dispose()
  isoList.dispose()
  hostInfo.dispose()
  snaps.dispose()
  document.removeEventListener('fullscreenchange', handleFullscreenChange)
  clearTimeout(spiceTimer) // Task 8: independent onUnmounted in brief snippet, merged here to avoid hanging two.
})

function isProcessing(vm: KvmVM | null): boolean {
  return !!vm && s.processing.value.has(vm.id)
}

// Console placeholder area error to display: VNC connection error (useVncConsole) takes priority,
// fallback to power action's lastError if none (Task 5's "console inline display, no toast" convention,
// see ConsoleStage's error-key consumption below). Both sources can be "i18n key" or "already
// resolved original text", unified inside ConsoleStage via te()/t() judgment, here just manages
// priority concatenation.
const consoleErrorKey = computed(() => vnc.errorKey.value || s.lastError.value)

// ===================== Power action wiring =====================
// Following Vue2's confirmStopVM/confirmRestartVM/confirmDeleteVM (:1327-1359): after stop/restart/delete
// confirmations pass, display progress overlay first, await action, finally remove overlay; other
// actions (start/pause/resume/wakeup/autostart) don't display overlay, await directly.
//
// progress's title is a complete sentence (review verified exactly same as Vue2: progressTitle = $t('Stopping VM')
// → zh_CN.json = "正在停止虚拟机" = kvmStopping, not divergence).
// message is the previously omitted part: Vue2 = `${vm.name} ${$t('stopping')}...` (zh_CN.json
// "stopping"="停止中"), here added kvmStoppingShort/kvmRestartingShort/kvmDeletingShort three
// "verb present progressive" phrase keys, concatenated back to `${vm.name} ${t(shortKey)}...`,
// exactly aligned with Vue2, no longer an intentional phrasing divergence (previous report's "phrasing
// changed" claim was wrong, now corrected).
// toastKey (mandatory① new addition): "verb past tense" suffix used for toasting on success, phrasing
// exactly matches Vue2 `${vm.name} ${$t('stopped'/'restarted'/'deleted')}` (KVMFullPage.vue:1548/1564/1614).
const CONFIRM_ACTIONS: Record<
  string,
  { run: (vm: KvmVM) => Promise<boolean>; titleKey: string; shortKey: string; toastKey: string }
> = {
  stop: { run: (vm) => s.stop(vm), titleKey: 'kvmStopping', shortKey: 'kvmStoppingShort', toastKey: 'kvmToastStopped' },
  restart: { run: (vm) => s.restart(vm), titleKey: 'kvmRestarting', shortKey: 'kvmRestartingShort', toastKey: 'kvmToastRestarted' },
  delete: { run: (vm) => s.remove(vm), titleKey: 'kvmDeleting', shortKey: 'kvmDeletingShort', toastKey: 'kvmToastDeleted' },
}

const progress = ref<{ title: string; message: string } | null>(null)

// lastError rendering contract (review Important #1, Task 6 onwards moved inside ConsoleStage
// for unified handling): useVmList's errText() return value has two sources — (a) backend
// Error.message original text (meaningful troubleshooting info), (b) 8 i18n **key names** fallback
// when not Error value (e.g. 'kvmFailedToStart'). useVncConsole's errorKey same (either fixed i18n
// key, or equivalent original text in Vue2). Naked render would output (b)'s key names raw to user,
// so both sources unified to consoleErrorKey → te()/t() judgment inside ConsoleStage (same as
// VmListItem.vue handling unregistered state keys), don't need to double-judge here.
//
// Divergence from Vue2 (declared): Vue2 power action catch always shows fixed translation, never
// backend original text (KVMFullPage.vue :1537-1539 etc, each catch only $t one fixed text, e itself
// discarded). Here retain "backend message priority, fallback to fixed translation when missing" —
// based on project's existing convention (P1 established: dialog/inline errors prioritize backend
// message for troubleshooting value; Vue2 uniformly showing "operation failed" is information loss,
// not worth copying).

async function onAction(name: string): Promise<void> {
  const vm = s.selectedVM.value
  if (!vm) return
  // Mandatory①: save a name copy for toast in advance — after delete success vm is removed from list,
  // selectedVM also cleared, but `vm`/`vmName` are local variables captured by this call, unaffected
  // by those state changes.
  const vmName = vm.name

  const confirmed = CONFIRM_ACTIONS[name]
  if (confirmed) {
    progress.value = { title: t(confirmed.titleKey), message: `${vm.name} ${t(confirmed.shortKey)}...` }
    let ok = false
    try {
      ok = await confirmed.run(vm)
    } finally {
      progress.value = null
    }
    // Mandatory①: only toast on success — failure branch already has lastError for inline display
    // (see "rendering contract" in large comment above), Vue2 failure also uses its own error toast,
    // no need to duplicate here.
    if (ok) toast.show(`${vmName} ${t(confirmed.toastKey)}`)
    return
  }

  switch (name) {
    case 'start':
      if (await s.start(vm)) toast.show(`${vmName} ${t('kvmToastStarted')}`)
      break
    case 'pause':
      if (await s.pause(vm)) toast.show(`${vmName} ${t('kvmToastPaused')}`)
      break
    case 'resume':
      if (await s.resume(vm)) toast.show(`${vmName} ${t('kvmToastResumed')}`)
      break
    case 'wakeup':
      // Vue2 wakeupVM success also toasts 'resumed' (KVMFullPage.vue:1603), not separate "awakened"
      // text — verified against source code, not a typo copy (see kvmToastResumed comment in i18n slice).
      if (await s.wakeup(vm)) toast.show(`${vmName} ${t('kvmToastResumed')}`)
      break
    case 'autostart': {
      const ok = await s.toggleAutostart(vm)
      // After success vm.autostart is already the toggled new value (return value contract of
      // useVmList.toggleAutostart see that function's top comment), directly read it to decide On/Off
      // text, no need to save separate "value before toggle".
      if (ok) toast.show(`${vmName} ${t('kvmAutoStart')} ${t(vm.autostart ? 'kvmAutoStartOn' : 'kvmAutoStartOff')}`)
      break
    }
    case 'settings':
      // P6 Task 9: settings button unlock — not a power action (doesn't enter CONFIRM_ACTIONS, no
      // progress overlay, no "success" toast, the dialog's own save success toasts, see onSettingsSubmit).
      // Following Vue2 showSettings (:1208-1209): reset tab to general (VmSettingsDialog does this
      // internally in watch(open)), clear any leftover OS selection and errors from last time. **Do NOT**
      // **copy** showSettings (:1204-1206)'s "can only modify settings when VM stopped" dead code toast —
      // settings button itself already `:disabled="!canEditSettings"`, can't reach this branch (spec §1.15).
      settingsSelectedOs.value = null
      settingsError.value = ''
      // P6 Task 10: also clear any leftover snapshot creation error from last time — SnapshotsTab
      // instance is entirely unmounted and rebuilt by reka DialogContent each dialog open/close
      // (see that component's top comment), but `snapCreateError` itself lives at KvmPage layer,
      // persists across open/close, not clearing will expose last round's old error next time
      // opening settings dialog and switching to snapshots tab. Snapshot list itself (snaps.snapshots)
      // doesn't need clearing here — onSettingsTabChange will re-fetch and overwrite when clicking
      // snapshots tab, and before reset it's already hidden with v-show, won't expose stale content
      // (consistent with Vue2's behavior at same location).
      snapCreateError.value = ''
      vmSettingsOpen.value = true
      break
    default: break
  }
}
</script>

<template>
  <div class="kvm-page">
    <div class="kvm-content">
      <button
        class="kvm-sidebar-toggle"
        :class="{ collapsed }"
        :aria-label="t('kvmToggleSidebar')"
        @click="sidebarCollapsed = !sidebarCollapsed"
      >
        <!-- ‹ is monochrome text symbol placeholder (emoji forbidden) — Vue2 uses casa icon font's
             collapse svg icon, New-UI doesn't have that font set. Same batch of placeholder debt as
             ⚙/⋮ in ConsoleHeader.vue, ⊞ in SendKeyToolbar.vue, etc., wait for unified real icon
             replacement batch to collect (cleanup item 5, full-branch final review correction: previous
             "subsequent tasks T4/T8 replace icons" is outdated — T4/T8 completed long ago, never replaced). -->
        <span class="toggle-icon" aria-hidden="true">‹</span>
      </button>

      <VmSidebar
        :vms="s.vms.value"
        :selected-id="s.selectedVM.value?.id ?? null"
        :running-count="s.runningCount.value"
        :is-loading="s.isLoading.value"
        :collapsed="collapsed"
        @mouseenter="sidebarHover = true"
        @mouseleave="sidebarHover = false"
        @select="s.selectVM"
        @open-global-settings="globalSettingsOpen = true"
        @add-vm="openCreateDialog"
      />

      <main class="kvm-main">
        <div v-if="!s.selectedVM.value" class="main-empty">
          <div class="empty-icon-ring">
            <!-- ▭ is monochrome text symbol placeholder (emoji forbidden) — same batch of placeholder
                 debt as ‹ above, wait for unified real icon replacement batch to collect, not an omission
                 from this task. -->
            <span class="main-empty-icon" aria-hidden="true">▭</span>
          </div>
          <h3>{{ t('kvmSelectVmTitle') }}</h3>
          <p>{{ t('kvmSelectVmHint') }}</p>
        </div>

        <div v-else class="vm-console-container">
          <ConsoleHeader
            :vm="s.selectedVM.value"
            :processing="isProcessing(s.selectedVM.value)"
            @action="onAction"
          />

          <!-- Install banner is direct child of `.vm-console-container`, between console-header and
               ConsoleStage (console-display) — follows Vue2 template :142's DOM position. -->
          <InstallBanner
            v-if="showInstallBanner"
            :busy="ejectBusy"
            :error-key="ejectError"
            @finish="onEjectFinish"
          />

          <ConsoleStage
            ref="stageRef"
            :vm="s.selectedVM.value"
            :connected="vnc.connected.value"
            :error-key="consoleErrorKey"
            :processing="isProcessing(s.selectedVM.value)"
            @start="onAction('start')"
            @resume="onAction('resume')"
            @console-enter="onConsoleEnter"
            @console-leave="onConsoleLeave"
            @console-move="onConsoleMove"
          >
            <!-- SPICE info bar and SendKey toolbar likewise passed as ConsoleStage's slot content
                 (DOM hierarchy exactly matches Vue2 — both direct children of `.console-display`,
                 also the positioning base for `position:absolute`). ⚠️ Divergence from Vue2 (DOM order,
                 declared): in Vue2 spice-info-bar ranks **before** console-placeholder, here because
                 ConsoleStage internally renders console-placeholder first then `<slot />`, order is
                 reversed. No visual impact — both are position:absolute elements with explicit z-index
                 (spice-info-bar: 30, console-placeholder: 1), stacking order determined by z-index,
                 DOM order doesn't matter, see SpiceInfoBar component and `.spice-info-bar` section
                 comment in kvm.css. -->
            <transition name="spice-toast">
              <SpiceInfoBar
                v-if="showSpiceBar"
                :hostname="hostname"
                :spice-port="s.selectedVM.value?.spicePort ?? 0"
                :is-windows-guest="isWindowsGuestSelected"
                @close="spiceDismissed = true"
              />
            </transition>
            <transition name="sendkey-slide">
              <SendKeyToolbar
                v-if="showSendKeyToolbar"
                :modifiers="vnc.modifiers.value"
                :is-fullscreen="isFullscreen"
                @mouseenter="toolbarHover = true"
                @mouseleave="toolbarHover = false"
                @toggle="vnc.toggleModifier"
                @key="vnc.sendKey"
                @ctrl-alt-del="vnc.sendCtrlAltDel"
                @fullscreen="toggleFullscreen"
              />
            </transition>
          </ConsoleStage>
        </div>
      </main>
    </div>

    <ProgressOverlay v-if="progress" :title="progress.title" :message="progress.message" />

    <!-- @saved (true defect fix pointed out by review, P6 Task 8): KvmGlobalSettingsDialog itself
         holds independent useKvmHostInfo() instance (Task 2's isolation design, edit with local copy
         before save, cancel doesn't pollute shared state). This `hostInfo` is another independent
         instance, fed to CreateVmDialog's `:defaults` below — neither knows the other's existence,
         save success only updates the dialog's own copy, this one won't be re-fetched means create
         dialog's pre-filled default vCPU/memory stays at old values before save. Don't pass hostInfo
         as props into dialog (would break Task 2's already-reviewed local copy isolation boundary),
         instead let dialog emit once after save success, receive here and re-fetch own copy. -->
    <KvmGlobalSettingsDialog v-model:open="globalSettingsOpen" @saved="void hostInfo.fetch()" />

    <!-- P6 Task 8: create dialog + ISO selector. ⚠️ Both `:isos` must pass the same
         `isoList.isos.value` (see cross-task dependency comment in script section above), can't each
         open separate copy. OsSelector's z-base=920 layers above CreateVmDialog (default 900),
         consistent with Vue2 b-modal's stacking order. -->
    <CreateVmDialog
      v-model:open="createOpen"
      :host="hostInfo.host.value"
      :defaults="hostInfo.settings.value"
      :isos="isoList.isos.value"
      :selected-os="selectedOs"
      :creating="creating"
      :submit-error="createError"
      @open-os-selector="openOsSelectorFor('create')"
      @submit="onCreateSubmit"
    />

    <!-- P6 Task 9: VM settings dialog. `v-if="s.selectedVM.value"` not permanently mounted —
         `vm` prop is required KvmVM (doesn't accept null), and the gear button itself can only be clicked
         when a VM is selected (entire parent `.vm-console-container` of ConsoleHeader is under `v-else`
         branch, see `<div v-else class="vm-console-container">` above), criteria consistent, won't see
         "selectedVM empty but vmSettingsOpen is true" scenario. `:host` reuses page-level `hostInfo`
         (same copy as create dialog, not re-fetched). -->
    <VmSettingsDialog
      v-if="s.selectedVM.value"
      v-model:open="vmSettingsOpen"
      :vm="s.selectedVM.value"
      :host="hostInfo.host.value"
      :selected-os="settingsSelectedOs"
      :saving="settingsSaving"
      :submit-error="settingsError"
      :snapshots="snaps.snapshots.value"
      :snapshots-busy="snapCreating"
      :snapshot-submit-error="snapCreateError"
      @open-os-selector="openOsSelectorFor('settings')"
      @submit="onSettingsSubmit"
      @tab-change="onSettingsTabChange"
      @create-snapshot="onSnapshotCreate"
      @confirm-delete-snapshot="onSnapshotConfirmDelete"
      @confirm-restore-snapshot="onSnapshotConfirmRestore"
    />

    <OsSelector
      v-model:open="osSelectorOpen"
      :isos="isoList.isos.value"
      :download-error="isoDownloadError"
      v-model:browser-expanded="isoBrowserExpanded"
      @select="onOsSelect"
      @download="onOsDownload"
      @need-wait="toast.show(t('kvmWaitForDownload'))"
    />
  </div>
</template>
