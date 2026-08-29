import { onMounted, onUnmounted } from 'vue'
import { useMessageBus } from '../../composables/useMessageBus'
import { useEventsStore } from '../stores/events'

const EVENTS = ['app:install-end', 'app:install-error', 'app:apply-changes-end', 'app:update-end', 'local-storage:disk:added', 'local-storage:disk:removed']

export function useEvents() {
  const store = useEventsStore()
  const bus = useMessageBus()
  const offs: Array<() => void> = []

  onMounted(async () => {
    try { await store.loadHistory() } catch (e) { console.error('[events] history failed', e) }
    EVENTS.forEach((ev) => {
      offs.push(bus.on(ev, (props, raw) => {
        const r = raw as { timestamp?: string; uuid?: string } | undefined
        const ts = r && r.timestamp ? (Date.parse(r.timestamp) || Date.now()) : Date.now()
        store.pushLive(ev, (props as Record<string, unknown>) || {}, ts, r && r.uuid)
      }))
    })
  })
  onUnmounted(() => offs.forEach((o) => o()))
  return store
}
