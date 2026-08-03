// SP7-P8a-T3: 存储条的分段调色板 + 纯格式化函数。照 D5 / PLACE_PALETTE(P5-T12)/
// placesMapThemes.ts(P6a)/ --badge-photo 等(P7a-T15)的既定先例:**数据可视化调色板**
// 归 docs/THEMING.md 第0约定第三类例外 —— photos/thumbs 两段直接引用既有语义 token,
// 其余三段(videos/raw/ai)与 other 段是 Vue2 内联的、与主题皮肤无关的分类识别色,值落在
// theme.css 的具名 token 里(同 --badge-* 的落地方式,不是散落在 <style> 块里的字面量,
// 也不是本 .ts 文件里的字面量——那样会在两套主题间失去"跟随皮肤微调对比度"的能力)。
//
// 「palette」这个文件名承载的不只是调色板——fmtGB/fmtBytes/buildBreakdown 三个格式化/
// 分段纯函数也放在这里,是任务文件结构的既定安排(task-3-brief.md),不要拆文件。
export const STORAGE_SEG_COLORS = {
  photos: 'var(--accent)',
  videos: 'var(--photos-seg-video)',
  raw: 'var(--photos-seg-raw)',
  thumbs: 'var(--success)',
  ai: 'var(--photos-seg-ai)',
  other: 'var(--photos-seg-other)',
} as const

export type StorageSegKey = keyof typeof STORAGE_SEG_COLORS

export interface StorageSeg { key: StorageSegKey; gb: number; color: string }

export interface StorageBytes {
  photosBytes: number
  videosBytes: number
  rawBytes: number
  cacheBytes: number
  aiBytes: number
}

// Vue2 PhotosSettings.vue:382
export function fmtGB(g: number): string {
  return g >= 100 ? g.toFixed(0) : g.toFixed(1)
}

// Vue2 PhotosSettings.vue:405-413
const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const
export function fmtBytes(b: number): string {
  if (!b || b <= 0) return '0 B'
  let i = 0
  let v = b
  while (v >= 1024 && i < BYTE_UNITS.length - 1) {
    v /= 1024
    i++
  }
  return `${v >= 100 ? v.toFixed(0) : v.toFixed(1)} ${BYTE_UNITS[i]}`
}

// Vue2 PhotosSettings.vue:313-330 —— 段序固定;other 段只在「已用总量减去已知段合计」
// 严格大于 0.05 GB 时追加(小于这个量的零头不值得画一段)。
const OTHER_THRESHOLD_GB = 0.05
export function buildBreakdown(bytes: StorageBytes, usedGB: number): StorageSeg[] {
  const gb = (b: number): number => Math.max(0, b) / 1024 ** 3
  const segs: StorageSeg[] = [
    { key: 'photos', gb: gb(bytes.photosBytes), color: STORAGE_SEG_COLORS.photos },
    { key: 'videos', gb: gb(bytes.videosBytes), color: STORAGE_SEG_COLORS.videos },
    { key: 'raw', gb: gb(bytes.rawBytes), color: STORAGE_SEG_COLORS.raw },
    { key: 'thumbs', gb: gb(bytes.cacheBytes), color: STORAGE_SEG_COLORS.thumbs },
    { key: 'ai', gb: gb(bytes.aiBytes), color: STORAGE_SEG_COLORS.ai },
  ]
  const known = segs.reduce((a, s) => a + s.gb, 0)
  const other = Math.max(0, usedGB - known)
  if (other > OTHER_THRESHOLD_GB) segs.push({ key: 'other', gb: other, color: STORAGE_SEG_COLORS.other })
  return segs
}
