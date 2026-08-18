// Ported verbatim (logic unchanged, types added) from Vue2 NimoOS-UI
// src/views/Photos/taskDoneCoalescer.js (createTaskDoneCoalescer, :11-45).
//
// NOTE — API shape deviates from the task-2 brief's assumed signature
// `createTaskDoneCoalescer(announce, delayMs=2600) -> { push, flushNow, dispose }`.
// The real Vue2 source takes a single options object `{ messageFor, emit, delay }`
// and returns `{ push, flush, cancel }`: `messageFor(task)` renders a task to a
// display string (falsy return = skip, don't buffer/emit at all), and `emit`
// receives the final *joined string* for the whole batch, not an array of tasks.
// Ported as-is per "Vue2 source wins"; see task-2-report.md for the full note.
//
// Merges multiple task-done events within the "same wave" (index / video embedding / OCR /
// face clustering) into a single notification, avoiding several toasts popping at once or
// stacked back-to-back. Each completion event goes into a type-deduped buffer and resets the
// debounce timer. After `delay` ms of quiet (face scan finishes in ~2.2s, index done wraps up
// last, and the two typically land ~2s apart), the buffered messages are joined in a fixed
// order and handed to `emit`.
//
// Designed as a framework-free plain factory for easy unit testing; the Vue component just
// injects messageFor / emit.

const ORDER = ['index', 'embedding', 'ocr', 'face', 'aesthetic']

export interface TaskDoneCoalescerOptions<T> {
  messageFor: (task: T) => string | null | undefined | false
  emit: (message: string) => void
  delay?: number
}

export interface TaskDoneCoalescer {
  push: (task: unknown) => void
  flush: () => void
  cancel: () => void
}

export function createTaskDoneCoalescer<T extends { type?: string }>(
  { messageFor, emit, delay = 2600 }: TaskDoneCoalescerOptions<T>,
): TaskDoneCoalescer {
  let buf: Record<string, string> = {}
  let timer: ReturnType<typeof setTimeout> | null = null

  function flush() {
    timer = null
    const b = buf
    buf = {}
    const parts = Object.keys(b)
      .sort((a, c) => {
        const ia = ORDER.indexOf(a)
        const ic = ORDER.indexOf(c)
        return (ia < 0 ? 99 : ia) - (ic < 0 ? 99 : ic)
      })
      .map(k => b[k])
    if (parts.length) emit(parts.join('，'))
  }

  function push(task: T) {
    const msg = messageFor(task)
    if (!msg) return // no content (e.g. no new faces this round) — skip, don't buffer or show
    buf[(task && task.type) || 'other'] = msg
    if (timer) clearTimeout(timer)
    timer = setTimeout(flush, delay)
  }

  function cancel() {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  return { push: push as (task: unknown) => void, flush, cancel }
}
