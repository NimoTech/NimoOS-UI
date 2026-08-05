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
// 把「同一波」内多个任务完成事件(索引 / 视频 embedding / OCR / 人脸聚类)合并成一条提示,
// 避免多个 toast 同时或前后叠着弹。每来一条完成事件就放进按类型去重的缓冲并重置去抖计时器,
// 安静 delay 毫秒后(人脸扫动 ~2.2s 完成、索引 done 收尾,两者完成时刻通常相差 ~2s)
// 按固定顺序拼成一条交给 emit。
//
// 设计为无框架依赖的纯工厂,便于单测;Vue 组件注入 messageFor / emit 即可。

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
    if (!msg) return // 无内容(如本次无新增人脸)不计入,也不弹
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
