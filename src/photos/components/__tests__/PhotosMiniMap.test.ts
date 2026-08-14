import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PhotosMiniMap from '../PhotosMiniMap.vue'
import { MAP_H, MAP_W, project } from '../../util/worldMap'

function viewBoxOf(w: ReturnType<typeof mount>): number[] {
  const vb = w.get('svg').attributes('viewBox') ?? ''
  return vb.split(' ').map(Number)
}

describe('PhotosMiniMap', () => {
  it('when no valid points, viewBox is global range and emptyText is displayed', () => {
    const w = mount(PhotosMiniMap, { props: { points: [], emptyText: '暂无位置数据' } })
    expect(w.get('svg').attributes('viewBox')).toBe(`0 0 ${MAP_W} ${MAP_H}`)
    expect(w.text()).toContain('暂无位置数据')
  })

  it('with single point, viewBox longitude span is not less than MIN_LON_SPAN (projection conversion)', () => {
    const w = mount(PhotosMiniMap, {
      props: { points: [{ latitude: 10, longitude: 20, color: '#fff' }] },
    })
    const [, , vw] = viewBoxOf(w)
    // MIN_LON_SPAN = 40 degrees → 40/360 * MAP_W
    expect(vw).toBeGreaterThanOrEqual((40 / 360) * MAP_W - 1e-9)
    // empty state overlay not displayed
    expect(w.find('.mini-map-empty').exists()).toBe(false)
  })

  it('with two distant points, bounding box (after adding padding) covers projection coordinates of both points', () => {
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

  it('points with latitude as NaN or string are filtered, do not participate in bounding box (and not rendered as person dot)', () => {
    const points = [
      { latitude: Number.NaN, longitude: 20, color: '#f00' },
      { latitude: '30' as unknown as number, longitude: 40, color: '#0f0' },
      { latitude: 10, longitude: 10, color: '#00f' },
    ]
    const w = mount(PhotosMiniMap, { props: { points } })
    // only one valid point participates in rendering
    expect(w.findAll('.dot-person')).toHaveLength(1)
  })
})
