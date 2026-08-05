// 把搜索查询词按 understood() 抽出的关键词切段、标注需要高亮的部分,供搜索栏
// 输入回显时给命中片段加高亮样式。Ported from Vue2 NimoOS-UI
// src/views/Photos/PhotosSearchView.vue:416-433(`queryParts` computed)——
// 主体切段逻辑逐字照搬,但另有两处 Vue2 没有的防御性偏离(见下方就近登记):
// keywords.filter(Boolean) 空串守卫、exec 循环内零宽匹配的第二道防线(fix round 1 · M3)。
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
    // 第二道防线(fix round 1 · M3,Vue2 :416-433 无此分支,New-UI 新增):
    // 上面的 keywords.filter(Boolean) 已经把空串 keyword 挡在拼正则之前,正常
    // 路径下 m[0] 不可能是空串。但全局正则对零宽匹配不会自动推进 lastIndex,
    // 万一日后有人误删/绕过那道守卫(例如换一种方式拼 keywords),零宽匹配会
    // 让 lastIndex 原地不动、exec 永远吐出同一个位置——那不是"断言失败"而是
    // "worker 直接 OOM 崩溃"(fix round 1 已实测复现),连累同文件其余用例一起
    // 报不出结果。这里补一道兜底:遇到零宽匹配就手动把 lastIndex 前移一位并跳过
    // 本次(不计入高亮),让上游守卫失效时,函数仍能返回、测试仍能干净变红,
    // 而不是拖垮整个测试进程。
    if (m[0] === '') {
      re.lastIndex++
      continue
    }
    if (m.index > last) parts.push({ text: q.slice(last, m.index), hl: false })
    parts.push({ text: m[0], hl: true })
    last = re.lastIndex
  }
  if (last < q.length) parts.push({ text: q.slice(last), hl: false })
  return parts.length ? parts : [{ text: q, hl: false }]
}
