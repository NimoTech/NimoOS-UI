// 1:1 ported from Vue2 src/views/AI/Agent/shell/AgentComposer.vue:
//   getExt/basename/dirname            :180-196
//   mention trigger scan (onInput inline logic)  :300-335
//   text + caret math of drillIn/pickItem/popSegment :355-428
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
 * P1c1 acceptance patch task 4 — prefix written to text: `'@' + segments.join('/') + '/'`
 * (when segments are empty it's just bare `'@'`, no trailing slash). Originally
 * `buildDrillText` and `buildPopText` each inlined this logic; now both changed to call this
 * function — pure deduplication, both retain their existing behavior/tests. Also the sole
 * authoritative prefix source for `parseActiveMention` to slice-compare when checking "whether
 * the recorded mention is still valid". See p1c1-patch-task-4-brief.md "root cause" and "target
 * design" sections.
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
 * P1c1 acceptance patch task 4 — check whether "the recorded mention" (`start`/`segments`, written to
 * component state by `drillIn`/`popSegment`, the authoritative value) still holds in the current text,
 * and extract the filter query typed by the user afterward. **Does not do any text reverse-inference or
 * word segmentation** — only does a single prefix slice comparison, naturally unaffected by spaces/
 * slashes in mount point display names (this is exactly what `scanMention` cannot do via reverse-inference;
 * see the same-name comparison test in this file).
 *
 * Validity conditions: `start >= 0`, `text.slice(start, start + prefix.length) === prefix`,
 * `caret >= start + prefix.length`. If any of the three is not met, it's judged as invalid —
 * the caller (`syncMentionFromCaret` in `AgentComposer.vue`) decides based on this whether to
 * fall back to `scanMention` to discover a new mention.
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
