import type { LayoutItem } from './types'

// 默认桌面:12 列 × 8 行 = 96 格,占 69 格,上面 6 行填满,最后两行故意留空
// 给用户自己加。尺寸全部落在 widgets/registry.ts 各自的 min/max 内。
//
//      c1   c2   c3   c4  | c5   c6   c7   c8  | c9   c10 | c11  c12
// r1  [ 时钟 4×2         ][ 存储 4×2          ][ GPU 4×2            ]
// r2  [                  ][                   ][                    ]
// r3  [ 网络 4×4         ][ CPU 4×3           ][事件 2×4 ][文件][设置]
// r4  [                  ][                   ][         ][商店][虚机]
// r5  [                  ][                   ][         ][存储][    ]
// r6  [                  ][文档][下载][媒体][图库][      ][    ][    ]
// r7   （留空）
// r8   （留空）
export const DEFAULT: Omit<LayoutItem, 'id'>[] = [
  // 顶部三条 4×2 小组件带
  { kind: 'widget', key: 'clock', c: 1, r: 1, w: 4, h: 2 },
  { kind: 'widget', key: 'storage', c: 5, r: 1, w: 4, h: 2 },
  { kind: 'widget', key: 'gpu', c: 9, r: 1, w: 4, h: 2 },

  // 中段大组件
  { kind: 'widget', key: 'network', c: 1, r: 3, w: 4, h: 4 },
  { kind: 'widget', key: 'cpu', c: 5, r: 3, w: 4, h: 3 },
  { kind: 'widget', key: 'events', c: 9, r: 3, w: 2, h: 4 },

  // 右侧系统应用磁贴列(c11-12,r3-5)
  { kind: 'app', key: 'files', c: 11, r: 3, w: 1, h: 1 },
  { kind: 'app', key: 'settings', c: 12, r: 3, w: 1, h: 1 },
  { kind: 'app', key: 'appstore', c: 11, r: 4, w: 1, h: 1 },
  { kind: 'app', key: 'vm', c: 12, r: 4, w: 1, h: 1 },
  { kind: 'app', key: 'storage', c: 11, r: 5, w: 1, h: 1 },

  // 底部文件夹磁贴带(c5-8,r6)—— LocalStorage 开机自建的四个系统目录
  { kind: 'folder', key: 'Documents', path: '/DATA/Documents', c: 5, r: 6, w: 1, h: 1 },
  { kind: 'folder', key: 'Downloads', path: '/DATA/Downloads', c: 6, r: 6, w: 1, h: 1 },
  { kind: 'folder', key: 'Media', path: '/DATA/Media', c: 7, r: 6, w: 1, h: 1 },
  { kind: 'folder', key: 'Gallery', path: '/DATA/Gallery', c: 8, r: 6, w: 1, h: 1 },
]
