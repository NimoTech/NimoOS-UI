import { describe, it, expect } from 'vitest'
import { renderMarkdown } from './renderMarkdown'

describe('renderMarkdown (AI Agent)', () => {
  it('**b** → <strong>', () => {
    expect(renderMarkdown('**b**')).toContain('<strong>b</strong>')
  })

  it('裸 URL 被 linkify 成 <a>', () => {
    const html = renderMarkdown('see https://example.com for more')
    expect(html).toContain('<a')
    expect(html).toContain('href="https://example.com"')
  })

  it('XSS 回归:<script> 被清除,不产生存活的 script 标签', () => {
    const html = renderMarkdown('<script>alert(1)</script>')
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('</script>')
  })

  it('breaks:false 语义:单个换行不产生 <br>(与 Vue2 一致)', () => {
    const html = renderMarkdown('line one\nline two')
    expect(html).not.toContain('<br>')
    expect(html).not.toContain('<br/>')
    expect(html).not.toContain('<br />')
  })
})
