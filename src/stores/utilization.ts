import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { service, parseUtil, type Utilization } from '@nimotech/nimoos-service'

function num(section: Record<string, unknown> | null, key: string): number | null {
  if (!section) return null
  const v = section[key]
  return typeof v === 'number' ? v : null
}

export const useUtilizationStore = defineStore('utilization', () => {
  const data = ref<Utilization | null>(null)

  const cpuPercent = computed(() => num(data.value?.cpu ?? null, 'percent'))
  const memPercent = computed(() => num(data.value?.mem ?? null, 'usedPercent'))

  async function fetchOnce() {
    data.value = await service.sys.getUtilization()
  }

  // socket 原始消息(sys_* JSON 串)→ 同一 Utilization 结构原地刷新
  function applySocket(raw: unknown) {
    data.value = parseUtil(raw as Record<string, unknown>)
  }

  return { data, cpuPercent, memPercent, fetchOnce, applySocket }
})
