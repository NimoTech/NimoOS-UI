import { describe, it, expect } from 'vitest'
import { renderMarkdown } from './renderMarkdown'

describe('renderMarkdown (AI Agent)', () => {
  it('**b** → <strong>', () => {
    expect(renderMarkdown('**b**')).toContain('<strong>b</strong>')
  })

  it('naked URL is linkified to <a>', () => {
    const html = renderMarkdown('see https://example.com for more')
    expect(html).toContain('<a')
    expect(html).toContain('href="https://example.com"')
  })

  it('XSS regression: <script> is removed, no active script tags produced', () => {
    const html = renderMarkdown('<script>alert(1)</script>')
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('</script>')
  })

  it('breaks:false semantics: single line break does not produce <br> (consistent with Vue2)', () => {
    const html = renderMarkdown('line one\nline two')
    expect(html).not.toContain('<br>')
    expect(html).not.toContain('<br/>')
    expect(html).not.toContain('<br />')
  })
})
