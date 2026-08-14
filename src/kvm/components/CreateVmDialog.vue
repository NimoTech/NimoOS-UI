<script setup lang="ts">
// Create VM dialog. Visual 1:1 map to Vue2 KVMFullPage.vue template :396-494, logic maps to
// showCreateVM(:1155-1190)/onOSSelect assignment section(:1376-1447)/osTemplate watch
// (:720-746)/createVM(:1450-1492).
//
// Form state (8 fields + internal osTemplate) entirely within this component, does not receive/write back
// any shared objects — `host`/`defaults`/`isos`/`selectedOs` all read-only consumed (numbers/strings
// copied by value into form, selectedOs only read its fields, never write `props.selectedOs.xxx = ...`).
// Global Constraint #16 does NOT apply to this component: no shared objects to pollute, see "Constraint #16
// self-check" comment at component bottom.
//
// Three declared "correct deviation" deviations (hard constraint 2, task brief requires itemization):
// 1) submit payload does not carry `osTemplate` (pure frontend linkage concept) or `autostart` — backend
//    model.CreateVMRequest (NimoOS-KVM/model/vm.go:39-51) only recognizes 11 fields, lacks these two;
//    Vue2 uses `{...vm}` to send both, backend silently discards them; "inherit global autostart" never worked.
// 2) Default values read directly from props.host/props.defaults, no additional getSettings call in this
//    component — page-level useKvmHostInfo() already has one (Task 2), duplicate request is waste.
// 3) When `host.cpuCores === 0` (GET /settings not back yet), no CPU grids rendered — this is the natural
//    result of `v-for="n in props.host.cpuCores"` with n=0, no extra branch needed; prerequisite: Task 2
//    changed host initial values to all 0 (not Vue2's hardcoded 16 dummy), spec §12 #6.
import { reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { KvmISO, KvmCreateVMRequest } from '@nimotech/nimoos-service'
import KvmDialog from './KvmDialog.vue'
import type { SelectedOs } from './OsSelector.vue'
import type { KvmHostReadonly, KvmWritableSettings } from '../composables/useKvmHostInfo'
import type { IsoRow } from '../composables/useIsoList'
import { validateCreateVm, type CreateVmForm } from '../util/createVmValidate'
import { osTemplateDefaults, matchTemplateByFamily } from '../util/isoMatch'
import { formatHostMem } from '../util/format'

const props = defineProps<{
  open: boolean
  host: KvmHostReadonly
  defaults: KvmWritableSettings
  isos: IsoRow[]
  selectedOs: SelectedOs | null
  creating: boolean
  submitError: string
}>()

const emit = defineEmits<{
  'update:open': [v: boolean]
  'open-os-selector': []
  submit: [payload: KvmCreateVMRequest]
}>()

const { t } = useI18n()

// `osTemplate` is this component's internal linkage driver value (per Vue2 newVM.osTemplate), not in payload.
const form = reactive<CreateVmForm & { osTemplate: string }>({
  name: '',
  vcpu: props.defaults.defaultVcpu || 2,
  memory: props.defaults.defaultMemory || 2048,
  disk: props.host.defaultDiskSize || 32,
  iso: '',
  os: '',
  osType: '',
  networkMode: 'nat',
  firmware: 'bios',
  osTemplate: 'generic-linux',
})

// ''=no inline error; non-empty=validation failure message or fallback from backend submitError (hard constraint 7, no toast inside dialog).
const localError = ref('')

// Reset form when dialog opens. Per Vue2 showCreateVM(:1155-1169), but default values read directly from
// props (correct deviation #2, declared at component head), not pulling getSettings again here. immediate:true
// lets "mount directly with open=true" scenario (test case) also go through reset.
watch(() => props.open, (isOpen) => {
  if (!isOpen) return
  form.name = ''
  form.vcpu = props.defaults.defaultVcpu || 2
  form.memory = props.defaults.defaultMemory || 2048
  form.disk = props.host.defaultDiskSize || 32
  form.iso = ''
  form.os = ''
  form.osType = ''
  form.networkMode = 'nat'
  form.firmware = 'bios'
  form.osTemplate = 'generic-linux'
  localError.value = ''
}, { immediate: true })

// Linkage after OS selection. Per Vue2 onOSSelect assignment section(:1376-1447), two branches (isLocal /
// official template) merged in brief into one unified rule — **do not set autostart** (correct deviation #1, declared).
watch(() => props.selectedOs, (os) => {
  if (!os) return
  form.iso = os.path
  form.os = os.isLocal ? os.name.replace(/\.iso$/i, '') : os.name

  // Determine osTemplate: if id matches (not 'local') use it; otherwise match template by filename; if still
  // no match, fall back to one of two generic templates based on 'win' in filename. Final values for osType/
  // firmware/os passed to watch(osTemplate) below, using Task 3's osTemplateDefaults for unified derivation;
  // this only determines osTemplate.
  //
  // Full-branch review fix (B1, declared): originally called `matchTemplateByFilename` (strict version, same
  // pure function IsoBrowser already used once) — but reaching this else branch means `os.id` is necessarily
  // `'local'` (IsoBrowser.vue onItemClick contract: match gives real template id, mismatch falls to 'local');
  // running the same deterministic function on the same filename necessarily returns null again, provably dead code.
  // Vue2 KVMFullPage.vue:1392-1403 at this position actually runs a looser "family prefix" matcher
  // (`t.id.split('-')[0]`, like 'ubuntu'/'debian'/'alpine', extra version check for win*) — previously only
  // ported strict version, this loose fallback layer was dropped entirely, undeclared capability loss (see full
  // comparison comment in matchTemplateByFamily in isoMatch.ts). Now swap to it, restore Vue2's recognition of
  // real filenames like "filename with family prefix but no complete id" (e.g. alpine-standard-3.19.1-x86_64.iso).
  if (os.id && os.id !== 'local') {
    form.osTemplate = os.id
  } else {
    const match = matchTemplateByFamily(os.name, props.isos)
    form.osTemplate = match ? match.id : (os.name.toLowerCase().includes('win') ? 'generic-windows' : 'generic-linux')
  }

  // Override vcpu/memory if recommended values exist (per Vue2 :1440-1441, read recommended values directly
  // from os itself, don't wait for osTemplate linkage — safety net if os.id can't be found in current isos list).
  if (os.recommendedVcpu) form.vcpu = os.recommendedVcpu
  if (os.recommendedMemory) form.memory = os.recommendedMemory
  // Full-branch review correction (B2, declared, original comment "per Vue2 :1442" inaccurate): Vue2 :1436-1443 is
  // `if (os.id) { this.newVM.osTemplate = os.id } else { ...this disk formula... }` — disk formula sentence
  // hangs in `else` (i.e. `!os.id`) branch in Vue2. Real device `GET /v1/kvm/isos` returns every row with `id`
  // (verified 2026-08-03 curl), so this else branch **never executes** in reachable paths; selecting any OS in
  // Vue2 never changes `disk`, input stays at dialog-open default (`host.defaultDiskSize`, 20 or 32). New-UI
  // here does not replicate the `if (os.id) {...} else {...}` branching — above already handles osTemplate
  // with osTemplate branch; this disk formula runs on **every selection** (official templates always have
  // `os.minDisk` defined, condition always true). **Not a copy failure, intentional new behavior, not a bug**:
  // new behavior more accurate — e.g. selecting `alpine-319` (minDisk=2) prefills 20GB (`Math.max(2*3,20)`),
  // while Vue2 on Windows template with minDisk=40 prefills 32GB (defaultDiskSize), then violates form's own
  // `:min="minDisk"` validation (32 < 40). Keep status quo, only relabel this comment from "mismarked as copy"
  // to formal deviation declaration.
  if (os.minDisk !== undefined) form.disk = Math.max((os.minDisk || 8) * 3, 20)
}, { immediate: true })

// osTemplate linkage. Verbatim from Vue2 watch('newVM.osTemplate')(:720-746), computed using Task 3's
// osTemplateDefaults — **correct fix**: Vue2 original "template not found" case watch is empty no-op (:731
// `if (tmpl) {...}` no else branch), but osTemplateDefaults as pure function must have definite return value,
// cannot really do nothing; can only add back at call site this layer "not found, skip" check — otherwise overwrites
// os/firmware just set by watch(selectedOs) above with fallback 'Linux'/'bios', losing already more precise
// information. This check makes explicit the no-op hidden in Vue2's if.
watch(() => form.osTemplate, (val) => {
  if (!val) return
  const isGeneric = val === 'generic-linux' || val === 'generic-windows'
  const tmpl = props.isos.find((t) => t.id === val)
  if (!isGeneric && !tmpl) return
  const d = osTemplateDefaults(val, props.isos)
  form.osType = d.osType
  form.firmware = d.firmware
  form.os = d.os
  if (d.vcpu) form.vcpu = d.vcpu
  if (d.memory) form.memory = d.memory
  // Per Vue2 :741-743, `!this.newVM.disk` condition basically always false after reset (disk always has value) —
  // kept for verbatim alignment, not dead code hardcoded: disk===0 edge case theoretically still reaches here.
  if (d.minDisk && !form.disk) form.disk = Math.max(form.disk || 0, d.minDisk)
}, { immediate: true })

// validateCreateVm (Task 3) wants KvmISO shape, but here only SelectedOs (field subset, some optional).
// Read only two actually-used fields (minDisk/minMemory) plus one null-check layer; other fields (version/
// category/size/status/progress) filled as placeholders — validateCreateVm does not read them internally,
// purely to satisfy parameter type, not fake data sent to backend (payload constructed separately, see buildPayload).
function toValidateOs(os: SelectedOs | null): KvmISO | null {
  if (!os) return null
  return {
    id: os.id,
    name: os.name,
    version: '',
    category: '',
    size: '',
    status: '',
    progress: 0,
    path: os.path,
    recommendedVcpu: os.recommendedVcpu ?? 0,
    recommendedMemory: os.recommendedMemory ?? 0,
    minMemory: os.minMemory ?? 0,
    minDisk: os.minDisk ?? 0,
  }
}

function onSubmit(): void {
  // Prevent duplicate submit: clicking while create request in flight has no effect (hard constraint, test case 12).
  // Native `disabled` attribute (see template) already blocks real mouse clicks in browser; add JS-level guard here —
  // if future changes miss `:disabled` or call onSubmit from elsewhere, this still catches it.
  // Review mutation-tested: deleting this line, test case (using dispatchEvent to bypass native disabled) fails exactly,
  // proves this line is not dead code, see task report.
  if (props.creating) return

  const formForValidate: CreateVmForm = {
    name: form.name, vcpu: form.vcpu, memory: form.memory, disk: form.disk,
    iso: form.iso, os: form.os, osType: form.osType,
    networkMode: form.networkMode, firmware: form.firmware,
  }
  const err = validateCreateVm(formForValidate, toValidateOs(props.selectedOs), props.host)
  if (err) {
    // Dialog inline error, no toast (hard constraint 7: toast z-index 60 blocked by dialog mask 900+blur).
    localError.value = t(err.key) + (err.arg ? ` ${err.arg}` : '')
    return
  }
  localError.value = ''

  // Per Vue2 createVM(:1475-1480): networkMode 'nat' is nat, all others (NIC name strings)
  // count as bridge, NIC name itself fills into networkInterface.
  const isBridge = form.networkMode !== 'nat'
  const payload: KvmCreateVMRequest = {
    name: form.name,
    vcpu: form.vcpu,
    memory: form.memory,
    disk: form.disk,
    iso: form.iso,
    os: form.os,
    osType: form.osType || 'linux',
    networkMode: isBridge ? 'bridge' : 'nat',
    networkInterface: isBridge ? form.networkMode : '',
    firmware: form.firmware,
    // Intentionally not sending osTemplate / autostart / bootFromDisk — see component head deviation log #1
    // (bootFromDisk is optional, backend defaults to false, not sending equals sending false).
  }
  emit('submit', payload)
}
</script>

<template>
  <KvmDialog :open="props.open" :title="t('kvmCreateTitle')" @update:open="emit('update:open', $event)">
    <div class="cv-field">
      <label class="cv-label">{{ t('kvmVmName') }}</label>
      <input v-model="form.name" type="text" name="name" :placeholder="t('kvmVmNamePlaceholder')" class="cv-input" />
    </div>

    <div class="cv-field">
      <label class="cv-label">{{ t('kvmIsoImage') }}</label>
      <div class="cv-input-row">
        <!-- name attribute is not from Vue2 (it uses b-input component with no bare name) — pure test hook,
             same as other inputs, convenient for vue-test-utils precise selection. -->
        <button type="button" class="cv-iso-btn" @click="emit('open-os-selector')">
          <span v-if="props.selectedOs">{{ props.selectedOs.path }}</span>
          <span v-else class="cv-placeholder">{{ t('kvmSelectIsoPlaceholder') }}</span>
          <span aria-hidden="true">▾</span>
        </button>
      </div>
    </div>

    <div class="cv-field">
      <label class="cv-label">{{ t('kvmDiskSize') }}</label>
      <span class="cv-hint">{{ t('kvmMax') }}: {{ props.host.availableDiskGB }} GB</span>
      <div class="cv-input-row cv-input-unit">
        <input
          v-model.number="form.disk"
          type="number"
          name="disk"
          :min="props.selectedOs?.minDisk || 8"
          :max="props.host.availableDiskGB || undefined"
          class="cv-input"
        />
        <span class="cv-unit">GB</span>
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
          :min="props.selectedOs?.minMemory || 256"
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
        <button
          type="button"
          class="cv-firmware-btn"
          :class="{ active: form.firmware === 'uefi' }"
          @click="form.firmware = 'uefi'"
        >UEFI</button>
        <button
          type="button"
          class="cv-firmware-btn"
          :class="{ active: form.firmware === 'bios' }"
          @click="form.firmware = 'bios'"
        >BIOS</button>
      </div>
    </div>

    <div v-if="props.selectedOs?.isLocal" class="cv-field">
      <label class="cv-label">{{ t('kvmOsVersion') }}</label>
      <div class="cv-select">
        <select v-model="form.osTemplate" name="osTemplate" class="cv-select-native">
          <option value="generic-linux">{{ t('kvmGenericLinux') }}</option>
          <option value="generic-windows">{{ t('kvmGenericWindows') }}</option>
          <option v-for="tmpl in props.isos" :key="tmpl.id" :value="tmpl.id">{{ tmpl.name }}</option>
        </select>
        <span class="cv-select-arrow" aria-hidden="true">▾</span>
      </div>
    </div>

    <p v-if="localError || props.submitError" class="cv-error">{{ localError || props.submitError }}</p>

    <template #footer>
      <button
        type="button"
        class="cv-primary-btn"
        :class="{ 'is-loading': props.creating }"
        :disabled="props.creating"
        @click="onSubmit"
      >
        {{ t('kvmCreate') }}
      </button>
    </template>
  </KvmDialog>
</template>
