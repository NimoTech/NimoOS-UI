import { describe, it, expect } from 'vitest'
import { renderMarkdown } from './renderMarkdown'

describe('renderMarkdown', () => {
  it('# 标题 → <h1>', () => {
    expect(renderMarkdown('# Hi')).toContain('<h1>Hi</h1>')
  })
  it('列表 → <ul><li>', () => {
    const html = renderMarkdown('- a\n- b')
    expect(html).toContain('<li>a</li>')
    expect(html).toContain('<li>b</li>')
  })
  it('空串 → 空(不抛)', () => {
    expect(renderMarkdown('')).toBe('')
  })
})
