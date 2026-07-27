<script setup lang="ts">
// Task 8 (SP7-P3): 收藏视图——复用 PhotosGrid 基座渲染收藏项(Task 1 usePhotosFavorites
// 提供数据/操作),接线导出 zip + 空态 + tab 过滤 + 灯箱(P2 useLightbox 单例)。壳结构照
// Photos.vue(时间线视图,src/views/Photos.vue)的 AreaShell/photos-layout/photos-main 复制
// (见 task-8-brief.md)。路由注册留给 T10。
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AreaShell from '../components/shell/AreaShell.vue'
import PhotosSidebar from '../photos/components/PhotosSidebar.vue'
import PhotosToolbar from '../photos/components/PhotosToolbar.vue'
import PhotosGrid from '../photos/components/PhotosGrid.vue'
import PhotoLightbox from '../photos/lightbox/PhotoLightbox.vue'
import { useLightbox } from '../photos/lightbox/useLightbox'
import { usePhotosFavorites } from '../photos/stores/favorites'
import { useTimelineStore } from '../photos/stores/timeline'
import { useToast } from '../stores/toast'
import { matchesTab } from '../photos/util/tabFilter'
import type { Photo } from '../photos/util/assetToPhoto'

const { t } = useI18n()
const fav = usePhotosFavorites()
// 删除是全局操作(资产真删),与时间线视图同一个 store/接口;收藏 store 自己没有
// deleteAssets——删完之后靠 fav.fetchFavorites() 显式刷新收藏列表才能反映"这张也没了"。
const store = useTimelineStore()
const toast = useToast()
const lb = useLightbox()

// 收藏视图默认 tab='all'(与时间线默认 'photo' 不同——收藏本就是用户手动挑的小集合,
// 不该预先按类型滤掉里面的视频/OCR 收藏)。
const tab = ref('all')
const selected = ref<Array<string | number>>([])

const isEmpty = computed(() => fav.favoritesLoaded && (fav.favoritesList?.length ?? 0) === 0)

const filteredCount = computed(() =>
  fav.favoritesMonths.flatMap((m) => m.photos).filter((p) => matchesTab(p, tab.value)).length,
)

function toggleSelect(id: string | number) {
  const idx = selected.value.indexOf(id)
  if (idx >= 0) selected.value = selected.value.filter((x) => x !== id)
  else selected.value = [...selected.value, id]
}

function onOpenTile(photo: Photo, _list: undefined, startMs: number) {
  // 翻页集 = tab 过滤后的收藏集(与所见一致,和下方 PhotosToolbar 计数同一份数据源/谓词)。
  const filtered = fav.favoritesMonths.flatMap((m) => m.photos).filter((p) => matchesTab(p, tab.value))
  lb.openAt(photo, filtered, startMs)
}

function onExport() {
  fav.exportZip()
  toast.show(t('photosFavExporting'), 4000)
}

async function onLightboxDelete(id: string | number) {
  // 灯箱已在用户确认删除时自行 close(PhotoLightbox.vue doDelete),这里不重复关闭。
  await store.deleteAssets([String(id)])
  toast.show(t('photosDeletedToast', { count: 1 }), 4000)
  void fav.fetchFavorites()
}

onMounted(() => {
  void fav.reconcileFavIds()
  void fav.fetchFavorites()
})
</script>

<template>
  <AreaShell :title="t('photosFavTitle')">
    <div class="photos-layout">
      <PhotosSidebar />
      <main class="photos-main">
        <div class="fav-header">
          <button
            type="button"
            class="fav-export"
            :disabled="!(fav.favoritesList?.length)"
            @click="onExport"
          >{{ t('photosFavExport') }}</button>
          <span class="fav-count">{{ t('photosFavCount', { count: fav.favoritesList?.length ?? 0 }) }}</span>
        </div>

        <div v-if="isEmpty" class="empty-state" data-test="fav-empty">
          <div class="empty-state-title">{{ t('photosFavEmptyTitle') }}</div>
          <div class="empty-state-desc">{{ t('photosFavEmptyHint') }}</div>
        </div>
        <template v-else>
          <PhotosToolbar
            :tab="tab" :count="filteredCount"
            @update:tab="tab = $event"
          />
          <div class="photos-grid-slot">
            <PhotosGrid
              :months="fav.favoritesMonths" :tab="tab" :selected="selected"
              @open="onOpenTile"
              @toggle-select="toggleSelect"
            />
          </div>
        </template>
      </main>
    </div>
  </AreaShell>
  <PhotoLightbox @delete="onLightboxDelete" @toggle-fav="() => {}" />
</template>

<style scoped>
.photos-layout { display: flex; gap: 16px; align-items: flex-start; min-height: 100%; }
.photos-main { position: relative; flex: 1 1 auto; min-width: 0; align-self: stretch; display: flex; flex-direction: column; min-height: 0; }
.photos-grid-slot { position: relative; flex: 1 1 auto; min-height: 0; }

.fav-header { display: flex; align-items: center; gap: 12px; padding: 4px 4px 8px; }
.fav-count { color: var(--fg-muted); font-size: 13px; }
.fav-export {
  padding: 6px 14px; border-radius: var(--chip-radius); border: 1px solid var(--chip-border);
  background: var(--chip-bg); color: var(--fg); font-size: 13px; cursor: pointer;
}
.fav-export:hover:not(:disabled) { background: var(--chip-bg-hi); }
.fav-export:disabled { color: var(--fg-muted); cursor: not-allowed; opacity: 0.6; }

.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; padding: 80px 20px; color: var(--fg-muted); text-align: center; }
.empty-state-title { font-size: 16px; font-weight: 600; color: var(--fg); }
.empty-state-desc { font-size: 13px; }

/* ≤768px:侧栏已收抽屉(PhotosSidebar.is-drawer 脱离文档流),布局单列 */
@media (max-width: 768px) {
  .photos-layout { gap: 0; }
}
</style>
