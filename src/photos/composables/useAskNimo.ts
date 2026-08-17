// Photos-side "is the chat open, what's the prefill/context, where does the FAB sit" state.
// Module-level singleton, same convention as useLightbox()/usePhotosToast() -- every caller
// across every Photos view shares one instance (Photos has no shared shell to provide() this
// through, see AskNimoHost.vue's header comment).
import { ref, watch } from 'vue'
import { useAgentStore } from '../../ai/stores/agentStore'
import { ensurePhotosSession, touchPhotosSession, __resetPhotosSessionForTests } from './useAskNimoSession'

export interface AskNimoContextPhoto { id: string | number; name: string; takenAt: unknown; place: string | null }
export interface AskNimoContextAlbum { id: string | number; name: string }
export interface AskNimoOpenPayload {
  text: string
  contextPhoto?: AskNimoContextPhoto | null
  contextAlbum?: AskNimoContextAlbum | null
}

const FAB_RIGHT_KEY = 'nimo_fab_right'
const FAB_BOTTOM_KEY = 'nimo_fab_bottom'
const FAB_MINI_Y_KEY = 'nimo_mini_y'
const FAB_DISMISSED_KEY = 'nimo_fab_dismissed'

// Review fix (localStorage failure tolerance): mirrors Vue2 PhotosAskNimo.vue, which wraps
// every localStorage access -- quota-exceeded / private-mode Safari / disabled storage must
// degrade to the fallback/no-op rather than throwing into callers (e.g. T10's mouseup handler).
function readNum(key: string, fallback: number): number {
  try {
    const raw = localStorage.getItem(key)
    // Review fix (minor): an empty-string stored value must resolve to the fallback, not 0
    // (Number('') === 0, which is a silent wrong-default bug distinct from "nothing stored").
    if (raw === null || raw === '') return fallback
    const n = Number(raw)
    return Number.isFinite(n) ? n : fallback
  } catch {
    return fallback
  }
}

function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Best-effort persistence only -- see readNum's comment above.
  }
}

function removeStorage(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    // Best-effort persistence only -- see readNum's comment above.
  }
}

const popupOpen = ref(false)
const drawerOpen = ref(false)
const prefill = ref('')
const contextPhoto = ref<AskNimoContextPhoto | null>(null)
const contextAlbum = ref<AskNimoContextAlbum | null>(null)
const taskBarExpanded = ref(false)
const fabDismissed = ref(readNum(FAB_DISMISSED_KEY, 0) === 1)
// Review fix (defaults): Vue2 PhotosAskNimo.vue:117-118 is the truth for the FAB's default
// resting position -- 14/14, not 24/24. miniY's 24 default is already correct and unchanged.
const fabRight = ref(readNum(FAB_RIGHT_KEY, 14))
const fabBottom = ref(readNum(FAB_BOTTOM_KEY, 14))
const miniY = ref(readNum(FAB_MINI_Y_KEY, 24))

let modelsInit: Promise<void> | null = null
let ensureInflight: Promise<void> | null = null
let touchWatchersBound = false

// Preflight F-08: mirrors Vue2 PhotosTimeline.vue's own watchers (`agentStore.state.messages.length`
// growing, `agentStore.state.busy` transitioning to false) that keep the 1-hour idle TTL (Constraints
// #5) honest. Bound lazily (not at module top-level) because useAgentStore() requires an active
// Pinia instance, which is not guaranteed yet at module-evaluation time.
function bindTouchWatchers(): void {
  if (touchWatchersBound) return
  touchWatchersBound = true
  // Review fix (minor): __resetForTests() clears this flag so a later ensureNimoAgentInit()
  // call re-binds -- the two watch() calls below stack up on the same agent store instance
  // across test cases (prior watchers are never torn down). Harmless in production (this file
  // has no equivalent of __resetForTests() outside tests) and accepted as test-only debt.
  const agent = useAgentStore('photos')
  watch(() => agent.messages.length, (n, o) => { if (n > (o ?? 0)) touchPhotosSession() })
  watch(() => agent.busy, (isBusy) => { if (!isBusy) touchPhotosSession() })
}

function openWith(payload: string | AskNimoOpenPayload): void {
  if (typeof payload === 'string') {
    prefill.value = payload
    contextPhoto.value = null
    contextAlbum.value = null
  } else {
    prefill.value = payload.text
    contextPhoto.value = payload.contextPhoto ?? null
    contextAlbum.value = payload.contextAlbum ?? null
  }
  popupOpen.value = true
  void ensureNimoAgentInit()
}

function openDrawer(): void {
  drawerOpen.value = true
  popupOpen.value = false
  void ensureNimoAgentInit()
}

function expand(): void {
  popupOpen.value = false
  drawerOpen.value = true
}

function closePopup(): void { popupOpen.value = false }
function closeDrawer(): void { drawerOpen.value = false }

function dismissFab(): void {
  fabDismissed.value = true
  writeStorage(FAB_DISMISSED_KEY, '1')
}
function restoreFab(): void {
  fabDismissed.value = false
  removeStorage(FAB_DISMISSED_KEY)
}

function setFabPosition(right: number, bottom: number): void {
  fabRight.value = right
  fabBottom.value = bottom
  writeStorage(FAB_RIGHT_KEY, String(right))
  writeStorage(FAB_BOTTOM_KEY, String(bottom))
}
function setMiniY(y: number): void {
  miniY.value = y
  writeStorage(FAB_MINI_Y_KEY, String(y))
}
// Re-check N-5 ③: update the visible ref every mousemove frame WITHOUT touching localStorage --
// Vue2 PhotosAskNimo.vue's own _dragOnMove only mutates `this.fabRight`/`this.fabBottom` (plain
// reactive assignment), and localStorage.setItem only happens once, inside _dragOnUp. The plan's
// AskNimoFab.vue drag handler (Task 10) calls this on every mousemove, then calls the persisting
// setFabPosition()/setMiniY() above exactly once at mouseup.
function setFabPositionLocal(right: number, bottom: number): void {
  fabRight.value = right
  fabBottom.value = bottom
}
function setMiniYLocal(y: number): void {
  miniY.value = y
}

function consumePrefill(): void { prefill.value = '' }
function consumeContextPhoto(): void { contextPhoto.value = null }
function consumeContextAlbum(): void { contextAlbum.value = null }

async function ensureNimoAgentInit(): Promise<void> {
  const agent = useAgentStore('photos')
  bindTouchWatchers()
  if (!modelsInit) {
    modelsInit = agent.loadAvailableModels().catch((e) => {
      modelsInit = null
      console.warn('[AskNimo] loadAvailableModels failed', e)
    })
  }
  if (!ensureInflight) {
    ensureInflight = ensurePhotosSession(agent)
      .catch((e) => console.warn('[AskNimo] ensurePhotosSession failed', e))
      .finally(() => { ensureInflight = null })
  }
  await Promise.all([modelsInit, ensureInflight])
}

function __resetForTests(): void {
  popupOpen.value = false
  drawerOpen.value = false
  prefill.value = ''
  contextPhoto.value = null
  contextAlbum.value = null
  taskBarExpanded.value = false
  fabDismissed.value = readNum(FAB_DISMISSED_KEY, 0) === 1
  fabRight.value = readNum(FAB_RIGHT_KEY, 14)
  fabBottom.value = readNum(FAB_BOTTOM_KEY, 14)
  miniY.value = readNum(FAB_MINI_Y_KEY, 24)
  modelsInit = null
  ensureInflight = null
  touchWatchersBound = false
  // Preflight F-19: without this, T1's `bootDone`/`lastActiveAt` module state leaks across test
  // files that only reset the useAskNimo() side, silently changing ensurePhotosSession()'s
  // first-call-this-page-load branch behavior between unrelated test cases.
  __resetPhotosSessionForTests()
}

export function useAskNimo() {
  return {
    popupOpen, drawerOpen, prefill, contextPhoto, contextAlbum, taskBarExpanded,
    fabDismissed, fabRight, fabBottom, miniY,
    openWith, openDrawer, expand, closePopup, closeDrawer,
    dismissFab, restoreFab, setFabPosition, setMiniY, setFabPositionLocal, setMiniYLocal,
    consumePrefill, consumeContextPhoto, consumeContextAlbum,
    ensureNimoAgentInit, __resetForTests,
  }
}
