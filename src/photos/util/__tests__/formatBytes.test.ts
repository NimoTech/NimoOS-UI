// SP7-P7a-T6: formatMB —— 智能视图详情页统计行的存储空间格式化。
// 照搬 Vue2 NimoOS-UI src/views/Photos/PhotosSmartViewDetail.vue:424-428:
//   mb = bytes / 1048576; mb >= 1024 → (mb/1024).toFixed(1) + ' GB'; 否则 Math.round(mb) + ' MB'.
import { describe, it, expect } from 'vitest'
import { formatMB } from '../formatBytes'

describe('formatMB', () => {
  it('0 字节 → "0 MB"', () => {
    expect(formatMB(0)).toBe('0 MB')
  })

  it('1572864 字节(1.5MB)→ 四舍五入 "2 MB"', () => {
    // 1572864 / 1048576 = 1.5 → Math.round(1.5) = 2
    expect(formatMB(1572864)).toBe('2 MB')
  })

  it('2147483648 字节(2048MB=2GB)→ ">= 1024" 分支 "2.0 GB"', () => {
    // 2147483648 / 1048576 = 2048 → /1024 = 2 → toFixed(1) = '2.0'
    expect(formatMB(2147483648)).toBe('2.0 GB')
  })

  it('恰好 1024 MB(临界值)→ 走 GB 分支而非 MB 分支', () => {
    expect(formatMB(1024 * 1048576)).toBe('1.0 GB')
  })

  it('未定义/缺省时按 0 处理', () => {
    expect(formatMB(undefined as unknown as number)).toBe('0 MB')
  })
})
