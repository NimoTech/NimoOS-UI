// SP8-P3b Task 2 —— 对齐 Vue2 src/views/AI/Skills/TestPanel.vue:160-172 的 SSE 事件归约逻辑。
//
// Vue2 每收到一片 message/message_delta/text 就 push 一个新的字符串到 output.steps
// （:162 `this.output.steps.push(ev.content)`），逐词流式发送时会在结果列表里炸出一大堆
// 单字/单词的独立行，而不是一段连续文本。后端 message_delta 是逐词发的
// （NimoOS-AI/agent/agent.py:1266,1284），Vue2 这里没适配。
// 【拍板偏离 D2，见 p3b-common-constraints.md §3.1】本仓改成：连续的文本片如果上一步也是
// text，就把新内容追加到同一步里；工具调用（tool_call）仍然单独起一行。
//
// 纯函数：不读时钟（elapsedMs 由调用方传入，便于测试），不就地修改传入的 state，
// 每次返回一个新对象（包括 steps 数组本身，即使内容未变也返回新引用是可接受的——
// 但为避免不必要的对象抖动，无变化路径直接原样返回入参 s）。
//
// 不实现 `tokens`：Vue2 模板 TestPanel.vue:70-73 有 `output.tokens != null` 分支，
// 但 `output.tokens` 全组件从未被赋值（`data()` 里初始化为 null 后再无写入点）——
// 是死分支。照 P3a 处理 trigger_human 的先例，此处不复刻这个字段，SandboxState 类型上
// 没有 tokens，.test.ts 里有一条探针钉死这一点。

export type SandboxStep = { kind: 'text' | 'tool'; text: string }

export type SandboxState = {
  steps: SandboxStep[]
  ms: number | null
  error: string
  done: boolean
}

export function initSandboxState(): SandboxState {
  return { steps: [], ms: null, error: '', done: false }
}

/**
 * 对齐 Vue2 TestPanel.vue run() 里 onEvent 回调（:158-172）。
 * 事件取舍见 p3b-task-2-brief.md §2.1 的表；忽略 thinking/tool_result/confirmation_required
 * 等其余事件类型。返回新的 SandboxState，不修改入参 s 或 s.steps。
 */
export function reduceSandboxEvent(
  s: SandboxState,
  ev: Record<string, unknown>,
  elapsedMs: number
): SandboxState {
  const type = ev.type

  if (type === 'message_delta' || type === 'message' || type === 'text') {
    const content = ev.content
    if (typeof content !== 'string' || content === '') return s
    const steps = s.steps.slice()
    const last = steps[steps.length - 1]
    if (last && last.kind === 'text') {
      steps[steps.length - 1] = { kind: 'text', text: last.text + content }
    } else {
      steps.push({ kind: 'text', text: content })
    }
    return { ...s, steps }
  }

  if (type === 'tool_call') {
    const name = (ev.tool as string | undefined) ?? (ev.name as string | undefined) ?? 'tool'
    const steps = s.steps.slice()
    steps.push({ kind: 'tool', text: '→ ' + name })
    return { ...s, steps }
  }

  if (type === 'error') {
    return { ...s, error: String(ev.content ?? '') }
  }

  if (type === 'done') {
    return { ...s, done: true, ms: elapsedMs }
  }

  return s
}
