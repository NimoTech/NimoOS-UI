import { ref, onBeforeUnmount, type Ref } from 'vue'

const QUERY = '(max-width: 720px)'

// 响应式"手机断点"判断(与顶栏/Dock 的 ≤720px 媒体查询同一阈值)。
// matchMedia 不存在时(jsdom/极旧内核)恒 false,一切退化为桌面渲染路径。
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
