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
import { topPersons, topPlaces, byYear as byYearOf } from '../photos/util/peopleView'
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

// Task 15A(SP7-P5 两笔记账收口):hero 统计三卡 —— 照 Vue2 PhotosFavoritesView.vue
// :369-385(byPersonAll/byPlaceAll/byYearAll)。三个纯函数(peopleView.ts)已各自按
// Vue2 的排序键实现(count desc / count desc / 年份字符串 desc),这里只做
// slice——Vue2 的模板对 byPerson/byPlace(已经是 computed 里 slice 过的结果)在
// v-for 上又各自 slice 了一次(:62/:70),两次 slice 数量相同、是多余的双重裁剪,
// 这里只做一次,渲染结果与 Vue2 一致。byYear 不 slice(Vue2 :378-385 的 byYear
// computed 本身就是未裁剪的 byYearAll)。
const byPerson = computed(() => topPersons(fav.favoritesList ?? []).slice(0, 4))
const byPlace = computed(() => topPlaces(fav.favoritesList ?? []).slice(0, 3))
const byYear = computed(() => byYearOf(fav.favoritesList ?? []))

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
// 评审 Important 1:补重入守卫(照同期 T7 PhotosAlbums.vue `creating` ref 的写法)——
// 没有这道守卫,快速双击确认按钮会在第一次 await 未 resolve 前发出第二次 saveAsAlbum,
// 第一次成功关模态+弹成功 toast 后,第二次(同名)紧接着 409 拒绝,又在已关闭的模态外
// 弹一条「已存在同名相册」,没有任何路径能压住这条多余 toast。
const saveAlbumSaving = ref(false)

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
  if (!name || saveAlbumSaving.value) return
  saveAlbumSaving.value = true
  try {
    // 照 Vue2 :467:`this.favorites.map(p => p.id)` —— favorites === favoritesList。
    const assetIds = fav.favoritesList?.map((p) => p.id) ?? []
    await albums.saveAsAlbum(name, assetIds)
    // 只有成功分支才关模态(照 Vue2 :461-478;失败两个分支都不关,见下方 catch)。
    saveAlbumOpen.value = false
    toast.show(t('photosFavSavedToast', { name, count: assetIds.length }))
  } catch (e) {
    toast.show(isConflict(e) ? t('photosAlbumNameExists') : t('photosFavSaveFailed'))
    // 模态保持打开、输入内容保留 —— 不清空 saveAlbumName、不 close。
  } finally {
    saveAlbumSaving.value = false
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

// Task 9(P8a,P3 遗留收口):fetchFavorites 失败时 favoritesLoaded 保持假(见
// favorites.ts 注释,刻意不变),旧实现下 isEmpty 因此恒假 → 落进下面的 v-else 渲染一个
// 空网格,没有任何失败提示。新增 loadError 分支(见模板,优先级在 isEmpty 之前)+ 这个重试
// 入口,直接重新调用同一个 fetch。
// 评审 Important 1 修正:本地 retrying 守卫——fetchFavorites 只在成功时才清 loadError
// (见 favorites.ts 同批修正注释),所以按钮本身不再需要靠"清空态"给用户即时反馈;这个
// ref 补上这份反馈(disabled),同时顺带堵住连点两次重试派发两个并发 fetch 的口子。
const retryingFavorites = ref(false)
async function retryFavorites(): Promise<void> {
  if (retryingFavorites.value) return
  retryingFavorites.value = true
  try {
    await fav.fetchFavorites()
  } finally {
    retryingFavorites.value = false
  }
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
          <span class="fav-count">{{ t('photosFavCount', { count: fav.favoritesTotal }) }}</span>
        </div>

        <!-- Task 9(P3 遗留收口):失败态优先级在空态之前——loadError 一旦为真,就不该
             再落进(旧代码里恒假的)isEmpty 分支渲染一个没有任何提示的空网格。 -->
        <div v-if="fav.loadError" class="empty-state" data-test="fav-load-error">
          <div class="empty-state-title">{{ t('photosFavoritesLoadFailed') }}</div>
          <button
            type="button"
            class="bar-btn"
            data-test="fav-retry"
            :disabled="retryingFavorites"
            @click="retryFavorites"
          >{{ t('photosRetry') }}</button>
        </div>
        <div v-else-if="isEmpty" class="empty-state" data-test="fav-empty">
          <div class="empty-state-title">{{ t('photosFavEmptyTitle') }}</div>
          <div class="empty-state-desc">{{ t('photosFavEmptyHint') }}</div>
        </div>
        <template v-else>
          <!-- Task 11 (SP15-P3): the hero stats and facet dropdowns below are all derived from
               fav.favoritesList, which is only the pages fetched so far while pagination is
               still catching up — say so out loud instead of silently under-reporting. -->
          <div v-if="!fav.favoritesExhausted" class="fav-loaded-hint" data-test="fav-loaded-hint">
            {{ t('photosLoadedSubsetHint', { n: fav.favoritesList?.length ?? 0 }) }}
          </div>
          <!-- Task 15A: hero 统计三卡 —— 照 Vue2 PhotosFavoritesView.vue:56-84,只在非空分支渲染
               (Vue2 :47-53/:54 的 v-if/v-else,空态整页走别的分支,三卡不渲染)。 -->
          <div class="fav-stats">
            <div class="fav-stat-card">
              <div class="label">{{ t('photosFavStatTopPerson') }}</div>
              <div class="value">{{ byPerson[0] ? byPerson[0][0] : '—' }}</div>
              <div class="meta">{{ byPerson[0] ? t('photosPeoplePhotosCount', { n: byPerson[0][1] }) : t('photosFavNoFaces') }}</div>
              <div class="fav-stat-bar">
                <span v-for="(p, i) in byPerson" :key="p[0]" :data-hi="i === 0 || undefined"></span>
              </div>
            </div>
            <div class="fav-stat-card">
              <div class="label">{{ t('photosFavStatTopPlace') }}</div>
              <div class="value">{{ byPlace[0] ? byPlace[0][0].split(',')[0] : '—' }}</div>
              <div class="meta">{{ byPlace[0] ? t('photosPeoplePhotosCount', { n: byPlace[0][1] }) : '' }}</div>
              <div class="fav-stat-bar">
                <span v-for="(p, i) in byPlace" :key="p[0]" :data-hi="i === 0 || undefined"></span>
              </div>
            </div>
            <div class="fav-stat-card">
              <div class="label">{{ t('photosFavStatByYear') }}</div>
              <div class="value">
                {{ byYear[0] ? byYear[0][1] : 0 }}
                <span class="fav-stat-sub">{{ t('photosFavStatInYear', { year: byYear[0] ? byYear[0][0] : '—' }) }}</span>
              </div>
              <div class="meta">{{ t('photosFavStatYearsTotal', { n: byYear.length }) }}</div>
              <div class="fav-stat-bar">
                <span v-for="(y, i) in byYear" :key="y[0]" :data-hi="i === 0 || undefined"></span>
              </div>
            </div>
          </div>

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
          <!-- Task 11: the backend caps a single request at 500 rows now (NimoOS-Photos#54),
               so anything past the first page only shows up once this is clicked. -->
          <div v-if="!fav.favoritesExhausted" class="fav-load-more">
            <button
              type="button"
              class="bar-btn"
              data-test="fav-load-more"
              :disabled="fav.loadingMore"
              @click="fav.loadMoreFavorites()"
            >{{ t('photosLoadMore') }}</button>
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
          <!-- 评审 Important 2:补 Vue2 :267-268 的动态副标题(结构照同期 T7
               PhotosAlbums.vue:269 .albums-modal-sub)。 -->
          <div class="favsave-sub" data-test="fav-savealbum-sub">
            {{ t('photosFavSaveAlbumSub', { count: fav.favoritesList?.length ?? 0 }) }}
          </div>
        </div>
        <button type="button" class="favsave-close" :aria-label="t('photosCancel')" @click="closeSaveAlbum">&#215;</button>
      </div>
      <input
        ref="saveAlbumInputRef"
        v-model="saveAlbumName"
        class="favsave-input"
        data-test="fav-savealbum-input"
        @keydown.enter.prevent="confirmSaveAlbum"
      >
      <!-- 评审 Important 2:补 Vue2 :279-281 的静态脚注(相册是快照,不随后续收藏变化同步)。 -->
      <div class="favsave-note" data-test="fav-savealbum-note">{{ t('photosFavSaveAlbumNote') }}</div>
      <div class="favsave-foot">
        <button type="button" class="favsave-btn-ghost" @click="closeSaveAlbum">{{ t('photosCancel') }}</button>
        <button
          type="button"
          class="favsave-btn-cta"
          data-test="fav-savealbum-confirm"
          :disabled="!saveAlbumName.trim() || saveAlbumSaving"
          @click="confirmSaveAlbum"
        >{{ t('photosAlbumCreate') }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* height(不是 min-height):这一屏封顶,只有内层滚动容器滚 —— 同源修复,理由与 Vue2
   出处见 src/views/Photos.vue 同一规则处的注释。 */
.photos-layout { display: flex; gap: 16px; align-items: flex-start; height: 100%; }
.photos-main { position: relative; flex: 1 1 auto; min-width: 0; align-self: stretch; display: flex; flex-direction: column; min-height: 0; }
.photos-grid-slot { position: relative; flex: 1 1 auto; min-height: 0; }

.fav-header { display: flex; align-items: center; gap: 12px; padding: 4px 4px 8px; }
.fav-count { color: var(--fg-muted); font-size: 13px; }

/* Task 11 (SP15-P3): same small-muted-text treatment as .fav-count above (--fg-muted, 13px) —
   no new color, just a differently-positioned instance of the same token usage. */
.fav-loaded-hint { color: var(--fg-muted); font-size: 13px; margin-bottom: 10px; }
.fav-load-more { display: flex; justify-content: center; padding: 16px 0; }
.fav-load-more .bar-btn:disabled { opacity: 0.6; cursor: not-allowed; }
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

/* Task 15A: hero 统计三卡 —— 照 Vue2 PhotosFavoritesView.vue:56-84 的 .fav-stats/
   .fav-stat-card/.label/.value/.meta/.fav-stat-bar 结构,颜色一律走 theme token
   (--card-bg/--card-border/--fg/--fg-muted/--accent/--divider,已确认两套主题都定义)。 */
.fav-stats { display: flex; gap: 12px; margin-bottom: 14px; }
.fav-stat-card {
  flex: 1 1 0; min-width: 0; padding: 14px 16px; border-radius: 14px;
  background: var(--card-bg); border: 1px solid var(--card-border);
}
.fav-stat-card .label { font-size: 12px; color: var(--fg-muted); margin-bottom: 4px; }
.fav-stat-card .value { font-size: 20px; font-weight: 600; color: var(--fg); line-height: 1.2; }
.fav-stat-sub { font-size: 11px; color: var(--fg-muted); font-weight: 400; margin-left: 4px; }
.fav-stat-card .meta { font-size: 12px; color: var(--fg-muted); min-height: 15px; margin-top: 2px; }
.fav-stat-bar { display: flex; gap: 3px; margin-top: 10px; }
.fav-stat-bar span { flex: 1 1 0; height: 4px; border-radius: 2px; background: var(--divider); }
.fav-stat-bar span[data-hi='true'] { background: var(--accent); }

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
.favsave-sub { font-size: 12px; color: var(--fg-muted); margin-top: 2px; }
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
.favsave-note { font-size: 11.5px; color: var(--fg-muted); margin-top: 10px; line-height: 1.5; }
.favsave-foot { display: flex; gap: 10px; justify-content: flex-end; margin-top: 16px; }
.favsave-btn-ghost { padding: 8px 16px; border-radius: 9px; border: 1px solid var(--chip-border); background: var(--chip-bg); color: var(--fg); font: inherit; font-size: 13px; cursor: pointer; }
.favsave-btn-ghost:hover { background: var(--chip-bg-hi); }
.favsave-btn-cta { padding: 8px 18px; border-radius: 9px; border: 0; background: var(--accent); color: var(--on-accent); font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; }
.favsave-btn-cta:disabled { opacity: 0.5; cursor: not-allowed; }

.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; padding: 80px 20px; color: var(--fg-muted); text-align: center; }
.empty-state-title { font-size: 16px; font-weight: 600; color: var(--fg); }
.empty-state-desc { font-size: 13px; }
/* 评审 Take-along:与 PhotosAlbumDetail.vue 的同款失败态间距对齐(该文件 .empty-state
   .bar-btn 已有此规则),否则两个失败屏视觉不一致。 */
.empty-state .bar-btn { margin-top: 10px; }

/* ≤768px:侧栏已收抽屉(PhotosSidebar.is-drawer 脱离文档流),布局单列 */
@media (max-width: 768px) {
  .photos-layout { gap: 0; }
}
</style>
