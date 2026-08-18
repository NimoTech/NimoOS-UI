import { onMounted, onUnmounted } from 'vue'

// Single-flight recursive setTimeout polling: schedule the next beat only after the previous
// beat awaits, never overlapping.
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
      // Swallow failure of a single beat, continue with next beat (caller's fn already catches
      // and logs the message internally)
    }
    if (stopped) return
    timer = window.setTimeout(tick, opts.intervalMs)
  }
  onMounted(() => { timer = window.setTimeout(tick, opts.intervalMs) })
  onUnmounted(() => { stopped = true; clearTimeout(timer) })
}
