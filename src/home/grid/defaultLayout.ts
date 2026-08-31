import type { LayoutItem } from './types'

export const PHOTO_PLACEHOLDERS = [
  'linear-gradient(145deg,#84e9ff,#328fff 45%,#f1d291 46%,#49c89c 68%,#18639f)',
  'linear-gradient(145deg,#f8cc88,#ff7d82 48%,#4f86ff)',
  'linear-gradient(145deg,#ced7e5,#35445f 48%,#d59b76)',
  'linear-gradient(145deg,#b8f3d0,#2bb673 60%,#0d6b8a)',
]

export const DEFAULT: Omit<LayoutItem, 'id'>[] = [
  { kind: 'widget', key: 'clock', c: 1, r: 1, w: 2, h: 2 },
  { kind: 'widget', key: 'storage', c: 3, r: 1, w: 4, h: 2 },
  { kind: 'app', key: 'files', c: 11, r: 1, w: 1, h: 1 },
  { kind: 'app', key: 'photos', c: 12, r: 1, w: 1, h: 1 },
  { kind: 'app', key: 'ai', c: 11, r: 2, w: 1, h: 1 },
  { kind: 'app', key: 'settings', c: 12, r: 2, w: 1, h: 1 },
  // c10,r2 is the free cell directly left of the ai tile (c11,r2) -- verified against the
  // full occupancy map before picking it; every
  // other cell in rows 1-2/cols 7-10 is free too, this one groups Knowledge with AI visually.
  { kind: 'app', key: 'knowledge', c: 10, r: 2, w: 1, h: 1 },
  { kind: 'widget', key: 'ai', c: 1, r: 3, w: 4, h: 4 },
  { kind: 'widget', key: 'cpu', c: 5, r: 3, w: 4, h: 2 },
  { kind: 'widget', key: 'events', c: 9, r: 3, w: 2, h: 4 },
  { kind: 'folder', key: 'Gallery', path: '/DATA/Gallery', c: 11, r: 3, w: 1, h: 1 },
  { kind: 'folder', key: 'Documents', path: '/DATA/Documents', c: 12, r: 3, w: 1, h: 1 },
  { kind: 'photo', key: PHOTO_PLACEHOLDERS[0], c: 11, r: 4, w: 2, h: 2 },
  { kind: 'widget', key: 'network', c: 5, r: 5, w: 4, h: 4 },
  { kind: 'app', key: 'appstore', c: 11, r: 6, w: 1, h: 1 },
  { kind: 'app', key: 'vm', c: 12, r: 6, w: 1, h: 1 },
  { kind: 'photo', key: PHOTO_PLACEHOLDERS[3], c: 1, r: 7, w: 2, h: 2 },
  { kind: 'folder', key: 'Downloads', path: '/DATA/Downloads', c: 3, r: 7, w: 1, h: 1 },
  { kind: 'folder', key: 'Media', path: '/DATA/Media', c: 4, r: 7, w: 1, h: 1 },
  { kind: 'photo', key: PHOTO_PLACEHOLDERS[1], c: 9, r: 7, w: 2, h: 2 },
  { kind: 'widget', key: 'gpu', c: 11, r: 7, w: 2, h: 2 },
]
