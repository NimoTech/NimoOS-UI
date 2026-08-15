<script setup lang="ts">
// P2 灯箱壳 —— 结构照 Vue2 NimoOS-UI src/views/Photos/PhotosLightbox.vue 移植,
// 状态全读 useLightbox() 单例(T2/T3),静图舞台委托 PhotoImageViewer(T5,自带底部缩放条)。
// delta(见 task-6-brief.md):1) 加入相册已于 P4(Task 9)加回,Ask Nimo 仍归 SP8;2) 详情栏改可 toggle(占位到 T7);
// 3) 顶栏不放缩放钮(PhotoImageViewer 自持底部缩放条,减少跨组件 ref);4) 当前项一律按 id 比较。
// Task 9 收尾:挂载 T7 的 PhotoInfoPanel(读 lb.detail,水合后的明细,而非 list-item 占位的
// current)与 T8 的 PhotoFilmstrip(绝对下标 select → lb.goTo)。
//
// Plan F Task 3 (2026-08-15,结构重刻 flex→parity grid + 类名全对齐):
// 容器 `.lightbox` 从 flex column 改成 CSS Grid,行/列/区域完全照抄 Vue2/parity
// (parity photos.scss:564-578):`grid-template-rows: 56px 1fr 88px`;`data-info="true"` 时
// `grid-template-columns: 1fr 360px` + areas "top top"/"main info"/"strip info","false" 时单列
// areas "top"/"main"/"strip"。这意味着 T9 留下的 `.lb-body`(行 flex,把 `.lb-stage` 与
// PhotoInfoPanel 并排包一层)整个删除 —— `.lb-main`(重命名自 `.lb-stage`)、PhotoInfoPanel
// 根(重命名为 `.lb-info`)、PhotoFilmstrip 根(`.lb-strip`,类名本就已对齐)三者都改成
// `.lightbox` 的直接子元素,靠各自的 `grid-area` 认领网格区域,不再靠 DOM 嵌套关系摆位。
//
// 【暂存可渲染性决策】本任务 DO NOT 把灯箱挪进 `.photos-root`(Task 5 的活)——那意味着
// parity 全局的 `.photos-root .lightbox`/`.lb-*` 规则族(photos.scss:564-793)此刻依旧对
// 本组件不生效(Fix-8 round 4 的教训:见 Photos.lightbox.test.ts/PhotosAlbumDetail.test.ts
// 里 "renders OUTSIDE .photos-root" 的用例与其详尽注释)。若只改类名、不提供等价的本地
// scoped CSS,组件在真机上会在 Task 5 落地前变成裸网格/无样式的一段时间。因此这里选择
// "最小暂存骨架"策略:本文件(以及 PhotoInfoPanel.vue/PhotoFilmstrip.vue)各自的 scoped
// style 块里维护一份对齐 parity 结构的网格/定位规则,值上尽量复用已有 New-UI token
// 与既有视觉(非 Vue2 的原始色值),直到 Task 5 把整个组件重新挂进 `.photos-root`、
// parity 的全局规则真正接管为止 —— 届时这里的本地骨架规则应当被评估/精简掉。
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import { useLightbox } from './useLightbox'
import PhotoImageViewer from './PhotoImageViewer.vue'
import PhotoInfoPanel from './PhotoInfoPanel.vue'
import PhotoFilmstrip from './PhotoFilmstrip.vue'

const emit = defineEmits<{
  (e: 'delete', id: string | number): void
  (e: 'toggle-fav', id: string | number, fav: boolean): void
  (e: 'add-to-album', id: string | number): void
}>()

const { t } = useI18n()
const lb = useLightbox()

const showInfo = ref(false) // 详情面板(T7 填充);默认关,可 toggle
const confirmDelete = ref(false)

// URL 生成器(bare、带 token)——薄封装供模板调用
const originalUrl = (id: string | number) => service.photos.originalUrl(id)
const thumbnailUrl = (id: string | number, size = 'large') => service.photos.thumbnailUrl(id, size)
const liveUrl = (id: string | number) => service.photos.liveUrl(id)

const downloadName = (): string => {
  const d = lb.detail.value
  const cur = lb.current.value
  const title = d?.title ?? cur?.title
  return title != null && title !== '' ? String(title) : `photo-${cur?.id ?? ''}`
}

// —— 收藏 ——(toggleFav 已在 useLightbox 乐观落库;emit 仅为 P3 广播)
function onToggleFav(): void {
  const cur = lb.current.value
  if (!cur) return
  void lb.toggleFav() // 同步乐观翻转 favIds → isFav 立即反映新态
  emit('toggle-fav', cur.id, lb.isFav.value)
}

// —— 加入相册 ——(照 Vue2 PhotosLightbox.vue:13-14:仅 emit,不含逻辑;宿主接 T5
// AlbumPickerDialog 打开面板,灯箱本身不关闭)。
function onAddToAlbum(): void {
  const cur = lb.current.value
  if (!cur) return
  emit('add-to-album', cur.id)
}

// —— 删除确认 ——(照 Vue2 :151-165)
function doDelete(): void {
  const cur = lb.current.value
  if (!cur) return
  confirmDelete.value = false
  emit('delete', cur.id)
  lb.close()
}

// —— chrome 5s 无操作自隐 ——(复用 T5 同款 isMoving + 计时;提到视频锚点 watch 之前声明,
// 避免下方 open-watch 的 immediate:true 分支在边缘情况下引用到尚未初始化的 hideTimer)
const isMoving = ref(false)
let hideTimer: ReturnType<typeof setTimeout> | null = null
function onMouseMove(): void {
  isMoving.value = true
  if (hideTimer) clearTimeout(hideTimer)
  hideTimer = setTimeout(() => { isMoving.value = false; hideTimer = null }, 5000)
}

// —— 视频起播位续播 ——(照 Vue2 applyStartTime :335-344:仅本次打开首张匹配视频 seek 一次)
// 本组件被父级持久挂载(内部靠 v-if="lb.open.value" 自门控),onMounted 时灯箱通常还没开,
// 那一刻 lb.current 为空,锚点只能在 open 由假变真的瞬间捕获(见 watch),否则 startPhotoId 恒为 null、
// applyStartTime 永远 early-return,悬停位续播失效。
// 同一持久挂载坑还连累另外两处状态,故这个 open-watch 一并兜底:
// 1) chrome 自隐(isMoving)只在 onMounted 里 arm 一次 5s 计时 —— 组件常年挂着、灯箱关着,
//    计时早就过期,真正 openAt 打开时 isMoving 已是 false,翻页箭头全隐,看着像没渲染。
//    (2026-07-31 起顶栏不再受 isMoving 管辖 —— 它是不透明流内 chrome,恒显,见模板注释。)
//    每次 open 都重新 onMouseMove() 一次,保证"刚打开"必是 chrome 可见 + 计时器重新起跑。
// 2) showInfo 是组件级 ref,open→close→reopen 会带着上一次的开合状态过来,不符合"详情栏默认收起"
//    的设计;每次 open 显式重置为 false。
const videoEl = ref<HTMLVideoElement | null>(null)
let startApplied = false
let startPhotoId: string | number | null = null
watch(
  () => lb.open.value,
  (isOpen) => {
    if (isOpen) {
      startApplied = false
      startPhotoId = lb.current.value?.id ?? null
      onMouseMove()
      showInfo.value = false
    }
  },
  { immediate: true }, // 兼容组件在灯箱已开时才挂载的边缘情况
)
function applyStartTime(): void {
  const cur = lb.current.value
  if (startApplied || !(lb.startMs.value > 0)) return
  if (!cur || cur.id !== startPhotoId) return
  const v = videoEl.value
  if (!v) return
  startApplied = true
  const durS = isFinite(v.duration) ? v.duration : Infinity
  v.currentTime = Math.min(lb.startMs.value / 1000, Math.max(0, durS - 0.1))
  void v.play().catch(() => {})
}

// —— 实况照片按住播放 ——(net-new:Vue2 灯箱未实现;按住徽标出覆盖视频,松开停并隐藏)
const liveActive = ref(false)
const liveVideoEl = ref<HTMLVideoElement | null>(null)
function liveStart(): void {
  liveActive.value = true
  void nextTick(() => { void liveVideoEl.value?.play?.().catch(() => {}) })
}
function liveStop(): void {
  const v = liveVideoEl.value
  try { v?.pause?.() } catch { /* jsdom / 未就绪 */ }
  liveActive.value = false
}

// —— 键盘 ——(照 Vue2 :360-370;confirmDelete 开时 Escape 只关模态)
function onKey(e: KeyboardEvent): void {
  if (!lb.open.value) return
  if (confirmDelete.value) {
    if (e.key === 'Escape') { e.preventDefault(); confirmDelete.value = false }
    return
  }
  if (e.key === 'Escape') { lb.close() }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); lb.prev() }
  else if (e.key === 'ArrowRight') { e.preventDefault(); lb.next() }
  else if (e.key === 'f' || e.key === 'F') { onToggleFav() }
  else if (e.key === 'Delete' || e.key === 'Backspace') { confirmDelete.value = true }
}

onMounted(() => {
  onMouseMove()
  window.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  if (hideTimer) clearTimeout(hideTimer)
  window.removeEventListener('keydown', onKey)
})
</script>

<template>
  <div v-if="lb.open.value" class="lightbox" :data-info="showInfo" @mousemove="onMouseMove">
    <!-- 顶部工具栏。用户 2026-07-31 验收要求:顶栏不做透明、图片显示在上下两栏之间 ——
         故它是网格自己的一行(Plan F Task 3 起为 grid-area: top,此前是 flex 流内项;
         不再 position:absolute 盖在舞台上)且**不参与 5s 自隐**(不透明的 chrome 一旦收起,
         舞台会随之变高、图片跳一下;翻页箭头仍随 isMoving 自隐,它们是叠在照片上的浮层)。 -->
    <div class="lb-top">
      <button class="lb-icon-btn lb-close" type="button" :title="t('photosClose')" @click="lb.close()">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
      </button>
      <div class="lb-titlebox">
        <div class="lb-title">{{ lb.detail.value?.title }}</div>
        <div class="lb-sub">
          <span>{{ t('photosLightboxCounter', { idx: lb.index.value + 1, total: lb.list.value.length }) }}</span>
          <template v-if="lb.detail.value?.date"> · {{ lb.detail.value?.date }}</template>
          <template v-if="lb.detail.value?.time"> · {{ lb.detail.value?.time }}</template>
        </div>
      </div>
      <div class="lb-spacer"></div>
      <button
        class="lb-icon-btn lb-fav"
        :class="{ 'is-fav': lb.isFav.value }"
        type="button"
        :title="lb.isFav.value ? t('photosUnfavorite') : t('photosFavorite')"
        @click="onToggleFav"
      >
        <svg viewBox="0 0 24 24" width="17" height="17" :fill="lb.isFav.value ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 3.5l2.6 5.3 5.9.86-4.25 4.14 1 5.86L12 17.9l-5.25 2.76 1-5.86L3.5 9.66l5.9-.86z"/></svg>
      </button>
      <button
        class="lb-icon-btn lb-add-album"
        type="button"
        :title="t('photosAddToAlbum')"
        :aria-label="t('photosAddToAlbum')"
        @click="onAddToAlbum"
      >
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 9v6M9 12h6"/></svg>
      </button>
      <a
        class="lb-icon-btn lb-download"
        :href="lb.current.value ? originalUrl(lb.current.value.id) : '#'"
        :download="downloadName()"
        :title="t('photosDownload')"
      >
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v10m0 0l-4-4m4 4l4-4M5 19h14"/></svg>
      </a>
      <button
        class="lb-icon-btn lb-info-toggle"
        :class="{ active: showInfo }"
        type="button"
        :title="t('photosInfoToggle')"
        @click="showInfo = !showInfo"
      >
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>
      </button>
      <button class="lb-icon-btn lb-delete danger" type="button" :title="t('photosDeleteConfirmTitle')" @click="confirmDelete = true">
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/></svg>
      </button>
    </div>

    <!-- Plan F Task 3: `.lb-main` (renamed from `.lb-stage`) is a direct grid child of
         `.lightbox` (grid-area: main) -- the `.lb-body` flex-row wrapper that used to pair it
         with PhotoInfoPanel is gone; both now claim their own named grid area independently
         (see this file's scoped-style header comment). -->
    <div class="lb-main">
      <div class="lb-media" :key="String(lb.current.value?.id ?? '')">
        <!-- (a) 视频。`.lb-photo` is parity's anchor for the media element itself
             (`.lb-media > .lb-photo(img|video)`, parity photos.scss:593-598); `.lb-video`
             is kept alongside it for this component's own video-specific sizing rule
             (net addition -- Vue2's lightbox has no separate video-only class). -->
        <video
          v-if="lb.current.value?.isVideo"
          ref="videoEl"
          class="lb-photo lb-video"
          :src="originalUrl(lb.current.value.id)"
          :poster="thumbnailUrl(lb.current.value.id, 'large')"
          controls
          preload="metadata"
          playsinline
          @loadedmetadata="applyStartTime"
        ></video>

        <!-- (b) 实况照片(非视频):静图 + 徽标 + 按住播 -->
        <template v-else-if="lb.current.value?.isLivePhoto">
          <PhotoImageViewer
            :asset-id="lb.current.value.id"
            :mime-type="lb.current.value.mimeType"
            :ocr-lines="lb.ocrLines.value"
          />
          <video
            v-if="liveActive"
            ref="liveVideoEl"
            class="lb-live-video"
            :src="liveUrl(lb.current.value.id)"
            muted
            playsinline
          ></video>
          <button
            class="lb-live-badge"
            type="button"
            @pointerdown="liveStart"
            @pointerup="liveStop"
            @pointerleave="liveStop"
            @pointercancel="liveStop"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="8.5" stroke-dasharray="3 3"/></svg>
            {{ t('photosLivePhoto') }}
          </button>
        </template>

        <!-- (c) 静图 -->
        <PhotoImageViewer
          v-else-if="lb.current.value"
          :asset-id="lb.current.value.id"
          :mime-type="lb.current.value.mimeType"
          :ocr-lines="lb.ocrLines.value"
        />
      </div>

      <!-- 翻页箭头。Plan F Task 3: side modifier moved from a `.lb-nav-prev`/`.lb-nav-next`
           class to parity's real anchor attribute `data-side="prev"|"next"`
           (Vue2 PhotosLightbox.vue:57-71, parity photos.scss:630-639). -->
      <button
        v-if="isMoving"
        class="lb-nav"
        data-side="prev"
        type="button"
        :disabled="!lb.hasPrev.value"
        :title="t('photosPrev')"
        @click="lb.prev()"
      >
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>
      </button>
      <button
        v-if="isMoving"
        class="lb-nav"
        data-side="next"
        type="button"
        :disabled="!lb.hasNext.value"
        :title="t('photosNext')"
        @click="lb.next()"
      >
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>
      </button>
    </div>

    <!-- 详情栏(T7):读水合后的 lb.detail,而非 list-item 占位的 lb.current。Plan F Task 3:
         no longer wrapped in `.lb-body` -- PhotoInfoPanel's own root now carries `.lb-info`
         and claims `grid-area: info` itself (see that component's scoped style). -->
    <PhotoInfoPanel :photo="lb.detail.value" :visible="showInfo" />

    <!-- 缩略图条(T8):绝对下标 select → lb.goTo -->
    <PhotoFilmstrip :list="lb.list.value" :index="lb.index.value" @select="lb.goTo" />

    <!-- 删除确认模态。Plan F Task 3: buttons renamed from the invented `.lb-confirm-cancel`/
         `.lb-confirm-ok.danger` to the `.trash-btn-ghost`/`.trash-btn-cta.trash-btn-cta-danger`
         family Vue2 actually uses (PhotosLightbox.vue:158-161) and that sibling Photos pages
         (PhotosMomentDetail.vue/PhotosAlbumDetail.vue/PhotosSmartViewDetail.vue) already
         adopted for their own copies of this exact dialog -- this was the one remaining
         un-migrated copy. The icon is added back too (Vue2 :154, dropped when this dialog was
         first built) -- same trash glyph as the `.lb-delete` button above, at parity's icon
         size (22px vs. the top bar's 17px). -->
    <div v-if="confirmDelete" class="lb-confirm-scrim" @click.self="confirmDelete = false">
      <div class="lb-confirm">
        <div class="lb-confirm-icon" style="color: var(--remove-fg, #ff5d5d)"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/></svg></div>
        <div class="lb-confirm-title">{{ t('photosDeleteConfirmTitle') }}</div>
        <div class="lb-confirm-body">{{ t('photosDeleteConfirmBody') }}</div>
        <div class="lb-confirm-foot">
          <button class="trash-btn-ghost" type="button" @click="confirmDelete = false">{{ t('photosCancel') }}</button>
          <button class="trash-btn-cta trash-btn-cta-danger" type="button" @click="doDelete">{{ t('photosConfirmDelete') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Plan F Task 3: `display: flex; flex-direction: column` replaced with a CSS Grid whose rows/
   columns/areas mirror Vue2/parity exactly (parity photos.scss:564-578). z-index bumped
   100→200 to match this component's own pre-existing value (see the deviation comment on
   parity's `.photos-root .lightbox` rule for the other side of this same change) -- both sides
   of the z ruling now agree, and photosOverlayZIndex.test.ts's floor check (>= 100) still
   holds for either value.
   Interim-renderability note: this local grid is a deliberate, temporary skeleton -- the
   lightbox does not render inside `.photos-root` yet (Task 5's job), so parity's own
   `.photos-root .lightbox`/`.lb-*` global rules do not reach this component at runtime. The
   rules below exist so the component keeps rendering correctly on its own in the interim;
   they should be re-evaluated for removal once Task 5 re-nests it and those global rules take
   over for real. */
.lightbox {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: var(--app-bg);
  display: grid;
  grid-template-rows: 56px 1fr 88px;
}
.lightbox[data-info="true"] {
  grid-template-columns: 1fr 360px;
  grid-template-areas: "top top" "main info" "strip info";
}
.lightbox[data-info="false"] {
  grid-template-columns: 1fr;
  grid-template-areas: "top" "main" "strip";
}
/* 用户 2026-07-31 验收要求:顶栏改成不透明的流内 chrome(原先是 position:absolute + 从黑到
   透明的渐变,盖在舞台上,图片会钻到它底下)。改成网格区域后顶栏占满 grid-template-rows
   的第一行(56px,同 parity),图片就夹在两栏中间;底色用实底 --popup-bg 后,栏内文字/
   图标压的是主题面而不是照片,原先那条「固定暗化保对比度」的 theme-exception 一并作废。 */
.lb-top {
  grid-area: top;
  z-index: 3;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 16px;
  background: var(--popup-bg);
  border-bottom: 1px solid var(--card-border);
}
.lb-titlebox { display: flex; flex-direction: column; min-width: 0; }
.lb-title { font-size: 14px; font-weight: 600; color: var(--fg); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.lb-sub { font-size: 12px; color: var(--fg-muted); }
.lb-spacer { flex: 1; }
.lb-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--fg);
  cursor: pointer;
}
.lb-icon-btn:hover { background: var(--tool-bg-hi, rgba(255, 255, 255, 0.12)); }
.lb-fav.is-fav { color: var(--star-fg, #ffd60a); }
/* theme-exception: 收藏星实心金色为跨皮肤固定语义色 */
.lb-info-toggle.active { background: var(--tool-bg-hi, rgba(255, 255, 255, 0.12)); color: var(--accent); }
.lb-icon-btn.danger:hover { color: var(--remove-fg, #ff5d5d); }

/* Plan F Task 3: `.lb-body` (the flex-row wrapper that used to pair `.lb-stage` with
   PhotoInfoPanel) is deleted -- `.lb-main` (renamed from `.lb-stage`) now claims its own
   `grid-area: main` directly on `.lightbox`'s grid, a sibling of `.lb-top`/`.lb-info`/
   `.lb-strip` rather than a nested flex child. */
.lb-main {
  grid-area: main;
  position: relative;
  display: grid;
  place-items: center;
  overflow: hidden;
}
.lb-media {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.lb-video { max-width: 100%; max-height: 100%; }
.lb-live-video {
  position: absolute;
  inset: 0;
  margin: auto;
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  pointer-events: none;
  z-index: 2;
}
/* Deviation (value, parity wins): position moved from bottom-right to top-left, matching both
   Vue2 (photos.scss:879-889 in NimoOS-UI, the same rule's origin) and parity's own copy
   (photos.scss:987-1001) -- both place this badge at `top: 12px; left: 12px`. This component's
   Live Photo feature is itself a net addition (Vue2's real lightbox never renders this badge --
   confirmed empty template search), but since the rule already exists under this exact name in
   both ground-truth sources, its position is corrected here rather than left diverging. */
.lb-live-badge {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 4;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: none;
  border-radius: 999px;
  font-size: 12px;
  color: var(--fg);
  background: var(--popup-bg, rgba(0, 0, 0, 0.5));
  backdrop-filter: var(--blur);
  cursor: pointer;
  user-select: none;
  touch-action: none;
}

.lb-nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 3;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border: none;
  border-radius: 999px;
  color: var(--fg);
  background: var(--popup-bg, rgba(0, 0, 0, 0.4));
  backdrop-filter: var(--blur);
  cursor: pointer;
}
.lb-nav:hover { background: var(--tool-bg-hi, rgba(255, 255, 255, 0.16)); }
.lb-nav:disabled { opacity: 0.35; cursor: default; }
/* Plan F Task 3: renamed from `.lb-nav-prev`/`.lb-nav-next` modifier classes to parity's real
   anchor attribute `[data-side="prev"|"next"]` (see template comment). */
.lb-nav[data-side="prev"] { left: 16px; }
.lb-nav[data-side="next"] { right: 16px; }

/* PhotoInfoPanel(T7)自带定位/尺寸/配色样式(现为 `.lb-info`),这里只管它在灯箱内的外
   边距,不重复定义外观。上边距原为 64px —— 那是给绝对定位的顶栏让位;顶栏 2026-07-31 改成
   流内 chrome 后不再需要让位,四边统一 16px,否则详情栏会比同排的舞台整体下沉一截。
   Plan F Task 3: selector renamed from `:deep(.info-panel)` to `:deep(.lb-info)` (PhotoInfoPanel
   root rename, see that file). */
:deep(.lb-info) { margin: 16px 16px 16px 0; }

.lb-confirm-scrim {
  position: absolute;
  inset: 0;
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--scrim, rgba(0, 0, 0, 0.55));
  /* theme-exception: 模态遮罩暗化层,皮肤无关 */
}
.lb-confirm {
  width: 340px;
  max-width: 90vw;
  padding: 22px;
  border-radius: 16px;
  /* 用 --popup-bg(不透明弹层色:深色主题深蓝玻璃 0.9/0.95、浅色主题实心白),
     不用 --card-bg —— 后者深色下是近透明白玻璃(alpha 0.085~0.26),叠在灯箱暗底上
     会看穿(真机验收反馈:删除弹窗"透明")。两套主题各自不同的实底色。 */
  background: var(--popup-bg);
  border: 1px solid var(--border);
  color: var(--fg);
  box-shadow: var(--media-overlay-shadow, 0 12px 40px rgba(0, 0, 0, 0.4));
}
/* Plan F Task 3: `.lb-confirm-icon` added back (Vue2 PhotosLightbox.vue:154, dropped when this
   dialog was first built without it). Sized/spaced like the sibling copies of this exact dialog
   already on PhotosMomentDetail.vue/PhotosAlbumDetail.vue/PhotosSmartViewDetail.vue. */
.lb-confirm-icon { margin-bottom: 10px; }
.lb-confirm-title { font-size: 16px; font-weight: 600; }
.lb-confirm-body { margin-top: 8px; font-size: 13px; color: var(--fg-muted); line-height: 1.5; }
.lb-confirm-foot { margin-top: 20px; display: flex; justify-content: flex-end; gap: 10px; }
/* Plan F Task 3: renamed from the invented `.lb-confirm-cancel`/`.lb-confirm-ok.danger` to the
   `.trash-btn-ghost`/`.trash-btn-cta`(+`.trash-btn-cta-danger`) family Vue2 actually uses
   (PhotosLightbox.vue:158-161, parity photos.scss:737-783) and that this app's own sibling
   Photos pages already standardized on for their own copies of this same dialog (see template
   comment) -- this was the one remaining un-migrated copy. Values kept as they were under the
   old names (interim skeleton, see this file's scoped-style header note), only the selectors moved. */
.trash-btn-ghost,
.trash-btn-cta {
  padding: 8px 16px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--fg);
  font-size: 13px;
  cursor: pointer;
}
.trash-btn-ghost:hover { background: var(--tool-bg-hi, rgba(255, 255, 255, 0.1)); }
.trash-btn-cta-danger {
  border-color: color-mix(in srgb, var(--remove-fg, #ff5d5d) 45%, transparent);
  color: var(--remove-fg, #ff5d5d);
}
.trash-btn-cta-danger:hover { background: color-mix(in srgb, var(--remove-fg, #ff5d5d) 20%, transparent); }
</style>
