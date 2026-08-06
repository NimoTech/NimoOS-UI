import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SkillTile, { SKILL_COLOR_IDS } from './SkillTile.vue'

// SP8-P3a Task 3 —— 对齐 Vue2 src/views/AI/Skills/SkillTile.vue(43 行)。
// 颜色查表不再是字面量渐变字符串,断言拿 token 名 var(--grad-sk-<id>)。
// 惯例见 src/ai/components/tabs/SystemTab.test.ts:52(inline :style 里的 token
// 字符串原样断言,不走 jsdom CSSOM 解析,避免 var() 被吞)。

describe('SkillTile', () => {
  it('SKILL_COLOR_IDS 是 7 个 id,顺序对齐 Vue2 COLORS 的 key 顺序', () => {
    expect(SKILL_COLOR_IDS).toEqual(['blue', 'purple', 'pink', 'orange', 'green', 'teal', 'slate'])
  })

  it.each(SKILL_COLOR_IDS)('color=%s → 渲染出对应的 --grad-sk-%s token', (id) => {
    const w = mount(SkillTile, { props: { color: id } })
    const style = w.find('.sk-tile').attributes('style') ?? ''
    expect(style).toContain(`var(--grad-sk-${id})`)
    // 排他性:不应该同时命中兜底的 blue token(blue 自身除外)
    if (id !== 'blue') expect(style).not.toContain('var(--grad-sk-blue)')
  })

  it('未知 color id 回落 blue（Vue2 :40 `COLORS[this.color] || COLORS.blue` 同款兜底）', () => {
    const w = mount(SkillTile, { props: { color: 'not-a-real-color' } })
    const style = w.find('.sk-tile').attributes('style') ?? ''
    expect(style).toContain('var(--grad-sk-blue)')
  })

  it('不传 color 时默认值就是 blue', () => {
    const w = mount(SkillTile)
    const style = w.find('.sk-tile').attributes('style') ?? ''
    expect(style).toContain('var(--grad-sk-blue)')
  })

  it('size/radius 生效在内联宽高与圆角上，默认值对齐 Vue2 :36-37（size=30, radius=9）', () => {
    const w = mount(SkillTile)
    const style = w.find('.sk-tile').attributes('style') ?? ''
    expect(style).toContain('width: 30px')
    expect(style).toContain('height: 30px')
    expect(style).toContain('border-radius: 9px')
  })

  it('传自定义 size/radius 时内联样式随之改变', () => {
    const w = mount(SkillTile, { props: { size: 48, radius: 16 } })
    const style = w.find('.sk-tile').attributes('style') ?? ''
    expect(style).toContain('width: 48px')
    expect(style).toContain('height: 48px')
    expect(style).toContain('border-radius: 16px')
  })

  it('内部图标 size 是 tile size 的一半（Math.round(size*0.5)，对齐 Vue2 :11）', () => {
    const w = mount(SkillTile, { props: { size: 31 } }) // 31*0.5=15.5 → round 到 16，验证不是简单截断
    const svg = w.find('svg')
    expect(svg.attributes('width')).toBe('16')
    expect(svg.attributes('height')).toBe('16')
  })

  it('icon prop 透传给内部 AgentIcon（默认 sparkle，对齐 Vue2 :36）', () => {
    const w = mount(SkillTile, { props: { icon: 'trash' } })
    // AgentIcon 把 name 映射成 svg 内的 path/g，trash 与 sparkle 的 path 不同，
    // 用 innerHTML 差异间接验证 name 确实透传（AgentIcon 内部实现见
    // ../../icons/AgentIcon.vue:9-72 的 PATHS 表）。
    const trashHtml = w.find('svg').element.innerHTML
    const defaultHtml = mount(SkillTile).find('svg').element.innerHTML
    expect(trashHtml).not.toBe(defaultHtml)
  })
})
