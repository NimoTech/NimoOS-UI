<script setup lang="ts">
// Settings · Apps. Maps to Vue2 SettingsPanel.vue's apps branch (template L587-665) +
// loadAppsData() (:1910-1971) + pruneDocker() (:1973) + clearLocalUploads() (:2010).
//
// Three sections: ① "App data storage location" four rows (app_data / images / database / photos_data;
//         from Task 2's buildAppPathRows, photos_data is the fourth row Task 3 added,
//         matching Vue 2 #103)
//      ② Docker cache cleanup (double confirmation + service.container.prune())
//      ③ Clear local pending-upload cache — policy 3 "for show", see the dedicated comment below.
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { service, type SystemPaths } from '@nimotech/nimoos-service'
import SettingsSection from '../components/SettingsSection.vue'
import AlertDialog from '../../components/ui/AlertDialog.vue'
import AppPathRow from './apps/AppPathRow.vue'
import AppPathDialog from './apps/AppPathDialog.vue'
import { buildAppPathRows, type AppPathKey, type AppPathRow as AppPathRowData } from '../util/appPaths'
import { mapVolumes, type StorageVolume } from '../../storage/util/storageMap'
import { renderSize } from '../../files/util/format'
import { toVirtualPath } from '../../files/util/pathUtils'
import { useToast } from '../../stores/toast'
import '../styles/settings.css'

const { t } = useI18n()
const toast = useToast()

const ROW_LABEL_KEY: Record<AppPathKey, string> = {
  app_data: 'settingsAppsAppData',
  images: 'settingsAppsImages',
  database: 'settingsAppsDatabase',
  photos_data: 'settingsAppsPhotosData',
}

// ── Fetching data (the four "App data storage location" rows) ──────────────────────────────────────────
const paths = ref<SystemPaths | null>(null)
const volumes = ref<StorageVolume[]>([])
const rows = computed(() => buildAppPathRows(paths.value, volumes.value))

// Review Important #3: must not render the four rows with 0 values while the fetch is still in flight
// — especially the "user database" row, where pathText() unconditionally appends the four-directory
// suffix, so before the fetch settles it would show a fake path missing its prefix (e.g.
// "/Documents & Downloads & Gallery & Media"). The loading-state condition is chosen as "both endpoints
// have settled", not "the path one alone settling is enough": because pathText() depends on
// displayNames (computed from volumes), if paths settles first while volumes hasn't yet, the virtual
// path conversion fails and briefly shows the same kind of wrong bare path — that's the same class of
// bad reading the brief describes as a "fake path"; waiting on paths alone isn't sufficient.
const loading = ref(true)

// Inline guard (not extracted into a shared helper, following the same precedent as
// StoragePanel.vue/SystemStatusPanel.vue): prevents writing back to an unmounted component's ref when
// either of the two concurrent requests settles after the component has unmounted. This panel has no
// user-editable controls, so the guard is purely defensive (the user switches away from this tab while
// the fetch is in flight).
let alive = true
onUnmounted(() => { alive = false })

async function loadPaths() {
  try {
    const data = await service.sys.getSystemPaths()
    if (!alive) return
    paths.value = data
  } catch {
    if (!alive) return
    paths.value = null
  }
}

async function loadVolumes() {
  try {
    const raw = await service.storage.list({ system: 'show' })
    if (!alive) return
    volumes.value = mapVolumes(raw)
  } catch {
    if (!alive) return
    volumes.value = []
  }
}

onMounted(() => {
  // Fired concurrently, without waiting on each other — the two endpoints fetch and fall back
  // independently, and either failing doesn't affect the other; the loading state only settles once
  // both have settled (regardless of success or failure).
  void Promise.allSettled([loadPaths(), loadVolumes()]).then(() => {
    if (!alive) return
    loading.value = false
  })
})

// displayNames: the root mount point "/" displays as /DATA (same convention as
// home/stores/folders.ts:loadDisks — in the backend GET /v1/storage response the system disk's
// mount_point is the bare "/", but the paths returned by /v1/sys/paths (e.g. /DATA/AppData) are written
// relative to the virtual root /DATA; toVirtualPath is a pure prefix match, so displayNames' keys must
// genuinely line up with the path prefixes — which means this can't just copy the literal "use
// v.mountPoint as-is for the key" approach: that would try to match "/" against "/DATA/AppData" for the
// root disk, fail to match, and the virtual path conversion would never come out).
// Non-root mount points use the real mountPoint as-is, with no rewriting.
const displayNames = computed<Record<string, string>>(() => {
  const map: Record<string, string> = {}
  for (const v of volumes.value) {
    if (!v.mountPoint) continue
    const mp = v.mountPoint === '/' ? '/DATA' : v.mountPoint
    map[mp] = v.name || (mp === '/DATA' ? 'NimoOS-HD' : mp)
  }
  return map
})

function sizeText(row: AppPathRowData): string {
  return `${renderSize(row.size)} / ${row.total ? renderSize(row.total) : '—'}`
}

function pathText(row: AppPathRowData): string {
  const virtual = toVirtualPath(row.path, displayNames.value)
  // Vue2 template SettingsPanel.vue:627 hardcodes appending these four directory names to the user
  // database row; kept 1:1 in the UI (not invented here; these four directories are genuinely real
  // subdirectories under the database path, it's just that the backend /sys/paths doesn't list them
  // individually, and Vue2 chose to concatenate the string directly for display).
  if (row.key === 'database') return `${virtual}/Documents & Downloads & Gallery & Media`
  return virtual
}

// ── Change storage location dialog ──────────────────────────────────────────────────────
const dialogOpen = ref(false)
const dialogType = ref<AppPathKey>('app_data')
const dialogRow = computed(() => rows.value.find((r) => r.key === dialogType.value))

function openDialog(key: AppPathKey) {
  dialogType.value = key
  dialogOpen.value = true
}

function onDialogFinish() {
  // Migration finished: re-fetch the paths once (that row's path/size has changed), no need to re-fetch the volume list.
  void loadPaths()
}

// ── Docker cache cleanup ───────────────────────────────────────────────────────
// ⛔ POST /v1/container/prune deletes **all stopped containers** (backend is ContainersPrune with an
//    empty filter, NimoOS-AppManagement/service/container.go:902) + dangling images. Never actually run
//    on the dev machine — the user decided on 2026-08-01 not to click it (on this machine it would
//    wrongly delete the desktop widget containers nimoos-demo-widget / todo-widget). Debt D23.
const pruneConfirmOpen = ref(false)
const pruning = ref(false)

function askPrune() {
  if (pruning.value) return
  pruneConfirmOpen.value = true
}

async function confirmPrune() {
  pruneConfirmOpen.value = false
  pruning.value = true
  try {
    await service.container.prune()
    // A panel-level toast, not an error inside a dialog — a toast is correct here (the dialog has already closed, so it won't be smothered under the overlay).
    toast.show(t('settingsAppsDockerCleanDone'))
  } catch (e) {
    toast.show(t('settingsAppsDockerCleanFailed'))
    console.warn('[settings] docker prune failed', e)
  } finally {
    pruning.value = false
  }
}

// "Clear local pending-upload cache" = policy 3 "for show": UI is 1:1, button disabled, labeled as
//    enabled once the Photos area migration is done.
//    The data source is the **Photos** area's IndexedDB upload queue (Vue2 @/views/Photos/upload/idb.js),
//    not yet migrated as of SP7.
//    ⚠️ Don't substitute src/files/upload/idb.ts for it — that's SP4's separate TUS queue for the files
//    area, two different things. Debt D13.
</script>

<template>
  <SettingsSection :title="t('settingsTabApps')">
    <p class="set-comp-group-title">{{ t('settingsAppsPathTitle') }}</p>
    <div v-if="loading" class="set-skeleton">{{ t('settingsNetLoading') }}</div>
    <div v-else class="set-card">
      <AppPathRow
        v-for="row in rows" :key="row.key"
        :label="t(ROW_LABEL_KEY[row.key])"
        :size-text="sizeText(row)"
        :path-text="pathText(row)"
        @change="openDialog(row.key)"
      />
    </div>

    <div class="set-card">
      <button class="set-list-item clickable set-app-prune" type="button" @click="askPrune">
        <span class="set-row-text">
          <span class="set-row-label">{{ t('settingsAppsDockerCleanTitle') }}</span>
          <span class="set-row-sub">
            {{ pruning ? t('settingsAppsDockerCleaning') : t('settingsAppsDockerCleanSub') }}
          </span>
        </span>
        <span class="set-chevron" aria-hidden="true">›</span>
      </button>
    </div>

    <div class="set-card">
      <div class="set-list-item">
        <span class="set-row-text">
          <span class="set-row-label">{{ t('settingsAppsPendingTitle') }}</span>
          <span class="set-row-sub">{{ t('settingsAppsPendingNone') }}</span>
        </span>
        <span class="set-row-ctl">
          <button class="set-btn set-app-pending-btn" type="button" disabled>
            {{ t('settingsAppsPendingClear') }}
          </button>
        </span>
      </div>
      <p class="set-row-hint">{{ t('settingsAppsPendingDisabledHint') }}</p>
    </div>

    <AppPathDialog
      v-if="dialogRow"
      :open="dialogOpen"
      :type="dialogType"
      :current-path="dialogRow?.path ?? ''"
      :required-space="dialogRow?.size ?? 0"
      :volumes="volumes"
      :display-names="displayNames"
      @update:open="dialogOpen = $event"
      @finish="onDialogFinish"
    />
  </SettingsSection>

  <AlertDialog
    :open="pruneConfirmOpen"
    :title="t('settingsAppsDockerCleanConfirmTitle')"
    :message="t('settingsAppsDockerCleanConfirmMsg')"
    :confirm-text="t('settingsAppsDockerCleanConfirmOk')"
    :cancel-text="t('settingsCancel')"
    destructive
    @update:open="pruneConfirmOpen = $event"
    @confirm="confirmPrune"
  />
</template>
