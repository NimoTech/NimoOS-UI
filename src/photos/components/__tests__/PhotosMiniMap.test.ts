import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PhotosMiniMap from '../PhotosMiniMap.vue'
import { MAP_H, MAP_W, project } from '../../util/worldMap'

function viewBoxOf(w: ReturnType<typeof mount>): number[] {
  const vb = w.get('svg').attributes('viewBox') ?? ''
  return vb.split(' ').map(Number)
}

describe('PhotosMiniMap', () => {
  it('无有效点时 viewBox 为全球范围,并显示 emptyText', () => {
    const w = mount(PhotosMiniMap, { props: { points: [], emptyText: '暂无位置数据' } })
    expect(w.get('svg').attributes('viewBox')).toBe(`0 0 ${MAP_W} ${MAP_H}`)
    expect(w.text()).toContain('暂无位置数据')
  })

  it('单点时 viewBox 经度跨度不小于 MIN_LON_SPAN(投影换算)', () => {
    const w = mount(PhotosMiniMap, {
      props: { points: [{ latitude: 10, longitude: 20, color: '#fff' }] },
    })
    const [, , vw] = viewBoxOf(w)
    // MIN_LON_SPAN = 40 度 → 40/360 * MAP_W
    expect(vw).toBeGreaterThanOrEqual((40 / 360) * MAP_W - 1e-9)
    // 空态覆盖层不显示
    expect(w.find('.mini-map-empty').exists()).toBe(false)
  })

  it('两个远距离点时包围盒(经加 padding 后)覆盖两点的投影坐标', () => {
    const points = [
      { latitude: 60, longitude: -100, color: '#f00' },
      { latitude: -30, longitude: 140, color: '#0f0' },
    ]
    const w = mount(PhotosMiniMap, { props: { points } })
    const [vx, vy, vw, vh] = viewBoxOf(w)
    for (const p of points) {
      const { x, y } = project(p.longitude, p.latitude)
      expect(x).toBeGreaterThanOrEqual(vx - 1e-9)
      expect(x).toBeLessThanOrEqual(vx + vw + 1e-9)
      expect(y).toBeGreaterThanOrEqual(vy - 1e-9)
      expect(y).toBeLessThanOrEqual(vy + vh + 1e-9)
    }
  })

  it('latitude 为 NaN 或字符串的点被过滤,不参与包围盒(且不渲染成 person dot)', () => {
    const points = [
      { latitude: Number.NaN, longitude: 20, color: '#f00' },
      { latitude: '30' as unknown as number, longitude: 40, color: '#0f0' },
      { latitude: 10, longitude: 10, color: '#00f' },
    ]
    const w = mount(PhotosMiniMap, { props: { points } })
    // 只有一个有效点参与渲染
    expect(w.findAll('.dot-person')).toHaveLength(1)
  })
})
