import { ref } from 'vue'

// 模块级单例(useDock/useAddPanel 同款):AreaShell(☰ 钮)与各区 Sidebar(files/apps)(抽屉/遮罩)
// 以及三个页面(Files/Shares/Drop)共享同一份状态。
// matchMedia 不存在时(jsdom)isNarrow 恒 false,一切退化为桌面常驻侧栏。
const isNarrow = ref(false)
const open = ref(false)
let mq: MediaQueryList | null = null
let inited = false

function onChange(e: MediaQueryListEvent | { matches: boolean }) {
  isNarrow.value = e.matches
  if (!e.matches) open.value = false // 离开窄屏清零抽屉态,桌面恒常驻
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
