import { describe, it, expect } from 'vitest'
import { APP_WIDGET_SIZE, appWidgetRange } from './appWidgetSize'

describe('appWidgetRange', () => {
  it('未声明/空对象 → 全局范围', () => {
    expect(appWidgetRange(undefined)).toEqual(APP_WIDGET_SIZE)
    expect(appWidgetRange({})).toEqual(APP_WIDGET_SIZE)
  })

  it('部分声明:缺的轴补全局值', () => {
    expect(appWidgetRange({ maxw: 3 })).toEqual({ min: [2, 1], max: [3, 4] })
    expect(appWidgetRange({ minh: 2 })).toEqual({ min: [2, 2], max: [4, 4] })
  })

  it('min==max 锁死(canResize 据此隐藏把手)', () => {
    expect(appWidgetRange({ minw: 3, maxw: 3, minh: 2, maxh: 2 })).toEqual({ min: [3, 2], max: [3, 2] })
  })

  it('越界值夹进全局 2×1..4×4', () => {
    expect(appWidgetRange({ minw: 1, maxw: 9, minh: 0, maxh: 9 })).toEqual({ min: [2, 1], max: [4, 4] })
  })

  it('min > max 时以 min 为准(max 抬到 min)', () => {
    expect(appWidgetRange({ minw: 4, maxw: 2 })).toEqual({ min: [4, 1], max: [4, 4] })
    expect(appWidgetRange({ minh: 3, maxh: 1 })).toEqual({ min: [2, 3], max: [4, 3] })
  })
})
