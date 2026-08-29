import { ref, computed, type Ref, type ComputedRef } from 'vue'
import { service } from '@nimotech/nimoos-service'
import { photoIndexById } from './util/photoNav'
import { assetToPhoto, type Photo } from '../util/assetToPhoto'
import { usePhotosFavorites } from '../stores/favorites'

// Module-level singleton state
const open = ref(false)
const list = ref<Photo[]>([])
const index = ref(0)
const searchQuery = ref('')
const startMs = ref(0)
const detail = ref<Photo | null>(null)
const ocrLines = ref<Array<{ box: number[] }>>([])
let _hydrateSeq = 0

const current = computed<Photo | null>(() => list.value[index.value] ?? null)
const hasPrev = computed(() => index.value > 0)
const hasNext = computed(() => index.value < list.value.length - 1)
// Favorite state delegated to photosFavorites store (one of P3's three co-sources; usePhotosFavorites() lazy call —
// by evaluation time Pinia is active, cannot call at module top level).
const isFav = computed<boolean>(() => {
  const fav = usePhotosFavorites()
  return !!(current.value && fav.isFav(current.value.id))
})

// ── History integration: back button while lightbox open should only close lightbox, not navigate router to parent still under lightbox.
// On open pushState one same-URL record (hash route unchanged, vue-router sees no navigation);
// back button pops it → onPop only closes lightbox; X/ESC close → history.back() consumes that record.
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

// After current item changes: immediately use list item itself as detail placeholder (avoid flashing empty), bump seq, async hydrate details.
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
  usePhotosFavorites().recordView(photo.id)
  onCurrentChanged()
  void reconcileFav()
}

function close(): void {
  resetState()
  if (pushedHistory && typeof window !== 'undefined') {
    pushedHistory = false
    window.removeEventListener('popstate', onPop)
    window.history.back() // Consume record pushed by openAt, keep history stack clean
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
    // Keep the list-item placeholder already set on `detail`
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
  await usePhotosFavorites().reconcileFavIds()
}

async function toggleFav(): Promise<void> {
  const item = current.value
  if (!item) return
  await usePhotosFavorites().toggle(item.id)
}

function __resetForTest(): void {
  if (typeof window !== 'undefined') window.removeEventListener('popstate', onPop)
  pushedHistory = false
  _hydrateSeq = 0
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
