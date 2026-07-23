import { ref, computed, type Ref, type ComputedRef } from 'vue'
import { service } from '@nimotech/nimoos-service'
import { photoIndexById } from './util/photoNav'
import { assetToPhoto, type Photo } from '../util/assetToPhoto'

// 模块级单例状态
const open = ref(false)
const list = ref<Photo[]>([])
const index = ref(0)
const searchQuery = ref('')
const startMs = ref(0)
const detail = ref<Photo | null>(null)
const ocrLines = ref<Array<{ box: number[] }>>([])
const favIds = ref<Set<string>>(new Set())
let _hydrateSeq = 0

const current = computed<Photo | null>(() => list.value[index.value] ?? null)
const hasPrev = computed(() => index.value > 0)
const hasNext = computed(() => index.value < list.value.length - 1)
const isFav = computed<boolean>(() => !!(current.value && favIds.value.has(String(current.value.id))))

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
  detail.value = null
  ocrLines.value = []
}

// 当前项变化后:立即用列表项本身占位 detail(避免闪空),bump seq,异步补水合明细。
function onCurrentChanged(): void {
  detail.value = current.value
  _hydrateSeq += 1
  void hydrateDetail()
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
  onCurrentChanged()
  void reconcileFav()
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
  onCurrentChanged()
}

function prev(): void {
  if (hasPrev.value) {
    index.value -= 1
    onCurrentChanged()
  }
}

function next(): void {
  if (hasNext.value) {
    index.value += 1
    onCurrentChanged()
  }
}

async function hydrateDetail(): Promise<void> {
  const seq = ++_hydrateSeq
  const item = current.value
  const id = item?.id
  if (item == null || id == null) return
  const wantOcr = !!searchQuery.value && !item.isVideo
  try {
    const asset = await service.photos.getAsset(id)
    if (seq !== _hydrateSeq || current.value?.id !== id) return
    detail.value = assetToPhoto(asset as unknown as Record<string, unknown>)
  } catch {
    // keep the list-item placeholder already set on `detail`
  }
  if (!wantOcr) {
    if (seq === _hydrateSeq && current.value?.id === id) ocrLines.value = []
    return
  }
  try {
    const result = await service.photos.getAssetOcr(id, searchQuery.value)
    if (seq !== _hydrateSeq || current.value?.id !== id) return
    ocrLines.value = (result as { lines?: Array<{ box: number[] }> } | null)?.lines ?? []
  } catch {
    if (seq === _hydrateSeq && current.value?.id === id) ocrLines.value = []
  }
}

async function reconcileFav(): Promise<void> {
  try {
    const ids = await service.photos.listFavoriteIds()
    favIds.value = new Set((ids ?? []).map((v) => String(v)))
  } catch {
    // leave favIds as-is on failure
  }
}

async function toggleFav(): Promise<void> {
  const item = current.value
  if (!item) return
  const id = item.id
  const key = String(id)
  const wasFav = favIds.value.has(key)
  const flipped = new Set(favIds.value)
  if (wasFav) flipped.delete(key)
  else flipped.add(key)
  favIds.value = flipped
  try {
    if (wasFav) await service.photos.unfavorite(id)
    else await service.photos.favorite(id)
  } catch {
    const rollback = new Set(favIds.value)
    if (wasFav) rollback.add(key)
    else rollback.delete(key)
    favIds.value = rollback
  }
}

function __resetForTest(): void {
  if (typeof window !== 'undefined') window.removeEventListener('popstate', onPop)
  pushedHistory = false
  _hydrateSeq = 0
  favIds.value = new Set()
  resetState()
}

export function useLightbox(): {
  open: Ref<boolean>
  list: Ref<Photo[]>
  index: Ref<number>
  searchQuery: Ref<string>
  startMs: Ref<number>
  detail: Ref<Photo | null>
  ocrLines: Ref<Array<{ box: number[] }>>
  favIds: Ref<Set<string>>
  current: ComputedRef<Photo | null>
  hasPrev: ComputedRef<boolean>
  hasNext: ComputedRef<boolean>
  isFav: ComputedRef<boolean>
  openAt: (photo: Photo, entryList: Photo[], startMs?: number, query?: string) => void
  close: () => void
  prev: () => void
  next: () => void
  goTo: (i: number) => void
  hydrateDetail: () => Promise<void>
  reconcileFav: () => Promise<void>
  toggleFav: () => Promise<void>
  __resetForTest: () => void
} {
  return {
    open,
    list,
    index,
    searchQuery,
    startMs,
    detail,
    ocrLines,
    favIds,
    current,
    hasPrev,
    hasNext,
    isFav,
    openAt,
    close,
    prev,
    next,
    goTo,
    hydrateDetail,
    reconcileFav,
    toggleFav,
    __resetForTest,
  }
}
