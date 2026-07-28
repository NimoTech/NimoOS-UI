<script setup lang="ts">
// P2 灯箱壳 —— 结构照 Vue2 NimoOS-UI src/views/Photos/PhotosLightbox.vue 移植,
// 状态全读 useLightbox() 单例(T2/T3),静图舞台委托 PhotoImageViewer(T5,自带底部缩放条)。
// delta(见 task-6-brief.md):1) 加入相册已于 P4(Task 9)加回,Ask Nimo 仍归 SP8;2) 详情栏改可 toggle(占位到 T7);
// 3) 顶栏不放缩放钮(PhotoImageViewer 自持底部缩放条,减少跨组件 ref);4) 当前项一律按 id 比较。
// Task 9 收尾:挂载 T7 的 PhotoInfoPanel(读 lb.detail,水合后的明细,而非 list-item 占位的
// current)与 T8 的 PhotoFilmstrip(绝对下标 select → lb.goTo)。PhotoInfoPanel 自身样式假设
// "并排 flex row" 布局(它内部就带 flex:0 0 auto),故把舞台从 lb-stage 单飞的 flex:1 列项
// 改包一层 .lb-body(行 flex),让详情栏与舞台并排,而不是硬套 T6 之前留的绝对定位 .lb-info 占位
// (已删除,详情栏定位改由 PhotoInfoPanel 自己的样式承担)。
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
//    计时早就过期,真正 openAt 打开时 isMoving 已是 false,顶栏+翻页箭头全隐,看着像没渲染。
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
    <!-- 顶部工具栏 -->
    <div v-if="isMoving" class="lb-top">
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

    <!-- 舞台 + 详情栏:并排 flex row(详情栏样式假设自己是 row 内 flex 项,见头部注释) -->
    <div class="lb-body">
    <div class="lb-stage">
      <div class="lb-media" :key="String(lb.current.value?.id ?? '')">
        <!-- (a) 视频 -->
        <video
          v-if="lb.current.value?.isVideo"
          ref="videoEl"
          class="lb-video"
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

      <!-- 翻页箭头 -->
      <button
        v-if="isMoving"
        class="lb-nav lb-nav-prev"
        type="button"
        :disabled="!lb.hasPrev.value"
        :title="t('photosPrev')"
        @click="lb.prev()"
      >
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>
      </button>
      <button
        v-if="isMoving"
        class="lb-nav lb-nav-next"
        type="button"
        :disabled="!lb.hasNext.value"
        :title="t('photosNext')"
        @click="lb.next()"
      >
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>
      </button>
    </div>

    <!-- 详情栏(T7):读水合后的 lb.detail,而非 list-item 占位的 lb.current -->
    <PhotoInfoPanel :photo="lb.detail.value" :visible="showInfo" />
    </div>

    <!-- 缩略图条(T8):绝对下标 select → lb.goTo -->
    <PhotoFilmstrip :list="lb.list.value" :index="lb.index.value" @select="lb.goTo" />

    <!-- 删除确认模态 -->
    <div v-if="confirmDelete" class="lb-confirm-scrim" @click.self="confirmDelete = false">
      <div class="lb-confirm">
        <div class="lb-confirm-title">{{ t('photosDeleteConfirmTitle') }}</div>
        <div class="lb-confirm-body">{{ t('photosDeleteConfirmBody') }}</div>
        <div class="lb-confirm-foot">
          <button class="lb-confirm-cancel" type="button" @click="confirmDelete = false">{{ t('photosCancel') }}</button>
          <button class="lb-confirm-ok danger" type="button" @click="doDelete">{{ t('photosConfirmDelete') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.lightbox {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  flex-direction: column;
  background: var(--app-bg);
}
.lb-top {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 3;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: var(--media-chrome-bg, linear-gradient(to bottom, rgba(0, 0, 0, 0.45), transparent));
  /* theme-exception: 顶栏渐隐叠在任意照片上,需固定暗化保证图标对比度,皮肤无关 */
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

.lb-body {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: stretch;
  overflow: hidden;
}
.lb-stage {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
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
.lb-live-badge {
  position: absolute;
  right: 16px;
  bottom: 16px;
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
.lb-nav-prev { left: 16px; }
.lb-nav-next { right: 16px; }

/* PhotoInfoPanel(T7)自带定位/尺寸/配色样式(.info-panel),这里只需在灯箱内让出
   顶栏遮挡的空间,不重复定义外观。*/
:deep(.info-panel) { margin: 64px 16px 16px 0; }

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
.lb-confirm-title { font-size: 16px; font-weight: 600; }
.lb-confirm-body { margin-top: 8px; font-size: 13px; color: var(--fg-muted); line-height: 1.5; }
.lb-confirm-foot { margin-top: 20px; display: flex; justify-content: flex-end; gap: 10px; }
.lb-confirm-cancel,
.lb-confirm-ok {
  padding: 8px 16px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--fg);
  font-size: 13px;
  cursor: pointer;
}
.lb-confirm-cancel:hover { background: var(--tool-bg-hi, rgba(255, 255, 255, 0.1)); }
.lb-confirm-ok.danger {
  border-color: color-mix(in srgb, var(--remove-fg, #ff5d5d) 45%, transparent);
  color: var(--remove-fg, #ff5d5d);
}
.lb-confirm-ok.danger:hover { background: color-mix(in srgb, var(--remove-fg, #ff5d5d) 20%, transparent); }
</style>
