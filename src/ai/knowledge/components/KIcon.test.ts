import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import KIcon from './KIcon.vue'

describe('KIcon', () => {
  it('renders svg skeleton and passes through size / color / strokeWidth', () => {
    const w = mount(KIcon, { props: { name: 'home', size: 15, color: 'var(--accent)', strokeWidth: 2 } })
    const svg = w.get('svg')
    expect(svg.attributes('width')).toBe('15')
    expect(svg.attributes('height')).toBe('15')
    expect(svg.attributes('viewBox')).toBe('0 0 20 20')
    expect(svg.attributes('stroke')).toBe('var(--accent)')
    expect(svg.attributes('stroke-width')).toBe('2')
    expect(svg.attributes('fill')).toBe('none')
  })

  it('when name matches injects corresponding path; unmatch renders empty content (no throw)', () => {
    expect(mount(KIcon, { props: { name: 'check' } }).html()).toContain('M4 10l4 4 8-8')
    const miss = mount(KIcon, { props: { name: 'no-such-icon' } })
    expect(miss.get('svg').element.innerHTML).toBe('')
  })

  it('all 22 names used by KnowledgeLayout and DashboardView exist', () => {
    // Coordinator correction: brief comment originally wrote "18", actual array is 22,
    // after checking blueprint one by one all 22 exist.
    const used = ['home', 'search', 'layers', 'edit', 'file', 'history', 'drive', 'folder',
      'settings', 'clock', 'user', 'refresh', 'info', 'check', 'grid', 'plus',
      'arrowRight', 'chev', 'eye', 'spinner', 'pause', 'sparkle']
    for (const n of used) {
      const el = mount(KIcon, { props: { name: n } }).get('svg').element
      expect(el.innerHTML, `icon "${n}" missing`).not.toBe('')
    }
  })

  it('six icons with AgentIcon same-name different-shape keep KIcon own shape (K4 regression guard)', () => {
    // Design §2.5: code/download/grid/pause/settings/user have different shapes in two
    // icon sets, reusing AgentIcon would visibly change knowledge area icons. Nail down KIcon
    // version's characteristic segments here.
    const d = (n: string) => mount(KIcon, { props: { name: n } }).get('svg').element.innerHTML
    expect(d('pause')).toContain('<rect')          // KIcon is solid dual rectangles, AgentIcon is two lines
    expect(d('code')).toContain('M7 6l-4 4 4 4')   // Positive: nail KIcon's own code path (strengthen, original negative assertion weak)
    expect(d('code')).not.toContain('M11 4l-2 12') // AgentIcon version's extra slant line
    expect(d('grid')).toContain('rx="1"')          // AgentIcon is rx="1.2"
    expect(d('settings')).toContain('r="2.5"')     // AgentIcon's gear is lucide version
    expect(d('user')).toContain('cy="7"')          // AgentIcon is cy="8" + scale
    expect(d('download')).toContain('M10 3v9')     // AgentIcon is M10 3v10
  })

  // Review Important open finding 1: above only covers 8 glyph (check/code positive +
  // six different-shapes), "all 22 names exist" only checks non-empty — remaining ~35 glyph
  // cross-position/coordinate write error untestable. This snapshot 【not】 to verify
  // "is port correct" — already done independently by implementer and review each byte-diff
  // against blueprint (see p5a-task-3-report.md, both sides md5sum match, 0 difference),
  // port correctness already proved. This snapshot locks 【that verified state】, guards
  // against 【future】 someone accidentally changing KIcon.vue coordinates or crossing glyph
  // paths — all 42 key names listed (not 22 subset used by T10/T12, those 22 already have
  // protection, missing 20 are what this snapshot truly guards).
  it('full 42 glyph snapshot (guard future accidental drift)', () => {
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
