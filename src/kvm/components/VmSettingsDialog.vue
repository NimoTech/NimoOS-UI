<script setup lang="ts">
// VM settings dialog: two tabs (general/snapshots). This component implements the "general" half + tab shell.
// Visual 1:1 mapping to Vue2 KVMFullPage.vue template :230-393 (head+tabs :231-252 / General section :255-325 /
// footer :387-391), logic maps to showSettings(:1202-1221)/saveSettings(:1494-1514)/onOSSelect settings branch(:1378-1381).
//
// Task 10: the snapshots tab's real implementation is the **default content** of the `snapshots` named slot
// (SnapshotsTab component), not injected from the parent — this component never holds a useSnapshots instance
// (that data layer, like isoList/hostInfo, is created by KvmPage and lives with the page lifecycle), so we
// directly relay SnapshotsTab's five props/three emits unchanged (snapshots/snapshotsBusy/snapshotSubmitError three
// new props + vmId/vmState derived directly from props.vm, no need to pass separately). We leave a named slot
// rather than hardcoding to avoid breaking the "slot mechanism itself" test coverage already established in Task 9
// (see template comment below).
//
// Form editing uses a local copy (form, reactive), not direct binding to props.vm fields — same reasoning as
// CreateVmDialog / KvmGlobalSettingsDialog: Global Constraint #16 **does apply** here (different from Task 7's
// create dialog): the form is backfilled from props.vm, and after useVmList.update succeeds, the result is written
// back to the **selected VM object** (mirrors Vue2 saveSettings :1503-1508). If the form directly two-way-binds
// props.vm fields and the user changes a value then clicks ✕ cancel, the dirty value directly pollutes the shared
// VM object (unlike KvmGlobalSettingsDialog which pollutes a composable-internal ref; here it pollutes the same
// object reference held by the caller, more direct pollution). See Global Constraint #16 test case in the test file
// at the bottom + mutation verification.
import { reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { KvmVM, KvmUpdateVMRequest } from '@nimotech/nimoos-service'
import KvmDialog from './KvmDialog.vue'
import SnapshotsTab from './SnapshotsTab.vue'
import type { SelectedOs } from './OsSelector.vue'
import type { KvmHostReadonly } from '../composables/useKvmHostInfo'
import { formatHostMem } from '../util/format'
import type { KvmSnapshot } from '@nimotech/nimoos-service'

const props = defineProps<{
  open: boolean
  vm: KvmVM
  host: KvmHostReadonly
  selectedOs: SelectedOs | null
  saving: boolean
  submitError: string
  // P6 Task 10: four snapshot-tab dependencies, relayed unchanged to SnapshotsTab — this component
  // doesn't hold snapshot data layer (useSnapshots is created by KvmPage and lives with page lifecycle, same
  // convention as isoList/hostInfo).
  snapshots: KvmSnapshot[]
  snapshotsBusy: boolean
  snapshotSubmitError: string
}>()

const emit = defineEmits<{
  'update:open': [v: boolean]
  'open-os-selector': []
  submit: [patch: KvmUpdateVMRequest]
  'tab-change': [tab: 'general' | 'snapshots']
  'create-snapshot': [payload: { name: string; description: string }]
  'confirm-delete-snapshot': [s: KvmSnapshot]
  'confirm-restore-snapshot': [s: KvmSnapshot]
}>()

const { t } = useI18n()

const activeTab = ref<'general' | 'snapshots'>('general')

function selectTab(tab: 'general' | 'snapshots'): void {
  activeTab.value = tab
  emit('tab-change', tab)
}

// Local form copy. Field set matches Vue2 settingsForm(:629-639), but **excludes** diskUsedPercent —
// it's a display-only value (disk usage percentage), not an editable/submittable field. We read props.vm.diskUsedPercent
// directly for display; no need to include it in the local copy (read-only, no Global Constraint #16 pollution risk).
const form = reactive({
  name: '',
  vcpu: 0,
  memory: 0,
  disk: 0,
  iso: '',
  bootFromDisk: false,
  firmware: 'bios',
  networkMode: 'nat',
})

// Backfill form from props.vm when dialog opens. Mirrors Vue2 showSettings(:1208-1216): reset tab to general,
// networkMode mapping per :1215 (`vm.networkMode === 'bridge' ? (vm.networkInterface || 'nat') : 'nat'`).
// immediate:true ensures "mount with open=true already" scenarios (as in tests) also run backfill once.
watch(() => props.open, (isOpen) => {
  if (!isOpen) return
  activeTab.value = 'general'
  const vm = props.vm
  form.name = vm.name
  form.vcpu = vm.vcpu
  form.memory = vm.memory
  form.disk = vm.disk
  form.iso = vm.iso || ''
  form.bootFromDisk = vm.bootFromDisk || false
  form.firmware = vm.firmware || 'bios'
  form.networkMode = vm.networkMode === 'bridge' ? (vm.networkInterface || 'nat') : 'nat'
}, { immediate: true })

// Linked update after OS selection. Mirrors Vue2 onOSSelect settings branch (:1378-1381 / :1424-1427; both
// isLocal/official-template branches have identical logic, merged into one rule): `settingsOS = os;
// settingsForm.iso = os.path; settingsForm.bootFromDisk = false` — this component doesn't need to hold
// settingsOS separately (Vue2 uses it only to reference the selected object outside saveSettings; here no
// other consumers). immediate:true + declaration order with open-watch ensures: if both need to run in the
// same tick, the more specific intent "selected new OS" wins (same pattern as CreateVmDialog).
watch(() => props.selectedOs, (os) => {
  if (!os) return
  form.iso = os.path
  form.bootFromDisk = false
}, { immediate: true })

function onSubmit(): void {
  // Duplicate-submit prevention (same pattern as CreateVmDialog onSubmit): native `disabled` already blocks
  // real clicks, this adds a JS-layer safeguard. Review mutation verification in task report (uses dispatchEvent
  // to bypass native disabled).
  if (props.saving) return

  // Mirrors Vue2 saveSettings(:1497-1508): networkMode folding + 8 writable fields. **Does not** copy the
  // `...this.settingsForm` spread syntax — that would smuggle diskUsedPercent into the request body, which the
  // backend model.CreateVMRequest doesn't have. It silently drops it with no real impact, but explicit enumeration
  // here clarifies the payload contract and doesn't rely on implicit "backend will discard" guarantees. **Excludes**
  // os/osType — backend UpdateVM (NimoOS-KVM/route/v2/vms.go:78-101) reuses CreateVMRequest but doesn't backfill
  // OSType; saving VM settings doesn't change OS type, and Vue2 settingsForm never had these two fields anyway.
  const isBridge = form.networkMode !== 'nat'
  const patch: KvmUpdateVMRequest = {
    name: form.name,
    vcpu: form.vcpu,
    memory: form.memory,
    disk: form.disk,
    iso: form.iso,
    bootFromDisk: form.bootFromDisk,
    firmware: form.firmware,
    networkMode: isBridge ? 'bridge' : 'nat',
    networkInterface: isBridge ? form.networkMode : '',
  }
  emit('submit', patch)
}
</script>

<template>
  <KvmDialog
    :open="props.open"
    :title="`${t('kvmVmSettingsTitle')} - ${props.vm.name}`"
    width="600px"
    @update:open="emit('update:open', $event)"
  >
    <template #tabs>
      <div class="settings-tabs">
        <button
          type="button"
          class="settings-tab"
          :class="{ active: activeTab === 'general' }"
          @click="selectTab('general')"
        >{{ t('kvmTabGeneral') }}</button>
        <button
          type="button"
          class="settings-tab"
          :class="{ active: activeTab === 'snapshots' }"
          @click="selectTab('snapshots')"
        >{{ t('kvmTabSnapshots') }}</button>
      </div>
    </template>

    <div v-show="activeTab === 'general'">
      <div class="cv-field">
        <label class="cv-label">{{ t('kvmVmName') }}</label>
        <input v-model="form.name" type="text" name="name" class="cv-input" />
      </div>

      <div class="cv-field">
        <label class="cv-label">{{ t('kvmDiskSize') }}</label>
        <span class="cv-hint">{{ Math.round(props.vm.diskUsedPercent || 0) }}% {{ t('kvmUsed') }}</span>
        <div class="cv-input-row cv-input-unit">
          <input :value="form.disk" type="number" name="disk" class="cv-input" disabled />
          <span class="cv-unit">GB</span>
        </div>
      </div>

      <div class="cv-field">
        <label class="cv-label">{{ t('kvmIsoImage') }}</label>
        <div class="cv-input-row">
          <button type="button" class="cv-iso-btn" @click="emit('open-os-selector')">
            <span v-if="form.iso">{{ form.iso }}</span>
            <span v-else class="cv-placeholder">{{ t('kvmNoIsoMounted') }}</span>
            <span aria-hidden="true">▾</span>
          </button>
          <!-- Dual-state button (mirrors Vue2 :276-281): when not booting from disk, show "eject" (click switches
               to disk boot, clears iso); when already booted from disk, show "mount" (click reopens OS selector). -->
          <button
            v-if="!form.bootFromDisk"
            type="button"
            class="cv-iso-eject"
            :aria-label="t('kvmEjectIso')"
            @click="form.bootFromDisk = true; form.iso = ''"
          >
            <span aria-hidden="true">⏏</span>
          </button>
          <button
            v-else
            type="button"
            class="cv-iso-eject"
            :aria-label="t('kvmMountIso')"
            @click="emit('open-os-selector')"
          >
            <span aria-hidden="true">▾</span>
          </button>
        </div>
      </div>

      <div class="cv-field">
        <label class="cv-label">{{ t('kvmCpuCores') }}</label>
        <div class="cv-cpu-group">
          <button
            v-for="n in props.host.cpuCores"
            :key="n"
            type="button"
            class="cv-cpu-btn"
            :class="{ active: n <= form.vcpu }"
            @click="form.vcpu = n"
          >{{ n }}</button>
        </div>
      </div>

      <div class="cv-field">
        <label class="cv-label">{{ t('kvmMemory') }}</label>
        <span class="cv-hint">{{ t('kvmMax') }}: {{ formatHostMem(props.host.availableMemoryMB) }}</span>
        <div class="cv-input-row cv-input-unit">
          <input
            v-model.number="form.memory"
            type="number"
            name="memory"
            min="256"
            :max="props.host.availableMemoryMB || undefined"
            step="256"
            class="cv-input"
          />
          <span class="cv-unit">MB</span>
        </div>
      </div>

      <div class="cv-field">
        <label class="cv-label">{{ t('kvmNetwork') }}</label>
        <div class="cv-select">
          <select v-model="form.networkMode" name="networkMode" class="cv-select-native">
            <option value="nat">NAT</option>
            <option v-for="iface in props.host.networkInterfaces" :key="iface" :value="iface">
              {{ t('kvmBridgeTo') }} {{ iface }}
            </option>
          </select>
          <span class="cv-select-arrow" aria-hidden="true">▾</span>
        </div>
      </div>

      <div class="cv-field">
        <label class="cv-label">{{ t('kvmFirmware') }}</label>
        <div class="cv-firmware-group">
          <button type="button" class="cv-firmware-btn" :class="{ active: form.firmware === 'uefi' }" disabled>UEFI</button>
          <button type="button" class="cv-firmware-btn" :class="{ active: form.firmware === 'bios' }" disabled>BIOS</button>
        </div>
      </div>

      <p v-if="props.submitError" class="cv-error">{{ props.submitError }}</p>
    </div>

    <div v-show="activeTab === 'snapshots'" class="snapshots-body">
      <!-- Task 10: the named slot's default content IS the real SnapshotsTab — production (KvmPage.vue)
           doesn't override this slot, uses this default content directly. VmSettingsDialog.test.ts
           override point 2 (pre-existing 2026-08-02, Task 9 residual) explicitly passes
           `slots: { snapshots: '<div class="probe-snapshots">…' }` to override the default,
           verifying "slot plumbing works", not depending on real SnapshotsTab — both tests don't conflict,
           separately verify "slot conduit passes" vs "default content is correct". -->
      <slot name="snapshots">
        <SnapshotsTab
          :vm-id="props.vm.id"
          :vm-state="props.vm.state"
          :snapshots="props.snapshots"
          :busy="props.snapshotsBusy"
          :submit-error="props.snapshotSubmitError"
          @create="emit('create-snapshot', $event)"
          @confirm-delete="emit('confirm-delete-snapshot', $event)"
          @confirm-restore="emit('confirm-restore-snapshot', $event)"
        />
      </slot>
    </div>

    <!-- Footer shows only in general tab (mirrors Vue2 :387) — uses v-if on the named <template> so
         when `slots.footer` is not provided in KvmDialog, the entire footer container (including padding)
         disappears, not just hiding the button (hiding only button would leave blank footer space under snapshots tab). -->
    <template v-if="activeTab === 'general'" #footer>
      <button
        type="button"
        class="cv-primary-btn"
        :class="{ 'is-loading': props.saving }"
        :disabled="props.saving"
        @click="onSubmit"
      >
        {{ t('kvmSave') }}
      </button>
    </template>
  </KvmDialog>
</template>
