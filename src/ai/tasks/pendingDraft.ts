// M6 hand-off between AgentPage (convert chat → task) and TasksView.
//
// A module-level holder rather than a pinia store or route state: the draft
// is consumed exactly once (read-once, like a ticket), never persists across
// reloads (a stale draft prefilled hours later would describe a chat no
// longer on screen — the same reason Vue2's Agent.vue re-checked the active
// session id before opening its inline editor), and nothing else ever reads
// it. `?draft=1` on the route is only the signal to LOOK here.
import type { TaskDraft } from './TaskEditorModal.vue'

let pending: TaskDraft | null = null

export function setPendingTaskDraft(d: TaskDraft): void {
  pending = d
}

export function takePendingTaskDraft(): TaskDraft | null {
  const d = pending
  pending = null
  return d
}
