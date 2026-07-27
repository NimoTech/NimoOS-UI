<script setup lang="ts">
// Task 7 (SP7-P4 相册): 相册列表视图——卡片网格 + 排序 + 新建三种填充方式(empty/recent/
// select,Ask Nimo 分支照 brief 明确不建)+ 空态。壳照 Photos.vue:176-180/PhotosFavorites.vue/
// PhotosTrash.vue 的 AreaShell/.photos-layout/.photos-main 复制(不抽公共,P3 T8 同样处理)。
// 结构照 Vue2 NimoOS-UI src/views/Photos/PhotosAlbumsView.vue:16-86(banner+网格)、:99-165
// (新建模态)。路由注册留给 T11。
//
// 点卡片跳真路由(Vue2 是页内 openAlbumId state)——router.push('/photos/albums/' + view.id),
// 铁律:id 可能是数字,字符串拼接自动 toString(),不需要额外 String() 包一层。
//
// 排序:接 T1 sortAlbums(不在本视图重写排序逻辑)。sort 下拉菜单 + 新建模态的 Esc/点外部关闭
// 一律 document 级监听(onMounted 挂一次、onUnmounted 摘干净),不用模板 @keydown.esc——
// 同 Vue2 mounted/beforeDestroy 的两个全局监听(:240-259)等价语义,组件本身随路由挂载/卸载
// (不是像 T6 AlbumLibraryPicker 那样 v-if 控制的子组件),故直接照 Vue2 一次性挂载/卸载,
// 不需要 T5/T6 那种「随 open prop watch 增删监听」的写法。
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { service } from '@nimotech/nimoos-service'
import AreaShell from '../components/shell/AreaShell.vue'
import PhotosSidebar from '../photos/components/PhotosSidebar.vue'
import AlbumLibraryPicker from '../photos/components/AlbumLibraryPicker.vue'
import { usePhotosAlbums } from '../photos/stores/albums'
import { useTimelineStore } from '../photos/stores/timeline'
import { useToast } from '../stores/toast'
import { albumToView, sortAlbums, type AlbumView } from '../photos/util/albumView'

type SortId = 'updated' | 'created' | 'name' | 'name-r' | 'count' | 'date'
type SourceId = 'empty' | 'recent' | 'select'

const { t } = useI18n()
const router = useRouter()
const albums = usePhotosAlbums()
const timeline = useTimelineStore()
const toast = useToast()

const sort = ref<SortId>('updated')
const sortOpen = ref(false)
const sortMenuRef = ref<HTMLElement | null>(null)

const createOpen = ref(false)
const creating = ref(false)
const newAlbumTitle = ref('')
const newAlbumSource = ref<SourceId>('empty')
const newAlbumInputRef = ref<HTMLInputElement | null>(null)

const pickerOpen = ref(false)
const pickerAlbumId = ref<string | number>('')
const pickerAlbumName = ref('')

// 随 locale 热切换重新求值(照 Vue2 :192 的既有教训——computed 而非 data() 里固化一份)。
const sortOptions = computed(() => [
  { id: 'updated' as SortId, label: t('photosAlbumSortUpdated'), hint: t('photosAlbumSortUpdatedHint') },
  { id: 'created' as SortId, label: t('photosAlbumSortCreated'), hint: t('photosAlbumSortCreatedHint') },
  { id: 'name' as SortId, label: t('photosAlbumSortName'), hint: t('photosAlbumSortNameHint') },
  { id: 'name-r' as SortId, label: t('photosAlbumSortNameR'), hint: t('photosAlbumSortNameRHint') },
  { id: 'count' as SortId, label: t('photosAlbumSortCount'), hint: t('photosAlbumSortCountHint') },
  { id: 'date' as SortId, label: t('photosAlbumSortDate'), hint: t('photosAlbumSortDateHint') },
])
const sourceOptions = computed(() => [
  { id: 'empty' as SourceId, label: t('photosAlbumFillEmpty'), hint: t('photosAlbumFillEmptyHint') },
  { id: 'recent' as SourceId, label: t('photosAlbumFillRecent'), hint: t('photosAlbumFillRecentHint') },
  { id: 'select' as SourceId, label: t('photosAlbumFillSelect'), hint: t('photosAlbumFillSelectHint') },
])

const views = computed<AlbumView[]>(() =>
  sortAlbums(albums.albums.map((a) => albumToView(a, t('photosAlbumUntitled'))), sort.value),
)
const currentSort = computed(() => sortOptions.value.find((s) => s.id === sort.value) ?? sortOptions.value[0])
const isEmpty = computed(() => albums.albumsLoaded && albums.albums.length === 0)

function coverUrl(view: AlbumView): string {
  // 只有真实资产 id 才生成缩略图 URL;空相册/无封面落到 .album-cover-fallback 渐变占位
  // (Vue2 :274-281 同语义,但 New-UI 一律走 service.photos.thumbnailUrl,不手拼 URL)。
  if (view.cover == null || view.cover === '') return ''
  return service.photos.thumbnailUrl(view.cover, 'large')
}

function pickSort(s: { id: SortId }): void {
  sort.value = s.id
  sortOpen.value = false
}

function openCard(view: AlbumView): void {
  router.push('/photos/albums/' + view.id)
}

function openCreate(): void {
  newAlbumTitle.value = ''
  newAlbumSource.value = 'empty'
  createOpen.value = true
  void nextTick(() => { newAlbumInputRef.value?.focus() })
}
function closeCreate(): void {
  createOpen.value = false
}

// 判断 409(重名)——照 AlbumPickerDialog.vue 的既有约定(不假设 e 一定带 response/message)。
function isConflict(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false
  const response = (e as { response?: unknown }).response
  if (response && typeof response === 'object' && (response as { status?: unknown }).status === 409) {
    return true
  }
  const message = (e as { message?: unknown }).message
  return /409/.test(String(message ?? ''))
}

// 照 Vue2 :309-358(去掉 nimo 分支):建成功 → 按 source 分支处理 → toast → finally 关模态。
async function confirmCreate(): Promise<void> {
  const title = newAlbumTitle.value.trim()
  if (!title || creating.value) return
  creating.value = true
  try {
    const created = await albums.createAlbum(title)
    const albumId = created?.id as string | number | undefined

    if (newAlbumSource.value === 'recent' && albumId != null) {
      const cutoff = Date.now() - 30 * 86400000
      const ids = timeline.allPhotos
        .filter((p) => {
          const ts = p.takenAt ? Date.parse(String(p.takenAt)) : 0
          return ts >= cutoff
        })
        .map((p) => p.id)
      if (ids.length) {
        await albums.addAssetsToAlbum(albumId, ids)
      }
    } else if (newAlbumSource.value === 'select' && albumId != null) {
      // 预取相册资产,使 AlbumLibraryPicker 的 existingIds 一开就正确(照 Vue2 :330-335)。
      await albums.fetchAlbumAssets(albumId)
      pickerAlbumId.value = albumId
      pickerAlbumName.value = title
      pickerOpen.value = true
    }

    toast.show(t('photosAlbumCreatedToast', { name: title }))
  } catch (e) {
    console.error('[albums] createAlbum', e)
    toast.show(isConflict(e) ? t('photosAlbumNameExists') : t('photosAlbumCreateFailed'))
  } finally {
    // Vue2 :354-357 是 finally 关模态(不是只成功才关)——select 分支的模态关闭不影响
    // 已经打开的 pickerOpen(两者是独立的 v-if 层)。
    createOpen.value = false
    creating.value = false
  }
}

function onPickerAdded(): void {
  void albums.fetchAlbums()
}

// 照 Vue2 :240-259 的两个全局监听,onUnmounted 摘干净。
function onDocMousedown(e: MouseEvent): void {
  if (sortOpen.value && sortMenuRef.value && !sortMenuRef.value.contains(e.target as Node)) {
    sortOpen.value = false
  }
}
function onDocKeydown(e: KeyboardEvent): void {
  if (e.key !== 'Escape') return
  if (createOpen.value) {
    closeCreate()
    return
  }
  if (sortOpen.value) sortOpen.value = false
}

onMounted(() => {
  void albums.fetchAlbums()
  document.addEventListener('mousedown', onDocMousedown)
  document.addEventListener('keydown', onDocKeydown)
})
onUnmounted(() => {
  document.removeEventListener('mousedown', onDocMousedown)
  document.removeEventListener('keydown', onDocKeydown)
})
</script>

<template>
  <AreaShell :title="t('photosAlbumsTitle')">
    <div class="photos-layout">
      <PhotosSidebar />
      <main class="photos-main">
        <div class="albums-banner">
          <div>
            <h1>{{ t('photosAlbumsTitle') }}</h1>
            <div class="albums-sub">{{ t('photosAlbumsCount', { count: views.length }) }}</div>
          </div>
          <div class="albums-actions">
            <div ref="sortMenuRef" class="albums-sort-wrap">
              <button type="button" class="bar-btn" data-test="albums-sort-btn" @click.stop="sortOpen = !sortOpen">
                {{ t('photosAlbumSort') }} {{ currentSort.label }}
                <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
              </button>
              <div v-if="sortOpen" class="albums-sort-menu" data-test="albums-sort-menu">
                <button
                  v-for="s in sortOptions" :key="s.id"
                  type="button"
                  class="albums-sort-item"
                  data-test="albums-sort-item"
                  :data-sort-id="s.id"
                  :data-active="s.id === sort"
                  @click="pickSort(s)"
                >
                  <span class="sort-check">{{ s.id === sort ? '✓' : '' }}</span>
                  <span class="sort-text">
                    <span class="lbl">{{ s.label }}</span>
                    <span class="hint">{{ s.hint }}</span>
                  </span>
                </button>
              </div>
            </div>
            <button type="button" class="bar-btn btn-primary" data-test="albums-new-btn" @click="openCreate">
              {{ t('photosAlbumNew') }}
            </button>
          </div>
        </div>

        <div v-if="isEmpty" class="empty-state" data-test="albums-empty">
          <div class="empty-state-title">{{ t('photosAlbumsEmptyTitle') }}</div>
          <div class="empty-state-desc">{{ t('photosAlbumsEmptyHint') }}</div>
        </div>

        <div class="album-grid scroll">
          <div class="album-create" data-test="album-create-tile" @click="openCreate">
            <div class="plus">+</div>
            <div class="album-create-label">{{ t('photosAlbumNew') }}</div>
            <div class="album-create-hint">{{ t('photosAlbumNewHint') }}</div>
          </div>
          <div
            v-for="view in views" :key="view.id"
            class="album-card"
            data-test="album-card"
            :data-id="view.id"
            @click="openCard(view)"
          >
            <div class="album-cover">
              <img v-if="coverUrl(view)" :src="coverUrl(view)" :alt="view.title">
              <div v-else class="album-cover-fallback" data-test="album-cover-fallback">
                <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" class="album-cover-icon"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10.5" r="1.5"/><path d="M21 15l-5-5L5 19"/></svg>
              </div>
            </div>
            <div class="album-title">{{ view.title }}</div>
            <div class="album-meta">
              <span>{{ t('photosItemsCount', { count: view.count }) }}</span>
              <template v-if="view.dateRange">
                <span class="sep"></span>
                <span>{{ view.dateRange }}</span>
              </template>
            </div>
          </div>
        </div>
      </main>
    </div>
  </AreaShell>

  <div
    v-if="createOpen"
    class="albums-modal-scrim"
    data-test="albums-create-modal"
    @click.self="closeCreate"
  >
    <div class="albums-modal">
      <div class="albums-modal-head">
        <div class="albums-modal-head-text">
          <div class="albums-modal-title">{{ t('photosAlbumCreateTitle') }}</div>
          <div class="albums-modal-sub">{{ t('photosAlbumCreateSub') }}</div>
        </div>
        <button type="button" class="albums-modal-close" :aria-label="t('photosCancel')" @click="closeCreate">&#215;</button>
      </div>

      <label class="albums-modal-label">{{ t('photosAlbumNameLabel') }}</label>
      <input
        ref="newAlbumInputRef"
        v-model="newAlbumTitle"
        :placeholder="t('photosAlbumNamePlaceholder')"
        class="albums-modal-input"
        data-test="albums-name-input"
        @keydown.enter="confirmCreate"
      >

      <label class="albums-modal-label">{{ t('photosAlbumFillLabel') }}</label>
      <div class="albums-source-list">
        <button
          v-for="s in sourceOptions" :key="s.id"
          type="button"
          class="albums-source-item"
          :data-active="newAlbumSource === s.id"
          :data-test="'source-' + s.id"
          @click="newAlbumSource = s.id"
        >
          <div class="radio" :data-active="newAlbumSource === s.id"><div v-if="newAlbumSource === s.id" class="dot"></div></div>
          <div class="src-text">
            <div class="lbl">{{ s.label }}</div>
            <div class="hint">{{ s.hint }}</div>
          </div>
        </button>
      </div>

      <div class="albums-modal-foot">
        <button type="button" class="albums-btn-ghost" @click="closeCreate">{{ t('photosCancel') }}</button>
        <button
          type="button"
          class="albums-btn-cta"
          data-test="albums-confirm-create"
          :disabled="!newAlbumTitle.trim() || creating"
          @click="confirmCreate"
        >
          {{ creating ? t('photosAlbumCreating') : t('photosAlbumCreate') }}
        </button>
      </div>
    </div>
  </div>

  <AlbumLibraryPicker
    :open="pickerOpen"
    :album-id="pickerAlbumId"
    :album-name="pickerAlbumName"
    @update:open="pickerOpen = $event"
    @added="onPickerAdded"
  />
</template>

<style scoped>
.photos-layout { display: flex; gap: 16px; align-items: flex-start; min-height: 100%; }
.photos-main { position: relative; flex: 1 1 auto; min-width: 0; align-self: stretch; display: flex; flex-direction: column; min-height: 0; }

.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; padding: 60px 20px 20px; color: var(--fg-muted); text-align: center; }
.empty-state-title { font-size: 16px; font-weight: 600; color: var(--fg); }
.empty-state-desc { font-size: 13px; }

/* ── Banner ── */
.albums-banner { display: flex; align-items: flex-end; gap: 18px; padding: 4px 4px 16px; flex-wrap: wrap; }
.albums-banner h1 { font-size: 22px; font-weight: 600; letter-spacing: -0.01em; margin: 0; color: var(--fg); }
.albums-sub { color: var(--fg-muted); font-size: 12.5px; margin-top: 4px; }
.albums-actions { margin-left: auto; display: inline-flex; gap: 8px; align-items: center; }
.albums-sort-wrap { position: relative; }

.albums-sort-menu {
  position: absolute; top: calc(100% + 6px); right: 0; min-width: 230px; z-index: 20;
  background: var(--popup-bg); border: 1px solid var(--card-border); border-radius: 12px;
  padding: 4px; box-shadow: var(--card-shadow-hi);
}
.albums-sort-item {
  display: flex; width: 100%; align-items: flex-start; gap: 8px; padding: 8px 10px;
  background: transparent; border: 0; border-radius: 8px; color: var(--fg); font: inherit;
  font-size: 12.5px; cursor: pointer; text-align: left;
}
.albums-sort-item:hover { background: var(--chip-bg-hi); }
.albums-sort-item[data-active="true"] { background: var(--accent-soft); }
.sort-check { width: 14px; flex: 0 0 auto; color: var(--accent-text); }
.sort-text { flex: 1 1 auto; display: flex; flex-direction: column; }
.sort-text .lbl { font-weight: 500; }
.sort-text .hint { font-size: 11px; color: var(--fg-muted); margin-top: 2px; }

/* ── Grid ── */
.album-grid {
  flex: 1 1 auto; min-height: 0; overflow-y: auto;
  display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 18px;
  padding: 4px 4px 20px;
}
.album-create {
  aspect-ratio: 4 / 5; border-radius: 16px; border: 1.5px dashed var(--chip-border);
  background: var(--chip-bg); display: flex; flex-direction: column; align-items: center;
  justify-content: center; gap: 10px; color: var(--fg-muted); cursor: pointer;
  transition: border-color 0.18s ease, color 0.18s ease, background 0.18s ease;
}
.album-create:hover { border-color: var(--accent); color: var(--accent-text); background: var(--accent-soft); }
.album-create .plus { width: 40px; height: 40px; border-radius: 50%; background: var(--chip-bg-hi); display: flex; align-items: center; justify-content: center; font-size: 20px; }
.album-create-label { font-size: 12.5px; font-weight: 500; }
.album-create-hint { font-size: 11px; opacity: 0.75; }

.album-card { cursor: pointer; display: flex; flex-direction: column; gap: 8px; border-radius: 16px; padding: 4px; transition: transform 0.18s ease; }
.album-card:hover { transform: translateY(-2px); }
.album-cover { position: relative; aspect-ratio: 4 / 5; border-radius: 16px; overflow: hidden; background: var(--chip-bg); box-shadow: var(--card-shadow-hi); }
.album-cover img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform 0.5s ease; }
.album-card:hover .album-cover img { transform: scale(1.04); }
/* Vue2 起色是写死的深紫十六进制字面量 → 改用 color-mix(accent 35% + panel-bg),终色沿用
   --accent(brief 指定的替换方案,不新增 token)。 */
.album-cover-fallback {
  position: absolute; inset: 0;
  background: linear-gradient(135deg, color-mix(in srgb, var(--accent) 35%, var(--panel-bg)), var(--accent));
  display: flex; align-items: center; justify-content: center;
}
/* Vue2 图标色是写死的半透明白色字面量(叠在彩色渐变上的语义前景)——改用 --on-accent(atop
   accent 填充的可读前景色 token)+ opacity 弱化,而非写死颜色字面量。 */
.album-cover-icon { color: var(--on-accent); opacity: 0.7; }
.album-title { font-size: 14px; font-weight: 600; color: var(--fg); letter-spacing: -0.01em; padding: 0 4px; }
.album-meta { font-size: 11.5px; color: var(--fg-muted); padding: 0 4px; display: flex; align-items: center; gap: 6px; font-variant-numeric: tabular-nums; }
.album-meta .sep { width: 3px; height: 3px; border-radius: 50%; background: var(--fg-muted); opacity: 0.6; }

/* ── New album modal ── */
.albums-modal-scrim {
  position: fixed; inset: 0; z-index: 220; background: var(--overlay-bg); backdrop-filter: var(--overlay-blur);
  display: flex; align-items: center; justify-content: center; padding: 32px 20px;
}
/* P2/P3 血泪(brief 明确点名):模态底色须用 --popup-bg,不用 --card-bg(深色主题下
   --card-bg 近透明,叠在暗底上会看穿)。 */
.albums-modal {
  width: min(440px, 100%); background: var(--popup-bg); border: 1px solid var(--card-border);
  border-radius: 16px; box-shadow: var(--card-shadow-hi); padding: 20px 22px 18px;
}
.albums-modal-head { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 14px; }
.albums-modal-head-text { flex: 1 1 auto; min-width: 0; }
.albums-modal-title { font-size: 16px; font-weight: 600; color: var(--fg); }
.albums-modal-sub { font-size: 12px; color: var(--fg-muted); margin-top: 2px; }
.albums-modal-close {
  flex: 0 0 auto; width: 24px; height: 24px; border-radius: 50%; border: 0; background: transparent;
  color: var(--fg-muted); font-size: 15px; line-height: 1; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
}
.albums-modal-close:hover { background: var(--chip-bg-hi); color: var(--fg); }
.albums-modal-label { display: block; font-size: 12px; font-weight: 500; color: var(--fg-muted); margin: 12px 0 6px; }
.albums-modal-input {
  width: 100%; height: 38px; padding: 0 12px; border-radius: 9px; border: 1px solid var(--chip-border);
  background: var(--chip-bg); color: var(--fg); font: inherit; font-size: 13.5px;
}
.albums-modal-input:focus { outline: 2px solid var(--accent); outline-offset: -1px; }

.albums-source-list { display: flex; flex-direction: column; gap: 6px; }
.albums-source-item {
  display: flex; align-items: flex-start; gap: 10px; padding: 10px 12px; border-radius: 10px;
  border: 1px solid var(--chip-border); background: var(--chip-bg); color: var(--fg); font: inherit;
  text-align: left; cursor: pointer;
}
.albums-source-item:hover { background: var(--chip-bg-hi); }
.albums-source-item[data-active="true"] { border-color: var(--accent); background: var(--accent-soft); }
.radio { width: 16px; height: 16px; border-radius: 50%; border: 1.5px solid var(--chip-border); flex: 0 0 auto; margin-top: 2px; display: flex; align-items: center; justify-content: center; }
.radio[data-active="true"] { border-color: var(--accent); }
.radio .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--accent); }
.src-text { flex: 1 1 auto; min-width: 0; }
.src-text .lbl { font-size: 13px; font-weight: 500; }
.src-text .hint { font-size: 11px; color: var(--fg-muted); margin-top: 2px; }

.albums-modal-foot { display: flex; gap: 10px; justify-content: flex-end; margin-top: 16px; }
.albums-btn-ghost { padding: 8px 16px; border-radius: 9px; border: 1px solid var(--chip-border); background: var(--chip-bg); color: var(--fg); font: inherit; font-size: 13px; cursor: pointer; }
.albums-btn-ghost:hover { background: var(--chip-bg-hi); }
.albums-btn-cta { padding: 8px 18px; border-radius: 9px; border: 0; background: var(--accent); color: var(--on-accent); font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; }
.albums-btn-cta:disabled { opacity: 0.5; cursor: not-allowed; }

/* ≤768px:侧栏已收抽屉,布局单列 */
@media (max-width: 768px) {
  .photos-layout { gap: 0; }
}
</style>
