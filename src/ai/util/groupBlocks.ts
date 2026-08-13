// 1:1 ported from Vue2 src/views/AI/Agent/stream/groupBlocks.js
// Group consecutive thinking/tool blocks into a single process strip item.
// Other block types pass through untouched, preserving order.
//
// NOTE: src/ai/types.ts does not exist yet (created in Task 4). Using a
// minimal local structural type here; Task 4/10 will likely swap this for
// the shared AgentBlock type.

export interface AgentBlockLike {
  type: string
  [key: string]: unknown
}

export interface ProcessGroup {
  __process: true
  steps: AgentBlockLike[]
}

const STEP_TYPES = new Set(['thinking', 'tool'])

export function groupBlocks(blocks: AgentBlockLike[]): (AgentBlockLike | ProcessGroup)[] {
  if (!Array.isArray(blocks)) return []
  const out: (AgentBlockLike | ProcessGroup)[] = []
  let current: ProcessGroup | null = null
  for (const b of blocks) {
    if (b && STEP_TYPES.has(b.type)) {
      if (!current) {
        current = { __process: true, steps: [] }
        out.push(current)
      }
      current.steps.push(b)
    } else {
      current = null
      out.push(b)
    }
  }
  return out
}
