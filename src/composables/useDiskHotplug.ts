import { onMounted, onUnmounted } from 'vue'
import { useMessageBus } from './useMessageBus'

// Repeated hot-swap wiring extracted from StorageVolumes/StorageDrives (P1 tech debt).
// MessageBus handler must not block (buffer=1): refresh after debouncing (Vue2 MountList precedent).
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
