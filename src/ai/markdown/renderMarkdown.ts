// 1:1 ported from Vue2 src/views/AI/Agent/markdown/renderMarkdown.js
import MarkdownIt from 'markdown-it'
import DOMPurify from 'dompurify'

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: false,
  typographer: false,
})

// Render markdown to sanitized HTML string. Used via v-html.
export function renderMarkdown(src: string): string {
  if (!src) return ''
  const raw = md.render(src)
  return DOMPurify.sanitize(raw, { ADD_ATTR: ['target'] })
}
