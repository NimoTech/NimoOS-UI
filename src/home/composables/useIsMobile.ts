import { ref, onBeforeUnmount, type Ref } from 'vue'

const QUERY = '(max-width: 720px)'

// Reactive "mobile breakpoint" check (same threshold as the topbar/Dock ≤720px media query).
// When matchMedia is unavailable (jsdom / very old engines) it stays false and everything degrades to the desktop render path.
export function useIsMobile(): Ref<boolean> {
  const isMobile = ref(false)
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return isMobile
  const mq = window.matchMedia(QUERY)
  isMobile.value = mq.matches
  const onChange = (e: MediaQueryListEvent) => { isMobile.value = e.matches }
  mq.addEventListener('change', onChange)
  onBeforeUnmount(() => mq.removeEventListener('change', onChange))
  return isMobile
}
