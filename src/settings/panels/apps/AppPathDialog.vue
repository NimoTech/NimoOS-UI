<script setup lang="ts">
// Settings · Apps — the migration dialog for changing the data storage location. Ports Vue2 components/settings/AppPathModal.vue (951 lines).
// 6 steps: select (pick partition) → browse (pick directory) → confirm (confirm) → migrating (progress) → done | error.
//
// ⛔ Destructive: POST /v1/sys/migrate stops docker + all containers, rsyncs data, swaps the anchor symlink,
//    and **deletes the old data** (NimoOS/service/migrate.go:454/597/777-820). Never actually run for real on the dev machine —
//    and this machine only has one partition, so availableVolumes is always empty and the UI can never get past select. Debt D22.
//
// Porting discipline (on record):
//  ① Don't write to localStorage (Vue2 writes app_data_path / app_images_path / user_database_path
//     on done — three keys with no readers anywhere in the repo → New-UI neither reads nor writes them, same criterion as Task 2 appPaths.ts's ①).
//  ② **Polling failure is not silent**: Vue2's pollStatus catch only does console.error, so if the job is lost (observed to return
//     HTTP 400 {"success":4000,"message":"job not found"}) it polls forever. Here, after MAX_POLL_FAILS consecutive
//     failures we stop the timer + move to the error step + show the backend's raw message (see the catch in poll()).
// Vue2 shape copied verbatim (don't "optimize"): polls every 200ms; the migrating step has no close button — and it's not just the button hidden,
//   onDialogUpdateOpen also blocks close requests coming from Esc/overlay clicks, to prevent the user from actually closing the dialog mid-migration
//   (Vue2 just didn't render the button; whether the overlay/Esc could still close it was never verified — here we simply block both, so the dialog
//   can't be closed halfway while the migration is still running on the backend and the state drifts out of sync with the UI).
//
// Errors inside the dialog are always shown inline via .set-danger, never via toast (toast z-index 60 gets smothered by the dialog overlay 1000 + frosted glass,
// same as NetworkIfaceConfigDialog's porting discipline #8). No toast on successful delete either (same pitfall, so we simply
// skip it: silently refresh the list — the folder disappearing is already visible).
import { ref, computed, nextTick, onUnmounted, watch, type ComponentPublicInstance } from 'vue'
import { useI18n } from 'vue-i18n'
import { service, type FolderEntry, type MigrateStatus } from '@nimotech/nimoos-service'
import { ContextMenuItem, ContextMenuSeparator } from 'reka-ui'
import Dialog from '../../../components/ui/Dialog.vue'
import AlertDialog from '../../../components/ui/AlertDialog.vue'
import ContextMenu from '../../../components/ui/ContextMenu.vue'
import { renderSize } from '../../../files/util/format'
import type { StorageVolume } from '../../../storage/util/storageMap'
import { volumeForPath, type AppPathKey } from '../../util/appPaths'
import {
  browseRootPath, browseDestPaths, browseCrumbs, filterBrowseFolders, parentPath,
  isProtectedFolder,
} from '../../util/migrateBrowse'
import '../../styles/settings.css'

defineOptions({ name: 'AppPathDialog' })
const props = defineProps<{
  open: boolean
  type: AppPathKey
  currentPath: string
  requiredSpace: number
  volumes: StorageVolume[]
  displayNames: Record<string, string>
}>()
const emit = defineEmits<{ 'update:open': [boolean]; finish: [] }>()
const { t } = useI18n()

const POLL_MS = 200
const MAX_POLL_FAILS = 5

type Step = 'select' | 'browse' | 'confirm' | 'migrating' | 'done' | 'error'

// ── Partition selection ──────────────────────────────────────────────────────────────
const step = ref<Step>('select')
const selectedKey = ref<string | null>(null)

/** uuid takes priority; devices without a uuid, like md RAID, fall back to the mount point (ports Vue2 partKey :470). */
function partKey(v: StorageVolume): string {
  return v.uuid || v.mountPoint
}
function partitionName(v: StorageVolume): string {
  return props.displayNames[v.mountPoint] || v.name
}

// Reuses Task2 appPaths.ts's longest-prefix match (review Important #1: don't rewrite a copy here —
// this algorithm went through two rounds of rework in Task2 for edge-case bugs; keeping two copies means only one gets fixed next time).
const currentVolume = computed<StorageVolume | null>(() => volumeForPath(props.currentPath, props.volumes))
const currentDiskName = computed(() => {
  if (currentVolume.value) return partitionName(currentVolume.value)
  return props.currentPath.split('/').slice(0, 3).join('/') || 'Current Disk'
})
const availableVolumes = computed(() => {
  const currentKey = currentVolume.value ? partKey(currentVolume.value) : null
  return props.volumes.filter((v) => v.mountPoint && partKey(v) !== currentKey)
})
const selectedVolume = computed<StorageVolume | null>(
  () => props.volumes.find((v) => partKey(v) === selectedKey.value) ?? null,
)

// ── Browse directory ──────────────────────────────────────────────────────────────
const browseRoot = ref('')
const browsePath = ref('')
const browseItems = ref<FolderEntry[]>([])
const browseLoading = ref(false)
const browseError = ref('')
// Target path: freeze browsePath into this when entering the confirm step; the subsequent confirm/migrating/done steps
// all read this instead of the live browsePath (the browse step has already been left, so browsePath won't change again, but keeping them separate is clearer semantically).
const targetPath = ref('')

let browseGen = 0 // Staleness guard for directory switches (same generation-counter pattern as newui-async-stale-guard, written inline instead of extracted into a helper)

const browseFolders = computed(() => filterBrowseFolders(browseItems.value, props.type, props.currentPath))
const browseCrumbsList = computed(() => browseCrumbs(browseRoot.value, browsePath.value, props.displayNames))
const liveDestPaths = computed(() => browseDestPaths(props.type, browsePath.value || browseRoot.value))
const confirmDestPaths = computed(() => browseDestPaths(props.type, targetPath.value))

async function loadBrowseItems(path: string) {
  const gen = ++browseGen
  browseLoading.value = true
  browseError.value = ''
  try {
    const listing = await service.folder.getList(path)
    if (gen !== browseGen) return // Late result: the directory has already been switched away from, discard
    browseItems.value = listing.content ?? []
  } catch (e) {
    if (gen !== browseGen) return
    browseError.value = (e as Error)?.message || t('settingsMigLoadFolderFailed')
  } finally {
    if (gen === browseGen) browseLoading.value = false
  }
}

function enterBrowseStep() {
  if (!selectedVolume.value) return
  browseRoot.value = browseRootPath(selectedVolume.value.mountPoint)
  browsePath.value = browseRoot.value
  step.value = 'browse'
  void loadBrowseItems(browseRoot.value)
}

function navigateTo(path: string) {
  if (!path.startsWith(browseRoot.value)) return
  // Leaving the current directory: if the new-folder/rename inline input is still open, just discard it (don't treat it as a blur-submit,
  // otherwise navigating mid-edit would send off a half-finished name).
  newFolderEscCancelled = true
  newFolderMode.value = false
  newFolderError.value = ''
  renameEscCancelled = true
  renamingPath.value = null
  browsePath.value = path
  void loadBrowseItems(path)
}
function navigateUp() {
  if (browsePath.value === browseRoot.value) return
  navigateTo(parentPath(browsePath.value, browseRoot.value))
}
function confirmBrowsePath() {
  targetPath.value = browsePath.value
  step.value = 'confirm'
}

// ── New folder (inline) ─────────────────────────────────────────────────────
const newFolderMode = ref(false)
const newFolderName = ref('')
const newFolderError = ref('')
const newFolderSubmitting = ref(false)
const newFolderInputEl = ref<HTMLInputElement | null>(null)
let newFolderEscCancelled = false

function startNewFolder() {
  newFolderMode.value = true
  newFolderName.value = t('settingsMigNewFolder')
  newFolderError.value = ''
  newFolderEscCancelled = false
  void nextTick(() => { newFolderInputEl.value?.focus(); newFolderInputEl.value?.select() })
}
function cancelNewFolder() {
  newFolderEscCancelled = true
  newFolderMode.value = false
  newFolderName.value = ''
  newFolderError.value = ''
}
async function submitNewFolder() {
  if (newFolderSubmitting.value) return
  const name = newFolderName.value.replace(/\//g, '').trim()
  if (!name) { cancelNewFolder(); return }
  newFolderSubmitting.value = true
  const newPath = `${browsePath.value.replace(/\/$/, '')}/${name}`
  try {
    await service.folder.create(newPath)
    newFolderMode.value = false
    newFolderName.value = ''
    newFolderError.value = ''
    await loadBrowseItems(browsePath.value)
  } catch (e) {
    newFolderError.value = (e as Error)?.message || t('settingsMigCreateFolderFailed')
  } finally {
    newFolderSubmitting.value = false
  }
}
function onNewFolderBlur() {
  if (newFolderEscCancelled || newFolderSubmitting.value) return
  void submitNewFolder()
}

// ── Inline rename ────────────────────────────────────────────────────────────
const renamingPath = ref<string | null>(null)
const renameValue = ref('')
const renameSubmitting = ref(false)
const renameInputEl = ref<HTMLInputElement | null>(null)
let renameEscCancelled = false

// Use a function ref instead of a string ref: a string ref that appears inside a v-for scope gets collected
// into an array by Vue (even though v-if guarantees only one is actually rendered at a time), so .value ends up
// being [inputEl] instead of inputEl itself, and the .focus() call below throws "not a function" — this is a real bug
// that only surfaced once review Important #2 forced a write-path test to be added, not a test problem, and has been fixed with a function ref
// (the official Vue docs explicitly recommend a function ref when you want a single reference inside a v-for).
function setRenameInputEl(el: Element | ComponentPublicInstance | null) {
  renameInputEl.value = (el as HTMLInputElement) ?? null
}

function startRename(folder: FolderEntry) {
  renamingPath.value = folder.path
  renameValue.value = folder.name
  renameEscCancelled = false
  void nextTick(() => { renameInputEl.value?.focus(); renameInputEl.value?.select() })
}
function cancelRename() {
  renameEscCancelled = true
  renamingPath.value = null
  renameValue.value = ''
}
async function submitRename() {
  if (renameSubmitting.value || !renamingPath.value) return
  const oldPath = renamingPath.value
  const name = renameValue.value.replace(/\//g, '').trim()
  if (!name || name === oldPath.split('/').pop()) { cancelRename(); return }
  const newPath = oldPath.replace(/\/[^/]+$/, '') + '/' + name
  renameSubmitting.value = true
  try {
    await service.folder.rename(oldPath, newPath)
    renamingPath.value = null
    renameValue.value = ''
    if (browsePath.value === oldPath) browsePath.value = newPath
    await loadBrowseItems(browsePath.value)
  } catch (e) {
    browseError.value = (e as Error)?.message || t('settingsMigRenameFailed')
    cancelRename()
  } finally {
    renameSubmitting.value = false
  }
}
function onRenameBlur() {
  if (renameEscCancelled || renameSubmitting.value) return
  void submitRename()
}

// ── Delete (double-confirm) ───────────────────────────────────────────────────────
const deleteTarget = ref<FolderEntry | null>(null)
const deleteConfirmOpen = ref(false)
function askDelete(folder: FolderEntry) {
  deleteTarget.value = folder
  deleteConfirmOpen.value = true
}
async function performDelete() {
  const folder = deleteTarget.value
  deleteConfirmOpen.value = false
  if (!folder) return
  try {
    await service.batch.delete([folder.path])
    await loadBrowseItems(browsePath.value)
  } catch (e) {
    browseError.value = (e as Error)?.message || t('settingsMigDeleteFailed')
  }
}

// ── Migration and polling ────────────────────────────────────────────────────────
const jobId = ref<string | null>(null)
const jobStatus = ref<MigrateStatus>({
  id: '', type: '', status: '', phase: '', stopping_apps: 0, progress: 0, processed_size: 0, total_size: 0,
})
const jobError = ref('')
let pollTimer: ReturnType<typeof setInterval> | null = null
let pollFails = 0

function stopPolling() {
  if (pollTimer !== null) { clearInterval(pollTimer); pollTimer = null }
}

async function poll() {
  if (!jobId.value) return
  try {
    const job = await service.sys.getMigrateStatus(jobId.value)
    pollFails = 0
    jobStatus.value = job
    if (job.status === 'done') {
      stopPolling()
      step.value = 'done'
      emit('finish')
    } else if (job.status === 'error') {
      stopPolling()
      jobError.value = job.error || t('settingsMigFailed')
      step.value = 'error'
      // Review Important #2: both the done/error branches of Vue2's pollStatus call $emit('finish', job) —
      // on failure the backend may have already swapped the anchor halfway (the rollback
      // rename-failed branch in NimoOS/service/migrate.go:777-820 explicitly logs "CRITICAL: manual intervention required"),
      // and if the UI doesn't re-fetch the paths it will keep showing the pre-migration old path until the user manually refreshes. The parent component's onDialogFinish
      // just re-fetches getSystemPaths, which is idempotent, so calling it again is harmless.
      emit('finish')
    }
  } catch (e) {
    // Porting discipline ②: Vue2 here only does console.error, so if the job is lost it polls forever — after
    // MAX_POLL_FAILS consecutive failures we stop the timer + report the error, no silence.
    pollFails++
    if (pollFails >= MAX_POLL_FAILS) {
      stopPolling()
      jobError.value = (e as Error)?.message || t('settingsMigFailed')
      step.value = 'error'
    }
  }
}

async function startMigration() {
  if (!selectedVolume.value) return
  step.value = 'migrating'
  jobError.value = ''
  pollFails = 0
  jobStatus.value = { id: '', type: props.type, status: 'running', phase: '', stopping_apps: 0, progress: 0, processed_size: 0, total_size: props.requiredSpace }
  try {
    const res = await service.sys.migrateAppPath(props.type, targetPath.value)
    jobId.value = res.job_id
    pollTimer = setInterval(() => { void poll() }, POLL_MS)
  } catch (e) {
    jobError.value = (e as Error)?.message || 'Unknown error'
    step.value = 'error'
  }
}

const doneDestPaths = computed(() => {
  if (targetPath.value) return browseDestPaths(props.type, targetPath.value)
  return jobStatus.value.new_path ? [jobStatus.value.new_path] : []
})

// ── Lifecycle ──────────────────────────────────────────────────────────────
onUnmounted(() => stopPolling())

watch(() => props.open, (isOpen) => {
  if (isOpen) return
  // Reset on close: don't carry stale state from last time into the next open (the timer must be stopped first, same lesson as NetworkIfaceConfigDialog).
  stopPolling()
  step.value = 'select'
  selectedKey.value = null
  jobId.value = null
  jobError.value = ''
  browseItems.value = []
  browseError.value = ''
  newFolderMode.value = false
  renamingPath.value = null
})

function onDialogUpdateOpen(v: boolean) {
  if (!v && step.value === 'migrating') return // migrating step: Esc / overlay clicks are also blocked
  emit('update:open', v)
}
</script>

<template>
  <Dialog :open="open" @update:open="onDialogUpdateOpen">
    <div class="set-mig">
      <div class="set-mig-head">
        <h3 class="set-mig-title">{{ t('settingsMigTitle') }}</h3>
        <button
          v-if="step !== 'migrating'"
          class="set-mig-x" type="button" :aria-label="t('settingsMigClose')"
          @click="onDialogUpdateOpen(false)"
        >×</button>
      </div>

      <!-- Step 1: pick partition -->
      <template v-if="step === 'select'">
        <div class="set-mig-status">
          <div class="set-mig-status-card">
            <p class="set-mig-status-value">{{ currentDiskName }}</p>
            <p class="set-mig-status-label">{{ t('settingsMigCurrentLocation') }}</p>
          </div>
          <div class="set-mig-status-card">
            <p class="set-mig-status-value">{{ renderSize(requiredSpace) }}</p>
            <p class="set-mig-status-label">{{ t('settingsMigRequiredSpace') }}</p>
          </div>
        </div>

        <p class="set-mig-select-label">{{ t('settingsMigSelectNew') }}</p>
        <div v-if="availableVolumes.length === 0" class="set-mig-empty">{{ t('settingsMigNoOther') }}</div>
        <div v-else class="set-mig-list">
          <div
            v-for="v in availableVolumes" :key="partKey(v)"
            class="set-mig-item" :class="{ 'is-selected': selectedKey === partKey(v) }"
            @click="selectedKey = partKey(v)"
          >
            <div class="set-mig-item-name">{{ partitionName(v) }}</div>
            <div class="set-mig-item-sub">
              <span v-if="v.fsType" class="set-mig-item-fs">{{ v.fsType.toUpperCase() }}</span>
              <span>{{ renderSize(v.usedSize || 0) }} / {{ renderSize(v.size) }}</span>
            </div>
          </div>
        </div>
      </template>

      <!-- Step 2: browse directory -->
      <template v-else-if="step === 'browse'">
        <div class="set-mig-crumbrow">
          <button
            type="button" class="set-mig-back" :disabled="browsePath === browseRoot"
            :aria-label="t('settingsMigBack')" @click="navigateUp"
          >‹</button>
          <div class="set-mig-crumbs">
            <span
              v-for="(c, i) in browseCrumbsList" :key="c.path"
              class="set-mig-crumb" :class="{ 'is-active': i === browseCrumbsList.length - 1 }"
              @click="i < browseCrumbsList.length - 1 && navigateTo(c.path)"
            >{{ i > 0 ? '/' : '' }}{{ c.name }}</span>
          </div>
          <button
            type="button" class="set-mig-newfolder-btn" :title="t('settingsMigNewFolder')"
            @click="startNewFolder"
          >+</button>
        </div>

        <div class="set-mig-list">
          <div v-if="browseLoading" class="set-mig-loading">…</div>
          <template v-else>
            <div v-if="newFolderMode" class="set-mig-folder set-mig-newfolder-row">
              <input
                ref="newFolderInputEl" v-model="newFolderName" class="set-input set-mig-input" type="text"
                @keydown.enter="submitNewFolder" @keydown.esc="cancelNewFolder" @blur="onNewFolderBlur"
              />
            </div>
            <p v-if="newFolderError" class="set-danger">{{ newFolderError }}</p>

            <p v-if="!browseError && browseFolders.length === 0 && !newFolderMode" class="set-mig-empty">
              {{ t('settingsMigNoSubfolders') }}
            </p>
            <p v-if="browseError" class="set-danger">{{ browseError }}</p>

            <ContextMenu v-for="folder in browseFolders" :key="folder.path">
              <div
                class="set-mig-folder"
                @click="renamingPath !== folder.path && navigateTo(folder.path)"
              >
                <input
                  v-if="renamingPath === folder.path"
                  :ref="setRenameInputEl" v-model="renameValue" class="set-input set-mig-input" type="text"
                  @click.stop
                  @keydown.enter.stop="submitRename" @keydown.esc.stop="cancelRename" @blur="onRenameBlur"
                />
                <span v-else class="set-mig-folder-name">{{ folder.name }}</span>
              </div>
              <template #menu>
                <ContextMenuItem
                  class="ui-ctx-item" :disabled="isProtectedFolder(folder.name)"
                  @select="startRename(folder)"
                >{{ t('settingsMigRename') }}</ContextMenuItem>
                <ContextMenuSeparator class="ui-ctx-sep" />
                <ContextMenuItem
                  class="ui-ctx-item danger" :disabled="isProtectedFolder(folder.name)"
                  @select="askDelete(folder)"
                >{{ t('settingsMigDelete') }}</ContextMenuItem>
              </template>
            </ContextMenu>
          </template>
        </div>

        <div class="set-mig-destbar">
          <div v-for="p in liveDestPaths" :key="p" class="set-mig-destpath">{{ p }}</div>
        </div>
      </template>

      <!-- Step 3: confirm -->
      <template v-else-if="step === 'confirm'">
        <p class="set-mig-confirm-route">
          {{ currentDiskName }} → {{ selectedVolume ? partitionName(selectedVolume) : '' }}
        </p>
        <p class="set-mig-confirm-size">{{ renderSize(requiredSpace) }} {{ t('settingsMigWillBeMoved') }}</p>
        <div class="set-mig-confirm-paths">
          <p v-for="p in confirmDestPaths" :key="p" class="set-mig-destpath">{{ p }}</p>
        </div>
        <div class="set-card set-mig-note">
          <p class="set-warn">
            <b>{{ t('settingsMigNote') }}:</b>
            {{ t('settingsMigNoteBody') }}
            {{ t('settingsMigNoteDocker') }}
          </p>
        </div>
      </template>

      <!-- Step 4: migrating -->
      <template v-else-if="step === 'migrating'">
        <div v-if="jobStatus.phase === 'stopping_services'" class="set-mig-progress-wrap">
          <p class="set-mig-progress-title">{{ t('settingsMigStopping') }}</p>
          <p v-if="jobStatus.stopping_apps > 0" class="set-warn">
            {{ t('settingsMigStoppingApps', { n: jobStatus.stopping_apps }) }}
          </p>
          <p class="set-mig-hint">{{ t('settingsMigKeepOpen') }}</p>
        </div>

        <div v-else-if="jobStatus.phase === 'copying' || jobStatus.phase === ''" class="set-mig-progress-wrap">
          <p class="set-mig-progress-title">{{ t('settingsMigCopying') }}</p>
          <p class="set-mig-progress-sub">
            {{ renderSize(jobStatus.processed_size) }} / {{ renderSize(jobStatus.total_size || requiredSpace) }}
          </p>
          <div class="set-mig-progress">
            <div class="set-mig-progress-fill" :style="{ width: jobStatus.progress + '%' }" />
          </div>
          <p class="set-mig-progress-pct">{{ jobStatus.progress }}%</p>
          <p class="set-mig-hint">{{ t('settingsMigKeepOpen') }}</p>
        </div>

        <div v-else-if="jobStatus.phase === 'starting_services'" class="set-mig-progress-wrap">
          <p class="set-mig-progress-title">{{ t('settingsMigStarting') }}</p>
          <p class="set-mig-hint">{{ t('settingsMigKeepOpen') }}</p>
        </div>
      </template>

      <!-- Step 5: done -->
      <template v-else-if="step === 'done'">
        <div class="set-mig-result">
          <p class="set-mig-result-title">{{ t('settingsMigDone') }}</p>
          <p v-for="p in doneDestPaths" :key="p" class="set-mig-destpath">{{ p }}</p>
        </div>
      </template>

      <!-- Step 6: error -->
      <template v-else-if="step === 'error'">
        <div class="set-mig-result">
          <p class="set-mig-result-title">{{ t('settingsMigFailed') }}</p>
          <p class="set-danger">{{ jobError }}</p>
          <div class="set-card set-mig-note">
            <p class="set-mig-cleanup-title">{{ t('settingsMigCleanupTitle') }}</p>
            <p class="set-warn">{{ t('settingsMigCleanupBody') }}</p>
          </div>
        </div>
      </template>
    </div>

    <template #footer>
      <button
        v-if="step === 'select'" class="set-btn primary set-mig-next" type="button"
        :disabled="!selectedKey" @click="enterBrowseStep"
      >{{ t('settingsMigNext') }}</button>

      <template v-else-if="step === 'browse'">
        <button class="set-btn set-mig-back-btn" type="button" @click="step = 'select'">{{ t('settingsMigBack') }}</button>
        <button class="set-btn primary set-mig-next" type="button" @click="confirmBrowsePath">{{ t('settingsMigNext') }}</button>
      </template>

      <template v-else-if="step === 'confirm'">
        <button class="set-btn set-mig-back-btn" type="button" @click="step = 'browse'">{{ t('settingsMigBack') }}</button>
        <button class="set-btn primary set-mig-start" type="button" @click="startMigration">{{ t('settingsMigStart') }}</button>
      </template>

      <button
        v-else-if="step === 'done' || step === 'error'" class="set-btn primary set-mig-close" type="button"
        @click="onDialogUpdateOpen(false)"
      >{{ t('settingsMigClose') }}</button>
    </template>
  </Dialog>

  <AlertDialog
    :open="deleteConfirmOpen"
    :title="t('settingsMigDelete')"
    :message="deleteTarget ? deleteTarget.name : ''"
    :confirm-text="t('settingsMigDelete')"
    :cancel-text="t('settingsMigCancel')"
    destructive
    @update:open="deleteConfirmOpen = $event"
    @confirm="performDelete"
  />
</template>

<style scoped>
.set-mig { display: flex; flex-direction: column; gap: 14px; min-width: min(480px, 88vw); }
.set-mig-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.set-mig-title { margin: 0; font-size: 15px; font-weight: 600; }
/* Header × button: used to share the .set-mig-close class name with the footer's "Close" primary button;
   the scoped selector specificity is (0,2,0), same as .set-btn.primary, and wins by source order in the build output,
   causing the footer primary button to be swallowed by this transparent-background/small-font-size style and rendered as a bare line of text (review Important #1). Split into its own class name. */
.set-mig-x {
  border: none; background: transparent; color: var(--fg-muted); font-size: 20px; line-height: 1;
  cursor: pointer; padding: 2px 8px; border-radius: 8px;
}
.set-mig-x:hover { background: var(--chip-bg-hi); color: var(--fg); }

.set-mig-select-label { margin: 0; font-weight: 600; font-size: 13px; }
.set-mig-empty { padding: 24px 0; text-align: center; color: var(--fg-muted); font-size: 12px; }
.set-mig-item-name { font-weight: 600; margin-bottom: 4px; }
.set-mig-item-sub { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--fg-muted); }
.set-mig-item-fs { padding: 1px 8px; border-radius: 999px; background: var(--chip-bg); }

.set-mig-crumbrow { display: flex; align-items: center; gap: 8px; }
.set-mig-back {
  border: none; background: transparent; color: var(--accent); cursor: pointer; font-size: 16px; flex: 0 0 auto;
}
.set-mig-back:disabled { color: var(--fg-muted); cursor: default; }
.set-mig-newfolder-btn {
  border: none; background: transparent; color: var(--fg-muted); cursor: pointer; font-size: 16px; flex: 0 0 auto;
}
.set-mig-newfolder-btn:hover { color: var(--accent); }
.set-mig-folder-name { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.set-mig-loading { padding: 24px 0; text-align: center; color: var(--fg-muted); font-size: 12px; }

.set-mig-destbar { display: flex; flex-direction: column; gap: 2px; }
.set-mig-destpath { margin: 0; font-size: 12px; color: var(--fg-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.set-mig-confirm-route { margin: 0; font-weight: 600; }
.set-mig-confirm-size { margin: 0; font-size: 12px; color: var(--fg-muted); }
.set-mig-confirm-paths { display: flex; flex-direction: column; gap: 2px; }
.set-mig-note { padding: 12px; }
.set-mig-note .set-warn { margin: 0; font-size: 12px; }

.set-mig-progress-wrap { text-align: center; padding: 12px 0; display: flex; flex-direction: column; gap: 8px; }
.set-mig-progress-title { margin: 0; font-weight: 600; }
.set-mig-progress-sub { margin: 0; font-size: 12px; color: var(--fg-muted); }
.set-mig-progress-pct { margin: 0; font-size: 12px; color: var(--fg-muted); }
.set-mig-hint { margin: 0; font-size: 12px; color: var(--fg-muted); }

.set-mig-result { text-align: center; padding: 12px 0; display: flex; flex-direction: column; gap: 8px; align-items: center; }
.set-mig-result-title { margin: 0; font-weight: 600; font-size: 15px; }
.set-mig-cleanup-title { margin: 0; font-weight: 600; font-size: 12px; }
</style>
