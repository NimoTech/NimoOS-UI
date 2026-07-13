import { ref, shallowRef, onMounted, onBeforeUnmount, type Ref, type ShallowRef } from 'vue'
import { service } from '@nimotech/nimoos-service'
import type { FileEntry } from '../stores/files'
import { i18n } from '../../i18n'

export type OfficeViewerState = 'loading' | 'ready' | 'error'

// 把底层库的英文报错映射成用户可读的中文原因。docx-preview / excel 用 JSZip 解压
// OOXML(.docx/.xlsx 本质是 zip);旧版二进制 .doc/.xls(OLE2)或损坏文件会报
// "Can't find end of central directory : is this a zip file?" —— 归一成友好提示。
function renderErrorReason(e: unknown): string {
  const msg = e instanceof Error ? e.message : typeof e === 'string' ? e : ''
  if (/zip|central directory/i.test(msg)) return i18n.global.t('filesViewerOfficeLegacy')
  return i18n.global.t('filesViewerParseFailed')
}

// 三个重查看器(PDF/Word/Excel)共用:取字节 + 三态机 + 卸载守卫。
// 字节走共享 service.file.getBytes(/v1/file, arraybuffer, 401 自愈);真实路径进 API。
// @vue-office 组件挂 @rendered → onRendered()、@error → onRenderError(err)。
// errorDetail 暴露失败原因(取字节失败 / 渲染失败),供 error 态展示,便于用户与诊断。
export function useOfficeBytes(item: FileEntry): {
  state: Ref<OfficeViewerState>
  buffer: ShallowRef<ArrayBuffer | null>
  errorDetail: Ref<string>
  onRendered: () => void
  onRenderError: (e?: unknown) => void
} {
  const state = ref<OfficeViewerState>('loading')
  const buffer = shallowRef<ArrayBuffer | null>(null)
  const errorDetail = ref('')
  // 异步 onMounted 的 await 期间可能已被卸载(用户快速关闭覆盖层)——卸载后放弃后续渲染。
  let disposed = false

  onMounted(async () => {
    try {
      const buf = await service.file.getBytes(item.path)
      if (disposed) return
      buffer.value = buf               // state 维持 loading,直到 @rendered
    } catch {
      if (disposed) return
      errorDetail.value = i18n.global.t('filesViewerFetchFailed')
      state.value = 'error'
    }
  })
  onBeforeUnmount(() => { disposed = true })

  function onRendered() { if (!disposed) state.value = 'ready' }
  function onRenderError(e?: unknown) {
    if (disposed) return
    errorDetail.value = renderErrorReason(e)
    state.value = 'error'
  }

  return { state, buffer, errorDetail, onRendered, onRenderError }
}
