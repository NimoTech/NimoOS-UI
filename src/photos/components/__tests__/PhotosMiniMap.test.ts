import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PhotosMiniMap from '../PhotosMiniMap.vue'
import photosMiniMapRaw from '../PhotosMiniMap.vue?raw'
import { MAP_H, MAP_W, project } from '../../util/worldMap'
import { extractStyleBlock, parseCssRules } from './cssCascade'

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

// ── Task 6 (Plan E, 2026-08-15): 浅色小地图白底 bug 挂账 ──────────────────────────
// 病根:本组件自己的 scoped `<style>` 曾有一条 `.mini-map-root { background: var(--card); … }`,
// 与 parity `.map-card .mini-map-root`(src/photos/styles/vue2-parity/photos-people.scss:
// 652-660,含 `.photos-root.is-light` 的正确浅色覆盖)选择器数相同、发生同名遮蔽——同一遮蔽
// 模式已在 views/PhotosSearch.vue 的样式块头注释里登记过("Scoped [data-v-xxx] specificity
// always won over the correct plain parity selector of the same name")。`--card` 在浅色
// 主题块是纯白 #ffffff,不是 Vue2 亮色小地图实际用的暖白 oklch(0.975 0.004 80)——这正是
// "浅色小地图白底"这条挂账描述的实际故障。jsdom 不算级联(见 views/__tests__/
// photosGlassSurfaces.test.ts 头注释同一结论),这条规则本身单测抓不到,只能靠读样式块原文
// 断言遮蔽规则已删除、把治理权交还 parity。
describe('浅色小地图白底 bug(遮蔽清理):本地不再自带 background/width/height', () => {
  it('本地 .mini-map-root 规则不再声明 background/width/height(已删,parity 直接治理)', () => {
    // extractStyleBlock() 先剥掉 CSS 注释再返回——本文件头注释里就写了
    // ".map-card .mini-map-root { background: var(--surface-1) }" 这类示例文本,若不剥注释
    // 直接 indexOf 会误命中注释里的示例而不是真规则,这条测试第一版就撞过这个坑。
    const rules = parseCssRules(extractStyleBlock(photosMiniMapRaw))
    const rule = rules.find((r) => r.selectors.length === 1 && r.selectors[0] === '.mini-map-root')
    expect(rule, '.mini-map-root 独立规则未找到').toBeTruthy()
    expect(rule!.body).not.toMatch(/\bbackground\s*:/)
    expect(rule!.body).not.toMatch(/\bwidth\s*:/)
    expect(rule!.body).not.toMatch(/\bheight\s*:/)
    // 非重复的结构声明允许保留。
    expect(rule!.body).toMatch(/position\s*:\s*relative/)
    expect(rule!.body).toMatch(/overflow\s*:\s*hidden/)
  })
})
