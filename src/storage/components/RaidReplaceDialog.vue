<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Dialog from '../../components/ui/Dialog.vue'
import { fmtSize } from '../../home/util/format'
import { filterReplacementCandidates, type ReplaceTarget, type CandidateDiskLike } from '../util/raidReplace'

// Migrated from NimoOS-UI/src/components/Storage/raid/RaidReplaceDisk.vue (2026-08-11 serial-semantics version).
// Differences from the first version (which passed disks by path):
// - The faulty-disk display uses target.label (an in-place faulty disk shows the live path;
//   a pulled disk shows the serial — its cached path may already belong to a different physical
//   disk, so it must never be shown as identity); the request body's old_disk_path +
//   old_disk_serial are read from target by the parent view.
// - Candidate disks are filtered through filterReplacementCandidates (excludes the disk being
//   replaced by serial; a path collision does not clear the list).
// - When a candidate disk carries leftover RAID data (role: "residue"), its option gets a
//   warning flag; confirming inserts a second confirmation step naming the residual array and
//   its creation/last-active time, only emitting wipeResidue: true after that confirmation.
//   ⚠️ array_name/created_at/updated_at come from the disk's mdadm superblock and are untrusted
//   text — they must only be rendered via template interpolation ({{ }}), never concatenated into HTML.
// The store call is left to the parent view (StorageRaidDetail.vue); this component only emits confirm.
const props = defineProps<{
  open: boolean
  raidId: number | string
  target: ReplaceTarget | null
  disks: CandidateDiskLike[]
  busy?: boolean
}>()
const emit = defineEmits<{
  (e: 'update:open', v: boolean): void
  (e: 'confirm', payload: { newDiskPath: string; wipeResidue: boolean }): void
}>()
const { t } = useI18n()
const newDiskPath = ref('')
// Residue second-confirmation step: when true, the entire dialog body switches to the wipe confirmation
const residueConfirm = ref(false)

const candidates = computed(() => filterReplacementCandidates(props.disks, props.target))
const selectedResidue = computed(() => {
  const d = candidates.value.find((x) => x.path === newDiskPath.value)
  return d?.raid?.role === 'residue' ? d.raid : null
})

// Both opening and closing clear the selection and confirmation step: aligning with the same
// lesson from RaidDeleteDialog/FormatDialog — it must already be cleared even without a re-open,
// to avoid the next open carrying over the previous disk's selection or confirmation state.
watch(
  () => props.open,
  () => {
    newDiskPath.value = ''
    residueConfirm.value = false
  },
)

function onConfirm(): void {
  if (!newDiskPath.value) return
  if (selectedResidue.value) {
    // The selected disk carries a foreign array's residual superblock — spell out whose it is and
    // when before wiping, and only wipe after confirmation
    residueConfirm.value = true
    return
  }
  emit('confirm', { newDiskPath: newDiskPath.value, wipeResidue: false })
}
function onWipeConfirm(): void {
  emit('confirm', { newDiskPath: newDiskPath.value, wipeResidue: true })
}
</script>

<template>
  <Dialog :open="open" :title="residueConfirm ? t('raidResidue') : t('raidReplaceTitle')" @update:open="emit('update:open', $event)">
    <template v-if="!residueConfirm">
      <div class="rrd-field">
        <label class="rrd-label">{{ t('raidReplaceFaulty') }}</label>
        <input class="rrd-input" type="text" :value="target?.label ?? ''" disabled />
        <p class="rrd-hint">{{ t('raidReplaceRemoveHint') }}</p>
      </div>
      <div class="rrd-field">
        <label class="rrd-label">{{ t('raidReplaceNew') }}</label>
        <select v-model="newDiskPath" class="rrd-select">
          <option value="" disabled>{{ t('raidReplaceSelect') }}</option>
          <option v-for="disk in candidates" :key="disk.path" :value="disk.path">
            {{ disk.path }} — {{ fmtSize(disk.size) }}{{ disk.raid?.role === 'residue' ? ` — ⚠ ${t('raidResidue')}` : '' }}
          </option>
        </select>
        <p v-if="selectedResidue" class="rrd-residue-hint">
          ⚠ {{ t('raidResidueExplain', { name: selectedResidue.array_name }) }}
        </p>
      </div>
      <p class="rrd-warning">⚠️ {{ t('raidReplaceWarning') }}</p>
    </template>
    <template v-else>
      <p class="rrd-wipe-msg">
        {{ t('raidResidueWipeConfirm', {
          array: selectedResidue?.array_name || '?',
          created: selectedResidue?.created_at || '—',
          updated: selectedResidue?.updated_at || '—',
        }) }}
      </p>
    </template>
    <template #footer>
      <template v-if="!residueConfirm">
        <button class="rrd-cancel" type="button" :disabled="busy" @click="emit('update:open', false)">
          {{ t('storageCancel') }}
        </button>
        <button class="rrd-ok danger" type="button" :disabled="!newDiskPath || busy" @click="onConfirm">
          {{ t('raidReplace') }}
        </button>
      </template>
      <template v-else>
        <button class="rrd-cancel" type="button" :disabled="busy" @click="residueConfirm = false">
          {{ t('storageCancel') }}
        </button>
        <button class="rrd-wipe danger" type="button" :disabled="busy" @click="onWipeConfirm">
          {{ t('raidResidueWipeOk') }}
        </button>
      </template>
    </template>
  </Dialog>
</template>

<style scoped>
.rrd-field { margin-bottom: 12px; }
.rrd-label { display: block; font-size: 12px; color: var(--fg-muted); margin-bottom: 4px; }
.rrd-input {
  width: 100%; box-sizing: border-box; padding: 9px 12px; font-size: 14px;
  border-radius: 10px; border: 1px solid var(--chip-border);
  background: var(--chip-bg); color: var(--fg-muted); outline: none;
}
.rrd-select {
  width: 100%; box-sizing: border-box; padding: 9px 12px; font-size: 14px;
  border-radius: 10px; border: 1px solid var(--chip-border);
  background: var(--chip-bg); color: var(--fg); outline: none;
}
.rrd-select:focus { border-color: var(--accent); }
/* The rule above sets background to var(--chip-bg) — under the dark theme this is a
 * **translucent, light-toned gradient**. The moment the author gives <select> an explicit
 * background, Chrome carries it over onto the popup list, but native <option> elements
 * **don't render the gradient** (they fall back to the browser's default light background),
 * and paired with a near-neutral --fg that renders as invisible low-contrast text on that light
 * background. The root's color-scheme: dark can't rescue this (the author-specified background
 * wins). So this pins an explicit solid background and foreground color here. Guarded by:
 * styles/selectPopup.test.ts. */
.rrd-select option,
.rrd-select optgroup {
  background-color: var(--set-option-bg);
  color: var(--set-option-fg);
}
.rrd-hint { margin: 4px 0 0; font-size: 12px; color: var(--remove-fg); }
.rrd-residue-hint { margin: 6px 0 0; font-size: 12px; color: var(--dem-fg); }
.rrd-warning { margin: 0 0 12px; font-size: 12px; color: var(--dem-fg); }
.rrd-wipe-msg { margin: 0 0 12px; font-size: 13px; line-height: 1.6; color: var(--fg); max-width: 420px; }
.rrd-cancel, .rrd-ok, .rrd-wipe {
  padding: 7px 16px; border-radius: 999px; border: 1px solid var(--chip-border);
  background: var(--chip-bg); color: var(--fg); cursor: pointer; font-size: 13px;
}
.rrd-cancel:disabled, .rrd-ok:disabled, .rrd-wipe:disabled { opacity: 0.45; cursor: not-allowed; }
.rrd-ok.danger, .rrd-wipe.danger { color: var(--remove-fg); border-color: var(--remove-fg); }
</style>
