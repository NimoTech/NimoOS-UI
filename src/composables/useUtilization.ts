import { onMounted, onUnmounted } from 'vue'
import { useUtilizationStore } from '../stores/utilization'
import { useMessageBus } from './useMessageBus'

const UTIL_EVENT = 'nimoos:system:utilization'

export function useUtilization() {
  const store = useUtilizationStore()
  const bus = useMessageBus()
  let off: (() => void) | null = null

  onMounted(async () => {
    try { await store.fetchOnce() } catch (e) { console.error('[utilization] initial fetch failed', e) }
    off = bus.on(UTIL_EVENT, (props) => store.applySocket(props))
  })

  onUnmounted(() => { off?.() })

  return store
}
