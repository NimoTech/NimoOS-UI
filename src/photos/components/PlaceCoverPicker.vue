<script setup lang="ts">
// P6b-T7: PlaceCoverPicker.vue —— 地点详情面板的"设置封面"全屏弹层(标签页/搜索/
// 8 列候选网格/分页/恢复默认)。逐段照 Vue2 NimoOS-UI
// src/views/Photos/PhotosPlacesView.vue:1253-1335(模板)、:296-312(watch,activeId
// 切换重置 coverTab/coverSearch/coverPage——该重置属于容器状态管理,归 T8)、
// :374-377(coverTabLabel 回落链)、:517-560(loadCoverCandidates/setCover/resetCover,
// 同样归 T8)移植;样式照 photos-places.scss:1026-1184。
//
// 纯组件,不接线:状态与请求都在容器(T8),本组件只 emit。
//
// 浮层规范(本仓已确立先例 PlacesFilterMenu.vue/PlacesThemeMenu.vue):Esc 走
// document 级 keydown,watch(open) 挂/摘,onUnmounted 兜底摘除;不调用
// stopPropagation/stopImmediatePropagation——本页同时挂着 Filters、地图主题两个弹层,
// 三者独立监听同一个 document keydown,一次 Esc 要让三个各自都收到、各自都关
// (T8 集成断言)。onDocKeydown 内部除"非 Escape 直接 return"外没有第二条早退
// (P5-T10 bug 形态:两个弹层共享一个判定函数、漏检第二个分支导致同开时 Esc 只关一个;
// 本组件不共享判定函数,不会重现,但仍照铁律钉死写法)。
//
// z-index 与本仓已有弹层先例 PhotosPersonDetail.vue:1092 的 `.pd-scrim` 同档 220,
// 不用 Vue2 places-cover-portal 的 1200(那是 Vue2 自己的层级体系,与本仓无关)。
import { onUnmounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import type { CoverCandidates } from '../stores/places'

const props = defineProps<{
  open: boolean
  city: string
  totalCount: number
  currentAssetId: string
  candidates: CoverCandidates
  tab: string
  search: string
  page: number
  busy: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'update:tab', tab: string): void
  (e: 'update:search', q: string): void
  (e: 'update:page', page: number): void
  (e: 'pick', assetId: string): void
  (e: 'reset'): void
}>()

const { t } = useI18n()

// 标签文案回落链(照搬 Vue2 :374-377):先查 photosPlacesCoverTab{Recent|Top|Fav|All}
// (按 t.id 映射),没有则回落 t.label,再没有回落 t.id。只此一处消费,不进 util。
const TAB_LABEL_KEYS: Record<string, string> = {
  recent: 'photosPlacesCoverTabRecent',
  top: 'photosPlacesCoverTabTop',
  fav: 'photosPlacesCoverTabFav',
  all: 'photosPlacesCoverTabAll',
}
function coverTabLabel(tb: { id: string, label: string }): string {
  const key = TAB_LABEL_KEYS[tb.id]
  if (key) return t(key)
  return tb.label || tb.id
}

// 照搬 Vue2 :1284。
function tabCountText(count: number): string {
  return count > 999 ? `${Math.round(count / 100) / 10}k` : String(count)
}

function isCurrentCover(assetId: string): boolean {
  return String(props.currentAssetId) === String(assetId)
}

function onTabClick(id: string): void {
  emit('update:tab', id)
}
function onSearchInput(e: Event): void {
  emit('update:search', (e.target as HTMLInputElement).value)
}
function onCellClick(assetId: string): void {
  if (props.busy) return
  emit('pick', String(assetId))
}
function onReset(): void {
  if (props.busy) return
  emit('reset')
}
// 钳制照搬 Vue2 :1322/:1328。
function onPrevPage(): void {
  emit('update:page', Math.max(0, props.page - 1))
}
function onNextPage(): void {
  emit('update:page', Math.min(props.candidates.totalPages - 1, props.page + 1))
}

function onDocKeydown(e: KeyboardEvent): void {
  if (e.key !== 'Escape') return
  emit('close')
}
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) document.addEventListener('keydown', onDocKeydown)
    else document.removeEventListener('keydown', onDocKeydown)
  },
  { immediate: true },
)
onUnmounted(() => {
  document.removeEventListener('keydown', onDocKeydown)
})
</script>

<template>
  <div v-if="open" class="cp-scrim" data-test="cp-scrim" @click.self="emit('close')">
    <div class="cp-shell" data-test="cp-shell">
      <div class="cp-head">
        <div class="cp-head-thumb">
          <img v-if="currentAssetId" :src="service.photos.thumbnailUrl(currentAssetId, 'small')" alt="">
        </div>
        <div class="cp-head-info">
          <div class="cp-head-title">
            {{ t('photosPlacesCoverTitle', { city }) }}
          </div>
          <div class="cp-head-sub">
            {{ t('photosPlacesCoverSubtitle', { count: totalCount.toLocaleString() }) }}
          </div>
        </div>
        <button type="button" class="cp-close-btn" :aria-label="t('photosClose')" @click="emit('close')">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 6 12 12M18 6 6 18" /></svg>
        </button>
      </div>

      <div class="cp-tabs">
        <div class="cp-tabs-group">
          <button
            v-for="tb in candidates.tabs" :key="tb.id" type="button" data-test="cp-tab"
            :class="['cp-tab', { 'is-active': tab === tb.id }]"
            @click="onTabClick(tb.id)"
          >
            <!-- 图标按 t.icon 分支(后端契约 NimoOS-Photos service/places.go:756-759:
                 clock/sparkles/star/grid 四值),未知值回落通用图标。 -->
            <svg
              v-if="tb.icon === 'clock'" data-test="cp-tab-ico-clock"
              viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor"
              stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"
            ><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
            <svg
              v-else-if="tb.icon === 'sparkles'" data-test="cp-tab-ico-sparkles"
              viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor"
              stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"
            ><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" /><circle cx="12" cy="12" r="3" /></svg>
            <svg
              v-else-if="tb.icon === 'star'" data-test="cp-tab-ico-star"
              viewBox="0 0 24 24" width="11" height="11" fill="currentColor" stroke="currentColor"
              stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"
            ><path d="M12 3l2.7 5.5 6 .9-4.3 4.2 1 6-5.4-2.8L6.6 19.6l1-6L3.3 9.4l6-.9z" /></svg>
            <svg
              v-else-if="tb.icon === 'grid'" data-test="cp-tab-ico-grid"
              viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor"
              stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"
            ><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>
            <svg
              v-else data-test="cp-tab-ico-fallback"
              viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor"
              stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"
            ><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M3 14l5-4 4 3 3-2 6 5" /></svg>
            {{ coverTabLabel(tb) }}
            <span class="cp-tab-count">{{ tabCountText(tb.count) }}</span>
          </button>
        </div>
        <div class="cp-search">
          <svg class="cp-search-ic" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input :value="search" :placeholder="t('photosPlacesCoverSearchPlaceholder')" @input="onSearchInput">
        </div>
      </div>

      <div class="cp-body">
        <div v-if="candidates.items.length === 0" class="cp-empty">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <div class="cp-empty-text">
            {{ t('photosPlacesCoverNoMatch', { q: search }) }}
          </div>
        </div>
        <div v-else class="cp-grid">
          <button
            v-for="assetId in candidates.items" :key="assetId" type="button" data-test="cp-cell"
            :class="['cp-cell', { 'is-active': isCurrentCover(assetId) }]"
            :disabled="busy"
            @click="onCellClick(assetId)"
          >
            <img :src="service.photos.thumbnailUrl(assetId, 'small')" alt="">
            <!-- .cp-cell-check 背景为 var(--accent) 饱和实底,白勾压在上面 ——
                 这是 --on-accent 的正确用法(与 hero 前景色不同:那处压在照片+暗化
                 渐变上,一律钉死浅色 + theme-exception;这里背景确为 accent 纯色)。 -->
            <span v-if="isCurrentCover(assetId)" class="cp-cell-check">
              <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5L20 7" /></svg>
            </span>
          </button>
        </div>
      </div>

      <div class="cp-foot">
        <button type="button" class="cp-reset-btn" :disabled="busy" @click="onReset">
          <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 15.5-6.3L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-15.5 6.3L3 16" /><path d="M3 21v-5h5" /></svg>
          {{ t('photosPlacesCoverResetDefault') }}
        </button>
        <div class="cp-foot-info">
          {{ t('photosPlacesCoverPageInfo', { total: candidates.total, page: page + 1, pages: candidates.totalPages }) }}
        </div>
        <div class="cp-pagers">
          <button type="button" data-test="cp-page-prev" :disabled="page === 0" @click="onPrevPage">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 6-6 6 6 6" /></svg>
          </button>
          <button type="button" data-test="cp-page-next" :disabled="page >= candidates.totalPages - 1" @click="onNextPage">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6" /></svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* token 映射(同 T3/T6 既定表):--surface-1 → --popup-bg;--line → --card-border;
   --text-1/2/3 → --fg/--fg-muted/--fg-subtle;Vue2 原三档透明黑蒙层(浅/中/深三级
   不透明度)→ --chip-bg(常态软底,浅一档)、--chip-bg-hi(hover / .is-active,中与深
   两档合并成同一档——本仓只有两档 chip token,不新增第三档)。 */
.cp-scrim {
  position: fixed;
  inset: 0;
  z-index: 220;
  background: var(--overlay-bg);
  backdrop-filter: var(--overlay-blur);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
}
/* P2 血泪:面板底色须用 --popup-bg,不用 --card-bg(深色主题下近透明会看穿)。 */
.cp-shell {
  width: 900px;
  max-width: 95vw;
  height: 80vh;
  background: var(--popup-bg);
  border: 1px solid var(--card-border);
  border-radius: 16px;
  box-shadow: var(--card-shadow-hi);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  color: var(--fg);
}
.cp-head {
  padding: 18px 20px 14px;
  border-bottom: 1px solid var(--card-border);
  display: flex;
  align-items: flex-start;
  gap: 14px;
}
.cp-head-thumb {
  width: 56px;
  height: 42px;
  border-radius: 8px;
  overflow: hidden;
  flex-shrink: 0;
  border: 2px solid var(--accent);
  background: var(--chip-bg);
}
.cp-head-thumb img { width: 100%; height: 100%; object-fit: cover; }
.cp-head-info { flex: 1; min-width: 0; }
.cp-head-title { font-size: 14.5px; font-weight: 600; color: var(--fg); line-height: 1.3; }
.cp-head-sub { font-size: 11.5px; color: var(--fg-subtle); margin-top: 3px; }
.cp-close-btn {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: transparent;
  border: 1px solid var(--card-border);
  color: var(--fg-muted);
  cursor: pointer;
}
.cp-close-btn:hover { background: var(--chip-bg-hi); color: var(--fg); }
.cp-tabs {
  padding: 12px 20px;
  display: flex;
  align-items: center;
  gap: 10px;
  border-bottom: 1px solid var(--card-border);
}
.cp-tabs-group {
  display: flex;
  background: var(--chip-bg);
  border-radius: 8px;
  padding: 2px;
  gap: 2px;
}
.cp-tab {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 26px;
  padding: 0 10px;
  border-radius: 6px;
  background: transparent;
  border: 0;
  color: var(--fg-subtle);
  font: inherit;
  font-size: 11.5px;
  font-weight: 500;
  cursor: pointer;
}
/* New-UI 侧新增(Vue2 无对应):.cp-tab 基类补一条 hover 反馈,与 .is-active 组成
   本仓已确立的"基类/变体"对——下面这条铁律注释同 PlacesRail.vue :299-308。 */
.cp-tab:hover { background: var(--chip-bg-hi); }
.cp-tab.is-active {
  background: var(--chip-bg-hi);
  color: var(--fg);
}
/* 基类 hover 铁律(同 PlacesRail.vue :299-308):.cp-tab:hover 与 .cp-tab.is-active
   优先级相同((0,2,0) vs (0,2,0)),不补这条专属 hover 规则的话,书写顺序一旦颠倒
   就会被基类 hover 背景整块夺走。这条选择器优先级 (0,3,0),严格高于基类 hover,
   不依赖书写顺序永远赢。删码验证钉住这点(cssCascade.hoverBackgroundRules)。 */
.cp-tab.is-active:hover { background: var(--chip-bg-hi); }
.cp-tab .cp-tab-count { font-size: 10px; opacity: 0.55; font-variant-numeric: tabular-nums; }
.cp-search {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 10px;
  background: var(--chip-bg);
  border: 1px solid var(--card-border);
  border-radius: 99px;
  width: 220px;
  margin-left: auto;
}
.cp-search-ic { color: var(--fg-subtle); flex-shrink: 0; }
.cp-search input {
  flex: 1;
  background: transparent;
  border: 0;
  color: var(--fg);
  font: inherit;
  font-size: 11.5px;
  outline: none;
  min-width: 0;
}
.cp-search input::placeholder { color: var(--fg-subtle); }
.cp-body {
  flex: 1;
  overflow-y: auto;
  padding: 14px 20px;
}
.cp-empty {
  padding: 60px 0;
  text-align: center;
  color: var(--fg-subtle);
  font-size: 12.5px;
}
.cp-empty-text { margin-top: 12px; }
.cp-grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 8px;
}
/* 评审同款(PlacesRail.vue D3 裁定):图片未加载完成前的占位底改用 --chip-bg
   (随主题走),不是精确复刻 Vue2 那处 transparent——surface treatment 归 New-UI
   重塑,与 .rail-place .thumb 已登记的手法一致。这一档同时给 .cp-cell 补上
   hover/is-active 背景,满足下面的 hover 级联铁律。 */
.cp-cell {
  aspect-ratio: 1;
  padding: 0;
  border: 2px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  overflow: hidden;
  background: var(--chip-bg);
  position: relative;
  transition: transform .15s;
}
.cp-cell:hover { background: var(--chip-bg-hi); }
.cp-cell.is-active { border-color: var(--accent); background: var(--chip-bg-hi); }
/* 基类 hover 铁律(同上 .cp-tab.is-active:hover 与 PlacesRail.vue :299-308):
   .cp-cell:hover 与 .cp-cell.is-active 优先级相同,这条专属 :hover 规则的优先级
   严格更高,不依赖书写顺序。删码验证钉住这点。 */
.cp-cell.is-active:hover { background: var(--chip-bg-hi); }
.cp-cell:disabled { opacity: 0.5; cursor: not-allowed; }
.cp-cell img { width: 100%; height: 100%; object-fit: cover; display: block; }
.cp-cell-check {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 18px;
  height: 18px;
  border-radius: 99px;
  background: var(--accent);
  color: var(--on-accent);
  display: flex;
  align-items: center;
  justify-content: center;
}
.cp-foot {
  padding: 12px 20px;
  border-top: 1px solid var(--card-border);
  display: flex;
  align-items: center;
  gap: 10px;
}
.cp-reset-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 30px;
  padding: 0 12px;
  border-radius: 7px;
  background: transparent;
  border: 1px solid var(--card-border);
  color: var(--fg-muted);
  font: inherit;
  font-size: 11.5px;
  cursor: pointer;
}
.cp-reset-btn:hover:not(:disabled) { background: var(--chip-bg-hi); color: var(--fg); }
.cp-reset-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.cp-foot-info {
  flex: 1;
  text-align: center;
  font-size: 11.5px;
  color: var(--fg-subtle);
}
.cp-pagers { display: inline-flex; gap: 4px; }
.cp-pagers button {
  width: 30px;
  height: 30px;
  border-radius: 7px;
  background: var(--chip-bg);
  border: 1px solid var(--card-border);
  color: var(--fg);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.cp-pagers button:hover:not(:disabled) { background: var(--chip-bg-hi); }
.cp-pagers button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  color: var(--fg-subtle);
}
</style>
