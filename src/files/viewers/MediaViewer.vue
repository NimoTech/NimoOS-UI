<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import ViewerShell from './ViewerShell.vue'
import { mediaKind } from './mediaKind'
import { lookupTranscript, parseTimestamp } from './audioTranscripts'
import type { TranscriptSegment } from './audioTranscripts'
import { speakerToken, segMatches, barSpeakers, segChapterIndex, barChapterIndex } from './speakerWave'
import { WAVE_N, synthWaveform, decodeWaveform, waveCacheKey, getCachedWave, setCachedWave } from './waveform'
import type { FileEntry } from '../stores/files'
import {
  DropdownMenuRoot, DropdownMenuTrigger, DropdownMenuPortal,
  DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from 'reka-ui'

const props = defineProps<{ item: FileEntry; list: FileEntry[] }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'download', entry: FileEntry): void }>()
const { t, locale } = useI18n()

const kind = mediaKind(props.item.name)

// Audio transcript/summary (hardcoded demo): panel appears only when the filename matches.
// Default tab is "summary".
const transcript = computed(() => (kind === 'audio' ? lookupTranscript(props.item.name) : null))
const tab = ref<'summary' | 'transcript' | 'ask'>('summary')

const url = service.file.fileUrl(props.item.path)
const videoEl = ref<HTMLDivElement | null>(null)
const wrap = ref<HTMLElement | null>(null)
const poster = ref('')
const audioTitle = ref(props.item.name)
const audioArtist = ref('...')

// Artplayer is a third-party interop boundary; shared types beyond destroy() are not needed.
// Using `any` is intentional.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let artInst: any = null
// Component may be unmounted during await in async onMounted (user closes overlay quickly).
// After unmount, abandon construction.
let disposed = false

// ── Audio: custom minimal player (native <audio> + custom-drawn progress bar, per reference)
//   Layout: play/pause circle button centered above progress bar; progress bar = transparent
//   track + blue-purple filled portion + circular thumb, time labels at both ends.
//   Removed original APlayer skin and wave animation. Color scheme reused from homepage blue-purple.
const audioMedia = ref<HTMLAudioElement | null>(null)
const track = ref<HTMLElement | null>(null)
const playing = ref(false)
const curTime = ref(0)
const durTime = ref(0)
let dragging = false

const progressPct = computed(() =>
  durTime.value ? Math.min(100, Math.max(0, (curTime.value / durTime.value) * 100)) : 0,
)

// ── Waveform progress bar (mimics recording app) ──────────────────────────────────────
//   Progress bar is drawn as voice waveform: centered rounded vertical bars + silent
//   sections have dashed baseline. Played portion is colored with accent color.
//   Two-level data source: first synthesize placeholder from filename (0 latency), then
//   seamlessly replace with real decoded audio in background. Files > 50MB / decode failure /
//   no match silently stay on synthesized version; see ./waveform and design spec.
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
    // Component may be unmounted (disposed) by the time in-flight result arrives.
    // Discard; don't write cache or trigger render.
    if (!bars || disposed) return
    setCachedWave(key, bars)
    waveBars.value = bars
  })
}
// Number of played bars = progress percentage × total bars (determines per-bar color/white).
const playedBars = computed(() => Math.round((progressPct.value / 100) * WAVE_N))

// Waveform × speakers: enabled only when transcript has speaker data (spec §3;
// audio without speakers keeps old render branch zero-changed).
// When durTime is 0 (before loadedmetadata), barSpeakers returns all nulls → all bars use
// --wave-none, then reactively recalculate when ready.
const barSpk = computed<(string | null)[]>(() => {
  const tr = transcript.value
  if (!tr?.speakers?.length) return []
  return barSpeakers(tr.segments, durTime.value, WAVE_N)
})
const waveSpeakerMode = computed(() => barSpk.value.length > 0)
// Bar → chapter assignment (waveform dimming only in speaker mode; spec §5 restriction)
const barChap = computed<number[]>(() =>
  waveSpeakerMode.value ? barChapterIndex(chapters.value, durTime.value, WAVE_N) : [],
)
// Bar inline color: when dim, directly use var(--wave-dim) (inline style has higher
// specificity than stylesheet; .dim CSS cannot override inline value).
function barColor(i: number): string {
  if (barDim(i)) return 'var(--wave-dim)'
  const id = barSpk.value[i]
  return id ? speakerColor(id) : 'var(--wave-none)'
}
// Filter dimming: if either speaker or chapter dimension matches, dim the bar.
// (All selected on a dimension = that dimension doesn't participate):
// Speaker dimension: not all selected AND bar's speaker not in picked set (silent bars also dim);
// Chapter dimension: not all selected AND bar's chapter not in picked set.
// Consistent with transcript list logic.
function barDim(i: number): boolean {
  if (!waveSpeakerMode.value) return false
  if (!allPicked.value) {
    const id = barSpk.value[i]
    if (!id || !pickedSpeakers.value.has(id)) return true
  }
  if (chapterFiltering.value && !pickedChapters.value.has(barChap.value[i])) return true
  return false
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
// Speed label: remove decimal places for integers (1 → "1", 1.25 → "1.25").
const rateLabel = computed(() => `${rate.value}×`)

function onLoaded(): void {
  durTime.value = audioMedia.value?.duration || 0
  applyRate() // Reapply current speed after source change
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
// Click transcript segment → seek to corresponding time and resume playback.
function seekTo(ts: string): void {
  const a = audioMedia.value
  if (!a) return
  a.currentTime = parseTimestamp(ts)
  void a.play().catch(() => {})
}

// Transcript highlight: active segment = last segment where start time ≤ current playback position.
// Updates reactively with curTime.
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
// Scroll active segment into view (nearest, smooth). Only when transcript tab is open
// (locate by original segment index data-seg).
function scrollActiveIntoView(): void {
  if (tab.value !== 'transcript' || activeSeg.value < 0) return
  const el = transcriptEl.value?.querySelector(`[data-seg="${activeSeg.value}"]`) as HTMLElement | null
  el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
}
watch(activeSeg, () => scrollActiveIntoView())
watch(tab, (v) => { if (v === 'transcript') void nextTick(scrollActiveIntoView) })

// ── Transcript panel (smart chapters / speaker separation / highlight / Ask Nimo) ────────
//   Chapter / speaker / highlight data all parsed from user-provided real subtitles
//   (audioTranscripts); only Ask Nimo Q&A replies are still placeholder
//   (to be replaced with streaming requests after vector QA backend integration).

// "Highlights only" filter (key sentences highlight).
const highlightsOnly = ref(false)

// Speaker filter (master-checkbox semantics): picked set = which speakers to show,
// initially all selected; empty set = all unselected = all hidden.
// "All" is not an independent state, just a master switch for all-select/all-unselect.
// Replace Set instance wholesale to ensure watch reliably triggers.
const speakers = computed(() => transcript.value?.speakers ?? [])
const hasSpeakers = computed(() => speakers.value.length > 0)
const pickedSpeakers = ref<Set<string>>(new Set(speakers.value.map((s) => s.id)))
// When all selected, "All" lights up; deselecting any one turns it off. All selected also means
// speaker filter is effectively off.
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
// Chapter filter (master-checkbox, same semantics as speaker filter): picked set = which
// chapters to show, initially all selected; all selected = effectively no filter;
// empty set = all unselected = all hidden. Replace Set wholesale to ensure watch reliably triggers.
const chapters = computed(() => transcript.value?.chapters ?? [])
const hasChapters = computed(() => chapters.value.length > 0)
const pickedChapters = ref<Set<number>>(new Set(chapters.value.map((_, k) => k)))
const allChaptersPicked = computed(() => hasChapters.value && pickedChapters.value.size === chapters.value.length)
function toggleChapter(k: number): void {
  const next = new Set(pickedChapters.value)
  if (next.has(k)) next.delete(k)
  else next.add(k)
  pickedChapters.value = next
}
function toggleAllChapters(): void {
  pickedChapters.value = allChaptersPicked.value ? new Set() : new Set(chapters.value.map((_, k) => k))
}
// Segment original index → chapter index lookup table (filter condition O(1) lookup by index)
const segChap = computed(() => segChapterIndex(transcript.value?.segments ?? [], chapters.value))
// After filter changes, if current segment is still in list, smooth-scroll it back into view (requirement 5).
watch([pickedSpeakers, pickedChapters, highlightsOnly], () => void nextTick(scrollActiveIntoView))

// Transcript display rows: intersperse "smart chapter" titles into segment stream.
// Row carries original segment index i (for highlight/seek/locate).
type TransRow =
  | { type: 'chapter'; title: string; t: string }
  | { type: 'seg'; seg: TranscriptSegment; i: number }
// Each filter dimension "active" = not all selected (all selected = effectively no filter);
// inactive when no corresponding data.
const speakerFiltering = computed(() => hasSpeakers.value && !allPicked.value)
const chapterFiltering = computed(() => hasChapters.value && !allChaptersPicked.value)
const transcriptRows = computed<TransRow[]>(() => {
  const tr = transcript.value
  if (!tr) return []
  const chapterAt = new Map<string, string>()
  for (const c of tr.chapters ?? []) chapterAt.set(c.t, c.title)
  const rows: TransRow[] = []
  // Chapter headers: "highlights only" / speaker filter can create "empty chapters",
  // all hidden when activated (current rule); kept only when filtering by chapter alone—
  // filtered chapters disappear with their segments, headers of visible chapters help identify
  // segment assignment.
  const showHeads = !highlightsOnly.value && !speakerFiltering.value
  tr.segments.forEach((seg, i) => {
    if (chapterFiltering.value && !pickedChapters.value.has(segChap.value[i])) return
    if (!segMatches(seg, hasSpeakers.value ? pickedSpeakers.value : null, highlightsOnly.value)) return
    if (showHeads && chapterAt.has(seg.t)) {
      rows.push({ type: 'chapter', title: chapterAt.get(seg.t) as string, t: seg.t })
    }
    rows.push({ type: 'seg', seg, i })
  })
  return rows
})
const hasHighlights = computed(() => !!transcript.value?.segments.some((s) => s.highlight))

// Speaker separation: id → display name / color token (--spk-N, 5-color cycle; waveform and transcript share same mapping).
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

// Ask Nimo AI: transcript is vectorized, can ask questions about this audio segment.
// Demo phase answers are high-quality pre-set responses (PRESETS below, referencing real
// chapters/timestamps); match preset question → return answer, otherwise fall back to
// placeholder text. When backend is ready, replace answerFor with streaming request to NimoOS-AI.
interface AskMsg { role: 'user' | 'ai'; text: string }
const askInput = ref('')
const askMsgs = ref<AskMsg[]>([])
const askScrollEl = ref<HTMLElement | null>(null)

const PRESETS: { q: string; a: string }[] = [
  {
    q: "What's this episode about?",
    a:
      'A full sitcom episode among six friends (labeled Speaker 1–6), with two storylines cross-cutting all night:\n' +
      '• Speaker 3 and Speaker 4 surprise Speaker 5 with hockey tickets (0:52) — not knowing it\'s the anniversary of his first time with his ex-wife Carol (1:42)\n' +
      '• Speaker 6 gets her first-ever paycheck and meets FICA (2:46), then a visit from old friends (3:58) leaves her doubting her fresh start\n' +
      '• Girls\' night: Speaker 2\'s "magic beans" pep talk (9:20) and the scary question — what if it never comes together? (10:27)\n' +
      '• At the game, a distracted Speaker 5 takes a puck to the face (10:52) and the guys land in the ER (11:32)\n' +
      '• A misdelivered pizza reveals George Stephanopoulos lives across the street (12:55), turning girls\' night into a stakeout (15:02)\n' +
      '• In the ER, Speaker 5 admits Carol was his first (16:24); back home the girls trade embarrassing secrets (16:55)\n' +
      '• Everyone winds up playing Twister (19:52), and Speaker 5 takes the Visa call for Speaker 6: "I\'m fine." (20:55)',
  },
  {
    q: 'Why does Speaker 5 end up in the emergency room?',
    a:
      'He takes a hockey puck to the face — and the whole night builds up to it:\n' +
      '1. (1:28) Today is October 20th, the anniversary of his first time with his ex-wife Carol. He wants to skip the game and go home to brood.\n' +
      '2. (2:03) Speaker 4 drags him along anyway — "you, me, Joey, ice — guys\' night out."\n' +
      '3. (4:56) At the rink he keeps drifting into Carol memories: the boots, the peach pit (5:20), "there was ice there that night" (8:30).\n' +
      '4. (10:52) Distracted — "Hey, look, we\'re on that TV thing!" — and the puck finds his face.\n' +
      '5. (11:42) In the ER: "I\'m in a lot of pain here. My face is dented." The nurse\'s "any minute now" (11:54) stretches past an hour (14:33).\n' +
      '6. (19:27) He finally wrestles his puck back from a kid — and admits, "Now that was fun." (19:51)',
  },
  {
    q: 'What do the magic beans mean?',
    a:
      'They\'re Speaker 2\'s metaphor for trading a safe plan for possibilities:\n' +
      '• (9:12) She tells Speaker 6 "you are just like Jack" — Jack and the Beanstalk gave up a cow, got magic beans, and woke up to a big plant outside his window, full of possibilities. "And he lived in a village — and you live in the Village!" (9:20)\n' +
      '• (9:36) Speaker 6 pushes back: Jack gave up a cow, she gave up an orthodontist — and now life feels "floopy" (9:48).\n' +
      '• (10:27) Then the darker version: "What if we don\'t get magic beans? What if all we\'ve got are… beans?"\n' +
      '• (20:45) The callback lands in the final scene — answering the Visa call, Speaker 5 deadpans "I\'ve got magic beans… no, no, never mind. I\'m fine." (20:55)',
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
  // Typewriter streaming effect (demo only; replace with real token stream after backend integration)
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
    // Attempt autoplay (if blocked by browser policy, wait for user to click play button).
    void audioMedia.value?.play?.().catch(() => {})
    // Cover + title/artist (Vue2 mm.fetchFromUrl) — metadata failure doesn't block playback.
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
      /* Metadata failure doesn't block playback */
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
                <!-- Play/pause circle button: blue-purple gradient (reused from theme color) -->
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
            <!-- Waveform progress bar: centered rounded vertical bars (mimics recording app) + silent sections with dashed baseline; played portion colored with accent; time labels at both ends -->
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

          <!-- Summary section -->
          <div v-if="tab === 'summary'" class="ap-scroll">
            <div class="ap-summary">
              <p class="ap-summary-text">{{ transcript.summary }}</p>
              <div v-if="transcript.keywords.length" class="ap-kw">
                <span v-for="k in transcript.keywords" :key="k" class="ap-chip">{{ k }}</span>
              </div>
            </div>
          </div>

          <!-- Transcript: smart chapters + speaker separation + highlights (with "highlights only" filter) -->
          <template v-else-if="tab === 'transcript'">
            <div v-if="hasHighlights || hasSpeakers || hasChapters" class="ap-tools">
              <button v-if="hasHighlights" type="button" class="ap-tool" :class="{ on: highlightsOnly }" @click="highlightsOnly = !highlightsOnly">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5l2.6 5.7 6.2.6-4.7 4.1 1.4 6.1L12 16.9 6.5 20.1l1.4-6.1L3.2 9.8l6.2-.6z" /></svg>
                {{ highlightsOnly ? t('audioShowAll') : t('audioHighlightsOnly') }}
              </button>
              <!-- Chapter filter: dropdown multi-select (master-checkbox, same semantics as speaker); clicking items doesn't close menu (@select.prevent) -->
              <DropdownMenuRoot v-if="hasChapters">
                <DropdownMenuTrigger class="ap-tool ap-ch-trigger" :class="{ on: chapterFiltering }">
                  {{ t('audioChapters') }}<template v-if="chapterFiltering">&nbsp;{{ pickedChapters.size }}/{{ chapters.length }}</template>
                  <svg class="ap-ch-caret" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10l5 5 5-5z" /></svg>
                </DropdownMenuTrigger>
                <DropdownMenuPortal>
                  <!-- Portal to body: scoped styles can't reach, ap-ch-* all in non-scoped block; z-index must cover preview overlay (200) -->
                  <DropdownMenuContent class="ui-ctx-content ap-ch-menu" :side-offset="4" align="start">
                    <DropdownMenuItem class="ui-ctx-item ap-ch-item" @select.prevent="toggleAllChapters">
                      <span class="ap-ch-check">{{ allChaptersPicked ? '✓' : '' }}</span>{{ t('audioAllChapters') }}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator class="ui-ctx-sep" />
                    <DropdownMenuItem
                      v-for="(c, k) in chapters"
                      :key="c.t"
                      class="ui-ctx-item ap-ch-item"
                      @select.prevent="toggleChapter(k)"
                    >
                      <span class="ap-ch-check">{{ pickedChapters.has(k) ? '✓' : '' }}</span>
                      <span class="ap-ch-t">{{ c.t }}</span>
                      <span class="ap-ch-title">{{ c.title }}</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenuPortal>
              </DropdownMenuRoot>
              <!-- Speaker filter chips: "All" = master switch for select-all/unselect-all (lit when all selected), one multi-select per speaker; ANDed with "highlights only" -->
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
                <!-- Smart chapter title (click to seek) -->
                <li v-if="row.type === 'chapter'" class="ap-chapter" @click="seekTo(row.t)">
                  <span class="ap-chapter-t">{{ row.t }}</span>
                  <span class="ap-chapter-title">{{ row.title }}</span>
                </li>
                <!-- Segment: time + speaker + text (key sentences highlighted) -->
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

          <!-- Ask Nimo: transcript is vectorized, can ask questions about this segment (framework placeholder, backend not integrated) -->
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
/* theme-exception: darkening/blur overlay stacked on any audio cover (not page background),
   needs fixed neutral dark color to ensure controls are readable on any cover, unrelated to page theme */
.audio-blur {
  position: absolute; inset: 0; z-index: 0; background-size: cover; background-position: center;
  background-color: rgba(53, 54, 58, 0.4); /* theme-exception: glass base stacked on cover, unrelated to theme */ backdrop-filter: blur(10px) saturate(180%);
}

/* Audio layout: vertical — player on top, transcript/summary panel below; centered, width-limited.
   Without transcript, player vertically centered; with transcript, player at top, panel takes
   remaining height and scrolls. */
.audio-layout { position: relative; z-index: 1; width: 100%; height: 100%; max-width: 60rem; margin: 0 auto; display: flex; flex-direction: column; gap: 20px; padding: 24px; box-sizing: border-box; }
.media-wrap:not(.has-panel) .audio-layout { justify-content: center; }
.audio-player { flex: 0 0 auto; min-width: 0; display: flex; align-items: center; justify-content: center; }

/* ── Custom minimal player (per reference) ──────────────────────────────
   Play button centered above progress bar; progress bar = transparent track + blue-purple
   filled + circular thumb; color scheme reused from homepage blue-purple. */
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
.np-play svg { width: 26px; height: 26px; fill: #fff; } /* theme-exception: play button icon always stacked on colored gradient, white contrast stable across themes */
.np-play svg.tri { margin-left: 3px; } /* Triangle optical centering */

/* Transport controls: three-column grid (1fr / auto / 1fr) — play cluster centered in middle column, speed pill on right. */
.np-controls { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; width: 100%; max-width: 40rem; }
.np-center { display: flex; align-items: center; justify-content: center; gap: 12px; }
.np-side { display: flex; align-items: center; min-width: 0; }
.np-side-right { justify-content: flex-end; }

/* Skip buttons: hollow circle with loop arrow + center second label. Forward button has
   horizontally mirrored arrow. */
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

/* Speed pill: single-button cycle (1× → 1.25× → … → 3× → 1×). */
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

/* Waveform progress bar: bars symmetric around centerline on both sides (via align-items:center);
   dashed baseline shows through in silent sections. Bars fixed width via flex-basis + space-between
   distribution; auto-narrows on narrow screens; click hotzone extended 6px above/below via ::before. */
.np-wave {
  position: relative; flex: 1 1 auto; height: 46px; min-width: 0;
  display: flex; align-items: center; justify-content: space-between;
  cursor: pointer; touch-action: none;
}
.np-wave::before { content: ''; position: absolute; left: 0; right: 0; top: -6px; bottom: -6px; }
/* Silent section dashed baseline (runs across entire bar, only this remains in silent gaps) */
.np-wave-base { position: absolute; left: 0; right: 0; top: 50%; height: 0; border-top: 1px dashed var(--fg-faint); transform: translateY(-50%); pointer-events: none; }
/* Single bar: fixed 3px wide, rounded ends; unplayed = neutral faint color, played = accent color.
   Height controlled via inline amplitude. */
.np-wave-bar { position: relative; flex: 0 1 3px; max-width: 3px; border-radius: 999px; background: var(--fg-subtle); transition: background 0.12s, height 0.3s var(--ease); }
.np-wave-bar.played { background: var(--accent); }
.np-wave:hover .np-wave-bar.played { background: var(--accent2); }

/* ── Speaker mode (.np-wave.spk, only when transcript has speaker data): each bar colored by
   speaker for that segment, progress = opacity (played = full color / unplayed = same color faded),
   speaker color and play progress both readable. ── */
.np-wave.spk .np-wave-bar {
  background: var(--bar-c, var(--wave-none)); opacity: 0.30;
  transition: background 0.14s, opacity 0.14s, filter 0.14s, height 0.3s var(--ease);
}
.np-wave.spk .np-wave-bar.played { background: var(--bar-c, var(--wave-none)); opacity: 1; }
.np-wave.spk:hover .np-wave-bar.played { background: var(--bar-c, var(--wave-none)); }
/* Filtering: bars with unselected speakers desaturate to gray (gray via inline --bar-c to
   var(--wave-dim)) and dim further */
.np-wave.spk .np-wave-bar.dim { opacity: 0.12; }
.np-wave.spk .np-wave-bar.dim.played { opacity: 0.30; }
.np-wave.spk:hover .np-wave-bar.played:not(.dim) { filter: brightness(1.12); }

/* Transcript/summary panel — consumes global theme tokens (see src/styles/theme.css):
   light mode = cream background + white card + Azure blue accent; blue mode = dark glass. */
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

/* ── Transcript: smart chapters + speaker separation + highlights ─────────────────────────── */
.ap-transcript { list-style: none; margin: 0; padding: 4px 14px 12px; display: flex; flex-direction: column; gap: 2px; }
.ap-seg { display: flex; gap: 14px; padding: 10px 12px; border-radius: 12px; cursor: pointer; transition: background 0.16s, box-shadow 0.16s; }
.ap-seg:hover { background: var(--hover); }
.ap-time { flex: 0 0 auto; width: 48px; font-size: 15px; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--accent-text); padding-top: 2px; }
.ap-seg:hover .ap-time { color: var(--accent); }
.ap-seg-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.ap-seg-text { font-size: 15px; line-height: 1.6; color: var(--fg); }
/* Speaker separation: small dot + name (color injected via --c, value is var(--spk-N) token) */
.ap-speaker { display: inline-flex; align-items: center; gap: 6px; font-size: 15px; font-weight: 700; letter-spacing: 0.02em; color: var(--c); }
.ap-speaker-dot { width: 7px; height: 7px; border-radius: 50%; flex: 0 0 auto; background: var(--c); }
/* Active segment highlight (Azure blue, reused from search accent) — left accent bar + darker text */
.ap-seg.active { background: var(--accent-soft); box-shadow: inset 3px 0 0 var(--accent); }
.ap-seg.active .ap-time { color: var(--accent-text); }
.ap-seg.active .ap-seg-text { color: var(--fg); font-weight: 500; }
.ap-hl-star { width: 13px; height: 13px; fill: var(--hl-star); vertical-align: -2px; margin-right: 5px; }

/* Smart chapter title (click to seek) */
.ap-chapter { display: flex; align-items: baseline; gap: 12px; padding: 14px 12px 6px; margin-top: 4px; cursor: pointer; }
.ap-chapter:first-child { margin-top: 0; }
.ap-chapter-t { flex: 0 0 auto; width: 48px; font-size: 15px; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--fg-subtle); }
.ap-chapter-title { font-size: 15px; font-weight: 700; letter-spacing: 0.03em; text-transform: uppercase; color: var(--accent-text); }
.ap-chapter:hover .ap-chapter-title { color: var(--accent); }

/* Transcript toolbar ("highlights only" filter) */
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

/* ── Speaker filter chip: colored dot + color-mix halo; when selected, border/background uses
   that speaker's color ── */
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
/* "All" chip: no speaker color, when selected uses neutral accent */
.spk-chip-all.on { color: var(--accent-text); border-color: var(--accent-soft-bd); background: var(--accent-soft); }

/* Chapter dropdown trigger: reuses .ap-tool shape, adds spacing for chevron and count */
.ap-ch-trigger { display: inline-flex; align-items: center; gap: 4px; }
.ap-ch-caret { width: 14px; height: 14px; fill: currentColor; }

/* ── Ask Nimo (framework placeholder) ───────────────────────────────────────── */
.ap-ask-scroll { flex: 1 1 auto; overflow-y: auto; min-height: 0; padding: 10px 20px; display: flex; flex-direction: column; }
.ap-ask-empty { margin: auto 0; display: flex; flex-direction: column; align-items: center; gap: 16px; text-align: center; padding: 20px 0; }
.ap-ask-hint { margin: 0; font-size: 15px; line-height: 1.6; color: var(--fg-muted); max-width: 30rem; }
.ap-ask-chips { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
.ap-ask-chips-bar { justify-content: flex-start; padding: 4px 16px 0; }
.ap-chip-btn { cursor: pointer; color: var(--accent-text); background: var(--accent-soft); border-color: var(--accent-soft-bd); transition: background 0.16s, border-color 0.16s; }
.ap-chip-btn:hover { background: var(--accent-soft-2); border-color: var(--accent-soft-bd); }
.ap-ask-msgs { display: flex; flex-direction: column; gap: 10px; }
.ap-msg { max-width: 80%; padding: 10px 14px; border-radius: 16px; font-size: 15px; line-height: 1.6; white-space: pre-wrap; word-break: break-word; }
.ap-msg.user { align-self: flex-end; color: #fff; /* theme-exception: user bubble always colored gradient (--grad-a/--grad-b), white text contrast stable across themes */ background: linear-gradient(135deg, var(--grad-a), var(--grad-b)); border-bottom-right-radius: 5px; }
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
.ap-ask-send svg { width: 20px; height: 20px; fill: #fff; } /* theme-exception: icon always stacked on colored gradient button, white contrast stable across themes */
.ap-ask-send:hover { filter: brightness(1.06); transform: translateY(-1px); }
.ap-ask-send:disabled { opacity: 0.45; cursor: default; transform: none; filter: none; }

/* Narrow screen: tighten padding */
@media (max-width: 860px) {
  .audio-layout { gap: 16px; padding: 16px; }
}
</style>

<style>
/* Chapter dropdown menu: Portal transported to body, can't reach scoped styles, must be non-scoped
   (precedent: AddMountMenu.vue). z-index 240 covers preview overlay (ViewerShell z-index:200;
   shared ui-ctx-content default 120). */
/* Compound selector (0,2,0) definitely overrides .ui-ctx-content's z-index:120 (0,1,0) — at
   equal specificity, bundle order decides, unreliable */
.ap-ch-menu.ui-ctx-content { z-index: 240; }
.ap-ch-menu { max-height: 320px; overflow-y: auto; }
/* gap conflicts with .ui-ctx-item(gap:10px) at same specificity — same as above, compound
   selector wins deterministically */
.ap-ch-item.ui-ctx-item { gap: 8px; }
.ap-ch-item { display: flex; align-items: center; max-width: 22rem; }
.ap-ch-check { flex: 0 0 auto; width: 14px; font-size: 12px; font-weight: 700; color: var(--accent-text); }
.ap-ch-t { flex: 0 0 auto; font-size: 12px; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--fg-subtle); }
.ap-ch-title { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
