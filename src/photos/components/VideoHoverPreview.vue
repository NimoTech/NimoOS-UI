<template>
  <div v-if="props.visible" data-test="overlay" class="video-hover-preview">
    <!-- sprite 就绪前不渲染，底层静态缩略图透出来；就绪后铺黑底 + 居中帧 -->
    <template v-if="props.spriteUrl">
      <div data-test="sprite-window" class="sprite-window" :style="winStyle">
        <img class="sprite-strip" :src="props.spriteUrl" alt="" draggable="false" :style="stripStyle">
      </div>
      <video
        v-if="props.videoSrc && !videoFailed"
        ref="vid"
        class="preview-video"
        :class="{ on: videoReady }"
        :src="props.videoSrc"
        loop
        playsinline
        preload="auto"
        @canplay="onVideoCanPlay"
        @error="onVideoError"
        @timeupdate="onVideoTime"
      />
      <div data-test="time-label" class="time" :style="timeStyle">{{ currentLabel }}</div>
      <div class="bar"><div data-test="bar-fill" class="bar-fill" :style="{ width: progressPct + '%' }" /></div>
    </template>
  </div>
</template>

<script setup lang="ts">
// Ported verbatim (logic unchanged, Options API → Composition API) from Vue2
// NimoOS-UI src/views/Photos/VideoHoverPreview.vue (288 lines). Pure presentational:
// no requests, no $t, no token — sprite URL / video src arrive via props.
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { computeWindowStyle, computeStripStyle } from '../util/hoverScrub'

function fmt(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

// scrub 停顿续播：鼠标拖动改变预览时刻时视频暂停并跟随定位，最后一次拖动后
// 停留这么久（无再拖动）才自动续播——给用户一个「找到目标帧」还是「继续拖动」
// 的确认窗口；期间又拖动则重新计时。用户拍板：起播本身不再有延迟闸，只有
// scrub 停顿才有这个窗口。
const SCRUB_RESUME_DELAY_MS = 300

const props = withDefaults(defineProps<{
  visible: boolean
  spriteUrl?: string
  frameCount?: number
  frameW?: number
  frameH?: number
  currentFrame?: number
  durationMs?: number
  videoSrc?: string
  scrubRatio?: number
}>(), {
  spriteUrl: '',
  frameCount: 1,
  frameW: 240,
  frameH: 135,
  currentFrame: 0,
  durationMs: 0,
  videoSrc: '',
  scrubRatio: -1,
})

const vid = ref<HTMLVideoElement | null>(null)
const videoReady = ref(false)
const videoFailed = ref(false)
const videoTimeMs = ref(0)
const videoDurMs = ref(0)
let scrubResumeTimer: ReturnType<typeof setTimeout> | undefined

// 百分比铺满，相对 tile 自身计算——无需测量像素尺寸（见 hoverScrub.ts）。
const winStyle = computed(() => computeWindowStyle(props.frameW, props.frameH))
// 整条雪碧图 <img> 的宽度与位移——transform 合成器属性，换帧零重绘（见 hoverScrub.ts）。
const stripStyle = computed(() => computeStripStyle(props.frameCount, props.currentFrame))

// 视频接管后进度条跟随真实播放时间；接管前保留 sprite 帧算法（降级态回归）。
const progressPct = computed(() => {
  if (videoReady.value && videoDurMs.value > 0) return (videoTimeMs.value / videoDurMs.value) * 100
  return props.frameCount > 1 ? (props.currentFrame / (props.frameCount - 1)) * 100 : 0
})
// 跟随播放头，左右钳制防溢出（26px ≈ 标签半宽 + 边距，标签实际 ~30-44px 宽）
const timeStyle = computed(() => ({ left: `clamp(26px, ${progressPct.value}%, calc(100% - 26px))` }))
const currentLabel = computed(() => {
  if (videoReady.value && videoDurMs.value > 0) return fmt(videoTimeMs.value)
  const p = props.frameCount > 0 ? props.currentFrame / props.frameCount : 0
  return fmt(p * props.durationMs)
})

// watcher 与 canplay 共用的 seek 逻辑：钳制到 0.999 防止 seek 到极限值卡死，
// fastSeek 优先（更省解码开销），不支持时退回 currentTime 赋值。
function seekToRatio(r: number) {
  const v = vid.value
  if (!videoReady.value || !v || r < 0) return
  const durS = videoDurMs.value / 1000
  if (!(durS > 0)) return
  const t = Math.min(r, 0.999) * durS
  if (typeof v.fastSeek === 'function') v.fastSeek(t)
  else v.currentTime = t
}

// scrub 停顿续播计时器：每次拖动都重新计时，停留 SCRUB_RESUME_DELAY_MS 无再拖动才
// 真正续播；期间再次拖动会被 scrubRatio watcher 清掉重新计时（clearTimeout 幂等）。
function scheduleResume() {
  clearTimeout(scrubResumeTimer)
  scrubResumeTimer = setTimeout(() => tryPlay(), SCRUB_RESUME_DELAY_MS)
}

function tryPlay() {
  const v = vid.value
  if (!videoReady.value || videoFailed.value || !v) return
  v.muted = true
  v.play().catch(() => {}) // 自动播放被拒不致错；sprite 底层兜底
}

function onVideoCanPlay() {
  const v = vid.value
  if (!v) return
  // 真实浏览器每次 seek（fastSeek/currentTime 赋值）完成后，readyState 会回升、
  // 从而再次触发 canplay——这不是 bug，是浏览器的正常行为。如果下面这段初始化
  // （补种 seek + play）在重入时也无条件跑一遍，就会形成死循环：
  // canplay → seekToRatio(scrubRatio) → seek 完成 → 浏览器又发 canplay → 又 seek……
  // 修复：整段就绪初始化只在首次 canplay 执行，以 videoReady 为闸；error 处理
  // 会把 videoReady 复位为 false（见 onVideoError），届时视频若恢复、再次收到
  // canplay 仍能重新走一遍初始化，这个语义不受影响。
  if (videoReady.value) {
    v.muted = true // 保险：重入也不丢 muted property
    return
  }
  // muted 作为 attribute 绑定不会设置 DOM property（Vue2 已知坑，Vue3 同样保留此写法
  // 以维持行为一致），必须显式赋值；这里是唯一真源。
  v.muted = true
  videoDurMs.value = isFinite(v.duration) ? v.duration * 1000 : props.durationMs
  videoReady.value = true
  // 用户可能在视频就绪前已经拖动到某个位置、之后没再动鼠标——此时 scrubRatio 的值
  // 不会变化，watcher 不会再触发。这里按当前 scrubRatio 主动补种一次 seek，避免视频从
  // 0 秒起播、时间/进度条回跳；随后走与拖动一致的语义——停顿 SCRUB_RESUME_DELAY_MS 再续播，而不是立即播放，
  // 因为「就绪前已经拖过」等价于「刚拖完一次」。没有拖动过（scrubRatio 仍是初始值）则视为
  // 首次悬停就绪，立即起播，不等待。
  if (props.scrubRatio >= 0) {
    seekToRatio(props.scrubRatio)
    scheduleResume()
  } else {
    tryPlay()
  }
}

function onVideoError() {
  // 视频就绪后中途失败（如断流）：video 会因 v-if="videoSrc && !videoFailed" 从 DOM
  // 移除，但若不复位 videoReady，progressPct/currentLabel 仍会走视频分支，进度冻结在
  // 最后一帧，而不是降级回 sprite 帧算法。
  videoFailed.value = true
  videoReady.value = false
}

function onVideoTime() {
  const v = vid.value
  if (v) videoTimeMs.value = v.currentTime * 1000
}

// 当前预览位置(毫秒):视频接管后取真实播放时间,sprite 降级态取帧比例换算。
// 供 PhotosGrid 点击穿透 lightbox 续播使用。条件与 currentLabel 严格同源
// （videoReady && videoDurMs > 0），避免两处对"是否已接管"的判断产生分歧。
// 优先直接读 video.currentTime：刚 seek 完、timeupdate 尚未触发时
// videoTimeMs 还是旧值，而 currentTime 已经是 seek 目标位置——
// 立刻点击（不等 timeupdate）也要拿到与进度条一致的位置。
function currentPreviewTimeMs(): number {
  if (videoReady.value && videoDurMs.value > 0) {
    const v = vid.value
    return (v && typeof v.currentTime === 'number') ? v.currentTime * 1000 : videoTimeMs.value
  }
  const p = props.frameCount > 0 ? props.currentFrame / props.frameCount : 0
  return p * props.durationMs
}

// 父层 mousemove 已 rAF 节流，这里不再节流。用户拖动预览时刻：暂停并跟随定位，
// 停顿 SCRUB_RESUME_DELAY_MS 无再拖动才续播（见 scheduleResume 注释）。
watch(() => props.scrubRatio, (r) => {
  if (!videoReady.value) return
  const v = vid.value
  if (v) {
    try { v.pause() } catch { /* 暂停中再 pause 无害，忽略异常 */ }
  }
  seekToRatio(r)
  scheduleResume()
})

onBeforeUnmount(() => {
  clearTimeout(scrubResumeTimer)
  const v = vid.value
  if (!v) return
  try { v.pause() } catch { /* 组件已在卸载，忽略播放态异常 */ }
  // 中止 preload=auto 的在途下载：只 pause 不移除 src，浏览器仍会在后台继续加载
  // 已卸载 video 的资源；快速划过多个 tile 会攒下一堆孤儿网络请求。
  try {
    v.removeAttribute('src')
    v.load() // jsdom 未实现 load，可能抛错，忽略
  } catch { /* 忽略：环境不支持或 DOM 已不可操作 */ }
})

defineExpose({ currentPreviewTimeMs })
</script>

<style scoped>
/* 就地覆盖整个视频 tile（宿主 .tile 为 position:relative）。
   z-index:1 → 盖住底层 <img>，但低于 z-index:3/4 的时长角标/选择框/操作按钮。 */
.video-hover-preview {
  position: absolute;
  inset: 0;
  overflow: hidden;
  z-index: 1;
  pointer-events: none;
  background-color: #000; /* theme-exception: 视频letterbox黑底，模拟播放器暗场，与站点主题无关(同 ViewerShell/MediaViewer 惯例) */
  display: flex;
  align-items: center;
  justify-content: center; /* 居中那一帧 */
}
.sprite-window {
  /* 宽高由 computeWindowStyle 以 % 注入：收窄到“正好一帧”（contain），
     父级居中 + 父层黑底形成黑边；窗口宽=一帧，内部整条 <img> 用 translateX 位移选帧，
     邻帧落在窗口外被 overflow:hidden 裁掉。 */
  flex: 0 0 auto;
  overflow: hidden;
  position: relative;
}
.sprite-window .sprite-strip {
  /* 选择器提升为 .sprite-window .sprite-strip，压过全局 tile img 规则。
     宽=N×窗口宽、位移由 computeStripStyle 注入。transform 是合成器属性，换帧不
     触发重绘（background-position 是 paint 级，曾是悬浮卡顿主因）。 */
  display: block;
  height: 100%;
  max-width: none; /* 防全局 img 规则压缩长条 */
  will-change: transform;
  /* 全局 .tile img 若声明 transition: transform，继承会让每次 translateX 换帧都被
     插值成过渡动画（mousemove 跟手变粘滞拖影、自动走帧变漂移）。换帧必须瞬时，
     显式声明 none 压过级联。 */
  transition: none;
  /* strip 盒宽高恒等于图片自身比例（由 computeStripStyle 保证），fill 与现状
     等价，但消除对全局 tile img { object-fit: cover } 级联的巧合依赖。 */
  object-fit: fill;
}
/* 真视频层：盖在 sprite 帧之上，canplay 后淡入，与 sprite 同为 contain 居中（黑边同源）。
   时间标签/进度条在 DOM 里位于 video 之后（天然在其上层），无需 z-index。 */
.preview-video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  opacity: 0;
  transition: opacity 0.15s ease;
}
.preview-video.on {
  opacity: 1;
}
/* 跟随播放头的小号、半透明时间文字(水平位置随进度动态偏移，避免大字遮挡画面)。 */
.time {
  position: absolute;
  bottom: 7px;
  transform: translateX(-50%);
  padding: 0 4px;
  font-size: 10px;
  line-height: 14px;
  /* theme-exception: 恒叠在视频画面上的播放器 chrome 文字，与站点主题无关，两套主题都需要固定的白字对比度(同 MediaViewer 惯例) */
  color: rgba(255, 255, 255, 0.92);
  /* theme-exception: 同上，播放器 chrome 固定半透明黑底，与站点主题无关 */
  background: rgba(0, 0, 0, 0.45);
  border-radius: 3px;
}
/* 底部细进度条：播放器 chrome，固定白/半透明白，与站点主题无关。 */
.bar {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 3px;
  /* theme-exception: 播放器 chrome 固定半透明白轨道，与站点主题无关 */
  background: rgba(255, 255, 255, 0.25);
}
.bar-fill {
  height: 100%;
  /* theme-exception: 播放器 chrome 固定白色进度填充，与站点主题无关 */
  background: #fff;
}
</style>
