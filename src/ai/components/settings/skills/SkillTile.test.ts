import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SkillTile, { SKILL_COLOR_IDS } from './SkillTile.vue'

// SP8-P3a Task 3 — aligned with Vue2 src/views/AI/Skills/SkillTile.vue (43 lines).
// The color lookup table is no longer a literal gradient string; assertions check
// for the token name var(--grad-sk-<id>). Convention documented in
// src/ai/components/tabs/SystemTab.test.ts:52 (asserts the token string as-is in
// the inline :style, without going through jsdom's CSSOM parsing, to avoid var()
// being swallowed).

describe('SkillTile', () => {
  it('SKILL_COLOR_IDS has 7 ids, in the same key order as Vue2 COLORS', () => {
    expect(SKILL_COLOR_IDS).toEqual(['blue', 'purple', 'pink', 'orange', 'green', 'teal', 'slate'])
  })

  it.each(SKILL_COLOR_IDS)('color=%s → renders the matching --grad-sk-%s token', (id) => {
    const w = mount(SkillTile, { props: { color: id } })
    const style = w.find('.sk-tile').attributes('style') ?? ''
    expect(style).toContain(`var(--grad-sk-${id})`)
    // Exclusivity: should not also hit the fallback blue token (except blue itself)
    if (id !== 'blue') expect(style).not.toContain('var(--grad-sk-blue)')
  })

  it('unknown color id falls back to blue (same fallback as Vue2 :40 `COLORS[this.color] || COLORS.blue`)', () => {
    const w = mount(SkillTile, { props: { color: 'not-a-real-color' } })
    const style = w.find('.sk-tile').attributes('style') ?? ''
    expect(style).toContain('var(--grad-sk-blue)')
  })

  it('default value is blue when color is not passed', () => {
    const w = mount(SkillTile)
    const style = w.find('.sk-tile').attributes('style') ?? ''
    expect(style).toContain('var(--grad-sk-blue)')
  })

  it('size/radius take effect on the inline width/height and corner radius, defaults match Vue2 :36-37 (size=30, radius=9)', () => {
    const w = mount(SkillTile)
    const style = w.find('.sk-tile').attributes('style') ?? ''
    expect(style).toContain('width: 30px')
    expect(style).toContain('height: 30px')
    expect(style).toContain('border-radius: 9px')
  })

  it('inline style updates when custom size/radius are passed', () => {
    const w = mount(SkillTile, { props: { size: 48, radius: 16 } })
    const style = w.find('.sk-tile').attributes('style') ?? ''
    expect(style).toContain('width: 48px')
    expect(style).toContain('height: 48px')
    expect(style).toContain('border-radius: 16px')
  })

  it('inner icon size is half the tile size (Math.round(size*0.5), matches Vue2 :11)', () => {
    const w = mount(SkillTile, { props: { size: 31 } }) // 31*0.5=15.5 → rounds to 16, verifying this is not a plain truncation
    const svg = w.find('svg')
    expect(svg.attributes('width')).toBe('16')
    expect(svg.attributes('height')).toBe('16')
  })

  it('icon prop is passed through to the inner AgentIcon (default sparkle, matches Vue2 :36)', () => {
    const w = mount(SkillTile, { props: { icon: 'trash' } })
    // AgentIcon maps name to a path/g inside the svg; trash and sparkle have
    // different paths, so an innerHTML difference indirectly verifies that name
    // is actually passed through (see the PATHS table in AgentIcon's internals at
    // ../../icons/AgentIcon.vue:9-72).
    const trashHtml = w.find('svg').element.innerHTML
    const defaultHtml = mount(SkillTile).find('svg').element.innerHTML
    expect(trashHtml).not.toBe(defaultHtml)
  })
})
