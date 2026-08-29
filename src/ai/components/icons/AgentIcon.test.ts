import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AgentIcon from './AgentIcon.vue'

// SP8-P2a Task 1 — 9 icons needed for settings area navigation and top bar.
const P2A_ICONS = ['cpu', 'cloud', 'lock', 'gauge', 'steps', 'book', 'waves', 'grid', 'key']

describe('AgentIcon — SP8-P2a new icons', () => {
  it.each(P2A_ICONS)('%s renders non-empty svg content', (name) => {
    const w = mount(AgentIcon, { props: { name } })
    expect(w.find('svg').html()).toMatch(/<(path|rect|circle|g)\b/)
  })

  it('unknown icon name renders empty svg (existing fallback behavior unchanged)', () => {
    const w = mount(AgentIcon, { props: { name: 'definitely-not-an-icon' } })
    expect(w.find('svg').html()).not.toMatch(/<(path|rect|circle|g)\b/)
  })

  it('book uses scale(0.8333) wrap (source icon is 24-unit coordinate system)', () => {
    const w = mount(AgentIcon, { props: { name: 'book' } })
    expect(w.find('svg').html()).toContain('scale(0.8333)')
  })

  it('cpu doesn\'t use scale wrap (source path is already 20-unit coordinate system)', () => {
    const w = mount(AgentIcon, { props: { name: 'cpu' } })
    expect(w.find('svg').html()).not.toContain('scale(')
  })
})

describe('SP8-P2b Task 1 — user icon', () => {
  it('user renders circle + path, scaled from 24→20 units', () => {
    const w = mount(AgentIcon, { props: { name: 'user' } })
    const html = w.html()
    expect(html).toContain('transform="scale(0.8333)"')
    expect(html).toContain('cx="12"')
    expect(html).toContain('r="4"')
    expect(html).toContain('M4 21a8 8 0 0116 0')
  })

  it('control group: 20-unit folder doesn\'t use scale wrap', () => {
    expect(mount(AgentIcon, { props: { name: 'folder' } }).html()).not.toContain('scale(')
  })
})

// SP8-P2b acceptance feedback (2026-07-30) — "Open Phoenix" originally used download (down arrow + baseline) icon,
// semantic is "download" not "open in new tab". User decided to switch to external link icon, new external added.
// 20-unit coordinate system hand-drawn (same as folder/cpu family), doesn't need scale wrap.
describe('SP8-P2b acceptance patch — external(link) icon', () => {
  it('external renders non-empty svg content', () => {
    expect(mount(AgentIcon, { props: { name: 'external' } }).find('svg').html())
      .toMatch(/<(path|rect|circle|g)\b/)
  })

  it('external is 20-unit coordinate system, no scale wrap', () => {
    expect(mount(AgentIcon, { props: { name: 'external' } }).html()).not.toContain('scale(')
  })
})
