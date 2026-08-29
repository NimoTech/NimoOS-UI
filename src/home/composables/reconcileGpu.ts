import type { useLayoutStore } from '../stores/layout'
import type { useLiveStatsStore } from '../stores/liveStats'

// gpu known to be empty array → remove gpu widget from layout (not persisted)
export function reconcileGpu(
  layout: ReturnType<typeof useLayoutStore>,
  live: ReturnType<typeof useLiveStatsStore>,
) {
  if (!Array.isArray(live.gpu)) return
  if (live.gpu.length === 0) {
    layout.items.filter((it) => it.kind === 'widget' && it.key === 'gpu').forEach((it) => layout.remove(it.id))
  }
}
