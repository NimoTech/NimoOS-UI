// 1:1 移植自 Vue2 src/views/AI/Agent/stream/timelineMath.js
// Pure helpers for the timeline minimap (dock magnification + previews).
//
// NOTE: src/ai/types.ts does not exist yet (created in Task 4). Using a
// minimal local structural type here for the message shape consumed by
// ticksFromMessages; Task 4/10 will likely swap this for AgentMessage.

export interface AgentMessageLike {
  id?: unknown
  role?: string
  content?: unknown
  blocks?: { type: string; text?: string; [key: string]: unknown }[]
  [key: string]: unknown
}

export interface TickWidthOpts {
  base?: number
  amp?: number
  spread?: number
}

export interface Tick {
  role: 'user' | 'ai'
  id: unknown
  text: string
}

const DEFAULTS = { base: 14, amp: 36, spread: 22 }

/** Dock-style width for a tick given cursor distance in px (null = idle). */
export function tickWidth(distancePx: number | null, opts: TickWidthOpts = {}): number {
  const { base, amp, spread } = { ...DEFAULTS, ...opts }
  if (distancePx == null) return base
  return base + amp * Math.exp(-(distancePx * distancePx) / (2 * spread * spread))
}

/** Truncate to n chars with an ellipsis. */
export function clip(str: string, n = 15): string {
  if (!str) return ''
  return str.length > n ? str.slice(0, n) + '…' : str
}

/** Derive minimap ticks from the message list. */
export function ticksFromMessages(messages: AgentMessageLike[]): Tick[] {
  if (!Array.isArray(messages)) return []
  return messages.map((m) => ({
    role: m.role === 'user' ? 'user' : 'ai',
    id: m.id,
    text: textOf(m),
  }))
}

function textOf(m: AgentMessageLike): string {
  if (typeof m.content === 'string') return m.content
  if (Array.isArray(m.blocks)) {
    const t = m.blocks.find((b) => b.type === 'md' || b.type === 'text')
    return t ? t.text || '' : ''
  }
  return ''
}
