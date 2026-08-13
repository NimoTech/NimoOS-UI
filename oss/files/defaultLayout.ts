import type { LayoutItem } from './types'

// Default desktop: 12 columns × 8 rows = 96 cells, using 69 cells, top 6 rows full, last two rows deliberately empty
// for users to add their own. All sizes fall within min/max of their respective entries in widgets/registry.ts.
//
//      c1   c2   c3   c4  | c5   c6   c7   c8  | c9   c10 | c11  c12
// r1  [ Clock 4×2        ][ Storage 4×2       ][ GPU 4×2            ]
// r2  [                  ][                   ][                    ]
// r3  [ Network 4×4      ][ CPU 4×3           ][Events 2×4][Files][Settings]
// r4  [                  ][                   ][         ][Store][VMs]
// r5  [                  ][                   ][         ][Store][    ]
// r6  [                  ][Docs][Downloads][Media][Gallery][      ][    ][    ]
// r7   (empty)
// r8   (empty)
export const DEFAULT: Omit<LayoutItem, 'id'>[] = [
  // Top three 4×2 widget strips
  { kind: 'widget', key: 'clock', c: 1, r: 1, w: 4, h: 2 },
  { kind: 'widget', key: 'storage', c: 5, r: 1, w: 4, h: 2 },
  { kind: 'widget', key: 'gpu', c: 9, r: 1, w: 4, h: 2 },

  // Middle large widgets
  { kind: 'widget', key: 'network', c: 1, r: 3, w: 4, h: 4 },
  { kind: 'widget', key: 'cpu', c: 5, r: 3, w: 4, h: 3 },
  { kind: 'widget', key: 'events', c: 9, r: 3, w: 2, h: 4 },

  // Right sidebar system app tiles (c11-12, r3-5)
  { kind: 'app', key: 'files', c: 11, r: 3, w: 1, h: 1 },
  { kind: 'app', key: 'settings', c: 12, r: 3, w: 1, h: 1 },
  { kind: 'app', key: 'appstore', c: 11, r: 4, w: 1, h: 1 },
  { kind: 'app', key: 'vm', c: 12, r: 4, w: 1, h: 1 },
  { kind: 'app', key: 'storage', c: 11, r: 5, w: 1, h: 1 },

  // Bottom folder tile strip (c5-8, r6) — four system directories auto-created by LocalStorage on boot
  { kind: 'folder', key: 'Documents', path: '/DATA/Documents', c: 5, r: 6, w: 1, h: 1 },
  { kind: 'folder', key: 'Downloads', path: '/DATA/Downloads', c: 6, r: 6, w: 1, h: 1 },
  { kind: 'folder', key: 'Media', path: '/DATA/Media', c: 7, r: 6, w: 1, h: 1 },
  { kind: 'folder', key: 'Gallery', path: '/DATA/Gallery', c: 8, r: 6, w: 1, h: 1 },
]
