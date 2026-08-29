import { onMounted, onUnmounted } from 'vue'
import { parseUtil } from '@nimotech/nimoos-service'
import { useMessageBus } from '../../composables/useMessageBus'
import { useLiveStatsStore } from '../stores/liveStats'

const UTIL_EVENT = 'nimoos:system:utilization'

export function useLiveStats() {
  const store = useLiveStatsStore()
  const bus = useMessageBus()
  let off: (() => void) | null = null

  onMounted(async () => {
    try { await store.fetchOnce() } catch (e) { console.error('[liveStats] initial fetch failed', e) }
    off = bus.on(UTIL_EVENT, (props) => store.ingest(parseUtil(props as Record<string, unknown>)))
  })
  onUnmounted(() => { off?.() })

  return store
}
