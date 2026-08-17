// Splits the search query into segments by the keywords extracted from understood(), and marks
// which parts need highlighting, so the search bar's input echo can apply a highlight style to
// matched fragments. Ported from Vue2 NimoOS-UI
// src/views/Photos/PhotosSearchView.vue:416-433 (`queryParts` computed) —
// the main segmentation logic is copied verbatim, but there are two defensive deviations not
// present in Vue2 (logged inline below): the keywords.filter(Boolean) empty-string guard, and the
// second line of defense against zero-width matches inside the exec loop (fix round 1 · M3).
// keywords is supplied by the caller (= understood(...).map(t => t.v.toLowerCase())).

export interface QueryPart {
  text: string
  hl: boolean
}

export function queryParts(query: string, keywords: string[]): QueryPart[] {
  const q = query || ''
  if (!q) return [{ text: q, hl: false }]
  // Added guard (Vue2 doesn't have this): an empty-string keyword would build a regex that
  // matches the empty string (e.g. '(|tokyo)'), and m.index would never advance in the exec
  // loop, causing an infinite loop. Filter out empty strings before building the regex.
  const kw = keywords.filter(Boolean)
  if (!kw.length) return [{ text: q, hl: false }]
  const escaped = kw.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const re = new RegExp('(' + escaped.join('|') + ')', 'gi')
  const parts: QueryPart[] = []
  let last = 0
  let m: RegExpExecArray | null
  re.lastIndex = 0
  while ((m = re.exec(q)) !== null) {
    // Second line of defense (fix round 1 · M3, Vue2 :416-433 has no equivalent branch,
    // added in New-UI): the keywords.filter(Boolean) above already keeps empty-string
    // keywords out of the regex, so under the normal path m[0] can never be an empty
    // string. But a global regex does not auto-advance lastIndex on a zero-width match, so
    // if that guard is ever accidentally removed or bypassed later (e.g. keywords built a
    // different way), a zero-width match would leave lastIndex stuck in place and exec
    // would keep yielding the same position forever — that's not "an assertion failure",
    // it's "the worker OOM-crashes outright" (reproduced in fix round 1), taking down the
    // rest of this file's test cases with it. Add a fallback here: on a zero-width match,
    // manually bump lastIndex by one and skip this iteration (don't count it as a
    // highlight), so if the upstream guard ever fails, the function still returns and the
    // test still fails cleanly, instead of taking down the whole test process.
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
