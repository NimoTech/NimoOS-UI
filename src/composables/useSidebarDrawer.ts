import { ref } from 'vue'

// Module-level singleton (same as useDock/useAddPanel): AreaShell (☰ button) and each
// section's Sidebar (files/apps) (drawer/overlay) and the three pages (Files/Shares/Drop)
// share the same state. When matchMedia does not exist (jsdom), isNarrow is always false,
// everything degrades to a permanently resident desktop sidebar.
const isNarrow = ref(false)
const open = ref(false)
let mq: MediaQueryList | null = null
let inited = false

function onChange(e: MediaQueryListEvent | { matches: boolean }) {
  isNarrow.value = e.matches
  if (!e.matches) open.value = false // When leaving narrow screen, reset drawer state; desktop always resident
}

function init() {
  if (inited) return
  inited = true
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
  mq = window.matchMedia('(max-width: 768px)')
  isNarrow.value = mq.matches
  mq.addEventListener('change', onChange)
}

export function useSidebarDrawer() {
  init()
  return {
    isNarrow,
    open,
    toggle() { open.value = !open.value },
    close() { open.value = false },
  }
}

export function __resetSidebarDrawerForTest() {
  mq?.removeEventListener('change', onChange)
  mq = null
  inited = false
  isNarrow.value = false
  open.value = false
}
