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
  it('XSS 回归:内嵌 <script> 被转义,不产生存活的 script 标签', () => {
    const html = renderMarkdown('<script>alert(1)</script>')
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('</script>')
  })
  it('XSS 回归:javascript: 链接不被渲染为可点击 href', () => {
    const html = renderMarkdown('[click me](javascript:alert(1))')
    expect(html).not.toContain('href="javascript:alert(1)"')
  })
})
