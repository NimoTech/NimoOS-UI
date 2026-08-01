// 把搜索查询词按 understood() 抽出的关键词切段、标注需要高亮的部分,供搜索栏
// 输入回显时给命中片段加高亮样式。Ported verbatim from Vue2 NimoOS-UI
// src/views/Photos/PhotosSearchView.vue:416-433(`queryParts` computed)。
// keywords 由调用方给出(= understood(...).map(t => t.v.toLowerCase()))。

export interface QueryPart {
  text: string
  hl: boolean
}

export function queryParts(query: string, keywords: string[]): QueryPart[] {
  const q = query || ''
  if (!q) return [{ text: q, hl: false }]
  // 新增守卫(Vue2 没防):空字符串 keyword 会造出匹配空串的正则(如 '(|tokyo)'),
  // exec 循环里 m.index 永不推进就会死循环。过滤掉空串再拼正则。
  const kw = keywords.filter(Boolean)
  if (!kw.length) return [{ text: q, hl: false }]
  const escaped = kw.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const re = new RegExp('(' + escaped.join('|') + ')', 'gi')
  const parts: QueryPart[] = []
  let last = 0
  let m: RegExpExecArray | null
  re.lastIndex = 0
  while ((m = re.exec(q)) !== null) {
    if (m.index > last) parts.push({ text: q.slice(last, m.index), hl: false })
    parts.push({ text: m[0], hl: true })
    last = re.lastIndex
  }
  if (last < q.length) parts.push({ text: q.slice(last), hl: false })
  return parts.length ? parts : [{ text: q, hl: false }]
}
