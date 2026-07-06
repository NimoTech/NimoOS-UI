import { ref, shallowRef, onMounted, onBeforeUnmount, type Ref, type ShallowRef } from 'vue'
import { service } from '@nimotech/nimoos-service'
import type { FileEntry } from '../stores/files'

export type OfficeViewerState = 'loading' | 'ready' | 'error'

// 三个重查看器(PDF/Word/Excel)共用:取字节 + 三态机 + 卸载守卫。
// 字节走共享 service.file.getBytes(/v1/file, arraybuffer, 401 自愈);真实路径进 API。
// @vue-office 组件挂 @rendered → onRendered()、@error → onRenderError()。
export function useOfficeBytes(item: FileEntry): {
  state: Ref<OfficeViewerState>
  buffer: ShallowRef<ArrayBuffer | null>
  onRendered: () => void
  onRenderError: () => void
} {
  const state = ref<OfficeViewerState>('loading')
  const buffer = shallowRef<ArrayBuffer | null>(null)
  // 异步 onMounted 的 await 期间可能已被卸载(用户快速关闭覆盖层)——卸载后放弃后续渲染。
  let disposed = false

  onMounted(async () => {
    try {
      const buf = await service.file.getBytes(item.path)
      if (disposed) return
      buffer.value = buf               // state 维持 loading,直到 @rendered
    } catch {
      if (disposed) return
      state.value = 'error'
    }
  })
  onBeforeUnmount(() => { disposed = true })

  function onRendered() { if (!disposed) state.value = 'ready' }
  function onRenderError() { if (!disposed) state.value = 'error' }

  return { state, buffer, onRendered, onRenderError }
}
