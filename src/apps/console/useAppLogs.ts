import { ref } from 'vue'
import { service } from '@nimotech/nimoos-service'

const POLL_MS = 5000 // Same rhythm as Vue2 AppTerminalPanel
const LINES = 1000 // Backend default; enough to view and doesn't blow up DOM

export function useAppLogs(appId: () => string) {
  const text = ref('')
  const loading = ref(false)
  const error = ref('')
  let timer: ReturnType<typeof setInterval> | null = null

  async function refresh() {
    loading.value = true
    try {
      text.value = await service.compose.logs(appId(), { lines: LINES })
      error.value = ''
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e) // Old text preserved, polling next round self-heals
    } finally {
      loading.value = false
    }
  }

  function start() {
    if (timer) return
    void refresh()
    // Tick-only guard: skip firing a new refresh() while one is still in flight (slow
    // network/backend). Without this, an overlapping request can resolve out of order —
    // an older response landing after a newer one would briefly flash stale logs back into
    // `text`. Manual refresh() (button click) intentionally has no such guard.
    timer = setInterval(() => { if (!loading.value) void refresh() }, POLL_MS)
  }

  function stop() {
    if (timer) { clearInterval(timer); timer = null }
  }

  return { text, loading, error, refresh, start, stop }
}
