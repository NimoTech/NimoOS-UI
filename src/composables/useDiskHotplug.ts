import { onMounted, onUnmounted } from 'vue'
import { useMessageBus } from './useMessageBus'

// 从 StorageVolumes/StorageDrives 抽取的重复热插拔接线(P1 台账债)。
// MessageBus handler 不可阻塞(buffer=1):防抖后刷新(Vue2 MountList 先例)。
export function useDiskHotplug(
  refresh: () => void,
  opts: { debounceMs?: number; loadOnMount?: boolean } = {},
): void {
  const { debounceMs = 500, loadOnMount = true } = opts
  const bus = useMessageBus()
  let hotplugTimer: number | undefined
  function onHotplug() {
    clearTimeout(hotplugTimer)
    hotplugTimer = window.setTimeout(() => { refresh() }, debounceMs)
  }
  let offAdd: (() => void) | undefined
  let offRemove: (() => void) | undefined
  onMounted(() => {
    if (loadOnMount) refresh()
    offAdd = bus.on('local-storage:disk:added', onHotplug)
    offRemove = bus.on('local-storage:disk:removed', onHotplug)
  })
  onUnmounted(() => {
    offAdd?.()
    offRemove?.()
    clearTimeout(hotplugTimer)
  })
}
