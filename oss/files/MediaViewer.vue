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

// Artplayer 是第三方互操作边界，无需超出 destroy 的共享类型，any 是有意为之。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let artInst: any = null
// 组件在异步 onMounted 的 await 期间可能已被卸载(用户快速关闭覆盖层)——卸载后放弃构造。
let disposed = false

// ── 音频：自定义极简播放器（原生 <audio> + 自绘进度条，仿参考图）─────────────
//   布局：播放/暂停圆钮在「进度条上方」居中；进度条=透明轨道 + 蓝紫已播条 + 圆形拉链，
//   两端各一个时间标签。已删除原 APlayer 皮肤与波纹动画。配色沿用主页蓝紫。
const audioMedia = ref<HTMLAudioElement | null>(null)
const track = ref<HTMLElement | null>(null)
const playing = ref(false)
const curTime = ref(0)
const durTime = ref(0)
let dragging = false

const progressPct = computed(() =>
  durTime.value ? Math.min(100, Math.max(0, (curTime.value / durTime.value) * 100)) : 0,
)

// ── 声波进度条（仿录音 app）──────────────────────────────────────────
//   进度条画成语音波形：居中的圆角竖条 + 静音处的虚线基线。已播部分染强调色。
//   数据源两级：先按文件名合成占位(0 延迟)，后台解码真实音频后无缝替换；
//   超 50MB / 解码失败 / 命中不了都静默停留在合成，详见 ./waveform 与设计 spec。
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
    // 在途结果到达时组件可能已卸载(disposed)——丢弃，不写缓存也不触发渲染。
    if (!bars || disposed) return
    setCachedWave(key, bars)
    waveBars.value = bars
  })
}
// 已播竖条数量 = 进度占比 × 总条数（决定每条染色/留白）。
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

// 快进/快退：±5s / ±30s，钳制在 [0, 时长]。
function skip(delta: number): void {
  const a = audioMedia.value
  if (!a) return
  const d = durTime.value || a.duration || 0
  const next = Math.min(d, Math.max(0, a.currentTime + delta))
  a.currentTime = next
  curTime.value = next
}

// 倍速：单钮循环（仿播客 app 的倍速药丸），含 1×/1.25×/1.5×/1.75×/2×/3×。
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
// 倍速显示：去掉整数的小数尾（1 → "1"，1.25 → "1.25"）。
const rateLabel = computed(() => `${rate.value}×`)

function onLoaded(): void {
  durTime.value = audioMedia.value?.duration || 0
  applyRate() // 换源后重新套用当前倍速
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
      theme: '#007AE5',
      lang: locale.value.replace('_', '-'),
    })
  } else if (kind === 'audio') {
    startWaveDecode()
    // 尝试自动播放（被浏览器策略拦截则等用户点播放按钮）。
    void audioMedia.value?.play?.().catch(() => {})
    // 封面 + 标题/艺术家(Vue2 mm.fetchFromUrl)——元数据失败不阻断播放。
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
      /* 元数据失败不阻断播放 */
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
            <!-- 传输控件：[-30][-5] 播放/暂停 [+5][+30]，倍速药丸靠右（三列网格保证播放钮恒居中） -->
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
                <!-- 播放/暂停圆钮：蓝紫渐变（沿用主题色） -->
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
            <!-- 声波进度条：居中圆角竖条(仿录音 app) + 静音虚线基线；已播染强调色；两端时间标签 -->
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
/* theme-exception: 叠在任意音频封面图之上的暗化/模糊层（非页面背景），需固定中性暗色保证控件在任意封面上都可读，与页面主题无关 */
.audio-blur {
  position: absolute; inset: 0; z-index: 0; background-size: cover; background-position: center;
  background-color: rgba(53, 54, 58, 0.4); /* theme-exception: 叠在封面图上的玻璃底, 与主题无关 */ backdrop-filter: blur(10px) saturate(180%);
}

/* 音频布局：播放器居中限宽显示。 */
.audio-layout { position: relative; z-index: 1; width: 100%; height: 100%; max-width: 60rem; margin: 0 auto; display: flex; flex-direction: column; justify-content: center; gap: 20px; padding: 24px; box-sizing: border-box; }
.audio-player { flex: 0 0 auto; min-width: 0; display: flex; align-items: center; justify-content: center; }

/* ── 自定义极简播放器（仿参考图）──────────────────────────────
   播放钮居中在进度条上方；进度条透明轨道 + 蓝紫已播 + 圆形拉链；配色沿用主页蓝紫。 */
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
.np-play svg { width: 26px; height: 26px; fill: #fff; } /* theme-exception: 播放钮图标恒叠在彩色渐变按钮上，白色对比度两套主题都稳定 */
.np-play svg.tri { margin-left: 3px; } /* 三角形光学居中 */

/* 传输控件：三列网格(1fr / auto / 1fr)——中列的播放簇恒居中，倍速药丸落在右列。 */
.np-controls { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; width: 100%; max-width: 40rem; }
.np-center { display: flex; align-items: center; justify-content: center; gap: 12px; }
.np-side { display: flex; align-items: center; min-width: 0; }
.np-side-right { justify-content: flex-end; }

/* 快进/快退圆钮：镂空圆形回环箭头 + 中央秒数标签。前进钮水平镜像箭头。 */
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

/* 倍速药丸：单钮循环切换（1× → 1.25× → … → 3× → 1×）。 */
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

/* 声波进度条：竖条围绕中线两侧对称(靠 align-items:center 实现)；静音处虚线基线透出。
   竖条以 flex-basis 固定宽 + space-between 均布，窄屏自动收窄；点击热区靠 ::before 上下各撑 6px。 */
.np-wave {
  position: relative; flex: 1 1 auto; height: 46px; min-width: 0;
  display: flex; align-items: center; justify-content: space-between;
  cursor: pointer; touch-action: none;
}
.np-wave::before { content: ''; position: absolute; left: 0; right: 0; top: -6px; bottom: -6px; }
/* 静音虚线基线（贯穿整条，静音间隙处只剩它） */
.np-wave-base { position: absolute; left: 0; right: 0; top: 50%; height: 0; border-top: 1px dashed var(--fg-faint); transform: translateY(-50%); pointer-events: none; }
/* 单根竖条：固定 3px 宽、圆头；未播=静场淡色 token，已播=强调色。height 由振幅内联控制。 */
.np-wave-bar { position: relative; flex: 0 1 3px; max-width: 3px; border-radius: 999px; background: var(--wave-none); transition: background 0.12s, height 0.3s var(--ease); }
.np-wave-bar.played { background: var(--accent); }
.np-wave:hover .np-wave-bar.played { background: var(--accent2); }

/* 窄屏：收紧内边距 */
@media (max-width: 860px) {
  .audio-layout { gap: 16px; padding: 16px; }
}
</style>
