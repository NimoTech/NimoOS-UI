<template>
  <div v-if="props.visible" data-test="overlay" class="video-hover-preview">
    <!-- Do not render before sprite is ready, let underlying static thumbnail show through; after ready layer black background + center frame -->
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
// no requests, no i18n, no tokens — sprite URL / video src arrive via props.
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { computeWindowStyle, computeStripStyle } from '../util/hoverScrub'

function fmt(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

// scrub pause and resume: when mouse drag changes preview time, video pauses and follows positioning, after last drag
// waits this long (no more dragging) before auto-resuming — gives user a confirmation window to decide "found target frame" or "keep dragging";
// dragging again restarts the timer. User decision: playback itself no longer has a delay gate, only
// scrub pause has this window.
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

// Percentage fills full space, computed relative to tile itself — no pixel measurement needed (see hoverScrub.ts).
const winStyle = computed(() => computeWindowStyle(props.frameW, props.frameH))
// Entire sprite <img> width and position shift — transform is compositor property, frame change with zero repaints (see hoverScrub.ts).
const stripStyle = computed(() => computeStripStyle(props.frameCount, props.currentFrame))

// After video takes over, progress bar follows real playback time; before takeover, retain sprite frame algorithm (fallback state).
const progressPct = computed(() => {
  if (videoReady.value && videoDurMs.value > 0) return (videoTimeMs.value / videoDurMs.value) * 100
  return props.frameCount > 1 ? (props.currentFrame / (props.frameCount - 1)) * 100 : 0
})
// Follow playhead, clamp left/right to prevent overflow (26px ≈ label half-width + margin, label actual ~30-44px wide)
const timeStyle = computed(() => ({ left: `clamp(26px, ${progressPct.value}%, calc(100% - 26px))` }))
const currentLabel = computed(() => {
  if (videoReady.value && videoDurMs.value > 0) return fmt(videoTimeMs.value)
  const p = props.frameCount > 0 ? props.currentFrame / props.frameCount : 0
  return fmt(p * props.durationMs)
})

// Shared seek logic between watcher and canplay: clamp to 0.999 to prevent seeking to limit value causing stall,
// fastSeek takes priority (saves decode overhead), falls back to currentTime assignment if not supported.
function seekToRatio(r: number) {
  const v = vid.value
  if (!videoReady.value || !v || r < 0) return
  const durS = videoDurMs.value / 1000
  if (!(durS > 0)) return
  const t = Math.min(r, 0.999) * durS
  if (typeof v.fastSeek === 'function') v.fastSeek(t)
  else v.currentTime = t
}

// scrub pause resume timer: each drag restarts the timer, only truly resumes after staying SCRUB_RESUME_DELAY_MS without dragging;
// dragging again in the meantime gets cleared by scrubRatio watcher and restarts the timer (clearTimeout is idempotent).
function scheduleResume() {
  clearTimeout(scrubResumeTimer)
  scrubResumeTimer = setTimeout(() => tryPlay(), SCRUB_RESUME_DELAY_MS)
}

function tryPlay() {
  const v = vid.value
  if (!videoReady.value || videoFailed.value || !v) return
  v.muted = true
  v.play().catch(() => {}) // Autoplay rejection doesn't cause error; sprite fallback underneath
}

function onVideoCanPlay() {
  const v = vid.value
  if (!v) return
  // After each seek (fastSeek/currentTime assignment) in real browsers, readyState rises and
  // triggers canplay again — this is not a bug, it's normal browser behavior. If the initialization segment below
  // (seed seek + play) runs unconditionally on re-entrance, it forms a dead loop:
  // canplay → seekToRatio(scrubRatio) → seek complete → browser fires canplay again → seek again…
  // Fix: the entire ready initialization only runs on first canplay, gated by videoReady; error handling
  // resets videoReady to false (see onVideoError), if video recovers and canplay fires again
  // initialization runs again, this semantic is unaffected.
  if (videoReady.value) {
    v.muted = true // Insurance: on re-entrance also keep muted property
    return
  }
  // muted as attribute binding does not set DOM property (known Vue2 gotcha, Vue3 likewise keeps this pattern
  // to maintain behavior consistency), must be set explicitly; this is the only true source.
  v.muted = true
  videoDurMs.value = isFinite(v.duration) ? v.duration * 1000 : props.durationMs
  videoReady.value = true
  // User may have dragged to a position before video is ready, then stopped moving mouse — at this point scrubRatio value
  // won't change, watcher won't fire again. Here proactively seed a seek according to current scrubRatio to prevent video from
  // starting at 0 seconds with time/progress bar jumping back; then follow drag-consistent semantics — pause SCRUB_RESUME_DELAY_MS then resume, not immediate play,
  // because "already dragged before ready" equals "just finished dragging once". No dragging yet (scrubRatio still initial value) is treated as
  // first hover when ready, play immediately without waiting.
  if (props.scrubRatio >= 0) {
    seekToRatio(props.scrubRatio)
    scheduleResume()
  } else {
    tryPlay()
  }
}

function onVideoError() {
  // Video fails mid-stream after being ready (e.g., connection loss): video gets removed from DOM via v-if="videoSrc && !videoFailed",
  // but if videoReady is not reset, progressPct/currentLabel still take video branch, progress freezes on
  // last frame instead of falling back to sprite frame algorithm.
  videoFailed.value = true
  videoReady.value = false
}

function onVideoTime() {
  const v = vid.value
  if (v) videoTimeMs.value = v.currentTime * 1000
}

// Current preview position (milliseconds): after video takes over get real playback time, sprite fallback state convert frame ratio.
// For PhotosGrid click-through to lightbox for continued playback. Condition strictly same source as currentLabel
// (videoReady && videoDurMs > 0), avoid divergence in two places on "has video taken over" judgment.
// Prefer reading video.currentTime directly: just after seek, before timeupdate fires
// videoTimeMs is still old value, but currentTime is already the seek target position —
// immediate click (without waiting for timeupdate) also gets position consistent with progress bar.
function currentPreviewTimeMs(): number {
  if (videoReady.value && videoDurMs.value > 0) {
    const v = vid.value
    return (v && typeof v.currentTime === 'number') ? v.currentTime * 1000 : videoTimeMs.value
  }
  const p = props.frameCount > 0 ? props.currentFrame / props.frameCount : 0
  return p * props.durationMs
}

// Parent mousemove already rAF-throttled, no further throttling here. User drag to adjust preview time: pause and follow positioning,
// pause SCRUB_RESUME_DELAY_MS without further dragging then resume (see scheduleResume comment).
watch(() => props.scrubRatio, (r) => {
  if (!videoReady.value) return
  const v = vid.value
  if (v) {
    try { v.pause() } catch { /* pause again while already paused is harmless, ignore exception */ }
  }
  seekToRatio(r)
  scheduleResume()
})

onBeforeUnmount(() => {
  clearTimeout(scrubResumeTimer)
  const v = vid.value
  if (!v) return
  try { v.pause() } catch { /* component is unmounting, ignore playback state exceptions */ }
  // Stop in-progress preload=auto download: pause alone without removing src, browser still continues loading
  // unmounted video resources in background; quickly swiping multiple tiles accumulates orphan network requests.
  try {
    v.removeAttribute('src')
    v.load() // jsdom does not implement load, may throw, ignore
  } catch { /* ignore: environment doesn't support or DOM is no longer operable */ }
})

defineExpose({ currentPreviewTimeMs })
</script>

<style scoped>
/* In-place overlay covering entire video tile (host .tile is position:relative).
   z-index:1 → covers underlying <img>, but lower than z-index:3/4 duration badge/selection box/action buttons. */
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
  /* Width/height injected by computeWindowStyle in %: narrow to “exactly one frame” (contain),
     parent centering + parent black background form black borders; window width = one frame, entire <img> inside shifted by translateX to select frame,
     adjacent frames fall outside window clipped by overflow:hidden. */
  flex: 0 0 auto;
  overflow: hidden;
  position: relative;
}
.sprite-window .sprite-strip {
  /* Selector elevated to .sprite-window .sprite-strip, overrides global tile img rule.
     width = N×window-width, position shift injected by computeStripStyle. transform is compositor property, frame change
     does not trigger repaint (background-position is paint level, was previously cause of hover stutter). */
  display: block;
  height: 100%;
  max-width: none; /* Prevent global img rule compressing long strip */
  will-change: transform;
  /* If global .tile img declares transition: transform, inheritance makes each translateX frame change
     interpolated into transition animation (mousemove follow becomes sticky drag trail, auto frame change becomes drift). Frame change must be instant,
     explicit none overrides cascade. */
  transition: none;
  /* strip box width/height always equals image aspect ratio (guaranteed by computeStripStyle), fill is
     equivalent to current state, but eliminates coincidental dependency on global tile img { object-fit: cover } cascade. */
  object-fit: fill;
}
/* Real video layer: layered above sprite frame, fade in after canplay, like sprite use contain centering (black borders from same source).
   Time label/progress bar in DOM after video (naturally above it), no z-index needed. */
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
/* Follow playhead small semi-transparent time text (horizontal position shifts dynamically with progress to avoid large text obscuring video). */
.time {
  position: absolute;
  bottom: 7px;
  transform: translateX(-50%);
  padding: 0 4px;
  font-size: 10px;
  line-height: 14px;
  /* theme-exception: player chrome text always layered on video, independent of site theme, both themes need fixed white text contrast (same as MediaViewer convention) */
  color: rgba(255, 255, 255, 0.92);
  /* theme-exception: same as above, player chrome fixed semi-transparent black background, independent of site theme */
  background: rgba(0, 0, 0, 0.45);
  border-radius: 3px;
}
/* Bottom thin progress bar: player chrome, fixed white/semi-transparent white, independent of site theme. */
.bar {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 3px;
  /* theme-exception: player chrome fixed semi-transparent white track, independent of site theme */
  background: rgba(255, 255, 255, 0.25);
}
.bar-fill {
  height: 100%;
  /* theme-exception: player chrome fixed white progress fill, independent of site theme */
  background: #fff;
}
</style>
