<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import ViewerShell from './ViewerShell.vue'
import { mediaKind } from './mediaKind'
import { lookupTranscript, parseTimestamp } from './audioTranscripts'
import type { TranscriptSegment } from './audioTranscripts'
import { speakerToken, segMatches, barSpeakers } from './speakerWave'
import { WAVE_N, synthWaveform, decodeWaveform, waveCacheKey, getCachedWave, setCachedWave } from './waveform'
import type { FileEntry } from '../stores/files'

const props = defineProps<{ item: FileEntry; list: FileEntry[] }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'download', entry: FileEntry): void }>()
const { t, locale } = useI18n()

const kind = mediaKind(props.item.name)

// 音频转录/摘要（写死 demo）：命中文件名才显示下方面板。默认展开「摘要」页。
const transcript = computed(() => (kind === 'audio' ? lookupTranscript(props.item.name) : null))
const tab = ref<'summary' | 'transcript' | 'ask'>('summary')

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

// 波形×说话人:仅当转录带说话人数据时启用(spec §3;无说话人音频保持旧渲染分支零变化)。
// durTime 为 0(loadedmetadata 前)时 barSpeakers 返回全 null → 全部竖条先走 --wave-none,就绪后响应式重算。
const barSpk = computed<(string | null)[]>(() => {
  const tr = transcript.value
  if (!tr?.speakers?.length) return []
  return barSpeakers(tr.segments, durTime.value, WAVE_N)
})
const waveSpeakerMode = computed(() => barSpk.value.length > 0)
// 竖条内联色:dim 时直接给 var(--wave-dim)(内联样式优先级高于样式表,.dim 的 CSS 覆盖到不了内联值)。
function barColor(i: number): string {
  if (barDim(i)) return 'var(--wave-dim)'
  const id = barSpk.value[i]
  return id ? speakerColor(id) : 'var(--wave-none)'
}
// 过滤压暗:非全选时,该条说话人不在选中集(或静场条)即压暗;
// 全选=等效无过滤全不压暗,全不选=全压暗(与转录列表口径一致)。
function barDim(i: number): boolean {
  if (!waveSpeakerMode.value || allPicked.value) return false
  const id = barSpk.value[i]
  return !id || !pickedSpeakers.value.has(id)
}

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
// 点击转录分段 → 跳到对应时间并继续播放。
function seekTo(ts: string): void {
  const a = audioMedia.value
  if (!a) return
  a.currentTime = parseTimestamp(ts)
  void a.play().catch(() => {})
}

// 转录高亮：当前播放到的分段 = 起始时间 ≤ 播放位置的最后一段。随 curTime 实时变化。
const transcriptEl = ref<HTMLElement | null>(null)
const activeSeg = computed(() => {
  const segs = transcript.value?.segments
  if (!segs) return -1
  let idx = -1
  for (let i = 0; i < segs.length; i++) {
    if (parseTimestamp(segs[i].t) <= curTime.value + 0.05) idx = i
    else break
  }
  return idx
})
// 高亮段滚动到可视区（就近，平滑）。仅在转录 tab 打开时（按分段原始索引 data-seg 定位）。
function scrollActiveIntoView(): void {
  if (tab.value !== 'transcript' || activeSeg.value < 0) return
  const el = transcriptEl.value?.querySelector(`[data-seg="${activeSeg.value}"]`) as HTMLElement | null
  el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
}
watch(activeSeg, () => scrollActiveIntoView())
watch(tab, (v) => { if (v === 'transcript') void nextTick(scrollActiveIntoView) })

// ── 转录面板（智能章节 / 说话人分离 / 重点高光 / Ask Nimo）─────────────────────
//   章节 / 说话人 / 高光数据均由用户提供的真实字幕（audioTranscripts）解析而来；
//   仅 Ask Nimo 的问答回复仍是占位（等向量问答后端接入后替换成流式请求）。

// 「只看重点」筛选（重点高光）。
const highlightsOnly = ref(false)

// 说话人过滤(master-checkbox 语义):选中集=显示哪些人,初始全选;
// 空集=全不选=全隐藏。「全部」不是独立状态,只是全选/全不选的主开关。
// 整体替换 Set 实例保证 watch 可靠触发。
const speakers = computed(() => transcript.value?.speakers ?? [])
const hasSpeakers = computed(() => speakers.value.length > 0)
const pickedSpeakers = ref<Set<string>>(new Set(speakers.value.map((s) => s.id)))
// 全选时「全部」点亮;少选任何一个即灭。全选也意味着说话人过滤等效关闭。
const allPicked = computed(() => hasSpeakers.value && pickedSpeakers.value.size === speakers.value.length)
function toggleSpeaker(id: string): void {
  const next = new Set(pickedSpeakers.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  pickedSpeakers.value = next
}
function toggleAll(): void {
  pickedSpeakers.value = allPicked.value ? new Set() : new Set(speakers.value.map((s) => s.id))
}
// 过滤变化后若当前段仍在列表,平滑滚回可见（需求 5）。
watch([pickedSpeakers, highlightsOnly], () => void nextTick(scrollActiveIntoView))

// 转录展示行：把「智能章节」标题穿插进分段流。row 携带分段原始索引 i（用于高亮/跳转/定位）。
type TransRow =
  | { type: 'chapter'; title: string; t: string }
  | { type: 'seg'; seg: TranscriptSegment; i: number }
// 说话人过滤"激活"= 非全选(全选等效于没过滤);无说话人数据时恒不激活。
const filtering = computed(() => highlightsOnly.value || (hasSpeakers.value && !allPicked.value))
const transcriptRows = computed<TransRow[]>(() => {
  const tr = transcript.value
  if (!tr) return []
  const chapterAt = new Map<string, string>()
  for (const c of tr.chapters ?? []) chapterAt.set(c.t, c.title)
  const rows: TransRow[] = []
  tr.segments.forEach((seg, i) => {
    if (!segMatches(seg, hasSpeakers.value ? pickedSpeakers.value : null, highlightsOnly.value)) return
    // 过滤激活（只看重点 / 说话人筛选）时不插章节头（避免出现空章节）。
    if (!filtering.value && chapterAt.has(seg.t)) {
      rows.push({ type: 'chapter', title: chapterAt.get(seg.t) as string, t: seg.t })
    }
    rows.push({ type: 'seg', seg, i })
  })
  return rows
})
const hasHighlights = computed(() => !!transcript.value?.segments.some((s) => s.highlight))

// 说话人分离：id → 显示名 / 颜色 token(--spk-N,5 色循环;波形与转录共用同一映射)。
function speakerName(id?: string): string {
  if (!id) return ''
  const found = transcript.value?.speakers?.find((s) => s.id === id)
  return found?.name ?? id
}
function speakerColor(id?: string): string {
  const list = transcript.value?.speakers ?? []
  const idx = Math.max(0, list.findIndex((s) => s.id === id))
  return speakerToken(idx)
}

// Ask Nimo AI：转录已向量化，可对本段音频提问。
// demo 阶段答案是「针对本音频预置」的高质量回答（下方 PRESETS，引用真实章节/时间点）；
// 命中预置问题→给对应答案，否则回落到占位文案。接后端时把 answerFor 换成流式请求 NimoOS-AI 即可。
interface AskMsg { role: 'user' | 'ai'; text: string }
const askInput = ref('')
const askMsgs = ref<AskMsg[]>([])
const askScrollEl = ref<HTMLElement | null>(null)

const PRESETS: { q: string; a: string }[] = [
  {
    q: "What's this recording about?",
    a:
      'A recording of an audio-production class where the instructor walks students through how sound becomes digital. The thread:\n' +
      '• Timbre & harmonics — how the mouth and throat shift formants, and harmonic vs. non-harmonic vs. inharmonic sound (0:00)\n' +
      '• Phase & phase cancellation — why multi-mic recordings cancel, and how that gets used for flanging and chorus (1:35)\n' +
      '• A short history of recording — wax cylinder → vinyl → magnetic tape → the move to digital (4:13)\n' +
      '• How computers represent sound — binary, sampling, the Nyquist theorem, why 44.1 kHz, and aliasing (13:56)\n' +
      '• Bit depth & quantization — 16 / 24 / 32-bit and quantization noise (23:37)\n' +
      '• File formats — uncompressed WAV/AIFF, lossless FLAC, lossy MP3/M4A/OGG, with a live listening test on a Mahler excerpt at different bit depths and bit rates (27:40)\n' +
      'It plays as a back-and-forth: the instructor keeps asking questions and students answer throughout.',
  },
  {
    q: 'List every student question and how it was answered.',
    a:
      'The class is Q&A-driven — here is every moment a student speaks, what was being asked, and how it resolved:\n' +
      '1. (5:34) Downside of the wax cylinder? — Student: “wax is super easy to change.” → Right: it\'s literally made of wax, so it\'s easily damaged and degrades over time.\n' +
      '2. (16:20) Sampled at 10 points, does it still look like the original sine wave? — Student: “Yeah, close enough.” → Close, but the pointy bits already change the sound; 10 points isn\'t enough.\n' +
      '3. (19:46) What is a video\'s “sampling rate” called? — Student: “Frame rate?” → Right idea.\n' +
      '4. (20:04) Historical film frame rate? — Student: “Is it 24?” → Exactly, 24 fps — which is why 48 kHz pairs with video.\n' +
      '5. (29:08) Difference between WAV and AIFF? — Student: “WAV is Windows, AIFF is Mac?” → Exactly: WAV = Windows Audio/Video, AIFF = Apple Interleave File Format.\n' +
      '6. (33:53) Where have you seen OGG files? — Student: “in games.” → Yes, OGG is common in game development.\n' +
      '7. (37:49) 24-bit vs 16-bit listening test — Student: “Sounds similar, but on the loud parts I hear extra noise.” → Confirmed.\n' +
      '8. (39:55) 8-bit Mahler — what\'s the problem? — Student: “It\'s a lot of static, especially the low notes.” → Exactly: that\'s quantization noise.',
  },
  {
    q: 'Why is CD audio sampled at 44.1 kHz?',
    a:
      'It comes from the Nyquist theorem (17:15): to capture a frequency accurately you have to sample at least twice that frequency.\n' +
      'Human hearing tops out around 20 kHz, so the theoretical floor is 40 kHz (17:51). The extra 4.1 kHz is headroom against aliasing — ' +
      'if the sample rate is too low, high frequencies “alias” into false lower tones and muddy the sound (20:40).\n' +
      'As for the exact 44.1 number, the lecture repeats the well-known story: Sony\'s CEO wanted a CD to hold all of Beethoven\'s Ninth Symphony, ' +
      'and 44.1 kHz was the most headroom they could give while still fitting the Ninth (18:26).\n' +
      'Side note: video work prefers 48k / 96k because they divide evenly against the 24 fps film frame rate (18:53).',
  },
]
const askChips = PRESETS.map((p) => p.q)

function answerFor(q: string): string {
  const norm = q.trim().replace(/[？?]/g, '')
  const hit = PRESETS.find((p) => p.q.replace(/[？?]/g, '') === norm)
  return hit ? hit.a : t('audioAskDemo')
}

let askTimer: ReturnType<typeof setInterval> | null = null
function stopStream(): void {
  if (askTimer) { clearInterval(askTimer); askTimer = null }
}
function scrollAskToBottom(): void {
  const el = askScrollEl.value
  if (el) el.scrollTop = el.scrollHeight
}
function sendAsk(): void {
  const q = askInput.value.trim()
  if (!q) return
  stopStream()
  askMsgs.value.push({ role: 'user', text: q })
  askInput.value = ''
  const full = answerFor(q)
  const idx = askMsgs.value.push({ role: 'ai', text: '' }) - 1
  // 打字机流式效果（demo 用；接后端后换成真实 token 流）
  let n = 0
  askTimer = setInterval(() => {
    if (disposed) return stopStream()
    n += 2
    askMsgs.value[idx].text = full.slice(0, n)
    void nextTick(scrollAskToBottom)
    if (n >= full.length) { askMsgs.value[idx].text = full; stopStream() }
  }, 16)
}
function pickAskChip(q: string): void {
  askInput.value = q
  sendAsk()
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
  stopStream()
  if (artInst?.destroy) artInst.destroy(false)
  if (poster.value) URL.revokeObjectURL(poster.value)
})
</script>

<template>
  <ViewerShell :title="props.item.name" downloadable @close="emit('close')" @download="emit('download', props.item)">
    <div ref="wrap" class="media-wrap" :class="{ 'has-panel': kind === 'audio' && !!transcript }">
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
                :class="{ spk: waveSpeakerMode }"
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
                  :class="{ played: i < playedBars, dim: barDim(i) }"
                  :style="waveSpeakerMode ? { height: a * 100 + '%', '--bar-c': barColor(i) } : { height: a * 100 + '%' }"
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
        <aside v-if="transcript" class="audio-panel">
          <div class="ap-tabs">
            <button type="button" class="ap-tab" :class="{ active: tab === 'summary' }" @click="tab = 'summary'">{{ t('audioSummary') }}</button>
            <button type="button" class="ap-tab" :class="{ active: tab === 'transcript' }" @click="tab = 'transcript'">{{ t('audioTranscript') }}</button>
            <button type="button" class="ap-tab ap-tab-ask" :class="{ active: tab === 'ask' }" @click="tab = 'ask'">{{ t('audioAsk') }}</button>
          </div>

          <!-- Summary -->
          <div v-if="tab === 'summary'" class="ap-scroll">
            <div class="ap-summary">
              <p class="ap-summary-text">{{ transcript.summary }}</p>
              <div v-if="transcript.keywords.length" class="ap-kw">
                <span v-for="k in transcript.keywords" :key="k" class="ap-chip">{{ k }}</span>
              </div>
            </div>
          </div>

          <!-- Transcript：智能章节 + 说话人分离 + 重点高光（含「只看重点」筛选） -->
          <template v-else-if="tab === 'transcript'">
            <div v-if="hasHighlights || hasSpeakers" class="ap-tools">
              <button v-if="hasHighlights" type="button" class="ap-tool" :class="{ on: highlightsOnly }" @click="highlightsOnly = !highlightsOnly">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5l2.6 5.7 6.2.6-4.7 4.1 1.4 6.1L12 16.9 6.5 20.1l1.4-6.1L3.2 9.8l6.2-.6z" /></svg>
                {{ highlightsOnly ? t('audioShowAll') : t('audioHighlightsOnly') }}
              </button>
              <!-- 说话人过滤 chips:「全部」=全选/全不选主开关(全选时亮),每说话人一个多选;与只看重点 AND 叠加 -->
              <template v-if="hasSpeakers">
                <button type="button" class="spk-chip spk-chip-all" :class="{ on: allPicked }" @click="toggleAll">
                  {{ t('audioSpeakerAll') }}
                </button>
                <button
                  v-for="(sp, si) in speakers"
                  :key="sp.id"
                  type="button"
                  class="spk-chip"
                  :class="{ on: pickedSpeakers.has(sp.id) }"
                  :style="{ '--c': speakerToken(si) }"
                  @click="toggleSpeaker(sp.id)"
                >
                  <span class="spk-dot"></span>{{ sp.name }}
                </button>
              </template>
            </div>
            <ul ref="transcriptEl" class="ap-scroll ap-transcript">
              <template v-for="(row, ri) in transcriptRows" :key="ri">
                <!-- 智能章节标题（点击跳转） -->
                <li v-if="row.type === 'chapter'" class="ap-chapter" @click="seekTo(row.t)">
                  <span class="ap-chapter-t">{{ row.t }}</span>
                  <span class="ap-chapter-title">{{ row.title }}</span>
                </li>
                <!-- 分段：时间 + 说话人 + 文本（重点句高光） -->
                <li v-else class="ap-seg" :class="{ active: row.i === activeSeg, hl: row.seg.highlight }" :data-seg="row.i" @click="seekTo(row.seg.t)">
                  <span class="ap-time">{{ row.seg.t }}</span>
                  <span class="ap-seg-body">
                    <span v-if="row.seg.speaker" class="ap-speaker" :style="{ '--c': speakerColor(row.seg.speaker) }">
                      <span class="ap-speaker-dot"></span>{{ speakerName(row.seg.speaker) }}
                    </span>
                    <span class="ap-seg-text">
                      <svg v-if="row.seg.highlight" class="ap-hl-star" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5l2.6 5.7 6.2.6-4.7 4.1 1.4 6.1L12 16.9 6.5 20.1l1.4-6.1L3.2 9.8l6.2-.6z" /></svg>{{ row.seg.text }}
                    </span>
                  </span>
                </li>
              </template>
            </ul>
          </template>

          <!-- Ask Nimo：转录已向量化，可对本段音频提问（架子占位，未接后端） -->
          <template v-else>
            <div ref="askScrollEl" class="ap-ask-scroll">
              <div v-if="!askMsgs.length" class="ap-ask-empty">
                <p class="ap-ask-hint">{{ t('audioAskEmpty') }}</p>
                <div class="ap-ask-chips">
                  <button v-for="c in askChips" :key="c" type="button" class="ap-chip ap-chip-btn" @click="pickAskChip(c)">{{ c }}</button>
                </div>
              </div>
              <div v-else class="ap-ask-msgs">
                <div v-for="(m, mi) in askMsgs" :key="mi" class="ap-msg" :class="m.role">{{ m.text }}</div>
              </div>
            </div>
            <div v-if="askMsgs.length" class="ap-ask-chips ap-ask-chips-bar">
              <button v-for="c in askChips" :key="c" type="button" class="ap-chip ap-chip-btn" @click="pickAskChip(c)">{{ c }}</button>
            </div>
            <form class="ap-ask-bar" @submit.prevent="sendAsk">
              <input v-model="askInput" class="ap-ask-input" :placeholder="t('audioAskPlaceholder')" :aria-label="t('audioAsk')" />
              <button type="submit" class="ap-ask-send" :aria-label="t('audioAsk')" :disabled="!askInput.trim()">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l16-8-6 16-3.5-6.5L4 12z" /></svg>
              </button>
            </form>
          </template>
        </aside>
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

/* 音频布局：纵向——播放器在上、转录/摘要面板在下；居中限宽。
   无转录时播放器垂直居中；有转录时播放器贴顶、面板占余下高度并可滚动。 */
.audio-layout { position: relative; z-index: 1; width: 100%; height: 100%; max-width: 60rem; margin: 0 auto; display: flex; flex-direction: column; gap: 20px; padding: 24px; box-sizing: border-box; }
.media-wrap:not(.has-panel) .audio-layout { justify-content: center; }
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
/* 单根竖条：固定 3px 宽、圆头；未播=中性淡色，已播=强调色。height 由振幅内联控制。 */
.np-wave-bar { position: relative; flex: 0 1 3px; max-width: 3px; border-radius: 999px; background: var(--fg-subtle); transition: background 0.12s, height 0.3s var(--ease); }
.np-wave-bar.played { background: var(--accent); }
.np-wave:hover .np-wave-bar.played { background: var(--accent2); }

/* ── 说话人模式(.np-wave.spk,仅转录带说话人数据时):每根竖条按该时段说话人取色,
   进度 = 不透明度(已播满色/未播同色淡出),说话人配色与播放进度同时可读。 ── */
.np-wave.spk .np-wave-bar {
  background: var(--bar-c, var(--wave-none)); opacity: 0.30;
  transition: background 0.14s, opacity 0.14s, filter 0.14s, height 0.3s var(--ease);
}
.np-wave.spk .np-wave-bar.played { background: var(--bar-c, var(--wave-none)); opacity: 1; }
.np-wave.spk:hover .np-wave-bar.played { background: var(--bar-c, var(--wave-none)); }
/* 过滤:未选中说话人的竖条去色转灰(转灰由内联 --bar-c 给 var(--wave-dim) 实现)并进一步压暗 */
.np-wave.spk .np-wave-bar.dim { opacity: 0.12; }
.np-wave.spk .np-wave-bar.dim.played { opacity: 0.30; }
.np-wave.spk:hover .np-wave-bar.played:not(.dim) { filter: brightness(1.12); }

/* 转录/摘要面板 —— 消费全局 theme token（见 src/styles/theme.css）：
   白色模式=米白底 + 白卡 + Azure 蓝强调；蓝色模式=深色玻璃。 */
.audio-panel {
  flex: 1 1 auto; width: 100%; min-width: 0; min-height: 0;
  display: flex; flex-direction: column; overflow: hidden;
  border-radius: 20px; border: 1px solid var(--border);
  background: var(--bg); color: var(--fg);
  box-shadow: var(--card-shadow-hi);
}
.ap-tabs { display: flex; gap: 8px; padding: 16px 18px 10px; flex: 0 0 auto; }
.ap-tab {
  padding: 7px 16px; border-radius: 999px; font-size: 15px; font-weight: 600; cursor: pointer;
  background: transparent; border: 1px solid var(--border);
  color: var(--fg-muted); transition: background 0.18s, border-color 0.18s, color 0.18s;
}
.ap-tab:hover { background: var(--hover); color: var(--fg); }
.ap-tab.active { background: var(--accent-soft); border-color: var(--accent-soft-bd); color: var(--accent-text); }

.ap-scroll { flex: 1 1 auto; overflow-y: auto; padding: 6px 20px 12px; min-height: 0; }

.ap-summary-text { margin: 6px 0 16px; font-size: 15px; line-height: 1.68; color: var(--fg); }
.ap-kw { display: flex; flex-wrap: wrap; gap: 8px; }
.ap-chip { padding: 5px 12px; border-radius: 999px; font-size: 15px; color: var(--accent-text); background: var(--accent-soft); border: 1px solid var(--accent-soft-bd); }

/* ── 转录：智能章节 + 说话人分离 + 重点高光 ─────────────────────────── */
.ap-transcript { list-style: none; margin: 0; padding: 4px 14px 12px; display: flex; flex-direction: column; gap: 2px; }
.ap-seg { display: flex; gap: 14px; padding: 10px 12px; border-radius: 12px; cursor: pointer; transition: background 0.16s, box-shadow 0.16s; }
.ap-seg:hover { background: var(--hover); }
.ap-time { flex: 0 0 auto; width: 48px; font-size: 15px; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--accent-text); padding-top: 2px; }
.ap-seg:hover .ap-time { color: var(--accent); }
.ap-seg-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.ap-seg-text { font-size: 15px; line-height: 1.6; color: var(--fg); }
/* 说话人分离：小圆点 + 名字（颜色由 --c 注入,值为 var(--spk-N) token） */
.ap-speaker { display: inline-flex; align-items: center; gap: 6px; font-size: 15px; font-weight: 700; letter-spacing: 0.02em; color: var(--c); }
.ap-speaker-dot { width: 7px; height: 7px; border-radius: 50%; flex: 0 0 auto; background: var(--c); }
/* 正在播放的分段高亮（Azure 蓝，沿用搜索框强调色）——左侧强调条 + 加深文字 */
.ap-seg.active { background: var(--accent-soft); box-shadow: inset 3px 0 0 var(--accent); }
.ap-seg.active .ap-time { color: var(--accent-text); }
.ap-seg.active .ap-seg-text { color: var(--fg); font-weight: 500; }
.ap-hl-star { width: 13px; height: 13px; fill: var(--hl-star); vertical-align: -2px; margin-right: 5px; }

/* 智能章节标题（点击跳转） */
.ap-chapter { display: flex; align-items: baseline; gap: 12px; padding: 14px 12px 6px; margin-top: 4px; cursor: pointer; }
.ap-chapter:first-child { margin-top: 0; }
.ap-chapter-t { flex: 0 0 auto; width: 48px; font-size: 15px; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--fg-subtle); }
.ap-chapter-title { font-size: 15px; font-weight: 700; letter-spacing: 0.03em; text-transform: uppercase; color: var(--accent-text); }
.ap-chapter:hover .ap-chapter-title { color: var(--accent); }

/* 转录工具条（「只看重点」筛选） */
.ap-tools { flex: 0 0 auto; display: flex; flex-wrap: wrap; gap: 8px; padding: 4px 20px 6px; }
.ap-tool {
  display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px; border-radius: 999px; cursor: pointer;
  font-size: 15px; font-weight: 600; color: var(--fg-muted);
  background: transparent; border: 1px solid var(--border);
  transition: background 0.16s, color 0.16s, border-color 0.16s;
}
.ap-tool svg { width: 13px; height: 13px; fill: currentColor; }
.ap-tool:hover { background: var(--hover); color: var(--fg); }
.ap-tool.on { background: var(--accent-soft); border-color: var(--accent-soft-bd); color: var(--accent-text); }

/* ── 说话人过滤 chip:说话人色圆点 + color-mix 光环;选中时边框/底色用该说话人色 ── */
.spk-chip {
  display: inline-flex; align-items: center; gap: 8px; padding: 5px 14px; border-radius: 999px;
  font-size: 15px; font-weight: 600; cursor: pointer; border: 1px solid var(--border);
  background: transparent; color: var(--fg-muted); transition: color 0.15s, border-color 0.15s, background 0.15s;
}
.spk-chip .spk-dot {
  width: 9px; height: 9px; border-radius: 50%; flex: 0 0 auto; background: var(--c);
  box-shadow: 0 0 0 3px color-mix(in oklab, var(--c) 20%, transparent); transition: box-shadow 0.15s;
}
.spk-chip:hover { border-color: var(--fg-faint); color: var(--fg); }
.spk-chip.on { color: var(--fg); border-color: var(--c); background: color-mix(in oklab, var(--c) 15%, transparent); }
.spk-chip.on .spk-dot { box-shadow: 0 0 0 3px color-mix(in oklab, var(--c) 38%, transparent); }
/* 「全部」chip:无说话人色,选中用中性 accent */
.spk-chip-all.on { color: var(--accent-text); border-color: var(--accent-soft-bd); background: var(--accent-soft); }

/* ── Ask Nimo（架子占位）───────────────────────────────────────── */
.ap-ask-scroll { flex: 1 1 auto; overflow-y: auto; min-height: 0; padding: 10px 20px; display: flex; flex-direction: column; }
.ap-ask-empty { margin: auto 0; display: flex; flex-direction: column; align-items: center; gap: 16px; text-align: center; padding: 20px 0; }
.ap-ask-hint { margin: 0; font-size: 15px; line-height: 1.6; color: var(--fg-muted); max-width: 30rem; }
.ap-ask-chips { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
.ap-ask-chips-bar { justify-content: flex-start; padding: 4px 16px 0; }
.ap-chip-btn { cursor: pointer; color: var(--accent-text); background: var(--accent-soft); border-color: var(--accent-soft-bd); transition: background 0.16s, border-color 0.16s; }
.ap-chip-btn:hover { background: var(--accent-soft-2); border-color: var(--accent-soft-bd); }
.ap-ask-msgs { display: flex; flex-direction: column; gap: 10px; }
.ap-msg { max-width: 80%; padding: 10px 14px; border-radius: 16px; font-size: 15px; line-height: 1.6; white-space: pre-wrap; word-break: break-word; }
.ap-msg.user { align-self: flex-end; color: #fff; /* theme-exception: 用户气泡恒为彩色渐变(--grad-a/--grad-b)，白字对比度两套主题都稳定 */ background: linear-gradient(135deg, var(--grad-a), var(--grad-b)); border-bottom-right-radius: 5px; }
.ap-msg.ai { align-self: flex-start; color: var(--fg); background: var(--card); border: 1px solid var(--border); border-bottom-left-radius: 5px; box-shadow: var(--card-shadow); }

.ap-ask-bar { flex: 0 0 auto; display: flex; align-items: center; gap: 10px; padding: 12px 16px 16px; }
.ap-ask-input {
  flex: 1; min-width: 0; height: 44px; padding: 0 16px; border-radius: 999px; font: inherit; font-size: 15px;
  color: var(--fg); background: var(--card); border: 1px solid var(--border); outline: none;
  transition: border-color 0.16s, background 0.16s;
}
.ap-ask-input::placeholder { color: var(--fg-subtle); }
.ap-ask-input:focus { border-color: var(--accent); background: var(--card); }
.ap-ask-send {
  flex: 0 0 auto; width: 42px; height: 42px; border-radius: 50%; border: none; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, var(--grad-a), var(--grad-b)); box-shadow: 0 6px 16px -6px var(--accent-soft-bd);
  transition: filter 0.16s, transform 0.16s, opacity 0.16s;
}
.ap-ask-send svg { width: 20px; height: 20px; fill: #fff; } /* theme-exception: 图标恒叠在彩色渐变按钮上，白色对比度两套主题都稳定 */
.ap-ask-send:hover { filter: brightness(1.06); transform: translateY(-1px); }
.ap-ask-send:disabled { opacity: 0.45; cursor: default; transform: none; filter: none; }

/* 窄屏：收紧内边距 */
@media (max-width: 860px) {
  .audio-layout { gap: 16px; padding: 16px; }
}
</style>
