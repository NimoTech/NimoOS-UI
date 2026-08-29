// Directly ported from Vue2 src/views/AI/Agent/stream/userMessageView.js:6-30
// Pure view helpers for UserMessage — extracted for testability.

export interface UserMsgBlock {
  type: string
  text?: string
  [key: string]: unknown
}

export interface UserMsgLike {
  content?: unknown
  blocks?: UserMsgBlock[]
  attachments?: unknown[]
  [key: string]: unknown
}

const CONTINUE_MAX_CHARS = 12

/** Extract plain text from a user message (optimistic string or hydrated blocks). */
export function textOf(msg: UserMsgLike | null | undefined): string {
  if (!msg) return ''
  if (typeof msg.content === 'string') return msg.content
  if (Array.isArray(msg.blocks)) {
    return msg.blocks.filter((b) => b.type === 'text').map((b) => b.text).join('\n')
  }
  return ''
}

/** True when a user turn is a short confirmation worth rendering as a chip. */
export function isContinueChip(msg: UserMsgLike | null | undefined): boolean {
  if (!msg) return false
  if (Array.isArray(msg.attachments) && msg.attachments.length) return false
  if (Array.isArray(msg.blocks) && msg.blocks.some((b) => b.type === 'image' || b.type === 'attachment')) {
    return false
  }
  const t = textOf(msg).trim()
  if (!t) return false
  return t.length <= CONTINUE_MAX_CHARS && !t.includes('\n')
}
