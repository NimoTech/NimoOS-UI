import { describe, it, expect } from 'vitest'
import { renderMarkdown } from './renderMarkdown'

describe('renderMarkdown', () => {
  it('# title → <h1>', () => {
    expect(renderMarkdown('# Hi')).toContain('<h1>Hi</h1>')
  })
  it('list → <ul><li>', () => {
    const html = renderMarkdown('- a\n- b')
    expect(html).toContain('<li>a</li>')
    expect(html).toContain('<li>b</li>')
  })
  it('empty string → empty (no throw)', () => {
    expect(renderMarkdown('')).toBe('')
  })
  it('XSS regression: embedded <script> is escaped, no live script tag produced', () => {
    const html = renderMarkdown('<script>alert(1)</script>')
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('</script>')
  })
  it('XSS regression: javascript: links not rendered as clickable href', () => {
    const html = renderMarkdown('[click me](javascript:alert(1))')
    expect(html).not.toContain('href="javascript:alert(1)"')
  })
})
