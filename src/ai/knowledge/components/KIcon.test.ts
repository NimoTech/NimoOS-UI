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

  // 评审 Important 开放发现 1:上面几条只覆盖 8 个 glyph(check/code 正向 + 六条异形),
  // 「22 个 name 全部存在」那条只查非空 —— 其余约 35 个 glyph 互相串位/坐标写错都测不出。
  // 这条快照【不是】用来验证「移植对不对」——那件事已经由实现者与评审各自独立对蓝本做过
  // 逐字节 diff(见 p5a-task-3-report.md,两侧 md5sum 一致,0 差异),移植正确性已经证明过了。
  // 这条快照锁的是【那个已验证状态】,防的是【将来】有人改动 KIcon.vue 时无意中改错坐标、
  // 或把两个 glyph 的 path 串了位——42 个键名全列(不是 T10/T12 用到的 22 个子集,
  // 那 22 个恰好是已有保护的,漏掉的 20 个才是这条快照真正要保护的对象)。
  it('42 条 glyph 全量快照(防未来误改漂移)', () => {
    const names = [
      'plus', 'folder', 'search', 'chev', 'check', 'x', 'play', 'pause', 'trash', 'settings',
      'edit', 'file', 'drive', 'history', 'refresh', 'home', 'grid', 'user', 'arrowRight', 'download',
      'hourglass', 'spinner', 'danger', 'test', 'rocket', 'eye', 'info', 'target', 'clock', 'code',
      'chevDown', 'chevLeft', 'arrowDown', 'sort', 'tomb', 'layers',
      'sparkle', 'bot', 'copy', 'paperclip', 'upload', 'funnel',
    ]
    expect(names.length).toBe(42)
    const dump = Object.fromEntries(names.map((n) => [
      n, mount(KIcon, { props: { name: n } }).get('svg').element.innerHTML,
    ]))
    expect(dump).toMatchSnapshot()
  })
})
