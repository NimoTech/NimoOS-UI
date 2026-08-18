<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import AreaShell from '../../components/shell/AreaShell.vue'
import FilesSidebar from '../components/FilesSidebar.vue'
import ShareRow from './ShareRow.vue'
import ShareLinkDialog from './ShareLinkDialog.vue'
import AlertDialog from '../../components/ui/AlertDialog.vue'
import SharesSelectionToolbar from './SharesSelectionToolbar.vue'
import { useSharesStore, type ShareRow as ShareRowT } from '../stores/shares'
import { useFilesStore } from '../stores/files'
import { toVirtualPath, virtualPathToRouteParam } from '../util/pathUtils'

const router = useRouter()
const { t } = useI18n()
const shares = useSharesStore()
const files = useFilesStore()

const linkDlg = ref<{ open: boolean; name: string }>({ open: false, name: '' })
const delDlg = ref<{ open: boolean; row: ShareRowT | null }>({ open: false, row: null })

const selected = ref<Set<number>>(new Set())
const batchDlg = ref(false)
const batchBusy = ref(false)

// Prune stale ids whenever the list reloads (single unshare, batch unshare,
// external changes) — a selection must never reference a row that is gone.
watch(() => shares.items, (items) => {
  const live = new Set(items.map((r) => r.id))
  const next = new Set([...selected.value].filter((id) => live.has(id)))
  if (next.size !== selected.value.size) selected.value = next
})

function toggleSelect(row: ShareRowT) {
  const next = new Set(selected.value)
  if (next.has(row.id)) next.delete(row.id)
  else next.add(row.id)
  selected.value = next
}
function selectAllRows() { selected.value = new Set(shares.items.map((r) => r.id)) }
function clearSelection() { selected.value = new Set() }
function onBatchUnshare() { if (selected.value.size && !batchBusy.value) batchDlg.value = true }
async function confirmBatchUnshare() {
  if (batchBusy.value) return
  batchDlg.value = false
  batchBusy.value = true
  try {
    const { failedIds } = await shares.removeMany([...selected.value])
    // The prune watcher (fired during removeMany's reload) already dropped the
    // successfully deleted ids; merge instead of overwrite so selection changes
    // made while the request was in flight are not clobbered. Still intersect with
    // live rows: a failed id whose row is nonetheless gone (server-side success,
    // client-side error reporting it) must not resurrect a phantom selection.
    const live = new Set(shares.items.map((r) => r.id))
    selected.value = new Set([...selected.value, ...failedIds].filter((id) => live.has(id)))
  } finally {
    batchBusy.value = false
  }
}

onMounted(() => {
  shares.load()
  if (!files.disks.length) files.loadRoots() // provide capacity for 'goto' to convert real→virtual paths
})

function goVirtual(virtualPath: string) {
  router.push('/files/' + virtualPathToRouteParam(virtualPath))
}
function onGetLink(row: ShareRowT) { linkDlg.value = { open: true, name: row.name } }
// When deep-linking directly to /files/shares, loadRoots() in onMounted may not have
// resolved yet; an empty disks will cause toVirtualPath to pass through the real path unchanged
// (leaking /DATA/mnt to the URL). We add extra protection here: if disks is empty, first
// await loadRoots() to get displayNames before mapping, rather than relying on the timing of
// that fire-and-forget call in onMounted.
async function onGoto(row: ShareRowT) {
  if (!files.disks.length) await files.loadRoots()
  goVirtual(toVirtualPath(row.path, files.displayNames))
}
function onUnshare(row: ShareRowT) { delDlg.value = { open: true, row } }
function confirmUnshare() { if (delDlg.value.row) shares.remove(delDlg.value.row.id); delDlg.value.open = false }
</script>

<template>
  <AreaShell :title="t('filesTitle')">
    <div class="files-layout">
      <FilesSidebar @navigate="goVirtual" />
      <main class="shares-main">
        <h2 class="shares-title">{{ t('filesSharesTitle') }}</h2>
        <SharesSelectionToolbar
          v-if="selected.size"
          :count="selected.size"
          :busy="batchBusy"
          @select-all="selectAllRows"
          @clear="clearSelection"
          @unshare="onBatchUnshare"
        />
        <p v-if="!shares.loading && !shares.items.length" class="shares-empty">{{ t('filesSharesEmpty') }}</p>
        <ul class="shares-list">
          <ShareRow
            v-for="row in shares.items"
            :key="row.id"
            :row="row"
            :selected="selected.has(row.id)"
            @get-link="onGetLink"
            @goto="onGoto"
            @unshare="onUnshare"
            @toggle-select="toggleSelect"
          />
        </ul>
      </main>
    </div>
    <ShareLinkDialog v-model:open="linkDlg.open" :name="linkDlg.name" />
    <AlertDialog
      v-model:open="delDlg.open"
      :title="t('filesUnshareConfirmTitle')"
      :message="t('filesUnshareConfirmMsg', { name: delDlg.row?.name ?? '' })"
      :confirm-text="t('filesUnshare')"
      :cancel-text="t('filesCancel')"
      destructive
      @confirm="confirmUnshare"
    />
    <AlertDialog
      v-model:open="batchDlg"
      :title="t('filesUnshareConfirmTitle')"
      :message="t('filesUnshareBatchConfirmMsg', { count: selected.size })"
      :confirm-text="t('filesUnshare')"
      :cancel-text="t('filesCancel')"
      destructive
      @confirm="confirmBatchUnshare"
    />
  </AreaShell>
</template>

<style scoped>
.files-layout { display: flex; gap: 16px; align-items: flex-start; min-height: 100%; }
.shares-main { flex: 1 1 auto; min-width: 0; }
.shares-title { font-size: 16px; font-weight: 600; margin: 4px 0 14px; }
.shares-empty { font-size: 13px; color: var(--fg-muted, #9aa4bf); }
.shares-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 2px; }
@media (max-width: 768px) {
  .files-layout { gap: 0; }
}
</style>
