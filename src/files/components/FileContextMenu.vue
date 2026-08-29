<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ContextMenuItem, ContextMenuSeparator } from 'reka-ui'
import ContextMenu from '../../components/ui/ContextMenu.vue'
import type { FileEntry } from '../stores/files'
import { canOperate } from '../util/protect'
import { isAlreadyShared } from '../util/shareGate'
import { canBeWallpaper } from '../util/wallpaperExt'
import { useFavoritesStore } from '../stores/favorites'
import { useClipboardStore } from '../stores/clipboard'
import { useSnapshotBrowseStore } from '../stores/snapshotBrowse'

const props = defineProps<{ entry: FileEntry | null; selectedCount: number }>()
const emit = defineEmits<{ (e: 'action', action: string, entry: FileEntry | null): void }>()
const { t } = useI18n()
const favorites = useFavoritesStore()
const clipboard = useClipboardStore()
const browse = useSnapshotBrowseStore()

const single = computed(() => props.selectedCount <= 1)
const operable = computed(() => (props.entry ? canOperate(props.entry) : false))
const favorited = computed(() => (props.entry ? favorites.isFavorite(props.entry.path) : false))
const alreadyShared = computed(() => (props.entry ? isAlreadyShared(props.entry) : false))
// Read-only snapshot: first defense line, remove write-related menu items from their
// respective show* computed properties (not stacking another condition in the template) to avoid drift in two places.
const inSnapshot = computed(() => browse.isSnapshotView)

// Single-item operation (hidden when multiple are selected, consistent with copy path/rename); favorite is for folders only
const showCopyPath = computed(() => single.value && !inSnapshot.value)
const showRename = computed(() => single.value && operable.value && !inSnapshot.value)
const showFavorite = computed(() => single.value && !!props.entry?.is_dir && !inSnapshot.value)
// Sharing is for folders only and not already shared (already-shared items are cancelled from the "shares" list page, no duplicate entry → avoid backend SHARE_ALREADY_EXISTS)
const showShare = computed(() => single.value && !!props.entry?.is_dir && !alreadyShared.value && !inSnapshot.value)
// Same gating as Vue2 ContextMenu.vue:96 -- single selection, image file, and
// hidden in the read-only snapshot view.
const showSetWallpaper = computed(() => single.value && !inSnapshot.value && canBeWallpaper(props.entry))
const showCopy = computed(() => !inSnapshot.value)
const showCut = computed(() => operable.value && !inSnapshot.value)
const showDelete = computed(() => operable.value && !inSnapshot.value)
// "Restore to original location" appears only for single selection in snapshot view — restore text is a single path, not applicable for multiple selections
const showRestoreOriginal = computed(() => inSnapshot.value && single.value)
// Separator appears only when "there are other items above delete" (otherwise only delete remains and a dangling separator appears)
const showSeparator = computed(
  () => showDelete.value
    && (showCopyPath.value || showRename.value || showFavorite.value || showShare.value || showSetWallpaper.value),
)

function fire(action: string) { emit('action', action, props.entry) }
</script>

<template>
  <ContextMenu>
    <slot />
    <template #menu>
      <!-- Blank area menu -->
      <template v-if="entry === null">
        <ContextMenuItem v-if="!inSnapshot" class="ui-ctx-item ctx-new-folder" @select="fire('new-folder')">{{ t('filesNewFolder') }}</ContextMenuItem>
        <ContextMenuItem v-if="!inSnapshot" class="ui-ctx-item ctx-new-file" @select="fire('new-file')">{{ t('filesNewFile') }}</ContextMenuItem>
        <ContextMenuSeparator v-if="!inSnapshot" class="ui-ctx-sep" />
        <ContextMenuItem class="ui-ctx-item ctx-refresh" @select="fire('refresh')">{{ t('filesCtxRefresh') }}</ContextMenuItem>
        <template v-if="clipboard.hasPasteData && !inSnapshot">
          <ContextMenuSeparator class="ui-ctx-sep" />
          <ContextMenuItem class="ui-ctx-item ctx-paste" @select="fire('paste')">{{ t('filesPaste') }}</ContextMenuItem>
        </template>
        <ContextMenuSeparator v-if="!inSnapshot" class="ui-ctx-sep" />
        <ContextMenuItem v-if="!inSnapshot" class="ui-ctx-item ctx-upload-file" @select="fire('upload-file')">{{ t('filesCtxUploadFile') }}</ContextMenuItem>
        <ContextMenuItem v-if="!inSnapshot" class="ui-ctx-item ctx-upload-folder" @select="fire('upload-folder')">{{ t('filesCtxUploadFolder') }}</ContextMenuItem>
      </template>
      <!-- File/folder item menu -->
      <template v-else>
        <ContextMenuItem v-if="showRestoreOriginal" class="ui-ctx-item ctx-restore-original" @select="fire('restore-original')">{{ t('snapBrowseRestoreToOriginal') }}</ContextMenuItem>
        <ContextMenuItem class="ui-ctx-item ctx-download" @select="fire('download')">{{ t('filesCtxDownload') }}</ContextMenuItem>
        <ContextMenuItem v-if="showCopy" class="ui-ctx-item ctx-copy" @select="fire('copy')">{{ t('filesCtxCopy') }}</ContextMenuItem>
        <ContextMenuItem v-if="showCut" class="ui-ctx-item ctx-cut" @select="fire('cut')">{{ t('filesCtxCut') }}</ContextMenuItem>
        <ContextMenuItem v-if="showCopyPath" class="ui-ctx-item ctx-copy-path" @select="fire('copy-path')">{{ t('filesCtxCopyPath') }}</ContextMenuItem>
        <ContextMenuItem v-if="showRename" class="ui-ctx-item ctx-rename" @select="fire('rename')">{{ t('filesRename') }}</ContextMenuItem>
        <ContextMenuItem v-if="showFavorite" class="ui-ctx-item ctx-fav" @select="fire('toggle-favorite')">{{ favorited ? t('filesCtxRemoveFavorite') : t('filesCtxAddFavorite') }}</ContextMenuItem>
        <ContextMenuItem v-if="showShare" class="ui-ctx-item ctx-share" @select="fire('share')">{{ t('filesShareToLan') }}</ContextMenuItem>
        <ContextMenuItem v-if="showSetWallpaper" class="ui-ctx-item ctx-set-wallpaper" @select="fire('set-wallpaper')">{{ t('filesCtxSetWallpaper') }}</ContextMenuItem>
        <ContextMenuSeparator v-if="showSeparator" class="ui-ctx-sep" />
        <ContextMenuItem v-if="showDelete" class="ui-ctx-item danger ctx-delete" @select="fire('delete')">{{ t('filesCtxDelete') }}</ContextMenuItem>
      </template>
    </template>
  </ContextMenu>
</template>
