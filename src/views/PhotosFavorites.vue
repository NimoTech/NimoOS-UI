<script setup lang="ts">
// Task 8 (SP7-P3): 收藏视图——复用 PhotosGrid 基座渲染收藏项(Task 1 usePhotosFavorites
// 提供数据/操作),接线导出 zip + 空态 + tab 过滤 + 灯箱(P2 useLightbox 单例)。壳结构照
// Photos.vue(时间线视图,src/views/Photos.vue)的 AreaShell/photos-layout/photos-main 复制
// (见 task-8-brief.md)。路由注册留给 T10。
// Task 9(SP7-P4 相册)追加:选择工具栏批量「加入相册」与灯箱单张「加入相册」,同 Photos.vue
// 的 pickerOpen/pickerIds + openAlbumPicker(ids) 模式,接 AlbumPickerDialog(T5)。
// Task 10(SP7-P4 相册,P3 推迟项收口):「存为相册」——照 Vue2 PhotosFavoritesView.vue
// :21-23(入口按钮)/:455-478(openSaveAlbum/confirmSaveAlbum)。命名模态结构照
// PhotosAlbums.vue(T7)新建相册模态的 --popup-bg/token 用法,精简掉本任务不需要的
// source-picker 部分。Esc 关闭用 document 级监听 + watch(saveAlbumOpen) 增删(照
// AlbumPickerDialog.vue:60-83 定型写法),不用模板 @keydown.esc。
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AreaShell from '../components/shell/AreaShell.vue'
import PhotosSidebar from '../photos/components/PhotosSidebar.vue'
import PhotosToolbar from '../photos/components/PhotosToolbar.vue'
import PhotosGrid from '../photos/components/PhotosGrid.vue'
import PhotosSelectionToolbar from '../photos/components/PhotosSelectionToolbar.vue'
import AlbumPickerDialog from '../photos/components/AlbumPickerDialog.vue'
import PhotoLightbox from '../photos/lightbox/PhotoLightbox.vue'
import { useLightbox } from '../photos/lightbox/useLightbox'
import { usePhotosFavorites } from '../photos/stores/favorites'
import { usePhotosAlbums } from '../photos/stores/albums'
import { useTimelineStore } from '../photos/stores/timeline'
import { useToast } from '../stores/toast'
import { matchesTab } from '../photos/util/tabFilter'
import { isConflict } from '../photos/util/httpErrors'
import type { Photo } from '../photos/util/assetToPhoto'

const { t } = useI18n()
const fav = usePhotosFavorites()
const albums = usePhotosAlbums()
// 删除是全局操作(资产真删),与时间线视图同一个 store/接口;收藏 store 自己没有
// deleteAssets——删完之后靠 fav.fetchFavorites() 显式刷新收藏列表才能反映"这张也没了"。
const store = useTimelineStore()
const toast = useToast()
const lb = useLightbox()

// 收藏视图默认 tab='all'(与时间线默认 'photo' 不同——收藏本就是用户手动挑的小集合,
// 不该预先按类型滤掉里面的视频/OCR 收藏)。
const tab = ref('all')
const density = ref('comfortable')
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
function cancelSelection() { selected.value = [] }

// Task 9(SP7-P4 相册):「加入相册」入口(选择工具栏批量 / 灯箱单张)—— 同 Photos.vue 的统一
// 模式,接 AlbumPickerDialog(T5)。@added 清空选择态;收藏列表本身不受影响,不需要刷新。
const pickerOpen = ref(false)
const pickerIds = ref<Array<string | number>>([])
function openAlbumPicker(ids: Array<string | number>) {
  pickerIds.value = ids
  pickerOpen.value = true
}
function onAlbumAdded() {
  selected.value = []
}

// Task 10(P3 推迟项收口):「存为相册」—— 把当前收藏快照存为一个新相册。
const saveAlbumOpen = ref(false)
const saveAlbumName = ref('')
const saveAlbumInputRef = ref<HTMLInputElement | null>(null)

function openSaveAlbum(): void {
  // 照 Vue2 openSaveAlbum:455-459 —— 每次打开都重新预填(不是只在首次 data() 里固化一份)。
  saveAlbumName.value = t('photosFavSaveAlbumDefault', { year: new Date().getFullYear() })
  saveAlbumOpen.value = true
  void nextTick(() => { saveAlbumInputRef.value?.focus() })
}
function closeSaveAlbum(): void {
  saveAlbumOpen.value = false
}
async function confirmSaveAlbum(): Promise<void> {
  const name = saveAlbumName.value.trim()
  if (!name) return
  // 照 Vue2 :467:`this.favorites.map(p => p.id)` —— favorites === favoritesList。
  const assetIds = fav.favoritesList?.map((p) => p.id) ?? []
  try {
    await albums.saveAsAlbum(name, assetIds)
    // 只有成功分支才关模态(照 Vue2 :461-478;失败两个分支都不关,见下方 catch)。
    saveAlbumOpen.value = false
    toast.show(t('photosFavSavedToast', { name, count: assetIds.length }))
  } catch (e) {
    toast.show(isConflict(e) ? t('photosAlbumNameExists') : t('photosFavSaveFailed'))
    // 模态保持打开、输入内容保留 —— 不清空 saveAlbumName、不 close。
  }
}

// Esc 分层,document 级监听(不用模板 @keydown.esc)—— 照 T5 AlbumPickerDialog.vue:60-83
// 定型写法:由 watch(saveAlbumOpen) 负责挂/摘监听,onUnmounted 兜底摘干净。
function onSaveAlbumKeydown(e: KeyboardEvent): void {
  if (e.key !== 'Escape') return
  closeSaveAlbum()
}
watch(saveAlbumOpen, (isOpen) => {
  if (isOpen) document.addEventListener('keydown', onSaveAlbumKeydown)
  else document.removeEventListener('keydown', onSaveAlbumKeydown)
})
onUnmounted(() => document.removeEventListener('keydown', onSaveAlbumKeydown))

// PhotosGrid 一旦有非空 selected,onTileClick 内部就切进「继续勾选」分支而非「开图」——
// 没有配套的选择工具栏会让用户勾一个框就把整个网格的单击行为锁死、且无处可退出选择态
// (评审 Finding 1,照 Photos.vue:59-66 的批量删除前例补齐,不是新功能面,只是把已经接给
// PhotosGrid 的 selected/toggle-select 落到一个有出口的 UI 上)。
async function onBatchDelete(ids: Array<string | number>) {
  const count = await store.deleteAssets(ids.map(String))
  toast.show(t('photosDeletedToast', { count }), 4000)
  selected.value = []
  await fav.fetchFavorites()
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
          <button
            type="button"
            class="fav-save-album"
            data-test="fav-save-album-btn"
            :disabled="!(fav.favoritesList?.length)"
            @click="openSaveAlbum"
          >{{ t('photosFavSaveAlbum') }}</button>
          <span class="fav-count">{{ t('photosFavCount', { count: fav.favoritesList?.length ?? 0 }) }}</span>
        </div>

        <div v-if="isEmpty" class="empty-state" data-test="fav-empty">
          <div class="empty-state-title">{{ t('photosFavEmptyTitle') }}</div>
          <div class="empty-state-desc">{{ t('photosFavEmptyHint') }}</div>
        </div>
        <template v-else>
          <PhotosSelectionToolbar
            v-if="selected.length"
            :count="selected.length"
            @clear="cancelSelection"
            @delete="onBatchDelete([...selected])"
            @add-to-album="openAlbumPicker([...selected])"
          />
          <PhotosToolbar
            :tab="tab" :density="density" :count="filteredCount"
            @update:tab="tab = $event" @update:density="density = $event"
          />
          <div class="photos-grid-slot">
            <PhotosGrid
              :months="fav.favoritesMonths" :tab="tab" :density="density" :selected="selected"
              @open="onOpenTile"
              @toggle-select="toggleSelect"
            />
          </div>
        </template>
      </main>
    </div>
  </AreaShell>
  <PhotoLightbox
    @delete="onLightboxDelete"
    @toggle-fav="() => {}"
    @add-to-album="(id) => openAlbumPicker([id])"
  />
  <AlbumPickerDialog v-model:open="pickerOpen" :asset-ids="pickerIds" @added="onAlbumAdded" />

  <div
    v-if="saveAlbumOpen"
    class="favsave-scrim"
    data-test="fav-savealbum-modal"
    @click.self="closeSaveAlbum"
  >
    <div class="favsave-modal">
      <div class="favsave-head">
        <div class="favsave-head-text">
          <div class="favsave-title">{{ t('photosFavSaveAlbumTitle') }}</div>
        </div>
        <button type="button" class="favsave-close" :aria-label="t('photosCancel')" @click="closeSaveAlbum">&#215;</button>
      </div>
      <input
        ref="saveAlbumInputRef"
        v-model="saveAlbumName"
        class="favsave-input"
        data-test="fav-savealbum-input"
        @keydown.enter="confirmSaveAlbum"
      >
      <div class="favsave-foot">
        <button type="button" class="favsave-btn-ghost" @click="closeSaveAlbum">{{ t('photosCancel') }}</button>
        <button
          type="button"
          class="favsave-btn-cta"
          data-test="fav-savealbum-confirm"
          :disabled="!saveAlbumName.trim()"
          @click="confirmSaveAlbum"
        >{{ t('photosAlbumCreate') }}</button>
      </div>
    </div>
  </div>
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

.fav-save-album {
  padding: 6px 14px; border-radius: var(--chip-radius); border: 1px solid var(--chip-border);
  background: var(--chip-bg); color: var(--fg); font-size: 13px; cursor: pointer;
}
.fav-save-album:hover:not(:disabled) { background: var(--chip-bg-hi); }
.fav-save-album:disabled { color: var(--fg-muted); cursor: not-allowed; opacity: 0.6; }

/* Save-as-album 命名模态 —— 结构照 PhotosAlbums.vue(T7)新建相册模态(P2/P3 血泪:底色须用
   --popup-bg,不用 --card-bg —— 深色主题下 --card-bg 近透明,叠在暗底上会看穿)。 */
.favsave-scrim {
  position: fixed; inset: 0; z-index: 220; background: var(--overlay-bg); backdrop-filter: var(--overlay-blur);
  display: flex; align-items: center; justify-content: center; padding: 32px 20px;
}
.favsave-modal {
  width: min(400px, 100%); background: var(--popup-bg); border: 1px solid var(--card-border);
  border-radius: 16px; box-shadow: var(--card-shadow-hi); padding: 20px 22px 18px;
}
.favsave-head { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 14px; }
.favsave-head-text { flex: 1 1 auto; min-width: 0; }
.favsave-title { font-size: 16px; font-weight: 600; color: var(--fg); }
.favsave-close {
  flex: 0 0 auto; width: 24px; height: 24px; border-radius: 50%; border: 0; background: transparent;
  color: var(--fg-muted); font-size: 15px; line-height: 1; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
}
.favsave-close:hover { background: var(--chip-bg-hi); color: var(--fg); }
.favsave-input {
  width: 100%; height: 38px; padding: 0 12px; border-radius: 9px; border: 1px solid var(--chip-border);
  background: var(--chip-bg); color: var(--fg); font: inherit; font-size: 13.5px;
}
.favsave-input:focus { outline: 2px solid var(--accent); outline-offset: -1px; }
.favsave-foot { display: flex; gap: 10px; justify-content: flex-end; margin-top: 16px; }
.favsave-btn-ghost { padding: 8px 16px; border-radius: 9px; border: 1px solid var(--chip-border); background: var(--chip-bg); color: var(--fg); font: inherit; font-size: 13px; cursor: pointer; }
.favsave-btn-ghost:hover { background: var(--chip-bg-hi); }
.favsave-btn-cta { padding: 8px 18px; border-radius: 9px; border: 0; background: var(--accent); color: var(--on-accent); font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; }
.favsave-btn-cta:disabled { opacity: 0.5; cursor: not-allowed; }

.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; padding: 80px 20px; color: var(--fg-muted); text-align: center; }
.empty-state-title { font-size: 16px; font-weight: 600; color: var(--fg); }
.empty-state-desc { font-size: 13px; }

/* ≤768px:侧栏已收抽屉(PhotosSidebar.is-drawer 脱离文档流),布局单列 */
@media (max-width: 768px) {
  .photos-layout { gap: 0; }
}
</style>
