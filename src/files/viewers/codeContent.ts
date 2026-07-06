import type { Extension } from '@codemirror/state'

// 复刻 Vue2 CodeEditor.vue:224-227
export function coerceContent(raw: unknown): string {
  return raw !== null && typeof raw === 'object' ? JSON.stringify(raw, null, 2) : String(raw)
}

// ext → CM6 语言扩展(动态 import,懒加载);无匹配 → null(纯文本)
export async function langFor(ext: string): Promise<Extension | null> {
  const e = ext.toLowerCase()
  const js = ['js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs', 'json', 'vue']
  if (js.includes(e)) return (await import('@codemirror/lang-javascript')).javascript({ jsx: true, typescript: true })
  if (['html', 'htm', 'shtml', 'shtm', 'vue'].includes(e)) return (await import('@codemirror/lang-html')).html()
  if (['css', 'scss', 'less', 'sass'].includes(e)) return (await import('@codemirror/lang-css')).css()
  if (['py'].includes(e)) return (await import('@codemirror/lang-python')).python()
  if (['go'].includes(e)) return (await import('@codemirror/lang-go')).go()
  if (['sql'].includes(e)) return (await import('@codemirror/lang-sql')).sql()
  if (['xml', 'rss', 'atom', 'ttl'].includes(e)) return (await import('@codemirror/lang-xml')).xml()
  if (['yaml', 'yml'].includes(e)) return (await import('@codemirror/lang-yaml')).yaml()
  if (['md'].includes(e)) return (await import('@codemirror/lang-markdown')).markdown()
  if (['php'].includes(e)) return (await import('@codemirror/lang-php')).php()
  if (['rs', 'rust'].includes(e)) return (await import('@codemirror/lang-rust')).rust()
  return null
}
