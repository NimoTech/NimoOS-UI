import { describe, it, expect } from 'vitest'
import { containContentRect, quadBounds, mapOcrBoxesToRects } from '../ocrHighlight'

describe('containContentRect', () => {
  it('宽图信箱:横向铺满、纵向居中留边', () => {
    // 元素 200x200,自然 100x50(2:1)→ 缩放 min(200/100,200/50)=2,内容 200x100,居中 y=50
    expect(containContentRect(200, 200, 100, 50)).toEqual({ x: 0, y: 50, w: 200, h: 100 })
  })
  it('退化尺寸返 null', () => {
    expect(containContentRect(0, 200, 100, 50)).toBeNull()
    expect(containContentRect(200, 200, 0, 50)).toBeNull()
  })
})

describe('quadBounds', () => {
  it('8 点归一四边形取轴对齐外接并钳到 [0,1]', () => {
    expect(quadBounds([0.1, 0.2, 0.5, 0.2, 0.5, 0.6, 0.1, 0.6])).toEqual({ x0: 0.1, y0: 0.2, x1: 0.5, y1: 0.6 })
  })
  it('畸形/零面积返 null', () => {
    expect(quadBounds([0.1, 0.2])).toBeNull()
    expect(quadBounds([0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3])).toBeNull()
  })
})

describe('mapOcrBoxesToRects', () => {
  it('把归一 box 映射到内容框像素矩形', () => {
    const rects = mapOcrBoxesToRects([{ box: [0, 0, 1, 0, 1, 1, 0, 1] }], 200, 200, 100, 50)
    // 内容框 x0,y0=0,50 w,h=200,100;整框 → left0 top50 width200 height100
    expect(rects).toEqual([{ left: 0, top: 50, width: 200, height: 100 }])
  })
})
