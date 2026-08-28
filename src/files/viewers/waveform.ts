// Audio waveform module: synthetic placeholder (pure functions) + real decoding (browser orchestration) + session-level cache.
// Strategy: render the synthetic waveform immediately on open (0 latency), then seamlessly swap in the real audio decoded in the background;
//           over 50MB / any failure → silently keep the synthetic one, never degrading the feature.

/** Number of bars in the progress strip (matches MediaViewer rendering) */
export const WAVE_N = 96

// —— The two PRNG helpers below are moved verbatim from MediaViewer.vue, behavior unchanged ——
function hashStr(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
function mulberry32(a: number): () => number {
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Synthetic waveform: deterministically generate a "speech-like" envelope from the seed (file name) —
 * alternating "speech clusters" (sine rise/fall envelope + jitter) and "silence gaps" (amplitude 0 → only the dashed baseline remains).
 */
export function synthWaveform(seed: string, n: number): number[] {
  const rnd = mulberry32(hashStr(seed || 'audio'))
  const amps: number[] = []
  while (amps.length < n) {
    if (rnd() < 0.22) {
      const gap = 2 + Math.floor(rnd() * 4)
      for (let k = 0; k < gap && amps.length < n; k++) amps.push(0)
    } else {
      const len = 5 + Math.floor(rnd() * 16)
      const peak = 0.35 + rnd() * 0.65
      for (let k = 0; k < len && amps.length < n; k++) {
        const env = Math.sin((k / Math.max(1, len - 1)) * Math.PI)
        const jitter = 0.7 + rnd() * 0.5
        amps.push(Math.min(1, Math.max(0.08, env * peak * jitter)))
      }
    }
  }
  return amps
}

/**
 * Bucketed peaks: compress the decoded mono samples into n bars.
 * Each bucket takes |max| (peak, not RMS), normalized to [0,1] by the global max; truly silent buckets stay 0.
 * Bucket boundaries use proportional indexing (not a fixed bucket width); when len < n adjacent buckets share samples, so it naturally never breaks.
 */
export function bucketPeaks(samples: Float32Array, n: number): number[] {
  const out = new Array<number>(n).fill(0)
  const len = samples.length
  if (!len || n <= 0) return out
  for (let i = 0; i < n; i++) {
    const start = Math.floor((i * len) / n)
    const end = Math.max(start + 1, Math.floor(((i + 1) * len) / n))
    let peak = 0
    for (let j = start; j < end && j < len; j++) {
      const v = Math.abs(samples[j])
      if (v > peak) peak = v
    }
    out[i] = peak
  }
  const max = Math.max(...out)
  return max === 0 ? out : out.map((v) => v / max)
}

// —— Session-level in-memory cache: each entry is just 96 numbers, no eviction; cleared on refresh ——
const cache = new Map<string, number[]>()

/** Cache key = path|size|date (FileEntry has no mtime, so use date; missing parts stay empty strings). */
export function waveCacheKey(e: { path: string; size?: number | string; date?: string }): string {
  return `${e.path}|${e.size ?? ''}|${e.date ?? ''}`
}
export function getCachedWave(key: string): number[] | undefined {
  return cache.get(key)
}
export function setCachedWave(key: string, bars: number[]): void {
  cache.set(key, bars)
}

/**
 * Decode the real waveform: fetch the whole file → AudioContext.decodeAudioData → take channel 1 → bucketPeaks.
 * Size gate: give up immediately if Content-Length > maxBytes; without that header, count bytes while reading and abort once over the limit —
 * keeps a large header-less file from blowing up memory. Any exception (including AbortError) → null, and the caller silently keeps the synthetic waveform.
 */
export async function decodeWaveform(
  url: string,
  n: number,
  opts: { maxBytes: number; signal: AbortSignal },
): Promise<number[] | null> {
  try {
    const res = await fetch(url, { signal: opts.signal })
    if (!res.ok || !res.body) {
      void res.body?.cancel().catch(() => {})
      return null
    }
    const lenHeader = res.headers.get('content-length')
    if (lenHeader && Number(lenHeader) > opts.maxBytes) {
      void res.body.cancel().catch(() => {}) // proactively cancel the body to release the connection now (otherwise a request blocked at >50MB would hang forever)
      return null
    }

    const reader = res.body.getReader()
    const chunks: Uint8Array[] = []
    let total = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > opts.maxBytes) {
        void reader.cancel().catch(() => {})
        return null
      }
      chunks.push(value)
    }
    // Use an explicit ArrayBuffer to avoid the ArrayBufferLike type ambiguity of Uint8Array#buffer.
    const ab = new ArrayBuffer(total)
    const buf = new Uint8Array(ab)
    let off = 0
    for (const c of chunks) {
      buf.set(c, off)
      off += c.byteLength
    }

    const ctx = new AudioContext()
    try {
      const audio = await ctx.decodeAudioData(ab)
      // Take only channel 1 (saves memory); after bucketPeaks returns, the AudioBuffer is no longer held and can be collected.
      return bucketPeaks(audio.getChannelData(0), n)
    } finally {
      void ctx.close().catch(() => {})
    }
  } catch {
    return null
  }
}
