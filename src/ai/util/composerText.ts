// 1:1 移植自 Vue2 src/views/AI/Agent/shell/AgentComposer.vue:
//   getExt/basename/dirname            :180-196
//   mention 触发扫描(onInput 内联逻辑)  :300-335
//   drillIn/pickItem/popSegment 的文本+光标数学 :355-428
//
// Pure text/cursor math extracted so the composer SFC (a later task) can stay
// thin wiring. No DOM/Vue dependency here — callers pass caret position
// explicitly instead of reading `this.$refs.ta.selectionStart`.

/** File extension, lowercased, without the dot. '' if there is no extension
 *  or the name starts with a dot (e.g. dotfiles like `.bashrc`). */
export function getExt(name: string): string {
  const i = name.lastIndexOf('.')
  return i < 1 ? '' : name.slice(i + 1).toLowerCase()
}

/** Last path segment, after stripping trailing slashes. */
export function basename(p: string): string {
  if (!p) return ''
  const trimmed = p.replace(/\/+$/, '')
  const i = trimmed.lastIndexOf('/')
  return i < 0 ? trimmed : trimmed.slice(i + 1)
}

/** Parent path. Root-level paths (single leading slash) collapse to '/'. */
export function dirname(p: string): string {
  if (!p) return ''
  const trimmed = p.replace(/\/+$/, '')
  const i = trimmed.lastIndexOf('/')
  if (i <= 0) return '/'
  return trimmed.slice(0, i)
}

export interface MentionScan {
  open: boolean
  start: number
  segments: string[]
  query: string
}

/**
 * Walk back from `caret` to find an active `@mention` trigger.
 * Ported verbatim from the `onInput` smart-@ scan (AgentComposer.vue:312-334):
 * an `@` counts as a trigger only if it's at index 0 or preceded by
 * whitespace (so `me@host` does not trigger); hitting whitespace before
 * finding such an `@` aborts the scan (mention paths never contain spaces).
 */
export function scanMention(text: string, caret: number): MentionScan {
  let i = caret - 1
  while (i >= 0) {
    const ch = text[i]
    if (ch === '@') {
      const prev = i > 0 ? text[i - 1] : ''
      if (i === 0 || /\s/.test(prev)) {
        const after = text.slice(i + 1, caret)
        const parts = after.split('/')
        const segments = parts.slice(0, -1)
        const query = parts[parts.length - 1] || ''
        return { open: true, start: i, segments, query }
      }
      break
    }
    if (/\s/.test(ch)) break
    i--
  }
  return { open: false, start: -1, segments: [], query: '' }
}

/**
 * P1c1 验收补丁 task 4 —— 钻取写进文本的前缀:`'@' + segments.join('/') + '/'`
 * (段落为空时只是裸 `'@'`,没有多余的斜杠)。原先 `buildDrillText`/
 * `buildPopText` 各自内联拼了一遍这段逻辑,现在两处都改调这个函数——纯粹去重,
 * 两者现有行为/单测不变。也是 `parseActiveMention` 判断"已记录的提及词是否仍然
 * 成立"时用来切片比较的唯一权威前缀来源。见 p1c1-patch-task-4-brief.md「根因」
 * 「目标设计」两节。
 */
export function mentionPrefix(segments: string[]): string {
  return '@' + (segments.length ? segments.join('/') + '/' : '')
}

/** Drill into a folder/drive: append "<name>/" after the @ pattern
 *  (AgentComposer.vue:355-371, `drillIn`). */
export function buildDrillText(
  text: string,
  start: number,
  caret: number,
  segments: string[],
  name: string,
): { text: string; segments: string[]; caretPos: number } {
  const newSegs = [...segments, name]
  const newPath = mentionPrefix(newSegs)
  const before = text.slice(0, start)
  const after = text.slice(caret)
  return {
    text: before + newPath + after,
    segments: newSegs,
    caretPos: (before + newPath).length,
  }
}

/** Pop the last mention segment (AgentComposer.vue:412-428, `popSegment`).
 *  When no segments remain, collapses back to a bare '@'. */
export function buildPopText(
  text: string,
  start: number,
  caret: number,
  segments: string[],
): { text: string; segments: string[]; caretPos: number } {
  const newSegs = segments.slice(0, -1)
  const newPath = mentionPrefix(newSegs)
  const before = text.slice(0, start)
  const after = text.slice(caret)
  return {
    text: before + newPath + after,
    segments: newSegs,
    caretPos: (before + newPath).length,
  }
}

/**
 * P1c1 验收补丁 task 4 —— 判断"已记录的提及词"(`start`/`segments`,由
 * `drillIn`/`popSegment` 写入组件状态,权威值)在当前文本里是否仍然成立,并取出
 * 其后用户敲的筛选词。**不做任何文字反推/分词**——只做一次前缀切片比较,天然
 * 不受挂载点显示名里的空格/斜杠影响(这正是 `scanMention` 从文字反推做不到的
 * 点,见本文件同名对照测试)。
 *
 * 成立条件:`start >= 0`、`text.slice(start, start + prefix.length) === prefix`、
 * `caret >= start + prefix.length`。三者但凡一个不满足就判定不成立——调用方
 * (`AgentComposer.vue` 的 `syncMentionFromCaret`)据此决定要不要退回
 * `scanMention` 重新发现一个新词。
 */
export function parseActiveMention(
  text: string,
  start: number,
  segments: string[],
  caret: number,
): { active: boolean; query: string } {
  if (start < 0) return { active: false, query: '' }
  const prefix = mentionPrefix(segments)
  const prefixEnd = start + prefix.length
  if (text.slice(start, prefixEnd) !== prefix) return { active: false, query: '' }
  if (caret < prefixEnd) return { active: false, query: '' }
  return { active: true, query: text.slice(prefixEnd, caret) }
}

/** Remove the whole @token with nothing inserted in its place
 *  (AgentComposer.vue:374-379, `pickItem`'s text-splice step). */
export function stripMentionToken(text: string, start: number, caret: number): { text: string; caretPos: number } {
  return {
    text: text.slice(0, start) + text.slice(caret),
    caretPos: start,
  }
}
