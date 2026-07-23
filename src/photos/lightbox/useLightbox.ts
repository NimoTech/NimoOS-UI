import { ref, computed, type Ref, type ComputedRef } from 'vue'
import { service } from '@nimotech/nimoos-service'
import { photoIndexById } from './util/photoNav'
import type { Photo } from '../util/assetToPhoto'

// 模块级单例状态
const open = ref(false)
const list = ref<Photo[]>([])
const index = ref(0)
const searchQuery = ref('')
const startMs = ref(0)

const current = computed<Photo | null>(() => list.value[index.value] ?? null)
const hasPrev = computed(() => index.value > 0)
const hasNext = computed(() => index.value < list.value.length - 1)

// ── 历史集成:灯箱开着时按"返回"应只关灯箱,而不是让路由退到上级页面还盖着灯箱层。
// 打开时 pushState 压一条同 URL 的记录(hash 路由不变,vue-router 视为无导航);
// 返回键 pop 掉它 → onPop 只关灯箱;X/ESC 关闭 → history.back() 吃掉这条记录。
let pushedHistory = false

function onPop(): void {
  pushedHistory = false
  window.removeEventListener('popstate', onPop)
  if (open.value) resetState()
}

function resetState(): void {
  open.value = false
  list.value = []
  index.value = 0
  searchQuery.value = ''
  startMs.value = 0
}

function openAt(photo: Photo, entryList: Photo[], startMsArg?: number, query?: string): void {
  list.value = entryList && entryList.length ? entryList : [photo]
  index.value = photoIndexById(list.value, photo)
  searchQuery.value = (query || '').trim()
  startMs.value = photo.isVideo && (startMsArg || 0) > 0 ? (startMsArg as number) : 0
  open.value = true
  if (!pushedHistory && typeof window !== 'undefined') {
    window.history.pushState({ nimoosPhotoLightbox: true }, '')
    pushedHistory = true
    window.addEventListener('popstate', onPop)
  }
  void service.photos.recordView(photo.id).then(undefined, () => {})
}

function close(): void {
  resetState()
  if (pushedHistory && typeof window !== 'undefined') {
    pushedHistory = false
    window.removeEventListener('popstate', onPop)
    window.history.back() // 消耗 openAt 压入的记录,历史栈保持干净
  }
}

function goTo(i: number): void {
  if (i < 0 || i >= list.value.length) return
  index.value = i
}

function prev(): void {
  if (hasPrev.value) index.value -= 1
}

function next(): void {
  if (hasNext.value) index.value += 1
}

function __resetForTest(): void {
  if (typeof window !== 'undefined') window.removeEventListener('popstate', onPop)
  pushedHistory = false
  resetState()
}

export function useLightbox(): {
  open: Ref<boolean>
  list: Ref<Photo[]>
  index: Ref<number>
  searchQuery: Ref<string>
  startMs: Ref<number>
  current: ComputedRef<Photo | null>
  hasPrev: ComputedRef<boolean>
  hasNext: ComputedRef<boolean>
  openAt: (photo: Photo, entryList: Photo[], startMs?: number, query?: string) => void
  close: () => void
  prev: () => void
  next: () => void
  goTo: (i: number) => void
  __resetForTest: () => void
} {
  return { open, list, index, searchQuery, startMs, current, hasPrev, hasNext, openAt, close, prev, next, goTo, __resetForTest }
}
