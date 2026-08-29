import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { service, type Utilization } from '@nimotech/nimoos-service'

const HIST_MAX = 60
type Dict = Record<string, any> | null

export const useLiveStatsStore = defineStore('home-livestats', () => {
  const disk = ref<Dict>(null)
  const cpu = ref<Dict>(null)
  const mem = ref<Dict>(null)
  const gpu = ref<any[] | null>(null)
  const nets = ref<any[]>([])
  const netHist = ref<Record<string, { up: number[]; down: number[] }>>({})
  const cpuHist = ref<number[]>([])
  const _netCache = ref<Record<string, { bytesSent: number; bytesRecv: number; time: number }>>({})
  const netSel = ref<string | null>(localStorage.getItem('nimoos.home.netdev') || null)

  const gpuPresent = computed(() => Array.isArray(gpu.value) && gpu.value.length > 0)

  // engine.js 480-508
  function ingest(p: Utilization) {
    if (p.disk) disk.value = p.disk as Dict
    if (p.cpu) {
      cpu.value = p.cpu as Dict
      const pc = (p.cpu as any).percent
      if (pc != null) { cpuHist.value.push(Math.round(pc)); if (cpuHist.value.length > HIST_MAX) cpuHist.value.shift() }
    }
    if (p.mem) mem.value = p.mem as Dict
    if (Array.isArray(p.gpu)) gpu.value = p.gpu as any[]
    const net = p.net as any[] | null
    if (Array.isArray(net) && net.length) {
      nets.value = net
      net.forEach((nif: any) => {
        const prev = _netCache.value[nif.name]
        if (prev && nif.time > prev.time) {
          const dt = nif.time - prev.time
          const h = netHist.value[nif.name] || (netHist.value[nif.name] = { up: [], down: [] })
          h.up.push(Math.max(0, (nif.bytesSent - prev.bytesSent) / dt))
          h.down.push(Math.max(0, (nif.bytesRecv - prev.bytesRecv) / dt))
          if (h.up.length > HIST_MAX) h.up.shift()
          if (h.down.length > HIST_MAX) h.down.shift()
        }
        _netCache.value[nif.name] = { bytesSent: nif.bytesSent, bytesRecv: nif.bytesRecv, time: nif.time }
      })
      if (!netSel.value || !net.some((n: any) => n.name === netSel.value)) {
        const u = net.find((n: any) => n.state === 'up') || net[0]
        netSel.value = u ? u.name : null
      }
    }
  }

  async function fetchOnce() {
    const u = await service.sys.getUtilization()
    if (u) ingest(u)
  }

  function setNetSel(name: string) {
    netSel.value = name
    try { localStorage.setItem('nimoos.home.netdev', name) } catch { /* ignore */ }
  }

  return { disk, cpu, mem, gpu, nets, netHist, cpuHist, _netCache, netSel, gpuPresent, ingest, fetchOnce, setNetSel }
})
