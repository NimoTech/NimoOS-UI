// Segmented palette for the storage bar + pure formatting functions. Following the
// established precedent of D5 / PLACE_PALETTE / placesMapThemes.ts / --badge-photo
// etc.: **data-visualization palettes** fall under docs/THEMING.md's convention 0,
// third exception category -- the photos/thumbs segments reference existing semantic tokens
// directly, while the other three segments (videos/raw/ai) and the "other" segment are
// classification-identity colors inlined in Vue2 that are unrelated to the theme skin; their
// values live in named tokens in theme.css (the same landing pattern as --badge-*, not literals
// scattered across <style> blocks, and not literals in this .ts file either -- either of those
// would lose the ability to "track the skin's contrast tweaks" across the two themes).
//
// The "palette" in this file's name carries more than just the palette itself -- the three
// formatting/segmenting pure functions fmtGB/fmtBytes/buildBreakdown live here too, per the
// established file layout; don't split this file up.
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

// Vue2 PhotosSettings.vue:313-330 -- segment order is fixed; the "other" segment is appended
// only when "used total minus the sum of known segments" is strictly greater than 0.05 GB
// (a remainder smaller than that isn't worth drawing its own segment).
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
