import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import KIcon from './KIcon.vue'

describe('KIcon', () => {
  it('渲染 svg 骨架并透传 size / color / strokeWidth', () => {
    const w = mount(KIcon, { props: { name: 'home', size: 15, color: 'var(--accent)', strokeWidth: 2 } })
    const svg = w.get('svg')
    expect(svg.attributes('width')).toBe('15')
    expect(svg.attributes('height')).toBe('15')
    expect(svg.attributes('viewBox')).toBe('0 0 20 20')
    expect(svg.attributes('stroke')).toBe('var(--accent)')
    expect(svg.attributes('stroke-width')).toBe('2')
    expect(svg.attributes('fill')).toBe('none')
  })

  it('name 命中时注入对应 path;未命中时渲染空内容(不抛)', () => {
    expect(mount(KIcon, { props: { name: 'check' } }).html()).toContain('M4 10l4 4 8-8')
    const miss = mount(KIcon, { props: { name: 'no-such-icon' } })
    expect(miss.get('svg').element.innerHTML).toBe('')
  })

  it('KnowledgeLayout 与 DashboardView 用到的 22 个 name 全部存在', () => {
    // 协调者订正:brief 注释原写「18 个」,实际数组是 22 个,逐个核对蓝本后 22 个全部存在。
    const used = ['home', 'search', 'layers', 'edit', 'file', 'history', 'drive', 'folder',
      'settings', 'clock', 'user', 'refresh', 'info', 'check', 'grid', 'plus',
      'arrowRight', 'chev', 'eye', 'spinner', 'pause', 'sparkle']
    for (const n of used) {
      const el = mount(KIcon, { props: { name: n } }).get('svg').element
      expect(el.innerHTML, `icon "${n}" missing`).not.toBe('')
    }
  })

  it('六个与 AgentIcon 同名异形的图标保持 KIcon 自己的形状(K4 防回归)', () => {
    // 设计 §2.5:code/download/grid/pause/settings/user 在两套图标里形状不同,
    // 复用 AgentIcon 会让知识库区图标肉眼可见地变样。这里钉住 KIcon 版本的特征片段。
    const d = (n: string) => mount(KIcon, { props: { name: n } }).get('svg').element.innerHTML
    expect(d('pause')).toContain('<rect')          // KIcon 是实心双矩形,AgentIcon 是两条线
    expect(d('code')).toContain('M7 6l-4 4 4 4')   // 正向:钉住 KIcon 自己的 code path(补强,原负向断言判别力弱)
    expect(d('code')).not.toContain('M11 4l-2 12') // AgentIcon 版多的那一笔斜线
    expect(d('grid')).toContain('rx="1"')          // AgentIcon 是 rx="1.2"
    expect(d('settings')).toContain('r="2.5"')     // AgentIcon 的齿轮是 lucide 版
    expect(d('user')).toContain('cy="7"')          // AgentIcon 是 cy="8" + scale
    expect(d('download')).toContain('M10 3v9')     // AgentIcon 是 M10 3v10
  })
})
