import { describe, it, expect } from 'vitest'
import { tipSide, TIP_RESERVE } from './tipSide'

// 选盘卡片悬浮提示的展开方向。原来向上展开(照 Vue2),但选盘区第一行紧贴顶栏,
// 提示被顶栏盖住(2026-07-30 用户实盘反馈)→ 改为向右展开;右侧放不下时翻到左侧,
// 免得把"被边界裁掉"这个同类问题镜像到最右列。
describe('tipSide', () => {
  it('右侧空间够 → right', () => {
    expect(tipSide({ left: 100, right: 200 }, 1000, 210)).toBe('right')
  })

  it('右侧放不下 → 翻到 left', () => {
    expect(tipSide({ left: 800, right: 900 }, 1000, 210)).toBe('left')
  })

  it('刚好放得下算 right,差 1px 就翻 left(边界;卡片左侧须有空间才翻得动)', () => {
    expect(tipSide({ left: 690, right: 790 }, 1000, 210)).toBe('right')
    expect(tipSide({ left: 691, right: 791 }, 1000, 210)).toBe('left')
  })

  it('两侧都放不下时仍取 right(左翻只会更糟)', () => {
    expect(tipSide({ left: 5, right: 995 }, 1000, 210)).toBe('right')
  })

  it('宽度参数缺省时用 TIP_RESERVE', () => {
    expect(TIP_RESERVE).toBeGreaterThan(0)
    expect(tipSide({ left: 0, right: 1000 - TIP_RESERVE }, 1000)).toBe('right')
    expect(tipSide({ left: 300, right: 1000 - TIP_RESERVE + 1 }, 1000)).toBe('left')
  })
})
