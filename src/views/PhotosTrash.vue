<script setup lang="ts">
// Task 9 (SP7-P3): 回收站视图——自绘分桶网格(不复用 PhotosGrid:回收站数据是精简 TrashPhoto,
// 且带倒计时角标这一网格没有的独有 UI)。壳照 Photos.vue/PhotosFavorites.vue 的
// AreaShell/photos-layout/photos-main 复制(见 task-9-brief.md)。路由注册留给 T10。
//
// P3 铁律:点瓦片(含空白处)= 切换选择,不开灯箱——回收站是"待恢复/待永久删除"的精简对象,
// 灯箱的收藏★/删除🗑按钮语义在这里不成立(删除=永久删除?恢复?不明确),故整块跳过灯箱
// 接线,记入台账(见 task-9-report.md)。
//
// 选择态 selected 用 Set<string|number>,按 id 值比较(不用对象引用)——Vue3 的 ref() 对
// Set/Map 有专门的响应式劫持(collection handlers),直接 .add()/.delete() 即可触发视图更新,
// 不需要 Vue2 "new Set() 整个替换" 的 workaround。
import '../photos/styles/vue2-parity'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import AreaShell from '../components/shell/AreaShell.vue'
import { usePhotosTheme } from '../photos/composables/usePhotosTheme'
import PhotosSidebar from '../photos/components/PhotosSidebar.vue'
import { usePhotosTrash } from '../photos/stores/trash'
import { useToast } from '../stores/toast'
import type { TrashPhoto } from '../photos/util/trashAssetToPhoto'

const { t } = useI18n()
const { themeClass } = usePhotosTheme()
const trash = usePhotosTrash()
const toast = useToast()

// 分桶常量,照 Vue2 PhotosTrashView.vue:126-131(4 桶,min/max/tone)。tone 只是语义标签,
// 具体颜色在样式块里映射到既有 token(urgent→--remove-fg 危险红,warn→--dem-fg 警示琥珀,
// normal→--accent 常规蓝),不新增 token。
type BucketTone = 'urgent' | 'warn' | 'normal'
interface BucketDef { id: string; titleKey: string; descKey: string; min: number; max: number; tone: BucketTone }

const BUCKETS: BucketDef[] = [
  { id: 'urgent', titleKey: 'photosTrashBucketUrgent', descKey: 'photosTrashBucketUrgentDesc', min: 1, max: 7, tone: 'urgent' },
  { id: 'soon', titleKey: 'photosTrashBucketSoon', descKey: 'photosTrashBucketSoonDesc', min: 8, max: 14, tone: 'warn' },
  { id: 'later', titleKey: 'photosTrashBucketLater', descKey: 'photosTrashBucketLaterDesc', min: 15, max: 21, tone: 'normal' },
  { id: 'fresh', titleKey: 'photosTrashBucketFresh', descKey: 'photosTrashBucketFreshDesc', min: 22, max: Infinity, tone: 'normal' },
]

const filter = ref<'all' | 'photo' | 'video'>('all')
const sort = ref<'daysleft' | 'recent'>('daysleft')
const selected = ref<Set<string | number>>(new Set())

interface ConfirmState { title: string; body: string; ctaLabel: string; danger: boolean; onConfirm: () => void | Promise<void> }
const confirm = ref<ConfirmState | null>(null)

// 不进 reactive state(与 Vue2 this._undoIds 同理:纯粹的"待撤销 id 列表"暂存,无需驱动渲染)。
let undoIds: Array<string | number> | null = null

const isEmpty = computed(() => trash.loaded && trash.items.length === 0)
const photoCount = computed(() => trash.items.filter((p) => !p.isVideo).length)
const videoCount = computed(() => trash.items.filter((p) => p.isVideo).length)
const totalSize = computed(() => trash.items.reduce((s, p) => s + (Number(p.sizeMb) || 0), 0).toFixed(1))

const filtered = computed(() => {
  if (filter.value === 'photo') return trash.items.filter((p) => !p.isVideo)
  if (filter.value === 'video') return trash.items.filter((p) => p.isVideo)
  return trash.items
})

const sorted = computed(() => {
  const arr = [...filtered.value]
  if (sort.value === 'daysleft') arr.sort((a, b) => a.daysLeft - b.daysLeft)
  else arr.sort((a, b) => b.daysLeft - a.daysLeft)
  return arr
})

const bucketed = computed(() =>
  BUCKETS.map((b) => ({
    ...b,
    title: t(b.titleKey),
    desc: t(b.descKey),
    photos: sorted.value.filter((p) => p.daysLeft >= b.min && p.daysLeft <= b.max),
  })).filter((b) => b.photos.length > 0),
)

function thumbUrl(id: string | number): string {
  return service.photos.thumbnailUrl(id, 'small')
}

function isSelected(id: string | number): boolean {
  return selected.value.has(id)
}
function toggleSelect(id: string | number) {
  if (selected.value.has(id)) selected.value.delete(id)
  else selected.value.add(id)
}
function clearSelection() { selected.value.clear() }
function onTileClick(p: TrashPhoto) { toggleSelect(p.id) }

function askConfirm(cfg: ConfirmState) { confirm.value = cfg }
function closeConfirm() { confirm.value = null }
function runConfirm() {
  const c = confirm.value
  confirm.value = null
  if (c) void c.onConfirm()
}
function onKeydown(e: KeyboardEvent) {
  if (confirm.value && e.key === 'Escape') { e.preventDefault(); closeConfirm() }
}

async function onUndo() {
  const ids = undoIds
  undoIds = null
  if (!ids || !ids.length) return
  await trash.undoRestore(ids)
}

// Task 12 fix round 2 (Important 1 & 2, coordinator review): service.photos.emptyTrash() and
// restoreAllTrash() both act on the ENTIRE trash server-side regardless of what has loaded
// client-side. With more than TRASH_PAGE_SIZE items — the exact case Task 12 exists for —
// the confirm dialogs understated what would actually happen, and restore-all's Undo
// silently reverted only the loaded subset while the rest stayed restored with no path back.
// Page in everything before either bulk action decides what to say / which ids the (optional)
// undo covers — same shape as loadRemainingFavoritesForSave in PhotosFavorites.vue: progress
// is detected by list-length growth, so a stuck page (e.g. a network failure mid-page) is
// caught without the store exposing its private offset.
async function loadRemainingTrashForBulkAction(): Promise<void> {
  while (!trash.trashExhausted) {
    const before = trash.items.length
    await trash.loadMoreTrash()
    const after = trash.items.length
    if (after === before) return // stuck: the page failed, stop spinning
  }
}

// Guards both hero actions (not the store's own loadMoreTrash ownership) so the button isn't
// a dead click during the paging-in-the-rest step above, and so the two bulk actions can't
// race each other.
const preparingBulkAction = ref(false)

// 恢复选中:Vue2 无二次确认,直接执行(restoreSelected :190)——本视图同样跳过 confirm。
async function restoreSelected() {
  const ids = [...selected.value]
  if (!ids.length) return
  clearSelection()
  try {
    await trash.restore(ids)
    undoIds = ids
    toast.show(t('photosTrashRestoredToast', { count: ids.length }), 4500, {
      label: t('photosTrashUndo'),
      onClick: onUndo,
    })
  } catch {
    toast.show(t('photosTrashRestoreFailed'), 4500)
  }
}

function deleteSelected() {
  const ids = [...selected.value]
  const count = ids.length
  if (!count) return
  const size = ids
    .reduce<number>((s, id) => {
      const p = trash.items.find((x) => x.id === id)
      return s + (p ? Number(p.sizeMb) || 0 : 0)
    }, 0)
    .toFixed(1)
  askConfirm({
    title: t('photosTrashDeleteSelTitle', { count }),
    body: t('photosTrashDeleteSelBody'),
    ctaLabel: t('photosTrashDeleteForever'),
    danger: true,
    onConfirm: async () => {
      clearSelection()
      undoIds = null
      try {
        await trash.purge(ids)
        toast.show(t('photosTrashPurgedToast', { count, size }), 4500)
      } catch {
        toast.show(t('photosTrashDeleteFailed'), 4500)
      }
    },
  })
}

async function restoreAll() {
  if (!trash.items.length || preparingBulkAction.value) return
  preparingBulkAction.value = true
  try {
    if (!trash.trashExhausted) await loadRemainingTrashForBulkAction()
    // Captured AFTER the paging attempt (not before), so the confirm title, the ids handed to
    // Undo, and the success toast all agree with what actually happened rather than with the
    // state at click time.
    const exact = trash.trashExhausted
    const count = trash.items.length
    askConfirm({
      // Task 12 fix round 2: when paging got stuck we still do not know the true count, so
      // the title must not quote one — reuse the bare action-label key already on the hero
      // button (no fitting count-less title existed, so this avoids inventing new copy).
      title: exact ? t('photosTrashRestoreAllTitle', { count }) : t('photosTrashRestoreAll'),
      body: t('photosTrashRestoreAllBody'),
      ctaLabel: t('photosTrashRestoreAll'),
      danger: false,
      onConfirm: async () => {
        const ids = trash.items.map((p) => p.id)
        try {
          await trash.restoreAll()
          if (exact) {
            undoIds = ids
            toast.show(t('photosTrashRestoredToast', { count }), 4500, {
              label: t('photosTrashUndo'),
              onClick: onUndo,
            })
          } else {
            // Task 12 fix round 2 (Important 2): restoreAllTrash() restores EVERYTHING
            // server-side regardless of what loaded client-side. If paging got stuck, `ids`
            // here is only a subset — offering Undo would let the user silently revert part
            // of what was restored while the rest stays restored with no path back. Omit the
            // Undo action entirely rather than offer one known to be partial.
            undoIds = null
            toast.show(t('photosTrashRestoredToast', { count }), 4500)
          }
        } catch {
          toast.show(t('photosTrashRestoreFailed'), 4500)
        }
      },
    })
  } finally {
    preparingBulkAction.value = false
  }
}

async function emptyTrash() {
  if (!trash.items.length || preparingBulkAction.value) return
  preparingBulkAction.value = true
  try {
    if (!trash.trashExhausted) await loadRemainingTrashForBulkAction()
    // Captured AFTER the paging attempt (not before) — this is what keeps the confirm body
    // and the toast in agreement with what actually happened.
    const exact = trash.trashExhausted
    const count = trash.items.length
    const size = totalSize.value
    askConfirm({
      // Task 12 fix round 2: same reasoning as restoreAll's title above.
      title: exact ? t('photosTrashEmptyTitle2', { count }) : t('photosTrashEmpty'),
      body: exact ? t('photosTrashEmptyBody', { size }) : t('photosTrashEmptyBodyPartial'),
      ctaLabel: t('photosTrashEmpty'),
      danger: true,
      onConfirm: async () => {
        undoIds = null
        try {
          await trash.empty()
          toast.show(exact ? t('photosTrashEmptiedToast', { size }) : t('photosTrashEmptiedToastPartial'), 4500)
        } catch {
          toast.show(t('photosTrashEmptyFailed'), 4500)
        }
      },
    })
  } finally {
    preparingBulkAction.value = false
  }
}

onMounted(() => {
  void trash.fetchRetention()
  void trash.fetchTrash()
  document.addEventListener('keydown', onKeydown)
})
onUnmounted(() => document.removeEventListener('keydown', onKeydown))
</script>

<template>
  <AreaShell :title="t('photosTrashTitle')">
    <div class="photos-layout photos-root" :class="themeClass">
      <PhotosSidebar />
      <main class="photos-main">
        <div class="trash-hero">
          <div class="trash-hero-info">
            <h1 class="trash-hero-title">{{ t('photosTrashTitle') }}</h1>
            <div class="trash-hero-sub">
              <b>{{ trash.items.length }}</b> {{ t('photosTrashItems') }} ·
              {{ t('photosCountSummary', { photos: photoCount, videos: videoCount }) }} ·
              <b>{{ totalSize }} MB</b> {{ t('photosTrashCanFree') }}
              <!-- Task 12 (SP15-P3): totalSize sums sizeMb over trash.items, which is only the
                   pages fetched so far while pagination is still catching up — say so out loud
                   instead of silently under-reporting (same pattern as PhotosFavorites.vue). -->
              <span v-if="!trash.trashExhausted" data-test="trash-loaded-hint">
                · {{ t('photosLoadedSubsetHint', { n: trash.items.length }) }}
              </span>
            </div>
          </div>
          <div class="trash-hero-actions">
            <button
              type="button" class="bar-btn" data-test="trash-restore-all"
              :disabled="!trash.items.length || preparingBulkAction" @click="restoreAll"
            >{{ t('photosTrashRestoreAll') }}</button>
            <button
              type="button" class="bar-btn trash-btn-danger" data-test="trash-empty-btn"
              :disabled="!trash.items.length || preparingBulkAction" @click="emptyTrash"
            >{{ t('photosTrashEmpty') }}</button>
          </div>
        </div>

        <div v-if="isEmpty" class="empty-state" data-test="trash-empty">
          <div class="empty-state-title">{{ t('photosTrashEmptyTitle') }}</div>
          <div class="empty-state-desc">{{ t('photosTrashEmptyHint', { days: trash.retentionDays }) }}</div>
        </div>

        <template v-else>
          <div v-if="selected.size > 0" class="trash-bulk-bar">
            <span class="bulk-count">{{ t('photosTrashSelectedCount', { count: selected.size }) }}</span>
            <span class="bulk-spacer"></span>
            <button type="button" class="sel-btn" data-test="trash-bulk-restore" @click="restoreSelected">
              {{ t('photosTrashRestore') }}
            </button>
            <button type="button" class="sel-btn danger" data-test="trash-bulk-delete" @click="deleteSelected">
              {{ t('photosTrashDeleteForever') }}
            </button>
            <button type="button" class="sel-btn" data-test="trash-bulk-cancel" @click="clearSelection">
              {{ t('photosCancel') }}
            </button>
          </div>

          <div class="trash-filters">
            <button type="button" class="trash-chip" :data-active="filter === 'all'" @click="filter = 'all'">
              {{ t('photosTabAll') }} <span class="ct">{{ trash.items.length }}</span>
            </button>
            <button type="button" class="trash-chip" :data-active="filter === 'photo'" @click="filter = 'photo'">
              {{ t('photosTabPhotos') }} <span class="ct">{{ photoCount }}</span>
            </button>
            <button type="button" class="trash-chip" :data-active="filter === 'video'" @click="filter = 'video'">
              {{ t('photosTabVideos') }} <span class="ct">{{ videoCount }}</span>
            </button>
            <div class="trash-filters-spacer"></div>
            <div class="trash-sort">
              <button type="button" :data-active="sort === 'daysleft'" @click="sort = 'daysleft'">
                {{ t('photosTrashSortDaysLeft') }}
              </button>
              <button type="button" :data-active="sort === 'recent'" @click="sort = 'recent'">
                {{ t('photosTrashSortRecent') }}
              </button>
            </div>
          </div>

          <div class="trash-scroll scroll">
            <div v-for="b in bucketed" :key="b.id" class="trash-bucket">
              <div class="trash-bucket-head">
                <span class="trash-bucket-dot" :data-tone="b.tone"></span>
                <span class="trash-bucket-title">{{ b.title }}</span>
                <span class="trash-bucket-sub">{{ t('photosItemsCount', { count: b.photos.length }) }} · {{ b.desc }}</span>
              </div>
              <div class="trash-grid">
                <div
                  v-for="p in b.photos" :key="p.id"
                  class="trash-tile" :data-selected="isSelected(p.id)"
                  @click="onTileClick(p)"
                >
                  <img :src="thumbUrl(p.id)" alt="" loading="lazy">
                  <div class="trash-tile-overlay"></div>
                  <div
                    class="trash-tile-countdown"
                    :data-urgent="p.daysLeft <= 7" :data-warn="p.daysLeft > 7 && p.daysLeft <= 14"
                  >{{ t('photosTrashDaysLeft', { days: p.daysLeft }) }}</div>
                  <div
                    class="trash-tile-select" :data-selected="isSelected(p.id)"
                    @click.stop="toggleSelect(p.id)"
                  >
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12l5 5L20 6" /></svg>
                  </div>
                  <div class="trash-tile-meta">
                    <span>{{ t('photosTrashFrom', { source: p.from }) }}{{ p.deletedAt ? ' · ' + p.deletedAt : '' }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Task 12 (SP15-P3): the backend caps a single request at 500 rows now
               (NimoOS-Photos#54), so anything past the first page only shows up once clicked. -->
          <div v-if="!trash.trashExhausted" class="trash-load-more">
            <button
              type="button"
              class="bar-btn"
              data-test="trash-load-more"
              :disabled="trash.loadingMore"
              @click="trash.loadMoreTrash()"
            >{{ t('photosLoadMore') }}</button>
          </div>
        </template>
      </main>
    </div>
  </AreaShell>

  <transition name="trash-modal">
    <div v-if="confirm" class="trash-modal-scrim" @click.self="closeConfirm">
      <div class="trash-modal" :data-danger="confirm.danger">
        <div class="trash-modal-title">{{ confirm.title }}</div>
        <div class="trash-modal-body">{{ confirm.body }}</div>
        <div class="trash-modal-foot">
          <button type="button" class="trash-btn-ghost" @click="closeConfirm">{{ t('photosCancel') }}</button>
          <button type="button" class="trash-btn-cta" :class="{ danger: confirm.danger }" @click="runConfirm">
            {{ confirm.ctaLabel }}
          </button>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
/* Fix round 1 (controller-adjudicated, task-3-report.md Disclosure 1): this page still
   uses the old flex-row `.photos-layout` shell (its own re-skin task hasn't landed yet), but
   its root now carries `.photos-root` so the shared PhotosSidebar's Vue2 `.sidebar` root gets
   the parity look. Parity scss deliberately sets no width on `.sidebar` itself (real
   pixel-parity width comes from the `.app` CSS Grid column Task 3 gave Photos.vue) — pin it
   here so the sidebar doesn't collapse to its shrink-to-fit content width in this page's
   flex row. Transitional: drop this rule once this page gets its own `.app` grid re-skin. */
.sidebar { flex: 0 0 var(--sidebar-w); align-self: stretch; overflow-y: auto; }

/* height(不是 min-height):这一屏封顶,只有内层滚动容器滚 —— 同源修复,理由与 Vue2
   出处见 src/views/Photos.vue 同一规则处的注释。 */
.photos-layout { display: flex; gap: 16px; align-items: flex-start; height: 100%; }
.photos-main { position: relative; flex: 1 1 auto; min-width: 0; align-self: stretch; display: flex; flex-direction: column; min-height: 0; }

.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; padding: 80px 20px; color: var(--fg-muted); text-align: center; }
.empty-state-title { font-size: 16px; font-weight: 600; color: var(--fg); }
.empty-state-desc { font-size: 13px; max-width: 340px; line-height: 1.5; }

/* ── Hero ── */
.trash-hero { display: flex; align-items: center; gap: 16px; padding: 4px 4px 14px; flex-wrap: wrap; }
.trash-hero-info { flex: 1 1 auto; min-width: 200px; }
.trash-hero-title { font-size: 20px; font-weight: 600; letter-spacing: -0.01em; margin: 0 0 4px; color: var(--fg); }
.trash-hero-sub { font-size: 12.5px; color: var(--fg-muted); }
.trash-hero-sub b { color: var(--fg); font-weight: 600; }
/* Task 12 (SP15-P3): reuses the same muted-text treatment already used throughout this line
   (--fg-muted, inherited 12.5px) — no new token, just a conditional trailing span. */
.trash-hero-sub [data-test="trash-loaded-hint"] { color: var(--fg-muted); }
.trash-hero-actions { display: flex; gap: 8px; align-items: center; flex: 0 0 auto; }
.trash-hero-actions .bar-btn:disabled { opacity: 0.45; cursor: not-allowed; pointer-events: none; }
/* .trash-btn-danger 复用 .bar-btn 玻璃胶囊形态,仅改前景色为既有危险色 token(浅色主题=深红,
   深色=浅红,随主题自动翻转——与 ContextMenu.vue .ui-ctx-item.danger 同一约定)。 */
.trash-hero-actions .trash-btn-danger { color: var(--remove-fg, #ff8a8a); }
.trash-hero-actions .trash-btn-danger:hover:not(:disabled) {
  background: color-mix(in srgb, var(--remove-fg, #ff5d5d) 16%, transparent);
}

/* ── Bulk selection bar(同 PhotosSelectionToolbar/SelectionToolbar 的 .sel-btn 语言,
     多一个"恢复"出口,故不直接复用组件而是内联) ── */
.trash-bulk-bar { display: flex; align-items: center; gap: 12px; padding: 8px 12px; margin-bottom: 10px; border-radius: 12px; background: var(--chip-bg, rgba(255,255,255,0.06)); color: var(--fg); font-size: 13px; }
.bulk-count { flex: 0 0 auto; }
.bulk-spacer { flex: 1 1 auto; }
.sel-btn { padding: 4px 12px; border-radius: 999px; border: 1px solid var(--chip-border, rgba(255,255,255,0.12)); background: transparent; color: var(--fg); cursor: pointer; font-size: 12px; }
.sel-btn:hover { background: var(--chip-bg-hi, rgba(255,255,255,0.14)); }
.sel-btn.danger { color: var(--remove-fg, #ff8a8a); border-color: color-mix(in srgb, var(--remove-fg, #ff5d5d) 45%, transparent); }
.sel-btn.danger:hover { background: color-mix(in srgb, var(--remove-fg, #ff5d5d) 22%, transparent); }

/* ── Filters / sort ── */
.trash-filters { display: flex; align-items: center; gap: 6px; padding: 8px 4px; flex-wrap: wrap; }
.trash-filters-spacer { flex: 1 1 auto; }
.trash-chip {
  display: inline-flex; align-items: center; gap: 5px; height: 26px; padding: 0 10px;
  border-radius: 999px; background: var(--chip-bg); border: 1px solid var(--chip-border);
  color: var(--fg-muted); font: inherit; font-size: 11.5px; cursor: pointer;
}
.trash-chip:hover { background: var(--chip-bg-hi); color: var(--fg); }
.trash-chip[data-active="true"] { background: var(--accent-soft); border-color: var(--accent-soft-bd); color: var(--accent-text); }
.trash-chip .ct { font-variant-numeric: tabular-nums; opacity: 0.75; font-size: 10.5px; }
.trash-sort { display: inline-flex; align-items: center; gap: 2px; padding: 2px; border-radius: 999px; background: var(--chip-bg); }
.trash-sort button { height: 22px; padding: 0 10px; border-radius: 999px; border: 0; background: transparent; color: var(--fg-muted); font: inherit; font-size: 11.5px; cursor: pointer; }
.trash-sort button[data-active="true"] { background: var(--chip-bg-hi); color: var(--fg); }

/* Task 12 (SP15-P3): same secondary-button treatment as .fav-load-more in
   PhotosFavorites.vue — reuses .bar-btn, no new token. */
.trash-load-more { display: flex; justify-content: center; padding: 16px 0; }
.trash-load-more .bar-btn:disabled { opacity: 0.6; cursor: not-allowed; }

/* ── Bucketed grid ── */
.trash-scroll { flex: 1 1 auto; min-height: 0; overflow-y: auto; }
.trash-bucket { margin-top: 20px; }
.trash-bucket:first-child { margin-top: 0; }
.trash-bucket-head { display: flex; align-items: baseline; gap: 10px; padding-bottom: 10px; border-bottom: 1px solid var(--divider); }
.trash-bucket-dot { width: 8px; height: 8px; border-radius: 999px; background: var(--accent); }
/* 三档倒计时严重度沿用既有语义 token,不新增 token(brief 明确允许复用):
   urgent=危险红(--remove-fg,已用于删除/危险按钮全库一致)、warn=警示琥珀(--dem-fg,已用于
   SearchDialog "降权" 语义与 UploadPanel 警告态)、normal=常规强调蓝(--accent)。 */
.trash-bucket-dot[data-tone="urgent"] { background: var(--remove-fg); }
.trash-bucket-dot[data-tone="warn"] { background: var(--dem-fg); }
.trash-bucket-title { font-size: 13.5px; font-weight: 600; color: var(--fg); }
.trash-bucket-sub { font-size: 11.5px; color: var(--fg-muted); }

.trash-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 4px; margin-top: 14px; }

.trash-tile { position: relative; aspect-ratio: 1; overflow: hidden; border-radius: 8px; background: var(--chip-bg); cursor: pointer; }
.trash-tile img { width: 100%; height: 100%; object-fit: cover; display: block; opacity: 0.82; }
.trash-tile[data-selected="true"] { outline: 3px solid var(--accent); outline-offset: -3px; }
/* theme-exception: 缩略图上的固定黑色渐变遮罩(衬托下方 meta 文字可读性),同 .lib-tile-overlay/
   PhotosGrid.vue .tile-fav 惯例——媒体内容颜色不可控,遮罩必须恒为黑,不随主题翻转。 */
.trash-tile-overlay { position: absolute; inset: 0; background: linear-gradient(180deg, transparent 55%, rgba(0,0,0,0.5) 100%); opacity: 0; transition: opacity 0.15s; pointer-events: none; }
.trash-tile:hover .trash-tile-overlay { opacity: 1; }

.trash-tile-countdown {
  position: absolute; left: 6px; bottom: 6px; z-index: 2;
  display: flex; align-items: center; height: 20px; padding: 0 8px; border-radius: 999px;
  background: var(--overlay-bg); color: #fff; /* theme-exception: 叠在缩略图上的固定深底徽标,同 .tile-vid 惯例,皮肤无关需恒定对比度 */
  font-size: 10.5px; font-weight: 500; font-variant-numeric: tabular-nums;
}
.trash-tile-countdown[data-urgent="true"] { background: color-mix(in srgb, var(--remove-fg, #ff5d5d) 78%, black); }
.trash-tile-countdown[data-warn="true"] { background: color-mix(in srgb, var(--dem-fg, #f5a623) 70%, black); }

.trash-tile-select {
  position: absolute; top: 6px; right: 6px; z-index: 3;
  width: 22px; height: 22px; border-radius: 50%;
  background: var(--overlay-bg); border: 1.5px solid rgba(255, 255, 255, 0.7); /* theme-exception: 缩略图上的固定描边,同 .tile-fav 惯例,需在任意图片底色上保持可见 */
  display: inline-flex; align-items: center; justify-content: center; color: transparent; cursor: pointer;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}
.trash-tile-select[data-selected="true"] { background: var(--accent); border-color: var(--accent); color: var(--on-accent, #fff); }

.trash-tile-meta {
  position: absolute; left: 8px; right: 8px; bottom: 30px; z-index: 2;
  opacity: 0; transition: opacity 0.15s; pointer-events: none;
  font-size: 10.5px; color: rgba(255,255,255,0.92); /* theme-exception: 叠在缩略图上的字幕文字,同 .lib-tile-place/.tile-vid 惯例,需在任意图片底色上保持可读 */
  text-shadow: 0 1px 2px rgba(0,0,0,0.5); /* theme-exception: 同上,配套阴影保证可读性,固定黑色不随主题翻转 */
}
.trash-tile:hover .trash-tile-meta { opacity: 1; }

/* ── Confirm modal ── */
.trash-modal-scrim {
  position: fixed; inset: 0; z-index: 220; background: var(--overlay-bg); backdrop-filter: var(--overlay-blur);
  display: flex; align-items: center; justify-content: center; padding: 40px 24px;
}
.trash-modal { width: 420px; max-width: 100%; background: var(--popup-bg); border: 1px solid var(--card-border); border-radius: 16px; box-shadow: var(--card-shadow-hi); padding: 24px 24px 20px; text-align: center; }
.trash-modal[data-danger="true"] { border-color: color-mix(in srgb, var(--remove-fg, #ff5d5d) 30%, transparent); }
.trash-modal-title { font-size: 18px; font-weight: 600; letter-spacing: -0.01em; margin-bottom: 8px; color: var(--fg); }
.trash-modal-body { font-size: 13px; color: var(--fg-muted); line-height: 1.5; margin-bottom: 20px; }
.trash-modal-foot { display: flex; gap: 8px; }
.trash-btn-ghost { flex: 1; height: 38px; border-radius: 9px; background: var(--chip-bg); border: 1px solid var(--chip-border); color: var(--fg); font: inherit; font-size: 13px; font-weight: 500; cursor: pointer; }
.trash-btn-ghost:hover { background: var(--chip-bg-hi); }
.trash-btn-cta {
  flex: 1.3; height: 38px; padding: 0 18px; border-radius: 9px; border: 0;
  color: #fff; /* theme-exception: 渐变胶囊按钮文字,背景恒为彩色渐变(--grad-a/--grad-b 或危险红渐变),两套主题下白字对比度都稳定——同 SearchDialog.vue .btn-primary/MediaViewer.vue .np-play 惯例 */
  font: inherit; font-size: 13px; font-weight: 600; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  background: linear-gradient(135deg, var(--grad-a), var(--grad-b));
  box-shadow: 0 6px 18px -3px var(--accent-soft-bd);
  transition: transform 0.12s, box-shadow 0.15s;
}
.trash-btn-cta:hover { transform: translateY(-1px); }
.trash-btn-cta.danger { background: linear-gradient(135deg, var(--remove-fg), var(--remove-bg)); }

.trash-modal-enter-active, .trash-modal-leave-active { transition: opacity 0.18s ease; }
.trash-modal-enter-active .trash-modal, .trash-modal-leave-active .trash-modal { transition: transform 0.22s var(--ease, ease), opacity 0.18s ease; }
.trash-modal-enter-from, .trash-modal-leave-to { opacity: 0; }
.trash-modal-enter-from .trash-modal, .trash-modal-leave-to .trash-modal { transform: translateY(8px) scale(0.97); opacity: 0; }

/* ≤768px:侧栏已收抽屉,布局单列 */
@media (max-width: 768px) {
  .photos-layout { gap: 0; }
  .trash-hero { padding: 4px 0 12px; }
}
</style>
