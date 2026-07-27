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
  const newPath = '@' + newSegs.join('/') + '/'
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
  const newPath = '@' + (newSegs.length ? newSegs.join('/') + '/' : '')
  const before = text.slice(0, start)
  const after = text.slice(caret)
  return {
    text: before + newPath + after,
    segments: newSegs,
    caretPos: (before + newPath).length,
  }
}

/** Remove the whole @token with nothing inserted in its place
 *  (AgentComposer.vue:374-379, `pickItem`'s text-splice step). */
export function stripMentionToken(text: string, start: number, caret: number): { text: string; caretPos: number } {
  return {
    text: text.slice(0, start) + text.slice(caret),
    caretPos: start,
  }
}
