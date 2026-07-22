import { ref } from 'vue'
import { service } from '@nimotech/nimoos-service'

const POLL_MS = 5000 // Vue2 AppTerminalPanel 同款节奏
const LINES = 1000 // 后端默认;够看且不撑爆 DOM

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
      error.value = e instanceof Error ? e.message : String(e) // 旧 text 保留,轮询下一轮自愈
    } finally {
      loading.value = false
    }
  }

  function start() {
    if (timer) return
    void refresh()
    timer = setInterval(() => { void refresh() }, POLL_MS)
  }

  function stop() {
    if (timer) { clearInterval(timer); timer = null }
  }

  return { text, loading, error, refresh, start, stop }
}
