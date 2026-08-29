import { ref, shallowRef, onMounted, onBeforeUnmount, type Ref, type ShallowRef } from 'vue'
import { service } from '@nimotech/nimoos-service'
import type { FileEntry } from '../stores/files'
import { i18n } from '../../i18n'

export type OfficeViewerState = 'loading' | 'ready' | 'error'

// Maps underlying library English error messages to user-readable reasons. docx-preview / excel use
// JSZip to decompress OOXML (.docx/.xlsx are zip files at heart); legacy binary .doc/.xls (OLE2) or
// corrupted files report "Can't find end of central directory : is this a zip file?" —— normalize to a friendly message.
function renderErrorReason(e: unknown): string {
  const msg = e instanceof Error ? e.message : typeof e === 'string' ? e : ''
  if (/zip|central directory/i.test(msg)) return i18n.global.t('filesViewerOfficeLegacy')
  return i18n.global.t('filesViewerParseFailed')
}

// Three heavy viewers (PDF/Word/Excel) share: fetch bytes + state machine + unmount guard.
// Bytes go through shared service.file.getBytes (/v1/file, arraybuffer, auto-heals on 401); real path goes to API.
// @vue-office component hooks @rendered → onRendered(), @error → onRenderError(err).
// errorDetail exposes failure reason (fetch failed / render failed), for error state display, aids user and diagnosis.
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
  // During await in async onMounted, unmount may already have happened (user closes overlay quickly) —— abandon rendering after unmount.
  let disposed = false

  onMounted(async () => {
    try {
      const buf = await service.file.getBytes(item.path)
      if (disposed) return
      buffer.value = buf               // state stays loading until @rendered
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
