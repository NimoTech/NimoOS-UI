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
// 【暂存可渲染性决策,已于 Task 5 收尾】Task 3 曾选择"最小暂存骨架"策略——本文件(以及
// PhotoInfoPanel.vue/PhotoFilmstrip.vue)各自维护一份对齐 parity 结构的网格/定位规则,值上
// 尽量复用已有 New-UI token 与既有视觉,直到灯箱重新挂进 `.photos-root`、parity 的全局规则
// 真正接管为止。Plan F Task 5(2026-08-15)已把灯箱在全部 9 个宿主页里回迁进 `.photos-root`
// 内(见各页面挂载点的注释与 task-5-report.md),该骨架已按此收尾:凡本地规则与 parity 同名
// 规则完整覆盖同一批属性的,一律删除(避免 F8-r4 警告过的同特异性平局——本组件 scoped 样式
// 在当前每个宿主页的 import 顺序下实测排在 parity 样式表之后注入,平局时本地规则会一直赢,
// 悄悄架空 parity、违背回迁的初衷);仅保留 parity 未覆盖的属性/规则(见下方样式块各处
// 注释)。
//
// Plan F Task 4 (2026-08-15,灯箱动画 frame-exact):`.lb-media` 现在包一层
// `<transition :name="'lb-swap-' + navDir">`(navDir 见下方 script),byte-exact 复刻 Vue2 的
// swap/scale 动画;容器补 `lb-in` 入场动画引用;`.lb-media` 定位改 absolute+inset:0(crossfade
// 承重值,见该规则的 style 注释)。详见本文件与 PhotoImageViewer.vue/PhotoFilmstrip.vue 各自
// 的 style/script 注释,以及 task-4-report.md 的参数核值表。
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

// —— 切换方向(Plan F Task 4,忠于 Vue2 PhotosLightbox.vue :233-238 的 data()/watch)——
// Vue2: `data() { return { navDir: 'next', _lastIdx: 0, ... } }` + `watch: { 'photo.id'(newId) {
// this.navDir = this.idx >= this._lastIdx ? 'next' : 'prev'; this._lastIdx = this.idx; ... } }`
// (idx 是 `photos.findIndex(p => p.id === photo.id)` 算出来的下标)。New-UI 的下标本就是
// useLightbox 自身的状态源(lb.index,goTo/next/prev 直接改它),不必像 Vue2 那样从列表反查
// id 对应的下标 —— 直接 watch lb.index 就是同一件事的等价触发点。
const navDir = ref<'next' | 'prev'>('next') // 默认值同 Vue2 data() 的 navDir: 'next'
let lastIdx = 0
watch(() => lb.index.value, (newIdx) => {
  // 灯箱已关闭(或正在被 close()/resetState() 归零 index)时的下标变化不算一次真实翻页 ——
  // close() 先把 open 置 false、再把 index 归 0(同一批次),若不设防,这次归零会被误判成
  // 一次 "prev",污染下一次重开时的初始动画方向(见下方 open-watch 里 lastIdx 复位的同一个
  // 持久挂载坑)。
  if (!lb.open.value) return
  navDir.value = newIdx >= lastIdx ? 'next' : 'prev'
  lastIdx = newIdx
})

watch(
  () => lb.open.value,
  (isOpen) => {
    if (isOpen) {
      startApplied = false
      startPhotoId = lb.current.value?.id ?? null
      onMouseMove()
      showInfo.value = false
      // 组件持久挂载、跨开合复用同一个 navDir/lastIdx(同上面 startApplied/showInfo 的复位
      // 理由)—— 每次重新打开都把两者复位到 Vue2 每次全新 mount 时的默认态(data() 的
      // `navDir: 'next'`,`_lastIdx` 对齐当次 idx),否则:1) 上一次关闭前若曾真实翻页到
      // 'prev',这次重开的首帧 swap 会沿用那个陈旧方向;2) 就算 navDir 没被沿用,起始下标与
      // 上一次关闭时的下标之间的巨大跳变也会被误判成一次真实的 next/prev 翻页。Vue2 没有这个
      // 问题,因为它是逐次 mount 的新实例,两者每次都在 mounted() 里重新对齐 —— 见 :279-281。
      navDir.value = 'next'
      lastIdx = lb.index.value
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
      <!-- Plan F Task 4: swap transition, byte-exact per Vue2 (PhotosLightbox.vue:25
           `<transition :name="'lb-swap-' + navDir">`, wrapping the same id-keyed `.lb-media`
           it already wrapped in Vue2). Params (opacity 0.32s / transform 0.42s,
           cubic-bezier(0.22, 0.61, 0.36, 1), translateX ±36px, scale 0.97) live in parity's own
           bare `.lb-swap-*` rules (photos.scss:627-637) -- "bare" as in NOT `.photos-root`-scoped,
           unlike most of that file's rules, so they were already live on every page that mounts
           this component even before Task 5 nested it inside `.photos-root` (see this file's
           scoped-style header comment for the one naming gap that still needed a local shim:
           Vue3 renamed the bare `-enter` class to `-enter-from`). navDir is computed in
           the script above (watch on lb.index, mirroring Vue2's idx-vs-_lastIdx comparison). -->
      <transition :name="'lb-swap-' + navDir">
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
            <!-- Plan F Task 5: renamed from `.lb-live-badge` -- see this file's scoped-style
                 `.lb-live-btn` comment for why the name had to change once nested. -->
            <button
              class="lb-live-btn"
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
      </transition>

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
/* Plan F Task 5 (2026-08-15, lightbox re-nested inside `.photos-root`): the interim grid/chrome/
   confirm-dialog skeleton Task 3/4 kept here -- byte-mirroring parity so this component stayed
   renderable standalone before it actually lived inside `.photos-root` -- is retired below. Every
   rule removed had a parity counterpart (`.photos-root .lightbox`/`.lb-*`/`.lb-confirm` family,
   vue2-parity/photos.scss:564-793) that already covers every property it declared; keeping a
   local duplicate would only recreate the exact same-specificity cascade tie F8-r4 warned
   against -- and this component's own scoped `<style>` is registered via its SFC import, which in
   every host page's current import order lands AFTER the `vue2-parity` stylesheet import, so a
   surviving local duplicate would silently keep outvoting parity on every tie, defeating the
   whole point of nesting. z-index/animation: parity's own `.photos-root .lightbox` already
   carries `z-index: 200` (bumped to match this component's pre-existing value, see that rule's
   own deviation comment) and `animation: lb-in 0.22s ease-out` -- neither needs a local copy any
   more. photosOverlayZIndex.test.ts's "`.lightbox` (component-scoped)" entry is retargeted to
   drop the now-removed rule (see that test file's own Plan F Task 5 comment).
   Only rules with NO parity counterpart, or properties parity doesn't touch, remain below. */
.lb-titlebox { display: flex; flex-direction: column; min-width: 0; }
/* font-size/font-weight/color now come solely from parity's `.photos-root .lb-title`
   (13px/500/var(--text-1)); only the truncation behaviour survives locally -- parity's own title
   isn't wrapped in a fixed-width flex box like `.lb-titlebox` and has no overflow to guard. */
.lb-title { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
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

/* `.lb-main`/`.lb-media` are byte-identical to parity's own `.photos-root .lb-main`/
   `.photos-root .lb-media` (grid-area:main+position:relative+display:grid+place-items:center+
   overflow:hidden, and position:absolute+inset:0+display:flex+align-items+justify-content for
   the crossfade layer respectively -- parity additionally sets `will-change` on both) -- both
   local copies are retired, parity's alone now governs. */
/* Plan F Task 4: Vue3 renamed Vue2's bare `-enter` transition class to `-enter-from` (`-leave-to`
   kept its name in both) -- same C7 precedent as SearchSaveSmartView.vue's
   `.save-pop-enter-from,.save-pop-leave-to` local shim. Parity's own `.lb-swap-next-enter`/
   `.lb-swap-prev-enter` (photos.scss:634,636) verbatim-transcribe Vue2's own dead names
   (Vue2 photos.scss:518,520) as documented dead-source lines -- they never match any real Vue3
   transition class, so this local pair supplies the actual Vue3 selector. The `-enter-active`/
   `-leave-active` transition-timing rule and the `-leave-to` end-state (name unchanged between
   Vue2 and Vue3) are NOT duplicated here: parity's own copies of those (photos.scss:627-633,635,
   637) are bare, unscoped selectors -- not `.photos-root`-gated -- already live on every host
   page (see the <transition> template comment above for the full reasoning), so only the
   dead-named `-enter` half needs a local replacement. */
.lb-swap-next-enter-from { opacity: 0; transform: translateX(36px) scale(0.97); }
.lb-swap-prev-enter-from { opacity: 0; transform: translateX(-36px) scale(0.97); }
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
/* Plan F Task 5: renamed from `.lb-live-badge` to `.lb-live-btn` to break a genuine class-name
   collision with parity's OWN, unrelated `.photos-root .lb-live-badge` rule (photos.scss:995-
   1009) -- that rule styles a different, non-interactive "LIVE" indicator (Vue2's real lightbox
   never renders this badge at all, confirmed empty template search; this component's Live Photo
   press-and-hold feature is a net addition). Sharing the name was harmless while this component
   rendered outside `.photos-root` (parity's rule couldn't reach it, see the pre-Task-5 deviation
   note this comment replaces -- position `top: 12px; left: 12px` already matched both ground-
   truth sources even then). Nesting would make both rules match the exact same class, and
   parity's copy sets `pointer-events: none` -- which would silently kill this button's press-and-
   hold interaction if it ever won the cascade tie. Renaming removes the ambiguity outright
   instead of fighting over specificity. */
.lb-live-btn {
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

/* `.lb-nav`'s shape/position/color/backdrop/:hover are now byte-owned by parity's own
   `.photos-root .lb-nav` family (photos.scss:638-647); only the two properties parity doesn't
   declare survive locally -- the stacking order above the media layer and an explicit pointer
   cursor (some UA button resets default to `cursor: default`). `[data-side="prev"|"next"]`'s
   `left`/`right: 16px` is also a byte-exact parity duplicate, retired the same way. */
.lb-nav { z-index: 3; cursor: pointer; }
.lb-nav:disabled { opacity: 0.35; cursor: default; }

/* The `:deep(.lb-info)` margin override (previously `margin: 16px 16px 16px 0`) is retired -- it
   was a New-UI-only inset around an otherwise self-contained "card" look (see PhotoInfoPanel.vue's
   own Plan F Task 5 note for that card look being retired too), diverging from parity's flush
   panel (`.photos-root .lb-info` sits flush in its grid cell, no margin at all -- Vue2's real
   lightbox never floats this panel). Now that both sides agree on a flush panel, no local margin
   override is needed. */

/* `.lb-confirm-scrim`/`.lb-confirm`/`.lb-confirm-icon`/`.lb-confirm-title`/`.lb-confirm-foot` and
   the whole `.trash-btn-ghost`/`.trash-btn-cta`/`.trash-btn-cta-danger` family are retired --
   parity's own nested `.photos-root .lb-confirm { … }` (photos.scss:730-793) already implements
   every one of these under the exact same selectors, including the `.trash-btn-*` button family
   this dialog adopted in Task 3. The deeply-nested ones (`.lb-confirm-icon`/`-title`/`-foot`/
   `.trash-btn-*`, each an extra SCSS nesting level under `.lb-confirm`) compile to MORE classes
   than this component's scoped copies and were always going to win outright, no tie involved;
   `.lb-confirm-scrim`/`.lb-confirm` themselves tie at equal specificity with the local scoped
   rule (both two classes) -- the same import-order hazard as everything else retired in this
   file, resolved the same way: delete the local duplicate so there's nothing left to tie with.
   `.lb-confirm-body` keeps the two properties parity doesn't declare (`margin-top`/`line-height`;
   parity uses `margin-bottom` on the same element instead, a different property, so no conflict
   and no double-spacing). */
.lb-confirm-body { margin-top: 8px; line-height: 1.5; }
</style>
