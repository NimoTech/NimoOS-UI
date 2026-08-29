import { defineStore } from 'pinia'
import { ref } from 'vue'
import { service } from '@nimotech/nimoos-service'
import { toEvent, type EventItem } from '../util/eventMap'

export const useEventsStore = defineStore('home-events', () => {
  const list = ref<EventItem[]>([])

  async function loadHistory() {
    const arr = await service.users.getEvents()
    list.value = (Array.isArray(arr) ? arr : [])
      .map((e: any) => {
        let props: Record<string, unknown> = {}
        try { props = JSON.parse(e.properties || '{}') } catch { /* ignore */ }
        return toEvent(e.name, props, e.timestamp, e.uuid)
      })
      .sort((a, b) => b.ts - a.ts)
      .slice(0, 20)
  }

  function pushLive(name: string, props: Record<string, unknown>, ts: number, uuid?: string) {
    const ne = toEvent(name, props, ts, uuid)
    if (list.value.some((x) => x.uuid === ne.uuid)) return
    list.value = [ne, ...list.value].slice(0, 20)
  }

  return { list, loadHistory, pushLive }
})
