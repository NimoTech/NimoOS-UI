import { onMounted, onUnmounted } from 'vue'

// 单飞递归 setTimeout 轮询:上一拍 await 完成后才排下一拍,永不重叠。
export function useGuardedPoll(
  fn: () => Promise<void> | void,
  opts: { intervalMs: number; active: () => boolean },
): void {
  let stopped = false
  let timer: number | undefined
  async function tick() {
    if (stopped) return
    try {
      if (opts.active()) await fn()
    } catch {
      // 单拍失败吞掉,下一拍继续(调用方 fn 内部已 catch 并记 message)
    }
    if (stopped) return
    timer = window.setTimeout(tick, opts.intervalMs)
  }
  onMounted(() => { timer = window.setTimeout(tick, opts.intervalMs) })
  onUnmounted(() => { stopped = true; clearTimeout(timer) })
}
