// 音频波形模块:合成占位(纯函数) + 真实解码(浏览器编排) + 会话级缓存。
// 设计:docs/superpowers/specs/2026-07-10-new-ui-audio-real-waveform-design.md
// 策略:打开即渲染合成波形(0 延迟),后台解码真实音频后无缝替换;
//       超 50MB / 任一失败 → 静默保持合成,功能永不退化。

/** 进度条竖条数(与 MediaViewer 渲染一致) */
export const WAVE_N = 96

// —— 以下两个 PRNG 辅助从 MediaViewer.vue 原样迁入,不改行为 ——
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
 * 合成波形:seed(文件名)确定性生成「像语音」的包络——
 * 交替「说话簇」(正弦升降包络 + 抖动)与「静音间隙」(幅值 0 → 只留虚线基线)。
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
 * 分桶取峰:把解码后的单声道样本压成 n 条。
 * 每桶取 |max|(peak,非 RMS),按全局最大归一化到 [0,1];真静音桶保持 0。
 * 桶边界按比例索引(而非固定桶宽),len < n 时相邻桶共享样本,天然不崩。
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

// —— 会话级内存缓存:单条仅 96 个 number,不设淘汰;刷新即清 ——
const cache = new Map<string, number[]>()

/** 缓存键 = path|size|date(FileEntry 无 mtime,用 date;缺失位留空串)。 */
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
 * 解码真实波形:fetch 整个文件 → AudioContext.decodeAudioData → 取第 1 声道 → bucketPeaks。
 * 大小闸:Content-Length > maxBytes 直接放弃;无该头则边读边计字节,超限即中止——
 * 避免无头大文件读爆内存。任一异常(含 AbortError)→ null,调用方静默保持合成波形。
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
      void res.body.cancel().catch(() => {}) // 主动取消响应体,立即释放连接(否则 >50MB 挡下的请求会一直挂着)
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
    // 用显式 ArrayBuffer 承接,避免 Uint8Array#buffer 的 ArrayBufferLike 类型歧义。
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
      // 只取第 1 声道(省内存);bucketPeaks 返回后不再持有 AudioBuffer,任其回收。
      return bucketPeaks(audio.getChannelData(0), n)
    } finally {
      void ctx.close().catch(() => {})
    }
  } catch {
    return null
  }
}
