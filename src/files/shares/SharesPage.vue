<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import FilesShell from '../components/FilesShell.vue'
import FilesSidebar from '../components/FilesSidebar.vue'
import ShareRow from './ShareRow.vue'
import ShareLinkDialog from './ShareLinkDialog.vue'
import AlertDialog from '../../components/ui/AlertDialog.vue'
import { useSharesStore, type ShareRow as ShareRowT } from '../stores/shares'
import { useFilesStore } from '../stores/files'
import { toVirtualPath, virtualPathToRouteParam } from '../util/pathUtils'

const router = useRouter()
const { t } = useI18n()
const shares = useSharesStore()
const files = useFilesStore()

const linkDlg = ref<{ open: boolean; name: string }>({ open: false, name: '' })
const delDlg = ref<{ open: boolean; row: ShareRowT | null }>({ open: false, row: null })

onMounted(() => {
  shares.load()
  if (!files.disks.length) files.loadRoots() // 供「前往」做 real→virtual 封顶
})

function goVirtual(virtualPath: string) {
  router.push('/files/' + virtualPathToRouteParam(virtualPath))
}
function onGetLink(row: ShareRowT) { linkDlg.value = { open: true, name: row.name } }
// 深链直达 /files/shares 时 onMounted 的 loadRoots() 可能还没 resolve;disks 为空会让
// toVirtualPath 原样透传 real path(泄漏 /DATA/mnt 到 URL)。这里补一道保险:disks 为空则先
// await loadRoots() 拿到 displayNames 再映射,不依赖 onMounted 那次 fire-and-forget 调用的时序。
async function onGoto(row: ShareRowT) {
  if (!files.disks.length) await files.loadRoots()
  goVirtual(toVirtualPath(row.path, files.displayNames))
}
function onUnshare(row: ShareRowT) { delDlg.value = { open: true, row } }
function confirmUnshare() { if (delDlg.value.row) shares.remove(delDlg.value.row.id); delDlg.value.open = false }
</script>

<template>
  <FilesShell>
    <div class="files-layout">
      <FilesSidebar @navigate="goVirtual" />
      <main class="shares-main">
        <h2 class="shares-title">{{ t('filesSharesTitle') }}</h2>
        <p v-if="!shares.loading && !shares.items.length" class="shares-empty">{{ t('filesSharesEmpty') }}</p>
        <ul class="shares-list">
          <ShareRow v-for="row in shares.items" :key="row.id" :row="row" @get-link="onGetLink" @goto="onGoto" @unshare="onUnshare" />
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
  </FilesShell>
</template>

<style scoped>
.files-layout { display: flex; gap: 16px; align-items: flex-start; min-height: 100%; }
.shares-main { flex: 1 1 auto; min-width: 0; }
.shares-title { font-size: 16px; font-weight: 600; margin: 4px 0 14px; }
.shares-empty { font-size: 13px; color: var(--fg-muted, #9aa4bf); }
.shares-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 2px; }
</style>
