<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import ViewerShell from './ViewerShell.vue'
import { mediaKind } from './mediaKind'
import { WAVE_N, synthWaveform, decodeWaveform, waveCacheKey, getCachedWave, setCachedWave } from './waveform'
import type { FileEntry } from '../stores/files'

const props = defineProps<{ item: FileEntry; list: FileEntry[] }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'download', entry: FileEntry): void }>()
const { t, locale } = useI18n()

const kind = mediaKind(props.item.name)

const url = service.file.fileUrl(props.item.path)
const videoEl = ref<HTMLDivElement | null>(null)
const wrap = ref<HTMLElement | null>(null)
const poster = ref('')
const audioTitle = ref(props.item.name)
const audioArtist = ref('...')

// Artplayer is a third-party interop boundary; beyond destroy we need no shared types, any is intentional.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let artInst: any = null
// Component may be unmounted during async onMounted await (user closes overlay quickly) — abandon construction on unmount.
let disposed = false

// ── Audio: custom minimal player (native <audio> + hand-drawn progress bar, per reference design) ─────────────
//   Layout: play/pause circle button centered above progress bar; progress bar = transparent track + blue-purple played bar + circular handle,
//   time labels at both ends. Removed original APlayer skin and ripple animation. Color scheme reuses homepage blue-purple.
const audioMedia = ref<HTMLAudioElement | null>(null)
const track = ref<HTMLElement | null>(null)
const playing = ref(false)
const curTime = ref(0)
const durTime = ref(0)
let dragging = false

const progressPct = computed(() =>
  durTime.value ? Math.min(100, Math.max(0, (curTime.value / durTime.value) * 100)) : 0,
)

// ── Waveform progress bar (like recording apps) ──────────────────────────────────────────
//   Progress bar rendered as audio waveform: centered rounded vertical bars + dashed baseline at silence. Played portion tinted accent color.
//   Two-level data source: first synthesize placeholder by filename (0 delay), then seamlessly replace with decoded real audio;
//   over 50MB / decode failure / cache miss all silently stay with synthesis, see ./waveform and design spec.
const MAX_DECODE_BYTES = 50 * 1024 * 1024
const waveBars = ref<number[]>(synthWaveform(props.item.name || 'audio', WAVE_N))
let waveAbort: AbortController | null = null

function startWaveDecode(): void {
  const key = waveCacheKey(props.item)
  const hit = getCachedWave(key)
  if (hit) {
    waveBars.value = hit
    return
  }
  waveAbort = new AbortController()
  void decodeWaveform(url, WAVE_N, { maxBytes: MAX_DECODE_BYTES, signal: waveAbort.signal }).then((bars) => {
    // In-flight result may arrive after component unmount (disposed) — discard, no cache write, no render trigger.
    if (!bars || disposed) return
    setCachedWave(key, bars)
    waveBars.value = bars
  })
}
// Played bar count = progress % × total bars (determines which bars are colored vs. blank).
const playedBars = computed(() => Math.round((progressPct.value / 100) * WAVE_N))

function fmtTime(sec: number): string {
  if (!isFinite(sec) || sec < 0) sec = 0
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}
function togglePlay(): void {
  const a = audioMedia.value
  if (!a) return
  if (a.paused) void a.play().catch(() => {})
  else a.pause()
}

// Skip forward/backward: ±5s / ±30s, clamped to [0, duration].
function skip(delta: number): void {
  const a = audioMedia.value
  if (!a) return
  const d = durTime.value || a.duration || 0
  const next = Math.min(d, Math.max(0, a.currentTime + delta))
  a.currentTime = next
  curTime.value = next
}

// Playback speed: single-button cycle (like podcast app speed pill), includes 1×/1.25×/1.5×/1.75×/2×/3×.
const RATES = [1, 1.25, 1.5, 1.75, 2, 3]
const rate = ref(1)
function applyRate(): void {
  const a = audioMedia.value
  if (a) a.playbackRate = rate.value
}
function cycleRate(): void {
  const i = RATES.indexOf(rate.value)
  rate.value = RATES[(i + 1) % RATES.length]
  applyRate()
}
// Speed display: strip decimal tail on integers (1 → "1", 1.25 → "1.25").
const rateLabel = computed(() => `${rate.value}×`)

function onLoaded(): void {
  durTime.value = audioMedia.value?.duration || 0
  applyRate() // Reapply current playback speed after source change
}
function onTime(): void {
  if (!dragging) curTime.value = audioMedia.value?.currentTime || 0
}
function ratioAt(e: PointerEvent): number {
  const el = track.value
  if (!el) return 0
  const r = el.getBoundingClientRect()
  return Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
}
function onBarDown(e: PointerEvent): void {
  if (!durTime.value) return
  dragging = true
  ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  curTime.value = ratioAt(e) * durTime.value
}
function onBarMove(e: PointerEvent): void {
  if (!dragging) return
  curTime.value = ratioAt(e) * durTime.value
  const a = audioMedia.value
  if (a) a.currentTime = curTime.value
}
function onBarUp(e: PointerEvent): void {
  if (!dragging) return
  dragging = false
  const a = audioMedia.value
  if (a) a.currentTime = curTime.value
  ;(e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId)
}
onMounted(async () => {
  if (kind === 'video') {
    const Artplayer = (await import('artplayer')).default
    if (disposed) return
    artInst = new Artplayer({
      url,
      container: videoEl.value!,
      setting: true,
      flip: true,
      playbackRate: true,
      aspectRatio: true,
      subtitleOffset: true,
      fullscreenWeb: true,
      fullscreen: true,
      autoplay: true,
      pip: true,
      screenshot: true,
      airplay: true,
      playsInline: true,
      // theme-exception: artplayer control bar theme color is the library's internal rendering parameter, does not accept
      // CSS variables, cannot be tokenized — falls under third-party library exception allowed by theme convention.
      theme: '#007AE5',
      lang: locale.value.replace('_', '-'),
    })
  } else if (kind === 'audio') {
    startWaveDecode()
    // Try autoplay (blocked by browser policy will wait for user to click play button).
    void audioMedia.value?.play?.().catch(() => {})
    // Cover + title/artist (mm.fetchFromUrl) — metadata failure does not block playback.
    try {
      const mm = await import('music-metadata-browser')
      if (disposed) return
      const metadata = await mm.fetchFromUrl(url)
      if (disposed) return
      const pic = metadata.common.picture?.[0]
      if (pic) {
        const blob = new Blob([new Uint8Array(pic.data)], { type: pic.format })
        poster.value = URL.createObjectURL(blob)
        if (wrap.value) {
          wrap.value.style.backgroundImage = `url(${poster.value})`
          wrap.value.style.backgroundSize = 'cover'
          wrap.value.style.backgroundPosition = 'center'
        }
      }
      if (metadata.common.title) audioTitle.value = metadata.common.title
      if (metadata.common.artist) audioArtist.value = metadata.common.artist
    } catch {
      /* Metadata failure does not block playback */
    }
  }
})
onBeforeUnmount(() => {
  disposed = true
  waveAbort?.abort()
  if (artInst?.destroy) artInst.destroy(false)
  if (poster.value) URL.revokeObjectURL(poster.value)
})
</script>

<template>
  <ViewerShell :title="props.item.name" downloadable @close="emit('close')" @download="emit('download', props.item)">
    <div ref="wrap" class="media-wrap">
      <div v-if="kind === 'audio' && poster" class="audio-blur"></div>
      <div v-if="kind === 'video'" ref="videoEl" class="media-video"></div>
      <div v-else-if="kind === 'audio'" class="audio-layout">
        <div class="audio-player">
          <div class="np">
            <div v-if="audioTitle" class="np-title">{{ audioTitle }}</div>
            <!-- Transport controls: [-30][-5] play/pause [+5][+30], speed pill on right (three-column grid keeps play button centered) -->
            <div class="np-controls">
              <div class="np-side"></div>
              <div class="np-center">
                <button type="button" class="np-skip" :aria-label="t('audioSkipBack', { s: 30 })" @click="skip(-30)">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" /></svg>
                  <span class="np-skip-n">30</span>
                </button>
                <button type="button" class="np-skip" :aria-label="t('audioSkipBack', { s: 5 })" @click="skip(-5)">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" /></svg>
                  <span class="np-skip-n">5</span>
                </button>
                <!-- Play/pause circle button: blue-purple gradient (reuses theme color) -->
                <button type="button" class="np-play" :aria-label="playing ? 'Pause' : 'Play'" @click="togglePlay">
                  <svg v-if="!playing" class="tri" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
                  <svg v-else viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1.3" /><rect x="14" y="5" width="4" height="14" rx="1.3" /></svg>
                </button>
                <button type="button" class="np-skip np-skip-fwd" :aria-label="t('audioSkipForward', { s: 5 })" @click="skip(5)">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" /></svg>
                  <span class="np-skip-n">5</span>
                </button>
                <button type="button" class="np-skip np-skip-fwd" :aria-label="t('audioSkipForward', { s: 30 })" @click="skip(30)">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" /></svg>
                  <span class="np-skip-n">30</span>
                </button>
              </div>
              <div class="np-side np-side-right">
                <button type="button" class="np-speed" :aria-label="t('audioSpeed')" @click="cycleRate">{{ rateLabel }}</button>
              </div>
            </div>
            <!-- Waveform progress bar: centered rounded vertical bars (like recording app) + dashed baseline at silence; played portion tinted accent color; time labels at both ends -->
            <div class="np-bar-row">
              <span class="np-time">{{ fmtTime(curTime) }}</span>
              <div
                ref="track"
                class="np-wave"
                @pointerdown="onBarDown"
                @pointermove="onBarMove"
                @pointerup="onBarUp"
                @pointercancel="onBarUp"
              >
                <div class="np-wave-base"></div>
                <i
                  v-for="(a, i) in waveBars"
                  :key="i"
                  class="np-wave-bar"
                  :class="{ played: i < playedBars }"
                  :style="{ height: a * 100 + '%' }"
                ></i>
              </div>
              <span class="np-time np-time-end">{{ fmtTime(durTime) }}</span>
            </div>
          </div>
          <audio
            ref="audioMedia"
            :src="url"
            preload="auto"
            @loadedmetadata="onLoaded"
            @timeupdate="onTime"
            @play="playing = true"
            @pause="playing = false"
            @ended="playing = false"
          ></audio>
        </div>
      </div>
    </div>
  </ViewerShell>
</template>

<style scoped>
.media-wrap { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; position: relative; overflow: hidden; }
.media-video { width: 100%; height: 100%; }
/* theme-exception: Darkening/blur layer stacked on any audio cover image (not page background), needs fixed neutral dark to ensure controls readable on any cover, theme-independent */
.audio-blur {
  position: absolute; inset: 0; z-index: 0; background-size: cover; background-position: center;
  background-color: rgba(53, 54, 58, 0.4); /* theme-exception: Glass layer stacked on cover image, theme-independent */ backdrop-filter: blur(10px) saturate(180%);
}

/* Audio layout: player centered with width limit. */
.audio-layout { position: relative; z-index: 1; width: 100%; height: 100%; max-width: 60rem; margin: 0 auto; display: flex; flex-direction: column; justify-content: center; gap: 20px; padding: 24px; box-sizing: border-box; }
.audio-player { flex: 0 0 auto; min-width: 0; display: flex; align-items: center; justify-content: center; }

/* ── Custom minimal player (per reference design) ──────────────────────────────
   Play button centered above progress bar; progress bar = transparent track + blue-purple played bar + circular handle; color scheme reuses homepage blue-purple. */
.np { width: 100%; max-width: 40rem; display: flex; flex-direction: column; align-items: center; gap: 20px; }
.np-title { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 15px; font-weight: 600; color: var(--fg); }

.np-play {
  flex: 0 0 auto; width: 60px; height: 60px; border-radius: 50%; border: none; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, var(--grad-a), var(--grad-b));
  box-shadow: 0 8px 22px -6px var(--accent-soft-bd);
  transition: transform 0.16s ease, box-shadow 0.16s ease;
}
.np-play:hover { transform: translateY(-1px) scale(1.03); box-shadow: 0 10px 26px -6px var(--accent-soft-bd); }
.np-play:active { transform: scale(0.97); }
.np-play svg { width: 26px; height: 26px; fill: #fff; } /* theme-exception: Play button icon always stacked on color gradient button, white contrast stable across both themes */
.np-play svg.tri { margin-left: 3px; } /* Triangle optical centering */

/* Transport controls: three-column grid (1fr / auto / 1fr) — play button cluster always centered in middle column, speed pill in right column. */
.np-controls { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; width: 100%; max-width: 40rem; }
.np-center { display: flex; align-items: center; justify-content: center; gap: 12px; }
.np-side { display: flex; align-items: center; min-width: 0; }
.np-side-right { justify-content: flex-end; }

/* Skip forward/backward circle button: hollow circular looping arrow + seconds label in center. Forward button horizontally mirrors the arrow. */
.np-skip {
  position: relative; flex: 0 0 auto; width: 44px; height: 44px; border-radius: 50%; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  background: transparent; border: none; color: var(--fg-muted);
  transition: background 0.16s, color 0.16s, transform 0.16s;
}
.np-skip:hover { background: var(--hover); color: var(--fg); }
.np-skip:active { transform: scale(0.94); }
.np-skip svg { width: 30px; height: 30px; fill: currentColor; }
.np-skip-fwd svg { transform: scaleX(-1); }
.np-skip-n {
  position: absolute; top: 55%; left: 50%; transform: translate(-50%, -50%);
  font-size: 10px; font-weight: 700; font-variant-numeric: tabular-nums; line-height: 1; pointer-events: none;
}

/* Speed pill: single-button cycle toggle (1× → 1.25× → … → 3× → 1×). */
.np-speed {
  flex: 0 0 auto; min-width: 46px; padding: 6px 12px; border-radius: 999px; cursor: pointer;
  font-size: 14px; font-weight: 700; font-variant-numeric: tabular-nums;
  background: transparent; border: 1px solid var(--border); color: var(--fg-muted);
  transition: background 0.16s, color 0.16s, border-color 0.16s;
}
.np-speed:hover { background: var(--hover); color: var(--fg); border-color: var(--accent-soft-bd); }
.np-speed:active { transform: scale(0.96); }

.np-bar-row { display: flex; align-items: center; gap: 14px; width: 100%; }
.np-time { flex: 0 0 auto; min-width: 46px; font-size: 15px; font-variant-numeric: tabular-nums; color: var(--fg-muted); }
.np-time-end { text-align: right; }

/* Waveform progress bar: vertical bars symmetrically surround centerline on both sides (achieved via align-items:center); dashed baseline shows through at silence.
   Vertical bars use flex-basis for fixed width + space-between for even distribution, narrow screens auto-shrink; click hotspot expands 6px up and down via ::before. */
.np-wave {
  position: relative; flex: 1 1 auto; height: 46px; min-width: 0;
  display: flex; align-items: center; justify-content: space-between;
  cursor: pointer; touch-action: none;
}
.np-wave::before { content: ''; position: absolute; left: 0; right: 0; top: -6px; bottom: -6px; }
/* Dashed baseline at silence (runs across entire bar, only visible at silent gaps) */
.np-wave-base { position: absolute; left: 0; right: 0; top: 50%; height: 0; border-top: 1px dashed var(--fg-faint); transform: translateY(-50%); pointer-events: none; }
/* Single vertical bar: fixed 3px wide, rounded cap; unplayed = silence muted color token, played = accent color. Height controlled inline by amplitude. */
.np-wave-bar { position: relative; flex: 0 1 3px; max-width: 3px; border-radius: 999px; background: var(--wave-none); transition: background 0.12s, height 0.3s var(--ease); }
.np-wave-bar.played { background: var(--accent); }
.np-wave:hover .np-wave-bar.played { background: var(--accent2); }

/* Narrow screen: tighten padding */
@media (max-width: 860px) {
  .audio-layout { gap: 16px; padding: 16px; }
}
</style>
