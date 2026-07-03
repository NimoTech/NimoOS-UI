<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ContextMenuItem, ContextMenuSeparator } from 'reka-ui'
import ContextMenu from '../../components/ui/ContextMenu.vue'
import type { FileEntry } from '../stores/files'
import { canOperate } from '../util/protect'
import { useFavoritesStore } from '../stores/favorites'

const props = defineProps<{ entry: FileEntry | null; selectedCount: number }>()
const emit = defineEmits<{ (e: 'action', action: string, entry: FileEntry | null): void }>()
const { t } = useI18n()
const favorites = useFavoritesStore()

const single = computed(() => props.selectedCount <= 1)
const operable = computed(() => (props.entry ? canOperate(props.entry) : false))
const favorited = computed(() => (props.entry ? favorites.isFavorite(props.entry.path) : false))

// 单项操作(多选时隐藏,与复制路径/重命名一致);收藏仅对文件夹
const showCopyPath = computed(() => single.value)
const showRename = computed(() => single.value && operable.value)
const showFavorite = computed(() => single.value && !!props.entry?.is_dir)
// 分割线只在"删除之上确实有其它项"时出现(否则只剩删除会出现悬空分割线)
const showSeparator = computed(
  () => operable.value && (showCopyPath.value || showRename.value || showFavorite.value),
)

function fire(action: string) { emit('action', action, props.entry) }
</script>

<template>
  <ContextMenu>
    <slot />
    <template #menu>
      <!-- 空白区菜单 -->
      <template v-if="entry === null">
        <ContextMenuItem class="ui-ctx-item ctx-new-folder" @select="fire('new-folder')">{{ t('filesNewFolder') }}</ContextMenuItem>
        <ContextMenuItem class="ui-ctx-item ctx-new-file" @select="fire('new-file')">{{ t('filesNewFile') }}</ContextMenuItem>
        <ContextMenuSeparator class="ui-ctx-sep" />
        <ContextMenuItem class="ui-ctx-item ctx-refresh" @select="fire('refresh')">{{ t('filesCtxRefresh') }}</ContextMenuItem>
      </template>
      <!-- 文件/文件夹项菜单 -->
      <template v-else>
        <ContextMenuItem v-if="showCopyPath" class="ui-ctx-item ctx-copy-path" @select="fire('copy-path')">{{ t('filesCtxCopyPath') }}</ContextMenuItem>
        <ContextMenuItem v-if="showRename" class="ui-ctx-item ctx-rename" @select="fire('rename')">{{ t('filesRename') }}</ContextMenuItem>
        <ContextMenuItem v-if="showFavorite" class="ui-ctx-item ctx-fav" @select="fire('toggle-favorite')">{{ favorited ? t('filesCtxRemoveFavorite') : t('filesCtxAddFavorite') }}</ContextMenuItem>
        <ContextMenuSeparator v-if="showSeparator" class="ui-ctx-sep" />
        <ContextMenuItem v-if="operable" class="ui-ctx-item danger ctx-delete" @select="fire('delete')">{{ t('filesCtxDelete') }}</ContextMenuItem>
      </template>
    </template>
  </ContextMenu>
</template>
